import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, requireStaff, validateBody, ApiError } from "@/lib/api-utils";
import { applyDiscount, calculateOfferAmount, derivePaymentStatus, offerMatchesRoomCategory } from "@/lib/pricing";
import { findOrCreateClient } from "@/lib/client-utils";
import { sendReservationAccepted } from "@/lib/email";
import { smsReservationAccepted, smsManagerReservationProcessed } from "@/lib/sms";

const createSchema = z.object({
  reservationId: z.string().uuid("ID de réservation invalide"),
  chambreId: z.string().uuid("ID de chambre invalide"),
  offer: z.enum(["nuitee", "forfait", "passage", "villa_1ch", "villa_2ch", "longue_duree", "personnalise"]),
  startAt: z.string().min(1, "Date de début requise"),
  endAt: z.string().optional().nullable(),
  discountType: z.enum(["none", "percent", "fixed"]).default("none"),
  discountValue: z.coerce.number().min(0).default(0),
  paymentArrangement: z.enum(["immediat", "avance_partielle", "fin_sejour"]).default("fin_sejour"),
  initialPayment: z.coerce.number().min(0).default(0),
  notes: z.string().trim().max(1000).optional().nullable(),
  customAmount: z.coerce.number().min(0).optional().nullable(),
});

export const GET = withErrorHandler(async () => {
  await requireStaff();

  const items = await prisma.sejour.findMany({
    where: { source: "web" },
    include: {
      client: true,
      chambre: { select: { numero: true, type: true } },
      reservation: { select: { reference: true } },
      extensions: true,
      payments: { orderBy: { paidAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ items });
});

export const POST = withErrorHandler(async (req: Request) => {
  await requireStaff();
  const body = await req.json();
  const data = validateBody(createSchema, body);

  const reservation = await prisma.reservation.findUnique({
    where: { id: data.reservationId },
    include: { client: true, sejour: true },
  });
  if (!reservation) throw new ApiError(404, "Réservation introuvable.");
  if (!["validee", "acceptee"].includes(reservation.status)) {
    throw new ApiError(409, "La réservation doit être validée avant attribution.");
  }
  if (reservation.sejour) {
    throw new ApiError(409, "Cette réservation est déjà convertie en séjour.");
  }

  const client = reservation.clientId
    ? reservation.client
    : await findOrCreateClient(prisma, {
        firstName: reservation.firstName,
        lastName: reservation.lastName,
        email: reservation.email,
        phone: reservation.phone,
        documentNumber: reservation.documentNumber ?? null,
        documentType: reservation.documentType ?? null,
        birthDate: reservation.birthDate ?? null,
        age: reservation.age ?? null,
      });

  const chambre = await prisma.chambre.findUnique({ where: { id: data.chambreId } });
  if (!chambre) throw new ApiError(404, "Chambre introuvable.");
  if (chambre.status === "maintenance") throw new ApiError(409, "La chambre est en maintenance.");
  if (!offerMatchesRoomCategory(data.offer, chambre.categorie)) {
    throw new ApiError(409, "Offre incompatible avec la catégorie de chambre sélectionnée.");
  }

  const startAt = new Date(data.startAt);
  const endAt = data.endAt ? new Date(data.endAt) : null;
  if (Number.isNaN(startAt.getTime())) {
    throw new ApiError(400, "Date de début invalide.");
  }
  if (endAt && Number.isNaN(endAt.getTime())) {
    throw new ApiError(400, "Date de fin invalide.");
  }

  const pricing = calculateOfferAmount({
    offer: data.offer,
    startAt,
    endAt,
    customAmount: data.customAmount ?? null,
    roomDailyRate: Number(chambre.prix),
  });

  if (pricing.normalizedEndAt <= startAt) {
    throw new ApiError(400, "La date de fin du séjour doit être postérieure à la date de début.");
  }
  const discountAmount = applyDiscount(pricing.baseAmount, (data.discountType ?? "none"), (data.discountValue ?? 0));
  const netAmount = Math.max(0, pricing.baseAmount - discountAmount);
  const amountPaid = Math.min(netAmount, data.initialPayment ?? 0);
  const paymentStatus = derivePaymentStatus(netAmount, amountPaid, amountPaid > 0 ? 1 : 0);

  const overlappingStay = await prisma.sejour.findFirst({
    where: {
      chambreId: chambre.id,
      status: { in: ["planifie", "en_cours"] },
      startedAt: { lt: pricing.normalizedEndAt },
      currentEndAt: { gt: startAt },
    },
    select: { id: true },
  });

  if (overlappingStay) {
    throw new ApiError(409, "Cette chambre est déjà occupée ou planifiée sur la période sélectionnée.");
  }

  const now = new Date();
  const stay = await prisma.$transaction(async (tx ) => {
    const created = await tx.sejour.create({
      data: {
        clientId: reservation.clientId ?? client?.id ?? reservation.client?.id ?? "",
        chambreId: chambre.id,
        reservationId: reservation.id,
        source: "web",
        status: startAt <= now ? "en_cours" : "planifie",
        offer: data.offer,
        startedAt: startAt,
        endedAt: pricing.normalizedEndAt,
        currentEndAt: pricing.normalizedEndAt,
        baseAmount: pricing.baseAmount,
        discountType: data.discountType ?? "none",
        discountValue: data.discountValue ?? 0,
        discountAmount,
        netAmount,
        amountPaid,
        balanceDue: Math.max(0, netAmount - amountPaid),
        paymentArrangement: data.paymentArrangement,
        paymentStatus,
        notes: data.notes ?? reservation.notes ?? null,
        checkedInAt: startAt <= now ? now : null,
      },
      include: { chambre: { select: { numero: true, type: true } } },
    });

    if (amountPaid > 0) {
      await tx.payment.create({
        data: {
          stayId: created.id,
          paidAt: now,
          amount: amountPaid,
          method: "mobile_money",
          type: amountPaid >= netAmount ? "solde" : "acompte",
          notes: "Paiement initial lors de l'attribution.",
        },
      });
    }

    await tx.reservation.update({
      where: { id: reservation.id },
      data: { status: "convertie", clientId: reservation.clientId ?? client?.id ?? reservation.client?.id ?? null },
    });

    if (startAt <= now && chambre.status !== "maintenance") {
      await tx.chambre.update({
        where: { id: chambre.id },
        data: { status: "occupee" },
      });
    }

    return created;
  });

  sendReservationAccepted(
    reservation.email,
    reservation.firstName,
    reservation.lastName,
    stay.chambre
  ).catch((error) => console.error("Email attribution failed:", error));
  smsReservationAccepted(reservation.phone, reservation.firstName, stay.chambre.numero).catch((error) =>
    console.error("SMS attribution failed:", error)
  );
  smsManagerReservationProcessed(reservation.firstName, reservation.lastName, "acceptée").catch((error) =>
    console.error("SMS manager failed:", error)
  );

  return NextResponse.json(stay, { status: 201 });
});

export const DELETE = withErrorHandler(async (req: Request) => {
  await requireStaff();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) throw new ApiError(400, "Paramètre 'id' manquant.");

  const stay = await prisma.sejour.findUnique({
    where: { id },
    include: { reservation: true, payments: true, extensions: true, chambre: true },
  });

  if (!stay) throw new ApiError(404, "Séjour introuvable.");
  if (stay.payments.length > 0 || stay.extensions.length > 0) {
    throw new ApiError(409, "Impossible de supprimer un séjour avec paiements ou extensions.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.sejour.delete({ where: { id } });
    if (stay.reservationId) {
      await tx.reservation.update({
        where: { id: stay.reservationId },
        data: { status: "validee" },
      });
    }
    await tx.chambre.update({
      where: { id: stay.chambreId },
      data: { status: "disponible" },
    });
  });

  return NextResponse.json({ ok: true });
});

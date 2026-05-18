import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, requireStaff, validateBody, ApiError } from "@/lib/api-utils";
import {
  applyDiscount,
  calculateOfferAmount,
  derivePaymentStatus,
  DISCOUNT_CODES,
  OFFER_CODES,
  isOfferCompatibleWithRoom,
  PAYMENT_ARRANGEMENT_CODES,
} from "@/lib/pricing";
import { findOrCreateClient } from "@/lib/client-utils";
import { sendReservationAccepted } from "@/lib/email";
import { smsReservationAccepted, smsManagerReservationProcessed } from "@/lib/sms";
import { logAudit, auditFrom } from "@/lib/audit";
import { generateStayCode } from "@/lib/reference";

const createSchema = z.object({
  reservationId: z.string().uuid("ID de réservation invalide"),
  chambreId: z.string().uuid("ID de chambre invalide"),
  offer: z.enum(OFFER_CODES),
  startAt: z.string().min(1, "Date de début requise"),
  endAt: z.string().optional().nullable(),
  discountType: z.enum(DISCOUNT_CODES).default("none"),
  discountValue: z.coerce.number().min(0).default(0),
  paymentArrangement: z.enum(PAYMENT_ARRANGEMENT_CODES).default("fin_sejour"),
  paymentMethod: z.enum(["especes", "mobile_money", "carte", "virement", "autre"]).default("especes"),
  initialPayment: z.coerce.number().min(0).default(0),
  paymentOperator: z.string().trim().max(80).optional().nullable(),
  payerPhone: z.string().trim().max(30).optional().nullable(),
  paymentReference: z.string().trim().max(120).optional().nullable(),
  paymentPaidAt: z.string().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  customAmount: z.coerce.number().min(0).optional().nullable(),
  dayCount: z.coerce.number().int().min(1).max(365).optional().nullable(),
});

export const GET = withErrorHandler(async () => {
  await requireStaff();

  const items = await prisma.sejour.findMany({
    where: { workflowKind: "web" },
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
  const staff = await requireStaff();
  const body = await req.json();
  const data = validateBody(createSchema, body);

  const reservation = await prisma.reservation.findUnique({
    where: { id: data.reservationId },
    include: { client: true, sejour: true },
  });
  if (!reservation) throw new ApiError(404, "Réservation introuvable.");
  if (reservation.status !== "confirmee") {
    throw new ApiError(409, "La réservation doit être confirmée avant attribution.");
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
        nationality: reservation.nationality ?? null,
        gender: reservation.gender ?? null,
      });

  const chambre = await prisma.chambre.findUnique({ where: { id: data.chambreId } });
  if (!chambre) throw new ApiError(404, "Chambre introuvable.");
  if (chambre.status === "maintenance") throw new ApiError(409, "La chambre est en maintenance.");
  if (chambre.status === "occupee") throw new ApiError(409, "La chambre est déjà occupée.");
  if (!isOfferCompatibleWithRoom(data.offer, { categorie: chambre.categorie, prix: Number(chambre.prix) })) {
    throw new ApiError(409, "Offre incompatible avec la chambre sélectionnée.");
  }

  const startAt = new Date(data.startAt);
  const endAt = data.endAt ? new Date(data.endAt) : null;
  if (Number.isNaN(startAt.getTime())) {
    throw new ApiError(400, "Date de début invalide.");
  }
  if (endAt && Number.isNaN(endAt.getTime())) {
    throw new ApiError(400, "Date de fin invalide.");
  }
  if (chambre.status === "attente_nettoyage" && startAt <= new Date()) {
    throw new ApiError(409, "La chambre attend le ménage et ne peut pas être attribuée pour un démarrage immédiat.");
  }

  const pricing = calculateOfferAmount({
    offer: data.offer,
    startAt,
    endAt,
    customAmount: data.customAmount ?? null,
    roomDailyRate: Number(chambre.prix),
    dayCount: data.dayCount ?? null,
  });

  if (pricing.normalizedEndAt <= pricing.normalizedStartAt) {
    throw new ApiError(400, "La date de fin du séjour doit être postérieure à la date de début.");
  }
  if (!staff.isAdmin && (data.discountType ?? "none") !== "none" && (data.discountValue ?? 0) > 0) {
    throw new ApiError(403, "La remise doit faire l'objet d'une demande validée par un administrateur.");
  }

  const effectiveStartAt = pricing.normalizedStartAt;
  const discountAmount = applyDiscount(pricing.baseAmount, (data.discountType ?? "none"), (data.discountValue ?? 0));
  const netAmount = Math.max(0, pricing.baseAmount - discountAmount);
  const amountPaid = data.initialPayment ?? 0;
  const paymentMethod = data.paymentMethod ?? "especes";
  const now = new Date();
  const requestedAdvanceAmount = Number(reservation.requestedAdvanceAmount ?? 0);
  if (amountPaid > netAmount) {
    throw new ApiError(400, "Le montant encaissé dépasse le total net du séjour.");
  }
  const paymentPaidAt = data.paymentPaidAt ? new Date(data.paymentPaidAt) : now;
  if (Number.isNaN(paymentPaidAt.getTime())) {
    throw new ApiError(400, "Heure de paiement invalide.");
  }
  const requiresPaymentTrace = amountPaid > 0 && paymentMethod !== "especes";
  if (requiresPaymentTrace && (!(data.paymentOperator ?? "").trim() || !(data.payerPhone ?? "").trim() || !(data.paymentReference ?? "").trim())) {
    throw new ApiError(400, "Opérateur, numéro payeur et référence transaction sont requis pour ce paiement.");
  }
  if (requestedAdvanceAmount > 0 && amountPaid < requestedAdvanceAmount) {
    throw new ApiError(409, "L'acompte encaissé est inférieur à l'acompte demandé.");
  }
  if (data.offer === "personnalise" && !(data.notes ?? "").trim()) {
    throw new ApiError(400, "Une justification est requise pour une offre personnalisée.");
  }
  if (data.paymentArrangement === "immediat" && amountPaid < netAmount) {
    throw new ApiError(409, "Le mode 'paiement immédiat' impose un encaissement complet.");
  }
  if (data.paymentArrangement === "avance_partielle" && amountPaid <= 0) {
    throw new ApiError(409, "Un acompte doit être encaissé.");
  }
  const paymentStatus = derivePaymentStatus(netAmount, amountPaid, amountPaid > 0 ? 1 : 0);

  const resolvedClientId = reservation.clientId ?? client?.id ?? reservation.client?.id;
  if (!resolvedClientId) {
    throw new ApiError(409, "Impossible de rattacher cette réservation à un client.");
  }

  const stay = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const overlappingStay = await tx.sejour.findFirst({
      where: {
        chambreId: chambre.id,
        status: { in: ["planifie", "en_cours"] },
        startedAt: { lt: pricing.normalizedEndAt },
        currentEndAt: { gt: effectiveStartAt },
      },
      select: { id: true },
    });

    if (overlappingStay) {
      throw new ApiError(409, "Cette chambre est déjà occupée ou planifiée sur la période sélectionnée.");
    }
    const created = await tx.sejour.create({
      data: {
        code: generateStayCode("web"),
        clientId: resolvedClientId,
        chambreId: chambre.id,
        reservationId: reservation.id,
        source: "web",
        workflowKind: "web",
        status: effectiveStartAt <= now ? "en_cours" : "planifie",
        offer: data.offer,
        guestCount: reservation.guestCount ?? null,
        plannedStartAt: effectiveStartAt,
        plannedEndAt: pricing.normalizedEndAt,
        plannedStartAtOriginal: reservation.dateArriveeOriginal ?? reservation.dateArrivee ?? startAt,
        plannedEndAtOriginal: reservation.dateDepartOriginal ?? reservation.dateDepart ?? pricing.normalizedEndAt,
        startedAt: effectiveStartAt,
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
        checkedInAt: effectiveStartAt <= now ? now : null,
      },
      include: { chambre: { select: { numero: true, type: true } } },
    });

    if (amountPaid > 0) {
      await tx.payment.create({
        data: {
          stayId: created.id,
          paidAt: paymentPaidAt,
          amount: amountPaid,
          method: paymentMethod,
          type: amountPaid >= netAmount ? "solde" : "acompte",
          operator: requiresPaymentTrace ? data.paymentOperator?.trim() : null,
          payerPhone: requiresPaymentTrace ? data.payerPhone?.trim() : null,
          transactionReference: requiresPaymentTrace ? data.paymentReference?.trim() : null,
          notes: "Paiement initial lors de l'attribution.",
        },
      });
    }

    await tx.reservation.update({
      where: { id: reservation.id },
      data: { status: "convertie", clientId: resolvedClientId },
    });

    if (effectiveStartAt <= now && chambre.status !== "maintenance") {
      await tx.chambre.update({
        where: { id: chambre.id },
        data: { status: "occupee" },
      });
    }

    return created;
  }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 10000 });

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

  await logAudit({
    ...auditFrom(staff),
    action: "attribution.create",
    targetType: "sejour",
    targetId: stay.id,
    details: { reservationId: reservation.id, reference: reservation.reference, chambre: stay.chambre.numero },
  });

  return NextResponse.json(stay, { status: 201 });
});

export const DELETE = withErrorHandler(async (req: Request) => {
  const staff = await requireStaff();
  if (!staff.isAdmin) {
    throw new ApiError(403, "Seuls les administrateurs peuvent supprimer une attribution.");
  }

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

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.sejour.delete({ where: { id } });
    if (stay.reservationId) {
      await tx.reservation.update({
        where: { id: stay.reservationId },
        data: { status: "confirmee" },
      });
    }
    await tx.chambre.update({
      where: { id: stay.chambreId },
      data: { status: "disponible" },
    });
  });

  await logAudit({
    ...auditFrom(staff),
    action: "attribution.delete",
    targetType: "sejour",
    targetId: id,
    details: { code: stay.code, reservationId: stay.reservationId },
  });

  return NextResponse.json({ ok: true });
});

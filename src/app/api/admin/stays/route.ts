import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, requireStaff, validateBody, ApiError } from "@/lib/api-utils";
import { findOrCreateClient } from "@/lib/client-utils";
import { applyDiscount, calculateOfferAmount, derivePaymentStatus, offerMatchesRoomCategory } from "@/lib/pricing";
import { buildStayWhere } from "@/lib/stay-filters";

const createSchema = z.object({
  firstName: z.string().trim().min(2).max(50),
  lastName: z.string().trim().min(2).max(50),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().min(8).max(20),
  documentNumber: z.string().trim().min(4).max(30),
  documentType: z.enum(["cni", "passport", "titre_sejour", "autre"]),
  birthDate: z.string().optional().nullable(),
  age: z.coerce.number().int().min(0).optional().nullable(),
  chambreId: z.string().uuid(),
  offer: z.enum(["nuitee", "forfait", "passage", "villa_1ch", "villa_2ch", "longue_duree", "personnalise"]),
  startAt: z.string().min(1),
  endAt: z.string().optional().nullable(),
  customAmount: z.coerce.number().min(0).optional().nullable(),
  discountType: z.enum(["none", "percent", "fixed"]).default("none"),
  discountValue: z.coerce.number().min(0).default(0),
  paymentArrangement: z.enum(["immediat", "avance_partielle", "fin_sejour"]).default("fin_sejour"),
  initialPayment: z.coerce.number().min(0).default(0),
  notes: z.string().trim().max(1000).optional().nullable(),
  behaviorBefore: z.string().trim().max(1000).optional().nullable(),
});

export const GET = withErrorHandler(async (req: Request) => {
  await requireStaff();

  const { searchParams } = new URL(req.url);
  const where = buildStayWhere({
    status: searchParams.get("status"),
    source: searchParams.get("source"),
    paymentStatus: searchParams.get("paymentStatus"),
    dateFrom: searchParams.get("dateFrom"),
    dateTo: searchParams.get("dateTo"),
  });

  const items = await prisma.sejour.findMany({
    where,
    include: {
      client: { include: { sejours: { select: { id: true } } } },
      chambre: true,
      reservation: { select: { reference: true, status: true } },
      extensions: { include: { payments: true }, orderBy: { createdAt: "desc" } },
      payments: { where: { extensionId: null }, orderBy: { paidAt: "desc" } },
      clientNotes: { orderBy: { createdAt: "desc" } },
    },
    orderBy: [{ status: "asc" }, { startedAt: "desc" }],
  });

  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      visitCount: item.client.sejours.length,
    })),
  });
});

export const POST = withErrorHandler(async (req: Request) => {
  await requireStaff();
  const body = await req.json();
  const data = validateBody(createSchema, body);

  const chambre = await prisma.chambre.findUnique({ where: { id: data.chambreId } });
  if (!chambre) throw new ApiError(404, "Chambre introuvable.");
  if (chambre.status === "maintenance") throw new ApiError(409, "La chambre est en maintenance.");
  if (!offerMatchesRoomCategory(data.offer, chambre.categorie)) {
    throw new ApiError(409, "Offre incompatible avec la chambre sélectionnée.");
  }

  const startAt = new Date(data.startAt);
  if (Number.isNaN(startAt.getTime())) {
    throw new ApiError(400, "Date de début invalide.");
  }

  const requestedEndAt = data.endAt ? new Date(data.endAt) : null;
  if (requestedEndAt && Number.isNaN(requestedEndAt.getTime())) {
    throw new ApiError(400, "Date de fin invalide.");
  }

  const pricing = calculateOfferAmount({
    offer: data.offer,
    startAt,
    endAt: requestedEndAt,
    customAmount: data.customAmount ?? null,
    roomDailyRate: Number(chambre.prix),
  });

  if (pricing.normalizedEndAt <= startAt) {
    throw new ApiError(400, "La date de fin du séjour doit être postérieure à la date de début.");
  }

  const overlappingStay = await prisma.sejour.findFirst({
    where: {
      chambreId: data.chambreId,
      status: { in: ["planifie", "en_cours"] },
      startedAt: { lt: pricing.normalizedEndAt },
      currentEndAt: { gt: startAt },
    },
    select: { id: true },
  });
  if (overlappingStay) {
    throw new ApiError(409, "Cette chambre est indisponible sur la période sélectionnée.");
  }

  const client = await findOrCreateClient(prisma, {
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email || null,
    phone: data.phone,
    documentNumber: data.documentNumber,
    documentType: data.documentType,
    birthDate: data.birthDate ? new Date(data.birthDate) : null,
    age: data.age ?? null,
  });

  const discountAmount = applyDiscount(pricing.baseAmount, data.discountType ?? "none", data.discountValue ?? 0);
  const netAmount = Math.max(0, pricing.baseAmount - discountAmount);
  const amountPaid = Math.min(netAmount, data.initialPayment ?? 0);
  const paymentStatus = derivePaymentStatus(netAmount, amountPaid, amountPaid > 0 ? 1 : 0);
  const now = new Date();

  const stay = await prisma.$transaction(async (tx) => {
    const created = await tx.sejour.create({
      data: {
        clientId: client.id,
        chambreId: chambre.id,
        source: "presence",
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
        notes: data.notes ?? null,
        checkedInAt: startAt <= now ? now : null,
      },
      include: {
        client: true,
        chambre: true,
        payments: true,
        extensions: true,
        clientNotes: true,
      },
    });

    if (amountPaid > 0) {
      await tx.payment.create({
        data: {
          stayId: created.id,
          paidAt: now,
          amount: amountPaid,
          method: "especes",
          type: amountPaid >= netAmount ? "solde" : "acompte",
          notes: "Paiement à l'arrivée.",
        },
      });
    }

    if (data.behaviorBefore) {
      await tx.clientNote.create({
        data: {
          clientId: client.id,
          stayId: created.id,
          moment: "avant",
          comment: data.behaviorBefore,
        },
      });
    }

    if (startAt <= now) {
      await tx.chambre.update({ where: { id: chambre.id }, data: { status: "occupee" } });
    }
    return created;
  });

  return NextResponse.json(stay, { status: 201 });
});

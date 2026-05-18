import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, requireStaff, validateBody, ApiError } from "@/lib/api-utils";
import { findOrCreateClient } from "@/lib/client-utils";
import {
  applyDiscount,
  calculateOfferAmount,
  derivePaymentStatus,
  DISCOUNT_CODES,
  getExpectedDepositAmount,
  getImmediateOfferBlockMessage,
  OFFER_CODES,
  isOfferCompatibleWithRoom,
  offerRequiresVillaDeposit,
  PAYMENT_ARRANGEMENT_CODES,
} from "@/lib/pricing";
import { buildStayWhere } from "@/lib/stay-filters";
import { logAudit, auditFrom } from "@/lib/audit";
import { generateStayCode } from "@/lib/reference";
import { isAdultAt } from "@/lib/date-rules";

const fieldChangeSchema = z.object({
  field: z.string().trim().max(80),
  label: z.string().trim().max(120),
  before: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  after: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
});

const createSchema = z.object({
  workflowKind: z.enum(["direct", "comptoir", "appel"]).default("direct"),
  firstName: z.string().trim().min(2).max(50),
  lastName: z.string().trim().min(2).max(50),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().min(8).max(20),
  nationality: z.string().trim().min(2).max(100).optional().or(z.literal("")),
  gender: z.enum(["homme", "femme", "autre"]).optional().nullable(),
  guestCount: z.coerce.number().int().min(1).max(20).optional().nullable(),
  documentNumber: z.string().trim().min(4).max(30).optional().or(z.literal("")),
  documentType: z.enum(["cni", "passport", "titre_sejour", "autre"]).optional().nullable(),
  birthDate: z.string().optional().nullable(),
  chambreId: z.string().uuid(),
  offer: z.enum(OFFER_CODES),
  startAt: z.string().min(1),
  endAt: z.string().optional().nullable(),
  dayCount: z.coerce.number().int().min(1).max(365).optional().nullable(),
  customAmount: z.coerce.number().min(0).optional().nullable(),
  discountType: z.enum(DISCOUNT_CODES).default("none"),
  discountValue: z.coerce.number().min(0).default(0),
  paymentArrangement: z.enum(PAYMENT_ARRANGEMENT_CODES).default("fin_sejour"),
  paymentMethod: z.enum(["especes", "mobile_money", "carte", "virement", "autre"]).default("especes"),
  initialPayment: z.coerce.number().min(0).default(0),
  paymentOperator: z.string().trim().max(80).optional().nullable(),
  payerPhone: z.string().trim().max(30).optional().nullable(),
  paymentReference: z.string().trim().max(120).optional().nullable(),
  paymentPaidAt: z.string().optional().nullable(),
  depositHeldAmount: z.coerce.number().min(0).default(0),
  depositMethod: z.enum(["especes", "mobile_money", "carte", "virement", "autre"]).default("especes"),
  depositNotes: z.string().trim().max(1000).optional().nullable(),
  keyHanded: z.boolean().optional().default(false),
  notes: z.string().trim().max(1000).optional().nullable(),
  behaviorBefore: z.string().trim().max(1000).optional().nullable(),
  fieldChanges: z.array(fieldChangeSchema).max(50).optional().default([]),
});

export const GET = withErrorHandler(async (req: Request) => {
  await requireStaff();

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
  const where = buildStayWhere({
    status: searchParams.get("status"),
    source: searchParams.get("source"),
    paymentStatus: searchParams.get("paymentStatus"),
    dateFrom: searchParams.get("dateFrom"),
    dateTo: searchParams.get("dateTo"),
    query: searchParams.get("query"),
  });

  const [items, total] = await Promise.all([
    prisma.sejour.findMany({
      where,
      include: {
        client: {
          include: {
            sejours: {
              select: {
                id: true,
                code: true,
                offer: true,
                startedAt: true,
                currentEndAt: true,
                chambre: { select: { numero: true } },
              },
              orderBy: { startedAt: "desc" },
              take: 5,
            },
            _count: {
              select: { sejours: true },
            },
          },
        },
        chambre: true,
        reservation: {
          select: {
            id: true,
            reference: true,
            status: true,
            firstName: true,
            lastName: true,
            dateArrivee: true,
            dateDepart: true,
            dateArriveeOriginal: true,
            dateDepartOriginal: true,
            notes: true,
            createdAt: true,
          },
        },
        extensions: { include: { payments: true }, orderBy: { createdAt: "desc" } },
        payments: { where: { extensionId: null }, orderBy: { paidAt: "desc" } },
        clientNotes: { orderBy: { createdAt: "desc" } },
        deposits: { orderBy: { createdAt: "desc" } },
        discountRequests: {
          orderBy: { createdAt: "desc" },
          include: {
            requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
            reviewedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
      orderBy: [{ status: "asc" }, { startedAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.sejour.count({ where }),
  ]);

  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      visitCount: item.client._count.sejours,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

export const POST = withErrorHandler(async (req: Request) => {
  const staff = await requireStaff();
  const body = await req.json();
  const data = validateBody(createSchema, body);

  const workflowKind = data.workflowKind ?? "direct";

  const chambre = await prisma.chambre.findUnique({ where: { id: data.chambreId } });
  if (!chambre) throw new ApiError(404, "Chambre introuvable.");
  if (chambre.status === "maintenance") throw new ApiError(409, "La chambre est en maintenance.");
  if (chambre.status === "occupee") throw new ApiError(409, "La chambre est déjà occupée.");
  if (!isOfferCompatibleWithRoom(data.offer, { categorie: chambre.categorie, prix: Number(chambre.prix) })) {
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
  const birthDate = data.birthDate ? new Date(data.birthDate) : null;
  if (!birthDate) {
    throw new ApiError(400, "Date de naissance requise.");
  }
  if (Number.isNaN(birthDate.getTime())) {
    throw new ApiError(400, "Date de naissance invalide.");
  }

  const directOfferBlock = workflowKind === "direct" ? getImmediateOfferBlockMessage(data.offer, startAt) : null;
  if (directOfferBlock) {
    throw new ApiError(409, directOfferBlock);
  }

  const pricing = calculateOfferAmount({
    offer: data.offer,
    startAt,
    endAt: requestedEndAt,
    customAmount: data.customAmount ?? null,
    roomDailyRate: Number(chambre.prix),
    dayCount: data.dayCount ?? null,
  });
  const effectiveStartAt = pricing.normalizedStartAt;

  if (pricing.normalizedEndAt <= effectiveStartAt) {
    throw new ApiError(400, "La période de séjour calculée n'est pas valide pour cette offre.");
  }
  if (!isAdultAt(birthDate, effectiveStartAt)) {
    throw new ApiError(409, "Le client doit avoir au moins 18 ans.");
  }
  if (chambre.status === "attente_nettoyage" && workflowKind === "direct") {
    throw new ApiError(409, "La chambre attend le ménage et ne peut pas être utilisée pour une prise de chambre directe.");
  }

  const documentNumber = (data.documentNumber ?? "").trim() || null;
  const documentType = documentNumber ? data.documentType ?? "cni" : null;

  const client = await findOrCreateClient(prisma, {
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email || null,
    phone: data.phone,
    nationality: data.nationality || null,
    gender: data.gender ?? null,
    documentNumber,
    documentType,
    birthDate,
  });

  if (!staff.isAdmin && (data.discountType ?? "none") !== "none" && (data.discountValue ?? 0) > 0) {
    throw new ApiError(403, "La remise doit faire l'objet d'une demande validée par un administrateur.");
  }

  const discountAmount = applyDiscount(pricing.baseAmount, data.discountType ?? "none", data.discountValue ?? 0);
  const netAmount = Math.max(0, pricing.baseAmount - discountAmount);
  const amountPaid = data.initialPayment ?? 0;
  if (amountPaid > netAmount) {
    throw new ApiError(400, "Le montant encaissé dépasse le total net du séjour.");
  }
  if (data.offer === "personnalise" && !(data.notes ?? "").trim()) {
    throw new ApiError(400, "Une justification est requise pour une offre personnalisée.");
  }
  if (data.paymentArrangement === "immediat" && amountPaid < netAmount) {
    throw new ApiError(409, "Le mode 'paiement immédiat' impose un encaissement complet.");
  }
  if (data.paymentArrangement === "avance_partielle" && amountPaid <= 0) {
    throw new ApiError(409, "Une avance doit être encaissée pour une avance partielle.");
  }

  if (!offerRequiresVillaDeposit(data.offer) && (data.depositHeldAmount ?? 0) > 0) {
    throw new ApiError(409, "La caution villa ne s'applique qu'aux villas.");
  }

  const expectedDepositAmount = getExpectedDepositAmount(data.offer);
  const depositHeldAmount = offerRequiresVillaDeposit(data.offer) ? Math.max(0, data.depositHeldAmount ?? 0) : 0;
  if (depositHeldAmount > expectedDepositAmount) {
    throw new ApiError(400, "Le montant de caution saisi dépasse la caution prévue.");
  }

  const paymentStatus = derivePaymentStatus(netAmount, amountPaid, amountPaid > 0 ? 1 : 0);
  const now = new Date();
  const paymentPaidAt = data.paymentPaidAt ? new Date(data.paymentPaidAt) : now;
  if (Number.isNaN(paymentPaidAt.getTime())) {
    throw new ApiError(400, "Heure de paiement invalide.");
  }

  const requiresPaymentTrace = amountPaid > 0 && data.paymentMethod !== "especes";
  if (requiresPaymentTrace && (!(data.paymentOperator ?? "").trim() || !(data.payerPhone ?? "").trim() || !(data.paymentReference ?? "").trim())) {
    throw new ApiError(400, "Opérateur, numéro payeur et référence transaction sont requis pour ce paiement.");
  }

  const startsImmediately = workflowKind === "direct" && Boolean(documentNumber) && Boolean(data.keyHanded) && effectiveStartAt <= now;

  const stay = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const overlappingStay = await tx.sejour.findFirst({
      where: {
        chambreId: data.chambreId,
        status: { in: ["planifie", "en_cours"] },
        startedAt: { lt: pricing.normalizedEndAt },
        currentEndAt: { gt: effectiveStartAt },
      },
      select: { id: true },
    });
    if (overlappingStay) {
      throw new ApiError(409, "Cette chambre est indisponible sur la période sélectionnée.");
    }

    const reservation = workflowKind !== "direct"
      ? await tx.reservation.create({
        data: {
          clientId: client.id,
          source: "presence",
          workflowKind,
          firstName: client.firstName,
          lastName: client.lastName,
          email: client.email || data.email || `reservation.${client.id}@chanaude.local`,
          phone: client.phone,
          nationality: client.nationality,
          gender: client.gender,
          guestCount: data.guestCount ?? null,
          dateArrivee: effectiveStartAt,
          dateDepart: pricing.normalizedEndAt,
          offer: data.offer,
          notes: data.notes ?? null,
          requestedAdvanceAmount: amountPaid,
          requestedAdvanceNote: amountPaid > 0 ? "Acompte saisi à la réservation." : null,
          status: "confirmee",
          dateArriveeOriginal: effectiveStartAt,
          dateDepartOriginal: pricing.normalizedEndAt,
        },
      })
      : null;

    const created = await tx.sejour.create({
      data: {
        code: generateStayCode(workflowKind === "direct" ? "direct" : workflowKind),
        clientId: client.id,
        chambreId: chambre.id,
        reservationId: reservation?.id ?? null,
        source: "presence",
        workflowKind,
        status: startsImmediately ? "en_cours" : "planifie",
        offer: data.offer,
        guestCount: data.guestCount ?? null,
        plannedStartAt: effectiveStartAt,
        plannedEndAt: pricing.normalizedEndAt,
        plannedStartAtOriginal: effectiveStartAt,
        plannedEndAtOriginal: pricing.normalizedEndAt,
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
        notes: data.notes ?? null,
        checkedInAt: startsImmediately ? now : null,
      },
      include: {
        client: true,
        chambre: true,
        payments: true,
        extensions: true,
        clientNotes: true,
        deposits: true,
      },
    });

    if (amountPaid > 0) {
      await tx.payment.create({
        data: {
          stayId: created.id,
          paidAt: paymentPaidAt,
          amount: amountPaid,
          method: data.paymentMethod ?? "especes",
          type: amountPaid >= netAmount ? "solde" : "acompte",
          operator: requiresPaymentTrace ? data.paymentOperator?.trim() : null,
          payerPhone: requiresPaymentTrace ? data.payerPhone?.trim() : null,
          transactionReference: requiresPaymentTrace ? data.paymentReference?.trim() : null,
          notes: startsImmediately
            ? "Paiement saisi avant la remise de clé."
            : workflowKind === "direct"
              ? "Paiement saisi avant finalisation du pré-enregistrement."
              : "Acompte de réservation comptoir / appel.",
        },
      });
    }

    if (offerRequiresVillaDeposit(data.offer)) {
      await tx.stayDeposit.create({
        data: {
          stayId: created.id,
          type: "caution_villa",
          status: depositHeldAmount > 0 ? "encaissee" : "en_attente",
          expectedAmount: expectedDepositAmount,
          heldAmount: depositHeldAmount,
          returnedAmount: 0,
          method: depositHeldAmount > 0 ? data.depositMethod ?? "especes" : null,
          notes: data.depositNotes ?? null,
          heldAt: depositHeldAmount > 0 ? now : null,
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

    if (startsImmediately) {
      await tx.chambre.update({ where: { id: chambre.id }, data: { status: "occupee" } });
    }
    return created;
  }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 10000 });

  await logAudit({
    ...auditFrom(staff),
    action: "stay.create",
    targetType: "sejour",
    targetId: stay.id,
    details: {
      code: stay.code,
      source: workflowKind,
      offer: data.offer,
      depositHeldAmount,
      fieldChanges: data.fieldChanges ?? [],
    },
  });

  return NextResponse.json(stay, { status: 201 });
});

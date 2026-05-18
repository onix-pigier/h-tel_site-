import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, requireStaff, ApiError, validateBody } from "@/lib/api-utils";
import {
  applyDiscount,
  calculateOfferAmount,
  DISCOUNT_CODES,
  getExpectedDepositAmount,
  OFFER_CODES,
  isOfferCompatibleWithRoom,
  offerRequiresVillaDeposit,
  PAYMENT_ARRANGEMENT_CODES,
} from "@/lib/pricing";
import { logAudit, auditFrom } from "@/lib/audit";
import { refreshStayPaymentTotals, toNumber } from "@/lib/stay-utils";
import { isAdultAt } from "@/lib/date-rules";

const fieldChangeSchema = z.object({
  field: z.string().trim().max(80),
  label: z.string().trim().max(120),
  before: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  after: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
});

const schema = z.object({
  firstName: z.string().trim().min(2).max(50),
  lastName: z.string().trim().min(2).max(50),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().min(8).max(20),
  nationality: z.string().trim().min(2).max(100),
  gender: z.enum(["homme", "femme", "autre"]).optional().nullable(),
  documentNumber: z.string().trim().min(4).max(30).optional().or(z.literal("")),
  documentType: z.enum(["cni", "passport", "titre_sejour", "autre"]).optional().nullable(),
  birthDate: z.string().optional().nullable(),
  offer: z.enum(OFFER_CODES),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  dayCount: z.coerce.number().int().min(1).max(365).optional().nullable(),
  chambreId: z.string().uuid(),
  customAmount: z.coerce.number().min(0).optional().nullable(),
  discountType: z.enum(DISCOUNT_CODES).default("none"),
  discountValue: z.coerce.number().min(0).default(0),
  paymentArrangement: z.enum(PAYMENT_ARRANGEMENT_CODES).default("fin_sejour"),
  paymentMethod: z.enum(["especes", "mobile_money", "carte", "virement", "autre"]).default("especes"),
  paymentAmount: z.coerce.number().min(0).default(0),
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

export const POST = withErrorHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff();
  const { id } = await params;
  const body = await req.json();
  const data = validateBody(schema, body);

  const stay = await prisma.sejour.findUnique({
    where: { id },
    include: {
      client: true,
      chambre: true,
      reservation: true,
      payments: { where: { extensionId: null }, orderBy: { paidAt: "asc" } },
      deposits: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!stay) throw new ApiError(404, "Séjour introuvable.");
  if (stay.status !== "planifie") {
    throw new ApiError(409, "Seuls les séjours réservés peuvent passer par le tunnel d'arrivée.");
  }

  const startAt = new Date(data.startAt);
  const requestedEndAt = new Date(data.endAt);
  const birthDate = data.birthDate ? new Date(data.birthDate) : null;
  const now = new Date();

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(requestedEndAt.getTime())) {
    throw new ApiError(400, "Dates effectives invalides.");
  }
  if (!birthDate) {
    throw new ApiError(400, "Date de naissance requise.");
  }
  if (Number.isNaN(birthDate.getTime())) {
    throw new ApiError(400, "Date de naissance invalide.");
  }
  if (!isAdultAt(birthDate, startAt)) {
    throw new ApiError(409, "Le client doit avoir au moins 18 ans.");
  }
  if (startAt.getTime() - now.getTime() > 15 * 60 * 1000) {
    throw new ApiError(409, "La date d'arrivée effective ne peut pas être dans le futur au moment de l'arrivée.");
  }

  const documentNumber = (data.documentNumber ?? "").trim() || null;
  const documentType = documentNumber ? data.documentType ?? "cni" : null;
  if (!documentNumber) {
    throw new ApiError(409, "La pièce d'identité est obligatoire avant la remise de clé.");
  }
  if (!data.keyHanded) {
    throw new ApiError(409, "La clé doit être marquée comme remise avant d'activer le séjour.");
  }

  const chambre = await prisma.chambre.findUnique({ where: { id: data.chambreId } });
  if (!chambre) throw new ApiError(404, "Chambre introuvable.");
  if (chambre.status === "maintenance") throw new ApiError(409, "La chambre sélectionnée est en maintenance.");
  if (chambre.status === "attente_nettoyage") {
    throw new ApiError(409, "La chambre sélectionnée attend encore le ménage.");
  }
  if (!isOfferCompatibleWithRoom(data.offer, { categorie: chambre.categorie, prix: Number(chambre.prix) })) {
    throw new ApiError(409, "L'offre choisie ne correspond pas à cette chambre.");
  }
  if (data.offer === "personnalise" && !(data.notes ?? "").trim()) {
    throw new ApiError(400, "Une justification est requise pour une offre personnalisée.");
  }

  const pricing = calculateOfferAmount({
    offer: data.offer,
    startAt,
    endAt: requestedEndAt,
    customAmount: data.customAmount ?? null,
    roomDailyRate: Number(chambre.prix),
    dayCount: data.dayCount ?? null,
  });

  if (pricing.normalizedEndAt <= startAt) {
    throw new ApiError(400, "La période effective calculée n'est pas valide.");
  }

  if (!staff.isAdmin && (data.discountType ?? "none") !== "none" && (data.discountValue ?? 0) > 0) {
    throw new ApiError(403, "La remise doit faire l'objet d'une demande validée par un administrateur.");
  }

  const discountAmount = applyDiscount(pricing.baseAmount, data.discountType ?? "none", data.discountValue ?? 0);
  const netAmount = Math.max(0, pricing.baseAmount - discountAmount);
  const existingPaid = stay.payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  const remainingDue = Math.max(0, netAmount - existingPaid);
  const paymentAmount = data.paymentAmount ?? 0;
  const paymentMethod = data.paymentMethod ?? "especes";
  const paymentPaidAt = data.paymentPaidAt ? new Date(data.paymentPaidAt) : now;
  if (Number.isNaN(paymentPaidAt.getTime())) {
    throw new ApiError(400, "Heure de paiement invalide.");
  }
  const requiresPaymentTrace = paymentAmount > 0 && paymentMethod !== "especes";
  if (requiresPaymentTrace && (!(data.paymentOperator ?? "").trim() || !(data.payerPhone ?? "").trim() || !(data.paymentReference ?? "").trim())) {
    throw new ApiError(400, "Opérateur, numéro payeur et référence transaction sont requis pour ce paiement.");
  }

  if (paymentAmount > remainingDue) {
    throw new ApiError(400, "Le paiement saisi dépasse le reste à encaisser sur le séjour de base.");
  }

  const paidAfterCheckIn = existingPaid + paymentAmount;
  if (data.paymentArrangement === "immediat" && paidAfterCheckIn < netAmount) {
    throw new ApiError(409, "Le mode 'paiement immédiat' impose d'encaisser le solde complet avant l'activation.");
  }
  if (data.paymentArrangement === "avance_partielle" && paidAfterCheckIn <= 0) {
    throw new ApiError(409, "Une avance doit être encaissée avant d'activer ce séjour.");
  }

  if (!offerRequiresVillaDeposit(data.offer) && (data.depositHeldAmount ?? 0) > 0) {
    throw new ApiError(409, "La caution villa ne s'applique qu'aux villas.");
  }

  const expectedDepositAmount = getExpectedDepositAmount(data.offer);
  const depositHeldAmount = offerRequiresVillaDeposit(data.offer) ? Math.max(0, data.depositHeldAmount ?? 0) : 0;
  if (depositHeldAmount > expectedDepositAmount) {
    throw new ApiError(400, "Le montant de caution saisi dépasse la caution prévue.");
  }

  const plannedStartAt = stay.plannedStartAt ?? stay.startedAt;
  const plannedEndAt = stay.plannedEndAt ?? stay.currentEndAt;
  const plannedStartAtOriginal = stay.plannedStartAtOriginal ?? stay.plannedStartAt ?? stay.startedAt;
  const plannedEndAtOriginal = stay.plannedEndAtOriginal ?? stay.plannedEndAt ?? stay.currentEndAt;

  await prisma.$transaction(async (tx) => {
    const overlappingStay = await tx.sejour.findFirst({
      where: {
        chambreId: chambre.id,
        id: { not: stay.id },
        status: { in: ["planifie", "en_cours"] },
        startedAt: { lt: pricing.normalizedEndAt },
        currentEndAt: { gt: startAt },
      },
      select: { id: true },
    });

    if (overlappingStay) {
      throw new ApiError(409, "Cette chambre est déjà occupée ou planifiée sur la période effective sélectionnée.");
    }

    let resolvedClientId = stay.clientId;

    const existingClientByDocument = documentNumber
      ? await tx.client.findFirst({
          where: { documentNumber },
          select: { id: true },
        })
      : null;

    const clientPayload = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email || null,
      phone: data.phone,
      nationality: data.nationality,
      gender: data.gender ?? null,
      documentNumber,
      documentType,
      birthDate,
    };

    if (existingClientByDocument && existingClientByDocument.id !== stay.clientId) {
      resolvedClientId = existingClientByDocument.id;
      await tx.client.update({
        where: { id: resolvedClientId },
        data: clientPayload,
      });
    } else if (stay.client.documentNumber && stay.client.documentNumber !== documentNumber) {
      const createdClient = await tx.client.create({ data: clientPayload });
      resolvedClientId = createdClient.id;
    } else {
      await tx.client.update({
        where: { id: stay.clientId },
        data: clientPayload,
      });
    }

    if (stay.reservationId) {
      await tx.reservation.update({
        where: { id: stay.reservationId },
        data: { status: "convertie" },
      });
    }

    await tx.sejour.update({
      where: { id: stay.id },
      data: {
        clientId: resolvedClientId,
        chambreId: chambre.id,
        status: "en_cours",
        offer: data.offer,
        plannedStartAt,
        plannedEndAt,
        plannedStartAtOriginal,
        plannedEndAtOriginal,
        startedAt: startAt,
        endedAt: pricing.normalizedEndAt,
        currentEndAt: pricing.normalizedEndAt,
        baseAmount: pricing.baseAmount,
        discountType: data.discountType ?? "none",
        discountValue: data.discountValue ?? 0,
        discountAmount,
        netAmount,
        paymentArrangement: data.paymentArrangement,
        notes: (data.notes ?? "").trim() || stay.notes,
        checkedInAt: now,
      },
    });

    if (paymentAmount > 0) {
      await tx.payment.create({
        data: {
          stayId: stay.id,
          paidAt: paymentPaidAt,
          amount: paymentAmount,
          method: paymentMethod,
          type:
            paidAfterCheckIn >= netAmount
              ? "solde"
              : existingPaid > 0
                ? "partiel"
                : "acompte",
          operator: requiresPaymentTrace ? data.paymentOperator?.trim() : null,
          payerPhone: requiresPaymentTrace ? data.payerPhone?.trim() : null,
          transactionReference: requiresPaymentTrace ? data.paymentReference?.trim() : null,
          notes: "Encaissement avant remise de clé.",
        },
      });
    }

    if (offerRequiresVillaDeposit(data.offer)) {
      const existingDeposit = stay.deposits.find((deposit) => deposit.type === "caution_villa") ?? null;
      const depositPayload = {
        status: depositHeldAmount > 0 ? "encaissee" : "en_attente",
        expectedAmount: expectedDepositAmount,
        heldAmount: depositHeldAmount,
        returnedAmount: 0,
        method: depositHeldAmount > 0 ? data.depositMethod ?? "especes" : null,
        notes: data.depositNotes ?? existingDeposit?.notes ?? null,
        heldAt: depositHeldAmount > 0 ? now : existingDeposit?.heldAt ?? null,
        returnedAt: null,
      } as const;

      if (existingDeposit) {
        await tx.stayDeposit.update({
          where: { id: existingDeposit.id },
          data: depositPayload,
        });
      } else {
        await tx.stayDeposit.create({
          data: {
            stayId: stay.id,
            type: "caution_villa",
            ...depositPayload,
          },
        });
      }
    }

    if ((data.behaviorBefore ?? "").trim()) {
      await tx.clientNote.create({
        data: {
          clientId: resolvedClientId,
          stayId: stay.id,
          moment: "avant",
          comment: data.behaviorBefore,
        },
      });
    }

    if (stay.chambreId !== chambre.id && stay.chambre.status !== "maintenance") {
      const otherCurrentStay = await tx.sejour.findFirst({
        where: {
          chambreId: stay.chambreId,
          id: { not: stay.id },
          status: "en_cours",
        },
        select: { id: true },
      });

      await tx.chambre.update({
        where: { id: stay.chambreId },
        data: { status: otherCurrentStay ? "occupee" : "disponible" },
      });
    }

    await tx.chambre.update({
      where: { id: chambre.id },
      data: { status: "occupee" },
    });
  }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 10000 });

  const refreshed = await refreshStayPaymentTotals(prisma, stay.id);

  await logAudit({
    ...auditFrom(staff),
    action: "stay.check_in",
    targetType: "sejour",
    targetId: stay.id,
    details: {
      previousRoomId: stay.chambreId,
      nextRoomId: data.chambreId,
      previousStartAt: stay.startedAt,
      previousEndAt: stay.currentEndAt,
      nextStartAt: startAt,
      nextEndAt: pricing.normalizedEndAt,
      depositHeldAmount,
      fieldChanges: data.fieldChanges ?? [],
    },
  });

  return NextResponse.json(refreshed ?? { ok: true }, { status: 200 });
});

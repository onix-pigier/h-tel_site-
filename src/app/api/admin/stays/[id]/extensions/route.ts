import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, requireStaff, ApiError, validateBody } from "@/lib/api-utils";
import { applyDiscount, calculateOfferAmount, derivePaymentStatus, DISCOUNT_CODES, OFFER_CODES } from "@/lib/pricing";
import { refreshStayPaymentTotals } from "@/lib/stay-utils";
import { logAudit, auditFrom } from "@/lib/audit";

const schema = z.object({
  offer: z.enum(OFFER_CODES),
  startAt: z.string().optional().nullable(),
  endAt: z.string().min(1, "Date de fin requise"),
  customAmount: z.coerce.number().min(0).optional().nullable(),
  discountType: z.enum(DISCOUNT_CODES).default("none"),
  discountValue: z.coerce.number().min(0).default(0),
  initialPayment: z.coerce.number().min(0).default(0),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const POST = withErrorHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff();
  const { id } = await params;
  const body = await req.json();
  const data = validateBody(schema, body);

  const stay = await prisma.sejour.findUnique({ where: { id }, include: { chambre: true } });
  if (!stay) throw new ApiError(404, "Séjour introuvable.");
  if (!["planifie", "en_cours"].includes(stay.status)) {
    throw new ApiError(409, "Seuls les séjours réservés ou en cours peuvent être prolongés.");
  }

  const startAt = data.startAt ? new Date(data.startAt) : new Date(stay.currentEndAt);
  const endAt = new Date(data.endAt);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    throw new ApiError(400, "Dates d'extension invalides.");
  }
  if (endAt <= startAt) throw new ApiError(400, "La fin de l'extension doit être postérieure à son début.");
  if (startAt < stay.currentEndAt) {
    throw new ApiError(409, "L'extension doit commencer à partir de la fin actuelle du séjour.");
  }

  const pricing = calculateOfferAmount({
    offer: data.offer,
    startAt,
    endAt,
    customAmount: data.customAmount ?? null,
    roomDailyRate: Number(stay.chambre.prix),
  });

  const overlappingStay = await prisma.sejour.findFirst({
    where: {
      chambreId: stay.chambreId,
      id: { not: stay.id },
      status: { in: ["planifie", "en_cours"] },
      startedAt: { lt: pricing.normalizedEndAt },
      currentEndAt: { gt: startAt },
    },
    select: { id: true },
  });

  if (overlappingStay) {
    throw new ApiError(409, "Cette extension chevauche un autre séjour planifié ou en cours sur la même chambre.");
  }

  if (!staff.isAdmin && (data.discountType ?? "none") !== "none" && (data.discountValue ?? 0) > 0) {
    throw new ApiError(403, "La remise doit faire l'objet d'une demande validée par un administrateur.");
  }
  if (Number(stay.balanceDue) > 0 && (data.initialPayment ?? 0) > 0) {
    throw new ApiError(409, "Encaisse d'abord le séjour en cours avant de saisir un paiement sur la prolongation.");
  }

  const discountAmount = applyDiscount(pricing.baseAmount, (data.discountType ?? "none"), (data.discountValue ?? 0));
  const netAmount = Math.max(0, pricing.baseAmount - discountAmount);
  const amountPaid = Math.min(netAmount, data.initialPayment ?? 0);

  const extension = await prisma.$transaction(async (tx) => {
    const created = await tx.stayExtension.create({
      data: {
        stayId: stay.id,
        startedAt: startAt,
        endedAt: pricing.normalizedEndAt,
        offer: data.offer,
        baseAmount: pricing.baseAmount,
        discountType: data.discountType ?? "none",
        discountValue: data.discountValue ?? 0,
        discountAmount,
        netAmount,
        amountPaid,
        balanceDue: Math.max(0, netAmount - amountPaid),
        paymentStatus: derivePaymentStatus(netAmount, amountPaid, amountPaid > 0 ? 1 : 0),
        notes: data.notes ?? null,
      },
    });

    await tx.sejour.update({
      where: { id: stay.id },
      data: { currentEndAt: pricing.normalizedEndAt },
    });

    if (amountPaid > 0) {
      await tx.payment.create({
        data: {
          stayId: stay.id,
          extensionId: created.id,
          paidAt: new Date(),
          amount: amountPaid,
          method: "especes",
          type: amountPaid >= netAmount ? "solde" : "acompte",
          notes: "Paiement initial de l'extension.",
        },
      });
    }

    return created;
  });

  const refreshed = await refreshStayPaymentTotals(prisma, stay.id);

  await logAudit({
    ...auditFrom(staff),
    action: "extension.create",
    targetType: "extension",
    targetId: extension.id,
    details: { stayId: stay.id, offer: data.offer },
  });

  return NextResponse.json({ extension, stay: refreshed }, { status: 201 });
});

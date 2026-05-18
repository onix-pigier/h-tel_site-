import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, requireStaff, ApiError, validateBody } from "@/lib/api-utils";
import { applyDiscount, calculateOfferAmount, isOfferCompatibleWithRoom } from "@/lib/pricing";
import { logAudit, auditFrom } from "@/lib/audit";
import { refreshStayPaymentTotals, toNumber } from "@/lib/stay-utils";

const schema = z.object({
  startAt: z.string().min(1, "Date de début requise"),
  endAt: z.string().min(1, "Date de fin requise"),
  chambreId: z.string().uuid().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const PATCH = withErrorHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff();
  const { id } = await params;
  const body = await req.json();
  const data = validateBody(schema, body);

  const stay = await prisma.sejour.findUnique({
    where: { id },
    include: { chambre: true, reservation: true, payments: { where: { extensionId: null } } },
  });
  if (!stay) throw new ApiError(404, "Séjour introuvable.");
  if (stay.status !== "planifie") {
    throw new ApiError(409, "Seuls les séjours réservés peuvent être reportés.");
  }

  const startAt = new Date(data.startAt);
  const endAt = new Date(data.endAt);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    throw new ApiError(400, "Dates de report invalides.");
  }
  if (endAt <= startAt) {
    throw new ApiError(400, "La date de fin doit être postérieure à la date de début.");
  }
  if (startAt.getTime() === stay.startedAt.getTime() && endAt.getTime() === stay.currentEndAt.getTime()) {
    throw new ApiError(400, "Aucune modification de date détectée. Un report implique une nouvelle date de séjour.");
  }
  if (startAt <= stay.startedAt) {
    throw new ApiError(409, "Un report doit déplacer l'arrivée vers une date ultérieure.");
  }
  const now = new Date();
  if (startAt < now) {
    throw new ApiError(409, "La nouvelle arrivée ne peut pas être antérieure à maintenant.");
  }

  const nextRoomId = data.chambreId ?? stay.chambreId;
  const chambre = await prisma.chambre.findUnique({ where: { id: nextRoomId } });
  if (!chambre) throw new ApiError(404, "Chambre introuvable.");
  if (chambre.status === "maintenance") {
    throw new ApiError(409, "La chambre sélectionnée est en maintenance.");
  }
  if (chambre.status === "attente_nettoyage" && startAt <= new Date()) {
    throw new ApiError(409, "La chambre sélectionnée n'est pas encore prête pour un démarrage immédiat.");
  }
  if (!isOfferCompatibleWithRoom(stay.offer, { categorie: chambre.categorie, prix: Number(chambre.prix) })) {
    throw new ApiError(409, "L'offre du séjour ne correspond pas à cette chambre.");
  }

  const pricing = calculateOfferAmount({
    offer: stay.offer,
    startAt,
    endAt,
    customAmount: stay.offer === "personnalise" ? toNumber(stay.baseAmount) : null,
    roomDailyRate: Number(chambre.prix),
  });
  const effectiveStartAt = pricing.normalizedStartAt;

  const overlappingStay = await prisma.sejour.findFirst({
    where: {
      id: { not: stay.id },
      chambreId: chambre.id,
      status: { in: ["planifie", "en_cours"] },
      startedAt: { lt: pricing.normalizedEndAt },
      currentEndAt: { gt: effectiveStartAt },
    },
    select: { id: true },
  });

  if (overlappingStay) {
    throw new ApiError(409, "Cette chambre n'est pas disponible sur la nouvelle période choisie.");
  }

  const discountValue = toNumber(stay.discountValue);
  const discountAmount = applyDiscount(pricing.baseAmount, stay.discountType, discountValue);
  const netAmount = Math.max(0, pricing.baseAmount - discountAmount);
  const previousPlannedStartAt = stay.plannedStartAt ?? stay.startedAt;
  const previousPlannedEndAt = stay.plannedEndAt ?? stay.currentEndAt;
  const plannedStartAtOriginal = stay.plannedStartAtOriginal ?? previousPlannedStartAt;
  const plannedEndAtOriginal = stay.plannedEndAtOriginal ?? previousPlannedEndAt;

  await prisma.$transaction(async (tx) => {
    await tx.sejour.update({
      where: { id: stay.id },
      data: {
        chambreId: chambre.id,
        plannedStartAt: effectiveStartAt,
        plannedEndAt: pricing.normalizedEndAt,
        plannedStartAtOriginal,
        plannedEndAtOriginal,
        startedAt: effectiveStartAt,
        endedAt: pricing.normalizedEndAt,
        currentEndAt: pricing.normalizedEndAt,
        baseAmount: pricing.baseAmount,
        discountAmount,
        netAmount,
        notes: data.notes ?? stay.notes,
      },
    });

    if (stay.reservationId) {
      await tx.reservation.update({
        where: { id: stay.reservationId },
        data: {
          reportedAt: now,
          dateArriveeOriginal: stay.reservation?.dateArriveeOriginal ?? stay.reservation?.dateArrivee ?? null,
          dateDepartOriginal: stay.reservation?.dateDepartOriginal ?? stay.reservation?.dateDepart ?? null,
          dateArrivee: effectiveStartAt,
          dateDepart: pricing.normalizedEndAt,
        },
      });
    }
  });

  const refreshed = await refreshStayPaymentTotals(prisma, stay.id);

  await logAudit({
    ...auditFrom(staff),
    action: "stay.report",
    targetType: "sejour",
    targetId: stay.id,
    details: {
      previousRoomId: stay.chambreId,
      nextRoomId: chambre.id,
      previousStartAt: stay.startedAt,
      previousEndAt: stay.currentEndAt,
      nextStartAt: effectiveStartAt,
      nextEndAt: pricing.normalizedEndAt,
    },
  });

  return NextResponse.json(refreshed, { status: 200 });
});

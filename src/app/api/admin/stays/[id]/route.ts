import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, requireStaff, ApiError, validateBody } from "@/lib/api-utils";
import { logAudit, auditFrom } from "@/lib/audit";

const patchSchema = z.object({
  status: z.enum(["planifie", "en_cours", "termine", "annule"]).optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
  behaviorAfter: z.string().trim().max(1000).optional().nullable(),
  depositDecision: z.enum(["restituee", "conservee"]).optional().nullable(),
  depositReturnedAmount: z.coerce.number().min(0).optional().nullable(),
  depositNotes: z.string().trim().max(1000).optional().nullable(),
  absenceConfirmed: z.boolean().optional(),
});

const allowedTransitions: Record<string, string[]> = {
  planifie: ["en_cours", "annule"],
  en_cours: ["termine", "annule"],
  termine: [],
  annule: [],
};

export const PATCH = withErrorHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff();
  const { id } = await params;
  const body = await req.json();
  const data = validateBody(patchSchema, body);

  const stay = await prisma.sejour.findUnique({
    where: { id },
    include: { client: true, deposits: { orderBy: { createdAt: "desc" } } },
  });
  if (!stay) throw new ApiError(404, "Séjour introuvable.");

  const nextStatus = data.status ?? stay.status;
  const now = new Date();

  if (nextStatus !== stay.status) {
    const allowed = allowedTransitions[stay.status] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw new ApiError(409, `Transition interdite: ${stay.status} -> ${nextStatus}`);
    }
  }

  if (nextStatus === "termine" && stay.paymentStatus !== "solde") {
    throw new ApiError(409, "Impossible de clôturer un séjour tant que le séjour n'est pas soldé.");
  }

  if (nextStatus === "annule" && data.absenceConfirmed && stay.status === "planifie" && stay.startedAt > now) {
    throw new ApiError(409, "L'absence ne peut être confirmée qu'après l'heure d'arrivée prévue.");
  }

  const activeVillaDeposit = stay.deposits.find((deposit) => deposit.type === "caution_villa") ?? null;
  const requiresDepositResolution = nextStatus === "termine" && activeVillaDeposit?.status === "encaissee" && Number(activeVillaDeposit.heldAmount) > 0;

  if (requiresDepositResolution && !data.depositDecision) {
    throw new ApiError(409, "La caution villa doit être restituée ou conservée avant la clôture.");
  }

  const depositReturnedAmount = data.depositReturnedAmount ?? Number(activeVillaDeposit?.heldAmount ?? 0);
  if (requiresDepositResolution && data.depositDecision === "restituee" && depositReturnedAmount > Number(activeVillaDeposit?.heldAmount ?? 0)) {
    throw new ApiError(400, "Le montant restitué ne peut pas dépasser la caution encaissée.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const item = await tx.sejour.update({
      where: { id },
      data: {
        status: nextStatus,
        notes: data.notes ?? stay.notes,
        checkedInAt: nextStatus === "en_cours" && !stay.checkedInAt ? now : stay.checkedInAt,
        checkedOutAt: nextStatus === "termine" ? now : stay.checkedOutAt,
      },
    });

    if (data.behaviorAfter) {
      await tx.clientNote.create({
        data: {
          clientId: stay.clientId,
          stayId: stay.id,
          moment: "apres",
          comment: data.behaviorAfter,
        },
      });
    }

    if (requiresDepositResolution && activeVillaDeposit) {
      await tx.stayDeposit.update({
        where: { id: activeVillaDeposit.id },
        data: {
          status: data.depositDecision ?? activeVillaDeposit.status,
          returnedAmount: data.depositDecision === "restituee" ? depositReturnedAmount : 0,
          notes: data.depositNotes ?? activeVillaDeposit.notes,
          returnedAt: now,
        },
      });
    }

    if (nextStatus === "en_cours") {
      await tx.chambre.update({ where: { id: stay.chambreId }, data: { status: "occupee" } });
    }

    if (["termine", "annule"].includes(nextStatus)) {
      if (nextStatus === "annule" && stay.status === "planifie" && stay.reservationId) {
        await tx.reservation.update({
          where: { id: stay.reservationId },
          data: {
            status: "annulee",
            notes: data.notes ?? stay.notes ?? "Réservation annulée depuis le registre.",
          },
        });
      }

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
        data: {
          status:
            otherCurrentStay
              ? "occupee"
              : nextStatus === "termine"
                ? "attente_nettoyage"
                : "disponible",
        },
      });
    }

    return item;
  });

  await logAudit({
    ...auditFrom(staff),
    action: `stay.${nextStatus}`,
    targetType: "sejour",
    targetId: id,
    details: {
      previousStatus: stay.status,
      newStatus: nextStatus,
      depositDecision: data.depositDecision ?? null,
      depositReturnedAmount: data.depositDecision === "restituee" ? depositReturnedAmount : null,
    },
  });

  return NextResponse.json(updated);
});

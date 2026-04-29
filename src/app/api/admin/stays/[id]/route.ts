import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, requireStaff, ApiError, validateBody } from "@/lib/api-utils";

const patchSchema = z.object({
  status: z.enum(["planifie", "en_cours", "termine", "annule"]).optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
  behaviorAfter: z.string().trim().max(1000).optional().nullable(),
});

const allowedTransitions: Record<string, string[]> = {
  planifie: ["en_cours", "annule"],
  en_cours: ["termine", "annule"],
  termine: [],
  annule: [],
};

export const PATCH = withErrorHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireStaff();
  const { id } = await params;
  const body = await req.json();
  const data = validateBody(patchSchema, body);

  const stay = await prisma.sejour.findUnique({ where: { id }, include: { client: true } });
  if (!stay) throw new ApiError(404, "Séjour introuvable.");

  const nextStatus = data.status ?? stay.status;
  const now = new Date();

  if (nextStatus !== stay.status) {
    const allowed = allowedTransitions[stay.status] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw new ApiError(409, `Transition interdite: ${stay.status} -> ${nextStatus}`);
    }
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

    if (nextStatus === "en_cours") {
      await tx.chambre.update({ where: { id: stay.chambreId }, data: { status: "occupee" } });
    }

    if (["termine", "annule"].includes(nextStatus)) {
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

    return item;
  });

  return NextResponse.json(updated);
});

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, requireStaff, ApiError, validateBody } from "@/lib/api-utils";
import { DISCOUNT_CODES } from "@/lib/pricing";
import { logAudit, auditFrom } from "@/lib/audit";

const schema = z.object({
  discountType: z.enum(DISCOUNT_CODES).refine((value) => value !== "none", "Choisis un type de remise."),
  discountValue: z.coerce.number().positive("La valeur de remise doit être positive."),
  reason: z.string().trim().min(6).max(1000),
});

export const POST = withErrorHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff();
  if (staff.isAdmin) {
    throw new ApiError(409, "Un administrateur traite directement la remise au lieu de créer une demande.");
  }

  const { id } = await params;
  const body = await req.json();
  const data = validateBody(schema, body);

  const stay = await prisma.sejour.findUnique({
    where: { id },
    include: {
      discountRequests: { where: { status: "en_attente" }, select: { id: true } },
    },
  });

  if (!stay) throw new ApiError(404, "Séjour introuvable.");
  if (["termine", "annule"].includes(stay.status)) {
    throw new ApiError(409, "La remise ne peut plus être demandée sur un séjour clôturé.");
  }
  if (stay.paymentStatus === "solde") {
    throw new ApiError(409, "Le séjour est déjà soldé. La remise ne peut plus être demandée.");
  }
  if (stay.discountRequests.length > 0) {
    throw new ApiError(409, "Une demande de remise est déjà en attente pour ce séjour.");
  }

  const created = await prisma.discountRequest.create({
    data: {
      stayId: stay.id,
      requestedById: staff.id,
      discountType: data.discountType,
      discountValue: data.discountValue,
      reason: data.reason,
    },
    include: {
      requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      stay: { select: { id: true, code: true } },
    },
  });

  await logAudit({
    ...auditFrom(staff),
    action: "discount_request.create",
    targetType: "discount_request",
    targetId: created.id,
    details: {
      stayId: stay.id,
      stayCode: stay.code,
      discountType: data.discountType,
      discountValue: data.discountValue,
    },
  });

  return NextResponse.json(created, { status: 201 });
});

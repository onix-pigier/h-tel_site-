import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, requireStaff, ApiError, validateBody } from "@/lib/api-utils";
import { applyDiscount, derivePaymentStatus, DISCOUNT_CODES } from "@/lib/pricing";
import { logAudit, auditFrom } from "@/lib/audit";
import { refreshStayPaymentTotals, toNumber } from "@/lib/stay-utils";

const schema = z.object({
  decision: z.enum(["approuvee", "refusee"]),
  approvedDiscountType: z.enum(DISCOUNT_CODES).optional(),
  approvedDiscountValue: z.coerce.number().min(0).optional(),
  reviewNote: z.string().trim().max(1000).optional().nullable(),
});

export const PATCH = withErrorHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff();
  if (!staff.isAdmin) {
    throw new ApiError(403, "Seuls les administrateurs peuvent traiter une demande de remise.");
  }

  const { id } = await params;
  const body = await req.json();
  const data = validateBody(schema, body);

  const request = await prisma.discountRequest.findUnique({
    where: { id },
    include: {
      stay: {
        include: {
          payments: true,
          extensions: { include: { payments: true } },
        },
      },
      requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  if (!request) throw new ApiError(404, "Demande de remise introuvable.");
  if (request.status !== "en_attente") {
    throw new ApiError(409, "Cette demande a déjà été traitée.");
  }

  const reviewNote = (data.reviewNote ?? "").trim() || null;

  if (data.decision === "refusee") {
    const updated = await prisma.discountRequest.update({
      where: { id: request.id },
      data: {
        status: "refusee",
        reviewedById: staff.id,
        reviewedAt: new Date(),
        reviewNote,
      },
    });

    await logAudit({
      ...auditFrom(staff),
      action: "discount_request.refuse",
      targetType: "discount_request",
      targetId: request.id,
      details: {
        stayId: request.stayId,
        stayCode: request.stay.code,
        requestedBy: request.requestedBy.email,
      },
    });

    return NextResponse.json(updated);
  }

  if (["termine", "annule"].includes(request.stay.status) || request.stay.paymentStatus === "solde") {
    throw new ApiError(409, "La remise ne peut plus être appliquée sur ce séjour.");
  }

  const approvedDiscountType = (data.approvedDiscountType ?? request.discountType) as "none" | "percent" | "fixed";
  const approvedDiscountValue = data.approvedDiscountValue ?? toNumber(request.discountValue);
  if (approvedDiscountType === "none" || approvedDiscountValue <= 0) {
    throw new ApiError(400, "La remise approuvée doit être positive.");
  }

  await prisma.$transaction(async (tx) => {
    const baseAmount = toNumber(request.stay.baseAmount);
    const basePayments = request.stay.payments.filter((payment) => !payment.extensionId);
    const baseAmountPaid = basePayments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);
    const allPayments = [...request.stay.payments, ...request.stay.extensions.flatMap((extension) => extension.payments)];
    const globalPaid = allPayments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);
    const extensionNet = request.stay.extensions.reduce((sum, extension) => sum + toNumber(extension.netAmount), 0);
    const discountAmount = applyDiscount(baseAmount, approvedDiscountType, approvedDiscountValue);
    const nextNetAmount = Math.max(0, baseAmount - discountAmount);
    const globalNet = nextNetAmount + extensionNet;

    await tx.sejour.update({
      where: { id: request.stayId },
      data: {
        discountType: approvedDiscountType,
        discountValue: approvedDiscountValue,
        discountAmount,
        netAmount: nextNetAmount,
        amountPaid: baseAmountPaid,
        balanceDue: Math.max(0, nextNetAmount - baseAmountPaid),
        paymentStatus: derivePaymentStatus(globalNet, globalPaid, allPayments.length),
      },
    });

    await tx.discountRequest.update({
      where: { id: request.id },
      data: {
        status: "approuvee",
        reviewedById: staff.id,
        reviewedAt: new Date(),
        reviewNote,
        approvedDiscountType,
        approvedDiscountValue,
      },
    });
  });

  const refreshedStay = await refreshStayPaymentTotals(prisma, request.stayId);
  const refreshedRequest = await prisma.discountRequest.findUnique({
    where: { id: request.id },
    include: {
      requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      reviewedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  await logAudit({
    ...auditFrom(staff),
    action: "discount_request.approve",
    targetType: "discount_request",
    targetId: request.id,
    details: {
      stayId: request.stayId,
      stayCode: request.stay.code,
      approvedDiscountType,
      approvedDiscountValue,
    },
  });

  return NextResponse.json({ request: refreshedRequest, stay: refreshedStay });
});

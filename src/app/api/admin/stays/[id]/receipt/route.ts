import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, requireStaff, ApiError } from "@/lib/api-utils";
import { generateReceiptHTML } from "@/lib/receipt-template";
import { toNumber } from "@/lib/stay-utils";
import { logAudit, auditFrom } from "@/lib/audit";

export const GET = withErrorHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff();
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const paymentId = searchParams.get("paymentId");

  const stay = await prisma.sejour.findUnique({
    where: { id },
    include: {
      client: true,
      chambre: true,
      reservation: { select: { reference: true } },
      payments: { where: { extensionId: null }, orderBy: { paidAt: "asc" } },
      extensions: { include: { payments: { orderBy: { paidAt: "asc" } } }, orderBy: { startedAt: "asc" } },
    },
  });

  if (!stay) throw new ApiError(404, "Séjour introuvable.");

  // Flatten all payments
  const allPayments = [
    ...stay.payments.map((p) => ({ ...p, amount: toNumber(p.amount), scopeLabel: "Séjour de base" })),
    ...stay.extensions.flatMap((ext) =>
      ext.payments.map((p) => ({
        ...p,
        amount: toNumber(p.amount),
        scopeLabel: `Extension`,
      }))
    ),
  ].sort((a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime());

  let receiptPayment = null;
  let cumulativePaid: number | undefined;
  let balanceAfter: number | undefined;
  let type: "final" | "acompte" = "final";

  if (paymentId) {
    const paymentIndex = allPayments.findIndex((p) => p.id === paymentId);
    if (paymentIndex === -1) throw new ApiError(404, "Paiement introuvable.");
    receiptPayment = allPayments[paymentIndex];
    cumulativePaid = allPayments.slice(0, paymentIndex + 1).reduce((sum, p) => sum + toNumber(p.amount), 0);
    const totalNet = toNumber(stay.netAmount) + stay.extensions.reduce((s, e) => s + toNumber(e.netAmount), 0);
    balanceAfter = Math.max(0, totalNet - cumulativePaid);
    type = "acompte";
  }

  const stayData = {
    id: stay.id,
    code: stay.code,
    source: stay.source,
    offer: stay.offer,
    startedAt: stay.startedAt.toISOString(),
    endedAt: stay.endedAt.toISOString(),
    currentEndAt: stay.currentEndAt.toISOString(),
    netAmount: toNumber(stay.netAmount),
    amountPaid: toNumber(stay.amountPaid),
    balanceDue: toNumber(stay.balanceDue),
    paymentStatus: stay.paymentStatus,
    client: {
      firstName: stay.client.firstName,
      lastName: stay.client.lastName,
      phone: stay.client.phone,
      email: stay.client.email,
      documentNumber: stay.client.documentNumber,
      documentType: stay.client.documentType,
    },
    chambre: {
      numero: stay.chambre.numero,
      type: stay.chambre.type,
      prix: toNumber(stay.chambre.prix),
    },
    reservation: stay.reservation,
    payments: allPayments.map((p) => ({
      id: p.id,
      amount: toNumber(p.amount),
      paidAt: new Date(p.paidAt).toISOString(),
      method: p.method,
      type: p.type,
      notes: p.notes ?? null,
      scopeLabel: p.scopeLabel,
    })),
    extensions: stay.extensions.map((ext) => ({
      id: ext.id,
      startedAt: ext.startedAt.toISOString(),
      endedAt: ext.endedAt.toISOString(),
      offer: ext.offer,
      netAmount: toNumber(ext.netAmount),
      amountPaid: toNumber(ext.amountPaid),
      balanceDue: toNumber(ext.balanceDue),
      payments: ext.payments.map((p) => ({
        id: p.id,
        amount: toNumber(p.amount),
        paidAt: p.paidAt.toISOString(),
        method: p.method,
        type: p.type,
        notes: p.notes ?? null,
      })),
    })),
  };

  const staffName = staff.name ?? "Système";
  const html = generateReceiptHTML({
    stay: stayData,
    type,
    payment: receiptPayment ? {
      id: receiptPayment.id,
      amount: toNumber(receiptPayment.amount),
      paidAt: new Date(receiptPayment.paidAt).toISOString(),
      method: receiptPayment.method,
      type: receiptPayment.type,
      notes: receiptPayment.notes ?? null,
    } : null,
    cumulativePaid,
    balanceAfter,
    handledBy: staffName,
  });

  // Audit the invoice print
  await logAudit({
    ...auditFrom(staff),
    action: paymentId ? "invoice.print.acompte" : "invoice.print.final",
    targetType: "sejour",
    targetId: id,
    details: { paymentId: paymentId ?? null },
  });

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
});

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, requireStaff, ApiError, validateBody } from "@/lib/api-utils";
import { refreshStayPaymentTotals, toNumber } from "@/lib/stay-utils";
import { logAudit, auditFrom } from "@/lib/audit";

const schema = z.object({
  amount: z.coerce.number().positive("Montant invalide"),
  paidAt: z.string().optional().nullable(),
  method: z.enum(["especes", "mobile_money", "carte", "virement", "autre"]),
  type: z.enum(["acompte", "partiel", "solde"]),
  paymentOperator: z.string().trim().max(80).optional().nullable(),
  payerPhone: z.string().trim().max(30).optional().nullable(),
  paymentReference: z.string().trim().max(120).optional().nullable(),
  extensionId: z.string().uuid().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const POST = withErrorHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff();
  const { id } = await params;
  const body = await req.json();
  const data = validateBody(schema, body);

  const stay = await prisma.sejour.findUnique({
    where: { id },
    include: { extensions: { include: { payments: true } }, payments: { where: { extensionId: null } } },
  });
  if (!stay) throw new ApiError(404, "Séjour introuvable.");

  // ── Lifecycle guards ──
  if (["termine", "annule"].includes(stay.status)) {
    throw new ApiError(409, "Impossible d'encaisser sur un séjour clôturé ou annulé.");
  }

  // ── Overpayment guard ──
  const stayPaid = stay.payments.reduce((s: number, p: { amount: unknown }) => s + toNumber(p.amount), 0);
  const stayBalance = Math.max(0, toNumber(stay.netAmount) - stayPaid);
  const extBalance = stay.extensions.reduce((s: number, ext: { netAmount: unknown; payments: { amount: unknown }[] }) => {
    const extPaid = ext.payments.reduce((sp: number, p: { amount: unknown }) => sp + toNumber(p.amount), 0);
    return s + Math.max(0, toNumber(ext.netAmount) - extPaid);
  }, 0);
  const totalBalance = stayBalance + extBalance;

  if (totalBalance <= 0) {
    throw new ApiError(409, "Ce séjour est déjà intégralement soldé.");
  }
  let targetBalance = stayBalance;
  let selectedExtension: (typeof stay.extensions)[number] | null = null;

  if (data.extensionId) {
    selectedExtension = stay.extensions.find((extension) => extension.id === data.extensionId) ?? null;
    if (!selectedExtension) {
      throw new ApiError(404, "Extension introuvable pour ce séjour.");
    }
    if (stayBalance > 0) {
      throw new ApiError(409, "Règle d'abord le séjour de base avant d'encaisser la prolongation.");
    }
    const extensionPaid = selectedExtension.payments.reduce((sum: number, payment: { amount: unknown }) => sum + toNumber(payment.amount), 0);
    targetBalance = Math.max(0, toNumber(selectedExtension.netAmount) - extensionPaid);
  } else if (stayBalance <= 0 && extBalance > 0) {
    throw new ApiError(409, "Séjour de base soldé. Sélectionne la prolongation à encaisser.");
  }

  if (targetBalance <= 0) {
    throw new ApiError(409, "Ce poste est déjà soldé.");
  }
  if (data.amount > targetBalance) {
    throw new ApiError(400, `Le montant (${data.amount}) dépasse le solde ciblé (${targetBalance}).`);
  }

  const paidAt = data.paidAt ? new Date(data.paidAt) : new Date();
  if (Number.isNaN(paidAt.getTime())) {
    throw new ApiError(400, "Heure de paiement invalide.");
  }

  const requiresPaymentTrace = data.method !== "especes";
  if (requiresPaymentTrace && (!(data.paymentOperator ?? "").trim() || !(data.payerPhone ?? "").trim() || !(data.paymentReference ?? "").trim())) {
    throw new ApiError(400, "Opérateur, numéro payeur et référence transaction sont requis pour ce paiement.");
  }

  await prisma.payment.create({
    data: {
      stayId: id,
      extensionId: data.extensionId ?? null,
      amount: data.amount,
      paidAt,
      method: data.method,
      type: data.type,
      operator: requiresPaymentTrace ? data.paymentOperator?.trim() : null,
      payerPhone: requiresPaymentTrace ? data.payerPhone?.trim() : null,
      transactionReference: requiresPaymentTrace ? data.paymentReference?.trim() : null,
      notes: data.notes ?? null,
    },
  });

  const refreshed = await refreshStayPaymentTotals(prisma, id);

  await logAudit({
    ...auditFrom(staff),
    action: "payment.create",
    targetType: "payment",
    targetId: id,
    details: { amount: data.amount, method: data.method, type: data.type, reference: requiresPaymentTrace ? data.paymentReference : null },
  });

  return NextResponse.json(refreshed, { status: 201 });
});

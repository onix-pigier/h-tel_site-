import { PrismaClient } from "@/generated/prisma/client";
import { derivePaymentStatus } from "@/lib/pricing";

export function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object" && "toString" in value) {
    return Number(String(value));
  }
  return 0;
}

export async function refreshStayPaymentTotals(prisma: PrismaClient, stayId: string) {
  const [stay, allPayments, extensions] = await Promise.all([
    prisma.sejour.findUnique({ where: { id: stayId } }),
    prisma.payment.findMany({ where: { stayId } }),
    prisma.stayExtension.findMany({ where: { stayId }, include: { payments: true } }),
  ]);

  if (!stay) return null;

  // ── Per-scope: base stay payments ──
  const basePayments = allPayments.filter((p: { extensionId: string | null }) => !p.extensionId);
  const baseAmountPaid = basePayments.reduce((sum: number, p: { amount: unknown }) => sum + toNumber(p.amount), 0);
  const baseNet = toNumber(stay.netAmount);

  // ── Per-scope: extension payments ──
  for (const extension of extensions) {
    const extensionPaid = extension.payments.reduce((sum: number, p: { amount: unknown }) => sum + toNumber(p.amount), 0);
    const extensionNet = toNumber(extension.netAmount);
    await prisma.stayExtension.update({
      where: { id: extension.id },
      data: {
        amountPaid: extensionPaid,
        balanceDue: Math.max(0, extensionNet - extensionPaid),
        paymentStatus: derivePaymentStatus(extensionNet, extensionPaid, extension.payments.length),
      },
    });
  }

  // ── Global: stay totals include extensions ──
  const globalNet = baseNet + extensions.reduce((sum: number, ext: { netAmount: unknown }) => sum + toNumber(ext.netAmount), 0);
  const globalPaid = allPayments.reduce((sum: number, p: { amount: unknown }) => sum + toNumber(p.amount), 0);

  await prisma.sejour.update({
    where: { id: stayId },
    data: {
      amountPaid: baseAmountPaid,
      balanceDue: Math.max(0, baseNet - baseAmountPaid),
      paymentStatus: derivePaymentStatus(globalNet, globalPaid, allPayments.length),
    },
  });

  return prisma.sejour.findUnique({
    where: { id: stayId },
    include: {
      client: true,
      chambre: true,
      reservation: true,
      extensions: { include: { payments: true } },
      payments: { orderBy: { paidAt: "desc" } },
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
  });
}

export function overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && startB < endA;
}

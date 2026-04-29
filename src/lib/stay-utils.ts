import { PrismaClient } from "@prisma/client";
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
  const [stay, payments, extensions] = await Promise.all([
    prisma.sejour.findUnique({ where: { id: stayId } }),
    prisma.payment.findMany({ where: { stayId, extensionId: null } }),
    prisma.stayExtension.findMany({ where: { stayId }, include: { payments: true } }),
  ]);

  if (!stay) return null;

  const amountPaid = payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  const netAmount = toNumber(stay.netAmount);
  const balanceDue = Math.max(0, netAmount - amountPaid);

  await prisma.sejour.update({
    where: { id: stayId },
    data: {
      amountPaid,
      balanceDue,
      paymentStatus: derivePaymentStatus(netAmount, amountPaid, payments.length),
    },
  });

  for (const extension of extensions) {
    const extensionPaid = extension.payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);
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

  return prisma.sejour.findUnique({
    where: { id: stayId },
    include: {
      client: true,
      chambre: true,
      reservation: true,
      extensions: true,
      payments: { orderBy: { paidAt: "desc" } },
      clientNotes: { orderBy: { createdAt: "desc" } },
    },
  });
}

export function overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && startB < endA;
}

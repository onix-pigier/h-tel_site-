import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, requireStaff, ApiError, validateBody } from "@/lib/api-utils";
import { refreshStayPaymentTotals } from "@/lib/stay-utils";

const schema = z.object({
  amount: z.coerce.number().positive("Montant invalide"),
  paidAt: z.string().optional().nullable(),
  method: z.enum(["especes", "mobile_money", "carte", "virement", "autre"]),
  type: z.enum(["acompte", "partiel", "solde"]),
  extensionId: z.string().uuid().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const POST = withErrorHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireStaff();
  const { id } = await params;
  const body = await req.json();
  const data = validateBody(schema, body);

  const stay = await prisma.sejour.findUnique({ where: { id } });
  if (!stay) throw new ApiError(404, "Séjour introuvable.");

  if (data.extensionId) {
    const extension = await prisma.stayExtension.findUnique({ where: { id: data.extensionId } });
    if (!extension || extension.stayId !== id) {
      throw new ApiError(404, "Extension introuvable pour ce séjour.");
    }
  }

  await prisma.payment.create({
    data: {
      stayId: id,
      extensionId: data.extensionId ?? null,
      amount: data.amount,
      paidAt: data.paidAt ? new Date(data.paidAt) : new Date(),
      method: data.method,
      type: data.type,
      notes: data.notes ?? null,
    },
  });

  const refreshed = await refreshStayPaymentTotals(prisma, id);
  return NextResponse.json(refreshed, { status: 201 });
});

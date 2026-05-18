import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, requireStaff, ApiError } from "@/lib/api-utils";

const querySchema = z.object({
  status: z.enum(["en_attente", "approuvee", "refusee", "annulee"]).optional(),
});

export const GET = withErrorHandler(async (req: Request) => {
  await requireStaff();
  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({ status: searchParams.get("status") ?? undefined });
  if (!parsed.success) {
    throw new ApiError(400, "Filtre de demandes invalide.");
  }

  const items = await prisma.discountRequest.findMany({
    where: parsed.data.status ? { status: parsed.data.status } : undefined,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      stay: {
        select: {
          id: true,
          code: true,
          status: true,
          paymentStatus: true,
          client: { select: { firstName: true, lastName: true } },
        },
      },
      requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      reviewedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  return NextResponse.json({ items });
});

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, requireStaff, ApiError } from "@/lib/api-utils";

export const GET = withErrorHandler(async (req: Request) => {
  await requireStaff();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    throw new ApiError(400, "Au moins 2 caractères sont requis pour la recherche client.");
  }

  const items = await prisma.client.findMany({
    where: {
      OR: [
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { phone: { contains: q } },
        { email: { contains: q } },
        { documentNumber: { contains: q } },
      ],
    },
    include: {
      sejours: {
        include: {
          chambre: { select: { numero: true } },
        },
        orderBy: { startedAt: "desc" },
        take: 5,
      },
    },
    take: 10,
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      visitCount: item.sejours.length,
    })),
  });
});

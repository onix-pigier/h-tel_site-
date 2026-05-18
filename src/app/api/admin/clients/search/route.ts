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
        { nationality: { contains: q } },
        { documentNumber: { contains: q } },
      ],
    },
    include: {
      sejours: {
        select: {
          id: true,
          code: true,
          source: true,
          workflowKind: true,
          status: true,
          offer: true,
          startedAt: true,
          currentEndAt: true,
          checkedInAt: true,
          chambre: { select: { numero: true } },
        },
        orderBy: { startedAt: "desc" },
        take: 8,
      },
      notes: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          moment: true,
          comment: true,
          createdAt: true,
        },
      },
      _count: {
        select: { sejours: true },
      },
    },
    take: 10,
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      clientNotes: item.notes,
      visitCount: item._count.sejours,
    })),
  });
});

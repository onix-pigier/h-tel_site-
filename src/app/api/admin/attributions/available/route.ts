import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, requireStaff } from "@/lib/api-utils";

export const GET = withErrorHandler(async () => {
  await requireStaff();

  const [reservations, chambres] = await Promise.all([
    prisma.reservation.findMany({
      where: { status: "acceptee", attribution: null },
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
    prisma.chambre.findMany({
      where: { status: "disponible" },
      select: { id: true, numero: true, type: true },
    }),
  ]);

  return NextResponse.json({ reservations, chambres });
});

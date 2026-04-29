import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, requireStaff, ApiError } from "@/lib/api-utils";
import { getDefaultEndAt, offerMatchesRoomCategory } from "@/lib/pricing";

const querySchema = z.object({
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  offer: z.enum(["nuitee", "forfait", "passage", "villa_1ch", "villa_2ch", "longue_duree", "personnalise"]).optional(),
});

export const GET = withErrorHandler(async (req: Request) => {
  await requireStaff();

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    startAt: searchParams.get("startAt") || undefined,
    endAt: searchParams.get("endAt") || undefined,
    offer: searchParams.get("offer") || undefined,
  });

  if (!parsed.success) {
    throw new ApiError(400, "Paramètres de disponibilité invalides.");
  }

  const startAt = parsed.data.startAt ? new Date(parsed.data.startAt) : new Date();
  const endAt = parsed.data.endAt
    ? new Date(parsed.data.endAt)
    : getDefaultEndAt(parsed.data.offer ?? "nuitee", startAt);

  const [reservations, rooms] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        status: { in: ["validee", "acceptee"] },
        sejour: null,
      },
      select: {
        id: true,
        reference: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        dateArrivee: true,
        dateDepart: true,
        offer: true,
        client: { select: { id: true, sejours: { select: { id: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.chambre.findMany({
      where: {
        status: { not: "maintenance" },
        sejours: {
          none: {
            status: { in: ["planifie", "en_cours"] },
            startedAt: { lt: endAt },
            currentEndAt: { gt: startAt },
          },
        },
      },
      select: {
        id: true,
        numero: true,
        type: true,
        categorie: true,
        prix: true,
        capacite: true,
      },
      orderBy: { numero: "asc" },
    }),
  ]);

  const chambres = parsed.data.offer
    ? rooms.filter((room) => offerMatchesRoomCategory(parsed.data.offer!, room.categorie))
    : rooms;

  return NextResponse.json({
    reservations: reservations.map((reservation) => ({
      ...reservation,
      reference: reservation.reference ?? reservation.id.slice(0, 8),
      visitCount: reservation.client?.sejours.length ?? 0,
    })),
    chambres,
  });
});

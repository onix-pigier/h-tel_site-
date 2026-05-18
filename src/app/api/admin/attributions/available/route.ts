import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, requireStaff, ApiError } from "@/lib/api-utils";
import { calculateOfferAmount, isOfferCompatibleWithRoom, OFFER_CODES } from "@/lib/pricing";

const querySchema = z.object({
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  stayDays: z.coerce.number().int().min(1).max(365).optional(),
  offer: z.enum(OFFER_CODES).optional(),
  excludeStayId: z.string().uuid().optional(),
});

export const GET = withErrorHandler(async (req: Request) => {
  await requireStaff();

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    startAt: searchParams.get("startAt") || undefined,
    endAt: searchParams.get("endAt") || undefined,
    stayDays: searchParams.get("stayDays") || undefined,
    offer: searchParams.get("offer") || undefined,
    excludeStayId: searchParams.get("excludeStayId") || undefined,
  });

  if (!parsed.success) {
    throw new ApiError(400, "Paramètres de disponibilité invalides.");
  }

  const requestedStartAt = parsed.data.startAt ? new Date(parsed.data.startAt) : new Date();
  const requestedEndAt = parsed.data.endAt ? new Date(parsed.data.endAt) : null;
  if (Number.isNaN(requestedStartAt.getTime()) || (requestedEndAt && Number.isNaN(requestedEndAt.getTime()))) {
    throw new ApiError(400, "Dates de disponibilité invalides.");
  }
  const selectedOffer = parsed.data.offer;
  const pricing = calculateOfferAmount({
    offer: selectedOffer ?? "nuitee",
    startAt: requestedStartAt,
    endAt: requestedEndAt,
    dayCount: parsed.data.stayDays ?? 1,
  });
  const startAt = pricing.normalizedStartAt;
  const endAt = pricing.normalizedEndAt;

  const [reservations, allRooms] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        status: "confirmee",
        sejour: null,
      },
      select: {
        id: true,
        reference: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        nationality: true,
        gender: true,
        guestCount: true,
        dateArrivee: true,
        dateDepart: true,
        offer: true,
        requestedAdvanceAmount: true,
        requestedAdvanceNote: true,
        client: { select: { id: true, sejours: { select: { id: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.chambre.findMany({
      where: {
        status: { not: "maintenance" },
      },
      select: {
        id: true,
        numero: true,
        type: true,
        status: true,
        categorie: true,
        prix: true,
        capacite: true,
        sejours: {
          where: {
            status: { in: ["planifie", "en_cours"] },
            id: parsed.data.excludeStayId ? { not: parsed.data.excludeStayId } : undefined,
            startedAt: { lt: endAt },
            currentEndAt: { gt: startAt },
          },
          select: { id: true },
        },
      },
      orderBy: { numero: "asc" },
    }),
  ]);

  const requiresCleanRoomNow = startAt <= new Date();
  const chambres = allRooms
    .map((room) => {
      const isOccupied = room.sejours.length > 0;
      const needsCleaningNow = room.status === "attente_nettoyage" && requiresCleanRoomNow;
      const isCompatible = selectedOffer ? isOfferCompatibleWithRoom(selectedOffer, { categorie: room.categorie, prix: Number(room.prix) }) : true;
      const isAvailable = !isOccupied && !needsCleaningNow && room.status !== "occupee" && isCompatible;

      return {
        id: room.id,
        numero: room.numero,
        type: room.type,
        status: room.status,
        categorie: room.categorie,
        prix: room.prix,
        capacite: room.capacite,
        available: isAvailable,
      };
    });

  return NextResponse.json({
    reservations: reservations.map((reservation) => ({
      ...reservation,
      reference: reservation.reference ?? reservation.id.slice(0, 8),
      visitCount: reservation.client?.sejours.length ?? 0,
      requestedAdvanceAmount: reservation.requestedAdvanceAmount ? Number(reservation.requestedAdvanceAmount) : 0,
      requestedAdvanceNote: reservation.requestedAdvanceNote ?? null,
    })),
    chambres,
  });
});

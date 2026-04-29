import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, requireStaff, ApiError } from "@/lib/api-utils";
import { sendReservationRefused } from "@/lib/email";
import { smsReservationRefused, smsManagerReservationProcessed } from "@/lib/sms";

const allowedTransitions: Record<string, string[]> = {
  en_attente: ["validee", "refusee", "annulee"],
  validee: ["convertie", "refusee", "annulee"],
  convertie: [],
  acceptee: ["convertie", "refusee"],
  refusee: [],
  annulee: [],
};

export const GET = withErrorHandler(async (req: Request) => {
  await requireStaff();

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const status = searchParams.get("status");

  const where = status && status !== "all" ? { status: status as any } : {};

  const [items, total] = await Promise.all([
    prisma.reservation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        client: {
          select: {
            id: true,
            documentNumber: true,
            documentType: true,
            sejours: { select: { id: true } },
          },
        },
        sejour: {
          select: {
            id: true,
            code: true,
            status: true,
            chambre: { select: { numero: true, type: true } },
          },
        },
      },
    }),
    prisma.reservation.count({ where }),
  ]);

  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      reference: item.reference ?? item.id.slice(0, 8),
      visitCount: item.client?.sejours.length ?? 0,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

const patchSchema = z.object({
  id: z.string().uuid("ID invalide"),
  status: z.enum(["en_attente", "validee", "convertie", "refusee", "annulee"]),
});

export const PATCH = withErrorHandler(async (req: Request) => {
  await requireStaff();

  const body = await req.json();
  const { id, status } = patchSchema.parse(body);

  const current = await prisma.reservation.findUnique({
    where: { id },
    include: { sejour: true },
  });

  if (!current) {
    throw new ApiError(404, "Réservation introuvable.");
  }

  const allowed = allowedTransitions[current.status] ?? [];
  if (!allowed.includes(status)) {
    throw new ApiError(409, `Transition interdite: ${current.status} -> ${status}`);
  }

  if (current.sejour && status !== "convertie") {
    throw new ApiError(409, "Cette réservation est déjà convertie en séjour.");
  }

  const reservation = await prisma.reservation.update({
    where: { id },
    data: { status },
    include: {
      client: true,
      sejour: {
        include: { chambre: { select: { numero: true, type: true } } },
      },
    },
  });

  if (status === "refusee") {
    sendReservationRefused(reservation.email, reservation.firstName, reservation.lastName).catch((error) =>
      console.error("Email refused failed:", error)
    );
    smsReservationRefused(reservation.phone, reservation.firstName).catch((error) =>
      console.error("SMS refused failed:", error)
    );
    smsManagerReservationProcessed(reservation.firstName, reservation.lastName, "refusée").catch((error) =>
      console.error("SMS manager failed:", error)
    );
  }

  return NextResponse.json(reservation);
});

export const DELETE = withErrorHandler(async (req: Request) => {
  await requireStaff();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) throw new ApiError(400, "Paramètre 'id' manquant.");

  const reservation = await prisma.reservation.findUnique({ where: { id }, include: { sejour: true } });
  if (!reservation) throw new ApiError(404, "Réservation introuvable.");
  if (reservation.sejour) {
    throw new ApiError(409, "Impossible de supprimer une réservation déjà convertie en séjour.");
  }

  await prisma.reservation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});

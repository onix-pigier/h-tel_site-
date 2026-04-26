import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, requireStaff, validateBody, ApiError } from "@/lib/api-utils";
import { sendReservationAccepted } from "@/lib/email";
import { smsReservationAccepted } from "@/lib/sms";

// ─── Schema ──────────────────────────────────────────────────

const createSchema = z.object({
  reservationId: z.string().uuid("ID de réservation invalide"),
  chambreId: z.string().uuid("ID de chambre invalide"),
});

// ─── GET: List all attributions ──────────────────────────────

export const GET = withErrorHandler(async () => {
  await requireStaff();

  const items = await prisma.attribution.findMany({
    include: {
      reservation: { select: { firstName: true, lastName: true, email: true, phone: true } },
      chambre: { select: { numero: true, type: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ items });
});

// ─── POST: Assign room ──────────────────────────────────────

export const POST = withErrorHandler(async (req: Request) => {
  await requireStaff();
  const body = await req.json();
  const { reservationId, chambreId } = validateBody(createSchema, body);

  // Create attribution + mark room as occupied in a transaction
  const [attribution] = await prisma.$transaction([
    prisma.attribution.create({ data: { reservationId, chambreId, checkIn: new Date() } }),
    prisma.chambre.update({ where: { id: chambreId }, data: { status: "occupee" } }),
  ]);

  // Fetch details for notification
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: { firstName: true, lastName: true, email: true, phone: true },
  });

  const chambre = await prisma.chambre.findUnique({
    where: { id: chambreId },
    select: { numero: true, type: true },
  });

  // Send acceptance email + SMS with room details (non-blocking)
  if (reservation && chambre) {
    sendReservationAccepted(
      reservation.email,
      reservation.firstName,
      reservation.lastName,
      chambre
    ).catch((e) => console.error("Email attribution failed:", e));

    smsReservationAccepted(
      reservation.phone,
      reservation.firstName,
      chambre.numero
    ).catch((e) => console.error("SMS attribution failed:", e));
  }

  return NextResponse.json(attribution, { status: 201 });
});

// ─── DELETE ──────────────────────────────────────────────────

export const DELETE = withErrorHandler(async (req: Request) => {
  await requireStaff();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const chambreId = searchParams.get("chambreId");
  if (!id) throw new ApiError(400, "Paramètre 'id' manquant.");

  await prisma.attribution.delete({ where: { id } });

  // Free the room
  if (chambreId) {
    await prisma.chambre.update({
      where: { id: chambreId },
      data: { status: "disponible" },
    });
  }

  return NextResponse.json({ ok: true });
});

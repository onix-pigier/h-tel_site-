import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, requireStaff, ApiError } from "@/lib/api-utils";
import { sendReservationAccepted, sendReservationRefused } from "@/lib/email";
import {
  smsReservationAccepted,
  smsReservationRefused,
  smsManagerReservationProcessed,
} from "@/lib/sms";

// ─── GET: Paginated list ─────────────────────────────────────

export const GET = withErrorHandler(async (req: Request) => {
  await requireStaff();

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const status = searchParams.get("status");

  const where = status && status !== "all" ? { status: status as any } : {};

  const [items, total] = await Promise.all([
    prisma.reservation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.reservation.count({ where }),
  ]);

  return NextResponse.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
});

// ─── PATCH: Update status (accept / refuse) ──────────────────

const patchSchema = z.object({
  id: z.string().uuid("ID invalide"),
  status: z.enum(["en_attente", "acceptee", "refusee"], {
    errorMap: () => ({ message: "Statut invalide (en_attente, acceptee, refusee)" }),
  }),
});

export const PATCH = withErrorHandler(async (req: Request) => {
  await requireStaff();

  const body = await req.json();
  const { id, status } = patchSchema.parse(body);

  const reservation = await prisma.reservation.update({
    where: { id },
    data: { status },
    include: {
      attribution: {
        include: { chambre: { select: { numero: true, type: true } } },
      },
    },
  });

  // ─── Send notifications based on status change ───────
  if (status === "acceptee") {
    const chambreInfo = reservation.attribution?.chambre ?? null;

    sendReservationAccepted(
      reservation.email,
      reservation.firstName,
      reservation.lastName,
      chambreInfo
    ).catch((e) => console.error("Email accepted failed:", e));

    smsReservationAccepted(
      reservation.phone,
      reservation.firstName,
      chambreInfo?.numero
    ).catch((e) => console.error("SMS accepted failed:", e));

    smsManagerReservationProcessed(
      reservation.firstName,
      reservation.lastName,
      "acceptée"
    ).catch((e) => console.error("SMS manager failed:", e));
  }

  if (status === "refusee") {
    sendReservationRefused(
      reservation.email,
      reservation.firstName,
      reservation.lastName
    ).catch((e) => console.error("Email refused failed:", e));

    smsReservationRefused(
      reservation.phone,
      reservation.firstName
    ).catch((e) => console.error("SMS refused failed:", e));

    smsManagerReservationProcessed(
      reservation.firstName,
      reservation.lastName,
      "refusée"
    ).catch((e) => console.error("SMS manager failed:", e));
  }

  return NextResponse.json(reservation);
});

// ─── DELETE ──────────────────────────────────────────────────

export const DELETE = withErrorHandler(async (req: Request) => {
  await requireStaff();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) throw new ApiError(400, "Paramètre 'id' manquant.");

  await prisma.reservation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});

import { NextResponse } from "next/server";
import { Prisma, ReservationStatus } from "@/generated/prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, requireStaff, ApiError } from "@/lib/api-utils";
import { sendReservationRefused } from "@/lib/email";
import { smsReservationRefused, smsManagerReservationProcessed } from "@/lib/sms";
import { logAudit, auditFrom } from "@/lib/audit";

const RESERVATION_STATUS_CODES = [
  "en_attente",
  "confirmee",
  "convertie",
  "refusee",
  "annulee",
  "reportee",
] as const;

const PATCHABLE_RESERVATION_STATUS_CODES = [
  "en_attente",
  "confirmee",
  "convertie",
  "refusee",
  "annulee",
  "reportee",
] as const;

const allowedTransitions: Record<ReservationStatus, ReservationStatus[]> = {
  en_attente: ["confirmee", "refusee", "annulee"],
  confirmee: ["convertie", "refusee", "annulee", "reportee"],
  convertie: [],
  refusee: [],
  annulee: [],
  reportee: ["confirmee", "annulee"],
};

export const GET = withErrorHandler(async (req: Request) => {
  await requireStaff();

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const status = searchParams.get("status");
  const channel = searchParams.get("channel");
  const normalizedStatus =
    status && status !== "all" && RESERVATION_STATUS_CODES.includes(status as ReservationStatus)
      ? (status as ReservationStatus)
      : null;
  const normalizedChannel = channel && ["web", "comptoir", "appel"].includes(channel) ? channel : null;

  const where: Prisma.ReservationWhereInput = {
    ...(normalizedStatus ? { status: normalizedStatus } : {}),
    ...(normalizedChannel ? { workflowKind: normalizedChannel as "web" | "comptoir" | "appel" } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.reservation.findMany({
      where,
      orderBy: [{ dateArrivee: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        client: {
          select: {
            id: true,
            nationality: true,
            gender: true,
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
            netAmount: true,
            amountPaid: true,
            balanceDue: true,
            paymentStatus: true,
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
      requestedAdvanceAmount: item.requestedAdvanceAmount ? Number(item.requestedAdvanceAmount) : null,
      requestedAdvanceNote: item.requestedAdvanceNote ?? null,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

const patchSchema = z.object({
  id: z.string().uuid("ID invalide"),
  status: z.enum(PATCHABLE_RESERVATION_STATUS_CODES),
  dateArrivee: z.string().optional().nullable(),
  dateDepart: z.string().optional().nullable(),
  requestedAdvanceAmount: z.coerce.number().min(0).optional().nullable(),
  requestedAdvanceNote: z.string().trim().max(1000).optional().nullable(),
});

export const PATCH = withErrorHandler(async (req: Request) => {
  const staff = await requireStaff();

  const body = await req.json();
  const hasRequestedAdvanceAmount = Object.prototype.hasOwnProperty.call(body, "requestedAdvanceAmount");
  const { id, status, dateArrivee, dateDepart, requestedAdvanceAmount, requestedAdvanceNote } = patchSchema.parse(body);

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

  if (status === "confirmee" && (!hasRequestedAdvanceAmount || requestedAdvanceAmount === null || typeof requestedAdvanceAmount !== "number")) {
    throw new ApiError(400, "Indique l'acompte demandé avant de confirmer la réservation. Mets 0 si aucun acompte n'est demandé.");
  }

  // Handle report: save original dates and update with new ones
  const updateData: Record<string, unknown> = { status };
  if (typeof requestedAdvanceAmount === "number") {
    updateData.requestedAdvanceAmount = requestedAdvanceAmount;
  }
  if (typeof requestedAdvanceNote === "string") {
    updateData.requestedAdvanceNote = requestedAdvanceNote || null;
  }

  if (status === "reportee") {
    updateData.reportedAt = new Date();
    updateData.dateArriveeOriginal = current.dateArriveeOriginal ?? current.dateArrivee;
    updateData.dateDepartOriginal = current.dateDepartOriginal ?? current.dateDepart;
    if (dateArrivee) updateData.dateArrivee = new Date(dateArrivee);
    if (dateDepart) updateData.dateDepart = new Date(dateDepart);
  }

  const reservation = await prisma.reservation.update({
    where: { id },
    data: updateData,
    include: {
      client: true,
      sejour: {
        include: { chambre: { select: { numero: true, type: true } } },
      },
    },
  });

  // Audit log
  await logAudit({
    ...auditFrom(staff),
    action: `reservation.${status}`,
    targetType: "reservation",
    targetId: id,
    details: {
      previousStatus: current.status,
      newStatus: status,
      requestedAdvanceAmount: typeof requestedAdvanceAmount === "number" ? requestedAdvanceAmount : Number(current.requestedAdvanceAmount ?? 0),
      requestedAdvanceNote: typeof requestedAdvanceNote === "string" ? requestedAdvanceNote || null : current.requestedAdvanceNote ?? null,
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
  const staff = await requireStaff();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) throw new ApiError(400, "Paramètre 'id' manquant.");

  // UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) throw new ApiError(400, "Format d'ID invalide.");

  const reservation = await prisma.reservation.findUnique({ where: { id }, include: { sejour: true } });
  if (!reservation) throw new ApiError(404, "Réservation introuvable.");
  if (reservation.sejour) {
    throw new ApiError(409, "Impossible de supprimer une réservation déjà convertie en séjour.");
  }

  await prisma.reservation.delete({ where: { id } });

  await logAudit({
    ...auditFrom(staff),
    action: "reservation.delete",
    targetType: "reservation",
    targetId: id,
    details: { reference: reservation.reference },
  });

  return NextResponse.json({ ok: true });
});

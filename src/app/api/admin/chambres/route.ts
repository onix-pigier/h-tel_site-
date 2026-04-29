import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, requireStaff, validateBody, ApiError } from "@/lib/api-utils";

const createSchema = z.object({
  numero: z.string().trim().min(1, "Numéro requis").max(20),
  type: z.string().trim().min(1, "Type requis").max(50),
  categorie: z.enum(["standard", "villa_1ch", "villa_2ch"]).default("standard"),
  prix: z.coerce.number().min(0, "Prix doit être >= 0").default(0),
  capacite: z.coerce.number().int().min(1, "Capacité min 1").default(1),
  description: z.string().trim().max(500).optional().nullable(),
  status: z.enum(["disponible", "occupee", "maintenance"]).default("disponible"),
});

const updateSchema = z.object({
  id: z.string().uuid("ID invalide"),
  numero: z.string().trim().min(1).max(20).optional(),
  type: z.string().trim().min(1).max(50).optional(),
  categorie: z.enum(["standard", "villa_1ch", "villa_2ch"]).optional(),
  prix: z.coerce.number().min(0).optional(),
  capacite: z.coerce.number().int().min(1).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  status: z.enum(["disponible", "occupee", "maintenance"]).optional(),
});

export const GET = withErrorHandler(async (req: Request) => {
  await requireStaff();

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

  const [items, total] = await Promise.all([
    prisma.chambre.findMany({
      orderBy: { numero: "asc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        sejours: {
          where: { status: { in: ["planifie", "en_cours"] } },
          select: { id: true, code: true, currentEndAt: true, paymentStatus: true },
        },
      },
    }),
    prisma.chambre.count(),
  ]);

  return NextResponse.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
});

export const POST = withErrorHandler(async (req: Request) => {
  await requireStaff();
  const body = await req.json();
  const data = validateBody(createSchema, body);

  const chambre = await prisma.chambre.create({ data });
  return NextResponse.json(chambre, { status: 201 });
});

export const PATCH = withErrorHandler(async (req: Request) => {
  await requireStaff();
  const body = await req.json();
  const { id, ...data } = validateBody(updateSchema, body);

  const updated = await prisma.chambre.update({ where: { id }, data });
  return NextResponse.json(updated);
});

export const DELETE = withErrorHandler(async (req: Request) => {
  await requireStaff();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) throw new ApiError(400, "Paramètre 'id' manquant.");

  const activeStay = await prisma.sejour.findFirst({
    where: { chambreId: id, status: { in: ["planifie", "en_cours"] } },
    select: { id: true },
  });

  if (activeStay) {
    throw new ApiError(409, "Impossible de supprimer une chambre liée à un séjour actif ou planifié.");
  }

  await prisma.chambre.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});

import { NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";
import { Prisma } from "@prisma/client";

// ─── Custom API Error ────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Error Response Builder ──────────────────────────────────

function errorResponse(status: number, message: string, details?: unknown) {
  const body: Record<string, unknown> = { error: message };
  if (details) body.details = details;
  return NextResponse.json(body, { status });
}

// ─── Route Handler Wrapper ───────────────────────────────────

type RouteHandler = (req: Request) => Promise<NextResponse>;

export function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (req: Request) => {
    try {
      return await handler(req);
    } catch (error) {
      // Known API errors
      if (error instanceof ApiError) {
        return errorResponse(error.statusCode, error.message, error.details);
      }

      // Zod validation errors
      if (error instanceof ZodError) {
        return errorResponse(400, "Données invalides", error.flatten().fieldErrors);
      }

      // Prisma errors
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        console.error(`[PRISMA ${error.code}]`, error.message);

        if (error.code === "P2002") {
          const target = (error.meta?.target as string[])?.join(", ") ?? "champ";
          return errorResponse(409, `Une entrée avec ce ${target} existe déjà.`);
        }
        if (error.code === "P2025") {
          return errorResponse(404, "Ressource introuvable.");
        }
        if (error.code === "P2003") {
          return errorResponse(409, "Impossible de supprimer : cette ressource est liée à d'autres données.");
        }

        return errorResponse(500, "Erreur de base de données.");
      }

      if (error instanceof Prisma.PrismaClientValidationError) {
        console.error("[PRISMA VALIDATION]", error.message);
        return errorResponse(400, "Données invalides pour la base de données.");
      }

      // Unexpected errors
      console.error("[UNHANDLED ERROR]", error);
      return errorResponse(500, "Une erreur interne est survenue. Veuillez réessayer.");
    }
  };
}

// ─── Validation Helper ───────────────────────────────────────

export function validateBody<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ApiError(400, "Données invalides", result.error.flatten().fieldErrors);
  }
  return result.data;
}

// ─── Auth Check Helper ───────────────────────────────────────

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function requireStaff() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.isStaff) {
    throw new ApiError(401, "Accès non autorisé. Connexion requise.");
  }
  return user;
}

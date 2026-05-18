import { NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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

type RouteHandler<TContext = unknown> = (req: Request, context: TContext) => Promise<NextResponse>;

export function withErrorHandler<TContext = unknown>(
  handler: RouteHandler<TContext>
): RouteHandler<TContext> {
  return async (req: Request, context: TContext) => {
    try {
      return await handler(req, context);
    } catch (err: unknown) {
      // Known API errors
      if (err instanceof ApiError) {
        return errorResponse(err.statusCode, err.message, err.details);
      }

      // Zod validation errors
      if (err instanceof ZodError) {
        return errorResponse(400, "Données invalides", err.flatten().fieldErrors);
      }

      // Prisma errors — use duck typing to avoid import issues
      if (err instanceof Error && err.constructor?.name === "PrismaClientKnownRequestError") {
        const prismaErr = err as Error & { code: string; meta?: Record<string, unknown> };
        console.error(`[PRISMA ${prismaErr.code}]`, prismaErr.message);

        if (prismaErr.code === "P2002") {
          const target = (prismaErr.meta?.target as string[])?.join(", ") ?? "champ";
          return errorResponse(409, `Une entrée avec ce ${target} existe déjà.`);
        }
        if (prismaErr.code === "P2025") {
          return errorResponse(404, "Ressource introuvable.");
        }
        if (prismaErr.code === "P2003") {
          return errorResponse(409, "Impossible de supprimer : cette ressource est liée à d'autres données.");
        }

        return errorResponse(500, "Erreur de base de données.");
      }

      if (err instanceof Error && err.constructor?.name === "PrismaClientValidationError") {
        console.error("[PRISMA VALIDATION]", err.message);
        return errorResponse(400, "Données invalides pour la base de données.");
      }

      // Unexpected errors
      console.error("[UNHANDLED ERROR]", err);
      return errorResponse(500, "Une erreur interne est survenue. Veuillez réessayer.");
    }
  };
}

// ─── Validation Helper ───────────────────────────────────────

export function validateBody<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    // Return issues[] format with path + message for inline field errors
    const details = result.error.issues.map((issue) => ({
      path: issue.path,
      message: issue.message,
    }));
    throw new ApiError(400, "Données invalides", details);
  }
  return result.data;
}

// ─── Auth Check Helper ───────────────────────────────────────

export async function requireStaff() {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user?.isStaff) {
    throw new ApiError(401, "Accès non autorisé. Connexion requise.");
  }
  return user;
}

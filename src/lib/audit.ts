import { prisma } from "@/lib/prisma";

interface AuditInput {
  userId: string;
  userName: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: Record<string, unknown> | null;
}

/**
 * Log an audit event for tracking who did what, when.
 * Non-blocking — errors are caught and logged, never thrown.
 */
export async function logAudit(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        userName: input.userName,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        details: input.details ? JSON.stringify(input.details) : null,
      },
    });
  } catch (error) {
    console.error("[AUDIT LOG ERROR]", error);
  }
}

/**
 * Helper to build audit input from the requireStaff() user object.
 */
export function auditFrom(user: { id: string; name?: string | null }) {
  return {
    userId: user.id,
    userName: user.name ?? "Inconnu",
  };
}

export async function getSystemAuditActor() {
  const adminRole = await prisma.userRole.findFirst({
    where: { role: "admin" },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  if (adminRole) {
    return {
      userId: adminRole.user.id,
      userName: `${adminRole.user.firstName ?? ""} ${adminRole.user.lastName ?? ""}`.trim() || adminRole.user.email,
    };
  }

  const staffRole = await prisma.userRole.findFirst({
    where: { role: "gerant" },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  if (staffRole) {
    return {
      userId: staffRole.user.id,
      userName: `${staffRole.user.firstName ?? ""} ${staffRole.user.lastName ?? ""}`.trim() || staffRole.user.email,
    };
  }

  return null;
}

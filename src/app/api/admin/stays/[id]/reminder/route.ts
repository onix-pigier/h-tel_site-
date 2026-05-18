import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, requireStaff, ApiError, validateBody } from "@/lib/api-utils";
import { logAudit, auditFrom } from "@/lib/audit";

const schema = z.object({
  channel: z.enum(["whatsapp", "email", "phone"]),
});

export const POST = withErrorHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff();
  const { id } = await params;
  const body = await req.json();
  const data = validateBody(schema, body);

  const stay = await prisma.sejour.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      client: { select: { firstName: true, lastName: true, phone: true, email: true } },
    },
  });

  if (!stay) throw new ApiError(404, "Séjour introuvable.");
  if (stay.status !== "planifie") {
    throw new ApiError(409, "Les rappels ne concernent que les séjours réservés.");
  }

  await logAudit({
    ...auditFrom(staff),
    action: "stay.reminder",
    targetType: "sejour",
    targetId: stay.id,
    details: {
      channel: data.channel,
      client: `${stay.client.firstName} ${stay.client.lastName}`,
    },
  });

  return NextResponse.json({ ok: true });
});

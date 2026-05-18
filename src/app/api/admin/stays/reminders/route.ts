import { NextResponse } from "next/server";
import { ApiError, withErrorHandler, requireStaff } from "@/lib/api-utils";
import { auditFrom, getSystemAuditActor } from "@/lib/audit";
import { getAutomaticReminderStatus, runAutomaticStayReminders } from "@/lib/stay-reminders";

async function resolveAutomationActor(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (cronSecret && authorization === `Bearer ${cronSecret}`) {
    const actor = await getSystemAuditActor();
    if (!actor) {
      throw new ApiError(500, "Aucun compte staff disponible pour tracer le cron.");
    }
    return actor;
  }

  const staff = await requireStaff();
  return auditFrom(staff);
}

export const GET = withErrorHandler(async () => {
  await requireStaff();
  const status = await getAutomaticReminderStatus();
  return NextResponse.json(status);
});

export const POST = withErrorHandler(async (request) => {
  const actor = await resolveAutomationActor(request);
  const result = await runAutomaticStayReminders(actor);

  return NextResponse.json({
    ok: true,
    ...result,
  });
});

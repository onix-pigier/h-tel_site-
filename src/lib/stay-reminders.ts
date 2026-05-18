import { addDays, endOfDay, format, startOfDay } from "date-fns";
import { prisma } from "./prisma";
import { logAudit } from "./audit";
import { sendStayReminder } from "./email";
import { smsStayReminder } from "./sms";

interface AuditActor {
  userId: string;
  userName: string;
}

export async function runAutomaticStayReminders(actor: AuditActor) {
  const now = new Date();
  const tomorrowStart = startOfDay(addDays(now, 1));
  const tomorrowEnd = endOfDay(addDays(now, 1));
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const stays = await prisma.sejour.findMany({
    where: {
      status: "planifie",
      startedAt: {
        gte: tomorrowStart,
        lte: tomorrowEnd,
      },
    },
    include: {
      client: true,
      reservation: true,
    },
    orderBy: { startedAt: "asc" },
  });

  let sent = 0;

  for (const stay of stays) {
    const alreadySent = await prisma.auditLog.findFirst({
      where: {
        action: "stay.reminder.auto",
        targetType: "sejour",
        targetId: stay.id,
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      select: { id: true },
    });

    if (alreadySent) continue;

    const stayLabel = `le ${format(stay.startedAt, "dd/MM/yyyy 'à' HH:mm")}`;

    if (stay.client.email) {
      await sendStayReminder(stay.client.email, stay.client.firstName, stayLabel);
    }
    if (stay.client.phone) {
      await smsStayReminder(stay.client.phone, stay.client.firstName, stayLabel);
    }

    await logAudit({
      userId: actor.userId,
      userName: actor.userName,
      action: "stay.reminder.auto",
      targetType: "sejour",
      targetId: stay.id,
      details: {
        email: stay.client.email,
        phone: stay.client.phone,
        stayLabel,
        reservationReference: stay.reservation?.reference ?? null,
      },
    });

    sent += 1;
  }

  return {
    scanned: stays.length,
    sent,
  };
}

export async function getAutomaticReminderStatus() {
  const todayStart = startOfDay(new Date());

  const [sentToday, lastRun] = await Promise.all([
    prisma.auditLog.count({
      where: {
        action: "stay.reminder.auto",
        createdAt: { gte: todayStart },
      },
    }),
    prisma.auditLog.findFirst({
      where: { action: "stay.reminder.auto" },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        userName: true,
      },
    }),
  ]);

  return {
    checked: Boolean(lastRun),
    sentToday,
    lastRunAt: lastRun?.createdAt ?? null,
    lastRunBy: lastRun?.userName ?? null,
  };
}

import { getSystemAuditActor } from "../src/lib/audit";
import { runAutomaticStayReminders } from "../src/lib/stay-reminders";

async function main() {
  const actor = await getSystemAuditActor();

  if (!actor) {
    throw new Error("Aucun compte administrateur ou gerant trouvé pour tracer le cron de rappels.");
  }

  const result = await runAutomaticStayReminders(actor);
  console.log(`[stay-reminders] scanned=${result.scanned} sent=${result.sent}`);
}

main().catch((error) => {
  console.error("[stay-reminders] failed", error);
  process.exit(1);
});

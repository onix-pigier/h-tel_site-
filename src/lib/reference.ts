const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export type StayWorkflowKind = "web" | "direct" | "comptoir" | "appel";

const WORKFLOW_PREFIX: Record<StayWorkflowKind, string> = {
  web: "WEB",
  direct: "DIR",
  comptoir: "CPT",
  appel: "APL",
};

function randomCode(length = 4): string {
  let result = "";
  for (let index = 0; index < length; index += 1) {
    result += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return result;
}

function formatStamp(date = new Date()): string {
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function normalizeSeed(seed: string): string {
  const compact = seed.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return compact.slice(-8).padStart(8, "X");
}

export function generateReservationReference(date = new Date()): string {
  return `WEB_${formatStamp(date)}_${randomCode(6)}`;
}

export function generateStayCode(workflow: StayWorkflowKind, date = new Date()): string {
  return `${WORKFLOW_PREFIX[workflow]}_${formatStamp(date)}_${randomCode(6)}`;
}

export function detectStayWorkflow(code: string, fallbackSource?: string | null): StayWorkflowKind {
  if (code.startsWith("WEB_") || code.startsWith("SEJ_WEB_")) return "web";
  if (code.startsWith("CPT_") || code.startsWith("SEJ_CPT_") || code.startsWith("SEJ_COM_")) return "comptoir";
  if (code.startsWith("APL_") || code.startsWith("SEJ_APL_")) return "appel";
  if (code.startsWith("DIR_") || code.startsWith("SEJ_DIR_")) return "direct";
  return fallbackSource === "web" ? "web" : "direct";
}

export function generateInvoiceCode({
  type,
  issuedAt,
  stayCode,
  paymentId,
}: {
  type: "final" | "acompte";
  issuedAt?: Date;
  stayCode: string;
  paymentId?: string | null;
}): string {
  const scope = type === "final" ? "FIN" : "ACP";
  const seed = normalizeSeed(paymentId ?? stayCode);
  return `FAC_${scope}_${formatStamp(issuedAt)}_${seed.slice(0, 6)}`;
}

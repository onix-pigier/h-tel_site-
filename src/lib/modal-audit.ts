export type AuditValue = string | number | boolean | null;

export type ModalFieldChange = {
  field: string;
  label: string;
  before: AuditValue;
  after: AuditValue;
};

export type AuditSnapshot = Record<string, AuditValue | undefined>;

function normalizeAuditValue(value: unknown): AuditValue {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  return String(value).trim() || null;
}

export function buildModalFieldChanges(
  before: AuditSnapshot,
  after: AuditSnapshot,
  labels: Record<string, string>,
): ModalFieldChange[] {
  return Object.entries(labels)
    .map(([field, label]) => {
      const previous = normalizeAuditValue(before[field]);
      const next = normalizeAuditValue(after[field]);
      return { field, label, before: previous, after: next };
    })
    .filter((change) => String(change.before ?? "") !== String(change.after ?? ""));
}

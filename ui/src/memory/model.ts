export interface MemoryRecord {
  id: string;
  kind: string;
  scope: string;
  content: string;
  source_kind: string;
  source_ref: string;
  review: "reviewed" | "proposed";
  revision: number;
  preview?: boolean;
}

export function memoryRecord(value: unknown): MemoryRecord | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    row.id.length > 64 ||
    typeof row.content !== "string" ||
    row.content.length > 1200 ||
    typeof row.scope !== "string" ||
    typeof row.source_kind !== "string" ||
    typeof row.source_ref !== "string" ||
    typeof row.kind !== "string" ||
    !["reviewed", "proposed"].includes(String(row.review)) ||
    !Number.isInteger(row.revision) ||
    Number(row.revision) < 1
  )
    return;
  return row as unknown as MemoryRecord;
}

export function memoryRows(value: unknown): MemoryRecord[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 16).flatMap((row) => {
    const record = memoryRecord(row);
    return record ? [record] : [];
  });
}

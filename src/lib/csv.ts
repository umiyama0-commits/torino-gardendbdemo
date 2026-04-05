function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateCSV(
  rows: Record<string, unknown>[],
  columns: { key: string; label: string }[]
): string {
  const BOM = "\uFEFF"; // UTF-8 BOM for Japanese Excel compatibility
  const header = columns.map((c) => escapeCSV(c.label)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escapeCSV(row[c.key])).join(","))
    .join("\r\n");
  return BOM + header + "\r\n" + body;
}

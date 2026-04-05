import { prisma } from "@/lib/prisma";

export async function createAuditLog(
  userId: string,
  action: "CREATE" | "UPDATE" | "DELETE",
  entityType: string,
  entityId: string,
  changeSummary?: Record<string, unknown>
) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entityType,
      entityId,
      changeSummary: changeSummary ? JSON.stringify(changeSummary) : null,
    },
  });
}

export function diffChanges(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(newData)) {
    if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
      diff[key] = { from: oldData[key], to: newData[key] };
    }
  }
  return diff;
}

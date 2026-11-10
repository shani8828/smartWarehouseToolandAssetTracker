import type { Types } from "mongoose";
import { AuditLog } from "@/models";
import type { AUDIT_ACTIONS, AUDIT_ENTITIES } from "./constants";

type Id = Types.ObjectId | string;

// Append-only. Failures here must never block the operation being audited.
export async function writeAudit(
  action: (typeof AUDIT_ACTIONS)[number],
  entityType: (typeof AUDIT_ENTITIES)[number],
  entityId: Id,
  actor: Id | null | undefined,
  changes?: Record<string, unknown>,
) {
  try {
    await AuditLog.create({ action, entityType, entityId, actor: actor ?? undefined, changes, at: new Date() });
  } catch (err) {
    console.error("audit log write failed", err);
  }
}

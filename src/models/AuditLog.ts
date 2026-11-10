import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/constants";

// Append-only trail of every state change in the system.
const AuditLogSchema = new Schema(
  {
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    entityType: { type: String, enum: AUDIT_ENTITIES, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    actor: { type: Schema.Types.ObjectId, ref: "User" },
    changes: { type: Schema.Types.Mixed },
    at: { type: Date, required: true, default: Date.now },
  },
  { collection: "audit_logs" },
);

// Full history of one record, newest first
AuditLogSchema.index({ entityType: 1, entityId: 1, at: -1 });

export type AuditLogDoc = InferSchemaType<typeof AuditLogSchema>;
export const AuditLog = (models.AuditLog as Model<AuditLogDoc>) || model<AuditLogDoc>("AuditLog", AuditLogSchema);

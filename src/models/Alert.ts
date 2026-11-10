import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { ALERT_TYPES, EMAIL_STATUS } from "@/lib/constants";

const AlertSchema = new Schema(
  {
    type: { type: String, enum: ALERT_TYPES, required: true },
    asset: { type: Schema.Types.ObjectId, ref: "Asset", required: true },
    transaction: { type: Schema.Types.ObjectId, ref: "CustodyTransaction" },
    user: { type: Schema.Types.ObjectId, ref: "User" },
    message: { type: String, trim: true },
    emailStatus: { type: String, enum: EMAIL_STATUS, required: true, default: "PENDING" },
    // "smtp" when a mail server is configured, "preview" when the email is only rendered in the app
    emailTransport: { type: String, enum: ["smtp", "preview"] },
    emailTo: { type: String },
    emailSubject: { type: String },
    emailBody: { type: String },
    emailError: { type: String },
    sentAt: { type: Date },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "alerts" },
);

// Email dispatcher picks up pending alerts oldest first
AlertSchema.index({ emailStatus: 1, createdAt: 1 });
AlertSchema.index({ asset: 1, type: 1 });

export type AlertDoc = InferSchemaType<typeof AlertSchema>;
export const Alert = (models.Alert as Model<AlertDoc>) || model<AlertDoc>("Alert", AlertSchema);

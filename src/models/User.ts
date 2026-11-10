import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { ROLES } from "@/lib/constants";

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: { type: String, enum: ROLES, required: true, default: "BORROWER" },
    department: { type: String, required: true, trim: true },
    rollNumber: { type: String, trim: true, unique: true, sparse: true },
    phone: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    // bcrypt hash; never returned by default queries
    passwordHash: { type: String, select: false },
  },
  { timestamps: true, collection: "users" },
);

// "Borrowers of the ISE department" style lookups
UserSchema.index({ role: 1, department: 1 });

export type UserDoc = InferSchemaType<typeof UserSchema>;
export const User = (models.User as Model<UserDoc>) || model<UserDoc>("User", UserSchema);

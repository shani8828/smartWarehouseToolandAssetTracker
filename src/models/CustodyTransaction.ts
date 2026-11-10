import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { CONDITIONS, TXN_STATUS } from "@/lib/constants";

// One document per checkout. Returning the tool closes the same document,
// so the collection is the full chain-of-custody history of every asset.
const CustodyTransactionSchema = new Schema(
  {
    asset: { type: Schema.Types.ObjectId, ref: "Asset", required: true },
    borrower: { type: Schema.Types.ObjectId, ref: "User", required: true },
    issuedBy: { type: Schema.Types.ObjectId, ref: "User" },
    checkoutAt: { type: Date, required: true, default: Date.now },
    dueAt: { type: Date, required: true },
    returnedAt: { type: Date, default: null },
    conditionOut: { type: String, enum: CONDITIONS, required: true, default: "GOOD" },
    conditionIn: { type: String, enum: CONDITIONS },
    status: { type: String, enum: TXN_STATUS, required: true, default: "ACTIVE" },
    remarks: { type: String, trim: true },
  },
  { timestamps: true, collection: "custody_transactions" },
);

// At most one open loan per asset: the database itself rejects a duplicate checkout.
CustodyTransactionSchema.index(
  { asset: 1 },
  { unique: true, partialFilterExpression: { status: "ACTIVE" }, name: "one_active_loan_per_asset" },
);
// Borrower history and "what is this person holding"
CustodyTransactionSchema.index({ borrower: 1, status: 1 });
// Overdue audit: open loans ordered by due date
CustodyTransactionSchema.index({ status: 1, dueAt: 1 });

export type CustodyTransactionDoc = InferSchemaType<typeof CustodyTransactionSchema>;
export const CustodyTransaction =
  (models.CustodyTransaction as Model<CustodyTransactionDoc>) ||
  model<CustodyTransactionDoc>("CustodyTransaction", CustodyTransactionSchema);

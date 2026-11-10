import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { ASSET_STATUS, ASSET_TAG_PATTERN, CONDITIONS } from "@/lib/constants";

const AssetSchema = new Schema(
  {
    // Value encoded in the QR code / barcode label
    assetTag: { type: String, required: true, unique: true, uppercase: true, trim: true, match: ASSET_TAG_PATTERN },
    name: { type: String, required: true, trim: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    manufacturer: { type: String, trim: true },
    serialNumber: { type: String, trim: true },
    status: { type: String, enum: ASSET_STATUS, required: true, default: "AVAILABLE" },
    condition: { type: String, enum: CONDITIONS, required: true, default: "GOOD" },
    location: {
      lab: { type: String, required: true, trim: true },
      shelf: { type: String, trim: true },
    },
    // Denormalised pointers to the open loan, so availability reads need no join
    currentCustodian: { type: Schema.Types.ObjectId, ref: "User", default: null },
    currentTransaction: { type: Schema.Types.ObjectId, ref: "CustodyTransaction", default: null },
    purchaseDate: { type: Date },
    purchaseCost: { type: Number, min: 0 },
    notes: { type: String, trim: true },
  },
  { timestamps: true, collection: "assets" },
);

// Availability matrix: filter by status within a category
AssetSchema.index({ status: 1, category: 1 });
// "What does this person currently hold?"
AssetSchema.index({ currentCustodian: 1 }, { sparse: true });

export type AssetDoc = InferSchemaType<typeof AssetSchema>;
export const Asset = (models.Asset as Model<AssetDoc>) || model<AssetDoc>("Asset", AssetSchema);

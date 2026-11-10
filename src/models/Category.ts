import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const CategorySchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    // Short code used inside asset tags, e.g. MM for multimeters
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, match: /^[A-Z]{2,4}$/ },
    description: { type: String, trim: true },
    // Loan period applied when a tool of this category is checked out
    defaultLoanDays: { type: Number, default: 7, min: 1 },
  },
  { timestamps: true, collection: "categories" },
);

export type CategoryDoc = InferSchemaType<typeof CategorySchema>;
export const Category =
  (models.Category as Model<CategoryDoc>) || model<CategoryDoc>("Category", CategorySchema);

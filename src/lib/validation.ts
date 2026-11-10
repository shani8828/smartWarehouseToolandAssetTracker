import { z } from "zod";
import { ASSET_STATUS, ASSET_TAG_PATTERN, CONDITIONS, ROLES } from "./constants";

// Input validation that runs before anything reaches Mongoose.

export const categoryInput = z.object({
  name: z.string().trim().min(2),
  code: z.string().trim().toUpperCase().regex(/^[A-Z]{2,4}$/, "2-4 capital letters"),
  description: z.string().trim().optional(),
  defaultLoanDays: z.number().int().min(1).max(90).default(7),
});

export const userInput = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(ROLES),
  department: z.string().trim().min(2),
  rollNumber: z.string().trim().optional(),
  phone: z.string().trim().optional(),
});

export const assetInput = z.object({
  assetTag: z.string().trim().toUpperCase().regex(ASSET_TAG_PATTERN, "Format: ISE-MM-001"),
  name: z.string().trim().min(2),
  categoryCode: z.string().trim().toUpperCase(),
  manufacturer: z.string().trim().optional(),
  serialNumber: z.string().trim().optional(),
  status: z.enum(ASSET_STATUS).default("AVAILABLE"),
  condition: z.enum(CONDITIONS).default("GOOD"),
  location: z.object({ lab: z.string().trim().min(2), shelf: z.string().trim().optional() }),
  purchaseDate: z.coerce.date().optional(),
  purchaseCost: z.number().nonnegative().optional(),
  notes: z.string().trim().optional(),
});

export type CategoryInput = z.infer<typeof categoryInput>;
export type UserInput = z.infer<typeof userInput>;
export type AssetInput = z.infer<typeof assetInput>;

import type { Model } from "mongoose";
import { Alert } from "./Alert";
import { Asset } from "./Asset";
import { AuditLog } from "./AuditLog";
import { Category } from "./Category";
import { CustodyTransaction } from "./CustodyTransaction";
import { User } from "./User";

export { Alert, Asset, AuditLog, Category, CustodyTransaction, User };

// Order used on the data model page and by the seed script
export const ALL_MODELS = [Asset, Category, User, CustodyTransaction, Alert, AuditLog] as unknown as Model<unknown>[];

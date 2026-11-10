// Shared enums for the data model. Kept in one place so Mongoose schemas,
// Zod validators and the UI all agree on the allowed values.

export const ROLES = ["ADMIN", "LAB_STAFF", "BORROWER"] as const;
export type Role = (typeof ROLES)[number];

// Asset lifecycle states (Available -> Checked Out -> Overdue -> Under Maintenance)
export const ASSET_STATUS = ["AVAILABLE", "CHECKED_OUT", "OVERDUE", "UNDER_MAINTENANCE"] as const;
export type AssetStatus = (typeof ASSET_STATUS)[number];

export const CONDITIONS = ["GOOD", "FAIR", "DAMAGED"] as const;
export type Condition = (typeof CONDITIONS)[number];

export const TXN_STATUS = ["ACTIVE", "RETURNED"] as const;

export const ALERT_TYPES = ["OVERDUE", "DAMAGED"] as const;
export const EMAIL_STATUS = ["PENDING", "SENT", "FAILED"] as const;

export const AUDIT_ACTIONS = ["CREATE", "UPDATE", "CHECKOUT", "CHECKIN", "STATUS_CHANGE", "DELETE"] as const;
export const AUDIT_ENTITIES = ["Asset", "User", "Category", "CustodyTransaction"] as const;

// Asset tags look like ISE-MM-001: department code, category code, running number.
export const ASSET_TAG_PATTERN = /^[A-Z]{2,5}-[A-Z]{2,4}-\d{3,5}$/;

export const ROLE_LABEL: Record<Role, string> = { ADMIN: "Admin", LAB_STAFF: "Lab staff", BORROWER: "Borrower" };

export const CONDITION_LABEL: Record<Condition, string> = { GOOD: "Good", FAIR: "Fair", DAMAGED: "Damaged" };

export const STATUS_LABEL: Record<AssetStatus, string> = {
  AVAILABLE: "Available",
  CHECKED_OUT: "Checked out",
  OVERDUE: "Overdue",
  UNDER_MAINTENANCE: "Under maintenance",
};

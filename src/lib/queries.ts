import "server-only";
import { Types } from "mongoose";
import { cache } from "react";
import { connectDB } from "./db";
import { ASSET_STATUS, type AssetStatus, type Condition, type Role } from "./constants";
import { Alert, Asset, AuditLog, Category, CustodyTransaction, User } from "@/models";

// Read models for the pages. Everything is lean() and projected to plain,
// serialisable objects so it can cross into client components.

const DAY = 86_400_000;
const s = (id: unknown) => String(id);

export type AssetRow = {
  id: string;
  assetTag: string;
  name: string;
  manufacturer?: string;
  status: AssetStatus;
  condition: Condition;
  lab: string;
  shelf?: string;
  category: string;
  categoryId: string;
  custodian?: string;
  dueAt?: string;
};

type PopAsset = {
  _id: Types.ObjectId;
  assetTag: string;
  name: string;
  manufacturer?: string;
  status: AssetStatus;
  condition: Condition;
  location?: { lab?: string; shelf?: string };
  category?: { _id: Types.ObjectId; name: string; defaultLoanDays?: number };
  currentCustodian?: { _id: Types.ObjectId; name: string; department?: string } | null;
  currentTransaction?: { _id: Types.ObjectId; dueAt: Date; checkoutAt: Date } | null;
  serialNumber?: string;
  purchaseDate?: Date;
  purchaseCost?: number;
  notes?: string;
  createdAt?: Date;
};

const toRow = (a: PopAsset): AssetRow => ({
  id: s(a._id),
  assetTag: a.assetTag,
  name: a.name,
  manufacturer: a.manufacturer ?? undefined,
  status: a.status,
  condition: a.condition,
  lab: a.location?.lab ?? "",
  shelf: a.location?.shelf ?? undefined,
  category: a.category?.name ?? "",
  categoryId: a.category ? s(a.category._id) : "",
  custodian: a.currentCustodian?.name,
  dueAt: a.currentTransaction?.dueAt?.toISOString(),
});

export async function listAssets(): Promise<AssetRow[]> {
  await connectDB();
  const docs = (await Asset.find()
    .populate("category", "name")
    .populate("currentCustodian", "name")
    .populate("currentTransaction", "dueAt checkoutAt")
    .sort({ assetTag: 1 })
    .lean()) as unknown as PopAsset[];
  return docs.map(toRow);
}

export async function listCategories() {
  await connectDB();
  const cats = await Category.find().sort({ name: 1 }).lean();
  return cats.map((c) => ({ id: s(c._id), name: c.name, code: c.code, defaultLoanDays: c.defaultLoanDays ?? 7 }));
}

export async function listBorrowers() {
  await connectDB();
  const users = await User.find({ isActive: true }, "name department role rollNumber").sort({ name: 1 }).lean();
  return users.map((u) => ({ id: s(u._id), name: u.name, department: u.department, role: u.role as Role, rollNumber: u.rollNumber ?? undefined }));
}

export type LoanRow = {
  id: string;
  assetId: string;
  assetTag: string;
  assetName: string;
  borrowerId: string;
  borrower: string;
  department: string;
  issuedBy?: string;
  checkoutAt: string;
  dueAt: string;
  returnedAt?: string;
  conditionOut?: Condition;
  conditionIn?: Condition;
  status: "ACTIVE" | "RETURNED";
  remarks?: string;
};

type PopLoan = {
  _id: Types.ObjectId;
  asset: { _id: Types.ObjectId; assetTag: string; name: string } | null;
  borrower: { _id: Types.ObjectId; name: string; department: string } | null;
  issuedBy?: { name: string } | null;
  checkoutAt: Date;
  dueAt: Date;
  returnedAt?: Date | null;
  conditionOut?: Condition;
  conditionIn?: Condition;
  status: "ACTIVE" | "RETURNED";
  remarks?: string;
};

const toLoan = (l: PopLoan): LoanRow => ({
  id: s(l._id),
  assetId: l.asset ? s(l.asset._id) : "",
  assetTag: l.asset?.assetTag ?? "(deleted)",
  assetName: l.asset?.name ?? "",
  borrowerId: l.borrower ? s(l.borrower._id) : "",
  borrower: l.borrower?.name ?? "(deleted)",
  department: l.borrower?.department ?? "",
  issuedBy: l.issuedBy?.name,
  checkoutAt: l.checkoutAt.toISOString(),
  dueAt: l.dueAt.toISOString(),
  returnedAt: l.returnedAt?.toISOString(),
  conditionOut: l.conditionOut,
  conditionIn: l.conditionIn,
  status: l.status,
  remarks: l.remarks,
});

export async function listLoans(opts: { view: "active" | "overdue" | "returned" | "all"; borrowerId?: string; assetId?: string; limit?: number }) {
  await connectDB();
  const q: Record<string, unknown> = {};
  if (opts.view === "active") q.status = "ACTIVE";
  if (opts.view === "overdue") Object.assign(q, { status: "ACTIVE", dueAt: { $lt: new Date() } });
  if (opts.view === "returned") q.status = "RETURNED";
  if (opts.borrowerId) q.borrower = new Types.ObjectId(opts.borrowerId);
  if (opts.assetId) q.asset = new Types.ObjectId(opts.assetId);
  const sort: Record<string, 1 | -1> = opts.view === "active" || opts.view === "overdue" ? { dueAt: 1 } : { checkoutAt: -1 };
  const docs = (await CustodyTransaction.find(q)
    .populate("asset", "assetTag name")
    .populate("borrower", "name department")
    .populate("issuedBy", "name")
    .sort(sort)
    .limit(opts.limit ?? 200)
    .lean()) as unknown as PopLoan[];
  return docs.map(toLoan);
}

export async function loanCounts(borrowerId?: string) {
  await connectDB();
  const base = borrowerId ? { borrower: new Types.ObjectId(borrowerId) } : {};
  const [active, overdue, returned] = await Promise.all([
    CustodyTransaction.countDocuments({ ...base, status: "ACTIVE" }),
    CustodyTransaction.countDocuments({ ...base, status: "ACTIVE", dueAt: { $lt: new Date() } }),
    CustodyTransaction.countDocuments({ ...base, status: "RETURNED" }),
  ]);
  return { active, overdue, returned };
}

export const getAssetDetail = cache(async (id: string) => {
  if (!Types.ObjectId.isValid(id)) return null;
  await connectDB();
  const a = (await Asset.findById(id)
    .populate("category", "name defaultLoanDays")
    .populate("currentCustodian", "name department")
    .populate("currentTransaction", "dueAt checkoutAt")
    .lean()) as unknown as PopAsset | null;
  if (!a) return null;
  const [history, audit] = await Promise.all([
    listLoans({ view: "all", assetId: id, limit: 50 }),
    AuditLog.find({ entityType: "Asset", entityId: a._id }).populate("actor", "name").sort({ at: -1 }).limit(30).lean(),
  ]);
  return {
    ...toRow(a),
    serialNumber: a.serialNumber,
    purchaseDate: a.purchaseDate?.toISOString(),
    purchaseCost: a.purchaseCost,
    notes: a.notes,
    location: { lab: a.location?.lab ?? "", shelf: a.location?.shelf ?? "" },
    defaultLoanDays: a.category?.defaultLoanDays ?? 7,
    custodianDept: a.currentCustodian?.department,
    checkoutAt: a.currentTransaction?.checkoutAt?.toISOString(),
    history,
    audit: audit.map((e) => ({
      id: s(e._id),
      action: e.action,
      at: e.at.toISOString(),
      actor: (e.actor as unknown as { name?: string } | null)?.name ?? "System",
      changes: (e.changes ?? {}) as Record<string, unknown>,
    })),
  };
});

export async function getDashboard() {
  await connectDB();
  const now = new Date();
  const since = new Date(now.getTime() - 13 * DAY);
  since.setHours(0, 0, 0, 0);

  const [byStatus, byCategory, overdueLoans, dueSoon, perDay, recent, openAlerts, totalUsers, overdueCount] = await Promise.all([
    Asset.aggregate<{ _id: AssetStatus; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    Asset.aggregate<{ _id: Types.ObjectId; name: string; statuses: { k: AssetStatus; n: number }[]; total: number }>([
      { $group: { _id: { c: "$category", s: "$status" }, n: { $sum: 1 } } },
      { $group: { _id: "$_id.c", statuses: { $push: { k: "$_id.s", n: "$n" } }, total: { $sum: "$n" } } },
      { $lookup: { from: "categories", localField: "_id", foreignField: "_id", as: "c" } },
      { $set: { name: { $first: "$c.name" } } },
      { $project: { c: 0 } },
      { $sort: { name: 1 } },
    ]),
    listLoans({ view: "overdue", limit: 8 }),
    (async () => {
      const docs = (await CustodyTransaction.find({ status: "ACTIVE", dueAt: { $gte: now, $lt: new Date(now.getTime() + 2 * DAY) } })
        .populate("asset", "assetTag name")
        .populate("borrower", "name department")
        .sort({ dueAt: 1 })
        .limit(8)
        .lean()) as unknown as PopLoan[];
      return docs.map(toLoan);
    })(),
    CustodyTransaction.aggregate<{ _id: string; n: number }>([
      { $match: { checkoutAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$checkoutAt", timezone: "+05:30" } }, n: { $sum: 1 } } },
    ]),
    AuditLog.find().populate("actor", "name").sort({ at: -1 }).limit(8).lean(),
    Alert.countDocuments({ resolvedAt: null }),
    User.countDocuments({ isActive: true }),
    // Counted from the loans themselves so it is right even before the hourly audit runs
    CustodyTransaction.countDocuments({ status: "ACTIVE", dueAt: { $lt: now } }),
  ]);

  const counts = Object.fromEntries(ASSET_STATUS.map((k) => [k, 0])) as Record<AssetStatus, number>;
  byStatus.forEach((r) => (counts[r._id] = r.n));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  // 14 consecutive days, filling gaps with zero
  const perDayMap = new Map(perDay.map((d) => [d._id, d.n]));
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(since.getTime() + i * DAY);
    const key = new Date(d.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);
    return { date: key, label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), n: perDayMap.get(key) ?? 0 };
  });

  // Resolve asset tags for audit entries in one query
  const assetIds = recent.filter((e) => e.entityType === "Asset").map((e) => e.entityId);
  const tags = new Map((await Asset.find({ _id: { $in: assetIds } }, "assetTag").lean()).map((a) => [s(a._id), a.assetTag]));

  return {
    counts,
    total,
    utilisation: total ? Math.round(((counts.CHECKED_OUT + counts.OVERDUE) / total) * 100) : 0,
    categories: byCategory.map((c) => ({
      id: s(c._id),
      name: c.name,
      total: c.total,
      counts: Object.fromEntries(ASSET_STATUS.map((k) => [k, c.statuses.find((x) => x.k === k)?.n ?? 0])) as Record<AssetStatus, number>,
    })),
    overdueLoans,
    dueSoon,
    days,
    openAlerts,
    totalUsers,
    overdueCount,
    recent: recent.map((e) => ({
      id: s(e._id),
      action: e.action,
      at: e.at.toISOString(),
      actor: (e.actor as unknown as { name?: string } | null)?.name ?? "System",
      entityId: s(e.entityId),
      tag: tags.get(s(e.entityId)),
      changes: (e.changes ?? {}) as Record<string, unknown>,
    })),
  };
}

export async function listAlerts() {
  await connectDB();
  const docs = await Alert.find()
    .populate("asset", "assetTag name")
    .populate("user", "name")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  return docs.map((a) => {
    const asset = a.asset as unknown as { _id: Types.ObjectId; assetTag: string; name: string } | null;
    const user = a.user as unknown as { name: string } | null;
    return {
      id: s(a._id),
      type: a.type as "OVERDUE" | "DAMAGED",
      assetId: asset ? s(asset._id) : "",
      assetTag: asset?.assetTag ?? "",
      assetName: asset?.name ?? "",
      user: user?.name,
      message: a.message ?? "",
      emailStatus: a.emailStatus as "PENDING" | "SENT" | "FAILED",
      emailTransport: (a.emailTransport ?? undefined) as "smtp" | "preview" | undefined,
      emailTo: a.emailTo ?? "",
      emailSubject: a.emailSubject ?? "",
      emailBody: a.emailBody ?? "",
      emailError: a.emailError ?? undefined,
      createdAt: (a.createdAt as Date).toISOString(),
      resolvedAt: a.resolvedAt ? (a.resolvedAt as Date).toISOString() : undefined,
    };
  });
}

export async function listUsers() {
  await connectDB();
  const [users, active] = await Promise.all([
    User.find().sort({ role: 1, name: 1 }).lean(),
    CustodyTransaction.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { status: "ACTIVE" } },
      { $group: { _id: "$borrower", n: { $sum: 1 } } },
    ]),
  ]);
  const activeMap = new Map(active.map((a) => [s(a._id), a.n]));
  return users.map((u) => ({
    id: s(u._id),
    name: u.name,
    email: u.email,
    role: u.role as Role,
    department: u.department,
    rollNumber: u.rollNumber ?? undefined,
    isActive: u.isActive ?? true,
    activeLoans: activeMap.get(s(u._id)) ?? 0,
  }));
}

// Next free running number for a department + category tag prefix
export async function nextAssetTag(dept: string, categoryCode: string) {
  await connectDB();
  const prefix = `${dept}-${categoryCode}-`;
  const last = await Asset.find({ assetTag: { $regex: `^${prefix}\\d+$` } }, "assetTag").sort({ assetTag: -1 }).limit(1).lean();
  const n = last.length ? Number(last[0].assetTag.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(n).padStart(3, "0")}`;
}

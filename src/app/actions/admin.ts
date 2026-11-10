"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Types } from "mongoose";
import { z } from "zod";
import { ASSET_TAG_PATTERN, CONDITIONS, ROLES } from "@/lib/constants";
import { writeAudit } from "@/lib/audit";
import { connectDB } from "@/lib/db";
import { runOverdueSweep } from "@/lib/overdue";
import { nextAssetTag } from "@/lib/queries";
import { isStaff, requireRole, requireSession } from "@/lib/session";
import { Asset, Category, User } from "@/models";
import type { ActionState } from "./custody";

const err = (e: string): ActionState => ({ error: e, at: Date.now() });
const dup = (e: unknown) => (e as { code?: number }).code === 11000;

const optional = z.string().trim().optional().transform((v) => v || undefined);

const assetForm = z.object({
  name: z.string().trim().min(2, "Name is too short"),
  categoryId: z.string().refine((v) => Types.ObjectId.isValid(v), "Choose a category"),
  assetTag: z.string().trim().toUpperCase().optional().transform((v) => v || undefined),
  manufacturer: optional,
  serialNumber: optional,
  condition: z.enum(CONDITIONS),
  lab: z.string().trim().min(2, "Enter the lab"),
  shelf: optional,
  purchaseDate: optional,
  purchaseCost: z.string().optional().transform((v) => (v ? Number(v) : undefined)).refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), "Cost must be a positive number"),
  notes: optional,
});

export async function saveAssetAction(_p: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireRole("ADMIN");
  const parsed = assetForm.safeParse(Object.fromEntries(form));
  if (!parsed.success) return err(parsed.error.issues[0].message);
  const d = parsed.data;
  const id = String(form.get("id") ?? "");

  await connectDB();
  const category = await Category.findById(d.categoryId).lean();
  if (!category) return err("Category not found");

  const assetTag = d.assetTag ?? (id ? undefined : await nextAssetTag(session.department || "ISE", category.code));
  if (assetTag && !ASSET_TAG_PATTERN.test(assetTag)) return err("Tag must look like ISE-MM-001");

  const doc = {
    name: d.name,
    category: category._id,
    manufacturer: d.manufacturer,
    serialNumber: d.serialNumber,
    condition: d.condition,
    location: { lab: d.lab, shelf: d.shelf },
    purchaseDate: d.purchaseDate ? new Date(d.purchaseDate) : undefined,
    purchaseCost: d.purchaseCost,
    notes: d.notes,
    ...(assetTag ? { assetTag } : {}),
  };

  let assetId: string;
  try {
    if (id) {
      const updated = await Asset.findByIdAndUpdate(id, { $set: doc }, { returnDocument: "after", runValidators: true }).lean();
      if (!updated) return err("Asset not found");
      assetId = id;
      await writeAudit("UPDATE", "Asset", id, session.sub, { fields: Object.keys(doc) });
    } else {
      const created = await Asset.create(doc);
      assetId = String(created._id);
      await writeAudit("CREATE", "Asset", created._id, session.sub, { assetTag: created.assetTag });
    }
  } catch (e) {
    if (dup(e)) return err("That asset tag is already in use");
    throw e;
  }
  revalidatePath("/", "layout");
  redirect(`/assets/${assetId}`);
}

const userForm = z.object({
  name: z.string().trim().min(2, "Name is too short"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.enum(ROLES),
  department: z.string().trim().toUpperCase().min(2, "Enter the department"),
  rollNumber: optional,
  password: z.string().min(6, "Password needs at least 6 characters"),
});

export async function createUserAction(_p: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireRole("ADMIN");
  const parsed = userForm.safeParse(Object.fromEntries(form));
  if (!parsed.success) return err(parsed.error.issues[0].message);
  const { password, ...rest } = parsed.data;
  await connectDB();
  try {
    const u = await User.create({ ...rest, passwordHash: await bcrypt.hash(password, 10) });
    await writeAudit("CREATE", "User", u._id, session.sub, { email: u.email, role: u.role });
  } catch (e) {
    if (dup(e)) return err("A user with that email or roll number already exists");
    throw e;
  }
  revalidatePath("/users");
  return { ok: true, message: `${rest.name} added`, at: Date.now() };
}

export async function toggleUserAction(form: FormData) {
  const session = await requireRole("ADMIN");
  const id = String(form.get("id") ?? "");
  if (!Types.ObjectId.isValid(id) || id === session.sub) return;
  await connectDB();
  const u = await User.findById(id, "isActive").lean();
  if (!u) return;
  await User.updateOne({ _id: id }, { $set: { isActive: !u.isActive } });
  await writeAudit("UPDATE", "User", id, session.sub, { isActive: !u.isActive });
  revalidatePath("/users");
}

const categoryForm = z.object({
  name: z.string().trim().min(2, "Name is too short"),
  code: z.string().trim().toUpperCase().regex(/^[A-Z]{2,4}$/, "Code must be 2-4 letters"),
  defaultLoanDays: z.coerce.number().int().min(1).max(90),
});

export async function createCategoryAction(_p: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireRole("ADMIN");
  const parsed = categoryForm.safeParse(Object.fromEntries(form));
  if (!parsed.success) return err(parsed.error.issues[0].message);
  await connectDB();
  try {
    const c = await Category.create(parsed.data);
    await writeAudit("CREATE", "Category", c._id, session.sub, { code: c.code });
  } catch (e) {
    if (dup(e)) return err("That category name or code already exists");
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok: true, message: `Category ${parsed.data.name} added`, at: Date.now() };
}

export async function runAuditAction(): Promise<ActionState> {
  const session = await requireSession();
  if (!isStaff(session)) return err("Not allowed");
  const r = await runOverdueSweep();
  revalidatePath("/", "layout");
  return {
    ok: true,
    at: Date.now(),
    message:
      r.checked === 0
        ? "Audit complete: no loans are past due"
        : `Audit complete: ${r.checked} past-due loan${r.checked > 1 ? "s" : ""}, ${r.flagged} newly flagged, ${r.alertsCreated} email${r.alertsCreated === 1 ? "" : "s"} sent`,
  };
}

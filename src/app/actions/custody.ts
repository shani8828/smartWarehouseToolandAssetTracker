"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CONDITIONS } from "@/lib/constants";
import { checkoutAsset, CustodyError, markRepaired, returnAsset, sendToMaintenance } from "@/lib/custody";
import { fmtDate } from "@/lib/format";
import { isStaff, requireSession } from "@/lib/session";

export type ActionState = { ok?: boolean; message?: string; error?: string; at?: number };

const fail = (err: unknown): ActionState => {
  if (err instanceof CustodyError) return { error: err.message, at: Date.now() };
  console.error(err);
  return { error: "Something went wrong. Please try again.", at: Date.now() };
};
const done = (message: string): ActionState => {
  revalidatePath("/", "layout");
  return { ok: true, message, at: Date.now() };
};

const checkoutForm = z.object({
  assetId: z.string().min(1),
  borrowerId: z.string().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a due date"),
  remarks: z.string().trim().max(300).optional(),
});

export async function checkoutAction(_p: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireSession();
  const parsed = checkoutForm.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, at: Date.now() };

  // Borrowers can only check tools out to themselves
  const borrowerId = isStaff(session) ? parsed.data.borrowerId : session.sub;
  if (!borrowerId) return { error: "Choose who is borrowing the tool", at: Date.now() };

  // Due at the end of the chosen day (local time)
  const dueAt = new Date(`${parsed.data.dueDate}T18:00:00+05:30`);
  try {
    const r = await checkoutAsset({ assetId: parsed.data.assetId, borrowerId, actorId: session.sub, dueAt, remarks: parsed.data.remarks });
    return done(`${r.assetTag} issued to ${r.borrower}, due ${fmtDate(r.dueAt)}`);
  } catch (err) {
    return fail(err);
  }
}

const returnForm = z.object({
  assetId: z.string().min(1),
  conditionIn: z.enum(CONDITIONS),
  remarks: z.string().trim().max(300).optional(),
});

export async function returnAction(_p: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireSession();
  if (!isStaff(session)) return { error: "Returns are received by lab staff", at: Date.now() };
  const parsed = returnForm.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Select the condition of the returned tool", at: Date.now() };
  try {
    const r = await returnAsset({ ...parsed.data, actorId: session.sub });
    const notes = [r.late && "returned late", r.damaged && "sent to maintenance"].filter(Boolean).join(", ");
    return done(`${r.assetTag} returned${notes ? ` (${notes})` : ""}`);
  } catch (err) {
    return fail(err);
  }
}

export async function maintenanceAction(_p: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireSession();
  if (!isStaff(session)) return { error: "Not allowed", at: Date.now() };
  const assetId = String(form.get("assetId") ?? "");
  const note = String(form.get("note") ?? "").trim() || undefined;
  try {
    const r = await sendToMaintenance({ assetId, actorId: session.sub, note });
    return done(`${r.assetTag} moved to maintenance`);
  } catch (err) {
    return fail(err);
  }
}

export async function repairedAction(_p: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireSession();
  if (!isStaff(session)) return { error: "Not allowed", at: Date.now() };
  try {
    const r = await markRepaired({ assetId: String(form.get("assetId") ?? ""), actorId: session.sub });
    return done(`${r.assetTag} is available again`);
  } catch (err) {
    return fail(err);
  }
}

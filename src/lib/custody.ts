import "server-only";
import { Types } from "mongoose";
import { connectDB } from "./db";
import { writeAudit } from "./audit";
import { sendMail } from "./mailer";
import { fmtDate } from "./format";
import { STATUS_LABEL, type AssetStatus, type Condition } from "./constants";
import { Alert, Asset, CustodyTransaction, User } from "@/models";

// The chain-of-custody engine. The local MongoDB is a standalone server (no
// multi-document transactions), so every state change is a conditional,
// atomic single-document update, and the partial unique index on
// custody_transactions guarantees at most one open loan per asset.

export class CustodyError extends Error {}

const oid = (id: string) => {
  if (!Types.ObjectId.isValid(id)) throw new CustodyError("Invalid id");
  return new Types.ObjectId(id);
};

async function describeBlocked(assetId: Types.ObjectId) {
  const a = await Asset.findById(assetId, "assetTag status").lean();
  if (!a) return new CustodyError("Asset not found");
  return new CustodyError(`${a.assetTag} is ${STATUS_LABEL[a.status as AssetStatus].toLowerCase()}`);
}

export async function checkoutAsset(input: {
  assetId: string;
  borrowerId: string;
  actorId: string;
  dueAt: Date;
  remarks?: string;
}) {
  await connectDB();
  const assetId = oid(input.assetId);
  const borrowerId = oid(input.borrowerId);
  if (input.dueAt.getTime() <= Date.now()) throw new CustodyError("Due date must be in the future");

  const borrower = await User.findOne({ _id: borrowerId, isActive: true }, "name").lean();
  if (!borrower) throw new CustodyError("Borrower not found or inactive");

  // Claim the asset only if it is still available (atomic compare-and-set)
  const asset = await Asset.findOneAndUpdate(
    { _id: assetId, status: "AVAILABLE" },
    { $set: { status: "CHECKED_OUT", currentCustodian: borrowerId } },
    { returnDocument: "after" },
  ).lean();
  if (!asset) throw await describeBlocked(assetId);

  try {
    const txn = await CustodyTransaction.create({
      asset: assetId,
      borrower: borrowerId,
      issuedBy: oid(input.actorId),
      checkoutAt: new Date(),
      dueAt: input.dueAt,
      conditionOut: asset.condition,
      status: "ACTIVE",
      remarks: input.remarks || undefined,
    });
    await Asset.updateOne({ _id: assetId }, { $set: { currentTransaction: txn._id } });
    await writeAudit("CHECKOUT", "Asset", assetId, input.actorId, {
      borrower: borrower.name,
      dueAt: input.dueAt,
      transaction: txn._id,
    });
    return { assetTag: asset.assetTag, borrower: borrower.name, dueAt: input.dueAt };
  } catch (err) {
    // Roll the asset back so it is not stuck as checked out without a loan
    await Asset.updateOne(
      { _id: assetId, currentTransaction: null },
      { $set: { status: "AVAILABLE", currentCustodian: null } },
    );
    if ((err as { code?: number }).code === 11000) throw new CustodyError("This tool already has an open loan");
    throw err;
  }
}

export async function returnAsset(input: { assetId: string; actorId: string; conditionIn: Condition; remarks?: string }) {
  await connectDB();
  const assetId = oid(input.assetId);
  const now = new Date();

  const txn = await CustodyTransaction.findOneAndUpdate(
    { asset: assetId, status: "ACTIVE" },
    { $set: { status: "RETURNED", returnedAt: now, conditionIn: input.conditionIn, remarks: input.remarks || undefined } },
    { returnDocument: "after" },
  ).lean();
  if (!txn) throw new CustodyError("This tool has no open loan");

  const damaged = input.conditionIn === "DAMAGED";
  const asset = await Asset.findOneAndUpdate(
    { _id: assetId },
    {
      $set: {
        status: damaged ? "UNDER_MAINTENANCE" : "AVAILABLE",
        condition: input.conditionIn,
        currentCustodian: null,
        currentTransaction: null,
      },
    },
    { returnDocument: "after" },
  ).lean();

  // The loan is closed, so any overdue alert for it is resolved
  await Alert.updateMany({ transaction: txn._id, resolvedAt: null }, { $set: { resolvedAt: now } });

  const late = txn.dueAt < now;
  await writeAudit("CHECKIN", "Asset", assetId, input.actorId, {
    transaction: txn._id,
    conditionIn: input.conditionIn,
    late,
  });

  if (damaged && asset) await raiseDamageAlert(asset._id, asset.assetTag, asset.name, txn._id, txn.borrower);
  return { assetTag: asset?.assetTag, late, damaged };
}

async function raiseDamageAlert(
  assetId: Types.ObjectId,
  tag: string,
  name: string,
  txnId: Types.ObjectId,
  borrowerId: Types.ObjectId,
) {
  const [admins, borrower] = await Promise.all([
    User.find({ role: { $in: ["ADMIN", "LAB_STAFF"] }, isActive: true }, "email").lean(),
    User.findById(borrowerId, "name").lean(),
  ]);
  const to = admins.map((a) => a.email).join(", ");
  const subject = `Damaged on return: ${name} (${tag})`;
  const body = [
    `${name} (${tag}) was returned in damaged condition by ${borrower?.name ?? "a borrower"} on ${fmtDate(new Date())}.`,
    "",
    "It has been moved to Under Maintenance and cannot be issued until it is marked repaired.",
  ].join("\n");
  const alert = await Alert.create({
    type: "DAMAGED",
    asset: assetId,
    transaction: txnId,
    user: borrowerId,
    message: `Returned damaged by ${borrower?.name ?? "borrower"}`,
    emailTo: to,
    emailSubject: subject,
    emailBody: body,
  });
  if (to) {
    const r = await sendMail(to, subject, body);
    await Alert.updateOne(
      { _id: alert._id },
      r.ok
        ? { $set: { emailStatus: "SENT", emailTransport: r.transport, sentAt: new Date() } }
        : { $set: { emailStatus: "FAILED", emailTransport: r.transport, emailError: r.error } },
    );
  }
}

export async function sendToMaintenance(input: { assetId: string; actorId: string; note?: string }) {
  await connectDB();
  const assetId = oid(input.assetId);
  const asset = await Asset.findOneAndUpdate(
    { _id: assetId, status: "AVAILABLE" },
    { $set: { status: "UNDER_MAINTENANCE", ...(input.note ? { notes: input.note } : {}) } },
    { returnDocument: "after" },
  ).lean();
  if (!asset) throw await describeBlocked(assetId);
  await writeAudit("STATUS_CHANGE", "Asset", assetId, input.actorId, { from: "AVAILABLE", to: "UNDER_MAINTENANCE", note: input.note });
  return { assetTag: asset.assetTag };
}

export async function markRepaired(input: { assetId: string; actorId: string }) {
  await connectDB();
  const assetId = oid(input.assetId);
  const asset = await Asset.findOneAndUpdate(
    { _id: assetId, status: "UNDER_MAINTENANCE" },
    { $set: { status: "AVAILABLE", condition: "GOOD" } },
    { returnDocument: "after" },
  ).lean();
  if (!asset) throw await describeBlocked(assetId);
  await Alert.updateMany({ asset: assetId, type: "DAMAGED", resolvedAt: null }, { $set: { resolvedAt: new Date() } });
  await writeAudit("STATUS_CHANGE", "Asset", assetId, input.actorId, { from: "UNDER_MAINTENANCE", to: "AVAILABLE" });
  return { assetTag: asset.assetTag };
}

import "server-only";
import type { Types } from "mongoose";
import { connectDB } from "./db";
import { writeAudit } from "./audit";
import { sendMail } from "./mailer";
import { daysOverdue, fmtDate } from "./format";
import { Alert, Asset, CustodyTransaction } from "@/models";

export type SweepResult = { checked: number; flagged: number; alertsCreated: number; emailsSent: number; at: string };

type LoanRow = {
  _id: Types.ObjectId;
  dueAt: Date;
  checkoutAt: Date;
  asset: { _id: Types.ObjectId; assetTag: string; name: string; status: string } | null;
  borrower: { _id: Types.ObjectId; name: string; email: string } | null;
};

const g = globalThis as unknown as { _lastSweep?: SweepResult };
export const lastSweep = () => g._lastSweep ?? null;

// Overdue audit (run by staff from the dashboard or Alerts page): finds open
// loans past their due date, flags the asset as
// OVERDUE, and emails the borrower once per loan.
export async function runOverdueSweep(now = new Date()): Promise<SweepResult> {
  await connectDB();
  const loans = (await CustodyTransaction.find({ status: "ACTIVE", dueAt: { $lt: now } })
    .populate("asset", "assetTag name status")
    .populate("borrower", "name email")
    .lean()) as unknown as LoanRow[];

  let flagged = 0;
  let alertsCreated = 0;
  let emailsSent = 0;

  for (const loan of loans) {
    if (!loan.asset || !loan.borrower) continue;

    const res = await Asset.updateOne({ _id: loan.asset._id, status: "CHECKED_OUT" }, { $set: { status: "OVERDUE" } });
    if (res.modifiedCount) {
      flagged++;
      await writeAudit("STATUS_CHANGE", "Asset", loan.asset._id, null, { from: "CHECKED_OUT", to: "OVERDUE", by: "overdue sweep" });
    }

    if (await Alert.exists({ transaction: loan._id, type: "OVERDUE" })) continue;

    const daysLate = daysOverdue(loan.dueAt, now);
    const subject = `Overdue: ${loan.asset.name} (${loan.asset.assetTag})`;
    const body = [
      `Hi ${loan.borrower.name},`,
      "",
      `Our records show that ${loan.asset.name} (tag ${loan.asset.assetTag}), issued to you on ${fmtDate(loan.checkoutAt)}, was due back on ${fmtDate(loan.dueAt)} and is now ${daysLate} day${daysLate > 1 ? "s" : ""} overdue.`,
      "",
      "Please return it to the lab as soon as possible. If you have already returned it, contact the lab staff so the record can be updated.",
      "",
      "Smart Warehouse Tracker",
    ].join("\n");

    const alert = await Alert.create({
      type: "OVERDUE",
      asset: loan.asset._id,
      transaction: loan._id,
      user: loan.borrower._id,
      message: `${daysLate} day${daysLate > 1 ? "s" : ""} overdue`,
      emailTo: loan.borrower.email,
      emailSubject: subject,
      emailBody: body,
    });
    alertsCreated++;

    const r = await sendMail(loan.borrower.email, subject, body);
    if (r.ok) emailsSent++;
    await Alert.updateOne(
      { _id: alert._id },
      r.ok
        ? { $set: { emailStatus: "SENT", emailTransport: r.transport, sentAt: new Date() } }
        : { $set: { emailStatus: "FAILED", emailTransport: r.transport, emailError: r.error } },
    );
  }

  const result = { checked: loans.length, flagged, alertsCreated, emailsSent, at: now.toISOString() };
  g._lastSweep = result;
  return result;
}

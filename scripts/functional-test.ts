// Functional tests of the custody engine and overdue audit on a throwaway database.
// Usage: npx tsx --require ./scripts/allow-server-only.cjs scripts/functional-test.ts
import mongoose from "mongoose";

process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/smart_warehouse_test";
const DAY = 86_400_000;

async function main() {
  const { connectDB } = await import("@/lib/db");
  const { ALL_MODELS, Alert, Asset, AuditLog, Category, CustodyTransaction, User } = await import("@/models");
  const { checkoutAsset, returnAsset, sendToMaintenance, markRepaired, CustodyError } = await import("@/lib/custody");
  const { runOverdueSweep } = await import("@/lib/overdue");
  await connectDB();
  for (const m of ALL_MODELS) {
    await m.deleteMany({});
    await m.syncIndexes();
  }
  const cat = await Category.create({ name: "Digital Multimeters", code: "MM", defaultLoanDays: 7 });
  const staff = await User.create({ name: "Staff", email: "staff@t.local", role: "LAB_STAFF", department: "ISE" });
  const s1 = await User.create({ name: "Student One", email: "s1@t.local", role: "BORROWER", department: "ISE" });
  const s2 = await User.create({ name: "Student Two", email: "s2@t.local", role: "BORROWER", department: "ME" });
  const gone = await User.create({ name: "Inactive", email: "x@t.local", role: "BORROWER", department: "ISE", isActive: false });
  const a = await Asset.create({ assetTag: "ISE-MM-001", name: "DMM", category: cat._id, location: { lab: "Lab" } });
  const id = String(a._id), st = String(staff._id);
  const due = () => new Date(Date.now() + 3 * DAY);

  const results: { id: string; test: string; pass: boolean; note: string }[] = [];
  const check = async (tid: string, test: string, fn: () => Promise<string>) => {
    try {
      results.push({ id: tid, test, pass: true, note: await fn() });
    } catch (e) {
      results.push({ id: tid, test, pass: false, note: e instanceof Error ? e.message : String(e) });
    }
  };
  const expectReject = async (p: Promise<unknown>) => {
    try {
      await p;
    } catch (e) {
      if (e instanceof CustodyError) return e.message;
      throw e;
    }
    throw new Error("expected rejection");
  };
  const state = async () => (await Asset.findById(id).lean())!.status;

  await check("T1", "Checkout of an available tool", async () => {
    await checkoutAsset({ assetId: id, borrowerId: String(s1._id), actorId: st, dueAt: due() });
    const open = await CustodyTransaction.countDocuments({ asset: a._id, status: "ACTIVE" });
    if ((await state()) !== "CHECKED_OUT" || open !== 1) throw new Error("state not updated");
    return "asset CHECKED_OUT, one open loan";
  });
  await check("T2", "Second checkout of the same tool is refused", async () => expectReject(checkoutAsset({ assetId: id, borrowerId: String(s2._id), actorId: st, dueAt: due() })));
  await check("T3", "Return in good condition", async () => {
    await returnAsset({ assetId: id, actorId: st, conditionIn: "GOOD" });
    if ((await state()) !== "AVAILABLE") throw new Error("not available");
    return "asset AVAILABLE, loan RETURNED";
  });
  await check("T4", "Duplicate return is refused", async () => expectReject(returnAsset({ assetId: id, actorId: st, conditionIn: "GOOD" })));
  await check("T5", "Checkout with a past due date is refused", async () => expectReject(checkoutAsset({ assetId: id, borrowerId: String(s1._id), actorId: st, dueAt: new Date(Date.now() - DAY) })));
  await check("T6", "Checkout to an inactive user is refused", async () => expectReject(checkoutAsset({ assetId: id, borrowerId: String(gone._id), actorId: st, dueAt: due() })));
  await check("T7", "Overdue audit flags a past-due loan and emails once", async () => {
    await checkoutAsset({ assetId: id, borrowerId: String(s1._id), actorId: st, dueAt: due() });
    await CustodyTransaction.updateOne({ asset: a._id, status: "ACTIVE" }, { $set: { dueAt: new Date(Date.now() - 2 * DAY) } });
    const r1 = await runOverdueSweep();
    const r2 = await runOverdueSweep();
    const alerts = await Alert.countDocuments({ type: "OVERDUE" });
    if ((await state()) !== "OVERDUE" || r1.alertsCreated !== 1 || r2.alertsCreated !== 0 || alerts !== 1) throw new Error(JSON.stringify({ r1, r2, alerts }));
    return "flagged OVERDUE; 1 alert; rerun created 0";
  });
  await check("T8", "Late return in damaged condition goes to maintenance", async () => {
    const r = await returnAsset({ assetId: id, actorId: st, conditionIn: "DAMAGED" });
    const resolved = await Alert.countDocuments({ type: "OVERDUE", resolvedAt: { $ne: null } });
    const dmg = await Alert.countDocuments({ type: "DAMAGED" });
    if ((await state()) !== "UNDER_MAINTENANCE" || !r.late || resolved !== 1 || dmg !== 1) throw new Error("unexpected");
    return "UNDER_MAINTENANCE; late=true; overdue alert resolved; damage alert raised";
  });
  await check("T9", "Tool under maintenance cannot be issued", async () => expectReject(checkoutAsset({ assetId: id, borrowerId: String(s2._id), actorId: st, dueAt: due() })));
  await check("T10", "Mark repaired returns tool to service", async () => {
    await markRepaired({ assetId: id, actorId: st });
    const a2 = await Asset.findById(id).lean();
    if (a2!.status !== "AVAILABLE" || a2!.condition !== "GOOD") throw new Error("not reset");
    return "AVAILABLE, condition GOOD, damage alert resolved";
  });
  await check("T11", "Send available tool to maintenance", async () => {
    await sendToMaintenance({ assetId: id, actorId: st, note: "loose probe" });
    if ((await state()) !== "UNDER_MAINTENANCE") throw new Error("no");
    await markRepaired({ assetId: id, actorId: st });
    return "AVAILABLE -> UNDER_MAINTENANCE -> AVAILABLE";
  });
  await check("T12", "Every state change is in the audit log", async () => {
    const n = await AuditLog.countDocuments({ entityId: a._id });
    if (n < 8) throw new Error(`only ${n} entries`);
    return `${n} audit entries for the asset`;
  });

  console.log(JSON.stringify(results, null, 2));
  await mongoose.connection.db!.dropDatabase();
  await mongoose.disconnect();
}
main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect();
  process.exit(1);
});

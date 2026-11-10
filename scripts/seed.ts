// Seeds the local database with sample ISE lab data and builds all indexes.
// Usage: npm run seed   (WARNING: clears the six project collections first)
//
// Demo sign-ins (local development data only):
//   admin.iselab@example.com / admin123     (Admin)
//   staff.iselab@example.com / staff123     (Lab staff)
//   any student below        / student123   (Borrower)
import { config } from "dotenv";
import bcrypt from "bcryptjs";
import mongoose, { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { assetInput, categoryInput, userInput } from "@/lib/validation";
import { ALL_MODELS, Asset, AuditLog, Category, CustodyTransaction, User } from "@/models";

config({ path: ".env.local" });

const DAY = 86_400_000;
const daysAgo = (n: number, hour = 11) => {
  const d = new Date(Date.now() - n * DAY);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const categories = [
  { name: "Digital Multimeters", code: "MM", description: "Handheld DMMs for voltage, current and resistance", defaultLoanDays: 7 },
  { name: "Power Drills", code: "PD", description: "Cordless and corded drills", defaultLoanDays: 3 },
  { name: "Precision Gauges", code: "PG", description: "Vernier calipers, micrometers and dial gauges", defaultLoanDays: 7 },
  { name: "Oscilloscopes", code: "OS", description: "Bench and portable oscilloscopes", defaultLoanDays: 2 },
  { name: "Soldering Stations", code: "SS", description: "Temperature-controlled soldering stations", defaultLoanDays: 3 },
];

const users = [
  { name: "Lab In-charge", email: "admin.iselab@example.com", role: "ADMIN", department: "ISE", password: "admin123" },
  { name: "Lab Assistant", email: "staff.iselab@example.com", role: "LAB_STAFF", department: "ISE", password: "staff123" },
  { name: "Aarav Sharma", email: "aarav.s@example.com", role: "BORROWER", department: "ISE", rollNumber: "23IM10001", password: "student123" },
  { name: "Priya Nair", email: "priya.n@example.com", role: "BORROWER", department: "ISE", rollNumber: "23IM10002", password: "student123" },
  { name: "Sneha Patel", email: "sneha.p@example.com", role: "BORROWER", department: "ISE", rollNumber: "23IM10004", password: "student123" },
  { name: "Rohit Das", email: "rohit.d@example.com", role: "BORROWER", department: "ME", rollNumber: "23ME10003", password: "student123" },
  { name: "Karan Mehta", email: "karan.m@example.com", role: "BORROWER", department: "EE", rollNumber: "23EE10005", password: "student123" },
] as const;

const assets = [
  { assetTag: "ISE-MM-001", name: "Fluke 117 Digital Multimeter", categoryCode: "MM", manufacturer: "Fluke", serialNumber: "FL117-48213", location: { lab: "Industrial Automation Lab", shelf: "A1" }, purchaseCost: 18500, purchaseDate: "2023-07-14" },
  { assetTag: "ISE-MM-002", name: "Fluke 117 Digital Multimeter", categoryCode: "MM", manufacturer: "Fluke", serialNumber: "FL117-48214", location: { lab: "Industrial Automation Lab", shelf: "A1" }, purchaseCost: 18500, purchaseDate: "2023-07-14" },
  { assetTag: "ISE-MM-003", name: "Mastech MS8268 Multimeter", categoryCode: "MM", manufacturer: "Mastech", location: { lab: "Industrial Automation Lab", shelf: "A2" }, purchaseCost: 4200 },
  { assetTag: "ISE-MM-004", name: "Fluke 87V Industrial Multimeter", categoryCode: "MM", manufacturer: "Fluke", serialNumber: "FL87V-10932", location: { lab: "Industrial Automation Lab", shelf: "A2" }, purchaseCost: 46500, purchaseDate: "2024-01-22" },
  { assetTag: "ISE-PD-001", name: "Bosch GSB 18V Cordless Drill", categoryCode: "PD", manufacturer: "Bosch", location: { lab: "Manufacturing Workshop", shelf: "T3" }, purchaseCost: 12900 },
  { assetTag: "ISE-PD-002", name: "Makita HP1630 Impact Drill", categoryCode: "PD", manufacturer: "Makita", location: { lab: "Manufacturing Workshop", shelf: "T3" }, purchaseCost: 6800, condition: "FAIR" },
  { assetTag: "ISE-PD-003", name: "Bosch GBM 13 RE Rotary Drill", categoryCode: "PD", manufacturer: "Bosch", location: { lab: "Manufacturing Workshop", shelf: "T4" }, purchaseCost: 4300 },
  { assetTag: "ISE-PG-001", name: "Mitutoyo Digital Vernier Caliper 150 mm", categoryCode: "PG", manufacturer: "Mitutoyo", location: { lab: "Metrology Lab", shelf: "M1" }, purchaseCost: 9800 },
  { assetTag: "ISE-PG-002", name: "Mitutoyo Outside Micrometer 0-25 mm", categoryCode: "PG", manufacturer: "Mitutoyo", location: { lab: "Metrology Lab", shelf: "M1" }, purchaseCost: 7600 },
  { assetTag: "ISE-PG-003", name: "Baker Dial Gauge 0-10 mm", categoryCode: "PG", manufacturer: "Baker", location: { lab: "Metrology Lab", shelf: "M2" }, purchaseCost: 3100, status: "UNDER_MAINTENANCE", condition: "DAMAGED", notes: "Plunger sticking, sent for calibration" },
  { assetTag: "ISE-PG-004", name: "Mitutoyo Dial Bore Gauge 18-35 mm", categoryCode: "PG", manufacturer: "Mitutoyo", location: { lab: "Metrology Lab", shelf: "M2" }, purchaseCost: 21400 },
  { assetTag: "ISE-OS-001", name: "Rigol DS1054Z Oscilloscope", categoryCode: "OS", manufacturer: "Rigol", location: { lab: "Industrial Automation Lab", shelf: "B1" }, purchaseCost: 38000 },
  { assetTag: "ISE-OS-002", name: "Keysight DSOX1204G Oscilloscope", categoryCode: "OS", manufacturer: "Keysight", location: { lab: "Industrial Automation Lab", shelf: "B1" }, purchaseCost: 112000 },
  { assetTag: "ISE-SS-001", name: "Weller WE1010 Soldering Station", categoryCode: "SS", manufacturer: "Weller", location: { lab: "Industrial Automation Lab", shelf: "C2" }, purchaseCost: 11500 },
  { assetTag: "ISE-SS-002", name: "Hakko FX-888D Soldering Station", categoryCode: "SS", manufacturer: "Hakko", location: { lab: "Industrial Automation Lab", shelf: "C2" }, purchaseCost: 14200 },
];

// [tag, borrower email, checked out N days ago, loan days, returned N days ago | null, condition in]
const history: [string, string, number, number, number | null, ("GOOD" | "FAIR" | "DAMAGED")?][] = [
  ["ISE-MM-001", "aarav.s@example.com", 13, 7, 8, "GOOD"],
  ["ISE-PD-001", "rohit.d@example.com", 12, 3, 10, "GOOD"],
  ["ISE-PG-001", "priya.n@example.com", 11, 7, 6, "GOOD"],
  ["ISE-OS-001", "sneha.p@example.com", 10, 2, 9, "GOOD"],
  ["ISE-PG-003", "karan.m@example.com", 9, 7, 4, "DAMAGED"],
  ["ISE-MM-003", "priya.n@example.com", 8, 7, 3, "GOOD"],
  ["ISE-SS-001", "aarav.s@example.com", 7, 3, 3, "GOOD"],
  ["ISE-PD-002", "rohit.d@example.com", 6, 3, 2, "FAIR"],
  ["ISE-PG-004", "sneha.p@example.com", 5, 7, 1, "GOOD"],
  ["ISE-OS-002", "karan.m@example.com", 4, 2, 3, "GOOD"],
  // Still out
  ["ISE-MM-002", "aarav.s@example.com", 10, 7, null], // 3 days past due
  ["ISE-MM-004", "sneha.p@example.com", 12, 7, null], // 5 days past due
  ["ISE-PD-001", "rohit.d@example.com", 5, 3, null], // 2 days past due
  ["ISE-OS-001", "priya.n@example.com", 1, 2, null], // due tomorrow
  ["ISE-PG-001", "priya.n@example.com", 0, 7, null], // due next week
  ["ISE-SS-002", "karan.m@example.com", 2, 3, null], // due tomorrow
];

async function main() {
  await connectDB();
  console.log(`Connected to ${mongoose.connection.name}`);

  for (const m of ALL_MODELS) {
    await m.deleteMany({});
    await m.syncIndexes(); // creates the collection and every index declared in the schema
  }

  const cats = await Category.insertMany(categories.map((c) => categoryInput.parse(c)));
  const catId = new Map(cats.map((c) => [c.code, c._id]));

  const userDocs = await User.insertMany(
    await Promise.all(
      users.map(async ({ password, ...u }) => ({ ...userInput.parse(u), passwordHash: await bcrypt.hash(password, 10) })),
    ),
  );
  const userId = new Map(userDocs.map((u) => [u.email, u._id]));
  const staffId = userId.get("staff.iselab@example.com")!;
  const adminId = userId.get("admin.iselab@example.com")!;

  const assetDocs = await Asset.insertMany(
    assets.map((raw) => {
      const { categoryCode, ...a } = assetInput.parse(raw);
      const category = catId.get(categoryCode);
      if (!category) throw new Error(`Unknown category ${categoryCode} for ${a.assetTag}`);
      return { ...a, category };
    }),
  );
  const assetId = new Map(assetDocs.map((a) => [a.assetTag, a._id]));

  const audit: Record<string, unknown>[] = assetDocs.map((a) => ({
    action: "CREATE", entityType: "Asset", entityId: a._id, actor: adminId, changes: { assetTag: a.assetTag }, at: daysAgo(30),
  }));

  for (const [tag, email, outAgo, loanDays, backAgo, condIn] of history) {
    const asset = assetId.get(tag)!;
    const borrower = userId.get(email)!;
    const checkoutAt = daysAgo(outAgo, 10 + (outAgo % 5));
    const dueAt = new Date(checkoutAt.getTime() + loanDays * DAY);
    dueAt.setHours(18, 0, 0, 0);
    const returnedAt = backAgo === null ? null : daysAgo(backAgo, 16);
    const txn = await CustodyTransaction.create({
      asset, borrower, issuedBy: staffId, checkoutAt, dueAt, returnedAt,
      conditionOut: "GOOD", conditionIn: condIn, status: returnedAt ? "RETURNED" : "ACTIVE",
    });
    const name = userDocs.find((u) => u._id.equals(borrower))!.name;
    audit.push({ action: "CHECKOUT", entityType: "Asset", entityId: asset, actor: staffId, changes: { borrower: name, dueAt, transaction: txn._id }, at: checkoutAt });
    if (returnedAt) {
      audit.push({ action: "CHECKIN", entityType: "Asset", entityId: asset, actor: staffId, changes: { transaction: txn._id, conditionIn: condIn, late: returnedAt > dueAt }, at: returnedAt });
    } else {
      // Open loan: asset is checked out. The overdue audit flags past-due ones as OVERDUE.
      await Asset.updateOne({ _id: asset }, { $set: { status: "CHECKED_OUT", currentCustodian: borrower, currentTransaction: txn._id } });
    }
  }
  await AuditLog.insertMany(audit.map((a) => ({ ...a, entityId: new Types.ObjectId(String(a.entityId)) })));

  for (const m of ALL_MODELS) {
    const n = await m.countDocuments();
    const idx = await m.collection.indexes();
    console.log(`${m.collection.collectionName.padEnd(22)} ${String(n).padStart(3)} docs  ${idx.length} indexes`);
  }
}

main()
  .then(() => mongoose.disconnect())
  .catch(async (err) => {
    console.error(err);
    await mongoose.disconnect();
    process.exit(1);
  });

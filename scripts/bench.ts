// Performance and correctness benchmark on synthetic data.
// Uses a SEPARATE database (smart_warehouse_bench) so demo data is untouched.
// Usage: npx tsx --require ./scripts/allow-server-only.cjs scripts/bench.ts [sizes...] > bench.json
import mongoose, { Types } from "mongoose";

process.env.MONGODB_URI = process.env.BENCH_URI ?? "mongodb://127.0.0.1:27017/smart_warehouse_bench";

const DAY = 86_400_000;
const sizes = process.argv.slice(2).map(Number).filter(Boolean);
const SIZES = sizes.length ? sizes : [100, 1000, 10000];

function stats(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { n: s.length, mean: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(2), p50: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), max: +s[s.length - 1].toFixed(2) };
}
async function time<T>(fn: () => Promise<T>) {
  const t = performance.now();
  const r = await fn();
  return { ms: performance.now() - t, r };
}

async function main() {
  const { connectDB } = await import("@/lib/db");
  const { ALL_MODELS, Asset, Category, CustodyTransaction, User } = await import("@/models");
  const { runSearch } = await import("@/lib/search");
  const { getDashboard, listAssets } = await import("@/lib/queries");
  const { checkoutAsset, returnAsset, CustodyError } = await import("@/lib/custody");
  const { runOverdueSweep } = await import("@/lib/overdue");

  await connectDB();
  const results: Record<string, unknown>[] = [];

  for (const N of SIZES) {
    for (const m of ALL_MODELS) {
      await m.deleteMany({});
      await m.syncIndexes();
    }
    // ---- synthetic data ------------------------------------------------
    const codes = ["MM", "PD", "PG", "OS", "SS"];
    const cats = await Category.insertMany(codes.map((c, i) => ({ name: `Category ${c}`, code: c, defaultLoanDays: 3 + i })));
    const depts = ["ISE", "ME", "EE", "CSE", "CE"];
    const nUsers = Math.max(50, Math.round(N / 5));
    const users = await User.insertMany(
      Array.from({ length: nUsers }, (_, i) => ({
        name: `Student ${i}`, email: `s${i}@bench.local`, role: i < 3 ? "LAB_STAFF" : "BORROWER", department: depts[i % depts.length],
      })),
    );
    const labs = ["Industrial Automation Lab", "Metrology Lab", "Manufacturing Workshop"];
    const makers = ["Fluke", "Bosch", "Mitutoyo", "Rigol", "Weller"];
    const assets = await Asset.insertMany(
      Array.from({ length: N }, (_, i) => ({
        assetTag: `ISE-${codes[i % 5]}-${String(i + 1).padStart(5, "0")}`, name: `Tool ${i}`, category: cats[i % 5]._id,
        manufacturer: makers[i % 5], location: { lab: labs[i % 3] }, condition: "GOOD", status: "AVAILABLE",
      })),
      { lean: true },
    );
    const now = Date.now();
    const staff = users[0]._id;
    // 3 returned loans per asset of history
    const hist = [];
    for (let i = 0; i < N * 3; i++) {
      const out = now - (5 + (i % 60)) * DAY;
      hist.push({ asset: assets[i % N]._id, borrower: users[3 + (i % (nUsers - 3))]._id, issuedBy: staff, checkoutAt: new Date(out), dueAt: new Date(out + 7 * DAY), returnedAt: new Date(out + 5 * DAY), status: "RETURNED", conditionOut: "GOOD", conditionIn: "GOOD" });
    }
    for (let i = 0; i < hist.length; i += 5000) await CustodyTransaction.insertMany(hist.slice(i, i + 5000), { lean: true });
    // 30% of assets currently out; a third of those past due
    const outCount = Math.round(N * 0.3);
    const active = [];
    for (let i = 0; i < outCount; i++) {
      const pastDue = i % 3 === 0;
      const out = now - (pastDue ? 10 : 1) * DAY;
      active.push({ asset: assets[i]._id, borrower: users[3 + (i % (nUsers - 3))]._id, issuedBy: staff, checkoutAt: new Date(out), dueAt: new Date(out + (pastDue ? 5 : 4) * DAY), status: "ACTIVE", conditionOut: "GOOD" });
    }
    const act = await CustodyTransaction.insertMany(active, { lean: true });
    await Asset.bulkWrite(act.map((t) => ({ updateOne: { filter: { _id: t.asset }, update: { $set: { status: "CHECKED_OUT", currentCustodian: t.borrower, currentTransaction: t._id } } } })));
    const pastDueCount = Math.ceil(outCount / 3);

    // ---- read paths -----------------------------------------------------
    const queries = [
      "Show all multimeters checked out by ISE students overdue by 3 days",
      "How many tools are available in the metrology lab?",
      "Which drills are overdue?",
      "Tools due this week",
      "Fluke tools issued in the last 7 days",
    ];
    await runSearch(queries[0]); // warm vocabulary cache
    const search: number[] = [];
    const searchRows: Record<string, number> = {};
    for (let k = 0; k < 20; k++)
      for (const q of queries) {
        const { ms, r } = await time(() => runSearch(q));
        search.push(ms);
        searchRows[q] = r.rows.length;
      }
    const dash: number[] = [];
    for (let k = 0; k < 20; k++) dash.push((await time(() => getDashboard())).ms);
    const list: number[] = [];
    for (let k = 0; k < 10; k++) list.push((await time(() => listAssets())).ms);

    // ---- write paths: checkout + return cycles ----------------------------
    const co: number[] = [], rt: number[] = [];
    const free = assets.slice(outCount, outCount + 100);
    for (const a of free) {
      const id = String(a._id);
      co.push((await time(() => checkoutAsset({ assetId: id, borrowerId: String(users[5]._id), actorId: String(staff), dueAt: new Date(Date.now() + 3 * DAY) }))).ms);
      rt.push((await time(() => returnAsset({ assetId: id, actorId: String(staff), conditionIn: "GOOD" }))).ms);
    }

    // ---- concurrency: 50 simultaneous checkouts of one asset ----------------
    const races = [];
    for (let trial = 0; trial < 10; trial++) {
      const a = String(assets[N - 1 - trial]._id); // available (returned) assets at the end of the list
      const settled = await Promise.allSettled(
        Array.from({ length: 50 }, (_, i) => checkoutAsset({ assetId: a, borrowerId: String(users[3 + (i % (nUsers - 3))]._id), actorId: String(staff), dueAt: new Date(Date.now() + DAY) })),
      );
      const ok = settled.filter((s) => s.status === "fulfilled").length;
      const rejectedCleanly = settled.filter((s) => s.status === "rejected" && s.reason instanceof CustodyError).length;
      const open = await CustodyTransaction.countDocuments({ asset: new Types.ObjectId(a), status: "ACTIVE" });
      races.push({ ok, rejectedCleanly, openLoans: open });
    }

    // ---- overdue sweep: first run (alerts + emails) and idempotent re-run ----
    const sweep1 = await time(() => runOverdueSweep());
    const sweep2 = await time(() => runOverdueSweep());

    // ---- index effect on the sweep query --------------------------------
    const sweepFilter = { status: "ACTIVE" as const, dueAt: { $lt: new Date() } };
    const withIdx = await CustodyTransaction.find(sweepFilter).explain("executionStats") as unknown as { executionStats: { totalDocsExamined: number; totalKeysExamined: number; executionTimeMillis: number } };
    const noIdx = await CustodyTransaction.find(sweepFilter).hint({ $natural: 1 }).explain("executionStats") as unknown as { executionStats: { totalDocsExamined: number; totalKeysExamined: number; executionTimeMillis: number } };

    results.push({
      assets: N, users: nUsers, transactions: N * 3 + outCount, activeLoans: outCount, pastDue: pastDueCount,
      searchMs: stats(search), searchRows, dashboardMs: stats(dash), listAssetsMs: stats(list),
      checkoutMs: stats(co), returnMs: stats(rt),
      race: { trials: races.length, attemptsPerTrial: 50, allExactlyOne: races.every((r) => r.ok === 1 && r.openLoans === 1 && r.rejectedCleanly === 49), detail: races },
      sweep: { firstMs: +sweep1.ms.toFixed(1), first: sweep1.r, rerunMs: +sweep2.ms.toFixed(1), rerun: sweep2.r },
      sweepQuery: {
        withIndex: { docsExamined: withIdx.executionStats.totalDocsExamined, keysExamined: withIdx.executionStats.totalKeysExamined, ms: withIdx.executionStats.executionTimeMillis },
        collectionScan: { docsExamined: noIdx.executionStats.totalDocsExamined, keysExamined: noIdx.executionStats.totalKeysExamined, ms: noIdx.executionStats.executionTimeMillis },
      },
    });
    console.error(`done N=${N}`);
  }
  console.log(JSON.stringify(results, null, 2));
  await mongoose.connection.db!.dropDatabase();
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect();
  process.exit(1);
});

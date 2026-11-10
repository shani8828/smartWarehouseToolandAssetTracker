// Evaluates the natural-language query parser against a hand-labelled test set.
// Usage: npx tsx scripts/nlq-eval.ts [--json]
//
// Each query is labelled with the slots a correct parse must produce. A slot
// is a (field, value) pair, e.g. ("category", "MM") or ("status", "OVERDUE").
// We report slot-level precision/recall/F1 and the share of queries parsed
// with every slot exactly right.
import { parseQuery, type Interpretation, type Vocab } from "@/lib/nlq";

const vocab: Vocab = {
  categories: [
    { id: "MM", name: "Digital Multimeters", code: "MM" },
    { id: "PD", name: "Power Drills", code: "PD" },
    { id: "PG", name: "Precision Gauges", code: "PG" },
    { id: "OS", name: "Oscilloscopes", code: "OS" },
    { id: "SS", name: "Soldering Stations", code: "SS" },
  ],
  departments: ["ISE", "ME", "EE"],
  labs: ["Industrial Automation Lab", "Metrology Lab", "Manufacturing Workshop"],
  manufacturers: ["Fluke", "Mastech", "Bosch", "Makita", "Mitutoyo", "Baker", "Rigol", "Keysight", "Weller", "Hakko"],
  people: [
    { id: "aarav", name: "Aarav Sharma" },
    { id: "priya", name: "Priya Nair" },
    { id: "sneha", name: "Sneha Patel" },
    { id: "rohit", name: "Rohit Das" },
    { id: "karan", name: "Karan Mehta" },
  ],
};

type Gold = {
  cat?: string[];
  status?: string[]; // AVAILABLE | OUT | MAINT  (OUT = checked out incl. overdue)
  overdue?: number | true; // true = overdue, number = overdue by >= N days
  cond?: string[];
  dept?: string[];
  role?: "BORROWER" | "LAB_STAFF";
  person?: string[];
  lab?: string[];
  make?: string[];
  count?: true;
  due?: string; // today | tomorrow | week | Nd
  issued?: string; // today | yesterday | week | Nd
};

const TESTS: [string, Gold][] = [
  // Report examples and close paraphrases
  ["Show all multimeters checked out by ISE students overdue by 3 days", { cat: ["MM"], overdue: 3, dept: ["ISE"], role: "BORROWER" }],
  ["Which drills are overdue?", { cat: ["PD"], overdue: true }],
  ["How many tools are available in the metrology lab?", { count: true, status: ["AVAILABLE"], lab: ["Metrology Lab"] }],
  ["Tools due this week", { due: "week" }],
  ["What does Priya have?", { person: ["priya"] }],
  ["Damaged gauges under maintenance", { cat: ["PG"], status: ["MAINT"], cond: ["DAMAGED"] }],
  ["Fluke tools issued in the last 7 days", { make: ["Fluke"], issued: "7d", status: ["OUT"] }],
  // Category and status
  ["available oscilloscopes", { cat: ["OS"], status: ["AVAILABLE"] }],
  ["list soldering stations that are free", { cat: ["SS"], status: ["AVAILABLE"] }],
  ["which calipers are checked out", { cat: ["PG"], status: ["OUT"] }],
  ["scopes in use right now", { cat: ["OS"], status: ["OUT"] }],
  ["drills under repair", { cat: ["PD"], status: ["MAINT"] }],
  ["tools in calibration", { status: ["MAINT"] }],
  ["all borrowed multimeters", { cat: ["MM"], status: ["OUT"] }],
  ["micrometers on the shelf", { cat: ["PG"], status: ["AVAILABLE"] }],
  ["show me every vernier caliper", { cat: ["PG"] }],
  ["dmm and oscilloscope availability", { cat: ["MM", "OS"] }],
  ["broken drills", { cat: ["PD"], cond: ["DAMAGED"] }],
  ["tools in fair condition", { cond: ["FAIR"] }],
  // Overdue and time
  ["late tools", { overdue: true }],
  ["items not returned", { overdue: true }],
  ["overdue by more than 2 days", { overdue: 2 }],
  ["tools 5 days overdue", { overdue: 5 }],
  ["anything late by a week", { overdue: 7 }],
  ["what is due today", { due: "today" }],
  ["tools due tomorrow", { due: "tomorrow" }],
  ["due in 3 days", { due: "3d" }],
  ["tools checked out today", { issued: "today", status: ["OUT"] }],
  ["issued yesterday", { issued: "yesterday", status: ["OUT"] }],
  ["borrowed in the past 14 days", { issued: "14d", status: ["OUT"] }],
  ["drills taken this week", { cat: ["PD"], issued: "week", status: ["OUT"] }],
  // People, departments, roles
  ["tools with Aarav", { person: ["aarav"] }],
  ["what has rohit borrowed", { person: ["rohit"], status: ["OUT"] }],
  ["Karan's tools", { person: ["karan"] }],
  ["tools held by ME students", { dept: ["ME"], role: "BORROWER" }],
  ["overdue items of EE department", { overdue: true, dept: ["EE"] }],
  ["what are ISE students holding", { dept: ["ISE"], role: "BORROWER" }],
  ["tools issued to staff", { role: "LAB_STAFF", status: ["OUT"] }],
  ["Sneha overdue", { person: ["sneha"], overdue: true }],
  // Location and make
  ["everything in the manufacturing workshop", { lab: ["Manufacturing Workshop"] }],
  ["available tools in automation lab", { status: ["AVAILABLE"], lab: ["Industrial Automation Lab"] }],
  ["Mitutoyo gauges", { make: ["Mitutoyo"], cat: ["PG"] }],
  ["bosch drills checked out", { make: ["Bosch"], cat: ["PD"], status: ["OUT"] }],
  ["keysight scope", { make: ["Keysight"], cat: ["OS"] }],
  // Counting
  ["how many multimeters are overdue", { count: true, cat: ["MM"], overdue: true }],
  ["count of drills in maintenance", { count: true, cat: ["PD"], status: ["MAINT"] }],
  ["total tools checked out", { count: true, status: ["OUT"] }],
  // Typos
  ["multimter overdue", { cat: ["MM"], overdue: true }],
  ["osciloscopes available", { cat: ["OS"], status: ["AVAILABLE"] }],
  ["metrolgy lab tools", { lab: ["Metrology Lab"] }],
];


// Held-out set: written after the parser fixes and never used to tune it.
const HELDOUT: [string, Gold][] = [
  ["are any oscilloscopes free right now", { cat: ["OS"], status: ["AVAILABLE"] }],
  ["list every tool Sneha borrowed", { person: ["sneha"], status: ["OUT"] }],
  ["how many gauges are broken", { count: true, cat: ["PG"], cond: ["DAMAGED"] }],
  ["soldering irons due tomorrow", { cat: ["SS"], due: "tomorrow" }],
  ["tools overdue for 10 days", { overdue: 10 }],
  ["which Makita drills are in use", { make: ["Makita"], cat: ["PD"], status: ["OUT"] }],
  ["EE students with overdue tools", { dept: ["EE"], role: "BORROWER", overdue: true }],
  ["number of multimeters in the automation lab", { count: true, cat: ["MM"], lab: ["Industrial Automation Lab"] }],
  ["items under servicing", { status: ["MAINT"] }],
  ["what did Karan take out", { person: ["karan"], status: ["OUT"] }],
  ["calipers issued in the last 3 days", { cat: ["PG"], issued: "3d", status: ["OUT"] }],
  ["tools late by two weeks", { overdue: 14 }],
  ["rigol scopes", { make: ["Rigol"], cat: ["OS"] }],
  ["anything due within 2 days", { due: "2d" }],
  ["idle drills in the workshop", { cat: ["PD"], status: ["AVAILABLE"], lab: ["Manufacturing Workshop"] }],
  ["count overdue tools", { count: true, overdue: true }],
  ["micrometres available", { cat: ["PG"], status: ["AVAILABLE"] }],
  ["tools in poor condition", { cond: ["DAMAGED"] }],
  ["what is Aarav holding that is overdue", { person: ["aarav"], overdue: true }],
  ["ME department tools", { dept: ["ME"] }],
];

function slotsFromGold(g: Gold): Set<string> {
  const s = new Set<string>();
  g.cat?.forEach((c) => s.add(`cat=${c}`));
  g.status?.forEach((x) => s.add(`status=${x}`));
  if (g.overdue !== undefined) s.add(`overdue=${g.overdue === true ? "yes" : g.overdue}`);
  g.cond?.forEach((c) => s.add(`cond=${c}`));
  g.dept?.forEach((d) => s.add(`dept=${d}`));
  if (g.role) s.add(`role=${g.role}`);
  g.person?.forEach((p) => s.add(`person=${p}`));
  g.lab?.forEach((l) => s.add(`lab=${l}`));
  g.make?.forEach((m) => s.add(`make=${m}`));
  if (g.count) s.add("count=yes");
  if (g.due) s.add(`due=${g.due}`);
  if (g.issued) s.add(`issued=${g.issued}`);
  return s;
}

function slotsFromParse(r: Interpretation): Set<string> {
  const s = new Set<string>();
  r.categoryIds.forEach((c) => s.add(`cat=${c}`));
  const st = new Set(r.statuses);
  if (st.has("AVAILABLE")) s.add("status=AVAILABLE");
  if (st.has("CHECKED_OUT")) s.add("status=OUT");
  if (st.has("UNDER_MAINTENANCE")) s.add("status=MAINT");
  if (r.overdue) s.add(`overdue=${r.overdueByDays ?? "yes"}`);
  r.conditions.forEach((c) => s.add(`cond=${c}`));
  r.borrowerDepartments.forEach((d) => s.add(`dept=${d}`));
  if (r.borrowerRole) s.add(`role=${r.borrowerRole}`);
  r.borrowerIds.forEach((p) => s.add(`person=${p}`));
  r.labs.forEach((l) => s.add(`lab=${l}`));
  r.manufacturers.forEach((m) => s.add(`make=${m}`));
  if (r.intent === "count") s.add("count=yes");
  if (r.due) {
    const l = r.due.label;
    s.add(`due=${/today/.test(l) ? "today" : /tomorrow/.test(l) ? "tomorrow" : /week/.test(l) ? "week" : (l.match(/(\d+)/)?.[1] ?? "?") + "d"}`);
  }
  if (r.checkedOut) {
    const l = r.checkedOut.label;
    s.add(`issued=${/today/.test(l) ? "today" : /yesterday/.test(l) ? "yesterday" : (l.match(/(\d+)/)?.[1] ?? "?") + "d"}`.replace("issued=7d", /week/.test(l) || l.includes("7") ? "issued=7d" : "issued=7d"));
  }
  return s;
}

// "this week" for issued normalises to the same 7-day window
const norm = (s: string) => s.replace("issued=week", "issued=7d");

let tp = 0, fp = 0, fn = 0, exact = 0;
const failures: { q: string; missing: string[]; extra: string[] }[] = [];
const t0 = performance.now();
const SET = process.argv.includes("--heldout") ? HELDOUT : TESTS;
for (const [q, gold] of SET) {
  const g = new Set([...slotsFromGold(gold)].map(norm));
  const p = new Set([...slotsFromParse(parseQuery(q, vocab))].map(norm));
  const missing = [...g].filter((x) => !p.has(x));
  const extra = [...p].filter((x) => !g.has(x));
  tp += g.size - missing.length;
  fn += missing.length;
  fp += extra.length;
  if (!missing.length && !extra.length) exact++;
  else failures.push({ q, missing, extra });
}
const parseMs = (performance.now() - t0) / SET.length;

const precision = tp / (tp + fp);
const recall = tp / (tp + fn);
const f1 = (2 * precision * recall) / (precision + recall);
const out = { queries: SET.length, slots: tp + fn, tp, fp, fn, precision, recall, f1, exactMatch: exact / SET.length, exact, parseMsPerQuery: parseMs, failures };

if (process.argv.includes("--json")) console.log(JSON.stringify(out, null, 2));
else {
  console.log(`queries ${out.queries}, gold slots ${out.slots}`);
  console.log(`precision ${(precision * 100).toFixed(1)}%  recall ${(recall * 100).toFixed(1)}%  F1 ${(f1 * 100).toFixed(1)}%`);
  console.log(`exact match ${exact}/${SET.length} (${((exact / SET.length) * 100).toFixed(1)}%), parse ${parseMs.toFixed(3)} ms/query`);
  for (const f of failures) console.log(`  x ${f.q}\n      missing: ${f.missing.join(", ") || "-"}   extra: ${f.extra.join(", ") || "-"}`);
}

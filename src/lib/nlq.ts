// Lightweight natural-language -> MongoDB query parser.
//
// Pipeline: normalise text -> tokenise -> match tokens/phrases against a
// vocabulary built from the live database (categories, departments, labs,
// manufacturers, people) plus fixed lexicons for status, condition and time,
// with edit-distance fuzzy matching for typos -> structured Interpretation ->
// MongoDB aggregation pipeline over `assets`.
//
// Pure functions only (no DB access) so it is fast and easy to unit test.

import type { AssetStatus, Condition, Role } from "./constants";

export type Vocab = {
  categories: { id: string; name: string; code: string }[];
  departments: string[];
  labs: string[];
  manufacturers: string[];
  people: { id: string; name: string }[];
};

export type TimeRange = { from?: Date; to?: Date; label: string };

export type Interpretation = {
  intent: "list" | "count";
  categoryIds: string[];
  statuses: AssetStatus[];
  overdue: boolean;
  overdueByDays?: number;
  conditions: Condition[];
  borrowerDepartments: string[];
  borrowerRole?: Role;
  borrowerIds: string[];
  labs: string[];
  manufacturers: string[];
  due?: TimeRange;
  checkedOut?: TimeRange;
  chips: { kind: string; label: string }[];
  understood: boolean;
};

const DAY = 86_400_000;

const CATEGORY_SYNONYMS: Record<string, string[]> = {
  MM: ["multimeter", "multimeters", "dmm", "dmms", "meter", "meters"],
  PD: ["drill", "drills", "driller"],
  PG: ["gauge", "gauges", "gage", "caliper", "calipers", "calliper", "vernier", "verniers", "micrometer", "micrometers", "dial"],
  OS: ["oscilloscope", "oscilloscopes", "scope", "scopes", "cro", "dso"],
  SS: ["soldering", "solder", "iron", "irons"],
};

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fourteen: 14, fifteen: 15, twenty: 20, thirty: 30, a: 1, an: 1,
};

const STOPWORDS = new Set(
  "show me all the list find get give display which what are is was were with of for in on at to by from that have has been being any every please tools tool items item assets asset equipment equipments do does i we our currently right now by who whose there their them it its and or".split(" "),
);

// Damerau-free Levenshtein, early exit once over the limit
function editDistance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

const fuzzyEq = (token: string, word: string) =>
  token === word || (token.length >= 5 && word.length >= 5 && editDistance(token, word, token.length >= 8 ? 2 : 1) <= (token.length >= 8 ? 2 : 1));

function toNumber(s: string | undefined) {
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : NUMBER_WORDS[s];
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function parseQuery(raw: string, vocab: Vocab, now = new Date()): Interpretation {
  const cleaned = raw.replace(/[’']s\b/gi, "").replace(/[^A-Za-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
  const text = cleaned.toLowerCase();
  const tokens = text.split(" ").filter(Boolean);
  const original = cleaned.split(" ").filter(Boolean); // same positions, original case
  const used = new Set<number>();
  const mark = (re: RegExp) => {
    // mark tokens covered by a phrase match so they are not reused
    const m = re.exec(text);
    if (!m) return null;
    const before = text.slice(0, m.index).split(" ").filter(Boolean).length;
    const len = m[0].trim().split(" ").filter(Boolean).length;
    for (let i = before; i < before + len; i++) used.add(i);
    return m;
  };

  const r: Interpretation = {
    intent: "list",
    categoryIds: [],
    statuses: [],
    overdue: false,
    conditions: [],
    borrowerDepartments: [],
    borrowerIds: [],
    labs: [],
    manufacturers: [],
    chips: [],
    understood: false,
  };
  const chip = (kind: string, label: string) => r.chips.push({ kind, label });

  // Intent
  if (mark(/\b(how many|count of|count|number of|total)\b/)) {
    r.intent = "count";
    chip("Intent", "Count");
  }

  // Overdue, with optional "by N days"
  const od =
    mark(/\b(?:overdue|late)\s+(?:by\s+|for\s+)?(?:more than\s+|over\s+|at least\s+)?(\d+|[a-z]+)\s+(days?|weeks?)\b/) ??
    mark(/\b(\d+|[a-z]+)\s+(days?|weeks?)\s+(?:overdue|late)\b/);
  const odN = toNumber(od?.[1]);
  const odDays = odN && od?.[2].startsWith("week") ? odN * 7 : odN;
  if (od && odDays) {
    r.overdue = true;
    r.overdueByDays = odDays;
    chip("Status", `Overdue by ${odDays}+ day${odDays > 1 ? "s" : ""}`);
  } else if (mark(/\b(overdue|late|past due|not returned|pending return|delayed)\b/)) {
    r.overdue = true;
    chip("Status", "Overdue");
  }

  // Due dates
  const dueIn = mark(/\bdue\s+(?:in|within)\s+(?:the\s+next\s+)?(\d+|[a-z]+)\s+days?\b/);
  const dueN = toNumber(dueIn?.[1]);
  if (dueIn && dueN) r.due = { from: now, to: new Date(now.getTime() + dueN * DAY), label: `Due within ${dueN} days` };
  else if (mark(/\bdue\s+today\b/)) r.due = { from: startOfDay(now), to: new Date(startOfDay(now).getTime() + DAY), label: "Due today" };
  else if (mark(/\bdue\s+tomorrow\b/))
    r.due = { from: new Date(startOfDay(now).getTime() + DAY), to: new Date(startOfDay(now).getTime() + 2 * DAY), label: "Due tomorrow" };
  else if (mark(/\bdue\s+(?:this|within a|in a)\s+week\b/)) r.due = { from: now, to: new Date(now.getTime() + 7 * DAY), label: "Due this week" };
  if (r.due) chip("Due", r.due.label);

  // Checked-out time window
  const outWord = "(?:checked out|issued|borrowed|taken|lent)";
  const lastN = mark(new RegExp(`\\b${outWord}\\s+(?:in\\s+)?(?:the\\s+)?(?:last|past)\\s+(\\d+|[a-z]+)\\s+days?\\b`));
  const lastNd = toNumber(lastN?.[1]);
  if (lastN && lastNd) r.checkedOut = { from: new Date(now.getTime() - lastNd * DAY), label: `Issued in last ${lastNd} days` };
  else if (mark(new RegExp(`\\b${outWord}\\s+today\\b`))) r.checkedOut = { from: startOfDay(now), label: "Issued today" };
  else if (mark(new RegExp(`\\b${outWord}\\s+yesterday\\b`)))
    r.checkedOut = { from: new Date(startOfDay(now).getTime() - DAY), to: startOfDay(now), label: "Issued yesterday" };
  else if (mark(new RegExp(`\\b${outWord}\\s+(?:this|last|past)\\s+week\\b`)))
    r.checkedOut = { from: new Date(now.getTime() - 7 * DAY), label: "Issued in last 7 days" };
  if (r.checkedOut) chip("Issued", r.checkedOut.label);

  // Status words
  if (mark(/\b(available|free|in stock|idle|unused|not in use|on the shelf|on shelf)\b/)) {
    r.statuses.push("AVAILABLE");
    chip("Status", "Available");
  }
  if (mark(/\b(checked out|check out|issued|borrowed|in use|lent|taken out|out)\b/) || r.checkedOut) {
    if (!r.overdue) {
      r.statuses.push("CHECKED_OUT", "OVERDUE");
      if (!r.checkedOut) chip("Status", "Checked out");
    }
  }
  if (mark(/\b(under maintenance|maintenance|repair|under repair|servicing|calibration|being fixed)\b/)) {
    r.statuses.push("UNDER_MAINTENANCE");
    chip("Status", "Under maintenance");
  }

  // Condition
  if (mark(/\b(damaged|broken|faulty|defective)\b/)) {
    r.conditions.push("DAMAGED");
    chip("Condition", "Damaged");
  }
  if (mark(/\b(fair condition|fair|worn)\b/)) {
    r.conditions.push("FAIR");
    chip("Condition", "Fair");
  }
  if (mark(/\bgood condition\b/)) {
    r.conditions.push("GOOD");
    chip("Condition", "Good");
  }

  // Role words
  if (mark(/\b(students?|borrowers?)\b/)) r.borrowerRole = "BORROWER";
  else if (mark(/\b(staff|lab assistants?)\b/)) r.borrowerRole = "LAB_STAFF";

  // Token-level vocabulary matches
  const deptSet = new Set(vocab.departments.map((d) => d.toLowerCase()));
  const labWords = vocab.labs.map((lab) => ({
    lab,
    words: lab.toLowerCase().split(/\s+/).filter((w) => w.length > 3 && !["lab", "laboratory", "the"].includes(w)),
  }));
  const peopleFirst = vocab.people.map((p) => ({ ...p, first: p.name.toLowerCase().split(" ")[0] }));

  tokens.forEach((tok, i) => {
    if (used.has(i)) return;
    // Department codes that are also English words (ME) count only when written
    // in capitals or followed by a cue such as "students" or "department"
    const deptCue = original[i] === original[i].toUpperCase() || /^(students?|dept|department|branch)$/.test(tokens[i + 1] ?? "");
    if (STOPWORDS.has(tok) && !(deptSet.has(tok) && deptCue)) return;

    for (const c of vocab.categories) {
      const words = [...(CATEGORY_SYNONYMS[c.code] ?? []), c.code.toLowerCase(), ...c.name.toLowerCase().split(/\s+/).filter((w) => w.length > 3)];
      if (words.some((w) => fuzzyEq(tok, w)) && !r.categoryIds.includes(c.id)) {
        r.categoryIds.push(c.id);
        chip("Category", c.name);
        used.add(i);
        return;
      }
    }
    if (deptSet.has(tok)) {
      const d = tok.toUpperCase();
      if (!r.borrowerDepartments.includes(d)) {
        r.borrowerDepartments.push(d);
        chip("Department", d);
      }
      used.add(i);
      return;
    }
    const lab = labWords.find((l) => l.words.some((w) => fuzzyEq(tok, w)));
    if (lab) {
      if (!r.labs.includes(lab.lab)) {
        r.labs.push(lab.lab);
        chip("Location", lab.lab);
      }
      used.add(i);
      return;
    }
    const mf = vocab.manufacturers.find((m) => fuzzyEq(tok, m.toLowerCase()));
    if (mf) {
      if (!r.manufacturers.includes(mf)) {
        r.manufacturers.push(mf);
        chip("Make", mf);
      }
      used.add(i);
      return;
    }
    const person = peopleFirst.find((p) => fuzzyEq(tok, p.first));
    if (person && tok.length >= 3) {
      if (!r.borrowerIds.includes(person.id)) {
        r.borrowerIds.push(person.id);
        chip("Borrower", person.name);
      }
      used.add(i);
    }
  });

  if (r.borrowerRole) chip("Borrower role", r.borrowerRole === "BORROWER" ? "Students" : "Staff");

  r.understood =
    r.categoryIds.length + r.statuses.length + r.conditions.length + r.borrowerDepartments.length + r.borrowerIds.length +
      r.labs.length + r.manufacturers.length > 0 ||
    r.overdue || !!r.due || !!r.checkedOut || !!r.borrowerRole || r.intent === "count";
  return r;
}

type Stage = Record<string, unknown>;

// Interpretation -> aggregation pipeline on the assets collection.
// Ids are strings here; the caller converts them to ObjectIds.
export function buildPipeline(q: Interpretation, now = new Date()): { pipeline: Stage[]; countPipeline: Stage[]; needsLoan: boolean } {
  const needsLoan =
    q.overdue || !!q.due || !!q.checkedOut || q.borrowerDepartments.length > 0 || q.borrowerIds.length > 0 || !!q.borrowerRole;

  const assetMatch: Stage = {};
  if (q.categoryIds.length) assetMatch.category = { $in: q.categoryIds };
  if (q.conditions.length) assetMatch.condition = { $in: q.conditions };
  if (q.labs.length) assetMatch["location.lab"] = { $in: q.labs };
  if (q.manufacturers.length) assetMatch.manufacturer = { $in: q.manufacturers };
  const statuses = new Set(q.statuses);
  if (needsLoan) {
    statuses.delete("AVAILABLE");
    statuses.delete("UNDER_MAINTENANCE");
    statuses.add("CHECKED_OUT");
    statuses.add("OVERDUE");
  }
  if (statuses.size) assetMatch.status = { $in: [...statuses] };

  const loanMatch: Stage = {};
  if (q.overdue) loanMatch["loan.dueAt"] = { $lt: q.overdueByDays ? new Date(now.getTime() - q.overdueByDays * DAY) : now };
  if (q.due) loanMatch["loan.dueAt"] = { ...(q.due.from ? { $gte: q.due.from } : {}), ...(q.due.to ? { $lt: q.due.to } : {}) };
  if (q.checkedOut)
    loanMatch["loan.checkoutAt"] = { ...(q.checkedOut.from ? { $gte: q.checkedOut.from } : {}), ...(q.checkedOut.to ? { $lt: q.checkedOut.to } : {}) };
  if (q.borrowerDepartments.length) loanMatch["borrower.department"] = { $in: q.borrowerDepartments };
  if (q.borrowerIds.length) loanMatch["borrower._id"] = { $in: q.borrowerIds };
  if (q.borrowerRole) loanMatch["borrower.role"] = q.borrowerRole;

  // The borrower join is needed before filtering only when a filter uses it;
  // otherwise it (and the category join) runs on the final 200 rows only.
  const borrowerFiltered = q.borrowerDepartments.length > 0 || q.borrowerIds.length > 0 || !!q.borrowerRole;
  const borrowerJoin: Stage[] = [
    { $lookup: { from: "users", localField: "loan.borrower", foreignField: "_id", as: "borrower" } },
    { $unwind: { path: "$borrower", preserveNullAndEmptyArrays: true } },
  ];

  const pipeline: Stage[] = [
    ...(Object.keys(assetMatch).length ? [{ $match: assetMatch }] : []),
    // Join the open loan through the asset's currentTransaction pointer, which
    // uses the _id index. (A correlated $expr sub-pipeline cannot use the
    // partial index and scanned all loans once per asset: ~45x slower at 10k assets.)
    { $lookup: { from: "custody_transactions", localField: "currentTransaction", foreignField: "_id", as: "loan" } },
    { $unwind: { path: "$loan", preserveNullAndEmptyArrays: !needsLoan } },
    ...(borrowerFiltered ? borrowerJoin : []),
    ...(Object.keys(loanMatch).length ? [{ $match: loanMatch }] : []),
    { $sort: { "loan.dueAt": 1, assetTag: 1 } },
    { $limit: 200 },
    ...(borrowerFiltered ? [] : borrowerJoin),
    { $lookup: { from: "categories", localField: "category", foreignField: "_id", as: "category" } },
    { $unwind: "$category" },
    {
      $project: {
        assetTag: 1, name: 1, status: 1, condition: 1, manufacturer: 1, "location.lab": 1, "location.shelf": 1,
        "category.name": 1, "loan.dueAt": 1, "loan.checkoutAt": 1,
        "borrower.name": 1, "borrower.department": 1,
      },
    },
    { $sort: { "loan.dueAt": 1, assetTag: 1 } },
  ];

  // Same filters without the row limit, for exact totals ("how many ...")
  const countPipeline: Stage[] = [
    ...(Object.keys(assetMatch).length ? [{ $match: assetMatch }] : []),
    { $lookup: { from: "custody_transactions", localField: "currentTransaction", foreignField: "_id", as: "loan" } },
    { $unwind: { path: "$loan", preserveNullAndEmptyArrays: !needsLoan } },
    ...(borrowerFiltered ? borrowerJoin : []),
    ...(Object.keys(loanMatch).length ? [{ $match: loanMatch }] : []),
    { $count: "n" },
  ];
  return { pipeline, countPipeline, needsLoan };
}

export const EXAMPLE_QUERIES = [
  "Show all multimeters checked out by ISE students overdue by 3 days",
  "How many tools are available in the metrology lab?",
  "Which drills are overdue?",
  "Tools due this week",
  "What does Priya have?",
  "Damaged gauges under maintenance",
  "Fluke tools issued in the last 7 days",
];

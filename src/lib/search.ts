import "server-only";
import { Types, type PipelineStage } from "mongoose";
import { connectDB } from "./db";
import { buildPipeline, parseQuery, type Interpretation, type Vocab } from "./nlq";
import { Asset, Category, User } from "@/models";

// Vocabulary comes from the live data and is cached briefly so each query is a
// single aggregation round trip.
let vocabCache: { at: number; vocab: Vocab } | null = null;

async function loadVocab(): Promise<Vocab> {
  if (vocabCache && Date.now() - vocabCache.at < 60_000) return vocabCache.vocab;
  await connectDB();
  const [cats, depts, labs, makers, people] = await Promise.all([
    Category.find({}, "name code").lean(),
    User.distinct("department"),
    Asset.distinct("location.lab"),
    Asset.distinct("manufacturer"),
    User.find({ isActive: true }, "name").lean(),
  ]);
  const vocab: Vocab = {
    categories: cats.map((c) => ({ id: String(c._id), name: c.name, code: c.code })),
    departments: depts.filter(Boolean) as string[],
    labs: labs.filter(Boolean) as string[],
    manufacturers: makers.filter(Boolean) as string[],
    people: people.map((p) => ({ id: String(p._id), name: p.name })),
  };
  vocabCache = { at: Date.now(), vocab };
  return vocab;
}

export type SearchRow = {
  id: string;
  assetTag: string;
  name: string;
  status: string;
  condition: string;
  category: string;
  lab: string;
  borrower?: string;
  department?: string;
  dueAt?: string;
};

export type SearchResult = {
  query: string;
  interpretation: Interpretation;
  rows: SearchRow[];
  /** exact number of matching tools (rows are capped at 200) */
  total: number;
  pipelineJson: string;
  ms: number;
};

function withObjectIds(pipeline: Record<string, unknown>[]) {
  const toIds = (v: unknown) => ({ $in: ((v as { $in: string[] }).$in ?? []).map((x) => new Types.ObjectId(x)) });
  return pipeline.map((stage) => {
    const m = stage.$match as Record<string, unknown> | undefined;
    if (!m) return stage;
    const out = { ...m };
    if (out.category) out.category = toIds(out.category);
    if (out["borrower._id"]) out["borrower._id"] = toIds(out["borrower._id"]);
    return { $match: out };
  });
}

export async function runSearch(query: string): Promise<SearchResult> {
  const t0 = performance.now();
  const vocab = await loadVocab();
  const interpretation = parseQuery(query, vocab);
  const { pipeline, countPipeline } = buildPipeline(interpretation);

  let rows: SearchRow[] = [];
  let total = 0;
  if (interpretation.understood) {
    const docs = await Asset.aggregate(withObjectIds(pipeline) as unknown as PipelineStage[]);
    rows = docs.map((d) => ({
      id: String(d._id),
      assetTag: d.assetTag,
      name: d.name,
      status: d.status,
      condition: d.condition,
      category: d.category?.name ?? "",
      lab: d.location?.lab ?? "",
      borrower: d.borrower?.name,
      department: d.borrower?.department,
      dueAt: d.loan?.dueAt ? new Date(d.loan.dueAt).toISOString() : undefined,
    }));
    total = rows.length;
    if (interpretation.intent === "count" || rows.length === 200) {
      const c = await Asset.aggregate(withObjectIds(countPipeline) as unknown as PipelineStage[]);
      total = c[0]?.n ?? 0;
    }
  }

  // Readable version of the pipeline for the "show query" panel
  const pipelineJson = JSON.stringify(
    pipeline,
    (_k, v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) ? `ISODate("${v}")` : v),
    2,
  ).replace(/"ISODate\(\\"(.+?)\\"\)"/g, 'ISODate("$1")');

  return { query, interpretation, rows, total, pipelineJson, ms: Math.round(performance.now() - t0) };
}

"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Code2, LoaderCircle, Sparkles } from "lucide-react";
import { searchAction } from "@/app/actions/search";
import type { AssetStatus } from "@/lib/constants";
import { relativeDays } from "@/lib/format";
import type { SearchResult } from "@/lib/search";
import { StatusBadge } from "./ui";

export default function AskBox({ examples }: { examples: string[] }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showQuery, setShowQuery] = useState(false);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const run = (q: string) => {
    setQuery(q);
    start(async () => {
      const r = await searchAction(q);
      if ("error" in r) {
        setError(r.error);
        setResult(null);
      } else {
        setError(null);
        setResult(r);
      }
    });
  };

  const it = result?.interpretation;

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) run(query);
        }}
        className="relative"
      >
        <Sparkles className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-periwinkle" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about your tools, e.g. which drills are overdue?"
          className="w-full rounded-2xl border border-slate-300 bg-white py-4 pl-12 pr-14 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-navy focus:ring-4 focus:ring-navy/10"
          autoFocus
        />
        <button
          disabled={pending || !query.trim()}
          className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl bg-navy text-white transition hover:bg-navy-600 disabled:opacity-40"
          aria-label="Ask"
        >
          {pending ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {examples.map((ex) => (
          <button key={ex} onClick={() => run(ex)} className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-navy hover:text-navy">
            {ex}
          </button>
        ))}
      </div>

      {error && <p className="mt-6 text-sm text-red-700">{error}</p>}

      {result && it && (
        <div className={`mt-8 transition-opacity ${pending ? "opacity-50" : ""}`}>
          {!it.understood ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-6 py-8 text-center text-sm text-slate-600">
              I couldn&apos;t match anything in “{result.query}”. Try naming a tool type, a status (available, overdue, under maintenance), a lab, a department or a person.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-500">Understood as</span>
                {it.chips.map((c, i) => (
                  <span key={i} className="rounded-md bg-navy-50 px-2 py-1 text-xs text-navy ring-1 ring-inset ring-navy/10">
                    <span className="opacity-60">{c.kind}:</span> {c.label}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex items-baseline justify-between gap-4">
                <p className="text-slate-900">
                  <span className="text-3xl font-semibold tabular-nums">{result.total}</span>{" "}
                  <span className="text-sm text-slate-500">
                    {result.total === 1 ? "tool" : "tools"}
                    {result.total > result.rows.length && ` (showing first ${result.rows.length})`} · {result.ms} ms
                  </span>
                </p>
                <button onClick={() => setShowQuery((v) => !v)} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900">
                  <Code2 className="h-4 w-4" /> {showQuery ? "Hide" : "Show"} MongoDB query
                </button>
              </div>

              {showQuery && (
                <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-navy-950 p-4 font-mono text-[12px] leading-relaxed text-slate-200">
                  db.assets.aggregate({result.pipelineJson})
                </pre>
              )}

              {it.intent === "list" || result.rows.length > 0 ? (
                <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                  {result.rows.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-slate-500">No tools match.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="table-base">
                        <thead className="bg-slate-50/80">
                          <tr>
                            <th>Tag</th>
                            <th>Name</th>
                            <th>Location</th>
                            <th>Status</th>
                            <th>With</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.rows.map((r) => (
                            <tr key={r.id}>
                              <td>
                                <Link href={`/assets/${r.id}`} className="font-mono text-xs font-semibold text-navy hover:underline">
                                  {r.assetTag}
                                </Link>
                              </td>
                              <td>
                                {r.name}
                                <p className="text-xs text-slate-500">{r.category}</p>
                              </td>
                              <td className="text-slate-600">{r.lab}</td>
                              <td>
                                <StatusBadge status={r.status as AssetStatus} />
                              </td>
                              <td className="text-slate-600">
                                {r.borrower ? (
                                  <>
                                    {r.borrower} <span className="text-xs text-slate-400">{r.department}</span>
                                    {r.dueAt && <p className={`text-xs ${new Date(r.dueAt) < new Date() ? "text-red-600" : "text-slate-400"}`}>due {relativeDays(r.dueAt)}</p>}
                                  </>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}

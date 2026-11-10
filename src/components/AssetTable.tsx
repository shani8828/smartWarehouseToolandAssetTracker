"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { ASSET_STATUS, STATUS_LABEL, type AssetStatus } from "@/lib/constants";
import { relativeDays } from "@/lib/format";
import type { AssetRow } from "@/lib/queries";
import { ConditionText, StatusBadge, inputCls } from "./ui";

// All assets are sent once; filtering happens in the browser so it is instant.
export default function AssetTable({ rows, initialStatus, initialCategory }: { rows: AssetRow[]; initialStatus?: string; initialCategory?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<AssetStatus | "">(ASSET_STATUS.includes(initialStatus as AssetStatus) ? (initialStatus as AssetStatus) : "");
  const [category, setCategory] = useState(initialCategory ?? "");
  const dq = useDeferredValue(q);

  const categories = useMemo(() => [...new Set(rows.map((r) => r.category))].sort(), [rows]);
  const counts = useMemo(() => {
    const c = Object.fromEntries(ASSET_STATUS.map((s) => [s, 0])) as Record<AssetStatus, number>;
    rows.forEach((r) => c[r.status]++);
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = dq.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!status || r.status === status) &&
        (!category || r.category === category) &&
        (!needle || [r.assetTag, r.name, r.manufacturer, r.lab, r.custodian].some((v) => v?.toLowerCase().includes(needle))),
    );
  }, [rows, dq, status, category]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tag, name, make, lab or borrower" className={`${inputCls} pl-9`} />
          {q && (
            <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700" aria-label="Clear search">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputCls} sm:w-56`} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {[["", "All", rows.length] as const, ...ASSET_STATUS.map((s) => [s, STATUS_LABEL[s], counts[s]] as const)].map(([key, label, n]) => (
          <button
            key={key || "all"}
            onClick={() => setStatus(key as AssetStatus | "")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              status === key ? "bg-navy text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {label} <span className="tabular-nums opacity-70">{n}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
        {/* Table on wider screens */}
        <table className="table-base hidden md:table">
          <thead className="bg-slate-50/80">
            <tr>
              <th>Tag</th>
              <th>Name</th>
              <th>Category</th>
              <th>Location</th>
              <th>Condition</th>
              <th>Status</th>
              <th>With</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} onClick={() => router.push(`/assets/${a.id}`)} className="cursor-pointer">
                <td className="whitespace-nowrap font-mono text-xs font-semibold text-navy">{a.assetTag}</td>
                <td className="font-medium text-slate-900">
                  {a.name}
                  {a.manufacturer && <p className="text-xs font-normal text-slate-500">{a.manufacturer}</p>}
                </td>
                <td className="text-slate-600">{a.category}</td>
                <td className="text-slate-600">
                  {a.lab}
                  {a.shelf && <span className="text-slate-400"> · {a.shelf}</span>}
                </td>
                <td>
                  <ConditionText condition={a.condition} />
                </td>
                <td>
                  <StatusBadge status={a.status} />
                </td>
                <td className="text-slate-600">
                  {a.custodian ?? <span className="text-slate-300">-</span>}
                  {a.dueAt && <p className={`text-xs ${a.status === "OVERDUE" ? "text-red-600" : "text-slate-400"}`}>due {relativeDays(a.dueAt)}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Cards on phones */}
        <ul className="divide-y divide-slate-100 md:hidden">
          {filtered.map((a) => (
            <li key={a.id} onClick={() => router.push(`/assets/${a.id}`)} className="flex cursor-pointer items-start justify-between gap-3 px-4 py-3 active:bg-slate-50">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{a.name}</p>
                <p className="font-mono text-xs text-navy">{a.assetTag}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {a.lab}
                  {a.custodian && ` · with ${a.custodian}`}
                </p>
              </div>
              <StatusBadge status={a.status} />
            </li>
          ))}
        </ul>

        {filtered.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">No assets match these filters.</p>}
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Showing {filtered.length} of {rows.length}
      </p>
    </div>
  );
}

"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, LoaderCircle, ScanLine } from "lucide-react";
import type { AssetStatus, Role } from "@/lib/constants";
import CustodyPanel, { type Borrower } from "./CustodyPanel";
import Scanner, { type ScanSource } from "./Scanner";
import { StatusBadge, inputCls } from "./ui";

type Found = {
  id: string;
  assetTag: string;
  name: string;
  status: AssetStatus;
  category: string;
  defaultLoanDays: number;
  lab: string;
  shelf?: string;
  custodian?: string;
  dueAt?: string;
  checkoutAt?: string;
};
type Entry = { key: number; text: string; format: string; source: ScanSource | "typed"; at: Date; state: "loading" | "found" | "unknown" | "error"; asset?: Found };

export default function ScanWorkspace({ role, userId, borrowers }: { role: Role; userId: string; borrowers: Borrower[] }) {
  const router = useRouter();
  const [log, setLog] = useState<Entry[]>([]);
  const [current, setCurrent] = useState<Entry | null>(null);
  const [manual, setManual] = useState("");

  const lookup = useCallback(async (text: string): Promise<Pick<Entry, "state" | "asset">> => {
    try {
      const res = await fetch(`/api/assets/${encodeURIComponent(text.trim())}`, { cache: "no-store" });
      if (res.status === 404) return { state: "unknown" };
      if (!res.ok) return { state: "error" };
      return { state: "found", asset: (await res.json()).asset };
    } catch {
      return { state: "error" };
    }
  }, []);

  const handle = useCallback(
    async (text: string, format: string, source: Entry["source"]) => {
      const key = Date.now();
      const entry: Entry = { key, text, format, source, at: new Date(), state: "loading" };
      setCurrent(entry);
      setLog((l) => [entry, ...l].slice(0, 15));
      const r = await lookup(text);
      const done = { ...entry, ...r };
      setCurrent((c) => (c?.key === key ? done : c));
      setLog((l) => l.map((e) => (e.key === key ? done : e)));
    },
    [lookup],
  );

  // After a checkout/return, refresh the open asset so the panel shows its new state
  const refresh = useCallback(async () => {
    if (!current?.asset) return;
    const r = await lookup(current.asset.assetTag);
    setCurrent((c) => (c && c.key === current.key ? { ...c, ...r } : c));
    setLog((l) => l.map((e) => (e.key === current.key ? { ...e, ...r } : e)));
    router.refresh();
  }, [current, lookup, router]);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <Scanner onScan={handle} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (manual.trim()) void handle(manual.trim().toUpperCase(), "TYPED", "typed");
            setManual("");
          }}
          className="mt-4 flex gap-2"
        >
          <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Or type a tag, e.g. ISE-MM-001" className={`${inputCls} font-mono uppercase placeholder:font-sans placeholder:normal-case`} />
          <button className="btn-secondary">Open</button>
        </form>

        {log.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-xs font-medium text-slate-500">Recent scans</p>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {log.map((e) => (
                <li key={e.key}>
                  <button onClick={() => setCurrent(e)} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-50">
                    <span className="min-w-0">
                      <span className="font-mono font-medium text-slate-900">{e.text}</span>
                      <span className="ml-2 text-xs text-slate-400">
                        {e.format.replace(/_/g, " ")} · {e.at.toLocaleTimeString()}
                      </span>
                    </span>
                    {e.state === "found" && e.asset ? <StatusBadge status={e.asset.status} /> : <span className="text-xs text-slate-400">{e.state === "loading" ? "…" : "not registered"}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="lg:col-span-2">
        <div className="rounded-2xl border border-slate-200 lg:sticky lg:top-20">
          {!current ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <ScanLine className="h-6 w-6 text-slate-500" />
              </span>
              <p className="mt-3 text-sm font-medium text-slate-900">Scan a tool&apos;s tag</p>
              <p className="mt-1 text-sm text-slate-500">Its details and the right action (check out, return, repair) appear here.</p>
            </div>
          ) : current.state === "loading" ? (
            <div className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-slate-500">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Looking up {current.text}
            </div>
          ) : current.state === "found" && current.asset ? (
            <div className="animate-fade-in">
              <div className="border-b border-slate-100 px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-slate-500">{current.asset.assetTag}</p>
                    <p className="mt-0.5 font-semibold text-slate-900">{current.asset.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {current.asset.category} · {current.asset.lab}
                      {current.asset.shelf && `, ${current.asset.shelf}`}
                    </p>
                  </div>
                  <StatusBadge status={current.asset.status} />
                </div>
                <Link href={`/assets/${current.asset.id}`} className="mt-2 inline-flex items-center gap-0.5 text-xs font-medium text-navy hover:underline">
                  Full history <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="px-5 py-4">
                <CustodyPanel key={current.asset.id} asset={current.asset} role={role} userId={userId} borrowers={borrowers} onDone={refresh} />
              </div>
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <p className="font-mono text-sm font-semibold text-slate-900">{current.text}</p>
              <p className="mt-2 text-sm text-slate-500">{current.state === "unknown" ? "This code is not a registered asset tag." : "Lookup failed. Check the connection and try again."}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

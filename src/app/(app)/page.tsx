import Link from "next/link";
import { ChevronRight, ScanLine } from "lucide-react";
import AuditButton from "@/components/AuditButton";
import { Card, Empty, PageHeader, STATUS_BAR, StatusBadge, TagLink } from "@/components/ui";
import { ASSET_STATUS, STATUS_LABEL } from "@/lib/constants";
import { daysOverdue, fmtDate, fmtDateTime, relativeDays } from "@/lib/format";
import { getDashboard, listAssets, listLoans, loanCounts } from "@/lib/queries";
import { isStaff, requireSession } from "@/lib/session";

export const metadata = { title: "Home" };

export default async function HomePage() {
  const session = await requireSession();
  return isStaff(session) ? <StaffDashboard /> : <BorrowerHome userId={session.sub} name={session.name} />;
}

const ACTION_TEXT: Record<string, string> = {
  CHECKOUT: "Checked out",
  CHECKIN: "Returned",
  STATUS_CHANGE: "Status changed",
  CREATE: "Created",
  UPDATE: "Updated",
  DELETE: "Deleted",
};

function describeChange(c: Record<string, unknown>) {
  if (c.borrower) return `to ${c.borrower}`;
  if (c.to) return `to ${STATUS_LABEL[c.to as keyof typeof STATUS_LABEL] ?? c.to}`;
  if (c.conditionIn) return `condition ${String(c.conditionIn).toLowerCase()}${c.late ? ", late" : ""}`;
  return "";
}

async function StaffDashboard() {
  const d = await getDashboard();
  const maxDay = Math.max(1, ...d.days.map((x) => x.n));
  const stats = [
    { label: "Total assets", value: d.total, href: "/assets" },
    { label: "Available", value: d.counts.AVAILABLE, href: "/assets?status=AVAILABLE", dot: STATUS_BAR.AVAILABLE },
    { label: "Checked out", value: d.counts.CHECKED_OUT + d.counts.OVERDUE, href: "/loans", dot: STATUS_BAR.CHECKED_OUT },
    { label: "Overdue", value: d.overdueCount, href: "/loans?view=overdue", dot: STATUS_BAR.OVERDUE, alert: d.overdueCount > 0 },
    { label: "In maintenance", value: d.counts.UNDER_MAINTENANCE, href: "/assets?status=UNDER_MAINTENANCE", dot: STATUS_BAR.UNDER_MAINTENANCE },
    { label: "Utilisation", value: `${d.utilisation}%`, href: "/loans", sub: "of assets in use" },
  ];

  return (
    <>
      <PageHeader title="Dashboard" description="Live view of every tool across the labs" actions={<AuditButton />} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="group rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm">
            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              {s.dot && <span className={`h-2 w-2 rounded-full ${s.dot}`} />}
              {s.label}
            </p>
            <p className={`mt-2 text-3xl font-semibold tabular-nums tracking-tight ${s.alert ? "text-red-600" : "text-slate-900"}`}>{s.value}</p>
            {s.sub && <p className="text-xs text-slate-400">{s.sub}</p>}
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Overdue now" className="lg:col-span-2" action={<Link href="/loans?view=overdue" className="text-xs font-medium text-navy hover:underline">View all</Link>}>
          {d.overdueLoans.length === 0 ? (
            <Empty>Nothing is overdue.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Tool</th>
                    <th>Borrower</th>
                    <th>Due</th>
                    <th className="text-right">Late by</th>
                  </tr>
                </thead>
                <tbody>
                  {d.overdueLoans.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <TagLink id={l.assetId} tag={l.assetTag} />
                        <p className="text-xs text-slate-500">{l.assetName}</p>
                      </td>
                      <td>
                        {l.borrower}
                        <p className="text-xs text-slate-500">{l.department}</p>
                      </td>
                      <td className="whitespace-nowrap text-slate-600">{fmtDate(l.dueAt)}</td>
                      <td className="whitespace-nowrap text-right font-medium text-red-600">{daysOverdue(l.dueAt, new Date())} days</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Due in the next 48 hours">
          {d.dueSoon.length === 0 ? (
            <Empty>No returns due soon.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {d.dueSoon.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <TagLink id={l.assetId} tag={l.assetTag} />
                    <p className="truncate text-xs text-slate-500">{l.borrower}</p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-amber-700">{relativeDays(l.dueAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Status by category" className="lg:col-span-2">
          <div className="space-y-3 px-5 py-4">
            {d.categories.map((c) => (
              <div key={c.id} className="grid grid-cols-[minmax(0,10rem)_1fr_2rem] items-center gap-3 text-sm">
                <span className="truncate text-slate-700">{c.name}</span>
                <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-slate-100">
                  {ASSET_STATUS.filter((k) => c.counts[k] > 0).map((k) => (
                    <div
                      key={k}
                      className={`${STATUS_BAR[k]} h-full first:rounded-l-full last:rounded-r-full`}
                      style={{ width: `${(c.counts[k] / c.total) * 100}%` }}
                      title={`${STATUS_LABEL[k]}: ${c.counts[k]}`}
                    />
                  ))}
                </div>
                <span className="text-right tabular-nums text-slate-500">{c.total}</span>
              </div>
            ))}
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-xs text-slate-500">
              {ASSET_STATUS.map((k) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${STATUS_BAR[k]}`} /> {STATUS_LABEL[k]}
                </span>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Checkouts, last 14 days">
          <div className="px-5 pb-4 pt-5">
            <div className="flex h-32 items-end gap-1">
              {d.days.map((x) => (
                <div key={x.date} className="group relative flex h-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-[4px] bg-navy/80 transition group-hover:bg-navy"
                    style={{ height: `${x.n ? Math.max(6, (x.n / maxDay) * 100) : 0}%` }}
                  />
                  {x.n === 0 && <div className="h-px w-full bg-slate-200" />}
                  <span className="pointer-events-none absolute -top-7 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-navy-950 px-1.5 py-0.5 text-[11px] text-white group-hover:block">
                    {x.label}: {x.n}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-slate-400">
              <span>{d.days[0].label}</span>
              <span>Today</span>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Recent activity" className="mt-6">
        {d.recent.length === 0 ? (
          <Empty>No activity yet.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {d.recent.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm">
                <span className="text-slate-700">
                  <span className="font-medium text-slate-900">{ACTION_TEXT[e.action] ?? e.action}</span>{" "}
                  {e.tag && <TagLink id={e.entityId} tag={e.tag} />} <span className="text-slate-500">{describeChange(e.changes)}</span>
                </span>
                <span className="text-xs text-slate-400">
                  {e.actor} · {fmtDateTime(e.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

async function BorrowerHome({ userId, name }: { userId: string; name: string }) {
  const [loans, counts, assets] = await Promise.all([listLoans({ view: "active", borrowerId: userId }), loanCounts(userId), listAssets()]);
  const available = new Map<string, number>();
  assets.forEach((a) => available.set(a.category, (available.get(a.category) ?? 0) + (a.status === "AVAILABLE" ? 1 : 0)));
  const now = new Date();

  return (
    <>
      <PageHeader
        title={`Hi, ${name.split(" ")[0]}`}
        description="Tools you have, and what is free to borrow"
        actions={
          <Link href="/scan" className="btn-primary">
            <ScanLine className="h-4 w-4" /> Scan to borrow
          </Link>
        }
      />
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "With you", value: counts.active },
          { label: "Overdue", value: counts.overdue, alert: counts.overdue > 0 },
          { label: "Returned", value: counts.returned },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-medium text-slate-500">{s.label}</p>
            <p className={`mt-1 text-3xl font-semibold tabular-nums ${s.alert ? "text-red-600" : "text-slate-900"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <Card title="Tools with you" className="mt-6">
        {loans.length === 0 ? (
          <Empty>You have no tools checked out.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {loans.map((l) => {
              const late = new Date(l.dueAt) < now;
              return (
                <li key={l.id}>
                  <Link href={`/assets/${l.assetId}`} className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{l.assetName}</p>
                      <p className="font-mono text-xs text-slate-500">{l.assetTag}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {late ? <StatusBadge status="OVERDUE" /> : <span className="text-xs text-slate-500">Due {relativeDays(l.dueAt)}</span>}
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="Available to borrow" className="mt-6">
        <ul className="grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0">
          {[...available.entries()].map(([cat, n]) => (
            <li key={cat}>
              <Link href={`/assets?status=AVAILABLE&category=${encodeURIComponent(cat)}`} className="flex items-center justify-between px-5 py-3 text-sm transition hover:bg-slate-50">
                <span className="text-slate-700">{cat}</span>
                <span className={`font-medium tabular-nums ${n ? "text-emerald-700" : "text-slate-400"}`}>{n} free</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

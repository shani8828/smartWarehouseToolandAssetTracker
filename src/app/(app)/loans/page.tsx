import Link from "next/link";
import { ConditionText, Empty, PageHeader, TagLink } from "@/components/ui";
import { daysOverdue, fmtDate, relativeDays } from "@/lib/format";
import { listLoans, loanCounts } from "@/lib/queries";
import { isStaff, requireSession } from "@/lib/session";

export const metadata = { title: "Loans" };

const VIEWS = [
  { key: "active", label: "Out now" },
  { key: "overdue", label: "Overdue" },
  { key: "returned", label: "Returned" },
  { key: "all", label: "All" },
] as const;
type View = (typeof VIEWS)[number]["key"];

export default async function LoansPage({ searchParams }: { searchParams: { view?: string } }) {
  const session = await requireSession();
  const staff = isStaff(session);
  const view: View = VIEWS.some((v) => v.key === searchParams.view) ? (searchParams.view as View) : "active";
  const borrowerId = staff ? undefined : session.sub;
  const [loans, counts] = await Promise.all([listLoans({ view, borrowerId, limit: 300 }), loanCounts(borrowerId)]);
  const n: Record<View, number> = { active: counts.active, overdue: counts.overdue, returned: counts.returned, all: counts.active + counts.returned };
  const now = new Date();

  return (
    <>
      <PageHeader title={staff ? "Loans" : "My loans"} description="Chain-of-custody record of every checkout and return" />

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`/loans?view=${v.key}`}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 pb-2.5 pt-1 text-sm transition ${
              view === v.key ? "border-navy font-medium text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {v.label}{" "}
            <span className={`ml-1 rounded-full px-1.5 text-xs tabular-nums ${v.key === "overdue" && n.overdue ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>{n[v.key]}</span>
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        {loans.length === 0 ? (
          <Empty>No loans here.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead className="bg-slate-50/80">
                <tr>
                  <th>Tool</th>
                  {staff && <th>Borrower</th>}
                  <th>Checked out</th>
                  <th>Due</th>
                  <th>Returned</th>
                  <th>Condition</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((l) => {
                  const open = l.status === "ACTIVE";
                  const late = open ? new Date(l.dueAt) < now : !!l.returnedAt && new Date(l.returnedAt) > new Date(l.dueAt);
                  return (
                    <tr key={l.id}>
                      <td>
                        <TagLink id={l.assetId} tag={l.assetTag} />
                        <p className="max-w-[16rem] truncate text-xs text-slate-500">{l.assetName}</p>
                      </td>
                      {staff && (
                        <td>
                          {l.borrower}
                          <p className="text-xs text-slate-500">{l.department}</p>
                        </td>
                      )}
                      <td className="whitespace-nowrap text-slate-600">
                        {fmtDate(l.checkoutAt)}
                        {l.issuedBy && <p className="text-xs text-slate-400">by {l.issuedBy}</p>}
                      </td>
                      <td className="whitespace-nowrap">
                        <span className={late ? "font-medium text-red-600" : "text-slate-600"}>{fmtDate(l.dueAt)}</span>
                        {open && (
                          <p className={`text-xs ${late ? "text-red-600" : "text-slate-400"}`}>
                            {late ? `${daysOverdue(l.dueAt, now)} days overdue` : relativeDays(l.dueAt)}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-slate-600">
                        {l.returnedAt ? (
                          <>
                            {fmtDate(l.returnedAt)}
                            {late && <p className="text-xs text-red-600">late</p>}
                          </>
                        ) : (
                          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">Open</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap">{l.conditionIn ? <ConditionText condition={l.conditionIn} /> : <span className="text-slate-300">-</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

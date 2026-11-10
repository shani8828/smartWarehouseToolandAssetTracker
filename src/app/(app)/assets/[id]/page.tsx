import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Pencil, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import CustodyPanel from "@/components/CustodyPanel";
import { Card, ConditionText, Empty, StatusBadge } from "@/components/ui";
import { CONDITION_LABEL, STATUS_LABEL, type AssetStatus, type Condition } from "@/lib/constants";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { getAssetDetail, listBorrowers } from "@/lib/queries";
import { isStaff, requireSession } from "@/lib/session";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const a = await getAssetDetail(params.id);
  return { title: a ? `${a.assetTag} ${a.name}` : "Asset" };
}

const ACTION_TEXT: Record<string, string> = {
  CHECKOUT: "Checked out",
  CHECKIN: "Returned",
  STATUS_CHANGE: "Status changed",
  CREATE: "Registered",
  UPDATE: "Details updated",
};

function auditDetail(c: Record<string, unknown>) {
  if (c.borrower) return `to ${c.borrower}${c.dueAt ? `, due ${fmtDate(c.dueAt as string)}` : ""}`;
  if (c.to) return `${STATUS_LABEL[c.from as AssetStatus] ?? c.from} → ${STATUS_LABEL[c.to as AssetStatus] ?? c.to}${c.by ? ` (${c.by})` : ""}`;
  if (c.conditionIn) return `condition ${CONDITION_LABEL[c.conditionIn as Condition].toLowerCase()}${c.late ? ", returned late" : ""}`;
  return "";
}

export default async function AssetDetailPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const [a, borrowers] = await Promise.all([getAssetDetail(params.id), isStaff(session) ? listBorrowers() : Promise.resolve([])]);
  if (!a) notFound();

  const info: [string, React.ReactNode][] = [
    ["Category", a.category],
    ["Manufacturer", a.manufacturer ?? "-"],
    ["Serial no.", a.serialNumber ?? "-"],
    ["Location", `${a.location.lab}${a.location.shelf ? `, shelf ${a.location.shelf}` : ""}`],
    ["Condition", <ConditionText key="c" condition={a.condition} />],
    ["Purchased", a.purchaseDate ? fmtDate(a.purchaseDate) : "-"],
    ["Cost", a.purchaseCost != null ? `₹${a.purchaseCost.toLocaleString("en-IN")}` : "-"],
    ["Loan period", `${a.defaultLoanDays} days`],
  ];

  return (
    <>
      <nav className="mb-4 flex items-center gap-1 text-sm text-slate-500">
        <Link href="/assets" className="hover:text-slate-900">
          Assets
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-mono text-slate-700">{a.assetTag}</span>
      </nav>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{a.name}</h1>
            <StatusBadge status={a.status} />
          </div>
          <p className="mt-1 font-mono text-sm text-slate-500">{a.assetTag}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/labels?tag=${a.assetTag}`} className="btn-secondary">
            <Printer className="h-4 w-4" /> Label
          </Link>
          {session.role === "ADMIN" && (
            <Link href={`/assets/${a.id}/edit`} className="btn-secondary">
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Details">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 text-sm sm:grid-cols-4">
              {info.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-slate-500">{k}</dt>
                  <dd className="mt-0.5 text-slate-900">{v}</dd>
                </div>
              ))}
            </dl>
            {a.notes && <p className="border-t border-slate-100 px-5 py-3 text-sm text-slate-600">{a.notes}</p>}
          </Card>

          <Card title="Custody history">
            {a.history.length === 0 ? (
              <Empty>This tool has never been issued.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Borrower</th>
                      <th>Out</th>
                      <th>Due</th>
                      <th>Returned</th>
                      <th>Condition</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.history.map((h) => {
                      const late = h.returnedAt ? new Date(h.returnedAt) > new Date(h.dueAt) : new Date(h.dueAt) < new Date();
                      return (
                        <tr key={h.id}>
                          <td>
                            {h.borrower}
                            <p className="text-xs text-slate-500">
                              {h.department}
                              {h.issuedBy && ` · issued by ${h.issuedBy}`}
                            </p>
                          </td>
                          <td className="whitespace-nowrap text-slate-600">{fmtDate(h.checkoutAt)}</td>
                          <td className={`whitespace-nowrap ${late ? "text-red-600" : "text-slate-600"}`}>{fmtDate(h.dueAt)}</td>
                          <td className="whitespace-nowrap text-slate-600">
                            {h.returnedAt ? fmtDate(h.returnedAt) : <span className="font-medium text-sky-700">Open</span>}
                          </td>
                          <td className="whitespace-nowrap text-slate-600">
                            {h.conditionOut && CONDITION_LABEL[h.conditionOut]}
                            {h.conditionIn && <> → <ConditionText condition={h.conditionIn} /></>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Audit trail">
            {a.audit.length === 0 ? (
              <Empty>No recorded changes.</Empty>
            ) : (
              <ol className="relative space-y-4 px-5 py-4 before:absolute before:bottom-4 before:left-[26px] before:top-5 before:w-px before:bg-slate-200">
                {a.audit.map((e) => (
                  <li key={e.id} className="relative flex gap-3 pl-6 text-sm">
                    <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-white ring-2 ring-navy/60" />
                    <div>
                      <p className="text-slate-800">
                        <span className="font-medium">{ACTION_TEXT[e.action] ?? e.action}</span> <span className="text-slate-500">{auditDetail(e.changes)}</span>
                      </p>
                      <p className="text-xs text-slate-400">
                        {e.actor} · {fmtDateTime(e.at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Actions">
            <div className="px-5 py-4">
              <CustodyPanel
                asset={{ id: a.id, assetTag: a.assetTag, status: a.status, defaultLoanDays: a.defaultLoanDays, custodian: a.custodian, dueAt: a.dueAt, checkoutAt: a.checkoutAt }}
                role={session.role}
                userId={session.sub}
                borrowers={borrowers}
              />
            </div>
          </Card>
          <Card title="Tag">
            <div className="flex items-center gap-4 px-5 py-4">
              <QRCodeSVG value={a.assetTag} size={96} marginSize={0} />
              <div className="text-sm">
                <p className="font-mono font-semibold">{a.assetTag}</p>
                <p className="mt-1 text-xs text-slate-500">Scan this code to open the tool and check it in or out.</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

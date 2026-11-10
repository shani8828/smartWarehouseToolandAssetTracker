import Link from "next/link";
import { Mail } from "lucide-react";
import AuditButton from "@/components/AuditButton";
import { Empty, PageHeader } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { listAlerts } from "@/lib/queries";
import { requireRole } from "@/lib/session";

export const metadata = { title: "Alerts" };

export default async function AlertsPage() {
  await requireRole("ADMIN", "LAB_STAFF");
  const alerts = await listAlerts();
  const open = alerts.filter((a) => !a.resolvedAt);
  const resolved = alerts.filter((a) => a.resolvedAt);

  return (
    <>
      <PageHeader
        title="Alerts"
        description="Overdue and damage exceptions. Run the overdue audit to flag past-due loans."
        actions={<AuditButton />}
      />
      <Section title={`Open (${open.length})`} items={open} empty="No open alerts." />
      <div className="mt-8">
        <Section title={`Resolved (${resolved.length})`} items={resolved} empty="Nothing resolved yet." muted />
      </div>
    </>
  );
}

type A = Awaited<ReturnType<typeof listAlerts>>[number];

function Section({ title, items, empty, muted }: { title: string; items: A[]; empty: string; muted?: boolean }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2>
      {items.length === 0 ? (
        <div className="rounded-xl border border-slate-200">
          <Empty>{empty}</Empty>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((a) => (
            <li key={a.id} className={`rounded-xl border border-slate-200 ${muted ? "bg-slate-50/50" : "bg-white"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        a.type === "OVERDUE" ? "bg-red-50 text-red-700 ring-red-600/20" : "bg-amber-50 text-amber-800 ring-amber-600/20"
                      }`}
                    >
                      {a.type === "OVERDUE" ? "Overdue" : "Damaged"}
                    </span>
                    <Link href={`/assets/${a.assetId}`} className="font-mono text-xs font-semibold text-navy hover:underline">
                      {a.assetTag}
                    </Link>
                    <span className="text-sm text-slate-700">{a.assetName}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {a.user && <>{a.user} · </>}
                    {a.message}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-400">
                  <p>{fmtDateTime(a.createdAt)}</p>
                  {a.resolvedAt && <p className="text-emerald-700">Resolved {fmtDateTime(a.resolvedAt)}</p>}
                </div>
              </div>
              {a.emailSubject && (
                <details className="group border-t border-slate-100">
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-2.5 text-xs text-slate-500 hover:text-slate-800">
                    <Mail className="h-3.5 w-3.5" />
                    Email to {a.emailTo || "-"}
                    <span
                      className={`rounded px-1.5 py-0.5 font-medium ${
                        a.emailStatus === "SENT" ? "bg-emerald-50 text-emerald-700" : a.emailStatus === "FAILED" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {a.emailStatus === "SENT" ? (a.emailTransport === "smtp" ? "Sent" : "Generated (preview mode)") : a.emailStatus === "FAILED" ? "Failed" : "Pending"}
                    </span>
                    <span className="ml-auto group-open:hidden">Show</span>
                    <span className="ml-auto hidden group-open:inline">Hide</span>
                  </summary>
                  <div className="mx-5 mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                    <p className="font-medium text-slate-900">{a.emailSubject}</p>
                    <pre className="mt-2 whitespace-pre-wrap font-sans text-slate-700">{a.emailBody}</pre>
                    {a.emailError && <p className="mt-2 text-xs text-red-700">{a.emailError}</p>}
                  </div>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

import Link from "next/link";
import { CONDITION_LABEL, STATUS_LABEL, type AssetStatus, type Condition } from "@/lib/constants";

const STATUS_STYLE: Record<AssetStatus, string> = {
  AVAILABLE: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  CHECKED_OUT: "bg-sky-50 text-sky-700 ring-sky-600/20",
  OVERDUE: "bg-red-50 text-red-700 ring-red-600/20",
  UNDER_MAINTENANCE: "bg-amber-50 text-amber-800 ring-amber-600/20",
};
const STATUS_DOT: Record<AssetStatus, string> = {
  AVAILABLE: "bg-emerald-500",
  CHECKED_OUT: "bg-sky-500",
  OVERDUE: "bg-red-500",
  UNDER_MAINTENANCE: "bg-amber-500",
};
export const STATUS_BAR = STATUS_DOT;

export function StatusBadge({ status }: { status: AssetStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function ConditionText({ condition }: { condition: Condition }) {
  return <span className={condition === "DAMAGED" ? "font-medium text-red-700" : condition === "FAIR" ? "text-amber-700" : "text-slate-600"}>{CONDITION_LABEL[condition]}</span>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, action, children, className = "" }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-8 text-center text-sm text-slate-500">{children}</p>;
}

export function TagLink({ id, tag }: { id: string; tag: string }) {
  return (
    <Link href={`/assets/${id}`} className="whitespace-nowrap font-mono text-xs font-semibold text-navy hover:underline">
      {tag}
    </Link>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-navy focus:ring-2 focus:ring-navy/15";

const DAY = 86_400_000;

export function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function daysBetween(a: Date | string, b: Date | string) {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / DAY);
}

// "in 3 days", "2 days ago", "today"
export function relativeDays(d: Date | string, now = new Date()) {
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(new Date(d)) - startOf(now)) / DAY);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  return diff > 0 ? `in ${diff} days` : `${-diff} days ago`;
}

export function toInputDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);

// Whole calendar days past the due date (at least 1 once overdue), matching relativeDays()
export function daysOverdue(due: Date | string, now = new Date()) {
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.max(1, Math.round((startOf(now) - startOf(new Date(due))) / DAY));
}

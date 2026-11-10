import { ScanLine } from "lucide-react";

export function Logo({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <span className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient shadow-sm">
        <ScanLine className="h-[18px] w-[18px] text-white" />
      </span>
      <span className={`text-[15px] font-semibold tracking-tight ${tone === "light" ? "text-white" : "text-slate-900"}`}>Smart Warehouse</span>
    </span>
  );
}

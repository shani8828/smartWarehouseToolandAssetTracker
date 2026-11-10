"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, Bell, House, Package, ScanLine, Search, Tag, Users } from "lucide-react";
import type { Role } from "@/lib/constants";

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; roles?: Role[] };

const ITEMS: Item[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/assets", label: "Assets", icon: Package },
  { href: "/scan", label: "Scan", icon: ScanLine },
  { href: "/loans", label: "Loans", icon: ArrowLeftRight },
  { href: "/search", label: "Ask", icon: Search },
  { href: "/alerts", label: "Alerts", icon: Bell, roles: ["ADMIN", "LAB_STAFF"] },
  { href: "/labels", label: "Labels", icon: Tag, roles: ["ADMIN", "LAB_STAFF"] },
  { href: "/users", label: "Users", icon: Users, roles: ["ADMIN"] },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

export function DesktopNav({ role, alertCount }: { role: Role; alertCount: number }) {
  const path = usePathname();
  return (
    <nav className="hidden items-center gap-0.5 md:flex">
      {ITEMS.filter((i) => !i.roles || i.roles.includes(role)).map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={`relative rounded-lg px-3 py-1.5 text-sm transition ${
            isActive(path, i.href) ? "bg-slate-100 font-medium text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          {i.label}
          {i.href === "/alerts" && alertCount > 0 && (
            <span className="ml-1.5 rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">{alertCount}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

// Bottom tab bar on phones: the five everyday destinations, Scan in the middle.
export function MobileTabs() {
  const path = usePathname();
  const tabs = ITEMS.slice(0, 5);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden print:hidden">
      <div className="grid grid-cols-5">
        {tabs.map((t) => {
          const active = isActive(path, t.href);
          const Icon = t.icon;
          if (t.href === "/scan")
            return (
              <Link key={t.href} href={t.href} className="flex flex-col items-center justify-center py-1.5" aria-label="Scan">
                <span className={`-mt-5 flex h-12 w-12 items-center justify-center rounded-full shadow-lg ring-4 ring-white transition ${active ? "bg-navy-950" : "bg-brand-gradient"}`}>
                  <Icon className="h-6 w-6 text-white" />
                </span>
                <span className="mt-0.5 text-[11px] font-medium text-slate-700">Scan</span>
              </Link>
            );
          return (
            <Link key={t.href} href={t.href} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${active ? "font-medium text-navy" : "text-slate-500"}`}>
              <Icon className="h-5 w-5" />
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// Extra destinations (alerts, labels, users) for staff on phones
export function MobileMore({ role, alertCount }: { role: Role; alertCount: number }) {
  const extra = ITEMS.slice(5).filter((i) => !i.roles || i.roles.includes(role));
  if (!extra.length) return null;
  return (
    <div className="flex gap-1 md:hidden">
      {extra.map((i) => {
        const Icon = i.icon;
        return (
          <Link key={i.href} href={i.href} aria-label={i.label} className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100">
            <Icon className="h-5 w-5" />
            {i.href === "/alerts" && alertCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />}
          </Link>
        );
      })}
    </div>
  );
}

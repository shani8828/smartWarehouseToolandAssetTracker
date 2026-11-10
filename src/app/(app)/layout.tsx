import Link from "next/link";
import { LogOut } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { DesktopNav, MobileMore, MobileTabs } from "@/components/AppNav";
import { Logo } from "@/components/Logo";
import { ROLE_LABEL } from "@/lib/constants";
import { connectDB } from "@/lib/db";
import { isStaff, requireSession } from "@/lib/session";
import { Alert } from "@/models";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  let alertCount = 0;
  if (isStaff(session)) {
    await connectDB();
    alertCount = await Alert.countDocuments({ resolvedAt: null });
  }
  const initials = session.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <Link href="/" aria-label="Home">
              <Logo />
            </Link>
            <DesktopNav role={session.role} alertCount={alertCount} />
          </div>
          <div className="flex items-center gap-1">
            <MobileMore role={session.role} alertCount={alertCount} />
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-sm font-medium text-slate-900">{session.name}</p>
              <p className="text-xs text-slate-500">
                {ROLE_LABEL[session.role]} · {session.department}
              </p>
            </div>
            <span className="ml-2 hidden h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 sm:flex">
              {initials}
            </span>
            <form action={logout}>
              <button className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Sign out" title="Sign out">
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="animate-fade-in mx-auto max-w-7xl px-4 pb-28 pt-6 md:pb-12 md:pt-8">{children}</main>
      <MobileTabs />
    </div>
  );
}

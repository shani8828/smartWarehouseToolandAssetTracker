import { Logo } from "@/components/Logo";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-navy-950 bg-brand-night px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo tone="light" />
        </div>
        <h1 className="text-center text-xl font-semibold text-white">Sign in</h1>
        <p className="mt-1 text-center text-sm text-navy-100/80">Track lab tools from checkout to return</p>
        <div className="mt-8 rounded-2xl bg-white p-6 shadow-xl shadow-navy-950/40">
          <LoginForm next={searchParams.next} />
        </div>
      </div>
    </div>
  );
}

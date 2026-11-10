import AskBox from "@/components/AskBox";
import { EXAMPLE_QUERIES } from "@/lib/nlq";
import { requireSession } from "@/lib/session";

export const metadata = { title: "Ask" };

export default async function SearchPage() {
  await requireSession();
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Ask in plain English</h1>
        <p className="mt-1 text-sm text-slate-500">Your question is turned into a database query. No filters to learn.</p>
      </div>
      <AskBox examples={EXAMPLE_QUERIES} />
    </div>
  );
}

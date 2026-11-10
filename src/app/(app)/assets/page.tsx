import Link from "next/link";
import { Plus } from "lucide-react";
import AssetTable from "@/components/AssetTable";
import { PageHeader } from "@/components/ui";
import { listAssets } from "@/lib/queries";
import { requireSession } from "@/lib/session";

export const metadata = { title: "Assets" };

export default async function AssetsPage({ searchParams }: { searchParams: { status?: string; category?: string } }) {
  const session = await requireSession();
  const rows = await listAssets();
  return (
    <>
      <PageHeader
        title="Assets"
        description="Every registered tool, where it is and who has it"
        actions={
          session.role === "ADMIN" && (
            <Link href="/assets/new" className="btn-primary">
              <Plus className="h-4 w-4" /> Add asset
            </Link>
          )
        }
      />
      <AssetTable rows={rows} initialStatus={searchParams.status} initialCategory={searchParams.category} />
    </>
  );
}

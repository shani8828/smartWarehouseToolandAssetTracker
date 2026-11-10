import Link from "next/link";
import LabelSheet, { type LabelItem } from "@/components/LabelSheet";
import { PageHeader } from "@/components/ui";
import { connectDB } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { Asset } from "@/models";

export const metadata = { title: "Labels" };

export default async function LabelsPage({ searchParams }: { searchParams: { tag?: string } }) {
  await requireRole("ADMIN", "LAB_STAFF");
  await connectDB();
  const filter = searchParams.tag ? { assetTag: searchParams.tag.toUpperCase() } : {};
  const assets = await Asset.find(filter, "assetTag name location").sort({ assetTag: 1 }).lean();
  const items: LabelItem[] = assets.map((a) => ({ assetTag: a.assetTag, name: a.name, lab: a.location?.lab ?? undefined }));

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Tag labels"
          description="QR code and Code 128 barcode for each tool. Print on sticker paper and fix to the tool."
          actions={
            searchParams.tag && (
              <Link href="/labels" className="btn-secondary">
                Show all labels
              </Link>
            )
          }
        />
      </div>
      <LabelSheet items={items} />
    </>
  );
}

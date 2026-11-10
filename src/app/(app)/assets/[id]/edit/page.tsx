import { notFound } from "next/navigation";
import AssetForm from "@/components/AssetForm";
import { PageHeader } from "@/components/ui";
import { connectDB } from "@/lib/db";
import { getAssetDetail, listCategories } from "@/lib/queries";
import { requireRole } from "@/lib/session";
import { Asset } from "@/models";

export const metadata = { title: "Edit asset" };

export default async function EditAssetPage({ params }: { params: { id: string } }) {
  await requireRole("ADMIN");
  await connectDB();
  const [a, categories, labs] = await Promise.all([getAssetDetail(params.id), listCategories(), Asset.distinct("location.lab")]);
  if (!a) notFound();
  return (
    <>
      <PageHeader title={`Edit ${a.assetTag}`} description={a.name} />
      <AssetForm
        categories={categories}
        labs={labs as string[]}
        values={{
          id: a.id,
          assetTag: a.assetTag,
          name: a.name,
          categoryId: a.categoryId,
          manufacturer: a.manufacturer,
          serialNumber: a.serialNumber,
          condition: a.condition,
          lab: a.location.lab,
          shelf: a.location.shelf,
          purchaseDate: a.purchaseDate?.slice(0, 10),
          purchaseCost: a.purchaseCost,
          notes: a.notes,
        }}
      />
    </>
  );
}

import AssetForm from "@/components/AssetForm";
import CategoryForm from "@/components/CategoryForm";
import { Card, PageHeader } from "@/components/ui";
import { connectDB } from "@/lib/db";
import { listCategories } from "@/lib/queries";
import { requireRole } from "@/lib/session";
import { Asset } from "@/models";

export const metadata = { title: "Add asset" };

export default async function NewAssetPage() {
  await requireRole("ADMIN");
  await connectDB();
  const [categories, labs] = await Promise.all([listCategories(), Asset.distinct("location.lab")]);
  return (
    <>
      <PageHeader title="Add asset" description="Register a tool. A QR label is generated from its tag." />
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AssetForm categories={categories} labs={labs as string[]} />
        </div>
        <Card title="New category">
          <div className="px-5 py-4">
            <CategoryForm />
          </div>
        </Card>
      </div>
    </>
  );
}

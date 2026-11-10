import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Asset } from "@/models";

export const dynamic = "force-dynamic";

type Pop = {
  _id: unknown;
  assetTag: string;
  name: string;
  status: string;
  condition: string;
  location?: { lab?: string; shelf?: string };
  category?: { name: string; defaultLoanDays?: number };
  currentCustodian?: { name: string } | null;
  currentTransaction?: { dueAt: Date; checkoutAt: Date } | null;
};

// Decoded tag -> asset summary used by the scanner.
export async function GET(_req: Request, { params }: { params: { tag: string } }) {
  try {
    await connectDB();
    const tag = decodeURIComponent(params.tag).trim().toUpperCase();
    const a = (await Asset.findOne({ assetTag: tag })
      .populate("category", "name defaultLoanDays")
      .populate("currentCustodian", "name")
      .populate("currentTransaction", "dueAt checkoutAt")
      .lean()) as unknown as Pop | null;
    if (!a) return NextResponse.json({ found: false, tag }, { status: 404 });
    return NextResponse.json({
      found: true,
      asset: {
        id: String(a._id),
        assetTag: a.assetTag,
        name: a.name,
        status: a.status,
        condition: a.condition,
        category: a.category?.name ?? "",
        defaultLoanDays: a.category?.defaultLoanDays ?? 7,
        lab: a.location?.lab ?? "",
        shelf: a.location?.shelf,
        custodian: a.currentCustodian?.name,
        dueAt: a.currentTransaction?.dueAt,
        checkoutAt: a.currentTransaction?.checkoutAt,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Lookup failed" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { runOverdueSweep } from "@/lib/overdue";

export const dynamic = "force-dynamic";

// For an external scheduler such as Vercel Cron:
//   Authorization: Bearer <CRON_SECRET>
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  return NextResponse.json(await runOverdueSweep());
}

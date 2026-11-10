// Schedules the overdue audit every hour on a self-hosted server.
// On Vercel the /api/cron/overdue endpoint (vercel.json) is used instead.
import cron from "node-cron";
import { runOverdueSweep } from "./lib/overdue";

const g = globalThis as unknown as { _overdueCron?: boolean };

if (!process.env.VERCEL && !g._overdueCron) {
  g._overdueCron = true; // avoid duplicate jobs on dev hot reload

  const run = async () => {
    try {
      const r = await runOverdueSweep();
      console.log(`[overdue audit] ${r.checked} past due, ${r.flagged} flagged, ${r.alertsCreated} alerts`);
    } catch (err) {
      console.error("[overdue audit] failed", err);
    }
  };

  cron.schedule("0 * * * *", run); // top of every hour
  setTimeout(run, 5_000); // and once shortly after the server starts
}

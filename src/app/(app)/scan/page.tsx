import ScanWorkspace from "@/components/ScanWorkspace";
import { PageHeader } from "@/components/ui";
import { listBorrowers } from "@/lib/queries";
import { isStaff, requireSession } from "@/lib/session";

export const metadata = { title: "Scan" };

export default async function ScanPage() {
  const session = await requireSession();
  const borrowers = isStaff(session) ? await listBorrowers() : [];
  return (
    <>
      <PageHeader
        title="Scan"
        description={isStaff(session) ? "Scan a tag to issue, receive or repair a tool" : "Scan a tag to borrow a tool"}
      />
      <ScanWorkspace role={session.role} userId={session.sub} borrowers={borrowers} />
    </>
  );
}

import { toggleUserAction } from "@/app/actions/admin";
import UserForm from "@/components/UserForm";
import { Card, PageHeader } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/constants";
import { listUsers } from "@/lib/queries";
import { requireRole } from "@/lib/session";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const session = await requireRole("ADMIN");
  const users = await listUsers();
  return (
    <>
      <PageHeader title="Users" description="Who can sign in, their role, and what they currently hold" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="overflow-hidden rounded-xl border border-slate-200 lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead className="bg-slate-50/80">
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Dept.</th>
                  <th className="text-right">Holding</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={u.isActive ? "" : "opacity-50"}>
                    <td>
                      <p className="font-medium text-slate-900">{u.name}</p>
                      <p className="text-xs text-slate-500">
                        {u.email}
                        {u.rollNumber && ` · ${u.rollNumber}`}
                      </p>
                    </td>
                    <td className="whitespace-nowrap text-slate-600">{ROLE_LABEL[u.role]}</td>
                    <td className="text-slate-600">{u.department}</td>
                    <td className="text-right tabular-nums text-slate-600">{u.activeLoans}</td>
                    <td className="text-right">
                      {u.id !== session.sub && (
                        <form action={toggleUserAction}>
                          <input type="hidden" name="id" value={u.id} />
                          <button className="text-xs font-medium text-slate-500 hover:text-slate-900">{u.isActive ? "Deactivate" : "Activate"}</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <Card title="Add user">
          <div className="px-5 py-4">
            <UserForm />
          </div>
        </Card>
      </div>
    </>
  );
}

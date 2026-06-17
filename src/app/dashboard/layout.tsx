import { redirect } from "next/navigation";
import { getSession, type DB } from "@/lib/auth";
import { WorkspaceProvider } from "@/components/WorkspaceProvider";
import { DashboardShell } from "@/components/DashboardShell";
import type { Role, Workspace, WorkspaceWithRole } from "@/lib/types";

async function loadWorkspaces(supabase: DB, userId: string): Promise<WorkspaceWithRole[]> {
  const { data } = await supabase.from("memberships").select("role, workspaces(*)").eq("user_id", userId);
  return (data ?? [])
    .map((row) => {
      const ws = row.workspaces as unknown as Workspace | null;
      return ws ? ({ ...ws, role: row.role as Role } satisfies WorkspaceWithRole) : null;
    })
    .filter((w): w is WorkspaceWithRole => w !== null)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await getSession();
  if (!user) redirect("/login");

  let workspaces = await loadWorkspaces(supabase, user.id);

  if (workspaces.length === 0) {
    await supabase.from("workspaces").insert({ name: "My Workspace", owner_id: user.id });
    workspaces = await loadWorkspaces(supabase, user.id);
  }

  return (
    <WorkspaceProvider initialWorkspaces={workspaces} userEmail={user.email ?? ""}>
      <DashboardShell>{children}</DashboardShell>
    </WorkspaceProvider>
  );
}

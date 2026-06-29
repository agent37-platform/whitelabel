import { redirect } from "next/navigation";
import { getSession, type DB } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { WorkspaceProvider } from "@/components/WorkspaceProvider";
import type { Role, Workspace, WorkspaceWithRole } from "@/lib/types";

// Read the user's workspaces with two plain table queries joined in JS, NOT a PostgREST relationship
// embed (`memberships?select=role,workspaces(*)`). The embed needs the memberships→workspaces
// foreign key to be live in PostgREST's schema cache; right after a fresh `npm run setup` migration
// that cache can briefly lag, and the embed then comes back empty even though the rows exist. Plain
// selects don't depend on the relationship, and we surface real query errors instead of mistaking
// them for an empty result.
async function loadWorkspaces(db: DB, userId: string): Promise<WorkspaceWithRole[]> {
  const { data: memberships, error: memErr } = await db
    .from("memberships")
    .select("workspace_id, role")
    .eq("user_id", userId);
  if (memErr) throw new Error(`Couldn't load your workspaces: ${memErr.message}`);
  if (!memberships?.length) return [];

  const roleByWorkspace = new Map<string, Role>(
    memberships.map((m) => [m.workspace_id as string, m.role as Role])
  );
  const { data: workspaces, error: wsErr } = await db
    .from("workspaces")
    .select("*")
    .in("id", [...roleByWorkspace.keys()]);
  if (wsErr) throw new Error(`Couldn't load your workspaces: ${wsErr.message}`);

  return (workspaces ?? [])
    .map((ws) => ({ ...(ws as Workspace), role: roleByWorkspace.get((ws as Workspace).id)! }))
    .filter((w): w is WorkspaceWithRole => Boolean(w.role))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

// First sign-in: create the user's own workspace and their admin membership, returning the new
// WorkspaceWithRole built from the rows we just wrote — no read-back. We insert the membership
// ourselves (idempotent — the on_workspace_created trigger normally adds it in the same transaction,
// hence the on-conflict no-op) so bootstrap depends on neither the trigger having fired nor a
// schema-cache-sensitive re-read of it.
async function createFirstWorkspace(db: DB, userId: string): Promise<WorkspaceWithRole> {
  const { data: ws, error: wsErr } = await db
    .from("workspaces")
    .insert({ name: "My Workspace", owner_id: userId })
    .select("*")
    .single();
  if (wsErr || !ws) {
    throw new Error(`Couldn't create your first workspace: ${wsErr?.message ?? "no row returned"}`);
  }
  const { error: memErr } = await db
    .from("memberships")
    .upsert(
      { workspace_id: ws.id, user_id: userId, role: "admin" },
      { onConflict: "workspace_id,user_id" }
    );
  if (memErr) throw new Error(`Couldn't add you to your first workspace: ${memErr.message}`);
  return { ...(ws as Workspace), role: "admin" as Role };
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getSession();
  if (!user) redirect("/login");

  // Table access goes through the privileged client; the user came from the verified session above.
  const db = createAdminClient();
  let workspaces = await loadWorkspaces(db, user.id);
  if (workspaces.length === 0) {
    workspaces = [await createFirstWorkspace(db, user.id)];
  }

  // The chrome (DashboardShell sidebar) lives in the (fleet) route group's layout, NOT here:
  // the per-agent workspace route renders its own full-height shell and must not be wrapped in it.
  // This layer only establishes auth + the WorkspaceProvider that both branches share.
  return (
    <WorkspaceProvider initialWorkspaces={workspaces} userEmail={user.email ?? ""}>
      {children}
    </WorkspaceProvider>
  );
}

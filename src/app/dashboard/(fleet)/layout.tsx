import { DashboardShell } from "@/components/DashboardShell";

// The fleet route group ( /dashboard, /dashboard/members, /dashboard/settings ) renders inside
// the standard sidebar chrome. The per-agent workspace route lives OUTSIDE this group so it can
// render its own full-height shell with no DashboardShell.
export default function FleetLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}

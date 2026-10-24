import { requireUser } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { AppFooter } from "@/components/layout/AppFooter";
import { Tsareena } from "@/components/ai/Tsareena";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
        {/* pb-24 on mobile keeps the credit clear of the floating assistant button (same clearance main had) */}
        <AppFooter className="pb-24 md:pb-4" />
      </div>
      <Tsareena userId={user.id} />
    </div>
  );
}

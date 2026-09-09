import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/shared/PageHeader";
import { TabNav } from "@/components/shared/TabNav";

const tabs = [
  { href: "/admin/reports-coverage/coverage", label: "Coverage" },
  { href: "/admin/reports-coverage/alerts", label: "Alerts" },
  { href: "/admin/reports-coverage/exports", label: "Exports" },
];

export default async function ReportsCoverageLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-0">
      <PageHeader title="Reports & Coverage" description="Weekend coverage, alerts, and data exports in one place." />
      <TabNav items={tabs} />
      {children}
    </div>
  );
}

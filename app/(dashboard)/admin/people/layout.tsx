import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/shared/PageHeader";
import { TabNav } from "@/components/shared/TabNav";

const tabs = [
  { href: "/admin/people/students", label: "Students" },
  { href: "/admin/people/volunteers", label: "Volunteers" },
  { href: "/admin/people/attendance", label: "Attendance" },
];

export default async function PeopleLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-0">
      <PageHeader title="People" description="Students, volunteers, and attendance in one workspace." />
      <TabNav items={tabs} />
      {children}
    </div>
  );
}

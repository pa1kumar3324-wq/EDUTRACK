import { redirect } from "next/navigation";

export default function AdminReportsRedirect() {
  redirect("/admin/reports-coverage/alerts");
}

import { redirect } from "next/navigation";

export default function AdminVolunteersRedirect() {
  redirect("/admin/people/volunteers");
}

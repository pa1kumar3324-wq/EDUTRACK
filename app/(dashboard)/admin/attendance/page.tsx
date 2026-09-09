import { redirect } from "next/navigation";

export default function AdminAttendanceRedirect() {
  redirect("/admin/people/attendance");
}

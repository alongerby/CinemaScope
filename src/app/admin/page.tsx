import { redirect } from "next/navigation";

// Clean admin entry point. Intentionally unlinked from the UI — reach it by
// typing /admin. All the managing tools live under it.
export default function AdminIndexPage() {
  redirect("/admin/import");
}

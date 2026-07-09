import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect("/");
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between border-b border-border pb-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-subtle">
            Admin
          </p>
          <h1 className="text-lg font-semibold tracking-tight text-ink">
            Panel
          </h1>
        </div>
        <nav className="flex items-center gap-5 text-sm text-subtle">
          <Link href="/admin/claims" className="hover:text-ink">
            Claim Requests
          </Link>
          <Link href="/admin/moderation" className="hover:text-ink">
            Moderation
          </Link>
          <Link href="/admin/audit" className="hover:text-ink">
            Audit Log
          </Link>
        </nav>
      </div>
      {children}
    </div>
  );
}

import Link from "next/link";

// Sitewide footer. The DMCA / Takedown Request link is the one legally
// load-bearing part of this: nominee photos are user-supplied external
// URLs (see AddNomineeForm/Profile.photoUrl), so a visible, easy-to-find
// path to a takedown notice is what lets RepHear rely on DMCA safe
// harbor (17 U.S.C. § 512) rather than being treated as a primary
// infringer for content it didn't create and can't pre-screen.
export default function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-subtle sm:px-6">
        <p>&copy; {new Date().getFullYear()} RepHear. Recognition belongs to everyone.</p>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link href="/legal/dmca" className="hover:text-ink">
            DMCA / Takedown Request
          </Link>
        </nav>
      </div>
    </footer>
  );
}

// Phase 5.6: "My Story Cards" — owner-only panel on /u/[id].
//
// Lists the viewer's own story cards: Early Backer (THEN→NOW),
// Milestone, and Journey. Public cards link straight to the PNG;
// private cards link to the signed, author-only card page (noindex).
// Rendered only for the profile owner — nobody else ever sees this
// panel, and card URLs never enumerate (no ID sequences).

import { getStoryCardLinks } from "@/lib/storyCards";

export default async function StoryCardsPanel({
  userId,
}: {
  userId: string;
}) {
  const links = await getStoryCardLinks(userId);
  if (links.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">My Story Cards</h2>
      <p className="text-sm text-subtle mt-1">
        Your backing story, as shareable cards. Private cards open on a
        link only you can use.
      </p>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li
            key={link.href}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
          >
            <span className="text-sm font-medium">
              {link.label}
              {link.isPrivate && (
                <span className="ml-2 text-xs text-subtle">🔒 only you</span>
              )}
            </span>
            <a
              href={link.href}
              className="shrink-0 rounded-full bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-1.5 text-sm font-semibold text-white no-underline"
              {...(link.isPrivate ? {} : { download: true })}
            >
              {link.isPrivate ? "View" : "Download"}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

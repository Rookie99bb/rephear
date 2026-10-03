import { notFound, redirect } from "next/navigation";
import { findSocialEvent } from "@/db/events";
import { getOrCreateEventConversation } from "@/db/eventMessages";
import { getCurrentUser } from "@/lib/session";

export default async function NewEventConversationPage({ params, searchParams }: { params: { slug: string }; searchParams: { user?: string } }) {
  const [event, user] = await Promise.all([findSocialEvent(params.slug), getCurrentUser()]);
  if (!event) notFound();
  const next = `/events/${params.slug}/messages/new?user=${encodeURIComponent(searchParams.user ?? "")}`;
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!searchParams.user) redirect(`/events/${params.slug}/messages`);
  let id: string;
  try {
    id = await getOrCreateEventConversation(event.id, user.id, searchParams.user);
  } catch {
    redirect(`/events/${params.slug}#people`);
  }
  redirect(`/events/${params.slug}/messages/${id}`);
}

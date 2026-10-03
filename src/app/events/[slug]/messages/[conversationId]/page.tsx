import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Avatar from "@/components/Avatar";
import { findSocialEvent } from "@/db/events";
import { getEventConversation } from "@/db/eventMessages";
import { sendEventMessageAction } from "@/lib/actions/eventMessages";
import { getCurrentUser } from "@/lib/session";

export default async function EventConversationPage({ params }: { params: { slug: string; conversationId: string } }) {
  const [event, user] = await Promise.all([findSocialEvent(params.slug), getCurrentUser()]);
  if (!event) notFound();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/events/${params.slug}/messages/${params.conversationId}`)}`);
  const conversation = await getEventConversation(params.conversationId, event.id, user.id);
  if (!conversation) notFound();
  const action = sendEventMessageAction.bind(null, event.slug, conversation.id);
  return <main className="mx-auto max-w-2xl">
    <Link href={`/events/${event.slug}/messages`} className="text-sm text-subtle">← Messages</Link>
    <div className="mt-5 flex items-center gap-3 border-b border-border pb-5"><Avatar name={conversation.otherName} photoUrl={conversation.otherPhotoUrl} size={48} /><div><h1 className="font-black">{conversation.otherName}</h1><p className="text-xs font-semibold text-violet-700">✦ Mutual connection</p></div></div>
    <div className="min-h-[20rem] space-y-3 py-6">{conversation.messages.length ? conversation.messages.map((message) => <div key={message.id} className={`flex ${message.senderUserId === user.id ? "justify-end" : "justify-start"}`}><p className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm ${message.senderUserId === user.id ? "bg-violet-700 text-white" : "bg-surface text-ink"}`}>{message.body}</p></div>) : <p className="py-16 text-center text-subtle">You recognised each other. Say hello ✦</p>}</div>
    <form action={action} className="sticky bottom-3 flex gap-2 rounded-2xl border border-border bg-white p-2 shadow-lg"><input name="body" required maxLength={1000} aria-label="Message" placeholder="Write a message…" className="min-w-0 flex-1 rounded-xl px-3 outline-none" /><button className="rounded-xl bg-ink px-5 py-3 font-bold text-white">Send</button></form>
  </main>;
}

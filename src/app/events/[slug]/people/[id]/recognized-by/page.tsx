import { notFound } from "next/navigation";
import EventConnectionPage from "@/components/events/EventConnectionPage";
import { findEventPerson, findSocialEvent, getEventPersonConnections } from "@/db/events";
import { getCurrentUser } from "@/lib/session";

export default async function RecognizedByPage({ params }: { params: { slug: string; id: string } }) {
  const [event, user] = await Promise.all([findSocialEvent(params.slug), getCurrentUser()]);
  if (!event) notFound();
  const person = await findEventPerson(params.id, user?.id);
  if (!person || person.eventId !== event.id) notFound();
  const { recognizedBy } = await getEventPersonConnections(person, user?.id);
  return <EventConnectionPage slug={event.slug} person={person} people={recognizedBy} title={`${recognizedBy.length} ${recognizedBy.length === 1 ? "person recognizes" : "people recognize"} ${person.displayName}`} empty={`Nobody has publicly recognized ${person.displayName} yet.`} loggedIn={!!user} viewerId={user?.id} analyticsName="recognized_by_opened" />;
}

import { notFound } from "next/navigation";
import EventConnectionPage from "@/components/events/EventConnectionPage";
import { findEventPerson, findSocialEvent, getEventPersonConnections } from "@/db/events";
import { getCurrentUser } from "@/lib/session";

export default async function PeopleRecognizedPage({ params }: { params: { slug: string; id: string } }) {
  const [event, user] = await Promise.all([findSocialEvent(params.slug), getCurrentUser()]);
  if (!event) notFound();
  const person = await findEventPerson(params.id, user?.id);
  if (!person || person.eventId !== event.id) notFound();
  const { recognizedPeople } = await getEventPersonConnections(person, user?.id);
  return <EventConnectionPage slug={event.slug} person={person} people={recognizedPeople} title={`${person.displayName} recognized ${recognizedPeople.length} ${recognizedPeople.length === 1 ? "person" : "people"} at AnimeCon`} empty={`${person.displayName} has not publicly recognized anyone yet.`} loggedIn={!!user} viewerId={user?.id} analyticsName="people_recognized_opened" />;
}

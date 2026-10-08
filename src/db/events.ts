import { db } from "./client";
import { newId } from "@/lib/id";
import type { EventIdentity } from "@/config/eventIdentities";

export interface SocialEvent {
  id: string; slug: string; title: string; venue: string;
  startsAt: string; endsAt: string; description: string;
}

export interface EventPerson {
  id: string; eventId: string; userId: string | null; displayName: string;
  photoUrl: string; identities: EventIdentity[]; sayHi: string;
  fandomTags: string[];
  instagramUrl: string; tiktokUrl: string; source: "self" | "community";
  createdAt: string; recognizedBy: number; recognized: boolean; mutual: boolean;
}

type EventRow = { id: string; slug: string; title: string; venue: string; starts_at: string; ends_at: string; description: string };
type PersonRow = {
  id: string; event_id: string; user_id: string | null; display_name: string;
  photo_url: string; identities: string; fandom_tags: string; say_hi: string; instagram_url: string;
  tiktok_url: string; source: "self" | "community"; created_at: string;
  recognized_by: number; recognized: number; mutual: number;
};

function toEvent(row: EventRow): SocialEvent {
  return { id: row.id, slug: row.slug, title: row.title, venue: row.venue,
    startsAt: row.starts_at, endsAt: row.ends_at, description: row.description };
}

function toPerson(row: PersonRow): EventPerson {
  let identities: EventIdentity[] = [];
  let fandomTags: string[] = [];
  try { identities = JSON.parse(row.identities) as EventIdentity[]; } catch { identities = []; }
  try { fandomTags = JSON.parse(row.fandom_tags) as string[]; } catch { fandomTags = []; }
  return { id: row.id, eventId: row.event_id, userId: row.user_id,
    displayName: row.display_name, photoUrl: row.photo_url, identities, fandomTags,
    sayHi: row.say_hi, instagramUrl: row.instagram_url, tiktokUrl: row.tiktok_url,
    source: row.source, createdAt: row.created_at,
    recognizedBy: Number(row.recognized_by), recognized: !!row.recognized, mutual: !!row.mutual };
}

export async function findSocialEvent(slug: string): Promise<SocialEvent | null> {
  const row = await db.prepare("SELECT id, slug, title, venue, starts_at, ends_at, description FROM social_events WHERE slug = ? AND is_published = 1").get(slug) as EventRow | undefined;
  return row ? toEvent(row) : null;
}

export async function findSocialEventById(id: string): Promise<SocialEvent | null> {
  const row = await db.prepare("SELECT id, slug, title, venue, starts_at, ends_at, description FROM social_events WHERE id = ? AND is_published = 1").get(id) as EventRow | undefined;
  return row ? toEvent(row) : null;
}

export async function findSocialEventForAdmin(slug: string): Promise<(SocialEvent & { isPublished: boolean }) | null> {
  const row = await db.prepare("SELECT id, slug, title, venue, starts_at, ends_at, description, is_published FROM social_events WHERE slug = ?").get(slug) as (EventRow & { is_published: number }) | undefined;
  return row ? { ...toEvent(row), isPublished: !!row.is_published } : null;
}

// Counts are aggregated once for the entire event. There is deliberately no
// per-card correlated query, which keeps this safe for Turso as attendance grows.
export async function listEventPeople(eventId: string, viewerId?: string | null): Promise<EventPerson[]> {
  const rows = await db.prepare(`
    WITH recognition_counts AS (
      SELECT recognized_person_id, COUNT(*) AS recognized_by
      FROM event_recognitions WHERE event_id = ? GROUP BY recognized_person_id
    ), viewer_edges AS (
      SELECT recognized_person_id FROM event_recognitions
      WHERE event_id = ? AND recognizer_user_id = ?
    ), viewer_person AS (
      SELECT id FROM event_people WHERE event_id = ? AND user_id = ? AND is_hidden = 0
    ), reverse_edges AS (
      SELECT DISTINCT recognizer_user_id FROM event_recognitions er
      JOIN viewer_person vp ON er.recognized_person_id = vp.id
      WHERE er.event_id = ?
    )
    SELECT ep.*, COALESCE(rc.recognized_by, 0) AS recognized_by,
      CASE WHEN ve.recognized_person_id IS NULL THEN 0 ELSE 1 END AS recognized,
      CASE WHEN ve.recognized_person_id IS NOT NULL AND re.recognizer_user_id IS NOT NULL THEN 1 ELSE 0 END AS mutual
    FROM event_people ep
    JOIN users u ON ep.user_id IS NULL OR u.id = ep.user_id
    LEFT JOIN recognition_counts rc ON rc.recognized_person_id = ep.id
    LEFT JOIN viewer_edges ve ON ve.recognized_person_id = ep.id
    LEFT JOIN reverse_edges re ON re.recognizer_user_id = ep.user_id
    WHERE ep.event_id = ? AND ep.is_hidden = 0 AND (ep.user_id IS NULL OR u.is_hidden = 0)
    ORDER BY ep.created_at DESC`,
  ).all(eventId, eventId, viewerId ?? "", eventId, viewerId ?? "", eventId, eventId) as PersonRow[];
  return rows.map(toPerson);
}

export async function findEventPerson(id: string, viewerId?: string | null): Promise<EventPerson | null> {
  const rows = await listEventPeopleByIds([id], viewerId);
  return rows[0] ?? null;
}

export async function findEventPersonByUser(eventId: string, userId: string, viewerId?: string | null): Promise<EventPerson | null> {
  const row = await db.prepare("SELECT id FROM event_people WHERE event_id=? AND user_id=? AND is_hidden=0 ORDER BY created_at DESC LIMIT 1").get(eventId, userId) as { id: string } | undefined;
  return row ? findEventPerson(row.id, viewerId) : null;
}

async function listEventPeopleByIds(ids: string[], viewerId?: string | null): Promise<EventPerson[]> {
  if (!ids.length) return [];
  const marks = ids.map(() => "?").join(",");
  const rows = await db.prepare(`
    WITH recognition_counts AS (
      SELECT recognized_person_id, COUNT(*) AS recognized_by FROM event_recognitions
      WHERE recognized_person_id IN (${marks}) GROUP BY recognized_person_id
    )
    SELECT ep.*, COALESCE(rc.recognized_by, 0) AS recognized_by,
      EXISTS(SELECT 1 FROM event_recognitions er WHERE er.event_id=ep.event_id AND er.recognizer_user_id=? AND er.recognized_person_id=ep.id) AS recognized,
      CASE WHEN ep.user_id IS NOT NULL
        AND EXISTS(SELECT 1 FROM event_recognitions outgoing WHERE outgoing.event_id=ep.event_id AND outgoing.recognizer_user_id=? AND outgoing.recognized_person_id=ep.id)
        AND EXISTS(SELECT 1 FROM event_recognitions reverse_edge
          JOIN event_people viewer_card ON viewer_card.id=reverse_edge.recognized_person_id
          WHERE reverse_edge.event_id=ep.event_id AND reverse_edge.recognizer_user_id=ep.user_id
            AND viewer_card.user_id=? AND viewer_card.is_hidden=0)
        THEN 1 ELSE 0 END AS mutual
    FROM event_people ep LEFT JOIN recognition_counts rc ON rc.recognized_person_id=ep.id
    LEFT JOIN users u ON ep.user_id=u.id
    WHERE ep.id IN (${marks}) AND ep.is_hidden=0 AND (ep.user_id IS NULL OR u.is_hidden=0)`
  ).all(...ids, viewerId ?? "", viewerId ?? "", viewerId ?? "", ...ids) as PersonRow[];
  return rows.map(toPerson);
}

export async function getEventPersonConnections(person: EventPerson, viewerId?: string | null): Promise<{ recognizedBy: EventPerson[]; recognizedPeople: EventPerson[] }> {
  const recognizedByIds = (await db.prepare(`SELECT ep.id FROM event_recognitions er JOIN event_people ep ON ep.event_id=er.event_id AND ep.user_id=er.recognizer_user_id WHERE er.recognized_person_id=? AND ep.is_hidden=0 ORDER BY er.created_at DESC`).all(person.id) as Array<{ id: string }>).map((row) => row.id);
  const recognizedPeopleIds = person.userId ? (await db.prepare(`SELECT recognized_person_id AS id FROM event_recognitions WHERE event_id=? AND recognizer_user_id=? ORDER BY created_at DESC`).all(person.eventId, person.userId) as Array<{ id: string }>).map((row) => row.id) : [];
  const [recognizedBy, recognizedPeople] = await Promise.all([listEventPeopleByIds(recognizedByIds, viewerId), listEventPeopleByIds(recognizedPeopleIds, viewerId)]);
  return { recognizedBy, recognizedPeople };
}

export async function upsertSelfAtEvent(params: { eventId: string; userId: string; displayName: string; photoUrl: string; identities: EventIdentity[]; fandomTags?: string[]; sayHi: string; instagramUrl: string; tiktokUrl: string }): Promise<string> {
  // Despite the legacy function name, every submission creates a new card.
  // One account may represent several looks/personas at the same event.
  const id = newId();
  try {
    await db.prepare(`INSERT INTO event_people (id,event_id,user_id,display_name,photo_url,identities,fandom_tags,say_hi,instagram_url,tiktok_url,source) VALUES (?,?,?,?,?,?,?,?,?,?,'self')`).run(id, params.eventId, params.userId, params.displayName, params.photoUrl, JSON.stringify(params.identities), JSON.stringify(params.fandomTags ?? []), params.sayHi, params.instagramUrl, params.tiktokUrl);
  } catch (error) {
    // A rolling deployment can briefly serve against an older event_people
    // schema. Keep the core event-card flow available while the idempotent
    // migration adds fandom_tags on the next process start.
    if (!String(error).toLowerCase().includes("fandom_tags")) throw error;
    await db.prepare(`INSERT INTO event_people (id,event_id,user_id,display_name,photo_url,identities,say_hi,instagram_url,tiktok_url,source) VALUES (?,?,?,?,?,?,?,?,?,'self')`).run(id, params.eventId, params.userId, params.displayName, params.photoUrl, JSON.stringify(params.identities), params.sayHi, params.instagramUrl, params.tiktokUrl);
  }
  return id;
}

export async function nominateEventPerson(params: { eventId: string; nominatorId: string; displayName: string; photoUrl: string; identities: EventIdentity[]; fandomTags?: string[]; sayHi: string; instagramUrl: string; tiktokUrl: string }): Promise<string> {
  const id = newId();
  try {
    await db.prepare(`INSERT INTO event_people (id,event_id,display_name,photo_url,identities,fandom_tags,say_hi,instagram_url,tiktok_url,source,nominated_by_user_id) VALUES (?,?,?,?,?,?,?,?,?, 'community',?)`).run(id, params.eventId, params.displayName, params.photoUrl, JSON.stringify(params.identities), JSON.stringify(params.fandomTags ?? []), params.sayHi, params.instagramUrl, params.tiktokUrl, params.nominatorId);
  } catch (error) {
    if (!String(error).toLowerCase().includes("fandom_tags")) throw error;
    await db.prepare(`INSERT INTO event_people (id,event_id,display_name,photo_url,identities,say_hi,instagram_url,tiktok_url,source,nominated_by_user_id) VALUES (?,?,?,?,?,?,?,?,'community',?)`).run(id, params.eventId, params.displayName, params.photoUrl, JSON.stringify(params.identities), params.sayHi, params.instagramUrl, params.tiktokUrl, params.nominatorId);
  }
  return id;
}

export async function recognizePerson(eventId: string, recognizerId: string, personId: string): Promise<"created" | "exists" | "self" | "mutual"> {
  const person = await db.prepare("SELECT user_id FROM event_people WHERE id=? AND event_id=? AND is_hidden=0").get(personId, eventId) as { user_id: string | null } | undefined;
  if (!person) throw new Error("Person not found");
  if (person.user_id === recognizerId) return "self";
  const result = await db.prepare("INSERT OR IGNORE INTO event_recognitions (id,event_id,recognizer_user_id,recognized_person_id) VALUES (?,?,?,?)").run(newId(), eventId, recognizerId, personId);
  if (!result.changes) return "exists";
  if (!person.user_id) return "created";
  const reverse = await db.prepare(`SELECT 1 ok FROM event_recognitions er
    JOIN event_people ep ON ep.id = er.recognized_person_id
    WHERE er.event_id=? AND er.recognizer_user_id=?
      AND ep.event_id=? AND ep.user_id=? AND ep.is_hidden=0 LIMIT 1`
  ).get(eventId, person.user_id, eventId, recognizerId);
  return reverse ? "mutual" : "created";
}

export async function listRecentlyRecognized(eventId: string, viewerId?: string | null, limit = 6): Promise<EventPerson[]> {
  const ids = await db.prepare(`SELECT recognized_person_id AS id, MAX(created_at) AS latest FROM event_recognitions WHERE event_id=? GROUP BY recognized_person_id ORDER BY latest DESC LIMIT ?`).all(eventId, limit) as Array<{ id: string }>;
  return listEventPeopleByIds(ids.map((row) => row.id), viewerId);
}

export async function setSocialEventPublished(eventId: string, published: boolean): Promise<void> {
  await db.prepare("UPDATE social_events SET is_published=? WHERE id=?").run(published ? 1 : 0, eventId);
}

export async function setEventPersonHidden(id: string, hidden: boolean): Promise<void> {
  await db.prepare("UPDATE event_people SET is_hidden=? WHERE id=?").run(hidden ? 1 : 0, id);
}

export async function listEventPeopleForAdmin(eventId: string): Promise<Array<{ id: string; displayName: string; source: string; isHidden: boolean; createdAt: string }>> {
  const rows = await db.prepare("SELECT id, display_name, source, is_hidden, created_at FROM event_people WHERE event_id=? ORDER BY created_at DESC").all(eventId) as Array<{ id: string; display_name: string; source: string; is_hidden: number; created_at: string }>;
  return rows.map((row) => ({ id: row.id, displayName: row.display_name, source: row.source, isHidden: !!row.is_hidden, createdAt: row.created_at }));
}

export async function eventAnalytics(eventId: string) {
  const [participants, recognitions, uniqueRecognizers, recognizedPeople, mutualPairs] = await Promise.all([
    db.prepare("SELECT COUNT(*) c FROM event_people WHERE event_id=? AND is_hidden=0").get(eventId),
    db.prepare("SELECT COUNT(*) c FROM event_recognitions WHERE event_id=?").get(eventId),
    db.prepare("SELECT COUNT(DISTINCT recognizer_user_id) c FROM event_recognitions WHERE event_id=?").get(eventId),
    db.prepare("SELECT COUNT(DISTINCT recognized_person_id) c FROM event_recognitions WHERE event_id=?").get(eventId),
    db.prepare(`SELECT COUNT(*) c FROM event_recognitions a JOIN event_people ap ON ap.id=a.recognized_person_id JOIN event_people bp ON bp.event_id=a.event_id AND bp.user_id=a.recognizer_user_id JOIN event_recognitions b ON b.event_id=a.event_id AND b.recognizer_user_id=ap.user_id AND b.recognized_person_id=bp.id WHERE a.event_id=?`).get(eventId),
  ]) as Array<{ c: number }>;
  return { participants: Number(participants.c), recognitions: Number(recognitions.c), uniqueRecognizers: Number(uniqueRecognizers.c), recognizedPeople: Number(recognizedPeople.c), mutuals: Math.floor(Number(mutualPairs.c) / 2) };
}

export async function recordEventAnalytics(params: { eventId: string; eventName: string; userId?: string | null; sessionKey?: string; metadata?: Record<string, string> }): Promise<void> {
  await db.prepare("INSERT INTO event_analytics (id,event_id,event_name,user_id,session_key,metadata) VALUES (?,?,?,?,?,?)").run(newId(), params.eventId, params.eventName, params.userId ?? null, params.sessionKey ?? "", JSON.stringify(params.metadata ?? {}));
}

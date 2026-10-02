import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createUser } from "../src/db/users";
import { ensureMigrated } from "../src/db/schema";
import { findEventPerson, findSocialEvent, getEventPersonConnections, listEventPeople, recognizePerson, upsertSelfAtEvent } from "../src/db/events";
import { safeNextPath } from "../src/lib/safeNextPath";
import { normalizeSocialProfileUrl } from "../src/lib/socialProfileUrl";

async function run() {
  await ensureMigrated();
  await ensureMigrated();
  const event = await findSocialEvent("animecon-london-2026");
  assert(event, "published AnimeCon event is seeded idempotently");
  const a = await createUser({ email: "event-a@example.test", passwordHash: "x", name: "Alice" });
  const b = await createUser({ email: "event-b@example.test", passwordHash: "x", name: "Bob" });
  const c = await createUser({ email: "event-c@example.test", passwordHash: "x", name: "Cara" });
  const alice = await upsertSelfAtEvent({ eventId: event.id, userId: a.id, displayName: "Alice", photoUrl: "https://example.test/a.jpg", identities: ["Artist"], fandomTags: ["Frieren"], sayHi: "Hello", instagramUrl: "", tiktokUrl: "" });
  const bob = await upsertSelfAtEvent({ eventId: event.id, userId: b.id, displayName: "Bob", photoUrl: "https://example.test/b.jpg", identities: ["Cosplayer"], fandomTags: ["One Piece"], sayHi: "Hi", instagramUrl: "", tiktokUrl: "" });
  const cara = await upsertSelfAtEvent({ eventId: event.id, userId: c.id, displayName: "Cara", photoUrl: "https://example.test/c.jpg", identities: ["Creator"], fandomTags: ["Manga"], sayHi: "Hey", instagramUrl: "", tiktokUrl: "" });
  assert.equal(await recognizePerson(event.id, a.id, alice), "self");
  assert.equal(await recognizePerson(event.id, a.id, bob), "created");
  assert.equal(await recognizePerson(event.id, a.id, bob), "exists");
  assert.equal(await recognizePerson(event.id, b.id, alice), "mutual");
  assert.equal(await recognizePerson(event.id, b.id, cara), "created");
  const people = await listEventPeople(event.id, a.id);
  const bobForAlice = people.find((p) => p.id === bob);
  assert.equal(bobForAlice?.recognizedBy, 1);
  assert.equal(bobForAlice?.recognized, true);
  assert.equal(bobForAlice?.mutual, true);
  assert.deepEqual(bobForAlice?.fandomTags, ["One Piece"]);
  const bobProfile = await findEventPerson(bob, a.id);
  assert(bobProfile);
  const bobConnections = await getEventPersonConnections(bobProfile, a.id);
  assert(bobConnections.recognizedPeople.some((person) => person.id === alice));
  assert(bobConnections.recognizedPeople.some((person) => person.id === cara), "A→B→C discovery data is available");
  assert.equal(safeNextPath("/events/animecon-london-2026?action=join"), "/events/animecon-london-2026?action=join");
  assert.equal(safeNextPath("https://evil.example/steal"), "/");
  assert.equal(safeNextPath("//evil.example/steal"), "/");
  assert.equal(normalizeSocialProfileUrl("@anime.fan", "instagram"), "https://instagram.com/anime.fan");
  assert.equal(normalizeSocialProfileUrl("https://tiktok.com/@cosplay_creator", "tiktok"), "https://tiktok.com/@cosplay_creator");
  assert.equal(normalizeSocialProfileUrl("https://evil.example/user", "instagram"), "");
  const hero = readFileSync("src/components/GlobalDiscoveryHero.tsx", "utf8");
  assert(hero.includes("export default function GlobalDiscoveryHero"));
  const eventsDb = readFileSync("src/db/events.ts", "utf8");
  assert(eventsDb.includes("GROUP BY recognized_person_id"));
  console.log("event-social-space: all checks passed");
}

run().catch((error) => { console.error(error); process.exit(1); });

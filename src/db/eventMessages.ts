import { db } from "./client";
import { newId } from "@/lib/id";

export type EventConversation = {
  id: string;
  eventId: string;
  otherUserId: string;
  otherName: string;
  otherPhotoUrl: string;
  lastMessage: string;
  updatedAt: string;
};

export type EventMessage = {
  id: string;
  senderUserId: string;
  body: string;
  createdAt: string;
};

async function assertMutual(eventId: string, userId: string, otherUserId: string) {
  if (userId === otherUserId) throw new Error("You cannot message yourself.");
  const row = await db.prepare(`
    SELECT 1 AS ok
    FROM event_recognitions a
    JOIN event_people target_a ON target_a.id = a.recognized_person_id
    JOIN event_recognitions b ON b.event_id = a.event_id
    JOIN event_people target_b ON target_b.id = b.recognized_person_id
    WHERE a.event_id = ?
      AND a.recognizer_user_id = ? AND target_a.user_id = ?
      AND b.recognizer_user_id = ? AND target_b.user_id = ?
      AND target_a.is_hidden = 0 AND target_b.is_hidden = 0
    LIMIT 1
  `).get(eventId, userId, otherUserId, otherUserId, userId);
  if (!row) throw new Error("Messaging is available after mutual recognition.");
}

export async function getOrCreateEventConversation(eventId: string, userId: string, otherUserId: string) {
  await assertMutual(eventId, userId, otherUserId);
  const [userA, userB] = [userId, otherUserId].sort();
  await db.prepare(`INSERT OR IGNORE INTO event_conversations
    (id,event_id,user_a_id,user_b_id) VALUES (?,?,?,?)`
  ).run(newId(), eventId, userA, userB);
  const row = await db.prepare(`SELECT id FROM event_conversations
    WHERE event_id=? AND user_a_id=? AND user_b_id=?`
  ).get(eventId, userA, userB) as { id: string } | undefined;
  if (!row) throw new Error("Could not open this conversation.");
  return row.id;
}

export async function listEventConversations(eventId: string, userId: string): Promise<EventConversation[]> {
  const rows = await db.prepare(`
    SELECT c.id, c.event_id,
      CASE WHEN c.user_a_id=? THEN c.user_b_id ELSE c.user_a_id END AS other_user_id,
      COALESCE(ep.display_name, u.name) AS other_name,
      COALESCE(ep.photo_url, '') AS other_photo_url,
      COALESCE(m.body, '') AS last_message,
      c.updated_at
    FROM event_conversations c
    JOIN users u ON u.id=CASE WHEN c.user_a_id=? THEN c.user_b_id ELSE c.user_a_id END
    LEFT JOIN event_people ep ON ep.id=(
      SELECT id FROM event_people p WHERE p.event_id=c.event_id
        AND p.user_id=u.id AND p.is_hidden=0 ORDER BY p.created_at DESC LIMIT 1
    )
    LEFT JOIN event_messages m ON m.id=(
      SELECT id FROM event_messages em WHERE em.conversation_id=c.id ORDER BY em.created_at DESC LIMIT 1
    )
    WHERE c.event_id=? AND (c.user_a_id=? OR c.user_b_id=?)
    ORDER BY c.updated_at DESC
  `).all(userId, userId, eventId, userId, userId) as Array<Record<string, string>>;
  return rows.map((r) => ({ id: r.id, eventId: r.event_id, otherUserId: r.other_user_id,
    otherName: r.other_name, otherPhotoUrl: r.other_photo_url, lastMessage: r.last_message, updatedAt: r.updated_at }));
}

export async function getEventConversation(conversationId: string, eventId: string, userId: string) {
  const conversation = await db.prepare(`SELECT id,event_id,user_a_id,user_b_id FROM event_conversations
    WHERE id=? AND event_id=? AND (user_a_id=? OR user_b_id=?)`
  ).get(conversationId, eventId, userId, userId) as { id: string; event_id: string; user_a_id: string; user_b_id: string } | undefined;
  if (!conversation) return null;
  const otherUserId = conversation.user_a_id === userId ? conversation.user_b_id : conversation.user_a_id;
  await assertMutual(eventId, userId, otherUserId);
  const person = await db.prepare(`SELECT display_name,photo_url FROM event_people
    WHERE event_id=? AND user_id=? AND is_hidden=0 ORDER BY created_at DESC LIMIT 1`
  ).get(eventId, otherUserId) as { display_name: string; photo_url: string } | undefined;
  const messages = await db.prepare(`SELECT id,sender_user_id,body,created_at FROM event_messages
    WHERE conversation_id=? ORDER BY created_at ASC LIMIT 200`
  ).all(conversationId) as Array<{ id: string; sender_user_id: string; body: string; created_at: string }>;
  return {
    id: conversation.id,
    otherUserId,
    otherName: person?.display_name ?? "AnimeCon connection",
    otherPhotoUrl: person?.photo_url ?? "",
    messages: messages.map((m): EventMessage => ({ id: m.id, senderUserId: m.sender_user_id, body: m.body, createdAt: m.created_at })),
  };
}

export async function sendEventMessage(conversationId: string, eventId: string, senderUserId: string, body: string) {
  const conversation = await getEventConversation(conversationId, eventId, senderUserId);
  if (!conversation) throw new Error("Conversation not found.");
  const value = body.trim().slice(0, 1000);
  if (!value) throw new Error("Write a message first.");
  const messageId = newId();
  await db.prepare("INSERT INTO event_messages (id,conversation_id,sender_user_id,body) VALUES (?,?,?,?)")
    .run(messageId, conversationId, senderUserId, value);
  await db.prepare("UPDATE event_conversations SET updated_at=datetime('now') WHERE id=?").run(conversationId);
  return { messageId, recipientUserId: conversation.otherUserId };
}

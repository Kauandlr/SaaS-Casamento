import { getDb } from '@/db';
import type { GuestInvitation, InvitationKind } from './wedding-types';

type Row = Record<string, unknown>;
type GuestRow = Row & {
  id: string;
  full_name: string;
  group_name: string;
  group_type: string;
};

const db = getDb;
const now = () => new Date().toISOString();

function base64url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function secureToken() {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

function slugPart(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
}

function normalizedGroupKey(guest: GuestRow) {
  const type = String(guest.group_type || 'individual').toLowerCase();
  const name = String(guest.group_name || '').trim().toLocaleLowerCase('pt-BR');
  return type === 'individual' || !name ? `individual:${guest.id}` : `${type}:${name}`;
}

function displayNames(guests: GuestRow[]) {
  const names = guests.map((guest) => String(guest.full_name).trim()).filter(Boolean);
  if (names.length < 2) return names[0] ?? 'Convite';
  return `${names.slice(0, -1).join(', ')} e ${names.at(-1)}`;
}

function invitationKind(guests: GuestRow[]): InvitationKind {
  const declared = String(guests[0]?.group_type || '').toLowerCase();
  if (declared === 'outro' || declared === 'personalizado') return 'personalizado';
  if (declared === 'família' || declared === 'familia' || guests.length >= 3) return 'familia';
  if (declared === 'casal' || guests.length === 2) return 'casal';
  return 'individual';
}

export async function ensureGuestInvitationGroups(weddingId: string) {
  const wedding = await db().prepare('SELECT public_slug, person_one, person_two FROM weddings WHERE id = ?')
    .bind(weddingId).first<Row>();
  if (!wedding) throw new Error('WEDDING_NOT_FOUND');

  let publicSlug = String(wedding.public_slug ?? '');
  if (!publicSlug) {
    const base = slugPart(`${wedding.person_one}-${wedding.person_two}`) || 'casamento';
    publicSlug = `${base}-${crypto.randomUUID().slice(0, 8)}`;
    await db().prepare('UPDATE weddings SET public_slug = ?, updated_at = ? WHERE id = ?')
      .bind(publicSlug, now(), weddingId).run();
  }

  const guestResult = await db().prepare(`SELECT id, full_name, group_name, group_type
    FROM guests WHERE wedding_id = ? ORDER BY created_at, full_name`).bind(weddingId).all<GuestRow>();
  const existingResult = await db().prepare('SELECT id, group_key FROM guest_invitation_groups WHERE wedding_id = ?')
    .bind(weddingId).all<Row>();
  const existing = new Map(existingResult.results.map((row) => [String(row.group_key), String(row.id)]));
  const groups = new Map<string, GuestRow[]>();
  for (const guest of guestResult.results) {
    const key = normalizedGroupKey(guest);
    groups.set(key, [...(groups.get(key) ?? []), guest]);
  }

  for (const [groupKey, members] of groups) {
    let groupId = existing.get(groupKey);
    if (!groupId) {
      groupId = crypto.randomUUID();
      const type = invitationKind(members);
      const groupName = String(members[0]?.group_name ?? '').trim();
      const name = groupName || displayNames(members);
      await db().prepare(`INSERT INTO guest_invitation_groups (
        id, wedding_id, group_key, name, type, responsible_name, responsible_phone,
        family_name, custom_salutation, additional_guest_limit, public_token, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, '', ?, '', 0, ?, ?, ?)`)
        .bind(
          groupId, weddingId, groupKey, name, type, members[0]?.full_name ?? name,
          type === 'familia' ? groupName : '', secureToken(), now(), now(),
        ).run();
      existing.set(groupKey, groupId);
    }
    await db().prepare(`UPDATE guests SET invitation_group_id = ?
      WHERE wedding_id = ? AND id = ANY(?::uuid[])`)
      .bind(groupId, weddingId, members.map((member) => member.id)).run();
  }

  return publicSlug;
}

export async function getGuestInvitations(weddingId: string): Promise<GuestInvitation[]> {
  const result = await db().prepare(`SELECT id, name, type, responsible_name, responsible_phone,
      family_name, custom_salutation, additional_guest_limit, public_token, last_shared_at,
      last_response_at, rsvp_note
    FROM guest_invitation_groups WHERE wedding_id = ?
      AND EXISTS (SELECT 1 FROM guests WHERE guests.invitation_group_id = guest_invitation_groups.id)
    ORDER BY name`).bind(weddingId).all<Row>();
  const guests = await db().prepare('SELECT id, invitation_group_id FROM guests WHERE wedding_id = ?')
    .bind(weddingId).all<Row>();
  const companions = await db().prepare(`SELECT c.id, c.invitation_group_id, c.name, c.age_group
    FROM invitation_companions c JOIN guest_invitation_groups i ON i.id = c.invitation_group_id
    WHERE i.wedding_id = ?`).bind(weddingId).all<Row>();
  return result.results.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    type: String(row.type) as InvitationKind,
    responsibleName: String(row.responsible_name),
    responsiblePhone: String(row.responsible_phone),
    familyName: String(row.family_name),
    customSalutation: String(row.custom_salutation),
    additionalGuestLimit: Number(row.additional_guest_limit ?? 0),
    token: String(row.public_token),
    lastSharedAt: row.last_shared_at ? new Date(row.last_shared_at as string | Date).toISOString() : null,
    lastResponseAt: row.last_response_at ? new Date(row.last_response_at as string | Date).toISOString() : null,
    rsvpNote: String(row.rsvp_note ?? ''),
    guestIds: guests.results.filter((guest) => guest.invitation_group_id === row.id).map((guest) => String(guest.id)),
    companions: companions.results.filter((companion) => companion.invitation_group_id === row.id).map((companion) => ({
      id: String(companion.id), name: String(companion.name), ageGroup: String(companion.age_group),
    })),
  }));
}

export async function getPublicWedding(slug: string) {
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) return null;
  const wedding = await db().prepare(`SELECT title, person_one, person_two, wedding_date, city
    FROM weddings WHERE public_slug = ? LIMIT 1`).bind(slug).first<Row>();
  if (!wedding) return null;
  return {
    title: String(wedding.title),
    personOne: String(wedding.person_one),
    personTwo: String(wedding.person_two),
    weddingDate: String(wedding.wedding_date),
    city: String(wedding.city),
  };
}


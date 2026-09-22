import { getDb } from '@/db';
import { consumeRateLimit } from './rate-limit';
import {
  isRsvpDeadlineOpen,
  normalizeRsvpName,
  type RsvpAnswer,
} from './rsvp-rules';

export {
  confirmedAgeTotals,
  invitationRsvpStatus,
  isAnsweredRsvp,
  isRsvpDeadlineOpen,
  normalizeRsvpName,
  saoPauloDate,
} from './rsvp-rules';
export type { InvitationRsvpStatus, RsvpAnswer } from './rsvp-rules';

type Row = Record<string, unknown>;

export const RSVP_SESSION_COOKIE = 'vinculo_rsvp_session';
export const RSVP_GENERIC_LOOKUP_ERROR = 'Não encontramos um convite com esse nome. Confira se ele foi digitado da mesma forma que está no convite ou fale com os noivos.';
export const RSVP_GENERIC_PHONE_ERROR = 'Não foi possível validar o convite. Confira os números informados e tente novamente.';
export const RSVP_NO_PHONE_ERROR = 'Este convite precisa ser confirmado diretamente com os noivos.';
export const RSVP_UNAVAILABLE_ERROR = 'As confirmações ainda não estão disponíveis. Fale diretamente com os noivos.';

export type PublicRsvpInvitation = {
  invitation: {
    name: string;
    type: string;
    additionalGuestLimit: number;
    note: string;
    lastResponseAt: string | null;
  };
  wedding: {
    coupleName: string;
    weddingDate: string;
    deadline: string;
    slug: string;
    venue: { name: string; address: string; mapsUrl: string } | null;
  };
  guests: Array<{ id: string; fullName: string; ageGroup: string; rsvp: string }>;
  companions: Array<{ id: string; name: string; ageGroup: string }>;
  canEdit: boolean;
};

function base64url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function opaqueToken() {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

async function digest(value: string) {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
}

export async function fingerprint(value: string) {
  return digest(`rsvp-security:${value}`);
}

function string(value: unknown) {
  return value == null ? '' : String(value);
}

function invitationAliases(invitation: Row, guestNames: string[]) {
  const familyName = string(invitation.family_name);
  return [
    string(invitation.name),
    string(invitation.responsible_name),
    string(invitation.custom_salutation),
    familyName,
    familyName ? `Família ${familyName}` : '',
    ...guestNames,
  ].map(normalizeRsvpName).filter(Boolean);
}

async function weddingBySlug(slug: string) {
  return getDb().prepare(`SELECT id, public_slug, person_one, person_two, wedding_date,
      rsvp_deadline, show_venue_after_rsvp, venue_name, venue_address, venue_maps_url
    FROM weddings WHERE public_slug = ? LIMIT 1`).bind(slug).first<Row>();
}

export async function getPublicRsvpContext(slug: string) {
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) return null;
  const wedding = await weddingBySlug(slug);
  if (!wedding) return null;
  return {
    coupleName: `${wedding.person_one} & ${wedding.person_two}`,
    weddingDate: string(wedding.wedding_date),
    deadline: string(wedding.rsvp_deadline) || null,
  };
}

export async function createLookupChallenge(slug: string, name: string) {
  const normalized = normalizeRsvpName(name);
  if (!normalized) return null;
  const wedding = await weddingBySlug(slug);
  if (!wedding || !wedding.rsvp_deadline) return null;
  const invitations = await getDb().prepare(`SELECT id, name, responsible_name, family_name, custom_salutation
    FROM guest_invitation_groups WHERE wedding_id = ?`).bind(wedding.id).all<Row>();
  const guests = await getDb().prepare(`SELECT invitation_group_id, full_name FROM guests
    WHERE wedding_id = ? AND invitation_group_id IS NOT NULL`).bind(wedding.id).all<Row>();
  const candidates = invitations.results.filter((invitation) => {
    const names = guests.results.filter((guest) => guest.invitation_group_id === invitation.id)
      .map((guest) => string(guest.full_name));
    return invitationAliases(invitation, names).includes(normalized);
  }).map((invitation) => string(invitation.id));
  if (!candidates.length) return null;
  const token = opaqueToken();
  const createdAt = new Date();
  await getDb().prepare(`INSERT INTO rsvp_lookup_challenges
    (token_hash, wedding_id, invitation_ids, expires_at, created_at)
    VALUES (?, ?, ?::jsonb, ?, ?)`)
    .bind(await digest(token), wedding.id, JSON.stringify(candidates),
      new Date(createdAt.getTime() + 10 * 60_000).toISOString(), createdAt.toISOString()).run();
  return token;
}

async function logSecurityEvent(weddingId: string | null, invitationId: string | null, clientId: string, kind: string) {
  const now = new Date().toISOString();
  const db = getDb();
  await db.prepare(`INSERT INTO rsvp_security_events
    (id, wedding_id, invitation_group_id, fingerprint, kind, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), weddingId, invitationId, await fingerprint(clientId), kind, now).run();
  if (crypto.getRandomValues(new Uint8Array(1))[0] === 0) {
    await db.prepare("DELETE FROM rsvp_security_events WHERE created_at < NOW() - INTERVAL '90 days'").run();
    await db.prepare("DELETE FROM rsvp_lookup_challenges WHERE expires_at < NOW()").run();
    await db.prepare("DELETE FROM rsvp_access_sessions WHERE expires_at < NOW()").run();
  }
}

export async function logLookupRateLimit(slug: string, clientId: string) {
  const wedding = await weddingBySlug(slug);
  await logSecurityEvent(wedding ? string(wedding.id) : null, null, clientId, 'lookup_rate_limited_ip');
}

async function challengeInvitationIds(slug: string, challenge: string) {
  const row = await getDb().prepare(`SELECT c.wedding_id, c.invitation_ids
    FROM rsvp_lookup_challenges c JOIN weddings w ON w.id = c.wedding_id
    WHERE c.token_hash = ? AND c.expires_at > NOW() AND w.public_slug = ?`)
    .bind(await digest(challenge), slug).first<Row>();
  if (!row || !Array.isArray(row.invitation_ids)) return null;
  return { weddingId: string(row.wedding_id), ids: row.invitation_ids.map(string) };
}

async function tokenInvitationId(slug: string, token: string) {
  const row = await getDb().prepare(`SELECT i.id, i.wedding_id FROM guest_invitation_groups i
    JOIN weddings w ON w.id = i.wedding_id WHERE w.public_slug = ? AND i.public_token = ? LIMIT 1`)
    .bind(slug, token).first<Row>();
  return row ? { weddingId: string(row.wedding_id), ids: [string(row.id)] } : null;
}

export type ValidateInvitationResult =
  | { ok: true; sessionToken: string; data: PublicRsvpInvitation }
  | { ok: false; reason: 'invalid' | 'no-phone' | 'unavailable' | 'limited' };

export async function validateInvitation(input: {
  slug: string;
  lastFour: string;
  challenge?: string;
  invitationToken?: string;
  clientId: string;
}): Promise<ValidateInvitationResult> {
  const wedding = await weddingBySlug(input.slug);
  if (!wedding?.rsvp_deadline) return { ok: false, reason: 'unavailable' };
  if (!(await consumeRateLimit('rsvp:validate:ip', input.clientId, 20, 15 * 60_000))) {
    await logSecurityEvent(string(wedding.id), null, input.clientId, 'validation_rate_limited_ip');
    return { ok: false, reason: 'limited' };
  }
  const scope = input.invitationToken
    ? await tokenInvitationId(input.slug, input.invitationToken)
    : input.challenge
      ? await challengeInvitationIds(input.slug, input.challenge)
      : null;
  if (!scope || scope.weddingId !== string(wedding.id)) return { ok: false, reason: 'invalid' };
  for (const invitationId of scope.ids) {
    if (!(await consumeRateLimit('rsvp:validate:invite', `${input.clientId}:${invitationId}`, 5, 15 * 60_000))) {
      await logSecurityEvent(scope.weddingId, invitationId, input.clientId, 'validation_rate_limited_invitation');
      return { ok: false, reason: 'limited' };
    }
  }
  const rows = await getDb().prepare(`SELECT id, responsible_phone FROM guest_invitation_groups
    WHERE wedding_id = ? AND id = ANY(?::uuid[])`).bind(scope.weddingId, scope.ids).all<Row>();
  if (rows.results.length === 1 && !string(rows.results[0].responsible_phone).replace(/\D/g, '')) {
    return { ok: false, reason: 'no-phone' };
  }
  const matches = rows.results.filter((row) => string(row.responsible_phone).replace(/\D/g, '').slice(-4) === input.lastFour);
  if (matches.length !== 1) {
    await Promise.all(scope.ids.map((id) => logSecurityEvent(scope.weddingId, id, input.clientId, 'validation_failed')));
    return { ok: false, reason: 'invalid' };
  }
  const invitationId = string(matches[0].id);
  const token = opaqueToken();
  const createdAt = new Date();
  await getDb().batch([
    getDb().prepare(`INSERT INTO rsvp_access_sessions
      (token_hash, wedding_id, invitation_group_id, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)`)
      .bind(await digest(token), scope.weddingId, invitationId,
        new Date(createdAt.getTime() + 30 * 60_000).toISOString(), createdAt.toISOString()),
    ...(input.challenge
      ? [getDb().prepare('DELETE FROM rsvp_lookup_challenges WHERE token_hash = ?').bind(await digest(input.challenge))]
      : []),
  ]);
  const data = await getInvitationForSession(token, input.slug);
  if (!data) return { ok: false, reason: 'invalid' };
  return { ok: true, sessionToken: token, data };
}

export async function getInvitationForSession(sessionToken: string, slug: string, invitationToken?: string) {
  if (!sessionToken) return null;
  const session = await getDb().prepare(`SELECT s.wedding_id, s.invitation_group_id
    FROM rsvp_access_sessions s JOIN weddings w ON w.id = s.wedding_id
    JOIN guest_invitation_groups i ON i.id = s.invitation_group_id
    WHERE s.token_hash = ? AND s.expires_at > NOW() AND w.public_slug = ?
      AND (?::text IS NULL OR i.public_token = ?)`)
    .bind(await digest(sessionToken), slug, invitationToken ?? null, invitationToken ?? null).first<Row>();
  if (!session) return null;
  return publicInvitation(string(session.wedding_id), string(session.invitation_group_id), slug);
}

async function publicInvitation(weddingId: string, invitationId: string, slug: string): Promise<PublicRsvpInvitation | null> {
  const invitation = await getDb().prepare(`SELECT i.name, i.type, i.additional_guest_limit, i.rsvp_note,
      i.last_response_at, w.person_one, w.person_two, w.wedding_date, w.rsvp_deadline,
      w.show_venue_after_rsvp, w.venue_name, w.venue_address, w.venue_maps_url
    FROM guest_invitation_groups i JOIN weddings w ON w.id = i.wedding_id
    WHERE i.id = ? AND i.wedding_id = ?`).bind(invitationId, weddingId).first<Row>();
  if (!invitation?.rsvp_deadline) return null;
  const guests = await getDb().prepare(`SELECT id, full_name, age_group, rsvp FROM guests
    WHERE invitation_group_id = ? AND wedding_id = ? ORDER BY created_at, full_name`)
    .bind(invitationId, weddingId).all<Row>();
  const companions = await getDb().prepare(`SELECT id, name, age_group FROM invitation_companions
    WHERE invitation_group_id = ? ORDER BY created_at, name`).bind(invitationId).all<Row>();
  const completeVenue = Boolean(invitation.show_venue_after_rsvp && invitation.venue_name && invitation.venue_address && invitation.venue_maps_url);
  const deadline = string(invitation.rsvp_deadline);
  return {
    invitation: {
      name: string(invitation.name), type: string(invitation.type),
      additionalGuestLimit: Number(invitation.additional_guest_limit ?? 0),
      note: string(invitation.rsvp_note),
      lastResponseAt: invitation.last_response_at ? new Date(invitation.last_response_at as string | Date).toISOString() : null,
    },
    wedding: {
      coupleName: `${invitation.person_one} & ${invitation.person_two}`,
      weddingDate: string(invitation.wedding_date), deadline, slug,
      venue: completeVenue ? {
        name: string(invitation.venue_name), address: string(invitation.venue_address), mapsUrl: string(invitation.venue_maps_url),
      } : null,
    },
    guests: guests.results.map((guest) => ({
      id: string(guest.id), fullName: string(guest.full_name), ageGroup: string(guest.age_group), rsvp: string(guest.rsvp),
    })),
    companions: companions.results.map((companion) => ({
      id: string(companion.id), name: string(companion.name), ageGroup: string(companion.age_group),
    })),
    canEdit: isRsvpDeadlineOpen(deadline),
  };
}

export async function savePublicResponses(sessionToken: string, slug: string, input: {
  guests: Array<{ id: string; rsvp: RsvpAnswer }>;
  companions: Array<{ name: string; ageGroup: 'adulto' | 'criança' }>;
  note: string;
}) {
  const session = await getDb().prepare(`SELECT s.wedding_id, s.invitation_group_id
    FROM rsvp_access_sessions s JOIN weddings w ON w.id = s.wedding_id
    WHERE s.token_hash = ? AND s.expires_at > NOW() AND w.public_slug = ?`)
    .bind(await digest(sessionToken), slug).first<Row>();
  if (!session) throw new Error('SESSION_INVALID');
  const weddingId = string(session.wedding_id);
  const invitationId = string(session.invitation_group_id);
  const wedding = await getDb().prepare('SELECT rsvp_deadline FROM weddings WHERE id = ?').bind(weddingId).first<Row>();
  if (!isRsvpDeadlineOpen(string(wedding?.rsvp_deadline))) throw new Error('DEADLINE_CLOSED');
  const invitation = await getDb().prepare('SELECT additional_guest_limit FROM guest_invitation_groups WHERE id = ? AND wedding_id = ?')
    .bind(invitationId, weddingId).first<Row>();
  if (!invitation) throw new Error('SESSION_INVALID');
  if (input.companions.length > Number(invitation.additional_guest_limit ?? 0)) throw new Error('COMPANION_LIMIT');
  const currentGuests = await getDb().prepare(`SELECT id, full_name, age_group, rsvp FROM guests
    WHERE invitation_group_id = ? AND wedding_id = ? ORDER BY created_at`).bind(invitationId, weddingId).all<Row>();
  const allowed = new Set(currentGuests.results.map((guest) => string(guest.id)));
  if (input.guests.length !== allowed.size || input.guests.some((guest) => !allowed.has(guest.id))) throw new Error('INVALID_GUESTS');
  const currentCompanions = await getDb().prepare(`SELECT name, age_group FROM invitation_companions
    WHERE invitation_group_id = ?`).bind(invitationId).all<Row>();
  const timestamp = new Date().toISOString();
  const submissionId = crypto.randomUUID();
  const statements = [
    getDb().prepare(`INSERT INTO rsvp_submissions
      (id, wedding_id, invitation_group_id, source, actor_user_id, note, created_at)
      VALUES (?, ?, ?, 'guest', NULL, ?, ?)`)
      .bind(submissionId, weddingId, invitationId, input.note, timestamp),
  ];
  for (const response of input.guests) {
    const previous = currentGuests.results.find((guest) => guest.id === response.id)!;
    if (string(previous.rsvp) !== response.rsvp) {
      statements.push(getDb().prepare(`INSERT INTO rsvp_response_history
        (id, submission_id, guest_id, subject_name, subject_age_group, previous_response, new_response, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), submissionId, response.id, previous.full_name, previous.age_group,
          string(previous.rsvp) || 'pendente', response.rsvp, timestamp));
    }
    statements.push(getDb().prepare(`UPDATE guests SET rsvp = ?, rsvp_responded_at = ?
      WHERE id = ? AND invitation_group_id = ? AND wedding_id = ?`)
      .bind(response.rsvp, timestamp, response.id, invitationId, weddingId));
  }
  const companionKey = (item: { name?: unknown; age_group?: unknown; ageGroup?: unknown }) =>
    `${normalizeRsvpName(string(item.name))}:${string(item.age_group ?? item.ageGroup)}`;
  const oldKeys = new Map(currentCompanions.results.map((item) => [companionKey(item), item]));
  const newKeys = new Map(input.companions.map((item) => [companionKey(item), item]));
  for (const [key, companion] of oldKeys) if (!newKeys.has(key)) {
    statements.push(getDb().prepare(`INSERT INTO rsvp_response_history
      (id, submission_id, guest_id, subject_name, subject_age_group, previous_response, new_response, created_at)
      VALUES (?, ?, NULL, ?, ?, 'confirmado', 'pendente', ?)`)
      .bind(crypto.randomUUID(), submissionId, companion.name, companion.age_group, timestamp));
  }
  for (const [key, companion] of newKeys) if (!oldKeys.has(key)) {
    statements.push(getDb().prepare(`INSERT INTO rsvp_response_history
      (id, submission_id, guest_id, subject_name, subject_age_group, previous_response, new_response, created_at)
      VALUES (?, ?, NULL, ?, ?, 'pendente', 'confirmado', ?)`)
      .bind(crypto.randomUUID(), submissionId, companion.name, companion.ageGroup, timestamp));
  }
  statements.push(getDb().prepare('DELETE FROM invitation_companions WHERE invitation_group_id = ?').bind(invitationId));
  for (const companion of input.companions) statements.push(getDb().prepare(`INSERT INTO invitation_companions
    (id, invitation_group_id, name, age_group, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), invitationId, companion.name, companion.ageGroup, timestamp, timestamp));
  statements.push(getDb().prepare(`UPDATE guest_invitation_groups SET rsvp_note = ?, last_response_at = ?, updated_at = ?
    WHERE id = ? AND wedding_id = ?`).bind(input.note, timestamp, timestamp, invitationId, weddingId));
  await getDb().batch(statements);
  return publicInvitation(weddingId, invitationId, slug);
}

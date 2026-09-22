export type RsvpAnswer = 'confirmado' | 'não irá';
export type InvitationRsvpStatus = 'pendente' | 'parcial' | 'confirmado' | 'recusado';

export function normalizeRsvpName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

export function isAnsweredRsvp(value: string) {
  return value === 'confirmado' || value === 'não irá';
}

export function invitationRsvpStatus(responses: string[], confirmedCompanions = 0): InvitationRsvpStatus {
  const answered = responses.filter(isAnsweredRsvp).length;
  if (!answered) return 'pendente';
  if (answered < responses.length) return 'parcial';
  return responses.some((response) => response === 'confirmado') || confirmedCompanions > 0 ? 'confirmado' : 'recusado';
}

export function confirmedAgeTotals(people: Array<{ ageGroup: string; rsvp?: string }>) {
  return people.reduce((totals, person) => {
    if (person.rsvp && person.rsvp !== 'confirmado') return totals;
    if (person.ageGroup === 'adulto' || person.ageGroup === 'adolescente') totals.adults += 1;
    else totals.children += 1;
    return totals;
  }, { adults: 0, children: 0 });
}

export function saoPauloDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function isRsvpDeadlineOpen(deadline: string | null | undefined, now = new Date()) {
  return Boolean(deadline && saoPauloDate(now) <= deadline);
}

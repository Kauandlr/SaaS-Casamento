import type { InvitationKind } from './wedding-types';

export type InvitationMessageContext = {
  invitationName: string;
  invitationType: InvitationKind;
  guestNames: string[];
  familyName?: string;
  customSalutation?: string;
  coupleName: string;
  weddingDate: string;
  weddingUrl: string;
  confirmationUrl: string;
};

export const WHATSAPP_COPY_PT_BR = {
  channel: 'WhatsApp manual',
  openedTitle: 'WhatsApp aberto',
  openedDescription: 'A mensagem foi preparada. Conclua o envio pelo WhatsApp.',
  missingPhone: 'O número de WhatsApp não foi informado.',
  invalidPhone: 'Confira o DDD e a quantidade de dígitos do WhatsApp.',
} as const;

export const DEFAULT_INVITATION_MESSAGE_TEMPLATE = `Olá, {nome_do_convite}! 💍

Estamos muito felizes em compartilhar esse momento com {tratamento}.

{frase_de_confirmacao}:

{link_de_confirmacao}

Com carinho,
{nome_do_casal}`;

const BRAZILIAN_AREA_CODES = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34,
  35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63,
  64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86,
  87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

export function normalizeWhatsAppPhone(value: string):
  | { ok: true; value: string }
  | { ok: false; error: string } {
  const raw = value.trim();
  if (!raw) return { ok: false, error: WHATSAPP_COPY_PT_BR.missingPhone };

  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);

  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (!digits.startsWith('55')) {
    return digits.length >= 8 && digits.length <= 15 && !digits.startsWith('0')
      ? { ok: true, value: digits }
      : { ok: false, error: WHATSAPP_COPY_PT_BR.invalidPhone };
  }

  const national = digits.slice(2);
  const areaCode = Number(national.slice(0, 2));
  const subscriber = national.slice(2);
  const validLength = national.length === 10 || national.length === 11;
  const validSubscriber = subscriber.length === 8
    ? /^[2-5]\d{7}$/.test(subscriber)
    : /^9\d{8}$/.test(subscriber);
  if (!validLength || !BRAZILIAN_AREA_CODES.has(areaCode) || !validSubscriber) {
    return { ok: false, error: WHATSAPP_COPY_PT_BR.invalidPhone };
  }
  return { ok: true, value: digits };
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name.trim();
}

function joinNames(names: string[]) {
  const compact = names.map(firstName).filter(Boolean);
  if (compact.length < 2) return compact[0] ?? '';
  return `${compact.slice(0, -1).join(', ')} e ${compact.at(-1)}`;
}

export function deriveInvitationVariables(context: InvitationMessageContext) {
  const plural = context.invitationType !== 'individual' || context.guestNames.length > 1;
  const guestNames = joinNames(context.guestNames);
  let invitationName = context.invitationName.trim() || guestNames;

  if (context.customSalutation?.trim()) {
    invitationName = context.customSalutation.trim();
  } else if (context.invitationType === 'casal' && context.guestNames.length >= 2) {
    invitationName = joinNames(context.guestNames.slice(0, 2));
  } else if (context.invitationType === 'familia') {
    const familyName = context.familyName?.trim();
    invitationName = familyName
      ? (/^família\b/i.test(familyName) ? familyName : `família ${familyName}`)
      : context.invitationName.trim() || `${guestNames} e família`;
  } else if (context.invitationType === 'individual') {
    invitationName = firstName(context.guestNames[0] || invitationName);
  }

  const confirmationAction = context.invitationType === 'familia'
    ? 'confirmem quem estará presente'
    : plural
      ? 'confirmem suas presenças'
      : 'confirme sua presença';
  const confirmationSentence = context.invitationType === 'familia'
    ? 'Acessem nosso convite e confirmem quem estará presente'
    : plural
      ? 'Acessem nosso convite e confirmem suas presenças'
      : 'Acesse nosso convite e confirme sua presença';

  return {
    nome_do_convite: invitationName,
    nomes_dos_convidados: guestNames,
    nome_do_casal: context.coupleName,
    data_do_casamento: context.weddingDate,
    link_do_casamento: context.weddingUrl,
    link_de_confirmacao: context.confirmationUrl,
    tipo_do_convite: context.invitationType,
    tratamento: plural ? 'vocês' : 'você',
    acao_confirmacao: confirmationAction,
    frase_de_confirmacao: confirmationSentence,
  };
}

export function interpolateInvitationMessage(
  template: string,
  context: InvitationMessageContext,
) {
  const variables = deriveInvitationVariables(context);
  return Object.entries(variables).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, value),
    template,
  );
}

export function buildInvitationMessage(context: InvitationMessageContext, template?: string | null) {
  return interpolateInvitationMessage(template?.trim() || DEFAULT_INVITATION_MESSAGE_TEMPLATE, context);
}

export function buildGeneralWeddingMessage(coupleName: string, weddingUrl: string) {
  return `Olá! 💍\n\nEstamos muito felizes em compartilhar esse momento com você.\n\nAcesse nosso site de casamento:\n\n${weddingUrl}\n\nCom carinho,\n${coupleName}`;
}

export function buildWhatsAppUrl(message: string, phone?: string) {
  const destination = phone ? `/${phone}` : '/';
  return `https://wa.me${destination}?text=${encodeURIComponent(message)}`;
}

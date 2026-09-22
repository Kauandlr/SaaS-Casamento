import { env } from 'cloudflare:workers';

type ResendConfig = { apiKey: string; from: string; appUrl: string };

function config(): ResendConfig {
  const values = env as unknown as Record<string, string | undefined>;
  const apiKey = values.RESEND_API_KEY?.trim();
  const from = values.RESEND_FROM_EMAIL?.trim();
  const appUrl = values.APP_URL?.trim();
  if (!apiKey || !from || !appUrl) throw new Error('RESEND_NOT_CONFIGURED');
  const url = new URL(appUrl);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
    throw new Error('APP_URL_INVALID');
  return { apiKey, from, appUrl: url.origin };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
}

export class ResendDeliveryError extends Error {
  constructor(public readonly status: number) { super(`Resend returned HTTP ${status}`); }
}

export async function sendWeddingInvitation(input: { to: string; invitedBy: string; weddingTitle: string; token: string }): Promise<void> {
  const { apiKey, from, appUrl } = config();
  const link = new URL(`/convite?token=${encodeURIComponent(input.token)}`, appUrl).toString();
  const safeLink = escapeHtml(link);
  const subjectTitle = input.weddingTitle.replace(/[\r\n]+/g, ' ').trim();
  const safeTitle = escapeHtml(subjectTitle);
  const safeInviter = escapeHtml(input.invitedBy);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `wedding-invite/${input.token}` },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: `Convite para planejar ${subjectTitle} no Vínculo`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#24302b"><p style="font-size:12px;letter-spacing:.2em;text-transform:uppercase">Vínculo</p><h1>Vocês têm um casamento para planejar juntos.</h1><p>${safeInviter} convidou você para compartilhar o planejamento de <strong>${safeTitle}</strong>.</p><p><a href="${safeLink}" style="display:inline-block;padding:12px 20px;background:#253d32;color:#fff;text-decoration:none;border-radius:8px">Aceitar convite</a></p><p>Este link é pessoal, pode ser usado uma vez e expira em 7 dias.</p><p style="font-size:12px;color:#66736b">Se o botão não funcionar, copie este endereço: ${safeLink}</p></div>`,
      text: `${input.invitedBy} convidou você para compartilhar o planejamento de ${input.weddingTitle} no Vínculo. Aceite em ${link}. O convite expira em 7 dias e pode ser usado uma vez.`,
    }),
  });
  if (!response.ok) throw new ResendDeliveryError(response.status);
}

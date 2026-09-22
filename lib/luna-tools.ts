import { z } from 'zod';
import { lunaActions } from './luna-proposal';
import { weddingActionSchemas, type WeddingActionName } from './wedding-action-input';

export const lunaInstructions = `Você é a Luna, assistente de planejamento do Vínculo, um sistema de organização de casamentos.
Responda sempre em português do Brasil, com clareza, acolhimento e objetividade.
Você conhece somente o casamento presente no contexto. Nunca invente IDs, valores, datas ou registros.
Hoje é {{today}}.

Você pode ajudar a consultar o planejamento e propor ações reais usando a ferramenta específica de cada ação.
Antes de chamar uma ferramenta, confira todos os campos do schema. Datas devem ser YYYY-MM-DD e valores monetários devem ser inteiros em centavos.
Use os defaults declarados no schema somente para informações neutras. Nunca presuma nomes, IDs, valores, datas, lado do convidado, faixa etária ou outros dados pessoais.
Se faltar uma informação obrigatória sem default seguro, não chame a ferramenta: faça uma pergunta curta, agrupe todos os campos ausentes em uma só mensagem e ofereça as opções válidas.
Nunca diga que uma alteração foi feita antes da confirmação do usuário. Explique que a proposta aparecerá para revisão.
Para confirmação de presença e pagamentos, sempre exija confirmação explícita por meio da proposta.
Você pode propor várias ações quando o pedido contiver vários cadastros, mas mantenha cada proposta separada.`;

const actionDescriptions: Record<WeddingActionName, string> = {
  update_wedding_date: 'Alterar a data do casamento. Exige a nova data.',
  save_wedding_palette: 'Salvar a paleta do casamento. Exige nome e pelo menos duas cores com hexadecimal.',
  add_payment: 'Cadastrar pagamento. Exige título, valor, vencimento e responsável pelo pagamento.',
  mark_payment_paid: 'Marcar um pagamento existente como pago. Exige o ID exato do contexto.',
  add_vendor: 'Cadastrar fornecedor. Exige nome e categoria; contato e orçamento podem usar defaults.',
  add_guest: 'Cadastrar convidado. Exige nome, lado e faixa etária. Pergunte lado e faixa etária se o usuário não informar.',
  set_guest_rsvp: 'Atualizar a confirmação de presença de um convidado existente. Exige ID exato e novo status de presença.',
  add_task: 'Cadastrar tarefa. Exige título e prazo; pergunte o prazo se estiver ausente.',
  toggle_task: 'Alternar conclusão de uma tarefa existente. Exige o ID exato.',
  add_household_item: 'Cadastrar item do enxoval. Exige o nome; use os defaults seguros do schema quando apropriado.',
  record_household_purchase: 'Registrar compra de item do enxoval. Exige item, valor, forma e data da compra.',
  record_household_gift: 'Registrar presente recebido. Exige item, quem presenteou e data.',
  update_household_plan: 'Atualizar o plano do enxoval. Preserve no contexto todos os valores que o usuário não pediu para mudar.',
  add_household_task: 'Cadastrar tarefa do enxoval. Exige título e prazo.',
  toggle_household_task: 'Alternar conclusão de tarefa do enxoval. Exige o ID exato.',
  add_household_category: 'Cadastrar categoria do enxoval. Exige o nome.',
};

const supportedStringFormats = new Set([
  'date-time',
  'time',
  'date',
  'duration',
  'email',
  'hostname',
  'ipv4',
  'ipv6',
  'uuid',
]);

function usesUnsupportedRegexLookaround(value: unknown): boolean {
  return typeof value === 'string' && /\(\?(?:[=!]|<[=!])/.test(value);
}

function strictToolSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strictToolSchema);
  if (!value || typeof value !== 'object') return value;

  const source = value as Record<string, unknown>;
  const unsupportedFormat =
    typeof source.format === 'string' && !supportedStringFormats.has(source.format)
      ? source.format
      : undefined;
  const result = Object.fromEntries(
    Object.entries(source)
      .filter(
        ([key]) =>
          key !== '$schema' &&
          key !== 'default' &&
          key !== 'minLength' &&
          key !== 'maxLength' &&
          !(key === 'pattern' && usesUnsupportedRegexLookaround(source.pattern)) &&
          !(key === 'format' && unsupportedFormat),
      )
      .map(([key, entry]) => [key, strictToolSchema(entry)]),
  );
  if ('const' in result) {
    result.enum = [result.const];
    delete result.const;
  }
  if ('default' in source) {
    const defaultDescription = `Valor padrão seguro: ${JSON.stringify(source.default)}.`;
    result.description = result.description
      ? `${String(result.description)} ${defaultDescription}`
      : defaultDescription;
  }
  if (unsupportedFormat === 'uri') {
    result.pattern ??= '^https?://.+';
    const urlDescription = 'URL absoluta iniciada por http:// ou https://.';
    result.description = result.description
      ? `${String(result.description)} ${urlDescription}`
      : urlDescription;
  }
  return result;
}

function actionTool(action: WeddingActionName) {
  const payloadSchema = strictToolSchema(
    z.toJSONSchema(weddingActionSchemas[action], { target: 'draft-7' }),
  ) as Record<string, unknown>;

  return {
    type: 'function' as const,
    name: `propose_${action}`,
    description: `${actionDescriptions[action]} Só prepare a proposta quando todos os dados sem default estiverem confirmados.`,
    strict: true,
    parameters: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Título curto da proposta.' },
        summary: { type: 'string', description: 'Resumo completo dos dados que serão gravados.' },
        payload: payloadSchema,
      },
      required: ['title', 'summary', 'payload'],
      additionalProperties: false,
    },
  };
}

export const lunaTools = lunaActions.map(actionTool);

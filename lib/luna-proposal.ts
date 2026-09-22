import { z } from 'zod';
import {
  isWeddingActionName,
  parseWeddingActionPayload,
  weddingActionNames,
  type WeddingActionName,
} from './wedding-action-input';

export const lunaActions = weddingActionNames;

export const lunaProposalSchema = z.object({
  action: z.enum(lunaActions),
  title: z.string().trim().min(2).max(120),
  summary: z.string().trim().min(2).max(500),
  payload: z.record(z.string(), z.unknown()),
});

export type LunaProposal = z.infer<typeof lunaProposalSchema> & {
  id: string;
  status: string;
};

export function lunaProposalFromToolCall(
  toolName: unknown,
  argumentsJson: unknown,
): z.infer<typeof lunaProposalSchema> | null {
  let action: WeddingActionName | undefined;
  if (toolName === 'propose_household_item') action = 'add_household_item';
  else if (typeof toolName === 'string' && toolName.startsWith('propose_')) {
    const candidate = toolName.slice('propose_'.length);
    if (isWeddingActionName(candidate)) action = candidate;
  }
  if (toolName !== 'propose_wedding_action' && !action) return null;

  const parsedArguments = JSON.parse(String(argumentsJson)) as unknown;
  const proposal =
    action && parsedArguments && typeof parsedArguments === 'object'
      ? { ...parsedArguments, action }
      : parsedArguments;

  const parsedProposal = lunaProposalSchema.parse(proposal);
  return {
    ...parsedProposal,
    payload: parseWeddingActionPayload(parsedProposal.action, parsedProposal.payload) as Record<
      string,
      unknown
    >,
  };
}

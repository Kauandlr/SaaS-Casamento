import { z } from 'zod';

export const lunaActions = [
  'add_payment',
  'mark_payment_paid',
  'add_vendor',
  'add_guest',
  'set_guest_rsvp',
  'add_task',
  'toggle_task',
  'add_household_item',
  'record_household_purchase',
  'record_household_gift',
  'update_household_plan',
  'add_household_task',
  'toggle_household_task',
  'add_household_category',
] as const;

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
  if (
    toolName !== 'propose_wedding_action' &&
    toolName !== 'propose_household_item'
  ) {
    return null;
  }

  const parsedArguments = JSON.parse(String(argumentsJson)) as unknown;
  const proposal =
    toolName === 'propose_household_item' &&
    parsedArguments &&
    typeof parsedArguments === 'object'
      ? { ...parsedArguments, action: 'add_household_item' }
      : parsedArguments;

  return lunaProposalSchema.parse(proposal);
}

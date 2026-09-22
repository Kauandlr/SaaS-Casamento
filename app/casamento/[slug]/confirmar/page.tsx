import { CalendarDots } from '@phosphor-icons/react/dist/ssr';
import { notFound } from 'next/navigation';
import { withRequestDb } from '@/db';
import { getPublicRsvpContext } from '@/lib/rsvp';
import { RsvpFlow } from './rsvp-flow';

export const dynamic = 'force-dynamic';

export default async function ConfirmationLookupPage({ params }: { params: Promise<{ slug: string }> }) {
  return withRequestDb(async () => {
    const { slug } = await params;
    const wedding = await getPublicRsvpContext(slug);
    if (!wedding) notFound();
    const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${wedding.weddingDate}T12:00:00Z`));
    return <main className="min-h-[100dvh] overflow-x-hidden bg-background px-4 py-8 text-foreground sm:py-14"><div className="mx-auto w-full min-w-0 max-w-xl"><header className="mb-7 border-b border-border pb-6"><p className="text-sm font-medium text-primary">{wedding.coupleName}</p><p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><CalendarDots size={17} />{date}</p></header><RsvpFlow slug={slug} deadline={wedding.deadline} /><p className="mt-8 text-xs leading-5 text-muted-foreground">Seus dados são usados somente para localizar e confirmar este convite.</p></div></main>;
  });
}

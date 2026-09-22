import { CalendarDots } from '@phosphor-icons/react/dist/ssr';
import { notFound } from 'next/navigation';
import { withRequestDb } from '@/db';
import { getPublicRsvpContext } from '@/lib/rsvp';
import { RsvpFlow } from '../rsvp-flow';

export const dynamic = 'force-dynamic';

export default async function ConfirmationPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  return withRequestDb(async () => {
    const { slug, token } = await params;
    const wedding = await getPublicRsvpContext(slug);
    if (!wedding || !/^[A-Za-z0-9_-]{43}$/.test(token)) notFound();
    const formattedDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${wedding.weddingDate}T12:00:00Z`));
    return (
      <main className="min-h-dvh bg-background px-4 py-8 text-foreground sm:py-14">
        <div className="mx-auto max-w-xl">
          <header className="mb-8 border-b border-border pb-7 text-center">
            <p className="text-sm font-medium text-primary">{wedding.coupleName}</p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><CalendarDots size={17} />{formattedDate}</span>
            </div>
          </header>
          <RsvpFlow slug={slug} invitationToken={token} deadline={wedding.deadline} />
          <p className="mt-8 text-xs leading-5 text-muted-foreground">Este link localiza somente um convite. Os nomes aparecem apenas depois da validação do telefone.</p>
        </div>
      </main>
    );
  });
}

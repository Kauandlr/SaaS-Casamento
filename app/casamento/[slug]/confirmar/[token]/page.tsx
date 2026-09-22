import { CalendarDots, MapPin } from '@phosphor-icons/react/dist/ssr';
import { notFound } from 'next/navigation';
import { withRequestDb } from '@/db';
import { getPublicInvitation } from '@/lib/guest-invitations';
import { RsvpForm } from './rsvp-form';

export const dynamic = 'force-dynamic';

export default async function ConfirmationPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  return withRequestDb(async () => {
    const { slug, token } = await params;
    const invitation = await getPublicInvitation(slug, token);
    if (!invitation) notFound();
    const formattedDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${invitation.weddingDate}T12:00:00Z`));
    return (
      <main className="min-h-dvh bg-background px-4 py-8 text-foreground sm:py-14">
        <div className="mx-auto max-w-xl">
          <header className="mb-8 border-b border-border pb-7 text-center">
            <p className="text-sm font-medium text-primary">{invitation.coupleName}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-balance">Convite: {invitation.name}</h1>
            <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><CalendarDots size={17} />{formattedDate}</span>
              {invitation.city && <span className="inline-flex items-center gap-1.5"><MapPin size={17} />{invitation.city}</span>}
            </div>
          </header>
          <RsvpForm invitation={invitation} slug={slug} token={token} />
          <p className="mt-8 text-center text-xs text-muted-foreground">Este link é exclusivo deste convite e mostra somente as pessoas vinculadas a ele.</p>
        </div>
      </main>
    );
  });
}

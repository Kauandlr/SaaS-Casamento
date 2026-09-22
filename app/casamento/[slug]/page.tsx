import { CalendarDots, HeartStraight, MapPin } from '@phosphor-icons/react/dist/ssr';
import { notFound } from 'next/navigation';
import { withRequestDb } from '@/db';
import { getPublicWedding } from '@/lib/guest-invitations';

export const dynamic = 'force-dynamic';

export default async function WeddingSitePage({ params }: { params: Promise<{ slug: string }> }) {
  return withRequestDb(async () => {
    const { slug } = await params;
    const wedding = await getPublicWedding(slug);
    if (!wedding) notFound();
    const formattedDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${wedding.weddingDate}T12:00:00Z`));
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-5 py-12 text-foreground">
        <article className="w-full max-w-2xl text-center">
          <HeartStraight className="mx-auto text-primary" size={38} weight="fill" />
          <p className="mt-6 text-sm font-medium text-primary">Vamos nos casar</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] text-balance sm:text-5xl">{wedding.personOne} &amp; {wedding.personTwo}</h1>
          <p className="mx-auto mt-5 max-w-lg text-base leading-7 text-muted-foreground">Será uma alegria celebrar este momento com as pessoas que fazem parte da nossa história.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 border-y border-border py-5 text-sm sm:flex-row sm:gap-6">
            <span className="inline-flex items-center gap-2"><CalendarDots size={19} />{formattedDate}</span>
            {wedding.city && <span className="inline-flex items-center gap-2"><MapPin size={19} />{wedding.city}</span>}
          </div>
        </article>
      </main>
    );
  });
}

import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { withRequestDb } from '@/db';
import { getWeddingInvite } from '@/lib/wedding-invites';
import { hasWorkspace } from '@/lib/wedding-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { AcceptInvite } from './accept-invite';
import { SwitchInviteAccount } from './switch-invite-account';

export const dynamic = 'force-dynamic';

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  return withRequestDb(async () => {
    const token = (await searchParams).token ?? '';
    const invite = await getWeddingInvite(token);
    const user = await getCurrentUser();
    const existingWorkspace = user ? await hasWorkspace(user.userId) : false;
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-md">
          <p className="mb-5 text-center font-mono text-xs uppercase tracking-[0.24em] text-primary">Vínculo</p>
          <Card>
            <CardHeader><CardTitle>{invite ? 'Planejem juntos' : 'Convite indisponível'}</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              {!invite ? (
                <><p className="text-sm text-muted-foreground">Este convite expirou, já foi usado ou foi substituído. Peça um novo link à pessoa que criou o casamento.</p><Link className={buttonVariants({ variant: 'outline' })} href="/">Voltar</Link></>
              ) : existingWorkspace ? (
                <><p className="text-sm text-muted-foreground">Sua conta já pertence a um casamento. Cada conta pode participar de um espaço por vez.</p><Link className={buttonVariants({ variant: 'outline' })} href="/">Ir para meu casamento</Link></>
              ) : user && user.email.toLowerCase() !== invite.invitedEmail ? (
                <><p className="text-sm text-muted-foreground">Este convite para <strong>{invite.title}</strong> foi enviado a <strong>{invite.invitedEmail}</strong>. Você entrou como {user.email}.</p><SwitchInviteAccount token={token} /></>
              ) : user ? (
                <><p className="text-sm text-muted-foreground">{user.displayName}, você foi convidado(a) para <strong>{invite.title}</strong> no e-mail <strong>{invite.invitedEmail}</strong>. Ao aceitar, sua conta terá acesso ao mesmo planejamento.</p><AcceptInvite token={token} /></>
              ) : (
                <><p className="text-sm text-muted-foreground">Você foi convidado(a) para <strong>{invite.title}</strong>. Use o e-mail <strong>{invite.invitedEmail}</strong> para entrar ou criar sua conta.</p><div className="flex gap-3"><Link className={buttonVariants({})} href={`/cadastro?convite=${encodeURIComponent(token)}`}>Criar conta</Link><Link className={buttonVariants({ variant: 'outline' })} href={`/login?convite=${encodeURIComponent(token)}`}>Entrar</Link></div></>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    );
  });
}

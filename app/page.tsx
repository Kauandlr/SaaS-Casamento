import { WeddingApp } from '@/components/wedding-app';
import { getCurrentUser } from '@/lib/auth';
import { getSnapshot, hasWorkspace } from '@/lib/wedding-data';
import { redirect } from 'next/navigation';
import { closeDb } from '@/db';

export const dynamic = 'force-dynamic';

export default async function Home() {
  try {
    const user = await getCurrentUser();
    if (!user) redirect('/login');
    if (!(await hasWorkspace(user.userId))) redirect('/onboarding');
    const snapshot = await getSnapshot({ userId: user.userId, email: user.email, displayName: user.displayName });
    return <WeddingApp initialData={snapshot} displayName={user.displayName} />;
  } finally {
    await closeDb();
  }
}

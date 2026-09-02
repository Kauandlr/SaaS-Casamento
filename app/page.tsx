import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { WeddingApp } from '@/components/wedding-app';
import { getSnapshot } from '@/lib/wedding-data';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await requireChatGPTUser('/');
  const snapshot = await getSnapshot({
    userId: user.userId,
    email: user.email,
    displayName: user.displayName,
  });
  return <WeddingApp initialData={snapshot} displayName={user.displayName} />;
}

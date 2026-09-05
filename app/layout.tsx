import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://vinculo-wedding-os.kauandelara.chatgpt.site'),
  title: 'Vínculo — Wedding Planning OS',
  description: 'Planejamento financeiro, fornecedores, convidados e tarefas do casamento em um só lugar.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Vínculo — Wedding Planning OS',
    description: 'Seu casamento, organizado por inteiro.',
    type: 'website',
    images: [{ url: 'https://vinculo-wedding-os.kauandelara.chatgpt.site/og.png', width: 1729, height: 910, alt: 'Vínculo — Seu casamento, organizado por inteiro.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vínculo — Wedding Planning OS',
    description: 'Seu casamento, organizado por inteiro.',
    images: ['https://vinculo-wedding-os.kauandelara.chatgpt.site/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}

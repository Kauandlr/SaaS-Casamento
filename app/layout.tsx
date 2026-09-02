import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Vínculo — Wedding Planning OS',
  description: 'Planejamento financeiro, fornecedores, convidados e tarefas do casamento em um só lugar.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Vínculo — Wedding Planning OS',
    description: 'Seu casamento, organizado por inteiro.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vínculo — Wedding Planning OS',
    description: 'Seu casamento, organizado por inteiro.',
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

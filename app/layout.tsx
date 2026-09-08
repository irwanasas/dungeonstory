import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Silkscreen } from 'next/font/google';
import './game/styles/index.css';

const pixel = Silkscreen({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-pixel', display: 'swap' });

export const metadata: Metadata = {
  title: 'Own a Dungeon',
  description: 'Build the dungeon. Send in the hero. See if they survive.'
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#07090e'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={pixel.variable}>
      <body>{children}</body>
    </html>
  );
}

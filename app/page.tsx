'use client';

import dynamic from 'next/dynamic';

const GameShell = dynamic(() => import('./game/GameShell'), { ssr: false });

export default function Page() {
  return <GameShell />;
}

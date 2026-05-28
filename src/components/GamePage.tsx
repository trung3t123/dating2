"use client";

import dynamic from "next/dynamic";

const DatingMazeGame = dynamic(
  () => import("@/components/DatingMazeGame").then((m) => m.DatingMazeGame),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[#0a0614]">
        <div className="h-10 w-10 animate-pulse rounded-full bg-pink-400/40" />
        <p className="text-sm text-violet-300">Đang load Dating Maze...</p>
      </div>
    ),
  },
);

export function GamePage() {
  return (
    <main className="h-dvh w-full overflow-hidden">
      <DatingMazeGame />
    </main>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type Phaser from "phaser";
import { GameHUD } from "./GameHUD";
import { GAME_EVENTS, type HudPayload } from "@/game/events";

export function DatingMazeGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [hud, setHud] = useState<HudPayload | null>(null);
  const [inGame, setInGame] = useState(false);
  const [overlay, setOverlay] = useState<string | null>(null);

  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;

    let destroyed = false;

    (async () => {
      const { createDatingMazeGame } = await import("@/game/createGame");
      if (destroyed) return;

      const game = createDatingMazeGame(parent);
      gameRef.current = game;

      game.events.on(GAME_EVENTS.HUD_UPDATE, (payload: HudPayload) => {
        setHud(payload);
        setInGame(true);
        setOverlay(null);
      });

      game.events.on(GAME_EVENTS.GAME_OVER, () => {
        setOverlay("Hết mạng — thử lại nhé!");
        setInGame(false);
      });

      game.events.on(GAME_EVENTS.GAME_WIN, (payload: unknown) => {
        if (payload === null) {
          setHud(null);
          setInGame(false);
          setOverlay(null);
        }
      });
    })();

    const onResize = () => {
      gameRef.current?.scale.resize(
        parent.clientWidth,
        parent.clientHeight,
      );
    };
    window.addEventListener("resize", onResize);

    return () => {
      destroyed = true;
      window.removeEventListener("resize", onResize);
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0a0614]">
      <div ref={containerRef} className="h-full w-full" />
      <GameHUD hud={hud} visible={inGame} />
      {overlay && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/40">
          <p className="rounded-2xl bg-pink-500/20 px-6 py-3 text-lg text-pink-100 backdrop-blur">
            {overlay}
          </p>
        </div>
      )}
    </div>
  );
}

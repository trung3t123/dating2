"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { HudPayload } from "@/game/events";
import { INITIAL_LIVES } from "@/game/types";

interface GameHUDProps {
  hud: HudPayload | null;
  visible: boolean;
}

export function GameHUD({ hud, visible }: GameHUDProps) {
  if (!visible || !hud) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4">
      <div className="flex justify-end gap-4 flex-col items-end">
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-2xl border border-white/10 bg-black/50 px-4 py-3 backdrop-blur-md"
        >
          <p className="text-xs uppercase tracking-widest text-pink-300/80">
            Stage
          </p>
          <p className="text-lg font-bold text-pink-100">{hud.stageTitle}</p>
          <p className="text-xs text-violet-300/90">{hud.stageSubtitle}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-right backdrop-blur-md"
        >
          <p className="text-xs text-violet-300/80">Mood</p>
          <p className="text-sm font-medium capitalize text-cyan-200">
            {hud.mood}
          </p>
          <p className="mt-1 text-xs text-pink-200">
            {"♥".repeat(Math.max(0, hud.lives))}
            <span className="text-white/20">
              {"♡".repeat(Math.max(0, INITIAL_LIVES - hud.lives))}
            </span>
          </p>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto flex w-full max-w-lg flex-wrap items-center justify-center gap-3 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 backdrop-blur-md"
      >
        <span className="text-xs text-violet-300">
          Items {hud.collectibles}/{hud.totalCollectibles}
        </span>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            hud.dashReady
              ? "bg-pink-500/30 text-pink-100"
              : "bg-white/10 text-white/40"
          }`}
        >
          Dash {hud.dashReady ? "ready" : "…"}
        </span>
        <AnimatePresence>
          {hud.powerUp && (
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="rounded-full bg-cyan-500/25 px-3 py-1 text-xs text-cyan-100"
            >
              {hud.powerUp}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

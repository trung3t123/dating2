import Phaser from "phaser";
import type { ExitChoice } from "./types";

/** Logo emoji theo từng lối ra (dễ nhận trong maze). */
export const EXIT_ICONS: Record<string, string> = {
  hotpot: "🍲",
  bbq: "🔥",
  ramen: "🍜",
  softmeal: "🥗",
  jazz: "🎷",
  pub: "🍺",
  arcade: "🕹️",
  books: "📚",
  street: "👟",
  classy: "👔",
  retro: "📼",
  whatever: "🎲",
  midnight: "🌙",
  overnight: "🌃",
  home: "🏠",
  detour: "✨",
};

const EXIT_DISPLAY_LABELS: Partial<Record<string, string>> = {
  softmeal: "Soft Meal",
  detour: "Detour",
};

export function getExitIcon(exitId: string): string {
  return EXIT_ICONS[exitId] ?? "🚪";
}

export function getExitDisplayLabel(choice: ExitChoice): string {
  return EXIT_DISPLAY_LABELS[choice.id] ?? choice.label;
}

export function exitAccentColor(choice: ExitChoice): number {
  return Phaser.Display.Color.HexStringToColor(choice.color).color;
}

export const GAME_EVENTS = {
  HUD_UPDATE: "hud-update",
  STAGE_COMPLETE: "stage-complete",
  GAME_OVER: "game-over",
  GAME_WIN: "game-win",
} as const;

export interface HudPayload {
  stageTitle: string;
  stageSubtitle: string;
  lives: number;
  mood: string;
  collectibles: number;
  totalCollectibles: number;
  dashReady: boolean;
  powerUp?: string;
}

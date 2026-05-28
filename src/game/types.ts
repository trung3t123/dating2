export type GhostBehavior = "patrol" | "random" | "chase" | "predict";

export interface ExitChoice {
  id: string;
  label: string;
  vibe: string;
  color: string;
}

export interface StageConfig {
  id: number;
  title: string;
  subtitle: string;
  theme: string;
  palette: {
    wall: number;
    floor: number;
    accent: number;
    glow: number;
    particle: number;
  };
  ghostLabels: string[];
  /** Số ma spawn quanh spawn S (stage 1: 1 con trung tâm). */
  centerGhostSlots?: number;
  /** Base ghost speed; scales slightly per ghost index */
  ghostSpeed?: number;
  exits: ExitChoice[];
  maze: string[];
}

export interface GameRunState {
  choices: { stageId: number; choiceId: string; label: string }[];
  lives: number;
  stageIndex: number;
  mood: string;
}

export const INITIAL_LIVES = 5;

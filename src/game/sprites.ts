/** pac-classic_c-toy.png — 5×6 grid @ 692×1024 (OpenGameArt, Carlos Alface) */
export const CHARACTER_SHEET = "characters";
export const SHEET_FRAME_W = 138;
export const SHEET_FRAME_H = 170;
export const CHARACTER_SCALE = 0.19;

/**
 * Sheet layout (per row, cols 0–3 = ghost directions; col 4 = Pac-Man pose):
 * rows 0–3: Blinky / Pinky / Inky / Clyde + Pac-Man in col 4
 * row 4: frightened ghosts (cols 0–3) + Pac-Man neutral (col 4)
 * row 5: frightened variants (cols 0–3) + Pac-Man closed circle (col 4)
 */
export const PLAYER_FRAMES = {
  idle: 29,
  front: 4,
  back: 19,
  rightOpen: 9,
  rightClosed: 29,
  leftOpen: 14,
  leftClosed: 29,
} as const;

export function ghostFrame(row: number, direction: { x: number; y: number }): number {
  let col = 0;
  if (direction.y < 0) col = 1;
  else if (direction.x < 0) col = 2;
  else if (direction.x > 0) col = 3;
  return row * 5 + col;
}

/** Hàng sprite ma (Blinky) — các ma chỉ khác màu tint. */
export const GHOST_SPRITE_ROW = 0;

export const GHOST_TINTS = [
  0xff5252, // đỏ
  0xffee58, // vàng
  0x448aff, // xanh dương
  0x69f0ae, // xanh lá
  0xff7eb9, // hồng
  0xff9100, // cam
  0xb388ff, // tím
  0x18ffff, // cyan
] as const;

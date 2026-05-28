import Phaser from "phaser";
import { CHARACTER_SHEET, PLAYER_FRAMES, SHEET_FRAME_H, SHEET_FRAME_W } from "../sprites";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload() {
    this.load.spritesheet(CHARACTER_SHEET, "/assets/sprites/pac-classic/pac-classic_c-toy.png", {
      frameWidth: SHEET_FRAME_W,
      frameHeight: SHEET_FRAME_H,
    });
  }

  create() {
    this.createCharacterAnims();
    this.scene.start("MenuScene");
  }

  private createCharacterAnims() {
    for (const key of ["player-chomp-r", "player-chomp-l"] as const) {
      if (this.anims.exists(key)) this.anims.remove(key);
    }

    this.anims.create({
      key: "player-chomp-r",
      frames: [
        { key: CHARACTER_SHEET, frame: PLAYER_FRAMES.rightOpen },
        { key: CHARACTER_SHEET, frame: PLAYER_FRAMES.rightClosed },
      ],
      frameRate: 8,
      repeat: -1,
    });

    this.anims.create({
      key: "player-chomp-l",
      frames: [
        { key: CHARACTER_SHEET, frame: PLAYER_FRAMES.leftOpen },
        { key: CHARACTER_SHEET, frame: PLAYER_FRAMES.leftClosed },
      ],
      frameRate: 8,
      repeat: -1,
    });
  }
}

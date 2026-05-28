import Phaser from "phaser";
import {
  CHARACTER_SCALE,
  CHARACTER_SHEET,
  GHOST_SPRITE_ROW,
  GHOST_TINTS,
  PLAYER_FRAMES,
  ghostFrame,
} from "../sprites";
import { INITIAL_LIVES } from "../types";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: "MenuScene" });
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor("#0f0818");
    this.add.rectangle(width / 2, height * 0.5, width, height, 0x2a1848, 0.35);

    const castY = height * 0.5;
    const ghostY = castY + 28;
    const ghostSpacing = 64;
    const ghostSlots = [
      width / 2 - ghostSpacing * 1.5,
      width / 2 - ghostSpacing * 0.5,
      width / 2 + ghostSpacing * 0.5,
      width / 2 + ghostSpacing * 1.5,
    ];

    GHOST_TINTS.slice(0, 4).forEach((tint, i) => {
      const g = this.add.sprite(
        ghostSlots[i],
        ghostY,
        CHARACTER_SHEET,
        ghostFrame(GHOST_SPRITE_ROW, { x: 0, y: 0 })
      );
      g.setScale(CHARACTER_SCALE * 1.05);
      g.setTint(tint);
      g.setAlpha(0.72);
      g.setDepth(1);
      this.tweens.add({
        targets: g,
        y: ghostY - 5,
        duration: 800 + i * 100,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });

    const heroX = width / 2;
    const heroY = castY - 8;
    const heroScale = CHARACTER_SCALE * 1.55;

    const glow = this.add.circle(heroX, heroY, 42, 0xffe566, 0.22);
    glow.setStrokeStyle(3, 0xff7eb9, 0.85);
    glow.setDepth(2);
    this.tweens.add({
      targets: glow,
      scale: { from: 0.92, to: 1.08 },
      alpha: { from: 0.18, to: 0.32 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
    });

    const hero = this.add.sprite(
      heroX,
      heroY,
      CHARACTER_SHEET,
      PLAYER_FRAMES.rightOpen
    );
    hero.setScale(heroScale);
    hero.setTint(0xfff4b8);
    hero.setDepth(4);
    this.tweens.add({
      targets: hero,
      y: heroY - 6,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    if (this.anims.exists("player-chomp-r")) {
      hero.anims.play("player-chomp-r");
    }

    this.add
      .text(heroX, heroY - 52, "★ BẠN ★", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "15px",
        color: "#1a1028",
        fontStyle: "bold",
        backgroundColor: "#ff7eb9",
        padding: { x: 10, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(5);

    this.add
      .text(
        heroX,
        ghostY + 38,
        "Đây là mấy con ma, nó sẽ đuổi theo em — nhớ mà né",
        {
          fontFamily: "system-ui, sans-serif",
          fontSize: "11px",
          color: "#8a7aaa",
        }
      )
      .setOrigin(0.5)
      .setDepth(3);

    const title = this.add.text(width / 2, height * 0.2, "Dating Maze", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "48px",
      color: "#ffb3e6",
      fontStyle: "bold",
    });
    title.setOrigin(0.5);

    const tagline = this.add.text(
      width / 2,
      height * 0.3,
      "Vượt qua mê cung, chọn cho mình một buổi date lý tưởng nhất <3",
      {
        fontFamily: "system-ui, sans-serif",
        fontSize: "16px",
        color: "#c9b8ff",
        align: "center",
        lineSpacing: 6,
      }
    );
    tagline.setOrigin(0.5);

    const startBtn = this.add
      .text(width / 2, height * 0.7, "▶  Lên kế hoạch thôi nào", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "22px",
        color: "#1a1028",
        backgroundColor: "#ff7eb9",
        padding: { x: 24, y: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    startBtn.on("pointerover", () =>
      startBtn.setStyle({ backgroundColor: "#ffb3e6" })
    );
    startBtn.on("pointerout", () =>
      startBtn.setStyle({ backgroundColor: "#ff7eb9" })
    );
    startBtn.on("pointerdown", () => {
      this.registry.set("runState", {
        choices: [],
        lives: INITIAL_LIVES,
        stageIndex: 0,
        mood: "curious",
      });
      this.scene.start("TransitionScene", { intro: true, stageIndex: 0 });
    });

    this.add
      .text(
        width / 2,
        height * 0.84,
        "Dùng phím WASD hoặc mũi tên để di chuyển, các mục tiêu nằm ở các góc bản đồ, hãy tìm cách để đi tới đó",
        {
          fontFamily: "system-ui, sans-serif",
          fontSize: "13px",
          color: "#6a5a88",
        }
      )
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.93, "Sprites: Carlos Alface · OpenGameArt", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "10px",
        color: "#4a3a68",
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: title,
      y: title.y - 6,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }
}

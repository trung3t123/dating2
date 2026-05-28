import Phaser from "phaser";
import { computeEnding } from "../endings";
import type { GameRunState } from "../types";
import { GAME_EVENTS } from "../events";

export class EndingScene extends Phaser.Scene {
  constructor() {
    super({ key: "EndingScene" });
  }

  create() {
    const { width, height } = this.scale;
    const runState = this.registry.get("runState") as GameRunState;
    const ending = computeEnding(runState);

    this.cameras.main.setBackgroundColor("#0f0818");

    this.add
      .text(width / 2, 70, ending.emoji, { fontSize: "56px" })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 140, ending.title, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "28px",
        color: "#ffb3e6",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: width - 48 },
      })
      .setOrigin(0.5, 0);

    this.add
      .text(width / 2, 220, ending.description, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "15px",
        color: "#c9b8ff",
        align: "center",
        lineSpacing: 8,
        wordWrap: { width: width - 56 },
      })
      .setOrigin(0.5, 0);

    this.add
      .text(width / 2, height * 0.52, "Lộ trình của bạn", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: "#6a5a88",
      })
      .setOrigin(0.5);

    const timeline = runState.choices
      .map((c, i) => `${i + 1}. ${c.label}`)
      .join("\n");

    this.add
      .text(width / 2, height * 0.58, timeline, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: "#7ee8fa",
        align: "center",
        lineSpacing: 10,
      })
      .setOrigin(0.5, 0);

    const replay = this.add
      .text(width / 2, height - 80, "↺ Chơi lại", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "18px",
        color: "#1a1028",
        backgroundColor: "#ff7eb9",
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    replay.on("pointerdown", () => {
      this.game.events.emit(GAME_EVENTS.GAME_WIN, null);
      this.scene.start("MenuScene");
    });
  }
}

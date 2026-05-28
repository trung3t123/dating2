import Phaser from "phaser";
import { STAGES } from "../stages";
import { GAME_EVENTS } from "../events";

export class TransitionScene extends Phaser.Scene {
  constructor() {
    super({ key: "TransitionScene" });
  }

  init(data: {
    stageIndex: number;
    intro?: boolean;
    choiceLabel?: string;
    choiceVibe?: string;
  }) {
    this.data.set("stageIndex", data.stageIndex);
    this.data.set("intro", data.intro ?? false);
    this.data.set("choiceLabel", data.choiceLabel ?? "");
    this.data.set("choiceVibe", data.choiceVibe ?? "");
  }

  create() {
    const { width, height } = this.scale;
    const stageIndex = this.data.get("stageIndex") as number;
    const intro = this.data.get("intro") as boolean;

    this.cameras.main.setBackgroundColor("#0a0614");
    this.cameras.main.fadeIn(400, 0, 0, 0);

    if (intro) {
      this.showStageIntro(width, height, stageIndex);
      return;
    }

    this.showChoiceTransition(width, height, stageIndex);
  }

  private showStageIntro(width: number, height: number, stageIndex: number) {
    const stage = STAGES[stageIndex];
    if (!stage) {
      this.scene.start("MenuScene");
      return;
    }

    this.add
      .text(width / 2, height * 0.32, `Stage ${stage.id}`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "18px",
        color: "#9b8ab8",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.42, stage.title, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "40px",
        color: "#ffb3e6",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.52, stage.subtitle, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "15px",
        color: "#7ee8fa",
      })
      .setOrigin(0.5);

    this.addPlayButton(width, height, () => {
      this.scene.start("MazeScene", { stageIndex });
    });
  }

  private addPlayButton(
    width: number,
    height: number,
    onPlay: () => void,
  ) {
    const playBtn = this.add
      .text(width / 2, height * 0.72, "▶  Play", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "22px",
        color: "#1a1028",
        backgroundColor: "#ff7eb9",
        padding: { x: 24, y: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    playBtn.on("pointerover", () =>
      playBtn.setStyle({ backgroundColor: "#ffb3e6" }),
    );
    playBtn.on("pointerout", () =>
      playBtn.setStyle({ backgroundColor: "#ff7eb9" }),
    );
    playBtn.on("pointerdown", () => {
      playBtn.disableInteractive();
      onPlay();
    });
  }

  private showChoiceTransition(width: number, height: number, stageIndex: number) {
    const choiceLabel = this.data.get("choiceLabel") as string;
    const choiceVibe = this.data.get("choiceVibe") as string;
    const nextStage = STAGES[stageIndex + 1];

    this.add
      .text(width / 2, height * 0.32, "Bạn đã chọn", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "18px",
        color: "#9b8ab8",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.42, choiceLabel, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "40px",
        color: "#ffb3e6",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.52, choiceVibe, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "15px",
        color: "#7ee8fa",
      })
      .setOrigin(0.5);

    const nextText = nextStage
      ? `Tiếp theo: ${nextStage.title}`
      : "Đang tổng kết date của bạn...";

    this.add
      .text(width / 2, height * 0.68, nextText, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "16px",
        color: "#c9b8ff",
      })
      .setOrigin(0.5);

    this.time.delayedCall(2200, () => {
      if (nextStage) {
        this.scene.start("TransitionScene", {
          intro: true,
          stageIndex: stageIndex + 1,
        });
      } else {
        const runState = this.registry.get("runState");
        this.game.events.emit(GAME_EVENTS.GAME_WIN, runState);
        this.scene.start("EndingScene");
      }
    });
  }
}

import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { MenuScene } from "./scenes/MenuScene";
import { MazeScene } from "./scenes/MazeScene";
import { TransitionScene } from "./scenes/TransitionScene";
import { EndingScene } from "./scenes/EndingScene";

export function createDatingMazeGame(parent: HTMLElement) {
  const width = parent.clientWidth || 800;
  const height = parent.clientHeight || 600;

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width,
    height,
    backgroundColor: "#0a0614",
    physics: {
      default: "arcade",
      arcade: { debug: false },
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, MenuScene, MazeScene, TransitionScene, EndingScene],
  });

  return game;
}

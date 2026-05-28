import Phaser from "phaser";
import { STAGES } from "../stages";
import { GAME_EVENTS } from "../events";
import type { ExitChoice, GameRunState, GhostBehavior, StageConfig } from "../types";
import {
  CHARACTER_SCALE,
  CHARACTER_SHEET,
  GHOST_SPRITE_ROW,
  GHOST_TINTS,
  PLAYER_FRAMES,
  ghostFrame,
} from "../sprites";
import { applyExitShortcuts } from "../mazeShortcuts";
import {
  exitAccentColor,
  getExitDisplayLabel,
  getExitIcon,
} from "../exitVisuals";

const TILE = 26;
const MAP_FIT_PADDING = 32;
/** Người chơi trong vùng spawn (S) — kích hoạt đuổi theo vùng. */
const GHOST_SPAWN_ZONE_RADIUS = 8;
/** Ma phải ở trong cùng vùng spawn/exit thì mới đuổi (không lao từ góc map). */
const GHOST_ZONE_ENGAGE_RADIUS = 8;
/** Người chơi gần cổng exit — chỉ ma gần exit đó mới đuổi. */
const GHOST_EXIT_PLAYER_RADIUS = 4;
/** Ma gần exit (ô Manhattan) khi người chơi vào vùng exit. */
const GHOST_EXIT_GHOST_RADIUS = 7;
/** Đuổi trực tiếp khi ma đủ gần người chơi (không cần vùng đặc biệt). */
const GHOST_VISION_RADIUS = 5;
/** Ma trung tâm: patrol / spawn trong vòng này quanh ô S (Manhattan). */
const CENTER_GHOST_RADIUS = 7;
/** Spawn cách ô S tối thiểu (Manhattan). */
const CENTER_GHOST_MIN_SPAWN_DIST = 5;
/** Khoảng cách Euclidean tối thiểu — tránh spawn cùng hành lang (stage 4). */
const CENTER_GHOST_MIN_SPAWN_EUCLID = 5;
/** Tốc độ tuần tra ma trung tâm — cố định mọi stage. */
const CENTER_GHOST_SPEED = 36;
/** Hệ số đuổi — ma trung tâm đuổi chậm hơn ma góc. */
const CENTER_GHOST_CHASE_MULT = 0.38;
const CORNER_GHOST_CHASE_MULT = 1.15;
/** Ma góc: tối đa đuổi liên tục rồi về tuần tra. */
const CORNER_CHASE_DURATION_MS = 3000;
const PLAYER_SPEED = 130;
const DASH_SPEED = 280;
const DASH_COOLDOWN_MS = 2000;
const INVIS_DURATION = 5000;
const SLOW_DURATION = 5000;

type Cell = "#" | "." | "o" | "S" | "1" | "2" | "3" | "4";

interface GhostEntity {
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  behavior: GhostBehavior;
  role: "center" | "corner";
  dir: Phaser.Math.Vector2;
  sheetRow: number;
  home: { x: number; y: number };
  patrolPoints: { x: number; y: number }[];
  patrolIdx: number;
  speed: number;
  chaseMult: number;
  patrolRadiusTiles: number;
  /** Ma góc: hết thời điểm này thì về nhà (0 = không trong đợt đuổi). */
  chaseUntil: number;
  frozen: boolean;
  floatPhase: number;
}

export class MazeScene extends Phaser.Scene {
  private stage!: StageConfig;
  private stageIndex = 0;
  private grid: Cell[][] = [];
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private collectibles!: Phaser.Physics.Arcade.Group;
  private exits!: Phaser.Physics.Arcade.StaticGroup;
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerLabel!: Phaser.GameObjects.Text;
  private ghosts: GhostEntity[] = [];
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private dashKey!: Phaser.Input.Keyboard.Key;
  private nextDir = new Phaser.Math.Vector2(0, 0);
  private currentDir = new Phaser.Math.Vector2(0, 0);
  private swipeDir = new Phaser.Math.Vector2(0, 0);
  private isMoving = false;
  private dashReady = true;
  private dashCooldown = 0;
  private invincibleUntil = 0;
  private slowGhostsUntil = 0;
  private powerUpLabel = "";
  private collected = 0;
  private totalCollectibles = 0;
  private collectedTileKeys = new Set<string>();
  private hitCooldown = false;
  private stageComplete = false;
  private exitZones: Map<string, Phaser.GameObjects.Arc> = new Map();
  private mapPixelW = 0;
  private mapPixelH = 0;
  private winnerTile = { x: 0, y: 0 };
  private exitTiles: { x: number; y: number }[] = [];
  private chaseWarmupUntil = 0;

  constructor() {
    super({ key: "MazeScene" });
  }

  init(data: { stageIndex: number }) {
    this.stageIndex = data.stageIndex ?? 0;
    this.stage = STAGES[this.stageIndex];
    this.resetStageState();
  }

  create() {
    this.physics.resume();
    this.tweens.killAll();

    const runState = this.registry.get("runState") as GameRunState;
    this.parseMaze();
    this.mapPixelW = this.grid[0].length * TILE;
    this.mapPixelH = this.grid.length * TILE;

    this.cameras.main.setBackgroundColor("#0a0614");
    this.physics.world.setBounds(0, 0, this.mapPixelW, this.mapPixelH);
    this.cameras.main.setBounds(0, 0, this.mapPixelW, this.mapPixelH);

    this.walls = this.physics.add.staticGroup();
    this.collectibles = this.physics.add.group();
    this.exits = this.physics.add.staticGroup();

    this.winnerTile = this.findPlayerSpawnTile();
    this.exitTiles = this.findExitTiles();
    this.chaseWarmupUntil = this.time.now + 2500;
    this.drawMaze();
    this.createPlayer();
    this.createGhosts();
    this.setupInput();

    this.physics.add.collider(this.player, this.walls);
    this.physics.add.overlap(this.player, this.collectibles, (_p, item) =>
      this.onCollect(item as Phaser.GameObjects.GameObject),
    );
    this.physics.add.overlap(this.player, this.exits, (_p, exitObj) =>
      this.onReachExit(exitObj as Phaser.GameObjects.Arc),
    );

    if (this.stageIndex >= 2) {
      this.time.addEvent({
        delay: 12000 - this.stageIndex * 1500,
        loop: true,
        callback: () => {
          this.ghosts.forEach((g) => (g.speed = Math.min(g.speed + 5, 130)));
        },
      });
    }

    this.emitHud(runState);
    this.fitCameraToMap();
    this.scale.on("resize", this.handleResize, this);
  }

  private handleResize = () => {
    this.fitCameraToMap();
  };

  private fitCameraToMap() {
    const cam = this.cameras.main;
    cam.stopFollow();

    const viewW = this.scale.width - MAP_FIT_PADDING * 2;
    const viewH = this.scale.height - MAP_FIT_PADDING * 2;
    const zoom = Math.min(viewW / this.mapPixelW, viewH / this.mapPixelH);
    cam.setZoom(zoom);
    cam.centerOn(this.mapPixelW / 2, this.mapPixelH / 2);
  }

  shutdown() {
    this.scale.off("resize", this.handleResize, this);
    this.tweens.killAll();
    if (this.input.keyboard) {
      this.input.keyboard.off("keydown-SPACE");
    }
  }

  private resetStageState() {
    this.isMoving = false;
    this.stageComplete = false;
    this.hitCooldown = false;
    this.collected = 0;
    this.collectedTileKeys.clear();
    this.dashReady = true;
    this.dashCooldown = 0;
    this.invincibleUntil = 0;
    this.slowGhostsUntil = 0;
    this.powerUpLabel = "";
    this.nextDir.set(0, 0);
    this.currentDir.set(0, 0);
    this.swipeDir.set(0, 0);
    this.ghosts = [];
    this.exitZones.clear();
    this.chaseWarmupUntil = 0;
  }

  private parseMaze() {
    const withShortcuts = applyExitShortcuts(this.stage.maze);
    this.grid = withShortcuts.map((row) => row.split("") as Cell[]);
    this.totalCollectibles = 0;
    this.grid.forEach((row) =>
      row.forEach((c) => {
        if (c === "o") this.totalCollectibles++;
      }),
    );
  }

  private isWallCell(col: number, row: number) {
    if (row < 0 || col < 0 || row >= this.grid.length || col >= this.grid[0].length) {
      return true;
    }
    return this.grid[row][col] === "#";
  }

  private drawMaze() {
    const { wall, floor, accent, glow } = this.stage.palette;
    const mapW = this.grid[0].length * TILE;
    const mapH = this.grid.length * TILE;

    // Nền tường phủ toàn map → khối tường luôn liền mạch
    this.add.rectangle(mapW / 2, mapH / 2, mapW, mapH, wall, 1).setDepth(0);

    for (let y = 0; y < this.grid.length; y++) {
      for (let x = 0; x < this.grid[y].length; x++) {
        const cell = this.grid[y][x];
        const px = x * TILE + TILE / 2;
        const py = y * TILE + TILE / 2;
        const walkable = cell !== "#";

        if (walkable) {
          this.add.rectangle(px, py, TILE, TILE, floor, 1).setDepth(1);
        }

        if (cell === "#") {
          const block = this.add.rectangle(px, py, TILE, TILE, wall, 1);
          block.setDepth(2);
          this.walls.add(block);
        }

        if (cell === "o") {
          const dot = this.add.circle(px, py, 6, 0xffe066, 1);
          dot.setStrokeStyle(1, accent, 0.9);
          dot.setDepth(2);
          this.physics.add.existing(dot);
          const dotBody = dot.body as Phaser.Physics.Arcade.Body;
          dotBody.setCircle(6);
          dotBody.setAllowGravity(false);
          this.collectibles.add(dot);
          this.tweens.add({
            targets: dot,
            scale: { from: 0.85, to: 1.15 },
            duration: 700,
            yoyo: true,
            repeat: -1,
          });
        }

        if (["1", "2", "3", "4"].includes(cell)) {
          const exitIdx = parseInt(cell, 10) - 1;
          const choice = this.stage.exits[exitIdx];
          this.createExitPortal(px, py, cell, choice, glow);
        }
      }
    }

  }

  private createExitPortal(
    px: number,
    py: number,
    cellKey: string,
    choice: ExitChoice,
    glowColor: number,
  ) {
    const accent = exitAccentColor(choice);
    const icon = getExitIcon(choice.id);
    const label = getExitDisplayLabel(choice);
    const fontSize = label.length > 11 ? "9px" : "10px";

    const pulse = this.add.circle(px, py, 14, accent, 0.28);
    pulse.setStrokeStyle(2, glowColor, 0.85);
    pulse.setDepth(2);

    const badge = this.add.circle(px, py, 11, 0x0a0614, 0.92);
    badge.setStrokeStyle(2, accent, 1);
    badge.setDepth(3);

    this.add
      .text(px, py, icon, { fontSize: "15px" })
      .setOrigin(0.5)
      .setDepth(4);

    this.add
      .text(px, py + 19, label, {
        fontFamily: "system-ui, sans-serif",
        fontSize,
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 4,
        backgroundColor: "#000000e8",
        padding: { x: 6, y: 3 },
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(5);

    const zone = this.add.circle(px, py, TILE * 0.44, accent, 0.001);
    zone.setDepth(1);
    this.physics.add.existing(zone, true);
    const body = zone.body as Phaser.Physics.Arcade.StaticBody;
    if (body) body.setCircle(TILE * 0.44);
    this.exits.add(zone);
    this.exitZones.set(cellKey, zone);

    this.tweens.add({
      targets: pulse,
      scale: { from: 0.88, to: 1.14 },
      alpha: { from: 0.22, to: 0.48 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private createPlayer() {
    let sx = TILE * 2;
    let sy = TILE * 2;
    for (let y = 0; y < this.grid.length; y++) {
      for (let x = 0; x < this.grid[y].length; x++) {
        if (this.grid[y][x] === "S") {
          sx = x * TILE + TILE / 2;
          sy = y * TILE + TILE / 2;
        }
      }
    }

    const sprite = this.add.sprite(sx, sy, CHARACTER_SHEET, PLAYER_FRAMES.idle);
    sprite.setScale(CHARACTER_SCALE);
    sprite.setTint(0xfff0b0);
    sprite.setDepth(5);
    this.physics.add.existing(sprite);
    this.player = sprite as Phaser.Physics.Arcade.Sprite;
    this.setupCharacterBody(this.player);

    this.playerLabel = this.add
      .text(sx, sy - 22, "♡", {
        fontSize: "11px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(6);
  }

  private setupCharacterBody(sprite: Phaser.Physics.Arcade.Sprite) {
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    const r = TILE * 0.38;
    body.setCircle(
      r,
      sprite.displayWidth / 2 - r,
      sprite.displayHeight / 2 - r + 2,
    );
  }

  private updatePlayerVisual(dir: Phaser.Math.Vector2) {
    if (dir.x > 0) {
      this.player.setFlipX(false);
      this.player.anims.play("player-chomp-r", true);
    } else if (dir.x < 0) {
      this.player.setFlipX(false);
      this.player.anims.play("player-chomp-l", true);
    } else if (dir.y < 0) {
      this.player.anims.stop();
      this.player.setFrame(PLAYER_FRAMES.back);
    } else if (dir.y > 0) {
      this.player.anims.stop();
      this.player.setFrame(PLAYER_FRAMES.front);
    } else {
      this.player.anims.stop();
      this.player.setFrame(PLAYER_FRAMES.idle);
    }
  }

  private createGhosts() {
    const baseSpeed = this.stage.ghostSpeed ?? 60;
    const centerSlots = this.stage.centerGhostSlots ?? 1;
    const spawnPoints = this.findGhostSpawnTiles(
      this.stage.ghostLabels.length,
      centerSlots,
    );
    const cornerSlots = this.stage.ghostLabels.length - centerSlots;

    this.stage.ghostLabels.forEach((label, i) => {
      const pt = spawnPoints[i % spawnPoints.length];
      const isCenter = i >= cornerSlots;
      const px = pt.x * TILE + TILE / 2;
      const py = pt.y * TILE + TILE / 2;
      const sprite = this.add.sprite(
        px,
        py,
        CHARACTER_SHEET,
        ghostFrame(GHOST_SPRITE_ROW, new Phaser.Math.Vector2(1, 0)),
      );
      sprite.setScale(CHARACTER_SCALE * 0.95);
      sprite.setTint(GHOST_TINTS[i % GHOST_TINTS.length]);
      sprite.setAlpha(0.92);
      sprite.setDepth(4);

      const ghostLabel = this.add
        .text(px, py + 14, label, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "7px",
          color: "#fff8ff",
          backgroundColor: "#00000066",
          padding: { x: 3, y: 1 },
        })
        .setOrigin(0.5)
        .setDepth(6);

      this.ghosts.push({
        sprite,
        label: ghostLabel,
        behavior: "chase",
        role: isCenter ? "center" : "corner",
        sheetRow: GHOST_SPRITE_ROW,
        home: { x: pt.x, y: pt.y },
        dir: new Phaser.Math.Vector2(Phaser.Math.Between(0, 1) ? 1 : -1, 0),
        patrolPoints: [{ x: px, y: py }],
        patrolIdx: 0,
        speed: isCenter
          ? CENTER_GHOST_SPEED
          : baseSpeed + i * 6 + this.stageIndex * 4,
        chaseMult: isCenter ? CENTER_GHOST_CHASE_MULT : CORNER_GHOST_CHASE_MULT,
        patrolRadiusTiles: isCenter ? CENTER_GHOST_RADIUS : 99,
        chaseUntil: 0,
        frozen: false,
        floatPhase: i * 1.2,
      });
    });
  }

  private worldToTile(x: number, y: number) {
    return {
      col: Math.floor((x - TILE / 2) / TILE),
      row: Math.floor((y - TILE / 2) / TILE),
    };
  }

  private tileToWorld(col: number, row: number) {
    return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
  }

  private isWalkableTile(col: number, row: number) {
    if (row < 0 || col < 0 || row >= this.grid.length || col >= this.grid[0].length) {
      return false;
    }
    return this.grid[row][col] !== "#";
  }

  private countWalkableNeighbors(col: number, row: number) {
    const deltas = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    return deltas.filter(([dc, dr]) => this.isWalkableTile(col + dc, row + dr)).length;
  }

  private isGoodSpawnTile(col: number, row: number) {
    const c = this.grid[row]?.[col];
    if (c !== "." && c !== "o") return false;
    return this.countWalkableNeighbors(col, row) >= 2;
  }

  private isInsideMapBounds(x: number, y: number) {
    const margin = TILE * 0.35;
    return (
      x >= margin &&
      y >= margin &&
      x <= this.mapPixelW - margin &&
      y <= this.mapPixelH - margin
    );
  }

  private findExitTiles() {
    const tiles: { x: number; y: number }[] = [];
    for (let y = 0; y < this.grid.length; y++) {
      for (let x = 0; x < this.grid[y].length; x++) {
        if (["1", "2", "3", "4"].includes(this.grid[y][x])) {
          tiles.push({ x, y });
        }
      }
    }
    return tiles;
  }

  private isPlayerInSpawnZone() {
    const player = this.worldToTile(this.player.x, this.player.y);
    return (
      this.tileDistance(this.winnerTile, {
        x: player.col,
        y: player.row,
      }) <= GHOST_SPAWN_ZONE_RADIUS
    );
  }

  private isGhostInSpawnZone(ghostTile: { col: number; row: number }) {
    return (
      this.tileDistance(this.winnerTile, {
        x: ghostTile.col,
        y: ghostTile.row,
      }) <= GHOST_ZONE_ENGAGE_RADIUS
    );
  }

  /** Ma đuổi khi người chơi gần exit và ma cũng ở vùng exit đó. */
  private isGhostEngagedAtExit(
    playerTile: { col: number; row: number },
    ghostTile: { col: number; row: number },
  ) {
    return this.exitTiles.some((exit) => {
      const playerNear =
        this.tileDistance(exit, { x: playerTile.col, y: playerTile.row }) <=
        GHOST_EXIT_PLAYER_RADIUS;
      if (!playerNear) return false;
      return (
        this.tileDistance(exit, { x: ghostTile.col, y: ghostTile.row }) <=
        GHOST_EXIT_GHOST_RADIUS
      );
    });
  }

  private isPlayerInCenterGhostZone() {
    const player = this.worldToTile(this.player.x, this.player.y);
    return (
      this.tileDistance(this.winnerTile, {
        x: player.col,
        y: player.row,
      }) <= CENTER_GHOST_RADIUS
    );
  }

  private isWithinSpawnPatrolZone(col: number, row: number) {
    return (
      this.tileDistance(this.winnerTile, { x: col, y: row }) <=
      CENTER_GHOST_RADIUS
    );
  }

  private isGhostWithinPatrolRadius(ghost: GhostEntity, col: number, row: number) {
    if (ghost.role === "center") {
      return this.isWithinSpawnPatrolZone(col, row);
    }
    return (
      this.tileDistance(ghost.home, { x: col, y: row }) <= ghost.patrolRadiusTiles
    );
  }

  private shouldGhostChase(ghost: GhostEntity) {
    if (this.time.now < this.chaseWarmupUntil) return false;

    if (ghost.role === "center") {
      return this.isPlayerInCenterGhostZone();
    }

    const player = this.worldToTile(this.player.x, this.player.y);
    const ghostTile = this.worldToTile(ghost.sprite.x, ghost.sprite.y);
    const distToPlayer = this.tileDistance(
      { x: player.col, y: player.row },
      { x: ghostTile.col, y: ghostTile.row },
    );

    if (distToPlayer <= GHOST_VISION_RADIUS) return true;

    if (this.isPlayerInSpawnZone() && this.isGhostInSpawnZone(ghostTile)) {
      return true;
    }

    if (this.isGhostEngagedAtExit(player, ghostTile)) return true;

    return false;
  }

  private getGhostChaseVelocity(ghost: GhostEntity, factor: number) {
    let dx = this.player.x - ghost.sprite.x;
    let dy = this.player.y - ghost.sprite.y;
    dx += Math.cos(ghost.floatPhase) * 10;
    dy += Math.sin(ghost.floatPhase) * 10;
    const len = Math.hypot(dx, dy) || 1;
    const speed = ghost.speed * ghost.chaseMult * factor;
    return { vx: (dx / len) * speed, vy: (dy / len) * speed };
  }

  private isCornerGhostChasing(ghost: GhostEntity) {
    return ghost.chaseUntil > this.time.now;
  }

  private updateCornerGhostChaseTimer(ghost: GhostEntity) {
    if (this.time.now >= ghost.chaseUntil) {
      ghost.chaseUntil = 0;
    }
    if (!this.shouldGhostChase(ghost)) return;
    if (ghost.chaseUntil !== 0) return;

    const homeWorld = this.tileToWorld(ghost.home.x, ghost.home.y);
    const distToHome = Phaser.Math.Distance.Between(
      ghost.sprite.x,
      ghost.sprite.y,
      homeWorld.x,
      homeWorld.y,
    );
    if (distToHome > TILE * 2.5) return;

    ghost.chaseUntil = this.time.now + CORNER_CHASE_DURATION_MS;
  }

  /** Ma góc: sau đợt đuổi, từ từ về nhà rồi tuần tra. */
  private getCornerGhostReturnVelocity(ghost: GhostEntity, factor: number) {
    const homeWorld = this.tileToWorld(ghost.home.x, ghost.home.y);
    const distToHome = Phaser.Math.Distance.Between(
      ghost.sprite.x,
      ghost.sprite.y,
      homeWorld.x,
      homeWorld.y,
    );

    if (distToHome > TILE * 1.8) {
      const dx = homeWorld.x - ghost.sprite.x;
      const dy = homeWorld.y - ghost.sprite.y;
      const len = Math.hypot(dx, dy) || 1;
      const speed = ghost.speed * 0.36 * factor;
      return { vx: (dx / len) * speed, vy: (dy / len) * speed };
    }

    const t = this.time.now * 0.0009 + ghost.floatPhase;
    const targetX = homeWorld.x + Math.cos(t) * TILE * 1.4;
    const targetY = homeWorld.y + Math.sin(t) * TILE * 1.4;
    const dx = targetX - ghost.sprite.x;
    const dy = targetY - ghost.sprite.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = ghost.speed * 0.3 * factor;
    return { vx: (dx / len) * speed, vy: (dy / len) * speed };
  }

  private getCornerGhostVelocity(ghost: GhostEntity, factor: number) {
    this.updateCornerGhostChaseTimer(ghost);
    if (this.isCornerGhostChasing(ghost)) {
      return this.getGhostChaseVelocity(ghost, factor);
    }
    return this.getCornerGhostReturnVelocity(ghost, factor);
  }

  /** Tuần tra mượt quanh nhà — không nhảy waypoint gây quay đầu. */
  private getGhostIdleVelocity(ghost: GhostEntity, factor: number) {
    if (ghost.role === "center") {
      return this.getCenterGhostIdleVelocity(ghost, factor);
    }

    const homeWorld = this.tileToWorld(ghost.home.x, ghost.home.y);
    const distToHome = Phaser.Math.Distance.Between(
      ghost.sprite.x,
      ghost.sprite.y,
      homeWorld.x,
      homeWorld.y,
    );

    if (distToHome > TILE * 2.5) {
      const dx = homeWorld.x - ghost.sprite.x;
      const dy = homeWorld.y - ghost.sprite.y;
      const len = Math.hypot(dx, dy) || 1;
      const speed = ghost.speed * 0.45 * factor;
      return { vx: (dx / len) * speed, vy: (dy / len) * speed };
    }

    const t = this.time.now * 0.0009 + ghost.floatPhase;
    const targetX = homeWorld.x + Math.cos(t) * TILE * 1.4;
    const targetY = homeWorld.y + Math.sin(t) * TILE * 1.4;
    const dx = targetX - ghost.sprite.x;
    const dy = targetY - ghost.sprite.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = ghost.speed * 0.32 * factor;
    return { vx: (dx / len) * speed, vy: (dy / len) * speed };
  }

  private getCenterGhostIdleVelocity(ghost: GhostEntity, factor: number) {
    const spawnWorld = this.tileToWorld(this.winnerTile.x, this.winnerTile.y);
    const ghostTile = this.worldToTile(ghost.sprite.x, ghost.sprite.y);
    const distFromSpawn = this.tileDistance(this.winnerTile, {
      x: ghostTile.col,
      y: ghostTile.row,
    });

    if (distFromSpawn > CENTER_GHOST_RADIUS - 0.5) {
      const dx = spawnWorld.x - ghost.sprite.x;
      const dy = spawnWorld.y - ghost.sprite.y;
      const len = Math.hypot(dx, dy) || 1;
      const speed = ghost.speed * 0.4 * factor;
      return { vx: (dx / len) * speed, vy: (dy / len) * speed };
    }

    const t = this.time.now * 0.00085 + ghost.floatPhase;
    const orbitPx = TILE * 3;
    let targetX = spawnWorld.x + Math.cos(t) * orbitPx;
    let targetY = spawnWorld.y + Math.sin(t) * orbitPx;
    const clamped = this.clampWorldToGhostPatrol(ghost, targetX, targetY);
    targetX = clamped.x;
    targetY = clamped.y;

    const dx = targetX - ghost.sprite.x;
    const dy = targetY - ghost.sprite.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = ghost.speed * 0.3 * factor;
    return { vx: (dx / len) * speed, vy: (dy / len) * speed };
  }

  private clampWorldToGhostPatrol(
    ghost: GhostEntity,
    x: number,
    y: number,
  ) {
    const tile = this.worldToTile(x, y);
    if (this.isGhostWithinPatrolRadius(ghost, tile.col, tile.row)) {
      return { x, y };
    }
    return this.tileToWorld(ghost.home.x, ghost.home.y);
  }

  private clampGhostPosition(ghost: GhostEntity) {
    const tile = this.worldToTile(ghost.sprite.x, ghost.sprite.y);
    if (this.isGhostWithinPatrolRadius(ghost, tile.col, tile.row)) return;

    const home = this.tileToWorld(ghost.home.x, ghost.home.y);
    ghost.sprite.setPosition(home.x, home.y);
  }

  private canGhostMoveTo(ghost: GhostEntity, x: number, y: number) {
    if (!this.isInsideMapBounds(x, y)) return false;
    if (ghost.role !== "center") return true;
    const tile = this.worldToTile(x, y);
    return this.isGhostWithinPatrolRadius(ghost, tile.col, tile.row);
  }

  private findPlayerSpawnTile() {
    for (let y = 0; y < this.grid.length; y++) {
      for (let x = 0; x < this.grid[y].length; x++) {
        if (this.grid[y][x] === "S") return { x, y };
      }
    }
    return {
      x: Math.floor(this.grid[0].length / 2),
      y: Math.floor(this.grid.length / 2),
    };
  }

  private tileDistance(
    a: { x: number; y: number },
    b: { x: number; y: number },
  ) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  private isCenterGhostSpawnTile(col: number, row: number) {
    const cell = this.grid[row]?.[col];
    if (cell === "#" || cell === "S") return false;
    if (!this.isWalkableTile(col, row)) return false;

    const anchor = this.winnerTile;
    const dist = this.tileDistance(anchor, { x: col, y: row });
    if (dist < CENTER_GHOST_MIN_SPAWN_DIST || dist > CENTER_GHOST_RADIUS) {
      return false;
    }

    if (row === anchor.y || col === anchor.x) return false;

    const euclid = Math.hypot(col - anchor.x, row - anchor.y);
    if (euclid < CENTER_GHOST_MIN_SPAWN_EUCLID) return false;

    return true;
  }

  private findCenterGhostHomeTiles(count: number) {
    const anchor = this.winnerTile;
    const pool: { x: number; y: number; dist: number }[] = [];

    for (let y = 0; y < this.grid.length; y++) {
      for (let x = 0; x < this.grid[y].length; x++) {
        if (!this.isCenterGhostSpawnTile(x, y)) continue;
        pool.push({
          x,
          y,
          dist: this.tileDistance(anchor, { x, y }),
        });
      }
    }

    pool.sort((a, b) => b.dist - a.dist);
    const picked: { x: number; y: number }[] = [];

    const tryPickFrom = (tiles: typeof pool) => {
      const shuffled = Phaser.Utils.Array.Shuffle([...tiles]);
      for (const tile of shuffled) {
        if (picked.length >= count) break;
        if (picked.some((p) => p.x === tile.x && p.y === tile.y)) continue;
        picked.push({ x: tile.x, y: tile.y });
      }
    };

    if (pool.length > 0) {
      const maxDist = pool[0].dist;
      const farthest = pool.filter((t) => t.dist === maxDist);
      tryPickFrom(farthest.length > 0 ? farthest : pool);

      for (
        let ring = maxDist - 1;
        picked.length < count && ring >= CENTER_GHOST_MIN_SPAWN_DIST;
        ring--
      ) {
        tryPickFrom(pool.filter((t) => t.dist === ring));
      }
    }

    if (picked.length < count) {
      for (let d = CENTER_GHOST_RADIUS; d >= CENTER_GHOST_MIN_SPAWN_DIST; d--) {
        for (let dc = -d; dc <= d; dc++) {
          for (let dr = -d; dr <= d; dr++) {
            if (Math.abs(dc) + Math.abs(dr) !== d) continue;
            const tx = anchor.x + dc;
            const ty = anchor.y + dr;
            if (!this.isCenterGhostSpawnTile(tx, ty)) continue;
            if (picked.some((p) => p.x === tx && p.y === ty)) continue;
            picked.push({ x: tx, y: ty });
            if (picked.length >= count) return picked;
          }
        }
      }
    }

    return picked;
  }

  private findGhostSpawnTiles(count: number, centerSlots = 0) {
    const w = this.grid[0].length;
    const h = this.grid.length;
    const player = this.findPlayerSpawnTile();
    const minBetweenGhosts = 6;
    const cornerSlots = count - centerSlots;

    const picked: { x: number; y: number }[] = [];

    const tryPick = (tile: { x: number; y: number }) => {
      if (picked.some((p) => p.x === tile.x && p.y === tile.y)) return false;
      if (picked.some((p) => this.tileDistance(p, tile) < minBetweenGhosts)) {
        return false;
      }
      picked.push(tile);
      return true;
    };

    const cornerAnchors = [
      { x: 2, y: 2 },
      { x: w - 3, y: 2 },
      { x: 2, y: h - 3 },
      { x: w - 3, y: h - 3 },
    ];

    for (let i = 0; i < cornerSlots; i++) {
      const anchor = cornerAnchors[i % cornerAnchors.length];
      let best: { x: number; y: number; score: number } | null = null;

      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          if (!this.isGoodSpawnTile(x, y)) continue;
          if (this.tileDistance({ x, y }, player) < 8) continue;
          const score =
            -this.tileDistance({ x, y }, anchor) * 3 +
            this.countWalkableNeighbors(x, y);
          if (!best || score > best.score) best = { x, y, score };
        }
      }

      if (best) tryPick(best);
    }

    const centerHomes = this.findCenterGhostHomeTiles(centerSlots);
    for (const home of centerHomes) {
      if (picked.length >= count) break;
      if (!picked.some((p) => p.x === home.x && p.y === home.y)) {
        picked.push(home);
      }
    }

    if (picked.length < count) {
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          if (picked.length >= count) break;
          if (this.isGoodSpawnTile(x, y)) tryPick({ x, y });
        }
      }
    }

    return picked;
  }

  private setupInput() {
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = {
        W: this.input.keyboard.addKey("W"),
        A: this.input.keyboard.addKey("A"),
        S: this.input.keyboard.addKey("S"),
        D: this.input.keyboard.addKey("D"),
      };
      this.dashKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.input.keyboard.on("keydown-SPACE", () => this.tryDash());
    }

    const swipeStart = { x: 0, y: 0 };
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      swipeStart.x = p.x;
      swipeStart.y = p.y;
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      const dx = p.x - swipeStart.x;
      const dy = p.y - swipeStart.y;
      if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        this.swipeDir.set(dx > 0 ? 1 : -1, 0);
      } else {
        this.swipeDir.set(0, dy > 0 ? 1 : -1);
      }
    });
  }

  private tryDash() {
    if (!this.dashReady || this.isMoving) return;
    this.dashReady = false;
    this.dashCooldown = DASH_COOLDOWN_MS;
    const runState = this.registry.get("runState") as GameRunState;
    this.emitHud(runState);

    const dir = this.currentDir.lengthSq() > 0 ? this.currentDir : this.nextDir;
    if (dir.lengthSq() === 0) return;

    const tx = this.player.x + dir.x * TILE * 2;
    const ty = this.player.y + dir.y * TILE * 2;
    if (!this.canMoveTo(tx, ty)) return;

    this.tweens.add({
      targets: [this.player, this.playerLabel],
      x: tx,
      y: this.playerLabel ? ty - 18 : ty,
      duration: 120,
      ease: "Power2",
      onUpdate: () => {
        if (this.playerLabel) {
          this.playerLabel.x = this.player.x;
          this.playerLabel.y = this.player.y - 18;
        }
      },
    });
  }

  update(_time: number, delta: number) {
    if (this.dashCooldown > 0) {
      this.dashCooldown -= delta;
      if (this.dashCooldown <= 0) this.dashReady = true;
    }

    if (this.time.now > this.invincibleUntil) {
      this.player.setAlpha(1);
    } else {
      this.player.setAlpha(0.5 + Math.sin(this.time.now / 80) * 0.3);
    }

    this.readInput();
    if (!this.isMoving) this.tryStartMove();

    this.syncPlayerBody();
    this.checkCollectibles();
    this.checkExits();
    this.updateGhosts(delta);
    this.checkGhostHits();
    this.syncLabels();
    this.emitHudPeriodic();
  }

  private readInput() {
    this.nextDir.set(0, 0);
    if (this.wasd?.A.isDown || this.cursors?.left.isDown) this.nextDir.set(-1, 0);
    else if (this.wasd?.D.isDown || this.cursors?.right.isDown) this.nextDir.set(1, 0);
    else if (this.wasd?.W.isDown || this.cursors?.up.isDown) this.nextDir.set(0, -1);
    else if (this.wasd?.S.isDown || this.cursors?.down.isDown) this.nextDir.set(0, 1);
  }

  private getMoveDirection(): Phaser.Math.Vector2 | null {
    if (this.nextDir.lengthSq() > 0) return this.nextDir;
    if (this.swipeDir.lengthSq() > 0) {
      const dir = this.swipeDir.clone();
      this.swipeDir.set(0, 0);
      return dir;
    }
    return null;
  }

  private tryStartMove() {
    const dir = this.getMoveDirection();
    if (!dir) return;

    const tx = this.player.x + dir.x * TILE;
    const ty = this.player.y + dir.y * TILE;
    if (!this.canMoveTo(tx, ty)) return;

    this.currentDir.copy(dir);
    this.updatePlayerVisual(dir);
    this.isMoving = true;
    const speed = this.dashCooldown > DASH_COOLDOWN_MS - 200 ? DASH_SPEED : PLAYER_SPEED;
    this.tweens.add({
      targets: this.player,
      x: tx,
      y: ty,
      duration: (TILE / speed) * 1000,
      ease: "Linear",
      onComplete: () => {
        this.isMoving = false;
        this.snapToGrid();
      },
    });
  }

  private snapToGrid() {
    const gx = Math.round((this.player.x - TILE / 2) / TILE) * TILE + TILE / 2;
    const gy = Math.round((this.player.y - TILE / 2) / TILE) * TILE + TILE / 2;
    this.player.setPosition(gx, gy);
  }

  private canMoveTo(x: number, y: number) {
    const col = Math.floor((x - TILE / 2) / TILE);
    const row = Math.floor((y - TILE / 2) / TILE);
    if (row < 0 || col < 0 || row >= this.grid.length || col >= this.grid[0].length)
      return false;
    return this.grid[row][col] !== "#";
  }

  private updateGhosts(delta: number) {
    const slow = this.time.now < this.slowGhostsUntil;
    const factor = slow ? 0.45 : 1;
    const dt = delta / 1000;

    this.ghosts.forEach((ghost) => {
      if (ghost.frozen || !ghost.sprite.active) return;

      let vx = 0;
      let vy = 0;

      if (ghost.role === "corner") {
        const corner = this.getCornerGhostVelocity(ghost, factor);
        vx = corner.vx;
        vy = corner.vy;
      } else if (this.shouldGhostChase(ghost)) {
        const chase = this.getGhostChaseVelocity(ghost, factor);
        vx = chase.vx;
        vy = chase.vy;
      } else {
        const idle = this.getGhostIdleVelocity(ghost, factor);
        vx = idle.vx;
        vy = idle.vy;
      }

      const nx = ghost.sprite.x + vx * dt;
      const ny = ghost.sprite.y + vy * dt;
      if (!this.canGhostMoveTo(ghost, nx, ny)) return;

      ghost.sprite.setPosition(nx, ny);
      if (ghost.role === "center") this.clampGhostPosition(ghost);

      if (Math.abs(vx) >= Math.abs(vy) && Math.abs(vx) > 0.01) {
        ghost.dir.set(Math.sign(vx), 0);
      } else if (Math.abs(vy) > 0.01) {
        ghost.dir.set(0, Math.sign(vy));
      }
      ghost.sprite.setFrame(ghostFrame(GHOST_SPRITE_ROW, ghost.dir));
    });
  }

  private checkGhostHits() {
    if (this.hitCooldown || this.time.now < this.invincibleUntil) return;

    for (const ghost of this.ghosts) {
      const dist = Phaser.Math.Distance.Between(
        ghost.sprite.x,
        ghost.sprite.y,
        this.player.x,
        this.player.y,
      );
      if (dist < 22) {
        this.onGhostHit();
        return;
      }
    }
  }

  private syncLabels() {
    if (this.playerLabel) {
      this.playerLabel.x = this.player.x;
      this.playerLabel.y = this.player.y - 18;
    }
    this.ghosts.forEach((g) => {
      g.label.x = g.sprite.x;
      g.label.y = g.sprite.y + 14;
    });
  }

  private syncPlayerBody() {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (body) body.updateFromGameObject();
  }

  private checkExits() {
    if (this.stageComplete) return;
    const radius = TILE * 0.52;
    for (const zone of this.exitZones.values()) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        zone.x,
        zone.y,
      );
      if (dist <= radius) {
        this.onReachExit(zone);
        return;
      }
    }
  }

  private checkCollectibles() {
    const radius = TILE * 0.42;
    const children = [...this.collectibles.getChildren()];
    for (const child of children) {
      const dot = child as Phaser.GameObjects.Arc;
      if (!dot.active || dot.getData("picked")) continue;
      const tile = this.worldToTile(dot.x, dot.y);
      const tileKey = `${tile.col},${tile.row}`;
      if (this.collectedTileKeys.has(tileKey)) continue;
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        dot.x,
        dot.y,
      );
      if (dist <= radius) this.onCollect(dot);
    }
  }

  private playCollectEffect(
    x: number,
    y: number,
    kind: "invis" | "slow",
  ) {
    const { accent, particle } = this.stage.palette;
    const burstColor = kind === "invis" ? accent : particle;

    for (let i = 0; i < 10; i++) {
      const spark = this.add.circle(x, y, 5, burstColor, 0.95);
      spark.setDepth(7);
      const angle = (i / 10) * Math.PI * 2;
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * 32,
        y: y + Math.sin(angle) * 32,
        alpha: 0,
        scale: 0.15,
        duration: 400,
        ease: "Cubic.easeOut",
        onComplete: () => spark.destroy(),
      });
    }

    const ring = this.add.circle(x, y, 8, burstColor, 0);
    ring.setStrokeStyle(3, burstColor, 0.9);
    ring.setDepth(7);
    this.tweens.add({
      targets: ring,
      scale: 2.8,
      alpha: 0,
      duration: 320,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });

    const label = kind === "invis" ? "✨ Tàng hình!" : "💫 Ma chậm lại!";
    const floater = this.add
      .text(x, y - 10, label, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        color: "#fff8ff",
        fontStyle: "bold",
        stroke: "#1a1028",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(8);
    this.tweens.add({
      targets: floater,
      y: y - 38,
      alpha: 0,
      duration: 950,
      ease: "Cubic.easeOut",
      onComplete: () => floater.destroy(),
    });

    this.tweens.add({
      targets: this.player,
      scale: CHARACTER_SCALE * 1.14,
      duration: 90,
      yoyo: true,
      ease: "Back.easeOut",
    });
  }

  private onCollect(obj: Phaser.GameObjects.GameObject) {
    const dot = obj as Phaser.GameObjects.Arc;
    if (!dot.active || dot.getData("picked")) return;

    dot.setData("picked", true);
    const { x, y } = dot;
    const tile = this.worldToTile(x, y);
    const tileKey = `${tile.col},${tile.row}`;
    this.collectedTileKeys.add(tileKey);
    if (
      tile.row >= 0 &&
      tile.col >= 0 &&
      this.grid[tile.row]?.[tile.col] === "o"
    ) {
      this.grid[tile.row][tile.col] = ".";
    }

    this.tweens.killTweensOf(dot);
    const body = dot.body as Phaser.Physics.Arcade.Body | null;
    if (body) body.enable = false;
    dot.setActive(false);
    dot.setVisible(false);
    this.collectibles.remove(dot, false, false);

    const isInvis = (this.collected + 1) % 2 === 0;
    if (isInvis) {
      this.invincibleUntil = this.time.now + INVIS_DURATION;
      this.powerUpLabel = "Tàng hình";
    } else {
      this.slowGhostsUntil = this.time.now + SLOW_DURATION;
      this.powerUpLabel = "Ma chậm lại";
    }

    this.playCollectEffect(x, y, isInvis ? "invis" : "slow");
    dot.destroy();

    this.collected++;

    const runState = this.registry.get("runState") as GameRunState;
    runState.mood = this.collected > 4 ? "confident" : "warming up";
    this.registry.set("runState", runState);
    this.emitHud(runState);
  }

  private onReachExit(zone: Phaser.GameObjects.Arc) {
    if (this.stageComplete) return;
    let exitKey = "";
    this.exitZones.forEach((z, key) => {
      if (z === zone) exitKey = key;
    });
    if (!exitKey) return;
    this.stageComplete = true;

    const exitIdx = parseInt(exitKey, 10) - 1;
    const choice = this.stage.exits[exitIdx];
    const runState = this.registry.get("runState") as GameRunState;
    runState.choices.push({
      stageId: this.stage.id,
      choiceId: choice.id,
      label: choice.label,
    });
    this.registry.set("runState", runState);

    this.scene.start("TransitionScene", {
      stageIndex: this.stageIndex,
      choiceLabel: choice.label,
      choiceVibe: choice.vibe,
    });
  }

  private onGhostHit() {
    if (this.hitCooldown || this.time.now < this.invincibleUntil) return;
    const runState = this.registry.get("runState") as GameRunState;
    runState.lives -= 1;
    this.registry.set("runState", runState);
    runState.mood = "anxious";
    this.hitCooldown = true;
    this.cameras.main.shake(200, 0.01);
    this.emitHud(runState);

    if (runState.lives <= 0) {
      this.game.events.emit(GAME_EVENTS.GAME_OVER, runState);
      this.scene.start("MenuScene");
      return;
    }

    this.time.delayedCall(1200, () => {
      this.hitCooldown = false;
      this.invincibleUntil = this.time.now + 1500;
    });
  }

  private emitHudPeriodic() {
    if (this.time.now % 400 < 20) {
      const runState = this.registry.get("runState") as GameRunState;
      this.emitHud(runState);
    }
  }

  private emitHud(runState: GameRunState) {
    this.game.events.emit(GAME_EVENTS.HUD_UPDATE, {
      stageTitle: this.stage.title,
      stageSubtitle: this.stage.subtitle,
      lives: runState.lives,
      mood: runState.mood,
      collectibles: this.collected,
      totalCollectibles: this.totalCollectibles,
      dashReady: this.dashReady,
      powerUp: this.powerUpLabel || undefined,
    });
  }
}

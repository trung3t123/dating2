type Cell = string;
type Pos = { x: number; y: number };

const WALKABLE = new Set([".", "o", "S", "1", "2", "3", "4"]);

function key(p: Pos) {
  return `${p.x},${p.y}`;
}

function cloneGrid(grid: Cell[][]): Cell[][] {
  return grid.map((row) => [...row]);
}

function cloneGridFromRows(rows: string[]): Cell[][] {
  return rows.map((r) => r.split(""));
}

function gridToRows(grid: Cell[][]): string[] {
  return grid.map((r) => r.join(""));
}

function isWalkable(grid: Cell[][], p: Pos) {
  const c = grid[p.y]?.[p.x];
  return c !== undefined && WALKABLE.has(c);
}

function inBounds(grid: Cell[][], p: Pos) {
  return p.y > 0 && p.x > 0 && p.y < grid.length - 1 && p.x < grid[0].length - 1;
}

function findCell(grid: Cell[][], token: Cell): Pos | null {
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (grid[y][x] === token) return { x, y };
    }
  }
  return null;
}

function bfsPath(
  grid: Cell[][],
  start: Pos,
  end: Pos,
  blocked?: Set<string>,
): Pos[] | null {
  const h = grid.length;
  const w = grid[0].length;
  const q: Pos[] = [start];
  const prev = new Map<string, string | null>();
  prev.set(key(start), null);

  while (q.length) {
    const cur = q.shift()!;
    if (cur.x === end.x && cur.y === end.y) {
      const path: Pos[] = [];
      let k: string | null = key(cur);
      while (k) {
        const [xs, ys] = k.split(",");
        path.push({ x: Number(xs), y: Number(ys) });
        k = prev.get(k) ?? null;
      }
      return path.reverse();
    }

    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n: Pos = { x: nx, y: ny };
      const nk = key(n);
      if (prev.has(nk)) continue;
      if (blocked?.has(nk) && !(n.x === end.x && n.y === end.y)) continue;
      if (!isWalkable(grid, n)) continue;
      prev.set(nk, key(cur));
      q.push(n);
    }
  }
  return null;
}

function carve(grid: Cell[][], p: Pos) {
  if (!inBounds(grid, p)) return;
  if (grid[p.y][p.x] === "#") grid[p.y][p.x] = ".";
}

function carveSegment(grid: Cell[][], from: Pos, to: Pos) {
  let x = from.x;
  let y = from.y;
  while (x !== to.x || y !== to.y) {
    carve(grid, { x, y });
    if (x !== to.x) x += Math.sign(to.x - x);
    else y += Math.sign(to.y - y);
  }
  carve(grid, to);
}

function applyGrid(target: Cell[][], source: Cell[][]) {
  for (let y = 0; y < target.length; y++) {
    for (let x = 0; x < target[y].length; x++) {
      target[y][x] = source[y][x];
    }
  }
}

function pathsAreDistinct(mainPath: Pos[], other: Pos[] | null) {
  if (!other) return false;
  const mainKeys = new Set(mainPath.map((p) => key(p)));
  const offMain = other.filter((p) => !mainKeys.has(key(p))).length;
  return offMain >= Math.max(6, Math.floor(other.length * 0.15));
}

/** Tìm đường thứ hai bằng cách chặn một đoạn giữa đường chính. */
function findAlternatePath(
  grid: Cell[][],
  start: Pos,
  end: Pos,
  mainPath: Pos[],
): Pos[] | null {
  for (let skipStart = 2; skipStart < mainPath.length - 2; skipStart++) {
    for (let len = 3; len <= Math.min(14, mainPath.length - 3); len++) {
      const blocked = new Set<string>();
      for (
        let i = skipStart;
        i < Math.min(skipStart + len, mainPath.length - 1);
        i++
      ) {
        blocked.add(key(mainPath[i]));
      }
      const alt = bfsPath(grid, start, end, blocked);
      if (pathsAreDistinct(mainPath, alt)) return alt;
    }
  }
  return null;
}

function hasAlternateRoute(
  grid: Cell[][],
  start: Pos,
  end: Pos,
  mainPath: Pos[],
) {
  return findAlternatePath(grid, start, end, mainPath) !== null;
}

function perpDirs(dx: number, dy: number): Pos[] {
  if (dx !== 0) return [{ x: 0, y: 1 }, { x: 0, y: -1 }];
  return [{ x: 1, y: 0 }, { x: -1, y: 0 }];
}

function tryApply(
  grid: Cell[][],
  trial: Cell[][],
  spawn: Pos,
  end: Pos,
  mainPath: Pos[],
) {
  if (!hasAlternateRoute(trial, spawn, end, mainPath)) return false;
  applyGrid(grid, trial);
  return true;
}

/** Nối hai điểm trên đường chính bằng hành lang song song (lối tắt). */
function carveBypassLoop(
  grid: Cell[][],
  path: Pos[],
  side: Pos,
  depth: number,
) {
  const a = path[Math.max(1, Math.floor(path.length * 0.2))];
  const b = path[Math.min(path.length - 2, Math.floor(path.length * 0.8))];
  const aLane = { x: a.x + side.x * depth, y: a.y + side.y * depth };
  const bLane = { x: b.x + side.x * depth, y: b.y + side.y * depth };

  carveSegment(grid, a, aLane);
  carveSegment(grid, b, bLane);
  carveSegment(grid, aLane, bLane);
}

function carveParallelLane(
  grid: Cell[][],
  path: Pos[],
  side: Pos,
  depth: number,
) {
  for (let i = 1; i < path.length - 1; i++) {
    const p = path[i];
    for (let d = 1; d <= depth; d++) {
      carve(grid, { x: p.x + side.x * d, y: p.y + side.y * d });
    }
  }
  const joinStart = path[Math.min(2, path.length - 1)];
  const joinEnd = path[Math.max(path.length - 3, 0)];
  carveSegment(grid, joinStart, {
    x: joinStart.x + side.x,
    y: joinStart.y + side.y,
  });
  carveSegment(grid, joinEnd, {
    x: joinEnd.x + side.x,
    y: joinEnd.y + side.y,
  });
}

function carveWideAlongPath(grid: Cell[][], path: Pos[]) {
  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    const dx = Math.sign(curr.x - prev.x);
    const dy = Math.sign(curr.y - prev.y);
    for (const side of perpDirs(dx, dy)) {
      for (let d = 1; d <= 2; d++) {
        carve(grid, { x: curr.x + side.x * d, y: curr.y + side.y * d });
      }
    }
  }
}

function duplicatePathTunnel(
  grid: Cell[][],
  path: Pos[],
  side: Pos,
  depth: number,
) {
  const tunnel = path.map((p) => ({
    x: p.x + side.x * depth,
    y: p.y + side.y * depth,
  }));
  for (const p of tunnel) carve(grid, p);
  carveSegment(grid, path[0], tunnel[0]);
  carveSegment(grid, path[path.length - 1], tunnel[tunnel.length - 1]);
}

function carveDetourPath(
  grid: Cell[][],
  spawn: Pos,
  end: Pos,
  path: Pos[],
) {
  const mid = path[Math.floor(path.length / 2)];
  const offsets = [
    { x: 6, y: 0 },
    { x: -6, y: 0 },
    { x: 0, y: 6 },
    { x: 0, y: -6 },
    { x: 5, y: 5 },
    { x: -5, y: 5 },
    { x: 5, y: -5 },
    { x: -5, y: -5 },
    { x: 8, y: 0 },
    { x: 0, y: 8 },
  ];

  for (const off of offsets) {
    const detour = { x: mid.x + off.x, y: mid.y + off.y };
    if (!inBounds(grid, detour)) continue;
    carveSegment(grid, spawn, detour);
    carveSegment(grid, detour, end);
  }
}

function ensureShortcutToExit(grid: Cell[][], spawn: Pos, exit: Pos) {
  const mainPath = bfsPath(grid, spawn, exit);
  if (!mainPath || mainPath.length < 4) return;
  if (hasAlternateRoute(grid, spawn, exit, mainPath)) return;

  for (let i = 1; i < mainPath.length - 1; i++) {
    const prev = mainPath[i - 1];
    const curr = mainPath[i];
    const dx = Math.sign(curr.x - prev.x);
    const dy = Math.sign(curr.y - prev.y);

    for (const side of perpDirs(dx, dy)) {
      for (const depth of [1, 2, 3]) {
        const trial = cloneGrid(grid);
        carveBypassLoop(trial, mainPath, side, depth);
        if (tryApply(grid, trial, spawn, exit, mainPath)) return;
      }
    }
  }

  for (let i = 1; i < mainPath.length - 1; i++) {
    const prev = mainPath[i - 1];
    const curr = mainPath[i];
    const dx = Math.sign(curr.x - prev.x);
    const dy = Math.sign(curr.y - prev.y);

    for (const side of perpDirs(dx, dy)) {
      for (const depth of [1, 2, 3]) {
        const trial = cloneGrid(grid);
        carveParallelLane(trial, mainPath, side, depth);
        if (tryApply(grid, trial, spawn, exit, mainPath)) return;
      }
    }
  }

  for (let i = 1; i < mainPath.length - 1; i++) {
    const prev = mainPath[i - 1];
    const curr = mainPath[i];
    const dx = Math.sign(curr.x - prev.x);
    const dy = Math.sign(curr.y - prev.y);
    for (const side of perpDirs(dx, dy)) {
      for (const depth of [2, 3]) {
        const trial = cloneGrid(grid);
        duplicatePathTunnel(trial, mainPath, side, depth);
        if (tryApply(grid, trial, spawn, exit, mainPath)) return;
      }
    }
  }

  const wide = cloneGrid(grid);
  carveWideAlongPath(wide, mainPath);
  if (tryApply(grid, wide, spawn, exit, mainPath)) return;

  const detour = cloneGrid(grid);
  carveDetourPath(detour, spawn, exit, mainPath);
  if (tryApply(grid, detour, spawn, exit, mainPath)) return;

  const combo = cloneGrid(grid);
  carveWideAlongPath(combo, mainPath);
  carveDetourPath(combo, spawn, exit, mainPath);
  if (tryApply(grid, combo, spawn, exit, mainPath)) return;

  for (const side of [
    { x: 2, y: 0 },
    { x: -2, y: 0 },
    { x: 0, y: 2 },
    { x: 0, y: -2 },
  ]) {
    const last = cloneGrid(grid);
    duplicatePathTunnel(last, mainPath, side, 2);
    carveDetourPath(last, spawn, exit, mainPath);
    if (tryApply(grid, last, spawn, exit, mainPath)) return;
  }
}

/** Mỗi exit (1–4) có ít nhất một lối tắt song song đường chính từ spawn. */
export function applyExitShortcuts(rows: string[]): string[] {
  const grid = cloneGridFromRows(rows);
  const spawn = findCell(grid, "S");
  if (!spawn) return rows;

  for (const exitToken of ["1", "2", "3", "4"]) {
    const exit = findCell(grid, exitToken);
    if (!exit) continue;
    ensureShortcutToExit(grid, spawn, exit);
  }

  return gridToRows(grid);
}

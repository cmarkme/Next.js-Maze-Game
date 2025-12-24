import { Maze, Player, Dir, Cell } from "@/game/types";
import { CELL_SIZE, WALL_THICKNESS, PLAYER_RADIUS } from "@/game/config";

type Rect = { x: number; y: number; w: number; h: number };

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function circleRectResolve(cx: number, cy: number, r: number, rect: Rect) {
  const closestX = clamp(cx, rect.x, rect.x + rect.w);
  const closestY = clamp(cy, rect.y, rect.y + rect.h);

  const dx = cx - closestX;
  const dy = cy - closestY;

  const dist2 = dx * dx + dy * dy;
  if (dist2 >= r * r) return { cx, cy };

  const dist = Math.sqrt(dist2) || 0.0001;
  const push = r - dist;

  const nx = dx / dist;
  const ny = dy / dist;

  return { cx: cx + nx * push, cy: cy + ny * push };
}

function cellAt(maze: Maze, x: number, y: number): Cell | undefined {
  if (x < 0 || y < 0 || x >= maze.width || y >= maze.height) return undefined;
  return maze.cells[y * maze.width + x];
}

function wallRectsForCell(cell: Cell): Rect[] {
  const baseX = cell.x * CELL_SIZE;
  const baseY = cell.y * CELL_SIZE;
  const t = WALL_THICKNESS;

  const rects: Rect[] = [];

  if (cell.walls.N) rects.push({ x: baseX, y: baseY, w: CELL_SIZE, h: t });
  if (cell.walls.W) rects.push({ x: baseX, y: baseY, w: t, h: CELL_SIZE });
  if (cell.walls.E) rects.push({ x: baseX + CELL_SIZE - t, y: baseY, w: t, h: CELL_SIZE });
  if (cell.walls.S) rects.push({ x: baseX, y: baseY + CELL_SIZE - t, w: CELL_SIZE, h: t });

  return rects;
}

function getNearbyWallRects(maze: Maze, px: number, py: number): Rect[] {
  const cx = Math.floor(px / CELL_SIZE);
  const cy = Math.floor(py / CELL_SIZE);

  const rects: Rect[] = [];

  // check a 3×3 neighborhood
  for (let y = cy - 1; y <= cy + 1; y++) {
    for (let x = cx - 1; x <= cx + 1; x++) {
      const cell = cellAt(maze, x, y);
      if (!cell) continue;
      rects.push(...wallRectsForCell(cell));
    }
  }

  return rects;
}

// GENERAL: used by player AND enemy
export function moveCircleWithCollision(
  maze: Maze,
  x: number,
  y: number,
  r: number,
  dx: number,
  dy: number
) {
  let nx = x + dx;
  let ny = y;

  let walls = getNearbyWallRects(maze, nx, ny);
  for (const w of walls) {
    const res = circleRectResolve(nx, ny, r, w);
    nx = res.cx;
    ny = res.cy;
  }

  ny = ny + dy;
  walls = getNearbyWallRects(maze, nx, ny);
  for (const w of walls) {
    const res = circleRectResolve(nx, ny, r, w);
    nx = res.cx;
    ny = res.cy;
  }

  return { x: nx, y: ny };
}

export function moveWithCollision(
  maze: Maze,
  player: Player,
  dx: number,
  dy: number
): Player {
  const res = moveCircleWithCollision(
    maze,
    player.x,
    player.y,
    PLAYER_RADIUS,
    dx,
    dy
  );
  return { x: res.x, y: res.y };
}


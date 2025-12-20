import { Maze, Player } from "@/game/types";
import { TILE_SIZE, WALL_COLOR, PLAYER_COLOR } from "@/game/config";

export function draw(
  ctx: CanvasRenderingContext2D,
  maze: Maze,
  player: Player,
  screenW: number,
  screenH: number
) {
  ctx.clearRect(0, 0, screenW, screenH);

  const cx = screenW / 2;
  const cy = screenH / 2;

  const playerWorldX = player.x * TILE_SIZE;
  const playerWorldY = player.y * TILE_SIZE;

  ctx.strokeStyle = WALL_COLOR;
  ctx.lineWidth = 2;

  for (const cell of maze.cells) {
    const wx = cell.x * TILE_SIZE;
    const wy = cell.y * TILE_SIZE;

    // camera offset: player stays centered
    const sx = wx - playerWorldX + cx;
    const sy = wy - playerWorldY + cy;

    if (cell.walls.N) line(ctx, sx, sy, sx + TILE_SIZE, sy);
    if (cell.walls.E) line(ctx, sx + TILE_SIZE, sy, sx + TILE_SIZE, sy + TILE_SIZE);
    if (cell.walls.S) line(ctx, sx, sy + TILE_SIZE, sx + TILE_SIZE, sy + TILE_SIZE);
    if (cell.walls.W) line(ctx, sx, sy, sx, sy + TILE_SIZE);
  }

  // player (always centered)
  ctx.fillStyle = PLAYER_COLOR;
  ctx.beginPath();
  ctx.arc(cx, cy, TILE_SIZE / 4, 0, Math.PI * 2);
  ctx.fill();
}

function line(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

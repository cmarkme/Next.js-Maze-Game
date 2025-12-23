import { Maze, Player } from "@/game/types";
import { CELL_SIZE, WALL_THICKNESS, PLAYER_RADIUS } from "@/game/config";

export function draw(
  ctx: CanvasRenderingContext2D,
  maze: Maze,
  player: Player
) {
  const { width, height } = ctx.canvas;

  // camera keeps player centered
  const camX = width / 2 - player.x;
  const camY = height / 2 - player.y;

  // background
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, width, height);

  // walls
  ctx.fillStyle = "#00ff00";

  for (const c of maze.cells) {
    const x0 = c.x * CELL_SIZE + camX;
    const y0 = c.y * CELL_SIZE + camY;

    if (c.walls.N) ctx.fillRect(x0, y0, CELL_SIZE, WALL_THICKNESS);
    if (c.walls.W) ctx.fillRect(x0, y0, WALL_THICKNESS, CELL_SIZE);
    if (c.walls.E)
      ctx.fillRect(
        x0 + CELL_SIZE - WALL_THICKNESS,
        y0,
        WALL_THICKNESS,
        CELL_SIZE
      );
    if (c.walls.S)
      ctx.fillRect(
        x0,
        y0 + CELL_SIZE - WALL_THICKNESS,
        CELL_SIZE,
        WALL_THICKNESS
      );
  }

  // player (always centered)
  ctx.beginPath();
  ctx.fillStyle = "red";
  ctx.arc(width / 2, height / 2, PLAYER_RADIUS, 0, Math.PI * 2);
  ctx.fill();
}

import { Maze, Player, Enemy } from "@/game/types";
import { CELL_SIZE, WALL_THICKNESS, PLAYER_RADIUS } from "@/game/config";

/**
 * draw()
 * ------
 * This function MUST:
 * 1. Reset the canvas transform every frame
 * 2. Clear the canvas in screen space
 * 3. Apply world → screen transforms in a controlled way
 */
export function draw(
  ctx: CanvasRenderingContext2D,
  maze: Maze,
  player: Player,
  enemy: Enemy,
  scale: number,
  dpr: number
) {
  const canvas = ctx.canvas;

  // Canvas size in *CSS pixels*
  const widthCss = canvas.width / dpr;
  const heightCss = canvas.height / dpr;

  // --------------------------------------------------
  // 1️⃣ RESET TRANSFORM
  // --------------------------------------------------
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // --------------------------------------------------
  // 2️⃣ CLEAR THE SCREEN (IN SCREEN SPACE)
  // --------------------------------------------------
  ctx.clearRect(0, 0, widthCss, heightCss);

  // Optional background fill
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, widthCss, heightCss);

  // --------------------------------------------------
  // 3️⃣ CAMERA TRANSFORM (WORLD → SCREEN)
  // --------------------------------------------------
  ctx.translate(widthCss / 2, heightCss / 2);
  ctx.scale(scale, scale);
  ctx.translate(-player.x, -player.y);

  // --------------------------------------------------
  // 4️⃣ DRAW MAZE (WORLD SPACE)
  // --------------------------------------------------
  ctx.fillStyle = "#00ff00";

  for (const c of maze.cells) {
    const x0 = c.x * CELL_SIZE;
    const y0 = c.y * CELL_SIZE;

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

  // --------------------------------------------------
  // 5️⃣ DRAW ENEMY (WORLD SPACE)
  // --------------------------------------------------
  ctx.beginPath();
  ctx.fillStyle = "orange";
  ctx.arc(enemy.x, enemy.y, enemy.r, 0, Math.PI * 2);
  ctx.fill();

  // --------------------------------------------------
  // 6️⃣ DRAW PLAYER (WORLD SPACE)
  // --------------------------------------------------
  ctx.beginPath();
  ctx.fillStyle = "red";
  ctx.arc(player.x, player.y, PLAYER_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  // --------------------------------------------------
  // 7️⃣ RESET TRANSFORM (CLEAN EXIT)
  // --------------------------------------------------
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

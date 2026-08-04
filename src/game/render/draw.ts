import { Core, Enemy, Exit, Maze, Player, ShieldPickup } from "@/game/types";
import { CELL_SIZE, PLAYER_RADIUS, WALL_THICKNESS } from "@/game/config";

type RenderEffects = {
  dashActive: boolean;
  playerInvulnerable: boolean;
  shieldActive: boolean;
};

export function draw(
  ctx: CanvasRenderingContext2D,
  maze: Maze,
  player: Player,
  enemies: Enemy[],
  cores: Core[],
  exit: Exit | null,
  shieldPickup: ShieldPickup | null,
  scale: number,
  dpr: number,
  effects: RenderEffects
) {
  const canvas = ctx.canvas;
  const widthCss = canvas.width / dpr;
  const heightCss = canvas.height / dpr;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, widthCss, heightCss);
  ctx.fillStyle = "#020504";
  ctx.fillRect(0, 0, widthCss, heightCss);

  ctx.translate(widthCss / 2, heightCss / 2);
  ctx.scale(scale, scale);
  ctx.translate(-player.x, -player.y);

  drawMaze(ctx, maze);
  if (exit) drawExit(ctx, exit);
  for (const core of cores) {
    if (!core.collected) drawCore(ctx, core);
  }
  if (shieldPickup && !shieldPickup.collected) drawShieldPickup(ctx, shieldPickup);
  for (const enemy of enemies) drawEnemy(ctx, enemy);
  drawPlayer(ctx, player, effects);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function drawMaze(ctx: CanvasRenderingContext2D, maze: Maze) {
  ctx.fillStyle = "#16f58a";
  ctx.shadowColor = "rgba(0, 255, 140, 0.35)";
  ctx.shadowBlur = 8;

  for (const cell of maze.cells) {
    const x = cell.x * CELL_SIZE;
    const y = cell.y * CELL_SIZE;
    if (cell.walls.N) ctx.fillRect(x, y, CELL_SIZE, WALL_THICKNESS);
    if (cell.walls.W) ctx.fillRect(x, y, WALL_THICKNESS, CELL_SIZE);
    if (cell.walls.E) {
      ctx.fillRect(x + CELL_SIZE - WALL_THICKNESS, y, WALL_THICKNESS, CELL_SIZE);
    }
    if (cell.walls.S) {
      ctx.fillRect(x, y + CELL_SIZE - WALL_THICKNESS, CELL_SIZE, WALL_THICKNESS);
    }
  }

  ctx.shadowBlur = 0;
}

function drawCore(ctx: CanvasRenderingContext2D, core: Core) {
  ctx.save();
  ctx.translate(core.x, core.y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = "#ffe45b";
  ctx.shadowColor = "#ffd52f";
  ctx.shadowBlur = 22;
  ctx.fillRect(-18, -18, 36, 36);
  ctx.fillStyle = "#fffbd0";
  ctx.fillRect(-7, -7, 14, 14);
  ctx.restore();
}

function drawExit(ctx: CanvasRenderingContext2D, exit: Exit) {
  ctx.save();
  ctx.translate(exit.x, exit.y);
  ctx.lineWidth = 10;
  ctx.strokeStyle = exit.unlocked ? "#5fffe2" : "#52615d";
  ctx.fillStyle = exit.unlocked ? "rgba(38, 255, 211, 0.16)" : "rgba(85, 99, 95, 0.15)";
  ctx.shadowColor = exit.unlocked ? "#2effd1" : "transparent";
  ctx.shadowBlur = exit.unlocked ? 28 : 0;
  ctx.fillRect(-48, -48, 96, 96);
  ctx.strokeRect(-48, -48, 96, 96);

  ctx.beginPath();
  if (exit.unlocked) {
    ctx.moveTo(-18, 0);
    ctx.lineTo(18, 0);
    ctx.moveTo(7, -12);
    ctx.lineTo(19, 0);
    ctx.lineTo(7, 12);
  } else {
    ctx.moveTo(-15, -15);
    ctx.lineTo(15, 15);
    ctx.moveTo(15, -15);
    ctx.lineTo(-15, 15);
  }
  ctx.stroke();
  ctx.restore();
}

function drawShieldPickup(ctx: CanvasRenderingContext2D, pickup: ShieldPickup) {
  ctx.save();
  ctx.translate(pickup.x, pickup.y);
  ctx.strokeStyle = "#9a7cff";
  ctx.fillStyle = "rgba(135, 103, 255, 0.22)";
  ctx.lineWidth = 8;
  ctx.shadowColor = "#8262ff";
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(13, -7);
  ctx.lineTo(9, 12);
  ctx.lineTo(0, 20);
  ctx.lineTo(-9, 12);
  ctx.lineTo(-13, -7);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy) {
  ctx.save();
  ctx.globalAlpha = enemy.active ? 1 : 0.38;
  ctx.fillStyle = enemy.active ? "#ff315d" : "#7d2638";
  ctx.shadowColor = enemy.active ? "#ff174d" : "transparent";
  ctx.shadowBlur = enemy.active ? 18 : 0;
  ctx.beginPath();
  ctx.arc(enemy.x, enemy.y, enemy.active ? enemy.r : enemy.r * 0.72, 0, Math.PI * 2);
  ctx.fill();

  if (enemy.active) {
    ctx.fillStyle = "#fff0f3";
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, Math.max(3, enemy.r * 0.25), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: Player, effects: RenderEffects) {
  ctx.save();
  if (effects.playerInvulnerable && Math.floor(performance.now() / 90) % 2 === 0) {
    ctx.globalAlpha = 0.28;
  }

  if (effects.dashActive) {
    ctx.strokeStyle = "rgba(95, 255, 226, 0.32)";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(player.x, player.y, PLAYER_RADIUS + 17, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = "#5fffe2";
  ctx.shadowColor = "#2effd1";
  ctx.shadowBlur = 22;
  ctx.beginPath();
  ctx.arc(player.x, player.y, PLAYER_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(player.x, player.y, Math.max(3, PLAYER_RADIUS * 0.28), 0, Math.PI * 2);
  ctx.fill();

  if (effects.shieldActive) {
    ctx.strokeStyle = "#a68aff";
    ctx.lineWidth = 6;
    ctx.shadowColor = "#8262ff";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(player.x, player.y, PLAYER_RADIUS + 16, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

import { Maze } from "@/game/types";
import { moveCircleWithCollision} from "@/game/movement/canMove";

export function moveWithCollision(
  maze: Maze,
  x: number,
  y: number,
  dx: number,
  dy: number,
  r: number,
  step = 0.25 // world units per micro-step (tweak)
) {
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return { x, y };

  const steps = Math.ceil(dist / step);
  let nx = x;
  let ny = y;

  for (let i = 0; i < steps; i++) {
    const sx = dx / steps;
    const sy = dy / steps;
  }

  return { x: nx, y: ny };
}

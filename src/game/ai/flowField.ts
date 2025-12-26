import { Maze } from "@/game/types";
import { CELL_SIZE } from "@/game/config";

export type FlowField = number[];

export function worldToCell(x: number, y: number) {
  return {
    cx: Math.floor(x / CELL_SIZE),
    cy: Math.floor(y / CELL_SIZE),
  };
}

function idx(maze: Maze, cx: number, cy: number) {
  return cy * maze.width + cx;
}

export function buildFlowField(maze: Maze, targetCx: number, targetCy: number): FlowField {
  const total = maze.width * maze.height;
  const field: FlowField = new Array(total).fill(Infinity);

  const q: { x: number; y: number }[] = [];

  field[idx(maze, targetCx, targetCy)] = 0;
  q.push({ x: targetCx, y: targetCy });

  while (q.length > 0) {
    const { x, y } = q.shift()!;
    const i = idx(maze, x, y);
    const cell = maze.cells[i];
    const d = field[i];

    // N
    if (!cell.walls.N && y > 0) {
      const ni = idx(maze, x, y - 1);
      if (field[ni] === Infinity) {
        field[ni] = d + 1;
        q.push({ x, y: y - 1 });
      }
    }
    // S
    if (!cell.walls.S && y < maze.height - 1) {
      const ni = idx(maze, x, y + 1);
      if (field[ni] === Infinity) {
        field[ni] = d + 1;
        q.push({ x, y: y + 1 });
      }
    }
    // W
    if (!cell.walls.W && x > 0) {
      const ni = idx(maze, x - 1, y);
      if (field[ni] === Infinity) {
        field[ni] = d + 1;
        q.push({ x: x - 1, y });
      }
    }
    // E
    if (!cell.walls.E && x < maze.width - 1) {
      const ni = idx(maze, x + 1, y);
      if (field[ni] === Infinity) {
        field[ni] = d + 1;
        q.push({ x: x + 1, y });
      }
    }
  }

  return field;
}

export function nextCellFromFlow(maze: Maze, field: FlowField, cx: number, cy: number) {
  let bestCx = cx;
  let bestCy = cy;
  let bestVal = field[idx(maze, cx, cy)];

  const cell = maze.cells[idx(maze, cx, cy)];

  const tryPick = (nx: number, ny: number, blocked: boolean) => {
    if (blocked) return;
    const v = field[idx(maze, nx, ny)];
    if (v < bestVal) {
      bestVal = v;
      bestCx = nx;
      bestCy = ny;
    }
  };

  if (cy > 0) tryPick(cx, cy - 1, cell.walls.N);
  if (cy < maze.height - 1) tryPick(cx, cy + 1, cell.walls.S);
  if (cx > 0) tryPick(cx - 1, cy, cell.walls.W);
  if (cx < maze.width - 1) tryPick(cx + 1, cy, cell.walls.E);

  return { cx: bestCx, cy: bestCy };
}

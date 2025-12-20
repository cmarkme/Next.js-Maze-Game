import { Cell, Maze, Dir } from "@/game/types";

const DIRS: Dir[] = ["N", "E", "S", "W"];

const DX: Record<Dir, number> = { N: 0, E: 1, S: 0, W: -1 };
const DY: Record<Dir, number> = { N: -1, E: 0, S: 1, W: 0 };
const OPP: Record<Dir, Dir> = { N: "S", E: "W", S: "N", W: "E" };

export function generateMaze(width: number, height: number): Maze {
  const cells: Cell[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      cells.push({
        x,
        y,
        visited: false,
        walls: { N: true, E: true, S: true, W: true },
      });
    }
  }

  const index = (x: number, y: number) => y * width + x;

  function carve(x: number, y: number) {
    const cell = cells[index(x, y)];
    cell.visited = true;

    const dirs = [...DIRS].sort(() => Math.random() - 0.5);

    for (const dir of dirs) {
      const nx = x + DX[dir];
      const ny = y + DY[dir];

      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

      const next = cells[index(nx, ny)];
      if (!next.visited) {
        cell.walls[dir] = false;
        next.walls[OPP[dir]] = false;
        carve(nx, ny);
      }
    }
  }

  carve(0, 0);

  return { width, height, cells };
}

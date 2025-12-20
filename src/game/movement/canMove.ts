import { Maze, Dir } from "@/game/types";

export function canMove(maze: Maze, x: number, y: number, dir: Dir): boolean {
  const cell = maze.cells[y * maze.width + x];
  return !cell.walls[dir];
}

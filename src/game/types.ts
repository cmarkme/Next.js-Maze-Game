export type Dir = "N" | "E" | "S" | "W";

export type Cell = {
  x: number;
  y: number;
  walls: Record<Dir, boolean>;
  visited?: boolean;
};

export type Maze = {
  width: number;
  height: number;
  cells: Cell[];
};

export type Player = {
  x: number;
  y: number;
};

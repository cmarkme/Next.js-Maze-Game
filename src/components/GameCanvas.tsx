"use client";

import { useEffect, useRef, useState } from "react";
import { generateMaze } from "@/game/maze/generate";
import { draw } from "@/game/render/draw";
import { canMove } from "@/game/movement/canMove";
import { Maze, Player, Dir } from "@/game/types";

const WIDTH = 800;
const HEIGHT = 600;

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [maze] = useState<Maze>(() => generateMaze(30, 30));
  const [player, setPlayer] = useState<Player>({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function loop() {
      draw(ctx, maze, player, WIDTH, HEIGHT);
      requestAnimationFrame(loop);
    }
    loop();
  }, [maze, player]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const map: Record<string, Dir> = {
        ArrowUp: "N",
        ArrowDown: "S",
        ArrowLeft: "W",
        ArrowRight: "E",
        w: "N",
        s: "S",
        a: "W",
        d: "E",
      };

      const dir = map[e.key];
      if (!dir) return;

      setPlayer((p) => {
        if (!canMove(maze, p.x, p.y, dir)) return p;
        const n = { ...p };
        if (dir === "N") n.y--;
        if (dir === "S") n.y++;
        if (dir === "E") n.x++;
        if (dir === "W") n.x--;
        return n;
      });
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [maze]);

  return <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} />;
}

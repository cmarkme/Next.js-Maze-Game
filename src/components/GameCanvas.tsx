"use client";
import { useEffect, useRef, useState } from "react";
import { generateMaze } from "@/game/maze/generate";
import { draw } from "@/game/render/draw";
import { moveWithCollision } from "@/game/movement/canMove";
import { Maze, Player } from "@/game/types";
import { CELL_SIZE, PLAYER_SPEED } from "@/game/config";

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keys = useRef({ up: false, down: false, left: false, right: false });

  const [maze] = useState<Maze>(() => generateMaze(25, 25));
  const playerRef = useRef<Player>({
  x: (1.5) * CELL_SIZE,
  y: (1.5) * CELL_SIZE,
});

useEffect(() => {
  const canvas = canvasRef.current;
  const ctx = canvas?.getContext("2d");
  if (!ctx) return;

  draw(ctx, maze, playerRef.current);
}, [maze]);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "w") keys.current.up = true;
      if (e.key === "ArrowDown" || e.key === "s") keys.current.down = true;
      if (e.key === "ArrowLeft" || e.key === "a") keys.current.left = true;
      if (e.key === "ArrowRight" || e.key === "d") keys.current.right = true;
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "w") keys.current.up = false;
      if (e.key === "ArrowDown" || e.key === "s") keys.current.down = false;
      if (e.key === "ArrowLeft" || e.key === "a") keys.current.left = false;
      if (e.key === "ArrowRight" || e.key === "d") keys.current.right = false;
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let lastTime = performance.now();
  let rafId: number;

  const loop = (now: number) => {
    // delta time (seconds)
    const dt = Math.min(0.033, (now - lastTime) / 1000);
    lastTime = now;

    // --- INPUT ---
    let vx = 0;
    let vy = 0;

    if (keys.current.left) vx -= 1;
    if (keys.current.right) vx += 1;
    if (keys.current.up) vy -= 1;
    if (keys.current.down) vy += 1;

    // normalize (prevents faster diagonal movement)
    const length = Math.hypot(vx, vy);
    if (length > 0) {
      vx /= length;
      vy /= length;
    }

    // --- MOVEMENT ---
    const dx = vx * PLAYER_SPEED * dt;
    const dy = vy * PLAYER_SPEED * dt;

    const currentPlayer = playerRef.current;
    const nextPlayer = moveWithCollision(maze, currentPlayer, dx, dy);
    playerRef.current = nextPlayer;

    // --- RENDER ---
    draw(ctx, maze, nextPlayer);

    rafId = requestAnimationFrame(loop);
  };

  // start loop
  rafId = requestAnimationFrame(loop);

  // cleanup
  return () => {
    cancelAnimationFrame(rafId);
  };
}, [maze]);


  return (
    <canvas
      ref={canvasRef}
      width={1200}
      height={700}
      style={{ display: "block", background: "black" }}
    />
  );
}

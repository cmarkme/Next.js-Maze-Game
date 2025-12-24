"use client";

import { useEffect, useRef, useState } from "react";
import { generateMaze } from "@/game/maze/generate";
import { draw } from "@/game/render/draw";
import { moveWithCollision, moveCircleWithCollision } from "@/game/movement/canMove";
import { Maze, Player, Enemy } from "@/game/types";
import { CELL_SIZE, PLAYER_SPEED, PLAYER_RADIUS } from "@/game/config";



type Keys = { up: boolean; down: boolean; left: boolean; right: boolean };

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // keyboard support stays (desktop)
  const keys = useRef<Keys>({ up: false, down: false, left: false, right: false });

  // pinch/drag state
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const lastPinchDist = useRef<number | null>(null);

  // render state
  const scaleRef = useRef(1); // pinch zoom changes this
  const dprRef = useRef(1);

  const [maze] = useState<Maze>(() => generateMaze(25, 25));

  const playerRef = useRef<Player>({
    x: 1.5 * CELL_SIZE,
    y: 1.5 * CELL_SIZE,
  });


const enemyRef = useRef<Enemy>({
  x: playerRef.current.x + 6,
  y: playerRef.current.y + 6,
  r: PLAYER_RADIUS,
  speed: 180,
});


  // FULLSCREEN CANVAS (and crisp on mobile)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      dprRef.current = dpr;

      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);

      canvas.style.width = "100vw";
      canvas.style.height = "100vh";
      canvas.style.display = "block";
      canvas.style.background = "black";
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // KEYBOARD EVENTS (desktop)
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

  // POINTER EVENTS (mobile)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onPointerDown = (e: PointerEvent) => {
      // stop browser gestures / scrolling
      e.preventDefault();

      canvas.setPointerCapture(e.pointerId);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // reset pinch baseline when second finger appears
      if (pointers.current.size < 2) {
        lastPinchDist.current = null;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      e.preventDefault();

      const prev = pointers.current.get(e.pointerId)!;
      const nextPt = { x: e.clientX, y: e.clientY };
      pointers.current.set(e.pointerId, nextPt);

      // 1 finger drag = attempt movement (player stays centered visually)
      if (pointers.current.size === 1) {
        const dx = nextPt.x - prev.x;
        const dy = nextPt.y - prev.y;

        const scale = scaleRef.current;

        // convert screen drag (CSS px) into world movement.
        // negative because dragging right should "move player right" (world shifts opposite finger).
        const worldDx = -dx / scale;
        const worldDy = -dy / scale;

        playerRef.current = moveWithSubSteps(maze, playerRef.current, worldDx, worldDy, 4);

      }

      // 2 finger pinch = zoom the world (maze + player size)
      if (pointers.current.size === 2) {
        const [a, b] = Array.from(pointers.current.values());
        const dist = Math.hypot(a.x - b.x, a.y - b.y);

        const prevDist = lastPinchDist.current;
        lastPinchDist.current = dist;

        if (prevDist && prevDist > 0) {
          const zoom = dist / prevDist;

          const nextScale = clamp(scaleRef.current * zoom, 0.6, 3.0);
          scaleRef.current = nextScale;
        }
      }
    };

    const onPointerUpOrCancel = (e: PointerEvent) => {
      e.preventDefault();
      pointers.current.delete(e.pointerId);

      // if no longer pinching, reset pinch baseline
      if (pointers.current.size < 2) {
        lastPinchDist.current = null;
      }
    };

    // IMPORTANT: passive:false so preventDefault() works on mobile
    canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
    canvas.addEventListener("pointermove", onPointerMove, { passive: false });
    canvas.addEventListener("pointerup", onPointerUpOrCancel, { passive: false });
    canvas.addEventListener("pointercancel", onPointerUpOrCancel, { passive: false });

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown as any);
      canvas.removeEventListener("pointermove", onPointerMove as any);
      canvas.removeEventListener("pointerup", onPointerUpOrCancel as any);
      canvas.removeEventListener("pointercancel", onPointerUpOrCancel as any);
    };
  }, [maze]);

  // MAIN LOOP: keyboard movement + draw every frame
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let lastTime = performance.now();
    let rafId = 0;

    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - lastTime) / 1000);
      lastTime = now;

      // keyboard movement (desktop)
      let vx = 0;
      let vy = 0;
      if (keys.current.left) vx -= 1;
      if (keys.current.right) vx += 1;
      if (keys.current.up) vy -= 1;
      if (keys.current.down) vy += 1;

      const len = Math.hypot(vx, vy);
      if (len > 0) {
        vx /= len;
        vy /= len;

        const dx = vx * PLAYER_SPEED * dt;
        const dy = vy * PLAYER_SPEED * dt;
        playerRef.current = moveWithCollision(maze, playerRef.current, dx, dy);
      }
      // ENEMY CHASE + COLLISION (world space)
      {
        const e = enemyRef.current;
        const p = playerRef.current;

        const ex = p.x - e.x;
        const ey = p.y - e.y;
        const d = Math.hypot(ex, ey);

        if (d > 0.0001) {
          const dirx = ex / d;
          const diry = ey / d;

          const edx = dirx * e.speed * dt;
          const edy = diry * e.speed * dt;

          const next = moveCircleWithCollision(maze, e.x, e.y, e.r, edx, edy);
          e.x = next.x;
          e.y = next.y;
        }

        // CONTACT (simple hit)
        const hit = Math.hypot(p.x - e.x, p.y - e.y) <= (PLAYER_RADIUS + e.r);
        if (hit) {
          // simplest "interaction" for now: shove enemy away
          e.x = p.x + 6;
          e.y = p.y + 6;
        }
      }

      draw(ctx, maze, playerRef.current, enemyRef.current, scaleRef.current, dprRef.current);


      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [maze]);

  return <canvas ref={canvasRef} />;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
function moveWithSubSteps(
  maze: Maze,
  player: Player,
  dx: number,
  dy: number,
  maxStep = 2 // world-units per step (smaller = safer)
) {
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return player;

  const steps = Math.ceil(dist / maxStep);
  const stepX = dx / steps;
  const stepY = dy / steps;

  let p = player;

  for (let i = 0; i < steps; i++) {
    const next = moveWithCollision(maze, p, stepX, stepY);

    // If collision prevented movement, stop early.
    if (next.x === p.x && next.y === p.y) break;

    p = next;
  }

  return p;
}


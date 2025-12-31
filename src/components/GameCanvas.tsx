"use client";

import { useEffect, useRef, useState } from "react";
import { generateMaze } from "@/game/maze/generate";
import { draw } from "@/game/render/draw";
import { moveWithCollision, moveCircleWithCollision } from "@/game/movement/canMove";
import { Maze, Player, Enemy } from "@/game/types";
import { CELL_SIZE, PLAYER_SPEED, PLAYER_RADIUS } from "@/game/config";
import {
  buildFlowField,
  worldToCell,
  nextCellFromFlow,
  FlowField,
} from "@/game/ai/flowField";

type EnemyState = Enemy & { active: boolean };
type Keys = { up: boolean; down: boolean; left: boolean; right: boolean };

// Enemy settings
const ENEMY_COUNT = 80;
const ENEMY_SPEED = 180;
const ENEMY_RADIUS = PLAYER_RADIUS;

// how close you must be to "wake" an enemy (world units)
const AGGRO_RADIUS = CELL_SIZE * 3.0;

// don't spawn enemies too close to player at start
const SPAWN_MIN_DIST = CELL_SIZE * 4.0;

export default function GameCanvas() {
  const flowFieldRef = useRef<FlowField | null>(null);
  const lastPlayerCellRef = useRef<{ cx: number; cy: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // keyboard support stays (desktop)
  const keys = useRef<Keys>({ up: false, down: false, left: false, right: false });

  // pinch/drag state
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const lastPinchDist = useRef<number | null>(null);

  // render state
  const scaleRef = useRef(1); // pinch zoom changes this
  const dprRef = useRef(1);

  const [maze] = useState<Maze>(() => generateMaze(100, 100));

  const playerRef = useRef<Player>({
    x: 1.5 * CELL_SIZE,
    y: 1.5 * CELL_SIZE,
  });

  // ✅ MULTIPLE ENEMIES live here
  const enemiesRef = useRef<EnemyState[]>([]);

  // ✅ Spawn enemies ONCE
  useEffect(() => {
    if (enemiesRef.current.length > 0) return;
    enemiesRef.current = spawnEnemies(maze, playerRef.current, ENEMY_COUNT);
  }, [maze]);

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
      e.preventDefault();

      canvas.setPointerCapture(e.pointerId);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

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

      // 1 finger drag = attempt movement
      if (pointers.current.size === 1) {
        const dx = nextPt.x - prev.x;
        const dy = nextPt.y - prev.y;

        const scale = scaleRef.current;

        const worldDx = -dx / scale;
        const worldDy = -dy / scale;

        playerRef.current = moveWithSubSteps(maze, playerRef.current, worldDx, worldDy, 4);
      }

      // 2 finger pinch = zoom
      if (pointers.current.size === 2) {
        const [a, b] = Array.from(pointers.current.values());
        const dist = Math.hypot(a.x - b.x, a.y - b.y);

        const prevDist = lastPinchDist.current;
        lastPinchDist.current = dist;

        if (prevDist && prevDist > 0) {
          const zoom = dist / prevDist;
          const nextScale = clamp(scaleRef.current * zoom, 0.2, 3.0);
          scaleRef.current = nextScale;
        }
      }
    };

    const onPointerUpOrCancel = (e: PointerEvent) => {
      e.preventDefault();
      pointers.current.delete(e.pointerId);

      if (pointers.current.size < 2) {
        lastPinchDist.current = null;
      }
    };

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

  // MAIN LOOP
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let lastTime = performance.now();
    let rafId = 0;

    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - lastTime) / 1000);
      lastTime = now;

      // keyboard movement
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

      // ✅ MULTI-ENEMY FLOWFIELD CHASE + AGGRO
      {
        const p = playerRef.current;

        // player cell
        const pc = worldToCell(p.x, p.y);

        // rebuild flow field ONLY if player changed cell
        const last = lastPlayerCellRef.current;
        if (!last || last.cx !== pc.cx || last.cy !== pc.cy) {
          flowFieldRef.current = buildFlowField(maze, pc.cx, pc.cy);
          lastPlayerCellRef.current = pc;
        }

        const field = flowFieldRef.current;

        if (field) {
          for (const e of enemiesRef.current) {
            // wake enemy if close enough
            if (!e.active) {
              const dist = Math.hypot(p.x - e.x, p.y - e.y);
              if (dist <= AGGRO_RADIUS) e.active = true;
              else continue; // asleep
            }

            const ec = worldToCell(e.x, e.y);

            const nextCell = nextCellFromFlow(maze, field, ec.cx, ec.cy);

            const sameCell = ec.cx === pc.cx && ec.cy === pc.cy;
            const tx = sameCell ? p.x : (nextCell.cx + 0.5) * CELL_SIZE;
            const ty = sameCell ? p.y : (nextCell.cy + 0.5) * CELL_SIZE;

            const dx = tx - e.x;
            const dy = ty - e.y;
            const d = Math.hypot(dx, dy);

            if (d > 0.001) {
              const edx = (dx / d) * e.speed * dt;
              const edy = (dy / d) * e.speed * dt;

              const next = moveCircleWithCollision(maze, e.x, e.y, e.r, edx, edy);
              e.x = next.x;
              e.y = next.y;
            }

            // contact = "kill" placeholder
            const hit = Math.hypot(p.x - e.x, p.y - e.y) <= (PLAYER_RADIUS + e.r);
            if (hit) {
              // For now: shove enemy away and put it back to sleep
              const spawn = pickSpawnCell(maze, p, SPAWN_MIN_DIST);
              e.x = (spawn.cx + 0.5) * CELL_SIZE;
              e.y = (spawn.cy + 0.5) * CELL_SIZE;
              e.active = false;
            }
          }
        }
      }

      // ✅ draw now receives an array of enemies
      draw(ctx, maze, playerRef.current, enemiesRef.current, scaleRef.current, dprRef.current);

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
  maxStep = 2
) {
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return player;

  const steps = Math.ceil(dist / maxStep);
  const stepX = dx / steps;
  const stepY = dy / steps;

  let p = player;

  for (let i = 0; i < steps; i++) {
    const next = moveWithCollision(maze, p, stepX, stepY);
    if (next.x === p.x && next.y === p.y) break;
    p = next;
  }

  return p;
}

// ---------- enemy spawn helpers ----------

function spawnEnemies(maze: Maze, player: Player, count: number): EnemyState[] {
  const enemies: EnemyState[] = [];
  const used = new Set<number>();

  for (let i = 0; i < count; i++) {
    const cell = pickSpawnCell(maze, player, SPAWN_MIN_DIST, used);
    used.add(cell.cy * maze.width + cell.cx);

    enemies.push({
      x: (cell.cx + 0.5) * CELL_SIZE,
      y: (cell.cy + 0.5) * CELL_SIZE,
      r: ENEMY_RADIUS,
      speed: ENEMY_SPEED,
      active: false,
    });
  }

  return enemies;
}

function pickSpawnCell(
  maze: Maze,
  player: Player,
  minDist: number,
  used?: Set<number>
) {
  const pcx = Math.floor(player.x / CELL_SIZE);
  const pcy = Math.floor(player.y / CELL_SIZE);

  for (let tries = 0; tries < 2000; tries++) {
    const cx = Math.floor(Math.random() * maze.width);
    const cy = Math.floor(Math.random() * maze.height);

    const index = cy * maze.width + cx;
    if (used?.has(index)) continue;

    if (cx === pcx && cy === pcy) continue;

    const x = (cx + 0.5) * CELL_SIZE;
    const y = (cy + 0.5) * CELL_SIZE;

    if (Math.hypot(x - player.x, y - player.y) >= minDist) {
      return { cx, cy };
    }
  }

  // fallback
  return { cx: Math.max(0, Math.min(maze.width - 1, pcx + 5)), cy: pcy };
}

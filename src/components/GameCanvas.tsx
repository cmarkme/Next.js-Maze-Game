"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { generateMaze } from "@/game/maze/generate";
import { draw } from "@/game/render/draw";
import {
  moveCircleWithCollision,
  moveWithCollision,
} from "@/game/movement/canMove";
import {
  Core,
  Enemy,
  Exit,
  Maze,
  Player,
  ShieldPickup,
} from "@/game/types";
import { CELL_SIZE, PLAYER_RADIUS, PLAYER_SPEED } from "@/game/config";
import {
  buildFlowField,
  FlowField,
  nextCellFromFlow,
  worldToCell,
} from "@/game/ai/flowField";
import styles from "./GameCanvas.module.css";

type Keys = { up: boolean; down: boolean; left: boolean; right: boolean };
type GameStatus = "playing" | "gameover";

const MAZE_SIZE = 30;
const MAX_HEALTH = 3;
const CORE_COUNT = 3;
const BASE_ENEMY_COUNT = 36;
const BASE_ENEMY_SPEED = 150;
const ENEMY_RADIUS = PLAYER_RADIUS;
const BASE_AGGRO_RADIUS = CELL_SIZE * 2.75;
const SPAWN_MIN_DIST = CELL_SIZE * 4;
const DASH_DURATION_MS = 260;
const DASH_COOLDOWN_MS = 1600;
const DASH_MULTIPLIER = 2.4;
const HIT_INVULNERABILITY_MS = 1100;
const DEFAULT_CAMERA_SCALE = 0.72;
const MIN_CAMERA_SCALE = 0.32;
const MAX_CAMERA_SCALE = 1.8;
const CAMERA_ZOOM_STEP = 1.15;
const COMPACT_HUD_SCALE = 1.05;

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const flowFieldRef = useRef<FlowField | null>(null);
  const lastPlayerCellRef = useRef<{ cx: number; cy: number } | null>(null);
  const keys = useRef<Keys>({ up: false, down: false, left: false, right: false });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const lastPinchDist = useRef<number | null>(null);
  const scaleRef = useRef(DEFAULT_CAMERA_SCALE);
  const dprRef = useRef(1);

  const [maze, setMaze] = useState<Maze>(() => generateMaze(MAZE_SIZE, MAZE_SIZE));
  const playerRef = useRef<Player>({ x: 1.5 * CELL_SIZE, y: 1.5 * CELL_SIZE });
  const enemiesRef = useRef<Enemy[]>([]);
  const coresRef = useRef<Core[]>([]);
  const exitRef = useRef<Exit | null>(null);
  const shieldPickupRef = useRef<ShieldPickup | null>(null);

  const [health, setHealth] = useState(MAX_HEALTH);
  const healthRef = useRef(MAX_HEALTH);
  const [coresCollected, setCoresCollected] = useState(0);
  const coresCollectedRef = useRef(0);
  const [level, setLevel] = useState(1);
  const levelRef = useRef(1);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const levelStartRef = useRef(0);
  const lastTimerUpdateRef = useRef(0);
  const [shieldActive, setShieldActive] = useState(false);
  const shieldActiveRef = useRef(false);
  const [dashReady, setDashReady] = useState(true);
  const dashReadyRef = useRef(true);
  const dashUntilRef = useRef(0);
  const dashReadyAtRef = useRef(0);
  const invulnerableUntilRef = useRef(0);
  const [gameStatus, setGameStatus] = useState<GameStatus>("playing");
  const gameStatusRef = useRef<GameStatus>("playing");
  const advancingRef = useRef(false);
  const [message, setMessage] = useState("FIND THE ENERGY CORES");
  const [zoomPercent, setZoomPercent] = useState(
    Math.round(DEFAULT_CAMERA_SCALE * 100)
  );

  const addScore = useCallback((amount: number) => {
    scoreRef.current += amount;
    setScore(scoreRef.current);
  }, []);

  const setCameraScale = useCallback((nextScale: number) => {
    const next = clamp(nextScale, MIN_CAMERA_SCALE, MAX_CAMERA_SCALE);
    scaleRef.current = next;
    const nextPercent = Math.round(next * 100);
    setZoomPercent((current) =>
      current === nextPercent ? current : nextPercent
    );
  }, []);

  const triggerDash = useCallback(() => {
    const now = performance.now();
    if (gameStatusRef.current !== "playing" || !dashReadyRef.current) return;

    dashUntilRef.current = now + DASH_DURATION_MS;
    dashReadyAtRef.current = now + DASH_COOLDOWN_MS;
    dashReadyRef.current = false;
    setDashReady(false);
  }, []);

  const completeLevel = useCallback(() => {
    if (advancingRef.current) return;
    advancingRef.current = true;

    const seconds = Math.floor((performance.now() - levelStartRef.current) / 1000);
    addScore(500 + Math.max(100, 600 - seconds * 10));

    const nextHealth = Math.min(MAX_HEALTH, healthRef.current + 1);
    healthRef.current = nextHealth;
    setHealth(nextHealth);

    levelRef.current += 1;
    setLevel(levelRef.current);
    setMessage(`LEVEL ${levelRef.current}`);
    coresCollectedRef.current = 0;
    setCoresCollected(0);
    shieldActiveRef.current = false;
    setShieldActive(false);
    dashReadyRef.current = true;
    setDashReady(true);
    setElapsed(0);

    const size = MAZE_SIZE + Math.min(6, (levelRef.current - 1) * 2);
    setMaze(generateMaze(size, size));
  }, [addScore]);

  const restartGame = useCallback(() => {
    levelRef.current = 1;
    setLevel(1);
    scoreRef.current = 0;
    setScore(0);
    healthRef.current = MAX_HEALTH;
    setHealth(MAX_HEALTH);
    coresCollectedRef.current = 0;
    setCoresCollected(0);
    shieldActiveRef.current = false;
    setShieldActive(false);
    dashReadyRef.current = true;
    setDashReady(true);
    setElapsed(0);
    gameStatusRef.current = "playing";
    setGameStatus("playing");
    setMessage("FIND THE ENERGY CORES");
    setMaze(generateMaze(MAZE_SIZE, MAZE_SIZE));
  }, []);

  // Prepare all actors and objectives whenever a new maze is created.
  useEffect(() => {
    const player = { x: 1.5 * CELL_SIZE, y: 1.5 * CELL_SIZE };
    playerRef.current = player;

    const used = new Set<number>();
    used.add(maze.width + 1);

    const exitCell = findFarthestCell(maze, 1, 1);
    used.add(exitCell.cy * maze.width + exitCell.cx);
    exitRef.current = {
      x: (exitCell.cx + 0.5) * CELL_SIZE,
      y: (exitCell.cy + 0.5) * CELL_SIZE,
      unlocked: false,
    };

    coresRef.current = spawnCores(maze, player, CORE_COUNT, used);
    const shieldCell = pickSpawnCell(maze, player, CELL_SIZE * 3, used);
    used.add(shieldCell.cy * maze.width + shieldCell.cx);
    shieldPickupRef.current = {
      x: (shieldCell.cx + 0.5) * CELL_SIZE,
      y: (shieldCell.cy + 0.5) * CELL_SIZE,
      collected: false,
    };

    const enemyCount = Math.min(96, BASE_ENEMY_COUNT + (levelRef.current - 1) * 8);
    const enemySpeed = BASE_ENEMY_SPEED + (levelRef.current - 1) * 10;
    enemiesRef.current = spawnEnemies(maze, player, enemyCount, enemySpeed, used);

    coresCollectedRef.current = 0;
    shieldActiveRef.current = false;
    invulnerableUntilRef.current = 0;
    dashUntilRef.current = 0;
    dashReadyAtRef.current = 0;
    dashReadyRef.current = true;
    flowFieldRef.current = null;
    lastPlayerCellRef.current = null;
    advancingRef.current = false;
    levelStartRef.current = performance.now();
    lastTimerUpdateRef.current = 0;
    gameStatusRef.current = "playing";

    const timer = window.setTimeout(() => setMessage(""), 1800);
    return () => window.clearTimeout(timer);
  }, [maze]);

  // Keep the canvas crisp and full-screen.
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
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Keyboard movement and dash.
  useEffect(() => {
    const onDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (event.ctrlKey || event.metaKey) {
        if (key === "+" || key === "=" || event.code === "NumpadAdd") {
          event.preventDefault();
          setCameraScale(scaleRef.current * CAMERA_ZOOM_STEP);
          return;
        }
        if (key === "-" || key === "_" || event.code === "NumpadSubtract") {
          event.preventDefault();
          setCameraScale(scaleRef.current / CAMERA_ZOOM_STEP);
          return;
        }
        if (key === "0" || event.code === "Numpad0") {
          event.preventDefault();
          setCameraScale(DEFAULT_CAMERA_SCALE);
          return;
        }
      }

      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
        event.preventDefault();
      }
      if (key === "arrowup" || key === "w") keys.current.up = true;
      if (key === "arrowdown" || key === "s") keys.current.down = true;
      if (key === "arrowleft" || key === "a") keys.current.left = true;
      if (key === "arrowright" || key === "d") keys.current.right = true;
      if ((key === "shift" || key === " ") && !event.repeat) triggerDash();
    };

    const onUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "arrowup" || key === "w") keys.current.up = false;
      if (key === "arrowdown" || key === "s") keys.current.down = false;
      if (key === "arrowleft" || key === "a") keys.current.left = false;
      if (key === "arrowright" || key === "d") keys.current.right = false;
    };

    window.addEventListener("keydown", onDown, true);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown, true);
      window.removeEventListener("keyup", onUp);
    };
  }, [setCameraScale, triggerDash]);

  // One-finger movement and two-finger zoom for touch screens.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onPointerDown = (event: PointerEvent) => {
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.current.size === 2) {
        const [a, b] = Array.from(pointers.current.values());
        lastPinchDist.current = Math.hypot(a.x - b.x, a.y - b.y);
      } else {
        lastPinchDist.current = null;
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!pointers.current.has(event.pointerId) || gameStatusRef.current !== "playing") return;
      event.preventDefault();

      const previous = pointers.current.get(event.pointerId)!;
      const nextPoint = { x: event.clientX, y: event.clientY };
      pointers.current.set(event.pointerId, nextPoint);

      if (pointers.current.size === 1) {
        const boost = performance.now() < dashUntilRef.current ? DASH_MULTIPLIER : 1;
        const worldDx = ((nextPoint.x - previous.x) / scaleRef.current) * boost;
        const worldDy = ((nextPoint.y - previous.y) / scaleRef.current) * boost;
        playerRef.current = moveWithSubSteps(maze, playerRef.current, worldDx, worldDy, 4);
      }

      if (pointers.current.size === 2) {
        const [a, b] = Array.from(pointers.current.values());
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        const previousDistance = lastPinchDist.current;
        lastPinchDist.current = distance;

        if (previousDistance && previousDistance > 0) {
          setCameraScale(scaleRef.current * (distance / previousDistance));
        }
      }
    };

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const zoomFactor = Math.exp(-event.deltaY * 0.002);
      setCameraScale(scaleRef.current * zoomFactor);
    };

    const onPointerUpOrCancel = (event: PointerEvent) => {
      event.preventDefault();
      pointers.current.delete(event.pointerId);
      if (pointers.current.size < 2) lastPinchDist.current = null;
    };

    canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
    canvas.addEventListener("pointermove", onPointerMove, { passive: false });
    canvas.addEventListener("pointerup", onPointerUpOrCancel, { passive: false });
    canvas.addEventListener("pointercancel", onPointerUpOrCancel, { passive: false });
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUpOrCancel);
      canvas.removeEventListener("pointercancel", onPointerUpOrCancel);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [maze, setCameraScale]);

  // Main game loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let lastTime = performance.now();
    let animationFrame = 0;

    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - lastTime) / 1000);
      lastTime = now;

      if (!dashReadyRef.current && now >= dashReadyAtRef.current) {
        dashReadyRef.current = true;
        setDashReady(true);
      }

      if (gameStatusRef.current === "playing") {
        if (now - lastTimerUpdateRef.current >= 250) {
          setElapsed(Math.floor((now - levelStartRef.current) / 1000));
          lastTimerUpdateRef.current = now;
        }

        let vx = Number(keys.current.right) - Number(keys.current.left);
        let vy = Number(keys.current.down) - Number(keys.current.up);
        const length = Math.hypot(vx, vy);

        if (length > 0) {
          vx /= length;
          vy /= length;
          const speed = PLAYER_SPEED * (now < dashUntilRef.current ? DASH_MULTIPLIER : 1);
          playerRef.current = moveWithCollision(
            maze,
            playerRef.current,
            vx * speed * dt,
            vy * speed * dt
          );
        }

        const player = playerRef.current;

        for (const core of coresRef.current) {
          if (!core.collected && distanceBetween(player, core) <= PLAYER_RADIUS + 26) {
            core.collected = true;
            coresCollectedRef.current += 1;
            setCoresCollected(coresCollectedRef.current);
            addScore(100);

            if (coresCollectedRef.current === CORE_COUNT && exitRef.current) {
              exitRef.current.unlocked = true;
              setMessage("EXIT OPEN");
              window.setTimeout(() => setMessage(""), 1600);
            }
          }
        }

        const shieldPickup = shieldPickupRef.current;
        if (
          shieldPickup &&
          !shieldPickup.collected &&
          distanceBetween(player, shieldPickup) <= PLAYER_RADIUS + 25
        ) {
          shieldPickup.collected = true;
          shieldActiveRef.current = true;
          setShieldActive(true);
          addScore(75);
          setMessage("SHIELD CHARGED");
          window.setTimeout(() => setMessage(""), 1300);
        }

        const exit = exitRef.current;
        if (exit?.unlocked && distanceBetween(player, exit) <= PLAYER_RADIUS + 42) {
          completeLevel();
        }

        const playerCell = worldToCell(player.x, player.y);
        const lastCell = lastPlayerCellRef.current;
        if (!lastCell || lastCell.cx !== playerCell.cx || lastCell.cy !== playerCell.cy) {
          flowFieldRef.current = buildFlowField(maze, playerCell.cx, playerCell.cy);
          lastPlayerCellRef.current = playerCell;
        }

        const field = flowFieldRef.current;
        if (field) {
          const aggroRadius = BASE_AGGRO_RADIUS + coresCollectedRef.current * CELL_SIZE * 0.75;
          const speedBoost = 1 + coresCollectedRef.current * 0.08;

          for (const enemy of enemiesRef.current) {
            if (!enemy.active) {
              if (distanceBetween(player, enemy) <= aggroRadius) enemy.active = true;
              else continue;
            }

            const enemyCell = worldToCell(enemy.x, enemy.y);
            const nextCell = nextCellFromFlow(
              maze,
              field,
              enemyCell.cx,
              enemyCell.cy
            );
            const sameCell =
              enemyCell.cx === playerCell.cx && enemyCell.cy === playerCell.cy;
            const targetX = sameCell ? player.x : (nextCell.cx + 0.5) * CELL_SIZE;
            const targetY = sameCell ? player.y : (nextCell.cy + 0.5) * CELL_SIZE;
            const dx = targetX - enemy.x;
            const dy = targetY - enemy.y;
            const distance = Math.hypot(dx, dy);

            if (distance > 0.001) {
              const enemyStep = enemy.speed * speedBoost * dt;
              const next = moveCircleWithCollision(
                maze,
                enemy.x,
                enemy.y,
                enemy.r,
                (dx / distance) * enemyStep,
                (dy / distance) * enemyStep
              );
              enemy.x = next.x;
              enemy.y = next.y;
            }

            if (
              now >= invulnerableUntilRef.current &&
              distanceBetween(player, enemy) <= PLAYER_RADIUS + enemy.r
            ) {
              invulnerableUntilRef.current = now + HIT_INVULNERABILITY_MS;

              if (shieldActiveRef.current) {
                shieldActiveRef.current = false;
                setShieldActive(false);
                setMessage("SHIELD BROKEN");
                window.setTimeout(() => setMessage(""), 1000);
              } else {
                healthRef.current -= 1;
                setHealth(healthRef.current);

                if (healthRef.current <= 0) {
                  gameStatusRef.current = "gameover";
                  setGameStatus("gameover");
                  keys.current = { up: false, down: false, left: false, right: false };
                }
              }

              const respawn = pickSpawnCell(maze, player, SPAWN_MIN_DIST);
              enemy.x = (respawn.cx + 0.5) * CELL_SIZE;
              enemy.y = (respawn.cy + 0.5) * CELL_SIZE;
              enemy.active = false;
            }
          }
        }
      }

      draw(
        ctx,
        maze,
        playerRef.current,
        enemiesRef.current,
        coresRef.current,
        exitRef.current,
        shieldPickupRef.current,
        scaleRef.current,
        dprRef.current,
        {
          dashActive: now < dashUntilRef.current,
          playerInvulnerable: now < invulnerableUntilRef.current,
          shieldActive: shieldActiveRef.current,
        }
      );

      animationFrame = requestAnimationFrame(loop);
    };

    animationFrame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrame);
  }, [addScore, completeLevel, maze]);

  const exitOpen = coresCollected === CORE_COUNT;
  const compactHud = zoomPercent >= Math.round(COMPACT_HUD_SCALE * 100);

  return (
    <div className={styles.gameShell}>
      <canvas ref={canvasRef} className={styles.canvas} aria-label="Neon maze game" />

      <div className={`${styles.hud} ${compactHud ? styles.cameraCompact : ""}`}>
        <div className={styles.topBar}>
          <div className={styles.panel} aria-label={`Health ${health} of ${MAX_HEALTH}`}>
            <div className={styles.fullStat}>
              <span className={styles.eyebrow}>Integrity</span>
              <div className={`${styles.value} ${styles.hearts}`}>
                {"♥".repeat(health)}{"♡".repeat(MAX_HEALTH - health)}
              </div>
            </div>
            <div className={`${styles.compactStat} ${styles.hearts}`}>♥ {health}</div>
          </div>

          <div
            className={`${styles.panel} ${styles.objective}`}
            aria-label={exitOpen ? "Exit open" : `${coresCollected} of ${CORE_COUNT} cores collected`}
          >
            <div className={styles.fullStat}>
              <span className={styles.eyebrow}>Objective</span>
              <div className={`${styles.value} ${exitOpen ? styles.objectiveReady : ""}`}>
                {exitOpen ? "REACH THE EXIT" : `CORES ${coresCollected}/${CORE_COUNT}`}
              </div>
            </div>
            <div className={`${styles.compactStat} ${exitOpen ? styles.objectiveReady : ""}`}>
              {exitOpen ? "→" : `◆ ${coresCollected}/${CORE_COUNT}`}
            </div>
          </div>

          <div
            className={`${styles.panel} ${styles.scorePanel}`}
            aria-label={`Level ${level}, ${elapsed} seconds, score ${score}`}
          >
            <div className={styles.fullStat}>
              <span className={styles.eyebrow}>Level {level} · {elapsed}s</span>
              <div className={styles.value}>SCORE {score.toString().padStart(5, "0")}</div>
            </div>
            <div className={styles.compactStat}>L{level} · {score.toString().padStart(4, "0")}</div>
          </div>
        </div>

        {message && <div className={styles.message}>{message}</div>}

        <div className={styles.bottomBar}>
          <div className={styles.bottomLeft}>
            <div className={`${styles.panel} ${styles.controls}`}>
              WASD / ARROWS TO MOVE · SHIFT / SPACE TO DASH · CTRL +/- TO ZOOM · PINCH ON TOUCH
              {shieldActive && " · SHIELD ACTIVE"}
            </div>
            <div className={styles.zoomControls} role="group" aria-label="Camera zoom controls">
              <button
                type="button"
                aria-label="Zoom out"
                onClick={() => setCameraScale(scaleRef.current / CAMERA_ZOOM_STEP)}
              >
                −
              </button>
              <button
                type="button"
                className={styles.zoomReadout}
                aria-label={`Reset camera zoom. Current zoom ${zoomPercent} percent`}
                onClick={() => setCameraScale(DEFAULT_CAMERA_SCALE)}
              >
                {zoomPercent}%
              </button>
              <button
                type="button"
                aria-label="Zoom in"
                onClick={() => setCameraScale(scaleRef.current * CAMERA_ZOOM_STEP)}
              >
                +
              </button>
            </div>
          </div>
          <button
            type="button"
            className={styles.dashButton}
            disabled={!dashReady || gameStatus !== "playing"}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              triggerDash();
            }}
          >
            {dashReady ? "DASH" : "CHARGING"}
          </button>
        </div>
      </div>

      {gameStatus === "gameover" && (
        <div className={styles.gameOver} role="dialog" aria-modal="true" aria-labelledby="game-over-title">
          <div className={styles.gameOverCard}>
            <h1 id="game-over-title">SIGNAL LOST</h1>
            <p>You reached level {level}.</p>
            <p>Final score: {score}</p>
            <button type="button" className={styles.restartButton} onClick={restartGame}>
              RESTART RUN
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distanceBetween(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function moveWithSubSteps(
  maze: Maze,
  player: Player,
  dx: number,
  dy: number,
  maxStep = 2
) {
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return player;

  const steps = Math.ceil(distance / maxStep);
  const stepX = dx / steps;
  const stepY = dy / steps;
  let nextPlayer = player;

  for (let index = 0; index < steps; index += 1) {
    const next = moveWithCollision(maze, nextPlayer, stepX, stepY);
    if (next.x === nextPlayer.x && next.y === nextPlayer.y) break;
    nextPlayer = next;
  }

  return nextPlayer;
}

function spawnCores(
  maze: Maze,
  player: Player,
  count: number,
  used: Set<number>
): Core[] {
  return Array.from({ length: count }, () => {
    const cell = pickSpawnCell(maze, player, CELL_SIZE * 4, used);
    used.add(cell.cy * maze.width + cell.cx);
    return {
      x: (cell.cx + 0.5) * CELL_SIZE,
      y: (cell.cy + 0.5) * CELL_SIZE,
      collected: false,
    };
  });
}

function spawnEnemies(
  maze: Maze,
  player: Player,
  count: number,
  speed: number,
  reserved: Set<number>
): Enemy[] {
  const enemies: Enemy[] = [];
  const used = new Set(reserved);

  for (let index = 0; index < count; index += 1) {
    const cell = pickSpawnCell(maze, player, SPAWN_MIN_DIST, used);
    used.add(cell.cy * maze.width + cell.cx);
    enemies.push({
      x: (cell.cx + 0.5) * CELL_SIZE,
      y: (cell.cy + 0.5) * CELL_SIZE,
      r: ENEMY_RADIUS,
      speed,
      active: false,
    });
  }

  return enemies;
}

function pickSpawnCell(
  maze: Maze,
  player: Player,
  minDistance: number,
  used?: Set<number>
) {
  const playerCellX = Math.floor(player.x / CELL_SIZE);
  const playerCellY = Math.floor(player.y / CELL_SIZE);

  for (let attempt = 0; attempt < 3000; attempt += 1) {
    const cx = Math.floor(Math.random() * maze.width);
    const cy = Math.floor(Math.random() * maze.height);
    const index = cy * maze.width + cx;
    if (used?.has(index) || (cx === playerCellX && cy === playerCellY)) continue;

    const x = (cx + 0.5) * CELL_SIZE;
    const y = (cy + 0.5) * CELL_SIZE;
    if (Math.hypot(x - player.x, y - player.y) >= minDistance) return { cx, cy };
  }

  for (let cy = maze.height - 1; cy >= 0; cy -= 1) {
    for (let cx = maze.width - 1; cx >= 0; cx -= 1) {
      if (!used?.has(cy * maze.width + cx)) return { cx, cy };
    }
  }

  return { cx: maze.width - 1, cy: maze.height - 1 };
}

function findFarthestCell(maze: Maze, startX: number, startY: number) {
  const distances = new Array(maze.width * maze.height).fill(-1);
  const queue: Array<{ cx: number; cy: number }> = [{ cx: startX, cy: startY }];
  distances[startY * maze.width + startX] = 0;
  let head = 0;
  let farthest = queue[0];

  while (head < queue.length) {
    const current = queue[head];
    head += 1;
    const currentIndex = current.cy * maze.width + current.cx;
    const cell = maze.cells[currentIndex];
    const neighbors = [
      { cx: current.cx, cy: current.cy - 1, blocked: cell.walls.N },
      { cx: current.cx + 1, cy: current.cy, blocked: cell.walls.E },
      { cx: current.cx, cy: current.cy + 1, blocked: cell.walls.S },
      { cx: current.cx - 1, cy: current.cy, blocked: cell.walls.W },
    ];

    for (const neighbor of neighbors) {
      if (
        neighbor.blocked ||
        neighbor.cx < 0 ||
        neighbor.cy < 0 ||
        neighbor.cx >= maze.width ||
        neighbor.cy >= maze.height
      ) {
        continue;
      }

      const neighborIndex = neighbor.cy * maze.width + neighbor.cx;
      if (distances[neighborIndex] !== -1) continue;
      distances[neighborIndex] = distances[currentIndex] + 1;
      queue.push({ cx: neighbor.cx, cy: neighbor.cy });

      const farthestIndex = farthest.cy * maze.width + farthest.cx;
      if (distances[neighborIndex] > distances[farthestIndex]) {
        farthest = { cx: neighbor.cx, cy: neighbor.cy };
      }
    }
  }

  return farthest;
}

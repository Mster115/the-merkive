import * as React from "react";
import type { HoleLayout, BallState, Vec2, Obstacle } from "./types";

export interface CourseCanvasProps {
  hole: HoleLayout;
  ball: BallState;
  aimAngle: number | null;
  aimPower: number;
  shotFrames: Vec2[] | null;
  onAnimationComplete?: () => void;
  className?: string;
}

export function CourseCanvas({
  hole,
  ball,
  aimAngle,
  aimPower,
  shotFrames,
  onAnimationComplete,
  className = "",
}: CourseCanvasProps): React.JSX.Element {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const animationRef = React.useRef<number | null>(null);
  const [currentFrameIndex, setCurrentFrameIndex] = React.useState(0);

  const isReducedMotion = React.useRef(
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );

  // Constants
  const CANVAS_SIZE = 400;
  const BALL_RADIUS = 6;

  const draw = React.useCallback(
    (ctx: CanvasRenderingContext2D, ballPos: Vec2) => {
      // Clear and draw background (lawn)
      ctx.fillStyle = "#1e8449";
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Draw lawn grass grid texture
      ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= CANVAS_SIZE; x += 20) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_SIZE);
      }
      for (let y = 0; y <= CANVAS_SIZE; y += 20) {
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_SIZE, y);
      }
      ctx.stroke();

      // Draw Tee Pad indicator
      const teePos = hole.tee;
      ctx.fillStyle = "#ffc53d";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(teePos.x, teePos.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(teePos.x, teePos.y, 2, 0, Math.PI * 2);
      ctx.fill();

      // Extract obstacle types
      const walls = [...hole.walls];
      const bumpers: { center: Vec2; radius: number }[] = [];
      const sandZones: Vec2[][] = [];
      const waterZones: Vec2[][] = [];

      for (const obs of hole.obstacles) {
        if (obs.kind === "wall") {
          walls.push(obs.wall);
        } else if (obs.kind === "bumper") {
          bumpers.push(obs.bumper);
        } else if (obs.kind === "sand") {
          sandZones.push(obs.zone.points);
        } else if (obs.kind === "water") {
          waterZones.push(obs.zone.points);
        }
      }

      // Draw water hazard zones
      ctx.fillStyle = "#38bdf8";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3;
      for (const pts of waterZones) {
        if (pts.length < 3) continue;
        ctx.beginPath();
        const firstPoint = pts[0];
        if (firstPoint) {
          ctx.moveTo(firstPoint.x, firstPoint.y);
          for (let i = 1; i < pts.length; i++) {
            const p = pts[i];
            if (p) ctx.lineTo(p.x, p.y);
          }
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Wave detail lines inside water
        if (pts[0]) {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(pts[0].x + 10, pts[0].y + 10, 6, 0, Math.PI);
          ctx.stroke();
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 3;
        }
      }

      // Draw sand hazard zones
      ctx.fillStyle = "#fde047";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3;
      for (const pts of sandZones) {
        if (pts.length < 3) continue;
        ctx.beginPath();
        const firstPoint = pts[0];
        if (firstPoint) {
          ctx.moveTo(firstPoint.x, firstPoint.y);
          for (let i = 1; i < pts.length; i++) {
            const p = pts[i];
            if (p) ctx.lineTo(p.x, p.y);
          }
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Draw bumpers
      for (const bumper of bumpers) {
        ctx.fillStyle = "#ff9f1c";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(bumper.center.x, bumper.center.y, bumper.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Bumper star/plus accent
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bumper.center.x - 4, bumper.center.y);
        ctx.lineTo(bumper.center.x + 4, bumper.center.y);
        ctx.moveTo(bumper.center.x, bumper.center.y - 4);
        ctx.lineTo(bumper.center.x, bumper.center.y + 4);
        ctx.stroke();
      }

      // Draw wall shadow lines
      ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const wall of walls) {
        ctx.beginPath();
        ctx.moveTo(wall.a.x + 3, wall.a.y + 3);
        ctx.lineTo(wall.b.x + 3, wall.b.y + 3);
        ctx.stroke();
      }

      // Draw primary boundary & obstacle walls
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 5;
      for (const wall of walls) {
        ctx.beginPath();
        ctx.moveTo(wall.a.x, wall.a.y);
        ctx.lineTo(wall.b.x, wall.b.y);
        ctx.stroke();
      }

      // Draw cup & flag
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hole.cup.x, hole.cup.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(hole.cup.x, hole.cup.y, 8.5, 0, Math.PI * 2);
      ctx.fill();

      // Flag pole & waving flag
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(hole.cup.x, hole.cup.y);
      ctx.lineTo(hole.cup.x, hole.cup.y - 28);
      ctx.stroke();

      // Waving Flag Triangle
      ctx.fillStyle = "#ff5d5d";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hole.cup.x, hole.cup.y - 28);
      ctx.lineTo(hole.cup.x + 18, hole.cup.y - 20);
      ctx.lineTo(hole.cup.x, hole.cup.y - 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Draw golf ball shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.beginPath();
      ctx.arc(ballPos.x + 2, ballPos.y + 2, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Draw golf ball
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(ballPos.x, ballPos.y, BALL_RADIUS + 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Ball specular highlight
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.arc(ballPos.x - 2, ballPos.y - 2, 2, 0, Math.PI * 2);
      ctx.fill();

      // Draw aim arrow & power vector overlay
      if (aimAngle !== null) {
        const lineLen = 30 + aimPower * 110;
        const endX = ballPos.x + Math.cos(aimAngle) * lineLen;
        const endY = ballPos.y + Math.sin(aimAngle) * lineLen;

        // Dotted trajectory line
        ctx.strokeStyle = "#ffc53d";
        ctx.lineWidth = 3.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(ballPos.x, ballPos.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Landing power ring & crosshair
        ctx.strokeStyle = "#ffc53d";
        ctx.fillStyle = "rgba(255, 197, 61, 0.35)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(endX, endY, 6 + aimPower * 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ffc53d";
        ctx.beginPath();
        ctx.arc(endX, endY, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    [hole, aimAngle, aimPower]
  );

  const lastAnimatedFramesRef = React.useRef<Vec2[] | null>(null);

  // Resize handling & initial draw
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_SIZE * dpr;
    canvas.height = CANVAS_SIZE * dpr;

    ctx.scale(dpr, dpr);

    const posToDraw =
      shotFrames && shotFrames.length > 0
        ? shotFrames[currentFrameIndex] ?? ball.pos
        : ball.pos;

    draw(ctx, posToDraw);
  }, [draw, ball.pos, shotFrames, currentFrameIndex]);

  // Animation handling
  React.useEffect(() => {
    if (!shotFrames || shotFrames.length === 0) {
      setCurrentFrameIndex(0);
      lastAnimatedFramesRef.current = null;
      return;
    }

    if (lastAnimatedFramesRef.current === shotFrames) {
      return;
    }

    lastAnimatedFramesRef.current = shotFrames;

    if (isReducedMotion.current) {
      setCurrentFrameIndex(shotFrames.length - 1);
      if (onAnimationComplete) {
        onAnimationComplete();
      }
      return;
    }

    let frame = 0;
    const animate = () => {
      frame++;
      if (frame < shotFrames.length) {
        setCurrentFrameIndex(frame);
        animationRef.current = requestAnimationFrame(animate);
      } else {
        if (onAnimationComplete) {
          onAnimationComplete();
        }
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [shotFrames, onAnimationComplete]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: "100%",
        aspectRatio: "1 / 1",
        position: "relative",
      }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Mini golf course"
        style={{
          width: "100%",
          height: "100%",
          display: "block",
        }}
      />
    </div>
  );
}

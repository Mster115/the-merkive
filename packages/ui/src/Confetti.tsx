"use client";
import * as React from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vrot: number;
  color: string;
  shape: 0 | 1 | 2;
  wobble: number;
}

const COLORS = ["#ff3d8a", "#2bd9ff", "#ffc53d", "#3ddc82", "#8b5cf6", "#ffffff"];

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Fire-and-forget canvas confetti. Mount it to celebrate; it bursts once,
 * rains for `durationMs`, then removes its canvas. Key it to re-fire.
 */
export function ConfettiBurst({
  count = 160,
  durationMs = 3800,
  origin = 0.35,
}: {
  count?: number;
  durationMs?: number;
  /** Vertical origin of the burst, 0 = top, 1 = bottom. */
  origin?: number;
}) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    if (reducedMotion()) {
      setDone(true);
      return;
    }
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    const W = () => canvas.width;
    const H = () => canvas.height;
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (5 + Math.random() * 13) * dpr;
      particles.push({
        x: W() * (0.5 + (Math.random() - 0.5) * 0.25),
        y: H() * origin,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 7 * dpr,
        w: (6 + Math.random() * 7) * dpr,
        h: (8 + Math.random() * 10) * dpr,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 0.3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
        shape: (Math.floor(Math.random() * 3) as 0 | 1 | 2),
        wobble: Math.random() * Math.PI * 2,
      });
    }

    const gravity = 0.32 * dpr;
    const drag = 0.985;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, W(), H());
      const fade = Math.max(0, 1 - Math.max(0, elapsed - durationMs * 0.6) / (durationMs * 0.4));
      ctx.globalAlpha = fade;
      for (const p of particles) {
        p.vy += gravity;
        p.vx *= drag;
        p.vy *= drag;
        p.wobble += 0.12;
        p.x += p.vx + Math.sin(p.wobble) * 0.8 * dpr;
        p.y += p.vy;
        p.rot += p.vrot;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === 0) {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        } else if (p.shape === 1) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(0, -p.h / 2);
          ctx.lineTo(p.w / 2, p.h / 2);
          ctx.lineTo(-p.w / 2, p.h / 2);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
      if (elapsed < durationMs) {
        raf = requestAnimationFrame(tick);
      } else {
        setDone(true);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [count, durationMs, origin]);

  if (done) return null;
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="fixed inset-0 z-50 pointer-events-none w-full h-full"
    />
  );
}

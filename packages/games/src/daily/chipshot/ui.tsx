"use client";

import * as React from "react";
import type { DailyPlayProps } from "../types";
import type { ChipShotPublicState } from "./types";
import { Button, Card, Pill, buzz } from "@merky/ui";
import { CourseCanvas } from "./CourseCanvas";

export function ChipShotPlay(props: DailyPlayProps) {
  const pub = props.publicState as ChipShotPublicState;
  const { act, t } = props;

  const [aim, setAim] = React.useState<number>(0);
  const [power, setPower] = React.useState<number>(50);
  const [pending, setPending] = React.useState<boolean>(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isAnimating, setIsAnimating] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (
      pub.lastShot &&
      pub.lastShot.frames &&
      pub.lastShot.frames.length > 0 &&
      pub.phase !== "aiming"
    ) {
      setIsAnimating(true);
    } else {
      setIsAnimating(false);
    }
  }, [pub.lastShot, pub.phase]);

  const handleShoot = async () => {
    buzz(10);
    setPending(true);
    setErrorMsg(null);
    const angle = aim / 100;
    const powerVal = power / 100;
    const res = await act("shoot", { angle, power: powerVal });
    setPending(false);
    if (!res.ok) {
      setErrorMsg(res.error);
      buzz([30, 40, 30]);
    }
  };

  const handleNextHole = async () => {
    setPending(true);
    setErrorMsg(null);
    const res = await act("next_hole");
    setPending(false);
    if (!res.ok) {
      setErrorMsg(res.error);
      buzz([30, 40, 30]);
    }
  };

  const handleReset = async () => {
    setPending(true);
    setErrorMsg(null);
    const res = await act("reset_after_penalty");
    setPending(false);
    if (!res.ok) {
      setErrorMsg(res.error);
      buzz([30, 40, 30]);
    }
  };

  // Aim adjustment helpers (angle stored as radians * 100 in [0, 628])
  const adjustAim = (deltaDegrees: number) => {
    buzz(5);
    const deltaRad = (deltaDegrees * Math.PI) / 180;
    const currentRad = aim / 100;
    let nextRad = (currentRad + deltaRad) % (Math.PI * 2);
    if (nextRad < 0) nextRad += Math.PI * 2;
    setAim(Math.round(nextRad * 100));
  };

  const setAimDegrees = (targetDegrees: number) => {
    buzz(5);
    let rad = (targetDegrees * Math.PI) / 180;
    if (rad < 0) rad += Math.PI * 2;
    setAim(Math.round((rad % (Math.PI * 2)) * 100));
  };

  const aimRad = aim / 100;
  const aimDeg = Math.round((aimRad * 180) / Math.PI);
  const getAimCompassSymbol = (deg: number) => {
    if (deg >= 337.5 || deg < 22.5) return "➡️ RIGHT";
    if (deg >= 22.5 && deg < 67.5) return "↘ DOWN-RIGHT";
    if (deg >= 67.5 && deg < 112.5) return "⬇ DOWN";
    if (deg >= 112.5 && deg < 157.5) return "↙ DOWN-LEFT";
    if (deg >= 157.5 && deg < 202.5) return "⬅ LEFT";
    if (deg >= 202.5 && deg < 247.5) return "↖ UP-LEFT";
    if (deg >= 247.5 && deg < 292.5) return "⬆ UP";
    return "↗ UP-RIGHT";
  };

  // Power adjustment helpers (stored as percentage in [10, 100])
  const adjustPower = (delta: number) => {
    buzz(5);
    setPower((prev) => Math.max(10, Math.min(100, prev + delta)));
  };

  const setPowerPercent = (pct: number) => {
    buzz(5);
    setPower(Math.max(10, Math.min(100, pct)));
  };

  let buttonText = "";
  let onButtonClick: (() => void) | undefined = undefined;
  let isButtonDisabled = pending || isAnimating;

  if (pub.phase === "aiming") {
    buttonText = t("daily.chipshot.shoot");
    onButtonClick = handleShoot;
  } else if (pub.phase === "scored") {
    buttonText = t("daily.chipshot.next_hole");
    onButtonClick = handleNextHole;
  } else if (pub.phase === "penalty") {
    buttonText = t("daily.chipshot.reset");
    onButtonClick = handleReset;
  } else if (pub.phase === "done") {
    buttonText = t("daily.chipshot.round_complete");
    isButtonDisabled = true;
  } else {
    buttonText = "...";
    isButtonDisabled = true;
  }

  const currentHole = pub.holes[pub.holeIndex] ?? pub.holes[0];
  const holeNumber = (pub.holeIndex ?? 0) + 1;
  const totalHoles = pub.holes.length;
  const currentPar = pub.pars[pub.holeIndex] ?? 3;
  const currentStrokes = pub.currentHoleStrokes;

  let feedbackMsg: string | null = null;
  let feedbackClasses = "";
  if (pub.phase === "penalty") {
    feedbackMsg = t("daily.chipshot.water_hazard");
    feedbackClasses = "bg-[var(--mb-danger)] text-[var(--mb-on-danger)]";
  } else if (pub.phase === "scored" && pub.lastShot) {
    if (pub.lastShot.outcome === "scored") {
      feedbackMsg =
        currentStrokes === 1
          ? t("daily.chipshot.hole_in_one")
          : t("daily.chipshot.nice_shot");
      feedbackClasses = "bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)]";
    } else {
      feedbackMsg = t("daily.chipshot.max_strokes");
      feedbackClasses = "bg-[var(--mb-gold)] text-[var(--mb-on-gold)]";
    }
  }

  if (!currentHole) {
    return <div className="text-[var(--mb-text)] font-bold p-4">No course data available.</div>;
  }

  return (
    <div className="flex flex-col w-full gap-4 select-none">
      {/* Accessibility live region for phase announcements */}
      <div className="sr-only" aria-live="polite">
        {t(`daily.chipshot.phase_${pub.phase}`)}
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="p-3.5 bg-[var(--mb-danger)] text-[var(--mb-on-danger)] border-[3px] border-black rounded-xl font-black shadow-[var(--mb-shadow)] uppercase tracking-wide [font-family:var(--mb-font-display)] text-center animate-shake"
        >
          {errorMsg}
        </div>
      )}

      {feedbackMsg && (
        <div
          className={`p-3.5 border-[3px] border-black rounded-xl font-black uppercase tracking-wide [font-family:var(--mb-font-display)] text-center shadow-[var(--mb-shadow)] ${feedbackClasses}`}
        >
          {feedbackMsg}
        </div>
      )}

      <Card className="flex flex-col border-[3px] border-black shadow-[var(--mb-shadow-lg)] rounded-2xl bg-[var(--mb-surface-2)] overflow-hidden p-0 gap-0">
        {/* Header row */}
        <div className="flex justify-between items-center bg-[var(--mb-surface-3)] p-3.5 border-b-[3px] border-black">
          <Pill tone="neutral" className="border-2 border-black font-black uppercase text-xs">
            {t("daily.chipshot.hole_of", { current: String(holeNumber), total: String(totalHoles) })}
          </Pill>
          <Pill tone="gold" className="border-2 border-black font-black uppercase text-xs">
            {t("daily.chipshot.par", { par: String(currentPar) })}
          </Pill>
          <Pill tone="accent" className="border-2 border-black font-black uppercase text-xs">
            {t("daily.chipshot.strokes", { n: String(currentStrokes) })}
          </Pill>
        </div>

        {/* Canvas area */}
        <div className="relative w-full aspect-square bg-[#131b2e] border-b-[3px] border-black">
          <CourseCanvas
            hole={currentHole}
            ball={pub.ball}
            aimAngle={aim / 100}
            aimPower={power / 100}
            shotFrames={pub.lastShot?.frames ?? null}
            onAnimationComplete={() => setIsAnimating(false)}
          />
        </div>

        {/* Controls Panel */}
        <div className="p-4 flex flex-col gap-4 bg-[var(--mb-surface-2)]">
          {/* Aim Control Section */}
          <div className="p-3 bg-[var(--mb-surface-3)] rounded-xl border-2 border-black flex flex-col gap-2.5 shadow-[2px_2px_0_0_#000]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black uppercase text-[var(--mb-text-dim)] tracking-wider [font-family:var(--mb-font-display)] flex items-center gap-1.5">
                🎯 {t("daily.chipshot.aim")}
              </span>
              <span className="text-xs font-black uppercase text-[var(--mb-gold)] tracking-wider [font-family:var(--mb-font-display)] bg-black/40 px-2.5 py-1 rounded-md border border-black">
                {aimDeg}° ({getAimCompassSymbol(aimDeg)})
              </span>
            </div>

            {/* Quick Direction Presets */}
            <div className="grid grid-cols-4 gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                disabled={isButtonDisabled || pub.phase !== "aiming"}
                onClick={() => setAimDegrees(270)}
                className="text-[11px] font-black uppercase py-2 min-h-[40px]"
              >
                ⬆ UP
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={isButtonDisabled || pub.phase !== "aiming"}
                onClick={() => setAimDegrees(90)}
                className="text-[11px] font-black uppercase py-2 min-h-[40px]"
              >
                ⬇ DOWN
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={isButtonDisabled || pub.phase !== "aiming"}
                onClick={() => setAimDegrees(180)}
                className="text-[11px] font-black uppercase py-2 min-h-[40px]"
              >
                ⬅ LEFT
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={isButtonDisabled || pub.phase !== "aiming"}
                onClick={() => setAimDegrees(0)}
                className="text-[11px] font-black uppercase py-2 min-h-[40px]"
              >
                ➡️ RIGHT
              </Button>
            </div>

            {/* Fine Nudge Steppers */}
            <div className="grid grid-cols-4 gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                disabled={isButtonDisabled || pub.phase !== "aiming"}
                onClick={() => adjustAim(-15)}
                className="text-[11px] font-black py-1.5 min-h-[36px]"
              >
                ◀◀ -15°
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={isButtonDisabled || pub.phase !== "aiming"}
                onClick={() => adjustAim(-5)}
                className="text-[11px] font-black py-1.5 min-h-[36px]"
              >
                ◀ -5°
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={isButtonDisabled || pub.phase !== "aiming"}
                onClick={() => adjustAim(5)}
                className="text-[11px] font-black py-1.5 min-h-[36px]"
              >
                +5° ▶
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={isButtonDisabled || pub.phase !== "aiming"}
                onClick={() => adjustAim(15)}
                className="text-[11px] font-black py-1.5 min-h-[36px]"
              >
                +15° ▶▶
              </Button>
            </div>
          </div>

          {/* Power Control Section */}
          <div className="p-3 bg-[var(--mb-surface-3)] rounded-xl border-2 border-black flex flex-col gap-2.5 shadow-[2px_2px_0_0_#000]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black uppercase text-[var(--mb-text-dim)] tracking-wider [font-family:var(--mb-font-display)] flex items-center gap-1.5">
                ⚡ {t("daily.chipshot.power")}
              </span>
              <span className="text-xs font-black uppercase text-[var(--mb-accent-2)] tracking-wider [font-family:var(--mb-font-display)] bg-black/40 px-2.5 py-1 rounded-md border border-black">
                {power}% {power <= 35 ? "(SOFT)" : power <= 70 ? "(MED)" : "(MAX)"}
              </span>
            </div>

            {/* Visual Segmented Power Bar Gauge */}
            <div className="w-full h-4 bg-black/60 rounded-lg border-2 border-black p-0.5 flex gap-1 items-center">
              {Array.from({ length: 10 }).map((_, i) => {
                const segPct = (i + 1) * 10;
                const active = power >= segPct;
                const colorClass =
                  i < 4
                    ? "bg-[var(--mb-accent-2)]"
                    : i < 7
                    ? "bg-[var(--mb-gold)]"
                    : "bg-[var(--mb-danger)]";

                return (
                  <div
                    key={i}
                    className={`flex-1 h-full rounded-xs transition-all border border-black/40 ${
                      active ? `${colorClass} shadow-[1px_1px_0_0_#000]` : "bg-black/30 opacity-20"
                    }`}
                  />
                );
              })}
            </div>

            {/* Power Presets */}
            <div className="grid grid-cols-4 gap-1.5">
              <Button
                size="sm"
                variant={power === 25 ? "primary" : "ghost"}
                disabled={isButtonDisabled || pub.phase !== "aiming"}
                onClick={() => setPowerPercent(25)}
                className="text-[11px] font-black uppercase py-2 min-h-[40px]"
              >
                25%
              </Button>
              <Button
                size="sm"
                variant={power === 50 ? "primary" : "ghost"}
                disabled={isButtonDisabled || pub.phase !== "aiming"}
                onClick={() => setPowerPercent(50)}
                className="text-[11px] font-black uppercase py-2 min-h-[40px]"
              >
                50%
              </Button>
              <Button
                size="sm"
                variant={power === 75 ? "primary" : "ghost"}
                disabled={isButtonDisabled || pub.phase !== "aiming"}
                onClick={() => setPowerPercent(75)}
                className="text-[11px] font-black uppercase py-2 min-h-[40px]"
              >
                75%
              </Button>
              <Button
                size="sm"
                variant={power === 100 ? "primary" : "ghost"}
                disabled={isButtonDisabled || pub.phase !== "aiming"}
                onClick={() => setPowerPercent(100)}
                className="text-[11px] font-black uppercase py-2 min-h-[40px]"
              >
                100%
              </Button>
            </div>

            {/* Power Steppers */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={isButtonDisabled || pub.phase !== "aiming" || power <= 10}
                onClick={() => adjustPower(-10)}
                className="text-[11px] font-black py-1.5 min-h-[36px]"
              >
                − 10% POWER
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={isButtonDisabled || pub.phase !== "aiming" || power >= 100}
                onClick={() => adjustPower(10)}
                className="text-[11px] font-black py-1.5 min-h-[36px]"
              >
                + 10% POWER
              </Button>
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            block
            disabled={isButtonDisabled}
            onClick={onButtonClick}
            className="border-[3px] border-black shadow-[var(--mb-shadow)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-black uppercase active:translate-y-[4px] active:translate-x-[4px] active:shadow-none min-h-[52px] text-base [font-family:var(--mb-font-display)]"
          >
            {buttonText}
          </Button>
        </div>
      </Card>

      {/* Score emoji row */}
      {pub.strokes && pub.strokes.length > 0 && (
        <Card className="p-3 border-[3px] border-black shadow-[var(--mb-shadow)] rounded-xl bg-[var(--mb-surface-2)] mt-1">
          <div className="flex gap-2 justify-center flex-wrap" aria-label="Hole scores">
            {pub.strokes.map((strokeCount: number, idx: number) => {
              const par = pub.pars[idx] ?? 3;
              const emoji = strokeCount <= par - 1 ? "⛳" : strokeCount === par ? "🏌️" : "🔴";
              return (
                <span key={idx} role="img" aria-label={`Hole ${idx + 1}: ${strokeCount} strokes`} className="text-2xl">
                  {emoji}
                </span>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

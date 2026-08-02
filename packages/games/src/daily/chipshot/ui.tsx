"use client";

import * as React from "react";
import type { DailyPlayProps } from "../types";
import type { ChipShotPublicState } from "./types";
import {
  Button,
  Card,
  Pill,
  buzz,
  TargetIcon,
  LightningIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  GolfFlagIcon,
  GolfBallIcon,
  CloseIcon,
} from "@merky/ui";
import { CourseCanvas } from "./CourseCanvas";

export function ChipShotPlay(props: DailyPlayProps) {
  const pub = props.publicState as ChipShotPublicState;
  const { act, t } = props;

  const [aim, setAim] = React.useState<number>(0);
  const [power, setPower] = React.useState<number>(50);
  const [pending, setPending] = React.useState<boolean>(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isAnimating, setIsAnimating] = React.useState<boolean>(false);
  const lastShotRef = React.useRef(pub.lastShot);

  React.useEffect(() => {
    if (pub.lastShot && pub.lastShot !== lastShotRef.current) {
      lastShotRef.current = pub.lastShot;
      setIsAnimating(true);
    }
  }, [pub.lastShot]);

  const handleAnimationComplete = React.useCallback(() => {
    setIsAnimating(false);
  }, []);

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

  const aimRad = aim / 100;
  const aimDeg = Math.round((aimRad * 180) / Math.PI);
  const getAimCompassName = (deg: number) => {
    if (deg >= 337.5 || deg < 22.5) return "RIGHT";
    if (deg >= 22.5 && deg < 67.5) return "DOWN-RIGHT";
    if (deg >= 67.5 && deg < 112.5) return "DOWN";
    if (deg >= 112.5 && deg < 157.5) return "DOWN-LEFT";
    if (deg >= 157.5 && deg < 202.5) return "LEFT";
    if (deg >= 202.5 && deg < 247.5) return "UP-LEFT";
    if (deg >= 247.5 && deg < 292.5) return "UP";
    return "UP-RIGHT";
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

  if (isAnimating) {
    buttonText = "ROLLING...";
    isButtonDisabled = true;
  } else if (pub.phase === "aiming") {
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

  // Only reveal outcome feedback banner AFTER animation finishes
  if (!isAnimating) {
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
  }

  if (!currentHole) {
    return <div className="text-[var(--mb-text)] font-bold p-4">No course data available.</div>;
  }

  return (
    <div className="flex flex-col w-full gap-3.5 select-none">
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

      {/* Standalone Header Info Bar */}
      <div className="flex justify-between items-center bg-[var(--mb-surface-2)] p-3 border-[3px] border-black shadow-[var(--mb-shadow)] rounded-xl">
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

      {/* Standalone Canvas Card */}
      <Card className="relative w-full aspect-square bg-[#131b2e] border-[3px] border-black shadow-[var(--mb-shadow-lg)] rounded-2xl overflow-hidden p-0">
        <CourseCanvas
          hole={currentHole}
          ball={pub.ball}
          aimAngle={aim / 100}
          aimPower={power / 100}
          shotFrames={pub.lastShot?.frames ?? null}
          onAnimationComplete={handleAnimationComplete}
        />
      </Card>

      {/* Standalone Feedback Alert (shown post-animation only) */}
      {feedbackMsg && (
        <div
          className={`p-3.5 border-[3px] border-black rounded-xl font-black uppercase tracking-wide [font-family:var(--mb-font-display)] text-center shadow-[var(--mb-shadow)] ${feedbackClasses}`}
        >
          {feedbackMsg}
        </div>
      )}

      {/* Standalone Aim Control Plate */}
      <Card className="p-3.5 bg-[var(--mb-surface-2)] rounded-xl border-[3px] border-black shadow-[var(--mb-shadow)] flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-black uppercase text-[var(--mb-text-dim)] tracking-wider [font-family:var(--mb-font-display)] flex items-center gap-1.5">
            <TargetIcon className="w-4 h-4 text-[var(--mb-gold)]" />
            {t("daily.chipshot.aim")}
          </span>
          <span className="text-xs font-black uppercase text-[var(--mb-gold)] tracking-wider [font-family:var(--mb-font-display)] bg-black/40 px-2.5 py-1 rounded-md border border-black">
            {aimDeg}° ({getAimCompassName(aimDeg)})
          </span>
        </div>

        {/* Streamlined Stepper Nudges */}
        <div className="grid grid-cols-4 gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            disabled={isButtonDisabled || pub.phase !== "aiming"}
            onClick={() => adjustAim(-15)}
            className="text-[11px] font-black py-1.5 min-h-[38px] flex items-center justify-center gap-1"
          >
            <ChevronDoubleLeftIcon className="w-3.5 h-3.5" /> -15°
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={isButtonDisabled || pub.phase !== "aiming"}
            onClick={() => adjustAim(-5)}
            className="text-[11px] font-black py-1.5 min-h-[38px] flex items-center justify-center gap-1"
          >
            <ChevronLeftIcon className="w-3.5 h-3.5" /> -5°
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={isButtonDisabled || pub.phase !== "aiming"}
            onClick={() => adjustAim(5)}
            className="text-[11px] font-black py-1.5 min-h-[38px] flex items-center justify-center gap-1"
          >
            +5° <ChevronRightIcon className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={isButtonDisabled || pub.phase !== "aiming"}
            onClick={() => adjustAim(15)}
            className="text-[11px] font-black py-1.5 min-h-[38px] flex items-center justify-center gap-1"
          >
            +15° <ChevronDoubleRightIcon className="w-3.5 h-3.5" />
          </Button>
        </div>
      </Card>

      {/* Standalone Power Control Plate */}
      <Card className="p-3.5 bg-[var(--mb-surface-2)] rounded-xl border-[3px] border-black shadow-[var(--mb-shadow)] flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-black uppercase text-[var(--mb-text-dim)] tracking-wider [font-family:var(--mb-font-display)] flex items-center gap-1.5">
            <LightningIcon className="w-4 h-4 text-[var(--mb-accent-2)]" />
            {t("daily.chipshot.power")}
          </span>
          <span className="text-xs font-black uppercase text-[var(--mb-accent-2)] tracking-wider [font-family:var(--mb-font-display)] bg-black/40 px-2.5 py-1 rounded-md border border-black">
            {power}% {power <= 35 ? "(SOFT)" : power <= 70 ? "(MED)" : "(MAX)"}
          </span>
        </div>

        {/* Power Presets */}
        <div className="grid grid-cols-4 gap-1.5">
          <Button
            size="sm"
            variant={power === 25 ? "primary" : "ghost"}
            disabled={isButtonDisabled || pub.phase !== "aiming"}
            onClick={() => setPowerPercent(25)}
            className="text-[11px] font-black uppercase py-2 min-h-[38px]"
          >
            25%
          </Button>
          <Button
            size="sm"
            variant={power === 50 ? "primary" : "ghost"}
            disabled={isButtonDisabled || pub.phase !== "aiming"}
            onClick={() => setPowerPercent(50)}
            className="text-[11px] font-black uppercase py-2 min-h-[38px]"
          >
            50%
          </Button>
          <Button
            size="sm"
            variant={power === 75 ? "primary" : "ghost"}
            disabled={isButtonDisabled || pub.phase !== "aiming"}
            onClick={() => setPowerPercent(75)}
            className="text-[11px] font-black uppercase py-2 min-h-[38px]"
          >
            75%
          </Button>
          <Button
            size="sm"
            variant={power === 100 ? "primary" : "ghost"}
            disabled={isButtonDisabled || pub.phase !== "aiming"}
            onClick={() => setPowerPercent(100)}
            className="text-[11px] font-black uppercase py-2 min-h-[38px]"
          >
            100%
          </Button>
        </div>

        {/* Granular Mobile Power Steppers */}
        <div className="grid grid-cols-4 gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            disabled={isButtonDisabled || pub.phase !== "aiming" || power <= 10}
            onClick={() => adjustPower(-5)}
            className="text-[11px] font-black py-1.5 min-h-[38px] flex items-center justify-center gap-1"
          >
            <ChevronDoubleLeftIcon className="w-3.5 h-3.5" /> -5%
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={isButtonDisabled || pub.phase !== "aiming" || power <= 10}
            onClick={() => adjustPower(-1)}
            className="text-[11px] font-black py-1.5 min-h-[38px] flex items-center justify-center gap-1"
          >
            <ChevronLeftIcon className="w-3.5 h-3.5" /> -1%
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={isButtonDisabled || pub.phase !== "aiming" || power >= 100}
            onClick={() => adjustPower(1)}
            className="text-[11px] font-black py-1.5 min-h-[38px] flex items-center justify-center gap-1"
          >
            +1% <ChevronRightIcon className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={isButtonDisabled || pub.phase !== "aiming" || power >= 100}
            onClick={() => adjustPower(5)}
            className="text-[11px] font-black py-1.5 min-h-[38px] flex items-center justify-center gap-1"
          >
            +5% <ChevronDoubleRightIcon className="w-3.5 h-3.5" />
          </Button>
        </div>
      </Card>

      {/* Primary Action Button */}
      <Button
        variant="primary"
        size="lg"
        block
        disabled={isButtonDisabled}
        onClick={onButtonClick}
        className="border-[3px] border-black shadow-[var(--mb-shadow-lg)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-black uppercase active:translate-y-[4px] active:translate-x-[4px] active:shadow-none min-h-[54px] text-lg [font-family:var(--mb-font-display)]"
      >
        {buttonText}
      </Button>

      {/* Standalone Score History Card (No Emojis!) */}
      {pub.strokes && pub.strokes.length > 0 && (
        <Card className="p-3 border-[3px] border-black shadow-[var(--mb-shadow)] rounded-xl bg-[var(--mb-surface-2)] mt-1">
          <div className="flex gap-2 justify-center flex-wrap" aria-label="Hole scores">
            {pub.strokes.map((strokeCount: number, idx: number) => {
              const par = pub.pars[idx] ?? 3;
              const isUnderPar = strokeCount <= par - 1;
              const isPar = strokeCount === par;

              return (
                <div
                  key={idx}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-black shadow-[2px_2px_0_0_#000] font-black text-xs uppercase [font-family:var(--mb-font-display)] ${
                    isUnderPar
                      ? "bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)]"
                      : isPar
                      ? "bg-[var(--mb-gold)] text-[var(--mb-on-gold)]"
                      : "bg-[var(--mb-danger)] text-[var(--mb-on-danger)]"
                  }`}
                >
                  {isUnderPar ? (
                    <GolfFlagIcon className="w-4 h-4" />
                  ) : isPar ? (
                    <GolfBallIcon className="w-4 h-4" />
                  ) : (
                    <CloseIcon className="w-4 h-4" />
                  )}
                  <span>H{idx + 1}: {strokeCount}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

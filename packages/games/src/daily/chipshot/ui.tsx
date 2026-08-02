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

  // Visible feedback for the moment a shot just resolved — the sr-only phase
  // region below covers screen readers, this covers sighted players.
  let feedbackMsg: string | null = null;
  let feedbackClasses = "";
  if (pub.phase === "penalty") {
    feedbackMsg = t("daily.chipshot.water_hazard");
    feedbackClasses = "bg-blue-100 text-blue-900";
  } else if (pub.phase === "scored" && pub.lastShot) {
    if (pub.lastShot.outcome === "scored") {
      feedbackMsg =
        currentStrokes === 1
          ? t("daily.chipshot.hole_in_one")
          : t("daily.chipshot.nice_shot");
      feedbackClasses = "bg-green-100 text-green-900";
    } else {
      // Ball is still on the course — the hole ended because strokes ran out.
      feedbackMsg = t("daily.chipshot.max_strokes");
      feedbackClasses = "bg-amber-100 text-amber-900";
    }
  }

  if (!currentHole) {
    return <div>No course data available.</div>;
  }

  return (
    <div className="flex flex-col w-full gap-4">
      {/* Accessibility live region for phase announcements */}
      <div className="sr-only" aria-live="polite">
        {t(`daily.chipshot.phase_${pub.phase}`)}
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="p-3 bg-red-100 border-4 border-black rounded-none text-red-900 font-bold mb-4 shadow-[4px_4px_0_0_rgba(0,0,0,1)]"
        >
          {errorMsg}
        </div>
      )}

      {feedbackMsg && (
        <div
          className={`p-3 border-4 border-black rounded-none font-bold shadow-[4px_4px_0_0_rgba(0,0,0,1)] ${feedbackClasses}`}
        >
          {feedbackMsg}
        </div>
      )}

      <Card className="flex flex-col border-4 border-black shadow-[6px_6px_0_0_rgba(0,0,0,1)] rounded-none overflow-hidden">
        {/* Header row */}
        <div className="flex justify-between items-center bg-[var(--mb-muted,#f1f5f9)] p-3 border-b-4 border-black">
          <Pill className="border-2 border-black font-bold">
            {t("daily.chipshot.hole_of", { current: String(holeNumber), total: String(totalHoles) })}
          </Pill>
          <Pill className="border-2 border-black font-bold">
            {t("daily.chipshot.par", { par: String(currentPar) })}
          </Pill>
          <Pill className="border-2 border-black font-bold">
            {t("daily.chipshot.strokes", { n: String(currentStrokes) })}
          </Pill>
        </div>

        {/* Canvas area */}
        <div className="relative w-full aspect-square bg-[var(--mb-bg,white)] border-b-4 border-black">
          <CourseCanvas
            hole={currentHole}
            ball={pub.ball}
            aimAngle={aim / 100}
            aimPower={power / 100}
            shotFrames={pub.lastShot?.frames ?? null}
            onAnimationComplete={() => setIsAnimating(false)}
          />
        </div>

        {/* Controls */}
        <div className="p-4 flex flex-col gap-6 bg-[var(--mb-panel,white)]">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="aim-control"
              className="font-bold uppercase text-sm tracking-wide"
            >
              {t("daily.chipshot.aim")}
            </label>
            <input
              id="aim-control"
              type="range"
              min={0}
              max={628}
              value={aim}
              onChange={(e) => setAim(Number(e.target.value))}
              disabled={isButtonDisabled || pub.phase !== "aiming"}
              aria-label={t("daily.chipshot.aim")}
              className="w-full min-h-[44px] accent-black cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="power-control"
              className="font-bold uppercase text-sm tracking-wide"
            >
              {t("daily.chipshot.power")}
            </label>
            <input
              id="power-control"
              type="range"
              min={0}
              max={100}
              value={power}
              onChange={(e) => setPower(Number(e.target.value))}
              disabled={isButtonDisabled || pub.phase !== "aiming"}
              aria-label={t("daily.chipshot.power")}
              className="w-full min-h-[44px] cursor-pointer"
              style={{
                background: `linear-gradient(to right, #22c55e, #eab308, #ef4444)`,
              }}
            />
          </div>

          <Button
            variant="primary"
            size="lg"
            block
            disabled={isButtonDisabled}
            onClick={onButtonClick}
            className="border-4 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all font-bold uppercase active:translate-y-[6px] active:translate-x-[6px] active:shadow-none min-h-[56px]"
          >
            {buttonText}
          </Button>
        </div>
      </Card>

      {/* Score emoji row */}
      {pub.strokes && pub.strokes.length > 0 && (
        <Card className="p-3 border-4 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] rounded-none bg-[var(--mb-panel,white)] mt-2">
          <div className="flex gap-2 justify-center flex-wrap" aria-label="Hole scores">
            {pub.strokes.map((strokeCount: number, idx: number) => {
              const par = pub.pars[idx] ?? 3;
              const emoji = strokeCount <= par - 1 ? "⛳" : strokeCount === par ? "🏌️" : "🔴";
              return (
                <span key={idx} role="img" aria-label={`Hole ${idx + 1}: ${strokeCount} strokes`} className="text-3xl">
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

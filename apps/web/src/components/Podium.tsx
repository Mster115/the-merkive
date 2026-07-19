"use client";
import * as React from "react";
import type { RoomView } from "@merky/game-sdk";
import { Card, ConfettiBurst, ScoreBoard, sfx, TrophyIcon } from "@merky/ui";
import { useT } from "@/i18n";

export function PodiumCard({
  lastMatch,
  big,
}: {
  lastMatch: NonNullable<RoomView["lastMatch"]>;
  big?: boolean;
}) {
  const t = useT();
  const rows = lastMatch.seats.map((s) => ({
    seatIndex: s.seatIndex,
    displayName: s.displayName,
    avatarId: s.avatarId,
    points: lastMatch.scores[s.seatIndex] ?? 0,
  }));
  const winner = [...rows].sort((a, b) => b.points - a.points)[0];

  // One celebration per finished match, not per re-render.
  const [celebrate, setCelebrate] = React.useState(false);
  const celebratedRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (celebratedRef.current === lastMatch.endedAt) return;
    celebratedRef.current = lastMatch.endedAt;
    // Only make noise for a fresh result, not an old podium re-mounting.
    if (Date.now() - lastMatch.endedAt < 30_000) {
      setCelebrate(true);
      sfx.play("win");
    }
  }, [lastMatch.endedAt]);

  return (
    <Card raised glass className="relative overflow-hidden flex flex-col gap-3 mb-pop">
      {celebrate && <ConfettiBurst count={big ? 220 : 120} origin={big ? 0.3 : 0.45} />}
      <div
        aria-hidden
        className="absolute inset-x-0 -top-24 h-44 bg-[radial-gradient(ellipse_at_center,rgb(255_197_61/0.22),transparent_70%)] pointer-events-none"
      />
      <h2 className={big ? "text-3xl font-black text-center" : "text-lg font-black"}>
        {t("podium.title")}
      </h2>
      {winner && (
        <p
          className={
            big
              ? "flex items-center justify-center gap-3 text-center text-6xl font-black mb-neon-gold mb-tada [font-family:var(--mb-font-display)]"
              : "flex items-center justify-center gap-2 text-center text-2xl font-black mb-neon-gold [font-family:var(--mb-font-display)]"
          }
        >
          <TrophyIcon className={big ? "w-14 h-14 shrink-0" : "w-6 h-6 shrink-0"} />
          {t("podium.winner", { name: winner.displayName })}
        </p>
      )}
      <ScoreBoard rows={rows} compact={!big} animated pointsLabel={t("common.pts")} />
    </Card>
  );
}

"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getDailyGame } from "@merky/games/daily";
import { Button, Card } from "@merky/ui";
import { useT } from "@/i18n";
import { ensureDailyDevice } from "@/client/dailyDevice";
import { ShareCard } from "./ShareCard";
import { HistoryView } from "./HistoryView";
import { ArchiveList } from "./ArchiveList";
import { RecoveryPanel } from "./RecoveryPanel";

export interface DailyPlayShellProps {
  gameId: string;
  explicitDate?: string;
}

export function DailyPlayShell({ gameId, explicitDate }: DailyPlayShellProps) {
  const t = useT();
  const router = useRouter();

  const game = getDailyGame(gameId);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [puzzleDate, setPuzzleDate] = React.useState<string>("");
  const [publicState, setPublicState] = React.useState<unknown>(null);
  const [phase, setPhase] = React.useState<string>("");
  const [attemptOver, setAttemptOver] = React.useState(false);
  const [status, setStatus] = React.useState<string>("in_progress");
  const [shareText, setShareText] = React.useState<string | null>(null);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  const loadPuzzle = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await ensureDailyDevice();
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const url = explicitDate
        ? `/api/daily/${gameId}/${explicitDate}`
        : `/api/daily/${gameId}/today`;

      const res = await fetch(url, {
        headers: { "x-mb-tz": tz },
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? t("daily.play.not_found"));
        return;
      }

      const data = await res.json();
      setPuzzleDate(data.puzzleDate);
      setPublicState(data.publicState);
      setPhase(data.phase);
      setAttemptOver(Boolean(data.attemptOver));
      setStatus(data.status ?? "in_progress");
      setShareText(data.shareText ?? null);
    } catch {
      setError(t("error.internal"));
    } finally {
      setLoading(false);
    }
  }, [gameId, explicitDate, t]);

  React.useEffect(() => {
    void loadPuzzle();
  }, [loadPuzzle]);

  const act = React.useCallback(
    async (type: string, payload?: unknown) => {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const res = await fetch(`/api/daily/${gameId}/action`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-mb-tz": tz,
          },
          body: JSON.stringify({
            type,
            payload,
            puzzleDate,
          }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          return {
            ok: false as const,
            code: (json.code as string) ?? "action_failed",
            error: (json.error as string) ?? "Action failed",
          };
        }

        setPublicState(json.publicState);
        setPhase(json.phase);
        setAttemptOver(Boolean(json.attemptOver));
        if (json.status) setStatus(json.status);
        if (json.shareText) setShareText(json.shareText);

        return { ok: true as const };
      } catch (err) {
        return {
          ok: false as const,
          code: "network_error",
          error: err instanceof Error ? err.message : "Network error",
        };
      }
    },
    [gameId, puzzleDate]
  );

  if (!game) {
    return (
      <main className="mx-auto max-w-2xl min-h-dvh flex flex-col gap-6 p-4 sm:p-6">
        <Card raised className="p-8 text-center bg-[var(--mb-danger)] text-white">
          <h1 className="text-2xl font-black uppercase">{t("error.game_unknown")}</h1>
          <Button className="mt-4" onClick={() => router.push("/daily")}>
            {t("daily.back.hub")}
          </Button>
        </Card>
      </main>
    );
  }

  const PlayComponent = game.ui.Play;

  // No Ticker on this screen: the marquee is a lobby affordance that gives
  // context before you commit to a puzzle. Mid-game it competes with the board
  // and, being `fixed`, covers the bottom row of Nutshell's keyboard on short
  // viewports. Multiplayer already draws this line — StageApp renders the
  // Ticker in StageLobby only, never in the in-game Stage branch.
  return (
    <main className="mx-auto max-w-2xl min-h-dvh flex flex-col gap-6 p-4 sm:p-6 pb-10">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase text-[var(--mb-text)] [font-family:var(--mb-font-display)]">
            {t(game.meta.nameKey)}
          </h1>
          {puzzleDate && (
            <p className="text-xs font-bold text-[var(--mb-text-dim)]">
              {explicitDate
                ? t("daily.play.archive", { date: puzzleDate })
                : t("daily.play.today")}
            </p>
          )}
        </div>
        <Link href="/daily">
          <Button variant="secondary" size="sm">
            {t("daily.back.hub")}
          </Button>
        </Link>
      </header>

      {loading ? (
        <Card raised className="p-8 text-center text-lg font-bold">
          {t("daily.play.loading")}
        </Card>
      ) : error ? (
        <Card raised className="p-8 text-center bg-[var(--mb-surface-2)]">
          <p className="text-lg font-bold text-[var(--mb-danger)]">{error}</p>
          <Button className="mt-4" onClick={() => router.push("/daily")}>
            {t("daily.back.hub")}
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <PlayComponent
            meta={game.meta}
            puzzleDate={puzzleDate}
            publicState={publicState}
            phase={phase}
            act={act}
            t={t}
            now={now}
          />

          {(attemptOver || status === "solved" || status === "failed") && shareText && (
            <ShareCard shareText={shareText} gameId={gameId} />
          )}

          <HistoryView gameId={gameId} refreshKey={`${attemptOver}:${status}`} />
          <ArchiveList gameId={gameId} />
          {/* Reload so the streak panel, archive and ticker all re-read the
              history that now belongs to the adopted device. */}
          <RecoveryPanel onRestored={() => router.refresh()} />
        </div>
      )}
    </main>
  );
}

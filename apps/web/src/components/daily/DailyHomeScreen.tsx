"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, GameIcon, Pill } from "@merky/ui";
import { useT } from "@/i18n";
import { Ticker } from "@/components/Ticker";
import { buildTickerItems } from "./useDailyTicker";
import { useDailySummary, type SummaryGame } from "./useDailySummary";
import type { DailyGameMeta } from "@merky/games/daily/types";

/** How a card's call to action reads and looks, given today's progress. */
function ctaFor(status: SummaryGame["status"] | undefined) {
  switch (status) {
    case "solved":
    case "failed":
      // Distinct colour as well as distinct words: "Results" in the same violet
      // as "Play" still reads as an invitation to play again.
      return { key: "daily.hub.results", variant: "secondary" as const };
    case "in_progress":
      return { key: "daily.hub.continue", variant: "gold" as const };
    default:
      return { key: "daily.hub.play", variant: "primary" as const };
  }
}

export function DailyHomeScreen() {
  const t = useT();
  const router = useRouter();
  const [games, setGames] = React.useState<DailyGameMeta[]>([]);
  const [loading, setLoading] = React.useState(true);
  // One fetch for both the cards and the strip beneath them, so a card can
  // never offer "Play" for a game the ticker has already called finished.
  const { summary, elapsedMs } = useDailySummary();
  const tickerItems = buildTickerItems(summary, elapsedMs, undefined, t);
  const statusById = React.useMemo(
    () => new Map((summary?.games ?? []).map((g) => [g.id, g])),
    [summary]
  );

  React.useEffect(() => {
    let ignore = false;
    async function loadGames() {
      try {
        const res = await fetch("/api/daily/games");
        if (res.ok) {
          const json = await res.json();
          if (!ignore) setGames(json);
        }
      } catch {
        // ignore fetch error
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    void loadGames();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <main className="mx-auto max-w-md lg:max-w-4xl min-h-dvh flex flex-col gap-8 p-4 sm:p-6 lg:p-10 pb-24">
      <header className="flex items-start justify-between gap-3 sm:gap-4">
        {/* min-w-0 lets the three-word title absorb the squeeze; without it the
            title held its width and "Back to Home" broke across two lines
            beside it at 375px. See DESIGN.md §7b. */}
        <div className="min-w-0">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl [font-family:var(--mb-font-display)] font-black italic uppercase text-[var(--mb-violet)] leading-none">
            {t("daily.hub.title")}
          </h1>
          <p className="mt-2 text-sm font-bold text-[var(--mb-text-dim)]">
            {t("daily.hub.tagline")}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="sm:min-h-12 sm:px-5 sm:text-base"
          aria-label={t("daily.back.home")}
          onClick={() => router.push("/")}
        >
          <span className="sm:hidden">{t("daily.back.home.short")}</span>
          <span className="hidden sm:inline">{t("daily.back.home")}</span>
        </Button>
      </header>

      {loading ? (
        <Card raised className="p-8 text-center text-lg font-bold">
          {t("daily.play.loading")}
        </Card>
      ) : games.length === 0 ? (
        <Card raised className="flex flex-col gap-4 p-8 text-center bg-[var(--mb-surface-2)] border-3 border-black shadow-[6px_6px_0_0_#000]">
          <h2 className="text-2xl font-black uppercase text-[var(--mb-gold)]">
            {t("daily.hub.empty")}
          </h2>
          <p className="text-sm font-semibold text-[var(--mb-text-dim)]">
            {t("daily.hub.empty.body")}
          </p>
        </Card>
      ) : (
        // md, not sm: at 640px two columns leave ~330px per card, which is too
        // narrow for a long name to sit beside its icon.
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {games.map((g, i) => (
            <Card
              key={g.id}
              raised
              className={
                "flex flex-col justify-between gap-4 p-5 bg-[var(--mb-surface-2)] border-3 border-black shadow-[5px_5px_0_0_#000] " +
                (i % 2 === 0 ? "rotate-[0.5deg]" : "-rotate-[0.5deg]")
              }
            >
              <div>
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  {/* shrink-0: without it the flex row steals width from the
                      icon to fit a long title — "NUTSHELL" collapsed it to
                      under 2px on narrow viewports. */}
                  <GameIcon gameId={g.id} className="w-8 h-8 shrink-0 text-[var(--mb-violet)]" />
                  {/* min-w-0 lets the title shrink rather than overflow the
                      card; no break-words, which split "NUTSHELL" mid-word. */}
                  <h2 className="min-w-0 text-2xl font-black uppercase text-[var(--mb-text)] [font-family:var(--mb-font-display)]">
                    {t(g.nameKey)}
                  </h2>
                  {/* State at a glance, before you get as far as the button. */}
                  {statusById.get(g.id)?.status === "solved" && (
                    <Pill tone="ok" className="whitespace-nowrap">{t("daily.hub.status.solved")}</Pill>
                  )}
                  {statusById.get(g.id)?.status === "failed" && (
                    <Pill tone="neutral" className="whitespace-nowrap">{t("daily.hub.status.done")}</Pill>
                  )}
                  {statusById.get(g.id)?.status === "in_progress" && (
                    <Pill tone="gold" className="whitespace-nowrap">{t("daily.hub.status.inProgress")}</Pill>
                  )}
                </div>
                <p className="text-sm font-semibold text-[var(--mb-text-dim)] leading-relaxed">
                  {t(g.descriptionKey)}
                </p>
              </div>

              <Link
                href={`/daily/${g.id}`}
                aria-label={t(`${ctaFor(statusById.get(g.id)?.status).key}.aria`, {
                  game: t(g.nameKey),
                })}
              >
                <Button size="lg" block variant={ctaFor(statusById.get(g.id)?.status).variant}>
                  {t(ctaFor(statusById.get(g.id)?.status).key)}
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      )}
      <Ticker className="fixed bottom-0 inset-x-0 z-40" items={tickerItems} />
    </main>
  );
}

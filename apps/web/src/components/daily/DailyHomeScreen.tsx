"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, GameIcon } from "@merky/ui";
import { useT } from "@/i18n";
import type { DailyGameMeta } from "@merky/games/daily/types";

export function DailyHomeScreen() {
  const t = useT();
  const router = useRouter();
  const [games, setGames] = React.useState<DailyGameMeta[]>([]);
  const [loading, setLoading] = React.useState(true);

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
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-5xl [font-family:var(--mb-font-display)] font-black italic uppercase text-[var(--mb-violet)] leading-none">
            {t("daily.hub.title")}
          </h1>
          <p className="mt-2 text-sm font-bold text-[var(--mb-text-dim)]">
            {t("daily.hub.tagline")}
          </p>
        </div>
        <Button variant="secondary" onClick={() => router.push("/")}>
          {t("daily.back.home")}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                <div className="flex items-center gap-3 mb-2">
                  <GameIcon gameId={g.id} className="w-8 h-8 text-[var(--mb-violet)]" />
                  <h2 className="text-2xl font-black uppercase text-[var(--mb-text)] [font-family:var(--mb-font-display)]">
                    {t(g.nameKey)}
                  </h2>
                </div>
                <p className="text-sm font-semibold text-[var(--mb-text-dim)] leading-relaxed">
                  {t(g.descriptionKey)}
                </p>
              </div>

              <Link href={`/daily/${g.id}`} aria-label={t("daily.hub.play.aria", { game: t(g.nameKey) })}>
                <Button size="lg" block variant="primary">
                  {t("daily.hub.play")}
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}

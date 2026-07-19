"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { contentPacks, gameRegistry } from "@merky/games";
import { Button, Card, Pill } from "@merky/ui";
import { useT } from "@/i18n";
import { api, ApiCallError } from "@/client/api";
import { getPrefs, setPrefs, setToken } from "@/client/session";
import { AvatarPicker } from "./AvatarPicker";
import { Ticker } from "./Ticker";

export function HomeScreen() {
  const t = useT();
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [avatarId, setAvatarId] = React.useState("fox");
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const prefs = getPrefs();
    if (prefs.name) setName(prefs.name);
    setAvatarId(prefs.avatarId);
  }, []);

  const ready = name.trim().length > 0;

  async function handleCreate() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    setPrefs(name.trim(), avatarId);
    try {
      const res = await api.createRoom(name.trim(), avatarId);
      setToken(res.code, res.token);
      router.push(`/play/${res.code}`);
    } catch (err) {
      setError(err instanceof ApiCallError ? `error.${err.code}` : "error.internal");
      setBusy(false);
    }
  }

  async function handleJoin(role: "player" | "spectator") {
    const cleaned = code.trim().toUpperCase();
    if (!ready || cleaned.length !== 4 || busy) return;
    setBusy(true);
    setError(null);
    setPrefs(name.trim(), avatarId);
    try {
      const res = await api.join(cleaned, { name: name.trim(), avatarId, role }, null);
      setToken(cleaned, res.token);
      router.push(`/play/${cleaned}`);
    } catch (err) {
      setError(err instanceof ApiCallError ? `error.${err.code}` : "error.internal");
      setBusy(false);
    }
  }

  const activePack = contentPacks.find((p) => !p.isComingSoon) ?? contentPacks[0];
  const comingSoonPacks = contentPacks.filter((p) => p.isComingSoon);

  return (
    <>
      <main className="mx-auto max-w-md lg:max-w-7xl min-h-dvh flex flex-col justify-between gap-8 p-4 sm:p-6 lg:p-10 pb-24 mb-stagger">
        {/* Widescreen / Desktop Hero Header */}
        <header className="flex flex-col lg:flex-row items-center justify-between gap-6 mb-drop text-center lg:text-left border-b-2 border-black/40 pb-6" style={{ "--mb-i": 0 } as React.CSSProperties}>
          <div>
            <div className="relative inline-block">
              <div aria-hidden className="absolute -inset-3 bg-[var(--mb-pink)] opacity-20 blur-2xl -z-10" />
              <h1 className="mb-wobble-fast text-5xl sm:text-6xl lg:text-7xl [font-family:var(--mb-font-display)] font-black italic uppercase tracking-tighter text-[var(--mb-violet)] leading-none">
                {t("app.name")}
              </h1>
            </div>
            <p className="mt-3 block lg:inline-block bg-black px-4 py-1.5 rotate-1 lg:-rotate-1 border-2 border-[var(--mb-accent-2)] text-[var(--mb-accent-2)] font-black uppercase tracking-widest text-xs sm:text-sm">
              {t("app.tagline")}
            </p>
          </div>

          {/* Quick Stats / TV Launcher banner on wide viewports */}
          <div className="hidden lg:flex items-center gap-3 bg-[var(--mb-surface-2)] border-3 border-black shadow-[4px_4px_0_0_#000] p-3 rounded-lg -rotate-1">
            <div className="flex flex-col text-right">
              <span className="text-xs font-black uppercase text-[var(--mb-accent-2)] tracking-wider">
                Party Mode Live
              </span>
              <span className="text-xs font-bold text-[var(--mb-text-dim)]">
                Dynamic Phone & TV Experience
              </span>
            </div>
            <div className="h-8 w-[2px] bg-black" />
            <span className="px-3 py-1.5 bg-[var(--mb-accent)] text-[var(--mb-on-accent)] font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0_0_#000]">
              Multi-Device Ready
            </span>
          </div>
        </header>

        {/* Responsive Grid layout: Left = Controls, Right = Content Packs */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: Player profile & room controls */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <Card
              raised
              className="flex flex-col gap-4 mb-rise -rotate-[0.6deg]"
              style={{ "--mb-i": 1 } as React.CSSProperties}
            >
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-black uppercase tracking-widest text-[var(--mb-violet)] flex justify-between items-center">
                  <span>{t("home.name.label")}</span>
                  <span className="text-[10px] opacity-60 text-[var(--mb-text-dim)] font-normal uppercase tracking-normal">
                    Used across all games
                  </span>
                </span>
                <span className="relative">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("home.name.placeholder")}
                    maxLength={16}
                    autoComplete="nickname"
                    suppressHydrationWarning
                    className="w-full min-h-13 rounded-md bg-white text-black border-[3px] border-black px-4 text-lg font-extrabold placeholder:text-neutral-400 outline-none focus:border-[var(--mb-accent)] shadow-[var(--mb-shadow)] transition-all"
                  />
                  {!ready && (
                    <span
                      aria-hidden
                      className="absolute -top-2.5 -right-2 rotate-6 bg-[var(--mb-danger)] text-[var(--mb-on-danger)] border-2 border-black px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
                    >
                      {t("home.name.required")}
                    </span>
                  )}
                </span>
              </label>
              <AvatarPicker value={avatarId} onChange={setAvatarId} label={t("home.avatar.label")} />
            </Card>

            <Card
              raised
              className="flex flex-col gap-3 mb-rise rotate-[0.5deg]"
              style={{ "--mb-i": 2 } as React.CSSProperties}
            >
              <h2 className="self-start -rotate-1 bg-[var(--mb-pink)] text-[var(--mb-on-pink)] border-2 border-black shadow-[2px_2px_0_0_#000] px-3 py-1 text-sm font-black uppercase tracking-wider">
                {t("home.create.title")}
              </h2>
              <Button size="lg" block disabled={!ready || busy} onClick={handleCreate}>
                {t("home.create.cta")}
              </Button>
              <p className="text-xs font-bold text-[var(--mb-text-dim)]">{t("home.stage.hint")}</p>
            </Card>

            <Card
              raised
              className="flex flex-col gap-3 mb-rise -rotate-[0.4deg]"
              style={{ "--mb-i": 3 } as React.CSSProperties}
            >
              <h2 className="self-start rotate-1 bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)] border-2 border-black shadow-[2px_2px_0_0_#000] px-3 py-1 text-sm font-black uppercase tracking-wider">
                {t("home.join.title")}
              </h2>
              <div className="flex gap-3">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
                  placeholder={t("home.code.placeholder")}
                  aria-label={t("home.code.label")}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  className="min-h-13 w-32 rounded-md bg-white text-black border-[3px] border-black px-2 text-center text-2xl font-black tracking-[0.25em] uppercase placeholder:text-neutral-300 outline-none focus:border-[var(--mb-accent-2)] shadow-[var(--mb-shadow)] [font-family:var(--mb-font-display)]"
                />
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={!ready || code.trim().length !== 4 || busy}
                  onClick={() => void handleJoin("player")}
                >
                  {t("home.join.cta")}
                </Button>
              </div>
              <button
                type="button"
                className="text-sm font-bold text-[var(--mb-text-dim)] underline decoration-2 underline-offset-4 min-h-11 text-left disabled:opacity-40 hover:text-white transition-colors"
                disabled={!ready || code.trim().length !== 4 || busy}
                onClick={() => void handleJoin("spectator")}
              >
                {t("home.join.watch")}
              </button>
            </Card>

            {error && (
              <p
                role="alert"
                className="self-center rotate-1 bg-[var(--mb-danger)] text-[var(--mb-on-danger)] border-2 border-black shadow-[2px_2px_0_0_#000] px-3 py-1.5 text-center text-sm font-black uppercase"
              >
                {t(error)}
              </p>
            )}
          </div>

          {/* RIGHT COLUMN: "IN THE MERKIVE TONIGHT" Content Packs */}
          <div className="lg:col-span-7 flex flex-col gap-6 mb-rise" style={{ "--mb-i": 4 } as React.CSSProperties}>
            <div className="flex items-center gap-3">
              <h2 className="shrink-0 bg-[var(--mb-accent)] text-[var(--mb-on-accent)] border-2 border-black shadow-[3px_3px_0_0_#000] px-4 py-1.5 text-base sm:text-lg font-black uppercase tracking-wider -rotate-1">
                {t("home.games.title")}
              </h2>
              <div aria-hidden className="h-1 flex-1 bg-black" />
            </div>

            {/* Active Content Pack Showcase ("The Merk-ining") */}
            {activePack && (
              <div className={`relative overflow-hidden rounded-xl border-3 border-black bg-gradient-to-br ${activePack.gradientTheme ?? "from-purple-950 to-indigo-900"} p-5 sm:p-6 shadow-[6px_6px_0_0_#000] flex flex-col gap-4 transition-all duration-300 hover:shadow-[8px_8px_0_0_#000]`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="bg-[var(--mb-gold)] text-[var(--mb-on-gold)] border-2 border-black shadow-[2px_2px_0_0_#000] px-2.5 py-0.5 text-xs font-black uppercase tracking-wider -rotate-1">
                      {activePack.badge ? t(activePack.badge) : t("home.games.pack_included")}
                    </span>
                    <span className="bg-black text-[var(--mb-accent-2)] border border-[var(--mb-accent-2)] px-2 py-0.5 text-[11px] font-black uppercase tracking-widest">
                      3 GAMES INCLUDED
                    </span>
                  </div>
                  <Pill tone="ok">{t("home.games.ready")}</Pill>
                </div>

                <div>
                  <h3 className="text-3xl sm:text-4xl [font-family:var(--mb-font-display)] font-black italic uppercase text-white tracking-tight leading-tight drop-shadow-[2px_2px_0_#000]">
                    {t(activePack.nameKey)}
                  </h3>
                  <p className="text-sm font-extrabold text-[var(--mb-violet)] mt-0.5">
                    {t(activePack.taglineKey ?? activePack.descriptionKey)}
                  </p>
                  <p className="text-xs text-[var(--mb-text-dim)] font-medium mt-1">
                    {t(activePack.descriptionKey)}
                  </p>
                </div>

                {/* Game Cards inside Active Pack */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
                  {activePack.gameIds.map((gameId, i) => {
                    const g = gameRegistry[gameId];
                    if (!g) return null;
                    return (
                      <div
                        key={g.meta.id}
                        className={
                          "flex flex-col justify-between gap-2 rounded-lg border-2 border-black bg-[var(--mb-surface-2)] p-3 shadow-[3px_3px_0_0_#000] hover:bg-[var(--mb-surface-3)] transition-all " +
                          (i % 2 === 0 ? "rotate-[0.4deg]" : "-rotate-[0.4deg]")
                        }
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-black uppercase text-sm [font-family:var(--mb-font-display)] text-[var(--mb-text)] truncate">
                              {t(g.meta.nameKey)}
                            </span>
                          </div>
                          <p className="text-[11px] font-semibold text-[var(--mb-text-dim)] line-clamp-2 leading-snug">
                            {t(g.meta.descriptionKey)}
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-2 border-t border-black/40 pt-2 mt-1">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mb-accent-2)]">
                            {t("lobby.players.range", { min: g.meta.minPlayers, max: g.meta.maxPlayers })}
                          </span>
                          <span className="text-[10px] font-black uppercase bg-black px-1.5 py-0.5 text-[var(--mb-gold)] border border-[var(--mb-gold)] rounded-sm">
                            PLAYABLE
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Coming Soon Vault Content Packs Header */}
            <div className="flex items-center justify-between gap-3 mt-2">
              <span className="text-xs font-black uppercase tracking-widest text-[var(--mb-violet)] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--mb-warn)] animate-ping inline-block" />
                EXPANSION PACK VAULT
              </span>
              <span className="text-[10px] font-black uppercase bg-black text-[var(--mb-warn)] border border-[var(--mb-warn)] px-2 py-0.5">
                IN DEVELOPMENT
              </span>
            </div>

            {/* Grid of Coming Soon Content Packs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {comingSoonPacks.map((pack) => (
                <div
                  key={pack.id}
                  className={`relative overflow-hidden rounded-xl border-2 border-dashed border-neutral-600 bg-gradient-to-br ${pack.gradientTheme ?? "from-neutral-900 to-black"} p-4 flex flex-col justify-between gap-3 opacity-90 hover:opacity-100 transition-all group shadow-[4px_4px_0_0_#000]`}
                >
                  {/* Diagonal Warning Banner */}
                  <div className="absolute -top-3 -right-12 rotate-12 bg-[var(--mb-warn)] text-black border-2 border-black font-black text-[10px] uppercase tracking-widest px-10 py-1 shadow-[2px_2px_0_0_#000]">
                    COMING SOON
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-black/80 text-white border border-neutral-700 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
                        {pack.badge ? t(pack.badge) : "VAULT"}
                      </span>
                    </div>

                    <h4 className="text-xl [font-family:var(--mb-font-display)] font-black italic uppercase text-neutral-200 tracking-tight">
                      {t(pack.nameKey)}
                    </h4>
                    <p className="text-xs font-bold text-neutral-400 mt-0.5">
                      {t(pack.taglineKey ?? pack.descriptionKey)}
                    </p>
                    <p className="text-[11px] text-neutral-400/80 mt-1 line-clamp-2">
                      {t(pack.descriptionKey)}
                    </p>
                  </div>

                  {/* Preview Upcoming Games */}
                  {pack.upcomingGames && pack.upcomingGames.length > 0 && (
                    <div className="border-t border-white/10 pt-2 flex flex-col gap-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">
                        INCLUDED TITLES (PREVIEW):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {pack.upcomingGames.map((ug, idx) => (
                          <span
                            key={idx}
                            className="bg-black/60 text-neutral-300 border border-neutral-700 px-2 py-0.5 rounded text-[10px] font-bold"
                            title={ug.desc}
                          >
                            ⚡ {ug.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <Ticker
        className="fixed bottom-0 inset-x-0 z-40"
        items={[
          t("ticker.status"),
          t("ticker.join"),
          "Active Pack: The Merk-ining",
          t("ticker.round"),
          t("ticker.stay"),
        ]}
      />
    </>
  );
}

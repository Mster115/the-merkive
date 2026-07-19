"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { gameList } from "@merky/games";
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

  return (
    <>
      <main className="mx-auto max-w-md min-h-dvh flex flex-col justify-center gap-6 p-5 pb-24 mb-stagger">
        <header className="text-center mb-drop" style={{ "--mb-i": 0 } as React.CSSProperties}>
          <div className="relative inline-block">
            <div aria-hidden className="absolute -inset-3 bg-[var(--mb-pink)] opacity-20 blur-2xl -z-10" />
            <h1 className="mb-wobble-fast text-6xl [font-family:var(--mb-font-display)] font-black italic uppercase tracking-tighter text-[var(--mb-violet)] leading-none">
              {t("app.name")}
            </h1>
          </div>
          <p className="mt-4 inline-block bg-black px-4 py-1.5 rotate-1 border-2 border-[var(--mb-accent-2)] text-[var(--mb-accent-2)] font-black uppercase tracking-widest text-xs">
            {t("app.tagline")}
          </p>
        </header>

        <Card
          raised
          className="flex flex-col gap-4 mb-rise -rotate-[0.6deg]"
          style={{ "--mb-i": 1 } as React.CSSProperties}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-black uppercase tracking-widest text-[var(--mb-violet)]">
              {t("home.name.label")}
            </span>
            <span className="relative">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("home.name.placeholder")}
                maxLength={16}
                autoComplete="nickname"
                suppressHydrationWarning
                className="w-full min-h-13 rounded-md bg-white text-black border-[3px] border-black px-4 text-lg font-extrabold placeholder:text-neutral-400 outline-none focus:border-[var(--mb-accent)] shadow-[var(--mb-shadow)]"
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
            className="text-sm font-bold text-[var(--mb-text-dim)] underline decoration-2 underline-offset-4 min-h-11 text-left disabled:opacity-40"
            disabled={!ready || code.trim().length !== 4 || busy}
            onClick={() => void handleJoin("spectator")}
          >
            {t("home.join.watch")}
          </button>
        </Card>

        <section
          aria-label={t("home.games.title")}
          className="mb-rise"
          style={{ "--mb-i": 4 } as React.CSSProperties}
        >
          <div className="flex items-center gap-3 mb-3">
            <h2 className="shrink-0 bg-[var(--mb-accent)] text-[var(--mb-on-accent)] border-2 border-black shadow-[2px_2px_0_0_#000] px-3 py-1 text-sm font-black uppercase tracking-wider -rotate-1">
              {t("home.games.title")}
            </h2>
            <div aria-hidden className="h-1 flex-1 bg-black" />
          </div>
          <ul className="flex flex-col gap-2.5">
            {gameList.map((g, i) => (
              <li
                key={g.meta.id}
                className={
                  "flex items-center justify-between gap-3 rounded-md border-2 border-black bg-[var(--mb-surface-2)] shadow-[2px_2px_0_0_#000] px-3 py-2 " +
                  (i % 2 === 0 ? "rotate-[0.3deg]" : "-rotate-[0.3deg]")
                }
              >
                <span className="min-w-0">
                  <span className="block font-black uppercase [font-family:var(--mb-font-display)]">
                    {t(g.meta.nameKey)}
                  </span>
                  <span className="block text-xs font-bold text-[var(--mb-text-dim)] truncate">
                    {t(g.meta.descriptionKey)}
                  </span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <Pill>{t("lobby.players.range", { min: g.meta.minPlayers, max: g.meta.maxPlayers })}</Pill>
                  <Pill tone="ok">{t("home.games.ready")}</Pill>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {error && (
          <p
            role="alert"
            className="self-center rotate-1 bg-[var(--mb-danger)] text-[var(--mb-on-danger)] border-2 border-black shadow-[2px_2px_0_0_#000] px-3 py-1.5 text-center text-sm font-black uppercase"
          >
            {t(error)}
          </p>
        )}
      </main>
      <Ticker
        className="fixed bottom-0 inset-x-0 z-40"
        items={[t("ticker.status"), t("ticker.join"), t("ticker.round"), t("ticker.stay")]}
      />
    </>
  );
}

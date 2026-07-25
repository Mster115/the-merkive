"use client";
import * as React from "react";
import { Button, Card } from "@merky/ui";
import { useT } from "@/i18n";
import { ensureDailyDevice } from "@/client/dailyDevice";

/**
 * Surfaces the device's recovery code and accepts one to restore from.
 *
 * Without this, clearing cookies or changing device silently loses every
 * streak, with nothing the player could have done about it beforehand.
 */
export function RecoveryPanel({ onRestored }: { onRestored?: () => void }) {
  const t = useT();
  const [code, setCode] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [entry, setEntry] = React.useState("");
  const [message, setMessage] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function reveal() {
    setBusy(true);
    try {
      await ensureDailyDevice();
      const res = await fetch("/api/daily/recovery");
      if (res.ok) setCode(((await res.json()) as { code: string }).code);
    } catch {
      // Leave the button in place so the player can retry.
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the code is on screen to copy by hand.
    }
  }

  async function restore(e: React.FormEvent) {
    e.preventDefault();
    if (!entry.trim() || busy) return;
    // Adopting another device's id abandons whatever is under this cookie.
    if (!window.confirm(t("daily.recovery.confirm"))) return;

    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/daily/recovery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: entry }),
      });
      if (res.ok) {
        setMessage(t("daily.recovery.restored"));
        setEntry("");
        onRestored?.();
      } else {
        setMessage(t("daily.recovery.failed"));
      }
    } catch {
      setMessage(t("daily.recovery.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card raised className="p-5 bg-[var(--mb-surface-2)] border-3 border-black flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-black uppercase text-[var(--mb-text)] [font-family:var(--mb-font-display)]">
          {t("daily.recovery.title")}
        </h3>
        <p className="text-sm font-semibold text-[var(--mb-text-dim)] mt-1 leading-relaxed">
          {t("daily.recovery.body")}
        </p>
      </div>

      {code ? (
        <div className="flex flex-wrap items-center gap-3">
          <code className="px-3 py-2 bg-[var(--mb-surface)] border-3 border-black font-black tracking-widest text-[var(--mb-text)] select-all">
            {code}
          </code>
          <Button size="sm" variant="secondary" onClick={copy}>
            {copied ? t("daily.recovery.copied") : t("daily.recovery.copy")}
          </Button>
        </div>
      ) : (
        <div>
          <Button size="sm" variant="secondary" onClick={reveal} disabled={busy}>
            {t("daily.recovery.reveal")}
          </Button>
        </div>
      )}

      <form onSubmit={restore} className="flex flex-col gap-2">
        <label
          htmlFor="mb-recovery-code"
          className="text-xs font-black uppercase tracking-widest text-[var(--mb-text-dim)]"
        >
          {t("daily.recovery.restoreLabel")}
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="mb-recovery-code"
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
            placeholder={t("daily.recovery.restorePlaceholder")}
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 px-3 py-2 bg-[var(--mb-surface)] border-3 border-black font-bold tracking-widest text-[var(--mb-text)] placeholder:text-[var(--mb-text-dim)]"
          />
          <Button size="sm" type="submit" disabled={busy || !entry.trim()}>
            {t("daily.recovery.restore")}
          </Button>
        </div>
        {message && (
          <p aria-live="polite" className="text-sm font-bold text-[var(--mb-text-dim)]">
            {message}
          </p>
        )}
      </form>
    </Card>
  );
}

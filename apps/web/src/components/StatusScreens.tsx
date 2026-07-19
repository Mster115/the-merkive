"use client";
import * as React from "react";
import Link from "next/link";
import { Button, Card } from "@merky/ui";
import { useT } from "@/i18n";
import type { TransportStatus } from "@/client/transport";

export function CenterScreen({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main className={`min-h-dvh flex items-center justify-center p-6 ${className || ""}`}>
      <div className="w-full max-w-md flex flex-col items-center gap-4 text-center">{children}</div>
    </main>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div role="status" aria-label={label ?? "loading"} className="flex flex-col items-center gap-3">
      <div className="w-12 h-12 rounded-full border-4 border-[var(--mb-line)] border-t-[var(--mb-accent)] animate-spin" />
      {label && <p className="font-bold text-[var(--mb-text-dim)]">{label}</p>}
    </div>
  );
}

export function ErrorScreen({ code }: { code: string | null }) {
  const t = useT();
  return (
    <CenterScreen>
      <Card raised className="w-full flex flex-col gap-4 items-center">
        <span className="text-5xl" aria-hidden>
          🫠
        </span>
        <p className="font-bold">{t(`error.${code ?? "internal"}`)}</p>
        <Link href="/" className="w-full">
          <Button block variant="secondary">
            {t("bye.home")}
          </Button>
        </Link>
      </Card>
    </CenterScreen>
  );
}

export function ByeScreen({ reason }: { reason: "kicked" | "expired" | "room_closed" }) {
  const t = useT();
  return (
    <CenterScreen>
      <Card raised className="w-full flex flex-col gap-4 items-center">
        <span className="text-5xl" aria-hidden>
          {reason === "kicked" ? "🥾" : "⏰"}
        </span>
        <p className="font-bold">{t(`bye.${reason}`)}</p>
        <Link href="/" className="w-full">
          <Button block variant="secondary">
            {t("bye.home")}
          </Button>
        </Link>
      </Card>
    </CenterScreen>
  );
}

/** True once `flag` has been continuously true for `delayMs`. */
export function useDelayedFlag(flag: boolean, delayMs: number): boolean {
  const [delayed, setDelayed] = React.useState(false);
  React.useEffect(() => {
    if (!flag) {
      setDelayed(false);
      return;
    }
    const timer = setTimeout(() => setDelayed(true), delayMs);
    return () => clearTimeout(timer);
  }, [flag, delayMs]);
  return delayed;
}

export function ReconnectOverlay({ connection }: { connection: TransportStatus }) {
  const t = useT();
  const show = useDelayedFlag(connection !== "open", 1_500);
  if (!show) return null;
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <Spinner />
        <p className="text-xl font-black">{t("game.reconnecting")}</p>
        <p className="text-sm font-bold text-[var(--mb-text-dim)]">{t("game.offline.hint")}</p>
      </div>
    </div>
  );
}

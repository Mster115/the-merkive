"use client";
import * as React from "react";
import { Card, Button } from "@merky/ui";
import { useT } from "@/i18n";

export interface ShareCardProps {
  shareText: string;
  gameId: string;
}

export function ShareCard({ shareText, gameId }: ShareCardProps) {
  const t = useT();
  const [copied, setCopied] = React.useState(false);

  // Every result doubles as an invite: the link is appended here, client-side,
  // rather than inside the game's pure summarize() (which also runs
  // server-side and has no window/origin to read).
  const [origin, setOrigin] = React.useState("");
  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // Whether this device can hand the result to another app. Resolved in an
  // effect rather than during render: `navigator` does not exist on the server,
  // and branching on it during the first client render is a hydration mismatch.
  const [canShare, setCanShare] = React.useState(false);
  React.useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const playUrl = origin ? `${origin}/daily/${gameId}` : `/daily/${gameId}`;
  const fullText = `${shareText}\n\n${t("daily.share.playCta")}: ${playUrl}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback if clipboard api fails
    }
  }

  async function handleShare() {
    try {
      // The link is already the last line of `fullText`, so it is deliberately
      // not passed as `url` too — targets that render both would show it twice.
      await navigator.share({ title: t("daily.share.shareTitle"), text: fullText });
    } catch (err) {
      // Dismissing the share sheet rejects with AbortError. That is the user
      // saying no, not a failure, so it must not fall back to anything.
      if ((err as Error)?.name === "AbortError") return;
      await handleCopy();
    }
  }

  return (
    <Card
      raised
      className="flex flex-col gap-3 bg-[var(--mb-surface-2)] p-4 border-3 border-black shadow-[4px_4px_0_0_#000] sm:rotate-1"
    >
      <h3 className="text-sm font-black uppercase text-[var(--mb-violet)] tracking-wider">
        {t("daily.share.title")}
      </h3>
      {/* The play link is one long unbroken token, so it needs `anywhere` to
          wrap at all — `break-words` alone leaves it running off a phone. */}
      <pre className="whitespace-pre-wrap [overflow-wrap:anywhere] font-mono text-sm bg-black text-[var(--mb-accent-2)] p-3 rounded border-2 border-black">
        {fullText}
      </pre>
      {/* Grid, not flex-row: every Button carries `shrink-0` (DESIGN.md §7b),
          so two `w-full` buttons in a flex row each demand the full row width
          and the second one overflows off-screen instead of sharing it. Grid
          columns stretch to their track without a flex-shrink fight. */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {canShare && (
          <Button
            variant="primary"
            size="md"
            onClick={() => void handleShare()}
            className="w-full font-black uppercase tracking-wider"
          >
            {t("daily.share.share")}
          </Button>
        )}
        <Button
          variant={canShare ? "secondary" : "primary"}
          size="md"
          onClick={() => void handleCopy()}
          className="w-full font-black uppercase tracking-wider"
        >
          {copied ? t("daily.share.copied") : t("daily.share.copy")}
        </Button>
      </div>
    </Card>
  );
}

"use client";
import * as React from "react";
import { Card, Button } from "@merky/ui";
import { useT } from "@/i18n";

export interface ShareCardProps {
  shareText: string;
}

export function ShareCard({ shareText }: ShareCardProps) {
  const t = useT();
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback if clipboard api fails
    }
  }

  return (
    <Card raised className="flex flex-col gap-3 bg-[var(--mb-surface-2)] p-4 rotate-1 border-3 border-black shadow-[4px_4px_0_0_#000]">
      <h3 className="text-sm font-black uppercase text-[var(--mb-violet)] tracking-wider">
        {t("daily.share.title")}
      </h3>
      <pre className="whitespace-pre-wrap font-mono text-sm bg-black text-[var(--mb-accent-2)] p-3 rounded border-2 border-black">
        {shareText}
      </pre>
      <Button
        variant="primary"
        size="md"
        onClick={() => void handleCopy()}
        className="w-full font-black uppercase tracking-wider"
      >
        {copied ? t("daily.share.copied") : t("daily.share.copy")}
      </Button>
    </Card>
  );
}

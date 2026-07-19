"use client";
import * as React from "react";
import QR from "qrcode";

export function QrCode({ url, size = 200, label }: { url: string; size?: number; label: string }) {
  const [dataUrl, setDataUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    QR.toDataURL(url, {
      width: size * 2,
      margin: 1,
      color: { dark: "#120f2d", light: "#ffffff" },
    })
      .then((d) => {
        if (!cancelled) setDataUrl(d);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  if (!dataUrl) {
    return <div style={{ width: size, height: size }} className="rounded-2xl bg-white/10" aria-hidden="true" />;
  }
  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt={label}
      className="rounded-2xl bg-white p-2"
    />
  );
}

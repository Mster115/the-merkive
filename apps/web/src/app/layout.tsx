import type { Metadata, Viewport } from "next";
import { Anybody, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/i18n";

const display = Anybody({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

const body = Plus_Jakarta_Sans({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "The Merkive",
  description: "Browser party games for you and up to seven friends — one stage, everyone's phone is a controller.",
  robots: { index: true, follow: false },
  icons: {
    icon: "/icon.png",
    shortcut: "/favicon.ico",
    apple: "/icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0b1326",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <div aria-hidden="true" className="mb-orb w-[42vw] h-[42vw] left-[-12vw] top-[-14vw] bg-[#b76dff]" />
        <div
          aria-hidden="true"
          className="mb-orb w-[36vw] h-[36vw] right-[-10vw] bottom-[-12vw] bg-[#4ae176]"
          style={{ animationDelay: "-13s" }}
        />
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}

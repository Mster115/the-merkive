"use client";
import * as React from "react";
import type { Locale, Translate } from "@merky/game-sdk";
import { gameList } from "@merky/games";
import { en } from "./en";

function buildDictionary(locale: Locale): Record<string, string> {
  const dict: Record<string, string> = { ...en };
  for (const game of gameList) {
    Object.assign(dict, game.i18n[locale] ?? game.i18n.en ?? {});
  }
  return dict;
}

const I18nContext = React.createContext<Translate>((key) => key);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const t = React.useMemo<Translate>(() => {
    const dict = buildDictionary("en");
    return (key, vars) => {
      let out = dict[key];
      if (out === undefined) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[i18n] missing key: ${key}`);
        }
        return key;
      }
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          out = out.replaceAll(`{${k}}`, String(v));
        }
      }
      return out;
    };
  }, []);
  return <I18nContext.Provider value={t}>{children}</I18nContext.Provider>;
}

export function useT(): Translate {
  return React.useContext(I18nContext);
}

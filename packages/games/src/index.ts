import type { GameModule } from "@merky/game-sdk";
import { zaplash } from "./zaplash";
import { tiletangle } from "./tiletangle";
import { eightstorm } from "./eightstorm";
import { yougotit } from "./yougotit";
import { merkissioner } from "./merkissioner";

export interface ContentPack {
  id: string;
  nameKey: string;
  descriptionKey: string;
  taglineKey?: string;
  badge?: string;
  isComingSoon?: boolean;
  gameIds: string[];
  gradientTheme?: string;
  upcomingGames?: { name: string; desc: string }[];
}

export const gameRegistry: Record<string, GameModule> = {
  [zaplash.meta.id]: zaplash,
  [tiletangle.meta.id]: tiletangle,
  [eightstorm.meta.id]: eightstorm,
  [yougotit.meta.id]: yougotit,
  [merkissioner.meta.id]: merkissioner,
};

export const gameList: GameModule[] = Object.values(gameRegistry);

export const contentPacks: ContentPack[] = [
  {
    id: "merkining",
    nameKey: "pack.merkining.name",
    descriptionKey: "pack.merkining.desc",
    taglineKey: "pack.merkining.tagline",
    badge: "pack.merkining.badge",
    isComingSoon: false,
    gameIds: ["zaplash", "tiletangle", "eightstorm", "yougotit", "merkissioner"],
    gradientTheme: "from-purple-950/80 via-indigo-900/60 to-pink-950/80 border-[var(--mb-accent)]",
  },
  {
    id: "merkaggeddon",
    nameKey: "pack.merkaggeddon.name",
    descriptionKey: "pack.merkaggeddon.desc",
    taglineKey: "pack.merkaggeddon.tagline",
    badge: "pack.merkaggeddon.badge",
    isComingSoon: true,
    gameIds: [],
    gradientTheme: "from-cyan-950/60 via-blue-900/50 to-indigo-950/60 border-cyan-500/50",
  },
  {
    id: "merky_after_dark",
    nameKey: "pack.dark.name",
    descriptionKey: "pack.dark.desc",
    taglineKey: "pack.dark.tagline",
    badge: "pack.dark.badge",
    isComingSoon: true,
    gameIds: [],
    gradientTheme: "from-rose-950/60 via-red-950/50 to-purple-950/60 border-rose-500/50",
  },
  {
    id: "seen_heard",
    nameKey: "pack.seenheard.name",
    descriptionKey: "pack.seenheard.desc",
    taglineKey: "pack.seenheard.tagline",
    badge: "pack.seenheard.badge",
    isComingSoon: true,
    gameIds: [],
    gradientTheme: "from-amber-950/60 via-yellow-900/50 to-orange-950/60 border-amber-500/50",
  },
];

export function getGame(id: string): GameModule | undefined {
  return gameRegistry[id];
}


import type { GameModule } from "@merky/game-sdk";
import { zaplash } from "./zaplash";
import { tiletangle } from "./tiletangle";
import { eightstorm } from "./eightstorm";

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
    gameIds: ["zaplash", "tiletangle", "eightstorm"],
    gradientTheme: "from-purple-950/80 via-indigo-900/60 to-pink-950/80 border-[var(--mb-accent)]",
  },
  {
    id: "space_merk",
    nameKey: "pack.space.name",
    descriptionKey: "pack.space.desc",
    taglineKey: "pack.space.tagline",
    badge: "pack.space.badge",
    isComingSoon: true,
    gameIds: [],
    gradientTheme: "from-cyan-950/60 via-blue-900/50 to-indigo-950/60 border-cyan-500/50",
    upcomingGames: [
      { name: "Zero-G Zap", desc: "Anti-gravity reaction frenzy" },
      { name: "Cosmic Bluff", desc: "Lie your way across the galaxy" },
    ],
  },
  {
    id: "merk_after_dark",
    nameKey: "pack.dark.name",
    descriptionKey: "pack.dark.desc",
    taglineKey: "pack.dark.tagline",
    badge: "pack.dark.badge",
    isComingSoon: true,
    gameIds: [],
    gradientTheme: "from-rose-950/60 via-red-950/50 to-purple-950/60 border-rose-500/50",
    upcomingGames: [
      { name: "Midnight Confessions", desc: "Spill the tea or drink" },
      { name: "Wildcard Outrage", desc: "Filtered for zero modesty" },
    ],
  },
  {
    id: "trivia_mayhem",
    nameKey: "pack.trivia.name",
    descriptionKey: "pack.trivia.desc",
    taglineKey: "pack.trivia.tagline",
    badge: "pack.trivia.badge",
    isComingSoon: true,
    gameIds: [],
    gradientTheme: "from-amber-950/60 via-yellow-900/50 to-orange-950/60 border-amber-500/50",
    upcomingGames: [
      { name: "Brain Brawler", desc: "Lightning fast trivia rounds" },
      { name: "Fake Facts", desc: "Outsmart your friends with fake news" },
    ],
  },
];

export function getGame(id: string): GameModule | undefined {
  return gameRegistry[id];
}


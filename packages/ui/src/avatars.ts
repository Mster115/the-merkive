export interface AvatarPreset {
  id: string;
  emoji: string;
  color: string;
}

export const AVATARS: AvatarPreset[] = [
  { id: "fox", emoji: "🦊", color: "#ff8a3d" },
  { id: "frog", emoji: "🐸", color: "#3ddc82" },
  { id: "octopus", emoji: "🐙", color: "#ff3d8a" },
  { id: "owl", emoji: "🦉", color: "#b78af7" },
  { id: "cat", emoji: "😺", color: "#ffc53d" },
  { id: "penguin", emoji: "🐧", color: "#2bd9ff" },
  { id: "bee", emoji: "🐝", color: "#ffe23d" },
  { id: "crab", emoji: "🦀", color: "#ff5d5d" },
  { id: "koala", emoji: "🐨", color: "#a8b6c8" },
  { id: "dragon", emoji: "🐲", color: "#42e8b0" },
  { id: "ghost", emoji: "👻", color: "#dcd6ff" },
  { id: "alien", emoji: "👽", color: "#8aff5d" },
  { id: "robot", emoji: "🤖", color: "#7aa7ff" },
  { id: "mushroom", emoji: "🍄", color: "#ff7a9e" },
  { id: "dino", emoji: "🦖", color: "#9edc3d" },
  { id: "rocket", emoji: "🚀", color: "#ff9e5d" },
];

export function avatarById(id: string): AvatarPreset {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0]!;
}

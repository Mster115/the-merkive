"use client";
import { AVATARS, AvatarFace, cn } from "@merky/ui";

export function AvatarPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <fieldset suppressHydrationWarning>
      <legend className="text-sm font-bold text-[var(--mb-text-dim)] mb-2">{label}</legend>
      <div className="grid grid-cols-8 gap-1.5" suppressHydrationWarning>
        {AVATARS.map((a) => (
          <button
            key={a.id}
            type="button"
            aria-label={a.id}
            aria-pressed={value === a.id}
            suppressHydrationWarning
            onClick={() => onChange(a.id)}
            className={cn(
              "rounded-md p-0.5 border-2 transition-transform focus-visible:outline-2 focus-visible:outline-[var(--mb-accent-2)]",
              value === a.id
                ? "border-[var(--mb-accent)] scale-110 shadow-[2px_2px_0_0_#000]"
                : "border-transparent opacity-70 hover:opacity-100"
            )}
          >
            <AvatarFace avatarId={a.id} size={34} />
          </button>
        ))}
      </div>
    </fieldset>
  );
}

import * as React from "react";
import type { StageProps } from "@merky/game-sdk";
import { AvatarFace, cn, Pill } from "@merky/ui";
import type { SecretMerkPublicState } from "./logic";
import { CrownIcon, GavelIcon, ShieldIcon, SkullIcon } from "./icons";

export const Stage: React.FC<StageProps> = ({ room, match, t }) => {
  const pub = match.publicState as SecretMerkPublicState | null;

  if (!pub) {
    return <div className="p-8 text-center text-xl font-bold">Secret Merk</div>;
  }

  const president = room.seats.find((s) => s.seatIndex === pub.presidentSeat);
  const chancellor = room.seats.find((s) => s.seatIndex === pub.chancellorSeat);
  const nominee = room.seats.find((s) => s.seatIndex === pub.nominatedChancellor);

  const isGameOver = pub.phase === "game_over";

  return (
    <div className="w-full h-full p-6 text-[var(--mb-text)] flex flex-col justify-between space-y-6 max-w-6xl mx-auto select-none">
      {/* Game Header Banner */}
      <div className="flex items-center justify-between gap-4 bg-[var(--mb-surface-2)] border-[3px] border-black p-4 rounded-2xl shadow-[var(--mb-shadow-lg)] -rotate-[0.3deg]">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[var(--mb-danger)] border-2 border-black flex items-center justify-center text-white font-black text-2xl shadow-[2px_2px_0_0_#000]">
            <SkullIcon className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider text-[var(--mb-gold)] [font-family:var(--mb-font-display)] italic mb-neon-gold">
              Secret Merk
            </h1>
            <p className="text-xs font-bold text-[var(--mb-text-dim)] uppercase tracking-widest">
              Social Deduction & Undercover Politics
            </p>
          </div>
        </div>

        {/* Phase Announcement Banner */}
        <div className="bg-black text-white border-2 border-black px-4 py-2 rounded-xl shadow-[2px_2px_0_0_#000] flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--mb-gold)] animate-ping inline-block" />
          <span className="text-sm font-black uppercase tracking-wider [font-family:var(--mb-font-display)]">
            {pub.phase === "nominate" && `President ${president?.displayName ?? ""} is nominating Chancellor`}
            {pub.phase === "vote" && `Voting on Govt: President ${president?.displayName} + Chancellor ${nominee?.displayName}`}
            {pub.phase === "legislative_president" && `President ${president?.displayName} reviewing Decrees`}
            {pub.phase === "legislative_chancellor" && `Chancellor ${chancellor?.displayName} enacting Decree`}
            {pub.phase.startsWith("executive") && `Executive Power Triggered by President ${president?.displayName}`}
            {pub.phase === "game_over" && `Game Over: ${pub.winReason}`}
          </span>
        </div>
      </div>

      {/* Main Decrees Track Board */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        {/* Loyalist Decrees Board */}
        <div className="bg-[var(--mb-surface-2)] border-[3px] border-black rounded-2xl p-5 shadow-[var(--mb-shadow)] flex flex-col justify-between rotate-[0.3deg]">
          <div className="flex items-center justify-between border-b-2 border-black pb-3">
            <span className="text-base font-black uppercase text-[var(--mb-gold)] tracking-widest flex items-center gap-2 [font-family:var(--mb-font-display)]">
              <ShieldIcon className="w-5 h-5 text-[var(--mb-gold)]" /> Loyalist Decrees ({pub.loyalistPassed}/5)
            </span>
            <Pill tone="gold">5 Needed to Win</Pill>
          </div>

          <div className="grid grid-cols-5 gap-3 my-6">
            {[1, 2, 3, 4, 5].map((idx) => {
              const enacted = idx <= pub.loyalistPassed;
              return (
                <div
                  key={`l-${idx}`}
                  className={cn(
                    "h-28 rounded-xl border-3 border-black flex flex-col items-center justify-center p-2 text-center transition-all duration-300 shadow-[3px_3px_0_0_#000]",
                    enacted
                      ? "bg-[var(--mb-gold)] text-[var(--mb-on-gold)] scale-105"
                      : "bg-[var(--mb-surface-3)] text-[var(--mb-text-dim)] border-dashed"
                  )}
                >
                  <ShieldIcon className={cn("w-8 h-8 mb-1", enacted ? "text-[var(--mb-on-gold)]" : "opacity-40")} />
                  <span className="text-xs font-black uppercase [font-family:var(--mb-font-display)]">
                    {enacted ? "ENACTED" : `SLOT ${idx}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Merker Decrees Board */}
        <div className="bg-[var(--mb-surface-2)] border-[3px] border-black rounded-2xl p-5 shadow-[var(--mb-shadow)] flex flex-col justify-between -rotate-[0.3deg]">
          <div className="flex items-center justify-between border-b-2 border-black pb-3">
            <span className="text-base font-black uppercase text-[var(--mb-danger)] tracking-widest flex items-center gap-2 [font-family:var(--mb-font-display)]">
              <SkullIcon className="w-5 h-5 text-[var(--mb-danger)]" /> Merker Decrees ({pub.merkerPassed}/6)
            </span>
            <Pill tone="danger">6 Needed to Win</Pill>
          </div>

          <div className="grid grid-cols-6 gap-2 my-6">
            {[1, 2, 3, 4, 5, 6].map((idx) => {
              const enacted = idx <= pub.merkerPassed;
              let powerLabel = "";
              if (idx === 3) powerLabel = "PEEK / INVESTIGATE";
              if (idx === 4) powerLabel = "EXECUTE";
              if (idx === 5) powerLabel = "EXECUTE";

              return (
                <div
                  key={`m-${idx}`}
                  className={cn(
                    "h-28 rounded-xl border-3 border-black flex flex-col items-center justify-center p-1.5 text-center transition-all duration-300 shadow-[3px_3px_0_0_#000]",
                    enacted
                      ? "bg-[var(--mb-danger)] text-[var(--mb-on-danger)] scale-105"
                      : "bg-[var(--mb-surface-3)] text-[var(--mb-text-dim)] border-dashed"
                  )}
                >
                  <SkullIcon className={cn("w-7 h-7 mb-1", enacted ? "text-[var(--mb-on-danger)]" : "opacity-40")} />
                  <span className="text-[10px] font-black uppercase tracking-tighter [font-family:var(--mb-font-display)]">
                    {enacted ? "ENACTED" : powerLabel || `SLOT ${idx}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Players Seat Roster */}
      <div className="bg-[var(--mb-surface-3)] border-[3px] border-black rounded-2xl p-4 shadow-[var(--mb-shadow)]">
        <div className="flex items-center justify-between mb-3 border-b-2 border-black/40 pb-2">
          <span className="text-xs font-black uppercase text-white tracking-widest [font-family:var(--mb-font-display)]">
            Government & Table Roster ({room.seats.length} Players)
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--mb-text-dim)]">Election Fail Tracker:</span>
            {[1, 2, 3].map((f) => (
              <span
                key={f}
                className={cn(
                  "w-5 h-5 rounded-full border-2 border-black flex items-center justify-center font-black text-[10px]",
                  f <= pub.failedElections ? "bg-[var(--mb-danger)] text-white" : "bg-black text-[var(--mb-text-dim)]"
                )}
              >
                !
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {room.seats.map((seat) => {
            const isPresident = seat.seatIndex === pub.presidentSeat;
            const isChancellor = seat.seatIndex === pub.chancellorSeat;
            const isNominee = seat.seatIndex === pub.nominatedChancellor;
            const isDead = pub.deadSeats.includes(seat.seatIndex);
            const vote = pub.votes[seat.seatIndex];

            return (
              <div
                key={seat.seatIndex}
                className={cn(
                  "relative rounded-xl border-2 border-black p-3 flex flex-col items-center gap-2 text-center shadow-[2px_2px_0_0_#000] transition-all",
                  isPresident && "border-[var(--mb-gold)] bg-[var(--mb-gold)]/10 scale-105",
                  isChancellor && "border-[var(--mb-accent-2)] bg-[var(--mb-accent-2)]/10 scale-105",
                  isDead && "opacity-40 saturate-0 bg-neutral-900 border-neutral-700"
                )}
              >
                {/* Status badges */}
                {isPresident && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--mb-gold)] text-black border-2 border-black px-2 py-0.5 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-[1px_1px_0_0_#000]">
                    <CrownIcon className="w-3 h-3" /> PRES
                  </span>
                )}
                {isChancellor && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--mb-accent-2)] text-black border-2 border-black px-2 py-0.5 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-[1px_1px_0_0_#000]">
                    <GavelIcon className="w-3 h-3" /> CHAN
                  </span>
                )}

                <AvatarFace avatarId={seat.avatarId} size={44} />
                <span className="font-black text-xs text-white uppercase tracking-tight truncate w-full">
                  {seat.displayName}
                </span>

                {/* Vote reveal */}
                {pub.phase === "vote" && (
                  <span
                    className={cn(
                      "text-[10px] font-black uppercase px-2 py-0.5 rounded border border-black",
                      vote !== undefined ? "bg-[var(--mb-accent)] text-white" : "bg-black text-[var(--mb-text-dim)]"
                    )}
                  >
                    {vote !== undefined ? "VOTED" : "WAITING"}
                  </span>
                )}

                {pub.lastVotePassed !== null && pub.phase !== "vote" && vote !== undefined && (
                  <span
                    className={cn(
                      "text-[10px] font-black uppercase px-2 py-0.5 rounded border border-black",
                      vote ? "bg-[var(--mb-ok)] text-black" : "bg-[var(--mb-danger)] text-white"
                    )}
                  >
                    {vote ? "YES" : "NO"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

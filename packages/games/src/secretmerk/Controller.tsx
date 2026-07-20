import * as React from "react";
import type { ControllerProps } from "@merky/game-sdk";
import { AvatarFace, Button, buzz, cn, Pill } from "@merky/ui";
import type { SecretMerkPrivateState, SecretMerkPublicState } from "./logic";
import { EyeIcon, GavelIcon, ShieldIcon, SkullIcon, TargetIcon } from "./icons";

export const Controller: React.FC<ControllerProps> = ({
  room,
  match,
  seat,
  privateState,
  act,
  t,
}) => {
  const pub = match.publicState as SecretMerkPublicState | null;
  const priv = privateState as SecretMerkPrivateState | null;

  const [showRole, setShowRole] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  if (!pub || !priv) {
    return <div className="p-4 text-center font-bold">Secret Merk</div>;
  }

  const isPresident = seat === pub.presidentSeat;
  const isChancellor = seat === pub.chancellorSeat;
  const isDead = pub.deadSeats.includes(seat);
  const myVote = pub.votes[seat];

  const aliveSeats = room.seats
    .map((s) => s.seatIndex)
    .filter((s) => !pub.deadSeats.includes(s));

  const handleNominate = async (targetSeat: number) => {
    setErrorMsg(null);
    const res = await act("nominate_chancellor", { nomineeSeat: targetSeat });
    if (!res.ok) {
      setErrorMsg(res.error);
      buzz([30, 40, 30]);
    } else {
      buzz([15, 30, 25]);
    }
  };

  const handleVote = async (voteYes: boolean) => {
    setErrorMsg(null);
    const res = await act("vote", { vote: voteYes });
    if (!res.ok) {
      setErrorMsg(res.error);
      buzz([30, 40, 30]);
    } else {
      buzz([15, 30, 25]);
    }
  };

  const handleDiscardPresident = async (discardIndex: number) => {
    setErrorMsg(null);
    const res = await act("discard_president", { discardIndex });
    if (!res.ok) {
      setErrorMsg(res.error);
      buzz([30, 40, 30]);
    } else {
      buzz([15, 30, 25]);
    }
  };

  const handleEnactChancellor = async (enactIndex: number) => {
    setErrorMsg(null);
    const res = await act("enact_chancellor", { enactIndex });
    if (!res.ok) {
      setErrorMsg(res.error);
      buzz([30, 40, 30]);
    } else {
      buzz([15, 30, 25]);
    }
  };

  const handleInvestigate = async (targetSeat: number) => {
    setErrorMsg(null);
    const res = await act("investigate", { targetSeat });
    if (!res.ok) {
      setErrorMsg(res.error);
      buzz([30, 40, 30]);
    } else {
      buzz([15, 30, 25]);
    }
  };

  const handleExecute = async (targetSeat: number) => {
    setErrorMsg(null);
    const res = await act("execute", { targetSeat });
    if (!res.ok) {
      setErrorMsg(res.error);
      buzz([30, 40, 30]);
    } else {
      buzz([15, 30, 25]);
    }
  };

  return (
    <div className="w-full min-h-full p-4 text-[var(--mb-text)] flex flex-col justify-between space-y-4 max-w-lg mx-auto select-none">
      {/* Secret Role Card Toggle */}
      <div className="bg-[var(--mb-surface-2)] border-[3px] border-black shadow-[var(--mb-shadow)] rounded-2xl p-4 flex flex-col gap-2 -rotate-[0.5deg]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase text-[var(--mb-text-dim)] tracking-widest [font-family:var(--mb-font-display)]">
            Secret Identity
          </span>
          <Button size="sm" variant="ghost" onClick={() => setShowRole((prev) => !prev)}>
            {showRole ? "🙈 Hide Role" : "👁️ Peek Secret Role"}
          </Button>
        </div>

        {showRole && (
          <div
            className={cn(
              "p-4 rounded-xl border-3 border-black text-center font-black uppercase flex flex-col items-center gap-2 shadow-[3px_3px_0_0_#000] mb-pop",
              priv.role === "loyalist" && "bg-[var(--mb-gold)] text-[var(--mb-on-gold)]",
              priv.role === "merker" && "bg-[var(--mb-danger)] text-white",
              priv.role === "secret_merk" && "bg-[var(--mb-accent)] text-white"
            )}
          >
            <div className="flex items-center gap-2 text-lg [font-family:var(--mb-font-display)]">
              {priv.role === "loyalist" && <ShieldIcon className="w-6 h-6" />}
              {priv.role === "merker" && <SkullIcon className="w-6 h-6" />}
              {priv.role === "secret_merk" && <SkullIcon className="w-6 h-6 text-[var(--mb-gold)]" />}
              {priv.role === "loyalist" && "LOYALIST"}
              {priv.role === "merker" && "MERKER UNDERGROUND"}
              {priv.role === "secret_merk" && "SECRET MERK (UNDERCOVER BOSS)"}
            </div>

            <p className="text-xs font-bold opacity-90 normal-case">
              {priv.role === "loyalist" && "Pass 5 Loyalist Decrees or execute the Secret Merk to win!"}
              {priv.role === "merker" && "Pass 6 Merker Decrees or elect Secret Merk as Chancellor after 3 Decrees!"}
              {priv.role === "secret_merk" && "Stay hidden. Get elected Chancellor after 3 Merker Decrees to win!"}
            </p>

            {priv.knownMerkers.length > 0 && (
              <div className="w-full bg-black/40 border border-black p-2 rounded-lg text-xs mt-1">
                <span className="text-[var(--mb-gold)] font-black">Teammates: </span>
                {priv.knownMerkers
                  .map((sIdx) => room.seats.find((s) => s.seatIndex === sIdx)?.displayName ?? `Seat ${sIdx}`)
                  .join(", ")}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div role="alert" className="mb-shake bg-[var(--mb-danger)] text-white border-3 border-black p-3.5 rounded-xl text-xs font-black text-center uppercase">
          {errorMsg}
        </div>
      )}

      {/* Phase Action Box */}
      <div className="flex-1 bg-[var(--mb-surface)] border-[3px] border-black shadow-[var(--mb-shadow-lg)] rounded-2xl p-4 flex flex-col justify-between space-y-4 min-h-[260px] rotate-[0.3deg]">
        {/* NOMINATION PHASE */}
        {pub.phase === "nominate" && (
          <div className="flex flex-col gap-3">
            <span className="text-sm font-black uppercase text-[var(--mb-gold)] tracking-wider [font-family:var(--mb-font-display)]">
              Phase: Chancellor Nomination
            </span>

            {isPresident ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-bold text-neutral-300">
                  You are President! Tap a player to nominate them as your Chancellor:
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {aliveSeats
                    .filter((s) => s !== seat && s !== pub.lastChancellorSeat)
                    .map((sIdx) => {
                      const player = room.seats.find((s) => s.seatIndex === sIdx);
                      return (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => handleNominate(sIdx)}
                          className="p-3 rounded-xl border-2 border-black bg-[var(--mb-surface-2)] hover:bg-[var(--mb-accent)] hover:text-white flex items-center justify-between font-black text-sm mb-press shadow-[2px_2px_0_0_#000]"
                        >
                          <span className="flex items-center gap-2">
                            <AvatarFace avatarId={player?.avatarId ?? "fox"} size={32} />
                            {player?.displayName}
                          </span>
                          <span className="text-xs uppercase bg-black text-[var(--mb-gold)] px-2 py-0.5 border border-black rounded">
                            NOMINATE
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            ) : (
              <div className="text-center p-6 bg-[var(--mb-surface-2)] border-2 border-black rounded-xl space-y-2">
                <p className="text-base font-black text-white uppercase [font-family:var(--mb-font-display)]">
                  Waiting for President…
                </p>
                <p className="text-xs text-[var(--mb-text-dim)] font-bold">
                  President {room.seats.find((s) => s.seatIndex === pub.presidentSeat)?.displayName} is choosing a Chancellor.
                </p>
              </div>
            )}
          </div>
        )}

        {/* VOTING PHASE */}
        {pub.phase === "vote" && (
          <div className="flex flex-col gap-4">
            <span className="text-sm font-black uppercase text-[var(--mb-accent-2)] tracking-wider [font-family:var(--mb-font-display)]">
              Phase: Government Vote
            </span>

            <div className="p-3 bg-[var(--mb-surface-2)] border-2 border-black rounded-xl text-center space-y-1">
              <p className="text-xs font-bold text-[var(--mb-text-dim)]">Proposed Government:</p>
              <p className="text-base font-black text-white uppercase [font-family:var(--mb-font-display)]">
                Pres. {room.seats.find((s) => s.seatIndex === pub.presidentSeat)?.displayName} + Chan. {room.seats.find((s) => s.seatIndex === pub.nominatedChancellor)?.displayName}
              </p>
            </div>

            {!isDead && myVote === undefined ? (
              <div className="grid grid-cols-2 gap-3">
                <Button size="lg" variant="gold" onClick={() => handleVote(true)} className="w-full font-black text-lg">
                  YES (MERK IT)
                </Button>
                <Button size="lg" variant="danger" onClick={() => handleVote(false)} className="w-full font-black text-lg">
                  NO (DENY)
                </Button>
              </div>
            ) : (
              <div className="p-4 text-center bg-black/60 border-2 border-black rounded-xl">
                <p className="text-sm font-black text-[var(--mb-gold)] uppercase tracking-wider">
                  {myVote !== undefined ? `You voted: ${myVote ? "YES" : "NO"}` : "Dead players cannot vote."}
                </p>
                <p className="text-xs text-[var(--mb-text-dim)] mt-1 font-bold">
                  Waiting for other votes to lock in…
                </p>
              </div>
            )}
          </div>
        )}

        {/* PRESIDENT LEGISLATIVE SESSION */}
        {pub.phase === "legislative_president" && (
          <div className="flex flex-col gap-3">
            <span className="text-sm font-black uppercase text-[var(--mb-gold)] tracking-wider [font-family:var(--mb-font-display)]">
              Legislative Session: President
            </span>

            {isPresident && priv.drawnDecrees ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-bold text-neutral-300">
                  Tap 1 Decree to DISCARD (remaining 2 will pass to Chancellor):
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {priv.drawnDecrees.map((decree, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleDiscardPresident(idx)}
                      className={cn(
                        "h-24 rounded-xl border-3 border-black p-2 font-black uppercase flex flex-col items-center justify-center gap-1 mb-press shadow-[2px_2px_0_0_#000]",
                        decree === "loyalist" ? "bg-[var(--mb-gold)] text-[var(--mb-on-gold)]" : "bg-[var(--mb-danger)] text-white"
                      )}
                    >
                      {decree === "loyalist" ? <ShieldIcon className="w-6 h-6" /> : <SkullIcon className="w-6 h-6" />}
                      <span className="text-xs">{decree}</span>
                      <span className="text-[9px] bg-black text-white px-1.5 py-0.5 border border-black rounded">
                        DISCARD
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center p-6 bg-[var(--mb-surface-2)] border-2 border-black rounded-xl">
                <p className="text-base font-black text-white uppercase">President Reviewing Cards…</p>
              </div>
            )}
          </div>
        )}

        {/* CHANCELLOR LEGISLATIVE SESSION */}
        {pub.phase === "legislative_chancellor" && (
          <div className="flex flex-col gap-3">
            <span className="text-sm font-black uppercase text-[var(--mb-accent-2)] tracking-wider [font-family:var(--mb-font-display)]">
              Legislative Session: Chancellor
            </span>

            {isChancellor && priv.drawnDecrees ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-bold text-neutral-300">
                  Tap 1 Decree to ENACT as official law:
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {priv.drawnDecrees.map((decree, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleEnactChancellor(idx)}
                      className={cn(
                        "h-28 rounded-xl border-3 border-black p-3 font-black uppercase flex flex-col items-center justify-center gap-2 mb-press shadow-[3px_3px_0_0_#000]",
                        decree === "loyalist" ? "bg-[var(--mb-gold)] text-[var(--mb-on-gold)]" : "bg-[var(--mb-danger)] text-white"
                      )}
                    >
                      {decree === "loyalist" ? <ShieldIcon className="w-8 h-8" /> : <SkullIcon className="w-8 h-8" />}
                      <span className="text-sm tracking-wider">{decree} LAW</span>
                      <span className="text-xs bg-black text-[var(--mb-gold)] px-2 py-0.5 border border-black rounded">
                        ENACT LAW
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center p-6 bg-[var(--mb-surface-2)] border-2 border-black rounded-xl">
                <p className="text-base font-black text-white uppercase">Chancellor Enacting Law…</p>
              </div>
            )}
          </div>
        )}

        {/* EXECUTIVE ACTIONS */}
        {pub.phase === "executive_investigate" && (
          <div className="flex flex-col gap-3">
            <span className="text-sm font-black uppercase text-[var(--mb-gold)] tracking-wider [font-family:var(--mb-font-display)] flex items-center gap-1">
              <EyeIcon className="w-4 h-4" /> Executive Power: Investigation
            </span>

            {isPresident ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-bold text-neutral-300">
                  Tap a player to secretly investigate their party loyalty:
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {aliveSeats
                    .filter((s) => s !== seat)
                    .map((sIdx) => {
                      const player = room.seats.find((s) => s.seatIndex === sIdx);
                      return (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => handleInvestigate(sIdx)}
                          className="p-3 rounded-xl border-2 border-black bg-[var(--mb-surface-2)] hover:bg-[var(--mb-accent-2)] flex items-center justify-between font-black text-sm mb-press shadow-[2px_2px_0_0_#000]"
                        >
                          <span className="flex items-center gap-2">
                            <AvatarFace avatarId={player?.avatarId ?? "fox"} size={32} />
                            {player?.displayName}
                          </span>
                          <span className="text-xs uppercase bg-black text-[var(--mb-accent-2)] px-2 py-0.5 border border-black rounded">
                            INVESTIGATE
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            ) : (
              <div className="text-center p-6 bg-[var(--mb-surface-2)] border-2 border-black rounded-xl">
                <p className="text-base font-black text-white uppercase">President Investigating Player…</p>
              </div>
            )}
          </div>
        )}

        {pub.phase === "executive_execute" && (
          <div className="flex flex-col gap-3">
            <span className="text-sm font-black uppercase text-[var(--mb-danger)] tracking-wider [font-family:var(--mb-font-display)] flex items-center gap-1">
              <TargetIcon className="w-4 h-4" /> Executive Power: Execution (Merking)
            </span>

            {isPresident ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-bold text-neutral-300">
                  Tap a player to EXECUTE them from the game:
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {aliveSeats
                    .filter((s) => s !== seat)
                    .map((sIdx) => {
                      const player = room.seats.find((s) => s.seatIndex === sIdx);
                      return (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => handleExecute(sIdx)}
                          className="p-3 rounded-xl border-2 border-black bg-[var(--mb-danger)] text-white flex items-center justify-between font-black text-sm mb-press shadow-[2px_2px_0_0_#000]"
                        >
                          <span className="flex items-center gap-2">
                            <AvatarFace avatarId={player?.avatarId ?? "fox"} size={32} />
                            {player?.displayName}
                          </span>
                          <span className="text-xs uppercase bg-black text-[var(--mb-danger)] px-2 py-0.5 border border-black rounded">
                            EXECUTE
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            ) : (
              <div className="text-center p-6 bg-[var(--mb-surface-2)] border-2 border-black rounded-xl">
                <p className="text-base font-black text-white uppercase">President Executing Player…</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

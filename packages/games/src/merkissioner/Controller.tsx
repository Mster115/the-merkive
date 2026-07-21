"use client";

import * as React from "react";
import type { ControllerProps, RoomView, SeatIndex, Translate } from "@merky/game-sdk";
import { AvatarFace, Button, Card, Modal, Pill, cn } from "@merky/ui";
import { AuditResultModal, PeekFirePanel, PeekResultModal, PowerTargetPicker } from "./PowerPanels";
import { BanishIcon, BossIcon, MerkiteIcon, MerkizenIcon, VetoIcon } from "./icons";
import type { Decree, MerkissionerPrivateState, MerkissionerPublicState, PowerKind, Vote } from "./types";

type RunAct = (type: string, payload?: unknown) => Promise<{ ok: boolean }>;

function seatName(room: RoomView, seat: number | null): string {
  if (seat === null) return "?";
  return room.seats.find((s) => s.seatIndex === seat)?.displayName ?? `Seat ${seat}`;
}

function phaseAnnouncement(t: Translate, phase: string): string {
  const key = `games.merkissioner.phase.${phase}`;
  const val = t(key);
  return val === key ? "" : val;
}

export function MerkissionerController({ room, match, seat, privateState, act, t }: ControllerProps) {
  const pub = match.publicState as MerkissionerPublicState | null;
  const priv = privateState as MerkissionerPrivateState | null;
  const phase = match.phase;

  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [roleModalOpen, setRoleModalOpen] = React.useState(false);
  const [handSelection, setHandSelection] = React.useState<number | null>(null);
  const [auditModalOpen, setAuditModalOpen] = React.useState(false);
  const [peekModalOpen, setPeekModalOpen] = React.useState(false);

  const auditCountRef = React.useRef(priv?.auditResults?.length ?? 0);
  const peekRef = React.useRef<Decree[] | null>(priv?.peek ?? null);
  const mountedAuditRef = React.useRef(false);
  const mountedPeekRef = React.useRef(false);

  React.useEffect(() => {
    setHandSelection(null);
    setErrorMsg(null);
  }, [phase]);

  React.useEffect(() => {
    const len = priv?.auditResults?.length ?? 0;
    if (!mountedAuditRef.current) {
      mountedAuditRef.current = true;
      auditCountRef.current = len;
      return;
    }
    if (len > auditCountRef.current) setAuditModalOpen(true);
    auditCountRef.current = len;
  }, [priv?.auditResults?.length]);

  React.useEffect(() => {
    const cur = priv?.peek ?? null;
    if (!mountedPeekRef.current) {
      mountedPeekRef.current = true;
      peekRef.current = cur;
      return;
    }
    if (cur && cur !== peekRef.current) setPeekModalOpen(true);
    peekRef.current = cur;
  }, [priv?.peek]);

  if (!pub || !priv) {
    return (
      <div className="p-6 text-center font-bold">
        {t("games.merkissioner.name")} — {t("games.merkissioner.ui.loading")}
      </div>
    );
  }

  const runAct: RunAct = async (type, payload) => {
    setErrorMsg(null);
    const res = await act(type, payload);
    if (!res.ok) setErrorMsg(res.error);
    return res;
  };

  const isBanished = pub.banishedSeats.includes(seat);
  const isGameOver = match.over || phase === "game_over";
  const lastAuditEntry = priv.auditResults[priv.auditResults.length - 1];

  return (
    <div className="flex flex-col min-h-full w-full max-w-md mx-auto p-3 gap-3 select-none">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {phaseAnnouncement(t, phase)}
      </div>

      {!isGameOver && !isBanished && phase !== "huddle" && (
        <RoleStrip priv={priv} onOpen={() => setRoleModalOpen(true)} t={t} />
      )}

      {errorMsg && (
        <div
          role="alert"
          className="p-3 text-sm font-black bg-[var(--mb-danger)] border-2 border-black text-[var(--mb-on-danger)] rounded-xl text-center shadow-[var(--mb-shadow)] mb-shake uppercase tracking-wide [font-family:var(--mb-font-display)]"
        >
          {errorMsg}
        </div>
      )}

      {isGameOver ? (
        <GameOverPanel pub={pub} priv={priv} room={room} t={t} />
      ) : isBanished ? (
        <BanishedPanel t={t} />
      ) : phase === "huddle" ? (
        <HuddlePanel
          priv={priv}
          room={room}
          alreadyReady={pub.readySeats.includes(seat)}
          onReady={() => void runAct("ready_up")}
          t={t}
        />
      ) : phase === "nominate" ? (
        <NominatePanel pub={pub} room={room} seat={seat} runAct={runAct} t={t} />
      ) : phase === "vote" ? (
        <VotePanel pub={pub} priv={priv} room={room} runAct={runAct} t={t} />
      ) : phase === "legislative_chair" ? (
        seat === pub.chairSeat ? (
          <LegislativeHandPanel
            hand={priv.hand ?? []}
            selection={handSelection}
            onSelect={setHandSelection}
            confirmLabel={t("games.merkissioner.ui.discard_this")}
            onConfirm={() => {
              if (handSelection !== null) void runAct("discard_decree", { index: handSelection });
            }}
            t={t}
          />
        ) : (
          <WaitingCard title={t("games.merkissioner.ui.chair_deciding_hint")} />
        )
      ) : phase === "legislative_commissioner" ? (
        seat === pub.commissionerSeat ? (
          <CommissionerPanel
            pub={pub}
            priv={priv}
            selection={handSelection}
            onSelect={setHandSelection}
            runAct={runAct}
            t={t}
          />
        ) : (
          <WaitingCard title={t("games.merkissioner.ui.commissioner_deciding_hint")} />
        )
      ) : phase === "veto_pending" ? (
        seat === pub.chairSeat ? (
          <VetoPendingChairPanel runAct={runAct} t={t} />
        ) : (
          <WaitingCard title={t("games.merkissioner.ui.veto_pending_wait")} />
        )
      ) : phase.startsWith("power_") ? (
        seat === pub.chairSeat ? (
          <PowerDispatch pub={pub} room={room} phase={phase} runAct={runAct} t={t} />
        ) : (
          <WaitingCard
            title={t(`games.merkissioner.ui.power_waiting_${phase.replace("power_", "")}`, {
              name: seatName(room, pub.chairSeat),
            })}
          />
        )
      ) : null}

      <Modal open={roleModalOpen} onClose={() => setRoleModalOpen(false)} title={t("games.merkissioner.ui.your_role")}>
        <RoleCardContent priv={priv} room={room} t={t} />
        <Button variant="primary" size="md" block className="mt-4" onClick={() => setRoleModalOpen(false)}>
          {t("games.merkissioner.ui.close")}
        </Button>
      </Modal>

      {lastAuditEntry && (
        <AuditResultModal
          open={auditModalOpen}
          onClose={() => setAuditModalOpen(false)}
          target={seatName(room, lastAuditEntry.seat)}
          party={lastAuditEntry.party}
          t={t}
        />
      )}
      {priv.peek && (
        <PeekResultModal open={peekModalOpen} onClose={() => setPeekModalOpen(false)} peek={priv.peek} t={t} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Role card + persistent strip                                        */
/* ------------------------------------------------------------------ */

function PlayerChipForSeat({ seat, room }: { seat: SeatIndex; room: RoomView }) {
  const s = room.seats.find((x) => x.seatIndex === seat);
  if (!s) return null;
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border-2 border-black bg-[var(--mb-surface-2)]">
      <AvatarFace avatarId={s.avatarId} size={26} />
      <span className="font-bold text-sm truncate">{s.displayName}</span>
    </div>
  );
}

function RoleCardContent({ priv, room, t }: { priv: MerkissionerPrivateState; room: RoomView; t: Translate }) {
  const isBoss = priv.role === "merkissioner";
  const isMerkite = priv.role === "merkite";
  const Icon = isBoss ? BossIcon : isMerkite ? MerkiteIcon : MerkizenIcon;
  const tone = isBoss ? "text-[var(--mb-gold)]" : isMerkite ? "text-[var(--mb-danger)]" : "text-[var(--mb-accent-2)]";
  const hasKnowledge = priv.knownMerkites.length > 0 || priv.knownBoss !== null;

  return (
    <div className="flex flex-col gap-3 items-center text-center">
      <Icon className={cn("w-16 h-16", tone)} />
      <h2 className={cn("text-2xl font-black uppercase italic [font-family:var(--mb-font-display)]", tone)}>
        {t(`games.merkissioner.role.${priv.role}`)}
      </h2>
      <p className="text-sm font-bold text-[var(--mb-text-dim)]">{t(`games.merkissioner.role.${priv.role}.desc`)}</p>
      {hasKnowledge ? (
        <div className="flex flex-col gap-2 w-full">
          {priv.knownBoss !== null && (
            <div className="flex flex-col gap-1 items-stretch">
              <span className="text-xs font-black uppercase text-[var(--mb-text-dim)]">
                {t("games.merkissioner.ui.known_boss")}
              </span>
              <PlayerChipForSeat seat={priv.knownBoss} room={room} />
            </div>
          )}
          {priv.knownMerkites.length > 0 && (
            <div className="flex flex-col gap-1 items-stretch">
              <span className="text-xs font-black uppercase text-[var(--mb-text-dim)]">
                {t("games.merkissioner.ui.known_merkites")}
              </span>
              <div className="flex flex-col gap-1.5">
                {priv.knownMerkites.map((s) => (
                  <PlayerChipForSeat key={s} seat={s} room={room} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs font-bold text-[var(--mb-text-dim)] italic">{t("games.merkissioner.ui.no_knowledge")}</p>
      )}
    </div>
  );
}

function RoleStrip({ priv, onOpen, t }: { priv: MerkissionerPrivateState; onOpen: () => void; t: Translate }) {
  const isBoss = priv.role === "merkissioner";
  const isMerkite = priv.role === "merkite";
  const Icon = isBoss ? BossIcon : isMerkite ? MerkiteIcon : MerkizenIcon;
  const tone = isBoss
    ? "bg-[var(--mb-gold)] text-[var(--mb-on-gold)]"
    : isMerkite
    ? "bg-[var(--mb-danger)] text-[var(--mb-on-danger)]"
    : "bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)]";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "min-h-11 px-3 rounded-xl border-2 border-black flex items-center justify-between gap-2 font-black uppercase text-sm shadow-[2px_2px_0_0_#000] mb-press [font-family:var(--mb-font-display)]",
        tone
      )}
      aria-label={t("games.merkissioner.ui.your_role")}
    >
      <span className="flex items-center gap-2">
        <Icon className="w-5 h-5" /> {t(`games.merkissioner.role.${priv.role}`)}
      </span>
      <span aria-hidden="true">▾</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Huddle                                                               */
/* ------------------------------------------------------------------ */

function HuddlePanel({
  priv,
  room,
  alreadyReady,
  onReady,
  t,
}: {
  priv: MerkissionerPrivateState;
  room: RoomView;
  alreadyReady: boolean;
  onReady: () => void;
  t: Translate;
}) {
  return (
    <Card className="flex flex-col gap-4 p-4 border-[3px] border-black shadow-[var(--mb-shadow)] mb-flip-in">
      <RoleCardContent priv={priv} room={room} t={t} />
      <Button variant={alreadyReady ? "secondary" : "primary"} size="lg" block onClick={onReady} disabled={alreadyReady}>
        {alreadyReady ? t("games.merkissioner.ui.ready_confirmed") : t("games.merkissioner.ui.ready_button")}
      </Button>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Nominate                                                             */
/* ------------------------------------------------------------------ */

function NominatePanel({
  pub,
  room,
  seat,
  runAct,
  t,
}: {
  pub: MerkissionerPublicState;
  room: RoomView;
  seat: SeatIndex;
  runAct: RunAct;
  t: Translate;
}) {
  const isChair = pub.chairSeat === seat;
  const [pending, setPending] = React.useState<SeatIndex | null>(null);

  if (!isChair) {
    return <WaitingCard title={t("games.merkissioner.ui.chair_choosing", { name: seatName(room, pub.chairSeat) })} />;
  }

  const livingCount = room.seats.filter((s) => !pub.banishedSeats.includes(s.seatIndex)).length;
  const candidates = room.seats.filter((s) => s.seatIndex !== seat && !pub.banishedSeats.includes(s.seatIndex));

  const choose = (target: SeatIndex) => {
    setPending(target);
    void runAct("nominate", { seat: target }).finally(() => setPending(null));
  };

  return (
    <Card className="flex flex-col gap-3 p-4 border-[3px] border-black shadow-[var(--mb-shadow)]">
      <h3 className="text-center text-base font-black uppercase text-[var(--mb-violet)] [font-family:var(--mb-font-display)]">
        {t("games.merkissioner.ui.choose_commissioner")}
      </h3>
      <div className="grid grid-cols-1 gap-2">
        {candidates.map((s) => {
          const termLimitReason =
            pub.lastCommissionerSeat === s.seatIndex
              ? t("games.merkissioner.ui.term_limited_last_commissioner")
              : pub.lastChairSeat === s.seatIndex && livingCount > 5
              ? t("games.merkissioner.ui.term_limited_last_chair")
              : null;
          const disabled = termLimitReason !== null || pending !== null;
          return (
            <button
              key={s.seatIndex}
              type="button"
              disabled={disabled}
              onClick={() => choose(s.seatIndex)}
              aria-label={termLimitReason ? `${s.displayName}, ${termLimitReason}` : s.displayName}
              className={cn(
                "min-h-14 px-3 rounded-xl border-2 border-black flex items-center gap-2.5 font-bold transition-all mb-press",
                termLimitReason
                  ? "bg-[var(--mb-surface-3)] opacity-50"
                  : "bg-[var(--mb-surface-2)] shadow-[2px_2px_0_0_#000]"
              )}
            >
              <AvatarFace avatarId={s.avatarId} size={32} />
              <span className="truncate max-w-32">{s.displayName}</span>
              {termLimitReason && (
                <span className="ml-auto text-[0.6rem] font-black uppercase text-[var(--mb-danger)] text-right">
                  {termLimitReason}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Vote                                                                 */
/* ------------------------------------------------------------------ */

function VotePanel({
  pub,
  priv,
  room,
  runAct,
  t,
}: {
  pub: MerkissionerPublicState;
  priv: MerkissionerPrivateState;
  room: RoomView;
  runAct: RunAct;
  t: Translate;
}) {
  const myVote = priv.myVote;
  const total = room.seats.filter((s) => !s.abandoned && !pub.banishedSeats.includes(s.seatIndex)).length;
  const vote = (v: Vote) => void runAct("cast_vote", { vote: v });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-center text-base font-black uppercase text-[var(--mb-text)] [font-family:var(--mb-font-display)]">
        {t("games.merkissioner.ui.vote_prompt")}
      </p>
      <div className="grid grid-cols-1 gap-3">
        <button
          type="button"
          onClick={() => vote("yeah")}
          aria-pressed={myVote === "yeah"}
          className={cn(
            "min-h-20 rounded-xl border-[3px] border-black flex items-center justify-center gap-2 text-xl font-black uppercase [font-family:var(--mb-font-display)] transition-all mb-press",
            myVote === "yeah"
              ? "bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)] shadow-[var(--mb-shadow)]"
              : "bg-[var(--mb-surface-2)] text-[var(--mb-text)] shadow-[2px_2px_0_0_#000]"
          )}
        >
          {t("games.merkissioner.ui.vote_yeah")}
        </button>
        <button
          type="button"
          onClick={() => vote("nah")}
          aria-pressed={myVote === "nah"}
          className={cn(
            "min-h-20 rounded-xl border-[3px] border-black flex items-center justify-center gap-2 text-xl font-black uppercase [font-family:var(--mb-font-display)] transition-all mb-press",
            myVote === "nah"
              ? "bg-[var(--mb-danger)] text-[var(--mb-on-danger)] shadow-[var(--mb-shadow)]"
              : "bg-[var(--mb-surface-2)] text-[var(--mb-text)] shadow-[2px_2px_0_0_#000]"
          )}
        >
          {t("games.merkissioner.ui.vote_nah")}
        </button>
      </div>
      {myVote && (
        <p className="text-center text-xs font-bold text-[var(--mb-text-dim)]">
          {t("games.merkissioner.ui.vote_change_hint")}
        </p>
      )}
      <Pill tone="accent" className="mx-auto text-sm px-3 py-1.5 tabular-nums">
        {t("games.merkissioner.ui.ballots_in", { cast: pub.votedSeats.length, total })}
      </Pill>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Legislative session                                                  */
/* ------------------------------------------------------------------ */

function DecreeHandCard({
  decree,
  label,
  selected,
  onClick,
}: {
  decree: Decree;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  const isMerkite = decree === "merkite";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      className={cn(
        "w-24 h-32 sm:w-28 sm:h-36 rounded-xl border-[3px] border-black flex flex-col items-center justify-center gap-2 font-black uppercase transition-all mb-press shrink-0",
        isMerkite ? "bg-[var(--mb-danger)] text-[var(--mb-on-danger)]" : "bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)]",
        selected ? "shadow-[var(--mb-shadow-lg)] -translate-y-2" : "shadow-[2px_2px_0_0_#000]"
      )}
    >
      {isMerkite ? <MerkiteIcon className="w-9 h-9" /> : <MerkizenIcon className="w-9 h-9" />}
      <span className="text-[0.6rem] leading-tight text-center px-1">{label}</span>
    </button>
  );
}

function LegislativeHandPanel({
  hand,
  selection,
  onSelect,
  confirmLabel,
  onConfirm,
  t,
}: {
  hand: Decree[];
  selection: number | null;
  onSelect: (i: number) => void;
  confirmLabel: string;
  onConfirm: () => void;
  t: Translate;
}) {
  return (
    <Card className="flex flex-col gap-4 p-4 border-[3px] border-black shadow-[var(--mb-shadow)] items-center">
      <p className="text-xs font-black uppercase tracking-wider text-[var(--mb-text-dim)] [font-family:var(--mb-font-display)]">
        {t("games.merkissioner.ui.your_hand")}
      </p>
      <div className="flex gap-2.5 justify-center flex-wrap">
        {hand.map((d, i) => (
          <DecreeHandCard
            key={i}
            decree={d}
            label={t(d === "merkite" ? "games.merkissioner.ui.decree_merkite" : "games.merkissioner.ui.decree_merkizen")}
            selected={selection === i}
            onClick={() => onSelect(i)}
          />
        ))}
      </div>
      <Button variant="primary" size="lg" block onClick={onConfirm} disabled={selection === null}>
        {confirmLabel}
      </Button>
    </Card>
  );
}

function CommissionerPanel({
  pub,
  priv,
  selection,
  onSelect,
  runAct,
  t,
}: {
  pub: MerkissionerPublicState;
  priv: MerkissionerPrivateState;
  selection: number | null;
  onSelect: (i: number) => void;
  runAct: RunAct;
  t: Translate;
}) {
  const hand = priv.hand ?? [];
  const vetoUnlocked = pub.merkiteEnacted >= 5 && !pub.vetoRefusedThisSession;
  return (
    <div className="flex flex-col gap-3">
      <LegislativeHandPanel
        hand={hand}
        selection={selection}
        onSelect={onSelect}
        confirmLabel={t("games.merkissioner.ui.enact_this")}
        onConfirm={() => {
          if (selection !== null) void runAct("enact_decree", { index: selection });
        }}
        t={t}
      />
      {vetoUnlocked && (
        <button
          type="button"
          onClick={() => void runAct("propose_veto")}
          className="min-h-11 rounded-xl border-2 border-black bg-[var(--mb-warn)] text-[var(--mb-on-gold)] font-black uppercase text-sm shadow-[2px_2px_0_0_#000] mb-press flex items-center justify-center gap-2 [font-family:var(--mb-font-display)]"
        >
          <VetoIcon className="w-4 h-4" /> {t("games.merkissioner.ui.propose_veto")}
        </button>
      )}
    </div>
  );
}

function VetoPendingChairPanel({ runAct, t }: { runAct: RunAct; t: Translate }) {
  return (
    <Card className="flex flex-col gap-3 p-4 border-[3px] border-black shadow-[var(--mb-shadow)] items-center">
      <VetoIcon className="w-10 h-10 text-[var(--mb-warn)]" />
      <p className="text-center text-sm font-bold text-[var(--mb-text)]">
        {t("games.merkissioner.ui.veto_pending_chair_prompt")}
      </p>
      <div className="grid grid-cols-1 gap-2 w-full">
        <Button variant="secondary" size="lg" block onClick={() => void runAct("resolve_veto", { agree: true })}>
          {t("games.merkissioner.ui.veto_agree")}
        </Button>
        <Button variant="danger" size="lg" block onClick={() => void runAct("resolve_veto", { agree: false })}>
          {t("games.merkissioner.ui.veto_refuse")}
        </Button>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Powers                                                               */
/* ------------------------------------------------------------------ */

function PowerDispatch({
  pub,
  room,
  phase,
  runAct,
  t,
}: {
  pub: MerkissionerPublicState;
  room: RoomView;
  phase: string;
  runAct: RunAct;
  t: Translate;
}) {
  const kind = phase.replace("power_", "") as PowerKind;
  if (kind === "peek") return <PeekFirePanel runAct={runAct} t={t} />;
  return <PowerTargetPicker pub={pub} room={room} kind={kind} runAct={runAct} t={t} />;
}

/* ------------------------------------------------------------------ */
/* Banished / game over / shared waiting card                          */
/* ------------------------------------------------------------------ */

function WaitingCard({ title }: { title: string }) {
  return (
    <Card className="flex flex-col items-center gap-2 p-6 border-[3px] border-black shadow-[var(--mb-shadow)] text-center">
      <p className="text-sm font-bold text-[var(--mb-text-dim)]">{title}</p>
    </Card>
  );
}

function BanishedPanel({ t }: { t: Translate }) {
  return (
    <Card className="flex flex-col items-center gap-3 p-6 border-[3px] border-black shadow-[var(--mb-shadow)] text-center opacity-80 grayscale">
      <BanishIcon className="w-12 h-12 text-[var(--mb-danger)]" />
      <h2 className="text-xl font-black uppercase text-[var(--mb-danger)] [font-family:var(--mb-font-display)]">
        {t("games.merkissioner.ui.banished_you")}
      </h2>
      <p className="text-sm font-bold text-[var(--mb-text-dim)]">{t("games.merkissioner.ui.banished_no_talking")}</p>
      <p className="text-xs font-bold text-[var(--mb-text-dim)]">{t("games.merkissioner.ui.spectate_hint")}</p>
    </Card>
  );
}

function GameOverPanel({
  pub,
  priv,
  room,
  t,
}: {
  pub: MerkissionerPublicState;
  priv: MerkissionerPrivateState;
  room: RoomView;
  t: Translate;
}) {
  const winnerTeam = pub.winnerTeam ?? "merkizen";
  const myTeam = priv.role === "merkizen" ? "merkizen" : "merkite";
  const won = myTeam === winnerTeam;
  const tone =
    winnerTeam === "merkite"
      ? { bg: "bg-[var(--mb-danger)]", on: "text-[var(--mb-on-danger)]" }
      : { bg: "bg-[var(--mb-accent-2)]", on: "text-[var(--mb-on-accent-2)]" };
  const bossEntry = Object.entries(pub.revealedRoles ?? {}).find(([, r]) => r === "merkissioner");
  const bossName = bossEntry ? seatName(room, Number(bossEntry[0])) : "?";

  return (
    <Card
      raised
      className={cn(
        "flex flex-col items-center gap-3 p-6 border-4 border-black shadow-[var(--mb-shadow-lg)] mb-pop text-center",
        tone.bg
      )}
    >
      {winnerTeam === "merkite" ? (
        <MerkiteIcon className={cn("w-12 h-12", tone.on)} />
      ) : (
        <MerkizenIcon className={cn("w-12 h-12", tone.on)} />
      )}
      <p className={cn("text-3xl font-black uppercase italic [font-family:var(--mb-font-display)]", tone.on)}>
        {won ? t("games.merkissioner.ui.victory") : t("games.merkissioner.ui.defeat")}
      </p>
      <p className={cn("text-xs font-bold uppercase [font-family:var(--mb-font-display)]", tone.on)}>
        {pub.winReason ? t(`games.merkissioner.ui.win_reason.${pub.winReason}`) : ""}
      </p>
      <div className={cn("flex items-center gap-2 mt-2 px-3 py-1.5 rounded-lg border-2 border-black", tone.on)}>
        <BossIcon className="w-4 h-4" />
        <span className="text-xs font-black">{t("games.merkissioner.ui.boss_reveal", { name: bossName })}</span>
      </div>
      <p className={cn("text-xs font-bold", tone.on)}>{t(`games.merkissioner.role.${priv.role}`)}</p>
    </Card>
  );
}

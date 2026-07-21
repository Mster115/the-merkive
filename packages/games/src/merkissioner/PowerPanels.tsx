"use client";

import * as React from "react";
import type { RoomView, SeatIndex, SeatPublic, Translate } from "@merky/game-sdk";
import { AvatarFace, Button, Card, Modal, Pill, cn } from "@merky/ui";
import { AuditIcon, BanishIcon, MerkiteIcon, MerkizenIcon, PeekIcon, SnapIcon } from "./icons";
import type { Decree, MerkissionerPublicState, MerkissionerPrivateState, PowerKind, Team } from "./types";

type TargetKind = Exclude<PowerKind, "peek">;

const POWER_TONE: Record<TargetKind, "danger" | "accent" | "gold"> = {
  audit: "gold",
  snap: "accent",
  banish: "danger",
};

function eligibleTargets(
  pub: MerkissionerPublicState,
  room: RoomView,
  kind: TargetKind
): SeatPublic[] {
  return room.seats.filter(
    (s) =>
      s.seatIndex !== pub.chairSeat &&
      !pub.banishedSeats.includes(s.seatIndex) &&
      !(kind === "audit" && pub.auditedSeats.includes(s.seatIndex))
  );
}

/** Shared target-picker grid for Loyalty Audit, Snap Election, and Banish. */
export function PowerTargetPicker({
  pub,
  room,
  kind,
  runAct,
  t,
}: {
  pub: MerkissionerPublicState;
  room: RoomView;
  kind: TargetKind;
  runAct: (type: string, payload?: unknown) => Promise<{ ok: boolean }>;
  t: Translate;
}) {
  const [pending, setPending] = React.useState<SeatIndex | null>(null);
  const candidates = eligibleTargets(pub, room, kind);
  const tone = POWER_TONE[kind];
  const Icon = kind === "audit" ? AuditIcon : kind === "snap" ? SnapIcon : BanishIcon;

  const choose = (target: SeatIndex) => {
    setPending(target);
    void runAct("use_power", { seat: target }).finally(() => setPending(null));
  };

  return (
    <Card className="flex flex-col gap-3 p-4 border-[3px] border-black shadow-[var(--mb-shadow)]">
      <h3
        className={cn(
          "text-center text-base font-black uppercase [font-family:var(--mb-font-display)] flex items-center justify-center gap-2",
          tone === "danger" ? "text-[var(--mb-danger)]" : tone === "gold" ? "text-[var(--mb-gold)]" : "text-[var(--mb-violet)]"
        )}
      >
        <Icon className="w-5 h-5" />
        {t(`games.merkissioner.ui.power_target_prompt_${kind}`)}
      </h3>
      <div className="grid grid-cols-1 gap-2">
        {candidates.map((s) => {
          const disabled = pending !== null;
          return (
            <button
              key={s.seatIndex}
              type="button"
              disabled={disabled}
              onClick={() => choose(s.seatIndex)}
              className={cn(
                "min-h-14 px-3 rounded-xl border-2 border-black flex items-center gap-2.5 font-bold transition-all mb-press bg-[var(--mb-surface-2)] shadow-[2px_2px_0_0_#000]",
                disabled && "opacity-60"
              )}
            >
              <AvatarFace avatarId={s.avatarId} size={32} />
              <span className="truncate max-w-40">{s.displayName}</span>
              {kind === "audit" && pub.auditedSeats.includes(s.seatIndex) && (
                <span className="ml-auto text-[0.6rem] font-black uppercase text-[var(--mb-text-dim)]">
                  {t("games.merkissioner.ui.already_audited_badge")}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/** Docket Peek has no target — just fire it. */
export function PeekFirePanel({
  runAct,
  t,
}: {
  runAct: (type: string, payload?: unknown) => Promise<{ ok: boolean }>;
  t: Translate;
}) {
  const [pending, setPending] = React.useState(false);
  const fire = () => {
    setPending(true);
    void runAct("use_power", {}).finally(() => setPending(false));
  };
  return (
    <Card className="flex flex-col items-center gap-4 p-6 border-[3px] border-black shadow-[var(--mb-shadow)] text-center">
      <PeekIcon className="w-12 h-12 text-[var(--mb-violet)]" />
      <p className="text-sm font-bold text-[var(--mb-text-dim)]">{t("games.merkissioner.ui.peek_result_body")}</p>
      <Button variant="primary" size="lg" block onClick={fire} disabled={pending}>
        {t("games.merkissioner.ui.peek_fire_button")}
      </Button>
    </Card>
  );
}

function DecreeMini({ decree, label }: { decree: Decree; label: string }) {
  const isMerkite = decree === "merkite";
  return (
    <span
      className={cn(
        "w-16 h-24 rounded-lg border-2 border-black flex flex-col items-center justify-center gap-1 shrink-0 shadow-[2px_2px_0_0_#000]",
        isMerkite ? "bg-[var(--mb-danger)] text-[var(--mb-on-danger)]" : "bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)]"
      )}
    >
      {isMerkite ? <MerkiteIcon className="w-6 h-6" /> : <MerkizenIcon className="w-6 h-6" />}
      <span className="text-[0.55rem] font-black uppercase text-center px-1 leading-tight">{label}</span>
    </span>
  );
}

/** Modal shown once after an audit resolves — reads the latest privateState.auditResults entry. */
export function AuditResultModal({
  open,
  onClose,
  target,
  party,
  t,
}: {
  open: boolean;
  onClose: () => void;
  target: string;
  party: Team;
  t: Translate;
}) {
  return (
    <Modal open={open} onClose={onClose} title={t("games.merkissioner.ui.audit_result_title")}>
      <div className="flex flex-col items-center gap-4 text-center">
        <Pill tone={party === "merkite" ? "danger" : "ok"} className="text-base px-4 py-2 gap-2">
          {party === "merkite" ? <MerkiteIcon className="w-4 h-4" /> : <MerkizenIcon className="w-4 h-4" />}
          {t(`games.merkissioner.team.${party}`)}
        </Pill>
        <p className="text-sm font-bold text-[var(--mb-text)]">
          {t("games.merkissioner.ui.audit_result_body", { name: target, party: t(`games.merkissioner.team.${party}`) })}
        </p>
        <Button variant="primary" size="md" block onClick={onClose}>
          {t("games.merkissioner.ui.close")}
        </Button>
      </div>
    </Modal>
  );
}

/** Modal shown once after a Docket Peek resolves. */
export function PeekResultModal({
  open,
  onClose,
  peek,
  t,
}: {
  open: boolean;
  onClose: () => void;
  peek: Decree[];
  t: Translate;
}) {
  return (
    <Modal open={open} onClose={onClose} title={t("games.merkissioner.ui.peek_result_title")}>
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm font-bold text-[var(--mb-text-dim)]">{t("games.merkissioner.ui.peek_result_body")}</p>
        <div className="flex gap-2 justify-center">
          {peek.map((d, i) => (
            <DecreeMini
              key={i}
              decree={d}
              label={t(d === "merkite" ? "games.merkissioner.ui.decree_merkite" : "games.merkissioner.ui.decree_merkizen")}
            />
          ))}
        </div>
        <Button variant="primary" size="md" block onClick={onClose}>
          {t("games.merkissioner.ui.close")}
        </Button>
      </div>
    </Modal>
  );
}

export type { MerkissionerPrivateState };

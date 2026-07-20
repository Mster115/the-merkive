import * as React from "react";
import type { ControllerProps } from "@merky/game-sdk";
import { BackpackIcon, Button, buzz, cn, LightningIcon, Pill, PuzzleIcon, ToolsIcon } from "@merky/ui";
import type { TileTanglePrivateState, TileTanglePublicState } from "./logic";
import type { Tile } from "./tiles";
import { validateCommit, isValidMeld, meldValue } from "./tiles";
import { TileComponent } from "./TileComponent";

export const Controller: React.FC<ControllerProps> = ({
  room,
  match,
  seat,
  privateState,
  act,
  t,
}) => {
  const pub = match.publicState as TileTanglePublicState | null;
  const priv = privateState as TileTanglePrivateState | null;

  const isMyTurn = pub ? pub.activeSeat === seat && !match.over : false;
  const activePlayer = room.seats.find((s) => s.seatIndex === pub?.activeSeat);
  const activePlayerName = activePlayer?.displayName ?? `Player ${pub?.activeSeat}`;

  const hasMelded = pub ? Boolean(pub.hasMelded[seat]) : false;
  const initialMeldPoints = typeof match.settings.initialMeldPoints === "number" ? match.settings.initialMeldPoints : 30;

  // Local workbench state
  const [localTable, setLocalTable] = React.useState<Tile[][]>([]);
  const [localRack, setLocalRack] = React.useState<Tile[]>([]);
  const [placedTileIds, setPlacedTileIds] = React.useState<string[]>([]);
  const [selectedTile, setSelectedTile] = React.useState<{
    source: "rack" | "table";
    meldIndex?: number;
    tileIndex: number;
    tile: Tile;
  } | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const [draggedRackIndex, setDraggedRackIndex] = React.useState<number | null>(null);

  // Re-sync workbench when server state / version updates (preserving hand customization)
  const serverTable = React.useMemo(() => pub?.table.map((m) => m.tiles) ?? [], [pub?.table]);
  const serverRack = React.useMemo(() => priv?.rack ?? [], [priv?.rack]);

  React.useEffect(() => {
    setLocalTable(serverTable);
    setPlacedTileIds([]);
    setSelectedTile(null);
    setErrorMsg(null);

    setLocalRack((prevRack) => {
      if (prevRack.length === 0) return serverRack;
      const serverIds = new Set(serverRack.map((t) => t.id));
      const preserved = prevRack.filter((t) => serverIds.has(t.id));
      const preservedIds = new Set(preserved.map((t) => t.id));
      const newTiles = serverRack.filter((t) => !preservedIds.has(t.id));
      return [...preserved, ...newTiles];
    });
  }, [match.version, serverTable, serverRack]);

  if (!pub || !priv) {
    return <div className="p-4 text-center font-bold">{t("games.tiletangle.name")}</div>;
  }

  const handleReset = () => {
    setLocalTable(serverTable);
    setLocalRack(serverRack);
    setPlacedTileIds([]);
    setSelectedTile(null);
    setErrorMsg(null);
  };

  const handleSort789 = () => {
    const sorted = [...localRack].sort((a, b) => {
      if (a.joker) return 1;
      if (b.joker) return -1;
      if (a.n !== b.n) return a.n - b.n;
      return a.c - b.c;
    });
    setLocalRack(sorted);
    setSelectedTile(null);
    buzz(15);
  };

  const handleSortColor = () => {
    const sorted = [...localRack].sort((a, b) => {
      if (a.joker) return 1;
      if (b.joker) return -1;
      if (a.c !== b.c) return a.c - b.c;
      return a.n - b.n;
    });
    setLocalRack(sorted);
    setSelectedTile(null);
    buzz(15);
  };

  const handleMoveRackTile = (dir: "left" | "right") => {
    if (!selectedTile || selectedTile.source !== "rack") return;
    const oldIdx = selectedTile.tileIndex;
    const newIdx = dir === "left" ? oldIdx - 1 : oldIdx + 1;
    if (newIdx < 0 || newIdx >= localRack.length) return;

    const nextRack = [...localRack];
    const [moved] = nextRack.splice(oldIdx, 1);
    if (!moved) return;
    nextRack.splice(newIdx, 0, moved);

    setLocalRack(nextRack);
    setSelectedTile({ source: "rack", tileIndex: newIdx, tile: moved });
    buzz(10);
  };

  const handleTileSelect = (
    tile: Tile,
    source: "rack" | "table",
    tileIndex: number,
    meldIndex?: number
  ) => {
    if (source === "table" && !isMyTurn) return;

    // Tap-to-reorder in rack (works anytime, turn or waiting)
    if (selectedTile?.source === "rack" && source === "rack") {
      if (selectedTile.tileIndex === tileIndex) {
        setSelectedTile(null);
        return;
      }
      const oldIdx = selectedTile.tileIndex;
      const nextRack = [...localRack];
      const [moved] = nextRack.splice(oldIdx, 1);
      if (!moved) return;
      nextRack.splice(tileIndex, 0, moved);
      setLocalRack(nextRack);
      setSelectedTile({ source: "rack", tileIndex, tile: moved });
      buzz(10);
      return;
    }

    if (
      selectedTile &&
      selectedTile.source === source &&
      selectedTile.tileIndex === tileIndex &&
      selectedTile.meldIndex === meldIndex
    ) {
      setSelectedTile(null);
      return;
    }

    setSelectedTile({ source, meldIndex, tileIndex, tile });
  };

  const moveSelectedToNewMeld = () => {
    if (!selectedTile) return;

    const { source, meldIndex, tileIndex, tile } = selectedTile;

    let nextRack = [...localRack];
    let nextTable = localTable.map((m) => [...m]);
    let nextPlaced = [...placedTileIds];

    if (source === "rack") {
      nextRack.splice(tileIndex, 1);
      if (!nextPlaced.includes(tile.id)) {
        nextPlaced.push(tile.id);
      }
    } else if (source === "table" && meldIndex !== undefined) {
      const meld = nextTable[meldIndex];
      if (meld) {
        meld.splice(tileIndex, 1);
      }
    }

    // Add as new meld
    nextTable.push([tile]);
    nextTable = nextTable.filter((m) => m.length > 0);

    setLocalRack(nextRack);
    setLocalTable(nextTable);
    setPlacedTileIds(nextPlaced);
    setSelectedTile(null);
    setErrorMsg(null);
  };

  const moveSelectedToExistingMeld = (targetMeldIdx: number) => {
    if (!selectedTile) return;

    const { source, meldIndex, tileIndex, tile } = selectedTile;

    let nextRack = [...localRack];
    let nextTable = localTable.map((m) => [...m]);
    let nextPlaced = [...placedTileIds];

    if (source === "rack") {
      nextRack.splice(tileIndex, 1);
      if (!nextPlaced.includes(tile.id)) {
        nextPlaced.push(tile.id);
      }
    } else if (source === "table" && meldIndex !== undefined) {
      if (meldIndex === targetMeldIdx) {
        setSelectedTile(null);
        return;
      }
      const meld = nextTable[meldIndex];
      if (meld) {
        meld.splice(tileIndex, 1);
      }
    }

    const targetMeld = nextTable[targetMeldIdx];
    if (targetMeld) {
      targetMeld.push(tile);
    }

    nextTable = nextTable.filter((m) => m.length > 0);

    setLocalRack(nextRack);
    setLocalTable(nextTable);
    setPlacedTileIds(nextPlaced);
    setSelectedTile(null);
    setErrorMsg(null);
  };

  const moveSelectedToRack = () => {
    if (!selectedTile || selectedTile.source !== "table" || selectedTile.meldIndex === undefined) return;

    const { meldIndex, tileIndex, tile } = selectedTile;

    let nextRack = [...localRack, tile];
    let nextTable = localTable.map((m) => [...m]);
    let nextPlaced = placedTileIds.filter((id) => id !== tile.id);

    const meld = nextTable[meldIndex];
    if (meld) {
      meld.splice(tileIndex, 1);
    }

    nextTable = nextTable.filter((m) => m.length > 0);

    setLocalRack(nextRack);
    setLocalTable(nextTable);
    setPlacedTileIds(nextPlaced);
    setSelectedTile(null);
    setErrorMsg(null);
  };

  const handleCommit = async () => {
    if (!isMyTurn) return;

    const validation = validateCommit(
      serverTable,
      serverRack,
      { melds: localTable, placedTileIds },
      hasMelded,
      initialMeldPoints
    );

    if (!validation.ok) {
      const errKey = `games.tiletangle.err.${validation.code}`;
      const translated = t(errKey, { target: initialMeldPoints });
      setErrorMsg(translated !== errKey ? translated : validation.error);
      return;
    }

    const res = await act("commit", { melds: localTable, placedTileIds });
    if (!res.ok) {
      const errKey = `games.tiletangle.err.${res.code}`;
      const translated = t(errKey, { target: initialMeldPoints });
      setErrorMsg(translated !== errKey ? translated : res.error);
      buzz([30, 40, 30]);
    } else {
      buzz([15, 30, 25]);
    }
  };

  const handleDraw = async () => {
    if (!isMyTurn) return;
    const res = await act("draw", {});
    if (!res.ok) {
      setErrorMsg(res.error);
      buzz([30, 40, 30]);
    }
  };

  // Calculate new tiles total for initial meld meter
  const newTilesPoints = React.useMemo(() => {
    if (hasMelded || placedTileIds.length === 0) return 0;

    const oldMeldKeys = new Set(serverTable.map((m) => m.map((t) => t.id).sort().join(",")));
    let sum = 0;
    for (const m of localTable) {
      const key = m.map((t) => t.id).sort().join(",");
      if (!oldMeldKeys.has(key)) {
        if (isValidMeld(m)) {
          sum += meldValue(m);
        }
      }
    }
    return sum;
  }, [hasMelded, placedTileIds, serverTable, localTable]);

  return (
    <div className="w-full min-h-full p-4 text-[var(--mb-text)] flex flex-col justify-between space-y-4 max-w-lg mx-auto">
      {/* Turn Header */}
      <div
        className={cn(
          "flex flex-col gap-2 p-4 rounded-xl border-[3px] border-black shadow-[var(--mb-shadow)] transition-all duration-150 -rotate-[0.5deg]",
          isMyTurn
            ? "bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)]"
            : "bg-[var(--mb-surface-2)] text-[var(--mb-text)]"
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <LightningIcon className="w-5 h-5" />
            <span className="font-black uppercase text-base tracking-wider [font-family:var(--mb-font-display)]">
              {isMyTurn
                ? t("games.tiletangle.yourTurn")
                : t("games.tiletangle.waitingFor", { name: activePlayerName })}
            </span>
          </div>

          {!hasMelded && isMyTurn && (
            <span
              className={cn(
                "text-xs font-black uppercase tracking-wider px-2 py-0.5 border-2 border-black rounded bg-black text-[var(--mb-gold)]",
                newTilesPoints >= initialMeldPoints && "bg-[var(--mb-gold)] text-black mb-tada"
              )}
            >
              {newTilesPoints}/{initialMeldPoints} PTS
            </span>
          )}
        </div>

        {!hasMelded && isMyTurn && (
          <div className="flex flex-col gap-1 w-full">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-80">
              {t("games.tiletangle.initialMeldMeter", { current: newTilesPoints, target: initialMeldPoints })}
            </span>
            <div className="w-full h-3 rounded bg-black/40 border-2 border-black overflow-hidden p-0.5">
              <div
                className={cn(
                  "h-full rounded-sm transition-all duration-300",
                  newTilesPoints >= initialMeldPoints
                    ? "bg-[var(--mb-gold)]"
                    : "bg-[var(--mb-pink)]"
                )}
                style={{ width: `${Math.min(100, (newTilesPoints / initialMeldPoints) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Inline Error Message */}
      {errorMsg && (
        <div
          role="alert"
          className="mb-shake bg-[var(--mb-danger)] text-[var(--mb-on-danger)] border-3 border-black p-3.5 rounded-xl text-sm font-black text-center shadow-[var(--mb-shadow)] uppercase tracking-tight [font-family:var(--mb-font-display)]"
        >
          {errorMsg}
        </div>
      )}

      {/* Main Workbench Area: Table Melds */}
      <div className="flex-1 bg-[var(--mb-surface)] border-[3px] border-black shadow-[var(--mb-shadow-lg)] rounded-2xl p-4 flex flex-col justify-start space-y-3 min-h-[220px] rotate-[0.3deg]">
        <div className="flex items-center justify-between gap-2 border-b-2 border-black/40 pb-2">
          <span className="text-xs font-black uppercase text-[var(--mb-violet)] tracking-widest [font-family:var(--mb-font-display)] flex items-center gap-1.5">
            <ToolsIcon className="w-4 h-4" /> {t("games.tiletangle.tableMelds")}
          </span>
          {isMyTurn && (
            <div className="flex gap-1.5 flex-wrap">
              {selectedTile && (
                <Button size="sm" variant="secondary" onClick={moveSelectedToNewMeld}>
                  + {t("games.tiletangle.newMeld")}
                </Button>
              )}
              {selectedTile?.source === "table" && (
                <Button size="sm" variant="ghost" onClick={moveSelectedToRack}>
                  {t("games.tiletangle.returnToRack")}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={handleReset}>
                {t("games.tiletangle.reset")}
              </Button>
            </div>
          )}
        </div>

        {localTable.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--mb-text-dim)] text-center border-[3px] border-dashed border-[var(--mb-line-dim)] rounded-xl p-6 gap-2">
            <PuzzleIcon className="w-8 h-8" />
            <p className="text-sm font-black uppercase tracking-wider text-white [font-family:var(--mb-font-display)]">
              {t("games.tiletangle.emptyTable")}
            </p>
            <p className="text-xs font-bold text-[var(--mb-text-dim)]">
              TAP TILES TO BUILD SETS & RUNS
            </p>
          </div>
        ) : (
          <div className="flex flex-col space-y-2.5">
            {localTable.map((meld, mIdx) => (
              <div
                key={`m-${mIdx}`}
                onClick={() => selectedTile && moveSelectedToExistingMeld(mIdx)}
                className={`p-3 rounded-xl border-2 border-black flex flex-wrap gap-2 items-center transition-all ${
                  selectedTile
                    ? "border-[var(--mb-accent-2)] bg-[var(--mb-surface-3)] cursor-pointer shadow-[3px_3px_0_0_#000] mb-press"
                    : "bg-[var(--mb-surface-2)] shadow-[2px_2px_0_0_#000]"
                }`}
              >
                {meld.map((tile, tIdx) => {
                  const isSelected =
                    selectedTile?.source === "table" &&
                    selectedTile.meldIndex === mIdx &&
                    selectedTile.tileIndex === tIdx;

                  return (
                    <TileComponent
                      key={`${tile.id}-${tIdx}`}
                      tile={tile}
                      size="sm"
                      selected={isSelected}
                      onClick={() => handleTileSelect(tile, "table", tIdx, mIdx)}
                      disabled={!isMyTurn}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Player's Rack */}
      <div className="bg-[var(--mb-surface-2)] border-[3px] border-black shadow-[var(--mb-shadow)] rounded-2xl p-4 space-y-3 -rotate-[0.3deg]">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-black uppercase text-[var(--mb-text-dim)] tracking-wider [font-family:var(--mb-font-display)] flex items-center gap-1.5">
            <BackpackIcon className="w-4 h-4" /> {t("games.tiletangle.yourRack")} ({localRack.length})
          </span>
          <div className="flex items-center gap-1.5">
            {selectedTile?.source === "rack" && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={selectedTile.tileIndex === 0}
                  onClick={() => handleMoveRackTile("left")}
                >
                  {t("games.tiletangle.moveLeft")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={selectedTile.tileIndex === localRack.length - 1}
                  onClick={() => handleMoveRackTile("right")}
                >
                  {t("games.tiletangle.moveRight")}
                </Button>
              </>
            )}
            <Button size="sm" variant="ghost" onClick={handleSort789}>
              {t("games.tiletangle.sort789")}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleSortColor}>
              {t("games.tiletangle.sortColor")}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 p-3 bg-[var(--mb-surface-3)] rounded-xl border-2 border-black min-h-[80px] items-center">
          {localRack.map((tile, rIdx) => {
            const isSelected =
              selectedTile?.source === "rack" && selectedTile.tileIndex === rIdx;

            return (
              <TileComponent
                key={`${tile.id}-${rIdx}`}
                tile={tile}
                size="md"
                selected={isSelected}
                onClick={() => handleTileSelect(tile, "rack", rIdx)}
                draggable
                onDragStart={(e) => {
                  setDraggedRackIndex(rIdx);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedRackIndex === null || draggedRackIndex === rIdx) return;
                  const nextRack = [...localRack];
                  const [moved] = nextRack.splice(draggedRackIndex, 1);
                  if (!moved) return;
                  nextRack.splice(rIdx, 0, moved);
                  setLocalRack(nextRack);
                  setSelectedTile({ source: "rack", tileIndex: rIdx, tile: moved });
                  setDraggedRackIndex(null);
                  buzz(15);
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      {isMyTurn && (
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button size="lg" variant="secondary" onClick={handleDraw} className="w-full font-black">
            {t("games.tiletangle.drawTile")}
          </Button>
          <Button size="lg" variant="primary" onClick={handleCommit} className="w-full font-black">
            {t("games.tiletangle.playTiles")}
          </Button>
        </div>
      )}
    </div>
  );
};

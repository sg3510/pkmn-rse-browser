/**
 * Move-forget chooser used by level-up/evolution move-learning flow.
 */

import { useMemo, useCallback } from 'react';
import { useMenuInput, useMenuState } from '../hooks/useMenuState';
import { menuStateManager } from '../MenuStateManager';
import { getMoveInfo, getMoveName, MOVES } from '../../data/moves';
import '../styles/move-forget-menu.css';

export function MoveForgetMenuContent() {
  const { isOpen, currentMenu, data, cursorIndex } = useMenuState();

  const pokemonName = (data.pokemonName as string | undefined) ?? 'POKeMON';
  const pokemonMoves = (data.pokemonMoves as [number, number, number, number] | undefined)
    ?? [MOVES.NONE, MOVES.NONE, MOVES.NONE, MOVES.NONE];
  const pokemonPp = (data.pokemonPp as [number, number, number, number] | undefined)
    ?? [0, 0, 0, 0];
  const moveToLearnId = (data.moveToLearnId as number | undefined) ?? MOVES.NONE;
  const onMoveSlotChosen = data.onMoveSlotChosen as ((moveSlot: number | null) => void) | undefined;

  const effectiveCursor = Math.max(0, Math.min(4, cursorIndex));
  const focusedMoveSlot = effectiveCursor < 4 ? effectiveCursor : null;

  const focusedMove = useMemo(() => {
    if (focusedMoveSlot === null) return null;
    const moveId = pokemonMoves[focusedMoveSlot] ?? MOVES.NONE;
    const moveInfo = getMoveInfo(moveId);
    return {
      id: moveId,
      name: getMoveName(moveId),
      pp: pokemonPp[focusedMoveSlot] ?? 0,
      maxPp: moveInfo?.pp ?? 0,
      type: moveInfo?.type ?? 'NORMAL',
    };
  }, [focusedMoveSlot, pokemonMoves, pokemonPp]);

  const moveToLearnInfo = getMoveInfo(moveToLearnId);

  const closeWithChoice = useCallback((slot: number | null) => {
    onMoveSlotChosen?.(slot);
    menuStateManager.close();
  }, [onMoveSlotChosen]);

  const onUp = useCallback(() => {
    const next = effectiveCursor <= 0 ? 4 : effectiveCursor - 1;
    menuStateManager.setCursor(next);
  }, [effectiveCursor]);

  const onDown = useCallback(() => {
    const next = effectiveCursor >= 4 ? 0 : effectiveCursor + 1;
    menuStateManager.setCursor(next);
  }, [effectiveCursor]);

  const onConfirm = useCallback(() => {
    if (effectiveCursor >= 4) {
      closeWithChoice(null);
      return;
    }
    closeWithChoice(effectiveCursor);
  }, [effectiveCursor, closeWithChoice]);

  const onCancel = useCallback(() => {
    closeWithChoice(null);
  }, [closeWithChoice]);

  useMenuInput({
    enabled: isOpen && currentMenu === 'moveForget',
    onUp,
    onDown,
    onConfirm,
    onCancel,
  });

  const moveRows = pokemonMoves.map((moveId, index) => {
    const moveInfo = getMoveInfo(moveId);
    return {
      slot: index,
      moveId,
      name: getMoveName(moveId),
      pp: pokemonPp[index] ?? 0,
      maxPp: moveInfo?.pp ?? 0,
      type: moveInfo?.type ?? 'NORMAL',
      selected: effectiveCursor === index,
    };
  });

  return (
    <div className="move-forget-content">
      <div className="move-forget-header">
        <div className="move-forget-title">Forget Which Move?</div>
        <div className="move-forget-subtitle">
          {pokemonName} wants to learn {getMoveName(moveToLearnId)}
        </div>
      </div>

      <div className="move-forget-body">
        <div className="move-forget-list">
          {moveRows.map((row) => (
            <button
              key={row.slot}
              className={`move-forget-row ${row.selected ? 'is-selected' : ''}`}
              onMouseEnter={() => menuStateManager.setCursor(row.slot)}
              onClick={() => closeWithChoice(row.slot)}
            >
              <span className="move-forget-cursor">{row.selected ? '▶' : ''}</span>
              <span className="move-forget-name">{row.name}</span>
              <span className="move-forget-pp">{row.pp}/{row.maxPp}</span>
            </button>
          ))}

          <button
            className={`move-forget-row move-forget-cancel ${effectiveCursor === 4 ? 'is-selected' : ''}`}
            onMouseEnter={() => menuStateManager.setCursor(4)}
            onClick={() => closeWithChoice(null)}
          >
            <span className="move-forget-cursor">{effectiveCursor === 4 ? '▶' : ''}</span>
            <span className="move-forget-name">CANCEL</span>
          </button>
        </div>

        <div className="move-forget-panel">
          <div className="move-forget-panel-block">
            <div className="move-forget-panel-label">MOVE TO LEARN</div>
            <div className="move-forget-panel-name">{getMoveName(moveToLearnId)}</div>
            <div className="move-forget-panel-meta">
              TYPE/{moveToLearnInfo?.type ?? 'NORMAL'} PP {moveToLearnInfo?.pp ?? 0}
            </div>
          </div>

          <div className="move-forget-panel-block">
            <div className="move-forget-panel-label">SELECTED MOVE</div>
            {focusedMove ? (
              <>
                <div className="move-forget-panel-name">{focusedMove.name}</div>
                <div className="move-forget-panel-meta">
                  TYPE/{focusedMove.type} PP {focusedMove.pp}/{focusedMove.maxPp}
                </div>
              </>
            ) : (
              <div className="move-forget-panel-meta">No move selected.</div>
            )}
          </div>
        </div>
      </div>

      <div className="move-forget-footer">A: Select  B: Cancel</div>
    </div>
  );
}

export default MoveForgetMenuContent;

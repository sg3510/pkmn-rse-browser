import { useEffect, useMemo, useRef, useCallback } from 'react';
import { getMenuDataFor, menuStateManager } from '../MenuStateManager';
import { useMenuInput, useMenuState } from '../hooks/useMenuState';
import '../styles/script-choice-menu.css';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rowBounds(row: number, columns: number, count: number): { start: number; end: number } {
  const start = row * columns;
  const end = Math.min(start + columns, count) - 1;
  return { start, end };
}

function navigateChoice(
  index: number,
  direction: 'up' | 'down' | 'left' | 'right',
  count: number,
  columns: number,
): number {
  if (count <= 0) {
    return 0;
  }

  if (columns <= 1) {
    if (direction === 'up') {
      return index <= 0 ? count - 1 : index - 1;
    }
    if (direction === 'down') {
      return index >= count - 1 ? 0 : index + 1;
    }
    return index;
  }

  const row = Math.floor(index / columns);
  const col = index % columns;
  const totalRows = Math.ceil(count / columns);

  if (direction === 'left' || direction === 'right') {
    const { start, end } = rowBounds(row, columns, count);
    if (direction === 'left') {
      return index > start ? index - 1 : end;
    }
    return index < end ? index + 1 : start;
  }

  const targetRow = direction === 'up'
    ? (row - 1 + totalRows) % totalRows
    : (row + 1) % totalRows;
  const { start, end } = rowBounds(targetRow, columns, count);
  return Math.min(start + col, end);
}

export function ScriptChoiceMenuContent() {
  const { isOpen, currentMenu, data, cursorIndex } = useMenuState();
  const menuData = getMenuDataFor({ currentMenu, data }, 'scriptChoice');

  const choices = menuData?.choices ?? [];
  const cancelable = menuData?.cancelable ?? true;
  const defaultIndex = clamp(menuData?.defaultIndex ?? 0, 0, Math.max(0, choices.length - 1));
  const columns = Math.max(1, menuData?.columns ?? 1);

  const initializedRef = useRef(false);

  useEffect(() => {
    if (!isOpen || currentMenu !== 'scriptChoice') {
      initializedRef.current = false;
      return;
    }
    if (!initializedRef.current) {
      menuStateManager.setCursor(defaultIndex);
      initializedRef.current = true;
    }
  }, [isOpen, currentMenu, defaultIndex]);

  const effectiveCursor = clamp(cursorIndex, 0, Math.max(0, choices.length - 1));

  useEffect(() => {
    if (!menuData?.onSelectionChange) {
      return;
    }
    if (choices.length === 0) {
      return;
    }
    menuData.onSelectionChange(effectiveCursor);
  }, [choices.length, effectiveCursor, menuData]);

  const moveCursor = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (choices.length === 0) {
      return;
    }
    const next = navigateChoice(effectiveCursor, direction, choices.length, columns);
    menuStateManager.setCursor(next);
  }, [choices.length, effectiveCursor, columns]);

  const onConfirm = useCallback(() => {
    if (choices.length === 0) {
      return;
    }
    const selected = choices[effectiveCursor];
    if (!selected || selected.disabled) {
      return;
    }
    menuStateManager.resolveAsync<'scriptChoice'>(selected.value);
  }, [choices, effectiveCursor]);

  const onCancel = useCallback(() => {
    if (!cancelable) {
      return;
    }
    menuStateManager.close();
  }, [cancelable]);

  useMenuInput({
    enabled: isOpen && currentMenu === 'scriptChoice',
    onConfirm,
    onCancel,
    onUp: () => moveCursor('up'),
    onDown: () => moveCursor('down'),
    onLeft: () => moveCursor('left'),
    onRight: () => moveCursor('right'),
  });

  const contentStyle = useMemo(() => {
    if (!menuData?.menuPosition) {
      return undefined;
    }
    return {
      position: 'absolute' as const,
      left: `${menuData.menuPosition.leftRatio * 100}%`,
      top: `${menuData.menuPosition.topRatio * 100}%`,
      transform: 'translate(0, 0)',
    };
  }, [menuData?.menuPosition]);

  const listStyle = useMemo(() => {
    if (columns <= 1) {
      return undefined;
    }
    return {
      gridTemplateColumns: `repeat(${columns}, minmax(90px, 1fr))`,
    };
  }, [columns]);

  return (
    <div className="script-choice-content" style={contentStyle}>
      {menuData?.title ? <div className="script-choice-title">{menuData.title}</div> : null}
      {menuData?.promptText ? <div className="script-choice-prompt">{menuData.promptText}</div> : null}
      <div className="script-choice-list" style={listStyle}>
        {choices.map((choice, index) => {
          const selected = index === effectiveCursor;
          return (
            <button
              key={`${choice.label}-${index}`}
              className={`script-choice-row ${selected ? 'is-selected' : ''} ${choice.disabled ? 'is-disabled' : ''}`}
              onMouseEnter={() => menuStateManager.setCursor(index)}
              onClick={() => {
                if (choice.disabled) {
                  return;
                }
                menuStateManager.resolveAsync<'scriptChoice'>(choice.value);
              }}
              disabled={choice.disabled}
            >
              <span className="script-choice-cursor">{selected ? '▶' : ''}</span>
              <span className="script-choice-label">{choice.label}</span>
            </button>
          );
        })}
      </div>
      {cancelable ? <div className="script-choice-footer">A: Select  B: Cancel</div> : null}
    </div>
  );
}

export default ScriptChoiceMenuContent;

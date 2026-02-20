import type { ReactNode } from 'react';
import type { MoveListEntry } from './MoveListModel';

interface MoveRowFieldsProps {
  move: MoveListEntry;
  nameClassName: string;
  ppClassName: string;
  ppLabelClassName?: string;
  showPpLabel?: boolean;
  typeClassName?: string;
  renderType?: (type: string) => ReactNode;
}

export function MoveRowFields({
  move,
  nameClassName,
  ppClassName,
  ppLabelClassName,
  showPpLabel = false,
  typeClassName,
  renderType,
}: MoveRowFieldsProps) {
  return (
    <>
      {renderType
        ? (typeClassName
          ? <span className={typeClassName}>{renderType(move.type)}</span>
          : renderType(move.type))
        : null}
      <span className={nameClassName}>{move.name}</span>
      <span className={ppClassName}>
        {showPpLabel && ppLabelClassName ? <span className={ppLabelClassName}>PP</span> : null}
        {formatMovePp(move)}
      </span>
    </>
  );
}

export function formatMovePp(move: Pick<MoveListEntry, 'pp' | 'maxPp'>): string {
  return `${move.pp}/${move.maxPp}`;
}

export function formatMoveTypePp(
  move: Pick<MoveListEntry, 'type' | 'pp' | 'maxPp'>,
): string {
  return `TYPE/${move.type} PP ${formatMovePp(move)}`;
}

import { useCallback } from 'react';

interface UseMoveListNavigationOptions {
  selectedIndex: number;
  setSelectedIndex: (nextIndex: number) => void;
  maxIndex: number;
  wrap?: boolean;
}

export function useMoveListNavigation({
  selectedIndex,
  setSelectedIndex,
  maxIndex,
  wrap = false,
}: UseMoveListNavigationOptions) {
  const clampIndex = useCallback((nextIndex: number): number => {
    if (maxIndex <= 0) {
      return 0;
    }

    if (wrap) {
      if (nextIndex < 0) {
        return maxIndex;
      }
      if (nextIndex > maxIndex) {
        return 0;
      }
      return nextIndex;
    }

    return Math.max(0, Math.min(maxIndex, nextIndex));
  }, [maxIndex, wrap]);

  const moveUp = useCallback(() => {
    setSelectedIndex(clampIndex(selectedIndex - 1));
  }, [clampIndex, selectedIndex, setSelectedIndex]);

  const moveDown = useCallback(() => {
    setSelectedIndex(clampIndex(selectedIndex + 1));
  }, [clampIndex, selectedIndex, setSelectedIndex]);

  return {
    moveUp,
    moveDown,
    clampIndex,
  };
}


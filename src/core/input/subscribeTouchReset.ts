export function subscribeTouchReset(reset: () => void): (() => void) | undefined {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        reset();
      }
    };

    const handleBlur = () => reset();
    const handleOrientationChange = () => reset();
    const orientationMedia = typeof window.matchMedia === 'function'
      ? window.matchMedia('(orientation: portrait)')
      : null;

    window.addEventListener('blur', handleBlur);
    window.addEventListener('orientationchange', handleOrientationChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    orientationMedia?.addEventListener('change', handleOrientationChange);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('orientationchange', handleOrientationChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      orientationMedia?.removeEventListener('change', handleOrientationChange);
      reset();
    };
}

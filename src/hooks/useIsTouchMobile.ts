import { useEffect, useState } from 'react';

const TOUCH_MEDIA_QUERY = '(hover: none) and (pointer: coarse)';

function getCurrentTouchMobileState(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(TOUCH_MEDIA_QUERY).matches;
}

export function useIsTouchMobile(): boolean {
  const [isTouchMobile, setIsTouchMobile] = useState<boolean>(() => getCurrentTouchMobileState());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQueryList = window.matchMedia(TOUCH_MEDIA_QUERY);
    const update = () => setIsTouchMobile(mediaQueryList.matches);

    update();
    mediaQueryList.addEventListener('change', update);

    return () => {
      mediaQueryList.removeEventListener('change', update);
    };
  }, []);

  return isTouchMobile;
}


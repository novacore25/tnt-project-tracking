"use client";

import { useEffect, useRef, useState } from "react";

export function useSmartRealtime(
  channelName: string,
  tables: string[],
  onPayload: (table: string, payload: any) => void,
  idleTimeoutMinutes: number = 5,
  onWakeUp?: () => void
) {
  const [isIdle, setIsIdle] = useState(false);
  const isIdleRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = () => {
    if (isIdleRef.current) {
      isIdleRef.current = false;
      setIsIdle(false);
      if (onWakeUp) onWakeUp();
    }
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    timeoutRef.current = setTimeout(() => {
      isIdleRef.current = true;
      setIsIdle(true);
    }, idleTimeoutMinutes * 60 * 1000);
  };

  useEffect(() => {
    resetTimer();

    const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    const handleActivity = () => resetTimer();

    events.forEach(event => window.addEventListener(event, handleActivity, { passive: true }));

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isIdle };
}

import { useEffect, useMemo, useRef } from "react";

/** Вызывает `callback` через `delayMs` после последнего вызова. `cancel` отменяет ожидающий вызов. */
export const useDebouncedCallback = <TArgs extends unknown[]>(callback: (...args: TArgs) => void, delayMs: number) => {
  const callbackRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return useMemo(
    () => ({
      run: (...args: TArgs) => {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          callbackRef.current(...args);
        }, delayMs);
      },
      cancel: () => {
        clearTimeout(timerRef.current);
      },
    }),
    [delayMs],
  );
};

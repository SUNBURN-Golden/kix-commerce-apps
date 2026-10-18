import { useEffect, type ComponentType, type ReactNode } from "react";
import { onScreenReady } from "./route-focus";

/**
 * Draws one screen from a reader that throws while the code loads. It sits inside a Suspense boundary the caller owns.
 * The reader is passed in so this shell file imports no screen module.
 */
export function ScreenSlot<K extends string>({ id, read }: { id: K; read: (id: K) => ComponentType }) {
  const Screen = read(id);
  return (
    <ScreenReady>
      <Screen />
    </ScreenReady>
  );
}

function ScreenReady({ children }: { children: ReactNode }) {
  useEffect(() => {
    onScreenReady();
  }, []);
  return <>{children}</>;
}

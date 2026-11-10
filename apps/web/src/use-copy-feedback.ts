import { useLayoutEffect, useRef, useState, type RefObject } from "react";

type CopyFeedback = "idle" | "selected" | "copied";

/** Clipboard feedback belongs to one committed export and one explicit activation. */
export function useCopyFeedback({ exportText, viewKey, textareaRef }: {
  exportText: string;
  viewKey: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}): { feedback: CopyFeedback; copy: () => void } {
  const [state, setState] = useState(() => ({ exportText, viewKey, owner: {}, feedback: "idle" as CopyFeedback }));
  // Reset during render so even the first commit of a changed export cannot show old success.
  // A fresh owner also fences A -> B -> A, even when A's bytes are identical.
  const valid = state.exportText === exportText && state.viewKey === viewKey;
  if (!valid) setState({ exportText, viewKey, owner: {}, feedback: "idle" });
  const { owner } = state;
  const committed = useRef<object | null>(null);
  const attempt = useRef(0);
  useLayoutEffect(() => {
    committed.current = owner;
    return () => {
      committed.current = null;
      attempt.current += 1;
    };
  }, [owner]);

  function copy() {
    const node = textareaRef.current;
    if (committed.current !== owner || !node?.isConnected) return;
    const id = ++attempt.current;
    node.focus();
    node.select();
    setState((current) => current.owner === owner ? { ...current, feedback: "selected" } : current);
    try {
      // Accessors and writeText itself may throw. Keep the receiver and call once,
      // within the user gesture. Failures leave the synchronous selection intact.
      const clipboard = navigator.clipboard;
      const writeText = clipboard?.writeText;
      if (typeof writeText !== "function") return;
      void Promise.resolve(writeText.call(clipboard, exportText)).then(() => {
        if (committed.current !== owner || attempt.current !== id) return;
        setState((current) => current.owner === owner ? { ...current, feedback: "copied" } : current);
      }, () => { /* Selection is already available; consume obsolete rejections too. */ });
    } catch {
      // Never expose platform exception text or retry a clipboard write.
    }
  }

  return { feedback: valid ? state.feedback : "idle", copy };
}

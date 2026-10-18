/** Shown while a screen's code loads. A progress note only: no heading, no animation, nothing was sent. */
export function ScreenLoading({ label }: { label: string }) {
  return (
    <p className="screen-loading" role="status" data-screen-loading>
      Loading {label}…
    </p>
  );
}

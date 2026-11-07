export function watchPatches(run: () => void): () => void {
  let frame = 0;

  const schedule = () => {
    if (frame !== 0) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      run();
    });
  };

  schedule();

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  return () => {
    observer.disconnect();
    if (frame !== 0) cancelAnimationFrame(frame);
  };
}

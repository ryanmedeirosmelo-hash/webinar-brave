/** Poll only while visible, with at most one request in flight per subscription. */
export function startVisiblePolling(
  task: () => Promise<unknown>,
  intervalMs: number,
  { immediate = false, repeat = true } = {}
): () => void {
  let stopped = false;
  let running = false;
  let completed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const clear = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const schedule = () => {
    clear();
    if (!stopped && repeat && !document.hidden) timer = setTimeout(run, intervalMs);
  };
  const run = async () => {
    if (stopped || running || document.hidden || (!repeat && completed)) return;
    clear();
    running = true;
    try {
      await task();
    } catch {
      // Keep existing data on transient failures; the next visible poll retries.
    } finally {
      running = false;
      completed = true;
      schedule();
    }
  };
  const onVisibility = () => {
    clear();
    if (!document.hidden) void run();
  };

  document.addEventListener("visibilitychange", onVisibility);
  if (immediate) void run();
  else schedule();
  return () => {
    stopped = true;
    clear();
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

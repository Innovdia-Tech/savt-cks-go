type ActivityTarget = Pick<
  EventTarget,
  "addEventListener" | "removeEventListener"
>;
/** Visibility/page lifecycle gates one deadline-based renewal, not a poll. */
export function observeCatalogueBrowsing(
  controller: { setBrowsingActive: (active: boolean) => void },
  browsing: boolean,
  environment: {
    document: ActivityTarget & { visibilityState: string };
    window: ActivityTarget;
  } = { document, window },
) {
  let pageActive = true;
  const sync = () =>
    controller.setBrowsingActive(
      browsing &&
        pageActive &&
        environment.document.visibilityState === "visible",
    );
  const hide = () => {
    pageActive = false;
    sync();
  };
  const show = () => {
    pageActive = true;
    sync();
  };
  environment.document.addEventListener("visibilitychange", sync);
  environment.window.addEventListener("pagehide", hide);
  environment.window.addEventListener("pageshow", show);
  environment.window.addEventListener("focus", sync);
  sync();
  return () => {
    environment.document.removeEventListener("visibilitychange", sync);
    environment.window.removeEventListener("pagehide", hide);
    environment.window.removeEventListener("pageshow", show);
    environment.window.removeEventListener("focus", sync);
    controller.setBrowsingActive(false);
  };
}

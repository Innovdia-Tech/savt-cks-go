import { PullRefreshGesture } from "./pull-refresh";

export function installPullRefresh(
  node: HTMLDivElement,
  options: {
    blocked: () => boolean;
    running: () => boolean;
    onPull: (distance: number) => void;
    onRefresh: () => void;
  },
) {
  const gesture = new PullRefreshGesture();
  const start = (event: TouchEvent) => {
    const touch = event.touches[0];
    const editing =
      typeof Element !== "undefined" &&
      event.target instanceof Element &&
      !!event.target.closest(
        "input, textarea, select, [contenteditable='true'], dialog",
      );
    gesture.start(
      touch?.clientX ?? 0,
      touch?.clientY ?? 0,
      node.scrollTop,
      event.touches.length === 1 &&
        !editing &&
        !options.blocked() &&
        !options.running(),
    );
  };
  const cancel = () => {
    gesture.cancel();
    options.onPull(0);
  };
  const move = (event: TouchEvent) => {
    if (event.touches.length !== 1 || options.blocked()) {
      cancel();
      return;
    }
    const touch = event.touches[0];
    const pull = gesture.move(touch.clientX, touch.clientY, node.scrollTop);
    if (pull > 0 && event.cancelable) event.preventDefault();
    options.onPull(pull);
  };
  const end = () => {
    const trigger = gesture.release();
    options.onPull(0);
    if (
      trigger &&
      !options.running() &&
      !options.blocked() &&
      node.scrollTop <= 0
    )
      options.onRefresh();
  };
  node.addEventListener("touchstart", start, { passive: true });
  node.addEventListener("touchmove", move, { passive: false });
  node.addEventListener("touchend", end);
  node.addEventListener("touchcancel", cancel);
  return () => {
    gesture.cancel();
    node.removeEventListener("touchstart", start);
    node.removeEventListener("touchmove", move);
    node.removeEventListener("touchend", end);
    node.removeEventListener("touchcancel", cancel);
  };
}

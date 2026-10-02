import { expect, it } from "vitest";
import { installPullRefresh } from "./pull-refresh-events";
function setup() {
  const node = Object.assign(new EventTarget(), { scrollTop: 0 });
  let requests = 0,
    running = false,
    blocked = false,
    distance = 0;
  const off = installPullRefresh(node as unknown as HTMLDivElement, {
    blocked: () => blocked,
    running: () => running,
    onPull: (value) => {
      distance = value;
    },
    onRefresh: () => {
      ++requests;
      running = true;
    },
  });
  const touch = (type: string, x = 0, y = 0, fingers = 1) => {
    const event = new Event(type, { cancelable: true });
    Object.defineProperty(event, "touches", {
      value: Array.from({ length: fingers }, () => ({
        clientX: x,
        clientY: y,
      })),
    });
    node.dispatchEvent(event);
    return event;
  };
  return {
    node,
    touch,
    off,
    requests: () => requests,
    distance: () => distance,
    block: () => {
      blocked = true;
    },
  };
}
it("triggers one real data-refresh callback and ignores repeated pulls while running", () => {
  const s = setup();
  s.touch("touchstart");
  expect(s.touch("touchmove", 0, 72).defaultPrevented).toBe(true);
  expect(s.distance()).toBe(72);
  s.touch("touchend");
  s.touch("touchend");
  s.touch("touchstart");
  s.touch("touchmove", 0, 90);
  s.touch("touchend");
  expect(s.requests()).toBe(1);
  expect(s.distance()).toBe(0);
  s.off();
});
it("leaves horizontal carousel movement unconsumed and never refreshes", () => {
  const s = setup();
  s.touch("touchstart");
  expect(s.touch("touchmove", 100, 10).defaultPrevented).toBe(false);
  s.touch("touchend");
  expect(s.requests()).toBe(0);
  s.off();
});
it("ignores scrolled, small and multitouch gestures, modal opens and removed listeners", () => {
  const s = setup();
  s.node.scrollTop = 1;
  s.touch("touchstart");
  s.touch("touchmove", 0, 90);
  s.touch("touchend");
  s.node.scrollTop = 0;
  s.touch("touchstart");
  s.touch("touchmove", 0, 50);
  s.touch("touchend");
  s.touch("touchstart");
  s.touch("touchmove", 0, 90, 2);
  s.touch("touchend");
  s.touch("touchstart");
  s.touch("touchmove", 0, 90);
  s.block();
  s.touch("touchend");
  s.off();
  s.touch("touchstart");
  s.touch("touchmove", 0, 90);
  s.touch("touchend");
  expect(s.requests()).toBe(0);
});

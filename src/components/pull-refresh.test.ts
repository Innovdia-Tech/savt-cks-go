import { expect, it } from "vitest";
import { PullRefreshGesture, canPullRefresh } from "./pull-refresh";
it.each([
  [10, 0, 100, true, false],
  [0, 0, 50, true, false],
  [0, 100, 20, true, false],
  [0, 5, 72, true, true],
  [0, 5, 72, false, false],
] as const)(
  "discriminates scroll, distance, axis and disabled state (%s,%s,%s,%s)",
  (top, dx, dy, enabled, expected) => {
    const gesture = new PullRefreshGesture();
    gesture.start(100, 100, top, enabled);
    gesture.move(100 + dx, 100 + dy, top);
    expect(gesture.release()).toBe(expected);
    expect(gesture.release()).toBe(false);
  },
);
it("never rearms a horizontal swipe and caps vertical feedback", () => {
  const gesture = new PullRefreshGesture();
  gesture.start(0, 0, 0, true);
  expect(gesture.move(25, 2, 0)).toBe(0);
  expect(gesture.move(30, 100, 0)).toBe(0);
  expect(gesture.release()).toBe(false);
  gesture.start(0, 0, 0, true);
  expect(gesture.move(0, 200, 0)).toBe(96);
  expect(gesture.release()).toBe(true);
});
it("cancels a gesture if the content scrolls or the touch is cancelled", () => {
  const gesture = new PullRefreshGesture();
  gesture.start(0, 0, 0, true);
  gesture.move(0, 80, 1);
  expect(gesture.release()).toBe(false);
  gesture.start(0, 0, 0, true);
  gesture.move(0, 80, 0);
  gesture.cancel();
  expect(gesture.release()).toBe(false);
});
it.each([
  ["home", "ready", false, "idle", false, true],
  ["home", "no-service", false, "idle", false, true],
  ["home", "expired", false, "idle", false, true],
  ["home", "ready", true, "idle", false, false],
  ["home", "ready", false, "pending", false, false],
  ["home", "ready", false, "opening", false, false],
  ["home", "ready", false, "idle", true, false],
  ["delivery-address/new", "ready", false, "idle", false, false],
  ["profile", "ready", false, "idle", false, false],
  ["cart", "ready", false, "idle", false, false],
  ["categories", "ready", false, "idle", false, false],
  ["home", "coordinates", false, "idle", false, false],
] as const)(
  "enables pull only on safe Home states (%s,%s,%s,%s,%s)",
  (route, phase, paymentFrozen, paymentPhase, blocked, expected) => {
    expect(
      canPullRefresh({ route, phase, paymentFrozen, paymentPhase, blocked }),
    ).toBe(expected);
  },
);

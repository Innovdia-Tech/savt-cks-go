import { expect, it, vi } from "vitest";
import { observeCatalogueBrowsing } from "./browsing-lifecycle";
it("tracks foreground, page resume and disposal without background polling", () => {
  const document = Object.assign(new EventTarget(), {
    visibilityState: "visible",
  });
  const window = new EventTarget();
  const controller = { setBrowsingActive: vi.fn() };
  const dispose = observeCatalogueBrowsing(controller, true, {
    document,
    window,
  });
  expect(controller.setBrowsingActive).toHaveBeenLastCalledWith(true);
  document.visibilityState = "hidden";
  document.dispatchEvent(new Event("visibilitychange"));
  expect(controller.setBrowsingActive).toHaveBeenLastCalledWith(false);
  document.visibilityState = "visible";
  document.dispatchEvent(new Event("visibilitychange"));
  expect(controller.setBrowsingActive).toHaveBeenLastCalledWith(true);
  window.dispatchEvent(new Event("pagehide"));
  expect(controller.setBrowsingActive).toHaveBeenLastCalledWith(false);
  window.dispatchEvent(new Event("pageshow"));
  expect(controller.setBrowsingActive).toHaveBeenLastCalledWith(true);
  dispose();
  const count = controller.setBrowsingActive.mock.calls.length;
  window.dispatchEvent(new Event("focus"));
  document.dispatchEvent(new Event("visibilitychange"));
  expect(controller.setBrowsingActive).toHaveBeenCalledTimes(count);
  expect(controller.setBrowsingActive).toHaveBeenLastCalledWith(false);
});
it("does not activate renewal on Basket, Orders or another non-browsing route", () => {
  const document = Object.assign(new EventTarget(), {
    visibilityState: "visible",
  });
  const window = new EventTarget(),
    controller = { setBrowsingActive: vi.fn() };
  const dispose = observeCatalogueBrowsing(controller, false, {
    document,
    window,
  });
  window.dispatchEvent(new Event("pageshow"));
  window.dispatchEvent(new Event("focus"));
  expect(
    controller.setBrowsingActive.mock.calls.every(
      ([active]) => active === false,
    ),
  ).toBe(true);
  dispose();
});

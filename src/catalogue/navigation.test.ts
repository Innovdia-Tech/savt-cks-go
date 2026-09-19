import { it, expect } from "vitest";
import { guardHistoryNavigation } from "./navigation";
it("holds the current screen and URL until the unsaved-address guard accepts browser navigation", () => {
  let route = "profile",
    url = "home";
  let accept: (() => void) | undefined;
  guardHistoryNavigation(
    route,
    url,
    (next) => {
      url = next;
    },
    (action) => {
      accept = action;
    },
    (next) => {
      route = next;
    },
  );
  expect(route).toBe("profile");
  expect(url).toBe("profile");
  accept?.();
  expect(route).toBe("home");
  expect(url).toBe("home");
});
it("does not open a guard for the current route", () => {
  let guarded = false;
  guardHistoryNavigation(
    "home",
    "home",
    () => {
      throw new Error("unexpected replacement");
    },
    () => {
      guarded = true;
    },
    () => {},
  );
  expect(guarded).toBe(false);
});

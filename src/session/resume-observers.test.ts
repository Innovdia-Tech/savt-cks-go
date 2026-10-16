import { expect, it, vi } from "vitest";
import type {
  CustomerSessionController,
  CustomerSessionState,
} from "./controller";
import { installSessionResumeObservers } from "./resume";

class Visibility extends EventTarget {
  visibilityState = "visible";
  set(value: string) {
    this.visibilityState = value;
    this.dispatchEvent(new Event("visibilitychange"));
  }
}

it("observes native resume and hidden/visible return without treating repeated visible/focus as a resume", () => {
  const document = new Visibility(),
    window = new EventTarget();
  const resume = vi.fn(async () => true);
  let state: CustomerSessionState = {
    phase: "authenticated",
    expiresAt: "2099-01-01T00:00:00Z",
  };
  const off = installSessionResumeObservers(document, window, {
    resume,
    getSnapshot: () => state,
  } as unknown as CustomerSessionController);
  document.set("visible");
  window.dispatchEvent(new Event("focus"));
  expect(resume).not.toHaveBeenCalled();
  document.set("hidden");
  document.set("visible");
  document.set("visible");
  expect(resume).toHaveBeenCalledOnce();
  window.dispatchEvent(
    new CustomEvent("savt-cks-go-session", { detail: { type: "resume" } }),
  );
  expect(resume).toHaveBeenCalledTimes(2);
  window.dispatchEvent(
    new CustomEvent("savt-cks-go-session", {
      detail: { type: "resume", extra: true },
    }),
  );
  expect(resume).toHaveBeenCalledTimes(2);
  window.dispatchEvent(new Event("online"));
  expect(resume).toHaveBeenCalledTimes(2);
  state = { ...state, recovery: "offline" };
  window.dispatchEvent(new Event("online"));
  expect(resume).toHaveBeenCalledTimes(3);
  state = { ...state, manualRecovery: true };
  window.dispatchEvent(new Event("online"));
  expect(resume).toHaveBeenCalledTimes(3);
  off();
  window.dispatchEvent(
    new CustomEvent("savt-cks-go-session", { detail: { type: "resume" } }),
  );
  document.set("hidden");
  document.set("visible");
  expect(resume).toHaveBeenCalledTimes(3);
});

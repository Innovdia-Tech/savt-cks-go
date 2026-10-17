import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parsePublishedPolicies,
  parseReceipt,
  parseRequirement,
  type AcceptanceRequest,
  type PolicyGateway,
  type PublishedPolicy,
  type RequiredRequirement,
} from "./contracts";
import { PolicyAcceptanceController } from "./state";

const NOW = Date.parse("2026-10-17T08:00:00.000Z");
const EXPIRES = "2026-10-17T08:05:00.000Z";
const policies = (): PublishedPolicy[] =>
  (["terms", "delivery", "cancellation-refund", "privacy"] as const).map(
    (kind) => ({
      kind,
      version: `${kind}-v1`,
      status: "published",
      publishedAt: "2026-10-15T08:00:00.000Z",
      effectiveAt: "2026-10-16T08:00:00.000Z",
      content: `Authoritative ${kind} document.`,
    }),
  );
const requirement = (): RequiredRequirement => ({
  mode: "required",
  enforcementReady: true,
  requirementId: "requirement-1",
  checkoutAttemptId: "attempt-1",
  quoteId: "quote-1",
  expiresAt: EXPIRES,
  policies: policies(),
});
const receipt = (required = requirement()) => ({
  acceptanceId: "acceptance-1",
  accepted: true as const,
  acceptedAt: "2026-10-17T07:59:59.000Z",
  expiresAt: EXPIRES,
  quoteId: required.quoteId,
  checkoutAttemptId: required.checkoutAttemptId,
  requirementId: required.requirementId,
  policies: required.policies.map(({ kind, version }) => ({ kind, version })),
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function fixture() {
  const checkoutRequirement = vi.fn(async () => requirement() as unknown);
  const recordAcceptance = vi.fn(
    async (_request: AcceptanceRequest, _signal: AbortSignal) =>
      receipt() as unknown,
  );
  const gateway: PolicyGateway = {
    listPublished: async () => policies(),
    checkoutRequirement,
    recordAcceptance,
  };
  const controller = new PolicyAcceptanceController(
    "quote-1",
    gateway,
    () => NOW,
  );
  instances.push(controller);
  return { controller, checkoutRequirement, recordAcceptance, gateway };
}
const instances: PolicyAcceptanceController[] = [];
afterEach(() => {
  instances.splice(0).forEach((controller) => controller.dispose());
  vi.useRealTimers();
});

describe("authoritative legal contracts", () => {
  it("reads only unique, published, currently effective plain text documents", () => {
    expect(parsePublishedPolicies(policies(), NOW)).toEqual(policies());
    expect(parsePublishedPolicies([], NOW)).toEqual([]);
    expect(() =>
      parsePublishedPolicies([policies()[0], policies()[0]], NOW),
    ).toThrow();
    expect(() =>
      parsePublishedPolicies({ policies: policies() }, NOW),
    ).toThrow();
  });

  it.each([
    { status: "draft" },
    { kind: "other" },
    { version: " " },
    { content: " " },
    { content: { html: "<p>Terms</p>" } },
    { effectiveAt: "2026-10-18T08:00:00.000Z" },
    { publishedAt: "2026-10-18T08:00:00.000Z" },
    { effectiveAt: "2026-02-30T08:00:00.000Z" },
    { effectiveAt: "yesterday" },
    { effectiveAt: "2026-10-16" },
  ])("rejects malformed or unpublished policy metadata %j", (patch) => {
    expect(() =>
      parsePublishedPolicies([{ ...policies()[0], ...patch }], NOW),
    ).toThrow();
  });

  it("requires an explicit inactive mode or a fully enforceable requirement", () => {
    expect(parseRequirement({ mode: "inactive" }, "quote-1", NOW)).toEqual({
      mode: "inactive",
    });
    expect(parseRequirement(requirement(), "quote-1", NOW)).toEqual(
      requirement(),
    );
    for (const patch of [
      { mode: "unknown" },
      { enforcementReady: false },
      { enforcementReady: undefined },
      { quoteId: "quote-other" },
      { checkoutAttemptId: "" },
      { requirementId: "" },
      { expiresAt: "2026-10-17T08:00:00.000Z" },
      { policies: policies().slice(0, 3) },
    ]) {
      expect(() =>
        parseRequirement({ ...requirement(), ...patch }, "quote-1", NOW),
      ).toThrow();
    }
  });

  it("requires a server receipt tied to all four current versions and IDs", () => {
    expect(parseReceipt(receipt(), requirement(), NOW)).toEqual(receipt());
    for (const patch of [
      { acceptanceId: "" },
      { accepted: false },
      { quoteId: "other" },
      { checkoutAttemptId: "other" },
      { requirementId: "other" },
      { acceptedAt: "not-a-date" },
      { acceptedAt: "2026-10-18T08:00:00.000Z" },
      { expiresAt: "2026-10-17T07:59:59.000Z" },
      { policies: receipt().policies.slice(0, 3) },
      { policies: [...receipt().policies.slice(0, 3), receipt().policies[0]] },
      {
        policies: receipt().policies.map((policy) => ({
          ...policy,
          version: "old",
        })),
      },
    ]) {
      expect(() =>
        parseReceipt({ ...receipt(), ...patch }, requirement(), NOW),
      ).toThrow();
    }
  });
});

describe("checkout policy acceptance", () => {
  it("preserves checkout when no policy gateway exists without fabricating consent", async () => {
    const controller = new PolicyAcceptanceController("quote-1");
    instances.push(controller);
    await controller.load();
    await controller.setChecked(true);
    expect(controller.getSnapshot()).toMatchObject({
      phase: "inactive",
      canProceed: true,
      checked: false,
      receipt: null,
    });
    expect(await controller.authorizeProceed()).toBe(true);
  });

  it("starts configured enforcement blocked and requires a server receipt", async () => {
    const { controller, recordAcceptance } = fixture();
    expect(controller.getSnapshot().canProceed).toBe(false);
    await controller.load();
    expect(controller.getSnapshot()).toMatchObject({
      phase: "unchecked",
      canProceed: false,
      checked: false,
    });
    await controller.setChecked(true);
    expect(recordAcceptance.mock.calls[0][0]).toEqual({
      accepted: true,
      quoteId: "quote-1",
      checkoutAttemptId: "attempt-1",
      requirementId: "requirement-1",
      policies: [
        { kind: "terms", version: "terms-v1" },
        { kind: "delivery", version: "delivery-v1" },
        { kind: "cancellation-refund", version: "cancellation-refund-v1" },
        { kind: "privacy", version: "privacy-v1" },
      ],
    });
    expect(controller.getSnapshot()).toMatchObject({
      phase: "accepted",
      canProceed: true,
      checked: true,
      receipt: { acceptanceId: "acceptance-1" },
    });
    expect(await controller.authorizeProceed()).toBe(true);
  });

  it("allows an explicit initial inactive response", async () => {
    const { controller, checkoutRequirement } = fixture();
    checkoutRequirement.mockResolvedValue({ mode: "inactive" });
    await controller.load();
    expect(controller.getSnapshot()).toMatchObject({
      phase: "inactive",
      canProceed: true,
      receipt: null,
    });
    expect(await controller.authorizeProceed()).toBe(true);
  });

  it.each([null, {}, { mode: "required" }, { ...requirement(), policies: [] }])(
    "fails closed on an invalid gateway requirement %j",
    async (value) => {
      const { controller, checkoutRequirement } = fixture();
      checkoutRequirement.mockResolvedValue(value);
      await controller.load();
      expect(controller.getSnapshot()).toMatchObject({
        phase: "error",
        canProceed: false,
        checked: false,
        receipt: null,
      });
      expect(await controller.authorizeProceed()).toBe(false);
    },
  );

  it("fails closed on gateway failure", async () => {
    const { controller, checkoutRequirement } = fixture();
    checkoutRequirement.mockRejectedValue(new Error("offline"));
    await controller.load();
    expect(controller.getSnapshot()).toMatchObject({
      phase: "error",
      canProceed: false,
    });
  });

  it("keeps checkout blocked while recording and coalesces duplicate checks", async () => {
    const { controller, recordAcceptance } = fixture();
    const pending = deferred<unknown>();
    recordAcceptance.mockReturnValue(pending.promise);
    await controller.load();
    const first = controller.setChecked(true);
    const second = controller.setChecked(true);
    expect(controller.getSnapshot()).toMatchObject({
      phase: "recording",
      checked: true,
      canProceed: false,
      receipt: null,
    });
    expect(recordAcceptance).toHaveBeenCalledTimes(1);
    pending.resolve(receipt());
    await Promise.all([first, second]);
    expect(controller.getSnapshot().canProceed).toBe(true);
  });

  it("revokes consent on uncheck and ignores late success even if the transport ignores abort", async () => {
    const { controller, recordAcceptance } = fixture();
    const pending = deferred<unknown>();
    recordAcceptance.mockReturnValue(pending.promise);
    await controller.load();
    const save = controller.setChecked(true);
    await controller.setChecked(false);
    expect(recordAcceptance.mock.calls[0][1].aborted).toBe(true);
    pending.resolve(receipt());
    await save;
    expect(controller.getSnapshot()).toMatchObject({
      phase: "unchecked",
      canProceed: false,
      checked: false,
      receipt: null,
    });
  });

  it("ignores late failure after uncheck", async () => {
    const { controller, recordAcceptance } = fixture();
    const pending = deferred<unknown>();
    recordAcceptance.mockReturnValue(pending.promise);
    await controller.load();
    const save = controller.setChecked(true);
    await controller.setChecked(false);
    pending.reject(new Error("network timeout"));
    await save;
    expect(controller.getSnapshot()).toMatchObject({
      phase: "unchecked",
      error: null,
      receipt: null,
    });
  });

  it("rejects a mismatching or missing persisted receipt", async () => {
    const { controller, recordAcceptance } = fixture();
    await controller.load();
    recordAcceptance.mockResolvedValue({ ...receipt(), quoteId: "other" });
    await controller.setChecked(true);
    expect(controller.getSnapshot()).toMatchObject({
      phase: "error",
      checked: false,
      receipt: null,
      canProceed: false,
    });
    recordAcceptance.mockResolvedValue({ accepted: true });
    await controller.setChecked(true);
    expect(controller.getSnapshot().canProceed).toBe(false);
  });

  it.each([
    { requirementId: "requirement-2" },
    { checkoutAttemptId: "attempt-2" },
    { quoteId: "quote-2" },
    { policies: policies().map((policy) => ({ ...policy, version: "v2" })) },
    {
      policies: policies().map((policy) => ({
        ...policy,
        content: "Changed document",
      })),
    },
  ])(
    "revokes consent when authorization sees changed checkout requirements %j",
    async (patch) => {
      const { controller, checkoutRequirement } = fixture();
      await controller.load();
      await controller.setChecked(true);
      checkoutRequirement.mockResolvedValue({ ...requirement(), ...patch });
      expect(await controller.authorizeProceed()).toBe(false);
      expect(controller.getSnapshot()).toMatchObject({
        canProceed: false,
        checked: false,
        receipt: null,
      });
    },
  );

  it("does not let an active requirement downgrade to inactive", async () => {
    const { controller, checkoutRequirement } = fixture();
    await controller.load();
    await controller.setChecked(true);
    checkoutRequirement.mockResolvedValue({ mode: "inactive" });
    expect(await controller.authorizeProceed()).toBe(false);
    expect(controller.getSnapshot().canProceed).toBe(false);
    await controller.load();
    expect(controller.getSnapshot().canProceed).toBe(false);
  });

  it("revalidates a previously inactive configured gateway before proceeding", async () => {
    const { controller, checkoutRequirement } = fixture();
    checkoutRequirement.mockResolvedValue({ mode: "inactive" });
    await controller.load();
    checkoutRequirement.mockResolvedValue(requirement());
    expect(await controller.authorizeProceed()).toBe(false);
    expect(controller.getSnapshot()).toMatchObject({
      phase: "unchecked",
      checked: false,
      receipt: null,
    });
  });

  it("revokes consent at receipt expiry and notifies subscribers", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const { gateway, recordAcceptance } = fixture();
    recordAcceptance.mockResolvedValue({
      ...receipt(),
      expiresAt: "2026-10-17T08:00:01.000Z",
    });
    const controller = new PolicyAcceptanceController("quote-1", gateway);
    instances.push(controller);
    const listener = vi.fn();
    controller.subscribe(listener);
    await controller.load();
    await controller.setChecked(true);
    listener.mockClear();
    await vi.advanceTimersByTimeAsync(1001);
    expect(listener).toHaveBeenCalled();
    expect(controller.getSnapshot()).toMatchObject({
      phase: "unchecked",
      checked: false,
      receipt: null,
      canProceed: false,
    });
  });

  it("checks the current clock even when a background tab has delayed its timer", async () => {
    let clock = NOW;
    const { gateway } = fixture();
    const controller = new PolicyAcceptanceController(
      "quote-1",
      gateway,
      () => clock,
    );
    instances.push(controller);
    await controller.load();
    await controller.setChecked(true);
    clock = Date.parse(EXPIRES);
    expect(await controller.authorizeProceed()).toBe(false);
    expect(controller.getSnapshot()).toMatchObject({
      checked: false,
      canProceed: false,
      receipt: null,
    });
  });

  it("does not restore consent when unchecking during authorization", async () => {
    const { controller, checkoutRequirement } = fixture();
    await controller.load();
    await controller.setChecked(true);
    const pending = deferred<unknown>();
    checkoutRequirement.mockReturnValue(pending.promise);
    const authorization = controller.authorizeProceed();
    await controller.setChecked(false);
    pending.resolve(requirement());
    expect(await authorization).toBe(false);
    expect(controller.getSnapshot()).toMatchObject({
      checked: false,
      canProceed: false,
      receipt: null,
    });
  });

  it("ignores stale loads and disposed responses", async () => {
    const { controller, checkoutRequirement, recordAcceptance } = fixture();
    const pendingLoad = deferred<unknown>();
    checkoutRequirement.mockReturnValueOnce(pendingLoad.promise);
    const staleLoad = controller.load();
    await controller.load();
    pendingLoad.resolve({ mode: "inactive" });
    await staleLoad;
    expect(controller.getSnapshot().phase).toBe("unchecked");
    const pendingSave = deferred<unknown>();
    recordAcceptance.mockReturnValue(pendingSave.promise);
    const save = controller.setChecked(true);
    controller.dispose();
    pendingSave.resolve(receipt());
    await save;
    expect(controller.getSnapshot().canProceed).toBe(false);
    expect(await controller.authorizeProceed()).toBe(false);
  });

  it("resumes after a StrictMode cleanup with fresh subscriptions and no saved consent", async () => {
    const { controller } = fixture();
    await controller.load();
    await controller.setChecked(true);
    controller.dispose();
    const listener = vi.fn();
    controller.subscribe(listener);
    controller.resume();
    expect(listener).toHaveBeenCalled();
    expect(controller.getSnapshot()).toMatchObject({
      phase: "loading",
      checked: false,
      receipt: null,
      canProceed: false,
    });
    await controller.load();
    expect(controller.getSnapshot()).toMatchObject({
      phase: "unchecked",
      checked: false,
      receipt: null,
      canProceed: false,
    });
  });

  it("restores inactive checkout on resume when no gateway is configured", async () => {
    const controller = new PolicyAcceptanceController("quote-1");
    instances.push(controller);
    controller.dispose();
    controller.resume();
    await controller.load();
    expect(controller.getSnapshot()).toMatchObject({
      phase: "inactive",
      checked: false,
      receipt: null,
      canProceed: true,
    });
    expect(await controller.authorizeProceed()).toBe(true);
  });

  it("times out a stalled requirement, aborts transport, and ignores a late response", async () => {
    vi.useFakeTimers();
    const { controller, checkoutRequirement } = fixture();
    const pending = deferred<unknown>();
    let signal: AbortSignal | undefined;
    checkoutRequirement.mockImplementation(async (...args) => {
      signal = (args as unknown as [string, AbortSignal])[1];
      return pending.promise;
    });
    const loading = controller.load();
    await vi.advanceTimersByTimeAsync(15_001);
    await loading;
    expect(controller.getSnapshot()).toMatchObject({
      phase: "error",
      checked: false,
      receipt: null,
      canProceed: false,
    });
    expect(signal?.aborted).toBe(true);
    pending.resolve({ mode: "inactive" });
    await Promise.resolve();
    expect(controller.getSnapshot().canProceed).toBe(false);
  });

  it("times out a stalled receipt and permits a fresh recording attempt", async () => {
    vi.useFakeTimers();
    const { controller, recordAcceptance } = fixture();
    await controller.load();
    recordAcceptance.mockReturnValueOnce(new Promise(() => {}));
    const recording = controller.setChecked(true);
    await vi.advanceTimersByTimeAsync(15_001);
    await recording;
    expect(controller.getSnapshot()).toMatchObject({
      phase: "error",
      checked: false,
      receipt: null,
      canProceed: false,
    });
    expect(recordAcceptance.mock.calls[0][1].aborted).toBe(true);
    await controller.setChecked(true);
    expect(controller.getSnapshot()).toMatchObject({
      phase: "accepted",
      canProceed: true,
    });
  });
});

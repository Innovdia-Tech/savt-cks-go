import { describe, expect, it, vi } from "vitest";
import {
  deliveryBackEvent,
  registerDeliveryBack,
  runDeliveryBackBridgeRequest,
} from "./delivery-back";

describe("delivery Back event ownership", () => {
  it("reports handled only when the active owner handles Back", () => {
    const target = new EventTarget();
    const ignored = registerDeliveryBack(target, () => false);
    expect(
      target.dispatchEvent(new Event(deliveryBackEvent, { cancelable: true })),
    ).toBe(true);
    ignored();

    const handled = registerDeliveryBack(target, () => true);
    expect(
      target.dispatchEvent(new Event(deliveryBackEvent, { cancelable: true })),
    ).toBe(false);
    handled();
    expect(
      target.dispatchEvent(new Event(deliveryBackEvent, { cancelable: true })),
    ).toBe(true);
  });

  it("does not invoke another owner after the event was consumed", () => {
    const target = new EventTarget();
    const laterOwner = vi.fn(() => true);
    const removeDialog = registerDeliveryBack(target, () => true, true);
    const removePage = registerDeliveryBack(target, laterOwner);

    expect(
      target.dispatchEvent(new Event(deliveryBackEvent, { cancelable: true })),
    ).toBe(false);
    expect(laterOwner).not.toHaveBeenCalled();

    removeDialog();
    removePage();
  });

  it("classifies a throwing owner as failed after preventing later owners", () => {
    const target = new EventTarget();
    const laterOwner = vi.fn(() => true);
    const reportError = vi.fn();
    const removeThrowing = registerDeliveryBack(
      target,
      () => {
        throw new Error("acted then failed");
      },
      true,
      reportError,
      500,
    );
    const removeLater = registerDeliveryBack(
      target,
      laterOwner,
      false,
      undefined,
      600,
    );

    const preflight = runDeliveryBackBridgeRequest(
      target,
      {
        protocolVersion: "2",
        operationId: 41,
        phase: "preflight",
        startedEpochMs: 900,
        deadlineEpochMs: 2_000,
      },
      1_000,
    );
    expect(preflight).toEqual({
      protocolVersion: "2",
      operationId: 41,
      phase: "preflight",
      outcome: "ready",
      ownerRevision: 2,
    });
    expect(
      runDeliveryBackBridgeRequest(
        target,
        {
          protocolVersion: "2",
          operationId: 41,
          phase: "dispatch",
          startedEpochMs: 900,
          deadlineEpochMs: 2_000,
          ownerRevision: 2,
        },
        1_000,
      ),
    ).toEqual({
      protocolVersion: "2",
      operationId: 41,
      phase: "dispatch",
      outcome: "failed",
    });
    expect(laterOwner).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledTimes(1);

    removeThrowing();
    removeLater();
  });

  it("rejects dispatch after its deadline or registration owner changes", () => {
    const target = new EventTarget();
    const owner = vi.fn(() => true);
    const remove = registerDeliveryBack(target, owner, false, undefined, 500);
    const preflight = runDeliveryBackBridgeRequest(
      target,
      {
        protocolVersion: "2",
        operationId: 7,
        phase: "preflight",
        startedEpochMs: 900,
        deadlineEpochMs: 2_000,
      },
      1_000,
    );
    expect(preflight.outcome).toBe("ready");
    remove();
    const replacement = registerDeliveryBack(target, () => true);

    expect(
      runDeliveryBackBridgeRequest(
        target,
        {
          protocolVersion: "2",
          operationId: 7,
          phase: "dispatch",
          startedEpochMs: 900,
          deadlineEpochMs: 2_000,
          ownerRevision: preflight.ownerRevision,
        },
        1_000,
      ).outcome,
    ).toBe("cancelled");
    expect(owner).not.toHaveBeenCalled();
    expect(
      runDeliveryBackBridgeRequest(
        target,
        {
          protocolVersion: "2",
          operationId: 7,
          phase: "dispatch",
          startedEpochMs: 900,
          deadlineEpochMs: 2_000,
          ownerRevision: preflight.ownerRevision,
        },
        2_000,
      ).outcome,
    ).toBe("cancelled");
    replacement();
  });

  it("lets a newer preflight invalidate an older operation", () => {
    const target = new EventTarget();
    const owner = vi.fn(() => false);
    const remove = registerDeliveryBack(target, owner, false, undefined, 500);
    const old = runDeliveryBackBridgeRequest(
      target,
      {
        protocolVersion: "2",
        operationId: 10,
        phase: "preflight",
        startedEpochMs: 900,
        deadlineEpochMs: 3_000,
      },
      1_000,
    );
    runDeliveryBackBridgeRequest(
      target,
      {
        protocolVersion: "2",
        operationId: 11,
        phase: "preflight",
        startedEpochMs: 901,
        deadlineEpochMs: 3_000,
      },
      1_000,
    );

    expect(
      runDeliveryBackBridgeRequest(
        target,
        {
          protocolVersion: "2",
          operationId: 10,
          phase: "dispatch",
          startedEpochMs: 900,
          deadlineEpochMs: 3_000,
          ownerRevision: old.ownerRevision,
        },
        1_000,
      ).outcome,
    ).toBe("cancelled");
    expect(owner).not.toHaveBeenCalled();
    remove();
  });

  it("settles each admitted operation once and binds its original deadline", () => {
    const target = new EventTarget();
    const owner = vi.fn(() => false);
    const remove = registerDeliveryBack(target, owner, false, undefined, 500);
    const preflight = runDeliveryBackBridgeRequest(
      target,
      {
        protocolVersion: "2",
        operationId: 51,
        phase: "preflight",
        startedEpochMs: 900,
        deadlineEpochMs: 2_000,
      },
      1_000,
    );
    const dispatch = {
      protocolVersion: "2" as const,
      operationId: 51,
      phase: "dispatch" as const,
      startedEpochMs: 900,
      deadlineEpochMs: 2_000,
      ownerRevision: preflight.ownerRevision,
    };

    expect(
      runDeliveryBackBridgeRequest(
        target,
        { ...dispatch, deadlineEpochMs: 9_000 },
        1_000,
      ).outcome,
    ).toBe("cancelled");
    expect(runDeliveryBackBridgeRequest(target, dispatch, 1_000).outcome).toBe(
      "cancelled",
    );
    expect(owner).not.toHaveBeenCalled();

    const nextPreflight = runDeliveryBackBridgeRequest(
      target,
      {
        protocolVersion: "2",
        operationId: 52,
        phase: "preflight",
        startedEpochMs: 901,
        deadlineEpochMs: 2_000,
      },
      1_000,
    );
    const nextDispatch = {
      protocolVersion: "2" as const,
      operationId: 52,
      phase: "dispatch" as const,
      startedEpochMs: 901,
      deadlineEpochMs: 2_000,
      ownerRevision: nextPreflight.ownerRevision,
    };
    expect(
      runDeliveryBackBridgeRequest(target, nextDispatch, 1_000).outcome,
    ).toBe("unhandled");
    expect(
      runDeliveryBackBridgeRequest(target, nextDispatch, 1_000).outcome,
    ).toBe("cancelled");
    expect(owner).toHaveBeenCalledTimes(1);
    remove();
  });

  it("cancellation tombstones an admitted operation before dispatch", () => {
    const target = new EventTarget();
    const owner = vi.fn(() => true);
    const remove = registerDeliveryBack(target, owner, false, undefined, 500);
    const preflight = runDeliveryBackBridgeRequest(
      target,
      {
        protocolVersion: "2",
        operationId: 61,
        phase: "preflight",
        startedEpochMs: 900,
        deadlineEpochMs: 2_000,
      },
      1_000,
    );

    expect(
      runDeliveryBackBridgeRequest(
        target,
        { protocolVersion: "2", operationId: 61, phase: "cancel" },
        1_000,
      ).outcome,
    ).toBe("cancelled");
    expect(
      runDeliveryBackBridgeRequest(
        target,
        {
          protocolVersion: "2",
          operationId: 61,
          phase: "dispatch",
          startedEpochMs: 900,
          deadlineEpochMs: 2_000,
          ownerRevision: preflight.ownerRevision,
        },
        1_000,
      ).outcome,
    ).toBe("cancelled");
    expect(owner).not.toHaveBeenCalled();
    remove();
  });

  it("rejects a delayed preflight after the registered owner was replaced", () => {
    const target = new EventTarget();
    const staleOwner = vi.fn(() => true);
    const removeStale = registerDeliveryBack(
      target,
      staleOwner,
      false,
      undefined,
      500,
    );
    removeStale();
    const replacement = registerDeliveryBack(
      target,
      () => true,
      false,
      undefined,
      1_100,
    );

    expect(
      runDeliveryBackBridgeRequest(
        target,
        {
          protocolVersion: "2",
          operationId: 71,
          phase: "preflight",
          startedEpochMs: 1_000,
          deadlineEpochMs: 2_000,
        },
        1_200,
      ).outcome,
    ).toBe("cancelled");
    expect(staleOwner).not.toHaveBeenCalled();
    replacement();
  });
});

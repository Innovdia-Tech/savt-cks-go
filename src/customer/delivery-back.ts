import { useLayoutEffect, useRef } from "react";

export const deliveryBackEvent = "cks-go-delivery-back";

type Admission = {
  operationId: number;
  startedEpochMs: number;
  deadlineEpochMs: number;
  ownerRevision: number;
  state: "admitted" | "settled" | "cancelled";
};

type DeliveryBackState = {
  revision: number;
  revisionChangedAtEpochMs: number;
  admission?: Admission;
};

type DeliveryBackAcknowledgement = { failed: boolean };

export type DeliveryBackPreflightRequest = {
  protocolVersion: "2";
  operationId: number;
  phase: "preflight";
  startedEpochMs: number;
  deadlineEpochMs: number;
};

export type DeliveryBackDispatchRequest = {
  protocolVersion: "2";
  operationId: number;
  phase: "dispatch";
  startedEpochMs: number;
  deadlineEpochMs: number;
  ownerRevision: number;
};

export type DeliveryBackCancelRequest = {
  protocolVersion: "2";
  operationId: number;
  phase: "cancel";
};

type DeliveryBackPreflightResponse = {
  protocolVersion: "2";
  operationId: number;
  phase: "preflight";
  outcome: "ready" | "cancelled" | "failed";
  ownerRevision: number;
};

type DeliveryBackDispatchResponse = {
  protocolVersion: "2";
  operationId: number;
  phase: "dispatch";
  outcome: "handled" | "unhandled" | "cancelled" | "failed";
};

type DeliveryBackCancelResponse = {
  protocolVersion: "2";
  operationId: number;
  phase: "cancel";
  outcome: "cancelled" | "failed";
};

const stateKey = Symbol.for("savt.cks-go.delivery-back.state.v2");
const acknowledgementKey = Symbol.for("savt.cks-go.delivery-back.ack.v2");

type StatefulTarget = EventTarget & { [stateKey]?: DeliveryBackState };
type DeliveryBackEvent = Event & {
  [acknowledgementKey]?: DeliveryBackAcknowledgement;
};

function stateFor(target: EventTarget): DeliveryBackState {
  const stateful = target as StatefulTarget;
  return (stateful[stateKey] ??= {
    revision: 0,
    revisionChangedAtEpochMs: 0,
  });
}

function exactKeys(value: unknown, expected: string[]) {
  if (typeof value !== "object" || value === null) return false;
  const keys = Object.keys(value);
  return (
    keys.length === expected.length &&
    expected.every((key) => keys.includes(key))
  );
}

function validInteger(value: unknown, allowZero = false): value is number {
  return (
    Number.isSafeInteger(value) &&
    (allowZero ? (value as number) >= 0 : (value as number) > 0)
  );
}

function failedPreflight(operationId: number, ownerRevision: number) {
  return {
    protocolVersion: "2" as const,
    operationId,
    phase: "preflight" as const,
    outcome: "failed" as const,
    ownerRevision,
  };
}

function cancelledPreflight(operationId: number, ownerRevision: number) {
  return {
    protocolVersion: "2" as const,
    operationId,
    phase: "preflight" as const,
    outcome: "cancelled" as const,
    ownerRevision,
  };
}

function failedDispatch(operationId: number) {
  return {
    protocolVersion: "2" as const,
    operationId,
    phase: "dispatch" as const,
    outcome: "failed" as const,
  };
}

function cancelledDispatch(operationId: number) {
  return {
    protocolVersion: "2" as const,
    operationId,
    phase: "dispatch" as const,
    outcome: "cancelled" as const,
  };
}

export function runDeliveryBackBridgeRequest(
  target: EventTarget,
  request: DeliveryBackPreflightRequest,
  nowEpochMs?: number,
): DeliveryBackPreflightResponse;
export function runDeliveryBackBridgeRequest(
  target: EventTarget,
  request: DeliveryBackDispatchRequest,
  nowEpochMs?: number,
): DeliveryBackDispatchResponse;
export function runDeliveryBackBridgeRequest(
  target: EventTarget,
  request: DeliveryBackCancelRequest,
  nowEpochMs?: number,
): DeliveryBackCancelResponse;
export function runDeliveryBackBridgeRequest(
  target: EventTarget,
  request: unknown,
  nowEpochMs = Date.now(),
):
  | DeliveryBackPreflightResponse
  | DeliveryBackDispatchResponse
  | DeliveryBackCancelResponse {
  const state = stateFor(target);
  const operationId =
    typeof request === "object" &&
    request !== null &&
    "operationId" in request &&
    validInteger(request.operationId)
      ? request.operationId
      : 0;
  const phase =
    typeof request === "object" && request !== null && "phase" in request
      ? request.phase
      : undefined;

  if (phase === "cancel") {
    if (
      typeof request !== "object" ||
      request === null ||
      !exactKeys(request, ["protocolVersion", "operationId", "phase"]) ||
      !validInteger(operationId) ||
      !(
        "protocolVersion" in request &&
        request.protocolVersion === "2" &&
        state.admission?.operationId === operationId &&
        state.admission.state === "admitted"
      )
    ) {
      return {
        protocolVersion: "2",
        operationId,
        phase: "cancel",
        outcome: "failed",
      };
    }
    state.admission.state = "cancelled";
    return {
      protocolVersion: "2",
      operationId,
      phase: "cancel",
      outcome: "cancelled",
    };
  }

  if (
    typeof request !== "object" ||
    request === null ||
    !("protocolVersion" in request) ||
    request.protocolVersion !== "2" ||
    !validInteger(operationId) ||
    !("startedEpochMs" in request) ||
    !validInteger(request.startedEpochMs, true) ||
    !("deadlineEpochMs" in request) ||
    !validInteger(request.deadlineEpochMs) ||
    request.startedEpochMs >= request.deadlineEpochMs
  ) {
    return phase === "preflight"
      ? failedPreflight(operationId, state.revision)
      : failedDispatch(operationId);
  }

  if (phase === "preflight") {
    if (
      !exactKeys(request, [
        "protocolVersion",
        "operationId",
        "phase",
        "startedEpochMs",
        "deadlineEpochMs",
      ])
    ) {
      return failedPreflight(operationId, state.revision);
    }
    const priorOperationId = state.admission?.operationId ?? 0;
    if (
      nowEpochMs >= request.deadlineEpochMs ||
      operationId <= priorOperationId ||
      state.revisionChangedAtEpochMs >= request.startedEpochMs
    ) {
      return cancelledPreflight(operationId, state.revision);
    }
    state.admission = {
      operationId,
      startedEpochMs: request.startedEpochMs,
      deadlineEpochMs: request.deadlineEpochMs,
      ownerRevision: state.revision,
      state: "admitted",
    };
    return {
      protocolVersion: "2",
      operationId,
      phase: "preflight",
      outcome: "ready",
      ownerRevision: state.revision,
    };
  }

  if (
    phase !== "dispatch" ||
    !exactKeys(request, [
      "protocolVersion",
      "operationId",
      "phase",
      "startedEpochMs",
      "deadlineEpochMs",
      "ownerRevision",
    ]) ||
    !("ownerRevision" in request) ||
    !validInteger(request.ownerRevision, true)
  ) {
    return failedDispatch(operationId);
  }

  const admission = state.admission;
  if (
    admission === undefined ||
    admission.operationId !== operationId ||
    admission.startedEpochMs !== request.startedEpochMs ||
    admission.deadlineEpochMs !== request.deadlineEpochMs ||
    admission.ownerRevision !== request.ownerRevision ||
    admission.state !== "admitted" ||
    nowEpochMs >= admission.deadlineEpochMs ||
    state.revision !== admission.ownerRevision ||
    state.revisionChangedAtEpochMs >= admission.startedEpochMs
  ) {
    if (admission?.operationId === operationId) admission.state = "cancelled";
    return cancelledDispatch(operationId);
  }

  admission.state = "settled";
  const event = new Event(deliveryBackEvent, {
    cancelable: true,
  }) as DeliveryBackEvent;
  const acknowledgement = { failed: false };
  event[acknowledgementKey] = acknowledgement;
  const unhandled = target.dispatchEvent(event);
  return {
    protocolVersion: "2",
    operationId,
    phase: "dispatch",
    outcome: acknowledgement.failed
      ? "failed"
      : unhandled
        ? "unhandled"
        : "handled",
  };
}

export function registerDeliveryBack(
  target: EventTarget,
  handler: () => boolean,
  capture = false,
  reportError: (error: unknown) => void = (error) => {
    if (typeof globalThis.reportError === "function")
      globalThis.reportError(error);
  },
  nowEpochMs = Date.now(),
) {
  const state = stateFor(target);
  state.revision += 1;
  state.revisionChangedAtEpochMs = nowEpochMs;
  const listener = (event: Event) => {
    if (event.defaultPrevented) return;
    try {
      if (handler()) event.preventDefault();
    } catch (error) {
      const acknowledgement = (event as DeliveryBackEvent)[acknowledgementKey];
      if (acknowledgement) acknowledgement.failed = true;
      event.preventDefault();
      event.stopImmediatePropagation();
      reportError(error);
    }
  };
  target.addEventListener(deliveryBackEvent, listener, capture);
  return () => {
    target.removeEventListener(deliveryBackEvent, listener, capture);
    state.revision += 1;
    state.revisionChangedAtEpochMs = Date.now();
  };
}

export function useDeliveryBack(
  handler: () => boolean,
  active = true,
  capture = false,
  ownerKey: unknown = null,
) {
  const current = useRef(handler);
  useLayoutEffect(() => {
    current.current = handler;
  });
  useLayoutEffect(() => {
    if (!active) return;
    return registerDeliveryBack(window, () => current.current(), capture);
  }, [active, capture, ownerKey]);
}

declare global {
  interface Window {
    __savtCksGoDeliveryBackV2?: (
      request:
        | DeliveryBackPreflightRequest
        | DeliveryBackDispatchRequest
        | DeliveryBackCancelRequest,
    ) =>
      | DeliveryBackPreflightResponse
      | DeliveryBackDispatchResponse
      | DeliveryBackCancelResponse;
  }
}

if (typeof window !== "undefined") {
  window.__savtCksGoDeliveryBackV2 = (request) =>
    runDeliveryBackBridgeRequest(window, request as never);
}

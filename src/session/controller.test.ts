import { describe, expect, it, vi } from "vitest";
import { ApiClientError, type CustomerApi } from "../api/client";
import { BridgeError, type NativeBridgePort } from "../webview/bridge";
import { CustomerSessionController } from "./controller";

const requestId = "36f34018-9c94-4b95-b4c8-608b32ae19c7";
const bootstrap = {
  protocolVersion: "1" as const,
  launchRequestId: requestId,
  state: "A".repeat(43),
  codeChallenge: "B".repeat(43),
  codeChallengeMethod: "S256" as const,
  expiresAt: "2026-09-18T12:30:00.000Z",
};
const handoff = {
  protocolVersion: "1" as const,
  launchRequestId: requestId,
  state: "A".repeat(43),
  code: "C".repeat(43),
};
const session = {
  authenticated: true as const,
  expiresAt: "2026-09-18T12:30:00.000Z",
  csrfToken: "D".repeat(43),
};

const apiFixture = (): CustomerApi => ({
  bootstrap: vi.fn().mockResolvedValue(bootstrap),
  exchange: vi.fn().mockResolvedValue(session),
  status: vi
    .fn()
    .mockRejectedValue(
      new ApiClientError("expired", "CUSTOMER_SESSION_INVALID"),
    ),
  logout: vi.fn().mockResolvedValue(undefined),
});
const bridgeFixture = (): NativeBridgePort => ({
  requestLaunchCode: vi.fn().mockResolvedValue(handoff),
  requestPaymentHandoff: vi.fn().mockResolvedValue(undefined),
  notifyLoaded: vi.fn(),
  notifyError: vi.fn(),
});

describe("CustomerSessionController", () => {
  it("restores an existing session before requesting a new launch", async () => {
    const api = apiFixture();
    vi.mocked(api.status).mockResolvedValue(session);
    const bridge = bridgeFixture();
    const controller = new CustomerSessionController(api, bridge);

    await controller.start();

    expect(controller.getSnapshot()).toEqual({
      phase: "authenticated",
      expiresAt: session.expiresAt,
    });
    expect(api.bootstrap).not.toHaveBeenCalled();
    expect(bridge.notifyLoaded).toHaveBeenCalledOnce();
  });

  it("bootstraps, requests one native code and exchanges it after an invalid stored session", async () => {
    const api = apiFixture();
    const bridge = bridgeFixture();
    const controller = new CustomerSessionController(api, bridge);

    await controller.start();

    expect(api.bootstrap).toHaveBeenCalledOnce();
    expect(bridge.requestLaunchCode).toHaveBeenCalledWith({
      protocolVersion: "1",
      launchRequestId: requestId,
      state: bootstrap.state,
      codeChallenge: bootstrap.codeChallenge,
      codeChallengeMethod: "S256",
    });
    expect(api.exchange).toHaveBeenCalledWith(handoff);
    expect(controller.getSnapshot().phase).toBe("authenticated");
  });

  it.each([
    [new ApiClientError("offline", "NETWORK_ERROR"), "offline"],
    [
      new ApiClientError("retryable", "SAVT_IDENTITY_ADAPTER_UNAVAILABLE"),
      "retryableError",
    ],
    [
      new ApiClientError("unrecoverable", "INVALID_RESPONSE"),
      "unrecoverableError",
    ],
  ])("exposes explicit status restoration failures", async (failure, phase) => {
    const api = apiFixture();
    vi.mocked(api.status).mockRejectedValue(failure);
    const controller = new CustomerSessionController(api, bridgeFixture());
    await controller.start();
    expect(controller.getSnapshot().phase).toBe(phase);
  });

  it("exposes native bridge unavailability without attempting exchange", async () => {
    const api = apiFixture();
    const bridge = bridgeFixture();
    vi.mocked(bridge.requestLaunchCode).mockRejectedValue(
      new BridgeError("unavailable"),
    );
    const controller = new CustomerSessionController(api, bridge);

    await controller.start();

    expect(controller.getSnapshot().phase).toBe("bridgeUnavailable");
    expect(api.exchange).not.toHaveBeenCalled();
  });

  it("clears in-memory CSRF state after logout and permits a fresh relaunch", async () => {
    const api = apiFixture();
    vi.mocked(api.status).mockResolvedValueOnce(session);
    const controller = new CustomerSessionController(api, bridgeFixture());
    await controller.start();

    await controller.logout();
    expect(api.logout).toHaveBeenCalledWith(session.csrfToken);
    expect(controller.getSnapshot().phase).toBe("expired");

    vi.mocked(api.status).mockRejectedValueOnce(
      new ApiClientError("expired", "CUSTOMER_SESSION_INVALID"),
    );
    await controller.retry();
    expect(api.bootstrap).toHaveBeenCalledOnce();
    expect(controller.getSnapshot().phase).toBe("authenticated");
  });

  it("clears credentials on a terminal exchange failure and never touches browser storage", async () => {
    const api = apiFixture();
    vi.mocked(api.exchange).mockRejectedValue(
      new ApiClientError("expired", "CUSTOMER_LAUNCH_INVALID"),
    );
    const storage = {
      getItem: vi.fn(() => {
        throw new Error("browser storage must not be read");
      }),
      setItem: vi.fn(() => {
        throw new Error("browser storage must not be written");
      }),
    };
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: storage,
    });
    const controller = new CustomerSessionController(api, bridgeFixture());

    await controller.start();

    expect(controller.getSnapshot().phase).toBe("expired");
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });
});

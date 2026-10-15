import { describe, expect, it, vi } from "vitest";
import { ApiClientError, type CustomerApi } from "../api/client";
import type { NativeBridgePort } from "../webview/bridge";
import { CustomerSessionController } from "./controller";

const data = {
  authenticated: true as const,
  expiresAt: "2026-10-13T01:00:00.000Z",
  csrfToken: "D".repeat(43),
};
const bootstrap = {
  protocolVersion: "1" as const,
  launchRequestId: "36f34018-9c94-4b95-b4c8-608b32ae19c7",
  state: "A".repeat(43),
  codeChallenge: "B".repeat(43),
  codeChallengeMethod: "S256" as const,
  expiresAt: data.expiresAt,
};
const expired = () => new ApiClientError("expired", "CUSTOMER_SESSION_INVALID");
function setup() {
  const calls: string[] = [];
  const api: CustomerApi = {
    status: vi.fn(async () => data),
    bootstrap: vi.fn(async () => {
      calls.push("bootstrap");
      return bootstrap;
    }),
    exchange: vi.fn(async () => {
      calls.push("exchange");
      return data;
    }),
    logout: vi.fn(async () => {}),
    requestWebOtp: vi.fn(),
    authorizeWebOtp: vi.fn(),
  };
  const bridge: NativeBridgePort = {
    requestLaunchCode: vi.fn(async () => {
      calls.push("handoff");
      return {
        protocolVersion: "1" as const,
        launchRequestId: bootstrap.launchRequestId,
        state: bootstrap.state,
        code: "C".repeat(43),
      };
    }),
    requestSessionRecovery: vi.fn(async () => {
      calls.push("native-grant");
    }),
    notifySessionValidated: vi.fn(),
    requestPaymentHandoff: vi.fn(),
    notifyLoaded: vi.fn(),
    notifyError: vi.fn(),
  };
  const controller = new CustomerSessionController(api, bridge, {
    entryMode: "embedded",
  });
  return { api, bridge, controller, calls };
}

describe("Android idle resume", () => {
  it("does not turn the first expired browsing response into terminal bridge failure or replay it", async () => {
    const { api, bridge, controller, calls } = setup();
    await controller.start();
    vi.mocked(api.status).mockRejectedValueOnce(expired());
    const read = vi.fn(async () => {
      throw expired();
    });
    await expect(controller.withCredentials(read)).rejects.toMatchObject({
      code: "CUSTOMER_SESSION_INVALID",
    });
    for (let i = 0; i < 20; i++) await Promise.resolve();
    expect(controller.getSnapshot().phase).toBe("authenticated");
    expect(bridge.notifyError).not.toHaveBeenCalled();
    expect(read).toHaveBeenCalledOnce();
    expect(calls).toEqual(["native-grant", "bootstrap", "handoff", "exchange"]);
  });
  it("validates short lock/unlock without another handoff or losing credentials", async () => {
    const { api, bridge, controller } = setup();
    await controller.start();
    expect(await controller.resume()).toBe(true);
    expect(controller.getSnapshot()).toEqual({
      phase: "authenticated",
      expiresAt: data.expiresAt,
    });
    expect(await controller.withCredentials(async (token) => token)).toBe(
      data.csrfToken,
    );
    expect(api.bootstrap).not.toHaveBeenCalled();
    expect(bridge.requestSessionRecovery).not.toHaveBeenCalled();
  });

  it("recovers a 16-minute idle 401 only after native approval and preserves the authenticated tree", async () => {
    const { api, bridge, controller, calls } = setup();
    await controller.start();
    const phases: string[] = [];
    controller.subscribe(() => phases.push(controller.getSnapshot().phase));
    vi.mocked(api.status).mockRejectedValueOnce(expired());
    expect(await controller.resume()).toBe(true);
    expect(calls).toEqual(["native-grant", "bootstrap", "handoff", "exchange"]);
    expect(phases.every((phase) => phase === "authenticated")).toBe(true);
    expect(bridge.notifyError).not.toHaveBeenCalled();
    expect(await controller.withCredentials(async (token) => token)).toBe(
      data.csrfToken,
    );
  });

  it("retains offline state without consuming native authorization and recovers when online", async () => {
    const { api, bridge, controller } = setup();
    await controller.start();
    vi.mocked(api.status).mockRejectedValueOnce(
      new ApiClientError("offline", "NETWORK_ERROR"),
    );
    expect(await controller.resume()).toBe(false);
    expect(controller.getSnapshot()).toMatchObject({
      phase: "authenticated",
      recovery: "offline",
    });
    const mutation = vi.fn(async () => "unsafe");
    await expect(controller.withCredentials(mutation)).rejects.toMatchObject({
      code: "CUSTOMER_SESSION_INVALID",
    });
    expect(mutation).not.toHaveBeenCalled();
    expect(bridge.requestSessionRecovery).not.toHaveBeenCalled();
    vi.mocked(api.status).mockRejectedValueOnce(expired());
    expect(await controller.resume()).toBe(true);
    expect(bridge.requestSessionRecovery).toHaveBeenCalledOnce();
  });

  it("coalesces foreground and concurrent 401s and refuses a recovery loop", async () => {
    const { api, bridge, controller } = setup();
    await controller.start();
    vi.mocked(api.status).mockRejectedValue(expired());
    const a = controller.resume();
    const b = controller.resume();
    expect(a).toBe(b);
    expect(await a).toBe(true);
    expect(await controller.resume()).toBe(false);
    expect(controller.getSnapshot()).toMatchObject({ recovery: "failed" });
    expect(bridge.requestSessionRecovery).toHaveBeenCalledOnce();
    expect(api.exchange).toHaveBeenCalledOnce();
  });

  it("does not bootstrap after native refuses the grant", async () => {
    const { api, bridge, controller } = setup();
    await controller.start();
    vi.mocked(api.status).mockRejectedValueOnce(expired());
    vi.mocked(bridge.requestSessionRecovery!).mockRejectedValueOnce(
      new ApiClientError("expired", "SAVT_IDENTITY_INVALID"),
    );
    expect(await controller.resume()).toBe(false);
    expect(controller.getSnapshot()).toMatchObject({ recovery: "signIn" });
    expect(api.bootstrap).not.toHaveBeenCalled();
    expect(bridge.notifyError).not.toHaveBeenCalled();
  });

  it("fences logout/account boundaries while a native grant is delayed", async () => {
    const { api, bridge, controller } = setup();
    await controller.start();
    vi.mocked(api.status).mockRejectedValueOnce(expired());
    let grant!: () => void;
    vi.mocked(bridge.requestSessionRecovery!).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          grant = resolve;
        }),
    );
    const recovery = controller.resume();
    await Promise.resolve();
    await controller.logout();
    grant();
    expect(await recovery).toBe(false);
    expect(controller.getSnapshot().phase).toBe("expired");
    expect(api.bootstrap).not.toHaveBeenCalled();
  });

  it("does not fence a successful already-started operation on a valid short resume", async () => {
    const { api, controller } = setup();
    await controller.start();
    let finish!: () => void;
    const operation = controller.withCredentials(
      () =>
        new Promise<string>((resolve) => {
          finish = () => resolve("completed-once");
        }),
    );
    const validation = controller.resume();
    finish();
    expect(await operation).toBe("completed-once");
    expect(await validation).toBe(true);
    expect(api.bootstrap).not.toHaveBeenCalled();
  });

  it("holds a late operation result until positive validation completes", async () => {
    const { api, controller } = setup();
    await controller.start();
    let finishStatus!: () => void;
    vi.mocked(api.status).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishStatus = () => resolve(data);
        }),
    );
    let finishOperation!: () => void;
    const released = vi.fn();
    const operation = controller
      .withCredentials(
        () =>
          new Promise<string>((resolve) => {
            finishOperation = () => resolve("completed");
          }),
      )
      .then(released);
    const resume = controller.resume();
    finishOperation();
    await Promise.resolve();
    await Promise.resolve();
    expect(released).not.toHaveBeenCalled();
    finishStatus();
    await resume;
    await operation;
    expect(released).toHaveBeenCalledWith("completed");
  });

  it("requires explicit retry after a post-grant network failure and uses a fresh attempt", async () => {
    const { api, bridge, controller } = setup();
    await controller.start();
    vi.mocked(api.status).mockRejectedValue(expired());
    vi.mocked(api.bootstrap).mockRejectedValueOnce(
      new ApiClientError("offline", "NETWORK_ERROR"),
    );
    expect(await controller.resume()).toBe(false);
    expect(controller.getSnapshot()).toMatchObject({
      recovery: "offline",
      manualRecovery: true,
    });
    expect(await controller.resume()).toBe(false);
    expect(bridge.requestSessionRecovery).toHaveBeenCalledOnce();
    expect(await controller.resume({ retry: true })).toBe(true);
    expect(bridge.requestSessionRecovery).toHaveBeenLastCalledWith({
      retry: true,
    });
    expect(bridge.requestSessionRecovery).toHaveBeenCalledTimes(2);
    expect(api.exchange).toHaveBeenCalledOnce();
  });
});

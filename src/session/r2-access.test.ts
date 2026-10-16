import { describe, expect, it, vi } from "vitest";
import {
  ApiClientError,
  CustomerApiClient,
  type CustomerApi,
} from "../api/client";
import { CustomerSessionController } from "./controller";
import type { NativeBridgePort } from "../webview/bridge";

const session = {
  authenticated: true as const,
  expiresAt: "2026-10-16T00:00:00.000Z",
  csrfToken: "C".repeat(43),
};
const bootstrap = {
  protocolVersion: "1" as const,
  launchRequestId: "36f34018-9c94-4b95-b4c8-608b32ae19c7",
  state: "A".repeat(43),
  codeChallenge: "B".repeat(43),
  codeChallengeMethod: "S256" as const,
  expiresAt: session.expiresAt,
};
const expired = () => new ApiClientError("expired", "CUSTOMER_SESSION_INVALID");
function setup(mode: "embedded" | "standalone" = "standalone") {
  const api = {
    capabilities: vi.fn(async () => ({
      nativeSessionHandoff: true,
      browserOtpEnabled: false,
      paymentCreateEnabled: true,
    })),
    status: vi.fn(async () => {
      throw expired();
    }),
    bootstrap: vi.fn(async () => bootstrap),
    exchange: vi.fn(async () => session),
    requestWebOtp: vi.fn(),
    authorizeWebOtp: vi.fn(),
    logout: vi.fn(),
  };
  const bridge: NativeBridgePort = {
    requestLaunchCode: vi.fn(async () => ({
      protocolVersion: "1" as const,
      launchRequestId: bootstrap.launchRequestId,
      state: bootstrap.state,
      code: "D".repeat(43),
    })),
    requestSessionRecovery: vi.fn(async () => {}),
    notifySessionRecoveryFailed: vi.fn(),
    requestPaymentHandoff: vi.fn(),
    notifyError: vi.fn(),
    notifyLoaded: vi.fn(),
  };
  const controller = new CustomerSessionController(api as CustomerApi, bridge, {
    entryMode: mode,
  });
  return { api, bridge, controller };
}

describe("R2 truthful browser access", () => {
  it("does not bootstrap or offer OTP when server says browser authentication is disabled", async () => {
    const { api, bridge, controller } = setup();
    await controller.start();
    expect(controller.getSnapshot()).toMatchObject({
      phase: "browserUnavailable",
      reason: "disabled",
    });
    expect(api.bootstrap).not.toHaveBeenCalled();
    expect(api.requestWebOtp).not.toHaveBeenCalled();
    expect(bridge.requestLaunchCode).not.toHaveBeenCalled();
  });
  it("fails closed when the older API has no capability endpoint", async () => {
    const { api, controller } = setup();
    api.capabilities.mockRejectedValueOnce(
      new ApiClientError("unrecoverable", "HTTP_404"),
    );
    await controller.start();
    expect(controller.getSnapshot()).toMatchObject({
      phase: "browserUnavailable",
      reason: "unverified",
    });
    expect(api.bootstrap).not.toHaveBeenCalled();
  });
  it("distinguishes offline capability checks from disabled browser access", async () => {
    const { api, controller } = setup();
    api.capabilities.mockRejectedValueOnce(
      new ApiClientError("offline", "NETWORK_ERROR"),
    );
    await controller.start();
    expect(controller.getSnapshot()).toEqual({ phase: "offline" });
  });
  it("restores a valid cookie before checking browser capability", async () => {
    const { api, controller } = setup();
    api.status.mockResolvedValueOnce(session as never);
    await controller.start();
    expect(controller.getSnapshot().phase).toBe("authenticated");
    expect(api.capabilities).not.toHaveBeenCalled();
  });
  it("reads the strict no-store capability contract without exposing identity", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            nativeSessionHandoff: true,
            browserOtpEnabled: false,
            paymentCreateEnabled: true,
          },
        }),
        { status: 200 },
      ),
    );
    const client = new CustomerApiClient("", fetcher);
    expect(
      await (
        client as CustomerApiClient & { capabilities(): Promise<unknown> }
      ).capabilities(),
    ).toEqual({
      nativeSessionHandoff: true,
      browserOtpEnabled: false,
      paymentCreateEnabled: true,
    });
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      "/api/v1/customer/session/capabilities",
    );
    expect(fetcher.mock.calls[0]?.[1]?.cache).toBe("no-store");
  });
});

describe("R2 service restart recovery", () => {
  it("allows an explicit bounded retry after post-grant service unavailability without replaying a write", async () => {
    const { api, bridge, controller } = setup("embedded");
    api.status.mockResolvedValueOnce(session as never);
    await controller.start();
    api.bootstrap.mockRejectedValueOnce(
      new ApiClientError("retryable", "SAVT_IDENTITY_ADAPTER_UNAVAILABLE"),
    );
    expect(await controller.resume()).toBe(false);
    expect(controller.getSnapshot()).toMatchObject({
      recovery: "failed",
      canRetryRecovery: true,
      manualRecovery: true,
    });
    expect(bridge.notifySessionRecoveryFailed).toHaveBeenCalledWith("network");
    expect(await controller.resume()).toBe(false);
    expect(controller.getSnapshot()).toMatchObject({
      recovery: "failed",
      canRetryRecovery: true,
      manualRecovery: true,
    });
    expect(bridge.requestSessionRecovery).toHaveBeenCalledTimes(1);
    expect(await controller.resume({ retry: true })).toBe(true);
    expect(bridge.requestSessionRecovery).toHaveBeenLastCalledWith({
      retry: true,
    });
    expect(api.exchange).toHaveBeenCalledOnce();
    expect(bridge.requestPaymentHandoff).not.toHaveBeenCalled();
  });
});

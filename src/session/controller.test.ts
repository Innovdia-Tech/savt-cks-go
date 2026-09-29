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
  requestWebOtp: vi.fn().mockResolvedValue({
    otpRequestId: "O".repeat(43),
    resendAfterSeconds: 60,
  }),
  authorizeWebOtp: vi.fn().mockResolvedValue({
    protocolVersion: "1",
    code: "C".repeat(43),
    expiresAt: bootstrap.expiresAt,
  }),
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
    expect(api.requestWebOtp).not.toHaveBeenCalled();
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

describe("standalone browser OTP session", () => {
  const setup = async (now: () => number = () => 0) => {
    const api = apiFixture();
    const bridge = bridgeFixture();
    const controller = new CustomerSessionController(api, bridge, {
      entryMode: "standalone",
      now,
    });
    await controller.start();
    return { api, bridge, controller };
  };

  it("enters mobile entry after bootstrap without calling the native bridge", async () => {
    const { api, bridge, controller } = await setup();
    expect(controller.getSnapshot()).toEqual({ phase: "awaitingMobile" });
    expect(api.bootstrap).toHaveBeenCalledOnce();
    expect(bridge.requestLaunchCode).not.toHaveBeenCalled();
    expect(api.requestWebOtp).not.toHaveBeenCalled();
  });

  it("restores an existing session without entering OTP", async () => {
    const api = apiFixture();
    vi.mocked(api.status).mockResolvedValue(session);
    const bridge = bridgeFixture();
    const controller = new CustomerSessionController(api, bridge, {
      entryMode: "standalone",
    });
    await controller.start();
    expect(controller.getSnapshot().phase).toBe("authenticated");
    expect(api.bootstrap).not.toHaveBeenCalled();
    expect(api.requestWebOtp).not.toHaveBeenCalled();
  });

  it.each(["status", "bootstrap"] as const)(
    "shows pilot denial returned by %s",
    async (operation) => {
      const api = apiFixture();
      if (operation === "bootstrap")
        vi.mocked(api.bootstrap).mockRejectedValueOnce(
          new ApiClientError("unrecoverable", "CUSTOMER_PILOT_ACCESS_DENIED"),
        );
      else
        vi.mocked(api.status).mockRejectedValueOnce(
          new ApiClientError("unrecoverable", "CUSTOMER_PILOT_ACCESS_DENIED"),
        );
      const controller = new CustomerSessionController(api, bridgeFixture(), {
        entryMode: "standalone",
      });
      await controller.start();
      expect(controller.getSnapshot()).toEqual({ phase: "pilotDenied" });
      expect(api.requestWebOtp).not.toHaveBeenCalled();
    },
  );

  it("normalizes mobile on submit and keeps it out of presentation and storage", async () => {
    const { api, controller } = await setup();
    const storage = { setItem: vi.fn(), getItem: vi.fn() };
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("sessionStorage", storage);
    await controller.requestOtp("012 345 6789");
    expect(api.requestWebOtp).toHaveBeenCalledExactlyOnceWith({
      launchRequestId: requestId,
      mobileNumber: "+60123456789",
    });
    expect(controller.getSnapshot()).toEqual({
      phase: "awaitingOtp",
      resendAfterSeconds: 60,
    });
    expect(JSON.stringify(controller.getSnapshot())).not.toContain(
      "+60123456789",
    );
    expect(storage.setItem).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("rejects malformed mobile locally before calling the API", async () => {
    const { api, controller } = await setup();
    await controller.requestOtp("+44123456789");
    expect(controller.getSnapshot()).toEqual({
      phase: "awaitingMobile",
      error: "invalidMobile",
    });
    expect(api.requestWebOtp).not.toHaveBeenCalled();
  });

  it("blocks resend until the server-provided interval elapses", async () => {
    let time = 0;
    const { api, controller } = await setup(() => time);
    await controller.requestOtp("0123456789");
    expect(controller.resendRemainingSeconds()).toBe(60);
    time = 59_000;
    await controller.resendOtp();
    expect(api.requestWebOtp).toHaveBeenCalledTimes(1);
    expect(controller.resendRemainingSeconds()).toBe(1);
    time = 60_000;
    await controller.resendOtp();
    expect(api.requestWebOtp).toHaveBeenCalledTimes(2);
  });

  it("honors the server retry interval after a rate-limited request", async () => {
    let time = 0;
    const { api, controller } = await setup(() => time);
    vi.mocked(api.requestWebOtp).mockRejectedValueOnce(
      new ApiClientError(
        "retryable",
        "CUSTOMER_OTP_RATE_LIMITED",
        undefined,
        30,
      ),
    );
    await controller.requestOtp("0123456789");
    expect(controller.getSnapshot()).toMatchObject({
      phase: "awaitingMobile",
      error: "rateLimited",
    });
    expect(controller.retryRemainingSeconds()).toBe(30);
    await controller.requestOtp("0123456789");
    expect(api.requestWebOtp).toHaveBeenCalledTimes(1);
    time = 30_000;
    await controller.requestOtp("0123456789");
    expect(api.requestWebOtp).toHaveBeenCalledTimes(2);
  });

  it("sends six digits and the exact bootstrap binding into the existing exchange", async () => {
    const { api, controller, bridge } = await setup();
    await controller.requestOtp("0123456789");
    await controller.verifyOtp("12345");
    expect(controller.getSnapshot()).toMatchObject({
      phase: "awaitingOtp",
      error: "invalidCode",
    });
    expect(api.authorizeWebOtp).not.toHaveBeenCalled();
    await controller.verifyOtp("123456");
    expect(api.authorizeWebOtp).toHaveBeenCalledExactlyOnceWith({
      protocolVersion: "1",
      otpRequestId: "O".repeat(43),
      launchRequestId: requestId,
      state: bootstrap.state,
      codeChallenge: bootstrap.codeChallenge,
      codeChallengeMethod: "S256",
      otp: "123456",
    });
    expect(api.exchange).toHaveBeenCalledExactlyOnceWith(handoff);
    expect(controller.getSnapshot()).toEqual({
      phase: "authenticated",
      expiresAt: session.expiresAt,
    });
    expect(bridge.notifyLoaded).toHaveBeenCalledOnce();
    expect(JSON.stringify(controller.getSnapshot())).not.toContain("123456");
  });

  it.each([
    ["CUSTOMER_OTP_INVALID", "invalid"],
    ["CUSTOMER_OTP_RATE_LIMITED", "rateLimited"],
    ["CUSTOMER_OTP_UNAVAILABLE", "unavailable"],
  ] as const)("maps %s to safe OTP feedback", async (code, expected) => {
    const { api, controller } = await setup();
    await controller.requestOtp("0123456789");
    vi.mocked(api.authorizeWebOtp).mockRejectedValueOnce(
      new ApiClientError("retryable", code),
    );
    await controller.verifyOtp("123456");
    expect(controller.getSnapshot()).toMatchObject({
      phase: "awaitingOtp",
      error: expected,
    });
    expect(api.exchange).not.toHaveBeenCalled();
  });

  it("shows pilot denial without exposing member details", async () => {
    const { api, controller } = await setup();
    await controller.requestOtp("0123456789");
    vi.mocked(api.authorizeWebOtp).mockRejectedValueOnce(
      new ApiClientError("unrecoverable", "CUSTOMER_PILOT_ACCESS_DENIED"),
    );
    await controller.verifyOtp("123456");
    expect(controller.getSnapshot()).toEqual({ phase: "pilotDenied" });
    expect(api.exchange).not.toHaveBeenCalled();
  });

  it.each(["request", "resend"] as const)(
    "shows pilot denial from OTP %s",
    async (operation) => {
      let time = 0;
      const { api, controller } = await setup(() => time);
      if (operation === "resend") {
        await controller.requestOtp("0123456789");
        time = 60_000;
      }
      vi.mocked(api.requestWebOtp).mockRejectedValueOnce(
        new ApiClientError("unrecoverable", "CUSTOMER_PILOT_ACCESS_DENIED"),
      );
      if (operation === "request") await controller.requestOtp("0123456789");
      else await controller.resendOtp();
      expect(controller.getSnapshot()).toEqual({ phase: "pilotDenied" });
    },
  );

  it("restarts bootstrap after a stale launch response", async () => {
    const { api, controller } = await setup();
    vi.mocked(api.requestWebOtp).mockRejectedValueOnce(
      new ApiClientError("expired", "CUSTOMER_LAUNCH_INVALID"),
    );
    await controller.requestOtp("0123456789");
    expect(api.bootstrap).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot()).toEqual({ phase: "awaitingMobile" });
  });

  it("fences an old OTP response after a newer bootstrap", async () => {
    const { api, controller } = await setup();
    let complete!: (value: {
      otpRequestId: string;
      resendAfterSeconds: number;
    }) => void;
    vi.mocked(api.requestWebOtp).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const oldRequest = controller.requestOtp("0123456789");
    await controller.retry();
    complete({ otpRequestId: "O".repeat(43), resendAfterSeconds: 60 });
    await oldRequest;
    expect(controller.getSnapshot()).toEqual({ phase: "awaitingMobile" });
    expect(api.authorizeWebOtp).not.toHaveBeenCalled();
  });

  it("prevents duplicate verify and fences a late authorize result", async () => {
    const { api, controller } = await setup();
    await controller.requestOtp("0123456789");
    let complete!: (value: {
      protocolVersion: "1";
      code: string;
      expiresAt: string;
    }) => void;
    vi.mocked(api.authorizeWebOtp).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const first = controller.verifyOtp("123456");
    await controller.verifyOtp("123456");
    expect(api.authorizeWebOtp).toHaveBeenCalledTimes(1);
    await controller.retry();
    complete({
      protocolVersion: "1",
      code: "C".repeat(43),
      expiresAt: bootstrap.expiresAt,
    });
    await first;
    expect(api.exchange).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toEqual({ phase: "awaitingMobile" });
  });

  it("fences a late exchange response after a newer bootstrap", async () => {
    const { api, controller } = await setup();
    await controller.requestOtp("0123456789");
    let complete!: (value: typeof session) => void;
    vi.mocked(api.exchange).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const pending = controller.verifyOtp("123456");
    await Promise.resolve();
    await controller.retry();
    complete(session);
    await pending;
    expect(controller.getSnapshot()).toEqual({ phase: "awaitingMobile" });
  });

  it("prevents duplicate OTP requests while the first is pending", async () => {
    const { api, controller } = await setup();
    let complete!: (value: {
      otpRequestId: string;
      resendAfterSeconds: number;
    }) => void;
    vi.mocked(api.requestWebOtp).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const pending = controller.requestOtp("0123456789");
    await controller.requestOtp("0123456789");
    expect(api.requestWebOtp).toHaveBeenCalledTimes(1);
    complete({ otpRequestId: "O".repeat(43), resendAfterSeconds: 60 });
    await pending;
    expect(controller.getSnapshot().phase).toBe("awaitingOtp");
  });
});

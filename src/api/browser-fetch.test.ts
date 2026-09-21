import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomerApiClient } from "./client";
import { DevelopmentCustomerApi } from "./development";
import { CustomerDataApi } from "../customer/api";
import { CustomerSessionController } from "../session/controller";
import { DevelopmentBridgeAdapter } from "../webview/bridge";
import { CatalogueApi } from "../catalogue/api";

type RecordedRequest = { url: string; init?: RequestInit };

const customerId = "11111111-1111-4111-8111-111111111111";
const addressId = "22222222-2222-4222-8222-222222222222";
const outletId = "33333333-3333-4333-8333-333333333333";
const categoryId = "44444444-4444-4444-8444-444444444444";
const productId = "55555555-5555-4555-8555-555555555555";
const outletProductId = "66666666-6666-4666-8666-666666666666";
const assignmentContextId = "A".repeat(43);
const resolvedAt = "2026-09-20T00:00:00.000Z";
const expiresAt = "2026-09-20T00:05:00.000Z";

const outlet = {
  id: outletId,
  displayReference: "CKS-01",
  displayName: "CKS Lintas",
  status: "ACTIVE",
  operatingState: "ONLINE",
  availability: "AVAILABLE",
};

const category = { id: categoryId, name: "Pantry" };
const product = {
  productId,
  outletProductId,
  name: "Rice",
  imageUrl: null,
  category,
  subcategory: null,
  brand: null,
  uom: { code: "PACK", name: "Pack" },
  packSize: "1 kg",
  sellingPriceMinor: 1290,
  currency: "MYR",
  availability: "AVAILABLE",
};

function installReceiverSensitiveFetch(
  respond: (url: string, init?: RequestInit) => Response,
): RecordedRequest[] {
  const requests: RecordedRequest[] = [];
  vi.stubGlobal("window", globalThis);
  const receiverSensitiveFetch = function (
    this: unknown,
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    if (this !== window) throw new TypeError("Illegal invocation");
    const url = String(input);
    requests.push({ url, init });
    return Promise.resolve(respond(url, init));
  } as typeof fetch;
  vi.stubGlobal("fetch", receiverSensitiveFetch);
  return requests;
}

async function authenticatedSession() {
  const session = new CustomerSessionController(
    new DevelopmentCustomerApi(false),
    new DevelopmentBridgeAdapter(true, false),
  );
  await session.start();
  return session;
}

afterEach(() => vi.unstubAllGlobals());

describe("default browser fetch receiver", () => {
  it("preserves the Window receiver for session bootstrap", async () => {
    const requests = installReceiverSensitiveFetch(() =>
      Response.json({
        data: {
          protocolVersion: "1",
          launchRequestId: "77777777-7777-4777-8777-777777777777",
          state: "B".repeat(43),
          codeChallenge: "C".repeat(43),
          codeChallengeMethod: "S256",
          expiresAt,
        },
      }),
    );

    await expect(
      new CustomerApiClient("https://api.cks.test").bootstrap(),
    ).resolves.toMatchObject({ protocolVersion: "1" });
    expect(requests).toEqual([
      {
        url: "https://api.cks.test/api/v1/customer/session/bootstrap",
        init: expect.objectContaining({
          method: "POST",
          credentials: "include",
        }),
      },
    ]);
  });

  it("preserves the Window receiver for profile and address reads", async () => {
    const requests = installReceiverSensitiveFetch((url) => {
      if (url.endsWith("/api/v1/customer/me")) {
        return Response.json({
          data: {
            id: customerId,
            savtMemberId: "SAVT-1",
            nameSnapshot: "Customer",
            phoneE164Snapshot: "+60123456789",
            membershipTier: "GOLD",
            savtMemberStatus: "ACTIVE",
            accountStatus: "ACTIVE",
            savtSyncStatus: "SYNCED",
            savtSyncedAt: resolvedAt,
          },
        });
      }
      return Response.json({
        data: [
          {
            id: addressId,
            label: "Home",
            recipientName: "Customer",
            recipientPhoneE164: "+60123456789",
            addressLine1: "Jalan Lintas",
            addressLine2: null,
            city: "Kota Kinabalu",
            state: "Sabah",
            postcode: "88300",
            countryCode: "MY",
            deliveryInstructions: null,
            latitude: 5.96,
            longitude: 116.08,
            isDefault: true,
            status: "ACTIVE",
            rowVersion: 7,
            createdAt: resolvedAt,
            updatedAt: resolvedAt,
          },
        ],
      });
    });
    const api = new CustomerDataApi(
      "https://api.cks.test",
      await authenticatedSession(),
    );

    await expect(api.profile()).resolves.toMatchObject({ id: customerId });
    await expect(api.addresses()).resolves.toMatchObject([{ id: addressId }]);
    expect(requests.map(({ url }) => url)).toEqual([
      "https://api.cks.test/api/v1/customer/me",
      "https://api.cks.test/api/v1/customer/me/addresses",
    ]);
    expect(requests.every(({ init }) => init?.credentials === "include")).toBe(
      true,
    );
  });

  it("preserves the Window receiver for assignment and catalogue reads", async () => {
    const requests = installReceiverSensitiveFetch((rawUrl) => {
      const url = new URL(rawUrl);
      if (url.pathname === "/api/v1/customer/outlet-assignment") {
        return Response.json({
          data: {
            assignmentContextId,
            customerAddressId: addressId,
            addressRowVersion: 7,
            outlet,
            resolvedAt,
            expiresAt,
          },
          meta: { asOf: resolvedAt },
        });
      }
      const meta = {
        outlet,
        assignmentContextExpiresAt: expiresAt,
        asOf: resolvedAt,
      };
      if (url.pathname.endsWith("/categories")) {
        return Response.json({
          data: [category],
          meta: {
            ...meta,
            page: 1,
            pageSize: 50,
            total: 1,
            hasNextPage: false,
          },
        });
      }
      if (url.pathname.endsWith(`/products/${outletProductId}`)) {
        return Response.json({
          data: {
            ...product,
            description: "Local catalogue product.",
            storageType: "AMBIENT",
          },
          meta,
        });
      }
      return Response.json({
        data: [product],
        meta: {
          ...meta,
          page: 1,
          pageSize: 24,
          total: 1,
          hasNextPage: false,
        },
      });
    });
    const api = new CatalogueApi(
      "https://api.cks.test",
      await authenticatedSession(),
    );

    const assignment = await api.assign({ id: addressId, rowVersion: 7 });
    await expect(api.categories(assignment)).resolves.toMatchObject({
      data: [category],
    });
    await expect(api.products(assignment, { page: 1 })).resolves.toMatchObject({
      data: [{ outletProductId }],
    });
    await expect(
      api.detail(assignment, outletProductId),
    ).resolves.toMatchObject({ data: { outletProductId } });

    expect(requests.map(({ url }) => new URL(url).pathname)).toEqual([
      "/api/v1/customer/outlet-assignment",
      `/api/v1/customer/outlets/${outletId}/categories`,
      `/api/v1/customer/outlets/${outletId}/products`,
      `/api/v1/customer/outlets/${outletId}/products/${outletProductId}`,
    ]);
    expect(requests.every(({ init }) => init?.credentials === "include")).toBe(
      true,
    );
    for (const { url, init } of requests.slice(1)) {
      expect(new Headers(init?.headers).get("X-CKS-Assignment-Context")).toBe(
        assignmentContextId,
      );
      expect(url).not.toContain(assignmentContextId);
    }
    expect(requests.some(({ url }) => /quote|payment|order/i.test(url))).toBe(
      false,
    );
  });
});

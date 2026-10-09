import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import orders from "../../verification/cat-cks-align01/handoff/order-envelopes.json";
import joint from "../../verification/cat-cks-align01/joint-envelopes.json";
import { OrdersApi } from "./api";
import { OrderDetailScreen } from "./components";
import { parseOrderDetail, type OrderDetail } from "./contracts";
import { OrdersController } from "./state";

const sources = [
  ["legacy", orders.legacy],
  ["CKS", orders.cks],
  ["persisted paid-order serializer", { data: joint.orderBeforeMasterEdit }],
] as const;

const withPostcode = (source: unknown, postcode: unknown) => {
  const envelope = structuredClone(source) as {
    data: { destination: Record<string, unknown> };
  };
  envelope.data.destination.postcode = postcode;
  return envelope;
};

describe.each(sources)("%s frozen order postcode", (_name, source) => {
  it("keeps the populated serializer snapshot unchanged", () => {
    expect(parseOrderDetail(source)).toEqual(source.data);
  });

  it("reads the backend empty-string snapshot without replacing it", () => {
    const envelope = withPostcode(source, "");
    expect(parseOrderDetail(envelope)).toEqual(envelope.data);
  });

  it.each(["1".repeat(24), " 93000 "])(
    "keeps valid populated postcode %j raw",
    (postcode) => {
      expect(
        parseOrderDetail(withPostcode(source, postcode)).destination.postcode,
      ).toBe(postcode);
    },
  );

  it.each([null, undefined, 93000, false, {}, [], " ", "1".repeat(25)])(
    "rejects unsupported postcode %j",
    (postcode) => {
      expect(() => parseOrderDetail(withPostcode(source, postcode))).toThrow(
        "Invalid customer order response.",
      );
    },
  );

  it("keeps the postcode key required", () => {
    const envelope = withPostcode(source, "");
    delete envelope.data.destination.postcode;
    expect(() => parseOrderDetail(envelope)).toThrow();
  });

  it("does not weaken other required destination text", () => {
    const envelope = withPostcode(source, "");
    envelope.data.destination.city = "";
    expect(() => parseOrderDetail(envelope)).toThrow();
  });
});

it("omits the absent postcode and its separator in paid-order delivery details", () => {
  // Isolate presentation from parsing so it also exposes the leading-space bug.
  const detail = withPostcode(orders.cks, "").data as unknown as OrderDetail;
  const controller = new OrdersController({} as OrdersApi, {
    getSnapshot: () => ({ phase: "authenticated" }),
    subscribe: () => () => {},
  });
  try {
    const html = renderToStaticMarkup(
      createElement(OrderDetailScreen, {
        state: {
          ...controller.getSnapshot(),
          detailPhase: "ready",
          detail,
        },
        controller,
        onBack() {},
      }),
    );
    expect(html).toContain(
      "<address>1 Main Street<br/>Kuching, Sarawak</address>",
    );
    expect(detail.destination.postcode).toBe("");
  } finally {
    controller.dispose();
  }
});

it("opens an already-paid empty-postcode order and reaches its eligible server receipt", async () => {
  const envelope = withPostcode({ data: joint.orderBeforeMasterEdit }, "");
  const detail = envelope.data as unknown as OrderDetail;
  const orderId = detail.orderId;
  const path = `/api/v1/orders/${orderId}/payment-receipt`;
  const documents = {
    data: {
      orderId,
      paymentReceiptAvailable: true,
      finalSalesReceiptAvailable: false,
      paymentReceipt: {
        kind: "PAYMENT_RECEIPT",
        receiptReference: detail.orderNumber,
        issuedAt: detail.milestones.paymentConfirmedAt,
        metadataPath: path,
        downloadPath: `${path}/download`,
      },
      finalSalesReceipt: null,
    },
  };
  const pdf = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55, 10, 0, 255]);
  const reads: string[] = [];
  const api = new OrdersApi(
    "",
    { withCredentials: async (action) => action("synthetic-csrf") },
    async (input, init) => {
      const route = String(input);
      if (init?.method !== "GET") throw new Error("Unexpected mutation");
      reads.push(route);
      if (route === `/api/v1/customer/orders/${orderId}`)
        return Response.json(envelope);
      if (route === `/api/v1/customer/orders/${orderId}/documents`)
        return Response.json(documents);
      if (route === `${path}/download`)
        return new Response(pdf, {
          headers: { "content-type": "application/pdf" },
        });
      throw new Error("Unexpected address/payment request");
    },
  );
  const controller = new OrdersController(api, {
    getSnapshot: () => ({ phase: "authenticated" }),
    subscribe: () => () => {},
  });
  try {
    await controller.open(orderId);
    const state = controller.getSnapshot();
    expect(state.detailPhase).toBe("ready");
    expect(state.detail?.destination.postcode).toBe("");
    expect(state.documentsPhase).toBe("ready");
    const html = renderToStaticMarkup(
      createElement(OrderDetailScreen, { state, controller, onBack() {} }),
    );
    expect(html).toContain("Download Receipt");
    expect(html).not.toContain("Order unavailable");
    expect(html).not.toContain("Download Final Sales Receipt");
    const receipt = await controller.downloadPaymentReceipt();
    expect(receipt).not.toBeNull();
    expect(new Uint8Array(await receipt!.blob.arrayBuffer())).toEqual(pdf);
    expect(reads).toEqual([
      `/api/v1/customer/orders/${orderId}`,
      `/api/v1/customer/orders/${orderId}/documents`,
      `${path}/download`,
    ]);
  } finally {
    controller.dispose();
  }
});

it.each(["payment-receipt", "receipt"])(
  "preserves server PDF bytes on the existing %s path",
  async (suffix) => {
    const orderId = orders.cks.data.orderId;
    const path = `/api/v1/orders/${orderId}/${suffix}/download`;
    const pdf = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55, 10, 0, 255]);
    const api = new OrdersApi(
      "",
      { withCredentials: async (action) => action("synthetic-csrf") },
      async (input) => {
        expect(String(input)).toBe(path);
        return new Response(pdf, {
          headers: { "content-type": "application/pdf" },
        });
      },
    );
    const blob = await (suffix === "payment-receipt"
      ? api.downloadPaymentReceipt(orderId, path)
      : api.downloadReceipt(orderId, path));
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(pdf);
  },
);

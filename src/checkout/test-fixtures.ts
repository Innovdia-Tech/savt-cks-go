const id = (digit: string) =>
  `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;

export { id };

export const quoteEnvelope = () => ({
  data: {
    quoteId: id("1"),
    quoteToken: "memory-only-quote-token",
    currency: "MYR",
    items: [
      {
        outletProductId: id("2"),
        productId: id("3"),
        skuCode: "SKU-1",
        productNameSnapshot: "Rice",
        uomCodeSnapshot: "PACK",
        uomNameSnapshot: "Pack",
        quantity: 2,
        unitPriceMinor: 450,
        lineSubtotalMinor: 900,
      },
    ],
    itemsSubtotalMinor: 900,
    discountAmountMinor: 0,
    netItemsTotalMinor: 900,
    routeDistanceMeters: 3500,
    distanceKm: 3.5,
    routeDurationSeconds: 840,
    distanceProvider: "GOOGLE_ROUTES",
    deliveryBandId: id("4"),
    deliverySlaMinutes: 25,
    preparationTargetMinutes: 30,
    minimumTravelSlaMinutes: 20,
    operationalAllowanceMinutes: 10,
    roundingIntervalMinutes: 5,
    googleEstimatedTravelMinutes: 14,
    committedTravelSlaMinutes: 25,
    estimatedTotalOrderMinutes: 55,
    baseDeliveryFeeMinor: 490,
    deliveryDiscountMinor: 0,
    finalDeliveryChargeMinor: 490,
    processingFeeBasisMinor: 1390,
    processingFee: {
      enabled: true,
      feeType: "PERCENTAGE",
      rate: "0.0300",
      fixedAmountMinor: null,
    },
    processingFeeMinor: 42,
    grandTotalMinor: 1432,
    ruleReferences: {
      scheduling: { ruleId: id("5"), version: 1 },
      deliveryPricing: { ruleId: id("6"), version: 2 },
      deliveryTiming: { ruleId: id("7"), version: 3 },
      freeDelivery: null,
      processingFee: { ruleId: id("8"), version: 4 },
      refundPolicy: { ruleId: id("9"), version: 5 },
    },
    deliveryPromotion: null,
    savtVoucher: null,
    quoteIssuedAt: "2026-09-20T04:00:00.000Z",
    quoteExpiresAt: "2026-09-20T04:10:00.000Z",
    outletId: id("a"),
    customerAddressId: id("b"),
    addressRowVersion: 7,
  },
});

export const minimumQuoteEnvelope = (basisMinor: 5000 | 10000) => {
  const amounts = {
    5000: { items: 4500, fee: 200, total: 5200 },
    10000: { items: 9500, fee: 300, total: 10300 },
  }[basisMinor];
  const value = quoteEnvelope();
  return {
    data: {
      ...value.data,
      items: [
        {
          ...value.data.items[0],
          quantity: 1,
          unitPriceMinor: amounts.items,
          lineSubtotalMinor: amounts.items,
        },
      ],
      itemsSubtotalMinor: amounts.items,
      netItemsTotalMinor: amounts.items,
      baseDeliveryFeeMinor: 500,
      finalDeliveryChargeMinor: 500,
      processingFeeBasisMinor: basisMinor,
      processingFee: {
        ...value.data.processingFee,
        minimumAmountMinor: 200,
      },
      processingFeeMinor: amounts.fee,
      grandTotalMinor: amounts.total,
    },
  };
};

export const smallOrderFee = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  feeType: "SMALL_ORDER_TIERS",
  policyKind: "SMALL_ORDER_TIERS",
  enabled: true,
  qualifyingAmountMinor: 900,
  matchedTier: { fromMinor: 0, belowMinor: 2000, chargeMinor: 150 },
  outcome: "CHARGED",
  feeFreeFromMinor: 2000,
  ...overrides,
});

const legacyFee = (overrides: Record<string, unknown> = {}) => ({
  enabled: true,
  feeType: "PERCENTAGE",
  rate: "0.0300",
  fixedAmountMinor: null,
  ...overrides,
});

export const acceptedProcessingFees: [string, Record<string, unknown>][] = [
  ["historical percentage snapshot", legacyFee()],
  [
    "historical fixed snapshot",
    legacyFee({ feeType: "FIXED", rate: null, fixedAmountMinor: 150 }),
  ],
  ["legacy minimum amount", legacyFee({ minimumAmountMinor: 100 })],
  ["nullable legacy minimum", legacyFee({ minimumAmountMinor: null })],
  ["zero legacy minimum", legacyFee({ minimumAmountMinor: 0 })],
  [
    "maximum safe legacy minimum",
    legacyFee({ minimumAmountMinor: Number.MAX_SAFE_INTEGER }),
  ],
  ["disabled percentage snapshot", legacyFee({ enabled: false, rate: null })],
  [
    "disabled fixed snapshot",
    legacyFee({ enabled: false, feeType: "FIXED", rate: null }),
  ],
  ["charged small-order snapshot", smallOrderFee()],
  [
    "zero-charge matched tier",
    smallOrderFee({
      matchedTier: { fromMinor: 0, belowMinor: 2000, chargeMinor: 0 },
      outcome: "ZERO_TIER",
    }),
  ],
  [
    "unmatched small-order snapshot without fee-free threshold",
    smallOrderFee({
      matchedTier: null,
      outcome: "NO_MATCH",
      feeFreeFromMinor: null,
    }),
  ],
  [
    "disabled small-order snapshot",
    smallOrderFee({ enabled: false, matchedTier: null, outcome: "DISABLED" }),
  ],
  [
    "zero qualifying amount and fee-free threshold",
    smallOrderFee({ qualifyingAmountMinor: 0, feeFreeFromMinor: 0 }),
  ],
  [
    "safe integer monetary boundaries",
    smallOrderFee({
      qualifyingAmountMinor: Number.MAX_SAFE_INTEGER,
      matchedTier: {
        fromMinor: Number.MAX_SAFE_INTEGER,
        belowMinor: Number.MAX_SAFE_INTEGER,
        chargeMinor: Number.MAX_SAFE_INTEGER,
      },
      feeFreeFromMinor: Number.MAX_SAFE_INTEGER,
    }),
  ],
];

const omit = (value: Record<string, unknown>, key: string) => {
  const copy = { ...value };
  delete copy[key];
  return copy;
};

const invalidAmounts: [string, unknown][] = [
  ["negative", -1],
  ["fractional", 0.5],
  ["unsafe", Number.MAX_SAFE_INTEGER + 1],
  ["string", "100"],
  ["NaN", Number.NaN],
  ["infinite", Number.POSITIVE_INFINITY],
  ["undefined", undefined],
];

export const rejectedProcessingFees: [string, unknown][] = [
  ["null snapshot", null],
  ["array snapshot", []],
  ["unknown fee type", legacyFee({ feeType: "UNKNOWN" })],
  [
    "coerced legacy fee type",
    legacyFee({ feeType: { toString: () => "PERCENTAGE" } }),
  ],
  ["expanded legacy snapshot", legacyFee({ policyKind: "PERCENTAGE" })],
  ["nonboolean legacy enabled", legacyFee({ enabled: 1 })],
  ["enabled percentage without a rate", legacyFee({ rate: null })],
  [
    "enabled percentage with a fixed amount",
    legacyFee({ fixedAmountMinor: 1 }),
  ],
  [
    "enabled fixed without an amount",
    legacyFee({ feeType: "FIXED", rate: null }),
  ],
  [
    "enabled fixed with a rate",
    legacyFee({ feeType: "FIXED", fixedAmountMinor: 150 }),
  ],
  ["expanded small-order snapshot", smallOrderFee({ rate: null })],
  ["nonboolean small-order enabled", smallOrderFee({ enabled: "true" })],
  ["incorrect policy kind", smallOrderFee({ policyKind: "PERCENTAGE" })],
  [
    "coerced policy kind",
    smallOrderFee({ policyKind: { toString: () => "SMALL_ORDER_TIERS" } }),
  ],
  [
    "coerced small-order fee type",
    smallOrderFee({ feeType: { toString: () => "SMALL_ORDER_TIERS" } }),
  ],
  ["unknown outcome", smallOrderFee({ outcome: "FREE" })],
  [
    "coerced outcome",
    smallOrderFee({ outcome: { toString: () => "CHARGED" } }),
  ],
  ["array matched tier", smallOrderFee({ matchedTier: [] })],
  ["string matched tier", smallOrderFee({ matchedTier: "none" })],
  [
    "expanded matched tier",
    smallOrderFee({
      matchedTier: {
        fromMinor: 0,
        belowMinor: 2000,
        chargeMinor: 150,
        id: "tier",
      },
    }),
  ],
  [
    "zero below amount",
    smallOrderFee({
      matchedTier: { fromMinor: 0, belowMinor: 0, chargeMinor: 0 },
    }),
  ],
  ...["enabled", "feeType", "rate", "fixedAmountMinor"].map(
    (key): [string, unknown] => [
      `missing legacy ${key}`,
      omit(legacyFee(), key),
    ],
  ),
  ...[
    "feeType",
    "policyKind",
    "enabled",
    "qualifyingAmountMinor",
    "matchedTier",
    "outcome",
    "feeFreeFromMinor",
  ].map((key): [string, unknown] => [
    `missing small-order ${key}`,
    omit(smallOrderFee(), key),
  ]),
  ...["fromMinor", "belowMinor", "chargeMinor"].map(
    (key): [string, unknown] => [
      `missing matched-tier ${key}`,
      smallOrderFee({
        matchedTier: omit(
          { fromMinor: 0, belowMinor: 2000, chargeMinor: 150 },
          key,
        ),
      }),
    ],
  ),
  ...invalidAmounts.flatMap(([name, value]): [string, unknown][] => [
    [`${name} legacy minimum`, legacyFee({ minimumAmountMinor: value })],
    [
      `${name} qualifying amount`,
      smallOrderFee({ qualifyingAmountMinor: value }),
    ],
    [`${name} fee-free threshold`, smallOrderFee({ feeFreeFromMinor: value })],
    ...["fromMinor", "belowMinor", "chargeMinor"].map(
      (key): [string, unknown] => [
        `${name} matched-tier ${key}`,
        smallOrderFee({
          matchedTier: {
            fromMinor: 0,
            belowMinor: 2000,
            chargeMinor: 150,
            [key]: value,
          },
        }),
      ],
    ),
  ]),
  ["null qualifying amount", smallOrderFee({ qualifyingAmountMinor: null })],
  ...["fromMinor", "belowMinor", "chargeMinor"].map(
    (key): [string, unknown] => [
      `null matched-tier ${key}`,
      smallOrderFee({
        matchedTier: {
          fromMinor: 0,
          belowMinor: 2000,
          chargeMinor: 150,
          [key]: null,
        },
      }),
    ],
  ),
];

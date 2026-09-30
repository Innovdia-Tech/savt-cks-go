import { describe, expect, it } from "vitest";
import { normalizeMalaysianMobile } from "./mobile";

describe("Malaysian mobile normalization", () => {
  it.each([
    ["0123456789", "+60123456789"],
    ["+60123456789", "+60123456789"],
    ["+60 12 345 6789", "+60123456789"],
    ["011-0000 0001", "+601100000001"],
  ])("normalizes %s to canonical E.164", (input, expected) => {
    expect(normalizeMalaysianMobile(input)).toBe(expected);
  });

  it.each([
    "",
    "123456789",
    "60123456789",
    "+44123456789",
    "+600123456789",
    "01234567",
    "012345678901",
    "+6012abc6789",
    "012/345/6789",
  ])("rejects ambiguous or malformed mobile %s", (input) => {
    expect(normalizeMalaysianMobile(input)).toBeNull();
  });
});

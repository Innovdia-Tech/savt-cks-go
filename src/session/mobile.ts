// Accept familiar Malaysian mobile formatting, then send only canonical E.164.
export const normalizeMalaysianMobile = (value: string): string | null => {
  const trimmed = value.trim();
  if (!/^[+0-9 -]+$/.test(trimmed)) return null;
  const compact = trimmed.replace(/[ -]/g, "");
  if (/^01\d{8,9}$/.test(compact)) return `+60${compact.slice(1)}`;
  if (/^\+601\d{8,9}$/.test(compact)) return compact;
  return null;
};

import { useEffect, useState } from "react";
import { developmentArtworkFor } from "../development-artwork";

const isReferenceUrl = (url: string | null): url is string =>
  Boolean(
    url?.startsWith("https://cks-go-development.invalid/reference-match/"),
  );

export function useProductArtworkUrl(url: string | null) {
  const [reference, setReference] = useState<{
    url: string;
    asset: string | null;
  } | null>(null);
  useEffect(() => {
    if (!import.meta.env.DEV || !isReferenceUrl(url)) return;
    let active = true;
    void import("./artwork").then(({ productArtworkFor }) => {
      if (active) setReference({ url, asset: productArtworkFor(url) });
    });
    return () => {
      active = false;
    };
  }, [url]);
  if (!import.meta.env.DEV) return url;
  if (isReferenceUrl(url))
    return reference?.url === url ? reference.asset : null;
  return developmentArtworkFor(url) ?? url;
}

export function useCategoryArtworkUrl(name?: string) {
  const [reference, setReference] = useState<{
    name: string;
    asset: string | null;
  } | null>(null);
  useEffect(() => {
    if (!import.meta.env.DEV || !name) return;
    let active = true;
    void import("./artwork").then(({ categoryArtworkFor }) => {
      if (active) setReference({ name, asset: categoryArtworkFor(name) });
    });
    return () => {
      active = false;
    };
  }, [name]);
  return import.meta.env.DEV && reference && reference.name === name
    ? reference.asset
    : null;
}

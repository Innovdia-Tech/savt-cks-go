import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { PULL_REFRESH_THRESHOLD } from "./pull-refresh";
import { installPullRefresh } from "./pull-refresh-events";

export function usePullToRefresh(
  scrollRef: RefObject<HTMLDivElement | null>,
  refresh: (() => Promise<boolean>) | undefined,
  disabled: boolean,
) {
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(false);
  const running = useRef(false);
  const refreshNow = useCallback(() => {
    if (
      !refresh ||
      disabled ||
      running.current ||
      document.querySelector("dialog[open], [role='dialog'][aria-modal='true']")
    )
      return;
    running.current = true;
    setDistance(0);
    setRefreshing(true);
    void refresh()
      .catch(() => false)
      .finally(() => {
        running.current = false;
        if (mounted.current) setRefreshing(false);
      });
  }, [refresh, disabled]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    setDistance(0);
    const node = scrollRef.current;
    if (!node || !refresh || disabled) return;
    return installPullRefresh(node, {
      blocked: () =>
        !!document.querySelector(
          "dialog[open], [role='dialog'][aria-modal='true']",
        ),
      running: () => running.current,
      onPull: setDistance,
      onRefresh: refreshNow,
    });
  }, [scrollRef, refresh, refreshNow, disabled]);
  return {
    distance,
    refreshing,
    refreshNow,
    label: refreshing
      ? "Refreshing…"
      : distance >= PULL_REFRESH_THRESHOLD
        ? "Release to refresh"
        : "Pull to refresh",
  };
}

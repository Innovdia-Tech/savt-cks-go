import { DeliveryAddressLink } from "../customer/components";
import { useEffect, useRef, type ReactNode } from "react";
import {
  BagIcon,
  ChevronLeftIcon,
  GridIcon,
  HomeIcon,
  TruckIcon,
} from "./Icons";
import type { Outlet } from "../catalogue/contracts";
import type { Screen } from "../types";
import { IconButton } from "./ui";

type AppShellProps = {
  children: ReactNode;
  active: "Home" | "Categories" | "Cart" | "Orders";
  cartCount: number;
  onNavigate: (screen: Screen) => void;
  onLogout?: () => void;
  sticky?: ReactNode;
  screenKey?: string;
  outlet?: Outlet | null;
  restoreScrollTop?: number;
  onScrollPositionChange?: (top: number) => void;
  headerContext?: ShellHeaderContext;
};

export type ShellHeaderContext =
  | "home"
  | "browse"
  | "transaction"
  | "orders";

export function AppShell({
  children,
  active,
  cartCount,
  onNavigate,
  onLogout,
  sticky,
  screenKey,
  outlet,
  restoreScrollTop,
  onScrollPositionChange,
  headerContext = screenKey === "home" ? "home" : "browse",
}: AppShellProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: restoreScrollTop ?? 0 });
  }, [screenKey, restoreScrollTop]);

  return (
    <main className="app-viewport">
      <section className="app-shell">
        <div
          ref={scrollRef}
          className={`app-shell__scroll ${sticky ? "pb-8" : "pb-6"}`}
          onScroll={(event) => {
            onScrollPositionChange?.(event.currentTarget.scrollTop);
          }}
        >
          <DeliveryHeader
            context={headerContext}
            outlet={outlet}
            onLogout={onLogout}
            onManage={() => onNavigate("profile")}
          />
          {children}
        </div>
        {sticky}
        <BottomNavigation
          active={active}
          cartCount={cartCount}
          onNavigate={onNavigate}
        />
      </section>
    </main>
  );
}

export function DeliveryHeader({
  context,
  onLogout,
  onManage,
  outlet,
  addressLink,
}: {
  context: ShellHeaderContext;
  onLogout?: () => void;
  onManage: () => void;
  outlet?: Outlet | null;
  addressLink?: ReactNode;
}) {
  const shoppingContext = context === "home" || context === "browse";
  return (
    <header className={`app-header app-header--${context}`}>
      <HeaderActions shopping={shoppingContext} onLogout={onLogout} />
      {shoppingContext &&
        (addressLink ?? <DeliveryAddressLink onManage={onManage} />)}
      {shoppingContext && outlet && (
        <AssignedOutletLine outlet={outlet} />
      )}
    </header>
  );
}

export function AssignedOutletLine({ outlet }: { outlet: Outlet }) {
  return (
    <p
      className="app-header__outlet-line"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      From {outlet.displayName}
    </p>
  );
}

export function HeaderActions({
  shopping,
  onLogout,
}: {
  shopping: boolean;
  onLogout?: () => void;
}) {
  return shopping ? (
    <div className="app-header__shopping-actions">
      <IconButton label="Back to Savt" onClick={() => window.history.back()}>
        <ChevronLeftIcon className="h-4 w-4" />
      </IconButton>
      <button
        type="button"
        aria-label="Close CKS Go"
        onClick={onLogout}
        className="app-header__exit"
      >
        Close
      </button>
    </div>
  ) : (
    <div className="app-header__bar">
      <IconButton label="Back to Savt" onClick={() => window.history.back()}>
        <ChevronLeftIcon className="h-4 w-4" />
      </IconButton>
      <span className="app-header__brand">CKS GO</span>
      <button
        type="button"
        aria-label="Log out of CKS Go"
        onClick={onLogout}
        className="app-header__exit"
      >
        Exit
      </button>
    </div>
  );
}
type BottomNavigationProps = Pick<
  AppShellProps,
  "active" | "cartCount" | "onNavigate"
>;

export function BottomNavigation({
  active,
  cartCount,
  onNavigate,
}: BottomNavigationProps) {
  const items = [
    { label: "Home", icon: HomeIcon, action: () => onNavigate("home") },
    {
      label: "Categories",
      icon: GridIcon,
      action: () => onNavigate("listing"),
    },
    {
      label: "Cart",
      icon: BagIcon,
      action: () => onNavigate("cart"),
      count: cartCount,
    },
    { label: "Orders", icon: TruckIcon, action: () => onNavigate("tracking") },
  ];

  return (
    <nav className="bottom-navigation" aria-label="Primary navigation">
      {items.map((item) => {
        const Icon = item.icon;
        const selected = active === item.label;
        return (
          <button
            key={item.label}
            type="button"
            onClick={item.action}
            className={`bottom-navigation__item ${selected ? "is-active" : ""}`}
            aria-current={selected ? "page" : undefined}
            aria-label={
              item.label === "Cart" && cartCount > 0
                ? `Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`
                : item.label
            }
          >
            <span className="bottom-navigation__icon" aria-hidden="true">
              <Icon className="h-5 w-5" />
            </span>
            <span>{item.label}</span>
            {!!item.count && item.label === "Cart" && (
              <span className="bottom-navigation__badge" aria-hidden="true">
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

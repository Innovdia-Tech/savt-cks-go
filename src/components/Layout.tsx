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
  developmentFixture?: boolean;
  title?: string;
  onBack?: () => void;
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
  developmentFixture = false,
  title,
  onBack,
}: AppShellProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: restoreScrollTop ?? 0 });
  }, [screenKey, restoreScrollTop]);

  return (
    <main className="app-viewport">
      <section className="app-shell app-shell--shopping">
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
            title={title}
            onBack={onBack}
            onCart={() => onNavigate("cart")}
            cartCount={cartCount}
            onLogout={onLogout}
            onManage={() => onNavigate("profile")}
          />
          {import.meta.env.DEV &&
            import.meta.env.VITE_CKS_GO_DEVELOPMENT_API === "true" &&
            !developmentFixture && (
              <p className="app-fixture-label">
                Development preview · sample products, address and payment
              </p>
            )}
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
  title,
  onBack,
  onCart,
  cartCount = 0,
}: {
  context: ShellHeaderContext;
  onLogout?: () => void;
  onManage: () => void;
  outlet?: Outlet | null;
  addressLink?: ReactNode;
  title?: string;
  onBack?: () => void;
  onCart?: () => void;
  cartCount?: number;
}) {
  const shoppingContext = context === "home" || context === "browse";
  return (
    <header className={`app-header app-header--${context}`}>
      <HeaderActions
        context={context}
        onLogout={onLogout}
        title={title}
        onBack={onBack}
        onCart={onCart}
        cartCount={cartCount}
      />
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
  onLogout,
  context,
  title,
  onBack,
  onCart,
  cartCount = 0,
}: {
  onLogout?: () => void;
  context?: ShellHeaderContext;
  title?: string;
  onBack?: () => void;
  onCart?: () => void;
  cartCount?: number;
}) {
  if (context === "home")
    return (
      <div className="app-header__shopping-actions app-header__shopping-actions--shopping">
        <span className="app-header__brand">CKS Go</span>
        <div className="app-header__shopping-controls">
          <button type="button" onClick={onCart} aria-label="Open cart" className="app-header__cart">
            <BagIcon className="h-5 w-5" />
            {cartCount > 0 && <span>{cartCount}</span>}
          </button>
          <button type="button" aria-label="Close CKS Go" onClick={onLogout} className="app-header__exit">
            ×
          </button>
        </div>
      </div>
    );
  return (
    <div className="app-header__bar">
      <IconButton label="Back" onClick={onBack ?? (() => window.history.back())}>
        <ChevronLeftIcon className="h-4 w-4" />
      </IconButton>
      <span className="app-header__brand">{title}</span>
      <button
        type="button"
        aria-label="Close CKS Go"
        onClick={onLogout}
        className="app-header__exit"
      >
        ×
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

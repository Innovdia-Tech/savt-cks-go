import { DeliveryAddressLink } from "../customer/components";
import { useEffect, useRef, type ReactNode } from "react";
import { BagIcon, ChevronLeftIcon, GridIcon, HomeIcon, PinIcon, ShieldIcon, TruckIcon } from "./Icons";
import type { Outlet } from "../catalogue/contracts";
import type { Screen } from "../types";

type AppShellProps = {
  children: ReactNode;
  active: "Home" | "Categories" | "Cart" | "Orders";
  cartCount: number;
  onNavigate: (screen: Screen) => void;
  onLogout?: () => void;
  sticky?: ReactNode;
  screenKey?: string;
  outlet?: Outlet | null;
};

export function AppShell({ children, active, cartCount, onNavigate, onLogout, sticky, screenKey, outlet }: AppShellProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [screenKey]);

  return (
    <main className="h-dvh overflow-hidden bg-[#EAF2ED] text-savt-ink sm:py-6">
      <section className="mx-auto flex h-full w-full max-w-[430px] flex-col overflow-hidden bg-[#F7FAF8] shadow-2xl sm:max-h-[880px] sm:rounded-[34px]">
        <div ref={scrollRef} className={`relative min-h-0 flex-1 overflow-y-auto overscroll-contain ${sticky ? "pb-8" : "pb-6"}`}>
          <DeliveryHeader outlet={outlet} onLogout={onLogout} onManage={() => onNavigate("profile")} />
          {children}
        </div>
        {sticky}
        <BottomNav active={active} cartCount={cartCount} onNavigate={onNavigate} />
      </section>
    </main>
  );
}

function DeliveryHeader({ onLogout, onManage, outlet }: { onLogout?: () => void; onManage: () => void; outlet?: Outlet | null }) {
  return <header className="z-20 border-b border-slate-100 bg-white px-5 pb-4 pt-3">
    <div className="flex min-h-11 items-center justify-between gap-3">
      <button type="button" aria-label="Back to SAVT" onClick={() => window.history.back()} className="grid h-11 w-11 place-items-center rounded-full border border-emerald-100 text-savt-dark"><ChevronLeftIcon className="h-4 w-4" /></button>
      <span className="text-[13px] font-black tracking-[0.16em]">CKS GO</span>
      <button type="button" aria-label="Log out of CKS Go" onClick={onLogout} className="min-h-11 min-w-11 text-xs font-bold text-slate-600">Exit</button>
    </div>
    <DeliveryAddressLink onManage={onManage} />
    {outlet && <div className="mt-3 rounded-2xl bg-savt-light p-3 text-savt-dark">
      <p className="break-words text-sm font-black">{outlet.displayName}</p>
      <p className="break-words text-xs font-semibold">{outlet.displayReference}</p>
      <p className="mt-1 text-xs">Assigned automatically for this address</p>
    </div>}
  </header>;
}
function BottomNav({ active, cartCount, onNavigate }: Omit<AppShellProps, "children" | "sticky">) {
  const items = [
    { label: "Home", icon: HomeIcon, action: () => onNavigate("home") },
    { label: "Categories", icon: GridIcon, action: () => onNavigate("listing") },
    { label: "Cart", icon: BagIcon, action: () => onNavigate("cart"), count: cartCount },
    { label: "Orders", icon: TruckIcon, action: () => onNavigate("tracking") }
  ];

  return (
    <nav className="z-30 grid h-[88px] grid-cols-4 border-t border-slate-100 bg-white/95 px-4 pb-3 pt-2 shadow-nav backdrop-blur-xl">
      {items.map((item) => {
        const Icon = item.icon;
        const selected = active === item.label;
        return (
          <button
            key={item.label}
            onClick={item.action}
            className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-[20px] text-[10px] font-bold transition active:scale-95 ${
              selected ? "text-savt-dark" : "text-slate-400"
            }`}
          >
            <span className={`grid h-9 w-12 place-items-center rounded-2xl transition ${selected ? "bg-savt-light shadow-sm ring-1 ring-emerald-100" : ""}`}>
              <Icon className="h-5 w-5" />
            </span>
            <span>{item.label}</span>
            {selected && <span className="absolute bottom-0.5 h-1 w-5 rounded-full bg-savt-green" />}
            {!!item.count && item.label === "Cart" && (
              <span className="absolute right-4 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-savt-green px-1 text-[10px] font-black text-white shadow-sm">
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

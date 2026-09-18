import { CustomerProfileScreen, CheckoutAddress } from "./customer/components";
import { useCustomer } from "./customer/context";
import { type ReactNode, useMemo, useState } from "react";
import {
  buyAgainProducts,
  categories,
  flashSaleProducts,
  memberExclusiveProducts,
  products,
  recommendedProducts,
  vouchers,
  weeklyDealsProducts
} from "./data/mockData";
import type { CartItem, CartTotals, Product, Screen } from "./types";
import { AppShell } from "./components/Layout";
import {
  BagIcon,
  BabyIcon,
  ChevronRightIcon,
  CoinIcon,
  DairyIcon,
  DrinkIcon,
  FilterIcon,
  FruitIcon,
  FrozenIcon,
  HomeCareIcon,
  NoodleIcon,
  PantryIcon,
  PercentBadgeIcon,
  PinIcon,
  SearchIcon,
  SnackIcon,
  ShieldIcon,
  TruckIcon
} from "./components/Icons";
import { ProductCard, ProductVisual, ValueTag } from "./components/ProductCard";
import { QuantitySelector } from "./components/QuantitySelector";

const currency = (value: number) => `RM ${value.toFixed(2)}`;

const categoryVisuals = {
  drinks: { Icon: DrinkIcon, bg: "bg-lime-50", text: "text-lime-700", ring: "ring-lime-100" },
  snacks: { Icon: SnackIcon, bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-100" },
  frozen: { Icon: FrozenIcon, bg: "bg-cyan-50", text: "text-cyan-700", ring: "ring-cyan-100" },
  noodles: { Icon: NoodleIcon, bg: "bg-orange-50", text: "text-orange-700", ring: "ring-orange-100" },
  household: { Icon: HomeCareIcon, bg: "bg-teal-50", text: "text-teal-700", ring: "ring-teal-100" },
  baby: { Icon: BabyIcon, bg: "bg-pink-50", text: "text-pink-700", ring: "ring-pink-100" },
  fresh: { Icon: FruitIcon, bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-100" },
  dairy: { Icon: DairyIcon, bg: "bg-sky-50", text: "text-sky-700", ring: "ring-sky-100" },
  pantry: { Icon: PantryIcon, bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-100" }
};

function categoryVisual(categoryId: string) {
  return categoryVisuals[categoryId as keyof typeof categoryVisuals] ?? categoryVisuals.fresh;
}

function filterProducts(items: Product[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;

  return items.filter((product) => {
    const categoryName = categories.find((category) => category.id === product.category)?.name ?? "";
    return [product.name, product.unit, product.badge, product.description, categoryName]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalized);
  });
}

function findProducts(query: string) {
  return filterProducts(products, query);
}

export default function App({ onLogout }: { onLogout?: () => void }) {
  const { guardNavigation } = useCustomer();
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedCategory, setSelectedCategory] = useState("fresh");
  const [selectedProduct, setSelectedProduct] = useState<Product>(products[0]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [voucherApplied, setVoucherApplied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.product.memberPrice * item.quantity, 0);
    const discount = voucherApplied && subtotal > 0 ? Math.min(vouchers[0].discount, subtotal * 0.25) : 0;
    const delivery = subtotal > 0 ? 4.9 : 0;
    const cashback = cart.reduce((sum, item) => sum + item.product.memberPrice * item.quantity * (item.product.cashback / 100), 0);
    const points = cart.reduce((sum, item) => sum + item.product.points * item.quantity, 0);
    return { subtotal, discount, delivery, cashback, points, total: subtotal - discount + delivery };
  }, [cart, voucherApplied]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const addToCart = (product: Product) => {
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (existing) {
        return current.map((item) => (item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
      }
      return [...current, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((current) =>
      current
        .map((item) => (item.product.id === productId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const openProduct = (product: Product) => {
    setSelectedProduct(product);
    setScreen("detail");
  };

  const openCategory = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setSearchQuery("");
    setScreen("listing");
  };

  const navigate = (nextScreen: Screen) => {
    if (nextScreen === "listing") {
      setSearchQuery("");
    }
    guardNavigation(() => setScreen(nextScreen));
  };

  const activeNav = screen === "listing" ? "Categories" : ["cart", "checkout"].includes(screen) ? "Cart" : screen === "tracking" ? "Orders" : "Home";

  return (
    <AppShell
      active={activeNav}
      cartCount={cartCount}
      onNavigate={navigate}
      onLogout={onLogout}
      screenKey={screen}
      sticky={
        screen === "detail" ? (
          <StickyCta
            label={`Add to cart - ${currency(selectedProduct.memberPrice)}`}
            sublabel={`Earn ${selectedProduct.points} pts + ${selectedProduct.cashback}% cashback`}
            onClick={() => {
              addToCart(selectedProduct);
              setScreen("cart");
            }}
          />
        ) : screen === "cart" && cart.length > 0 ? (
          <StickyCta
            label={`Checkout - ${currency(totals.total)}`}
            sublabel={`${currency(totals.cashback)} cashback after delivery`}
            onClick={() => setScreen("checkout")}
          />
        ) : screen === "checkout" ? (
          <StickyCta
            label={`Confirm order - ${currency(totals.total)}`}
            sublabel="Delivery from CKS Lintas in 30-45 mins"
            onClick={() => setScreen("tracking")}
          />
        ) : undefined
      }
    >
      {screen === "profile" && <CustomerProfileScreen />}
      {screen === "home" && (
        <HomeScreen
          selectedCategory={selectedCategory}
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
          onCategory={openCategory}
          onProduct={openProduct}
          onAdd={addToCart}
        />
      )}
      {screen === "listing" && (
        <ListingScreen
          selectedCategory={selectedCategory}
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
          onCategory={setSelectedCategory}
          onProduct={openProduct}
          onAdd={addToCart}
        />
      )}
      {screen === "detail" && <ProductDetail product={selectedProduct} onProduct={openProduct} onAdd={addToCart} />}
      {screen === "cart" && (
        <CartScreen cart={cart} totals={totals} voucherApplied={voucherApplied} onVoucher={() => setVoucherApplied(true)} onQuantity={updateQuantity} />
      )}
      {screen === "checkout" && <CheckoutScreen cart={cart} totals={totals} voucherApplied={voucherApplied} onManage={() => setScreen("profile")} />}
      {screen === "tracking" && <TrackingScreen cart={cart} totals={totals} onHome={() => setScreen("home")} />}
    </AppShell>
  );
}

function HomeScreen({
  searchQuery,
  onSearch,
  onCategory,
  onProduct,
  onAdd
}: {
  selectedCategory: string;
  searchQuery: string;
  onSearch: (query: string) => void;
  onCategory: (categoryId: string) => void;
  onProduct: (product: Product) => void;
  onAdd: (product: Product) => void;
}) {
  const searchResults = findProducts(searchQuery).slice(0, 4);

  return (
    <div className="space-y-6 px-5 py-4">
      <div className="sticky top-0 z-30 -mx-5 -mt-4 bg-[#F7FAF8]/95 px-5 pb-3 pt-4 shadow-[0_14px_24px_rgba(15,23,42,0.05)] backdrop-blur-xl">
        <SearchBar value={searchQuery} onChange={onSearch} />
      </div>
      {searchQuery.trim() && (
        <SearchResultsPanel query={searchQuery} products={searchResults} onProduct={onProduct} onAdd={onAdd} />
      )}
      <PromotionBanner />
      <TrustStrip />
      <SavingsStrip />
      <SectionHeader title="Shop supermarket aisles" action="View all" />
      <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
        {categories.map((category) => {
          const visual = categoryVisual(category.id);
          const Icon = visual.Icon;
          return (
            <button
              key={category.id}
              onClick={() => onCategory(category.id)}
              className="flex min-h-[104px] w-[82px] shrink-0 flex-col items-center justify-center gap-2 rounded-[24px] border border-white/80 bg-white p-2 shadow-card transition active:scale-95"
            >
              <span className={`relative grid h-12 w-12 place-items-center overflow-hidden rounded-[18px] ${visual.bg} ${visual.text} ring-1 ${visual.ring}`}>
                <span className="absolute left-2 top-1 h-3 w-7 rounded-full bg-white/70" />
                <Icon className="relative h-6 w-6" />
              </span>
              <span className="text-center text-[11px] font-black leading-3 text-slate-700">{category.name}</span>
            </button>
          );
        })}
      </div>
      <SectionHeader title="Flash Sale" action="Ends 02:18:45" />
      <ProductGrid products={flashSaleProducts} onProduct={onProduct} onAdd={onAdd} />
      <SectionHeader title="Member Exclusive" action="See all" />
      <ProductGrid products={memberExclusiveProducts} onProduct={onProduct} onAdd={onAdd} />
      <SectionHeader title="Recommended for you" action="Fresh today" />
      <ProductGrid products={recommendedProducts} onProduct={onProduct} onAdd={onAdd} />
      <SectionHeader title="Weekly Deals" action="Save more" />
      <ProductGrid products={weeklyDealsProducts} onProduct={onProduct} onAdd={onAdd} />
      <SectionHeader title="Buy Again" action="Last ordered" />
      <ProductGrid products={buyAgainProducts} onProduct={onProduct} onAdd={onAdd} />
      <CashbackPanel />
    </div>
  );
}

function ListingScreen({
  selectedCategory,
  searchQuery,
  onSearch,
  onCategory,
  onProduct,
  onAdd
}: {
  selectedCategory: string;
  searchQuery: string;
  onSearch: (query: string) => void;
  onCategory: (categoryId: string) => void;
  onProduct: (product: Product) => void;
  onAdd: (product: Product) => void;
}) {
  const [dealFilter, setDealFilter] = useState<"all" | "member" | "cashback" | "points">("all");
  const selectedCategoryName = categories.find((category) => category.id === selectedCategory)?.name ?? "Groceries";
  const categoryProducts = products.filter((product) => product.category === selectedCategory);
  const filteredBySearch = filterProducts(categoryProducts.length ? categoryProducts : products, searchQuery);
  const visibleProducts = filteredBySearch.filter((product) => {
    if (dealFilter === "member") return product.originalPrice > product.memberPrice;
    if (dealFilter === "cashback") return product.cashback >= 6;
    if (dealFilter === "points") return product.points >= 100;
    return true;
  });

  return (
    <div className="space-y-5 px-5 py-4">
      <div className="flex gap-2">
        <SearchBar compact value={searchQuery} onChange={onSearch} />
        <button
          onClick={() => setDealFilter(dealFilter === "member" ? "all" : "member")}
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border shadow-card transition active:scale-95 ${
            dealFilter === "member" ? "border-savt-green bg-savt-green text-white" : "border-white/80 bg-white text-slate-700"
          }`}
          aria-label="Toggle member deals filter"
        >
          <FilterIcon />
        </button>
      </div>
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {categories.map((category) => {
          const visual = categoryVisual(category.id);
          const Icon = visual.Icon;
          return (
            <button
              key={category.id}
              onClick={() => onCategory(category.id)}
              className={`flex h-12 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-black transition active:scale-95 ${
                selectedCategory === category.id ? "bg-slate-950 text-white shadow-button" : "bg-white text-slate-500 shadow-sm"
              }`}
            >
              <span className={`grid h-7 w-7 place-items-center rounded-full ${selectedCategory === category.id ? "bg-white/20" : `${visual.bg} ${visual.text}`}`}>
                <Icon className="h-4 w-4" />
              </span>
              {category.name}
            </button>
          );
        })}
      </div>
      <div className="flex min-h-[66px] items-center gap-3 rounded-[22px] border border-emerald-100 bg-white p-3.5 text-savt-dark shadow-soft">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-savt-light">
          <PinIcon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-black text-slate-950">{selectedCategoryName} from CKS Lintas</p>
          <p className="text-xs font-semibold text-slate-500">{visibleProducts.length} picks available. Nearest branch selected automatically.</p>
        </div>
      </div>
      <FilterChips selected={dealFilter} onSelect={setDealFilter} />
      {visibleProducts.length ? (
        <ProductGrid products={visibleProducts} onProduct={onProduct} onAdd={onAdd} />
      ) : (
        <EmptyProductsState query={searchQuery} onClear={() => onSearch("")} />
      )}
    </div>
  );
}

function ProductDetail({ product, onProduct, onAdd }: { product: Product; onProduct: (product: Product) => void; onAdd: (product: Product) => void }) {
  return (
    <div>
      <div className={`relative grid h-[268px] place-items-center overflow-hidden bg-gradient-to-br ${product.color}`}>
        <div className="absolute left-5 top-5 rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-black text-savt-dark shadow-sm">
          CKS GO fresh packed
        </div>
        <div className="absolute bottom-7 h-10 w-48 rounded-full bg-slate-950/10 blur-xl" />
        <ProductVisual product={product} size="detail" />
      </div>
      <div className="-mt-7 space-y-5 rounded-t-[32px] bg-white px-5 pb-6 pt-6 shadow-soft">
        <div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            <ValueTag tone="member">Member price</ValueTag>
            <ValueTag tone="cashback">{product.cashback}% cashback</ValueTag>
            <ValueTag tone="points">+{product.points} pts</ValueTag>
          </div>
          <h1 className="text-[28px] font-black leading-8 text-slate-950">{product.name}</h1>
          <p className="mt-1 font-bold text-slate-400">{product.unit}</p>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-[34px] font-black leading-none text-slate-950">{currency(product.memberPrice)}</span>
            <span className="pb-1 text-sm font-semibold text-slate-400 line-through">{currency(product.originalPrice)}</span>
          </div>
        </div>
        <p className="text-[15px] leading-6 text-slate-600">{product.description}</p>
        <div className="grid grid-cols-2 gap-3">
          <RewardMetric icon={<CoinIcon className="h-4 w-4" />} label="SAVT Points" value={`+${product.points}`} />
          <RewardMetric icon={<PercentBadgeIcon className="h-4 w-4" />} label="Cashback" value={`${product.cashback}%`} />
        </div>
        <div className="flex gap-3 rounded-[24px] border border-emerald-100 bg-savt-light p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-savt-dark shadow-sm">
            <TruckIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-black text-savt-dark">Packed from your nearest CKS</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-emerald-700">No branch selection needed. SAVT assigns the closest branch automatically.</p>
          </div>
        </div>
        <SectionHeader title="Suggested products" />
        <ProductGrid products={products.filter((item) => item.id !== product.id).slice(0, 2)} onProduct={onProduct} onAdd={onAdd} />
      </div>
      <button onClick={() => onAdd(product)} className="sr-only">Add to cart</button>
    </div>
  );
}

function CartScreen({
  cart,
  totals,
  voucherApplied,
  onVoucher,
  onQuantity
}: {
  cart: CartItem[];
  totals: CartTotals;
  voucherApplied: boolean;
  onVoucher: () => void;
  onQuantity: (productId: string, delta: number) => void;
}) {
  if (!cart.length) {
    return (
      <div className="grid min-h-[560px] place-items-center px-8 text-center">
        <div>
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-[28px] bg-savt-light text-savt-dark">
            <BagIcon className="h-9 w-9" />
          </div>
          <h1 className="mt-5 text-2xl font-black text-slate-950">Your cart is empty</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Add fresh groceries from your nearest CKS branch to start your order.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-5 py-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-savt-dark">CKS GO basket</p>
        <h1 className="mt-1 text-[28px] font-black leading-8 text-slate-950">Your cart</h1>
      </div>
      {cart.map((item) => (
        <CartRow key={item.product.id} item={item} onQuantity={onQuantity} />
      ))}
      <VoucherCard applied={voucherApplied} onApply={onVoucher} />
      <div className="rounded-[26px] border border-emerald-100 bg-white p-4 shadow-soft">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-50 text-amber-700">
              <CoinIcon className="h-5 w-5" />
            </span>
            <div>
            <p className="font-black text-slate-950">Use SAVT Points</p>
            <p className="text-sm font-medium text-slate-500">Available balance: 1,240 pts</p>
            </div>
          </div>
          <span className="rounded-full bg-savt-light px-3 py-1.5 text-xs font-black text-savt-dark">On</span>
        </div>
      </div>
      <SummaryCard totals={totals} voucherApplied={voucherApplied} />
    </div>
  );
}

function CheckoutScreen({
  cart,
  totals,
  voucherApplied,
  onManage
}: {
  cart: CartItem[];
  totals: CartTotals;
  voucherApplied: boolean;
  onManage: () => void;
}) {
  return (
    <div className="space-y-4 px-5 py-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-savt-dark">Secure checkout</p>
        <h1 className="mt-1 text-[28px] font-black leading-8 text-slate-950">Checkout</h1>
      </div>
      <CheckoutAddress onManage={onManage} />
      <InfoCard title="Delivery time" subtitle="ETA 30-45 mins" meta="Auto-assigned from CKS Lintas" />
      <InfoCard title="Payment method" subtitle="SAVT Wallet - Visa ending 4288" meta="Mock payment for prototype" />
      <div className="rounded-[26px] border border-white/80 bg-white p-4 shadow-soft">
        <p className="font-black text-slate-950">Order note</p>
        <p className="mt-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-500">
          Leave at guard house if unavailable
        </p>
      </div>
      <VoucherCard applied={voucherApplied} onApply={() => undefined} />
      <div className="rounded-[28px] border border-white/80 bg-white p-4 shadow-lift">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-black text-slate-950">Order summary</p>
            <p className="mt-1 text-sm font-medium text-slate-500">{cart.length} item groups packed by CKS Lintas</p>
          </div>
          <span className="rounded-full bg-savt-light px-3 py-1 text-xs font-black text-savt-dark">Rewards</span>
        </div>
        <RewardsEarned totals={totals} />
        <SummaryRows totals={totals} voucherApplied={voucherApplied} />
      </div>
    </div>
  );
}

function TrackingScreen({
  cart,
  totals,
  onHome
}: {
  cart: CartItem[];
  totals: CartTotals;
  onHome: () => void;
}) {
  const stages = ["Order received", "Preparing", "Picking up", "Delivering", "Completed"];

  return (
    <div className="space-y-4 px-5 py-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-savt-dark">Live delivery</p>
        <h1 className="mt-1 text-[28px] font-black leading-8 text-slate-950">Order tracking</h1>
      </div>
      <div className="relative overflow-hidden rounded-[30px] bg-[#123D27] p-5 text-white shadow-lift">
        <div className="absolute right-4 top-4 grid h-14 w-14 place-items-center rounded-2xl bg-white/10">
          <TruckIcon className="h-7 w-7" />
        </div>
        <p className="text-[28px] font-black leading-8">Arriving in 18 mins</p>
        <p className="mt-2 max-w-[72%] text-sm font-semibold leading-5 text-emerald-100">Rider is picking up your CKS GO order</p>
      </div>
      <div className="flex items-center justify-between rounded-[24px] border border-white/80 bg-white p-4 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-savt-light text-sm font-black text-savt-dark shadow-sm">A</div>
          <div>
            <p className="font-black text-slate-950">Aiman - SAVT Rider</p>
            <p className="text-sm font-medium text-slate-500">Motorbike - SBT 1284</p>
          </div>
        </div>
        <button className="min-h-11 rounded-full bg-savt-light px-4 text-sm font-black text-savt-dark">Call</button>
      </div>
      <div className="rounded-[26px] border border-white/80 bg-white p-5 shadow-soft">
        {stages.map((stage, index) => {
          const active = index < 3;
          const current = index === 2;
          return (
            <div key={stage} className="relative flex gap-3 pb-6 last:pb-0">
              {index !== stages.length - 1 && (
                <span className={`absolute left-[10px] top-6 h-full w-0.5 ${active ? "bg-savt-green" : "bg-slate-100"}`} />
              )}
              <span className={`z-10 mt-1 grid h-6 w-6 place-items-center rounded-full border-4 border-white text-[9px] font-black ${
                active ? "bg-savt-green text-white shadow-sm" : "bg-slate-200 text-slate-400"
              }`}>
                {active ? "✓" : ""}
              </span>
              <div className={`min-w-0 flex-1 rounded-[18px] px-3 py-2 ${current ? "bg-savt-light" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className={`font-black ${active ? "text-slate-950" : "text-slate-400"}`}>{stage}</p>
                  {current && <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-savt-dark shadow-sm">Now</span>}
                </div>
                <p className="mt-0.5 text-sm font-medium text-slate-500">
                  {index === 0 ? "Confirmed at 2:08 PM" : index === 1 ? "CKS team is packing your items" : index === 2 ? "Rider arriving at CKS Lintas" : index === 3 ? "On the way soon" : "After delivery"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="rounded-[24px] border border-white/80 bg-white p-4 shadow-soft">
        <p className="font-black text-slate-950">Order items</p>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          {cart.length ? cart.map((item) => `${item.product.name} x${item.quantity}`).join(", ") : "Seedless Grapes x2, Farm Eggs x1"}
        </p>
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-sm font-bold text-slate-500">Total paid</span>
          <span className="font-black text-slate-950">{currency(totals.total || 20.5)}</span>
        </div>
      </div>
      <button onClick={onHome} className="h-12 w-full rounded-2xl bg-savt-light text-sm font-black text-savt-dark shadow-sm">
        Back to CKS GO Home
      </button>
    </div>
  );
}

function SearchBar({
  compact = false,
  value,
  onChange
}: {
  compact?: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={`flex min-h-[52px] items-center gap-3 rounded-[20px] border border-white/80 bg-white px-4 text-slate-400 shadow-card ${compact ? "min-w-0 flex-1" : ""}`}>
      <SearchIcon className="h-5 w-5 shrink-0" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
        placeholder="Search groceries, fruits, snacks"
      />
    </label>
  );
}

function SearchResultsPanel({
  query,
  products: items,
  onProduct,
  onAdd
}: {
  query: string;
  products: Product[];
  onProduct: (product: Product) => void;
  onAdd: (product: Product) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-savt-dark">Search results</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">{items.length ? `Top ${items.length} matches for "${query.trim()}"` : `No matches for "${query.trim()}"`}</h2>
        </div>
        <span className="rounded-full bg-savt-light px-3 py-1 text-[11px] font-black text-savt-dark">CKS Lintas</span>
      </div>
      {items.length ? (
        <div className="space-y-3">
          {items.map((product) => (
            <SearchResultRow key={product.id} product={product} onProduct={onProduct} onAdd={onAdd} />
          ))}
        </div>
      ) : (
        <p className="rounded-[20px] bg-slate-50 px-4 py-3 text-sm font-semibold leading-5 text-slate-500">
          Try milk, grapes, noodles, snacks or baby essentials.
        </p>
      )}
    </div>
  );
}

function SearchResultRow({
  product,
  onProduct,
  onAdd
}: {
  product: Product;
  onProduct: (product: Product) => void;
  onAdd: (product: Product) => void;
}) {
  return (
    <article className="flex min-h-[112px] items-center gap-3 rounded-[26px] border border-white/80 bg-white p-3 shadow-card">
      <button onClick={() => onProduct(product)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <div className={`grid h-[82px] w-[82px] shrink-0 place-items-center overflow-hidden rounded-[24px] bg-gradient-to-br ${product.color}`}>
          <ProductVisual product={product} size="cart" />
        </div>
        <div className="min-w-0">
          <p className="line-clamp-2 text-[15px] font-black leading-5 text-slate-950">{product.name}</p>
          <p className="mt-0.5 text-xs font-bold text-slate-400">{product.unit}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[15px] font-black text-savt-dark">{currency(product.memberPrice)}</span>
            <ValueTag tone="cashback">{product.cashback}% back</ValueTag>
          </div>
        </div>
      </button>
      <button
        onClick={() => onAdd(product)}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-savt-green text-white shadow-button transition active:scale-95"
        aria-label={`Add ${product.name}`}
      >
        +
      </button>
    </article>
  );
}

function FilterChips({
  selected,
  onSelect
}: {
  selected: "all" | "member" | "cashback" | "points";
  onSelect: (value: "all" | "member" | "cashback" | "points") => void;
}) {
  const filters = [
    { id: "all", label: "All picks" },
    { id: "member", label: "Member deals" },
    { id: "cashback", label: "6%+ cashback" },
    { id: "points", label: "100+ pts" }
  ] as const;

  return (
    <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
      {filters.map((filter) => (
        <button
          key={filter.id}
          onClick={() => onSelect(filter.id)}
          className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-black shadow-sm transition active:scale-95 ${
            selected === filter.id ? "bg-savt-green text-white" : "bg-white text-slate-500"
          }`}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

function EmptyProductsState({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="rounded-[28px] border border-white/80 bg-white p-6 text-center shadow-soft">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-[22px] bg-savt-light text-savt-dark">
        <SearchIcon className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-black text-slate-950">No grocery matches</h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
        {query.trim() ? "Try a different grocery keyword or clear the search to browse this aisle." : "Try a different SAVT deal filter for this aisle."}
      </p>
      {query.trim() && (
        <button onClick={onClear} className="mt-4 min-h-11 rounded-full bg-savt-green px-5 text-sm font-black text-white shadow-button">
          Clear search
        </button>
      )}
    </div>
  );
}

function PromotionBanner() {
  const heroProducts = [products[0], products[1], products[3]];

  return (
    <div className="relative min-h-[196px] overflow-hidden rounded-[32px] bg-[#123D27] p-5 text-white shadow-lift">
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/15 to-transparent" />
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-savt-green/20 blur-2xl" />
      <div className="relative z-10 max-w-[58%]">
        <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[10px] font-black text-emerald-50 backdrop-blur">
          CKS GO Supermarket Week
        </span>
        <p className="mt-3 text-[24px] font-black leading-[29px]">Stock up and save more</p>
        <p className="mt-2 text-[12px] font-semibold leading-[17px] text-emerald-100">Fresh picks, member prices and SAVT rewards.</p>
      </div>
      <div className="absolute bottom-4 right-4 w-[116px] rounded-[28px] bg-white/95 p-2.5 shadow-lift">
        <div className="grid grid-cols-2 gap-1.5">
          {heroProducts.map((product) => (
            <div key={product.id} className="grid h-[46px] place-items-center overflow-hidden rounded-2xl bg-slate-50">
              <ProductVisual product={product} size="cart" />
            </div>
          ))}
          <div className="grid h-[46px] place-items-center rounded-2xl bg-savt-light text-[11px] font-black text-savt-dark">CKS</div>
        </div>
        <div className="mt-2 rounded-2xl bg-savt-light px-2 py-1 text-center text-[10px] font-black text-savt-dark">
          30-45 mins
        </div>
      </div>
    </div>
  );
}

function TrustStrip() {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      <TrustItem icon={<PinIcon className="h-4 w-4" />} label="Nearest CKS" value="Lintas" />
      <TrustItem icon={<TruckIcon className="h-4 w-4" />} label="ETA" value="30-45m" />
      <TrustItem icon={<ShieldIcon className="h-4 w-4" />} label="Packed" value="Carefully" />
    </div>
  );
}

function TrustItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/80 bg-white p-3 shadow-soft">
      <div className="grid h-9 w-9 place-items-center rounded-2xl bg-savt-light text-savt-dark">
        {icon}
      </div>
      <p className="mt-2 text-[10px] font-bold text-slate-400">{label}</p>
      <p className="text-[12px] font-black text-slate-950">{value}</p>
    </div>
  );
}

function SavingsStrip() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-[24px] border border-emerald-100 bg-white p-4 shadow-soft">
        <div className="flex items-center gap-2 text-savt-dark">
          <PercentBadgeIcon className="h-5 w-5" />
          <span className="text-xs font-black uppercase tracking-[0.12em]">Cashback</span>
        </div>
        <p className="mt-2 text-2xl font-black text-slate-950">8%</p>
        <p className="text-xs font-semibold text-slate-500">on member picks</p>
      </div>
      <div className="rounded-[24px] border border-amber-100 bg-white p-4 shadow-soft">
        <div className="flex items-center gap-2 text-amber-700">
          <CoinIcon className="h-5 w-5" />
          <span className="text-xs font-black uppercase tracking-[0.12em]">SAVT Points</span>
        </div>
        <p className="mt-2 text-2xl font-black text-slate-950">+120</p>
        <p className="text-xs font-semibold text-slate-500">typical fresh order</p>
      </div>
    </div>
  );
}

function CashbackPanel() {
  return (
    <div className="relative overflow-hidden rounded-[30px] bg-[#123D27] p-5 text-white shadow-lift">
      <div className="absolute right-4 top-4 grid h-16 w-16 place-items-center rounded-[22px] bg-white/10 text-emerald-100">
        <PercentBadgeIcon className="h-8 w-8" />
      </div>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-200">SAVT rewards</p>
      <p className="mt-2 max-w-[70%] text-[22px] font-black leading-7">Cashback follows you across SAVT</p>
      <p className="mt-2 max-w-[82%] text-sm font-semibold leading-5 text-emerald-100">
        Earn wallet savings and points every time CKS GO packs your supermarket run.
      </p>
      <div className="mt-4 flex gap-2">
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-savt-dark">Wallet ready</span>
        <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-white">Member perks</span>
      </div>
    </div>
  );
}

function RewardMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/80 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-savt-dark">
        {icon}
        <span className="text-xs font-black text-slate-500">{label}</span>
      </div>
      <p className="mt-2 text-xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function SectionHeader({ title, action }: { title: string; action?: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between">
      <div>
        <h2 className="text-[19px] font-black leading-6 text-slate-950">{title}</h2>
      </div>
      {action && (
        <button className="grid min-h-11 min-w-11 place-items-center rounded-full px-3 text-xs font-black text-savt-dark transition active:bg-savt-light">
          {action}
        </button>
      )}
    </div>
  );
}

function ProductGrid({ products: items, onProduct, onAdd }: { products: Product[]; onProduct: (product: Product) => void; onAdd: (product: Product) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3.5">
      {items.map((product) => (
        <ProductCard key={product.id} product={product} onOpen={onProduct} onAdd={onAdd} />
      ))}
    </div>
  );
}

function CartRow({ item, onQuantity }: { item: CartItem; onQuantity: (productId: string, delta: number) => void }) {
  return (
    <div className="rounded-[28px] border border-white/80 bg-white p-3 shadow-card">
      <div className="flex gap-3">
        <div className={`grid h-[86px] w-[86px] shrink-0 place-items-center overflow-hidden rounded-[23px] bg-gradient-to-br ${item.product.color}`}>
          <ProductVisual product={item.product} size="cart" />
        </div>
        <div className="min-w-0 flex-1 py-1">
          <p className="text-[16px] font-black leading-5 text-slate-950">{item.product.name}</p>
          <p className="mt-0.5 text-xs font-bold text-slate-400">{item.product.unit}</p>
          <div className="mt-2 flex items-center gap-1.5">
            <p className="text-[16px] font-black text-savt-dark">{currency(item.product.memberPrice)}</p>
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-savt-dark">
              {item.product.cashback}% back
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
        <div className="flex items-center gap-2 text-amber-700">
          <CoinIcon className="h-4 w-4" />
          <span className="text-[12px] font-black">+{item.product.points * item.quantity} SAVT pts</span>
        </div>
        <QuantitySelector quantity={item.quantity} onIncrement={() => onQuantity(item.product.id, 1)} onDecrement={() => onQuantity(item.product.id, -1)} />
      </div>
    </div>
  );
}

function VoucherCard({ applied, onApply }: { applied: boolean; onApply: () => void }) {
  return (
    <div className="flex min-h-[88px] items-center justify-between gap-3 rounded-[26px] border border-amber-100 bg-[#FFF8E7] p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-amber-700 shadow-sm">
          <PercentBadgeIcon className="h-5 w-5" />
        </span>
        <div>
          <p className="font-black text-slate-950">{vouchers[0].title}</p>
          <p className="text-sm font-semibold text-slate-500">{vouchers[0].subtitle}</p>
        </div>
      </div>
      <button onClick={onApply} className="grid min-h-11 shrink-0 place-items-center rounded-full bg-white px-4 text-sm font-black text-savt-dark shadow-sm transition active:scale-95">
        {applied ? "Applied" : "Apply"}
      </button>
    </div>
  );
}

function SummaryCard({ totals, voucherApplied }: { totals: CartTotals; voucherApplied: boolean }) {
  return (
    <div className="rounded-[28px] border border-white/80 bg-white p-4 shadow-lift">
      <div className="flex items-center justify-between">
        <p className="text-lg font-black text-slate-950">Checkout summary</p>
        <span className="rounded-full bg-savt-light px-3 py-1 text-xs font-black text-savt-dark">CKS GO</span>
      </div>
      <RewardsEarned totals={totals} />
      <SummaryRows totals={totals} voucherApplied={voucherApplied} />
    </div>
  );
}

function RewardsEarned({ totals }: { totals: CartTotals }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2.5">
      <div className="rounded-[20px] border border-emerald-100 bg-emerald-50 p-3">
        <div className="flex items-center gap-1.5 text-savt-dark">
          <PercentBadgeIcon className="h-4 w-4" />
          <span className="text-[10px] font-black uppercase tracking-[0.1em]">Cashback</span>
        </div>
        <p className="mt-1 text-lg font-black text-slate-950">{currency(totals.cashback)}</p>
      </div>
      <div className="rounded-[20px] border border-amber-100 bg-amber-50 p-3">
        <div className="flex items-center gap-1.5 text-amber-700">
          <CoinIcon className="h-4 w-4" />
          <span className="text-[10px] font-black uppercase tracking-[0.1em]">Points</span>
        </div>
        <p className="mt-1 text-lg font-black text-slate-950">+{totals.points}</p>
      </div>
    </div>
  );
}

function SummaryRows({ totals, voucherApplied }: { totals: CartTotals; voucherApplied: boolean }) {
  const rows = [
    ["Subtotal", currency(totals.subtotal), "text-slate-950"],
    ["Voucher", voucherApplied ? `-${currency(totals.discount)}` : "Not applied", voucherApplied ? "text-savt-dark" : "text-slate-400"],
    ["Delivery fee", currency(totals.delivery), "text-slate-950"],
    ["Cashback earned", currency(totals.cashback), "text-savt-dark"],
    ["SAVT Points", `+${totals.points} pts`, "text-amber-700"]
  ];

  return (
    <div className="mt-4 space-y-3.5">
      {rows.map(([label, value, color]) => (
        <div key={label} className="flex min-h-7 items-center justify-between text-sm">
          <span className="font-semibold text-slate-500">{label}</span>
          <span className={`font-black ${color}`}>{value}</span>
        </div>
      ))}
      <div className="flex min-h-14 items-center justify-between border-t border-slate-100 pt-4">
        <span className="text-base font-black text-slate-950">Total</span>
        <span className="text-[24px] font-black text-slate-950">{currency(totals.total)}</span>
      </div>
    </div>
  );
}

function InfoCard({ title, subtitle, meta }: { title: string; subtitle: string; meta: string }) {
  return (
    <button className="flex min-h-[96px] w-full items-center justify-between rounded-[26px] border border-white/80 bg-white p-4 text-left shadow-card transition active:scale-[0.99]">
      <div>
        <p className="text-sm font-black text-slate-500">{title}</p>
        <p className="mt-1 text-[17px] font-black leading-6 text-slate-950">{subtitle}</p>
        <p className="mt-1 text-xs font-bold text-savt-dark">{meta}</p>
      </div>
      <ChevronRightIcon className="h-5 w-5 text-slate-300" />
    </button>
  );
}

function StickyCta({ label, sublabel, onClick }: { label: string; sublabel: string; onClick: () => void }) {
  return (
    <div data-sticky-cta className="z-20 border-t border-slate-100 bg-white/95 px-5 pb-3 pt-2 shadow-nav backdrop-blur-xl">
      <button onClick={onClick} className="flex min-h-[56px] w-full items-center justify-between rounded-[20px] bg-savt-green px-4 text-left text-white shadow-button transition active:scale-[0.99]">
        <span>
          <span className="block text-[14px] font-black">{label}</span>
          <span className="block text-[10.5px] font-semibold text-emerald-50">{sublabel}</span>
        </span>
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/20">
          <BagIcon className="h-5 w-5" />
        </span>
      </button>
    </div>
  );
}

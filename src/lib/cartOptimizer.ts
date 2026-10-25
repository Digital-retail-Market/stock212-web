// @ts-nocheck
import { supabase } from './supabase';
import { notifyCartChanged } from './cart';

// ── Types publics ──────────────────────────────────────────────────────────────

export interface EanInput {
  ean: string;
  quantity: number;
}

export interface PriceTierRaw {
  qty_min: number;
  unit_price: number;
}

export interface ProductOffer {
  productId: string;
  ean: string;
  productName: string;
  sellerId: string;
  sellerName: string;
  moq: number;
  priceTiers: PriceTierRaw[];
  unitPrice: number;  // effective unit price for the requested quantity
  lineTotal: number;  // unitPrice × quantity
}

export interface OptimizedLine {
  ean: string;
  quantity: number;
  offers: ProductOffer[];        // sorted cheapest first
  selected: ProductOffer;        // currently active selection (may be overridden by user)
}

export interface VendorBundle {
  sellerId: string;
  sellerName: string;
  lines: OptimizedLine[];
  subtotal: number;
}

export interface SingleVendorOption {
  sellerId: string;
  sellerName: string;
  total: number;
  coversAll: boolean;
  missingEans: string[];
}

export interface OptimizationResult {
  lines: OptimizedLine[];
  notFound: string[];
  cheapestTotal: number;    // sum using best offer per line
  vendorBundles: VendorBundle[];
  singleVendorOptions: SingleVendorOption[];
}

// ── Parser EAN ─────────────────────────────────────────────────────────────────
// Accepts lines like:
//   7622300489124 24
//   7622300489124x24
//   7622300489124, 24
//   7622300489124     (qty defaults to 1)

export function parseEanInput(raw: string): EanInput[] {
  const result: EanInput[] = [];
  const seen = new Set<string>();

  for (const line of raw.split('\n')) {
    const trimmed = line.trim().replace(/\s*[,;×x]\s*/gi, ' ');
    if (!trimmed) continue;

    const parts = trimmed.split(/\s+/);
    // Extract EAN: strip non-digits
    const ean = parts[0].replace(/\D/g, '');
    if (ean.length < 8) continue; // skip invalid

    const quantity = parseInt(parts[1] ?? '1', 10);
    if (isNaN(quantity) || quantity <= 0) continue;

    const key = ean;
    if (seen.has(key)) continue;
    seen.add(key);

    result.push({ ean, quantity });
  }

  return result;
}

// ── Calcul du prix effectif selon les paliers ─────────────────────────────────

export function getEffectiveUnitPrice(tiers: PriceTierRaw[], quantity: number): number {
  if (!tiers || tiers.length === 0) return 0;
  const sorted = [...tiers].sort((a, b) => b.qty_min - a.qty_min);
  const applicable = sorted.find((t) => t.qty_min <= quantity) ?? sorted[sorted.length - 1];
  return applicable.unit_price;
}

// ── Algorithme principal ───────────────────────────────────────────────────────

export async function optimizeCart(inputs: EanInput[]): Promise<OptimizationResult> {
  if (inputs.length === 0) {
    return { lines: [], notFound: [], cheapestTotal: 0, vendorBundles: [], singleVendorOptions: [] };
  }

  const eans = inputs.map((i) => i.ean);

  // Fetch all active products matching any of the EANs
  const { data: rawProducts } = await supabase
    .from('products')
    .select(`
      id, name, ean, seller_org_id, moq,
      organisations!seller_org_id(name),
      price_tiers(qty_min, unit_price)
    `)
    .in('ean', eans)
    .eq('status', 'active');

  type RawProduct = {
    id: string;
    name: string;
    ean: string;
    seller_org_id: string;
    moq: number;
    organisations: { name: string } | null;
    price_tiers: PriceTierRaw[];
  };

  const products = (rawProducts ?? []) as RawProduct[];

  // Group offers by EAN
  const offersByEan = new Map<string, ProductOffer[]>();
  for (const p of products) {
    const tiers = p.price_tiers ?? [];
    const eanKey = p.ean ?? '';
    if (!offersByEan.has(eanKey)) offersByEan.set(eanKey, []);
    offersByEan.get(eanKey)!.push({
      productId: p.id,
      ean: eanKey,
      productName: p.name,
      sellerId: p.seller_org_id,
      sellerName: (p.organisations as { name: string } | null)?.name ?? 'Vendeur inconnu',
      moq: p.moq ?? 1,
      priceTiers: tiers,
      // placeholder — filled below per-input
      unitPrice: 0,
      lineTotal: 0,
    });
  }

  const lines: OptimizedLine[] = [];
  const notFound: string[] = [];

  for (const input of inputs) {
    const rawOffers = offersByEan.get(input.ean) ?? [];

    if (rawOffers.length === 0) {
      notFound.push(input.ean);
      continue;
    }

    // Compute effective prices for this quantity
    const priced: ProductOffer[] = rawOffers
      .map((o) => {
        const unitPrice = getEffectiveUnitPrice(o.priceTiers, input.quantity);
        return { ...o, unitPrice, lineTotal: unitPrice * input.quantity };
      })
      .filter((o) => o.unitPrice > 0)
      .sort((a, b) => a.unitPrice - b.unitPrice); // cheapest first

    if (priced.length === 0) {
      notFound.push(input.ean);
      continue;
    }

    lines.push({
      ean: input.ean,
      quantity: input.quantity,
      offers: priced,
      selected: priced[0], // default = cheapest
    });
  }

  // Build result
  const cheapestTotal = lines.reduce((s, l) => s + l.selected.lineTotal, 0);

  // Group optimal selection by vendor
  const vendorMap = new Map<string, VendorBundle>();
  for (const line of lines) {
    const { sellerId, sellerName } = line.selected;
    if (!vendorMap.has(sellerId)) {
      vendorMap.set(sellerId, { sellerId, sellerName, lines: [], subtotal: 0 });
    }
    const vb = vendorMap.get(sellerId)!;
    vb.lines.push(line);
    vb.subtotal += line.selected.lineTotal;
  }
  const vendorBundles = Array.from(vendorMap.values()).sort((a, b) => b.subtotal - a.subtotal);

  // Single-vendor options: for each vendor, compute total if you buy everything from them
  const allVendorIds = new Set<string>();
  for (const line of lines) line.offers.forEach((o) => allVendorIds.add(o.sellerId));

  const singleVendorOptions: SingleVendorOption[] = [];
  for (const vendorId of allVendorIds) {
    let total = 0;
    const missingEans: string[] = [];

    for (const line of lines) {
      const offer = line.offers.find((o) => o.sellerId === vendorId);
      if (offer) {
        total += offer.lineTotal;
      } else {
        missingEans.push(line.ean);
        // Add cheapest available as fallback cost
        total += line.selected.lineTotal;
      }
    }

    const sellerName = lines
      .flatMap((l) => l.offers)
      .find((o) => o.sellerId === vendorId)?.sellerName ?? vendorId;

    singleVendorOptions.push({
      sellerId: vendorId,
      sellerName,
      total,
      coversAll: missingEans.length === 0,
      missingEans,
    });
  }

  // Sort: coversAll first, then by total asc
  singleVendorOptions.sort((a, b) => {
    if (a.coversAll && !b.coversAll) return -1;
    if (!a.coversAll && b.coversAll) return 1;
    return a.total - b.total;
  });

  return { lines, notFound, cheapestTotal, vendorBundles, singleVendorOptions };
}

// ── Analyse d'optimisation d'un panier template existant ──────────────────────

export interface CartLineOptimization {
  cartItemId: string;
  currentProductId: string;
  ean: string;
  productName: string;
  currentSellerId: string;
  currentSellerName: string;
  quantity: number;
  currentUnitPrice: number;
  currentLineTotal: number;
  cheaperProductId: string | null;
  cheaperProductName: string | null;
  cheaperSellerId: string | null;
  cheaperSellerName: string | null;
  cheaperUnitPrice: number | null;
  cheaperLineTotal: number | null;
  saving: number;
  hasAlternative: boolean;
}

export interface CartOptimizationAnalysis {
  lines: CartLineOptimization[];
  currentTotal: number;
  optimizedTotal: number;
  totalSaving: number;
  savingPercent: number;
  linesWithAlternative: number;
}

export async function analyzeTemplateOptimization(
  cartId: string,
): Promise<CartOptimizationAnalysis> {
  // 1. Load current cart items with full product details
  type RawItem = {
    id: string;
    quantity: number;
    unit_price_computed: number | null;
    products: {
      id: string; ean: string | null; name: string;
      seller_org_id: string; moq: number;
      organisations: { name: string } | null;
      price_tiers: PriceTierRaw[];
    } | null;
  };

  const { data: rawItems } = await supabase
    .from('cart_items')
    .select(`
      id, quantity, unit_price_computed,
      products(
        id, ean, name, seller_org_id, moq,
        organisations!seller_org_id(name),
        price_tiers(qty_min, unit_price)
      )
    `)
    .eq('cart_id', cartId);

  const items = (rawItems ?? []) as RawItem[];
  if (items.length === 0) {
    return { lines: [], currentTotal: 0, optimizedTotal: 0, totalSaving: 0, savingPercent: 0, linesWithAlternative: 0 };
  }

  // 2. Collect EANs to search for alternatives
  const eans = [...new Set(
    items.map((i) => i.products?.ean).filter((e): e is string => !!e),
  )];

  // 3. Fetch all active catalog products for those EANs
  type RawProduct = {
    id: string; name: string; ean: string; seller_org_id: string; moq: number;
    organisations: { name: string } | null;
    price_tiers: PriceTierRaw[];
  };

  const { data: catalogRaw } = await supabase
    .from('products')
    .select(`
      id, name, ean, seller_org_id, moq,
      organisations!seller_org_id(name),
      price_tiers(qty_min, unit_price)
    `)
    .in('ean', eans)
    .eq('status', 'active');

  const catalog = (catalogRaw ?? []) as RawProduct[];

  // Group catalog offers by EAN
  const offersByEan = new Map<string, RawProduct[]>();
  for (const p of catalog) {
    if (!p.ean) continue;
    if (!offersByEan.has(p.ean)) offersByEan.set(p.ean, []);
    offersByEan.get(p.ean)!.push(p);
  }

  // 4. Build per-line optimization
  const lines: CartLineOptimization[] = [];

  for (const item of items) {
    const p = item.products;
    if (!p || !p.ean) continue;

    const currentUnitPrice = getEffectiveUnitPrice(p.price_tiers, item.quantity);
    const currentLineTotal = currentUnitPrice * item.quantity;

    // Find all alternatives sorted cheapest first
    const alternatives = (offersByEan.get(p.ean) ?? [])
      .map((alt) => ({
        productId: alt.id,
        productName: alt.name,
        sellerId: alt.seller_org_id,
        sellerName: (alt.organisations as { name: string } | null)?.name ?? '—',
        unitPrice: getEffectiveUnitPrice(alt.price_tiers, item.quantity),
      }))
      .filter((a) => a.unitPrice > 0)
      .sort((a, b) => a.unitPrice - b.unitPrice);

    const cheapest = alternatives[0];
    const hasAlternative =
      !!cheapest &&
      cheapest.productId !== p.id &&
      cheapest.unitPrice < currentUnitPrice;

    const saving = hasAlternative ? (currentUnitPrice - cheapest!.unitPrice) * item.quantity : 0;

    lines.push({
      cartItemId: item.id,
      currentProductId: p.id,
      ean: p.ean,
      productName: p.name,
      currentSellerId: p.seller_org_id,
      currentSellerName: (p.organisations as { name: string } | null)?.name ?? '—',
      quantity: item.quantity,
      currentUnitPrice,
      currentLineTotal,
      cheaperProductId: hasAlternative ? cheapest!.productId : null,
      cheaperProductName: hasAlternative ? cheapest!.productName : null,
      cheaperSellerId: hasAlternative ? cheapest!.sellerId : null,
      cheaperSellerName: hasAlternative ? cheapest!.sellerName : null,
      cheaperUnitPrice: hasAlternative ? cheapest!.unitPrice : null,
      cheaperLineTotal: hasAlternative ? cheapest!.unitPrice * item.quantity : null,
      saving,
      hasAlternative,
    });
  }

  const currentTotal = lines.reduce((s, l) => s + l.currentLineTotal, 0);
  const optimizedTotal = lines.reduce((s, l) => s + (l.hasAlternative ? l.cheaperLineTotal! : l.currentLineTotal), 0);
  const totalSaving = currentTotal - optimizedTotal;

  return {
    lines,
    currentTotal,
    optimizedTotal,
    totalSaving,
    savingPercent: currentTotal > 0 ? (totalSaving / currentTotal) * 100 : 0,
    linesWithAlternative: lines.filter((l) => l.hasAlternative).length,
  };
}

export async function applyTemplateOptimization(
  cartId: string,
  lines: CartLineOptimization[],
): Promise<{ error: string | null }> {
  const toSwap = lines.filter((l) => l.hasAlternative && l.cheaperProductId);
  if (toSwap.length === 0) return { error: null };

  for (const line of toSwap) {
    const { error } = await supabase
      .from('cart_items')
      .update({
        product_id: line.cheaperProductId,
        unit_price_computed: line.cheaperUnitPrice,
      })
      .eq('id', line.cartItemId)
      .eq('cart_id', cartId)
      .is('lot_id', null); // une ligne lot DLC reste attachée à son produit
    if (error) return { error: error.message };
  }
  return { error: null };
}

// ── Add-to-cart ────────────────────────────────────────────────────────────────

export async function addOptimizedLinesToCart(
  lines: OptimizedLine[],
  buyerOrgId: string,
): Promise<{ error: string | null }> {
  // Ensure active cart exists
  const { data: cartRows } = await supabase
    .from('carts')
    .select('id')
    .eq('buyer_org_id', buyerOrgId)
    .eq('status', 'active')
    .eq('is_template', false)
    .order('created_at', { ascending: false })
    .limit(1);
  let cart: { id: string } | null = cartRows?.[0] ?? null;

  if (!cart) {
    const { data: newCart, error: cartErr } = await supabase
      .from('carts')
      .insert({ buyer_org_id: buyerOrgId, status: 'active' })
      .select('id')
      .single();
    if (cartErr) return { error: cartErr.message };
    cart = newCart;
  }

  const cartId = cart.id;

  // Upsert each line (if product already in cart, update qty)
  for (const line of lines) {
    const { productId, unitPrice } = line.selected;

    const { data: existing } = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('cart_id', cartId)
      .eq('product_id', productId)
      .is('lot_id', null)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('cart_items')
        .update({ quantity: existing.quantity + line.quantity })
        .eq('id', existing.id);
    } else {
      await supabase.from('cart_items').insert({
        cart_id: cartId,
        product_id: productId,
        quantity: line.quantity,
        unit_price_computed: unitPrice,
      });
    }
  }

  notifyCartChanged();
  return { error: null };
}

// ══════════════════════════════════════════════════════════════════════════════
// DELIVERY-AWARE LANDED COST OPTIMIZATION
// Each cart is split per vendor at checkout (1 vendor = 1 order = 1 delivery).
// The optimizer must account for delivery fees to find the true cheapest basket.
// ══════════════════════════════════════════════════════════════════════════════

// ── Delivery config (mirrors vendor_delivery_config table) ────────────────────

export interface DeliveryConfig {
  seller_org_id: string;
  delivery_mode: 'flat_rate' | 'free_above_threshold' | 'percentage' | 'free_always' | 'negotiated';
  flat_rate_mad: number;
  free_threshold_mad: number | null;
  percentage_rate: number | null;
  min_charge_mad: number | null;
  max_charge_mad: number | null;
}

// ── Result types ──────────────────────────────────────────────────────────────

export interface DeliveryAwareBundle extends VendorBundle {
  deliveryCost: number;
  landedTotal: number;
  isFreeDelivery: boolean;
  remainingToFreeDelivery: number | null;
}

export interface ConsolidationOption {
  dropVendorId: string;
  dropVendorName: string;
  absorbVendorId: string;
  absorbVendorName: string;
  eansToMove: string[];
  productCostIncrease: number;
  deliverySaving: number;
  netSaving: number;
}

export interface LandedCostResult extends OptimizationResult {
  deliveryBundles: DeliveryAwareBundle[];
  totalProductCost: number;
  totalDeliveryCost: number;
  totalLandedCost: number;
  consolidationOptions: ConsolidationOption[];
}

export interface VendorSplitBundle {
  sellerId: string;
  sellerName: string;
  lineCount: number;
  productSubtotal: number;
  deliveryCost: number;
  landedTotal: number;
  isFreeDelivery: boolean;
  remainingToFreeDelivery: number | null;
}

export interface CartSplitAnalysis {
  bundles: VendorSplitBundle[];
  totalProductCost: number;
  totalDeliveryCost: number;
  totalLandedCost: number;
}

// ── Pure delivery fee computation ─────────────────────────────────────────────

const DEFAULT_DELIVERY: Pick<DeliveryConfig,
  'delivery_mode' | 'flat_rate_mad' | 'free_threshold_mad' |
  'percentage_rate' | 'min_charge_mad' | 'max_charge_mad'
> = {
  delivery_mode: 'free_above_threshold',
  flat_rate_mad: 35,
  free_threshold_mad: 1000,
  percentage_rate: null,
  min_charge_mad: null,
  max_charge_mad: null,
};

export function computeDeliveryFee(
  cfg: DeliveryConfig | null | undefined,
  subtotal: number,
): number {
  const c = cfg ?? ({ seller_org_id: '', ...DEFAULT_DELIVERY } as DeliveryConfig);
  switch (c.delivery_mode) {
    case 'free_always':  return 0;
    case 'negotiated':   return 0;
    case 'flat_rate':    return c.flat_rate_mad;
    case 'free_above_threshold':
      return subtotal >= (c.free_threshold_mad ?? 1000) ? 0 : c.flat_rate_mad;
    case 'percentage': {
      const raw = subtotal * (c.percentage_rate ?? 0.05);
      const capped = c.max_charge_mad != null ? Math.min(raw, c.max_charge_mad) : raw;
      return c.min_charge_mad != null ? Math.max(capped, c.min_charge_mad) : capped;
    }
    default: return c.flat_rate_mad;
  }
}

function remainingToFree(cfg: DeliveryConfig | null | undefined, subtotal: number): number | null {
  const mode = cfg?.delivery_mode ?? 'free_above_threshold';
  if (mode !== 'free_above_threshold') return null;
  const threshold = cfg?.free_threshold_mad ?? 1000;
  const fee = computeDeliveryFee(cfg, subtotal);
  return fee > 0 ? Math.max(0, threshold - subtotal) : null;
}

// ── DB: fetch delivery configs for a set of vendor orgs ──────────────────────

export async function fetchDeliveryConfigs(
  orgIds: string[],
): Promise<Map<string, DeliveryConfig>> {
  if (orgIds.length === 0) return new Map();
  const { data } = await supabase
    .from('vendor_delivery_config')
    .select('seller_org_id, delivery_mode, flat_rate_mad, free_threshold_mad, percentage_rate, min_charge_mad, max_charge_mad')
    .in('seller_org_id', orgIds);
  const map = new Map<string, DeliveryConfig>();
  for (const row of data ?? []) map.set(row.seller_org_id, row as DeliveryConfig);
  return map;
}

// ── Augment an OptimizationResult with delivery costs + consolidation hints ──

export async function computeLandedCost(
  base: OptimizationResult,
  preloadedConfigs?: Map<string, DeliveryConfig>,
): Promise<LandedCostResult> {
  const vendorIds = base.vendorBundles.map((b) => b.sellerId);
  const cfgMap = preloadedConfigs ?? await fetchDeliveryConfigs(vendorIds);

  const deliveryBundles: DeliveryAwareBundle[] = base.vendorBundles.map((bundle) => {
    const cfg = cfgMap.get(bundle.sellerId) ?? null;
    const deliveryCost = computeDeliveryFee(cfg, bundle.subtotal);
    return {
      ...bundle,
      deliveryCost,
      landedTotal: bundle.subtotal + deliveryCost,
      isFreeDelivery: deliveryCost === 0,
      remainingToFreeDelivery: remainingToFree(cfg, bundle.subtotal),
    };
  });

  const totalProductCost = base.cheapestTotal;
  const totalDeliveryCost = deliveryBundles.reduce((s, b) => s + b.deliveryCost, 0);
  const totalLandedCost = totalProductCost + totalDeliveryCost;

  // Greedy consolidation: for each vendor we pay delivery to, can we move all
  // its EANs to another vendor already in the cart and save more than we spend?
  const consolidationOptions: ConsolidationOption[] = [];

  for (const dropBundle of deliveryBundles) {
    if (dropBundle.deliveryCost <= 0) continue;
    const dropLines = base.lines.filter((l) => l.selected.sellerId === dropBundle.sellerId);
    if (dropLines.length === 0) continue;

    const candidates: ConsolidationOption[] = [];

    for (const absorbBundle of deliveryBundles) {
      if (absorbBundle.sellerId === dropBundle.sellerId) continue;

      let canAbsorb = true;
      let productCostIncrease = 0;
      let addedToAbsorb = 0;
      const eansToMove: string[] = [];

      for (const line of dropLines) {
        const offer = line.offers.find((o) => o.sellerId === absorbBundle.sellerId);
        if (!offer || offer.unitPrice <= 0) { canAbsorb = false; break; }
        productCostIncrease += (offer.unitPrice - line.selected.unitPrice) * line.quantity;
        addedToAbsorb += offer.unitPrice * line.quantity;
        eansToMove.push(line.ean);
      }
      if (!canAbsorb) continue;

      // Does the extra volume tip absorb vendor into free delivery?
      const newAbsorbSubtotal = absorbBundle.subtotal + addedToAbsorb;
      const absorbCfg = cfgMap.get(absorbBundle.sellerId) ?? null;
      const newAbsorbDelivery = computeDeliveryFee(absorbCfg, newAbsorbSubtotal);
      const absorbDeliveryDelta = newAbsorbDelivery - absorbBundle.deliveryCost;

      const deliverySaving = dropBundle.deliveryCost - absorbDeliveryDelta;
      const netSaving = deliverySaving - productCostIncrease;

      candidates.push({
        dropVendorId: dropBundle.sellerId,
        dropVendorName: dropBundle.sellerName,
        absorbVendorId: absorbBundle.sellerId,
        absorbVendorName: absorbBundle.sellerName,
        eansToMove,
        productCostIncrease,
        deliverySaving,
        netSaving,
      });
    }

    // Keep the best absorber for this drop vendor
    if (candidates.length > 0) {
      consolidationOptions.push(candidates.sort((a, b) => b.netSaving - a.netSaving)[0]);
    }
  }

  return {
    ...base,
    deliveryBundles,
    totalProductCost,
    totalDeliveryCost,
    totalLandedCost,
    consolidationOptions: consolidationOptions.sort((a, b) => b.netSaving - a.netSaving),
  };
}

// ── Analyse the vendor split + delivery of an existing cart/template ──────────

export async function analyzeCartSplitDelivery(cartId: string): Promise<CartSplitAnalysis> {
  type RawItem = {
    quantity: number;
    unit_price_computed: number | null;
    products: { seller_org_id: string; organisations: { name: string } | null } | null;
  };

  const { data } = await supabase
    .from('cart_items')
    .select('quantity, unit_price_computed, products(seller_org_id, organisations!seller_org_id(name))')
    .eq('cart_id', cartId);

  const items = (data ?? []) as RawItem[];
  const vendorMap = new Map<string, { name: string; count: number; subtotal: number }>();

  for (const item of items) {
    if (!item.products) continue;
    const vid = item.products.seller_org_id;
    const vname = (item.products.organisations as { name: string } | null)?.name ?? '—';
    const lineTotal = (item.unit_price_computed ?? 0) * item.quantity;
    if (!vendorMap.has(vid)) vendorMap.set(vid, { name: vname, count: 0, subtotal: 0 });
    const v = vendorMap.get(vid)!;
    v.count++;
    v.subtotal += lineTotal;
  }

  const cfgMap = await fetchDeliveryConfigs(Array.from(vendorMap.keys()));

  const bundles: VendorSplitBundle[] = Array.from(vendorMap.entries()).map(([vid, v]) => {
    const cfg = cfgMap.get(vid) ?? null;
    const deliveryCost = computeDeliveryFee(cfg, v.subtotal);
    return {
      sellerId: vid,
      sellerName: v.name,
      lineCount: v.count,
      productSubtotal: v.subtotal,
      deliveryCost,
      landedTotal: v.subtotal + deliveryCost,
      isFreeDelivery: deliveryCost === 0,
      remainingToFreeDelivery: remainingToFree(cfg, v.subtotal),
    };
  });

  const totalProductCost = bundles.reduce((s, b) => s + b.productSubtotal, 0);
  const totalDeliveryCost = bundles.reduce((s, b) => s + b.deliveryCost, 0);

  return {
    bundles,
    totalProductCost,
    totalDeliveryCost,
    totalLandedCost: totalProductCost + totalDeliveryCost,
  };
}

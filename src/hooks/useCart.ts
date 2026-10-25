import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { CART_CHANGE_EVENT, notifyCartChanged } from '../lib/cart';
import { useAuth } from '../contexts/AuthContext';
import type { CartItem, Product, PriceTier } from '../types';

export type CartLot = {
  id: string;
  lot_number: string;
  qty_available: number;
  expiry_date: string | null;
  specific_price: number | null;
};

export type CartItemWithProduct = CartItem & {
  products: Product & { price_tiers: PriceTier[] };
  lot_id?: string | null;
  lot?: CartLot | null;
};

export function getApplicableTier(tiers: PriceTier[], qty: number): PriceTier | null {
  const sorted = [...tiers].sort((a, b) => a.qty_min - b.qty_min);
  const eligible = sorted.filter((t) => qty >= t.qty_min);
  return eligible[eligible.length - 1] ?? sorted[0] ?? null;
}

// Prix unitaire facturé — même règle que place_multi_vendor_order :
// prix du lot DLC pour une ligne lot, sinon palier de quantité.
export function itemUnitPrice(item: CartItemWithProduct, qty = item.quantity): number | null {
  if (item.lot?.specific_price != null) return item.lot.specific_price;
  return getApplicableTier(item.products?.price_tiers ?? [], qty)?.unit_price ?? null;
}

// Quantité minimale — un lot plus petit que le MOQ peut être soldé en entier.
export function itemMinQty(item: CartItemWithProduct): number {
  const moq = item.products?.moq ?? 1;
  return item.lot ? Math.min(moq, item.lot.qty_available) : moq;
}

export function useCart() {
  const { user, activeOrg } = useAuth();
  const [items, setItems] = useState<CartItemWithProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [cartId, setCartId] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!user || !activeOrg) { setItems([]); return; }
    if (!silent) setLoading(true);
    const { data: carts } = await supabase
      .from('carts')
      .select('id')
      .eq('buyer_org_id', activeOrg.id)
      .eq('status', 'active')
      .eq('is_template', false)
      .order('created_at', { ascending: false })
      .limit(1);

    const cart = carts?.[0] ?? null;
    if (!cart) { setItems([]); setLoading(false); return; }
    setCartId(cart.id);

    const { data } = await supabase
      .from('cart_items')
      .select('*, products(*, price_tiers(*), organisations(name, id)), lot:product_lots(id, lot_number, qty_available, expiry_date, specific_price)')
      .eq('cart_id', cart.id);

    setItems((data as CartItemWithProduct[]) ?? []);
    setLoading(false);
  }, [user, activeOrg]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const sync = () => { load(true); };
    window.addEventListener(CART_CHANGE_EVENT, sync);
    return () => window.removeEventListener(CART_CHANGE_EVENT, sync);
  }, [load]);

  async function removeItem(cartItemId: string) {
    await supabase.from('cart_items').delete().eq('id', cartItemId);
    setItems((prev) => prev.filter((i) => i.id !== cartItemId));
    notifyCartChanged();
  }

  async function updateQty(cartItemId: string, qty: number, unitPrice: number | null) {
    await supabase
      .from('cart_items')
      .update({ quantity: qty, unit_price_computed: unitPrice })
      .eq('id', cartItemId);
    setItems((prev) =>
      prev.map((i) => i.id === cartItemId
        ? { ...i, quantity: qty, unit_price_computed: unitPrice }
        : i
      )
    );
    notifyCartChanged();
  }

  const count = items.reduce((s, i) => s + i.quantity, 0);
  const hasMoqViolation = items.some(
    (i) => i.products && i.quantity < itemMinQty(i)
  );

  return { items, loading, count, hasMoqViolation, removeItem, updateQty, reload: load, cartId };
}

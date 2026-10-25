import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Box, Button, Container, Flex, Heading, HStack, Image, Skeleton, Text, useToast } from '@chakra-ui/react';
import { ChevronRight, ShieldCheck, ShoppingCart, Layers } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { addToCart, notifyCartChanged } from '../../lib/cart';
import { ProductCard, ProductRail } from './ProductCard';
import type { Product } from '../../types';

const NAVY = '#0d1f38';
const AMBER = '#c97d1a';
const AMBER_BORDER = '#fbbf24';
const BORDER = '#e2e8f0';
const MUTED = '#64748b';
// Section palette — tint + accent, distinct from the neighbouring sections.
const THEME = {
  orderAgain: { bg: '#ECFEFF', accent: '#0E7490' },
  bulk:       { bg: '#F0FDF4', accent: '#15803D' },
  business:   { bg: '#EEF2FF', accent: '#4338CA' },
  suppliers:  { bg: '#F1F5F9', accent: NAVY },
} as const;

const PRODUCT_SELECT = '*, organisations(name), price_tiers(*)';

function firstTier(p: Product) {
  return p.price_tiers?.slice().sort((a, b) => a.qty_min - b.qty_min)[0] ?? null;
}

function SectionHead({ title, badge, to, color = AMBER }: { title: string; badge?: string; to?: string; color?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <Flex align="flex-end" justify="space-between" mb={{ base: 3, md: 6 }} gap={3}>
      <Flex align="stretch" gap={3} minW={0}>
        <Box w="4px" rounded="full" flexShrink={0} style={{ background: color }} />
        <Box minW={0}>
          {badge && (
            <Text fontSize={{ base: '10px', md: '11px' }} fontWeight="800" letterSpacing="0.08em" textTransform="uppercase"
              mb={0.5} style={{ color }}>{badge}</Text>
          )}
          <Heading as="h2" fontSize={{ base: 'lg', md: '2xl' }} fontWeight="800" lineHeight="1.2" letterSpacing="-0.01em" color={NAVY}>
            {title}
          </Heading>
        </Box>
      </Flex>
      {to && (
        <Button variant="ghost" size="sm" fontWeight="600" fontSize="sm" color={color} h={{ base: '44px', md: 8 }} flexShrink={0}
          _hover={{ bg: 'blackAlpha.50' }} rightIcon={<ChevronRight size={13} />}
          onClick={() => navigate(to)}>
          {t('common.seeAll')}
        </Button>
      )}
    </Flex>
  );
}

function ProductTile({ product, footer, action }: {
  product: Product;
  footer?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return <ProductCard fluid product={product} footer={footer} action={action} />;
}

// ── 1. Commander à nouveau / Meilleures ventes ───────────────────────────────
export function OrderAgainSection() {
  const { t } = useTranslation();
  const { activeOrg } = useAuth();
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReorder, setIsReorder] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (activeOrg) {
        const { data } = await supabase
          .from('orders')
          .select('created_at, order_lines(product_id, products(*, organisations(name), price_tiers(*)))')
          .eq('buyer_org_id', activeOrg.id)
          .order('created_at', { ascending: false })
          .limit(10);
        const seen = new Set<string>();
        const list: Product[] = [];
        for (const o of (data ?? []) as any[]) {
          for (const l of o.order_lines ?? []) {
            const p = l.products as Product | null;
            if (p && p.status === 'active' && !seen.has(p.id)) { seen.add(p.id); list.push(p); }
          }
        }
        if (list.length > 0) {
          if (!cancelled) { setProducts(list.slice(0, 5)); setIsReorder(true); setLoading(false); }
          return;
        }
      }
      const { data } = await supabase.from('products').select(PRODUCT_SELECT)
        .eq('status', 'active').order('avg_rating', { ascending: false }).limit(5);
      if (!cancelled) { setProducts((data as Product[]) ?? []); setIsReorder(false); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [activeOrg]);

  async function quickAdd(p: Product) {
    if (!activeOrg) return;
    const tier = firstTier(p);
    setBusyId(p.id);
    const { error } = await addToCart({
      buyerOrgId: activeOrg.id, productId: p.id,
      quantity: tier?.qty_min ?? 1, unitPrice: tier?.unit_price ?? null,
    });
    setBusyId(null);
    if (error) toast({ title: error, status: 'error', duration: 3000 });
    else { notifyCartChanged(); toast({ title: t('home.addedToCart'), status: 'success', duration: 2000 }); }
  }

  if (!loading && products.length === 0) return null;
  return (
    <Box bg={THEME.orderAgain.bg} py={{ base: 5, md: 7 }} style={{ borderBottom: `1px solid ${BORDER}` }}>
      <Container maxW="1400px">
        <SectionHead color={THEME.orderAgain.accent}
          title={isReorder ? t('home.orderAgain') : t('home.bestSellers')}
          badge={isReorder ? t('home.usualProducts') : t('badges.topRated')}
          to="/catalog" />
        <ProductRail>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h="230px" rounded="lg" />)
            : products.map((p) => (
                <ProductTile key={p.id} product={p}
                  action={activeOrg ? (
                    <Button size="xs" w="full" leftIcon={<ShoppingCart size={12} />} bg={AMBER} color="white"
                      _hover={{ bg: '#a96510' }} isLoading={busyId === p.id} onClick={() => quickAdd(p)}>
                      {isReorder ? t('home.reorder') : t('home.add')}
                    </Button>
                  ) : undefined} />
              ))}
        </ProductRail>
      </Container>
    </Box>
  );
}

// ── 2. Offres par quantité (paliers de prix) ─────────────────────────────────
export function BulkDealsSection() {
  const { t } = useTranslation();
  const [deals, setDeals] = useState<{ product: Product; pct: number; qty: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('products').select(PRODUCT_SELECT).eq('status', 'active').limit(80)
      .then(({ data }) => {
        const out: { product: Product; pct: number; qty: number }[] = [];
        for (const p of (data as Product[]) ?? []) {
          const tiers = p.price_tiers?.slice().sort((a, b) => a.qty_min - b.qty_min) ?? [];
          if (tiers.length < 2) continue;
          const best = tiers[tiers.length - 1];
          const pct = Math.round((1 - best.unit_price / tiers[0].unit_price) * 100);
          if (pct > 0) out.push({ product: p, pct, qty: best.qty_min });
        }
        setDeals(out.sort((a, b) => b.pct - a.pct).slice(0, 5));
        setLoading(false);
      });
  }, []);

  if (!loading && deals.length === 0) return null;
  return (
    <Box bg={THEME.bulk.bg} py={{ base: 5, md: 7 }} style={{ borderBottom: `1px solid ${BORDER}` }}>
      <Container maxW="1400px">
        <SectionHead color={THEME.bulk.accent} title={t('home.bulkTitle')} badge={t('home.bulkBadge')} to="/catalog" />
        <ProductRail>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h="230px" rounded="lg" />)
            : deals.map(({ product }) => (
                <ProductTile key={product.id} product={product} />
              ))}
        </ProductRail>
      </Container>
    </Box>
  );
}

// ── 4. Fournisseurs vérifiés ─────────────────────────────────────────────────
const AVATAR_COLORS = ['#0d1f38', '#1d4ed8', '#0f766e', '#7c3aed', '#a96510', '#be123c'];
function avatarColor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

interface Supplier { id: string; name: string; city: string | null; count: number }

export function TopSuppliersSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('products')
      .select('seller_org_id, organisations(id, name, city, validation_status)')
      .eq('status', 'active').limit(500)
      .then(({ data }) => {
        const map = new Map<string, Supplier>();
        for (const row of (data ?? []) as any[]) {
          const o = row.organisations;
          if (!o || o.validation_status !== 'active') continue;
          const s = map.get(o.id) ?? { id: o.id, name: o.name, city: o.city, count: 0 };
          s.count += 1;
          map.set(o.id, s);
        }
        setSuppliers([...map.values()].sort((a, b) => b.count - a.count).slice(0, 6));
        setLoading(false);
      });
  }, []);

  if (!loading && suppliers.length === 0) return null;
  return (
    <Box bg={THEME.suppliers.bg} py={{ base: 5, md: 7 }} style={{ borderBottom: `1px solid ${BORDER}` }}>
      <Container maxW="1400px">
        <SectionHead color={THEME.suppliers.accent} title={t('home.suppliersTitle')} badge={t('home.suppliersBadge')} />
        <ProductRail columns={6}>
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h="130px" rounded="lg" />)
            : suppliers.map((s) => (
                <Flex key={s.id} direction="column" align="center" gap={1.5} p={{ base: 3, md: 4 }} bg="white" rounded="lg" textAlign="center"
                  border="1px solid" borderColor={BORDER} cursor="pointer"
                  _hover={{ shadow: 'md', borderColor: AMBER_BORDER }} transition="all 0.2s"
                  onClick={() => navigate(`/catalog?q=${encodeURIComponent(s.name)}`)}>
                  <Flex w={{ base: 10, md: 12 }} h={{ base: 10, md: 12 }} rounded="full" align="center" justify="center" style={{ background: avatarColor(s.name) }} color="white"
                    fontWeight="800" fontSize="lg">
                    {s.name.charAt(0).toUpperCase()}
                  </Flex>
                  <Text fontWeight="700" fontSize="sm" color={NAVY} noOfLines={1}>{s.name}</Text>
                  <Text fontSize="xs" color={MUTED}>{s.city ?? t('home.defaultCity')} · {t('home.productCount', { count: s.count })}</Text>
                  <HStack spacing={1} color="#15803d">
                    <ShieldCheck size={12} />
                    <Text fontSize="10px" fontWeight="700">{t('home.verified')}</Text>
                  </HStack>
                </Flex>
              ))}
        </ProductRail>
      </Container>
    </Box>
  );
}

// ── 5. Par type d'activité ───────────────────────────────────────────────────
const BUSINESS_TYPES = [
  { key: 'grocery', image: '/business/epicerie.png', q: 'conserve' },
  { key: 'restaurant', image: '/business/restaurant.png', q: 'huile' },
  { key: 'cafe', image: '/business/cafe.png', q: 'café' },
  { key: 'bakery', image: '/business/boulangerie.png', q: 'farine' },
  { key: 'caterer', image: '/business/traiteur.png', q: 'sauce' },
];

export function BusinessTypeSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <Box bg={THEME.business.bg} py={{ base: 5, md: 7 }} style={{ borderBottom: `1px solid ${BORDER}` }}>
      <Container maxW="1400px">
        <SectionHead color={THEME.business.accent} title={t('home.businessTitle')} badge={t('home.businessBadge')} />
        <ProductRail>
          {BUSINESS_TYPES.map((b) => (
            <Flex key={b.key} direction="column" align="center" bg="white" overflow="hidden"
              rounded="lg" border="1px solid" borderColor={BORDER} cursor="pointer"
              _hover={{ shadow: 'md', borderColor: AMBER_BORDER, transform: 'translateY(-3px)' }} _active={{ transform: 'scale(0.97)' }} transition="all 0.2s"
              onClick={() => navigate(`/catalog?q=${encodeURIComponent(b.q)}`)}>
              <Image src={b.image} alt={t(`home.business.${b.key}`)} loading="lazy" w="full" h={{ base: '84px', md: '150px' }} objectFit="cover" />
              <Text fontWeight="700" fontSize={{ base: 'xs', md: 'sm' }} color={NAVY} py={{ base: 2, md: 3 }} px={1} textAlign="center" noOfLines={1}>{t(`home.business.${b.key}`)}</Text>
            </Flex>
          ))}
        </ProductRail>
      </Container>
    </Box>
  );
}

// ── 3. Ventes éclair avec compte à rebours ───────────────────────────────────
function useCountdown(endMs: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (endMs === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endMs]);
  if (endMs === null) return null;
  const total = Math.max(0, Math.floor((endMs - now) / 1000));
  const pad = (v: number) => String(v).padStart(2, '0');
  const days = Math.floor(total / 86400);
  const clock = `${pad(Math.floor((total % 86400) / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
  return { expired: total === 0, days, clock };
}

export function FlashDealsSection() {
  const { t } = useTranslation();
  const [deals, setDeals] = useState<{ product: Product; pct: number }[]>([]);
  const [endMs, setEndMs] = useState<number | null>(null);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    supabase.from('campaigns').select('scope_type, scope_value, end_date, metadata')
      .eq('status', 'active').eq('type', 'flash_sale').eq('scope_type', 'item')
      .gte('end_date', today).order('end_date', { ascending: true }).limit(10)
      .then(async ({ data }) => {
        const camps = ((data ?? []) as any[]).filter((c) => c.scope_value && c.end_date);
        if (camps.length === 0) return;
        const { data: prods } = await supabase.from('products').select(PRODUCT_SELECT)
          .eq('status', 'active').in('id', camps.map((c) => c.scope_value));
        const byId = new Map(((prods as Product[]) ?? []).map((p) => [p.id, p]));
        const list = camps.flatMap((c) => {
          const product = byId.get(c.scope_value);
          return product ? [{ product, pct: Number(c.metadata?.discount_pct) || 0 }] : [];
        });
        if (list.length === 0) return;
        setDeals(list.slice(0, 5));
        setEndMs(new Date(`${camps[0].end_date}T23:59:59`).getTime());
      });
  }, []);

  const countdown = useCountdown(endMs);
  if (deals.length === 0 || countdown?.expired) return null;
  return (
    <Box py={{ base: 5, md: 7 }} style={{ background: 'linear-gradient(135deg, #991b1b, #b91c1c)', borderBottom: `3px solid ${AMBER_BORDER}` }}>
      <Container maxW="1400px">
        <Flex align="center" justify="space-between" mb={5} wrap="wrap" gap={3}>
          <HStack spacing={3}>
            <Heading size="md" fontWeight="900" color="white" textTransform="uppercase">{t('home.flashTitle')}</Heading>
            <Box rounded="full" px={3} py={1} bg="rgba(0,0,0,0.3)" color="white">
              <Text fontSize="xs" fontWeight="700" fontFamily="'JetBrains Mono', monospace">{countdown && (countdown.days > 0 ? `${t('home.daysShort', { count: countdown.days })} ${countdown.clock}` : countdown.clock)}</Text>
            </Box>
          </HStack>
        </Flex>
        <ProductRail>
          {deals.map(({ product, pct }) => {
            const tier = firstTier(product);
            return (
              <ProductTile key={product.id} product={product}
                footer={tier && pct > 0 ? (
                  <HStack spacing={2}>
                    <Text fontSize="xs" fontWeight="800" color="#b91c1c">{(tier.unit_price * (1 - pct / 100)).toFixed(2)} {product.currency}</Text>
                    <Text fontSize="10px" fontWeight="800" color="white" bg="#b91c1c" rounded="sm" px={1.5}>-{pct}%</Text>
                  </HStack>
                ) : undefined} />
            );
          })}
        </ProductRail>
      </Container>
    </Box>
  );
}

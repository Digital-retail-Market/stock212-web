import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Box, Button, Flex, Heading, Text, VStack, HStack, Image, SimpleGrid, Skeleton, Badge, Icon } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ShieldCheck, Snowflake, TrendingDown, Package, Truck, Globe, Zap, Star, CheckCircle, Award, Eye, Store } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { getCatStyle } from '../../lib/categoryIcons';
import { ProductCard, ProductRail } from '../../components/home/ProductCard';
import { VideoShowcase } from '../../components/home/HomeMedia';
import { FlashDealsSection, OrderAgainSection, BulkDealsSection, TopSuppliersSection, BusinessTypeSection } from '../../components/home/HomeShortcuts';
import type { Category, Product } from '../../types';

// Section palette — tint (background) + accent (title bar, badge, links).
const THEME = {
  categories:  { bg: 'linear-gradient(180deg, #FFFFFF 0%, #FFF8EB 100%)', accent: '#C97D1A' },
  newArrivals: { bg: '#F5F3FF', accent: '#6D28D9' },
  boissons:    { bg: '#EFF6FF', accent: '#1D4ED8' },
  laitiers:    { bg: '#FDF2F8', accent: '#BE185D' },
  biscuiterie: { bg: '#FFF7ED', accent: '#C2410C' },
  epicerie:    { bg: '#FEFCE8', accent: '#A16207' },
  fruits:      { bg: '#F0FDF4', accent: '#15803D' },
  partners:    { bg: '#FFFBEB', accent: '#B45309' },
} as const;

// Category image overrides
const CATEGORY_IMAGE_OVERRIDES: { [key: string]: string } = {
  'Hygiène': '/cleaning-product.jfif',
};

// Rotating hero posters, and the separate ads strip below. Kept module-level so
// the lists aren't rebuilt each render and the lengths can't drift apart.
const CAROUSEL_IMAGES = ['/hero/one.png', '/hero/two.png', '/hero/tree.png'];
const AD_IMAGES = ['/ads/ads1.jfif', '/ads/ads2.jpg', '/ads/ads3.jpg', '/ads/ads4.jpg', '/ads/ads5.png', '/ads/ads6.png'];

// ── BRAND PALETTE ─────────────────────────────────────────────────────────────
// Source of truth: VISUAL_IDENTITY.md §2. Navy carries authority, amber carries
// action — those are the only two brand colours. Everything else is the slate
// neutral ramp or a status colour; no decorative hues (identity §1 "sobre —
// pas de fantaisie décorative").
const C = {
  // Primary — navy
  primary:     '#0d1f38',      // Navy: headers, headings, primary CTA
  primaryLight:'#1a3558',      // Navy Mid: gradient end, hover
  primaryMid:  '#13294a',      // Navy between the two, for 3-stop gradients

  // Accent — amber. The only non-navy brand colour.
  accent:      '#c97d1a',      // Amber: CTA, active links, highlights
  accentLight: '#fef3c7',      // Amber Light: badge/alert backgrounds
  accentBorder:'#fbbf24',      // Amber Border: hover borders, underlines

  // Amber aliases — kept so older call sites resolve to the brand amber
  // instead of the off-brand bright orange they used to point at.
  orange:      '#c97d1a',
  orangeLight: '#fef3c7',

  // Status colours (identity §2 "Couleurs fonctionnelles")
  success:     '#15803d',      // Delivered / positive
  warning:     '#b91c1c',      // Promo urgency, disputes
  warningLight:'#fee2e2',
  warningDark: '#991b1b',      // Hover on warning
  warningBorder:'#fca5a5',
  info:        '#2c5dee',      // blue.500 — informational

  // Neutrals — slate ramp (identity §2 "Couleurs neutres")
  text:        '#334155',      // Body text
  textMuted:   '#64748b',      // Secondary text
  textLight:   '#94a3b8',      // Tertiary text
  border:      '#e2e8f0',      // Borders
  divider:     '#f1f5f9',      // Light divider

  // Backgrounds — the only three section tones, alternated for rhythm
  bg:          '#ffffff',      // Card / section white
  bgLight:     '#f8fafc',      // Global off-white
  bgAlt:       '#f1f5f9',      // Deepest light step
};

// ── Container ─────────────────────────────────────────────────────────────────
// Every section sits in a Container, so this is where sections fade up into
// view as the page scrolls. Skipped when the visitor prefers reduced motion.
function Container({ children, py = 0 }: { children: React.ReactNode; py?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}>
      <Box maxW="1400px" mx="auto" px={{ base: 4, md: 6 }} py={py}>{children}</Box>
    </motion.div>
  );
}

// Section heading: amber accent bar, optional eyebrow label above the title.
function SectionTitle({ title, badge, color = C.accent }: { title: string; badge?: string; color?: string }) {
  return (
    <Flex align="stretch" gap={3} minW={0} pe={{ base: 2, md: 0 }}>
      <Box w="4px" rounded="full" flexShrink={0} style={{ background: color }} />
      <Flex align="center" gap={{ base: 2, md: 3 }} wrap="wrap" minW={0}>
        <Heading as="h2" fontSize={{ base: 'lg', md: '2xl' }} fontWeight="800" lineHeight="1.2"
          letterSpacing="-0.01em" style={{ color: C.primary }}>{title}</Heading>
        {badge && (
          <Box rounded="full" px={2.5} py={0.5} style={{ background: `${color}14`, border: `1px solid ${color}40` }}>
            <Text fontSize="11px" fontWeight="700" whiteSpace="nowrap" style={{ color }}>{badge}</Text>
          </Box>
        )}
      </Flex>
    </Flex>
  );
}

// ── Feature Highlight Card ────────────────────────────────────────────────────
function FeatureCard({ icon: IconComponent, title, description, bgColor, accentColor }: {
  icon: typeof CheckCircle; title: string; description: string; bgColor: string; accentColor: string;
}) {
  return (
    <Box p={5} rounded="lg" border="1px solid" borderColor={C.border}
      bg={bgColor} _hover={{ shadow: 'md', transform: 'translateY(-2px)' }}
      transition="all 0.2s">
      <HStack spacing={3} mb={2}>
        <Flex w={10} h={10} rounded="lg" align="center" justify="center" style={{ background: accentColor }}>
          <IconComponent size={18} color="white" />
        </Flex>
        <Heading size="sm" fontWeight="700" color={C.primary}>{title}</Heading>
      </HStack>
      <Text fontSize="sm" color={C.text}>{description}</Text>
    </Box>
  );
}

// ── Process Step Card ──────────────────────────────────────────────────────────
function ProcessStep({ number, title, description, icon: IconComponent }: {
  number: number; title: string; description: string; icon: typeof Package;
}) {
  return (
    // Phones: compact horizontal row (number + text). Tablet up: the tall card.
    <Flex direction={{ base: 'row', md: 'column' }} gap={{ base: 4, md: 4 }} align={{ base: 'flex-start', md: 'center' }}
      textAlign={{ base: 'start', md: 'center' }} p={{ base: 4, md: 6 }} rounded="lg"
      border="2px solid" borderColor={C.border} position="relative"
      _hover={{ shadow: 'lg', borderColor: C.accent }} transition="all 0.3s">
      <Flex w={{ base: 10, md: 16 }} h={{ base: 10, md: 16 }} flexShrink={0} rounded="full" align="center" justify="center"
        style={{ background: `linear-gradient(135deg, ${C.accent} 0%, ${C.primary} 100%)` }}>
        <Text fontWeight="800" fontSize={{ base: 'lg', md: 'xl' }} color="white">{number}</Text>
      </Flex>
      <Flex w={12} h={12} rounded="lg" align="center" justify="center" bg={C.bgAlt} display={{ base: 'none', md: 'flex' }}>
        <IconComponent size={24} color={C.accent} />
      </Flex>
      <VStack spacing={1} align={{ base: 'flex-start', md: 'center' }}>
        <Heading size={{ base: 'sm', md: 'md' }} fontWeight="700" color={C.primary}>{title}</Heading>
        <Text fontSize="sm" color={C.text}>{description}</Text>
      </VStack>
    </Flex>
  );
}

// ── Product cards — thin wrappers over the shared ProductCard ────────────────
// A badge only when it is true: « Déstockage » for a product sold from an
// active DLC lot, « Promo » when the seller flagged it as on promotion.
// Low stock alone is not clearance — the card shows that as its own line.
function PromoCard({ product, destock = false }: { product: Product; destock?: boolean }) {
  const { t } = useTranslation();
  if (destock) return <ProductCard product={product} badge={t('badges.destock')} badgeColor={C.primary} />;
  if (product.is_on_promotion) return <ProductCard product={product} badge={t('badges.promo')} badgeColor={C.accent} />;
  return <ProductCard product={product} />;
}

// ── Platform stat formatter ────────────────────────────────────────────────────
// Returns null when there is no real figure, so the caller omits the stat.
// It previously fell back to invented numbers ("10 000+", "500+", "200+"),
// which overstated the platform on a page whose whole job is earning trust.
function fmtStat(n: number): string | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${n.toLocaleString('fr-FR')}+`;
}

// ── Hero poster and ads strip ─────────────────────────────────────────────────
// Each owns its rotation timer, so a tick re-renders only itself, not the whole
// page. Rotation stops when the visitor prefers reduced motion or the tab is
// hidden. (The ads have their own index: six images to the hero's three.)
function useRotation(length: number, ms: number): [number, (i: number) => void] {
  const [idx, setIdx] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => { if (!document.hidden) setIdx((p) => (p + 1) % length); }, ms);
    return () => clearInterval(id);
  }, [length, ms, reduce]);
  return [idx, setIdx];
}

function HeroCarousel() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [currentImageIdx] = useRotation(CAROUSEL_IMAGES.length, 6000);
  return (
    <>
      {/* Box takes the hero images' own ratio (1893×831) so they fill edge to edge, uncropped */}
      <Box position="relative" overflow="hidden" w="full" style={{ aspectRatio: '1893 / 831' }}
        backgroundImage={`url('${CAROUSEL_IMAGES[currentImageIdx]}')`}
        backgroundSize="cover"
        backgroundPosition="center"
        backgroundRepeat="no-repeat"
        backgroundAttachment="scroll"
        transition="background-image 0.8s ease-in-out"
        sx={{
          animation: 'slideIn 0.8s ease-in-out',
          '@keyframes slideIn': {
            '0%': { backgroundPosition: 'right center' },
            '100%': { backgroundPosition: 'center' },
          },
        }}
        // The artwork is a finished poster: it already carries the headline and
        // its own painted "order now" button. So the poster itself is the link,
        // rather than stacking real buttons on top of a painted one. The real
        // CTAs live in the band below, where they have room.
        role="link"
        tabIndex={0}
        aria-label={t('hero.cta')}
        cursor="pointer"
        onClick={() => navigate('/catalog')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/catalog'); }
        }}
        _focusVisible={{ outline: `3px solid ${C.accent}`, outlineOffset: '-3px' }}
      />
    </>
  );
}

function AdsCarousel() {
  const { t } = useTranslation();
  const [adIdx, setAdIdx] = useRotation(AD_IMAGES.length, 5000);
  // Warm the next slide so the swap doesn't flash blank.
  useEffect(() => { new window.Image().src = AD_IMAGES[(adIdx + 1) % AD_IMAGES.length]; }, [adIdx]);
  return (
      <Box bg="white" py={0} style={{ borderBottom: `1px solid ${C.border}` }}>
        <Box position="relative" w="full" bg="#f9fafb">
          <Flex w="full" h={{ base: '220px', sm: '350px', md: '450px' }} overflow="hidden" align="center" justify="center">
            <Image src={AD_IMAGES[adIdx]} alt="" decoding="async" w="full" h="full" objectFit="contain"
              transition="opacity 0.5s ease-in-out" />
          </Flex>
          {/* Dots are real buttons: the visible dot stays small, but the hit
              area is 24px so it can actually be tapped, and each one says
              which slide it goes to. */}
          <Flex as="nav" aria-label={t('sections.sponsored')}
            justify="center" position={{ base: 'static', md: 'absolute' }} bottom={1} left="50%"
            transform={{ base: 'none', md: 'translateX(-50%)' }}>
            {AD_IMAGES.map((_, i) => (
              <Box key={i} as="button" type="button"
                aria-label={`${i + 1} / ${AD_IMAGES.length}`}
                aria-current={i === adIdx ? 'true' : undefined}
                onClick={() => setAdIdx(i)}
                w={{ base: '44px', md: '24px' }} h={{ base: '44px', md: '24px' }} display="flex" alignItems="center" justifyContent="center"
                bg="transparent" cursor="pointer"
                _focusVisible={{ outline: `2px solid ${C.accent}`, outlineOffset: '-2px', borderRadius: '4px' }}>
                <Box w={2.5} h={2.5} rounded="full" transition="background 0.2s"
                  bg={i === adIdx ? C.accent : 'rgba(13,31,56,0.28)'} />
              </Box>
            ))}
          </Flex>
        </Box>
      </Box>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export default function HomePage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const [platformCounts, setPlatformCounts] = useState({ products: 0, vendors: 0, delivery: 0 });
  const [subCategories, setSubCategories] = useState<Category[]>([]);
  const [promos, setPromos] = useState<Product[]>([]);
  const [loadingPromos, setLoadingPromos] = useState(true);
  const [destockIds, setDestockIds] = useState<Set<string>>(new Set());
  const [partnerProducts, setPartnerProducts] = useState<Product[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(true);
  const promoStripRef = useRef<HTMLDivElement>(null);
  const promoPaused = useRef(false);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [loadingNew, setLoadingNew] = useState(true);
  const [categoryProducts1, setCategoryProducts1] = useState<Product[]>([]);
  const [loadingCat1, setLoadingCat1] = useState(true);
  const [categoryProducts2, setCategoryProducts2] = useState<Product[]>([]);
  const [loadingCat2, setLoadingCat2] = useState(true);
  const [categoryProducts3, setCategoryProducts3] = useState<Product[]>([]);
  const [loadingCat3, setLoadingCat3] = useState(true);
  const [categoryProducts4, setCategoryProducts4] = useState<Product[]>([]);
  const [loadingCat4, setLoadingCat4] = useState(true);
  const [categoryProducts5, setCategoryProducts5] = useState<Product[]>([]);
  const [loadingCat5, setLoadingCat5] = useState(true);

  // Promo strip: on desktop (mouse, motion allowed) it steps one card every
  // 4 s, pausing on hover/focus or when off-screen, and wraps to the start.
  // Touch screens never auto-scroll, so it can't fight a swipe. RTL-aware: in
  // Arabic scrollLeft runs from 0 down to negative values.
  useEffect(() => {
    const el = promoStripRef.current;
    if (!el || loadingPromos) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let visible = false;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(el);
    const id = setInterval(() => {
      if (promoPaused.current || !visible || document.hidden) return;
      const sign = getComputedStyle(el).direction === 'rtl' ? -1 : 1;
      const max = el.scrollWidth - el.clientWidth;
      if (Math.abs(el.scrollLeft) >= max - 2) el.scrollTo({ left: 0, behavior: 'smooth' });
      else el.scrollBy({ left: sign * 220, behavior: 'smooth' });
    }, 4000);
    return () => { clearInterval(id); io.disconnect(); };
  }, [loadingPromos, promos.length]);

  const isRtl = i18n.dir() === 'rtl';

  useEffect(() => {
    Promise.all([
      supabase.from('products').select('id', { count: 'estimated', head: true }).eq('status', 'active'),
      supabase.from('organisations').select('id', { count: 'estimated', head: true }).eq('org_type', 'seller').eq('validation_status', 'active'),
      supabase.from('organisations').select('id', { count: 'estimated', head: true }).eq('org_type', 'delivery').eq('validation_status', 'active'),
    ]).then(([prodRes, vendorRes, deliveryRes]) => {
      setPlatformCounts({
        products: prodRes.count ?? 0,
        vendors:  vendorRes.count ?? 0,
        delivery: deliveryRes.count ?? 0,
      });
    });

    supabase.from('categories')
      .select('id, name, name_i18n, icon, image_url, description, parent_id, display_order, active')
      .eq('active', true).order('display_order')
      .then(({ data }) => {
        const all = (data as Category[]) ?? [];
        setSubCategories(all.filter((c) => !!c.parent_id));
      });

    // Promotions + déstockage : produits réellement en promotion et en stock,
    // plus les produits vendus depuis un lot DLC actif (prix de lot, stock > 0).
    Promise.all([
      supabase.from('product_lots')
        .select('product_id, products(*, organisations(name), price_tiers(*))')
        .eq('active', true).not('specific_price', 'is', null).gt('qty_available', 0)
        .limit(12),
      supabase.from('products').select('*, organisations(name), price_tiers(*)')
        .eq('status', 'active').eq('is_on_promotion', true).gt('stock_qty', 0)
        .order('updated_at', { ascending: false })
        .limit(12),
    ]).then(([lotsRes, promoRes]) => {
      const lotProducts = ((lotsRes.data ?? []) as unknown as { products: Product | null }[])
        .map((l) => l.products)
        .filter((p): p is Product => !!p && p.status === 'active');
      const ids = new Set(lotProducts.map((p) => p.id));
      const onPromo = ((promoRes.data as Product[]) ?? []).filter((p) => !ids.has(p.id));
      setDestockIds(ids);
      setPromos([...lotProducts, ...onPromo].slice(0, 12));
      setLoadingPromos(false);
    });

    // Sélection partenaires — produits normaux (ni promo ni déstockage)
    supabase.from('products').select('*, organisations(name), price_tiers(*)')
      .eq('status', 'active').eq('is_on_promotion', false).gt('stock_qty', 20)
      .order('avg_rating', { ascending: false })
      .limit(60)
      .then(({ data }) => {
        // Les produits avec un prix affiché passent devant ceux « sur devis ».
        const all = (data as Product[]) ?? [];
        const priced = all.filter((p) => (p.price_tiers?.length ?? 0) > 0);
        const onQuote = all.filter((p) => (p.price_tiers?.length ?? 0) === 0);
        setPartnerProducts([...priced, ...onQuote].slice(0, 10));
        setLoadingPartners(false);
      });

    // New Arrivals — Recently added products
    supabase.from('products').select('*, organisations(name), price_tiers(*)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(12)
      .then(({ data }) => { setNewArrivals((data as Product[]) ?? []); setLoadingNew(false); });

    // Get all active products for category filtering
    supabase.from('products').select('*, organisations(name), categories(name), price_tiers(*), brands(name)')
      .eq('status', 'active')
      .order('avg_rating', { ascending: false })
      .limit(100)
      .then(({ data: allProds }) => {
        const all = (allProds as Product[]) ?? [];

        // Filter by category name
        const cat1 = all.filter(p => p.categories?.name?.toLowerCase().includes('boisson')).slice(0, 10);
        const cat2 = all.filter(p => p.categories?.name?.toLowerCase().includes('laitier')).slice(0, 10);
        const cat3 = all.filter(p => p.categories?.name?.toLowerCase().includes('épicerie')).slice(0, 10);
        const cat4 = all.filter(p => p.categories?.name?.toLowerCase().includes('fruit')).slice(0, 10);
        const cat5 = all.filter(p => p.categories?.name?.toLowerCase().includes('biscuit') || p.categories?.name?.toLowerCase().includes('confiserie')).slice(0, 10);

        setCategoryProducts1(cat1);
        setLoadingCat1(false);
        setCategoryProducts2(cat2);
        setLoadingCat2(false);
        setCategoryProducts3(cat3);
        setLoadingCat3(false);
        setCategoryProducts4(cat4);
        setLoadingCat4(false);
        setCategoryProducts5(cat5);
        setLoadingCat5(false);
      });
  }, []);

  return (
    <Box bg={C.bg}>
      {/* ══════════════════════════════════════════════════════════════
          PROMO BANNER — Yellow moving text banner below navbar
      ══════════════════════════════════════════════════════════════ */}
      {/* Three standing facts about buying here. Static, not a marquee: a
          looping ticker reads as a discount site, and this is a trade counter.
          Each fact carries its own icon so it is scannable, not decorative. */}
      <Box bg={C.accentLight} py={2.5} style={{ borderBottom: `1px solid ${C.accentBorder}` }}>
        <Container>
          <Flex align="center" justify="center" wrap="wrap" columnGap={{ base: 4, md: 9 }} rowGap={1}
            fontSize={{ base: '11px', md: 'xs' }} fontWeight="600" style={{ color: '#92400e' }}>
            <HStack spacing={2}>
              <Truck size={14} />
              <Text>{t('announce.freeShipping')}</Text>
            </HStack>
            <HStack spacing={2}>
              <Package size={14} />
              <Text>{t('announce.trackOrders')}</Text>
            </HStack>
            <HStack spacing={2}>
              <Store size={14} />
              <Text>{t('announce.newSellers')}</Text>
            </HStack>
          </Flex>
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════════
          HERO — Rotating background images sliding right to left
      ══════════════════════════════════════════════════════════════ */}
      <HeroCarousel />

      {/* ══════════════════════════════════════════════════════════════
          KPI BAR — chiffres clés de la plateforme
      ══════════════════════════════════════════════════════════════ */}
      <Box bg={C.bgAlt} py={{ base: 4, sm: 8, md: 10 }} position="relative" zIndex={2}
        style={{ borderBottom: `1px solid ${C.divider}` }}>
        <Container>
          {/* Proof, then the two ways in. The numbers earn the click, so the
              buttons sit beside them rather than on top of the poster. */}
          <Flex direction={{ base: 'column', lg: 'row' }} align="center" gap={{ base: 4, lg: 12 }}>
            <SimpleGrid columns={3} spacing={{ base: 2, sm: 8, md: 10 }} flex={1} w="full">
              {[
                { icon: Package,     v: fmtStat(platformCounts.products), l: t('stats.activeProducts') },
                { icon: ShieldCheck, v: fmtStat(platformCounts.vendors),  l: t('stats.verifiedVendors') },
                { icon: Truck,       v: fmtStat(platformCounts.delivery), l: t('stats.deliveryPartners') },
              ].filter(({ v }) => v !== null).map(({ icon: IconComponent, v, l }) => (
                <Flex key={l} direction={{ base: 'column', sm: 'row' }} align="center" textAlign={{ base: 'center', sm: 'start' }} gap={{ base: 1.5, md: 4 }}>
                  <Flex w={{ base: 8, sm: 11, md: 12 }} h={{ base: 8, sm: 11, md: 12 }} rounded="full" align="center" justify="center"
                    flexShrink={0} style={{ background: C.primary }}>
                    <Icon as={IconComponent} boxSize={{ base: '15px', md: '20px' }} color="white" />
                  </Flex>
                  <Box minW={0} flex={1}>
                    <Text fontWeight="900" fontSize={{ base: '17px', md: '28px' }} style={{ color: C.primary }} lineHeight={1.15}>
                      {v}
                    </Text>
                    <Text fontSize={{ base: '10px', md: 'sm' }} fontWeight="600" mt={0.5} style={{ color: C.textMuted }} noOfLines={2} lineHeight={1.25}>
                      {l}
                    </Text>
                  </Box>
                </Flex>
              ))}
            </SimpleGrid>

            {/* Button geometry per identity §6 — 6px radius, weight 600, 0.01em */}
            <HStack spacing={3} flexShrink={0} w={{ base: 'full', lg: 'auto' }}>
              <Button
                flex={{ base: 1, lg: 'none' }}
                h={{ base: '44px', md: '48px' }} px={{ base: 5, md: 8 }} rounded="6px"
                bg={C.accent} color="white"
                fontWeight="600" fontSize={{ base: 'sm', md: 'md' }} letterSpacing="0.01em"
                _hover={{ bg: C.accentBorder, color: C.primary }}
                _focusVisible={{ boxShadow: `0 0 0 3px ${C.accentBorder}` }}
                transition="all 0.15s ease"
                onClick={() => navigate('/catalog')}>
                {t('hero.cta')}
              </Button>
              <Button
                flex={{ base: 1, lg: 'none' }}
                h={{ base: '44px', md: '48px' }} px={{ base: 5, md: 8 }} rounded="6px"
                bg="transparent" color={C.primary}
                border="1px solid" borderColor={C.primary}
                fontWeight="600" fontSize={{ base: 'sm', md: 'md' }} letterSpacing="0.01em"
                _hover={{ bg: C.primary, color: 'white' }}
                _focusVisible={{ boxShadow: `0 0 0 3px ${C.accentBorder}` }}
                transition="all 0.15s ease"
                onClick={() => navigate(user ? '/buyer' : '/auth')}>
                {user ? t('hero.secondaryLogged') : t('hero.secondaryAnon')}
              </Button>
            </HStack>
          </Flex>
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════════
          MARQUES DISPONIBLES — Auto-scrolling brands carousel
      ══════════════════════════════════════════════════════════════ */}
      <Box bg="white" py={{ base: 5, md: 7 }} style={{ borderBottom: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <Container>
          <Heading size="sm" fontWeight="800" mb={6} textAlign="center" style={{ color: C.textMuted }}>
            {t('sections.partnerBrands')}
          </Heading>
        </Container>
        <style>{`
          @keyframes scroll-brands-loop {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .brands-auto-scroll {
            display: flex;
            gap: 3rem;
            width: max-content;
            animation: scroll-brands-loop 60s linear infinite;
          }
          .brands-auto-scroll:hover {
            animation-play-state: paused;
          }
          @media (prefers-reduced-motion: reduce) {
            .brands-auto-scroll { animation: none; flex-wrap: wrap; width: auto; justify-content: center; }
          }
        `}</style>
        <Box className="brands-auto-scroll" dir="ltr">
          {(() => {
            const brands = [
              { name: 'Carolina', logo: '/logos/carolina.jfif' },
              { name: 'Cosumar', logo: '/logos/cosumar.jfif' },
              { name: 'Coca-Cola', logo: '/logos/coca.jfif' },
              { name: 'Nestlé', logo: '/logos/nestle.jfif' },
              { name: 'Pepsi', logo: '/logos/pepsi.jfif' },
              { name: 'Lipton', logo: '/logos/lipton.jfif' },
              { name: 'Central Lait', logo: '/logos/central lait.jfif' },
              { name: 'Afia', logo: '/logos/afia.jfif' },
              { name: 'Aïcha', logo: '/logos/aicha.jfif' },
              { name: 'Jamila', logo: '/logos/jamila.jfif' },
            ];
            return [...brands, ...brands].map((brand, i) => (
              <Box key={i} flexShrink={0} w={{ base: '96px', md: '140px' }} aria-hidden={i >= brands.length ? true : undefined}>
                <Image src={brand.logo} alt={i >= brands.length ? '' : brand.name} h={{ base: '44px', md: '80px' }} objectFit="contain"
                  loading="lazy" decoding="async" />
              </Box>
            ));
          })()}
        </Box>
      </Box>

      {/* ══════════════════════════════════════════════════════════════
          CATÉGORIES — Circular category display with images
      ══════════════════════════════════════════════════════════════ */}
      <Box bg={THEME.categories.bg} py={{ base: 5, md: 8 }} style={{ borderBottom: `1px solid ${C.border}` }}>
        <Container>
          <Flex align="center" justify="space-between" mb={{ base: 4, md: 8 }}>
            <SectionTitle title={t('categories.title')} color={THEME.categories.accent} />
            <Button variant="ghost" size="sm" fontWeight="600" fontSize="sm" h={{ base: '44px', md: 8 }} flexShrink={0}
              color={THEME.categories.accent} _hover={{ bg: 'blackAlpha.50' }}
              rightIcon={<ChevronRight size={13} />} onClick={() => navigate('/catalog')}>
              {t('common.seeAll')}
            </Button>
          </Flex>

          {/* The 6 most common FMCG categories */}
          <SimpleGrid columns={{ base: 3, md: 6 }} spacingX={{ base: 2, md: 6 }} spacingY={{ base: 3, md: 6 }} w="full">
            {[
              { name: 'Boissons', match: 'boisson', image: '/categories/Beverages.png' },
              { name: 'Produits laitiers', match: 'laitier', image: '/categories/Dairy.png' },
              { name: 'Épicerie sèche', match: 'épicerie', image: '/categories/cooking oils.png' },
              { name: 'Biscuiterie et Confiserie', match: 'biscuit', image: '/categories/biscuiterie.png' },
              { name: 'Hygiène', match: 'hygi', image: CATEGORY_IMAGE_OVERRIDES['Hygiène'] },
              { name: 'Fruits & Légumes', match: 'fruit', image: '/categories/fruit.png' },
            ].map((cat) => {
              const { Icon: CatIcon, bg, color } = getCatStyle(cat.name);
              return (
              <Flex key={cat.name} direction="column" align="center" gap={{ base: 1.5, md: 3 }} cursor="pointer"
                onClick={() => {
                  const found = subCategories.find((c) => c.name.toLowerCase().includes(cat.match));
                  navigate(found ? `/catalog?category=${found.id}` : '/catalog');
                }} _hover={{ transform: 'translateY(-4px)' }}
                transition="all 0.2s">
                <Box position="relative" w={{ base: '64px', sm: '88px', md: '120px' }} h={{ base: '64px', sm: '88px', md: '120px' }}
                  rounded="full" overflow="hidden" bg={cat.image ? C.bgAlt : bg} border={{ base: '2px solid', md: '3px solid' }} borderColor={`${color}55`}
                  boxShadow={`0 4px 12px ${color}22`}
                  _active={{ transform: 'scale(0.94)' }}
                  _hover={{ borderColor: C.accent, boxShadow: `0 0 0 2px ${C.accent}20` }} transition="all 0.3s">
                  {cat.image ? (
                    <Image src={cat.image} alt={cat.name} w="full" h="full" objectFit="cover" loading="lazy" decoding="async" />
                  ) : (
                    <Flex w="full" h="full" align="center" justify="center">
                      {CatIcon && <CatIcon size={40} color={color} />}
                    </Flex>
                  )}
                </Box>
                <Text fontSize={{ base: '10px', sm: 'xs', md: 'sm' }} fontWeight="600" textAlign="center" lineHeight={1.25}
                  color={C.text} noOfLines={2} maxW="120px">
                  {t(`categories.names.${cat.name}`)}
                </Text>
              </Flex>
              );
            })}
          </SimpleGrid>
        </Container>
      </Box>

      <OrderAgainSection />

      <FlashDealsSection />

      {/* ══════════════════════════════════════════════════════════════
          PROMOTIONS & DÉSTOCKAGE — Carousel with more products
      ══════════════════════════════════════════════════════════════ */}
      {(loadingPromos || promos.length > 0) && (
        <Box py={{ base: 8, md: 10 }} position="relative" overflow="hidden" style={{
          background: `linear-gradient(135deg, ${C.warningDark} 0%, ${C.warning} 45%, #dc2626 100%)`,
          borderBottom: `4px solid ${C.accentBorder}`,
          borderTop: `4px solid ${C.accentBorder}`,
          boxShadow: 'inset 0 0 80px rgba(0,0,0,0.25)',
        }}>
          <Container>
            <Flex align="center" justify="space-between" mb={{ base: 4, md: 6 }} gap={{ base: 2, md: 3 }} wrap="wrap">
              <HStack spacing={{ base: 2, md: 3 }} align="center" wrap="wrap" rowGap={2}>
                <Flex align="center" justify="center" w={10} h={10} rounded="full" bg={C.accentBorder} color={C.primary}
                  display={{ base: 'none', md: 'flex' }}>
                  <Zap size={22} fill="currentColor" />
                </Flex>
                <Heading size={{ base: 'sm', md: 'lg' }} fontWeight="900" color="white" textTransform="uppercase" letterSpacing="0.02em" w={{ base: 'full', md: 'auto' }}>
                  {t('sections.promoDestock')}
                </Heading>
                <Box rounded="full" px={3} py={1} bg={C.accentBorder}>
                  <Text fontSize="11px" fontWeight="800" color={C.primary}>{t('sections.limitedQty')}</Text>
                </Box>
              </HStack>
              <Button size="sm" fontWeight="800" fontSize="sm" h={{ base: '36px', md: 8 }} bg="white" color={C.warning}
                _hover={{ bg: C.accentBorder, color: C.primary }}
                rightIcon={<ChevronRight size={14} />} onClick={() => navigate('/best-deals')}>
                {t('common.seeAll')}
              </Button>
            </Flex>
            <Box position="relative">
            {(['start', 'end'] as const).map((dir) => (
              <Box key={dir} as="button" type="button" aria-label={dir === 'start' ? t('home.previous') : t('home.next')}
                position="absolute" top="50%" {...(dir === 'start' ? { insetStart: -2 } : { insetEnd: -2 })}
                transform="translateY(-50%)" zIndex={3} w={9} h={9} rounded="full" bg="white" color={C.warning}
                display={{ base: 'none', md: 'flex' }} alignItems="center" justifyContent="center"
                boxShadow="0 2px 8px rgba(0,0,0,0.3)" _hover={{ bg: C.accentBorder, color: C.primary }}
                onClick={() => promoStripRef.current?.scrollBy({ left: (dir === 'start' ? -400 : 400) * (isRtl ? -1 : 1), behavior: 'smooth' })}>
                <ChevronRight size={18} style={{ transform: (dir === 'start') !== isRtl ? 'rotate(180deg)' : undefined }} />
              </Box>
            ))}
            <Flex ref={promoStripRef} gap={{ base: 2.5, md: 3 }} overflowX="auto" pb={1}
              onMouseEnter={() => { promoPaused.current = true; }}
              onMouseLeave={() => { promoPaused.current = false; }}
              onFocus={() => { promoPaused.current = true; }}
              onBlur={() => { promoPaused.current = false; }}
              style={{ scrollbarWidth: 'none' }}
              sx={{
                scrollSnapType: 'x mandatory',
                '&::-webkit-scrollbar': { display: 'none' },
                '& > *': { scrollSnapAlign: 'start' },
                // Same card widths as the other product rows on phones.
                '@media (max-width: 29.99em)': { '& > *': { flex: '0 0 37% !important', width: '37% !important' } },
                '@media (min-width: 30em) and (max-width: 47.99em)': { '& > *': { flex: '0 0 28% !important', width: '28% !important' } },
              }}>
              {loadingPromos
                ? Array.from({ length: 6 }).map((_, i) => (
                    <Box key={i} flexShrink={0} w="192px" rounded="lg" overflow="hidden" bg="white"
                      border="1px solid" borderColor={C.border}>
                      <Skeleton h={{ base: '108px', sm: '128px', md: '155px' }} /><Box p={3}><Skeleton h="10px" mb={2} /><Skeleton h="10px" w="60%" /></Box>
                    </Box>
                  ))
                : promos.map((p) => <PromoCard key={p.id} product={p} destock={destockIds.has(p.id)} />)}
            </Flex>
            </Box>
          </Container>
        </Box>
      )}

      {/* ══════════════════════════════════════════════════════════════
          IMAGE ADS CAROUSEL — Moving promotional ads with full image display
      ══════════════════════════════════════════════════════════════ */}
      <AdsCarousel />

      <BusinessTypeSection />

      <BulkDealsSection />

      {/* ══════════════════════════════════════════════════════════════
          NEW ARRIVALS — Latest products added to the platform
      ══════════════════════════════════════════════════════════════ */}
      {(loadingNew || newArrivals.length > 0) && (
        <Box bg={THEME.newArrivals.bg} py={{ base: 5, md: 7 }} style={{ borderBottom: `1px solid ${C.border}` }}>
          <Container>
            <Flex align="center" justify="space-between" mb={5}>
              <SectionTitle title={t('promos.newArrivals')} color={THEME.newArrivals.accent} />
              <Button variant="ghost" size="sm" fontWeight="600" fontSize="sm" h={{ base: '44px', md: 8 }} flexShrink={0}
                color={THEME.newArrivals.accent} _hover={{ bg: 'blackAlpha.50' }}
                rightIcon={<ChevronRight size={13} />} onClick={() => navigate('/catalog')}>
                {t('common.seeAll')}
              </Button>
            </Flex>
            <ProductRail>
              {loadingNew
                ? Array.from({ length: 10 }).map((_, i) => (
                    <Box key={i} rounded="lg" overflow="hidden" border="1px solid" borderColor={C.border}>
                      <Skeleton h="160px" /><Box p={3}><Skeleton h="10px" mb={2} /><Skeleton h="10px" w="60%" /></Box>
                    </Box>
                  ))
                : newArrivals.slice(0, 10).map((p) => <PromoCard key={p.id} product={p} />)}
            </ProductRail>
          </Container>
        </Box>
      )}

      {/* Offre première commande — visiteurs non connectés uniquement */}
      {!user && (
        <>
        {/* ══════════════════════════════════════════════════════════════
            PREMIUM OFFER BANNER — Special pricing offer
        ══════════════════════════════════════════════════════════════ */}
        <Box
          bg={`linear-gradient(135deg, ${C.primary} 0%, ${C.primaryMid} 55%, ${C.primaryLight} 100%)`}
          py={{ base: 7, md: 10 }}
          rounded="xl"
          mx={{ base: 4, md: 6 }}
          my={8}
          position="relative"
          overflow="hidden"
          boxShadow="0 12px 32px rgba(13,31,56,0.28)"
        >
          <Container>
            <Flex align="center" justify="space-between" gap={{ base: 7, md: 10 }}
              direction={{ base: 'column', md: 'row' }} textAlign={{ base: 'center', md: 'start' }}>
              <VStack align={{ base: 'center', md: 'start' }} spacing={3} flex={1}>
                <Badge bg="rgba(251,191,36,0.16)" color={C.accentBorder} fontSize="xs" fontWeight="700"
                  px={3} py={1} rounded="full">
                  {t('promotions.limitedTime')}
                </Badge>
                <Heading size={{ base: 'lg', md: 'xl' }} color="white" fontWeight="900" lineHeight={1.15}>
                  {t('promotions.firstOrderSpecial')}
                </Heading>
                <Text color="rgba(255,255,255,0.78)" fontSize={{ base: 'sm', md: 'md' }} maxW="46ch">
                  {t('promotions.newWholesaleBuyers')}
                </Text>
                <Button size="md" h="44px" bg={C.accent} color="white" fontWeight="700" mt={1}
                  _hover={{ bg: C.accentBorder, color: C.primary }}
                  transition="all 0.2s"
                  onClick={() => navigate('/catalog')}>
                  {t('promotions.shopNow')}
                </Button>
              </VStack>
              {/* The offer is the anchor: the figure, then the code to enter at
                  checkout — set in mono per identity §3 (codes & références). */}
              <VStack spacing={1} flexShrink={0}
                px={{ base: 8, md: 10 }} py={{ base: 5, md: 6 }} rounded="lg"
                bg="rgba(255,255,255,0.06)"
                border="1px dashed" borderColor="rgba(251,191,36,0.55)">
                <Text color={C.accentBorder} fontWeight="900" fontSize={{ base: '44px', md: '56px' }} lineHeight={1}>
                  15%
                </Text>
                <Text color="rgba(255,255,255,0.72)" fontSize="xs" fontWeight="600">
                  {t('promotions.off')}
                </Text>
                <Text color="white" fontFamily="'JetBrains Mono', 'Fira Code', monospace"
                  fontSize={{ base: 'sm', md: 'md' }} fontWeight="700" letterSpacing="0.14em" mt={2}>
                  FIRST15
                </Text>
              </VStack>
            </Flex>
          </Container>
        </Box>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════
          CATEGORY 1: BOISSONS — Most valued products (TOP)
      ══════════════════════════════════════════════════════════════ */}
      {(loadingCat1 || categoryProducts1.length > 0) && (
        <Box bg={THEME.boissons.bg} py={{ base: 5, md: 7 }} style={{ borderBottom: `1px solid ${C.border}` }}>
          <Container>
            <Flex align="center" justify="space-between" mb={5}>
              <SectionTitle title={t('home.rows.drinks')} badge={t('badges.topRated')} color={THEME.boissons.accent} />
              <Button variant="ghost" size="sm" fontWeight="600" fontSize="sm" h={{ base: '44px', md: 8 }} flexShrink={0}
                color={THEME.boissons.accent} _hover={{ bg: 'blackAlpha.50' }}
                rightIcon={<ChevronRight size={13} />} onClick={() => navigate('/catalog')}>
                {t('common.seeAll')}
              </Button>
            </Flex>
            <ProductRail>
              {loadingCat1
                ? Array.from({ length: 10 }).map((_, i) => (
                    <Box key={i} rounded="lg" overflow="hidden" border="1px solid" borderColor={C.border}>
                      <Skeleton h="160px" /><Box p={3}><Skeleton h="10px" mb={2} /><Skeleton h="10px" w="60%" /></Box>
                    </Box>
                  ))
                : categoryProducts1.slice(0, 10).map((p) => <PromoCard key={p.id} product={p} />)}
            </ProductRail>
          </Container>
        </Box>
      )}

      {/* ══════════════════════════════════════════════════════════════
          CATEGORY 2: PRODUITS LAITIERS — Most valued products (TOP)
      ══════════════════════════════════════════════════════════════ */}
      {(loadingCat2 || categoryProducts2.length > 0) && (
        <Box bg={THEME.laitiers.bg} py={{ base: 5, md: 7 }} style={{ borderBottom: `1px solid ${C.border}` }}>
          <Container>
            <Flex align="center" justify="space-between" mb={5}>
              <SectionTitle title={t('categories.names.Produits laitiers')} badge={t('badges.topRated')} color={THEME.laitiers.accent} />
              <Button variant="ghost" size="sm" fontWeight="600" fontSize="sm" h={{ base: '44px', md: 8 }} flexShrink={0}
                color={THEME.laitiers.accent} _hover={{ bg: 'blackAlpha.50' }}
                rightIcon={<ChevronRight size={13} />} onClick={() => navigate('/catalog')}>
                {t('common.seeAll')}
              </Button>
            </Flex>
            <ProductRail>
              {loadingCat2
                ? Array.from({ length: 10 }).map((_, i) => (
                    <Box key={i} rounded="lg" overflow="hidden" border="1px solid" borderColor={C.border}>
                      <Skeleton h="160px" /><Box p={3}><Skeleton h="10px" mb={2} /><Skeleton h="10px" w="60%" /></Box>
                    </Box>
                  ))
                : categoryProducts2.slice(0, 10).map((p) => <PromoCard key={p.id} product={p} />)}
            </ProductRail>
          </Container>
        </Box>
      )}

      {/* ══════════════════════════════════════════════════════════════
          CATEGORY 5: BISCUITERIE & CONFISERIE — Most valued products (TOP)
      ══════════════════════════════════════════════════════════════ */}
      {(loadingCat5 || categoryProducts5.length > 0) && (
        <Box bg={THEME.biscuiterie.bg} py={{ base: 5, md: 7 }} style={{ borderBottom: `1px solid ${C.border}` }}>
          <Container>
            <Flex align="center" justify="space-between" mb={5}>
              <SectionTitle title={t('categories.names.Biscuiterie et Confiserie')} badge={t('badges.topRated')} color={THEME.biscuiterie.accent} />
              <Button variant="ghost" size="sm" fontWeight="600" fontSize="sm" h={{ base: '44px', md: 8 }} flexShrink={0}
                color={THEME.biscuiterie.accent} _hover={{ bg: 'blackAlpha.50' }}
                rightIcon={<ChevronRight size={13} />} onClick={() => navigate('/catalog')}>
                {t('common.seeAll')}
              </Button>
            </Flex>
            <ProductRail>
              {loadingCat5
                ? Array.from({ length: 10 }).map((_, i) => (
                    <Box key={i} rounded="lg" overflow="hidden" border="1px solid" borderColor={C.border}>
                      <Skeleton h="160px" /><Box p={3}><Skeleton h="10px" mb={2} /><Skeleton h="10px" w="60%" /></Box>
                    </Box>
                  ))
                : categoryProducts5.slice(0, 10).map((p) => <PromoCard key={p.id} product={p} />)}
            </ProductRail>
          </Container>
        </Box>
      )}

      {/* ══════════════════════════════════════════════════════════════
          CATEGORY 3: ÉPICERIE SÈCHE — Most valued products
      ══════════════════════════════════════════════════════════════ */}
      {(loadingCat3 || categoryProducts3.length > 0) && (
        <Box bg={THEME.epicerie.bg} py={{ base: 5, md: 7 }} style={{ borderBottom: `1px solid ${C.border}` }}>
          <Container>
            <Flex align="center" justify="space-between" mb={5}>
              <SectionTitle title={t('home.rows.grocery')} badge={t('badges.topRated')} color={THEME.epicerie.accent} />
              <Button variant="ghost" size="sm" fontWeight="600" fontSize="sm" h={{ base: '44px', md: 8 }} flexShrink={0}
                color={THEME.epicerie.accent} _hover={{ bg: 'blackAlpha.50' }}
                rightIcon={<ChevronRight size={13} />} onClick={() => navigate('/catalog')}>
                {t('common.seeAll')}
              </Button>
            </Flex>
            <ProductRail>
              {loadingCat3
                ? Array.from({ length: 10 }).map((_, i) => (
                    <Box key={i} rounded="lg" overflow="hidden" border="1px solid" borderColor={C.border}>
                      <Skeleton h="160px" /><Box p={3}><Skeleton h="10px" mb={2} /><Skeleton h="10px" w="60%" /></Box>
                    </Box>
                  ))
                : categoryProducts3.slice(0, 10).map((p) => <PromoCard key={p.id} product={p} />)}
            </ProductRail>
          </Container>
        </Box>
      )}

      {/* ══════════════════════════════════════════════════════════════
          CATEGORY 4: FRUITS & LÉGUMES — Most valued products
      ══════════════════════════════════════════════════════════════ */}
      {(loadingCat4 || categoryProducts4.length > 0) && (
        <Box bg={THEME.fruits.bg} py={{ base: 5, md: 7 }} style={{ borderBottom: `1px solid ${C.border}` }}>
          <Container>
            <Flex align="center" justify="space-between" mb={5}>
              <SectionTitle title={t('home.rows.fruits')} badge={t('badges.topRated')} color={THEME.fruits.accent} />
              <Button variant="ghost" size="sm" fontWeight="600" fontSize="sm" h={{ base: '44px', md: 8 }} flexShrink={0}
                color={THEME.fruits.accent} _hover={{ bg: 'blackAlpha.50' }}
                rightIcon={<ChevronRight size={13} />} onClick={() => navigate('/catalog')}>
                {t('common.seeAll')}
              </Button>
            </Flex>
            <ProductRail>
              {loadingCat4
                ? Array.from({ length: 10 }).map((_, i) => (
                    <Box key={i} rounded="lg" overflow="hidden" border="1px solid" borderColor={C.border}>
                      <Skeleton h="160px" /><Box p={3}><Skeleton h="10px" mb={2} /><Skeleton h="10px" w="60%" /></Box>
                    </Box>
                  ))
                : categoryProducts4.slice(0, 10).map((p) => <PromoCard key={p.id} product={p} />)}
            </ProductRail>
          </Container>
        </Box>
      )}

      {/* Vidéo de présentation */}
      <VideoShowcase videos={[{ id: '0WToWtrcp_Q', title: 'Stock212 - B2B Marketplace' }]} />

      {/* ══════════════════════════════════════════════════════════════
          FEATURED PRODUCTS — Vibrant grid with attention-grabbing design
      ══════════════════════════════════════════════════════════════ */}
      {(loadingPartners || partnerProducts.length > 0) && (
        <Box bg={THEME.partners.bg} py={{ base: 5, md: 7 }} style={{
          borderBottom: `1px solid ${C.border}`,
          borderTop: `1px solid ${C.border}`
        }}>
          <Container>
            <Flex align="flex-end" justify="space-between" mb={5} gap={3}>
              <SectionTitle title={t('sections.sponsored')} badge={`🔥 ${t('sections.topRated')}`} color={THEME.partners.accent} />
              <Button size="sm" fontWeight="700" fontSize="sm" flexShrink={0} h={{ base: '44px', md: 8 }}
                bg={THEME.partners.accent} color="white" _hover={{ opacity: 0.9 }}
                rightIcon={<ChevronRight size={13} />} onClick={() => navigate('/catalog')}>
                {t('common.seeAll')}
              </Button>
            </Flex>
            <ProductRail>
              {loadingPartners
                ? Array.from({ length: 10 }).map((_, i) => (
                    <Box key={i} rounded="lg" overflow="hidden" border="2px solid" borderColor={C.warning}>
                      <Skeleton h={{ base: '140px', md: '160px' }} /><Box p={2} bg="white"><Skeleton h="8px" mb={1} /><Skeleton h="8px" w="60%" /></Box>
                    </Box>
                  ))
                : partnerProducts.slice(0, 10).map((p) => <ProductCard key={p.id} product={p} />)}
            </ProductRail>
          </Container>
        </Box>
      )}

      {/* Add more { id: <YouTube id>, title } entries to extend the switcher. */}

      {/* Pourquoi Stock212 (acheteurs, fonctionnement, garanties) — visiteurs non connectés uniquement */}
      {!user && (
        <>
        {/* ══════════════════════════════════════════════════════════════
            FOR BUYERS — Dual Value Prop
        ══════════════════════════════════════════════════════════════ */}
        <Box bg="white" py={{ base: 6, md: 9 }} style={{
          borderBottom: `1px solid ${C.border}`,
          borderTop: `1px solid ${C.border}`
        }}>
          <Container>
            <VStack spacing={2} mb={8} align="center" textAlign="center">
              <Badge bg={C.success} color="white" fontSize="xs" fontWeight="700" px={3} py={1}>
                {t('homepage.forProfessionalBuyers')}
              </Badge>
              <Heading size="lg" fontWeight="900" color={C.primary}>
                {t('homepage.forRetailers')}
              </Heading>
              <Text fontSize="sm" color={C.text} maxW="600px">
                {t('homepage.forRetailersDesc')}
              </Text>
            </VStack>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={8}>
              <VStack align="start" spacing={4}>
                <Heading size="md" fontWeight="700" color={C.primary}>{t('homepage.stopUsingOneApp')}</Heading>
                <Text color={C.text} fontSize="sm">
                  {t('homepage.stopDesc')}
                </Text>
                <VStack align="start" spacing={3} mt={2}>
                  <HStack spacing={2}>
                    <CheckCircle size={16} color={C.success} />
                    <Text fontSize="sm" fontWeight="500" color={C.primary}>{t('homepage.oneCatalog')}</Text>
                  </HStack>
                  <HStack spacing={2}>
                    <CheckCircle size={16} color={C.success} />
                    <Text fontSize="sm" fontWeight="500" color={C.primary}>{t('homepage.comparePrices')}</Text>
                  </HStack>
                  <HStack spacing={2}>
                    <CheckCircle size={16} color={C.success} />
                    <Text fontSize="sm" fontWeight="500" color={C.primary}>{t('homepage.trackOrders')}</Text>
                  </HStack>
                  <HStack spacing={2}>
                    <CheckCircle size={16} color={C.success} />
                    <Text fontSize="sm" fontWeight="500" color={C.primary}>{t('homepage.consolidateInvoicing')}</Text>
                  </HStack>
                </VStack>
              </VStack>
              <VStack align="start" spacing={4}>
                <Heading size="md" fontWeight="700" color={C.primary}>{t('homepage.accessRealWholesale')}</Heading>
                <Text color={C.text} fontSize="sm">
                  {t('homepage.accessDesc')}
                </Text>
                <VStack align="start" spacing={3} mt={2}>
                  <HStack spacing={2}>
                    <TrendingDown size={16} color={C.accent} />
                    <Text fontSize="sm" fontWeight="500" color={C.primary}>{t('homepage.bulkTiers')}</Text>
                  </HStack>
                  <HStack spacing={2}>
                    <TrendingDown size={16} color={C.accent} />
                    <Text fontSize="sm" fontWeight="500" color={C.primary}>{t('homepage.samePrice')}</Text>
                  </HStack>
                  <HStack spacing={2}>
                    <TrendingDown size={16} color={C.accent} />
                    <Text fontSize="sm" fontWeight="500" color={C.primary}>{t('homepage.noHiddenMarkups')}</Text>
                  </HStack>
                  <HStack spacing={2}>
                    <TrendingDown size={16} color={C.accent} />
                    <Text fontSize="sm" fontWeight="500" color={C.primary}>{t('homepage.directFromSellers')}</Text>
                  </HStack>
                </VStack>
              </VStack>
            </SimpleGrid>
          </Container>
        </Box>

        {/* ══════════════════════════════════════════════════════════════
            HOW IT WORKS — Process flow visualization (at bottom for engaged readers)
        ══════════════════════════════════════════════════════════════ */}
        <Box bg="white" py={{ base: 6, md: 9 }} style={{
          borderBottom: `1px solid ${C.border}`,
          borderTop: `1px solid ${C.border}`
        }}>
          <Container>
            <VStack spacing={8} align="center" textAlign="center" mb={8}>
              <VStack spacing={3}>
                <Badge bg={C.primary} color={C.accent} fontSize="xs" fontWeight="700" px={3} py={1}>
                  {t('process.title')}
                </Badge>
                <Heading size="lg" fontWeight="900" color={C.primary}>{t('process.heading')}</Heading>
                <Text fontSize="md" color={C.text} maxW="600px">
                  {t('process.description')}
                </Text>
              </VStack>
            </VStack>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={{ base: 3, md: 6 }}>
              <ProcessStep
                number={1}
                icon={Globe}
                title={t('process.step1')}
                description={t('process.step1Desc')}
              />
              <ProcessStep
                number={2}
                icon={ShieldCheck}
                title={t('process.step2')}
                description={t('process.step2Desc')}
              />
              <ProcessStep
                number={3}
                icon={Star}
                title={t('process.step3')}
                description={t('process.step3Desc')}
              />
              <ProcessStep
                number={4}
                icon={TrendingDown}
                title={t('process.step4')}
                description={t('process.step4Desc')}
              />
            </SimpleGrid>
          </Container>
        </Box>

        {/* ══════════════════════════════════════════════════════════════
            KEY FEATURES — Why choose Stock212 (at bottom)
        ══════════════════════════════════════════════════════════════ */}
        <Box bg={C.bgLight} py={{ base: 6, md: 9 }} style={{
          borderBottom: `1px solid ${C.border}`,
          borderTop: `1px solid ${C.border}`
        }}>
          <Container>
            <VStack spacing={3} mb={8} align="center" textAlign="center">
              <Badge bg={C.warning} color="white" fontSize="xs" fontWeight="700" px={3} py={1}>
                {t('features.title')}
              </Badge>
              <Heading size="lg" fontWeight="900" color={C.primary}>
                {t('features.heading')}
              </Heading>
              <Text fontSize="md" color={C.text} maxW="600px">
                {t('features.description')}
              </Text>
            </VStack>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
              {/* One accent across all four: this is the trust section, and trust
                  reads navy in this identity. The icons carry the difference. */}
              <FeatureCard
                icon={CheckCircle}
                title={t('features.verifiedSellers')}
                description={t('features.verifiedSellersDesc')}
                bgColor={C.bgAlt}
                accentColor={C.primary}
              />
              <FeatureCard
                icon={Snowflake}
                title={t('features.freshGuarantee')}
                description={t('features.freshGuaranteeDesc')}
                bgColor={C.bgAlt}
                accentColor={C.primary}
              />
              <FeatureCard
                icon={TrendingDown}
                title={t('features.bulkDiscounts')}
                description={t('features.bulkDiscountsDesc')}
                bgColor={C.bgAlt}
                accentColor={C.primary}
              />
              <FeatureCard
                icon={Globe}
                title={t('features.wideNetwork')}
                description={t('features.wideNetworkDesc')}
                bgColor={C.bgAlt}
                accentColor={C.primary}
              />
            </SimpleGrid>
          </Container>
        </Box>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════
          SELLER RECRUITMENT CTA BANNER
      ══════════════════════════════════════════════════════════════ */}
      <Box
        bg={`linear-gradient(135deg, ${C.primary} 0%, ${C.primaryLight} 100%)`}
        py={{ base: 7, md: 12 }}
        position="relative"
        overflow="hidden"
      >
        <Container>
          <Flex align="center" justify="space-between" gap={{ base: 7, md: 10 }}
            direction={{ base: 'column', md: 'row' }} textAlign={{ base: 'center', md: 'start' }}>
            <VStack align={{ base: 'center', md: 'start' }} spacing={4} flex={1}>
              <Heading size="lg" color="white" fontWeight="800" lineHeight={1.2} maxW="24ch">
                {t('sellerCTA.title')}
              </Heading>
              <Text color="rgba(255,255,255,0.78)" fontSize={{ base: 'sm', md: 'md' }} maxW="52ch">
                {t('sellerCTA.description')}
              </Text>
              <Button size="md" bg={C.accent} color="white" fontWeight="700"
                _hover={{ bg: C.accentBorder, color: C.primary }} transition="all 0.2s"
                onClick={() => navigate('/auth')}>
                {t('hero.secondaryAnon')}
              </Button>
            </VStack>
            <Box display={{ base: 'none', md: 'block' }}>
              <VStack spacing={4} align="start">
                <HStack spacing={3} align="start">
                  <Award size={22} color={C.accentBorder} />
                  <VStack spacing={0} align="start">
                    <Text fontWeight="700" color="white" fontSize="sm">{t('sellerCTA.verifiedBadge')}</Text>
                    <Text fontSize="xs" color="rgba(255,255,255,0.7)">{t('sellerCTA.fullCredibility')}</Text>
                  </VStack>
                </HStack>
                <HStack spacing={3} align="start">
                  <Eye size={22} color={C.accentBorder} />
                  <VStack spacing={0} align="start">
                    <Text fontWeight="700" color="white" fontSize="sm">{t('sellerCTA.marketIntel')}</Text>
                    <Text fontSize="xs" color="rgba(255,255,255,0.7)">{t('sellerCTA.seeRealtime')}</Text>
                  </VStack>
                </HStack>
              </VStack>
            </Box>
          </Flex>
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════════
          RÉASSURANCE — une ligne, pas une section — dernière section avant le footer
          Masquée sur mobile : redondant juste au-dessus de la nav basse.
      ══════════════════════════════════════════════════════════════ */}
      <Box style={{ background: C.bgLight }} display={{ base: 'none', md: 'block' }}>
        <Container>
          <Flex py={3} gap={0} align="center" justify="center" flexWrap="wrap">
            {[
              { Icon: ShieldCheck, label: t('trust.verified') },
              { Icon: Snowflake, label: t('trust.freshDelivery') },
              { Icon: TrendingDown, label: t('trust.bulkPrice') },
            ].map(({ Icon, label }, i) => (
              <Flex key={label} align="center">
                {i > 0 && <Box w="1px" h="14px" mx={5} style={{ background: C.border }} flexShrink={0} />}
                <Flex align="center" gap={2}>
                  <Icon size={14} color={C.accent} />
                  <Text fontSize="xs" fontWeight="600" style={{ color: C.text }}>{label}</Text>
                </Flex>
              </Flex>
            ))}
          </Flex>
        </Container>
      </Box>

      <TopSuppliersSection />
    </Box>
  );
}

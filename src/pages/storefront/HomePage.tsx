import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Box, Button, Flex, Heading, Text, VStack, HStack, Image, SimpleGrid, Skeleton, Badge, Icon, Accordion, AccordionItem, AccordionButton, AccordionPanel } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ChevronRight, ShieldCheck, Snowflake, TrendingDown, Package, Truck, Globe, Zap, Clock, Star, CheckCircle, Award, Eye, Building2, Store, ShoppingCart } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { getCatStyle } from '../../lib/categoryIcons';
import { getCategoryLabel } from '../../lib/categoryLabel';
import { ProductCard, ProductRail } from '../../components/home/ProductCard';
import { PromoBanner, VideoShowcase } from '../../components/home/HomeMedia';
import { FlashDealsSection, OrderAgainSection, BulkDealsSection, TopSuppliersSection, BusinessTypeSection } from '../../components/home/HomeShortcuts';
import type { Category, Product, Brand } from '../../types';

// Catégories mises en avant en priorité — les plus restockées par épiceries,
// hôtels, restaurants, cafés, boulangeries/pâtisseries et traiteurs.
const PRIORITY_CATEGORIES = [
  'Boissons', 'Épicerie sèche', 'Produits laitiers', 'Boucherie & Charcuterie',
  'Fruits & Légumes', 'Surgelés', 'Emballages', 'Hygiène',
];

// Marques de référence dominantes sur le marché marocain FMCG
const DOMINANT_BRANDS = ['Carolin', 'WC Net', 'Aquafresh'];

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
function Container({ children, py = 0 }: { children: React.ReactNode; py?: number }) {
  return <Box maxW="1400px" mx="auto" px={{ base: 4, md: 6 }} py={py}>{children}</Box>;
}

// Section heading: amber accent bar, optional eyebrow label above the title.
function SectionTitle({ title, badge }: { title: string; badge?: string }) {
  return (
    <Flex align="stretch" gap={3} minW={0} pe={{ base: 2, md: 0 }}>
      <Box w="4px" rounded="full" flexShrink={0} style={{ background: C.accent }} />
      <Flex align="center" gap={{ base: 2, md: 3 }} wrap="wrap" minW={0}>
        <Heading as="h2" fontSize={{ base: 'xl', md: '2xl' }} fontWeight="800" lineHeight="1.2"
          letterSpacing="-0.01em" style={{ color: C.primary }}>{title}</Heading>
        {badge && (
          <Box rounded="full" px={2.5} py={0.5} style={{ background: `${C.accent}15`, border: `1px solid ${C.accentBorder}` }}>
            <Text fontSize="11px" fontWeight="700" whiteSpace="nowrap" style={{ color: C.accent }}>{badge}</Text>
          </Box>
        )}
      </Flex>
    </Flex>
  );
}

// ── Category tile — carré plein écran, libellé en surimpression ──────────────
function CategoryTile({ category, onClick, isMore }: {
  category?: Category; onClick: () => void; isMore?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { Icon, bg, color } = category ? getCatStyle(category.name) : { Icon: undefined, bg: C.bgAlt, color: C.primary };
  const label = category ? getCategoryLabel(category, i18n.language) : '';
  return (
    <Box position="relative" w="full" rounded="lg" overflow="hidden" cursor="pointer"
      onClick={onClick} role="group" minH="44px"
      style={{ aspectRatio: '1', background: isMore ? C.primary : bg }}
      _hover={{ transform: 'scale(1.02)' }} transition="transform 0.15s ease">
      {isMore ? (
        <Flex w="full" h="full" align="center" justify="center" direction="column" gap={1.5}>
          <ChevronRight size={26} color="white" />
          <Text color="white" fontWeight="700" fontSize={{ base: '10px', md: 'xs' }}>{t('common.seeAll')}</Text>
        </Flex>
      ) : (
        <>
          {(CATEGORY_IMAGE_OVERRIDES[category?.name] || category?.image_url) ? (
            <Image src={CATEGORY_IMAGE_OVERRIDES[category?.name] || category?.image_url} alt={label} w="full" h="full" objectFit="cover"
              transition="transform 0.3s ease" _groupHover={{ transform: 'scale(1.08)' }} />
          ) : Icon ? (
            <Flex w="full" h="full" align="center" justify="center">
              <Icon size={36} color={color} />
            </Flex>
          ) : null}
          <Box position="absolute" inset={0} style={{
            background: 'linear-gradient(to top, rgba(13,31,56,0.80) 0%, rgba(13,31,56,0.05) 60%, transparent 100%)',
          }} />
          <Text position="absolute" bottom={2} insetStart={2.5} insetEnd={2} color="white" fontWeight="700"
            fontSize={{ base: '10px', md: 'xs' }} noOfLines={2} lineHeight={1.25}>
            {label}
          </Text>
        </>
      )}
    </Box>
  );
}

// ── Stats Counter Card ─────────────────────────────────────────────────────────
function StatsCard({ icon: IconComponent, label, value, color = C.primary }: {
  icon: typeof Package; label: string; value: string | number; color?: string;
}) {
  return (
    <VStack spacing={2} align="center" justify="center" p={6} rounded="xl"
      border="2px solid" borderColor={color} bg={`${color}08`}>
      <Flex w={12} h={12} rounded="lg" align="center" justify="center" style={{ background: color }}>
        <IconComponent size={24} color="white" />
      </Flex>
      <Heading size="lg" fontWeight="800" style={{ color }}>{value}</Heading>
      <Text fontSize="sm" fontWeight="600" color={C.text} textAlign="center">{label}</Text>
    </VStack>
  );
}

// ── Flash Deal Banner ──────────────────────────────────────────────────────────
function FlashDealsCallout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState('06:30:00');

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        const [h, m, s] = prev.split(':').map(Number);
        let secs = h * 3600 + m * 60 + s - 1;
        if (secs < 0) {
          secs = 23 * 3600 + 59 * 60 + 59; // Reset to 24 hours
        }
        const hours = Math.floor(secs / 3600);
        const mins = Math.floor((secs % 3600) / 60);
        const seconds = secs % 60;
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box
      position="relative"
      rounded="xl"
      overflow="hidden"
      cursor="pointer"
      onClick={() => navigate('/best-deals')}
      style={{
        background: `linear-gradient(135deg, ${C.primary} 0%, ${C.accent} 100%)`,
        boxShadow: `0 12px 32px rgba(15,23,42,0.15)`,
      }}
      _hover={{ transform: 'scale(1.02)', boxShadow: `0 16px 40px rgba(220,38,38,0.6)` }}
      transition="all 0.3s ease"
      p={{ base: 6, md: 10 }}
    >
      <Flex align="center" justify="space-between" gap={4}>
        <VStack align="start" spacing={3} flex={1}>
          <HStack spacing={2} align="baseline">
            <Zap size={24} color="white" fill="white" />
            <Heading size="xl" color="white" fontWeight="900">🔥 {t('promotions.flashDeals')}</Heading>
            <Box rounded="full" bg="white" px={2.5} py={1} minW="fit-content">
              <Text fontSize="10px" fontWeight="800" style={{ color: '#dc2626' }}>⏱️ {timeLeft}</Text>
            </Box>
          </HStack>
          <Heading size="sm" color="white" fontWeight="700">{t('promotions.limitedTime')} · {t('promotions.upTo50')}</Heading>
          <Text color="white" fontSize={{ base: 'xs', md: 'sm' }} fontWeight="500" opacity={0.95}>
            {t('promotions.endingToday')}
          </Text>
        </VStack>
        <Flex align="center" gap={2} color="white" fontWeight="800" fontSize={{ base: 'md', md: 'lg' }}>
          <Text display={{ base: 'none', md: 'block' }}>{t('promotions.shopNow')}</Text>
          <ArrowRight size={20} />
        </Flex>
      </Flex>
    </Box>
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

// ── Testimonial Card ───────────────────────────────────────────────────────────
function TestimonialCard({ name, role, company, text, stars = 5 }: {
  name: string; role: string; company: string; text: string; stars?: number;
}) {
  return (
    <Box p={6} rounded="lg" border="1px solid" borderColor={C.border} bg="white"
      _hover={{ shadow: 'md' }} transition="all 0.2s">
      <HStack spacing={1} mb={3}>
        {Array.from({ length: stars }).map((_, i) => (
          <Star key={i} size={16} fill={C.accent} color={C.accent} />
        ))}
      </HStack>
      <Text fontSize="sm" color={C.text} mb={4} fontStyle="italic">
        "{text}"
      </Text>
      <Box borderTop="1px solid" borderColor={C.border} pt={4}>
        <Text fontWeight="700" fontSize="sm" color={C.primary}>{name}</Text>
        <Text fontSize="xs" color={C.textMuted}>{role} at {company}</Text>
      </Box>
    </Box>
  );
}

// ── Product cards — thin wrappers over the shared ProductCard ────────────────
function PromoCard({ product }: { product: Product }) {
  const { t } = useTranslation();
  const isDestock = (product.stock_qty ?? 0) > 0 && (product.stock_qty ?? 0) <= 20;
  return (
    <ProductCard product={product}
      badge={isDestock ? t('badges.destock') : t('badges.promo')}
      badgeColor={isDestock ? C.warning : C.accent} />
  );
}

function MarketLeaderCard({ product }: { product: Product & { brands?: { name: string } | null } }) {
  return <ProductCard product={product} badge={product.brands?.name} badgeColor={C.primary} />;
}

// ── Bandeau de marques défilant en continu ────────────────────────────────────
function BrandMarquee({ brands }: { brands: Brand[] }) {
  if (brands.length === 0) return null;
  const doubled = [...brands, ...brands];
  return (
    <Box overflow="hidden" position="relative" w="full" py={{ base: 2, md: 4 }}
      sx={{ maskImage: 'linear-gradient(to right, transparent, black 6%, black 94%, transparent)' }}>
      <Flex w="max-content" gap={{ base: 8, md: 16 }}
        sx={{
          '@keyframes marquee': { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
          animation: 'marquee 32s linear infinite',
          '&:hover': { animationPlayState: 'paused' },
        }}>
        {doubled.map((b, i) => (
          <Flex key={`${b.id}-${i}`} align="center" justify="center" flexShrink={0}
            h={{ base: '56px', md: '72px' }} minW={{ base: '110px', md: '160px' }}>
            {b.logo_url ? (
              <Image src={b.logo_url} alt={b.name} h={{ base: '36px', md: '52px' }} w="auto" objectFit="contain"
                style={{ filter: 'grayscale(100%)', opacity: 0.55 }}
                _hover={{ filter: 'none', opacity: 1 }} transition="all 0.2s ease" />
            ) : (
              <Text fontWeight="800" fontSize={{ base: 'lg', md: '2xl' }} color="gray.300"
                _hover={{ color: C.text }} transition="color 0.2s ease">
                {b.name}
              </Text>
            )}
          </Flex>
        ))}
      </Flex>
    </Box>
  );
}

// ── Platform stat formatter ────────────────────────────────────────────────────
// Returns null when there is no real figure, so the caller omits the stat.
// It previously fell back to invented numbers ("10 000+", "500+", "200+"),
// which overstated the platform on a page whose whole job is earning trust.
function fmtStat(n: number): string | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${n.toLocaleString('fr-FR')}+`;
}

// ── Countdown to local midnight ────────────────────────────────────────────────
// Daily deals really do reset at midnight, so this figure is true. The banner
// used to print a frozen literal ("06:30:00") that never moved.
function msUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

function useMidnightCountdown(): string {
  const [remaining, setRemaining] = useState(msUntilMidnight);
  useEffect(() => {
    const id = setInterval(() => setRemaining(msUntilMidnight()), 1000);
    return () => clearInterval(id);
  }, []);
  const total = Math.max(0, Math.floor(remaining / 1000));
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

// ═════════════════════════════════════════════════════════════════════════════
export default function HomePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const dealsResetIn = useMidnightCountdown();

  const [platformCounts, setPlatformCounts] = useState({ products: 0, vendors: 0, delivery: 0 });
  const [subCategories, setSubCategories] = useState<Category[]>([]);
  const [promos, setPromos] = useState<Product[]>([]);
  const [loadingPromos, setLoadingPromos] = useState(true);
  const [partnerProducts, setPartnerProducts] = useState<Product[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(true);
  const promoStripRef = useRef<HTMLDivElement>(null);
  const promoPaused = useRef(false);
  const [marketLeaders, setMarketLeaders] = useState<Product[]>([]);
  const [loadingLeaders, setLoadingLeaders] = useState(true);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [loadingNew, setLoadingNew] = useState(true);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [currentImageIdx, setCurrentImageIdx] = useState(0);
  // The ads strip has its own index: it holds six images to the hero's three,
  // and sharing one counter let an ad dot drive the hero past its last image.
  const [adIdx, setAdIdx] = useState(0);
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

  // Hero and ads advance on their own clocks, each bounded by its own length.
  useEffect(() => {
    const hero = setInterval(() => {
      setCurrentImageIdx((prev) => (prev + 1) % CAROUSEL_IMAGES.length);
    }, 6000);
    const ads = setInterval(() => {
      setAdIdx((prev) => (prev + 1) % AD_IMAGES.length);
    }, 5000);
    return () => { clearInterval(hero); clearInterval(ads); };
  }, []);

  // Promo strip drifts left on its own; pauses while hovered or touched and
  // wraps back to the start when it reaches the end.
  useEffect(() => {
    const el = promoStripRef.current;
    if (!el || loadingPromos) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => {
      if (promoPaused.current) return;
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 1) el.scrollLeft = 0;
      else el.scrollLeft += 1;
    }, 20);
    return () => clearInterval(id);
  }, [loadingPromos, promos.length]);

  useEffect(() => {
    Promise.all([
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('organisations').select('id', { count: 'exact', head: true }).eq('org_type', 'seller').eq('validation_status', 'active'),
      supabase.from('organisations').select('id', { count: 'exact', head: true }).eq('org_type', 'delivery').eq('validation_status', 'active'),
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

    // Promotions + déstockage réunis dans un seul carrousel
    supabase.from('products').select('*, organisations(name), price_tiers(*)')
      .eq('status', 'active').or('is_on_promotion.eq.true,stock_qty.lte.20')
      .order('stock_qty', { ascending: true, nullsFirst: false })
      .limit(12)
      .then(({ data }) => { setPromos((data as Product[]) ?? []); setLoadingPromos(false); });

    // Sélection partenaires — produits normaux (ni promo ni déstockage)
    supabase.from('products').select('*, organisations(name), price_tiers(*)')
      .eq('status', 'active').eq('is_on_promotion', false).gt('stock_qty', 20)
      .order('avg_rating', { ascending: false })
      .limit(200)
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

    // Références dominantes du marché marocain — marques leaders
    supabase.from('brands').select('id').in('name', DOMINANT_BRANDS)
      .then(({ data }) => {
        const ids = (data ?? []).map((b) => b.id);
        if (ids.length === 0) { setLoadingLeaders(false); return; }
        supabase.from('products').select('*, organisations(name), price_tiers(*), brands(name)')
          .eq('status', 'active').in('brand_id', ids).limit(12)
          .then(({ data: prodData }) => {
            setMarketLeaders((prodData as Product[]) ?? []);
            setLoadingLeaders(false);
          });
      });

    // Seules les marques effectivement portées par un produit actif apparaissent
    // dans le bandeau — évite d'afficher des marques orphelines (ex. anciens
    // fournisseurs de démo retirés de la plateforme).
    supabase.from('products').select('brand_id').eq('status', 'active').not('brand_id', 'is', null)
      .then(({ data }) => {
        const brandIds = [...new Set((data ?? []).map((p) => p.brand_id))];
        if (brandIds.length === 0) return;
        supabase.from('brands').select('*').in('id', brandIds).limit(16)
          .then(({ data: brandData }) => setBrands((brandData as Brand[]) ?? []));
      });

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

  // Sous-catégories triées : celles restockées par ce public en premier, le reste ensuite
  const orderedCategories = [...subCategories].sort((a, b) => {
    const ia = PRIORITY_CATEGORIES.indexOf(a.name);
    const ib = PRIORITY_CATEGORIES.indexOf(b.name);
    if (ia === -1 && ib === -1) return a.display_order - b.display_order;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

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


      <FlashDealsSection />

      {/* ══════════════════════════════════════════════════════════════
          KPI BAR — chiffres clés de la plateforme
      ══════════════════════════════════════════════════════════════ */}
      <Box bg={C.bgAlt} py={{ base: 6, sm: 8, md: 10 }} mt={{ base: -5, md: -8 }} position="relative" zIndex={2}
        style={{ borderBottom: `1px solid ${C.divider}` }}>
        <Container>
          {/* Proof, then the two ways in. The numbers earn the click, so the
              buttons sit beside them rather than on top of the poster. */}
          <Flex direction={{ base: 'column', lg: 'row' }} align="center" gap={{ base: 6, lg: 12 }}>
            <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={{ base: 5, sm: 8, md: 10 }} flex={1} w="full">
              {[
                { icon: Package,     v: fmtStat(platformCounts.products), l: t('stats.activeProducts') },
                { icon: ShieldCheck, v: fmtStat(platformCounts.vendors),  l: t('stats.verifiedVendors') },
                { icon: Truck,       v: fmtStat(platformCounts.delivery), l: t('stats.deliveryPartners') },
              ].filter(({ v }) => v !== null).map(({ icon: IconComponent, v, l }) => (
                <Flex key={l} align="center" gap={{ base: 3, md: 4 }}>
                  <Flex w={{ base: 10, sm: 11, md: 12 }} h={{ base: 10, sm: 11, md: 12 }} rounded="full" align="center" justify="center"
                    flexShrink={0} style={{ background: C.primary }}>
                    <Icon as={IconComponent} boxSize={{ base: '18px', md: '20px' }} color="white" />
                  </Flex>
                  <Box minW={0} flex={1}>
                    <Text fontWeight="900" fontSize={{ base: '20px', md: '28px' }} style={{ color: C.primary }} lineHeight={1.15}>
                      {v}
                    </Text>
                    <Text fontSize={{ base: 'xs', md: 'sm' }} fontWeight="600" mt={0.5} style={{ color: C.textMuted }} noOfLines={2}>
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
      <Box bg="white" py={7} style={{ borderBottom: `1px solid ${C.border}`, overflow: 'hidden' }}>
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
        `}</style>
        <Box className="brands-auto-scroll">
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
              <Box key={i} flexShrink={0} w="140px">
                <Image src={brand.logo} alt={brand.name} h="80px" objectFit="contain"
                  _hover={{ transform: 'scale(1.1)' }} transition="all 0.2s" cursor="pointer" />
              </Box>
            ));
          })()}
        </Box>
      </Box>

      {/* ══════════════════════════════════════════════════════════════
          CATÉGORIES — Circular category display with images
      ══════════════════════════════════════════════════════════════ */}
      <Box bg="white" py={8} style={{ borderBottom: `1px solid ${C.border}` }}>
        <Container>
          <Flex align="center" justify="space-between" mb={8}>
            <SectionTitle title={t('categories.title')} />
            <Button variant="ghost" size="sm" fontWeight="600" fontSize="sm" h={{ base: '44px', md: 8 }} flexShrink={0}
              color={C.text} _hover={{ color: C.accent, bg: 'transparent' }}
              rightIcon={<ChevronRight size={13} />} onClick={() => navigate('/catalog')}>
              {t('common.seeAll')}
            </Button>
          </Flex>

          {/* The 6 most common FMCG categories */}
          <SimpleGrid columns={{ base: 3, md: 6 }} spacing={{ base: 4, md: 6 }} w="full">
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
              <Flex key={cat.name} direction="column" align="center" gap={3} cursor="pointer"
                onClick={() => {
                  const found = subCategories.find((c) => c.name.toLowerCase().includes(cat.match));
                  navigate(found ? `/catalog?category=${found.id}` : '/catalog');
                }} _hover={{ transform: 'translateY(-4px)' }}
                transition="all 0.2s">
                <Box position="relative" w={{ base: '80px', sm: '100px', md: '120px' }} h={{ base: '80px', sm: '100px', md: '120px' }}
                  rounded="full" overflow="hidden" bg={cat.image ? C.bgAlt : bg} border="3px solid" borderColor={C.border}
                  _hover={{ borderColor: C.accent, boxShadow: `0 0 0 2px ${C.accent}20` }} transition="all 0.3s">
                  {cat.image ? (
                    <Image src={cat.image} alt={cat.name} w="full" h="full" objectFit="cover" />
                  ) : (
                    <Flex w="full" h="full" align="center" justify="center">
                      {CatIcon && <CatIcon size={40} color={color} />}
                    </Flex>
                  )}
                </Box>
                <Text fontSize={{ base: '11px', sm: 'xs', md: 'sm' }} fontWeight="600" textAlign="center"
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

      <BulkDealsSection />

      {/* ══════════════════════════════════════════════════════════════
          FEATURED PRODUCTS — Vibrant grid with attention-grabbing design
      ══════════════════════════════════════════════════════════════ */}
      {(loadingPartners || partnerProducts.length > 0) && (
        <Box bg={C.bg} py={{ base: 5, md: 7 }} style={{
          borderBottom: `1px solid ${C.border}`,
          borderTop: `1px solid ${C.border}`
        }}>
          <Container>
            <Flex align="flex-end" justify="space-between" mb={5} gap={3}>
              <SectionTitle title={t('sections.sponsored')} badge={`🔥 ${t('sections.topRated')}`} />
              <Button size="sm" fontWeight="700" fontSize="sm" flexShrink={0} h={{ base: '44px', md: 8 }}
                bg={C.warning} color="white" _hover={{ bg: C.warningDark }}
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
                <HStack spacing={1.5} rounded="full" px={3} py={1} bg="rgba(0,0,0,0.3)" color="white">
                  <Clock size={13} />
                  <Text fontSize="11px" fontWeight="700" fontFamily="'JetBrains Mono', 'Fira Code', monospace">{dealsResetIn}</Text>
                </HStack>
              </HStack>
              <Button size="sm" fontWeight="800" fontSize="sm" h={{ base: '36px', md: 8 }} bg="white" color={C.warning}
                _hover={{ bg: C.accentBorder, color: C.primary }}
                rightIcon={<ChevronRight size={14} />} onClick={() => navigate('/best-deals')}>
                {t('common.seeAll')}
              </Button>
            </Flex>
            <Box position="relative">
            {(['left', 'right'] as const).map((dir) => (
              <Box key={dir} as="button" type="button" aria-label={dir === 'left' ? 'Précédent' : 'Suivant'}
                position="absolute" top="50%" {...(dir === 'left' ? { insetStart: -2 } : { insetEnd: -2 })}
                transform="translateY(-50%)" zIndex={3} w={9} h={9} rounded="full" bg="white" color={C.warning}
                display={{ base: 'none', md: 'flex' }} alignItems="center" justifyContent="center"
                boxShadow="0 2px 8px rgba(0,0,0,0.3)" _hover={{ bg: C.accentBorder, color: C.primary }}
                onClick={() => promoStripRef.current?.scrollBy({ left: dir === 'left' ? -400 : 400, behavior: 'smooth' })}>
                <ChevronRight size={18} style={{ transform: dir === 'left' ? 'rotate(180deg)' : undefined }} />
              </Box>
            ))}
            <Flex ref={promoStripRef} gap={3} overflowX="auto" pb={1}
              onMouseEnter={() => { promoPaused.current = true; }}
              onMouseLeave={() => { promoPaused.current = false; }}
              onTouchStart={() => { promoPaused.current = true; }}
              onTouchEnd={() => { promoPaused.current = false; }}
              style={{ scrollbarWidth: 'none' }} sx={{ '&::-webkit-scrollbar': { display: 'none' } }}>
              {loadingPromos
                ? Array.from({ length: 8 }).map((_, i) => (
                    <Box key={i} flexShrink={0} w="192px" rounded="lg" overflow="hidden"
                      border="1px solid" borderColor={C.border}>
                      <Skeleton h="155px" /><Box p={3}><Skeleton h="10px" mb={2} /><Skeleton h="10px" w="60%" /></Box>
                    </Box>
                  ))
                : promos.map((p) => <PromoCard key={p.id} product={p} />)}
            </Flex>
            </Box>
          </Container>
        </Box>
      )}

      {/* ══════════════════════════════════════════════════════════════
          IMAGE ADS CAROUSEL — Moving promotional ads with full image display
      ══════════════════════════════════════════════════════════════ */}
      <Box bg="white" py={0} style={{ borderBottom: `1px solid ${C.border}` }}>
        <Box position="relative" w="full" bg="#f9fafb">
          <Flex w="full" h={{ base: '220px', sm: '350px', md: '450px' }} overflow="hidden" align="center" justify="center">
            <Image src={AD_IMAGES[adIdx]} alt="" loading="lazy" w="full" h="full" objectFit="contain"
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

      <BusinessTypeSection />

      <PromoBanner title="Livraison gratuite" subtitle="Dès votre première commande en gros" cta="Commander" to="/catalog"
        from="#7c4a0d" via="#a96510" toColor="#c97d1a" />

      {/* ══════════════════════════════════════════════════════════════
          CATEGORY 1: BOISSONS — Most valued products (TOP)
      ══════════════════════════════════════════════════════════════ */}
      {(loadingCat1 || categoryProducts1.length > 0) && (
        <Box bg={C.bgAlt} py={7} style={{ borderBottom: `1px solid ${C.border}` }}>
          <Container>
            <Flex align="center" justify="space-between" mb={5}>
              <SectionTitle title="Top Boissons & Rafraîchissements" badge={t('badges.topRated')} />
              <Button variant="ghost" size="sm" fontWeight="600" fontSize="sm" h={{ base: '44px', md: 8 }} flexShrink={0}
                color={C.text} _hover={{ color: C.accent, bg: 'transparent' }}
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
        <Box bg={C.bgAlt} py={7} style={{ borderBottom: `1px solid ${C.border}` }}>
          <Container>
            <Flex align="center" justify="space-between" mb={5}>
              <SectionTitle title={t('categories.names.Produits laitiers')} badge={t('badges.topRated')} />
              <Button variant="ghost" size="sm" fontWeight="600" fontSize="sm" h={{ base: '44px', md: 8 }} flexShrink={0}
                color={C.text} _hover={{ color: C.accent, bg: 'transparent' }}
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
        <Box bg="white" py={7} style={{ borderBottom: `1px solid ${C.border}` }}>
          <Container>
            <Flex align="center" justify="space-between" mb={5}>
              <SectionTitle title={t('categories.names.Biscuiterie et Confiserie')} badge={t('badges.topRated')} />
              <Button variant="ghost" size="sm" fontWeight="600" fontSize="sm" h={{ base: '44px', md: 8 }} flexShrink={0}
                color={C.text} _hover={{ color: C.accent, bg: 'transparent' }}
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

      <PromoBanner title="Biscuiterie -15%" subtitle="Sur toute la gamme biscuiterie & confiserie" to="/catalog" />

      {/* ══════════════════════════════════════════════════════════════
          CATEGORY 3: ÉPICERIE SÈCHE — Most valued products
      ══════════════════════════════════════════════════════════════ */}
      {(loadingCat3 || categoryProducts3.length > 0) && (
        <Box bg={C.bgAlt} py={7} style={{ borderBottom: `1px solid ${C.border}` }}>
          <Container>
            <Flex align="center" justify="space-between" mb={5}>
              <SectionTitle title="Épicerie Sèche & Essentiels" badge={t('badges.topRated')} />
              <Button variant="ghost" size="sm" fontWeight="600" fontSize="sm" h={{ base: '44px', md: 8 }} flexShrink={0}
                color={C.text} _hover={{ color: C.accent, bg: 'transparent' }}
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
        <Box bg="white" py={7} style={{ borderBottom: `1px solid ${C.border}` }}>
          <Container>
            <Flex align="center" justify="space-between" mb={5}>
              <SectionTitle title="Fruits & Légumes Frais" badge={t('badges.topRated')} />
              <Button variant="ghost" size="sm" fontWeight="600" fontSize="sm" h={{ base: '44px', md: 8 }} flexShrink={0}
                color={C.text} _hover={{ color: C.accent, bg: 'transparent' }}
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

      {/* ══════════════════════════════════════════════════════════════
          RÉFÉRENCES DOMINANTES — Grid + Carousel for market leaders
      ══════════════════════════════════════════════════════════════ */}
      {(loadingLeaders || marketLeaders.length > 0) && (
        <>
          <Box bg="white" py={7} style={{ borderBottom: `1px solid ${C.border}` }}>
            <Container>
              <Flex align="center" justify="space-between" mb={5}>
                <SectionTitle title={t('sections.marketLeaders')} badge="Top Rated" />
                <Button variant="ghost" size="sm" fontWeight="600" fontSize="sm" h={{ base: '44px', md: 8 }} flexShrink={0}
                  color={C.text} _hover={{ color: C.accent, bg: 'transparent' }}
                  rightIcon={<ChevronRight size={13} />} onClick={() => navigate('/catalog')}>
                  {t('common.seeAll')}
                </Button>
              </Flex>
              <ProductRail>
                {loadingLeaders
                  ? Array.from({ length: 10 }).map((_, i) => (
                      <Box key={i} rounded="lg" overflow="hidden" border="1px solid" borderColor={C.border}>
                        <Skeleton h="160px" /><Box p={3}><Skeleton h="10px" mb={2} /><Skeleton h="10px" w="60%" /></Box>
                      </Box>
                    ))
                  : marketLeaders.map((p) => <MarketLeaderCard key={p.id} product={p} />)}
              </ProductRail>
            </Container>
          </Box>

        </>
      )}

      {/* ══════════════════════════════════════════════════════════════
          NEW ARRIVALS — Latest products added to the platform
      ══════════════════════════════════════════════════════════════ */}
      {(loadingNew || newArrivals.length > 0) && (
        <Box bg={C.bgLight} py={7} style={{ borderBottom: `1px solid ${C.border}` }}>
          <Container>
            <Flex align="center" justify="space-between" mb={5}>
              <SectionTitle title={t('promos.newArrivals')} />
              <Button variant="ghost" size="sm" fontWeight="600" fontSize="sm" h={{ base: '44px', md: 8 }} flexShrink={0}
                color={C.text} _hover={{ color: C.accent, bg: 'transparent' }}
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

      <TopSuppliersSection />

      {/* Add more { id: <YouTube id>, title } entries to extend the switcher. */}
      <VideoShowcase videos={[{ id: '0WToWtrcp_Q', title: 'Stock212 - B2B Marketplace' }]} />

      {/* ══════════════════════════════════════════════════════════════
          FOR BUYERS — Dual Value Prop
      ══════════════════════════════════════════════════════════════ */}
      <Box bg="white" py={9} style={{
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
          FOR SELLERS — Dual section: Visibility + Destocking
      ══════════════════════════════════════════════════════════════ */}
      <Box bg={C.bgAlt} py={9} style={{ borderBottom: `1px solid ${C.border}` }}>
        <Container>
          <Heading size="lg" fontWeight="800" textAlign="center" mb={8} color={C.primary}>
            {t('homepage.forManufacturers')}
          </Heading>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={8} mb={8}>
            <Box p={6} rounded="lg" bg="white" border="1px solid" borderColor={C.border}>
              <HStack spacing={3} mb={4}>
                <Flex w={10} h={10} rounded="lg" align="center" justify="center"
                  style={{ background: C.divider }}>
                  <Eye size={20} color={C.primary} />
                </Flex>
                <Heading size="md" fontWeight="700" color={C.primary}>{t('homepage.seeYourMarket')}</Heading>
              </HStack>
              <Text color={C.text} fontSize="sm" mb={4}>
                {t('homepage.seeYourMarketDesc')}
              </Text>
              <VStack align="start" spacing={2}>
                <HStack spacing={2}>
                  <Star size={14} fill={C.accent} color={C.accent} />
                  <Text fontSize="sm" fontWeight="500" color={C.primary}>{t('homepage.referencingMap')}</Text>
                </HStack>
                <HStack spacing={2}>
                  <Star size={14} fill={C.accent} color={C.accent} />
                  <Text fontSize="sm" fontWeight="500" color={C.primary}>{t('homepage.competitorTracked')}</Text>
                </HStack>
                <HStack spacing={2}>
                  <Star size={14} fill={C.accent} color={C.accent} />
                  <Text fontSize="sm" fontWeight="500" color={C.primary}>{t('homepage.promotionExecution')}</Text>
                </HStack>
                <HStack spacing={2}>
                  <Star size={14} fill={C.accent} color={C.accent} />
                  <Text fontSize="sm" fontWeight="500" color={C.primary}>{t('homepage.newOpportunities')}</Text>
                </HStack>
              </VStack>
            </Box>
            <Box p={6} rounded="lg" bg="white" border="1px solid" borderColor={C.border}>
              <HStack spacing={3} mb={4}>
                <Flex w={10} h={10} rounded="lg" align="center" justify="center"
                  style={{ background: C.accentLight }}>
                  <Zap size={20} color={C.accent} />
                </Flex>
                <Heading size="md" fontWeight="700" color={C.primary}>{t('destocking.title')}</Heading>
              </HStack>
              <Text color={C.text} fontSize="sm" mb={4}>
                {t('destocking.description')}
              </Text>
              <VStack align="start" spacing={2}>
                <HStack spacing={2}>
                  <Zap size={14} fill={C.warning} color={C.warning} />
                  <Text fontSize="sm" fontWeight="500" color={C.primary}>{t('destocking.oneClick')}</Text>
                </HStack>
                <HStack spacing={2}>
                  <Zap size={14} fill={C.warning} color={C.warning} />
                  <Text fontSize="sm" fontWeight="500" color={C.primary}>{t('destocking.automaticAlerts')}</Text>
                </HStack>
                <HStack spacing={2}>
                  <Zap size={14} fill={C.warning} color={C.warning} />
                  <Text fontSize="sm" fontWeight="500" color={C.primary}>{t('destocking.recoverValue')}</Text>
                </HStack>
                <HStack spacing={2}>
                  <Zap size={14} fill={C.warning} color={C.warning} />
                  <Text fontSize="sm" fontWeight="500" color={C.primary}>{t('destocking.zeroWaste')}</Text>
                </HStack>
              </VStack>
            </Box>
          </SimpleGrid>
          <Box p={6} rounded="lg" bg={`linear-gradient(135deg, #dbeafe 0%, #fef3c7 100%)`}
            border="2px solid" borderColor={C.accentBorder}>
            <HStack spacing={3} mb={3}>
              <Flex w={10} h={10} rounded="lg" align="center" justify="center"
                style={{ background: C.primary }}>
                <Text fontWeight="800" fontSize="lg" color="white">0%</Text>
              </Flex>
              <Heading size="md" fontWeight="700" color={C.primary}>{t('commission.zeroCommission')}</Heading>
            </HStack>
            <Text color={C.text} fontSize="sm">
              {t('commission.description')}
            </Text>
          </Box>
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════════
          SELLER RECRUITMENT CTA BANNER
      ══════════════════════════════════════════════════════════════ */}
      <Box
        bg={`linear-gradient(135deg, ${C.primary} 0%, ${C.primaryLight} 100%)`}
        py={{ base: 9, md: 12 }}
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
          PROFESSIONAL SOLUTIONS — Image carousel showcase
      ══════════════════════════════════════════════════════════════ */}
      <Box bg="white" py={7} style={{ borderBottom: `1px solid ${C.border}` }}>
        <Container>
          <Heading size="sm" fontWeight="800" mb={6} textAlign="center" style={{ color: C.textMuted }}>
            {t('process.heading')}
          </Heading>
        </Container>
        <Box style={{ position: 'relative', overflow: 'hidden', width: '100%' }}>
          <style>{`
            @keyframes slide-professional {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            .professional-carousel {
              display: flex;
              gap: 1.5rem;
              width: max-content;
              animation: slide-professional 40s linear infinite;
              padding: 0 1rem;
            }
            .professional-carousel:hover {
              animation-play-state: paused;
            }
          `}</style>
          <Box className="professional-carousel">
            {(() => {
              const images = [
                '/professional/ChatGPT Image Sep 12, 2026, 09_41_56 PM.png',
                '/professional/ChatGPT Image Sep 12, 2026, 09_43_45 PM.png',
                '/professional/ChatGPT Image Sep 12, 2026, 10_07_34 PM.png',
                '/professional/ChatGPT Image Sep 12, 2026, 10_09_04 PM.png',
                '/professional/ChatGPT Image Sep 12, 2026, 10_11_30 PM.png',
                '/professional/ChatGPT Image Sep 12, 2026, 10_11_53 PM.png',
                '/professional/ChatGPT Image Sep 12, 2026, 10_12_04 PM.png',
              ];
              return [...images, ...images].map((img, i) => (
                <Box key={i} flexShrink={0} w={{ base: '280px', sm: '340px', md: '400px' }} rounded="lg" overflow="hidden">
                  <Image src={img} alt={`Professional solution ${i + 1}`} w="100%" h="auto" objectFit="cover"
                    _hover={{ transform: 'scale(1.05)' }} transition="all 0.3s" />
                </Box>
              ));
            })()}
          </Box>
        </Box>
      </Box>

      {/* ══════════════════════════════════════════════════════════════
          CTA NEWSLETTER — Engagement section (just before footer)
      ══════════════════════════════════════════════════════════════ */}
      <Box bg={`linear-gradient(135deg, ${C.primary} 0%, ${C.primaryLight} 100%)`} py={9}
        style={{ borderBottom: `3px solid ${C.accent}` }}>
        <Container>
          <VStack spacing={5} align="center" textAlign="center">
            <VStack spacing={2}>
              <Heading size="lg" color="white" fontWeight="800">
                {t('newsletter.title')}
              </Heading>
              <Text color="white" opacity={0.9} fontSize={{ base: 'sm', md: 'md' }}>
                {t('newsletter.description')}
              </Text>
            </VStack>
            <Flex maxW="400px" w="full" gap={2}>
              <input
                type="email"
                placeholder={t('newsletter.placeholder')}
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: '44px',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
              <Button size="sm" h="44px" flexShrink={0} bg={C.accent} color="white" fontWeight="700"
                _hover={{ opacity: 0.9 }}>
                {t('newsletter.subscribe')}
              </Button>
            </Flex>
            <Text fontSize="xs" color="white" opacity={0.7}>
              {t('newsletter.noSpam')}
            </Text>
          </VStack>
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════════
          HOW IT WORKS — Process flow visualization (at bottom for engaged readers)
      ══════════════════════════════════════════════════════════════ */}
      <Box bg="white" py={9} style={{
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
      <Box bg={C.bgLight} py={9} style={{
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
    </Box>
  );
}

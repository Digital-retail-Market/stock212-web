/**
 * Tous les blocs merchandising de la homepage et des pages acheteur.
 * Chaque bloc a un fallback statique quand aucune campagne n'est active.
 *
 * Blocs exportés :
 *  TopBannerBlock        — TopBanner_Desktop_WC
 *  VentesFlashBlock      — VentesFlash_Block
 *  ExtraRemiseBlock      — ExtraRemise_Block
 *  RecommandePourVous    — RecommandéPourVous
 *  CategoryBlock         — Category_Supermarché / Category_x / Category_y
 *  DealOfDayBlock        — Deal_Of_The_Day
 *  FooterBannerBlock     — Homepage_Footer_Banner
 *  SearchSponsoredBlock  — Search_Sponsored  (utilisé dans CatalogPage)
 *  RFQBoostBlock         — RFQ_Boost_Slot
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box, Flex, Text, Heading, Button, HStack, SimpleGrid,
  Image, Badge, IconButton, Progress,
} from '@chakra-ui/react';
import {
  ChevronLeft, ChevronRight, Zap,
  Percent, ShoppingCart, Clock, Star, ArrowRight, Lock, Package,
  TrendingUp, MessageSquare,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import type {
  TopBannerCampaign, DealOfDayCampaign, FooterBannerCampaign,
  ExtraRemiseCampaign, CategoryRowCampaign,
} from '../../hooks/useMarketingStorefront';
import type { RFQPost } from '../../types/marketing';
import type { Product, Category } from '../../types';

// ── Brand tokens ──────────────────────────────────────────────────────────────
const C = {
  navy: '#0d1f38', navyMid: '#1a3558',
  amber: '#c97d1a', amberLight: '#fef3c7', amberBorder: '#fbbf24',
  red: '#be1c1c', redLight: '#fff1f1', redBorder: '#fca5a5',
  green: '#1a5c35', greenLight: '#dcfce7', greenBorder: '#86efac',
  teal: '#0f766e', tealLight: '#f0fdfa', tealBorder: '#99f6e4',
  slate: '#334155', muted: '#64748b',
  border: '#e2e8f0', bgAlt: '#f8fafc',
};

// ── Shared helpers ─────────────────────────────────────────────────────────────
function SponsoredBadge() {
  const { t } = useTranslation();
  return (
    <Box rounded="sm" px={2} py={0.5}
      style={{ background: C.amberLight, border: `1px solid ${C.amberBorder}` }}>
      <Text fontSize="8px" fontWeight="800" letterSpacing="1px"
        textTransform="uppercase" style={{ color: '#92400e' }}>
        {t('homepageBlocks.sponsored')}
      </Text>
    </Box>
  );
}

function SectionHead({ eyebrow, title, accentColor, right, onAction, actionLabel }: {
  eyebrow?: string; title: string; accentColor?: string;
  right?: React.ReactNode; onAction?: () => void; actionLabel?: string;
}) {
  const { t } = useTranslation();
  const { lang } = useLanguage();
  const accent = accentColor ?? C.amber;
  const isRTL = lang === 'ar';
  return (
    <Flex align="center" justify="space-between" mb={6} dir={isRTL ? 'rtl' : 'ltr'}>
      <Box style={{ borderLeft: isRTL ? 'none' : `3px solid ${accent}`, borderRight: isRTL ? `3px solid ${accent}` : 'none', paddingLeft: isRTL ? '0' : '14px', paddingRight: isRTL ? '14px' : '0' }}>
        {eyebrow && (
          <Text fontSize="10px" fontWeight="800" letterSpacing="2px"
            textTransform="uppercase" mb={0.5} style={{ color: accent }}>
            {eyebrow}
          </Text>
        )}
        <Heading size="md" fontWeight="800" style={{ color: C.navy }}>{title}</Heading>
      </Box>
      <HStack spacing={2}>
        {right}
        {onAction && (
          <Button variant="ghost" size="sm" fontWeight="600" fontSize="sm"
            color={C.slate} rightIcon={!isRTL ? <ChevronRight size={13} /> : undefined}
            leftIcon={isRTL ? <ChevronLeft size={13} /> : undefined}
            _hover={{ color: accent, bg: 'transparent' }} onClick={onAction}>
            {actionLabel ?? t('common.seeAll')}
          </Button>
        )}
      </HStack>
    </Flex>
  );
}

function Carousel({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = useCallback((dir: 'left' | 'right') => {
    if (ref.current) ref.current.scrollLeft += dir === 'right' ? 340 : -340;
  }, []);
  return (
    <Box position="relative">
      <IconButton aria-label="←" icon={<ChevronLeft size={16} />}
        position="absolute" left="-14px" top="50%" transform="translateY(-50%)"
        zIndex={10} size="sm" bg="white" shadow="md" border="1px" borderColor={C.border}
        rounded="full" display={{ base: 'none', md: 'flex' }}
        _hover={{ bg: C.amberLight, color: C.amber }} onClick={() => scroll('left')} />
      <Box ref={ref} display="flex" gap={3} overflowX="auto" pb={1}
        style={{ scrollBehavior: 'smooth', scrollbarWidth: 'none' }}
        sx={{ '&::-webkit-scrollbar': { display: 'none' } }}>
        {children}
      </Box>
      <IconButton aria-label="→" icon={<ChevronRight size={16} />}
        position="absolute" right="-14px" top="50%" transform="translateY(-50%)"
        zIndex={10} size="sm" bg="white" shadow="md" border="1px" borderColor={C.border}
        rounded="full" display={{ base: 'none', md: 'flex' }}
        _hover={{ bg: C.amberLight, color: C.amber }} onClick={() => scroll('right')} />
    </Box>
  );
}

function MiniProductCard({ p }: { p: Product }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const first = p.price_tiers?.sort((a, b) => a.qty_min - b.qty_min)[0];
  return (
    <Box flexShrink={0} w={{ base: '155px', md: '188px' }} bg="white" rounded="lg"
      overflow="hidden" border="1px solid" borderColor={C.border}
      cursor="pointer" role="group"
      _hover={{ shadow: 'md', transform: 'translateY(-3px)', borderColor: C.amberBorder }}
      transition="all 0.2s" onClick={() => navigate(`/product/${p.id}`)}>
      <Box h="145px" overflow="hidden" bg={C.bgAlt}>
        {p.images?.[0]
          ? <Image src={p.images[0]} alt={p.name} w="full" h="full" objectFit="cover"
              _groupHover={{ transform: 'scale(1.05)' }} transition="transform 0.35s" />
          : <Flex w="full" h="full" align="center" justify="center">
              <Text fontWeight="900" fontSize="4xl" color="gray.200">{p.name.charAt(0)}</Text>
            </Flex>}
      </Box>
      <Box p={3}>
        <Text fontSize="9px" fontWeight="700" noOfLines={1} mb={0.5}
          textTransform="uppercase" letterSpacing="0.6px" style={{ color: C.amber }}>
          {p.organisations?.name ?? p.brands?.name ?? t('homepageBlocks.seller')}
        </Text>
        <Text fontWeight="600" color="gray.800" fontSize="xs" noOfLines={2} lineHeight={1.4} mb={1.5}>
          {p.name}
        </Text>
        {user && first
          ? <Text fontWeight="800" fontSize="sm" style={{ color: C.navy }}>
              {first.unit_price.toFixed(2)} <Text as="span" fontSize="9px" fontWeight="500" color="gray.400">{p.currency}</Text>
            </Text>
          : <HStack spacing={1} cursor="pointer" onClick={e => { e.stopPropagation(); navigate('/auth'); }}>
              <Lock size={9} color={C.muted} />
              <Text fontSize="9px" fontWeight="600" style={{ color: C.slate }}>{t('homepageBlocks.seePrice')}</Text>
            </HStack>
        }
      </Box>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. TopBannerBlock — TopBanner_Desktop_WC
// ═══════════════════════════════════════════════════════════════════════════════

export function TopBannerBlock({ campaigns }: { campaigns: TopBannerCampaign[] }) {
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);
  const slides = campaigns.map(c => ({
    bg: c.bg_color ?? `linear-gradient(135deg, ${C.navy}, #254b7a)`,
    headline: c.headline ?? c.name,
    subline: c.subline ?? '',
    cta_text: c.cta_text ?? 'Découvrir',
    cta_link: c.cta_link ?? '/catalog',
    accentColor: C.amber,
    imageUrl: c.image_url,
    sponsored: false,
  }));

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(() => setIdx(i => (i + 1) % slides.length), 5000);
    return () => clearInterval(id);
  }, [slides.length]);

  if (campaigns.length === 0) return null;

  const s = slides[idx];

  return (
    <Box
      position="relative" overflow="hidden" minH={{ base: '140px', md: '160px' }}
      style={{ background: s.bg }} rounded="xl"
      mx={{ base: 4, md: 6 }} my={3}
    >
      {s.imageUrl && (
        <Box position="absolute" inset={0}>
          <Image src={s.imageUrl} w="full" h="full" objectFit="cover" />
          <Box position="absolute" inset={0}
            style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)' }} />
        </Box>
      )}

      <Flex px={{ base: 5, md: 10 }} py={{ base: 5, md: 6 }}
        align="center" justify="space-between" h="full" position="relative" zIndex={2}>
        <Box maxW="520px">
          {s.sponsored && <SponsoredBadge />}
          <Heading color="white" fontSize={{ base: 'lg', md: '2xl' }}
            fontWeight="900" lineHeight={1.15} mt={s.sponsored ? 2 : 0} mb={2}>
            {s.headline}
          </Heading>
          {s.subline && (
            <Text fontSize="sm" color="rgba(203,213,225,0.85)" lineHeight={1.7} mb={3}>
              {s.subline}
            </Text>
          )}
          <Button size="sm" rounded="md" fontWeight="700" fontSize="sm"
            rightIcon={<ArrowRight size={13} />}
            onClick={() => navigate(s.cta_link)}
            style={{ background: s.accentColor, color: 'white' }}
            _hover={{ opacity: 0.9, transform: 'translateY(-1px)' }} transition="all 0.18s">
            {s.cta_text}
          </Button>
        </Box>

        {/* Slide dots */}
        {slides.length > 1 && (
          <HStack spacing={1.5} position="absolute" bottom={3} right={4}>
            {slides.map((_, i) => (
              <Box key={i} w={i === idx ? '20px' : '6px'} h="6px" rounded="full"
                cursor="pointer" transition="all 0.25s"
                style={{ background: i === idx ? s.accentColor : 'rgba(255,255,255,0.4)' }}
                onClick={() => setIdx(i)} />
            ))}
          </HStack>
        )}
      </Flex>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. VentesFlashBlock — VentesFlash_Block  (re-export with countdown)
// ═══════════════════════════════════════════════════════════════════════════════
export function VentesFlashBlock({ products, flashCount, countdown }: {
  products: Product[];
  flashCount: number;
  countdown: { h: string; m: string; s: string };
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  if (products.length === 0 && flashCount === 0) return null;
  const flashTitle = flashCount > 0
    ? `${t('homepageBlocks.offersOfTheDay')} · ${flashCount} ${flashCount > 1 ? t('homepageBlocks.flashSaleActiveMany', { count: flashCount }) : t('homepageBlocks.flashSaleActive', { count: flashCount })}`
    : t('homepageBlocks.offersOfTheDay');
  return (
    <Box bg="white" pt={8} pb={6} style={{ borderBottom: `8px solid ${C.bgAlt}` }}>
      <Box maxW="1400px" mx="auto" px={{ base: 4, md: 6 }}>
        <SectionHead
          eyebrow={t('homepageBlocks.flashDeals')}
          title={flashTitle}
          onAction={() => navigate('/best-deals')}
          right={
            <Flex align="center" gap={2} rounded="md" px={3} py={1.5}
              style={{ background: C.amberLight, border: `1px solid ${C.amberBorder}` }}>
              <Box w={2} h={2} rounded="full" style={{ background: C.amber }}
                sx={{ '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } }, animation: 'pulse 1.5s ease infinite' }} />
              <Text fontSize="sm" fontWeight="800" fontFamily="mono" style={{ color: '#92400e' }}>
                {countdown.h}:{countdown.m}:{countdown.s}
              </Text>
            </Flex>
          }
        />
        <Carousel>
          {products.map(p => <MiniProductCard key={p.id} p={p} />)}
        </Carousel>
      </Box>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. ExtraRemiseBlock — ExtraRemise_Block
// ═══════════════════════════════════════════════════════════════════════════════

export function ExtraRemiseBlock({ campaigns }: { campaigns: ExtraRemiseCampaign[] }) {
  const { t } = useTranslation();
  const items = campaigns.map(c => ({
    label: c.label ?? (c.discount_pct ? `-${c.discount_pct}%` : c.name),
    code: c.code ?? null,
    color: c.color ?? C.teal,
    desc: c.min_order ? `${t('homepageBlocks.description')} ${c.min_order} €` : t('promos.seePrices'),
  }));

  return (
    <Box py={5} style={{ background: C.tealLight, borderBottom: `8px solid ${C.bgAlt}` }}>
      <Box maxW="1400px" mx="auto" px={{ base: 4, md: 6 }}>
        <HStack spacing={2} mb={4}>
          <Box w={6} h="2px" rounded="full" style={{ background: C.teal }} />
          <Text fontSize="10px" fontWeight="800" letterSpacing="2px"
            textTransform="uppercase" style={{ color: C.teal }}>
            {t('homepageBlocks.offersExclusions')}
          </Text>
        </HStack>
        <SimpleGrid columns={{ base: 2, sm: 2, md: 4 }} spacing={3}>
          {items.map((item, i) => (
            <Flex key={i} align="center" gap={3} bg="white" rounded="lg" px={4} py={3}
              border="1px solid" borderColor={C.tealBorder}
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <Box w={9} h={9} rounded="md" flexShrink={0} display="flex"
                alignItems="center" justifyContent="center"
                style={{ background: `${item.color}18`, border: `1px solid ${item.color}30` }}>
                <Percent size={16} style={{ color: item.color }} />
              </Box>
              <Box flex={1} minW={0}>
                <Text fontWeight="800" fontSize="sm" style={{ color: item.color }} noOfLines={1}>
                  {item.label}
                </Text>
                <Text fontSize="10px" color="gray.500" noOfLines={1}>{item.desc}</Text>
                {item.code && (
                  <Box mt={1} px={2} py={0.5} rounded="md" alignSelf="flex-start" display="inline-block"
                    style={{ background: `${item.color}12`, border: `1px dashed ${item.color}40` }}>
                    <Text fontSize="9px" fontFamily="mono" fontWeight="800"
                      style={{ color: item.color }}>
                      {item.code}
                    </Text>
                  </Box>
                )}
              </Box>
            </Flex>
          ))}
        </SimpleGrid>
      </Box>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. RecommandePourVous — RecommandéPourVous
// ═══════════════════════════════════════════════════════════════════════════════
export function RecommandePourVous({ products, eyebrow, title }: {
  products: Product[]; eyebrow?: string; title?: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  if (products.length === 0) return null;
  return (
    <Box bg="white" pt={8} pb={6} style={{ borderBottom: `8px solid ${C.bgAlt}` }}>
      <Box maxW="1400px" mx="auto" px={{ base: 4, md: 6 }}>
        <SectionHead
          eyebrow={eyebrow ?? t('homepageBlocks.selection')}
          title={title ?? t('homepageBlocks.recommendedForYou')}
          accentColor="#6366f1"
          onAction={() => navigate('/catalog')}
          right={
            <HStack spacing={0.5}>
              {[...Array(5)].map((_, i) => <Star key={i} size={12} fill="#F59E0B" color="#F59E0B" />)}
            </HStack>
          }
        />
        <Carousel>
          {products.map(p => <MiniProductCard key={p.id} p={p} />)}
        </Carousel>
      </Box>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. CategoryBlock — Category_Supermarché / Category_x / Category_y
// ═══════════════════════════════════════════════════════════════════════════════
export function CategoryBlock({ category, products, accentColor, eyebrow }: {
  category: Pick<Category, 'id' | 'name'>;
  products: Product[];
  accentColor?: string;
  eyebrow?: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  if (products.length === 0) return null;
  const accent = accentColor ?? C.amber;
  return (
    <Box bg="white" pt={8} pb={6} style={{ borderBottom: `8px solid ${C.bgAlt}` }}>
      <Box maxW="1400px" mx="auto" px={{ base: 4, md: 6 }}>
        <SectionHead
          eyebrow={eyebrow ?? t('sections.flashDeals')}
          title={category.name}
          accentColor={accent}
          onAction={() => navigate(`/catalog?category=${category.id}`)}
        />
        <Carousel>
          {products.map(p => <MiniProductCard key={p.id} p={p} />)}
        </Carousel>
      </Box>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. DealOfDayBlock — Deal_Of_The_Day
// ═══════════════════════════════════════════════════════════════════════════════
function useMidnightCountdown() {
  const calc = () => {
    const now = new Date(); const end = new Date(); end.setHours(23, 59, 59, 0);
    const diff = Math.max(0, end.getTime() - now.getTime());
    return {
      h: String(Math.floor(diff / 3600000)).padStart(2, '0'),
      m: String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0'),
      s: String(Math.floor((diff % 60000) / 1000)).padStart(2, '0'),
    };
  };
  const [t, setT] = useState(calc);
  useEffect(() => { const id = setInterval(() => setT(calc()), 1000); return () => clearInterval(id); }, []);
  return t;
}

export function DealOfDayBlock({ campaign, product }: {
  campaign: DealOfDayCampaign | null;
  product: Product | null;
}) {
  const { t } = useTranslation();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const countdown = useMidnightCountdown();
  const isRTL = lang === 'ar';

  if (!campaign && !product) return null;

  const first = product?.price_tiers?.sort((a, b) => a.qty_min - b.qty_min)[0];
  const displayPrice = campaign?.special_price ?? first?.unit_price;
  const originalPrice = campaign?.original_price;
  const discountPct = campaign?.discount_pct ?? (originalPrice && displayPrice
    ? Math.round((1 - displayPrice / originalPrice) * 100) : null);

  return (
    <Box py={7} style={{ background: `linear-gradient(135deg, ${C.navy} 0%, #1a3558 100%)`, borderBottom: `8px solid ${C.bgAlt}` }}>
      <Box maxW="1400px" mx="auto" px={{ base: 4, md: 6 }}>
        {/* Header */}
        <Flex align="center" justify="space-between" mb={6} dir={isRTL ? 'rtl' : 'ltr'}>
          <HStack spacing={3}>
            <Box w={8} h={8} rounded="lg" display="flex" alignItems="center" justifyContent="center"
              style={{ background: C.amber }}>
              <Zap size={16} color="white" />
            </Box>
            <Box>
              <Text fontSize="10px" fontWeight="800" letterSpacing="2px"
                textTransform="uppercase" style={{ color: C.amber }}>{t('homepageBlocks.dealOfTheDay')}</Text>
              <Text fontWeight="800" color="white" fontSize="lg" lineHeight={1.1}>
                {t('homepageBlocks.exclusiveOffer24h')}
              </Text>
            </Box>
          </HStack>
          {/* Countdown */}
          <Flex align="center" gap={1.5}>
            <Clock size={13} color="rgba(148,163,184,0.7)" />
            <Text fontFamily="mono" fontWeight="800" fontSize="xl" color="white">
              {countdown.h}:{countdown.m}:{countdown.s}
            </Text>
          </Flex>
        </Flex>

        {/* Product card */}
        {product && (
          <Flex gap={6} align="center" flexWrap={{ base: 'wrap', md: 'nowrap' }} dir={isRTL ? 'rtl' : 'ltr'}>
            {/* Image */}
            <Box flexShrink={0} w={{ base: 'full', md: '280px' }} h={{ base: '200px', md: '240px' }}
              rounded="xl" overflow="hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
              {product.images?.[0]
                ? <Image src={product.images[0]} alt={product.name} w="full" h="full" objectFit="cover" />
                : <Flex w="full" h="full" align="center" justify="center">
                    <Package size={40} color="rgba(255,255,255,0.2)" />
                  </Flex>}
            </Box>

            {/* Details */}
            <Box flex={1}>
              {campaign && <SponsoredBadge />}
              <Text fontSize="10px" fontWeight="700" style={{ color: C.amber }}
                textTransform="uppercase" letterSpacing="0.6px" mt={2} mb={1}>
                {product.organisations?.name ?? product.brands?.name ?? t('homepageBlocks.seller')}
              </Text>
              <Heading color="white" fontWeight="800" size="lg" lineHeight={1.2} mb={3}>
                {product.name}
              </Heading>

              {discountPct && (
                <Badge style={{ background: C.red }} color="white" fontSize="sm" px={3} py={1} rounded="md" mb={3}>
                  {t('homepageBlocks.discountToday', { discount: discountPct })}
                </Badge>
              )}

              {/* Price */}
              {user ? (
                <HStack spacing={3} align="baseline" mb={4}>
                  {displayPrice && (
                    <Text fontWeight="900" fontSize="3xl" color="white" lineHeight={1}>
                      {displayPrice.toFixed(2)}
                      <Text as="span" fontSize="sm" fontWeight="500" color="gray.400" ml={1}>
                        {product.currency}
                      </Text>
                    </Text>
                  )}
                  {originalPrice && (
                    <Text fontWeight="500" fontSize="lg" color="gray.500" textDecoration="line-through">
                      {originalPrice.toFixed(2)} {product.currency}
                    </Text>
                  )}
                </HStack>
              ) : (
                <HStack spacing={1} mb={4}>
                  <Lock size={12} color="rgba(148,163,184,0.7)" />
                  <Text fontSize="sm" color="gray.400">{t('homepageBlocks.connectToSeePrice')}</Text>
                </HStack>
              )}

              {/* Stock progress */}
              {campaign?.available_qty && (
                <Box mb={4}>
                  <Flex justify="space-between" mb={1}>
                    <Text fontSize="xs" color="gray.400">{t('homepageBlocks.availability')}</Text>
                    <Text fontSize="xs" fontWeight="700" style={{ color: C.amber }}>
                      {t('homepageBlocks.unitsRemaining', { qty: campaign.available_qty })}
                    </Text>
                  </Flex>
                  <Progress value={Math.min(100, (campaign.available_qty / 50) * 100)}
                    size="xs" rounded="full" colorScheme="orange" bg="rgba(255,255,255,0.1)"
                    style={{ height: '5px' }} />
                </Box>
              )}

              <Button size="md" rounded="md" fontWeight="700"
                rightIcon={!isRTL ? <ShoppingCart size={14} /> : undefined}
                leftIcon={isRTL ? <ShoppingCart size={14} /> : undefined}
                onClick={() => navigate(`/product/${product.id}`)}
                style={{ background: C.amber, color: 'white' }}
                _hover={{ opacity: 0.9, transform: 'translateY(-1px)' }} transition="all 0.18s">
                {user ? t('homepageBlocks.seeOffer') : t('homepageBlocks.seeProduct')}
              </Button>
            </Box>
          </Flex>
        )}
      </Box>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. FooterBannerBlock — Homepage_Footer_Banner
// ═══════════════════════════════════════════════════════════════════════════════

export function FooterBannerBlock({ campaigns }: { campaigns: FooterBannerCampaign[] }) {
  const { t } = useTranslation();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const isRTL = lang === 'ar';
  if (campaigns.length === 0) return null;

  const s = {
    bg: campaigns[0].bg_color ?? `linear-gradient(135deg, ${C.navy}, #254b7a)`,
    headline: campaigns[0].headline ?? campaigns[0].name,
    subline: campaigns[0].subline ?? '',
    cta_link: campaigns[0].cta_link ?? '/catalog',
    accentColor: C.amber,
    imageUrl: campaigns[0].image_url,
    sponsored: false,
  };

  return (
    <Box position="relative" overflow="hidden" mx={{ base: 4, md: 6 }} my={4}
      rounded="xl" minH={{ base: '120px', md: '140px' }} style={{ background: s.bg }}>
      {s.imageUrl && (
        <Box position="absolute" inset={0}>
          <Image src={s.imageUrl} w="full" h="full" objectFit="cover" />
          <Box position="absolute" inset={0}
            style={{ background: isRTL ? 'linear-gradient(to left, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.35) 100%)' : 'linear-gradient(to right, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.35) 100%)' }} />
        </Box>
      )}
      <Flex px={{ base: 6, md: 12 }} py={6} align="center" justify="space-between"
        gap={6} position="relative" zIndex={2} flexWrap="wrap" dir={isRTL ? 'rtl' : 'ltr'}>
        <Box>
          {s.sponsored && <SponsoredBadge />}
          <Heading color="white" fontSize={{ base: 'md', md: 'xl' }} fontWeight="800"
            lineHeight={1.2} mt={s.sponsored ? 2 : 0}>
            {s.headline}
          </Heading>
          {s.subline && (
            <Text fontSize="sm" color="rgba(203,213,225,0.8)" mt={1}>{s.subline}</Text>
          )}
        </Box>
        <Button size="sm" rounded="md" fontWeight="700"
          rightIcon={!isRTL ? <ArrowRight size={13} /> : undefined}
          leftIcon={isRTL ? <ArrowRight size={13} /> : undefined}
          onClick={() => navigate(s.cta_link)}
          style={{ background: s.accentColor, color: 'white' }}
          _hover={{ opacity: 0.9 }} flexShrink={0}>
          {t('homepageBlocks.discover')}
        </Button>
      </Flex>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. SearchSponsoredBlock — Search_Sponsored (used in CatalogPage)
// ═══════════════════════════════════════════════════════════════════════════════
export function SearchSponsoredBlock({ products }: { products: Product[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  if (products.length === 0) return null;
  return (
    <Box mb={4} p={4} rounded="xl" style={{ background: C.amberLight, border: `1px solid ${C.amberBorder}40` }}>
      <HStack spacing={2} mb={3}>
        <TrendingUp size={14} style={{ color: C.amber }} />
        <Text fontSize="xs" fontWeight="800" style={{ color: '#92400e' }} letterSpacing="0.5px">
          {t('sections.sponsored')}
        </Text>
        <SponsoredBadge />
      </HStack>
      <Box display="flex" gap={3} overflowX="auto"
        style={{ scrollbarWidth: 'none' }}
        sx={{ '&::-webkit-scrollbar': { display: 'none' } }}>
        {products.slice(0, 6).map(p => (
          <Box key={p.id} flexShrink={0} w="150px" bg="white" rounded="lg"
            overflow="hidden" border="1px solid" borderColor={C.amberBorder}
            cursor="pointer" onClick={() => navigate(`/product/${p.id}`)}>
            <Box h="110px" bg={C.bgAlt}>
              {p.images?.[0]
                ? <Image src={p.images[0]} alt={p.name} w="full" h="full" objectFit="cover" />
                : <Flex w="full" h="full" align="center" justify="center">
                    <Package size={22} color={C.muted} />
                  </Flex>}
            </Box>
            <Box p={2.5}>
              <Text fontSize="9px" fontWeight="700" noOfLines={2} lineHeight={1.3}
                color="gray.700">{p.name}</Text>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// 10. RFQBoostBlock — RFQ_Boost_Slot
// ═══════════════════════════════════════════════════════════════════════════════
export function RFQBoostBlock({ rfqPosts }: { rfqPosts: RFQPost[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  if (rfqPosts.length === 0) return null;

  return (
    <Box py={7} style={{ background: C.bgAlt, borderBottom: `8px solid ${C.bgAlt}` }}>
      <Box maxW="1400px" mx="auto" px={{ base: 4, md: 6 }}>
        <SectionHead
          eyebrow={t('sections.flashDeals')}
          title={t('homepageBlocks.buyerRequests')}
          accentColor={C.teal}
          right={
            <Box rounded="sm" px={2.5} py={1}
              style={{ background: C.tealLight, border: `1px solid ${C.tealBorder}` }}>
              <Text fontSize="9px" fontWeight="800" letterSpacing="1px"
                textTransform="uppercase" style={{ color: C.teal }}>{t('homepageBlocks.boosted')}</Text>
            </Box>
          }
        />
        <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={4}>
          {rfqPosts.slice(0, 6).map(rfq => (
            <Box key={rfq.id} bg="white" rounded="xl" p={4}
              border="1px solid" borderColor={C.tealBorder}
              _hover={{ borderColor: C.teal, shadow: 'sm' }} transition="all 0.18s">
              <HStack spacing={2} mb={2}>
                <Box w={7} h={7} rounded="lg" bg={C.tealLight}
                  display="flex" alignItems="center" justifyContent="center" flexShrink={0}>
                  <MessageSquare size={13} style={{ color: C.teal }} />
                </Box>
                <Box flex={1} minW={0}>
                  <Text fontWeight="700" fontSize="sm" color="gray.800" noOfLines={1}>{rfq.product_name}</Text>
                  {rfq.categories?.name && (
                    <Text fontSize="9px" color="gray.400">{rfq.categories.name}</Text>
                  )}
                </Box>
              </HStack>

              <Flex justify="space-between" align="center" mt={2}>
                <HStack spacing={1}>
                  <Package size={10} color={C.muted} />
                  <Text fontSize="xs" color="gray.600" fontWeight="500">
                    {t('homepageBlocks.quantity')} : <Text as="span" fontWeight="700">{rfq.quantity.toLocaleString()}</Text>
                  </Text>
                </HStack>
                {rfq.desired_price && (
                  <Text fontSize="xs" color="gray.500">
                    {t('homepageBlocks.targetBudget')} : <Text as="span" fontWeight="700" style={{ color: C.teal }}>
                      {rfq.desired_price.toFixed(2)} €
                    </Text>
                  </Text>
                )}
              </Flex>

              {rfq.description && (
                <Text fontSize="10px" color="gray.400" noOfLines={2} mt={2} lineHeight={1.5}>
                  {rfq.description}
                </Text>
              )}

              <Button mt={3} size="xs" rounded="md" fontWeight="700"
                w="full" style={{ background: C.teal, color: 'white' }}
                _hover={{ opacity: 0.88 }}
                onClick={() => user ? navigate('/vendor/quotes') : navigate('/auth')}>
                {user ? t('homepageBlocks.respondRequest') : t('homepageBlocks.loginToRespond')}
              </Button>
            </Box>
          ))}
        </SimpleGrid>
      </Box>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 11. DynamicCategoryRows — Category_x, Category_y  (multiple sponsored categories)
// ═══════════════════════════════════════════════════════════════════════════════
const CAT_ACCENT_COLORS = ['#c97d1a', '#6366f1', '#0f766e', '#be1c1c', '#92400e', '#1e3a8a'];

export function DynamicCategoryRows({ campaigns }: { campaigns: CategoryRowCampaign[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [catProducts, setCatProducts] = useState<Record<string, Product[]>>({});

  const catKey = campaigns.map(c => c.category_id).filter(Boolean).join(',');

  useEffect(() => {
    const catIds = catKey ? catKey.split(',') : [];
    if (catIds.length === 0) return;
    Promise.all(
      catIds.map(id =>
        supabase.from('products').select('*, organisations(name), price_tiers(*)')
          .eq('status', 'active').eq('category_id', id).limit(10)
          .then(({ data }) => ({ id, products: (data ?? []) as Product[] }))
      )
    ).then(results => {
      const map: Record<string, Product[]> = {};
      results.forEach(({ id, products }) => { map[id] = products; });
      setCatProducts(map);
    });
  }, [catKey]);

  if (campaigns.length === 0) return null;

  return (
    <>
      {campaigns.map((c, i) => {
        const products = catProducts[c.category_id ?? ''] ?? [];
        if (products.length === 0) return null;
        const accent = CAT_ACCENT_COLORS[i % CAT_ACCENT_COLORS.length];
        return (
          <Box key={c.id} bg="white" pt={8} pb={6} style={{ borderBottom: `8px solid ${C.bgAlt}` }}>
            <Box maxW="1400px" mx="auto" px={{ base: 4, md: 6 }}>
              <SectionHead
                eyebrow={t('homepageBlocks.sponsoredCategory')}
                title={c.headline ?? c.category_name ?? c.name}
                accentColor={accent}
                onAction={() => navigate(`/catalog?category=${c.category_id}`)}
                right={<SponsoredBadge />}
              />
              <Carousel>
                {products.map(p => <MiniProductCard key={p.id} p={p} />)}
              </Carousel>
            </Box>
          </Box>
        );
      })}
    </>
  );
}

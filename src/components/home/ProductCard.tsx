import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Box, Flex, HStack, Image, Text } from '@chakra-ui/react';
import { Layers } from 'lucide-react';
import type { Product } from '../../types';

const NAVY = '#0d1f38';
const AMBER = '#c97d1a';
const AMBER_BORDER = '#fbbf24';
const RED = '#b91c1c';
const BORDER = '#e2e8f0';
const MUTED = '#64748b';

// Single product card for every home row. `fluid` fills a grid cell; otherwise
// it keeps a fixed width for horizontal strips.
export function ProductCard({ product, badge, badgeColor = AMBER, fluid, footer, action }: {
  product: Product;
  badge?: string;
  badgeColor?: string;
  fluid?: boolean;
  footer?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const tiers = product.price_tiers?.slice().sort((a, b) => a.qty_min - b.qty_min) ?? [];
  const first = tiers[0];
  const best = tiers[tiers.length - 1];
  const savePct = first && best && best !== first ? Math.round((1 - best.unit_price / first.unit_price) * 100) : 0;
  const stock = product.stock_qty ?? 0;
  const lowStock = stock > 0 && stock <= 20;

  return (
    <Flex direction="column" flexShrink={fluid ? undefined : 0} w={fluid ? 'full' : { base: '158px', md: '192px' }}
      bg="white" rounded="lg" overflow="hidden" border="1px solid" borderColor={BORDER} position="relative"
      cursor="pointer" onClick={() => navigate(`/product/${product.id}`)}
      _hover={{ shadow: 'md', transform: 'translateY(-3px)', borderColor: AMBER_BORDER }}
      _active={{ transform: 'scale(0.97)' }}
      transition="all 0.2s ease">
      {badge && (
        <Box position="absolute" top={2} insetStart={2} zIndex={2} rounded="sm" px={1.5} py={0.5} style={{ background: badgeColor }}>
          <Text fontSize="9px" fontWeight="800" color="white" textTransform="uppercase" letterSpacing="0.4px">{badge}</Text>
        </Box>
      )}
      <Box h={{ base: '108px', sm: '128px', md: '155px' }} overflow="hidden" bg="#f1f5f9">
        {product.images?.[0] ? (
          <Image src={product.images[0]} alt={product.name} w="full" h="full" objectFit="cover" loading="lazy" />
        ) : (
          <Flex w="full" h="full" align="center" justify="center">
            <Text fontWeight="900" fontSize="4xl" lineHeight={1} userSelect="none" color="#cbd5e1">
              {product.name.charAt(0).toUpperCase()}
            </Text>
          </Flex>
        )}
      </Box>
      <Flex direction="column" p={{ base: 2, md: 3 }} gap={{ base: 1, md: 1.5 }} flex={1}>
        <Text fontSize="9px" fontWeight="700" noOfLines={1} textTransform="uppercase" letterSpacing="0.6px" color={MUTED}>
          {product.organisations?.name ?? t('home.seller')}
        </Text>
        <Text fontWeight="600" color="gray.800" fontSize={{ base: '11px', md: 'xs' }} noOfLines={2} lineHeight={1.35}>{product.name}</Text>
        {first ? (
          <HStack spacing={1} align="baseline">
            <Text fontWeight="800" fontSize={{ base: 'sm', md: 'md' }} lineHeight={1} color={NAVY}>{first.unit_price.toFixed(2)}</Text>
            <Text fontSize="9px" color={MUTED}>{product.currency}</Text>
          </HStack>
        ) : (
          <Text fontSize="xs" color="gray.400" fontStyle="italic">{t('common.onQuote')}</Text>
        )}
        {savePct > 0 && (
          <HStack spacing={1} rounded="md" px={1.5} py={0.5} bg="#dcfce7" color="#15803d" alignSelf="flex-start">
            <Layers size={11} />
            <Text fontSize="10px" fontWeight="800">{t('home.tierSaving', { pct: savePct, qty: best.qty_min })}</Text>
          </HStack>
        )}
        {lowStock && <Text fontSize="10px" fontWeight="700" color={RED}>{t('home.lowStock', { count: stock })}</Text>}
        {footer}
        {action && <Box mt="auto" pt={1} onClick={(e) => e.stopPropagation()}>{action}</Box>}
      </Flex>
    </Flex>
  );
}

// Product row: a swipeable strip on phones (two cards and a peek of the third),
// a regular grid from tablet up. Keeps long rows from stacking 5 screens tall.
export function ProductRail({ children, columns = 5 }: { children: React.ReactNode; columns?: number }) {
  const md = columns >= 4 ? 4 : columns;
  return (
    <Box
      display={{ base: 'flex', md: 'grid' }}
      gridTemplateColumns={{ md: `repeat(${md}, minmax(0, 1fr))`, lg: `repeat(${columns}, minmax(0, 1fr))` }}
      gap={{ base: 2.5, md: 4 }}
      overflowX={{ base: 'auto', md: 'visible' }}
      mx={{ base: -4, md: 0 }}
      px={{ base: 4, md: 0 }}
      pb={{ base: 1, md: 0 }}
      sx={{
        scrollSnapType: 'x mandatory',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
        '@media (max-width: 29.99em)': {
          '& > *': { flex: '0 0 37% !important', width: '37% !important', scrollSnapAlign: 'start' },
        },
        '@media (min-width: 30em) and (max-width: 47.99em)': {
          '& > *': { flex: '0 0 28% !important', width: '28% !important', scrollSnapAlign: 'start' },
        },
        '@media (min-width: 48em)': { '& > *': { width: '100% !important' } },
      }}>
      {children}
    </Box>
  );
}

// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Flex, Grid, Heading, Text, VStack, HStack,
  Button, Image, Skeleton, SkeletonText, Divider, SimpleGrid,
  Table, Thead, Tbody, Tr, Th, Td, Wrap, WrapItem,
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, useToast, Link,
  NumberInput, NumberInputField, NumberInputStepper,
  NumberIncrementStepper, NumberDecrementStepper,
} from '@chakra-ui/react';
import {
  Star, ShoppingCart, FileText, Package, Shield, Thermometer,
  Globe, Award, ChevronRight, ArrowLeft, Building2, Clock,
  CheckCircle, Truck, Lock, UserPlus, Scale, MessageSquare,
  ArrowRight, MapPin, AlertTriangle, Layers, Hash, Ruler, Leaf,
  Play, Download, FileDown, Zap, BarChart2, Factory, Tag,
  ShoppingBag, Beaker, TrendingUp,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { addToCart as addToCartShared } from '../../lib/cart';
import { rememberReturnPath } from '../../lib/signupRole';
import { useComparator } from '../../contexts/ComparatorContext';
import { useProductCampaigns } from '../../hooks/useMarketingStorefront';
import ProductCampaignPanel from '../../components/marketing/ProductCampaignPanel';
import {
  fetchOfferRankingDataset, rankOfferDataset,
  type OfferRankingDataset, type RankOffersResult,
} from '../../lib/recommendation';
import type {
  Product, ProductReview, ProductDimensions,
  NutritionalValues, ProductDocument,
} from '../../types';

// ── Types ──────────────────────────────────────────────────────────────────────
type SimilarReason = 'brand' | 'distributor' | 'ean' | 'category';
type SimilarProduct = Product & { _reason: SimilarReason };

// ── Tokens ─────────────────────────────────────────────────────────────────────
const N = {
  navy:    '#0d1f38',
  navyMid: '#1a3558',
  amber:   '#c97d1a',
  amber10: '#fef3c7',
  slate:   '#334155',
  muted:   '#64748b',
  border:  '#e2e8f0',
  bgAlt:   '#f8fafc',
  green:   '#14532d',
  greenBg: '#dcfce7',
  red:     '#be1c1c',
  redBg:   '#fff1f1',
};

// ── Constants ──────────────────────────────────────────────────────────────────
const TEMP_LABELS: Record<string, string> = {
  ambient: 'Ambiant', refrigerated: 'Réfrigéré', fresh: 'Frais', frozen: 'Surgelé',
};
const TEMP_BG: Record<string, string> = {
  ambient: '#fefce8', refrigerated: '#ecfeff', fresh: '#f0fdf4', frozen: '#eff6ff',
};
const TEMP_COLOR: Record<string, string> = {
  ambient: '#92400e', refrigerated: '#155e75', fresh: '#14532d', frozen: '#1e3a8a',
};
const NUTRI_BG: Record<string, string> = {
  A: '#038141', B: '#85BB2F', C: '#FECB02', D: '#EE8100', E: '#E63312',
};
const NUTRI_FG: Record<string, string> = {
  A: '#fff', B: '#fff', C: '#1a1a1a', D: '#fff', E: '#fff',
};
const NUTRI_ROWS: { key: keyof NutritionalValues; label: string; unit: string }[] = [
  { key: 'energy_kcal',     label: 'Énergie',                  unit: 'kcal' },
  { key: 'energy_kj',       label: 'Énergie',                  unit: 'kJ'   },
  { key: 'fat_g',           label: 'Matières grasses',         unit: 'g'    },
  { key: 'saturated_fat_g', label: 'dont Acides gras saturés', unit: 'g'    },
  { key: 'carbs_g',         label: 'Glucides',                 unit: 'g'    },
  { key: 'sugars_g',        label: 'dont Sucres',              unit: 'g'    },
  { key: 'fiber_g',         label: 'Fibres',                   unit: 'g'    },
  { key: 'protein_g',       label: 'Protéines',                unit: 'g'    },
  { key: 'salt_g',          label: 'Sel',                      unit: 'g'    },
];
const DOC_LABEL: Record<string, string> = {
  datasheet: 'Fiche technique', certificate: 'Certificat',
  logistics: 'Fiche logistique', fds: 'FDS', other: 'Document',
};
const DOC_COLOR: Record<string, string> = {
  datasheet: '#2563eb', certificate: '#16a34a', logistics: '#9333ea', fds: '#ea580c', other: N.muted,
};
const DELIVERY_LABEL: Record<string, { label: string; desc: string; icon: React.ElementType }> = {
  livraison_directe:  { label: 'Livraison directe',        desc: 'Le vendeur livre à votre entrepôt', icon: Truck },
  enlevement:         { label: 'Enlèvement (EXW)',          desc: 'Vous organisez le transport',       icon: Package },
  cold_chain_express: { label: 'Transport frigorifique',    desc: 'Chaîne du froid garantie',          icon: Thermometer },
  export_fob:         { label: 'Export FOB',                desc: 'Franco bord port de départ',        icon: Globe },
  export_cif:         { label: 'Export CIF',                desc: 'Coût + assurance + fret',           icon: Globe },
  export_ddp:         { label: 'Export DDP',                desc: 'Livraison droits acquittés',        icon: Globe },
};
const DIST_LABEL: Record<string, string> = {
  supermarket: 'GMS / Supermarchés', horeca: 'HORECA', pharmacy: 'Pharmacies',
  ecommerce: 'E-commerce', export: 'Export / Distributeurs', local_retail: 'Commerce de proximité',
};
const FORM_LABEL: Record<string, string> = {
  liquid: 'Liquide', solid: 'Solide', powder: 'Poudre', gel: 'Gel',
  aerosol: 'Aérosol', cream: 'Crème', tablet: 'Comprimé', other: 'Autre',
};
const FRAGILITY_LABEL: Record<string, { label: string; color: string }> = {
  low: { label: 'Faible', color: '#16a34a' },
  medium: { label: 'Moyenne', color: '#d97706' },
  high: { label: 'Élevée', color: '#dc2626' },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
// Quantité commandable : au moins le MOQ, et un multiple du colisage.
function normalizeQty(q: number, moq: number, packSize: number): number {
  const min = Math.max(1, moq || 1);
  const pack = Math.max(1, packSize || 1);
  let v = Number.isFinite(q) ? Math.max(Math.round(q), min) : min;
  if (pack > 1) v = Math.ceil(v / pack) * pack;
  return v;
}

function Section({
  id, title, icon: Icon, children,
}: { id: string; title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <Box id={id} scrollMarginTop="96px" pt={12} pb={2}>
      <HStack spacing={3} mb={6}>
        <Box w="3px" h="20px" rounded="full" style={{ background: N.amber }} flexShrink={0} />
        <Icon size={15} color={N.navy} />
        <Text fontWeight="800" fontSize="xs" style={{ color: N.navy }}
          textTransform="uppercase" letterSpacing="0.12em">
          {title}
        </Text>
      </HStack>
      {children}
      <Divider mt={10} style={{ borderColor: N.border }} />
    </Box>
  );
}

function DRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '' || value === false) return null;
  return (
    <Flex py={3} gap={6} style={{ borderBottom: `1px solid ${N.border}` }}
      _last={{ borderBottom: 'none' }} align="start">
      <Text fontSize="11px" fontWeight="700" style={{ color: N.muted }} minW="170px" flexShrink={0}
        textTransform="uppercase" letterSpacing="0.05em" pt={0.5}>
        {label}
      </Text>
      <Box flex={1}>
        {typeof value === 'string' || typeof value === 'number'
          ? <Text fontSize="sm" fontWeight="500" style={{ color: N.navy }}>{value}</Text>
          : value}
      </Box>
    </Flex>
  );
}

function Chip({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <Box px={2.5} py={1} rounded="md" display="inline-block"
      style={{ background: bg }}>
      <Text fontSize="xs" fontWeight="700" style={{ color }}>{label}</Text>
    </Box>
  );
}

type LotRow = {
  id: string; lot_number: string; qty_available: number;
  expiry_date: string | null; specific_price: number | null;
};

// ── Main ───────────────────────────────────────────────────────────────────────
export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, activeOrg } = useAuth();
  const toast = useToast();
  const { addItem, removeItem, hasItem } = useComparator();
  const productCampaigns = useProductCampaigns(id);

  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [similar, setSimilar] = useState<SimilarProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedImage, setSelectedImage] = useState(0);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [qty, setQty] = useState(1);
  const [selectedDelivery, setSelectedDelivery] = useState('');
  // null = aucun ajout en cours ; 'main' = bouton principal ; sinon id du lot DLC.
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [recoDataset, setRecoDataset] = useState<OfferRankingDataset | null>(null);
  const [lots, setLots] = useState<LotRow[]>([]);

  useEffect(() => {
    if (!id) return;
    // Navigation vers un autre produit (ex. « Produits similaires ») : on repart
    // d'un état vierge, et une réponse tardive du produit précédent est ignorée.
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    setProduct(null);
    setReviews([]);
    setLots([]);
    setSimilar([]);
    setSelectedImage(0);
    setVideoPlaying(false);
    setSelectedDelivery('');
    window.scrollTo(0, 0);

    supabase
      .from('products')
      .select('*, organisations(*), categories(*), brands(*), price_tiers(*)')
      .eq('id', id).eq('status', 'active').maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { setLoadError(true); setLoading(false); return; }
        const p = data as Product;
        setProduct(p);
        if (p) setQty(normalizeQty(p.moq, p.moq, p.pack_size));
        const methods = p?.delivery_methods ?? [];
        if (methods.length > 0) setSelectedDelivery(methods[0]);
        else if (p) setSelectedDelivery(p.cold_chain_required ? 'cold_chain_express' : 'livraison_directe');
        setLoading(false);
      });
    supabase.from('product_reviews').select('*').eq('product_id', id)
      .order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => { if (!cancelled) setReviews((data as ProductReview[]) ?? []); });
    supabase.from('product_lots').select('id,lot_number,qty_available,expiry_date,specific_price')
      .eq('product_id', id).eq('active', true).gt('qty_available', 0)
      .order('expiry_date', { ascending: true, nullsFirst: false })
      .then(({ data }) => { if (!cancelled) setLots((data as LotRow[]) ?? []); });
    return () => { cancelled = true; };
  }, [id, reloadKey]);

  useEffect(() => {
    if (!product?.id) return;
    let cancelled = false;
    const BASE = 'id,name,images,currency,price_tiers(unit_price,qty_min),avg_rating,moq,brand_id,seller_org_id,ean';
    const queries = [
      product.brand_id
        ? supabase.from('products').select(BASE).eq('brand_id', product.brand_id)
            .eq('status', 'active').neq('id', product.id).limit(4)
            .then(({ data }) => (data ?? []).map((p) => ({ ...p, _reason: 'brand' as SimilarReason })))
        : Promise.resolve([]),
      product.seller_org_id
        ? supabase.from('products').select(BASE).eq('seller_org_id', product.seller_org_id)
            .eq('status', 'active').neq('id', product.id).limit(3)
            .then(({ data }) => (data ?? []).map((p) => ({ ...p, _reason: 'distributor' as SimilarReason })))
        : Promise.resolve([]),
      product.category_id
        ? supabase.from('products').select(BASE).eq('category_id', product.category_id)
            .eq('status', 'active').neq('id', product.id).limit(4)
            .then(({ data }) => (data ?? []).map((p) => ({ ...p, _reason: 'category' as SimilarReason })))
        : Promise.resolve([]),
    ];
    Promise.all(queries).then((batches) => {
      if (cancelled) return;
      const seen = new Set<string>();
      const merged: SimilarProduct[] = [];
      for (const batch of batches)
        for (const p of batch)
          if (!seen.has(p.id)) { seen.add(p.id); merged.push(p as SimilarProduct); }
      setSimilar(merged.slice(0, 8));
    });
    return () => { cancelled = true; };
  }, [product?.id, product?.brand_id, product?.seller_org_id, product?.category_id]);

  // Recommandation — classement (prix, livraison, qualité fournisseur, fraîcheur,
  // proximité) de tous les fournisseurs proposant ce même EAN, pour signaler à
  // l'acheteur si un autre fournisseur est plus avantageux que celui affiché.
  useEffect(() => {
    if (!product?.ean) { setRecoDataset(null); return; }
    let cancelled = false;
    fetchOfferRankingDataset(product.ean).then((ds) => {
      if (!cancelled) setRecoDataset(ds);
    });
    return () => { cancelled = true; };
  }, [product?.ean]);

  const reco: RankOffersResult | null = useMemo(() => {
    if (!recoDataset) return null;
    const buyerLocation = activeOrg
      ? { city: activeOrg.city, region: activeOrg.region, country: activeOrg.country }
      : null;
    return rankOfferDataset(recoDataset, { quantity: qty, buyerLocation });
  }, [recoDataset, qty, activeOrg?.city, activeOrg?.region, activeOrg?.country]);

  const sortedTiers = product?.price_tiers?.slice().sort((a, b) => a.qty_min - b.qty_min) ?? [];
  const _q = sortedTiers.filter((t) => qty >= t.qty_min);
  const activeTier = _q[_q.length - 1] ?? sortedTiers[0];

  function goToAuth(signup: boolean) {
    // Retour sur ce produit après connexion (RedirectAuthenticated lit state.from)
    // ou après l'onboarding pour une inscription.
    if (signup) rememberReturnPath(location.pathname);
    navigate(signup ? '/auth?mode=signup' : '/auth', { state: { from: location } });
  }

  function goToFinishSignup() {
    navigate(profile?.onboarding_done ? '/pending-approval' : '/onboarding');
  }

  async function addToCart(lot?: LotRow) {
    if (!user) { goToAuth(false); return; }
    if (!activeOrg) { goToFinishSignup(); return; }
    if (!product) return;

    // Lot DLC : jamais plus que le stock du lot ; un lot plus petit que le MOQ
    // se solde en entier. Sinon : MOQ + multiple du colisage.
    const quantity = lot
      ? Math.min(Math.max(qty, Math.min(product.moq, lot.qty_available)), lot.qty_available)
      : normalizeQty(qty, product.moq, product.pack_size);
    if (quantity !== qty) {
      setQty(quantity);
      toast({
        title: 'Quantité ajustée',
        description: lot
          ? `${quantity} u disponibles sur le lot ${lot.lot_number}.`
          : `Minimum ${product.moq} u, par colis de ${product.pack_size} u : ${quantity} u.`,
        status: 'info', duration: 4000,
      });
    }

    const eligible = sortedTiers.filter((t) => quantity >= t.qty_min);
    const tierPrice = (eligible[eligible.length - 1] ?? sortedTiers[0])?.unit_price ?? null;

    setAddingToCart(lot?.id ?? 'main');
    try {
      const { error } = await addToCartShared({
        buyerOrgId: activeOrg.id,
        productId: product.id,
        quantity,
        unitPrice: lot ? lot.specific_price : tierPrice,
        lotId: lot?.id ?? null,
        deliveryMethod: selectedDelivery || null,
      });
      if (error) throw new Error(error);
      toast({ title: 'Ajouté au panier', description: `${quantity} × ${product.name}`, status: 'success', duration: 3000 });
    } catch (e: unknown) {
      toast({ title: 'Erreur', description: (e as { message?: string })?.message, status: 'error', duration: 5000 });
    } finally { setAddingToCart(null); }
  }

  function embedUrl(url: string) {
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s?]+)/);
    if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1&rel=0`;
    const vimeo = url.match(/vimeo\.com\/(\d+)/);
    if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1`;
    return url;
  }
  function ytThumb(url: string) {
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s?]+)/);
    return yt ? `https://img.youtube.com/vi/${yt[1]}/mqdefault.jpg` : null;
  }
  function daysUntil(d: string) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.ceil((new Date(d).getTime() - today.getTime()) / 86400000);
  }

  if (loading) return <PageSkeleton />;
  if (loadError) return (
    <Flex direction="column" align="center" justify="center" minH="60vh" gap={4}>
      <AlertTriangle size={48} color="#94a3b8" />
      <Heading size="md" style={{ color: N.navy }}>Impossible de charger ce produit</Heading>
      <Text fontSize="sm" style={{ color: N.muted }}>Vérifiez votre connexion puis réessayez.</Text>
      <Button onClick={() => setReloadKey((k) => k + 1)}
        rounded="xl" style={{ background: N.navy, color: 'white' }}>
        Réessayer
      </Button>
    </Flex>
  );
  if (!product) return (
    <Flex direction="column" align="center" justify="center" minH="60vh" gap={4}>
      <Package size={48} color="#94a3b8" />
      <Heading size="md" style={{ color: N.navy }}>Produit introuvable</Heading>
      <Button onClick={() => navigate('/catalog')} leftIcon={<ArrowLeft size={16} />}
        rounded="xl" style={{ background: N.navy, color: 'white' }}>
        Retour au catalogue
      </Button>
    </Flex>
  );

  // ── Data prep ────────────────────────────────────────────────────────────────
  const rawImages = product.images?.length > 0
    ? product.images
    : ['https://images.pexels.com/photos/4483610/pexels-photo-4483610.jpeg'];
  const images = [...rawImages.slice(0, 5), ...Array(Math.max(0, 5 - rawImages.length)).fill(null)] as (string | null)[];
  const videos: string[] = Array.isArray(product.videos) ? product.videos.filter(Boolean) : [];
  const mainVideo = videos[0] ?? null;

  const dimsUnit   = product.dimensions_unit   as ProductDimensions | null;
  const dimsCarton = product.dimensions_carton as ProductDimensions | null;
  const dimsPallet = product.dimensions_pallet as ProductDimensions | null;
  const pallet     = product.palettisation as { cartons_per_layer?: number; layers_per_palette?: number } | null;
  const cartonsPerPallet = pallet?.cartons_per_layer != null && pallet?.layers_per_palette != null
    ? pallet.cartons_per_layer * pallet.layers_per_palette : null;

  const nutValues = product.nutritional_values as NutritionalValues | null;
  const hasNutriValues = !!(nutValues && Object.values(nutValues).some((v) => v != null));
  const documents = Array.isArray(product.document_urls) ? product.document_urls as ProductDocument[] : [];

  const deliveryMethods = product.delivery_methods?.length > 0
    ? product.delivery_methods
    : product.cold_chain_required ? ['cold_chain_express', 'enlevement'] : ['livraison_directe', 'enlevement'];

  const tempStyle = {
    bg: TEMP_BG[product.temperature] ?? N.bgAlt,
    color: TEMP_COLOR[product.temperature] ?? N.navy,
    label: TEMP_LABELS[product.temperature] ?? product.temperature,
  };

  const hasNutrition = !!(product.allergens?.length || product.ingredients || product.nutritional_info || product.nutri_score || hasNutriValues);
  const hasPackaging = !!(dimsUnit || dimsCarton || dimsPallet || product.pack_size > 1 || product.packaging_type);
  const hasLogistics = !!(product.estimated_lead_days || product.incoterms?.length || product.delivery_methods?.length || product.volume_cbm_carton);
  const hasStorage   = !!(product.shelf_life_days || product.min_shelf_temp != null || product.after_opening_days);
  const hasOrigin    = !!(product.origin_country || product.certifications?.length || product.manufacturer_name);
  const hasCodes     = !!(product.ean || product.hs_code);
  const hasDistrib   = !!(product.distribution_channels?.length || product.target_segment || product.usp);

  const reviewCount = Math.max(product.review_count ?? 0, reviews.length);
  const sectionNav = [
    { id: 'description', label: 'Description', show: !!(product.long_description || product.usp) },
    { id: 'nutrition', label: 'Nutrition', show: hasNutrition },
    { id: 'packaging', label: 'Emballage', show: hasPackaging },
    { id: 'logistics', label: 'Logistique', show: hasLogistics },
    { id: 'storage', label: 'Conservation', show: hasStorage },
    { id: 'origin', label: 'Origine', show: hasOrigin },
    { id: 'codes', label: 'Codes', show: hasCodes },
    { id: 'documents', label: 'Documents', show: documents.length > 0 },
    { id: 'commercial', label: 'Commerce', show: hasDistrib },
    { id: 'reviews', label: reviewCount > 0 ? `Avis (${reviewCount})` : 'Avis', show: true },
  ].filter((s) => s.show);

  return (
    <VStack spacing={0} align="stretch">

      {/* Breadcrumb */}
      <Breadcrumb spacing={2} mb={6}
        separator={<ChevronRight size={12} color={N.muted} />} fontSize="sm">
        <BreadcrumbItem>
          <BreadcrumbLink onClick={() => navigate('/')} style={{ color: N.muted }}>Accueil</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem>
          <BreadcrumbLink onClick={() => navigate('/catalog')} style={{ color: N.muted }}>Catalogue</BreadcrumbLink>
        </BreadcrumbItem>
        {product.categories && (
          <BreadcrumbItem>
            <BreadcrumbLink
              onClick={() => navigate(`/catalog?category=${product.category_id}`)}
              style={{ color: N.muted }}>
              {product.categories.name}
            </BreadcrumbLink>
          </BreadcrumbItem>
        )}
        <BreadcrumbItem isCurrentPage>
          <Text style={{ color: N.navy }} fontWeight="600" noOfLines={1}>{product.name}</Text>
        </BreadcrumbItem>
      </Breadcrumb>

      {/* ── HERO: Gallery + Sticky Panel ─────────────────────────────────── */}
      <Grid templateColumns={{ base: '1fr', lg: '1fr 390px' }} gap={10} alignItems="flex-start">

        {/* Gallery */}
        <Box>
          {/* Main image */}
          <Box h={{ base: '320px', md: '560px' }} rounded="2xl" overflow="hidden"
            position="relative" style={{ background: N.bgAlt }}>

            {/* Badges */}
            {product.is_on_promotion && (
              <Box position="absolute" top={4} left={4} zIndex={3}
                px={3} py={1} rounded="full" style={{ background: '#dc2626' }}>
                <Text fontSize="xs" fontWeight="800" color="white">PROMO</Text>
              </Box>
            )}
            {product.is_new && !product.is_on_promotion && (
              <Box position="absolute" top={4} left={4} zIndex={3}
                px={3} py={1} rounded="full" style={{ background: '#16a34a' }}>
                <Text fontSize="xs" fontWeight="800" color="white">NOUVEAU</Text>
              </Box>
            )}
            {product.temperature !== 'ambient' && !videoPlaying && (
              <Box position="absolute" bottom={4} right={4} zIndex={3}
                px={3} py={1.5} rounded="xl"
                style={{ background: tempStyle.bg, border: `1px solid ${tempStyle.color}44` }}>
                <HStack spacing={1.5}>
                  <Thermometer size={12} color={tempStyle.color} />
                  <Text fontSize="xs" fontWeight="700" style={{ color: tempStyle.color }}>
                    {tempStyle.label}
                  </Text>
                </HStack>
              </Box>
            )}

            {videoPlaying && mainVideo ? (
              <Box w="full" h="full" position="relative">
                <Box as="iframe" src={embedUrl(mainVideo)} w="full" h="full"
                  border="none"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen />
                <Button position="absolute" top={3} left={3} size="xs" rounded="xl"
                  style={{ background: 'rgba(0,0,0,0.65)', color: 'white' }}
                  _hover={{ background: 'rgba(0,0,0,0.85)' }}
                  onClick={() => setVideoPlaying(false)}>
                  ← Photos
                </Button>
              </Box>
            ) : (
              <Box w="full" h="full" overflow="hidden"
                sx={{ '& img': { transition: 'transform 0.4s ease', '&:hover': { transform: 'scale(1.04)' } } }}>
                {images[selectedImage] ? (
                  <Image src={images[selectedImage]!} alt={product.name}
                    w="full" h="full" objectFit="cover" />
                ) : (
                  <Flex w="full" h="full" align="center" justify="center" direction="column" gap={3}>
                    <Package size={52} color="#cbd5e1" />
                    <Text fontSize="xs" style={{ color: N.muted }}>Image non disponible</Text>
                  </Flex>
                )}
              </Box>
            )}
          </Box>

          {/* Thumbnails strip */}
          <HStack spacing={3} mt={4} overflowX="auto"
            sx={{ '&::-webkit-scrollbar': { h: '3px' }, '&::-webkit-scrollbar-thumb': { bg: 'gray.200', rounded: 'full' } }}>
            {Array.from({ length: 5 }).map((_, i) => {
              const src = images[i];
              const active = !videoPlaying && selectedImage === i;
              return (
                <Box key={i} w="88px" h="88px" flexShrink={0} rounded="xl" overflow="hidden"
                  cursor={src ? 'pointer' : 'default'}
                  style={{
                    border: `2.5px solid ${active ? N.amber : N.border}`,
                    boxShadow: active ? `0 0 0 2px ${N.amber}44` : 'none',
                    background: N.bgAlt, opacity: src ? 1 : 0.4,
                  }}
                  transition="all 0.15s"
                  _hover={src ? { borderColor: N.amber } : undefined}
                  onClick={() => { if (!src) return; setVideoPlaying(false); setSelectedImage(i); }}>
                  {src ? (
                    <Image src={src} alt={`Photo ${i + 1}`} w="full" h="full" objectFit="cover" />
                  ) : (
                    <Flex w="full" h="full" align="center" justify="center" direction="column" gap={1}>
                      <Package size={18} color="#cbd5e1" />
                      <Text fontSize="8px" style={{ color: N.muted }}>{i + 1}</Text>
                    </Flex>
                  )}
                </Box>
              );
            })}

            {mainVideo && (
              <Box w="88px" h="88px" flexShrink={0} rounded="xl" overflow="hidden"
                cursor="pointer" position="relative"
                style={{ border: `2.5px solid ${videoPlaying ? N.amber : N.border}` }}
                transition="all 0.15s"
                _hover={{ borderColor: N.amber }}
                onClick={() => setVideoPlaying(true)}>
                {ytThumb(mainVideo)
                  ? <Image src={ytThumb(mainVideo)!} alt="Vidéo" w="full" h="full" objectFit="cover" />
                  : <Flex w="full" h="full" style={{ background: N.navy }} align="center" justify="center">
                      <Play size={20} color="white" fill="white" />
                    </Flex>
                }
                <Flex position="absolute" inset={0} align="center" justify="center"
                  style={{ background: 'rgba(0,0,0,0.35)' }}>
                  <Box bg="white" rounded="lg" p={1.5}>
                    <Play size={14} color={N.navy} fill={N.navy} />
                  </Box>
                </Flex>
                <Box position="absolute" bottom={1.5} left={1.5}
                  px={1.5} py={0.5} rounded="md" style={{ background: N.amber }}>
                  <Text fontSize="8px" fontWeight="800" color="white">VIDÉO</Text>
                </Box>
              </Box>
            )}
          </HStack>
          <Text fontSize="10px" style={{ color: N.muted }} mt={1.5} textAlign="center">
            {rawImages.length}/5 photos · {videos.length} vidéo{videos.length !== 1 ? 's' : ''}
          </Text>
        </Box>

        {/* ── Sticky Purchase Panel ─────────────────────────────────────────── */}
        <Box position="sticky" top="80px" alignSelf="flex-start">
          {activeOrg ? (
            <Box bg="white" rounded="2xl" overflow="hidden"
              style={{ border: `1.5px solid ${N.border}`, boxShadow: '0 4px 32px rgba(13,31,56,0.10)' }}>

              {/* 1 — Nom + badges + rating */}
              <Box px={5} pt={5} pb={4} style={{ borderBottom: `1px solid ${N.border}` }}>
                {product.brands && (
                  <HStack spacing={2} mb={2.5}>
                    {product.brands.logo_url && (
                      <Box w={6} h={6} rounded="md" overflow="hidden" flexShrink={0}
                        style={{ background: N.bgAlt, border: `1px solid ${N.border}` }}>
                        <Image src={product.brands.logo_url} alt={product.brands.name} w="full" h="full" objectFit="contain" p={0.5} />
                      </Box>
                    )}
                    <Text fontSize="xs" fontWeight="700" style={{ color: N.amber }}
                      textTransform="uppercase" letterSpacing="wide">
                      {product.brands.name}
                    </Text>
                  </HStack>
                )}
                <Heading as="h1" size="sm" style={{ color: N.navy }} lineHeight={1.3} mb={2.5}>
                  {product.name}
                </Heading>
                <Wrap spacing={1.5} mb={2.5}>
                  {product.categories && (
                    <WrapItem>
                      <Chip label={product.categories.name} bg={N.greenBg} color={N.green} />
                    </WrapItem>
                  )}
                  {product.temperature !== 'ambient' && (
                    <WrapItem>
                      <Box px={2.5} py={1} rounded="md"
                        style={{ background: tempStyle.bg }}>
                        <HStack spacing={1}>
                          <Thermometer size={10} color={tempStyle.color} />
                          <Text fontSize="xs" fontWeight="700" style={{ color: tempStyle.color }}>
                            {tempStyle.label}
                          </Text>
                        </HStack>
                      </Box>
                    </WrapItem>
                  )}
                  {product.cold_chain_required && (
                    <WrapItem>
                      <Chip label="Chaîne du froid" bg="#ecfeff" color="#0e7490" />
                    </WrapItem>
                  )}
                  {product.is_new && <WrapItem><Chip label="NOUVEAU" bg={N.greenBg} color={N.green} /></WrapItem>}
                  {product.is_on_promotion && <WrapItem><Chip label="PROMO" bg={N.redBg} color={N.red} /></WrapItem>}
                </Wrap>
                {product.review_count > 0 && (
                  <HStack spacing={1.5}>
                    <HStack spacing={0.5}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={12}
                          fill={i < Math.round(product.avg_rating) ? '#f59e0b' : 'none'} color="#f59e0b" />
                      ))}
                    </HStack>
                    <Text fontSize="xs" fontWeight="600" style={{ color: N.navy }}>{product.avg_rating.toFixed(1)}</Text>
                    <Text fontSize="xs" style={{ color: N.muted }}>({product.review_count})</Text>
                  </HStack>
                )}
              </Box>

              {/* 2 — Prix (navy bg) */}
              <Box px={5} py={4} style={{ background: `linear-gradient(135deg, ${N.navy} 0%, ${N.navyMid} 100%)`, borderBottom: `1px solid ${N.border}` }}>
                {sortedTiers.length > 0 ? (
                  <>
                    <Text fontSize="9px" color="rgba(255,255,255,0.5)" fontWeight="700"
                      textTransform="uppercase" letterSpacing="0.1em" mb={1}>
                      Prix unitaire · {qty} unité{qty > 1 ? 's' : ''}
                    </Text>
                    <HStack align="baseline" spacing={2} mb={1.5}>
                      <Text fontSize="2xl" fontWeight="800" color="white" lineHeight={1} fontFamily="mono">
                        {activeTier?.unit_price.toFixed(2) ?? '—'}
                      </Text>
                      <Text fontSize="sm" style={{ color: N.amber }} fontWeight="700">{product.currency}/u</Text>
                    </HStack>
                    <Text fontSize="xs" color="rgba(255,255,255,0.45)" fontFamily="mono">
                      Total : {activeTier ? (activeTier.unit_price * qty).toFixed(2) : '—'} {product.currency} HT
                    </Text>
                    {/* Volume tiers inline */}
                    {sortedTiers.length > 1 && (
                      <Box mt={3} pt={3} style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                        <VStack spacing={1} align="stretch">
                          {sortedTiers.map((tier) => {
                            const active = activeTier?.id === tier.id;
                            return (
                              <Flex key={tier.id} justify="space-between" align="center"
                                px={2.5} py={1.5} rounded="lg"
                                style={{ background: active ? 'rgba(255,255,255,0.12)' : 'transparent' }}>
                                <HStack spacing={2}>
                                  {active && <CheckCircle size={10} color={N.amber} />}
                                  <Text fontSize="xs" color={active ? 'white' : 'rgba(255,255,255,0.55)'}
                                    fontWeight={active ? '700' : '400'}>
                                    {tier.qty_min}+ u
                                  </Text>
                                </HStack>
                                <Text fontSize="xs" fontWeight="700" fontFamily="mono"
                                  style={{ color: active ? N.amber : 'rgba(255,255,255,0.55)' }}>
                                  {tier.unit_price.toFixed(2)} {product.currency}
                                </Text>
                              </Flex>
                            );
                          })}
                        </VStack>
                        {/* Nudge */}
                        {(() => {
                          const next = sortedTiers.find((t) => t.qty_min > qty);
                          if (!next || !activeTier) return null;
                          const pct = ((activeTier.unit_price - next.unit_price) / activeTier.unit_price * 100).toFixed(0);
                          return (
                            <Text fontSize="10px" color="rgba(255,255,255,0.6)" mt={2} textAlign="center">
                              +{next.qty_min - qty} u → {next.unit_price.toFixed(2)} {product.currency}/u (−{pct}%)
                            </Text>
                          );
                        })()}
                      </Box>
                    )}
                  </>
                ) : (
                  <Text fontSize="sm" color="rgba(255,255,255,0.7)">
                    Prix sur devis — contactez le vendeur
                  </Text>
                )}
              </Box>

              {/* 3 — Delivery method */}
              <Box px={5} py={4} style={{ borderBottom: `1px solid ${N.border}` }}>
                <Text fontSize="10px" fontWeight="700" style={{ color: N.muted }} mb={2.5}
                  textTransform="uppercase" letterSpacing="0.08em">
                  Mode de livraison
                </Text>
                <VStack spacing={1.5} align="stretch">
                  {deliveryMethods.map((method) => {
                    const m = DELIVERY_LABEL[method] ?? { label: method, desc: '', icon: Truck };
                    const Icon = m.icon;
                    const isSelected = selectedDelivery === method;
                    return (
                      <Flex key={method} align="center" gap={3} px={3} py={2.5} rounded="xl" cursor="pointer"
                        style={{
                          border: `1.5px solid ${isSelected ? N.amber : N.border}`,
                          background: isSelected ? N.amber10 : 'white',
                        }}
                        _hover={{ borderColor: N.amber, background: N.amber10 }}
                        transition="all 0.12s"
                        onClick={() => setSelectedDelivery(method)}>
                        <Flex w={8} h={8} rounded="lg" align="center" justify="center" flexShrink={0}
                          style={{ background: isSelected ? N.amber : N.bgAlt }}>
                          <Icon size={14} color={isSelected ? 'white' : N.muted} />
                        </Flex>
                        <Box flex={1} minW={0}>
                          <Text fontSize="xs" fontWeight="700"
                            style={{ color: isSelected ? N.navy : N.slate }}>{m.label}</Text>
                          <Text fontSize="10px" style={{ color: N.muted }}>{m.desc}</Text>
                        </Box>
                        {isSelected && <CheckCircle size={14} color={N.amber} />}
                      </Flex>
                    );
                  })}
                </VStack>
                {product.estimated_lead_days > 0 && (
                  <HStack spacing={1.5} mt={2.5}>
                    <Clock size={12} color={N.amber} />
                    <Text fontSize="xs" style={{ color: N.muted }}>
                      Délai estimé : <strong style={{ color: N.navy }}>{product.estimated_lead_days} jours ouvrés</strong>
                    </Text>
                  </HStack>
                )}
              </Box>

              {/* 4 — Qty + CTA */}
              <Box px={5} pt={4} pb={5}>
                <Flex gap={3} align="center" mb={3.5}>
                  <Box flex={1}>
                    <Text fontSize="10px" fontWeight="700" style={{ color: N.muted }} mb={1}
                      textTransform="uppercase" letterSpacing="0.05em">
                      Quantité (MOQ : {product.moq})
                    </Text>
                    <NumberInput value={qty} min={normalizeQty(product.moq, product.moq, product.pack_size)}
                      step={Math.max(1, product.pack_size || 1)} keepWithinRange={false} clampValueOnBlur={false}
                      onChange={(_, v) => setQty(isNaN(v) ? product.moq : v)}
                      onBlur={() => setQty((q) => normalizeQty(q, product.moq, product.pack_size))}>
                      <NumberInputField rounded="xl" fontFamily="mono" fontWeight="700" fontSize="sm"
                        style={{ borderColor: N.border }}
                        _focus={{ borderColor: N.amber, boxShadow: `0 0 0 1px ${N.amber}` }} />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                  </Box>
                  {product.pack_size > 1 && (
                    <Box pt={4}>
                      <Box px={2.5} py={1.5} rounded="xl"
                        style={{ background: N.bgAlt, border: `1px solid ${N.border}` }}>
                        <Text fontSize="10px" style={{ color: N.muted }}>Colis</Text>
                        <Text fontWeight="700" style={{ color: N.navy }} fontFamily="mono" lineHeight={1}>
                          {product.pack_size} u
                        </Text>
                      </Box>
                    </Box>
                  )}
                </Flex>
                <VStack spacing={2}>
                  {sortedTiers.length > 0 ? (
                    <Button leftIcon={<ShoppingCart size={15} />} w="full" rounded="xl" size="lg"
                      isLoading={addingToCart === 'main'} isDisabled={addingToCart !== null}
                      onClick={() => addToCart()} fontWeight="800"
                      style={{ background: N.navy, color: 'white' }} _hover={{ opacity: 0.9 }}>
                      Ajouter au panier
                    </Button>
                  ) : (
                    <Button leftIcon={<FileText size={15} />} w="full" rounded="xl" size="lg"
                      onClick={() => navigate('/buyer/quotes')} fontWeight="800"
                      style={{ background: N.navy, color: 'white' }} _hover={{ opacity: 0.9 }}>
                      Demander un devis
                    </Button>
                  )}
                  {sortedTiers.length > 0 && (
                    <Button variant="outline" leftIcon={<FileText size={14} />} w="full" rounded="xl"
                      onClick={() => navigate('/buyer/quotes')} fontWeight="700" fontSize="sm"
                      style={{ borderColor: N.border, color: N.navy }}
                      _hover={{ borderColor: N.amber, background: N.amber10 }}>
                      Demander un devis
                    </Button>
                  )}
                  <Button variant="ghost" w="full" rounded="xl" fontSize="sm"
                    leftIcon={<Scale size={14} />}
                    style={{ color: hasItem(product.id) ? N.amber : N.muted }}
                    _hover={{ background: N.bgAlt, color: N.navy }}
                    onClick={() => hasItem(product.id) ? removeItem(product.id) : addItem(product)}>
                    {hasItem(product.id) ? 'Retirer du comparateur' : 'Comparer'}
                  </Button>
                </VStack>
              </Box>

              {/* 4b — Offres marketing campagne */}
              {(productCampaigns.volumeDeal || productCampaigns.promoCode || productCampaigns.hasSampling || productCampaigns.hasFlashSale) && (
                <Box px={5} pb={3}>
                  <ProductCampaignPanel productId={product.id} campaigns={productCampaigns} />
                </Box>
              )}

              {/* 5 — Seller footer */}
              {product.organisations && (
                <Flex px={5} py={3} align="center" gap={3} justify="space-between"
                  style={{ borderTop: `1px solid ${N.border}`, background: N.bgAlt }}>
                  <HStack spacing={2} minW={0}>
                    <Flex w={7} h={7} rounded="lg" align="center" justify="center" flexShrink={0}
                      style={{ background: N.navy }}>
                      <Building2 size={13} color="white" />
                    </Flex>
                    <Text fontSize="xs" fontWeight="700" style={{ color: N.navy }} noOfLines={1}>
                      {product.organisations.name}
                    </Text>
                  </HStack>
                  <HStack spacing={3} flexShrink={0}>
                    {product.organisations.validation_status === 'active' && (
                      <HStack spacing={1}>
                        <Shield size={11} color="#16a34a" />
                        <Text fontSize="10px" color="green.700" fontWeight="600">Vérifié</Text>
                      </HStack>
                    )}
                    {product.haccp_compliant && (
                      <HStack spacing={1}>
                        <CheckCircle size={11} color="#2563eb" />
                        <Text fontSize="10px" color="blue.700" fontWeight="600">HACCP</Text>
                      </HStack>
                    )}
                  </HStack>
                </Flex>
              )}
            </Box>
          ) : user ? (
            /* Connecté mais sans organisation : finir l'inscription, pas /auth */
            <Box rounded="2xl" overflow="hidden"
              style={{ border: `1.5px solid ${N.border}`, boxShadow: '0 4px 24px rgba(13,31,56,0.08)' }}>
              <Box px={5} py={5}
                style={{ background: `linear-gradient(135deg, ${N.navy} 0%, ${N.navyMid} 100%)` }}>
                <HStack spacing={2} mb={2}>
                  <Lock size={12} color="rgba(255,255,255,0.5)" />
                  <Text fontSize="9px" color="rgba(255,255,255,0.6)" fontWeight="700"
                    textTransform="uppercase" letterSpacing="0.1em">
                    Dossier professionnel
                  </Text>
                </HStack>
                <Text fontWeight="800" color="white" fontSize="sm" lineHeight={1.4}>
                  {profile?.onboarding_done
                    ? 'Votre dossier est en cours de validation'
                    : 'Finalisez votre inscription pour voir les tarifs'}
                </Text>
              </Box>
              <Box bg="white" px={5} py={4}>
                <Button leftIcon={<UserPlus size={14} />} onClick={goToFinishSignup}
                  w="full" size="sm" rounded="xl" fontWeight="700"
                  style={{ background: N.amber, color: 'white' }} _hover={{ opacity: 0.9 }}>
                  {profile?.onboarding_done ? 'Voir le statut de mon dossier' : 'Finaliser mon inscription'}
                </Button>
              </Box>
            </Box>
          ) : (
            /* Price lock for non-authenticated */
            <Box rounded="2xl" overflow="hidden"
              style={{ border: `1.5px solid ${N.border}`, boxShadow: '0 4px 24px rgba(13,31,56,0.08)' }}>
              <Box px={5} py={5}
                style={{ background: `linear-gradient(135deg, ${N.navy} 0%, ${N.navyMid} 100%)` }}>
                <HStack spacing={2} mb={2}>
                  <Lock size={12} color="rgba(255,255,255,0.5)" />
                  <Text fontSize="9px" color="rgba(255,255,255,0.6)" fontWeight="700"
                    textTransform="uppercase" letterSpacing="0.1em">
                    Accès réservé · Professionnels
                  </Text>
                </HStack>
                <Text fontWeight="800" color="white" fontSize="sm" lineHeight={1.4}>
                  Tarifs dégressifs, MOQ et livraison
                </Text>
              </Box>
              <Box bg="white" px={5} py={4}>
                <Text style={{ color: N.muted }} fontSize="xs" lineHeight={1.8} mb={4}>
                  Accès réservé aux professionnels avec dossier validé.
                </Text>
                <VStack spacing={2}>
                  <Button leftIcon={<UserPlus size={14} />} onClick={() => goToAuth(true)}
                    w="full" size="sm" rounded="xl" fontWeight="700"
                    style={{ background: N.amber, color: 'white' }} _hover={{ opacity: 0.9 }}>
                    Créer un compte professionnel
                  </Button>
                  <Button variant="ghost" onClick={() => goToAuth(false)} w="full" size="sm"
                    rounded="xl" fontWeight="600" style={{ color: N.navy }} fontSize="xs">
                    Déjà membre — Se connecter
                  </Button>
                </VStack>
              </Box>
            </Box>
          )}

          {/* Recommandation — meilleur fournisseur pour ce produit, tous vendeurs confondus */}
          {activeOrg && reco && reco.ranked.length > 1 && (() => {
            const top = reco.ranked[0];
            const current = reco.ranked.find((r) => r.offer.productId === product.id);
            const isTop = top.offer.productId === product.id;
            return (
              <Box mt={3} bg="white" rounded="2xl" p={4}
                style={{ border: `1.5px solid ${isTop ? '#86efac' : N.amber}` }}>
                <HStack mb={2} spacing={2}>
                  <Award size={14} color={isTop ? '#16a34a' : N.amber} />
                  <Text fontWeight="700" fontSize="xs" color={isTop ? 'green.800' : N.navy}
                    textTransform="uppercase" letterSpacing="0.05em">
                    {isTop ? 'Meilleure offre recommandée' : 'Une offre plus avantageuse existe'}
                  </Text>
                </HStack>
                {isTop ? (
                  <Text fontSize="xs" style={{ color: N.muted }} lineHeight={1.6}>
                    Chez <strong style={{ color: N.navy }}>{top.offer.sellerName}</strong>, ce produit
                    est notre meilleur choix global ({top.breakdown.finalScore.toFixed(0)}/100 — prix,
                    livraison, qualité fournisseur, fraîcheur et proximité combinés) parmi{' '}
                    {reco.ranked.length} fournisseurs.
                  </Text>
                ) : (
                  <>
                    <Text fontSize="xs" style={{ color: N.muted }} lineHeight={1.6} mb={3}>
                      <strong style={{ color: N.navy }}>{top.offer.sellerName}</strong> propose ce même
                      produit avec un meilleur score global ({top.breakdown.finalScore.toFixed(0)}/100
                      {current && ` vs ${current.breakdown.finalScore.toFixed(0)}/100 ici`}) — prix,
                      livraison, qualité fournisseur, fraîcheur et proximité combinés.
                    </Text>
                    <Button size="sm" w="full" rounded="xl" fontWeight="700" fontSize="xs"
                      rightIcon={<ArrowRight size={12} />}
                      style={{ background: N.amber, color: 'white' }} _hover={{ opacity: 0.9 }}
                      onClick={() => navigate(`/product/${top.offer.productId}`)}>
                      Voir l'offre recommandée — {top.offer.sellerName}
                    </Button>
                  </>
                )}
              </Box>
            );
          })()}

          {/* DLC lots */}
          {lots.some((l) => l.specific_price != null) && (
            <Box mt={3} bg="white" rounded="2xl" p={4}
              style={{ border: `1.5px solid #fb923c` }}>
              <HStack mb={3} spacing={2}>
                <AlertTriangle size={14} color="#ea580c" />
                <Text fontWeight="700" fontSize="xs" color="orange.800"
                  textTransform="uppercase" letterSpacing="0.05em">
                  Prix déstockage DLC
                </Text>
              </HStack>
              <VStack spacing={2} align="stretch">
                {lots.filter((l) => l.specific_price != null).map((lot) => {
                  const days = lot.expiry_date ? daysUntil(lot.expiry_date) : null;
                  return (
                    <Flex key={lot.id} align="center" justify="space-between" gap={2}
                      px={3} py={2.5} rounded="xl"
                      style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
                      <Box>
                        <Text fontFamily="mono" fontSize="xs" fontWeight="700" color="orange.900">
                          Lot {lot.lot_number}
                        </Text>
                        <HStack spacing={2}>
                          <Text fontWeight="800" fontSize="sm" color="orange.800" fontFamily="mono">
                            {lot.specific_price!.toFixed(2)} {product.currency}
                          </Text>
                          {days !== null && (
                            <Text fontSize="10px" color={days < 0 ? N.red : days <= 30 ? '#c2410c' : N.green}>
                              DLC J{days >= 0 ? '+' : ''}{days}
                            </Text>
                          )}
                          <Text fontSize="10px" color="orange.700">{lot.qty_available} u dispo.</Text>
                        </HStack>
                      </Box>
                      <Button size="xs" rounded="xl" fontWeight="700"
                        isLoading={addingToCart === lot.id} isDisabled={addingToCart !== null}
                        leftIcon={<ShoppingCart size={11} />}
                        style={{ background: '#ea580c', color: 'white' }}
                        _hover={{ opacity: 0.9 }}
                        onClick={() => addToCart(lot)}>
                        Acheter
                      </Button>
                    </Flex>
                  );
                })}
              </VStack>
            </Box>
          )}
        </Box>
      </Grid>

      {/* ── Section anchor nav ───────────────────────────────────────────── */}
      <Box position="sticky" top={{ base: '60px', md: '68px' }} zIndex={100} bg="white" mt={10}
        style={{ borderTop: `1px solid ${N.border}`, borderBottom: `1px solid ${N.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <Flex overflowX="auto" h="40px" align="center"
          sx={{ '&::-webkit-scrollbar': { display: 'none' } }}>
          {sectionNav.map(({ id, label }) => (
            <Box as="a" key={id} href={`#${id}`}
              px={4} h="40px" display="flex" alignItems="center"
              whiteSpace="nowrap" fontSize="xs" fontWeight="600"
              style={{ color: N.muted, borderBottom: '2px solid transparent' }}
              _hover={{ color: N.navy, borderBottomColor: N.amber }}
              transition="all 0.12s">
              {label}
            </Box>
          ))}
        </Flex>
      </Box>

      {/* ── SECTIONS ─────────────────────────────────────────────────────── */}
      <Box>

        {/* Description */}
        {(product.long_description || product.usp) && (
          <Section id="description" title="Description" icon={FileText}>
            {product.long_description && (
              <Text style={{ color: N.slate }} lineHeight={1.9} mb={product.usp ? 6 : 0}
                whiteSpace="pre-wrap" maxW="780px">
                {product.long_description}
              </Text>
            )}
            {product.usp && (
              <Box px={5} py={4} rounded="xl" maxW="600px"
                style={{ background: N.amber10, border: `1px solid ${N.amber}55` }}>
                <HStack spacing={2} mb={1}>
                  <Zap size={13} color={N.amber} />
                  <Text fontSize="10px" fontWeight="700" style={{ color: N.amber }}
                    textTransform="uppercase" letterSpacing="0.08em">Points forts</Text>
                </HStack>
                <Text fontSize="sm" style={{ color: '#78350f' }} lineHeight={1.8}>{product.usp}</Text>
              </Box>
            )}
          </Section>
        )}

        {/* Composition & Nutrition */}
        {hasNutrition && (
          <Section id="nutrition" title="Composition & Nutrition" icon={Leaf}>
            <SimpleGrid columns={{ base: 1, md: product.nutri_score ? 2 : 1 }} spacing={8}>

              {/* Left col */}
              <VStack align="stretch" spacing={6}>
                {product.allergens?.length > 0 && (
                  <Box>
                    <Text fontSize="10px" fontWeight="700" style={{ color: N.muted }} mb={3}
                      textTransform="uppercase" letterSpacing="wide">Allergènes</Text>
                    <Wrap spacing={2}>
                      {product.allergens.map((a) => (
                        <WrapItem key={a}>
                          <HStack px={3} py={1.5} rounded="xl" spacing={2}
                            style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
                            <AlertTriangle size={11} color="#ea580c" />
                            <Text fontSize="xs" fontWeight="600" color="orange.700">{a}</Text>
                          </HStack>
                        </WrapItem>
                      ))}
                    </Wrap>
                  </Box>
                )}
                {product.ingredients && (
                  <Box>
                    <Text fontSize="10px" fontWeight="700" style={{ color: N.muted }} mb={2}
                      textTransform="uppercase" letterSpacing="wide">Ingrédients</Text>
                    <Text fontSize="sm" style={{ color: N.slate }} lineHeight={1.9}>{product.ingredients}</Text>
                  </Box>
                )}
                {product.nutritional_info && !hasNutriValues && (
                  <Box rounded="xl" p={4} style={{ background: N.bgAlt, border: `1px solid ${N.border}` }}>
                    <Text as="pre" fontSize="xs" style={{ color: N.slate }} fontFamily="mono"
                      whiteSpace="pre-wrap" lineHeight={1.9}>{product.nutritional_info}</Text>
                  </Box>
                )}
              </VStack>

              {/* Right col: nutri-score + table */}
              <VStack align="stretch" spacing={5}>
                {product.nutri_score && (
                  <Box>
                    <Text fontSize="10px" fontWeight="700" style={{ color: N.muted }} mb={3}
                      textTransform="uppercase" letterSpacing="wide">Nutri-Score</Text>
                    <HStack spacing={2}>
                      {(['A', 'B', 'C', 'D', 'E'] as const).map((s) => {
                        const active = s === product.nutri_score;
                        return (
                          <Flex key={s}
                            w={active ? '44px' : '32px'} h={active ? '44px' : '32px'}
                            rounded="lg" align="center" justify="center" flexShrink={0}
                            fontWeight="800" fontSize={active ? 'lg' : 'sm'}
                            transition="all 0.2s"
                            style={{
                              background: NUTRI_BG[s], color: NUTRI_FG[s],
                              opacity: active ? 1 : 0.3,
                              boxShadow: active ? `0 4px 12px ${NUTRI_BG[s]}88` : 'none',
                            }}>
                            {s}
                          </Flex>
                        );
                      })}
                    </HStack>
                  </Box>
                )}
                {hasNutriValues && nutValues && (
                  <Box>
                    <Text fontSize="10px" fontWeight="700" style={{ color: N.muted }} mb={3}
                      textTransform="uppercase" letterSpacing="wide">Valeurs / 100 g</Text>
                    <Box rounded="xl" overflow="hidden" style={{ border: `1px solid ${N.border}` }}>
                      <Table size="sm" variant="simple">
                        <Thead>
                          <Tr style={{ background: N.bgAlt }}>
                            <Th fontSize="10px" style={{ color: N.muted }}>Valeur</Th>
                            <Th fontSize="10px" style={{ color: N.muted }} isNumeric>Pour 100 g</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {NUTRI_ROWS.filter((r) => nutValues[r.key] != null).map((r) => {
                            const isSub = r.label.startsWith('dont');
                            return (
                              <Tr key={r.key} _hover={{ background: N.bgAlt }}>
                                <Td fontSize="xs" style={{ color: isSub ? N.muted : N.slate }}
                                  pl={isSub ? 7 : 3} py={2} fontStyle={isSub ? 'italic' : 'normal'}>
                                  {r.label}
                                </Td>
                                <Td isNumeric fontSize="xs"
                                  fontWeight={isSub ? 'normal' : '600'}
                                  style={{ color: isSub ? N.muted : N.navy }} py={2}>
                                  {nutValues[r.key]} {r.unit}
                                </Td>
                              </Tr>
                            );
                          })}
                        </Tbody>
                      </Table>
                    </Box>
                  </Box>
                )}
              </VStack>
            </SimpleGrid>
          </Section>
        )}

        {/* Emballage */}
        {hasPackaging && (
          <Section id="packaging" title="Emballage & Colisage" icon={Package}>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={10}>
              <Box>
                <Text fontSize="10px" fontWeight="700" style={{ color: N.muted }} mb={3}
                  textTransform="uppercase" letterSpacing="wide">Caractéristiques emballage</Text>
                <DRow label="Type d'emballage" value={product.packaging_type} />
                <DRow label="Matériau" value={product.packaging_material} />
                <DRow label="Colisage" value={product.pack_size > 1 ? `${product.pack_size} u / colis` : null} />
                <DRow label="Units / inner pack" value={product.units_per_inner != null ? `${product.units_per_inner}` : null} />
                <DRow label="Recyclable" value={product.recyclable != null ? (product.recyclable ? '✓ Oui' : '✗ Non') : null} />
                <DRow label="Éco-score" value={product.eco_score} />
              </Box>
              <Box>
                <Text fontSize="10px" fontWeight="700" style={{ color: N.muted }} mb={3}
                  textTransform="uppercase" letterSpacing="wide">Dimensions (L × l × H — poids)</Text>
                {[
                  { label: 'Unité', dims: dimsUnit },
                  { label: 'Carton', dims: dimsCarton },
                  { label: 'Palette', dims: dimsPallet },
                ].filter((r) => r.dims).map(({ label, dims }) => {
                  const d = dims!;
                  const hasDims = d.length != null || d.width != null || d.height != null;
                  return (
                    <Flex key={label} py={3} gap={4}
                      style={{ borderBottom: `1px solid ${N.border}` }} align="start">
                      <Text fontSize="10px" fontWeight="700" style={{ color: N.muted }}
                        minW="56px" flexShrink={0} textTransform="uppercase" letterSpacing="0.05em" pt={0.5}>
                        {label}
                      </Text>
                      <Box>
                        {hasDims && (
                          <Text fontSize="sm" style={{ color: N.navy }} fontFamily="mono" fontWeight="600">
                            {d.length ?? '—'} × {d.width ?? '—'} × {d.height ?? '—'} cm
                          </Text>
                        )}
                        <HStack spacing={4} mt={0.5}>
                          {d.weight_net != null && (
                            <Text fontSize="xs" style={{ color: N.muted }}>Net {d.weight_net} kg</Text>
                          )}
                          {d.weight_brut != null && (
                            <Text fontSize="xs" style={{ color: N.muted }}>Brut {d.weight_brut} kg</Text>
                          )}
                        </HStack>
                      </Box>
                    </Flex>
                  );
                })}
                {pallet && (pallet.cartons_per_layer || pallet.layers_per_palette) && (
                  <Box mt={4}>
                    <Text fontSize="10px" fontWeight="700" style={{ color: N.muted }} mb={3}
                      textTransform="uppercase" letterSpacing="wide">Palettisation</Text>
                    <HStack spacing={3}>
                      {pallet.cartons_per_layer != null && (
                        <Box px={4} py={3} rounded="xl" flex={1}
                          style={{ background: N.bgAlt, border: `1px solid ${N.border}` }}>
                          <Text fontSize="9px" style={{ color: N.muted }}>Cartons / couche</Text>
                          <Text fontWeight="800" style={{ color: N.navy }} fontSize="xl" fontFamily="mono">
                            {pallet.cartons_per_layer}
                          </Text>
                        </Box>
                      )}
                      {pallet.layers_per_palette != null && (
                        <Box px={4} py={3} rounded="xl" flex={1}
                          style={{ background: N.bgAlt, border: `1px solid ${N.border}` }}>
                          <Text fontSize="9px" style={{ color: N.muted }}>Couches / palette</Text>
                          <Text fontWeight="800" style={{ color: N.navy }} fontSize="xl" fontFamily="mono">
                            {pallet.layers_per_palette}
                          </Text>
                        </Box>
                      )}
                      {cartonsPerPallet != null && (
                        <Box px={4} py={3} rounded="xl" flex={1}
                          style={{ background: N.amber10, border: `1px solid ${N.amber}55` }}>
                          <Text fontSize="9px" style={{ color: N.amber }}>Total / palette</Text>
                          <Text fontWeight="800" style={{ color: N.navy }} fontSize="xl" fontFamily="mono">
                            {cartonsPerPallet}
                          </Text>
                        </Box>
                      )}
                    </HStack>
                  </Box>
                )}
              </Box>
            </SimpleGrid>
          </Section>
        )}

        {/* Logistique */}
        {hasLogistics && (
          <Section id="logistics" title="Logistique & Transport" icon={Truck}>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={10}>
              <Box>
                <Text fontSize="10px" fontWeight="700" style={{ color: N.muted }} mb={3}
                  textTransform="uppercase" letterSpacing="wide">Données transport</Text>
                <DRow label="Délai de livraison"
                  value={product.estimated_lead_days > 0 ? `${product.estimated_lead_days} jours ouvrés` : null} />
                <DRow label="MOQ"
                  value={product.moq > 1 ? `${product.moq} unités minimum` : null} />
                <DRow label="Chaîne du froid"
                  value={product.cold_chain_required ? `Requis — ${tempStyle.label}` : null} />
                <DRow label="Classe danger" value={product.hazard_class} />
                <DRow label="Fragilité"
                  value={product.fragility_level ? (
                    <Text fontWeight="700"
                      style={{ color: FRAGILITY_LABEL[product.fragility_level]?.color, fontSize: '14px' }}>
                      {FRAGILITY_LABEL[product.fragility_level]?.label}
                    </Text>
                  ) : null} />
                <DRow label="Empilabilité max."
                  value={product.stackability_max != null ? `${product.stackability_max} niveaux` : null} />
                <DRow label="Volume / carton"
                  value={product.volume_cbm_carton != null ? `${product.volume_cbm_carton} m³` : null} />
                <DRow label="Poids palette"
                  value={product.pallet_weight_kg != null ? `${product.pallet_weight_kg} kg` : null} />
              </Box>
              <Box>
                {product.incoterms?.length > 0 && (
                  <Box mb={6}>
                    <Text fontSize="10px" fontWeight="700" style={{ color: N.muted }} mb={3}
                      textTransform="uppercase" letterSpacing="wide">Incoterms</Text>
                    <Wrap spacing={2}>
                      {product.incoterms.map((inc) => (
                        <WrapItem key={inc}>
                          <Box px={4} py={2} rounded="xl"
                            style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                            <Text fontWeight="800" color="blue.700" fontSize="sm" fontFamily="mono">{inc}</Text>
                          </Box>
                        </WrapItem>
                      ))}
                    </Wrap>
                  </Box>
                )}
                <Text fontSize="10px" fontWeight="700" style={{ color: N.muted }} mb={3}
                  textTransform="uppercase" letterSpacing="wide">Méthodes disponibles</Text>
                <VStack spacing={2} align="stretch">
                  {deliveryMethods.map((m) => {
                    const dm = DELIVERY_LABEL[m];
                    if (!dm) return null;
                    const Icon = dm.icon;
                    return (
                      <HStack key={m} spacing={3} px={3} py={2.5} rounded="xl"
                        style={{ background: N.bgAlt, border: `1px solid ${N.border}` }}>
                        <Flex w={8} h={8} rounded="lg" align="center" justify="center" flexShrink={0}
                          style={{ background: 'white', border: `1px solid ${N.border}` }}>
                          <Icon size={14} color={N.navy} />
                        </Flex>
                        <Box>
                          <Text fontSize="xs" fontWeight="700" style={{ color: N.navy }}>{dm.label}</Text>
                          <Text fontSize="10px" style={{ color: N.muted }}>{dm.desc}</Text>
                        </Box>
                      </HStack>
                    );
                  })}
                </VStack>
              </Box>
            </SimpleGrid>
          </Section>
        )}

        {/* Conservation */}
        {hasStorage && (
          <Section id="storage" title="Conservation & Durée de vie" icon={Clock}>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={10} maxW="780px">
              <Box>
                <DRow label="Conditions" value={
                  <Chip label={tempStyle.label} bg={tempStyle.bg} color={tempStyle.color} />
                } />
                <DRow label="Plage temp."
                  value={(product.min_shelf_temp != null || product.max_shelf_temp != null)
                    ? `${product.min_shelf_temp ?? '—'} °C à ${product.max_shelf_temp ?? '—'} °C`
                    : null} />
                <DRow label={product.dlc_type ?? 'Conservation'}
                  value={product.shelf_life_days ? `${product.shelf_life_days} jours` : null} />
                <DRow label="Après ouverture"
                  value={product.after_opening_days ? `${product.after_opening_days} jours` : null} />
                <DRow label="Rotation" value={product.fifo_required ? 'FIFO requis' : null} />
                <DRow label="Lumière" value={product.light_sensitive ? 'Sensible — protéger' : null} />
                <DRow label="Humidité" value={product.humidity_sensitive ? 'Conserver au sec' : null} />
              </Box>
            </SimpleGrid>
          </Section>
        )}

        {/* Origine & Certifications */}
        {hasOrigin && (
          <Section id="origin" title="Origine & Certifications" icon={Factory}>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={10}>
              <Box>
                <Text fontSize="10px" fontWeight="700" style={{ color: N.muted }} mb={3}
                  textTransform="uppercase" letterSpacing="wide">Production</Text>
                <DRow label="Pays d'origine" value={product.origin_country ? (
                  <HStack spacing={1.5}>
                    <MapPin size={13} color={N.amber} />
                    <Text fontSize="sm" style={{ color: N.navy }} fontWeight="500">{product.origin_country}</Text>
                  </HStack>
                ) : null} />
                <DRow label="Fabricant" value={product.manufacturer_name} />
                <DRow label="Pays fabricant" value={product.manufacturer_country} />
                <DRow label="Mode production" value={product.production_method
                  ? { industrial: 'Industriel', artisanal: 'Artisanal', hybrid: 'Hybride' }[product.production_method]
                  : null} />
                <DRow label="Traçabilité" value={product.traceability_level
                  ? { lot: 'Par lot', ean: 'Par EAN', serial: 'Par numéro de série' }[product.traceability_level]
                  : null} />
                {product.export_countries?.length > 0 && (
                  <DRow label="Export" value={product.export_countries.join(', ')} />
                )}
              </Box>
              {product.certifications?.length > 0 && (
                <Box>
                  <Text fontSize="10px" fontWeight="700" style={{ color: N.muted }} mb={3}
                    textTransform="uppercase" letterSpacing="wide">Certifications & Labels</Text>
                  <Wrap spacing={2}>
                    {product.certifications.map((cert) => (
                      <WrapItem key={cert}>
                        <HStack px={3} py={2} rounded="xl" spacing={2}
                          style={{ background: N.greenBg, border: `1px solid #86efac` }}>
                          <Award size={12} color={N.green} />
                          <Text fontWeight="700" style={{ color: N.green }} fontSize="xs">{cert}</Text>
                        </HStack>
                      </WrapItem>
                    ))}
                  </Wrap>
                </Box>
              )}
            </SimpleGrid>
          </Section>
        )}

        {/* Codes */}
        {hasCodes && (
          <Section id="codes" title="Codes & Références" icon={Hash}>
            <HStack spacing={6} flexWrap="wrap">
              {product.ean && (
                <Box px={6} py={4} rounded="2xl"
                  style={{ background: N.bgAlt, border: `1px solid ${N.border}` }}>
                  <Text fontSize="10px" fontWeight="700" style={{ color: N.muted }}
                    textTransform="uppercase" letterSpacing="wide" mb={1}>Code EAN-13</Text>
                  <Text fontFamily="mono" fontSize="2xl" fontWeight="800"
                    style={{ color: N.navy }} letterSpacing="widest">
                    {product.ean}
                  </Text>
                </Box>
              )}
              {product.hs_code && (
                <Box px={6} py={4} rounded="2xl"
                  style={{ background: N.bgAlt, border: `1px solid ${N.border}` }}>
                  <Text fontSize="10px" fontWeight="700" style={{ color: N.muted }}
                    textTransform="uppercase" letterSpacing="wide" mb={1}>Code SH</Text>
                  <Text fontFamily="mono" fontSize="2xl" fontWeight="800"
                    style={{ color: N.navy }} letterSpacing="widest">
                    {product.hs_code}
                  </Text>
                </Box>
              )}
            </HStack>
          </Section>
        )}

        {/* Documents */}
        {documents.length > 0 && (
          <Section id="documents" title="Documents & Sécurité" icon={Download}>
            {(product.haccp_compliant || product.msds_available) && (
              <Flex gap={4} mb={6} flexWrap="wrap">
                {product.haccp_compliant && (
                  <HStack spacing={2} px={4} py={2} rounded="xl"
                    style={{ background: N.greenBg, border: `1px solid #86efac` }}>
                    <CheckCircle size={14} color={N.green} />
                    <Text fontSize="sm" fontWeight="700" style={{ color: N.green }}>HACCP conforme</Text>
                  </HStack>
                )}
                {product.msds_available && (
                  <HStack spacing={2} px={4} py={2} rounded="xl"
                    style={{ background: N.greenBg, border: `1px solid #86efac` }}>
                    <Shield size={14} color={N.green} />
                    <Text fontSize="sm" fontWeight="700" style={{ color: N.green }}>FDS disponible</Text>
                  </HStack>
                )}
              </Flex>
            )}
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
              {documents.map((doc, i) => (
                <Flex key={i} align="center" gap={3} px={4} py={3.5} rounded="xl"
                  justify="space-between"
                  style={{ background: N.bgAlt, border: `1px solid ${N.border}` }}
                  _hover={{ shadow: 'sm' }} transition="all 0.15s">
                  <HStack spacing={3} minW={0} flex={1}>
                    <Flex w={10} h={10} rounded="xl" align="center" justify="center" flexShrink={0}
                      style={{ background: 'white', border: `1px solid ${N.border}` }}>
                      <FileDown size={16} color={DOC_COLOR[doc.type] ?? N.muted} />
                    </Flex>
                    <Box minW={0}>
                      <Text fontSize="sm" fontWeight="700" style={{ color: N.navy }} noOfLines={1}>
                        {doc.name}
                      </Text>
                      <Text fontSize="10px" fontWeight="700"
                        style={{ color: DOC_COLOR[doc.type] ?? N.muted }}>
                        {DOC_LABEL[doc.type] ?? 'Document'}
                      </Text>
                    </Box>
                  </HStack>
                  <Button as={Link} href={doc.url} isExternal size="sm" rounded="xl" fontWeight="700"
                    flexShrink={0} leftIcon={<Download size={12} />}
                    style={{ background: N.navy, color: 'white' }}
                    _hover={{ opacity: 0.85, textDecoration: 'none' }}>
                    DL
                  </Button>
                </Flex>
              ))}
            </SimpleGrid>
          </Section>
        )}

        {/* Commerce */}
        {hasDistrib && (
          <Section id="commercial" title="Commerce & Distribution" icon={BarChart2}>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={10}>
              {product.distribution_channels?.length > 0 && (
                <Box>
                  <Text fontSize="10px" fontWeight="700" style={{ color: N.muted }} mb={3}
                    textTransform="uppercase" letterSpacing="wide">Canaux de distribution</Text>
                  <Wrap spacing={2}>
                    {product.distribution_channels.map((ch) => (
                      <WrapItem key={ch}>
                        <Box px={3} py={2} rounded="xl"
                          style={{ background: N.bgAlt, border: `1px solid ${N.border}` }}>
                          <Text fontSize="xs" fontWeight="700" style={{ color: N.navy }}>
                            {DIST_LABEL[ch] ?? ch}
                          </Text>
                        </Box>
                      </WrapItem>
                    ))}
                  </Wrap>
                </Box>
              )}
              <Box>
                <Text fontSize="10px" fontWeight="700" style={{ color: N.muted }} mb={3}
                  textTransform="uppercase" letterSpacing="wide">Positionnement</Text>
                <DRow label="Segment cible" value={product.target_segment} />
                <DRow label="Valeur ajoutée" value={product.value_proposition
                  ? ({ price: 'Prix compétitif', quality: 'Qualité premium', eco: 'Éco-responsable',
                       luxury: 'Luxe / Premium', professional: 'Usage professionnel' } as Record<string, string>)[product.value_proposition]
                  : null} />
                <DRow label="Distribution" value={product.exclusive_dist != null
                  ? (product.exclusive_dist ? 'Exclusive' : 'Non exclusive')
                  : null} />
                <DRow label="Territoires" value={product.territory_allocation} />
              </Box>
            </SimpleGrid>
          </Section>
        )}

        {/* Avis */}
        <Section id="reviews" title={reviewCount > 0 ? `Avis clients (${reviewCount})` : 'Avis clients'} icon={MessageSquare}>
          {reviews.length === 0 ? (
            <Flex direction="column" align="center" py={10} gap={3}>
              <Flex w={14} h={14} rounded="2xl" align="center" justify="center"
                style={{ background: N.bgAlt, border: `1px solid ${N.border}` }}>
                <MessageSquare size={24} color="#cbd5e1" />
              </Flex>
              <Text fontWeight="700" style={{ color: N.navy }}>Aucun avis pour le moment</Text>
              <Text fontSize="sm" style={{ color: N.muted }}>Soyez le premier à donner votre avis après votre commande.</Text>
            </Flex>
          ) : (
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              {reviews.map((r) => (
                <Box key={r.id} rounded="xl" p={5}
                  style={{ background: N.bgAlt, border: `1px solid ${N.border}` }}>
                  <Flex justify="space-between" align="start" mb={3}>
                    <Box>
                      <Text fontWeight="700" fontSize="sm" style={{ color: N.navy }}>
                        {r.reviewer_name ?? 'Acheteur professionnel'}
                      </Text>
                      <Text fontSize="10px" style={{ color: N.muted }}>
                        {new Date(r.created_at).toLocaleDateString('fr-FR', {
                          day: '2-digit', month: 'long', year: 'numeric',
                        })}
                      </Text>
                    </Box>
                    <HStack spacing={0.5}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={13}
                          fill={i < r.rating ? '#f59e0b' : 'none'} color="#f59e0b" />
                      ))}
                    </HStack>
                  </Flex>
                  {r.comment && (
                    <Text fontSize="sm" style={{ color: N.slate }} lineHeight={1.8}>{r.comment}</Text>
                  )}
                  {r.verified && (
                    <HStack spacing={1.5} mt={2.5}>
                      <CheckCircle size={12} color="#16a34a" />
                      <Text fontSize="10px" color="green.700" fontWeight="700">Achat vérifié</Text>
                    </HStack>
                  )}
                </Box>
              ))}
            </SimpleGrid>
          )}
        </Section>
      </Box>

      {/* ── Produits similaires ───────────────────────────────────────────── */}
      {similar.length > 0 && (
        <Box pt={8}>
          <Flex justify="space-between" align="center" mb={6}>
            <Heading size="md" style={{ color: N.navy }}>Produits similaires</Heading>
            {product.category_id && (
              <Button size="sm" rounded="xl" variant="outline" fontWeight="700"
                rightIcon={<ArrowRight size={13} />}
                style={{ borderColor: N.border, color: N.navy }}
                _hover={{ borderColor: N.amber, background: N.amber10 }}
                onClick={() => navigate(`/catalog?category=${product.category_id}`)}>
                Voir tout
              </Button>
            )}
          </Flex>
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
            {similar.map((rec) => {
              const tier = rec.price_tiers?.slice().sort((a, b) => a.qty_min - b.qty_min)[0];
              const reasonLabel: Record<SimilarReason, string> = {
                brand: 'Même marque', distributor: 'Même fournisseur',
                ean: 'Famille EAN', category: 'Même catégorie',
              };
              return (
                <Box key={rec.id} bg="white" rounded="2xl" overflow="hidden"
                  style={{ border: `1px solid ${N.border}` }} cursor="pointer"
                  _hover={{ shadow: 'md', transform: 'translateY(-2px)' }} transition="all 0.18s"
                  onClick={() => navigate(`/product/${rec.id}`)}>
                  <Box h="145px" style={{ background: N.bgAlt }} overflow="hidden" position="relative">
                    {rec.images?.[0] ? (
                      <Image src={rec.images[0]} alt={rec.name} w="full" h="full"
                        objectFit="cover" loading="lazy" />
                    ) : (
                      <Flex w="full" h="full" align="center" justify="center">
                        <Package size={32} color="#cbd5e1" />
                      </Flex>
                    )}
                    <Box position="absolute" top={2} left={2} px={2} py={0.5} rounded="full"
                      style={{ background: 'rgba(13,31,56,0.75)' }}>
                      <Text fontSize="9px" fontWeight="700" color="white">
                        {reasonLabel[rec._reason]}
                      </Text>
                    </Box>
                  </Box>
                  <Box p={3.5}>
                    <Text fontSize="sm" fontWeight="700" style={{ color: N.navy }} noOfLines={2}
                      lineHeight={1.35} mb={1.5}>
                      {rec.name}
                    </Text>
                    {activeOrg && tier ? (
                      <HStack spacing={1} align="baseline">
                        <Text fontSize="md" fontWeight="800" style={{ color: N.navy }} fontFamily="mono">
                          {tier.unit_price.toFixed(2)}
                        </Text>
                        <Text fontSize="10px" style={{ color: N.muted }}>{rec.currency}/u</Text>
                      </HStack>
                    ) : (
                      <HStack spacing={1.5}>
                        <Lock size={11} color={N.muted} />
                        <Text fontSize="xs" style={{ color: N.muted }}>Accéder aux tarifs</Text>
                      </HStack>
                    )}
                  </Box>
                </Box>
              );
            })}
          </SimpleGrid>
        </Box>
      )}
    </VStack>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <VStack spacing={8} align="stretch">
      <Skeleton h="20px" w="320px" rounded="lg" />
      <Grid templateColumns={{ base: '1fr', lg: '1fr 390px' }} gap={10}>
        <Box>
          <Skeleton h="560px" rounded="2xl" />
          <HStack mt={4} spacing={3}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} w="88px" h="88px" rounded="xl" flexShrink={0} />
            ))}
          </HStack>
        </Box>
        <Box>
          <Skeleton h="480px" rounded="2xl" />
        </Box>
      </Grid>
      <Skeleton h="40px" rounded="lg" />
      <VStack spacing={10}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Box key={i} w="full">
            <Skeleton h="24px" w="200px" mb={6} rounded="lg" />
            <SkeletonText noOfLines={5} spacing={3} />
          </Box>
        ))}
      </VStack>
    </VStack>
  );
}

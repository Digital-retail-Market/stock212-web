// @ts-nocheck
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box, Flex, Grid, GridItem, Text, Input, InputGroup,
  InputLeftElement, Select, Checkbox, CheckboxGroup, VStack,
  Badge, Button, HStack, Skeleton, SimpleGrid, Image, IconButton,
  Divider, Tooltip, Spinner, useToast,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody,
  ModalFooter, ModalCloseButton, useDisclosure,
} from '@chakra-ui/react';
import {
  optimizeCart, computeLandedCost, addOptimizedLinesToCart,
} from '../../lib/cartOptimizer';
import type { LandedCostResult, OptimizedLine, EanInput } from '../../lib/cartOptimizer';
import { Search, SlidersHorizontal, ShoppingCart, Star, X, Lock, Scale, Package } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { addToCart as addToCartShared } from '../../lib/cart';
import { useComparator } from '../../contexts/ComparatorContext';
import { CategoryBreadcrumb } from '../../layouts/StorefrontLayout';
import { getCatStyle } from '../../lib/categoryIcons';
import { getCategoryLabel } from '../../lib/categoryLabel';
import { useMarketingStorefront } from '../../hooks/useMarketingStorefront';
import { useTranslation } from 'react-i18next';
import { SearchSponsoredBlock } from '../../components/marketing/HomepageBlocks';
import type { Product, Category, Brand } from '../../types';

function CatIcon({ name }: { name: string }) {
  const { Icon, bg, color } = getCatStyle(name);
  return (
    <Flex w={5} h={5} rounded="md" align="center" justify="center" flexShrink={0} style={{ background: bg }}>
      <Icon size={11} color={color} />
    </Flex>
  );
}

const SORT_OPTIONS_AUTH = [
  { value: 'created_at:desc', label: 'Plus récents' },
  { value: 'avg_rating:desc', label: 'Mieux notés' },
  { value: 'price:asc', label: 'Prix croissant' },
  { value: 'price:desc', label: 'Prix décroissant' },
];

const SORT_OPTIONS_GUEST = [
  { value: 'created_at:desc', label: 'Plus récents' },
  { value: 'avg_rating:desc', label: 'Mieux notés' },
];

const TEMPERATURES = ['ambient', 'refrigerated', 'fresh', 'frozen'];
const TEMP_LABELS: Record<string, string> = {
  ambient: 'Ambiant', refrigerated: 'Réfrigéré', fresh: 'Frais', frozen: 'Surgelé',
};

const CERT_OPTIONS = ['Bio', 'Halal', 'Kasher', 'Fairtrade', 'MSC', 'FSC', 'ISO 22000', 'IFS', 'BRC'];

const PHYS_FORM_LABEL: Record<string, string> = {
  liquid: 'Liquide', solid: 'Solide', powder: 'Poudre', gel: 'Gel',
  aerosol: 'Aérosol', cream: 'Crème', tablet: 'Comprimé', other: 'Autre',
};

interface EanGroup {
  ean: string;
  productName: string;
  categoryName: string;
  brandName: string | null;
  brandLogo: string | null;
  images: string[];
  temperature: string;
  shortDescription: string | null;
  physicalForm: string | null;
  netWeight: number | null;
  weightUnit: string | null;
  certifications: string[];
  allergens: string[];
  nutriScore: string | null;
  packSize: number;
  shelfLifeDays: number | null;
  originCountry: string | null;
  hsCode: string | null;
  packagingType: string | null;
}

export default function CatalogPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { activeOrg } = useAuth();
  const SORT_OPTIONS = activeOrg ? SORT_OPTIONS_AUTH : SORT_OPTIONS_GUEST;
  const { sponsoredProductIds, promoCodes } = useMarketingStorefront();
  const [sponsoredProducts, setSponsoredProducts] = useState<Product[]>([]);

  const [products, setProducts] = useState<Product[]>([]);
  const [roots, setRoots] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<Category[]>([]);
  const [catCounts, setCatCounts] = useState<Record<string, number>>({});
  const [countsLoaded, setCountsLoaded] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandSearch, setBrandSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const pageSize = 24;

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '');
  const [selectedCategoryId, setSelectedCategoryId] = useState(searchParams.get('category') ?? '');
  const [sortBy, setSortBy] = useState('created_at:desc');
  const [selectedTemps, setSelectedTemps] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedCerts, setSelectedCerts] = useState<string[]>([]);
  const [minRating, setMinRating] = useState(0);
  const [onPromoOnly, setOnPromoOnly] = useState(false);
  const [newOnly, setNewOnly] = useState(false);

  const [activeTab, setActiveTab] = useState<'catalogue' | 'references'>('catalogue');
  const [eanGroups, setEanGroups] = useState<EanGroup[]>([]);
  const [eanLoading, setEanLoading] = useState(false);
  const [eanLoaded, setEanLoaded] = useState(false);
  const [eanSearch, setEanSearch] = useState('');
  const [expandedEan, setExpandedEan] = useState<string | null>(null);
  const [eanQtys, setEanQtys]         = useState<Record<string, number>>({});
  const [optimizing, setOptimizing]   = useState(false);
  const [optResult, setOptResult]     = useState<LandedCostResult | null>(null);
  const [addingToCart, setAddingToCart] = useState(false);
  const { isOpen: isOptOpen, onOpen: onOptOpen, onClose: onOptClose } = useDisclosure();

  useEffect(() => {
    supabase
      .from('categories')
      .select('id, name, name_i18n, icon, image_url, description, parent_id, display_order, active')
      .eq('active', true)
      .order('display_order')
      .then(({ data }) => {
        const all = (data as Category[]) ?? [];
        const rootList = all.filter((c) => !c.parent_id);
        const subList = all.filter((c) => !!c.parent_id);
        setRoots(rootList);
        setSubCategories(subList);

        Promise.all(
          subList.map((sub) =>
            supabase
              .from('products')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'active')
              .eq('category_id', sub.id)
              .then(({ count }) => ({ id: sub.id, count: count ?? 0 }))
          )
        ).then((results) => {
          const map: Record<string, number> = {};
          results.forEach(({ id, count }) => { map[id] = count; });
          setCatCounts(map);
          setCountsLoaded(true);
        });
      });

    supabase.from('brands').select('*').order('name').then(({ data }) => setBrands((data as Brand[]) ?? []));
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('products')
      .select('*, organisations(name, id), price_tiers(*), brands(id, name, logo_url)', { count: 'exact' })
      .eq('status', 'active')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (searchQuery.trim()) {
      query = query.or(`name.ilike.%${searchQuery}%,short_description.ilike.%${searchQuery}%,ean.eq.${searchQuery}`);
    }
    if (selectedCategoryId) query = query.eq('category_id', selectedCategoryId);
    if (selectedTemps.length > 0) query = query.in('temperature', selectedTemps);
    if (selectedBrands.length > 0) query = query.in('brand_id', selectedBrands);
    if (selectedCerts.length > 0) query = query.overlaps('certifications', selectedCerts);
    if (onPromoOnly) query = query.eq('is_on_promotion', true);
    if (newOnly) query = query.eq('is_new', true);
    if (minRating > 0) query = query.gte('avg_rating', minRating);

    const [sortField, sortDir] = sortBy.split(':');
    if (sortField !== 'price') {
      query = query.order(sortField, { ascending: sortDir === 'asc' });
    }

    const { data, count } = await query;
    setProducts((data as Product[]) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [searchQuery, selectedCategoryId, sortBy, selectedTemps, selectedBrands, selectedCerts, minRating, onPromoOnly, newOnly, page]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  useEffect(() => {
    if (sponsoredProductIds.length === 0) return;
    supabase.from('products')
      .select('*, organisations(name), price_tiers(*)')
      .in('id', sponsoredProductIds.slice(0, 6))
      .eq('status', 'active')
      .then(({ data }) => setSponsoredProducts((data ?? []) as Product[]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sponsoredProductIds.length]);

  const loadEanData = useCallback(async () => {
    if (eanLoaded) return;
    setEanLoading(true);
    const { data } = await supabase
      .from('ean_references')
      .select(`id, ean, name, short_description, images, temperature, physical_form,
        net_weight, weight_unit, certifications, allergens, nutri_score, pack_size,
        shelf_life_days, origin_country, hs_code, packaging_type,
        categories:category_id(id, name), brands:brand_id(id, name, logo_url)`)
      .eq('status', 'active')
      .order('name');
    if (data) {
      setEanGroups((data as any[]).map(r => ({
        ean:              r.ean,
        productName:      r.name,
        categoryName:     r.categories?.name ?? '—',
        brandName:        r.brands?.name     ?? null,
        brandLogo:        r.brands?.logo_url ?? null,
        images:           r.images           ?? [],
        temperature:      r.temperature      ?? 'ambient',
        shortDescription: r.short_description ?? null,
        physicalForm:     r.physical_form     ?? null,
        netWeight:        r.net_weight        ?? null,
        weightUnit:       r.weight_unit       ?? null,
        certifications:   r.certifications    ?? [],
        allergens:        r.allergens         ?? [],
        nutriScore:       r.nutri_score       ?? null,
        packSize:         r.pack_size         ?? 1,
        shelfLifeDays:    r.shelf_life_days    ?? null,
        originCountry:    r.origin_country     ?? null,
        hsCode:           r.hs_code            ?? null,
        packagingType:    r.packaging_type     ?? null,
      })));
    }
    setEanLoaded(true);
    setEanLoading(false);
  }, [eanLoaded]);

  useEffect(() => {
    if (activeTab === 'references' && !eanLoaded) loadEanData();
  }, [activeTab, eanLoaded, loadEanData]);

  function clearFilters() {
    setSearchQuery('');
    setSelectedCategoryId('');
    setSortBy('created_at:desc');
    setSelectedTemps([]);
    setSelectedBrands([]);
    setSelectedCerts([]);
    setMinRating(0);
    setOnPromoOnly(false);
    setNewOnly(false);
    setPage(0);
    setSearchParams({});
  }

  const activeFiltersCount = [
    selectedCategoryId, ...selectedTemps, ...selectedBrands, ...selectedCerts,
    onPromoOnly ? 'promo' : '', newOnly ? 'new' : '', minRating > 0 ? 'rating' : '',
  ].filter(Boolean).length;

  const filteredEanGroups = useMemo(() => {
    if (!eanSearch.trim()) return eanGroups;
    const s = eanSearch.toLowerCase();
    return eanGroups.filter(g =>
      g.ean.toLowerCase().includes(s) || g.productName.toLowerCase().includes(s)
    );
  }, [eanGroups, eanSearch]);

  const selectedEanCount = useMemo(
    () => Object.values(eanQtys).filter(q => q > 0).length,
    [eanQtys],
  );

  async function handleOptimize() {
    const inputs: EanInput[] = Object.entries(eanQtys)
      .filter(([, qty]) => qty > 0)
      .map(([ean, quantity]) => ({ ean, quantity }));
    if (inputs.length === 0) return;
    setOptimizing(true);
    try {
      const base   = await optimizeCart(inputs);
      const result = await computeLandedCost(base);
      setOptResult(result);
      onOptOpen();
    } catch (e) {
      toast({ title: 'Erreur optimisation', description: (e as Error).message, status: 'error', duration: 4000 });
    } finally {
      setOptimizing(false);
    }
  }

  async function handleAddToCart(lines: OptimizedLine[]) {
    if (!activeOrg) { toast({ title: 'Connexion requise', status: 'warning', duration: 3000 }); return; }
    setAddingToCart(true);
    const { error } = await addOptimizedLinesToCart(lines, activeOrg.id);
    if (error) {
      toast({ title: 'Erreur', description: error, status: 'error', duration: 4000 });
    } else {
      toast({ title: 'Panier mis à jour', description: `${lines.length} article(s) ajouté(s) au meilleur prix.`, status: 'success', duration: 4000 });
      onOptClose();
      setEanQtys({});
    }
    setAddingToCart(false);
  }

  const allCats = [...roots, ...subCategories];
  const selectedCat = selectedCategoryId ? allCats.find((c) => c.id === selectedCategoryId) ?? null : null;
  const searchTerm = searchParams.get('q') ?? '';
  const filteredBrands = brands.filter((b) =>
    b.name.toLowerCase().includes(brandSearch.toLowerCase())
  );

  return (
    <Box>
      <CategoryBreadcrumb
        category={selectedCat}
        roots={roots}
        subCategories={subCategories}
        searchTerm={searchTerm || undefined}
      />

      <HStack spacing={0} mb={4} borderBottom="2px" borderColor="gray.200">
        <Button
          variant="ghost" px={5} py={3} borderRadius={0} mb="-2px"
          borderBottom="2px solid"
          borderBottomColor={activeTab === 'catalogue' ? '#1a3558' : 'transparent'}
          color={activeTab === 'catalogue' ? '#0d1f38' : 'gray.500'}
          fontWeight={activeTab === 'catalogue' ? 700 : 400}
          fontSize="sm"
          onClick={() => setActiveTab('catalogue')}
        >Catalogue</Button>
        <Button
          variant="ghost" px={5} py={3} borderRadius={0} mb="-2px"
          borderBottom="2px solid"
          borderBottomColor={activeTab === 'references' ? '#1a3558' : 'transparent'}
          color={activeTab === 'references' ? '#0d1f38' : 'gray.500'}
          fontWeight={activeTab === 'references' ? 700 : 400}
          fontSize="sm"
          onClick={() => setActiveTab('references')}
        >Références EAN</Button>
      </HStack>

      <Grid templateColumns={activeTab === 'catalogue' ? { base: '1fr', lg: '280px 1fr' } : '1fr'} gap={6}>
        {activeTab === 'catalogue' && (
        <GridItem display={{ base: 'none', lg: 'block' }}>
          <Box
            bg="white"
            rounded="md"
            border="1px"
            borderColor="gray.200"
            position="sticky"
            top="80px"
            overflow="hidden"
          >
            {/* En-tête panneau */}
            <Flex
              justify="space-between" align="center"
              px={4} py={3}
              borderBottom="1px" borderColor="gray.200"
              bg="gray.50"
            >
              <HStack spacing={2}>
                <SlidersHorizontal size={13} color="var(--chakra-colors-gray-500)" />
                <Text fontSize="11px" fontWeight="700" color="gray.600"
                  textTransform="uppercase" letterSpacing="0.07em">
                  Filtres
                </Text>
                {activeFiltersCount > 0 && (
                  <Box bg="blue.800" rounded="sm" px={1.5} py={0.5}>
                    <Text fontSize="9px" fontWeight="700" color="white">{activeFiltersCount}</Text>
                  </Box>
                )}
              </HStack>
              {activeFiltersCount > 0 && (
                <Button size="xs" variant="ghost" color="gray.500" onClick={clearFilters}
                  leftIcon={<X size={11} />} fontSize="xs" _hover={{ color: 'red.500' }}>
                  Effacer
                </Button>
              )}
            </Flex>

            <Box maxH="calc(100vh - 160px)" overflowY="auto"
              sx={{ '&::-webkit-scrollbar': { w: '3px' }, '&::-webkit-scrollbar-thumb': { bg: 'gray.200' } }}>

              {/* Disponibilité rapide */}
              <Box px={4} py={3} borderBottom="1px" borderColor="gray.100">
                <Text fontSize="10px" fontWeight="700" color="gray.400"
                  textTransform="uppercase" letterSpacing="0.08em" mb={2}>
                  Disponibilité
                </Text>
                <VStack align="start" spacing={1.5}>
                  <Checkbox
                    isChecked={onPromoOnly}
                    onChange={(e) => { setOnPromoOnly(e.target.checked); setPage(0); }}
                    size="sm" colorScheme="blue"
                  >
                    <Text fontSize="xs" color="gray.700">Offres négociées</Text>
                  </Checkbox>
                  <Checkbox
                    isChecked={newOnly}
                    onChange={(e) => { setNewOnly(e.target.checked); setPage(0); }}
                    size="sm" colorScheme="blue"
                  >
                    <Text fontSize="xs" color="gray.700">Nouvelles références</Text>
                  </Checkbox>
                </VStack>
              </Box>

              {/* Catégories */}
              {roots.length > 0 && (
                <Box px={4} py={3} borderBottom="1px" borderColor="gray.100">
                  <Text fontSize="10px" fontWeight="700" color="gray.400"
                    textTransform="uppercase" letterSpacing="0.08em" mb={2}>
                    {t('catalog.categories')}
                  </Text>
                  <VStack align="stretch" spacing={0}>
                    {roots.map((root) => {
                      const subs = subCategories.filter((s) => s.parent_id === root.id);
                      if (subs.length === 0) return null;
                      return (
                        <Box key={root.id}>
                          <Text fontSize="11px" fontWeight="600" color="gray.600"
                            py={1.5} letterSpacing="0.02em">
                            {getCategoryLabel(root)}
                          </Text>
                          {subs.map((sub) => {
                            const isSelected = selectedCategoryId === sub.id;
                            return (
                              <Flex
                                key={sub.id}
                                align="center" justify="space-between"
                                pl={3} pr={1} py={1}
                                cursor="pointer"
                                borderLeft="2px"
                                borderColor={isSelected ? 'blue.800' : 'transparent'}
                                bg={isSelected ? 'blue.50' : 'transparent'}
                                _hover={{ bg: 'gray.50', borderColor: isSelected ? 'blue.800' : 'gray.300' }}
                                transition="all 0.1s"
                                onClick={() => {
                                  setSelectedCategoryId(isSelected ? '' : sub.id);
                                  setPage(0);
                                }}
                              >
                                <Text fontSize="xs"
                                  color={isSelected ? 'blue.800' : 'gray.600'}
                                  fontWeight={isSelected ? '700' : '400'}>
                                  {getCategoryLabel(sub)}
                                </Text>
                                {countsLoaded ? (
                                  <Text fontSize="9px" color="gray.400" fontFamily="mono">
                                    {catCounts[sub.id] ?? 0}
                                  </Text>
                                ) : (
                                  <Spinner size="xs" color="gray.300" />
                                )}
                              </Flex>
                            );
                          })}
                        </Box>
                      );
                    })}
                  </VStack>
                </Box>
              )}

              {/* Conservation */}
              <Box px={4} py={3} borderBottom="1px" borderColor="gray.100">
                <Text fontSize="10px" fontWeight="700" color="gray.400"
                  textTransform="uppercase" letterSpacing="0.08em" mb={2}>
                  Conservation
                </Text>
                <CheckboxGroup
                  value={selectedTemps}
                  onChange={(vals) => setSelectedTemps(vals as string[])}
                >
                  <VStack align="start" spacing={1.5}>
                    {TEMPERATURES.map((t) => (
                      <Checkbox key={t} value={t} size="sm" colorScheme="blue">
                        <Text fontSize="xs" color="gray.700">{TEMP_LABELS[t]}</Text>
                      </Checkbox>
                    ))}
                  </VStack>
                </CheckboxGroup>
              </Box>

              {/* Marques */}
              {brands.length > 0 && (
                <Box px={4} py={3} borderBottom="1px" borderColor="gray.100">
                  <Text fontSize="10px" fontWeight="700" color="gray.400"
                    textTransform="uppercase" letterSpacing="0.08em" mb={2}>
                    Marque
                  </Text>
                  <InputGroup size="xs" mb={2}>
                    <InputLeftElement pointerEvents="none">
                      <Search size={10} color="gray" />
                    </InputLeftElement>
                    <Input
                      value={brandSearch}
                      onChange={(e) => setBrandSearch(e.target.value)}
                      placeholder="Filtrer les marques..."
                      rounded="sm"
                      fontSize="xs"
                      borderColor="gray.200"
                      _focus={{ borderColor: 'blue.500' }}
                    />
                  </InputGroup>
                  <CheckboxGroup
                    value={selectedBrands}
                    onChange={(vals) => { setSelectedBrands(vals as string[]); setPage(0); }}
                  >
                    <VStack align="start" spacing={1.5} maxH="160px" overflowY="auto"
                      sx={{ '&::-webkit-scrollbar': { w: '2px' }, '&::-webkit-scrollbar-thumb': { bg: 'gray.200' } }}>
                      {filteredBrands.map((b) => (
                        <Checkbox key={b.id} value={b.id} size="sm" colorScheme="blue">
                          <HStack spacing={1.5} ml={1}>
                            {b.logo_url ? (
                              <Box w={4} h={4} rounded="sm" overflow="hidden" bg="gray.50"
                                border="1px" borderColor="gray.100" flexShrink={0}>
                                <Image src={b.logo_url} alt={b.name} w="full" h="full" objectFit="contain" />
                              </Box>
                            ) : null}
                            <Text fontSize="xs" color="gray.700">{b.name}</Text>
                          </HStack>
                        </Checkbox>
                      ))}
                    </VStack>
                  </CheckboxGroup>
                </Box>
              )}

              {/* Certifications */}
              <Box px={4} py={3} borderBottom="1px" borderColor="gray.100">
                <Text fontSize="10px" fontWeight="700" color="gray.400"
                  textTransform="uppercase" letterSpacing="0.08em" mb={2}>
                  Certifications
                </Text>
                <CheckboxGroup
                  value={selectedCerts}
                  onChange={(vals) => { setSelectedCerts(vals as string[]); setPage(0); }}
                >
                  <Flex flexWrap="wrap" gap={1.5}>
                    {CERT_OPTIONS.map((c) => {
                      const active = selectedCerts.includes(c);
                      return (
                        <Box
                          key={c}
                          as="label"
                          cursor="pointer"
                          px={2} py={1}
                          rounded="sm"
                          border="1px"
                          borderColor={active ? 'blue.800' : 'gray.200'}
                          bg={active ? 'blue.800' : 'white'}
                          _hover={{ borderColor: 'blue.400' }}
                          transition="all 0.1s"
                        >
                          <Checkbox value={c} size="sm" colorScheme="blue" display="none" />
                          <Text fontSize="10px" fontWeight="600"
                            color={active ? 'white' : 'gray.600'} letterSpacing="0.02em">
                            {c}
                          </Text>
                        </Box>
                      );
                    })}
                  </Flex>
                </CheckboxGroup>
              </Box>

              {/* Note minimale */}
              <Box px={4} py={3}>
                <Text fontSize="10px" fontWeight="700" color="gray.400"
                  textTransform="uppercase" letterSpacing="0.08em" mb={2}>
                  Note minimale
                </Text>
                <VStack align="stretch" spacing={0}>
                  {[0, 3, 4, 4.5].map((r) => (
                    <Flex
                      key={r}
                      align="center" gap={2}
                      cursor="pointer"
                      onClick={() => { setMinRating(r); setPage(0); }}
                      py={1.5} px={2}
                      borderLeft="2px"
                      borderColor={minRating === r ? 'blue.800' : 'transparent'}
                      bg={minRating === r ? 'blue.50' : 'transparent'}
                      _hover={{ bg: 'gray.50' }}
                      transition="all 0.1s"
                    >
                      <HStack spacing={0.5}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={11}
                            fill={i < Math.ceil(r) ? '#D97706' : 'none'}
                            color="#D97706" />
                        ))}
                      </HStack>
                      <Text fontSize="xs"
                        color={minRating === r ? 'blue.800' : 'gray.500'}
                        fontWeight={minRating === r ? '700' : '400'}>
                        {r === 0 ? 'Toutes' : `${r}+`}
                      </Text>
                    </Flex>
                  ))}
                </VStack>
              </Box>

            </Box>
          </Box>
        </GridItem>
        )}

        {/* Main area */}
        <GridItem>
          {activeTab === 'catalogue' ? (<>
          <Box bg="white" rounded="md" p={4} mb={4} border="1px" borderColor="gray.200">
            <Flex gap={3} flexWrap="wrap">
              <InputGroup flex={1} minW="200px">
                <InputLeftElement pointerEvents="none">
                  <Search size={16} color="gray" />
                </InputLeftElement>
                <Input
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                  placeholder="Nom, EAN, description..."
                  rounded="sm"
                  fontSize="sm"
                />
              </InputGroup>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                rounded="sm"
                fontSize="sm"
                maxW="200px"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </Flex>
          </Box>

          <Flex justify="space-between" align="center" mb={4}>
            <Text fontSize="sm" color="gray.500">
              {loading ? '...' : `${total} produit${total !== 1 ? 's' : ''} trouvé${total !== 1 ? 's' : ''}`}
              {selectedCat && (
                <Text as="span" fontWeight="semibold" color="gray.700"> dans {getCategoryLabel(selectedCat)}</Text>
              )}
            </Text>
            {activeFiltersCount > 0 && (
              <Button size="xs" variant="ghost" colorScheme="red" onClick={clearFilters} leftIcon={<X size={12} />}>
                Effacer les filtres
              </Button>
            )}
          </Flex>

          {/* ── Bandeau codes promo actifs ── */}
          {promoCodes.length > 0 && (
            <Flex align="center" gap={3} py={2} px={3} mb={2} rounded="lg"
              style={{ background: '#fef9ee', border: '1px solid #f5d78e' }}
              overflowX="auto" sx={{ '&::-webkit-scrollbar': { display: 'none' } }}>
              <Badge colorScheme="orange" fontSize="9px" fontWeight="800" flexShrink={0}>PROMO</Badge>
              <HStack spacing={2}>
                {promoCodes.map(p => {
                  const code = (p.metadata as Record<string, unknown>)?.code as string ?? p.name.toUpperCase().replace(/\s/g, '');
                  return (
                    <Button key={p.id} size="xs" variant="outline" colorScheme="orange" fontFamily="mono" fontWeight="900"
                      onClick={() => { navigator.clipboard.writeText(code).catch(() => {}); }}>
                      {code}{(p.metadata as Record<string, unknown>)?.discount_pct ? ` −${(p.metadata as Record<string, unknown>).discount_pct}%` : ''}
                    </Button>
                  );
                })}
              </HStack>
              <Text fontSize="10px" color="gray.400" flexShrink={0}>Cliquez pour copier</Text>
            </Flex>
          )}

          <SearchSponsoredBlock products={sponsoredProducts} />

          <SimpleGrid columns={{ base: 2, md: 3, xl: 4 }} spacing={4}>
            {loading
              ? Array.from({ length: pageSize }).map((_, i) => (
                  <Box key={i} rounded="md" overflow="hidden" border="1px" borderColor="gray.200" bg="white">
                    <Skeleton h="160px" />
                    <Box p={3}><Skeleton noOfLines={3} h="12px" spacing={2} /></Box>
                  </Box>
                ))
              : products.map((p) => (
                  <Box key={p.id} position="relative">
                    {sponsoredProductIds.includes(p.id) && (
                      <Badge position="absolute" top={2} right={2} zIndex={2}
                        colorScheme="yellow" fontSize="8px" fontWeight="900" letterSpacing="0.5px"
                        textTransform="uppercase" px={1.5} py={0.5}>
                        Sponsorisé
                      </Badge>
                    )}
                    <CatalogProductCard product={p} />
                  </Box>
                ))}
          </SimpleGrid>

          {!loading && products.length === 0 && (
            <Box textAlign="center" py={20} color="gray.400">
              <Flex w={16} h={16} bg="gray.100" rounded="md" align="center" justify="center" mx="auto" mb={4}>
                <Search size={28} color="var(--chakra-colors-gray-400)" />
              </Flex>
              <Text fontWeight="semibold" fontSize="lg" color="gray.600">Aucun produit trouvé</Text>
              <Text fontSize="sm" mt={1}>Essayez d'autres critères de recherche.</Text>
              <Button mt={4} variant="outline" colorScheme="blue" onClick={clearFilters}>
                Réinitialiser les filtres
              </Button>
            </Box>
          )}

          {total > pageSize && (
            <Flex justify="center" gap={2} mt={8}>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => p - 1)}
                isDisabled={page === 0}
              >
                Précédent
              </Button>
              <Text alignSelf="center" fontSize="sm" color="gray.500">
                Page {page + 1} / {Math.ceil(total / pageSize)}
              </Text>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => p + 1)}
                isDisabled={(page + 1) * pageSize >= total}
              >
                Suivant
              </Button>
            </Flex>
          )}
          </>) : (<>
          {/* ── Onglet Références EAN ── */}
          <Box bg="white" rounded="md" p={4} mb={4} border="1px" borderColor="gray.200">
            <Flex justify="space-between" align="center" mb={3}>
              <Text fontSize="sm" fontWeight="700" color="gray.700">
                {filteredEanGroups.length} référence{filteredEanGroups.length !== 1 ? 's' : ''}
              </Text>
            </Flex>
            <InputGroup>
              <InputLeftElement pointerEvents="none">
                <Search size={16} color="gray" />
              </InputLeftElement>
              <Input
                value={eanSearch}
                onChange={(e) => setEanSearch(e.target.value)}
                placeholder="Rechercher par EAN ou nom de produit..."
                rounded="sm"
                fontSize="sm"
              />
            </InputGroup>
          </Box>

          {eanLoading ? (
            <Flex justify="center" py={16}><Spinner size="lg" color="blue.700" /></Flex>
          ) : filteredEanGroups.length === 0 ? (
            <Box py={16} textAlign="center" color="gray.400">
              <Flex w={16} h={16} bg="gray.100" rounded="xl" align="center" justify="center" mx="auto" mb={3}>
                <Package size={28} color="#cbd5e1" />
              </Flex>
              <Text fontSize="sm">{t('catalog.noProductsEAN')}</Text>
            </Box>
          ) : (
            <VStack spacing={3} align="stretch">
              {filteredEanGroups.map((g) => {
                const tempMeta = TEMP_BADGE[g.temperature] ?? TEMP_BADGE.ambient;
                const isExpanded = expandedEan === g.ean;
                return (
                  <Box
                    key={g.ean}
                    bg="white"
                    rounded="xl"
                    border="1.5px solid"
                    borderColor={isExpanded || (eanQtys[g.ean] ?? 0) > 0 ? 'blue.300' : 'gray.200'}
                    overflow="hidden"
                    transition="all 0.15s"
                    _hover={{ borderColor: 'blue.200', shadow: 'sm' }}
                  >
                    {/* Main row: image + info */}
                    <Flex>
                      {/* Image */}
                      <Box
                        w="120px"
                        minH="120px"
                        flexShrink={0}
                        style={{ background: '#f1f5f9' }}
                        position="relative"
                        overflow="hidden"
                      >
                        {g.images[0] ? (
                          <Image
                            src={g.images[0]}
                            alt={g.productName}
                            w="full" h="120px"
                            objectFit="cover"
                            loading="lazy"
                          />
                        ) : (
                          <Flex w="full" h="120px" align="center" justify="center">
                            <Package size={30} color="#cbd5e1" />
                          </Flex>
                        )}
                        {/* EAN overlay */}
                        <Box
                          position="absolute" bottom={0} left={0} right={0}
                          px={1.5} py={0.5}
                          style={{ background: 'rgba(0,0,0,0.6)' }}
                        >
                          <Text fontSize="9px" fontFamily="mono" color="white" noOfLines={1} letterSpacing="0.02em">
                            {g.ean}
                          </Text>
                        </Box>
                      </Box>

                      {/* Content */}
                      <Box flex={1} px={4} py={3}>
                        <Flex justify="space-between" align="flex-start" mb={1}>
                          <Box flex={1} mr={3}>
                            <Text fontWeight="700" fontSize="sm" color="gray.900" noOfLines={2} lineHeight="short" mb={1}>
                              {g.productName}
                            </Text>
                            <HStack spacing={2} mb={2}>
                              {g.brandName && (
                                <HStack spacing={1}>
                                  {g.brandLogo && (
                                    <Image src={g.brandLogo} h="14px" objectFit="contain" />
                                  )}
                                  <Text fontSize="11px" color="gray.600" fontWeight="600">{g.brandName}</Text>
                                </HStack>
                              )}
                              {g.brandName && <Text fontSize="11px" color="gray.300">|</Text>}
                              <Text fontSize="11px" color="gray.400">{g.categoryName}</Text>
                            </HStack>
                          </Box>
                          <HStack spacing={1} flexShrink={0} flexWrap="wrap" justify="flex-end" maxW="160px">
                            <Box px={2} py={0.5} rounded="full" style={{ background: tempMeta.bg }}>
                              <Text fontSize="9px" fontWeight="700" style={{ color: tempMeta.color }} letterSpacing="0.04em">
                                {tempMeta.label.toUpperCase()}
                              </Text>
                            </Box>
                            {g.physicalForm && (
                              <Box px={2} py={0.5} rounded="full" bg="gray.100">
                                <Text fontSize="9px" fontWeight="600" color="gray.600">
                                  {PHYS_FORM_LABEL[g.physicalForm] ?? g.physicalForm}
                                </Text>
                              </Box>
                            )}
                            {g.netWeight != null && (
                              <Box px={2} py={0.5} rounded="full" bg="gray.100">
                                <Text fontSize="9px" fontWeight="600" color="gray.600">
                                  {g.netWeight}{g.weightUnit ?? 'g'}
                                </Text>
                              </Box>
                            )}
                          </HStack>
                        </Flex>

                        {g.shortDescription && (
                          <Text fontSize="xs" color="gray.500" noOfLines={2} mb={2}>
                            {g.shortDescription}
                          </Text>
                        )}

                        <Flex align="center" justify="space-between" flexWrap="wrap" gap={2}>
                          <HStack spacing={1} flexWrap="wrap">
                            {g.nutriScore && (
                              <Badge
                                fontSize="9px" px={1.5} fontWeight="800"
                                colorScheme={
                                  g.nutriScore === 'A' ? 'green' :
                                  g.nutriScore === 'B' ? 'teal' :
                                  g.nutriScore === 'C' ? 'yellow' :
                                  g.nutriScore === 'D' ? 'orange' : 'red'
                                }
                              >
                                Nutri-Score {g.nutriScore}
                              </Badge>
                            )}
                            {g.certifications.slice(0, 4).map((c) => (
                              <Badge key={c} colorScheme="green" fontSize="9px" px={1.5} variant="subtle">{c}</Badge>
                            ))}
                            {g.certifications.length > 4 && (
                              <Badge colorScheme="gray" fontSize="9px" px={1.5} variant="subtle">
                                +{g.certifications.length - 4}
                              </Badge>
                            )}
                          </HStack>
                          <Button
                            size="xs" variant="ghost" colorScheme="blue" fontSize="11px"
                            onClick={() => setExpandedEan(isExpanded ? null : g.ean)}
                          >
                            {isExpanded ? '▲ Masquer' : '▼ Détails techniques'}
                          </Button>
                        </Flex>
                      </Box>
                    </Flex>

                    {/* ── Ligne quantité + ajout sélection ── */}
                    <Flex
                      borderTop="1px" borderColor="gray.100"
                      px={4} py={2} align="center" justify="space-between"
                      bg={(eanQtys[g.ean] ?? 0) > 0 ? 'blue.50' : 'gray.50'}
                      transition="background 0.15s"
                    >
                      <HStack spacing={1}>
                        <Button
                          size="xs" variant="outline" colorScheme="gray" w="24px" h="24px" minW="24px" p={0}
                          onClick={() => setEanQtys(q => ({ ...q, [g.ean]: Math.max(0, (q[g.ean] ?? 0) - 1) }))}
                        >−</Button>
                        <Input
                          size="xs" w="52px" textAlign="center" rounded="sm"
                          value={eanQtys[g.ean] ?? 0}
                          onChange={e => {
                            const v = parseInt(e.target.value) || 0;
                            setEanQtys(q => ({ ...q, [g.ean]: Math.max(0, v) }));
                          }}
                        />
                        <Button
                          size="xs" variant="outline" colorScheme="blue" w="24px" h="24px" minW="24px" p={0}
                          onClick={() => setEanQtys(q => ({ ...q, [g.ean]: (q[g.ean] ?? 0) + 1 }))}
                        >+</Button>
                      </HStack>
                      <Text
                        fontSize="11px" fontWeight="600"
                        color={(eanQtys[g.ean] ?? 0) > 0 ? 'blue.600' : 'gray.400'}
                      >
                        {(eanQtys[g.ean] ?? 0) > 0 ? `✓ Sélectionné · qté ${eanQtys[g.ean]}` : 'Quantité souhaitée'}
                      </Text>
                    </Flex>

                    {/* Expanded technical details */}
                    {isExpanded && (
                      <Box px={4} py={4} borderTop="1px" borderColor="blue.100" bg="blue.50">
                        <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} spacing={4}>
                          {g.netWeight != null && (
                            <Box>
                              <Text fontSize="10px" fontWeight="700" color="blue.600" textTransform="uppercase" letterSpacing="0.05em" mb={0.5}>Poids net</Text>
                              <Text fontSize="sm" color="gray.800">{g.netWeight} {g.weightUnit ?? 'g'}</Text>
                            </Box>
                          )}
                          {g.packSize > 1 && (
                            <Box>
                              <Text fontSize="10px" fontWeight="700" color="blue.600" textTransform="uppercase" letterSpacing="0.05em" mb={0.5}>Colisage</Text>
                              <Text fontSize="sm" color="gray.800">{g.packSize} unités</Text>
                            </Box>
                          )}
                          {g.shelfLifeDays && (
                            <Box>
                              <Text fontSize="10px" fontWeight="700" color="blue.600" textTransform="uppercase" letterSpacing="0.05em" mb={0.5}>Durée de vie</Text>
                              <Text fontSize="sm" color="gray.800">{g.shelfLifeDays} jours</Text>
                            </Box>
                          )}
                          {g.packagingType && (
                            <Box>
                              <Text fontSize="10px" fontWeight="700" color="blue.600" textTransform="uppercase" letterSpacing="0.05em" mb={0.5}>Conditionnement</Text>
                              <Text fontSize="sm" color="gray.800">{g.packagingType}</Text>
                            </Box>
                          )}
                          {g.originCountry && (
                            <Box>
                              <Text fontSize="10px" fontWeight="700" color="blue.600" textTransform="uppercase" letterSpacing="0.05em" mb={0.5}>Pays d'origine</Text>
                              <Text fontSize="sm" color="gray.800">{g.originCountry}</Text>
                            </Box>
                          )}
                          {g.hsCode && (
                            <Box>
                              <Text fontSize="10px" fontWeight="700" color="blue.600" textTransform="uppercase" letterSpacing="0.05em" mb={0.5}>Code SH / HS</Text>
                              <Text fontSize="sm" fontFamily="mono" color="gray.800">{g.hsCode}</Text>
                            </Box>
                          )}
                          {g.physicalForm && (
                            <Box>
                              <Text fontSize="10px" fontWeight="700" color="blue.600" textTransform="uppercase" letterSpacing="0.05em" mb={0.5}>Forme physique</Text>
                              <Text fontSize="sm" color="gray.800">{PHYS_FORM_LABEL[g.physicalForm] ?? g.physicalForm}</Text>
                            </Box>
                          )}
                          {g.allergens.length > 0 && (
                            <Box gridColumn={{ base: 'span 2', lg: 'span 2' }}>
                              <Text fontSize="10px" fontWeight="700" color="orange.600" textTransform="uppercase" letterSpacing="0.05em" mb={0.5}>Allergènes</Text>
                              <Text fontSize="sm" color="orange.700">{g.allergens.join(', ')}</Text>
                            </Box>
                          )}
                        </SimpleGrid>
                      </Box>
                    )}
                  </Box>
                );
              })}
            </VStack>
          )}

          {/* ── Barre sticky optimisation ── */}
          {selectedEanCount > 0 && (
            <Box
              position="sticky" bottom={4} zIndex={20}
              mx={-4}
              style={{ background: '#0d1f38', borderRadius: '14px' }}
              px={5} py={3} shadow="2xl"
            >
              <Flex justify="space-between" align="center">
                <HStack spacing={3}>
                  <Box style={{ background: '#c97d1a' }} rounded="md" px={2} py={0.5}>
                    <Text fontSize="xs" fontWeight="800" color="white">{selectedEanCount}</Text>
                  </Box>
                  <Text color="white" fontWeight="600" fontSize="sm">
                    article{selectedEanCount > 1 ? 's' : ''} sélectionné{selectedEanCount > 1 ? 's' : ''} · optimiser les prix vendeurs
                  </Text>
                </HStack>
                <HStack spacing={2}>
                  <Button
                    size="sm" variant="ghost" color="gray.400"
                    _hover={{ color: 'white', bg: 'whiteAlpha.100' }}
                    onClick={() => setEanQtys({})}
                  >Effacer</Button>
                  <Button
                    size="sm"
                    style={{ background: '#c97d1a', color: 'white' }}
                    _hover={{ opacity: 0.9 }}
                    isLoading={optimizing}
                    loadingText="Analyse en cours…"
                    leftIcon={<ShoppingCart size={15} />}
                    onClick={handleOptimize}
                  >
                    Optimiser le panier
                  </Button>
                </HStack>
              </Flex>
            </Box>
          )}
          </>)}

      {/* ── Modal résultat optimisation ── */}
      <Modal isOpen={isOptOpen} onClose={onOptClose} size="xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent maxW="840px">
          <ModalHeader pb={1}>
            <Text fontSize="lg" fontWeight="800">Panier optimisé</Text>
            <Text fontSize="sm" fontWeight="400" color="gray.500">
              Meilleurs prix + frais de livraison inclus · {optResult?.lines.length ?? 0} article(s)
            </Text>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={5} align="stretch">

              {/* ── Stats summary ── */}
              <SimpleGrid columns={3} spacing={3}>
                <Box bg="green.50" rounded="xl" p={4} textAlign="center">
                  <Text fontSize="10px" color="green.600" fontWeight="700" textTransform="uppercase" letterSpacing="0.06em" mb={1}>{t('catalog.totalProducts')}</Text>
                  <Text fontSize="xl" fontWeight="800" color="green.700">{(optResult?.totalProductCost ?? 0).toFixed(2)} MAD</Text>
                </Box>
                <Box bg="blue.50" rounded="xl" p={4} textAlign="center">
                  <Text fontSize="10px" color="blue.600" fontWeight="700" textTransform="uppercase" letterSpacing="0.06em" mb={1}>Livraison</Text>
                  <Text fontSize="xl" fontWeight="800" color="blue.700">{(optResult?.totalDeliveryCost ?? 0).toFixed(2)} MAD</Text>
                </Box>
                <Box rounded="xl" p={4} textAlign="center" style={{ background: '#0d1f38' }}>
                  <Text fontSize="10px" color="gray.300" fontWeight="700" textTransform="uppercase" letterSpacing="0.06em" mb={1}>Total livré</Text>
                  <Text fontSize="xl" fontWeight="800" color="white">{(optResult?.totalLandedCost ?? 0).toFixed(2)} MAD</Text>
                </Box>
              </SimpleGrid>

              {/* ── EANs non trouvés ── */}
              {(optResult?.notFound.length ?? 0) > 0 && (
                <Box p={3} bg="orange.50" border="1px" borderColor="orange.200" rounded="lg">
                  <Text fontSize="sm" color="orange.700" fontWeight="600">
                    {optResult!.notFound.length} EAN(s) sans offre active : {optResult!.notFound.join(', ')}
                  </Text>
                </Box>
              )}

              {/* ── Détail par ligne ── */}
              {(optResult?.lines.length ?? 0) > 0 && (
                <Box>
                  <Text fontSize="11px" fontWeight="700" color="gray.500" textTransform="uppercase" letterSpacing="0.06em" mb={2}>
                    Détail par article
                  </Text>
                  <Box border="1px" borderColor="gray.200" rounded="lg" overflow="hidden">
                    <Grid
                      templateColumns="140px 1fr 50px 1fr 80px 100px"
                      bg="gray.50" px={3} py={2} gap={2} alignItems="center"
                    >
                      {['EAN','Produit','Qté','Meilleur vendeur','PU','Total'].map(h => (
                        <Text key={h} fontSize="10px" fontWeight="700" color="gray.500" textTransform="uppercase" letterSpacing="0.05em">{h}</Text>
                      ))}
                    </Grid>
                    {optResult!.lines.map(line => (
                      <Grid
                        key={line.ean}
                        templateColumns="140px 1fr 50px 1fr 80px 100px"
                        px={3} py={2.5} gap={2} alignItems="center"
                        borderTop="1px" borderColor="gray.100"
                        _hover={{ bg: 'gray.50' }}
                      >
                        <Text fontSize="xs" fontFamily="mono" color="blue.700" fontWeight="600">{line.ean}</Text>
                        <Text fontSize="xs" noOfLines={1} fontWeight="500">{line.selected.productName}</Text>
                        <Text fontSize="xs" textAlign="center" fontWeight="700">{line.quantity}</Text>
                        <Text fontSize="xs" color="gray.600">{line.selected.sellerName}</Text>
                        <Text fontSize="xs" fontWeight="600">{line.selected.unitPrice.toFixed(2)}</Text>
                        <Text fontSize="xs" fontWeight="800" color="gray.900">{line.selected.lineTotal.toFixed(2)} MAD</Text>
                      </Grid>
                    ))}
                  </Box>
                </Box>
              )}

              {/* ── Répartition par vendeur ── */}
              {(optResult?.deliveryBundles.length ?? 0) > 0 && (
                <Box>
                  <Text fontSize="11px" fontWeight="700" color="gray.500" textTransform="uppercase" letterSpacing="0.06em" mb={2}>
                    Répartition par vendeur
                  </Text>
                  <VStack spacing={2} align="stretch">
                    {optResult!.deliveryBundles.map(bundle => (
                      <Box key={bundle.sellerId} border="1px" borderColor="gray.200" rounded="lg" p={4}>
                        <Flex justify="space-between" align="center">
                          <Box>
                            <Text fontSize="sm" fontWeight="700" color="gray.800">{bundle.sellerName}</Text>
                            <Text fontSize="xs" color="gray.500">{bundle.lines.length} article(s) · {bundle.subtotal.toFixed(2)} MAD</Text>
                          </Box>
                          <VStack spacing={0.5} align="flex-end">
                            <HStack spacing={3}>
                              <Badge colorScheme={bundle.isFreeDelivery ? 'green' : 'orange'} fontSize="10px">
                                {bundle.isFreeDelivery ? 'Livraison gratuite' : `+${bundle.deliveryCost.toFixed(2)} MAD livraison`}
                              </Badge>
                            </HStack>
                            <Text fontSize="md" fontWeight="800" color="gray.900">{bundle.landedTotal.toFixed(2)} MAD</Text>
                            {bundle.remainingToFreeDelivery != null && bundle.remainingToFreeDelivery > 0 && (
                              <Text fontSize="10px" color="orange.500" fontWeight="600">
                                + {bundle.remainingToFreeDelivery.toFixed(0)} MAD → livraison gratuite
                              </Text>
                            )}
                          </VStack>
                        </Flex>
                      </Box>
                    ))}
                  </VStack>
                </Box>
              )}

              {/* ── Suggestions consolidation ── */}
              {(optResult?.consolidationOptions.length ?? 0) > 0 && (
                <Box>
                  <Text fontSize="11px" fontWeight="700" color="gray.500" textTransform="uppercase" letterSpacing="0.06em" mb={2}>
                    Suggestions d'optimisation livraison
                  </Text>
                  <VStack spacing={2} align="stretch">
                    {optResult!.consolidationOptions.map((opt, i) => (
                      <Box key={i} rounded="lg" p={4} border="1px"
                        borderColor={opt.netSaving > 0 ? 'green.200' : 'gray.200'}
                        bg={opt.netSaving > 0 ? 'green.50' : 'gray.50'}
                      >
                        <Text fontSize="sm" fontWeight="600" color="gray.800" mb={2}>
                          Déplacer <b>{opt.eansToMove.length} article{opt.eansToMove.length > 1 ? 's' : ''}</b> de <b>{opt.dropVendorName}</b> → <b>{opt.absorbVendorName}</b>
                        </Text>
                        <HStack spacing={4} flexWrap="wrap">
                          <Text fontSize="xs" color="orange.600">{t('catalog.productCostIncrease', { amount: opt.productCostIncrease.toFixed(2) })}</Text>
                          <Text fontSize="xs" color="green.600">Économie livraison : −{opt.deliverySaving.toFixed(2)} MAD</Text>
                          <Text fontSize="xs" fontWeight="800" color={opt.netSaving > 0 ? 'green.700' : 'red.600'}>
                            Net : {opt.netSaving > 0 ? '−' : '+'}{Math.abs(opt.netSaving).toFixed(2)} MAD
                          </Text>
                        </HStack>
                      </Box>
                    ))}
                  </VStack>
                </Box>
              )}

            </VStack>
          </ModalBody>
          <ModalFooter borderTop="1px" borderColor="gray.100">
            <HStack spacing={3}>
              <Button variant="ghost" onClick={onOptClose}>Fermer</Button>
              <Button
                colorScheme="blue"
                leftIcon={<ShoppingCart size={16} />}
                isLoading={addingToCart}
                loadingText="Ajout en cours…"
                isDisabled={!optResult || optResult.lines.length === 0}
                onClick={() => optResult && handleAddToCart(optResult.lines)}
              >
                Ajouter au panier · {(optResult?.totalLandedCost ?? 0).toFixed(2)} MAD
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
        </GridItem>
      </Grid>
    </Box>
  );
}

// ── Tokens couleur alignés sur le reste de l'app ──────────────────────────────
const C = {
  navy:   '#0d1f38',
  navyMid:'#1a3558',
  amber:  '#c97d1a',
  border: '#e2e8f0',
  bgAlt:  '#f8fafc',
  muted:  '#64748b',
};

const TEMP_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  ambient:      { bg: '#fefce8', color: '#92400e', label: 'Ambiant' },
  refrigerated: { bg: '#ecfeff', color: '#155e75', label: 'Réfrigéré' },
  fresh:        { bg: '#f0fdf4', color: '#14532d', label: 'Frais' },
  frozen:       { bg: '#eff6ff', color: '#1e3a8a', label: 'Surgelé' },
};

function CatalogProductCard({ product }: { product: Product }) {
  const navigate = useNavigate();
  const { activeOrg } = useAuth();
  const { addItem, removeItem, hasItem } = useComparator();
  const toast = useToast();

  const tiers = product.price_tiers?.sort((a, b) => a.qty_min - b.qty_min) ?? [];
  const firstTier = tiers[0];
  const lastTier = tiers[tiers.length - 1];
  const hasRange = tiers.length > 1 && firstTier && lastTier
    && firstTier.unit_price !== lastTier.unit_price;

  const inComparator = hasItem(product.id);
  const tempBadge = TEMP_BADGE[product.temperature];
  const [addingToCart, setAddingToCart] = useState(false);

  function toggleCompare(e: React.MouseEvent) {
    e.stopPropagation();
    if (inComparator) {
      removeItem(product.id);
    } else {
      addItem(product);
      toast({ title: 'Ajouté au comparateur', status: 'info', duration: 2000, isClosable: true, position: 'bottom-right' });
    }
  }

  async function handleAddToCart(e: React.MouseEvent) {
    e.stopPropagation();
    if (!activeOrg || !firstTier || addingToCart) return;
    setAddingToCart(true);
    const { error } = await addToCartShared({
      buyerOrgId: activeOrg.id,
      productId: product.id,
      quantity: product.moq,
      unitPrice: firstTier.unit_price,
    });
    if (error) {
      toast({ title: 'Erreur', description: error, status: 'error', duration: 4000, isClosable: true, position: 'bottom-right' });
    } else {
      toast({ title: 'Ajouté au panier', description: product.name, status: 'success', duration: 2500, isClosable: true, position: 'bottom-right' });
    }
    setAddingToCart(false);
  }

  return (
    <Box
      bg="white"
      rounded="2xl"
      overflow="hidden"
      style={{
        border: `1.5px solid ${inComparator ? C.amber : C.border}`,
        boxShadow: inComparator ? `0 0 0 3px ${C.amber}22` : 'none',
      }}
      _hover={{ shadow: 'lg', transform: 'translateY(-3px)' }}
      transition="all 0.2s"
      cursor="pointer"
      onClick={() => navigate(`/product/${product.id}`)}
      position="relative" role="group"
    >
      {/* Badges promo / nouveau */}
      {product.is_on_promotion && (
        <Box position="absolute" top={3} left={3} zIndex={2}>
          <Box px={2} py={0.5} rounded="full"
            style={{ background: '#dc2626' }}>
            <Text fontSize="9px" fontWeight="800" color="white" letterSpacing="0.04em">PROMO</Text>
          </Box>
        </Box>
      )}
      {product.is_new && !product.is_on_promotion && (
        <Box position="absolute" top={3} left={3} zIndex={2}>
          <Box px={2} py={0.5} rounded="full"
            style={{ background: '#16a34a' }}>
            <Text fontSize="9px" fontWeight="800" color="white" letterSpacing="0.04em">NOUVEAU</Text>
          </Box>
        </Box>
      )}

      {/* Image */}
      <Box h="185px" position="relative" overflow="hidden"
        style={{ background: '#f1f5f9' }}>
        {product.images?.[0] ? (
          <Image
            src={product.images[0]} alt={product.name}
            w="full" h="full" objectFit="cover" loading="lazy"
            transition="transform 0.35s ease"
            _groupHover={{ transform: 'scale(1.04)' }}
          />
        ) : (
          <Flex w="full" h="full" align="center" justify="center">
            <Package size={36} color="#cbd5e1" />
          </Flex>
        )}

        {/* Overlay gradient bas */}
        <Box
          position="absolute" bottom={0} left={0} right={0} h="56px"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.28), transparent)' }}
        />

        {/* Badges image bas */}
        <Flex position="absolute" bottom={2.5} left={2.5} right={2.5}
          align="center" justify="space-between">
          <HStack spacing={1.5}>
            {activeOrg && product.moq > 1 && (
              <Box px={2} py={0.5} rounded="md"
                style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}>
                <Text fontSize="9px" fontWeight="700" color="white">MOQ {product.moq}</Text>
              </Box>
            )}
            {product.temperature !== 'ambient' && tempBadge && (
              <Box px={2} py={0.5} rounded="md"
                style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
                <Text fontSize="9px" fontWeight="600" color="white">{tempBadge.label}</Text>
              </Box>
            )}
          </HStack>

          {/* Bouton comparateur */}
          <Tooltip label={inComparator ? 'Retirer du comparateur' : 'Ajouter au comparateur'} placement="top">
            <Box
              as="button"
              w={7} h={7} rounded="lg"
              display="flex" alignItems="center" justifyContent="center"
              style={{
                background: inComparator ? C.amber : 'rgba(255,255,255,0.9)',
                border: `1px solid ${inComparator ? C.amber : 'rgba(255,255,255,0.6)'}`,
              }}
              _hover={{ opacity: 0.85 }}
              transition="all 0.15s"
              onClick={toggleCompare as any}
            >
              <Scale size={12} color={inComparator ? 'white' : C.navy} />
            </Box>
          </Tooltip>
        </Flex>
      </Box>

      {/* Contenu */}
      <Box p={4}>
        {/* Marque / fournisseur */}
        <HStack spacing={1.5} mb={1.5}>
          {(product as any).brands?.logo_url && (
            <Box w={4} h={4} rounded="sm" overflow="hidden" bg="white"
              style={{ border: `1px solid ${C.border}` }} flexShrink={0}>
              <Image src={(product as any).brands.logo_url} alt="" w="full" h="full" objectFit="contain" />
            </Box>
          )}
          <Text fontSize="10px" style={{ color: C.muted }} fontWeight="600" noOfLines={1}
            letterSpacing="0.04em" textTransform="uppercase">
            {(product as any).brands?.name ?? (product as any).organisations?.name}
          </Text>
        </HStack>

        {/* Nom produit */}
        <Text fontWeight="700" style={{ color: C.navy }} fontSize="sm" noOfLines={2} mb={2} lineHeight={1.4}>
          {product.name}
        </Text>

        {/* Note */}
        {product.avg_rating > 0 && (
          <HStack spacing={0.5} mb={2}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={10}
                fill={i < Math.round(product.avg_rating) ? '#f59e0b' : 'none'}
                color="#f59e0b" />
            ))}
            <Text fontSize="10px" style={{ color: C.muted }} ml={1}>
              {product.avg_rating.toFixed(1)} ({product.review_count})
            </Text>
          </HStack>
        )}

        {/* Séparateur */}
        <Box h="1px" style={{ background: C.border }} mb={3} />

        {/* Prix + CTA */}
        <Flex justify="space-between" align="end" gap={2}>
          {activeOrg ? (
            <Box flex={1} minW={0}>
              {firstTier ? (
                <>
                  <HStack spacing={1} align="baseline">
                    <Text fontWeight="800" style={{ color: C.navy }}
                      fontSize="lg" lineHeight={1} fontFamily="mono">
                      {firstTier.unit_price.toFixed(2)}
                    </Text>
                    <Text fontSize="10px" style={{ color: C.muted }}>{product.currency}/u</Text>
                  </HStack>
                  {hasRange ? (
                    <Text fontSize="9px" style={{ color: C.amber }} mt={0.5} fontWeight="600">
                      ↓ {lastTier!.unit_price.toFixed(2)} {product.currency} en gros
                    </Text>
                  ) : (
                    <Text fontSize="9px" style={{ color: C.muted }} mt={0.5}>
                      MOQ : {product.moq} u.
                    </Text>
                  )}
                </>
              ) : (
                <Text fontSize="xs" style={{ color: C.muted }} fontStyle="italic">Sur devis</Text>
              )}
            </Box>
          ) : (
            <Box
              px={2.5} py={1.5} rounded="lg" cursor="pointer" flex={1}
              style={{ background: C.bgAlt, border: `1px solid ${C.border}` }}
              onClick={(e) => { e.stopPropagation(); navigate('/auth'); }}
              _hover={{ borderColor: C.amber }}
              transition="border-color 0.12s"
            >
              <HStack spacing={1}>
                <Lock size={10} color={C.muted} />
                <Text fontSize="10px" style={{ color: C.navy }} fontWeight="600">Accéder aux tarifs</Text>
              </HStack>
            </Box>
          )}

          {/* Bouton panier */}
          <Tooltip
            label={!activeOrg ? 'Connexion requise' : !firstTier ? 'Sur devis' : 'Ajouter au panier'}
            placement="top"
          >
            <Box
              as="button"
              w={9} h={9} rounded="xl"
              display="flex" alignItems="center" justifyContent="center"
              flexShrink={0}
              style={{
                background: activeOrg ? C.navy : '#f1f5f9',
                border: `1px solid ${activeOrg ? C.navyMid : C.border}`,
                opacity: activeOrg && firstTier && !addingToCart ? 1 : 0.5,
              }}
              _hover={activeOrg ? { opacity: 0.85 } : undefined}
              transition="opacity 0.15s"
              disabled={!activeOrg || !firstTier || addingToCart}
              onClick={handleAddToCart}
            >
              {addingToCart
                ? <Spinner size="xs" color="white" />
                : <ShoppingCart size={15} color={activeOrg ? 'white' : C.muted} />}
            </Box>
          </Tooltip>
        </Flex>
      </Box>
    </Box>
  );
}

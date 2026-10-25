import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Flex, HStack, Text, Input, InputGroup, InputLeftElement,
  InputRightElement, IconButton, Badge, Menu, MenuButton, MenuList,
  MenuItem, MenuDivider, Avatar, Button, Drawer, DrawerBody,
  DrawerHeader, DrawerOverlay, DrawerContent, DrawerCloseButton,
  VStack, useDisclosure, Divider, Image, Spinner, SimpleGrid,
  Tooltip, Accordion, AccordionItem, AccordionButton, AccordionPanel,
  AccordionIcon, Modal, ModalOverlay, ModalContent, ModalHeader,
  ModalBody, ModalCloseButton, Breadcrumb, BreadcrumbItem,
  BreadcrumbLink,
} from '@chakra-ui/react';
import {
  Search, ShoppingCart, ChevronDown, Package, Menu as MenuIcon,
  LayoutDashboard, LogOut, Settings, Star, Truck, Phone, Mail,
  Facebook, Twitter, Linkedin, Instagram, Home, Globe,
  ChevronRight, Lock, Scale, X, FileText, Heart, Zap, Store,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useComparator } from '../contexts/ComparatorContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { SupportedLang } from '../i18n';
import { getCatStyle } from '../lib/categoryIcons';
import { getCategoryLabel } from '../lib/categoryLabel';
import { useCart } from '../hooks/useCart';
import { useWishlist } from '../hooks/useWishlist';
import { CartDrawer } from '../components/CartDrawer';
import { NotificationBell } from '../components/NotificationBell';
import MobileBottomNav from './MobileBottomNav';
import type { Product, Category } from '../types';

// ─── brand colour tokens (mirrors HomePage C tokens) ─────────────────────────
const N = {
  navy:   '#0d1f38',
  navyMid:'#1a3558',
  amber:  '#c97d1a',
  amber10:'#fef3c7',
  slate:  '#334155',
  muted:  '#64748b',
  border: '#e2e8f0',
  bgAlt:  '#f8fafc',
};

const PROMOS = [
  { en: 'DISCOUNT', ar: 'خصم', percent: '30%', color: '#dc2626' },
  { en: 'SALE', ar: 'تخفيض', percent: '50%', color: '#f59e0b' },
  { en: 'OFFER', ar: 'عرض', percent: '25%', color: '#7c3aed' },
  { en: 'FLASH SALE', ar: 'عرض فلاش', percent: '40%', color: '#ec4899' },
  { en: 'CLEARANCE', ar: 'تصفية', percent: '60%', color: '#f59e0b' },
  { en: 'PROMOTION', ar: 'ترويج', percent: '35%', color: '#06b6d4' },
  { en: 'MEGA SALE', ar: 'بيع ضخم', percent: '70%', color: '#dc2626' },
];

// ─── helpers ──────────────────────────────────────────────────────────────────
function CatIcon({ name, size = 16 }: { name: string; size?: number }) {
  const { Icon, color } = getCatStyle(name);
  return <Icon size={size} color={color} />;
}

// Shared breadcrumb label, so the linked and current-page variants of a
// category crumb can be rendered as separate elements without repeating it.
function CatCrumbLabel({ category }: { category: Category }) {
  return (
    <HStack spacing={1}>
      <CatIcon name={category.name} size={12} />
      <Text>{getCategoryLabel(category, i18n.language)}</Text>
    </HStack>
  );
}

// ─── SearchAutocomplete (self-contained, exportable) ─────────────────────────
export function SearchAutocomplete({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [matchedCats, setMatchedCats] = useState<Category[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [catMenuOpen, setCatMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    supabase.from('categories')
      .select('id, name, name_i18n, icon, image_url, description, parent_id, display_order, active')
      .eq('active', true).order('display_order')
      .then(({ data }) => setAllCategories((data as Category[]) ?? []));
  }, []);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setCatMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim() || query.length < 2) { setProducts([]); setMatchedCats([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true); setOpen(true);
      let prodQ = supabase.from('products')
        .select('id, name, images, organisations(name), price_tiers(unit_price, qty_min), avg_rating, currency, moq')
        .eq('status', 'active')
        .or(`name.ilike.%${query}%,ean.eq.${query}`)
        .limit(6);
      if (selectedCat) prodQ = prodQ.eq('category_id', selectedCat.id);

      const [prodRes, catRes] = await Promise.all([
        prodQ,
        supabase.from('categories').select('id, name, name_i18n, icon, image_url, description, parent_id, display_order, active')
          .eq('active', true).ilike('name', `%${query}%`).limit(4),
      ]);
      // supabase-js types an embedded one-to-many select as an array, so the
      // inferred `organisations` is Organisation[] while Product declares a
      // single Organisation. A many-to-one embed returns one object at
      // runtime, so the shape is right and only the inference is off — hence
      // the cast through unknown rather than loosening the Product type.
      setProducts((prodRes.data as unknown as Product[]) ?? []);
      setMatchedCats((catRes.data as Category[]) ?? []);
      setLoading(false);
    }, 280);
  }, [query, selectedCat]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    const p = new URLSearchParams({ q: query });
    if (selectedCat) p.set('category', selectedCat.id);
    navigate(`/catalog?${p.toString()}`);
    setOpen(false); setQuery('');
  }

  const { t } = useTranslation();
  const roots = allCategories.filter((c) => !c.parent_id);
  const subs = allCategories.filter((c) => !!c.parent_id);
  const isEmpty = products.length === 0 && matchedCats.length === 0;
  const ph = selectedCat ? t('header.searchIn', { category: selectedCat.name }) : t('header.searchProducts');

  const inputH = size === 'lg' ? '52px' : size === 'sm' ? '36px' : '44px';
  const plOffset = '96px';

  return (
    <Box ref={ref} position="relative" w="full">
      <form onSubmit={handleSubmit}>
        <InputGroup>
          <InputLeftElement w="auto" pl={1} pointerEvents="all" h={inputH}>
            <Menu isLazy isOpen={catMenuOpen} onClose={() => setCatMenuOpen(false)}>
              <MenuButton as={Button} size="xs" variant="ghost"
                color={selectedCat ? 'blue.600' : 'gray.400'}
                rightIcon={<ChevronDown size={10} />}
                h="30px" minW="auto" px={2} ml={1} fontSize="xs" fontWeight="medium"
                onClick={() => setCatMenuOpen(!catMenuOpen)}
                aria-label={t('header.selectCategory')}>
                {selectedCat ? (
                  <HStack spacing={1}>
                    <CatIcon name={selectedCat.name} size={13} />
                    <Text display={{ base: 'none', md: 'block' }} noOfLines={1} maxW="80px">{getCategoryLabel(selectedCat)}</Text>
                  </HStack>
                ) : (
                  <HStack spacing={1}><Globe size={13} /><Text display={{ base: 'none', md: 'block' }}>{t('header.allCategories')}</Text></HStack>
                )}
              </MenuButton>
              <MenuList minW="210px" shadow="xl" rounded="xl" zIndex={400} fontSize="sm">
                <MenuItem icon={<Globe size={14} />}
                  onClick={() => { setSelectedCat(null); setCatMenuOpen(false); }}
                  fontWeight={!selectedCat ? 'semibold' : 'normal'}
                  color={!selectedCat ? 'blue.600' : 'gray.700'}>
                  {t('categories.seeAll')}
                </MenuItem>
                <MenuDivider />
                {roots.map((root) => {
                  const { Icon } = getCatStyle(root.name);
                  return (
                    <Box key={root.id}>
                      <MenuItem icon={<Icon size={14} />} fontWeight="semibold" color="gray.700"
                        onClick={() => { setSelectedCat(root); setCatMenuOpen(false); }}
                        bg={selectedCat?.id === root.id ? 'blue.50' : undefined}>
                        {getCategoryLabel(root)}
                      </MenuItem>
                      {subs.filter((s) => s.parent_id === root.id).map((sub) => {
                        const { Icon: SubIcon } = getCatStyle(sub.name);
                        return (
                          <MenuItem key={sub.id} pl={8} fontSize="xs" color="gray.600"
                            icon={<SubIcon size={12} />}
                            onClick={() => { setSelectedCat(sub); setCatMenuOpen(false); }}
                            bg={selectedCat?.id === sub.id ? 'blue.50' : undefined}>
                            {getCategoryLabel(sub)}
                          </MenuItem>
                        );
                      })}
                    </Box>
                  );
                })}
              </MenuList>
            </Menu>
          </InputLeftElement>

          <Input value={query} onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.length >= 2 && setOpen(true)}
            placeholder={ph} rounded="full" bg="gray.50" border="1px"
            borderColor={open ? 'blue.300' : 'gray.200'}
            _focus={{ bg: 'white', borderColor: 'blue.400', shadow: 'none', ring: 0 }}
            fontSize="sm" h={inputH} pl={plOffset} pr="40px" />

          <InputRightElement h={inputH} w="40px">
            {loading ? <Spinner size="xs" color="blue.400" /> :
              query ? (
                <IconButton aria-label={t('header.closeSearch')} icon={<X size={13} color="#9CA3AF" />}
                  size="xs" variant="ghost" rounded="full"
                  onClick={() => { setQuery(''); setOpen(false); }} />
              ) : <Search size={15} color="#9CA3AF" />}
          </InputRightElement>
        </InputGroup>
      </form>

      {open && (
        <Box position="absolute" top="calc(100% + 8px)" left={0} right={0} bg="white"
          rounded="2xl" shadow="2xl" border="1px" borderColor="gray.100" zIndex={300}
          overflow="hidden" maxH="420px" overflowY="auto">
          {loading && isEmpty && (
            <Flex align="center" justify="center" py={8} gap={3}>
              <Spinner size="sm" color="blue.400" />
              <Text fontSize="sm" color="gray.500">{t('common.loading')}</Text>
            </Flex>
          )}
          {!loading && isEmpty && (
            <Box p={6} textAlign="center">
              <Text fontSize="sm" color="gray.500" mb={2}>{t('header.noResults', { query })}</Text>
              {!user && <Text fontSize="xs" color="blue.500">{t('header.signUpForMore')}</Text>}
            </Box>
          )}

          {matchedCats.length > 0 && (
            <Box>
              <Text fontSize="10px" fontWeight="bold" color="gray.400" px={4} pt={3} pb={1} letterSpacing="wider">
                {t('header.searchCategories').toUpperCase()}
              </Text>
              {matchedCats.map((cat) => {
                const { Icon: CI, bg: cBg, color: cColor } = getCatStyle(cat.name);
                return (
                  <Flex key={cat.id} px={4} py={2.5} gap={3} align="center" cursor="pointer"
                    _hover={{ bg: 'blue.50' }} transition="bg 0.1s"
                    onClick={() => { navigate(`/catalog?category=${cat.id}`); setOpen(false); setQuery(''); }}>
                    <Flex w={8} h={8} rounded="lg" align="center" justify="center" flexShrink={0}
                      style={{ background: cBg }}>
                      <CI size={14} color={cColor} />
                    </Flex>
                    <Box flex={1}>
                      <Text fontSize="sm" color="gray.700" fontWeight="medium">{getCategoryLabel(cat)}</Text>
                      {cat.description && <Text fontSize="10px" color="gray.400" noOfLines={1}>{cat.description}</Text>}
                    </Box>
                  </Flex>
                );
              })}
              {products.length > 0 && <Divider />}
            </Box>
          )}

          {products.length > 0 && (
            <Box>
              <Text fontSize="10px" fontWeight="bold" color="gray.400" px={4} pt={3} pb={1} letterSpacing="wider">
                {t('header.searchProducts').toUpperCase()}
              </Text>
              {products.map((p) => {
                const tier = p.price_tiers?.slice().sort((a, b) => a.qty_min - b.qty_min)[0];
                return (
                  <Flex key={p.id} px={4} py={2.5} gap={3} align="center" cursor="pointer"
                    _hover={{ bg: 'gray.50' }} transition="bg 0.1s"
                    onClick={() => { navigate(`/product/${p.id}`); setOpen(false); setQuery(''); }}>
                    <Box w={10} h={10} rounded="lg" overflow="hidden" bg="gray.100" flexShrink={0}
                      border="1px" borderColor="gray.100">
                      {p.images?.[0] ? (
                        <Image src={p.images[0]} alt={p.name} w="full" h="full" objectFit="cover" />
                      ) : (
                        <Flex w="full" h="full" align="center" justify="center">
                          <Package size={18} color="#9CA3AF" />
                        </Flex>
                      )}
                    </Box>
                    <Box flex={1} minW={0}>
                      <Text fontSize="sm" fontWeight="medium" color="gray.800" noOfLines={1}>{p.name}</Text>
                      <HStack spacing={2}>
                        <Text fontSize="xs" color="gray.400" noOfLines={1}>{(p.organisations as any)?.name}</Text>
                        {p.avg_rating > 0 && (
                          <HStack spacing={0.5}>
                            <Star size={10} fill="gold" color="gold" />
                            <Text fontSize="10px" color="gray.500">{p.avg_rating.toFixed(1)}</Text>
                          </HStack>
                        )}
                      </HStack>
                    </Box>
                    <Box textAlign="right" flexShrink={0}>
                      {user && tier ? (
                        <Text fontSize="sm" fontWeight="bold" color="blue.600">
                          {tier.unit_price.toFixed(2)} {p.currency}
                        </Text>
                      ) : (
                        <HStack spacing={1}>
                          <Lock size={11} color="#9CA3AF" />
                          <Text fontSize="xs" color="gray.400">{t('common.price')}</Text>
                        </HStack>
                      )}
                    </Box>
                  </Flex>
                );
              })}
            </Box>
          )}

          {!isEmpty && (
            <Box borderTop="1px" borderColor="gray.100" p={3}>
              <Button size="sm" w="full" variant="ghost" colorScheme="blue"
                rightIcon={<Search size={13} />}
                onClick={() => {
                  const p = new URLSearchParams({ q: query });
                  if (selectedCat) p.set('category', selectedCat.id);
                  navigate(`/catalog?${p.toString()}`);
                  setOpen(false); setQuery('');
                }}>
                {t('header.allResults', { query })}
              </Button>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

// ─── AllCategoriesModal ───────────────────────────────────────────────────────
export function AllCategoriesModal({ isOpen, onClose, roots, subCategories }: {
  isOpen: boolean; onClose: () => void; roots: Category[]; subCategories: Category[];
}) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent rounded="2xl" mx={4}>
        <ModalHeader borderBottom="1px" borderColor="gray.100">{t('categories.seeAll')}</ModalHeader>
        <ModalCloseButton top={4} insetEnd={4} />
        <ModalBody py={6}>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
            {roots.map((root) => {
              const { Icon: RI, bg, color } = getCatStyle(root.name);
              return (
                <Box key={root.id}>
                  <HStack mb={3} cursor="pointer" role="group"
                    onClick={() => { navigate(`/catalog?category=${root.id}`); onClose(); }}
                    _hover={{ color: 'blue.600' }}>
                    <Flex w={8} h={8} rounded="lg" align="center" justify="center" style={{ background: bg }}>
                      <RI size={16} color={color} />
                    </Flex>
                    <Text fontWeight="bold" color="gray.800" _groupHover={{ color: 'blue.600' }}
                      transition="color 0.15s">{getCategoryLabel(root, i18n.language)}</Text>
                  </HStack>
                  <VStack align="start" spacing={0} ps={2}>
                    {subCategories.filter((s) => s.parent_id === root.id).map((sub) => {
                      const { Icon: SI, color: sc } = getCatStyle(sub.name);
                      return (
                        <HStack key={sub.id} spacing={2} cursor="pointer" py={1.5} px={2} rounded="lg" w="full"
                          _hover={{ bg: 'blue.50', color: 'blue.600' }} transition="all 0.15s"
                          onClick={() => { navigate(`/catalog?category=${sub.id}`); onClose(); }}>
                          <SI size={13} color={sc} />
                          <Text fontSize="sm" color="gray.600">{getCategoryLabel(sub, i18n.language)}</Text>
                        </HStack>
                      );
                    })}
                  </VStack>
                </Box>
              );
            })}
          </SimpleGrid>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

// ─── CategoryBreadcrumb ───────────────────────────────────────────────────────
export function CategoryBreadcrumb({ category, roots, subCategories, productName, searchTerm }: {
  category?: Category | null; roots: Category[]; subCategories: Category[];
  productName?: string; searchTerm?: string;
}) {
  const { t } = useTranslation();
  const allCats = [...roots, ...subCategories];
  const parentCat = category?.parent_id ? allCats.find((c) => c.id === category.parent_id) : null;

  return (
    <Breadcrumb spacing={1.5} separator={<ChevronRight size={12} color="#9CA3AF" />}
      fontSize="sm" mb={4}>
      <BreadcrumbItem>
        <BreadcrumbLink as={Link} to="/" color="gray.500" _hover={{ color: 'blue.600' }}>
          <HStack spacing={1}><Home size={13} /><Text>{t('nav.home')}</Text></HStack>
        </BreadcrumbLink>
      </BreadcrumbItem>
      {searchTerm ? (
        <BreadcrumbItem isCurrentPage>
          <BreadcrumbLink color="gray.800" fontWeight="medium">{t('common.search')} : "{searchTerm}"</BreadcrumbLink>
        </BreadcrumbItem>
      ) : (
        <>
          <BreadcrumbItem>
            <BreadcrumbLink as={Link} to="/catalog" color="gray.500" _hover={{ color: 'blue.600' }}>
              {t('nav.catalog')}
            </BreadcrumbLink>
          </BreadcrumbItem>
          {parentCat && (
            <BreadcrumbItem display={{ base: 'none', md: 'flex' }}>
              <BreadcrumbLink as={Link} to={`/catalog?category=${parentCat.id}`}
                color="gray.500" _hover={{ color: 'blue.600' }}>
                {/* Was printing the raw `name`, so the parent crumb stayed in
                    French ("Food") next to a translated child crumb. */}
                <CatCrumbLabel category={parentCat} />
              </BreadcrumbLink>
            </BreadcrumbItem>
          )}
          {/* Rendered as two elements rather than one with a conditional
              `as`: a span crumb takes no `to`, so the single-element form
              was passing a prop that does not exist on it. */}
          {category && (
            <BreadcrumbItem isCurrentPage={!productName}>
              {productName ? (
                <BreadcrumbLink as={Link} to={`/catalog?category=${category.id}`}
                  color="gray.500" fontWeight="normal" _hover={{ color: 'blue.600' }}>
                  <CatCrumbLabel category={category} />
                </BreadcrumbLink>
              ) : (
                <BreadcrumbLink as="span" color="gray.800" fontWeight="medium">
                  <CatCrumbLabel category={category} />
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          )}
          {productName && (
            <BreadcrumbItem isCurrentPage>
              <BreadcrumbLink color="gray.800" fontWeight="semibold" noOfLines={1} maxW="200px">
                {productName}
              </BreadcrumbLink>
            </BreadcrumbItem>
          )}
        </>
      )}
    </Breadcrumb>
  );
}

// ─── LangSwitcher ─────────────────────────────────────────────────────────────
export function LangSwitcher({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const { lang, setLang } = useLanguage();
  const opts: { key: SupportedLang; label: string }[] = [
    { key: 'en', label: 'EN' },
    { key: 'fr', label: 'FR' },
    { key: 'ar', label: 'العربية' },
  ];
  const isDark = variant === 'dark';
  return (
    <HStack spacing={0} rounded="full" p="2px"
      bg={isDark ? 'rgba(255,255,255,0.08)' : 'gray.100'}
      border="1px solid" borderColor={isDark ? 'rgba(255,255,255,0.15)' : 'gray.200'}>
      {opts.map((o) => {
        const active = lang === o.key;
        return (
          <Box key={o.key} as="button" type="button" onClick={() => setLang(o.key)}
            px={2.5} py="4px" rounded="full" fontSize="11px" fontWeight="700"
            minH="28px" display="flex" alignItems="center"
            style={{
              background: active ? N.amber : 'transparent',
              color: active ? 'white' : isDark ? 'rgba(255,255,255,0.75)' : '#475569',
            }}
            transition="all 0.15s">
            {o.label}
          </Box>
        );
      })}
    </HStack>
  );
}

// ─── ComparatorFloat ──────────────────────────────────────────────────────────
function ComparatorFloat() {
  const { items } = useComparator();
  const navigate = useNavigate();
  if (items.length === 0) return null;
  return (
    <Box position="fixed" bottom={{ base: 'calc(70px + env(safe-area-inset-bottom, 0px))', md: 6 }} insetEnd={{ base: 4, md: 6 }} zIndex={500}>
      <Button
        style={{ background: N.navy, color: 'white', boxShadow: '0 6px 24px rgba(13,31,56,0.4)' }}
        rounded="full" leftIcon={<Scale size={15} />}
        onClick={() => navigate('/compare')} size="md" fontWeight="700"
        _hover={{ opacity: 0.9, transform: 'translateY(-2px)' }} transition="all 0.18s">
        Comparer ({items.length}/4)
      </Button>
    </Box>
  );
}

// ─── StorefrontLayout ─────────────────────────────────────────────────────────
export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { user, profile, activeOrg, signOut } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isCartOpen, onOpen: onCartOpen, onClose: onCartClose } = useDisclosure();
  const { isOpen: isMobSearchOpen, onOpen: onMobSearchOpen, onClose: onMobSearchClose } = useDisclosure();
  const { count: cartCount } = useCart();
  const wishlistCount = useWishlist().count;
  const [roots, setRoots] = useState<Category[]>([]);
  const [subs, setSubs] = useState<Category[]>([]);
  const [promoIdx, setPromoIdx] = useState(0);
  const promos = PROMOS;

  useEffect(() => {
    const interval = setInterval(() => {
      setPromoIdx((prev) => (prev + 1) % PROMOS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    supabase.from('categories')
      .select('id, name, name_i18n, icon, image_url, description, parent_id, display_order, active')
      .eq('active', true).order('display_order')
      .then(({ data }) => {
        const all = (data as Category[]) ?? [];
        setRoots(all.filter((c) => !c.parent_id));
        setSubs(all.filter((c) => !!c.parent_id));
      });
  }, []);

  function getDashPath() {
  if (profile?.is_admin) return '/admin';
  if (!activeOrg) return '/';
  if (activeOrg.org_type === 'seller') return '/vendor';
  if (activeOrg.org_type === 'delivery') return '/delivery';
  return '/buyer';
}
  return (
    <Flex direction="column" minH="100vh" bg="gray.50">
      {/* Announcement bar — contact + langue (desktop) */}
      <Box display={{ base: 'none', md: 'block' }}
        style={{ background: `linear-gradient(90deg, #0a1929 0%, ${N.navy} 50%, #0a1929 100%)` }} py={1.5} px={4}>
        <Flex maxW="1400px" mx="auto" justify="flex-end" align="center" gap={4}>
          <HStack spacing={4}>
            <HStack spacing={1} color="blue.200" fontSize="xs">
              <Phone size={10} />
              <Text>+33 1 XX XX XX XX</Text>
            </HStack>
            <HStack spacing={1} color="blue.200" fontSize="xs">
              <Mail size={10} />
              <Text>contact@stock212.com</Text>
            </HStack>
          </HStack>
          <LangSwitcher variant="dark" />
        </Flex>
      </Box>

      {/* Primary header — sticky two-tier */}
      <Box bg="white" position="sticky" top={0} zIndex={200}
        borderBottom="1px solid" borderColor="gray.100"
        boxShadow="0 1px 0 0 #f1f5f9, 0 4px 20px -4px rgba(13,31,56,0.08)">

        {/* Tier 1 — Logo + Navigation Buttons + Search + Auth */}
        <Flex maxW="1400px" mx="auto" px={{ base: 4, md: 6 }} h={{ base: '60px', md: '68px' }} align="center" gap={{ base: 2, md: 3 }}>

          {/* Logo + Brand */}
          <Link to="/">
            <HStack
              spacing={2.5} flexShrink={0}
              _hover={{ opacity: 0.85 }}
              transition="all 0.2s"
            >
              <style>{`
                @keyframes logoBounce {
                  0%, 100% { transform: translateY(0px); }
                  50% { transform: translateY(-5px); }
                }
                @keyframes logoSpin {
                  0%, 100% { transform: rotateZ(0deg); }
                  50% { transform: rotateZ(5deg); }
                }
                @keyframes messageBlink {
                  0%, 10% { opacity: 0; }
                  20%, 80% { opacity: 1; }
                  90%, 100% { opacity: 0; }
                }
                @keyframes hide {
                  0%, 10% { opacity: 1; }
                  20%, 80% { opacity: 0; }
                  90%, 100% { opacity: 1; }
                }
              `}</style>
              <Image
                src="/navlogo.png"
                alt="Stock212"
                h={{ base: '34px', md: '40px' }}
                w="auto"
                objectFit="contain"
                style={{
                  animation: 'logoBounce 2s ease-in-out infinite, logoSpin 3s ease-in-out infinite'
                }}
              />
              <Box display={{ base: 'none', sm: 'block' }} position="relative">
                <Box style={{ animation: 'hide 5s infinite' }}>
                  <Text
                    fontSize={{ base: 'lg', md: 'xl' }}
                    fontWeight="800"
                    letterSpacing="-0.5px"
                    bgGradient="linear(to-r, blue.700, blue.500)"
                    bgClip="text"
                    lineHeight="1"
                  >
                    Stock212
                  </Text>
                  <Text fontSize="9px" color="gray.400" fontWeight="500" letterSpacing="0.5px" mt="1px">
                    {t('header.tagline')}
                  </Text>
                </Box>

                <VStack
                  position="absolute" top={0} left={0} spacing={0.5}
                  style={{ animation: 'messageBlink 5s infinite' }}>
                  <Text
                    fontSize={{ base: 'sm', md: 'md' }}
                    fontWeight="900"
                    letterSpacing="1px"
                    style={{ color: promos[promoIdx].color }}>
                    {promos[promoIdx].en}
                  </Text>
                  <HStack spacing={1} align="center" justify="center">
                    <Text
                      fontSize="10px"
                      fontWeight="700"
                      style={{ color: promos[promoIdx].color }}>
                      {promos[promoIdx].ar}
                    </Text>
                    <Text
                      fontSize="11px"
                      fontWeight="800"
                      style={{ color: promos[promoIdx].color }}>
                      {promos[promoIdx].percent}
                    </Text>
                  </HStack>
                </VStack>
              </Box>
            </HStack>
          </Link>

          {/* Navigation Buttons — before search */}
          <HStack spacing={1} display={{ base: 'none', lg: 'flex' }} flexShrink={0}>
            <Button
              variant="ghost" size="sm" fontWeight="500" fontSize="sm"
              color="gray.700"
              _hover={{ bg: 'gray.100', color: 'gray.900' }}
              onClick={() => navigate('/catalog')}
            >
              {t('nav.catalog')}
            </Button>
            <Button
              variant="ghost" size="sm" fontWeight="500" fontSize="sm"
              color="gray.700"
              _hover={{ bg: 'gray.100', color: 'gray.900' }}
              onClick={() => navigate('/best-deals')}
            >
              {t('nav.bestDeals')}
            </Button>
            <Button
              variant="ghost" size="sm" fontWeight="500" fontSize="sm"
              color="gray.700"
              _hover={{ bg: 'gray.100', color: 'gray.900' }}
              onClick={() => navigate('/buyer/destockage')}
            >
              Déstockage
            </Button>
            <Button
              variant="ghost" size="sm" fontWeight="500" fontSize="sm"
              color="gray.700"
              _hover={{ bg: 'gray.100', color: 'gray.900' }}
              onClick={() => navigate('/brands')}
            >
              {t('nav.brands')}
            </Button>
          </HStack>

          {/* Search bar — desktop */}
          <Box flex={1} maxW="480px" display={{ base: 'none', md: 'block' }}>
            <SearchAutocomplete size="md" />
          </Box>

          {/* Spacer on mobile */}
          <Box flex={1} display={{ base: 'block', md: 'none' }} />

          {/* Search icon — mobile, opens overlay */}
          <IconButton
            aria-label={t('header.searchPlaceholder')}
            icon={<Search size={18} />}
            variant="ghost"
            display={{ base: 'flex', md: 'none' }}
            rounded="full"
            size="sm"
            minW="44px" minH="44px"
            color="gray.600"
            _hover={{ bg: 'gray.100' }}
            onClick={onMobSearchOpen}
          />

          {/* Right actions — Login / Signup */}
          <HStack spacing={2} flexShrink={0} display={{ base: 'none', sm: 'flex' }}>
            {user ? (
              <>
                <NotificationBell />

                {/* Favoris — acheteurs uniquement */}
                {(!activeOrg || activeOrg.org_type === 'buyer') && (
                  <Box position="relative" display="inline-flex">
                    <Tooltip label={t('header.myFavorites')} placement="bottom" hasArrow openDelay={400}>
                      <IconButton
                        aria-label={t('header.myFavorites')}
                        icon={<Heart size={17} fill={wishlistCount > 0 ? '#e11d48' : 'none'} color={wishlistCount > 0 ? '#e11d48' : 'currentColor'} />}
                        variant="ghost"
                        rounded="full"
                        size="sm"
                        color="gray.500"
                        _hover={{ bg: 'red.50', color: 'red.500' }}
                        onClick={() => navigate('/buyer/wishlist')}
                      />
                    </Tooltip>
                    {wishlistCount > 0 && (
                      <Badge
                        position="absolute" top="-3px" right="-3px"
                        bg="#e11d48" color="white" rounded="full" fontSize="8px"
                        minW="15px" h="15px" lineHeight="15px" textAlign="center"
                        pointerEvents="none" fontWeight="700"
                      >
                        {wishlistCount}
                      </Badge>
                    )}
                  </Box>
                )}

                {/* Cart — masqué pour les livreurs */}
                {activeOrg?.org_type !== 'delivery' && (
                  <Box position="relative" display="inline-flex">
                    <Tooltip label={t('nav.cart')} placement="bottom" hasArrow openDelay={400}>
                      <IconButton
                        aria-label={t('nav.cart')}
                        icon={<ShoppingCart size={17} />}
                        variant="ghost"
                        rounded="full"
                        size="sm"
                        color="gray.500"
                        _hover={{ bg: 'blue.50', color: 'blue.600' }}
                        onClick={onCartOpen}
                      />
                    </Tooltip>
                    {cartCount > 0 && (
                      <Badge
                        position="absolute" top="-3px" right="-3px"
                        bg="blue.600" color="white" rounded="full" fontSize="8px"
                        minW="15px" h="15px" lineHeight="15px" textAlign="center"
                        pointerEvents="none" fontWeight="700"
                      >
                        {cartCount}
                      </Badge>
                    )}
                  </Box>
                )}

                {/* User menu */}
                <Menu isLazy>
                  <MenuButton>
                    <HStack
                      spacing={2} cursor="pointer"
                      pl={2} pr={2.5} py={1.5}
                      rounded="xl"
                      border="1px solid transparent"
                      _hover={{ bg: 'gray.50', borderColor: 'gray.200' }}
                      transition="all 0.15s"
                    >
                      <Avatar
                        size="xs" name={profile?.full_name ?? user.email ?? ''}
                        bg="blue.600" color="white"
                        style={{ width: 28, height: 28, fontSize: '11px' }}
                      />
                      <Box display={{ base: 'none', lg: 'block' }} textAlign="left">
                        <Text fontSize="xs" fontWeight="600" color="gray.800" lineHeight={1.2} maxW="88px" noOfLines={1}>
                          {profile?.full_name ?? 'Mon compte'}
                        </Text>
                        <Text fontSize="9px" color="gray.400" noOfLines={1}>{activeOrg?.name ?? '—'}</Text>
                      </Box>
                      <ChevronDown size={11} color="#9CA3AF" />
                    </HStack>
                  </MenuButton>
                  <MenuList
                    shadow="2xl" rounded="2xl" fontSize="sm" zIndex={300}
                    border="1px" borderColor="gray.100" overflow="hidden" py={0}
                    minW="220px"
                  >
                    {/* Profile header */}
                    <Box px={4} py={4} bg="linear-gradient(135deg, #eff6ff, #dbeafe)" borderBottom="1px" borderColor="blue.100">
                      <HStack spacing={3}>
                        <Avatar
                          size="md" name={profile?.full_name ?? user.email ?? ''}
                          bg="blue.500" color="white"
                        />
                        <Box minW={0}>
                          <Text fontWeight="bold" color="gray.800" fontSize="sm" noOfLines={1}>
                            {profile?.full_name ?? '—'}
                          </Text>
                          <Text fontSize="xs" color="gray.500" noOfLines={1}>{user.email}</Text>
                          <Badge
                            mt={1} fontSize="9px" rounded="full" px={2}
                            colorScheme={
                              activeOrg?.org_type === 'seller' ? 'purple' :
                              activeOrg?.org_type === 'delivery' ? 'orange' : 'blue'
                            }
                          >
                            {activeOrg?.org_type === 'seller' ? 'Vendeur' :
                             activeOrg?.org_type === 'delivery' ? 'Livreur' : 'Acheteur'}
                          </Badge>
                        </Box>
                      </HStack>
                    </Box>
                    {/* Menu items — contenu selon le rôle */}
                    <Box py={1}>
                      <MenuItem
                        icon={<LayoutDashboard size={15} />}
                        onClick={() => navigate(getDashPath())}
                        color="gray.700" _hover={{ bg: 'blue.50', color: 'blue.700' }}
                      >
                        {t('header.dashboard')}
                      </MenuItem>
                      {activeOrg?.org_type !== 'delivery' && (
                        <>
                          <MenuItem
                            icon={<Star size={15} />}
                            onClick={() => navigate('/buyer/orders')}
                            color="gray.700" _hover={{ bg: 'blue.50', color: 'blue.700' }}
                          >
                            {t('header.myOrders')}
                          </MenuItem>
                          <MenuItem
                            icon={<FileText size={15} />}
                            onClick={() => navigate('/buyer/quotes')}
                            color="gray.700" _hover={{ bg: 'blue.50', color: 'blue.700' }}
                          >
                            {t('header.myQuotes')}
                          </MenuItem>
                          <MenuItem
                            icon={<Truck size={15} />}
                            onClick={() => navigate('/buyer/orders')}
                            color="gray.700" _hover={{ bg: 'blue.50', color: 'blue.700' }}
                          >
                            {t('header.deliveryTracking')}
                          </MenuItem>
                          <MenuItem
                            icon={<Settings size={15} />}
                            onClick={() => navigate('/buyer/account')}
                            color="gray.700" _hover={{ bg: 'blue.50', color: 'blue.700' }}
                          >
                            {t('header.settings')}
                          </MenuItem>
                        </>
                      )}
                    </Box>
                    <Divider />
                    <Box py={1}>
                      <MenuItem
                        icon={<LogOut size={15} />}
                        color="red.500" fontWeight="medium"
                        onClick={async () => { await signOut(); navigate('/auth'); }}
                        _hover={{ bg: 'red.50' }}
                      >
                        {t('header.logout')}
                      </MenuItem>
                    </Box>
                  </MenuList>
                </Menu>
              </>
            ) : (
              <HStack spacing={2}>
                <Button
                  size="sm" variant="outline" fontWeight="600" rounded="lg"
                  display={{ base: 'none', md: 'flex' }}
                  borderColor={N.amber} color={N.amber}
                  leftIcon={<Store size={14} />}
                  _hover={{ bg: N.amber10 }}
                  onClick={() => navigate('/auth?role=seller')}
                >
                  {t('header.supplierLogin')}
                </Button>
                <Button
                  size="sm" variant="ghost" color="gray.600" fontWeight="500"
                  display={{ base: 'none', sm: 'flex' }}
                  leftIcon={<LogOut size={14} />}
                  _hover={{ bg: 'gray.50', color: 'gray.900' }}
                  onClick={() => navigate('/auth')}
                >
                  Se Connecter
                </Button>
                <Button
                  size="sm" colorScheme="blue" rounded="lg" fontWeight="600" px={4}
                  bg="blue.600" color="white"
                  leftIcon={<FileText size={14} />}
                  _hover={{ bg: 'blue.700', transform: 'translateY(-1px)' }}
                  boxShadow="0 2px 8px rgba(37,99,235,0.30)"
                  transition="all 0.15s"
                  onClick={() => navigate('/auth')}
                >
                  S'inscrire
                </Button>
              </HStack>
            )}
            <Box w="1px" h="20px" bg="gray.200" display={{ base: 'none', md: 'block' }} mx={1} />
          </HStack>

          {/* Outside the HStack above on purpose: that group is display:none
              below sm, and a hidden parent removes its whole subtree — so a
              menu button nested inside it was unreachable on most phones,
              taking the language switcher in the drawer down with it. */}
          <IconButton
            aria-label={t('header.menu')}
            icon={<MenuIcon size={17} />}
            variant="ghost"
            display={{ base: 'flex', lg: 'none' }}
            onClick={onOpen}
            color="gray.600"
            rounded="lg"
            minW="44px"
            minH="44px"
            flexShrink={0}
            _hover={{ bg: 'gray.100' }}
          />
        </Flex>

      </Box>

      {/* Sous-nav acheteur — visible uniquement sur /buyer/* */}
      {user && loc.pathname.startsWith('/buyer') && (
        <Box
          bg="white"
          style={{ borderBottom: `1px solid ${N.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
          position="sticky"
          top="0"
          zIndex={200}
        >
          <Flex
            maxW="1400px" mx="auto" px={6}
            align="center" h="40px"
            overflowX="auto"
            gap={0}
            css={{ '&::-webkit-scrollbar': { display: 'none' } }}
          >
            {([
              { to: '/buyer',               labelKey: 'nav.home',       exact: true  },
              { to: '/buyer/catalog',       labelKey: 'nav.catalog',     exact: false },
              { to: '/buyer/destockage',    labelKey: 'nav.destocking',    exact: false },
              { to: '/buyer/orders',        labelKey: 'nav.orders',     exact: false },
              { to: '/buyer/quotes',        labelKey: 'nav.quotes',         exact: false },
              { to: '/buyer/compare',       labelKey: 'nav.comparator',   exact: false },
              { to: '/buyer/optimizer',     labelKey: 'nav.optimizer',    exact: false },
              { to: '/buyer/ean-catalogue', labelKey: 'nav.eanCatalog',      exact: false },
              { to: '/buyer/wishlist',      labelKey: 'nav.favorites',       exact: false },
              { to: '/buyer/insights',      labelKey: 'nav.insights',      exact: false },
              { to: '/buyer/finances',      labelKey: 'nav.finances',      exact: false },
              { to: '/buyer/account',       labelKey: 'nav.account',        exact: false },
            ] as { to: string; labelKey: string; exact: boolean }[]).map(({ to, labelKey, exact }) => {
              const label = t(labelKey);
              const active = exact
                ? loc.pathname === to
                : loc.pathname.startsWith(to);
              return (
                <Link key={to} to={to}>
                  <Box
                    px={4} h="40px"
                    display="flex" alignItems="center"
                    whiteSpace="nowrap"
                    borderBottom="2px solid"
                    borderColor={active ? N.amber : 'transparent'}
                    style={{ color: active ? N.navy : N.muted }}
                    fontWeight={active ? '700' : '500'}
                    fontSize="12px"
                    _hover={{ color: N.navy, borderBottomColor: N.amber }}
                    transition="all 0.15s"
                  >
                    {label}
                    {to === '/buyer/wishlist' && wishlistCount > 0 && (
                      <Box as="span" ml={1} px={1.5} fontSize="10px" fontWeight="700"
                        borderRadius="full" style={{ background: N.amber, color: 'white' }}>
                        {wishlistCount}
                      </Box>
                    )}
                  </Box>
                </Link>
              );
            })}
          </Flex>
        </Box>
      )}

      {/* Mobile Drawer */}
      <Drawer isOpen={isOpen} placement="left" onClose={onClose}>
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px" py={3} px={4}>
            <HStack spacing={2.5}>
              <Image
                src="/navlogo.png"
                alt="Stock212"
                h="36px"
                w="auto"
                objectFit="contain"
              />
              <Box>
                <Text fontSize="lg" fontWeight="800" letterSpacing="-0.5px"
                  bgGradient="linear(to-r, blue.700, blue.500)" bgClip="text" lineHeight="1">
                  Stock212
                </Text>
                <Text fontSize="8px" color="gray.400" fontWeight="500" letterSpacing="0.5px">
                  {t('header.tagline')}
                </Text>
              </Box>
            </HStack>
          </DrawerHeader>
          <DrawerBody px={0}>
            <VStack align="stretch" spacing={0}>
              {/* Langue */}
              <Flex px={4} py={3} borderBottom="1px" borderColor="gray.100" justify="flex-end">
                <LangSwitcher variant="light" />
              </Flex>
              {/* Search bar mobile */}
              <Box px={4} py={3} borderBottom="1px" borderColor="gray.100">
                <SearchAutocomplete size="sm" />
              </Box>

              {[
                { to: '/',           label: t('nav.home') },
                { to: '/catalog',    label: t('nav.catalog') },
                { to: '/brands',     label: t('nav.brands') },
                { to: '/boutiques',  label: t('nav.shops') },
                { to: '/best-deals', label: t('nav.bestDeals') },
              ].map(({ to, label }) => (
                <Link key={to} to={to} onClick={onClose}>
                  <Box py={3} px={5} _hover={{ bg: 'gray.50' }}>
                    <Text fontSize="sm" fontWeight="medium" color="gray.700">{label}</Text>
                  </Box>
                </Link>
              ))}

              {roots.length > 0 && (
                <>
                  <Divider />
                  <Box px={5} pt={3} pb={1}>
                    <Text fontSize="10px" fontWeight="bold" color="gray.400" letterSpacing="wider">
                      {t('categories.title').toUpperCase()}
                    </Text>
                  </Box>
                  <Accordion allowMultiple>
                    {roots.map((root) => {
                      const { Icon: RI, color: rc } = getCatStyle(root.name);
                      return (
                        <AccordionItem key={root.id} border="none">
                          <AccordionButton px={5} py={2.5} _hover={{ bg: 'gray.50' }}>
                            <HStack flex={1} spacing={2}>
                              <RI size={15} color={rc} />
                              <Text fontSize="sm" fontWeight="semibold" color="gray.700">{root.name}</Text>
                            </HStack>
                            <AccordionIcon color="gray.400" />
                          </AccordionButton>
                          <AccordionPanel px={5} pb={2}>
                            <VStack align="start" spacing={0}>
                              {subs.filter((s) => s.parent_id === root.id).map((sub) => {
                                const { Icon: SI, color: sc } = getCatStyle(sub.name);
                                return (
                                  <HStack key={sub.id} spacing={2} w="full" py={2} px={2} rounded="lg"
                                    cursor="pointer" _hover={{ bg: 'blue.50' }}
                                    onClick={() => { navigate(`/catalog?category=${sub.id}`); onClose(); }}>
                                    <SI size={13} color={sc} />
                                    <Text fontSize="sm" color="gray.600">{sub.name}</Text>
                                  </HStack>
                                );
                              })}
                            </VStack>
                          </AccordionPanel>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </>
              )}

              <Divider />
              {user ? (
                <VStack align="stretch" spacing={0}>
                  <Box px={5} pt={3} pb={1}>
                    <Text fontSize="10px" fontWeight="bold" color="gray.400" letterSpacing="wider">
                      {t('footer.account').toUpperCase()}
                    </Text>
                  </Box>
                  <Link to={getDashPath()} onClick={onClose}>
                    <Box py={3} px={5} _hover={{ bg: 'gray.50' }}>
                      <Text fontSize="sm" fontWeight="medium" color="gray.700">{t('header.dashboard')}</Text>
                    </Box>
                  </Link>
                  {activeOrg?.org_type !== 'delivery' && (
                    <>
                      <Link to="/buyer/orders" onClick={onClose}>
                        <Box py={3} px={5} _hover={{ bg: 'gray.50' }}>
                          <Text fontSize="sm" fontWeight="medium" color="gray.700">{t('header.myOrders')}</Text>
                        </Box>
                      </Link>
                      <Link to="/buyer/quotes" onClick={onClose}>
                        <Box py={3} px={5} _hover={{ bg: 'gray.50' }}>
                          <Text fontSize="sm" fontWeight="medium" color="gray.700">{t('header.myQuotes')}</Text>
                        </Box>
                      </Link>
                      <Link to="/buyer/ean-catalogue" onClick={onClose}>
                        <Box py={3} px={5} _hover={{ bg: 'gray.50' }}>
                          <Text fontSize="sm" fontWeight="medium" color="gray.700">{t('header.eanReference')}</Text>
                        </Box>
                      </Link>
                    </>
                  )}
                  <Divider my={1} />
                  <Box py={3} px={5} cursor="pointer" _hover={{ bg: 'red.50' }}
                    onClick={async () => { await signOut(); onClose(); navigate('/auth'); }}>
                    <Text fontSize="sm" fontWeight="medium" color="red.500">{t('header.logout')}</Text>
                  </Box>
                </VStack>
              ) : (
                <VStack spacing={3} px={5} pt={4} pb={2}>
                  <Button w="full" rounded="full" size="sm" fontWeight="700"
                    style={{ background: N.navy, color: 'white' }}
                    _hover={{ opacity: 0.9 }}
                    onClick={() => { navigate('/auth'); onClose(); }}>{t('footer.signUpFree')}</Button>
                  <Button w="full" variant="outline" rounded="full" size="sm"
                    onClick={() => { navigate('/auth'); onClose(); }}>{t('footer.login')}</Button>
                  <Button w="full" variant="outline" rounded="full" size="sm"
                    borderColor={N.amber} color={N.amber} leftIcon={<Store size={14} />}
                    onClick={() => { navigate('/auth?role=seller'); onClose(); }}>{t('header.supplierLogin')}</Button>
                </VStack>
              )}
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* Cart Drawer */}
      <CartDrawer isOpen={isCartOpen} onClose={onCartClose} />

      {/* Mobile search overlay */}
      {isMobSearchOpen && (
        <Box position="fixed" inset={0} zIndex={400} bg="white" display={{ base: 'block', md: 'none' }}>
          <Flex align="center" gap={2} px={4} h="60px" borderBottom="1px" borderColor="gray.100">
            <Box flex={1}>
              <SearchAutocomplete size="md" />
            </Box>
            <IconButton aria-label={t('common.close')} icon={<X size={18} />} variant="ghost" rounded="full"
              minW="44px" minH="44px" onClick={onMobSearchClose} />
          </Flex>
        </Box>
      )}

      {/* Bannière validation en attente */}
      {activeOrg?.validation_status === 'pending' && (
        <Box bg="blue.700" px={4} py={2.5}>
          <Flex maxW="1400px" mx="auto" align="center" gap={2}>
            <Text fontSize="sm" color="white" fontWeight="500">
              {t('header.pendingValidation')}
            </Text>
          </Flex>
        </Box>
      )}
      {activeOrg?.validation_status === 'rejected' && (
        <Box bg="red.600" px={4} py={2.5}>
          <Flex maxW="1400px" mx="auto" align="center" gap={2}>
            <Text fontSize="sm" color="white" fontWeight="500">
              {t('header.validationRejected', { email: 'commercial@stock212.com' }).split('{{email}}')[0]}
              <Text as="a" href="mailto:commercial@stock212.com" textDecoration="underline" display="inline">
                commercial@stock212.com
              </Text>
            </Text>
          </Flex>
        </Box>
      )}

      {/* Page content — homepage gets full-bleed (no maxW / px) — flex="1" pousse le footer en bas */}
      {loc.pathname === '/'
        ? <Box flex="1" bg="white" pb={{ base: 'calc(58px + env(safe-area-inset-bottom, 0px))', md: 0 }}>{children}</Box>
        : <Box flex="1" w="100%" maxW="1400px" mx="auto" px={4} py={6} pb={{ base: 'calc(70px + env(safe-area-inset-bottom, 0px))', md: 6 }}>{children}</Box>
      }

      {/* Comparator floating button */}
      <ComparatorFloat />

      {/* Footer — masqué sur mobile, seule la nav basse (Accueil/Catalogue/Panier...) reste visible */}
      <Box bg="gray.900" mt={12} display={{ base: 'none', md: 'block' }}>
        <Box maxW="1400px" mx="auto" px={4} pt={9} pb={6}>
          <Flex direction={{ base: 'column', md: 'row' }} gap={8} justify="space-between">
            <VStack align="start" spacing={3} maxW="260px">
              <Image
                src="/stock212_logo_white.png"
                alt="Stock212"
                h="120px"
                w="auto"
                objectFit="contain"
              />
              <Text color="gray.400" fontSize="sm" lineHeight={1.7}>
                {t('footer.tagline')}
              </Text>
              <HStack spacing={3}>
                {[Facebook, Twitter, Linkedin, Instagram].map((Icon, i) => (
                  <Flex key={i} w={7} h={7} bg="gray.800" rounded="lg" align="center" justify="center"
                    cursor="pointer" _hover={{ bg: N.amber }} transition="background 0.2s">
                    <Icon size={14} color="#9CA3AF" />
                  </Flex>
                ))}
              </HStack>
            </VStack>

            <Flex gap={8} flexWrap="wrap">
              <VStack align="start" spacing={2}>
                <Text color="white" fontWeight="semibold" fontSize="sm">{t('footer.platform')}</Text>
                {[
                  { to: '/catalog', label: t('footer.catalog') },
                  { to: '/best-deals', label: t('footer.bestOffers') },
                  { to: '/brands', label: t('footer.brands') },
                  { to: '/how-it-works', label: t('footer.howItWorks') },
                ].map(({ to, label }) => (
                  <Link key={to} to={to}>
                    <Text color="gray.400" fontSize="sm" _hover={{ color: 'white' }} transition="color 0.15s">{label}</Text>
                  </Link>
                ))}
              </VStack>

              <VStack align="start" spacing={2}>
                <Text color="white" fontWeight="semibold" fontSize="sm">{t('footer.account')}</Text>
                {[
                  { to: '/auth', label: t('footer.login') },
                  { to: '/auth', label: t('footer.signUpFree') },
                  { to: '/buyer', label: t('footer.buyerSpace') },
                  { to: '/vendor', label: t('footer.sellerSpace') },
                ].map(({ to, label }) => (
                  <Link key={label} to={to}>
                    <Text color="gray.400" fontSize="sm" _hover={{ color: 'white' }} transition="color 0.15s">{label}</Text>
                  </Link>
                ))}
              </VStack>

              <VStack align="start" spacing={2}>
                <Text color="white" fontWeight="semibold" fontSize="sm">{t('footer.contact')}</Text>
                <HStack spacing={2}><Mail size={13} color="#6B7280" /><Text color="gray.400" fontSize="sm">contact@stock212.com</Text></HStack>
                <HStack spacing={2}><Phone size={13} color="#6B7280" /><Text color="gray.400" fontSize="sm">+33 1 XX XX XX XX</Text></HStack>
              </VStack>
            </Flex>
          </Flex>
        </Box>
        <Box borderTop="1px" borderColor="gray.800">
          <Flex maxW="1400px" mx="auto" px={4} py={4} justify="space-between" align="center" flexWrap="wrap" gap={3}>
            <Text color="gray.500" fontSize="xs">© {new Date().getFullYear()} Stock212. {t('footer.rights')}</Text>
            <HStack spacing={5} fontSize="xs">
              {[{ to: '/legal/cgv', label: t('footer.terms') }, { to: '/legal/privacy', label: t('footer.privacy') }, { to: '/legal/mentions', label: t('footer.legal') }].map(({ to, label }) => (
                <Link key={to} to={to}>
                  <Text color="gray.500" _hover={{ color: 'gray.200' }} transition="color 0.15s">{label}</Text>
                </Link>
              ))}
            </HStack>
          </Flex>
        </Box>
      </Box>

      {/* Nav basse mobile */}
      <MobileBottomNav onOpenCart={onCartOpen} />
    </Flex>
  );
}

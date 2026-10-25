import {
  Drawer, DrawerBody, DrawerHeader, DrawerOverlay, DrawerContent,
  DrawerCloseButton, VStack, HStack, Text, Box, Button, Flex,
  Image, Badge, Divider, NumberInput, NumberInputField,
  NumberInputStepper, NumberIncrementStepper, NumberDecrementStepper,
  Spinner, useToast,
} from '@chakra-ui/react';
import { ShoppingCart, Trash2, AlertTriangle, Package, ArrowRight, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  useCart, itemUnitPrice, itemMinQty, type CartItemWithProduct,
} from '../hooks/useCart';
import type { PriceTier } from '../types';

function getNextTier(tiers: PriceTier[], qty: number): PriceTier | null {
  const sorted = [...tiers].sort((a, b) => a.qty_min - b.qty_min);
  return sorted.find((t) => t.qty_min > qty) ?? null;
}

// ─── CartItem Row ─────────────────────────────────────────────────────────────
function CartItemRow({
  item,
  onRemove,
  onQtyChange,
}: {
  item: CartItemWithProduct;
  onRemove: () => void;
  onQtyChange: (qty: number, price: number | null) => void;
}) {
  const product = item.products;
  if (!product) return null;

  const tiers = product.price_tiers ?? [];
  const lot = item.lot ?? null;
  const unitPrice = itemUnitPrice(item);
  const minQty = itemMinQty(item);
  const nextTier = lot ? null : getNextTier(tiers, item.quantity);
  const needed = nextTier ? nextTier.qty_min - item.quantity : 0;
  const belowMoq = item.quantity < minQty;

  function handleQtyChange(_: string, val: number) {
    let safeQty = isNaN(val) || val < 1 ? minQty : val;
    if (lot) safeQty = Math.min(safeQty, lot.qty_available);
    onQtyChange(safeQty, itemUnitPrice(item, safeQty));
  }

  return (
    <Box>
      <Flex gap={3} align="start">
        {/* Image */}
        <Box w="56px" h="56px" rounded="lg" overflow="hidden" bg="gray.100" flexShrink={0}>
          {product.images?.[0] ? (
            <Image src={product.images[0]} alt={product.name} w="full" h="full" objectFit="cover" />
          ) : (
            <Flex w="full" h="full" align="center" justify="center">
              <Package size={20} color="var(--chakra-colors-gray-400)" />
            </Flex>
          )}
        </Box>

        {/* Info */}
        <Box flex={1} minW={0}>
          <Text fontSize="sm" fontWeight="semibold" color="gray.800" noOfLines={2} lineHeight={1.3}>
            {product.name}
          </Text>
          <Text fontSize="xs" color="blue.500" mt={0.5}>
            {(product as any).organisations?.name}
          </Text>
          {lot && (
            <Badge colorScheme="orange" fontSize="10px" mt={1}>
              Déstockage · Lot {lot.lot_number}
            </Badge>
          )}

          {/* Qty stepper */}
          <HStack mt={2} spacing={2}>
            <NumberInput
              size="xs"
              value={item.quantity}
              min={minQty}
              max={lot?.qty_available}
              step={lot ? 1 : product.pack_size}
              onChange={handleQtyChange}
              maxW="90px"
            >
              <NumberInputField rounded="lg" fontSize="xs" />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
            <Text fontSize="xs" color="gray.400">× {unitPrice?.toFixed(2)} {product.currency}</Text>
          </HStack>
        </Box>

        {/* Price + remove */}
        <VStack spacing={1} align="end" flexShrink={0}>
          <Text fontWeight="bold" fontSize="sm" color="blue.700">
            {unitPrice != null ? (unitPrice * item.quantity).toFixed(2) : '—'} {product.currency}
          </Text>
          <Button
            size="xs" variant="ghost" colorScheme="red" p={1}
            onClick={onRemove} aria-label="Supprimer"
          >
            <Trash2 size={13} />
          </Button>
        </VStack>
      </Flex>

      {/* MOQ warning */}
      {belowMoq && (
        <HStack
          mt={2} px={3} py={1.5} bg="orange.50"
          border="1px" borderColor="orange.200" rounded="lg" spacing={2}
        >
          <AlertTriangle size={13} color="var(--chakra-colors-orange-500)" />
          <Text fontSize="xs" color="orange.700">
            MOQ : {minQty} unités minimum — il manque {minQty - item.quantity}
          </Text>
        </HStack>
      )}

      {/* Next tier nudge */}
      {!belowMoq && nextTier && needed > 0 && (
        <HStack
          mt={2} px={3} py={1.5} bg="blue.50"
          border="1px" borderColor="blue.100" rounded="lg" spacing={2}
        >
          <TrendingUp size={13} color="var(--chakra-colors-blue-500)" />
          <Text fontSize="xs" color="blue.700">
            +{needed} unités → {nextTier.unit_price.toFixed(2)} {product.currency}/u
            {' '}(-{Math.round((1 - nextTier.unit_price / (unitPrice ?? nextTier.unit_price)) * 100)}%)
          </Text>
        </HStack>
      )}
    </Box>
  );
}

// ─── Seller Group ─────────────────────────────────────────────────────────────
function SellerGroup({
  sellerName,
  items,
  currency,
  onRemove,
  onQtyChange,
}: {
  sellerName: string;
  items: CartItemWithProduct[];
  currency: string;
  onRemove: (id: string) => void;
  onQtyChange: (id: string, qty: number, price: number | null) => void;
}) {
  const sellerTotal = items.reduce((s, i) => s + (itemUnitPrice(i) ?? 0) * i.quantity, 0);

  return (
    <Box bg="white" rounded="xl" border="1px" borderColor="gray.100" overflow="hidden">
      <Flex
        px={4} py={2.5} bg="gray.50"
        borderBottom="1px" borderColor="gray.100"
        justify="space-between" align="center"
      >
        <Text fontSize="xs" fontWeight="semibold" color="gray.600" textTransform="uppercase" letterSpacing="0.5px">
          {sellerName}
        </Text>
        <Text fontSize="xs" fontWeight="bold" color="gray.700">
          {sellerTotal.toFixed(2)} {currency}
        </Text>
      </Flex>
      <VStack spacing={4} p={4} align="stretch" divider={<Divider />}>
        {items.map((item) => (
          <CartItemRow
            key={item.id}
            item={item}
            onRemove={() => onRemove(item.id)}
            onQtyChange={(qty, price) => onQtyChange(item.id, qty, price)}
          />
        ))}
      </VStack>
    </Box>
  );
}

// ─── CartDrawer ───────────────────────────────────────────────────────────────
export function CartDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { items, loading, hasMoqViolation, removeItem, updateQty } = useCart();

  // Group by seller
  const bySeller: Record<string, { name: string; currency: string; items: CartItemWithProduct[] }> = {};
  for (const item of items) {
    const orgId = (item.products as any)?.organisations?.id ?? 'unknown';
    const orgName = (item.products as any)?.organisations?.name ?? 'Vendeur';
    const currency = item.products?.currency ?? '€';
    if (!bySeller[orgId]) bySeller[orgId] = { name: orgName, currency, items: [] };
    bySeller[orgId].items.push(item);
  }

  const grandTotal = items.reduce((s, i) => s + (itemUnitPrice(i) ?? 0) * i.quantity, 0);

  const currency = items[0]?.products?.currency ?? '€';

  async function handleRemove(id: string) {
    await removeItem(id);
    toast({ title: 'Produit retiré du panier', status: 'info', duration: 2000, position: 'bottom-right' });
  }

  function handleCheckout() {
    if (hasMoqViolation) {
      toast({
        title: 'Quantités minimales non respectées',
        description: 'Corrigez les quantités avant de passer commande.',
        status: 'warning',
        duration: 4000,
        isClosable: true,
        position: 'bottom-right',
      });
      return;
    }
    onClose();
    navigate('/checkout');
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose} placement="right" size="md">
      <DrawerOverlay backdropFilter="blur(2px)" />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader borderBottomWidth="1px" borderColor="gray.100">
          <HStack spacing={2}>
            <ShoppingCart size={18} color="var(--chakra-colors-blue-600)" />
            <Text>Mon panier</Text>
            {items.length > 0 && (
              <Badge colorScheme="blue" rounded="full" px={2} fontSize="xs">
                {items.reduce((s, i) => s + i.quantity, 0)} unités
              </Badge>
            )}
          </HStack>
        </DrawerHeader>

        <DrawerBody p={4}>
          {loading ? (
            <Flex justify="center" align="center" h="200px">
              <Spinner color="blue.500" />
            </Flex>
          ) : items.length === 0 ? (
            <Flex direction="column" align="center" justify="center" h="60%" gap={4} color="gray.400">
              <Flex w={16} h={16} bg="gray.100" rounded="2xl" align="center" justify="center">
                <ShoppingCart size={28} />
              </Flex>
              <Box textAlign="center">
                <Text fontWeight="semibold" color="gray.600">Votre panier est vide</Text>
                <Text fontSize="sm" mt={1}>Parcourez le catalogue pour ajouter des produits.</Text>
              </Box>
              <Button
                colorScheme="blue" rounded="full" size="sm"
                rightIcon={<ArrowRight size={14} />}
                onClick={() => { onClose(); navigate('/catalog'); }}
              >
                Explorer le catalogue
              </Button>
            </Flex>
          ) : (
            <VStack spacing={4} align="stretch">
              {/* MOQ global warning */}
              {hasMoqViolation && (
                <HStack
                  px={4} py={3} bg="orange.50"
                  border="1px" borderColor="orange.200" rounded="xl" spacing={3}
                >
                  <AlertTriangle size={16} color="var(--chakra-colors-orange-500)" />
                  <Text fontSize="sm" color="orange.800" fontWeight="medium">
                    Certaines quantités sont inférieures au MOQ requis.
                  </Text>
                </HStack>
              )}

              {/* Seller groups */}
              {Object.entries(bySeller).map(([orgId, group]) => (
                <SellerGroup
                  key={orgId}
                  sellerName={group.name}
                  items={group.items}
                  currency={group.currency}
                  onRemove={handleRemove}
                  onQtyChange={updateQty}
                />
              ))}

              <Divider />

              {/* Total */}
              <Flex justify="space-between" align="center" px={1}>
                <Text fontWeight="semibold" color="gray.700">Total HT estimé</Text>
                <Text fontWeight="800" fontSize="xl" color="blue.700">
                  {grandTotal.toFixed(2)} {currency}
                </Text>
              </Flex>

              {/* Checkout CTA */}
              <Button
                colorScheme={hasMoqViolation ? 'orange' : 'blue'}
                size="lg"
                rounded="xl"
                rightIcon={<ArrowRight size={16} />}
                onClick={handleCheckout}
                isDisabled={hasMoqViolation}
                w="full"
              >
                {hasMoqViolation ? 'Corriger les quantités' : 'Passer commande'}
              </Button>
              <Button
                variant="ghost"
                colorScheme="blue"
                size="sm"
                rounded="xl"
                onClick={() => { onClose(); navigate('/catalog'); }}
              >
                Continuer mes achats
              </Button>
            </VStack>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

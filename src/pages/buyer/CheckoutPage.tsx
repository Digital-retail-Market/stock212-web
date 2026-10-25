// @ts-nocheck
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, VStack, HStack, Text, Button, Divider, Flex,
  FormControl, FormLabel, Input, Select, RadioGroup,
  Radio, Stack, useToast, Heading, Textarea, Badge, Spinner,
} from '@chakra-ui/react';
import { ArrowLeft, CheckCircle, CreditCard, AlertTriangle, Truck, Star } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useCart, itemUnitPrice } from '../../hooks/useCart';
import {
  fetchPartnerCarriers,
  fetchSellerFleetAvailability,
  DELIVERY_METHOD_LABELS,
  type DeliveryMethod,
  type PartnerCarrier,
} from '../../hooks/useDeliveryRouter';
import {
  fetchDeliveryConfigs,
  computeDeliveryFee,
  type DeliveryConfig,
} from '../../lib/cartOptimizer';

function fmtMAD(n: number) {
  return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 2 }).format(n);
}

const C = {
  border:  'gray.100',
  borderSel: 'blue.300',
  bgSel:   'blue.50',
};

export default function CheckoutPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { activeOrg } = useAuth();
  const { items, loading, cartId, hasMoqViolation } = useCart();

  const [paymentTerms, setPaymentTerms]         = useState('prepayment');
  const [deliveryPref, setDeliveryPref]          = useState<'standard' | 'express' | 'cold_chain'>('standard');
  const [deliveryMethod, setDeliveryMethod]      = useState<DeliveryMethod>('stock212');
  const [selectedCarrierId, setSelectedCarrierId]= useState<string | null>(null);
  const [address, setAddress]                    = useState({ line1: '', city: '', postal_code: '', country: 'MA' });
  const [notes, setNotes]                        = useState('');
  const [placing, setPlacing]                    = useState(false);
  const [done, setDone]                          = useState(false);
  const [orderNumbers, setOrderNumbers]          = useState<string[]>([]);

  // Delivery options loaded from DB
  const [partnerCarriers, setPartnerCarriers]         = useState<PartnerCarrier[]>([]);
  const [sellerFleetAvailable, setSellerFleetAvail]   = useState(false);
  const [loadingOptions, setLoadingOptions]            = useState(true);
  const [vendorDeliveryConfigs, setVendorDeliveryConfigs] = useState<Map<string, DeliveryConfig>>(new Map());

  // Group cart items by seller
  const bySeller: Record<string, { org_id: string; name: string; currency: string; items: typeof items }> = {};
  for (const item of items) {
    const orgId   = (item.products as Record<string, unknown> & { organisations?: { id: string; name: string } })?.organisations?.id ?? 'unknown';
    const orgName = (item.products as Record<string, unknown> & { organisations?: { id: string; name: string } })?.organisations?.name ?? 'Vendeur';
    // MAD par défaut (marché cible V1 = Maroc, cf. cahier des charges §1.1) ;
    // le multi-devise réel (conversion) est explicitement hors périmètre V1
    // (roadmap §17, prévu en V3), donc pas de repli sur EUR ici.
    const currency = item.products?.currency ?? 'MAD';
    if (!bySeller[orgId]) bySeller[orgId] = { org_id: orgId, name: orgName, currency, items: [] };
    bySeller[orgId].items.push(item);
  }

  const sellerOrgIds = Object.keys(bySeller).filter((id) => id !== 'unknown');

  // Le checkout ne sait pas convertir entre devises (hors périmètre V1) : si
  // le panier mélange des vendeurs facturant dans des devises différentes,
  // on bloque plutôt que d'afficher un total additionné à tort.
  const distinctCurrencies = Array.from(new Set(Object.values(bySeller).map((g) => g.currency)));
  const hasMixedCurrencies = distinctCurrencies.length > 1;

  // Pre-load default delivery address + delivery options
  useEffect(() => {
    if (loading || items.length === 0 || !activeOrg) return;
    async function load() {
      setLoadingOptions(true);
      const [carriers, fleetInfos, cfgMap, defaultAddrRes] = await Promise.all([
        fetchPartnerCarriers(),
        fetchSellerFleetAvailability(sellerOrgIds),
        fetchDeliveryConfigs(sellerOrgIds),
        supabase
          .from('buyer_delivery_addresses')
          .select('street, city, phone')
          .eq('organisation_id', activeOrg!.id)
          .eq('is_default', true)
          .maybeSingle(),
      ]);
      setPartnerCarriers(carriers);
      const hasFleet = sellerOrgIds.length > 0 && fleetInfos.every((f) => f.has_fleet);
      setSellerFleetAvail(hasFleet);
      setVendorDeliveryConfigs(cfgMap);
      if (defaultAddrRes.data) {
        const a = defaultAddrRes.data as { street: string; city: string; phone: string };
        setAddress((prev) => ({
          ...prev,
          line1: a.street || prev.line1,
          city:  a.city   || prev.city,
        }));
      }
      setLoadingOptions(false);
    }
    load();
  }, [loading, items.length, activeOrg?.id]);

  // Mode choisi sur la fiche produit : si toutes les lignes sont en
  // enlèvement (EXW), l'acheteur organise lui-même le transport.
  useEffect(() => {
    if (items.length > 0 && items.every((i) => i.preferred_delivery_method === 'enlevement')) {
      setDeliveryMethod('buyer_managed');
    }
  }, [items.length]);

  // Reset carrier selection when method changes
  useEffect(() => {
    if (deliveryMethod !== 'partner_carrier') setSelectedCarrierId(null);
  }, [deliveryMethod]);

  const grandTotal = items.reduce((s, i) => s + (itemUnitPrice(i) ?? 0) * i.quantity, 0);
  const currency = hasMixedCurrencies ? null : (distinctCurrencies[0] ?? 'MAD');

  // Delivery cost per vendor (live, from vendor_delivery_config)
  const vendorDeliveryCosts: Record<string, number> = {};
  for (const [orgId, group] of Object.entries(bySeller)) {
    const groupSubtotal = group.items.reduce((s, i) => s + (itemUnitPrice(i) ?? 0) * i.quantity, 0);
    const cfg = vendorDeliveryConfigs.get(orgId) ?? null;
    // If seller delivers with own fleet, no separate fee charged by their delivery config
    const effectiveMethod = deliveryMethod;
    vendorDeliveryCosts[orgId] = effectiveMethod === 'buyer_managed' ? 0 : computeDeliveryFee(cfg, groupSubtotal);
  }
  const totalDeliveryFee = Object.values(vendorDeliveryCosts).reduce((s, f) => s + f, 0);

  async function placeOrders() {
    if (!activeOrg) return;

    if (activeOrg.validation_status !== 'active') {
      toast({
        title: 'Compte non validé',
        description: 'Votre organisation est en attente de validation. Vous ne pouvez pas passer commande pour le moment.',
        status: 'warning', duration: 5000, isClosable: true, position: 'bottom-right',
      });
      return;
    }

    if (!address.line1 || !address.city) {
      toast({ title: 'Adresse de livraison requise', status: 'warning', duration: 3000, position: 'bottom-right' });
      return;
    }
    if (hasMoqViolation) {
      toast({ title: 'Corriger les quantités MOQ avant de continuer', status: 'warning', duration: 3000, position: 'bottom-right' });
      return;
    }
    if (hasMixedCurrencies) {
      toast({
        title: 'Devises mélangées dans le panier',
        description: 'Le paiement multi-devises n\'est pas encore disponible. Passez commande séparément pour chaque groupe de devise.',
        status: 'warning', duration: 5000, isClosable: true, position: 'bottom-right',
      });
      return;
    }
    if (deliveryMethod === 'partner_carrier' && !selectedCarrierId) {
      toast({ title: 'Veuillez sélectionner un transporteur partenaire', status: 'warning', duration: 3000, position: 'bottom-right' });
      return;
    }

    setPlacing(true);
    try {
      const deliveryAddress = {
        line1: address.line1, city: address.city,
        postal_code: address.postal_code, country: address.country,
      };

      if (!cartId) throw new Error('Panier introuvable');

      const { data: createdOrders, error: rpcError } = await supabase.rpc('place_multi_vendor_order', {
        p_cart_id: cartId,
        p_payment_terms: paymentTerms,
        p_payment_method: 'bank_transfer',
        p_delivery_address: deliveryAddress,
        p_billing_address: deliveryAddress,
        p_delivery_preference: deliveryPref,
        p_delivery_method: deliveryMethod,
        p_carrier_org_id: deliveryMethod === 'partner_carrier' ? selectedCarrierId : null,
        p_notes: notes || null,
      });

      if (rpcError) throw rpcError;

      const nums = (createdOrders as { order_number: string }[] | null)?.map((o) => o.order_number) ?? [];

      setOrderNumbers(nums);
      setDone(true);
    } catch (e) {
      toast({
        title: 'Erreur lors de la commande',
        description: e instanceof Error ? e.message : 'Erreur inconnue',
        status: 'error', duration: 5000, isClosable: true, position: 'bottom-right',
      });
    } finally {
      setPlacing(false);
    }
  }

  // ── Confirmed screen ──────────────────────────────────────────────────────────
  if (done) {
    return (
      <Flex direction="column" align="center" justify="center" minH="60vh" gap={6} px={4} textAlign="center">
        <Flex w={20} h={20} bg="green.100" rounded="full" align="center" justify="center">
          <CheckCircle size={40} color="var(--chakra-colors-green-500)" />
        </Flex>
        <VStack spacing={2}>
          <Heading size="lg" color="gray.800">
            Commande{orderNumbers.length > 1 ? 's' : ''} confirmée{orderNumbers.length > 1 ? 's' : ''} !
          </Heading>
          <Text color="gray.600">
            {orderNumbers.length === 1
              ? `Référence : ${orderNumbers[0]}`
              : `${orderNumbers.length} commandes créées auprès de différents vendeurs.`}
          </Text>
          <Text fontSize="sm" color="gray.500">
            {deliveryMethod === 'stock212'
              ? 'Un livreur indépendant de notre réseau sera assigné à votre livraison.'
              : deliveryMethod === 'partner_carrier'
              ? 'Le transporteur partenaire sera contacté pour planifier la livraison.'
              : deliveryMethod === 'seller_fleet'
              ? 'Le vendeur assurera la livraison avec sa propre flotte.'
              : 'Vous pouvez organiser votre livraison dès confirmation du vendeur.'}
          </Text>
        </VStack>
        <HStack spacing={3}>
          <Button colorScheme="blue" rounded="xl" onClick={() => navigate('/buyer')}>
            Mon espace acheteur
          </Button>
          <Button variant="outline" rounded="xl" onClick={() => navigate('/buyer/catalog')}>
            Continuer mes achats
          </Button>
        </HStack>
      </Flex>
    );
  }

  if (loading) {
    return (
      <Flex justify="center" align="center" minH="60vh">
        <Box w={8} h={8} borderWidth="3px" borderStyle="solid" borderColor="blue.500" borderTopColor="transparent" rounded="full" animation="spin 0.8s linear infinite" />
      </Flex>
    );
  }

  if (items.length === 0) {
    return (
      <Flex direction="column" align="center" justify="center" minH="60vh" gap={4}>
        <Text color="gray.500" fontWeight="medium">Votre panier est vide.</Text>
        <Button colorScheme="blue" rounded="xl" onClick={() => navigate('/buyer/catalog')}>
          Explorer le catalogue
        </Button>
      </Flex>
    );
  }

  // ── Available delivery methods (always show stock212 + buyer_managed) ─────────
  const availableMethods: DeliveryMethod[] = [
    ...(sellerFleetAvailable ? ['seller_fleet' as DeliveryMethod] : []),
    ...(partnerCarriers.length > 0 ? ['partner_carrier' as DeliveryMethod] : []),
    'stock212',
    'buyer_managed',
  ];

  return (
    <VStack spacing={8} align="stretch" maxW="1100px" mx="auto" px={{ base: 4, md: 8 }} py={8}>
      <HStack spacing={3}>
        <Button variant="ghost" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate(-1)} size="sm">
          Retour
        </Button>
        <Heading size="lg" color="gray.800">Finaliser la commande</Heading>
      </HStack>

      <Box display={{ md: 'grid' }} gridTemplateColumns={{ md: '1fr 360px' }} gap={8} alignItems="start">
        {/* ── Left — Forms ──────────────────────────────────────────────── */}
        <VStack spacing={5} align="stretch">

          {/* Delivery address */}
          <Box bg="white" rounded="2xl" border="1px" borderColor={C.border} p={6}>
            <Heading size="sm" mb={5} color="gray.700">Adresse de livraison</Heading>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel fontSize="sm">Rue et numéro</FormLabel>
                <Input placeholder="15 rue de la Paix" value={address.line1} onChange={e => setAddress({ ...address, line1: e.target.value })} rounded="lg" />
              </FormControl>
              <HStack spacing={3} w="full">
                <FormControl isRequired flex={1}>
                  <FormLabel fontSize="sm">Ville</FormLabel>
                  <Input placeholder="Paris" value={address.city} onChange={e => setAddress({ ...address, city: e.target.value })} rounded="lg" />
                </FormControl>
                <FormControl w="130px">
                  <FormLabel fontSize="sm">Code postal</FormLabel>
                  <Input placeholder="75001" value={address.postal_code} onChange={e => setAddress({ ...address, postal_code: e.target.value })} rounded="lg" />
                </FormControl>
              </HStack>
              <FormControl>
                <FormLabel fontSize="sm">Pays</FormLabel>
                <Select value={address.country} onChange={e => setAddress({ ...address, country: e.target.value })} rounded="lg">
                  <option value="FR">France</option>
                  <option value="MA">Maroc</option>
                  <option value="DZ">Algérie</option>
                  <option value="TN">Tunisie</option>
                  <option value="BE">Belgique</option>
                  <option value="ES">Espagne</option>
                  <option value="DE">Allemagne</option>
                </Select>
              </FormControl>
            </VStack>
          </Box>

          {/* Payment terms */}
          <Box bg="white" rounded="2xl" border="1px" borderColor={C.border} p={6}>
            <Heading size="sm" mb={5} color="gray.700">Conditions de paiement</Heading>
            <RadioGroup value={paymentTerms} onChange={setPaymentTerms}>
              <Stack spacing={3}>
                {([
                  { value: 'prepayment', label: 'Prépaiement',   desc: 'Virement bancaire avant expédition' },
                  { value: 'net15',      label: 'Net 15 jours',   desc: 'Règlement 15 j. après réception' },
                  { value: 'net30',      label: 'Net 30 jours',   desc: 'Règlement 30 j. après réception' },
                  { value: 'net60',      label: 'Net 60 jours',   desc: 'Règlement 60 j. après réception' },
                ] as const).map(pt => (
                  <Box key={pt.value} border="1px" borderColor={paymentTerms === pt.value ? C.borderSel : C.border} rounded="xl" p={4} bg={paymentTerms === pt.value ? C.bgSel : 'white'} cursor="pointer" onClick={() => setPaymentTerms(pt.value)} transition="all 0.15s">
                    <HStack spacing={3}>
                      <Radio value={pt.value} colorScheme="blue" />
                      <VStack align="start" spacing={0}>
                        <Text fontWeight="semibold" fontSize="sm" color="gray.800">{pt.label}</Text>
                        <Text fontSize="xs" color="gray.500">{pt.desc}</Text>
                      </VStack>
                    </HStack>
                  </Box>
                ))}
              </Stack>
            </RadioGroup>
          </Box>

          {/* Delivery preference (service level) */}
          <Box bg="white" rounded="2xl" border="1px" borderColor={C.border} p={6}>
            <Heading size="sm" mb={5} color="gray.700">Niveau de service</Heading>
            <RadioGroup value={deliveryPref} onChange={v => setDeliveryPref(v as typeof deliveryPref)}>
              <Stack spacing={3}>
                {([
                  { value: 'standard',   label: 'Standard',       desc: '3–5 jours ouvrés' },
                  { value: 'express',    label: 'Express',         desc: '24–48h, supplément applicable' },
                  { value: 'cold_chain', label: 'Chaîne du froid', desc: 'Camion frigorifique certifié ATP' },
                ] as const).map(dp => (
                  <Box key={dp.value} border="1px" borderColor={deliveryPref === dp.value ? C.borderSel : C.border} rounded="xl" p={4} bg={deliveryPref === dp.value ? C.bgSel : 'white'} cursor="pointer" onClick={() => setDeliveryPref(dp.value)} transition="all 0.15s">
                    <HStack spacing={3}>
                      <Radio value={dp.value} colorScheme="blue" />
                      <VStack align="start" spacing={0}>
                        <Text fontWeight="semibold" fontSize="sm" color="gray.800">{dp.label}</Text>
                        <Text fontSize="xs" color="gray.500">{dp.desc}</Text>
                      </VStack>
                    </HStack>
                  </Box>
                ))}
              </Stack>
            </RadioGroup>
          </Box>

          {/* ── Delivery method — WHO handles it ───────────────────────── */}
          <Box bg="white" rounded="2xl" border="1px" borderColor={C.border} p={6}>
            <HStack mb={5} justify="space-between">
              <Heading size="sm" color="gray.700">Opérateur de livraison</Heading>
              {loadingOptions && <Spinner size="sm" color="blue.400" />}
            </HStack>

            {!loadingOptions && (
              <Stack spacing={3}>
                {availableMethods.map((method) => {
                  const meta = DELIVERY_METHOD_LABELS[method];
                  const isSelected = deliveryMethod === method;
                  return (
                    <Box
                      key={method}
                      border="1px"
                      borderColor={isSelected ? C.borderSel : C.border}
                      rounded="xl"
                      p={4}
                      bg={isSelected ? C.bgSel : 'white'}
                      cursor="pointer"
                      onClick={() => setDeliveryMethod(method)}
                      transition="all 0.15s"
                    >
                      <HStack spacing={3} align="start">
                        <Radio value={method} isChecked={isSelected} colorScheme="blue" onChange={() => setDeliveryMethod(method)} mt="2px" />
                        <VStack align="start" spacing={1} flex={1}>
                          <HStack>
                            <Text fontWeight="semibold" fontSize="sm" color="gray.800">
                              {meta.icon} {meta.label}
                            </Text>
                            {method === 'stock212' && (
                              <Badge colorScheme="blue" fontSize="10px">Recommandé</Badge>
                            )}
                            {method === 'seller_fleet' && (
                              <Badge colorScheme="green" fontSize="10px">Inclus</Badge>
                            )}
                          </HStack>
                          <Text fontSize="xs" color="gray.500">{meta.desc}</Text>
                        </VStack>
                      </HStack>

                      {/* Partner carrier sub-selection */}
                      {method === 'partner_carrier' && isSelected && (
                        <Box mt={4} pl={7}>
                          <Text fontSize="xs" fontWeight="semibold" color="gray.600" mb={3} textTransform="uppercase" letterSpacing="0.5px">
                            Choisissez votre transporteur
                          </Text>
                          <Stack spacing={2}>
                            {partnerCarriers.map((c) => (
                              <Box
                                key={c.id}
                                border="1px"
                                borderColor={selectedCarrierId === c.id ? 'blue.400' : 'gray.200'}
                                rounded="lg"
                                p={3}
                                bg={selectedCarrierId === c.id ? 'blue.50' : 'gray.50'}
                                cursor="pointer"
                                onClick={(e) => { e.stopPropagation(); setSelectedCarrierId(c.id); }}
                                transition="all 0.12s"
                              >
                                <HStack justify="space-between">
                                  <HStack spacing={3}>
                                    <Truck size={14} color="var(--chakra-colors-gray-500)" />
                                    <VStack align="start" spacing={0}>
                                      <Text fontSize="sm" fontWeight="semibold" color="gray.800">{c.name}</Text>
                                      <HStack spacing={2}>
                                        <Text fontSize="xs" color="gray.500" textTransform="capitalize">{c.delivery_type.replace('_', ' ')}</Text>
                                        {c.cold_chain && <Badge colorScheme="cyan" fontSize="9px">Froid</Badge>}
                                      </HStack>
                                    </VStack>
                                  </HStack>
                                  <HStack spacing={1}>
                                    <Star size={12} color="var(--chakra-colors-yellow-400)" fill="var(--chakra-colors-yellow-400)" />
                                    <Text fontSize="xs" color="gray.600">{c.avg_rating.toFixed(1)}</Text>
                                    {c.base_rate && (
                                      <Text fontSize="xs" color="gray.500" ml={2}>dès {c.base_rate.toFixed(0)} €</Text>
                                    )}
                                  </HStack>
                                </HStack>
                              </Box>
                            ))}
                          </Stack>
                          {deliveryMethod === 'partner_carrier' && !selectedCarrierId && (
                            <HStack mt={2} color="orange.500" spacing={1}>
                              <AlertTriangle size={12} />
                              <Text fontSize="xs">Sélectionnez un transporteur pour continuer</Text>
                            </HStack>
                          )}
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Box>

          {/* Notes */}
          <Box bg="white" rounded="2xl" border="1px" borderColor={C.border} p={6}>
            <Heading size="sm" mb={4} color="gray.700">Notes de commande</Heading>
            <Textarea
              placeholder="Instructions de livraison, référence bon de commande interne, créneau préféré…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              rounded="lg"
              resize="none"
            />
          </Box>
        </VStack>

        {/* ── Right — Order summary (sticky) ────────────────────────────── */}
        <Box position={{ md: 'sticky' }} top="80px">
          <Box bg="white" rounded="2xl" border="1px" borderColor={C.border} p={6}>
            <Heading size="sm" mb={5} color="gray.700">Récapitulatif</Heading>
            <VStack spacing={4} align="stretch">
              {Object.entries(bySeller).map(([orgId, group], idx, arr) => {
                const groupTotal = group.items.reduce((s, i) => s + (itemUnitPrice(i) ?? 0) * i.quantity, 0);
                const delivFee = vendorDeliveryCosts[orgId] ?? 0;
                const isFreeDelivery = delivFee === 0;
                const cfg = vendorDeliveryConfigs.get(orgId);
                const threshold = cfg?.free_threshold_mad ?? 1000;
                const remaining = !isFreeDelivery && cfg?.delivery_mode === 'free_above_threshold'
                  ? Math.max(0, threshold - groupTotal) : null;
                return (
                  <Box key={orgId}>
                    <HStack justify="space-between" mb={2}>
                      <Text fontSize="10px" fontWeight="bold" color="gray.400"
                        textTransform="uppercase" letterSpacing="0.5px">{group.name}</Text>
                      <Badge
                        fontSize="9px" rounded="full" px={2}
                        colorScheme={isFreeDelivery ? 'green' : 'orange'}
                      >
                        {isFreeDelivery ? 'Livraison offerte' : `Livraison ${fmtMAD(delivFee)}`}
                      </Badge>
                    </HStack>
                    <VStack spacing={1} align="stretch" mb={3}>
                      {group.items.map(item => {
                        const unitPrice = itemUnitPrice(item);
                        return (
                          <HStack key={item.id} justify="space-between">
                            <Text fontSize="sm" color="gray.600" noOfLines={1} flex={1} minW={0}>
                              {item.products?.name}{item.lot ? ` (lot ${item.lot.lot_number})` : ''} × {item.quantity}
                            </Text>
                            <Text fontSize="sm" fontWeight="semibold" color="gray.800" flexShrink={0}>
                              {unitPrice != null ? (unitPrice * item.quantity).toFixed(2) : '—'} {item.products?.currency ?? 'MAD'}
                            </Text>
                          </HStack>
                        );
                      })}
                    </VStack>
                    <HStack justify="space-between" pt={2} borderTop="1px" borderColor={C.border}>
                      <Text fontSize="xs" color="gray.500">Produits</Text>
                      <Text fontSize="sm" fontWeight="bold" color="gray.700">{groupTotal.toFixed(2)} {group.currency}</Text>
                    </HStack>
                    {delivFee > 0 && (
                      <HStack justify="space-between">
                        <Text fontSize="xs" color="orange.500">Frais livraison</Text>
                        <Text fontSize="xs" fontWeight="semibold" color="orange.500">{fmtMAD(delivFee)}</Text>
                      </HStack>
                    )}
                    {remaining != null && remaining > 0 && (
                      <Text fontSize="10px" color="gray.400" mt={0.5}>
                        Encore {fmtMAD(remaining)} d'achats pour livraison offerte
                      </Text>
                    )}
                    <HStack justify="space-between" mt={1}>
                      <Text fontSize="xs" color="gray.500">Livré chez vous</Text>
                      <Text fontSize="sm" fontWeight="bold" color="gray.800">
                        {(groupTotal + delivFee).toFixed(2)} {group.currency}
                      </Text>
                    </HStack>
                    {idx < arr.length - 1 && <Divider mt={4} />}
                  </Box>
                );
              })}

              <Divider />

              {/* Delivery method */}
              <HStack justify="space-between" px={3} py={2} bg="gray.50" rounded="xl">
                <HStack spacing={2}>
                  <Truck size={13} color="var(--chakra-colors-gray-500)" />
                  <Text fontSize="sm" color="gray.600">Opérateur</Text>
                </HStack>
                <Text fontSize="sm" fontWeight="semibold" color="gray.700">
                  {DELIVERY_METHOD_LABELS[deliveryMethod].label}
                </Text>
              </HStack>

              {hasMixedCurrencies && (
                <HStack px={3} py={2.5} bg="red.50" border="1px" borderColor="red.200" rounded="xl" spacing={2} align="start">
                  <AlertTriangle size={14} color="var(--chakra-colors-red-500)" style={{ marginTop: 2, flexShrink: 0 }} />
                  <Text fontSize="xs" color="red.700">
                    Ce panier mélange plusieurs devises ({distinctCurrencies.join(', ')}). Le paiement multi-devises
                    n'est pas encore disponible — commandez séparément les vendeurs facturant en {distinctCurrencies[1] ?? 'devise différente'}.
                  </Text>
                </HStack>
              )}

              <HStack justify="space-between">
                <Text fontWeight="semibold" color="gray.700">Produits HT</Text>
                <Text fontWeight="bold">{hasMixedCurrencies ? '—' : `${grandTotal.toFixed(2)} ${currency}`}</Text>
              </HStack>
              {totalDeliveryFee > 0 && (
                <HStack justify="space-between">
                  <Text fontSize="sm" color="orange.600">Livraison ({Object.keys(bySeller).length} envois)</Text>
                  <Text fontSize="sm" fontWeight="semibold" color="orange.600">{fmtMAD(totalDeliveryFee)}</Text>
                </HStack>
              )}
              <HStack justify="space-between">
                <Text fontSize="sm" color="gray.500">TVA 20%</Text>
                <Text fontSize="sm" color="gray.500">{hasMixedCurrencies ? '—' : `${(grandTotal * 0.2).toFixed(2)} ${currency}`}</Text>
              </HStack>
              <HStack justify="space-between" px={3} py={2} bg="blue.50" rounded="xl">
                <VStack align="start" spacing={0}>
                  <Text fontWeight="bold" color="blue.700">Total TTC</Text>
                  {totalDeliveryFee > 0 && (
                    <Text fontSize="10px" color="blue.500">livraison incluse</Text>
                  )}
                </VStack>
                <Text fontWeight="800" fontSize="lg" color="blue.700">
                  {hasMixedCurrencies ? '—' : `${(grandTotal * 1.2 + totalDeliveryFee).toFixed(2)} ${currency}`}
                </Text>
              </HStack>

              {hasMoqViolation && (
                <HStack px={3} py={2.5} bg="orange.50" border="1px" borderColor="orange.200" rounded="xl" spacing={2}>
                  <AlertTriangle size={14} color="var(--chakra-colors-orange-500)" />
                  <Text fontSize="xs" color="orange.700">Certaines quantités ne respectent pas le MOQ requis.</Text>
                </HStack>
              )}

              <Button
                colorScheme="blue"
                size="lg"
                rounded="xl"
                leftIcon={<CreditCard size={18} />}
                isDisabled={hasMoqViolation || hasMixedCurrencies || placing || (deliveryMethod === 'partner_carrier' && !selectedCarrierId)}
                isLoading={placing}
                loadingText="Création des commandes..."
                onClick={placeOrders}
                w="full"
              >
                Confirmer la commande
              </Button>
              <Text fontSize="xs" color="gray.400" textAlign="center">
                En confirmant, vous acceptez nos conditions générales d'utilisation.
              </Text>
            </VStack>
          </Box>
        </Box>
      </Box>
    </VStack>
  );
}
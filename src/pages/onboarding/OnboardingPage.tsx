import { useEffect, useState } from 'react';
import {
  Box, Button, Flex, FormControl, FormLabel, Heading, Input,
  Text, VStack, HStack, SimpleGrid, Checkbox, Tag, TagLabel,
  Select, Textarea, Alert, AlertIcon, Wrap, WrapItem,
} from '@chakra-ui/react';
import { Package, ShoppingBag, Truck, CheckCircle, Briefcase, Search, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { takeSignupRole, takeReturnPath } from '../../lib/signupRole';
import type { BusinessCategory } from '../../types';
import {
  ROLE_TO_FIELD_DEF_ROLE, groupFieldDefsBySection, LEGAL_STEP_SECTION, parseStorageTarget,
  type OnboardingRole, type OnboardingFieldDefinition, type CustomFieldValue,
} from '../../lib/onboardingFields';

// Valeurs initiales non vides pour certains champs système migrés depuis le
// code (ex: la case "Température ambiante" du livreur était cochée par
// défaut). Clé = storage_target du champ.
const SYSTEM_FIELD_DEFAULTS: Record<string, CustomFieldValue> = {
  'delivery_capabilities.ambient': true,
  'seller_profiles.default_prep_days': '3',
};

// storage_target des colonnes text[] alimentées par un champ texte libre
// (saisie "valeur, valeur, valeur" — comme aujourd'hui), pas par un multiselect.
const COMMA_ARRAY_STORAGE_TARGETS = new Set([
  'seller_profiles.product_categories',
  'seller_profiles.delivery_zones',
]);

const CERTIF_OPTIONS = [
  { value: 'ONSSA', label: 'ONSSA (MA)' },
  { value: 'Halal',  label: 'Halal' },
  { value: 'Bio',    label: 'Bio / Organic' },
];

const DELIVERY_ZONES = [
  'Casablanca-Settat',
  'Rabat-Salé-Kénitra',
  'Marrakech-Safi',
  'Fès-Meknès',
  'Tanger-Tétouan-Al Hoceïma',
  'Béni Mellal-Khénifra',
  'Oriental',
  'Souss-Massa',
  'Drâa-Tafilalet',
  'Guelmim-Oued Noun',
  'Laâyoune-Sakia El Hamra',
  'Dakhla-Oued Ed-Dahab',
];

const ROLE_CARDS = [
  {
    type: 'buyer' as OnboardingRole,
    label: 'Acheteur',
    desc: 'Restaurant, Supermarché, Distributeur, Grossiste…',
    icon: ShoppingBag,
    color: 'blue',
  },
  {
    type: 'seller' as OnboardingRole,
    label: 'Vendeur',
    desc: 'Fabricant, Importateur, Grossiste, Artisan…',
    icon: Package,
    color: 'blue',
  },
  {
    type: 'delivery' as OnboardingRole,
    label: 'Transporteur',
    desc: 'Société logistique, Indépendant, Flotte interne…',
    icon: Truck,
    color: 'blue',
  },
  {
    type: 'commercial' as OnboardingRole,
    label: 'Commercial',
    desc: 'Vous représentez un vendeur déjà présent sur la plateforme',
    icon: Briefcase,
    color: 'purple',
  },
];

// Indicateur d'étape horizontal
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <HStack spacing={0} w="full">
      {Array.from({ length: total }).map((_, i) => (
        <Box key={i} flex={1} position="relative">
          <Box
            h="3px"
            bg={i < current ? 'blue.700' : 'gray.200'}
            transition="background 0.2s"
          />
          {i < total - 1 && (
            <Box w="full" h="3px" position="absolute" top={0} right={0} />
          )}
        </Box>
      ))}
    </HStack>
  );
}

export default function OnboardingPage() {
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [businessCategories, setBusinessCategories] = useState<BusinessCategory[]>([]);

  const [selectedRole, setSelectedRole] = useState<OnboardingRole | null>(takeSignupRole);
  // "Type d'activité" reste hardcodé : ses options viennent de business_categories,
  // déjà géré par sa propre page admin (AdminBusinessCategories), pas une liste statique.
  const [subType, setSubType] = useState('');
  // "Pays" reste hardcodé : valeur stockée ('MA') différente du libellé ('Maroc'),
  // lue ailleurs par comparaison exacte (ex: devise sur BuyerDashboard).
  const [country, setCountry] = useState('MA');
  const [certifications, setCertifications] = useState<string[]>([]);
  // "Type de service" reste hardcodé : contrainte CHECK en base + comparaisons
  // exactes ailleurs (AdminDeliveryValidation...).
  const [deliveryType, setDeliveryType] = useState('independent');
  const [buyerDeliveryZone, setBuyerDeliveryZone] = useState('');
  const [buyerDeliveryAddressDifferent, setBuyerDeliveryAddressDifferent] = useState(false);
  const [buyerDeliveryStreet, setBuyerDeliveryStreet] = useState('');
  const [buyerDeliveryCity, setBuyerDeliveryCity] = useState('');
  const [buyerDeliveryRegion, setBuyerDeliveryRegion] = useState('');
  const [buyerDeliveryInstructions, setBuyerDeliveryInstructions] = useState('');
  // "Modes de livraison proposés" reste hardcodé : stocke des codes machine
  // (ex: 'seller_fleet') différents du libellé affiché, lus ailleurs par
  // comparaison exacte (useDeliveryRouter, CheckoutPage, VendorOrders).
  const [deliveryMethods, setDeliveryMethods] = useState<string[]>([]);
  // Bloc "Conformité & agréments" reste hardcodé : champs composites où un
  // second champ n'apparaît que si le premier est coché.
  const [sellerOnssaApproved, setSellerOnssaApproved] = useState(false);
  const [sellerOnssaNumber, setSellerOnssaNumber] = useState('');
  const [sellerIso22000, setSellerIso22000] = useState(false);
  const [sellerIso22000Doc, setSellerIso22000Doc] = useState<File | null>(null);
  const [sellerIso9001, setSellerIso9001] = useState(false);
  const [sellerIso9001Doc, setSellerIso9001Doc] = useState<File | null>(null);
  const [sellerHalalCertified, setSellerHalalCertified] = useState(false);
  const [sellerHalalBody, setSellerHalalBody] = useState('');
  const [sellerLotTraceability, setSellerLotTraceability] = useState(false);
  const [gdprConsent, setGdprConsent] = useState(false);

  // Spécifique au rôle Commercial — recherche + sélection du vendeur reste un
  // widget spécialisé, pas un champ de formulaire classique.
  const [commercialMotivation, setCommercialMotivation] = useState('');
  const [vendorSearchQuery, setVendorSearchQuery] = useState('');
  const [vendorSearchResults, setVendorSearchResults] = useState<
    { id: string; name: string; city: string | null; country: string | null }[]
  >([]);
  const [vendorSearching, setVendorSearching] = useState(false);
  const [selectedVendorOrgId, setSelectedVendorOrgId] = useState('');
  const [selectedVendorName, setSelectedVendorName] = useState('');

  const totalSteps = 4;

  const STEP_LABELS = [
    'Profil',
    'Informations légales',
    'Activité',
    'Validation',
  ];

  useEffect(() => {
    supabase
      .from('business_categories')
      .select('*')
      .eq('active', true)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true })
      .then(({ data }) => {
        if (data) setBusinessCategories(data as BusinessCategory[]);
      });
  }, []);

  const filteredCategories = businessCategories.filter(
    (c) => c.actor_type === selectedRole
  );

  // Champs pilotés par la config (pages/admin/AdminOnboardingFields.tsx) —
  // mélange de champs "système" migrés depuis le code (storage_target rempli,
  // écrivent dans une colonne dédiée d'une table existante) et de champs
  // personnalisés ajoutés par l'admin (storage_target vide, stockés dans
  // profile.custom_fields). Le rendu et la saisie sont unifiés ; seule la
  // destination du enregistrement diffère à la soumission.
  const [dynamicFields, setDynamicFields] = useState<OnboardingFieldDefinition[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, CustomFieldValue>>({});
  const [customFieldFiles, setCustomFieldFiles] = useState<Record<string, File | null>>({});

  useEffect(() => {
    if (!selectedRole) { setDynamicFields([]); setCustomFieldValues({}); setCustomFieldFiles({}); return; }
    let cancelled = false;
    supabase
      .from('onboarding_field_definitions')
      .select('*')
      .eq('role', ROLE_TO_FIELD_DEF_ROLE[selectedRole])
      .eq('enabled', true)
      .order('section', { ascending: true })
      .order('display_order', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        const fields = (data ?? []) as OnboardingFieldDefinition[];
        setDynamicFields(fields);
        // Repart d'une saisie vierge à chaque changement de rôle : deux rôles
        // peuvent partager le même field_key (ex: "contact_email") sans que
        // l'un ne pré-remplisse l'autre.
        const defaults: Record<string, CustomFieldValue> = {};
        for (const f of fields) {
          if (f.storage_target && SYSTEM_FIELD_DEFAULTS[f.storage_target] !== undefined) {
            defaults[f.field_key] = SYSTEM_FIELD_DEFAULTS[f.storage_target];
          }
        }
        setCustomFieldValues(defaults);
        setCustomFieldFiles({});
      });
    return () => { cancelled = true; };
  }, [selectedRole]);

  function setCustomFieldValue(key: string, value: CustomFieldValue) {
    setCustomFieldValues((prev) => ({ ...prev, [key]: value }));
  }

  // Étape 2 = section réservée "Informations légales" ; tout le reste
  // s'affiche à l'étape 3, regroupé par section.
  const step2DynamicFields = dynamicFields.filter((f) => f.section === LEGAL_STEP_SECTION);
  const step3DynamicFields = dynamicFields.filter((f) => f.section !== LEGAL_STEP_SECTION);
  const step3FieldSections = groupFieldDefsBySection(step3DynamicFields);

  function missingRequiredField(fields: OnboardingFieldDefinition[]): boolean {
    return fields.some((f) => {
      if (!f.required) return false;
      if (f.field_type === 'document') return !customFieldFiles[f.field_key];
      if (f.field_type === 'multiselect') return !((customFieldValues[f.field_key] as string[] | undefined)?.length);
      if (f.field_type === 'boolean') return false;
      const v = customFieldValues[f.field_key];
      return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
    });
  }
  const missingRequiredStep2Field = missingRequiredField(step2DynamicFields);
  const missingRequiredStep3Field = missingRequiredField(step3DynamicFields);

  // Recherche de vendeurs actifs (pour le rôle Commercial), débouncée
  useEffect(() => {
    if (selectedRole !== 'commercial' || vendorSearchQuery.trim().length < 2) {
      setVendorSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setVendorSearching(true);
      const { data } = await supabase.rpc('search_seller_organisations', {
        search_query: vendorSearchQuery.trim(),
      });
      setVendorSearchResults(
        (data as { id: string; name: string; city: string | null; country: string | null }[]) ?? []
      );
      setVendorSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [vendorSearchQuery, selectedRole]);

  // Construit le contenu de la colonne custom_fields à partir des seuls
  // champs personnalisés (storage_target vide) : reprend les valeurs saisies
  // telles quelles, et upload les champs de type "document" vers le bucket de
  // stockage pour n'y stocker que leur URL. Les champs système (storage_target
  // rempli) sont gérés séparément par buildSystemFieldValues.
  async function buildCustomFieldsPayload(storagePrefix: string): Promise<Record<string, CustomFieldValue>> {
    const payload: Record<string, CustomFieldValue> = {};
    for (const field of dynamicFields) {
      if (field.storage_target) continue;
      if (field.field_type === 'document') {
        const file = customFieldFiles[field.field_key];
        if (!file) { payload[field.field_key] = null; continue; }
        const path = `${storagePrefix}/${field.field_key}_${Date.now()}_${file.name}`;
        const { data, error } = await supabase.storage.from('onboarding-docs').upload(path, file);
        payload[field.field_key] = error
          ? null
          : supabase.storage.from('onboarding-docs').getPublicUrl(data.path).data.publicUrl;
      } else {
        payload[field.field_key] = customFieldValues[field.field_key] ?? null;
      }
    }
    return payload;
  }

  // Construit les valeurs des champs "système" (storage_target rempli),
  // regroupées par table cible, prêtes à être fusionnées dans les inserts/
  // updates existants — c'est ce qui permet à l'admin de renommer un champ
  // système sans jamais changer la colonne où sa valeur atterrit.
  function buildSystemFieldValues(fields: OnboardingFieldDefinition[]): Record<string, Record<string, unknown>> {
    const byTable: Record<string, Record<string, unknown>> = {};
    for (const field of fields) {
      if (!field.storage_target) continue;
      const { table, column } = parseStorageTarget(field.storage_target);
      const raw = customFieldValues[field.field_key];
      let value: unknown;
      if (field.field_type === 'number') {
        value = raw === '' || raw === undefined || raw === null ? null : Number(raw);
      } else if (field.field_type === 'boolean') {
        value = typeof raw === 'boolean' ? raw : false;
      } else if (field.field_type === 'multiselect') {
        value = Array.isArray(raw) ? raw : [];
      } else if (typeof raw === 'string' && COMMA_ARRAY_STORAGE_TARGETS.has(field.storage_target)) {
        value = raw.split(',').map((s) => s.trim()).filter(Boolean);
      } else {
        value = (raw as string) || null;
      }
      byTable[table] = byTable[table] || {};
      byTable[table][column] = value;
    }
    return byTable;
  }

  async function handleComplete() {
    if (!user || !selectedRole) return;
    setLoading(true);
    setError('');
    try {
      // Champs système (storage_target rempli) de ce rôle, regroupés par table
      // cible — communs aux étapes 2 et 3 puisqu'ils partagent le même
      // mécanisme de rendu/saisie.
      const systemValues = buildSystemFieldValues(dynamicFields);

      // --- Branche Commercial : pas d'organisation propre, demande d'adhésion
      // en attente d'approbation par le vendeur choisi ---
      if (selectedRole === 'commercial') {
        if (!selectedVendorOrgId) throw new Error('Veuillez sélectionner un vendeur à représenter.');

        const { error: profileErr } = await supabase
          .from('profiles')
          .update({
            onboarding_done: true,
            gdpr_consent: gdprConsent,
            ...systemValues.profiles, // full_name, phone
          })
          .eq('id', user.id);
        if (profileErr) throw profileErr;

        // Demande en attente : active = false tant que le vendeur n'a pas approuvé.
        // Le taux de commission sera défini par le vendeur au moment de l'approbation.
        const { error: memberErr } = await supabase.from('organisation_members').insert({
          organisation_id: selectedVendorOrgId,
          user_id: user.id,
          team_role: 'sales_rep',
          active: false,
          custom_fields: await buildCustomFieldsPayload(user.id),
        });
        if (memberErr) throw memberErr;

        // TODO: stocker `commercialMotivation` quelque part de consultable par le vendeur
        // (ex. colonne dédiée ou table de demandes) une fois l'écran d'approbation construit.

        window.location.replace('/pending-approval');
        return;
      }

      // --- Branche Acheteur / Fournisseur / Transporteur : création d'organisation ---
      const orgId = crypto.randomUUID();

      const { error: orgErr } = await supabase
        .from('organisations')
        .insert({
          id: orgId,
          org_type: selectedRole,
          sub_type: subType || null,
          country,
          validation_status: 'pending',
          ...systemValues.organisations, // name, address_line1, city, region, phone, siret, vat_number, ice, rc, patente, cnss, if_number, postal_code
        });

      if (orgErr) throw orgErr;

      const { error: memberErr } = await supabase.from('organisation_members').insert({
        organisation_id: orgId,
        user_id: user.id,
        team_role: 'owner',
      });
      if (memberErr) throw memberErr;

      const org = { id: orgId };
      const dynamicCustomFields = await buildCustomFieldsPayload(org.id);
      // L'adresse et le téléphone du siège viennent des champs système ci-dessus ;
      // repris ici comme fallback pour l'adresse de livraison par défaut de l'acheteur.
      const orgAddress = systemValues.organisations ?? {};

      if (selectedRole === 'buyer') {
        await supabase.from('buyer_profiles').insert({
          organisation_id: org.id,
          delivery_zone: buyerDeliveryZone,
          custom_fields: dynamicCustomFields,
          ...systemValues.buyer_profiles, // interest_categories, contact_referent, contact_email, contact_phone, phone_secondary, website, years_active, points_of_sale, store_surface_m2
        });
        // Adresse de livraison : reprend par défaut l'adresse du siège saisie
        // à l'étape 2, sauf si l'acheteur a renseigné une adresse différente
        // à l'étape 3. Il pourra en ajouter d'autres plus tard depuis son espace.
        await supabase.from('buyer_delivery_addresses').insert({
          organisation_id: org.id,
          label: 'Adresse principale',
          street: (buyerDeliveryAddressDifferent ? buyerDeliveryStreet : (orgAddress.address_line1 as string)) || '',
          city: (buyerDeliveryAddressDifferent ? buyerDeliveryCity : (orgAddress.city as string)) || '',
          region: (buyerDeliveryAddressDifferent ? buyerDeliveryRegion : (orgAddress.region as string)) || '',
          phone: (orgAddress.phone as string) || '',
          is_default: true,
          instructions: buyerDeliveryInstructions || null,
        });
      } else if (selectedRole === 'seller') {
        // Upload best-effort : les documents justificatifs sont optionnels, un
        // échec d'upload ne doit pas bloquer la soumission du dossier.
        let iso22000DocUrl: string | null = null;
        let iso9001DocUrl: string | null = null;
        if (sellerIso22000Doc) {
          const path = `${org.id}/iso22000_${Date.now()}_${sellerIso22000Doc.name}`;
          const { data, error } = await supabase.storage
            .from('onboarding-docs')
            .upload(path, sellerIso22000Doc);
          if (!error) {
            iso22000DocUrl = supabase.storage.from('onboarding-docs').getPublicUrl(data.path).data.publicUrl;
          }
        }
        if (sellerIso9001Doc) {
          const path = `${org.id}/iso9001_${Date.now()}_${sellerIso9001Doc.name}`;
          const { data, error } = await supabase.storage
            .from('onboarding-docs')
            .upload(path, sellerIso9001Doc);
          if (!error) {
            iso9001DocUrl = supabase.storage.from('onboarding-docs').getPublicUrl(data.path).data.publicUrl;
          }
        }

        await supabase.from('seller_profiles').insert({
          organisation_id: org.id,
          certifications,
          default_delivery_methods: deliveryMethods,
          onssa_approved: sellerOnssaApproved,
          onssa_number: sellerOnssaApproved ? (sellerOnssaNumber || null) : null,
          iso22000_certified: sellerIso22000,
          iso22000_doc_url: iso22000DocUrl,
          iso9001_certified: sellerIso9001,
          iso9001_doc_url: iso9001DocUrl,
          halal_certified: sellerHalalCertified,
          halal_certifying_body: sellerHalalCertified ? (sellerHalalBody || null) : null,
          lot_traceability: sellerLotTraceability,
          custom_fields: dynamicCustomFields,
          ...systemValues.seller_profiles, // trade_name, years_active, contact_email, contact_referent, contact_phone, product_categories, production_capacity, brands_represented, delivery_zones, exclusive_distribution, website, default_prep_days, default_moq, default_franco_eur
        });
      } else if (selectedRole === 'delivery') {
        await supabase.from('delivery_profiles').insert({
          organisation_id: org.id,
          delivery_type: deliveryType,
          custom_fields: dynamicCustomFields,
          ...systemValues.delivery_profiles, // phone, fleet_size, vehicle_types, base_rate
        });
        await supabase.from('delivery_capabilities').insert({
          organisation_id: org.id,
          ...systemValues.delivery_capabilities, // max_weight_kg, max_volume_m3, ambient, cold_chain, frozen, fragile, last_mile
        });
      }

      await supabase
        .from('profiles')
        .update({ onboarding_done: true, gdpr_consent: gdprConsent })
        .eq('id', user.id);

      const dest =
        selectedRole === 'seller' ? '/vendor' :
        selectedRole === 'delivery' ? '/delivery' :
        (takeReturnPath() ?? '/buyer');
      window.location.replace(dest);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création du dossier');
    } finally {
      setLoading(false);
    }
  }

  // Rendu générique d'un champ piloté par la config — utilisé aussi bien pour
  // les champs système (Raison sociale, Ville, Contact référent...) que pour
  // les champs personnalisés ajoutés par l'admin.
  function renderDynamicField(field: OnboardingFieldDefinition) {
    return (
      <FormControl key={field.field_key} isRequired={field.required}>
        {field.field_type !== 'boolean' && (
          <FormLabel fontSize="xs" color="gray.600" fontWeight="600"
            textTransform="uppercase" letterSpacing="0.05em">
            {field.label}
            {!field.required && (
              <Text as="span" fontWeight="400" textTransform="none"> (optionnel)</Text>
            )}
          </FormLabel>
        )}

        {field.field_type === 'text' && (
          <Input value={(customFieldValues[field.field_key] as string) ?? ''}
            onChange={(e) => setCustomFieldValue(field.field_key, e.target.value)}
            placeholder={field.placeholder ?? undefined}
            rounded="sm" fontSize="sm" />
        )}
        {field.field_type === 'number' && (
          <Input type="number" value={(customFieldValues[field.field_key] as string) ?? ''}
            onChange={(e) => setCustomFieldValue(field.field_key, e.target.value)}
            placeholder={field.placeholder ?? undefined}
            rounded="sm" fontSize="sm" fontFamily="mono" />
        )}
        {field.field_type === 'email' && (
          <Input type="email" value={(customFieldValues[field.field_key] as string) ?? ''}
            onChange={(e) => setCustomFieldValue(field.field_key, e.target.value)}
            placeholder={field.placeholder ?? undefined}
            rounded="sm" fontSize="sm" />
        )}
        {field.field_type === 'url' && (
          <Input type="url" value={(customFieldValues[field.field_key] as string) ?? ''}
            onChange={(e) => setCustomFieldValue(field.field_key, e.target.value)}
            placeholder={field.placeholder ?? 'https://'} rounded="sm" fontSize="sm" />
        )}
        {field.field_type === 'textarea' && (
          <Textarea value={(customFieldValues[field.field_key] as string) ?? ''}
            onChange={(e) => setCustomFieldValue(field.field_key, e.target.value)}
            placeholder={field.placeholder ?? undefined}
            rounded="sm" fontSize="sm" rows={3} />
        )}
        {field.field_type === 'select' && (
          <Select value={(customFieldValues[field.field_key] as string) ?? ''}
            onChange={(e) => setCustomFieldValue(field.field_key, e.target.value)}
            rounded="sm" fontSize="sm" placeholder="Sélectionner...">
            {(field.options ?? []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </Select>
        )}
        {field.field_type === 'multiselect' && (
          <SimpleGrid columns={2} spacing={2}>
            {(field.options ?? []).map((opt) => {
              const current = (customFieldValues[field.field_key] as string[] | undefined) ?? [];
              return (
                <Checkbox
                  key={opt}
                  isChecked={current.includes(opt)}
                  onChange={(e) =>
                    setCustomFieldValue(
                      field.field_key,
                      e.target.checked ? [...current, opt] : current.filter((o) => o !== opt)
                    )
                  }
                  colorScheme="blue" size="sm"
                >
                  <Text fontSize="sm" color="gray.700">{opt}</Text>
                </Checkbox>
              );
            })}
          </SimpleGrid>
        )}
        {field.field_type === 'boolean' && (
          <Checkbox
            isChecked={(customFieldValues[field.field_key] as boolean) ?? false}
            onChange={(e) => setCustomFieldValue(field.field_key, e.target.checked)}
            colorScheme="blue" size="sm"
          >
            <Text fontSize="sm" color="gray.700">
              {field.label}{!field.required && ' (optionnel)'}
            </Text>
          </Checkbox>
        )}
        {field.field_type === 'document' && (
          <Input type="file" accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => setCustomFieldFiles((prev) => ({ ...prev, [field.field_key]: e.target.files?.[0] ?? null }))}
            rounded="sm" fontSize="sm" p={1} />
        )}
      </FormControl>
    );
  }

  // Rendu d'une section entière (titre + champs), pour les groupes de champs
  // système/personnalisés de l'étape 3.
  function renderDynamicSection({ section, fields }: { section: string; fields: OnboardingFieldDefinition[] }) {
    return (
      <VStack key={section} spacing={4} w="full" align="stretch" borderTop="1px" borderColor="gray.100" pt={4}>
        <Text fontWeight="700" color="gray.700" fontSize="sm">{section}</Text>
        {fields.map(renderDynamicField)}
      </VStack>
    );
  }

  return (
    <Flex minH="100vh" bg="gray.50" align="center" justify="center" p={4}>
      <Box bg="white" border="1px" borderColor="gray.200" rounded="md" p={8} w="full" maxW="580px">

        {/* Logo */}
        <HStack spacing={2} mb={6}>
          <Flex w={7} h={7} bg="blue.900" rounded="sm" align="center" justify="center">
            <Package size={15} color="white" />
          </Flex>
          <Text fontWeight="800" fontSize="sm" color="gray.900" letterSpacing="-0.01em">Stock212</Text>
        </HStack>

        {/* En-tête étape */}
        <VStack spacing={1} mb={5} align="start">
          <HStack spacing={2} align="center">
            <Text fontSize="10px" color="gray.400" fontWeight="600" textTransform="uppercase"
              letterSpacing="0.08em">
              Étape {step}/{totalSteps}
            </Text>
            <Text fontSize="10px" color="blue.600" fontWeight="600" textTransform="uppercase"
              letterSpacing="0.08em">
              — {STEP_LABELS[step - 1]}
            </Text>
          </HStack>
          <Heading size="sm" color="gray.900" fontWeight="700" letterSpacing="-0.01em">
            Dossier d'inscription professionnelle
          </Heading>
        </VStack>

        {/* Barre de progression */}
        <StepIndicator current={step} total={totalSteps} />

        <Box mt={7}>
          {error && (
            <Alert status="error" rounded="sm" mb={4} fontSize="sm">
              <AlertIcon />{error}
            </Alert>
          )}

          {/* Étape 1 — Sélection du rôle */}
          {step === 1 && (
            <VStack spacing={4}>
              <Text fontWeight="600" color="gray.700" fontSize="sm" alignSelf="start">
                Quel est votre rôle dans la chaîne d'approvisionnement ?
              </Text>
              <SimpleGrid columns={1} spacing={2} w="full">
                {ROLE_CARDS.map(({ type, label, desc, icon: Icon, color }) => (
                  <Box
                    key={type}
                    border="1px"
                    borderColor={selectedRole === type ? `${color}.500` : 'gray.200'}
                    bg={selectedRole === type ? `${color}.50` : 'white'}
                    rounded="md"
                    p={4}
                    cursor="pointer"
                    onClick={() => setSelectedRole(type)}
                    transition="all 0.1s"
                    _hover={{ borderColor: `${color}.400` }}
                  >
                    <HStack spacing={4}>
                      <Flex
                        w={9} h={9}
                        bg={selectedRole === type ? `${color}.100` : 'gray.50'}
                        border="1px"
                        borderColor={selectedRole === type ? `${color}.300` : 'gray.200'}
                        rounded="sm"
                        align="center" justify="center"
                        flexShrink={0}
                      >
                        <Icon size={17} color={selectedRole === type
                          ? `var(--chakra-colors-${color}-700)`
                          : 'var(--chakra-colors-gray-500)'} />
                      </Flex>
                      <Box flex={1}>
                        <Text fontWeight="600" color="gray.800" fontSize="sm">{label}</Text>
                        <Text fontSize="xs" color="gray.500" lineHeight={1.4}>{desc}</Text>
                      </Box>
                      {selectedRole === type && (
                        <CheckCircle size={17} color="var(--chakra-colors-blue-600)" />
                      )}
                    </HStack>
                  </Box>
                ))}
              </SimpleGrid>
            </VStack>
          )}

          {/* Étape 2 — Informations légales (ou identité simplifiée pour Commercial) —
              intégralement pilotée par onboarding_field_definitions, à l'exception
              de "Type d'activité" (options venant de business_categories, déjà géré
              par sa propre page admin) et "Pays" (valeur stockée différente du
              libellé, lue ailleurs par comparaison exacte). */}
          {step === 2 && (
            <VStack spacing={4}>
              <Text fontWeight="600" color="gray.700" fontSize="sm" alignSelf="start">
                {selectedRole === 'commercial' ? 'Vos informations' : "Informations légales de votre organisation"}
              </Text>

              {step2DynamicFields
                .filter((f) => f.field_key === (selectedRole === 'commercial' ? 'full_name' : 'org_name'))
                .map(renderDynamicField)}

              {selectedRole !== 'commercial' && (
                <>
                  <FormControl>
                    <FormLabel fontSize="xs" color="gray.600" fontWeight="600"
                      textTransform="uppercase" letterSpacing="0.05em">
                      Type d'activité
                    </FormLabel>
                    <Select value={subType} onChange={(e) => setSubType(e.target.value)}
                      rounded="sm" placeholder="Sélectionner..." fontSize="sm">
                      {filteredCategories.map((c) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </Select>
                  </FormControl>
                  {selectedRole !== 'seller' && (
                    <FormControl>
                      <FormLabel fontSize="xs" color="gray.600" fontWeight="600"
                        textTransform="uppercase" letterSpacing="0.05em">Pays</FormLabel>
                      <Select value={country} onChange={(e) => setCountry(e.target.value)}
                        rounded="sm" fontSize="sm">
                        <option value="MA">Maroc</option>
                      </Select>
                    </FormControl>
                  )}
                </>
              )}

              {step2DynamicFields
                .filter((f) => f.field_key !== (selectedRole === 'commercial' ? 'full_name' : 'org_name'))
                .map(renderDynamicField)}
            </VStack>
          )}

          {/* Étape 3 — Informations spécifiques au rôle */}
          {step === 3 && (
            <VStack spacing={4}>
              <Text fontWeight="600" color="gray.700" fontSize="sm" alignSelf="start">
                Informations complémentaires
              </Text>
              {selectedRole === 'buyer' && (
                <VStack spacing={5} w="full" align="stretch">
                  {step3FieldSections.map(renderDynamicSection)}

                  {/* Livraison — reste hardcodé : la zone écrit dans
                      buyer_profiles mais l'adresse différente (si cochée)
                      écrit dans buyer_delivery_addresses, une table à part. */}
                  <Box borderTop="1px" borderColor="gray.100" pt={4}>
                    <HStack spacing={1.5} mb={3}>
                      <MapPin size={13} color="var(--chakra-colors-blue-700)" />
                      <Text fontWeight="700" color="gray.700" fontSize="sm">Livraison</Text>
                    </HStack>
                    <VStack spacing={3} w="full">
                      <FormControl isRequired>
                        <FormLabel fontSize="xs" color="gray.600" fontWeight="600"
                          textTransform="uppercase" letterSpacing="0.05em">
                          Zone de livraison souhaitée
                        </FormLabel>
                        <Select value={buyerDeliveryZone} onChange={(e) => setBuyerDeliveryZone(e.target.value)}
                          rounded="sm" fontSize="sm" placeholder="Sélectionner une région...">
                          {DELIVERY_ZONES.map((z) => (
                            <option key={z} value={z}>{z}</option>
                          ))}
                        </Select>
                      </FormControl>

                      <Checkbox
                        isChecked={buyerDeliveryAddressDifferent}
                        onChange={(e) => setBuyerDeliveryAddressDifferent(e.target.checked)}
                        colorScheme="blue" size="sm" alignSelf="start"
                      >
                        <Text fontSize="sm" color="gray.700">
                          Adresse de livraison différente du siège <Text as="span" fontWeight="400" color="gray.400">(optionnel)</Text>
                        </Text>
                      </Checkbox>

                      {buyerDeliveryAddressDifferent && (
                        <VStack spacing={3} w="full" bg="gray.50" border="1px" borderColor="gray.200" rounded="md" p={3}>
                          <FormControl>
                            <FormLabel fontSize="xs" color="gray.600" fontWeight="600"
                              textTransform="uppercase" letterSpacing="0.05em">Adresse</FormLabel>
                            <Input value={buyerDeliveryStreet} onChange={(e) => setBuyerDeliveryStreet(e.target.value)}
                              placeholder="12 rue du Commerce" rounded="sm" fontSize="sm" bg="white" />
                          </FormControl>
                          <HStack w="full" spacing={3}>
                            <FormControl>
                              <FormLabel fontSize="xs" color="gray.600" fontWeight="600"
                                textTransform="uppercase" letterSpacing="0.05em">Ville</FormLabel>
                              <Input value={buyerDeliveryCity} onChange={(e) => setBuyerDeliveryCity(e.target.value)}
                                placeholder="Casablanca" rounded="sm" fontSize="sm" bg="white" />
                            </FormControl>
                            <FormControl>
                              <FormLabel fontSize="xs" color="gray.600" fontWeight="600"
                                textTransform="uppercase" letterSpacing="0.05em">Région</FormLabel>
                              <Input value={buyerDeliveryRegion} onChange={(e) => setBuyerDeliveryRegion(e.target.value)}
                                placeholder="Casablanca-Settat" rounded="sm" fontSize="sm" bg="white" />
                            </FormControl>
                          </HStack>
                        </VStack>
                      )}

                      <FormControl>
                        <FormLabel fontSize="xs" color="gray.600" fontWeight="600"
                          textTransform="uppercase" letterSpacing="0.05em">
                          Instructions de livraison <Text as="span" fontWeight="400" textTransform="none">(optionnel)</Text>
                        </FormLabel>
                        <Input value={buyerDeliveryInstructions} onChange={(e) => setBuyerDeliveryInstructions(e.target.value)}
                          placeholder="Accès, horaires, contact sur site..." rounded="sm" fontSize="sm" />
                      </FormControl>
                    </VStack>
                  </Box>
                </VStack>
              )}
              {selectedRole === 'seller' && (
                <VStack spacing={5} w="full">
                  {step3FieldSections.map(renderDynamicSection)}

                  {/* Certifications */}
                  <FormControl>
                    <FormLabel fontSize="xs" color="gray.600" fontWeight="600"
                      textTransform="uppercase" letterSpacing="0.05em">
                      Certifications & normes qualité
                    </FormLabel>
                    <Text fontSize="11px" color="gray.400" mb={2}>
                      Renforcez la confiance des acheteurs. Cochez les certifications obtenues.
                    </Text>
                    <SimpleGrid columns={2} spacing={2}>
                      {CERTIF_OPTIONS.map(({ value, label }) => (
                        <Checkbox
                          key={value}
                          isChecked={certifications.includes(value)}
                          onChange={(e) =>
                            setCertifications(e.target.checked
                              ? [...certifications, value]
                              : certifications.filter(c => c !== value)
                            )
                          }
                          colorScheme="blue" size="sm"
                        >
                          <Text fontSize="sm" color="gray.700">{label}</Text>
                        </Checkbox>
                      ))}
                    </SimpleGrid>
                    {certifications.length > 0 && (
                      <Wrap spacing={1} mt={2}>
                        {certifications.map(c => (
                          <WrapItem key={c}>
                            <Tag size="sm" colorScheme="green" rounded="md" variant="subtle">
                              <TagLabel fontSize="10px" fontWeight="600">{c}</TagLabel>
                            </Tag>
                          </WrapItem>
                        ))}
                      </Wrap>
                    )}
                  </FormControl>

                  {/* Conformité & agréments */}
                  <FormControl>
                    <FormLabel fontSize="xs" color="gray.600" fontWeight="600"
                      textTransform="uppercase" letterSpacing="0.05em">
                      Conformité & agréments
                    </FormLabel>
                    <SimpleGrid columns={2} spacing={2}>
                      <Checkbox isChecked={sellerOnssaApproved} onChange={(e) => setSellerOnssaApproved(e.target.checked)}
                        colorScheme="blue" size="sm">
                        <Text fontSize="sm" color="gray.700">Agrément sanitaire ONSSA</Text>
                      </Checkbox>
                      <Checkbox isChecked={sellerIso22000} onChange={(e) => setSellerIso22000(e.target.checked)}
                        colorScheme="blue" size="sm">
                        <Text fontSize="sm" color="gray.700">Certification ISO 22000</Text>
                      </Checkbox>
                      <Checkbox isChecked={sellerIso9001} onChange={(e) => setSellerIso9001(e.target.checked)}
                        colorScheme="blue" size="sm">
                        <Text fontSize="sm" color="gray.700">Certification ISO 9001</Text>
                      </Checkbox>
                      <Checkbox isChecked={sellerHalalCertified} onChange={(e) => setSellerHalalCertified(e.target.checked)}
                        colorScheme="blue" size="sm">
                        <Text fontSize="sm" color="gray.700">Certification Halal</Text>
                      </Checkbox>
                      <Checkbox isChecked={sellerLotTraceability} onChange={(e) => setSellerLotTraceability(e.target.checked)}
                        colorScheme="blue" size="sm">
                        <Text fontSize="sm" color="gray.700">Traçabilité des lots</Text>
                      </Checkbox>
                    </SimpleGrid>
                    {sellerOnssaApproved && (
                      <FormControl isRequired mt={2} maxW="260px">
                        <FormLabel fontSize="xs" color="gray.600" fontWeight="600"
                          textTransform="uppercase" letterSpacing="0.05em">
                          Numéro d'agrément ONSSA
                        </FormLabel>
                        <Input value={sellerOnssaNumber} onChange={(e) => setSellerOnssaNumber(e.target.value)}
                          placeholder="Numéro d'agrément ONSSA" rounded="sm" fontSize="sm" fontFamily="mono" />
                      </FormControl>
                    )}
                    {sellerIso22000 && (
                      <FormControl mt={2} maxW="320px">
                        <FormLabel fontSize="xs" color="gray.600" fontWeight="600"
                          textTransform="uppercase" letterSpacing="0.05em">
                          Document justificatif ISO 22000 <Text as="span" fontWeight="400" textTransform="none">(PDF/image, optionnel)</Text>
                        </FormLabel>
                        <Input type="file" accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => setSellerIso22000Doc(e.target.files?.[0] ?? null)}
                          rounded="sm" fontSize="sm" p={1} />
                      </FormControl>
                    )}
                    {sellerIso9001 && (
                      <FormControl mt={2} maxW="320px">
                        <FormLabel fontSize="xs" color="gray.600" fontWeight="600"
                          textTransform="uppercase" letterSpacing="0.05em">
                          Document justificatif ISO 9001 <Text as="span" fontWeight="400" textTransform="none">(PDF/image, optionnel)</Text>
                        </FormLabel>
                        <Input type="file" accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => setSellerIso9001Doc(e.target.files?.[0] ?? null)}
                          rounded="sm" fontSize="sm" p={1} />
                      </FormControl>
                    )}
                    {sellerHalalCertified && (
                      <Input value={sellerHalalBody} onChange={(e) => setSellerHalalBody(e.target.value)}
                        placeholder="Organisme certificateur" rounded="sm" fontSize="sm" mt={2} maxW="260px" />
                    )}
                  </FormControl>

                  {/* Modes de livraison */}
                  <FormControl>
                    <FormLabel fontSize="xs" color="gray.600" fontWeight="600"
                      textTransform="uppercase" letterSpacing="0.05em">
                      Modes de livraison proposés
                    </FormLabel>
                    <SimpleGrid columns={2} spacing={2}>
                      {[
                        { value: 'seller_fleet', label: 'Flotte propre' },
                        { value: 'third_party', label: 'Transporteur tiers' },
                        { value: 'pickup', label: 'Retrait entrepôt' },
                      ].map(({ value, label }) => (
                        <Checkbox
                          key={value}
                          isChecked={deliveryMethods.includes(value)}
                          onChange={(e) =>
                            setDeliveryMethods(e.target.checked
                              ? [...deliveryMethods, value]
                              : deliveryMethods.filter(v => v !== value)
                            )
                          }
                          colorScheme="blue" size="sm"
                        >
                          <Text fontSize="sm" color="gray.700">{label}</Text>
                        </Checkbox>
                      ))}
                    </SimpleGrid>
                  </FormControl>

                  <Alert status="info" rounded="sm" fontSize="xs">
                    <AlertIcon />
                    Ces informations seront affichées sur votre boutique. Vous pourrez les compléter et les modifier à tout moment depuis votre espace vendeur.
                  </Alert>
                </VStack>
              )}
              {selectedRole === 'delivery' && (
                <VStack spacing={4} w="full" align="stretch">
                  {/* "Type de service" reste hardcodé : contrainte CHECK en
                      base + comparaisons exactes ailleurs (AdminDeliveryValidation). */}
                  <FormControl>
                    <FormLabel fontSize="xs" color="gray.600" fontWeight="600"
                      textTransform="uppercase" letterSpacing="0.05em">
                      Type de service
                    </FormLabel>
                    <Select value={deliveryType} onChange={(e) => setDeliveryType(e.target.value)}
                      rounded="sm" fontSize="sm">
                      <option value="logistics_company">Société de logistique</option>
                      <option value="independent">Indépendant</option>
                      <option value="internal_fleet">Flotte interne</option>
                    </Select>
                  </FormControl>

                  {step3FieldSections.map(renderDynamicSection)}
                </VStack>
              )}
              {selectedRole === 'commercial' && (
                <VStack spacing={4} w="full" align="stretch">
                  <Text fontSize="sm" color="gray.500" lineHeight={1.6}>
                    Recherchez le vendeur que vous représentez sur la plateforme.
                    Votre demande lui sera envoyée pour approbation.
                  </Text>
                  <FormControl>
                    <FormLabel fontSize="xs" color="gray.600" fontWeight="600"
                      textTransform="uppercase" letterSpacing="0.05em">
                      Vendeur
                    </FormLabel>
                    {selectedVendorOrgId ? (
                      <HStack bg="purple.50" rounded="md" px={3} py={2} justify="space-between">
                        <Text fontSize="sm" fontWeight="medium" color="purple.800">
                          {selectedVendorName}
                        </Text>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => { setSelectedVendorOrgId(''); setSelectedVendorName(''); }}
                        >
                          Changer
                        </Button>
                      </HStack>
                    ) : (
                      <Box position="relative">
                        <Input
                          value={vendorSearchQuery}
                          onChange={(e) => setVendorSearchQuery(e.target.value)}
                          placeholder="Rechercher un vendeur par nom..."
                          rounded="sm" fontSize="sm"
                        />
                        {vendorSearchQuery.trim().length >= 2 && (
                          <Box position="absolute" top="100%" left={0} right={0} bg="white"
                            border="1px" borderColor="gray.200" rounded="md" mt={1} zIndex={10} shadow="md">
                            {vendorSearching ? (
                              <Box p={3} textAlign="center"><Text fontSize="xs" color="gray.400">Recherche…</Text></Box>
                            ) : vendorSearchResults.length === 0 ? (
                              <Box p={3}><Text fontSize="xs" color="gray.400">Aucun vendeur trouvé.</Text></Box>
                            ) : (
                              vendorSearchResults.map((v) => (
                                <HStack
                                  key={v.id}
                                  px={3} py={2}
                                  cursor="pointer"
                                  _hover={{ bg: 'gray.50' }}
                                  onClick={() => {
                                    setSelectedVendorOrgId(v.id);
                                    setSelectedVendorName(v.name);
                                    setVendorSearchQuery('');
                                    setVendorSearchResults([]);
                                  }}
                                >
                                  <Search size={13} color="#9CA3AF" />
                                  <Text fontSize="sm">{v.name}</Text>
                                  <Text fontSize="xs" color="gray.400">
                                    {[v.city, v.country].filter(Boolean).join(', ')}
                                  </Text>
                                </HStack>
                              ))
                            )}
                          </Box>
                        )}
                      </Box>
                    )}
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="xs" color="gray.600" fontWeight="600"
                      textTransform="uppercase" letterSpacing="0.05em">
                      Message au vendeur <Text as="span" fontWeight="400" textTransform="none">(optionnel)</Text>
                    </FormLabel>
                    <Textarea
                      value={commercialMotivation}
                      onChange={(e) => setCommercialMotivation(e.target.value)}
                      placeholder="Présentez-vous brièvement au vendeur..."
                      rounded="sm" fontSize="sm" rows={3}
                    />
                  </FormControl>
                </VStack>
              )}

            </VStack>
          )}

          {/* Étape 4 — Consentement RGPD */}
          {step === 4 && (
            <VStack spacing={5}>
              <Box bg="gray.50" border="1px" borderColor="gray.200" rounded="md" p={5}>
                <Text fontWeight="700" color="gray.800" mb={2} fontSize="sm">
                  Consentement RGPD et CGV professionnelles
                </Text>
                <Text fontSize="sm" color="gray.600" lineHeight={1.7}>
                  Stock212 collecte et traite vos données personnelles et professionnelles
                  pour le fonctionnement de la plateforme B2B. Vos données ne sont jamais
                  revendues à des tiers. Vous disposez d'un droit d'accès, de rectification
                  et de suppression conformément au RGPD.
                </Text>
              </Box>
              <Checkbox
                isChecked={gdprConsent}
                onChange={(e) => setGdprConsent(e.target.checked)}
                colorScheme="blue"
                size="sm"
                alignItems="start"
              >
                <Text fontSize="sm" color="gray.700" lineHeight={1.6}>
                  J'accepte le traitement de mes données conformément à la politique de
                  confidentialité et aux Conditions Générales d'Utilisation de Stock212.
                </Text>
              </Checkbox>
              {selectedRole === 'delivery' && (
                <Alert status="info" rounded="sm" fontSize="sm">
                  <AlertIcon />
                  Votre profil transporteur sera activé après vérification de votre dossier
                  par notre équipe (délai : 48h ouvrées).
                </Alert>
              )}
            </VStack>
          )}
        </Box>

        {/* Navigation entre étapes */}
        <HStack justify="space-between" mt={7}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep((s) => s - 1)}
            isDisabled={step === 1}
            color="gray.500"
            rounded="md"
            fontSize="sm"
          >
            Retour
          </Button>
          {step < totalSteps ? (
            <Button
              colorScheme="blue"
              size="sm"
              onClick={() => setStep((s) => s + 1)}
              isDisabled={
                (step === 1 && !selectedRole) ||
                (step === 2 && missingRequiredStep2Field) ||
                (step === 3 && selectedRole === 'buyer' && !buyerDeliveryZone) ||
                (step === 3 && selectedRole === 'seller' && sellerOnssaApproved && !sellerOnssaNumber.trim()) ||
                (step === 3 && missingRequiredStep3Field)
              }
              rounded="md"
              bg="blue.800"
              _hover={{ bg: 'blue.700' }}
              fontSize="sm"
              fontWeight="600"
            >
              Continuer
            </Button>
          ) : (
            <Button
              colorScheme="blue"
              size="sm"
              onClick={handleComplete}
              isLoading={loading}
              isDisabled={!gdprConsent || (selectedRole === 'commercial' && !selectedVendorOrgId)}
              loadingText="Envoi en cours..."
              rounded="md"
              bg="blue.800"
              _hover={{ bg: 'blue.700' }}
              fontSize="sm"
              fontWeight="600"
            >
              Soumettre mon dossier
            </Button>
          )}
        </HStack>
      </Box>
    </Flex>
  );
}

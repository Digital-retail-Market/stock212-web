export type OrgType = 'buyer' | 'seller' | 'delivery';

export interface VendorDeliveryConfig {
  seller_org_id: string;
  delivery_mode: 'flat_rate' | 'free_above_threshold' | 'percentage' | 'free_always' | 'negotiated';
  flat_rate_mad: number;
  free_threshold_mad: number | null;
  percentage_rate: number | null;
  min_charge_mad: number | null;
  max_charge_mad: number | null;
}

export type AdminRole = 'superadmin' | 'moderator' | 'finance_admin' | 'support' | 'data_viewer';

export interface AdminTeamMember {
  id: string;
  user_id: string;
  role: AdminRole;
  granted_by: string | null;
  granted_at: string;
  notes: string | null;
  active: boolean;
  profiles?: { full_name: string | null; email: string | null } | null;
}
export type TeamRole =
  | 'owner'
  | 'admin_seller'
  | 'catalog_manager'
  | 'marketing_manager'
  | 'sales_rep'
  | 'delivery_coordinator'
  | 'member';

export interface Profile {
  id: string;
  full_name: string | null;
  preferred_lang: string;
  preferred_currency: string;
  gdpr_consent: boolean;
  onboarding_done: boolean;
  is_admin: boolean;
  is_agent: boolean;
  last_seen: string | null;
  created_at: string;
}

export interface Organisation {
  id: string;
  name: string;
  org_type: OrgType;
  sub_type: string | null;
  siret: string | null;
  vat_number: string | null;
  country: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postal_code: string | null;
  region: string | null;
  validation_status: 'pending' | 'active' | 'rejected';
  created_at: string;
}

export interface OrgMember {
  id: string;
  organisation_id: string;
  user_id: string;
  team_role: TeamRole;
  active: boolean;
  joined_at: string;
}

export interface BusinessCategory {
  id: string;
  actor_type: OrgType;
  name: string;
  description: string | null;
  active: boolean;
  display_order: number;
}

export interface Category {
  id: string;
  name: string;
  name_i18n: Record<string, string>;
  parent_id: string | null;
  description: string | null;
  icon: string | null;
  image_url: string | null;
  display_order: number;
  active: boolean;
}

export interface Brand {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
}

export interface ProductDimensions {
  length?: number | null;
  width?: number | null;
  height?: number | null;
  weight_net?: number | null;
  weight_brut?: number | null;
  volume?: number | null;
}

export interface NutritionalValues {
  energy_kcal?: number | null;
  energy_kj?: number | null;
  fat_g?: number | null;
  saturated_fat_g?: number | null;
  carbs_g?: number | null;
  sugars_g?: number | null;
  fiber_g?: number | null;
  protein_g?: number | null;
  salt_g?: number | null;
  net_weight_g?: number | null;
}

export type ProductDocumentType = 'datasheet' | 'certificate' | 'logistics' | 'fds' | 'other';

export interface ProductDocument {
  name: string;
  url: string;
  type: ProductDocumentType;
}

export interface ProductPalettisation {
  cartons_per_layer?: number | null;
  layers_per_palette?: number | null;
}

export interface Product {
  id: string;
  seller_org_id: string;
  name: string;
  short_description: string | null;
  long_description: string | null;
  images: string[];
  videos: string[];
  status: 'draft' | 'active' | 'inactive' | 'archived';
  category_id: string | null;
  brand_id: string | null;
  supplier_id: string | null;
  ean: string | null;
  hs_code: string | null;
  temperature: 'ambient' | 'refrigerated' | 'fresh' | 'frozen';
  shelf_life_days: number | null;
  moq: number;
  pack_size: number;
  origin_country: string | null;
  export_countries: string[];
  certifications: string[];
  allergens: string[];
  ingredients: string | null;
  nutritional_info: string | null;
  nutri_score: 'A' | 'B' | 'C' | 'D' | 'E' | null;
  dlc_type: 'DLC' | 'DDM' | null;
  nutritional_values: NutritionalValues | null;
  document_urls: ProductDocument[] | null;
  incoterms: string[];
  currency: string;
  avg_rating: number;
  review_count: number;
  is_new: boolean;
  is_on_promotion: boolean;
  is_sponsored: boolean;
  stock_qty: number | null;
  estimated_lead_days: number;
  dimensions_unit: ProductDimensions | null;
  dimensions_carton: ProductDimensions | null;
  dimensions_pallet: ProductDimensions | null;
  palettisation: ProductPalettisation | null;
  created_at: string;
  updated_at: string;
  // Section 3 — Characteristics
  net_weight: number | null;
  gross_weight: number | null;
  weight_unit: string | null;
  physical_form: 'liquid' | 'solid' | 'powder' | 'gel' | 'aerosol' | 'cream' | 'tablet' | 'other' | null;
  // Section 5 — Packaging
  packaging_type: string | null;
  packaging_material: string | null;
  units_per_inner: number | null;
  recyclable: boolean | null;
  eco_score: string | null;
  // Section 6 — Storage
  min_shelf_temp: number | null;
  max_shelf_temp: number | null;
  after_opening_days: number | null;
  fifo_required: boolean | null;
  humidity_sensitive: boolean | null;
  light_sensitive: boolean | null;
  // Section 7 — Logistics
  volume_cbm_carton: number | null;
  pallet_weight_kg: number | null;
  stackability_max: number | null;
  fragility_level: 'low' | 'medium' | 'high' | null;
  cold_chain_required: boolean | null;
  hazard_class: string | null;
  delivery_methods: string[];
  // Section 8 — Manufacturer
  manufacturer_name: string | null;
  manufacturer_country: string | null;
  production_method: 'industrial' | 'artisanal' | 'hybrid' | null;
  traceability_level: 'lot' | 'ean' | 'serial' | null;
  // Section 9 — Safety
  haccp_compliant: boolean | null;
  msds_available: boolean | null;
  // Section 10 — Distribution
  distribution_channels: string[];
  exclusive_dist: boolean | null;
  territory_allocation: string | null;
  // Section 12 — Market positioning
  target_segment: string | null;
  usp: string | null;
  value_proposition: 'price' | 'quality' | 'eco' | 'luxury' | 'professional' | null;
  // joined fields
  organisations?: Organisation;
  categories?: Category;
  brands?: Brand;
  price_tiers?: PriceTier[];
}

export interface PriceTier {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  qty_min: number;
  unit_price: number;
}

export interface CartItem {
  id: string;
  cart_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  unit_price_computed: number | null;
  promotion_id: string | null;
  lot_id?: string | null;
  preferred_delivery_method?: string | null;
  products?: Product;
}

export interface Cart {
  id: string;
  buyer_org_id: string;
  status: 'active' | 'abandoned' | 'converted';
  is_template: boolean;
  promo_code_id: string | null;
  cart_items?: CartItem[];
}

export interface OrderLine {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string | null;
  product_name_snap: string;
  quantity: number;
  unit_price_ht: number;
  line_total_ht: number;
  created_at: string;
  products?: Product;
}

export interface Order {
  id: string;
  order_number: string;
  buyer_org_id: string;
  seller_org_id: string;
  status: 'pending' | 'confirmed' | 'in_preparation' | 'shipped' | 'delivered' | 'cancelled' | 'dispute';
  total_ht: number;
  total_taxes: number;
  total_ttc: number;
  currency: string;
  payment_terms: string | null;
  payment_method: string | null;
  delivery_address: Record<string, string>;
  billing_address: Record<string, string>;
  delivery_preference: 'standard' | 'express' | 'cold_chain';
  delivery_method: 'partner_carrier' | 'stock212' | 'seller_fleet' | 'buyer_managed';
  carrier_org_id: string | null;
  notes: string | null;
  cart_id: string | null;
  delivery_fee_mad: number;
  created_at: string;
  updated_at: string;
  organisations?: Organisation;
  order_lines?: OrderLine[];
}

export interface Quote {
  id: string;
  quote_number: string;
  buyer_org_id: string;
  seller_org_id: string;
  status: 'new' | 'in_progress' | 'responded' | 'accepted' | 'refused' | 'expired' | 'converted';
  requested_at: string;
  expires_at: string | null;
  incoterm: string | null;
  notes: string | null;
  created_at: string;
  quote_lines?: QuoteLine[];
}

export interface QuoteLine {
  id: string;
  quote_id: string;
  product_id: string;
  product_description: string | null;
  quantity: number;
  requested_price: number | null;
  proposed_price: number | null;
  products?: Product;
}

export interface DeliveryTicket {
  id: string;
  ticket_number: string;
  requester_org_id: string;
  order_id: string | null;
  assigned_delivery_id: string | null;
  pickup_address: Record<string, string>;
  delivery_address: Record<string, string>;
  parcel_details: Record<string, unknown>;
  status: 'open' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
  priority: 'normal' | 'express';
  proposed_price: number | null;
  accepted_price: number | null;
  proof_url: string | null;
  created_by: string | null;
  assigned_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read: boolean;
  created_at: string;
}

export interface Promotion {
  id: string;
  seller_org_id: string;
  name: string;
  promo_type: 'percentage' | 'fixed' | 'bundle' | 'volume';
  discount_value: number;
  application: 'all_products' | 'specific_products' | 'category';
  product_ids: string[];
  category_id: string | null;
  min_qty: number;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
  stackable: boolean;
}

export interface ProductReview {
  id: string;
  product_id: string;
  buyer_org_id: string | null;
  rating: number;
  rating_delivery: number | null;
  rating_quality: number | null;
  comment: string | null;
  reviewer_name: string | null;
  verified: boolean;
  created_at: string;
}

export interface SavedAddress {
  id: string;
  organisation_id: string;
  alias: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postal_code: string | null;
  region: string | null;
  country: string;
  is_default_delivery: boolean;
  is_default_billing: boolean;
}

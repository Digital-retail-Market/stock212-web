import { supabase } from '../supabase';
import type { Product } from '../../types';

/**
 * Fetch all active products with their image URLs
 */
export async function getAllProductsWithImages(limit = 100) {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, images, organisations(name), price_tiers(*), brands(name)')
    .eq('status', 'active')
    .not('images', 'is', null)
    .limit(limit);

  if (error) throw error;
  return (data as unknown as Product[]) ?? [];
}

/**
 * Fetch products by category with images
 */
export async function getProductsByCategoryWithImages(categoryId: string, limit = 50) {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, images, category_id, organisations(name), price_tiers(*)')
    .eq('status', 'active')
    .eq('category_id', categoryId)
    .not('images', 'is', null)
    .limit(limit);

  if (error) throw error;
  return (data as unknown as Product[]) ?? [];
}

/**
 * Fetch products by seller with images
 */
export async function getProductsBySellerWithImages(sellerOrgId: string, limit = 50) {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, images, seller_org_id, organisations(name), price_tiers(*), brands(name)')
    .eq('status', 'active')
    .eq('seller_org_id', sellerOrgId)
    .not('images', 'is', null)
    .limit(limit);

  if (error) throw error;
  return (data as unknown as Product[]) ?? [];
}

/**
 * Fetch a single product with all details including images
 */
export async function getProductWithImages(productId: string) {
  const { data, error } = await supabase
    .from('products')
    .select('*, organisations(name), price_tiers(*), brands(name)')
    .eq('id', productId)
    .eq('status', 'active')
    .single();

  if (error) throw error;
  return (data as Product) ?? null;
}

/**
 * Search products by name with images
 */
export async function searchProductsWithImages(query: string, limit = 30) {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, images, organisations(name), price_tiers(*)')
    .eq('status', 'active')
    .ilike('name', `%${query}%`)
    .not('images', 'is', null)
    .limit(limit);

  if (error) throw error;
  return (data as unknown as Product[]) ?? [];
}

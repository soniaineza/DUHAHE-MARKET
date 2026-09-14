import type { CategoryId, Language, Product } from '@duhahe/shared';
import { CATEGORIES, categoryLabels } from '@duhahe/shared';
import { getProductById, products } from '../data/store';

export interface ProductQuery {
  search?: string;
  category?: CategoryId;
  lang: Language;
  organicOnly?: boolean;
  inStockOnly?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'price_asc' | 'price_desc' | 'name' | 'popularity';
}

export function listProducts(query: ProductQuery): Product[] {
  let result = [...products.values()];
  const q = query.search?.trim().toLowerCase();

  if (q) {
    result = result.filter((prod) => {
      const haystack = [
        prod.name.en,
        prod.name.kin,
        prod.name.fr,
        prod.description.en,
        prod.description.kin,
        prod.description.fr,
        prod.sku,
        prod.farmer ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }
  if (query.category) result = result.filter((prod) => prod.category === query.category);
  if (query.organicOnly) result = result.filter((prod) => prod.organic);
  if (query.inStockOnly) result = result.filter((prod) => prod.stockQty > 0);
  if (query.minPrice != null) result = result.filter((prod) => prod.price >= query.minPrice!);
  if (query.maxPrice != null) result = result.filter((prod) => prod.price <= query.maxPrice!);

  switch (query.sort) {
    case 'price_asc':
      result.sort((a, b) => a.price - b.price);
      break;
    case 'price_desc':
      result.sort((a, b) => b.price - a.price);
      break;
    case 'name': {
      const key = query.lang in { en: 1, kin: 1, fr: 1 } ? query.lang : 'en';
      result.sort((a, b) => a.name[key].localeCompare(b.name[key]));
      break;
    }
    case 'popularity':
      break;
  }
  return result;
}

export function getProduct(id: string): Product | undefined {
  return getProductById(id);
}

export function listCategories(lang: Language): { id: CategoryId; label: Record<Language, string>; count: number }[] {
  const labels = categoryLabels(lang);
  return CATEGORIES.map((c) => ({
    id: c,
    label: {
      en: categoryLabels('en')[c],
      kin: categoryLabels('kin')[c],
      fr: categoryLabels('fr')[c],
    },
    count: [...products.values()].filter((prod) => prod.category === c).length,
  }));
}
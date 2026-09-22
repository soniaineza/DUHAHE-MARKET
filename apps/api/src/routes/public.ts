import { Router } from 'express';
import type { CategoryId, Language } from '@duhahe/shared';
import { CATEGORIES } from '@duhahe/shared';
import { listCategories, listProducts, getProduct } from '../services/productService';

const allowedLangs: Language[] = ['en', 'kin', 'fr'];

export const publicRouter = Router();

publicRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'duhahe-api', time: new Date().toISOString() });
});

publicRouter.get('/categories', (req, res) => {
  const lang = (req.query.lang as Language) || 'en';
  res.json({ data: listCategories(allowedLangs.includes(lang) ? lang : 'en') });
});

publicRouter.get('/products', (req, res) => {
  const lang = ((req.query.lang as Language) ?? 'en') as Language;
  const category = req.query.category as CategoryId | undefined;
  const minPrice = req.query.minPrice === undefined ? undefined : Number(req.query.minPrice);
  const maxPrice = req.query.maxPrice === undefined ? undefined : Number(req.query.maxPrice);
  const result = listProducts({
    lang: allowedLangs.includes(lang) ? lang : 'en',
    search: typeof req.query.search === 'string' ? req.query.search : undefined,
    category: category && CATEGORIES.includes(category) ? category : undefined,
    organicOnly: req.query.organic === 'true' || undefined,
    inStockOnly: req.query.inStock === 'true' || undefined,
    minPrice: minPrice !== undefined && Number.isFinite(minPrice) ? minPrice : undefined,
    maxPrice: maxPrice !== undefined && Number.isFinite(maxPrice) ? maxPrice : undefined,
    sort:
      (req.query.sort as 'price_asc' | 'price_desc' | 'name' | 'popularity') ??
      undefined,
  });
  res.json({ data: result, count: result.length });
});

publicRouter.get('/products/:id', (req, res) => {
  const prod = getProduct(req.params.id);
  if (!prod) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  res.json({ data: prod });
});
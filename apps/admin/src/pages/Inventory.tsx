import { useEffect, useMemo, useState } from 'react';
import { api, type Product } from '../api';
import type { CategoryId } from '@duhahe/shared';
import { SearchIcon, TagIcon, TrashIcon } from '../components/Icons';
import { useAdminI18n } from '../i18n';

const catLabels: Record<CategoryId, string> = {
  staples: 'Food',
  vegetables: 'Vegetables',
  fruits: 'Fruits',
  kitchenware: 'Kitchen',
  household: 'Household',
  drinks: 'Drinks',
  personal_care: 'Personal Care',
  other: 'Other',
};

const catEmojis: Record<CategoryId, string> = {
  staples: '🌾',
  vegetables: '🥬',
  fruits: '🍍',
  kitchenware: '🍲',
  household: '🧺',
  drinks: '🥤',
  personal_care: '🧴',
  other: '🕯️',
};

export default function Inventory() {
  const { t, lang } = useAdminI18n();
  const [items, setItems] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryId | 'all'>('all');
  const [onlyLow, setOnlyLow] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newProduct, setNewProduct] = useState({ sku: '', en: '', kin: '', fr: '', category: 'staples' as CategoryId, unit: 'kg' as Product['unit'], price: '0', stockQty: '0', emoji: '🛒', organic: true });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({ en: '', kin: '', fr: '', descEn: '', descKin: '', descFr: '', category: 'staples' as CategoryId, unit: 'kg' as Product['unit'], price: '0', stockQty: '0', minOrderQty: '1', step: '1', emoji: '🛒', organic: true, farmer: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = () =>
    api.inventory()
      .then((res) => setItems(res.data))
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const categoryCounts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    items.forEach((p) => { c[p.category] = (c[p.category] ?? 0) + 1; });
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((p) => {
      if (category !== 'all' && p.category !== category) return false;
      if (onlyLow && !(p.stockQty <= 20)) return false;
      if (q) {
        const hay = [p.name.en, p.name.kin, p.name.fr, p.sku, p.farmer ?? ''].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, query, category, onlyLow]);

  const save = async (id: string, patch: { price?: number; stockQty?: number; organic?: boolean }) => {
    setSaving(id);
    setSavedId(null);
    try {
      const res = await api.updateInventory(id, patch);
      setItems((prev) => prev.map((p) => (p.id === id ? res.data : { ...p, ...patch })));
      setSavedId(id);
      setTimeout(() => setSavedId((cur) => (cur === id ? null : cur)), 1500);
    } catch (e) {
      alert(`${t('saveFailed')}: ${e instanceof Error ? e.message : e}`);
    } finally {
      setSaving(null);
    }
  };

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    setAdding(true);
    try {
      await api.addInventory({
        sku: newProduct.sku,
        name: { en: newProduct.en, kin: newProduct.kin, fr: newProduct.fr },
        description: { en: newProduct.en, kin: newProduct.kin, fr: newProduct.fr },
        category: newProduct.category,
        unit: newProduct.unit,
        price: Number(newProduct.price),
        stockQty: Number(newProduct.stockQty),
        minOrderQty: newProduct.unit === 'kg' ? 0.5 : 1,
        step: newProduct.unit === 'kg' ? 0.5 : 1,
        emoji: newProduct.emoji,
        organic: newProduct.organic,
      });
      setNewProduct({ sku: '', en: '', kin: '', fr: '', category: 'staples', unit: 'kg', price: '0', stockQty: '0', emoji: '🛒', organic: true });
      setShowAdd(false);
      await load();
    } catch (e) {
      alert(`${t('saveFailed')}: ${e instanceof Error ? e.message : e}`);
    } finally {
      setAdding(false);
    }
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setEditForm({
      en: p.name.en,
      kin: p.name.kin,
      fr: p.name.fr,
      descEn: p.description.en,
      descKin: p.description.kin,
      descFr: p.description.fr,
      category: p.category,
      unit: p.unit,
      price: String(p.price),
      stockQty: String(p.stockQty),
      minOrderQty: String(p.minOrderQty),
      step: String(p.step),
      emoji: p.emoji,
      organic: p.organic,
      farmer: p.farmer ?? '',
    });
  };

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setSavingEdit(true);
    try {
      const res = await api.updateInventory(editing.id, {
        name: { en: editForm.en.trim(), kin: editForm.kin.trim(), fr: editForm.fr.trim() },
        description: { en: editForm.descEn.trim(), kin: editForm.descKin.trim(), fr: editForm.descFr.trim() },
        category: editForm.category,
        unit: editForm.unit,
        price: Number(editForm.price),
        stockQty: Number(editForm.stockQty),
        minOrderQty: Number(editForm.minOrderQty),
        step: Number(editForm.step),
        emoji: editForm.emoji.trim() || '🛒',
        organic: editForm.organic,
        farmer: editForm.farmer.trim(),
      });
      setItems((prev) => prev.map((p) => (p.id === editing.id ? res.data : p)));
      setEditing(null);
    } catch (e) {
      alert(`${t('saveFailed')}: ${e instanceof Error ? e.message : e}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const removeProduct = async () => {
    if (!confirmDelete || deleting) return;
    setDeleting(true);
    try {
      await api.deleteInventory(confirmDelete);
      setItems((prev) => prev.filter((p) => p.id !== confirmDelete));
      setConfirmDelete(null);
    } catch (e) {
      alert(`${t('saveFailed')}: ${e instanceof Error ? e.message : e}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-8 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">{t('inventory')}</h1>
          <p className="text-sm text-muted mt-0.5">{items.length} {t('products')} · {items.filter((p) => p.stockQty <= 0).length} {t('outOfStock')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAdd((value) => !value)} className="btn-primary">+ {t('addProduct', 'Add product')}</button>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-faint">
            <SearchIcon size={16} />
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchProducts')}
            className="w-64 rounded-xl border border-line bg-white pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-leaf-500"
          />
        </div>
        </div>
      </div>

      {showAdd && (
        <form onSubmit={add} className="card p-5 grid gap-3 md:grid-cols-3">
          <h2 className="md:col-span-3 font-bold text-soft">{t('addProduct', 'Add product')}</h2>
          {(['en', 'kin', 'fr'] as const).map((key) => (
            <input key={key} required value={newProduct[key]} onChange={(e) => setNewProduct((p) => ({ ...p, [key]: e.target.value }))} placeholder={`${t('name')} (${key})`} className="rounded-xl border border-line px-3 py-2.5 text-sm" />
          ))}
          <input required value={newProduct.sku} onChange={(e) => setNewProduct((p) => ({ ...p, sku: e.target.value }))} placeholder="SKU" className="rounded-xl border border-line px-3 py-2.5 text-sm" />
          <select value={newProduct.category} onChange={(e) => setNewProduct((p) => ({ ...p, category: e.target.value as CategoryId }))} className="rounded-xl border border-line px-3 py-2.5 text-sm">
            {(Object.keys(catLabels) as CategoryId[]).map((key) => <option key={key} value={key}>{t(`categories.${key}`, catLabels[key])}</option>)}
          </select>
          <select value={newProduct.unit} onChange={(e) => setNewProduct((p) => ({ ...p, unit: e.target.value as Product['unit'] }))} className="rounded-xl border border-line px-3 py-2.5 text-sm">
            {(['kg', 'piece', 'bundle', 'pack', 'dozen', 'liter', 'box', 'bottle', 'can', 'bag', 'pair'] as Product['unit'][]).map((unit) => <option key={unit} value={unit}>{unit}</option>)}
          </select>
          <input required type="number" min="0" step="0.01" value={newProduct.price} onChange={(e) => setNewProduct((p) => ({ ...p, price: e.target.value }))} placeholder={`${t('total')} (RWF)`} className="rounded-xl border border-line px-3 py-2.5 text-sm" />
          <input required type="number" min="0" step="0.5" value={newProduct.stockQty} onChange={(e) => setNewProduct((p) => ({ ...p, stockQty: e.target.value }))} placeholder={`${t('inStock')} quantity`} className="rounded-xl border border-line px-3 py-2.5 text-sm" />
          <input value={newProduct.emoji} onChange={(e) => setNewProduct((p) => ({ ...p, emoji: e.target.value }))} placeholder="Emoji" className="rounded-xl border border-line px-3 py-2.5 text-sm" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newProduct.organic} onChange={(e) => setNewProduct((p) => ({ ...p, organic: e.target.checked }))} /> Organic</label>
          <div className="md:col-span-3 flex justify-end gap-2"><button type="button" onClick={() => setShowAdd(false)} className="btn-ghost">{t('common.cancel', 'Cancel')}</button><button type="submit" disabled={adding} className="btn-primary">{adding ? t('saving') : t('common.save', 'Save')}</button></div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {(['all', ...(Object.keys(catLabels) as CategoryId[])] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
              category === c ? 'bg-leaf-600 text-white shadow' : 'bg-white border border-line text-muted hover:bg-leaf-50'
            }`}
          >
            {c === 'all' ? t('common.all', 'All') : `${catEmojis[c]} ${t(`categories.${c}`, catLabels[c])}`}
            <span className={`text-[11px] font-bold rounded-full px-1.5 ${category === c ? 'bg-white/20' : 'bg-leaf-50 text-leaf-700'}`}>
              {categoryCounts[c] ?? 0}
            </span>
          </button>
        ))}
        <label className="ml-2 inline-flex items-center gap-2 text-sm text-muted cursor-pointer">
          <span
            role="checkbox"
            aria-checked={onlyLow}
            onClick={() => setOnlyLow((v) => !v)}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${onlyLow ? 'bg-harvest-400' : 'bg-gray-200'}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition ${onlyLow ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
          </span>
          {t('lowStockOnly')}
        </label>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((p) => {
          const oos = p.stockQty <= 0;
          const low = !oos && p.stockQty <= 20;
          return (
            <div key={p.id} className="card p-4 flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-leaf-50 text-2xl">
                {p.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold text-sm truncate">{p.name[lang]}</div>
                  <span className="text-[10px] font-mono text-faint bg-leaf-50 rounded px-1.5 py-0.5">{p.sku}</span>
                </div>
                <div className="text-xs text-faint truncate">
                  {p.name.kin} · {catLabels[p.category]}
                </div>

                <div className="mt-3 flex items-end gap-3">
                  <label className="flex-1 text-[11px] text-muted font-semibold">
                    {t('total')} (RWF)
                    <input
                      type="number"
                      min={0}
                      defaultValue={p.price}
                      key={`price-${p.id}-${p.price}`}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== p.price) save(p.id, { price: v });
                      }}
                      className="mt-1 w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-leaf-500"
                    />
                  </label>
                  <label className="flex-1 text-[11px] text-muted font-semibold">
                    Stock ({p.unit})
                    <input
                      type="number"
                      min={0}
                      defaultValue={p.stockQty}
                      key={`stock-${p.id}-${p.stockQty}`}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== p.stockQty) save(p.id, { stockQty: v });
                      }}
                      className="mt-1 w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-leaf-500"
                    />
                  </label>
                </div>

                <div className="mt-2.5 flex items-center justify-between">
                  <div className={`text-xs font-bold ${oos ? 'text-red-600' : low ? 'text-harvest-500' : 'text-ink'}`}>
                    {oos ? t('common.outOfStock', 'Out of stock') : low ? `Low · ${p.stockQty} ${p.unit}` : `${t('common.inStock', 'In stock')} · ${p.stockQty} ${p.unit}`}
                  </div>
                  <button
                    onClick={() => save(p.id, { stockQty: oos ? 50 : 0 })}
                    className={`text-xs font-bold rounded-full px-3 py-1.5 transition ${
                      oos ? 'bg-leaf-600 text-white hover:bg-leaf-700' : 'bg-gray-100 text-muted hover:bg-red-50 hover:text-red-600'
                    }`}
                  >
                    {oos ? 'Restock' : 'Mark out'}
                  </button>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => openEdit(p)}
                    className="flex-1 text-xs font-bold rounded-full border border-line px-3 py-1.5 text-muted hover:bg-leaf-50 hover:text-leaf-700 hover:border-leaf-200 transition"
                  >
                    ✎ {t('editProduct')}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(p.id)}
                    title={t('deleteProduct')}
                    className="inline-flex items-center justify-center rounded-full border border-line px-2.5 py-1.5 text-muted hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition"
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>

                <div className="h-4 mt-1">
                  {saving === p.id && <span className="text-[11px] text-leaf-600 font-semibold animate-pulse">{t('saving')}</span>}
                  {savedId === p.id && saving !== p.id && <span className="text-[11px] text-ink font-semibold">✓ {t('saved')}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <div className="card py-12 text-center text-muted text-sm flex flex-col items-center gap-2">
          <TagIcon className="text-faint" size={24} />
          {t('noProducts')}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-6 overflow-y-auto" onClick={() => setEditing(null)}>
          <form className="card w-full max-w-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()} onSubmit={saveEdit}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-bold text-soft">{t('editProduct')}</h2>
              <span className="text-[10px] font-mono text-faint bg-leaf-50 rounded px-1.5 py-0.5">{editing.sku}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {(['en', 'kin', 'fr'] as const).map((key) => (
                <div key={key}>
                  <label className="block text-[11px] text-muted font-semibold mb-1">{t('name')} ({key})</label>
                  <input required value={editForm[key]} onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))} className="w-full rounded-xl border border-line px-3 py-2.5 text-sm" />
                </div>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {(['en', 'kin', 'fr'] as const).map((key) => (
                <div key={key}>
                  <label className="block text-[11px] text-muted font-semibold mb-1">{t('descriptions')} ({key})</label>
                  <input value={editForm[`desc${key.charAt(0).toUpperCase()}${key.slice(1)}` as 'descEn' | 'descKin' | 'descFr']} onChange={(e) => { const k = `desc${key.charAt(0).toUpperCase()}${key.slice(1)}` as 'descEn' | 'descKin' | 'descFr'; setEditForm((f) => ({ ...f, [k]: e.target.value })); }} className="w-full rounded-xl border border-line px-3 py-2.5 text-sm" />
                </div>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <label className="block text-[11px] text-muted font-semibold mb-1">{t('categories.', 'Category')}</label>
                <select value={editForm.category} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value as CategoryId }))} className="w-full rounded-xl border border-line px-3 py-2.5 text-sm bg-white">
                  {(Object.keys(catLabels) as CategoryId[]).map((key) => <option key={key} value={key}>{t(`categories.${key}`, catLabels[key])}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-muted font-semibold mb-1">{t('unit.', 'Unit')}</label>
                <select value={editForm.unit} onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value as Product['unit'] }))} className="w-full rounded-xl border border-line px-3 py-2.5 text-sm bg-white">
                  {(['kg', 'piece', 'bundle', 'pack', 'dozen', 'liter', 'box', 'bottle', 'can', 'bag', 'pair'] as Product['unit'][]).map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-muted font-semibold mb-1">{t('total')} (RWF)</label>
                <input required type="number" min="0" step="0.01" value={editForm.price} onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))} className="w-full rounded-xl border border-line px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="block text-[11px] text-muted font-semibold mb-1">Stock</label>
                <input required type="number" min="0" step="0.5" value={editForm.stockQty} onChange={(e) => setEditForm((f) => ({ ...f, stockQty: e.target.value }))} className="w-full rounded-xl border border-line px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="block text-[11px] text-muted font-semibold mb-1">{t('minOrder')}</label>
                <input required type="number" min="0.01" step="0.01" value={editForm.minOrderQty} onChange={(e) => setEditForm((f) => ({ ...f, minOrderQty: e.target.value }))} className="w-full rounded-xl border border-line px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="block text-[11px] text-muted font-semibold mb-1">{t('stepLabel')}</label>
                <input required type="number" min="0.01" step="0.01" value={editForm.step} onChange={(e) => setEditForm((f) => ({ ...f, step: e.target.value }))} className="w-full rounded-xl border border-line px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="block text-[11px] text-muted font-semibold mb-1">{t('emojiLabel')}</label>
                <input value={editForm.emoji} onChange={(e) => setEditForm((f) => ({ ...f, emoji: e.target.value }))} className="w-full rounded-xl border border-line px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="block text-[11px] text-muted font-semibold mb-1">{t('farmerLabel')}</label>
                <input value={editForm.farmer} onChange={(e) => setEditForm((f) => ({ ...f, farmer: e.target.value }))} placeholder="—" className="w-full rounded-xl border border-line px-3 py-2.5 text-sm" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={editForm.organic} onChange={(e) => setEditForm((f) => ({ ...f, organic: e.target.checked }))} />
              {t('organicLabel')}
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="btn-ghost">{t('cancel')}</button>
              <button type="submit" disabled={savingEdit} className="btn-primary">{savingEdit ? t('saving') : t('common.save', 'Save')}</button>
            </div>
          </form>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={() => setConfirmDelete(null)}>
          <div className="card w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-soft">{t('deleteProduct')}</h2>
            <p className="text-sm text-muted">{t('confirmDelete')}</p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(null)}>{t('cancel')}</button>
              <button type="button" onClick={removeProduct} disabled={deleting} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 transition disabled:opacity-60">
                {deleting ? t('saving') : t('deleteThis')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
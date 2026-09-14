import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Language } from '@duhahe/shared';
import { translations } from '@duhahe/shared';

const adminTranslations: Record<Language, Record<string, string>> = {
  en: {
    dashboard: 'Dashboard', orders: 'Orders', inventory: 'Price & Stock', welcome: 'Welcome back',
    signInHelp: 'Sign in to the Duhahe owner & staff dashboard.', email: 'Email', password: 'Password',
    demo: 'Demo', credentials: 'Credentials are pre-filled.', changeCredentials: 'Change credentials in the API environment.',
    fastDelivery: 'Fast delivery', fromAnywhere: 'from anywhere.', runMarket: 'Run your market',
    ordersLive: 'Orders live', statusPayments: 'status & payments', pricesStock: 'Prices & stock', updateInstantly: 'update instantly',
    farmFresh: 'Farm fresh', products: 'products', apiConnected: 'API connected', signOut: 'Sign out',
    ordersToday: 'Orders today', totalRevenue: 'Total revenue', pendingToShip: 'Pending to ship', avgOrder: 'Average order value',
    activeCustomers: 'active customers', lastSeven: 'Orders - last 7 days', volumeDay: 'Volume per day', orderCount: 'orders',
    byStatus: 'Orders by status', revenueCategory: 'Revenue by category', topProducts: 'Top products', sold: 'sold',
    all: 'All', lowStockOnly: 'Low stock only', searchProducts: 'Search products...', saveFailed: 'Save failed', saving: 'Saving...', saved: 'Saved',
    outOfStock: 'Out of stock', inStock: 'In stock', restock: 'Restock', markOut: 'Mark out', noProducts: 'No products match.',
    updateStatus: 'Update status', delivered: 'Delivered', items: 'Items', deliveryFee: 'Delivery fee', total: 'Total',
    customer: 'Customer', name: 'Name', phone: 'Phone', province: 'Province', district: 'District', address: 'Address',
    tracking: 'Tracking history', quickActions: 'Quick actions', cancelOrder: 'Cancel order', callCustomer: 'Call customer',
    backOrders: 'Back to orders', payment: 'Payment', note: 'Note', history: 'History', viewDetails: 'View full details',
    awaitingPayment: 'Awaiting payment', movePacking: 'Move to Packing', moveTransit: 'Move to In Transit', markDelivered: 'Mark Delivered',
    noOrders: 'No orders in this view.', language: 'Language', storeLive: 'Store is live', today: 'today', pendingPacking: 'pending + packing',
    failedStats: 'Failed to load stats', failedOrders: 'Failed to load orders', failedOrder: 'Failed to load order', failedUpdate: 'Failed to update order',
    searchOrders: 'Search by name, phone, order #', pendingAction: 'pending action', paymentLabel: 'Payment', placed: 'Placed', statusLabel: 'Status', addProduct: 'Add product',
  },
  kin: {
    dashboard: 'Ikibaho', orders: 'Amabwiriza', inventory: 'Ibiciro n’Ububiko', welcome: 'Murakaza neza', signInHelp: 'Injira ku kibaho cya nyiri Duhahe n’abakozi.', email: 'Imeri', password: 'Ijambobanga',
    demo: 'Igerageza', credentials: 'Amakuru yo kwinjira yuzuye.', changeCredentials: 'Hindura amakuru muri API.', fastDelivery: 'Kugeza vuba', fromAnywhere: 'ahantu hose.', runMarket: 'Koresha isoko ryawe', ordersLive: 'Amabwiriza ariho', statusPayments: 'imiterere n’ubwishyu', pricesStock: 'Ibiciro n’ububiko', updateInstantly: 'hindura ako kanya', farmFresh: 'Bishya ku bahinzi', products: 'ibicuruzwa', apiConnected: 'API ihujwe', signOut: 'Sohoka',
    ordersToday: 'Amabwiriza y’uyu munsi', totalRevenue: 'Amafaranga yose', pendingToShip: 'Bitegereje koherezwa', avgOrder: 'Impuzandengo y’itegeko', activeCustomers: 'abakiriya bakora', lastSeven: 'Amabwiriza - iminsi 7 ishize', volumeDay: 'Umubare ku munsi', orderCount: 'amabwiriza', byStatus: 'Amabwiriza hakurikijwe imiterere', revenueCategory: 'Amafaranga hakurikijwe itsinda', topProducts: 'Ibicuruzwa bikunzwe', sold: 'byagurishijwe', all: 'Byose', lowStockOnly: 'Ububiko buke gusa', searchProducts: 'Shakisha ibicuruzwa...', saveFailed: 'Kubika byanze', saving: 'Birabikwa...', saved: 'Byabitswe', outOfStock: 'Nta bubiko', inStock: 'Birahari', restock: 'Ongera ububiko', markOut: 'Shyira hanze', noProducts: 'Nta bicuruzwa bihuye.', updateStatus: 'Hindura imiterere', delivered: 'Byagejejwe', items: 'Ibintu', deliveryFee: 'Amafaranga yo kugeza', total: 'Igiteranyo', customer: 'Umukiriya', name: 'Amazina', phone: 'Telefoni', province: 'Intara', district: 'Akarere', address: 'Aderesi', tracking: 'Amateka yo gukurikirana', quickActions: 'Ibikorwa byihuse', cancelOrder: 'Hagarika itegeko', callCustomer: 'Hamagara umukiriya', backOrders: 'Subira ku mabwiriza', payment: 'Ubwishyu', note: 'Icyitonderwa', history: 'Amateka', viewDetails: 'Reba ibisobanuro byose', awaitingPayment: 'Bitegereje ubwishyu', movePacking: 'Jyana mu gupakira', moveTransit: 'Jyana mu nzira', markDelivered: 'Shyira ko byagejejwe', noOrders: 'Nta mabwiriza ari muri ibi bigaragara.', language: 'Ururimi', storeLive: 'Isoko rirakora', today: 'uyu munsi', pendingPacking: 'bitegereje + bipakiwe', failedStats: 'Kubona imibare byanze', failedOrders: 'Kubona amabwiriza byanze', failedOrder: 'Kubona ibwira byanze', failedUpdate: 'Guhindura itegeko byanze', searchOrders: 'Shakisha ku izina, telefoni, nimero y’itegeko', pendingAction: 'bitegereje igikorwa', paymentLabel: 'Ubwishyu', placed: 'Byashyizweho', statusLabel: 'Imiterere', addProduct: 'Ongeramo igicuruzwa',
  },
  fr: {
    dashboard: 'Tableau de bord', orders: 'Commandes', inventory: 'Prix et stock', welcome: 'Bon retour', signInHelp: 'Connectez-vous au tableau de bord du propriétaire et du personnel Duhahe.', email: 'E-mail', password: 'Mot de passe', demo: 'Démo', credentials: 'Les identifiants sont préremplis.', changeCredentials: 'Modifiez-les dans l’environnement API.', fastDelivery: 'Livraison rapide', fromAnywhere: 'de partout.', runMarket: 'Gérez votre marché', ordersLive: 'Commandes en direct', statusPayments: 'statuts et paiements', pricesStock: 'Prix et stock', updateInstantly: 'mise à jour instantanée', farmFresh: 'Frais des fermes', products: 'produits', apiConnected: 'API connectée', signOut: 'Se déconnecter',
    ordersToday: 'Commandes du jour', totalRevenue: 'Chiffre d’affaires total', pendingToShip: 'À expédier', avgOrder: 'Valeur moyenne', activeCustomers: 'clients actifs', lastSeven: 'Commandes - 7 derniers jours', volumeDay: 'Volume par jour', orderCount: 'commandes', byStatus: 'Commandes par statut', revenueCategory: 'Revenus par catégorie', topProducts: 'Meilleurs produits', sold: 'vendus', all: 'Tous', lowStockOnly: 'Stock faible uniquement', searchProducts: 'Rechercher des produits...', saveFailed: 'Échec de l’enregistrement', saving: 'Enregistrement...', saved: 'Enregistré', outOfStock: 'Rupture de stock', inStock: 'En stock', restock: 'Réapprovisionner', markOut: 'Mettre en rupture', noProducts: 'Aucun produit ne correspond.', updateStatus: 'Modifier le statut', delivered: 'Livrée', items: 'Articles', deliveryFee: 'Frais de livraison', total: 'Total', customer: 'Client', name: 'Nom', phone: 'Téléphone', province: 'Province', district: 'District', address: 'Adresse', tracking: 'Historique du suivi', quickActions: 'Actions rapides', cancelOrder: 'Annuler la commande', callCustomer: 'Appeler le client', backOrders: 'Retour aux commandes', payment: 'Paiement', note: 'Note', history: 'Historique', viewDetails: 'Voir tous les détails', awaitingPayment: 'Paiement en attente', movePacking: 'Passer à l’emballage', moveTransit: 'Passer en livraison', markDelivered: 'Marquer livrée', noOrders: 'Aucune commande dans cette vue.', language: 'Langue', storeLive: 'Marché actif', today: 'aujourd’hui', pendingPacking: 'en attente + emballage', failedStats: 'Échec du chargement des statistiques', failedOrders: 'Échec du chargement des commandes', failedOrder: 'Échec du chargement de la commande', failedUpdate: 'Échec de la mise à jour', searchOrders: 'Rechercher par nom, téléphone, commande #', pendingAction: 'action en attente', paymentLabel: 'Paiement', placed: 'Passée', statusLabel: 'Statut', addProduct: 'Ajouter un produit',
  },
};

const STORAGE_KEY = 'duhahe_admin_lang';
type Translate = (key: string, fallback?: string) => string;
interface I18nState { lang: Language; setLang: (lang: Language) => void; t: Translate }
const I18nContext = createContext<I18nState | null>(null);

function readLanguage(): Language {
  const value = localStorage.getItem(STORAGE_KEY);
  return value === 'kin' || value === 'fr' ? value : 'en';
}

function lookup(lang: Language, key: string): string | undefined {
  const value = key.split('.').reduce<unknown>((current, part) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[part];
  }, translations[lang]);
  return typeof value === 'string' ? value : undefined;
}

export function AdminI18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(readLanguage);
  const value = useMemo<I18nState>(() => ({
    lang,
    setLang: (next) => { setLangState(next); localStorage.setItem(STORAGE_KEY, next); },
    t: (key, fallback = key) => adminTranslations[lang][key] ?? lookup(lang, key) ?? fallback,
  }), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useAdminI18n(): I18nState {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useAdminI18n must be used within AdminI18nProvider');
  return value;
}

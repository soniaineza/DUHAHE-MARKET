import type { CategoryId, Product, Unit } from './types';

interface SeedItem {
  id: string;
  sku: string;
  category: CategoryId;
  name: [string, string, string]; // en, kin, fr
  price: number;
  unit: Unit;
  stockQty: number;
  minOrderQty: number;
  step: number;
  emoji?: string;
  organic?: boolean;
  farmer?: string;
  desc?: [string, string, string];
}

const baseDesc: Record<CategoryId, [string, string, string]> = {
  staples:
    ['Fresh locally sourced food staple, packed daily.', 'Ibiribwa bishya biva ahantu, bipakingwa buri munsi.', 'Produit de base frais d’origine locale, emballé quotidiennement.'],
  vegetables:
    ['Fresh vegetables harvested in the morning, delivered the same day.', 'Imboga zihingwa mu gitondo, bigeze ku munsi umwe.', 'Légumes frais récoltés le matin, livrés le jour même.'],
  fruits:
    ['Ripe fresh fruits picked at peak season.', 'Imbuto nziza zisaruwe mu gihe cyacyo.', 'Fruits frais cueillis à pleine maturité.'],
  kitchenware:
    ['Durable kitchen essentials for every Rwandan home.', 'Ibikoresho by’igikoni bihamye kuri buri rugo.', 'Essentiels de cuisine durables pour chaque foyer rwandais.'],
  household:
    ['Home essentials to keep your household running smoothly.', 'Ibikoresho byo mu rugo byemeza ubuzima bworoshye.', 'Essentiels de maison pour un foyer bien organisé.'],
  drinks:
    ['Refreshments and drinks for every moment of the day.', 'Ibyo kunywa ku mwanya wose w’umunsi.', 'Boissons pour chaque moment de la journée.'],
  personal_care:
    ['Personal care essentials for the whole family.', 'Ibikoresho byo kwita ku mubiri ku muryango wose.', 'Soins personnels essentiels pour toute la famille.'],
  other:
    ['Everyday essentials from around the house.', 'Ibintu by’ibanze bya buri munsi mu rugo.', 'Essentiels du quotidien pour la maison.'],
};

function p(i: SeedItem): Product {
  const isWeight = i.unit === 'kg';
  return {
    id: i.id,
    sku: i.sku,
    category: i.category,
    name: { en: i.name[0], kin: i.name[1], fr: i.name[2] },
    description: {
      en: i.desc?.[0] ?? baseDesc[i.category][0],
      kin: i.desc?.[1] ?? baseDesc[i.category][1],
      fr: i.desc?.[2] ?? baseDesc[i.category][2],
    },
    price: i.price,
    unit: i.unit,
    stockQty: i.stockQty,
    minOrderQty: isWeight ? Math.min(i.minOrderQty, 0.5) : i.minOrderQty,
    step: isWeight ? Math.min(i.step, 0.5) : i.step,
    emoji: i.emoji ?? '🛒',
    organic: i.organic ?? true,
    farmer: i.farmer,
  };
}

// ---------------------------------------------------------------------------
// STAPLES (50) — Duhahe master spec list A
// ---------------------------------------------------------------------------
const staples: SeedItem[] = [
  { id: 's001', sku: 'STP-001', category: 'staples', name: ['Local rice', 'Umuceri', 'Riz local'], price: 1600, unit: 'kg', stockQty: 500, minOrderQty: 1, step: 1, emoji: '🍚', farmer: 'Kamonyi Cooperative' },
  { id: 's002', sku: 'STP-002', category: 'staples', name: ['Imported rice (Meheba)', 'Umuceri wa Meheba', 'Riz importé (Meheba)'], price: 1900, unit: 'kg', stockQty: 400, minOrderQty: 1, step: 1, emoji: '🍚', organic: false, farmer: 'Deco Group' },
  { id: 's004', sku: 'STP-004', category: 'staples', name: ['Maize flour', 'Ifu y’ibigori', 'Farine de maïs'], price: 950, unit: 'kg', stockQty: 600, minOrderQty: 1, step: 1, emoji: '🌾', farmer: 'Inyange Industries' },
  { id: 's005', sku: 'STP-005', category: 'staples', name: ['Corn meal (Akawunga)', 'Ubusima', 'Farine de maïs (Akawunga)'], price: 1100, unit: 'kg', stockQty: 600, minOrderQty: 1, step: 1, emoji: '🌾' },
  { id: 's008', sku: 'STP-008', category: 'staples', name: ['Wheat flour', 'Farine', 'Farine de blé'], price: 1250, unit: 'kg', stockQty: 400, minOrderQty: 1, step: 1, emoji: '🍞' },
  { id: 's010', sku: 'STP-010', category: 'staples', name: ['Rolled oats', 'Avena', 'Avoine'], price: 2000, unit: 'kg', stockQty: 200, minOrderQty: 1, step: 0.5, emoji: '🥣', organic: false },
  { id: 's012', sku: 'STP-012', category: 'staples', name: ['Black beans', 'Ibishyimbo byirabura', 'Haricots noirs'], price: 1500, unit: 'kg', stockQty: 700, minOrderQty: 1, step: 0.5, emoji: '🫘' },
  { id: 's013', sku: 'STP-013', category: 'staples', name: ['White beans', 'Ibishyimbo byera', 'Haricots blancs'], price: 1450, unit: 'kg', stockQty: 600, minOrderQty: 1, step: 0.5, emoji: '🫘' },
  { id: 's014', sku: 'STP-014', category: 'staples', name: ['Red beans', 'Ibishyimbo bitukura', 'Haricots rouges'], price: 1500, unit: 'kg', stockQty: 650, minOrderQty: 1, step: 0.5, emoji: '🫘' },
  { id: 's016', sku: 'STP-016', category: 'staples', name: ['Dried whole peas', 'Amashaza', 'Pois secs entiers'], price: 1200, unit: 'kg', stockQty: 400, minOrderQty: 1, step: 0.5, emoji: '🟢' },
  { id: 's018', sku: 'STP-018', category: 'staples', name: ['Soybeans', 'Amasoya', 'Soja'], price: 1100, unit: 'kg', stockQty: 350, minOrderQty: 1, step: 0.5, emoji: '🫘' },
  { id: 's019', sku: 'STP-019', category: 'staples', name: ['Lentils', 'Imijumbura', 'Lentilles'], price: 1600, unit: 'kg', stockQty: 250, minOrderQty: 0.5, step: 0.5, emoji: '🫘' },
  { id: 's021', sku: 'STP-021', category: 'staples', name: ['Raw groundnuts', 'Amabiyeyi', 'Arachides crues'], price: 1800, unit: 'kg', stockQty: 400, minOrderQty: 0.5, step: 0.5, emoji: '🥜', farmer: 'Huye Groundnut Coop' },
  { id: 's024', sku: 'STP-024', category: 'staples', name: ['Irish potatoes', 'Ibirayi', 'Pommes de terre'], price: 900, unit: 'kg', stockQty: 1500, minOrderQty: 1, step: 1, emoji: '🥔', farmer: 'Kigali Mixte Potatoes' },
  { id: 's025', sku: 'STP-025', category: 'staples', name: ['Sweet potatoes', 'Ibijumba', 'Patates douces'], price: 700, unit: 'kg', stockQty: 1200, minOrderQty: 1, step: 1, emoji: '🍠', farmer: 'Bugesera Roots Coop' },
  { id: 's026', sku: 'STP-026', category: 'staples', name: ['Cassava roots', 'Imihogo', 'Manioc'], price: 600, unit: 'kg', stockQty: 1000, minOrderQty: 1, step: 1, emoji: '🥔' },
  { id: 's030', sku: 'STP-030', category: 'staples', name: ['White sugar', 'Isukari y’umweru', 'Sucre blanc'], price: 1600, unit: 'kg', stockQty: 800, minOrderQty: 1, step: 1, emoji: '🍬' },
  { id: 's031', sku: 'STP-031', category: 'staples', name: ['Sunflower oil 1L', 'Amavuta ya sunflower 1L', 'Huile de tournesol 1L'], price: 3500, unit: 'liter', stockQty: 500, minOrderQty: 1, step: 1, emoji: '🛢️', organic: false },
  { id: 's032', sku: 'STP-032', category: 'staples', name: ['Salt', 'Umunyu', 'Sel'], price: 500, unit: 'kg', stockQty: 600, minOrderQty: 0.5, step: 0.5, emoji: '🧂' },
  { id: 's033', sku: 'STP-033', category: 'staples', name: ['Black tea leaves', 'Icyayi', 'Thé en feuilles'], price: 1500, unit: 'pack', stockQty: 350, minOrderQty: 1, step: 1, emoji: '🍵', farmer: 'Sorwathe Tea' },
  { id: 's034', sku: 'STP-034', category: 'staples', name: ['Coffee beans', 'Ikawa', 'Grains de café'], price: 4500, unit: 'kg', stockQty: 200, minOrderQty: 0.5, step: 0.5, emoji: '☕', farmer: 'RWACOF' },
  { id: 's036', sku: 'STP-036', category: 'staples', name: ['Eggs (dozen)', 'Amagi (igana)', 'Œufs (douzaine)'], price: 2600, unit: 'dozen', stockQty: 500, minOrderQty: 1, step: 1, emoji: '🥚', farmer: 'Mukamira Poultry' },
  { id: 's037', sku: 'STP-037', category: 'staples', name: ['Margarine 500g', 'Margarine 500g', 'Margarine 500g'], price: 2800, unit: 'pack', stockQty: 250, minOrderQty: 1, step: 1, emoji: '🧈', organic: false },
  { id: 's040', sku: 'STP-040', category: 'staples', name: ['Black pepper', 'Urusenda rwirabura', 'Poivre noir'], price: 2500, unit: 'pack', stockQty: 200, minOrderQty: 1, step: 1, emoji: '🫙' },
  { id: 's043', sku: 'STP-043', category: 'staples', name: ['Dried chili', 'Urusenda rwumye', 'Piment séché'], price: 1500, unit: 'pack', stockQty: 250, minOrderQty: 1, step: 1, emoji: '🌶️' },
  { id: 's044', sku: 'STP-044', category: 'staples', name: ['Spaghetti 500g', 'Spaghetti 500g', 'Spaghetti 500g'], price: 900, unit: 'pack', stockQty: 450, minOrderQty: 1, step: 1, emoji: '🍝', organic: false },
  { id: 's045', sku: 'STP-045', category: 'staples', name: ['Macaroni 500g', 'Macaroni 500g', 'Macaroni 500g'], price: 900, unit: 'pack', stockQty: 400, minOrderQty: 1, step: 1, emoji: '🍝', organic: false },
  { id: 's047', sku: 'STP-047', category: 'staples', name: ['Biscuits (big pack)', 'Birisimi (ipaki)', 'Biscuits (grand paquet)'], price: 1800, unit: 'pack', stockQty: 350, minOrderQty: 1, step: 1, emoji: '🍪', organic: false },
  { id: 's051', sku: 'STP-051', category: 'staples', name: ['Brown sugar', 'Isukari y’ikigina', 'Sucre brun'], price: 1700, unit: 'kg', stockQty: 500, minOrderQty: 1, step: 1, emoji: '🍬' },
  { id: 's052', sku: 'STP-052', category: 'staples', name: ['Palm oil', 'Amavuta ya palm', 'Huile de palme'], price: 3200, unit: 'liter', stockQty: 400, minOrderQty: 1, step: 1, emoji: '🛢️', organic: false },
  { id: 's053', sku: 'STP-053', category: 'staples', name: ['Fresh milk', 'Amata mashya', 'Lait frais'], price: 1300, unit: 'liter', stockQty: 400, minOrderQty: 1, step: 1, emoji: '🥛', farmer: 'Inyange Dairy' },
  { id: 's054', sku: 'STP-054', category: 'staples', name: ['Fermented milk (Ikivuguto)', 'Ikivuguto', 'Lait fermenté'], price: 1500, unit: 'liter', stockQty: 350, minOrderQty: 1, step: 1, emoji: '🥛', farmer: 'Inyange Dairy' },
  { id: 's055', sku: 'STP-055', category: 'staples', name: ['Yogurt cup', 'Yaour', 'Yaourt'], price: 800, unit: 'piece', stockQty: 500, minOrderQty: 1, step: 1, emoji: '🥛', organic: false },
  { id: 's056', sku: 'STP-056', category: 'staples', name: ['Cheese', 'Fwomaje', 'Fromage'], price: 4000, unit: 'kg', stockQty: 120, minOrderQty: 0.25, step: 0.25, emoji: '🧀' },
  { id: 's057', sku: 'STP-057', category: 'staples', name: ['Butter', 'Siagi', 'Beurre'], price: 3500, unit: 'kg', stockQty: 150, minOrderQty: 0.25, step: 0.25, emoji: '🧈' },
  { id: 's058', sku: 'STP-058', category: 'staples', name: ['Whole chicken', 'Inkoko', 'Poulet'], price: 7500, unit: 'piece', stockQty: 60, minOrderQty: 1, step: 1, emoji: '🐔', farmer: 'Kibaya Poultry' },
  { id: 's059', sku: 'STP-059', category: 'staples', name: ['Beef', 'Inyama z’inka', 'Bœuf'], price: 6000, unit: 'kg', stockQty: 200, minOrderQty: 0.5, step: 0.5, emoji: '🥩', farmer: 'Nyabugogo Meat Market' },
  { id: 's060', sku: 'STP-060', category: 'staples', name: ['Goat meat', 'Inyama z’ihene', 'Viande de chèvre'], price: 5500, unit: 'kg', stockQty: 150, minOrderQty: 0.5, step: 0.5, emoji: '🥩' },
  { id: 's061', sku: 'STP-061', category: 'staples', name: ['Pork', 'Inyama z’ingurube', 'Porc'], price: 6500, unit: 'kg', stockQty: 150, minOrderQty: 0.5, step: 0.5, emoji: '🐖' },
  { id: 's062', sku: 'STP-062', category: 'staples', name: ['Isambaza (Lake Kivu)', 'Isambaza', 'Sardelles (Kivu)'], price: 1800, unit: 'kg', stockQty: 250, minOrderQty: 0.5, step: 0.5, emoji: '🐟', farmer: 'Kivu Fish Coop' },
  { id: 's063', sku: 'STP-063', category: 'staples', name: ['Fresh fish', 'Ifi nshya', 'Poisson frais'], price: 6500, unit: 'kg', stockQty: 100, minOrderQty: 0.5, step: 0.5, emoji: '🐟', farmer: 'Kivu Fish Coop' },
  { id: 's064', sku: 'STP-064', category: 'staples', name: ['Frozen fish', 'Ifi yahumye mu konji', 'Poisson surgelé'], price: 7000, unit: 'kg', stockQty: 120, minOrderQty: 0.5, step: 0.5, emoji: '🐟', organic: false },
  { id: 's065', sku: 'STP-065', category: 'staples', name: ['Bread loaf', 'Umugati', 'Pain'], price: 1500, unit: 'piece', stockQty: 300, minOrderQty: 1, step: 1, emoji: '🍞', organic: false },
  { id: 's066', sku: 'STP-066', category: 'staples', name: ['Semolina', 'Semolina', 'Semoule'], price: 950, unit: 'kg', stockQty: 250, minOrderQty: 0.5, step: 0.5, emoji: '🌾' },
  { id: 's067', sku: 'STP-067', category: 'staples', name: ['Honey', 'Ubuki', 'Miel'], price: 9000, unit: 'kg', stockQty: 80, minOrderQty: 0.25, step: 0.25, emoji: '🍯', farmer: 'Nyungwe Honey' },
  { id: 's068', sku: 'STP-068', category: 'staples', name: ['Chocolate', 'Shokola', 'Chocolat'], price: 2800, unit: 'pack', stockQty: 200, minOrderQty: 1, step: 1, emoji: '🍫', organic: false },
  { id: 's069', sku: 'STP-069', category: 'staples', name: ['Peanut flour', 'Ifu y’amabiyeyi', 'Farine d’arachide'], price: 2100, unit: 'kg', stockQty: 200, minOrderQty: 0.5, step: 0.5, emoji: '🥜', farmer: 'Huye Groundnut Coop' },
  { id: 's070', sku: 'STP-070', category: 'staples', name: ['Soy flour', 'Ifu ya soya', 'Farine de soja'], price: 1500, unit: 'kg', stockQty: 200, minOrderQty: 0.5, step: 0.5, emoji: '🌾' },
  { id: 's071', sku: 'STP-071', category: 'staples', name: ['Mixed spices', 'Ibirungo bivanze', 'Épices mélangées'], price: 1800, unit: 'pack', stockQty: 300, minOrderQty: 1, step: 1, emoji: '🫙' },
];

// ---------------------------------------------------------------------------
// VEGETABLES (30) — Duhahe master spec list B
// ---------------------------------------------------------------------------
const vegetables: SeedItem[] = [
  { id: 'v001', sku: 'VEG-001', category: 'vegetables', name: ['Tomatoes', 'Inyanya', 'Tomates'], price: 1000, unit: 'kg', stockQty: 800, minOrderQty: 0.5, step: 0.5, emoji: '🍅', farmer: 'Gashora Veg Coop' },
  { id: 'v002', sku: 'VEG-002', category: 'vegetables', name: ['White onions', 'Ibitunguru by’umweru', 'Oignons blancs'], price: 1200, unit: 'kg', stockQty: 900, minOrderQty: 0.5, step: 0.5, emoji: '🧅' },
  { id: 'v003', sku: 'VEG-003', category: 'vegetables', name: ['Red onions', 'Ibitunguru bitukura', 'Oignons rouges'], price: 1300, unit: 'kg', stockQty: 600, minOrderQty: 0.5, step: 0.5, emoji: '🧅' },
  { id: 'v004', sku: 'VEG-004', category: 'vegetables', name: ['Green cabbage', 'Amashu', 'Chou vert'], price: 800, unit: 'kg', stockQty: 700, minOrderQty: 0.5, step: 0.5, emoji: '🥬', farmer: 'Muhanga Veggies' },
  { id: 'v006', sku: 'VEG-006', category: 'vegetables', name: ['Spinach', 'Epinari', 'Épinards'], price: 800, unit: 'bundle', stockQty: 350, minOrderQty: 1, step: 1, emoji: '🥬' },
  { id: 'v007', sku: 'VEG-007', category: 'vegetables', name: ['Amaranth greens (Dodo)', 'Dodo', 'Amarante (Dodo)'], price: 600, unit: 'bundle', stockQty: 400, minOrderQty: 1, step: 1, emoji: '🥬' },
  { id: 'v009', sku: 'VEG-009', category: 'vegetables', name: ['Carrots', 'Karoti', 'Carottes'], price: 1100, unit: 'kg', stockQty: 600, minOrderQty: 0.5, step: 0.5, emoji: '🥕', farmer: 'Rubavu Veg Coop' },
  { id: 'v010', sku: 'VEG-010', category: 'vegetables', name: ['Green beans', 'Imboga z’umworera', 'Haricots verts'], price: 1300, unit: 'kg', stockQty: 400, minOrderQty: 0.5, step: 0.5, emoji: '🫛' },
  { id: 'v011', sku: 'VEG-011', category: 'vegetables', name: ['Green peas', 'Amashaya', 'Petits pois'], price: 1400, unit: 'kg', stockQty: 300, minOrderQty: 0.5, step: 0.5, emoji: '🫛' },
  { id: 'v012', sku: 'VEG-012', category: 'vegetables', name: ['Green bell pepper', 'Ipisipili y’icyatsi', 'Poivron vert'], price: 1500, unit: 'kg', stockQty: 250, minOrderQty: 0.5, step: 0.5, emoji: '🫑' },
  { id: 'v013', sku: 'VEG-013', category: 'vegetables', name: ['Red bell pepper', 'Ipisipili y’umutuku', 'Poivron rouge'], price: 1800, unit: 'kg', stockQty: 200, minOrderQty: 0.5, step: 0.5, emoji: '🫑' },
  { id: 'v015', sku: 'VEG-015', category: 'vegetables', name: ['Eggplant', 'Ingedege', 'Aubergine'], price: 1200, unit: 'kg', stockQty: 250, minOrderQty: 0.5, step: 0.5, emoji: '🍆' },
  { id: 'v016', sku: 'VEG-016', category: 'vegetables', name: ['Zucchini', 'Cugétte', 'Courgette'], price: 1600, unit: 'kg', stockQty: 200, minOrderQty: 0.5, step: 0.5, emoji: '🥒' },
  { id: 'v017', sku: 'VEG-017', category: 'vegetables', name: ['Pumpkin', 'Igihaza', 'Citrouille'], price: 700, unit: 'kg', stockQty: 500, minOrderQty: 0.5, step: 0.5, emoji: '🎃' },
  { id: 'v018', sku: 'VEG-018', category: 'vegetables', name: ['Cucumber', 'Konkombure', 'Concombre'], price: 1000, unit: 'kg', stockQty: 300, minOrderQty: 0.5, step: 0.5, emoji: '🥒' },
  { id: 'v020', sku: 'VEG-020', category: 'vegetables', name: ['Beetroot', 'Ibeterave', 'Betterave'], price: 1500, unit: 'kg', stockQty: 200, minOrderQty: 0.5, step: 0.5, emoji: '🟣' },
  { id: 'v021', sku: 'VEG-021', category: 'vegetables', name: ['Radish', 'Iradisi', 'Radis'], price: 1200, unit: 'kg', stockQty: 150, minOrderQty: 0.5, step: 0.5, emoji: '🔴' },
  { id: 'v022', sku: 'VEG-022', category: 'vegetables', name: ['Leeks', 'Vitombori', 'Poireaux'], price: 1300, unit: 'bundle', stockQty: 200, minOrderQty: 1, step: 1, emoji: '🥬' },
  { id: 'v023', sku: 'VEG-023', category: 'vegetables', name: ['Celery', 'Celeri', 'Céleri'], price: 1400, unit: 'bundle', stockQty: 150, minOrderQty: 1, step: 1, emoji: '🥬' },
  { id: 'v024', sku: 'VEG-024', category: 'vegetables', name: ['Parsley', 'Isafuriya', 'Persil'], price: 800, unit: 'bundle', stockQty: 200, minOrderQty: 1, step: 1, emoji: '🌿' },
  { id: 'v025', sku: 'VEG-025', category: 'vegetables', name: ['Garlic', 'Igitungurusamu', 'Ail'], price: 2500, unit: 'kg', stockQty: 150, minOrderQty: 0.25, step: 0.25, emoji: '🧄' },
  { id: 'v027', sku: 'VEG-027', category: 'vegetables', name: ['Broccoli', 'Brocoli', 'Brocoli'], price: 1800, unit: 'kg', stockQty: 120, minOrderQty: 0.5, step: 0.5, emoji: '🥦' },
  { id: 'v028', sku: 'VEG-028', category: 'vegetables', name: ['Cauliflower', 'Kolifola', 'Chou-fleur'], price: 1700, unit: 'kg', stockQty: 120, minOrderQty: 0.5, step: 0.5, emoji: '🥦' },
  { id: 'v031', sku: 'VEG-031', category: 'vegetables', name: ['Coriander', 'Koriander', 'Coriandre'], price: 800, unit: 'bundle', stockQty: 200, minOrderQty: 1, step: 1, emoji: '🌿' },
  { id: 'v032', sku: 'VEG-032', category: 'vegetables', name: ['Mint', 'Mente', 'Menthe'], price: 800, unit: 'bundle', stockQty: 200, minOrderQty: 1, step: 1, emoji: '🌿' },
  { id: 'v033', sku: 'VEG-033', category: 'vegetables', name: ['Red cabbage', 'Amashu atukura', 'Chou rouge'], price: 900, unit: 'kg', stockQty: 300, minOrderQty: 0.5, step: 0.5, emoji: '🥬' },
  { id: 'v034', sku: 'VEG-034', category: 'vegetables', name: ['Chinese cabbage', 'Amashu y’inyabutatu', 'Chou chinois'], price: 850, unit: 'kg', stockQty: 300, minOrderQty: 0.5, step: 0.5, emoji: '🥬' },
  { id: 'v035', sku: 'VEG-035', category: 'vegetables', name: ['Sweet corn', 'Ibigori bishya', 'Maïs doux'], price: 700, unit: 'piece', stockQty: 350, minOrderQty: 1, step: 1, emoji: '🌽' },
  { id: 'v036', sku: 'VEG-036', category: 'vegetables', name: ['Pumpkin leaves', 'Ibihaza by’icyatsi', 'Feuilles de citrouille'], price: 600, unit: 'bundle', stockQty: 300, minOrderQty: 1, step: 1, emoji: '🌿' },
  { id: 'v037', sku: 'VEG-037', category: 'vegetables', name: ['Yellow bell pepper', 'Ipisipili y’umuhondo', 'Poivron jaune'], price: 1800, unit: 'kg', stockQty: 200, minOrderQty: 0.5, step: 0.5, emoji: '🫑' },
];

// ---------------------------------------------------------------------------
// FRUITS (30) — Duhahe master spec list C
// ---------------------------------------------------------------------------
const fruits: SeedItem[] = [
  { id: 'f001', sku: 'FRU-001', category: 'fruits', name: ['Avocado', 'Avoka', 'Avocat'], price: 400, unit: 'piece', stockQty: 1000, minOrderQty: 1, step: 1, emoji: '🥑', farmer: 'Huye Avocado Farm' },
  { id: 'f002', sku: 'FRU-002', category: 'fruits', name: ['Sweet bananas', 'Ibitoki binyoroshye', 'Bananes douces'], price: 800, unit: 'kg', stockQty: 800, minOrderQty: 1, step: 1, emoji: '🍌' },
  { id: 'f003', sku: 'FRU-003', category: 'fruits', name: ['Plantains', 'Imineke', 'Plantains'], price: 900, unit: 'kg', stockQty: 600, minOrderQty: 1, step: 1, emoji: '🍌' },
  { id: 'f004', sku: 'FRU-004', category: 'fruits', name: ['Oranges', 'Amacunga', 'Oranges'], price: 1400, unit: 'kg', stockQty: 700, minOrderQty: 1, step: 0.5, emoji: '🍊', farmer: 'Nyamagabe Citrus' },
  { id: 'f005', sku: 'FRU-005', category: 'fruits', name: ['Tangerines', 'Amacunga mani', 'Mandarine'], price: 1500, unit: 'kg', stockQty: 400, minOrderQty: 0.5, step: 0.5, emoji: '🍊' },
  { id: 'f006', sku: 'FRU-006', category: 'fruits', name: ['Lemons', 'Indimu', 'Citrons'], price: 1200, unit: 'kg', stockQty: 300, minOrderQty: 0.5, step: 0.5, emoji: '🍋' },
  { id: 'f007', sku: 'FRU-007', category: 'fruits', name: ['Watermelon', 'Amakerela', 'Pastèque'], price: 1000, unit: 'kg', stockQty: 500, minOrderQty: 1, step: 1, emoji: '🍉' },
  { id: 'f008', sku: 'FRU-008', category: 'fruits', name: ['Passion fruit', 'Inkarama', 'Fruit de la passion'], price: 2200, unit: 'kg', stockQty: 300, minOrderQty: 0.5, step: 0.5, emoji: '🟣', farmer: 'Butare Passion Coop' },
  { id: 'f009', sku: 'FRU-009', category: 'fruits', name: ['Papaya', 'Ipapayi', 'Papaye'], price: 1200, unit: 'piece', stockQty: 300, minOrderQty: 1, step: 1, emoji: '🟠' },
  { id: 'f010', sku: 'FRU-010', category: 'fruits', name: ['Mango', 'Imyembe', 'Mangue'], price: 1500, unit: 'kg', stockQty: 500, minOrderQty: 1, step: 0.5, emoji: '🥭', farmer: 'Kayonza Mango Estate' },
  { id: 'f011', sku: 'FRU-011', category: 'fruits', name: ['Pineapple', 'Inanasi', 'Ananas'], price: 2000, unit: 'piece', stockQty: 300, minOrderQty: 1, step: 1, emoji: '🍍', farmer: 'Rulindo Pineapple Coop' },
  { id: 'f012', sku: 'FRU-012', category: 'fruits', name: ['Guava', 'Amapera', 'Goyave'], price: 1100, unit: 'kg', stockQty: 250, minOrderQty: 0.5, step: 0.5, emoji: '🟢' },
  { id: 'f013', sku: 'FRU-013', category: 'fruits', name: ['Pomegranate', 'Komamanga', 'Grenade'], price: 3000, unit: 'kg', stockQty: 100, minOrderQty: 0.5, step: 0.5, emoji: '🍎' },
  { id: 'f014', sku: 'FRU-014', category: 'fruits', name: ['Grapes', 'Imizabibu', 'Raisin'], price: 4000, unit: 'kg', stockQty: 150, minOrderQty: 0.25, step: 0.25, emoji: '🍇', organic: false },
  { id: 'f015', sku: 'FRU-015', category: 'fruits', name: ['Apple (import)', 'Pome', 'Pomme'], price: 2500, unit: 'kg', stockQty: 300, minOrderQty: 0.5, step: 0.5, emoji: '🍎', organic: false },
  { id: 'f016', sku: 'FRU-016', category: 'fruits', name: ['Strawberries', 'Furuse', 'Fraise'], price: 3500, unit: 'box', stockQty: 150, minOrderQty: 1, step: 1, emoji: '🍓', farmer: 'Kinigi Berries' },
  { id: 'f017', sku: 'FRU-017', category: 'fruits', name: ['Blueberries', 'Myrtille', 'Myrtille'], price: 4500, unit: 'box', stockQty: 80, minOrderQty: 1, step: 1, emoji: '🫐' },
  { id: 'f018', sku: 'FRU-018', category: 'fruits', name: ['Plum', 'Pume', 'Prune'], price: 2500, unit: 'kg', stockQty: 150, minOrderQty: 0.5, step: 0.5, emoji: '🍑', organic: false },
  { id: 'f019', sku: 'FRU-019', category: 'fruits', name: ['Peach', 'Impichesi', 'Pêche'], price: 2800, unit: 'kg', stockQty: 120, minOrderQty: 0.5, step: 0.5, emoji: '🍑' },
  { id: 'f020', sku: 'FRU-020', category: 'fruits', name: ['Soursop', 'Stafeli', 'Corossol'], price: 3500, unit: 'kg', stockQty: 100, minOrderQty: 0.5, step: 0.5, emoji: '🥝' },
  { id: 'f021', sku: 'FRU-021', category: 'fruits', name: ['Tamarillo (tree tomato)', 'Ikimere', 'Tamarillo'], price: 2600, unit: 'kg', stockQty: 150, minOrderQty: 0.5, step: 0.5, emoji: '🍅' },
  { id: 'f024', sku: 'FRU-024', category: 'fruits', name: ['Coconut', 'Umukobole', 'Noix de coco'], price: 1500, unit: 'piece', stockQty: 150, minOrderQty: 1, step: 1, emoji: '🥥', organic: false },
  { id: 'f026', sku: 'FRU-026', category: 'fruits', name: ['Melon', 'Konkombere', 'Melon'], price: 1500, unit: 'kg', stockQty: 200, minOrderQty: 1, step: 1, emoji: '🍈' },
  { id: 'f028', sku: 'FRU-028', category: 'fruits', name: ['Kiwi', 'Kiwi', 'Kiwi'], price: 4000, unit: 'kg', stockQty: 100, minOrderQty: 0.25, step: 0.25, emoji: '🥝', organic: false },
  { id: 'f031', sku: 'FRU-031', category: 'fruits', name: ['Pear', 'Inpera', 'Poire'], price: 2800, unit: 'kg', stockQty: 150, minOrderQty: 0.5, step: 0.5, emoji: '🍐', organic: false },
  { id: 'f032', sku: 'FRU-032', category: 'fruits', name: ['Apricot', 'Aprikot', 'Abricot'], price: 3200, unit: 'kg', stockQty: 100, minOrderQty: 0.5, step: 0.5, emoji: '🍑' },
  { id: 'f033', sku: 'FRU-033', category: 'fruits', name: ['Jackfruit', 'Ikinyamunyu', 'Jacquier'], price: 2500, unit: 'piece', stockQty: 120, minOrderQty: 1, step: 1, emoji: '🍈' },
  { id: 'f034', sku: 'FRU-034', category: 'fruits', name: ['Custard apple', 'Pomu kanell', 'Pomme cannelle'], price: 3500, unit: 'kg', stockQty: 90, minOrderQty: 0.5, step: 0.5, emoji: '🟢' },
  { id: 'f035', sku: 'FRU-035', category: 'fruits', name: ['Mulberry', 'Mulberi', 'Mûre'], price: 4000, unit: 'box', stockQty: 70, minOrderQty: 1, step: 1, emoji: '🫐' },
  { id: 'f036', sku: 'FRU-036', category: 'fruits', name: ['Raspberry', 'Rasberi', 'Framboise'], price: 4500, unit: 'box', stockQty: 70, minOrderQty: 1, step: 1, emoji: '🫐' },
];

// ---------------------------------------------------------------------------
// KITCHENWARE (18) — Duhahe master spec list D (kitchen equipment)
// ---------------------------------------------------------------------------
const kitchenware: SeedItem[] = [
  { id: 'k001', sku: 'KIT-001', category: 'kitchenware', name: ['Cooking pot 5L', 'Isafuriya 5L', 'Marmite 5L'], price: 8500, unit: 'piece', stockQty: 80, minOrderQty: 1, step: 1, emoji: '🍲', organic: false },
  { id: 'k002', sku: 'KIT-002', category: 'kitchenware', name: ['Frying pan', 'Pano yo gukengerera', 'Poêle'], price: 6000, unit: 'piece', stockQty: 100, minOrderQty: 1, step: 1, emoji: '🍳', organic: false },
  { id: 'k003', sku: 'KIT-003', category: 'kitchenware', name: ['Wooden spoon set', 'Ikiyiko cy’ibiti', 'Cuillères en bois'], price: 2000, unit: 'pack', stockQty: 120, minOrderQty: 1, step: 1, emoji: '🥄', organic: false },
  { id: 'k004', sku: 'KIT-004', category: 'kitchenware', name: ['Kitchen knife', 'Icyuma cy’igikoni', 'Couteau de cuisine'], price: 3500, unit: 'piece', stockQty: 90, minOrderQty: 1, step: 1, emoji: '🔪', organic: false },
  { id: 'k005', sku: 'KIT-005', category: 'kitchenware', name: ['Cutting board', 'Agahubaho', 'Planche à découper'], price: 2500, unit: 'piece', stockQty: 110, minOrderQty: 1, step: 1, emoji: '🪵', organic: false },
  { id: 'k006', sku: 'KIT-006', category: 'kitchenware', name: ['Mixing bowl (big)', 'Indobo nini', 'Grand bol'], price: 3000, unit: 'piece', stockQty: 130, minOrderQty: 1, step: 1, emoji: '🥣', organic: false },
  { id: 'k007', sku: 'KIT-007', category: 'kitchenware', name: ['Plastic bucket 10L', 'Indobo 10L', 'Seau 10L'], price: 2500, unit: 'piece', stockQty: 150, minOrderQty: 1, step: 1, emoji: '🪣', organic: false },
  { id: 'k008', sku: 'KIT-008', category: 'kitchenware', name: ['Water jug', 'Icedeni', 'Cruche à eau'], price: 1800, unit: 'piece', stockQty: 140, minOrderQty: 1, step: 1, emoji: '🥤', organic: false },
  { id: 'k009', sku: 'KIT-009', category: 'kitchenware', name: ['Thermos 1L', 'Tere-mo 1L', 'Thermos 1L'], price: 8000, unit: 'piece', stockQty: 60, minOrderQty: 1, step: 1, emoji: '🧴', organic: false },
  { id: 'k010', sku: 'KIT-010', category: 'kitchenware', name: ['Charcoal stove', 'Imbabura', 'Foyer à charbon'], price: 12000, unit: 'piece', stockQty: 50, minOrderQty: 1, step: 1, emoji: '🔥', organic: false },
  { id: 'k011', sku: 'KIT-011', category: 'kitchenware', name: ['Water filter', 'Filtre y’amazi', 'Filtre à eau'], price: 15000, unit: 'piece', stockQty: 40, minOrderQty: 1, step: 1, emoji: '💧', organic: false },
  { id: 'k012', sku: 'KIT-012', category: 'kitchenware', name: ['Storage containers (set)', 'Agasanduku ko kubika', 'Boîtes de rangement'], price: 4000, unit: 'pack', stockQty: 80, minOrderQty: 1, step: 1, emoji: '📦', organic: false },
  { id: 'k013', sku: 'KIT-013', category: 'kitchenware', name: ['Gas lighter', 'Uruhimbi', 'Briquet'], price: 1000, unit: 'piece', stockQty: 200, minOrderQty: 1, step: 1, emoji: '🕯️', organic: false },
  { id: 'k014', sku: 'KIT-014', category: 'kitchenware', name: ['Dish rack', 'Urubaraza rw’isafuriya', 'Égouttoir'], price: 5500, unit: 'piece', stockQty: 60, minOrderQty: 1, step: 1, emoji: '🧺', organic: false },
  { id: 'k015', sku: 'KIT-015', category: 'kitchenware', name: ['Mortar & pestle', 'Ikirori n’igisheko', 'Mortier et pilon'], price: 7500, unit: 'piece', stockQty: 45, minOrderQty: 1, step: 1, emoji: '🪨', organic: false },
  { id: 'k016', sku: 'KIT-016', category: 'kitchenware', name: ['Woven market basket', 'Agatebo', 'Panier tressé'], price: 4500, unit: 'piece', stockQty: 70, minOrderQty: 1, step: 1, emoji: '🧺', organic: false },
  { id: 'k017', sku: 'KIT-017', category: 'kitchenware', name: ['Settling basin', 'Inkonge', 'Bassine'], price: 3000, unit: 'piece', stockQty: 130, minOrderQty: 1, step: 1, emoji: '🪣', organic: false },
  { id: 'k018', sku: 'KIT-018', category: 'kitchenware', name: ['Measuring cups set', 'Ibikombe bipima', 'Jeu de tasses mesureuses'], price: 2500, unit: 'pack', stockQty: 90, minOrderQty: 1, step: 1, emoji: '🥛', organic: false },
];

// ---------------------------------------------------------------------------
// HOUSEHOLD (8) — home care & cleaning
// ---------------------------------------------------------------------------
const household: SeedItem[] = [
  { id: 'h001', sku: 'HOU-001', category: 'household', name: ['Laundry soap bar', 'Isabune y’imyenda', 'Savon de lessive'], price: 800, unit: 'piece', stockQty: 400, minOrderQty: 1, step: 1, emoji: '🧼', organic: false },
  { id: 'h002', sku: 'HOU-002', category: 'household', name: ['Washing detergent 1kg', 'Omukala 1kg', 'Détergent 1kg'], price: 2500, unit: 'pack', stockQty: 250, minOrderQty: 1, step: 1, emoji: '🫧', organic: false },
  { id: 'h003', sku: 'HOU-003', category: 'household', name: ['Dishwashing liquid 1L', 'Icyuma cy’isahane 1L', 'Liquide vaisselle 1L'], price: 1800, unit: 'liter', stockQty: 300, minOrderQty: 1, step: 1, emoji: '🧴', organic: false },
  { id: 'h004', sku: 'HOU-004', category: 'household', name: ['Floor cleaner 1L', 'Icyuma cy’ubutaka 1L', 'Nettoyant sol 1L'], price: 2000, unit: 'liter', stockQty: 200, minOrderQty: 1, step: 1, emoji: '🪣', organic: false },
  { id: 'h005', sku: 'HOU-005', category: 'household', name: ['Hand soap', 'Isabune y’intoki', 'Savon pour les mains'], price: 700, unit: 'piece', stockQty: 500, minOrderQty: 1, step: 1, emoji: '🧼', organic: false },
  { id: 'h006', sku: 'HOU-006', category: 'household', name: ['Toilet paper (6 rolls)', 'Impapuro zo mu bwiherero', 'Papier toilette (6 rouleaux)'], price: 2200, unit: 'pack', stockQty: 300, minOrderQty: 1, step: 1, emoji: '🧻', organic: false },
  { id: 'h007', sku: 'HOU-007', category: 'household', name: ['Broom (plastic)', 'Umweyo', 'Balai (plastique)'], price: 1500, unit: 'piece', stockQty: 150, minOrderQty: 1, step: 1, emoji: '🧹', organic: false },
  { id: 'h008', sku: 'HOU-008', category: 'household', name: ['Window & surface cleaner 1L', 'Umusesengero 1L', 'Nettoyant vitres 1L'], price: 1900, unit: 'liter', stockQty: 180, minOrderQty: 1, step: 1, emoji: '🪟', organic: false },
];

// ---------------------------------------------------------------------------
// DRINKS (10) — refreshments, juices & soft drinks
// ---------------------------------------------------------------------------
const drinks: SeedItem[] = [
  { id: 'd001', sku: 'DRK-001', category: 'drinks', name: ['Still water 1.5L', 'Amazi atarimo gas 1.5L', 'Eau plate 1.5L'], price: 700, unit: 'bottle', stockQty: 600, minOrderQty: 1, step: 1, emoji: '💧', organic: false },
  { id: 'd002', sku: 'DRK-002', category: 'drinks', name: ['Sparkling water 1L', 'Soda y’amazi 1L', 'Eau pétillante 1L'], price: 900, unit: 'bottle', stockQty: 400, minOrderQty: 1, step: 1, emoji: '💧', organic: false },
  { id: 'd003', sku: 'DRK-003', category: 'drinks', name: ['Passion fruit juice 1L', 'Icyotsi cy’inkarama 1L', 'Jus de fruit de la passion 1L'], price: 2500, unit: 'liter', stockQty: 250, minOrderQty: 1, step: 1, emoji: '🍹', organic: false },
  { id: 'd004', sku: 'DRK-004', category: 'drinks', name: ['Pineapple juice 1L', 'Icyotsi cy’inanasi 1L', 'Jus d’ananas 1L'], price: 2200, unit: 'liter', stockQty: 250, minOrderQty: 1, step: 1, emoji: '🍍', organic: false },
  { id: 'd005', sku: 'DRK-005', category: 'drinks', name: ['Mango juice 1L', 'Icyotsi cy’imyembe 1L', 'Jus de mangue 1L'], price: 2300, unit: 'liter', stockQty: 250, minOrderQty: 1, step: 1, emoji: '🥭', organic: false },
  { id: 'd006', sku: 'DRK-006', category: 'drinks', name: ['Cola soft drink 2L', 'Fanta cola 2L', 'Boisson cola 2L'], price: 2000, unit: 'bottle', stockQty: 350, minOrderQty: 1, step: 1, emoji: '🥤', organic: false },
  { id: 'd007', sku: 'DRK-007', category: 'drinks', name: ['Orange soda 2L', 'Soda y’amacunga 2L', 'Soda orange 2L'], price: 2000, unit: 'bottle', stockQty: 350, minOrderQty: 1, step: 1, emoji: '🍊', organic: false },
  { id: 'd008', sku: 'DRK-008', category: 'drinks', name: ['Ginger drink 1L', 'Icyotsi cy’itanjagija 1L', 'Boisson au gingembre 1L'], price: 1800, unit: 'liter', stockQty: 200, minOrderQty: 1, step: 1, emoji: '🫚', organic: false },
  { id: 'd009', sku: 'DRK-009', category: 'drinks', name: ['Energy drink 250ml', 'Energy drink 250ml', 'Boisson énergisante 250ml'], price: 1500, unit: 'can', stockQty: 300, minOrderQty: 1, step: 1, emoji: '⚡', organic: false },
  { id: 'd010', sku: 'DRK-010', category: 'drinks', name: ['Sorghum beer (Ikigage) 1L', 'Ikigage 1L', 'Bière de sorgho (Ikigage) 1L'], price: 1200, unit: 'liter', stockQty: 180, minOrderQty: 1, step: 1, emoji: '🍺', organic: false },
];

// ---------------------------------------------------------------------------
// PERSONAL CARE (10) — hygiene & body care
// ---------------------------------------------------------------------------
const personalCare: SeedItem[] = [
  { id: 'p001', sku: 'PCR-001', category: 'personal_care', name: ['Bath soap', 'Isabune yo kwiyuhagira', 'Savon de bain'], price: 600, unit: 'piece', stockQty: 800, minOrderQty: 1, step: 1, emoji: '🧼', organic: false },
  { id: 'p002', sku: 'PCR-002', category: 'personal_care', name: ['Body lotion 250ml', 'Gikombe 250ml', 'Lotion corporelle 250ml'], price: 1800, unit: 'bottle', stockQty: 300, minOrderQty: 1, step: 1, emoji: '🧴', organic: false },
  { id: 'p003', sku: 'PCR-003', category: 'personal_care', name: ['Shampoo 300ml', 'Shampoo 300ml', 'Shampooing 300ml'], price: 2000, unit: 'bottle', stockQty: 300, minOrderQty: 1, step: 1, emoji: '💇', organic: false },
  { id: 'p004', sku: 'PCR-004', category: 'personal_care', name: ['Toothpaste 100g', 'Muraziki 100g', 'Dentifrice 100g'], price: 900, unit: 'piece', stockQty: 500, minOrderQty: 1, step: 1, emoji: '🪥', organic: false },
  { id: 'p005', sku: 'PCR-005', category: 'personal_care', name: ['Toothbrush', 'Uburuho bw’amenyo', 'Brosse à dents'], price: 700, unit: 'piece', stockQty: 400, minOrderQty: 1, step: 1, emoji: '🪥', organic: false },
  { id: 'p006', sku: 'PCR-006', category: 'personal_care', name: ['Razor blades (pack)', 'Ihema', 'Lames de rasoir'], price: 500, unit: 'pack', stockQty: 350, minOrderQty: 1, step: 1, emoji: '🪒', organic: false },
  { id: 'p007', sku: 'PCR-007', category: 'personal_care', name: ['Sanitary pads (10)', 'Ama pads', 'Serviettes hygiéniques (10)'], price: 1500, unit: 'pack', stockQty: 400, minOrderQty: 1, step: 1, emoji: '🩷', organic: false },
  { id: 'p008', sku: 'PCR-008', category: 'personal_care', name: ['Petroleum jelly 100ml', 'Vaseline 100ml', 'Vaseline 100ml'], price: 800, unit: 'bottle', stockQty: 450, minOrderQty: 1, step: 1, emoji: '🧈', organic: false },
  { id: 'p009', sku: 'PCR-009', category: 'personal_care', name: ['Facial tissue (5 pack)', 'Impapuro z’amaso', 'Mouchoirs (5 paquets)'], price: 1600, unit: 'pack', stockQty: 300, minOrderQty: 1, step: 1, emoji: '🧻', organic: false },
  { id: 'p010', sku: 'PCR-010', category: 'personal_care', name: ['Mouthwash 500ml', 'Amazi yo mu kanwa 500ml', 'Eau buccale 500ml'], price: 2000, unit: 'bottle', stockQty: 200, minOrderQty: 1, step: 1, emoji: '🫧', organic: false },
];

// ---------------------------------------------------------------------------
// OTHER ESSENTIALS (8) — everyday extras
// ---------------------------------------------------------------------------
const other: SeedItem[] = [
  { id: 'o001', sku: 'OTH-001', category: 'other', name: ['Charcoal (small sack)', 'Amakara (agasaho)', 'Charbon (petit sac)'], price: 3000, unit: 'bag', stockQty: 200, minOrderQty: 1, step: 1, emoji: '🪵', organic: false },
  { id: 'o002', sku: 'OTH-002', category: 'other', name: ['Candles (pack of 4)', 'Amabambara (4)', 'Bougies (paquet de 4)'], price: 1500, unit: 'pack', stockQty: 300, minOrderQty: 1, step: 1, emoji: '🕯️', organic: false },
  { id: 'o003', sku: 'OTH-003', category: 'other', name: ['Matches (box)', 'Agafetero', 'Allumettes (boîte)'], price: 200, unit: 'piece', stockQty: 800, minOrderQty: 1, step: 1, emoji: '🔥', organic: false },
  { id: 'o004', sku: 'OTH-004', category: 'other', name: ['Batteries AA (pack of 4)', 'Amashanyarazi AA (4)', 'Piles AA (paquet de 4)'], price: 2000, unit: 'pack', stockQty: 250, minOrderQty: 1, step: 1, emoji: '🔋', organic: false },
  { id: 'o005', sku: 'OTH-005', category: 'other', name: ['Mosquito coil (pack)', 'Ikidete', 'Spirale anti-moustiques'], price: 1200, unit: 'pack', stockQty: 350, minOrderQty: 1, step: 1, emoji: '🦟', organic: false },
  { id: 'o006', sku: 'OTH-006', category: 'other', name: ['Washing brush', 'Uburoso bwo gukaraba', 'Brosse à laver'], price: 1200, unit: 'piece', stockQty: 180, minOrderQty: 1, step: 1, emoji: '🪥', organic: false },
  { id: 'o007', sku: 'OTH-007', category: 'other', name: ['Clothesline rope (10m)', 'Umugozi w’imyenda (10m)', 'Corde à linge (10m)'], price: 1800, unit: 'piece', stockQty: 120, minOrderQty: 1, step: 1, emoji: '🧵', organic: false },
  { id: 'o008', sku: 'OTH-008', category: 'other', name: ['Flip flops', 'Inkomora', 'Claquettes'], price: 2500, unit: 'pair', stockQty: 150, minOrderQty: 1, step: 1, emoji: '🩴', organic: false },
];

export const PRODUCTS: Product[] = [
  ...staples.map(p),
  ...vegetables.map(p),
  ...fruits.map(p),
  ...kitchenware.map(p),
  ...household.map(p),
  ...drinks.map(p),
  ...personalCare.map(p),
  ...other.map(p),
];

export const CATEGORIES: CategoryId[] = [
  'staples',
  'vegetables',
  'fruits',
  'kitchenware',
  'household',
  'drinks',
  'personal_care',
  'other',
];

export function getProductById(id: string): Product | undefined {
  return PRODUCTS.find((prod) => prod.id === id);
}
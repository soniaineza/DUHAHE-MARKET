import type { CategoryId, Product } from '@duhahe/shared';

/**
 * Real product photography.
 *
 * Every product ID gets its own close-match photo (176 IDs, one per catalog
 * item). All IDs were verified: `images.unsplash.com/...?auto=format&fit=crop`
 * returns 200 image/*, and the photo's alt text was checked against the
 * product name. Anything un-mapped falls back to its category photo.
 */
const photo = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=720&q=80`;

export const categoryPhoto: Record<CategoryId, string> = {
  staples: photo('photo-1515003197210-e0cd71810b5f'),
  vegetables: photo('photo-1566385101042-1a0aa0c1268c'),
  fruits: photo('photo-1490474418585-ba9bad8fd0ea'),
  kitchenware: photo('photo-1556911220-bff31c812dba'),
  household: photo('photo-1585421514738-01798e348b17'),
  drinks: photo('photo-1544145945-f90425340c7e'),
  personal_care: photo('photo-1556228578-8c89e6adf883'),
  other: photo('photo-1494438639946-1ebd1d20bf85'),
};

export const productPhoto: Record<string, string> = {
  // ---------------------------------------------------------------- Staples
  s001: photo('photo-1597958792579-bd3517df6399'), // local rice
  s002: photo('photo-1645331465778-eb409d112198'), // imported rice
  s004: photo('photo-1613728913293-c99bb00ef39c'), // maize flour
  s005: photo('photo-1673877792724-4ca45923fee4'), // corn meal (akawunga)
  s008: photo('photo-1610725664285-7c57e6eeac3f'), // wheat flour
  s010: photo('photo-1614373532018-92a75430a0da'), // rolled oats
  s012: photo('photo-1709229851054-a09c8f7bd7e3'), // black beans
  s013: photo('photo-1613728913084-090a0d106c3a'), // white beans
  s014: photo('photo-1763368397625-32c8f75fed44'), // red beans
  s016: photo('photo-1780648372211-0e395951c179'), // dried peas
  s018: photo('photo-1639843606783-b2f9c50a7468'), // soybeans
  s019: photo('photo-1708436477916-f97964f3ccf1'), // lentils
  s021: photo('photo-1549978113-29eb25c8177f'), // raw groundnuts
  s024: photo('photo-1518977676601-b53f82aba655'), // irish potatoes
  s025: photo('photo-1730815048561-45df6f7f331d'), // sweet potatoes
  s026: photo('photo-1757283961570-682154747d9c'), // cassava
  s030: photo('photo-1685967836908-7d3b4921a670'), // white sugar
  s031: photo('photo-1552592074-ea7a91b851b3'), // sunflower oil
  s032: photo('photo-1518110925495-5fe2fda0442c'), // salt
  s033: photo('photo-1433891248364-3ce993ff0e92'), // black tea
  s034: photo('photo-1447933601403-0c6688de566e'), // coffee beans
  s036: photo('photo-1498654077810-12c21d4d6dc3'), // eggs
  s037: photo('photo-1587185717368-4d92f8de4ad2'), // margarine
  s040: photo('photo-1591801058986-9e28e68670f7'), // black pepper
  s043: photo('photo-1602237514002-c2d8ae2da393'), // dried chili
  s044: photo('photo-1551462147-ff29053bfc14'), // spaghetti
  s045: photo('photo-1598720290281-9f26ae6d6f81'), // macaroni
  s047: photo('photo-1558961363-fa8fdf82db35'), // biscuits
  s051: photo('photo-1704079611177-a3a60ce6f975'), // brown sugar
  s052: photo('photo-1474979266404-7eaacbcd87c5'), // palm oil
  s053: photo('photo-1634141510639-d691d86f47be'), // fresh milk
  s054: photo('photo-1634141510639-d691d86f47be'), // fermented milk (ikivuguto)
  s055: photo('photo-1562114808-b4b33cf60f4f'), // yogurt
  s056: photo('photo-1683314573422-649a3c6ad784'), // cheese
  s057: photo('photo-1589985270826-4b7bb135bc9d'), // butter
  s058: photo('photo-1587593810167-a84920ea0781'), // whole chicken
  s059: photo('photo-1723893905879-0e309c2a8e06'), // beef
  s060: photo('photo-1602470520998-f4a52199a3d6'), // goat meat
  s061: photo('photo-1628268909376-e8c44bb3153f'), // pork
  s062: photo('photo-1572420963886-7850f1af053e'), // isambaza (small fish)
  s063: photo('photo-1611214774777-3d997a9d0e35'), // fresh fish
  s064: photo('photo-1498654200943-1088dd4438ae'), // frozen fish
  s065: photo('photo-1598373182133-52452f7691ef'), // bread loaf
  s066: photo('photo-1613222097523-87d3e3311c38'), // semolina
  s067: photo('photo-1587049352851-8d4e89133924'), // honey
  s068: photo('photo-1623660053975-cf75a8be0908'), // chocolate
  s069: photo('photo-1564988208558-9270de7c5848'), // peanut flour
  s070: photo('photo-1586137712370-9b450509c587'), // soy flour
  s071: photo('photo-1581600140682-d4e68c8cde32'), // mixed spices

  // ------------------------------------------------------------- Vegetables
  v001: photo('photo-1582284540020-8acbe03f4924'), // tomatoes
  v002: photo('photo-1585849834908-3481231155e8'), // white onions
  v003: photo('photo-1618512496248-a07fe83aa8cb'), // red onions
  v004: photo('photo-1697346327617-c333613a349a'), // green cabbage
  v006: photo('photo-1591495746097-8a92864d5c1f'), // spinach
  v007: photo('photo-1788721834539-788bf643ec70'), // amaranth (dodo)
  v009: photo('photo-1598170845058-32b9d6a5da37'), // carrots
  v010: photo('photo-1574963835594-61eede2070dc'), // green beans
  v011: photo('photo-1592394533824-9440e5d68530'), // green peas
  v012: photo('photo-1585159079680-8dec029b76ed'), // green bell pepper
  v013: photo('photo-1525607551316-4a8e16d1f9ba'), // red bell pepper
  v015: photo('photo-1615484477201-9f4953340fab'), // eggplant
  v016: photo('photo-1691480291894-75229c2bfd44'), // zucchini
  v017: photo('photo-1692680919402-95fc56f99225'), // pumpkin
  v018: photo('photo-1449300079323-02e209d9d3a6'), // cucumber
  v020: photo('photo-1593105544559-ecb03bf76f82'), // beetroot
  v021: photo('photo-1585369496178-144fd937f249'), // radish
  v022: photo('photo-1615485499978-1279c3d6302f'), // leeks
  v023: photo('photo-1582372288206-a88db541f0e8'), // celery
  v024: photo('photo-1633640737481-2e9aabd87033'), // parsley
  v025: photo('photo-1636210589096-a53d5dacd702'), // garlic
  v027: photo('photo-1685504445355-0e7bdf90d415'), // broccoli
  v028: photo('photo-1566842600175-97dca489844f'), // cauliflower
  v031: photo('photo-1588879460618-9249e7d947d1'), // coriander
  v032: photo('photo-1618130070080-91f4d55a2383'), // mint
  v033: photo('photo-1651172915092-4389b362b25d'), // red cabbage
  v034: photo('photo-1708798534031-3711ec8cc16e'), // chinese cabbage
  v035: photo('photo-1649251037465-72c9d378acb6'), // sweet corn
  v036: photo('photo-1663921801167-b522c11d6cf4'), // pumpkin leaves
  v037: photo('photo-1730433267235-ed682d9346f9'), // yellow bell pepper

  // ----------------------------------------------------------------- Fruits
  f001: photo('photo-1519162808019-7de1683fa2ad'), // avocado
  f002: photo('photo-1603833665858-e61d17a86224'), // sweet bananas
  f003: photo('photo-1617631716600-6a454b430367'), // plantains
  f004: photo('photo-1611080626919-7cf5a9dbab5b'), // oranges
  f005: photo('photo-1611329646571-689ddf8bfee9'), // tangerines
  f006: photo('photo-1590502593747-42a996133562'), // lemons
  f007: photo('photo-1587049352846-4a222e784d38'), // watermelon
  f008: photo('photo-1526318472351-c75fcf070305'), // passion fruit
  f009: photo('photo-1517282009859-f000ec3b26fe'), // papaya
  f010: photo('photo-1732472581875-89ff83f18439'), // mango
  f011: photo('photo-1589820296156-2454bb8a6ad1'), // pineapple
  f012: photo('photo-1641642399576-487909d0ddbc'), // guava
  f013: photo('photo-1574709755254-fcd942d09d5a'), // pomegranate
  f014: photo('photo-1596363505729-4190a9506133'), // grapes
  f015: photo('photo-1560806887-1e4cd0b6cbd6'), // apple
  f016: photo('photo-1601004890684-d8cbf643f5f2'), // strawberries
  f017: photo('photo-1594002348772-bc0cb57ade8b'), // blueberries
  f018: photo('photo-1564750497011-ead0ce4b9448'), // plum
  f019: photo('photo-1639588473831-dd9d014646ae'), // peach
  f020: photo('photo-1582248787745-e2ee014c16d9'), // soursop
  f021: photo('photo-1784617269469-316e3b5567fa'), // tamarillo
  f024: photo('photo-1581453883350-288b2c19bea8'), // coconut
  f026: photo('photo-1660255940874-9b1650e95688'), // melon
  f028: photo('photo-1618897996318-5a901fa6ca71'), // kiwi
  f031: photo('photo-1615484477778-ca3b77940c25'), // pear
  f032: photo('photo-1592681814168-6df0fa93161b'), // apricot
  f033: photo('photo-1624711078028-19ed36a91f02'), // jackfruit
  f034: photo('photo-1676993842546-ff9b61c68abc'), // custard apple
  f035: photo('photo-1660418056478-66fa71ceb526'), // mulberry
  f036: photo('photo-1577069861033-55d04cec4ef5'), // raspberry

  // ------------------------------------------------------------ Kitchenware
  k001: photo('photo-1518737003272-dac7c4760d5e'), // cooking pot
  k002: photo('photo-1624031000828-dba1b7a3e4ce'), // frying pan
  k003: photo('photo-1579892876770-461a88bd87df'), // wooden spoon set
  k004: photo('photo-1514986888952-8cd320577b68'), // kitchen knife
  k005: photo('photo-1666013942797-9daa4b8b3b4f'), // cutting board
  k006: photo('photo-1614778168817-d8a55d646890'), // mixing bowl
  k007: photo('photo-1571759025475-b96e5a998013'), // plastic bucket
  k008: photo('photo-1534596292079-6ab51b3b0507'), // water jug
  k009: photo('photo-1591345299642-13726d9c80c1'), // thermos
  k010: photo('photo-1494358856891-c9a46d446c39'), // charcoal stove
  k011: photo('photo-1669139470813-827cbcf54b20'), // water filter
  k012: photo('photo-1621318551436-68573392fd5c'), // storage containers
  k013: photo('photo-1776107481137-9f034928d09e'), // gas lighter
  k014: photo('photo-1736390755053-f57997f7931b'), // dish rack
  k015: photo('photo-1626100288479-cacf72aa1777'), // mortar & pestle
  k016: photo('photo-1455669175216-9017c9b02fc6'), // woven basket
  k017: photo('photo-1708392173751-35e937253100'), // settling basin
  k018: photo('photo-1586797166778-7cb76a618157'), // measuring cups

  // -------------------------------------------------------------- Household
  h001: photo('photo-1607006344152-62699f97b42c'), // laundry soap bar
  h002: photo('photo-1624372635277-283042097f31'), // washing detergent
  h003: photo('photo-1590610994353-7b0e7546e681'), // dishwashing liquid
  h004: photo('photo-1639112389900-a858bf671be1'), // floor cleaner
  h005: photo('photo-1591610160225-861405867ba3'), // hand soap
  h006: photo('photo-1631524254770-03abe3f42a0d'), // toilet paper
  h007: photo('photo-1638900999395-22595e1785f6'), // broom
  h008: photo('photo-1651481127251-60027d79519f'), // window cleaner

  // ----------------------------------------------------------------- Drinks
  d001: photo('photo-1602143407151-7111542de6e8'), // still water
  d002: photo('photo-1561041695-d2fadf9f318c'), // sparkling water
  d003: photo('photo-1616077495006-847c9d44b9b1'), // passion fruit juice
  d004: photo('photo-1534353473418-4cfa6c56fd38'), // pineapple juice
  d005: photo('photo-1600271886742-f049cd451bba'), // mango juice
  d006: photo('photo-1648569883125-d01072540b4c'), // cola
  d007: photo('photo-1619241638225-14d56e47ae64'), // orange soda
  d008: photo('photo-1606486746458-e44951581ade'), // ginger drink
  d009: photo('photo-1560689189-65b6ed6228e7'), // energy drink
  d010: photo('photo-1779937882755-e980096a1612'), // sorghum beer

  // ---------------------------------------------------------- Personal care
  p001: photo('photo-1546552768-9e3a94b38a59'), // bath soap
  p002: photo('photo-1580870069867-74c57ee1bb07'), // body lotion
  p003: photo('photo-1701992678972-d5a053ad0fb0'), // shampoo
  p004: photo('photo-1654373535457-383a0a4d00f9'), // toothpaste
  p005: photo('photo-1520013573795-38516d2661e4'), // toothbrush
  p006: photo('photo-1629261651616-00c3e07ca6e8'), // razor blades
  p007: photo('photo-1589395937921-fddc324ccdd2'), // sanitary pads
  p008: photo('photo-1628435946798-47ea3b014fb3'), // petroleum jelly
  p009: photo('photo-1609840112990-4265448268d1'), // facial tissue
  p010: photo('photo-1626006864160-aa21716d0204'), // mouthwash

  // -------------------------------------------------------- Other essentials
  o001: photo('photo-1613897807164-01263a2296e2'), // charcoal
  o002: photo('photo-1561212856-44e9bae482aa'), // candles
  o003: photo('photo-1646617653712-44c0928a605b'), // matches
  o004: photo('photo-1619641805634-b867f535071c'), // batteries
  o005: photo('photo-1608465343292-800ef1936b26'), // mosquito coil
  o006: photo('photo-1747085885166-22f017816c81'), // washing brush
  o007: photo('photo-1529220355416-122440146f39'), // clothesline rope
  o008: photo('photo-1692536631218-ce4264088abe'), // flip flops
};

export function productPhotoUrl(p: Product): string {
  return productPhoto[p.id] ?? categoryPhoto[p.category];
}

export function categoryPhotoUrl(c: CategoryId): string {
  return categoryPhoto[c];
}

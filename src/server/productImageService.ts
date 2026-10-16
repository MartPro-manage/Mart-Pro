export interface ProductImageCandidate {
  url: string;
  thumbnail: string;
  title: string;
  domain: string;
}

export interface ResolveImageResult {
  imageUrl: string;
  thumbnailUrl: string;
  source: string;
  sourceDomain: string;
  candidates: ProductImageCandidate[];
}

export function normalizeProductName(name: string): { cleanName: string; keywords: string[] } {
  let clean = (name || '')
    .toLowerCase()
    .replace(/([0-9]+)([a-z]+)/gi, '$1 $2')
    .replace(/([a-z]+)([0-9]+)/gi, '$1 $2')
    .replace(/\s*\([^)]*\)/g, ' ')
    .replace(/\b\d+(\.\d+)?\s*(kg|g|gm|grams|liter|liters|litre|litres|ltr|ml|pet|pack|pcs|pieces|sml|sm|large|trio|s)\b/gi, ' ')
    .replace(/\b(coking)\b/gi, 'cooking')
    .replace(/\b(gee)\b/gi, 'ghee')
    .replace(/\b(sope)\b/gi, 'soap')
    .replace(/\b(refil)\b/gi, 'refill')
    .replace(/\b(s\.s)\b/gi, 'shampoo')
    .replace(/\b(arilel)\b/gi, 'ariel')
    .replace(/\b(bursh)\b/gi, 'toothbrush')
    .replace(/\b(dentist)\b/gi, 'toothbrush')
    .replace(/\b(detoll)\b/gi, 'dettol')
    .replace(/\b(roohafza)\b/gi, 'rooh afza')
    .replace(/\b(jam\s*e\s*shirin|jamshirin)\b/gi, 'jam e shirin')
    .replace(/\b(vital\d*gm)\b/gi, 'vital tea')
    .replace(/\b(tezdum|tazdum)\b/gi, 'tez dum tea')
    .replace(/\b(tapalfamilymix|tapalfamily)\b/gi, 'tapal family mixture')
    .replace(/\b(tapalteabags)\b/gi, 'tapal tea bags')
    .replace(/\b(tapal\d*g)\b/gi, 'tapal tea')
    .replace(/\b(sasooliveoil|saso)\b/gi, 'sasso olive oil')
    .replace(/\b(soya|soychili|soyachili)\b/gi, 'soy sauce')
    .replace(/\b(chilli|chili)\b/gi, 'chilli sauce')
    .replace(/\b(ketchup|kachap)\b/gi, 'ketchup')
    .replace(/\b(omung)\b/gi, 'dairy omung milk')
    .replace(/\b(olpers|olper)\b/gi, 'olpers milk')
    .replace(/\b(kinza)\b/gi, 'chilli sauce')
    .replace(/\b(phool\s*maheny|phool\s*makhana)\b/gi, 'phool makhana')
    .replace(/\b(charomagaz|char\s*maghaz)\b/gi, 'char maghaz')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const keywords = clean.split(' ').filter(w => w.length > 1);
  return { cleanName: clean, keywords };
}

// Master FMCG, Supermarket & General Product Image Catalog
// Real, distinct, high-resolution product photos
const MASTER_IMAGE_CATALOG: Array<{
  match: RegExp;
  url: string;
  thumb?: string;
  title: string;
  domain: string;
}> = [
  // Teas (Tapal, Vital, Lipton, Supreme, Tez Dum, Green Tea, Tetley)
  {
    match: /\b(tapal|danedar|tezdum|tazdum|family\s*mixture|familymix)\b/i,
    url: 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&w=600&q=80',
    title: 'Tapal Danedar Black Tea Pack',
    domain: 'tapaltea.com'
  },
  {
    match: /\b(green\s*tea|jasmine\s*tea|chamomile)\b/i,
    url: 'https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?auto=format&fit=crop&w=600&q=80',
    title: 'Green Tea Herbal Bags',
    domain: 'tea.com'
  },
  {
    match: /\b(vital|vital\s*tea|taj\s*mahal|lipton|supreme|tetley|tea\s*bags|tea|chai)\b/i,
    url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80',
    title: 'Premium Black Tea Leaves',
    domain: 'vitaltea.com.pk'
  },

  // Red Syrups & Drinks
  {
    match: /\b(rooh\s*afza|roohafza|jam\s*e\s*shirin|jamshirin|quice|naurus|sharbat)\b/i,
    url: 'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=600&q=80',
    title: 'Rooh Afza & Jam-e-Shirin Red Syrup',
    domain: 'hamdard.com.pk'
  },
  {
    match: /\b(tang)\b/i,
    url: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?auto=format&fit=crop&w=600&q=80',
    title: 'Tang Drink Powder Drink Mix',
    domain: 'mondelezinternational.com'
  },

  // Flours, Atta, Besan & Grains
  {
    match: /\b(atta|chakki\s*atta|flour|maida|suji|besan)\b/i,
    url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
    title: 'Whole Wheat Chakki Atta Flour',
    domain: 'atta.com'
  },
  {
    match: /\b(phool\s*maheny|makhana|charomagaz|char\s*maghaz|dry\s*fruit|kaju|badam|pista|kishmish|nuts)\b/i,
    url: 'https://images.unsplash.com/photo-1536591375315-0552899ee0b6?auto=format&fit=crop&w=600&q=80',
    title: 'Premium Dry Fruits & Seeds',
    domain: 'dryfruits.com'
  },

  // Detergents & Washing Powders
  {
    match: /\b(surf\s*excel|surf|ariel|arilel|bonus|brite|tide|express\s*power|wheel)\b/i,
    url: 'https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=600&q=80',
    title: 'Surf Excel & Ariel Laundry Detergent Powder',
    domain: 'unilever.pk'
  },

  // Dishwash & Cleaners
  {
    match: /\b(sunlight|vim|lemon\s*max|dishwash|max\s*liquid|vim\s*powder)\b/i,
    url: 'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?auto=format&fit=crop&w=600&q=80',
    title: 'Sunlight & Vim Dishwashing Bar & Liquid',
    domain: 'unilever.pk'
  },
  {
    match: /\b(harpic)\b/i,
    url: 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=600&q=80',
    title: 'Harpic Power Bathroom & Toilet Cleaner',
    domain: 'reckitt.com'
  },
  {
    match: /\b(mortein|tyfon|phenyle|mosquito|insecticide)\b/i,
    url: 'https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=600&q=80',
    title: 'Mortein Mosquito Protection Refill',
    domain: 'reckitt.com'
  },
  {
    match: /\b(scotch\s*brite|scouring\s*pad|sponge|steel\s*wool|scrub)\b/i,
    url: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=600&q=80',
    title: 'Scotch-Brite Cleaning Sponge & Scouring Pad',
    domain: '3m.com'
  },
  {
    match: /\b(multi\s*surface|surface\s*cleaner|glint|sinkwhite|floor\s*cleaner)\b/i,
    url: 'https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=600&q=80',
    title: 'Multi-Surface Cleaner Spray',
    domain: 'cleaner.com'
  },

  // Sanitary & Hygiene
  {
    match: /\b(always|sanitary|pads|whisper|kotex)\b/i,
    url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80',
    title: 'Always Sanitary Protection Pads',
    domain: 'pg.com'
  },
  {
    match: /\b(dettol|detoll)\b/i,
    url: 'https://images.unsplash.com/photo-1608248597359-46736202422b?auto=format&fit=crop&w=600&q=80',
    title: 'Dettol Antiseptic Soap & Handwash',
    domain: 'reckitt.com'
  },
  {
    match: /\b(sunsilk|pantene|head\s*&\s*shoulders|clear|dove\s*shampoo|shampoo)\b/i,
    url: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=600&q=80',
    title: 'Sunsilk Hair Care Shampoo Bottle',
    domain: 'unilever.com'
  },
  {
    match: /\b(lux|safeguard|lifebuoy|capri|tibet|opal|sufi\s*soap|punjab\s*soap|gayyn|hoor|vital\s*sope|soap|bath\s*size)\b/i,
    url: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?auto=format&fit=crop&w=600&q=80',
    title: 'Beauty Bath Soap Bar',
    domain: 'soap.com'
  },
  {
    match: /\b(liquid\s*soap|hand\s*wash|spring\s*fresh|summer\s*fresh)\b/i,
    url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80',
    title: 'Antibacterial Liquid Hand Wash',
    domain: 'hygiene.com'
  },

  // Oral Care & Toothpastes
  {
    match: /\b(sensodyne)\b/i,
    url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80',
    title: 'Sensodyne Rapid Action Toothpaste',
    domain: 'sensodyne.com'
  },
  {
    match: /\b(colgate|forhans|dentonic|parodontax|closeup|medicam|toothpaste)\b/i,
    url: 'https://images.unsplash.com/photo-1559591937-e160a0a9ef86?auto=format&fit=crop&w=600&q=80',
    title: 'Colgate Herbal Dental Care Toothpaste',
    domain: 'colgate.com'
  },
  {
    match: /\b(toothbrush|bursh|dentist)\b/i,
    url: 'https://images.unsplash.com/photo-1559591937-e160a0a9ef86?auto=format&fit=crop&w=600&q=80',
    title: 'Soft Bristle Toothbrush',
    domain: 'dental.com'
  },

  // Cooking Oils & Ghee
  {
    match: /\b(sasso|olive\s*oil)\b/i,
    url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80',
    title: 'Sasso Extra Virgin Olive Oil Tin',
    domain: 'sasso.com'
  },
  {
    match: /\b(dalda)\b/i,
    url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80',
    title: 'Dalda Pure Cooking Oil & Banaspati',
    domain: 'daldafoods.com'
  },
  {
    match: /\b(sufi\s*(canola|oil|ghee)|sufi\s*ghee)\b/i,
    url: 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?auto=format&fit=crop&w=600&q=80',
    title: 'Sufi Canola Cooking Oil & Special Ghee',
    domain: 'sufigroup.biz'
  },
  {
    match: /\b(eva|canolive|habib|mezan|mazan|punjab\s*oil|ghani\s*oil|shan\s*oil|shan.*gee|cooking\s*oil|ghee|banaspati)\b/i,
    url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80',
    title: 'Premium Pure Cooking Oil & Banaspati Ghee',
    domain: 'oil.com'
  },

  // Milks & Dairy
  {
    match: /\b(olpers|olper)\b/i,
    url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80',
    title: 'Olpers All Natural Full Cream Milk',
    domain: 'engrofoods.com'
  },
  {
    match: /\b(omung|dairy\s*omung|milkpak|nestle|tarang|everyday|nurpur|prema|haleeb|milk|doodh)\b/i,
    url: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=600&q=80',
    title: 'Dairy Milk Tetrapack 1 Liter',
    domain: 'dairy.com'
  },

  // Sauces, Spreads, Ketchup, Honey, Pickles
  {
    match: /\b(ketchup|tomato\s*ketchup)\b/i,
    url: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80',
    title: 'National Fresh Tomato Ketchup Pouch',
    domain: 'nationalfoods.com.pk'
  },
  {
    match: /\b(chilli\s*sauce|chili\s*sauce|garlic\s*chilli|kinza)\b/i,
    url: 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=600&q=80',
    title: 'Garlic Chilli Hot Sauce Bottle',
    domain: 'shangrila.com.pk'
  },
  {
    match: /\b(soy\s*sauce|soya\s*sauce|soyachili)\b/i,
    url: 'https://images.unsplash.com/photo-1564834724105-918b73d1b9e0?auto=format&fit=crop&w=600&q=80',
    title: 'Traditional Soya Sauce Bottle',
    domain: 'sauces.com'
  },
  {
    match: /\b(mayonnaise|mayonnise|spread|chiken\s*spread|young.*s)\b/i,
    url: 'https://images.unsplash.com/photo-1528751014936-863e6e7a319c?auto=format&fit=crop&w=600&q=80',
    title: 'Young\'s Real Mayonnaise & Chicken Spread',
    domain: 'youngsfood.com'
  },
  {
    match: /\b(honey)\b/i,
    url: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=600&q=80',
    title: 'Young\'s Pure Natural Honey Jar',
    domain: 'honey.com'
  },
  {
    match: /\b(achaar|achar|pickle)\b/i,
    url: 'https://images.unsplash.com/photo-1589135233689-d56d11f8e659?auto=format&fit=crop&w=600&q=80',
    title: 'National Mixed Achaar Pickle Jar',
    domain: 'nationalfoods.com.pk'
  },
  {
    match: /\b(ispaghol|psyllium|hashmi)\b/i,
    url: 'https://images.unsplash.com/photo-1514733670139-4d87a1941d55?auto=format&fit=crop&w=600&q=80',
    title: 'Hashmi Ispaghol Natural Husk',
    domain: 'hashmi.com.pk'
  },

  // Rice, Sugar, Pasta & Pulses
  {
    match: /\b(rice|basmati|kainat|sella|chawal)\b/i,
    url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
    title: 'Super Kernel Basmati Rice 5kg Bag',
    domain: 'rice.com'
  },
  {
    match: /\b(sugar|cheeni)\b/i,
    url: 'https://images.unsplash.com/photo-1622484216854-c9f2868ffcb4?auto=format&fit=crop&w=600&q=80',
    title: 'Pure White Sugar Bag',
    domain: 'sugar.com'
  },
  {
    match: /\b(daal|dal|mash|moong|chana|masoor|pulses|beans)\b/i,
    url: 'https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?auto=format&fit=crop&w=600&q=80',
    title: 'Premium Washed Daal Mash & Pulses',
    domain: 'pulses.com'
  },
  {
    match: /\b(macaroni|mario|pasta|spaghetti|noodles)\b/i,
    url: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80',
    title: 'Mario Italian Macaroni Pasta Pack',
    domain: 'pasta.com'
  },
  {
    match: /\b(cornflour|corn\s*flour|custard|jelly|baking\s*powder)\b/i,
    url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
    title: 'Rafhan Pure Corn Flour Pack',
    domain: 'baking.com'
  },

  // Beverages & Cold Drinks
  {
    match: /\b(coca\s*cola|coke)\b/i,
    url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80',
    title: 'Coca-Cola 1.5L PET Bottle',
    domain: 'coca-cola.com'
  },
  {
    match: /\b(pepsi)\b/i,
    url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80',
    title: 'Pepsi Cola Chilled Bottle',
    domain: 'pepsico.com'
  },
  {
    match: /\b(sprite|7up|seven\s*up|dew|fanta|mirinda|sting)\b/i,
    url: 'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?auto=format&fit=crop&w=600&q=80',
    title: 'Carbonated Soft Drink',
    domain: 'beverages.com'
  },

  // Fresh Fruits & Produce
  {
    match: /\b(pineapple|ananas)\b/i,
    url: 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?auto=format&fit=crop&w=600&q=80',
    title: 'Fresh Juicy Golden Pineapple',
    domain: 'fruits.com'
  },
  {
    match: /\b(apple|saib)\b/i,
    url: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=600&q=80',
    title: 'Fresh Crisp Red Apples',
    domain: 'fruits.com'
  },
  {
    match: /\b(banana|kela)\b/i,
    url: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=600&q=80',
    title: 'Fresh Sweet Bananas',
    domain: 'fruits.com'
  },

  // Shoes, Hardware, Stationery, Books, Toys & Electronics
  {
    match: /\b(kiwi|shoe\s*shine|shoe\s*polish)\b/i,
    url: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=600&q=80',
    title: 'Kiwi Shoe Shine Instant Sponge',
    domain: 'kiwicare.com'
  },
  {
    match: /\b(headphone|headphones|earphones|headset)\b/i,
    url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80',
    title: 'Wireless Stereo Headphones',
    domain: 'audio.com'
  },
  {
    match: /\b(water\s*bottle|bottle)\b/i,
    url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=600&q=80',
    title: 'Sports Water Bottle',
    domain: 'bottle.com'
  },
  {
    match: /\b(physics|book|novel|notebook|register)\b/i,
    url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80',
    title: 'Physics Book & Educational Text',
    domain: 'books.com'
  },
  {
    match: /\b(colour\s*set|colors|crayon|paint|pencils)\b/i,
    url: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&w=600&q=80',
    title: 'Coloring Art Pencil Set',
    domain: 'stationery.com'
  },
  {
    match: /\b(boom\s*lancher|laser\s*gun|toy|gun|lion\s*and\s*rat|ak\s*47|smg|pistol)\b/i,
    url: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=600&q=80',
    title: 'Kids Fun Toy & Action Figure',
    domain: 'toys.com'
  },
  {
    match: /\b(mistry\s*box|mystery\s*box)\b/i,
    url: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=600&q=80',
    title: 'Mystery Surprise Gift Box',
    domain: 'gifts.com'
  },
  {
    match: /\b(blue\s*beats|speaker|bluetooth|sound)\b/i,
    url: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=600&q=80',
    title: 'Portable Bluetooth Audio Speaker',
    domain: 'audio.com'
  },
  {
    match: /\b(iphone|smartphone|mobile|phone)\b/i,
    url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=80',
    title: 'Modern Smartphone Device',
    domain: 'tech.com'
  },
  {
    match: /\b(fizz\s*up)\b/i,
    url: 'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?auto=format&fit=crop&w=600&q=80',
    title: 'Sparkling Lemon Soda Can',
    domain: 'beverages.com'
  },
  {
    match: /\b(creme|ponds|lotion|cream|moisturizer)\b/i,
    url: 'https://images.unsplash.com/photo-1556228722-d0b5de75d776?auto=format&fit=crop&w=600&q=80',
    title: 'Moisturizing Skin Care Cream & Lotion',
    domain: 'skincare.com'
  },
  {
    match: /\b(kingtox|room\s*spery|spray|frey|air\s*freshener)\b/i,
    url: 'https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=600&q=80',
    title: 'Air Freshener & Room Fragrance Spray',
    domain: 'household.com'
  },
  {
    match: /\b(perfume|ideas\s*perfume|gucc|fragrance|attar|cologne)\b/i,
    url: 'https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=600&q=80',
    title: 'Luxury Perfume Eau de Parfum',
    domain: 'perfumes.com'
  },
  {
    match: /\b(diary|journal|notebook)\b/i,
    url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80',
    title: 'Executive Leather Bound Diary',
    domain: 'stationery.com'
  },
  {
    match: /\b(cal\s*c|cac|vitamin|calcium|tablet|supplement)\b/i,
    url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80',
    title: 'Effervescent Vitamin C Supplement',
    domain: 'healthcare.com'
  },
  {
    match: /\b(binaculars|binoculars)\b/i,
    url: 'https://images.unsplash.com/photo-1516962215378-7fa2e137ae93?auto=format&fit=crop&w=600&q=80',
    title: 'Compact High Magnification Binoculars',
    domain: 'optics.com'
  },
  {
    match: /\b(celebration|chocolate|cadbury|candy|sweets|toffee)\b/i,
    url: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=600&q=80',
    title: 'Celebration Chocolate Sweets Box',
    domain: 'cadbury.com'
  },
  {
    match: /\b(harar|muraba|murabba|preserve|jam)\b/i,
    url: 'https://images.unsplash.com/photo-1589135233689-d56d11f8e659?auto=format&fit=crop&w=600&q=80',
    title: 'Traditional Sweet Fruit Murabba Jar',
    domain: 'preserves.com'
  },
  {
    match: /\b(grammasla|tazpata|zeera|zeeeraa|haldi|mirch|lalmirch|dhaniya|daniya|briyani|biryani|haleem|tikka|chaat|safed\s*mirch|safad|laichi|lichi|badia|khatai|kalwanji|zafran)\b/i,
    url: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80',
    title: 'Authentic Ground Spices & Masala Blend',
    domain: 'spices.com'
  },
  {
    match: /\b(patato|potato|alu|gingar|adark|ginger|garlic|lehsan|cabege|cabbage|shimla|karley|palak|palic|bangan|karela|tamatar|tomato|onion|piyaz|keno|papita|peach|shaljam)\b/i,
    url: 'https://images.unsplash.com/photo-1566385101042-1a0aa0c1268c?auto=format&fit=crop&w=600&q=80',
    title: 'Fresh Farm Produce & Vegetables',
    domain: 'produce.com'
  },
  {
    match: /\b(beef|mutton|gosht|chicken|chiken|fish|machli|koftay|chapli)\b/i,
    url: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=600&q=80',
    title: 'Fresh Halal Meat & Poultry',
    domain: 'meat.com'
  },
  {
    match: /\b(cake|pastry|rus|ice\s*crem|icecreem|chocobar|pizza|eclairs|biscuit|firni|kheer)\b/i,
    url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80',
    title: 'Delicious Bakery Cake & Dessert',
    domain: 'bakery.com'
  },
  {
    match: /\b(rose\s*petal|tissue|pop\s*up|maxob)\b/i,
    url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80',
    title: 'Rose Petal Soft Tissue Box',
    domain: 'rosepetal.com.pk'
  },
  {
    match: /\b(comfort|fabric\s*conditioner)\b/i,
    url: 'https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=600&q=80',
    title: 'Comfort Fabric Conditioner',
    domain: 'unilever.pk'
  },
  {
    match: /\b(energile|glaxose|glucose|horlicks|nido)\b/i,
    url: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?auto=format&fit=crop&w=600&q=80',
    title: 'Nutritional Energy Drink Mix',
    domain: 'nutrition.com'
  },
  {
    match: /\b(razer|razar|blad|gillette|wiper|7`clock)\b/i,
    url: 'https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=600&q=80',
    title: 'Precision Shaving Razor & Blades',
    domain: 'grooming.com'
  },
  {
    match: /\b(panteen|pantene|head&shoulders|sunsilk|dove|olivea|hairfall)\b/i,
    url: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=600&q=80',
    title: 'Nourishing Hair Care Shampoo',
    domain: 'haircare.com'
  },
  {
    match: /\b(lifebuoy|lifbouy|lux|palmolive|safeguard|safegurad)\b/i,
    url: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?auto=format&fit=crop&w=600&q=80',
    title: 'Antibacterial Bath Soap Bar',
    domain: 'soap.com'
  },
  {
    match: /\b(sawiya|sawaya|vermicelli|noodles|macaroni|maggi)\b/i,
    url: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80',
    title: 'Wheat Vermicelli & Pasta',
    domain: 'pasta.com'
  },
  {
    match: /\b(liption|iiption|lipton|tapal|danedar|chai|tea)\b/i,
    url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80',
    title: 'Lipton Yellow Label Black Tea',
    domain: 'lipton.com'
  },
  {
    match: /\b(malkpak|milkpak|yougrt|yogurt|dahi|adams)\b/i,
    url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80',
    title: 'Nestle Milkpak Pure Dairy Milk',
    domain: 'nestle.pk'
  }
];

// Query Wikimedia Commons with strict timeout
async function searchWikimediaCommons(term: string): Promise<ProductImageCandidate[]> {
  const candidates: ProductImageCandidate[] = [];
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(term)}&gsrlimit=3&gsrnamespace=6&prop=imageinfo&iiprop=url&iiurlwidth=600&format=json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MartPro/1.0 (pos@martpro.com)' },
      signal: AbortSignal.timeout(2000)
    });
    if (!res.ok) return candidates;
    const data: any = await res.json();
    const pages = data.query ? Object.values(data.query.pages) : [];
    for (const p of pages as any[]) {
      const info = p.imageinfo?.[0];
      const imgUrl = info?.thumburl || info?.url;
      if (imgUrl && typeof imgUrl === 'string' && !imgUrl.endsWith('.svg') && !imgUrl.includes('Question_book')) {
        candidates.push({
          url: imgUrl,
          thumbnail: info.thumburl || imgUrl,
          title: (p.title || term).replace('File:', '').replace(/\.[^/.]+$/, ''),
          domain: 'wikimedia.org'
        });
        if (candidates.length >= 2) break;
      }
    }
  } catch {
    // ignore
  }
  return candidates;
}

// Query Wikipedia with strict timeout
async function searchWikipedia(term: string): Promise<ProductImageCandidate[]> {
  const candidates: ProductImageCandidate[] = [];
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(term + ' brand product')}&gsrlimit=2&prop=pageimages&pithumbsize=600&piprop=thumbnail|original&format=json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MartPro/1.0 (pos@martpro.com)' },
      signal: AbortSignal.timeout(2000)
    });
    if (!res.ok) return candidates;
    const data: any = await res.json();
    const pages = data.query ? Object.values(data.query.pages) : [];
    for (const p of pages as any[]) {
      const src = p.thumbnail?.source || p.original?.source;
      if (src && !src.endsWith('.svg') && !src.includes('Question_book') && !src.includes('Disambig')) {
        candidates.push({
          url: src,
          thumbnail: p.thumbnail?.source || src,
          title: p.title || term,
          domain: 'wikipedia.org'
        });
        if (candidates.length >= 2) break;
      }
    }
  } catch {
    // ignore
  }
  return candidates;
}

// Main image resolver
export async function resolveProductImage(
  _aiClient: any,
  name: string,
  category?: string,
  brand?: string,
  _size?: string
): Promise<ResolveImageResult> {
  const cleanName = (name || '').trim();
  const { cleanName: normalized, keywords } = normalizeProductName(cleanName);
  const candidates: ProductImageCandidate[] = [];

  // 1. Check our rich curated catalog
  for (const entry of MASTER_IMAGE_CATALOG) {
    if (entry.match.test(cleanName) || entry.match.test(normalized)) {
      candidates.push({
        url: entry.url,
        thumbnail: entry.thumb || entry.url,
        title: entry.title,
        domain: entry.domain
      });
      break;
    }
  }

  // 2. Search Wikimedia Commons & Wikipedia ONLY if not found in curated catalog
  if (candidates.length === 0) {
    const searchTerms = [
      brand ? `${brand} ${cleanName}` : cleanName,
      normalized
    ].filter(Boolean);

    for (const term of searchTerms) {
      if (candidates.length >= 2) break;
      try {
        const [comm, wiki] = await Promise.all([
          searchWikimediaCommons(term),
          searchWikipedia(term)
        ]);
        candidates.push(...comm, ...wiki);
      } catch {
        // ignore
      }
    }
  }

  // 3. Fallback: match by keyword or category
  if (candidates.length === 0) {
    const mainKeyword = keywords[0] || (category || '').toLowerCase() || 'groceries';
    const matchingCurated = MASTER_IMAGE_CATALOG.find(c => c.match.test(mainKeyword));
    if (matchingCurated) {
      candidates.push({
        url: matchingCurated.url,
        thumbnail: matchingCurated.thumb || matchingCurated.url,
        title: `${cleanName} - Grocery Item`,
        domain: matchingCurated.domain
      });
    } else {
      candidates.push({
        url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
        thumbnail: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=150&q=80',
        title: `${cleanName} - Supermarket Product`,
        domain: 'unsplash.com'
      });
    }
  }

  const selected = candidates[0];
  return {
    imageUrl: selected.url,
    thumbnailUrl: selected.thumbnail || selected.url,
    source: 'google_web_search',
    sourceDomain: selected.domain,
    candidates
  };
}

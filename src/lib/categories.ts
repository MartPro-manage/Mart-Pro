import { db, doc, updateDoc, setDoc, deleteDoc, getDocs, collection, query, where, handleFirestoreError, OperationType } from './firebase';
import { Product, Store, ManagedCategory, CompanyBrand } from '../types';

export const DEFAULT_PRESET_CATEGORIES: string[] = [
  'Grain',
  'Biscuit',
  'Oil',
  'Ghee',
  'Tea',
  'Toys',
  'Detergent',
  'Soap',
  'Laundry',
  'General',
  'Grocery',
  'Dairy',
  'Beverages',
  'Snacks',
  'Bakery',
  'Spices',
  'Personal Care',
  'Fruits & Vegetables'
];

/**
 * Built-in default taxonomy seeded for any store:
 * Categories -> Companies / Brands -> Multiple Sizes / Quantities
 */
export const DEFAULT_TAXONOMY_CATEGORIES: Omit<ManagedCategory, 'id' | 'storeId' | 'createdAt'>[] = [
  {
    name: 'Beverages',
    description: 'Cold drinks, juices, mineral water & sodas',
    icon: 'Coffee',
    companies: [
      {
        id: 'coca-cola',
        name: 'The Coca-Cola Company',
        sizes: ['250ml Regular Glass', '300ml Can', '500ml Pet', '1 Liter', '1.5 Liter', '2.25 Liter']
      },
      {
        id: 'pepsico',
        name: 'PepsiCo',
        sizes: ['250ml Regular Glass', '300ml Can', '500ml Pet', '1 Liter', '1.5 Liter', '2.25 Liter']
      },
      {
        id: 'nestle-beverages',
        name: 'Nestle (Fruita Vitals & Pure Life)',
        sizes: ['200ml Tetra', '500ml Bottle', '1 Liter Tetra', '1.5 Liter Bottle', '5 Liter Can']
      },
      {
        id: 'shezan',
        name: 'Shezan International',
        sizes: ['250ml Glass', '1 Liter Tetra Pack', 'Tetra Pack 200ml']
      }
    ]
  },
  {
    name: 'Dairy',
    description: 'Milk, butter, cheese, cream, yogurt & tea whiteners',
    icon: 'Milk',
    companies: [
      {
        id: 'olpers',
        name: "Engro Foods (Olper's)",
        sizes: ['250ml Tetra', '1 Liter Family Pack', '1.5 Liter Eco Pack', 'Cream 200ml']
      },
      {
        id: 'milkpak',
        name: 'Nestle MilkPak',
        sizes: ['250ml Tetra', '1 Liter Tetra', '1.5 Liter Tetra', 'Cream 200g']
      },
      {
        id: 'tarang',
        name: 'Tarang Tea Whitener',
        sizes: ['225ml Tetra', '1 Liter Tetra']
      },
      {
        id: 'nurpur',
        name: 'Noorpur Dairy',
        sizes: ['250ml', '1 Liter', 'Butter 200g', 'Cheese 200g']
      }
    ]
  },
  {
    name: 'Snacks',
    description: 'Potato chips, nimko, extruded snacks & corn puffs',
    icon: 'Cookie',
    companies: [
      {
        id: 'lays',
        name: 'Lays (PepsiCo Snacks)',
        sizes: ['Rs. 30 Pack (22g)', 'Rs. 50 Pack (38g)', 'Rs. 100 Pack (80g)', 'Family Sharing Pack (140g)']
      },
      {
        id: 'kurkure',
        name: 'Kurkure',
        sizes: ['Rs. 30 Pack', 'Rs. 50 Pack', 'Rs. 100 Pack']
      },
      {
        id: 'kolson-snacks',
        name: 'Kolson (Slanty & Potato Sticks)',
        sizes: ['Small Pack (15g)', 'Medium Pack (35g)', 'Party Pack (75g)']
      }
    ]
  },
  {
    name: 'Biscuit',
    description: 'Sweet biscuits, cookies, cream wafers & crackers',
    icon: 'Cookie',
    companies: [
      {
        id: 'peek-freans',
        name: 'English Biscuit Manufacturers (Peek Freans)',
        sizes: ['Half Roll Pack', 'Family Pack', 'Tiffin Pack', 'Snack Pack (Rs. 20)']
      },
      {
        id: 'continental-lu',
        name: 'Continental Biscuits (LU - Prince / Tuc / Oreo)',
        sizes: ['Half Roll Pack', 'Family Pack', 'Tiffin Box', 'Snack Pack']
      },
      {
        id: 'bisconni',
        name: 'Bisconni (Chocolatto / Rite / Novita)',
        sizes: ['Half Roll Pack', 'Family Pack', 'Tiffin Box']
      }
    ]
  },
  {
    name: 'Oil',
    description: 'Cooking oils, banaspati ghee & olive oils',
    icon: 'Droplet',
    companies: [
      {
        id: 'dalda',
        name: 'Dalda Foods',
        sizes: ['1 Liter Pouch', '1 kg Pouch', '2.5 Liter Tin', '5 Liter Jerry Can', '16 Liter Tin']
      },
      {
        id: 'habib-oil',
        name: 'Habib Oil Mills',
        sizes: ['1 Liter Pouch', '2.5 Liter Tin', '5 Liter Jerry Can']
      },
      {
        id: 'kisan-oil',
        name: 'Kisan Cooking Oil & Banaspati',
        sizes: ['1 Liter Pouch', '2.5 Liter Tin', '5 Liter Jerry Can']
      },
      {
        id: 'sufi-oil',
        name: 'Sufi Banaspati & Cooking Oil',
        sizes: ['1 Liter Pouch', '5 Liter Jerry Can', '16 Liter Tin']
      }
    ]
  },
  {
    name: 'Tea',
    description: 'Black tea, green tea, teabags & coffee',
    icon: 'Coffee',
    companies: [
      {
        id: 'tapal',
        name: 'Tapal Tea (Danedar / Mezban / Green Tea)',
        sizes: ['95g Pack', '190g Pack', '380g Pack', '450g Pack', '900g Family Pack', '100 Tea Bags']
      },
      {
        id: 'lipton',
        name: 'Unilever Lipton Yellow Label',
        sizes: ['95g Pack', '190g Pack', '380g Pack', '475g Pack', '900g Family Pack', '50 Tea Bags']
      },
      {
        id: 'vital-tea',
        name: 'Vital Tea',
        sizes: ['100g Pack', '200g Pack', '400g Pack', '900g Pack']
      },
      {
        id: 'nescafe',
        name: 'Nescafe Classic & 3-in-1',
        sizes: ['50g Glass Jar', '100g Glass Jar', '200g Glass Jar', 'Sachet Strip (x24)']
      }
    ]
  },
  {
    name: 'Grain',
    description: 'Basmati rice, wheat flour, lentils, pulses & sugar',
    icon: 'Wheat',
    companies: [
      {
        id: 'sunridge-flour',
        name: 'Sunridge Foods (Atta & Chakki Flour)',
        sizes: ['5 kg Bag', '10 kg Bag', '20 kg Bag']
      },
      {
        id: 'guard-rice',
        name: 'Guard Basmati Rice',
        sizes: ['1 kg Pouch', '2 kg Pouch', '5 kg Bag', '10 kg Bag']
      },
      {
        id: 'loose-grain',
        name: 'Store Loose Grain & Pulses (Unbranded / Bulk)',
        sizes: ['500g Loose', '1 kg Loose', '2 kg Loose', '5 kg Bag', '50 kg Jute Bag']
      }
    ]
  },
  {
    name: 'Soap',
    description: 'Beauty bars, antibacterial bath soaps & handwashes',
    icon: 'Sparkles',
    companies: [
      {
        id: 'unilever-lux',
        name: 'Unilever (Lux / Lifebuoy)',
        sizes: ['100g Bar', '140g Special Bar', '175g Jumbo Bar', 'Pack of 3 Soap']
      },
      {
        id: 'reckitt-dettol',
        name: 'Reckitt Benckiser (Dettol)',
        sizes: ['75g Bar', '110g Bar', '165g Bar', 'Liquid Handwash 250ml']
      },
      {
        id: 'safeguard',
        name: 'Procter & Gamble (Safeguard)',
        sizes: ['75g Bar', '115g Bar', '175g Bar']
      }
    ]
  },
  {
    name: 'Detergent',
    description: 'Washing powders, liquid laundry detergents & bar soaps',
    icon: 'Wind',
    companies: [
      {
        id: 'surf-excel',
        name: 'Unilever Surf Excel',
        sizes: ['500g Pouch', '1 kg Pouch', '2 kg Pouch', '5 kg Bucket']
      },
      {
        id: 'ariel',
        name: 'P&G Ariel Washing Powder',
        sizes: ['500g Pouch', '1 kg Pouch', '2 kg Pouch', '5 kg Bucket']
      },
      {
        id: 'bonus',
        name: 'Colgate-Palmolive (Bonus Tristar / Brite)',
        sizes: ['500g Pouch', '1 kg Pouch', '2 kg Pouch']
      }
    ]
  },
  {
    name: 'Laundry',
    description: 'Fabric care, washing bars, liquid detergents & bleaches',
    icon: 'Wind',
    companies: [
      {
        id: 'surf-excel-laundry',
        name: 'Unilever Surf Excel',
        sizes: ['500g Pouch', '1 kg Pouch', '2 kg Pouch', '5 kg Bucket', '250g Washing Bar']
      },
      {
        id: 'ariel-laundry',
        name: 'P&G Ariel',
        sizes: ['500g Pouch', '1 kg Pouch', '2 kg Pouch', '3 kg Family Pack']
      },
      {
        id: 'brite-laundry',
        name: 'Brite Maximum Power',
        sizes: ['500g Pouch', '1 kg Pouch', '200g Bar']
      },
      {
        id: 'robin-blue',
        name: 'Reckitt Robin Blue',
        sizes: ['75ml Bottle', '150ml Bottle', '100g Powder']
      }
    ]
  },
  {
    name: 'Ghee',
    description: 'Banaspati ghee, pure desi ghee & vegetable cooking fats',
    icon: 'Droplet',
    companies: [
      {
        id: 'dalda-ghee',
        name: 'Dalda Foods (Pure Desi & Banaspati Ghee)',
        sizes: ['1 kg Pouch', '1 Liter Pouch', '2.5 kg Tin', '5 kg Tin', '16 kg Tin']
      },
      {
        id: 'habib-ghee',
        name: 'Habib Banaspati Ghee',
        sizes: ['1 kg Pouch', '2.5 kg Tin', '5 kg Tin']
      },
      {
        id: 'kisan-ghee',
        name: 'Kisan Banaspati Ghee',
        sizes: ['1 kg Pouch', '2.5 kg Tin', '5 kg Tin']
      },
      {
        id: 'sufi-ghee',
        name: 'Sufi Banaspati & Pure Desi Ghee',
        sizes: ['1 kg Pouch', '1 kg Jar', '2.5 kg Tin', '5 kg Tin']
      }
    ]
  },
  {
    name: 'Spices',
    description: 'Recipe spice mixes, plain ground spices & whole seeds',
    icon: 'Sparkles',
    companies: [
      {
        id: 'national-spices',
        name: 'National Foods',
        sizes: ['Biryani Masala 50g', 'Bombay Biryani 50g', 'Chicken Karahi 50g', 'Qorma Masala 50g', 'Red Chilli 200g', 'Turmeric / Haldi 100g', 'Chaat Masala 50g']
      },
      {
        id: 'shan-spices',
        name: 'Shan Foods',
        sizes: ['Special Bombay Biryani 60g', 'Chicken Masala 50g', 'Nihari Masala 50g', 'Haleem Mix 50g', 'Red Chilli Powder 200g', 'Coriander Powder 100g']
      },
      {
        id: 'mehran-spices',
        name: 'Mehran Spices',
        sizes: ['Garam Masala 100g', 'Black Pepper 100g', 'Cumin / Zeera 100g', 'Biryani Masala 50g']
      },
      {
        id: 'loose-spices',
        name: 'Whole / Loose Bazaar Spices',
        sizes: ['50g Loose', '100g Loose', '250g Loose', '500g Loose', '1 kg Loose']
      }
    ]
  },
  {
    name: 'Bakery',
    description: 'Fresh sliced bread, buns, rusk, cakes & confectionery',
    icon: 'Cookie',
    companies: [
      {
        id: 'dawn-bread',
        name: 'Dawn Bread',
        sizes: ['Plain Bread Large', 'Plain Bread Small', 'Milky Bread Large', 'Brown Bread', 'Burger Buns 4-pack', 'Rusk 300g']
      },
      {
        id: 'bake-parlor',
        name: 'Bake Parlor',
        sizes: ['Sandwich Bread Large', 'Plain Buns 4-pack', 'Cake Rusk 250g', 'Fruit Cake Medium']
      },
      {
        id: 'gourmet-bakery',
        name: 'Gourmet Bakers',
        sizes: ['Plain Bread Large', 'Tea Rusk 400g', 'Cupcakes 6-pack', 'Puff Pastry 200g']
      }
    ]
  },
  {
    name: 'Personal Care',
    description: 'Shampoos, soaps, toothpastes, creams & lotions',
    icon: 'Sparkles',
    companies: [
      {
        id: 'unilever-personal',
        name: 'Unilever (Dove / Sunsilk / Lifebuoy / Pond\'s)',
        sizes: ['Shampoo 180ml', 'Shampoo 360ml', 'Face Wash 100g', 'Body Lotion 200ml', 'Beauty Bar 135g']
      },
      {
        id: 'pg-personal',
        name: 'Procter & Gamble (Head & Shoulders / Pantene / Gillette)',
        sizes: ['Shampoo 180ml', 'Shampoo 360ml', 'Conditioner 180ml', 'Shaving Foam 200ml', 'Gillette Mach3 Razor']
      },
      {
        id: 'colgate-personal',
        name: 'Colgate-Palmolive (Colgate / Palmolive)',
        sizes: ['Colgate Max Cavity 75g', 'Colgate Max Cavity 150g', 'Palmolive Body Wash 250ml', 'Colgate Toothbrush Twin']
      }
    ]
  },
  {
    name: 'Fruits & Vegetables',
    description: 'Fresh fruits, farm vegetables & leafy greens',
    icon: 'Package',
    companies: [
      {
        id: 'farm-fresh',
        name: 'Fresh Farm Produce (Daily Market)',
        sizes: ['500g', '1 kg', '2 kg', '5 kg Bag', '1 Dozen', 'Single Piece']
      },
      {
        id: 'organic-produce',
        name: 'Certified Organic Harvest',
        sizes: ['500g Pre-pack', '1 kg Pre-pack', 'Salad Clamshell 250g']
      },
      {
        id: 'imported-fruits',
        name: 'Imported Premium Fruits',
        sizes: ['1 kg Pack', 'Per Piece', 'Gift Box Pack']
      }
    ]
  },
  {
    name: 'Toys',
    description: 'Action figures, diecast cars, playsets & educational toys',
    icon: 'Package',
    companies: [
      {
        id: 'kidzone-toys',
        name: 'KidZone Premium Toys',
        sizes: ['Single Piece', 'Small Box Set', 'Medium Playset', 'Large Gift Box']
      },
      {
        id: 'mattel-hotwheels',
        name: 'Mattel / Hot Wheels',
        sizes: ['1 Diecast Car', '5-Car Gift Pack', 'Track Set']
      },
      {
        id: 'lego-blocks',
        name: 'Lego / Building Blocks',
        sizes: ['Starter Pack 50pcs', 'Medium Box 200pcs', 'Creator Set 500pcs']
      }
    ]
  },
  {
    name: 'Grocery',
    description: 'Essential packaged provisions, staples & household goods',
    icon: 'Package',
    companies: [
      {
        id: 'martpro-grocery',
        name: 'MartPro Wholesale Grocery',
        sizes: ['250g Pack', '500g Pack', '1 kg Pack', '2 kg Pack', '5 kg Pack', 'Carton / Box']
      },
      {
        id: 'national-grocery',
        name: 'National Commercial Supplier',
        sizes: ['Standard Pack', 'Family Pack', 'Twin Pack', 'Wholesale Pack']
      }
    ]
  },
  {
    name: 'General',
    description: 'General supermarket goods, kitchen items & household',
    icon: 'Package',
    companies: [
      {
        id: 'general-brand',
        name: 'Standard Wholesale Supplier',
        sizes: ['1 Piece', 'Small Size', 'Medium Size', 'Large Size', 'Pack of 6', '1 Dozen']
      },
      {
        id: 'local-distributor',
        name: 'Local Store Supplier',
        sizes: ['1 Piece', 'Pack of 2', 'Pack of 6', '1 Dozen', 'Box of 24']
      }
    ]
  }
];

/**
 * Returns a deduplicated array of all available categories:
 * Default presets + Store custom categories + Any category used in products + Managed Categories.
 */
export function getAllCategories(
  store?: Store | null, 
  products?: Product[], 
  managedCategories?: ManagedCategory[]
): string[] {
  const set = new Set<string>();

  // 1. Add Default Presets
  DEFAULT_PRESET_CATEGORIES.forEach(c => {
    if (c?.trim()) set.add(c.trim());
  });

  // 2. Add Managed Categories
  if (managedCategories && Array.isArray(managedCategories)) {
    managedCategories.forEach(mc => {
      if (mc.name?.trim()) set.add(mc.name.trim());
    });
  }

  // 3. Add Store Custom Categories
  if (store?.customCategories && Array.isArray(store.customCategories)) {
    store.customCategories.forEach(c => {
      if (c?.trim()) set.add(c.trim());
    });
  }

  // 4. Add Existing Product Categories
  if (products && Array.isArray(products)) {
    products.forEach(p => {
      if (p.category?.trim()) set.add(p.category.trim());
    });
  }

  return Array.from(set);
}

/**
 * Fetch all managed categories for a specific store from Firestore.
 */
export async function fetchStoreManagedCategories(storeId: string): Promise<ManagedCategory[]> {
  if (!storeId) return [];
  try {
    const q = query(collection(db, 'categories'), where('storeId', '==', storeId));
    const snapshot = await getDocs(q);
    const list: ManagedCategory[] = [];
    snapshot.forEach(docSnap => {
      list.push({ id: docSnap.id, ...docSnap.data() } as ManagedCategory);
    });

    // If store has no categories yet, automatically seed with default taxonomy
    if (list.length === 0) {
      return await seedDefaultCategoriesForStore(storeId);
    }

    return list.sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.warn('Failed to fetch categories from Firestore:', err);
    return [];
  }
}

/**
 * Seed store with default taxonomy categories, companies & sizes
 */
export async function seedDefaultCategoriesForStore(storeId: string): Promise<ManagedCategory[]> {
  if (!storeId) return [];
  const seededList: ManagedCategory[] = [];

  for (const template of DEFAULT_TAXONOMY_CATEGORIES) {
    try {
      const docRef = doc(collection(db, 'categories'));
      const newCat: ManagedCategory = {
        id: docRef.id,
        storeId,
        name: template.name,
        description: template.description,
        icon: template.icon,
        companies: template.companies,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(docRef, newCat);
      seededList.push(newCat);
    } catch (e) {
      console.warn(`Failed to seed category ${template.name}:`, e);
    }
  }

  return seededList;
}

/**
 * Create or update a managed category in Firestore
 */
export async function saveManagedCategory(category: ManagedCategory): Promise<void> {
  if (!category.id || !category.storeId) return;
  const docRef = doc(db, 'categories', category.id);
  await setDoc(docRef, {
    ...category,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

/**
 * Delete a managed category from Firestore
 */
export async function deleteManagedCategory(categoryId: string): Promise<void> {
  if (!categoryId) return;
  await deleteDoc(doc(db, 'categories', categoryId));
}

/**
 * Adds a company under a category
 */
export function addCompanyToCategory(
  category: ManagedCategory,
  companyName: string,
  initialSizes: string[] = []
): ManagedCategory {
  const trimmed = companyName.trim();
  if (!trimmed) return category;

  const newCompany: CompanyBrand = {
    id: `comp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: trimmed,
    sizes: initialSizes,
    createdAt: new Date().toISOString()
  };

  const existing = category.companies || [];
  return {
    ...category,
    companies: [...existing, newCompany],
    updatedAt: new Date().toISOString()
  };
}

/**
 * Updates sizes / quantities for a company under a category
 */
export function updateCompanySizes(
  category: ManagedCategory,
  companyId: string,
  sizes: string[]
): ManagedCategory {
  const updatedCompanies = (category.companies || []).map(comp => {
    if (comp.id === companyId) {
      return { ...comp, sizes: Array.from(new Set(sizes.map(s => s.trim()).filter(Boolean))) };
    }
    return comp;
  });

  return {
    ...category,
    companies: updatedCompanies,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Deletes a company from a category
 */
export function deleteCompanyFromCategory(
  category: ManagedCategory,
  companyId: string
): ManagedCategory {
  const updatedCompanies = (category.companies || []).filter(comp => comp.id !== companyId);
  return {
    ...category,
    companies: updatedCompanies,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Deletes all companies and their sizes from a category
 */
export function deleteAllCompaniesFromCategory(
  category: ManagedCategory
): ManagedCategory {
  return {
    ...category,
    companies: [],
    updatedAt: new Date().toISOString()
  };
}

/**
 * Deletes all sizes for a specific company under a category
 */
export function deleteAllSizesFromCompany(
  category: ManagedCategory,
  companyId: string
): ManagedCategory {
  const updatedCompanies = (category.companies || []).map(comp => {
    if (comp.id === companyId) {
      return { ...comp, sizes: [] };
    }
    return comp;
  });

  return {
    ...category,
    companies: updatedCompanies,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Deletes all sizes from all companies under a category
 */
export function deleteAllSizesFromCategoryCompanies(
  category: ManagedCategory
): ManagedCategory {
  const updatedCompanies = (category.companies || []).map(comp => ({
    ...comp,
    sizes: []
  }));

  return {
    ...category,
    companies: updatedCompanies,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Saves a new custom category name to the store document in Firestore.
 */
export async function saveNewCategoryToStore(storeId: string, currentCustom: string[] = [], newCategory: string): Promise<string[]> {
  const trimmed = newCategory.trim();
  if (!trimmed) return currentCustom;

  if (currentCustom.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
    return currentCustom;
  }

  const updated = [...currentCustom, trimmed];
  try {
    const storeRef = doc(db, 'stores', storeId);
    await updateDoc(storeRef, {
      customCategories: updated
    });

    // Also auto-create a category document in categories collection if not present
    const docRef = doc(collection(db, 'categories'));
    await setDoc(docRef, {
      id: docRef.id,
      storeId,
      name: trimmed,
      companies: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `stores/${storeId}`);
  }

  return updated;
}

/**
 * Convenient wrapper returning status and message for adding custom category.
 */
export async function addCustomCategoryToStore(
  storeId: string,
  newCategory: string,
  currentCustom: string[] = []
): Promise<{ success: boolean; categories: string[]; error?: string }> {
  const trimmed = newCategory.trim();
  if (!trimmed) {
    return { success: false, categories: currentCustom, error: 'Category name is required.' };
  }
  try {
    const updated = await saveNewCategoryToStore(storeId, currentCustom, trimmed);
    return { success: true, categories: updated };
  } catch (err: any) {
    return { success: false, categories: currentCustom, error: err?.message || 'Failed to save category.' };
  }
}

/**
 * Safely normalizes a size entry to a clean string label.
 */
export function normalizeSizeLabel(sz: any): string {
  if (!sz) return '';
  if (typeof sz === 'string') return sz.trim();
  if (typeof sz === 'object' && sz.name) return String(sz.name).trim();
  return String(sz).trim();
}

/**
 * Common packaging sizes by commodity type
 */
export function getDefaultSizesForCategory(categoryName: string): string[] {
  const lower = (categoryName || '').toLowerCase();
  if (lower.includes('beverag') || lower.includes('drink') || lower.includes('juice') || lower.includes('soda') || lower.includes('water')) {
    return ['250ml Glass', '300ml Can', '500ml Pet', '1 Liter', '1.5 Liter', '2.25 Liter'];
  }
  if (lower.includes('milk') || lower.includes('dairy')) {
    return ['250ml Tetra', '500ml Pack', '1 Liter Family Pack', '1.5 Liter Eco Pack', 'Cream 200ml'];
  }
  if (lower.includes('oil') || lower.includes('ghee')) {
    return ['1 Liter Pouch', '1 kg Pouch', '2.5 Liter Tin', '5 Liter Can', '16 Liter Tin'];
  }
  if (lower.includes('tea') || lower.includes('coffee')) {
    return ['95g Pack', '190g Pack', '380g Pack', '450g Pack', '900g Family Pack', '50 Tea Bags'];
  }
  if (lower.includes('grain') || lower.includes('rice') || lower.includes('flour') || lower.includes('atta') || lower.includes('pulse')) {
    return ['500g Pack', '1 kg Pouch', '2 kg Pouch', '5 kg Bag', '10 kg Bag', '20 kg Bag'];
  }
  if (lower.includes('spice') || lower.includes('masala')) {
    return ['50g Recipe Pack', '100g Pack', '200g Pack', '500g Jar', '1 kg Pack'];
  }
  if (lower.includes('detergent') || lower.includes('laundry')) {
    return ['500g Pouch', '1 kg Pouch', '2 kg Pouch', '3 kg Pack', '5 kg Bucket', '250g Bar'];
  }
  if (lower.includes('soap')) {
    return ['75g Bar', '100g Bar', '140g Special Bar', '175g Jumbo Bar', 'Pack of 3 Soap', 'Liquid 250ml'];
  }
  if (lower.includes('snack') || lower.includes('chip') || lower.includes('biscuit') || lower.includes('cookie')) {
    return ['Small Snack Pack', 'Medium Pack', 'Half Roll Pack', 'Family Pack', 'Tiffin Box Pack'];
  }
  if (lower.includes('bakery') || lower.includes('bread')) {
    return ['Plain Bread Small', 'Plain Bread Large', 'Milky Bread', 'Brown Bread', '4-Pack Buns', 'Rusk 300g'];
  }
  if (lower.includes('fruit') || lower.includes('vegetable')) {
    return ['500g', '1 kg', '2 kg', '5 kg Bag', '1 Dozen', 'Single Piece'];
  }
  if (lower.includes('personal') || lower.includes('shampoo') || lower.includes('care')) {
    return ['75g / 75ml', '100g / 100ml', '180ml Bottle', '360ml Family Bottle', '200ml Lotion'];
  }
  return ['1 Piece', 'Small Size', 'Medium Size', 'Large Size', 'Pack of 6', '1 Dozen'];
}

/**
 * Returns companies matching the selected category.
 * Prioritizes store-managed categories, falling back to rich built-in taxonomy.
 */
export function getCompaniesForCategory(
  categoryName: string,
  managedCategories: ManagedCategory[] = []
): CompanyBrand[] {
  const trimmed = (categoryName || '').trim();
  if (!trimmed) return [];
  const lower = trimmed.toLowerCase();

  // 1. Check Store Managed Categories
  if (managedCategories && managedCategories.length > 0) {
    const foundManaged = managedCategories.find(mc => mc.name.toLowerCase() === lower);
    if (foundManaged && foundManaged.companies && foundManaged.companies.length > 0) {
      return foundManaged.companies;
    }
  }

  // 2. Check Built-in Default Taxonomy (Exact Name)
  const exactDefault = DEFAULT_TAXONOMY_CATEGORIES.find(tc => tc.name.toLowerCase() === lower);
  if (exactDefault && exactDefault.companies && exactDefault.companies.length > 0) {
    return exactDefault.companies as CompanyBrand[];
  }

  // 3. Check Built-in Default Taxonomy (Fuzzy / Keyword Match)
  const fuzzy = DEFAULT_TAXONOMY_CATEGORIES.find(tc => {
    const tcLower = tc.name.toLowerCase();
    return lower.includes(tcLower) || tcLower.includes(lower);
  });
  if (fuzzy && fuzzy.companies && fuzzy.companies.length > 0) {
    return fuzzy.companies as CompanyBrand[];
  }

  // 4. Commodity keyword aliases
  if (lower.includes('drink') || lower.includes('juice') || lower.includes('soda') || lower.includes('water')) {
    const bev = DEFAULT_TAXONOMY_CATEGORIES.find(tc => tc.name === 'Beverages');
    if (bev) return bev.companies as CompanyBrand[];
  }
  if (lower.includes('milk') || lower.includes('cheese') || lower.includes('butter') || lower.includes('cream')) {
    const dairy = DEFAULT_TAXONOMY_CATEGORIES.find(tc => tc.name === 'Dairy');
    if (dairy) return dairy.companies as CompanyBrand[];
  }
  if (lower.includes('oil')) {
    const oil = DEFAULT_TAXONOMY_CATEGORIES.find(tc => tc.name === 'Oil');
    if (oil) return oil.companies as CompanyBrand[];
  }
  if (lower.includes('ghee')) {
    const ghee = DEFAULT_TAXONOMY_CATEGORIES.find(tc => tc.name === 'Ghee');
    if (ghee) return ghee.companies as CompanyBrand[];
  }
  if (lower.includes('chip') || lower.includes('nimko')) {
    const snacks = DEFAULT_TAXONOMY_CATEGORIES.find(tc => tc.name === 'Snacks');
    if (snacks) return snacks.companies as CompanyBrand[];
  }
  if (lower.includes('cookie') || lower.includes('wafer')) {
    const biscuit = DEFAULT_TAXONOMY_CATEGORIES.find(tc => tc.name === 'Biscuit');
    if (biscuit) return biscuit.companies as CompanyBrand[];
  }
  if (lower.includes('washing') || lower.includes('detergent')) {
    const det = DEFAULT_TAXONOMY_CATEGORIES.find(tc => tc.name === 'Detergent');
    if (det) return det.companies as CompanyBrand[];
  }
  if (lower.includes('laundry')) {
    const lnd = DEFAULT_TAXONOMY_CATEGORIES.find(tc => tc.name === 'Laundry');
    if (lnd) return lnd.companies as CompanyBrand[];
  }
  if (lower.includes('masala') || lower.includes('salt') || lower.includes('spice')) {
    const sp = DEFAULT_TAXONOMY_CATEGORIES.find(tc => tc.name === 'Spices');
    if (sp) return sp.companies as CompanyBrand[];
  }
  if (lower.includes('bread') || lower.includes('bun') || lower.includes('cake')) {
    const bk = DEFAULT_TAXONOMY_CATEGORIES.find(tc => tc.name === 'Bakery');
    if (bk) return bk.companies as CompanyBrand[];
  }
  if (lower.includes('shampoo') || lower.includes('lotion') || lower.includes('toothpaste') || lower.includes('cream')) {
    const pc = DEFAULT_TAXONOMY_CATEGORIES.find(tc => tc.name === 'Personal Care');
    if (pc) return pc.companies as CompanyBrand[];
  }

  // 5. Default General Category Supplier fallback
  const general = DEFAULT_TAXONOMY_CATEGORIES.find(tc => tc.name === 'General');
  return (general?.companies || []) as CompanyBrand[];
}


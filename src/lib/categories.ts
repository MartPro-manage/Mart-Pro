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
    name: 'General',
    description: 'General supermarket goods, kitchen items & household',
    icon: 'Package',
    companies: [
      {
        id: 'general-brand',
        name: 'Standard Wholesale Supplier',
        sizes: ['1 Piece', 'Small Size', 'Medium Size', 'Large Size', 'Pack of 6', '1 Dozen']
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


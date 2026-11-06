// ─── Demo Data ───────────────────────────────────────────────────────────────
// ⚠ WARNING: All data in this file is DEMO/PLACEHOLDER data only.
// It is used purely for UI layout and development purposes.
// No data here is connected to a real database or any real pharmacy records.
// Real data will be loaded from the MySQL backend in Phase 3.
// ─────────────────────────────────────────────────────────────────────────────

export const DEMO_TAG = '⚠ Demo Data';

export const demoStats = {
  totalMedicines: 284,
  lowStockCount: 12,
  nearExpiryCount: 8,
  expiredCount: 3,
  todayRevenue: 47850,
  todaySales: 23,
  monthRevenue: 1284600,
  totalSuppliers: 18,
};

export const demoSalesTrend = [
  { date: 'Oct 1',  revenue: 38200 },
  { date: 'Oct 2',  revenue: 42100 },
  { date: 'Oct 3',  revenue: 31500 },
  { date: 'Oct 4',  revenue: 55800 },
  { date: 'Oct 5',  revenue: 47300 },
  { date: 'Oct 6',  revenue: 61200 },
  { date: 'Oct 7',  revenue: 43900 },
  { date: 'Oct 8',  revenue: 39600 },
  { date: 'Oct 9',  revenue: 52400 },
  { date: 'Oct 10', revenue: 48700 },
  { date: 'Oct 11', revenue: 67100 },
  { date: 'Oct 12', revenue: 44200 },
  { date: 'Oct 13', revenue: 58900 },
  { date: 'Oct 14', revenue: 71400 },
  { date: 'Oct 15', revenue: 47850 },
];

export const demoTopMedicines = [
  { name: 'Paracetamol 500mg', sold: 312, revenue: 28080 },
  { name: 'Amoxicillin 500mg', sold: 187, revenue: 56100 },
  { name: 'ORS Sachet',        sold: 156, revenue: 15600 },
  { name: 'Metformin 500mg',   sold: 143, revenue: 42900 },
  { name: 'Omeprazole 20mg',   sold: 128, revenue: 38400 },
];

export const demoLowStockAlerts = [
  { id: 1, name: 'Amoxicillin 250mg Cap', stock: 45,  reorderLevel: 100, unit: 'Caps'   },
  { id: 2, name: 'Insulin Glargine 100IU', stock: 8,  reorderLevel: 20,  unit: 'Vials'  },
  { id: 3, name: 'Salbutamol Inhaler',    stock: 12,  reorderLevel: 30,  unit: 'Units'  },
  { id: 4, name: 'Metformin 850mg Tab',   stock: 60,  reorderLevel: 150, unit: 'Tabs'   },
  { id: 5, name: 'Aspirin 75mg Tab',      stock: 30,  reorderLevel: 200, unit: 'Tabs'   },
];

export const demoNearExpiryAlerts = [
  { id: 1, name: 'Cefixime 200mg Cap', batch: 'CFX-2024-03', expiryDate: '2024-11-30', qty: 120 },
  { id: 2, name: 'Azithromycin Syrup', batch: 'AZI-2024-07', expiryDate: '2024-12-15', qty: 48  },
  { id: 3, name: 'Ibuprofen 400mg',    batch: 'IBU-2024-11', expiryDate: '2025-01-10', qty: 200 },
];

export const demoRecentSales = [
  { id: 'INV-2026-0023', customer: 'Walk-in Patient', total: 2450,  items: 4,  time: '14:32', cashier: 'Ahmed Ali'   },
  { id: 'INV-2026-0022', customer: 'Fatima Khan',     total: 8900,  items: 7,  time: '13:15', cashier: 'Ahmed Ali'   },
  { id: 'INV-2026-0021', customer: 'Walk-in Patient', total: 1200,  items: 2,  time: '12:48', cashier: 'Sara Malik'  },
  { id: 'INV-2026-0020', customer: 'Muhammad Raza',   total: 15600, items: 11, time: '11:20', cashier: 'Ahmed Ali'   },
  { id: 'INV-2026-0019', customer: 'Walk-in Patient', total: 3800,  items: 3,  time: '10:05', cashier: 'Sara Malik'  },
];

export const demoMedicines = [
  { id: 1,  genericName: 'Paracetamol',       brandName: 'Panadol',         strength: '500mg',   dosageForm: 'Tablet',   category: 'Analgesics',     manufacturer: 'GSK Pakistan',      barcode: '8901234567890', status: 'active',       stock: 1500, requiresPrescription: false },
  { id: 2,  genericName: 'Amoxicillin',        brandName: 'Amoxil',          strength: '500mg',   dosageForm: 'Capsule',  category: 'Antibiotics',    manufacturer: 'Abbott Pakistan',   barcode: '8901234567891', status: 'active',       stock: 45,   requiresPrescription: true  },
  { id: 3,  genericName: 'Amoxicillin',        brandName: 'Amoxil',          strength: '250mg',   dosageForm: 'Capsule',  category: 'Antibiotics',    manufacturer: 'Abbott Pakistan',   barcode: '8901234567892', status: 'active',       stock: 200,  requiresPrescription: true  },
  { id: 4,  genericName: 'Metformin',          brandName: 'Glucophage',      strength: '500mg',   dosageForm: 'Tablet',   category: 'Antidiabetics',  manufacturer: 'Merck Pakistan',    barcode: '8901234567893', status: 'active',       stock: 600,  requiresPrescription: true  },
  { id: 5,  genericName: 'Omeprazole',         brandName: 'Omez',            strength: '20mg',    dosageForm: 'Capsule',  category: 'Antacids/PPIs',  manufacturer: 'Dr. Reddys',        barcode: '8901234567894', status: 'active',       stock: 320,  requiresPrescription: false },
  { id: 6,  genericName: 'Salbutamol',         brandName: 'Ventolin',        strength: '100mcg',  dosageForm: 'Inhaler',  category: 'Bronchodilators',manufacturer: 'GSK Pakistan',      barcode: '8901234567895', status: 'active',       stock: 12,   requiresPrescription: true  },
  { id: 7,  genericName: 'Cefixime',           brandName: 'Suprax',          strength: '200mg',   dosageForm: 'Capsule',  category: 'Antibiotics',    manufacturer: 'Pfizer Pakistan',   barcode: '8901234567896', status: 'active',       stock: 88,   requiresPrescription: true  },
  { id: 8,  genericName: 'ORS',                brandName: 'Pedialyte',       strength: 'Standard',dosageForm: 'Sachet',   category: 'Rehydration',    manufacturer: 'Abbott Pakistan',   barcode: '8901234567897', status: 'active',       stock: 400,  requiresPrescription: false },
  { id: 9,  genericName: 'Insulin Glargine',   brandName: 'Lantus',          strength: '100IU/ml',dosageForm: 'Injection',category: 'Antidiabetics',  manufacturer: 'Sanofi Pakistan',   barcode: '8901234567898', status: 'active',       stock: 8,    requiresPrescription: true  },
  { id: 10, genericName: 'Azithromycin',       brandName: 'Zithromax',       strength: '200mg/5ml',dosageForm:'Syrup',    category: 'Antibiotics',    manufacturer: 'Pfizer Pakistan',   barcode: '8901234567899', status: 'active',       stock: 48,   requiresPrescription: true  },
  { id: 11, genericName: 'Aspirin',            brandName: 'Disprin',         strength: '75mg',    dosageForm: 'Tablet',   category: 'Analgesics',     manufacturer: 'Reckitt Pakistan',  barcode: '8901234567900', status: 'active',       stock: 30,   requiresPrescription: false },
  { id: 12, genericName: 'Chloramphenicol',    brandName: 'Chloromycetin',   strength: '0.5%',    dosageForm: 'Eye Drop', category: 'Eye/Ear/Nasal',  manufacturer: 'Pfizer Pakistan',   barcode: '8901234567901', status: 'discontinued', stock: 0,    requiresPrescription: true  },
];

export const demoCategories = [
  { id: 1, name: 'Analgesics',       medicineCount: 24, description: 'Pain relief medicines' },
  { id: 2, name: 'Antibiotics',      medicineCount: 42, description: 'Bacterial infection treatment' },
  { id: 3, name: 'Antidiabetics',    medicineCount: 18, description: 'Diabetes management' },
  { id: 4, name: 'Antacids/PPIs',    medicineCount: 15, description: 'Acid reflux and ulcers' },
  { id: 5, name: 'Bronchodilators',  medicineCount: 11, description: 'Asthma and COPD' },
  { id: 6, name: 'Rehydration',      medicineCount: 8,  description: 'ORS and electrolytes' },
  { id: 7, name: 'Eye/Ear/Nasal',    medicineCount: 19, description: 'Ophthalmic and ENT drops' },
  { id: 8, name: 'Cardiovascular',   medicineCount: 31, description: 'Heart and blood pressure' },
  { id: 9, name: 'Dermatology',      medicineCount: 27, description: 'Skin creams and ointments' },
  { id: 10,name: 'Vitamins & Supplements', medicineCount: 33, description: 'Nutritional supplements' },
];

export const demoDosageForms = [
  'Tablet','Capsule','Syrup','Suspension','Injection','Ampoule','Vial',
  'Eye Drop','Ear Drop','Nasal Drop','Cream','Ointment','Gel','Inhaler',
  'Powder','Sachet','Suppository','Medical Device','Other',
];

export const demoSuppliers = [
  { id: 1, name: 'MedPlus Distributors',   contact: 'Tariq Mehmood', phone: '0300-1234567', city: 'Karachi',    paymentTerms: 'Net 30', status: 'active' },
  { id: 2, name: 'Al-Shifa Pharma',        contact: 'Bilal Hussain', phone: '0321-9876543', city: 'Lahore',     paymentTerms: 'Net 15', status: 'active' },
  { id: 3, name: 'Noor Medical Supplies',  contact: 'Ayesha Siddiq', phone: '0333-4567890', city: 'Islamabad',  paymentTerms: 'Net 30', status: 'active' },
  { id: 4, name: 'Hamdard Pharmaceuticals',contact: 'Usman Khan',    phone: '0345-6789012', city: 'Karachi',    paymentTerms: 'Cash',   status: 'active' },
  { id: 5, name: 'Fazal Pharma',           contact: 'Zara Tahir',    phone: '0311-2345678', city: 'Peshawar',   paymentTerms: 'Net 45', status: 'inactive'},
];

export const demoBatches = [
  { id: 1, medicine: 'Paracetamol 500mg (Panadol)',   batchNo: 'PAN-2024-001', mfgDate: '2024-01-10', expiryDate: '2026-01-09', qty: 850,  costPrice: 12,   sellingPrice: 18,   status: 'active'   },
  { id: 2, medicine: 'Paracetamol 500mg (Panadol)',   batchNo: 'PAN-2024-008', mfgDate: '2024-08-01', expiryDate: '2026-07-31', qty: 650,  costPrice: 13,   sellingPrice: 18,   status: 'active'   },
  { id: 3, medicine: 'Amoxicillin 500mg (Amoxil)',    batchNo: 'AMX-2024-003', mfgDate: '2024-03-15', expiryDate: '2024-11-30', qty: 45,   costPrice: 220,  sellingPrice: 300,  status: 'active'   },
  { id: 4, medicine: 'Insulin Glargine (Lantus)',     batchNo: 'LNT-2024-002', mfgDate: '2024-02-01', expiryDate: '2025-01-31', qty: 8,    costPrice: 1800, sellingPrice: 2400, status: 'active'   },
  { id: 5, medicine: 'Cefixime 200mg (Suprax)',       batchNo: 'CFX-2024-03',  mfgDate: '2024-01-20', expiryDate: '2024-11-30', qty: 120,  costPrice: 185,  sellingPrice: 250,  status: 'active'   },
  { id: 6, medicine: 'Amoxicillin 250mg (Gramoxil)',  batchNo: 'GRM-2023-12',  mfgDate: '2023-12-01', expiryDate: '2024-10-01', qty: 0,    costPrice: 120,  sellingPrice: 180,  status: 'expired'  },
  { id: 7, medicine: 'Clarithromycin 500mg',          batchNo: 'CLR-2024-05',  mfgDate: '2024-05-01', expiryDate: '2026-04-30', qty: 60,   costPrice: 320,  sellingPrice: 450,  status: 'recalled' },
];

export const demoPurchases = [
  { id: 'PO-2024-041', supplier: 'MedPlus Distributors', date: '2024-10-12', items: 8, total: 124500, status: 'received'  },
  { id: 'PO-2024-040', supplier: 'Al-Shifa Pharma',      date: '2024-10-10', items: 5, total:  87200, status: 'received'  },
  { id: 'PO-2024-039', supplier: 'Noor Medical Supplies', date: '2024-10-08', items: 12, total: 210800, status: 'partial'  },
  { id: 'PO-2024-038', supplier: 'Hamdard Pharmaceuticals',date: '2024-10-05',items: 3, total:  43000, status: 'received'  },
  { id: 'PO-2024-037', supplier: 'MedPlus Distributors', date: '2024-10-01', items: 7, total:  96400, status: 'received'  },
];

export const demoSalesHistory = [
  { id: 'INV-2024-0023', date: '2024-10-16', customer: 'Walk-in',       items: 4,  subtotal: 2200, discount: 0,   tax: 250,  total: 2450,  cashier: 'Ahmed Ali',  status: 'completed' },
  { id: 'INV-2024-0022', date: '2024-10-16', customer: 'Fatima Khan',   items: 7,  subtotal: 8500, discount: 0,   tax: 400,  total: 8900,  cashier: 'Ahmed Ali',  status: 'completed' },
  { id: 'INV-2024-0021', date: '2024-10-16', customer: 'Walk-in',       items: 2,  subtotal: 1100, discount: 100, tax: 0,    total: 1200,  cashier: 'Sara Malik', status: 'completed' },
  { id: 'INV-2024-0019', date: '2024-10-15', customer: 'Muhammad Raza', items: 11, subtotal:14800, discount: 200, tax: 1000, total: 15600, cashier: 'Ahmed Ali',  status: 'completed' },
  { id: 'INV-2024-0018', date: '2024-10-15', customer: 'Walk-in',       items: 3,  subtotal: 3600, discount: 0,   tax: 200,  total: 3800,  cashier: 'Sara Malik', status: 'completed' },
  { id: 'INV-2024-0017', date: '2024-10-14', customer: 'Aisha Bibi',    items: 6,  subtotal: 7200, discount: 500, tax: 0,    total: 6700,  cashier: 'Ahmed Ali',  status: 'returned'  },
];

export const demoReturns = [
  { id: 'RTN-2024-009', type: 'sale_return',     ref: 'INV-2024-0017', date: '2024-10-15', customer: 'Aisha Bibi',        items: 2, amount: 1800, reason: 'Wrong product dispensed', status: 'processed' },
  { id: 'RTN-2024-008', type: 'purchase_return', ref: 'PO-2024-037',   date: '2024-10-12', customer: 'MedPlus Distributors', items: 1, amount: 12400, reason: 'Damaged packaging', status: 'processed' },
  { id: 'RTN-2024-007', type: 'sale_return',     ref: 'INV-2024-0012', date: '2024-10-10', customer: 'Walk-in',           items: 1, amount: 450, reason: 'Adverse reaction — doctor advised stop', status: 'processed' },
];

export const demoUsers = [
  { id: 1, name: 'Admin User',   username: 'admin',   role: 'admin',         email: 'admin@pharmacare.pk',   status: 'active',   lastLogin: '2024-10-16 14:30' },
  { id: 2, name: 'Ahmed Ali',    username: 'ahmed',   role: 'pharmacist',    email: 'ahmed@pharmacare.pk',   status: 'active',   lastLogin: '2024-10-16 14:25' },
  { id: 3, name: 'Sara Malik',   username: 'sara',    role: 'cashier',       email: 'sara@pharmacare.pk',    status: 'active',   lastLogin: '2024-10-16 10:05' },
  { id: 4, name: 'Kamran Raza',  username: 'kamran',  role: 'stock_manager', email: 'kamran@pharmacare.pk',  status: 'active',   lastLogin: '2024-10-15 09:15' },
  { id: 5, name: 'Nadia Bibi',   username: 'nadia',   role: 'cashier',       email: 'nadia@pharmacare.pk',   status: 'inactive', lastLogin: '2024-09-30 16:40' },
];

export const demoPrescriptions = [
  { id: 'RX-2024-088', date: '2024-10-16', patient: 'Fatima Khan',   doctor: 'Dr. Ali Shah',   items: 3, invoiceRef: 'INV-2024-0022', verifiedBy: 'Ahmed Ali', status: 'verified'  },
  { id: 'RX-2024-087', date: '2024-10-15', patient: 'Muhammad Raza', doctor: 'Dr. Zara Noor',  items: 4, invoiceRef: 'INV-2024-0019', verifiedBy: 'Ahmed Ali', status: 'verified'  },
  { id: 'RX-2024-086', date: '2024-10-14', patient: 'Aisha Bibi',    doctor: 'Dr. Kamran Beg', items: 2, invoiceRef: null,             verifiedBy: null,        status: 'pending'   },
];

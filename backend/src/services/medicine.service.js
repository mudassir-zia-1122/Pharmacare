import { query } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { logAudit } from './audit.service.js';

export async function getMedicines({ search, category, dosageForm, status, page = 1, limit = 20 }) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const offsetNum = (pageNum - 1) * limitNum;
  const whereClauses = ['m.deleted_at IS NULL'];
  const params = [];

  if (search) {
    whereClauses.push('(m.generic_name LIKE ? OR m.brand_name LIKE ? OR m.barcode LIKE ? OR m.sku LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  if (category) {
    whereClauses.push('c.name = ?');
    params.push(category);
  }

  if (dosageForm) {
    whereClauses.push('df.name = ?');
    params.push(dosageForm);
  }

  if (status) {
    whereClauses.push('m.status = ?');
    params.push(status);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Count total matching items
  const countSql = `
    SELECT COUNT(*) AS total
      FROM medicines m
      JOIN categories c ON m.category_id = c.id
      JOIN dosage_forms df ON m.dosage_form_id = df.id
      LEFT JOIN manufacturers mf ON m.manufacturer_id = mf.id
    ${whereSql}
  `;
  const countRows = await query(countSql, params);
  const totalItems = countRows[0]?.total || 0;

  // Fetch paginated records with total physical on-hand stock and Phase 5 fields
  const dataSql = `
    SELECT m.id, m.generic_name AS genericName, m.brand_name AS brandName,
           m.strength, m.strength_unit AS strengthUnit,
           m.dosage_description AS dosageDescription,
           m.pack_size AS packSize, m.pack_unit AS packUnit,
           m.storage_instructions AS storageInstructions, m.warnings,
           m.barcode, m.sku,
           m.requires_prescription AS requiresPrescription, m.reorder_level AS reorderLevel,
           m.status, m.created_at AS createdAt, m.updated_at AS updatedAt,
           c.name AS category, df.name AS dosageForm,
           COALESCE(mf.name, 'N/A') AS manufacturer,
           COALESCE((
             SELECT SUM(b.quantity_on_hand)
               FROM batches b
              WHERE b.medicine_id = m.id AND b.status = 'active' AND b.expiry_date > CURRENT_DATE
           ), 0) AS stock
      FROM medicines m
      JOIN categories c ON m.category_id = c.id
      JOIN dosage_forms df ON m.dosage_form_id = df.id
      LEFT JOIN manufacturers mf ON m.manufacturer_id = mf.id
    ${whereSql}
     ORDER BY m.generic_name ASC, m.brand_name ASC
     LIMIT ? OFFSET ?
  `;
  const dataRows = await query(dataSql, [...params, limitNum, offsetNum]);

  return {
    items: dataRows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalItems,
      totalPages: Math.ceil(totalItems / limitNum) || 1,
    },
  };
}

export async function getMedicineById(id) {
  const rows = await query(
    `SELECT m.id, m.generic_name AS genericName, m.brand_name AS brandName,
            m.category_id AS categoryId, m.dosage_form_id AS dosageFormId,
            m.manufacturer_id AS manufacturerId, m.strength, m.strength_unit AS strengthUnit,
            m.dosage_description AS dosageDescription,
            m.pack_size AS packSize, m.pack_unit AS packUnit,
            m.storage_instructions AS storageInstructions, m.warnings,
            m.description, m.barcode, m.sku,
            m.requires_prescription AS requiresPrescription,
            m.tax_rule_id AS taxRuleId, m.reorder_level AS reorderLevel, m.status,
            m.created_at AS createdAt, m.updated_at AS updatedAt,
            c.name AS categoryName, df.name AS dosageFormName, mf.name AS manufacturerName,
            COALESCE((
              SELECT SUM(b.quantity_on_hand)
                FROM batches b
               WHERE b.medicine_id = m.id AND b.status = 'active' AND b.expiry_date > CURRENT_DATE
            ), 0) AS activeStock
       FROM medicines m
       JOIN categories c ON m.category_id = c.id
       JOIN dosage_forms df ON m.dosage_form_id = df.id
       LEFT JOIN manufacturers mf ON m.manufacturer_id = mf.id
      WHERE m.id = ? AND m.deleted_at IS NULL
      LIMIT 1`,
    [id]
  );

  if (!rows || rows.length === 0) {
    throw ApiError.notFound(`Medicine not found with ID: ${id}`);
  }

  const medicine = rows[0];

  // Fetch packaging options and active batches
  const [packages, batches] = await Promise.all([
    query('SELECT * FROM medicine_packages WHERE medicine_id = ?', [id]),
    query(
      `SELECT b.id, b.batch_number AS batchNumber, b.expiry_date AS expiryDate,
              b.quantity_on_hand AS quantityOnHand, b.cost_price AS costPrice,
              b.selling_price AS sellingPrice, b.status,
              s.name AS supplier
         FROM batches b
         LEFT JOIN suppliers s ON b.supplier_id = s.id
        WHERE b.medicine_id = ?
        ORDER BY b.expiry_date ASC`,
      [id]
    ),
  ]);

  return {
    ...medicine,
    packages: packages || [],
    batches: batches || [],
  };
}

export async function createMedicine(data, userId) {
  const genericName = data.genericName || data.generic_name;
  const brandName = data.brandName || data.brand_name;
  const categoryId = data.categoryId !== undefined ? data.categoryId : data.category_id;
  const dosageFormId = data.dosageFormId !== undefined ? data.dosageFormId : data.dosage_form_id;
  const manufacturerId = data.manufacturerId !== undefined ? data.manufacturerId : data.manufacturer_id;
  const strength = data.strength;
  const strengthUnit = data.strengthUnit || data.strength_unit || 'mg';
  const dosageDescription = data.dosageDescription || data.dosage_description || null;
  const packSize = data.packSize || data.pack_size || '10';
  const packUnit = data.packUnit || data.pack_unit || 'Tablets';
  const storageInstructions = data.storageInstructions || data.storage_instructions || 'Store below 30°C in a dry place';
  const warnings = data.warnings || null;
  const barcode = data.barcode || null;
  const sku = data.sku || null;
  const requiresPrescription = data.requiresPrescription !== undefined ? data.requiresPrescription : (data.requires_prescription || false);
  const description = data.description || null;
  const reorderLevel = data.reorderLevel !== undefined ? data.reorderLevel : (data.reorder_level || 50);
  const status = data.status || 'active';

  // Duplicate Barcode Prevention
  if (barcode && barcode.trim()) {
    const existingBarcode = await query(
      'SELECT id, generic_name, brand_name FROM medicines WHERE barcode = ? AND deleted_at IS NULL LIMIT 1',
      [barcode.trim()]
    );
    if (existingBarcode && existingBarcode.length > 0) {
      throw ApiError.conflict(
        `Barcode "${barcode}" is already registered to "${existingBarcode[0].generic_name} (${existingBarcode[0].brand_name})"`
      );
    }
  }

  // Duplicate SKU Prevention
  if (sku && sku.trim()) {
    const existingSku = await query(
      'SELECT id, generic_name, brand_name FROM medicines WHERE sku = ? AND deleted_at IS NULL LIMIT 1',
      [sku.trim()]
    );
    if (existingSku && existingSku.length > 0) {
      throw ApiError.conflict(
        `SKU "${sku}" is already assigned to "${existingSku[0].generic_name} (${existingSku[0].brand_name})"`
      );
    }
  }

  const result = await query(
    `INSERT INTO medicines (
       generic_name, brand_name, category_id, dosage_form_id,
       manufacturer_id, strength, strength_unit, dosage_description,
       pack_size, pack_unit, storage_instructions, warnings,
       barcode, sku, requires_prescription, description, reorder_level, status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      genericName.trim(), brandName.trim(), categoryId, dosageFormId,
      manufacturerId || null, strength.trim(), strengthUnit, dosageDescription,
      packSize, packUnit, storageInstructions, warnings,
      barcode?.trim() || null, sku?.trim() || null,
      requiresPrescription ? 1 : 0, description || null,
      reorderLevel || 50, status || 'active',
    ]
  );

  const insertedId = result.insertId;

  await logAudit({
    userId,
    action: 'CREATE',
    tableName: 'medicines',
    recordId: insertedId,
    newValues: { genericName, brandName, strength, sku, barcode },
  });

  return getMedicineById(insertedId);
}

export async function updateMedicine(id, data, userId) {
  const existing = await getMedicineById(id);

  const genericName = data.genericName || data.generic_name || existing.genericName;
  const brandName = data.brandName || data.brand_name || existing.brandName;
  const categoryId = (data.categoryId !== undefined ? data.categoryId : data.category_id) ?? existing.categoryId;
  const dosageFormId = (data.dosageFormId !== undefined ? data.dosageFormId : data.dosage_form_id) ?? existing.dosageFormId;
  const manufacturerId = (data.manufacturerId !== undefined ? data.manufacturerId : data.manufacturer_id) ?? existing.manufacturerId;
  const strength = data.strength || existing.strength;
  const strengthUnit = data.strengthUnit || data.strength_unit || existing.strengthUnit;
  const dosageDescription = (data.dosageDescription !== undefined ? data.dosageDescription : data.dosage_description) ?? existing.dosageDescription;
  const packSize = (data.packSize !== undefined ? data.packSize : data.pack_size) ?? existing.packSize;
  const packUnit = (data.packUnit !== undefined ? data.packUnit : data.pack_unit) ?? existing.packUnit;
  const storageInstructions = (data.storageInstructions !== undefined ? data.storageInstructions : data.storage_instructions) ?? existing.storageInstructions;
  const warnings = (data.warnings !== undefined ? data.warnings : data.warnings) ?? existing.warnings;
  const barcode = (data.barcode !== undefined ? data.barcode : data.barcode) ?? existing.barcode;
  const sku = (data.sku !== undefined ? data.sku : data.sku) ?? existing.sku;
  const requiresPrescription = (data.requiresPrescription !== undefined ? data.requiresPrescription : data.requires_prescription) ?? existing.requiresPrescription;
  const description = (data.description !== undefined ? data.description : data.description) ?? existing.description;
  const reorderLevel = (data.reorderLevel !== undefined ? data.reorderLevel : data.reorder_level) ?? existing.reorderLevel;
  const status = data.status || existing.status;

  // Duplicate Barcode Prevention (excluding current medicine ID)
  if (barcode && barcode.trim()) {
    const existingBarcode = await query(
      'SELECT id, generic_name, brand_name FROM medicines WHERE barcode = ? AND id != ? AND deleted_at IS NULL LIMIT 1',
      [barcode.trim(), id]
    );
    if (existingBarcode && existingBarcode.length > 0) {
      throw ApiError.conflict(
        `Barcode "${barcode}" is already registered to "${existingBarcode[0].generic_name} (${existingBarcode[0].brand_name})"`
      );
    }
  }

  // Duplicate SKU Prevention (excluding current medicine ID)
  if (sku && sku.trim()) {
    const existingSku = await query(
      'SELECT id, generic_name, brand_name FROM medicines WHERE sku = ? AND id != ? AND deleted_at IS NULL LIMIT 1',
      [sku.trim(), id]
    );
    if (existingSku && existingSku.length > 0) {
      throw ApiError.conflict(
        `SKU "${sku}" is already assigned to "${existingSku[0].generic_name} (${existingSku[0].brand_name})"`
      );
    }
  }

  await query(
    `UPDATE medicines
        SET generic_name = ?, brand_name = ?, category_id = ?,
            dosage_form_id = ?, manufacturer_id = ?, strength = ?,
            strength_unit = ?, dosage_description = ?, pack_size = ?,
            pack_unit = ?, storage_instructions = ?, warnings = ?,
            barcode = ?, sku = ?, requires_prescription = ?,
            description = ?, reorder_level = ?, status = ?
      WHERE id = ?`,
    [
      genericName.trim(), brandName.trim(), categoryId, dosageFormId,
      manufacturerId || null, strength.trim(), strengthUnit, dosageDescription,
      packSize, packUnit, storageInstructions, warnings,
      barcode?.trim() || null, sku?.trim() || null,
      requiresPrescription ? 1 : 0, description || null,
      reorderLevel, status, id,
    ]
  );

  await logAudit({
    userId,
    action: 'UPDATE',
    tableName: 'medicines',
    recordId: id,
    oldValues: { status: existing.status, barcode: existing.barcode, sku: existing.sku },
    newValues: { status, barcode, sku },
  });

  return getMedicineById(id);
}

export async function updateMedicineStatus(id, newStatus, userId) {
  if (!['active', 'inactive', 'discontinued'].includes(newStatus)) {
    throw ApiError.badRequest('Invalid status. Allowed values: active, inactive, discontinued');
  }

  const existing = await getMedicineById(id);

  await query('UPDATE medicines SET status = ? WHERE id = ?', [newStatus, id]);

  await logAudit({
    userId,
    action: 'STATUS_CHANGE',
    tableName: 'medicines',
    recordId: id,
    oldValues: { status: existing.status },
    newValues: { status: newStatus },
  });

  return { id, status: newStatus, message: `Medicine status updated to ${newStatus}` };
}

// -----------------------------------------------------------------------------
// Reference Lookups (Categories, Dosage Forms, Manufacturers)
// -----------------------------------------------------------------------------

export async function getCategories() {
  return query(
    `SELECT c.id, c.name, c.description, c.is_active,
            (SELECT COUNT(*) FROM medicines m WHERE m.category_id = c.id AND m.deleted_at IS NULL) AS medicineCount
       FROM categories c
      ORDER BY c.name ASC`
  );
}

export async function createCategory(name, description, userId) {
  const result = await query('INSERT INTO categories (name, description) VALUES (?, ?)', [name, description || null]);
  await logAudit({ userId, action: 'CREATE', tableName: 'categories', recordId: result.insertId, newValues: { name } });
  return { id: result.insertId, name, description };
}

export async function getDosageForms() {
  return query('SELECT id, name, description, is_active FROM dosage_forms ORDER BY name ASC');
}

export async function getManufacturers() {
  return query('SELECT id, name, country, contact_person, phone, email, is_active FROM manufacturers ORDER BY name ASC');
}

export async function importMedicines(rows, userId) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw ApiError.badRequest('Import payload must contain a non-empty array of medicine rows');
  }

  // Pre-load lookup caches to minimize database queries
  const [categories, dosageForms, manufacturers] = await Promise.all([
    query('SELECT id, LOWER(name) AS lowerName FROM categories'),
    query('SELECT id, LOWER(name) AS lowerName FROM dosage_forms'),
    query('SELECT id, LOWER(name) AS lowerName FROM manufacturers'),
  ]);

  const catMap = new Map(categories.map(c => [c.lowerName, c.id]));
  const dfMap = new Map(dosageForms.map(d => [d.lowerName, d.id]));
  const mfgMap = new Map(manufacturers.map(m => [m.lowerName, m.id]));

  const inserted = [];
  const skippedDuplicates = [];
  const validationErrors = [];

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const rowNum = idx + 1;

    const genericName = (row.genericName || row.generic_name || row['Generic Name'] || '').trim();
    const brandName = (row.brandName || row.brand_name || row['Brand Name'] || row.name || '').trim();
    const strength = (row.strength || row['Strength'] || '1').toString().trim();
    const strengthUnit = (row.strengthUnit || row.strength_unit || row['Strength Unit'] || 'mg').toString().trim();
    const barcode = (row.barcode || row['Barcode'] || '').toString().trim() || null;
    const sku = (row.sku || row['SKU'] || '').toString().trim() || null;
    const packSize = (row.packSize || row.pack_size || row['Pack Size'] || '10').toString().trim();
    const packUnit = (row.packUnit || row.pack_unit || row['Pack Unit'] || 'Tablets').toString().trim();
    const storageInstructions = (row.storageInstructions || row.storage_instructions || row['Storage'] || 'Store below 30°C in a dry place').toString().trim();
    const warnings = (row.warnings || row['Warnings'] || '').toString().trim() || null;
    const requiresPrescription = Boolean(
      row.requiresPrescription === true ||
      row.requires_prescription === true ||
      row.requires_prescription === 1 ||
      row['Prescription'] === 'Yes' ||
      row['Rx'] === 'Yes' ||
      row['Rx'] === true
    );
    const reorderLevel = parseInt(row.reorderLevel || row.reorder_level || row['Reorder Level'] || '50', 10);

    // Validation
    if (!genericName || !brandName) {
      validationErrors.push({ row: rowNum, error: 'Generic Name and Brand Name are required' });
      continue;
    }

    // Resolve Category
    let categoryId = parseInt(row.categoryId || row.category_id, 10);
    if (!categoryId && (row.category || row['Category'])) {
      const catKey = (row.category || row['Category']).toString().toLowerCase().trim();
      categoryId = catMap.get(catKey);
    }
    if (!categoryId) {
      categoryId = categories[0]?.id || 1;
    }

    // Resolve Dosage Form
    let dosageFormId = parseInt(row.dosageFormId || row.dosage_form_id, 10);
    if (!dosageFormId && (row.dosageForm || row.dosage_form || row['Dosage Form'] || row['Form'])) {
      const dfKey = (row.dosageForm || row.dosage_form || row['Dosage Form'] || row['Form']).toString().toLowerCase().trim();
      dosageFormId = dfMap.get(dfKey);
    }
    if (!dosageFormId) {
      dosageFormId = dosageForms[0]?.id || 1;
    }

    // Resolve Manufacturer
    let manufacturerId = parseInt(row.manufacturerId || row.manufacturer_id, 10) || null;
    if (!manufacturerId && (row.manufacturer || row['Manufacturer'])) {
      const mfgKey = (row.manufacturer || row['Manufacturer']).toString().toLowerCase().trim();
      manufacturerId = mfgMap.get(mfgKey) || null;
    }

    // Duplicate Check: Barcode
    if (barcode) {
      const existingBarcode = await query(
        'SELECT id, generic_name, brand_name FROM medicines WHERE barcode = ? AND deleted_at IS NULL LIMIT 1',
        [barcode]
      );
      if (existingBarcode && existingBarcode.length > 0) {
        skippedDuplicates.push({
          row: rowNum,
          genericName,
          brandName,
          reason: `Barcode "${barcode}" is already registered to "${existingBarcode[0].generic_name} (${existingBarcode[0].brand_name})"`,
        });
        continue;
      }
    }

    // Duplicate Check: SKU
    if (sku) {
      const existingSku = await query(
        'SELECT id, generic_name, brand_name FROM medicines WHERE sku = ? AND deleted_at IS NULL LIMIT 1',
        [sku]
      );
      if (existingSku && existingSku.length > 0) {
        skippedDuplicates.push({
          row: rowNum,
          genericName,
          brandName,
          reason: `SKU "${sku}" is already assigned to "${existingSku[0].generic_name} (${existingSku[0].brand_name})"`,
        });
        continue;
      }
    }

    // Duplicate Check: Generic + Brand + Strength + Dosage Form
    const existingMed = await query(
      `SELECT id FROM medicines
        WHERE generic_name = ? AND brand_name = ? AND strength = ? AND dosage_form_id = ? AND deleted_at IS NULL
        LIMIT 1`,
      [genericName, brandName, strength, dosageFormId]
    );
    if (existingMed && existingMed.length > 0) {
      skippedDuplicates.push({
        row: rowNum,
        genericName,
        brandName,
        reason: `Medicine "${genericName} (${brandName}) ${strength}" already exists in catalogue`,
      });
      continue;
    }

    const assignedSku = sku || `SKU-IMP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      const res = await query(
        `INSERT INTO medicines (
           generic_name, brand_name, category_id, dosage_form_id,
           manufacturer_id, strength, strength_unit,
           pack_size, pack_unit, storage_instructions, warnings,
           barcode, sku, requires_prescription, reorder_level, status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [
          genericName, brandName, categoryId, dosageFormId,
          manufacturerId, strength, strengthUnit,
          packSize, packUnit, storageInstructions, warnings,
          barcode, assignedSku, requiresPrescription ? 1 : 0, reorderLevel
        ]
      );

      inserted.push({
        id: res.insertId,
        genericName,
        brandName,
        sku: assignedSku,
        barcode,
      });
    } catch (err) {
      validationErrors.push({ row: rowNum, error: err.message });
    }
  }

  await logAudit({
    userId,
    action: 'MEDICINES_IMPORTED',
    tableName: 'medicines',
    details: {
      totalRows: rows.length,
      insertedCount: inserted.length,
      skippedCount: skippedDuplicates.length,
      errorCount: validationErrors.length,
    },
  });

  return {
    total: rows.length,
    importedCount: inserted.length,
    skippedCount: skippedDuplicates.length,
    errorCount: validationErrors.length,
    inserted,
    skippedDuplicates,
    validationErrors,
  };
}

export default {
  getMedicines,
  getMedicineById,
  createMedicine,
  updateMedicine,
  updateMedicineStatus,
  importMedicines,
  getCategories,
  createCategory,
  getDosageForms,
  getManufacturers,
};

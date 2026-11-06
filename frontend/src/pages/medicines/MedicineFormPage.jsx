import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input, Select, Textarea } from '../../components/common/Input';
import { demoCategories, demoDosageForms, demoMedicines } from '../../data/demoData';
import { useAuth } from '../../context/AuthContext';
import { medicineApi } from '../../api';

export function MedicineFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDemo } = useAuth();
  const isEdit = Boolean(id);

  const [categories, setCategories] = useState(demoCategories);
  const [dosageForms, setDosageForms] = useState(demoDosageForms.map((d, i) => ({ id: i + 1, name: d })));
  const [manufacturers, setManufacturers] = useState([]);

  const [form, setForm] = useState({
    genericName: '',
    brandName: '',
    strength: '',
    strengthUnit: 'mg',
    dosageDescription: '',
    packSize: '10',
    packUnit: 'Tablets',
    dosageFormId: '',
    categoryId: '',
    manufacturerId: '',
    sku: '',
    barcode: '',
    storageInstructions: 'Store below 30°C in a dry place away from sunlight',
    warnings: '',
    description: '',
    requiresPrescription: false,
    reorderLevel: 50,
    status: 'active',
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Load dropdown references
  useEffect(() => {
    let isMounted = true;
    Promise.all([
      medicineApi.fetchCategories().catch(() => null),
      medicineApi.fetchDosageForms().catch(() => null),
      medicineApi.fetchManufacturers().catch(() => null),
    ]).then(([catRes, formRes, mfgRes]) => {
      if (!isMounted) return;
      if (catRes?.data) setCategories(catRes.data);
      if (formRes?.data) setDosageForms(formRes.data);
      if (mfgRes?.data) setManufacturers(mfgRes.data);
    });
    return () => { isMounted = false; };
  }, []);

  // If edit mode, load medicine details
  useEffect(() => {
    if (!isEdit) return;
    let isMounted = true;
    medicineApi.fetchMedicine(id).then(res => {
      if (!isMounted || !res?.data) return;
      const m = res.data;
      setForm({
        genericName: m.generic_name || m.genericName || '',
        brandName: m.brand_name || m.brandName || '',
        strength: m.strength || '',
        strengthUnit: m.strength_unit || m.strengthUnit || 'mg',
        dosageDescription: m.dosage_description || m.dosageDescription || '',
        packSize: m.pack_size || m.packSize || '10',
        packUnit: m.pack_unit || m.packUnit || 'Tablets',
        dosageFormId: m.dosage_form_id || m.dosageFormId || '',
        categoryId: m.category_id || m.categoryId || '',
        manufacturerId: m.manufacturer_id || m.manufacturerId || '',
        sku: m.sku || '',
        barcode: m.barcode || '',
        storageInstructions: m.storage_instructions || m.storageInstructions || 'Store below 30°C in a dry place away from sunlight',
        warnings: m.warnings || '',
        description: m.description || '',
        requiresPrescription: Boolean(m.requires_prescription ?? m.requiresPrescription),
        reorderLevel: m.reorder_level || m.reorderLevel || 50,
        status: m.status || 'active',
      });
    }).catch(() => {
      // Demo fallback if API offline
      const existing = demoMedicines.find(m => m.id === Number(id));
      if (existing && isMounted) {
        setForm(f => ({
          ...f,
          genericName: existing.genericName,
          brandName: existing.brandName,
          strength: existing.strength,
          requiresPrescription: existing.requiresPrescription,
          status: existing.status,
        }));
      }
    });
    return () => { isMounted = false; };
  }, [id, isEdit]);

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  // Helper to generate SKU automatically
  const generateSku = () => {
    const brandPrefix = (form.brandName || form.genericName || 'MED').slice(0, 3).toUpperCase();
    const strengthPart = form.strength ? `-${form.strength}` : '';
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    set('sku', `SKU-${brandPrefix}${strengthPart}-${randomSuffix}`);
  };

  const validate = () => {
    const e = {};
    if (!form.genericName.trim()) e.genericName = 'Generic chemical name is required.';
    if (!form.brandName.trim()) e.brandName = 'Brand / trade name is required.';
    if (!form.dosageFormId) e.dosageFormId = 'Dosage form selection is required.';
    if (!form.categoryId) e.categoryId = 'Therapeutic category selection is required.';
    if (!form.strength.trim()) e.strength = 'Strength specification is required.';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    setSuccessMsg('');

    try {
      const payload = {
        genericName: form.genericName.trim(),
        brandName: form.brandName.trim(),
        strength: form.strength.trim(),
        strengthUnit: form.strengthUnit,
        dosageDescription: form.dosageDescription?.trim() || null,
        packSize: form.packSize?.trim() || '10',
        packUnit: form.packUnit?.trim() || 'Tablets',
        dosageFormId: Number(form.dosageFormId),
        categoryId: Number(form.categoryId),
        manufacturerId: form.manufacturerId ? Number(form.manufacturerId) : undefined,
        sku: form.sku?.trim() || undefined,
        barcode: form.barcode?.trim() || undefined,
        storageInstructions: form.storageInstructions?.trim() || undefined,
        warnings: form.warnings?.trim() || undefined,
        description: form.description?.trim() || undefined,
        requiresPrescription: Boolean(form.requiresPrescription),
        reorderLevel: Number(form.reorderLevel) || 50,
        status: form.status,
      };

      if (isEdit) {
        await medicineApi.updateMedicine(id, payload);
        setSuccessMsg('Medicine record updated successfully in MySQL database.');
      } else {
        await medicineApi.createMedicine(payload);
        setSuccessMsg('New medicine catalogued successfully in MySQL database.');
      }

      setTimeout(() => {
        navigate('/medicines');
      }, 1200);
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Error saving medicine';

      // Check for specific duplicate conflict from server
      if (message.includes('Barcode')) {
        setErrors({ barcode: message });
      } else if (message.includes('SKU')) {
        setErrors({ sku: message });
      } else {
        setErrors({ submit: message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={isEdit ? `Edit Medicine #${id}` : 'Catalogue New Medicine'}
        breadcrumbs={[
          { label: 'Medicines', to: '/medicines' },
          { label: isEdit ? 'Edit' : 'Catalogue' },
        ]}
        actions={
          <Button variant="secondary" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate('/medicines')}>
            Back
          </Button>
        }
      />

      {successMsg && (
        <div className="mb-5 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center gap-3">
          <CheckCircle2 size={20} className="shrink-0 text-emerald-600" />
          <span className="font-medium text-sm">{successMsg}</span>
        </div>
      )}

      {errors.submit && (
        <div className="mb-5 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 flex items-center gap-3">
          <AlertCircle size={20} className="shrink-0 text-red-600" />
          <span className="font-medium text-sm">{errors.submit}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main details */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            {/* Pharmaceutical Identity */}
            <Card>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
                1. Pharmaceutical Identity
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Generic Chemical Name"
                  id="genericName"
                  required
                  placeholder="e.g. Paracetamol"
                  value={form.genericName}
                  onChange={e => set('genericName', e.target.value)}
                  error={errors.genericName}
                />
                <Input
                  label="Brand / Commercial Name"
                  id="brandName"
                  required
                  placeholder="e.g. Panadol"
                  value={form.brandName}
                  onChange={e => set('brandName', e.target.value)}
                  error={errors.brandName}
                />
                <div className="flex gap-2">
                  <Input
                    label="Strength Specification"
                    id="strength"
                    required
                    placeholder="e.g. 500"
                    value={form.strength}
                    onChange={e => set('strength', e.target.value)}
                    error={errors.strength}
                    className="flex-1"
                  />
                  <Select
                    label="Unit"
                    id="strengthUnit"
                    value={form.strengthUnit}
                    onChange={e => set('strengthUnit', e.target.value)}
                    className="w-28 shrink-0"
                  >
                    {['mg','mcg','g','ml','IU','%','mg/5ml','mcg/dose','Other'].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </Select>
                </div>
                <Select
                  label="Dosage Form"
                  id="dosageFormId"
                  required
                  value={form.dosageFormId}
                  onChange={e => set('dosageFormId', e.target.value)}
                  error={errors.dosageFormId}
                >
                  <option value="">Select dosage form…</option>
                  {dosageForms.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </Select>
                <Select
                  label="Therapeutic Category"
                  id="categoryId"
                  required
                  value={form.categoryId}
                  onChange={e => set('categoryId', e.target.value)}
                  error={errors.categoryId}
                >
                  <option value="">Select category…</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
                <Select
                  label="Manufacturer"
                  id="manufacturerId"
                  value={form.manufacturerId}
                  onChange={e => set('manufacturerId', e.target.value)}
                >
                  <option value="">Select manufacturer (optional)…</option>
                  {manufacturers.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </Select>
                <Input
                  label="Dosage Description / Directions"
                  id="dosageDescription"
                  placeholder="e.g. Take 1 tablet every 6 to 8 hours with water"
                  value={form.dosageDescription}
                  onChange={e => set('dosageDescription', e.target.value)}
                  className="sm:col-span-2"
                />
              </div>
            </Card>

            {/* Packaging & Barcodes */}
            <Card>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
                2. Stock Keeping Units & Identifiers
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="sku" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      SKU (Stock Keeping Unit)
                    </label>
                    <button
                      type="button"
                      onClick={generateSku}
                      className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
                    >
                      <Sparkles size={12} /> Auto-generate
                    </button>
                  </div>
                  <Input
                    id="sku"
                    placeholder="e.g. SKU-PAN-500-101"
                    value={form.sku}
                    onChange={e => set('sku', e.target.value)}
                    error={errors.sku}
                    hint="Unique inventory code"
                  />
                </div>
                <Input
                  label="Primary Barcode / GTIN"
                  id="barcode"
                  placeholder="Scan or type barcode"
                  value={form.barcode}
                  onChange={e => set('barcode', e.target.value)}
                  error={errors.barcode}
                  hint="Supports standard handheld scanners"
                />
                <Input
                  label="Pack Size"
                  id="packSize"
                  placeholder="e.g. 10 or 30 or 100"
                  value={form.packSize}
                  onChange={e => set('packSize', e.target.value)}
                />
                <Input
                  label="Pack Unit of Measurement"
                  id="packUnit"
                  placeholder="e.g. Tablets, Capsules, Sachets, ml"
                  value={form.packUnit}
                  onChange={e => set('packUnit', e.target.value)}
                />
              </div>
            </Card>

            {/* Storage & Cautions */}
            <Card>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
                3. Clinical Guidelines & Storage Conditions
              </h3>
              <div className="flex flex-col gap-4">
                <Input
                  label="Storage Instructions"
                  id="storageInstructions"
                  value={form.storageInstructions}
                  onChange={e => set('storageInstructions', e.target.value)}
                  placeholder="e.g. Store below 25°C in a dry place. Protect from light."
                />
                <Textarea
                  label="Contraindications & Warnings"
                  id="warnings"
                  placeholder="e.g. Not recommended in hepatic impairment. Do not exceed 4g daily."
                  value={form.warnings}
                  onChange={e => set('warnings', e.target.value)}
                />
                <Textarea
                  label="General Description / Clinical Notes"
                  id="description"
                  placeholder="Optional indication summary or notes"
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                />
              </div>
            </Card>
          </div>

          {/* Sidebar options */}
          <div className="flex flex-col gap-5">
            <Card>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
                Status & Inventory Alert
              </h3>
              <div className="space-y-4">
                <Select
                  label="Catalogue Status"
                  id="status"
                  value={form.status}
                  onChange={e => set('status', e.target.value)}
                >
                  <option value="active">Active (Available for POS)</option>
                  <option value="inactive">Inactive (Temporarily Hidden)</option>
                  <option value="discontinued">Discontinued (Permanently Blocked)</option>
                </Select>
                <Input
                  label="Reorder Alert Quantity"
                  id="reorderLevel"
                  type="number"
                  min="0"
                  value={form.reorderLevel}
                  onChange={e => set('reorderLevel', e.target.value)}
                  hint="Generates low-stock alert when below this count"
                />
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
                Prescription Regulation
              </h3>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.requiresPrescription}
                  onChange={e => set('requiresPrescription', e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-green-600 rounded"
                />
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Requires Prescription (Rx)</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    POS billing terminal will lock dispensing until verification is approved.
                  </p>
                </div>
              </label>
            </Card>

            <Button
              type="submit"
              className="w-full py-3 text-base shadow-sm"
              isLoading={isSubmitting}
              leftIcon={<Save size={18} />}
            >
              {isEdit ? 'Save Changes' : 'Register Medicine'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

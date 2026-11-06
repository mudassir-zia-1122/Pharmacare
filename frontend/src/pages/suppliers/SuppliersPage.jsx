import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Building2, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../components/common/Table';
import { StatusBadge } from '../../components/common/Badge';
import { SearchBar } from '../../components/common/SearchBar';
import { Modal } from '../../components/common/Modal';
import { Input, Select, Textarea } from '../../components/common/Input';
import { EmptyState } from '../../components/common/EmptyState';
import { demoSuppliers } from '../../data/demoData';
import { useAuth } from '../../context/AuthContext';
import { settingsApi } from '../../api';

export function SuppliersPage() {
  const { isDemo } = useAuth();
  const [search, setSearch] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [modal, setModal] = useState({ open: false, editing: null });
  const [form, setForm] = useState({
    name: '',
    contact: '',
    phone: '',
    city: '',
    paymentTerms: 'Net 30',
    status: 'active',
    notes: '',
  });
  const [errors, setErrors] = useState({});

  const loadSuppliers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await settingsApi.fetchSuppliers();
      if (res && res.data && res.data.length > 0) {
        setSuppliers(
          res.data.map(s => ({
            id: s.id,
            name: s.name,
            contact: s.contact_person || s.contact || 'N/A',
            phone: s.phone || 'N/A',
            city: s.city || 'Karachi',
            paymentTerms: s.payment_terms || s.paymentTerms || 'Net 30',
            status: s.status || 'active',
          }))
        );
        setIsLive(true);
        setIsLoading(false);
        return;
      }
    } catch {
      setIsLive(false);
    }

    setSuppliers(demoSuppliers);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const filtered = suppliers.filter(s =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.city.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setForm({ name: '', contact: '', phone: '', city: '', paymentTerms: 'Net 30', status: 'active', notes: '' });
    setErrors({});
    setModal({ open: true, editing: null });
  };

  const openEdit = (s) => {
    setForm({ ...s, notes: '' });
    setErrors({});
    setModal({ open: true, editing: s });
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');

  const handleSave = async () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Supplier name is required.';
    if (!form.phone.trim()) e.phone = 'Phone number is required.';
    if (Object.keys(e).length > 0) { setErrors(e); return; }

    setIsSubmitting(true);
    setActionError('');
    try {
      if (modal.editing) {
        await settingsApi.updateSupplier(modal.editing.id, {
          name: form.name.trim(),
          contactPerson: form.contact?.trim() || null,
          phone: form.phone.trim(),
          city: form.city?.trim() || 'Karachi',
          paymentTerms: form.paymentTerms || 'Net 30',
          status: form.status || 'active',
          notes: form.notes || null,
        });
      } else {
        await settingsApi.createSupplier({
          name: form.name.trim(),
          contactPerson: form.contact?.trim() || null,
          phone: form.phone.trim(),
          city: form.city?.trim() || 'Karachi',
          paymentTerms: form.paymentTerms || 'Net 30',
          status: form.status || 'active',
          notes: form.notes || null,
        });
      }
      await loadSuppliers();
      setModal({ open: false, editing: null });
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (supplier) => {
    if (!window.confirm(`Are you sure you want to remove supplier "${supplier.name}"? If they have linked purchase orders, they will be safely deactivated.`)) {
      return;
    }
    try {
      await settingsApi.deleteSupplier(supplier.id);
      await loadSuppliers();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to delete supplier');
    }
  };

  return (
    <div>
      <PageHeader
        title="Suppliers"
        subtitle={
          isLive
            ? `${suppliers.length} pharmaceutical suppliers registered in MySQL database.`
            : "Pharmaceutical suppliers and distributors"
        }
        showDemoTag={!isLive || isDemo}
        breadcrumbs={[{ label: 'Suppliers' }]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={loadSuppliers}
              title="Refresh suppliers"
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <Button leftIcon={<Plus size={16} />} onClick={openAdd}>Add Supplier</Button>
          </div>
        }
      />

      <Card padding={false}>
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <SearchBar value={search} onChange={setSearch} placeholder="Search suppliers..." className="max-w-sm" />
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Building2} title="No suppliers found" />
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>Supplier Name</Th>
                <Th>Contact Person</Th>
                <Th>Phone</Th>
                <Th>City</Th>
                <Th>Payment Terms</Th>
                <Th>Status</Th>
                <Th></Th>
              </tr>
            </Thead>
            <Tbody>
              {filtered.map(s => (
                <Tr key={s.id}>
                  <Td className="font-medium text-slate-900 dark:text-slate-100">{s.name}</Td>
                  <Td className="text-slate-500">{s.contact}</Td>
                  <Td className="text-slate-500">{s.phone}</Td>
                  <Td className="text-slate-500">{s.city}</Td>
                  <Td className="text-slate-500">{s.paymentTerms}</Td>
                  <Td><StatusBadge status={s.status} /></Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors" title="Edit Supplier">
                        <Edit size={15} />
                      </button>
                      <button onClick={() => handleDelete(s)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors" title="Delete / Deactivate">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>

      <Modal isOpen={modal.open} onClose={() => setModal({ open: false, editing: null })} title={modal.editing ? 'Edit Supplier' : 'Add Supplier'} size="md">
        {actionError && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm">
            {actionError}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <Input label="Supplier Name" id="supName" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} error={errors.name} placeholder="e.g. MedPlus Distributors" className="sm:col-span-2" />
          <Input label="Contact Person" id="supContact" value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} placeholder="Full name" />
          <Input label="Phone" id="supPhone" required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} error={errors.phone} placeholder="0300-0000000" />
          <Input label="City" id="supCity" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="e.g. Karachi" />
          <Select label="Payment Terms" id="supPayment" value={form.paymentTerms} onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))}>
            {['Cash', 'Net 15', 'Net 30', 'Net 45', 'Net 60'].map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Select label="Status" id="supStatus" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
          <Textarea label="Notes" id="supNotes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" className="sm:col-span-2" rows={2} />
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setModal({ open: false, editing: null })} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSubmitting}>{isSubmitting ? 'Saving...' : (modal.editing ? 'Save Changes' : 'Add Supplier')}</Button>
        </div>
      </Modal>
    </div>
  );
}

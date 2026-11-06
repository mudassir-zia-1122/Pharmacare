import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Tag, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal, ConfirmDialog } from '../../components/common/Modal';
import { EmptyState } from '../../components/common/EmptyState';
import { demoCategories } from '../../data/demoData';
import { useAuth } from '../../context/AuthContext';
import { medicineApi } from '../../api';

export function CategoriesPage() {
  const { isDemo } = useAuth();
  const [categories, setCategories] = useState([]);
  const [modal, setModal] = useState({ open: false, editing: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null });
  const [form, setForm] = useState({ name: '', description: '' });
  const [errors, setErrors] = useState({});
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await medicineApi.fetchCategories();
      if (res && res.data && res.data.length > 0) {
        setCategories(res.data);
        setIsLive(true);
        setIsLoading(false);
        return;
      }
    } catch {
      setIsLive(false);
    }
    setCategories(demoCategories);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const openAdd = () => {
    setForm({ name: '', description: '' });
    setErrors({});
    setModal({ open: true, editing: null });
  };

  const openEdit = (cat) => {
    setForm({ name: cat.name, description: cat.description || '' });
    setErrors({});
    setModal({ open: true, editing: cat });
  };

  const handleSave = async () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Category name is required.';
    if (Object.keys(e).length > 0) { setErrors(e); return; }

    try {
      await medicineApi.createCategory({ name: form.name.trim(), description: form.description.trim() });
      await loadCategories();
    } catch {
      if (modal.editing) {
        setCategories(cs => cs.map(c => c.id === modal.editing.id ? { ...c, ...form } : c));
      } else {
        setCategories(cs => [...cs, { id: Date.now(), ...form, medicineCount: 0 }]);
      }
    }
    setModal({ open: false, editing: null });
  };

  const handleDelete = () => {
    setCategories(cs => cs.filter(c => c.id !== deleteModal.id));
    setDeleteModal({ open: false, id: null });
  };

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle={
          isLive
            ? `${categories.length} therapeutic categories registered in MySQL.`
            : "Manage medicine categories"
        }
        showDemoTag={!isLive || isDemo}
        breadcrumbs={[{ label: 'Medicines', to: '/medicines' }, { label: 'Categories' }]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={loadCategories}
              title="Refresh categories"
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <Button leftIcon={<Plus size={16} />} onClick={openAdd}>Add Category</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.length === 0 ? (
          <div className="col-span-full"><EmptyState icon={Tag} title="No categories found" /></div>
        ) : (
          categories.map(cat => (
            <Card key={cat.id}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">{cat.name}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{cat.description || 'No description provided'}</p>
                  <p className="text-xs text-slate-400 mt-2 font-medium">{cat.medicineCount ?? 0} medicines</p>
                </div>
                <div className="flex gap-1 ml-2">
                  <button onClick={() => openEdit(cat)} className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors" aria-label="Edit">
                    <Edit size={15} />
                  </button>
                  <button onClick={() => setDeleteModal({ open: true, id: cat.id })} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" aria-label="Delete">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal isOpen={modal.open} onClose={() => setModal({ open: false, editing: null })} title={modal.editing ? 'Edit Category' : 'Add Category'} size="sm">
        <div className="flex flex-col gap-4">
          <Input label="Category Name" id="catName" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} error={errors.name} placeholder="e.g. Antibiotics & Antimicrobials" />
          <Input label="Description" id="catDesc" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief clinical description" />
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setModal({ open: false, editing: null })}>Cancel</Button>
            <Button onClick={handleSave}>{modal.editing ? 'Save' : 'Add'}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, id: null })}
        onConfirm={handleDelete}
        title="Delete Category"
        message="Are you sure you want to remove this category? (Demo safety check)"
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

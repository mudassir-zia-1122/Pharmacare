import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Layers, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal, ConfirmDialog } from '../../components/common/Modal';
import { demoDosageForms } from '../../data/demoData';
import { useAuth } from '../../context/AuthContext';
import { medicineApi } from '../../api';

export function DosageFormsPage() {
  const { isDemo } = useAuth();
  const [forms, setForms] = useState([]);
  const [modal, setModal] = useState({ open: false, editing: null });
  const [deleteId, setDeleteId] = useState(null);
  const [formName, setFormName] = useState('');
  const [error, setError] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadDosageForms = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await medicineApi.fetchDosageForms();
      if (res && res.data && res.data.length > 0) {
        setForms(res.data);
        setIsLive(true);
        setIsLoading(false);
        return;
      }
    } catch {
      setIsLive(false);
    }
    setForms(demoDosageForms.map((name, i) => ({ id: i + 1, name })));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadDosageForms();
  }, [loadDosageForms]);

  const openAdd = () => { setFormName(''); setError(''); setModal({ open: true, editing: null }); };
  const openEdit = (f) => { setFormName(f.name); setError(''); setModal({ open: true, editing: f }); };

  const handleSave = () => {
    if (!formName.trim()) { setError('Name is required.'); return; }
    if (modal.editing) {
      setForms(fs => fs.map(f => f.id === modal.editing.id ? { ...f, name: formName } : f));
    } else {
      setForms(fs => [...fs, { id: Date.now(), name: formName }]);
    }
    setModal({ open: false, editing: null });
  };

  return (
    <div>
      <PageHeader
        title="Dosage Forms"
        subtitle={
          isLive
            ? `${forms.length} dosage forms configured in MySQL database.`
            : "Configurable list of medicine dosage forms"
        }
        showDemoTag={!isLive || isDemo}
        breadcrumbs={[{ label: 'Medicines', to: '/medicines' }, { label: 'Dosage Forms' }]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={loadDosageForms}
              title="Refresh dosage forms"
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <Button leftIcon={<Plus size={16} />} onClick={openAdd}>Add Form</Button>
          </div>
        }
      />

      <Card padding={false}>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {forms.map(f => (
            <div key={f.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                  <Layers size={14} className="text-blue-600" />
                </div>
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{f.name}</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(f)} className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors" aria-label="Edit">
                  <Edit size={15} />
                </button>
                <button onClick={() => setDeleteId(f.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" aria-label="Delete">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Modal isOpen={modal.open} onClose={() => setModal({ open: false, editing: null })} title={modal.editing ? 'Edit Dosage Form' : 'Add Dosage Form'} size="sm">
        <div className="flex flex-col gap-4">
          <Input label="Form Name" id="formName" required value={formName} onChange={e => setFormName(e.target.value)} error={error} placeholder="e.g. Tablet" />
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setModal({ open: false, editing: null })}>Cancel</Button>
            <Button onClick={handleSave}>{modal.editing ? 'Save' : 'Add'}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { setForms(fs => fs.filter(f => f.id !== deleteId)); setDeleteId(null); }}
        title="Delete Dosage Form"
        message="Are you sure? (Demo safety check)"
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

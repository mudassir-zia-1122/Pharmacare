import { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, RefreshCw, Trash2, PackageCheck, AlertCircle, ShoppingCart } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../components/common/Table';
import { StatusBadge } from '../../components/common/Badge';
import { SearchBar } from '../../components/common/SearchBar';
import { Modal } from '../../components/common/Modal';
import { Input, Select } from '../../components/common/Input';
import { EmptyState } from '../../components/common/EmptyState';
import { demoPurchases, demoSuppliers } from '../../data/demoData';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { purchaseApi, settingsApi, medicineApi } from '../../api';

export function PurchasesPage() {
  const { settings } = useSettings();
  const { isDemo } = useAuth();
  const [search, setSearch] = useState('');
  const [newModal, setNewModal] = useState(false);
  const [viewModal, setViewModal] = useState({ open: false, po: null, details: null, loading: false });
  const [suppliers, setSuppliers] = useState(demoSuppliers);
  const [medicinesList, setMedicinesList] = useState([]);

  const [purchases, setPurchases] = useState([]);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [receiveSuccess, setReceiveSuccess] = useState('');

  // New PO form state
  const [form, setForm] = useState({
    supplierId: '',
    invoiceNo: '',
    orderDate: new Date().toISOString().split('T')[0],
    notes: '',
    items: [
      {
        medicineId: '',
        batchNumber: `BTH-${Date.now().toString().slice(-4)}`,
        expiryDate: '2027-12-31',
        orderedQuantity: 50,
        unitCostPrice: 15.00,
        unitSellingPrice: 22.00,
      },
    ],
  });

  // Load suppliers and medicine catalog
  useEffect(() => {
    let isMounted = true;
    settingsApi.fetchSuppliers().then(res => {
      if (isMounted && res?.data?.length > 0) {
        setSuppliers(res.data);
      }
    }).catch(() => null);

    medicineApi.fetchMedicines({ limit: 150 }).then(res => {
      if (isMounted && res?.data) {
        const meds = Array.isArray(res.data) ? res.data : (res.data.items || []);
        setMedicinesList(meds);
        if (meds.length > 0 && !form.items[0]?.medicineId) {
          setForm(prev => ({
            ...prev,
            items: prev.items.map(it => it.medicineId ? it : {
              ...it,
              medicineId: String(meds[0].id),
              unitCostPrice: Number(meds[0].purchase_price || meds[0].purchasePrice || 15),
              unitSellingPrice: Number(meds[0].selling_price || meds[0].sellingPrice || 22),
            }),
          }));
        }
      }
    }).catch(() => null);

    return () => { isMounted = false; };
  }, []);

  const loadPurchases = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await purchaseApi.fetchPurchaseOrders({
        search: search.trim() || undefined,
      });

      if (res && res.data) {
        const items = res.data.items || res.data;
        if (items.length > 0) {
          setPurchases(
            items.map(p => ({
              rawId: p.id,
              id: p.poNumber || `PO-${p.id}`,
              supplier: p.supplier || 'Direct Supply',
              date: p.orderDate,
              items: p.itemCount || 1,
              total: Number(p.totalAmount) || 0,
              status: p.status || 'received',
            }))
          );
          setIsLive(true);
          setIsLoading(false);
          return;
        }
      }
    } catch {
      setIsLive(false);
    }

    // Demo data fallback
    const filtered = demoPurchases.filter(p =>
      !search ||
      p.id.toLowerCase().includes(search.toLowerCase()) ||
      p.supplier.toLowerCase().includes(search.toLowerCase())
    );
    setPurchases(filtered);
    setIsLoading(false);
  }, [search]);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases]);

  const handleOpenView = async (po) => {
    setViewModal({ open: true, po, details: null, loading: true });
    setReceiveSuccess('');
    try {
      const res = await purchaseApi.fetchPurchaseOrder(po.rawId || po.id);
      if (res && res.data) {
        setViewModal(prev => ({ ...prev, details: res.data, loading: false }));
      } else {
        setViewModal(prev => ({ ...prev, loading: false }));
      }
    } catch {
      setViewModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleAddItem = () => {
    const defaultMed = medicinesList[0];
    setForm(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          medicineId: defaultMed ? String(defaultMed.id) : '',
          batchNumber: `BTH-${Math.floor(1000 + Math.random() * 9000)}`,
          expiryDate: '2027-12-31',
          orderedQuantity: 50,
          unitCostPrice: defaultMed ? Number(defaultMed.purchase_price || 15) : 15.00,
          unitSellingPrice: defaultMed ? Number(defaultMed.selling_price || 22) : 22.00,
        },
      ],
    }));
  };

  const handleRemoveItem = (index) => {
    if (form.items.length <= 1) return;
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleItemChange = (index, field, value) => {
    setForm(prev => {
      const updated = [...prev.items];
      updated[index] = { ...updated[index], [field]: value };

      if (field === 'medicineId') {
        const found = medicinesList.find(m => String(m.id) === String(value));
        if (found) {
          if (found.purchase_price) updated[index].unitCostPrice = Number(found.purchase_price);
          if (found.selling_price) updated[index].unitSellingPrice = Number(found.selling_price);
        }
      }
      return { ...prev, items: updated };
    });
  };

  const totalCalculated = form.items.reduce((sum, it) => {
    const qty = Number(it.orderedQuantity) || 0;
    const cost = Number(it.unitCostPrice) || 0;
    return sum + (qty * cost);
  }, 0);

  const handleCreatePO = async () => {
    setActionError('');
    if (!form.supplierId) {
      setActionError('Please select a supplier');
      return;
    }

    for (let i = 0; i < form.items.length; i++) {
      const it = form.items[i];
      if (!it.medicineId) {
        setActionError(`Please select a medicine for item #${i + 1}`);
        return;
      }
      if (Number(it.orderedQuantity) <= 0) {
        setActionError(`Quantity must be greater than zero for item #${i + 1}`);
        return;
      }
      if (Number(it.unitCostPrice) < 0) {
        setActionError(`Cost price cannot be negative for item #${i + 1}`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await purchaseApi.createPurchaseOrder({
        supplierId: Number(form.supplierId),
        supplierInvoiceNumber: form.invoiceNo.trim() || `SUP-INV-${Date.now().toString().slice(-4)}`,
        orderDate: form.orderDate || new Date().toISOString().split('T')[0],
        notes: form.notes.trim() || null,
        items: form.items.map(it => ({
          medicineId: Number(it.medicineId),
          batchNumber: it.batchNumber.trim() || `BTH-${Date.now().toString().slice(-4)}`,
          expiryDate: it.expiryDate || null,
          orderedQuantity: Number(it.orderedQuantity),
          unitCostPrice: Number(it.unitCostPrice),
          unitSellingPrice: Number(it.unitSellingPrice),
        })),
      });

      await loadPurchases();
      setNewModal(false);
      // Reset form
      setForm({
        supplierId: '',
        invoiceNo: '',
        orderDate: new Date().toISOString().split('T')[0],
        notes: '',
        items: [
          {
            medicineId: medicinesList[0] ? String(medicinesList[0].id) : '',
            batchNumber: `BTH-${Date.now().toString().slice(-4)}`,
            expiryDate: '2027-12-31',
            orderedQuantity: 50,
            unitCostPrice: 15.00,
            unitSellingPrice: 22.00,
          },
        ],
      });
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Failed to create Purchase Order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReceiveStock = async () => {
    if (!viewModal.details) return;
    const po = viewModal.details;

    const itemsToReceive = (po.items || []).map(it => ({
      poiId: it.id,
      receivedQty: Math.max(0, it.ordered_quantity - (it.received_quantity || 0)),
    })).filter(it => it.receivedQty > 0);

    if (itemsToReceive.length === 0) {
      alert('All items in this Purchase Order have already been received.');
      return;
    }

    setIsReceiving(true);
    try {
      await purchaseApi.receivePurchaseStock(po.id, itemsToReceive);
      setReceiveSuccess('Stock received successfully into active inventory batches!');
      await loadPurchases();
      // Reload details
      const fresh = await purchaseApi.fetchPurchaseOrder(po.id);
      if (fresh?.data) {
        setViewModal(prev => ({ ...prev, details: fresh.data }));
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to receive stock');
    } finally {
      setIsReceiving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        subtitle={
          isLive
            ? `${purchases.length} supplier orders registered in MySQL database.`
            : "Track stock received from suppliers"
        }
        showDemoTag={!isLive || isDemo}
        breadcrumbs={[{ label: 'Purchases' }]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={loadPurchases}
              title="Refresh purchases"
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <Button leftIcon={<Plus size={16} />} onClick={() => setNewModal(true)}>New Purchase Order</Button>
          </div>
        }
      />

      <Card padding={false}>
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by PO number or supplier..." className="max-w-sm" />
        </div>
        {purchases.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="No purchase orders found" />
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>PO Number</Th>
                <Th>Supplier</Th>
                <Th>Date</Th>
                <Th>Items</Th>
                <Th>Total</Th>
                <Th>Status</Th>
                <Th></Th>
              </tr>
            </Thead>
            <Tbody>
              {purchases.map(po => (
                <Tr key={po.id}>
                  <Td className="font-mono text-xs text-green-600 font-medium">{po.id}</Td>
                  <Td className="font-medium text-slate-800 dark:text-slate-200">{po.supplier}</Td>
                  <Td className="text-slate-500">{formatDate(po.date)}</Td>
                  <Td className="text-slate-500">{po.items}</Td>
                  <Td className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(po.total, settings.currencyCode)}</Td>
                  <Td><StatusBadge status={po.status} /></Td>
                  <Td>
                    <button
                      onClick={() => handleOpenView(po)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                      title="View Details & Receive Stock"
                    >
                      <Eye size={15} />
                    </button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>

      {/* New PO modal */}
      <Modal isOpen={newModal} onClose={() => setNewModal(false)} title="New Purchase Order" size="xl">
        {actionError && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{actionError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <Select label="Supplier" id="poSupplier" required value={form.supplierId} onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}>
            <option value="">Select supplier...</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Input label="Supplier Invoice Number" id="poInvoice" value={form.invoiceNo} onChange={e => setForm(f => ({ ...f, invoiceNo: e.target.value }))} placeholder="e.g. INV-9842" />
          <Input label="Order Date" id="poDate" type="date" value={form.orderDate} onChange={e => setForm(f => ({ ...f, orderDate: e.target.value }))} />
        </div>

        {/* Dynamic Items Section */}
        <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-200">Order Line Items</h4>
            <Button size="sm" variant="secondary" leftIcon={<Plus size={14} />} onClick={handleAddItem}>Add Medicine</Button>
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {form.items.map((item, idx) => (
              <div key={idx} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Medicine *</label>
                  <select
                    className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5"
                    value={item.medicineId}
                    onChange={e => handleItemChange(idx, 'medicineId', e.target.value)}
                  >
                    <option value="">Choose medicine...</option>
                    {medicinesList.map(m => (
                      <option key={m.id} value={m.id}>{m.brand_name || m.brandName || m.name} ({m.generic_name || m.genericName})</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Batch #</label>
                  <input
                    type="text"
                    className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5"
                    value={item.batchNumber}
                    onChange={e => handleItemChange(idx, 'batchNumber', e.target.value)}
                    placeholder="Batch"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5"
                    value={item.expiryDate}
                    onChange={e => handleItemChange(idx, 'expiryDate', e.target.value)}
                  />
                </div>

                <div className="sm:col-span-1">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Qty</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5"
                    value={item.orderedQuantity}
                    onChange={e => handleItemChange(idx, 'orderedQuantity', e.target.value)}
                  />
                </div>

                <div className="sm:col-span-1">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5"
                    value={item.unitCostPrice}
                    onChange={e => handleItemChange(idx, 'unitCostPrice', e.target.value)}
                  />
                </div>

                <div className="sm:col-span-1">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Selling</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5"
                    value={item.unitSellingPrice}
                    onChange={e => handleItemChange(idx, 'unitSellingPrice', e.target.value)}
                  />
                </div>

                <div className="sm:col-span-1 text-right text-xs font-semibold py-2">
                  {formatCurrency((Number(item.orderedQuantity) || 0) * (Number(item.unitCostPrice) || 0), settings.currencyCode)}
                </div>

                <div className="sm:col-span-1 flex justify-center pb-1">
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    disabled={form.items.length <= 1}
                    className="p-1 text-slate-400 hover:text-rose-500 disabled:opacity-30"
                    title="Remove item"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">Total Purchase Order Estimate:</span>
            <span className="font-bold text-base text-green-600">{formatCurrency(totalCalculated, settings.currencyCode)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setNewModal(false)} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleCreatePO} disabled={isSubmitting}>
            {isSubmitting ? 'Creating PO...' : 'Create Purchase Order'}
          </Button>
        </div>
      </Modal>

      {/* View PO modal */}
      <Modal isOpen={viewModal.open} onClose={() => setViewModal({ open: false, po: null, details: null, loading: false })} title={`Purchase Order ${viewModal.po?.id}`} size="lg">
        {viewModal.loading ? (
          <div className="py-8 text-center text-slate-400">Loading purchase order details...</div>
        ) : (
          <div className="flex flex-col gap-4">
            {receiveSuccess && (
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-sm flex items-center gap-2">
                <PackageCheck size={16} />
                <span>{receiveSuccess}</span>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div>
                <p className="text-slate-400 text-xs">Supplier</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200">{viewModal.details?.supplier_name || viewModal.po?.supplier}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Order Date</p>
                <p className="font-medium">{formatDate(viewModal.details?.order_date || viewModal.po?.date)}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Total Amount</p>
                <p className="font-bold text-green-600">{formatCurrency(viewModal.details?.total_amount || viewModal.po?.total, settings.currencyCode)}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Order Status</p>
                <StatusBadge status={viewModal.details?.status || viewModal.po?.status} />
              </div>
            </div>

            {/* Itemized medicines table */}
            {viewModal.details?.items && viewModal.details.items.length > 0 && (
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                    <tr>
                      <th className="p-2.5">Medicine</th>
                      <th className="p-2.5">Batch #</th>
                      <th className="p-2.5">Expiry</th>
                      <th className="p-2.5 text-center">Ordered</th>
                      <th className="p-2.5 text-center">Received</th>
                      <th className="p-2.5 text-right">Cost Price</th>
                      <th className="p-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {viewModal.details.items.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="p-2.5 font-medium text-slate-800 dark:text-slate-200">
                          {item.brand_name || item.generic_name}
                          <span className="block text-[10px] text-slate-400">{item.strength || ''} {item.strength_unit || ''}</span>
                        </td>
                        <td className="p-2.5 font-mono text-slate-600 dark:text-slate-400">{item.batch_number}</td>
                        <td className="p-2.5 text-slate-500">{item.expiry_date ? formatDate(item.expiry_date) : 'N/A'}</td>
                        <td className="p-2.5 text-center font-medium">{item.ordered_quantity}</td>
                        <td className="p-2.5 text-center font-bold text-green-600">{item.received_quantity || 0}</td>
                        <td className="p-2.5 text-right text-slate-600">{formatCurrency(item.unit_cost_price, settings.currencyCode)}</td>
                        <td className="p-2.5 text-right font-semibold">{formatCurrency(item.line_total, settings.currencyCode)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-between items-center pt-2">
              <Button variant="secondary" onClick={() => setViewModal({ open: false, po: null, details: null, loading: false })}>Close</Button>
              {viewModal.details?.status !== 'received' && (
                <Button
                  leftIcon={<PackageCheck size={16} />}
                  onClick={handleReceiveStock}
                  disabled={isReceiving}
                >
                  {isReceiving ? 'Receiving Stock...' : 'Receive Stock into Inventory'}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

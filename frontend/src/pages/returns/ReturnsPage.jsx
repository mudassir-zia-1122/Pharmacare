import { useState, useEffect, useCallback } from 'react';
import { RotateCcw, Plus, RefreshCw, Search, CheckCircle2, AlertCircle } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../components/common/Table';
import { StatusBadge, Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Input, Select, Textarea } from '../../components/common/Input';
import { EmptyState } from '../../components/common/EmptyState';
import { demoReturns } from '../../data/demoData';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { returnApi, posApi } from '../../api';

export function ReturnsPage() {
  const { settings } = useSettings();
  const { isDemo } = useAuth();
  const [modal, setModal] = useState(false);
  const [returns, setReturns] = useState([]);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Return form state
  const [refSearch, setRefSearch] = useState('');
  const [isSearchingInvoice, setIsSearchingInvoice] = useState(false);
  const [foundSale, setFoundSale] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [reason, setReason] = useState('Customer return - sealed packaging intact');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const loadReturns = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await returnApi.fetchReturns();
      if (res && res.data) {
        const items = res.data.items || res.data;
        if (items.length > 0) {
          setReturns(
            items.map(r => ({
              id: r.returnNumber || `RET-${r.id}`,
              type: r.returnType || 'sale_return',
              ref: r.reference || 'N/A',
              date: r.returnDate,
              customer: r.entityName || 'Walk-in',
              items: r.itemCount || 1,
              amount: Number(r.totalRefund) || 0,
              reason: r.reason || 'Customer return',
              status: r.status || 'completed',
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

    setReturns(demoReturns);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadReturns();
  }, [loadReturns]);

  const handleLookupInvoice = async () => {
    if (!refSearch.trim()) {
      setActionError('Please enter an Invoice Number to look up');
      return;
    }
    setActionError('');
    setIsSearchingInvoice(true);
    try {
      const res = await posApi.fetchSaleInvoice(refSearch.trim());
      if (res && res.data) {
        setFoundSale(res.data);
        const initial = (res.data.items || []).map(item => ({
          saleItemId: item.id,
          brandName: item.brand_name || item.brandName || 'Medicine',
          genericName: item.generic_name || item.genericName,
          batchNumber: item.batch_number || item.batchNumber,
          unitPrice: Number(item.unit_price || item.unitPrice || 0),
          soldQuantity: item.quantity,
          alreadyReturned: item.returned_quantity || 0,
          maxReturnable: item.quantity - (item.returned_quantity || 0),
          returnQuantity: 0,
          selected: false,
          restockAction: 'RESTOCK_ACTIVE',
        }));
        setReturnItems(initial);
      } else {
        setActionError('Invoice not found');
      }
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Invoice not found. Please verify the invoice number.');
    } finally {
      setIsSearchingInvoice(false);
    }
  };

  const handleToggleItem = (index) => {
    setReturnItems(prev => {
      const updated = [...prev];
      const current = updated[index];
      const newSelected = !current.selected;
      updated[index] = {
        ...current,
        selected: newSelected,
        returnQuantity: newSelected ? (current.returnQuantity || 1) : 0,
      };
      return updated;
    });
  };

  const handleItemQtyChange = (index, qty) => {
    const val = parseInt(qty, 10) || 0;
    setReturnItems(prev => {
      const updated = [...prev];
      const max = updated[index].maxReturnable;
      updated[index] = {
        ...updated[index],
        returnQuantity: Math.min(Math.max(0, val), max),
      };
      return updated;
    });
  };

  const handleRestockActionChange = (index, action) => {
    setReturnItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], restockAction: action };
      return updated;
    });
  };

  const totalRefundAmount = returnItems
    .filter(it => it.selected && it.returnQuantity > 0)
    .reduce((sum, it) => sum + (it.returnQuantity * it.unitPrice), 0);

  const handleSubmitReturn = async () => {
    setActionError('');
    if (!foundSale) {
      setActionError('Please find an invoice first.');
      return;
    }
    const itemsToSubmit = returnItems
      .filter(it => it.selected && it.returnQuantity > 0)
      .map(it => ({
        saleItemId: it.saleItemId,
        returnQuantity: it.returnQuantity,
        restockAction: it.restockAction,
      }));

    if (itemsToSubmit.length === 0) {
      setActionError('Please select at least one item with a valid return quantity.');
      return;
    }
    if (!reason.trim()) {
      setActionError('Reason for return is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await returnApi.processSaleReturn({
        saleId: foundSale.id,
        items: itemsToSubmit,
        reason: reason.trim(),
        notes: notes.trim() || null,
      });

      setActionSuccess('Return processed successfully! Inventory and financials updated.');
      await loadReturns();
      setTimeout(() => {
        setModal(false);
        setFoundSale(null);
        setReturnItems([]);
        setRefSearch('');
        setActionSuccess('');
      }, 1500);
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Failed to process return');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Returns Management"
        subtitle={
          isLive
            ? `Viewing ${returns.length} return authorizations with automated stock reintegration.`
            : "Sales returns and purchase returns"
        }
        showDemoTag={!isLive || isDemo}
        breadcrumbs={[{ label: 'Returns' }]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={loadReturns}
              title="Refresh returns"
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <Button leftIcon={<Plus size={16} />} onClick={() => { setModal(true); setActionError(''); setActionSuccess(''); }}>
              New Return
            </Button>
          </div>
        }
      />

      <Card padding={false}>
        {returns.length === 0 ? (
          <EmptyState icon={RotateCcw} title="No returns recorded" />
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>Return ID</Th>
                <Th>Type</Th>
                <Th>Reference</Th>
                <Th>Date</Th>
                <Th>Customer / Supplier</Th>
                <Th>Items</Th>
                <Th>Amount</Th>
                <Th>Reason</Th>
                <Th>Status</Th>
              </tr>
            </Thead>
            <Tbody>
              {returns.map(r => (
                <Tr key={r.id}>
                  <Td className="font-mono text-xs text-green-600 font-medium">{r.id}</Td>
                  <Td>
                    <Badge variant={r.type === 'SALE_RETURN' || r.type === 'sale_return' ? 'blue' : 'amber'}>
                      {r.type === 'SALE_RETURN' || r.type === 'sale_return' ? 'Sale Return' : 'Purchase Return'}
                    </Badge>
                  </Td>
                  <Td className="font-mono text-xs">{r.ref}</Td>
                  <Td className="text-slate-500">{formatDate(r.date)}</Td>
                  <Td className="text-slate-700 dark:text-slate-300 font-medium">{r.customer}</Td>
                  <Td className="text-slate-500">{r.items}</Td>
                  <Td className="font-semibold text-rose-600">-{formatCurrency(r.amount, settings.currencyCode)}</Td>
                  <Td className="text-slate-500 text-xs max-w-[200px]"><span className="truncate block">{r.reason}</span></Td>
                  <Td><StatusBadge status={r.status} /></Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>

      {/* New Return Modal */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title="Process Customer Sales Return" size="lg">
        {actionSuccess && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-sm flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{actionSuccess}</span>
          </div>
        )}
        {actionError && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{actionError}</span>
          </div>
        )}

        <div className="flex flex-col gap-4 mb-4">
          {/* Lookup Section */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="Original Invoice Number"
                id="retInvoiceRef"
                required
                placeholder="e.g. INV-202610-0001 or ID"
                value={refSearch}
                onChange={e => setRefSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLookupInvoice()}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              leftIcon={<Search size={15} />}
              onClick={handleLookupInvoice}
              disabled={isSearchingInvoice}
            >
              {isSearchingInvoice ? 'Searching...' : 'Find Invoice'}
            </Button>
          </div>

          {/* Found Invoice Banner */}
          {foundSale && (
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div><span className="text-slate-400">Invoice:</span> <strong className="font-mono text-green-600">{foundSale.invoice_number}</strong></div>
              <div><span className="text-slate-400">Customer:</span> <strong>{foundSale.customer_name || 'Walk-in'}</strong></div>
              <div><span className="text-slate-400">Date:</span> <strong>{formatDate(foundSale.sale_timestamp)}</strong></div>
              <div><span className="text-slate-400">Original Total:</span> <strong>{formatCurrency(foundSale.total_amount, settings.currencyCode)}</strong></div>
            </div>
          )}

          {/* Line items selector */}
          {returnItems.length > 0 && (
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <div className="p-2.5 bg-slate-100 dark:bg-slate-800 font-semibold text-xs text-slate-700 dark:text-slate-300">
                Select Items to Return & Restock Action
              </div>
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-2 text-center w-8">Select</th>
                    <th className="p-2">Medicine / Batch</th>
                    <th className="p-2 text-right">Price</th>
                    <th className="p-2 text-center">Sold (Rem)</th>
                    <th className="p-2 text-center w-24">Return Qty</th>
                    <th className="p-2">Restock Action</th>
                    <th className="p-2 text-right">Refund</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {returnItems.map((item, idx) => (
                    <tr key={item.saleItemId} className={item.selected ? 'bg-green-50/30 dark:bg-green-900/10' : ''}>
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          disabled={item.maxReturnable <= 0}
                          onChange={() => handleToggleItem(idx)}
                          className="rounded border-slate-300 text-green-600 focus:ring-green-500"
                        />
                      </td>
                      <td className="p-2">
                        <div className="font-medium text-slate-800 dark:text-slate-200">{item.brandName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">BTH: {item.batchNumber}</div>
                      </td>
                      <td className="p-2 text-right">{formatCurrency(item.unitPrice, settings.currencyCode)}</td>
                      <td className="p-2 text-center text-slate-500">
                        {item.soldQuantity} ({item.maxReturnable} left)
                      </td>
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          min="1"
                          max={item.maxReturnable}
                          value={item.returnQuantity}
                          disabled={!item.selected || item.maxReturnable <= 0}
                          onChange={e => handleItemQtyChange(idx, e.target.value)}
                          className="w-16 px-1.5 py-1 text-center border rounded dark:bg-slate-800 dark:border-slate-700"
                        />
                      </td>
                      <td className="p-2">
                        <select
                          value={item.restockAction}
                          disabled={!item.selected}
                          onChange={e => handleRestockActionChange(idx, e.target.value)}
                          className="text-xs px-2 py-1 rounded border dark:bg-slate-800 dark:border-slate-700"
                        >
                          <option value="RESTOCK_ACTIVE">Restock Active Shelf</option>
                          <option value="QUARANTINE_DAMAGED">Quarantine / Damaged</option>
                          <option value="EXPIRED_DISCARD">Expired / Discard</option>
                        </select>
                      </td>
                      <td className="p-2 text-right font-semibold text-rose-600">
                        {formatCurrency((item.selected ? item.returnQuantity : 0) * item.unitPrice, settings.currencyCode)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="p-3 bg-slate-50 dark:bg-slate-800 flex justify-between items-center text-xs font-semibold">
                <span>Calculated Total Refund Amount:</span>
                <span className="text-sm font-bold text-rose-600">{formatCurrency(totalRefundAmount, settings.currencyCode)}</span>
              </div>
            </div>
          )}

          <Input
            label="Reason for Return *"
            id="retReason"
            required
            placeholder="e.g. Dispensed incorrect strength; packaging unopened and verified"
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
          <Textarea
            label="Pharmacist Verification Notes"
            id="retNotes"
            placeholder="Seal intact, verified batch expiration, restocked to shelf..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setModal(false)} disabled={isSubmitting}>Cancel</Button>
          <Button
            onClick={handleSubmitReturn}
            disabled={isSubmitting || !foundSale || totalRefundAmount <= 0}
          >
            {isSubmitting ? 'Processing Return...' : `Authorize & Refund ${formatCurrency(totalRefundAmount, settings.currencyCode)}`}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

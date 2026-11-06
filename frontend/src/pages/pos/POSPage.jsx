import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ScanLine, Search, Plus, Minus, X,
  Receipt, ShoppingCart, Lock, Printer, FileText, AlertCircle, CheckCircle2
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { demoMedicines } from '../../data/demoData';
import { formatCurrency } from '../../utils/formatters';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { posApi } from '../../api';
import clsx from 'clsx';

export function POSPage() {
  const { settings } = useSettings();
  const { isDemo } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState('');
  const [discount, setDiscount] = useState(0);
  const [rxModal, setRxModal] = useState({ open: false, medicine: null });
  const [rxVerified, setRxVerified] = useState(false);
  const [receiptModal, setReceiptModal] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);
  const [pendingAdd, setPendingAdd] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const inputRef = useRef(null);

  // Check for pending prescription dispense on mount
  useEffect(() => {
    const pending = sessionStorage.getItem('pharmacare_pending_dispense');
    if (pending) {
      try {
        const parsed = JSON.parse(pending);
        if (parsed.patientName) {
          setCustomer(`${parsed.patientName} (${parsed.prescriptionNumber || 'Rx'})`);
        }
        setRxVerified(true);
        if (Array.isArray(parsed.items) && parsed.items.length > 0) {
          parsed.items.forEach(async (it) => {
            const medName = it.prescribed_medicine_name || it.prescribedMedicineName || it.medicineName || '';
            const qty = it.prescribed_quantity || it.prescribedQuantity || 1;
            try {
              const res = await posApi.searchPOSMedicines(medName.split(' ')[0]);
              if (res && res.data && res.data.length > 0) {
                const med = res.data[0];
                setCart(prev => [
                  ...prev,
                  {
                    id: med.id,
                    name: `${med.genericName} ${med.strength || ''} (${med.brandName})`,
                    price: Number(med.activePrice) || 18.00,
                    qty,
                    stock: med.stock,
                    requiresPrescription: Boolean(med.requiresPrescription),
                  }
                ]);
              }
            } catch (err) {
              console.warn('Could not auto-add prescription item to cart:', err);
            }
          });
        }
      } catch (err) {
        console.error('Failed to parse pending dispense:', err);
      } finally {
        sessionStorage.removeItem('pharmacare_pending_dispense');
      }
    }
  }, []);

  // Search medicines via live API or fallback to demo data
  const handleSearch = useCallback(async (val) => {
    setQuery(val);
    if (!val.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await posApi.searchPOSMedicines(val.trim());
      if (res && res.data) {
        setResults(res.data);
        setIsSearching(false);
        return;
      }
    } catch {
      // Degraded / offline fallback
    }

    const q = val.toLowerCase();
    const demoFiltered = demoMedicines
      .filter(m =>
        m.status === 'active' && (
          m.genericName.toLowerCase().includes(q) ||
          m.brandName.toLowerCase().includes(q) ||
          m.barcode.includes(q)
        )
      )
      .slice(0, 8)
      .map(m => ({
        id: m.id,
        genericName: m.genericName,
        brandName: m.brandName,
        strength: m.strength,
        dosageForm: m.dosageForm,
        barcode: m.barcode,
        activePrice: 18.00,
        stock: m.stock,
        requiresPrescription: m.requiresPrescription,
      }));

    setResults(demoFiltered);
    setIsSearching(false);
  }, []);

  const doAddToCart = (medicine) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === medicine.id);
      if (existing) {
        return prev.map(i => i.id === medicine.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [
        ...prev,
        {
          id: medicine.id,
          name: `${medicine.genericName} ${medicine.strength} (${medicine.brandName})`,
          price: Number(medicine.activePrice) || 18.00,
          qty: 1,
          stock: medicine.stock,
          requiresPrescription: Boolean(medicine.requiresPrescription),
        },
      ];
    });
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  };

  const addToCart = (medicine) => {
    if (medicine.stock <= 0) {
      alert(`Cannot add ${medicine.genericName}: Out of stock.`);
      return;
    }
    if (medicine.requiresPrescription && !rxVerified) {
      setPendingAdd(medicine);
      setRxModal({ open: true, medicine });
      return;
    }
    doAddToCart(medicine);
  };

  const handleRxConfirm = () => {
    setRxVerified(true);
    setRxModal({ open: false, medicine: null });
    if (pendingAdd) {
      doAddToCart(pendingAdd);
      setPendingAdd(null);
    }
  };

  const changeQty = (id, delta) =>
    setCart(prev =>
      prev.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i)
    );

  const removeItem = (id) => setCart(prev => prev.filter(i => i.id !== id));

  const clearCart = () => {
    setCart([]);
    setCustomer('');
    setDiscount(0);
    setRxVerified(false);
    setQuery('');
    setResults([]);
    setCompletedSale(null);
    setCheckoutError('');
  };

  const subtotal = cart.reduce((s, item) => s + item.qty * item.price, 0);
  const discountAmount = Math.min(Number(discount) || 0, subtotal);
  const taxAmount = settings.taxEnabled
    ? Math.round((subtotal - discountAmount) * (settings.defaultTaxRate / 100))
    : 0;
  const total = subtotal - discountAmount + taxAmount;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);
    setCheckoutError('');

    try {
      const payload = {
        items: cart.map(item => ({
          medicineId: item.id,
          quantity: item.qty,
        })),
        invoiceDiscount: Number(discount) || 0,
        prescriptionVerified: rxVerified,
        paymentMethod: 'cash',
        notes: customer ? `Customer: ${customer}` : null,
      };

      const res = await posApi.processCheckout(payload);
      if (res && res.data) {
        setCompletedSale({
          invoiceNumber: res.data.invoiceNumber,
          saleId: res.data.saleId,
          total: res.data.totalAmount,
          subtotal: res.data.subtotal,
          tax: res.data.taxAmount,
          discount: res.data.discountAmount,
          customer: customer || 'Walk-in Patient',
          items: cart,
          isLive: true,
          timestamp: new Date().toLocaleTimeString(),
        });
        setReceiptModal(true);
        setIsProcessing(false);
        return;
      }
    } catch (err) {
      console.warn('Backend checkout error, falling back to simulated receipt:', err.message);
      // If server returned a business rule error (e.g. stock exhausted), show warning
      if (err.status === 400) {
        setCheckoutError(err.message);
        setIsProcessing(false);
        return;
      }
    }

    // Fallback demo receipt
    setCompletedSale({
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      total,
      subtotal,
      tax: taxAmount,
      discount: discountAmount,
      customer: customer || 'Walk-in Patient',
      items: cart,
      isLive: false,
      timestamp: new Date().toLocaleTimeString(),
    });
    setReceiptModal(true);
    setIsProcessing(false);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4" style={{ minHeight: 'calc(100vh - 5rem)' }}>

      {/* ─── Left panel: search & selection ──────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">

        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">POS / Billing Terminal</h1>
            <span className={clsx('text-xs px-2.5 py-0.5 rounded-full font-semibold', isDemo ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800')}>
              {isDemo ? '⚠ Demo Mode' : '● Live FEFO Engine'}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            High-speed dispensary checkout with automated FEFO batch selection and barcode scanner support.
          </p>
        </div>

        {checkoutError && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{checkoutError}</span>
          </div>
        )}

        {/* Customer input */}
        <div className="w-full sm:w-72">
          <Input
            label="Customer Name / Prescription Ref"
            id="customerName"
            placeholder="Walk-in Patient (optional)"
            value={customer}
            onChange={e => setCustomer(e.target.value)}
          />
        </div>

        {/* Barcode & search bar */}
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <ScanLine size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Scan barcode or type medicine name / brand…"
                className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-600 transition-colors shadow-sm"
                autoFocus
              />
            </div>
            {query && (
              <button
                onClick={() => { setQuery(''); setResults([]); }}
                className="p-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Clear search"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Search Dropdown Results */}
          {results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-30 overflow-hidden divide-y divide-slate-100 dark:divide-slate-700 max-h-80 overflow-y-auto">
              {results.map(med => (
                <button
                  key={med.id}
                  onClick={() => addToCart(med)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-green-50 dark:hover:bg-green-900/20 text-left transition-colors group"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-green-600 transition-colors">
                        {med.genericName} {med.strength} {med.strengthUnit || ''}
                      </span>
                      <span className="text-xs text-slate-400">({med.brandName})</span>
                      {med.requiresPrescription && (
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded">
                          Rx
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">
                      Barcode: {med.barcode || 'N/A'} • {med.dosageForm}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {formatCurrency(med.activePrice || 18, settings.currencyCode)}
                    </p>
                    <p className={clsx('text-xs mt-0.5', med.stock <= 50 ? 'text-amber-600 font-semibold' : 'text-slate-400')}>
                      {med.stock > 0 ? `${med.stock} in stock` : 'Out of stock'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick info badges */}
        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
          <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
            <ScanLine size={13} /> Barcode scanner ready
          </span>
          <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
            FEFO: Dispensing oldest non-expired batches first
          </span>
        </div>
      </div>

      {/* ─── Right panel: Cart ───────────────────────────────────────────── */}
      <div className="w-full lg:w-96 shrink-0">
        <CartPanel
          cart={cart}
          discount={discount}
          setDiscount={setDiscount}
          subtotal={subtotal}
          discountAmount={discountAmount}
          taxAmount={taxAmount}
          total={total}
          settings={settings}
          changeQty={changeQty}
          removeItem={removeItem}
          clearCart={clearCart}
          handleCheckout={handleCheckout}
          isProcessing={isProcessing}
        />
      </div>

      {/* ─── Rx Verification Modal ──────────────────────────────────────── */}
      <Modal
        isOpen={rxModal.open}
        onClose={() => { setRxModal({ open: false, medicine: null }); setPendingAdd(null); }}
        title="Prescription Verification"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <Lock size={18} className="text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">Prescription Required</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                <strong>{rxModal.medicine?.genericName} {rxModal.medicine?.strength}</strong> is a
                prescription-only medicine. A valid prescription from a licensed physician must be
                verified before dispensing.
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Has the patient presented a valid medical prescription?
          </p>
          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              onClick={() => { setRxModal({ open: false, medicine: null }); setPendingAdd(null); }}
            >
              Cancel
            </Button>
            <Button onClick={handleRxConfirm}>Yes — Prescription Verified</Button>
          </div>
        </div>
      </Modal>

      {/* ─── Receipt Modal ──────────────────────────────────────────────── */}
      <Modal
        isOpen={receiptModal}
        onClose={() => { setReceiptModal(false); clearCart(); }}
        title={completedSale?.isLive ? "Sale Completed (MySQL Recorded)" : "Sale Recorded (Demo)"}
        size="md"
      >
        {completedSale && (
          <div className="flex flex-col gap-4">
            <div className={clsx('p-4 rounded-xl border text-center', completedSale.isLive ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' : 'bg-green-50 text-green-800 border-green-200')}>
              <CheckCircle2 size={28} className="mx-auto text-emerald-600 mb-1" />
              <p className="text-lg font-bold">
                {completedSale.isLive ? '✓ Sale Recorded in MySQL' : '✓ Sale Completed (Demo)'}
              </p>
              <p className="text-sm font-mono mt-0.5">
                Invoice Number: <strong>{completedSale.invoiceNumber}</strong>
              </p>
            </div>

            {/* Receipt preview */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-200 dark:border-slate-700 text-xs">
                <span className="font-semibold text-slate-500 uppercase tracking-wider">Itemized Receipt</span>
                <span className="text-slate-400">{completedSale.timestamp}</span>
              </div>
              <p className="text-xs mb-2 text-slate-600 dark:text-slate-300">
                <span className="text-slate-400">Customer:</span> {completedSale.customer}
              </p>
              <div className="space-y-1.5">
                {completedSale.items.map(item => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-300">{item.name} × {item.qty}</span>
                    <span className="font-medium">{formatCurrency(item.qty * item.price, settings.currencyCode)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 mt-3 pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span>{formatCurrency(completedSale.subtotal, settings.currencyCode)}</span>
                </div>
                {completedSale.discount > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Discount</span>
                    <span className="text-red-500">-{formatCurrency(completedSale.discount, settings.currencyCode)}</span>
                  </div>
                )}
                {completedSale.tax > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>{settings.taxLabel}</span>
                    <span>{formatCurrency(completedSale.tax, settings.currencyCode)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t border-slate-200 dark:border-slate-700 pt-2 mt-1">
                  <span>Total Paid</span>
                  <span>{formatCurrency(completedSale.total, settings.currencyCode)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end flex-wrap">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300"
              >
                <Printer size={14} /> Print Receipt
              </button>
              <Button onClick={() => { setReceiptModal(false); clearCart(); }}>
                New Transaction
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Cart Panel Component ─────────────────────────────────────────────────────
function CartPanel({
  cart, discount, setDiscount, subtotal, discountAmount, taxAmount,
  total, settings, changeQty, removeItem, clearCart, handleCheckout, isProcessing,
}) {
  return (
    <div className="flex flex-col w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <ShoppingCart size={18} className="text-green-600" />
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            Cart ({cart.length})
          </span>
        </div>
        {cart.length > 0 && (
          <button
            onClick={clearCart}
            className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: '40vh' }}>
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <ShoppingCart size={36} className="text-slate-200 dark:text-slate-700 mb-3" />
            <p className="text-sm text-slate-400">Cart is empty</p>
            <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">
              Search and add medicines above
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {cart.map(item => (
              <div key={item.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">
                      {item.name}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatCurrency(item.price, settings.currencyCode)} / unit
                    </p>
                    {item.requiresPrescription && (
                      <span className="inline-block text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded mt-1">
                        Rx Verified
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-1 text-slate-300 hover:text-red-500 transition-colors shrink-0 mt-0.5"
                    aria-label="Remove item"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => changeQty(item.id, -1)}
                      className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {item.qty}
                    </span>
                    <button
                      onClick={() => changeQty(item.id, 1)}
                      className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      aria-label="Increase quantity"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                    {formatCurrency(item.qty * item.price, settings.currencyCode)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Totals & checkout */}
      <div className="border-t border-slate-100 dark:border-slate-700 p-4">
        {/* Discount */}
        <div className="mb-3">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">
            Discount ({settings.currencySymbol})
          </label>
          <input
            type="number"
            min="0"
            value={discount}
            onChange={e => setDiscount(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-green-600 transition-colors"
            placeholder="0"
          />
        </div>

        {/* Tax preview */}
        {settings.taxEnabled && (
          <div className="mb-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>{settings.taxLabel} ({settings.defaultTaxRate}%)</span>
              <span>{formatCurrency(taxAmount, settings.currencyCode)}</span>
            </div>
          </div>
        )}

        {/* Breakdown */}
        <div className="space-y-1.5 text-sm mb-4">
          <div className="flex justify-between text-slate-500 dark:text-slate-400">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal, settings.currencyCode)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Discount</span>
              <span className="text-red-500">-{formatCurrency(discountAmount, settings.currencyCode)}</span>
            </div>
          )}
          {taxAmount > 0 && (
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Tax</span>
              <span>{formatCurrency(taxAmount, settings.currencyCode)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg text-slate-900 dark:text-slate-100 pt-2 border-t border-slate-100 dark:border-slate-700">
            <span>Total</span>
            <span className="text-green-600 dark:text-green-400">
              {formatCurrency(total, settings.currencyCode)}
            </span>
          </div>
        </div>

        {/* Checkout Button */}
        <Button
          onClick={handleCheckout}
          disabled={cart.length === 0 || isProcessing}
          isLoading={isProcessing}
          className="w-full py-3 text-base font-semibold shadow-md"
          leftIcon={<Receipt size={18} />}
        >
          {isProcessing ? 'Processing Transaction…' : `Charge ${formatCurrency(total, settings.currencyCode)}`}
        </Button>
      </div>
    </div>
  );
}

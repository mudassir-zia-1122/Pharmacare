import { useState, useEffect, useCallback } from 'react';
import { Eye, FileText, Printer, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/common/Card';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../components/common/Table';
import { StatusBadge } from '../../components/common/Badge';
import { SearchBar } from '../../components/common/SearchBar';
import { Select } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { Pagination } from '../../components/common/Pagination';
import { EmptyState } from '../../components/common/EmptyState';
import { demoSalesHistory } from '../../data/demoData';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { posApi } from '../../api';

const PAGE_SIZE = 10;

export function SalesPage() {
  const { settings } = useSettings();
  const { isDemo } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [viewModal, setViewModal] = useState({ open: false, sale: null, details: null, loading: false });

  const [sales, setSales] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadSales = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await posApi.fetchSales({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        page,
        limit: PAGE_SIZE,
      });

      if (res && res.data) {
        const items = res.data.items || res.data;
        if (items.length > 0) {
          setSales(
            items.map(s => ({
              rawId: s.id,
              id: s.invoiceNumber || `INV-${s.id}`,
              date: s.saleDate,
              customer: s.customer || 'Walk-in',
              items: s.itemCount || 1,
              subtotal: Number(s.subtotal) || 0,
              discount: Number(s.discount) || 0,
              total: Number(s.total) || 0,
              status: s.status || 'completed',
              cashier: s.cashier || 'Admin',
            }))
          );
          setTotalCount(res.pagination?.totalItems ?? items.length);
          setTotalPages(res.pagination?.totalPages ?? 1);
          setIsLive(true);
          setIsLoading(false);
          return;
        }
      }
    } catch {
      setIsLive(false);
    }

    // Demo data fallback
    const filtered = demoSalesHistory.filter(s => {
      const matchSearch = !search || s.id.toLowerCase().includes(search.toLowerCase()) || s.customer.toLowerCase().includes(search.toLowerCase());
      const matchStatus = !statusFilter || s.status === statusFilter;
      return matchSearch && matchStatus;
    });

    setTotalCount(filtered.length);
    setTotalPages(Math.ceil(filtered.length / PAGE_SIZE) || 1);
    setSales(filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
    setIsLoading(false);
  }, [search, statusFilter, page]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const handleOpenView = async (sale) => {
    setViewModal({ open: true, sale, details: null, loading: true });
    try {
      const res = await posApi.fetchSaleInvoice(sale.rawId || sale.id);
      if (res && res.data) {
        setViewModal(prev => ({ ...prev, details: res.data, loading: false }));
      } else {
        setViewModal(prev => ({ ...prev, loading: false }));
      }
    } catch {
      setViewModal(prev => ({ ...prev, loading: false }));
    }
  };

  return (
    <div>
      <PageHeader
        title="Sales History"
        subtitle={
          isLive
            ? `Viewing ${totalCount} transactions from MySQL database.`
            : "Invoice records and receipt actions"
        }
        showDemoTag={!isLive || isDemo}
        breadcrumbs={[{ label: 'Sales' }]}
        actions={
          <button
            onClick={loadSales}
            title="Refresh sales"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
        }
      />

      <Card padding={false}>
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row gap-3">
          <SearchBar value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search by invoice or customer..." className="flex-1" />
          <Select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="sm:w-40">
            <option value="">All Status</option>
            <option value="completed">Completed</option>
            <option value="returned">Returned</option>
          </Select>
        </div>

        {sales.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={search || statusFilter ? "No matching sales transactions" : "No sales recorded yet"}
            description={
              search || statusFilter
                ? "Try adjusting search criteria or selecting a different status filter."
                : "Transactions completed and invoiced at the POS billing terminal will be archived and displayed here."
            }
          />
        ) : (
          <>
            <Table>
              <Thead>
                <tr>
                  <Th>Invoice</Th>
                  <Th>Date</Th>
                  <Th>Customer</Th>
                  <Th>Items</Th>
                  <Th>Subtotal</Th>
                  <Th>Discount</Th>
                  <Th>Total</Th>
                  <Th>Status</Th>
                  <Th></Th>
                </tr>
              </Thead>
              <Tbody>
                {sales.map(s => (
                  <Tr key={s.id}>
                    <Td className="font-mono text-xs text-green-600 font-medium">{s.id}</Td>
                    <Td className="text-slate-500">{formatDate(s.date)}</Td>
                    <Td className="font-medium text-slate-800 dark:text-slate-200">{s.customer}</Td>
                    <Td className="text-slate-500">{s.items}</Td>
                    <Td className="text-slate-500">{formatCurrency(s.subtotal, settings.currencyCode)}</Td>
                    <Td className="text-red-500">{s.discount > 0 ? `-${formatCurrency(s.discount, settings.currencyCode)}` : '—'}</Td>
                    <Td className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(s.total, settings.currencyCode)}</Td>
                    <Td><StatusBadge status={s.status} /></Td>
                    <Td>
                      <button
                        onClick={() => handleOpenView(s)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                        title="View invoice & line items"
                      >
                        <Eye size={15} />
                      </button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={totalCount}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <Modal isOpen={viewModal.open} onClose={() => setViewModal({ open: false, sale: null, details: null, loading: false })} title={`Invoice ${viewModal.sale?.id}`} size="lg">
        {viewModal.loading ? (
          <div className="py-8 text-center text-slate-400">Loading invoice details...</div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div>
                <p className="text-slate-400 text-xs">Invoice Number</p>
                <p className="font-mono font-bold text-green-600">{viewModal.details?.invoice_number || viewModal.sale?.id}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Sale Date</p>
                <p className="font-medium">{formatDate(viewModal.details?.sale_timestamp || viewModal.sale?.date)}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Customer</p>
                <p className="font-medium">{viewModal.details?.customer_name || viewModal.sale?.customer}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Status</p>
                <StatusBadge status={viewModal.details?.status || viewModal.sale?.status} />
              </div>
            </div>

            {/* Itemized Medicine Details */}
            {viewModal.details?.items && viewModal.details.items.length > 0 && (
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                    <tr>
                      <th className="p-2.5">Medicine</th>
                      <th className="p-2.5">Batch</th>
                      <th className="p-2.5 text-center">Qty</th>
                      <th className="p-2.5 text-right">Unit Price</th>
                      <th className="p-2.5 text-right">Discount</th>
                      <th className="p-2.5 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {viewModal.details.items.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="p-2.5">
                          <span className="font-medium text-slate-800 dark:text-slate-200">{item.brand_name || item.brandName || 'Medicine'}</span>
                          <span className="block text-[10px] text-slate-400">{item.generic_name || ''} {item.strength || ''}</span>
                        </td>
                        <td className="p-2.5 font-mono text-slate-500">{item.batch_number}</td>
                        <td className="p-2.5 text-center font-medium">{item.quantity}</td>
                        <td className="p-2.5 text-right text-slate-600">{formatCurrency(item.unit_price, settings.currencyCode)}</td>
                        <td className="p-2.5 text-right text-rose-500">{Number(item.discount_amount) > 0 ? `-${formatCurrency(item.discount_amount, settings.currencyCode)}` : '—'}</td>
                        <td className="p-2.5 text-right font-semibold">{formatCurrency(item.line_total, settings.currencyCode)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totals Summary */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg flex flex-col gap-1 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal:</span>
                <span>{formatCurrency(viewModal.details?.subtotal_amount || viewModal.sale?.subtotal, settings.currencyCode)}</span>
              </div>
              {Number(viewModal.details?.tax_amount) > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Tax:</span>
                  <span>+{formatCurrency(viewModal.details?.tax_amount, settings.currencyCode)}</span>
                </div>
              )}
              {Number(viewModal.details?.discount_amount || viewModal.sale?.discount) > 0 && (
                <div className="flex justify-between text-rose-500">
                  <span>Discount:</span>
                  <span>-{formatCurrency(viewModal.details?.discount_amount || viewModal.sale?.discount, settings.currencyCode)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-slate-100 border-t border-slate-200 dark:border-slate-700 pt-1 mt-1">
                <span>Total Paid:</span>
                <span className="text-green-600">{formatCurrency(viewModal.details?.total_amount || viewModal.sale?.total, settings.currencyCode)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <Printer size={14} /> Print Receipt
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

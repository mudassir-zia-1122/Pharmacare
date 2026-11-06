import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Edit,
  Trash2,
  Eye,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  FileText,
  RefreshCw,
  ShoppingBag,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input, Textarea } from '../../components/common/Input';
import { Modal, ConfirmDialog } from '../../components/common/Modal';
import { EmptyState, LoadingSpinner } from '../../components/common/EmptyState';
import { Pagination } from '../../components/common/Pagination';
import { customerApi } from '../../api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';

const PAGE_SIZE = 10;

export function CustomersPage() {
  const { settings } = useSettings();
  const { hasRole } = useAuth();
  const canManage = hasRole(['admin', 'pharmacist', 'cashier']);
  const canDelete = hasRole(['admin']);

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Modals
  const [formModal, setFormModal] = useState({ open: false, editing: null });
  const [viewModal, setViewModal] = useState({ open: false, customer: null, orders: [], loadingOrders: false });
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, customer: null });
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    cnic: '',
    isTaxExempt: false,
    notes: '',
  });
  const [errors, setErrors] = useState({});

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await customerApi.fetchCustomers({
        search: search.trim() || undefined,
        page,
        limit: PAGE_SIZE,
      });

      if (res && res.data) {
        setCustomers(res.data);
        if (res.pagination) {
          setTotalPages(res.pagination.totalPages || 1);
          setTotalItems(res.pagination.totalItems || 0);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleOpenForm = (customer = null) => {
    setErrors({});
    if (customer) {
      setFormData({
        name: customer.name || '',
        phone: customer.phone || '',
        email: customer.email || '',
        address: customer.address || '',
        cnic: customer.cnic || '',
        isTaxExempt: Boolean(customer.isTaxExempt),
        notes: customer.notes || '',
      });
      setFormModal({ open: true, editing: customer });
    } else {
      setFormData({
        name: '',
        phone: '',
        email: '',
        address: '',
        cnic: '',
        isTaxExempt: false,
        notes: '',
      });
      setFormModal({ open: true, editing: null });
    }
  };

  const handleOpenView = async (customer) => {
    setViewModal({ open: true, customer, orders: [], loadingOrders: true });
    try {
      const res = await customerApi.getCustomer(customer.id);
      if (res && res.data) {
        setViewModal({
          open: true,
          customer: res.data,
          orders: res.data.recentOrders || [],
          loadingOrders: false,
        });
      }
    } catch {
      setViewModal((v) => ({ ...v, loadingOrders: false }));
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Customer name is required';
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      if (formModal.editing) {
        await customerApi.updateCustomer(formModal.editing.id, formData);
        toast.success('Customer updated successfully');
      } else {
        await customerApi.createCustomer(formData);
        toast.success('Customer profile created successfully');
      }
      setFormModal({ open: false, editing: null });
      loadCustomers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save customer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.customer) return;
    setSubmitting(true);
    try {
      await customerApi.deleteCustomer(deleteConfirm.customer.id);
      toast.success('Customer removed successfully');
      setDeleteConfirm({ open: false, customer: null });
      loadCustomers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete customer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-8">
      <PageHeader
        title="Customers Management"
        subtitle="Maintain verified client profiles, contact records and customer purchase history"
        breadcrumbs={[{ label: 'Customers' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw size={13} className={loading ? 'animate-spin' : ''} />}
              onClick={loadCustomers}
            >
              Refresh
            </Button>
            {canManage && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<UserPlus size={14} />}
                onClick={() => handleOpenForm()}
              >
                Add Customer
              </Button>
            )}
          </div>
        }
      />

      {/* Search and Filters Bar */}
      <Card className="p-4" padding={false}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, phone, CNIC or email…"
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Showing <strong className="text-slate-900 dark:text-slate-100">{customers.length}</strong> of{' '}
            <strong className="text-slate-900 dark:text-slate-100">{totalItems}</strong> customers
          </span>
        </div>
      </Card>

      {/* Main Customers List */}
      <Card className="p-0 overflow-hidden" padding={false}>
        {loading ? (
          <div className="py-20 flex justify-center">
            <LoadingSpinner size="lg" message="Loading customer profiles…" />
          </div>
        ) : customers.length === 0 ? (
          <div className="py-16 text-center">
            <EmptyState
              icon={Users}
              title={search ? 'No matching customers found' : 'No customers registered yet'}
              description={
                search
                  ? `No profiles matching "${search}". Try adjusting your query.`
                  : 'Add customer profiles to track purchase history, tax-exempt sales, and repeat orders.'
              }
              action={
                !search && canManage ? (
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<UserPlus size={14} />}
                    onClick={() => handleOpenForm()}
                  >
                    Add First Customer
                  </Button>
                ) : null
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-700/80 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-3 px-4 font-semibold">Customer</th>
                  <th className="py-3 px-4 font-semibold">Phone & Email</th>
                  <th className="py-3 px-4 font-semibold">CNIC / ID</th>
                  <th className="py-3 px-4 font-semibold text-center">Total Orders</th>
                  <th className="py-3 px-4 font-semibold text-right">Total Spent</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{c.name}</p>
                          {c.address && (
                            <p className="text-[11px] text-slate-400 truncate max-w-xs">{c.address}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        {c.phone ? (
                          <p className="font-mono text-slate-700 dark:text-slate-300">{c.phone}</p>
                        ) : (
                          <span className="text-slate-400 italic">No phone</span>
                        )}
                        {c.email && <p className="text-[11px] text-slate-400">{c.email}</p>}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                      {c.cnic || <span className="text-slate-400 italic">—</span>}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-slate-700 dark:text-slate-300">
                      {c.totalOrders || 0}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(c.totalSpent || 0, settings.currencyCode)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenView(c)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          title="View Details"
                        >
                          <Eye size={15} />
                        </button>
                        {canManage && (
                          <button
                            onClick={() => handleOpenForm(c)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                            title="Edit Customer"
                          >
                            <Edit size={15} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => setDeleteConfirm({ open: true, customer: c })}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            title="Delete Customer"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-center">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </Card>

      {/* Add / Edit Customer Modal */}
      <Modal
        open={formModal.open}
        onClose={() => setFormModal({ open: false, editing: null })}
        title={formModal.editing ? 'Edit Customer' : 'Add New Customer'}
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <Input
            label="Full Name *"
            id="custName"
            value={formData.name}
            onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
            error={errors.name}
            placeholder="e.g. Tariq Mehmood"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Phone Number"
              id="custPhone"
              value={formData.phone}
              onChange={(e) => setFormData((f) => ({ ...f, phone: e.target.value }))}
              placeholder="e.g. 03001234567"
            />
            <Input
              label="Email Address"
              id="custEmail"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
              placeholder="e.g. customer@domain.com"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="CNIC / National ID"
              id="custCnic"
              value={formData.cnic}
              onChange={(e) => setFormData((f) => ({ ...f, cnic: e.target.value }))}
              placeholder="e.g. 37405-1234567-1"
            />
            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={formData.isTaxExempt}
                  onChange={(e) => setFormData((f) => ({ ...f, isTaxExempt: e.target.checked }))}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                Tax Exempt Customer
              </label>
            </div>
          </div>

          <Textarea
            label="Street Address"
            id="custAddress"
            rows={2}
            value={formData.address}
            onChange={(e) => setFormData((f) => ({ ...f, address: e.target.value }))}
            placeholder="Street address, city, area"
          />

          <Textarea
            label="Clinical / Account Notes"
            id="custNotes"
            rows={2}
            value={formData.notes}
            onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Optional allergies, chronic prescriptions or credit notes"
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFormModal({ open: false, editing: null })}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={submitting}>
              {submitting ? 'Saving…' : formModal.editing ? 'Update Customer' : 'Create Customer'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Customer Details & History Modal */}
      <Modal
        open={viewModal.open}
        onClose={() => setViewModal({ open: false, customer: null, orders: [], loadingOrders: false })}
        title="Customer Profile & History"
      >
        {viewModal.customer && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-sm shrink-0">
                {viewModal.customer.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {viewModal.customer.name}
                </h3>
                <p className="text-xs text-slate-400">
                  Registered {formatDate(viewModal.customer.createdAt)}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400">Total Spent</span>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(viewModal.customer.totalSpent || 0, settings.currencyCode)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 flex items-center gap-1 mb-0.5">
                  <Phone size={12} /> Phone
                </span>
                <p className="font-medium text-slate-800 dark:text-slate-200">
                  {viewModal.customer.phone || 'N/A'}
                </p>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 flex items-center gap-1 mb-0.5">
                  <Mail size={12} /> Email
                </span>
                <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
                  {viewModal.customer.email || 'N/A'}
                </p>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 flex items-center gap-1 mb-0.5">
                  <CreditCard size={12} /> CNIC
                </span>
                <p className="font-medium text-slate-800 dark:text-slate-200">
                  {viewModal.customer.cnic || 'N/A'}
                </p>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 flex items-center gap-1 mb-0.5">
                  <MapPin size={12} /> Address
                </span>
                <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
                  {viewModal.customer.address || 'N/A'}
                </p>
              </div>
            </div>

            {/* Recent Orders Section */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-1.5">
                <ShoppingBag size={14} className="text-emerald-600" /> Recent Invoices
              </h4>
              {viewModal.orders.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                  No purchases recorded yet for this customer.
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-lg">
                  {viewModal.orders.map((o) => (
                    <div key={o.id} className="p-2 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-mono font-semibold text-emerald-600">{o.invoiceNumber}</span>
                        <span className="text-slate-400 ml-2">{formatDate(o.saleTimestamp)}</span>
                      </div>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(o.total, settings.currencyCode)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, customer: null })}
        onConfirm={handleDelete}
        title="Delete Customer Profile"
        message={`Are you sure you want to remove "${deleteConfirm.customer?.name}"? Past sales and prescription records will remain intact.`}
        confirmText="Delete Customer"
        variant="danger"
        loading={submitting}
      />
    </div>
  );
}

export default CustomersPage;

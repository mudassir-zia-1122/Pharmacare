import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, UserX, UserCheck, RefreshCw, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../components/common/Table';
import { StatusBadge, RoleBadge } from '../../components/common/Badge';
import { Modal, ConfirmDialog } from '../../components/common/Modal';
import { Input, Select } from '../../components/common/Input';
import { LoadingSpinner } from '../../components/common/EmptyState';
import { demoUsers } from '../../data/demoData';
import { userApi } from '../../api';
import { useAuth } from '../../context/AuthContext';

const ROLES = [
  { value: 'admin',         label: 'Admin',         desc: 'Full access to all features, settings and users' },
  { value: 'pharmacist',    label: 'Pharmacist',    desc: 'Dispensing, verification, clinical stock view & inquiries' },
  { value: 'stock_manager', label: 'Stock Manager', desc: 'Purchases, suppliers, deliveries & inventory management' },
  { value: 'cashier',       label: 'Cashier',       desc: 'Point of Sale (POS) checkout & billing receipts' },
  { value: 'doctor',        label: 'Doctor',        desc: 'Consultation portal, patient queue & e-prescriptions' },
  { value: 'reception',     label: 'Receptionist',  desc: 'Front desk registration, appointments & token queue' },
];

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, editing: null });
  const [toggleConfirm, setToggleConfirm] = useState({ open: false, user: null });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '', username: '', email: '', role: 'cashier', password: '', phone: '', status: 'active',
  });
  const [errors, setErrors] = useState({});

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await userApi.fetchUsers();
      if (res && res.data) {
        setUsers(
          res.data.map(u => ({
            id: u.id,
            name: u.fullName || u.username,
            username: u.username,
            email: u.email,
            role: u.role,
            status: u.status,
            phone: u.phone,
            lastLogin: u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never',
          }))
        );
      }
    } catch (err) {
      console.warn('Live users API unavailable, falling back to demo users:', err.message);
      setUsers(demoUsers);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const openAdd = () => {
    setForm({ name: '', username: '', email: '', role: 'cashier', password: '', phone: '', status: 'active' });
    setErrors({});
    setModal({ open: true, editing: null });
  };

  const openEdit = (u) => {
    setForm({
      name: u.name,
      username: u.username,
      email: u.email,
      role: u.role,
      password: '',
      phone: u.phone || '',
      status: u.status,
    });
    setErrors({});
    setModal({ open: true, editing: u });
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Full name is required.';
    if (!form.username.trim()) e.username = 'Username is required.';
    if (!form.email.trim()) e.email = 'Email address is required.';
    if (!modal.editing && !form.password.trim()) e.password = 'Password is required for new users.';
    if (form.password && form.password.length < 8) e.password = 'Password must be at least 8 characters.';
    return e;
  };

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setIsSubmitting(true);
    try {
      if (modal.editing) {
        await userApi.updateUser(modal.editing.id, {
          name: form.name,
          role: form.role,
          status: form.status,
          password: form.password || undefined,
          phone: form.phone,
        });
        toast.success(`Account for ${form.name} updated successfully`);
      } else {
        await userApi.createUser({
          name: form.name,
          username: form.username,
          email: form.email,
          role: form.role,
          password: form.password,
          phone: form.phone,
          status: form.status,
        });
        toast.success(`New staff account for ${form.name} created successfully`);
      }
      setModal({ open: false, editing: null });
      await loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to save user account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async () => {
    if (!toggleConfirm.user) return;
    try {
      const res = await userApi.toggleUserStatus(toggleConfirm.user.id);
      const newStatus = res?.data?.status || (toggleConfirm.user.status === 'active' ? 'inactive' : 'active');
      toast.success(`User ${toggleConfirm.user.name} is now ${newStatus}`);
      setToggleConfirm({ open: false, user: null });
      await loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to update user status');
    }
  };

  return (
    <div>
      <PageHeader
        title="Staff & Roles"
        subtitle="Manage user accounts, RBAC roles and system permissions"
        breadcrumbs={[{ label: 'Staff & Roles' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" leftIcon={<RefreshCw size={15} />} onClick={loadUsers}>
              Refresh
            </Button>
            <Button leftIcon={<Plus size={16} />} onClick={openAdd}>
              Add User
            </Button>
          </div>
        }
      />

      {/* Role summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {ROLES.map(role => (
          <div
            key={role.value}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm"
          >
            <RoleBadge role={role.value} />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">{role.desc}</p>
            <p className="text-lg font-bold text-slate-700 dark:text-slate-200 mt-2">
              {users.filter(u => u.role === role.value && u.status === 'active').length}
              <span className="text-sm font-normal text-slate-400 ml-1">active</span>
            </p>
          </div>
        ))}
      </div>

      {/* Users table */}
      <Card padding={false}>
        {isLoading ? (
          <div className="p-8 flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>Name</Th>
                <Th>Username</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Last Login</Th>
                <Th>Actions</Th>
              </tr>
            </Thead>
            <Tbody>
              {users.map(u => (
                <Tr key={u.id}>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-sm font-semibold text-green-700 dark:text-green-400 shrink-0">
                        {u.name?.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{u.name}</span>
                    </div>
                  </Td>
                  <Td className="font-mono text-xs text-slate-500">{u.username}</Td>
                  <Td className="text-slate-500">{u.email}</Td>
                  <Td><RoleBadge role={u.role} /></Td>
                  <Td><StatusBadge status={u.status} /></Td>
                  <Td className="text-slate-400 text-xs">{u.lastLogin}</Td>
                  <Td>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEdit(u)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                        aria-label="Edit user"
                        title="Edit user details"
                      >
                        <Edit size={15} />
                      </button>
                      {currentUser?.id !== u.id && (
                        <button
                          onClick={() => setToggleConfirm({ open: true, user: u })}
                          className={`p-1.5 rounded-lg transition-colors ${
                            u.status === 'active'
                              ? 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                              : 'text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                          }`}
                          aria-label={u.status === 'active' ? 'Disable user' : 'Enable user'}
                          title={u.status === 'active' ? 'Disable user' : 'Enable user'}
                        >
                          {u.status === 'active' ? <UserX size={15} /> : <UserCheck size={15} />}
                        </button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modal.open}
        onClose={() => setModal({ open: false, editing: null })}
        title={modal.editing ? `Edit User: ${modal.editing.name}` : 'Add New Staff User'}
        size="md"
      >
        <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 flex items-start gap-2">
          <Shield size={16} className="text-green-600 shrink-0 mt-0.5" />
          <p className="text-xs text-green-800 dark:text-green-300">
            <strong>RBAC Security:</strong> Passwords are automatically hashed with 12 rounds of bcrypt before being stored in MySQL.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <Input
            label="Full Name" id="uName" required
            value={form.name} onChange={e => set('name', e.target.value)}
            error={errors.name} placeholder="e.g. Dr. Ahmed Ali"
          />
          <Input
            label="Username" id="uUsername" required
            value={form.username} onChange={e => set('username', e.target.value)}
            error={errors.username} placeholder="e.g. ahmed"
            disabled={Boolean(modal.editing)}
            hint={modal.editing ? 'Username cannot be modified' : 'Unique login identifier'}
          />
          <Input
            label="Email Address" id="uEmail" type="email" required
            value={form.email} onChange={e => set('email', e.target.value)}
            error={errors.email} placeholder="user@pharmacare.pk"
            disabled={Boolean(modal.editing)}
            hint="Can also be used to log in"
          />
          <Select
            label="Role" id="uRole"
            value={form.role} onChange={e => set('role', e.target.value)}
          >
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
          <Input
            label={modal.editing ? 'New Password (blank = keep current)' : 'Password'}
            id="uPassword" type="password"
            required={!modal.editing}
            value={form.password} onChange={e => set('password', e.target.value)}
            error={errors.password} placeholder="Minimum 8 characters"
            hint="Hashed with bcrypt"
          />
          <Select
            label="Account Status" id="uStatus"
            value={form.status} onChange={e => set('status', e.target.value)}
          >
            <option value="active">Active (Permitted to Log In)</option>
            <option value="inactive">Inactive (Disabled / Blocked)</option>
          </Select>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setModal({ open: false, editing: null })}>
            Cancel
          </Button>
          <Button onClick={handleSave} isLoading={isSubmitting}>
            {modal.editing ? 'Save Changes' : 'Create User'}
          </Button>
        </div>
      </Modal>

      {/* Enable / Disable confirmation */}
      <ConfirmDialog
        isOpen={toggleConfirm.open}
        onClose={() => setToggleConfirm({ open: false, user: null })}
        onConfirm={handleToggle}
        title={toggleConfirm.user?.status === 'active' ? 'Disable User Account' : 'Enable User Account'}
        message={`Are you sure you want to ${toggleConfirm.user?.status === 'active' ? 'disable' : 'enable'} the account for ${toggleConfirm.user?.name}? ${toggleConfirm.user?.status === 'active' ? 'They will not be able to log in to the dashboard.' : 'They will be able to log in again.'}`}
        confirmLabel={toggleConfirm.user?.status === 'active' ? 'Disable' : 'Enable'}
        variant={toggleConfirm.user?.status === 'active' ? 'danger' : 'primary'}
      />
    </div>
  );
}

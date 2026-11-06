import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { AppLayout } from '../components/layout/AppLayout';
import { LoginPage } from '../pages/auth/LoginPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { MedicineListPage } from '../pages/medicines/MedicineListPage';
import { MedicineFormPage } from '../pages/medicines/MedicineFormPage';
import { CategoriesPage } from '../pages/medicines/CategoriesPage';
import { DosageFormsPage } from '../pages/medicines/DosageFormsPage';
import { InventoryPage } from '../pages/inventory/InventoryPage';
import { SuppliersPage } from '../pages/suppliers/SuppliersPage';
import { PurchasesPage } from '../pages/purchases/PurchasesPage';
import { POSPage } from '../pages/pos/POSPage';
import { SalesPage } from '../pages/sales/SalesPage';
import { CustomersPage } from '../pages/customers/CustomersPage';
import { PatientsPage } from '../pages/patients/PatientsPage';
import { DoctorsPage } from '../pages/doctors/DoctorsPage';
import { FinancePage } from '../pages/finance/FinancePage';
import { ReturnsPage } from '../pages/returns/ReturnsPage';
import { PrescriptionsPage } from '../pages/prescriptions/PrescriptionsPage';
import { ReportsPage } from '../pages/reports/ReportsPage';
import { UsersPage } from '../pages/users/UsersPage';
import { SettingsPage } from '../pages/settings/SettingsPage';
import { DoctorInquiryPage } from '../pages/inquiry/DoctorInquiryPage';
import { InquiriesPage } from '../pages/inquiries/InquiriesPage';

// Doctor Appointments & Queue Management Pages
import { BookAppointmentPage } from '../pages/appointments/BookAppointmentPage';
import { MyAppointmentsPage } from '../pages/appointments/MyAppointmentsPage';
import { QueueDisplayPage } from '../pages/appointments/QueueDisplayPage';
import { AppointmentsPage } from '../pages/appointments/AppointmentsPage';
import { QueuePage } from '../pages/appointments/QueuePage';
import { ReceptionPage } from '../pages/reception/ReceptionPage';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/book-appointment" element={<BookAppointmentPage />} />
        <Route path="/my-appointments" element={<MyAppointmentsPage />} />
        <Route path="/queue-display" element={<QueueDisplayPage />} />
        <Route path="/check-availability" element={<DoctorInquiryPage />} />
        <Route path="/inquiry" element={<DoctorInquiryPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/appointments" element={<AppointmentsPage />} />
            <Route path="/appointments/queue" element={<QueuePage />} />
            <Route path="/reception" element={<ReceptionPage />} />
            <Route path="/medicines" element={<MedicineListPage />} />
            <Route path="/medicines/new" element={<MedicineFormPage />} />
            <Route path="/medicines/:id/edit" element={<MedicineFormPage />} />
            <Route path="/medicines/categories" element={<CategoriesPage />} />
            <Route path="/medicines/dosage-forms" element={<DosageFormsPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/suppliers" element={<SuppliersPage />} />
            <Route path="/purchases" element={<PurchasesPage />} />
            <Route path="/pos" element={<POSPage />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/patients" element={<PatientsPage />} />
            <Route path="/doctors" element={<DoctorsPage />} />
            <Route path="/finance" element={<FinancePage />} />
            <Route path="/returns" element={<ReturnsPage />} />
            <Route path="/prescriptions" element={<ProtectedRoute roles={['admin','pharmacist']} />}>
              <Route index element={<PrescriptionsPage />} />
            </Route>
            <Route path="/inquiries" element={<ProtectedRoute roles={['admin','pharmacist']} />}>
              <Route index element={<InquiriesPage />} />
            </Route>
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/users" element={<ProtectedRoute roles={['admin']} />}>
              <Route index element={<UsersPage />} />
            </Route>
            <Route path="/settings" element={<ProtectedRoute roles={['admin']} />}>
              <Route index element={<SettingsPage />} />
            </Route>
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

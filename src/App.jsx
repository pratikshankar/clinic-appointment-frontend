/**
 * Route table.
 *
 * Paths follow Section 30. Role-specific trees are wrapped in RequireRole, and
 * the root redirects each user to the dashboard for their own role.
 */

import { Navigate, Route, Routes } from 'react-router-dom';

import DashboardLayout from './layouts/DashboardLayout';
import { RedirectIfAuthenticated, RequireAuth, RequireRole } from './routes/guards';
import { useAuth } from './context/AuthContext';
import { homeRouteFor, ROLES } from './config/navigation';

import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Clinics from './pages/Clinics';
import SuperadminDashboard from './pages/superadmin/Dashboard';
import Users from './pages/superadmin/Users';
import UserCreate from './pages/superadmin/UserCreate';
import ClinicCreate from './pages/superadmin/ClinicForm';
import ClinicDetail from './pages/superadmin/ClinicDetail';
import Settings from './pages/superadmin/Settings';
import PatientList from './pages/patients/PatientList';
import PatientForm from './pages/patients/PatientForm';
import PatientProfile from './pages/patients/PatientProfile';
import AppointmentList from './pages/appointments/AppointmentList';
import BookAppointment from './pages/appointments/BookAppointment';
import SessionList from './pages/sessions/SessionList';
import AdminDashboard from './pages/admin/Dashboard';
import ClinicDashboard from './pages/clinic/Dashboard';
import Notifications from './pages/Notifications';
import Billing from './pages/Billing';
import Reports from './pages/Reports';
import AuditLog from './pages/AuditLog';
import { NotFound } from './pages/NotFound';

/** Sends a signed-in user to their own dashboard. */
function HomeRedirect() {
  const { role } = useAuth();
  return <Navigate to={homeRouteFor(role)} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuthenticated>
            <Login />
          </RedirectIfAuthenticated>
        }
      />

      <Route element={<RequireAuth />}>
        <Route element={<DashboardLayout />}>
          <Route index element={<HomeRedirect />} />
          <Route path="/account/password" element={<ChangePassword />} />

          {/* --- Superadmin --- */}
          <Route element={<RequireRole roles={[ROLES.SUPERADMIN]} />}>
            <Route path="/superadmin/dashboard" element={<SuperadminDashboard />} />
            <Route path="/superadmin/clinics" element={<Clinics />} />
            {/* "new" precedes ":clinicId" so it is not read as an id. */}
            <Route path="/superadmin/clinics/new" element={<ClinicCreate />} />
            <Route path="/superadmin/clinics/:clinicId" element={<ClinicDetail />} />
            <Route path="/superadmin/users" element={<Users />} />
            <Route path="/superadmin/users/create" element={<UserCreate />} />
            <Route path="/superadmin/patients" element={<PatientList />} />
            <Route path="/superadmin/patients/new" element={<PatientForm />} />
            <Route path="/superadmin/patients/:patientId" element={<PatientProfile />} />
            <Route path="/superadmin/patients/:patientId/edit" element={<PatientForm />} />
            <Route path="/superadmin/appointments" element={<AppointmentList />} />
            <Route path="/superadmin/appointments/new" element={<BookAppointment />} />
            <Route path="/superadmin/sessions" element={<SessionList />} />
            <Route path="/superadmin/settings" element={<Settings />} />
            <Route path="/superadmin/notifications" element={<Notifications />} />
            <Route path="/superadmin/billing" element={<Billing />} />
            <Route path="/superadmin/audit" element={<AuditLog />} />
            <Route path="/superadmin/reports" element={<Reports />} />
          </Route>

          {/* --- Admin --- */}
          <Route element={<RequireRole roles={[ROLES.ADMIN]} />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/clinics" element={<Clinics />} />
            <Route path="/admin/clinics/:clinicId" element={<ClinicDetail />} />
            <Route path="/admin/appointments" element={<AppointmentList />} />
            <Route path="/admin/appointments/new" element={<BookAppointment />} />
            <Route path="/admin/sessions" element={<SessionList />} />
            <Route path="/admin/patients" element={<PatientList />} />
            <Route path="/admin/patients/new" element={<PatientForm />} />
            <Route path="/admin/patients/:patientId" element={<PatientProfile />} />
            <Route path="/admin/patients/:patientId/edit" element={<PatientForm />} />
            <Route path="/admin/notifications" element={<Notifications />} />
            <Route path="/admin/billing" element={<Billing />} />
            <Route path="/admin/reports" element={<Reports />} />
          </Route>

          {/* --- Clinic User --- */}
          <Route element={<RequireRole roles={[ROLES.CLINIC_USER]} />}>
            <Route path="/clinic/dashboard" element={<ClinicDashboard />} />
            <Route path="/clinic/appointments" element={<AppointmentList />} />
            <Route path="/clinic/appointments/new" element={<BookAppointment />} />
            <Route path="/clinic/patients" element={<PatientList />} />
            <Route path="/clinic/patients/new" element={<PatientForm />} />
            <Route path="/clinic/patients/:patientId" element={<PatientProfile />} />
            <Route path="/clinic/patients/:patientId/edit" element={<PatientForm />} />
            <Route path="/clinic/sessions" element={<SessionList />} />
            <Route path="/clinic/notifications" element={<Notifications />} />
            <Route path="/clinic/billing" element={<Billing />} />
            <Route path="/clinic/reports" element={<Reports />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

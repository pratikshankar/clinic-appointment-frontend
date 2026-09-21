/**
 * Role-based navigation and route landing pages.
 *
 * `phase` marks items whose backend endpoints arrive in a later phase. They are
 * rendered as visibly disabled rather than hidden, so the plan is legible and
 * nothing looks clickable-but-broken.
 */

export const ROLES = {
  SUPERADMIN: 'SUPERADMIN',
  ADMIN: 'ADMIN',
  CLINIC_USER: 'CLINIC_USER',
};

export const ROLE_LABELS = {
  SUPERADMIN: 'Superadmin',
  ADMIN: 'Admin',
  CLINIC_USER: 'Clinic User',
};

export const HOME_ROUTE = {
  SUPERADMIN: '/superadmin/dashboard',
  ADMIN: '/admin/dashboard',
  CLINIC_USER: '/clinic/dashboard',
};

const NAVIGATION = {
  SUPERADMIN: [
    { label: 'Dashboard', to: '/superadmin/dashboard', icon: 'grid' },
    { label: 'Clinics', to: '/superadmin/clinics', icon: 'building' },
    { label: 'Users', to: '/superadmin/users', icon: 'users' },
    { label: 'Appointments', to: '/superadmin/appointments', icon: 'calendar' },
    { label: 'Sessions', to: '/superadmin/sessions', icon: 'activity' },
    { label: 'Settings', to: '/superadmin/settings', icon: 'sliders' },
    { label: 'Notifications', to: '/superadmin/notifications', icon: 'bell' },
    { label: 'Billing', to: '/superadmin/billing', icon: 'receipt' },
    { label: 'Reports', to: '/superadmin/reports', icon: 'activity' },
    { label: 'Patients', to: '/superadmin/patients', icon: 'user' },
    { label: 'Audit log', to: '/superadmin/audit', icon: 'list' },
  ],
  ADMIN: [
    { label: 'Dashboard', to: '/admin/dashboard', icon: 'grid' },
    { label: 'Clinics', to: '/admin/clinics', icon: 'building' },
    { label: 'Appointments', to: '/admin/appointments', icon: 'calendar' },
    { label: 'Patients', to: '/admin/patients', icon: 'user' },
    { label: 'Sessions', to: '/admin/sessions', icon: 'activity' },
    { label: 'Notifications', to: '/admin/notifications', icon: 'bell' },
    { label: 'Billing', to: '/admin/billing', icon: 'receipt' },
    { label: 'Reports', to: '/admin/reports', icon: 'activity' },
  ],
  CLINIC_USER: [
    { label: 'Dashboard', to: '/clinic/dashboard', icon: 'grid' },
    { label: 'Appointments', to: '/clinic/appointments', icon: 'calendar' },
    { label: 'Patients', to: '/clinic/patients', icon: 'user' },
    { label: 'Sessions', to: '/clinic/sessions', icon: 'activity' },
    { label: 'Notifications', to: '/clinic/notifications', icon: 'bell', badge: 'notifications' },
    { label: 'Billing', to: '/clinic/billing', icon: 'receipt' },
    { label: 'Reports', to: '/clinic/reports', icon: 'activity' },
  ],
};

export function navigationFor(role) {
  return NAVIGATION[role] ?? [];
}

export function homeRouteFor(role) {
  return HOME_ROUTE[role] ?? '/login';
}

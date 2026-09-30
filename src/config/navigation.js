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
    { label: "Today's Activity", to: '/superadmin/today', icon: 'sun' },
    { label: 'Clinics', to: '/superadmin/clinics', icon: 'building' },
    { label: 'Users', to: '/superadmin/users', icon: 'users' },
    { label: 'Appointments', to: '/superadmin/appointments', icon: 'calendar' },
    { label: 'Sessions', to: '/superadmin/sessions', icon: 'activity' },
    { label: 'Settings', to: '/superadmin/settings', icon: 'sliders' },
    { label: 'Notifications', to: '/superadmin/notifications', icon: 'bell' },
    { label: 'Billing', to: '/superadmin/billing', icon: 'receipt' },
    { label: 'Refunds', to: '/superadmin/refunds', icon: 'refresh' },
    { label: 'Referrals', to: '/superadmin/referrals', icon: 'users' },
    { label: 'Reports', to: '/superadmin/reports', icon: 'activity' },
    { label: 'Patients', to: '/superadmin/patients', icon: 'user' },
    { label: 'Audit log', to: '/superadmin/audit', icon: 'list' },
  ],
  ADMIN: [
    { label: 'Dashboard', to: '/admin/dashboard', icon: 'grid' },
    { label: "Today's Activity", to: '/admin/today', icon: 'sun' },
    { label: 'Clinics', to: '/admin/clinics', icon: 'building' },
    { label: 'Appointments', to: '/admin/appointments', icon: 'calendar' },
    { label: 'Patients', to: '/admin/patients', icon: 'user' },
    { label: 'Sessions', to: '/admin/sessions', icon: 'activity' },
    { label: 'Notifications', to: '/admin/notifications', icon: 'bell' },
    { label: 'Billing', to: '/admin/billing', icon: 'receipt' },
    { label: 'Refunds', to: '/admin/refunds', icon: 'refresh' },
    { label: 'Referrals', to: '/admin/referrals', icon: 'users' },
    { label: 'Reports', to: '/admin/reports', icon: 'activity' },
    { label: 'Audit log', to: '/admin/audit', icon: 'list' },
  ],
  CLINIC_USER: [
    { label: 'Dashboard', to: '/clinic/dashboard', icon: 'grid' },
    { label: 'Appointments', to: '/clinic/appointments', icon: 'calendar' },
    { label: 'Patients', to: '/clinic/patients', icon: 'user' },
    { label: 'Sessions', to: '/clinic/sessions', icon: 'activity' },
    { label: 'Notifications', to: '/clinic/notifications', icon: 'bell', badge: 'notifications' },
    { label: 'Billing', to: '/clinic/billing', icon: 'receipt' },
    { label: 'Refunds', to: '/clinic/refunds', icon: 'refresh' },
    { label: 'Referrals', to: '/clinic/referrals', icon: 'users' },
  ],
};

// First 4-5 items shown in the mobile bottom tab bar.
// The last tab is always "More" (opens the sidebar drawer) for roles with
// more items than fit; for CLINIC_USER all 5 fit directly.
const PRIMARY_TABS = {
  SUPERADMIN: [
    { label: 'Home', to: '/superadmin/dashboard', icon: 'grid' },
    { label: 'Appts', to: '/superadmin/appointments', icon: 'calendar' },
    { label: 'Patients', to: '/superadmin/patients', icon: 'user' },
    { label: 'Billing', to: '/superadmin/billing', icon: 'receipt' },
  ],
  ADMIN: [
    { label: 'Home', to: '/admin/dashboard', icon: 'grid' },
    { label: 'Appts', to: '/admin/appointments', icon: 'calendar' },
    { label: 'Patients', to: '/admin/patients', icon: 'user' },
    { label: 'Billing', to: '/admin/billing', icon: 'receipt' },
  ],
  CLINIC_USER: [
    { label: 'Home', to: '/clinic/dashboard', icon: 'grid' },
    { label: 'Appts', to: '/clinic/appointments', icon: 'calendar' },
    { label: 'Patients', to: '/clinic/patients', icon: 'user' },
    { label: 'Billing', to: '/clinic/billing', icon: 'receipt' },
    { label: 'Alerts', to: '/clinic/notifications', icon: 'bell', badge: 'notifications' },
  ],
};

export function primaryTabsFor(role) {
  return PRIMARY_TABS[role] ?? [];
}

export function navigationFor(role) {
  return NAVIGATION[role] ?? [];
}

export function homeRouteFor(role) {
  return HOME_ROUTE[role] ?? '/login';
}

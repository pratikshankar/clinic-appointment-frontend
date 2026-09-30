/**
 * Shell for every authenticated page: sidebar (desktop), bottom tab bar
 * (mobile), top bar and content outlet.
 *
 * Desktop (lg+): fixed left sidebar, full nav.
 * Mobile (<lg):  bottom tab bar with 4-5 primary items + "More" tab that
 *               opens the sidebar as a slide-in drawer.
 */

import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { Icon } from '../components/Icon';
import { NotificationToast } from '../components/notification/NotificationToast';
import { Badge, RoleBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { notificationService } from '../services';
import { navigationFor, homeRouteFor, primaryTabsFor } from '../config/navigation';
import { initialsOf } from '../utils/format';

function SidebarLink({ item, onNavigate, unread = 0 }) {
  if (item.phase) {
    return (
      <span
        title={`Arrives in Phase ${item.phase}`}
        className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-400"
      >
        <Icon name={item.icon} className="size-4.5" />
        <span className="flex-1">{item.label}</span>
        <Badge tone="neutral" className="text-[10px]">
          P{item.phase}
        </Badge>
      </span>
    );
  }

  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200'
            : 'text-ink-700 hover:bg-ink-100',
        ].join(' ')
      }
    >
      <Icon name={item.icon} className="size-4.5" />
      <span className="flex-1">{item.label}</span>
      {unread > 0 && (
        <span
          className="grid min-w-5 place-items-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white"
          aria-label={`${unread} unacknowledged`}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </NavLink>
  );
}

function BottomTabItem({ item, onNavigate, unread = 0, isMore = false, moreOpen = false }) {
  if (isMore) {
    return (
      <button
        type="button"
        onClick={onNavigate}
        className={[
          'flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
          moreOpen ? 'text-brand-700' : 'text-ink-500',
        ].join(' ')}
        aria-label="More navigation"
      >
        <Icon name="menu" className="size-5" />
        <span>More</span>
      </button>
    );
  }

  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          'relative flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
          isActive ? 'text-brand-700' : 'text-ink-500',
        ].join(' ')
      }
    >
      <div className="relative">
        <Icon name={item.icon} className="size-5" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-[14px] place-items-center rounded-full bg-red-600 px-0.5 text-[9px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </div>
      <span>{item.label}</span>
    </NavLink>
  );
}

export default function DashboardLayout() {
  const { user, role, logout, clinics } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const items = navigationFor(role);
  const primaryTabs = primaryTabsFor(role);
  // CLINIC_USER has 5 items that all fit; other roles show a "More" tab.
  const showMoreTab = role !== 'CLINIC_USER';

  const location = useLocation();
  const {
    unread,
    latest,
    alertsEnabled,
    soundBlocked,
    alarmActive,
    desktopPermission,
    unlockSound,
    silence,
    enableDesktop,
    refresh,
  } = useNotifications({ enabled: role === 'CLINIC_USER' });

  const showToast = alertsEnabled && !location.pathname.endsWith('/notifications');
  const clinicLabel =
    role === 'CLINIC_USER'
      ? (clinics[0]?.clinic_name ?? 'No clinic assigned')
      : 'All clinics';

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar — desktop: always visible; mobile: slide-in drawer */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-ink-200 bg-white',
          'transition-transform lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-ink-100 px-5">
          <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            C
          </span>
          <div className="leading-tight">
            <Link to={homeRouteFor(role)} className="text-sm font-semibold text-ink-900">
              Clinic Manager
            </Link>
            <p className="text-[11px] text-ink-500">Physiotherapy chain</p>
          </div>
        </div>

        <nav className="space-y-1 p-3">
          {items.map((item) => (
            <SidebarLink
              key={item.label}
              item={item}
              unread={item.badge === 'notifications' ? unread : 0}
              onNavigate={() => setSidebarOpen(false)}
            />
          ))}
        </nav>

        <div className="mx-3 mt-2 rounded-lg bg-ink-50 px-3 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-500">Scope</p>
          <p className="mt-0.5 text-xs text-ink-700">{clinicLabel}</p>
        </div>
      </aside>

      {/* Backdrop — mobile only, closes the sidebar drawer */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink-950/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-ink-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          {/* Hamburger — visible on mobile when sidebar drawer is needed via header too */}
          <button
            type="button"
            className="rounded-lg p-2 text-ink-600 hover:bg-ink-100 lg:hidden"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label="Toggle navigation"
          >
            <Icon name={sidebarOpen ? 'close' : 'menu'} />
          </button>

          <div className="flex-1" />

          {alertsEnabled && soundBlocked && (
            <button
              type="button"
              onClick={unlockSound}
              title="This browser is blocking notification sounds"
              className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900 ring-1 ring-inset ring-amber-200 hover:bg-amber-100"
            >
              <Icon name="bell" className="size-4" />
              Enable sound
            </button>
          )}

          {alertsEnabled && desktopPermission === 'default' && (
            <button
              type="button"
              onClick={enableDesktop}
              title="Also alert me when this tab is not in front"
              className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-600 ring-1 ring-inset ring-ink-300 hover:bg-ink-100 sm:flex"
            >
              <Icon name="bell" className="size-4" />
              Desktop alerts
            </button>
          )}

          {alarmActive && (
            <button
              type="button"
              onClick={silence}
              title="Stop the sound for now; it returns on the next new notification"
              className="flex animate-pulse items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              <Icon name="bell" className="size-4" />
              Silence
            </button>
          )}

          <Link
            to="/account/password"
            className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-100 sm:flex"
          >
            <Icon name="lock" className="size-4" />
            Change password
          </Link>

          <div className="flex items-center gap-2.5 border-l border-ink-200 pl-3">
            <span className="grid size-8 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">
              {initialsOf(user?.full_name)}
            </span>
            <div className="hidden leading-tight sm:block">
              <p className="text-xs font-semibold text-ink-900">{user?.full_name}</p>
              <p className="text-[11px] text-ink-500">{user?.username}</p>
            </div>
            <RoleBadge role={role} />
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-red-600"
            aria-label="Sign out"
            title="Sign out"
          >
            <Icon name="logout" />
          </button>
        </header>

        {/* pb-20 on mobile so content is not hidden behind the bottom tab bar */}
        <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-6">
          <Outlet />
        </main>

        {showToast && (
          <NotificationToast
            unread={unread}
            latest={latest}
            alarmActive={alarmActive}
            soundBlocked={soundBlocked}
            to={`${homeRouteFor(role).replace('/dashboard', '')}/notifications`}
            onSilence={silence}
            onEnableSound={unlockSound}
            onAcknowledgeAll={async () => {
              await notificationService.acknowledgeAll();
              await refresh();
            }}
          />
        )}
      </div>

      {/* Bottom tab bar — mobile only */}
      <nav
        aria-label="Primary navigation"
        className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-ink-200 bg-white/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {primaryTabs.map((tab) => (
          <BottomTabItem
            key={tab.to}
            item={tab}
            unread={tab.badge === 'notifications' ? unread : 0}
            onNavigate={() => setSidebarOpen(false)}
          />
        ))}
        {showMoreTab && (
          <BottomTabItem
            isMore
            moreOpen={sidebarOpen}
            onNavigate={() => setSidebarOpen((open) => !open)}
          />
        )}
      </nav>
    </div>
  );
}

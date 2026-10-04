'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { ClinicProvider, isOwner, locationHref, postJson, useClinic } from './clinic-context';
import { Badge, ErrorBanner, Icon, friendlyDate } from './ui';

function Shell({ children }: { children: ReactNode }) {
  const { data, loading, error, refresh, mutate, locationId, selectLocation, captureBusy } =
    useClinic();
  const pathname = usePathname();
  const [showNotifications, setShowNotifications] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [today, setToday] = useState('Today');
  useEffect(
    () =>
      setToday(
        new Date().toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }),
      ),
    [],
  );
  const owner = data ? isOwner(data.user.role) : false;
  const links = [
    { href: '/dashboard', label: 'Consultations', icon: 'grid' },
    ...(owner
      ? [
          { href: '/setup', label: 'Clinic setup', icon: 'spark' },
          { href: '/owner', label: 'Insights & review', icon: 'chart' },
        ]
      : []),
    { href: '/settings', label: 'Settings', icon: 'settings' },
  ];
  const unread = data?.notifications.filter((item) => !item.isRead && !item.readAt).length ?? 0;
  function guardNavigation(event: { preventDefault: () => void }) {
    if (!captureBusy) return false;
    event.preventDefault();
    setMenuOpen(false);
    setShowNotifications(false);
    setLogoutError('Stop recording and finish or retry unsaved audio before leaving this page.');
    return true;
  }
  async function logout() {
    if (captureBusy) {
      setLogoutError('Save or deliberately discard unsaved recording segments before signing out.');
      return;
    }
    try {
      await postJson('/api/auth/logout', {});
      window.location.assign('/');
    } catch (cause) {
      setLogoutError(cause instanceof Error ? cause.message : 'Unable to sign out.');
    }
  }
  return (
    <div className="workspace">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <Link className="wordmark" href="/dashboard" onClick={guardNavigation}>
          <span className="brand-symbol">
            <Icon name="pulse" size={22} />
          </span>
          dripwell<span className="wordmark-period">.</span>
        </Link>
        <div className="clinic-switch">
          <span className="clinic-avatar">{data?.clinic.name.slice(0, 1) || 'D'}</span>
          <div>
            <strong>{data?.clinic.name || 'Your clinic'}</strong>
            <span>Clinic workspace</span>
          </div>
          <Badge tone="teal">{owner ? 'Owner' : 'Team'}</Badge>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {links.map((link) => (
            <Link
              key={link.href}
              href={locationHref(link.href, locationId)}
              className={`nav-link ${pathname.startsWith(link.href) ? 'active' : ''}`}
              onClick={(event) => {
                if (!guardNavigation(event)) setMenuOpen(false);
              }}
            >
              <Icon name={link.icon} />
              {link.label}
              {link.href === '/dashboard' ? (
                <span className="nav-count">
                  {data?.consultations.filter((c) => !c.archivedAt && !c.isTest).length ?? 0}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="calm-card">
            <Icon name="shield" />
            <strong>Care, with confidence.</strong>
            <p>
              Your clinic&apos;s protocols. Your team&apos;s judgment. Every recommendation
              reviewed.
            </p>
          </div>
          <div className="profile">
            <span className="person-avatar">
              {data?.user.name.split(' ')[0]?.slice(0, 1) || ''}
              {data?.user.name.split(' ').at(-1)?.slice(0, 1) || ''}
            </span>
            <div>
              <strong>{data ? data.user.name : 'Loading profile'}</strong>
              <span>{owner ? 'Clinic owner' : 'Clinic team'}</span>
            </div>
            <button className="icon-button" aria-label="Sign out" onClick={() => void logout()}>
              <Icon name="exit" size={18} />
            </button>
          </div>
          {logoutError ? <p className="error-text">{logoutError}</p> : null}
        </div>
      </aside>
      {menuOpen ? (
        <button
          className="sidebar-scrim"
          onClick={(event) => {
            if (captureBusy) {
              event.preventDefault();
              setLogoutError(
                'Stop recording and finish or retry unsaved audio before leaving this page.',
              );
            } else setMenuOpen(false);
          }}
          aria-label="Close menu"
        />
      ) : null}
      <div className="main-workspace">
        <header className="topbar">
          <div className="topbar-location">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Open menu"
            >
              <Icon name="grid" />
            </button>
            <span className="location-dot" />
            {data && data.locations.length > 1 ? (
              <select
                className="location-select"
                aria-label="Clinic location"
                disabled={captureBusy}
                value={locationId}
                onChange={(event) => void selectLocation(event.target.value)}
              >
                {data.locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            ) : (
              data?.locations[0]?.name || 'Clinic workspace'
            )}
            <span className="topbar-divider" />
            <span className="muted">{today}</span>
          </div>
          <div className="topbar-actions">
            <span className="private-label">
              <Icon name="shield" size={14} />
              Private workspace
            </span>
            <button
              className="icon-button notification-button"
              aria-label={`Notifications, ${unread} unread`}
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Icon name="bell" />
              {unread ? <span className="notification-dot" /> : null}
            </button>
          </div>
        </header>
        {showNotifications ? (
          <div className="notification-panel">
            <div className="section-heading">
              <h3>Reminders</h3>
              <button
                className="icon-button"
                aria-label="Close reminders"
                onClick={() => setShowNotifications(false)}
              >
                <Icon name="close" />
              </button>
            </div>
            {data?.notifications.length ? (
              data.notifications.map((item) => (
                <div
                  className={`notification-row ${item.isRead || item.readAt ? 'read' : ''}`}
                  key={item.id}
                >
                  <Icon name="clock" />
                  <div>
                    <strong>
                      {item.title ||
                        (item.type.includes('CARE')
                          ? 'Record care outcome'
                          : 'Record wellness decision')}
                    </strong>
                    <p>{item.message || 'An outstanding visit needs an update.'}</p>
                    {item.consultationId ? (
                      <Link
                        href={locationHref(`/consultations/${item.consultationId}`, locationId)}
                        onClick={guardNavigation}
                      >
                        Open consultation
                      </Link>
                    ) : null}
                    <span className="small muted">{friendlyDate(item.createdAt)}</span>
                  </div>
                  {!item.isRead && !item.readAt ? (
                    <button
                      className="icon-button"
                      aria-label="Mark reminder read"
                      onClick={() =>
                        void mutate('notification.read', { notificationId: item.id }).catch(
                          (cause) =>
                            setLogoutError(
                              cause instanceof Error ? cause.message : 'Unable to update reminder.',
                            ),
                        )
                      }
                    >
                      <Icon name="check" />
                    </button>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="muted">
                You&apos;re up to date. Outstanding outcomes will appear here.
              </p>
            )}
          </div>
        ) : null}
        <main className="page-content">
          {logoutError ? <ErrorBanner message={logoutError} /> : null}
          {loading && !data ? (
            <div className="loading-state" role="status">
              <div className="loading-ring" />
              Opening your workspace…
            </div>
          ) : error ? (
            <ErrorBanner message={error} retry={() => void refresh()} />
          ) : (
            children
          )}
        </main>
        <footer className="workspace-footer">
          DripWell <span>Thoughtful consultations. Better follow-through.</span>
        </footer>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ClinicProvider>
      <Shell>{children}</Shell>
    </ClinicProvider>
  );
}

import { setToken } from '../lib/api.js';
import { setUser, getUser, isVendor } from '../lib/auth.js';
import { get, put } from '../lib/api.js';

const ADMIN_NAV = [
  { hash: '#dashboard', label: 'Dashboard', icon: '\u25A1' },
  { hash: '#catalog', label: 'Catalog', icon: '\u25C8' },
  { hash: '#providers', label: 'Providers', icon: '\u25CE' },
  { hash: '#settings', label: 'Settings', icon: '\u2699' },
  { hash: '#audit', label: 'Audit Log', icon: '\u25A4' },
];

const VENDOR_NAV = [
  { hash: '#vendor-dashboard', label: 'Clinics', icon: '\u25A1' },
  { hash: '#vendor-patterns', label: 'Patterns', icon: '\u25C8' },
  { hash: '#vendor-audit', label: 'Audit Log', icon: '\u25A4' },
  { hash: '#vendor-health', label: 'Health', icon: '\u2699' },
];

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

function renderNotificationBell(container: HTMLElement): () => void {
  const wrapper = document.createElement('div');
  wrapper.className = 'admin-notify-wrapper';

  const btn = document.createElement('button');
  btn.className = 'admin-notify-btn';
  btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`;

  const badge = document.createElement('span');
  badge.className = 'admin-notify-badge';
  badge.style.display = 'none';
  btn.appendChild(badge);

  const dropdown = document.createElement('div');
  dropdown.className = 'admin-notify-dropdown';
  dropdown.style.display = 'none';

  wrapper.appendChild(btn);
  wrapper.appendChild(dropdown);
  container.appendChild(wrapper);

  let isOpen = false;

  async function loadUnreadCount() {
    try {
      const res = await get<{ unreadCount: number }>('/admin/notifications?limit=1');
      badge.textContent = String(res.unreadCount);
      badge.style.display = res.unreadCount > 0 ? 'flex' : 'none';
    } catch {
      // ignore
    }
  }

  async function loadNotifications() {
    try {
      const res = await get<{ notifications: NotificationItem[]; unreadCount: number }>('/admin/notifications?limit=20');
      renderDropdown(res.notifications, res.unreadCount);
    } catch {
      dropdown.innerHTML = '<div class="admin-notify-empty">Failed to load</div>';
    }
  }

  function renderDropdown(notifications: NotificationItem[], unreadCount: number) {
    dropdown.innerHTML = '';

    const headerRow = document.createElement('div');
    headerRow.className = 'admin-notify-header';

    const title = document.createElement('span');
    title.textContent = 'Notifications';
    headerRow.appendChild(title);

    if (unreadCount > 0) {
      const markAll = document.createElement('button');
      markAll.textContent = 'Mark all read';
      markAll.addEventListener('click', async () => {
        await put('/admin/notifications/read-all', {});
        await loadNotifications();
        await loadUnreadCount();
      });
      headerRow.appendChild(markAll);
    }

    dropdown.appendChild(headerRow);

    if (notifications.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'admin-notify-empty';
      empty.textContent = 'No notifications';
      dropdown.appendChild(empty);
      return;
    }

    const list = document.createElement('div');
    list.className = 'admin-notify-list';

    for (const n of notifications) {
      const item = document.createElement('div');
      item.className = 'admin-notify-item' + (n.isRead ? '' : ' unread');
      item.innerHTML = `
        <div class="admin-notify-item-title">${n.title}</div>
        <div class="admin-notify-item-msg">${n.message}</div>
        <div class="admin-notify-item-meta">${formatTime(n.createdAt)}</div>
      `;

      if (!n.isRead) {
        const markRead = document.createElement('button');
        markRead.className = 'admin-notify-item-action';
        markRead.textContent = 'Mark read';
        markRead.addEventListener('click', async (e) => {
          e.stopPropagation();
          await put(`/admin/notifications/${n.id}/read`, {});
          await loadNotifications();
          await loadUnreadCount();
        });
        item.appendChild(markRead);
      }

      list.appendChild(item);
    }

    dropdown.appendChild(list);
  }

  function formatTime(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function toggle() {
    isOpen = !isOpen;
    dropdown.style.display = isOpen ? 'block' : 'none';
    if (isOpen) {
      loadNotifications();
    }
  }

  function close(e: MouseEvent) {
    if (!wrapper.contains(e.target as Node)) {
      isOpen = false;
      dropdown.style.display = 'none';
    }
  }

  btn.addEventListener('click', toggle);
  document.addEventListener('click', close);

  loadUnreadCount();
  const interval = setInterval(loadUnreadCount, 30000);

  return () => {
    clearInterval(interval);
    document.removeEventListener('click', close);
    wrapper.remove();
  };
}

export function renderLayout(container: HTMLElement, content: HTMLElement): () => void {
  container.innerHTML = '';
  container.className = 'admin-layout';

  const sidebar = document.createElement('aside');
  sidebar.className = 'admin-sidebar';

  const brand = document.createElement('div');
  brand.className = 'admin-sidebar-brand';
  const vendorMode = isVendor();
  brand.innerHTML = vendorMode
    ? 'DripWell<span>Vendor Panel</span>'
    : 'DripWell<span>Admin Panel</span>';
  sidebar.appendChild(brand);

  const nav = document.createElement('nav');
  nav.className = 'admin-sidebar-nav';

  const navItems = vendorMode ? VENDOR_NAV : ADMIN_NAV;
  const currentHash = window.location.hash || (vendorMode ? '#vendor-dashboard' : '#dashboard');

  for (const item of navItems) {
    const link = document.createElement('a');
    link.href = item.hash;
    link.textContent = item.label;
    link.innerHTML = `${item.icon} ${item.label}`;
    if (currentHash === item.hash || (currentHash === '' && item.hash === (vendorMode ? '#vendor-dashboard' : '#dashboard'))) {
      link.className = 'active';
    }
    link.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = item.hash;
    });
    nav.appendChild(link);
  }
  sidebar.appendChild(nav);

  const footer = document.createElement('div');
  footer.className = 'admin-sidebar-footer';

  const user = getUser();
  if (user) {
    const name = document.createElement('div');
    name.textContent = `${user.firstName} ${user.lastName}`;
    footer.appendChild(name);

    const email = document.createElement('div');
    email.textContent = user.email;
    email.style.fontSize = '11px';
    email.style.opacity = '0.7';
    footer.appendChild(email);
  }

  const logoutBtn = document.createElement('button');
  logoutBtn.textContent = 'Log out';
  logoutBtn.addEventListener('click', () => {
    setToken(null);
    setUser(null);
    window.location.hash = '#login';
  });
  footer.appendChild(logoutBtn);
  sidebar.appendChild(footer);

  const main = document.createElement('div');
  main.className = 'admin-main';

  const header = document.createElement('div');
  header.className = 'admin-header';

  const pageTitle = document.createElement('h1');
  pageTitle.id = 'page-title';
  pageTitle.textContent = 'Dashboard';
  header.appendChild(pageTitle);

  const headerRight = document.createElement('div');
  headerRight.className = 'admin-header-right';

  const userInfo = document.createElement('div');
  userInfo.className = 'admin-header-user';
  userInfo.textContent = user ? `${user.firstName} ${user.lastName}` : '';
  headerRight.appendChild(userInfo);

  const notifyCleanup = renderNotificationBell(headerRight);
  header.appendChild(headerRight);

  const contentWrap = document.createElement('div');
  contentWrap.className = 'admin-content';
  contentWrap.appendChild(content);

  main.appendChild(header);
  main.appendChild(contentWrap);

  container.appendChild(sidebar);
  container.appendChild(main);

  return () => {
    notifyCleanup();
    container.innerHTML = '';
  };
}

export function setPageTitle(title: string) {
  const el = document.getElementById('page-title');
  if (el) el.textContent = title;
  document.title = `${title} \u2014 DripWell ${isVendor() ? 'Vendor' : 'Admin'}`;
}

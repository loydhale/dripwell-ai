import { setToken } from '../lib/api.js';
import { setUser, getUser } from '../lib/auth.js';

const NAV_ITEMS = [
  { hash: '#dashboard', label: 'Dashboard', icon: '□' },
  { hash: '#catalog', label: 'Catalog', icon: '◈' },
  { hash: '#providers', label: 'Providers', icon: '◎' },
  { hash: '#settings', label: 'Settings', icon: '⚙' },
  { hash: '#analytics', label: 'Analytics', icon: '◧' },
  { hash: '#audit', label: 'Audit Log', icon: '▤' },
];

export function renderLayout(container: HTMLElement, content: HTMLElement): () => void {
  container.innerHTML = '';
  container.className = 'admin-layout';

  const sidebar = document.createElement('aside');
  sidebar.className = 'admin-sidebar';

  const brand = document.createElement('div');
  brand.className = 'admin-sidebar-brand';
  brand.innerHTML = 'DripWell<span>Admin Panel</span>';
  sidebar.appendChild(brand);

  const nav = document.createElement('nav');
  nav.className = 'admin-sidebar-nav';

  const currentHash = window.location.hash || '#dashboard';

  for (const item of NAV_ITEMS) {
    const link = document.createElement('a');
    link.href = item.hash;
    link.textContent = item.label;
    link.innerHTML = `${item.icon} ${item.label}`;
    if (currentHash === item.hash || (currentHash === '' && item.hash === '#dashboard')) {
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

  const userInfo = document.createElement('div');
  userInfo.className = 'admin-header-user';
  userInfo.textContent = user ? `${user.firstName} ${user.lastName}` : '';
  header.appendChild(userInfo);

  const contentWrap = document.createElement('div');
  contentWrap.className = 'admin-content';
  contentWrap.appendChild(content);

  main.appendChild(header);
  main.appendChild(contentWrap);

  container.appendChild(sidebar);
  container.appendChild(main);

  return () => {
    container.innerHTML = '';
  };
}

export function setPageTitle(title: string) {
  const el = document.getElementById('page-title');
  if (el) el.textContent = title;
  document.title = `${title} — DripWell Admin`;
}

import { post, setToken } from '../lib/api.js';
import { setUser } from '../lib/auth.js';

export function renderLogin(container: HTMLElement): () => void {
  container.innerHTML = '';
  container.className = 'admin-login-root';

  const card = document.createElement('div');
  card.className = 'admin-login-card';

  const title = document.createElement('h1');
  title.textContent = 'DripWell Admin';
  card.appendChild(title);

  const subtitle = document.createElement('p');
  subtitle.textContent = 'Log in to manage your clinic or platform';
  card.appendChild(subtitle);

  const errorBox = document.createElement('div');
  errorBox.className = 'admin-login-error';
  errorBox.style.display = 'none';
  card.appendChild(errorBox);

  const emailRow = document.createElement('div');
  emailRow.className = 'admin-form-row';
  emailRow.innerHTML = `
    <label for="login-email">Email</label>
    <input type="email" id="login-email" placeholder="you@clinic.com" />
  `;
  card.appendChild(emailRow);

  const passwordRow = document.createElement('div');
  passwordRow.className = 'admin-form-row';
  passwordRow.innerHTML = `
    <label for="login-password">Password</label>
    <input type="password" id="login-password" placeholder="••••••••" />
  `;
  card.appendChild(passwordRow);

  const submitBtn = document.createElement('button');
  submitBtn.className = 'admin-btn admin-btn-primary';
  submitBtn.style.width = '100%';
  submitBtn.style.marginTop = '8px';
  submitBtn.textContent = 'Log in';
  card.appendChild(submitBtn);

  const emailInput = card.querySelector<HTMLInputElement>('#login-email')!;
  const passwordInput = card.querySelector<HTMLInputElement>('#login-password')!;

  async function handleLogin() {
    errorBox.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in...';

    try {
      const result = await post<{ token: string; user: { id: string; email: string; firstName: string; lastName: string; role: string; tenantId: string | null } }>(
        '/auth/login',
        {
          email: emailInput.value.trim(),
          password: passwordInput.value,
        }
      );

      if (result.user.role !== 'SUPER_USER' && result.user.role !== 'SYSTEM_ADMIN') {
        errorBox.textContent = 'Access denied. Admin or vendor login only.';
        errorBox.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Log in';
        return;
      }

      setToken(result.token);
      setUser(result.user);
      window.location.hash = result.user.role === 'SYSTEM_ADMIN' ? '#vendor-dashboard' : '#dashboard';
    } catch (err) {
      errorBox.textContent = err instanceof Error ? err.message : 'Login failed';
      errorBox.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Log in';
    }
  }

  submitBtn.addEventListener('click', handleLogin);
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });

  container.appendChild(card);

  return () => {
    container.innerHTML = '';
  };
}

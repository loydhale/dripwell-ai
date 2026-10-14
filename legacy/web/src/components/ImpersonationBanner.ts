export interface ImpersonationBannerState {
  providerName: string;
  onExit: () => void;
}

export function renderImpersonationBanner(
  _container: HTMLElement,
  state: ImpersonationBannerState
): () => void {
  const banner = document.createElement('div');
  banner.className = 'impersonation-banner';
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 9999;
    background: #b45309;
    color: #fff;
    padding: 10px 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  `;

  const label = document.createElement('span');
  label.textContent = `Impersonating ${state.providerName} — Admin View`;

  const exitBtn = document.createElement('button');
  exitBtn.textContent = 'Exit';
  exitBtn.style.cssText = `
    background: #fff;
    color: #b45309;
    border: none;
    border-radius: 4px;
    padding: 4px 12px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  `;
  exitBtn.addEventListener('click', state.onExit);

  banner.appendChild(label);
  banner.appendChild(exitBtn);

  // Add padding to body so content isn't hidden behind banner
  const originalPadding = document.body.style.paddingTop;
  document.body.style.paddingTop = '44px';

  document.body.appendChild(banner);

  return () => {
    banner.remove();
    document.body.style.paddingTop = originalPadding;
  };
}

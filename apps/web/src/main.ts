import { renderLandingPage } from './pages/LandingPage';
import './styles/landing.css';

const app = document.getElementById('app');
if (app) {
  renderLandingPage(app);
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/sw.js')
    .catch((err) => {
      console.error('Service worker registration failed:', err);
    });
}

export type PhotoAngle = 'FACE' | 'UNDER_EYES' | 'HAND_FOREARM' | 'TONGUE';

export interface AngleConfig {
  angle: PhotoAngle;
  title: string;
  subtitle: string;
  guideSvg: string;
  instruction: string;
}

export const ANGLE_CONFIGS: AngleConfig[] = [
  {
    angle: 'FACE',
    title: 'Face — Front View',
    subtitle: 'Center the face in the oval, neutral expression',
    guideSvg: `<svg viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="20" y="10" width="160" height="240" rx="80" stroke="rgba(255,255,255,0.85)" stroke-width="3" stroke-dasharray="8 6"/>
      <line x1="100" y1="10" x2="100" y2="250" stroke="rgba(255,255,255,0.35)" stroke-width="1" stroke-dasharray="4 4"/>
      <line x1="20" y1="130" x2="180" y2="130" stroke="rgba(255,255,255,0.35)" stroke-width="1" stroke-dasharray="4 4"/>
    </svg>`,
    instruction: 'Hold tablet at arm length. Face the camera directly.',
  },
  {
    angle: 'UNDER_EYES',
    title: 'Under-Eyes — Close-Up',
    subtitle: 'Fill frame with the under-eye area',
    guideSvg: `<svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="10" y="10" width="180" height="180" rx="12" stroke="rgba(255,255,255,0.85)" stroke-width="3" stroke-dasharray="8 6"/>
      <line x1="100" y1="10" x2="100" y2="190" stroke="rgba(255,255,255,0.35)" stroke-width="1" stroke-dasharray="4 4"/>
      <line x1="10" y1="100" x2="190" y2="100" stroke="rgba(255,255,255,0.35)" stroke-width="1" stroke-dasharray="4 4"/>
    </svg>`,
    instruction: 'Move tablet closer until under-eyes fill the guide.',
  },
  {
    angle: 'HAND_FOREARM',
    title: 'Hand / Forearm',
    subtitle: 'Back of hand flat, fingers slightly spread',
    guideSvg: `<svg viewBox="0 0 260 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="10" y="20" width="240" height="160" rx="12" stroke="rgba(255,255,255,0.85)" stroke-width="3" stroke-dasharray="8 6"/>
      <line x1="130" y1="20" x2="130" y2="180" stroke="rgba(255,255,255,0.35)" stroke-width="1" stroke-dasharray="4 4"/>
      <line x1="10" y1="100" x2="250" y2="100" stroke="rgba(255,255,255,0.35)" stroke-width="1" stroke-dasharray="4 4"/>
    </svg>`,
    instruction: 'Place back of hand in the rectangle, palm down.',
  },
  {
    angle: 'TONGUE',
    title: 'Tongue — Optional',
    subtitle: 'Stick tongue out gently, center in frame',
    guideSvg: `<svg viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <ellipse cx="100" cy="130" rx="70" ry="110" stroke="rgba(255,255,255,0.85)" stroke-width="3" stroke-dasharray="8 6"/>
      <line x1="100" y1="20" x2="100" y2="240" stroke="rgba(255,255,255,0.35)" stroke-width="1" stroke-dasharray="4 4"/>
    </svg>`,
    instruction: 'Patient sticks tongue out gently. Capture quickly.',
  },
];

export function getAngleConfig(angle: PhotoAngle): AngleConfig {
  const config = ANGLE_CONFIGS.find((c) => c.angle === angle);
  if (!config) {
    throw new Error(`Unknown photo angle: ${angle}`);
  }
  return config;
}

export interface ARGuideOverlayElements {
  root: HTMLElement;
  guideSvg: HTMLElement;
  lightingDot: HTMLElement;
  lightingLabel: HTMLElement;
  titleLabel: HTMLElement;
  subtitleLabel: HTMLElement;
  instructionLabel: HTMLElement;
}

export function createARGuideOverlay(angle: PhotoAngle): ARGuideOverlayElements {
  const config = getAngleConfig(angle);

  const root = document.createElement('div');
  root.className = 'ar-guide-overlay';

  const guideSvg = document.createElement('div');
  guideSvg.className = 'ar-guide-svg';
  guideSvg.innerHTML = config.guideSvg;

  const topBar = document.createElement('div');
  topBar.className = 'ar-top-bar';

  const lightingDot = document.createElement('span');
  lightingDot.className = 'ar-lighting-dot';
  lightingDot.setAttribute('aria-hidden', 'true');

  const lightingLabel = document.createElement('span');
  lightingLabel.className = 'ar-lighting-label';

  topBar.appendChild(lightingDot);
  topBar.appendChild(lightingLabel);

  const titleLabel = document.createElement('div');
  titleLabel.className = 'ar-title';
  titleLabel.textContent = config.title;

  const subtitleLabel = document.createElement('div');
  subtitleLabel.className = 'ar-subtitle';
  subtitleLabel.textContent = config.subtitle;

  const instructionLabel = document.createElement('div');
  instructionLabel.className = 'ar-instruction';
  instructionLabel.textContent = config.instruction;

  root.appendChild(topBar);
  root.appendChild(guideSvg);
  root.appendChild(titleLabel);
  root.appendChild(subtitleLabel);
  root.appendChild(instructionLabel);

  return {
    root,
    guideSvg,
    lightingDot,
    lightingLabel,
    titleLabel,
    subtitleLabel,
    instructionLabel,
  };
}

export function updateLightingIndicator(
  elements: ARGuideOverlayElements,
  _brightness: number,
  label: 'good' | 'fair' | 'poor'
): void {
  elements.lightingDot.className = `ar-lighting-dot ar-lighting-${label}`;
  const text = label === 'good' ? 'Lighting good' : label === 'fair' ? 'Lighting fair' : 'Lighting poor — move closer to light';
  elements.lightingLabel.textContent = text;
  elements.lightingLabel.className = `ar-lighting-label ar-lighting-${label}`;
}

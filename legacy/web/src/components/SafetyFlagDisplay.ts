import '../styles/safety.css';

export interface SafetyFlag {
  id: string;
  tier: 'T1_INFO' | 'T2_FOLLOWUP' | 'T3_URGENT';
  flagType: string;
  description: string;
  suggestedScript: string | null;
  providerAcknowledgedAt: string | null;
  isOverridden: boolean;
}

export interface SafetyFlagDisplayState {
  flags: SafetyFlag[];
  hasUnacknowledgedTier3: boolean;
}

export interface SafetyFlagDisplayHandlers {
  onAcknowledge: (flagId: string) => void;
  onProceed: () => void;
}

function tierLabel(tier: SafetyFlag['tier']): string {
  switch (tier) {
    case 'T1_INFO':
      return 'Informational';
    case 'T2_FOLLOWUP':
      return 'Recommend Follow-up';
    case 'T3_URGENT':
      return 'Urgent / Contraindication';
  }
}

function tierClass(tier: SafetyFlag['tier']): string {
  switch (tier) {
    case 'T1_INFO':
      return 'sf-tier--info';
    case 'T2_FOLLOWUP':
      return 'sf-tier--followup';
    case 'T3_URGENT':
      return 'sf-tier--urgent';
  }
}

export function renderSafetyFlagDisplay(
  container: HTMLElement,
  state: SafetyFlagDisplayState,
  handlers: SafetyFlagDisplayHandlers
): () => void {
  container.innerHTML = '';
  container.className = 'safety-flag-root';

  const header = document.createElement('div');
  header.className = 'sf-header';

  const title = document.createElement('h1');
  title.className = 'sf-title';
  title.textContent = 'Safety Review';

  const subtitle = document.createElement('p');
  subtitle.className = 'sf-subtitle';
  subtitle.textContent = state.flags.length === 0
    ? 'No safety flags detected for this assessment.'
    : `Review ${state.flags.length} safety flag${state.flags.length > 1 ? 's' : ''} before proceeding.`;

  header.appendChild(title);
  header.appendChild(subtitle);

  const flagsSection = document.createElement('div');
  flagsSection.className = 'sf-flags-section';

  for (const flag of state.flags) {
    const card = document.createElement('div');
    card.className = `sf-flag-card ${tierClass(flag.tier)}`;

    const tierBadge = document.createElement('div');
    tierBadge.className = 'sf-tier-badge';
    tierBadge.textContent = tierLabel(flag.tier);

    const flagType = document.createElement('div');
    flagType.className = 'sf-flag-type';
    flagType.textContent = flag.flagType.replace(/_/g, ' ');

    const description = document.createElement('p');
    description.className = 'sf-flag-description';
    description.textContent = flag.description;

    card.appendChild(tierBadge);
    card.appendChild(flagType);
    card.appendChild(description);

    if (flag.suggestedScript) {
      const scriptSection = document.createElement('div');
      scriptSection.className = 'sf-script-section';

      const scriptLabel = document.createElement('div');
      scriptLabel.className = 'sf-script-label';
      scriptLabel.textContent = 'Suggested Provider Script';

      const scriptText = document.createElement('blockquote');
      scriptText.className = 'sf-script-text';
      scriptText.textContent = `"${flag.suggestedScript}"`;

      scriptSection.appendChild(scriptLabel);
      scriptSection.appendChild(scriptText);
      card.appendChild(scriptSection);
    }

    if (flag.tier === 'T3_URGENT') {
      const ackSection = document.createElement('div');
      ackSection.className = 'sf-ack-section';

      if (flag.providerAcknowledgedAt) {
        const ackStatus = document.createElement('div');
        ackStatus.className = 'sf-ack-status sf-ack-status--done';
        ackStatus.textContent = `Acknowledged at ${new Date(flag.providerAcknowledgedAt).toLocaleString()}`;
        ackSection.appendChild(ackStatus);
      } else {
        const ackLabel = document.createElement('label');
        ackLabel.className = 'sf-ack-label';

        const ackCheckbox = document.createElement('input');
        ackCheckbox.type = 'checkbox';
        ackCheckbox.className = 'sf-ack-checkbox';
        ackCheckbox.id = `ack-${flag.id}`;

        const ackText = document.createElement('span');
        ackText.textContent = ' I have reviewed this safety concern and will follow the recommended protocol.';

        ackLabel.appendChild(ackCheckbox);
        ackLabel.appendChild(ackText);
        ackSection.appendChild(ackLabel);

        const ackBtn = document.createElement('button');
        ackBtn.className = 'sf-ack-btn';
        ackBtn.textContent = 'Acknowledge & Confirm';
        ackBtn.disabled = true;

        ackCheckbox.addEventListener('change', () => {
          ackBtn.disabled = !ackCheckbox.checked;
        });

        ackBtn.addEventListener('click', () => {
          if (ackCheckbox.checked) {
            handlers.onAcknowledge(flag.id);
          }
        });

        ackSection.appendChild(ackBtn);
      }

      card.appendChild(ackSection);
    }

    flagsSection.appendChild(card);
  }

  const bottomBar = document.createElement('div');
  bottomBar.className = 'sf-bottom-bar';

  const proceedBtn = document.createElement('button');
  proceedBtn.className = 'sf-btn-proceed';
  proceedBtn.textContent = 'Continue to Recommendation';
  proceedBtn.disabled = state.hasUnacknowledgedTier3;

  if (state.hasUnacknowledgedTier3) {
    proceedBtn.title = 'All urgent (Tier 3) safety flags must be acknowledged before proceeding.';
  }

  proceedBtn.addEventListener('click', () => {
    if (!state.hasUnacknowledgedTier3) {
      handlers.onProceed();
    }
  });

  bottomBar.appendChild(proceedBtn);

  container.appendChild(header);
  container.appendChild(flagsSection);
  container.appendChild(bottomBar);

  return () => {
    // cleanup handled by innerHTML replacement on next render
  };
}

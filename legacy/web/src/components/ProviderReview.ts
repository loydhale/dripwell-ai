import '../styles/provider.css';
import type { CatalogItemMatch, PatternDetail } from './RecommendationPreview.js';
import type { SafetyFlag } from './SafetyFlagDisplay.js';

export interface ProviderReviewState {
  assessmentId?: string;
  recommendationId: string;
  primaryItem: CatalogItemMatch;
  alternatives: CatalogItemMatch[];
  confidence: number;
  rationale: string;
  patternName: string;
  genericIntent: string;
  patterns?: PatternDetail[];
  flags: SafetyFlag[];
}

export interface ProviderReviewHandlers {
  onApprove: () => void;
  onOverride: (reason: string, reasonNote: string, manualRecommendation: string) => void;
  onModify: (changes: { rationale?: string; primaryCatalogItemId?: string }) => void;
  onEscalate?: (reason: string, notes: string) => void;
  onDefer?: (reason: string, followUpDate: string, notes: string) => void;
}

export function renderProviderReview(
  container: HTMLElement,
  state: ProviderReviewState,
  handlers: ProviderReviewHandlers
): () => void {
  container.innerHTML = '';
  container.className = 'provider-review-root';

  const header = document.createElement('div');
  header.className = 'pr-header';

  const title = document.createElement('h1');
  title.className = 'pr-title';
  title.textContent = 'Provider Approval Review';

  const subtitle = document.createElement('p');
  subtitle.className = 'pr-subtitle';
  subtitle.textContent = 'Review the AI recommendation, safety flags, and approve or override before patient delivery.';

  header.appendChild(title);
  header.appendChild(subtitle);

  // Scrollable content area
  const scrollArea = document.createElement('div');
  scrollArea.className = 'pr-scroll-area';

  // Confidence badge
  const confidenceBadge = document.createElement('div');
  confidenceBadge.className = 'pr-confidence-badge';
  const confidencePct = Math.round(state.confidence * 100);
  confidenceBadge.textContent = `AI Confidence: ${confidencePct}%`;
  if (confidencePct >= 70) {
    confidenceBadge.classList.add('pr-confidence--high');
  } else if (confidencePct >= 50) {
    confidenceBadge.classList.add('pr-confidence--medium');
  } else {
    confidenceBadge.classList.add('pr-confidence--low');
  }

  // Primary recommendation card
  const primaryCard = document.createElement('div');
  primaryCard.className = 'pr-primary-card';

  const primaryLabel = document.createElement('div');
  primaryLabel.className = 'pr-item-label';
  primaryLabel.textContent = 'Primary Recommendation';

  const primaryName = document.createElement('h2');
  primaryName.className = 'pr-item-name';
  primaryName.textContent = state.primaryItem.name;

  const primaryType = document.createElement('span');
  primaryType.className = 'pr-item-type';
  primaryType.textContent = state.primaryItem.type;

  const primaryDesc = document.createElement('p');
  primaryDesc.className = 'pr-item-description';
  primaryDesc.textContent = state.primaryItem.description || 'No description available';

  const primaryReason = document.createElement('div');
  primaryReason.className = 'pr-match-reason';
  primaryReason.textContent = state.primaryItem.matchReason;

  primaryCard.appendChild(primaryLabel);
  primaryCard.appendChild(primaryName);
  primaryCard.appendChild(primaryType);
  primaryCard.appendChild(primaryDesc);
  primaryCard.appendChild(primaryReason);

  // Alternatives
  const alternativesSection = document.createElement('div');
  alternativesSection.className = 'pr-alternatives-section';

  if (state.alternatives.length > 0) {
    const altTitle = document.createElement('h3');
    altTitle.className = 'pr-section-title';
    altTitle.textContent = `Alternatives (${state.alternatives.length})`;
    alternativesSection.appendChild(altTitle);

    for (const alt of state.alternatives) {
      const altCard = document.createElement('div');
      altCard.className = 'pr-alt-card';

      const altName = document.createElement('div');
      altName.className = 'pr-alt-name';
      altName.textContent = alt.name;

      const altType = document.createElement('span');
      altType.className = 'pr-alt-type';
      altType.textContent = alt.type;

      const altDesc = document.createElement('p');
      altDesc.className = 'pr-alt-description';
      altDesc.textContent = alt.description || '';

      altCard.appendChild(altName);
      altCard.appendChild(altType);
      altCard.appendChild(altDesc);
      alternativesSection.appendChild(altCard);
    }
  }

  // Rationale
  const rationaleSection = document.createElement('div');
  rationaleSection.className = 'pr-rationale-section';

  const rationaleTitle = document.createElement('h3');
  rationaleTitle.className = 'pr-section-title';
  rationaleTitle.textContent = 'Clinical Rationale';

  const rationaleText = document.createElement('p');
  rationaleText.className = 'pr-rationale-text';
  rationaleText.textContent = state.rationale;

  rationaleSection.appendChild(rationaleTitle);
  rationaleSection.appendChild(rationaleText);

  // Patterns
  const patternsSection = document.createElement('div');
  patternsSection.className = 'pr-patterns-section';

  const patternsTitle = document.createElement('h3');
  patternsTitle.className = 'pr-section-title';
  patternsTitle.textContent = 'Pattern Analysis';
  patternsSection.appendChild(patternsTitle);

  for (const p of state.patterns || []) {
    const patternCard = document.createElement('div');
    patternCard.className = 'pr-pattern-card';
    if (p.isPrimary) {
      patternCard.classList.add('pr-pattern-card--primary');
    }

    const patternHeader = document.createElement('div');
    patternHeader.className = 'pr-pattern-header';

    const patternName = document.createElement('span');
    patternName.className = 'pr-pattern-name';
    patternName.textContent = p.clinicalPatternName;

    const patternConfidence = document.createElement('span');
    patternConfidence.className = 'pr-pattern-confidence';
    patternConfidence.textContent = `${Math.round(p.confidence * 100)}%`;

    patternHeader.appendChild(patternName);
    patternHeader.appendChild(patternConfidence);
    patternCard.appendChild(patternHeader);

    if (p.matchedSignals.length > 0) {
      const signalsLabel = document.createElement('div');
      signalsLabel.className = 'pr-detail-label';
      signalsLabel.textContent = 'Supporting Signals';
      patternCard.appendChild(signalsLabel);

      const signalsList = document.createElement('ul');
      signalsList.className = 'pr-detail-list';
      for (const s of p.matchedSignals) {
        const li = document.createElement('li');
        li.textContent = `${formatSignalName(s.signalName)} (${Math.round(s.confidence * 100)}%)`;
        signalsList.appendChild(li);
      }
      patternCard.appendChild(signalsList);
    }

    if (p.matchedAnswers.length > 0) {
      const answersLabel = document.createElement('div');
      answersLabel.className = 'pr-detail-label';
      answersLabel.textContent = 'Supporting Answers';
      patternCard.appendChild(answersLabel);

      const answersList = document.createElement('ul');
      answersList.className = 'pr-detail-list';
      for (const a of p.matchedAnswers) {
        const li = document.createElement('li');
        li.textContent = `Question aligned (${Math.round(a.weight * 100)}% weight)`;
        answersList.appendChild(li);
      }
      patternCard.appendChild(answersList);
    }

    patternsSection.appendChild(patternCard);
  }

  // Safety flags
  const flagsSection = document.createElement('div');
  flagsSection.className = 'pr-flags-section';

  const flagsTitle = document.createElement('h3');
  flagsTitle.className = 'pr-section-title';
  flagsTitle.textContent = `Safety Flags (${state.flags.length})`;
  flagsSection.appendChild(flagsTitle);

  if (state.flags.length === 0) {
    const noFlags = document.createElement('p');
    noFlags.className = 'pr-no-flags';
    noFlags.textContent = 'No safety flags detected for this assessment.';
    flagsSection.appendChild(noFlags);
  }

  for (const flag of state.flags) {
    const flagCard = document.createElement('div');
    flagCard.className = `pr-flag-card pr-flag-card--${flag.tier.toLowerCase().replace('_', '-')}`;

    const tierBadge = document.createElement('div');
    tierBadge.className = 'pr-flag-tier';
    tierBadge.textContent = flag.tier.replace('T1_', '').replace('T2_', '').replace('T3_', '');

    const flagType = document.createElement('div');
    flagType.className = 'pr-flag-type';
    flagType.textContent = flag.flagType.replace(/_/g, ' ');

    const flagDesc = document.createElement('p');
    flagDesc.className = 'pr-flag-description';
    flagDesc.textContent = flag.description;

    flagCard.appendChild(tierBadge);
    flagCard.appendChild(flagType);
    flagCard.appendChild(flagDesc);

    if (flag.suggestedScript) {
      const scriptBlock = document.createElement('blockquote');
      scriptBlock.className = 'pr-flag-script';
      scriptBlock.textContent = `"${flag.suggestedScript}"`;
      flagCard.appendChild(scriptBlock);
    }

    flagsSection.appendChild(flagCard);
  }

  scrollArea.appendChild(confidenceBadge);
  scrollArea.appendChild(primaryCard);
  scrollArea.appendChild(alternativesSection);
  scrollArea.appendChild(rationaleSection);
  scrollArea.appendChild(patternsSection);
  scrollArea.appendChild(flagsSection);

  // Bottom bar
  const bottomBar = document.createElement('div');
  bottomBar.className = 'pr-bottom-bar';

  const escalateBtn = document.createElement('button');
  escalateBtn.className = 'pr-btn-escalate';
  escalateBtn.textContent = 'Escalate';

  const deferBtn = document.createElement('button');
  deferBtn.className = 'pr-btn-defer';
  deferBtn.textContent = 'Defer';

  const overrideBtn = document.createElement('button');
  overrideBtn.className = 'pr-btn-override';
  overrideBtn.textContent = 'Override';

  const modifyBtn = document.createElement('button');
  modifyBtn.className = 'pr-btn-modify';
  modifyBtn.textContent = 'Modify';

  const approveBtn = document.createElement('button');
  approveBtn.className = 'pr-btn-approve';
  approveBtn.textContent = 'Approve';

  bottomBar.appendChild(escalateBtn);
  bottomBar.appendChild(deferBtn);
  bottomBar.appendChild(overrideBtn);
  bottomBar.appendChild(modifyBtn);
  bottomBar.appendChild(approveBtn);

  // Override panel (hidden by default)
  const overridePanel = document.createElement('div');
  overridePanel.className = 'pr-panel pr-panel--hidden';

  const overrideTitle = document.createElement('h3');
  overrideTitle.className = 'pr-panel-title';
  overrideTitle.textContent = 'Override Recommendation';
  overridePanel.appendChild(overrideTitle);

  const reasonLabel = document.createElement('label');
  reasonLabel.className = 'pr-field-label';
  reasonLabel.textContent = 'Reason';
  overridePanel.appendChild(reasonLabel);

  const reasonSelect = document.createElement('select');
  reasonSelect.className = 'pr-field-input';
  const reasons = [
    { value: 'CLINICAL_JUDGEMENT', label: 'Clinical judgement - I disagree with the AI assessment' },
    { value: 'PATIENT_PREFERENCE', label: 'Patient preference - Patient requested different treatment' },
    { value: 'CONTRAINDICATION', label: 'Contraindication - Known allergy or condition' },
    { value: 'OTHER', label: 'Other' },
  ];
  for (const r of reasons) {
    const opt = document.createElement('option');
    opt.value = r.value;
    opt.textContent = r.label;
    reasonSelect.appendChild(opt);
  }
  overridePanel.appendChild(reasonSelect);

  const noteLabel = document.createElement('label');
  noteLabel.className = 'pr-field-label';
  noteLabel.textContent = 'Additional notes (optional)';
  overridePanel.appendChild(noteLabel);

  const noteInput = document.createElement('textarea');
  noteInput.className = 'pr-field-textarea';
  noteInput.rows = 3;
  noteInput.placeholder = 'Explain your override reason...';
  overridePanel.appendChild(noteInput);

  const manualLabel = document.createElement('label');
  manualLabel.className = 'pr-field-label';
  manualLabel.textContent = 'Your manual recommendation (optional)';
  overridePanel.appendChild(manualLabel);

  const manualInput = document.createElement('textarea');
  manualInput.className = 'pr-field-textarea';
  manualInput.rows = 2;
  manualInput.placeholder = 'Describe the treatment you recommend instead...';
  overridePanel.appendChild(manualInput);

  const overrideSubmit = document.createElement('button');
  overrideSubmit.className = 'pr-btn-override';
  overrideSubmit.textContent = 'Confirm Override';
  overridePanel.appendChild(overrideSubmit);

  const overrideCancel = document.createElement('button');
  overrideCancel.className = 'pr-btn-modify';
  overrideCancel.textContent = 'Cancel';
  overridePanel.appendChild(overrideCancel);

  // Modify panel (hidden by default)
  const modifyPanel = document.createElement('div');
  modifyPanel.className = 'pr-panel pr-panel--hidden';

  const modifyTitle = document.createElement('h3');
  modifyTitle.className = 'pr-panel-title';
  modifyTitle.textContent = 'Modify Recommendation';
  modifyPanel.appendChild(modifyTitle);

  const altLabel = document.createElement('label');
  altLabel.className = 'pr-field-label';
  altLabel.textContent = 'Switch primary to alternative';
  modifyPanel.appendChild(altLabel);

  const altSelect = document.createElement('select');
  altSelect.className = 'pr-field-input';
  const keepOpt = document.createElement('option');
  keepOpt.value = '';
  keepOpt.textContent = `Keep current: ${state.primaryItem.name}`;
  altSelect.appendChild(keepOpt);
  for (const alt of state.alternatives) {
    const opt = document.createElement('option');
    opt.value = alt.catalogItemId;
    opt.textContent = alt.name;
    altSelect.appendChild(opt);
  }
  modifyPanel.appendChild(altSelect);

  const rationaleLabel = document.createElement('label');
  rationaleLabel.className = 'pr-field-label';
  rationaleLabel.textContent = 'Edit rationale';
  modifyPanel.appendChild(rationaleLabel);

  const rationaleInput = document.createElement('textarea');
  rationaleInput.className = 'pr-field-textarea';
  rationaleInput.rows = 4;
  rationaleInput.value = state.rationale;
  modifyPanel.appendChild(rationaleInput);

  const modifySubmit = document.createElement('button');
  modifySubmit.className = 'pr-btn-modify';
  modifySubmit.textContent = 'Confirm Modification';
  modifyPanel.appendChild(modifySubmit);

  const modifyCancel = document.createElement('button');
  modifyCancel.className = 'pr-btn-override';
  modifyCancel.textContent = 'Cancel';
  modifyPanel.appendChild(modifyCancel);

  // Escalate panel (hidden by default)
  const escalatePanel = document.createElement('div');
  escalatePanel.className = 'pr-panel pr-panel--hidden';

  const escalateTitle = document.createElement('h3');
  escalateTitle.className = 'pr-panel-title';
  escalateTitle.textContent = 'Escalate to Physician';
  escalatePanel.appendChild(escalateTitle);

  const escalateReasonLabel = document.createElement('label');
  escalateReasonLabel.className = 'pr-field-label';
  escalateReasonLabel.textContent = 'Escalation reason';
  escalatePanel.appendChild(escalateReasonLabel);

  const escalateReasonSelect = document.createElement('select');
  escalateReasonSelect.className = 'pr-field-input';
  const escalateReasons = [
    { value: 'NEEDS_PHYSICIAN_REVIEW', label: 'Needs physician review' },
    { value: 'COMPLEX_CASE', label: 'Complex case' },
    { value: 'PATIENT_REQUEST', label: 'Patient request' },
    { value: 'OTHER', label: 'Other' },
  ];
  for (const r of escalateReasons) {
    const opt = document.createElement('option');
    opt.value = r.value;
    opt.textContent = r.label;
    escalateReasonSelect.appendChild(opt);
  }
  escalatePanel.appendChild(escalateReasonSelect);

  const escalateNotesLabel = document.createElement('label');
  escalateNotesLabel.className = 'pr-field-label';
  escalateNotesLabel.textContent = 'Notes (optional)';
  escalatePanel.appendChild(escalateNotesLabel);

  const escalateNotesInput = document.createElement('textarea');
  escalateNotesInput.className = 'pr-field-textarea';
  escalateNotesInput.rows = 3;
  escalateNotesInput.placeholder = 'Add notes about the escalation...';
  escalatePanel.appendChild(escalateNotesInput);

  const escalateSubmit = document.createElement('button');
  escalateSubmit.className = 'pr-btn-escalate';
  escalateSubmit.textContent = 'Confirm Escalation';
  escalatePanel.appendChild(escalateSubmit);

  const escalateCancel = document.createElement('button');
  escalateCancel.className = 'pr-btn-modify';
  escalateCancel.textContent = 'Cancel';
  escalatePanel.appendChild(escalateCancel);

  // Defer panel (hidden by default)
  const deferPanel = document.createElement('div');
  deferPanel.className = 'pr-panel pr-panel--hidden';

  const deferTitle = document.createElement('h3');
  deferTitle.className = 'pr-panel-title';
  deferTitle.textContent = 'Defer Assessment';
  deferPanel.appendChild(deferTitle);

  const deferReasonLabel = document.createElement('label');
  deferReasonLabel.className = 'pr-field-label';
  deferReasonLabel.textContent = 'Deferral reason';
  deferPanel.appendChild(deferReasonLabel);

  const deferReasonSelect = document.createElement('select');
  deferReasonSelect.className = 'pr-field-input';
  const deferReasons = [
    { value: 'NEED_MORE_INFO', label: 'Need more information' },
    { value: 'PATIENT_NOT_READY', label: 'Patient not ready' },
    { value: 'FOLLOW_UP_NEEDED', label: 'Follow-up needed' },
    { value: 'OTHER', label: 'Other' },
  ];
  for (const r of deferReasons) {
    const opt = document.createElement('option');
    opt.value = r.value;
    opt.textContent = r.label;
    deferReasonSelect.appendChild(opt);
  }
  deferPanel.appendChild(deferReasonSelect);

  const deferDateLabel = document.createElement('label');
  deferDateLabel.className = 'pr-field-label';
  deferDateLabel.textContent = 'Follow-up date (optional)';
  deferPanel.appendChild(deferDateLabel);

  const deferDateInput = document.createElement('input');
  deferDateInput.className = 'pr-field-input';
  deferDateInput.type = 'date';
  deferPanel.appendChild(deferDateInput);

  const deferNotesLabel = document.createElement('label');
  deferNotesLabel.className = 'pr-field-label';
  deferNotesLabel.textContent = 'Notes (optional)';
  deferPanel.appendChild(deferNotesLabel);

  const deferNotesInput = document.createElement('textarea');
  deferNotesInput.className = 'pr-field-textarea';
  deferNotesInput.rows = 3;
  deferNotesInput.placeholder = 'Add notes about the deferral...';
  deferPanel.appendChild(deferNotesInput);

  const deferSubmit = document.createElement('button');
  deferSubmit.className = 'pr-btn-defer';
  deferSubmit.textContent = 'Confirm Deferral';
  deferPanel.appendChild(deferSubmit);

  const deferCancel = document.createElement('button');
  deferCancel.className = 'pr-btn-modify';
  deferCancel.textContent = 'Cancel';
  deferPanel.appendChild(deferCancel);

  // Assemble
  container.appendChild(header);
  container.appendChild(scrollArea);
  container.appendChild(overridePanel);
  container.appendChild(modifyPanel);
  container.appendChild(escalatePanel);
  container.appendChild(deferPanel);
  container.appendChild(bottomBar);

  // Event handlers
  function hideAllPanels() {
    overridePanel.classList.add('pr-panel--hidden');
    modifyPanel.classList.add('pr-panel--hidden');
    escalatePanel.classList.add('pr-panel--hidden');
    deferPanel.classList.add('pr-panel--hidden');
  }

  escalateBtn.addEventListener('click', () => {
    hideAllPanels();
    escalatePanel.classList.remove('pr-panel--hidden');
  });

  escalateCancel.addEventListener('click', () => {
    escalatePanel.classList.add('pr-panel--hidden');
  });

  escalateSubmit.addEventListener('click', () => {
    const reason = escalateReasonSelect.value;
    const notes = escalateNotesInput.value.trim();
    if (handlers.onEscalate) {
      handlers.onEscalate(reason, notes);
    }
  });

  deferBtn.addEventListener('click', () => {
    hideAllPanels();
    deferPanel.classList.remove('pr-panel--hidden');
  });

  deferCancel.addEventListener('click', () => {
    deferPanel.classList.add('pr-panel--hidden');
  });

  deferSubmit.addEventListener('click', () => {
    const reason = deferReasonSelect.value;
    const followUpDate = deferDateInput.value;
    const notes = deferNotesInput.value.trim();
    if (handlers.onDefer) {
      handlers.onDefer(reason, followUpDate, notes);
    }
  });

  overrideBtn.addEventListener('click', () => {
    hideAllPanels();
    overridePanel.classList.remove('pr-panel--hidden');
  });

  overrideCancel.addEventListener('click', () => {
    overridePanel.classList.add('pr-panel--hidden');
  });

  overrideSubmit.addEventListener('click', () => {
    const reason = reasonSelect.value;
    const reasonNote = noteInput.value.trim();
    const manualRecommendation = manualInput.value.trim();
    handlers.onOverride(reason, reasonNote, manualRecommendation);
  });

  modifyBtn.addEventListener('click', () => {
    hideAllPanels();
    modifyPanel.classList.remove('pr-panel--hidden');
  });

  modifyCancel.addEventListener('click', () => {
    modifyPanel.classList.add('pr-panel--hidden');
  });

  modifySubmit.addEventListener('click', () => {
    const changes: { rationale?: string; primaryCatalogItemId?: string } = {};
    const newRationale = rationaleInput.value.trim();
    if (newRationale && newRationale !== state.rationale) {
      changes.rationale = newRationale;
    }
    if (altSelect.value) {
      changes.primaryCatalogItemId = altSelect.value;
    }
    handlers.onModify(changes);
  });

  approveBtn.addEventListener('click', () => {
    handlers.onApprove();
  });

  return () => {
    // cleanup handled by innerHTML replacement on next render
  };
}

function formatSignalName(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

import '../styles/recommendations.css';

export interface CatalogItemMatch {
  catalogItemId: string;
  name: string;
  type: string;
  description: string | null;
  matchReason: string;
}

export interface PatternDetail {
  clinicalPatternId: string;
  clinicalPatternName: string;
  confidence: number;
  category: string;
  matchedSignals: Array<{ signalName: string; confidence: number; weight: number }>;
  matchedAnswers: Array<{ questionId: string; answerValue: string; weight: number }>;
  isPrimary: boolean;
}

export interface RecommendationPreviewState {
  assessmentId?: string;
  recommendationId: string;
  primaryItem: CatalogItemMatch;
  alternatives: CatalogItemMatch[];
  confidence: number;
  rationale: string;
  patternName: string;
  genericIntent: string;
  patterns?: PatternDetail[];
}

export interface RecommendationPreviewHandlers {
  onApprove: () => void;
  onReject: () => void;
  onModify: () => void;
}

export function renderRecommendationPreview(
  container: HTMLElement,
  state: RecommendationPreviewState,
  handlers: RecommendationPreviewHandlers
): () => void {
  container.innerHTML = '';
  container.className = 'recommendation-preview-root';

  const header = document.createElement('div');
  header.className = 'rp-header';

  const title = document.createElement('h1');
  title.className = 'rp-title';
  title.textContent = 'Recommendation Review';

  const subtitle = document.createElement('p');
  subtitle.className = 'rp-subtitle';
  subtitle.textContent = 'Review the system recommendation before proceeding with the patient.';

  header.appendChild(title);
  header.appendChild(subtitle);

  const confidenceBadge = document.createElement('div');
  confidenceBadge.className = 'rp-confidence-badge';
  const confidencePct = Math.round(state.confidence * 100);
  confidenceBadge.textContent = `Confidence: ${confidencePct}%`;
  if (confidencePct >= 70) {
    confidenceBadge.classList.add('rp-confidence--high');
  } else if (confidencePct >= 50) {
    confidenceBadge.classList.add('rp-confidence--medium');
  } else {
    confidenceBadge.classList.add('rp-confidence--low');
  }

  const primaryCard = document.createElement('div');
  primaryCard.className = 'rp-primary-card';

  const primaryLabel = document.createElement('div');
  primaryLabel.className = 'rp-item-label';
  primaryLabel.textContent = 'Primary Recommendation';

  const primaryName = document.createElement('h2');
  primaryName.className = 'rp-item-name';
  primaryName.textContent = state.primaryItem.name;

  const primaryType = document.createElement('span');
  primaryType.className = 'rp-item-type';
  primaryType.textContent = state.primaryItem.type;

  const primaryDesc = document.createElement('p');
  primaryDesc.className = 'rp-item-description';
  primaryDesc.textContent = state.primaryItem.description || 'No description available';

  const primaryReason = document.createElement('div');
  primaryReason.className = 'rp-match-reason';
  primaryReason.textContent = state.primaryItem.matchReason;

  primaryCard.appendChild(primaryLabel);
  primaryCard.appendChild(primaryName);
  primaryCard.appendChild(primaryType);
  primaryCard.appendChild(primaryDesc);
  primaryCard.appendChild(primaryReason);

  const alternativesSection = document.createElement('div');
  alternativesSection.className = 'rp-alternatives-section';

  if (state.alternatives.length > 0) {
    const altTitle = document.createElement('h3');
    altTitle.className = 'rp-section-title';
    altTitle.textContent = `Alternatives (${state.alternatives.length})`;
    alternativesSection.appendChild(altTitle);

    for (const alt of state.alternatives) {
      const altCard = document.createElement('div');
      altCard.className = 'rp-alt-card';

      const altName = document.createElement('div');
      altName.className = 'rp-alt-name';
      altName.textContent = alt.name;

      const altType = document.createElement('span');
      altType.className = 'rp-alt-type';
      altType.textContent = alt.type;

      const altDesc = document.createElement('p');
      altDesc.className = 'rp-alt-description';
      altDesc.textContent = alt.description || '';

      altCard.appendChild(altName);
      altCard.appendChild(altType);
      altCard.appendChild(altDesc);
      alternativesSection.appendChild(altCard);
    }
  }

  const rationaleSection = document.createElement('div');
  rationaleSection.className = 'rp-rationale-section';

  const rationaleTitle = document.createElement('h3');
  rationaleTitle.className = 'rp-section-title';
  rationaleTitle.textContent = 'Clinical Rationale';

  const rationaleText = document.createElement('p');
  rationaleText.className = 'rp-rationale-text';
  rationaleText.textContent = state.rationale;

  rationaleSection.appendChild(rationaleTitle);
  rationaleSection.appendChild(rationaleText);

  const patternsSection = document.createElement('div');
  patternsSection.className = 'rp-patterns-section';

  const patternsTitle = document.createElement('h3');
  patternsTitle.className = 'rp-section-title';
  patternsTitle.textContent = 'Pattern Analysis';
  patternsSection.appendChild(patternsTitle);

  for (const p of state.patterns || []) {
    const patternCard = document.createElement('div');
    patternCard.className = 'rp-pattern-card';
    if (p.isPrimary) {
      patternCard.classList.add('rp-pattern-card--primary');
    }

    const patternHeader = document.createElement('div');
    patternHeader.className = 'rp-pattern-header';

    const patternName = document.createElement('span');
    patternName.className = 'rp-pattern-name';
    patternName.textContent = p.clinicalPatternName;

    const patternConfidence = document.createElement('span');
    patternConfidence.className = 'rp-pattern-confidence';
    patternConfidence.textContent = `${Math.round(p.confidence * 100)}%`;

    patternHeader.appendChild(patternName);
    patternHeader.appendChild(patternConfidence);
    patternCard.appendChild(patternHeader);

    if (p.matchedSignals.length > 0) {
      const signalsLabel = document.createElement('div');
      signalsLabel.className = 'rp-detail-label';
      signalsLabel.textContent = 'Supporting Signals';
      patternCard.appendChild(signalsLabel);

      const signalsList = document.createElement('ul');
      signalsList.className = 'rp-detail-list';
      for (const s of p.matchedSignals) {
        const li = document.createElement('li');
        li.textContent = `${formatSignalName(s.signalName)} (${Math.round(s.confidence * 100)}%)`;
        signalsList.appendChild(li);
      }
      patternCard.appendChild(signalsList);
    }

    if (p.matchedAnswers.length > 0) {
      const answersLabel = document.createElement('div');
      answersLabel.className = 'rp-detail-label';
      answersLabel.textContent = 'Supporting Answers';
      patternCard.appendChild(answersLabel);

      const answersList = document.createElement('ul');
      answersList.className = 'rp-detail-list';
      for (const a of p.matchedAnswers) {
        const li = document.createElement('li');
        li.textContent = `Question aligned (${Math.round(a.weight * 100)}% weight)`;
        answersList.appendChild(li);
      }
      patternCard.appendChild(answersList);
    }

    patternsSection.appendChild(patternCard);
  }

  const bottomBar = document.createElement('div');
  bottomBar.className = 'rp-bottom-bar';

  const rejectBtn = document.createElement('button');
  rejectBtn.className = 'rp-btn-reject';
  rejectBtn.textContent = 'Reject';
  rejectBtn.addEventListener('click', () => handlers.onReject());

  const modifyBtn = document.createElement('button');
  modifyBtn.className = 'rp-btn-modify';
  modifyBtn.textContent = 'Modify';
  modifyBtn.addEventListener('click', () => handlers.onModify());

  const approveBtn = document.createElement('button');
  approveBtn.className = 'rp-btn-approve';
  approveBtn.textContent = 'Approve';
  approveBtn.addEventListener('click', () => handlers.onApprove());

  bottomBar.appendChild(rejectBtn);
  bottomBar.appendChild(modifyBtn);
  bottomBar.appendChild(approveBtn);

  container.appendChild(header);
  container.appendChild(confidenceBadge);
  container.appendChild(primaryCard);
  container.appendChild(alternativesSection);
  container.appendChild(rationaleSection);
  container.appendChild(patternsSection);
  container.appendChild(bottomBar);

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

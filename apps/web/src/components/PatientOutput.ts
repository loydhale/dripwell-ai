import '../styles/provider.css';

export interface PatientOutputState {
  title: string;
  summary: string;
  whatWasObserved: string;
  whyThisRecommendation: string;
  whatToExpect: string;
  disclaimers: string[];
}

export interface PatientOutputHandlers {
  onFinish: () => void;
  onBack?: () => void;
}

export function renderPatientOutput(
  container: HTMLElement,
  state: PatientOutputState,
  handlers: PatientOutputHandlers
): () => void {
  container.innerHTML = '';
  container.className = 'patient-output-root';

  const header = document.createElement('div');
  header.className = 'po-header';

  const title = document.createElement('h1');
  title.className = 'po-title';
  title.textContent = state.title;

  const subtitle = document.createElement('p');
  subtitle.className = 'po-subtitle';
  subtitle.textContent = 'Reviewed and approved by your licensed provider.';

  header.appendChild(title);
  header.appendChild(subtitle);

  const scrollArea = document.createElement('div');
  scrollArea.className = 'po-scroll-area';

  // Summary card
  const summaryCard = document.createElement('div');
  summaryCard.className = 'po-card';
  const summaryText = document.createElement('p');
  summaryText.className = 'po-summary';
  summaryText.textContent = state.summary;
  summaryCard.appendChild(summaryText);

  // Observed section
  const observedSection = document.createElement('div');
  observedSection.className = 'po-section';
  const observedTitle = document.createElement('h2');
  observedTitle.className = 'po-section-title';
  observedTitle.textContent = 'What We Observed';
  const observedText = document.createElement('p');
  observedText.className = 'po-section-text';
  observedText.textContent = state.whatWasObserved;
  observedSection.appendChild(observedTitle);
  observedSection.appendChild(observedText);

  // Why section
  const whySection = document.createElement('div');
  whySection.className = 'po-section';
  const whyTitle = document.createElement('h2');
  whyTitle.className = 'po-section-title';
  whyTitle.textContent = 'Why This Recommendation';
  const whyText = document.createElement('p');
  whyText.className = 'po-section-text';
  whyText.textContent = state.whyThisRecommendation;
  whySection.appendChild(whyTitle);
  whySection.appendChild(whyText);

  // Expect section
  const expectSection = document.createElement('div');
  expectSection.className = 'po-section';
  const expectTitle = document.createElement('h2');
  expectTitle.className = 'po-section-title';
  expectTitle.textContent = 'What to Expect';
  const expectText = document.createElement('p');
  expectText.className = 'po-section-text';
  expectText.textContent = state.whatToExpect;
  expectSection.appendChild(expectTitle);
  expectSection.appendChild(expectText);

  // Disclaimers
  const disclaimerSection = document.createElement('div');
  disclaimerSection.className = 'po-disclaimer-section';
  const disclaimerTitle = document.createElement('h2');
  disclaimerTitle.className = 'po-section-title';
  disclaimerTitle.textContent = 'Important Information';
  disclaimerSection.appendChild(disclaimerTitle);

  const disclaimerList = document.createElement('ul');
  disclaimerList.className = 'po-disclaimer-list';
  for (const d of state.disclaimers) {
    const li = document.createElement('li');
    li.textContent = d;
    disclaimerList.appendChild(li);
  }
  disclaimerSection.appendChild(disclaimerList);

  scrollArea.appendChild(summaryCard);
  scrollArea.appendChild(observedSection);
  scrollArea.appendChild(whySection);
  scrollArea.appendChild(expectSection);
  scrollArea.appendChild(disclaimerSection);

  // Bottom bar
  const bottomBar = document.createElement('div');
  bottomBar.className = 'po-bottom-bar';

  if (handlers.onBack) {
    const backBtn = document.createElement('button');
    backBtn.className = 'po-btn-back';
    backBtn.textContent = 'Back to Review';
    backBtn.addEventListener('click', () => handlers.onBack?.());
    bottomBar.appendChild(backBtn);
  }

  const finishBtn = document.createElement('button');
  finishBtn.className = 'po-btn-finish';
  finishBtn.textContent = 'Finish';
  finishBtn.addEventListener('click', () => handlers.onFinish());
  bottomBar.appendChild(finishBtn);

  container.appendChild(header);
  container.appendChild(scrollArea);
  container.appendChild(bottomBar);

  return () => {
    // cleanup handled by innerHTML replacement on next render
  };
}

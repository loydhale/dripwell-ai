import '../styles/questions.css';

export interface Question {
  id: string;
  category: string;
  questionText: string;
  answerType: string;
  answerOptions: string[];
  isOptional?: boolean;
}

export interface QuestionDisplayState {
  question: Question;
  questionNumber: number;
  maxQuestions: number;
  patternConfidences?: Record<string, number>;
}

export interface QuestionDisplayHandlers {
  onAnswer: (questionId: string, answerValue: string) => void;
  onSkip: (questionId: string) => void;
  onEndQuestioning: () => void;
}

export function renderQuestionDisplay(
  container: HTMLElement,
  state: QuestionDisplayState,
  handlers: QuestionDisplayHandlers
): () => void {
  container.innerHTML = '';
  container.className = 'question-display-root';

  const header = document.createElement('div');
  header.className = 'qd-header';

  const title = document.createElement('h1');
  title.className = 'qd-title';
  title.textContent = 'Follow-up Questions';

  const subtitle = document.createElement('p');
  subtitle.className = 'qd-subtitle';
  subtitle.textContent = 'Ask the patient, then tap their answer below.';

  const progressWrap = document.createElement('div');
  progressWrap.className = 'qd-progress-wrap';

  const progressBar = document.createElement('div');
  progressBar.className = 'qd-progress-bar';

  const progressFill = document.createElement('div');
  progressFill.className = 'qd-progress-fill';
  const pct = (state.questionNumber / state.maxQuestions) * 100;
  progressFill.style.width = `${pct}%`;

  const progressLabel = document.createElement('div');
  progressLabel.className = 'qd-progress-label';
  progressLabel.textContent = `Question ${state.questionNumber} of ${state.maxQuestions}`;

  progressBar.appendChild(progressFill);
  progressWrap.appendChild(progressBar);
  progressWrap.appendChild(progressLabel);

  header.appendChild(title);
  header.appendChild(subtitle);
  header.appendChild(progressWrap);

  const questionCard = document.createElement('div');
  questionCard.className = 'qd-card';

  const categoryBadge = document.createElement('span');
  categoryBadge.className = 'qd-category';
  categoryBadge.textContent = formatCategory(state.question.category);

  const questionText = document.createElement('p');
  questionText.className = 'qd-question-text';
  questionText.textContent = state.question.questionText;

  const optionsWrap = document.createElement('div');
  optionsWrap.className = 'qd-options';

  const optionButtons: HTMLButtonElement[] = [];

  function selectOption(btn: HTMLButtonElement, value: string) {
    optionButtons.forEach((b) => b.classList.remove('qd-option--selected'));
    btn.classList.add('qd-option--selected');
    handlers.onAnswer(state.question.id, value);
  }

  for (const option of state.question.answerOptions) {
    const btn = document.createElement('button');
    btn.className = 'qd-option';
    btn.textContent = formatOptionLabel(option);
    btn.addEventListener('click', () => selectOption(btn, option));
    optionsWrap.appendChild(btn);
    optionButtons.push(btn);
  }

  questionCard.appendChild(categoryBadge);
  questionCard.appendChild(questionText);
  questionCard.appendChild(optionsWrap);

  const bottomBar = document.createElement('div');
  bottomBar.className = 'qd-bottom-bar';

  const skipBtn = document.createElement('button');
  skipBtn.className = 'qd-btn-skip';
  skipBtn.textContent = 'Skip';
  skipBtn.addEventListener('click', () => {
    handlers.onSkip(state.question.id);
  });

  const endBtn = document.createElement('button');
  endBtn.className = 'qd-btn-end';
  endBtn.textContent = 'End questioning';
  endBtn.addEventListener('click', () => {
    handlers.onEndQuestioning();
  });

  bottomBar.appendChild(skipBtn);
  bottomBar.appendChild(endBtn);

  container.appendChild(header);
  container.appendChild(questionCard);
  container.appendChild(bottomBar);

  return () => {
    // cleanup handled by innerHTML replacement on next render
  };
}

function formatCategory(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatOptionLabel(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

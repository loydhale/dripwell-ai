import '../styles/camera.css';
import '../styles/questions.css';
import '../styles/recommendations.css';
import '../styles/safety.css';
import { renderCameraCapture } from '../components/CameraCapture.js';
import { renderQuestionDisplay } from '../components/QuestionDisplay.js';
import { renderRecommendationPreview } from '../components/RecommendationPreview.js';
import { renderSafetyFlagDisplay } from '../components/SafetyFlagDisplay.js';
import type { Question } from '../components/QuestionDisplay.js';
import type { RecommendationPreviewState, PatternDetail } from '../components/RecommendationPreview.js';
import type { SafetyFlag, SafetyFlagDisplayState } from '../components/SafetyFlagDisplay.js';
import { type PhotoAngle } from '../components/ARGuideOverlay.js';

export interface AssessmentFlowState {
  assessmentId: string;
  apiBaseUrl?: string;
  token?: string;
}

export interface AssessmentFlowHandlers {
  onComplete: () => void;
  onCancel?: () => void;
}

const ALL_ANGLES: PhotoAngle[] = ['FACE', 'UNDER_EYES', 'HAND_FOREARM', 'TONGUE'];

export function renderAssessmentFlow(
  container: HTMLElement,
  state: AssessmentFlowState,
  handlers: AssessmentFlowHandlers
): () => void {
  let currentAngleIndex = 0;
  let currentCleanup: (() => void) | null = null;
  let completed: PhotoAngle[] = [];
  let skipped: PhotoAngle[] = [];
  let phase: 'photos' | 'questions' | 'safety' | 'recommendation' = 'photos';

  container.innerHTML = '';
  container.className = 'assessment-flow-root';

  const header = document.createElement('div');
  header.className = 'af-header';

  const title = document.createElement('h1');
  title.className = 'af-title';
  title.textContent = 'Photo Capture';

  const subtitle = document.createElement('p');
  subtitle.className = 'af-subtitle';
  subtitle.textContent = 'Capture all required angles. Each photo uploads immediately.';

  const progressSteps = document.createElement('div');
  progressSteps.className = 'af-progress-steps';

  header.appendChild(title);
  header.appendChild(subtitle);
  header.appendChild(progressSteps);

  const contentSlot = document.createElement('div');
  contentSlot.className = 'af-camera-slot';

  const bottomBar = document.createElement('div');
  bottomBar.className = 'af-bottom-bar';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'af-btn-cancel';
  cancelBtn.textContent = 'Cancel assessment';

  const nextBtn = document.createElement('button');
  nextBtn.className = 'af-btn-next';
  nextBtn.textContent = 'Continue to questions';
  nextBtn.style.display = 'none';

  bottomBar.appendChild(cancelBtn);
  bottomBar.appendChild(nextBtn);

  const statusMsg = document.createElement('div');
  statusMsg.className = 'af-status-msg';

  container.appendChild(header);
  container.appendChild(contentSlot);
  container.appendChild(statusMsg);
  container.appendChild(bottomBar);

  function renderSteps() {
    progressSteps.innerHTML = '';
    ALL_ANGLES.forEach((angle, idx) => {
      const step = document.createElement('div');
      step.className = 'af-step';
      if (idx === currentAngleIndex) step.classList.add('af-step--active');
      if (completed.includes(angle)) step.classList.add('af-step--done');
      if (skipped.includes(angle)) step.classList.add('af-step--skipped');

      const dot = document.createElement('span');
      dot.className = 'af-step-dot';
      dot.textContent = String(idx + 1);

      const label = document.createElement('span');
      label.className = 'af-step-label';
      label.textContent = angle.replace('_', ' ');

      step.appendChild(dot);
      step.appendChild(label);
      progressSteps.appendChild(step);
    });
  }

  function updateStatus(text: string) {
    statusMsg.textContent = text;
  }

  function clearContent() {
    if (currentCleanup) {
      currentCleanup();
      currentCleanup = null;
    }
    contentSlot.innerHTML = '';
  }

  function mountCameraForAngle(angle: PhotoAngle) {
    clearContent();
    renderSteps();

    currentCleanup = renderCameraCapture(
      contentSlot,
      {
        angle,
        assessmentId: state.assessmentId,
        apiBaseUrl: state.apiBaseUrl,
        token: state.token,
      },
      {
        onComplete: (completedAngle, _result) => {
          if (!completed.includes(completedAngle)) {
            completed.push(completedAngle);
          }
          updateStatus(`${completedAngle.replace('_', ' ')} uploaded successfully.`);
          renderSteps();
          advanceAngle();
        },
        onSkip: (skippedAngle) => {
          if (!skipped.includes(skippedAngle)) {
            skipped.push(skippedAngle);
          }
          updateStatus(`${skippedAngle.replace('_', ' ')} skipped.`);
          renderSteps();
          advanceAngle();
        },
      }
    );
  }

  function advanceAngle() {
    let nextIndex = currentAngleIndex + 1;
    while (nextIndex < ALL_ANGLES.length && (completed.includes(ALL_ANGLES[nextIndex]) || skipped.includes(ALL_ANGLES[nextIndex]))) {
      nextIndex += 1;
    }

    if (nextIndex >= ALL_ANGLES.length) {
      // All angles done
      clearContent();
      const doneMsg = document.createElement('div');
      doneMsg.className = 'af-done-msg';
      doneMsg.innerHTML = `
        <div class="af-done-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h2>All photos captured</h2>
        <p>${completed.length} uploaded, ${skipped.length} skipped.</p>
      `;
      contentSlot.appendChild(doneMsg);
      nextBtn.style.display = '';
      updateStatus('');
      renderSteps();
      return;
    }

    currentAngleIndex = nextIndex;
    mountCameraForAngle(ALL_ANGLES[currentAngleIndex]);
  }

  // -------------------------------------------------------------------------
  // Questioning phase
  // -------------------------------------------------------------------------

  async function fetchNextQuestion(): Promise<{
    question: Question | null;
    progress: { questionNumber: number; maxQuestions: number };
    shouldTerminate: boolean;
    terminationReason: string | null;
  }> {
    const base = state.apiBaseUrl || '';
    const url = `${base}/assessments/${state.assessmentId}/next-question`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${state.token || ''}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch next question: ${res.status}`);
    }
    return res.json();
  }

  async function postAnswer(questionId: string, answerValue: string, skipped: boolean) {
    const base = state.apiBaseUrl || '';
    const url = `${base}/assessments/${state.assessmentId}/answer`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${state.token || ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ questionId, answerValue, skipped }),
    });
    if (!res.ok) {
      throw new Error(`Failed to post answer: ${res.status}`);
    }
    return res.json();
  }

  async function postEndQuestioning() {
    const base = state.apiBaseUrl || '';
    const url = `${base}/assessments/${state.assessmentId}/end-questioning`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${state.token || ''}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to end questioning: ${res.status}`);
    }
    return res.json();
  }

  async function fetchSafetyFlags(): Promise<{ flags: SafetyFlag[]; hasUnacknowledgedTier3: boolean }> {
    const base = state.apiBaseUrl || '';
    const url = `${base}/assessments/${state.assessmentId}/safety-flags`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${state.token || ''}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch safety flags: ${res.status}`);
    }
    return res.json();
  }

  async function postAcknowledgeFlag(flagId: string): Promise<void> {
    const base = state.apiBaseUrl || '';
    const url = `${base}/assessments/${state.assessmentId}/safety-flags/${flagId}/acknowledge`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${state.token || ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ acknowledged: true }),
    });
    if (!res.ok) {
      throw new Error(`Failed to acknowledge flag: ${res.status}`);
    }
  }

  async function fetchRecommendation(): Promise<{ recommendation: Omit<RecommendationPreviewState, 'patterns'>; patterns: PatternDetail[] }> {
    const base = state.apiBaseUrl || '';
    const url = `${base}/assessments/${state.assessmentId}/generate-recommendation`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${state.token || ''}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to generate recommendation: ${res.status}`);
    }
    return res.json();
  }

  async function startQuestioning() {
    phase = 'questions';
    title.textContent = 'Follow-up Questions';
    subtitle.textContent = 'Ask the patient, then tap their answer.';
    progressSteps.style.display = 'none';
    nextBtn.style.display = 'none';
    bottomBar.style.display = 'none';
    updateStatus('');

    try {
      const data = await fetchNextQuestion();
      if (data.shouldTerminate || !data.question) {
        finishQuestioning();
        return;
      }
      showQuestion(data.question, data.progress);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      updateStatus(`Error loading questions: ${message}`);
    }
  }

  function showQuestion(question: Question, progress: { questionNumber: number; maxQuestions: number }) {
    clearContent();
    currentCleanup = renderQuestionDisplay(
      contentSlot,
      { question, questionNumber: progress.questionNumber, maxQuestions: progress.maxQuestions },
      {
        onAnswer: async (questionId, answerValue) => {
          try {
            const data = await postAnswer(questionId, answerValue, false);
            if (data.shouldTerminate || !data.nextQuestion) {
              finishQuestioning();
              return;
            }
            showQuestion(data.nextQuestion, {
              questionNumber: data.nextQuestion.progress?.questionNumber || progress.questionNumber + 1,
              maxQuestions: progress.maxQuestions,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            updateStatus(`Error saving answer: ${message}`);
          }
        },
        onSkip: async (questionId) => {
          try {
            const data = await postAnswer(questionId, 'skipped', true);
            if (data.shouldTerminate || !data.nextQuestion) {
              finishQuestioning();
              return;
            }
            showQuestion(data.nextQuestion, {
              questionNumber: data.nextQuestion.progress?.questionNumber || progress.questionNumber + 1,
              maxQuestions: progress.maxQuestions,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            updateStatus(`Error skipping question: ${message}`);
          }
        },
        onEndQuestioning: async () => {
          try {
            await postEndQuestioning();
            finishQuestioning();
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            updateStatus(`Error ending questioning: ${message}`);
          }
        },
      }
    );
  }

  function finishQuestioning() {
    clearContent();
    const doneMsg = document.createElement('div');
    doneMsg.className = 'af-done-msg';
    doneMsg.innerHTML = `
      <div class="af-done-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <h2>Assessment complete</h2>
      <p>Photo analysis and questioning finished.</p>
    `;
    contentSlot.appendChild(doneMsg);

    bottomBar.style.display = 'flex';
    nextBtn.style.display = '';
    nextBtn.textContent = 'Continue to safety review';
    nextBtn.onclick = () => {
      showSafetyFlags();
    };
  }

  async function showSafetyFlags() {
    phase = 'safety';
    clearContent();
    title.textContent = 'Safety Review';
    subtitle.textContent = 'Reviewing safety flags before generating recommendation...';
    progressSteps.style.display = 'none';
    bottomBar.style.display = 'none';
    updateStatus('Loading safety flags...');

    try {
      const data = await fetchSafetyFlags();
      updateStatus('');
      clearContent();

      const flagState: SafetyFlagDisplayState = {
        flags: data.flags,
        hasUnacknowledgedTier3: data.hasUnacknowledgedTier3,
      };

      currentCleanup = renderSafetyFlagDisplay(
        contentSlot,
        flagState,
        {
          onAcknowledge: async (flagId) => {
            try {
              await postAcknowledgeFlag(flagId);
              // Re-fetch and re-render
              const refreshed = await fetchSafetyFlags();
              const refreshedState: SafetyFlagDisplayState = {
                flags: refreshed.flags,
                hasUnacknowledgedTier3: refreshed.hasUnacknowledgedTier3,
              };
              clearContent();
              currentCleanup = renderSafetyFlagDisplay(contentSlot, refreshedState, {
                onAcknowledge: async (fid) => {
                  await postAcknowledgeFlag(fid);
                  const r2 = await fetchSafetyFlags();
                  const s2: SafetyFlagDisplayState = {
                    flags: r2.flags,
                    hasUnacknowledgedTier3: r2.hasUnacknowledgedTier3,
                  };
                  clearContent();
                  currentCleanup = renderSafetyFlagDisplay(contentSlot, s2, {
                    onAcknowledge: async (f2) => {
                      await postAcknowledgeFlag(f2);
                      const r3 = await fetchSafetyFlags();
                      const s3: SafetyFlagDisplayState = {
                        flags: r3.flags,
                        hasUnacknowledgedTier3: r3.hasUnacknowledgedTier3,
                      };
                      clearContent();
                      currentCleanup = renderSafetyFlagDisplay(contentSlot, s3, {
                        onAcknowledge: async (f3) => {
                          await postAcknowledgeFlag(f3);
                          showSafetyFlags();
                        },
                        onProceed: () => showRecommendation(),
                      });
                    },
                    onProceed: () => showRecommendation(),
                  });
                },
                onProceed: () => showRecommendation(),
              });
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              updateStatus(`Error acknowledging flag: ${message}`);
            }
          },
          onProceed: () => showRecommendation(),
        }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      updateStatus(`Error loading safety flags: ${message}`);
      // Allow proceeding to recommendation even if safety flags fail to load
      bottomBar.style.display = 'flex';
      nextBtn.style.display = '';
      nextBtn.textContent = 'Skip to recommendation';
      nextBtn.onclick = () => showRecommendation();
    }
  }

  async function showRecommendation() {
    phase = 'recommendation';
    clearContent();
    title.textContent = 'Recommendation';
    subtitle.textContent = 'Review the system-generated recommendation.';
    progressSteps.style.display = 'none';
    bottomBar.style.display = 'none';
    updateStatus('Generating recommendation...');

    try {
      const data = await fetchRecommendation();
      updateStatus('');
      clearContent();

      const previewState: RecommendationPreviewState = {
        recommendationId: data.recommendation.recommendationId,
        primaryItem: data.recommendation.primaryItem,
        alternatives: data.recommendation.alternatives,
        confidence: data.recommendation.confidence,
        rationale: data.recommendation.rationale,
        patternName: data.recommendation.patternName,
        genericIntent: data.recommendation.genericIntent,
        patterns: data.patterns,
      };

      currentCleanup = renderRecommendationPreview(
        contentSlot,
        previewState,
        {
          onApprove: () => {
            handlers.onComplete();
          },
          onReject: () => {
            updateStatus('Recommendation rejected. Provider will select manually.');
            bottomBar.style.display = 'flex';
            nextBtn.style.display = '';
            nextBtn.textContent = 'Finish';
            nextBtn.onclick = () => {
              handlers.onComplete();
            };
          },
          onModify: () => {
            updateStatus('Modification requested. Provider override flow coming in TASK-010.');
          },
        }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      updateStatus(`Error generating recommendation: ${message}`);
    }
  }

  // Event handlers
  cancelBtn.addEventListener('click', () => {
    if (handlers.onCancel) handlers.onCancel();
  });

  nextBtn.addEventListener('click', () => {
    if (phase === 'photos') {
      startQuestioning();
    }
  });

  // Start at the first angle that is not already done
  let startIndex = 0;
  while (startIndex < ALL_ANGLES.length && (completed.includes(ALL_ANGLES[startIndex]) || skipped.includes(ALL_ANGLES[startIndex]))) {
    startIndex += 1;
  }

  if (startIndex >= ALL_ANGLES.length) {
    currentAngleIndex = ALL_ANGLES.length - 1;
    advanceAngle();
  } else {
    currentAngleIndex = startIndex;
    mountCameraForAngle(ALL_ANGLES[startIndex]);
  }

  return () => {
    clearContent();
  };
}

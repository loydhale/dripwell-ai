import '../styles/camera.css';
import '../styles/questions.css';
import '../styles/recommendations.css';
import '../styles/safety.css';
import '../styles/provider.css';
import '../styles/vitals.css';
import '../styles/consent.css';
import { renderCameraCapture } from '../components/CameraCapture.js';
import { renderQuestionDisplay } from '../components/QuestionDisplay.js';
import { renderSafetyFlagDisplay } from '../components/SafetyFlagDisplay.js';
import { renderProviderReview } from '../components/ProviderReview.js';
import { renderPatientOutput } from '../components/PatientOutput.js';
import { renderVitalsInput } from '../components/VitalsInput.js';
import { renderConsentForm } from '../components/ConsentForm.js';
import type { Question } from '../components/QuestionDisplay.js';
import type { PatternDetail } from '../components/RecommendationPreview.js';
import type { SafetyFlag, SafetyFlagDisplayState } from '../components/SafetyFlagDisplay.js';
import type { ProviderReviewState } from '../components/ProviderReview.js';
import type { PatientOutputState } from '../components/PatientOutput.js';
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
  let phase: 'consent' | 'vitals' | 'photos' | 'questions' | 'safety' | 'recommendation' = 'consent';

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

  async function fetchRecommendation(): Promise<{ recommendation: ProviderReviewState; patterns: PatternDetail[] }> {
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

  async function getExistingRecommendation(): Promise<{ recommendation: ProviderReviewState; patterns: PatternDetail[] } | null> {
    const base = state.apiBaseUrl || '';
    const url = `${base}/assessments/${state.assessmentId}/recommendation`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${state.token || ''}`,
        'Content-Type': 'application/json',
      },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Failed to fetch recommendation: ${res.status}`);
    }
    return res.json();
  }

  async function postApprove(): Promise<{ patientOutput: PatientOutputState }> {
    const base = state.apiBaseUrl || '';
    const url = `${base}/assessments/${state.assessmentId}/approve`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${state.token || ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      throw new Error(`Failed to approve: ${res.status}`);
    }
    return res.json();
  }

  async function postOverride(reason: string, reasonNote: string, manualRecommendation: string): Promise<void> {
    const base = state.apiBaseUrl || '';
    const url = `${base}/assessments/${state.assessmentId}/override`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${state.token || ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason, reasonNote, manualRecommendation }),
    });
    if (!res.ok) {
      throw new Error(`Failed to override: ${res.status}`);
    }
  }

  async function postModify(changes: { rationale?: string; primaryCatalogItemId?: string }): Promise<void> {
    const base = state.apiBaseUrl || '';
    const url = `${base}/assessments/${state.assessmentId}/modify`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${state.token || ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(changes),
    });
    if (!res.ok) {
      throw new Error(`Failed to modify: ${res.status}`);
    }
  }

  async function postEscalate(reason: string, notes: string): Promise<{ patientOutput: PatientOutputState }> {
    const base = state.apiBaseUrl || '';
    const url = `${base}/assessments/${state.assessmentId}/escalate`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${state.token || ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason, notes }),
    });
    if (!res.ok) {
      throw new Error(`Failed to escalate: ${res.status}`);
    }
    return res.json();
  }

  async function postDefer(reason: string, followUpDate: string, notes: string): Promise<{ patientOutput: PatientOutputState }> {
    const base = state.apiBaseUrl || '';
    const url = `${base}/assessments/${state.assessmentId}/defer`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${state.token || ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason, followUpDate, notes }),
    });
    if (!res.ok) {
      throw new Error(`Failed to defer: ${res.status}`);
    }
    return res.json();
  }

  // -------------------------------------------------------------------------
  // Consent phase
  // -------------------------------------------------------------------------

  function startConsent() {
    phase = 'consent';
    title.textContent = 'Informed Consent';
    subtitle.textContent = 'Both provider and patient must confirm before proceeding.';
    progressSteps.style.display = 'none';
    nextBtn.style.display = 'none';
    bottomBar.style.display = 'none';
    updateStatus('');
    clearContent();

    currentCleanup = renderConsentForm(
      contentSlot,
      {
        assessmentId: state.assessmentId,
        apiBaseUrl: state.apiBaseUrl,
        token: state.token,
      },
      {
        onComplete: () => {
          startVitals();
        },
      }
    );
  }

  // -------------------------------------------------------------------------
  // Vitals phase
  // -------------------------------------------------------------------------

  function startVitals() {
    phase = 'vitals';
    title.textContent = 'Vitals Capture';
    subtitle.textContent = 'Record patient vitals before photo capture.';
    progressSteps.style.display = 'none';
    nextBtn.style.display = 'none';
    bottomBar.style.display = 'none';
    updateStatus('');
    clearContent();

    currentCleanup = renderVitalsInput(
      contentSlot,
      {
        assessmentId: state.assessmentId,
        apiBaseUrl: state.apiBaseUrl,
        token: state.token,
      },
      {
        onComplete: (_vitals, _safetyFlagged) => {
          startPhotos();
        },
        onSkip: () => {
          startPhotos();
        },
      }
    );
  }

  function startPhotos() {
    phase = 'photos';
    title.textContent = 'Photo Capture';
    subtitle.textContent = 'Capture all required angles. Each photo uploads immediately.';
    progressSteps.style.display = '';
    bottomBar.style.display = 'flex';
    nextBtn.style.display = 'none';
    updateStatus('');
    clearContent();

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
    title.textContent = 'Provider Approval Review';
    subtitle.textContent = 'Review the AI recommendation, safety flags, and approve or override before patient delivery.';
    progressSteps.style.display = 'none';
    bottomBar.style.display = 'none';
    updateStatus('Generating recommendation...');

    try {
      let data = await getExistingRecommendation();
      if (!data) {
        data = await fetchRecommendation();
      }
      updateStatus('');
      clearContent();

      // Fetch safety flags for display in review
      let flags: SafetyFlag[] = [];
      try {
        const flagData = await fetchSafetyFlags();
        flags = flagData.flags;
      } catch {
        flags = [];
      }

      const reviewState: ProviderReviewState = {
        assessmentId: state.assessmentId,
        recommendationId: data.recommendation.recommendationId,
        primaryItem: data.recommendation.primaryItem,
        alternatives: data.recommendation.alternatives,
        confidence: data.recommendation.confidence,
        rationale: data.recommendation.rationale,
        patternName: data.recommendation.patternName,
        genericIntent: data.recommendation.genericIntent,
        patterns: data.patterns,
        flags,
      };

      currentCleanup = renderProviderReview(
        contentSlot,
        reviewState,
        {
          onApprove: async () => {
            try {
              updateStatus('Approving recommendation...');
              const result = await postApprove();
              showPatientOutput(result.patientOutput);
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              updateStatus(`Approval failed: ${message}`);
            }
          },
          onOverride: async (reason, reasonNote, manualRecommendation) => {
            try {
              updateStatus('Recording override...');
              await postOverride(reason, reasonNote, manualRecommendation);
              clearContent();
              const msg = document.createElement('div');
              msg.className = 'af-done-msg';
              msg.innerHTML = `
                <div class="af-done-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
                <h2>Recommendation overridden</h2>
                <p>Your override has been recorded for model learning.</p>
              `;
              contentSlot.appendChild(msg);
              bottomBar.style.display = 'flex';
              nextBtn.style.display = '';
              nextBtn.textContent = 'Finish';
              nextBtn.onclick = () => handlers.onComplete();
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              updateStatus(`Override failed: ${message}`);
            }
          },
          onModify: async (changes) => {
            try {
              updateStatus('Applying modification...');
              await postModify(changes);
              // Re-fetch to show updated recommendation
              const refreshed = await getExistingRecommendation();
              if (refreshed) {
                clearContent();
                const refreshedReviewState: ProviderReviewState = {
                  assessmentId: state.assessmentId,
                  recommendationId: refreshed.recommendation.recommendationId,
                  primaryItem: refreshed.recommendation.primaryItem,
                  alternatives: refreshed.recommendation.alternatives,
                  confidence: refreshed.recommendation.confidence,
                  rationale: refreshed.recommendation.rationale,
                  patternName: refreshed.recommendation.patternName,
                  genericIntent: refreshed.recommendation.genericIntent,
                  patterns: refreshed.patterns,
                  flags,
                };
                currentCleanup = renderProviderReview(contentSlot, refreshedReviewState, {
                  onApprove: async () => {
                    try {
                      updateStatus('Approving recommendation...');
                      const result = await postApprove();
                      showPatientOutput(result.patientOutput);
                    } catch (err) {
                      const message = err instanceof Error ? err.message : String(err);
                      updateStatus(`Approval failed: ${message}`);
                    }
                  },
                  onOverride: async (reason, reasonNote, manualRecommendation) => {
                    try {
                      updateStatus('Recording override...');
                      await postOverride(reason, reasonNote, manualRecommendation);
                      clearContent();
                      const msg = document.createElement('div');
                      msg.className = 'af-done-msg';
                      msg.innerHTML = `
                        <div class="af-done-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                        </div>
                        <h2>Recommendation overridden</h2>
                        <p>Your override has been recorded for model learning.</p>
                      `;
                      contentSlot.appendChild(msg);
                      bottomBar.style.display = 'flex';
                      nextBtn.style.display = '';
                      nextBtn.textContent = 'Finish';
                      nextBtn.onclick = () => handlers.onComplete();
                    } catch (err) {
                      const message = err instanceof Error ? err.message : String(err);
                      updateStatus(`Override failed: ${message}`);
                    }
                  },
                  onModify: async (c) => {
                    try {
                      updateStatus('Applying modification...');
                      await postModify(c);
                      showRecommendation();
                    } catch (err) {
                      const message = err instanceof Error ? err.message : String(err);
                      updateStatus(`Modify failed: ${message}`);
                    }
                  },
                  onEscalate: async (reason, notes) => {
                    try {
                      updateStatus('Recording escalation...');
                      const result = await postEscalate(reason, notes);
                      showPatientOutput(result.patientOutput);
                    } catch (err) {
                      const message = err instanceof Error ? err.message : String(err);
                      updateStatus(`Escalation failed: ${message}`);
                    }
                  },
                  onDefer: async (reason, followUpDate, notes) => {
                    try {
                      updateStatus('Recording deferral...');
                      const result = await postDefer(reason, followUpDate, notes);
                      showPatientOutput(result.patientOutput);
                    } catch (err) {
                      const message = err instanceof Error ? err.message : String(err);
                      updateStatus(`Deferral failed: ${message}`);
                    }
                  },
                });
              }
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              updateStatus(`Modify failed: ${message}`);
            }
          },
          onEscalate: async (reason, notes) => {
            try {
              updateStatus('Recording escalation...');
              const result = await postEscalate(reason, notes);
              showPatientOutput(result.patientOutput);
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              updateStatus(`Escalation failed: ${message}`);
            }
          },
          onDefer: async (reason, followUpDate, notes) => {
            try {
              updateStatus('Recording deferral...');
              const result = await postDefer(reason, followUpDate, notes);
              showPatientOutput(result.patientOutput);
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              updateStatus(`Deferral failed: ${message}`);
            }
          },
        }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      updateStatus(`Error loading recommendation: ${message}`);
    }
  }

  function showPatientOutput(patientOutput: PatientOutputState) {
    clearContent();
    title.textContent = 'Patient Summary';
    subtitle.textContent = 'Provider-approved, plain-language output for the patient.';
    progressSteps.style.display = 'none';
    bottomBar.style.display = 'none';
    updateStatus('');

    currentCleanup = renderPatientOutput(
      contentSlot,
      patientOutput,
      {
        onFinish: () => {
          handlers.onComplete();
        },
        onBack: () => {
          showRecommendation();
        },
      }
    );
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

  // Start with consent
  startConsent();

  return () => {
    clearContent();
  };
}

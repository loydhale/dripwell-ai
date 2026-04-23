import '../styles/camera.css';
import { renderCameraCapture } from '../components/CameraCapture.js';
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

  const cameraSlot = document.createElement('div');
  cameraSlot.className = 'af-camera-slot';

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
  container.appendChild(cameraSlot);
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

  function mountCameraForAngle(angle: PhotoAngle) {
    if (currentCleanup) {
      currentCleanup();
      currentCleanup = null;
    }
    cameraSlot.innerHTML = '';
    renderSteps();

    currentCleanup = renderCameraCapture(
      cameraSlot,
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
      if (currentCleanup) {
        currentCleanup();
        currentCleanup = null;
      }
      cameraSlot.innerHTML = '';
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
      cameraSlot.appendChild(doneMsg);
      nextBtn.style.display = '';
      updateStatus('');
      renderSteps();
      return;
    }

    currentAngleIndex = nextIndex;
    mountCameraForAngle(ALL_ANGLES[currentAngleIndex]);
  }

  cancelBtn.addEventListener('click', () => {
    if (handlers.onCancel) handlers.onCancel();
  });

  nextBtn.addEventListener('click', () => {
    handlers.onComplete();
  });

  // Start at the first angle that is not already done
  let startIndex = 0;
  while (startIndex < ALL_ANGLES.length && (completed.includes(ALL_ANGLES[startIndex]) || skipped.includes(ALL_ANGLES[startIndex]))) {
    startIndex += 1;
  }

  if (startIndex >= ALL_ANGLES.length) {
    // All already done
    currentAngleIndex = ALL_ANGLES.length - 1;
    advanceAngle();
  } else {
    currentAngleIndex = startIndex;
    mountCameraForAngle(ALL_ANGLES[startIndex]);
  }

  return () => {
    if (currentCleanup) {
      currentCleanup();
      currentCleanup = null;
    }
  };
}

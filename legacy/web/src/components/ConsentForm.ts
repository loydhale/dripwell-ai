export interface ConsentData {
  photoCaptureConsent: boolean;
  audioRecordingConsent: boolean;
  providerSignature: boolean;
  patientInitials: boolean;
}

export interface ConsentFormState {
  assessmentId: string;
  apiBaseUrl?: string;
  token?: string;
}

export interface ConsentFormHandlers {
  onComplete: () => void;
}

export function renderConsentForm(
  container: HTMLElement,
  state: ConsentFormState,
  handlers: ConsentFormHandlers
): () => void {
  container.innerHTML = '';
  container.className = 'consent-form-root';

  const header = document.createElement('div');
  header.className = 'cf-header';

  const title = document.createElement('h1');
  title.className = 'cf-title';
  title.textContent = 'Informed Consent';

  const subtitle = document.createElement('p');
  subtitle.className = 'cf-subtitle';
  subtitle.textContent = 'Both provider and patient must confirm before proceeding with the assessment.';

  header.appendChild(title);
  header.appendChild(subtitle);

  const form = document.createElement('div');
  form.className = 'cf-form';

  function makeCheckbox(id: string, label: string, required: boolean) {
    const wrap = document.createElement('div');
    wrap.className = 'cf-checkbox-wrap';

    const row = document.createElement('label');
    row.className = 'cf-checkbox-row';
    row.htmlFor = id;

    const input = document.createElement('input');
    input.className = 'cf-checkbox-input';
    input.id = id;
    input.type = 'checkbox';

    const text = document.createElement('span');
    text.className = 'cf-checkbox-text';
    text.textContent = label + (required ? ' *' : '');

    row.appendChild(input);
    row.appendChild(text);

    const error = document.createElement('div');
    error.className = 'cf-checkbox-error';
    error.style.display = 'none';

    wrap.appendChild(row);
    wrap.appendChild(error);

    return { wrap, input, error };
  }

  const photoConsent = makeCheckbox(
    'consent-photo',
    'I consent to photo capture for wellness assessment',
    true
  );

  const audioConsent = makeCheckbox(
    'consent-audio',
    'I consent to audio recording of this session',
    true
  );

  const providerSig = makeCheckbox(
    'consent-provider',
    'Provider confirms they have explained the assessment process',
    true
  );

  const patientInit = makeCheckbox(
    'consent-patient',
    'Patient initials confirm understanding and agreement',
    true
  );

  form.appendChild(photoConsent.wrap);
  form.appendChild(audioConsent.wrap);
  form.appendChild(providerSig.wrap);
  form.appendChild(patientInit.wrap);

  const errorMsg = document.createElement('div');
  errorMsg.className = 'cf-error-msg';
  errorMsg.style.display = 'none';

  const bottomBar = document.createElement('div');
  bottomBar.className = 'cf-bottom-bar';

  const submitBtn = document.createElement('button');
  submitBtn.className = 'cf-btn-submit';
  submitBtn.textContent = 'Confirm and proceed';

  bottomBar.appendChild(submitBtn);

  container.appendChild(header);
  container.appendChild(form);
  container.appendChild(errorMsg);
  container.appendChild(bottomBar);

  submitBtn.addEventListener('click', async () => {
    errorMsg.style.display = 'none';
    errorMsg.textContent = '';

    let hasError = false;

    function checkRequired(checkbox: { input: HTMLInputElement; error: HTMLElement }, label: string) {
      checkbox.error.style.display = 'none';
      if (!checkbox.input.checked) {
        checkbox.error.textContent = `${label} is required`;
        checkbox.error.style.display = 'block';
        hasError = true;
      }
    }

    checkRequired(photoConsent, 'Photo capture consent');
    checkRequired(audioConsent, 'Audio recording consent');
    checkRequired(providerSig, 'Provider signature');
    checkRequired(patientInit, 'Patient initials');

    if (hasError) {
      return;
    }

    const consent: ConsentData = {
      photoCaptureConsent: photoConsent.input.checked,
      audioRecordingConsent: audioConsent.input.checked,
      providerSignature: providerSig.input.checked,
      patientInitials: patientInit.input.checked,
    };

    try {
      const base = state.apiBaseUrl || '';
      const url = `${base}/assessments/${state.assessmentId}/consent`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${state.token || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(consent),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Failed to save consent: ${res.status}`);
      }
      handlers.onComplete();
    } catch (err) {
      errorMsg.textContent = err instanceof Error ? err.message : 'Failed to save consent';
      errorMsg.style.display = 'block';
    }
  });

  return () => {
    container.innerHTML = '';
  };
}

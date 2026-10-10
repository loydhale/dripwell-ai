export interface VitalsData {
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  pulse: number;
  spo2: number;
  temperature?: number;
  respiratoryRate?: number;
  weight?: number;
}

export interface VitalsInputState {
  assessmentId: string;
  apiBaseUrl?: string;
  token?: string;
}

export interface VitalsInputHandlers {
  onComplete: (vitals: VitalsData, safetyFlagged: boolean) => void;
  onSkip?: () => void;
}

export function renderVitalsInput(
  container: HTMLElement,
  state: VitalsInputState,
  handlers: VitalsInputHandlers
): () => void {
  container.innerHTML = '';
  container.className = 'vitals-input-root';

  const header = document.createElement('div');
  header.className = 'vi-header';

  const title = document.createElement('h1');
  title.className = 'vi-title';
  title.textContent = 'Vitals Capture';

  const subtitle = document.createElement('p');
  subtitle.className = 'vi-subtitle';
  subtitle.textContent = 'Record patient vitals before photo capture. Required fields are marked.';

  header.appendChild(title);
  header.appendChild(subtitle);

  const form = document.createElement('div');
  form.className = 'vi-form';

  function makeField(label: string, id: string, opts: { type?: string; min?: number; max?: number; required?: boolean; placeholder?: string } = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'vi-field';

    const lbl = document.createElement('label');
    lbl.className = 'vi-field-label';
    lbl.htmlFor = id;
    lbl.textContent = label + (opts.required ? ' *' : '');

    const input = document.createElement('input');
    input.className = 'vi-field-input';
    input.id = id;
    input.type = opts.type || 'number';
    if (opts.min !== undefined) input.min = String(opts.min);
    if (opts.max !== undefined) input.max = String(opts.max);
    if (opts.placeholder) input.placeholder = opts.placeholder;

    const error = document.createElement('div');
    error.className = 'vi-field-error';
    error.style.display = 'none';

    wrap.appendChild(lbl);
    wrap.appendChild(input);
    wrap.appendChild(error);

    return { wrap, input, error };
  }

  // Blood pressure row
  const bpRow = document.createElement('div');
  bpRow.className = 'vi-row';

  const bpSys = makeField('Systolic BP', 'bp-systolic', { min: 70, max: 220, required: true, placeholder: 'e.g. 120' });
  const bpDia = makeField('Diastolic BP', 'bp-diastolic', { min: 40, max: 140, required: true, placeholder: 'e.g. 80' });

  bpRow.appendChild(bpSys.wrap);
  bpRow.appendChild(bpDia.wrap);

  // Pulse and SpO2 row
  const pulseRow = document.createElement('div');
  pulseRow.className = 'vi-row';

  const pulse = makeField('Pulse (bpm)', 'pulse', { min: 40, max: 200, required: true, placeholder: 'e.g. 72' });
  const spo2 = makeField('SpO2 (%)', 'spo2', { min: 70, max: 100, required: true, placeholder: 'e.g. 98' });

  pulseRow.appendChild(pulse.wrap);
  pulseRow.appendChild(spo2.wrap);

  // Optional fields row
  const optionalRow = document.createElement('div');
  optionalRow.className = 'vi-row';

  const temp = makeField('Temperature (F)', 'temperature', { min: 95, max: 108, placeholder: 'e.g. 98.6' });
  const resp = makeField('Respiratory Rate', 'respiratory-rate', { min: 8, max: 60, placeholder: 'e.g. 16' });
  const weight = makeField('Weight (lbs)', 'weight', { min: 50, max: 600, placeholder: 'e.g. 170' });

  optionalRow.appendChild(temp.wrap);
  optionalRow.appendChild(resp.wrap);
  optionalRow.appendChild(weight.wrap);

  form.appendChild(bpRow);
  form.appendChild(pulseRow);
  form.appendChild(optionalRow);

  const safetyAlert = document.createElement('div');
  safetyAlert.className = 'vi-safety-alert';
  safetyAlert.style.display = 'none';

  const bottomBar = document.createElement('div');
  bottomBar.className = 'vi-bottom-bar';

  const skipBtn = document.createElement('button');
  skipBtn.className = 'vi-btn-skip';
  skipBtn.textContent = 'Skip vitals';

  const submitBtn = document.createElement('button');
  submitBtn.className = 'vi-btn-submit';
  submitBtn.textContent = 'Save vitals and continue';

  bottomBar.appendChild(skipBtn);
  bottomBar.appendChild(submitBtn);

  container.appendChild(header);
  container.appendChild(form);
  container.appendChild(safetyAlert);
  container.appendChild(bottomBar);

  function validateField(input: HTMLInputElement, error: HTMLElement, label: string, min: number, max: number, required: boolean): number | null {
    error.style.display = 'none';
    error.textContent = '';
    input.classList.remove('vi-field-input--error');

    const value = input.value.trim();
    if (!value) {
      if (required) {
        error.textContent = `${label} is required`;
        error.style.display = 'block';
        input.classList.add('vi-field-input--error');
        return null;
      }
      return null;
    }

    const num = Number(value);
    if (Number.isNaN(num)) {
      error.textContent = `${label} must be a number`;
      error.style.display = 'block';
      input.classList.add('vi-field-input--error');
      return null;
    }

    if (num < min || num > max) {
      error.textContent = `${label} must be between ${min} and ${max}`;
      error.style.display = 'block';
      input.classList.add('vi-field-input--error');
      return null;
    }

    return num;
  }

  function checkSafetyFlags(vitals: VitalsData): string[] {
    const flags: string[] = [];
    if (vitals.spo2 < 92) {
      flags.push(`SpO2 is ${vitals.spo2}%, below 92% threshold`);
    }
    if (vitals.bloodPressureSystolic > 180 || vitals.bloodPressureDiastolic > 110) {
      flags.push(`Blood pressure is ${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic}, above 180/110 threshold`);
    }
    if (vitals.pulse > 120) {
      flags.push(`Pulse is ${vitals.pulse} bpm, above 120 threshold`);
    }
    return flags;
  }

  submitBtn.addEventListener('click', async () => {
    safetyAlert.style.display = 'none';
    safetyAlert.innerHTML = '';

    const bpSysVal = validateField(bpSys.input, bpSys.error, 'Systolic BP', 70, 220, true);
    const bpDiaVal = validateField(bpDia.input, bpDia.error, 'Diastolic BP', 40, 140, true);
    const pulseVal = validateField(pulse.input, pulse.error, 'Pulse', 40, 200, true);
    const spo2Val = validateField(spo2.input, spo2.error, 'SpO2', 70, 100, true);

    if (bpSysVal === null || bpDiaVal === null || pulseVal === null || spo2Val === null) {
      return;
    }

    const tempVal = validateField(temp.input, temp.error, 'Temperature', 95, 108, false);
    const respVal = validateField(resp.input, resp.error, 'Respiratory Rate', 8, 60, false);
    const weightVal = validateField(weight.input, weight.error, 'Weight', 50, 600, false);

    const vitals: VitalsData = {
      bloodPressureSystolic: bpSysVal,
      bloodPressureDiastolic: bpDiaVal,
      pulse: pulseVal,
      spo2: spo2Val,
    };

    if (tempVal !== null) vitals.temperature = tempVal;
    if (respVal !== null) vitals.respiratoryRate = respVal;
    if (weightVal !== null) vitals.weight = weightVal;

    const safetyFlags = checkSafetyFlags(vitals);

    if (safetyFlags.length > 0) {
      safetyAlert.innerHTML = `
        <div class="vi-safety-title">Safety flags detected</div>
        <ul class="vi-safety-list">
          ${safetyFlags.map((f) => `<li>${f}</li>`).join('')}
        </ul>
        <div class="vi-safety-note">You may proceed, but these vitals will be flagged for review.</div>
      `;
      safetyAlert.style.display = 'block';
    }

    // Persist to API
    try {
      const base = state.apiBaseUrl || '';
      const url = `${base}/assessments/${state.assessmentId}/vitals`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${state.token || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(vitals),
      });
      if (!res.ok) {
        throw new Error(`Failed to save vitals: ${res.status}`);
      }
      handlers.onComplete(vitals, safetyFlags.length > 0);
    } catch (err) {
      safetyAlert.textContent = err instanceof Error ? err.message : 'Failed to save vitals';
      safetyAlert.style.display = 'block';
    }
  });

  skipBtn.addEventListener('click', () => {
    if (handlers.onSkip) handlers.onSkip();
  });

  return () => {
    container.innerHTML = '';
  };
}

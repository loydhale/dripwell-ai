import { post } from '../lib/api.js';

interface GenerateDescResult {
  description: string;
}

export interface AiDescriptionModalCallbacks {
  onSave: (description: string) => void;
  onClose: () => void;
}

export interface AiDescriptionModalProps {
  name: string;
  type: string;
  ingredients: string[];
  currentDescription?: string;
}

export function renderAiDescriptionModal(
  props: AiDescriptionModalProps,
  callbacks: AiDescriptionModalCallbacks
): () => void {
  let description = props.currentDescription || '';
  let isGenerating = false;

  const overlay = document.createElement('div');
  overlay.className = 'admin-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'admin-modal';
  modal.style.maxWidth = '560px';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  function close() {
    overlay.remove();
    callbacks.onClose();
  }

  function render() {
    modal.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'admin-modal-header';
    header.innerHTML = `<h3>AI Description: ${props.name}</h3>`;
    modal.appendChild(header);

    const body = document.createElement('div');
    body.className = 'admin-modal-body';

    body.innerHTML = `
      <div style="margin-bottom:12px;font-size:13px;color:var(--text-2)">
        <strong>Type:</strong> ${props.type}<br>
        <strong>Ingredients:</strong> ${props.ingredients.length > 0 ? props.ingredients.join(', ') : 'None'}
      </div>
      <div class="admin-form-row">
        <label>Description</label>
        <textarea id="ai-desc-textarea" rows="5" style="width:100%;font-size:14px;padding:8px 12px;border:1px solid var(--line-2);border-radius:6px;resize:vertical">${description}</textarea>
      </div>
      <div style="font-size:12px;color:var(--text-3);margin-top:4px">
        You can edit the description above. Click "Generate with AI" to create a new one.
      </div>
    `;

    const textarea = body.querySelector<HTMLTextAreaElement>('#ai-desc-textarea')!;
    textarea.addEventListener('input', () => {
      description = textarea.value;
    });

    modal.appendChild(body);

    const footer = document.createElement('div');
    footer.className = 'admin-modal-footer';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'admin-btn admin-btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', close);
    footer.appendChild(cancelBtn);

    const generateBtn = document.createElement('button');
    generateBtn.className = 'admin-btn admin-btn-secondary';
    generateBtn.textContent = isGenerating ? 'Generating...' : 'Generate with AI';
    generateBtn.disabled = isGenerating;
    generateBtn.addEventListener('click', async () => {
      isGenerating = true;
      render();

      try {
        const res = await post<GenerateDescResult>('/catalog/generate-description', {
          name: props.name,
          ingredients: props.ingredients,
          type: props.type,
        });
        description = res.description;
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Description generation failed');
      } finally {
        isGenerating = false;
        render();
      }
    });
    footer.appendChild(generateBtn);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'admin-btn admin-btn-primary';
    saveBtn.textContent = 'Save Description';
    saveBtn.addEventListener('click', () => {
      callbacks.onSave(description.trim());
      close();
    });
    footer.appendChild(saveBtn);

    modal.appendChild(footer);
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  render();

  return () => {
    overlay.remove();
  };
}

import { kycState } from '../state.js';

const REQUIRED_PERSONAL_FIELDS = [
  'first_name',
  'last_name',
  'date_of_birth',
  'nationality',
  'country',
  'document_type',
  'document_number',
  'email',
  'phone'
];

export function renderStepReview() {
  const container = document.getElementById('step-content');
  container.innerHTML = '';

  const { valid, errors } = validateKyc();

  const wrapper = document.createElement('div');
  wrapper.className = 'docs-wrapper';

  wrapper.innerHTML = `
    <div class="docs-title">Review & Submit</div>
    <div class="docs-subtitle">
      Verifica que toda tu información y documentos estén completos antes de enviarlos a validación.
    </div>

    <div class="docs-grid" id="review-grid"></div>

    <div style="margin-top:32px; text-align:right;">
      <button id="submitKycBtn" class="doc-upload-btn" ${!valid ? 'disabled' : ''}>
        Enviar verificación
      </button>
    </div>
  `;

  container.appendChild(wrapper);

  const grid = wrapper.querySelector('#review-grid');

  renderPersonalReview(grid, errors);
  renderDocumentsReview(grid, errors);
  renderSelfieReview(grid, errors);
  renderCompanyReview(grid, errors);

  const btn = wrapper.querySelector('#submitKycBtn');
  if (valid) {
    btn.onclick = submitKyc;
  }
}

/* ================= VALIDACIÓN ================= */

function validateKyc() {
  const errors = [];

  // Personal
  REQUIRED_PERSONAL_FIELDS.forEach(f => {
    if (!kycState.personal[f]) {
      errors.push(`personal.${f}`);
    }
  });

  // Docs personales
  kycState.documents.forEach(d => {
    if (!d.uploaded) {
      errors.push(`document.${d.document_type_id}`);
    }
  });

  // Selfie
  if (!kycState.selfie.uploaded) {
    errors.push('selfie');
  }

  // Empresa (si existe)
  if (kycState.company.legal_name) {
    if (!kycState.company.tax_id) errors.push('company.tax_id');
    if (!kycState.company.incorporation_country) errors.push('company.incorporation_country');

    kycState.companyDocuments.forEach(d => {
      if (!d.uploaded) {
        errors.push(`companyDocument.${d.document_type_id}`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/* ================= RENDER ================= */

function createCard(title, desc, ok, fileName) {
  const div = document.createElement('div');
  div.className = 'doc-card ' + (ok ? 'doc-uploaded' : 'doc-required');

  div.innerHTML = `
    <div>
      <div class="doc-title">${title} ${!ok ? '<span class="doc-required-badge">Required</span>' : ''}</div>
      <div class="doc-desc">${desc}</div>
      ${
        ok
          ? `<div class="doc-file">${fileName || 'Uploaded'}</div>`
          : `<div class="doc-missing">Missing</div>`
      }
    </div>
  `;

  return div;
}

function renderPersonalReview(grid, errors) {
  const ok = !errors.some(e => e.startsWith('personal.'));
  grid.appendChild(createCard(
    'Personal Information',
    'Datos personales del titular',
    ok
  ));
}

function renderDocumentsReview(grid, errors) {
  kycState.documents.forEach(d => {
    const ok = d.uploaded;
    grid.appendChild(createCard(
      `Document ${d.document_type_id}`,
      'Documento de identidad',
      ok,
      d.file?.name
    ));
  });
}

function renderSelfieReview(grid, errors) {
  const ok = kycState.selfie.uploaded;
  grid.appendChild(createCard(
    'Biometric Selfie',
    'Verificación facial',
    ok,
    kycState.selfie.file?.name
  ));
}

function renderCompanyReview(grid, errors) {
  if (!kycState.company.legal_name) return;

  const ok = !errors.some(e => e.startsWith('company.'));
  grid.appendChild(createCard(
    'Company Data',
    'Información legal de la empresa',
    ok
  ));

  kycState.companyDocuments.forEach(d => {
    grid.appendChild(createCard(
      `Company Doc ${d.document_type_id}`,
      'Documento empresarial',
      d.uploaded,
      d.file?.name
    ));
  });
}

/* ================= SUBMIT ================= */

async function submitKyc() {
  try {
    kycState.meta.submitting = true;

    const res = await fetch('/api/kyc/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(kycState)
    });

    if (!res.ok) throw new Error('Submit failed');

    kycState.meta.status = 'submitted';
    kycState.meta.lastSavedAt = new Date().toISOString();

    document.getElementById('step-content').innerHTML = `
      <div class="docs-wrapper">
        <div class="docs-title">Verification in progress</div>
        <div class="docs-subtitle">
          Tus documentos fueron enviados correctamente.  
          Nuestro equipo los revisará y recibirás un correo cuando tu cuenta esté habilitada.
        </div>
      </div>
    `;

  } catch (e) {
    alert('Error enviando KYC');
  } finally {
    kycState.meta.submitting = false;
  }
}

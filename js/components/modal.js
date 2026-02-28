/* js/components/modal.js — Reusable confirmation modal */

let activeModal = null;

export function showModal({ title, message, confirmLabel = 'Confirm', confirmClass = 'btn-danger', cancelLabel = 'Cancel', onConfirm, onCancel }) {
  closeModal();

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-title" id="modal-title">${title}</div>
      <div class="modal-message">${message}</div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="modal-cancel">${cancelLabel}</button>
        <button class="btn ${confirmClass}" id="modal-confirm">${confirmLabel}</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  activeModal = backdrop;

  // Trigger animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => backdrop.classList.add('visible'));
  });

  backdrop.querySelector('#modal-cancel').addEventListener('click', () => {
    closeModal();
    onCancel?.();
  });

  backdrop.querySelector('#modal-confirm').addEventListener('click', () => {
    closeModal();
    onConfirm?.();
  });

  return backdrop;
}

export function closeModal() {
  if (!activeModal) return;
  const m = activeModal;
  activeModal = null;
  m.classList.remove('visible');
  setTimeout(() => m.remove(), 220);
}

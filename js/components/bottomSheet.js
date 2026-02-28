/* js/components/bottomSheet.js — Bottom sheet with drag dismiss and dirty state guard */

import { showModal } from './modal.js';

export class BottomSheet {
  constructor({ id, onClose }) {
    this.id = id;
    this.onClose = onClose;
    this.isDirty = false;
    this.el = null;
    this.overlay = document.getElementById('overlay');
    this._dragStart = null;
    this._dragCurrent = null;
    this._bound = {};
  }

  create(contentHTML) {
    // Remove existing
    this.destroy();

    this.el = document.createElement('div');
    this.el.className = 'bottom-sheet';
    this.el.id = this.id;
    this.el.innerHTML = `
      <div class="sheet-drag-handle" aria-hidden="true"></div>
      ${contentHTML}
    `;

    document.getElementById('app').appendChild(this.el);
    this._attachDrag();
    this._attachOverlayTap();

    // Open
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.el.classList.add('open');
        this.overlay.classList.add('visible');
        document.body.style.overflow = 'hidden';
      });
    });

    return this.el;
  }

  _attachDrag() {
    const handle = this.el.querySelector('.sheet-drag-handle');
    // Also allow drag from the top area
    const dragZone = this.el;

    this._bound.touchstart = e => this._onTouchStart(e);
    this._bound.touchmove  = e => this._onTouchMove(e);
    this._bound.touchend   = e => this._onTouchEnd(e);

    dragZone.addEventListener('touchstart', this._bound.touchstart, { passive: true });
    dragZone.addEventListener('touchmove',  this._bound.touchmove,  { passive: false });
    dragZone.addEventListener('touchend',   this._bound.touchend);
  }

  _onTouchStart(e) {
    // Only start drag from the handle or top 50px of sheet
    const target = e.target;
    const sheetRect = this.el.getBoundingClientRect();
    const touchY = e.touches[0].clientY;
    // Allow drag from top 60px of sheet
    if (touchY > sheetRect.top + 60 && !target.classList.contains('sheet-drag-handle')) return;

    this._dragStart   = e.touches[0].clientY;
    this._dragCurrent = this._dragStart;
    this.el.style.transition = 'none';
  }

  _onTouchMove(e) {
    if (this._dragStart === null) return;
    this._dragCurrent = e.touches[0].clientY;
    const dy = Math.max(0, this._dragCurrent - this._dragStart);
    this.el.style.transform = `translateX(-50%) translateY(${dy}px)`;
    if (dy > 5) e.preventDefault();
  }

  _onTouchEnd() {
    if (this._dragStart === null) return;
    const dy = Math.max(0, this._dragCurrent - this._dragStart);
    const sheetH = this.el.offsetHeight;
    this.el.style.transition = '';

    if (dy > sheetH * 0.4) {
      // Dismiss
      this._attemptClose();
    } else {
      // Spring back
      this.el.style.transform = 'translateX(-50%) translateY(0)';
    }

    this._dragStart = null;
    this._dragCurrent = null;
  }

  _attachOverlayTap() {
    this._bound.overlayTap = () => this._attemptClose();
    this.overlay.addEventListener('click', this._bound.overlayTap);
  }

  _attemptClose() {
    if (this.isDirty) {
      showModal({
        title: 'Discard unsaved changes?',
        message: 'Any text you\'ve entered will be lost.',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep Editing',
        confirmClass: 'btn-danger',
        onConfirm: () => this.close(),
      });
    } else {
      this.close();
    }
  }

  close() {
    if (!this.el) return;
    this.el.classList.remove('open');
    this.overlay.classList.remove('visible');
    document.body.style.overflow = '';

    setTimeout(() => {
      this.destroy();
      this.onClose?.();
    }, 360);
  }

  destroy() {
    if (this.overlay && this._bound.overlayTap) {
      this.overlay.removeEventListener('click', this._bound.overlayTap);
    }
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }

  markDirty()  { this.isDirty = true; }
  markClean()  { this.isDirty = false; }
}

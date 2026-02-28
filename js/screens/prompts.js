/* js/screens/prompts.js — Prompts & Starred screens */

import { savePrompt, deletePrompt } from '../db.js';
import { filterAndSort } from '../utils/search.js';
import { generateUUID } from '../utils/uuid.js';
import { BottomSheet } from '../components/bottomSheet.js';
import { TagInput } from '../components/tagInput.js';
import { showModal } from '../components/modal.js';
import { icon } from '../utils/icons.js';

const PAGE_SIZE = 30;

export class PromptsScreen {
  constructor(app, { starredOnly = false } = {}) {
    this.app        = app;       // reference to App instance (has state)
    this.starredOnly = starredOnly;
    this.el         = null;
    this.searchQuery = '';
    this.activeTagIds= [];
    this.tagLogic    = 'AND';
    this.visibleCount= PAGE_SIZE;
    this.activeSheet = null;
    this._searchDebounce = null;
  }

  mount(container) {
    this.el = container;
    this.render();
  }

  render() {
    this.el.innerHTML = `
      <div class="screen-header">
        <span class="app-title">GP Prompt Database</span>
        ${this.starredOnly ? '' : `<button class="header-action-btn" id="add-prompt-btn" aria-label="Add prompt">${icon('plus')}</button>`}
      </div>

      <div class="search-bar-container">
        <div class="search-bar-inner">
          <span class="search-icon">${icon('search')}</span>
          <input type="text" id="search-input" class="form-input" placeholder="Search prompts…" autocomplete="off" autocorrect="off" spellcheck="false">
          <button class="search-clear-btn" id="search-clear" aria-label="Clear search">${icon('x')}</button>
        </div>
      </div>

      <div class="tag-filter-row" id="tag-filter-row">
        <div class="tag-chips-wrap" id="tag-chips-wrap"></div>
      </div>

      <div class="prompt-list-container scrollable" id="prompt-list-container">
        <div class="prompt-list" id="prompt-list"></div>
      </div>
    `;

    this._bindSearch();
    this._bindScroll();
    if (!this.starredOnly) {
      this.el.querySelector('#add-prompt-btn')?.addEventListener('click', () => this.openAddSheet());
    }

    this.refresh();
  }

  refresh() {
    this._renderFilterChips();
    this._renderList();
  }

  /* ---- Tag Filter Chips ---- */
  _renderFilterChips() {
    const wrap = this.el.querySelector('#tag-chips-wrap');
    if (!wrap) return;

    const { tags } = this.app.state;
    const activeCount = this.activeTagIds.length;

    let html = '';

    // "All" chip — only when filters active
    if (activeCount > 0 || this.searchQuery) {
      html += `<button class="tag-chip chip-all" data-action="clear">✕ Clear</button>`;
    }

    // Starred chip — only on main screen
    if (!this.starredOnly) {
      const starActive = this.activeTagIds.includes('__starred__');
      html += `<button class="tag-chip chip-starred ${starActive ? 'active' : ''}" data-action="starred">⭐ Starred</button>`;
    }

    // Tag chips
    const sorted = [...tags].sort((a, b) => {
      if (a.color && !b.color) return -1;
      if (!a.color && b.color) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const t of sorted) {
      const active = this.activeTagIds.includes(t.id);
      const dot = t.color ? `<span class="chip-dot" style="background:${t.color}"></span>` : '';
      html += `<button class="tag-chip ${active ? 'active' : ''} ${t.color ? 'colored' : ''}" data-tag-id="${t.id}">${dot}${t.name}</button>`;
    }

    // AND/OR toggle
    const showToggle = activeCount >= 2;
    html += `<div class="and-or-toggle ${showToggle ? 'visible' : ''}" id="and-or-toggle">
      <button class="and-or-btn ${this.tagLogic === 'AND' ? 'active' : ''}" data-logic="AND">AND</button>
      <button class="and-or-btn ${this.tagLogic === 'OR'  ? 'active' : ''}" data-logic="OR">OR</button>
    </div>`;

    wrap.innerHTML = html;

    // Bind chip events
    wrap.querySelectorAll('.tag-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const action = chip.dataset.action;
        const tagId  = chip.dataset.tagId;

        chip.style.transform = 'scale(0.94)';
        setTimeout(() => chip.style.transform = '', 180);

        if (action === 'clear') {
          this.activeTagIds = [];
          this.searchQuery  = '';
          const inp = this.el.querySelector('#search-input');
          if (inp) inp.value = '';
          this.el.querySelector('#search-clear')?.classList.remove('visible');
        } else if (action === 'starred') {
          this._toggleTag('__starred__');
        } else if (tagId) {
          this._toggleTag(tagId);
        }

        this.visibleCount = PAGE_SIZE;
        this.refresh();
      });
    });

    wrap.querySelectorAll('.and-or-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.tagLogic = btn.dataset.logic;
        this.app.setSetting('tagLogic', this.tagLogic);
        this.visibleCount = PAGE_SIZE;
        this.refresh();
      });
    });
  }

  _toggleTag(id) {
    const idx = this.activeTagIds.indexOf(id);
    if (idx >= 0) this.activeTagIds.splice(idx, 1);
    else          this.activeTagIds.push(id);
  }

  /* ---- Prompt List ---- */
  _renderList() {
    const list = this.el.querySelector('#prompt-list');
    if (!list) return;

    const { prompts, tags } = this.app.state;

    // Handle starred pseudo-tag
    const isStarredFilter = this.activeTagIds.includes('__starred__');
    const realTagIds      = this.activeTagIds.filter(x => x !== '__starred__');

    const filtered = filterAndSort(prompts, tags, {
      searchQuery:  this.searchQuery,
      activeTagIds: realTagIds,
      tagLogic:     this.tagLogic,
      starredOnly:  this.starredOnly || isStarredFilter,
    });

    const page = filtered.slice(0, this.visibleCount);

    if (page.length === 0) {
      const msg = prompts.length === 0
        ? { title: 'No prompts yet', sub: 'Tap + to add your first prompt.' }
        : { title: 'No results found', sub: 'Try a different search or filter.' };
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">${icon('tag')}</div>
          <div class="empty-state-title">${msg.title}</div>
          <div class="empty-state-sub">${msg.sub}</div>
        </div>`;
      return;
    }

    const tagMap = Object.fromEntries(this.app.state.tags.map(t => [t.id, t]));

    list.innerHTML = page.map(p => this._promptItemHTML(p, tagMap)).join('');

    // Bind item events
    list.querySelectorAll('.prompt-item').forEach(item => {
      const id = item.dataset.id;

      // Open detail (anywhere except quick-copy btn)
      item.addEventListener('click', e => {
        if (e.target.closest('.quick-copy-btn')) return;
        this.openDetailSheet(id);
      });

      // Quick copy
      item.querySelector('.quick-copy-btn')?.addEventListener('click', e => {
        e.stopPropagation();
        this._quickCopy(id, item.querySelector('.quick-copy-btn'));
      });
    });

    // Load-more sentinel
    const hasMore = filtered.length > this.visibleCount;
    const sentinel = list.querySelector('#load-more-sentinel');
    if (sentinel && hasMore) {
      this._observeSentinel(sentinel);
    }
  }

  _promptItemHTML(p, tagMap) {
    const MAX_TAGS = 3;
    const tagChips = p.tags.slice(0, MAX_TAGS).map(tid => {
      const t = tagMap[tid];
      if (!t) return '';
      const dot = t.color ? `<span class="chip-dot" style="background:${t.color}"></span>` : '';
      return `<span class="tag-chip-sm">${dot}${t.name}</span>`;
    }).join('');

    const overflow = p.tags.length > MAX_TAGS ? `<span class="tags-overflow">+${p.tags.length - MAX_TAGS}</span>` : '';
    const copies   = p.copyCount > 0 ? `<span class="prompt-item-copy-count">· ${p.copyCount} ${p.copyCount === 1 ? 'copy' : 'copies'}</span>` : '';

    return `
      <div class="prompt-item" data-id="${p.id}">
        <div class="prompt-item-body">
          <div class="prompt-item-title">${escapeHtml(p.title)}</div>
          <div class="prompt-item-meta">
            <div class="prompt-item-tags"><div class="prompt-item-tags-inner">${tagChips}</div>${overflow}</div>
            ${copies}
          </div>
        </div>
        <button class="quick-copy-btn" aria-label="Copy prompt" data-id="${p.id}">
          ${icon('copy', 'icon-copy')}
          ${icon('check', 'icon-check')}
        </button>
      </div>
    `;
  }

  async _quickCopy(id, btn) {
    const prompt = this.app.state.prompts.find(p => p.id === id);
    if (!prompt) return;

    try {
      await navigator.clipboard.writeText(prompt.promptText);
    } catch {
      // Fallback for older Safari
      const ta = document.createElement('textarea');
      ta.value = prompt.promptText;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }

    btn.classList.add('copied');
    setTimeout(() => btn.classList.remove('copied'), 1500);

    // Increment copy count
    prompt.copyCount = (prompt.copyCount || 0) + 1;
    prompt.updatedAt = new Date().toISOString();
    await savePrompt(prompt);
    // Update count display in list
    const countEl = this.el.querySelector(`.prompt-item[data-id="${id}"] .prompt-item-copy-count`);
    if (countEl) countEl.textContent = `· ${prompt.copyCount} ${prompt.copyCount === 1 ? 'copy' : 'copies'}`;
    const metaEl = this.el.querySelector(`.prompt-item[data-id="${id}"] .prompt-item-meta`);
    if (metaEl && !countEl) {
      metaEl.insertAdjacentHTML('beforeend', `<span class="prompt-item-copy-count">· ${prompt.copyCount} copy</span>`);
    }
  }

  /* ---- Infinite scroll ---- */
  _observeSentinel(sentinel) {
    if (this._observer) this._observer.disconnect();
    this._observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        this.visibleCount += PAGE_SIZE;
        this._renderList();
      }
    }, { threshold: 0.1 });
    this._observer.observe(sentinel);
  }

  /* ---- Search ---- */
  _bindSearch() {
    const input = this.el.querySelector('#search-input');
    const clearBtn = this.el.querySelector('#search-clear');
    if (!input) return;

    input.addEventListener('input', () => {
      clearTimeout(this._searchDebounce);
      const val = input.value;
      clearBtn?.classList.toggle('visible', val.length > 0);
      this._searchDebounce = setTimeout(() => {
        this.searchQuery  = val;
        this.visibleCount = PAGE_SIZE;
        this.refresh();
      }, 150);
    });

    clearBtn?.addEventListener('click', () => {
      input.value = '';
      clearBtn.classList.remove('visible');
      this.searchQuery  = '';
      this.visibleCount = PAGE_SIZE;
      this.refresh();
      input.focus();
    });
  }

  _bindScroll() {
    // Scroll handled by IntersectionObserver sentinel
  }

  /* ---- Detail Sheet ---- */
  openDetailSheet(id) {
    const prompt = this.app.state.prompts.find(p => p.id === id);
    if (!prompt) return;

    this.activeSheet?.destroy();
    this.activeSheet = new BottomSheet({
      id: 'detail-sheet',
      onClose: () => { this.activeSheet = null; },
    });

    this._renderDetailContent(prompt);
  }

  _renderDetailContent(prompt) {
    const tagMap = Object.fromEntries(this.app.state.tags.map(t => [t.id, t]));
    const tagChips = prompt.tags.map(tid => {
      const t = tagMap[tid];
      if (!t) return '';
      const dot = t.color ? `<span class="chip-dot" style="background:${t.color}"></span>` : '';
      return `<span class="tag-chip-sm" style="background:${t.color ? t.color + '22' : 'var(--bg-elevated)'}; color:${t.color || 'var(--text-secondary)'}; padding:4px 10px;">${dot}${t.name}</span>`;
    }).join('');

    const createdDate = new Date(prompt.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const copyText = prompt.copyCount === 0 ? 'Never copied' : `Copied ${prompt.copyCount} ${prompt.copyCount === 1 ? 'time' : 'times'}`;

    const sheetEl = this.activeSheet.create(`
      <div class="sheet-header">
        <h2 class="sheet-title">${escapeHtml(prompt.title)}</h2>
        <button class="sheet-star-btn ${prompt.isStarred ? 'starred' : ''}" id="star-btn" aria-label="${prompt.isStarred ? 'Unstar' : 'Star'} prompt">
          ${icon('star')}
        </button>
      </div>
      <div class="sheet-body scrollable">
        <div class="sheet-tags-row">${tagChips || '<span style="color:var(--text-tertiary);font-size:13px;">No tags</span>'}</div>
        <div class="sheet-prompt-text" id="sheet-prompt-text">${escapeHtml(prompt.promptText)}</div>
        <div class="sheet-metadata">Created ${createdDate} · <span id="copy-count-label">${copyText}</span></div>
      </div>
      <div class="sheet-footer">
        <button class="btn btn-primary" id="copy-btn">
          ${icon('copy')} Copy Prompt
        </button>
        <div class="sheet-actions-row">
          <button class="btn btn-secondary" id="edit-btn">${icon('edit')} Edit</button>
          <button class="btn btn-danger-text" id="delete-btn">${icon('trash')} Delete</button>
        </div>
      </div>
    `);

    // Star
    sheetEl.querySelector('#star-btn').addEventListener('click', async () => {
      prompt.isStarred = !prompt.isStarred;
      prompt.updatedAt = new Date().toISOString();
      await savePrompt(prompt);
      const btn = sheetEl.querySelector('#star-btn');
      btn.classList.toggle('starred', prompt.isStarred);
      btn.setAttribute('aria-label', prompt.isStarred ? 'Unstar prompt' : 'Star prompt');
      this._renderList();
    });

    // Copy
    sheetEl.querySelector('#copy-btn').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(prompt.promptText);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = prompt.promptText;
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }

      const btn = sheetEl.querySelector('#copy-btn');
      const orig = btn.innerHTML;
      btn.innerHTML = `${icon('check')} Copied ✓`;
      btn.classList.add('success', 'copy-anim');
      setTimeout(() => {
        btn.innerHTML = orig;
        btn.classList.remove('success', 'copy-anim');
      }, 1800);

      prompt.copyCount = (prompt.copyCount || 0) + 1;
      prompt.updatedAt = new Date().toISOString();
      await savePrompt(prompt);

      const label = sheetEl.querySelector('#copy-count-label');
      if (label) label.textContent = `Copied ${prompt.copyCount} ${prompt.copyCount === 1 ? 'time' : 'times'}`;
      this._renderList();
    });

    // Edit
    sheetEl.querySelector('#edit-btn').addEventListener('click', () => {
      this._switchToEditMode(sheetEl, prompt);
    });

    // Delete
    sheetEl.querySelector('#delete-btn').addEventListener('click', () => {
      showModal({
        title: 'Delete prompt?',
        message: `"${prompt.title}" will be permanently deleted. This cannot be undone.`,
        confirmLabel: 'Delete',
        confirmClass: 'btn-danger',
        cancelLabel: 'Cancel',
        onConfirm: async () => {
          await deletePrompt(prompt.id);
          this.app.state.prompts = this.app.state.prompts.filter(p => p.id !== prompt.id);
          this.activeSheet?.close();
          this._renderList();
        },
      });
    });
  }

  _switchToEditMode(sheetEl, prompt) {
    this.activeSheet.markClean();
    const origTitle  = prompt.title;
    const origText   = prompt.promptText;
    const origTags   = [...prompt.tags];
    const origStarred= prompt.isStarred;

    sheetEl.innerHTML = `
      <div class="sheet-drag-handle" aria-hidden="true"></div>
      <div class="sheet-header" style="padding-bottom:8px;">
        <h2 class="sheet-title" style="font-size:17px;">Edit Prompt</h2>
        <button class="sheet-star-btn ${prompt.isStarred ? 'starred' : ''}" id="edit-star-btn" aria-label="Toggle star">
          ${icon('star')}
        </button>
      </div>
      <div class="sheet-body scrollable">
        <div class="form-group">
          <label class="form-label">Title</label>
          <input type="text" class="form-input form-title" id="edit-title" value="${escapeAttr(prompt.title)}" placeholder="Prompt title" autocorrect="off">
        </div>
        <div class="form-group">
          <label class="form-label">Prompt</label>
          <textarea class="form-input" id="edit-text" placeholder="Your prompt text…" rows="6">${escapeHtml(prompt.promptText)}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Tags</label>
          <div id="tag-input-container"></div>
        </div>
      </div>
      <div class="sheet-footer">
        <div class="sheet-actions-row">
          <button class="btn btn-secondary" id="edit-cancel">Cancel</button>
          <button class="btn btn-primary" id="edit-save">${icon('check')} Save</button>
        </div>
      </div>
    `;

    // Tag input
    const tagContainer = sheetEl.querySelector('#tag-input-container');
    const tagInput = new TagInput(tagContainer, this.app.state.tags, prompt.tags, (ids) => {
      this.activeSheet.markDirty();
    });

    // Dirty detection
    const titleEl = sheetEl.querySelector('#edit-title');
    const textEl  = sheetEl.querySelector('#edit-text');

    [titleEl, textEl].forEach(el => {
      el.addEventListener('input', () => this.activeSheet.markDirty());
    });

    // Auto-resize textarea
    autoResize(textEl);
    textEl.addEventListener('input', () => autoResize(textEl));

    // Star toggle
    sheetEl.querySelector('#edit-star-btn').addEventListener('click', () => {
      prompt.isStarred = !prompt.isStarred;
      sheetEl.querySelector('#edit-star-btn').classList.toggle('starred', prompt.isStarred);
      this.activeSheet.markDirty();
    });

    // Cancel
    sheetEl.querySelector('#edit-cancel').addEventListener('click', () => {
      // Restore
      prompt.title    = origTitle;
      prompt.promptText = origText;
      prompt.tags     = origTags;
      prompt.isStarred= origStarred;
      this.activeSheet.markClean();
      this._renderDetailContent(prompt);
    });

    // Save
    sheetEl.querySelector('#edit-save').addEventListener('click', async () => {
      const newTitle = titleEl.value.trim();
      const newText  = textEl.value.trim();
      if (!newTitle || !newText) return;

      prompt.title      = newTitle;
      prompt.promptText = newText;
      prompt.tags       = tagInput.getSelectedIds();
      prompt.updatedAt  = new Date().toISOString();

      await savePrompt(prompt);
      this.activeSheet.markClean();
      this._renderList();
      this._renderDetailContent(prompt);
    });
  }

  /* ---- Add Sheet ---- */
  openAddSheet() {
    this.activeSheet?.destroy();
    this.activeSheet = new BottomSheet({
      id: 'add-sheet',
      onClose: () => { this.activeSheet = null; },
    });

    const sheetEl = this.activeSheet.create(`
      <div class="sheet-header" style="padding-bottom:8px;">
        <h2 class="sheet-title" style="font-size:17px;">New Prompt</h2>
      </div>
      <div class="sheet-body scrollable">
        <div class="form-group">
          <label class="form-label">Title</label>
          <input type="text" class="form-input form-title" id="add-title" placeholder="Give it a clear title" autocorrect="off">
        </div>
        <div class="form-group">
          <label class="form-label">Prompt</label>
          <textarea class="form-input" id="add-text" placeholder="Your prompt text…" rows="6"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Tags</label>
          <div id="add-tag-container"></div>
        </div>
      </div>
      <div class="sheet-footer">
        <div class="sheet-actions-row">
          <button class="btn btn-secondary" id="add-cancel">Cancel</button>
          <button class="btn btn-primary" id="add-save" disabled>${icon('plus')} Save Prompt</button>
        </div>
      </div>
    `);

    const tagContainer = sheetEl.querySelector('#add-tag-container');
    const tagInput = new TagInput(tagContainer, this.app.state.tags, [], () => {
      this.activeSheet?.markDirty();
    });

    const titleEl = sheetEl.querySelector('#add-title');
    const textEl  = sheetEl.querySelector('#add-text');
    const saveBtn = sheetEl.querySelector('#add-save');

    autoResize(textEl);
    textEl.addEventListener('input', () => autoResize(textEl));

    function checkValidity() {
      const valid = titleEl.value.trim().length > 0 && textEl.value.trim().length > 0;
      saveBtn.disabled = !valid;
    }

    titleEl.addEventListener('input', () => { this.activeSheet.markDirty(); checkValidity(); });
    textEl.addEventListener('input',  () => { this.activeSheet.markDirty(); checkValidity(); });

    // Auto-focus title
    setTimeout(() => titleEl.focus(), 400);

    sheetEl.querySelector('#add-cancel').addEventListener('click', () => {
      this.activeSheet.markClean();
      this.activeSheet.close();
    });

    sheetEl.querySelector('#add-save').addEventListener('click', async () => {
      const title = titleEl.value.trim();
      const text  = textEl.value.trim();
      if (!title || !text) return;

      const now = new Date().toISOString();
      const newPrompt = {
        id:         generateUUID(),
        title,
        promptText: text,
        tags:       tagInput.getSelectedIds(),
        isStarred:  false,
        copyCount:  0,
        createdAt:  now,
        updatedAt:  now,
      };

      await savePrompt(newPrompt);
      this.app.state.prompts.unshift(newPrompt);
      this.activeSheet.markClean();
      this.activeSheet.close();
      this.visibleCount = PAGE_SIZE;
      this._renderList();
    });
  }
}

/* ---- Helpers ---- */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

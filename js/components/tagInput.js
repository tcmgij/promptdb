/* js/components/tagInput.js — Tag selector with autocomplete */

import { icon } from '../utils/icons.js';
import { generateUUID } from '../utils/uuid.js';
import { saveTag } from '../db.js';

export class TagInput {
  constructor(container, allTags, initialTagIds = [], onChange) {
    this.container    = container;
    this.allTags      = allTags;       // full array of tag objects
    this.selectedIds  = [...initialTagIds];
    this.onChange     = onChange;
    this._suggestVisible = false;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="tag-input-wrapper" id="tag-input-wrapper">
        <div class="tag-input-chips" id="tag-chips-area"></div>
        <input type="text" class="tag-text-input" id="tag-text-input" placeholder="Add tags…" autocomplete="off" autocorrect="off" spellcheck="false">
        <div class="tag-suggestions" id="tag-suggestions" style="display:none;"></div>
      </div>
    `;

    this._chipsArea  = this.container.querySelector('#tag-chips-area');
    this._textInput  = this.container.querySelector('#tag-text-input');
    this._suggestions= this.container.querySelector('#tag-suggestions');

    this._textInput.addEventListener('input', () => this._onInput());
    this._textInput.addEventListener('focus', () => this._onInput());
    this._textInput.addEventListener('blur',  () => setTimeout(() => this._hideSuggestions(), 150));
    this._textInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); this._selectFirstSuggestion(); }
    });

    this._renderChips();
  }

  _renderChips() {
    this._chipsArea.innerHTML = this.selectedIds.map(id => {
      const tag = this.allTags.find(t => t.id === id);
      if (!tag) return '';
      const dot = tag.color ? `<span class="chip-dot" style="background:${tag.color}"></span>` : '';
      return `
        <span class="tag-chip-removable" data-id="${tag.id}">
          ${dot}${tag.name}
          <span class="remove-tag" data-id="${tag.id}">${icon('x')}</span>
        </span>
      `;
    }).join('');

    this._chipsArea.querySelectorAll('.remove-tag').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.id;
        this.selectedIds = this.selectedIds.filter(x => x !== id);
        this._renderChips();
        this.onChange?.(this.selectedIds);
      });
    });
  }

  _onInput() {
    const q = this._textInput.value.trim().toLowerCase();
    const available = this.allTags.filter(t => !this.selectedIds.includes(t.id));

    let matches = q
      ? available.filter(t => t.name.toLowerCase().includes(q))
      : available.slice(0, 8);

    const exactMatch = available.find(t => t.name.toLowerCase() === q);
    const showCreate = q.length > 0 && !exactMatch;

    if (matches.length === 0 && !showCreate) { this._hideSuggestions(); return; }

    this._suggestions.style.display = 'block';
    this._suggestions.innerHTML = [
      ...matches.map(t => {
        const dot = t.color ? `<span class="sug-dot" style="background:${t.color}"></span>` : `<span class="sug-dot"></span>`;
        return `<div class="tag-suggestion-item" data-id="${t.id}">${dot}${t.name}</div>`;
      }),
      showCreate ? `<div class="tag-suggestion-item" data-create="${q}"><span class="sug-dot" style="background:var(--bg-elevated)"></span>Create "${q}" <span class="sug-create">+ New</span></div>` : '',
    ].join('');

    this._suggestions.querySelectorAll('.tag-suggestion-item').forEach(item => {
      item.addEventListener('mousedown', e => e.preventDefault());
      item.addEventListener('click', () => {
        if (item.dataset.create) {
          this._createTag(item.dataset.create);
        } else {
          this._selectTag(item.dataset.id);
        }
      });
    });
  }

  _selectTag(id) {
    if (!this.selectedIds.includes(id)) {
      this.selectedIds.push(id);
      this._renderChips();
      this.onChange?.(this.selectedIds);
    }
    this._textInput.value = '';
    this._hideSuggestions();
  }

  async _createTag(name) {
    const newTag = {
      id:   generateUUID(),
      name: name.trim(),
      color: null,
      isPredefined: false,
    };
    await saveTag(newTag);
    this.allTags.push(newTag);
    this._selectTag(newTag.id);
    // Notify app of new tag
    window.dispatchEvent(new CustomEvent('tag-created', { detail: newTag }));
  }

  _selectFirstSuggestion() {
    const first = this._suggestions.querySelector('.tag-suggestion-item');
    if (first) first.click();
  }

  _hideSuggestions() {
    this._suggestions.style.display = 'none';
  }

  getSelectedIds() { return this.selectedIds; }

  updateTags(tags) { this.allTags = tags; }
}

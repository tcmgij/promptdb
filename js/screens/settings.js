/* js/screens/settings.js */

import { saveTag, deleteTag, savePrompt, getAllTags } from '../db.js';
import { generateUUID } from '../utils/uuid.js';
import { exportToJSON, readJSONFile, validateImport, importData as importDB } from '../utils/exportImport.js';
import { showModal } from '../components/modal.js';
import { icon } from '../utils/icons.js';

const TAG_COLORS = [
  { name: 'coral',    hex: '#D4856A' },
  { name: 'amber',    hex: '#C9A05A' },
  { name: 'sage',     hex: '#7A9E7E' },
  { name: 'sky',      hex: '#7AA3B8' },
  { name: 'lavender', hex: '#9B8DB8' },
  { name: 'rose',     hex: '#C47B8E' },
  { name: 'teal',     hex: '#5B9EA0' },
  { name: 'ochre',    hex: '#B8924A' },
  { name: 'slate',    hex: '#7B8FA1' },
  { name: 'moss',     hex: '#6B8E6B' },
  { name: 'blush',    hex: '#C49B9B' },
  { name: 'sand',     hex: '#B5A080' },
];

export class SettingsScreen {
  constructor(app) {
    this.app = app;
    this.el  = null;
    this._editingTagId = null;
    this._showAddForm  = false;
  }

  mount(container) {
    this.el = container;
    this.render();
  }

  render() {
    this.el.innerHTML = `
      <div class="screen-header">
        <span class="app-title">Settings</span>
      </div>
      <div class="settings-content scrollable">
        <div class="settings-section">
          <div class="settings-section-title">Tag Manager</div>
          <div id="tag-manager-list" class="tag-manager-list"></div>
          <div id="add-tag-area" style="margin-top:10px;"></div>
          <button class="btn btn-secondary" id="add-tag-btn" style="margin-top:10px; width:100%; justify-content:center; gap:8px;">
            ${icon('plus')} Add Tag
          </button>
        </div>

        <div class="settings-section">
          <div class="settings-section-title">Data & Backup</div>
          <div class="backup-btn-row">
            <button class="btn" id="export-btn">
              ${icon('download')} Export to JSON
            </button>
            <button class="btn" id="import-btn">
              ${icon('upload')} Import from JSON
            </button>
            <input type="file" id="import-file" accept=".json" style="display:none;">
            <div class="import-status" id="import-status"></div>
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-section-title">About</div>
          <div class="about-section">
            <div class="about-version">GP Prompt Database v1.0.0</div>
            <div class="about-note">A personal AI prompt manager. All data stored locally on your device.</div>
          </div>
        </div>
      </div>
    `;

    this._renderTagList();
    this._bindExportImport();

    this.el.querySelector('#add-tag-btn').addEventListener('click', () => {
      this._showAddForm = true;
      this._editingTagId = null;
      this._renderTagList();
    });
  }

  refresh() {
    this._renderTagList();
  }

  _renderTagList() {
    const list = this.el?.querySelector('#tag-manager-list');
    const addArea = this.el?.querySelector('#add-tag-area');
    if (!list || !addArea) return;

    const { tags, prompts } = this.app.state;

    list.innerHTML = tags.map(t => {
      const usageCount = prompts.filter(p => p.tags.includes(t.id)).length;
      const isEditing  = this._editingTagId === t.id;

      if (isEditing) {
        return `
          <div class="tag-edit-form" id="tag-edit-${t.id}">
            <input type="text" class="tag-edit-input" id="tag-edit-name-${t.id}" value="${escapeAttr(t.name)}" placeholder="Tag name" autocorrect="off">
            <div class="color-swatches">
              <div class="color-swatch none-swatch ${!t.color ? 'selected' : ''}" data-color="" title="No color"></div>
              ${TAG_COLORS.map(c => `
                <div class="color-swatch ${t.color === c.hex ? 'selected' : ''}" style="background:${c.hex}" data-color="${c.hex}" title="${c.name}"></div>
              `).join('')}
            </div>
            <div class="tag-edit-actions">
              <button class="btn btn-secondary tag-edit-cancel" data-id="${t.id}">Cancel</button>
              <button class="btn btn-primary tag-edit-save" data-id="${t.id}">${icon('check')} Save</button>
            </div>
          </div>
        `;
      }

      return `
        <div class="tag-manager-item" data-id="${t.id}">
          <div class="tag-manager-swatch" style="${t.color ? `background:${t.color};border-color:${t.color}` : ''}"></div>
          <div class="tag-manager-name">${escapeHtml(t.name)}</div>
          <div class="tag-manager-count">${usageCount > 0 ? `${usageCount} prompt${usageCount === 1 ? '' : 's'}` : ''}</div>
          <div class="tag-manager-actions">
            <button class="icon-btn tag-edit-btn" data-id="${t.id}" aria-label="Edit tag">${icon('edit')}</button>
            <button class="icon-btn danger tag-delete-btn" data-id="${t.id}" aria-label="Delete tag">${icon('trash')}</button>
          </div>
        </div>
      `;
    }).join('');

    // Bind edit/delete
    list.querySelectorAll('.tag-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._editingTagId = btn.dataset.id;
        this._showAddForm  = false;
        this._renderTagList();
        setTimeout(() => {
          const inp = this.el.querySelector(`#tag-edit-name-${btn.dataset.id}`);
          inp?.focus();
        }, 50);
      });
    });

    list.querySelectorAll('.tag-edit-cancel').forEach(btn => {
      btn.addEventListener('click', () => {
        this._editingTagId = null;
        this._renderTagList();
      });
    });

    list.querySelectorAll('.tag-edit-save').forEach(btn => {
      btn.addEventListener('click', () => this._saveTagEdit(btn.dataset.id));
    });

    list.querySelectorAll('.color-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        sw.closest('.color-swatches').querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        sw.classList.add('selected');
      });
    });

    list.querySelectorAll('.tag-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => this._confirmDeleteTag(btn.dataset.id));
    });

    // Add form
    addArea.innerHTML = '';
    if (this._showAddForm) {
      addArea.innerHTML = `
        <div class="add-tag-form">
          <input type="text" class="tag-edit-input" id="new-tag-name" placeholder="Tag name" autocorrect="off" autofocus>
          <div class="color-swatches">
            <div class="color-swatch none-swatch selected" data-color="" title="No color"></div>
            ${TAG_COLORS.map(c => `
              <div class="color-swatch" style="background:${c.hex}" data-color="${c.hex}" title="${c.name}"></div>
            `).join('')}
          </div>
          <div class="tag-edit-actions">
            <button class="btn btn-secondary" id="new-tag-cancel">Cancel</button>
            <button class="btn btn-primary" id="new-tag-save">${icon('plus')} Add Tag</button>
          </div>
        </div>
      `;

      addArea.querySelectorAll('.color-swatch').forEach(sw => {
        sw.addEventListener('click', () => {
          addArea.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
          sw.classList.add('selected');
        });
      });

      addArea.querySelector('#new-tag-cancel').addEventListener('click', () => {
        this._showAddForm = false;
        this._renderTagList();
      });

      addArea.querySelector('#new-tag-save').addEventListener('click', () => this._createNewTag());

      setTimeout(() => addArea.querySelector('#new-tag-name')?.focus(), 50);
    }
  }

  async _saveTagEdit(id) {
    const form = this.el.querySelector(`#tag-edit-${id}`);
    if (!form) return;
    const name = form.querySelector(`#tag-edit-name-${id}`).value.trim();
    if (!name) return;
    const selectedColor = form.querySelector('.color-swatch.selected')?.dataset.color || null;

    const tag = this.app.state.tags.find(t => t.id === id);
    if (!tag) return;

    tag.name  = name;
    tag.color = selectedColor || null;
    await saveTag(tag);

    this._editingTagId = null;
    this._renderTagList();
    this.app.notifyTagsChanged();
  }

  async _createNewTag() {
    const nameEl = this.el.querySelector('#new-tag-name');
    const name   = nameEl?.value.trim();
    if (!name) return;

    const selectedColor = this.el.querySelector('.add-tag-form .color-swatch.selected')?.dataset.color || null;

    const newTag = {
      id:   generateUUID(),
      name,
      color: selectedColor || null,
      isPredefined: false,
    };

    await saveTag(newTag);
    this.app.state.tags.push(newTag);
    this._showAddForm = false;
    this._renderTagList();
    this.app.notifyTagsChanged();
  }

  _confirmDeleteTag(id) {
    const tag    = this.app.state.tags.find(t => t.id === id);
    if (!tag) return;
    const count  = this.app.state.prompts.filter(p => p.tags.includes(id)).length;
    const warning = count > 0
      ? `This tag is used by ${count} prompt${count === 1 ? '' : 's'}. Removing it will detach it from ${count === 1 ? 'that prompt' : 'those prompts'}.`
      : `"${tag.name}" will be permanently deleted.`;

    showModal({
      title: `Delete tag "${tag.name}"?`,
      message: warning,
      confirmLabel: 'Delete',
      confirmClass: 'btn-danger',
      cancelLabel: 'Cancel',
      onConfirm: async () => {
        await deleteTag(id);
        this.app.state.tags = this.app.state.tags.filter(t => t.id !== id);

        // Cleanup: remove this tagId from all prompts
        const affected = this.app.state.prompts.filter(p => p.tags.includes(id));
        for (const p of affected) {
          p.tags = p.tags.filter(tid => tid !== id);
          p.updatedAt = new Date().toISOString();
          await savePrompt(p);
        }

        this._renderTagList();
        this.app.notifyTagsChanged();
      },
    });
  }

  _bindExportImport() {
    const exportBtn   = this.el.querySelector('#export-btn');
    const importBtn   = this.el.querySelector('#import-btn');
    const fileInput   = this.el.querySelector('#import-file');
    const statusEl    = this.el.querySelector('#import-status');

    exportBtn?.addEventListener('click', () => {
      exportToJSON(this.app.state.prompts, this.app.state.tags);
    });

    importBtn?.addEventListener('click', () => {
      fileInput.value = '';
      fileInput.click();
    });

    fileInput?.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;

      showModal({
        title: 'Import backup?',
        message: 'This will replace ALL current prompts and tags with the imported data. This cannot be undone.',
        confirmLabel: 'Import & Replace',
        confirmClass: 'btn-danger',
        cancelLabel: 'Cancel',
        onConfirm: async () => {
          try {
            const data = await readJSONFile(file);
            validateImport(data);
            await importDB({ prompts: data.prompts, tags: data.tags });

            // Refresh state
            this.app.state.prompts = data.prompts;
            this.app.state.tags    = data.tags;

            statusEl.className = 'import-status success';
            statusEl.textContent = `✓ Imported ${data.prompts.length} prompts and ${data.tags.length} tags.`;

            this._renderTagList();
            this.app.notifyTagsChanged();
            this.app.refreshAllScreens();
          } catch (err) {
            statusEl.className = 'import-status error';
            statusEl.textContent = `Import failed: ${err.message}`;
          }
        },
      });
    });
  }
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

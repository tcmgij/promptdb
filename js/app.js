/* js/app.js — Main entry point for GP Prompt Database */

import { openDB, getAllPrompts, getAllTags, getSetting, setSetting } from './db.js';
import { PromptsScreen } from './screens/prompts.js';
import { SettingsScreen } from './screens/settings.js';
import { icon } from './utils/icons.js';

class App {
  constructor() {
    this.state = {
      prompts: [],
      tags:    [],
    };
    this.screens = {};
    this.activeTab = 'prompts';
  }

  async init() {
    await openDB();
    this.state.prompts = await getAllPrompts();
    this.state.tags    = await getAllTags();

    // Load persisted tagLogic setting
    const savedLogic = await getSetting('tagLogic');
    this._tagLogicDefault = savedLogic || 'AND';

    this._buildShell();
    this._mountScreens();
    this._bindNav();
    this._activateTab('prompts');
    this._registerServiceWorker();

    // Listen for tags created inline (from tag input)
    window.addEventListener('tag-created', e => {
      const tag = e.detail;
      if (!this.state.tags.find(t => t.id === tag.id)) {
        this.state.tags.push(tag);
      }
    });
  }

  _buildShell() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div id="screens">
        <div class="screen" id="screen-prompts" role="main"></div>
        <div class="screen" id="screen-starred" role="main"></div>
        <div class="screen" id="screen-settings" role="main"></div>
      </div>
      <div id="overlay" aria-hidden="true"></div>
      <nav id="bottom-nav" aria-label="Main navigation">
        <button class="nav-tab" data-tab="prompts" aria-label="Prompts">
          ${icon('list')}
          <span class="nav-label">Prompts</span>
        </button>
        <button class="nav-tab" data-tab="starred" aria-label="Starred">
          ${icon('star')}
          <span class="nav-label">Starred</span>
        </button>
        <button class="nav-tab" data-tab="settings" aria-label="Settings">
          ${icon('settings')}
          <span class="nav-label">Settings</span>
        </button>
      </nav>
    `;
  }

  _mountScreens() {
    const promptsScreen  = new PromptsScreen(this, { starredOnly: false });
    const starredScreen  = new PromptsScreen(this, { starredOnly: true });
    const settingsScreen = new SettingsScreen(this);

    promptsScreen.mount(document.getElementById('screen-prompts'));
    starredScreen.mount(document.getElementById('screen-starred'));
    settingsScreen.mount(document.getElementById('screen-settings'));

    // Apply initial tagLogic setting
    promptsScreen.tagLogic = this._tagLogicDefault;
    starredScreen.tagLogic = this._tagLogicDefault;

    this.screens = {
      prompts:  promptsScreen,
      starred:  starredScreen,
      settings: settingsScreen,
    };
  }

  _bindNav() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this._activateTab(tab.dataset.tab);
      });
    });
  }

  _activateTab(tabName) {
    this.activeTab = tabName;

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

    document.getElementById(`screen-${tabName}`)?.classList.add('active');
    document.querySelector(`.nav-tab[data-tab="${tabName}"]`)?.classList.add('active');

    // Refresh active screen data
    this.screens[tabName]?.refresh?.();
  }

  /* Called by SettingsScreen after tag changes */
  notifyTagsChanged() {
    this.screens.prompts?.refresh();
    this.screens.starred?.refresh();
  }

  /* Called after full import */
  refreshAllScreens() {
    Object.values(this.screens).forEach(s => s.refresh?.());
  }

  async setSetting(key, value) {
    await setSetting(key, value);
  }

  _registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').catch(err => {
        console.warn('Service Worker registration failed:', err);
      });
    }
  }
}

// Boot
const app = new App();
app.init().catch(console.error);

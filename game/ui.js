// ui.js - Professional UI management module
// Handles modals, transitions, overlays, score display, serve indicators, and in-game prompts.

export default class UI {
  constructor() {
    this.scorePlayer = document.querySelector('#score-player');
    this.scoreAI = document.querySelector('#score-ai');
    this.serveIndicator = document.querySelector('#serve-indicator');

    this.resultModal = document.querySelector('#result-modal');
    this.resultText = document.querySelector('#result-text');

    this.pauseModal = document.querySelector('#pause-modal');

    this.bindKeys();
  }

  // -----------------------------
  // Score Updates
  // -----------------------------
  updateScore(player, ai) {
    this.scorePlayer.innerText = player;
    this.scoreAI.innerText = ai;
  }

  // -----------------------------
  // Serve Indicator
  // -----------------------------
  setServe(turn) {
    if (turn === 'player') {
      this.serveIndicator.innerText = 'Your Serve';
      this.serveIndicator.dataset.side = 'player';
    } else {
      this.serveIndicator.innerText = 'AI Serve';
      this.serveIndicator.dataset.side = 'ai';
    }
  }

  // -----------------------------
  // Match End
  // -----------------------------
  showMatchResult(message) {
    this.resultText.innerText = message;
    this.resultModal.dataset.active = 'true';
  }

  hideMatchResult() {
    this.resultModal.dataset.active = 'false';
  }

  // -----------------------------
  // Pause Menu
  // -----------------------------
  showPause() {
    this.pauseModal.dataset.active = 'true';
  }

  hidePause() {
    this.pauseModal.dataset.active = 'false';
  }

  // -----------------------------
  // In-Game Announcements
  // -----------------------------
  popup(message, duration = 1200) {
    const el = document.createElement('div');
    el.className = 'ui-popup';
    el.innerText = message;
    document.body.appendChild(el);

    setTimeout(() => {
      el.classList.add('hide');
      setTimeout(() => el.remove(), 400);
    }, duration);
  }

  // -----------------------------
  // Keyboard Interaction (Pause)
  // -----------------------------
  bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'p') {
        // Toggle pause modal
        if (this.pauseModal.dataset.active === 'true') {
          this.hidePause();
        } else {
          this.showPause();
        }
      }
    });
  }
}

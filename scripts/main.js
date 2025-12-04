/* ==========================================================
   main.js - Homepage Logic for Badminton Web Game
   ========================================================== */

// Load rank from localStorage or create default
const rankData = JSON.parse(localStorage.getItem('playerRank')) || {
    rankIndex: 0,
    tierIndex: 0,
    points: 0
};

const RANKS = ['Bronze', 'Silver', 'Gold', 'Diamond', 'Platinum', 'Divine'];
const TIERS = ['I', 'II', 'III'];

// Update rank display on homepage
function updateRankDisplay() {
    const display = document.getElementById('rank-display');
    if (!display) return;

    display.textContent = `Rank: ${RANKS[rankData.rankIndex]} Tier ${TIERS[rankData.tierIndex]} (${rankData.points} pts)`;
}

// Attach button logic once DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    updateRankDisplay();

    const playBtn = document.getElementById('play-button');
    if (playBtn) {
        playBtn.addEventListener('click', () => {
            // Hide homepage UI
            playBtn.style.display = 'none';
            const rankDisp = document.getElementById('rank-display');
            if (rankDisp) rankDisp.style.display = 'none';

            // Start game from badminton.js
            if (typeof game !== 'undefined') {
                game.run();
            } else {
                console.error("Game object missing — ensure badminton.js is loaded.");
            }
        });
    }
});

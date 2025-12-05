// main.js - Professional launcher + rank manager + game bootstrap
import Loader from "./game/loader.js";
import { startGame } from "./game/badminton.js"; // Game entry point

// -----------------------------
// Rank System
// -----------------------------
const RANKS = ["Bronze", "Silver", "Gold", "Diamond", "Platinum", "Divine"];
const TIERS = ["III", "II", "I"];
const MAX_POINTS = 100;

function loadRank() {
  return JSON.parse(localStorage.getItem("playerRank")) || {
    rankIndex: 0,
    tierIndex: 0,
    points: 0,
  };
}
function saveRank(data) {
  localStorage.setItem("playerRank", JSON.stringify(data));
}
let rankData = loadRank();

function updateRankUI() {
  const rankName = `${RANKS[rankData.rankIndex]} ${TIERS[rankData.tierIndex]}`;
  const percent = (rankData.points / MAX_POINTS) * 100;

  document.querySelector("#rank-name").innerText = rankName;
  document.querySelector("#rank-progress").style.width = `${percent}%`;
}

// -----------------------------
// Loader + Game Start
// -----------------------------
async function bootGame() {
  document.querySelector("#play-btn").style.display = "none";

  // Loader modal visible
  const loaderModal = document.querySelector("#loader-modal");
  loaderModal.dataset.active = "true";

  // Load assets
  const loader = new Loader();

  loader.onProgress = (p) => {
    document.querySelector("#loader-progress").style.width = `${p}%`;
    document.querySelector("#loader-text").innerText = `${Math.floor(p)}%`;
  };

  await loader.load({
    images: {
      player: "sprites/player.svg",
      ai: "sprites/ai.svg",
      racket: "sprites/racket.svg",
      shuttle: "sprites/shuttle.svg",
      court: "sprites/court.svg",
    },
    audio: {
      hit: "audio/hit.wav",
      score: "audio/score.wav",
    },
  });

  loaderModal.dataset.active = "false";
  document.querySelector("#game-root").dataset.active = "true";

  startGame(loader.assets, rankData, handleMatchEnd);
}

// -----------------------------
// Match Result Handler
// -----------------------------
function handleMatchEnd(playerWon) {
  const modal = document.querySelector("#result-modal");
  modal.dataset.active = "true";

  if (playerWon) {
    modal.querySelector("#result-text").innerText = "YOU WIN! +3 RP";
    rankData.points += 3;
  } else {
    modal.querySelector("#result-text").innerText = "YOU LOST! -2 RP";
    rankData.points -= 2;
  }

  // Rank Adjustment
  if (rankData.points >= MAX_POINTS) {
    rankData.points = 0;
    rankData.tierIndex++;
    if (rankData.tierIndex >= TIERS.length) {
      rankData.tierIndex = 0;
      rankData.rankIndex = Math.min(rankData.rankIndex + 1, RANKS.length - 1);
    }
  } else if (rankData.points < 0) {
    rankData.points = MAX_POINTS;
    rankData.tierIndex--;
    if (rankData.tierIndex < 0) {
      rankData.tierIndex = TIERS.length - 1;
      rankData.rankIndex = Math.max(rankData.rankIndex - 1, 0);
    }
  }

  saveRank(rankData);
  updateRankUI();
}

// -----------------------------
// Button Bindings
// -----------------------------
window.onload = () => {
  updateRankUI();

  document.querySelector("#play-btn").onclick = () => {
    bootGame();
  };

  document.querySelector("#restart-btn").onclick = () => {
    location.reload();
  };
};

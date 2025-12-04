/* ==========================================================
   main.js - Homepage Logic for Badminton Web Game (Fixed with window.onload)
   ========================================================== */

window.onload = function(){

    // Load rank from localStorage or create default
    const rankData = JSON.parse(localStorage.getItem('playerRank')) || {
        rankIndex: 0,
        tierIndex: 0,
        points: 0
    };

    const RANKS = ['Bronze', 'Silver', 'Gold', 'Diamond', 'Platinum', 'Divine'];
    const TIERS = ['I', 'II', 'III'];

    // Display rank
    function updateRankDisplay(){
        const display = document.getElementById('rank-display');
        if (!display) return;
        display.textContent = `Rank: ${RANKS[rankData.rankIndex]} Tier ${TIERS[rankData.tierIndex]} (${rankData.points} pts)`;

        const progressEl = document.getElementById('rank-progress');
        if(progressEl){
            // Points needed per tier can be 6 + rankIndex*4 + tierIndex*2
            const needed = 6 + rankData.rankIndex*4 + rankData.tierIndex*2;
            const pct = Math.min(Math.round((rankData.points/needed)*100), 100);
            progressEl.innerHTML = `<div class="bar" style="width:${pct}%"></div><div class="bar-label">${rankData.points}/${needed}</div>`;
        }
    }

    updateRankDisplay();

    // Buttons
    const playBtn = document.getElementById('play-button');
    const howtoBtn = document.getElementById('howto-button');
    const closeHowto = document.getElementById('close-howto');

    console.log('Buttons:', {playBtn, howtoBtn, closeHowto}); // Debug: ensure elements exist

    if(playBtn){
        playBtn.addEventListener('click', ()=>{
            const launcher = document.getElementById('launcher');
            if(launcher) launcher.style.display='none';

            if(window.game && typeof window.game.run === 'function'){
                window.game.run();
            } else {
                console.error('Game object not ready yet.');
            }
        });
    }

    if(howtoBtn){ 
        howtoBtn.addEventListener('click', ()=>{
            const howtoDiv = document.getElementById('howto');
            if(howtoDiv) howtoDiv.classList.remove('hidden');
        }); 
    }

    if(closeHowto){ 
        closeHowto.addEventListener('click', ()=>{
            const howtoDiv = document.getElementById('howto');
            if(howtoDiv) howtoDiv.classList.add('hidden');
        }); 
    }

};

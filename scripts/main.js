// scripts/main.js — robust launcher that waits for game to load and attaches UI handlers
(function(){
  function safeJSON(key, fallback){
    try{ return JSON.parse(localStorage.getItem(key)) || fallback; }catch(e){ return fallback; }
  }

  const rankData = safeJSON('playerRank', { rankIndex:0, tierIndex:0, points:0 });
  const RANKS = ['Bronze','Silver','Gold','Diamond','Platinum','Divine'];
  const TIERS = ['I','II','III'];

  function updateRankUI(){
    const display = document.getElementById('rank-display');
    const progressEl = document.getElementById('rank-progress');
    if(display) display.textContent = `Rank: ${RANKS[rankData.rankIndex]} ${TIERS[rankData.tierIndex]} (${rankData.points})`;
    if(progressEl){
      const needed = 6 + rankData.rankIndex*4 + rankData.tierIndex*2;
      const pct = Math.min(Math.round((rankData.points/needed)*100), 100);
      progressEl.innerHTML = `<div class="bar" style="width:${pct}%"></div><div class="bar-label">${rankData.points}/${needed}</div>`;
    }
  }

  function attachHandlersWhenReady(){
    const playBtn = document.getElementById('play-button');
    const howtoBtn = document.getElementById('howto-button');
    const closeHowto = document.getElementById('close-howto');

    console.log('[launcher] Buttons (should not be null):', { playBtn, howtoBtn, closeHowto });

    if(playBtn){
      playBtn.addEventListener('click', () => {
        const launcher = document.getElementById('launcher');
        if(launcher) launcher.style.display = 'none';

        // If game is already present, run it. Otherwise poll until it exists (short timeout)
        if(window.game && typeof window.game.run === 'function'){
          console.log('[launcher] Starting game immediately');
          window.game.run();
          return;
        }
        console.log('[launcher] Waiting for game to be available...');
        let tries = 0;
        const maxTries = 80; // ~8s at 100ms
        const t = setInterval(() => {
          tries++;
          if(window.game && typeof window.game.run === 'function'){
            console.log('[launcher] Game found — running');
            clearInterval(t);
            window.game.run();
            return;
          }
          if(tries >= maxTries){
            clearInterval(t);
            console.error('[launcher] Game object not found after waiting. Check console/network for errors loading game/badminton.js');
            // show a fallback message
            const err = document.createElement('div');
            err.style.color = '#ffdddd';
            err.style.marginTop = '12px';
            err.textContent = 'Error: Game failed to load. Open console to see details.';
            document.body.appendChild(err);
          }
        }, 100);
      });
    } else {
      console.warn('[launcher] play-button element not found in DOM');
    }

    if(howtoBtn){
      howtoBtn.addEventListener('click', ()=> {
        const howto = document.getElementById('howto');
        if(howto) howto.classList.remove('hidden');
      });
    }
    if(closeHowto){
      closeHowto.addEventListener('click', ()=> {
        const howto = document.getElementById('howto');
        if(howto) howto.classList.add('hidden');
      });
    }
  }

  // Run when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ()=>{ updateRankUI(); attachHandlersWhenReady(); });
  } else {
    updateRankUI();
    attachHandlersWhenReady();
  }

})();

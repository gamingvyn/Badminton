/* ======================================================
   badminton.js — Advanced Browser Badminton Game (Canvas)
   Features:
   - Cartoon stickman players with animated arms/racket
   - Shuttlecock physics (gravity + quadratic drag)
   - Collision detection (rackets, net, court limits)
   - Serving, scoring, deuce (win by 2)
   - AI with reaction time and shot types that scale with rank
   - Rank system persisted in localStorage
   - Sound triggers for hit and point (expects assets/sounds/hit.wav and score.wav)
   - Play/pause, restart (R), and UI overlays
   ====================================================== */

// Ensure script not double-run
if (window.__BADMINTON_LOADED) {
  console.warn('badminton.js already loaded');
} else {
  window.__BADMINTON_LOADED = true;

  // Canvas setup (index.html may already have a canvas - create if missing)
  let canvas = document.getElementById('gameCanvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'gameCanvas';
    canvas.width = 1100;
    canvas.height = 640;
    document.body.appendChild(canvas);
  }
  const ctx = canvas.getContext('2d');

  // Config
  const FPS = 60;
  const DT = 1 / FPS;
  const GROUND_Y = canvas.height - 80;
  const COURT_MARGIN = 80;
  const NET_HEIGHT = 95;
  const NET_WIDTH = 8;
  const COURT_WIDTH = canvas.width - 2 * COURT_MARGIN;

  const PLAYER_WIDTH = 40;
  const PLAYER_HEIGHT = 80;
  const PLAYER_SPEED = 5.4;
  const JUMP_V = -12.5;
  const GRAVITY = 0.7;

  const RACKET_LEN = 40;
  const RACKET_W = 8;

  const SWING_COOLDOWN = 16; // frames
  const SWING_TIME = 10; // frames active

  const SHUTTLE_R = 9;
  const SHUTTLE_G = 0.55;
  const DRAG_K = 0.0026; // quadratic drag coefficient

  const WIN_SCORE = 21;

  // Colors
  const COL_BG = '#1C6641';
  const COL_COURT = '#26A055';
  const COL_LINES = '#F5F5F0';
  const COL_NET = '#C8C8C8';
  const COL_HUMAN = '#2878F0';
  const COL_AI = '#DC323C';
  const COL_SHUTTLE = '#F5F050';
  const COL_TEXT = '#FFFFFF';
  const COL_SERVE = '#FFDC3C';

  // Input
  const keys = {};
  window.addEventListener('keydown', (e) => { keys[e.key] = true; });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; });

  // Rank system persisted in localStorage
  const RANKS = ['Bronze','Silver','Gold','Diamond','Platinum','Divine'];
  const TIERS = ['I','II','III'];
  function loadRank(){
    try { return JSON.parse(localStorage.getItem('playerRank')) || { rankIndex:0, tierIndex:0, points:0 }; }
    catch(e){ return { rankIndex:0, tierIndex:0, points:0 }; }
  }
  function saveRank(r){ localStorage.setItem('playerRank', JSON.stringify(r)); }
  function pointsNeeded(rankIndex,tierIndex){ return 6 + rankIndex*4 + tierIndex*2; }

  // Utility
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function rectsIntersect(a,b){ return !(b.x>a.x+a.width||b.x+b.width<a.x||b.y>a.y+a.height||b.y+b.height<a.y); }
  function rand(min,max){ return Math.random()*(max-min)+min; }

  // Sounds (user-provided files)
  const soundHit = (()=>{ try{ return new Audio('game/assets/sounds/hit.wav'); }catch(e){return null;} })();
  const soundPoint = (()=>{ try{ return new Audio('game/assets/sounds/score.wav'); }catch(e){return null;} })();
  function playHit(){ if(soundHit) { soundHit.currentTime=0; soundHit.play().catch(()=>{}); } }
  function playPoint(){ if(soundPoint) { soundPoint.currentTime=0; soundPoint.play().catch(()=>{}); } }

  // --- Classes ---
  class StickPlayer {
    constructor(x,y,color,isHuman=true){
      this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.color = color; this.isHuman = isHuman;
      this.onGround = true; this.facing = isHuman?1:-1; // 1 = facing right (human on left)
      this.swingTimer = 0; this.swingCooldown = 0; this.prepPower = 0;
      this.armAngle = -0.4; // resting angle
      this.racketOffset = {x: this.isHuman?22:-22, y: -36};
    }
    rect(){ return { x:this.x-20, y:this.y-80, width:40, height:80 }; }
    racketPos(){
      // base shoulder
      const shX = this.x + 12*(this.facing);
      const shY = this.y - 48;
      // arm rotation determines hand position
      const angle = this.armAngle; // radians
      const handX = shX + Math.cos(angle)*(this.facing*RACKET_LEN);
      const handY = shY + Math.sin(angle)*(RACKET_LEN);
      return { shX, shY, handX, handY, angle };
    }
    startSwing(){ if(this.swingCooldown<=0){ this.swingTimer = SWING_TIME; this.swingCooldown = SWING_COOLDOWN; playHit(); } }
    update(){
      // physics
      this.x += this.vx; this.y += this.vy;
      if(!this.onGround) this.vy += GRAVITY;
      if(this.y >= GROUND_Y){ this.y = GROUND_Y; this.vy = 0; this.onGround = true; }
      // limits
      const mid = COURT_MARGIN + COURT_WIDTH/2;
      if(this.isHuman) this.x = clamp(this.x, COURT_MARGIN+30, mid-10);
      else this.x = clamp(this.x, mid+10, COURT_MARGIN+COURT_WIDTH-30);
      // swing timers
      if(this.swingCooldown>0) this.swingCooldown--;
      if(this.swingTimer>0){
        this.swingTimer--;
        // animate arm: forward swing
        const t = (SWING_TIME - this.swingTimer)/SWING_TIME; // 0..1
        // big forward motion when t approx 0.4
        this.armAngle = -0.8 + 1.6 * Math.sin(Math.PI * t);
      } else {
        // relax to resting angle based on movement
        this.armAngle = -0.45 + Math.sin(Date.now()/200 + this.x/60)*0.05;
      }
      // prepare power reduce
      this.prepPower = clamp(this.prepPower * 0.92, 0, 8);
    }
    draw(ctx){
      // Draw body: head, torso, legs
      // Head
      ctx.fillStyle = '#ffe0bd';
      ctx.beginPath(); ctx.arc(this.x, this.y-64, 12, 0, Math.PI*2); ctx.fill();
      // torso
      ctx.strokeStyle = this.color; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(this.x, this.y-52); ctx.lineTo(this.x, this.y-20); ctx.stroke();
      // legs
      ctx.beginPath(); ctx.moveTo(this.x, this.y-20); ctx.lineTo(this.x-12, this.y+22); ctx.moveTo(this.x, this.y-20); ctx.lineTo(this.x+12, this.y+22); ctx.stroke();
      // arm and racket
      const rp = this.racketPos();
      // shoulder dot (invisible)
      ctx.strokeStyle = '#fff'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(rp.shX, rp.shY); ctx.lineTo(rp.handX, rp.handY); ctx.stroke();
      // racket
      ctx.save();
      ctx.translate(rp.handX, rp.handY);
      ctx.rotate(0);
      ctx.fillStyle = '#6b4423';
      ctx.fillRect(-5, -RACKET_W/2, RACKET_LEN*0.5, RACKET_W);
      ctx.restore();
      // optionally draw a small shadow
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(this.x-14, this.y+26, 28, 6);
    }
  }

  class Shuttle {
    constructor(x,y){ this.x=x; this.y=y; this.vx=0; this.vy=0; this.r=SHUTTLE_R; this.inPlay=false; this.last=''; }
    rect(){ return { x:this.x-this.r, y:this.y-this.r, width:this.r*2, height:this.r*2 }; }
    update(){
      // drag
      const speed = Math.hypot(this.vx,this.vy);
      if(speed>0){ const dragX = DRAG_K*this.vx*speed; const dragY = DRAG_K*this.vy*speed; this.vx -= dragX; this.vy -= dragY; }
      // gravity
      this.vy += SHUTTLE_G;
      // integrate
      this.x += this.vx; this.y += this.vy;
    }
    draw(ctx){ ctx.fillStyle = COL_SHUTTLE; ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,Math.PI*2); ctx.fill(); }
  }

  // --- Game ---
  class Game{
    constructor(){
      // players positions
      const mid = COURT_MARGIN + COURT_WIDTH/2;
      this.human = new StickPlayer(mid - 160, GROUND_Y, COL_HUMAN, true);
      this.ai = new StickPlayer(mid + 160, GROUND_Y, COL_AI, false);
      // initial facing
      this.human.facing = 1; this.ai.facing = -1;
      // shuttle
      this.shuttle = new Shuttle(this.human.x + 40, this.human.y - 30);
      // state
      this.scoreHuman = 0; this.scoreAI = 0;
      this.server = 'human';
      this.inServe = true; this.serveReady = false;
      this.gameOver = false; this.paused = false; this.deuce = false;
      // rank
      this.rank = loadRank();
      // AI parameters
      this.aiReactionTimer = 0; this.aiTargetX = this.ai.x;
      // bind input start (space for serve)
      window.addEventListener('keydown', (e)=>{
        if(e.key===' '){
          if(this.inServe && this.server==='human'){
            this.serveReady = true; this.human.startSwing();
          } else if(!this.inServe){ this.human.startSwing(); }
        }
        if(e.key.toLowerCase()==='p'){ this.paused = !this.paused; }
        if(e.key.toLowerCase()==='r' && this.gameOver){ this.restartMatch(); }
      });
    }

    resetPositions(){
      const mid = COURT_MARGIN + COURT_WIDTH/2;
      this.human.x = mid - 160; this.human.y = GROUND_Y; this.human.vx=this.human.vy=0;
      this.ai.x = mid + 160; this.ai.y = GROUND_Y; this.ai.vx=this.ai.vy=0;
      // shuttle at server
      if(this.server==='human'){
        this.shuttle.x = this.human.x + 40; this.shuttle.y = this.human.y - 30;
      } else { this.shuttle.x = this.ai.x - 40; this.shuttle.y = this.ai.y - 30; }
      this.shuttle.vx = this.shuttle.vy = 0; this.shuttle.inPlay=false; this.inServe=true; this.serveReady=false;
    }

    startServe(side){
      // compute target diagonal box
      const mid = COURT_MARGIN + COURT_WIDTH/2;
      let tx, ty;
      if(side==='human'){
        tx = rand(mid+40, COURT_MARGIN+COURT_WIDTH-60);
      } else { tx = rand(COURT_MARGIN+40, mid-40); }
      ty = rand(GROUND_Y-160, GROUND_Y-120);
      // initial velocity toward target, scaled
      const dx = tx - this.shuttle.x; const dy = ty - this.shuttle.y;
      this.shuttle.vx = dx / 18 + rand(-0.5,0.5);
      this.shuttle.vy = dy / 18 + rand(-0.5,0.5);
      this.shuttle.inPlay = true; this.shuttle.last = side;
      this.inServe = false; this.serveReady = false;
    }

    aiThink(){
      if(this.inServe && this.server==='ai' && !this.serveReady){
        // AI prepares serve sometimes
        if(Math.random()<0.02 + (this.rank.rankIndex>=3?0.05:0)) { this.serveReady=true; this.ai.startSwing(); }
      }
      // reaction timer
      if(this.aiReactionTimer>0) { this.aiReactionTimer--; }
      else{
        // compute landing prediction
        const pred = this.predictLandingX();
        // add inaccuracy
        const inacc = 20 * (1 - clamp(0.7 + this.rank.rankIndex*0.04, 0, 0.98));
        this.aiTargetX = clamp(pred + rand(-inacc,inacc), COURT_MARGIN+60, COURT_MARGIN+COURT_WIDTH-60);
        // set reaction timer (faster for higher ranks)
        const base = 14 - Math.floor(this.rank.rankIndex*0.8);
        this.aiReactionTimer = clamp(base + Math.floor(rand(-2,3)), 5, 28);
      }
      // movement toward target
      if(Math.abs(this.ai.x - this.aiTargetX) > 10) this.ai.vx = PLAYER_SPEED * Math.sign(this.aiTargetX - this.ai.x) * (1 + this.rank.rankIndex*0.05);
      else this.ai.vx = 0;
      // jump decision
      if(this.ai.onGround && Math.abs(this.shuttle.x - this.ai.x) < 80 && this.shuttle.y < this.ai.y - 30 && Math.random()<0.6) this.ai.vy = JUMP_V;
      // swing if in range
      const racket = this.ai.racketPos();
      const srect = this.shuttle.rect();
      if(this.rectIntersectsRacket(srect, racket) && this.ai.swingCooldown<=0){ if(Math.random()<0.9) this.ai.startSwing(); }
    }

    predictLandingX(){
      // simulate forward until ground hit
      let x=this.shuttle.x, y=this.shuttle.y, vx=this.shuttle.vx, vy=this.shuttle.vy;
      for(let i=0;i<400;i++){
        const speed = Math.hypot(vx,vy);
        if(speed>0){ const dx = DRAG_K*vx*speed; const dy = DRAG_K*vy*speed; vx-=dx; vy-=dy; }
        vy += SHUTTLE_G; x+=vx; y+=vy;
        // net collision approximate
        const netX = COURT_MARGIN + COURT_WIDTH/2;
        if(x>netX-NET_WIDTH && x<netX+NET_WIDTH && y>GROUND_Y-NET_HEIGHT){ vx *= -0.35; vy = 2.5; }
        if(y >= GROUND_Y - SHUTTLE_R) break;
      }
      return clamp(x, COURT_MARGIN, COURT_MARGIN+COURT_WIDTH);
    }

    rectIntersectsRacket(srect, racket){
      // racket: {shX, shY, handX, handY}
      // use small rectangle around hand
      const r = { x: racket.handX-8, y: racket.handY-8, width:16, height:16 };
      return rectsIntersect(srect, r);
    }

    handleHits(){
      const s = this.shuttle;
      // human racket
      const hr = this.human.racketPos();
      if(this.rectIntersectsRacket(s.rect(), hr) && this.human.swingTimer>0){
        // apply hit physics based on human prep
        const dir = 1; // human faces right
        const power = 10 + this.human.prepPower || 0;
        s.vx = power * 0.9; s.vy = -6 - this.human.prepPower*0.6;
        s.last = 'human'; playHit();
        this.human.swingTimer = 0; this.human.swingCooldown = SWING_COOLDOWN;
      }
      // ai racket
      const ar = this.ai.racketPos();
      if(this.rectIntersectsRacket(s.rect(), ar) && this.ai.swingTimer>0){
        // AI chooses shot type
        const shuttleHigh = s.y < this.ai.y - 60;
        if(shuttleHigh && Math.random()<0.6){ // smash
          s.vx = -11 + rand(-1,1); s.vy = -2 + rand(-1,1);
        } else if(Math.abs(this.ai.x - (COURT_MARGIN + COURT_WIDTH/2)) < 120 && s.y > this.ai.y - 10){ // soft net
          const tx = rand(COURT_MARGIN+ (COURT_WIDTH*0.3), COURT_MARGIN + (COURT_WIDTH*0.5));
          s.vx = (tx - s.x)/16 + rand(-0.6,0.6); s.vy = -2 + rand(-0.6,0.6);
        } else { // drive/clear
          const tx = this.human.x; const ty = this.human.y - 20;
          s.vx = (tx - s.x)/12 + rand(-1.2,1.2); s.vy = (ty - s.y)/12 + rand(-1.2,1.2);
        }
        s.last = 'ai'; playHit(); this.ai.swingTimer = 0; this.ai.swingCooldown = SWING_COOLDOWN;
      }
    }

    handleNetCollision(){
      const netLeft = COURT_MARGIN + COURT_WIDTH/2 - NET_WIDTH/2;
      const netRect = { x:netLeft, y:GROUND_Y - NET_HEIGHT, width:NET_WIDTH, height:NET_HEIGHT };
      const srect = this.shuttle.rect();
      if(rectsIntersect(srect, netRect)){
        if(this.shuttle.y < netRect.y){ this.shuttle.vx *= -0.35; this.shuttle.vy *= 0.22; // bounce
          if(this.shuttle.x < netLeft) this.shuttle.x = netLeft - this.shuttle.r - 2; else this.shuttle.x = netLeft + NET_WIDTH + this.shuttle.r + 2;
        } else { this.shuttle.vx *= 0.12; this.shuttle.vy = 4; }
        playHit();
      }
    }

    checkBoundsAndScore(){
      const s = this.shuttle;
      // ground
      if(s.y + s.r >= GROUND_Y){
        const mid = COURT_MARGIN + COURT_WIDTH/2; const landedLeft = s.x < mid;
        let winner = null;
        if(s.last === 'human') winner = (!landedLeft)? 'human':'ai';
        else if(s.last === 'ai') winner = (landedLeft)? 'ai':'human';
        else winner = landedLeft? 'ai':'human';
        this.awardPoint(winner);
      }
      // out of bounds horizontally
      if(s.x < COURT_MARGIN - 30 || s.x > COURT_MARGIN + COURT_WIDTH + 30){
        let winner = (s.last==='human')? 'ai' : (s.last==='ai')? 'human' : (s.x < COURT_MARGIN? 'ai':'human');
        this.awardPoint(winner);
      }
    }

    awardPoint(winner){
      if(winner==='human') this.scoreHuman++; else this.scoreAI++;
      playPoint();
      // check deuce/win
      this.deuce = (this.scoreHuman>=20 && this.scoreAI>=20);
      if((this.scoreHuman>=WIN_SCORE || this.scoreAI>=WIN_SCORE) && Math.abs(this.scoreHuman - this.scoreAI) >= 2){
        // match over
        this.gameOver = true;
        if(this.scoreHuman > this.scoreAI){ this.rank.points += 3; }
        else { this.rank.points = Math.max(0, this.rank.points - 2); }
        // tier update
        while(this.rank.points >= pointsNeeded(this.rank.rankIndex, this.rank.tierIndex)){
          this.rank.points -= pointsNeeded(this.rank.rankIndex, this.rank.tierIndex);
          if(this.rank.tierIndex < TIERS.length-1) this.rank.tierIndex++; else if(this.rank.rankIndex < RANKS.length-1){ this.rank.rankIndex++; this.rank.tierIndex = 0; }
        }
        while(this.rank.points < 0){ if(this.rank.tierIndex>0){ this.rank.tierIndex--; this.rank.points += pointsNeeded(this.rank.rankIndex, this.rank.tierIndex); } else if(this.rank.rankIndex>0){ this.rank.rankIndex--; this.rank.tierIndex = TIERS.length-1; this.rank.points += pointsNeeded(this.rank.rankIndex, this.rank.tierIndex); } else { this.rank.points = 0; break; } }
        saveRank(this.rank);
        return;
      }
      // else continue, winner serves next
      this.server = winner; this.resetPositions();
    }

    update(){
      if(this.paused || this.gameOver) return;
      // human input
      this.human.vx = 0;
      if(keys['ArrowLeft']) this.human.vx = -PLAYER_SPEED;
      if(keys['ArrowRight']) this.human.vx = PLAYER_SPEED;
      if(keys['ArrowUp'] && this.human.onGround){ this.human.vy = JUMP_V; this.human.onGround=false; }
      // prepare power when holding down ArrowUp
      if(keys['ArrowUp']) this.human.prepPower = clamp((this.human.prepPower||0)+0.15, 0, 8);
      // AI
      this.aiThink();
      // update entities
      this.human.update(); this.ai.update();
      if(this.shuttle.inPlay || !this.inServe) this.shuttle.update();
      // handle hits and net
      this.handleHits(); this.handleNetCollision(); this.checkBoundsAndScore();
      // if serve and serveReady
      if(this.inServe && this.serveReady){ this.startServe(this.server); }
    }

    drawCourt(){
      // background
      ctx.fillStyle = COL_BG; ctx.fillRect(0,0,canvas.width,canvas.height);
      // court
      ctx.fillStyle = COL_COURT; ctx.fillRect(COURT_MARGIN, GROUND_Y-340, COURT_WIDTH, 340);
      // outline
      ctx.strokeStyle = COL_LINES; ctx.lineWidth = 3; ctx.strokeRect(COURT_MARGIN, GROUND_Y-340, COURT_WIDTH, 340);
      // center line
      ctx.beginPath(); ctx.moveTo(COURT_MARGIN+COURT_WIDTH/2, GROUND_Y-340); ctx.lineTo(COURT_MARGIN+COURT_WIDTH/2, GROUND_Y); ctx.stroke();
      // net
      ctx.fillStyle = COL_NET; ctx.fillRect(COURT_MARGIN+COURT_WIDTH/2 - NET_WIDTH/2, GROUND_Y - NET_HEIGHT, NET_WIDTH, NET_HEIGHT);
      // service line
      ctx.beginPath(); ctx.moveTo(COURT_MARGIN, GROUND_Y-160); ctx.lineTo(COURT_MARGIN+COURT_WIDTH/2, GROUND_Y-160); ctx.moveTo(COURT_MARGIN+COURT_WIDTH/2, GROUND_Y-160); ctx.lineTo(COURT_MARGIN+COURT_WIDTH, GROUND_Y-160); ctx.stroke();
    }

    drawUI(){
      ctx.fillStyle = COL_TEXT; ctx.font='22px Arial';
      ctx.fillText(`You: ${this.scoreHuman}`, COURT_MARGIN + 6, 30);
      ctx.fillText(`AI: ${this.scoreAI}`, canvas.width - COURT_MARGIN - 60, 30);
      ctx.fillStyle = COL_SERVE; ctx.fillText(`Serve: ${this.server.toUpperCase()}`, canvas.width/2 - 60, 30);
      ctx.fillStyle = COL_TEXT; ctx.fillText(`Rank: ${RANKS[this.rank.rankIndex]} ${TIERS[this.rank.tierIndex]} (${this.rank.points}/${pointsNeeded(this.rank.rankIndex,this.rank.tierIndex)})`, COURT_MARGIN + 6, 54);
      if(this.deuce) { ctx.fillStyle = '#FFD'; ctx.fillText('DEUCE - Win by 2', canvas.width/2 - 70, 54); }
      if(this.paused){ ctx.fillStyle='#FFD54F'; ctx.fillText('PAUSED (P to resume)', canvas.width/2 - 100, 80); }
      if(this.gameOver){ ctx.fillStyle='#FFEB3B'; ctx.fillText('GAME OVER - Press R to Restart', canvas.width/2 - 170, 110); }
    }

    draw(){
      this.drawCourt();
      // draw players
      this.human.draw(ctx); this.ai.draw(ctx);
      // draw shuttle
      this.shuttle.draw(ctx);
      // UI
      this.drawUI();
    }

    loop(){
      this.update(); this.draw();
      requestAnimationFrame(()=>this.loop());
    }

    run(){
      // ensure serve positions
      this.resetPositions();
      this.loop();
    }

    restartMatch(){
      this.scoreHuman = 0; this.scoreAI = 0; this.server='human'; this.resetPositions(); this.gameOver=false; this.deuce=false; this.rank=loadRank();
    }

  }

  // Expose game globally so index/play button can call game.run()
  window.game = new Game();
}

// --------------------- Badminton.js (Updated) ---------------------
const canvas = document.createElement('canvas');
canvas.width = 1100;
canvas.height = 640;
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d');

// --------------------- Configuration ---------------------
const FPS = 60;
const GROUND_Y = canvas.height - 80;
const COURT_MARGIN = 80;
const NET_HEIGHT = 95;
const NET_WIDTH = 8;
const COURT_WIDTH = canvas.width - 2 * COURT_MARGIN;
const PLAYER_WIDTH = 36;
const PLAYER_HEIGHT = 72;
const PLAYER_SPEED = 5.2;
const JUMP_VELOCITY = -12.5;
const GRAVITY = 0.65;
const RACKET_W = 10;
const RACKET_H = 44;
const RACKET_OFFSET_X = 28;
const RACKET_OFFSET_Y = 22;
const SWING_COOLDOWN = 14;
const SWING_WINDOW = 12;
const SHUTTLE_RADIUS = 9;
const SHUTTLE_GRAVITY = 0.55;
const DRAG_COEFF = 0.0026;
const WINNING_SCORE = 21;

// Colors
const COLOR_BG = '#1C6641';
const COLOR_COURT = '#26A055';
const COLOR_LINES = '#F5F5F0';
const COLOR_NET = '#C8C8C8';
const COLOR_HUMAN = '#2878F0';
const COLOR_AI = '#DC323C';
const COLOR_SHUTTLE = '#F5F050';
const COLOR_TEXT = '#FFFFFF';
const COLOR_SERVE = '#FFDC3C';

// --------------------- Input ---------------------
let keys = {};
document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);

// --------------------- Rank System ---------------------
const RANKS = ['Bronze','Silver','Gold','Diamond','Platinum','Divine'];
const TIERS_PER_RANK = 3;
function loadRank(){
    let data = JSON.parse(localStorage.getItem('playerRank'));
    if(!data) data = {rankIndex:0,tierIndex:0,points:0};
    return data;
}
function saveRank(data){
    localStorage.setItem('playerRank', JSON.stringify(data));
}

// --------------------- Classes ---------------------
class Player {
    constructor(x,y,facingLeft=false,isHuman=true){
        this.x = x; this.y = y; this.vx = 0; this.vy = 0;
        this.width = PLAYER_WIDTH; this.height = PLAYER_HEIGHT;
        this.facingLeft = facingLeft; this.isHuman = isHuman;
        this.onGround = true; this.swinging = false;
        this.swingTimer = 0; this.swingCooldown = 0;
    }
    rect(){ return {x:this.x-this.width/2,y:this.y,width:this.width,height:this.height}; }
    racketRect(){
        let rx = this.facingLeft ? this.x-RACKET_OFFSET_X-RACKET_W : this.x+RACKET_OFFSET_X;
        let ry = this.y+RACKET_OFFSET_Y;
        return {x:rx,y:ry,width:RACKET_W,height:RACKET_H};
    }
    update(){
        this.x += this.vx; this.y += this.vy;
        if(!this.onGround) this.vy+=GRAVITY;
        if(this.y+this.height>=GROUND_Y){ this.y=GROUND_Y-this.height; this.vy=0; this.onGround=true; }
        if(this.swingCooldown>0) this.swingCooldown--;
        if(this.swingTimer>0) this.swingTimer--; else this.swinging=false;
    }
    jump(){ if(this.onGround){ this.vy=-JUMP_VELOCITY; this.onGround=false; } }
    startSwing(){ if(this.swingCooldown<=0){ this.swinging=true; this.swingTimer=SWING_WINDOW; this.swingCooldown=SWING_COOLDOWN; } }
}

class Shuttle {
    constructor(x,y){
        this.x=x; this.y=y; this.vx=0; this.vy=0; this.r=SHUTTLE_RADIUS;
        this.inPlay=false; this.lastHitter=null;
    }
    rect(){ return {x:this.x-this.r,y:this.y-this.r,width:this.r*2,height:this.r*2}; }
    update(){
        let speed = Math.hypot(this.vx,this.vy);
        let dragX = DRAG_COEFF*this.vx*speed;
        let dragY = DRAG_COEFF*this.vy*speed;
        this.vx -= dragX; this.vy -= dragY; this.vy+=SHUTTLE_GRAVITY;
        this.x+=this.vx; this.y+=this.vy;
    }
}

// --------------------- Game ---------------------
class BadmintonGame {
    constructor(){
        this.human = new Player(400,GROUND_Y-PLAYER_HEIGHT,false,true);
        this.ai = new Player(700,GROUND_Y-PLAYER_HEIGHT,true,false);
        this.shuttle = new Shuttle(this.human.x+40,this.human.y-30);
        this.scoreHuman=0; this.scoreAI=0; this.server='human';
        this.rank=loadRank(); this.gameOver=false; this.deuce=false;
    }
    handleInput(){
        this.human.vx=0;
        if(keys['ArrowLeft']) this.human.vx=-PLAYER_SPEED;
        if(keys['ArrowRight']) this.human.vx=PLAYER_SPEED;
        if(keys['ArrowUp']) this.human.jump();
        if(keys[' ']) this.human.startSwing();
        if(this.gameOver && keys['r']) this.restart();
    }
    aiUpdate(){
        let targetX = this.shuttle.x;
        this.ai.vx = (Math.abs(this.ai.x-targetX)>5)?PLAYER_SPEED*Math.sign(targetX-this.ai.x):0;
        if(this.ai.onGround && this.shuttle.y<this.ai.y) this.ai.jump();
    }
    checkCollisions(){
        // Racket collision
        let humanR = this.human.racketRect();
        let aiR = this.ai.racketRect();
        let s = this.shuttle;
        if(this.rectIntersect(s.rect(),humanR) && this.human.swinging){
            s.vx = 6; s.vy = -8; s.lastHitter='human';
        }
        if(this.rectIntersect(s.rect(),aiR) && this.ai.swinging){
            s.vx = -6; s.vy = -8; s.lastHitter='ai';
        }
        // Net collision
        let netX = COURT_MARGIN+COURT_WIDTH/2;
        if(s.x+s.r>netX-NET_WIDTH/2 && s.x-s.r<netX+NET_WIDTH/2 && s.y+s.r>GROUND_Y-NET_HEIGHT){
            s.vy=2; // bounce down
        }
        // Court boundaries
        if(s.y+s.r>GROUND_Y){
            if(s.lastHitter==='human') this.scoreHuman++;
            else if(s.lastHitter==='ai') this.scoreAI++;
            this.checkDeuce();
            this.resetServe();
        }
    }
    checkDeuce(){
        this.deuce = (this.scoreHuman>=20 && this.scoreAI>=20);
        if(this.scoreHuman>=WINNING_SCORE && this.scoreHuman-this.scoreAI>=2){
            this.gameOver=true; this.rank.points+=3; saveRank(this.rank);
        }
        if(this.scoreAI>=WINNING_SCORE && this.scoreAI-this.scoreHuman>=2){
            this.gameOver=true; this.rank.points=Math.max(0,this.rank.points-2); saveRank(this.rank);
        }
    }
    rectIntersect(r1,r2){
        return !(r2.x>r1.x+r1.width||r2.x+r2.width<r1.x||r2.y>r1.y+r1.height||r2.y+r2.height<r1.y);
    }
    resetServe(){
        this.shuttle=new Shuttle(this.server==='human'?this.human.x+40:this.ai.x-40,this.server==='human'?this.human.y-30:this.ai.y-30);
        this.shuttle.inPlay=true;
    }
    update(){
        if(this.gameOver) return;
        this.handleInput(); this.aiUpdate();
        this.human.update(); this.ai.update();
        if(this.shuttle.inPlay) this.shuttle.update();
        this.checkCollisions();
    }
    drawCourt(){
        ctx.fillStyle=COLOR_BG; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle=COLOR_COURT; ctx.fillRect(COURT_MARGIN,GROUND_Y-340,COURT_WIDTH,340);
        ctx.strokeStyle=COLOR_LINES; ctx.lineWidth=3;
        ctx.strokeRect(COURT_MARGIN,GROUND_Y-340,COURT_WIDTH,340);
        ctx.beginPath(); ctx.moveTo(COURT_MARGIN+COURT_WIDTH/2,GROUND_Y-340); ctx.lineTo(COURT_MARGIN+COURT_WIDTH/2,GROUND_Y); ctx.stroke();
        ctx.fillStyle=COLOR_NET; ctx.fillRect(COURT_MARGIN+COURT_WIDTH/2-NET_WIDTH/2,GROUND_Y-NET_HEIGHT,NET_WIDTH,NET_HEIGHT);
    }
    drawPlayersAndShuttle(){
        ctx.fillStyle=COLOR_HUMAN; ctx.fillRect(this.human.rect().x,this.human.rect().y,this.human.width,this.human.height);
        ctx.fillStyle=COLOR_AI; ctx.fillRect(this.ai.rect().x,this.ai.rect().y,this.ai.width,this.ai.height);
        ctx.fillStyle=COLOR_LINES; ctx.fillRect(this.human.racketRect().x,this.human.racketRect().y,RACKET_W,RACKET_H);
        ctx.fillRect(this.ai.racketRect().x,this.ai.racketRect().y,RACKET_W,RACKET_H);
        ctx.fillStyle=COLOR_SHUTTLE; ctx.beginPath(); ctx.arc(this.shuttle.x,this.shuttle.y,this.shuttle.r,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=COLOR_TEXT; ctx.font='24px Arial';
        ctx.fillText(`You: ${this.scoreHuman}  AI: ${this.scoreAI}`,canvas.width/2-80,40);
        ctx.fillStyle=COLOR_SERVE; ctx.fillText(`Serve: ${this.server}`,canvas.width/2-50,70);
        ctx.fillStyle=COLOR_TEXT; ctx.fillText(`Rank: ${RANKS[this.rank.rankIndex]} ${['I','II','III'][this.rank.tierIndex]} (${this.rank.points})`,20,40);
        if(this.gameOver){ ctx.fillStyle='#FF0'; ctx.fillText('GAME OVER! Press R to Restart',canvas.width/2-180,100); }
    }
    restart(){
        this.scoreHuman=0; this.scoreAI=0; this.server='human';
        this.shuttle=new Shuttle(this.human.x+40,this.human.y-30);
        this.gameOver=false;
        this.rank=loadRank();
    }
    run(){
        this.update(); this.drawCourt(); this.drawPlayersAndShuttle();
        requestAnimationFrame(()=>this.run());
    }
}

// --------------------- Initialize Game ---------------------
const game = new BadmintonGame();
game.run();

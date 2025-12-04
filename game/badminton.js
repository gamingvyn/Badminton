// =====================================================
// badminton.js — Full Advanced Browser Badminton Game
// Cartoon stickman players, AI, shuttle physics, scoring, rank system
// =====================================================

window.game = (function(){

    // Canvas & context
    let canvas, ctx;
    let lastTime = 0;

    // Game constants
    const WIDTH = 1000, HEIGHT = 500;
    const GRAVITY = 0.5, AIR_RESIST = 0.995;
    const COURT = {x:0,y:0,width:WIDTH,height:HEIGHT};

    // Players
    let playerStickman, aiStickman;
    const keys = {left:false, right:false, jump:false, swing:false};

    // Shuttlecock
    let shuttle = {x:WIDTH/2, y:HEIGHT/2, vx:0, vy:0, radius:6, inAir:false};

    // Score
    let score = {player:0, ai:0};

    // Rank system
    let rankData = JSON.parse(localStorage.getItem('playerRank')) || { rankIndex:0, tierIndex:0, points:0 };
    const RANKS = ['Bronze','Silver','Gold','Diamond','Platinum','Divine'];
    const TIERS = ['I','II','III'];

    // Game state
    let server = 'player';
    let gameOver = false;
    let deuceActive = false;

    // Sounds
    let hitSound = new Audio('game/assets/sounds/hit.wav');
    let scoreSound = new Audio('game/assets/sounds/score.wav');

    // Stickman class with fine-tuned animation
    class Stickman {
        constructor(x, y, color = '#fff'){ this.x=x; this.y=y; this.color=color; this.armAngle=0; this.forearmAngle=0; this.racketAngle=0; this.swingProgress=0; this.swinging=false; this.bodyLean=0; this.jumpOffset=0; }
        startSwing(type='normal'){ this.swingType=type; this.swinging=true; this.swingProgress=0; }
        update(dt, moveLeft, moveRight, isJumping){
            this.bodyLean=moveLeft?lerp(this.bodyLean,-0.25,0.15):moveRight?lerp(this.bodyLean,0.25,0.15):lerp(this.bodyLean,0,0.1);
            this.jumpOffset=isJumping?lerp(this.jumpOffset,-10,0.2):lerp(this.jumpOffset,0,0.2);
            if(this.swinging){
                this.swingProgress+=dt*3;
                let p=this.swingProgress;
                if(this.swingType==='smash'){ this.armAngle=easeOutBack(p)*1.6; this.forearmAngle=easeOutBack(p)*1.2; this.racketAngle=easeInQuad(p)*2.3; }
                else{ this.armAngle=easeOutQuad(p)*1.0; this.forearmAngle=easeOutQuad(p)*0.8; this.racketAngle=easeOutQuad(p)*1.5; }
                if(p>=1){ this.swinging=false; }
            }else{
                this.armAngle=lerp(this.armAngle,0,0.15); this.forearmAngle=lerp(this.forearmAngle,0,0.15); this.racketAngle=lerp(this.racketAngle,0,0.15);
            }
        }
        draw(ctx){
            ctx.save(); ctx.translate(this.x,this.y+this.jumpOffset); ctx.strokeStyle=this.color; ctx.lineWidth=4;
            ctx.save(); ctx.rotate(this.bodyLean); ctx.beginPath(); ctx.moveTo(0,-30); ctx.lineTo(0,20); ctx.stroke(); ctx.restore();
            ctx.beginPath(); ctx.arc(0,-45,10,0,Math.PI*2); ctx.stroke();
            ctx.translate(0,-25);
            ctx.save(); ctx.rotate(this.armAngle); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(25,0); ctx.stroke();
            ctx.translate(25,0); ctx.rotate(this.forearmAngle); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(20,0); ctx.stroke();
            ctx.translate(20,0); ctx.rotate(this.racketAngle); ctx.beginPath(); ctx.ellipse(10,0,12,20,0,0,Math.PI*2); ctx.stroke(); ctx.restore();
            ctx.restore();
        }
    }

    // Easing functions
    function lerp(a,b,t){return a+(b-a)*t;}
    function easeOutQuad(x){return 1-(1-x)*(1-x);}
    function easeInQuad(x){return x*x;}
    function easeOutBack(x){const c1=1.7,c3=c1+1;return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2);}

    function resetGame(){
        score={player:0,ai:0}; shuttle={x:WIDTH/2,y:HEIGHT/2,vx:0,vy:0,inAir:false};
        gameOver=false; deuceActive=false;
        server=Math.random()>0.5?'player':'ai';
    }

    function init(){
        canvas=document.createElement('canvas'); canvas.id='gameCanvas'; canvas.width=WIDTH; canvas.height=HEIGHT;
        document.body.appendChild(canvas); ctx=canvas.getContext('2d');
        playerStickman=new Stickman(200, HEIGHT-50,'#ff0');
        aiStickman=new Stickman(WIDTH-200, HEIGHT-50,'#0ff');

        document.addEventListener('keydown', (e)=>{
            if(e.key==='ArrowLeft') keys.left=true;
            if(e.key==='ArrowRight') keys.right=true;
            if(e.key==='ArrowUp') keys.jump=true;
            if(e.key===' ') keys.swing=true;
            if(e.key==='p') paused=!paused;
            if(e.key==='r') resetGame();
        });
        document.addEventListener('keyup', (e)=>{
            if(e.key==='ArrowLeft') keys.left=false;
            if(e.key==='ArrowRight') keys.right=false;
            if(e.key==='ArrowUp') keys.jump=false;
            if(e.key===' ') keys.swing=false;
        });

        requestAnimationFrame(loop);
    }

    let paused=false;
    function loop(time){
        const dt=(time-lastTime)/1000; lastTime=time;
        if(paused){requestAnimationFrame(loop); return;}
        update(dt); draw(); requestAnimationFrame(loop);
    }

    function update(dt){
        if(gameOver) return;
        // Update player
        playerStickman.update(dt, keys.left, keys.right, keys.jump);
        if(keys.swing && !playerStickman.swinging) playerStickman.startSwing('normal');
        // Update AI
        aiStickman.update(dt, shuttle.x<aiStickman.x, shuttle.x>aiStickman.x, false);
        if(!aiStickman.swinging) aiStickman.startSwing('normal');

        // Shuttle physics
        shuttle.vy+=GRAVITY; shuttle.vx*=AIR_RESIST; shuttle.vy*=AIR_RESIST;
        shuttle.x+=shuttle.vx; shuttle.y+=shuttle.vy;

        // Net collision
        if(shuttle.x>WIDTH/2-2 && shuttle.x<WIDTH/2+2 && shuttle.y>0 && shuttle.y<HEIGHT){ shuttle.vx=-shuttle.vx*0.5; shuttle.vy=shuttle.vy*0.5; }

        // Ground collision & scoring
        if(shuttle.y>=HEIGHT){
            if(shuttle.x<WIDTH/2){ score.ai++; } else { score.player++; }
            scoreSound.play();
            checkDeuce();
            shuttleReset();
        }
    }

    function shuttleReset(){ shuttle={x:WIDTH/2,y:HEIGHT/2,vx:0,vy:0,inAir:false}; }

    function checkDeuce(){
        if(score.player>=20 && score.ai>=20){ deuceActive=true; }
        if(deuceActive){
            if(Math.abs(score.player-score.ai)>=2){ gameOver=true; saveRank(); }
        } else {
            if(score.player>=21 || score.ai>=21){ gameOver=true; saveRank(); }
        }
    }

    function saveRank(){
        if(score.player>score.ai){ rankData.points+=3; }
        else if(score.ai>score.player){ rankData.points=Math.max(0,rankData.points-2); }
        localStorage.setItem('playerRank', JSON.stringify(rankData));
    }

    function draw(){
        ctx.clearRect(0,0,WIDTH,HEIGHT);
        // Court
        ctx.fillStyle='#0c4d2d'; ctx.fillRect(0,0,WIDTH,HEIGHT);
        ctx.fillStyle='#fff'; ctx.fillRect(WIDTH/2-2,0,4,HEIGHT); // net
        // Draw shuttle
        ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(shuttle.x, shuttle.y, shuttle.radius,0,Math.PI*2); ctx.fill();
        // Draw players
        playerStickman.draw(ctx); aiStickman.draw(ctx);
        // Score
        ctx.font='28px Arial'; ctx.fillStyle='#fff'; ctx.fillText(`${score.player} : ${score.ai}`, WIDTH/2-30,50);
        // Game Over
        if(gameOver){ ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(0,0,WIDTH,HEIGHT);
            ctx.fillStyle='#fff'; ctx.font='48px Arial'; let winner=score.player>score.ai?'You Win!':'AI Wins!'; ctx.fillText(winner, WIDTH/2-100, HEIGHT/2);
            ctx.font='24px Arial'; ctx.fillText('Press R to restart', WIDTH/2-80, HEIGHT/2+50);
        }
    }

    return { run:init };
})();

// Axie Cozy Slots - Phaser 3 prototype
// Minimal, self-contained (no external assets)

const GAME_WIDTH = 960, GAME_HEIGHT = 640;
const REELS = 5, ROWS = 3;
const REEL_WIDTH = 150, REEL_HEIGHT = 120, REEL_GAP = 10;
const SPIN_DURATION = 700;               // faster reel spin
const JACKPOT_SEED = 10000, JACKPOT_CONTRIBUTION = 0.01, JACKPOT_CHANCE = 0.0005;
const FREE_SPINS_COUNT = 10, FREE_SPINS_MULT = 2;

const SYMBOLS = {
  BEAST:   { id: 0, name: 'Beast',   color: 0xFFB347, txt: 0x1b1b1b, label: 'B', pays: [0,0,5,25,100] },
  PLANT:   { id: 1, name: 'Plant',   color: 0x90EE90, txt: 0x1b1b1b, label: 'P', pays: [0,0,5,25,100] },
  AQUATIC: { id: 2, name: 'Aquatic', color: 0x87CEFA, txt: 0x1b1b1b, label: 'A', pays: [0,0,10,50,200] },
  BIRD:    { id: 3, name: 'Bird',    color: 0xFFC0CB, txt: 0x1b1b1b, label: 'D', pays: [0,0,10,50,200] },
  REPTILE: { id: 4, name: 'Reptile', color: 0xDDA0DD, txt: 0x1b1b1b, label: 'R', pays: [0,0,15,75,300] },
  BUG:     { id: 5, name: 'Bug',     color: 0xFFD700, txt: 0x1b1b1b, label: 'G', pays: [0,0,15,75,300] },
  WILD:    { id: 6, name: 'Wild',    color: 0xffffff, txt: 0x1b1b1b, label: 'W', pays: [0,0,25,125,500] },
  SCATTER: { id: 7, name: 'Scatter', color: 0xFF6347, txt: 0xffffff, label: 'S', pays: [0,0,2,10,50] },
};

// Reels' weighted distribution (scatter limited on reels 1/3/5 to reduce frequency)
const REEL_WEIGHTS = [
  [ [SYMBOLS.BEAST,20],[SYMBOLS.PLANT,20],[SYMBOLS.AQUATIC,15],[SYMBOLS.BIRD,15],[SYMBOLS.REPTILE,10],[SYMBOLS.BUG,10],[SYMBOLS.WILD,5],[SYMBOLS.SCATTER,5] ],
  [ [SYMBOLS.BEAST,20],[SYMBOLS.PLANT,20],[SYMBOLS.AQUATIC,15],[SYMBOLS.BIRD,15],[SYMBOLS.REPTILE,10],[SYMBOLS.BUG,10],[SYMBOLS.WILD,10],[SYMBOLS.SCATTER,0] ],
  [ [SYMBOLS.BEAST,20],[SYMBOLS.PLANT,20],[SYMBOLS.AQUATIC,15],[SYMBOLS.BIRD,15],[SYMBOLS.REPTILE,10],[SYMBOLS.BUG,10],[SYMBOLS.WILD,5],[SYMBOLS.SCATTER,5] ],
  [ [SYMBOLS.BEAST,20],[SYMBOLS.PLANT,20],[SYMBOLS.AQUATIC,15],[SYMBOLS.BIRD,15],[SYMBOLS.REPTILE,10],[SYMBOLS.BUG,10],[SYMBOLS.WILD,10],[SYMBOLS.SCATTER,0] ],
  [ [SYMBOLS.BEAST,20],[SYMBOLS.PLANT,20],[SYMBOLS.AQUATIC,15],[SYMBOLS.BIRD,15],[SYMBOLS.REPTILE,10],[SYMBOLS.BUG,10],[SYMBOLS.WILD,5],[SYMBOLS.SCATTER,5] ],
];

// 20 paylines using row indices per reel (0=top,1=mid,2=bot)
const PAYLINES = [
  [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
  [0,0,1,0,0],[2,2,1,2,2],[1,0,0,0,1],[1,2,2,2,1],[0,1,1,1,0],
  [2,1,1,1,2],[1,0,1,2,1],[1,2,1,0,1],[0,2,0,2,0],[2,0,2,0,2],
  [0,1,0,1,0],[2,1,2,1,2],[1,1,0,1,1],[1,1,2,1,1],[0,2,1,2,0],
];

let game, reelMask, reelGroup, symbolsGroup;
let symbols = []; // [reel][rowIndex] -> {container, data}
let reelTweens = [];
let isSpinning = false;
let balance = 10000, currentBet = 100, lastWin = 0, freeSpinsRemaining = 0, autoplayCount = 0, jackpotValue = JACKPOT_SEED;

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: 0xf0f8ff,
  parent: 'game-container',
  scene: { preload, create, update }
};

window.onload = () => { game = new Phaser.Game(config); setupUI(); };

// Preload is intentionally empty; loading data-URI images is blocked on GitHub Pages
// and unnecessary for this prototype.
function preload(){}

function create(){
  // Visual + console confirmation the scene booted
  this.add.text(10, 10, 'Scene ready', { fontFamily: 'Arial', fontSize: '16px', color: '#333' });
  console.log('[scene] create');
  // Decorative frame
  const reelAreaWidth = (REEL_WIDTH+REEL_GAP)*REELS - REEL_GAP;
  const reelAreaHeight = REEL_HEIGHT*ROWS;
  const frame = this.add.rectangle(GAME_WIDTH/2, GAME_HEIGHT/2, reelAreaWidth+40, reelAreaHeight+40, 0x88c9a1, 0.18).setStrokeStyle(4, 0x88c9a1);
  this.add.text(GAME_WIDTH/2, frame.y - (reelAreaHeight+40)/2 - 28, 'Axie Cozy Slots', {
    fontFamily:'Nunito', fontSize:'30px', color:'#5a4a66', fontStyle:'bold'
  }).setOrigin(0.5);

  // Mask for reels
  reelMask = this.add.graphics().fillStyle(0xffffff).fillRect(
    GAME_WIDTH/2 - reelAreaWidth/2,
    GAME_HEIGHT/2 - reelAreaHeight/2,
    reelAreaWidth,
    reelAreaHeight
  );
  reelGroup = this.add.container(0,0);
  reelGroup.setMask(new Phaser.Display.Masks.GeometryMask(this, reelMask));
  symbolsGroup = this.add.container(0,0);

  // Column backgrounds
  for(let r=0;r<REELS;r++){
    const x = GAME_WIDTH/2 - reelAreaWidth/2 + r*(REEL_WIDTH+REEL_GAP) + REEL_WIDTH/2;
    const bg = this.add.rectangle(x, GAME_HEIGHT/2, REEL_WIDTH, reelAreaHeight, 0xffffff, 0.35)
      .setStrokeStyle(2, 0xDDE6F2).setOrigin(0.5);
    reelGroup.add(bg);
  }

  initReels(this);
  updateUI();
}

function update(){}

// ---------- UI ----------
function setupUI(){
  const $ = id => document.getElementById(id);
  $('spinBtn').addEventListener('click', () => spin());
  $('betDecreaseBtn').addEventListener('click', () => { if(isSpinning) return; const opts=[10,20,50,100,200]; const i=opts.indexOf(currentBet); if(i>0){ currentBet=opts[i-1]; updateUI(); }});
  $('betIncreaseBtn').addEventListener('click', () => { if(isSpinning) return; const opts=[10,20,50,100,200]; const i=opts.indexOf(currentBet); if(i<opts.length-1){ currentBet=opts[i+1]; updateUI(); }});
  $('autoplaySelect').addEventListener('change', function(){ if(isSpinning) return; autoplayCount = parseInt(this.value || '0', 10); if(autoplayCount>0) spin(); });
  $('paytableBtn').addEventListener('click', () => alert('Paytable (x Bet):\n\n- Class (B/P): 3=5, 4=25, 5=100\n- Class (A/D): 3=10, 4=50, 5=200\n- Class (R/G): 3=15, 4=75, 5=300\n- Wild: 3=25, 4=125, 5=500\n- Scatter (any): 3=2, 4=10, 5=50\n\nFree Spins: 3+ Scatters award 10 spins at 2x.'));
  $('musicToggle').addEventListener('click', () => alert('Audio stub in prototype.'));
}

// ---------- Reel / Symbol helpers ----------
function initReels(scene){
  symbols = [];
  const areaW = (REEL_WIDTH+REEL_GAP)*REELS - REEL_GAP;
  const baseX = GAME_WIDTH/2 - areaW/2 + REEL_WIDTH/2;
  const baseY = GAME_HEIGHT/2 - (REEL_HEIGHT*ROWS)/2 + REEL_HEIGHT/2;

  for(let reel=0; reel<REELS; reel++){
    const col = [];
    const rx = baseX + reel*(REEL_WIDTH+REEL_GAP);

    // Pre-fill with ROWS+3 so we can scroll by 3 each spin
    for(let row=-3; row<ROWS; row++){
      const y = baseY + (row*REEL_HEIGHT);
      const def = getWeightedSymbol(reel);
      const s = createSymbol(scene, def, rx, y);
      col.push(s);
      symbolsGroup.add(s.container);
    }
    symbols.push(col);
  }
}

function createSymbol(scene, def, x, y){
  const ct = scene.add.container(x,y);
  const card = scene.add.rectangle(0,0, REEL_WIDTH-18, REEL_HEIGHT-18, def.color, 1)
    .setStrokeStyle(3, 0xffffff).setOrigin(0.5);
  // rounded corners effect via scale/alpha overlay
  card.alpha = 0.95;

  const label = scene.add.text(0,-6, def.label, { fontFamily:'Nunito', fontSize:'44px', color:'#'+def.txt.toString(16).padStart(6,'0'), fontStyle:'800' }).setOrigin(0.5);
  const name = scene.add.text(0,24, def.name, { fontFamily:'Nunito', fontSize:'15px', color:'#'+def.txt.toString(16).padStart(6,'0') }).setOrigin(0.5);

  ct.add([card, label, name]);
  return { container: ct, data: def };
}

function getWeightedSymbol(reelIndex){
  const weights = REEL_WEIGHTS[reelIndex];
  let total = 0;
  for(const [_,w] of weights) total += w;
  let r = Math.random() * total;
  for(const [sym,w] of weights){
    r -= w;
    if(r <= 0) return sym;
  }
  return weights[0][0];
}

// ---------- Spin / Resolve ----------
function spin(){
  if(isSpinning) return;

  const free = freeSpinsRemaining > 0;
  if(!free){
    if(balance < currentBet){ alert('Not enough balance'); return; }
    balance -= currentBet;
    jackpotValue += currentBet * JACKPOT_CONTRIBUTION;
  }else{
    freeSpinsRemaining--;
  }

  isSpinning = true;
  lastWin = 0;
  for(const t of reelTweens){ if(t) t.stop(); }

  const scene = game.scene.scenes[0];
  for(let reel=0; reel<REELS; reel++){
    const col = symbols[reel];
    const delay = reel * 90;  // tighter stagger between reels

    for(let i=0;i<col.length;i++){
      const s = col[i];
      const dest = s.container.y - REEL_HEIGHT*3; // scroll by 3 rows
      reelTweens[reel] = scene.tweens.add({
        targets: s.container,
        y: dest,
        duration: SPIN_DURATION,
        delay,
        ease: 'Cubic.easeInOut',
        onComplete: () => {
          // after last reel finished and last element moved, resolve results
          if(reel === REELS-1 && i === col.length-1){
            finishSpin(free);
          }
        }
      });
    }
  }
  updateUI();
}

function resetAfterSpin(){
  const scene = game.scene.scenes[0];
  const areaW = (REEL_WIDTH+REEL_GAP)*REELS - REEL_GAP;
  const baseX = GAME_WIDTH/2 - areaW/2 + REEL_WIDTH/2;
  const baseY = GAME_HEIGHT/2 - (REEL_HEIGHT*ROWS)/2 + REEL_HEIGHT/2;

  for(let reel=0; reel<REELS; reel++){
    const col = symbols[reel];

    // remove top 3 (now offscreen)
    for(let k=0;k<3;k++){ const old = col.shift(); old.container.destroy(); }

    // append 3 new at the bottom
    for(let k=0;k<3;k++){
      const rx = baseX + reel*(REEL_WIDTH+REEL_GAP);
      const y = baseY + ((ROWS-1+k)*REEL_HEIGHT);
      const def = getWeightedSymbol(reel);
      const s = createSymbol(scene, def, rx, y);
      col.push(s);
      symbolsGroup.add(s.container);
    }
  }
}

function finishSpin(free){
  isSpinning = false;
  resetAfterSpin();

  // Build visible grid [reel][row]
  const grid = [];
  for(let r=0;r<REELS;r++){
    grid[r] = symbols[r].slice(0, ROWS);
  }

  const result = evaluateWin(grid, free);
  lastWin = result.totalWin;

  let jackpotHit = false;
  if(!free && Math.random() < JACKPOT_CHANCE){
    lastWin += Math.floor(jackpotValue);
    jackpotHit = true;
    jackpotValue = JACKPOT_SEED;
    alert('JACKPOT!');
  }

  if(result.freeSpinsTriggered){
    freeSpinsRemaining += FREE_SPINS_COUNT;
    alert(`Free Spins: +${FREE_SPINS_COUNT} at ${FREE_SPINS_MULT}x`);
    // stop autoplay when features trigger
    autoplayCount = 0;
    document.getElementById('autoplaySelect').value = '0';
  }

  if(jackpotHit){
    autoplayCount = 0;
    document.getElementById('autoplaySelect').value = '0';
  }

  balance += lastWin;
  updateUI();

  if(autoplayCount > 0){
    autoplayCount--;
    if(autoplayCount === 0) document.getElementById('autoplaySelect').value = '0';
    setTimeout(spin, 800);
  }else if(freeSpinsRemaining > 0){
    setTimeout(spin, 800);
  }
}

// ---------- Math ----------
function evaluateWin(grid, free){
  let total = 0, scatters = 0, triggeredFS = false;

  // Count scatters (any position)
  for(let r=0;r<REELS;r++){
    for(let row=0;row<ROWS;row++){
      if(grid[r][row].data.id === SYMBOLS.SCATTER.id) scatters++;
    }
  }
  if(scatters >= 3){
    total += currentBet * SYMBOLS.SCATTER.pays[Math.min(5,scatters)];
    triggeredFS = true;
  }

  // Paylines (left to right, wild substitutes, scatter stops line)
  for(const line of PAYLINES){
    const seq = [];
    for(let r=0;r<REELS;r++){
      seq.push(grid[r][ line[r] ]);
    }
    const lineWin = evaluateLine(seq);
    total += (free && lineWin>0) ? lineWin * FREE_SPINS_MULT : lineWin;
  }

  return { totalWin: Math.floor(total), freeSpinsTriggered: triggeredFS };
}

function evaluateLine(seq){
  // Determine first target symbol (non-wild, non-scatter) within the streak
  let target = null;
  let count = 0;

  for(let i=0;i<seq.length;i++){
    const id = seq[i].data.id;
    if(id === SYMBOLS.SCATTER.id) break; // scatter breaks line
    if(i === 0){
      if(id !== SYMBOLS.WILD.id) target = id;
      count++;
      continue;
    }
    if(id === SYMBOLS.WILD.id || id === target || (target===null && id!==SYMBOLS.SCATTER.id)){
      if(target === null && id !== SYMBOLS.WILD.id) target = id;
      count++;
    }else{
      break;
    }
  }

  if(count < 3) return 0;
  if(target === null) target = SYMBOLS.WILD.id;
  const sym = Object.values(SYMBOLS).find(s=>s.id===target) || SYMBOLS.WILD;
  return currentBet * (sym.pays[count] || 0);
}

// ---------- UI refresh ----------
function updateUI(){
  const $ = id => document.getElementById(id);
  $('balanceValue').textContent = Math.floor(balance);
  $('betValue').textContent = currentBet;
  $('winValue').textContent = Math.floor(lastWin);
  $('jackpotValue').textContent = Math.floor(jackpotValue);
  $('freeSpinsValue').textContent = freeSpinsRemaining;

  $('spinBtn').disabled = isSpinning;
  $('betDecreaseBtn').disabled = isSpinning;
  $('betIncreaseBtn').disabled = isSpinning;
  $('autoplaySelect').disabled = isSpinning || freeSpinsRemaining>0;
}

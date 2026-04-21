// ===== ペロッペの思考クエスト =====

// ----- プレイヤーデータ -----
const TITLES = [
    { level:1,  title:'見習い冒険者',         speech:'ぼく、ペロッペ！思考の旅に出よう！' },
    { level:3,  title:'思考の探索者',         speech:'どんどん問題を解いてるよ〜！' },
    { level:5,  title:'論理の剣士',           speech:'論点思考、バッチリだよ！次いこ！' },
    { level:8,  title:'仮説の魔術師',         speech:'仮説を立てて、ぐんぐん進むよ！' },
    { level:12, title:'構造化の賢者',         speech:'MECEもロジックツリーも怖くない！' },
    { level:16, title:'クリティカルマスター', speech:'本質的な課題、見抜けるよ！' },
    { level:20, title:'思考の覇王',           speech:'どんな問題も乗り越えてみせる！' },
];

function getExpForLevel(lvl) { return 50 + (lvl - 1) * 30; }
function getTitleInfo(lvl) {
    let r = TITLES[0];
    for (const t of TITLES) { if (lvl >= t.level) r = t; }
    return r;
}

let player = {
    level: 1, exp: 0,
    totalCleared: 0, totalCorrect: 0, totalAnswered: 0,
    streak: 0, bestStreak: 0,
    cleared: {}
};

// ----- バトル状態 -----
let currentCategory = null;
let currentDifficulty = null;
let currentQuestionIndex = 0;
let currentQuestions = [];
let sessionResults = [];
let selectedAnswer = null;
let classifyState = {};
let sortState = [];
let selectedClassifyItem = null;

// ===== パーティクルシステム =====
const canvas = document.getElementById('particleCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;
let particles = [];
let animFrame = null;

function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function spawnParticles(x, y, count, colors) {
    if (!canvas) return;
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 5;
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 2,
            size: 4 + Math.random() * 8,
            color: colors[Math.floor(Math.random() * colors.length)],
            alpha: 1,
            decay: 0.015 + Math.random() * 0.02,
            type: Math.random() < 0.5 ? 'star' : 'circle',
        });
    }
    if (!animFrame) runParticles();
}

function spawnStars(count) {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 3;
    spawnParticles(cx, cy, count, ['#F7D84B', '#E8923A', '#fff', '#c8a040', '#7ecbff']);
}

function runParticles() {
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter(p => p.alpha > 0.02);
    for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        p.vy += 0.15;
        p.alpha -= p.decay;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        if (p.type === 'star') drawStar(ctx, p.x, p.y, p.size);
        else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size/2, 0, Math.PI*2); ctx.fill(); }
        ctx.restore();
    }
    if (particles.length > 0) animFrame = requestAnimationFrame(runParticles);
    else { animFrame = null; ctx.clearRect(0, 0, canvas.width, canvas.height); }
}

function drawStar(ctx, x, y, size) {
    const r1 = size/2, r2 = size/5, pts = 5;
    ctx.beginPath();
    for (let i = 0; i < pts*2; i++) {
        const r = i%2===0 ? r1 : r2;
        const a = (i*Math.PI)/pts - Math.PI/2;
        if (i===0) ctx.moveTo(x+r*Math.cos(a), y+r*Math.sin(a));
        else ctx.lineTo(x+r*Math.cos(a), y+r*Math.sin(a));
    }
    ctx.closePath(); ctx.fill();
}

// ===== スクリーンフラッシュ =====
function screenFlash(color = 'rgba(255,255,255,0.85)') {
    const el = document.createElement('div');
    el.className = 'screen-flash';
    el.style.background = color;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 500);
}

// ===== ダメージポップ =====
function spawnDmgPop(text, color = '#F7D84B', targetId = 'enemySprite') {
    const ref = document.getElementById(targetId);
    if (!ref) return;
    const rect = ref.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'dmg-pop';
    el.textContent = text;
    el.style.cssText = `position:fixed;left:${rect.left+rect.width/2}px;top:${rect.top+10}px;color:${color};font-family:'DotGothic16',sans-serif;font-size:1.8rem;font-weight:bold;pointer-events:none;z-index:900;text-shadow:0 2px 8px rgba(0,0,0,0.8);`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1100);
}

// ===================================================
// ===== RPG オーバーワールドマップ =====
// ===================================================
const TS = 52; // tile size px
const MAP_W = 11, MAP_H = 9;

// Tile types: 0=grass 1=path 2=tree/wall 20=building-body 10-15=entrances
const WORLD = [
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [2, 0,20, 0, 0,20, 0, 0,20, 0, 2],  // building bodies (top)
    [2, 0,10, 0, 0,11, 0, 0,12, 0, 2],  // entrances: ronten/kasetsu/mece
    [2, 0, 1, 0, 0, 1, 0, 0, 1, 0, 2],
    [2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],  // main road (start)
    [2, 0, 1, 0, 0, 1, 0, 0, 1, 0, 2],
    [2, 0,13, 0, 0,14, 0, 0,15, 0, 2],  // entrances: logictree/action/critical
    [2, 0,20, 0, 0,20, 0, 0,20, 0, 2],  // building bodies (bottom)
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
];

// Building info indexed by entrance tile (tile - 10 = index 0-5)
const BLDG_LIST = [
    { cat:'ronten',    col:2, bodyRow:1, entRow:2 },
    { cat:'kasetsu',   col:5, bodyRow:1, entRow:2 },
    { cat:'mece',      col:8, bodyRow:1, entRow:2 },
    { cat:'logictree', col:2, bodyRow:7, entRow:6 },
    { cat:'action',    col:5, bodyRow:7, entRow:6 },
    { cat:'critical',  col:8, bodyRow:7, entRow:6 },
];

const BLDG_PALETTE = [
    { main:'#2255dd', dark:'#112266', lite:'#6699ff', roof:'#1a3388' },
    { main:'#8822cc', dark:'#441177', lite:'#cc77ff', roof:'#5a1099' },
    { main:'#1a9944', dark:'#0e5522', lite:'#55dd88', roof:'#137733' },
    { main:'#cc7700', dark:'#773300', lite:'#ffbb44', roof:'#994400' },
    { main:'#cc3322', dark:'#771111', lite:'#ff8877', roof:'#991a11' },
    { main:'#0099bb', dark:'#005566', lite:'#44ddff', roof:'#007799' },
];

// Hero state
let hero = { x:5, y:4, dir:'down', frame:0 };
let atEntrance = null;
const keys = new Set();
let mapLoopRunning = false;
let lastStepTs = 0;
let lastFrameTs = 0;
let mapScale = 1;

// ----- Map Init -----
function initRPGMap() {
    const vp = document.getElementById('mapViewport');
    const mc = document.getElementById('mapCanvas');
    if (!mc) return;

    mc.width  = MAP_W * TS;
    mc.height = MAP_H * TS;

    scaleMap();
    window.addEventListener('resize', scaleMap);

    drawWorld();
    updateHeroSprite();
    checkHeroTile();

    document.addEventListener('keydown', rpgKeyDown);
    document.addEventListener('keyup',  rpgKeyUp);

    if (!mapLoopRunning) {
        mapLoopRunning = true;
        requestAnimationFrame(rpgLoop);
    }
}

function scaleMap() {
    const outer = document.getElementById('mapOuter');
    const vp    = document.getElementById('mapViewport');
    if (!outer || !vp) return;
    const avail = outer.clientWidth;
    const mapPx = MAP_W * TS;
    mapScale = Math.min(1, avail / mapPx);
    vp.style.transform = `scale(${mapScale})`;
    vp.style.transformOrigin = 'top left';
    outer.style.height = (MAP_H * TS * mapScale + 4) + 'px';
}

function stopRPGMap() {
    document.removeEventListener('keydown', rpgKeyDown);
    document.removeEventListener('keyup',  rpgKeyUp);
    keys.clear();
    mapLoopRunning = false;
}

// ----- Game Loop -----
function rpgLoop(ts) {
    if (!mapLoopRunning) return;
    requestAnimationFrame(rpgLoop);

    // Movement — every 150ms
    if (ts - lastStepTs > 150) {
        const moved =
            tryMoveKey('ArrowUp','w','W', 0,-1,'up')   ||
            tryMoveKey('ArrowDown','s','S', 0,1,'down') ||
            tryMoveKey('ArrowLeft','a','A', -1,0,'left') ||
            tryMoveKey('ArrowRight','d','D', 1,0,'right');
        if (moved) { lastStepTs = ts; lastFrameTs = ts; }
    }

    // Walk frame flip — every 200ms while key held
    if (ts - lastFrameTs > 200 && keys.size > 0) {
        hero.frame ^= 1;
        updateHeroSprite();
        lastFrameTs = ts;
    }
}

function tryMoveKey(k1, k2, k3, dx, dy, dir) {
    if (!keys.has(k1) && !keys.has(k2) && !keys.has(k3)) return false;
    heroMove(dx, dy, dir);
    return true;
}

// ----- Input -----
function rpgKeyDown(e) {
    keys.add(e.key);
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
    if (['Enter',' ','z','Z'].includes(e.key) && atEntrance) {
        enterBuilding(atEntrance);
    }
}
function rpgKeyUp(e) { keys.delete(e.key); }

// D-pad (mobile/mouse)
let dpadTimer = null;
function dpadStart(dir) {
    const [dx,dy] = { up:[0,-1], down:[0,1], left:[-1,0], right:[1,0] }[dir];
    heroMove(dx, dy, dir);
    dpadTimer = setInterval(() => heroMove(dx, dy, dir), 180);
}
function dpadStop() { clearInterval(dpadTimer); dpadTimer = null; }
function dpadOk()   { if (atEntrance) enterBuilding(atEntrance); }

// ----- Movement -----
function heroMove(dx, dy, dir) {
    hero.dir = dir;
    const nx = hero.x + dx, ny = hero.y + dy;
    if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H) { updateHeroSprite(); return; }
    const t = WORLD[ny][nx];
    if (t === 2 || t === 20) { updateHeroSprite(); return; } // blocked
    hero.x = nx; hero.y = ny;
    hero.frame ^= 1;
    updateHeroSprite();
    checkHeroTile();
}

function checkHeroTile() {
    const t = WORLD[hero.y][hero.x];
    if (t >= 10 && t <= 15) {
        atEntrance = BLDG_LIST[t - 10].cat;
        showEnterPrompt(atEntrance);
    } else {
        atEntrance = null;
        hideEnterPrompt();
    }
}

function showEnterPrompt(cat) {
    const info = CATEGORY_INFO[cat];
    const el = document.getElementById('enterPrompt');
    if (!el) return;
    const cleared = !!player.cleared[`${cat}_easy`];
    el.innerHTML = `<span class="ep-icon">${info.icon}</span><span class="ep-name">${info.name}</span><span class="ep-kbd">Enter / ✓ で入る</span>`;
    el.style.display = 'flex';
    el.style.left = (hero.x * TS - 40) + 'px';
    el.style.top  = (hero.y * TS - 64) + 'px';
}

function hideEnterPrompt() {
    const el = document.getElementById('enterPrompt');
    if (el) el.style.display = 'none';
}

function enterBuilding(cat) {
    hideEnterPrompt();
    stopRPGMap();
    // Walk-in flash effect
    screenFlash('rgba(255,255,255,0.5)');
    setTimeout(() => showFloors(cat), 150);
}

// ----- Hero Sprite -----
function updateHeroSprite() {
    const el = document.getElementById('heroSprite');
    if (!el) return;

    // Pixel position: centered in tile horizontally, feet at tile bottom
    const px = hero.x * TS + TS * 0.5 - 20;
    const py = hero.y * TS + TS * 0.5 - 36;
    el.style.left = px + 'px';
    el.style.top  = py + 'px';

    el.dataset.dir   = hero.dir;
    el.dataset.frame = hero.frame;

    const svg = el.querySelector('svg');
    if (!svg) return;

    // Flip for left direction
    svg.style.transform = hero.dir === 'left' ? 'scaleX(-1)' : '';
    // Shrink slightly when walking up (going away)
    svg.style.opacity = hero.dir === 'up' ? '0.75' : '1';
    svg.style.filter  = hero.dir === 'up'
        ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.6)) brightness(0.85)'
        : 'drop-shadow(0 4px 10px rgba(255,208,96,0.4))';

    // Update enter prompt position if open
    if (atEntrance) showEnterPrompt(atEntrance);
}

// ----- Tile Map Drawing -----
function drawWorld() {
    const mc = document.getElementById('mapCanvas');
    if (!mc) return;
    const c = mc.getContext('2d');

    for (let row = 0; row < MAP_H; row++) {
        for (let col = 0; col < MAP_W; col++) {
            drawTile(c, col, row, WORLD[row][col]);
        }
    }

    // Road border lines
    c.strokeStyle = 'rgba(255,255,255,0.04)';
    c.lineWidth = 1;
    for (let row = 0; row < MAP_H; row++) {
        for (let col = 0; col < MAP_W; col++) {
            if (WORLD[row][col] === 1) {
                c.strokeRect(col*TS+0.5, row*TS+0.5, TS-1, TS-1);
            }
        }
    }

    // Building icons & names
    drawBuildingDetails(c);
}

function getBldgIdx(col, row) {
    const colMap = {2:0, 5:1, 8:2};
    if (!(col in colMap)) return -1;
    return row < MAP_H/2 ? colMap[col] : colMap[col] + 3;
}

function drawTile(c, col, row, t) {
    const x = col*TS, y = row*TS;

    if (t === 0) {
        // Grass
        c.fillStyle = '#1c4810';
        c.fillRect(x, y, TS, TS);
        // Subtle grass tufts
        if ((col*7 + row*13) % 7 === 0) {
            c.fillStyle = '#24600f';
            c.fillRect(x+6, y+12, 3, 7);
            c.fillRect(x+22, y+6, 3, 6);
        }
        if ((col*11 + row*5) % 9 === 0) {
            c.fillStyle = '#1f5410';
            c.fillRect(x+34, y+18, 2, 5);
        }

    } else if (t === 1) {
        // Dirt path
        c.fillStyle = '#3e2a10';
        c.fillRect(x, y, TS, TS);
        c.fillStyle = '#5a3c18';
        c.fillRect(x+2, y+2, TS-4, TS-4);
        c.fillStyle = '#6e4e24';
        c.fillRect(x+8, y+8, TS-16, TS-16);
        // Pebbles
        if ((col*3 + row*8) % 5 === 0) {
            c.fillStyle = '#7a5a30';
            c.beginPath(); c.arc(x+14, y+20, 2, 0, Math.PI*2); c.fill();
            c.beginPath(); c.arc(x+36, y+32, 1.5, 0, Math.PI*2); c.fill();
        }

    } else if (t === 2) {
        // Dark tree/wall
        c.fillStyle = '#0c1a08';
        c.fillRect(x, y, TS, TS);
        const cx = x+TS/2, cy = y+TS/2;
        c.fillStyle = '#152e0c';
        c.beginPath(); c.arc(cx, cy-4, TS*0.34, 0, Math.PI*2); c.fill();
        c.fillStyle = '#1a3a10';
        c.beginPath(); c.arc(cx-7, cy+4, TS*0.24, 0, Math.PI*2); c.fill();
        c.beginPath(); c.arc(cx+7, cy+4, TS*0.24, 0, Math.PI*2); c.fill();
        // Tree highlight
        c.fillStyle = 'rgba(255,255,255,0.04)';
        c.beginPath(); c.arc(cx-4, cy-8, TS*0.14, 0, Math.PI*2); c.fill();

    } else if (t === 20) {
        // Building body
        const bi = getBldgIdx(col, row);
        if (bi < 0) return;
        const p = BLDG_PALETTE[bi];
        const isTop = row < MAP_H/2;

        if (isTop) {
            // Roof (triangle shape)
            c.fillStyle = p.dark;
            c.fillRect(x, y, TS, TS);
            c.fillStyle = p.roof;
            c.beginPath();
            c.moveTo(x-2, y+TS+1);
            c.lineTo(x+TS/2, y+3);
            c.lineTo(x+TS+2, y+TS+1);
            c.closePath(); c.fill();
            // Window
            c.fillStyle = 'rgba(255,240,100,0.75)';
            c.fillRect(x+TS/2-6, y+TS*0.52, 12, 10);
            c.strokeStyle = p.dark+'aa';
            c.lineWidth = 1;
            c.strokeRect(x+TS/2-6, y+TS*0.52, 12, 10);
            // Cross pane
            c.strokeStyle = p.dark+'88';
            c.beginPath();
            c.moveTo(x+TS/2-6, y+TS*0.52+5); c.lineTo(x+TS/2+6, y+TS*0.52+5);
            c.moveTo(x+TS/2, y+TS*0.52);     c.lineTo(x+TS/2, y+TS*0.52+10);
            c.stroke();
        } else {
            // Foundation / base
            c.fillStyle = p.dark;
            c.fillRect(x, y, TS, TS);
            c.fillStyle = p.main+'44';
            c.fillRect(x+4, y, TS-8, TS-4);
            // Wall texture lines
            c.strokeStyle = p.dark+'99';
            c.lineWidth = 0.5;
            for (let wl = y+8; wl < y+TS; wl += 10) {
                c.beginPath(); c.moveTo(x+4, wl); c.lineTo(x+TS-4, wl); c.stroke();
            }
        }

    } else if (t >= 10 && t <= 15) {
        // Building entrance / door
        const bi = t - 10;
        const p = BLDG_PALETTE[bi];

        c.fillStyle = p.main;
        c.fillRect(x, y, TS, TS);
        // Wall texture
        c.fillStyle = p.main+'bb';
        c.fillRect(x+4, y+4, TS-8, TS*0.4);
        // Door frame
        c.fillStyle = p.dark;
        c.fillRect(x+TS/2-9, y+TS*0.36, 18, TS*0.64+1);
        // Door arch
        c.fillStyle = p.dark;
        c.beginPath();
        c.arc(x+TS/2, y+TS*0.36+1, 9, Math.PI, 0, false);
        c.fill();
        // Door opening (dark)
        c.fillStyle = 'rgba(0,0,0,0.7)';
        c.fillRect(x+TS/2-7, y+TS*0.36+1, 14, TS*0.64);
        c.beginPath();
        c.arc(x+TS/2, y+TS*0.36+1, 7, Math.PI, 0, false);
        c.fill();
        // Door handle
        c.fillStyle = 'rgba(255,220,80,0.9)';
        c.beginPath(); c.arc(x+TS/2+4, y+TS*0.67, 2.5, 0, Math.PI*2); c.fill();
        // Step
        c.fillStyle = p.lite+'55';
        c.fillRect(x+TS/2-12, y+TS-6, 24, 6);
    }
}

function drawBuildingDetails(c) {
    c.textAlign = 'center';
    c.textBaseline = 'middle';

    for (const b of BLDG_LIST) {
        const info = CATEGORY_INFO[b.cat];
        const bi   = BLDG_LIST.indexOf(b);
        const pal  = BLDG_PALETTE[bi];

        const cx = b.col * TS + TS/2;
        const cy = b.bodyRow * TS + TS/2;

        // Icon on building body
        c.font = `${Math.round(TS*0.46)}px serif`;
        c.fillText(info.icon, cx, cy + 2);

        // Clearance star
        const doneAll = ['easy','medium','hard'].every(d => player.cleared[`${b.cat}_${d}`]);
        if (doneAll) {
            c.font = '11px serif';
            c.fillText('⭐', cx + TS*0.38, cy - TS*0.34);
        }

        // Building name sign above body (row-1 = tree row, so draw just above the body tile)
        const signY = b.bodyRow * TS - 2;
        const signX = b.col * TS + TS/2;

        c.font = 'bold 8px "DotGothic16","Noto Sans JP",sans-serif';
        c.fillStyle = pal.lite;
        // Shadow
        c.shadowColor = 'rgba(0,0,0,0.8)';
        c.shadowBlur = 3;
        c.fillText(info.name, signX, b.bodyRow <= 4 ? signY + TS + 6 : signY - 6);
        c.shadowBlur = 0;
    }
    c.textAlign = 'left';
}

// Redraw map (call after player data changes)
function renderSugorokuMap() {
    initRPGMap();
}

// ===== 画面遷移 =====
function showHome() {
    hide('floorScreen','battleScreen','resultScreen');
    show('homeScreen');
    renderHome();
}
function showFloors(cat) {
    currentCategory = cat;
    hide('homeScreen','battleScreen','resultScreen');
    show('floorScreen');
    renderFloors();
}
function show(...ids) { ids.forEach(id => { const el=document.getElementById(id); if(el) el.style.display=''; }); }
function hide(...ids) { ids.forEach(id => { const el=document.getElementById(id); if(el) el.style.display='none'; }); }

// ===== ホーム =====
function renderHome() {
    updatePlayerUI();
    // Re-init map each time (redraws with updated clear state)
    stopRPGMap();
    requestAnimationFrame(() => initRPGMap());
}

// ===== フロア選択 =====
function renderFloors() {
    const info = CATEGORY_INFO[currentCategory];
    const header = document.getElementById('dungeonHeader');
    header.className = 'rpg-panel dungeon-header';
    header.innerHTML = `
        <div class="panel-title-bar"><span>${info.icon} ${info.name}</span></div>
        <div class="dh-inner">
            <div class="dh-icon">${info.icon}</div>
            <div class="dh-info"><p>${info.desc}</p></div>
        </div>`;

    const list = document.getElementById('floorList');
    list.innerHTML = '';
    for (const [diff, dInfo] of Object.entries(DIFFICULTY_INFO)) {
        const key = `${currentCategory}_${diff}`;
        const cleared = player.cleared[key];
        const locked  = !isFloorUnlocked(currentCategory, diff);
        const qs = QUESTIONS[currentCategory][diff];
        const totalExp = qs.reduce((s,q) => s+q.expReward, 0);
        const stars = cleared
            ? '⭐'.repeat(cleared.stars) + '☆'.repeat(3-cleared.stars)
            : '☆☆☆';

        const card = document.createElement('div');
        card.className = `floor-card${locked ? ' locked' : ''}`;
        if (!locked) card.onclick = () => startBattle(diff);
        card.innerHTML = `
            <div class="floor-left">
                <div class="floor-num ${diff}">F${dInfo.stars}</div>
                <div class="floor-info">
                    <h4>${dInfo.name}</h4>
                    <p>${qs.length}問 · ${locked
                        ? `Lv.${dInfo.requiredLevel}以上で解放`
                        : (cleared ? `ベスト ${cleared.bestScore}pt` : '未クリア')
                    }</p>
                </div>
            </div>
            <div class="floor-right">
                <span class="floor-stars">${stars}</span>
                ${locked
                    ? '<span class="lock-icon">🔒</span>'
                    : `<span class="floor-reward">+${totalExp} EXP</span>`}
            </div>`;
        list.appendChild(card);
    }
}

function isFloorUnlocked(cat, diff) {
    if (diff === 'easy')   return true;
    if (diff === 'medium') return player.level >= DIFFICULTY_INFO.medium.requiredLevel && !!player.cleared[`${cat}_easy`];
    if (diff === 'hard')   return player.level >= DIFFICULTY_INFO.hard.requiredLevel   && !!player.cleared[`${cat}_medium`];
    return false;
}

// ===== バトル =====
function startBattle(diff) {
    currentDifficulty = diff;
    currentQuestionIndex = 0;
    sessionResults = [];
    currentQuestions = [...QUESTIONS[currentCategory][diff]];
    hide('homeScreen','floorScreen','resultScreen');
    show('battleScreen');
    renderBattleQuestion();
}

function retryBattle()  { if (currentCategory && currentDifficulty) startBattle(currentDifficulty); }
function fleeBattle()   {
    if (sessionResults.length > 0 && !confirm('途中で撤退すると進捗が失われます。撤退しますか？')) return;
    showFloors(currentCategory);
}

function renderBattleQuestion() {
    const q     = currentQuestions[currentQuestionIndex];
    const info  = CATEGORY_INFO[currentCategory];
    const dInfo = DIFFICULTY_INFO[currentDifficulty];
    selectedAnswer = null;

    document.getElementById('battleCategory').textContent  = `${info.icon} ${info.name}`;
    document.getElementById('battleProgress').textContent  = `${dInfo.label||dInfo.name} ${currentQuestionIndex+1}/${currentQuestions.length}`;
    document.getElementById('enemySprite').textContent     = q.enemy.sprite;
    document.getElementById('enemySprite').className       = 'enemy-sprite';
    document.getElementById('enemyName').textContent       = q.enemy.name;
    document.getElementById('enemyHpFill').style.width     = '100%';
    document.getElementById('peroppeHpFill').style.width   = '100%';
    document.getElementById('scenarioText').innerHTML      = esc(q.scenario).replace(/\n/g,'<br>');
    document.getElementById('questionText').innerHTML      = `Q${currentQuestionIndex+1}. ${esc(q.question)}`;

    const bpSvgReset = document.querySelector('#battlePeroppe svg');
    if (bpSvgReset) bpSvgReset.classList.remove('attack','damaged');

    const fb = document.getElementById('battleFeedback');
    fb.style.display = 'none'; fb.className = 'battle-feedback';

    const cmd = document.getElementById('commandArea');
    const act = document.getElementById('battleActions');
    switch (q.type) {
        case 'choice':   renderChoiceQ(q, cmd, act); break;
        case 'text':     renderTextQ(q, cmd, act);   break;
        case 'classify': renderClassifyQ(q, cmd, act); break;
        case 'sort':     renderSortQ(q, cmd, act);   break;
    }
}

// ----- Choice -----
function renderChoiceQ(q, cmd, act) {
    const ms = ['A','B','C','D','E'];
    cmd.innerHTML = `<div class="choice-list">${q.choices.map((c,i)=>
        `<div class="choice-item" data-index="${i}" onclick="selectChoice(${i})">
            <span class="choice-marker">${ms[i]}</span><span>${esc(c)}</span>
        </div>`).join('')}</div>`;
    act.innerHTML = `<button class="rpg-btn rpg-btn-primary" onclick="submitChoice()" id="submitBtn" disabled>⚔️ 攻撃する</button>`;
}
function selectChoice(i) {
    if (selectedAnswer !== null && document.querySelector('.choice-item.correct')) return;
    selectedAnswer = i;
    document.querySelectorAll('.choice-item').forEach((el,j) => el.classList.toggle('selected', j===i));
    document.getElementById('submitBtn').disabled = false;
}
function submitChoice() {
    const q = currentQuestions[currentQuestionIndex];
    const ok = selectedAnswer === q.correct;
    document.querySelectorAll('.choice-item').forEach((el,i) => {
        el.classList.remove('selected');
        if (i === q.correct) el.classList.add('correct');
        if (i === selectedAnswer && !ok) el.classList.add('incorrect');
    });
    const exp = ok ? q.expReward : Math.round(q.expReward * 0.2);
    sessionResults.push({ question:q, correct:ok, exp });
    triggerBattleAnim(ok, exp);
    showBattleFeedback(ok, q, exp);
    showNextBtn();
}

// ----- Text -----
function renderTextQ(q, cmd, act) {
    cmd.innerHTML = `<div class="text-input-area">
        <textarea id="textAnswer" placeholder="ここに回答を入力..."></textarea>
        ${q.hint ? `<div class="hint">💡 ${esc(q.hint).replace(/\n/g,'<br>')}</div>` : ''}
    </div>`;
    act.innerHTML = `
        <button class="rpg-btn rpg-btn-secondary" onclick="showSampleAnswer()">📖 模範解答を見る</button>
        <button class="rpg-btn rpg-btn-primary"   onclick="submitText()">⚔️ 回答する</button>`;
}
function showSampleAnswer() {
    const q = currentQuestions[currentQuestionIndex];
    const fb = document.getElementById('battleFeedback');
    fb.style.display=''; fb.className='battle-feedback';
    fb.innerHTML=`<div class="feedback-title">📖 模範解答</div><div class="feedback-text">${esc(q.sampleAnswer).replace(/\n/g,'<br>')}</div>`;
}
function submitText() {
    const q = currentQuestions[currentQuestionIndex];
    const ans = document.getElementById('textAnswer').value.trim();
    if (!ans) { alert('回答を入力してください'); return; }
    const exp = Math.round(q.expReward * 0.7);
    sessionResults.push({ question:q, correct:true, exp, userAnswer:ans });
    triggerBattleAnim(true, exp);
    const fb = document.getElementById('battleFeedback');
    fb.style.display=''; fb.className='battle-feedback correct';
    fb.innerHTML=`
        <div class="feedback-title">⚔️ 討伐成功！</div>
        <div class="feedback-text"><strong>あなたの回答:</strong><br>${esc(ans).replace(/\n/g,'<br>')}</div>
        <div class="feedback-point"><strong>📖 模範解答:</strong><br>${esc(q.sampleAnswer).replace(/\n/g,'<br>')}</div>
        ${q.evaluationPoints ? `<div class="feedback-point" style="margin-top:8px"><strong>✅ 評価ポイント:</strong><br>${q.evaluationPoints.map(p=>'・'+esc(p)).join('<br>')}</div>` : ''}
        <div class="exp-gained">🔷 +${exp} EXP</div>`;
    showNextBtn();
}

// ----- Classify -----
function renderClassifyQ(q, cmd, act) {
    classifyState={}; q.buckets.forEach(b=>classifyState[b]=[]); selectedClassifyItem=null;
    const shuffled=[...q.items].sort(()=>Math.random()-0.5);
    cmd.innerHTML=`<div class="classify-area">
        <div class="classify-items" id="classifyItems">${shuffled.map(item=>
            `<span class="classify-chip" data-item="${esc(item)}" onclick="selectClassifyItem(this)">${esc(item)}</span>`).join('')}</div>
        <div class="classify-buckets">${q.buckets.map(b=>
            `<div class="classify-bucket" onclick="placeInBucket('${esc(b)}')">
                <h5>${esc(b)}</h5>
                <div class="bucket-items" id="bucket-${sid(b)}"></div>
            </div>`).join('')}</div>
    </div>`;
    act.innerHTML=`<button class="rpg-btn rpg-btn-primary" onclick="submitClassify()">⚔️ 攻撃する</button>`;
}
function selectClassifyItem(el) {
    document.querySelectorAll('.classify-chip').forEach(c=>c.style.outline='');
    el.style.outline='2px solid rgba(255,208,96,0.7)'; selectedClassifyItem=el.dataset.item;
}
function placeInBucket(bucket) {
    if (!selectedClassifyItem) return;
    for (const b in classifyState) classifyState[b]=classifyState[b].filter(i=>i!==selectedClassifyItem);
    classifyState[bucket].push(selectedClassifyItem);
    document.querySelectorAll('.classify-chip').forEach(c=>{ if(c.dataset.item===selectedClassifyItem){ c.classList.add('placed'); c.style.outline=''; }});
    renderBuckets(); selectedClassifyItem=null;
}
function renderBuckets() {
    const q=currentQuestions[currentQuestionIndex];
    q.buckets.forEach(b=>{
        const el=document.getElementById('bucket-'+sid(b));
        if(el) el.innerHTML=classifyState[b].map(item=>
            `<span class="bucket-chip" onclick="removeFromBucket('${esc(b)}','${esc(item)}')">${esc(item)} ✕</span>`).join('');
    });
}
function removeFromBucket(bucket,item) {
    classifyState[bucket]=classifyState[bucket].filter(i=>i!==item);
    document.querySelectorAll('.classify-chip').forEach(c=>{ if(c.dataset.item===item) c.classList.remove('placed'); });
    renderBuckets();
}
function submitClassify() {
    const q=currentQuestions[currentQuestionIndex];
    let correct=0, total=q.items.length;
    for (const b in q.correctMapping) q.correctMapping[b].forEach(item=>{ if((classifyState[b]||[]).includes(item)) correct++; });
    const ok=correct===total;
    const exp=Math.round(q.expReward*(ok?1:(correct/total)*0.5));
    sessionResults.push({question:q,correct:ok,exp});
    let detail=''; for (const b in q.correctMapping) detail+=`<strong>${b}:</strong> ${q.correctMapping[b].join('、')}<br>`;
    triggerBattleAnim(ok, exp);
    showBattleFeedback(ok, q, exp, '<br><strong>正解の分類:</strong><br>'+detail);
    showNextBtn();
}

// ----- Sort -----
function renderSortQ(q, cmd, act) {
    sortState=q.items.map((text,i)=>({text,originalIndex:i}));
    for (let i=sortState.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [sortState[i],sortState[j]]=[sortState[j],sortState[i]]; }
    renderSortList(cmd);
    act.innerHTML=`<button class="rpg-btn rpg-btn-primary" onclick="submitSort()">⚔️ 攻撃する</button>`;
}
function renderSortList(container) {
    if (!container) container=document.getElementById('commandArea');
    container.innerHTML=`<div class="sortable-list">${sortState.map((item,i)=>
        `<div class="sortable-item">
            <span class="order-num">${i+1}</span>
            <span style="flex:1">${esc(item.text)}</span>
            <span class="sort-buttons">
                ${i>0?`<button class="rpg-btn rpg-btn-secondary" onclick="moveSortItem(${i},-1)">↑</button>`:''}
                ${i<sortState.length-1?`<button class="rpg-btn rpg-btn-secondary" onclick="moveSortItem(${i},1)">↓</button>`:''}
            </span>
        </div>`).join('')}</div>`;
}
function moveSortItem(i,dir) {
    const j=i+dir; if(j<0||j>=sortState.length) return;
    [sortState[i],sortState[j]]=[sortState[j],sortState[i]]; renderSortList();
}
function submitSort() {
    const q=currentQuestions[currentQuestionIndex];
    const userOrder=sortState.map(s=>s.originalIndex);
    let correct=0; userOrder.forEach((v,i)=>{ if(v===q.correctOrder[i]) correct++; });
    const ok=correct===q.correctOrder.length;
    const exp=Math.round(q.expReward*(ok?1:(correct/q.correctOrder.length)*0.5));
    sessionResults.push({question:q,correct:ok,exp});
    const correctText=q.correctOrder.map((idx,i)=>`${i+1}. ${q.items[idx]}`).join('<br>');
    triggerBattleAnim(ok, exp);
    showBattleFeedback(ok,q,exp,'<br><strong>正しい順序:</strong><br>'+correctText);
    showNextBtn();
}

// ===== バトルアニメーション =====
function triggerBattleAnim(ok, exp) {
    const sprite     = document.getElementById('enemySprite');
    const hp         = document.getElementById('enemyHpFill');
    const bpContainer= document.getElementById('battlePeroppe');
    const bpSvg      = bpContainer ? bpContainer.querySelector('svg') : null;
    const peroppeHp  = document.getElementById('peroppeHpFill');

    if (ok) {
        if (bpSvg) { bpSvg.classList.add('attack'); setTimeout(()=>bpSvg.classList.remove('attack'),600); }
        if (sprite) {
            sprite.classList.add('hit');
            setTimeout(()=>{ sprite.classList.remove('hit'); sprite.classList.add('defeated'); if(hp) hp.style.width='0%'; }, 400);
        }
        setTimeout(()=>screenFlash('rgba(255,255,255,0.6)'), 150);
        setTimeout(()=>spawnDmgPop(`💥 ${exp} DMG`, '#F7D84B', 'enemySprite'), 200);
        setTimeout(()=>{
            const ref=document.getElementById('enemySprite');
            if(ref){ const r=ref.getBoundingClientRect(); spawnParticles(r.left+r.width/2, r.top+r.height/2, 24, ['#F7D84B','#E8923A','#fff','#c8a040']); }
        }, 300);
    } else {
        if (bpSvg) { bpSvg.classList.add('damaged'); setTimeout(()=>bpSvg.classList.remove('damaged'),700); }
        if (peroppeHp) { const cur=parseInt(peroppeHp.style.width)||100; peroppeHp.style.width=Math.max(10,cur-30)+'%'; }
        setTimeout(()=>spawnDmgPop('💦 ダメージ！','#ff6b6b','battlePeroppe'), 100);
        setTimeout(()=>screenFlash('rgba(255,60,60,0.35)'), 100);
    }
}

function showBattleFeedback(ok, q, exp, extra='') {
    if(ok){player.streak++;if(player.streak>player.bestStreak)player.bestStreak=player.streak;}else{player.streak=0;}
    const fb=document.getElementById('battleFeedback');
    fb.style.display=''; fb.className=`battle-feedback ${ok?'correct':'incorrect'}`;
    fb.innerHTML=`
        <div class="feedback-title">${ok?'⚔️ 討伐成功！':'💥 ペロッペがダメージを受けた…'}</div>
        <div class="feedback-text">${q.explanation||''}${extra}</div>
        ${q.point?`<div class="feedback-point"><strong>💡 ポイント:</strong> ${esc(q.point)}</div>`:''}
        <div class="exp-gained">🔷 +${exp} EXP${player.streak>=3?` 🔥 ${player.streak}連続正解！`:''}</div>`;
}

function showNextBtn() {
    const act=document.getElementById('battleActions');
    const isLast=currentQuestionIndex>=currentQuestions.length-1;
    act.innerHTML=`<button class="rpg-btn rpg-btn-primary" onclick="${isLast?'finishBattle()':'nextQ()'}">
        ${isLast?'🏆 結果を見る':'➡️ 次のバトルへ'}</button>`;
}
function nextQ() { currentQuestionIndex++; renderBattleQuestion(); window.scrollTo({top:0,behavior:'smooth'}); }

function finishBattle() {
    const exp=sessionResults.reduce((s,r)=>s+r.exp,0);
    const correct=sessionResults.filter(r=>r.correct).length;
    const total=sessionResults.length;
    const pct=Math.round((correct/total)*100);
    let stars=0; if(pct>=30)stars=1; if(pct>=70)stars=2; if(pct>=90)stars=3;

    const key=`${currentCategory}_${currentDifficulty}`;
    const prev=player.cleared[key];
    if(!prev||stars>prev.stars||exp>prev.bestScore)
        player.cleared[key]={stars:Math.max(stars,prev?prev.stars:0),bestScore:Math.max(exp,prev?prev.bestScore:0)};
    if(!prev) player.totalCleared++;
    player.totalCorrect+=correct; player.totalAnswered+=total;
    addExp(exp); savePlayer();

    hide('homeScreen','floorScreen','battleScreen');
    show('resultScreen');
    renderResult();
}

// ===== リザルト =====
function renderResult() {
    const exp=sessionResults.reduce((s,r)=>s+r.exp,0);
    const correct=sessionResults.filter(r=>r.correct).length;
    const total=sessionResults.length;
    const pct=Math.round((correct/total)*100);
    let stars=0; if(pct>=30)stars=1; if(pct>=70)stars=2; if(pct>=90)stars=3;
    let rank='D',rl='入門';
    if(pct>=90){rank='S';rl='エキスパート';}
    else if(pct>=70){rank='A';rl='上級者';}
    else if(pct>=50){rank='B';rl='中級者';}
    else if(pct>=30){rank='C';rl='初級者';}

    const bannerEl=document.getElementById('resultBannerTitle');
    if(bannerEl) bannerEl.innerHTML=`<span>${correct===total?'🎉 完全制覇！':'🏆 フロアクリア！'}</span>`;
    document.getElementById('resultScoreArea').innerHTML=`
        <div class="result-rank-badge">ランク ${rank} <span class="rank-label">${rl}</span></div>
        <div class="result-stars">${'⭐'.repeat(stars)}${'☆'.repeat(3-stars)}</div>
        <div class="result-score-num">${correct}<span class="result-score-max"> / ${total} 正解</span></div>`;
    document.getElementById('expGainArea').innerHTML=`<div class="exp-gained-text">🔷 +${exp} EXP 獲得！</div>`;
    document.getElementById('resultDetail').innerHTML=sessionResults.map((r,i)=>
        `<div class="result-item">
            <span class="q-label">Q${i+1}. ${truncate(r.question.question,35)}</span>
            <span class="q-result ${r.correct?'correct':'incorrect'}">+${r.exp}EXP ${r.correct?'✅':'❌'}</span>
        </div>`).join('');
    if(pct>=70){ setTimeout(()=>spawnStars(40),300); if(pct>=90) setTimeout(()=>spawnStars(40),900); }
}

// ===== EXP & レベルアップ =====
function addExp(amount) {
    player.exp += amount;
    let leveled = false;
    while (player.exp >= getExpForLevel(player.level)) {
        player.exp -= getExpForLevel(player.level); player.level++; leveled = true;
    }
    updatePlayerUI();
    if (leveled) {
        const t = getTitleInfo(player.level);
        const lvEl  = document.getElementById('levelupLevel');
        const ttlEl = document.getElementById('levelupTitle');
        if (lvEl)  lvEl.textContent  = `Lv.${player.level}`;
        if (ttlEl) ttlEl.textContent = `称号: ${t.title}`;
        const overlay = document.getElementById('levelupOverlay');
        if (overlay) overlay.style.display = '';
        setTimeout(()=>spawnStars(60), 200);
        setTimeout(()=>spawnStars(40), 700);
        screenFlash('rgba(248,216,75,0.5)');
    }
}
function closeLevelUp() { const o=document.getElementById('levelupOverlay'); if(o) o.style.display='none'; }

// ===== プレイヤーUI =====
function updatePlayerUI() {
    const t=getTitleInfo(player.level);
    const needed=getExpForLevel(player.level);
    const pct=Math.min(100,Math.round((player.exp/needed)*100));

    const set = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
    const setW= (id,v) => { const e=document.getElementById(id); if(e) e.style.width=v; };
    set('playerLevel',  `Lv.${player.level}`);
    setW('expFillMini', pct+'%');
    set('playerTitleLarge', t.title);
    set('playerLvLarge', `Lv.${player.level}`);
    setW('expFill', pct+'%');
    set('expText', `${player.exp} / ${needed}`);
    set('peroppeSpeech', t.speech);
    const cr = player.totalAnswered>0 ? Math.round((player.totalCorrect/player.totalAnswered)*100)+'%' : '--%';
    set('statCleared', player.totalCleared);
    set('statCorrect', cr);
    set('statStreak',  player.bestStreak);
}

// ===== セーブ/ロード =====
function savePlayer() { try{localStorage.setItem('peroppeQuest',JSON.stringify(player));}catch(e){} }
function loadPlayer() { try{const d=JSON.parse(localStorage.getItem('peroppeQuest'));if(d)player={...player,...d};}catch(e){} }

// ===== ユーティリティ =====
function esc(t){ const d=document.createElement('div');d.textContent=String(t||'');return d.innerHTML; }
function truncate(t,n){ return t.length>n?t.substring(0,n)+'...':t; }
function sid(s){ return s.replace(/[^a-zA-Z0-9\u3000-\u9FFF]/g,'_'); }

// ===== 初期化 =====
document.addEventListener('DOMContentLoaded', () => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    loadPlayer();
    showHome();
});

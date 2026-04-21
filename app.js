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

const MAP_ORDER = ['ronten', 'kasetsu', 'mece', 'logictree', 'action', 'critical'];

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
        const angle = (Math.random() * Math.PI * 2);
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
    // 画面中央から花火のように飛び出す
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 3;
    spawnParticles(cx, cy, count, ['#F7D84B', '#E8923A', '#fff', '#c8a040', '#7ecbff']);
}

function runParticles() {
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter(p => p.alpha > 0.02);
    for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // gravity
        p.alpha -= p.decay;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        if (p.type === 'star') {
            drawStar(ctx, p.x, p.y, p.size);
        } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
    if (particles.length > 0) {
        animFrame = requestAnimationFrame(runParticles);
    } else {
        animFrame = null;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

function drawStar(ctx, x, y, size) {
    const r1 = size / 2, r2 = size / 5;
    const pts = 5;
    ctx.beginPath();
    for (let i = 0; i < pts * 2; i++) {
        const r = i % 2 === 0 ? r1 : r2;
        const angle = (i * Math.PI) / pts - Math.PI / 2;
        if (i === 0) ctx.moveTo(x + r * Math.cos(angle), y + r * Math.sin(angle));
        else ctx.lineTo(x + r * Math.cos(angle), y + r * Math.sin(angle));
    }
    ctx.closePath();
    ctx.fill();
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
    el.style.cssText = `
        position:fixed;
        left:${rect.left + rect.width / 2}px;
        top:${rect.top + 10}px;
        color:${color};
        font-family:'DotGothic16',sans-serif;
        font-size:2rem;
        font-weight:bold;
        pointer-events:none;
        z-index:900;
        text-shadow:0 2px 8px rgba(0,0,0,0.8);
        animation:dmg-pop 0.9s ease-out forwards;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
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
    renderSugorokuMap();
}

function renderSugorokuMap() {
    const inner = document.getElementById('sugorokuInner');
    if (!inner) return;

    const currentPos = getCurrentMapPosition();

    const cells = MAP_ORDER.map((cat, idx) => {
        const info = CATEGORY_INFO[cat];
        const cleared_easy   = !!player.cleared[`${cat}_easy`];
        const cleared_medium = !!player.cleared[`${cat}_medium`];
        const cleared_hard   = !!player.cleared[`${cat}_hard`];
        const allCleared = cleared_easy && cleared_medium && cleared_hard;
        const isCurrentPos = idx === currentPos;

        const dots = [
            `<div class="floor-dot ${cleared_easy   ? 'easy-cleared'   : ''}" title="初級"></div>`,
            `<div class="floor-dot ${cleared_medium ? 'medium-cleared' : ''}" title="中級"></div>`,
            `<div class="floor-dot ${cleared_hard   ? 'hard-cleared'   : ''}" title="上級"></div>`,
        ].join('');

        return { cat, info, allCleared, isCurrentPos, dots, idx };
    });

    // 蛇行レイアウト（3列2行）
    const row0 = cells.slice(0, 3);
    const row1 = [...cells.slice(3, 6)].reverse();

    let html = '';
    for (const c of row0) html += buildCell(c);
    for (const c of row1) html += buildCell(c);

    inner.innerHTML = html;
}

function buildCell(c) {
    const { cat, info, allCleared, isCurrentPos, dots, idx } = c;
    return `
        <div class="sugoroku-cell ${allCleared ? 'cleared' : ''}"
             data-cat="${cat}"
             onclick="showFloors('${cat}')"
             id="cell-${cat}">
            <div class="cell-number">${idx + 1}</div>
            ${isCurrentPos ? `<div class="peroppe-token">${peroppeTokenSVG()}</div>` : ''}
            <div class="cell-icon">${info.icon}</div>
            <div class="cell-name">${info.name}</div>
            <div class="cell-floors">${dots}</div>
            ${allCleared ? '<div style="font-size:0.65rem;color:#e8923a;font-family:DotGothic16,sans-serif;margin-top:4px;">✨ CLEAR</div>' : ''}
        </div>`;
}

function peroppeTokenSVG() {
    return `<svg viewBox="0 0 160 180" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="80" cy="128" rx="52" ry="44" fill="#F7D84B" stroke="#2a2a6e" stroke-width="5"/>
        <ellipse cx="80" cy="74"  rx="48" ry="46" fill="#F7D84B" stroke="#2a2a6e" stroke-width="5"/>
        <ellipse cx="80" cy="30"  rx="10" ry="14" fill="#F7D84B" stroke="#2a2a6e" stroke-width="4.5"/>
        <ellipse cx="28"  cy="130" rx="16" ry="12" fill="#F7D84B" stroke="#2a2a6e" stroke-width="4" transform="rotate(-20,28,130)"/>
        <ellipse cx="132" cy="130" rx="16" ry="12" fill="#F7D84B" stroke="#2a2a6e" stroke-width="4" transform="rotate(20,132,130)"/>
        <ellipse cx="60"  cy="168" rx="18" ry="11" fill="#F7D84B" stroke="#2a2a6e" stroke-width="4"/>
        <ellipse cx="100" cy="168" rx="18" ry="11" fill="#F7D84B" stroke="#2a2a6e" stroke-width="4"/>
        <ellipse cx="55"  cy="110" rx="14" ry="8"  fill="rgba(255,255,255,0.35)" transform="rotate(-30,55,110)"/>
        <ellipse cx="64"  cy="72"  rx="5"  ry="5.5" fill="#2a2a6e"/>
        <ellipse cx="96"  cy="72"  rx="5"  ry="5.5" fill="#2a2a6e"/>
        <circle  cx="66"  cy="70"  r="2"   fill="white"/>
        <circle  cx="98"  cy="70"  r="2"   fill="white"/>
        <ellipse cx="80"  cy="88"  rx="18" ry="12" fill="#E8923A" stroke="#2a2a6e" stroke-width="3.5"/>
        <line x1="72" y1="102" x2="88" y2="102" stroke="#2a2a6e" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`;
}

function getCurrentMapPosition() {
    for (let i = 0; i < MAP_ORDER.length; i++) {
        const cat = MAP_ORDER[i];
        if (!player.cleared[`${cat}_easy`]) return i;
    }
    return MAP_ORDER.length - 1;
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
            <div class="dh-info">
                <p>${info.desc}</p>
            </div>
        </div>`;

    const list = document.getElementById('floorList');
    list.innerHTML = '';
    for (const [diff, dInfo] of Object.entries(DIFFICULTY_INFO)) {
        const key = `${currentCategory}_${diff}`;
        const cleared = player.cleared[key];
        const locked = !isFloorUnlocked(currentCategory, diff);
        const qs = QUESTIONS[currentCategory][diff];
        const totalExp = qs.reduce((s, q) => s + q.expReward, 0);

        const stars = cleared
            ? '⭐'.repeat(cleared.stars) + '☆'.repeat(3 - cleared.stars)
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
    if (diff === 'easy') return true;
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

function retryBattle() {
    if (currentCategory && currentDifficulty) startBattle(currentDifficulty);
}

function fleeBattle() {
    if (sessionResults.length > 0 && !confirm('途中で撤退すると進捗が失われます。撤退しますか？')) return;
    showFloors(currentCategory);
}

function renderBattleQuestion() {
    const q = currentQuestions[currentQuestionIndex];
    const info = CATEGORY_INFO[currentCategory];
    const dInfo = DIFFICULTY_INFO[currentDifficulty];
    selectedAnswer = null;

    document.getElementById('battleCategory').textContent = `${info.icon} ${info.name}`;
    document.getElementById('battleProgress').textContent = `${dInfo.label || dInfo.name} ${currentQuestionIndex + 1}/${currentQuestions.length}`;
    document.getElementById('enemySprite').textContent = q.enemy.sprite;
    document.getElementById('enemySprite').className = 'enemy-sprite';
    document.getElementById('enemyName').textContent = q.enemy.name;
    document.getElementById('enemyHpFill').style.width = '100%';
    document.getElementById('peroppeHpFill').style.width = '100%';
    document.getElementById('scenarioText').innerHTML = esc(q.scenario).replace(/\n/g,'<br>');
    document.getElementById('questionText').innerHTML = `Q${currentQuestionIndex+1}. ${esc(q.question)}`;

    // バトルペロッペをリセット
    const bpReset = document.getElementById('battlePeroppe');
    if (bpReset) {
        const bpSvgReset = bpReset.querySelector('svg');
        if (bpSvgReset) bpSvgReset.classList.remove('attack','damaged');
    }

    const fb = document.getElementById('battleFeedback');
    fb.style.display = 'none'; fb.className = 'battle-feedback';

    const cmd = document.getElementById('commandArea');
    const act = document.getElementById('battleActions');

    switch (q.type) {
        case 'choice':   renderChoiceQ(q, cmd, act); break;
        case 'text':     renderTextQ(q, cmd, act); break;
        case 'classify': renderClassifyQ(q, cmd, act); break;
        case 'sort':     renderSortQ(q, cmd, act); break;
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
        <div class="feedback-point" style="margin-top:8px"><strong>✅ 評価ポイント:</strong><br>${q.evaluationPoints ? q.evaluationPoints.map(p=>'・'+esc(p)).join('<br>') : ''}</div>
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
    el.style.outline='2px solid var(--panel-border)'; selectedClassifyItem=el.dataset.item;
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
    renderSortList(cmd); act.innerHTML=`<button class="rpg-btn rpg-btn-primary" onclick="submitSort()">⚔️ 攻撃する</button>`;
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
    const sprite = document.getElementById('enemySprite');
    const hp = document.getElementById('enemyHpFill');
    const bpContainer = document.getElementById('battlePeroppe');
    const bpSvg = bpContainer ? bpContainer.querySelector('svg') : null;
    const peroppeHp = document.getElementById('peroppeHpFill');

    if (ok) {
        // ペロッペ攻撃アニメ（SVGに付与）
        if (bpSvg) {
            bpSvg.classList.add('attack');
            setTimeout(() => bpSvg.classList.remove('attack'), 600);
        }
        // エネミー被ダメ
        if (sprite) {
            sprite.classList.add('hit');
            setTimeout(() => {
                sprite.classList.remove('hit');
                sprite.classList.add('defeated');
                if (hp) hp.style.width = '0%';
            }, 400);
        }
        // スクリーンフラッシュ（白）
        setTimeout(() => screenFlash('rgba(255,255,255,0.6)'), 150);
        // ダメージポップ
        setTimeout(() => spawnDmgPop(`💥 ${exp} DMG`, '#F7D84B', 'enemySprite'), 200);
        // パーティクル
        setTimeout(() => {
            const ref = document.getElementById('enemySprite');
            if (ref) {
                const rect = ref.getBoundingClientRect();
                spawnParticles(rect.left + rect.width/2, rect.top + rect.height/2, 24,
                    ['#F7D84B','#E8923A','#fff','#c8a040']);
            }
        }, 300);
    } else {
        // ペロッペ被ダメアニメ（SVGに付与）
        if (bpSvg) {
            bpSvg.classList.add('damaged');
            setTimeout(() => bpSvg.classList.remove('damaged'), 700);
        }
        // ペロッペHPを下げる
        if (peroppeHp) {
            const cur = parseInt(peroppeHp.style.width) || 100;
            peroppeHp.style.width = Math.max(10, cur - 30) + '%';
        }
        // ダメージポップ（ペロッペ側）
        setTimeout(() => spawnDmgPop('💦 ダメージ！', '#ff6b6b', 'battlePeroppe'), 100);
        // フラッシュ（赤）
        setTimeout(() => screenFlash('rgba(255,60,60,0.35)'), 100);
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
    if(!prev||stars>prev.stars||exp>prev.bestScore) {
        player.cleared[key]={stars:Math.max(stars,prev?prev.stars:0),bestScore:Math.max(exp,prev?prev.bestScore:0)};
    }
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

    const bannerEl = document.getElementById('resultBannerTitle');
    if (bannerEl) bannerEl.innerHTML = `<span>${correct===total?'🎉 完全制覇！':'🏆 フロアクリア！'}</span>`;

    document.getElementById('resultScoreArea').innerHTML=`
        <div class="result-rank-badge">ランク ${rank} <span class="rank-label">${rl}</span></div>
        <div class="result-stars">${'⭐'.repeat(stars)}${'☆'.repeat(3-stars)}</div>
        <div class="result-score-num">${correct}<span class="result-score-max"> / ${total} 正解</span></div>`;

    document.getElementById('expGainArea').innerHTML=`
        <div class="exp-gained-text">🔷 +${exp} EXP 獲得！</div>`;

    document.getElementById('resultDetail').innerHTML=sessionResults.map((r,i)=>
        `<div class="result-item">
            <span class="q-label">Q${i+1}. ${truncate(r.question.question,35)}</span>
            <span class="q-result ${r.correct?'correct':'incorrect'}">+${r.exp}EXP ${r.correct?'✅':'❌'}</span>
        </div>`).join('');

    // リザルト演出：パーティクル
    if (pct >= 70) {
        setTimeout(() => spawnStars(40), 300);
        if (pct >= 90) setTimeout(() => spawnStars(40), 900);
    }
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
        const lvEl = document.getElementById('levelupLevel');
        const ttlEl = document.getElementById('levelupTitle');
        if (lvEl) lvEl.textContent = `Lv.${player.level}`;
        if (ttlEl) ttlEl.textContent = `称号: ${t.title}`;
        const overlay = document.getElementById('levelupOverlay');
        if (overlay) overlay.style.display = '';
        // レベルアップパーティクル
        setTimeout(() => spawnStars(60), 200);
        setTimeout(() => spawnStars(40), 700);
        screenFlash('rgba(248,216,75,0.5)');
    }
}
function closeLevelUp() {
    const overlay = document.getElementById('levelupOverlay');
    if (overlay) overlay.style.display = 'none';
}

// ===== プレイヤーUI =====
function updatePlayerUI() {
    const t = getTitleInfo(player.level);
    const needed = getExpForLevel(player.level);
    const pct = Math.min(100, Math.round((player.exp / needed) * 100));

    const lvEl = document.getElementById('playerLevel');
    if (lvEl) lvEl.textContent = `Lv.${player.level}`;
    const miniBar = document.getElementById('expFillMini');
    if (miniBar) miniBar.style.width = pct + '%';

    const titleLarge = document.getElementById('playerTitleLarge');
    if (titleLarge) titleLarge.textContent = t.title;
    const lvLarge = document.getElementById('playerLvLarge');
    if (lvLarge) lvLarge.textContent = `Lv.${player.level}`;
    const expFill = document.getElementById('expFill');
    if (expFill) expFill.style.width = pct + '%';
    const expText = document.getElementById('expText');
    if (expText) expText.textContent = `${player.exp} / ${needed}`;
    const speech = document.getElementById('peroppeSpeech');
    if (speech) speech.textContent = t.speech;

    const cr = player.totalAnswered > 0
        ? Math.round((player.totalCorrect / player.totalAnswered) * 100) + '%'
        : '--%';
    const sc = document.getElementById('statCleared');
    const sq = document.getElementById('statCorrect');
    const ss = document.getElementById('statStreak');
    if (sc) sc.textContent = player.totalCleared;
    if (sq) sq.textContent = cr;
    if (ss) ss.textContent = player.bestStreak;
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

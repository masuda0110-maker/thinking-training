// ===== ペロッペの思考クエスト =====

// ----- プレイヤーデータ -----
const TITLES = [
    { level:1,  title:'見習い冒険者',       speech:'ぼく、ペロッペ！思考の旅に出よう！' },
    { level:3,  title:'思考の探索者',       speech:'どんどん問題を解いてるよ〜！' },
    { level:5,  title:'論理の剣士',         speech:'論点思考、バッチリだよ！次いこ！' },
    { level:8,  title:'仮説の魔術師',       speech:'仮説を立てて、ぐんぐん進むよ！' },
    { level:12, title:'構造化の賢者',       speech:'MECEもロジックツリーも怖くない！' },
    { level:16, title:'クリティカルマスター', speech:'本質的な課題、見抜けるよ！' },
    { level:20, title:'思考の覇王',         speech:'どんな問題も乗り越えてみせる！' },
];

// すごろくマップ順序（カテゴリキー）
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
    const map = document.getElementById('sugorokuMap');

    // 現在地（クリア済みの次のマス）
    const currentPos = getCurrentMapPosition();

    // すごろくグリッド生成
    // 蛇行配置：Row1→左から右、Row2→右から左、など
    const cells = MAP_ORDER.map((cat, idx) => {
        const info = CATEGORY_INFO[cat];
        const cleared_easy   = !!player.cleared[`${cat}_easy`];
        const cleared_medium = !!player.cleared[`${cat}_medium`];
        const cleared_hard   = !!player.cleared[`${cat}_hard`];
        const allCleared = cleared_easy && cleared_medium && cleared_hard;
        const isCurrentPos = idx === currentPos;

        const dots = [
            `<div class="floor-dot ${cleared_easy ? 'easy-cleared' : ''}" title="初級"></div>`,
            `<div class="floor-dot ${cleared_medium ? 'medium-cleared' : ''}" title="中級"></div>`,
            `<div class="floor-dot ${cleared_hard ? 'hard-cleared' : ''}" title="上級"></div>`,
        ].join('');

        return { cat, info, allCleared, isCurrentPos, dots, idx };
    });

    // 蛇行レイアウト（3列）
    // 行0: index 0,1,2 → 左から右
    // 行1: index 3,4,5 → 右から左（CSSで逆順）
    const row0 = cells.slice(0, 3);        // ronten, kasetsu, mece
    const row1 = [...cells.slice(3, 6)].reverse(); // critical, action, logictree（逆）

    let gridHtml = `<div class="sugoroku-grid">`;

    // 行0
    for (const c of row0) {
        gridHtml += buildCell(c);
    }
    // ゴール（3列目行0と行1の間）→ ここでは中央に「GOAL」マスを入れない代わりに、すべてのマスを並べる
    // 行1（逆順で表示することで道っぽく）
    for (const c of row1) {
        gridHtml += buildCell(c);
    }

    gridHtml += `</div>`;

    // パス（SVGの矢印道）
    const pathSvg = buildPathSvg();

    map.innerHTML = pathSvg + gridHtml;
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
            <div class="cell-desc">${info.desc}</div>
            <div class="cell-floors">${dots}</div>
            ${allCleared ? '<div style="font-size:0.7rem;color:#e8923a;font-weight:700;margin-top:4px;">✨ COMPLETE</div>' : ''}
        </div>`;
}

function peroppeTokenSVG() {
    return `<svg viewBox="0 0 200 180" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="100" cy="130" rx="80" ry="45" fill="#F5D547" stroke="#333" stroke-width="4"/>
        <ellipse cx="100" cy="85" rx="60" ry="50" fill="#F5D547" stroke="#333" stroke-width="4"/>
        <ellipse cx="90" cy="42" rx="18" ry="14" fill="#F5D547" stroke="#333" stroke-width="4"/>
        <ellipse cx="110" cy="38" rx="14" ry="12" fill="#F5D547" stroke="#333" stroke-width="4"/>
        <ellipse cx="100" cy="45" rx="16" ry="13" fill="#F5D547" stroke="#333" stroke-width="3.5"/>
        <circle cx="82" cy="88" r="4" fill="#333"/>
        <circle cx="118" cy="88" r="4" fill="#333"/>
        <ellipse cx="100" cy="105" rx="14" ry="10" fill="#E8923A" stroke="#333" stroke-width="3"/>
    </svg>`;
}

function buildPathSvg() {
    // 装飾用の点線（純粋にデコレーション）
    return `<svg class="sugoroku-path" viewBox="0 0 900 500" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M 50 200 Q 450 60 850 200 Q 450 340 50 200" fill="none" stroke="#F5D547" stroke-width="3" stroke-dasharray="10,8" opacity="0.25"/>
        <circle cx="50" cy="200" r="6" fill="#F5D547" opacity="0.3"/>
        <circle cx="850" cy="200" r="6" fill="#E8923A" opacity="0.3"/>
    </svg>`;
}

function getCurrentMapPosition() {
    // 全クリアしたカテゴリの次のポジション
    for (let i = 0; i < MAP_ORDER.length; i++) {
        const cat = MAP_ORDER[i];
        if (!player.cleared[`${cat}_easy`]) return i;
    }
    return MAP_ORDER.length - 1; // 全部クリア済みならラスト
}

// ===== フロア選択 =====
function renderFloors() {
    const info = CATEGORY_INFO[currentCategory];
    document.getElementById('dungeonHeader').innerHTML = `
        <div class="dh-icon">${info.icon}</div>
        <h2>${info.name}</h2>
        <p>${info.desc}</p>
    `;

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
                    <p>${qs.length}問 · ${locked ? `Lv.${dInfo.requiredLevel}以上で解放` : (cleared ? `ベスト ${cleared.bestScore}pt` : '未クリア')}</p>
                </div>
            </div>
            <div class="floor-right">
                <span class="floor-stars">${stars}</span>
                ${locked ? '<span class="lock-icon">🔒</span>' : `<span class="floor-reward">+${totalExp} EXP</span>`}
            </div>
        `;
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
    document.getElementById('battleProgress').textContent = `${dInfo.label} ${currentQuestionIndex + 1}/${currentQuestions.length}`;
    document.getElementById('enemySprite').textContent = q.enemy.sprite;
    document.getElementById('enemySprite').className = 'enemy-sprite';
    document.getElementById('enemyName').textContent = q.enemy.name;
    document.getElementById('enemyHpFill').style.width = '100%';
    document.getElementById('scenarioText').innerHTML = esc(q.scenario).replace(/\n/g,'<br>');
    document.getElementById('questionText').innerHTML = `Q${currentQuestionIndex+1}. ${esc(q.question)}`;

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
    act.innerHTML = `<button class="btn btn-primary" onclick="submitChoice()" id="submitBtn" disabled>⚔️ 攻撃する</button>`;
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
    animateEnemy(ok);
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
        <button class="btn btn-secondary" onclick="showSampleAnswer()">📖 模範解答</button>
        <button class="btn btn-primary" onclick="submitText()">⚔️ 回答する</button>`;
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
    animateEnemy(true);
    const fb = document.getElementById('battleFeedback');
    fb.style.display=''; fb.className='battle-feedback correct';
    fb.innerHTML=`
        <div class="feedback-title">⚔️ 討伐成功！</div>
        <div class="feedback-text"><strong>あなたの回答:</strong><br>${esc(ans).replace(/\n/g,'<br>')}</div>
        <div class="feedback-point"><strong>📖 模範解答:</strong><br>${esc(q.sampleAnswer).replace(/\n/g,'<br>')}</div>
        <div class="feedback-point" style="margin-top:8px"><strong>✅ 評価ポイント:</strong><br>${q.evaluationPoints.map(p=>'・'+esc(p)).join('<br>')}</div>
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
    act.innerHTML=`<button class="btn btn-primary" onclick="submitClassify()">⚔️ 攻撃する</button>`;
}
function selectClassifyItem(el) {
    document.querySelectorAll('.classify-chip').forEach(c=>c.style.outline='');
    el.style.outline='2px solid var(--accent)'; selectedClassifyItem=el.dataset.item;
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
    animateEnemy(ok);
    showBattleFeedback(ok, q, exp, '<br><strong>正解の分類:</strong><br>'+detail);
    showNextBtn();
}

// ----- Sort -----
function renderSortQ(q, cmd, act) {
    sortState=q.items.map((text,i)=>({text,originalIndex:i}));
    for (let i=sortState.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [sortState[i],sortState[j]]=[sortState[j],sortState[i]]; }
    renderSortList(cmd); act.innerHTML=`<button class="btn btn-primary" onclick="submitSort()">⚔️ 攻撃する</button>`;
}
function renderSortList(container) {
    if (!container) container=document.getElementById('commandArea');
    container.innerHTML=`<div class="sortable-list">${sortState.map((item,i)=>
        `<div class="sortable-item">
            <span class="order-num">${i+1}</span>
            <span style="flex:1">${esc(item.text)}</span>
            <span class="sort-buttons">
                ${i>0?`<button class="btn btn-secondary" onclick="moveSortItem(${i},-1)">↑</button>`:''}
                ${i<sortState.length-1?`<button class="btn btn-secondary" onclick="moveSortItem(${i},1)">↓</button>`:''}
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
    animateEnemy(ok);
    showBattleFeedback(ok,q,exp,'<br><strong>正しい順序:</strong><br>'+correctText);
    showNextBtn();
}

// ===== バトルUI =====
function animateEnemy(ok) {
    const sprite=document.getElementById('enemySprite');
    const hp=document.getElementById('enemyHpFill');
    if (ok) { sprite.className='enemy-sprite hit'; hp.style.width='0%'; setTimeout(()=>sprite.className='enemy-sprite defeated',400); }
    else { hp.style.width='30%'; }
}
function showBattleFeedback(ok, q, exp, extra='') {
    if(ok){player.streak++;if(player.streak>player.bestStreak)player.bestStreak=player.streak;}else{player.streak=0;}
    const fb=document.getElementById('battleFeedback');
    fb.style.display=''; fb.className=`battle-feedback ${ok?'correct':'incorrect'}`;
    fb.innerHTML=`
        <div class="feedback-title">${ok?'⚔️ 討伐成功！':'💥 ペロッペがダメージを受けた…'}</div>
        <div class="feedback-text">${q.explanation}${extra}</div>
        ${q.point?`<div class="feedback-point"><strong>💡 ポイント:</strong> ${esc(q.point)}</div>`:''}
        <div class="exp-gained">🔷 +${exp} EXP${player.streak>=3?` 🔥 ${player.streak}連続正解！`:''}</div>`;
}
function showNextBtn() {
    const act=document.getElementById('battleActions');
    const isLast=currentQuestionIndex>=currentQuestions.length-1;
    act.innerHTML=`<button class="btn btn-primary" onclick="${isLast?'finishBattle()':'nextQ()'}">
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

    document.getElementById('resultBanner').innerHTML=`
        <h2>${correct===total?'🎉 完全制覇！':'🏆 フロアクリア！'}</h2>
        <div class="result-stars">${'⭐'.repeat(stars)}${'☆'.repeat(3-stars)}</div>
        <div class="result-rank">ランク ${rank} — ${rl}</div>`;
    document.getElementById('resultScoreArea').innerHTML=`
        <div class="result-score-num">${correct}<span class="result-score-max"> / ${total} 正解</span></div>`;
    document.getElementById('expGainArea').innerHTML=`
        <div class="exp-gained-text">🔷 +${exp} EXP 獲得！</div>`;
    document.getElementById('resultDetail').innerHTML=sessionResults.map((r,i)=>
        `<div class="result-item">
            <span class="q-label">Q${i+1}. ${truncate(r.question.question,35)}</span>
            <span class="q-result ${r.correct?'correct':'incorrect'}">+${r.exp}EXP ${r.correct?'✅':'❌'}</span>
        </div>`).join('');
}

// ===== EXP & レベルアップ =====
function addExp(amount) {
    player.exp+=amount;
    let leveled=false;
    while(player.exp>=getExpForLevel(player.level)){
        player.exp-=getExpForLevel(player.level); player.level++; leveled=true;
    }
    updatePlayerUI();
    if(leveled){ const t=getTitleInfo(player.level);
        document.getElementById('levelupLevel').textContent=`Lv.${player.level}`;
        document.getElementById('levelupTitle').textContent=`称号: ${t.title}`;
        document.getElementById('levelupOverlay').style.display='';
    }
}
function closeLevelUp() { document.getElementById('levelupOverlay').style.display='none'; }

// ===== プレイヤーUI =====
function updatePlayerUI() {
    const t=getTitleInfo(player.level);
    const needed=getExpForLevel(player.level);
    const pct=Math.min(100,Math.round((player.exp/needed)*100));

    document.getElementById('playerLevel').textContent=`Lv.${player.level}`;
    document.getElementById('expFillMini').style.width=pct+'%';

    if(document.getElementById('playerTitleLarge')){
        document.getElementById('playerTitleLarge').textContent=t.title;
        document.getElementById('playerLvLarge').textContent=`Lv.${player.level}`;
        document.getElementById('expFill').style.width=pct+'%';
        document.getElementById('expText').textContent=`EXP: ${player.exp} / ${needed}`;
        document.getElementById('peroppeSpeech').textContent=t.speech;
        const cr=player.totalAnswered>0?Math.round((player.totalCorrect/player.totalAnswered)*100)+'%':'--';
        document.getElementById('statCleared').textContent=`🏆 クリア: ${player.totalCleared}`;
        document.getElementById('statCorrect').textContent=`✅ 正答率: ${cr}`;
        document.getElementById('statStreak').textContent=`🔥 最高連続: ${player.bestStreak}`;
    }
}

// ===== セーブ/ロード =====
function savePlayer() { try{localStorage.setItem('peroppeQuest',JSON.stringify(player));}catch(e){} }
function loadPlayer() { try{const d=JSON.parse(localStorage.getItem('peroppeQuest'));if(d)player={...player,...d};}catch(e){} }

// ===== ユーティリティ =====
function esc(t){ const d=document.createElement('div');d.textContent=t;return d.innerHTML; }
function truncate(t,n){ return t.length>n?t.substring(0,n)+'...':t; }
function sid(s){ return s.replace(/[^a-zA-Z0-9\u3000-\u9FFF]/g,'_'); }

// ===== 初期化 =====
document.addEventListener('DOMContentLoaded',()=>{ loadPlayer(); showHome(); });

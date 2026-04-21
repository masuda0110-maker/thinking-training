// ===== ペロッペの思考トレーニング =====

const TITLES = [
    { level:1,  title:'見習い',      speech:'一緒に考えようね！' },
    { level:3,  title:'探索者',      speech:'どんどん解いてるよ〜！' },
    { level:5,  title:'論理の使い手', speech:'論点思考、バッチリ！' },
    { level:8,  title:'仮説家',      speech:'仮説を立てて進もう！' },
    { level:12, title:'構造化マスター', speech:'MECEも怖くない！' },
    { level:16, title:'クリティカル思考家', speech:'本質を見抜くよ！' },
    { level:20, title:'思考の達人',   speech:'どんな問題も解けるよ！' },
];

// カテゴリカラー（CSS変数に渡す）
const CAT_COLOR = {
    ronten:    '#60a5fa',
    kasetsu:   '#a78bff',
    mece:      '#34d399',
    logictree: '#fbbf24',
    action:    '#f87171',
    critical:  '#22d3ee',
};

function getExpForLevel(lvl) { return 50 + (lvl - 1) * 30; }
function getTitleInfo(lvl) {
    let r = TITLES[0];
    for (const t of TITLES) { if (lvl >= t.level) r = t; }
    return r;
}

let player = {
    level:1, exp:0,
    totalCleared:0, totalCorrect:0, totalAnswered:0,
    streak:0, bestStreak:0, cleared:{}
};

let currentCategory = null, currentDifficulty = null;
let currentQuestionIndex = 0, currentQuestions = [];
let sessionResults = [], selectedAnswer = null;
let classifyState = {}, sortState = [], selectedClassifyItem = null;

// ===== パーティクル =====
const pCanvas = document.getElementById('particleCanvas');
const pCtx    = pCanvas ? pCanvas.getContext('2d') : null;
let particles = [], pFrame = null;

function resizePC() { if (pCanvas) { pCanvas.width=innerWidth; pCanvas.height=innerHeight; } }

function burst(x, y, n, colors) {
    if (!pCanvas) return;
    for (let i=0; i<n; i++) {
        const a=Math.random()*Math.PI*2, s=2+Math.random()*5;
        particles.push({ x,y, vx:Math.cos(a)*s, vy:Math.sin(a)*s-2,
            size:4+Math.random()*7, color:colors[Math.floor(Math.random()*colors.length)],
            alpha:1, decay:0.015+Math.random()*0.02 });
    }
    if (!pFrame) pLoop();
}
function burstCenter(n) {
    burst(innerWidth/2, innerHeight/3, n, ['#fbbf24','#f87171','#fff','#a78bff','#60a5fa']);
}
function pLoop() {
    if (!pCtx) return;
    pCtx.clearRect(0,0,pCanvas.width,pCanvas.height);
    particles = particles.filter(p=>p.alpha>0.02);
    for (const p of particles) {
        p.x+=p.vx; p.y+=p.vy; p.vy+=0.15; p.alpha-=p.decay;
        pCtx.save(); pCtx.globalAlpha=Math.max(0,p.alpha); pCtx.fillStyle=p.color;
        pCtx.beginPath(); pCtx.arc(p.x,p.y,p.size/2,0,Math.PI*2); pCtx.fill();
        pCtx.restore();
    }
    if (particles.length>0) pFrame=requestAnimationFrame(pLoop);
    else { pFrame=null; pCtx.clearRect(0,0,pCanvas.width,pCanvas.height); }
}

function flash(color='rgba(255,255,255,0.7)') {
    const el=document.createElement('div'); el.className='screen-flash'; el.style.background=color;
    document.body.appendChild(el); setTimeout(()=>el.remove(),500);
}
function dmgPop(text, color, tid) {
    const ref=document.getElementById(tid); if(!ref) return;
    const r=ref.getBoundingClientRect();
    const el=document.createElement('div');
    el.textContent=text;
    el.style.cssText=`position:fixed;left:${r.left+r.width/2}px;top:${r.top+10}px;color:${color};font-size:1.6rem;font-weight:700;pointer-events:none;z-index:900;text-shadow:0 2px 6px rgba(0,0,0,0.7);animation:dmg-pop 1s ease-out forwards;`;
    document.body.appendChild(el); setTimeout(()=>el.remove(),1100);
}

// ===== 画面遷移 =====
function show(...ids) { ids.forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='';}); }
function hide(...ids) { ids.forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';}); }

function showHome() {
    hide('floorScreen','battleScreen','resultScreen');
    show('homeScreen');
    updatePlayerUI();
    renderCategoryGrid();
}
function showFloors(cat) {
    currentCategory = cat;
    hide('homeScreen','battleScreen','resultScreen');
    show('floorScreen');
    renderFloors();
}

// ===== ホーム：カテゴリグリッド =====
function renderCategoryGrid() {
    const grid = document.getElementById('categoryGrid');
    if (!grid) return;
    grid.innerHTML = '';

    for (const cat of Object.keys(CATEGORY_INFO)) {
        const info = CATEGORY_INFO[cat];
        const ce = player.cleared[`${cat}_easy`];
        const cm = player.cleared[`${cat}_medium`];
        const ch = player.cleared[`${cat}_hard`];
        const all = ce && cm && ch;
        const color = CAT_COLOR[cat] || '#7c6aff';

        const div = document.createElement('div');
        div.className = 'cat-card';
        div.style.setProperty('--c', color);
        div.onclick = () => showFloors(cat);
        div.innerHTML = `
            <div class="cat-icon">${info.icon}</div>
            <div class="cat-name">${info.name}</div>
            <div class="cat-dots">
                <div class="dot ${ce?'done-e':''}"></div>
                <div class="dot ${cm?'done-m':''}"></div>
                <div class="dot ${ch?'done-h':''}"></div>
            </div>
            ${all ? '<span class="cat-all-badge">✨ COMPLETE</span>' : ''}`;
        grid.appendChild(div);
    }
}

// ===== フロア選択 =====
function renderFloors() {
    const info = CATEGORY_INFO[currentCategory];
    const color = CAT_COLOR[currentCategory] || '#7c6aff';

    document.getElementById('dungeonHeader').innerHTML = `
        <div class="dh-icon">${info.icon}</div>
        <div><div class="dh-name">${info.name}</div><div class="dh-desc">${info.desc}</div></div>`;

    const list = document.getElementById('floorList');
    list.innerHTML = '';

    for (const [diff, dInfo] of Object.entries(DIFFICULTY_INFO)) {
        const key = `${currentCategory}_${diff}`;
        const cleared = player.cleared[key];
        const locked  = !isFloorUnlocked(currentCategory, diff);
        const qs = QUESTIONS[currentCategory][diff];
        const totalExp = qs.reduce((s,q)=>s+q.expReward, 0);
        const stars = cleared
            ? '⭐'.repeat(cleared.stars)+'☆'.repeat(3-cleared.stars)
            : '☆☆☆';

        const div = document.createElement('div');
        div.className = `floor-card${locked?' locked':''}`;
        if (!locked) div.onclick = () => startBattle(diff);
        div.innerHTML = `
            <div class="fl-left">
                <div class="fl-badge ${diff}">${dInfo.stars}★</div>
                <div>
                    <div class="fl-name">${dInfo.name}</div>
                    <div class="fl-info">${qs.length}問 · ${locked
                        ? `Lv.${dInfo.requiredLevel}以上`
                        : (cleared ? `ベスト ${cleared.bestScore}pt` : '未クリア')
                    }</div>
                </div>
            </div>
            <div class="fl-right">
                <span class="fl-stars">${stars}</span>
                ${locked ? '<span style="color:var(--text-3)">🔒</span>' : `<span class="fl-exp">+${totalExp} EXP</span>`}
            </div>`;
        list.appendChild(div);
    }
}

function isFloorUnlocked(cat, diff) {
    if (diff==='easy')   return true;
    if (diff==='medium') return player.level>=DIFFICULTY_INFO.medium.requiredLevel && !!player.cleared[`${cat}_easy`];
    if (diff==='hard')   return player.level>=DIFFICULTY_INFO.hard.requiredLevel   && !!player.cleared[`${cat}_medium`];
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
    renderQ();
}
function retryBattle() { if (currentCategory&&currentDifficulty) startBattle(currentDifficulty); }
function fleeBattle()  {
    if (sessionResults.length>0 && !confirm('途中で撤退しますか？')) return;
    showFloors(currentCategory);
}

function renderQ() {
    const q = currentQuestions[currentQuestionIndex];
    const info = CATEGORY_INFO[currentCategory];
    const dInfo = DIFFICULTY_INFO[currentDifficulty];
    selectedAnswer = null;

    document.getElementById('battleCategory').textContent = `${info.icon} ${info.name}`;
    document.getElementById('battleProgress').textContent = `${currentQuestionIndex+1} / ${currentQuestions.length}`;
    document.getElementById('enemySprite').textContent    = q.enemy.sprite;
    document.getElementById('enemySprite').className     = 'enemy-sprite';
    document.getElementById('enemyName').textContent     = q.enemy.name;
    document.getElementById('enemyHpFill').style.width   = '100%';
    document.getElementById('peroppeHpFill').style.width = '100%';
    document.getElementById('scenarioText').innerHTML    = esc(q.scenario).replace(/\n/g,'<br>');
    document.getElementById('questionText').innerHTML    = `Q${currentQuestionIndex+1}. ${esc(q.question)}`;

    const bpSvg = document.querySelector('#battlePeroppe svg');
    if (bpSvg) bpSvg.classList.remove('attack','damaged');

    const fb = document.getElementById('battleFeedback');
    fb.style.display='none'; fb.className='feedback-card';

    const cmd = document.getElementById('commandArea');
    const act = document.getElementById('battleActions');
    switch (q.type) {
        case 'choice':   renderChoice(q, cmd, act); break;
        case 'text':     renderText(q, cmd, act);   break;
        case 'classify': renderClassify(q, cmd, act); break;
        case 'sort':     renderSort(q, cmd, act);   break;
    }
}

// ---- Choice ----
function renderChoice(q, cmd, act) {
    const ms=['A','B','C','D','E'];
    cmd.innerHTML=`<div class="choice-list">${q.choices.map((c,i)=>
        `<div class="choice-item" onclick="selectChoice(${i})">
            <span class="choice-marker">${ms[i]}</span><span>${esc(c)}</span>
        </div>`).join('')}</div>`;
    act.innerHTML=`<button class="btn btn-primary" id="submitBtn" onclick="submitChoice()" disabled>回答する</button>`;
}
function selectChoice(i) {
    if (selectedAnswer!==null && document.querySelector('.choice-item.correct')) return;
    selectedAnswer=i;
    document.querySelectorAll('.choice-item').forEach((el,j)=>el.classList.toggle('selected',j===i));
    document.getElementById('submitBtn').disabled=false;
}
function submitChoice() {
    const q=currentQuestions[currentQuestionIndex];
    const ok=selectedAnswer===q.correct;
    document.querySelectorAll('.choice-item').forEach((el,i)=>{
        el.classList.remove('selected');
        if(i===q.correct) el.classList.add('correct');
        if(i===selectedAnswer&&!ok) el.classList.add('incorrect');
    });
    const exp=ok?q.expReward:Math.round(q.expReward*0.2);
    sessionResults.push({question:q,correct:ok,exp});
    animateBattle(ok,exp);
    showFeedback(ok,q,exp);
    showNext();
}

// ---- Text ----
function renderText(q, cmd, act) {
    cmd.innerHTML=`<div class="text-input-area">
        <textarea id="textAnswer" placeholder="ここに回答を入力..."></textarea>
        ${q.hint?`<div class="hint">💡 ${esc(q.hint).replace(/\n/g,'<br>')}`:''}
    </div>`;
    act.innerHTML=`
        <button class="btn btn-ghost" onclick="showSample()">模範解答を見る</button>
        <button class="btn btn-primary" onclick="submitText()">回答する</button>`;
}
function showSample() {
    const q=currentQuestions[currentQuestionIndex];
    const fb=document.getElementById('battleFeedback');
    fb.style.display=''; fb.className='feedback-card';
    fb.innerHTML=`<div class="feedback-title">📖 模範解答</div><div class="feedback-text">${esc(q.sampleAnswer).replace(/\n/g,'<br>')}</div>`;
}
function submitText() {
    const q=currentQuestions[currentQuestionIndex];
    const ans=document.getElementById('textAnswer').value.trim();
    if(!ans){alert('回答を入力してください');return;}
    const exp=Math.round(q.expReward*0.7);
    sessionResults.push({question:q,correct:true,exp,userAnswer:ans});
    animateBattle(true,exp);
    const fb=document.getElementById('battleFeedback');
    fb.style.display=''; fb.className='feedback-card correct';
    fb.innerHTML=`
        <div class="feedback-title">✅ 回答しました</div>
        <div class="feedback-text"><strong>あなたの回答:</strong><br>${esc(ans).replace(/\n/g,'<br>')}</div>
        <div class="feedback-point"><strong>📖 模範解答:</strong><br>${esc(q.sampleAnswer).replace(/\n/g,'<br>')}</div>
        ${q.evaluationPoints?`<div class="feedback-point"><strong>✅ ポイント:</strong><br>${q.evaluationPoints.map(p=>'・'+esc(p)).join('<br>')}</div>`:''}
        <div class="exp-gained">+${exp} EXP</div>`;
    showNext();
}

// ---- Classify ----
function renderClassify(q, cmd, act) {
    classifyState={}; q.buckets.forEach(b=>classifyState[b]=[]); selectedClassifyItem=null;
    const sh=[...q.items].sort(()=>Math.random()-0.5);
    cmd.innerHTML=`<div class="classify-area">
        <div class="classify-items">${sh.map(item=>
            `<span class="classify-chip" data-item="${esc(item)}" onclick="selectCI(this)">${esc(item)}</span>`).join('')}</div>
        <div class="classify-buckets">${q.buckets.map(b=>
            `<div class="classify-bucket" onclick="placeCI('${esc(b)}')">
                <h5>${esc(b)}</h5>
                <div class="bucket-items" id="bkt-${sid(b)}"></div>
            </div>`).join('')}</div>
    </div>`;
    act.innerHTML=`<button class="btn btn-primary" onclick="submitClassify()">回答する</button>`;
}
function selectCI(el) {
    document.querySelectorAll('.classify-chip').forEach(c=>c.style.outline='');
    el.style.outline='2px solid var(--accent)'; selectedClassifyItem=el.dataset.item;
}
function placeCI(b) {
    if(!selectedClassifyItem) return;
    for(const k in classifyState) classifyState[k]=classifyState[k].filter(i=>i!==selectedClassifyItem);
    classifyState[b].push(selectedClassifyItem);
    document.querySelectorAll('.classify-chip').forEach(c=>{if(c.dataset.item===selectedClassifyItem){c.classList.add('placed');c.style.outline='';}});
    renderBkts(); selectedClassifyItem=null;
}
function renderBkts() {
    const q=currentQuestions[currentQuestionIndex];
    q.buckets.forEach(b=>{
        const el=document.getElementById('bkt-'+sid(b));
        if(el) el.innerHTML=classifyState[b].map(item=>
            `<span class="bucket-chip" onclick="removeCI('${esc(b)}','${esc(item)}')">${esc(item)} ✕</span>`).join('');
    });
}
function removeCI(b,item) {
    classifyState[b]=classifyState[b].filter(i=>i!==item);
    document.querySelectorAll('.classify-chip').forEach(c=>{if(c.dataset.item===item)c.classList.remove('placed');});
    renderBkts();
}
function submitClassify() {
    const q=currentQuestions[currentQuestionIndex];
    let correct=0,total=q.items.length;
    for(const b in q.correctMapping) q.correctMapping[b].forEach(item=>{if((classifyState[b]||[]).includes(item))correct++;});
    const ok=correct===total;
    const exp=Math.round(q.expReward*(ok?1:(correct/total)*0.5));
    sessionResults.push({question:q,correct:ok,exp});
    let detail=''; for(const b in q.correctMapping) detail+=`<strong>${b}:</strong> ${q.correctMapping[b].join('、')}<br>`;
    animateBattle(ok,exp);
    showFeedback(ok,q,exp,'<br>'+detail);
    showNext();
}

// ---- Sort ----
function renderSort(q, cmd, act) {
    sortState=q.items.map((text,i)=>({text,originalIndex:i}));
    for(let i=sortState.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[sortState[i],sortState[j]]=[sortState[j],sortState[i]];}
    renderSortList(cmd);
    act.innerHTML=`<button class="btn btn-primary" onclick="submitSort()">回答する</button>`;
}
function renderSortList(container) {
    if(!container) container=document.getElementById('commandArea');
    container.innerHTML=`<div class="sortable-list">${sortState.map((item,i)=>
        `<div class="sortable-item">
            <span class="order-num">${i+1}</span>
            <span style="flex:1">${esc(item.text)}</span>
            <span class="sort-buttons">
                ${i>0?`<button class="btn btn-ghost" style="padding:5px 10px" onclick="moveSI(${i},-1)">↑</button>`:''}
                ${i<sortState.length-1?`<button class="btn btn-ghost" style="padding:5px 10px" onclick="moveSI(${i},1)">↓</button>`:''}
            </span>
        </div>`).join('')}</div>`;
}
function moveSI(i,dir){const j=i+dir;if(j<0||j>=sortState.length)return;[sortState[i],sortState[j]]=[sortState[j],sortState[i]];renderSortList();}
function submitSort() {
    const q=currentQuestions[currentQuestionIndex];
    const uo=sortState.map(s=>s.originalIndex);
    let correct=0; uo.forEach((v,i)=>{if(v===q.correctOrder[i])correct++;});
    const ok=correct===q.correctOrder.length;
    const exp=Math.round(q.expReward*(ok?1:(correct/q.correctOrder.length)*0.5));
    sessionResults.push({question:q,correct:ok,exp});
    const ct=q.correctOrder.map((idx,i)=>`${i+1}. ${q.items[idx]}`).join('<br>');
    animateBattle(ok,exp);
    showFeedback(ok,q,exp,'<br>'+ct);
    showNext();
}

// ===== バトルエフェクト =====
function animateBattle(ok, exp) {
    const sprite = document.getElementById('enemySprite');
    const hp     = document.getElementById('enemyHpFill');
    const bpSvg  = document.querySelector('#battlePeroppe svg');
    const php    = document.getElementById('peroppeHpFill');

    if (ok) {
        if (bpSvg) { bpSvg.classList.add('attack'); setTimeout(()=>bpSvg.classList.remove('attack'),550); }
        if (sprite) {
            sprite.classList.add('hit');
            setTimeout(()=>{ sprite.classList.remove('hit'); sprite.classList.add('defeated'); if(hp) hp.style.width='0%'; }, 380);
        }
        setTimeout(()=>flash('rgba(255,255,255,0.5)'), 140);
        setTimeout(()=>dmgPop(`💥 ${exp}`, '#fbbf24', 'enemySprite'), 180);
        setTimeout(()=>{
            const r=document.getElementById('enemySprite')?.getBoundingClientRect();
            if(r) burst(r.left+r.width/2, r.top+r.height/2, 22, ['#fbbf24','#f87171','#fff','#a78bff']);
        }, 280);
    } else {
        if (bpSvg) { bpSvg.classList.add('damaged'); setTimeout(()=>bpSvg.classList.remove('damaged'),600); }
        if (php) { const c=parseInt(php.style.width)||100; php.style.width=Math.max(10,c-28)+'%'; }
        setTimeout(()=>dmgPop('💦', '#f87171', 'battlePeroppe'), 80);
        setTimeout(()=>flash('rgba(255,50,50,0.3)'), 80);
    }
}

function showFeedback(ok, q, exp, extra='') {
    if(ok){player.streak++;if(player.streak>player.bestStreak)player.bestStreak=player.streak;}else{player.streak=0;}
    const fb=document.getElementById('battleFeedback');
    fb.style.display=''; fb.className=`feedback-card ${ok?'correct':'incorrect'}`;
    fb.innerHTML=`
        <div class="feedback-title">${ok?'✅ 正解！':'❌ 不正解'}</div>
        <div class="feedback-text">${q.explanation||''}${extra}</div>
        ${q.point?`<div class="feedback-point"><strong>💡 ポイント:</strong> ${esc(q.point)}</div>`:''}
        <div class="exp-gained">+${exp} EXP${player.streak>=3?` 🔥 ${player.streak}連続！`:''}</div>`;
}

function showNext() {
    const act=document.getElementById('battleActions');
    const last=currentQuestionIndex>=currentQuestions.length-1;
    act.innerHTML=`<button class="btn btn-primary" onclick="${last?'finishBattle()':'nextQ()'}">
        ${last?'結果を見る →':'次の問題 →'}</button>`;
}
function nextQ() { currentQuestionIndex++; renderQ(); window.scrollTo({top:0,behavior:'smooth'}); }

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
    let rank='D',rl='もう一回！';
    if(pct>=90){rank='S';rl='エキスパート';}
    else if(pct>=70){rank='A';rl='上級者';}
    else if(pct>=50){rank='B';rl='中級者';}
    else if(pct>=30){rank='C';rl='初級者';}

    const bn=document.getElementById('resultBannerTitle');
    if(bn) bn.textContent = correct===total?'🎉 完全制覇！':'🏆 フロアクリア！';

    document.getElementById('resultScoreArea').innerHTML=`
        <div class="result-rank-badge">ランク ${rank}<span class="rank-label">${rl}</span></div>
        <div class="result-stars">${'⭐'.repeat(stars)}${'☆'.repeat(3-stars)}</div>
        <div class="result-score-num">${correct}<span class="result-score-max"> / ${total} 正解</span></div>`;
    document.getElementById('expGainArea').innerHTML=`+${exp} EXP 獲得！`;
    document.getElementById('resultDetail').innerHTML=sessionResults.map((r,i)=>
        `<div class="result-item">
            <span class="q-label">Q${i+1}. ${truncate(r.question.question,34)}</span>
            <span class="q-result ${r.correct?'correct':'incorrect'}">+${r.exp}EXP ${r.correct?'✅':'❌'}</span>
        </div>`).join('');
    if(pct>=70){setTimeout(()=>burstCenter(36),300);if(pct>=90)setTimeout(()=>burstCenter(36),900);}
}

// ===== EXP & LevelUp =====
function addExp(amount) {
    player.exp+=amount; let leveled=false;
    while(player.exp>=getExpForLevel(player.level)){player.exp-=getExpForLevel(player.level);player.level++;leveled=true;}
    updatePlayerUI();
    if(leveled){
        const t=getTitleInfo(player.level);
        const lv=document.getElementById('levelupLevel'); if(lv) lv.textContent=`Lv.${player.level}`;
        const lt=document.getElementById('levelupTitle'); if(lt) lt.textContent=t.title;
        const ov=document.getElementById('levelupOverlay'); if(ov) ov.style.display='';
        setTimeout(()=>burstCenter(60),200); setTimeout(()=>burstCenter(40),800);
        flash('rgba(124,106,255,0.4)');
    }
}
function closeLevelUp(){const o=document.getElementById('levelupOverlay');if(o)o.style.display='none';}

// ===== Player UI =====
function updatePlayerUI() {
    const t=getTitleInfo(player.level);
    const needed=getExpForLevel(player.level);
    const pct=Math.min(100,Math.round((player.exp/needed)*100));
    const s=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
    const w=(id,v)=>{const e=document.getElementById(id);if(e)e.style.width=v;};
    s('playerLevel',`Lv.${player.level}`);
    w('expFillMini',pct+'%');
    s('playerTitleLarge',t.title);
    s('playerLvLarge',`Lv.${player.level}`);
    w('expFill',pct+'%');
    s('expText',`${player.exp}/${needed}`);
    s('peroppeSpeech',t.speech);
    const cr=player.totalAnswered>0?Math.round((player.totalCorrect/player.totalAnswered)*100)+'%':'--';
    s('statCleared',player.totalCleared);
    s('statCorrect',cr);
    s('statStreak',player.bestStreak);
}

// ===== Save/Load =====
function savePlayer(){try{localStorage.setItem('peroppeApp',JSON.stringify(player));}catch(e){}}
function loadPlayer(){try{const d=JSON.parse(localStorage.getItem('peroppeApp'));if(d)player={...player,...d};}catch(e){}}

// ===== Utils =====
function esc(t){const d=document.createElement('div');d.textContent=String(t||'');return d.innerHTML;}
function truncate(t,n){return t.length>n?t.substring(0,n)+'…':t;}
function sid(s){return s.replace(/[^a-zA-Z0-9\u3000-\u9FFF]/g,'_');}

// ===== Init =====
document.addEventListener('DOMContentLoaded',()=>{
    resizePC(); window.addEventListener('resize',resizePC);
    loadPlayer(); showHome();
});

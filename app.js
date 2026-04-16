// ===== RPG思考トレーニング アプリロジック =====

// ----- プレイヤーデータ -----
const TITLES = [
    { level: 1,  title: '見習い冒険者',       avatar: '🧑' },
    { level: 3,  title: '思考の探索者',       avatar: '🧑‍💼' },
    { level: 5,  title: '論理の剣士',         avatar: '⚔️' },
    { level: 8,  title: '仮説の魔術師',       avatar: '🧙' },
    { level: 12, title: '構造化の賢者',       avatar: '🧙‍♂️' },
    { level: 16, title: 'クリティカルマスター', avatar: '👑' },
    { level: 20, title: '思考の覇王',         avatar: '🐲' },
];

function getExpForLevel(level) {
    return 50 + (level - 1) * 30;
}

function getTitleForLevel(level) {
    let result = TITLES[0];
    for (const t of TITLES) {
        if (level >= t.level) result = t;
    }
    return result;
}

let player = {
    level: 1,
    exp: 0,
    totalCleared: 0,
    totalCorrect: 0,
    totalAnswered: 0,
    streak: 0,
    bestStreak: 0,
    cleared: {} // { 'ronten_easy': { stars: 3, bestScore: 30 }, ... }
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
    hide('floorScreen', 'battleScreen', 'resultScreen');
    show('homeScreen');
    renderHome();
}

function showFloors(category) {
    currentCategory = category;
    hide('homeScreen', 'battleScreen', 'resultScreen');
    show('floorScreen');
    renderFloors();
}

function showBattle() {
    hide('homeScreen', 'floorScreen', 'resultScreen');
    show('battleScreen');
}

function showResult() {
    hide('homeScreen', 'floorScreen', 'battleScreen');
    show('resultScreen');
    renderResult();
}

function show(...ids) { ids.forEach(id => document.getElementById(id).style.display = ''); }
function hide(...ids) { ids.forEach(id => document.getElementById(id).style.display = 'none'); }

// ===== ホーム画面 =====
function renderHome() {
    updatePlayerUI();
    const grid = document.getElementById('dungeonGrid');
    grid.innerHTML = '';
    for (const [key, info] of Object.entries(CATEGORY_INFO)) {
        const card = document.createElement('div');
        card.className = 'dungeon-card';
        card.dataset.category = key;
        card.onclick = () => showFloors(key);

        const floors = ['easy', 'medium', 'hard'].map(d => {
            const k = `${key}_${d}`;
            const cleared = player.cleared[k];
            const locked = !isFloorUnlocked(key, d);
            let cls = locked ? 'locked' : (cleared ? 'cleared' : 'available');
            return `<span class="floor-badge ${cls}">${DIFFICULTY_INFO[d].label}${cleared ? ' ★' : (locked ? ' 🔒' : '')}</span>`;
        }).join('');

        const allCleared = ['easy','medium','hard'].every(d => player.cleared[`${key}_${d}`]);

        card.innerHTML = `
            <div class="dungeon-icon">${info.icon}</div>
            <h3>${info.name}</h3>
            <p>${info.desc}</p>
            <div class="dungeon-floors">${floors}</div>
            ${allCleared ? '<span class="dungeon-clear-mark">✨ COMPLETE</span>' : ''}
        `;
        grid.appendChild(card);
    }
}

// ===== フロア選択画面 =====
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
        const questions = QUESTIONS[currentCategory][diff];
        const totalExp = questions.reduce((s, q) => s + q.expReward, 0);

        const card = document.createElement('div');
        card.className = `floor-card${locked ? ' locked' : ''}`;
        if (!locked) card.onclick = () => startBattle(diff);

        const stars = cleared
            ? '⭐'.repeat(cleared.stars) + '☆'.repeat(3 - cleared.stars)
            : '☆☆☆';

        card.innerHTML = `
            <div class="floor-left">
                <div class="floor-num ${diff}">F${dInfo.stars}</div>
                <div class="floor-info">
                    <h4>${dInfo.name}</h4>
                    <p>${questions.length}問 ・ ${locked ? `Lv.${dInfo.requiredLevel}で解放` : (cleared ? `ベスト: ${cleared.bestScore}pt` : '未クリア')}</p>
                </div>
            </div>
            <div class="floor-right">
                <div class="floor-stars">${stars}</div>
                ${locked
                    ? '<span class="lock-icon">🔒</span>'
                    : `<span class="floor-reward">+${totalExp} EXP</span>`
                }
            </div>
        `;
        list.appendChild(card);
    }
}

function isFloorUnlocked(category, difficulty) {
    if (difficulty === 'easy') return true;
    if (difficulty === 'medium') return player.level >= DIFFICULTY_INFO.medium.requiredLevel && !!player.cleared[`${category}_easy`];
    if (difficulty === 'hard') return player.level >= DIFFICULTY_INFO.hard.requiredLevel && !!player.cleared[`${category}_medium`];
    return false;
}

// ===== バトル =====
function startBattle(difficulty) {
    currentDifficulty = difficulty;
    currentQuestionIndex = 0;
    sessionResults = [];
    currentQuestions = [...QUESTIONS[currentCategory][difficulty]];
    showBattle();
    renderBattleQuestion();
}

function retryBattle() {
    if (currentCategory && currentDifficulty) {
        startBattle(currentDifficulty);
    }
}

function fleeBattle() {
    if (sessionResults.length > 0) {
        if (!confirm('途中で撤退すると進捗が失われます。撤退しますか？')) return;
    }
    showFloors(currentCategory);
}

function renderBattleQuestion() {
    const q = currentQuestions[currentQuestionIndex];
    const info = CATEGORY_INFO[currentCategory];
    const dInfo = DIFFICULTY_INFO[currentDifficulty];
    selectedAnswer = null;

    // HUD
    document.getElementById('battleCategory').textContent = `${info.icon} ${info.name}`;
    document.getElementById('battleProgress').textContent = `${dInfo.label} ${currentQuestionIndex + 1}/${currentQuestions.length}`;

    // Enemy
    document.getElementById('enemySprite').textContent = q.enemy.sprite;
    document.getElementById('enemySprite').className = 'enemy-sprite';
    document.getElementById('enemyName').textContent = q.enemy.name;
    document.getElementById('enemyHpFill').style.width = '100%';

    // Message
    document.getElementById('scenarioText').innerHTML = escapeHtml(q.scenario).replace(/\n/g, '<br>');
    document.getElementById('questionText').innerHTML = `Q${currentQuestionIndex + 1}. ${escapeHtml(q.question)}`;

    // Hide feedback
    const fb = document.getElementById('battleFeedback');
    fb.style.display = 'none';
    fb.className = 'battle-feedback';

    // Render answer area
    const cmdArea = document.getElementById('commandArea');
    const actArea = document.getElementById('battleActions');

    switch (q.type) {
        case 'choice': renderChoiceQ(q, cmdArea, actArea); break;
        case 'text':   renderTextQ(q, cmdArea, actArea); break;
        case 'classify': renderClassifyQ(q, cmdArea, actArea); break;
        case 'sort':   renderSortQ(q, cmdArea, actArea); break;
    }
}

// ----- Choice -----
function renderChoiceQ(q, cmd, act) {
    const markers = ['A','B','C','D','E'];
    cmd.innerHTML = `<div class="choice-list">${q.choices.map((c, i) =>
        `<div class="choice-item" data-index="${i}" onclick="selectChoice(${i})">
            <span class="choice-marker">${markers[i]}</span><span>${escapeHtml(c)}</span>
        </div>`
    ).join('')}</div>`;
    act.innerHTML = `<button class="btn btn-primary" onclick="submitChoice()" id="submitBtn" disabled>⚔️ 攻撃する</button>`;
}

function selectChoice(i) {
    if (selectedAnswer !== null && document.querySelector('.choice-item.correct')) return;
    selectedAnswer = i;
    document.querySelectorAll('.choice-item').forEach((el, j) => el.classList.toggle('selected', j === i));
    document.getElementById('submitBtn').disabled = false;
}

function submitChoice() {
    const q = currentQuestions[currentQuestionIndex];
    const isCorrect = selectedAnswer === q.correct;

    document.querySelectorAll('.choice-item').forEach((el, i) => {
        el.classList.remove('selected');
        if (i === q.correct) el.classList.add('correct');
        if (i === selectedAnswer && !isCorrect) el.classList.add('incorrect');
    });

    const earnedExp = isCorrect ? q.expReward : Math.round(q.expReward * 0.2);
    sessionResults.push({ question: q, correct: isCorrect, exp: earnedExp });

    animateEnemy(isCorrect);
    showBattleFeedback(isCorrect, q, earnedExp);
    showNextBtn();
}

// ----- Text -----
function renderTextQ(q, cmd, act) {
    cmd.innerHTML = `<div class="text-input-area">
        <textarea id="textAnswer" placeholder="ここに回答を入力...">${''}</textarea>
        ${q.hint ? `<div class="hint">💡 ヒント: ${escapeHtml(q.hint).replace(/\n/g, '<br>')}</div>` : ''}
    </div>`;
    act.innerHTML = `
        <button class="btn btn-secondary" onclick="showSampleAnswer()">📖 模範解答</button>
        <button class="btn btn-primary" onclick="submitText()">⚔️ 回答する</button>
    `;
}

function showSampleAnswer() {
    const q = currentQuestions[currentQuestionIndex];
    const fb = document.getElementById('battleFeedback');
    fb.style.display = '';
    fb.className = 'battle-feedback';
    fb.innerHTML = `<div class="feedback-title">📖 模範解答</div>
        <div class="feedback-text">${escapeHtml(q.sampleAnswer).replace(/\n/g, '<br>')}</div>`;
}

function submitText() {
    const q = currentQuestions[currentQuestionIndex];
    const answer = document.getElementById('textAnswer').value.trim();
    if (!answer) { alert('回答を入力してください'); return; }

    const earnedExp = Math.round(q.expReward * 0.7);
    sessionResults.push({ question: q, correct: true, exp: earnedExp, userAnswer: answer });

    animateEnemy(true);
    const fb = document.getElementById('battleFeedback');
    fb.style.display = '';
    fb.className = 'battle-feedback correct';
    fb.innerHTML = `
        <div class="feedback-title">⚔️ 討伐成功！</div>
        <div class="feedback-text"><strong>あなたの回答:</strong><br>${escapeHtml(answer).replace(/\n/g, '<br>')}</div>
        <div class="feedback-point"><strong>📖 模範解答:</strong><br>${escapeHtml(q.sampleAnswer).replace(/\n/g, '<br>')}</div>
        <div class="feedback-point" style="margin-top:8px"><strong>✅ 評価ポイント:</strong><br>${q.evaluationPoints.map(p => '・' + escapeHtml(p)).join('<br>')}</div>
        <div class="exp-gained">🔷 +${earnedExp} EXP</div>
    `;
    showNextBtn();
}

// ----- Classify -----
function renderClassifyQ(q, cmd, act) {
    classifyState = {};
    q.buckets.forEach(b => classifyState[b] = []);
    selectedClassifyItem = null;
    const shuffled = [...q.items].sort(() => Math.random() - 0.5);

    cmd.innerHTML = `<div class="classify-area">
        <div class="classify-items" id="classifyItems">${shuffled.map(item =>
            `<span class="classify-chip" data-item="${escapeHtml(item)}" onclick="selectClassifyItem(this)">${escapeHtml(item)}</span>`
        ).join('')}</div>
        <div class="classify-buckets">${q.buckets.map(b =>
            `<div class="classify-bucket" data-bucket="${escapeHtml(b)}" onclick="placeInBucket('${escapeHtml(b)}')">
                <h5>${escapeHtml(b)}</h5>
                <div class="bucket-items" id="bucket-${sanitizeId(b)}"></div>
            </div>`
        ).join('')}</div>
    </div>`;
    act.innerHTML = `<button class="btn btn-primary" onclick="submitClassify()">⚔️ 攻撃する</button>`;
}

function selectClassifyItem(el) {
    document.querySelectorAll('.classify-chip').forEach(c => c.style.outline = '');
    el.style.outline = '2px solid var(--gold)';
    selectedClassifyItem = el.dataset.item;
}

function placeInBucket(bucket) {
    if (!selectedClassifyItem) return;
    for (const b in classifyState) classifyState[b] = classifyState[b].filter(i => i !== selectedClassifyItem);
    classifyState[bucket].push(selectedClassifyItem);
    document.querySelectorAll('.classify-chip').forEach(c => {
        if (c.dataset.item === selectedClassifyItem) { c.classList.add('placed'); c.style.outline = ''; }
    });
    renderBuckets();
    selectedClassifyItem = null;
}

function renderBuckets() {
    const q = currentQuestions[currentQuestionIndex];
    q.buckets.forEach(b => {
        const el = document.getElementById('bucket-' + sanitizeId(b));
        if (el) el.innerHTML = classifyState[b].map(item =>
            `<span class="bucket-chip" onclick="removeFromBucket('${escapeHtml(b)}','${escapeHtml(item)}')">${escapeHtml(item)} ✕</span>`
        ).join('');
    });
}

function removeFromBucket(bucket, item) {
    classifyState[bucket] = classifyState[bucket].filter(i => i !== item);
    document.querySelectorAll('.classify-chip').forEach(c => { if (c.dataset.item === item) c.classList.remove('placed'); });
    renderBuckets();
}

function submitClassify() {
    const q = currentQuestions[currentQuestionIndex];
    let correctCount = 0, totalItems = q.items.length;
    for (const bucket in q.correctMapping) {
        q.correctMapping[bucket].forEach(item => { if ((classifyState[bucket] || []).includes(item)) correctCount++; });
    }
    const isCorrect = correctCount === totalItems;
    const ratio = correctCount / totalItems;
    const earnedExp = Math.round(q.expReward * (isCorrect ? 1 : ratio * 0.5));
    sessionResults.push({ question: q, correct: isCorrect, exp: earnedExp });

    let detail = '';
    for (const b in q.correctMapping) detail += `<strong>${b}:</strong> ${q.correctMapping[b].join('、')}<br>`;
    animateEnemy(isCorrect);
    showBattleFeedback(isCorrect, q, earnedExp, '<br><strong>正解の分類:</strong><br>' + detail);
    showNextBtn();
}

// ----- Sort -----
function renderSortQ(q, cmd, act) {
    sortState = q.items.map((text, i) => ({ text, originalIndex: i }));
    for (let i = sortState.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [sortState[i], sortState[j]] = [sortState[j], sortState[i]];
    }
    renderSortList(cmd);
    act.innerHTML = `<button class="btn btn-primary" onclick="submitSort()">⚔️ 攻撃する</button>`;
}

function renderSortList(container) {
    if (!container) container = document.getElementById('commandArea');
    container.innerHTML = `<div class="sortable-list">${sortState.map((item, i) =>
        `<div class="sortable-item">
            <span class="order-num">${i + 1}</span>
            <span style="flex:1">${escapeHtml(item.text)}</span>
            <span class="sort-buttons">
                ${i > 0 ? `<button class="btn btn-secondary" onclick="moveSortItem(${i},-1)">↑</button>` : ''}
                ${i < sortState.length - 1 ? `<button class="btn btn-secondary" onclick="moveSortItem(${i},1)">↓</button>` : ''}
            </span>
        </div>`
    ).join('')}</div>`;
}

function moveSortItem(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= sortState.length) return;
    [sortState[i], sortState[j]] = [sortState[j], sortState[i]];
    renderSortList();
}

function submitSort() {
    const q = currentQuestions[currentQuestionIndex];
    const userOrder = sortState.map(s => s.originalIndex);
    let correctCount = 0;
    userOrder.forEach((v, i) => { if (v === q.correctOrder[i]) correctCount++; });
    const isCorrect = correctCount === q.correctOrder.length;
    const ratio = correctCount / q.correctOrder.length;
    const earnedExp = Math.round(q.expReward * (isCorrect ? 1 : ratio * 0.5));
    sessionResults.push({ question: q, correct: isCorrect, exp: earnedExp });

    const correctText = q.correctOrder.map((idx, i) => `${i + 1}. ${q.items[idx]}`).join('<br>');
    animateEnemy(isCorrect);
    showBattleFeedback(isCorrect, q, earnedExp, '<br><strong>正しい順序:</strong><br>' + correctText);
    showNextBtn();
}

// ===== バトルUI =====
function animateEnemy(isCorrect) {
    const sprite = document.getElementById('enemySprite');
    const hp = document.getElementById('enemyHpFill');
    if (isCorrect) {
        sprite.className = 'enemy-sprite hit';
        hp.style.width = '0%';
        setTimeout(() => { sprite.className = 'enemy-sprite defeated'; }, 400);
    } else {
        hp.style.width = '30%';
    }
}

function showBattleFeedback(isCorrect, q, earnedExp, extraHtml) {
    const fb = document.getElementById('battleFeedback');
    fb.style.display = '';
    fb.className = `battle-feedback ${isCorrect ? 'correct' : 'incorrect'}`;

    if (isCorrect) { player.streak++; if (player.streak > player.bestStreak) player.bestStreak = player.streak; }
    else { player.streak = 0; }

    fb.innerHTML = `
        <div class="feedback-title">${isCorrect ? '⚔️ 討伐成功！' : '💥 ダメージを受けた…'}</div>
        <div class="feedback-text">${q.explanation}${extraHtml || ''}</div>
        ${q.point ? `<div class="feedback-point"><strong>💡 ポイント:</strong> ${escapeHtml(q.point)}</div>` : ''}
        <div class="exp-gained">🔷 +${earnedExp} EXP${player.streak >= 3 ? ` 🔥 ${player.streak}連続正解！` : ''}</div>
    `;
}

function showNextBtn() {
    const act = document.getElementById('battleActions');
    const isLast = currentQuestionIndex >= currentQuestions.length - 1;
    act.innerHTML = `<button class="btn btn-primary" onclick="${isLast ? 'finishBattle()' : 'nextBattleQ()'}">
        ${isLast ? '🏆 結果を見る' : '➡️ 次のバトルへ'}
    </button>`;
}

function nextBattleQ() {
    currentQuestionIndex++;
    renderBattleQuestion();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function finishBattle() {
    // Calculate & apply results
    const totalExp = sessionResults.reduce((s, r) => s + r.exp, 0);
    const correctCount = sessionResults.filter(r => r.correct).length;
    const totalQ = sessionResults.length;
    const percentage = Math.round((correctCount / totalQ) * 100);

    // Stars
    let stars = 0;
    if (percentage >= 30) stars = 1;
    if (percentage >= 70) stars = 2;
    if (percentage >= 90) stars = 3;

    // Save floor progress
    const key = `${currentCategory}_${currentDifficulty}`;
    const prev = player.cleared[key];
    if (!prev || stars > prev.stars || totalExp > prev.bestScore) {
        player.cleared[key] = {
            stars: Math.max(stars, prev ? prev.stars : 0),
            bestScore: Math.max(totalExp, prev ? prev.bestScore : 0)
        };
    }
    if (!prev) player.totalCleared++;
    player.totalCorrect += correctCount;
    player.totalAnswered += totalQ;

    // Apply EXP & check level up
    addExp(totalExp);
    savePlayer();
    showResult();
}

// ===== 結果画面 =====
function renderResult() {
    const totalExp = sessionResults.reduce((s, r) => s + r.exp, 0);
    const correctCount = sessionResults.filter(r => r.correct).length;
    const totalQ = sessionResults.length;
    const percentage = Math.round((correctCount / totalQ) * 100);

    let stars = 0;
    if (percentage >= 30) stars = 1;
    if (percentage >= 70) stars = 2;
    if (percentage >= 90) stars = 3;

    let rank, rankLabel;
    if (percentage >= 90) { rank = 'S'; rankLabel = 'エキスパート'; }
    else if (percentage >= 70) { rank = 'A'; rankLabel = '上級者'; }
    else if (percentage >= 50) { rank = 'B'; rankLabel = '中級者'; }
    else if (percentage >= 30) { rank = 'C'; rankLabel = '初級者'; }
    else { rank = 'D'; rankLabel = '入門'; }

    document.getElementById('resultBanner').innerHTML = `
        <h2>🏆 フロアクリア！</h2>
        <div class="result-stars">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
        <div class="result-rank">ランク ${rank} — ${rankLabel}</div>
    `;

    const maxExp = currentQuestions.reduce((s, q) => s + q.expReward, 0);
    document.getElementById('resultScoreArea').innerHTML = `
        <div class="result-score-num">${correctCount}<span class="result-score-max"> / ${totalQ} 正解</span></div>
    `;

    document.getElementById('expGainArea').innerHTML = `
        <div class="exp-gained-text">🔷 +${totalExp} EXP 獲得！</div>
    `;

    document.getElementById('resultDetail').innerHTML = sessionResults.map((r, i) =>
        `<div class="result-item">
            <span class="q-label">Q${i + 1}. ${truncate(r.question.question, 35)}</span>
            <span class="q-result ${r.correct ? 'correct' : 'incorrect'}">+${r.exp} EXP ${r.correct ? '✅' : '❌'}</span>
        </div>`
    ).join('');
}

// ===== レベルアップ =====
function addExp(amount) {
    player.exp += amount;
    let leveledUp = false;
    let needed = getExpForLevel(player.level);

    while (player.exp >= needed) {
        player.exp -= needed;
        player.level++;
        leveledUp = true;
        needed = getExpForLevel(player.level);
    }

    updatePlayerUI();

    if (leveledUp) {
        const t = getTitleForLevel(player.level);
        document.getElementById('levelupLevel').textContent = `Lv.${player.level}`;
        document.getElementById('levelupTitle').textContent = `称号: ${t.title}`;
        document.getElementById('levelupOverlay').style.display = '';
    }
}

function closeLevelUp() {
    document.getElementById('levelupOverlay').style.display = 'none';
}

// ===== プレイヤーUI更新 =====
function updatePlayerUI() {
    const t = getTitleForLevel(player.level);
    const needed = getExpForLevel(player.level);
    const pct = Math.min(100, Math.round((player.exp / needed) * 100));

    // Header
    document.getElementById('playerTitle').textContent = t.title;
    document.getElementById('playerLevel').textContent = `Lv.${player.level}`;
    document.getElementById('expFillMini').style.width = pct + '%';

    // Player card
    document.getElementById('playerAvatar').textContent = t.avatar;
    document.getElementById('playerTitleLarge').textContent = t.title;
    document.getElementById('playerLvLarge').textContent = `Lv.${player.level}`;
    document.getElementById('expFill').style.width = pct + '%';
    document.getElementById('expText').textContent = `EXP: ${player.exp} / ${needed}`;

    const correctRate = player.totalAnswered > 0 ? Math.round((player.totalCorrect / player.totalAnswered) * 100) + '%' : '--';
    document.getElementById('statCleared').textContent = `🏆 クリア: ${player.totalCleared}`;
    document.getElementById('statCorrect').textContent = `✅ 正答率: ${correctRate}`;
    document.getElementById('statStreak').textContent = `🔥 最高連続: ${player.bestStreak}`;
}

// ===== セーブ/ロード =====
function savePlayer() {
    try { localStorage.setItem('thinkingQuestPlayer', JSON.stringify(player)); } catch(e) {}
}

function loadPlayer() {
    try {
        const data = JSON.parse(localStorage.getItem('thinkingQuestPlayer'));
        if (data) player = { ...player, ...data };
    } catch(e) {}
}

// ===== ユーティリティ =====
function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}

function truncate(text, max) {
    return text.length > max ? text.substring(0, max) + '...' : text;
}

function sanitizeId(str) {
    return str.replace(/[^a-zA-Z0-9\u3000-\u9FFF]/g, '_');
}

// ===== 初期化 =====
document.addEventListener('DOMContentLoaded', () => {
    loadPlayer();
    showHome();
});

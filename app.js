// ===== アプリケーションロジック =====

let currentCategory = null;
let currentQuestionIndex = 0;
let currentQuestions = [];
let sessionResults = [];
let totalScore = 0;
let selectedAnswer = null;
let classifyState = {};
let sortState = [];

// ===== 画面遷移 =====
function showHome() {
    document.getElementById('homeScreen').style.display = '';
    document.getElementById('trainingScreen').style.display = 'none';
    document.getElementById('resultScreen').style.display = 'none';
    updateTotalScore();
}

function showTraining() {
    document.getElementById('homeScreen').style.display = 'none';
    document.getElementById('trainingScreen').style.display = '';
    document.getElementById('resultScreen').style.display = 'none';
}

function showResult() {
    document.getElementById('homeScreen').style.display = 'none';
    document.getElementById('trainingScreen').style.display = 'none';
    document.getElementById('resultScreen').style.display = '';
    renderResult();
}

// ===== トレーニング開始 =====
function startTraining(category) {
    currentCategory = category;
    currentQuestionIndex = 0;
    sessionResults = [];
    currentQuestions = [...QUESTIONS[category]];
    showTraining();
    renderQuestion();
}

function retryTraining() {
    if (currentCategory) {
        startTraining(currentCategory);
    }
}

// ===== 問題レンダリング =====
function renderQuestion() {
    const q = currentQuestions[currentQuestionIndex];
    const info = CATEGORY_INFO[currentCategory];
    selectedAnswer = null;

    // ヘッダー情報
    document.getElementById('trainingCategory').textContent = info.icon + ' ' + info.name;
    document.getElementById('questionCount').textContent = `${currentQuestionIndex + 1} / ${currentQuestions.length}`;

    // シナリオ
    document.getElementById('scenarioBox').innerHTML =
        `<span class="scenario-label">シナリオ</span>${escapeHtml(q.scenario).replace(/\n/g, '<br>')}`;

    // 問題文
    document.getElementById('questionBox').innerHTML =
        `<h4>Q${currentQuestionIndex + 1}. ${escapeHtml(q.question)}</h4>`;

    // フィードバックを非表示
    const feedbackArea = document.getElementById('feedbackArea');
    feedbackArea.style.display = 'none';
    feedbackArea.className = 'feedback-area';

    // 回答エリア
    const answerArea = document.getElementById('answerArea');
    const actionButtons = document.getElementById('actionButtons');

    switch (q.type) {
        case 'choice':
            renderChoiceQuestion(q, answerArea, actionButtons);
            break;
        case 'text':
            renderTextQuestion(q, answerArea, actionButtons);
            break;
        case 'classify':
            renderClassifyQuestion(q, answerArea, actionButtons);
            break;
        case 'sort':
            renderSortQuestion(q, answerArea, actionButtons);
            break;
    }
}

// ----- 選択式 -----
function renderChoiceQuestion(q, answerArea, actionButtons) {
    const markers = ['A', 'B', 'C', 'D', 'E'];
    answerArea.innerHTML = `
        <div class="choice-list">
            ${q.choices.map((c, i) => `
                <div class="choice-item" data-index="${i}" onclick="selectChoice(${i})">
                    <span class="choice-marker">${markers[i]}</span>
                    <span>${escapeHtml(c)}</span>
                </div>
            `).join('')}
        </div>
    `;
    actionButtons.innerHTML = `
        <button class="btn btn-primary" onclick="submitChoice()" id="submitBtn" disabled>回答する</button>
    `;
}

function selectChoice(index) {
    if (selectedAnswer !== null && document.querySelector('.choice-item.correct')) return; // 回答済み
    selectedAnswer = index;
    document.querySelectorAll('.choice-item').forEach((el, i) => {
        el.classList.toggle('selected', i === index);
    });
    document.getElementById('submitBtn').disabled = false;
}

function submitChoice() {
    const q = currentQuestions[currentQuestionIndex];
    const isCorrect = selectedAnswer === q.correct;

    // 選択肢にフィードバック表示
    document.querySelectorAll('.choice-item').forEach((el, i) => {
        el.classList.remove('selected');
        if (i === q.correct) el.classList.add('correct');
        if (i === selectedAnswer && !isCorrect) el.classList.add('incorrect');
    });

    const score = isCorrect ? 10 : 0;
    sessionResults.push({ question: q, correct: isCorrect, score });
    showFeedback(isCorrect, q.explanation, q.point);
    showNextButton();
}

// ----- テキスト入力式 -----
function renderTextQuestion(q, answerArea, actionButtons) {
    answerArea.innerHTML = `
        <div class="text-input-area">
            <textarea id="textAnswer" placeholder="ここに回答を入力してください...">${''}</textarea>
            ${q.hint ? `<div class="hint">💡 ヒント: ${escapeHtml(q.hint).replace(/\n/g, '<br>')}</div>` : ''}
        </div>
    `;
    actionButtons.innerHTML = `
        <button class="btn btn-secondary" onclick="showTextHint()">模範解答を見る</button>
        <button class="btn btn-primary" onclick="submitText()">回答を確認</button>
    `;
}

function showTextHint() {
    const q = currentQuestions[currentQuestionIndex];
    const feedbackArea = document.getElementById('feedbackArea');
    feedbackArea.style.display = '';
    feedbackArea.className = 'feedback-area';
    feedbackArea.innerHTML = `
        <div class="feedback-title">📝 模範解答</div>
        <div class="feedback-text">${escapeHtml(q.sampleAnswer).replace(/\n/g, '<br>')}</div>
    `;
}

function submitText() {
    const q = currentQuestions[currentQuestionIndex];
    const answer = document.getElementById('textAnswer').value.trim();

    if (!answer) {
        alert('回答を入力してください');
        return;
    }

    sessionResults.push({ question: q, correct: true, score: 7, userAnswer: answer });

    const feedbackArea = document.getElementById('feedbackArea');
    feedbackArea.style.display = '';
    feedbackArea.className = 'feedback-area correct';
    feedbackArea.innerHTML = `
        <div class="feedback-title">回答を記録しました</div>
        <div class="feedback-text">
            <strong>あなたの回答:</strong><br>${escapeHtml(answer).replace(/\n/g, '<br>')}
        </div>
        <div class="feedback-point">
            <strong>📝 模範解答:</strong><br>${escapeHtml(q.sampleAnswer).replace(/\n/g, '<br>')}
        </div>
        <div class="feedback-point" style="margin-top:8px;">
            <strong>✅ 評価ポイント:</strong><br>
            ${q.evaluationPoints.map(p => '・' + escapeHtml(p)).join('<br>')}
        </div>
    `;
    showNextButton();
}

// ----- 分類式（MECE） -----
function renderClassifyQuestion(q, answerArea, actionButtons) {
    classifyState = {};
    q.buckets.forEach(b => classifyState[b] = []);

    const shuffledItems = [...q.items].sort(() => Math.random() - 0.5);

    answerArea.innerHTML = `
        <div class="classify-area">
            <div class="classify-items" id="classifyItems">
                ${shuffledItems.map(item => `
                    <span class="classify-chip" data-item="${escapeHtml(item)}" onclick="selectClassifyItem(this)">${escapeHtml(item)}</span>
                `).join('')}
            </div>
            <div class="classify-buckets">
                ${q.buckets.map(bucket => `
                    <div class="classify-bucket" data-bucket="${escapeHtml(bucket)}" onclick="placeInBucket('${escapeHtml(bucket)}')">
                        <h5>${escapeHtml(bucket)}</h5>
                        <div class="bucket-items" id="bucket-${escapeHtml(bucket).replace(/[^a-zA-Z0-9]/g, '_')}"></div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    actionButtons.innerHTML = `
        <button class="btn btn-primary" onclick="submitClassify()">回答する</button>
    `;
}

let selectedClassifyItem = null;

function selectClassifyItem(el) {
    document.querySelectorAll('.classify-chip').forEach(c => c.style.outline = '');
    el.style.outline = '2px solid var(--primary)';
    selectedClassifyItem = el.dataset.item;
}

function placeInBucket(bucket) {
    if (!selectedClassifyItem) return;

    // アイテムがどこかにすでに入っていれば除去
    for (const b in classifyState) {
        classifyState[b] = classifyState[b].filter(i => i !== selectedClassifyItem);
    }
    classifyState[bucket].push(selectedClassifyItem);

    // チップを配置済みに
    document.querySelectorAll('.classify-chip').forEach(c => {
        if (c.dataset.item === selectedClassifyItem) {
            c.classList.add('placed');
            c.style.outline = '';
        }
    });

    // バケット内を再描画
    renderBuckets();
    selectedClassifyItem = null;
}

function renderBuckets() {
    const q = currentQuestions[currentQuestionIndex];
    q.buckets.forEach(bucket => {
        const bucketId = 'bucket-' + bucket.replace(/[^a-zA-Z0-9]/g, '_');
        const el = document.getElementById(bucketId);
        if (el) {
            el.innerHTML = classifyState[bucket].map(item =>
                `<span class="bucket-chip" onclick="removeFromBucket('${escapeHtml(bucket)}', '${escapeHtml(item)}')">${escapeHtml(item)} ✕</span>`
            ).join('');
        }
    });
}

function removeFromBucket(bucket, item) {
    classifyState[bucket] = classifyState[bucket].filter(i => i !== item);
    document.querySelectorAll('.classify-chip').forEach(c => {
        if (c.dataset.item === item) {
            c.classList.remove('placed');
        }
    });
    renderBuckets();
}

function submitClassify() {
    const q = currentQuestions[currentQuestionIndex];
    let correctCount = 0;
    let totalItems = q.items.length;

    for (const bucket in q.correctMapping) {
        const correctItems = q.correctMapping[bucket];
        const userItems = classifyState[bucket] || [];
        correctItems.forEach(item => {
            if (userItems.includes(item)) correctCount++;
        });
    }

    const isCorrect = correctCount === totalItems;
    const score = Math.round((correctCount / totalItems) * 10);
    sessionResults.push({ question: q, correct: isCorrect, score });

    let detail = '';
    for (const bucket in q.correctMapping) {
        detail += `<strong>${bucket}:</strong> ${q.correctMapping[bucket].join('、')}<br>`;
    }

    showFeedback(isCorrect, q.explanation + '<br><br><strong>正解の分類:</strong><br>' + detail, q.point);
    showNextButton();
}

// ----- 並べ替え式 -----
function renderSortQuestion(q, answerArea, actionButtons) {
    sortState = q.items.map((item, i) => ({ text: item, originalIndex: i }));
    // シャッフル
    for (let i = sortState.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [sortState[i], sortState[j]] = [sortState[j], sortState[i]];
    }
    renderSortList(answerArea);
    actionButtons.innerHTML = `
        <button class="btn btn-primary" onclick="submitSort()">回答する</button>
    `;
}

function renderSortList(container) {
    if (!container) container = document.getElementById('answerArea');
    container.innerHTML = `
        <div class="sortable-list" id="sortableList">
            ${sortState.map((item, i) => `
                <div class="sortable-item" data-index="${i}">
                    <span class="order-num">${i + 1}</span>
                    <span style="flex:1">${escapeHtml(item.text)}</span>
                    <span class="sort-buttons">
                        ${i > 0 ? `<button class="btn btn-secondary" style="padding:4px 10px;font-size:0.8rem;" onclick="moveSortItem(${i}, -1)">↑</button>` : ''}
                        ${i < sortState.length - 1 ? `<button class="btn btn-secondary" style="padding:4px 10px;font-size:0.8rem;" onclick="moveSortItem(${i}, 1)">↓</button>` : ''}
                    </span>
                </div>
            `).join('')}
        </div>
    `;
}

function moveSortItem(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= sortState.length) return;
    [sortState[index], sortState[newIndex]] = [sortState[newIndex], sortState[index]];
    renderSortList();
}

function submitSort() {
    const q = currentQuestions[currentQuestionIndex];
    const userOrder = sortState.map(s => s.originalIndex);
    let correctCount = 0;
    userOrder.forEach((val, i) => {
        if (val === q.correctOrder[i]) correctCount++;
    });

    const isCorrect = correctCount === q.correctOrder.length;
    const score = Math.round((correctCount / q.correctOrder.length) * 10);
    sessionResults.push({ question: q, correct: isCorrect, score });

    const correctOrderText = q.correctOrder.map((idx, i) => `${i + 1}. ${q.items[idx]}`).join('<br>');
    showFeedback(isCorrect, q.explanation + '<br><br><strong>正しい順序:</strong><br>' + correctOrderText, q.point);
    showNextButton();
}

// ===== フィードバック表示 =====
function showFeedback(isCorrect, explanation, point) {
    const feedbackArea = document.getElementById('feedbackArea');
    feedbackArea.style.display = '';
    feedbackArea.className = `feedback-area ${isCorrect ? 'correct' : 'incorrect'}`;
    feedbackArea.innerHTML = `
        <div class="feedback-title">${isCorrect ? '✅ 正解！' : '❌ 不正解'}</div>
        <div class="feedback-text">${explanation}</div>
        ${point ? `<div class="feedback-point"><strong>💡 ポイント:</strong> ${escapeHtml(point)}</div>` : ''}
    `;
}

function showNextButton() {
    const actionButtons = document.getElementById('actionButtons');
    const isLast = currentQuestionIndex >= currentQuestions.length - 1;
    actionButtons.innerHTML = `
        <button class="btn btn-primary" onclick="${isLast ? 'showResult()' : 'nextQuestion()'}">
            ${isLast ? '結果を見る' : '次の問題へ →'}
        </button>
    `;
}

function nextQuestion() {
    currentQuestionIndex++;
    renderQuestion();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== 結果画面 =====
function renderResult() {
    const totalPossible = sessionResults.length * 10;
    const earnedScore = sessionResults.reduce((sum, r) => sum + r.score, 0);
    const percentage = Math.round((earnedScore / totalPossible) * 100);

    // ランク判定
    let rank, rankColor;
    if (percentage >= 90) { rank = 'S（エキスパート）'; rankColor = '#7c3aed'; }
    else if (percentage >= 70) { rank = 'A（上級者）'; rankColor = '#2563eb'; }
    else if (percentage >= 50) { rank = 'B（中級者）'; rankColor = '#059669'; }
    else if (percentage >= 30) { rank = 'C（初級者）'; rankColor = '#d97706'; }
    else { rank = 'D（入門）'; rankColor = '#dc2626'; }

    document.getElementById('resultScore').innerHTML = `
        ${earnedScore}<span class="result-max"> / ${totalPossible}pt</span>
        <div class="result-rank" style="color:${rankColor}">ランク: ${rank}</div>
    `;

    document.getElementById('resultDetail').innerHTML = sessionResults.map((r, i) => `
        <div class="result-item">
            <span class="q-label">Q${i + 1}. ${truncate(r.question.question, 40)}</span>
            <span class="q-result ${r.correct ? 'correct' : 'incorrect'}">${r.score}pt ${r.correct ? '✅' : '❌'}</span>
        </div>
    `).join('');

    // 総合スコアに加算
    totalScore += earnedScore;
    updateTotalScore();
    saveProgress();
}

function updateTotalScore() {
    document.getElementById('totalScore').textContent = `総合スコア: ${totalScore}pt`;
}

// ===== データ保存 =====
function saveProgress() {
    try {
        const data = {
            totalScore,
            lastPlayed: new Date().toISOString(),
            history: JSON.parse(localStorage.getItem('thinkingTraining') || '{}').history || []
        };
        data.history.push({
            category: currentCategory,
            score: sessionResults.reduce((sum, r) => sum + r.score, 0),
            total: sessionResults.length * 10,
            date: new Date().toISOString()
        });
        localStorage.setItem('thinkingTraining', JSON.stringify(data));
    } catch (e) {
        // localStorage unavailable
    }
}

function loadProgress() {
    try {
        const data = JSON.parse(localStorage.getItem('thinkingTraining') || '{}');
        totalScore = data.totalScore || 0;
        updateTotalScore();
    } catch (e) {
        // localStorage unavailable
    }
}

// ===== ユーティリティ =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function truncate(text, maxLen) {
    return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
}

// ===== 初期化 =====
document.addEventListener('DOMContentLoaded', () => {
    loadProgress();
});

document.addEventListener('DOMContentLoaded', () => {
    // State
    const state = {
        allQuestions: [],
        currentQuizQuestions: [],
        currentIndex: 0,
        userAnswers: {}, // { questionIndex: 'A' | 'B' | 'C' | 'D' }
        isQuizActive: false,
        timerInterval: null,
        timeElapsed: 0,
        timeElapsed: 0,
        userName: '',
        vipList: []
    };

    // DOM Elements
    const elements = {
        startScreen: document.getElementById('start-screen'),
        quizScreen: document.getElementById('quiz-screen'),
        resultScreen: document.getElementById('result-screen'),
        questionCountInput: document.getElementById('question-count'),
        usernameInput: document.getElementById('username'),
        maxCountLabel: document.getElementById('max-count-label'),
        bankSelect: document.getElementById('bank-select'),
        startBtn: document.getElementById('start-btn'),
        questionText: document.getElementById('question-text'),
        optionsContainer: document.getElementById('options-container'),
        progressBar: document.getElementById('progress-bar'),
        questionNumber: document.getElementById('question-number'),
        timer: document.getElementById('timer'),
        prevBtn: document.getElementById('prev-btn'),
        nextBtn: document.getElementById('next-btn'),
        submitBtn: document.getElementById('submit-btn'),
        scoreDisplay: document.getElementById('score-display'),
        resultSummary: document.getElementById('result-summary'),
        wrongAnswersList: document.getElementById('wrong-answers-list'),
        restartBtn: document.getElementById('restart-btn'),
        downloadBtn: document.getElementById('download-btn'),
        uploadContainer: document.getElementById('upload-container'),
        csvUpload: document.getElementById('csv-upload'),
        historyBtn: document.getElementById('history-btn'),
        historyScreen: document.getElementById('history-screen'),
        historyBackBtn: document.getElementById('history-back-btn'),
        historyList: document.getElementById('history-list'),
        historyLoading: document.getElementById('history-loading'),
        historyContent: document.getElementById('history-content')
    };

    // Configuration
    const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzxM8LQveR882cyLoC6YckCjOl5Jv7wfywAzXDicIvr-NAcoswGcZ66-BPOhlRSFvMX/exec";

    // Initialize
    init();

    async function init() {
        setupEventListeners();
        try {
            // Load VIP List
            try {
                const vipResponse = await fetch('vip_list.json');
                if (vipResponse.ok) {
                    state.vipList = await vipResponse.json();
                } else {
                    console.warn('Failed to load VIP list');
                }
            } catch (err) {
                console.warn('Error loading VIP list:', err);
            }

            // Load manifest
            const manifestResponse = await fetch('questions/manifest.json');
            if (!manifestResponse.ok) throw new Error('Failed to load manifest');
            const manifest = await manifestResponse.json();

            // Populate select
            const select = elements.bankSelect;
            select.innerHTML = ''; // Clear existing
            manifest.forEach(filename => {
                const option = document.createElement('option');
                option.value = filename;
                option.textContent = filename.replace('.json', '');
                select.appendChild(option);
            });

            // Load first bank
            if (manifest.length > 0) {
                await loadQuestions(manifest[0]);
            }
        } catch (error) {
            console.warn('Auto-load failed:', error);
            elements.maxCountLabel.textContent = '載入失敗，請檢查設定';
            elements.maxCountLabel.style.color = '#ef4444';
        }
    }

    async function loadQuestions(filename = null) {
        if (!filename) filename = elements.bankSelect.value;

        elements.maxCountLabel.textContent = '載入中...';
        elements.maxCountLabel.style.color = '';
        elements.startBtn.disabled = true;

        try {
            const path = filename.includes('/') ? filename : `questions/${filename}`;
            const response = await fetch(path);
            if (!response.ok) throw new Error('Network response was not ok');

            if (filename.endsWith('.json')) {
                const data = await response.json();
                parseJSON(data);
            } else {
                const text = await response.text();
                parseCSV(text);
            }
            updateUIWithData();
        } catch (error) {
            console.error('Load failed:', error);
            elements.maxCountLabel.textContent = '載入失敗，請嘗試手動上傳';
            elements.maxCountLabel.style.color = '#ef4444';
            state.allQuestions = [];
        }
    }

    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target.result;
            if (file.name.endsWith('.json')) {
                try {
                    const data = JSON.parse(result);
                    parseJSON(data);
                    updateUIWithData();
                    elements.maxCountLabel.style.color = '';
                } catch (err) {
                    alert('JSON 格式錯誤');
                }
            } else {
                parseCSV(result);
                updateUIWithData();
                elements.maxCountLabel.style.color = '';
            }
        };
        reader.readAsText(file);
    }

    function updateUIWithData() {
        if (state.allQuestions.length > 0) {
            elements.questionCountInput.max = state.allQuestions.length;
            // Update the input value if it exceeds max
            if (parseInt(elements.questionCountInput.value) > state.allQuestions.length) {
                elements.questionCountInput.value = state.allQuestions.length;
            }
            elements.maxCountLabel.textContent = `共有 ${state.allQuestions.length} 題可用`;
            elements.startBtn.disabled = false;
        } else {
            elements.maxCountLabel.textContent = `沒有題目`;
            elements.startBtn.disabled = true;
        }
    }

    function parseJSON(data) {
        // Map JSON items to internal structure
        // JSON keys: "編號", "解答", "題目", "選項A", "選項B", "選項C", "選項D"
        state.allQuestions = data.map(item => {
            return {
                id: item['編號'],
                answer: item['解答'],
                question: item['題目'],
                options: {
                    A: item['選項A'],
                    B: item['選項B'],
                    C: item['選項C'],
                    D: item['選項D']
                }
            };
        }).filter(item => item.id && item.question); // Basic validation
    }

    function parseCSV(csvText) {
        const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
        // Assume first line is header
        const headers = lines[0].split(',');

        // CSV Format based on inspection:
        // 編號,解答,題目,選項A,選項B,選項C,選項D
        // Indices likely: 0=ID, 1=Answer, 2=Question, 3=A, 4=B, 5=C, 6=D

        state.allQuestions = lines.slice(1).map(line => {
            // Handle CSV parsing more robustly if needed (e.g. quotes), but for now split by comma
            // If fields contain commas, this simple split needs regex
            // Improved split for CSV allowing quotes
            const parts = parseCSVLine(line);

            if (parts.length < 7) return null; // Skip invalid lines

            return {
                id: parts[0],
                answer: parts[1], // Expected 'A', 'B', 'C', 'D'
                question: parts[2],
                options: {
                    A: parts[3],
                    B: parts[4],
                    C: parts[5],
                    D: parts[6]
                }
            };
        }).filter(item => item !== null);
    }

    function parseCSVLine(text) {
        // Simple parser that handles basic quoted commas
        let re_value = /(?!\s*$)\s*(?:'([^']*)'|"([^"]*)"|([^,'"]*))\s*(?:,|$)/g;
        let a = [];
        text.replace(re_value, function (m0, m1, m2, m3) {
            if (m1 !== undefined) a.push(m1.replace(/\\'/g, "'"));
            else if (m2 !== undefined) a.push(m2.replace(/\\"/g, '"'));
            else if (m3 !== undefined) a.push(m3);
            return '';
        });
        if (/,\s*$/.test(text)) a.push('');
        return a;
    }

    function setupEventListeners() {
        elements.bankSelect.addEventListener('change', (e) => loadQuestions(e.target.value));
        elements.startBtn.addEventListener('click', startQuiz);
        elements.historyBtn.addEventListener('click', showHistory);
        elements.historyBackBtn.addEventListener('click', () => switchScreen('start-screen'));
        elements.prevBtn.addEventListener('click', () => navigateQuestion(-1));
        elements.nextBtn.addEventListener('click', () => navigateQuestion(1));
        elements.submitBtn.addEventListener('click', submitQuiz);
        elements.restartBtn.addEventListener('click', resetQuiz);
        elements.downloadBtn.addEventListener('click', downloadReport);
        if (elements.csvUpload) {
            elements.csvUpload.addEventListener('change', handleFileUpload);
        }

        // Allow keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (!state.isQuizActive) return;
            if (e.key === 'ArrowRight') navigateQuestion(1);
            if (e.key === 'ArrowLeft') navigateQuestion(-1);
        });
    }

    function startQuiz() {
        const name = elements.usernameInput.value.trim();
        if (!name) {
            alert('請輸入考生姓名');
            return;
        }
        state.userName = name;

        const count = Math.min(
            parseInt(elements.questionCountInput.value) || 20,
            state.allQuestions.length
        );

        if (count <= 0) return;

        // Shuffle and select questions
        state.currentQuizQuestions = shuffleArray([...state.allQuestions]).slice(0, count);
        state.currentIndex = 0;
        state.userAnswers = {};
        state.isQuizActive = true;
        state.timeElapsed = 0;

        // Start Timer
        if (state.timerInterval) clearInterval(state.timerInterval);
        state.timerInterval = setInterval(updateTimer, 1000);

        // Switch Screen
        switchScreen('quiz-screen');
        renderQuestion();
    }

    async function showHistory() {
        const name = elements.usernameInput.value.trim();
        if (!name) {
            alert('請先輸入考生姓名，才能查詢歷史錯題。');
            return;
        }

        switchScreen('history-screen');
        elements.historyLoading.style.display = 'block';
        elements.historyContent.style.display = 'none';
        elements.historyList.innerHTML = '';

        try {
            // Fetch from GAS
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?name=${encodeURIComponent(name)}`);
            if (!response.ok) throw new Error('Network error');
            const data = await response.json();

            renderHistory(data);
        } catch (error) {
            console.error('History fetch failed:', error);
            elements.historyList.innerHTML = '<div style="text-align:center; padding: 2rem; color: #ef4444;">讀取失敗，請稍後再試。<br>請確認後端腳本已更新並部署。</div>';
        } finally {
            elements.historyLoading.style.display = 'none';
            elements.historyContent.style.display = 'block';
        }
    }

    function renderHistory(wrongItems) {
        elements.historyList.innerHTML = '';

        if (!Array.isArray(wrongItems) || wrongItems.length === 0) {
            elements.historyList.innerHTML = '<div style="text-align:center; padding: 2rem;">查無錯題紀錄，太棒了！🎉</div>';
            return;
        }

        wrongItems.forEach(item => {
            // item from backend: {id, count, q, ans, correct}

            const el = document.createElement('div');
            el.className = 'review-item';
            el.innerHTML = `
                 <div class="review-question">
                    <span style="color: #ef4444; font-weight: bold; margin-right: 8px;">[錯 ${item.count} 次]</span>
                    ${item.id}. ${item.q}
                 </div>
                 <div class="review-answer user-answer">您的歷史誤答：${item.ans}</div>
                 <div class="review-answer correct-answer">正確答案：${item.correct}</div>
             `;
            elements.historyList.appendChild(el);
        });
    }

    function renderQuestion() {
        const currentQ = state.currentQuizQuestions[state.currentIndex];
        const total = state.currentQuizQuestions.length;

        // Update Info
        elements.questionNumber.textContent = `Question ${state.currentIndex + 1}/${total}`;
        elements.progressBar.style.width = `${((state.currentIndex + 1) / total) * 100}%`;
        elements.questionText.textContent = currentQ.question;

        // Generate Options
        elements.optionsContainer.innerHTML = '';
        ['A', 'B', 'C', 'D'].forEach(key => {
            const optionText = currentQ.options[key];
            const isSelected = state.userAnswers[state.currentIndex] === key;

            const card = document.createElement('div');
            card.className = `option-card ${isSelected ? 'selected' : ''}`;
            card.dataset.value = key;
            card.onclick = () => selectOption(key);

            card.innerHTML = `
                <div class="option-marker">${key}</div>
                <div class="option-text">${optionText}</div>
            `;
            elements.optionsContainer.appendChild(card);
        });

        // Update Navigation Buttons
        elements.prevBtn.classList.toggle('hidden', state.currentIndex === 0);

        if (state.currentIndex === total - 1) {
            elements.nextBtn.classList.add('hidden');
            elements.submitBtn.classList.remove('hidden');
        } else {
            elements.nextBtn.classList.remove('hidden');
            elements.submitBtn.classList.add('hidden');
        }
    }

    function selectOption(key) {
        state.userAnswers[state.currentIndex] = key;
        renderQuestion(); // Re-render to show selection
    }

    function navigateQuestion(direction) {
        const newIndex = state.currentIndex + direction;
        if (newIndex >= 0 && newIndex < state.currentQuizQuestions.length) {
            state.currentIndex = newIndex;
            renderQuestion();
        }
    }

    function submitQuiz() {
        if (!confirm('確定要交卷嗎？')) return;

        clearInterval(state.timerInterval);
        state.isQuizActive = false;

        calculateResults();
        switchScreen('result-screen');
    }

    function calculateResults() {
        let score = 0;
        const total = state.currentQuizQuestions.length;
        const wrongAnswers = [];

        state.currentQuizQuestions.forEach((q, index) => {
            const userAns = state.userAnswers[index];
            if (userAns === q.answer) {
                score++;
            } else {
                wrongAnswers.push({
                    question: q,
                    userAns: userAns || '未作答'
                });
            }
        });

        const finalScore = Math.round((score / total) * 100);

        // Update UI
        elements.scoreDisplay.textContent = finalScore;
        elements.resultSummary.textContent = `答對 ${score} / ${total} 題`;

        // VIP Logging
        if (state.vipList.includes(state.userName)) {
            const wrongIds = wrongAnswers.map(w => w.question.id).join(', ');
            const currentDateTime = new Date().toLocaleString('zh-TW', { hour12: false });

            submitToGoogleSheet({
                time: currentDateTime,
                name: state.userName,
                score: finalScore,
                summary: `答對 ${score} / ${total} 題`,
                wrong_ids: wrongIds,
                detail: JSON.stringify(wrongAnswers.map(w => ({
                    id: w.question.id,
                    q: w.question.question,
                    ans: w.userAns,
                    correct: w.question.answer
                })))
            });
        }

        // Render Wrong Answers
        elements.wrongAnswersList.innerHTML = '';
        if (wrongAnswers.length === 0) {
            elements.wrongAnswersList.innerHTML = '<div style="text-align:center; padding: 2rem;">太棒了！全對！🎉</div>';
        } else {
            wrongAnswers.forEach(item => {
                const el = document.createElement('div');
                el.className = 'review-item';
                el.innerHTML = `
                    <div class="review-question">${item.question.id}. ${item.question.question}</div>
                    <div class="review-answer user-answer">您的答案：${item.userAns}</div>
                    <div class="review-answer correct-answer">正確答案：${item.question.answer} (${item.question.options[item.question.answer]})</div>
                `;
                elements.wrongAnswersList.appendChild(el);
            });
        }
    }

    function resetQuiz() {
        elements.usernameInput.value = ''; // Clear name
        switchScreen('start-screen');
    }

    function downloadReport() {
        const date = new Date().toLocaleString('zh-TW');
        let content = `學科題庫測驗成績單\n`;
        content += `================================\n`;
        content += `姓名: ${state.userName}\n`;
        content += `日期: ${date}\n`;
        content += `得分: ${elements.scoreDisplay.textContent} 分\n`;
        content += `答對: ${elements.resultSummary.textContent}\n`;
        content += `================================\n\n`;

        content += `[錯題檢討]\n`;
        const reviewItems = elements.wrongAnswersList.querySelectorAll('.review-item');
        if (reviewItems.length === 0) {
            content += `恭喜！全對！無錯題。\n`;
        } else {
            // Re-calculate wrong answers from state for cleaner data access
            state.currentQuizQuestions.forEach((q, index) => {
                const userAns = state.userAnswers[index];
                if (userAns !== q.answer) {
                    content += `題目 (${q.id}): ${q.question}\n`;
                    content += `您的答案: ${userAns || '未作答'}\n`;
                    content += `正確答案: ${q.answer} (${q.options[q.answer]})\n`;
                    content += `--------------------------------\n`;
                }
            });
        }

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.userName}_成績單.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function switchScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => {
            s.classList.remove('active');
            s.classList.add('hidden');
        });
        const target = document.getElementById(screenId);
        target.classList.remove('hidden');
        // Small delay to allow display:block to apply before opacity transition
        setTimeout(() => {
            target.classList.add('active');
        }, 10);
    }

    function updateTimer() {
        state.timeElapsed++;
        const minutes = Math.floor(state.timeElapsed / 60).toString().padStart(2, '0');
        const seconds = (state.timeElapsed % 60).toString().padStart(2, '0');
        elements.timer.textContent = `${minutes}:${seconds}`;
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    async function submitToGoogleSheet(data) {
        if (!GOOGLE_SCRIPT_URL) return;

        try {
            // Since we're making a cross-origin request to Google Apps Script, 
            // no-cors mode is often used to avoid CORS errors, 
            // but for a robust solution that gets a response, we rely on the script being set to 'Anyone'
            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors', // Important for simple submission without CORS preflight issues
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: JSON.stringify(data)
            });
            console.log('VIP result submitted');
        } catch (error) {
            console.error('Error submitting VIP result:', error);
        }
    }
});

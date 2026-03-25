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
        userName: '',
        vipList: [],
        currentBankName: '', // Track current bank display name
        rawHistoryData: [],  // Cache for filtering
        selectedFixedRange: null, // { start, end } 1-based inclusive
        selectedExamRange: null, // { start, end, label } for exam mode
        examModeType: 'fixed', // 'fixed' or 'random'
        examType: '隨機出題' // Track exam mode label for reporting
    };

    // Fixed mode range definitions per bank filename
    // Each entry: { label, start, end } (1-based, inclusive)
    const FIXED_RANGES = {
        '職業安全工作倫理_題庫.json': [
            { label: '1–20', start: 1, end: 20 },
            { label: '21–40', start: 21, end: 40 },
            { label: '41–60', start: 41, end: 60 },
        ],
        '__default__': [
            { label: '1–50', start: 1, end: 50 },
            { label: '51–100', start: 51, end: 100 },
            { label: '101–150', start: 101, end: 150 },
            { label: '151–200', start: 151, end: 200 },
        ]
    };

    /**
     * Helper to format content:
     * 1. Convert Markdown image syntax to HTML <img> tags.
     * 2. Handle Superscripts: 10^2^ or 10^2 -> <sup>...</sup>
     * 3. Handle Subscripts: R~T~ or R_T -> <sub>...</sub>
     */
    function formatQuestionText(text) {
        if (!text || typeof text !== 'string') return text;

        // 1. Images: ![](media/image82.jpeg){width="..."}
        let formatted = text.replace(/!\[\]\(media\/image(\d+)\.(jpe?g|png|gif)\)({.*?})?/g, (match, num, ext) => {
            const paddedNum = num.padStart(3, '0');
            const finalExt = ext === 'jpeg' ? 'jpg' : ext;
            return `<img src="questions/image/image${paddedNum}.${finalExt}" alt="image">`;
        });

        // 2. Superscripts: ^2^ or ^2
        // Match balanced first: ^text^
        formatted = formatted.replace(/\^([^^]+)\^/g, '<sup>$1</sup>');
        // Match shorthand for numbers/single letters: ^2 (if not already handled)
        formatted = formatted.replace(/\^([a-zA-Z0-9]+)(?![^<]*>)/g, '<sup>$1</sup>');

        // 3. Subscripts: ~text~ or _T
        // Match balanced first: ~text~
        formatted = formatted.replace(/~([^~]+)~/g, '<sub>$1</sub>');
        // Match shorthand: _T or _1
        formatted = formatted.replace(/_([a-zA-Z0-9]+)(?![^<]*>)/g, '<sub>$1</sub>');

        return formatted;
    }

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
        startFixedBtn: document.getElementById('start-fixed-btn'),
        fixedRangeButtons: document.getElementById('fixed-range-buttons'),
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
        historyContent: document.getElementById('history-content'),
        historyBankFilter: document.getElementById('history-bank-filter'),
        historyFilterContainer: document.getElementById('history-filter-container'),
        historySearch: document.getElementById('history-search'),
        historyStats: document.getElementById('history-stats'),
        teacherScreen: document.getElementById('teacher-screen'),
        teacherBackBtn: document.getElementById('teacher-back-btn'),
        teacherPortalBtn: document.getElementById('teacher-portal-btn'),
        teacherStats: document.getElementById('teacher-stats'),
        teacherStudentSearch: document.getElementById('teacher-student-search'),
        teacherStudentList: document.getElementById('teacher-student-list'),
        teacherTopErrors: document.getElementById('teacher-top-errors'),
        // Exam Mode Paper Export
        examFixedTab: document.getElementById('exam-fixed-tab'),
        examRandomTab: document.getElementById('exam-random-tab'),
        examFixedSection: document.getElementById('exam-fixed-section'),
        examRandomSection: document.getElementById('exam-random-section'),
        examRangeButtons: document.getElementById('exam-range-buttons'),
        examQuestionCount: document.getElementById('exam-question-count'),
        generatePaperBtn: document.getElementById('generate-paper-btn')
    };


    // Configuration
    const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxXlrazalXz8uXzWX3uBd-AQyl82k0P73xlLSnbyPkTOJvodHhcuLbthXDZJxoAW_0/exec";

    // Initialize
    init();

    async function init() {
        setupEventListeners();
        try {
            // Load VIP List
            try {
                const vipResponse = await fetch(`vip_list.json?t=${Date.now()}`);
                if (vipResponse.ok) {
                    state.vipList = await vipResponse.json();
                } else {
                    console.warn('Failed to load VIP list');
                }
            } catch (err) {
                console.warn('Error loading VIP list:', err);
            }

            // Load manifest
            const manifestResponse = await fetch(`questions/manifest.json?t=${Date.now()}`);
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
            console.warn('Auto-load manifest failed, using hardcoded options:', error);
            // Fallback: load the first hardcoded option if available
            if (elements.bankSelect.options.length > 0) {
                await loadQuestions(elements.bankSelect.value);
            } else {
                elements.maxCountLabel.textContent = '載入失敗，請檢查設定';
                elements.maxCountLabel.style.color = '#ef4444';
            }
        }
    }

    async function loadQuestions(filename = null) {
        if (!filename) filename = elements.bankSelect.value;

        elements.maxCountLabel.textContent = '載入中...';
        elements.maxCountLabel.style.color = '';
        elements.startBtn.disabled = true;

        try {
            const path = filename.includes('/') ? filename : `questions/${filename}`;
            const response = await fetch(`${path}?t=${Date.now()}`);
            if (!response.ok) throw new Error('Network response was not ok');

            if (filename.endsWith('.json')) {
                const data = await response.json();
                parseJSON(data);
                // Set bank name from display text
                const options = Array.from(elements.bankSelect.options);
                const selectedOption = options.find(o => o.value === filename);
                state.currentBankName = selectedOption ? selectedOption.textContent : filename.replace('.json', '');
            } else {
                const text = await response.text();
                parseCSV(text);
                state.currentBankName = '手動上傳';
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
            if (parseInt(elements.questionCountInput.value) > state.allQuestions.length) {
                elements.questionCountInput.value = state.allQuestions.length;
            }
            elements.maxCountLabel.textContent = `共有 ${state.allQuestions.length} 題可用`;
            elements.startBtn.disabled = false;
            elements.generatePaperBtn.disabled = false;
        } else {
            elements.maxCountLabel.textContent = `沒有題目`;
            elements.startBtn.disabled = true;
            elements.generatePaperBtn.disabled = true;
        }
        renderFixedRangeButtons();
        renderExamRangeButtons();
    }

    function renderFixedRangeButtons() {
        const bankFilename = elements.bankSelect.value;
        const ranges = FIXED_RANGES[bankFilename] || FIXED_RANGES['__default__'];

        state.selectedFixedRange = null;
        elements.startFixedBtn.disabled = true;
        elements.fixedRangeButtons.innerHTML = '';

        ranges.forEach(range => {
            const btn = document.createElement('button');
            btn.className = 'range-btn';
            btn.textContent = range.label;
            btn.dataset.start = range.start;
            btn.dataset.end = range.end;
            btn.addEventListener('click', () => {
                document.querySelectorAll('#fixed-range-buttons .range-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.selectedFixedRange = { start: range.start, end: range.end, label: range.label };
                elements.startFixedBtn.disabled = state.allQuestions.length === 0;
            });
            elements.fixedRangeButtons.appendChild(btn);
        });
    }

    function renderExamRangeButtons() {
        const bankFilename = elements.bankSelect.value;
        const ranges = FIXED_RANGES[bankFilename] || FIXED_RANGES['__default__'];

        state.selectedExamRange = null;
        elements.examRangeButtons.innerHTML = '';

        ranges.forEach(range => {
            const btn = document.createElement('button');
            btn.className = 'range-btn';
            btn.textContent = range.label;
            btn.dataset.start = range.start;
            btn.dataset.end = range.end;
            btn.addEventListener('click', () => {
                document.querySelectorAll('#exam-range-buttons .range-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.selectedExamRange = { start: range.start, end: range.end, label: range.label };
            });
            elements.examRangeButtons.appendChild(btn);
        });
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
        elements.startFixedBtn.addEventListener('click', startFixedQuiz);
        elements.historyBtn.addEventListener('click', showHistory);
        elements.historyBackBtn.addEventListener('click', () => switchScreen('start-screen'));
        elements.prevBtn.addEventListener('click', () => navigateQuestion(-1));
        elements.nextBtn.addEventListener('click', () => navigateQuestion(1));
        elements.submitBtn.addEventListener('click', submitQuiz);
        elements.restartBtn.addEventListener('click', resetQuiz);
        elements.downloadBtn.addEventListener('click', downloadReport);
        elements.historyBankFilter.addEventListener('change', (e) => {
            const filterValue = e.target.value;
            applyHistoryFilters();
        });
        if (elements.historySearch) {
            elements.historySearch.addEventListener('input', applyHistoryFilters);
        }

        if (elements.csvUpload) {
            elements.csvUpload.addEventListener('change', handleFileUpload);
        }

        if (elements.teacherPortalBtn) {
            elements.teacherPortalBtn.addEventListener('click', teacherLogin);
        }
        if (elements.teacherBackBtn) {
            elements.teacherBackBtn.addEventListener('click', () => switchScreen('start-screen'));
        }
        if (elements.teacherStudentSearch) {
            elements.teacherStudentSearch.addEventListener('input', () => renderTeacherDashboard(state.rawTeacherData));
        }

        // Exam Mode Tab Switching
        elements.examFixedTab.addEventListener('click', () => {
            state.examModeType = 'fixed';
            elements.examFixedTab.classList.add('active');
            elements.examRandomTab.classList.remove('active');
            elements.examFixedSection.classList.remove('hidden');
            elements.examRandomSection.classList.add('hidden');
        });

        elements.examRandomTab.addEventListener('click', () => {
            state.examModeType = 'random';
            elements.examFixedTab.classList.remove('active');
            elements.examRandomTab.classList.add('active');
            elements.examFixedSection.classList.add('hidden');
            elements.examRandomSection.classList.remove('hidden');
        });

        elements.generatePaperBtn.addEventListener('click', generateExamPaper);

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
        state.examType = '隨機出題';

        // Start Timer
        if (state.timerInterval) clearInterval(state.timerInterval);
        state.timerInterval = setInterval(updateTimer, 1000);

        // Switch Screen
        switchScreen('quiz-screen');
        renderQuestion();
    }

    function startFixedQuiz() {
        const name = elements.usernameInput.value.trim();
        if (!name) {
            alert('請輸入考生姓名');
            return;
        }
        if (!state.selectedFixedRange) {
            alert('請先選擇題目範圍');
            return;
        }
        state.userName = name;

        const { start, end, label } = state.selectedFixedRange;
        // Questions are 1-based by id order; slice by index (0-based)
        state.currentQuizQuestions = state.allQuestions.slice(start - 1, end);

        if (state.currentQuizQuestions.length === 0) {
            alert('該範圍沒有題目，請確認題庫是否足夠');
            return;
        }

        state.currentIndex = 0;
        state.userAnswers = {};
        state.isQuizActive = true;
        state.timeElapsed = 0;
        state.examType = `固定出題 ${label}`;

        if (state.timerInterval) clearInterval(state.timerInterval);
        state.timerInterval = setInterval(updateTimer, 1000);

        switchScreen('quiz-screen');
        renderQuestion();
    }

    async function showHistory() {
        const name = elements.usernameInput.value.trim();
        if (!name) {
            alert('請先輸入考生姓名，才能查詢歷史錯題。');
            return;
        }

        const isVip = state.vipList.some(v =>
            String(v).trim().toLowerCase() === name.toLowerCase()
        );

        if (!isVip) {
            alert('您不能使用本功能，請洽管理者');
            return;
        }

        switchScreen('history-screen');
        elements.historyLoading.style.display = 'block';
        elements.historyContent.style.display = 'none';
        elements.historyFilterContainer.style.display = 'none';
        elements.historyList.innerHTML = '';
        if (elements.historySearch) elements.historySearch.value = '';

        try {
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?name=${encodeURIComponent(name)}`);
            if (!response.ok) throw new Error('Network error');
            const data = await response.json();

            state.rawHistoryData = data;

            const banks = [...new Set(data.map(item => item.bank_type).filter(b => b))];
            elements.historyBankFilter.innerHTML = '<option value="all">全部記錄</option>';
            banks.forEach(bank => {
                const opt = document.createElement('option');
                opt.value = bank;
                opt.textContent = bank;
                elements.historyBankFilter.appendChild(opt);
            });

            elements.historyFilterContainer.style.display = 'block';
            applyHistoryFilters();
        } catch (error) {
            console.error('History fetch failed:', error);
            elements.historyList.innerHTML = '<div style="text-align:center; padding: 2rem; color: #ef4444;">讀取失敗，請稍後再試。</div>';
        } finally {
            elements.historyLoading.style.display = 'none';
            elements.historyContent.style.display = 'block';
        }
    }

    function applyHistoryFilters() {
        const bankFilter = elements.historyBankFilter.value;
        const searchQuery = elements.historySearch ? elements.historySearch.value.trim().toLowerCase() : '';

        let filtered = state.rawHistoryData;

        if (bankFilter !== 'all') {
            filtered = filtered.filter(item => item.bank_type === bankFilter);
        }

        if (searchQuery) {
            filtered = filtered.filter(item =>
                (item.q && item.q.toLowerCase().includes(searchQuery)) ||
                (item.ans_text && item.ans_text.toLowerCase().includes(searchQuery)) ||
                (item.correct_text && item.correct_text.toLowerCase().includes(searchQuery)) ||
                (String(item.id).includes(searchQuery))
            );
        }

        renderDashboard(filtered);
        renderHistory(filtered);
    }

    function renderDashboard(data) {
        if (!elements.historyStats) return;

        const totalErrors = data.reduce((sum, item) => sum + (parseInt(item.count) || 1), 0);
        const uniqueQuestions = data.length;
        const mostFrequent = data.length > 0 ? Math.max(...data.map(item => parseInt(item.count) || 1)) : 0;

        elements.historyStats.innerHTML = `
            <div class="stat-card">
                <span class="stat-value">${uniqueQuestions}</span>
                <span class="stat-label">待複習題數</span>
            </div>
            <div class="stat-card">
                <span class="stat-value">${totalErrors}</span>
                <span class="stat-label">累積錯誤次數</span>
            </div>
            <div class="stat-card">
                <span class="stat-value">${mostFrequent}</span>
                <span class="stat-label">最高單題錯誤</span>
            </div>
        `;
    }


    function renderHistory(wrongItems) {
        elements.historyList.innerHTML = '';

        if (!Array.isArray(wrongItems) || wrongItems.length === 0) {
            elements.historyList.innerHTML = '<div style="text-align:center; padding: 2rem;">查無錯題紀錄，太棒了！🎉</div>';
            return;
        }

        // Check for data corruption (e.g. if ID looks like JSON)
        const isCorrupted = wrongItems.some(item =>
            item.id && (item.id.includes('{') || item.id.includes(':') || item.id.includes('"'))
        );

        if (isCorrupted) {
            elements.historyList.innerHTML = `
                <div style="text-align:center; padding: 2rem; color: #ef4444; border: 2px dashed #ef4444; border-radius: 8px; background: #fff1f2;">
                    <h3>⚠️ 資料格式錯誤</h3>
                    <p>讀取到的錯題資料格式不正確，這通常是因為 Google 試算表的欄位順序錯誤導致。</p>
                    <p style="margin-top:10px; font-size: 0.9em; color: #374151;">
                        <strong>如何解決：</strong><br>
                        請檢查您的 Google 試算表，確保欄位沒有被刪除或位移。<br>
                        正確順序應為 6 欄：<br>
                    A:時間 | B:姓名 | C:分數 | D:摘要 | E:錯題編號 | F:詳細內容
                    </p>
                </div>
            `;
            return;
        }

        wrongItems.forEach(item => {
            // item from backend: {id, count, q, ans, ans_text, correct, correct_text}

            // Fallback: If text is missing (old records), try to find it in currently loaded questions
            let qText = item.q;
            let cText = item.correct_text;
            let aText = item.ans_text;

            if (!cText || !qText) {
                const found = state.allQuestions.find(q => String(q.id) === String(item.id));
                if (found) {
                    qText = found.question;
                    cText = found.options[item.correct];
                    aText = found.options[item.ans];
                }
            }

            const el = document.createElement('div');
            el.className = 'review-item';

            // Requested Format: 正確答案: B "選項內容"
            const correctDisplay = cText ? `${item.correct}  "${cText}"` : item.correct;
            const userDisplay = aText ? `${item.ans}  "${aText}"` : item.ans;

            el.innerHTML = `
                 <div class="review-question">
                    <span style="display:inline-block; min-width: 40px; font-weight:800; color:var(--primary-color);">#${item.id}</span>
                    <span style="font-weight: 500;">${formatQuestionText(qText)}</span>
                 </div>
                 <div style="margin-top: 12px; display: flex; flex-direction: column; gap: 8px;">
                    <div class="review-answer user-answer" style="margin-bottom:0; color: #ef4444; font-weight: 500;">您的答案 : ${formatQuestionText(userDisplay)}</div>
                    <div class="review-answer correct-answer" style="margin-bottom:0; color: #10b981; font-weight: 600;">正確答案 : ${formatQuestionText(correctDisplay)}</div>
                 </div>
                 <div style="margin-top: 10px; display: flex; justify-content: flex-end;">
                    <div style="background: #fee2e2; color: #ef4444; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">
                        錯題次數：${item.count}
                    </div>
                 </div>
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
        elements.questionText.innerHTML = formatQuestionText(currentQ.question);

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
                <div class="option-text">${formatQuestionText(optionText)}</div>
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
        const isVipRecord = state.vipList.some(v =>
            String(v).trim().toLowerCase() === state.userName.toLowerCase()
        );

        if (isVipRecord) {
            const wrongIds = wrongAnswers.map(w => w.question.id).join(', ');
            const currentDateTime = new Date().toLocaleString('zh-TW', { hour12: false });

            submitToGoogleSheet({
                time: currentDateTime,
                name: state.userName,
                score: finalScore,
                summary: `答對 ${score} / ${total} 題`,
                bank_type: state.currentBankName,
                wrong_ids: wrongIds,
                detail: JSON.stringify(wrongAnswers.map(w => ({
                    id: w.question.id,
                    q: w.question.question,
                    ans: w.userAns,
                    ans_text: w.question.options[w.userAns] || '未作答',
                    correct: w.question.answer,
                    correct_text: w.question.options[w.question.answer]
                }))),
                exam_type: state.examType
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
                    <div class="review-question">${item.question.id}. ${formatQuestionText(item.question.question)}</div>
                    <div class="review-answer user-answer">您的答案：${formatQuestionText(item.userAns)}</div>
                    <div class="review-answer correct-answer">正確答案：${item.question.answer} (${formatQuestionText(item.question.options[item.question.answer])})</div>
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

    async function teacherLogin() {
        const passcode = prompt('請輸入教師管理密碼：');
        if (!passcode) return;

        if (passcode === 'teacher888') {
            switchScreen('teacher-screen');
            showTeacherDashboard(passcode);
        } else {
            alert('密碼錯誤！');
        }
    }

    async function showTeacherDashboard(passcode) {
        try {
            elements.teacherStudentList.innerHTML = '<tr><td colspan="5" style="text-align:center;">載入全體數據中...</td></tr>';

            const response = await fetch(`${GOOGLE_SCRIPT_URL}?mode=all&passcode=${encodeURIComponent(passcode)}`);
            if (!response.ok) throw new Error('Network error');
            const data = await response.json();

            if (data.result === 'error') {
                alert('載入失敗：' + data.error);
                return;
            }

            state.rawTeacherData = data;
            renderTeacherDashboard(data);
        } catch (error) {
            console.error('Teacher dashboard load failed:', error);
            alert('讀取失敗，請確認網路連線或授權設定。');
        }
    }

    function renderTeacherDashboard(data) {
        if (!data || !Array.isArray(data)) return;

        const searchTerm = elements.teacherStudentSearch.value.trim().toLowerCase();

        // 1. Process Student Grouping
        const studentStats = {};
        data.forEach(row => {
            const name = row.name;
            if (!studentStats[name]) {
                studentStats[name] = {
                    name,
                    maxScore: 0,
                    count: 0,
                    lastTime: '',
                    rawRows: []
                };
            }
            studentStats[name].count++;
            studentStats[name].maxScore = Math.max(studentStats[name].maxScore, parseInt(row.score) || 0);
            studentStats[name].lastTime = row.time;
            studentStats[name].rawRows.push(row);
        });

        // 2. Process Global Stats
        const totalEntries = data.length;
        const avgScore = Math.round(data.reduce((sum, r) => sum + (parseInt(r.score) || 0), 0) / (totalEntries || 1));
        const totalStudents = Object.keys(studentStats).length;

        elements.teacherStats.innerHTML = `
            <div class="stat-card">
                <span class="stat-value">${totalStudents}</span>
                <span class="stat-label">總學生數</span>
            </div>
            <div class="stat-card">
                <span class="stat-value">${totalEntries}</span>
                <span class="stat-label">總測驗次數</span>
            </div>
            <div class="stat-card">
                <span class="stat-value">${avgScore}</span>
                <span class="stat-label">平均分數</span>
            </div>
        `;

        // 3. Render Student Table
        const filteredStudents = Object.values(studentStats)
            .filter(s => s.name.toLowerCase().includes(searchTerm))
            .sort((a, b) => b.maxScore - a.maxScore);

        elements.teacherStudentList.innerHTML = filteredStudents.map(s => `
            <tr>
                <td><strong>${s.name}</strong></td>
                <td><span style="color:var(--primary-color); font-weight:bold;">${s.maxScore}</span></td>
                <td>${s.count}</td>
                <td style="font-size:0.85rem; color:#666;">${s.lastTime}</td>
                <td><button class="btn secondary-btn" style="padding:4px 10px; font-size:0.8rem;" onclick="viewStudentDetail('${s.name}')">檢視</button></td>
            </tr>
        `).join('') || '<tr><td colspan="5" style="text-align:center;">無相符資料</td></tr>';

        // 4. Process Top 10 Errors
        const errorRanking = {};
        data.forEach(row => {
            if (row.wrong_ids) {
                const ids = row.wrong_ids.split(',').map(id => id.trim());
                ids.forEach(id => {
                    const key = `${id} (${row.bank})`;
                    if (!errorRanking[key]) errorRanking[key] = { id, bank: row.bank, count: 0 };
                    errorRanking[key].count++;
                });
            }
        });

        const topErrors = Object.values(errorRanking)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        elements.teacherTopErrors.innerHTML = topErrors.map(err => `
            <div class="teacher-top-item">
                <span>#${err.id} <small>${err.bank}</small></span>
                <span class="count-badge">錯誤 ${err.count} 次</span>
            </div>
        `).join('') || '目前尚無錯誤數據';
    }

    function generateExamPaper() {
        let questionsToPrint = [];

        if (state.examModeType === 'fixed') {
            if (!state.selectedExamRange) {
                alert('請先選擇題目範圍');
                return;
            }
            const { start, end } = state.selectedExamRange;
            questionsToPrint = state.allQuestions.slice(start - 1, end);
        } else {
            const count = parseInt(elements.examQuestionCount.value) || 20;
            if (count > state.allQuestions.length) {
                alert(`抽取數量超過現有題數 (${state.allQuestions.length})`);
                return;
            }
            questionsToPrint = shuffleArray([...state.allQuestions]).slice(0, count);
        }

        if (questionsToPrint.length === 0) {
            alert('沒有可列印的題目');
            return;
        }

        const bankName = state.currentBankName || '自選題庫';
        const rangeLabel = state.examModeType === 'fixed' ? `(範圍: ${state.selectedExamRange.label})` : `(隨機抽取: ${questionsToPrint.length} 題)`;

        const printWindow = window.open('', '_blank');
        const printDoc = printWindow.document;

        let html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <title>${bankName} - 考卷匯出</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700&display=swap');
        body { font-family: 'Noto+Sans+TC', sans-serif; padding: 40px; color: #333; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
        .header h1 { margin: 0; font-size: 24px; }
        .header p { margin: 10px 0 0; color: #666; }
        .meta-info { display: flex; justify-content: space-between; margin-bottom: 20px; font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
        .question-list { list-style: none; padding: 0; }
        .question-item { margin-bottom: 25px; page-break-inside: avoid; }
        .question-text { font-weight: bold; margin-bottom: 8px; font-size: 16px; }
        .options { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-left: 20px; }
        .option-item { font-size: 15px; }
        @media print {
            body { padding: 0; }
            .no-print { display: none; }
            button { display: none; }
        }
        .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
        .actions { position: fixed; top: 20px; right: 20px; }
        .btn { padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: bold; }
        .btn:hover { background: #1d4ed8; }
        img { max-width: 200px; max-height: 150px; vertical-align: middle; margin: 5px; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="actions no-print">
        <button class="btn" onclick="window.print()">🖨️ 開始列印考卷</button>
    </div>

    <div class="header">
        <h1>新科國中技藝競賽學科題庫 - 測驗考卷</h1>
        <p>${bankName} ${rangeLabel}</p>
    </div>

    <div class="meta-info">
        <span>姓名：____________________</span>
        <span>班級：__________</span>
        <span>座號：_____</span>
        <span>日期：${new Date().toLocaleDateString('zh-TW')}</span>
    </div>

    <div class="question-list">
        ${questionsToPrint.map((q, idx) => `
            <div class="question-item">
                <div class="question-text">${idx + 1}. (${q.id}) ${formatQuestionText(q.question)}</div>
                <div class="options">
                    <div class="option-item">(A) ${formatQuestionText(q.options.A)}</div>
                    <div class="option-item">(B) ${formatQuestionText(q.options.B)}</div>
                    <div class="option-item">(C) ${formatQuestionText(q.options.C)}</div>
                    <div class="option-item">(D) ${formatQuestionText(q.options.D)}</div>
                </div>
            </div>
        `).join('')}
    </div>

    <div class="footer">
        本考卷由測驗系統自動生成 | 僅供練習使用
    </div>
</body>
</html>`;

        printDoc.open();
        printDoc.write(html);
        printDoc.close();
    }

    // Global helper for student lookup (accessible via onclick)
    window.viewStudentDetail = function (name) {
        elements.usernameInput.value = name;
        showHistory();
    };
});

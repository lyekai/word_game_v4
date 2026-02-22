let currentLevel = 1; 
let levelDataCache = []; 
let currentSentencePrompt = ""; 
let feedbackCount = 0; // 新增：追蹤 AI 回饋次數

const words = [
    "pizza","kite","grassland","computer","coffee","office","television","sofa","living room",
    "clock","blackboard","classroom","sandwich","robot","factory","bottle","badminton","gym","basketball",
    "scarf","park","glasses","madam","boutique","bathtub","toilet","bathroom","campsite","tent","guitar","magnifier",
    "pasta","scientist","hero","reporter","street","hamburger","market","earphone","wallet","donut","swimsuit"
];
function updateStars(type, count) {
    const selector = type === 'word' ? '.word-star' : '.sentence-star';
    const starGroup = document.querySelectorAll(selector);
    starGroup.forEach((star, index) => {
        if (index < count) {
            star.classList.add('lit');
        } else {
            star.classList.remove('lit');
        }
    });
}

function typeEffect(elementId, text, delay = 30, callback = null) {
    const container = document.getElementById(elementId);
    container.innerHTML = ''; // 清空容器
    
    // 創建一個用來顯示文字的 element
    const outputElement = document.createElement('div');
    // 重要：這行讓 \n 變成真正的換行
    outputElement.style.whiteSpace = 'pre-wrap'; 
    outputElement.style.lineHeight = '1.6'; // 讓行距美觀一點
    container.appendChild(outputElement);
    
    let i = 0;
    const feedBackBox = document.querySelector(".feed-back"); 
    
    function typing() {
        if (i < text.length) {
            // 統一使用 textContent，這樣最安全，也不會誤解析標籤
            outputElement.textContent += text.charAt(i);
            i++;
            
            // 自動滾動到底部
            if(feedBackBox) feedBackBox.scrollTop = feedBackBox.scrollHeight;
            
            setTimeout(typing, delay);
        } else if (callback) { 
            callback(); 
        }
    }
    typing();
}

async function showModal() {
    const levelData = levelDataCache.find(item => Number(item.level) === Number(currentLevel));
    
    if (!levelData) {
        console.error("Critical: Could not find levelData for level", currentLevel);
        return; 
    }
    const userSentence = document.getElementById("sentence-input").value.trim();
    
    const selectedWords = [
        document.getElementById("answer1").textContent.trim(),
        document.getElementById("answer2").textContent.trim(),
        document.getElementById("answer3").textContent.trim()
    ];

    const currentWordStars = document.querySelectorAll('.word-star.lit').length;
    const currentSentenceStars = document.querySelectorAll('.sentence-star.lit').length;

    // --- [新增：困難模式最高星星紀錄邏輯] ---
    const totalStarsThisTime = currentWordStars + currentSentenceStars;
    const mode = 'hard'; // 確保這裡是 hard
    
    let starRecords = JSON.parse(localStorage.getItem('starRecords')) || { "easy": {}, "hard": {} };
    
    // 如果這次跑出來的星星比紀錄的高，就更新該關卡的最高分
    if (!starRecords[mode][currentLevel] || totalStarsThisTime > starRecords[mode][currentLevel]) {
        starRecords[mode][currentLevel] = totalStarsThisTime;
        localStorage.setItem('starRecords', JSON.stringify(starRecords));
    }
    // --------------------------------------

    // 顯示原始圖片 (左側)
    document.getElementById("generated-image").src = levelData ? levelData.image_origin : "";
    const loading = document.getElementById("ai-loading-placeholder");
    const aiImg = document.getElementById("ai-generated-image");
    
    loading.classList.remove("hidden");
    loading.textContent = "正在生成圖片並保存紀錄..."; 
    aiImg.classList.add("hidden");
    document.getElementById("image-modal").classList.add("visible");

    try {
        const response = await fetch("/api/generate_image", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                mode: 'hard', // 確保這裡傳送給後端的是 hard
                user_sentence: userSentence,
                level: currentLevel,
                correct_words: selectedWords,
                word_stars: currentWordStars,
                sentence_stars: currentSentenceStars
            })
        });
        
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const result = await response.json();

        // --- [關鍵修正點]：改回與後端對齊的 Base64 載入模式 ---
        if (result.image_data) {
            // 將 Base64 資料拼接為 src 格式
            aiImg.src = "data:image/png;base64," + result.image_data;

            // 監聽圖片下載完成
            aiImg.onload = () => {
                loading.classList.add("hidden");
                aiImg.classList.remove("hidden");
                console.log("Hard mode AI 圖片載入成功 (Base64)");
            };

            // 監聽圖片下載失敗
            aiImg.onerror = () => {
                loading.textContent = "圖片載入失敗，可能 Base64 資料損毀。";
            };
        } else if (result.error === "image_failed") {
            loading.textContent = "AI 生圖服務目前繁忙，請稍後重試。";
        } else {
            loading.textContent = "圖片生成失敗：未收到有效數據。";
        }
    } catch (e) {
        console.error("Hard mode image fetch error:", e);
        loading.textContent = "生圖連線異常。";
    }
}

function loadLevel(level, isReplay = false) {
    if (level > levelDataCache.length) { level = 1; }
    if (level < 1) { level = 1; }
    const levelData = levelDataCache.find(item => item.level === level);
    if (!levelData) return;
    
    currentLevel = level;
    feedbackCount = 0; // 重置回饋次數
    
    document.querySelectorAll(".level-circle").forEach(c => {
        c.classList.remove("active");
        if (parseInt(c.textContent) === level) c.classList.add("active");
    });

    document.getElementById("vague-image").src = levelData.image_vague;
    document.getElementById("tip1").textContent = levelData.tip[0];
    document.getElementById("tip2").textContent = levelData.tip[1];
    document.getElementById("tip3").textContent = levelData.tip[2];

    if (!isReplay) {
        document.querySelectorAll(".answer-box").forEach(b => { 
            b.textContent = ""; 
            b.classList.remove("incorrect", "correct", "correct-locked"); 
        });
        document.getElementById("sentence-input").value = "";
        document.getElementById("feedback-container").innerHTML = "";
        const confirmBtn = document.querySelector(".confirm-btn");
        confirmBtn.textContent = "確認"; // 重置按鈕文字
        renderCards(); 
        setSentencePrompt(levelData);
    }
    updateConfirmButton();
    document.querySelectorAll(".star").forEach(s => s.classList.remove("lit"));
}

function renderCards() {
    const container = document.querySelector(".cards");
    const taken = Array.from(document.querySelectorAll(".answer-box")).map(b => b.textContent.trim()).filter(w => w !== "");
    container.innerHTML = "";
    [...words].sort().forEach(word => {
        if (taken.includes(word)) return;
        const card = document.createElement("div");
        card.className = "card";
        card.textContent = word;
        card.dataset.word = word;
        container.appendChild(card);
    });
}

function setSentencePrompt(levelData) {
    const p = document.querySelector("#sentence p");
    if (levelData?.sentence?.length > 0) {
        currentSentencePrompt = levelData.sentence[Math.floor(Math.random() * levelData.sentence.length)];
        p.innerHTML = `請用選擇的三個單字造一個句子 (${currentSentencePrompt})`;
    }
}

function updateConfirmButton() {
    const a1 = document.getElementById("answer1").textContent.trim();
    const a2 = document.getElementById("answer2").textContent.trim();
    const a3 = document.getElementById("answer3").textContent.trim();
    const s = document.getElementById("sentence-input").value.trim();
    
    const isCardsFull = (a1 !== "" && a2 !== "" && a3 !== "");
    document.querySelector(".submit-btn").classList.toggle("hidden", !isCardsFull);

    const isSentenceReady = (s !== "");
    document.querySelector(".confirm-btn").classList.toggle("hidden", !isSentenceReady);
    // 移除舊 generate-image-btn 的顯示逻辑
}

function handleSubmitAnswer() {
    const levelData = levelDataCache.find(item => item.level === currentLevel);
    if (!levelData) return;
    const userBoxes = [document.getElementById("answer1"), document.getElementById("answer2"), document.getElementById("answer3")];
    const corrects = levelData.answer.map(w => w.toLowerCase());

    userBoxes.forEach(box => {
        const word = box.textContent.trim().toLowerCase();
        box.classList.remove("incorrect", "correct", "correct-locked");
        if (corrects.includes(word)) {
            box.classList.add("correct", "correct-locked"); 
        } else if (word !== "") {
            box.classList.add("incorrect"); 
        }
    });
    const correctCount = document.querySelectorAll(".answer-box.correct").length;
    updateStars('word', correctCount);
}
function evaluateSentenceStars(sentence, userWords) {
    let stars = 0;
    const s = sentence.trim();
    const sLower = s.toLowerCase();
    
    // --- 準備檢測工具 ---
    // 1. 句型門檻檢測 (符合 These are... 或 What is... doing?)
    const hasPattern = /\b(these|those|they are)\b/i.test(sLower) || /\bwhat (is|are) .+ doing\b/i.test(sLower);
    
    // 2. 單字應用檢測 (包含至少 3 個選擇的單字)
    const usedCount = userWords.filter(w => sLower.includes(w.toLowerCase())).length;
    
    // 3. 格式與基礎文法檢測
    const hasSubject = /\b(i|you|he|she|it|we|they|the|this|that|these|those)\b/i.test(sLower);
    const hasVerb = /\b(is|am|are|was|were|be|have|has|do|does|did|can|could|will|should)\b/i.test(sLower);
    const properFormat = /^[A-Z]/.test(s) && /[.!?]$/.test(s); // 首字大寫且標點結尾
    const noSpacingIssue = !(/\s[.,!?;:]|[.,!?;:](?!\s|$)|\s{2,}/.test(s)); // 標點空格正確
    
    // 4. 進階豐富度
    const wordCount = s.split(/\s+/).filter(w => w.length > 0).length;
    const hasAdjective = /\b(beautiful|big|small|happy|sad|red|blue|green|yellow|white|black|fast|slow|good|nice)\b/i.test(sLower);

    // --- 階層式給星 (1-4 顆造句星) ---
    
    // ⭐ 第 1 顆造句星 (總計第 4 顆)：必須符合句型提示
    if (hasPattern) {
        stars = 1;

        // ⭐ 第 2 顆造句星 (總計第 5 顆)：必須符合句型 + 用對 3 個單字
        if (usedCount >= 3) {
            stars = 2;

            // ⭐ 第 3 顆造句星 (總計第 6 顆)：格式正確 + 有主謂 + 無空格錯誤
            if (properFormat && hasSubject && hasVerb && noSpacingIssue) {
                stars = 3;

                // ⭐ 第 4 顆造句星 (總計第 7 顆)：句子長度 >= 6 且有形容詞 (流暢度獎勵)
                if (wordCount >= 6 && hasAdjective) {
                    stars = 4;
                }
            }
        }
    }

    updateStars('sentence', stars);
}

async function handleConfirm() {
    const btn = document.querySelector(".confirm-btn");
    const sentenceInput = document.getElementById("sentence-input");
    const levelData = levelDataCache.find(item => item.level === currentLevel);
    
    if (!levelData) return;

    const userBoxes = [document.getElementById("answer1"), document.getElementById("answer2"), document.getElementById("answer3")];
    const userWords = userBoxes.map(b => b.textContent.trim().toLowerCase()).filter(w => w !== "");
    
    // --- [修正重點 1]：先計算星星，更新畫面上 class "lit" 的狀態 ---
    evaluateSentenceStars(sentenceInput.value.trim(), userWords);

    // --- [修正重點 2]：從更新後的畫面抓取正確的星星數 ---
    const currentWordStars = document.querySelectorAll('.word-star.lit').length;
    const currentSentenceStars = document.querySelectorAll('.sentence-star.lit').length;

    if (feedbackCount >= 3) {
        showModal();
        return;
    }

    const corrects = levelData.answer.map(w => w.toLowerCase());
    const missing = corrects.filter(w => !userWords.includes(w));
    
    btn.disabled = true;
    document.getElementById("feedback-container").innerHTML = "🤖 AI 老師正在閱卷並記錄學習進度...";

    try {
        const res = await fetch("/api/ai_feedback", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                mode: 'hard',
                level: currentLevel, 
                missing_words: missing, 
                user_sentence: sentenceInput.value.trim(), 
                sentence_prompt: currentSentencePrompt, 
                correct_words: userWords,
                feedback_count: feedbackCount,
                // 傳送剛才計算好的星星數
                word_stars: currentWordStars,
                sentence_stars: currentSentenceStars
            })
        });
        
        const data = await res.json();
        
        typeEffect('feedback-container', data.feedback, 30, () => {
            feedbackCount++; 
            btn.disabled = false;
            if (feedbackCount < 3) {
                btn.textContent = "再造一次";
            } else {
                btn.textContent = "生成圖片";
            }
            updateConfirmButton();
        });
    } catch (e) {
        document.getElementById("feedback-container").innerHTML = "連線失敗。";
        btn.disabled = false;
    }
}

window.addEventListener("DOMContentLoaded", () => {
    document.querySelector(".cards").addEventListener("click", e => {
        if (!e.target.classList.contains("card")) return;
        const emptyBox = [
            document.getElementById("answer1"),
            document.getElementById("answer2"),
            document.getElementById("answer3")
        ].find(b => b.textContent.trim() === "");
        
        if (emptyBox) {
            emptyBox.textContent = e.target.dataset.word; 
            e.target.remove(); 
            updateConfirmButton(); 
        }
    });

    document.querySelectorAll(".answer-box").forEach(box => {
        box.addEventListener("click", () => {
            if (box.textContent === "" || box.classList.contains("correct-locked")) return;
            box.textContent = ""; 
            box.classList.remove("incorrect", "correct");
            renderCards(); 
            updateConfirmButton();
        });
    });

    document.getElementById("sentence-input").addEventListener("input", () => {
        // 修改句子時，不需要重置回饋次數，只需確認按鈕是否顯示
        updateConfirmButton();
    });

    document.querySelector(".confirm-btn").addEventListener("click", handleConfirm);
    document.querySelector(".submit-btn").addEventListener("click", handleSubmitAnswer); 
    
    // 移除舊 generate-image-btn 的事件監聽

    document.getElementById("next-level-btn").addEventListener("click", () => { 
        document.getElementById("image-modal").classList.remove("visible"); 

        // --- 新增：困難模式存檔邏輯 ---
        const mode = 'hard'; 
        let progressData = JSON.parse(localStorage.getItem('gameProgress')) || { "easy": 1, "hard": 1 };
        
        // 如果目前通過的關卡大於等於紀錄，則解鎖下一關
        if (currentLevel >= progressData[mode]) {
            progressData[mode] = currentLevel + 1;
            localStorage.setItem('gameProgress', JSON.stringify(progressData));
        }

        loadLevel(currentLevel + 1); 
    });
    
    fetch("/static/data/hard_mode.json")
        .then(res => {
            if (!res.ok) throw new Error("找不到困難模式關卡檔案");
            return res.json();
        })
        .then(data => { 
            levelDataCache = data; 
            const urlParams = new URLSearchParams(window.location.search);
            const levelParam = urlParams.get('level');
            loadLevel(levelParam ? parseInt(levelParam) : 1);
        })
        .catch(err => {
            console.error(err);
            alert("讀取關卡失敗，請檢查 /static/data/hard_mode.json 是否存在");
        });
});
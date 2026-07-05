// ==========================================
// Dark Fantasy Pachinko Simulator Logic
// ==========================================

// --- Constants & Config ---
const BALLS_PER_SPIN = 15;
const NORMAL_HIT_PROB = 1 / 399.9;
const RUSH_HIT_PROB = 1 / 95.3;
const RUSH_ENTRY_RATE = 0.51; // 51%
const MAX_ST_SPINS = 130;
const NORMAL_PAYOUT = 1500;
const RUSH_PAYOUT = 3000;

// --- State Variables ---
let state = {
    isRush: false,
    stRemaining: 0,
    currentBalls: 0,
    maxBalls: 0,
    currentSpins: 0,
    totalHits: 0,
    firstHits: 0,
    rushCount: 0,
    totalNormalSpins: 0,
    currentCombo: 0,
    maxCombo: 0,
    isSpinning: false,
    autoSpinEnabled: false,
    autoSpinsRemaining: 0,
    isCurrentSpinHit: false
};

// --- DOM Elements ---
const elCurrentSpins = document.getElementById('currentSpins');
const elTotalNormalSpins = document.getElementById('totalNormalSpins');
const elTotalHits = document.getElementById('totalHits');
const elFirstHits = document.getElementById('firstHits');
const elHitProb = document.getElementById('hitProb');
const elRushCount = document.getElementById('rushCount');
const elComboCount = document.getElementById('comboCount');
const elMaxComboCount = document.getElementById('maxComboCount');
const elCurrentBalls = document.getElementById('currentBalls');
const elMaxBalls = document.getElementById('maxBalls');

const elEffectLayer = document.getElementById('effectLayer');
const elStatusOverlay = document.getElementById('statusOverlay');
const elStRemaining = document.getElementById('stRemaining');
const elCutIn = document.getElementById('cutIn');
const elTelop = document.getElementById('telop');
const elLcdScreen = document.getElementById('lcdScreen');
const elTopLamp = document.getElementById('topLamp');
const elYakumono = document.getElementById('yakumono');

const syms = [
    document.getElementById('symLeft'),
    document.getElementById('symCenter'),
    document.getElementById('symRight')
];

const btn1 = document.getElementById('btn1Spin');
const btn10 = document.getElementById('btn10Spin');
const btn100 = document.getElementById('btn100Spin');
const btnAuto = document.getElementById('btnAuto');
const btnReset = document.getElementById('btnReset');
const elLogContent = document.getElementById('logContent');

// --- Helper Functions ---

let ballChart;
function initChart() {
    const ctx = document.getElementById('ballChart').getContext('2d');
    ballChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [0],
            datasets: [{
                label: '持ち玉',
                data: [0],
                borderColor: '#ff0000',
                backgroundColor: 'rgba(255, 0, 0, 0.1)',
                borderWidth: 2,
                pointRadius: 0,
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                x: { display: false },
                y: { grid: { color: '#333' }, ticks: { color: '#aaa' } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function updateChart() {
    if (!ballChart) return;
    ballChart.data.labels.push(state.totalNormalSpins + state.currentSpins);
    ballChart.data.datasets[0].data.push(state.currentBalls);
    ballChart.update();
}

function updateStats() {
    elCurrentSpins.textContent = state.currentSpins;
    elTotalNormalSpins.textContent = state.totalNormalSpins;
    elTotalHits.textContent = state.totalHits;
    elFirstHits.textContent = state.firstHits;
    elRushCount.textContent = state.rushCount;
    elCurrentBalls.textContent = state.currentBalls;
    elComboCount.textContent = state.currentCombo;
    elMaxComboCount.textContent = state.maxCombo;
    
    if (state.firstHits > 0) {
        elHitProb.textContent = `1/${Math.floor(state.totalNormalSpins / state.firstHits)}`;
    } else {
        elHitProb.textContent = '1/---';
    }
    
    if (state.currentBalls > state.maxBalls) {
        state.maxBalls = state.currentBalls;
    }
    elMaxBalls.textContent = state.maxBalls;
    elStRemaining.textContent = state.stRemaining;
}

function addLog(msg, type = '') {
    const p = document.createElement('p');
    p.textContent = `[${state.currentSpins}回転] ${msg}`;
    if (type) p.className = `log-${type}`;
    elLogContent.prepend(p);
    
    // ログが多くなりすぎたら削除
    if (elLogContent.children.length > 50) {
        elLogContent.lastElementChild.remove();
    }
}

function delay(ms) {
    const chkSkip = document.getElementById('chkSkip');
    let isSkip = chkSkip && chkSkip.checked;
    if (state.isCurrentSpinHit) {
        isSkip = false;
    }
    return new Promise(resolve => setTimeout(resolve, isSkip ? 0 : ms));
}

function setEffect(effectClass, durationMs = 0) {
    elEffectLayer.className = 'effect-layer ' + effectClass;
    if (durationMs > 0) {
        setTimeout(() => {
            elEffectLayer.className = 'effect-layer';
        }, durationMs);
    }
}

function showCutIn(text, typeClass) {
    elCutIn.textContent = text;
    elCutIn.className = 'cut-in ' + typeClass;
    // リセット用
    setTimeout(() => {
        elCutIn.className = 'cut-in';
    }, 3000);
}

function setSymbolsSpinning(isSpinning) {
    syms.forEach(sym => {
        if (isSpinning) {
            sym.classList.add('spinning');
            sym.textContent = '';
            sym.classList.remove('active', 'seven');
        } else {
            sym.classList.remove('spinning');
        }
    });
}

function setSymbol(index, num, isActive = false) {
    syms[index].classList.remove('spinning');
    syms[index].textContent = num;
    if (isActive) {
        syms[index].classList.add('active');
        if (num === 7) syms[index].classList.add('seven');
    }
}

// --- Main Logic ---

// ランダムに図柄を決定 (ハズレ用)
function getRandomSymbols(isReach) {
    const nums = [1,2,3,4,5,6,7,8,9];
    const left = nums[Math.floor(Math.random() * nums.length)];
    let right = nums[Math.floor(Math.random() * nums.length)];
    if (isReach) right = left;
    
    let center = nums[Math.floor(Math.random() * nums.length)];
    if (center === left && isReach) {
        center = (center % 9) + 1; // 揃わないようにずらす
    }
    
    return [left, center, right];
}

// 演出抽選 (通常時)
function drawNormalProduction(isHit) {
    const r = Math.random();
    if (isHit) {
        if (r < 0.6) return { type: 'awaken', name: '覚醒演出', reach: true, wait: 3500, logClass: 'red' };
        if (r < 0.9) return { type: 'gold', name: '最強リーチ', reach: true, wait: 3000, logClass: 'gold' };
        return { type: 'red', name: '赤演出', reach: true, wait: 2000, logClass: 'red' };
    } else {
        if (r < 0.002) return { type: 'awaken', name: '覚醒演出', reach: true, wait: 3500, logClass: 'red' };
        if (r < 0.007) return { type: 'gold', name: '金演出', reach: true, wait: 2500, logClass: 'gold' };
        if (r < 0.02) return { type: 'red', name: '赤演出', reach: true, wait: 2000, logClass: 'red' };
        if (r < 0.07) return { type: 'chance', name: 'チャンス', reach: true, wait: 1500, logClass: '' };
        return { type: 'normal', name: 'ノーマル', reach: false, wait: 600, logClass: '' };
    }
}

// 演出抽選 (RUSH中)
function drawRushProduction(isHit) {
    const r = Math.random();
    const prodNames = ['敵襲', '暴走', '覚醒', '一撃'];
    const pName = prodNames[Math.floor(Math.random() * prodNames.length)];
    
    if (isHit) {
        return { type: 'rush-hit', name: pName, wait: 1500, logClass: 'hit' };
    } else {
        return { type: 'rush-miss', name: '変動', wait: 300, logClass: '' };
    }
}

// 1回転の処理
async function spin() {
    if (state.isSpinning) return;
    
    // 通常時の玉減りチェック
    if (!state.isRush) {
        state.currentBalls -= BALLS_PER_SPIN;
        state.totalNormalSpins++;
    }
    
    state.isSpinning = true;
    state.currentSpins++;
    updateStats();

    if (state.currentSpins % 50 === 0 && !state.isRush) {
        updateChart();
    }
    
    if (state.isRush) {
        state.stRemaining--;
        updateStats();
        await handleRushSpin();
    } else {
        await handleNormalSpin();
    }
    
    state.isSpinning = false;
    state.isCurrentSpinHit = false;
    
    // オート進行
    const chkSkip = document.getElementById('chkSkip');
    const isSkip = chkSkip && chkSkip.checked;
    const timeoutWait = isSkip ? 0 : 100;

    if (state.autoSpinEnabled && state.autoSpinsRemaining > 0) {
        state.autoSpinsRemaining--;
        setTimeout(spin, timeoutWait);
    } else if (state.autoSpinEnabled && state.autoSpinsRemaining <= 0) {
        // RUSH終了時など無限オートの場合は続く
        if (state.autoSpinsRemaining === -1) {
            setTimeout(spin, timeoutWait);
        } else {
            stopAuto();
        }
    }
}

async function handleNormalSpin() {
    elTelop.textContent = '変動中...';
    setSymbolsSpinning(true);
    
    const chkSkip = document.getElementById('chkSkip');
    const isSkip = chkSkip && chkSkip.checked;
    
    const isHit = Math.random() < NORMAL_HIT_PROB;
    state.isCurrentSpinHit = isHit;
    
    if (!isSkip || state.isCurrentSpinHit) Sound.spin();
    
    const prod = drawNormalProduction(isHit);
    
    if (prod.type !== 'normal') {
        elTelop.textContent = prod.name + ' 発動！';
        addLog(prod.name + ' 発生', prod.logClass);
    }
    
    // 演出表示
    if (prod.type === 'chance') { showCutIn('CHANCE', 'show-chance'); if (!isSkip || state.isCurrentSpinHit) Sound.chance(); }
    if (prod.type === 'red') { setEffect('effect-blood'); showCutIn('激熱', 'show-red'); if (!isSkip || state.isCurrentSpinHit) Sound.red(); }
    if (prod.type === 'gold') { setEffect('effect-flash-red', 1000); showCutIn('最強リーチ', 'show-gold'); if (!isSkip || state.isCurrentSpinHit) Sound.gold(); }
    if (prod.type === 'awaken') { 
        elLcdScreen.classList.add('shake');
        setEffect('effect-noise');
        showCutIn('覚醒', 'show-awaken'); 
        if (!isSkip || state.isCurrentSpinHit) Sound.awaken();
        setTimeout(() => elLcdScreen.classList.remove('shake'), 2000);
    }
    
    await delay(prod.wait);
    setEffect('');
    
    if (isHit) {
        await processHit(false);
    } else {
        const sym = getRandomSymbols(prod.reach);
        setSymbol(0, sym[0]);
        if (prod.reach) await delay(500);
        setSymbol(2, sym[2]);
        if (prod.reach) await delay(1000);
        setSymbol(1, sym[1]);
        elTelop.textContent = 'ハズレ';
    }
}

async function handleRushSpin() {
    elTelop.textContent = 'ST変動中...';
    setSymbolsSpinning(true);
    
    const chkSkip = document.getElementById('chkSkip');
    const isSkip = chkSkip && chkSkip.checked;
    
    const isHit = Math.random() < RUSH_HIT_PROB;
    state.isCurrentSpinHit = isHit;
    
    if (!isSkip || state.isCurrentSpinHit) Sound.spin();
    
    const prod = drawRushProduction(isHit);
    
    if (isHit) {
        elTelop.textContent = prod.name + '！';
        setEffect('effect-flash-red', 500);
        Sound.rushHit();
        await delay(prod.wait);
        await processHit(true);
    } else {
        await delay(prod.wait);
        const sym = getRandomSymbols(false);
        setSymbol(0, sym[0]);
        setSymbol(1, sym[1]);
        setSymbol(2, sym[2]);
    }
    
    // ST終了判定
    if (state.stRemaining <= 0 && state.isRush && !isHit) {
        await endRush();
    }
}

async function processHit(isFromRush) {
    state.totalHits++;
    
    let isRushEntry = false;
    let hitSymbol = 3;
    let payout = NORMAL_PAYOUT;
    
    if (isFromRush) {
        isRushEntry = true;
        hitSymbol = 7;
        payout = RUSH_PAYOUT;
        state.currentCombo++;
        addLog(`RUSH中大当り！ +${payout}玉`, 'hit');
    } else {
        state.firstHits++;
        state.currentCombo = 1;
        isRushEntry = Math.random() < RUSH_ENTRY_RATE;
        hitSymbol = isRushEntry ? 7 : (Math.random() < 0.5 ? 3 : 2); // 奇数ならRUSH風、通常は偶数
        addLog(`初当り！ +${payout}玉 (${isRushEntry ? 'RUSH突入' : '通常'})`, 'hit');
    }

    if (state.currentCombo > state.maxCombo) {
        state.maxCombo = state.currentCombo;
    }

    elYakumono.textContent = hitSymbol + '' + hitSymbol + '' + hitSymbol;

    Sound.kyuin();
    Sound.awaken();
    setTimeout(() => Sound.fanfare(), 1500);
    
    setEffect('');
    elLcdScreen.classList.add('super-shake');
    elYakumono.classList.add('drop');
    elTopLamp.className = 'top-lamp active-rainbow';
    setEffect('effect-flash-white', 2000);
    
    elTelop.textContent = '大当り！！！';
    setSymbol(0, hitSymbol, true);
    setSymbol(1, hitSymbol, true);
    setSymbol(2, hitSymbol, true);
    
    showCutIn('大当り', 'show-awaken');
    
    await delay(3000);
    elLcdScreen.classList.remove('super-shake');
    elYakumono.classList.remove('drop');
    elTopLamp.className = 'top-lamp';
    
    // 出玉追加
    state.currentBalls += payout;
    updateStats();
    updateChart();
    
    if (isRushEntry) {
        await enterRush();
    } else {
        // 通常へ
        elTelop.textContent = '通常モードへ戻ります';
        state.isRush = false;
        elStatusOverlay.style.display = 'none';
        state.currentSpins = 0; // 通常戻りで回転数リセット
    }
}

async function enterRush() {
    if (!state.isRush) {
        state.rushCount++;
        addLog('AWAKENING RUSH 突入！', 'red');
    } else {
        addLog('ST回数リセット', 'gold');
    }
    
    state.isRush = true;
    state.stRemaining = MAX_ST_SPINS;
    elStatusOverlay.style.display = 'flex';
    elLcdScreen.style.background = 'radial-gradient(circle at center, #300 0%, #000 100%)';
    updateStats();
    
    elTelop.textContent = 'RUSH開始！';
    await delay(1000);
}

async function endRush() {
    addLog('RUSH終了', '');
    elTelop.textContent = 'RUSH終了...';
    setEffect('effect-noise', 1000);
    await delay(1000);
    
    state.isRush = false;
    state.stRemaining = 0;
    state.currentCombo = 0;
    elStatusOverlay.style.display = 'none';
    elLcdScreen.style.background = 'radial-gradient(circle at center, #1a0000 0%, #000 100%)';
    state.currentSpins = 0; // RUSH抜け回転数リセット
    updateStats();
}

// --- Event Listeners ---

function startAuto(spins) {
    if (state.autoSpinEnabled && state.autoSpinsRemaining > 0 && spins !== -1) {
        state.autoSpinsRemaining += spins;
        return;
    }
    state.autoSpinEnabled = true;
    state.autoSpinsRemaining = spins;
    btnAuto.classList.add('active');
    if (!state.isSpinning) spin();
}

function stopAuto() {
    state.autoSpinEnabled = false;
    state.autoSpinsRemaining = 0;
    btnAuto.classList.remove('active');
}

btn1.addEventListener('click', () => { Sound.init(); stopAuto(); spin(); });
btn10.addEventListener('click', () => { Sound.init(); startAuto(10); });
btn100.addEventListener('click', () => { Sound.init(); startAuto(100); });
btnAuto.addEventListener('click', () => {
    Sound.init();
    if (state.autoSpinEnabled && state.autoSpinsRemaining === -1) {
        stopAuto();
    } else {
        startAuto(-1); // 無限オート
    }
});

btnReset.addEventListener('click', () => {
    Sound.init();
    stopAuto();
    state = {
        isRush: false,
        stRemaining: 0,
        currentBalls: 0,
        maxBalls: 0,
        currentSpins: 0,
        totalHits: 0,
        firstHits: 0,
        rushCount: 0,
        totalNormalSpins: 0,
        currentCombo: 0,
        maxCombo: 0,
        isSpinning: false,
        autoSpinEnabled: false,
        autoSpinsRemaining: 0,
        isCurrentSpinHit: false
    };
    if (ballChart) {
        ballChart.data.labels = [0];
        ballChart.data.datasets[0].data = [0];
        ballChart.update();
    }
    elLogContent.innerHTML = '<p>システムリセット完了</p>';
    setEffect('');
    elStatusOverlay.style.display = 'none';
    elLcdScreen.style.background = 'radial-gradient(circle at center, #1a0000 0%, #000 100%)';
    setSymbol(0, '-');
    setSymbol(1, '-');
    setSymbol(2, '-');
    elTelop.textContent = '変動待機中...';
    updateStats();
});

// Init
initChart();
updateStats();

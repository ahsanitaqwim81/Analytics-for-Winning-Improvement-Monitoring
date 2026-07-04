/* ================================================
   AWIM HANDBALL STATS v2.1 — app.js
   ================================================
   v2.1 changes:
   - Subtype popup untuk GOAL, MISS, FOUL
   - GOAL/MISS subtypes: Shot 7m, Shot 9m,
     Backthrought, Fastbreak, Penalti
   - FOUL subtypes: 9m, Kartu Kuning, 2 Menit,
     Kartu Merah, Kartu Biru
   - Hapus tombol YELLOW & RED dari panel utama
   - Kartu sekarang dicatat di dalam popup FOUL
   ================================================ */

// ============================================================
// SUBTYPE DEFINITIONS
// ============================================================
const SUBTYPES = {
    GOAL: ['Shot 9m', 'Backthrought', 'Penalti'],
    MISS: ['Shot 9m', 'Backthrought', 'Penalti'],
    SAVE: ['Block', 'Steal', 'Tackle', 'Offensive'],
    FOUL: ['9m', 'Travelling', 'Double Dribbling', 'Offensive Foul',
           'Kartu Kuning', '2 Menit', 'Kartu Merah', 'Kartu Biru'],
};

// CSS class untuk tiap subtype FOUL
const FOUL_CSS = {
    '9m':           'foul-9m',
    'Kartu Kuning': 'foul-yellow',
    '2 Menit':      'foul-2min',
    'Kartu Merah':  'foul-red',
    'Kartu Biru':   'foul-blue',
};

// Icon tiap subtype (FOUL & SAVE)
const FOUL_ICONS = {
    '9m':           '🚫',
    'Kartu Kuning': '🟨',
    '2 Menit':      '⏱',
    'Kartu Merah':  '🟥',
    'Kartu Biru':   '🔵',
    // Save Subtypes
    'Block':        '🛡️',
    'Steal':        '⚡',
    'Tackle':       '🛡️',
    'Offensive':    '💥',
};

// Efek kartu ke statistik pemain
const CARD_STAT_KEY = {
    'Kartu Kuning': 'yellowCards',
    '2 Menit':      'twoMins',
    'Kartu Merah':  'redCard',
    'Kartu Biru':   'blueCard',
};

const COURT_ZONE_NAMES = {
    'L1': 'Kiri - 6m Atas',
    'L2': 'Kiri - 6m Atas-Tengah',
    'L3': 'Kiri - 6m Tengah',
    'L4': 'Kiri - 6m Bawah-Tengah',
    'L5': 'Kiri - 6m Bawah',
    'L6': 'Kiri - 9m+ Atas',
    'L7': 'Kiri - 9m+ Atas-Tengah',
    'L8': 'Kiri - 9m+ Tengah',
    'L9': 'Kiri - 9m+ Bawah-Tengah',
    'L10': 'Kiri - 9m+ Bawah',
    'R1': 'Kanan - 6m Atas',
    'R2': 'Kanan - 6m Atas-Tengah',
    'R3': 'Kanan - 6m Tengah',
    'R4': 'Kanan - 6m Bawah-Tengah',
    'R5': 'Kanan - 6m Bawah',
    'R6': 'Kanan - 9m+ Atas',
    'R7': 'Kanan - 9m+ Atas-Tengah',
    'R8': 'Kanan - 9m+ Tengah',
    'R9': 'Kanan - 9m+ Bawah-Tengah',
    'R10': 'Kanan - 9m+ Bawah'
};

// ============================================================
// STATE UTAMA
// ============================================================
let matchData     = null;
let timerInterval = null;
let isRunning     = false;

let selectedPlayerA = null;
let selectedPlayerB = null;

// State aksi yang sedang diproses
let pendingAction = null;
// { team, type, player, subtype }

let selectedCourtZone = null;

let subTeam  = null;
let timeoutsA = 3;
let timeoutsB = 3;
let activeFilter = 'all';

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    const raw = localStorage.getItem('matchData');
    if (!raw) {
        alert('Tidak ada data pertandingan. Kembali ke Setup.');
        window.location.href = 'index.html';
        return;
    }
    matchData = JSON.parse(raw);
    if (!matchData.events)        matchData.events = [];
    if (!matchData.scoreA)        matchData.scoreA = 0;
    if (!matchData.scoreB)        matchData.scoreB = 0;
    if (!matchData.currentPeriod) matchData.currentPeriod = 1;
    if (matchData.timeLeft == null)
        matchData.timeLeft = (matchData.info.duration || 30) * 60;

    timeoutsA = matchData.timeoutsA ?? 3;
    timeoutsB = matchData.timeoutsB ?? 3;

    renderAll();
    renderCourtSVG();
    updateTimerDisplay();
    renderLog();
    updateStats();
    updateTimeoutDisplay();
});

// ============================================================
// RENDER SEMUA
// ============================================================
function renderAll() {
    const { teamA, teamB } = matchData;

    document.getElementById('team-name-home').innerText  = teamA.name.toUpperCase();
    document.getElementById('team-name-away').innerText  = teamB.name.toUpperCase();
    document.getElementById('team-coach-home').innerText = 'Coach: ' + teamA.coach;
    document.getElementById('team-coach-away').innerText = 'Coach: ' + teamB.coach;
    document.getElementById('jersey-home').style.background = teamA.color || '#e74c3c';
    document.getElementById('jersey-away').style.background = teamB.color || '#1abc9c';
    document.getElementById('score-home').innerText = matchData.scoreA;
    document.getElementById('score-away').innerText = matchData.scoreB;

    const pl = 'BABAK ' + matchData.currentPeriod;
    document.getElementById('period-label').innerText    = pl;
    document.getElementById('nav-period-label').innerText = pl;

    if (!matchData.teamA.playerState) {
        matchData.teamA.playerState = {};
        (teamA.players || []).forEach((p, i) => {
            matchData.teamA.playerState[p.nomor] = i < 7 ? 'court' : 'bench';
        });
    }
    if (!matchData.teamB.playerState) {
        matchData.teamB.playerState = {};
        (teamB.players || []).forEach((p, i) => {
            matchData.teamB.playerState[p.nomor] = i < 7 ? 'court' : 'bench';
        });
    }
    if (!matchData.teamA.stats) matchData.teamA.stats = {};
    if (!matchData.teamB.stats) matchData.teamB.stats = {};

    renderRoster('A');
    renderRoster('B');
}

// ============================================================
// ROSTER
// ============================================================
function renderRoster(team) {
    const data    = team === 'A' ? matchData.teamA : matchData.teamB;
    const grid    = document.getElementById('player-grid-' + team);
    const bench   = document.getElementById('bench-grid-' + team);
    const players = data.players || [];
    const state   = data.playerState || {};
    const stats   = data.stats || {};

    grid.innerHTML  = '';
    bench.innerHTML = '';

    players.forEach(p => {
        const s   = state[p.nomor] || 'bench';
        const st  = stats[p.nomor] || {};
        const btn = document.createElement('button');

        // Determine suspension state
        const isSuspended = st.redCard || st.blueCard;
        let cssClass = 'btn-player ' + (isSuspended ? 'suspended' : s === 'court' ? 'on-court' : 'bench');

        // Card badges (stacked)
        let badgeHTML = '';
        if (st.redCard)          badgeHTML += '<span class="card-badge red">RED</span>';
        else if (st.blueCard)    badgeHTML += '<span class="card-badge blue">BLU</span>';
        else if ((st.twoMins||0) > 0)
                                 badgeHTML += `<span class="card-badge twomin">2'</span>`;
        else if ((st.yellowCards||0) > 0)
                                 badgeHTML += `<span class="card-badge">${st.yellowCards}K</span>`;

        btn.className = cssClass;
        btn.innerHTML = `${badgeHTML}${p.nomor}<span class="pos-label">${p.posisi}</span>`;
        btn.title     = `${p.nama} (#${p.nomor}) — ${p.posisi}`;
        btn.dataset.nomor = p.nomor;

        const sel = team === 'A' ? selectedPlayerA : selectedPlayerB;
        if (sel && sel.nomor === p.nomor) btn.classList.add('selected');

        btn.addEventListener('click', () => selectPlayer(team, p));

        // Make draggable
        btn.draggable = true;

        btn.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({
                nomor: p.nomor,
                team: team,
                state: s
            }));
            e.dataTransfer.effectAllowed = 'move';
            btn.classList.add('dragging');
        });

        btn.addEventListener('dragend', () => {
            btn.classList.remove('dragging');
            document.querySelectorAll('.btn-player').forEach(el => el.classList.remove('drag-over'));
        });

        btn.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            btn.classList.add('drag-over');
        });

        btn.addEventListener('dragleave', () => {
            btn.classList.remove('drag-over');
        });

        btn.addEventListener('drop', (e) => {
            e.preventDefault();
            btn.classList.remove('drag-over');
            try {
                const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
                if (dragData.team !== team) {
                    showToast('Tidak bisa transfer pemain antar tim!', 'error');
                    return;
                }
                const dragNomor = dragData.nomor;
                const targetNomor = p.nomor;
                if (dragNomor === targetNomor) return;

                const teamData = team === 'A' ? matchData.teamA : matchData.teamB;
                const stats = teamData.stats || {};
                if ((stats[dragNomor] && (stats[dragNomor].redCard || stats[dragNomor].blueCard)) || 
                    (stats[targetNomor] && (stats[targetNomor].redCard || stats[targetNomor].blueCard))) {
                    showToast('Pemain yang telah dikeluarkan (Kartu Merah/Biru) tidak bisa disubstitusi!', 'error');
                    return;
                }

                const dataState = team === 'A' ? matchData.teamA.playerState : matchData.teamB.playerState;
                const dragPlayerState = dataState[dragNomor];
                const targetPlayerState = dataState[targetNomor];

                if (dragPlayerState !== targetPlayerState) {
                    // Swap players
                    dataState[dragNomor] = targetPlayerState;
                    dataState[targetNomor] = dragPlayerState;

                    const dragP = teamData.players.find(pl => pl.nomor === dragNomor);
                    const targetP = teamData.players.find(pl => pl.nomor === targetNomor);

                    let outP, inP;
                    if (dragPlayerState === 'court') {
                        outP = dragP;
                        inP = targetP;
                    } else {
                        outP = targetP;
                        inP = dragP;
                    }

                    addEvent({
                        type: 'SUB',
                        team: team,
                        teamName: teamData.name,
                        subOut: outP,
                        subIn: inP,
                        time: getFormattedTime(),
                        period: matchData.currentPeriod
                    });

                    saveState();
                    renderRoster(team);
                    renderLog();
                    showToast(`⇄ SUB: #${outP.nomor} → #${inP.nomor} (${teamData.name})`, 'success');
                }
            } catch (err) {
                console.error(err);
            }
        });

        if (s === 'court') grid.appendChild(btn);
        else bench.appendChild(btn);
    });

    // Coach
    const coachBtn = document.createElement('button');
    coachBtn.className = 'btn-player coach';
    coachBtn.innerText = (data.coach || 'COACH').substring(0, 10).toUpperCase();
    coachBtn.title = data.coach || 'Coach';
    grid.appendChild(coachBtn);
}

// ============================================================
// SELECT PLAYER (roster)
// ============================================================
function selectPlayer(team, player) {
    const data = team === 'A' ? matchData.teamA : matchData.teamB;
    const stats = data.stats || {};
    const st = stats[player.nomor] || {};
    
    if (st.redCard || st.blueCard) {
        showToast(`Pemain #${player.nomor} ${player.nama} telah dikeluarkan dari pertandingan (Kartu Merah/Biru)!`, 'error');
        return;
    }

    if (team === 'A') {
        selectedPlayerA = (selectedPlayerA && selectedPlayerA.nomor === player.nomor) ? null : player;
    } else {
        selectedPlayerB = (selectedPlayerB && selectedPlayerB.nomor === player.nomor) ? null : player;
    }
    const infoEl  = document.getElementById('selected-info-' + team);
    const sel     = team === 'A' ? selectedPlayerA : selectedPlayerB;
    infoEl.innerText = sel ? `#${sel.nomor} ${sel.nama}` : 'Pilih pemain';
    renderRoster(team);
}

// ============================================================
// TIMER
// ============================================================
function updateTimerDisplay() {
    const el = document.getElementById('match-timer');
    const t  = matchData.timeLeft;
    const m  = Math.floor(t / 60).toString().padStart(2, '0');
    const s  = (t % 60).toString().padStart(2, '0');
    el.innerText  = `${m}:${s}`;
    el.className  = 'timer-display ' + (isRunning ? 'running' : 'stopped');
}
function toggleTimer() {
    const btn = document.getElementById('timer-btn');
    if (isRunning) {
        clearInterval(timerInterval);
        btn.innerText   = 'START';
        btn.className   = 'btn-timer-toggle start';
        isRunning = false;
    } else {
        timerInterval = setInterval(() => {
            if (matchData.timeLeft > 0) {
                matchData.timeLeft--;
                updateTimerDisplay();
                saveState();
                if (matchData.timeLeft === 120) showToast('⏱ 2 menit tersisa!', 'warning');
                if (matchData.timeLeft === 30)  showToast('⏱ 30 detik tersisa!', 'warning');
            } else {
                clearInterval(timerInterval);
                isRunning = false;
                btn.innerText = 'START';
                btn.className = 'btn-timer-toggle start';
                updateTimerDisplay();
                showToast('⏱ Waktu habis! Babak ' + matchData.currentPeriod + ' selesai.', 'warning');
            }
        }, 1000);
        btn.innerText = 'STOP';
        btn.className = 'btn-timer-toggle stop';
        isRunning = true;
    }
    updateTimerDisplay();
}
function adjustTimer(delta) {
    matchData.timeLeft = Math.max(0, matchData.timeLeft + delta);
    updateTimerDisplay();
    saveState();
}

// ============================================================
// PERIOD
// ============================================================
function confirmNextPeriod() {
    if (!confirm(`Akhiri Babak ${matchData.currentPeriod}?`)) return;
    endPeriod();
}
function endPeriod() {
    clearInterval(timerInterval);
    isRunning = false;
    const btn = document.getElementById('timer-btn');
    btn.innerText = 'START';
    btn.className = 'btn-timer-toggle start';
    addEvent({ type: 'PERIOD_END', period: matchData.currentPeriod, time: getFormattedTime() });

    document.getElementById('period-overlay-title').innerText  = 'BABAK ' + matchData.currentPeriod;
    document.getElementById('period-overlay-sub').innerText    = 'AKHIR BABAK';
    document.getElementById('period-overlay-score').innerText  = `${matchData.scoreA}  –  ${matchData.scoreB}`;
    document.getElementById('period-overlay').classList.add('show');
}
function startNextPeriod() {
    const maxPeriods = matchData.info.periods || 2;
    if (matchData.currentPeriod >= maxPeriods) { endMatch(); return; }
    matchData.currentPeriod++;
    matchData.timeLeft  = (matchData.info.duration || 30) * 60;
    timeoutsA = timeoutsB = 3;
    matchData.timeoutsA = matchData.timeoutsB = 3;
// Swap teams for side change
const _tempTeam = matchData.teamA;
matchData.teamA = matchData.teamB;
matchData.teamB = _tempTeam;

// Swap scores
const _tempScore = matchData.scoreA;
matchData.scoreA = matchData.scoreB;
matchData.scoreB = _tempScore;

// Swap timeout counters
const _tempTimeouts = timeoutsA;
timeoutsA = timeoutsB;
timeoutsB = _tempTimeouts;
    document.getElementById('period-overlay').classList.remove('show');
    addEvent({ type: 'PERIOD_START', period: matchData.currentPeriod, time: getFormattedTime() });
    saveState();
    renderAll();
    updateTimerDisplay();
    updateTimeoutDisplay();
    renderLog();
    showToast('Babak ' + matchData.currentPeriod + ' dimulai!', 'success');
}
function endMatch() {
    clearInterval(timerInterval);
    document.getElementById('period-overlay').classList.remove('show');
    const winner = matchData.scoreA > matchData.scoreB ? matchData.teamA.name :
                   matchData.scoreB > matchData.scoreA ? matchData.teamB.name : 'SERI';
    const msg = winner === 'SERI'
        ? `Pertandingan selesai! Hasil SERI ${matchData.scoreA} – ${matchData.scoreB}`
        : `Pertandingan selesai!\n🏆 ${winner.toUpperCase()} MENANG\n${matchData.scoreA} – ${matchData.scoreB}`;
    alert(msg);
    addEvent({ type: 'MATCH_END', time: getFormattedTime(), scoreA: matchData.scoreA, scoreB: matchData.scoreB });
    saveState();
}

// ============================================================
// RECORD — entry point dari tombol aksi
// ============================================================
function record(team, type) {
    // Zona tembakan wajib dipilih sebelum menekan tombol GOAL, MISS, atau FOUL.
    if ((type === 'GOAL' || type === 'MISS' || type === 'FOUL') && !selectedCourtZone) {
        showToast('Pilih zona tembakan di lapangan dulu!', 'warning');
        const court = document.getElementById('handball-court');
        if (court) {
            court.classList.remove('highlight-required');
            // Trigger reflow to restart animation
            void court.offsetWidth;
            court.classList.add('highlight-required');
            setTimeout(() => court.classList.remove('highlight-required'), 1200);
        }
        return;
    }

    const data         = team === 'A' ? matchData.teamA : matchData.teamB;
    const players      = data.players || [];
    const state        = data.playerState || {};
    // Poin 2: hanya on-court
    const courtPlayers = players.filter(p => (state[p.nomor] || 'bench') === 'court');

    pendingAction = { team, type, player: null, subtype: null };

    // Poin 3: Popup step 1 — pilih pemain
    openStep1(team, type, courtPlayers);
}

// ============================================================
// STEP 1: POPUP PILIH PEMAIN
// ============================================================
function openStep1(team, type, courtPlayers) {
    const teamName = team === 'A' ? matchData.teamA.name : matchData.teamB.name;
    const icons    = { GOAL:'⚽', MISS:'✕', SAVE:'🧤', FOUL:'⚠' };

    document.getElementById('s1-icon').innerText  = icons[type] || '●';
    document.getElementById('s1-type').innerText  = type;
    document.getElementById('s1-team').innerText  = teamName.toUpperCase();
    document.getElementById('s1-count').innerText = courtPlayers.length + ' pemain on-court';

    // Dynamic Step Badge
    const badgeText = (type === 'GOAL' || type === 'MISS') ? '1/4' : '1/2';
    document.getElementById('s1-badge').innerText = badgeText;

    const grid = document.getElementById('s1-player-grid');
    grid.innerHTML = '';

    // Opsi "TIM" (tanpa pemain spesifik)
    const teamBtn   = document.createElement('button');
    teamBtn.className = 's1-player-btn';
    teamBtn.innerHTML = '<span class="s1-num">👕</span><span class="s1-pos">TIM</span>';
    teamBtn.title   = 'Tanpa pemain spesifik';
    teamBtn.onclick = () => { pendingAction.player = null; goToStep2(); };
    grid.appendChild(teamBtn);

    // Pemain on-court
    courtPlayers.forEach(p => {
        const btn = document.createElement('button');
        btn.className = 's1-player-btn';
        btn.innerHTML = `<span class="s1-num">${p.nomor}</span><span class="s1-pos">${p.posisi}</span><span class="s1-name">${p.nama}</span>`;
        btn.title = `#${p.nomor} ${p.nama} — ${p.posisi}`;
        btn.onclick = () => { pendingAction.player = p; goToStep2(); };
        grid.appendChild(btn);
    });

    document.getElementById('modal-step1').classList.add('show');
}

function closeStep1() {
    document.getElementById('modal-step1').classList.remove('show');
    pendingAction = null;
}

// ============================================================
// STEP 2: POPUP JENIS AKSI
// ============================================================
function goToStep2() {
    // Tutup step 1
    document.getElementById('modal-step1').classList.remove('show');

    const { team, type, player } = pendingAction;
    const subtypes = SUBTYPES[type] || [];

    // Jika tidak ada subtype, langsung catat
    if (subtypes.length === 0) {
        processAction(team, type, player, null, null, null);
        return;
    }

    // Header step 2
    const icons  = { GOAL:'⚽', MISS:'✕', SAVE:'🧤', FOUL:'⚠' };
    const labels = { GOAL:'Jenis Tembakan', MISS:'Jenis Tembakan', SAVE:'Jenis Aksi', FOUL:'Jenis Pelanggaran' };
    const teamName = team === 'A' ? matchData.teamA.name : matchData.teamB.name;

    document.getElementById('s2-icon').innerText    = icons[type] || '●';
    document.getElementById('s2-type').innerText    = type;
    document.getElementById('s2-player').innerText  = player ? `#${player.nomor} ${player.nama}` : 'TIM ' + teamName;
    document.getElementById('s2-section-label').innerText = labels[type] || 'Pilih Jenis';

    // Dynamic Step Badge
    const badgeText = (type === 'GOAL' || type === 'MISS') ? '2/4' : '2/2';
    document.getElementById('s2-badge').innerText = badgeText;

    const grid = document.getElementById('s2-subtype-grid');
    grid.innerHTML = '';

    subtypes.forEach(sub => {
        const foulCss = FOUL_CSS[sub] || '';
        const icon    = FOUL_ICONS[sub] ? FOUL_ICONS[sub] + ' ' : '';
        const btn     = document.createElement('button');
        btn.className    = `s2-subtype-btn ${foulCss || 'type-shot'}`;
        btn.dataset.sub  = sub;
        btn.innerHTML    = `${icon}${sub}`;
        btn.onclick = () => {
            pendingAction.subtype = sub;
            document.getElementById('modal-step2').classList.remove('show');
            // GOAL & MISS → lanjut ke step 2.5 (tipe serangan)
            if (type === 'GOAL' || type === 'MISS') {
                openStep25();
            } else {
                processAction(team, type, player, sub, null, null);
            }
        };
        grid.appendChild(btn);
    });

    document.getElementById('modal-step2').classList.add('show');
}

function backToStep1() {
    const { team, type } = pendingAction;
    const data         = team === 'A' ? matchData.teamA : matchData.teamB;
    const players      = data.players || [];
    const state        = data.playerState || {};
    const courtPlayers = players.filter(p => (state[p.nomor] || 'bench') === 'court');
    document.getElementById('modal-step2').classList.remove('show');
    openStep1(team, type, courtPlayers);
}

function closeStep2() {
    document.getElementById('modal-step2').classList.remove('show');
    pendingAction = null;
}

// ============================================================
// STEP 2.5: POPUP TIPE SERANGAN (GOAL & MISS saja)
// ============================================================
function openStep25() {
    const { team, type, player, subtype } = pendingAction;
    const icons = { GOAL:'⚽', MISS:'✕' };
    const teamName = team === 'A' ? matchData.teamA.name : matchData.teamB.name;

    document.getElementById('s25-icon').innerText  = icons[type] || '●';
    document.getElementById('s25-type').innerText  = type;
    document.getElementById('s25-info').innerText  = 
        (player ? `#${player.nomor} ${player.nama}` : 'TIM ' + teamName) + ' · ' + (subtype || '');
    document.getElementById('s25-badge').innerText = '3/4';

    document.getElementById('modal-step25').classList.add('show');
}

function selectAttackType(attackType) {
    pendingAction.attackType = attackType;
    document.getElementById('modal-step25').classList.remove('show');
    openStep3();
}

function closeStep25() {
    document.getElementById('modal-step25').classList.remove('show');
    pendingAction = null;
}

function backToStep2() {
    document.getElementById('modal-step25').classList.remove('show');
    goToStep2();
}

function backToStep25() {
    document.getElementById('modal-step3').classList.remove('show');
    openStep25();
}

// ============================================================
// STEP 3: ZONA GAWANG (GOAL & MISS saja)
// ============================================================
const GOAL_ZONES = [
    'Atas Kiri',    'Atas Tengah',    'Atas Kanan',
    'Tengah Kiri',  'Tengah',         'Tengah Kanan',
    'Bawah Kiri',   'Bawah Tengah',   'Bawah Kanan',
    'Luar Kiri',    'Luar Kanan',     'Luar Atas',    'Tiang/Mistar'
];

function openStep3() {
    const { team, type, player, subtype, attackType } = pendingAction;
    const icons = { GOAL:'⚽', MISS:'✕' };
    const teamName = team === 'A' ? matchData.teamA.name : matchData.teamB.name;

    document.getElementById('s3-icon').innerText   = icons[type] || '●';
    document.getElementById('s3-type').innerText   = type;
    document.getElementById('s3-info').innerText   =
        (player ? `#${player.nomor} ${player.nama}` : 'TIM ' + teamName) + 
        ' · ' + (subtype || '') + ' (' + (attackType || '') + ')';
    
    document.getElementById('s3-badge').innerText = '4/4';

    // Reset zone highlight
    document.querySelectorAll('.goal-zone-btn').forEach(b => b.classList.remove('selected'));

    document.getElementById('modal-step3').classList.add('show');
}

function selectGoalZone(btn) {
    const zone = btn.dataset.zone;
    const { team, type, player, subtype, attackType } = pendingAction;

    // Validasi: GOAL tidak boleh di luar gawang / kena tiang
    const isOuter = zone === 'Tiang/Mistar' || zone.startsWith('Luar');
    if (type === 'GOAL' && isOuter) {
        showToast('Gol tidak bisa dicatat di luar gawang atau kena tiang!', 'error');
        return;
    }

    document.querySelectorAll('.goal-zone-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    // Rekam setelah 150ms untuk terlihat feedback klik-nya
    setTimeout(() => {
        document.getElementById('modal-step3').classList.remove('show');
        processAction(team, type, player, subtype, attackType, zone);
    }, 150);
}

function skipZone() {
    const { team, type, player, subtype, attackType } = pendingAction;
    document.getElementById('modal-step3').classList.remove('show');
    processAction(team, type, player, subtype, attackType, null);
}

function closeStep3() {
    document.getElementById('modal-step3').classList.remove('show');
    pendingAction = null;
}

// Legacy stubs
function openActionModal() {}
function closeActionModal() { closeStep1(); closeStep2(); closeStep3(); }
function confirmAction() {}

// ============================================================
// PROSES AKSI
// ============================================================
function processAction(team, type, player, subtype, attackType, zone) {
    const data     = team === 'A' ? matchData.teamA : matchData.teamB;
    const teamName = data.name;
    const timeNow  = getFormattedTime();
    let opponentGKNumber = null;

    // Update skor & Toast feedback
    if (type === 'GOAL') {
        if (team === 'A') { matchData.scoreA++; document.getElementById('score-home').innerText = matchData.scoreA; }
        else              { matchData.scoreB++; document.getElementById('score-away').innerText = matchData.scoreB; }
        const atStr = attackType ? ` · ⚡${attackType}` : '';
        const zoneStr = zone ? ` · 📍${zone}` : '';
        showToast(`⚽ GOAL! ${teamName.toUpperCase()} — ${subtype||''}${atStr}${zoneStr}`, 'success');
    }
    if (type === 'MISS') {
        const atStr = attackType ? ` · ⚡${attackType}` : '';
        const zoneStr = zone ? ` · 📍${zone}` : '';
        showToast(`✕ MISS! ${teamName.toUpperCase()} — ${subtype||''}${atStr}${zoneStr}`, 'warning');
    }
    if (type === 'SAVE') {
        showToast(`🧤 SAVE! ${teamName.toUpperCase()} — ${subtype||''}`, 'success');
    }

    // Statistik pemain individual
    if (player) {
        if (!data.stats) data.stats = {};
        if (!data.stats[player.nomor])
            data.stats[player.nomor] = { goals:0, misses:0, saves:0, fouls:0, yellowCards:0, twoMins:0, redCard:false, blueCard:false };

        const st = data.stats[player.nomor];
        if (type === 'GOAL') st.goals++;
        if (type === 'MISS') {
            st.misses++;
            // Hitung save otomatis untuk GK lawan jika miss diarahkan ke dalam gawang
            const INNER_GOAL_ZONES = [
                'Atas Kiri', 'Atas Tengah', 'Atas Kanan',
                'Tengah Kiri', 'Tengah', 'Tengah Kanan',
                'Bawah Kiri', 'Bawah Tengah', 'Bawah Kanan'
            ];
            if (zone && INNER_GOAL_ZONES.includes(zone)) {
                const oppTeamChar = team === 'A' ? 'B' : 'A';
                const oppData = oppTeamChar === 'A' ? matchData.teamA : matchData.teamB;
                const oppPlayers = oppData.players || [];
                const oppState = oppData.playerState || {};
                const activeGK = oppPlayers.find(p => p.posisi === 'GK' && oppState[p.nomor] === 'court');

                if (activeGK) {
                    opponentGKNumber = activeGK.nomor;
                    if (!oppData.stats) oppData.stats = {};
                    if (!oppData.stats[opponentGKNumber]) {
                        oppData.stats[opponentGKNumber] = { goals:0, misses:0, saves:0, fouls:0, yellowCards:0, twoMins:0, redCard:false, blueCard:false };
                    }
                    oppData.stats[opponentGKNumber].saves++;
                    setTimeout(() => {
                        showToast(`🧤 Save Otomatis GK #${activeGK.nomor} ${activeGK.nama} (Tim ${oppData.name.toUpperCase()})!`, 'success');
                    }, 500);
                }
            }
        }
        if (type === 'SAVE') st.saves++;
        if (type === 'FOUL') {
            st.fouls++;
            let finalSubtype = subtype;

            // 1. Eskalasi Kartu Kuning jika total kartu kuning tim sudah mencapai 2
            if (finalSubtype === 'Kartu Kuning') {
                let totalYellowCards = 0;
                for (const pNomor in data.stats) {
                    totalYellowCards += (data.stats[pNomor].yellowCards || 0);
                }
                if (totalYellowCards >= 2) {
                    finalSubtype = '2 Menit';
                    showToast(`⚠️ Kartu Kuning tim sudah mencapai limit (2). Otomatis eskalasi ke 2 Menit!`, 'warning');
                }
            }

            // 2. Eskalasi 2 Menit jika individu sudah 2x suspend
            if (finalSubtype === '2 Menit') {
                if ((st.twoMins || 0) >= 2) {
                    finalSubtype = 'Kartu Merah';
                    showToast(`⚠️ #${player.nomor} ${player.nama} sudah 2x suspend. Otomatis eskalasi ke Kartu Merah!`, 'error');
                }
            }

            // 3. Proses efek berdasarkan subtype yang sudah dieskalasi
            if (finalSubtype === 'Kartu Kuning') {
                st.yellowCards++;
                showToast(`🟨 Kartu Kuning: #${player.nomor} ${player.nama}`, 'warning');
            } else if (finalSubtype === '2 Menit') {
                st.twoMins++;
                showToast(`⏱ 2 Menit: #${player.nomor} ${player.nama}`, 'warning');
            } else if (finalSubtype === 'Kartu Merah') {
                st.redCard = true;
                showToast(`🟥 Kartu Merah: #${player.nomor} ${player.nama} — DIKELUARKAN`, 'error');
            } else if (finalSubtype === 'Kartu Biru') {
                st.blueCard = true;
                showToast(`🔵 Kartu Biru: #${player.nomor} ${player.nama} — DISKUALIFIKASI`, 'error');
            }

            // Update subtype agar log mencatat sanksi akhir yang telah dieskalasi
            subtype = finalSubtype;
        }
    }

    // Tambah ke log (dengan zone)
    addEvent({
        type, team, teamName,
        player:  player  ? { nomor: player.nomor, nama: player.nama } : null,
        subtype: subtype || null,
        attackType: attackType || null,
        zone:    zone    || null,
        courtZone: selectedCourtZone,
        time:    timeNow,
        period:  matchData.currentPeriod
    });

    // Reset pemain terpilih di roster
    if (team === 'A') selectedPlayerA = null;
    else selectedPlayerB = null;
    document.getElementById('selected-info-' + team).innerText = 'Pilih pemain';

    saveState();
    renderRoster(team);
    renderLog();
    updateStats();
    resetCourtZone();
}

// ============================================================
// QUICK GOAL (klik skor)
// ============================================================
function quickGoal(team) {
    const name = team === 'A' ? matchData.teamA.name : matchData.teamB.name;
    if (!confirm(`Catat GOAL untuk ${name}? (Quick — tanpa detail pemain/jenis)`)) return;
    // Proses langsung tanpa modal
    const timeNow = getFormattedTime();
    if (team === 'A') { matchData.scoreA++; document.getElementById('score-home').innerText = matchData.scoreA; }
    else              { matchData.scoreB++; document.getElementById('score-away').innerText = matchData.scoreB; }
    addEvent({ type:'GOAL', team, teamName: name, player: null, subtype: 'Quick Goal', attackType: null, time: timeNow, period: matchData.currentPeriod });
    saveState();
    renderLog();
    updateStats();
    showToast(`⚽ GOAL! ${name.toUpperCase()} (Quick)`, 'success');
}

// ============================================================
// TIMEOUT
// ============================================================
function callTimeout(team) {
    const remaining = team === 'A' ? timeoutsA : timeoutsB;
    const teamName  = team === 'A' ? matchData.teamA.name : matchData.teamB.name;
    if (remaining <= 0) { showToast('Timeout habis!', 'error'); return; }
    if (!confirm(`TIME OUT untuk ${teamName}? (Sisa: ${remaining})`)) return;

    if (team === 'A') { timeoutsA--; matchData.timeoutsA = timeoutsA; }
    else              { timeoutsB--; matchData.timeoutsB = timeoutsB; }

    addEvent({ type: 'TIMEOUT', team, teamName, time: getFormattedTime(), period: matchData.currentPeriod });
    updateTimeoutDisplay();
    saveState();
    renderLog();
    showToast(`⏸ TIME OUT — ${teamName} (sisa: ${team==='A'?timeoutsA:timeoutsB})`, 'warning');
}
function updateTimeoutDisplay() {
    const dot = '●'; const empty = '○';
    document.getElementById('timeout-home').innerText = 'TO: ' + dot.repeat(timeoutsA) + empty.repeat(Math.max(0,3-timeoutsA));
    document.getElementById('timeout-away').innerText = 'TO: ' + dot.repeat(timeoutsB) + empty.repeat(Math.max(0,3-timeoutsB));
}

// ============================================================
// SUBSTITUSI
// ============================================================
function openSubModal(team) {
    subTeam = team;
    const data    = team === 'A' ? matchData.teamA : matchData.teamB;
    const state   = data.playerState || {};
    const players = data.players || [];

    const stats   = data.stats || {};
    const court = players.filter(p => (state[p.nomor]||'court') === 'court' && !(stats[p.nomor]?.redCard || stats[p.nomor]?.blueCard));
    const bench = players.filter(p => (state[p.nomor]||'court') === 'bench' && !(stats[p.nomor]?.redCard || stats[p.nomor]?.blueCard));
    if (!court.length) { showToast('Tidak ada pemain aktif di lapangan', 'error'); return; }
    if (!bench.length) { showToast('Tidak ada pemain aktif di bangku cadangan', 'error'); return; }

    const outSel = document.getElementById('sub-out-select');
    const inSel  = document.getElementById('sub-in-select');
    outSel.innerHTML = court.map(p => `<option value="${p.nomor}">#${p.nomor} ${p.nama} (${p.posisi})</option>`).join('');
    inSel.innerHTML  = bench.map(p => `<option value="${p.nomor}">#${p.nomor} ${p.nama} (${p.posisi})</option>`).join('');

    document.getElementById('modal-sub-title').innerText = 'Substitusi — ' + data.name;
    document.getElementById('modal-sub').classList.add('show');
}
function closeSubModal() {
    document.getElementById('modal-sub').classList.remove('show');
    subTeam = null;
}
function confirmSubstitution() {
    if (!subTeam) return;
    const outNo = document.getElementById('sub-out-select').value;
    const inNo  = document.getElementById('sub-in-select').value;
    const data  = subTeam === 'A' ? matchData.teamA : matchData.teamB;

    data.playerState[outNo] = 'bench';
    data.playerState[inNo]  = 'court';

    const outP = data.players.find(p => p.nomor === outNo);
    const inP  = data.players.find(p => p.nomor === inNo);

    addEvent({ type:'SUB', team:subTeam, teamName:data.name, subOut:outP, subIn:inP, time:getFormattedTime(), period:matchData.currentPeriod });
    closeSubModal();
    saveState();
    renderRoster(subTeam);
    renderLog();
    showToast(`⇄ SUB: #${outNo} → #${inNo} (${data.name})`, 'success');
}



// ============================================================
// EVENT LOG
// ============================================================
function addEvent(event) {
    matchData.events.unshift(event);
}

const EVENT_ICONS = {
    GOAL:'⚽', MISS:'✕', SAVE:'🧤', FOUL:'⚠',
    TIMEOUT:'⏸', SUB:'⇄',
    PERIOD_START:'▶', PERIOD_END:'⏹', MATCH_END:'🏁'
};

// Log CSS class berdasarkan type + subtype
function getLogClass(ev) {
    if (ev.type === 'GOAL')   return 'log-goal';
    if (ev.type === 'MISS')   return 'log-miss';
    if (ev.type === 'SAVE')   return '';
    if (ev.type === 'FOUL') {
        if (ev.subtype === 'Kartu Kuning') return 'log-card';
        if (ev.subtype === 'Kartu Merah')  return 'log-red-card';
        if (ev.subtype === 'Kartu Biru')   return 'log-blue-card';
        if (ev.subtype === '2 Menit')      return 'log-twomin';
        return 'log-foul';
    }
    if (ev.type === 'TIMEOUT') return 'log-timeout';
    if (ev.type === 'PERIOD_START' || ev.type === 'PERIOD_END' || ev.type === 'MATCH_END') return 'log-period';
    return '';
}

function renderLog() {
    const ul     = document.getElementById('event-log');
    const events = matchData.events;
    ul.innerHTML = '';

    events.forEach((ev, idx) => {
        // Filter
        if (activeFilter !== 'all') {
            if (activeFilter === 'GOAL' && ev.type !== 'GOAL') return;
            if (activeFilter === 'FOUL' && ev.type !== 'FOUL') return;
            if (activeFilter === 'CARD' &&
                !(ev.type === 'FOUL' && ['Kartu Kuning','2 Menit','Kartu Merah','Kartu Biru'].includes(ev.subtype))) return;
        }

        const li   = document.createElement('li');
        li.className = getLogClass(ev);
        const icon = EVENT_ICONS[ev.type] || '•';

        if (ev.type === 'PERIOD_START' || ev.type === 'PERIOD_END' || ev.type === 'MATCH_END') {
            const label = ev.type === 'MATCH_END' ? 'PERTANDINGAN SELESAI' :
                          ev.type === 'PERIOD_END' ? 'AKHIR BABAK' : 'MULAI BABAK';
            li.innerHTML = `<span class="log-action">${icon} ${label} ${ev.period||''}</span>`;
        } else if (ev.type === 'SUB') {
            li.innerHTML = `<span class="log-action">${icon} SUB</span> <span class="log-team">${ev.teamName}</span>
                <br><span class="log-time">B${ev.period} · ${ev.time} · #${ev.subOut?.nomor} → #${ev.subIn?.nomor}</span>`;
        } else {
            const playerStr  = ev.player  ? ` <strong>#${ev.player.nomor}</strong> ${ev.player.nama}` : '';
            const subtypeStr = ev.subtype ? ` · <em>${ev.subtype}</em>` : '';
            const attackTypeStr = ev.attackType ? ` · <span class="log-attack-type">⚡ ${ev.attackType}</span>` : '';
            const zoneStr    = ev.zone    ? ` · <span class="log-zone">📍${ev.zone}</span>` : '';
            const courtZoneStr = ev.courtZone ? ` · <span class="log-court-zone">🏃‍♂️ ${COURT_ZONE_NAMES[ev.courtZone] || ev.courtZone}</span>` : '';
            li.innerHTML = `
                <span class="log-action">${icon} ${ev.type}</span>
                <span class="log-team"> ${ev.teamName||''}</span>${playerStr}${subtypeStr}${attackTypeStr}${courtZoneStr}${zoneStr}
                <br><span class="log-time">Babak ${ev.period} · ${ev.time}</span>`;
        }
        ul.appendChild(li);
    });
}

function filterLog(type, btnEl) {
    activeFilter = type;
    document.querySelectorAll('.log-filter-btn').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
    renderLog();
}

// ============================================================
// STATISTIK RINGKASAN
// ============================================================
function updateStats() {
    const events = matchData.events;
    document.getElementById('stat-goals-A').innerText  = events.filter(e => e.type==='GOAL' && e.team==='A').length;
    document.getElementById('stat-goals-B').innerText  = events.filter(e => e.type==='GOAL' && e.team==='B').length;
    document.getElementById('stat-fouls-A').innerText  = events.filter(e => e.type==='FOUL' && e.team==='A').length;
    document.getElementById('stat-fouls-B').innerText  = events.filter(e => e.type==='FOUL' && e.team==='B').length;
}

// ============================================================
// UNDO
// ============================================================
function openUndoModal() {
    const list   = document.getElementById('modal-undo-list');
    const events = matchData.events.slice(0, 15);
    list.innerHTML = '';

    if (!events.length) {
        list.innerHTML = '<p style="color:#999;text-align:center;padding:20px">Belum ada aksi dicatat.</p>';
    } else {
        events.forEach((ev, idx) => {
            if (ev.type === 'PERIOD_START' || ev.type === 'MATCH_END') return;
            const icon       = EVENT_ICONS[ev.type] || '•';
            const playerStr  = ev.player  ? ` #${ev.player.nomor}` : '';
            const subtypeStr = ev.subtype ? ` · ${ev.subtype}` : '';
            const div = document.createElement('div');
            div.className = 'undo-item';
            div.innerHTML = `
                <span>${icon} <strong>${ev.type}</strong> ${ev.teamName||''}${playerStr}${subtypeStr} · ${ev.time}</span>
                <button class="undo-btn" onclick="undoEvent(${idx})">Hapus</button>`;
            list.appendChild(div);
        });
    }
    document.getElementById('modal-undo').classList.add('show');
}
function closeUndoModal() {
    document.getElementById('modal-undo').classList.remove('show');
}
function undoEvent(idx) {
    const ev = matchData.events[idx];
    if (!ev) return;

    // Batalkan skor
    if (ev.type === 'GOAL') {
        if (ev.team === 'A') { matchData.scoreA = Math.max(0, matchData.scoreA - 1); document.getElementById('score-home').innerText = matchData.scoreA; }
        else                 { matchData.scoreB = Math.max(0, matchData.scoreB - 1); document.getElementById('score-away').innerText = matchData.scoreB; }
    }

    // Batalkan statistik pemain
    if (ev.player) {
        const st = ev.team === 'A' ? matchData.teamA.stats : matchData.teamB.stats;
        if (st && st[ev.player.nomor]) {
            const s = st[ev.player.nomor];
            if (ev.type === 'GOAL' && s.goals   > 0) s.goals--;
            if (ev.type === 'MISS' && s.misses  > 0) {
                s.misses--;
                // Kembalikan save GK lawan yang otomatis dicatat
                const INNER_GOAL_ZONES = [
                    'Atas Kiri','Atas Tengah','Atas Kanan',
                    'Tengah Kiri','Tengah','Tengah Kanan',
                    'Bawah Kiri','Bawah Tengah','Bawah Kanan'
                ];
                if (ev.zone && INNER_GOAL_ZONES.includes(ev.zone)) {
                    const oppData = ev.team === 'A' ? matchData.teamB : matchData.teamA;
                    const oppPlayers = oppData.players || [];
                    const gkAtTime = oppPlayers.find(p => p.posisi === 'GK');
                    if (gkAtTime && oppData.stats && oppData.stats[gkAtTime.nomor]) {
                        const gkSt = oppData.stats[gkAtTime.nomor];
                        if (gkSt.saves > 0) gkSt.saves--;
                    }
                }
            }
            if (ev.type === 'SAVE' && s.saves   > 0) s.saves--;
            if (ev.type === 'FOUL') {
                if (s.fouls > 0) s.fouls--;
                if (ev.subtype === 'Kartu Kuning' && s.yellowCards > 0) s.yellowCards--;
                if (ev.subtype === '2 Menit' && s.twoMins > 0)          s.twoMins--;
                if (ev.subtype === 'Kartu Merah')                        s.redCard  = false;
                if (ev.subtype === 'Kartu Biru')                         s.blueCard = false;
            }
        }
    }

    matchData.events.splice(idx, 1);
    saveState();
    renderAll();
    renderLog();
    updateStats();
    closeUndoModal();
    showToast('Aksi berhasil dibatalkan.', 'success');
}

// ============================================================
// EDIT SKOR MANUAL
// ============================================================
function openScoreEdit() {
    document.getElementById('edit-score-label-A').innerText = matchData.teamA.name;
    document.getElementById('edit-score-label-B').innerText = matchData.teamB.name;
    document.getElementById('edit-score-A').value = matchData.scoreA;
    document.getElementById('edit-score-B').value = matchData.scoreB;
    document.getElementById('modal-score-edit').classList.add('show');
}
function closeScoreEdit() {
    document.getElementById('modal-score-edit').classList.remove('show');
}
function applyScoreEdit() {
    matchData.scoreA = parseInt(document.getElementById('edit-score-A').value) || 0;
    matchData.scoreB = parseInt(document.getElementById('edit-score-B').value) || 0;
    document.getElementById('score-home').innerText = matchData.scoreA;
    document.getElementById('score-away').innerText = matchData.scoreB;
    saveState();
    closeScoreEdit();
    showToast('Skor diperbarui.', 'success');
}

// ============================================================
// PLAYER PLAYING TIME CALCULATION
// ============================================================
function getPlayingMinutes(teamChar) {
    const md = matchData;
    const team = teamChar === 'A' ? md.teamA : md.teamB;
    const teamName = team?.name;
    const players = team?.players || [];
    const stats = team?.stats || {};
    const playerState = team?.playerState || {};
    const duration = md.info?.duration || 30; // duration per period in minutes
    const events = md.events || [];

    // Initialize playing time in seconds
    const playingSeconds = {};
    players.forEach(p => {
        playingSeconds[p.nomor] = 0;
    });

    // Determine state at the end of the match
    const states = {};
    players.forEach(p => {
        const st = stats[p.nomor] || {};
        const isSuspended = st.redCard || st.blueCard;
        states[p.nomor] = isSuspended ? 'bench' : (playerState[p.nomor] || 'bench');
    });

    // Convert time string to seconds remaining
    function timeToSec(timeStr) {
        if (!timeStr) return 0;
        const parts = timeStr.split(':');
        if (parts.length !== 2) return 0;
        return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }

    // Build checkpoints in reverse chronological order
    const checkpoints = [];

    // 1. Current state of the timer if the match is still running
    const hasMatchEnd = events.some(e => e.type === 'MATCH_END');
    if (!hasMatchEnd) {
        checkpoints.push({
            period: md.currentPeriod || 1,
            seconds: md.timeLeft != null ? md.timeLeft : duration * 60,
            type: 'CURRENT_TIME'
        });
    }

    // 2. Add checkpoints from events
    events.forEach(ev => {
        if (ev.type === 'PERIOD_START' || ev.type === 'PERIOD_END' || ev.type === 'MATCH_END') {
            checkpoints.push({
                period: ev.period || 1,
                seconds: timeToSec(ev.time),
                type: ev.type
            });
        } else if (ev.type === 'SUB' && ev.teamName === teamName) {
            checkpoints.push({
                period: ev.period || 1,
                seconds: timeToSec(ev.time),
                type: 'SUB',
                event: ev
            });
        } else if (ev.type === 'FOUL' && ev.teamName === teamName && (ev.subtype === 'Kartu Merah' || ev.subtype === 'Kartu Biru')) {
            checkpoints.push({
                period: ev.period || 1,
                seconds: timeToSec(ev.time),
                type: 'CARD',
                event: ev
            });
        } else if (ev.type === 'FOUL' && ev.teamName === teamName && ev.subtype === '2 Menit') {
            const T_susp = timeToSec(ev.time);
            checkpoints.push({
                period: ev.period || 1,
                seconds: T_susp,
                type: 'SUSPEND_START',
                event: ev
            });
            checkpoints.push({
                period: ev.period || 1,
                seconds: Math.max(0, T_susp - 120),
                type: 'SUSPEND_END',
                event: ev
            });
        }
    });

    // Sort checkpoints: newest to oldest
    // Higher period first; within same period, smaller remaining seconds first
    checkpoints.sort((a, b) => {
        if (a.period !== b.period) {
            return b.period - a.period;
        }
        return a.seconds - b.seconds;
    });

    // Backwards pass
    let currentPeriod = null;
    let currentSeconds = null;

    checkpoints.forEach(cp => {
        if (currentPeriod === null) {
            currentPeriod = cp.period;
            currentSeconds = cp.seconds;
            return;
        }

        if (cp.period !== currentPeriod) {
            // Close the current period (add remaining time to start of period)
            const interval = (duration * 60) - currentSeconds;
            if (interval > 0) {
                players.forEach(p => {
                    if (states[p.nomor] === 'court') {
                        playingSeconds[p.nomor] += interval;
                    }
                });
            }
            // Transition to new period
            currentPeriod = cp.period;
            currentSeconds = cp.seconds;
        } else {
            // Same period, different time checkpoint
            const interval = cp.seconds - currentSeconds;
            if (interval > 0) {
                players.forEach(p => {
                    if (states[p.nomor] === 'court') {
                        playingSeconds[p.nomor] += interval;
                    }
                });
            }
            currentSeconds = cp.seconds;
        }

        // Process state updates for this checkpoint (going backwards in time)
        if (cp.type === 'SUB' && cp.event) {
            if (cp.event.subOut) {
                states[cp.event.subOut.nomor] = 'court';
            }
            if (cp.event.subIn) {
                states[cp.event.subIn.nomor] = 'bench';
            }
        } else if (cp.type === 'CARD' && cp.event && cp.event.player) {
            states[cp.event.player.nomor] = 'court';
        } else if (cp.type === 'SUSPEND_START' && cp.event && cp.event.player) {
            states[cp.event.player.nomor] = 'court';
        } else if (cp.type === 'SUSPEND_END' && cp.event && cp.event.player) {
            states[cp.event.player.nomor] = 'bench';
        }
    });

    // Close the final period (oldest period, down to start of that period)
    if (currentPeriod !== null && currentSeconds !== null) {
        const interval = (duration * 60) - currentSeconds;
        if (interval > 0) {
            players.forEach(p => {
                if (states[p.nomor] === 'court') {
                    playingSeconds[p.nomor] += interval;
                }
            });
        }
    }

    // Convert seconds to formatted minutes and seconds (e.g. 23' 15" or 0')
    const playingMinutes = {};
    players.forEach(p => {
        const totalSecs = playingSeconds[p.nomor] || 0;
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        playingMinutes[p.nomor] = totalSecs > 0 ? `${mins}' ${secs.toString().padStart(2, '0')}"` : "0'";
    });

    return playingMinutes;
}

// ============================================================
// EXPORT REPORT
// ============================================================
function exportReport() {
    if (!matchData) return;
    const { teamA, teamB, info, scoreA, scoreB, events } = matchData;
    let txt = '======================================\n';
    txt += '       MATCH REPORT — AWIM v2.1\n';
    txt += '======================================\n';
    txt += `Kompetisi  : ${info.competition||'-'}\n`;
    txt += `Tanggal    : ${info.date||'-'}\n`;
    txt += `Venue      : ${info.venue||'-'}\n`;
    txt += `Wasit      : ${info.referee||'-'}\n`;
    txt += `Format     : ${info.duration} menit × ${info.periods} babak\n`;
    txt += '--------------------------------------\n';
    txt += `  ${teamA.name.padEnd(12)} ${String(scoreA).padStart(3)}  –  ${String(scoreB).padEnd(3)} ${teamB.name}\n`;
    txt += '--------------------------------------\n\n';

    txt += '=== EVENT LOG ===\n';
    [...events].reverse().forEach(ev => {
        const icon = EVENT_ICONS[ev.type] || '-';
        if (ev.type === 'PERIOD_START') txt += `\n--- MULAI BABAK ${ev.period} ---\n`;
        else if (ev.type === 'PERIOD_END') txt += `--- AKHIR BABAK ${ev.period} ---\n\n`;
        else if (ev.type === 'MATCH_END') txt += `=== SELESAI ===\n`;
        else {
            const p   = ev.player  ? ` #${ev.player.nomor} ${ev.player.nama}` : '';
            const sub = ev.subtype ? ` [${ev.subtype}]` : '';
            const at  = ev.attackType ? ` [Attack: ${ev.attackType}]` : '';
            const cz  = ev.courtZone ? ` [Court: ${COURT_ZONE_NAMES[ev.courtZone] || ev.courtZone}]` : '';
            const gz  = ev.zone ? ` [Goal: ${ev.zone}]` : '';
            txt += `[${ev.time}] B${ev.period} ${icon} ${ev.type.padEnd(4)} ${(ev.teamName||'').padEnd(12)}${p}${sub}${at}${cz}${gz}\n`;
        }
    });

    txt += '\n=== STATISTIK PEMAIN ===\n';
    [teamA, teamB].forEach(tm => {
        const teamChar = tm === teamA ? 'A' : 'B';
        const playingMinutes = getPlayingMinutes(teamChar);

        txt += `\n${tm.name} (Coach: ${tm.coach})\n`;
        txt += 'No  | Nama             | Pos | Main     | Gol | Miss| Save|Foul|K.K|2Min|K.M|K.B\n';
        txt += '---------------------------------------------------------------------------------\n';
        (tm.players||[]).forEach(p => {
            const st = (tm.stats||{})[p.nomor] || {};
            const playTime = playingMinutes[p.nomor] || "0'";
            txt += `${p.nomor.padEnd(3)} | ${p.nama.padEnd(16)} | ${p.posisi.padEnd(3)} | ${playTime.padEnd(8)} | ${String(st.goals||0).padEnd(3)} | ${String(st.misses||0).padEnd(3)} | ${String(st.saves||0).padEnd(3)} | ${String(st.fouls||0).padEnd(2)} | ${String(st.yellowCards||0).padEnd(1)} | ${String(st.twoMins||0).padEnd(2)} | ${st.redCard?'Y':'N'} | ${st.blueCard?'Y':'N'}\n`;
        });
    });

    const blob = new Blob([txt], { type:'text/plain' });
    const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `match_${teamA.name}_vs_${teamB.name}.txt` });
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('📄 Laporan diunduh!', 'success');
}

// ============================================================
// LOG MINIMIZE (Poin 5)
// ============================================================
let logMinimized = false;
function toggleLog() {
    logMinimized = !logMinimized;
    const dashboard = document.querySelector('.main-dashboard');
    const logSection = document.querySelector('.log-section');
    const btn = document.getElementById('log-toggle-btn');

    dashboard.classList.toggle('log-minimized', logMinimized);
    logSection.classList.toggle('minimized', logMinimized);
    btn.innerText = logMinimized ? '＋' : '─';
    btn.title     = logMinimized ? 'Expand Log' : 'Minimize Log';
}

// ============================================================
// NAVIGASI
// ============================================================
function goBack() {
    if (confirm('Kembali ke Setup? Data tersimpan.')) {
        clearInterval(timerInterval);
        saveState();
        window.location.href = 'index.html';
    }
}

// ============================================================
// UTILITY
// ============================================================
function getFormattedTime() {
    const t = matchData.timeLeft;
    return Math.floor(t/60).toString().padStart(2,'0') + ':' + (t%60).toString().padStart(2,'0');
}
function saveState() {
    localStorage.setItem('matchData', JSON.stringify(matchData));
}
function showToast(message, type='') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 3200);
}

// Keyboard
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('show'));
    }
    if (e.key === ' ' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        toggleTimer();
    }
});

// ============================================================
// COURT SVG RENDERING & INTERACTION
// ============================================================
function renderCourtSVG() {
    const container = document.getElementById('handball-court');
    if (!container) return;

    const svgHTML = `
    <svg id="court-svg" viewBox="0 0 880 440" xmlns="http://www.w3.org/2000/svg">
        <!-- Latar Belakang Lapangan -->
        <rect width="880" height="440" fill="#1a5276" />
        <rect x="40" y="20" width="800" height="400" fill="#1f618d" stroke="white" stroke-width="3" />

        <!-- Garis Tengah -->
        <line x1="440" y1="20" x2="440" y2="420" stroke="white" stroke-width="3" />
        <circle cx="440" cy="220" r="60" fill="none" stroke="white" stroke-width="3" />

        <!-- Area Gawang (6m) Fill Warna Kuning/Oranye Transparan -->
        <path d="M 40,70 A 120,120 0 0,1 160,190 L 160,250 A 120,120 0 0,1 40,370 Z" fill="rgba(241, 196, 15, 0.2)" />
        <path d="M 840,70 A 120,120 0 0,0 720,190 L 720,250 A 120,120 0 0,0 840,370 Z" fill="rgba(241, 196, 15, 0.2)" />

        <!-- Garis Area Kiper (6m Solid) -->
        <path d="M 40,70 A 120,120 0 0,1 160,190 L 160,250 A 120,120 0 0,1 40,370" fill="none" stroke="white" stroke-width="3" />
        <path d="M 840,70 A 120,120 0 0,0 720,190 L 720,250 A 120,120 0 0,0 840,370" fill="none" stroke="white" stroke-width="3" />

        <!-- Garis Free Throw (9m Titik-titik) -->
        <path d="M 40,10 A 180,180 0 0,1 220,190 L 220,250 A 180,180 0 0,1 40,430" fill="none" stroke="white" stroke-width="2.5" stroke-dasharray="8,6" />
        <path d="M 840,10 A 180,180 0 0,0 660,190 L 660,250 A 180,180 0 0,0 840,430" fill="none" stroke="white" stroke-width="2.5" stroke-dasharray="8,6" />

        <!-- Gawang Kiri -->
        <rect x="25" y="190" width="15" height="60" fill="none" stroke="white" stroke-width="3" />
        <path d="M 40,190 L 25,190 L 25,250 L 40,250" fill="none" stroke="#e74c3c" stroke-width="4" stroke-dasharray="10,5" />

        <!-- Gawang Kanan -->
        <rect x="840" y="190" width="15" height="60" fill="none" stroke="white" stroke-width="3" />
        <path d="M 840,190 L 855,190 L 855,250 L 840,250" fill="none" stroke="#e74c3c" stroke-width="4" stroke-dasharray="10,5" />

        <!-- ZONA KLIK INTERAKTIF (20 ZONA) -->
        <!-- LEFT SIDE ZONES (L1 - L10) -->
        <path class="court-zone-btn inner" id="zone-L1" data-id="L1" d="M 40,20 L 99.2,20 A 180,180 0 0,1 155.9,100 L 40,100 Z" onclick="selectCourtZone('L1')" />
        <path class="court-zone-btn inner" id="zone-L2" data-id="L2" d="M 40,100 L 155.9,100 A 180,180 0 0,1 219.7,180 L 40,180 Z" onclick="selectCourtZone('L2')" />
        <path class="court-zone-btn inner" id="zone-L3" data-id="L3" d="M 40,180 L 219.7,180 A 180,180 0 0,1 220,190 L 220,250 A 180,180 0 0,1 219.7,260 L 40,260 Z" onclick="selectCourtZone('L3')" />
        <path class="court-zone-btn inner" id="zone-L4" data-id="L4" d="M 40,260 L 219.7,260 A 180,180 0 0,1 155.9,340 L 40,340 Z" onclick="selectCourtZone('L4')" />
        <path class="court-zone-btn inner" id="zone-L5" data-id="L5" d="M 40,340 L 155.9,340 A 180,180 0 0,1 99.2,420 L 40,420 Z" onclick="selectCourtZone('L5')" />

        <path class="court-zone-btn outer" id="zone-L6" data-id="L6" d="M 99.2,20 L 440,20 L 440,100 L 155.9,100 A 180,180 0 0,0 99.2,20 Z" onclick="selectCourtZone('L6')" />
        <path class="court-zone-btn outer" id="zone-L7" data-id="L7" d="M 155.9,100 L 440,100 L 440,180 L 219.7,180 A 180,180 0 0,0 155.9,100 Z" onclick="selectCourtZone('L7')" />
        <path class="court-zone-btn outer" id="zone-L8" data-id="L8" d="M 219.7,180 A 180,180 0 0,1 220,190 L 220,250 A 180,180 0 0,1 219.7,260 L 440,260 L 440,180 Z" onclick="selectCourtZone('L8')" />
        <path class="court-zone-btn outer" id="zone-L9" data-id="L9" d="M 219.7,260 L 440,260 L 440,340 L 155.9,340 A 180,180 0 0,0 219.7,260 Z" onclick="selectCourtZone('L9')" />
        <path class="court-zone-btn outer" id="zone-L10" data-id="L10" d="M 155.9,340 L 440,340 L 440,420 L 99.2,420 A 180,180 0 0,0 155.9,340 Z" onclick="selectCourtZone('L10')" />

        <!-- RIGHT SIDE ZONES (R1 - R10) -->
        <path class="court-zone-btn inner" id="zone-R1" data-id="R1" d="M 840,20 L 780.8,20 A 180,180 0 0,0 724.1,100 L 840,100 Z" onclick="selectCourtZone('R1')" />
        <path class="court-zone-btn inner" id="zone-R2" data-id="R2" d="M 840,100 L 724.1,100 A 180,180 0 0,0 660.3,180 L 840,180 Z" onclick="selectCourtZone('R2')" />
        <path class="court-zone-btn inner" id="zone-R3" data-id="R3" d="M 840,180 L 660.3,180 A 180,180 0 0,0 660,190 L 660,250 A 180,180 0 0,0 660.3,260 L 840,260 Z" onclick="selectCourtZone('R3')" />
        <path class="court-zone-btn inner" id="zone-R4" data-id="R4" d="M 840,260 L 660.3,260 A 180,180 0 0,0 724.1,340 L 840,340 Z" onclick="selectCourtZone('R4')" />
        <path class="court-zone-btn inner" id="zone-R5" data-id="R5" d="M 840,340 L 724.1,340 A 180,180 0 0,0 780.8,420 L 840,420 Z" onclick="selectCourtZone('R5')" />

        <path class="court-zone-btn outer" id="zone-R6" data-id="R6" d="M 780.8,20 L 440,20 L 440,100 L 724.1,100 A 180,180 0 0,1 780.8,20 Z" onclick="selectCourtZone('R6')" />
        <path class="court-zone-btn outer" id="zone-R7" data-id="R7" d="M 724.1,100 L 440,100 L 440,180 L 660.3,180 A 180,180 0 0,1 724.1,100 Z" onclick="selectCourtZone('R7')" />
        <path class="court-zone-btn outer" id="zone-R8" data-id="R8" d="M 660.3,180 A 180,180 0 0,0 660,190 L 660,250 A 180,180 0 0,0 660.3,260 L 440,260 L 440,180 Z" onclick="selectCourtZone('R8')" />
        <path class="court-zone-btn outer" id="zone-R9" data-id="R9" d="M 660.3,260 L 440,260 L 440,340 L 724.1,340 A 180,180 0 0,1 660.3,260 Z" onclick="selectCourtZone('R9')" />
        <path class="court-zone-btn outer" id="zone-R10" data-id="R10" d="M 724.1,340 L 440,340 L 440,420 L 780.8,420 A 180,180 0 0,1 724.1,340 Z" onclick="selectCourtZone('R10')" />

        <!-- SAMAR TEXT LABELS (HOVER HIGHLIGHTED) -->
        <!-- Left Inner Labels -->
        <text class="court-zone-label" id="label-L1" x="90" y="65" font-size="12" fill="rgba(255,255,255,0.4)" font-family="sans-serif" text-anchor="middle" pointer-events="none">L1</text>
        <text class="court-zone-label" id="label-L2" x="120" y="145" font-size="12" fill="rgba(255,255,255,0.4)" font-family="sans-serif" text-anchor="middle" pointer-events="none">L2</text>
        <text class="court-zone-label" id="label-L3" x="130" y="225" font-size="12" fill="rgba(255,255,255,0.4)" font-family="sans-serif" text-anchor="middle" pointer-events="none">L3</text>
        <text class="court-zone-label" id="label-L4" x="120" y="305" font-size="12" fill="rgba(255,255,255,0.4)" font-family="sans-serif" text-anchor="middle" pointer-events="none">L4</text>
        <text class="court-zone-label" id="label-L5" x="90" y="385" font-size="12" fill="rgba(255,255,255,0.4)" font-family="sans-serif" text-anchor="middle" pointer-events="none">L5</text>

        <!-- Left Outer Labels -->
        <text class="court-zone-label" id="label-L6" x="280" y="65" font-size="12" fill="rgba(255,255,255,0.4)" font-family="sans-serif" text-anchor="middle" pointer-events="none">L6</text>
        <text class="court-zone-label" id="label-L7" x="300" y="145" font-size="12" fill="rgba(255,255,255,0.4)" font-family="sans-serif" text-anchor="middle" pointer-events="none">L7</text>
        <text class="court-zone-label" id="label-L8" x="310" y="225" font-size="12" fill="rgba(255,255,255,0.4)" font-family="sans-serif" text-anchor="middle" pointer-events="none">L8</text>
        <text class="court-zone-label" id="label-L9" x="300" y="305" font-size="12" fill="rgba(255,255,255,0.4)" font-family="sans-serif" text-anchor="middle" pointer-events="none">L9</text>
        <text class="court-zone-label" id="label-L10" x="280" y="385" font-size="12" fill="rgba(255,255,255,0.4)" font-family="sans-serif" text-anchor="middle" pointer-events="none">L10</text>

        <!-- Right Inner Labels -->
        <text class="court-zone-label" id="label-R1" x="790" y="65" font-size="12" fill="rgba(255,255,255,0.4)" font-family="sans-serif" text-anchor="middle" pointer-events="none">R1</text>
        <text class="court-zone-label" id="label-R2" x="760" y="145" font-size="12" fill="rgba(255,255,255,0.4)" font-family="sans-serif" text-anchor="middle" pointer-events="none">R2</text>
        <text class="court-zone-label" id="label-R3" x="750" y="225" font-size="12" fill="rgba(255,255,255,0.4)" font-family="sans-serif" text-anchor="middle" pointer-events="none">R3</text>
        <text class="court-zone-label" id="label-R4" x="760" y="305" font-size="12" fill="rgba(255,255,255,0.4)" font-family="sans-serif" text-anchor="middle" pointer-events="none">R4</text>
        <text class="court-zone-label" id="label-R5" x="790" y="385" font-size="12" fill="rgba(255,255,255,0.4)" font-family="sans-serif" text-anchor="middle" pointer-events="none">R5</text>

        <!-- Right Outer Labels -->
        <text class="court-zone-label" id="label-R6" x="600" y="65" font-size="12" fill="rgba(255,255,255,0.4)" font-family="sans-serif" text-anchor="middle" pointer-events="none">R6</text>
        <text class="court-zone-label" id="label-R7" x="580" y="145" font-size="12" fill="rgba(255,255,255,0.4)" font-family="sans-serif" text-anchor="middle" pointer-events="none">R7</text>
        <text class="court-zone-label" id="label-R8" x="570" y="225" font-size="12" fill="rgba(255,255,255,0.4)" font-family="sans-serif" text-anchor="middle" pointer-events="none">R8</text>
        <text class="court-zone-label" id="label-R9" x="580" y="305" font-size="12" fill="rgba(255,255,255,0.4)" font-family="sans-serif" text-anchor="middle" pointer-events="none">R9</text>
        <text class="court-zone-label" id="label-R10" x="600" y="385" font-size="12" fill="rgba(255,255,255,0.4)" font-family="sans-serif" text-anchor="middle" pointer-events="none">R10</text>
    </svg>
    `;

    container.innerHTML = svgHTML;

    // Hover effect bindings for labels
    const paths = container.querySelectorAll('.court-zone-btn');
    paths.forEach(p => {
        const zoneId = p.getAttribute('data-id');
        const label = document.getElementById(`label-${zoneId}`);
        if (label) {
            p.addEventListener('mouseenter', () => label.classList.add('active'));
            p.addEventListener('mouseleave', () => {
                if (selectedCourtZone !== zoneId) {
                    label.classList.remove('active');
                }
            });
        }
    });
}

function selectCourtZone(zoneId) {
    selectedCourtZone = zoneId;

    // Clear previous selection highlight
    document.querySelectorAll('.court-zone-btn').forEach(btn => btn.classList.remove('selected'));
    document.querySelectorAll('.court-zone-label').forEach(lbl => lbl.classList.remove('active'));

    // Highlight selected zone
    const selectedBtn = document.getElementById(`zone-${zoneId}`);
    if (selectedBtn) selectedBtn.classList.add('selected');

    const selectedLabel = document.getElementById(`label-${zoneId}`);
    if (selectedLabel) selectedLabel.classList.add('active');

    // Update zone bar text & show reset button
    const barText = document.getElementById('zone-bar-text');
    if (barText) {
        barText.innerText = `Zona Terpilih: ${COURT_ZONE_NAMES[zoneId] || zoneId}`;
        barText.classList.add('active');
    }

    const resetBtn = document.getElementById('zone-reset-btn');
    if (resetBtn) resetBtn.style.display = 'inline-block';
}

function resetCourtZone() {
    selectedCourtZone = null;

    // Clear highlights
    document.querySelectorAll('.court-zone-btn').forEach(btn => btn.classList.remove('selected'));
    document.querySelectorAll('.court-zone-label').forEach(lbl => lbl.classList.remove('active'));

    // Reset zone bar text & hide reset button
    const barText = document.getElementById('zone-bar-text');
    if (barText) {
        barText.innerText = 'Pilih zona tembakan di lapangan';
        barText.classList.remove('active');
    }

    const resetBtn = document.getElementById('zone-reset-btn');
    if (resetBtn) resetBtn.style.display = 'none';
}

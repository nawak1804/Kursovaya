const STORE_KEY = 'jp_planner_v8';
const STATIONS = [
  { name: 'Наше Радио', url: 'https://nashe1.hostingradio.ru/nashe-256', emoji: '🎸' },
  { name: 'Радио Шансон', url: 'https://chanson.hostingradio.ru:8041/chanson256.mp3', emoji: '🎤' },
  { name: 'Радио Ваня', url: 'https://radiovanya.hostingradio.ru:8000/radiovanya', emoji: '😎' },
  { name: 'Радио 21', url: 'https://pub0302.101.ru:8443/stream/air/mp3/256/219', emoji: '🛰️' },
  { name: 'Радио Дача', url: 'https://pub0301.101.ru:8443/stream/air/mp3/256/199', emoji: '🌼' },
  { name: 'Дорожное', url: 'https://dor2server.streamr.ru:8000/dorognoe', emoji: '🚗' },
  { name: 'Радио Рекорд', url: 'https://pub0302.101.ru:8443/stream/trust_128', emoji: '🔥' },
  { name: 'Europa Plus', url: 'https://emgregion.hostingradio.ru:8064/moscow.europaplus.mp3', emoji: '✨' },
];
const CITIES = ['Осака', 'Киото', 'Нара', 'Токио', 'Ночной автобус', 'Перелёт'];
const ICON = { 'Осака':'🏮','Киото':'⛩️','Нара':'🦌','Токио':'🗼','Ночной автобус':'🚌','Перелёт':'✈️' };

const state = load() || {
  theme: 'light', compact: false, search: '', dayView: 'list', selectedDayId: null,
  stationIndex: 0, notifSound: true, zombieStart: Date.now(),
  days: seedDays(), comments: []
};
if (!state.selectedDayId && state.days.length) state.selectedDayId = state.days[0].id;

const undo = [], redo = [];
const el = mapEls([
  'themeToggle','compactToggle','searchInput','exportBtn','importInput','timeline','tasksList','dayHeader','addTaskBtn','viewModeBtn',
  'overallRating','commentName','commentRating','commentText','addCommentBtn','commentList','backToTop','onlineCount','notifStack','notifSoundBtn',
  'zombieProgress','zombieText','stationName','stationArt','radioSelect','radioPlayer','playPause','prevStation','nextStation','volumeRange','eqCanvas',
  'clockMsk','clockJst','timeMsk','timeJst','compass','geoText','sideAd','bottomAd','fullscreenNudge','closeNudge',
  'geigerValue','geigerBarFill','snowLayer','emojiLayer'
]);

let geigerSpikeUntil = 0;
let beepCtx = null;

init();

function init() {
  applyTheme();
  if (el.themeToggle) el.themeToggle.checked = state.theme === 'dark';
  if (el.compactToggle) el.compactToggle.checked = state.compact;
  if (el.searchInput) el.searchInput.value = state.search;

  bindUI();
  renderAll();

  setInterval(drawClocks, 1000); drawClocks();
  setInterval(updateOnline, 2200); updateOnline();
  setInterval(pushNotification, 5000);
  setInterval(updateZombie, 1000); updateZombie();
  setInterval(() => { showAd('side'); showAd('bottom'); }, 60000);
  setInterval(() => el.fullscreenNudge?.classList.remove('hidden'), 300000);
  setInterval(updateGeiger, 900); updateGeiger();
  setInterval(spawnSnow, 170);
  setInterval(spawnEmoji, 900);
  setInterval(() => rotateCompass(8), 1200);

  initRadio();
  initCompassGeo();
  startEq();
}

function bindUI() {
  el.themeToggle?.addEventListener('change', () => {
    applyChange(() => { state.theme = el.themeToggle.checked ? 'dark' : 'light'; applyTheme(); });
  });
  el.compactToggle?.addEventListener('change', () => {
    state.compact = el.compactToggle.checked; save(); renderTimeline();
  });
  el.searchInput?.addEventListener('input', () => {
    state.search = el.searchInput.value; save(); renderTimeline();
  });

  el.addTaskBtn?.addEventListener('click', () => applyChange(() => {
    const d = getDay(); if (!d) return;
    d.tasks.push({ id: uid(), time: '', title: '', tag: '', notes: '', mapUrl: '' });
  }));
  el.viewModeBtn?.addEventListener('click', () => {
    state.dayView = state.dayView === 'list' ? 'timeline' : 'list'; save(); renderSelectedDay(); updateViewModeText();
  });

  el.addCommentBtn?.addEventListener('click', () => {
    const text = (el.commentText?.value || '').trim();
    if (!text) return;
    const rating = Number(el.commentRating?.value || 5);
    applyChange(() => {
      state.comments.push({ id: uid(), name: (el.commentName?.value || 'Гость').trim() || 'Гость', rating, text, time: new Date().toLocaleString('ru-RU') });
      if (rating === 5) zombieSafe();
    });
    if (el.commentText) el.commentText.value = '';
  });

  el.notifSoundBtn?.addEventListener('click', () => {
    state.notifSound = !state.notifSound; save();
    el.notifSoundBtn.textContent = state.notifSound ? '🔊 Звук уведомлений' : '🔇 Звук уведомлений';
  });

  el.backToTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  window.addEventListener('scroll', () => el.backToTop?.classList.toggle('show', window.scrollY > 380));

  document.querySelectorAll('.ad-close').forEach((btn) => {
    btn.addEventListener('mouseenter', () => { geigerSpikeUntil = Date.now() + 5000; });
    btn.addEventListener('click', () => closeAdWithMath(btn.dataset.ad));
  });

  el.closeNudge?.addEventListener('click', () => el.fullscreenNudge?.classList.add('hidden'));

  el.exportBtn?.addEventListener('click', exportJSON);
  el.importInput?.addEventListener('change', importJSON);
}

function renderAll() { renderTimeline(); renderSelectedDay(); renderComments(); renderRating(); updateViewModeText(); }
function updateViewModeText() { if (el.viewModeBtn) el.viewModeBtn.textContent = state.dayView === 'list' ? 'Таймлайн по часам' : 'Режим карточек'; }

function renderTimeline() {
  if (!el.timeline) return;
  const q = state.search.trim().toLowerCase();
  const days = state.days.filter((d) => !q || `${d.dateLabel} ${d.title} ${d.city}`.toLowerCase().includes(q));
  el.timeline.innerHTML = '';
  days.forEach((d, i) => {
    const card = document.createElement('button');
    card.className = `day-card ${d.id === state.selectedDayId ? 'selected' : ''}`;
    card.innerHTML = `<div class='day-top'><span>День ${i + 1}</span><span>${d.tasks.length}</span></div><div class='day-date'>${d.dateLabel}</div><div>${ICON[d.city] || '📍'} ${d.city}</div><div class='day-title'>${esc(d.title)}</div>${state.compact ? '' : `<div class='day-preview'>${d.tasks.slice(0,2).map(t => `<span>${t.time || ''} ${esc(t.title || '')}</span>`).join('')}</div>`}`;
    card.onclick = () => { state.selectedDayId = d.id; save(); renderTimeline(); renderSelectedDay(); };
    card.ondragover = (e) => e.preventDefault();
    card.ondrop = (e) => {
      e.preventDefault();
      const p = JSON.parse(e.dataTransfer.getData('text/plain') || '{}');
      if (p.taskId) moveTask(p.fromDayId, d.id, p.taskId);
    };
    el.timeline.appendChild(card);
  });
}

function renderSelectedDay() {
  const d = getDay();
  if (!el.tasksList || !el.dayHeader) return;
  if (!d) { el.dayHeader.textContent = 'Выберите день'; el.tasksList.innerHTML = ''; return; }

  el.dayHeader.innerHTML = `<b>${d.dateLabel} · ${esc(d.title)}</b> <span class='muted'>${ICON[d.city] || '📍'} ${d.city}</span>`;

  if (state.dayView === 'timeline') { renderHourView(d); return; }

  const list = [...d.tasks].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  if (!list.length) { el.tasksList.innerHTML = `<div class='task muted'>Нет задач</div>`; return; }
  el.tasksList.innerHTML = '';

  list.forEach((t) => {
    const node = document.createElement('div');
    node.className = 'task';
    node.draggable = true;
    node.ondragstart = (e) => e.dataTransfer.setData('text/plain', JSON.stringify({ fromDayId: d.id, taskId: t.id }));
    node.innerHTML = `<div class='task-grid'><input type='time' value='${attr(t.time || '')}'/><input type='text' placeholder='Задача' value='${attr(t.title || '')}'/><input type='text' placeholder='Google Maps URL' value='${attr(t.mapUrl || '')}'/><div><input type='text' placeholder='Тег' value='${attr(t.tag || '')}'/><button class='btn'>Удалить</button></div></div><textarea placeholder='Заметки'>${esc(t.notes || '')}</textarea><div class='muted'>${t.mapUrl ? `<a href='${attr(t.mapUrl)}' target='_blank' rel='noreferrer'>📍 Карта</a>` : ''}</div>`;

    const [timeEl, titleEl, mapEl, tagEl, delBtn] = node.querySelectorAll('input, button');
    const noteEl = node.querySelector('textarea');
    timeEl.oninput = () => patchTask(t.id, { time: timeEl.value });
    titleEl.oninput = () => patchTask(t.id, { title: titleEl.value });
    mapEl.oninput = () => patchTask(t.id, { mapUrl: mapEl.value });
    tagEl.oninput = () => patchTask(t.id, { tag: tagEl.value });
    noteEl.oninput = () => patchTask(t.id, { notes: noteEl.value });
    delBtn.onclick = () => applyChange(() => { d.tasks = d.tasks.filter((x) => x.id !== t.id); });

    el.tasksList.appendChild(node);
  });
}

function renderHourView(d) {
  const slots = []; for (let h = 6; h <= 23; h++) slots.push(String(h).padStart(2, '0') + ':00');
  el.tasksList.innerHTML = `<div class='hour-grid'>${slots.map((s) => {
    const h = Number(s.slice(0, 2));
    const bucket = d.tasks.filter((t) => t.time && Number(t.time.slice(0, 2)) === h);
    return `<div class='hour-row'><div class='hour-l'>${s}</div><div class='hour-c'>${bucket.map((t) => `<div>• ${esc(t.title || '')} ${t.mapUrl ? `<a href='${attr(t.mapUrl)}' target='_blank'>Карта</a>` : ''}</div>`).join('')}</div></div>`;
  }).join('')}</div>`;
}

function patchTask(taskId, patch) {
  const d = getDay(); if (!d) return;
  d.tasks = d.tasks.map((t) => t.id === taskId ? { ...t, ...patch } : t);
  save(); renderTimeline();
}

function moveTask(fromDayId, toDayId, taskId) {
  if (fromDayId === toDayId) return;
  applyChange(() => {
    const from = state.days.find((x) => x.id === fromDayId);
    const to = state.days.find((x) => x.id === toDayId);
    if (!from || !to) return;
    const idx = from.tasks.findIndex((x) => x.id === taskId);
    if (idx < 0) return;
    const [task] = from.tasks.splice(idx, 1);
    to.tasks.push(task);
  });
}

function renderComments() {
  if (!el.commentList) return;
  if (!state.comments.length) { el.commentList.innerHTML = `<div class='muted'>Пока отзывов нет</div>`; return; }
  el.commentList.innerHTML = state.comments.slice().reverse().map((c) => `<div class='comment-item'><b>${esc(c.name)}</b> · ${'⭐'.repeat(c.rating)}<div>${esc(c.text)}</div><div class='muted'>${c.time}</div></div>`).join('');
}

function renderRating() {
  if (!el.overallRating) return;
  if (!state.comments.length) { el.overallRating.textContent = '0.0'; return; }
  const avg = state.comments.reduce((s, c) => s + Number(c.rating || 0), 0) / state.comments.length;
  el.overallRating.textContent = avg.toFixed(1);
}

function applyTheme() { document.body.setAttribute('data-theme', state.theme === 'dark' ? 'dark' : 'light'); }

function initRadio() {
  if (!el.radioSelect || !el.radioPlayer) return;
  el.radioSelect.innerHTML = STATIONS.map((s, i) => `<option value='${i}'>${s.name}</option>`).join('');
  setStation(state.stationIndex || 0, false);

  el.prevStation.onclick = () => setStation((state.stationIndex - 1 + STATIONS.length) % STATIONS.length, true);
  el.nextStation.onclick = () => setStation((state.stationIndex + 1) % STATIONS.length, true);
  el.radioSelect.onchange = () => setStation(Number(el.radioSelect.value), true);
  el.volumeRange.oninput = () => { el.radioPlayer.volume = Number(el.volumeRange.value); };
  el.playPause.onclick = async () => {
    try {
      if (el.radioPlayer.paused) { await el.radioPlayer.play(); el.playPause.textContent = '⏸'; }
      else { el.radioPlayer.pause(); el.playPause.textContent = '▶'; }
    } catch {}
  };
  el.radioPlayer.volume = Number(el.volumeRange.value);
}

function setStation(idx, autoplay) {
  state.stationIndex = idx;
  const s = STATIONS[idx];
  if (!s || !el.radioPlayer) return;
  el.radioPlayer.src = s.url;
  if (el.stationName) el.stationName.textContent = s.name;
  if (el.stationArt) el.stationArt.textContent = s.emoji;
  if (el.radioSelect) el.radioSelect.value = String(idx);
  save();
  if (autoplay) el.radioPlayer.play().then(() => { if (el.playPause) el.playPause.textContent = '⏸'; }).catch(() => {});
}

function startEq() {
  if (!el.eqCanvas) return;
  const c = el.eqCanvas, ctx = c.getContext('2d');
  const tick = () => {
    ctx.clearRect(0, 0, c.width, c.height);
    for (let i = 0; i < 42; i++) {
      const h = 15 + Math.random() * 72;
      ctx.fillStyle = `hsl(${130 + i * 2},85%,${45 + Math.random() * 20}%)`;
      ctx.fillRect(8 + i * 13, c.height - h, 9, h);
    }
    requestAnimationFrame(tick);
  };
  tick();
}

function drawClocks() {
  const n = new Date();
  const m = new Date(n.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  const j = new Date(n.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  drawClock(el.clockMsk, m); drawClock(el.clockJst, j);
  if (el.timeMsk) el.timeMsk.textContent = m.toLocaleTimeString('ru-RU');
  if (el.timeJst) el.timeJst.textContent = j.toLocaleTimeString('ru-RU');
}

function drawClock(canvas, date) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d'), w = canvas.width, p = w / 2;
  ctx.clearRect(0, 0, w, w);
  ctx.beginPath(); ctx.arc(p, p, p - 6, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fill(); ctx.strokeStyle = 'rgba(120,140,180,.6)'; ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    ctx.beginPath(); ctx.moveTo(p + Math.cos(a) * (p - 18), p + Math.sin(a) * (p - 18)); ctx.lineTo(p + Math.cos(a) * (p - 10), p + Math.sin(a) * (p - 10)); ctx.stroke();
  }
  hand(ctx, p, (date.getHours() % 12 + date.getMinutes() / 60) * Math.PI / 6 - Math.PI / 2, p - 34, 4);
  hand(ctx, p, (date.getMinutes() + date.getSeconds() / 60) * Math.PI / 30 - Math.PI / 2, p - 24, 3);
  hand(ctx, p, date.getSeconds() * Math.PI / 30 - Math.PI / 2, p - 18, 2, '#ef4444');
}
function hand(ctx, p, a, l, w, col) { ctx.beginPath(); ctx.moveTo(p, p); ctx.lineTo(p + Math.cos(a) * l, p + Math.sin(a) * l); ctx.lineWidth = w; ctx.strokeStyle = col || '#111'; ctx.stroke(); }

let compassDeg = 0;
function initCompassGeo() {
  if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', (e) => {
      if (typeof e.alpha === 'number') { compassDeg = e.alpha; updateCompass(compassDeg); }
    });
  }
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => { if (el.geoText) el.geoText.textContent = `lat ${pos.coords.latitude.toFixed(2)}, lon ${pos.coords.longitude.toFixed(2)}`; },
      () => { if (el.geoText) el.geoText.textContent = 'геолокация недоступна'; }
    );
  }
}
function rotateCompass(delta) { compassDeg = (compassDeg + delta) % 360; updateCompass(compassDeg); }
function updateCompass(deg) { if (el.compass) el.compass.style.transform = `rotate(${deg}deg)`; }

function updateOnline() { if (el.onlineCount) el.onlineCount.textContent = String(400 + Math.floor(Math.random() * 201)); }

function pushNotification() {
  if (!el.notifStack) return;
  const n = document.createElement('div');
  n.className = 'notif';
  n.innerHTML = `<b>Новое сообщение</b><br><small>Пользователь обновил план поездки</small>`;
  el.notifStack.prepend(n);
  while (el.notifStack.children.length > 4) el.notifStack.lastChild.remove();
  if (state.notifSound) beep(740, 0.03);
  setTimeout(() => n.remove(), 4200);
}

function updateGeiger() {
  const high = Date.now() < geigerSpikeUntil;
  const value = high ? (1.2 + Math.random() * 3.2) : (0.12 + Math.random() * 0.35);
  if (el.geigerValue) el.geigerValue.textContent = `${value.toFixed(2)} μSv/h`;
  if (el.geigerBarFill) el.geigerBarFill.style.width = `${Math.min(100, value * 25)}%`;
  beep(high ? 1600 : 420, high ? 0.09 : 0.02);
}

function closeAdWithMath(which) {
  let allow = true;
  if (Math.random() < 0.3) {
    const a = Math.floor(Math.random() * 9) + 1, b = Math.floor(Math.random() * 9) + 1;
    const ans = prompt(`Решите пример для закрытия рекламы: ${a} + ${b} = ?`);
    allow = Number(ans) === (a + b);
  }
  if (!allow) return;
  hideAd(which);
  setTimeout(() => showAd(which), 60000);
}
function hideAd(which) { (which === 'side' ? el.sideAd : el.bottomAd)?.classList.add('hidden'); }
function showAd(which) { (which === 'side' ? el.sideAd : el.bottomAd)?.classList.remove('hidden'); }

function updateZombie() {
  const total = 5 * 60 * 1000;
  const passed = Math.min(total, Date.now() - state.zombieStart);
  const p = (passed / total) * 100;
  if (el.zombieProgress) el.zombieProgress.style.width = `${p}%`;
  if (el.zombieText) el.zombieText.textContent = p >= 100 ? '☣ КРИТИЧЕСКАЯ СТАДИЯ: ПК под атакой зомби! Оставьте 5⭐ отзыв!' : '⚠ Ваш ПК находится под атакой зомби!';
}
function zombieSafe() {
  if (el.zombieText) el.zombieText.textContent = '✅ Спасибо, зомби отступили';
  state.zombieStart = Date.now() + 5 * 60 * 1000;
  save();
  setTimeout(() => { state.zombieStart = Date.now(); save(); }, 5000);
}

function spawnSnow() {
  if (!el.snowLayer) return;
  const s = document.createElement('div'); s.className = 'snow'; s.textContent = '❄';
  s.style.left = `${Math.random() * 100}vw`; s.style.fontSize = `${10 + Math.random() * 18}px`; s.style.animationDuration = `${6 + Math.random() * 8}s`;
  el.snowLayer.appendChild(s); setTimeout(() => s.remove(), 16000);
}
function spawnEmoji() {
  if (!el.emojiLayer) return;
  const em = ['🔥','😍','👍','😂','✨','🎉','⚡'];
  const e = document.createElement('div'); e.className = 'emoji-float'; e.textContent = em[Math.floor(Math.random() * em.length)];
  e.style.right = `${8 + Math.random() * 120}px`; e.style.animationDuration = `${4 + Math.random() * 4}s`;
  el.emojiLayer.appendChild(e); setTimeout(() => e.remove(), 9000);
}

function beep(freq, vol) {
  if (!state.notifSound) return;
  try {
    beepCtx = beepCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = beepCtx.createOscillator(), g = beepCtx.createGain();
    o.connect(g); g.connect(beepCtx.destination);
    o.frequency.value = freq; g.gain.value = vol;
    o.start(); o.stop(beepCtx.currentTime + 0.03);
  } catch {}
}

function applyChange(mutator) {
  undo.push(JSON.stringify(state)); if (undo.length > 120) undo.shift(); redo.length = 0;
  mutator(); save(); renderAll();
}

const undoBtn = document.getElementById('undoBtn');
if (undoBtn) undoBtn.onclick = () => { if (!undo.length) return; redo.push(JSON.stringify(state)); Object.assign(state, JSON.parse(undo.pop())); applyTheme(); save(); renderAll(); };
const redoBtn = document.getElementById('redoBtn');
if (redoBtn) redoBtn.onclick = () => { if (!redo.length) return; undo.push(JSON.stringify(state)); Object.assign(state, JSON.parse(redo.pop())); applyTheme(); save(); renderAll(); };

function exportJSON() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = 'planner.json'; a.click(); URL.revokeObjectURL(url);
}
function importJSON(e) {
  const f = e.target.files?.[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const parsed = JSON.parse(String(r.result));
      if (!parsed?.days?.length) return;
      Object.assign(state, parsed);
      if (!state.selectedDayId && state.days.length) state.selectedDayId = state.days[0].id;
      applyTheme(); save(); renderAll();
    } catch {}
  };
  r.readAsText(f); e.target.value = '';
}

function getDay() { return state.days.find((d) => d.id === state.selectedDayId); }
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
function load() { try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch { return null; } }
function uid() { return Math.random().toString(16).slice(2) + Date.now().toString(16); }
function mapEls(ids) { return Object.fromEntries(ids.map((id) => [id, document.getElementById(id)])); }
function esc(s) { return String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }
function attr(s) { return esc(s).replaceAll('"', '&quot;'); }

function seedDays() {
  const items = [
    ['31.08','Вылет','Перелёт'],['01.09','Прилёт KIX + Дотонбори','Осака'],['02.09','Осака центр','Осака'],['03.09','Осака юг','Осака'],
    ['04.09','Нара (day trip)','Нара'],['05.09','Киото восток','Киото'],['06.09','Киото Арасияма','Киото'],['07.09','Киото север','Киото'],
    ['08.09','Осака свободно','Осака'],['09.09','Осака → Токио (автобус)','Ночной автобус'],['10.09','Токио прибытие','Токио'],['11.09','Shibuya / Shinjuku','Токио'],
    ['12.09','Odaiba / TeamLab','Токио'],['13.09','Hakone / Fuji','Токио'],['14.09','Kamakura / Nikko','Токио'],['15.09','Токио свободно','Токио'],['16.09','Вылет HND','Перелёт']
  ];
  return items.map(([dateLabel,title,city],idx) => ({
    id: uid(), dateLabel, title, city,
    tasks: idx === 1 ? [{ id: uid(), time: '21:00', title: 'Дотонбори', notes: '', tag: 'вечер', mapUrl: 'https://maps.google.com/?q=Dotonbori' }] : []
  }));
}

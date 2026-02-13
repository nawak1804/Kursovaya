const CITY = {
  OSAKA: 'Осака', KYOTO: 'Киото', NARA: 'Нара', TOKYO: 'Токио', BUS: 'Ночной автобус', FLIGHT: 'Перелёт',
};
const CITY_ICON = { [CITY.OSAKA]:'🏮',[CITY.KYOTO]:'⛩️',[CITY.NARA]:'🦌',[CITY.TOKYO]:'🗼',[CITY.BUS]:'🚌',[CITY.FLIGHT]:'✈️' };
const CITY_CLASS = { [CITY.OSAKA]:'city-osaka',[CITY.KYOTO]:'city-kyoto',[CITY.NARA]:'city-nara',[CITY.TOKYO]:'city-tokyo',[CITY.BUS]:'city-bus',[CITY.FLIGHT]:'city-flight' };

const STORE_KEY = 'jp_planner_v3';
const SYNC_KEY = 'jp_planner_sync_cfg';
const clientId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();

const state = load() || { compact:false, showNotes:true, search:'', activeTab:'moves', selectedDayId:null, days:makeDefaultDays() };
if (!state.selectedDayId) state.selectedDayId = state.days[1]?.id || state.days[0]?.id;

const syncState = {
  config: loadSyncConfig(),
  connected: false,
  app: null,
  db: null,
  ref: null,
  unsub: null,
  mutePush: false,
  lastRemoteTs: 0,
};

const el = {
  compact: byId('compact'), showNotes: byId('showNotes'), search: byId('search'), exportBtn: byId('exportBtn'),
  importInput: byId('importInput'), settingsBtn: byId('settingsBtn'), summary: byId('summary'), timeline: byId('timeline'),
  selectedCityBadge: byId('selectedCityBadge'), addTaskBtn: byId('addTaskBtn'), dayHeader: byId('dayHeader'), tasks: byId('tasks'),
  tabContent: byId('tabContent'), settingsModal: byId('settingsModal'), closeSettings: byId('closeSettings'), settingsDays: byId('settingsDays'),
  resetBtn: byId('resetBtn'), kyotoNightBtn: byId('kyotoNightBtn'), syncBtn: byId('syncBtn'), syncModal: byId('syncModal'),
  closeSync: byId('closeSync'), fbApiKey: byId('fbApiKey'), fbAuthDomain: byId('fbAuthDomain'), fbDbUrl: byId('fbDbUrl'),
  fbProjectId: byId('fbProjectId'), fbAppId: byId('fbAppId'), fbPath: byId('fbPath'), connectSync: byId('connectSync'),
  disconnectSync: byId('disconnectSync'), syncStatus: byId('syncStatus'),
};

init();

function init() {
  el.compact.checked = state.compact;
  el.showNotes.checked = state.showNotes;
  el.search.value = state.search;

  el.compact.onchange = () => patchState({ compact: el.compact.checked });
  el.showNotes.onchange = () => patchState({ showNotes: el.showNotes.checked });
  el.search.oninput = () => patchState({ search: el.search.value });
  el.exportBtn.onclick = exportJSON;
  el.importInput.onchange = importJSON;
  el.addTaskBtn.onclick = () => state.selectedDayId && mutateDay(state.selectedDayId, (d) => d.tasks.push(makeTask()));

  el.settingsBtn.onclick = () => openModal(el.settingsModal, true);
  el.closeSettings.onclick = () => openModal(el.settingsModal, false);
  el.settingsModal.querySelector('.modal-backdrop').onclick = () => openModal(el.settingsModal, false);

  el.syncBtn.onclick = () => openModal(el.syncModal, true);
  el.closeSync.onclick = () => openModal(el.syncModal, false);
  el.syncModal.querySelector('.modal-backdrop').onclick = () => openModal(el.syncModal, false);

  document.querySelectorAll('.tab').forEach((tab) => tab.onclick = () => { state.activeTab = tab.dataset.tab; save(); renderTabs(); });

  el.resetBtn.onclick = () => {
    state.days = makeDefaultDays();
    state.selectedDayId = state.days[1]?.id || state.days[0]?.id;
    save(); render(); pushSync();
  };
  el.kyotoNightBtn.onclick = () => {
    const target = state.days.find((d) => d.title.includes('свободный') && d.city === CITY.OSAKA);
    if (!target) return;
    target.city = CITY.KYOTO; target.title = 'Киото (ночёвка)';
    save(); render(); pushSync(); renderSettingsDays();
  };

  el.connectSync.onclick = connectSync;
  el.disconnectSync.onclick = disconnectSync;
  fillSyncForm();
  renderSyncStatus('Sync не подключен');

  render();
  if (syncState.config?.apiKey) connectSync(true);
}

function render() { renderSummary(); renderTimeline(); renderSelectedDay(); renderTabs(); renderSettingsDays(); }
function renderSummary() {
  const map = new Map();
  state.days.forEach((d) => map.set(d.city, (map.get(d.city) || 0) + 1));
  el.summary.innerHTML = [...map.entries()].map(([city, c]) => `<span class="badge">${CITY_ICON[city]} ${city}: ${c}</span>`).join('');
}
function renderTimeline() {
  const q = state.search.trim().toLowerCase();
  const days = state.days.filter((d) => !q || `${d.dateLabel} ${d.title} ${d.city}`.toLowerCase().includes(q) || d.tasks.some((t) => `${t.time} ${t.title} ${t.notes} ${t.tag}`.toLowerCase().includes(q)));
  el.timeline.innerHTML = '';
  days.forEach((d, i) => {
    const card = document.createElement('button');
    card.className = `day-card ${CITY_CLASS[d.city]} ${d.id === state.selectedDayId ? 'selected' : ''}`;
    card.innerHTML = `<div class="day-top"><span>День ${i + 1}</span><span>${d.tasks.length} задач</span></div><div class="day-date">${d.dateLabel}</div><span class="badge badge-soft">${CITY_ICON[d.city]} ${d.city}</span><div class="day-title">${escapeHtml(d.title)}</div>${state.compact ? '' : renderDayPreview(d.tasks)}`;
    card.onclick = () => patchState({ selectedDayId: d.id });
    card.ondragover = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
    card.ondrop = (e) => {
      e.preventDefault();
      const payload = parseJSON(e.dataTransfer.getData('text/plain'));
      if (payload?.taskId && payload?.fromDayId) moveTask(payload.fromDayId, d.id, payload.taskId);
    };
    el.timeline.appendChild(card);
  });
}
function renderDayPreview(tasks) {
  if (!tasks.length) return '<div class="day-preview"><span>Нет задач</span></div>';
  const rows = tasks.slice(0, 3).map((t) => `<span>${t.time ? `${t.time} · ` : ''}${escapeHtml(t.title || '(без названия)')}</span>`).join('');
  return `<div class="day-preview">${rows}${tasks.length > 3 ? `<span>+ ещё ${tasks.length - 3}</span>` : ''}</div>`;
}
function renderSelectedDay() {
  const day = state.days.find((d) => d.id === state.selectedDayId);
  if (!day) { el.dayHeader.textContent = 'Выберите день в ленте сверху.'; el.selectedCityBadge.textContent = ''; el.tasks.innerHTML = ''; return; }

  el.selectedCityBadge.innerHTML = `${CITY_ICON[day.city]} ${day.city}`;
  el.dayHeader.innerHTML = `<b>${day.dateLabel} · ${escapeHtml(day.title)}</b><div class="muted">Перетаскивайте задачи между днями (drag&drop).</div>`;

  const sorted = [...day.tasks].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  el.tasks.innerHTML = '';
  if (!sorted.length) { el.tasks.innerHTML = '<div class="task muted">Пока задач нет. Нажмите «Добавить».</div>'; return; }

  sorted.forEach((task) => {
    const node = document.createElement('div');
    node.className = 'task';
    node.draggable = true;
    node.ondragstart = (e) => { node.classList.add('dragging'); e.dataTransfer.setData('text/plain', JSON.stringify({ fromDayId: day.id, taskId: task.id })); };
    node.ondragend = () => node.classList.remove('dragging');
    node.innerHTML = `<div class="task-grid"><input type="time" value="${escapeAttr(task.time || '')}" /><input type="text" placeholder="Задача" value="${escapeAttr(task.title || '')}" /><div><input type="text" placeholder="Тег" value="${escapeAttr(task.tag || '')}" /><button class="btn btn-ghost stretch">Удалить</button></div></div>${state.showNotes ? `<textarea placeholder="Заметки / билеты / станции / ссылки">${escapeHtml(task.notes || '')}</textarea>` : ''}<div class="task-foot">Перетаскивание: возьмите карточку и бросьте на другой день в ленте.</div>`;

    const [timeInput, titleInput, tagInput, delBtn] = node.querySelectorAll('input, button');
    const notes = node.querySelector('textarea');
    timeInput.oninput = () => updateTask(day.id, task.id, { time: timeInput.value });
    titleInput.oninput = () => updateTask(day.id, task.id, { title: titleInput.value });
    tagInput.oninput = () => updateTask(day.id, task.id, { tag: tagInput.value });
    if (notes) notes.oninput = () => updateTask(day.id, task.id, { notes: notes.value });
    delBtn.onclick = () => mutateDay(day.id, (d) => (d.tasks = d.tasks.filter((t) => t.id !== task.id)));
    el.tasks.appendChild(node);
  });
}
function renderTabs() {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === state.activeTab));
  if (state.activeTab === 'moves') el.tabContent.innerHTML = `<div class="note"><b>Осака → Токио</b><br>Ночной автобус 09.09 21:00 → 10.09 07:00. Утро 10.09 лучше сделать лёгким.</div><div class="note"><b>Дейтрипы из Осаки</b><br>Нара — 1 день. Киото — 2–3 дня. Можно добавить 1 ночёвку в Киото.</div>`;
  else if (state.activeTab === 'tickets') el.tabContent.innerHTML = `<div class="note"><b>Перелёт туда</b><br>31.08 21:05 LED → 01.09 18:00 KIX.</div><div class="note"><b>Перелёт обратно</b><br>16.09 08:40 HND (T3) → 16.09 19:05 LED.</div>`;
  else el.tabContent.innerHTML = `<div class="note"><b>Что заранее</b><br>TeamLab/музеи, места в ночном автобусе, IC-карта (ICOCA/Suica).</div><div class="note"><b>Как работать с планом</b><br>Выберите день → добавьте задачи → переносите drag&drop → экспортируйте JSON.</div>`;
}
function renderSettingsDays() {
  el.settingsDays.innerHTML = '';
  state.days.forEach((d, i) => {
    const item = document.createElement('div');
    item.className = 'settings-item';
    item.innerHTML = `<div class="top"><span>День ${i + 1} · ${d.dateLabel}</span><span>${CITY_ICON[d.city]} ${d.city}</span></div><select>${Object.values(CITY).map((c) => `<option value="${escapeAttr(c)}" ${c === d.city ? 'selected' : ''}>${CITY_ICON[c]} ${c}</option>`).join('')}</select><input type="text" value="${escapeAttr(d.title)}" placeholder="Заголовок дня" />`;
    const [sel, input] = item.querySelectorAll('select, input');
    sel.onchange = () => mutateDay(d.id, (day) => (day.city = sel.value));
    input.oninput = () => mutateDay(d.id, (day) => (day.title = input.value));
    el.settingsDays.appendChild(item);
  });
}

function moveTask(fromDayId, toDayId, taskId) {
  if (fromDayId === toDayId) return;
  const from = state.days.find((d) => d.id === fromDayId), to = state.days.find((d) => d.id === toDayId);
  if (!from || !to) return;
  const idx = from.tasks.findIndex((t) => t.id === taskId);
  if (idx < 0) return;
  const [task] = from.tasks.splice(idx, 1);
  to.tasks.push(task);
  save(); render(); pushSync();
}
function updateTask(dayId, taskId, patch) {
  mutateDay(dayId, (day) => { day.tasks = day.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)); }, false);
}
function mutateDay(dayId, mutator, rerender = true) {
  const day = state.days.find((d) => d.id === dayId);
  if (!day) return;
  mutator(day);
  save(); if (rerender) render(); pushSync();
}
function patchState(patch) { Object.assign(state, patch); save(); render(); }
function openModal(modal, show) { modal.classList.toggle('hidden', !show); }

async function connectSync(silent = false) {
  try {
    const cfg = {
      apiKey: (el.fbApiKey.value || syncState.config.apiKey || '').trim(),
      authDomain: (el.fbAuthDomain.value || syncState.config.authDomain || '').trim(),
      databaseURL: (el.fbDbUrl.value || syncState.config.databaseURL || '').trim(),
      projectId: (el.fbProjectId.value || syncState.config.projectId || '').trim(),
      appId: (el.fbAppId.value || syncState.config.appId || '').trim(),
      path: (el.fbPath.value || syncState.config.path || 'sharedPlanner').trim(),
    };
    if (!cfg.apiKey || !cfg.databaseURL || !cfg.projectId || !cfg.appId) {
      renderSyncStatus('Заполните Firebase config поля');
      return;
    }
    saveSyncConfig(cfg);
    syncState.config = cfg;

    const appMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
    const dbMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js');

    disconnectSync(true);
    syncState.app = appMod.initializeApp(cfg, 'trip-planner-' + Math.random().toString(16).slice(2, 8));
    syncState.db = dbMod.getDatabase(syncState.app);
    syncState.ref = dbMod.ref(syncState.db, `${cfg.path}/state`);

    syncState.unsub = dbMod.onValue(syncState.ref, (snap) => {
      const remote = snap.val();
      if (!remote?.state || !remote?.updatedAt) return;
      if (remote.clientId === clientId) return;
      if (remote.updatedAt <= syncState.lastRemoteTs) return;
      syncState.lastRemoteTs = remote.updatedAt;
      syncState.mutePush = true;
      Object.assign(state, remote.state);
      if (!state.selectedDayId) state.selectedDayId = state.days[0]?.id || null;
      save(); render();
      syncState.mutePush = false;
      renderSyncStatus('Sync подключен: получены изменения');
    });

    syncState.connected = true;
    renderSyncStatus('Sync подключен');
    if (!silent) openModal(el.syncModal, false);
    pushSync();
  } catch (e) {
    renderSyncStatus('Ошибка подключения Sync');
  }
}

function disconnectSync(silent = false) {
  try { if (syncState.unsub) syncState.unsub(); } catch {}
  syncState.connected = false;
  syncState.unsub = null;
  if (!silent) renderSyncStatus('Sync отключен');
}

async function pushSync() {
  if (!syncState.connected || syncState.mutePush || !syncState.ref || !syncState.db) return;
  try {
    const dbMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js');
    await dbMod.set(syncState.ref, { updatedAt: Date.now(), clientId, state });
  } catch {
    renderSyncStatus('Не удалось отправить изменения в cloud');
  }
}

function fillSyncForm() {
  const c = syncState.config || {};
  el.fbApiKey.value = c.apiKey || '';
  el.fbAuthDomain.value = c.authDomain || '';
  el.fbDbUrl.value = c.databaseURL || '';
  el.fbProjectId.value = c.projectId || '';
  el.fbAppId.value = c.appId || '';
  el.fbPath.value = c.path || 'sharedPlanner';
}
function renderSyncStatus(text) { el.syncStatus.textContent = text; }

function exportJSON() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'japan-trip-planner.json'; a.click();
  URL.revokeObjectURL(url);
}
function importJSON(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    const parsed = parseJSON(String(reader.result));
    if (!parsed?.days?.length) return;
    Object.assign(state, parsed);
    if (!state.selectedDayId) state.selectedDayId = state.days[0]?.id;
    save(); render(); pushSync();
  };
  reader.readAsText(f);
  e.target.value = '';
}

function makeDefaultDays() {
  const data = [
    ['31.08', 'Вылет', CITY.FLIGHT], ['01.09', 'Прилёт KIX + Дотонбори', CITY.OSAKA], ['02.09', 'Осака центр', CITY.OSAKA],
    ['03.09', 'Осака юг', CITY.OSAKA], ['04.09', 'Нара (day trip)', CITY.NARA], ['05.09', 'Киото восток', CITY.KYOTO],
    ['06.09', 'Киото Арасияма', CITY.KYOTO], ['07.09', 'Киото север / спокойный день', CITY.KYOTO], ['08.09', 'Осака (свободный день)', CITY.OSAKA],
    ['09.09', 'Осака → Токио (автобус 21:00)', CITY.BUS], ['10.09', 'Токио (07:00 прибытие)', CITY.TOKYO],
    ['11.09', 'Shibuya + Harajuku + Shinjuku', CITY.TOKYO], ['12.09', 'Odaiba / TeamLab', CITY.TOKYO],
    ['13.09', 'Выезд: Hakone / Fuji', CITY.TOKYO], ['14.09', 'Выезд: Kamakura / Nikko', CITY.TOKYO],
    ['15.09', 'Токио (финальный свободный)', CITY.TOKYO], ['16.09', 'Вылет HND 08:40', CITY.FLIGHT],
  ];
  return data.map(([dateLabel, title, city], idx) => ({ id: uid(), dateLabel, title, city, tasks: seedTasks(idx) }));
}
function seedTasks(i) {
  if (i === 1) return [makeTask('19:30', 'Дорога KIX → Нанба', 'Nankai / Limousine Bus', 'логистика'), makeTask('21:00', 'Дотонбори — лёгкая прогулка', 'без плотного плана', 'вечер')];
  if (i === 2) return [makeTask('09:00', 'Osaka Castle', 'музей внутри', 'must'), makeTask('18:00', 'Umeda Sky Building', 'закат/ночной вид', 'view')];
  if (i === 9) return [makeTask('21:00', 'Ночной автобус Осака → Токио', 'прибытие ~07:00', 'логистика')];
  if (i === 16) return [makeTask('05:45', 'Выезд в HND', 'запас времени', 'логистика')];
  return [];
}
function makeTask(time = '', title = '', notes = '', tag = '') { return { id: uid(), time, title, notes, tag }; }

function byId(id) { return document.getElementById(id); }
function uid() { return Math.random().toString(16).slice(2) + Date.now().toString(16); }
function parseJSON(s) { try { return JSON.parse(s); } catch { return null; } }
function load() { return parseJSON(localStorage.getItem(STORE_KEY)); }
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
function loadSyncConfig() { return parseJSON(localStorage.getItem(SYNC_KEY)) || {}; }
function saveSyncConfig(cfg) { localStorage.setItem(SYNC_KEY, JSON.stringify(cfg)); }
function escapeHtml(s) { return String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }
function escapeAttr(s) { return escapeHtml(s).replaceAll('"', '&quot;'); }

const CITY = {
  OSAKA: 'Осака',
  KYOTO: 'Киото',
  NARA: 'Нара',
  TOKYO: 'Токио',
  BUS: 'Ночной автобус',
  FLIGHT: 'Перелёт',
};

const CITY_CLASS = {
  [CITY.OSAKA]: 'city-osaka',
  [CITY.KYOTO]: 'city-kyoto',
  [CITY.NARA]: 'city-nara',
  [CITY.TOKYO]: 'city-tokyo',
  [CITY.BUS]: 'city-bus',
  [CITY.FLIGHT]: 'city-flight',
};

const KEY = 'jp_planner_site_v1';

const state = load() || {
  compact: false,
  showNotes: true,
  search: '',
  selectedDayId: null,
  days: buildDefaults(),
};
if (!state.selectedDayId && state.days.length) state.selectedDayId = state.days[0].id;

const el = {
  compact: document.getElementById('compact'),
  showNotes: document.getElementById('showNotes'),
  search: document.getElementById('search'),
  summary: document.getElementById('summary'),
  timeline: document.getElementById('timeline'),
  dayDetails: document.getElementById('dayDetails'),
  tasks: document.getElementById('tasks'),
  exportBtn: document.getElementById('exportBtn'),
  importInput: document.getElementById('importInput'),
  addTaskBtn: document.getElementById('addTaskBtn'),
  resetBtn: document.getElementById('resetBtn'),
};

bind();
render();

function bind() {
  el.compact.checked = state.compact;
  el.showNotes.checked = state.showNotes;
  el.search.value = state.search;

  el.compact.addEventListener('change', () => update({ compact: el.compact.checked }));
  el.showNotes.addEventListener('change', () => update({ showNotes: el.showNotes.checked }));
  el.search.addEventListener('input', () => update({ search: el.search.value }));

  el.exportBtn.addEventListener('click', exportJSON);
  el.importInput.addEventListener('change', importJSON);
  el.addTaskBtn.addEventListener('click', () => {
    if (!state.selectedDayId) return;
    mutateDay(state.selectedDayId, (d) => d.tasks.push(task()));
  });
  el.resetBtn.addEventListener('click', () => {
    update({ days: buildDefaults(), selectedDayId: null, search: '' });
    state.selectedDayId = state.days[0]?.id || null;
    save();
    render();
  });
}

function render() {
  renderSummary();
  renderTimeline();
  renderDayPanel();
}

function renderSummary() {
  const counts = {};
  state.days.forEach((d) => (counts[d.city] = (counts[d.city] || 0) + 1));
  el.summary.innerHTML = Object.entries(counts)
    .map(([city, c]) => `<span class="badge">${city}: ${c}</span>`)
    .join('');
}

function renderTimeline() {
  const q = state.search.trim().toLowerCase();
  const days = !q
    ? state.days
    : state.days.filter((d) => {
        if (`${d.dateLabel} ${d.title} ${d.city}`.toLowerCase().includes(q)) return true;
        return d.tasks.some((t) => `${t.time} ${t.title} ${t.notes} ${t.tag}`.toLowerCase().includes(q));
      });

  el.timeline.innerHTML = '';
  days.forEach((d, index) => {
    const day = document.createElement('button');
    day.className = `day ${CITY_CLASS[d.city]} ${d.id === state.selectedDayId ? 'selected' : ''}`;
    day.innerHTML = `
      <div class="meta"><span>День ${index + 1}</span><span>${d.dateLabel}</span></div>
      <div class="city">${d.city}</div>
      <div class="title">${d.title}</div>
      ${state.compact ? '' : renderPreview(d.tasks)}
    `;
    day.onclick = () => update({ selectedDayId: d.id });
    day.ondragover = (e) => e.preventDefault();
    day.ondrop = (e) => {
      e.preventDefault();
      const payload = JSON.parse(e.dataTransfer.getData('text/plain') || '{}');
      if (payload.fromDayId && payload.taskId) moveTask(payload.fromDayId, d.id, payload.taskId);
    };
    el.timeline.appendChild(day);
  });
}

function renderPreview(tasks) {
  if (!tasks.length) return '<small>Нет задач</small>';
  const view = tasks
    .slice(0, 3)
    .map((t) => `<small>${t.time ? `${t.time} · ` : ''}${escapeHtml(t.title || '(без названия)')}</small>`)
    .join('');
  return view + (tasks.length > 3 ? `<small>+ ещё ${tasks.length - 3}</small>` : '');
}

function renderDayPanel() {
  const d = state.days.find((x) => x.id === state.selectedDayId);
  if (!d) {
    el.dayDetails.textContent = 'Выберите день в ленте сверху.';
    el.tasks.innerHTML = '';
    return;
  }

  el.dayDetails.innerHTML = `
    <div><b>${d.dateLabel} · ${d.title}</b></div>
    <div class="tip">Перетаскивайте задачи на другие дни в верхней ленте.</div>
  `;

  const sorted = [...d.tasks].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  el.tasks.innerHTML = '';
  sorted.forEach((t) => {
    const row = document.createElement('div');
    row.className = 'task';
    row.draggable = true;
    row.ondragstart = (e) => {
      row.classList.add('dragging');
      e.dataTransfer.setData('text/plain', JSON.stringify({ fromDayId: d.id, taskId: t.id }));
    };
    row.ondragend = () => row.classList.remove('dragging');

    row.innerHTML = `
      <div class="row">
        <input type="time" value="${t.time || ''}" />
        <input type="text" placeholder="Задача" value="${escapeAttr(t.title || '')}" />
        <div>
          <input type="text" placeholder="Тег" value="${escapeAttr(t.tag || '')}" />
          <button class="secondary">Удалить</button>
        </div>
      </div>
      ${state.showNotes ? `<textarea placeholder="Заметки">${escapeHtml(t.notes || '')}</textarea>` : ''}
    `;

    const [timeInput, titleInput, tagInput, deleteBtn] = row.querySelectorAll('input, button');
    const noteInput = row.querySelector('textarea');

    timeInput.oninput = () => patchTask(d.id, t.id, { time: timeInput.value });
    titleInput.oninput = () => patchTask(d.id, t.id, { title: titleInput.value });
    tagInput.oninput = () => patchTask(d.id, t.id, { tag: tagInput.value });
    if (noteInput) noteInput.oninput = () => patchTask(d.id, t.id, { notes: noteInput.value });
    deleteBtn.onclick = () => {
      mutateDay(d.id, (day) => (day.tasks = day.tasks.filter((x) => x.id !== t.id)));
    };

    el.tasks.appendChild(row);
  });
}

function patchTask(dayId, taskId, patch) {
  mutateDay(dayId, (d) => {
    d.tasks = d.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t));
  }, false);
}

function moveTask(fromDayId, toDayId, taskId) {
  if (fromDayId === toDayId) return;
  const from = state.days.find((d) => d.id === fromDayId);
  const to = state.days.find((d) => d.id === toDayId);
  if (!from || !to) return;
  const idx = from.tasks.findIndex((t) => t.id === taskId);
  if (idx < 0) return;
  const [item] = from.tasks.splice(idx, 1);
  to.tasks.push(item);
  save();
  render();
}

function mutateDay(dayId, mutator, rerender = true) {
  const d = state.days.find((x) => x.id === dayId);
  if (!d) return;
  mutator(d);
  save();
  if (rerender) render();
}

function update(patch) {
  Object.assign(state, patch);
  save();
  render();
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'japan-trip-planner.json';
  link.click();
  URL.revokeObjectURL(link.href);
}

function importJSON(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!parsed.days) return;
      Object.assign(state, parsed);
      if (!state.selectedDayId) state.selectedDayId = state.days[0]?.id || null;
      save();
      render();
    } catch {
      alert('Некорректный JSON');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function buildDefaults() {
  const entries = [
    ['31.08', 'Вылет', CITY.FLIGHT],
    ['01.09', 'Прилёт KIX + Дотонбори', CITY.OSAKA],
    ['02.09', 'Осака центр', CITY.OSAKA],
    ['03.09', 'Осака юг', CITY.OSAKA],
    ['04.09', 'Нара (day trip)', CITY.NARA],
    ['05.09', 'Киото восток', CITY.KYOTO],
    ['06.09', 'Киото Арасияма', CITY.KYOTO],
    ['07.09', 'Киото север / спокойно', CITY.KYOTO],
    ['08.09', 'Осака (свободный)', CITY.OSAKA],
    ['09.09', 'Ночной автобус 21:00', CITY.BUS],
    ['10.09', 'Токио (07:00 прибытие)', CITY.TOKYO],
    ['11.09', 'Shibuya / Harajuku / Shinjuku', CITY.TOKYO],
    ['12.09', 'Odaiba / TeamLab', CITY.TOKYO],
    ['13.09', 'Выезд: Hakone / Fuji', CITY.TOKYO],
    ['14.09', 'Выезд: Kamakura / Nikko', CITY.TOKYO],
    ['15.09', 'Токио свободный день', CITY.TOKYO],
    ['16.09', 'Вылет HND 08:40', CITY.FLIGHT],
  ];

  return entries.map(([dateLabel, title, city], idx) => ({
    id: uid(),
    dateLabel,
    title,
    city,
    tasks: seedTasks(idx),
  }));
}

function seedTasks(i) {
  if (i === 1) return [
    task('19:30', 'KIX → Нанба', 'Nankai / Limousine', 'логистика'),
    task('21:00', 'Дотонбори прогулка', 'Лёгкий вечер после перелёта', 'вечер'),
  ];
  if (i === 9) return [task('21:00', 'Автобус Осака → Токио', 'Прибытие около 07:00', 'логистика')];
  if (i === 16) return [task('05:45', 'Выезд в HND', 'Запас по времени', 'логистика')];
  return [];
}

function task(time = '', title = '', notes = '', tag = '') {
  return { id: uid(), time, title, notes, tag };
}
function uid() { return Math.random().toString(16).slice(2) + Date.now().toString(16); }
function load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } }
function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
function escapeHtml(s) { return String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }
function escapeAttr(s) { return escapeHtml(s).replaceAll('"', '&quot;'); }

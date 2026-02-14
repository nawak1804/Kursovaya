const CITY = { OSAKA:'Осака', KYOTO:'Киото', NARA:'Нара', TOKYO:'Токио', BUS:'Ночной автобус', FLIGHT:'Перелёт' };
const CITY_ICON = { [CITY.OSAKA]:'🏮',[CITY.KYOTO]:'⛩️',[CITY.NARA]:'🦌',[CITY.TOKYO]:'🗼',[CITY.BUS]:'🚌',[CITY.FLIGHT]:'✈️' };
const CITY_CLASS = { [CITY.OSAKA]:'city-osaka',[CITY.KYOTO]:'city-kyoto',[CITY.NARA]:'city-nara',[CITY.TOKYO]:'city-tokyo',[CITY.BUS]:'city-bus',[CITY.FLIGHT]:'city-flight' };
const WALLS = ['original','retro','aero','anime','techno'];

const STORE_KEY = 'jp_planner_v6';
const SYNC_KEY = 'jp_planner_sync_cfg';
const clientId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
const undoStack = [];
const redoStack = [];

const state = load() || {
  compact:false, showNotes:true, search:'', activeTab:'moves', theme:'light', dayView:'list', wallpaper:'original', customWallpaper:'',
  selectedDayId:null, days:makeDefaultDays(), activityLog: [], comments: []
};
if (!state.selectedDayId) state.selectedDayId = state.days[0]?.id || null;
if (!Array.isArray(state.activityLog)) state.activityLog = [];
if (!Array.isArray(state.comments)) state.comments = [];

const syncState = { config:loadSyncConfig(), connected:false, app:null, db:null, ref:null, unsub:null, mutePush:false, lastRemoteTs:0 };

const el = {
  themeToggle: byId('themeToggle'), viewModeBtn: byId('viewModeBtn'), undoBtn: byId('undoBtn'), redoBtn: byId('redoBtn'), activityLog: byId('activityLog'),
  backToTop: byId('backToTop'), overallRating: byId('overallRating'), commentName: byId('commentName'), commentRating: byId('commentRating'),
  commentText: byId('commentText'), addCommentBtn: byId('addCommentBtn'), commentList: byId('commentList'), wallpaperBtns: byId('wallpaperBtns'), wallpaperUpload: byId('wallpaperUpload'),
  clockMsk: byId('clockMsk'), clockJst: byId('clockJst'), timeMsk: byId('timeMsk'), timeJst: byId('timeJst'), radioSelect: byId('radioSelect'), radioPlayer: byId('radioPlayer'),
  sideAd: byId('sideAd'), bottomAd: byId('bottomAd'), fullscreenNudge: byId('fullscreenNudge'), closeNudge: byId('closeNudge'),
  compact: byId('compact'), showNotes: byId('showNotes'), search: byId('search'), exportBtn: byId('exportBtn'), importInput: byId('importInput'),
  settingsBtn: byId('settingsBtn'), summary: byId('summary'), timeline: byId('timeline'), selectedCityBadge: byId('selectedCityBadge'), addTaskBtn: byId('addTaskBtn'),
  dayHeader: byId('dayHeader'), tasks: byId('tasks'), tabContent: byId('tabContent'), settingsModal: byId('settingsModal'), closeSettings: byId('closeSettings'),
  settingsDays: byId('settingsDays'), addDayBtn: byId('addDayBtn'), resetBtn: byId('resetBtn'), kyotoNightBtn: byId('kyotoNightBtn'), syncBtn: byId('syncBtn'),
  syncModal: byId('syncModal'), closeSync: byId('closeSync'), fbApiKey: byId('fbApiKey'), fbAuthDomain: byId('fbAuthDomain'), fbDbUrl: byId('fbDbUrl'),
  fbProjectId: byId('fbProjectId'), fbAppId: byId('fbAppId'), fbPath: byId('fbPath'), connectSync: byId('connectSync'), disconnectSync: byId('disconnectSync'), syncStatus: byId('syncStatus')
};

init();

function init() {
  applyTheme();
  applyWallpaper();
  renderWallpaperButtons();

  el.themeToggle.checked = state.theme === 'dark';
  el.compact.checked = state.compact;
  el.showNotes.checked = state.showNotes;
  el.search.value = state.search;

  el.themeToggle.onchange = () => applyChange('Переключение темы', () => { state.theme = el.themeToggle.checked ? 'dark' : 'light'; applyTheme(); });
  el.viewModeBtn.onclick = () => { state.dayView = state.dayView === 'list' ? 'timeline' : 'list'; save(); renderSelectedDay(); updateViewModeBtn(); };
  el.compact.onchange = () => patchState({ compact: el.compact.checked });
  el.showNotes.onchange = () => patchState({ showNotes: el.showNotes.checked });
  el.search.oninput = () => patchState({ search: el.search.value });
  el.exportBtn.onclick = exportJSON;
  el.importInput.onchange = importJSON;
  el.addTaskBtn.onclick = () => state.selectedDayId && applyChange('Добавлена задача', () => getDay(state.selectedDayId)?.tasks.push(makeTask()));
  el.undoBtn.onclick = undo;
  el.redoBtn.onclick = redo;

  el.addCommentBtn.onclick = addComment;
  el.wallpaperUpload.onchange = uploadWallpaper;

  el.radioPlayer.src = el.radioSelect.value;
  el.radioSelect.onchange = () => { el.radioPlayer.src = el.radioSelect.value; el.radioPlayer.play().catch(()=>{}); };

  el.settingsBtn.onclick = () => openModal(el.settingsModal, true);
  el.closeSettings.onclick = () => openModal(el.settingsModal, false);
  el.settingsModal.querySelector('.modal-backdrop').onclick = () => openModal(el.settingsModal, false);
  el.syncBtn.onclick = () => openModal(el.syncModal, true);
  el.closeSync.onclick = () => openModal(el.syncModal, false);
  el.syncModal.querySelector('.modal-backdrop').onclick = () => openModal(el.syncModal, false);
  document.querySelectorAll('.tab').forEach((tab) => tab.onclick = () => { state.activeTab = tab.dataset.tab; save(); renderTabs(); });

  el.addDayBtn.onclick = () => applyChange('Добавлен новый день', () => { const nd={id:uid(),dateLabel:nextDateLabel(),title:'Новый день',city:CITY.OSAKA,tasks:[]}; state.days.push(nd); state.selectedDayId=nd.id; });
  el.resetBtn.onclick = () => applyChange('Сброс к базовому плану', () => { state.days = makeDefaultDays(); state.selectedDayId = state.days[0]?.id || null; });
  el.kyotoNightBtn.onclick = () => applyChange('Добавлена ночёвка в Киото', () => { const t = state.days.find((d)=>d.title.includes('свободный')&&d.city===CITY.OSAKA); if(t){t.city=CITY.KYOTO;t.title='Киото (ночёвка)';} });

  el.connectSync.onclick = connectSync;
  el.disconnectSync.onclick = disconnectSync;
  fillSyncForm();
  renderSyncStatus('Sync не подключен');

  window.addEventListener('scroll', onScroll);
  el.backToTop.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  document.querySelectorAll('.ad-close').forEach((b)=>b.onclick=()=>closeAd(b.dataset.ad));
  el.closeNudge.onclick = () => el.fullscreenNudge.classList.add('hidden');

  setInterval(drawClocks, 1000);
  drawClocks();
  startAdTimers();

  render();
  if (syncState.config?.apiKey) connectSync(true);
}

function onScroll(){ el.backToTop.classList.toggle('show', window.scrollY > 380); }
function updateViewModeBtn(){ el.viewModeBtn.textContent = state.dayView === 'list' ? 'Таймлайн по часам' : 'Режим карточек'; }
function applyTheme(){ document.body.setAttribute('data-theme', state.theme === 'dark' ? 'dark' : 'light'); }
function applyWallpaper(){ document.body.setAttribute('data-wall', state.wallpaper || 'original'); if(state.customWallpaper && state.wallpaper==='custom'){ document.body.style.backgroundImage = `url(${state.customWallpaper})`; } else { document.body.style.backgroundImage=''; }}

function render(){ renderSummary(); renderTimeline(); renderSelectedDay(); renderTabs(); renderSettingsDays(); renderActivityLog(); renderComments(); renderOverallRating(); updateViewModeBtn(); }

function renderWallpaperButtons(){
  el.wallpaperBtns.innerHTML = '';
  const labels = { original:'Оригинальный', retro:'Ретро стиль', aero:'Aero стиль', anime:'Аниме', techno:'Крутой стиль техно' };
  WALLS.forEach((w)=>{
    const b=document.createElement('button'); b.className='btn wall-btn'; b.textContent=labels[w];
    b.onclick=()=>applyChange('Смена обоев',()=>{state.wallpaper=w; applyWallpaper();});
    el.wallpaperBtns.appendChild(b);
  });
}

function uploadWallpaper(e){
  const f = e.target.files?.[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>applyChange('Загружены пользовательские обои',()=>{state.customWallpaper=String(r.result); state.wallpaper='custom'; applyWallpaper();});
  r.readAsDataURL(f); e.target.value='';
}

function drawClocks(){
  const now = new Date();
  const msk = new Date(now.toLocaleString('en-US',{timeZone:'Europe/Moscow'}));
  const jst = new Date(now.toLocaleString('en-US',{timeZone:'Asia/Tokyo'}));
  drawClockOnCanvas(el.clockMsk, msk); drawClockOnCanvas(el.clockJst, jst);
  el.timeMsk.textContent = msk.toLocaleTimeString('ru-RU');
  el.timeJst.textContent = jst.toLocaleTimeString('ru-RU');
}
function drawClockOnCanvas(canvas,date){
  const ctx=canvas.getContext('2d'); const w=canvas.width; const c=w/2; ctx.clearRect(0,0,w,w);
  ctx.beginPath(); ctx.arc(c,c,c-6,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,.25)'; ctx.fill(); ctx.strokeStyle='rgba(120,140,180,.6)'; ctx.stroke();
  for(let i=0;i<12;i++){ const a=i*Math.PI/6; ctx.beginPath(); ctx.moveTo(c+Math.cos(a)*(c-18),c+Math.sin(a)*(c-18)); ctx.lineTo(c+Math.cos(a)*(c-10),c+Math.sin(a)*(c-10)); ctx.stroke(); }
  const h=date.getHours()%12,m=date.getMinutes(),s=date.getSeconds();
  hand(ctx,c,(h+m/60)*Math.PI/6-Math.PI/2,c-34,4); hand(ctx,c,(m+s/60)*Math.PI/30-Math.PI/2,c-22,3); hand(ctx,c,s*Math.PI/30-Math.PI/2,c-18,1.5,'#ef4444');
}
function hand(ctx,c,a,len,w,color){ ctx.beginPath(); ctx.moveTo(c,c); ctx.lineTo(c+Math.cos(a)*len,c+Math.sin(a)*len); ctx.lineWidth=w; ctx.strokeStyle=color||'#111'; ctx.stroke(); }

function startAdTimers(){
  showAds();
  setInterval(()=>showAds(), 60000);
  setInterval(()=>{ el.fullscreenNudge.classList.remove('hidden'); }, 300000);
}
function showAds(){ el.sideAd.classList.remove('hidden'); el.bottomAd.classList.remove('hidden'); }
function closeAd(type){ if(type==='side') el.sideAd.classList.add('hidden'); if(type==='bottom') el.bottomAd.classList.add('hidden'); setTimeout(showAds,60000); }

function renderSummary(){
  const map = new Map(); state.days.forEach((d)=>map.set(d.city,(map.get(d.city)||0)+1));
  el.summary.innerHTML = [...map.entries()].map(([city,c])=>`<span class='badge'>${CITY_ICON[city]} ${city}: ${c}</span>`).join('');
}
function renderTimeline(){
  const q=state.search.trim().toLowerCase();
  const days=state.days.filter((d)=>!q || `${d.dateLabel} ${d.title} ${d.city}`.toLowerCase().includes(q) || d.tasks.some((t)=>`${t.time} ${t.title} ${t.notes} ${t.tag} ${t.mapUrl||''}`.toLowerCase().includes(q)));
  el.timeline.innerHTML='';
  days.forEach((d,i)=>{ const card=document.createElement('button'); card.className=`day-card ${CITY_CLASS[d.city]} ${d.id===state.selectedDayId?'selected':''}`;
    card.innerHTML=`<div class='day-top'><span>День ${i+1}</span><span>${d.tasks.length} задач</span></div><div class='day-date'>${d.dateLabel}</div><span class='badge'>${CITY_ICON[d.city]} ${d.city}</span><div class='day-title'>${esc(d.title)}</div>${state.compact?'':preview(d.tasks)}`;
    card.onclick=()=>patchState({selectedDayId:d.id});
    card.ondragover=(e)=>{e.preventDefault();};
    card.ondrop=(e)=>{e.preventDefault();const p=parseJSON(e.dataTransfer.getData('text/plain')); if(p?.taskId && p?.fromDayId) moveTask(p.fromDayId,d.id,p.taskId);};
    el.timeline.appendChild(card);
  });
}
function preview(tasks){ if(!tasks.length) return `<div class='day-preview'>Нет задач</div>`; return `<div class='day-preview'>${tasks.slice(0,3).map((t)=>`<span>${t.time?`${t.time} · `:''}${esc(t.title||'(без названия)')}</span>`).join('')}</div>`; }

function renderSelectedDay(){
  const day=getDay(state.selectedDayId);
  if(!day){ el.dayHeader.textContent='Выберите день в ленте сверху.'; el.tasks.innerHTML=''; return; }
  el.selectedCityBadge.textContent=`${CITY_ICON[day.city]} ${day.city}`;
  el.dayHeader.innerHTML=`<b>${day.dateLabel} · ${esc(day.title)}</b><div class='muted'>Перетаскивайте задачи между днями.</div>`;
  if(state.dayView==='timeline') return renderHourTimeline(day);
  const sorted=[...day.tasks].sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  if(!sorted.length){ el.tasks.innerHTML=`<div class='task muted'>Пока задач нет. Нажмите «Добавить».</div>`; return; }
  el.tasks.innerHTML='';
  sorted.forEach((task)=>{
    const node=document.createElement('div'); node.className='task'; node.draggable=true;
    node.ondragstart=(e)=>e.dataTransfer.setData('text/plain',JSON.stringify({fromDayId:day.id,taskId:task.id}));
    node.innerHTML=`<div class='task-grid'><input type='time' value='${attr(task.time||'')}'/><input type='text' placeholder='Задача' value='${attr(task.title||'')}'/><input type='text' placeholder='Google Maps URL' value='${attr(task.mapUrl||'')}'/><div><input type='text' placeholder='Тег' value='${attr(task.tag||'')}'/><button class='btn'>Удалить</button></div></div>${state.showNotes?`<textarea placeholder='Заметки'>${esc(task.notes||'')}</textarea>`:''}<div class='muted'>${task.mapUrl?`<a href='${attr(task.mapUrl)}' target='_blank' rel='noreferrer'>📍 Карта</a>`:''}</div>`;
    const [timeInput,titleInput,mapInput,tagInput,delBtn]=node.querySelectorAll('input, button'); const noteInput=node.querySelector('textarea');
    timeInput.oninput=()=>updateTask(day.id,task.id,{time:timeInput.value});
    titleInput.oninput=()=>updateTask(day.id,task.id,{title:titleInput.value});
    mapInput.oninput=()=>updateTask(day.id,task.id,{mapUrl:mapInput.value});
    tagInput.oninput=()=>updateTask(day.id,task.id,{tag:tagInput.value});
    if(noteInput) noteInput.oninput=()=>updateTask(day.id,task.id,{notes:noteInput.value});
    delBtn.onclick=()=>applyChange('Удалена задача',()=>{const d=getDay(day.id); d.tasks=d.tasks.filter((t)=>t.id!==task.id);});
    el.tasks.appendChild(node);
  });
}

function renderHourTimeline(day){
  const slots=[]; for(let h=6;h<=23;h++) slots.push(`${String(h).padStart(2,'0')}:00`);
  el.tasks.innerHTML=`<div class='hour-timeline'>${slots.map((slot)=>{ const h=Number(slot.slice(0,2)); const bucket=day.tasks.filter((t)=>t.time && Number(t.time.slice(0,2))===h);
    return `<div class='hour-row'><div class='hour-label'>${slot}</div><div class='hour-content'>${bucket.map((t)=>`<div class='hour-task'><b>${esc(t.title||'(без названия)')}</b> ${t.time?`· ${t.time}`:''} ${t.mapUrl?`· <a href='${attr(t.mapUrl)}' target='_blank' rel='noreferrer'>Карта</a>`:''}</div>`).join('')}</div></div>`;
  }).join('')}</div>`;
}

function renderTabs(){
  document.querySelectorAll('.tab').forEach((t)=>t.classList.toggle('active',t.dataset.tab===state.activeTab));
  if(state.activeTab==='moves') el.tabContent.innerHTML=`<div class='note'><b>Осака → Токио</b><br>Ночной автобус 09.09 21:00 → 10.09 07:00.</div>`;
  else if(state.activeTab==='tickets') el.tabContent.innerHTML=`<div class='note'><b>Билеты</b><br>31.08 21:05 LED → 01.09 18:00 KIX, обратно 16.09.</div>`;
  else el.tabContent.innerHTML=`<div class='note'><b>Советы</b><br>Бронировать TeamLab заранее, проверить багаж ночного автобуса.</div>`;
}

function renderSettingsDays(){
  el.settingsDays.innerHTML='';
  state.days.forEach((d,i)=>{
    const item=document.createElement('div'); item.className='settings-item';
    item.innerHTML=`<div class='muted'>День ${i+1} · ${d.dateLabel}</div><div class='settings-row'><input type='text' value='${attr(d.dateLabel)}'/><select>${Object.values(CITY).map((c)=>`<option value='${attr(c)}' ${c===d.city?'selected':''}>${c}</option>`).join('')}</select></div><input type='text' value='${attr(d.title)}'/><div class='settings-actions'><button class='btn'>⬆️</button><button class='btn'>⬇️</button><button class='btn'>🗑</button></div>`;
    const [dateInput,citySelect,titleInput,upBtn,downBtn,delBtn]=item.querySelectorAll('input, select, button');
    dateInput.onchange=()=>applyChange('Изменена дата дня',()=>getDay(d.id).dateLabel=dateInput.value||d.dateLabel);
    citySelect.onchange=()=>applyChange('Изменен город дня',()=>getDay(d.id).city=citySelect.value);
    titleInput.onchange=()=>applyChange('Изменен заголовок дня',()=>getDay(d.id).title=titleInput.value);
    upBtn.onclick=()=>moveDay(i,i-1); downBtn.onclick=()=>moveDay(i,i+1); delBtn.onclick=()=>removeDay(d.id);
    el.settingsDays.appendChild(item);
  });
}

function addComment(){
  const name=(el.commentName.value||'Гость').trim();
  const rating=Number(el.commentRating.value||5);
  const text=(el.commentText.value||'').trim();
  if(!text) return;
  applyChange('Добавлен комментарий',()=>{ state.comments.push({id:uid(),name,rating,text,time:new Date().toLocaleString('ru-RU')}); });
  el.commentText.value='';
}
function renderComments(){
  el.commentList.innerHTML = state.comments.length ? state.comments.slice().reverse().map((c)=>`<div class='comment-item'><b>${esc(c.name)}</b> · ${'⭐'.repeat(c.rating)}<div>${esc(c.text)}</div><div class='muted'>${c.time}</div></div>`).join('') : `<div class='muted'>Пока отзывов нет.</div>`;
}
function renderOverallRating(){
  if(!state.comments.length){ el.overallRating.textContent='0.0'; return; }
  const avg = state.comments.reduce((s,c)=>s+Number(c.rating||0),0)/state.comments.length;
  el.overallRating.textContent = avg.toFixed(1);
}

function renderActivityLog(){
  el.activityLog.innerHTML = state.activityLog.length ? state.activityLog.slice().reverse().map((a)=>`<div class='activity-item'><span class='activity-time'>${a.time}</span>${esc(a.text)}</div>`).join('') : `<div class='activity-item muted'>Пока действий нет.</div>`;
}
function addActivity(text){ state.activityLog.push({time:new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}), text}); if(state.activityLog.length>120) state.activityLog.shift(); }

function applyChange(label, mutator){ undoStack.push(snapshotState()); if(undoStack.length>120) undoStack.shift(); redoStack.length=0; mutator(); addActivity(label); save(); render(); pushSync(); }
function undo(){ if(!undoStack.length) return; redoStack.push(snapshotState()); restoreSnapshot(undoStack.pop()); addActivity('Undo'); save(); render(); pushSync(); }
function redo(){ if(!redoStack.length) return; undoStack.push(snapshotState()); restoreSnapshot(redoStack.pop()); addActivity('Redo'); save(); render(); pushSync(); }
function snapshotState(){ return JSON.stringify(state); }
function restoreSnapshot(s){ Object.assign(state, JSON.parse(s)); applyTheme(); applyWallpaper(); }

function moveDay(fromIdx,toIdx){ if(toIdx<0||toIdx>=state.days.length) return; applyChange('Перемещен день',()=>{ const [d]=state.days.splice(fromIdx,1); state.days.splice(toIdx,0,d); }); }
function removeDay(dayId){ if(state.days.length<=1) return; applyChange('Удален день',()=>{ const idx=state.days.findIndex((d)=>d.id===dayId); if(idx<0)return; state.days.splice(idx,1); if(state.selectedDayId===dayId) state.selectedDayId=state.days[Math.max(0,idx-1)]?.id||state.days[0]?.id; }); }
function moveTask(fromDayId,toDayId,taskId){ if(fromDayId===toDayId) return; applyChange('Перенос задачи между днями',()=>{ const f=getDay(fromDayId), t=getDay(toDayId); if(!f||!t) return; const idx=f.tasks.findIndex((x)=>x.id===taskId); if(idx<0)return; const [task]=f.tasks.splice(idx,1); t.tasks.push(task);}); }
function updateTask(dayId,taskId,patch){ const day=getDay(dayId); if(!day) return; day.tasks=day.tasks.map((t)=>t.id===taskId?{...t,...patch}:t); save(); renderSelectedDay(); renderTimeline(); pushSync(); }

function patchState(patch){ Object.assign(state,patch); save(); render(); }
function openModal(modal,show){ modal.classList.toggle('hidden',!show); }
function getDay(id){ return state.days.find((d)=>d.id===id); }

async function connectSync(silent=false){
  try{
    const cfg={ apiKey:(el.fbApiKey.value||syncState.config.apiKey||'').trim(), authDomain:(el.fbAuthDomain.value||syncState.config.authDomain||'').trim(), databaseURL:(el.fbDbUrl.value||syncState.config.databaseURL||'').trim(), projectId:(el.fbProjectId.value||syncState.config.projectId||'').trim(), appId:(el.fbAppId.value||syncState.config.appId||'').trim(), path:(el.fbPath.value||syncState.config.path||'sharedPlanner').trim() };
    if(!cfg.apiKey||!cfg.databaseURL||!cfg.projectId||!cfg.appId){ renderSyncStatus('Заполните Firebase config поля'); return; }
    saveSyncConfig(cfg); syncState.config=cfg;
    const appMod=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
    const dbMod=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js');
    disconnectSync(true);
    syncState.app=appMod.initializeApp(cfg,'trip-planner-'+Math.random().toString(16).slice(2,8));
    syncState.db=dbMod.getDatabase(syncState.app); syncState.ref=dbMod.ref(syncState.db,`${cfg.path}/state`);
    syncState.unsub=dbMod.onValue(syncState.ref,(snap)=>{ const r=snap.val(); if(!r?.state||!r?.updatedAt) return; if(r.clientId===clientId||r.updatedAt<=syncState.lastRemoteTs) return; syncState.lastRemoteTs=r.updatedAt; syncState.mutePush=true; Object.assign(state,r.state); if(!state.selectedDayId) state.selectedDayId=state.days[0]?.id||null; applyTheme(); applyWallpaper(); save(); render(); syncState.mutePush=false; renderSyncStatus('Sync подключен: получены изменения'); });
    syncState.connected=true; renderSyncStatus('Sync подключен'); if(!silent) openModal(el.syncModal,false); pushSync();
  }catch{ renderSyncStatus('Ошибка подключения Sync'); }
}
function disconnectSync(silent=false){ try{ if(syncState.unsub) syncState.unsub(); }catch{} syncState.connected=false; syncState.unsub=null; if(!silent) renderSyncStatus('Sync отключен'); }
async function pushSync(){ if(!syncState.connected||syncState.mutePush||!syncState.ref||!syncState.db) return; try{ const dbMod=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js'); await dbMod.set(syncState.ref,{updatedAt:Date.now(),clientId,state}); }catch{ renderSyncStatus('Не удалось отправить изменения в cloud'); }}

function fillSyncForm(){ const c=syncState.config||{}; el.fbApiKey.value=c.apiKey||''; el.fbAuthDomain.value=c.authDomain||''; el.fbDbUrl.value=c.databaseURL||''; el.fbProjectId.value=c.projectId||''; el.fbAppId.value=c.appId||''; el.fbPath.value=c.path||'sharedPlanner'; }
function renderSyncStatus(text){ el.syncStatus.textContent=text; }

function exportJSON(){ const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='japan-trip-planner.json'; a.click(); URL.revokeObjectURL(url); }
function importJSON(e){ const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ const parsed=parseJSON(String(r.result)); if(!parsed?.days?.length) return; undoStack.push(snapshotState()); Object.assign(state,parsed); if(!state.selectedDayId) state.selectedDayId=state.days[0]?.id; if(!state.theme) state.theme='light'; if(!state.dayView) state.dayView='list'; if(!Array.isArray(state.activityLog)) state.activityLog=[]; if(!Array.isArray(state.comments)) state.comments=[]; addActivity('Импортирован JSON'); applyTheme(); applyWallpaper(); save(); render(); pushSync(); }; r.readAsText(f); e.target.value=''; }

function nextDateLabel(){ const last=state.days[state.days.length-1]?.dateLabel||'01.01'; const m=last.match(/^(\d{1,2})\.(\d{1,2})$/); if(!m) return last; let d=Number(m[1])+1, mo=Number(m[2]); if(d>31){d=1;mo+=1;} if(mo>12) mo=1; return `${String(d).padStart(2,'0')}.${String(mo).padStart(2,'0')}`; }

function makeDefaultDays(){ const data=[['31.08','Вылет',CITY.FLIGHT],['01.09','Прилёт KIX + Дотонбори',CITY.OSAKA],['02.09','Осака центр',CITY.OSAKA],['03.09','Осака юг',CITY.OSAKA],['04.09','Нара (day trip)',CITY.NARA],['05.09','Киото восток',CITY.KYOTO],['06.09','Киото Арасияма',CITY.KYOTO],['07.09','Киото север / спокойный день',CITY.KYOTO],['08.09','Осака (свободный день)',CITY.OSAKA],['09.09','Осака → Токио (автобус 21:00)',CITY.BUS],['10.09','Токио (07:00 прибытие)',CITY.TOKYO],['11.09','Shibuya + Harajuku + Shinjuku',CITY.TOKYO],['12.09','Odaiba / TeamLab',CITY.TOKYO],['13.09','Выезд: Hakone / Fuji',CITY.TOKYO],['14.09','Выезд: Kamakura / Nikko',CITY.TOKYO],['15.09','Токио (финальный свободный)',CITY.TOKYO],['16.09','Вылет HND 08:40',CITY.FLIGHT]];
  return data.map(([dateLabel,title,city],idx)=>({id:uid(),dateLabel,title,city,tasks:seedTasks(idx)})); }
function seedTasks(i){ if(i===1) return [makeTask('19:30','Дорога KIX → Нанба','Nankai / Limousine Bus','логистика','https://maps.google.com/?q=Namba+Station'),makeTask('21:00','Дотонбори — лёгкая прогулка','без плотного плана','вечер','https://maps.google.com/?q=Dotonbori')]; if(i===2) return [makeTask('09:00','Osaka Castle','музей внутри','must','https://maps.google.com/?q=Osaka+Castle'),makeTask('18:00','Umeda Sky Building','закат/ночной вид','view','https://maps.google.com/?q=Umeda+Sky+Building')]; if(i===9) return [makeTask('21:00','Ночной автобус Осака → Токио','прибытие ~07:00','логистика')]; if(i===16) return [makeTask('05:45','Выезд в HND','запас времени','логистика','https://maps.google.com/?q=Haneda+Airport')]; return []; }
function makeTask(time='',title='',notes='',tag='',mapUrl=''){ return {id:uid(),time,title,notes,tag,mapUrl}; }

function byId(id){ return document.getElementById(id); }
function uid(){ return Math.random().toString(16).slice(2)+Date.now().toString(16); }
function parseJSON(s){ try{return JSON.parse(s);}catch{return null;} }
function load(){ return parseJSON(localStorage.getItem(STORE_KEY)); }
function save(){ localStorage.setItem(STORE_KEY,JSON.stringify(state)); }
function loadSyncConfig(){ return parseJSON(localStorage.getItem(SYNC_KEY))||{}; }
function saveSyncConfig(cfg){ localStorage.setItem(SYNC_KEY,JSON.stringify(cfg)); }
function esc(s){ return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
function attr(s){ return esc(s).replaceAll('"','&quot;'); }

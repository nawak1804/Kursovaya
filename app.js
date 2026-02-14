const STORE_KEY='jp_planner_v7';
const CITY={OSAKA:'Осака',KYOTO:'Киото',NARA:'Нара',TOKYO:'Токио',BUS:'Ночной автобус',FLIGHT:'Перелёт'};
const ICON={Осака:'🏮',Киото:'⛩️',Нара:'🦌',Токио:'🗼','Ночной автобус':'🚌','Перелёт':'✈️'};
const STATIONS=[
  {name:'Наше Радио',url:'https://nashe1.hostingradio.ru/nashe-256',emoji:'🎸'},
  {name:'Радио Шансон',url:'https://chanson.hostingradio.ru:8041/chanson256.mp3',emoji:'🎤'},
  {name:'Радио Ваня',url:'https://radiovanya.hostingradio.ru:8000/radiovanya',emoji:'😎'},
  {name:'Радио 21',url:'https://pub0302.101.ru:8443/stream/air/mp3/256/219',emoji:'🛰️'},
  {name:'Радио Дача',url:'https://pub0301.101.ru:8443/stream/air/mp3/256/199',emoji:'🌼'},
  {name:'Дорожное',url:'https://dor2server.streamr.ru:8000/dorognoe',emoji:'🚗'},
  {name:'Радио Рекорд',url:'https://pub0302.101.ru:8443/stream/trust_128',emoji:'🔥'},
  {name:'Europa Plus',url:'https://emgregion.hostingradio.ru:8064/moscow.europaplus.mp3',emoji:'✨'}
];

const state=JSON.parse(localStorage.getItem(STORE_KEY)||'null')||{theme:'light',compact:false,search:'',dayView:'list',selectedDayId:null,days:seedDays(),comments:[],activity:[],wall:'original',customWall:'',notifSound:true,zombieStart:Date.now(),stationIndex:0};
if(!state.selectedDayId) state.selectedDayId=state.days[0].id;

const undoStack=[],redoStack=[];
const el={
  themeToggle:id('themeToggle'),compact:id('compact'),search:id('search'),exportBtn:id('exportBtn'),importInput:id('importInput'),
  timeline:id('timeline'),tasks:id('tasks'),dayHeader:id('dayHeader'),addTaskBtn:id('addTaskBtn'),viewModeBtn:id('viewModeBtn'),
  overallRating:id('overallRating'),commentName:id('commentName'),commentRating:id('commentRating'),commentText:id('commentText'),addCommentBtn:id('addCommentBtn'),commentList:id('commentList'),
  backToTop:id('backToTop'),activityLog:id('activityLog'),onlineCount:id('onlineCount'),notifStack:id('notifStack'),notifSoundBtn:id('notifSoundBtn'),
  zombieProgress:id('zombieProgress'),zombieText:id('zombieText'),
  stationName:id('stationName'),stationArt:id('stationArt'),radioSelect:id('radioSelect'),radioPlayer:id('radioPlayer'),playPause:id('playPause'),prevStation:id('prevStation'),nextStation:id('nextStation'),volumeRange:id('volumeRange'),eqCanvas:id('eqCanvas'),
  clockMsk:id('clockMsk'),clockJst:id('clockJst'),timeMsk:id('timeMsk'),timeJst:id('timeJst'),compass:id('compass'),geoText:id('geoText'),
  sideAd:id('sideAd'),bottomAd:id('bottomAd'),fullscreenNudge:id('fullscreenNudge'),closeNudge:id('closeNudge'),
  wallpaperBtns:id('wallpaperBtns'),wallpaperUpload:id('wallpaperUpload'),
  geigerValue:id('geigerValue'),geigerBar:id('geigerBar').querySelector('span'),
  snowLayer:id('snowLayer'),emojiLayer:id('emojiLayer')
};

init();
function init(){
  applyTheme(); applyWall();
  el.themeToggle.checked=state.theme==='dark'; el.compact.checked=state.compact; el.search.value=state.search;
  wire(); render();
  setInterval(drawClocks,1000); drawClocks();
  setInterval(updateOnline,2200); updateOnline();
  setInterval(pushNotification,5000);
  setInterval(updateZombie,1000); updateZombie();
  setInterval(()=>el.fullscreenNudge.classList.remove('hidden'),300000);
  setInterval(()=>{el.sideAd.classList.remove('hidden');el.bottomAd.classList.remove('hidden');},60000);
  setInterval(updateGeiger,900); updateGeiger();
  startSnow(); startEmojiReactions(); startEq(); initCompass();
}
function wire(){
  el.themeToggle.onchange=()=>change('Тема',()=>{state.theme=el.themeToggle.checked?'dark':'light';applyTheme();});
  el.compact.onchange=()=>{state.compact=el.compact.checked;save();renderTimeline();};
  el.search.oninput=()=>{state.search=el.search.value;save();renderTimeline();};
  el.exportBtn.onclick=exp; el.importInput.onchange=imp;
  el.addTaskBtn.onclick=()=>change('Добавлена задача',()=>{day().tasks.push({id:uid(),time:'',title:'',tag:'',notes:'',mapUrl:''});});
  el.viewModeBtn.onclick=()=>{state.dayView=state.dayView==='list'?'timeline':'list';save();renderSelectedDay();};
  el.addCommentBtn.onclick=addComment;
  el.backToTop.onclick=()=>window.scrollTo({top:0,behavior:'smooth'});
  window.addEventListener('scroll',()=>el.backToTop.classList.toggle('show',window.scrollY>380));
  document.querySelectorAll('.ad-close').forEach((b)=>{ b.onmouseenter=()=>geigerSpike(); b.onclick=()=>closeAdWithMath(b.dataset.ad); });
  el.closeNudge.onclick=()=>el.fullscreenNudge.classList.add('hidden');
  el.notifSoundBtn.onclick=()=>{state.notifSound=!state.notifSound;save();el.notifSoundBtn.textContent=state.notifSound?'🔊 Звук уведомлений':'🔇 Звук уведомлений';};
  initRadio(); initWalls();
}

function render(){ renderTimeline(); renderSelectedDay(); renderComments(); renderRating(); renderActivity(); el.notifSoundBtn.textContent=state.notifSound?'🔊 Звук уведомлений':'🔇 Звук уведомлений'; }
function renderTimeline(){
  const q=state.search.trim().toLowerCase();
  const days=state.days.filter(d=>!q||`${d.dateLabel} ${d.title} ${d.city}`.toLowerCase().includes(q));
  el.timeline.innerHTML='';
  days.forEach((d,i)=>{const c=document.createElement('button'); c.className=`day-card ${d.id===state.selectedDayId?'selected':''}`;
    c.innerHTML=`<div class='day-top'><span>День ${i+1}</span><span>${d.tasks.length}</span></div><div class='day-date'>${d.dateLabel}</div><div>${ICON[d.city]} ${d.city}</div><div class='day-title'>${esc(d.title)}</div>${state.compact?'':`<div class='day-preview'>${d.tasks.slice(0,2).map(t=>`<span>${t.time||''} ${esc(t.title||'')}</span>`).join('')}</div>`}`;
    c.onclick=()=>{state.selectedDayId=d.id;save();renderSelectedDay();renderTimeline();};
    c.ondragover=(e)=>e.preventDefault();
    c.ondrop=(e)=>{e.preventDefault();const p=JSON.parse(e.dataTransfer.getData('text/plain')||'{}'); if(p.taskId) moveTask(p.fromDayId,d.id,p.taskId);};
    el.timeline.appendChild(c);
  });
}
function renderSelectedDay(){
  const d=day(); if(!d){el.dayHeader.textContent='Выберите день'; return;}
  el.dayHeader.innerHTML=`<b>${d.dateLabel} · ${esc(d.title)}</b> <span class='muted'>${ICON[d.city]} ${d.city}</span>`;
  if(state.dayView==='timeline') return renderHour(d);
  const arr=[...d.tasks].sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  if(!arr.length){el.tasks.innerHTML=`<div class='task muted'>Нет задач</div>`;return;}
  el.tasks.innerHTML='';
  arr.forEach(t=>{const node=document.createElement('div'); node.className='task'; node.draggable=true; node.ondragstart=(e)=>e.dataTransfer.setData('text/plain',JSON.stringify({fromDayId:d.id,taskId:t.id}));
    node.innerHTML=`<div class='task-grid'><input type='time' value='${attr(t.time||'')}'/><input type='text' placeholder='Задача' value='${attr(t.title||'')}'/><input type='text' placeholder='Google Maps URL' value='${attr(t.mapUrl||'')}'/><div><input type='text' placeholder='Тег' value='${attr(t.tag||'')}'/><button class='btn'>Удалить</button></div></div><textarea placeholder='Заметки'>${esc(t.notes||'')}</textarea><div class='muted'>${t.mapUrl?`<a href='${attr(t.mapUrl)}' target='_blank'>📍 Карта</a>`:''}</div>`;
    const [time,title,map,tag,del]=node.querySelectorAll('input, button'); const note=node.querySelector('textarea');
    time.oninput=()=>upd(t.id,{time:time.value}); title.oninput=()=>upd(t.id,{title:title.value}); map.oninput=()=>upd(t.id,{mapUrl:map.value}); tag.oninput=()=>upd(t.id,{tag:tag.value}); note.oninput=()=>upd(t.id,{notes:note.value});
    del.onclick=()=>change('Удалена задача',()=>{d.tasks=d.tasks.filter(x=>x.id!==t.id)});
    el.tasks.appendChild(node);
  });
}
function renderHour(d){const slots=[];for(let h=6;h<=23;h++)slots.push(String(h).padStart(2,'0')+':00'); el.tasks.innerHTML=`<div class='hour-grid'>${slots.map(s=>{const h=+s.slice(0,2);const b=d.tasks.filter(t=>t.time&&+t.time.slice(0,2)===h);return`<div class='hour-row'><div class='hour-l'>${s}</div><div class='hour-c'>${b.map(t=>`<div>• ${esc(t.title||'')} ${t.mapUrl?`<a href='${attr(t.mapUrl)}' target='_blank'>Карта</a>`:''}</div>`).join('')}</div></div>`}).join('')}</div>`;}
function upd(taskId,patch){const d=day(); d.tasks=d.tasks.map(t=>t.id===taskId?{...t,...patch}:t); save(); renderTimeline();}
function moveTask(from,to,taskId){if(from===to)return;change('Перенос задачи',()=>{const f=state.days.find(x=>x.id===from), t=state.days.find(x=>x.id===to); if(!f||!t)return; const i=f.tasks.findIndex(x=>x.id===taskId); if(i<0)return; const [task]=f.tasks.splice(i,1); t.tasks.push(task);});}

function addComment(){const name=(el.commentName.value||'Гость').trim(); const rating=+el.commentRating.value; const text=(el.commentText.value||'').trim(); if(!text)return; change('Новый отзыв',()=>state.comments.push({id:uid(),name,rating,text,time:new Date().toLocaleString('ru-RU')})); el.commentText.value=''; if(rating===5){zombieSafe();}}
function renderComments(){el.commentList.innerHTML=state.comments.length?state.comments.slice().reverse().map(c=>`<div class='comment-item'><b>${esc(c.name)}</b> · ${'⭐'.repeat(c.rating)}<div>${esc(c.text)}</div><div class='muted'>${c.time}</div></div>`).join(''):`<div class='muted'>Пока отзывов нет</div>`;}
function renderRating(){if(!state.comments.length){el.overallRating.textContent='0.0';return;} const avg=state.comments.reduce((s,c)=>s+c.rating,0)/state.comments.length; el.overallRating.textContent=avg.toFixed(1);} 

function renderActivity(){el.activityLog.innerHTML=state.activity.length?state.activity.slice().reverse().map(a=>`<div class='activity-item'><span class='activity-time'>${a.t}</span>${esc(a.x)}</div>`).join(''):`<div class='activity-item muted'>Нет действий</div>`;}
function log(x){state.activity.push({t:new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}),x}); if(state.activity.length>120)state.activity.shift();}
function change(label,fn){undoStack.push(JSON.stringify(state)); if(undoStack.length>120)undoStack.shift(); redoStack.length=0; fn(); log(label); save(); render();}

id('undoBtn').onclick=()=>{if(!undoStack.length)return; redoStack.push(JSON.stringify(state)); Object.assign(state,JSON.parse(undoStack.pop())); applyTheme(); applyWall(); save(); render();};
id('redoBtn').onclick=()=>{if(!redoStack.length)return; undoStack.push(JSON.stringify(state)); Object.assign(state,JSON.parse(redoStack.pop())); applyTheme(); applyWall(); save(); render();};

function initRadio(){
  el.radioSelect.innerHTML=STATIONS.map((s,i)=>`<option value='${i}'>${s.name}</option>`).join('');
  el.radioSelect.value=String(state.stationIndex||0);
  setStation(state.stationIndex||0);
  el.playPause.onclick=()=>{if(el.radioPlayer.paused){el.radioPlayer.play().then(()=>el.playPause.textContent='⏸').catch(()=>{});}else{el.radioPlayer.pause();el.playPause.textContent='▶';}};
  el.prevStation.onclick=()=>setStation((state.stationIndex-1+STATIONS.length)%STATIONS.length,true);
  el.nextStation.onclick=()=>setStation((state.stationIndex+1)%STATIONS.length,true);
  el.radioSelect.onchange=()=>setStation(+el.radioSelect.value,true);
  el.volumeRange.oninput=()=>el.radioPlayer.volume=+el.volumeRange.value;
  el.radioPlayer.volume=+el.volumeRange.value;
}
function setStation(i,autoplay=false){state.stationIndex=i; const s=STATIONS[i]; el.radioPlayer.src=s.url; el.stationName.textContent=s.name; el.stationArt.textContent=s.emoji; el.radioSelect.value=String(i); save(); if(autoplay){el.radioPlayer.play().then(()=>el.playPause.textContent='⏸').catch(()=>{});}}
function startEq(){const c=el.eqCanvas,ctx=c.getContext('2d'); function tick(){ctx.clearRect(0,0,c.width,c.height); for(let i=0;i<42;i++){const h=18+Math.random()*78; ctx.fillStyle=`hsl(${130+i*2},85%,${45+Math.random()*20}%)`; ctx.fillRect(8+i*13,c.height-h,9,h);} requestAnimationFrame(tick);} tick();}

function initWalls(){const walls=[['original','Оригинальный'],['retro','Ретро стиль'],['aero','Aero стиль'],['anime','Аниме'],['techno','Крутой стиль техно пова']]; el.wallpaperBtns.innerHTML=''; walls.forEach(([k,t])=>{const b=document.createElement('button'); b.className='btn'; b.textContent=t; b.onclick=()=>change('Смена обоев',()=>{state.wall=k; applyWall();}); el.wallpaperBtns.appendChild(b);}); el.wallpaperUpload.onchange=(e)=>{const f=e.target.files?.[0]; if(!f)return; const r=new FileReader(); r.onload=()=>change('Загружены свои обои',()=>{state.customWall=String(r.result); state.wall='custom'; applyWall();}); r.readAsDataURL(f); e.target.value='';};}
function applyWall(){const b=document.body; b.setAttribute('data-wall',state.wall||'original'); if(state.wall==='custom'&&state.customWall){b.style.backgroundImage=`url(${state.customWall})`; b.style.backgroundSize='cover';} else {b.style.backgroundImage=''; b.style.backgroundSize='';}}

function drawClocks(){const n=new Date(); const m=new Date(n.toLocaleString('en-US',{timeZone:'Europe/Moscow'})); const j=new Date(n.toLocaleString('en-US',{timeZone:'Asia/Tokyo'})); drawClock(el.clockMsk,m); drawClock(el.clockJst,j); el.timeMsk.textContent=m.toLocaleTimeString('ru-RU'); el.timeJst.textContent=j.toLocaleTimeString('ru-RU');}
function drawClock(c,d){const x=c.getContext('2d'),w=c.width,p=w/2; x.clearRect(0,0,w,w); x.beginPath(); x.arc(p,p,p-6,0,Math.PI*2); x.fillStyle='rgba(255,255,255,.25)'; x.fill(); x.strokeStyle='rgba(120,140,180,.6)'; x.stroke(); for(let i=0;i<12;i++){const a=i*Math.PI/6; x.beginPath(); x.moveTo(p+Math.cos(a)*(p-18),p+Math.sin(a)*(p-18)); x.lineTo(p+Math.cos(a)*(p-10),p+Math.sin(a)*(p-10)); x.stroke();} hand(x,p,(d.getHours()%12+d.getMinutes()/60)*Math.PI/6-Math.PI/2,p-34,4); hand(x,p,(d.getMinutes()+d.getSeconds()/60)*Math.PI/30-Math.PI/2,p-24,3); hand(x,p,d.getSeconds()*Math.PI/30-Math.PI/2,p-18,2,'#ef4444');}
function hand(ctx,p,a,l,w,col){ctx.beginPath();ctx.moveTo(p,p);ctx.lineTo(p+Math.cos(a)*l,p+Math.sin(a)*l);ctx.lineWidth=w;ctx.strokeStyle=col||'#111';ctx.stroke();}

function initCompass(){
  let heading=0;
  if(window.DeviceOrientationEvent){ window.addEventListener('deviceorientation',(e)=>{ if(typeof e.alpha==='number'){heading=e.alpha; updateCompass(heading);} }); }
  if(navigator.geolocation){ navigator.geolocation.getCurrentPosition((pos)=>{el.geoText.textContent=`lat ${pos.coords.latitude.toFixed(2)}, lon ${pos.coords.longitude.toFixed(2)}`;},()=>{el.geoText.textContent='геолокация недоступна';}); }
  setInterval(()=>{heading=(heading+8)%360; updateCompass(heading);},1200);
}
function updateCompass(deg){el.compass.style.transform=`rotate(${deg}deg)`;}

let geiger=0.22, spikeUntil=0;
function geigerSpike(){spikeUntil=Date.now()+5000;}
function updateGeiger(){const high=Date.now()<spikeUntil; geiger=high?(1.2+Math.random()*3.2):(0.12+Math.random()*0.35); el.geigerValue.textContent=`${geiger.toFixed(2)} μSv/h`; el.geigerBar.style.width=`${Math.min(100,geiger*25)}%`; beep(high?1500:420,high?.09:.02);} 
function beep(freq,vol){if(!state.notifSound)return; const a=beep.ctx||(beep.ctx=new (window.AudioContext||window.webkitAudioContext)()); const o=a.createOscillator(),g=a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value=freq; g.gain.value=vol; o.start(); o.stop(a.currentTime+0.03);} 

function updateOnline(){el.onlineCount.textContent=String(400+Math.floor(Math.random()*201));}
function pushNotification(){const n=document.createElement('div'); n.className='notif'; n.innerHTML=`<b>Новое сообщение</b><br><small>Пользователь обновил план поездки</small>`; el.notifStack.prepend(n); while(el.notifStack.children.length>4) el.notifStack.lastChild.remove(); if(state.notifSound) beep(740,.03); setTimeout(()=>n.remove(),4200);} 

function closeAdWithMath(which){
  let allow=true;
  if(Math.random()<0.3){
    const a=Math.floor(Math.random()*9)+1,b=Math.floor(Math.random()*9)+1;
    const ans=prompt(`Решите пример для закрытия рекламы: ${a} + ${b} = ?`);
    allow=Number(ans)===(a+b);
  }
  if(!allow) return;
  const target=which==='side'?el.sideAd:el.bottomAd;
  target.classList.add('hidden');
  setTimeout(()=>target.classList.remove('hidden'),60000);
}

function updateZombie(){
  const total=5*60*1000; const passed=Math.min(total,Date.now()-state.zombieStart); const p=(passed/total)*100;
  el.zombieProgress.style.width=`${p}%`;
  if(p>=100) el.zombieText.textContent='☣ КРИТИЧЕСКАЯ СТАДИЯ: ПК под атакой зомби! Оставьте 5⭐ отзыв!';
}
function zombieSafe(){ el.zombieText.textContent='✅ Спасибо! зомби отступили'; state.zombieStart=Date.now()+5*60*1000; setTimeout(()=>{state.zombieStart=Date.now(); el.zombieText.textContent='⚠ Ваш ПК находится под атакой зомби!'; save();},5000); save(); }

function startSnow(){setInterval(()=>{const s=document.createElement('div');s.className='snow';s.textContent='❄';s.style.left=Math.random()*100+'vw';s.style.fontSize=(10+Math.random()*18)+'px';s.style.animationDuration=(6+Math.random()*8)+'s';el.snowLayer.appendChild(s);setTimeout(()=>s.remove(),16000);},160);} 
function startEmojiReactions(){const em=['🔥','😍','👍','😂','✨','🎉','⚡'];setInterval(()=>{const e=document.createElement('div');e.className='emoji-float';e.textContent=em[Math.floor(Math.random()*em.length)];e.style.right=(8+Math.random()*120)+'px';e.style.animationDuration=(4+Math.random()*4)+'s';el.emojiLayer.appendChild(e);setTimeout(()=>e.remove(),9000);},900);} 

function exp(){const b=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='planner.json';a.click();URL.revokeObjectURL(u);} 
function imp(e){const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const p=JSON.parse(String(r.result));if(!p.days?.length)return;Object.assign(state,p);applyTheme();applyWall();save();render();}catch{}};r.readAsText(f);e.target.value='';}

function seedDays(){const data=[['31.08','Вылет',CITY.FLIGHT],['01.09','Прилёт KIX + Дотонбори',CITY.OSAKA],['02.09','Осака центр',CITY.OSAKA],['03.09','Осака юг',CITY.OSAKA],['04.09','Нара (day trip)',CITY.NARA],['05.09','Киото восток',CITY.KYOTO],['06.09','Киото Арасияма',CITY.KYOTO],['07.09','Киото север',CITY.KYOTO],['08.09','Осака свободно',CITY.OSAKA],['09.09','Осака → Токио (автобус)',CITY.BUS],['10.09','Токио прибытие',CITY.TOKYO],['11.09','Shibuya / Shinjuku',CITY.TOKYO],['12.09','Odaiba / TeamLab',CITY.TOKYO],['13.09','Hakone / Fuji',CITY.TOKYO],['14.09','Kamakura / Nikko',CITY.TOKYO],['15.09','Токио свободно',CITY.TOKYO],['16.09','Вылет HND',CITY.FLIGHT]];
return data.map(([dateLabel,title,city],idx)=>({id:uid(),dateLabel,title,city,tasks:idx===1?[{id:uid(),time:'21:00',title:'Дотонбори',notes:'',tag:'вечер',mapUrl:'https://maps.google.com/?q=Dotonbori'}]:[]}));}

function day(){return state.days.find(d=>d.id===state.selectedDayId)}
function applyTheme(){document.body.setAttribute('data-theme',state.theme==='dark'?'dark':'light')}
function save(){localStorage.setItem(STORE_KEY,JSON.stringify(state))}
function id(x){return document.getElementById(x)}
function uid(){return Math.random().toString(16).slice(2)+Date.now().toString(16)}
function esc(s){return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}
function attr(s){return esc(s).replaceAll('"','&quot;')}

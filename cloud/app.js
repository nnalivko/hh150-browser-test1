'use strict';
const $=id=>document.getElementById(id),cats=['RN','EC','SPS','IGV','OGE','MR'];
let me,csrf='',packet,packetHash,answers={},revision=0,locked=false,index=0,dirty=false,saving=false,conflict=false,ref,saveTimer,pollTimer,journalKey,journalSequence=0;
const clone=x=>JSON.parse(JSON.stringify(x));
function message(text,error=false){$('status').textContent=text;$('status').className=error?'error':''}
async function api(path,data){
 if(window.RIA_REMOTE)return window.RIA_REMOTE.api(path,data);
 const response=await fetch('/api/'+path,{method:data?'POST':'GET',credentials:'same-origin',headers:data?{'Content-Type':'application/json','X-CSRF':csrf}:{},body:data?JSON.stringify(data):undefined,cache:'no-store'});
 if(!response.ok){const e=new Error((await response.json()).error);e.status=response.status;throw e}
 return response.json();
}
function key(){return 'ria-cloud-1:'+RIA_REMOTE.study+':'+me+':'+packetHash}
async function journal(){const sequence=++journalSequence,payload=JSON.stringify({user:me,packet_sha256:packetHash,revision,answers,index,dirty}),storageKey=key();try{const iv=crypto.getRandomValues(new Uint8Array(12));const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},journalKey,new TextEncoder().encode(payload)));if(sequence===journalSequence)localStorage.setItem(storageKey,JSON.stringify({iv:[...iv],cipher:[...cipher]}));return true}catch{message('Не удалось сохранить локально. Скачайте резервную копию.',true);void technical('LOCAL_STORAGE_FAILED');return false}}
function technical(code){return api('error',{code}).catch(()=>{})}
function changed(){if(locked||conflict)return;dirty=true;journal();message('Сохранено локально; ожидает синхронизации');clearTimeout(saveTimer);saveTimer=setTimeout(()=>void save(),550)}
async function save(){
 if(saving||!dirty||locked||conflict)return;
 saving=true;const sent=clone(answers),text=JSON.stringify(sent);
 try{
  const r=await api('save',{revision,answers:sent});revision=r.revision;dirty=JSON.stringify(answers)!==text;journal();
  updateCounter();message(dirty?'Есть новые изменения; синхронизация…':'Синхронизировано с сервером: '+r.saved);
 }catch(e){if(e.status===409){conflict=true;void technical('REVISION_CONFLICT');render()}else void technical('CLIENT_SAVE_FAILED');message(e.message+' — локальная копия сохранена. Скачайте её перед перезагрузкой.',true)}
 finally{saving=false;if(dirty&&!conflict)saveTimer=setTimeout(()=>void save(),3000)}
}
function complete(a,c){return a&&['0','1','?'].includes(a.code)&&(a.code!=='?'||a.reason?.trim())&&(a.code!=='1'||a.quotes?.length&&a.quotes.every(q=>q.trim()&&c.current.includes(q))&&ref.speakers.includes(a.speaker)&&ref.stances.includes(a.stance))}
function updateCounter(){if(!packet)return;const n=packet.cases.filter(c=>cats.every(cat=>complete(answers[c.case_id]?.[cat],c))).length;$('counter').textContent=`${me} · раунд 1 · единица ${index+1}/150 · завершено ${n}/150${locked?' · ПАКЕТ ЗАБЛОКИРОВАН':''}`}
function field(label,value,change,type='textarea',options=[]){
 const wrap=document.createElement('label');wrap.textContent=label;const el=document.createElement(type);if(type==='select'){for(const value of ['',...options]){const opt=document.createElement('option');opt.value=value;opt.textContent=value||'Выберите';el.append(opt)}}
 el.value=value||'';el.addEventListener('input',()=>change(el.value));wrap.append(el);return wrap;
}
function render(){
 $('packetTitle').textContent=packet?`${packet.kind==='SYNTHETIC'?'СИНТЕТИЧЕСКИЙ ТЕСТ — не эмпирические данные':'Независимое задание'} · ${packet.packet_id}`:'HOLD — утверждённый набор не импортирован';
 $('coding').querySelector('.grid').hidden=!packet;$('submit').hidden=!packet;
 if(!packet)return;
 const c=packet.cases[index],n=packet.cases.filter(c=>cats.every(cat=>complete(answers[c.case_id]?.[cat],c))).length;
 $('counter').textContent=`${me} · раунд 1 · единица ${index+1}/150 · завершено ${n}/150${locked?' · ПАКЕТ ЗАБЛОКИРОВАН':''}`;
 for(const id of ['title','previous','next','metadata','current'])$(id).textContent=c[id]||'[отсутствует]';
 $('jump').replaceChildren();packet.cases.forEach((unit,i)=>{const opt=document.createElement('option');opt.value=i;opt.textContent=`${i+1} · ${unit.case_id}`;opt.selected=i===index;$('jump').append(opt)});
 $('prev').disabled=index===0;$('nextUnit').disabled=index===149;$('answers').replaceChildren();
 for(const cat of cats){
  const a=answers[c.case_id]?.[cat]||{};const fs=document.createElement('fieldset');fs.className='category';fs.disabled=locked||conflict;
  const h=document.createElement('h3');h.textContent=cat;fs.append(h);
  const help=document.createElement('button');help.type='button';help.textContent='Определение '+cat;help.addEventListener('click',()=>{const s=ref.codebook.indexOf('### '+cat+' —');const end=ref.codebook.indexOf('\n### ',s+5);$('rules').textContent=ref.codebook.slice(s,end<0?undefined:end);$('rules').scrollIntoView({block:'nearest'})});fs.append(help);
  const set=(k,v)=>{answers[c.case_id]??={};answers[c.case_id][cat]??={};answers[c.case_id][cat][k]=v;changed()};
  const choices=document.createElement('div');choices.className='choices';for(const val of ['0','1','?']){const label=document.createElement('label'),r=document.createElement('input');r.type='radio';r.name=cat;r.value=val;r.checked=a.code===val;r.addEventListener('change',()=>set('code',val));label.append(r,document.createTextNode(val==='?'?'? — неоднозначность':val));choices.append(label)}fs.append(choices);
  fs.append(field('Точные цитаты из текущего абзаца (по одной на строку; обязательно для 1)',(a.quotes||[]).join('\n'),v=>set('quotes',v.split('\n').filter(q=>q.length))));
  fs.append(field('Говорящий (обязательно для 1)',a.speaker,v=>set('speaker',v),'select',ref.speakers));fs.append(field('Подача (обязательно для 1)',a.stance,v=>set('stance',v),'select',ref.stances));
  fs.append(field('Причина ? (обязательно при ?)',a.reason,v=>set('reason',v)));fs.append(field('Примечание / дефект единицы',a.note,v=>set('note',v)));$('answers').append(fs);
 }
 $('submit').disabled=locked||conflict;$('rules').textContent=ref.codebook;
}
async function boot(){
 const identity=await api('me');me=identity.user;csrf=identity.csrf;journalKey=await crypto.subtle.importKey('raw',new Uint8Array(identity.journal_key.match(/../g).map(v=>parseInt(v,16))),'AES-GCM',false,['encrypt','decrypt']);$('identity').textContent=me;$('login').hidden=true;$('app').hidden=false;$('logout').hidden=false;
 $('dashboardTab').hidden=!['admin','coder_1'].includes(me);$('workTab').hidden=me==='admin';$('backup').hidden=me==='admin';$('restore').hidden=me==='admin';
 if(me==='admin'){showDashboard();return}
 ref=await api('reference');$('referenceId').textContent=ref.version+' · SHA-256 '+ref.sha256;
 const w=await api('work');packet=w.packet;packetHash=w.packet_sha256;answers=JSON.parse(w.work.answers);revision=w.work.revision;locked=!!w.work.locked;dirty=false;conflict=false;
 if(packet){
  const raw=localStorage.getItem(key());if(raw){const encrypted=JSON.parse(raw),j=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(encrypted.iv)},journalKey,new Uint8Array(encrypted.cipher))));if(j.user===me&&j.packet_sha256===packetHash){index=Math.max(0,Math.min(149,j.index||0));if(j.dirty&&!locked){if(j.revision===revision){answers=j.answers;dirty=true}else{conflict=true;message('Найдена несинхронизированная копия с другой ревизией. Скачайте копию; автоматическая перезапись остановлена.',true)}}}}
 }
 $('coding').hidden=false;$('dashboard').hidden=true;render();if(dirty&&!conflict)void save();else if(!conflict)message(locked?'Ваш пакет зафиксирован.':packet?'Можно продолжить работу.':'HOLD: реальная выборка не загружена.');
}
async function showDashboard(){
 $('coding').hidden=true;$('dashboard').hidden=false;try{const r=await api('progress');$('progress').replaceChildren();for(const p of r.progress){const card=document.createElement('div');card.className='progressCard';card.textContent=`${p.coder}: ${p.completed}/150 (${p.percent}%), осталось ${p.remaining}. Последняя синхронизация: ${p.last_sync||'нет'}. ${p.locked?'Зафиксировано.':'В работе.'} Техническая ошибка: ${p.technical_error||'нет'}.`;$('progress').append(card)}const ready=r.progress.every(p=>p.locked);$('export').disabled=!ready;$('exportStatus').textContent=ready?'Оба пакета заблокированы. Сначала скачайте архив.':'Экспорт чужих ответов и сравнение закрыты до фиксации обоих пакетов.'}catch(e){message(e.message,true)}
 clearTimeout(pollTimer);pollTimer=setTimeout(()=>{if(!$('dashboard').hidden)void showDashboard()},15000);
}
function download(name,data,type='application/json'){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();try{await api('login',{user:$('user').value,password:$('password').value});$('password').value='';await boot()}catch(e){message(e.message,true)}});
$('prev').onclick=()=>{index--;journal();render()};$('nextUnit').onclick=()=>{index++;journal();render()};$('jump').onchange=e=>{index=Number(e.target.value);journal();render()};
$('workTab').onclick=()=>{$('dashboard').hidden=true;$('coding').hidden=false;render()};$('dashboardTab').onclick=()=>void showDashboard();
$('fullCodebook').onclick=()=>{$('rules').textContent=ref.codebook};
$('backup').onclick=async()=>{const payload=JSON.stringify({schema:'ria-own-backup-1',user:me,packet_sha256:packetHash,revision,answers,locked,created_utc:new Date().toISOString()});const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload)))].map(x=>x.toString(16).padStart(2,'0')).join('');download(me+'-backup-'+Date.now()+'.json',JSON.stringify({payload_json:payload,sha256:hash}))};
$('restore').onclick=()=>{if(locked){message('Зафиксированный пакет восстановлением не изменяется.',true);return}$('restoreFile').click()};
$('restoreFile').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>4000000)throw Error('Слишком большой файл');const b=JSON.parse(await file.text());const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(b.payload_json)))].map(x=>x.toString(16).padStart(2,'0')).join('');if(hash!==b.sha256)throw Error('Контрольная сумма копии не совпадает');const j=JSON.parse(b.payload_json);if(j.schema!=='ria-own-backup-1'||j.user!==me||j.packet_sha256!==packetHash||j.locked)throw Error('Копия другого аккаунта/пакета или зафиксированного состояния');if(!confirm('Заменить свои текущие ответы содержимым этой резервной копии? Чужие ответы не изменятся.'))return;while(saving)await new Promise(r=>setTimeout(r,30));const live=await api('work');if(live.work.locked)throw Error('Пакет уже зафиксирован');revision=live.work.revision;answers=j.answers;conflict=false;dirty=true;journal();render();await save()}catch(err){message(err.message,true)}finally{e.target.value=''}};
$('submit').onclick=async()=>{if(!confirm('Окончательно сдать все 150 единиц? После сдачи изменение ответов невозможно.'))return;try{clearTimeout(saveTimer);while(saving)await new Promise(r=>setTimeout(r,30));await save();if(dirty||conflict)throw Error('Сначала устраните ошибку синхронизации');const r=await api('submit',{revision,answers,confirm:'LOCK_IRREVOCABLY'});revision=r.revision;locked=true;dirty=false;journal();render();message('Пакет необратимо зафиксирован. SHA-256: '+r.sha256)}catch(e){message(e.message,true)}};
let diskExportId=null;
$('export').onclick=async()=>{try{diskExportId=await RIA_REMOTE.exportToDisk();$('ackDisk').hidden=false;message('Скачайте архив и убедитесь, что он сохранён на вашем диске. Сравнение пока закрыто.')}catch(e){message(e.message,true)}};
$('ackDisk').onclick=async()=>{try{await api('ack_export',{export_id:diskExportId,confirm:'SAVED_TO_DISK'});$('comparison').hidden=false;$('ackDisk').hidden=true;message('Резервная копия подтверждена. Сравнение доступно.')}catch(e){message(e.message,true)}};
$('compare').onclick=async()=>{try{const r=await api('comparison');$('differences').replaceChildren();if(!r.differences.length){$('differences').textContent='Расхождений нет.';return}const table=document.createElement('table');for(const vals of [['Единица','Категория','coder_1','coder_2'],...r.differences.map(d=>[d.case_id,d.category,d.coder_1,d.coder_2])]){const tr=document.createElement('tr');for(const v of vals){const td=document.createElement('td');td.textContent=v;tr.append(td)}table.append(tr)}$('differences').append(table)}catch(e){message(e.message,true)}};
$('logout').onclick=async()=>{clearTimeout(saveTimer);if(dirty){await save();if(dirty){message('Есть несинхронизированная работа: скачайте резервную копию перед выходом.',true);return}}try{await api('logout',{});location.reload()}catch(e){message(e.message,true)}};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
window.addEventListener('online',()=>{if(!conflict)void save()});
void boot().catch(e=>{if(e.status!==401)message(e.message,true)});

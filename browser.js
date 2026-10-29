'use strict';
const BROWSER_VERSION='3.0-browser-test4',INSTRUMENT='HUMAN-CB-1.3-FROZEN54-RU-20261026';
const MATERIALS_SHA='00e96cd9e310fb43e05ff067971fceae7c05ef9f0a86cce1d1921b00b5ff3581';
const STORE_KEY='ria-browser-test1:'+location.pathname.replace(/index\.html$/,'');
let db,releaseLock,storageWarning='',lastBackupAt=0,packetValidated='',booted=false;
const copy=x=>JSON.parse(JSON.stringify(x)),utf8=s=>new TextEncoder().encode(s),utc=()=>new Date().toISOString();
async function digest(x){let b=typeof x==='string'?utf8(x):x;return [...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('')}
function assert(v,message){if(!v)throw Error(message)}
function object(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)}
function emptyState(){return {schema:'ria-coder-session-1',instrument_version:INSTRUMENT,revision:0,coderId:'',page:'home',training:{completed:false,keyAcknowledged:false,accepted:false,answers:{}},packet:null,responses:{},work:{caseIndex:0,catIndex:0},demo:{caseIndex:0,catIndex:0,responses:{}},locked:false,drafts:{}}}
async function validatePacket(p){
 assert(object(p),'Нужен JSON-объект задания.');const fields=['schema','instrument_version','packet_id','title','authorized_for_independent_coding','researcher_release_reference','cases'];
 assert(Object.keys(p).every(k=>fields.includes(k)),'В задании есть посторонние поля.');
 assert(p.schema==='ria-independent-packet-1'&&p.instrument_version===INSTRUMENT&&typeof p.packet_id==='string'&&p.packet_id.trim(),'Неподходящая схема/версия задания.');
 assert(p.authorized_for_independent_coding===true&&typeof p.researcher_release_reference==='string'&&p.researcher_release_reference.trim(),'HOLD: отсутствует явный допуск задания.');
 assert(Array.isArray(p.cases)&&p.cases.length===150,'Нужно ровно 150 случаев.');let seen=[new Set(),new Set(),new Set()];
 for(const c of p.cases){assert(object(c),'Неверный случай.');assert(Object.keys(c).every(k=>['case_id','article_id','paragraph_id','paragraph_sha256','title','current','previous','next','metadata','source_version'].includes(k)),'Посторонние поля случая.');assert(Object.values(c).every(v=>v===null||typeof v==='string'),'Поля случая должны быть строками.');
  ['case_id','article_id','paragraph_id'].forEach((k,i)=>{assert(c[k]&&!seen[i].has(c[k]),'Отсутствующий или повторный ID.');seen[i].add(c[k])});
  assert(c.current?.trim()&&c.source_version?.trim(),'Нет текста или версии источника.');assert(await digest(c.current)===c.paragraph_sha256?.toLowerCase(),'SHA-256 текущего абзаца не совпадает.');
  assert(c.source_version.startsWith('SYNTHETIC'),'Тестовая версия принимает только искусственные кейсы. Реальный HH150 остаётся HOLD.');
 }
}
function answerError(a,c){
 if(!object(a)||!['0','1','?'].includes(a.code))return 'Не выбран ответ.';
 if(a.code==='1'){
  if(!Array.isArray(a.quotes)||!a.quotes.length||a.quotes.some(q=>typeof q!=='string'||!q.trim()||!c.current.includes(q)))return 'Нужна дословная цитата из текущего абзаца.';
  if(!M.speakers.includes(a.speaker)||!M.stances.includes(a.stance))return 'Выберите говорящего и подачу для этой категории.';
 }
 if(a.code==='?'&&(typeof a.reason!=='string'||!a.reason.trim()))return 'Укажите причину неопределённости.';
 for(const [k,vals]of [['speaker',M.speakers],['stance',M.stances]])if(a[k]&&!vals.includes(a[k]))return 'Недопустимая атрибуция.';
 return '';
}
errorFor=answerError;
async function validateState(s,complete=false){
 assert(object(s)&&s.schema==='ria-coder-session-1'&&s.instrument_version===INSTRUMENT,'Неподходящий формат сохранения.');
 assert(Number.isInteger(s.revision)&&s.revision>=0&&typeof s.coderId==='string'&&typeof s.locked==='boolean','Повреждённые поля сохранения.');
 assert(object(s.training)&&object(s.training.answers)&&object(s.responses)&&object(s.work)&&object(s.demo)&&object(s.demo.responses),'Повреждена структура ответов/обучения.');
 for(const k of ['completed','keyAcknowledged','accepted'])assert(typeof s.training[k]==='boolean','Повреждён статус обучения.');
 for(const obj of [s.work,s.demo]){assert(Number.isInteger(obj.caseIndex)&&obj.caseIndex>=0&&Number.isInteger(obj.catIndex)&&obj.catIndex>=0&&obj.catIndex<6,'Повреждена позиция просмотра.');}
 if(s.packet){let serialized=JSON.stringify(s.packet);if(serialized!==packetValidated){await validatePacket(s.packet);packetValidated=serialized}}
 else assert(!Object.keys(s.responses).length,'Ответы без задания.');
 const casesById=new Map((s.packet?.cases||[]).map(c=>[c.case_id,c]));
 for(const [id,per]of Object.entries(s.responses)){assert(casesById.has(id)&&object(per),'Посторонний ID ответа.');for(const [cat,a]of Object.entries(per)){assert(cats.includes(cat)&&object(a),'Посторонняя категория.');assert(['','0','1','?'].includes(a.code),'Неверное значение кода.');for(const [k,v]of Object.entries(a)){assert(['code','quotes','speaker','stance','reason','note','reasonChoice','reasonDetail'].includes(k),'Постороннее поле ответа.');assert(k==='quotes'?Array.isArray(v)&&v.every(q=>typeof q==='string'):typeof v==='string','Повреждено поле ответа.');}}}
 if(complete||s.locked){assert(s.packet&&s.coderId.trim(),'Нет задания/обозначения кодировщика.');assert(['completed','keyAcknowledged','accepted'].every(k=>s.training[k]===true),'Подготовка не завершена.');for(const c of s.packet.cases)for(const cat of cats){let e=answerError(s.responses[c.case_id]?.[cat],c);assert(!e,c.case_id+', '+cat+': '+e)}}
}
function openDB(){return new Promise((resolve,reject)=>{let r=indexedDB.open('RIA_BROWSER_TEST1',1);r.onupgradeneeded=()=>r.result.createObjectStore('sessions');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function readDB(){return new Promise((resolve,reject)=>{let tx=db.transaction('sessions','readonly'),r=tx.objectStore('sessions').get(STORE_KEY);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error)})}
async function commit(n,expected){
 await validateState(n);return new Promise((resolve,reject)=>{let tx=db.transaction('sessions','readwrite'),store=tx.objectStore('sessions'),r=store.get(STORE_KEY),error;
 r.onsuccess=()=>{try{let old=r.result||emptyState();assert(!old.locked,'Итог заблокирован.');assert(old.revision===expected,'Другая вкладка изменила данные. Сделайте копию и перезагрузите.');if(old.packet)assert(JSON.stringify(old.packet)===JSON.stringify(n.packet),'Загруженное задание неизменяемо.');n.revision=expected+1;n.savedUtc=utc();store.put(n,STORE_KEY)}catch(e){error=e;tx.abort()}};
 tx.oncomplete=()=>resolve({revision:n.revision,savedUtc:n.savedUtc});tx.onabort=()=>reject(error||tx.error||Error('Запись отменена.'));tx.onerror=()=>{};
 })
}
function journal(){try{localStorage.setItem(STORE_KEY+':pending',JSON.stringify({baseRevision:S.revision,state:S}));storageWarning=''}catch(e){storageWarning='Журнал не записан: дождитесь автосохранения и скачайте копию.'}}
function savedLabel(){if(!$('saveState'))return;let el=$('saveState');if(saveError){el.textContent='Не сохранено — скачайте копию';el.className='save error';el.title=saveError}else if(saved<wanted||writing){el.textContent='Сохраняем…';el.className='save dirty'}else{el.textContent='Все изменения сохранены';el.className='save';el.title='IndexedDB этого браузера'}if($('backupReminder'))$('backupReminder').textContent=storageWarning||(Date.now()-lastBackupAt>20*60*1000?' Сделайте отдельную резервную копию.':'')}
function change(){if(!booted||S.locked)return;wanted++;saveError='';journal();savedLabel();void pump()}
async function pump(){if(writing)return;writing=true;try{while(saved<wanted){let n=wanted,payload=copy(S),x=await commit(payload,S.revision);S.revision=x.revision;S.savedUtc=x.savedUtc;saved=n;if(saved<wanted)journal();else localStorage.removeItem(STORE_KEY+':pending')}saveError=''}catch(e){saveError=e.message}finally{writing=false;savedLabel()}}
async function flush(){while(writing)await new Promise(r=>setTimeout(r,10));await pump();assert(saved===wanted,saveError||'Изменения не сохранены.')}
async function recoverJournal(){let raw=localStorage.getItem(STORE_KEY+':pending');if(!raw)return;let j;try{j=JSON.parse(raw);await validateState(j.state);assert(j.baseRevision===j.state.revision,'Повреждён журнал.')}catch(e){throw Error('Журнал требует восстановления из резервной копии: '+e.message)}
 if(S.locked){localStorage.removeItem(STORE_KEY+':pending');return}
 if(j.baseRevision===S.revision){let x=await commit(copy(j.state),S.revision);S=j.state;S.revision=x.revision;S.savedUtc=x.savedUtc;localStorage.removeItem(STORE_KEY+':pending')}
 else if(j.baseRevision<S.revision)localStorage.removeItem(STORE_KEY+':pending');else throw Error('Несогласованные ревизии журнала; данные не перезаписаны.')
}
function download(name,data,type='application/octet-stream'){let a=document.createElement('a'),url=URL.createObjectURL(new Blob([data],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}
async function makeBackup(s){let payload_json=JSON.stringify(s);return {schema:'ria-browser-backup-1',application_version:BROWSER_VERSION,instrument_version:INSTRUMENT,created_utc:utc(),payload_json,sha256:await digest(payload_json)}}
async function backup(){try{try{await flush()}catch{}let b=await makeBackup(S);download('RIA_BROWSER_BACKUP_'+Date.now()+'.json',JSON.stringify(b,null,2),'application/json');lastBackupAt=Date.now();localStorage.setItem(STORE_KEY+':lastBackup',String(lastBackupAt));savedLabel()}catch(e){alertError(e)}}
async function restoreBackup(b){assert(object(b)&&b.schema==='ria-browser-backup-1'&&b.instrument_version===INSTRUMENT&&[BROWSER_VERSION,'3.0-browser-test1','3.0-browser-test2','3.0-browser-test3'].includes(b.application_version)&&typeof b.payload_json==='string','Нужна резервная копия этой браузерной версии.');assert(await digest(b.payload_json)===b.sha256,'Резервная копия повреждена: SHA-256 не совпадает.');let n=JSON.parse(b.payload_json);await validateState(n);await flush();assert(!S.locked&&!S.packet&&!Object.keys(S.responses).length,'В профиле уже есть работа. Восстанавливайте в пустом профиле браузера, не поверх ответов.');n.revision=S.revision;let x=await commit(copy(n),S.revision);S=n;S.revision=x.revision;S.savedUtc=x.savedUtc;wanted=saved=0;localStorage.removeItem(STORE_KEY+':pending');render()}
function csvRow(a){return a.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')+'\r\n'}
async function buildExport(s){
 let result={schema:'ria-coder-results-1',instrument_version:INSTRUMENT,instrument_sha256:M.instrument_sha256,application_version:BROWSER_VERSION,coder_id:s.coderId,status:s.locked?'FINAL_LOCKED':'DRAFT',exported_utc:utc(),packet:s.packet,responses:s.responses,revision:s.revision,locked_utc:s.lockedUtc||null};
 let csv='\ufeff'+csvRow(['Кодировщик','Пакет','Случай','Статья','Абзац','Переменная','Код','Точные цитаты (JSON-массив)','Говорящий','Подача','Причина неопределённости','Наблюдения']);let loss='\ufeff'+csvRow(['case_id','category','answer_json']);let safe=v=>/^[=+\-@\t\r]/.test(String(v??''))?"'"+v:String(v??'');
 for(const c of s.packet?.cases||[])for(const cat of cats){let a=s.responses[c.case_id]?.[cat]||{};csv+=csvRow([s.coderId,s.packet.packet_id,c.case_id,c.article_id,c.paragraph_id,cat,a.code,JSON.stringify(a.quotes||[]),a.speaker,a.stance,a.reason,a.note].map(safe));loss+=csvRow([c.case_id,cat,JSON.stringify(a)])}
 const files={'Результаты.json':JSON.stringify(result,null,2),'Ответы_для_Excel.csv':csv,'Responses_lossless.csv':loss,'ПРОЧТИТЕ.txt':'Только независимые ответы; обучение и демонстрация исключены. JSON и lossless CSV сохраняют исходные строки. Excel CSV защищает от формул. Проверяйте SHA256SUMS.txt.'};let sums='';for(const [name,content]of Object.entries(files))sums+=await digest(content)+'  '+name+'\n';files['SHA256SUMS.txt']=sums;let zip=new JSZip();for(const [name,content]of Object.entries(files))zip.file(name,content);return zip.generateAsync({type:'uint8array',compression:'DEFLATE'})
}
async function exportResults(final){try{await flush();if(final&&!S.locked){await validateState(S,true);let n=copy(S);n.locked=true;n.lockedUtc=utc();let x=await commit(n,S.revision);S=n;S.revision=x.revision;S.savedUtc=x.savedUtc;localStorage.removeItem(STORE_KEY+':pending')}
 const bytes=await buildExport(copy(S)),name=(S.locked?'FINAL_':'DRAFT_')+'RIA_BROWSER_'+Date.now()+'.zip',hash=await digest(bytes);download(name,bytes,'application/zip');S.page='finish';render();$('exportPath').innerHTML='ZIP скачан. SHA-256: <code>'+hash+'</code><br><button id="downloadHash">Скачать SHA-256 ZIP</button>';$('downloadHash').onclick=()=>download(name+'.sha256',hash+'  '+name+'\n','text/plain');}catch(e){alertError(e)}}
async function closeApp(){try{await flush();$('main').innerHTML='<h1>Сеанс сохранён</h1><p>Скачайте резервную копию и закройте вкладку. Продолжение — по тому же адресу в том же профиле браузера.</p><button onclick="backup()">Скачать копию</button>';$('nav').innerHTML=''}catch(e){alertError(e)}}
async function folder(){showModal('Сохранение в браузере','<p>Ответы хранятся локально в IndexedDB этого сайта и профиля. Они не синхронизируются между браузерами. Очистка данных сайта, приватный режим, смена адреса или потеря профиля могут удалить работу.</p><p>Скачивайте отдельную копию каждые 20–30 минут и перед закрытием. Скачанные файлы находятся в загрузках браузера.</p><button onclick="backup()">Скачать резервную копию</button>')}
async function requestPersistence(){try{let yes=await navigator.storage.persist();showModal('Хранение в браузере','<p>'+ (yes?'Браузер разрешил постоянное хранение.':'Браузер не предоставил постоянное хранение.')+' Это не защищает от ручного удаления данных. Отдельные резервные копии всё равно нужны.</p>')}catch(e){alertError(e)}}
$('packetFile').onchange=async e=>{try{let f=e.target.files[0];if(!f)return;assert(f.size<=10000000,'Слишком большой файл.');await flush();assert(!S.packet&&!S.locked,'Задание уже загружено; заменить его нельзя.');let p=JSON.parse(await f.text());await validatePacket(p);let n=copy(S);n.packet=p;n.responses={};n.work={caseIndex:0,catIndex:0};let x=await commit(n,S.revision);S=n;S.revision=x.revision;S.savedUtc=x.savedUtc;go('coding')}catch(e){alertError(e)}finally{e.target.value=''}};
$('restoreFile').onchange=async e=>{try{let f=e.target.files[0];if(!f)return;assert(f.size<=16000000,'Слишком большая копия.');await restoreBackup(JSON.parse(await f.text()))}catch(e){alertError(e)}finally{e.target.value=''}};
async function browserInit(){
 assert(location.protocol==='https:'||(['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&location.protocol==='http:'),'Открытие через file:// не поддерживается. Нужна HTTPS-ссылка приложения от исследователя; Python и сервер у кодера не нужны.');
 assert(window.isSecureContext&&crypto.subtle&&indexedDB&&navigator.locks,'Браузер не поддерживает необходимые безопасное хранение/блокировку. Используйте актуальный Chrome, Edge или Firefox.');
 const r=await fetch('materials.json',{cache:'no-cache'});assert(r.ok,'Не удалось загрузить учебные материалы.');const raw=await r.arrayBuffer();assert(await digest(raw)===MATERIALS_SHA,'Изменены замороженные учебные материалы.');M=JSON.parse(new TextDecoder().decode(raw));
 const contextResponse=await fetch('training-context.json',{cache:'no-cache'});assert(contextResponse.ok,'Не удалось загрузить контекст учебных примеров.');const contextBytes=await contextResponse.arrayBuffer();assert(await digest(contextBytes)==='2f3afb111771a42d1502780fc57aab29327e29c0c3ee07ea85fa30dcff5a5f12','Изменён проверенный контекст учебных примеров.');TRAINING_CONTEXT=JSON.parse(new TextDecoder().decode(contextBytes)).examples;
 if(location.hash==='#codebook'){await startReferenceOnly();await registerOfflineCopy();return}
 await new Promise((resolve,reject)=>{navigator.locks.request(STORE_KEY,{ifAvailable:true},async lock=>{if(!lock){reject(Error('Эта работа уже открыта в другой вкладке. Закройте её и обновите страницу.'));return}resolve();await new Promise(r=>releaseLock=r)}).catch(reject)});
 db=await openDB();S=await readDB()||emptyState();await validateState(S);await recoverJournal();dataPath='Локальное хранилище браузера (IndexedDB), '+location.origin;lastBackupAt=Number(localStorage.getItem(STORE_KEY+':lastBackup')||0);booted=true;render();setInterval(savedLabel,60000);
 await registerOfflineCopy();
}
async function registerOfflineCopy(){
 try{await navigator.serviceWorker.register('sw.js',{scope:'./'});await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));$('offlineStatus').textContent='Офлайн-копия приложения готова.'}catch(e){$('offlineStatus').textContent='Офлайн-копия НЕ готова. Не отключайте интернет: '+e.message}
}

init().catch(e=>{$('fatal').textContent=e.message;$('fatal').style.display='block';$('main').innerHTML='';$('offlineStatus').textContent='Работа не начата.';appendReadOnlyLink($('fatal'))});

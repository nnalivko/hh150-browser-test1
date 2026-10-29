'use strict';
// Reference text is selected only by document headings. No case is interpreted here.
let TRAINING_CONTEXT={};
let referenceChoice='codebook',referenceFocus=null,referenceStandalone=false;
function referenceChunk(cat){
 const text=documentById('codebook').text;
 const sections=[...text.matchAll(/^### ([A-Z]+) —[^\r\n]*[\s\S]*?(?=^#{1,3} |$(?![\s\S]))/gm)];
 const found=sections.find(x=>x[1]===cat);
 if(!found)throw Error('Раздел кодбука не найден: '+cat);
 return found[0];
}
function referenceExamples(cat){
 const text=documentById('training').text;
 return [...text.matchAll(/^### ([^\r\n]+)[\s\S]*?(?=^#{1,3} |$(?![\s\S]))/gm)]
  .filter(x=>new RegExp('(?:^|[ ,])'+cat+'(?:[ =—]|$)').test(x[1])).map(x=>x[0]);
}
function referenceCurrentCategory(){
 if(!S)return null;
 if(S.page==='exercise'){const x=exercises()[ui.exercise];return x?.category||x?.text.match(/### (RN|EC|SPS|IGV|OGE|MR)/)?.[1]||null}
 if(S.page==='coding'||S.page==='demo')return ui.currentCat||null;
 if(S.page==='study'&&cats.includes(lessons()[S.training.lessonIndex||0]))return lessons()[S.training.lessonIndex||0];
 return null;
}
function referenceBody(choice){
 if(cats.includes(choice)){
  const examples=referenceExamples(choice);
  return '<div class="reader" id="referenceRule">'+md(referenceChunk(choice))+'</div>'+
   '<p class="reference-boundary">Для решения также действуют общие правила говорящего, контекста и P1–P4. '+
   '<button class="small" onclick="selectReference(\'codebook\')">Весь кодбук и P1–P4</button></p>'+
   '<details class="reference-examples"><summary>Разобранные учебные примеры '+choice+' ('+examples.length+')</summary>'+
   '<p class="tiny muted">Только ранее утверждённые учебные материалы. Это не подсказки к текущему заданию и не ключ самопроверки.</p>'+
   examples.map(x=>'<article class="reader reference-example">'+trainingExampleWithContext(x)+'</article>').join('')+'</details>';
 }
 const d=documentById(choice==='guide'?'guide':'codebook');
 return '<div class="reader" id="referenceRule">'+md(d.text)+'</div>';
}
function referenceNavigation(){return '<label for="referenceSelect">Раздел справки</label><select id="referenceSelect" onchange="selectReference(this.value)">'+
 [['codebook','Весь кодбук, включая P1–P4'],['guide','Памятка'],...cats.map(c=>[c,c+' — '+names[c]])].map(([v,t])=>'<option value="'+v+'" '+(v===referenceChoice?'selected':'')+'>'+esc(t)+'</option>').join('')+'</select>'}
function paintReference(){
 const panel=$('referencePanel');
 panel.innerHTML='<div class="reference-heading"><h2 id="referenceTitle">Кодбук и справка</h2>'+
 (referenceStandalone?'':'<button class="small" onclick="closeReference()" aria-label="Закрыть справку">Закрыть</button>')+'</div>'+
 '<p class="tiny muted">'+esc(M.instrument_version)+' · точный текст зафиксированных материалов</p>'+referenceNavigation()+
 '<div class="reference-scroll" id="referenceScroll" tabindex="0">'+referenceBody(referenceChoice)+'</div>'+
 '<div class="reference-footer">'+(referenceStandalone?'<p>Только чтение. Ответы, задания и сохранения в этой вкладке недоступны.</p>':
 '<a class="reference-newtab" href="#codebook" target="_blank" rel="noopener">Открыть кодбук в отдельной вкладке только для чтения</a>')+'</div>';
}
function openReference(choice){
 referenceChoice=choice||referenceCurrentCategory()||'codebook';
 if(!cats.includes(referenceChoice)&&!['codebook','guide'].includes(referenceChoice))referenceChoice='codebook';
 const p=$('referencePanel');if(p.hidden)referenceFocus=document.activeElement;
 paintReference();p.hidden=false;document.body.classList.add('reference-open');$('referenceSelect').focus();
}
function selectReference(choice){referenceChoice=choice;paintReference();$('referenceSelect').focus()}
function closeReference(){if(referenceStandalone)return;$('referencePanel').hidden=true;document.body.classList.remove('reference-open');if(referenceFocus?.isConnected)referenceFocus.focus()}
function appendReadOnlyLink(el){
 const p=document.createElement('p'),a=document.createElement('a');a.href='#codebook';a.target='_blank';a.rel='noopener';a.textContent='Открыть кодбук в отдельной вкладке только для чтения';p.append(a);el.append(p);
}
async function startReferenceOnly(){
 referenceStandalone=true;document.body.classList.add('reference-only');
 document.querySelector('.headright').innerHTML='<span class="pill">Только справка</span>';
 $('browserNotice').innerHTML='Кодбук — только чтение. Эта вкладка не открывает хранилище ответов и не мешает рабочей вкладке. <span id="offlineStatus">Проверяем офлайн-доступ…</span>';
 $('nav').innerHTML='';$('main').innerHTML='';referenceChoice='codebook';paintReference();$('referencePanel').hidden=false;
}
categoryHelp=function(cat){if($('modal').open)$('modal').close();openReference(cat)};
const renderBeforeReference=render;
render=function(){
 renderBeforeReference();
 if(S.page==='home'){
  const plan=document.createElement('section');plan.className='card';plan.setAttribute('aria-label','Порядок и сроки');
  plan.innerHTML='<h2>Что дальше и в каком темпе</h2><p>Сейчас — знакомство с кодбуком и техническая проверка на искусственных текстах. На чтение можно ориентировочно выделить неделю, в удобном вам темпе.</p><p>Затем — учебные задания и сверка с отдельно выданным ключом. Настоящий независимый раунд начнётся только после отдельного сообщения исследователя.</p><p>Для 150 абзацев предварительный ориентир — 10–13 часов в несколько сеансов. Это не установленная норма времени; график и дату начала согласует исследователь.</p>';
  $('main').append(plan);
 }
 const cat=referenceCurrentCategory();
 if(cat){
  const row=document.createElement('div');row.className='reference-context';
  const button=document.createElement('button');button.className='small';button.textContent=cat+' — определение и учебные примеры';button.onclick=()=>openReference(cat);
  // Native title is available on hover; the button also works by keyboard and touch.
  button.title=referenceChunk(cat).split(/\r?\n/).filter(x=>x.trim()&&!x.startsWith('#'))[0];
  row.append(button);$('main').prepend(row);
 }
 if(!$('referencePanel').hidden&&!referenceStandalone)paintReference();
};
help=function(){showModal('Как пользоваться программой','<p>Правила доступны по кнопке «Кодбук и справка» вверху и рядом с текущей категорией. Справка открывается рядом с ответами; ввод и текущий шаг сохраняются.</p><p>Для отдельного окна выберите в справке ссылку «только для чтения». Две рабочие вкладки по-прежнему защищены от одновременной записи.</p><p>Для 1 нужны дословная цитата из текущего абзаца и отдельные говорящий/подача для категории; для ? — конкретная причина. Скачивайте резервную копию перед закрытием и каждые 20–30 минут.</p><button onclick="$(\'modal\').close();openReference()">Кодбук и справка</button>')};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('referencePanel').hidden&&!referenceStandalone){e.preventDefault();closeReference()}});

function exerciseInstructions(x){
 const a=exerciseEntry(x.number),cat=referenceCurrentCategory();
 let steps;
 if(x.number==='8')steps='<li>Прочитайте вопрос и все предложенные варианты.</li><li>Выберите один вариант кнопкой. Здесь не нужно выделять цитату или заполнять говорящего.</li><li>При необходимости откройте кодбук. Нажмите «Сохранить и дальше» после своего решения.</li>';
 else if(x.number==='9')steps='<li>Для каждого короткого вопроса отдельно выберите «Да» или «Нет».</li><li>Проверьте, что отмечены все вопросы. Здесь не нужны цитаты и атрибуция.</li><li>После своих ответов нажмите «Сохранить и дальше».</li>';
 else steps='<li>Прочитайте текущий абзац. При необходимости раскройте предоставленный соседний контекст.</li><li>Оценивайте только указанную в этом упражнении категорию. Выберите «Да» (1), «Нет» (0) или «Пока не могу решить» (?).</li><li>При 1 выделите непрерывную цитату именно в текущем абзаце и нажмите «Взять выделенные слова». Затем укажите говорящего и подачу для этой категории.</li><li>При 0 цитата не обязательна. При ? выберите конкретную причину; для «Другой конкретной причины» заполните уточнение. Говорящего и подачу указывайте там, где можете установить.</li><li>Поле «Ваши наблюдения» необязательно. Нажмите «Сохранить и дальше». Если не хватает обязательного поля, программа укажет его.</li>';
 const error=exerciseValid(x);
 const status=error?'Что ещё заполнить: '+error:'Обязательные поля заполнены. Это проверка полноты записи, а не правильности ответа.';
 return '<section class="card training-instructions" aria-label="Как выполнить это задание"><h2>Как выполнить это задание</h2><ol>'+steps+'</ol>'+
 '<p>Точное правило можно открыть здесь — вторую рабочую вкладку создавать не нужно.</p>'+
 (cat?'<details class="training-rule"><summary>'+esc(cat)+' — определение и границы из кодбука</summary><div class="reader">'+md(referenceChunk(cat))+'</div></details>':'')+
 '<button class="small" onclick="openReference('+ (cat?"'"+cat+"'":'') +')">Открыть кодбук и справку</button>'+
 '<p class="notice" id="exerciseHelpStatus" role="status">'+esc(status)+'</p><p class="tiny muted">Сначала сохраните собственные учебные ответы. Отдельный ключ получите у исследователя после выполнения упражнений; программа не показывает правильный вариант.</p></section>';
}
const renderBeforeTrainingInstructions=render;
render=function(){
 renderBeforeTrainingInstructions();
 if(S.page==='exercise'){
  const x=exercises()[Math.min(ui.exercise,exercises().length-1)];
  const holder=document.createElement('div');holder.innerHTML=exerciseInstructions(x);
  const card=$('main').querySelector('.card');$('main').insertBefore(holder.firstElementChild,card);
 }
};
function refreshExerciseHelpStatus(){
 const el=$('exerciseHelpStatus');if(!el||!S||S.page!=='exercise')return;
 const x=exercises()[Math.min(ui.exercise,exercises().length-1)],error=exerciseValid(x);
 el.textContent=error?'Что ещё заполнить: '+error:'Обязательные поля заполнены. Это проверка полноты записи, а не правильности ответа.';
}
document.addEventListener('input',refreshExerciseHelpStatus);
document.addEventListener('change',refreshExerciseHelpStatus);

function trainingExampleWithContext(text){
 const id=text.match(/AI_FIRST50_\d+/)?.[0],c=TRAINING_CONTEXT[id];
 if(!c)return md(text);
 return '<div class="notice">Показан восстановленный исторический контекст того же учебного примера. Утверждённая оценка относится только к '+esc(c.category)+'='+esc(c.approved_code)+'.</div>'+
  '<p><b>Заголовок:</b> '+esc(c.title)+'</p><div class="eyebrow">Полный текущий абзац</div><div class="current training-restored-current" data-record="'+id+'">'+esc(c.current)+'</div>'+
  '<details class="training-restored-context" open><summary>Соседние абзацы — разрешённый контекст</summary><b>Предыдущий абзац</b><div class="context training-restored-previous">'+esc(c.previous||'[отсутствует]')+'</div><b>Следующий абзац</b><div class="context training-restored-next">'+esc(c.next||'[отсутствует]')+'</div></details>'+
  '<div class="notice"><b>Рассматриваемый фрагмент и зафиксированное объяснение</b><div class="reader">'+md(text)+'</div></div>'+
  '<p class="tiny muted">Сначала прочитайте весь текущий абзац. Соседний контекст помогает установить говорящего и смысл, но не заменяет признак в текущем абзаце. Другие пять оценок эта карточка не задаёт.</p>'+
  '<details><summary>Данные исторического источника</summary><p class="path">Дата: '+esc(c.published_at)+'<br>Авторы: '+esc(c.authors.join(', ')||'[не указаны]')+'<br>Статья: '+esc(c.article_id)+'<br>Исходный идентификатор абзаца: '+esc(c.paragraph_id)+'<br>SHA-256 текущего текста: '+esc(c.current_sha256)+'</p><p>'+esc(c.source_note)+'</p></details>';
}
const exampleStudyBeforeRestoredContext=exampleStudy;
exampleStudy=function(){
 const xs=M.trainingCards||[],i=Math.min(S.training.exampleIndex||0,xs.length-1),x=xs[i];
 if(!TRAINING_CONTEXT[x?.text.match(/AI_FIRST50_\d+/)?.[0]])return exampleStudyBeforeRestoredContext();
 return '<h1>Посмотрим на примерах</h1><p class="muted">Пример '+(i+1)+' из '+xs.length+'. Это обучение: решение и объяснение уже показаны.</p><div class="progress"><span style="width:'+100*(i+1)/xs.length+'%"></span></div><div class="card reader">'+trainingExampleWithContext(x.text)+'</div><div class="footer-actions"><button onclick="exampleBack()">Назад</button><button class="primary" onclick="exampleNext()">'+(i+1===xs.length?'Теперь попробовать самостоятельно':'Следующий пример')+'</button></div><button class="quiet small" onclick="showDoc(\'training\')">Все утверждённые примеры целиком</button>';
};
const showDocBeforeRestoredContext=showDoc;
showDoc=function(id){
 if(id!=='training')return showDocBeforeRestoredContext(id);
 const d=documentById('training');
 showModal(d.title,'<div class="reader">'+d.text.split(/(?=^### )/m).map(trainingExampleWithContext).join('')+'</div>');
};

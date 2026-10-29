'use strict';
// Reference text is selected only by document headings. No case is interpreted here.
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
   examples.map(x=>'<article class="reader reference-example">'+md(x)+'</article>').join('')+'</details>';
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

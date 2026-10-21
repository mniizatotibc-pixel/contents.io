(()=>{'use strict';
const BULB='<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4M9 15c0-2-3-3-3-6a6 6 0 0 1 12 0c0 3-3 4-3 6v1H9zM12 1v-1M3 3l-1-1M21 3l1-1M2 10H0M22 10h2"/></svg>';
const DATA=window.KOTOMAS_DATA, $=id=>document.getElementById(id);
const KEYS=DATA.config.keys;
const bank=Object.fromEntries(DATA.words.map(w=>[w.id,w]));
const boards=DATA.boards.map(b=>({...b,words:b.words.map(w=>({...bank[w.id],...w}))}));
const levelName=l=>DATA.config.levels[l]||'過去の盤面';
const norm=s=>s.normalize('NFKC').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-96)).replace(/[ゃゅょぁぃぅぇぉっゎ]/g,c=>({'ゃ':'や','ゅ':'ゆ','ょ':'よ','ぁ':'あ','ぃ':'い','ぅ':'う','ぇ':'え','ぉ':'お','っ':'つ','ゎ':'わ'}[c])).replace(/\s/g,'');
const cells=w=>Array.from(w.answer,(ch,i)=>({key:`${w.r+(w.d?i:0)},${w.c+(w.d?0:i)}`,ch}));
const title=w=>`${w.d?'タテ':'ヨコ'}の${w.n}`;
const format=ms=>`${String(Math.floor(ms/60000)).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`;
let storageOK=true,warning='';
function read(key,fallback){try{let s=localStorage.getItem(key);return s?JSON.parse(s):fallback}catch{storageOK=false;return fallback}}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{storageOK=false;warning='このブラウザでは保存できません。ページを閉じると進み具合が失われます。';$('saveStatus').textContent=warning;return false}}
function objectRead(key){const v=read(key,{});return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}
function getRecords(){const v=read(KEYS.records,[]);return Array.isArray(v)?v.filter(r=>r&&Number.isFinite(r.ms)&&r.ms>=0&&Number.isInteger(r.level)&&r.level>=0&&r.level<DATA.config.levels.length&&typeof r.date==='string'):[]}
let records=getRecords(),p=boards.find(b=>b.id===read(KEYS.last,''))||boards[0];
let values={},selected=0,selectedCell=null,started=false,paused=false,done=false,elapsed=0,anchor=0,hints=new Set(),errors=new Set(),checked=new Set(),wrongQueue=[],wrongCursor=0,composing=false,returnFocus=null,gridInView=true,roundId='';
const elapsedNow=()=>elapsed+(started&&!paused&&!done?Math.max(0,Date.now()-anchor):0);
const isCorrect=w=>cells(w).every(c=>values[c.key]===c.ch);
const vkey=w=>w.kanji+'|'+w.reading;
function saveProgress(){const all=objectRead(KEYS.progress);all[p.id]={version:1,roundId,values:{...values},elapsed:elapsedNow(),hints:[...hints],checked:[...checked],started,done,selected,updated:new Date().toISOString()};const ok=write(KEYS.progress,all);write(KEYS.last,p.id);$('saveStatus').textContent=ok?'進み具合は自動保存されます。':warning;return ok}
function pause(save=true){if(started&&!done&&!paused){elapsed=elapsedNow();paused=true}closeEntry(false);$('hintOverlay').hidden=true;if(save)saveProgress();controls();paintGrid();updateReturnButton()}
function begin(){if(done)return;if(!started){started=true;paused=false;anchor=Date.now()}else if(paused){paused=false;anchor=Date.now()}saveProgress();controls()}
function controls(){$('clock').textContent=format(elapsedNow());$('start').textContent=done?'もう一度遊ぶ':started?(paused?'続きから再開':'やり直す'):'スタート';$('pause').disabled=!started||done;$('pause').textContent=paused?'再開':'一時停止';$('check').disabled=paused||done;$('boardMeta').textContent=p.title;$('wrongNext').hidden=!wrongQueue.length||done;$('wrongNext').disabled=paused;}
function buildSelectors(){
 $('level').value=String(p.level);$('board').replaceChildren();const progress=objectRead(KEYS.progress);
 boards.filter(b=>b.level===p.level).forEach(b=>{const option=document.createElement('option');option.value=b.id;const runs=records.filter(r=>r.puzzleId===b.id);let label=`${String(b.number).padStart(2,'0')}　${b.title}`;if(runs.length)label+=`　✓ ${format(Math.min(...runs.map(r=>r.ms)))}`;else if(progress[b.id]?.done)label+='　✓ クリア済み';else if(progress[b.id]?.started)label+='　途中';option.textContent=label;$('board').append(option)});$('board').value=p.id;
 const runs=records.filter(r=>r.puzzleId===p.id);$('boardRecord').textContent=runs.length?`クリア済み · ベスト ${format(Math.min(...runs.map(r=>r.ms)))}`:(progress[p.id]?.done?'クリア済み · タイム記録なし':'未クリア');
}
function paintGrid(){
 const expected={},numbers={},active=new Set(cells(p.words[selected]).map(c=>c.key));p.words.forEach(w=>{numbers[`${w.r},${w.c}`]=w.n;cells(w).forEach(c=>expected[c.key]=c.ch)});
 $('grid').replaceChildren();$('grid').style.gridTemplateColumns=`repeat(${p.cols},minmax(0,1fr))`;$('grid').style.setProperty('--cols',p.cols);
 for(let r=0;r<p.rows;r++)for(let c=0;c<p.cols;c++){const key=`${r},${c}`,exists=Object.hasOwn(expected,key),el=document.createElement(exists?'button':'div');el.className='cell'+(!exists?' block':'')+(active.has(key)&&exists?' active':'')+(selectedCell===key?' selected':'')+(errors.has(key)?' wrong':'');
 if(exists){el.type='button';el.dataset.cell=key;let n=document.createElement('small'),char=document.createElement('span');n.textContent=numbers[key]||'';char.textContent=paused?'':values[key]||'';el.append(n,char);el.setAttribute('aria-label',`${r+1}行${c+1}列 ${paused?'一時停止中':values[key]||'空欄'}`);el.addEventListener('click',()=>{if(done){$('results').scrollIntoView({behavior:'smooth'});return}const options=p.words.map((w,i)=>cells(w).some(x=>x.key===key)?i:-1).filter(i=>i>=0);const index=selectedCell===key&&options.length>1?options.find(i=>i!==selected):options.includes(selected)?selected:options[0];selectedCell=key;openEntry(index)});}else el.setAttribute('aria-hidden','true');$('grid').append(el);
 }
}
function paintClues(){
 $('clues').replaceChildren();for(const d of [1,0]){const heading=document.createElement('h3');heading.textContent=d?'タテの問題':'ヨコの問題';$('clues').append(heading);
 p.words.map((w,i)=>({w,i})).filter(x=>x.w.d===d).sort((a,b)=>a.w.n-b.w.n).forEach(({w,i})=>{const box=document.createElement('article');box.className='clue'+(selected===i?' select':'');box.id='clue-'+i;
 const pick=document.createElement('button');pick.type='button';pick.className='pick';pick.textContent=`${w.n}　${w.adapted?w.clue:'「'+w.clue+'」'}（${w.answer.length}文字）`;pick.addEventListener('click',()=>{selectedCell=cells(w)[0].key;openEntry(i)});pick.disabled=done;
 const row=document.createElement('div');row.className='clueTools';const hint=document.createElement('button');hint.type='button';hint.className='hint';hint.innerHTML=BULB;hint.setAttribute('aria-label',hints.has(i)?'ヒントを再表示':'ヒント');hint.title='ヒント';hint.disabled=done;hint.addEventListener('click',()=>showHint(i));const source=document.createElement('a');source.href=w.url;source.textContent=w.adapted?'参考':'出典';source.target='_blank';source.rel='noopener noreferrer';box.append(pick);if(w.url){box.append(source);source.className='inlineSource';}else{const label=document.createElement('span');label.className='inlineSource';label.textContent=w.sourceLabel||'単語帳';box.append(label);}box.append(hint);if(checked.has(i)&&isCorrect(w)){const status=document.createElement('span');status.className='correctLabel';status.textContent='正解';row.append(status,starButton(w));}box.append(row);$('clues').append(box)});
 }
}
function paint(){paintGrid();paintClues();controls();updateReturnButton()}
function starButton(w){const button=document.createElement('button');button.type='button';button.className='star';button.dataset.vkey=vkey(w);updateStar(button,w);button.addEventListener('click',()=>{const vocab=objectRead(KEYS.vocab),key=vkey(w);if(vocab[key])delete vocab[key];else vocab[key]={kanji:w.kanji,reading:w.reading,clue:w.clue,example:w.example,url:w.url,sourceLabel:w.sourceLabel,adapted:w.adapted,level:w.level,learned:false,addedAt:new Date().toISOString()};const saved=write(KEYS.vocab,vocab);document.querySelectorAll('button.star').forEach(b=>{const savedWord=objectRead(KEYS.vocab)[b.dataset.vkey];b.textContent=savedWord?'★ 登録済み':'☆ 覚えたい';b.setAttribute('aria-pressed',savedWord?'true':'false')});$('status').textContent=saved?(vocab[key]?'マイ語彙帳に追加しました。':'語彙帳の登録を解除しました。'):'語彙帳に保存できませんでした。';});return button}
function updateStar(button,w){const yes=!!objectRead(KEYS.vocab)[vkey(w)];button.textContent=yes?'★ 登録済み':'☆ 覚えたい';button.setAttribute('aria-pressed',yes?'true':'false');button.setAttribute('aria-label',`${w.kanji}を${yes?'語彙帳から外す':'語彙帳に登録する'}`)}
function openEntry(index){if(done)return;begin();selected=index;const w=p.words[index];paint();$('entryTitle').textContent=`${title(w)} · ${w.answer.length}文字`;$('entryClue').textContent=w.adapted?w.clue:'「'+w.clue+'」';const chars=cells(w).map(c=>values[c.key]||'');$('pattern').textContent='今のマス：'+chars.map(c=>c||'□').join(' ');$('answer').value=chars.every(Boolean)?chars.join(''):'';$('inputMessage').textContent='単語をひらがなでまとめて入力してください。';composing=false;returnFocus=document.activeElement;$('inputOverlay').hidden=false;updateReturnButton();$('answer').focus();$('answer').setSelectionRange(0,$('answer').value.length)}
function closeEntry(restore=true){$('inputOverlay').hidden=true;$('answer').blur();if(restore){const b=Array.from($('grid').querySelectorAll('button')).find(el=>el.dataset.cell===selectedCell);if(b)b.focus()}updateReturnButton()}
function showHint(index){if(done)return;begin();hints.add(index);saveProgress();$('hintTitle').textContent=`${title(p.words[index])}のヒント`;renderHint(p.words[index]);returnFocus=document.activeElement;$('hintOverlay').hidden=false;updateReturnButton();$('closeHint').focus();paintClues()}
function renderHint(w){
 const container=$('hintText');container.replaceChildren();
 const sentence=document.createElement('span');sentence.className='hintSentence';
 const parts=w.hintExample.split('{{blank}}');
 parts.forEach((part,i)=>{sentence.append(document.createTextNode(part));if(i<parts.length-1){
  const blank=document.createElement('span');blank.className='hintBlank';
  blank.setAttribute('aria-label',`頭文字は${w.answer[0]}、残り${w.answer.length-1}文字`);
  const initial=document.createElement('strong');initial.className='hintInitial';initial.textContent=w.answer[0];
  blank.append(initial,document.createTextNode('○'.repeat(w.answer.length-1)));sentence.append(blank);
 }});
 const note=document.createElement('span');note.className='hintExplanation';note.textContent='赤い文字が頭文字。○は残りの1文字です。答えは'+w.answer.length+'文字。';
 container.append(sentence,note);
}
function closeHint(){$('hintOverlay').hidden=true;updateReturnButton();if(returnFocus&&document.contains(returnFocus))returnFocus.focus()}
function invalidateChecks(){for(const i of [...checked])if(!isCorrect(p.words[i]))checked.delete(i)}
function submit(){if(composing||done||paused)return;const w=p.words[selected],answer=norm($('answer').value);if(!/^[ぁ-ゖー]+$/.test(answer)||answer.length!==w.answer.length){$('inputMessage').textContent=`ひらがな${w.answer.length}文字で入力してください。`;$('answer').focus();return}cells(w).forEach((c,i)=>{values[c.key]=answer[i];errors.delete(c.key)});invalidateChecks();closeEntry(false);saveProgress();paint();if(!$('results').hidden)renderReview(false);$('status').textContent=`${title(w)}を入力しました。`}
function erase(){cells(p.words[selected]).forEach(c=>{delete values[c.key];errors.delete(c.key)});invalidateChecks();$('answer').value='';$('pattern').textContent='今のマス：'+cells(p.words[selected]).map(()=>'□').join(' ');$('inputMessage').textContent='交差するマスも消しました。';saveProgress();paintGrid();paintClues();if(!$('results').hidden)renderReview(false);$('answer').focus()}
function renderReview(scroll=false){$('shareResult').hidden=!done||!getRecords().some(r=>r.puzzleId===p.id);$('review').replaceChildren();const solved=p.words.map((w,i)=>({w,i})).filter(x=>checked.has(x.i)&&isCorrect(x.w));$('results').hidden=!solved.length;$('resultTitle').textContent=done?'クリア！':'正解した言葉';if(!done)$('finish').textContent='覚えたい言葉を☆で語彙帳に登録できます。';for(const {w} of solved){const row=document.createElement('article');row.className='review';const head=document.createElement('div');head.className='reviewHead';const label=document.createElement('strong');label.textContent=`${w.kanji}（${w.reading}）`;head.append(label,starButton(w));const meaning=document.createElement('p');meaning.textContent=w.adapted?w.clue:'「'+w.clue+'」';const example=document.createElement('p');example.className='muted';example.textContent='例：'+w.example;row.append(head,meaning,example);$('review').append(row)}if(scroll)$('results').scrollIntoView({behavior:'smooth',block:'start'})}
function check(){if(done||paused)return;begin();errors.clear();checked.clear();wrongQueue=[];wrongCursor=0;let empty=0;const expected={};p.words.forEach((w,i)=>{cells(w).forEach(c=>expected[c.key]=c.ch);if(isCorrect(w))checked.add(i);else wrongQueue.push(i)});Object.entries(expected).forEach(([key,ch])=>{if(!values[key])empty++;else if(values[key]!==ch)errors.add(key)});
 if(wrongQueue.length){$('status').textContent=`正解 ${checked.size}／${p.words.length}語 · 空欄 ${empty}マス · 間違い ${errors.size}マス。「間違い・空欄へ」で見直せます。`;saveProgress();paint();renderReview();return}
 elapsed=elapsedNow();done=true;paused=false;records=getRecords();records.unshift({level:p.level,puzzleId:p.id,title:p.title,ms:elapsed,hints:hints.size,date:new Date().toISOString()});records=records.slice(0,200);const saved=write(KEYS.records,records);saveProgress();$('finish').textContent=`${format(elapsed)}でクリア · ヒント使用 ${hints.size}語。${saved?'記録を保存しました。':'記録を保存できませんでした。'}`;$('status').textContent='すべて正解です！';paint();renderReview(true);renderRecords();buildSelectors();awardReward();renderRewards(true)}
function nextWrong(){if(paused||done)return;const candidates=wrongQueue.filter(i=>!isCorrect(p.words[i]));if(!candidates.length){wrongQueue=[];controls();$('status').textContent='もう一度、答え合わせをしてください。';return}const i=candidates[wrongCursor%candidates.length];wrongCursor++;selectedCell=cells(p.words[i])[0].key;openEntry(i);$('inputMessage').textContent=`見直し ${((wrongCursor-1)%candidates.length)+1}／${candidates.length}語`}
function loadBoard(id){roundId=typeof crypto.randomUUID==='function'?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2);lastReward=null;p=boards.find(b=>b.id===id)||boards[0];values={};selected=0;selectedCell=null;started=false;paused=false;done=false;elapsed=0;anchor=0;hints=new Set();errors=new Set();checked=new Set();wrongQueue=[];wrongCursor=0;closeEntry(false);$('hintOverlay').hidden=true;$('results').hidden=true;
 const snap=objectRead(KEYS.progress)[p.id];if(snap&&snap.version===1){if(typeof snap.roundId==='string')roundId=snap.roundId;const allowed=new Set(p.words.flatMap(w=>cells(w).map(c=>c.key)));if(snap.values&&typeof snap.values==='object')for(const [k,v] of Object.entries(snap.values))if(allowed.has(k)&&typeof v==='string'&&/^[ぁ-ゖー]$/.test(v))values[k]=v;elapsed=Number.isFinite(snap.elapsed)&&snap.elapsed>=0?snap.elapsed:0;hints=new Set((Array.isArray(snap.hints)?snap.hints:[]).filter(i=>Number.isInteger(i)&&i>=0&&i<p.words.length));checked=new Set((Array.isArray(snap.checked)?snap.checked:[]).filter(i=>Number.isInteger(i)&&i>=0&&i<p.words.length&&isCorrect(p.words[i])));started=!!snap.started;done=!!snap.done&&p.words.every(isCorrect);paused=started&&!done;selected=Number.isInteger(snap.selected)&&p.words[snap.selected]?snap.selected:0;}
 $('status').textContent=done?'クリア済みの盤面です。☆から語彙帳へ登録できます。':started?'途中の内容を読み込みました。「続きから再開」または問題のタップで再開できます。':'';if(done){p.words.forEach((_,i)=>checked.add(i));$('finish').textContent=`${format(elapsed)}でクリア · ヒント使用 ${hints.size}語。`}paint();buildSelectors();renderReview();write(KEYS.last,p.id);$('saveStatus').textContent=storageOK?'進み具合は自動保存されます。':'このブラウザでは保存を利用できません。';renderRewards();}
function restart(){if(started&&!done&&!confirm('この盤面を最初からやり直しますか？ 途中の入力内容は消えます。'))return;const all=objectRead(KEYS.progress);delete all[p.id];write(KEYS.progress,all);loadBoard(p.id);begin();openEntry(0)}
function renderRecords(){records=getRecords();$('history').replaceChildren();if(!records.length){const li=document.createElement('li');li.textContent='まだ記録はありません。';$('history').append(li)}records.slice(0,50).forEach(r=>{const li=document.createElement('li');const b=boards.find(b=>b.id===r.puzzleId);li.textContent=`${b?b.title:'旧版 · '+levelName(r.level)} · ${format(r.ms)} · ヒント${r.hints||0}語 · ${new Date(r.date).toLocaleString('ja-JP')}`;const share=document.createElement('button');share.type='button';share.className='recordShare';share.textContent='シェア';share.setAttribute('aria-label','この結果をシェア');share.addEventListener('click',()=>openShare(r));li.append(share);$('history').append(li)});$('export').disabled=!records.length}
function updateReturnButton(){$('toBoard').hidden=gridInView||!$('inputOverlay').hidden||!$('hintOverlay').hidden||!$('shareOverlay').hidden}
$('level').addEventListener('change',()=>{pause();loadBoard(boards.find(b=>b.level===Number($('level').value)).id)});
$('board').addEventListener('change',()=>{const id=$('board').value;pause();loadBoard(id)});
$('start').addEventListener('click',()=>{if(started&&paused&&!done){begin();paint();$('status').textContent='再開しました。';return}if(started||done)restart();else openEntry(0)});
$('restart').addEventListener('click',restart);
$('pause').addEventListener('click',()=>{if(paused){begin();paint();$('status').textContent='再開しました。'}else{pause();paintClues();$('status').textContent='一時停止して保存しました。'}});
$('entryForm').addEventListener('submit',e=>{e.preventDefault();submit()});$('answer').addEventListener('compositionstart',()=>composing=true);$('answer').addEventListener('compositionend',()=>composing=false);$('answer').addEventListener('keydown',e=>{if(e.key==='Enter'&&(composing||e.isComposing||e.keyCode===229))e.preventDefault()});
$('erase').addEventListener('click',erase);$('closeEntry').addEventListener('click',()=>closeEntry());$('sheetHint').addEventListener('click',()=>showHint(selected));$('closeHint').addEventListener('click',closeHint);$('check').addEventListener('click',check);$('wrongNext').addEventListener('click',nextWrong);
for(const id of ['inputOverlay','hintOverlay'])$(id).addEventListener('click',e=>{if(e.target===$(id)){if(id==='hintOverlay')closeHint();else closeEntry()}});
document.addEventListener('keydown',e=>{const top=!$('shareOverlay').hidden?$('shareOverlay'):!$('hintOverlay').hidden?$('hintOverlay'):!$('inputOverlay').hidden?$('inputOverlay'):null;if(!top)return;if(e.key==='Escape'){e.preventDefault();top.id==='shareOverlay'?closeShare():top.id==='hintOverlay'?closeHint():closeEntry()}if(e.key==='Tab'){const list=Array.from(top.querySelectorAll('button,input,a[href]')).filter(x=>!x.disabled),first=list[0],last=list[list.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
$('toBoard').addEventListener('click',()=>$('boardPanel').scrollIntoView({behavior:'smooth',block:'start'}));
if('IntersectionObserver'in window){new IntersectionObserver(entries=>{gridInView=entries[0].isIntersecting;updateReturnButton()},{threshold:0.15}).observe($('grid'))}else window.addEventListener('scroll',()=>{const r=$('grid').getBoundingClientRect();gridInView=r.bottom>60&&r.top<window.innerHeight-60;updateReturnButton()},{passive:true});
for(const id of ['helpLink','vocabLink'])$(id).addEventListener('click',()=>pause());
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});window.addEventListener('pagehide',()=>pause());window.addEventListener('pageshow',e=>{if(e.persisted){loadBoard(p.id);renderRecords()}});
window.addEventListener('storage',e=>{if(e.key===KEYS.vocab){paintClues();if(!$('results').hidden)renderReview()}if(e.key===KEYS.records){renderRecords();buildSelectors()}if(e.key===REWARD_KEY)renderRewards()});
$('shareResult').addEventListener('click',()=>{const record=getRecords().find(r=>r.puzzleId===p.id);if(record)openShare(record)});
$('export').addEventListener('click',()=>{const latest=getRecords()[0];if(latest)openShare(latest)});
$('clearHistory').addEventListener('click',()=>{if(!confirm('クリア記録とベストタイムを削除しますか？ 途中保存・語彙帳・ご褒美は残ります。'))return;write(KEYS.records,[]);records=[];renderRecords();buildSelectors()});
setInterval(()=>{if(started&&!paused&&!done)$('clock').textContent=format(elapsedNow())},500);setInterval(()=>{if(started&&!paused&&!done)saveProgress()},5000);
let shareURL=null,shareFile=null,shareText='',shareRequest=0,shareFocus=null;
const shareDate=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?'日時不明':date.toLocaleString('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});};
function cross(ctx,x,y,size,opacity=.12){ctx.save();ctx.globalAlpha=opacity;const gap=size*.08;[[1,0],[0,1],[1,1],[2,1],[1,2]].forEach(([a,b],i)=>{ctx.fillStyle=i%2?'#0985e9':'#00a87d';ctx.fillRect(x+a*(size+gap),y+b*(size+gap),size,size)});ctx.restore()}
function closeShare(){shareRequest++;$('shareOverlay').hidden=true;updateReturnButton();if(shareFocus&&document.contains(shareFocus))shareFocus.focus();}
async function openShare(record){
 shareFocus=document.activeElement;pause();$('shareOverlay').hidden=false;updateReturnButton();$('closeShare').focus();$('shareMessage').textContent='結果画像を作っています…';$('sharePreview').hidden=true;$('saveImage').hidden=true;$('shareNative').disabled=true;shareFile=null;const request=++shareRequest;
 if(shareURL){URL.revokeObjectURL(shareURL);shareURL=null;}
 try{
 const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1080;const ctx=canvas.getContext('2d');if(!ctx)throw Error('canvas');
 ctx.fillStyle='#f4f9f8';ctx.fillRect(0,0,1080,1080);cross(ctx,25,30,45);cross(ctx,880,790,50);cross(ctx,40,830,28);cross(ctx,940,50,28);
 ctx.fillStyle='#fff';ctx.fillRect(70,70,940,940);ctx.strokeStyle='#d4e5e3';ctx.lineWidth=2;ctx.strokeRect(70,70,940,940);
 const logo=$('brandLogo');if(logo.decode)await logo.decode();ctx.drawImage(logo,170,105,740,740*logo.naturalHeight/logo.naturalWidth);
 ctx.textAlign='center';const font='system-ui, -apple-system, sans-serif';
 ctx.fillStyle='#147965';ctx.font='bold 40px '+font;ctx.fillText('クリア！',540,455);
 ctx.fillStyle='#234e65';ctx.font='30px '+font;ctx.fillText(levelName(record.level),540,520);
 const board=boards.find(b=>b.id===record.puzzleId);const theme=board?board.title:record.title||'旧版の盤面';
 let size=42;while(size>20){ctx.font='bold '+size+'px '+font;if(ctx.measureText(theme).width<=820)break;size--;}
 ctx.fillStyle='#153b51';ctx.fillText(theme,540,590,820);
 ctx.fillStyle='#087eaa';ctx.font='bold 92px '+font;ctx.fillText(`${Math.floor(record.ms/60000)}分${String(Math.floor(record.ms/1000)%60).padStart(2,'0')}秒`,540,740,820);
 ctx.fillStyle='#4b6971';ctx.font='27px '+font;ctx.fillText('クリア日時  '+shareDate(record.date),540,825);ctx.font='24px '+font;ctx.fillText('ことばをつなげて、日本語をもっと。',540,940);
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('png')),'image/png'));
 if(request!==shareRequest)return;
 shareURL=URL.createObjectURL(blob);const date=new Date(record.date);const stamp=Number.isNaN(date.getTime())?'result':date.toISOString().replace(/[:.]/g,'-');const filename=`kotomas-${stamp}.png`;
 shareFile=typeof File==='function'?new File([blob],filename,{type:'image/png'}):null;
 shareText=`${DATA.config.brand} ${levelName(record.level)}「${theme}」を${Math.floor(record.ms/60000)}分${String(Math.floor(record.ms/1000)%60).padStart(2,'0')}秒でクリア！\n${shareDate(record.date)}\n#コトマス #日本語学習`;
 $('sharePreview').src=shareURL;$('sharePreview').hidden=false;$('saveImage').href=shareURL;$('saveImage').download=filename;$('saveImage').hidden=false;
 const canShare=!!(shareFile&&navigator.share&&navigator.canShare&&navigator.canShare({files:[shareFile]}));$('shareNative').disabled=!canShare;
 $('shareMessage').textContent=canShare?'画像をシェアするか、保存してください。':'このブラウザでは直接共有に対応していません。「画像を保存」して投稿してください。';
 }catch{if(request===shareRequest)$('shareMessage').textContent='画像を作成できませんでした。一度閉じて、もう一度お試しください。';}
}
$('shareNative').addEventListener('click',async()=>{
 if(!shareFile)return;
 try{await navigator.share({files:[shareFile],title:DATA.config.brand+'｜クリア結果',text:shareText});$('shareMessage').textContent='共有メニューを閉じました。';}
 catch(error){$('shareMessage').textContent=error.name==='AbortError'?'共有をキャンセルしました。画像は保存できます。':'共有できませんでした。「画像を保存」して投稿してください。';}
});
$('closeShare').addEventListener('click',closeShare);
$('shareOverlay').addEventListener('click',e=>{if(e.target===$('shareOverlay'))closeShare()});


const REWARD_KEY='kotomas-rewards-v1';
const STAMPS=[
 {at:1,icon:'🌱',name:'はじまりの芽',message:'最初のひとつが、これからの力に。'},
 {at:3,icon:'🍀',name:'ひらめきのクローバー',message:'ことばのつながりが、見えてきました。'},
 {at:5,icon:'🌸',name:'ことばの花',message:'積み重ねた学びが、花ひらきました。'},
 {at:10,icon:'🕊️',name:'はばたく小鳥',message:'新しいことばへ、もうひと飛び。'},
 {at:20,icon:'🌳',name:'知識の大樹',message:'ことばの根が、しっかり育っています。'},
 {at:30,icon:'🌈',name:'つながりの虹',message:'あなたのことばの庭に、虹がかかりました。'}
];
let rewardMemory={version:1,total:0,awarded:{}},lastReward=null;
function rewardState(){
 const data=storageOK?read(REWARD_KEY,rewardMemory):rewardMemory;
 if(!data||data.version!==1||!Number.isSafeInteger(data.total)||data.total<0||!data.awarded||typeof data.awarded!=='object')return {version:1,total:0,awarded:{}};
 rewardMemory=data;return data;
}
function awardReward(){
 const data=rewardState();if(Object.hasOwn(data.awarded,roundId))return;
 const previous=data.total;data.total++;data.awarded[roundId]=true;rewardMemory=data;
 const saved=write(REWARD_KEY,data);lastReward={previous,total:data.total,saved};
}
function nextBoard(){
 const progress=objectRead(KEYS.progress),index=boards.findIndex(b=>b.id===p.id),ordered=[...boards.slice(index+1),...boards.slice(0,index)];
 return ordered.find(b=>b.level===p.level&&!progress[b.id]?.done)||ordered.find(b=>!progress[b.id]?.done)||ordered[0]||p;
}
function renderRewards(celebrate=false){
 const data=rewardState(),next=STAMPS.find(s=>s.at>data.total),goal=next?next.at:(Math.floor(data.total/10)+1)*10;
 $('rewardTotal').textContent=data.total;
 $('rewardGoal').textContent=next?`「${next.name}」まで、あと${goal-data.total}クリア`:`次の花束まで、あと${goal-data.total}クリア`;
 $('rewardProgress').max=goal;$('rewardProgress').value=data.total;
 $('collectionGrid').replaceChildren();
 for(const stamp of STAMPS){const unlocked=data.total>=stamp.at,card=document.createElement('article');card.className='stamp'+(unlocked?' unlocked':' locked');const icon=document.createElement('span');icon.className='stampIcon';icon.setAttribute('aria-hidden','true');icon.textContent=unlocked?stamp.icon:'◇';const name=document.createElement('strong');name.textContent=stamp.name;const info=document.createElement('span');info.textContent=unlocked?'獲得済み ✓':stamp.at+'クリアで開く';card.append(icon,name,info);$('collectionGrid').append(card);}
 $('bouquetCount').textContent=data.total>=40?`さらに、花束を${Math.floor((data.total-30)/10)}個獲得しました。`: '30クリアのあとも、10クリアごとに花束が増えます。';
 $('rewardEarned').hidden=!done;
 if(done){
  const unlocked=lastReward?STAMPS.filter(s=>s.at>lastReward.previous&&s.at<=lastReward.total):[];
  $('earnedTitle').textContent=lastReward?'ことばのかけら ＋1':'この盤面をクリアしました';
  $('earnedMessage').textContent=unlocked.length?unlocked.map(s=>s.icon+' '+s.name+'を獲得！ '+s.message).join(' '):lastReward&&data.total>=40&&data.total%10===0?'💐 新しい花束を獲得しました！': 'ヒントも学びの一歩。次のことばも、つなげてみよう。';
  $('earnedSaved').textContent=lastReward&&!lastReward.saved?'ご褒美を保存できませんでした。この画面を閉じると失われる場合があります。':'';
  const target=nextBoard();$('nextPuzzle').textContent='次の盤面へ → '+target.title;
 }
 if(celebrate){$('rewardEarned').classList.remove('celebrate');void $('rewardEarned').offsetWidth;$('rewardEarned').classList.add('celebrate');}
}
$('nextPuzzle').addEventListener('click',()=>{const next=nextBoard();loadBoard(next.id);$('boardPanel').scrollIntoView({behavior:'smooth',block:'start'});$('start').focus({preventScroll:true});});
$('showCollection').addEventListener('click',()=>{$('collection').open=true;$('collection').scrollIntoView({behavior:'smooth',block:'start'});$('collectionSummary').focus({preventScroll:true});});

$('sheetHint').innerHTML=BULB;$('sheetHint').setAttribute('aria-label','ヒント');
loadBoard(p.id);renderRecords();
})();

const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom'),root=path.resolve(__dirname,'..');
function data(file){const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'kotomas',file),'utf8'),ctx);return ctx.window.KOTOMAS_DATA;}
const classic=data('classic-data.js'),n2=data('n2-data.js');
let boardCount=0,hintCount=0;
for(const dataset of [classic,n2]){
 const bank=new Map(dataset.words.map(w=>[w.id,w]));
 for(const w of dataset.words){assert(w.hintExample.includes('{{blank}}'));assert(!w.hintExample.includes(w.kanji.replace(/[（(].*?[）)]/g,'')),w.id+' leaks answer');assert(/^[ぁ-ゖー]+$/.test(w.answer));hintCount++;}
 for(const board of dataset.boards){
  const cells=new Map(),runs=new Set();assert.equal(board.words.length,12);
  for(const placement of board.words){const w={...bank.get(placement.id),...placement};assert.equal(w.level,board.level);runs.add(`${w.r},${w.c},${w.d},${w.answer}`);for(let i=0;i<w.answer.length;i++){const r=w.r+(w.d?i:0),c=w.c+(w.d?0:i),key=r+','+c;assert(r>=0&&r<board.rows&&c>=0&&c<board.cols);if(cells.has(key))assert.equal(cells.get(key),w.answer[i]);cells.set(key,w.answer[i]);}}
  for(const [key]of cells){const [r,c]=key.split(',').map(Number);for(const d of [0,1]){const dr=d,dc=1-d;if(cells.has((r-dr)+','+(c-dc)))continue;let word='',i=0;while(cells.has((r+dr*i)+','+(c+dc*i))){word+=cells.get((r+dr*i)+','+(c+dc*i));i++;}if(word.length>1)assert(runs.has(`${r},${c},${d},${word}`),board.id+' has unintended run');}}
  const visited=new Set(),queue=[cells.keys().next().value];while(queue.length){const k=queue.pop();if(visited.has(k))continue;visited.add(k);const [r,c]=k.split(',').map(Number);for(const [dr,dc]of [[0,1],[1,0],[-1,0],[0,-1]]){const k2=(r+dr)+','+(c+dc);if(cells.has(k2)&&!visited.has(k2))queue.push(k2);}}assert.equal(visited.size,cells.size);boardCount++;
 }
}
assert.equal(n2.words.length,1150);assert.equal(new Set(n2.boards.flatMap(b=>b.words.map(w=>w.id))).size,1150);
function boot(file,storage={},denyStorage=false){
 const html=fs.readFileSync(path.join(root,file),'utf8'),dom=new JSDOM(html,{runScripts:'outside-only',url:'https://example.test/'+file}),w=dom.window;
 w.HTMLElement.prototype.scrollIntoView=function(){};w.confirm=()=>true;
 if(denyStorage)Object.defineProperty(w,'localStorage',{get(){throw new Error('Storage unavailable');}});
 else for(const [k,v]of Object.entries(storage))w.localStorage.setItem(k,v);
 const ctx=dom.getInternalVMContext();for(const m of html.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g)){let js=m[1]?fs.readFileSync(path.join(root,m[1]),'utf8'):m[2];if(m[1]==='kotomas/game.js')js=js.replace(/\}\)\(\);\s*$/,`window.testApi={puzzle:()=>p,loadBoard,showHint,rewards:rewardState,saveProgress};})();`);vm.runInContext(js,ctx);}
 return {dom,w,d:w.document,$:id=>w.document.getElementById(id),api:w.testApi};
}
function storageOf(x){const o={};for(let i=0;i<x.w.localStorage.length;i++){const k=x.w.localStorage.key(i);o[k]=x.w.localStorage.getItem(k);}return o;}
function solve(x){const p=x.api.puzzle();for(let i=0;i<p.words.length;i++){const button=x.d.getElementById('clue-'+i).querySelector('.pick');button.click();x.$('answer').value=p.words[i].reading;x.$('entryForm').dispatchEvent(new x.w.Event('submit',{cancelable:true}));}x.$('check').click();assert.equal(x.$('resultTitle').textContent,'クリア！');}
let x=boot('nihongo_crossword.html');
assert.equal(x.d.querySelectorAll('.clue').length,12);x.$('check').click();assert.equal(x.api.rewards().total,0);assert(x.$('rewardEarned').hidden);
// Every classic difficulty and all N2 hints render a red initial in a masked sentence.
for(const dataset of [classic,n2]){
 if(dataset===n2){x.dom.window.close();x=boot('nihongo_crossword_n2.html');}
 for(const board of dataset.boards){x.api.loadBoard(board.id);const p=x.api.puzzle();for(let i=0;i<p.words.length;i++){x.api.showHint(i);const initials=x.$('hintText').querySelectorAll('.hintInitial');assert(initials.length);assert.equal(initials[0].textContent,p.words[i].answer[0]);assert.equal(initials[0].parentElement.textContent,p.words[i].answer[0]+'○'.repeat(p.words[i].answer.length-1));assert(!x.$('hintText').textContent.includes('{{blank}}'));x.$('closeHint').click();}}
}
x.dom.window.close();x=boot('nihongo_crossword.html');
x.api.showHint(0);x.$('closeHint').click();solve(x);assert.equal(x.api.rewards().total,1);assert.equal(x.d.querySelectorAll('.stamp.unlocked').length,1);x.$('check').click();assert.equal(x.api.rewards().total,1);
let stored=storageOf(x);x.dom.window.close();x=boot('nihongo_crossword.html',stored);assert.equal(x.api.rewards().total,1);assert.equal(x.$('resultTitle').textContent,'クリア！');x.$('check').click();assert.equal(x.api.rewards().total,1);
// Replaying a completed board earns a new reward, unlike simply reloading.
x.$('start').click();solve(x);assert.equal(x.api.rewards().total,2);
const previous=x.api.puzzle().id;x.$('nextPuzzle').click();assert.notEqual(x.api.puzzle().id,previous);assert(x.$('rewardEarned').hidden);
// Cross-version collection sharing and a milestone unlock.
stored=storageOf(x);x.dom.window.close();x=boot('nihongo_crossword_n2.html',stored);assert.equal(x.api.rewards().total,2);solve(x);assert.equal(x.api.rewards().total,3);assert.equal(x.d.querySelectorAll('.stamp.unlocked').length,2);assert(x.$('earnedMessage').textContent.includes('クローバー'));
x.$('review').querySelector('.star').click();assert(Object.values(JSON.parse(x.w.localStorage.getItem('nihongo-crossword-vocab-v1'))).some(w=>w.sourceLabel));
x.$('clearHistory').click();assert.equal(x.api.rewards().total,3);
// Preserve partial progress and its reward round across navigation/reload.
x.$('nextPuzzle').click();x.$('start').click();const current=x.api.puzzle();x.$('answer').value=current.words[0].reading;x.$('entryForm').dispatchEvent(new x.w.Event('submit',{cancelable:true}));x.api.saveProgress();stored=storageOf(x);const round=JSON.parse(stored['kotomas-n2-progress-v1'])[current.id].roundId;
x.dom.window.close();x=boot('nihongo_crossword_n2.html',stored);assert.equal(x.api.puzzle().id,current.id);x.api.saveProgress();assert.equal(JSON.parse(x.w.localStorage.getItem('kotomas-n2-progress-v1'))[current.id].roundId,round);x.$('start').click();solve(x);assert.equal(x.api.rewards().total,4);
// Missing persistence must not block play or falsely claim a saved reward.
x.dom.window.close();x=boot('nihongo_crossword_n2.html',{},true);solve(x);assert.equal(x.api.rewards().total,1);assert(x.$('earnedSaved').textContent.includes('保存できません'));x.dom.window.close();
// The documentation contains the requested concrete example and accessible color explanation.
const guide=new JSDOM(fs.readFileSync(path.join(root,'nihongo_howto.html'),'utf8')).window.document;
assert.equal(guide.querySelector('.hintInitial').textContent,'よ');assert(guide.body.textContent.includes('よ○○○'));assert(guide.body.textContent.includes('ことばのかけら'));
console.log(`PASS: ${boardCount} complete connected boards, ${hintCount} masked vocabulary examples, all hint dialogs, answer input, rewards/milestones, replay vs reload, cross-page sharing, vocabulary integration, history deletion, resume and storage failure.`);

const fs=require('node:fs'),assert=require('node:assert/strict');
const {generatePuzzle}=require('./crossword-generator.cjs');
const raw=JSON.parse(fs.readFileSync(__dirname+'/n2-source.json','utf8'));
const edits=JSON.parse(fs.readFileSync(__dirname+'/n2-hint-examples.json','utf8'));
const norm=s=>s.normalize('NFKC').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-96)).replace(/[ゃゅょぁぃぅぇぉっゎ]/g,c=>({'ゃ':'や','ゅ':'ゆ','ょ':'よ','ぁ':'あ','ぃ':'い','ぅ':'う','ぇ':'え','ぉ':'お','っ':'つ','ゎ':'わ'}[c]));
const levels=['第1課 · 名詞','第2課 · する名詞・動詞','第3課 · 動詞','第4課 · 形容詞','第5課 · 副詞・接続詞など','第6課 · 複合動詞・表現'];
const words=raw.map(v=>{
 const term=v.word.replace(/[（(].*?[）)]/g,'').trim(),example=edits[v.id]||v.example;
 assert(example.includes(term),v.id+' has no cloze target');
 return {id:'n2-'+v.id,level:v.chapter-1,kanji:v.word,reading:v.reading,answer:norm(v.reading),clue:v.clue,example:v.example,hintExample:example.split(term).join('{{blank}}'),hintAdapted:!!edits[v.id],adapted:true,sourceLabel:'添付Excel 第'+v.chapter+'課',chapter:v.chapter};
});
const boards=[];let seed=2102026;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
for(let level=0;level<6;level++){
 const pool=words.filter(w=>w.level===level),remaining=new Set(pool.map(w=>w.id));let number=0;
 while(remaining.size){
  const pending=pool.filter(w=>remaining.has(w.id));let best;
  for(let attempt=0;attempt<6;attempt++){
   const candidates=pending.length>=24?pending:[...pending,...pool.filter(w=>!remaining.has(w.id))];
   const b=generatePuzzle(candidates.map(w=>({...w,reading:w.answer})),12,random,pending[attempt%pending.length].id);
   const covered=b.words.filter(w=>remaining.has(w.id)).length,score=covered*1000+b.words.length*10-b.rows*b.cols;
   if(!best||score>best.score)best={b,score,covered};
  }
  assert(best.covered>0,'No coverage progress');number++;
  const b=best.b;boards.push({id:`kotomas-n2-v1-${level+1}-${number}`,level,title:`第${level+1}課 · ${String(number).padStart(2,'0')}`,number,rows:b.rows,cols:b.cols,words:b.words.map(w=>({id:w.id,r:w.r,c:w.c,d:w.dir==='down'?1:0,n:w.number}))});
  for(const w of b.words)remaining.delete(w.id);
 }
 console.log(levels[level],number+'盤面');
}
assert.equal(new Set(boards.flatMap(b=>b.words.map(w=>w.id))).size,1150);
const config={brand:'コトマスN2',levels,keys:{progress:'kotomas-n2-progress-v1',records:'kotomas-n2-records-v1',vocab:'nihongo-crossword-vocab-v1',last:'kotomas-n2-last-v1'}};
fs.writeFileSync(__dirname+'/../kotomas/n2-data.js','window.KOTOMAS_DATA = '+JSON.stringify({config,words,boards})+';\n');
console.log('Complete coverage:',words.length,'words in',boards.length,'boards');

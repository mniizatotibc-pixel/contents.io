/* Crossword generation: every word connects, with no un-clued adjoining runs. */
function normalizeKana(value) {
 return value.normalize('NFKC').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-96)).replace(/[\s　]/g,'');
}
function generatePuzzle(pool, target=10, random=Math.random, requiredId=null) {
 const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 let best=null;
 for(let attempt=0;attempt<12;attempt++) {
  const size=17,grid=Array.from({length:size},()=>Array(size).fill(null)),placed=[],seen=new Set();
  const candidates=shuffle(pool).filter(w=>w.reading.length>=1&&w.reading.length<=15);
  if(requiredId){const index=candidates.findIndex(w=>w.id===requiredId);if(index>0)candidates.unshift(candidates.splice(index,1)[0]);}
  function fits(w,r,c,dir){
   const dr=dir==='down'?1:0,dc=1-dr,L=w.reading.length;
   const at=(y,x)=>grid[y]?.[x];
   if(r<0||c<0||r+dr*(L-1)>=size||c+dc*(L-1)>=size||at(r-dr,c-dc)||at(r+dr*L,c+dc*L))return -1;
   let crosses=0;
   for(let i=0;i<L;i++){
    const y=r+dr*i,x=c+dc*i,cell=at(y,x);
    if(cell){if(cell.char!==w.reading[i]||cell.dirs.includes(dir))return -1;crosses++;}
    else if(at(y-dc,x-dr)||at(y+dc,x+dr))return -1;
   }
   return crosses;
  }
  function put(w,r,c,dir){
   const p={...w,r,c,dir};placed.push(p);seen.add(w.reading);
   for(let i=0;i<w.reading.length;i++){
    const y=r+(dir==='down'?i:0),x=c+(dir==='across'?i:0);
    if(!grid[y][x])grid[y][x]={char:w.reading[i],dirs:[]};grid[y][x].dirs.push(dir);
   }
  }
  if(!candidates.length)throw new Error('出題できる単語がありません。');
  const first=candidates[0];put(first,8,Math.floor((size-first.reading.length)/2),'across');
  for(let pass=0;pass<2&&placed.length<target;pass++)for(const w of candidates){
   if(placed.length>=target)break;if(seen.has(w.reading))continue;
   let opts=[];
   for(const p of placed)for(let j=0;j<p.reading.length;j++)for(let k=0;k<w.reading.length;k++)if(p.reading[j]===w.reading[k]){
    const dir=p.dir==='across'?'down':'across',r=p.r+(p.dir==='down'?j:0)-(dir==='down'?k:0),c=p.c+(p.dir==='across'?j:0)-(dir==='across'?k:0);
    const count=fits(w,r,c,dir);if(count>0)opts.push({r,c,dir,score:count*30-Math.abs(r-8)-Math.abs(c-8)+random()*5});
   }
   if(opts.length){opts.sort((a,b)=>b.score-a.score);const o=opts[0];put(w,o.r,o.c,o.dir);}
  }
  const minR=Math.min(...placed.map(p=>p.r)),minC=Math.min(...placed.map(p=>p.c));
  const maxR=Math.max(...placed.map(p=>p.r+(p.dir==='down'?p.reading.length-1:0))),maxC=Math.max(...placed.map(p=>p.c+(p.dir==='across'?p.reading.length-1:0)));
  const puzzle={rows:maxR-minR+1,cols:maxC-minC+1,words:placed.map(p=>({...p,r:p.r-minR,c:p.c-minC}))};
  const score=placed.length*100-(puzzle.rows*puzzle.cols);
  if(!best||score>best.score)best={...puzzle,score};
 }
 const starts=[...new Set(best.words.map(w=>w.r*best.cols+w.c))].sort((a,b)=>a-b);
 best.words.forEach(w=>w.number=starts.indexOf(w.r*best.cols+w.c)+1);
 best.words.sort((a,b)=>a.number-b.number||a.dir.localeCompare(b.dir));
 return best;
}
if(typeof module!=='undefined')module.exports={generatePuzzle,normalizeKana};

/* =====================================================================
   gimme5.js - the "Gimme 5" game.

   Two rounds played from one screen, with an optional second screen (the
   Present window) for the audience.

     Round 1  2 to 10 teams take turns naming the 5 hidden answers to a
              host-written question before a countdown ends.
     Round 2  the Round 1 winner plays as a pair: a Guesser and a Helper.
              They blind-pick one of 5 boxes to get a category, and the
              Helper may only say "Oo", "Hindi" or "Pwede".

   The hidden answers live on the operator's screen only. The audience screen
   never receives them: a snapshot carries the answers that have been found or
   deliberately revealed, and nothing else.

   This file only defines functions when it loads. It reads globals from
   app.js (rpc, S, esc, ...) only when they are called, because boot() runs at
   the end of app.js.
   ===================================================================== */

/* ---------- constants and helpers ---------- */

// The type of a game file: "chain" (or missing) or "gimme5".
function g5Type(g){return g&&g.type==='gimme5'?'gimme5':'chain'}

// The five categories, with the English name shown beside the Filipino one.
const G5_CATS=[['Tao','Person'],['Bagay','Things'],['Hayop','Animals'],['Lugar','Places'],['Pagkain','Food']];
const G5_PICK1='Pick the box that holds the question.';
const G5_PICK2='Pick a box. The category under it decides the five words. Seat the Guesser facing away from the projector.';

// The default instructions text for a Gimme 5 game.
const G5_INSTR='Round 1: each team in turn blind-picks a question, then its members work together to name the five hidden answers before the time runs out. The team that finds all five in the shortest time goes through to Round 2. Round 2: the teams that come through play one after the other, as a pair. The Helper can only say Oo, Hindi or Pwede, and the Guesser finds all five words.';

// The demo game, used when there is no database connection.
const G5_DEMO={id:'gimme5-demo',type:'gimme5',title:'Gimme 5 Demo',church:'Bicutan Bible Church',desc:'Two rounds: each team finds the five hidden answers, then the teams that come through play as a pair.',series:'Gimme 5',sub:'A fellowship game for all ages',date:'',welcome:'Welcome, Fellowship!',defaultTeams:2,
  instr:G5_INSTR,
  round1:{members:3,advance:2,questions:[
    {text:'Ano-anong hayop ang makikita sa farm?',english:false,seconds:60,answers:['Baka','Kalabaw','Kabayo','Manok','Baboy']},
    {text:'Name 5 things you can find in a church.',english:true,seconds:60,answers:['Cross','Bible','Pulpit','Pews','Altar']}]},
  round2:{seconds:120,showWordOnPresent:true,categories:{
    Tao:[['Guro','Pari','Doktor','Pulis','Magsasaka']],
    Bagay:[['Payong','Susi','Salamin','Relo','Sapatos']],
    Hayop:[['Aso','Pusa','Elepante','Leon','Pagong']],
    Lugar:[['Simbahan','Palengke','Paaralan','Ospital','Parke']],
    Pagkain:[['Adobo','Sinigang','Lumpia','Halo-halo','Pandesal']]}},
  by:'Bicutan Bible Church',owner:null,results:[]};

// Format a countdown in milliseconds as m:ss.
function g5Clock(ms){const s=Math.max(0,Math.ceil(ms/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}

// Format a recorded time in seconds as m:ss.t.
function g5Time(sec){const s=Math.max(0,sec||0);return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0')+'.'+Math.floor((s%1)*10)}

// Shuffle a list (used for the Round 2 boxes).
function g5Shuffle(a){const r=a.slice();for(let i=r.length-1;i>0;i--){const j=Math.random()*(i+1)|0;const t=r[i];r[i]=r[j];r[j]=t}return r}

/* ---------- state ---------- */

// The running Gimme 5 game.
let G5=null;
// The present window: the session id, the broadcast channel and the last contact.
let G5_SESSION=null,G5_CH=null,G5_SEEN=0,G5_TIMER=null;
// The studio state for a Gimme 5 file.
let ST5=null;
// The present window state (audience view).
let G5P=null;

/* ---------- the present window channel ---------- */

// The broadcast channel for this session, or null when the browser has none.
function g5Channel(){
  if(G5_CH||!G5_SESSION)return G5_CH;
  try{G5_CH=new BroadcastChannel('gimme5-'+G5_SESSION)}catch(e){G5_CH=null}
  if(G5_CH)G5_CH.onmessage=e=>{
    const d=e.data||{};
    if(d.t==='hello'||d.t==='ping'){G5_SEEN=Date.now();if(d.t==='hello')g5Push()}
  };
  return G5_CH}

// Send a message to the present window over the channel, with a localStorage
// fallback for browsers without BroadcastChannel.
function g5Send(msg){
  const ch=g5Channel();
  if(ch){try{ch.postMessage(msg)}catch(e){}}
  try{localStorage.setItem('g5-'+G5_SESSION,JSON.stringify({...msg,at:Date.now()}))}catch(e){}
}

// The audience-safe snapshot. It never carries the answers that have not been
// found or revealed, and never the Round 2 words that have not been found.
function g5Snapshot(){
  if(!G5)return null;
  const g=G5.g,s={t:'g5',step:G5.step,title:g.title,question:null,clock:null,teams:[],slots:[],standings:null,r2:null};
  s.teams=G5.teams.map((t,i)=>{
    const r=G5.r1results.find(x=>x.team===i);
    const live=G5.found.filter(f=>f&&f.team===i).length;
    return {name:t.name,count:r?r.found:live,seconds:r?r.seconds:null};
  });
  if(G5.step==='welcome')s.welcome={series:g.series||'',sub:g.sub||'',date:g.date||'',phrase:g.welcome||''};
  // the game itself, for the screen before the first round
  if(G5.step==='setup'||G5.step==='welcome')s.game={title:g.title||'',series:g.series||'',desc:g.desc||'',instr:g.instr||G5_INSTR,phrase:g.welcome||''};
  s.church=g.church||'Bicutan Bible Church';
  // the blind pick: the boxes with their numbers, so the audience sees the choices
  if(G5.step==='r1pick'||G5.step==='r2pick'){
    s.pick=true;
    s.pickText=G5.step==='r1pick'?G5_PICK1:G5_PICK2;
    s.boxes=G5.boxes.map((b,i)=>({n:i+1,picked:!!b.picked}));
  }
  if(G5.step==='setup'||G5.step==='welcome'||G5.step==='r1pick'||G5.step==='r1'||G5.step==='r1rank'){
    s.question={text:G5.q.text,english:!!G5.q.english};
    // the question flashes for a moment after the blind pick
    s.flashUntil=G5.flash+900;
    s.flashId=G5.flash;
    s.clock={endsAt:G5.endsAt,running:G5.running,total:(G5.q.seconds||60)*1000,left:g5ShowLeft()};
    // only the answers that have been found or revealed
    s.slots=G5.found.map((f,i)=>f?{answer:G5.q.answers[i],team:f.revealed?'':(G5.teams[f.team]?G5.teams[f.team].name:''),revealed:!!f.revealed}:null);
    s.unfound=G5.q.answers.map((a,i)=>(G5.found[i]&&G5.found[i].revealed)?{n:i+1,a:a}:null).filter(Boolean);
    s.anim={unfound:G5.animUnfound,slot:G5.animSlot};
    if(G5.step==='r1rank'){
      s.standings=G5.r1results.slice().sort((a,b)=>(b.all-a.all)||(a.seconds-b.seconds)).map(r=>({name:G5.teams[r.team].name,correct:r.found,all:r.all,seconds:r.seconds,in:G5.r2teams.indexOf(r.team)>-1}));
      s.advance=G5.advance;
    }
  }
  // the result of the team that has just played
  if(G5.step==='r1done'){
    const r=G5.r1results[G5.r1results.length-1];
    if(r)s.result={team:G5.teams[r.team].name,seconds:r.seconds,found:r.found,question:r.question||'',words:r.words||[],missed:r.missed||[]};
  }
  if(G5.step==='r2done'){
    const r=G5.r2results[G5.r2results.length-1];
    if(r)s.result={team:r.name,seconds:r.seconds,guessed:r.guessed,category:r.category||'',words:r.words||[],missed:r.missed||[]};
  }
  if(G5.step==='r2pick'||G5.step==='r2'||G5.step==='r2done'||G5.step==='end'){
    s.r2={category:G5.cat,flashUntil:G5.flash+900,flashId:G5.flash,clock:{endsAt:G5.endsAt,running:G5.running,total:G5.r2seconds*1000,left:g5ShowLeft()},
      words:G5.words.map((w,i)=>(G5.got[i]||G5.rev[i])?w:null),got:G5.got.slice(),rev:(G5.rev||[]).slice(),
      queue:(G5.queue||[]).slice()};
    // the countdown of the second round belongs to the top bar too
    s.clock=s.r2.clock;
    // the current word only when the game allows it on the audience screen, and
    // only once the round has started
    if(G5.step==='r2'&&G5.r2startedAt&&G5.words.length)s.r2.current=G5.words[G5.wordIdx];
    if(G5.step==='r2'&&G5.r2startedAt)s.r2.mid=G5.wordIdx;
    s.anim={mid:G5.animMid,found:G5.animFound};
    if(G5.step==='end'&&G5.result)s.end=G5.result;
  }
  return s}

// Push the current snapshot to the present window.
function g5Push(){if(!G5_SESSION)return;const s=g5Snapshot();if(s)g5Send(s)}

// Is the present window talking to us?
function g5PresentOk(){return G5_SEEN>0&&(Date.now()-G5_SEEN)<7000}

// Open the present window for this game.
async function g5OpenPresent(){
  if(!G5_SESSION)G5_SESSION='g5-'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
  const url=location.pathname+'#present='+G5_SESSION;
  let w=null;
  // when the browser allows it, put the window on the second screen
  try{
    if(window.getScreenDetails){
      const d=await window.getScreenDetails();
      const s=d.screens.length>1?d.screens[1]:d.currentScreen;
      w=await window.open(url,'g5_present',{left:s.availLeft+30,top:s.availTop+30,width:Math.min(1280,s.availWidth-60),height:Math.min(760,s.availHeight-60)});
    }
  }catch(e){}
  if(!w)w=window.open(url,'g5_present','width=1280,height=720,menubar=no,toolbar=no');
  if(!w){toast('The browser blocked the second window. Allow pop-ups for this site, then press Present again.');return}
  g5Channel();g5Push();
  toast('Present window opened. Drag it to the projector and press Fullscreen there.')}

/* ---------- the game ---------- */

// Start a Gimme 5 game: the setup step.
function playG5(id){
  const g=S.games.find(x=>x.id===id);if(!g)return;
  const r1=g.round1||{};
  G5={g:g,step:'setup',teams:[],members:Math.min(6,Math.max(1,+(r1.members||3))),advance:Math.min(5,Math.max(1,+(r1.advance||2))),
    r1team:0,r1results:[],q:{text:'',english:false,seconds:60,answers:['','','','','']},
    found:[null,null,null,null,null],turn:0,history:[],startedAt:null,endsAt:null,running:false,pausedLeft:0,pausedAt:null,pausedTotal:0,elapsed:0,timeUp:false,
    standings:null,winner:null,tie:false,winnerTeam:'',
    r2teams:[],r2pos:0,r2results:[],r2team:0,guesser:0,helper:1,boxes:[],boxes1:[],boxes2:[],cat:null,words:[],wordIdx:0,queue:[],got:[],rev:[],revealed:false,animMid:-1,animFound:-1,animUnfound:-1,animSlot:-1,
    r2startedAt:null,r2seconds:(g.round2&&g.round2.seconds)||120,flash:0,result:null,rid:null,early:false};
  // the teams that play
  const n=Math.min(10,Math.max(2,+(g.defaultTeams||2)));
  for(let i=0;i<n;i++)G5.teams.push({name:'Team '+(i+1)});
  view='stage5';render();
  clearInterval(G5_TIMER);G5_TIMER=setInterval(g5Tick,200);
}

// The seconds still left on the running clock.
function g5Left(){if(!G5)return 0;if(!G5.running||!G5.endsAt)return 0;return Math.max(0,G5.endsAt-Date.now())}

// What the clock shows. Before the round starts it is the time the host gave it,
// so the players and the audience can see how long they will have; while it is
// paused it is the time that is left; when the time is up it is zero.
function g5ShowLeft(){
  if(!G5)return 0;
  if(G5.running)return g5Left();
  if(G5.timeUp)return 0;
  if(G5.pausedLeft)return G5.pausedLeft;
  const total=(G5.step==='r2'?G5.r2seconds:(G5.q.seconds||60))*1000;
  if(G5.startedAt)return Math.max(0,G5.endsAt?G5.endsAt-Date.now():total);
  return total;
}

// Update the countdown text in place, so the rest of the screen is not redrawn
// (and the keyboard focus is not lost).
function g5ClockPaint(){
  const left=g5ShowLeft();
  document.querySelectorAll('[data-countdown]').forEach(el=>{el.textContent=g5Clock(left)});
  const st=document.querySelector('[data-present]');
  if(st)st.textContent='Present window '+(g5PresentOk()?'connected':'not connected');
}

// The host timer: keep the clock honest and keep the audience screen in sync.
function g5Tick(){
  if(view!=='stage5'||!G5)return;
  g5ClockPaint();
  if(G5.running&&G5.endsAt&&Date.now()>=G5.endsAt)g5TimeUp();
  // the helper signal flashes for two seconds
}

// The yellow flash. It goes on the body, so a redraw of the screen does not
// play it again, and it is over in a moment.
let G5_FLASH_T=null;
function g5Flash(){
  document.body.classList.add('g5flash');
  clearTimeout(G5_FLASH_T);
  G5_FLASH_T=setTimeout(()=>{document.body.classList.remove('g5flash');G5_FLASH_T=null;},800);
}

// Clear the clock: the next team starts from the full time.
function g5ResetClock(){
  if(!G5)return;
  G5.startedAt=null;G5.endsAt=null;G5.pausedLeft=0;G5.pausedAt=null;G5.pausedTotal=0;G5.running=false;G5.timeUp=false;
}

// Start the round 1 clock (and move into Round 1).
function g5Start(){
  if(!G5||G5.step!=='r1')return;
  G5.pausedLeft=0;G5.timeUp=false;
  G5.startedAt=Date.now();G5.running=true;G5.endsAt=G5.startedAt+G5.q.seconds*1000;
  g5Push();renderG5();
}

// Start or pause the clock.
function g5Toggle(){
  if(!G5||G5.timeUp)return;
  if(G5.running){
    G5.running=false;G5.pausedLeft=Math.max(0,G5.endsAt-Date.now());G5.pausedAt=Date.now();
  }else{
    if(G5.pausedAt)G5.pausedTotal=(G5.pausedTotal||0)+(Date.now()-G5.pausedAt)/1000;
    G5.pausedAt=null;
    G5.running=true;G5.endsAt=Date.now()+(G5.pausedLeft||((G5.step==='r1'?G5.q.seconds:G5.r2seconds)*1000));G5.pausedLeft=0;
  }
  g5Push();renderG5();
}

// The clock ran out. The board stays, the clock stops, and the host ends the
// round with Reveal remaining (round 1) or Reveal the rest (round 2).
function g5TimeUp(){
  G5.running=false;G5.endsAt=Date.now();G5.timeUp=true;fan();
  g5Push();renderG5();
}

// The number of seconds since Round 1 started. The time the clock was paused
// does not count, and the time never goes past the time the host set.
function g5Elapsed(){
  if(!G5||!G5.startedAt)return 0;
  let t=(Date.now()-G5.startedAt)/1000-(G5.pausedTotal||0);
  if(G5.pausedAt)t-=(Date.now()-G5.pausedAt)/1000;
  return Math.max(0,Math.min(t,G5.q.seconds||60));
}

// Mark an answer slot correct. The team works together and the team's time is
// what counts. The host keeps the turn of the members in real life, so nothing
// on the screen follows that.
function g5Correct(i){
  if(!G5||G5.step!=='r1'||G5.found[i]||!G5.startedAt)return;
  const t=G5.r1team,at=g5Elapsed();
  G5.found[i]={team:t,at:at,revealed:false};
  G5.animSlot=i;
  G5.history.push({kind:'correct',slot:i,team:t});
  if(G5.found.every(Boolean))g5TeamDone();
  g5Push();renderG5();
}

// Undo the last action of the host.
// Undo the last action of the host.
function g5Undo(){
  if(!G5||!G5.history.length)return;
  const h=G5.history.pop();
  if(h.kind==='correct')G5.found[h.slot]=null;
  g5Push();renderG5();
}

// Reveal the answers nobody found. A revealed answer is not one the team found.
// The first press shows them and keeps the round open; the second press ends the
// round and shows the result. It may only be done when the clock is not running.
function g5RevealRest(){
  if(!G5||G5.step!=='r1'||G5.running||!G5.startedAt)return;
  if(G5.found.every(f=>f)){
    g5TeamDone();                       // every answer has been shown: the result can come
  }else{
    const first=G5.found.findIndex(f=>!f);
    G5.found=G5.found.map((f,i)=>f||{team:-1,at:g5Elapsed(),revealed:true});
    G5.animUnfound=first;
  }
  g5Push();renderG5();
}

// The answers the team really found. The ones that were only revealed do not count.
function g5FoundCount(){return G5.found.filter(f=>f&&!f.revealed).length}


// Deal the questions into the boxes and open the blind pick for the team that is
// up. There is one box per question the host wrote, so a game with three
// questions shows three boxes, not five.
function g5ToPick1(){
  if(!G5)return;
  G5.step='r1pick';
  g5ResetClock();
  const qs=(G5.g.round1&&G5.g.round1.questions)||[];
  const boxes=G5.boxes1||[];
  G5.redealt=false;
  if(!boxes.length){
    // the first deal: one box for every question
    G5.boxes1=g5Shuffle(qs).map(q=>({q:q,picked:false}));
  }else if(!boxes.some(b=>!b.picked)){
    // every question is taken: the questions are put back as free numbers, and
    // the numbers that were taken stay taken
    G5.boxes1=boxes.concat(g5Shuffle(qs).map(q=>({q:q,picked:false})));
    G5.redealt=true;
  }
  G5.boxes=G5.boxes1;
  g5Push();renderG5();
}

// Open the Round 1 welcome message, so the clock does not start straight away.
function g5Welcome(){
  if(!G5)return;
  G5.step='welcome';
  g5Push();renderG5();
}

// Take the welcome message down and open the blind pick.
function g5Begin(){if(!G5)return;g5ToPick1()}

// Pick a box and reveal the question under it.
function g5PickQ(i){
  if(!G5||G5.step!=='r1pick'||G5.boxes[i].picked||!G5.boxes[i].q)return;
  G5.boxes[i].picked=true;
  G5.q=G5.boxes[i].q;
  G5.step='r1';
  G5.found=[null,null,null,null,null];
  G5.history=[];G5.flash=Date.now();
  g5ResetClock();
  g5Flash();
  g5Push();renderG5();
}

// The team has finished its round: record the time, then show the result before
// the next team blind-picks.
function g5TeamDone(){
  if(G5.step!=='r1')return;
  const found=g5FoundCount();
  const all=found>=5;
  const limit=G5.q.seconds||60;
  const time=Math.min(all?g5Elapsed():limit,limit);
  G5.r1results.push({team:G5.r1team,found:found,all:all,seconds:+time.toFixed(1),
    question:G5.q.text,english:!!G5.q.english,
    words:G5.q.answers.filter((a,i)=>G5.found[i]&&!G5.found[i].revealed),
    missed:G5.q.answers.filter((a,i)=>!G5.found[i]||G5.found[i].revealed)});
  G5.running=false;
  G5.step='r1done';
  g5Push();renderG5();
}

// The next team blind-picks, or the ranking when they were the last.
function g5NextTeam(){
  if(!G5)return;
  if(G5.r1team+1<G5.teams.length){G5.r1team++;g5ToPick1()}
  else g5Rank1();
}

// The ranking after every team has played: the fastest teams go to Round 2.
function g5Rank1(){
  G5.step='r1rank';
  G5.r1results.sort((a,b)=>(b.all-a.all)||(a.seconds-b.seconds));
  G5.r2teams=G5.r1results.slice(0,Math.min(G5.advance,G5.r1results.length)).map(r=>r.team);
  G5.r2pos=0;
  g5Push();renderG5();
}

// Move to the Round 2 box pick, for the next team that advances.
function g5ToPick(){
  if(!G5)return;
  G5.step='r2pick';
  G5.r2team=G5.r2teams.length?G5.r2teams[G5.r2pos]:0;
  // one box for every set the host wrote: the number of choices is their choice
  const sets=[];
  G5_CATS.forEach(c=>{
    const arr=(G5.g.round2.categories&&G5.g.round2.categories[c[0]])||[];
    arr.forEach((set,si)=>{if(set&&set.length)sets.push({cat:c[0],si:si})});
  });
  // the boxes stay for the whole round: a box that has been taken is marked,
  // and the next team takes another one
  const have=(G5.boxes2||[]).length===sets.length&&sets.every(x=>(G5.boxes2||[]).some(b=>b.cat===x.cat&&b.si===x.si));
  G5.redealt=false;
  if(!have||!(G5.boxes2||[]).some(b=>!b.picked)){
    G5.boxes2=g5Shuffle(sets).map(x=>({cat:x.cat,si:x.si,picked:false}));
    G5.redealt=have;
  }
  G5.boxes=G5.boxes2;
  G5.guesser=0;G5.helper=G5.members>1?1:0;
  g5Push();renderG5();
}

// Pick a box in Round 2 and reveal its category.
function g5PickBox(i){
  if(!G5||G5.step!=='r2pick'||G5.boxes[i].picked||!G5.boxes[i].cat)return;
  G5.boxes[i].picked=true;
  G5.cat=G5.boxes[i].cat;
  // the five words come from the set that was under the box
  const sets=G5.g.round2.categories[G5.cat]||[];
  const set=sets[G5.boxes[i].si]||[];
  G5.words=set.length?set.slice(0,5):['','','','',''];
  G5.got=[false,false,false,false,false];
  G5.rev=[false,false,false,false,false];
  G5.queue=G5.words.map((w,i)=>i);
  G5.wordIdx=0;
  G5.revealed=false;
  G5.animMid=-1;G5.animFound=-1;
  G5.r2startedAt=null;
  G5.step='r2';
  G5.flash=Date.now();
  g5Flash();
  // the clock waits for the host
  G5.running=false;G5.r2startedAt=null;
  g5Push();renderG5();
}

// The Guesser got the current word.
function g5R2Correct(){
  if(!G5||G5.step!=='r2'||!G5.words.length||!G5.r2startedAt||G5.timeUp)return;
  G5.got[G5.wordIdx]=true;
  G5.animFound=G5.wordIdx;
  G5.queue=G5.queue.filter(i=>i!==G5.wordIdx);
  G5.history.push({kind:'r2correct'});
  g5NextWord();
  g5Push();renderG5();
}

// Move to the next word in the queue.
function g5NextWord(){
  if(!G5.queue.length){G5.running=false;g5EndR2(false);return}
  if(G5.queue[0]!==G5.wordIdx){G5.wordIdx=G5.queue[0];G5.animMid=G5.wordIdx}
}

// Pass: the current word goes to the back of the queue. Never with one word left.
function g5R2Pass(){
  if(!G5||G5.step!=='r2')return;
  if(G5.queue.length<=1)return;             // pass is not allowed with one word left
  const cur=G5.queue.shift();
  G5.queue.push(cur);                       // the word that is up goes to the back
  G5.wordIdx=G5.queue[0];
  G5.animMid=G5.wordIdx;
  g5Push();renderG5();
}

// How many words are left.
function g5WordsLeft(){return G5.queue.length}

// End Round 2 for the team that was playing. The next advancing team follows,
// and when they are all done the game is over.
function g5EndR2(completed){
  if(!G5||G5.step==='r2done'||G5.step==='end')return;
  G5.running=false;
  let used=G5.r2startedAt?(Date.now()-G5.r2startedAt)/1000:0;
  used=Math.max(0,Math.min(used-(G5.pausedTotal||0),G5.r2seconds));
  const t=G5.teams[G5.r2team]||{name:'Team 1'};
  G5.r2results.push({team:G5.r2team,name:t.name,guesser:'Member '+(G5.guesser+1),helper:'Member '+(G5.helper+1),
    category:G5.cat,guessed:G5.got.filter(Boolean).length,of:5,seconds:+used.toFixed(1),limit:G5.r2seconds,completed:!!completed,
    words:G5.words.filter((w,i)=>G5.got[i]),
    missed:G5.words.filter((w,i)=>!G5.got[i])});
  G5.step='r2done';
  g5Push();renderG5();
}

// The next team plays, or the game ends.
function g5NextR2Team(){
  if(!G5)return;
  if(G5.r2pos+1<G5.r2teams.length){G5.r2pos++;g5ToPick()}
  else g5Finish2();
}

// Reveal one word: it counts as found and moves to the Found panel.
// Show a word that was not guessed. It does not count for the team.
function g5RevealWord(i){
  if(!G5||G5.step!=='r2'||G5.got[i]||G5.rev[i]||G5.running||!G5.r2startedAt)return;
  G5.rev[i]=true;
  G5.animFound=i;
  G5.queue=G5.queue.filter(x=>x!==i);
  g5Push();renderG5();
}

// Show every word that is left. None of them counts for the team. It may only
// be done when the clock is not running.
function g5RevealAll(){
  if(!G5||G5.step!=='r2'||G5.running||!G5.r2startedAt)return;
  G5.rev=G5.words.map((w,i)=>!G5.got[i]);
  G5.queue=G5.queue.filter(i=>!G5.rev[i]);
  g5NextWord();
  g5Push();renderG5();
}

// The Round 1 standings as they are saved with the result. The qualification to
// Round 2 travels with them, so the final page can mark it.
function g5Standings(list){
  const qual=G5.r2teams||[];
  return list.map(r=>({name:G5.teams[r.team].name,correct:r.found,all:r.all,seconds:r.seconds,
    in:qual.length?qual.indexOf(r.team)>-1:null}));
}

// Did this team go through to Round 2? The flag is saved with the result; a
// record written before the flag existed has none, so the Round 2 table answers
// for it.
function g5Qualified(x,r2s){
  if(typeof x.in==='boolean')return x.in;
  if(!r2s||!r2s.length)return null;
  return r2s.some(t=>(t.team||t.name)===x.name);
}

// The Round 1 table of the last page, used by both screens: every team, the
// answers it found and whether it went through.
function g5EndRows(r1s,r2s){
  return (r1s||[]).map(x=>{
    const q=g5Qualified(x,r2s);
    const cls=q===true?' class="qualified"':q===false?' class="eliminated"':'';
    const txt=q===true?'Qualified':q===false?'Eliminated':'';
    return '<tr'+cls+'><td>'+esc(x.name)+'</td><td>'+x.correct+' of 5</td><td>'+g5Time(x.seconds)+'</td>'+
      '<td>'+txt+'</td></tr>';
  }).join('');
}

// The winner of the game, in a band: the word above the band, the name in the
// gold of the English marker inside it.
function g5WinnerBand(name){
  return '<div class="g5-winner"><span class="g5-winner-label">Winner</span>'+
    '<div class="g5-winner-name">'+esc(name||'')+'</div></div>';
}

// The game is over: the best Round 2 result wins.
function g5Finish2(){
  G5.step='end';G5.running=false;
  const rs=G5.r2results.slice().sort((a,b)=>b.guessed-a.guessed||a.seconds-b.seconds);
  const top=rs[0]||{name:'-',guessed:0,seconds:0,category:'',guesser:'',helper:''};
  const r1=G5.r1results.slice().sort((a,b)=>(b.all-a.all)||(a.seconds-b.seconds));
  G5.result={kind:'gimme5',teams:G5.teams.length,winner:top.name,score:top.guessed,
    r1:{question:G5.q.text,english:!!G5.q.english,winner:r1[0]?G5.teams[r1[0].team].name:'-',
      correct:r1[0]?r1[0].found:0,seconds:r1[0]?r1[0].seconds:0,
      standings:g5Standings(r1)},
    r2:{team:top.name,guesser:top.guesser,helper:top.helper,category:top.category,
      guessed:top.guessed,of:5,seconds:top.seconds,limit:G5.r2seconds,completed:!!top.completed},
    r2all:G5.r2results.map(r=>({team:r.name,category:r.category,guessed:r.guessed,of:5,seconds:r.seconds})),
    by:me()?me().name:''};
  g5SaveResult();
  g5Push();renderG5();
}

// Save (or update) the record of this game.
function g5SaveResult(){
  if(!G5||!G5.result)return;
  const r={...G5.result,id:G5.rid||Date.now()};
  G5.rid=r.id;
  const g=S.games.find(x=>x.id===G5.g.id);
  if(g)g.results=(g.results||[]).filter(x=>x.id!==r.id).concat(r).slice(-30);
  if(REMOTE)rpc('app_save_result',{p_game_id:G5.g.id,p_result:r}).catch(x=>toast('Could not save the result: '+emsg(x)));
}

// Undo an early finish: remove the record and go back a step.
function g5Resume(){
  if(!G5||!G5.result)return;
  const g=S.games.find(x=>x.id===G5.g.id);
  if(g)g.results=(g.results||[]).filter(x=>x.id!==G5.rid);
  if(REMOTE)rpc('app_remove_result',{p_game_id:G5.g.id,p_result_id:String(G5.rid)}).catch(()=>{});
  G5.result=null;G5.early=false;
  G5.step='r2';G5.running=true;G5.endsAt=Date.now()+Math.max(1000,G5.r2seconds*1000-(Date.now()-G5.r2startedAt));
  g5Push();renderG5();
}

// Finish the game early: the winner is picked automatically and can be changed.
function g5Finish(){
  if(!G5)return;
  if(G5.step!=='end'&&!confirm('The game is not finished yet.\n\nFinish it now? The teams will not play the rest of the rounds.'))return;
  G5.early=true;
  G5.running=false;
  const r1s=G5.r1results.slice().sort((a,b)=>(b.all-a.all)||(a.seconds-b.seconds));
  const r2s=G5.r2results.slice();
  if(!G5.result){
    const top=r2s.slice().sort((a,b)=>b.guessed-a.guessed||a.seconds-b.seconds)[0];
    const t=top||{name:r1s[0]?G5.teams[r1s[0].team].name:'-',guessed:0,seconds:0,category:'',guesser:'',helper:''};
    G5.result={kind:'gimme5',teams:G5.teams.length,winner:t.name,score:t.guessed,
      r1:{question:G5.q.text,english:!!G5.q.english,winner:r1s[0]?G5.teams[r1s[0].team].name:'-',
        correct:r1s[0]?r1s[0].found:0,seconds:r1s[0]?r1s[0].seconds:0,
        standings:g5Standings(r1s)},
      r2:{team:t.name,guesser:t.guesser||'Guesser',helper:t.helper||'Helper',category:t.category||'',
        guessed:t.guessed||0,of:5,seconds:t.seconds||0,limit:G5.r2seconds,completed:!!t.completed},
      r2all:r2s.map(r=>({team:r.name,category:r.category,guessed:r.guessed,of:5,seconds:r.seconds})),
      by:me()?me().name:''};
  }
  G5.step='end';
  g5SaveResult();g5Push();renderG5();
}

// Leave the game and go back to the library.
function g5Leave(){
  clearInterval(G5_TIMER);G5=null;
  if(G5_SESSION){G5_SEEN=0}
  go('lib');
}

// Start the Round 2 clock.
function g5StartR2(){
  if(!G5||G5.step!=='r2')return;
  G5.pausedLeft=0;G5.timeUp=false;
  G5.r2startedAt=Date.now();G5.running=true;G5.endsAt=G5.r2startedAt+G5.r2seconds*1000;
  G5.animMid=G5.wordIdx;
  g5Push();renderG5();
}

// Go back a step (the ranking back to the round, round 2 back to the pick, and so on).
function g5Back(){
  if(!G5)return;
  if(G5.step==='r1done'){G5.r1results.pop();G5.step='r1';G5.running=false}
  else if(G5.step==='r2done'){G5.r2results.pop();G5.step='r2';G5.running=false}
  else if(G5.step==='r1rank'){G5.step='r1';G5.running=false}
  else if(G5.step==='r2'){G5.step='r2pick';G5.running=false;G5.cat=null}
  else if(G5.step==='r2pick'){G5.step='r1rank';G5.running=false}
  else if(G5.step==='r1'){G5.step='r1pick';G5.running=false}
  else if(G5.step==='r1pick'){G5.step='welcome';G5.running=false}
  else if(G5.step==='welcome'){G5.step='setup';G5.running=false}
  else if(G5.step==='end'){G5.step='r2';G5.running=false}
  g5Push();renderG5();
}

// Skip to the next round.
function g5SkipRound(){
  if(!G5)return;
  if(G5.step==='setup'||G5.step==='welcome'||G5.step==='r1pick'||G5.step==='r1'){
    G5.r1results=G5.teams.map((t,i)=>({team:i,found:0,all:false,seconds:+(G5.q.seconds||60)}));
    g5Rank1();
  }else if(G5.step==='r1rank')g5ToPick();
  else if(G5.step==='r2pick'){
    const cat=G5.boxes.find(b=>b.cat).cat;
    const sets=G5.g.round2.categories[cat]||[];
    G5.cat=cat;G5.words=sets.length?g5Shuffle(sets)[0].slice(0,5):['','','','',''];
    G5.got=[false,false,false,false,false];G5.wordIdx=0;G5.step='r2';
    G5.r2startedAt=Date.now();G5.running=true;G5.endsAt=G5.r2startedAt+G5.r2seconds*1000;G5.flash=Date.now();
  }
  g5Push();renderG5();
}

// Choose which of the pair guesses and which one helps.
function g5SetPair(guesser,helper){if(!G5)return;G5.guesser=guesser;G5.helper=helper;g5Push();renderG5()}


/* ---------- the host screen ---------- */

// The square E marker, drawn like a game tile.
function g5EMark(){return '<span class="g5-e" aria-label="Answers must be in English">E</span>'}

// The operator reveals one answer by hand. It does not count for the team and
// it does not end the round.
function g5RevealAnswer(i){
  if(!G5||G5.step!=='r1'||!G5.startedAt||G5.found[i])return;
  G5.found[i]={team:-1,at:g5Elapsed(),revealed:true};
  G5.animUnfound=i;
  g5Push();renderG5();
}

// Make the word that is up fit on its card: when the word is long the letters
// get smaller, so it never breaks and never touches the line.
function g5FitWord(){
  const cards=document.querySelectorAll('.g5-r2 .g5-card.big');
  for(let i=0;i<cards.length;i++){
    const card=cards[i];
    const w=card.querySelector('.g5-card-w');
    if(!w)continue;
    w.style.fontSize='';
    const cs=getComputedStyle(card);
    const room=card.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)-4;
    const high=card.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom);
    const size=parseFloat(getComputedStyle(w).fontSize)||32;
    // the width the word needs on one line
    w.style.whiteSpace='nowrap';
    const need=w.scrollWidth;
    w.style.whiteSpace='';
    if(!room||!need)continue;
    // the word fills the card, and a long word is only a little smaller
    const want=Math.min(size*1.8,size*room/need,high/1.35);
    const fit=Math.max(size*0.72,want);
    if(Math.abs(fit-size)>0.5)w.style.fontSize=Math.floor(fit)+'px';
  }
}

// The operator-only answer list. It is never part of a snapshot.
function g5OpsList(){
  const rows=G5.q.answers.map((a,i)=>{
    const f=G5.found[i];
    if(!f)return '<li><button class="g5-ops-a" onclick="'+(G5.timeUp?'g5RevealAnswer(':'g5Correct(')+i+')"'+(G5.startedAt?'':' disabled')+'>'+esc(a)+'</button></li>';
    if(f.revealed)return '<li class="revealed"><span class="g5-ops-a">'+esc(a)+'</span><em>not guessed</em></li>';
    return '<li class="found"><span class="g5-ops-a">'+esc(a)+'</span><em>'+g5Time(f.at)+'</em></li>';
  });
  const t=G5.teams[G5.r1team]||{name:'Team 1'};
  return '<aside class="g5-ops"><span class="g5-ops-label">Answers, operator only</span>'+
    '<span class="g5-ops-who">'+esc(t.name)+'</span>'+
    '<ol>'+rows.join('')+'</ol></aside>';
}

// The five answer slots of Round 1.
function g5Slots(){
  return '<div class="g5-slots">'+G5.q.answers.map((a,i)=>{
    const f=G5.found[i];
    if(!f)return '<div class="g5-slot"><span class="g5-num">'+(i+1)+'</span><span class="g5-ans"></span></div>';
    if(f.revealed)return '<div class="g5-slot revealed"><span class="g5-num">'+(i+1)+'</span><span class="g5-ans">'+esc(a)+'</span></div>';
    return '<div class="g5-slot found'+(G5.animSlot===i?' fly':'')+'"><span class="g5-num">'+(i+1)+'</span><span class="g5-ans">'+esc(a)+'</span></div>';
  }).join('')+'</div>';
}

// The blind pick on the audience screen: the same pyramid of cards.
function g5BoxRows(boxes){
  const n=boxes.length;
  const card=(b,i)=>'<div class="g5-box'+(b.picked?' picked':'')+'">'+
    '<span class="g5-box-n">'+b.n+'</span><span class="g5-box-c">'+(b.picked?'Picked':'')+'</span></div>';
  const top=Math.ceil(n/2);
  const row=arr=>arr.length?'<div class="g5-boxrow">'+arr.map(card).join('')+'</div>':'';
  return row(boxes.slice(0,top))+row(boxes.slice(top));
}

// The blind pick: one rectangle per question (Round 1) or per category (Round 2).
// The boxes are numbered from 1, and a box that has been picked is marked.
function g5Boxes(kind){
  const n=G5.boxes.length;
  const card=(b,i)=>'<button class="g5-box'+(b.picked?' picked':'')+(i===0?' first':'')+'" onclick="'+(kind==='q'?'g5PickQ(':'g5PickBox(')+i+')"'+(b.picked?' disabled':'')+'>'+
    '<span class="g5-box-n">'+(i+1)+'</span>'+
    '<span class="g5-box-c">'+(b.picked?'Picked':'')+'</span></button>';
  // the cards sit in a pyramid: the top row takes the most, the rows below
  // take the rest, so five cards are three on top and two below. The number of
  // a card is its place in the whole list, not in its row.
  const top=Math.ceil(n/2);
  const row=(from,to)=>to>from?'<div class="g5-boxrow">'+
    G5.boxes.slice(from,to).map((b,j)=>card(b,from+j)).join('')+'</div>':'';
  return '<div class="g5-boxes">'+row(0,top)+row(top,n)+'</div>';
}

// The welcome message, shown before a round so the clock does not start at once.
function g5WelcomePanel(){
  const g=G5.g;
  return '<div class="stage-welcome">'+
    '<div class="w-head"><h2 class="w-title">'+esc(g.series||g.title)+'</h2></div>'+
    '<div class="w-mid">'+
    '<p class="w-series">'+esc(g.title)+'</p>'+
    (g.desc?'<p class="g5-gamedesc">'+esc(g.desc)+'</p>':'')+
    (g.date?'<p class="w-date">'+esc(g.date)+'</p>':'')+
    '</div>'+
    '<div class="w-foot">'+
    '<p class="g5-gameinstr">'+esc(g.instr||G5_INSTR)+'</p>'+
    '<button class="btn pri" onclick="g5Begin()">Begin</button></div></div>';
}

// The welcome message as a block for the instructions slide.
function g5WelcomeBlock(g){
  if(!(g.series||g.sub||g.date||g.welcome))return '';
  return '<div class="welcome-block">'+
    (g.series?'<p class="w-series">'+esc(g.series)+'</p>':'')+
    (g.sub?'<p class="w-sub">'+esc(g.sub)+'</p>':'')+
    (g.date?'<p class="w-date">'+esc(g.date)+'</p>':'')+
    (g.welcome?'<p class="w-phrase">'+esc(g.welcome)+'</p>':'')+'</div>';
}

// The control panel, in the same three groups as Word Chain.
function g5Panel(){
  const nav=[],tools=[],fin=[];
  if(G5.step==='r1'){
    nav.push('<button class="btn" onclick="g5Back()">Back</button>');
    nav.push('<button class="btn" onclick="g5SkipRound()">Skip round</button>');
    if(!G5.running&&!G5.startedAt)tools.push('<button class="btn pri" onclick="g5Start()">Start the round</button>');
    else tools.push('<button class="btn" onclick="g5Toggle()"'+(G5.timeUp?' disabled':'')+'>'+(G5.timeUp?'Time is up':(G5.running?'Pause':'Resume'))+'</button>');
    tools.push('<button class="btn" onclick="g5Undo()">Undo last</button>');
    // the answers may only be revealed when the clock is not running
    const shown=G5.found.every(f=>f);
    tools.push('<button class="btn" onclick="g5RevealRest()"'+(G5.startedAt&&!G5.running?'':' disabled')+'>'+(shown?'Show the result':'Reveal remaining')+'</button>');
  }else if(G5.step==='r2'){
    nav.push('<button class="btn" onclick="g5Back()">Back</button>');
    if(!G5.running&&!G5.r2startedAt)tools.push('<button class="btn pri" onclick="g5StartR2()">Start the round</button>');
    else tools.push('<button class="btn" onclick="g5Toggle()"'+(G5.timeUp?' disabled':'')+'>'+(G5.timeUp?'Time is up':(G5.running?'Pause':'Resume'))+'</button>');
    // the word may only be marked when the round has started and the clock runs
    tools.push('<button class="btn pri" onclick="g5R2Correct()"'+(G5.r2startedAt&&!G5.timeUp?'':' disabled')+'>Correct</button>');
    // the words may only be revealed when the clock is not running
    tools.push('<button class="btn" onclick="g5RevealAll()"'+(G5.r2startedAt&&!G5.running?'':' disabled')+'>Reveal the rest</button>');
    tools.push('<button class="btn" onclick="g5R2Pass()"'+(g5WordsLeft()<=1?' disabled':'')+'>Pass</button>');
  }else if(G5.step==='r1done'||G5.step==='r2done'){
    // the result of the team that has just played: the screen itself moves on
    nav.push('<button class="btn" onclick="g5Back()">Back</button>');
  }else if(G5.step==='r1rank'){
    nav.push('<button class="btn" onclick="g5Back()">Back</button>');
  }else if(G5.step==='r2pick'||G5.step==='r1pick'){
    nav.push('<button class="btn" onclick="g5Back()">Back</button>');
  }else if(G5.step==='setup'){
    nav.push('<button class="btn" onclick="g5SkipRound()">Skip round</button>');
  }
  tools.push('<button class="btn" onclick="g5OpenPresent()">Present</button>');
  if(G5.step!=='end')fin.push('<button class="btn" onclick="g5Finish()">Finish game</button>');
  fin.push('<button class="btn" onclick="g5Leave()">Exit</button>');
  const grp=(l,arr)=>arr.length?'<div class="hgroup"><span class="hlabel">'+l+'</span><div class="hrow">'+arr.join('')+'</div></div>':'';
  return '<div class="hostpanel">'+grp('Navigation',nav)+grp('Tools',tools)+grp('Finish',fin)+'</div>';
}

// The host screen of Gimme 5.
function renderG5(){
  if(!G5)return;
  const g=G5.g;
  const stepName={setup:'Setup',welcome:'Welcome',r1pick:'Pick a number',r1:'Round 1',r1done:'Team result',r1rank:'Round 1 ranking',r2pick:'Pick a number',r2:'Round 2',r2done:'Team result',end:'Finished'}[G5.step];
  let body='';
  if(G5.step==='setup'){
    body='<div class="slide"><div class="slide-in g5-setup">'+
      '<div class="g5-setup-head"><h1 class="g5-gametitle">'+esc(g.series||g.title)+'</h1></div>'+
      '<div class="g5-setup-foot">'+
      '<div class="formrow"><div class="field"><label class="label" for="g5nt">Number of teams</label>'+
      '<select id="g5nt" onchange="g5SetTeams(+this.value)">'+[2,3,4,5,6,7,8,9,10].map(n=>'<option value="'+n+'" '+(G5.teams.length===n?'selected':'')+'>'+n+'</option>').join('')+'</select></div>'+
      '<div class="field"><label class="label" for="g5na">Teams that proceed to Round 2</label>'+
      '<select id="g5na" onchange="g5SetAdvance(+this.value)">'+[1,2,3,4,5].map(n=>'<option value="'+n+'" '+(G5.advance===n?'selected':'')+'>'+n+'</option>').join('')+'</select></div></div>'+
      '<div class="formrow">'+G5.teams.map((t,i)=>'<div class="field"><label class="label" for="g5tn'+i+'">Team '+(i+1)+'</label>'+
        '<input id="g5tn'+i+'" value="'+esc(t.name)+'" oninput="G5.teams['+i+'].name=this.value"></div>').join('')+'</div>'+
      '<p class="note">Each team blind-picks a question, then the team works together to find all five answers. The fastest team goes to Round 2, and the answers are on your screen only.</p>'+
      '<div class="actions"><button class="btn pri" onclick="g5Welcome()">Start Round 1</button>'+
      '<button class="btn" onclick="g5SkipRound()">Skip to Round 2</button></div>'+
      '</div></div></div>';
  }else if(G5.step==='welcome'){
    body=g5WelcomePanel();
  }else if(G5.step==='r1pick'){
    body='<div class="slide"><div class="slide-in g5-pick">'+
      '<div class="g5-pickhead"><h1>Pick a number</h1></div>'+
      '<div class="g5-pickband"><p class="g5-picksub">'+G5_PICK1+'</p>'+
      (G5.redealt?'<p class="note">The questions are back: these numbers are free again, the ones that were taken stay taken.</p>':'')+
      g5Boxes('q')+'</div>'+
      '<div class="actions"><button class="btn" onclick="g5Back()">Back</button></div></div></div>';
  }else if(G5.step==='r1'){
    const flash=Date.now()-G5.flash<2500;
    const t=G5.teams[G5.r1team]||{name:'Team 1'};
    body='<div class="g5-play"><div class="g5-main">'+
      '<div class="g5-qhead"><span class="g5-qtext">'+esc(G5.q.text)+(G5.q.english?g5EMark():'')+'</span></div>'+
      (G5.timeUp?'<p class="warnnote g5-timenote">The time is up. Reveal the remaining answers to end the round.</p>':'')+
      g5Slots()+'</div>'+g5OpsList()+'</div>';
  }else if(G5.step==='r1done'){
    const r=G5.r1results[G5.r1results.length-1]||{};
    const t=G5.teams[r.team]||{name:'Team 1'};
    body='<div class="slide g5-resultpage"><div class="slide-in"><p class="eyebrow">Round 1</p><h1>'+esc(t.name)+'</h1>'+
      '<div class="g5-result"><div class="g5-result-nums">'+
      '<div><span class="g5-result-big">'+g5Time(r.seconds||0)+'</span><span class="note">Time taken</span></div>'+
      '<div><span class="g5-result-big">'+(r.found||0)+' of 5</span><span class="note">Answers found</span></div></div>'+
      '<div class="g5-result-ans">'+
      (r.question?'<p class="g5-result-q">'+esc(r.question)+'</p>':'')+
      '<div><div class="g5-found-words">'+(r.words&&r.words.length?r.words.map(w=>'<span class="g5-found-word">'+esc(w)+'</span>').join(''):'<span class="note">No answers were found.</span>')+'</div>'+
      (r.missed&&r.missed.length?'<div class="g5-missed"><span class="label">Unfound</span><div class="g5-found-words">'+
        r.missed.map(w=>'<span class="g5-found-word">'+esc(w)+'</span>').join('')+'</div></div>':'')+'</div></div></div>'+
      '<div class="actions"><button class="btn pri" onclick="g5NextTeam()">'+(G5.r1team+1<G5.teams.length?'Next team':'See the ranking')+'</button></div></div></div>';
  }else if(G5.step==='r1rank'){
    const rs=G5.r1results.slice().sort((a,b)=>(b.all-a.all)||(a.seconds-b.seconds));
    body='<div class="slide"><div class="slide-in"><p class="eyebrow">Round 1</p><h1>Round 1 ranking</h1>'+
      '<table class="tbl"><thead><tr><th>Rank</th><th>Team</th><th>Answers</th><th>Time</th><th>Round 2</th></tr></thead><tbody>'+
      rs.map((r,i)=>'<tr class="'+(i===0?'first':'')+(G5.r2teams.indexOf(r.team)>-1?' qualified':' eliminated')+'"><td>'+(i+1)+'</td><td>'+esc(G5.teams[r.team].name)+'</td>'+
        '<td>'+r.found+' of 5</td><td>'+g5Time(r.seconds)+'</td>'+
        '<td>'+(G5.r2teams.indexOf(r.team)>-1?'Qualified':'Eliminated')+'</td></tr>').join('')+
      '</tbody></table>'+
      '<p class="note">The '+G5.advance+' fastest team'+(G5.advance>1?'s':'')+' go to Round 2.</p>'+
      '<div class="actions"><button class="btn pri" onclick="g5ToPick()">Start Round 2</button>'+
      '<button class="btn" onclick="g5Back()">Back</button></div></div></div>';
  }else if(G5.step==='r2pick'){
    body='<div class="slide"><div class="slide-in g5-pick"><p class="eyebrow">Round 2</p><h1>Round 2</h1>'+
      '<div class="g5-pickband"><p class="g5-picksub">'+G5_PICK2+'</p>'+
      g5Boxes('cat')+'</div>'+
      '<div class="actions"><button class="btn" onclick="g5Back()">Back</button></div></div></div>';
  }else if(G5.step==='r2'){
    const flash=Date.now()-G5.flash<2500;
    const cur=G5.words[G5.wordIdx]||'';
    const live=!!G5.r2startedAt;                 // the word is only shown once the round has started
    const mid=live?G5.wordIdx:-1;
    const canReveal=!!G5.r2startedAt&&!G5.running;
    const left=G5.queue.map(i=>i===mid?'':
      '<button class="g5-card'+(G5.rev[i]?' rev':'')+'"'+(canReveal?' onclick="g5RevealWord('+i+')"':' disabled')+'>'+
      '<span class="g5-card-n">'+(i+1)+'</span><span class="g5-card-w">'+(G5.rev[i]?esc(G5.words[i]):'?')+'</span></button>').join('');
    const found=G5.words.map((w,i)=>G5.got[i]?
      '<div class="g5-card done'+(G5.animFound===i?' fly':'')+'"><span class="g5-card-n">'+(i+1)+'</span><span class="g5-card-w">'+esc(w)+'</span></div>':'').join('');
    const foundCount=G5.got.filter(Boolean).length;
    body='<div class="g5-board"><div class="g5-catline">'+esc(G5.cat||'')+'</div>'+
      (G5.timeUp?'<p class="warnnote g5-timenote">The time is up. Reveal the rest to end the round.</p>':'')+
      '<div class="g5-r2">'+
      '<div class="g5-col g5-left"><h3>Remaining</h3><div class="g5-count">'+Math.max(0,G5.queue.length-1)+' left</div>'+
      '<div class="g5-stack g5-small">'+left+'</div></div>'+
      '<div class="g5-col g5-mid"><h3>Guess</h3><div class="g5-stack g5-focus">'+
      (live?'<div class="g5-card big'+(G5.animMid===mid?' fly':'')+'"><span class="g5-card-n">'+(mid+1)+'</span>'+
        '<span class="g5-card-w">'+esc(cur)+'</span></div>'
        :'<div class="g5-card big face"><span class="g5-card-n">1</span><span class="g5-card-w">?</span></div>')+
      '</div></div>'+
      '<div class="g5-col g5-right"><h3>Found</h3><div class="g5-count">'+foundCount+' found</div>'+
      '<div class="g5-stack g5-small">'+found+'</div></div>'+
      '</div></div>';
  }else if(G5.step==='r2done'){
    const r=G5.r2results[G5.r2results.length-1]||{};
    const t=G5.teams[G5.r2team]||{name:'Team 1'};
    body='<div class="slide g5-resultpage"><div class="slide-in"><p class="eyebrow">Round 2</p><h1>'+esc(t.name)+'</h1>'+
      '<div class="g5-result"><div class="g5-result-nums">'+
      '<div><span class="g5-result-big">'+g5Time(r.seconds||0)+'</span><span class="note">Time taken</span></div>'+
      '<div><span class="g5-result-big">'+(r.guessed||0)+' of 5</span><span class="note">Words found</span></div></div>'+
      '<div class="g5-result-ans">'+
      (r.category?'<p class="g5-result-q">'+esc(r.category)+'</p>':'')+
      '<div><div class="g5-found-words">'+(r.words&&r.words.length?r.words.map(w=>'<span class="g5-found-word">'+esc(w)+'</span>').join(''):'<span class="note">No words were found.</span>')+'</div>'+
      (r.missed&&r.missed.length?'<div class="g5-missed"><span class="label">Unfound</span><div class="g5-found-words">'+
        r.missed.map(w=>'<span class="g5-found-word">'+esc(w)+'</span>').join('')+'</div></div>':'')+'</div></div></div>'+
      '<div class="actions"><button class="btn pri" onclick="g5NextR2Team()">'+(G5.r2pos+1<G5.r2teams.length?'Next team':'See the result')+'</button></div></div></div>';
  }else{
    const r=G5.result||{};
    const r1s=(r.r1&&r.r1.standings)||[];
    const r2s=r.r2all||[];
    body='<div class="slide g5-resultpage"><div class="slide-in"><h1>To God Be the Glory</h1>'+
      '<div class="g5-end"><div><h3>Round 1</h3>'+
      '<table class="tbl"><thead><tr><th>Team</th><th>Answers</th><th>Time</th><th>Round 2</th></tr></thead><tbody>'+
      g5EndRows(r1s,r2s)+
      '</tbody></table></div>'+
      '<div><h3>Round 2</h3>'+
      (r2s.length?'<table class="tbl"><thead><tr><th>Team</th><th>Category</th><th>Words</th><th>Time</th></tr></thead><tbody>'+
        r2s.map(x=>'<tr><td>'+esc(x.team)+'</td><td>'+esc(x.category)+'</td><td>'+x.guessed+' of 5</td><td>'+g5Time(x.seconds)+'</td></tr>').join('')+
        '</tbody></table>':'<p class="note">No team went through to Round 2.</p>')+
      '</div></div>'+
      g5WinnerBand(r.winner)+
      '<div class="actions">'+(G5.early?'<button class="btn" onclick="g5Resume()">Resume game</button>':'')+
      '<button class="btn pri" onclick="g5Leave()">Back to the library</button></div></div></div>';
  }
  // the top bar is the same on both screens: the title, the countdown in the
  // middle and the round on the right (the audience screen puts the name of the
  // church there instead). The clock keeps its place even when it is not
  // running, so nothing jumps.
  const live=G5.step==='r1'||G5.step==='r2';
  const clock='<span class="stage-clock num"'+(live?' data-countdown':'')+'>'+(live?g5Clock(g5ShowLeft()):'')+'</span>';
  const html='<div id="stage" class="g5stage"><header class="stage-top"><div class="stage-title">'+esc(g.title)+'</div>'+clock+
    '<div class="stage-meta"><span class="stage-round">'+stepName+'</span>'+
    (G5.step==='r2pick'||G5.step==='r2'||G5.step==='r2done'?'<span class="stage-team">'+esc((G5.teams[G5.r2team]||{}).name||'')+'</span>':'')+
    '<span class="g5-present'+(g5PresentOk()?' on':'')+'" data-present>Present window '+(g5PresentOk()?'connected':'not connected')+'</span></div></header>'+
    '<div class="stage-body">'+body+'</div>'+
    '<div class="stage-foot">'+g5Panel()+
    '<p class="stage-keys">Keys 1 to 5 mark an answer correct. Space starts or pauses.'+
    (G5.step==='r2'?' Enter is correct, P is pass.':'')+'</p></div></div>';
  $('#app').innerHTML=html;
  stageBrand($('#stage'));
  g5FitWord();
  g5FitHost();
  if(G5.step==='r1'||G5.step==='r2')g5ClockPaint();
  // the card animations play once
  G5.animMid=-1;G5.animFound=-1;G5.animUnfound=-1;G5.animSlot=-1;
}

// A game screen must fit the screen it is on: when the content is taller, the
// type of the page is set smaller, a little at a time, until it fits. Only when
// it can shrink no further does a scrollbar stay. This is what keeps the
// audience screen clean for the projector.
function g5FitBox(box,sel){
  if(!box)return;
  const stage=box.closest('.g5stage')||box;
  stage.classList.remove('g5-tight');
  // a scrollbar is a scrollbar: even a single pixel of overflow turns one on
  const EPS=0;
  if(box.scrollHeight>box.clientHeight+EPS)stage.classList.add('g5-tight');
  const els=[...box.querySelectorAll(sel)];
  if(!els.length)return;
  els.forEach(e=>{e.style.fontSize=''});
  const cur=els.map(e=>parseFloat(getComputedStyle(e).fontSize)||16);
  // a table stops shrinking earlier than a heading: it is read row by row
  const min=els.map((e,i)=>Math.max(12,cur[i]*(e.matches('.tbl')?.62:.5)));
  let round=0;
  while(box.scrollHeight>box.clientHeight+EPS&&round++<8){
    const over=box.scrollHeight-box.clientHeight;
    const k=Math.max(.72,1-Math.max(.05,over/box.scrollHeight));
    let moved=false;
    els.forEach((e,i)=>{
      const next=Math.max(min[i],cur[i]*k);
      if(next<cur[i]-.1){cur[i]=next;e.style.fontSize=next.toFixed(1)+'px';moved=true}
    });
    if(!moved)break;
  }
}

// The pick cards are as tall as the room the page has for them. They are set by
// width in CSS, so on a short screen two rows of them would spill out of the
// band and bring a scrollbar: the band is measured, and the cards are made
// shorter (never taller) so the rows fit it.
function g5FitBoxes(){
  const band=document.querySelector('.g5-pickband');
  if(!band)return;
  const cards=[...band.querySelectorAll('.g5-box')];
  const rows=[...band.querySelectorAll('.g5-boxrow')];
  if(!cards.length||!rows.length)return;
  cards.forEach(b=>{b.style.height=''});
  if(band.scrollHeight<=band.clientHeight)return;
  // a short screen first gives the page tighter spacing, so the cards keep as
  // much of their size as the screen allows
  const stage=band.closest('.g5stage');
  if(stage&&!stage.classList.contains('g5-tight')){
    stage.classList.add('g5-tight');
    if(band.scrollHeight<=band.clientHeight+1)return;
  }
  let h=Math.floor(cards[0].getBoundingClientRect().height);
  let guard=0;
  // each step takes the overflow off every row, so one or two steps are enough
  while(band.scrollHeight>band.clientHeight&&h>56&&guard++<8){
    h=Math.max(56,h-Math.max(2,Math.ceil((band.scrollHeight-band.clientHeight)/rows.length)));
    cards.forEach(b=>{b.style.height=h+'px'});
  }
}

// Fit the operator's screen after a redraw.
function g5FitHost(){
  const box=document.querySelector('.g5-play')||document.querySelector('.stage-body .slide')||document.querySelector('.stage-body');
  g5FitBox(box,'.g5-qtext, h1, h3, .tbl, .g5-result-big, .g5-found-word, .g5-catline, .g5-winner-name');
  g5FitBoxes();
}

// Fit the audience screen after a redraw.
function g5FitPresent(){
  const box=document.querySelector('.g5-present-body');
  g5FitBox(box,'.g5-qtext, .g5-result-q, h3, .tbl, .g5-result-big, .g5-found-word, .g5-picksub, .g5-catline, .g5-winner-name');
  g5FitBoxes();
}

// Change the number of teams at setup.
function g5SetTeams(n){
  if(!G5)return;n=Math.min(10,Math.max(2,n));
  while(G5.teams.length<n)G5.teams.push({name:'Team '+(G5.teams.length+1)});
  G5.teams.length=n;
  renderG5();
}

// Change the number of members in each team.
function g5SetMembers(n){
  if(!G5)return;G5.members=Math.min(6,Math.max(1,n));G5.helper=G5.members>1?1:0;renderG5();
}

// Change how many teams go through to Round 2.
function g5SetAdvance(n){
  if(!G5)return;G5.advance=Math.min(5,Math.max(1,n));renderG5();
}


/* ---------- the present window (audience view) ---------- */

// Start the present window: the audience view only, no login and no database.
function presentG5Boot(session){
  G5P={session:session,snap:null,ch:null,timer:null};
  document.body.classList.add('present');
  document.title='Present';
  try{
    G5P.ch=new BroadcastChannel('gimme5-'+session);
    G5P.ch.onmessage=e=>{const d=e.data||{};if(d.t==='g5'&&d.session===session)G5P.snap=d;g5PresentPaint()};
  }catch(e){}
  // the localStorage fallback
  addEventListener('storage',e=>{
    if(e.key!=='g5-'+session||!e.newValue)return;
    try{const d=JSON.parse(e.newValue);if(d.t==='g5'){G5P.snap=d;g5PresentPaint()}}catch(err){}
  });
  // say hello, and keep saying it so the host knows we are there
  const ping=()=>{
    try{if(G5P.ch)G5P.ch.postMessage({t:'hello',session:session})}catch(e){}
    try{localStorage.setItem('g5p-'+session,String(Date.now()))}catch(e){}
  };
  ping();
  G5P.timer=setInterval(ping,2000);
  G5P.clock=setInterval(g5PresentClock,200);
  let rt=null;
  addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{if(G5P)g5PresentPaint()},250)});
  // the web font can arrive after the first paint: draw again when it does
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{if(G5P)g5PresentPaint()});
  g5PresentPaint();
}

// Update the countdown on the audience screen.
function g5PresentClock(){
  const s=G5P&&G5P.snap;if(!s)return;
  const c=s.clock||{};
  // running: count down to the end. Not running: the time that is left, or the
  // whole time before the round starts (the host sends it as `left`).
  const left=c.running&&c.endsAt?Math.max(0,c.endsAt-Date.now()):(c.left!=null?c.left:0);
  document.querySelectorAll('[data-countdown]').forEach(el=>{el.textContent=g5Clock(left)});
}

// Draw the audience view of Gimme 5.
function g5PresentPaint(){
  const s=G5P&&G5P.snap;
  if(!s){$('#app').innerHTML='<div id="stage" class="g5stage"><div class="g5-present-wait">Waiting for the host...</div></div>';return}
  let body='';
  // the flash is played once, when a new one comes in
  const fid=s.flashId||((s.r2&&s.r2.flashId)||0);
  if(fid&&fid!==G5P.lastFlash){G5P.lastFlash=fid;g5Flash()}
  if(s.game){
    // before the first round: the same text as the host's screen
    const gm=s.game;
    const welcome=s.welcome||{};
    const setup=s.step==='setup';
    body='<div class="g5-welcome">'+
      '<div class="w-head"><h2 class="w-title">'+esc(gm.series||gm.title)+'</h2></div>'+
      (setup?'':
      '<div class="w-mid">'+
      '<p class="w-series">'+esc(gm.title)+'</p>'+
      (gm.desc?'<p class="g5-gamedesc">'+esc(gm.desc)+'</p>':'')+
      (welcome.date?'<p class="w-date">'+esc(welcome.date)+'</p>':'')+
      '</div>'+
      '<div class="w-foot">'+
      (welcome.phrase?'<p class="w-phrase">'+esc(welcome.phrase)+'</p>':'')+
      (gm.instr?'<p class="g5-gameinstr">'+esc(gm.instr)+'</p>':'')+'</div>')+
      '</div>';
  }else if(s.result){
    // the team that has just played: the time and what they found
    const n=s.result.found!=null?s.result.found:(s.result.guessed||0);
    const missed=(s.result.missed||[]);
    body='<div class="g5-resultpage"><div class="g5-qhead"><span class="g5-qtext">'+esc(s.result.team)+'</span></div>'+
      '<div class="g5-result"><div class="g5-result-nums">'+
      '<div><span class="g5-result-big">'+g5Time(s.result.seconds||0)+'</span><span class="note">Time taken</span></div>'+
      '<div><span class="g5-result-big">'+n+' of 5</span><span class="note">'+(s.result.found!=null?'Answers found':'Words found')+'</span></div></div>'+
      '<div class="g5-result-ans">'+
      ((s.result.question||s.result.category)?'<p class="g5-result-q">'+
        esc(s.result.question||s.result.category)+'</p>':'')+
      '<div>'+
      (s.result.words&&s.result.words.length?'<div class="g5-found-words">'+s.result.words.map(w=>'<span class="g5-found-word">'+esc(w)+'</span>').join('')+'</div>':'')+
      (missed.length?'<div class="g5-missed"><span class="label">Unfound</span><div class="g5-found-words">'+
        missed.map(w=>'<span class="g5-found-word">'+esc(w)+'</span>').join('')+'</div></div>':'')+'</div></div></div>';
  }else if(s.standings){
    // the Round 1 ranking, so the contestants can see it
    body='<div class="g5-qhead"><span class="g5-qtext">Round 1 ranking</span></div>'+
      '<table class="tbl"><thead><tr><th>Rank</th><th>Team</th><th>Answers</th><th>Time</th><th>Round 2</th></tr></thead><tbody>'+
      s.standings.map((r,i)=>'<tr class="'+(i===0?'first':'')+(r.in?' qualified':' eliminated')+'"><td>'+(i+1)+'</td><td>'+esc(r.name)+'</td>'+
        '<td>'+r.correct+' of 5</td><td>'+g5Time(r.seconds)+'</td><td>'+(r.in?'Qualified':'Eliminated')+'</td></tr>').join('')+
      '</tbody></table>';
  }else if(s.pick){
    // the blind pick: the choices, with the numbers that have been picked
    body='<div class="g5-pickwrap">'+
      '<div class="g5-pickhead"><span class="g5-qtext">Pick a number</span></div>'+
      '<div class="g5-pickband">'+
      (s.pickText?'<p class="g5-picksub">'+esc(s.pickText)+'</p>':'')+
      '<div class="g5-boxes">'+g5BoxRows(s.boxes||[])+'</div></div></div>';
  }else if(s.question){
    const unfound=(s.unfound||[]);
    body='<div class="g5-qhead"><span class="g5-qtext">'+esc(s.question.text)+(s.question.english?g5EMark():'')+'</span></div>'+
      '<div class="g5-slots">'+[0,1,2,3,4].map(i=>{
        const f=s.slots&&s.slots[i];
        if(!f)return '<div class="g5-slot"><span class="g5-num">'+(i+1)+'</span><span class="g5-ans"></span></div>';
        if(f.revealed)return '<div class="g5-slot revealed"><span class="g5-num">'+(i+1)+'</span><span class="g5-ans">'+esc(f.answer)+'</span></div>';
        return '<div class="g5-slot found'+(s.anim&&s.anim.slot===i?' fly':'')+'"><span class="g5-num">'+(i+1)+'</span><span class="g5-ans">'+esc(f.answer)+'</span></div>';
      }).join('')+'</div>'+
      '';
  }else if(s.end){
    const r1s=(s.end.r1&&s.end.r1.standings)||[],r2s=s.end.r2all||[];
    body='<div class="g5-qhead"><span class="g5-qtext">To God Be the Glory</span></div>'+
      '<div class="g5-end"><div><h3>Round 1</h3><table class="tbl"><thead><tr><th>Team</th><th>Answers</th><th>Time</th><th>Round 2</th></tr></thead><tbody>'+
      g5EndRows(r1s,r2s)+
      '</tbody></table></div><div><h3>Round 2</h3>'+
      (r2s.length?'<table class="tbl"><thead><tr><th>Team</th><th>Category</th><th>Words</th><th>Time</th></tr></thead><tbody>'+
        r2s.map(x=>'<tr><td>'+esc(x.team)+'</td><td>'+esc(x.category)+'</td><td>'+x.guessed+' of 5</td><td>'+g5Time(x.seconds)+'</td></tr>').join('')+
        '</tbody></table>':'<p class="note">No team went through to Round 2.</p>')+'</div></div>'+
      g5WinnerBand(s.end.winner);
  }else if(s.r2){
    // the Round 2 board: the words wait on the left as cards, the word that is
    // up sits in the middle, and the words that were found stay on the right
    const ws=s.r2.words||[],got=s.r2.got||[],rev=s.r2.rev||[];
    const mid=(s.r2.mid!=null&&s.r2.mid>=0)?s.r2.mid:-1;
    const anim=s.anim||{};
    const queue=(s.r2.queue&&s.r2.queue.length)?s.r2.queue:[0,1,2,3,4];
    const left=queue.map(i=>(got[i]||i===mid)?'':
      '<div class="g5-card'+(rev[i]?' rev':'')+'"><span class="g5-card-n">'+(i+1)+'</span>'+
      '<span class="g5-card-w">'+(rev[i]&&ws[i]?esc(ws[i]):'?')+'</span></div>').join('');
    const found=[0,1,2,3,4].map(i=>got[i]?
      '<div class="g5-card done'+(anim.found===i?' fly':'')+'"><span class="g5-card-n">'+(i+1)+'</span>'+
      '<span class="g5-card-w">'+esc(ws[i]||'')+'</span></div>':'').join('');
    const foundCount=got.filter(Boolean).length;
    body='<div class="g5-board"><div class="g5-catline">'+esc(s.r2.category||'')+'</div>'+
      '<div class="g5-r2">'+
      '<div class="g5-col g5-left"><h3>Remaining</h3><div class="g5-count">'+Math.max(0,queue.length-1)+' left</div>'+
      '<div class="g5-stack g5-small">'+left+'</div></div>'+
      '<div class="g5-col g5-mid"><h3>Guess</h3><div class="g5-stack g5-focus">'+
      (s.r2.current?'<div class="g5-card big'+(anim.mid===mid?' fly':'')+'"><span class="g5-card-n">'+(mid+1)+'</span>'+
        '<span class="g5-card-w">'+esc(s.r2.current)+'</span></div>'
        :'<div class="g5-card big face"><span class="g5-card-n">'+(mid>=0?mid+1:1)+'</span><span class="g5-card-w">?</span></div>')+
      '</div></div>'+
      '<div class="g5-col g5-right"><h3>Found</h3><div class="g5-count">'+foundCount+' found</div>'+
      '<div class="g5-stack g5-small">'+found+'</div></div>'+
      '</div></div>';
  }else{
    body='<div class="g5-qhead"><span class="g5-qtext">'+esc(s.title||'')+'</span></div>';
  }
  const live=!!(s.clock&&(s.step==='r1'||s.step==='r2'));
  const clock='<span class="stage-clock num"'+(live?' data-countdown':'')+'>'+(live?g5Clock(s.clock&&s.clock.left!=null?s.clock.left:0):'')+'</span>';
  const stepName={setup:'Setup',welcome:'Welcome',r1pick:'Pick a number',r1:'Round 1',r1done:'Team result',r1rank:'Round 1 ranking',r2pick:'Pick a number',r2:'Round 2',r2done:'Team result',end:'Finished'}[s.step]||'';
  const church=s.church||'Bicutan Bible Church';
  $('#app').innerHTML='<div id="stage" class="g5stage"><header class="stage-top"><div class="stage-title">'+esc(s.title||'')+'</div>'+clock+
    '<div class="stage-meta"><span class="stage-church">'+esc(church)+'</span></div></header>'+
    '<div class="stage-body g5-present-body">'+body+'</div>'+
    '<div class="g5-present-tools"><button class="link" onclick="g5PresentFull()">Fullscreen</button>'+
    '<button class="link" onclick="g5PresentClose()">Exit</button></div></div>';
  stageBrand($('#stage'));
  g5FitWord();
  g5FitPresent();
  g5PresentClock();
}

// Make the audience window full screen.
function g5PresentFull(){try{const e=document.documentElement;if(e.requestFullscreen)e.requestFullscreen()}catch(err){}}

// Close the audience window and go back to the game.
function g5PresentClose(){try{window.close()}catch(e){}}

// Keep the operator's screen fitted when the window changes, and once more when
// the web font has arrived.
addEventListener('resize',()=>{if(typeof G5!=='undefined'&&G5)g5FitHost()});
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{if(typeof G5!=='undefined'&&G5)g5FitHost()});

// The host shortcuts for Gimme 5: 1 to 5 mark an answer correct, X is wrong,
// S passes the turn, Space starts or pauses. In Round 2 Enter is correct and P is pass.
addEventListener('keydown',e=>{
  if(view!=='stage5'||!G5||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
  if(e.code==='Space'){e.preventDefault();if(G5.step==='r1'||G5.step==='r2')g5Toggle();return}
  if(G5.step==='r1'){
    if(/^[1-5]$/.test(e.key)){e.preventDefault();g5Correct(+e.key-1);return}
  }
  if(G5.step==='r2'){
    if(e.key==='Enter'){e.preventDefault();g5R2Correct();return}
    if(e.key==='p'||e.key==='P'){e.preventDefault();g5R2Pass();return}
  }
});

/* ---------- the studio ---------- */

// A blank Gimme 5 file for the studio.
function newGame5(){
  ST5={id:null,title:'',desc:'',instr:G5_INSTR,church:'Bicutan Bible Church',defaultTeams:2,
    round1:{members:3,advance:2,questions:[{text:'',english:false,seconds:60,answers:['','','','','']}]},
    round2:{seconds:120,showWordOnPresent:false,categories:{}}};
  for(const c of G5_CATS)ST5.round2.categories[c[0]]=[['','','','','']];
  go('studio');
}

// Load a Gimme 5 file into the studio.
function editGame5(id){
  const g=S.games.find(x=>x.id===id);if(!g)return;
  const cats={};
  for(const c of G5_CATS){
    const sets=(g.round2&&g.round2.categories&&g.round2.categories[c[0]]||[]).map(s=>s.slice(0,5));
    cats[c[0]]=sets.length?sets:[['','','','','']];
  }
  ST5={id:g.id,title:g.title,desc:g.desc||'',instr:g.instr||G5_INSTR,church:g.church||'Bicutan Bible Church',defaultTeams:g.defaultTeams||2,
    round1:{members:(g.round1&&g.round1.members)||3,advance:(g.round1&&g.round1.advance)||2,questions:((g.round1&&g.round1.questions)||[]).map(q=>({text:q.text||'',english:!!q.english,seconds:q.seconds||60,answers:(q.answers||['','','','','']).slice(0,5)}))},
    round2:{seconds:(g.round2&&g.round2.seconds)||120,showWordOnPresent:!!(g.round2&&g.round2.showWordOnPresent),helperSignals:g.round2?g.round2.helperSignals!==false:true,categories:cats}};
  if(!ST5.round1.questions.length)ST5.round1.questions=[{text:'',english:false,seconds:60,answers:['','','','','']}];
  go('studio');
}

// The Gimme 5 studio form.
function studio5V(){
  const s=ST5;
  const qsec=(q,i)=>'<div class="round"><div class="round-head"><h3>Question '+(i+1)+'</h3>'+
    '<button class="link dng" onclick="g5DelQuestion('+i+')">Remove question</button></div>'+
    '<div class="field"><label class="label" for="g5q'+i+'">Question</label><input id="g5q'+i+'" value="'+esc(q.text)+'" oninput="ST5.round1.questions['+i+'].text=this.value"></div>'+
    '<div class="row" style="margin-bottom:var(--s2)"><label class="label" style="margin:0"><input type="checkbox" '+(q.english?'checked':'')+' onchange="ST5.round1.questions['+i+'].english=this.checked"> Answers must be in English (shows E)</label>'+
    '<label class="label" style="margin:0">Seconds <input type="number" min="10" max="600" step="5" value="'+q.seconds+'" style="width:100px;display:inline-block;margin-left:8px" oninput="ST5.round1.questions['+i+'].seconds=+this.value"></label></div>'+
    (q.seconds>=120?'<p class="warnnote">'+q.seconds+' seconds or more is quite long. The round can still be saved.</p>':'')+
    '<div class="field"><label class="label">The five answers</label><div class="row">'+q.answers.map((a,j)=>'<input style="width:150px" value="'+esc(a)+'" placeholder="Answer '+(j+1)+'" oninput="ST5.round1.questions['+i+'].answers['+j+']=this.value">').join('')+'</div></div></div>';
  const catsec=(c)=>'<div class="round"><div class="round-head"><h3>'+c[0]+' <span class="note">('+c[1]+')</span></h3>'+
    '<span class="note">'+((s.round2.categories[c[0]]||[]).length)+' set'+(((s.round2.categories[c[0]]||[]).length)===1?'':'s')+'</span></div>'+
    (s.round2.categories[c[0]]||[]).map((set,si)=>'<div class="row" style="margin-bottom:var(--s2)">'+set.map((w,j)=>'<input style="width:140px" value="'+esc(w)+'" placeholder="Word '+(j+1)+'" oninput="ST5.round2.categories[\''+c[0]+'\']['+si+']['+j+']=this.value">').join('')+
      '<button class="link dng" onclick="g5DelSet(\''+c[0]+'\','+si+')">Remove set</button></div>').join('')+
    (!(s.round2.categories[c[0]]||[]).length?'<p class="note">No sets yet, so this category is not used.</p>':'')+'</div>';
  return '<div class="studio" data-enter="next"><h1>Game Studio</h1>'+
    '<div class="sect"><h2>Settings</h2>'+
    '<div class="field"><label class="label" for="g5t">Title</label><input id="g5t" value="'+esc(s.title)+'" oninput="ST5.title=this.value"></div>'+
    '<div class="field"><label class="label" for="g5d">Description</label><input id="g5d" value="'+esc(s.desc)+'" oninput="ST5.desc=this.value"></div>'+
    '<div class="field"><label class="label" for="g5i">Instructions slide text</label><textarea id="g5i" rows="3" oninput="ST5.instr=this.value">'+esc(s.instr)+'</textarea></div>'+
    '<div class="field"><label class="label" for="g5dt">Default number of teams</label><input id="g5dt" type="number" min="2" max="10" value="'+s.defaultTeams+'" oninput="ST5.defaultTeams=+this.value"></div>'+
    '<div class="field"><label class="label" for="g5ch">Church name (on the audience screen)</label><input id="g5ch" value="'+esc(s.church||'Bicutan Bible Church')+'" oninput="ST5.church=this.value"></div></div>'+
    '<div class="sect"><h2>Round 1</h2>'+
    '<div class="formrow">'+
    '<div class="field"><label class="label" for="g5sa">Teams that proceed to Round 2</label><input id="g5sa" type="number" min="1" max="5" value="'+s.round1.advance+'" oninput="ST5.round1.advance=+this.value"></div>'+
    '</div>'+
    '<h3>Questions</h3>'+
    s.round1.questions.map(qsec).join('')+
    '<div class="row"><button class="btn btn-sm" onclick="g5AddQuestion()">Add question</button>'+
    '<button class="btn btn-sm" onclick="g5ExampleQuestion()">Use the farm example</button></div></div>'+
    '<div class="sect"><h2>Round 2</h2>'+
    '<div class="field"><label class="label" for="g5r2s">Seconds</label><input id="g5r2s" type="number" min="10" max="600" step="5" value="'+s.round2.seconds+'" oninput="ST5.round2.seconds=+this.value"></div>'+
    '<div class="formrow"><div class="field"><label class="label" for="g5cat">Add a set to</label>'+
    '<select id="g5cat">'+G5_CATS.map(c=>'<option value="'+c[0]+'">'+c[0]+' &middot; '+c[1]+'</option>').join('')+'</select></div>'+
    '<div class="field"><label class="label">&nbsp;</label><button class="btn" onclick="g5AddSetTo()">Add a set</button>'+
    '<p class="note">Every set is one choice in the blind pick, and every set has five words.</p></div></div>'+
    G5_CATS.map(catsec).join('')+'</div>'+
    '<div class="sect"><div class="row"><button class="btn pri" onclick="saveGame5()">Save game</button><button class="btn" onclick="go(\'lib\')">Cancel</button></div>'+
    '<div class="err" style="margin-top:var(--s2)">'+esc(g5Err)+'</div></div></div>';
}

// The studio validation message.
let g5Err='';

// Add a question to the studio form.
function g5AddQuestion(){ST5.round1.questions.push({text:'',english:false,seconds:60,answers:['','','','','']});render()}

// Remove a question from the studio form.
function g5DelQuestion(i){ST5.round1.questions.splice(i,1);if(!ST5.round1.questions.length)ST5.round1.questions.push({text:'',english:false,seconds:60,answers:['','','','','']});render()}

// Fill a question with the farm example.
function g5ExampleQuestion(){ST5.round1.questions[0]={text:'Ano-anong hayop ang makikita sa farm?',english:false,seconds:60,answers:['Baka','Kalabaw','Kabayo','Manok','Baboy']};render()}

// Add a word set to a category.
function g5AddSet(cat){ST5.round2.categories[cat]=ST5.round2.categories[cat]||[];ST5.round2.categories[cat].push(['','','','','']);render()}

// Add a set to the category that is chosen in the form.
function g5AddSetTo(){
  const el=document.getElementById('g5cat');
  const cat=(el&&el.value)||G5_CATS[0][0];
  g5AddSet(cat);
}

// Remove a word set from a category.
function g5DelSet(cat,i){ST5.round2.categories[cat].splice(i,1);render()}

// Check the Gimme 5 file. Returns an empty string when the file is good,
// or a message that says what to fix.
function g5Validate(){
  const s=ST5;
  if(!s.title.trim())return 'Give the game a title.';
  if(!(+s.defaultTeams>=2&&+s.defaultTeams<=10))return 'The number of teams must be between 2 and 10.';
  if(!(+s.round1.members>=1&&+s.round1.members<=6))return 'Members per team must be between 1 and 6.';
  if(!(+s.round1.advance>=1&&+s.round1.advance<=5))return 'Teams that proceed to Round 2 must be between 1 and 5.';
  if(!s.round1.questions.length)return 'Add at least one question.';
  for(let i=0;i<s.round1.questions.length;i++){
    const q=s.round1.questions[i];
    const n=q.answers.filter(a=>String(a).trim()).length;
    if(n!==5)return 'Question '+(i+1)+' needs 5 answers (it has '+n+').';
    if(!String(q.text).trim())return 'Question '+(i+1)+' needs a question.';
    if(!(+q.seconds>=10&&+q.seconds<=600))return 'Question '+(i+1)+' needs between 10 and 600 seconds.';
  }
  let used=0;
  for(const c of G5_CATS){
    const sets=(s.round2.categories[c[0]]||[]).filter(set=>set.some(w=>String(w).trim()));
    if(!sets.length)continue;
    for(let i=0;i<sets.length;i++){
      const n=sets[i].filter(w=>String(w).trim()).length;
      if(n!==5)return c[0]+', set '+(i+1)+' needs 5 words (it has '+n+').';
    }
    used++;
  }
  if(!used)return 'Add at least one category with one set of 5 words.';
  return '';
}

// Check the Gimme 5 file and save it.
async function saveGame5(){
  g5Err=g5Validate();
  if(g5Err){render();return}
  const s=ST5;
  const cats={};
  for(const c of G5_CATS){
    const sets=(s.round2.categories[c[0]]||[]).filter(set=>set.some(w=>String(w).trim()));
    if(sets.length)cats[c[0]]=sets.map(set=>set.map(w=>String(w).trim()));
  }
  const g={id:s.id||'g5-'+Date.now(),type:'gimme5',title:s.title.trim(),desc:s.desc.trim(),series:'Gimme 5',sub:'',date:'',welcome:'',
    defaultTeams:Math.min(10,Math.max(2,+s.defaultTeams||2)),instr:s.instr,church:(s.church||'Bicutan Bible Church').trim(),
    round1:{members:Math.min(6,Math.max(1,+s.round1.members||3)),advance:Math.min(5,Math.max(1,+s.round1.advance||2)),questions:s.round1.questions.map(q=>({text:String(q.text).trim(),english:!!q.english,seconds:Math.round(+q.seconds),answers:q.answers.map(a=>String(a).trim())}))},
    round2:{seconds:Math.round(+s.round2.seconds),showWordOnPresent:!!s.round2.showWordOnPresent,categories:cats}};
  try{await authed('app_save_game',{p_game:g});toast('Game saved.');await pull();go('lib')}catch(x){g5Err=emsg(x);render()}}

/* ---------- reading the records ---------- */

// The "last winner" line of a game, by its kind.
function g5LastLine(g){
  const r=(g.results||[]).slice(-1)[0];
  if(!r)return 'none yet';
  if(r.kind==='gimme5')return r.winner+', '+((r.r2&&r.r2.guessed)||0)+' of 5 in '+g5Time((r.r2&&r.r2.seconds)||0);
  return r.winner+' ('+r.score+' pts)';
}

// The rows of the Info dialog for a Gimme 5 game, newest first.
function g5InfoRows(g){
  const rs=(g.results||[]).slice().reverse();
  if(!rs.length)return '<p class="meta">No results yet. Winners appear here after a game is finished.</p>';
  return '<table><thead><tr><th>Date won</th><th>Teams</th><th>Round 1</th><th>Round 2</th><th>Host</th></tr></thead><tbody>'+
    rs.map(r=>{
      const r1=r.r1||{},r2=r.r2||{};
      return '<tr><td>'+esc(fmtDateTime(r.id))+'</td><td>'+(r.teams||'-')+'</td>'+
        '<td>'+esc(r1.winner||'-')+'<br>'+(r1.correct||0)+' of 5 in '+g5Time(r1.seconds||0)+'</td>'+
        '<td>'+esc(r2.team||'-')+'<br>'+esc(r2.category||'-')+', '+(r2.guessed||0)+' of 5 in '+g5Time(r2.seconds||0)+'</td>'+
        '<td>'+esc(r.by||'-')+'</td></tr>';
    }).join('')+'</tbody></table>';
}

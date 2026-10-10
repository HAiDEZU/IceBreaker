/* =====================================================================
   Bicutan Bible Church · Word Chain Reaction  (app.js)
   Single-page game-show app. No build step.
   Files: index.html (page) · style.css (look) · config.js (database keys) · app.js (this file)
   Flow : boot() -> render() draws the active screen from the state objects below.
          Buttons call global functions (onclick) which change state and call render().
   ===================================================================== */
// Tiny helpers: $ = querySelector, esc = escape HTML so typed text can never inject markup.
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// DEFAULT GAME "Grace Chain Reaction" (the same content is seeded into the database by setup.sql).
// R('A B C','hint') builds a round from space-separated words. The first word is the one given to players.
const R=(w,h)=>({words:w.split(' '),hint:h||''});
const DEF={id:'default',title:'Grace Chain Reaction',desc:'The Bicutan Bible Church signature icebreaker: compound-word chains with faith-themed hints.',interval:4,by:'Bicutan Bible Church',
instr:'Connect each word to the next to form a chain! Letters reveal every few seconds. The last letter is always hidden as a "?" until guessed!',
sample:'FAST FOOD CHAIN SAW BLADE'.split(' '),rounds:[R('SMART WATCH LIST REPORT WRITING','General Warmup'),R('TIME SHEET MASK POLICY UPDATE','Life & Stewardship'),R('CAREER PATHWAY POINT SYSTEM','Walking the Path'),R('ZOOM CALL CENTER STAGE NAME','Fellowship Connections'),R('WORKSPACE BAR CODE NUMBER','Order & Structure'),
R('CROSS WALK THROUGH FAITH STEP','"We walk only by grace through faith."'),R('BROKEN HEART BEAT DOWN LOAD','"Even the broken are carried by grace."'),R('FREE FALL BACK TRACK RECORD','"Grace covers every fall and every failure."'),R('LIGHT WEIGHT LIFT OFF BASE','"Even when we\'re off base, He lifts us."'),R('CROSS OVER TIME LINE BREAK','"Grace crosses all boundaries of time."')]};
// DEFAULT BRANDING (green palette). primary = header/revealed tiles, accent = gold, stage = game background,
// mint = tile highlight, text = stage text. v is the settings version.
const BRAND0={name:'Bicutan Bible Church',sub:'Word Chain Reaction • Fellowship & Ministry Icebreaker',logo:'',primary:'#047857',accent:'#F59E0B',stage:'#022C22',mint:'#34D399',text:'#ECFDF5',v:2};
// COLOUR PALETTE TEMPLATES shown in Admin > Branding Customizer.
const PAL=[{n:'Emerald Grace',primary:'#047857',accent:'#F59E0B',stage:'#022C22',mint:'#34D399',text:'#ECFDF5'},{n:'Church Navy',primary:'#1E293B',accent:'#F59E0B',stage:'#0F172A',mint:'#38BDF8',text:'#E2E8F0'},{n:'Royal Violet',primary:'#6D28D9',accent:'#FBBF24',stage:'#1E1B4B',mint:'#A78BFA',text:'#EDE9FE'},{n:'Sunrise Rose',primary:'#BE123C',accent:'#FCD34D',stage:'#4C0519',mint:'#FB7185',text:'#FFE4E6'},{n:'Ocean Sky',primary:'#0284C7',accent:'#F59E0B',stage:'#082F49',mint:'#38BDF8',text:'#E0F2FE'},{n:'Olive Sage',primary:'#4D7C0F',accent:'#D97706',stage:'#1A2E05',mint:'#A3E635',text:'#ECFCCB'}];
// Apply one colour template to the branding and save it (admin).
function applyPal(i){const{n,...c}=PAL[i];Object.assign(S.brand,c);bsave();render()}
/* =====================================================================
   DATABASE (Supabase)
   config.js supplies the project URL + public anon key. All writes go
   through server functions (rpc) that check the login token.
   ===================================================================== */
const CFG=window.APP_CONFIG||{},REMOTE=!!(CFG.SUPABASE_URL&&CFG.SUPABASE_ANON_KEY),KEY=String(CFG.SUPABASE_ANON_KEY||'').trim(),BASE=(()=>{try{return new URL(String(CFG.SUPABASE_URL||'').trim().replace(/^["']|["']$/g,'')).origin}catch(e){return ''}})(),API=BASE+'/rest/v1/';
const HD=()=>({apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json'});
// Call a database function (RPC) and return its JSON. Throws Error(message) when it fails.
async function rpc(fn,args){const r=await fetch(API+'rpc/'+fn,{method:'POST',headers:HD(),body:JSON.stringify(args||{})});const t=await r.text();let j=null;try{j=t?JSON.parse(t):null}catch(e){}if(!r.ok)throw new Error((j&&j.message)||'HTTP '+r.status);return j}
// Read rows from a public table (games and branding are readable by everyone).
async function sel(path){const r=await fetch(API+path,{headers:HD()});if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}
// Initial in-memory state S. Only the theme and login session are kept in this browser; games, users and branding come from the database.
function load(){let d={};try{d=JSON.parse(localStorage.getItem('bbc2'))||{}}catch(e){}return{users:[],games:REMOTE?[]:[DEF],brand:{...BRAND0},theme:d.theme||'dark',session:d.session||null}}
let S=load();const save=()=>{try{localStorage.setItem('bbc2',JSON.stringify({theme:S.theme,session:S.session}))}catch(e){}};
let bt=null;const bsave=()=>{save();if(!REMOTE)return;clearTimeout(bt);bt=setTimeout(()=>{bt=null;if(me()&&me().role==='Admin')authed('app_save_brand',{p_brand:S.brand}).catch(x=>toast(emsg(x)))},700)};
// Friendly text for the error codes raised by the database functions (see setup.sql).
const EM={bad_credentials:'Wrong username or password.',pending:'Your account is awaiting Admin approval.',disabled:'This account is disabled.',username_taken:'Username already taken.',invalid_input:'Please check your input (username 2+ characters, password 4+).',not_authenticated:'Please log in again.',forbidden:'You are not allowed to do that.',not_found:'Not found.'};
const emsg=x=>EM[x.message]||(/invalid path|HTTP 404/i.test(x.message)?'Database address looks wrong. In config.js use only https://YOUR-PROJECT.supabase.co (no /rest/v1 and not the dashboard link).':/could not find the function|PGRST202/i.test(x.message)?'Database functions are missing. Run setup.sql again in the Supabase SQL Editor.':/fetch|network/i.test(x.message)?'Cannot reach the database. Check your connection and config.js.':x.message);
// Show a small message at the bottom of the screen for a few seconds.
function toast(m){const t=document.createElement('div');t.className='toast';t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),3500)}
// Call a database function that needs a login. Adds the session token and logs the user out if it has expired.
async function authed(fn,args){if(!S.session||!S.session.token)throw new Error('not_authenticated');try{return await rpc(fn,{p_token:S.session.token,...(args||{})})}catch(x){if(x.message==='not_authenticated'){S.session=null;save();view='auth';err='Session expired. Please log in again.';render()}throw x}}
// Download all games and the branding from the database into S.
async function pull(){const [g,b]=await Promise.all([sel('app_games?select=id,data,created_at&order=created_at.asc'),sel('app_settings?select=value&key=eq.brand')]);S.games=g.map(x=>({...x.data,id:x.id,created:x.created_at}));if(b[0]&&!bt)S.brand=Object.assign({},BRAND0,b[0].value)}
// Reload games from the database and redraw the library.
async function refresh(){if(!REMOTE)return;try{await pull();if(view==='lib')render()}catch(x){toast(emsg(x))}}
// Admin only: load the account list.
async function loadUsers(){try{S.users=await authed('app_admin_users');if(view==='admin'||view==='lib')render()}catch(x){}}
// Admin: run an action on one account (approve, toggle, delete, set_password).
async function uact(id,a,v){try{await authed('app_admin_user_action',{p_user:id,p_action:a,p_value:v||null});if(a==='set_password')toast(v==='welcome123'?'Password reset to: welcome123':'Password updated.');showPw[id]=null;await loadUsers()}catch(x){toast(emsg(x))}}
// Admin: fetch one member's password and show it in the table.
async function viewPw(id){try{const r=await authed('app_admin_view_password',{p_user:id});showPw[id]=r.password;render()}catch(x){toast(emsg(x))}}
// Admin: ask for a new password and save it.
function chgPw(id){const p=prompt('New password (4+ characters):');if(p&&p.length>=4)uact(id,'set_password',p)}
// App start-up: show Loading, fetch data, check the saved login, then show the first screen.
async function boot(){render();if(REMOTE){try{await pull()}catch(x){err=emsg(x)}
if(S.session&&S.session.token){try{const u=await rpc('app_me',{p_token:S.session.token});S.session=u?{...u,token:S.session.token}:null;save()}catch(x){}}
if(S.session&&S.session.role==='Admin')loadUsers()}
view=S.session?'lib':'auth';loading=false;render()}
/* =====================================================================
   APP STATE
   loading: first data load in progress | view: current screen | tab/regMode: login form
   flt/q: library filter + search | ST: studio state | G: running game | err: message under forms
   ===================================================================== */
let loading=true,view=S.session?'lib':'auth',tab='user',regMode=false,flt='all',q='',ST=null,G=null,timer=null,AC=null,err='',showPw={},delId=null,infoId=null;
// The logged-in user (or null) and what they are allowed to do.
const me=()=>S.session,canEdit=g=>me()&&(me().role==='Admin'||g.owner===me().id),canBuild=()=>me()&&me().role!=='Guest';
// Apply the theme and brand colours/name from S to the page (CSS variables).
function brand(){const b=S.brand,r=document.documentElement;r.dataset.theme=S.theme;r.style.setProperty('--primary',b.primary);r.style.setProperty('--accent',b.accent);r.style.setProperty('--stage',b.stage);r.style.setProperty('--mint',b.mint);r.style.setProperty('--stagefg',b.text);document.title=b.name+' • Word Chain Reaction'}
// Switch screen: 'auth', 'lib', 'studio', 'admin' or 'stage'. Loads fresh data when needed.
function go(v){view=v;err='';render();if(v==='admin')loadUsers();if(v==='lib')refresh()}
/* =====================================================================
   SOUND EFFECTS
   Short beeps made with the Web Audio API (no audio files needed).
   ===================================================================== */
// Play one short tone (only when sound is on).
function beep(f,d=.15,t='sine',when=0){if(!G||!G.sound)return;try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();const o=AC.createOscillator(),g=AC.createGain();o.type=t;o.frequency.value=f;g.gain.setValueAtTime(.15,AC.currentTime+when);g.gain.exponentialRampToValueAtTime(.001,AC.currentTime+when+d);o.connect(g);g.connect(AC.destination);o.start(AC.currentTime+when);o.stop(AC.currentTime+when+d)}catch(e){}}
const fan=()=>[523,659,784,1047].forEach((f,i)=>beep(f,.3,'triangle',i*.12));
/* =====================================================================
   PAGE SHELL
   Navigation bar + whichever screen is active.
   ===================================================================== */
// Redraw the current screen: navigation bar plus the active view.
function render(){brand();if(view==='stage'){renderStage();return}
if(loading){$('#app').innerHTML='<div style="display:grid;place-items:center;min-height:70vh;color:var(--muted)">Loading…</div>';return}
const b=S.brand,u=me();let h=`<nav><div class="brand">${b.logo?`<img src="${esc(b.logo)}" alt="" onerror="this.style.display='none'">`:'<div class="logo">✝</div>'}<div>${esc(b.name)}<small>${esc(b.sub)}</small></div></div>`;
if(u){h+=`<button class="btn" onclick="go('lib')">Games</button>`+(canBuild()?`<button class="btn" onclick="newGame()">Studio</button>`:'')+(u.role==='Admin'?`<button class="btn" onclick="go('admin')">Admin${S.users.some(x=>x.pending)?' 🔔'+S.users.filter(x=>x.pending).length:''}</button>`:'')+`<div class="menu"><button class="btn" onclick="toggleMenu(event)">👤 ${esc(u.name)} · ${u.role} ▾</button><div id="um" class="dd" hidden><div class="sub">Signed in as <b>${esc(u.name)}</b><br>Account type: ${u.role}</div><button class="btn dng" onclick="logout()">⎋ Log out</button></div></div>`}
h+=`<button class="btn" onclick="S.theme=S.theme==='dark'?'light':'dark';save();render()" title="Toggle theme">${S.theme==='dark'?'☀️':'🌙'}</button></nav><main>`;
h+=!u?authV():view==='lib'?libV():view==='studio'?studioV():view==='admin'?adminV():libV();$('#app').innerHTML=h+'</main>'}
/* =====================================================================
   LOGIN / REGISTER / GUEST
   Accounts live in the database; guests are local only.
   ===================================================================== */
// Login screen: User Login (Login / Register tabs) and Guest Express.
function authV(){const t=(k,l)=>`<button class="btn ${tab===k?'on':''}" onclick="tab='${k}';err='';render()">${l}</button>`;
let f;if(tab==='user')f=`<div class="row" style="margin-bottom:8px"><button class="btn ${!regMode?'on':''}" onclick="regMode=false;err='';render()">Login</button><button class="btn ${regMode?'on':''}" onclick="regMode=true;err='';render()">Register</button></div>${regMode?'<label>Display name</label><input id="un">':''}<label>Username</label><input id="ue" autocapitalize="none" autocomplete="username"><label>Password</label><div style="position:relative"><input id="up" type="password" style="padding-right:84px"><button type="button" class="btn" style="position:absolute;right:6px;top:7px;padding:2px 8px" title="Show or hide password" aria-label="Show or hide password" onclick="togglePw(this)">👁</button></div><button class="btn pri" onclick="doUser()">${regMode?'Request account':'Log in'}</button>${regMode?'<p class="meta">New accounts must be approved by the Admin before you can log in.</p>':''}`;
else f=`<label>Nickname (optional)</label><input id="gn" placeholder="e.g. Brother Matthew"><button class="btn pri" onclick="doGuest()">Enter as Guest</button>`;
return `<div style="max-width:440px;margin:30px auto"><div class="hero" style="text-align:center"><div class="logo" style="margin:0 auto 10px;width:56px;height:56px;font-size:30px">✝</div><h1>${esc(S.brand.name)}</h1><p>${esc(S.brand.sub)}</p></div>${REMOTE?'':'<div class="card" style="border-color:var(--accent);margin-bottom:12px">⚙️ <b>Database not connected.</b> Guests can still play the default game. To enable accounts, saved games and cross-device sync, add your Supabase keys to <code>config.js</code> (see README).</div>'}<div class="card" data-enter="${tab==='user'?'doUser':'doGuest'}"><div class="tabs">${t('user','User Login')}${t('guest','Guest Express')}</div>${f}<div class="err" style="${err[0]==='✓'?'color:var(--mint)':''}">${esc(err)}</div></div></div>`}
// Remember the logged-in user and open the library.
function sess(u){S.session={id:u.id,name:u.name,role:u.role,token:u.token};save();view='lib';render();if(u.role==='Admin')loadUsers()}
// Show or hide the password text in the login form (eye button).
function togglePw(b){const i=$('#up'),h=i.type==='password';i.type=h?'text':'password';b.style.borderColor=h?'var(--accent)':'';b.style.opacity=h?'1':'.7'}
// Log in or register (depending on regMode). New registrations wait for Admin approval.
async function doUser(){const e=$('#ue').value.trim().toLowerCase(),p=$('#up').value;if(!e||!p){err='Username and password required.';return render()}
if(!REMOTE){err='Database not connected yet. See README (config.js).';return render()}
try{if(regMode){await rpc('app_register',{p_username:e,p_name:$('#un').value.trim(),p_password:p});regMode=false;err='✓ Registration sent! Please wait for Admin approval before logging in.';render()}
else{const r=await rpc('app_login',{p_username:e,p_password:p});sess({...r.user,token:r.token})}}catch(x){err=emsg(x);render()}}
// Enter as a guest. Local only, nothing is stored in the database.
function doGuest(){const n=$('#gn').value.trim()||'Guest '+Math.floor(Math.random()*900+100);sess({id:'g'+Date.now(),name:n,role:'Guest'})}
// Open or close the user dropdown menu in the navigation bar.
function toggleMenu(e){e.stopPropagation();const m=$('#um');if(m)m.hidden=!m.hidden}
addEventListener('click',()=>{const m=$('#um');if(m)m.hidden=true});
// End the session on the server and return to the login screen.
function logout(){const t=S.session&&S.session.token;if(t&&REMOTE)rpc('app_logout',{p_token:t}).catch(()=>{});S.session=null;S.users=[];save();view='auth';render()}
/* =====================================================================
   GAME LIBRARY
   Search, filter, play, edit, delete and view game info.
   ===================================================================== */
// Game library screen: hero banner, search, filters and one card per game.
function libV(){let gs=S.games.filter(g=>g.title.toLowerCase().includes(q.toLowerCase())&&(flt==='all'||(me()&&g.owner===me().id)));
return `<div class="hero"><h1>${esc(S.brand.name)} Fellowship Games</h1><p>Launch a chain reaction for your next fellowship, youth night, or retreat.</p>${canBuild()?`<button class="btn pri" onclick="newGame()">＋ Host New Game</button>`:''}</div>
<div class="row" style="margin-bottom:14px"><input style="max-width:320px;margin:0" placeholder="Search games…" value="${esc(q)}" oninput="q=this.value;clearTimeout(window._t);window._t=setTimeout(()=>{render();const i=document.querySelector('main input');i.focus();i.setSelectionRange(q.length,q.length)},250)"><button class="btn ${flt==='all'?'on':''}" onclick="flt='all';render()">All</button>${canBuild()?`<button class="btn ${flt==='mine'?'on':''}" onclick="flt='mine';render()">Mine</button>`:''}<button class="btn" onclick="refresh().then(()=>toast('Games refreshed'))">🔄 Refresh</button></div>
<div class="grid">${gs.map(g=>`<div class="card"><h3>${esc(g.title)}</h3><div style="color:var(--muted);font-size:14px">${esc(g.desc)}</div><div class="meta"><span>🎯 ${g.rounds.length} rounds</span><span>⏱ ${g.interval}s reveal</span><span>👤 Created by ${esc(g.by)}</span>${(g.results||[]).slice(-1).map(w=>`<span>🏆 Last winner: ${esc(w.winner)} (${w.score} pts)</span>`).join('')}</div><div class="row"><button class="btn pri" onclick="play('${g.id}')">Launch Game Show</button><button class="btn" title="Winners history" onclick="infoId='${g.id}';render()">ℹ Info</button>${canEdit(g)?`<button class="btn" onclick="editGame('${g.id}')">Edit</button><button class="btn dng" onclick="delGame('${g.id}')">Delete</button>`:''}</div></div>`).join('')||'<p>No games found.</p>'}</div>${infoModal()}`}
// Date helpers for the info pop-up (created date, and date + time a match was won).
const fmtDate=t=>t?new Date(t).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'}):'—',fmtDateTime=t=>new Date(t).toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
// Pop-up with a game's details: creator, date created, and the winners history with the date each match was won.
function infoModal(){if(!infoId)return'';const g=S.games.find(x=>x.id===infoId);if(!g){infoId=null;return''}const rs=(g.results||[]).slice().reverse();
return `<div class="modal" onclick="infoId=null;render()"><div class="card mc" onclick="event.stopPropagation()"><div class="row" style="justify-content:space-between"><h3>ℹ ${esc(g.title)}</h3><button class="btn" onclick="infoId=null;render()">✕</button></div><div class="meta"><span>👤 Created by ${esc(g.by)}</span><span>📅 Date created: ${esc(fmtDate(g.created))}</span><span>${g.rounds.length} rounds${g.sample?' + sample':''}</span><span>${g.interval}s reveal</span></div><div class="sec">Winners history</div>${rs.length?rs.map(r=>`<div class="rcard"><b>🏆 ${esc(r.winner)}</b> — ${r.score} pts<div class="meta">📅 Date won: ${esc(fmtDateTime(r.id))}${r.by?' · hosted by '+esc(r.by):''}</div><div class="meta">${(r.scores||[]).map(t=>esc(t.name)+': '+t.score).join(' · ')}</div></div>`).join(''):'<p style="color:var(--muted)">No results yet. Winners appear here after a game is finished with scoring on.</p>'}</div></div>`}
// Delete a game (creator or Admin only; checked on the server).
async function delGame(id){if(confirm('Delete this game?')){try{await authed('app_delete_game',{p_id:id});await pull();render()}catch(x){toast(emsg(x))}}}
/* =====================================================================
   GAME STUDIO – create or edit a game file
   ST ("studio state") holds the game being edited. Inputs write straight
   into ST through oninput, so typing never re-renders or loses focus.
   ST.sample is null when no sample round is used, or an array of words.
   ===================================================================== */
const INSTR=DEF.instr;      // default text for the instructions slide
const WORDS_PER_ROUND=5;    // a new round starts with this many word boxes

// A blank round: 5 empty word boxes (the first box is the word given to players).
const newRound=()=>({words:Array(WORDS_PER_ROUND).fill(''),hint:''});

// Start a brand-new game in the studio.
function newGame(){ST={id:null,title:'',desc:'',interval:4,instr:INSTR,rounds:[newRound()],sample:null,prompt:'',n:5};go('studio')}

// Load an existing game into the studio for editing.
function editGame(id){const g=S.games.find(x=>x.id===id);ST={id:g.id,title:g.title,desc:g.desc,interval:g.interval,instr:g.instr,rounds:g.rounds.map(r=>({words:[...r.words],hint:r.hint})),sample:g.sample?[...g.sample]:null,prompt:'',n:5};go('studio')}

// Quick-add 1, 5 or 10 blank rounds. A single untouched blank round is replaced, so "+5 rounds" on a new game gives exactly 5.
function addRounds(n){if(ST.rounds.length===1&&!ST.rounds[0].hint&&ST.rounds[0].words.every(w=>!w.trim()))ST.rounds=[];for(let i=0;i<n;i++)ST.rounds.push(newRound());render()}

// Row of word inputs for any word array. p is the JS path of that array as text
// (e.g. "ST.rounds[2].words" or "ST.sample"). The first input is the given word;
// "+ word at start" lets the creator insert a new first word, "+ word at end" adds a last word.
function wordEditor(p,arr){return `<div class="wrow" style="margin:8px 0"><button class="btn" title="Insert a new first word" onclick="${p}.unshift('');render()">＋ word at start</button>${arr.map((w,j)=>`${j?'→':''}<input value="${esc(w)}" placeholder="${j?'WORD '+(j+1):'FIRST WORD'}" oninput="${p}[${j}]=this.value"><button class="btn" style="padding:2px 7px" title="Remove this word" onclick="${p}.splice(${j},1);render()">−</button>`).join('')}<button class="btn" title="Add a word at the end" onclick="${p}.push('');render()">＋ word at end</button></div>`}

// The Game Studio screen: settings, sample round, AI generator, then the list of rounds.
function studioV(){return `<div data-enter="next"><h2>Game Studio</h2><div class="card"><label>Game title</label><input value="${esc(ST.title)}" oninput="ST.title=this.value"><label>Description</label><input value="${esc(ST.desc)}" oninput="ST.desc=this.value">
<label>Auto-reveal interval (seconds per letter)</label><input type="number" min="1" step="1" value="${ST.interval}" oninput="ST.interval=+this.value;$('#iw').style.display=ST.interval>=10?'block':'none'"><div id="iw" style="display:${ST.interval>=10?'block':'none'};color:#FBBF24;font-size:13px;margin:-4px 0 10px">⚠️ 10 seconds or more is quite slow and the game may drag. You can still continue and save.</div>
<label>Instructions slide text</label><textarea rows="3" oninput="ST.instr=this.value">${esc(ST.instr)}</textarea></div>
<div class="card" style="margin-top:14px"><h3>🎬 Sample round <small style="color:var(--muted);font-weight:400">(optional demonstration)</small></h3>${ST.sample?`${wordEditor('ST.sample',ST.sample)}<div class="row"><button class="btn" onclick="ST.sample=['FAST','FOOD','CHAIN','SAW','BLADE'];render()">Use example</button><button class="btn dng" onclick="ST.sample=null;render()">Remove sample</button></div>`:`<p class="meta" style="margin-top:0">Add a practice round the host can use to show players how the game works.</p><button class="btn" onclick="ST.sample=Array(WORDS_PER_ROUND).fill('');render()">＋ Add sample round</button>`}</div>
<div class="card" data-enter="aiGen" style="margin-top:14px"><h3>✨ AI Chain Generator <small style="color:var(--muted);font-weight:400">(simulated, offline)</small></h3><input id="pr" placeholder="e.g. 5 rounds about Fruit of the Spirit" value="${esc(ST.prompt)}" oninput="ST.prompt=this.value"><div class="row"><label>Rounds</label><select style="width:80px;margin:0" onchange="ST.n=+this.value">${[3,5,8,10].map(n=>`<option ${ST.n===n?'selected':''}>${n}</option>`).join('')}</select><button class="btn pri" onclick="aiGen()">Generate chains</button></div></div>
<h3 style="margin-top:18px">Rounds (${ST.rounds.length})</h3><div class="row" style="margin-bottom:10px"><span class="meta" style="margin:0">Quick add:</span><button class="btn" onclick="addRounds(1)">＋ 1 round</button><button class="btn" onclick="addRounds(5)">＋ 5 rounds</button><button class="btn" onclick="addRounds(10)">＋ 10 rounds</button></div>
${ST.rounds.map((r,i)=>`<div class="rcard"><b>Round ${i+1}</b> <button class="btn dng" style="padding:2px 8px" title="Delete this round" onclick="ST.rounds.splice(${i},1);render()">✕</button>${wordEditor('ST.rounds['+i+'].words',r.words)}<input placeholder="Optional hint" value="${esc(r.hint)}" oninput="ST.rounds[${i}].hint=this.value"></div>`).join('')}
<div class="row"><button class="btn" onclick="addRounds(1)">＋ Add round</button><button class="btn pri" onclick="saveGame()">Save game</button><button class="btn" onclick="go('lib')">Cancel</button></div><div class="err">${esc(err)}</div></div>`}

// Validate and save the game to the database. Words are upper-cased and stripped to letters A-Z.
// Rounds with fewer than 2 words are ignored. The sample is omitted from the saved file when it is off.
async function saveGame(){const clean=a=>a.map(w=>w.toUpperCase().replace(/[^A-Z]/g,'')).filter(Boolean);
const rs=ST.rounds.map(r=>({words:clean(r.words),hint:r.hint.trim()})).filter(r=>r.words.length>=2);
const sample=ST.sample?clean(ST.sample):[];
if(!(+ST.interval>=1)){err='Enter the auto-reveal interval in seconds (1 or more).';return render()}
if(!ST.title.trim()||!rs.length){err='Add a title and at least one round with 2+ words.';return render()}
if(ST.sample&&sample.length<2){err='The sample round needs at least 2 words (or remove it).';return render()}
const g={id:ST.id||'g'+Date.now(),title:ST.title.trim(),desc:ST.desc.trim(),interval:Math.max(1,Math.round(+ST.interval)),instr:ST.instr,rounds:rs,sample:sample.length?sample:undefined};
try{await authed('app_save_game',{p_game:g});await pull();go('lib')}catch(x){err=emsg(x);render()}}

// WORD GRAPH for the simulated AI generator: each word lists words that can follow it in a common phrase.
const GR={PRAYER:'MEETING WARRIOR CHAIN BOOK',MEETING:'HOUSE ROOM POINT',HOUSE:'CHURCH KEEPER PARTY BOAT WORK',CHURCH:'BELL CHOIR SERVICE BENCH',BELL:'TOWER RINGER PEPPER',TOWER:'CLOCK BRIDGE',CLOCK:'WORK TOWER',WORK:'SHOP BOOK FORCE OUT SHEET',BOOK:'MARK STORE CASE WORM',MARK:'DOWN UP',SHOP:'KEEPER LIFT',SERVICE:'BELL CHARGE STATION',STATION:'WAGON MASTER',CHOIR:'BOY ROBE',GOOD:'NEWS SAMARITAN FRIDAY WILL SHEPHERD',NEWS:'PAPER LETTER FLASH',PAPER:'WEIGHT WORK TRAIL CLIP',WEIGHT:'LIFT LOSS',LIFT:'OFF GATE',OFF:'BEAT LINE SEASON',BEAT:'DOWN BOX',DOWN:'LOAD FALL TOWN PAYMENT',LOAD:'STAR BEARER',FALL:'BACK OUT',BACK:'BONE TRACK PACK YARD STAGE',PACK:'HORSE AGE',HEART:'BEAT BREAK LAND',BREAK:'FAST THROUGH DOWN WATER',FAST:'FOOD TRACK LANE',FOOD:'CHAIN COURT BANK',CHAIN:'REACTION SAW LINK MAIL',SAW:'MILL DUST HORSE',LIGHT:'HOUSE WEIGHT YEAR BULB',YEAR:'BOOK END',CROSS:'WALK OVER ROAD WORD FIRE',WALK:'THROUGH WAY OUT',THROUGH:'PUT WAY',OVER:'TIME COAT FLOW NIGHT',TIME:'LINE SHEET TABLE OUT',LINE:'BREAK UP BACKER DANCE',PEACE:'MAKER OFFERING TIME',MAKER:'SPACE UP',HOLY:'SPIRIT GHOST LAND WEEK',SPIRIT:'LEVEL LIFT',LEVEL:'HEAD UP',HEAD:'LIGHT STONE START LINE',STONE:'WALL AGE',WALL:'PAPER FLOWER',FLOWER:'BED POT',BED:'ROCK TIME ROOM SIDE',ROCK:'STAR SOLID',STAR:'LIGHT FISH BOARD'};
// Random walk through the word graph to build a chain where each word pairs with the next.
function walk(len){const ks=Object.keys(GR);for(let t=0;t<300;t++){let w=[ks[Math.random()*ks.length|0]];while(w.length<len){const o=(GR[w[w.length-1]]||'').split(' ').filter(x=>x&&!w.includes(x));if(!o[0])break;w.push(o[Math.random()*o.length|0])}if(w.length===len)return w}return null}
// Simulated AI generator: fills the studio with random chains (no real AI is called).
function aiGen(){const p=ST.prompt.toLowerCase();const hint=/fruit|spirit/.test(p)?'Fruit of the Spirit — Galatians 5:22–23':/testament|books/.test(p)?'Know your books of the Bible':'Chain Reaction Challenge';
ST.rounds=Array.from({length:ST.n},()=>({words:walk(4+(Math.random()*2|0))||['LIGHT','HOUSE','CHURCH','BELL'],hint}));if(!ST.title)ST.title=ST.prompt.slice(0,50)||'AI Chain Reaction';render()}
/* =====================================================================
   ADMIN PANEL
   Account management (approve, disable, reset, delete, view password) and branding.
   ===================================================================== */
// Delete / Confirm-delete buttons for one account row.
function delBtn(u){return delId===u.id?`<button class="btn dng" onclick="uact('${u.id}','delete');delId=null">Confirm delete</button> <button class="btn" onclick="delId=null;render()">Cancel</button>`:`<button class="btn dng" onclick="delId='${u.id}';render()">Delete</button>`}
// Admin screen: Account Management table and the Branding Customizer.
function adminV(){const b=S.brand,c=(k,l,d)=>`<div class="cc"><label>${l}</label><small>${d}</small><div class="row"><input type="color" value="${b[k]}" style="width:44px;height:36px;padding:2px;margin:0" oninput="S.brand.${k}=this.value;bsave();brand();this.nextElementSibling.textContent=this.value.toUpperCase()"><code>${String(b[k]).toUpperCase()}</code></div></div>`;
return `<h2>Admin Panel</h2><div class="card"><h3>Account Management</h3><div style="overflow-x:auto"><table><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Password</th><th></th></tr>${S.users.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.username||'—')}</td><td>${u.role}</td><td>${u.pending?'⏳ Pending approval':u.active?'Active':'Disabled'}</td><td>${u.role!=='Admin'?`<code>${showPw[u.id]?esc(showPw[u.id]):'••••••'}</code> <button class="btn" style="padding:2px 8px" onclick="${showPw[u.id]?`showPw['${u.id}']=null;render()`:`viewPw('${u.id}')`}">${showPw[u.id]?'Hide':'👁 View'}</button>`:'—'}</td><td>${u.role==='Admin'?`<button class="btn" onclick="chgPw('${u.id}')">Change password</button>`:u.pending?`<button class="btn pri" onclick="uact('${u.id}','approve')">Approve</button> <button class="btn dng" onclick="uact('${u.id}','delete')">Reject</button>`:`<button class="btn" onclick="uact('${u.id}','toggle')">${u.active?'Disable':'Enable'}</button> <button class="btn" onclick="uact('${u.id}','set_password','welcome123')">Reset</button> ${delBtn(u)}`}</td></tr>`).join('')||'<tr><td colspan="6">Loading accounts…</td></tr>'}</table></div></div>
<div class="card" data-enter="blur" style="margin-top:14px"><h3>Branding Customizer</h3><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0 14px"><div><label>App name</label><input value="${esc(b.name)}" oninput="S.brand.name=this.value;bsave();brand()"></div><div><label>Sub-title</label><input value="${esc(b.sub)}" oninput="S.brand.sub=this.value;bsave()"></div><div><label>Logo image URL</label><input value="${esc(b.logo)}" placeholder="https://…" onchange="S.brand.logo=this.value;bsave();render()"></div></div>
<div class="sec">Color palette templates</div><div class="row">${PAL.map((p,i)=>`<button class="btn" onclick="applyPal(${i})">${[p.primary,p.accent,p.stage,p.mint,p.text].map(c=>`<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${c};border:1px solid #8886;margin-right:2px"></span>`).join('')} ${p.n}</button>`).join('')}</div>
<div class="sec">Custom colors</div><div class="swgrid">${c('primary','Primary','Header, hero, revealed tiles')}${c('accent','Accent gold','Given word, ? tile, buttons, hints')}${c('stage','Stage background','Game screen background')}${c('mint','Highlight','Borders and glow on revealed tiles')}${c('text','Stage text','Text on the game screen')}</div>
<div style="margin-top:16px"><button class="btn" onclick="S.brand={...BRAND0};bsave();render()">Reset branding</button></div></div>`}
/* =====================================================================
   GAME STAGE (presentation mode)
   G holds the live game: rounds, active word, revealed letters, timer, teams and scores.
   ===================================================================== */
// Random whole number between a and b (inclusive).
const rnd=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
// Open the game stage for a game. Starts at the instructions slide with team setup.
function play(id){const g=S.games.find(x=>x.id===id);const rs=(g.sample?[{words:g.sample,hint:'Practice Round',sample:true}]:[]).concat(g.rounds);
G={g,rs,ri:0,step:'instr',wi:1,rev:0,q:false,full:false,hint:true,sound:true,paused:false,cd:g.interval,flip:false,cols:5,teams:[{name:'Team 1',score:0},{name:'Team 2',score:0}]};view='stage';render();clearInterval(timer);timer=setInterval(tick,1000)}
// Set the number of teams (0 = no scoring) while keeping names already typed.
function setTeams(n){const t=G.teams;G.teams=Array.from({length:n},(_,i)=>t[i]||{name:'Team '+(i+1),score:0});renderStage()}
// Add (or subtract) points for team i.
function sc(i,d){if(G&&G.teams[i]){G.teams[i].score+=d;renderStage()}}
// Leave the stage and go back to the library.
function leave(){clearInterval(timer);G=null;go('lib')}
// Prepare the active word. first=true (start of a round) waits 1.5 s before the first letter; otherwise the first letter shows at once.
function startWord(first){const L=G.rs[G.ri].words[G.wi].length;clearTimeout(G.ht);G.hold=false;G.q=false;G.full=false;G.flip=null;G.cd=G.g.interval;
if(first){G.rev=0;if(L>1){G.hold=true;const t=G.ri;G.ht=setTimeout(()=>{if(!G||view!=='stage'||G.ri!==t||G.step!=='round'||G.wi!==1||!G.hold)return;G.hold=false;if(!G.full&&G.rev===0){G.rev=1;G.flip=0;G.cd=G.g.interval;beep(660,.12)}renderStage()},1500)}}
else{G.rev=L>1?1:0;if(G.rev){G.flip=0;beep(660,.12)}}}
// Start round i: pick a random box count (longest word + 1 to 4 extra) and begin the first word to guess.
function setR(i){G.ri=i;G.step='round';const r=G.rs[i];G.cols=Math.max(...r.words.map(w=>w.length))+rnd(1,4);G.wi=1;startWord(true);render()}
// Runs every second: counts down, reveals the next letter, and finally the '?' one interval after the last letter.
function tick(){if(!G||G.step!=='round'||G.paused||G.hold)return;const r=G.rs[G.ri];if(G.wi>=r.words.length)return;const L=r.words[G.wi].length;
if(!G.full&&!G.q&&--G.cd<=0){G.cd=G.g.interval;if(G.rev<L-1){G.rev++;G.flip=G.rev-1;beep(660+G.rev*40,.12)}else{G.q=true;G.flip='q';beep(520,.25,'triangle')}}renderStage()}
// Host action (Space): show the whole active word immediately.
function reveal(){if(!G||G.step!=='round')return;const r=G.rs[G.ri];if(G.wi<r.words.length&&!G.full){G.full=true;beep(880,.3,'triangle');renderStage()}}
// Host action (Right arrow): next word, then next round, then the finish screen.
function next(){if(!G)return;if(G.step==='instr')return setR(0);const r=G.rs[G.ri];
if(G.wi<r.words.length){G.wi++;if(G.wi>=r.words.length){G.rev=0;G.q=false;G.full=false;fan()}else startWord();renderStage()}
else if(G.ri<G.rs.length-1)setR(G.ri+1);else endGame(false)}
// Go back to the previous round.
function prev(){if(G&&G.step==='round'&&G.ri>0)setR(G.ri-1)}
// Skip the rest of this round and go to the next one.
function skip(){if(!G||G.step!=='round')return;if(G.ri<G.rs.length-1)setR(G.ri+1);else endGame(false)}
// Jump from the sample round straight to Round 1.
function skipSample(){setR(1)}
// Show the finish screen: highest score becomes the winner (tie flagged) and the result is saved.
function endGame(early){G.step='end';G.early=early;G.rid=Date.now();G.tie=false;if(G.teams.length){const m=Math.max(...G.teams.map(t=>t.score));G.win=G.teams.findIndex(t=>t.score===m);G.tie=G.teams.filter(t=>t.score===m).length>1;saveResult()}fan();renderStage()}
// Finish Game button: end the game early.
function finish(){if(G&&G.step==='round')endGame(true)}
// Save (or update) this match's winner in the game's winners history.
function saveResult(){const t=G.teams[G.win];if(!t||!REMOTE)return;const r={id:G.rid,winner:t.name,score:t.score,scores:G.teams.map(x=>({name:x.name,score:x.score})),by:me()?me().name:''};
const g=S.games.find(x=>x.id===G.g.id);if(g)g.results=(g.results||[]).filter(x=>x.id!==r.id).concat(r).slice(-30);
rpc('app_save_result',{p_game_id:G.g.id,p_result:r}).catch(x=>toast('Could not save result: '+emsg(x)))}
// Operator override: choose a different winner (e.g. after a technical issue).
function setWin(i){G.win=i;saveResult();renderStage()}
// Undo an early finish: remove the saved result and continue the game.
function resume(){const g=S.games.find(x=>x.id===G.g.id);if(g)g.results=(g.results||[]).filter(r=>r.id!==G.rid);if(REMOTE)rpc('app_remove_result',{p_game_id:G.g.id,p_result_id:String(G.rid)}).catch(()=>{});G.step='round';G.early=false;renderStage()}
// Tile size in pixels so every word fits the screen (phones to projectors).
function fit(){const r=G.rs[G.ri],n=r.words.length;return Math.max(22,Math.min(innerWidth*.9/(G.cols*1.12),(innerHeight-300)/(n*1.4),92))}
// Draw the whole stage: header, scoreboard, word rows, controls and hint banner.
function renderStage(){const g=G.g,r=G.rs[G.ri];let body='';
const hd=c=>`<div class="sh"><div class="t">${esc(g.title)} <small style="font-weight:400;color:var(--muted)">· Created by ${esc(g.by)}</small></div>${c}<button class="btn" onclick="G.sound=!G.sound;renderStage()">${G.sound?'🔊':'🔇'}</button>${G.step==='round'?'<button class="btn" onclick="finish()">🏁 Finish Game</button>':''}<button class="btn" onclick="leave()">Exit</button></div>`;
const sb=G.teams.length?`<div class="row" style="justify-content:center;padding:8px 12px">${G.teams.map((t,i)=>`<span class="pill">${esc(t.name)} <button class="btn" style="padding:0 7px" onclick="sc(${i},-1)">−</button> <b>${t.score}</b> <button class="btn" style="padding:0 7px" onclick="sc(${i},1)">＋</button></span>`).join('')}</div>`:'';
if(G.step==='instr')body=hd('')+`<div class="ov"><h1 style="font-family:'Bebas Neue';font-size:clamp(36px,7vw,72px);color:var(--accent);letter-spacing:2px">How to Play</h1><p>${esc(g.instr)}</p><div class="card" data-enter="blur" style="text-align:left;margin:14px 0"><label>Scoring — number of teams</label><select style="width:auto" onchange="setTeams(+this.value)"><option value="0" ${G.teams.length?'':'selected'}>No scoring</option>${[2,3,4,5,6,8].map(n=>`<option ${G.teams.length===n?'selected':''}>${n}</option>`).join('')}</select><div class="row">${G.teams.map((t,i)=>`<input style="width:140px;margin:4px 0" value="${esc(t.name)}" oninput="G.teams[${i}].name=this.value">`).join('')}</div></div><div class="row" style="justify-content:center"><button class="btn pri" onclick="next()">${g.sample?'Start Sample':'Start Round 1'}</button><button class="btn" onclick="${g.sample?'skipSample()':'next()'}">Skip Instructions</button></div></div>`;
else if(G.step==='end'){const rk=G.teams.map((t,i)=>({...t,i})).sort((a,b)=>b.score-a.score);const w=G.teams[G.win];body=hd('')+`<div class="ov"><h1 style="font-family:'Bebas Neue';font-size:clamp(40px,8vw,90px);color:var(--accent)">Grace Abounds!</h1><p>That's a wrap on ${esc(g.title)}. Thanks for playing together.</p>${w?`<div class="card" style="margin:12px 0"><div style="font-size:clamp(22px,4vw,40px);color:var(--accent);font-weight:800">🏆 Winner: ${esc(w.name)} — ${w.score} pts</div>${G.tie?'<div class="meta" style="justify-content:center">It is a tie on points. Pick the winner below.</div>':''}<div class="meta" style="justify-content:center;margin-top:8px">${rk.map(t=>`${esc(t.name)}: <b>${t.score}</b>`).join(' · ')}</div><label>Change winner (if needed)</label><select style="width:auto" onchange="setWin(+this.value)">${G.teams.map((t,i)=>`<option value="${i}" ${i===G.win?'selected':''}>${esc(t.name)}</option>`).join('')}</select><div class="meta" style="justify-content:center">✓ Result saved to this game file.</div></div>`:''}<div class="row" style="justify-content:center">${G.early?'<button class="btn" onclick="resume()">◀ Resume Game</button>':''}<button class="btn pri" onclick="leave()">Back to Library</button></div></div>`}
else{const n=r.words.length,done=G.wi>=n,lbl=r.sample?'SAMPLE ROUND':`ROUND ${G.ri-(g.sample?1:0)+1} / ${g.rounds.length}`;
const rows=r.words.map((w,i)=>{const full=i===0||i<G.wi||(i===G.wi&&G.full);return `<div class="word">${Array.from({length:G.cols},(_,j)=>{let k='tile',t='';if(j<w.length){const c=w[j];if(full){k+=i===0?' given':' rev';t=c}else if(i===G.wi){if(j<G.rev){k+=' rev'+(G.flip===j?' flip':'');t=c}else if(j===w.length-1&&G.q){k+=' q'+(G.flip==='q'?' flip':'');t='?'}}}return `<div class="${k}">${esc(t)}</div>`}).join('')}</div>`}).join('');G.flip=null;
const cd=done||G.full||G.q?'—':G.paused?'⏸':(G.hold?'…':G.cd+'s');
body=hd(`<span class="pill">${lbl}</span><span class="pill">⏱ ${cd}</span>${r.sample?'<button class="btn" onclick="skipSample()">Skip Sample</button>':''}`)+sb+`<div class="chain" style="--t:${fit()}px">${rows}</div><div class="row" style="justify-content:center;margin-bottom:8px"><button class="btn" onclick="prev()">◀ Previous Round</button><span class="pill">Go to round <select style="width:auto;margin:0 0 0 6px;padding:3px 8px" onchange="setR(+this.value)">${G.rs.map((x,k)=>`<option value="${k}" ${k===G.ri?'selected':''}>${x.sample?'Sample':'Round '+(k-(g.sample?1:0)+1)}</option>`).join('')}</select></span><button class="btn pri" onclick="reveal()">Reveal word</button><button class="btn" onclick="G.paused=!G.paused;renderStage()">${G.paused?'Resume':'Pause'}</button><button class="btn pri" onclick="next()">${done?'Next round ▶':'Next word ▶'}</button><button class="btn" onclick="skip()">Skip Round ▶▶</button></div><div class="hint">${G.hint&&r.hint?esc(r.hint.startsWith('"')?'('+r.hint.replace(/"/g,'')+')':r.hint):'&nbsp;'}</div><div class="keys">Space: reveal word · →: next word/round · H: hint · P: pause${G.teams.length?' · 1–'+G.teams.length+': +1 point (Shift: −1)':''}</div>`}
$('#app').innerHTML=`<div id="stage">${body}</div>`}
// ENTER KEY: inside a [data-enter] container, Enter submits (function name) or moves to the next field.
addEventListener('keydown',e=>{if(e.key!=='Enter'||!/INPUT|SELECT/.test(e.target.tagName))return;const h=e.target.closest('[data-enter]');if(!h)return;const n=h.dataset.enter;e.preventDefault();
if(n==='next'){const all=[...h.querySelectorAll('input:not([type=range]):not([type=color]),textarea')],i=all.indexOf(e.target);if(all[i+1])all[i+1].focus();else e.target.blur()}else if(n==='blur')e.target.blur();else if(typeof window[n]==='function')window[n]()});
// HOST SHORTCUTS on the stage: Space reveal, Right next, Left previous round, H hint, P pause, 1-8 team points (Shift = -1).
addEventListener('keydown',e=>{if(view!=='stage'||!G||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
if(e.code==='Space'){e.preventDefault();G.step==='instr'?next():reveal()}else if(e.key==='ArrowRight')next();else if(e.key==='ArrowLeft')prev();else if(e.key==='h'||e.key==='H'){G.hint=!G.hint;renderStage()}else if(e.key==='p'||e.key==='P'){G.paused=!G.paused;renderStage()}else if(/^Digit[1-8]$/.test(e.code)&&G.step!=='instr')sc(+e.code.slice(5)-1,e.shiftKey?-1:1)});
// Re-fit the tiles when the window size changes.
addEventListener('resize',()=>{if(view==='stage'&&G&&G.step==='round')renderStage()});
// Start the app.
boot();

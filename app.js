/* =====================================================================
   Bicutan Bible Church - Word Chain Reaction  (app.js)
   Single-page game-show app. No build step.
   Files: index.html (page + icon sprite) - style.css (look) - config.js (database keys) - app.js (this file)
   Flow : boot() -> render() draws the active screen from the state objects below.
          Buttons call global functions (onclick) which change state and call render().
   ===================================================================== */
// Tiny helpers: $ = querySelector, esc = escape HTML so typed text can never inject markup.
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Put a value safely inside a single-quoted JavaScript string in an onclick attribute.
const jarg=s=>String(s??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
// DEFAULT GAME "Grace Chain Reaction" (the same content is seeded into the database by setup.sql).
// R('A B C','hint') builds a round from space-separated words. The first word is the one given to players.
const R=(w,h)=>({words:w.split(' '),hint:h||''});
const DEF={id:'default',title:'Grace Chain Reaction',desc:'The Bicutan Bible Church signature icebreaker: compound-word chains with faith-themed hints.',interval:4,by:'Bicutan Bible Church',
  series:'Word Chain Reaction',sub:'A fellowship icebreaker for all ages',date:'',welcome:'Welcome, Fellowship!',
  instr:'Connect each word to the next to form a chain! Letters reveal every few seconds. The last letter is always hidden as a "?" until guessed!',
  sample:'FAST FOOD CHAIN SAW BLADE'.split(' '),rounds:[R('SMART WATCH LIST REPORT WRITING','General Warmup'),R('TIME SHEET MASK POLICY UPDATE','Life & Stewardship'),R('CAREER PATHWAY POINT SYSTEM','Walking the Path'),R('ZOOM CALL CENTER STAGE NAME','Fellowship Connections'),R('WORKSPACE BAR CODE NUMBER','Order & Structure'),
  R('CROSS WALK THROUGH FAITH STEP','"We walk only by grace through faith."'),R('BROKEN HEART BEAT DOWN LOAD','"Even the broken are carried by grace."'),R('FREE FALL BACK TRACK RECORD','"Grace covers every fall and every failure."'),R('LIGHT WEIGHT LIFT OFF BASE','"Even when we\'re off base, He lifts us."'),R('CROSS OVER TIME LINE BREAK','"Grace crosses all boundaries of time."')]};
// DEFAULT BRANDING. base = the deep tone behind the app and the stage, accent = the green that
// fills buttons and revealed tiles. Everything else is derived in CSS or in themeVars(). v = settings version.
const BRAND0={name:'Bicutan Bible Church',sub:'Word Chain Reaction',logo:'',base:'#0A2A1E',accent:'#17794A',v:3};
// The forest green the light theme uses as its ink, mixed with the brand base.
const FOREST='#0E3B2A';
// The hero pattern: the Round 6 chain, showing all four tile states.
const HERO=[{w:'CROSS',s:'given'},{w:'WALK',s:'rev'},{w:'THROUGH',s:'rev'},{w:'FAITH',s:'q'},{w:'STEP',s:'empty'}];
// The church mark, drawn in the page colours.
const markArt=()=>markSVG();
// The hero pattern (5 rows) and the library strip (2 rows cropped from it).
const heroArt=rows=>tileHero({u:rows>2?20:16,cols:9,words:HERO.slice(0,rows)});
// An empty state: the tile art, one sentence and one action.
function emptyState(kind,title,text,action){
  return `<div class="empty"><div class="empty-art">${emptyArt(kind)}</div><div><h3>${esc(title)}</h3><p>${esc(text)}</p>${action||''}</div></div>`}
// COLOUR PALETTES for the branding panel. Each one sets the Base and the Accent together.
const PAL=[{n:'Bicutan green',base:'#0A2A1E',accent:'#17794A'},{n:'Deep pine',base:'#12241C',accent:'#1E7A52'},{n:'Church navy',base:'#0F172A',accent:'#2F6FD0'},{n:'Slate',base:'#1E293B',accent:'#0EA5E9'},{n:'Sunset',base:'#3B0A14',accent:'#D23B57'},{n:'Olive',base:'#1E2413',accent:'#6B8E23'}];
// Apply a colour palette: it sets the base and the accent, then saves the brand.
function applyPal(i){const p=PAL[i];if(!p)return;S.brand.base=p.base;S.brand.accent=p.accent;bsave();brand();render()}
/* =====================================================================
   COLOUR HELPERS
   The admin picks two colours (base, accent). The rest of the palette is
   derived from them here, so the whole app stays in step with the brand.
   ===================================================================== */
// Turn a hex colour into [r,g,b].
const hex2rgb=h=>{h=String(h||'').replace('#','').trim();if(h.length===3)h=h.split('').map(c=>c+c).join('');const n=parseInt(h,16);return isNaN(n)?[0,0,0]:[(n>>16)&255,(n>>8)&255,n&255]};
// Turn [r,g,b] back into a hex colour.
const rgb2hex=c=>('#'+c.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('')).toUpperCase();
// Mix two hex colours (t = share of the second colour).
const mixc=(a,b,t)=>{const A=hex2rgb(a),B=hex2rgb(b);return rgb2hex(A.map((v,i)=>v+(B[i]-v)*t))};
// Relative luminance of a hex colour (WCAG).
const lum=h=>{const c=hex2rgb(h).map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});return .2126*c[0]+.7152*c[1]+.0722*c[2]};
// Contrast ratio between two hex colours (WCAG, 1 to 21).
const ratio=(a,b)=>{const l1=lum(a),l2=lum(b);return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05)};
// Move a colour towards white (dir 1) or black (dir -1) until it reaches the wanted contrast on a background.
const tune=(c,bg,target,dir)=>{let x=c;for(let i=0;i<80&&ratio(x,bg)<target;i++)x=mixc(x,dir>0?'#FFFFFF':'#000000',.04);return x};
// Make sure a colour is deep enough to stand in for a dark background.
const darken=(c,max)=>{let x=c;for(let i=0;i<80&&lum(x)>max;i++)x=mixc(x,'#000000',.04);return x};
// Bring an older branding object up to date: v2 used primary/stage, v3 uses accent/base.
function migrateBrand(v){v=Object.assign({},v||{});if(v.v!==3){v.accent=v.primary||BRAND0.accent;v.base=v.stage||BRAND0.base}
  v.accent=v.accent||BRAND0.accent;v.base=v.base||BRAND0.base;v.v=3;
  delete v.primary;delete v.stage;delete v.mint;delete v.text;return v}
// Build the app colour tokens for one theme from the brand colours.
// Dark: the paper is the base and everything else is mixed out of it.
// Light: the ink is a forest green mixed from the base, and the paper is
// that ink washed almost to white. The accent is tuned to stay readable.
function themeVars(dark){
  const b=S.brand,src=b.accent;
  if(dark){
    const base=darken(b.base,.05);
    const paper=base,tint=mixc(base,'#FFFFFF',.05),rule=mixc(base,'#FFFFFF',.16),line=mixc(base,'#FFFFFF',.40),ink=mixc(base,'#FFFFFF',.92),muted=mixc(base,'#FFFFFF',.58);
    const acc=tune(tune(src,paper,4.5,1),tint,4.5,1);
    return{'--paper':paper,'--tint':tint,'--ink':ink,'--muted':muted,'--rule':rule,'--line':line,'--accent':acc,'--on-accent':mixc(acc,'#000000',.9),'--gold':'#E5A823','--gold-text':'#F0C25A','--danger':'#FF8F85'};
  }
  const ink=mixc(b.base,FOREST,.5);
  const paper=mixc(ink,'#FFFFFF',.94),tint=mixc(ink,'#FFFFFF',.88),rule=mixc(ink,'#FFFFFF',.78),muted=mixc(ink,'#FFFFFF',.25),line=mixc(ink,'#FFFFFF',.38);
  const acc=tune(tune(src,'#FFFFFF',5,-1),tint,4.5,-1);
  return{'--paper':paper,'--tint':tint,'--ink':ink,'--muted':muted,'--rule':rule,'--line':line,'--accent':acc,'--on-accent':'#FFFFFF','--gold':'#E5A823','--gold-text':'#7A5200','--danger':'#A32020'};
}
// The stage has its own theme, so it gets its own set of the same tokens.
function stageVars(dark){
  const v=themeVars(dark),o={};
  for(const k in v)o['--s-'+k.slice(2)]=v[k];
  return o;
}
// The favicon follows the brand: the mark drawn in the current Base and Accent.
function faviconSVG(base,accent){
  const svg=markSVG({ink:base,rule:base,accent:accent,gold:'#E5A823',goldText:'#7A5200',onAccent:'#FFFFFF'},{u:22,pad:0,aria:false});
  return 'data:image/svg+xml,'+encodeURIComponent(svg)}
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
function load(){let d={};try{d=JSON.parse(localStorage.getItem('bbc2'))||{}}catch(e){}return{users:[],games:REMOTE?[]:[DEF,G5_DEMO],brand:migrateBrand(BRAND0),theme:d.theme||'dark',stageTheme:d.stageTheme||null,session:d.session||null}}
let S=load();const save=()=>{try{localStorage.setItem('bbc2',JSON.stringify({theme:S.theme,stageTheme:S.stageTheme,session:S.session}))}catch(e){}};
let bt=null;const bsave=()=>{save();if(!REMOTE)return;clearTimeout(bt);bt=setTimeout(()=>{bt=null;if(me()&&me().role==='Admin')authed('app_save_brand',{p_brand:S.brand}).catch(x=>toast(emsg(x)))},700)};
// Friendly text for the error codes raised by the database functions (see setup.sql).
const EM={bad_credentials:'Wrong username or password. Check both and try again.',pending:'Your account is waiting for Admin approval.',disabled:'This account is disabled. Ask the Admin to enable it.',username_taken:'That username is taken. Try another.',invalid_input:'Check your input: a username needs 2 or more characters, a password 4 or more.',not_authenticated:'Your session expired. Log in again.',forbidden:'You are not allowed to do that.',not_found:'Not found.'};
const emsg=x=>EM[x.message]||(/invalid path|HTTP 404/i.test(x.message)?'Database address looks wrong. In config.js use only https://YOUR-PROJECT.supabase.co (no /rest/v1 and not the dashboard link).':/could not find the function|PGRST202/i.test(x.message)?'Database functions are missing. Run setup.sql again in the Supabase SQL Editor.':/fetch|network/i.test(x.message)?'Cannot reach the database. Check your connection and config.js.':x.message);
// Show a small message at the bottom of the screen for a few seconds.
function toast(m){const t=document.createElement('div');t.className='toast';t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),3500)}
// Call a database function that needs a login. Adds the session token and logs the user out if it has expired.
async function authed(fn,args){if(!S.session||!S.session.token)throw new Error('not_authenticated');try{return await rpc(fn,{p_token:S.session.token,...(args||{})})}catch(x){if(x.message==='not_authenticated'){S.session=null;save();view='auth';err='Session expired. Please log in again.';render()}throw x}}
// Download all games and the branding from the database into S.
async function pull(){const [g,b]=await Promise.all([sel('app_games?select=id,data,created_at&order=created_at.asc'),sel('app_settings?select=value&key=eq.brand')]);S.games=g.map(x=>({...x.data,id:x.id,created:x.created_at}));if(b[0]&&!bt)S.brand=migrateBrand(b[0].value)}
// Reload games from the database and redraw the library.
async function refresh(){if(!REMOTE)return;try{await pull();if(view==='lib')render()}catch(x){toast(emsg(x))}}
// Admin only: load the account list.
async function loadUsers(){try{S.users=await authed('app_admin_users');if(view==='admin'||view==='lib')render()}catch(x){}}
// Admin: run an action on one account (approve, toggle, delete, set_password).
async function uact(id,a,v){try{await authed('app_admin_user_action',{p_user:id,p_action:a,p_value:v||null});
  if(a==='set_password')toast(v==='welcome123'?'Password reset to: welcome123':'Password updated.');
  if(a==='approve')toast('Account approved.');
  if(a==='delete')toast('Account deleted.');
  showPw[id]=null;await loadUsers()}catch(x){toast(emsg(x))}}
// Admin: fetch one member's password and show it in the table.
async function viewPw(id){try{const r=await authed('app_admin_view_password',{p_user:id});showPw[id]=r.password;render()}catch(x){toast(emsg(x))}}
// Admin: ask for a new password and save it.
function chgPw(id){const p=prompt('New password (4+ characters):');if(p&&p.length>=4)uact(id,'set_password',p)}
// App start-up: show Loading, fetch data, check the saved login, then show the first screen.
async function boot(){
  if(PRESENT_ID)return presentBoot();
  // the Gimme 5 audience window: index.html#present=<session>
  const h=location.hash||'';
  if(h.indexOf('#present=')===0)return presentG5Boot(h.slice(9));
  render();if(REMOTE){try{await pull()}catch(x){err=emsg(x)}
  if(S.session&&S.session.token){try{const u=await rpc('app_me',{p_token:S.session.token});S.session=u?{...u,token:S.session.token}:null;save()}catch(x){}}
  if(S.session&&S.session.role==='Admin')loadUsers()}
  view=S.session?'lib':'auth';loading=false;render()}
/* =====================================================================
   APP STATE
   loading: first data load in progress | view: current screen | regMode: login form
   flt/q: library filter + search | ST: studio state | G: running game | err: message under forms
   ===================================================================== */
let loading=true,view=S.session?'lib':'auth',regMode=false,flt='all',q='',ST=null,G=null,timer=null,AC=null,err='',errKind='err',showPw={},delId=null,infoId=null,lastView='';
// The second screen (projector or extended monitor). PRESENT_ID is set in that window's own URL.
const PRESENT_ID=new URLSearchParams(location.search).get('present');
let PRESENT_WIN=null,PRESENT_GAME=null;
// The logged-in user (or null) and what they are allowed to do.
const me=()=>S.session,canEdit=g=>me()&&(me().role==='Admin'||g.owner===me().id),canBuild=()=>me()&&me().role!=='Guest';
// Apply the theme and the derived brand colours to the page (CSS variables),
// and rebuild the favicon so the tab icon follows the branding.
function brand(){const r=document.documentElement,b=S.brand;r.dataset.theme=S.theme;const v=themeVars(S.theme==='dark');for(const k in v)r.style.setProperty(k,v[k]);
  const f=document.getElementById('favicon');if(f)f.href=faviconSVG(b.base,b.accent);
  document.title=b.name+' - Word Chain Reaction'}
// Apply the stage colours to the stage element. The stage theme is its own setting.
function stageBrand(el){if(!el)return;const v=stageVars(stageTheme()==='dark');for(const k in v)el.style.setProperty(k,v[k])}
// The stage theme is independent of the site theme; with no choice it follows the site theme.
const stageTheme=()=>S.stageTheme||S.theme;
// Switch screen: 'auth', 'lib', 'studio', 'admin' or 'stage'. Loads fresh data when needed.
function go(v){view=v;err='';errKind='err';render();if(v==='admin')loadUsers();if(v==='lib')refresh()}
// Switch between the light and the dark site theme.
function toggleTheme(){S.theme=S.theme==='dark'?'light':'dark';save();render()}
// Switch the stage between its own light and dark theme.
function setStageTheme(t){S.stageTheme=t;save();renderStage()}
/* =====================================================================
   SOUND EFFECTS
   Short beeps made with the Web Audio API (no audio files needed).
   ===================================================================== */
// Play one short tone (only when sound is on).
function beep(f,d=.15,t='sine',when=0){if(!G||!G.sound)return;try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();const o=AC.createOscillator(),g=AC.createGain();o.type=t;o.frequency.value=f;g.gain.setValueAtTime(.15,AC.currentTime+when);g.gain.exponentialRampToValueAtTime(.001,AC.currentTime+when+d);o.connect(g);g.connect(AC.destination);o.start(AC.currentTime+when);o.stop(AC.currentTime+when+d)}catch(e){}}
const fan=()=>[523,659,784,1047].forEach((f,i)=>beep(f,.3,'triangle',i*.12));
/* =====================================================================
   PAGE SHELL
   Top bar + whichever screen is active.
   ===================================================================== */
// Redraw the current screen: top bar plus the active view.
function render(){brand();if(view==='stage'){renderStage();return}
  if(view==='stage5'){renderG5();return}
  if(loading){$('#app').innerHTML='<main><p class="lede">Loading...</p></main>';return}
  const b=S.brand,u=me(),pend=S.users.filter(x=>x.pending).length;
  const fade=view!==lastView;lastView=view;
  let h='<nav class="topbar"><div class="wordmark">'+(b.logo?`<img src="${esc(b.logo)}" alt="" onerror="this.style.display='none'">`:`<span class="mark">${markArt()}</span>`)+`<div><span class="wm-name">${esc(b.name)}</span><span class="wm-sub">${esc(b.sub)}</span></div></div>`;
  if(u){h+='<div class="navlinks">';
    h+=`<button class="navlink ${view==='lib'?'on':''}" onclick="go('lib')">Games</button>`;
    if(canBuild())h+=`<button class="navlink ${view==='studio'?'on':''}" onclick="openStudio()">Studio</button>`;
    if(u.role==='Admin')h+=`<button class="navlink ${view==='admin'?'on':''}" onclick="go('admin')">Admin${pend?' <span class="count">'+pend+'</span>':''}</button>`;
    h+='</div>'}
  h+='<div class="navright">';
  h+=`<button class="link" onclick="toggleTheme()" title="Switch to the ${S.theme==='dark'?'light':'dark'} theme">${S.theme==='dark'?'Light':'Dark'}</button>`;
  if(u)h+=`<div class="menu"><button class="userbtn" onclick="toggleMenu(event)" aria-haspopup="true"><svg class="ic"><use href="#i-user"></use></svg><span>${esc(u.name)}</span><span class="role">${u.role}</span><svg class="ic ic-sm"><use href="#i-chevron-down"></use></svg></button><div id="um" class="dd" hidden><div class="sub">Signed in as <b>${esc(u.name)}</b><br>Account type: ${u.role}</div><button class="link dng" onclick="logout()"><svg class="ic"><use href="#i-logout"></use></svg>Log out</button></div></div>`;
  h+='</div></nav><main'+(fade?' class="fadein"':'')+'>';
  h+=!u?authV():view==='lib'?libV():view==='studio'?studioV():view==='admin'?adminV():libV();
  $('#app').innerHTML=h+'</main>';
  const d=$('#info');if(d&&!d.open)d.showModal()}
/* =====================================================================
   LOGIN / REGISTER / GUEST
   Accounts live in the database; guests are local only.
   ===================================================================== */
// Login screen: a short introduction on the left, the form on the right.
function authV(){
  const f=`<div class="seg" style="margin-bottom:var(--s3)"><button class="${!regMode?'on':''}" onclick="regMode=false;err='';errKind='err';render()">Log in</button><button class="${regMode?'on':''}" onclick="regMode=true;err='';errKind='err';render()">Register</button></div>
  ${regMode?`<div class="field"><label class="label" for="un">Display name</label><input id="un" autocomplete="name"></div>`:''}
  <div class="field"><label class="label" for="ue">Username</label><input id="ue" autocapitalize="none" autocomplete="username"></div>
  <div class="field"><label class="label" for="up">Password</label><div class="w-input"><input id="up" type="password" autocomplete="current-password"><button type="button" class="btn" onclick="togglePw(this)" aria-label="Show password"><svg class="ic"><use href="#i-eye"></use></svg></button></div></div>
  <button class="btn pri" onclick="doUser()">${regMode?'Request account':'Log in'}</button>
  ${regMode?'<p class="note" style="margin-top:var(--s2)">New accounts wait for Admin approval before they can log in.</p>':''}`;
  return `<div class="auth">
  <section class="auth-hero"><div class="mark">${markArt()}</div>
  <h1>Word Chain Reaction</h1>
  <p class="lede">A fellowship icebreaker for teams of all ages. The host reveals one letter at a time and the teams guess the word.</p>
  <div class="previews previews-static">
    <div class="preview-card"><span class="note">Word Chain Reaction</span><div class="pattern-strip">${heroArt(5)}</div></div>
    <div class="preview-card"><span class="note">Gimme 5</span><div class="pattern-strip">${g5Preview()}</div></div></div></section>
  <section class="auth-form">
  ${REMOTE?'':'<div class="notice"><svg class="ic"><use href="#i-info"></use></svg><div><b>Database not connected.</b> Guests can still play the default game. To enable accounts, saved games and cross-device sync, add your Supabase keys to <code>config.js</code> (see README).</div></div>'}
  <div data-enter="doUser">${f}</div>
  <div class="auth-sep">or play without an account</div>
  <div data-enter="doGuest"><div class="field"><label class="label" for="gn">Nickname (optional)</label><input id="gn" placeholder="Brother Matthew"></div>
  <button class="btn" onclick="doGuest()">Enter as guest</button>
  <p class="note" style="margin-top:var(--s1)">A guest name stays in this browser only. Nothing is sent to the database.</p></div>
  <div class="${errKind==='ok'?'ok':'err'}" style="margin-top:var(--s2)">${esc(err)}</div></section></div>`}
// Remember the logged-in user and open the library.
function sess(u){S.session={id:u.id,name:u.name,role:u.role,token:u.token};save();view='lib';render();if(u.role==='Admin')loadUsers()}
// Show or hide the password text in the login form (eye button).
function togglePw(b){const i=$('#up'),h=i.type==='password';i.type=h?'text':'password';
  b.innerHTML=`<svg class="ic"><use href="#i-${h?'eye-off':'eye'}"></use></svg>`;b.setAttribute('aria-label',h?'Hide password':'Show password')}
// Log in or register (depending on regMode). New registrations wait for Admin approval.
async function doUser(){const e=$('#ue').value.trim().toLowerCase(),p=$('#up').value;if(!e||!p){err='Username and password are required.';errKind='err';return render()}
  if(!REMOTE){err='Database not connected yet. See README (config.js).';errKind='err';return render()}
  try{if(regMode){await rpc('app_register',{p_username:e,p_name:$('#un').value.trim(),p_password:p});regMode=false;err='Account requested. Wait for Admin approval before logging in.';errKind='ok';render()}
  else{const r=await rpc('app_login',{p_username:e,p_password:p});sess({...r.user,token:r.token})}}catch(x){err=emsg(x);errKind='err';render()}}
// Enter as a guest. Local only, nothing is stored in the database.
function doGuest(){const n=$('#gn').value.trim()||'Guest '+Math.floor(Math.random()*900+100);sess({id:'g'+Date.now(),name:n,role:'Guest'})}
// Open or close the user dropdown menu in the top bar.
function toggleMenu(e){e.stopPropagation();const m=$('#um');if(m)m.hidden=!m.hidden}
addEventListener('click',()=>{const m=$('#um');if(m)m.hidden=true});
// End the session on the server and return to the login screen.
function logout(){const t=S.session&&S.session.token;if(t&&REMOTE)rpc('app_logout',{p_token:t}).catch(()=>{});S.session=null;S.users=[];save();view='auth';render()}
/* =====================================================================
   GAME LIBRARY
   Search, filter, play, present, edit, delete and view game info.
   ===================================================================== */
// Game library screen: one row per game, with the details and the actions.
function libV(){let gs=S.games.filter(g=>g.title.toLowerCase().includes(q.toLowerCase())&&(flt==='all'||(flt==='mine'&&me()&&g.owner===me().id)||g5Type(g)===flt));
  const rows=gs.map(g=>{const is5=g5Type(g)==='gimme5';return `<article class="grow">
    <div><h3 class="grow-title">${esc(g.title)}</h3><p class="grow-desc">${esc(g.desc)}</p>
    <p class="grow-type">${is5?'Gimme 5':'Word Chain Reaction'}</p>
    <dl class="grow-meta">${is5?`<div><dt>Questions</dt><dd>${(g.round1&&g.round1.questions||[]).length}</dd></div>
    <div><dt>Seconds per letter</dt><dd>${(g.round2&&g.round2.seconds)||120}s in Round 2</dd></div>`
    :`<div><dt>Rounds</dt><dd>${g.rounds.length}${g.sample?' plus sample':''}</dd></div>
    <div><dt>Seconds per letter</dt><dd>${g.interval}s</dd></div>`}
    <div><dt>Created by</dt><dd>${esc(g.by)}</dd></div>
    <div><dt>Last winner</dt><dd>${esc(g5LastLine(g))}</dd></div></dl></div>
    <div class="grow-actions"><button class="btn pri" onclick="play('${jarg(g.id)}')">${is5?'Play':'Play'}</button>
    <button class="btn" onclick="present('${jarg(g.id)}')">Present</button>
    <button class="link" onclick="infoId='${jarg(g.id)}';render()">Info</button>
    ${canEdit(g)?`<button class="link" onclick="editGame('${jarg(g.id)}')">Edit</button>
    <button class="link dng" onclick="delGame('${jarg(g.id)}')">Delete</button>`:''}</div></article>`}).join('');
  let empty='';
  if(!gs.length)empty=flt==='mine'||flt==='chain'||flt==='gimme5'
    ?emptyState('search','No games here','This filter has no games yet. Try another filter, or create one.','<button class="link" onclick="flt=\'all\';render()">Show all games</button>')
    :q?emptyState('search','No games match your search','Clear it, or create a game for the next meeting.','<button class="link" onclick="q=\'\';render()">Clear the search</button>')
    :emptyState('games','No games yet','Create the first one for your next fellowship.',canBuild()?'<button class="btn pri" onclick="newGame()">Create game</button>':'');
  return `<div class="previews">
    <button class="preview-card${flt==='chain'?' on':''}" onclick="flt='chain';render()"><span class="note">Word Chain Reaction</span><div class="pattern-strip">${heroArt(2)}</div></button>
    <button class="preview-card${flt==='gimme5'?' on':''}" onclick="flt='gimme5';render()"><span class="note">Gimme 5</span><div class="pattern-strip">${g5Preview()}</div></button></div>
  <div class="page-head"><h1>Fellowship games</h1>
  ${canBuild()?`<div class="row"><button class="btn pri" onclick="newGame()">Create Word Chain Reaction</button><button class="btn" onclick="newGame5()">Create Gimme 5</button></div>`:''}</div>
  <div class="toolbar"><input class="search" placeholder="Search games" value="${esc(q)}" oninput="q=this.value;clearTimeout(window._t);window._t=setTimeout(()=>{render();const i=document.querySelector('main input');i.focus();i.setSelectionRange(q.length,q.length)},250)">
  <div class="seg seg-sm"><button class="${flt==='all'?'on':''}" onclick="flt='all';render()">All</button>
  <button class="${flt==='chain'?'on':''}" onclick="flt='chain';render()">Word Chain</button>
  <button class="${flt==='gimme5'?'on':''}" onclick="flt='gimme5';render()">Gimme 5</button>
  ${canBuild()?`<button class="${flt==='mine'?'on':''}" onclick="flt='mine';render()">Mine</button>`:''}</div>
  <button class="link" onclick="refresh().then(()=>toast('Games refreshed'))">Refresh</button></div>
  <div class="glist">${rows||empty}</div>${infoModal()}`}
// Date helpers for the info dialog (created date, and date + time a match was won).
const fmtDate=t=>t?new Date(t).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'}):'-',fmtDateTime=t=>new Date(t).toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
// Dialog with a game's details: creator, date created, and the winners history.
function infoModal(){if(!infoId)return'';const g=S.games.find(x=>x.id===infoId);if(!g){infoId=null;return''}
  const is5=g5Type(g)==='gimme5',rs=(g.results||[]).slice().reverse();
  return `<dialog id="info" class="dlg" onclick="if(event.target===this)this.close()" onclose="infoId=null">
  <div class="dlg-head"><h2>${esc(g.title)}</h2><button class="btn btn-sm" onclick="infoId=null;document.getElementById('info').close()" aria-label="Close"><svg class="ic"><use href="#i-close"></use></svg></button></div>
  <div class="dlg-body"><dl class="dlg-facts">
  <div><dt>Created by</dt><dd>${esc(g.by)}</dd></div>
  <div><dt>Date created</dt><dd>${esc(fmtDate(g.created))}</dd></div>
  <div><dt>Type</dt><dd>${is5?'Gimme 5':'Word Chain Reaction'}</dd></div>
  ${is5?`<div><dt>Questions</dt><dd>${(g.round1&&g.round1.questions||[]).length}</dd></div>`:`<div><dt>Rounds</dt><dd>${g.rounds.length}${g.sample?' plus sample':''}</dd></div>`}
  <div><dt>Seconds per letter</dt><dd>${is5?((g.round2&&g.round2.seconds)||120)+'s in Round 2':g.interval+'s'}</dd></div></dl>
  <h3>Winners history</h3>
  ${is5?g5InfoRows(g):(rs.length?`<table><thead><tr><th>Date won</th><th>Winner</th><th>Score</th><th>Hosted by</th></tr></thead><tbody>${rs.map(r=>`<tr><td>${esc(fmtDateTime(r.id))}</td><td>${esc(r.winner)}</td><td>${r.score}</td><td>${esc(r.by||'-')}</td></tr>`).join('')}</tbody></table>`:'<p class="meta">No results yet. Winners appear here after a game is finished with scoring on.</p>')}
  </div></dialog>`}
// Delete a game (creator or Admin only; checked on the server).
async function delGame(id){if(confirm('Delete this game?')){try{await authed('app_delete_game',{p_id:id});toast('Game deleted.');await pull();render()}catch(x){toast(emsg(x))}}}
/* =====================================================================
   GAME STUDIO - create or edit a game file
   ST ("studio state") holds the game being edited. Inputs write straight
   into ST through oninput, so typing never re-renders or loses focus.
   ST.sample is null when no sample round is used, or an array of words.
   ===================================================================== */
const INSTR=DEF.instr;      // default text for the instructions slide
const WORDS_PER_ROUND=5;    // a new round starts with this many word boxes

// A blank round: 5 empty word boxes (the first box is the word given to players).
const newRound=()=>({words:Array(WORDS_PER_ROUND).fill(''),hint:''});

// Start a brand-new game in the studio.
function newGame(){ST5=null;ST={id:null,title:'',desc:'',series:'',sub:'',date:'',welcome:'',interval:4,instr:INSTR,rounds:[newRound()],sample:null,prompt:'',n:5};go('studio')}

// Open the studio on the "what do you want to create" screen.
function openStudio(){ST=null;ST5=null;go('studio')}

// Load an existing game into the studio for editing.
function editGame(id){const g=S.games.find(x=>x.id===id);if(!g)return;if(g5Type(g)==='gimme5')return editGame5(id);ST5=null;ST={id:g.id,title:g.title,desc:g.desc,series:g.series||'',sub:g.sub||'',date:g.date||'',welcome:g.welcome||'',interval:g.interval,instr:g.instr,rounds:g.rounds.map(r=>({words:[...r.words],hint:r.hint})),sample:g.sample?[...g.sample]:null,prompt:'',n:5};go('studio')}

// Quick-add 1, 5 or 10 blank rounds. A single untouched blank round is replaced, so "+5 rounds" on a new game gives exactly 5.
function addRounds(n){if(ST.rounds.length===1&&!ST.rounds[0].hint&&ST.rounds[0].words.every(w=>!w.trim()))ST.rounds=[];for(let i=0;i<n;i++)ST.rounds.push(newRound());render()}

// Row of word inputs for any word array. p is the JS path of that array as text
// (e.g. "ST.rounds[2].words" or "ST.sample"). The first input is the given word;
// "word at start" lets the creator insert a new first word, "word at end" adds a last word.
function wordEditor(p,arr){return `<div class="wrow">
  <button class="btn btn-sm" onclick="${p}.unshift('');render()"><svg class="ic ic-sm"><use href="#i-plus"></use></svg>Word at start</button>
  ${arr.map((w,j)=>`${j?'<span class="arrow"></span>':''}<input value="${esc(w)}" placeholder="${j?'WORD '+(j+1):'FIRST WORD'}" aria-label="Word ${j+1}" oninput="${p}[${j}]=this.value">
  <button class="btn btn-sm icon-only" title="Remove this word" aria-label="Remove word ${j+1}" onclick="${p}.splice(${j},1);render()"><svg class="ic ic-sm"><use href="#i-minus"></use></svg></button>`).join('')}
  <button class="btn btn-sm" onclick="${p}.push('');render()"><svg class="ic ic-sm"><use href="#i-plus"></use></svg>Word at end</button></div>`}

// The Game Studio screen: settings, sample round, generator, then the list of rounds.
// The studio: choose which kind of game to make, or edit the one that is open.
function studioV(){
  if(ST5)return studio5V();
  if(ST)return studioChainV();
  return `<div class="studio"><h1>Studio</h1>
  <p class="lede">What do you want to create?</p>
  <div class="previews">
    <button class="preview-card" onclick="newGame()"><span class="note">Word Chain Reaction</span>
    <div class="pattern-strip">${heroArt(2)}</div>
    <p class="note">A chain of compound words. The host reveals one letter at a time and the teams guess the word.</p></button>
    <button class="preview-card" onclick="newGame5()"><span class="note">Gimme 5</span>
    <div class="pattern-strip">${g5Preview()}</div>
    <p class="note">Five hidden answers to a question, then a Guesser and a Helper find five words from a category.</p></button>
  </div></div>`}

// The Word Chain studio form.
function studioChainV(){
  return `<div class="studio" data-enter="next">
  <h1>Game Studio</h1>
  <div class="sect"><h2>Welcome message</h2>
  <p class="sect-note">Shown on the stage and on the second screen. The welcome stays up until the host begins the first round.</p>
  <div class="field"><label class="label" for="wser">Series</label><input id="wser" value="${esc(ST.series||'')}" oninput="ST.series=this.value" placeholder="e.g. Word Chain Reaction"></div>
  <div class="field"><label class="label" for="wtit">Title</label><input id="wtit" value="${esc(ST.title)}" oninput="ST.title=this.value" placeholder="e.g. Grace Chain Reaction"></div>
  <div class="field"><label class="label" for="wsub">Sub-title</label><input id="wsub" value="${esc(ST.sub||'')}" oninput="ST.sub=this.value" placeholder="e.g. A fellowship icebreaker for all ages"></div>
  <div class="field"><label class="label" for="wdat">Date</label><input id="wdat" value="${esc(ST.date||'')}" oninput="ST.date=this.value" placeholder="e.g. 21 October 2026"></div>
  <div class="field"><label class="label" for="wwel">Welcome phrase</label><input id="wwel" value="${esc(ST.welcome||'')}" oninput="ST.welcome=this.value" placeholder="e.g. Welcome, Fellowship!"></div></div>
  <div class="sect"><h2>Settings</h2>
  <div class="field"><label class="label" for="gd">Description</label><input id="gd" value="${esc(ST.desc)}" oninput="ST.desc=this.value"></div>
  <div class="field"><label class="label" for="gi">Auto-reveal interval (seconds per letter)</label>
  <input id="gi" type="number" min="1" step="1" value="${ST.interval}" oninput="ST.interval=+this.value;$('#iw').style.display=ST.interval>=10?'block':'none'">
  <p id="iw" class="warnnote" style="display:${ST.interval>=10?'block':'none'};margin-top:8px">Ten seconds or more is quite slow and the game may drag. You can still continue and save.</p></div>
  <div class="field"><label class="label" for="gx">Instructions slide text</label><textarea id="gx" rows="3" oninput="ST.instr=this.value">${esc(ST.instr)}</textarea></div></div>
  <div class="sect"><h2>Sample round <span class="note">(optional demonstration)</span></h2>
  ${ST.sample?`${wordEditor('ST.sample',ST.sample)}<div class="row"><button class="btn btn-sm" onclick="ST.sample=['FAST','FOOD','CHAIN','SAW','BLADE'];render()">Use the example</button><button class="link dng" onclick="ST.sample=null;render()">Remove the sample</button></div>`
  :`<p class="sect-note">Add a practice round the host can use to show players how the game works.</p>
  <button class="btn btn-sm" onclick="ST.sample=Array(WORDS_PER_ROUND).fill('');render()"><svg class="ic"><use href="#i-plus"></use></svg>Add a sample round</button>`}</div>
  <div class="sect" data-enter="aiGen"><h2>Chain generator <span class="note">(simulated, offline)</span></h2>
  <div class="field"><label class="label" for="pr">What should the chains be about?</label><input id="pr" placeholder="5 rounds about the Fruit of the Spirit" value="${esc(ST.prompt)}" oninput="ST.prompt=this.value"></div>
  <div class="field"><label class="label" for="pn">Number of rounds</label><select id="pn" onchange="ST.n=+this.value">${[3,5,8,10].map(n=>`<option value="${n}" ${ST.n===n?'selected':''}>${n}</option>`).join('')}</select></div>
  <button class="btn pri" onclick="aiGen()">Generate chains</button></div>
  <div class="sect"><h2>Rounds (${ST.rounds.length})</h2>
  <div class="row" style="margin-bottom:var(--s2)"><span class="note">Quick add:</span><div class="btngroup">
  <button class="btn btn-sm" onclick="addRounds(1)">1 round</button><button class="btn btn-sm" onclick="addRounds(5)">5 rounds</button><button class="btn btn-sm" onclick="addRounds(10)">10 rounds</button></div></div>
  ${ST.rounds.map((r,i)=>`<div class="round"><div class="round-head"><h3>Round ${i+1}</h3>
  <button class="link dng" onclick="ST.rounds.splice(${i},1);render()"><svg class="ic"><use href="#i-trash"></use></svg>Delete round</button></div>
  ${wordEditor('ST.rounds['+i+'].words',r.words)}
  <div class="round-hint"><label class="label">Optional hint</label><input value="${esc(r.hint)}" oninput="ST.rounds[${i}].hint=this.value"></div></div>`).join('')||emptyState('rounds','No rounds yet','Add the first chain for this game.','<button class="btn" onclick="addRounds(1)">Add a round</button>')}</div>
  <div class="sect"><div class="row"><button class="btn pri" onclick="saveGame()">Save game</button><button class="btn" onclick="go('lib')">Cancel</button></div>
  <div class="err" style="margin-top:var(--s2)">${esc(err)}</div></div></div>`}

// Validate and save the game to the database. Words are upper-cased and stripped to letters A-Z.
// Rounds with fewer than 2 words are ignored. The sample is omitted from the saved file when it is off.
async function saveGame(){const clean=a=>a.map(w=>w.toUpperCase().replace(/[^A-Z]/g,'')).filter(Boolean);
  const rs=ST.rounds.map(r=>({words:clean(r.words),hint:r.hint.trim()})).filter(r=>r.words.length>=2);
  const sample=ST.sample?clean(ST.sample):[];
  if(!(+ST.interval>=1)){err='Enter the auto-reveal interval in seconds (1 or more).';errKind='err';return render()}
  if(!ST.title.trim()||!rs.length){err='Add a title and at least one round with 2+ words.';errKind='err';return render()}
  if(ST.sample&&sample.length<2){err='The sample round needs at least 2 words (or remove it).';errKind='err';return render()}
  const g={id:ST.id||'g'+Date.now(),title:ST.title.trim(),desc:ST.desc.trim(),series:(ST.series||'').trim(),sub:(ST.sub||'').trim(),date:(ST.date||'').trim(),welcome:(ST.welcome||'').trim(),interval:Math.max(1,Math.round(+ST.interval)),instr:ST.instr,rounds:rs,sample:sample.length?sample:undefined};
  try{await authed('app_save_game',{p_game:g});toast('Game saved.');await pull();go('lib')}catch(x){err=emsg(x);errKind='err';render()}}

// WORD GRAPH for the simulated AI generator: each word lists words that can follow it in a common phrase.
const GR={PRAYER:'MEETING WARRIOR CHAIN BOOK',MEETING:'HOUSE ROOM POINT',HOUSE:'CHURCH KEEPER PARTY BOAT WORK',CHURCH:'BELL CHOIR SERVICE BENCH',BELL:'TOWER RINGER PEPPER',TOWER:'CLOCK BRIDGE',CLOCK:'WORK TOWER',WORK:'SHOP BOOK FORCE OUT SHEET',BOOK:'MARK STORE CASE WORM',MARK:'DOWN UP',SHOP:'KEEPER LIFT',SERVICE:'BELL CHARGE STATION',STATION:'WAGON MASTER',CHOIR:'BOY ROBE',GOOD:'NEWS SAMARITAN FRIDAY WILL SHEPHERD',NEWS:'PAPER LETTER FLASH',PAPER:'WEIGHT WORK TRAIL CLIP',WEIGHT:'LIFT LOSS',LIFT:'OFF GATE',OFF:'BEAT LINE SEASON',BEAT:'DOWN BOX',DOWN:'LOAD FALL TOWN PAYMENT',LOAD:'STAR BEARER',FALL:'BACK OUT',BACK:'BONE TRACK PACK YARD STAGE',PACK:'HORSE AGE',HEART:'BEAT BREAK LAND',BREAK:'FAST THROUGH DOWN WATER',FAST:'FOOD TRACK LANE',FOOD:'CHAIN COURT BANK',CHAIN:'REACTION SAW LINK MAIL',SAW:'MILL DUST HORSE',LIGHT:'HOUSE WEIGHT YEAR BULB',YEAR:'BOOK END',CROSS:'WALK OVER ROAD WORD FIRE',WALK:'THROUGH WAY OUT',THROUGH:'PUT WAY',OVER:'TIME COAT FLOW NIGHT',TIME:'LINE SHEET TABLE OUT',LINE:'BREAK UP BACKER DANCE',PEACE:'MAKER OFFERING TIME',MAKER:'SPACE UP',HOLY:'SPIRIT GHOST LAND WEEK',SPIRIT:'LEVEL LIFT',LEVEL:'HEAD UP',HEAD:'LIGHT STONE START LINE',STONE:'WALL AGE',WALL:'PAPER FLOWER',FLOWER:'BED POT',BED:'ROCK TIME ROOM SIDE',ROCK:'STAR SOLID',STAR:'LIGHT FISH BOARD'};
// Random walk through the word graph to build a chain where each word pairs with the next.
function walk(len){const ks=Object.keys(GR);for(let t=0;t<300;t++){let w=[ks[Math.random()*ks.length|0]];while(w.length<len){const o=(GR[w[w.length-1]]||'').split(' ').filter(x=>x&&!w.includes(x));if(!o[0])break;w.push(o[Math.random()*o.length|0])}if(w.length===len)return w}return null}
// Simulated AI generator: fills the studio with random chains (no real AI is called).
function aiGen(){const p=ST.prompt.toLowerCase();const hint=/fruit|spirit/.test(p)?'Fruit of the Spirit - Galatians 5:22-23':/testament|books/.test(p)?'Know your books of the Bible':'Chain Reaction Challenge';
  ST.rounds=Array.from({length:ST.n},()=>({words:walk(4+(Math.random()*2|0))||['LIGHT','HOUSE','CHURCH','BELL'],hint}));if(!ST.title)ST.title=ST.prompt.slice(0,50)||'AI Chain Reaction';render()}
/* =====================================================================
   ADMIN PANEL
   Account management (approve, disable, reset, delete, view password) and branding.
   ===================================================================== */
// Delete / Confirm-delete buttons for one account row.
function delBtn(u){return delId===u.id?`<button class="btn btn-sm dng" onclick="uact('${jarg(u.id)}','delete');delId=null">Confirm delete</button> <button class="link" onclick="delId=null;render()">Cancel</button>`:`<button class="link dng" onclick="delId='${jarg(u.id)}';render()">Delete</button>`}
// Tell the admin when the chosen accent had to be lightened or darkened to stay readable.
function accentNote(){const a=themeVars(S.theme==='dark')['--accent'];return a.toUpperCase()!==String(S.brand.accent).toUpperCase()?'Adjusted for readability':''}
// Repaint the branding preview after a colour change.
function updPreview(){const p=document.getElementById('bpv');if(!p)return;const v=stageVars(stageTheme()==='dark');for(const k in v)p.style.setProperty(k,v[k]);
  const n=document.getElementById('bnote');if(n)n.textContent=accentNote()}
// Admin screen: account management table and the branding customizer.
function adminV(){const b=S.brand;
  const rows=[...S.users.filter(u=>u.pending),...S.users.filter(u=>!u.pending)].map(u=>`<tr class="${u.pending?'pending':''}">
  <td>${esc(u.name)}</td><td>${esc(u.username||'-')}</td><td>${u.role}</td>
  <td>${u.pending?'Pending approval':u.active?'Active':'Disabled'}</td>
  <td>${u.role!=='Admin'?`<code>${showPw[u.id]?esc(showPw[u.id]):'......'}</code> <button class="link" onclick="${showPw[u.id]?`showPw['${jarg(u.id)}']=null;render()`:`viewPw('${jarg(u.id)}')`}">${showPw[u.id]?'Hide':'View'}</button>`:'-'}</td>
  <td class="actions">${u.role==='Admin'?`<button class="btn btn-sm" onclick="chgPw('${jarg(u.id)}')">Change password</button>`
  :u.pending?`<button class="btn pri" onclick="uact('${jarg(u.id)}','approve')">Approve</button> <button class="link dng" onclick="uact('${jarg(u.id)}','delete')">Reject</button>`
  :`<button class="btn btn-sm" onclick="uact('${jarg(u.id)}','toggle')">${u.active?'Disable':'Enable'}</button> <button class="btn btn-sm" onclick="uact('${jarg(u.id)}','set_password','welcome123')">Reset</button> ${delBtn(u)}`}</td></tr>`).join('');
  const sv=stageVars(stageTheme()==='dark');
  return `<div class="admin"><h1>Admin panel</h1>
  <div class="sect"><h2>Account management</h2>
  <div class="tablewrap"><table class="tbl"><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Password</th><th>Actions</th></tr></thead>
  <tbody>${rows||'<tr><td colspan="6">Loading accounts...</td></tr>'}</tbody></table></div>
  ${S.users.some(u=>u.pending)?'':`<p class="admin-empty"><svg class="ic ic-sm"><use href="#i-check"></use></svg>No accounts are waiting for approval.</p>`}</div>
  <div class="sect"><h2>Identity</h2>
  <div class="brandgrid">
  <div class="field"><label class="label" for="bn">App name</label><input id="bn" value="${esc(b.name)}" oninput="S.brand.name=this.value;bsave();brand()"></div>
  <div class="field"><label class="label" for="bs">Sub-title</label><input id="bs" value="${esc(b.sub)}" oninput="S.brand.sub=this.value;bsave()"></div>
  <div class="field"><label class="label" for="bl">Logo image URL</label><input id="bl" value="${esc(b.logo)}" placeholder="https://" onchange="S.brand.logo=this.value;bsave();render()"></div></div></div>
  <div class="sect"><h2>Colours</h2>
  <div class="field"><span class="label">Palette</span>
  <div class="palset">${PAL.map((p,i)=>`<button class="pal" onclick="applyPal(${i})" title="${p.n}"><span style="background:${p.base}"></span><span style="background:${p.accent}"></span><em>${p.n}</em></button>`).join('')}</div>
  <p class="note">A palette sets the base and the accent together. Change either one below to fine tune it.</p></div>
  <div class="brandgrid brandgrid-colors">
  <div class="field"><label class="label" for="bb">Base colour</label><div class="colorfield"><input type="color" id="bb" value="${esc(b.base)}" oninput="S.brand.base=this.value;bsave();brand();updPreview();this.nextElementSibling.textContent=this.value.toUpperCase()"><code>${esc(String(b.base).toUpperCase())}</code></div>
  <p class="note">The deep tone behind the app and the stage.</p></div>
  <div class="field"><label class="label" for="ba">Accent colour</label><div class="colorfield"><input type="color" id="ba" value="${esc(b.accent)}" oninput="S.brand.accent=this.value;bsave();brand();updPreview();this.nextElementSibling.textContent=this.value.toUpperCase()"><code>${esc(String(b.accent).toUpperCase())}</code></div>
  <p class="note" id="bnote">${accentNote()}</p></div></div>
  <div class="preview" id="bpv" style="${Object.entries(sv).map(([k,v])=>k+':'+v).join(';')}"><span class="note">Stage preview</span>
  <div class="preview-tiles"><div class="ptile">A</div><div class="ptile rev">B</div><div class="ptile given">C</div><div class="ptile q">?</div></div>
  <div class="row" style="margin-top:var(--s2)"><span class="mark" style="width:28px;height:28px">${markArt()}</span><span class="note">The church mark uses the accent colour. <code>assets/mark.svg</code> is the standalone copy.</span></div></div>
  <div class="row" style="margin-top:var(--s3)"><button class="btn" onclick="S.brand={...BRAND0};bsave();render()">Reset branding</button></div>
  </div></div>`}
/* =====================================================================
   GAME STAGE (presentation mode)
   G holds the live game: rounds, active word, revealed letters, timer, teams and scores.
   ===================================================================== */
// Random whole number between a and b (inclusive).
const rnd=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
// Open the game stage for a game. Starts at the instructions slide with team setup.
function play(id){const g=S.games.find(x=>x.id===id);if(!g)return;if(g5Type(g)==='gimme5')return playG5(id);const rs=(g.sample?[{words:g.sample,hint:'Practice Round',sample:true}]:[]).concat(g.rounds);
  G={g,rs,ri:0,step:'instr',wi:1,rev:0,q:false,full:false,hint:true,sound:true,paused:false,cd:g.interval,flip:false,cols:5,welcome:false,teams:[{name:'Team 1',score:0},{name:'Team 2',score:0}]};view='stage';render();clearInterval(timer);timer=setInterval(tick,1000)}
// Does this game carry a welcome message?
const hasWelcome=g=>!!(g&&(g.series||g.sub||g.date||g.welcome));
// The welcome message as a block for the instructions slide.
function welcomeBlock(g){if(!hasWelcome(g))return'';
  return `<div class="welcome-block">
  ${g.series?`<p class="w-series">${esc(g.series)}</p>`:''}
  ${g.sub?`<p class="w-sub">${esc(g.sub)}</p>`:''}
  ${g.date?`<p class="w-date">${esc(g.date)}</p>`:''}
  ${g.welcome?`<p class="w-phrase">${esc(g.welcome)}</p>`:''}</div>`}
// The welcome curtain, shown on the stage before the first letter is revealed.
function welcomePanel(g,present){if(!hasWelcome(g))return'';
  return `<div class="stage-welcome">
  ${g.series?`<p class="w-series">${esc(g.series)}</p>`:''}
  <h2 class="w-title">${esc(g.title)}</h2>
  ${g.sub?`<p class="w-sub">${esc(g.sub)}</p>`:''}
  ${g.date?`<p class="w-date">${esc(g.date)}</p>`:''}
  ${g.welcome?`<p class="w-phrase">${esc(g.welcome)}</p>`:''}
  ${present?'':'<button class="btn pri" onclick="dismissWelcome()">Begin</button>'}</div>`}
// Take the welcome curtain down and let the game start.
function dismissWelcome(){if(!G||!G.welcome)return;G.welcome=false;
  if(G.step==='round'&&G.wi===1&&G.rev===0)startWord(true);   // the 1.5 s wait starts again
  renderStage()}
// Set the number of teams (0 = no scoring) while keeping names already typed.
function setTeams(n){const t=G.teams;G.teams=Array.from({length:n},(_,i)=>t[i]||{name:'Team '+(i+1),score:0});renderStage()}
// Add (or subtract) points for team i.
function sc(i,d){if(G&&G.teams[i]){G.teams[i].score+=d;renderStage()}}
// Leave the stage and go back to the library.
function leave(){clearInterval(timer);G=null;go('lib');pushPresent()}
// Prepare the active word. first=true (start of a round) waits 1.5 s before the first letter; otherwise the first letter shows at once.
function startWord(first){const L=G.rs[G.ri].words[G.wi].length;clearTimeout(G.ht);G.hold=false;G.q=false;G.full=false;G.flip=null;G.cd=G.g.interval;
  if(first){G.rev=0;if(L>1){G.hold=true;const t=G.ri;G.ht=setTimeout(()=>{if(!G||view!=='stage'||G.ri!==t||G.step!=='round'||G.wi!==1||!G.hold||G.welcome)return;G.hold=false;if(!G.full&&G.rev===0){G.rev=1;G.flip=0;G.cd=G.g.interval;beep(660,.12)}renderStage()},1500)}}
  else{G.rev=L>1?1:0;if(G.rev){G.flip=0;beep(660,.12)}}}
// Start round i: pick a random box count (longest word + 1 to 4 extra) and begin the first word to guess.
function setR(i){G.ri=i;G.step='round';const r=G.rs[i];G.cols=Math.max(...r.words.map(w=>w.length))+rnd(1,4);G.wi=1;
  // the first round (or the sample) waits behind the welcome curtain
  G.welcome=(i===0||(i===1&&G.g.sample))&&hasWelcome(G.g);
  startWord(true);render()}
// Runs every second: counts down, reveals the next letter, and finally the '?' one interval after the last letter.
function tick(){if(!G||G.step!=='round'||G.paused||G.hold||G.welcome)return;const r=G.rs[G.ri];if(G.wi>=r.words.length)return;const L=r.words[G.wi].length;
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
function finish(){if(G&&G.step==='round'){endGame(true);toast('Game finished.')}}
// Save (or update) this match's winner in the game's winners history.
function saveResult(){const t=G.teams[G.win];if(!t||!REMOTE)return;const r={id:G.rid,winner:t.name,score:t.score,scores:G.teams.map(x=>({name:x.name,score:x.score})),by:me()?me().name:''};
  const g=S.games.find(x=>x.id===G.g.id);if(g)g.results=(g.results||[]).filter(x=>x.id!==r.id).concat(r).slice(-30);
  rpc('app_save_result',{p_game_id:G.g.id,p_result:r}).catch(x=>toast('Could not save result: '+emsg(x)))}
// Operator override: choose a different winner (e.g. after a technical issue).
function setWin(i){G.win=i;saveResult();renderStage()}
// Undo an early finish: remove the saved result and continue the game.
function resume(){const g=S.games.find(x=>x.id===G.g.id);if(g)g.results=(g.results||[]).filter(r=>r.id!==G.rid);if(REMOTE)rpc('app_remove_result',{p_game_id:G.g.id,p_result_id:String(G.rid)}).catch(()=>{});G.step='round';G.early=false;renderStage()}
// Tile size in pixels so every word fits the space that is left (phones to projectors).
function fit(box,avail){const r=G.rs[G.ri],n=r.words.length;
  const h=avail||(box?box.clientHeight-32:innerHeight-320),w=box?box.clientWidth-32:innerWidth-32;
  const byH=h/(n*1.2+(n-1)*.16),byW=w/(G.cols*1.1);
  // on the projector screen the tiles may grow much larger
  const cap=PRESENT_ID?Math.min(innerWidth*.16,innerHeight*.24,260):92;
  return Math.max(18,Math.min(cap,byH,byW))}
// Size the tiles to the space the header, the hint line and the host strip leave over.
function fitTiles(){const st=$('#stage'),ch=st&&st.querySelector('.chain');if(!ch)return;
  const hd=st.querySelector('.stage-top'),ht=st.querySelector('.stage-hint'),ft=st.querySelector('.stage-foot');
  const avail=innerHeight-(hd?hd.offsetHeight:0)-(ht?ht.offsetHeight:0)-(ft?ft.offsetHeight:0)-32;
  ch.style.setProperty('--t',fit(ch,avail).toFixed(1)+'px')}
// Build the stage markup. present=true leaves the operator controls out, for the audience screen.
function stageBody(present){const g=G.g,r=G.rs[G.ri];let body='';
  const hd=c=>`<header class="stage-top"><div class="stage-title">${esc(g.title)}</div><div class="stage-meta">${c}</div></header>`;
  const sb=G.teams.length?`<div class="scorebar">${G.teams.map((t,i)=>`<div class="team"><span class="tname">${esc(t.name)}</span>
    ${present?'':`<button class="sbtn" onclick="sc(${i},-1)" aria-label="Take one point from ${esc(t.name)}"><svg class="ic"><use href="#i-minus"></use></svg></button>`}
    <span class="tscore">${t.score}</span>
    ${present?'':`<button class="sbtn" onclick="sc(${i},1)" aria-label="Give one point to ${esc(t.name)}"><svg class="ic"><use href="#i-plus"></use></svg></button>`}</div>`).join('')}</div>`:'';
  if(G.step==='instr')body=hd('')+`<div class="slide"><div class="slide-in">${welcomeBlock(g)}<h1>How to play</h1>
    <p class="lede">${esc(g.instr)}</p>
    ${present?'':`<div class="formrow"><div class="field"><label class="label" for="ts">Scoring: number of teams</label>
    <select id="ts" onchange="setTeams(+this.value)"><option value="0" ${G.teams.length?'':'selected'}>No scoring</option>${[2,3,4,5,6,8].map(n=>`<option value="${n}" ${G.teams.length===n?'selected':''}>${n}</option>`).join('')}</select></div></div>
    ${G.teams.length?`<div class="formrow">${G.teams.map((t,i)=>`<div class="field"><label class="label" for="tn${i}">Team ${i+1} name</label><input id="tn${i}" value="${esc(t.name)}" oninput="G.teams[${i}].name=this.value"></div>`).join('')}</div>`:''}
    <div class="actions"><button class="btn pri" onclick="next()">${g.sample?'Start the sample round':'Start round 1'}</button>
    ${g.sample?'<button class="btn" onclick="skipSample()">Skip the sample</button>':''}</div>`}</div></div>`;
  else if(G.step==='end'){const rk=G.teams.map((t,i)=>({...t,i})).sort((a,b)=>b.score-a.score);const w=G.teams[G.win];
    body=hd('')+`<div class="slide"><div class="slide-in"><h1>Grace abounds</h1>
    <p class="lede">That is a wrap on ${esc(g.title)}. Thank you for playing together.</p>
    ${w?`<div class="finish-art">${chainArt(w.name)}</div>
    <div class="winnerline"><svg class="ic"><use href="#i-trophy"></use></svg>${esc(w.name)} - ${w.score} pts</div>
    <div class="tally">${rk.map(t=>`<span>${esc(t.name)}: <b>${t.score}</b></span>`).join('')}</div>
    ${present?'':`<div class="field" style="max-width:320px"><label class="label" for="cw">Change winner (if needed)</label>
    ${G.tie?'<p class="note">It is a tie on points. Pick the winner below.</p>':''}
    <select id="cw" onchange="setWin(+this.value)">${G.teams.map((t,i)=>`<option value="${i}" ${i===G.win?'selected':''}>${esc(t.name)}</option>`).join('')}</select></div>
    <p class="note">Result saved to this game file.</p>`}`:''}
    ${present?'':`<div class="actions">${G.early?'<button class="btn" onclick="resume()">Resume game</button>':''}
    <button class="btn pri" onclick="leave()">Back to the library</button></div>`}</div></div>`}
  else{const n=r.words.length,done=G.wi>=n,lbl=r.sample?'Sample round':`Round ${G.ri-(g.sample?1:0)+1} of ${g.rounds.length}`;
    const rows=r.words.map((w,i)=>{const full=i===0||i<G.wi||(i===G.wi&&G.full);return `<div class="word">${Array.from({length:G.cols},(_,j)=>{let k='tile',t='';if(j<w.length){const c=w[j];if(full){k+=i===0?' given':' rev';t=c}else if(i===G.wi){if(j<G.rev){k+=' rev'+(G.flip===j?' flip':'');t=c}else if(j===w.length-1&&G.q){k+=' q'+(G.flip==='q'?' flip':'');t='?'}}}return `<div class="${k}">${esc(t)}</div>`}).join('')}</div>`}).join('');G.flip=null;
    const cd=done||G.full||G.q?'--':G.paused?'Paused':(G.hold?'Wait':'0:'+String(G.cd).padStart(2,'0'));
    const hint=G.hint&&r.hint?(r.hint.startsWith('"')?'('+r.hint.replace(/"/g,'')+')':r.hint):'';
    body=hd(`<span class="stage-round">${lbl}</span><span class="stage-clock num${G.paused?' paused':''}">${cd}</span>`)+
    `<div class="stage-body">${G.welcome?welcomePanel(g,present):`<div class="chain" style="--t:${fit()}px;--cols:${G.cols}">${rows}</div>`}</div>
    <p class="stage-hint">${G.welcome?'':esc(hint)||'&nbsp;'}</p>
    <div class="stage-foot">${sb}
    ${present?'':`<div class="hostpanel">
    <div class="hgroup"><span class="hlabel">Navigation</span><div class="hrow">
      <button class="btn" onclick="prev()">Previous round</button>
      <span class="gotoround">Go to round<select onchange="setR(+this.value)">${G.rs.map((x,k)=>`<option value="${k}" ${k===G.ri?'selected':''}>${x.sample?'Sample':'Round '+(k-(g.sample?1:0)+1)}</option>`).join('')}</select></span>
      <button class="btn pri" onclick="next()">${done?'Next round':'Next word'}</button>
      <button class="btn" onclick="skip()">Skip round</button></div></div>
    <div class="hgroup"><span class="hlabel">Tools</span><div class="hrow">
      <button class="btn" onclick="reveal()">Reveal word</button>
      <button class="btn" onclick="G.paused=!G.paused;renderStage()">${G.paused?'Resume':'Pause'}</button>
      <button class="btn" onclick="G.hint=!G.hint;renderStage()">Hint</button>
      <button class="btn" onclick="G.sound=!G.sound;renderStage()">Sound</button>
      <div class="seg seg-sm"><button class="${stageTheme()==='light'?'on':''}" onclick="setStageTheme('light')">Light</button><button class="${stageTheme()==='dark'?'on':''}" onclick="setStageTheme('dark')">Dark</button></div>
      <button class="btn" onclick="presentLive()">Present</button></div></div>
    <div class="hgroup"><span class="hlabel">Finish</span><div class="hrow">
      <button class="btn" onclick="finish()">Finish game</button>
      <button class="btn" onclick="leave()">Exit</button></div></div></div>
    <p class="stage-keys">Space reveals the word. Right arrow moves to the next word. Left arrow goes back a round. H shows the hint. P pauses the game.${G.teams.length?' Keys 1 to '+G.teams.length+' add a point, Shift takes one off.':''}</p>`}</div>`}
  return body}
// Draw the whole stage: top line, the chain, the hint line, the scoreboard and the host strip.
function renderStage(){const body=stageBody(false);
  $('#app').innerHTML=`<div id="stage">${body}</div>`;stageBrand($('#stage'));fitTiles();pushPresent()}
/* =====================================================================
   THE SECOND SCREEN (present view)
   index.html?present=1 opens the audience view of the game in its own
   window, for an extended monitor or a projector. It has no navigation
   and no host controls; the host window stays the control panel.
   ===================================================================== */
// Open the audience view in a second window (an extended monitor or a projector).
function openPresent(id){
  if(!PRESENT_WIN||PRESENT_WIN.closed){
    const w=window.open(location.pathname+'?present=1','wcr_present','width=1280,height=720,menubar=no,toolbar=no');
    if(!w){toast('The browser blocked the second window. Allow pop-ups for this site.');return false}
    PRESENT_WIN=w;
    setTimeout(()=>{try{const d=PRESENT_WIN&&PRESENT_WIN.document;if(d&&d.documentElement.requestFullscreen)d.documentElement.requestFullscreen()}catch(e){}},800);
  }else PRESENT_WIN.focus();
  PRESENT_GAME=id;
  setTimeout(pushPresent,700);
  return true}
// Open the audience view for a game and start it here, so this window becomes the control panel.
function present(id){if(!openPresent(id))return;play(id)}
// Open the audience view for the game that is already running.
function presentLive(){if(G)openPresent(G.g.id)}
// Push what the audience should see to the second window.
function pushPresent(){
  if(!PRESENT_WIN||PRESENT_WIN.closed)return;
  const g=S.games.find(x=>x.id===PRESENT_GAME);
  const h=G?stageBody(true):(g?presentIntro(g):'');
  try{PRESENT_WIN.postMessage({t:'present',h:h,brand:S.brand,theme:S.stageTheme},'*')}catch(e){}}
// The audience view of a game that has not started yet.
function presentIntro(g){return `<div class="slide"><div class="slide-in"><h1>How to play</h1><p class="lede">${esc(g.instr)}</p></div></div>`}
// Start the second screen: no navigation, no host controls, just what the host pushes.
function presentBoot(){
  document.body.classList.add('present');
  addEventListener('message',e=>{const d=e.data;if(!d||d.t!=='present')return;
    if(d.brand)S.brand=migrateBrand(d.brand);
    if(d.theme!==undefined)S.stageTheme=d.theme;
    renderPresent(d.h)});
  if(window.opener)window.opener.postMessage({t:'present-ready'},'*')}
// Draw the audience view in the second window.
function renderPresent(h){$('#app').innerHTML=`<div id="stage">${h}</div><button class="link present-exit" onclick="closePresent()">Exit</button>`;stageBrand($('#stage'));fitTiles();
  document.body.style.background=getComputedStyle($('#stage')).backgroundColor;
  document.title=(S.brand.name||'Word Chain Reaction')+' - Present'}
// Close the second screen. The host keeps the control panel.
function closePresent(){if(window.opener)window.opener.postMessage({t:'present-closed'},'*');try{window.close()}catch(e){}}
// The second window is ready: send it the current state. It also tells us when it closes.
addEventListener('message',e=>{const d=e.data;if(!d)return;
  if(d.t==='present-ready')pushPresent();
  if(d.t==='present-closed')PRESENT_WIN=null});
// ENTER KEY: inside a [data-enter] container, Enter submits (function name) or moves to the next field.
addEventListener('keydown',e=>{if(e.key!=='Enter'||!/INPUT|SELECT/.test(e.target.tagName))return;const h=e.target.closest('[data-enter]');if(!h)return;const n=h.dataset.enter;e.preventDefault();
  if(n==='next'){const all=[...h.querySelectorAll('input:not([type=range]):not([type=color]),textarea')],i=all.indexOf(e.target);if(all[i+1])all[i+1].focus();else e.target.blur()}else if(n==='blur')e.target.blur();else if(typeof window[n]==='function')window[n]()});
// HOST SHORTCUTS on the stage: Space reveal, Right next, Left previous round, H hint, P pause, 1-8 team points (Shift = -1).
addEventListener('keydown',e=>{if(view!=='stage'||!G||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
  if(G.welcome){if(e.key==='Enter'){e.preventDefault();dismissWelcome()}return}
  if(e.code==='Space'){e.preventDefault();G.step==='instr'?next():reveal()}else if(e.key==='ArrowRight')next();else if(e.key==='ArrowLeft')prev();else if(e.key==='h'||e.key==='H'){G.hint=!G.hint;renderStage()}else if(e.key==='p'||e.key==='P'){G.paused=!G.paused;renderStage()}else if(/^Digit[1-8]$/.test(e.code)&&G.step!=='instr')sc(+e.code.slice(5)-1,e.shiftKey?-1:1)});
// Re-fit the tiles when the window size changes.
addEventListener('resize',()=>{if(view==='stage'&&G&&G.step==='round')renderStage();else if(PRESENT_ID)fitTiles()});
// Start the app.
boot();

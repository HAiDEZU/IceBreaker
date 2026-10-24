/* =====================================================================
   art.js - the SVG generators for the church mark, the hero pattern, the
   empty states and the finish art.

   Every drawing is built from one tile geometry: a tile is a square of size u,
   the pitch is 1.2u (so the gap is 0.2u) and the corners are square. The four
   states are the same four the game uses:

     empty  - 2px outline in the ink colour
     rev    - solid accent fill
     given  - solid gold fill
     q      - gold outline, the hidden last letter

   The colours are passed in, so the same code can draw for the page (CSS
   variables, so it follows the theme and the Admin's Base and Accent) and for
   the favicon or the share image (fixed hex).

   This file must not touch the DOM: it is also run by node to write the
   asset files. It is loaded before app.js.
   ===================================================================== */

// The colour set a drawing is drawn with. CSS variables by default.
const ART={ink:'var(--ink)',rule:'var(--rule)',accent:'var(--accent)',gold:'var(--gold)',goldText:'var(--gold-text)'};

// One tile. state is 'empty' | 'rev' | 'given' | 'q'. The optional letter is
// drawn centred in the tile.
function artTile(x,y,u,state,c,ch){
  c=c||ART;
  let s;
  if(state==='rev')s='fill:'+c.accent+';stroke:'+c.accent;
  else if(state==='given')s='fill:'+c.gold+';stroke:'+c.gold;
  else if(state==='q')s='fill:none;stroke:'+c.goldText;
  else s='fill:none;stroke:'+c.ink;
  let o='<rect x="'+x+'" y="'+y+'" width="'+u+'" height="'+u+'" style="'+s+';stroke-width:2"/>';
  if(ch)o+='<text x="'+(x+u/2)+'" y="'+(y+u*0.78)+'" text-anchor="middle" style="font-family:\'IBM Plex Sans\',system-ui,sans-serif;font-size:'+(u*0.62)+'px;font-weight:700;fill:'+(state==='given'?c.ink:state==='q'?c.goldText:c.onAccent||'#fff')+';stroke:none">'+ch+'</text>';
  return o}

// A row of tiles. cells is an array of {state, ch}.
function artRow(x,y,u,cells,c){
  let o='',gap=u*0.2;
  cells.forEach((k,i)=>{o+=artTile(x+i*(u+gap),y,u,k.state,c,k.ch)});
  return o}

// The church mark: a cross built from tiles on a 5x5 grid. The bottom tile is
// the gold ? of the hidden last letter. o.gap is the gap between tiles, o.u the
// tile size, o.v the viewBox size.
function markSVG(c,o){
  c=c||ART;o=o||{};
  const u=o.u||20,p=u*1.2,pad=o.pad===undefined?2:o.pad;
  const cross=[[2,0],[1,1],[2,1],[3,1],[2,2],[2,3]];
  let s='';
  cross.forEach(k=>{s+=artTile(pad+k[0]*p,pad+k[1]*p,u,'rev',c)});
  s+=artTile(pad+2*p,pad+4*p,u,'q',c,'?');
  // the viewBox is tight around the cross, so the mark sits centred
  const vx=pad+p-2,vy=0,vw=2*p+u+4,vh=4*p+u+4;
  const a=o.aria===false?'':' role="img" aria-label="Bicutan Bible Church"';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+vx+' '+vy+' '+vw+' '+vh+'"'+a+'>'+s+'</svg>'}

// The hero pattern: real game words, one row each, showing the four tile
// states. words is an array of strings or {w, s} (s is the row state).
// A row is 'given' (all gold), 'rev' (the letters revealed), 'q' (the last
// letter is the ?) or 'empty' (nothing revealed yet).
function tileHero(o){
  o=o||{};const c=o.c||ART;
  const u=o.u||20,p=u*1.2,gap=u*0.2,words=o.words||[],cols=o.cols||0;
  const rows=o.rows||words.length;
  const w=cols?cols*p-gap:0;
  let s='',maxc=0;
  for(let r=0;r<rows;r++){
    const it=words[r]||'',word=typeof it==='string'?it:(it.w||'');
    const st=typeof it==='string'?(o.states&&o.states[r]||'empty'):(it.s||'empty');
    const n=word.length,cells=[];
    for(let i=0;i<(cols||n);i++){
      let state='empty',ch='';
      if(i<n){
        if(st==='given'){state='given';ch=word[i]}
        else if(st==='rev'){state='rev';ch=word[i]}
        else if(st==='q'){state=i===n-1?'q':'rev';ch=i===n-1?'?':word[i]}
      }
      cells.push({state:state,ch:ch});
    }
    if(cells.length>maxc)maxc=cells.length;
    s+=artRow(0,r*p,u,cells,c);
  }
  const h=rows*p-gap,wid=maxc?maxc*p-gap:w;
  const a=o.aria===false?' aria-hidden="true" focusable="false"':'';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+wid+' '+h+'"'+a+' style="width:100%;height:auto;display:block">'+s+'</svg>'}

// The empty-state art. kind is 'games' | 'search' | 'pending' | 'rounds'.
function emptyArt(kind,c){
  c=c||ART;const u=22,p=u*1.2,out=[];
  const line=(y,n,states)=>{const cells=[];for(let i=0;i<n;i++)cells.push(states[i]||{state:'empty'});out.push(artRow(0,y,u,cells,c))};
  if(kind==='games'){                       // a row of empty tiles, one gold ?
    const st=[];for(let i=0;i<5;i++)st.push(i===2?{state:'q',ch:'?'}:{state:'empty'});
    out.push(artRow(0,0,u,st,c));
  }else if(kind==='search'){                // three tiles, the middle one a ?
    const st=[{state:'empty'},{state:'q',ch:'?'},{state:'empty'}];
    out.push(artRow(0,0,u,st,c));
  }else if(kind==='pending'){               // one accent tile with a check
    out.push('<rect x="0" y="0" width="'+u+'" height="'+u+'" style="fill:'+c.accent+';stroke:'+c.accent+';stroke-width:2"/>');
    out.push('<path d="M'+(u*0.26)+' '+(u*0.52)+'l'+(u*0.16)+' '+(u*0.18)+'l'+(u*0.34)+' -'+(u*0.38)+'" style="fill:none;stroke:'+(c.onAccent||'#fff')+';stroke-width:'+(u*0.12)+';stroke-linecap:square;stroke-linejoin:miter"/>');
  }else{                                   // rounds: a stack of empty rows
    line(0,5,[]);line(p,5,[]);line(p*2,3,[]);
  }
  const w=(kind==='games'?5:kind==='search'?3:kind==='pending'?1:5)*p-(p-u);
  const h=(kind==='rounds'?3:1)*p-(p-u);
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+w+' '+h+'" aria-hidden="true" focusable="false" style="width:100%;height:auto;display:block">'+out.join('')+'</svg>'}

// The finish art: a completed chain (every tile revealed) with the winner's
// row below it in gold.
function chainArt(word,c){
  c=c||ART;const u=24,p=u*1.2,w=word||'';
  const cells=[];for(let i=0;i<w.length;i++)cells.push({state:'rev',ch:w[i]});
  const win=[];for(let i=0;i<w.length;i++)win.push({state:'given'});
  const mid=Math.floor(w.length/2);
  win[mid]={state:'given',ch:''};
  let s=artRow(0,0,u,cells,c);
  const h=p*2-(p-u);
  // the winning row, with a check in the middle tile
  s+='<rect x="'+(mid*(u+0.2*u))+'" y="'+p+'" width="'+u+'" height="'+u+'" style="fill:'+c.gold+';stroke:'+c.gold+';stroke-width:2"/>';
  s+='<path d="M'+(mid*(u+0.2*u)+u*0.26)+' '+(p+u*0.52)+'l'+(u*0.16)+' '+(u*0.18)+'l'+(u*0.34)+' -'+(u*0.38)+'" style="fill:none;stroke:'+(c.onAccent||'#fff')+';stroke-width:'+(u*0.12)+';stroke-linecap:square;stroke-linejoin:miter"/>';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+(w.length*p-(p-u))+' '+h+'" aria-hidden="true" focusable="false" style="width:100%;height:auto;display:block">'+s+'</svg>'}

// The Gimme 5 preview: the question, five answer bars (two revealed) and the
// five category names. Static, code-drawn, no animation.
function g5Preview(){
  const F='font-family:\'IBM Plex Sans\',system-ui,sans-serif';
  const W=440,BH=28,gap=6;
  const ans=['BAKA','KALABAW','','',''];
  const cats=['Tao','Bagay','Hayop','Lugar','Pagkain'];
  let s='',y=0;
  s+='<text x="0" y="14" style="'+F+';font-size:15px;font-weight:600;fill:var(--ink)">Ano-anong hayop ang makikita sa farm?</text>';
  y=28;
  ans.forEach((a,i)=>{
    s+='<rect x="0" y="'+y+'" width="'+W+'" height="'+BH+'" style="fill:none;stroke:var(--rule);stroke-width:2"/>';
    s+='<rect x="0" y="'+y+'" width="'+BH+'" height="'+BH+'" style="fill:'+(a?'var(--accent)':'none')+';stroke:var(--rule);stroke-width:2"/>';
    s+='<text x="'+(BH/2)+'" y="'+(y+19)+'" text-anchor="middle" style="'+F+';font-size:13px;font-weight:700;fill:'+(a?'var(--on-accent)':'var(--muted)')+'">'+(i+1)+'</text>';
    if(a)s+='<text x="'+(BH+12)+'" y="'+(y+19)+'" style="'+F+';font-size:14px;font-weight:700;fill:var(--ink)">'+a+'</text>';
    y+=BH+gap;
  });
  y+=10;
  cats.forEach((c,i)=>{
    const x=(i%3)*150,yy=y+Math.floor(i/3)*24;
    s+='<text x="'+x+'" y="'+yy+'" style="'+F+';font-size:13px;font-weight:600;fill:var(--muted)">'+c+'</text>';
  });
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+(y+30)+'" aria-hidden="true" focusable="false" style="width:100%;height:auto;display:block">'+s+'</svg>'}

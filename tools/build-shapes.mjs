// Torn-paper outlines traced from the mockups.
// Writes css/shapes.css (SVG masks as custom properties) and patches the inline SVG paths in index.html.
// usage: node tools/build-shapes.mjs
import fs from 'node:fs';
const root = process.argv[2] ?? new URL('..', import.meta.url).pathname;

function rng(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const f=n=>(+n.toFixed(2)).toString();
// subdivide a closed polygon and jitter the new points sideways: a ragged, torn edge
function torn(pts,{seed=1,step=2.2,amp=.45,nick=.12,nickAmp=1.1}={}){
  const r=rng(seed),out=[];
  for(let i=0;i<pts.length;i++){const [x1,y1]=pts[i],[x2,y2]=pts[(i+1)%pts.length];
    const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy),n=Math.max(1,Math.round(len/step)),nx=-dy/len,ny=dx/len;
    out.push([x1,y1]);
    for(let k=1;k<n;k++){const t=(k+(r()-.5)*.5)/n;let a=(r()-.5)*2*amp;if(r()<nick)a+=(r()-.5)*2*nickAmp;out.push([x1+dx*t+nx*a,y1+dy*t+ny*a]);}}
  return 'M'+out.map(p=>f(p[0])+' '+f(p[1])).join('L')+'Z';
}
// a strip of paper: wavy long edges, ragged short ends
function strip(w,h,seed){
  const r=rng(seed),p=[],nx=7,wave=h*.1,jag=w*.014;
  for(let i=0;i<=nx;i++) p.push([w*i/nx+(i&&i<nx?(r()-.5)*w*.03:0), r()*wave]);
  p.push([w-r()*jag, h*.33+(r()-.5)*h*.1],[w-jag*.4-r()*jag*1.6, h*.66+(r()-.5)*h*.1]);
  for(let i=nx;i>=0;i--) p.push([w*i/nx+(i&&i<nx?(r()-.5)*w*.03:0), h-r()*wave]);
  p.push([r()*jag*1.6, h*.66+(r()-.5)*h*.1],[jag*.4+r()*jag, h*.33+(r()-.5)*h*.1]);
  return torn(p,{seed:seed*13+1,step:1.3,amp:.22,nick:.12,nickAmp:.75});
}
// hand-drawn ring: a little more than one turn of a drifting ellipse
function ring(cx,cy,rx,ry,deg,a0,a1,grow=.09){
  const rot=deg*Math.PI/180,N=96;let d='';
  for(let i=0;i<=N;i++){const t=i/N,a=(a0+(a1-a0)*t)*Math.PI/180,k=1-grow/2+grow*t+Math.sin(t*11)*.008;
    const ex=Math.cos(a)*rx*k,ey=Math.sin(a)*ry*(k+.015*Math.sin(t*6));
    d+=(i?'L':'M')+f(cx+ex*Math.cos(rot)-ey*Math.sin(rot))+' '+f(cy+ex*Math.sin(rot)+ey*Math.cos(rot));}
  return d;
}
const uri = svg => 'data:image/svg+xml,' + svg.replace(/\s+/g,' ').replace(/%/g,'%25').replace(/#/g,'%23').replace(/</g,'%3C').replace(/>/g,'%3E').replace(/"/g,"'");
const mask = (w,h,d) => `url("${uri(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}' preserveAspectRatio='none'><path d='${d}'/></svg>`)}")`;

// ---- nav: HOME tag (mobile mockup, 12x crop -> 100 x 40)
const tagPx=[[140,85],[200,78],[285,72],[292,55],[420,56],[560,62],[640,66],[760,56],[900,48],[975,45],[990,68],[1050,70],[1112,64],
 [1108,120],[1100,170],[1085,200],[1062,232],[1070,262],[1076,292],[1052,302],[1056,340],[1050,385],
 [1010,398],[960,420],[880,412],[760,418],[640,414],[520,424],[420,436],[300,442],[240,455],[160,470],[55,482],
 [62,440],[72,400],[88,345],[84,318],[110,290],[140,230],[152,200],[130,182],[132,140],[138,110]];
const tagD = torn(tagPx.map(([x,y])=>[(x-55)/1057*100,(y-45)/437*40]),{seed:7,step:1.7,amp:.22,nick:.1,nickAmp:.55});

// ---- nav: mobile menu panel (sheet-1 "MOBILE MENU (OPEN)", 4x crop -> 100 x 100)
const panelPx=[[55,92],[130,85],[300,95],[470,88],[560,96],[628,78],[636,98],[662,112],
 [655,300],[640,330],[642,500],[655,640],[650,760],[668,840],
 [560,850],[470,880],[300,862],[150,870],[80,862],[30,872],
 [40,820],[28,800],[50,640],[38,400],[60,280],[48,150]];
const panelD = torn(panelPx.map(([x,y])=>[(x-28)/640*100,(y-75)/810*100]),{seed:4,step:1.6,amp:.28,nick:.12,nickAmp:.7});

// ---- nav: 0401 stamp paper (desktop mockup, 14x crop -> viewBox 0 0 70 35)
const stampD = torn([[13.36,6.93],[15.14,5.5],[24.43,4.57],[25.5,5],[31.57,2.43],[33.14,2.29],[33.71,3.86],[43.71,2.43],[48,1.57],[53,.86],[54.07,2.86],[58.71,3.14],[68.71,1.93],
 [67.64,5.86],[66.57,9.79],[64.43,12.64],[64.07,16.57],[61.93,21.57],[60.86,24.79],[59.57,26.21],[58.71,30.86],
 [52.29,31.57],[48,32.43],[40.86,32.14],[32.29,33.14],[21.57,33],[12.29,33.71],[6.57,33.14],[1.57,33.71],
 [3.36,29.43],[5.86,26.21],[8,21.57],[9.79,18],[9.43,16.93],[11.57,13.36],[13.36,9.43]],{seed:21,step:1.5,amp:.2,nick:.1,nickAmp:.45});

// ---- hero: title paper (desktop mockup; viewBox 0 0 290 90 = 1 unit per reference px)
const titleD = torn([[4,22],[60,19.5],[62,17],[140,13.5],[200,10],[201.5,12],[283.5,6.5],
 [285,20],[281,34],[283,45],[279,56.5],
 [220,61],[218,63],[150,69],[90,75],[88,77.5],[40,81],[10,83.5],
 [7,66],[9.5,52],[5.5,38]],{seed:9,step:2,amp:.4,nick:.1,nickAmp:.9});

// ---- hero: big 0401 stamp paper (viewBox 0 0 92 82)
const stampLgD = torn([[8.3,19.3],[30,16],[31,14.2],[60,10.5],[83.3,7.7],
 [85.5,25],[83.5,42],[85,62.7],
 [62,66.5],[60.5,68.5],[35,72.5],[10,76],
 [7.5,58],[10,40]],{seed:5,step:1.6,amp:.3,nick:.1,nickAmp:.6});

// ---- about: two overlapping sheets of paper (desktop mockup, section coords; viewBox 0 0 404 212, y offset 20)
const sheet = pts => pts.map(([x,y])=>[x,y-20]);
const aboutBackD = torn(sheet([[40,130],[46,127],[75,134],[300,128],[368,134],[398,138],[400,150],[393,164],[386,176],[382,186],[360,200],[354,206],
 [357,221],[338,222],[300,227],[250,229],[200,223],[150,221],[100,223],[60,226],[15,226],[4,216],[12,200],[22,178],[30,160]]),{seed:31,step:2.2,amp:.45,nick:.1,nickAmp:1});
const aboutFrontD = torn(sheet([[70,78],[76,70],[110,60],[205,44],[222,36],[300,26],[306,30],[308,42],[320,40],[332,47],[333,64],[324,66],[336,74],[340,82],
 [352,84],[356,100],[362,118],[368,134],[372,150],[366,175],[352,200],[340,221],[300,227],[250,229],[200,223],[150,221],[100,223],[74,222],[72,134]]),{seed:32,step:2.2,amp:.45,nick:.1,nickAmp:1});

// the same two sheets as drawn in the mobile mockup (viewBox 0 0 420 206, y offset 18)
const sheetM = pts => pts.map(([x,y])=>[x,y-18]);
const aboutBackMD = torn(sheetM([[35,100],[40,97],[62,104],[300,112],[390,120],[400,125],[418,127],[411,140],[405,152],[402,166],[400,178],[381,186],[375,192],
 [373,214],[360,217],[320,221],[300,217],[250,215],[200,212],[150,210],[80,208],[40,212],[12,208],[6,190],[8,176],[18,150],[27,122]]),{seed:33,step:2.2,amp:.45,nick:.1,nickAmp:1});
const aboutFrontMD = torn(sheetM([[57,63],[62,56],[100,50],[213,36],[240,30],[337,21],[340,34],[346,46],[353,59],[362,64],[375,90],[384,110],[390,121],[394,140],
 [388,165],[378,190],[372,214],[330,220],[300,217],[250,215],[200,212],[150,210],[100,209],[62,208],[60,125]]),{seed:34,step:2.2,amp:.45,nick:.1,nickAmp:1});

// ---- projects: the big sheet with the list (desktop: viewBox 0 0 586 384, origin 50,8; mobile: 0 0 618 320, origin 26,36)
const at = (ox,oy) => pts => pts.map(([x,y])=>[x-ox,y-oy]);
const projectsFrontD = torn(at(50,8)([[75,63],[140,65],[265,60],[268,53],[332,52],[333,45],[420,43],[545,42],[547,36],[590,38],[592,47],[622,48],[620,75],[624,108],[628,110],
 [626,125],[620,128],[617,200],[612,260],[610,300],[607,330],[605,360],[560,362],[540,368],[450,366],[380,365],[330,370],[300,368],[200,365],[170,368],[140,366],[75,362],
 [74,300],[70,250],[72,205],[62,203],[60,195],[70,193],[70,150],[68,110],[75,100],[76,75]]),{seed:41,step:2.4,amp:.45,nick:.1,nickAmp:1});
const projectsBackD = torn(at(50,8)([[424,28],[470,19],[540,15],[578,12],[583,36],[627,46],[631,108],[626,128],[622,200],[616,300],[612,366],[560,370],[450,372],[170,372],
 [165,385],[150,386],[148,372],[80,371],[58,372],[56,335],[66,330],[62,200],[66,120],[72,70],[300,56],[420,46]]),{seed:42,step:2.4,amp:.45,nick:.1,nickAmp:1});
const projectsFrontMD = torn(at(26,36)([[38,63],[120,60],[200,55],[207,50],[300,48],[420,45],[540,43],[600,40],[633,45],[630,100],[635,160],[632,220],[636,300],[630,340],
 [600,345],[560,342],[450,341],[300,343],[240,348],[180,345],[140,340],[40,342],[36,330],[38,300],[35,260],[40,200],[38,165],[32,163],[31,150],[38,148],[36,100],[40,80]]),{seed:43,step:2.4,amp:.45,nick:.1,nickAmp:1});
const projectsBackMD = torn(at(26,36)([[34,66],[110,58],[300,44],[505,38],[545,36],[548,42],[640,44],[638,120],[640,300],[634,346],[560,348],[420,346],[410,352],[360,351],
 [355,346],[60,347],[34,346],[30,300],[33,200],[28,165],[32,100]]),{seed:44,step:2.4,amp:.45,nick:.1,nickAmp:1});

// ---- lab: checklist note (desktop mockup; viewBox 0 0 140 134, origin 495,14)
const labNoteD = torn(at(495,14)([[503,16],[520,17],[545,19],[560,20],[580,21.5],[600,23],[620,25],[633,26],[632,40],[630,52],[629,62],[628,75],[626,90],[625,100],
 [624,120],[622,135],[622,146],[600,146.5],[580,146],[560,145.5],[540,144],[521,143],[520,139.5],[506,138.5],[500,138],[499,120],[498,100],
 [497,75],[497,60],[498,48],[500,36],[502,25]]),{seed:51,step:2,amp:.3,nick:.1,nickAmp:.7});

// ---- notes: the sheet with the list (desktop: viewBox 0 0 356 146, origin 288,1; mobile: 0 0 392 153, origin 250,14)
const notesD = torn(at(288,1)([[296,9],[300,7.5],[330,6],[400,5],[480,4],[560,3],[625,1.5],[634,1],[636,4],[643,5],
 [641.5,30],[642.5,37],[639.5,40],[640.5,60],[642,85],[640,92],[641,120],[643,125],[640.5,137],[637,139],
 [600,141],[560,139.5],[520,143],[500,146],[480,143],[470,145],[420,142],[380,144],[330,145],[310,144],[305,141],[295,141],[290,138.5],
 [288.5,120],[291,112],[289,100],[290,60],[292,40],[289,36],[291,30]]),{seed:61,step:2.2,amp:.4,nick:.1,nickAmp:.9});
const notesMD = torn(at(250,14)([[259,23],[300,22],[305,20],[400,20],[500,19],[540,17],[600,14.5],[602,18],[620,19],[630,21],[636,30],
 [637,60],[641,62],[640,100],[637,122],[640,125],[636,150],[630,160],[622,161],
 [600,163],[560,166],[500,165],[460,166],[430,163],[400,166],[350,165],[300,166],[270,165],[260,162],[254,160],
 [252,150],[254,120],[250.5,100],[252,60],[250.5,55],[253,40],[258,35]]),{seed:62,step:2.2,amp:.4,nick:.1,nickAmp:.9});

// ---- loader: frame of the progress bar, a rounded rectangle drawn by a slightly unsteady hand (viewBox 0 0 181 21.4)
function wobblyRect(w,h,r,pad,seed){
  const rn=rng(seed),p=[],j=()=>(rn()-.5)*.5;
  const side=(x1,y1,x2,y2)=>{const n=Math.max(2,Math.round(Math.hypot(x2-x1,y2-y1)/9));for(let i=0;i<=n;i++)p.push([x1+(x2-x1)*i/n+j()*.4,y1+(y2-y1)*i/n+j()]);};
  const corner=(cx,cy,a0)=>{for(let i=1;i<4;i++){const a=(a0+i*22.5)*Math.PI/180;p.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r]);}};
  const x0=pad,y0=pad,x1=w-pad,y1=h-pad;
  side(x0+r,y0,x1-r,y0); corner(x1-r,y0+r,-90); side(x1,y0+r,x1,y1-r); corner(x1-r,y1-r,0);
  side(x1-r,y1,x0+r,y1); corner(x0+r,y1-r,90); side(x0,y1-r,x0,y0+r); corner(x0+r,y0+r,180);
  return 'M'+p.map(q=>f(q[0])+' '+f(q[1])).join('L')+'Z';
}
const loaderFrameD = wobblyRect(181,21.4,2.6,1.4,71);

// ---- changelog page (css/changelog.css): units are px of its 1536-wide mockup
// a scrap of paper w x h: gently wavy sides, ragged outline
function scrap(w,h,seed,{wave=2.5,step=3,amp=.7,every=38}={}){
  const r=rng(seed),p=[],nx=Math.max(2,Math.round(w/every)),ny=Math.max(1,Math.round(h/every));
  for(let i=0;i<=nx;i++) p.push([w*i/nx, r()*wave]);
  for(let i=1;i<ny;i++) p.push([w-r()*wave, h*i/ny]);
  for(let i=nx;i>=0;i--) p.push([w*i/nx, h-r()*wave]);
  for(let i=ny-1;i>=1;i--) p.push([r()*wave, h*i/ny]);
  return torn(p,{seed:seed*7+3,step,amp,nick:.12,nickAmp:amp*3});
}
const clNav = [[143,58],[161,58],[172,60],[150,54]].map(([w,h],i)=>mask(w,h,scrap(w,h,91+i,{wave:5,every:26,step:2.6,amp:1})));
const clHeadingD = scrap(606,88,96,{wave:6.5,every:42,step:3,amp:1.2});
const clList1D = scrap(244,200,97,{wave:4.5,every:30,step:2.8,amp:1});
const clList2D = scrap(244,152,98,{wave:4.5,every:30,step:2.8,amp:1});
// version tag: a ticket with pointed ends
const clTagD = torn([[9,3],[52,1],[96,2.5],[105,19],[97,36],[52,37.5],[8,35.5],[0,19]],{seed:81,step:2.4,amp:.5,nick:.1,nickAmp:1.2});
// "0401" stamp of the changelog heading (viewBox 0 0 170 124)
const clStampD = torn([[6,37],[58,25],[110,12],[163,1],[166,40],[168,84],[120,97],[62,110],[12,122],[9,80]],{seed:83,step:2.6,amp:.55,nick:.1,nickAmp:1.2});

const css = `/* GENERATED by tools/build-shapes.mjs — torn-paper outlines, used as CSS masks over the raster textures. */
:root {
  --shape-tag: ${mask(100,40,tagD)};
  --shape-panel: ${mask(100,100,panelD)};
  --shape-title: ${mask(290,90,titleD)};
  --shape-about-back: ${mask(404,212,aboutBackD)};
  --shape-about-front: ${mask(404,212,aboutFrontD)};
  --shape-about-back-m: ${mask(420,206,aboutBackMD)};
  --shape-about-front-m: ${mask(420,206,aboutFrontMD)};
  --shape-projects-back: ${mask(586,384,projectsBackD)};
  --shape-projects-front: ${mask(586,384,projectsFrontD)};
  --shape-projects-back-m: ${mask(618,320,projectsBackMD)};
  --shape-projects-front-m: ${mask(618,320,projectsFrontMD)};
  --shape-lab-note: ${mask(140,134,labNoteD)};
  --shape-notes: ${mask(356,146,notesD)};
  --shape-notes-m: ${mask(392,153,notesMD)};
${clNav.map((m,i)=>`  --shape-cl-nav-${i+1}: ${m};`).join('\n')}
  --shape-cl-heading: ${mask(606,88,clHeadingD)};
  --shape-cl-list-1: ${mask(244,200,clList1D)};
  --shape-cl-list-2: ${mask(244,152,clList2D)};
  --shape-cl-tag: ${mask(105,38,clTagD)};
${[1,2,3,4,5,6].map(i=>`  --shape-strip-${i}: ${mask(100,20,strip(100,20,i*7+3))};`).join('\n')}
}
`;
fs.writeFileSync(root+'/css/shapes.css',css);

const patch=(file,pairs)=>{const p=root+'/'+file;let s=fs.readFileSync(p,'utf8');for(const [id,val] of pairs){const re=new RegExp(`(<path id="${id}"[^>]*? d=")[^"]*(")`);if(!re.test(s))throw new Error(`${file}: no <path id="${id}">`);s=s.replace(re,(m,a,b)=>a+val+b);}fs.writeFileSync(p,s);};
patch('index.html',[
  ['stamp-shape',stampD], ['stamp-ring',ring(35.6,16.9,26,12.2,-13,150,690)],
  ['stamp-lg-shape',stampLgD], ['stamp-lg-ring',ring(45,36,44,25,-12,160,700,.1)],
  ['hero-loop',ring(74,63,70,27,-36.3,-40,395,.06)],
  ['loader-frame',loaderFrameD],
]);
patch('changelog.html',[
  ['cl-logo-loop',ring(74,63,70,27,-36.3,-40,395,.06)],
  ['cl-stamp-shape',clStampD], ['cl-stamp-ring',ring(86,61,78,45,-12,160,700,.09)],
]);
console.log('shapes ok:', css.length, 'bytes of css');

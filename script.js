// Wordle Solver — Español  v9.2-es  (04-jul-2025)
/*
   Novedad 9.2-es
   ──────────────
   • toggleCompareBtn() considera ambos pools:
       – Habilita la pestaña «Comparar (≤100)» si
           · (0 < candidatasFull ≤ 100) OR
           · (0 < candidatasRAE  ≤ 100)
   • Resto: idéntico al código 9.1 que me proporcionaste.
*/

﻿// Wordle Solver — Español  v9.1-es  (03-jul-2025)
/*
   ÚNICA NOVEDAD con respecto a 9.0-es
   ───────────────────────────────────
   • Antes de guardar un nuevo intento se comprueba que no contradiga
     la información ya almacenada.  Si hay incoherencia:
         – se muestra alert() explicativa
         – el intento NO se añade al historial
   • Tipos de incoherencia detectados
       1. Posición verde ya confirmada con una letra X; el usuario pone
          ahora otra letra Y en verde en esa misma posición.
       2. Letra previamente marcada solo como gris (por tanto ausente)
          aparece ahora como verde o amarilla.
   • Todo el resto del código (min/max de repeticiones, ‘*’ en grises,
     Compare con columna “max”, etc.) se mantiene sin cambios.
*/

const COLORES  = ["gris","Amarillo","VERDE"];
const ALFABETO = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");
const EXACTO_HASTA = 2000;

/* ---------- Diccionarios ---------- */
const dicListFull = (typeof diccionario     !== "undefined") ? diccionario.map(w=>w.toUpperCase()) : [];
const dicListRAE  = (typeof diccionarioRAE  !== "undefined") ? diccionarioRAE.map(w=>w.toUpperCase()) : [];
const dicList     = dicListFull;

/* ---------- Estado ---------- */
let history = [];
let candidatasFull = [], candidatasRAE = [];
let version = 0;
let entCacheFull = new Map(), entCacheRAE = new Map();

/* ----- Compare ----- */
let compareSelectMode = false;
let comparePoolNow = "RAE";

/* ---------- Helpers DOM ---------- */
const $  = id => document.getElementById(id);
const on = (id,fn)=>$(id).addEventListener("click",fn);
const tbody = id => $(id).tBodies[0] || $(id).appendChild(document.createElement("tbody"));
const upper = s => s.toUpperCase()
  .normalize("NFD").replace(/N\u0303/g,"Ñ").replace(/[\u0300-\u036f]/g,"").replace(/Ü/g,"U");

/* ---------- IDs de tablas ---------- */
const TABLE_IDS=[
  "tablaResolverFull","tablaDescartarFull","tablaVerdeFull",
  "tablaResolverRAE","tablaDescartarRAE","tablaVerdeRAE",
  "tablaLetrasFull","tablaLetrasRAE"
];

/* ================= INIT UI ================= */
document.addEventListener("DOMContentLoaded", () => {
  buildColorSelects();

  /* botones principales */
  on("btnGuardar",  guardarIntento);
  on("btnReset",    resetear);
  on("btnCalcular", generarListas);

  /* buscar / compare */
  on("btnBuscarUsuario", buscarPalabrasUsuario);
  on("btnRunCompare",    runCompare);

  /* pestañas */
  on("tabSolver",  () => showTab("solver"));
  on("tabLetras",  () => showTab("buscar"));
  on("tabCompare", () => showTab("compare"));
  on("tabStats",   () => showTab("stats"));        // ← NUEVA

  $("comparePool").addEventListener("change", e => comparePoolNow = e.target.value);

  showTab("solver");
  //generarListas();
});

/* ---------- selects & pestañas ---------- */
function buildColorSelects() {
  for (let i = 0; i < 5; i++) {
    const s = $("color" + i);
    s.innerHTML = "";
    COLORES.forEach(c => {
      const o = document.createElement("option");
      o.value = o.textContent = c;
      s.appendChild(o);
    });
    s.value = "gris";
  }
}

function showTab(t) {
  $("panelSolver" ).style.display = t === "solver"  ? "" : "none";
  $("panelBuscar" ).style.display = t === "buscar"  ? "" : "none";
  $("panelCompare").style.display = t === "compare" ? "" : "none";
  $("panelStats"  ).style.display = t === "stats"   ? "" : "none";   // ← NUEVO
}

const readColors = () => Array.from({ length: 5 }, (_, i) => $("color" + i).value);

/* ================= HISTORIAL ================= */
function guardarIntento(){
  const word = upper($("guess").value.trim());
  if(!/^[A-ZÑ]{5}$/.test(word)){ alert("Introduce 5 letras"); return; }
  if(!dicListFull.includes(word) && !dicListRAE.includes(word) &&
     !confirm(`"${word}" no está en ningún diccionario.\n¿Continuar?`)) return;

  const colors = readColors();

  /* ---------- comprobación de coherencia ---------- */
  const greenPos = Array(5).fill(null);          // letra verde confirmada
  const absent   = new Set();                    // solo gris hasta ahora

  /* analizar historial existente */
  history.forEach(h=>{
    h.colors.forEach((c,i)=>{
      const ch=h.word[i];
      if(c==="VERDE") greenPos[i]=ch;
    });
    h.word.split("").forEach((ch,idx)=>{
      const c=h.colors[idx];
      if(c!=="gris") absent.delete(ch);          // ya no es ausente
      else if(!absent.has(ch) && greenPos.indexOf(ch)===-1 &&
              !h.colors.includes("Amarillo"))    // solo gris en este intento
        absent.add(ch);
    });
  });

  /* — comprobar conflicto de verdes — */
  for(let i=0;i<5;i++){
    if(colors[i]==="VERDE" && greenPos[i] && greenPos[i]!==word[i]){
      alert(`Conflicto: en la posición ${i+1} ya se confirmó la letra '${greenPos[i]}' en verde.`);
      return;
    }
  }

  /* — comprobar letra ausente que ahora aparece amarilla/verde — */
  for(let i=0;i<5;i++){
    const ch=word[i];
    if(absent.has(ch) && colors[i]!=="gris"){
      alert(`Conflicto: la letra '${ch}' fue marcada gris y ahora aparece como ${colors[i]}.`);
      return;
    }
  }
  /* ---------- fin comprobación ---------- */

  history.push({word,colors});
  $("guess").value=""; buildColorSelects(); renderHist();
}

function resetear() {
  /* 1️⃣  notificar final de partida a stats.js */
  if (history.length) {
    const bucket = resolverBucket(history);
    document.dispatchEvent(
      new CustomEvent("ws:gameEnd", { detail: { history: history.slice(), bucket } })
    );
  }

  /* 2️⃣  limpiar estado */
  history = [];
  candidatasFull = candidatasRAE = [];
  entCacheFull.clear(); entCacheRAE.clear(); version++;

  TABLE_IDS.forEach(id => tbody(id).innerHTML = "");
  $("candCountFull").textContent = $("candCountRAE").textContent = "0";
  $("compareArea").innerHTML = "";
  compareSelectMode = false;
  $("btnRunCompare").textContent = "Comparar";

  toggleCompareBtn();
  renderHist();
}

function resolverBucket(hist) {
  const idxWin = hist.findIndex(h => h.colors.every(c => c === "VERDE"));
  if (idxWin === -1) return 7;            // sin victoria
  const intentos = idxWin + 1;
  return (intentos >= 1 && intentos <= 6) ? intentos : 7;
}

function renderHist() {
  $("historial").textContent = history
    .map(h => `${h.word} → ${h.colors.join(", ")}`)
    .join("\n");
}
/* ================= FILTRO (idéntico a 9.0) ================= */
function construirFiltro(){
  const pat=Array(5).fill("."), G=new Set(), Y=new Set(), X=new Set(), posNo=[];
  const minCount={}, maxCount={}; ALFABETO.forEach(ch=>{minCount[ch]=0;maxCount[ch]=5;});

  history.forEach(h=>{
    const cntGreen={},cntYellow={},cntGray={};
    ALFABETO.forEach(ch=>{cntGreen[ch]=cntYellow[ch]=cntGray[ch]=0;});
    h.colors.forEach((c,i)=>{
      const ch=h.word[i];
      if(c==="VERDE"){ pat[i]=ch; G.add(ch); cntGreen[ch]++; }
      else if(c==="Amarillo"){ Y.add(ch); posNo.push({ch,pos:i}); cntYellow[ch]++; }
      else cntGray[ch]++;
    });
    ALFABETO.forEach(ch=>{
      const col=cntGreen[ch]+cntYellow[ch];
      if(col>0) minCount[ch]=Math.max(minCount[ch],col);
      if(cntGray[ch]>0) maxCount[ch]=Math.min(maxCount[ch],col);
    });
  });

  ALFABETO.forEach(ch=>{
    if(minCount[ch]===0 && maxCount[ch]===5 &&
       history.some(h=>h.word.includes(ch)))
      maxCount[ch]=0;
  });
  ALFABETO.forEach(ch=>{ if(maxCount[ch]===0) X.add(ch); else X.delete(ch); });

  return { regexp:new RegExp("^"+pat.join("")+"$"), G, Y, X, posNo, minCount, maxCount };
}

function filtrar(lista,f){
  return lista.filter(w=>{
    if(!f.regexp.test(w)) return false;
    for(const {ch,pos} of f.posNo) if(w[pos]===ch) return false;
    for(const ch of f.Y) if(!w.includes(ch)) return false;
    const cnt={};ALFABETO.forEach(c=>cnt[c]=0); w.split("").forEach(ch=>cnt[ch]++);
    for(const ch of ALFABETO) if(cnt[ch]<f.minCount[ch]||cnt[ch]>f.maxCount[ch]) return false;
    return true;
  });
}

/* ================= ENTROPÍA, GENERAR LISTAS, BUSCAR, COMPARE ================= */
/* --- resto del código permanece EXACTAMENTE igual que tu script_good_old.js --- */


/* ================= ENTROPÍA y resto (sin cambios respecto a 9.0) ================= */
/* --- Todo el código restante (entropía, generarListas, buscar, compare…) ---   */
/* --- permanece idéntico a la versión 9.0-es y se omite aquí por brevedad. ---  */


/* ================= ENTROPÍA ================= */
function patronClave(sol,gu){
  const o=Array(5).fill(0), used=Array(5).fill(false);
  for(let i=0;i<5;i++) if(sol[i]===gu[i]){ o[i]=2; used[i]=true; }
  for(let i=0;i<5;i++) if(o[i]===0)
    for(let j=0;j<5;j++) if(!used[j]&&gu[i]===sol[j]){ o[i]=1; used[j]=true; break; }
  return o.join("");
}
function entropiaExacta(word,cands,cache){
  const c=cache.get(word); if(c&&c.v===version) return c.h;
  const n=cands.length, m=new Map();
  cands.forEach(sol=>{
    const k=patronClave(sol,word);
    m.set(k,(m.get(k)||0)+1);
  });
  const h = n - [...m.values()].reduce((a,x)=>a+x*x,0)/n;
  cache.set(word,{v:version,h});
  return h;
}
function buildRapido(lista){
  const f=new Map(), p=Array.from({length:5},()=>new Map());
  lista.forEach(w=>w.split("").forEach((ch,i)=>{
    f.set(ch,(f.get(ch)||0)+1);
    p[i].set(ch,(p[i].get(ch)||0)+1);
  }));
  const raw=w=>{
    let a=0; new Set(w).forEach(ch=>a+=(f.get(ch)||0));
    let b=0; w.split("").forEach((ch,i)=>b+=(p[i].get(ch)||0));
    return .3*a+.7*b;
  };
  let mx=0; lista.forEach(w=>mx=Math.max(mx,raw(w)));
  const k=(lista.length-1)/mx, map=new Map();
  lista.forEach(w=>map.set(w, +(raw(w)*k).toFixed(2)));
  return { map, calc:w=>+(raw(w)*k).toFixed(2) };
}

/* ================= GENERAR LISTAS ================= */
function generarListas(){
  const f = construirFiltro();
  candidatasFull = filtrar(dicListFull,f);
  candidatasRAE  = filtrar(dicListRAE ,f);

  $("candCountFull").textContent = candidatasFull.length;
  $("candCountRAE" ).textContent = candidatasRAE.length;
  toggleCompareBtn();
  $("compareArea").innerHTML=""; compareSelectMode=false;
  $("btnRunCompare").textContent="Comparar";

  if(!candidatasFull.length && !candidatasRAE.length){
    TABLE_IDS.forEach(id=>tbody(id).innerHTML="");
    return;
  }

  version++; entCacheFull.clear(); entCacheRAE.clear();

  const X=f.X, Y=f.Y, G=f.G;
  const infoYG=new Set([...Y,...G]);   // solo amarillas y verdes
  const sinInfo = infoYG.size===0;

  procesar("Full", dicListFull, candidatasFull, entCacheFull);
  procesar("RAE",  dicListRAE,  candidatasRAE,  entCacheRAE);

  function procesar(tag,dic,cands,cache){
    const exact  = cands.length<=EXACTO_HASTA;
    const rapido = exact ? null : buildRapido(cands);
    const hVal   = w => exact ? entropiaExacta(w,cands,cache)
                              : (rapido.map.get(w)||rapido.calc(w));

    /* --- marca de letras grises --- */
    const marcaGrises = w=>{
      let out=""; for(const ch of w) out += X.has(ch)? ch+"*":ch;
      return out;
    };

    /* --- Candidatas (sin grises) --- */
    renderTabla(`tablaResolver${tag}`, cands
      .map(w=>({w,h:hVal(w)})).sort((a,b)=>b.h-a.h).slice(0,200));

    /* --- Descartar (se permiten grises) --- */
    const baseDic = tag==="RAE" ? dicListFull : dic;
    const poolDesc = sinInfo ? baseDic.slice()
                   : baseDic.filter(w=>!contieneLetras(w,infoYG));
    renderTabla(`tablaDescartar${tag}`, poolDesc
      .map(w=>({w:marcaGrises(w), h:hVal(w)}))
      .sort((a,b)=>b.h-a.h).slice(0,20));

    /* --- Repetición verde (permitir grises, vetar solo Y) --- */
    const gPos = posVerdes();
    const listaVerde = gPos.every(x=>!x) ? [] :
      baseDic.filter(w=>esRepVerde(w,gPos) && !contieneLetras(w,Y))
             .map(w=>({w:marcaGrises(w), h:hVal(w)}))
             .sort((a,b)=>b.h-a.h).slice(0,20);
    renderTabla(`tablaVerde${tag}`, listaVerde);

    /* --- Frecuencias --- */
    const freq = ALFABETO.map(ch=>{
      let ap=0,pal=0,rep=0;
      cands.forEach(w=>{
        const c=w.split("").filter(x=>x===ch).length;
        if(c){ap+=c;pal++;if(c>1)rep++;}
      });
      return {ch,ap,pal,rep};
    }).sort((a,b)=>b.pal-a.pal);
    renderTablaFreq(`tablaLetras${tag}`, freq);
  }
}

/* ---------- Helpers comunes ---------- */
const posVerdes = () => {
  const g=Array(5).fill(null);
  history.forEach(h=>h.colors.forEach((c,i)=>{ if(c==="VERDE") g[i]=h.word[i]; }));
  return g;
};
const esRepVerde     = (w,g)=>g.every((ch,i)=>!ch||(w.includes(ch)&&w[i]!==ch));
const contieneLetras = (w,set)=>[...set].some(ch=>w.includes(ch));

/* ---------- Render tablas ---------- */
function renderTabla(id,list){
  const tb=tbody(id); tb.innerHTML="";
  list.forEach(r=>{
    const tr=document.createElement("tr");
    [r.w, r.h.toFixed(2)].forEach(t=>{
      const td=document.createElement("td"); td.textContent=t; tr.appendChild(td);
    });
    tb.appendChild(tr);
  });
}
function renderTablaFreq(id,list){
  const tb=tbody(id); tb.innerHTML="";
  list.forEach(r=>{
    const tr=document.createElement("tr");
    [r.ch,r.ap,r.pal,r.rep].forEach(t=>{
      const td=document.createElement("td"); td.textContent=t; tr.appendChild(td);
    });
    tb.appendChild(tr);
  });
}

/* ================= BUSCAR PALABRAS ================= */
function buscarPalabrasUsuario(){
  const raw=upper($("inputLetras").value).replace(/[^A-ZÑ]/g,"");
  if(!raw){ alert("Introduce letras"); return; }
  const letras=[...new Set(raw.split(""))];
  if(letras.length>10){ alert("Máx 10 letras"); return; }

  let res={};
  for(let k=letras.length;k>=1;k--){
    combinar(letras,k).forEach(c=>{
      const hits=dicList.filter(w=>c.every(ch=>w.includes(ch)));
      if(hits.length) res[c.join("")]=hits;
    });
    if(Object.keys(res).length) break;
  }
  $("resultadoBusqueda").innerHTML = Object.entries(res)
    .sort((a,b)=>b[0].length-a[0].length||a[0].localeCompare(b[0]))
    .map(([c,ws])=>
      `<h4>Usando ${c} (${ws.length})</h4><pre style="white-space:pre-wrap">${ws.join(", ")}</pre>`)
    .join("") || "<p>No se encontró ninguna palabra</p>";
}
const combinar=(arr,k)=>{
  const out=[],rec=(s,a)=>{
    if(a.length===k){ out.push(a.slice()); return; }
    for(let i=s;i<arr.length;i++){ a.push(arr[i]); rec(i+1,a); a.pop(); }
  }; rec(0,[]); return out;
};

/* ================= COMPARE (≤100) ================= */
function toggleCompareBtn(){
  const okFull = candidatasFull.length>0 && candidatasFull.length<=100;
  const okRAE  = candidatasRAE .length>0 && candidatasRAE .length<=100;
  $("tabCompare").disabled = !(okFull || okRAE);
}
const palette=[
  "#ffcc00","#4da6ff","#66cc66","#ff6666","#c58aff","#ffa64d","#4dd2ff",
  "#99ff99","#ff80b3","#b3b3ff","#ffd24d","#3399ff","#77dd77","#ff4d4d",
  "#c299ff","#ffb84d","#00bfff","#99e699","#ff99c2","#9999ff","#ffe066",
  "#0080ff","#66ffb3","#ff4da6","#8080ff"
];

function buildSelectionList(list,selAll){
  let h='<p><strong>Selecciona hasta 25 palabras</strong> y pulsa de nuevo "Comparar seleccionadas":</p>';
  h+='<div style="max-height:300px;overflow:auto;columns:140px auto;">';
  list.forEach(w=>h+=`<label style="display:block;"><input type="checkbox" class="selWord" value="${w}" ${selAll?"checked":""}> ${w}</label>`);
  $("compareArea").innerHTML=h+"</div>";
}

function drawCompareTable(words,pool){
  const n=words.length; if(!n){ $("compareArea").textContent="No words"; return; }
  const isExtra = w=>!pool.includes(w);

  /* patrones, opt y max */
  const pat=words.map(g=>words.map(s=>patronClave(s,g)));
  const stats=pat.map(row=>{
    const grp={}; row.forEach((p,i)=>(grp[p]=grp[p]||[]).push(i));
    const sizes=Object.values(grp).map(a=>a.length);
    return {opt:sizes.length, max:Math.max(...sizes)};
  });

  /* orden filas/columnas */
  const ord=words.map((w,i)=>({w,idx:i,opt:stats[i].opt,max:stats[i].max}))
                 .sort((a,b)=>b.opt-a.opt||a.max-b.max||a.w.localeCompare(b.w));
  const orderIdx=ord.map(o=>o.idx);
  const maxOpt=ord[0].opt, maxMax=ord[0].max;

  /* cabecera */
  let html='<table style="border-collapse:collapse;font-size:12px"><thead><tr><th></th>';
  ord.forEach(o=>{
    const red=isExtra(o.w)?'color:red;':'';
    html+=`<th style="${red}">${o.w}</th>`;
  });
  html+=`<th>opt. (${maxOpt})</th><th>max (${maxMax})</th></tr></thead><tbody>`;

  /* filas */
  ord.forEach(oRow=>{
    const rowStyle=isExtra(oRow.w)?'color:red;':'';
    html+=`<tr><th style="${rowStyle}">${oRow.w}</th>`;

    const groups={};
    orderIdx.forEach((origIdx,visCol)=>{
      const p=pat[oRow.idx][origIdx];
      (groups[p]=groups[p]||[]).push(visCol);
    });
    let c=0; Object.values(groups).forEach(g=>{ if(g.length>1) g.clr=palette[c++%palette.length]; });

    orderIdx.forEach((origIdx,visCol)=>{
      const p=pat[oRow.idx][origIdx], g=groups[p], bg=g.clr||"#f2f2f2";
      const next=g.find(x=>x>visCol); const jump=next?next-visCol:0;
      html+=`<td style="text-align:center;background:${bg};${rowStyle}">${p}-${jump}</td>`;
    });

    html+=`<td style="text-align:center;font-weight:bold;${rowStyle}">${oRow.opt}</td>`;
    html+=`<td style="text-align:center;font-weight:bold;${rowStyle}">${oRow.max}</td></tr>`;
  });

  $("compareArea").innerHTML=html+"</tbody></table>";
}

function runCompare(){
  const pool = comparePoolNow==="RAE" ? candidatasRAE : candidatasFull;
  if(!compareSelectMode){
    if(pool.length>100){ alert("Demasiadas candidatas (máx 100)"); return; }
    buildSelectionList(pool, pool.length<=25);
    compareSelectMode=true; $("btnRunCompare").textContent="Comparar seleccionadas";
    return;
  }
  const sel=[...document.querySelectorAll("#compareArea input.selWord:checked")].map(cb=>cb.value);
  if(!sel.length){ alert("Selecciona al menos una"); return; }
  if(sel.length>25){ alert("Máx 25 palabras"); return; }

  const extra=upper($("extraInput").value)
               .split(/[^A-ZÑ]/).filter(x=>x.length===5).slice(0,2);
  drawCompareTable([...sel,...extra], pool);

  compareSelectMode=false; $("btnRunCompare").textContent="Comparar";
}

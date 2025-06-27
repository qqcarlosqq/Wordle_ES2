﻿// Wordle Solver — Español  v8.1-es  (28-jun-2025)
/*  · Lee las constantes globales `diccionario` y `diccionarioRAE`
      sin asumir que cuelgan de window.
    · Funciona tanto desde file:// como con servidor local.
*/

const COLORES  = ["gris","amarillo","verde"];
const ALFABETO = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");
const EXACTO_HASTA = 2000;

/* ---------- Diccionarios ---------- */
const dicListFull = (typeof diccionario     !== "undefined")
                    ? diccionario.map(w => w.toUpperCase())
                    : [];
const dicListRAE  = (typeof diccionarioRAE  !== "undefined")
                    ? diccionarioRAE.map(w => w.toUpperCase())
                    : [];
const dicList     = dicListFull;        // alias para “Buscar palabras”

/* ---------- Estado ---------- */
let history = [];
let candidatasFull = [], candidatasRAE = [];
let candidatas = [];                    // alias a candidatasFull (para Compare)
let version = 0;
let entCacheFull = new Map(), entCacheRAE = new Map();

/* ---------- Helpers DOM ---------- */
const $  = id => document.getElementById(id);
const on = (id,fn)=>$(id).addEventListener("click",fn);
const tbody = id => {
  const t = $(id);
  return t.tBodies[0] || t.appendChild(document.createElement("tbody"));
};

/* ---------- Normaliza texto (Ñ, tildes) ---------- */
const upper = s => s.toUpperCase()
  .normalize("NFD").replace(/N\u0303/g,"Ñ")
  .replace(/[\u0300-\u036f]/g,"").replace(/Ü/g,"U");

/* ---------- INIT UI ---------- */
document.addEventListener("DOMContentLoaded", () => {
  buildColorSelects();
  on("btnGuardar", guardarIntento);
  on("btnReset",   resetear);
  on("btnCalcular", generarListas);
  on("btnBuscarUsuario", buscarPalabrasUsuario);
  on("btnRunCompare",    runCompare);
  on("tabSolver",  () => showTab("solver"));
  on("tabLetras",  () => showTab("buscar"));
  on("tabCompare", () => showTab("compare"));
  showTab("solver");
  generarListas();                      // pinta todo al abrir
});

/* ---------- Selects de color y pestañas ---------- */
function buildColorSelects(){
  for(let i=0;i<5;i++){
    const s=$("color"+i); s.innerHTML="";
    COLORES.forEach(c=>{
      const o=document.createElement("option");
      o.value=o.textContent=c; s.appendChild(o);
    });
    s.value="gris";
  }
}
function showTab(t){
  $("panelSolver").style.display  = t==="solver" ? "" : "none";
  $("panelBuscar").style.display  = t==="buscar" ? "" : "none";
  $("panelCompare").style.display = t==="compare"? "" : "none";
  ["tabSolver","tabLetras","tabCompare"].forEach(id=>
    $(id).classList.toggle("active",
      id==="tab"+(t==="buscar"?"Letras":t[0].toUpperCase()+t.slice(1))));
}
const readColors = () => Array.from({length:5},(_,i)=>$("color"+i).value);

/* ---------- Historial ---------- */
function guardarIntento(){
  const w = upper($("guess").value.trim());
  if(!/^[A-ZÑ]{5}$/.test(w)){ alert("Introduce 5 letras"); return; }
  if(!dicListFull.includes(w) && !dicListRAE.includes(w) &&
     !confirm(`"${w}" no está en ninguno de los diccionarios.\n¿Continuar?`)) return;

  history.push({word:w, colors:readColors()});
  $("guess").value=""; buildColorSelects(); renderHist();
}
function resetear(){
  history=[]; candidatasFull=candidatasRAE=[];
  candidatas=[]; entCacheFull.clear(); entCacheRAE.clear(); version++;
  ["tablaResolverFull","tablaDescartarFull","tablaVerdeFull",
   "tablaResolverRAE","tablaDescartarRAE","tablaVerdeRAE",
   "tablaLetrasFull","tablaLetrasRAE"].forEach(id=>tbody(id).innerHTML="");
  $("candCountFull").textContent="0";
  $("candCountRAE").textContent="0";
  $("compareArea").innerHTML="";
  compareSelectMode=false; $("btnRunCompare").textContent="Comparar";
  toggleCompareBtn(); renderHist();
}
function renderHist(){
  $("historial").textContent = history
    .map(h=>`${h.word} → ${h.colors.join(", ")}`).join("\n");
}

/* ---------- Construcción de filtros ---------- */
function construirFiltro(){
  const pat=Array(5).fill("."), G=new Set(), Y=new Set(), X=new Set(), posNo=[];
  history.forEach(h=>h.colors.forEach((c,i)=>{
    const ch=h.word[i];
    if(c==="verde"){ pat[i]=ch; G.add(ch); }
    else if(c==="amarillo"){ Y.add(ch); posNo.push({ch,pos:i}); }
    else X.add(ch);
  }));
  return { regexp:new RegExp("^"+pat.join("")+"$"), G, Y, X, posNo };
}
function filtrar(lista,f){
  return lista.filter(w=>{
    if(!f.regexp.test(w)) return false;
    for(const{ch,pos}of f.posNo) if(w[pos]===ch) return false;
    for(const ch of f.Y) if(!w.includes(ch)) return false;
    for(const ch of f.X) if(!f.G.has(ch)&&!f.Y.has(ch)&&w.includes(ch)) return false;
    return true;
  });
}

/* ---------- Entropía ---------- */
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
  let mx=0; lista.forEach(w=>{const v=raw(w); if(v>mx) mx=v;});
  const k=(lista.length-1)/mx, map=new Map();
  lista.forEach(w=>map.set(w, +(raw(w)*k).toFixed(2)));
  return { map, calc:w=>+(raw(w)*k).toFixed(2) };
}

/* ---------- Generar tablas ---------- */
function generarListas(){
  const f = construirFiltro();

  candidatasFull = filtrar(dicListFull, f);
  candidatasRAE  = filtrar(dicListRAE , f);
  candidatas     = candidatasFull;

  $("candCountFull").textContent = candidatasFull.length;
  $("candCountRAE").textContent  = candidatasRAE.length;

  toggleCompareBtn();
  $("compareArea").innerHTML="";
  compareSelectMode=false; $("btnRunCompare").textContent="Comparar";

  if(!candidatasFull.length && !candidatasRAE.length) return;

  version++; entCacheFull.clear(); entCacheRAE.clear();

  const Y=new Set(), G=new Set();
  history.forEach(h=>h.colors.forEach((c,i)=>{
    if(c==="amarillo") Y.add(h.word[i]);
    else if(c==="verde") G.add(h.word[i]);
  }));
  const known=new Set([...Y,...G]);
  const todoGris = known.size===0;

  procesar("Full", dicListFull, candidatasFull, entCacheFull);
  procesar("RAE",  dicListRAE,  candidatasRAE,  entCacheRAE);

  function procesar(tag,dic,cands,cache){
    const exact = cands.length<=EXACTO_HASTA;
    const rapido= exact? null : buildRapido(cands);
    const hVal  = w=> exact ? entropiaExacta(w,cands,cache)
                            : (rapido.map.get(w)||rapido.calc(w));

    renderTabla(`tablaResolver${tag}`, cands
      .map(w=>({w,h:hVal(w)})).sort((a,b)=>b.h-a.h).slice(0,200));

    const poolDesc = todoGris ? cands.slice()
                     : dic.filter(w=>!contieneLetras(w,known));
    renderTabla(`tablaDescartar${tag}`, poolDesc
      .map(w=>({w,h:hVal(w)})).sort((a,b)=>b.h-a.h).slice(0,20));

    const gPos = posVerdes();
    const listaVerde = gPos.every(x=>!x) ? [] :
      dic.filter(w=>esRepVerde(w,gPos) && !contieneLetras(w,Y))
         .map(w=>({w,h:hVal(w)}))
         .sort((a,b)=>b.h-a.h).slice(0,20);
    renderTabla(`tablaVerde${tag}`, listaVerde);

    const freq = ALFABETO.map(ch=>{
      let ap=0,pal=0,rep=0;
      cands.forEach(w=>{
        const c=w.split("").filter(x=>x===ch).length;
        if(c){ap+=c; pal++; if(c>1)rep++; }
      });
      return {ch,ap,pal,rep};
    }).sort((a,b)=>b.pal-a.pal);
    renderTablaFreq(`tablaLetras${tag}`, freq);
  }
}

/* ---------- utilidades verdes / letras ---------- */
const posVerdes   = () => { const g=Array(5).fill(null);
  history.forEach(h=>h.colors.forEach((c,i)=>{ if(c==="verde") g[i]=h.word[i]; }));
  return g;
};
const esRepVerde  = (w,g)=>g.every((ch,i)=>!ch||(w.includes(ch)&&w[i]!==ch));
const contieneLetras = (w,set)=>[...set].some(ch=>w.includes(ch));

/* ---------- Render ---------- */
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

/* ---------- Buscar palabras & Compare (sin cambios) ---------- */
/* … (tu código existente de estos dos módulos va aquí) … */


/* ========== BUSCAR PALABRAS (módulo auxiliar) ========== */
function buscarPalabrasUsuario() {
  const raw = upper($("inputLetras").value).replace(/[^A-ZÑ]/g, "");
  if (!raw) { alert("Introduce letras"); return; }
  const letras = [...new Set(raw.split(""))];
  if (letras.length > 10) { alert("Máx 10 letras"); return; }

  let res = {};
  for (let k = letras.length; k >= 1; k--) {
    combinar(letras, k).forEach(c => {
      const hits = dicList.filter(w => c.every(ch => w.includes(ch)));
      if (hits.length) res[c.join("")] = hits;
    });
    if (Object.keys(res).length) break;   // encontramos algo con k letras
  }
  $("resultadoBusqueda").innerHTML = Object.entries(res)
    .sort((a, b) => b[0].length - a[0].length || a[0].localeCompare(b[0]))
    .map(([c, ws]) =>
      `<h4>Usando ${c} (${ws.length})</h4><pre style="white-space:pre-wrap">${ws.join(", ")}</pre>`)
    .join("") || "<p>No se encontró ninguna palabra</p>";
}
const combinar = (arr, k) => {
  const out = [], rec = (s, a) => {
    if (a.length === k) { out.push(a.slice()); return; }
    for (let i = s; i < arr.length; i++) { a.push(arr[i]); rec(i + 1, a); a.pop(); }
  };
  rec(0, []); return out;
};

/* ========== COMPARE (matriz ≤100) ========== */
function toggleCompareBtn() {
  $("tabCompare").disabled = candidatas.length === 0 || candidatas.length > 100;
}
const palette = [
  "#ffcc00", "#4da6ff", "#66cc66", "#ff6666", "#c58aff",
  "#ffa64d", "#4dd2ff", "#99ff99", "#ff80b3", "#b3b3ff",
  "#ffd24d", "#3399ff", "#77dd77", "#ff4d4d", "#c299ff",
  "#ffb84d", "#00bfff", "#99e699", "#ff99c2", "#9999ff",
  "#ffe066", "#0080ff", "#66ffb3", "#ff4da6", "#8080ff"
];
let compareSelectMode = false;

function buildSelectionList(list, selAll) {
  let h = '<p><strong>Selecciona hasta 25 palabras</strong> y pulsa de nuevo "Comparar seleccionadas":</p>';
  h += '<div style="max-height:300px;overflow:auto;columns:140px auto;">';
  list.forEach(w => h +=
    `<label style="display:block;"><input type="checkbox" class="selWord" value="${w}" ${selAll ? "checked" : ""}> ${w}</label>`);
  $("compareArea").innerHTML = h + "</div>";
}

function drawCompareTable(words) {
  const n = words.length; if (!n) { $("compareArea").textContent = "No words"; return; }

  const pat = words.map(g => words.map(s => patronClave(s, g)));
  const opts = pat.map(row => { const groups = {}; row.forEach((p, i) => (groups[p] = groups[p] || []).push(i)); return Object.keys(groups).length; });
  const ord = words.map((w, i) => ({ w, idx: i, op: opts[i] }))
                   .sort((a, b) => b.op - a.op || a.w.localeCompare(b.w));
  const orderIdx = ord.map(o => o.idx), maxOpt = ord[0].op;

  let html = '<table style="border-collapse:collapse;font-size:12px"><thead><tr><th></th>';
  ord.forEach(o => {
    const red = candidatas.includes(o.w) ? "" : "color:red;";
    html += `<th style="${red}">${o.w}</th>`;
  });
  html += `<th>opciones (${maxOpt})</th></tr></thead><tbody>`;

  ord.forEach(oRow => {
    const extra = !candidatas.includes(oRow.w);
    const rowStyle = extra ? "color:red;" : "";
    html += `<tr><th style="${rowStyle}">${oRow.w}</th>`;

    const groups = {};
    orderIdx.forEach((origIdx, visCol) => {
      const p = pat[oRow.idx][origIdx];
      (groups[p] = groups[p] || []).push(visCol);
    });
    let c = 0; Object.values(groups).forEach(g => { if (g.length > 1) g.clr = palette[c++ % palette.length]; });

    orderIdx.forEach((origIdx, visCol) => {
      const p = pat[oRow.idx][origIdx], g = groups[p];
      const next = g.find(x => x > visCol); const jump = next ? next - visCol : 0;
      const bg = g.clr || "#f2f2f2";
      html += `<td style="text-align:center;background:${bg};${rowStyle}">${p}-${jump}</td>`;
    });
    html += `<td style="text-align:center;font-weight:bold;${rowStyle}">${oRow.op}</td></tr>`;
  });

  $("compareArea").innerHTML = html + "</tbody></table>";
}

function runCompare() {
  if (!compareSelectMode) {
    if (candidatas.length > 100) { alert("Demasiadas candidatas (máx 100)"); return; }
    buildSelectionList(candidatas, candidatas.length <= 25);
    compareSelectMode = true; $("btnRunCompare").textContent = "Comparar seleccionadas";
    return;
  }
  const sel = [...document.querySelectorAll("#compareArea input.selWord:checked")].map(cb => cb.value);
  if (!sel.length) { alert("Selecciona al menos una"); return; }
  if (sel.length > 25) { alert("Máx 25 palabras"); return; }

  const extra = upper($("extraInput").value)
    .split(/[^A-ZÑ]/).filter(x => x.length === 5).slice(0, 2);
  drawCompareTable([...sel, ...extra]);

  compareSelectMode = false; $("btnRunCompare").textContent = "Comparar";
}

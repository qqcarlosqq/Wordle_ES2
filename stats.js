/* =========================================================
   Estadísticas 2.4  –  (18-jul-2025)
   ---------------------------------------------------------
   • Números y % se formatean con Intl.NumberFormat según
     el locale del PC (detecto navigator.language).
   • Archivo sigue siendo .xls + BOM → Excel abre sin aviso.
   ========================================================= */
(()=>{
  const $ = id=>document.getElementById(id);

  /* ----- Intl helpers según locale ----- */
  const locale = navigator.language || navigator.userLanguage || "es-ES";
  const fmtInt     = new Intl.NumberFormat(locale);
  const fmt2       = new Intl.NumberFormat(locale,{minimumFractionDigits:2,maximumFractionDigits:2});
  const fmt5       = new Intl.NumberFormat(locale,{minimumFractionDigits:5,maximumFractionDigits:5});
  const pct        = (n,t)=> fmt2.format(n*100/t)+"%";

  /* ----- storage ----- */
  const K_ACT="ws_stats_actual_v1", K_OH="ws_stats_offset_hist_v1", K_OT="ws_stats_offset_tool_v1";
  const load=k=>(JSON.parse(localStorage.getItem(k)||"[]")||[]).concat(Array(7)).slice(0,7).map(x=>+x||0);
  const save=(k,a)=>localStorage.setItem(k,JSON.stringify(a));

  let A = load(K_ACT), OH = load(K_OH), OT = load(K_OT);

  /* ---------- render ---------- */
  const tbodyHTML=a=>{
    const tot=a.reduce((s,n)=>s+n,0)||1;
    const rows=a.map((n,i)=>`<tr><td>${i+1}</td><td>${fmtInt.format(n)}</td><td>${pct(n,tot)}</td></tr>`).join("");
    return rows+
      `<tr><th>Sum</th><th>${fmtInt.format(tot)}</th><th></th></tr>`+
      `<tr><th>Promedio</th><th colspan="2">${fmt5.format(a.reduce((s,n,i)=>s+n*(i+1),0)/tot)}</th></tr>`;
  };
  const paint=()=>{
    $("statsActualBody").innerHTML = tbodyHTML(A);
    $("statsHistBody").innerHTML   = tbodyHTML(A.map((v,i)=>v+OH[i]));
    $("statsToolBody").innerHTML   = tbodyHTML(A.map((v,i)=>v+OT[i]));
  };

  /* ---------- evento fin de partida ---------- */
  document.addEventListener("ws:gameEnd",e=>{
    const b=e.detail.bucket;
    (b>=1&&b<=6)?A[b-1]++:A[6]++;
    save(K_ACT,A); paint();
  });

  /* ---------- editar manual ---------- */
  function ask(w){
    const txt=prompt("Introduce 7 números separados por coma:");
    if(!txt)return;
    const arr=txt.split(",").map(s=>parseInt(s,10));
    if(arr.length!==7||arr.some(n=>isNaN(n)||(w!=="TOOL"&&n<0))){
      alert("Entrada inválida");return;
    }
    if(w==="ACT")  A = arr, save(K_ACT ,A);
    if(w==="HIST") OH= arr, save(K_OH  ,OH);
    if(w==="TOOL") OT= arr, save(K_OT  ,OT);
    paint();
  }

  /* ======================================================
     Excel + email
     ====================================================== */
  function downloadExcelAndMail(){
    const tbl=(tit,arr)=>{
      const tot=arr.reduce((s,n)=>s+n,0)||1;
      let h=`<table border="1"><tr><th colspan="3">${tit}</th></tr><tr><th>Intentos</th><th>Nº</th><th>%</th></tr>`;
      arr.forEach((n,i)=>h+=`<tr><td>${i+1}</td><td>${fmtInt.format(n)}</td><td>${pct(n,tot)}</td></tr>`);
      h+=`<tr><th>Sum</th><th>${fmtInt.format(tot)}</th><th></th></tr><tr><th>Promedio</th><th colspan="2">${fmt5.format(arr.reduce((s,n,j)=>s+n*(j+1),0)/tot)}</th></tr></table>`;
      return h;
    };
    const html=`<html><meta charset="utf-8"><body>${tbl("ACTUAL",A)}<br/>${tbl("ACUM HIST",A.map((v,i)=>v+OH[i]))}<br/>${tbl("POST TOOL",A.map((v,i)=>v+OT[i]))}</body></html>`;

    /* nombre archivo */
    const d=new Date(), yyyy=d.getFullYear(), mm=String(d.getMonth()+1).padStart(2,"0"), dd=String(d.getDate()).padStart(2,"0");
    const fname=`${yyyy}_${mm}_${dd}_Wordle_ESP_stats.xls`;

    /* descarga */
    const blob=new Blob(["\uFEFF"+html],{type:"application/vnd.ms-excel"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=fname;document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},1e3);

    /* mail body con tabs (sin formateo para evitar confusión) */
    const line=(lab,arr)=>lab+"\t"+arr.join("\t");
    const mailBody=[line("ACTUAL",A),line("ACUM_HIST",A.map((v,i)=>v+OH[i])),line("POST_TOOL",A.map((v,i)=>v+OT[i]))].join("\n");
    location.href="mailto:qqcarlosqq@gmail.com?subject="+encodeURIComponent("Estadísticas Wordle Solver")+"&body="+encodeURIComponent(mailBody);
  }

  /* ---------- init ---------- */
  window.addEventListener("DOMContentLoaded",()=>{
    $("btnResetActual").onclick=()=>ask("ACT");
    $("btnResetHist").onclick  =()=>ask("HIST");
    $("btnResetTool").onclick  =()=>ask("TOOL");
    $("btnSendStats").onclick  =downloadExcelAndMail;
    paint();
  });
})();

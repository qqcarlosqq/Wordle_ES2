/* =========================================================
   Estadísticas 2.6  –  % como porcentaje real en XLS
   ========================================================= */
(()=>{
  const $ = id => document.getElementById(id);

  /* ---------- locale ---------- */
  const loc = (navigator.languages && navigator.languages[0]) ||
              navigator.language || "es-ES";
  const nfInt=new Intl.NumberFormat(loc);
  const nf2 = new Intl.NumberFormat(loc,{minimumFractionDigits:2,maximumFractionDigits:2});
  const nf5 = new Intl.NumberFormat(loc,{minimumFractionDigits:5,maximumFractionDigits:5});
  const toPctTxt = x => nf2.format(x*100) + "%";

  /* ---------- storage ---------- */
  const K_ACT="ws_stats_actual_v1", K_H="ws_stats_hist_v1", K_T="ws_stats_tool_v1";
  const load=k=>{try{const a=JSON.parse(localStorage.getItem(k)||"[]");return Array.isArray(a)&&a.length===7?a:Array(7).fill(0);}catch{return Array(7).fill(0);} };
  const save=(k,a)=>localStorage.setItem(k,JSON.stringify(a));

  let A=load(K_ACT), H=load(K_H), T=load(K_T);

  /* ---------- paint on page ---------- */
  const tbody=a=>{
    const tot=a.reduce((s,n)=>s+n,0)||1;
    const rows=a.map((n,i)=>`<tr><td>${i+1}</td><td>${nfInt.format(n)}</td><td>${toPctTxt(n/tot)}</td></tr>`).join("");
    return rows+
      `<tr><th>Suma</th><th>${nfInt.format(tot)}</th><th></th></tr>`+
      `<tr><th>Promedio</th><th colspan="2">${nf5.format(a.reduce((s,n,j)=>s+n*(j+1),0)/tot)}</th></tr>`;
  };
  const paint=()=>{
    $("statsActualBody").innerHTML = tbody(A);
    $("statsHistBody").innerHTML   = tbody(A.map((v,i)=>v+H[i]));
    $("statsToolBody").innerHTML   = tbody(A.map((v,i)=>v+T[i]));
  };

  /* ---------- evento fin de partida ---------- */
  document.addEventListener("ws:gameEnd",e=>{
    const b=e.detail.bucket; (b>=1&&b<=6)?A[b-1]++:A[6]++;
    save(K_ACT,A); paint();
  });

  /* ---------- editar manual ---------- */
  function ask(which){
    const txt=prompt("Introduce 7 números separados por coma:");
    if(!txt) return;
    const arr=txt.split(",").map(s=>parseInt(s,10));
    if(arr.length!==7||arr.some(n=>isNaN(n)||(which!=="T"&&n<0))){
      alert("Entrada inválida");return;
    }
    if(which==="A") A=arr, save(K_ACT,A);
    if(which==="H") H=arr, save(K_H ,H);
    if(which==="T") T=arr, save(K_T ,T);
    paint();
  }

  /* ---------- XLS + e-mail ---------- */
  function downloadXLS(){
    const tdGen = (raw,txt)=>`<td x:num="${raw}" style="mso-number-format:General;">${txt}</td>`;
    const tdPct = (raw,txt)=>`<td x:num="${raw}" style="mso-number-format:0.00%;">${txt}</td>`;

    const tbl = (title,arr)=>{
      const tot=arr.reduce((s,n)=>s+n,0)||1;
      let h=`<table border="1"><tr><th colspan="3">${title}</th></tr>`+
            `<tr><th>Intentos</th><th>Nº</th><th>%</th></tr>`;
      arr.forEach((n,i)=>{
        const p = (n/tot).toFixed(6);               // raw proportion
        h+="<tr>"+
           tdGen(i+1,nfInt.format(i+1))+
           tdGen(n   ,nfInt.format(n))+
           tdPct(p   ,toPctTxt(n/tot))+
           "</tr>";
      });
      const avg=(arr.reduce((s,n,j)=>s+n*(j+1),0)/tot).toFixed(5);
      h+=`<tr><th>Suma</th>${tdGen(tot,nfInt.format(tot))}<th></th></tr>`+
         `<tr><th>Promedio</th>${tdGen(avg,nf5.format(avg))}</tr>`+
         "</table>";
      return h;
    };

    const html = "\uFEFF<html xmlns:x=\"urn:schemas-microsoft-com:office:excel\"><meta charset=utf-8><body>"+
                 tbl("ACTUAL",A)+"<br/>"+
                 tbl("ACUM HIST",A.map((v,i)=>v+H[i]))+"<br/>"+
                 tbl("POST TOOL",A.map((v,i)=>v+T[i]))+
                 "</body></html>";

    const d=new Date(), fn=`${d.getFullYear()}_${String(d.getMonth()+1).padStart(2,"0")}_${String(d.getDate()).padStart(2,"0")}_Wordle_ESP_stats.xls`;
    const blob=new Blob([html],{type:"application/vnd.ms-excel"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=fn;document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},1e3);

    const line=(l,arr)=>l+"\t"+arr.join("\t");
    const body=[line("ACTUAL",A),line("ACUM_HIST",A.map((v,i)=>v+H[i])),line("POST_TOOL",A.map((v,i)=>v+T[i]))].join("\n");
    location.href="mailto:qqcarlosqq@gmail.com?subject="+encodeURIComponent("Estadísticas Wordle Solver")+"&body="+encodeURIComponent(body);
  }

  /* ---------- init ---------- */
  window.addEventListener("DOMContentLoaded",()=>{
    $("btnResetActual").onclick=()=>ask("A");
    $("btnResetHist").onclick  =()=>ask("H");
    $("btnResetTool").onclick  =()=>ask("T");
    $("btnSendStats").onclick  =downloadXLS;
    paint();
  });
})();

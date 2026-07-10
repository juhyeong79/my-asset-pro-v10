
const KEY="my_asset_pro_v10";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
const day=()=>new Date().toISOString().slice(0,10);
const n=x=>Number(x)||0;
const fmt=x=>n(x).toLocaleString(undefined,{maximumFractionDigits:2});
const won=x=>`${Math.round(n(x)).toLocaleString()}원`;
const base={
 settings:{name:"주형",goal:"samsung",fx:1390,fxDate:""},
 stocks:[
  {id:"samsung",name:"삼성전자",ticker:"005930",market:"KR",mode:"핵심장기",qty:43,avg:329000,price:314000,target:100},
  {id:"mando",name:"HL만도",ticker:"204320",market:"KR",mode:"손실회복",qty:32,avg:50400,price:49600,target:100},
  {id:"isu",name:"이수스페셜티케미컬",ticker:"457190",market:"KR",mode:"핵심장기",qty:20,avg:52700,price:53800,target:100},
  {id:"mbly",name:"모빌아이",ticker:"MBLY",market:"US",mode:"핵심장기",qty:15,avg:14.2,price:13.75,target:100},
  {id:"ionq",name:"아이온큐",ticker:"IONQ",market:"US",mode:"회전매매",qty:10,avg:21.8,price:22.45,target:100}
 ], reservations:[], history:[]
};
let state=load();
function load(){try{const x=JSON.parse(localStorage.getItem(KEY));return x?{...base,...x,settings:{...base.settings,...x.settings}}:structuredClone(base)}catch{return structuredClone(base)}}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function fx(){return n(state.settings.fx)||1}
function cur(s){return s.market==="US"?"USD":"KRW"}
function money(x,c="KRW"){return c==="USD"?`$${fmt(x)}`:won(x)}
function krw(s,x){return s.market==="US"?n(x)*fx():n(x)}
function rate(s){return s.avg?(s.price-s.avg)/s.avg:0}
function value(s){return krw(s,s.qty*s.price)}
function pnl(s){return krw(s,s.qty*(s.price-s.avg))}
function recQty(s){const q=n(s.qty),r=rate(s);if(!q)return 0;if(r<0){if(q<=10)return 1;if(q<=20)return 2;if(q<=40)return 3;if(q<=80)return 5;return Math.max(1,Math.floor(q*.1))}const p=r>=1?.15:r>=.2?.12:r>=.08?.10:.08;return Math.max(1,Math.min(Math.floor(q*p),Math.max(1,Math.floor(q*.2))))}
function advice(s){const r=rate(s),a=Math.abs(r);if(r<0){if(a<.05)return["관망","손실 폭이 작아 기다림 우선"];if(a<.12)return["시험매도",`최대 ${recQty(s)}주 소량 시험`];if(a<.25)return["주의관망","회전보다 하락 원인 점검"];return["리스크점검","전량 회전 금지, 보유 이유 재점검"]}if(r<.03)return["보유","회전 효과가 작아 보유 우선"];if(r<.08)return["일부회전",`최대 ${recQty(s)}주 회전 검토`];return["회전추천",`수익 일부 실현, 최대 ${recQty(s)}주`]}
function toast(t){const e=$("#toast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),1700)}
function page(id){$$(".page").forEach(x=>x.classList.toggle("active",x.id===id));$$("nav button").forEach(x=>x.classList.toggle("active",x.dataset.page===id));const m={home:"대시보드",stocks:"종목 관리",trade:"거래 입력",reservations:"예약 관리",history:"거래 일지",settings:"설정"};$("#title").textContent=m[id];scrollTo({top:0,behavior:"smooth"});if(id==="trade")refreshTrade()}
function render(){renderHome();renderStocks();renderSelects();renderReservations();renderHistory();renderSettings();save()}
function renderHome(){
 const total=state.stocks.reduce((a,s)=>a+value(s),0),p=state.stocks.reduce((a,s)=>a+pnl(s),0);
 $("#hello").textContent=`안녕하세요, ${state.settings.name}님.`;
 $("#totalValue").textContent=won(total);
 $("#totalPnl").textContent=won(p);
 $("#stockCount").textContent=`${state.stocks.length}개`;
 $("#resCount").textContent=`${state.reservations.filter(x=>x.status==="waiting").length}건`;
 $("#fxTop").textContent=fmt(fx());

 const g=state.stocks.find(s=>s.id===state.settings.goal)||state.stocks[0];
 if(g){
   $("#goalName").textContent=g.name;
   $("#goalText").textContent=`${fmt(g.qty)} / ${fmt(g.target)}주`;
   $("#goalBar").style.width=`${Math.min(100,g.target?g.qty/g.target*100:0)}%`;
 }

 const waiting=state.reservations.filter(r=>r.status==="waiting");
 const nearest=waiting.sort((a,b)=>Math.abs(a.buyPrice-(state.stocks.find(s=>s.id===a.stockId)?.price||a.buyPrice))-Math.abs(b.buyPrice-(state.stocks.find(s=>s.id===b.stockId)?.price||b.buyPrice)))[0];
 if(nearest){
   $("#todayTask").innerHTML=`<div class="todo-card">
     <h4>${nearest.name} 예약매수 확인</h4>
     <p>${nearest.buyQty}주 예약 · ${nearest.reason}</p>
     <div class="todo-line"><span class="todo-price">${fmt(nearest.buyPrice)}</span><button data-page="reservations">확인</button></div>
   </div>`;
 }else{
   $("#todayTask").innerHTML=`<div class="todo-card"><h4>오늘은 대기</h4><p>체결을 기다리는 예약이 없습니다. 성급한 거래보다 원칙 유지가 우선입니다.</p></div>`;
 }

 const picks=[...state.stocks].sort((a,b)=>Math.abs(rate(b))-Math.abs(rate(a))).slice(0,3);
 $("#aiList").innerHTML=picks.map(s=>{
   const [label,reason]=advice(s);
   return `<button class="ai-card" data-trade="${s.id}">
     <div class="ai-main">
       <div class="ai-topline"><h4>${s.name}</h4><span class="badge">${label}</span></div>
       <div class="ai-stats"><span>수익률 ${(rate(s)*100).toFixed(2)}%</span><span>추천 ${recQty(s)}주</span></div>
       <div class="ai-reason">${reason}</div>
     </div>
   </button>`;
 }).join("")||'<div class="empty">종목을 추가하세요.</div>';

 $("#homeStocks").innerHTML=state.stocks.slice(0,5).map(s=>{
   const [label]=advice(s);
   const waitingCount=state.reservations.filter(r=>r.stockId===s.id&&r.status==="waiting").length;
   return `<div class="stock-card">
     <div class="stock-top">
       <div><h3>${s.name}</h3><div class="meta">${s.ticker} · ${s.market==="US"?"미국":"국내"}</div></div>
       <b class="${pnl(s)>=0?"pos":"neg"}">${won(pnl(s))}</b>
     </div>
     <div class="info">
       <div><span>보유</span><b>${fmt(s.qty)}주</b></div>
       <div><span>평균가</span><b>${money(s.avg,cur(s))}</b></div>
       <div><span>현재가</span><b>${money(s.price,cur(s))}</b></div>
       <div><span>수익률</span><b>${(rate(s)*100).toFixed(2)}%</b></div>
       <div><span>AI 추천</span><b>${label}</b></div>
       <div><span>대기 예약</span><b>${waitingCount}건</b></div>
     </div>
   </div>`;
 }).join("");

 $$("[data-trade]").forEach(b=>b.onclick=()=>{page("trade");$("#tradeStock").value=b.dataset.trade;refreshTrade()})
}function renderStocks(){
 $("#stockList").innerHTML=state.stocks.map(s=>{const [l]=advice(s);return `<article class="stock-card"><div class="stock-top"><div><h3>${s.name}</h3><div class="meta">${s.ticker} · ${s.mode}</div></div><b class="${pnl(s)>=0?"pos":"neg"}">${won(pnl(s))}</b></div><div class="info"><div><span>보유</span><b>${fmt(s.qty)}주</b></div><div><span>평균가</span><b>${money(s.avg,cur(s))}</b></div><div><span>현재가</span><b>${money(s.price,cur(s))}</b></div><div><span>수익률</span><b>${(rate(s)*100).toFixed(2)}%</b></div><div><span>추천수량</span><b>${recQty(s)}주</b></div><div><span>AI추천</span><b>${l}</b></div></div><div class="actions"><button class="edit" data-edit="${s.id}">수정</button><button class="use" data-use="${s.id}">거래</button><button class="delete" data-del="${s.id}">삭제</button></div></article>`}).join("")||'<div class="empty">등록된 종목이 없습니다.</div>';
 $$("[data-edit]").forEach(b=>b.onclick=()=>openStock(b.dataset.edit));$$("[data-use]").forEach(b=>b.onclick=()=>{page("trade");$("#tradeStock").value=b.dataset.use;refreshTrade()});$$("[data-del]").forEach(b=>b.onclick=()=>{if(confirm("삭제할까요?")){state.stocks=state.stocks.filter(s=>s.id!==b.dataset.del);render()}})
}
function renderSelects(){const v=$("#tradeStock").value;$("#tradeStock").innerHTML=state.stocks.map(s=>`<option value="${s.id}">${s.name}</option>`).join("");if(state.stocks.some(s=>s.id===v))$("#tradeStock").value=v;$("#goalStock").innerHTML=state.stocks.map(s=>`<option value="${s.id}">${s.name}</option>`).join("")}
function tStock(){return state.stocks.find(s=>s.id===$("#tradeStock").value)||state.stocks[0]}
function rotation(s,sp,sq){return[.01,.03,.05,.07].map((d,i)=>{const bp=sp*(1-d),bq=Math.floor(sp*sq/bp),extra=bq-sq,remain=s.qty-sq,avg=remain+bq>0?(remain*s.avg+bq*bp)/(remain+bq):s.avg,cash=Math.max(0,sp*sq-bp*bq);let grade="D",reason="효과 부족";if(extra>=1){grade="A";reason="수량 증가"}else if(s.avg&&((s.avg-avg)/s.avg)>=.007){grade="B";reason="평균가 개선"}else if(avg<s.avg){grade="C";reason="효과 작음"}return{id:i,d,bp,bq,extra,avg,cash,grade,reason}})}
function refreshTrade(){const s=tStock();if(!s)return;if(!$("#tradePrice").value)$("#tradePrice").value=s.price;const type=$("#tradeType").value,p=n($("#tradePrice").value),q=n($("#tradeQty").value),rq=recQty(s);$("#recQty").textContent=`${rq}주`;$("#qtyJudge").textContent=q?q<=rq?"추천 범위":"추천보다 많음":"-";const aq=type==="buy"?s.qty+q:s.qty-q,aa=type==="buy"&&aq>0?(s.qty*s.avg+p*q)/aq:s.avg,real=type==="sell"?(p-s.avg)*q:0;$("#afterQty").textContent=`${fmt(aq)}주`;$("#afterAvg").textContent=money(aa,cur(s));$("#realized").textContent=won(krw(s,real));$("#rotationBlock").style.display=type==="sell"?"block":"none";if(type==="sell")$("#rotationList").innerHTML=rotation(s,p,q).map(o=>`<label class="option"><input class="rot" type="checkbox" data-o='${JSON.stringify(o)}'><div><b>${money(o.bp,cur(s))} · ${o.bq}주</b><small>${Math.round(o.d*100)}% 하락 · ${o.reason}</small></div><span class="grade">${o.grade}</span></label>`).join("")}
function confirmTrade(){const s=tStock(),type=$("#tradeType").value,p=n($("#tradePrice").value),q=n($("#tradeQty").value);if(!s||!p||!q)return toast("가격과 수량을 확인하세요.");if(type==="sell"&&q>s.qty)return toast("보유수량보다 많이 매도할 수 없습니다.");const beforeQty=s.qty,beforeAvg=s.avg;let real=0;if(type==="buy"){const nq=s.qty+q;s.avg=(s.qty*s.avg+p*q)/nq;s.qty=nq}else{real=(p-s.avg)*q;s.qty-=q}state.history.unshift({id:uid(),date:day(),stockId:s.id,name:s.name,type,price:p,qty:q,beforeQty,afterQty:s.qty,beforeAvg,afterAvg:s.avg,realized:krw(s,real)});if(type==="sell")$$(".rot:checked").forEach(x=>{const o=JSON.parse(x.dataset.o);state.reservations.unshift({id:uid(),rotation:`${s.id}-${Date.now().toString().slice(-6)}`,date:day(),stockId:s.id,name:s.name,sellPrice:p,sellQty:q,buyPrice:o.bp,buyQty:o.bq,grade:o.grade,reason:o.reason,status:"waiting",filled:""})});$("#tradeQty").value="";render();page("home");toast("거래와 예약을 자동 기록했습니다.")}
function renderReservations(){const f=$("#resFilter").value,list=state.reservations.filter(r=>f==="all"||r.status===f);$("#resList").innerHTML=list.map(r=>`<article class="reservation-card"><div class="reservation-top"><div><h3>${r.name}</h3><div class="meta">${r.date} · ${r.rotation}</div></div><span class="status ${r.status}">${r.status==="waiting"?"대기":"체결"}</span></div><div class="details"><div><span>매도가</span><b>${fmt(r.sellPrice)}</b></div><div><span>매도수량</span><b>${r.sellQty}주</b></div><div><span>예약매수가</span><b>${fmt(r.buyPrice)}</b></div><div><span>예약수량</span><b>${r.buyQty}주</b></div><div><span>등급</span><b>${r.grade}</b></div><div><span>이유</span><b>${r.reason}</b></div></div>${r.status==="waiting"?`<div class="actions"><button class="fill" data-fill="${r.id}">체결 처리</button><button class="cancel" data-cancel="${r.id}">삭제</button></div>`:""}</article>`).join("")||'<div class="empty">해당 예약이 없습니다.</div>';$$("[data-fill]").forEach(b=>b.onclick=()=>fillRes(b.dataset.fill));$$("[data-cancel]").forEach(b=>b.onclick=()=>{state.reservations=state.reservations.filter(r=>r.id!==b.dataset.cancel);render()})}
function fillRes(id){const r=state.reservations.find(x=>x.id===id),s=state.stocks.find(x=>x.id===r.stockId);if(!r||!s)return;const beforeQty=s.qty,beforeAvg=s.avg,nq=s.qty+r.buyQty;s.avg=(s.qty*s.avg+r.buyPrice*r.buyQty)/nq;s.qty=nq;r.status="filled";r.filled=day();state.history.unshift({id:uid(),date:day(),stockId:s.id,name:s.name,type:"buy",price:r.buyPrice,qty:r.buyQty,beforeQty,afterQty:s.qty,beforeAvg,afterAvg:s.avg,realized:0});render();toast("체결과 매수 기록을 자동 반영했습니다.")}
function renderHistory(){$("#historyList").innerHTML=state.history.map(h=>`<article class="history-card"><div class="history-top"><div><h3>${h.name}</h3><div class="meta">${h.date}</div></div><span class="status ${h.type==="buy"?"filled":"waiting"}">${h.type==="buy"?"매수":"매도"}</span></div><div class="details"><div><span>가격</span><b>${fmt(h.price)}</b></div><div><span>수량</span><b>${h.qty}주</b></div><div><span>보유 변화</span><b>${h.beforeQty} → ${h.afterQty}</b></div><div><span>평균가 변화</span><b>${fmt(h.beforeAvg)} → ${fmt(h.afterAvg)}</b></div><div><span>실현손익</span><b>${won(h.realized)}</b></div></div></article>`).join("")||'<div class="empty">거래 기록이 없습니다.</div>'}
function renderSettings(){$("#userName").value=state.settings.name;$("#goalStock").value=state.settings.goal;$("#fxRate").value=state.settings.fx;$("#fxStatus").textContent=state.settings.fxDate?`최근 갱신: ${state.settings.fxDate}`:"아직 자동 갱신하지 않았습니다."}
function openStock(id=""){const s=state.stocks.find(x=>x.id===id);$("#dialogTitle").textContent=s?"종목 수정":"종목 추가";$("#editId").value=s?.id||"";$("#sName").value=s?.name||"";$("#sTicker").value=s?.ticker||"";$("#sMarket").value=s?.market||"KR";$("#sMode").value=s?.mode||"핵심장기";$("#sQty").value=s?.qty??0;$("#sTarget").value=s?.target??100;$("#sAvg").value=s?.avg??0;$("#sPrice").value=s?.price??0;$("#stockDialog").showModal()}
function saveStock(e){e.preventDefault();const id=$("#editId").value||uid(),s={id,name:$("#sName").value.trim(),ticker:$("#sTicker").value.trim(),market:$("#sMarket").value,mode:$("#sMode").value,qty:n($("#sQty").value),target:n($("#sTarget").value),avg:n($("#sAvg").value),price:n($("#sPrice").value)};const i=state.stocks.findIndex(x=>x.id===id);if(i>=0)state.stocks[i]=s;else state.stocks.push(s);$("#stockDialog").close();render();toast("종목을 저장했습니다.")}
async function updateFx(){try{$("#fxStatus").textContent="환율 조회 중...";const r=await fetch("https://api.frankfurter.dev/v2/rate/USD/KRW",{cache:"no-store"});if(!r.ok)throw Error();const d=await r.json();state.settings.fx=n(d.rate);state.settings.fxDate=d.date||day();render();toast("환율을 업데이트했습니다.")}catch{$("#fxStatus").textContent="자동 조회 실패. 기존 환율을 유지합니다.";toast("환율 조회에 실패했습니다.")}}
function exportData(){const b=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=`my-asset-v10-${day()}.json`;a.click();URL.revokeObjectURL(a.href)}
function importData(file){const r=new FileReader();r.onload=()=>{try{state=JSON.parse(r.result);render();page("home");toast("백업을 복원했습니다.")}catch{toast("백업 파일 오류")}};r.readAsText(file)}
document.addEventListener("click",e=>{const b=e.target.closest("[data-page]");if(b)page(b.dataset.page)});
$("#addStock").onclick=()=>openStock();$("#closeDialog").onclick=()=>$("#stockDialog").close();$("#stockForm").onsubmit=saveStock;
["tradeStock","tradeType","tradePrice","tradeQty"].forEach(id=>$("#"+id).addEventListener("input",refreshTrade));
$("#confirmTrade").onclick=confirmTrade;$("#resFilter").onchange=renderReservations;
$("#saveSettings").onclick=()=>{state.settings.name=$("#userName").value.trim()||"주형";state.settings.goal=$("#goalStock").value;state.settings.fx=n($("#fxRate").value)||state.settings.fx;render();toast("설정을 저장했습니다.")};
$("#updateFx").onclick=updateFx;$("#fxBadge").onclick=()=>page("settings");$("#exportData").onclick=exportData;$("#importData").onchange=e=>e.target.files[0]&&importData(e.target.files[0]);
$("#clearHistory").onclick=()=>{if(confirm("거래일지를 삭제할까요?")){state.history=[];render()}};
$("#resetData").onclick=()=>{if(confirm("모든 데이터를 초기화할까요?")){state=structuredClone(base);render();page("home")}};
render();
if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});

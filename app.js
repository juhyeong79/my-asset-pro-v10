const KEY="my_asset_pro_v10";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
const day=()=>new Date().toISOString().slice(0,10);
const n=x=>{
  if(typeof x==="number") return Number.isFinite(x)?x:0;
  const cleaned=String(x??"").trim().replace(/\s/g,"").replace(/,/g,".");
  const value=Number(cleaned);
  return Number.isFinite(value)?value:0;
};
const round6=x=>Math.round((n(x)+Number.EPSILON)*1e6)/1e6;
const fmt=x=>n(x).toLocaleString(undefined,{maximumFractionDigits:2});
const qtyFmt=x=>n(x).toLocaleString(undefined,{maximumFractionDigits:6});
const usd=x=>`$${n(x).toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:2})}`;
const won=x=>`${Math.round(n(x)).toLocaleString()}원`;

const base={
 settings:{name:"주형",goal:"samsung",fx:1390,fxDate:""},
 stocks:[
  {id:"samsung",name:"삼성전자",ticker:"005930",market:"KR",mode:"핵심장기",qty:43,avg:329000,price:314000,target:100},
  {id:"mando",name:"HL만도",ticker:"204320",market:"KR",mode:"손실회복",qty:32,avg:50400,price:49600,target:100},
  {id:"isu",name:"이수스페셜티케미컬",ticker:"457190",market:"KR",mode:"핵심장기",qty:20,avg:52700,price:53800,target:100},
  {id:"mbly",name:"모빌아이",ticker:"MBLY",market:"US",mode:"핵심장기",qty:15,avg:14.2,price:13.75,target:100},
  {id:"ionq",name:"아이온큐",ticker:"IONQ",market:"US",mode:"회전매매",qty:10,avg:21.8,price:22.45,target:100}
 ], reservations:[], history:[], adjustments:[]
};

function migrate(raw){
  const next={...base,...raw,settings:{...base.settings,...(raw?.settings||{})}};
  next.stocks=Array.isArray(raw?.stocks)?raw.stocks:structuredClone(base.stocks);
  next.reservations=Array.isArray(raw?.reservations)?raw.reservations:[];
  next.history=Array.isArray(raw?.history)?raw.history:[];
  next.adjustments=Array.isArray(raw?.adjustments)?raw.adjustments:[];
  next.history=next.history.map(h=>{
    const stock=next.stocks.find(s=>s.id===h.stockId);
    const market=h.market||stock?.market||"KR";
    let realizedNative=h.realizedNative;
    let realizedKRW=h.realizedKRW;
    if(realizedNative===undefined){
      if(market==="US"){
        realizedKRW=n(h.realized);
        realizedNative=next.settings.fx?n(h.realized)/n(next.settings.fx):0;
      }else{
        realizedNative=n(h.realized);
        realizedKRW=n(h.realized);
      }
    }
    return {...h,market,realizedNative:n(realizedNative),realizedKRW:n(realizedKRW)};
  });
  return next;
}
let state=load();
let selectedStockId=state.stocks[0]?.id||"";
let stockFilter="all";
let aiStockId="";

function load(){try{const x=JSON.parse(localStorage.getItem(KEY));return x?migrate(x):structuredClone(base)}catch{return structuredClone(base)}}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function fx(){return n(state.settings.fx)||1}
function cur(s){return s.market==="US"?"USD":"KRW"}
function money(x,c="KRW"){return c==="USD"?usd(x):won(x)}
function krw(s,x){return s.market==="US"?n(x)*fx():n(x)}
function rate(s){return s.avg?(s.price-s.avg)/s.avg:0}
function value(s){return krw(s,s.qty*s.price)}
function pnl(s){return krw(s,s.qty*(s.price-s.avg))}
function normalizeQty(s,q){
  q=n(q);
  return s.market==="US"?round6(q):Math.floor(q);
}
function recQty(s){
  const q=n(s.qty),r=rate(s); if(!q)return 0;
  if(s.market==="US"){
    const pct=r<0?.10:(r>=1?.15:r>=.2?.12:r>=.08?.10:.08);
    return round6(Math.max(.01,q*pct));
  }
  if(r<0){if(q<=10)return 1;if(q<=20)return 2;if(q<=40)return 3;if(q<=80)return 5;return Math.max(1,Math.floor(q*.1))}
  const p=r>=1?.15:r>=.2?.12:r>=.08?.10:.08;
  return Math.max(1,Math.min(Math.floor(q*p),Math.max(1,Math.floor(q*.2))));
}
function advice(s){
  const r=rate(s),a=Math.abs(r),rq=recQty(s),currency=cur(s);
  let label,summary,example,risk,action;
  if(r<0&&a<.05){
    label="관망";
    summary=`현재 손실률은 ${(r*100).toFixed(2)}%로 비교적 작은 편입니다. 이 구간에서 급하게 팔면 손실만 확정되고 더 낮은 가격에 다시 살 기회를 얻지 못할 수 있습니다.`;
    const q=s.market==="US"?Math.min(rq,s.qty):Math.min(Math.max(1,rq),s.qty);
    example=`예를 들어 ${money(s.price,currency)}에 ${qtyFmt(q)}주를 팔았는데 가격이 바로 3% 오르면, 같은 수량을 되사기 위해 더 많은 돈이 필요합니다.`;
    risk="주가가 예상과 반대로 오르면 주식 수는 늘지 않고 손실만 확정될 수 있습니다.";
    action="지금은 추가 매도보다 보유 이유와 기업 상황을 확인하면서 기다리는 편이 안전합니다.";
  }else if(r<0&&a<.12){
    label="시험매도";
    summary=`현재 손실률은 ${(r*100).toFixed(2)}%입니다. 전량 매도는 위험하므로 아주 소량만 시험하는 전략을 검토할 수 있습니다.`;
    example=`예를 들어 보유 ${qtyFmt(s.qty)}주 중 최대 ${qtyFmt(rq)}주만 매도하고, 매도가보다 충분히 낮은 가격에서 같은 수량 이상을 살 수 있을 때만 회전합니다.`;
    risk="재매수 가격이 오지 않거나 주가가 반등하면 손실 확정 후 주식 수까지 줄어들 수 있습니다.";
    action=`매도하더라도 최대 ${qtyFmt(rq)}주 이내로 제한하고, 재매수 예약을 먼저 정한 뒤 실행하세요.`;
  }else if(r<0){
    label=a<.25?"주의관망":"리스크점검";
    summary=`현재 손실률은 ${(r*100).toFixed(2)}%로 손실 폭이 큽니다. 단순히 평균단가를 낮추기 위해 매도와 재매수를 반복하면 위험이 더 커질 수 있습니다.`;
    example="예를 들어 10주를 손실 상태에서 팔고 가격이 더 내려오지 않으면, 손실은 확정되지만 보유수량은 줄어듭니다.";
    risk="기업 자체의 문제가 있는 상황이라면 물타기나 회전이 손실을 확대할 수 있습니다.";
    action="먼저 실적·재무·하락 원인을 점검하고, 확신이 없으면 거래보다 비중 관리가 우선입니다.";
  }else if(r<.03){
    label="보유";
    summary=`현재 수익률은 ${(r*100).toFixed(2)}%로 회전매매 비용과 가격 변동 위험을 감수할 만큼 크지 않을 수 있습니다.`;
    example="작은 수익에서 팔았다가 더 높은 가격에 다시 사면 수량은 늘지 않고 평균단가만 올라갈 수 있습니다.";
    risk="수수료와 가격 차이 때문에 실제 효과가 거의 없을 수 있습니다.";
    action="목표 가격이나 충분한 수익 구간이 올 때까지 보유를 우선하세요.";
  }else{
    label=r<.08?"일부회전":"회전추천";
    summary=`현재 수익률은 ${(r*100).toFixed(2)}%입니다. 전량이 아니라 일부만 매도해 이익을 확보하고 낮은 가격에서 재매수를 노릴 수 있습니다.`;
    example=`예를 들어 ${qtyFmt(s.qty)}주 중 ${qtyFmt(rq)}주만 매도하고, 매도가보다 낮은 가격에서 ${qtyFmt(rq)}주 이상 재매수하면 수량 유지 또는 증가를 기대할 수 있습니다.`;
    risk="주가가 계속 오르면 매도한 물량을 더 비싸게 되사야 할 수 있습니다.";
    action=`전량 매도는 피하고 최대 ${qtyFmt(rq)}주 이내의 일부 회전만 검토하세요.`;
  }
  return {label,summary,example,risk,action};
}
function toast(t){const e=$("#toast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),1900)}
function page(id){
  $$(".page").forEach(x=>x.classList.toggle("active",x.id===id));
  $$("nav button").forEach(x=>x.classList.toggle("active",x.dataset.page===id));
  const m={home:"대시보드",stocks:"종목 관리",trade:"거래 입력",reservations:"예약 관리",history:"거래 일지",settings:"설정·백업"};
  $("#title").textContent=m[id]||"대시보드";
  scrollTo({top:0,behavior:"smooth"});
  if(id==="trade")refreshTrade();
}
function profitTotals(){
  let realizedKRW=0,realizedUSD=0;
  state.history.forEach(h=>{
    if(h.type!=="sell")return;
    if(h.market==="US")realizedUSD+=n(h.realizedNative);
    else realizedKRW+=n(h.realizedNative);
  });
  let adjustKRW=0,adjustUSD=0;
  state.adjustments.forEach(a=>{
    if(a.currency==="USD")adjustUSD+=n(a.amount);
    else adjustKRW+=n(a.amount);
  });
  return {realizedKRW,realizedUSD,adjustKRW,adjustUSD,managedKRW:realizedKRW+adjustKRW,managedUSD:realizedUSD+adjustUSD};
}
function render(){renderHome();renderStocks();renderSelects();renderReservations();renderHistory();renderSettings();save()}
function renderHome(){
  const total=state.stocks.reduce((a,s)=>a+value(s),0),p=state.stocks.reduce((a,s)=>a+pnl(s),0),pt=profitTotals();
  $("#hello").textContent=`안녕하세요, ${state.settings.name}님.`;
  $("#totalValue").textContent=won(total); $("#totalPnl").textContent=won(p);
  $("#stockCount").textContent=`${state.stocks.length}개`;
  $("#resCount").textContent=`${state.reservations.filter(x=>x.status==="waiting").length}건`;
  $("#fxTop").textContent=fmt(fx());
  $("#managedKrw").textContent=won(pt.managedKRW);
  $("#managedUsd").textContent=usd(pt.managedUSD);
  $("#realizedKrwNote").textContent=`거래 실현수익 ${won(pt.realizedKRW)} · 조정 ${won(pt.adjustKRW)}`;
  $("#realizedUsdNote").textContent=`거래 실현수익 ${usd(pt.realizedUSD)} · 조정 ${usd(pt.adjustUSD)}`;

  const g=state.stocks.find(s=>s.id===state.settings.goal)||state.stocks[0];
  if(g){$("#goalName").textContent=g.name;$("#goalText").textContent=`${qtyFmt(g.qty)} / ${qtyFmt(g.target)}주`;$("#goalBar").style.width=`${Math.min(100,g.target?g.qty/g.target*100:0)}%`}

  const waiting=[...state.reservations].filter(r=>r.status==="waiting");
  const nearest=waiting.sort((a,b)=>Math.abs(a.buyPrice-(state.stocks.find(s=>s.id===a.stockId)?.price||a.buyPrice))-Math.abs(b.buyPrice-(state.stocks.find(s=>s.id===b.stockId)?.price||b.buyPrice)))[0];
  $("#todayTask").innerHTML=nearest?`<div class="todo-card"><h4>${nearest.name} 예약매수 확인</h4><p>${qtyFmt(nearest.buyQty)}주 예약 · ${nearest.reason}</p><div class="todo-line"><span class="todo-price">${fmt(nearest.buyPrice)}</span><button data-page="reservations">확인</button></div></div>`:`<div class="todo-card"><h4>오늘은 대기</h4><p>체결을 기다리는 예약이 없습니다. 성급한 거래보다 원칙 유지가 우선입니다.</p></div>`;

  const picks=[...state.stocks].sort((a,b)=>Math.abs(rate(b))-Math.abs(rate(a))).slice(0,3);
  $("#aiList").innerHTML=picks.map(s=>{const a=advice(s);return `<button class="ai-card" data-ai="${s.id}"><div class="ai-main"><div class="ai-topline"><h4>${s.name}</h4><span class="badge">${a.label}</span></div><div class="ai-stats"><span>수익률 ${(rate(s)*100).toFixed(2)}%</span><span>추천 ${qtyFmt(recQty(s))}주</span></div><div class="ai-reason">${a.summary}</div></div></button>`}).join("")||'<div class="empty">종목을 추가하세요.</div>';

  $("#homeStocks").innerHTML=state.stocks.slice(0,5).map(s=>{const a=advice(s),waitingCount=state.reservations.filter(r=>r.stockId===s.id&&r.status==="waiting").length;return `<div class="stock-card"><div class="stock-top"><div><h3>${s.name}</h3><div class="meta">${s.ticker} · ${s.market==="US"?"미국":"국내"}</div></div><b class="${pnl(s)>=0?"pos":"neg"}">${won(pnl(s))}</b></div><div class="info"><div><span>보유</span><b>${qtyFmt(s.qty)}주</b></div><div><span>평균가</span><b>${money(s.avg,cur(s))}</b></div><div><span>현재가</span><b>${money(s.price,cur(s))}</b></div><div><span>수익률</span><b>${(rate(s)*100).toFixed(2)}%</b></div><div><span>AI 추천</span><b>${a.label}</b></div><div><span>대기 예약</span><b>${waitingCount}건</b></div></div></div>`}).join("");
  $$("[data-ai]").forEach(b=>b.onclick=()=>openAiDialog(b.dataset.ai));
}
function groupedRail(stocks){
  const groups=[["KR","국내주식"],["US","미국주식"]];
  return groups.map(([market,title])=>{
    const items=stocks.filter(s=>s.market===market);
    if(!items.length)return "";
    return `<div class="rail-group"><div class="rail-group-title">${title}</div>${items.map(s=>`<button class="rail-stock ${s.id===selectedStockId?"active":""}" data-select-stock="${s.id}"><strong>${s.name}</strong><small>${s.ticker||"-"}</small></button>`).join("")}</div>`;
  }).join("");
}
function renderStocks(){
  if(!state.stocks.length){$("#stockRail").innerHTML='<div class="empty">종목 없음</div>';$("#stockDetail").innerHTML='<div class="empty">종목을 추가해 주세요.</div>';return}
  const visible=stockFilter==="all"?state.stocks:state.stocks.filter(s=>s.market===stockFilter);
  if(!visible.some(s=>s.id===selectedStockId))selectedStockId=visible[0]?.id||state.stocks[0].id;
  $("#stockRail").innerHTML=groupedRail(visible);
  const s=state.stocks.find(x=>x.id===selectedStockId),a=advice(s),waiting=state.reservations.filter(r=>r.stockId===s.id&&r.status==="waiting").length;
  $("#stockDetail").innerHTML=`<article class="stock-detail-card"><div class="stock-detail-head"><div><h3>${s.name}</h3><div class="meta">${s.ticker||"-"} · ${s.market==="US"?"미국":"국내"} · ${s.mode}</div></div><div class="stock-detail-pnl ${pnl(s)>=0?"pos":"neg"}">${won(pnl(s))}</div></div><div class="stock-detail-grid"><div><span>보유수량</span><b>${qtyFmt(s.qty)}주</b></div><div><span>목표수량</span><b>${qtyFmt(s.target)}주</b></div><div><span>평균단가</span><b>${money(s.avg,cur(s))}</b></div><div><span>현재가</span><b>${money(s.price,cur(s))}</b></div><div><span>수익률</span><b>${(rate(s)*100).toFixed(2)}%</b></div><div><span>평가손익</span><b class="${pnl(s)>=0?"pos":"neg"}">${won(pnl(s))}</b></div><div><span>추천수량</span><b>${qtyFmt(recQty(s))}주</b></div><div><span>대기예약</span><b>${waiting}건</b></div></div><button class="detail-advice" data-ai="${s.id}"><strong>AI 추천 · ${a.label}</strong><p>${a.summary}</p><span>자세한 예시 보기 ›</span></button><div class="detail-actions"><button class="detail-edit" data-detail-edit="${s.id}">정보 수정</button><button class="detail-trade" data-detail-trade="${s.id}">거래 입력</button></div></article>`;
  $$("[data-select-stock]").forEach(b=>b.onclick=()=>{selectedStockId=b.dataset.selectStock;renderStocks()});
  $$("[data-stock-filter]").forEach(b=>b.classList.toggle("active",b.dataset.stockFilter===stockFilter));
  const eb=$("[data-detail-edit]");if(eb)eb.onclick=()=>openStock(eb.dataset.detailEdit);
  const tb=$("[data-detail-trade]");if(tb)tb.onclick=()=>{page("trade");$("#tradeStock").value=tb.dataset.detailTrade;refreshTrade()};
  $$("[data-ai]").forEach(b=>b.onclick=()=>openAiDialog(b.dataset.ai));
}
function renderSelects(){
  const v=$("#tradeStock").value;
  $("#tradeStock").innerHTML=state.stocks.map(s=>`<option value="${s.id}">${s.name}</option>`).join("");
  if(state.stocks.some(s=>s.id===v))$("#tradeStock").value=v;
  $("#goalStock").innerHTML=state.stocks.map(s=>`<option value="${s.id}">${s.name}</option>`).join("");
}
function tStock(){return state.stocks.find(s=>s.id===$("#tradeStock").value)||state.stocks[0]}
function rotation(s,sp,sq){
  return[.01,.03,.05,.07].map((d,i)=>{
    const bp=sp*(1-d),gross=sp*sq;
    const bq=s.market==="US"?Math.floor((gross/bp)*1e6)/1e6:Math.floor(gross/bp);
    const extra=round6(bq-sq),remain=round6(s.qty-sq),avg=remain+bq>0?(remain*s.avg+bq*bp)/(remain+bq):s.avg,cash=Math.max(0,gross-bp*bq);
    let grade="D",reason="효과 부족";
    if(extra>(s.market==="US"?0.000001:0)){grade="A";reason="수량 증가"}
    else if(s.avg&&((s.avg-avg)/s.avg)>=.007){grade="B";reason="평균가 개선"}
    else if(avg<s.avg){grade="C";reason="효과 작음"}
    return{id:i,d,bp,bq,extra,avg,cash,grade,reason};
  });
}
function refreshTrade(){
  const s=tStock();if(!s)return;
  if(!$("#tradePrice").value)$("#tradePrice").value=s.price;
  const type=$("#tradeType").value,p=n($("#tradePrice").value),q=normalizeQty(s,$("#tradeQty").value),rq=recQty(s);
  $("#recQty").textContent=`${qtyFmt(rq)}주`;
  $("#qtyJudge").textContent=q?q<=rq+1e-9?"추천 범위":"추천보다 많음":"-";
  const aq=round6(type==="buy"?s.qty+q:s.qty-q),aa=type==="buy"&&aq>0?(s.qty*s.avg+p*q)/aq:s.avg,real=type==="sell"?(p-s.avg)*q:0;
  $("#afterQty").textContent=`${qtyFmt(aq)}주`;$("#afterAvg").textContent=money(aa,cur(s));$("#realized").textContent=s.market==="US"?`${usd(real)} / ${won(real*fx())}`:won(real);
  $("#rotationBlock").style.display=type==="sell"?"block":"none";
  if(type==="sell")$("#rotationList").innerHTML=rotation(s,p,q).map(o=>`<label class="option"><input class="rot" type="checkbox" data-o='${JSON.stringify(o)}'><div><b>${money(o.bp,cur(s))} · ${qtyFmt(o.bq)}주</b><small>${Math.round(o.d*100)}% 하락 · ${o.reason}</small></div><span class="grade">${o.grade}</span></label>`).join("");
}
function confirmTrade(){
  const s=tStock(),type=$("#tradeType").value,p=n($("#tradePrice").value),q=normalizeQty(s,$("#tradeQty").value);
  if(!s||!p||!q||q<=0)return toast("가격과 수량을 확인하세요.");
  if(s.market==="KR"&&!Number.isInteger(n($("#tradeQty").value)))return toast("국내주식 수량은 정수로 입력하세요.");
  if(type==="sell"&&q>s.qty+1e-9)return toast("보유수량보다 많이 매도할 수 없습니다.");
  const beforeQty=s.qty,beforeAvg=s.avg;let real=0;
  if(type==="buy"){const nq=round6(s.qty+q);s.avg=(s.qty*s.avg+p*q)/nq;s.qty=nq}else{real=(p-s.avg)*q;s.qty=round6(s.qty-q)}
  state.history.unshift({id:uid(),date:day(),stockId:s.id,name:s.name,market:s.market,type,price:p,qty:q,beforeQty,afterQty:s.qty,beforeAvg,afterAvg:s.avg,realizedNative:real,realizedKRW:krw(s,real)});
  if(type==="sell")$$(".rot:checked").forEach(x=>{const o=JSON.parse(x.dataset.o);state.reservations.unshift({id:uid(),rotation:`${s.id}-${Date.now().toString().slice(-6)}`,date:day(),stockId:s.id,name:s.name,market:s.market,sellPrice:p,sellQty:q,buyPrice:o.bp,buyQty:o.bq,grade:o.grade,reason:o.reason,status:"waiting",filled:""})});
  $("#tradeQty").value="";render();page("home");toast("거래와 예약을 자동 기록했습니다.");
}
function renderReservations(){
  const f=$("#resFilter").value,list=state.reservations.filter(r=>f==="all"||r.status===f);
  $("#resList").innerHTML=list.map(r=>`<article class="reservation-card"><div class="reservation-top"><div><h3>${r.name}</h3><div class="meta">${r.date} · ${r.rotation}</div></div><span class="status ${r.status}">${r.status==="waiting"?"대기":"체결"}</span></div><div class="details"><div><span>매도가</span><b>${fmt(r.sellPrice)}</b></div><div><span>매도수량</span><b>${qtyFmt(r.sellQty)}주</b></div><div><span>예약매수가</span><b>${fmt(r.buyPrice)}</b></div><div><span>예약수량</span><b>${qtyFmt(r.buyQty)}주</b></div><div><span>등급</span><b>${r.grade}</b></div><div><span>이유</span><b>${r.reason}</b></div></div>${r.status==="waiting"?`<div class="actions"><button class="fill" data-fill="${r.id}">체결 처리</button><button class="cancel" data-cancel="${r.id}">삭제</button></div>`:""}</article>`).join("")||'<div class="empty">해당 예약이 없습니다.</div>';
  $$("[data-fill]").forEach(b=>b.onclick=()=>fillRes(b.dataset.fill));$$("[data-cancel]").forEach(b=>b.onclick=()=>{state.reservations=state.reservations.filter(r=>r.id!==b.dataset.cancel);render()});
}
function fillRes(id){
  const r=state.reservations.find(x=>x.id===id),s=state.stocks.find(x=>x.id===r.stockId);if(!r||!s)return;
  const beforeQty=s.qty,beforeAvg=s.avg,nq=round6(s.qty+r.buyQty);s.avg=(s.qty*s.avg+r.buyPrice*r.buyQty)/nq;s.qty=nq;r.status="filled";r.filled=day();
  state.history.unshift({id:uid(),date:day(),stockId:s.id,name:s.name,market:s.market,type:"buy",price:r.buyPrice,qty:r.buyQty,beforeQty,afterQty:s.qty,beforeAvg,afterAvg:s.avg,realizedNative:0,realizedKRW:0});
  render();toast("체결과 매수 기록을 자동 반영했습니다.");
}
function renderHistory(){
  $("#historyList").innerHTML=state.history.map(h=>`<article class="history-card"><div class="history-top"><div><h3>${h.name}</h3><div class="meta">${h.date} · ${h.market==="US"?"미국":"국내"}</div></div><span class="status ${h.type==="buy"?"filled":"waiting"}">${h.type==="buy"?"매수":"매도"}</span></div><div class="details"><div><span>가격</span><b>${fmt(h.price)}</b></div><div><span>수량</span><b>${qtyFmt(h.qty)}주</b></div><div><span>보유 변화</span><b>${qtyFmt(h.beforeQty)} → ${qtyFmt(h.afterQty)}</b></div><div><span>평균가 변화</span><b>${fmt(h.beforeAvg)} → ${fmt(h.afterAvg)}</b></div><div><span>실현손익</span><b>${h.market==="US"?`${usd(h.realizedNative)} / ${won(h.realizedKRW)}`:won(h.realizedNative)}</b></div></div></article>`).join("")||'<div class="empty">거래 기록이 없습니다.</div>';
}
function adjustmentTypeLabel(t){return({withdrawal:"출금",deposit:"입금",exchange_usd_krw:"달러→원화 환전",manual:"직접 조정"})[t]||t}
function addAdjustment(){
  const type=$("#adjustType").value,currency=$("#adjustCurrency").value,raw=n($("#adjustAmount").value),memo=$("#adjustMemo").value.trim();
  if(!raw)return toast("조정 금액을 입력하세요.");
  if(type==="exchange_usd_krw"){
    state.adjustments.unshift({id:uid(),date:day(),type,currency:"USD",amount:-Math.abs(raw),memo:memo||"달러 환전 차감"});
    state.adjustments.unshift({id:uid(),date:day(),type,currency:"KRW",amount:Math.abs(raw)*fx(),memo:memo||`달러 환전 입금 (${fmt(fx())}원)`});
  }else{
    let amount=raw;
    if(type==="withdrawal")amount=-Math.abs(raw);
    if(type==="deposit")amount=Math.abs(raw);
    state.adjustments.unshift({id:uid(),date:day(),type,currency,amount,memo});
  }
  $("#adjustAmount").value="";$("#adjustMemo").value="";render();toast("수익금 조정 내역을 저장했습니다.");
}
function renderAdjustments(){
  const p=profitTotals();
  $("#adjustmentSummary").innerHTML=`<div><span>원화 관리 잔액</span><b>${won(p.managedKRW)}</b></div><div><span>달러 관리 잔액</span><b>${usd(p.managedUSD)}</b></div>`;
  $("#adjustmentList").innerHTML=state.adjustments.slice(0,20).map(a=>`<div class="adjustment-item"><div><strong>${adjustmentTypeLabel(a.type)}</strong><small>${a.date}${a.memo?` · ${a.memo}`:""}</small></div><b class="${a.amount>=0?"pos":"neg"}">${a.currency==="USD"?usd(a.amount):won(a.amount)}</b><button data-delete-adjust="${a.id}">삭제</button></div>`).join("")||'<div class="empty">조정 내역이 없습니다.</div>';
  $$("[data-delete-adjust]").forEach(b=>b.onclick=()=>{state.adjustments=state.adjustments.filter(a=>a.id!==b.dataset.deleteAdjust);render()});
}
function renderSettings(){
  $("#userName").value=state.settings.name;$("#goalStock").value=state.settings.goal;$("#fxRate").value=state.settings.fx;
  $("#fxStatus").textContent=state.settings.fxDate?`최근 갱신: ${state.settings.fxDate}`:"아직 자동 갱신하지 않았습니다.";
  renderAdjustments();
}
function openStock(id=""){
  const s=state.stocks.find(x=>x.id===id);$("#dialogTitle").textContent=s?"종목 수정":"종목 추가";$("#editId").value=s?.id||"";$("#sName").value=s?.name||"";$("#sTicker").value=s?.ticker||"";$("#sMarket").value=s?.market||"KR";$("#sMode").value=s?.mode||"핵심장기";$("#sQty").value=s?.qty??0;$("#sTarget").value=s?.target??100;$("#sAvg").value=s?.avg??0;$("#sPrice").value=s?.price??0;$("#stockDialog").showModal();
}
function saveStock(e){
  e.preventDefault();const market=$("#sMarket").value,rawQty=n($("#sQty").value),rawTarget=n($("#sTarget").value);
  if(market==="KR"&&(!Number.isInteger(rawQty)||!Number.isInteger(rawTarget)))return toast("국내주식 수량은 정수로 입력하세요.");
  const id=$("#editId").value||uid(),s={id,name:$("#sName").value.trim(),ticker:$("#sTicker").value.trim(),market,mode:$("#sMode").value,qty:market==="US"?round6(rawQty):rawQty,target:market==="US"?round6(rawTarget):rawTarget,avg:n($("#sAvg").value),price:n($("#sPrice").value)};
  const i=state.stocks.findIndex(x=>x.id===id);if(i>=0)state.stocks[i]=s;else state.stocks.push(s);selectedStockId=id;$("#stockDialog").close();render();toast("종목을 저장했습니다.");
}
function openAiDialog(id){
  const s=state.stocks.find(x=>x.id===id);if(!s)return;aiStockId=id;const a=advice(s);
  $("#aiDialogTitle").textContent=`${s.name} · ${a.label}`;
  $("#aiDialogContent").innerHTML=`<div class="ai-explain"><section><h4>1. 현재 상태</h4><p>수익률 ${(rate(s)*100).toFixed(2)}%, 보유 ${qtyFmt(s.qty)}주, 추천 수량 ${qtyFmt(recQty(s))}주입니다.</p></section><section><h4>2. 왜 이런 추천인가요?</h4><p>${a.summary}</p></section><section><h4>3. 숫자로 보는 예시</h4><p>${a.example}</p></section><section class="risk"><h4>4. 잘못됐을 때의 위험</h4><p>${a.risk}</p></section><section class="action"><h4>5. 지금 할 행동</h4><p>${a.action}</p></section><p class="ai-disclaimer">이 설명은 입력한 가격과 보유정보에 따른 규칙 기반 참고 의견입니다. 기업 실적과 시장 상황은 별도로 확인해야 합니다.</p></div>`;
  $("#aiDialog").showModal();
}
function closeAi(){if($("#aiDialog").open)$("#aiDialog").close()}
async function updateFx(){try{$("#fxStatus").textContent="환율 조회 중...";const r=await fetch("https://api.frankfurter.dev/v2/rate/USD/KRW",{cache:"no-store"});if(!r.ok)throw Error();const d=await r.json();state.settings.fx=n(d.rate);state.settings.fxDate=d.date||day();render();toast("환율을 업데이트했습니다.")}catch{$("#fxStatus").textContent="자동 조회 실패. 기존 환율을 유지합니다.";toast("환율 조회에 실패했습니다.")}}
function exportData(){const b=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=`my-asset-v10-3-${day()}.json`;a.click();URL.revokeObjectURL(a.href)}
function importData(file){const r=new FileReader();r.onload=()=>{try{state=migrate(JSON.parse(r.result));selectedStockId=state.stocks[0]?.id||"";render();page("home");toast("백업을 복원했습니다.")}catch{toast("백업 파일 오류")}};r.readAsText(file)}
function normalizeInput(el){const raw=String(el.value||"").trim().replace(/,/g,".");if(raw==="")return;const value=Number(raw);if(Number.isFinite(value))el.value=String(value)}
function installOverwriteInputs(){
  ["tradePrice","tradeQty","sQty","sTarget","sAvg","sPrice","fxRate","adjustAmount"].forEach(id=>{
    const el=$("#"+id);if(!el)return;
    el.addEventListener("focus",()=>setTimeout(()=>el.select(),0));
    el.addEventListener("click",()=>{if(document.activeElement===el&&el.dataset.firstClick!=="done"){el.select();el.dataset.firstClick="done";setTimeout(()=>el.dataset.firstClick="",300)}});
    el.addEventListener("blur",()=>normalizeInput(el));
    el.addEventListener("input",()=>{el.value=el.value.replace(/[^0-9.,-]/g,"")});
  });
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-page]");if(b)page(b.dataset.page)});
$("#addStock").onclick=()=>openStock();$("#closeDialog").onclick=()=>$("#stockDialog").close();$("#stockForm").onsubmit=saveStock;
["tradeStock","tradeType","tradePrice","tradeQty"].forEach(id=>$("#"+id).addEventListener("input",refreshTrade));
$("#confirmTrade").onclick=confirmTrade;$("#resFilter").onchange=renderReservations;
$("#saveSettings").onclick=()=>{state.settings.name=$("#userName").value.trim()||"주형";state.settings.goal=$("#goalStock").value;state.settings.fx=n($("#fxRate").value)||state.settings.fx;render();toast("설정을 저장했습니다.")};
$("#updateFx").onclick=updateFx;$("#fxBadge").onclick=()=>page("settings");$("#exportData").onclick=exportData;$("#importData").onchange=e=>e.target.files[0]&&importData(e.target.files[0]);
$("#clearHistory").onclick=()=>{if(confirm("거래일지를 삭제할까요?")){state.history=[];render()}};
$("#resetData").onclick=()=>{if(confirm("모든 데이터를 초기화할까요?")){state=structuredClone(base);selectedStockId=state.stocks[0].id;render();page("home")}};
$("#addAdjustment").onclick=addAdjustment;
$("#adjustType").onchange=()=>{$("#adjustCurrency").disabled=$("#adjustType").value==="exchange_usd_krw";if($("#adjustType").value==="exchange_usd_krw")$("#adjustCurrency").value="USD"};
$$("[data-stock-filter]").forEach(b=>b.onclick=()=>{stockFilter=b.dataset.stockFilter;renderStocks()});
$("#closeAiDialog").onclick=closeAi;$("#aiCloseBottom").onclick=closeAi;
$("#aiGoStock").onclick=()=>{closeAi();selectedStockId=aiStockId;page("stocks");renderStocks()};
$("#aiGoTrade").onclick=()=>{closeAi();page("trade");$("#tradeStock").value=aiStockId;refreshTrade()};
installOverwriteInputs();render();
if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});

/* Seoul travel disruption notices. Approximate landmark anchors, NOT verified protest GPS/routes. */
(() => {
  'use strict';
  if (typeof L === 'undefined' || typeof map === 'undefined') { console.error('Leaflet map not ready'); return; }
  const ANCHORS = [
    {test:/동화면세점/,name:'동화면세점·세종대로 일대',lat:37.5698,lon:126.9767},
    {test:/서초역/,name:'서초역·서초대로 일대',lat:37.4919,lon:127.0079},
    {test:/마포대교 남단/,name:'마포대교 남단·여의도 일대',lat:37.5277,lon:126.9346},
    {test:/내자R/,name:'내자동 교차로·사직공원 일대',lat:37.5758,lon:126.9718},
    {test:/시의회/,name:'서울시의회·태평로 일대',lat:37.5659,lon:126.9752},
    {test:/의사당역/,name:'국회의사당역·은행로 일대',lat:37.5280,lon:126.9178},
    {test:/평강제일교회/,name:'평강제일교회·오류동 일대',lat:37.4936,lon:126.8450},
    {test:/교보빌딩/,name:'광화문 교보빌딩·세종대로 일대',lat:37.5708,lon:126.9779},
    {test:/하나증권/,name:'하나증권·여의도 일대',lat:37.5239,lon:126.9245},
    {test:/국회의사당역/,name:'국회의사당역·여의도 일대',lat:37.5280,lon:126.9178},
    {test:/서울시교육청/,name:'서울시교육청 일대',lat:37.5697,lon:126.9665},
    {test:/교대역/,name:'교대역·강남대로 일대',lat:37.4934,lon:127.0145}
  ];
  // Coordinates are hand-placed approximate visual anchors; verify before precision use.
  const css = document.createElement('style');
  css.textContent = `#demoPanel{background:#fff;border-bottom:1px solid #d8e0ea;padding:9px 16px;font:13px/1.5 system-ui,sans-serif}#demoPanel .demo-controls{display:flex;flex-wrap:wrap;align-items:center;gap:10px}#demoPanel select{padding:5px}#demoPanel details{margin-top:6px}#demoPanel summary{cursor:pointer;font-weight:600}#demoPanel ul{margin:6px 0;padding-left:20px;max-height:180px;overflow:auto}#demoPanel li{margin:5px 0}#demoPanel .demo-muted{color:#59677a}#demoPanel .demo-alert{color:#9a3412}#demoPanel a{color:#175ba4}.demo-pin{width:24px;height:24px;background:#d97706;border:3px solid #fff;border-radius:50%;box-shadow:0 1px 5px #0008}.demo-pin:after{content:'!';position:absolute;left:7px;top:1px;color:white;font:bold 14px system-ui}`;
  document.head.appendChild(css);
  const panel = document.createElement('section'); panel.id = 'demoPanel';
  panel.innerHTML = `<div class="demo-controls"><label><input type="checkbox" id="demoToggle" checked> Demonstrations / 집회·이동 안내</label><label>Date / 날짜 <select id="demoDate"><option value="all">All upcoming / 전체 예정</option></select></label><span id="demoCount" aria-live="polite">Loading demonstrations / 집회 정보 로딩 중…</span></div><details><summary>Demonstration schedule & approximate map markers / 집회 일정·참고 위치</summary><p class="demo-muted">Orange markers are <b>approximate nearby landmarks</b>, NOT protest boundaries, marching routes or confirmed road closures. Demonstrations do not indicate danger. Reported attendance is not actual attendance.<div>주황색 표시는 장소 주변의 대략적인 참고 위치이며 집회 경계·행진 경로·도로 통제를 뜻하지 않습니다. 신고 인원은 실제 참가 인원이 아닙니다.</div></p><ul id="demoList"></ul><p class="demo-muted" id="demoUpdated"></p></details>`;
  document.getElementById('map').before(panel);
  const toggle = panel.querySelector('#demoToggle'),dateSel=panel.querySelector('#demoDate'),count=panel.querySelector('#demoCount'),list=panel.querySelector('#demoList'),updated=panel.querySelector('#demoUpdated');
  const layer=L.layerGroup().addTo(map);let events=[];
  const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const kstNow=()=>new Date(Date.now()+9*3600*1000).toISOString().slice(0,16);
  const isCurrent=e=>e.date+'T'+e.end_time>=kstNow();
  const link=e=>/^https:\/\/www\.smpa\.go\.kr\//.test(e.source_url||'')?e.source_url:'https://www.smpa.go.kr/user/nd54882.do';
  function render(){
    layer.clearLayers();list.replaceChildren();
    const active=events.filter(e=>isCurrent(e)&&(dateSel.value==='all'||e.date===dateSel.value));
    let located=0;
    for(const e of active){
      const anchor=ANCHORS.find(a=>a.test.test(e.location_text||''));
      const state=e.date+'T'+e.start_time<=kstNow()?'In scheduled hours / 진행 시간대':'Scheduled / 예정';
      const li=document.createElement('li');
      li.innerHTML=`<b>${esc(e.date)} ${esc(e.start_time)}–${esc(e.end_time)}</b> (${state}) · ${e.location_en?'<span lang="en">'+esc(e.location_en)+'</span><br>':''}${esc(e.location_text)} · Reported / 신고 ${Number(e.reported_participants||0).toLocaleString('ko-KR')} · ${anchor?'Approx. marker / 참고 위치':'Location unverified / 위치 미확인'} · <a href="${esc(link(e))}" target="_blank" rel="noopener noreferrer">Source / 원문</a>`;
      list.append(li);
      if(anchor&&toggle.checked){
        located++;
        L.marker([anchor.lat,anchor.lon],{icon:L.divIcon({className:'',html:'<div class="demo-pin"></div>',iconSize:[24,24],iconAnchor:[12,12]}),title:'Approximate demonstration landmark / 집회 참고 위치: '+anchor.name})
          .bindPopup(`<strong>Demonstration notice / 집회 안내</strong><div>${esc(e.date)} ${esc(e.start_time)}–${esc(e.end_time)}</div><div>${e.location_en?esc(e.location_en)+'<br>':''}${esc(e.location_text)}</div><div>Reported attendance / 신고 인원: ${Number(e.reported_participants||0).toLocaleString('ko-KR')}명</div><div class="demo-alert">${esc(anchor.name)} — approximate landmark only, not verified location or route / 대략적 참고 위치</div><a href="${esc(link(e))}" target="_blank" rel="noopener noreferrer">SMPA source / 서울경찰청 원문</a>`).addTo(layer);
      }
    }
    if(!active.length){const li=document.createElement('li');li.textContent='No scheduled demonstrations shown for this date / 선택 날짜에 표시할 예정 집회 없음. Notices may be incomplete or delayed.';list.append(li)}
    count.textContent=`Scheduled/ongoing ${active.length} · Approx. markers ${toggle.checked?located:0} / 예정·진행 ${active.length}건`;
  }
  toggle.addEventListener('change',render);dateSel.addEventListener('change',render);
  async function load(){try{
    const r=await fetch('./demonstrations.json?ts='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);
    const data=await r.json();if(!Array.isArray(data.events))throw Error('Missing events array');
    events=data.events.filter(e=>e&&/^\d{4}-\d\d-\d\d$/.test(e.date||'')&&/^\d\d:\d\d$/.test(e.end_time||''));
    const dates=[...new Set(events.filter(isCurrent).map(e=>e.date))].sort();
    const previous=dateSel.value;dateSel.replaceChildren(new Option('All upcoming / 전체 예정','all'));
    for(const d of dates)dateSel.add(new Option(d,d));if(dates.includes(previous))dateSel.value=previous;
    updated.textContent=`Source: Seoul Metropolitan Police Agency / 서울경찰청 · Updated / 수집: ${data.generated_at_kst||'Unknown'} · Collection warnings: ${data.issues?.length||0} · Not a complete list / 일부 집회만 게시될 수 있습니다. ${data.translation_notice||''}`;
    render();
  }catch(err){count.textContent='Demonstration data unavailable / 집회 로드 실패';updated.textContent=String(err);console.error('Demonstration layer:',err)}}
  load();setInterval(render,60_000);setInterval(load,15*60_000);
})();

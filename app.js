/* =========================================================
   ANTARAKALA — Demo App Logic (THEORIST UKMP UNNES 2026)
   Semua data & inferensi AI pada file ini adalah SIMULASI
   untuk keperluan demonstrasi antarmuka (lihat modal "Tentang").
   ========================================================= */
(function(){
  "use strict";

  /* ---------------- constants ---------------- */
  const POINTS = [
    { id:1, name:"Posterior Atas Kiri"  },
    { id:2, name:"Posterior Atas Kanan" },
    { id:3, name:"Posterior Bawah Kiri" },
    { id:4, name:"Posterior Bawah Kanan"},
    { id:5, name:"Anterior Atas Kiri"   },
    { id:6, name:"Anterior Atas Kanan"  },
  ];

  /* ---------------- 6-tier risk text map ---------------- */
  const RESULT_TEXT = {
    "rendah": {
      label:"RISIKO RENDAH - BUKAN LRTI", sub:"Stabil · Tidak Ada Tanda LRTI", cls:"low", acuTag:"Rendah",
      action:"Rawat jalan di rumah. Edukasi orang tua mengenai tanda bahaya, dan jadwalkan kontrol ulang bila gejala memburuk.",
      checklist:["Edukasi tanda bahaya kepada orang tua/pengasuh","Anjurkan kontrol ulang jika gejala memburuk","Pastikan asupan cairan & nutrisi tetap terjaga"]
    },
    "sedang-pneumonia": {
      label:"RISIKO SEDANG - DUGAAN PNEUMONIA", sub:"Moderate · Perlu Terapi & Observasi", cls:"mid", acuTag:"Sedang",
      action:"Berikan antibiotik oral sesuai pedoman MTBS, observasi kondisi 24 jam, dan edukasi tanda bahaya untuk kembali segera.",
      checklist:["Berikan Antibiotik Oral Sesuai Pedoman MTBS","Observasi Kondisi Selama 24 Jam","Edukasi Tanda Bahaya untuk Kembali Segera"]
    },
    "tinggi-pneumonia": {
      label:"RISIKO TINGGI - PNEUMONIA BERAT", sub:"Severe · Immediate Action Required", cls:"high", acuTag:"Tinggi",
      action:"Rujuk segera ke RS/IGD, berikan terapi oksigen, dan beri dosis pertama antibiotik IV sebelum rujukan.",
      checklist:["Berikan Terapi Oksigen (2–4 L/menit)","Beri Dosis Pertama Antibiotik IV","Siapkan Rujukan Segera","Pantau Tanda Vital Tiap 15 Menit"]
    },
    "sedang-bronkiolitis": {
      label:"RISIKO SEDANG - DUGAAN BRONKIOLITIS", sub:"Moderate · Tatalaksana Suportif", cls:"mid", acuTag:"Sedang",
      action:"Berikan tatalaksana suportif (bersihkan jalan napas, jaga hidrasi), observasi, dan edukasi tanda bahaya.",
      checklist:["Bersihkan Jalan Napas (Nasal Suction)","Jaga Asupan Cairan/Hidrasi","Observasi Perkembangan Gejala"]
    },
    "tinggi-bronkiolitis": {
      label:"RISIKO TINGGI - BRONKIOLITIS BERAT", sub:"Severe · Immediate Action Required", cls:"high", acuTag:"Tinggi",
      action:"Rujuk segera ke RS/IGD, berikan terapi oksigen 2–4 L/menit, dan pantau tanda vital tiap 15 menit.",
      checklist:["Berikan Terapi Oksigen (2–4 L/menit)","Siapkan Rujukan Segera ke RS/IGD","Pantau Tanda Vital Tiap 15 Menit"]
    },
    "sedang-asma": {
      label:"RISIKO SEDANG - DUGAAN ASMA", sub:"Moderate · Riwayat Wheezing Berulang", cls:"mid", acuTag:"Sedang",
      action:"Berikan bronkodilator kerja cepat, edukasi kontrol asma pada pengasuh, dan jadwalkan kontrol ulang.",
      checklist:["Berikan Bronkodilator Kerja Cepat","Edukasi Kontrol Asma pada Pengasuh","Jadwalkan Kontrol Ulang"]
    },
  };
  const CLS_LABEL = { high:"Tinggi", mid:"Sedang", low:"Rendah" };
  const CLS_PILL  = { high:"pill-red", mid:"pill-amber", low:"pill-green" };

  /* ---------------- state ---------------- */
  const state = {
    patient:{ name:"", age:"" },
    clinical:{ pcv:"", wheeze:"" },
    vitals:{ temp:36.8, spo2:97 },
    points:[],
    result:null,
    lastExamScreen:"beranda",
    meetingNo: 1,
  };

  /* ---------------- history (localStorage) ---------------- */
  const HKEY = "antarakala_theorist_history_v1";
  function loadHistory(){
    try{
      const raw = localStorage.getItem(HKEY);
      if(raw) return JSON.parse(raw);
    }catch(e){}
    return [
      { name:"Budi Santoso", id:"P-2026-8942", age:58, tier:"tinggi-pneumonia", temp:39.2, spo2:88, rr:42, chest:true, when:"12 Okt 2026" },
      { name:"Siti Rahmawati", id:"P-2026-8941", age:42, tier:"sedang-bronkiolitis", temp:37.8, spo2:94, rr:32, chest:true, when:"12 Okt 2026" },
      { name:"Agus Supriyanto", id:"P-2026-8938", age:29, tier:"rendah", temp:36.5, spo2:98, rr:20, chest:false, when:"11 Okt 2026" },
    ];
  }
  function saveHistory(list){ try{ localStorage.setItem(HKEY, JSON.stringify(list)); }catch(e){} }
  let history = loadHistory();

  /* ---------------- helpers ---------------- */
  const $  = (sel,root)=> (root||document).querySelector(sel);
  const $$ = (sel,root)=> Array.from((root||document).querySelectorAll(sel));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function rand(min,max){ return Math.random()*(max-min)+min; }

  function isScreenVisible(name){
    const el = $(`.screen[data-screen="${name}"]`);
    return !!(el && el.classList.contains("visible"));
  }

  function showToast(msg){
    const t = $("#toast");
    $("#toastText").textContent = msg;
    t.classList.add("show");
    clearTimeout(showToast._tm);
    showToast._tm = setTimeout(()=>t.classList.remove("show"), 2200);
  }

  /* ---------------- navigation ---------------- */
  /* Cuma "beranda" & "riwayat" yang punya tab bawah sendiri. Layar-layar alur
     pemeriksaan (input-pasien, auskultasi, dst) sengaja TIDAK dipetakan ke sini
     supaya tombol bottom-nav tidak salah menyala ke tab lain saat nakes sedang
     di tengah alur pemeriksaan. */
  const NAV_GROUP = {
    "beranda":"beranda",
    "riwayat":"riwayat",
  };

  const NAV_ITEMS = [
    { key:"beranda", label:"Home", target:"beranda",
      icon:'<path d="M3 11l9-8 9 8"/><path d="M5 10v9a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1v-9"/>' },
    { key:"riwayat", label:"History", target:"riwayat",
      icon:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>' },
    { key:"info", label:"Info", target:"__info__",
      icon:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r=".4" fill="currentColor"/>' },
  ];

  function renderBottomNav(){
    $$("[data-navbar]").forEach(nav=>{
      nav.innerHTML = NAV_ITEMS.map(it=>`
        <button class="nav-item" data-navkey="${it.key}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${it.icon}</svg>
          <span>${it.label}</span>
        </button>`).join("");
    });
  }

  function goTo(screenName){
    if(!screenName) return;
    $$(".screen").forEach(s=>s.classList.remove("visible"));
    const target = $(`.screen[data-screen="${screenName}"]`);
    if(!target){ return; }
    target.classList.add("visible");
    $("#appScroll").scrollTop = 0;
    const grp = NAV_GROUP[screenName];
    $$(".nav-item").forEach(b=>b.classList.toggle("active", b.dataset.navkey===grp));
    if(NAV_GROUP[screenName]==="pemeriksaan") state.lastExamScreen = screenName;
    afterNav(screenName);
    document.dispatchEvent(new CustomEvent("antarakala:phone-nav", { detail: { screen: screenName } }));
  }

  function afterNav(screenName){
    if(screenName==="beranda") renderBeranda();
    if(screenName==="proses-auskultasi") syncAuscultationScreen();
    if(screenName==="input-parameter") prefillParameter();
    if(screenName==="hasil-skrining") renderHasil();
    if(screenName==="penjelasan-ai") renderPenjelasan();
    if(screenName==="faktor-risiko") renderFaktorRisiko();
    if(screenName==="riwayat") renderRiwayat();
  }

  /* delegate all nav / action clicks */
  document.addEventListener("click", (e)=>{
    const navBtn = e.target.closest("[data-nav]");
    if(navBtn){ goTo(navBtn.dataset.nav); return; }

    const navItem = e.target.closest(".nav-item");
    if(navItem){
      const item = NAV_ITEMS.find(i=>i.key===navItem.dataset.navkey);
      if(item.target==="__info__"){
        handleAction("open-about");
      } else {
        goTo(item.target);
      }
      return;
    }

    const actionBtn = e.target.closest("[data-action]");
    if(actionBtn){ handleAction(actionBtn.dataset.action); return; }

    // segmented / option control selection
    const segBtn = e.target.closest(".seg button");
    if(segBtn){
      const seg = segBtn.closest(".seg");
      $$("button", seg).forEach(b=>b.classList.remove("selected"));
      segBtn.classList.add("selected");
      onSegChange(seg.id, segBtn.dataset.val);
      return;
    }
  });

  function handleAction(action){
    if(action==="open-about") $("#aboutModal").classList.add("visible");
    if(action==="close-about") $("#aboutModal").classList.remove("visible");
    if(action==="download-report") downloadReport();
    if(action==="export-csv") exportCsv();
    if(action==="save-finish") finishAndSave();
  }

  /* ---------------- BERANDA ---------------- */
  function renderBeranda(){
    $("#statPasien").textContent = history.length;
    $("#statBahaya").textContent = history.filter(h=>RESULT_TEXT[h.tier].cls==="high").length;
    const list = history.slice(0,3);
    $("#homeHistoryList").innerHTML = list.map(h=>historyItemHTML(h)).join("") ||
      `<p style="font-size:12.5px;color:var(--ink-300);">Belum ada riwayat pemeriksaan.</p>`;
  }

  function historyItemHTML(h){
    const rt = RESULT_TEXT[h.tier];
    const cls = rt.cls;
    return `<div class="history-item ${cls==='high'?'high':''}">
      <div class="num" style="background:${cls==='high'?'var(--red-600)':cls==='mid'?'var(--amber-600)':'var(--green-700)'}">${cls==="high"?"!":"✓"}</div>
      <div class="content">
        <h4>${h.name}</h4>
        <p>${rt.label.split(" - ")[1]||rt.label}</p>
        <span class="pill ${CLS_PILL[cls]}">${cls==='high'?"Rujukan":cls==='mid'?"Pemantauan":"Selesai"}</span>
      </div>
    </div>`;
  }

  /* ---------------- INPUT PASIEN ---------------- */
  function onSegChange(segId, val){
    if(segId==="pPCV") state.clinical.pcv = val;
    if(segId==="pWheeze") state.clinical.wheeze = val;
    validatePatientForm();
  }

  function validatePatientForm(){
    const p = state.patient, c = state.clinical;
    const ok = $("#pName").value.trim().length>1 && $("#pAge").value && c.pcv && c.wheeze;
    $("#btnLanjutEvaluasi").disabled = !ok;
  }
  $("#pName") && $("#pName").addEventListener("input", ()=>{ state.patient.name=$("#pName").value; validatePatientForm(); });
  $("#pAge") && $("#pAge").addEventListener("input", ()=>{ state.patient.age=$("#pAge").value; validatePatientForm(); });

  $("#btnLanjutEvaluasi") && $("#btnLanjutEvaluasi").addEventListener("click", ()=>{
    if($("#btnLanjutEvaluasi").disabled) return;
    goTo("panduan-auskultasi");
  });

  /* ---------------- PANDUAN → PROSES AUSKULTASI (disinkronkan dgn perangkat fisik) ---------------- */
  function renderPointList(activeIdx, mode){
    $("#pointList").innerHTML = POINTS.map((p,i)=>{
      const done = state.points[i];
      let cls = "point-row";
      if(i===activeIdx && (mode==="recording"||mode==="badsignal")) cls+=" active"; else if(done) cls+=" done";
      let statusHtml = "";
      if(done){
        const map = { crackle:["tag-crackle","Crackle"], wheeze:["tag-wheeze","Wheeze"], normal:["tag-normal","Normal"] };
        statusHtml = `<span class="point-status pill-tag ${map[done.result][0]}">${map[done.result][1]}</span>`;
      } else if(i===activeIdx && mode==="recording"){
        statusHtml = `<span class="point-status" style="color:var(--green-700)">Merekam…</span>`;
      } else if(i===activeIdx && mode==="badsignal"){
        statusHtml = `<span class="point-status pill-tag tag-wheeze">Sinyal lemah</span>`;
      }
      return `<div class="${cls}"><div class="point-num">${done?"✓":p.id}</div><div class="point-name">${p.id}. ${p.name}</div>${statusHtml}</div>`;
    }).join("");
    updateLanjutButton();
  }

  function updateLanjutButton(){
    const btn = $("#btnLanjutAuskultasi");
    if(!btn) return;
    const allDone = state.points.length===6 && state.points.every(p=>p && p.result);
    btn.disabled = !allDone;
  }

  function setTimerDisplay(pct, secLabel){
    $("#timerBarFill").style.width = (pct*100)+"%";
    $("#timerNum").textContent = secLabel;
  }

  function syncAuscultationScreen(){
    state.points = new Array(6).fill(null);
    const snap = window.AntarakalaDevice ? window.AntarakalaDevice.getSnapshot() : null;
    if(snap){
      snap.results.forEach((r,i)=>{ if(r) state.points[i] = { id:i+1, name:snap.pointNames[i], result:r.result }; });
      if(snap.state === "recording"){
        $("#activePointLabel").textContent = `Titik Aktif: ${snap.cursor+1}. ${snap.pointNames[snap.cursor]}`;
        renderPointList(snap.cursor, "recording");
      } else if(snap.state === "badsignal"){
        $("#activePointLabel").textContent = `⚠ Sinyal Lemah — Mengulang Titik ${snap.cursor+1}`;
        renderPointList(snap.cursor, "badsignal");
      } else if(snap.state === "allDone"){
        $("#activePointLabel").textContent = "✓ 6 Titik Selesai Direkam";
        renderPointList(-1, "waiting");
      } else {
        $("#activePointLabel").textContent = "Menunggu perangkat mulai merekam…";
        renderPointList(-1, "waiting");
      }
    } else {
      $("#activePointLabel").textContent = "Menunggu perangkat mulai merekam…";
      renderPointList(-1, "waiting");
    }
    setTimerDisplay(0, "00:00 / 00:15");
  }

  let phoneAusTimer = null;

  document.addEventListener("antarakala:point-start", (e)=>{
    const { index, name, duration } = e.detail;
    if(!isScreenVisible("proses-auskultasi")) return;
    $("#activePointLabel").textContent = `Titik Aktif: ${index+1}. ${name}`;
    renderPointList(index, "recording");
    let elapsed = 0;
    clearInterval(phoneAusTimer);
    phoneAusTimer = setInterval(()=>{
      elapsed += 100;
      const pct = clamp(elapsed/(duration*1000), 0, 1);
      const shown = Math.min(15, Math.ceil((elapsed/1000)*(15/duration)));
      setTimerDisplay(pct, `00:${String(shown).padStart(2,"0")} / 00:15`);
      if(elapsed >= duration*1000) clearInterval(phoneAusTimer);
    }, 100);
  });

  document.addEventListener("antarakala:signal-warning", (e)=>{
    if(!isScreenVisible("proses-auskultasi")) return;
    clearInterval(phoneAusTimer);
    $("#activePointLabel").textContent = `⚠ Sinyal Lemah — Mengulang Titik ${e.detail.index+1}`;
    setTimerDisplay(1, "Mengulang…");
    renderPointList(e.detail.index, "badsignal");
  });

  document.addEventListener("antarakala:point-result", (e)=>{
    const { index, name, result } = e.detail;
    state.points[index] = { id:index+1, name, result };
    if(isScreenVisible("proses-auskultasi")){
      renderPointList(index, "complete");
    }
  });

  document.addEventListener("antarakala:all-done", ()=>{
    if(!isScreenVisible("proses-auskultasi")) return;
    $("#activePointLabel").textContent = "✓ 6 Titik Selesai Direkam";
    setTimerDisplay(1, "00:15 / 00:15");
    renderPointList(-1, "waiting");
  });

  document.addEventListener("antarakala:reset", ()=>{
    if(isScreenVisible("proses-auskultasi")) syncAuscultationScreen();
  });

  $("#btnLanjutAuskultasi") && $("#btnLanjutAuskultasi").addEventListener("click", ()=>{
    if($("#btnLanjutAuskultasi").disabled) return;
    goTo("input-parameter");
  });

  /* ---------------- INPUT PARAMETER SKORING ---------------- */
  function prefillParameter(){
    const idNum = "884-" + String(291 + history.length).padStart(3,"0");
    $("#paramPatientLine").innerHTML = `Pasien: ${state.patient.name || "—"} (ID: ${idNum})<br>Pertemuan: #${13 + history.length}`;
    checkSpo2Warning();
  }
  function checkSpo2Warning(){
    const v = parseFloat($("#vSpo2").value);
    const warn = $("#spo2Warning");
    if(v && v < 90){
      warn.style.display = "flex";
      $("#spo2WarningText").textContent = `Pembacaan sebelumnya menunjukkan SpO2 pada ${v}%. Harap evaluasi ulang segera dan pastikan penempatan sensor akurat.`;
    } else {
      warn.style.display = "none";
    }
  }
  $("#vSpo2") && $("#vSpo2").addEventListener("input", checkSpo2Warning);

  $("#btnToProses") && $("#btnToProses").addEventListener("click", ()=>{
    state.vitals.temp = parseFloat($("#vTemp").value) || 36.8;
    state.vitals.spo2 = parseFloat($("#vSpo2").value) || 97;
    goTo("proses-ai");
    runAIProcessing();
  });

  /* ---------------- PROSES AI ---------------- */
  function runAIProcessing(){
    const rows = $$("#aiSteps .step-row");
    rows.forEach(r=>{ r.classList.remove("done","current"); $(".step-tag",r).textContent="ANTRIAN"; });
    let i=0;
    function next(){
      if(!isScreenVisible("proses-ai")) return;
      if(i>0){ rows[i-1].classList.remove("current"); rows[i-1].classList.add("done"); $(".step-tag",rows[i-1]).textContent="SELESAI"; }
      if(i>=rows.length){
        computeResult();
        setTimeout(()=>{ if(isScreenVisible("proses-ai")) goTo("hasil-skrining"); }, 450);
        return;
      }
      rows[i].classList.add("current");
      $(".step-tag",rows[i]).textContent="MEMPROSES";
      i++;
      setTimeout(next, 700);
    }
    next();
  }

  /* ---------------- SCORING SIMULATION (6-tier MTBS) ---------------- */
  function computeResult(){
    const p = state.patient, c = state.clinical, v = state.vitals;

    const crackleCount = state.points.filter(pt=>pt && pt.result==="crackle").length;
    const wheezeCount  = state.points.filter(pt=>pt && pt.result==="wheeze").length;

    const ageM = parseInt(p.age||"18",10);
    const rrThreshold = ageM < 2 ? 60 : (ageM <= 11 ? 50 : 40);
    const rrBias = crackleCount>=2 ? 16 : (crackleCount===1 ? 7 : (wheezeCount>=2 ? 10 : -5));
    const rrValue = Math.round(rrThreshold + rrBias + rand(-6,9));
    const rrScore = rrValue >= rrThreshold+10 ? 2 : (rrValue >= rrThreshold ? 1 : 0);

    const spo2Score = v.spo2 < 90 ? 3 : (v.spo2 <= 92 ? 2 : (v.spo2 <= 94 ? 1 : 0));
    const tempScore = v.temp >= 39 ? 3 : (v.temp >= 38 ? 2 : (v.temp >= 37.5 ? 1 : 0));

    // chest indrawing: auto-detected via simulasi sensor fusion IMU + akustik
    const chestIndrawing = v.spo2 < 92 || crackleCount >= 2 || Math.random() < 0.1;

    const override = v.spo2 < 90 || chestIndrawing;
    const severityTotal = spo2Score + tempScore + rrScore;

    let severity;
    if(override) severity = "tinggi";
    else if(severityTotal >= 4 || crackleCount>=1 || wheezeCount>=1) severity = "sedang";
    else severity = "rendah";

    let jenis = null;
    if(crackleCount>0 && crackleCount>=wheezeCount) jenis = "pneumonia";
    else if(wheezeCount>0 && c.wheeze==="ya") jenis = "asma";
    else if(wheezeCount>0) jenis = "bronkiolitis";

    let tier;
    if(severity==="rendah" || !jenis){ tier = "rendah"; severity="rendah"; }
    else if(jenis==="asma"){ tier = "sedang-asma"; severity="sedang"; }
    else if(jenis==="pneumonia"){ tier = severity==="tinggi" ? "tinggi-pneumonia" : "sedang-pneumonia"; }
    else { tier = severity==="tinggi" ? "tinggi-bronkiolitis" : "sedang-bronkiolitis"; }

    const confidence = severity==="tinggi" ? rand(91,98) : severity==="sedang" ? rand(80,91) : rand(74,88);
    const acousticLabel = crackleCount>wheezeCount ? "Crackle-dominant" : wheezeCount>crackleCount ? "Wheeze-dominant" : "Normal-dominant";

    const factors = [];
    factors.push({ label:`Oksigen ${v.spo2<95?"Rendah":"Normal"} (${v.spo2}%)`, weight:spo2Score/3*100, positive:spo2Score>0, skip:spo2Score===0 });
    factors.push({ label:"Tarikan Dinding Dada (Sensor Fusion)", weight:100, positive:true, skip:!chestIndrawing });
    factors.push({ label:`Bunyi Crackle Paru${crackleCount?` (${crackleCount} Titik)`:""}`, weight:crackleCount/6*100, positive:crackleCount>0, skip:crackleCount===0 });
    factors.push({ label:`Bunyi Wheeze Paru${wheezeCount?` (${wheezeCount} Titik)`:""}`, weight:wheezeCount/6*100, positive:wheezeCount>0, skip:wheezeCount===0 });
    factors.push({ label:`Demam (${v.temp.toFixed(1)}°C)`, weight:tempScore/3*100, positive:tempScore>0, skip:tempScore===0 });
    factors.push({ label:`Laju Napas Cepat (${rrValue}/mnt)`, weight:rrScore/2*100, positive:rrScore>0, skip:rrScore===0 });
    factors.push({ label:"Riwayat Wheezing Berulang", weight:55, positive: jenis==="asma", skip: c.wheeze!=="ya" });

    const finalFactors = factors.filter(f=>!f.skip).sort((a,b)=>b.weight-a.weight).slice(0,5);
    const sumW = finalFactors.reduce((s,f)=>s+f.weight,0) || 1;
    finalFactors.forEach(f=> f.relPct = Math.round((f.weight/sumW)*100));

    state.result = {
      tier, severity, jenis, confidence, chestIndrawing, override,
      crackleCount, wheezeCount, rrValue, rrThreshold, acousticLabel,
      factors: finalFactors,
    };
  }

  /* ---------------- HASIL SKRINING ---------------- */
  function renderHasil(){
    const r = state.result, v = state.vitals, p = state.patient;
    if(!r) return;
    const rt = RESULT_TEXT[r.tier];
    const banner = $("#resultBanner");
    banner.className = "result-banner " + rt.cls;
    $("#resultTitle").textContent = rt.label;
    $("#resultSub").textContent = rt.sub;
    $("#resultAcousticTag").textContent = "Label Akustik: " + r.acousticLabel;
    $("#resultPatientLine").innerHTML = `Pasien: An. ${p.name || "—"}<br>${p.age||"—"} Bulan`;

    const spo2Box = $("#critSpo2"); const rrBox = $("#critRR"); const tempBox = $("#critTemp"); const chestBox = $("#critChest");
    setCritBox(spo2Box, v.spo2+"%", v.spo2<90?"KRITIS / CRITICAL":v.spo2<95?"RENDAH / LOW":"NORMAL", v.spo2<90?"crit-red":v.spo2<95?"crit-amber":"crit-green");
    setCritBox(rrBox, r.rrValue+"<span>x/mnt</span>", r.rrValue>=r.rrThreshold+10?"CEPAT / FAST":r.rrValue>=r.rrThreshold?"CEPAT / FAST":"NORMAL", r.rrValue>=r.rrThreshold?"crit-red":"crit-green");
    setCritBox(tempBox, v.temp.toFixed(1)+"<span>°C</span>", v.temp>=38?"DEMAM / FEVER":"NORMAL", v.temp>=38?"crit-amber":"crit-green");
    setCritBox(chestBox, r.chestIndrawing?"Positif":"Negatif", r.chestIndrawing?"BAHAYA / DANGER":"NORMAL", r.chestIndrawing?"crit-red":"crit-green");

    $("#actionChecklist").innerHTML = rt.checklist.map(t=>`
      <label class="check-row"><input type="checkbox"><span>${t}</span></label>`).join("");
    $("#resultActionNote").textContent = rt.action;
  }
  function setCritBox(box, valHTML, tagText, cls){
    box.className = "crit-box " + cls;
    $(".crit-val", box).innerHTML = valHTML;
    $(".crit-tag", box).textContent = tagText;
  }

  /* ---------------- PENJELASAN AI ---------------- */
  function renderPenjelasan(){
    const r = state.result;
    if(!r) return;
    const rt = RESULT_TEXT[r.tier];
    const box = $("#aiConclusionBox");
    box.className = "alert " + (rt.cls==="high"?"alert-red":rt.cls==="mid"?"alert-amber":"alert-green");
    const top = r.factors.slice(0,3).map(f=>f.label.replace(/\s*\(.*?\)/,"").toLowerCase());
    $("#aiConclusionText").textContent =
      `Pasien dinilai ${CLS_LABEL[rt.cls]==="Tinggi"?"Risiko Tinggi":CLS_LABEL[rt.cls]==="Sedang"?"Risiko Sedang":"Risiko Rendah"} karena ditemukan ${top.join(", ")||"pola akustik & parameter klinis yang sesuai ambang normal"}. Kondisi ini menunjukkan ${rt.label.split(" - ")[1]||rt.label} yang ${rt.cls==="high"?"membutuhkan rujukan segera ke RS/IGD.":rt.cls==="mid"?"memerlukan terapi dan observasi ketat.":"tidak menunjukkan tanda LRTI signifikan."}`;
    drawSpectrogram(rt.cls, r.crackleCount);
  }

  function drawSpectrogram(cls, crackleCount){
    const canvas = $("#spectroCanvas");
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = "#070908";
    ctx.fillRect(0,0,W,H);

    const cols = 48, rows = 22;
    const cw = W/cols, ch = H/rows;
    const hotChance = cls==="high" ? 0.34 : cls==="mid" ? 0.20 : 0.08;

    for(let x=0;x<cols;x++){
      for(let y=0;y<rows;y++){
        const centerBias = 1 - Math.abs((y/rows)-0.5)*1.3;
        let v = Math.random()*0.5 + Math.random()*centerBias*0.5;
        if(Math.random() < hotChance*centerBias) v = 0.7 + Math.random()*0.3;
        const hue = v>0.62 ? lerpColor([201,54,74], [255,196,0], (v-0.62)/0.38) : lerpColor([12,70,60],[80,190,150], v/0.62);
        ctx.fillStyle = `rgb(${hue[0]},${hue[1]},${hue[2]})`;
        ctx.globalAlpha = 0.55 + v*0.45;
        ctx.fillRect(x*cw, H-(y+1)*ch, cw+0.6, ch+0.6);
      }
    }
    ctx.globalAlpha = 1;
  }
  function lerpColor(a,b,t){
    t = clamp(t,0,1);
    return [ Math.round(a[0]+(b[0]-a[0])*t), Math.round(a[1]+(b[1]-a[1])*t), Math.round(a[2]+(b[2]-a[2])*t) ];
  }

  /* ---------------- FAKTOR RISIKO ---------------- */
  function factorRowHTML(f){
    return `<div class="factor-row">
      <div class="factor-top"><b>${f.label}</b></div>
      <div class="factor-track"><div class="factor-fill ${f.positive? (f.weight>=70?'fill-high':'fill-mid') : 'fill-low'}" style="width:${f.weight}%"></div></div>
    </div>`;
  }

  function renderFaktorRisiko(){
    const r = state.result; if(!r) return;
    const rt = RESULT_TEXT[r.tier];
    $("#whyTitle").textContent = "Mengapa " + rt.acuTag + "?";
    $("#factorBars").innerHTML = r.factors.map(f=>factorRowHTML(f)).join("");
    $("#confidenceVal").textContent = r.confidence.toFixed(1)+"%";
  }

  /* ---------------- SAVE / FINISH ---------------- */
  function finishAndSave(){
    const r = state.result, p = state.patient, v = state.vitals;
    if(!r){ showToast("Belum ada hasil untuk disimpan"); return; }
    const entry = {
      name: p.name || "Pasien Tanpa Nama",
      id: "P-2026-" + String(9000+history.length),
      age: p.age || "—",
      tier: r.tier,
      temp: v.temp, spo2: v.spo2, rr: r.rrValue, chest: r.chestIndrawing,
      when: "Hari ini, " + nowHHMM(),
    };
    history.unshift(entry);
    saveHistory(history);
    showToast("Hasil pemeriksaan tersimpan ke riwayat");
    state.patient = { name:"", age:"" };
    state.clinical = { pcv:"", wheeze:"" };
    state.vitals = { temp:36.8, spo2:97 };
    state.points = new Array(6).fill(null);
    state.result = null;
    resetPatientForm();
    setTimeout(()=> goTo("beranda"), 300);
  }

  function resetPatientForm(){
    if($("#pName")) $("#pName").value = "";
    if($("#pAge")) $("#pAge").value = "";
    $$(".seg button").forEach(b=>b.classList.remove("selected"));
    if($("#vTemp")) $("#vTemp").value = "";
    if($("#vSpo2")) $("#vSpo2").value = "";
    validatePatientForm();
  }

  /* ---------------- RIWAYAT ---------------- */
  function riwayatCardHTML(h){
    const rt = RESULT_TEXT[h.tier];
    const borderColor = rt.cls==='high'?'var(--red-600)':rt.cls==='mid'?'var(--amber-600)':'var(--green-500)';
    return `<div class="hist-card" style="border-top-color:${borderColor}">
      <div class="hist-top">
        <div>
          <h4>${h.name}</h4>
          <p>ID: ${h.id}</p>
        </div>
        <span style="font-size:10.5px; color:var(--ink-300);">${h.when}</span>
      </div>
      <div class="hist-meta">
        <span>👤 ${h.age} Bulan</span>
        <span>📁 ${CLS_LABEL[rt.cls]}</span>
        <span class="pill ${CLS_PILL[rt.cls]}">${CLS_LABEL[rt.cls]}</span>
      </div>
      <div class="vital-grid" style="margin-top:9px;">
        <div class="vital-box"><div class="lab">SUHU</div><div class="val ${h.temp>=38?'val-danger':'val-ok'}">${h.temp.toFixed(1)}°C</div></div>
        <div class="vital-box"><div class="lab">SPO2</div><div class="val ${h.spo2<95?'val-danger':'val-ok'}">${h.spo2}%${h.spo2<95?' ↓':''}</div></div>
        <div class="vital-box"><div class="lab">LAJU NAPAS</div><div class="val">${h.rr}<span style="font-size:10px;"> x/min</span></div></div>
        <div class="vital-box"><div class="lab">RETRAKSI</div><div class="val ${h.chest?'val-danger':'val-ok'}">${h.chest?"Ya":"Tidak"}</div></div>
      </div>
    </div>`;
  }
  function renderRiwayat(list){
    const data = list || history;
    $("#riwayatList").innerHTML = data.map(riwayatCardHTML).join("") ||
      `<p style="font-size:12.5px;color:var(--ink-300);">Tidak ada data ditemukan.</p>`;
  }
  $("#searchRiwayat") && $("#searchRiwayat").addEventListener("input",(e)=>{
    const q = e.target.value.toLowerCase();
    renderRiwayat(history.filter(h=> h.name.toLowerCase().includes(q) || h.id.toLowerCase().includes(q)));
  });

  /* ---------------- EXPORT CSV ---------------- */
  function exportCsv(){
    if(!history.length){ showToast("Belum ada data riwayat"); return; }
    const header = "Nama,ID,Usia (Bulan),Tingkat Risiko,Suhu (C),SpO2 (%),Laju Napas (x/menit),Tarikan Dada,Waktu\n";
    const rows = history.map(h=>{
      const rt = RESULT_TEXT[h.tier];
      return [h.name, h.id, h.age, rt.label, h.temp.toFixed(1), h.spo2, h.rr, h.chest?"Ya":"Tidak", h.when].join(",");
    }).join("\n");
    const blob = new Blob([header+rows], {type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "Riwayat_ANTARAKALA.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Riwayat berhasil diekspor ke CSV");
  }

  /* ---------------- REPORT DOWNLOAD ---------------- */
  function downloadReport(){
    const r = state.result;
    if(!r){ showToast("Belum ada hasil untuk diunduh"); return; }
    const p = state.patient, v = state.vitals, rt = RESULT_TEXT[r.tier];
    const html = `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8">
    <title>Laporan Skrining ANTARAKALA — ${p.name||"Pasien"}</title>
    <style>
      body{font-family:Arial,sans-serif; max-width:640px; margin:40px auto; color:#151A18;}
      h1{color:#0E6E4A; font-size:22px; margin-bottom:2px;}
      .tag{display:inline-block; padding:6px 14px; border-radius:20px; font-weight:700; color:#fff; margin:10px 0 18px;
           background:${rt.cls==='high'?'#D9364A':rt.cls==='mid'?'#C98A00':'#0E6E4A'};}
      table{width:100%; border-collapse:collapse; margin-bottom:18px;}
      td{padding:7px 4px; border-bottom:1px solid #eee; font-size:13.5px;}
      td:first-child{color:#6B746F; width:45%;}
      h3{font-size:14px; color:#0E6E4A; margin:18px 0 8px;}
      .factor{display:flex; justify-content:space-between; font-size:13px; padding:5px 0; border-bottom:1px dashed #eee;}
      footer{margin-top:26px; font-size:11px; color:#9AA39D; line-height:1.6;}
    </style></head><body>
      <h1>Laporan Hasil Skrining — ANTARAKALA</h1>
      <div class="tag">${rt.label}</div>
      <table>
        <tr><td>Nama Pasien</td><td>${p.name||"—"}</td></tr>
        <tr><td>Usia</td><td>${p.age||"—"} bulan</td></tr>
        <tr><td>SpO2</td><td>${v.spo2}%</td></tr>
        <tr><td>Suhu Tubuh</td><td>${v.temp.toFixed(1)} °C</td></tr>
        <tr><td>Estimasi Laju Napas (Sensor IMU)</td><td>${r.rrValue}/menit (ambang usia: ${r.rrThreshold}/menit)</td></tr>
        <tr><td>Tarikan Dinding Dada (Sensor Fusion)</td><td>${r.chestIndrawing?"Positif":"Negatif"}</td></tr>
        <tr><td>Label Akustik CNN-LSTM</td><td>${r.acousticLabel}</td></tr>
        <tr><td>Rekomendasi Tindakan</td><td>${rt.action}</td></tr>
        <tr><td>Tingkat Kepercayaan AI</td><td>${r.confidence.toFixed(1)}%</td></tr>
      </table>
      <h3>Faktor Kontribusi Utama (SHAP)</h3>
      ${r.factors.map(f=>`<div class="factor"><span>${f.label}</span><span>${f.relPct}%</span></div>`).join("")}
      <footer>
        Dokumen ini dihasilkan oleh prototipe antarmuka ANTARAKALA untuk keperluan demonstrasi Lomba Esai Nasional THEORIST UKMP UNNES 2026.
        Seluruh nilai bersifat simulasi dan tidak merepresentasikan hasil diagnosis medis sesungguhnya.
        Dibuat: ${new Date().toLocaleString("id-ID")}
      </footer>
    </body></html>`;
    const blob = new Blob([html], {type:"text/html"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Laporan_ANTARAKALA_${(p.name||"pasien").replace(/\s+/g,"_")}.html`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Laporan berhasil diunduh");
  }

  /* ---------------- clock ---------------- */
  function nowHHMM(){
    const d = new Date();
    return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");
  }
  function tickClock(){ const el = $("#clock"); if(el) el.textContent = nowHHMM(); }

  /* ---------------- init ---------------- */
  function init(){
    renderBottomNav();
    goTo("beranda");
    tickClock();
    setInterval(tickClock, 15000);
    const grp = NAV_GROUP["beranda"];
    $$(".nav-item").forEach(b=>b.classList.toggle("active", b.dataset.navkey===grp));
  }

  document.addEventListener("DOMContentLoaded", init);
})();

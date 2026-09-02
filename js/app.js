/* ============================================================
   On the B.O.A.R.D  ·  학생선수 성장 포트폴리오
   서울체육중학교 다이빙부
   ============================================================ */
const sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

let ME = null;          // auth user
let PROFILE = null;     // profiles row
let MEMBERS = [];       // 부원 목록
let DIVES = [];         // 다이브 목록
let FB = {};            // dive_id -> feedback[]
let urlCache = {};      // 서명 URL 캐시
let charts = {};
let adminUnlocked = false;

const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, c =>
  ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

const TAGS = ["도약", "회전·공중", "입수", "신체정렬", "심리·루틴"];
const ROLE_KO = { self:"자기", peer:"동료", coach:"지도자", expert:"전문가" };

/* ---------- 시작 ---------- */
window.addEventListener("DOMContentLoaded", async () => {
  if (CONFIG.SUPABASE_URL.includes("여기에")) {
    alert("js/config.js 파일에 Supabase URL과 anon key를 먼저 입력하세요.");
  }
  bindUI();
  const { data } = await sb.auth.getSession();
  if (data.session) { await enterApp(data.session.user); }
});

/* ---------- 인증 ---------- */
function bindUI() {
  let mode = "login";
  $$("#authSeg .seg-btn").forEach(b => b.onclick = () => {
    $$("#authSeg .seg-btn").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    mode = b.dataset.mode;
    $("#signupOnly").classList.toggle("hidden", mode === "login");
    $("#authBtn").textContent = mode === "login" ? "로그인" : "가입하기";
  });

  $("#authBtn").onclick = async () => {
    const email = $("#authEmail").value.trim();
    const pw = $("#authPw").value;
    const msg = $("#authMsg");
    msg.className = "msg"; msg.textContent = "처리 중...";
    if (!email || pw.length < 6) { msg.className = "msg err"; msg.textContent = "이메일과 6자 이상 비밀번호를 입력하세요."; return; }

    if (mode === "login") {
      const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
      if (error) { msg.className = "msg err"; msg.textContent = "로그인 실패: " + error.message; return; }
      await enterApp(data.user);
    } else {
      const name = $("#authName").value.trim();
      if (!name) { msg.className = "msg err"; msg.textContent = "이름을 입력하세요."; return; }
      const { data, error } = await sb.auth.signUp({
        email, password: pw,
        options: { data: { name, grade: Number($("#authGrade").value) } }
      });
      if (error) { msg.className = "msg err"; msg.textContent = "가입 실패: " + error.message; return; }
      if (data.session) { await enterApp(data.user); }
      else { msg.className = "msg ok"; msg.textContent = "가입 완료. 메일 인증 후 로그인하세요."; }
    }
  };

  $("#logoutBtn").onclick = async () => { await sb.auth.signOut(); location.reload(); };

  $$("#tabs .tab").forEach(t => t.onclick = () => {
    $$("#tabs .tab").forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    $$(".panel").forEach(p => p.classList.add("hidden"));
    $("#tab-" + t.dataset.tab).classList.remove("hidden");
    if (t.dataset.tab === "growth") drawCharts();
  });

  // 슬라이더 표시값
  const pair = [["tension","vTension"],["confidence","vConf"],["sleep","vSleep"],
                ["sTakeoff","vTake"],["sFlight","vFlight"],["sEntry","vEntry"]];
  pair.forEach(([a,b]) => { const el = $("#"+a); if (el) el.oninput = () => $("#"+b).textContent = el.value; });

  $("#saveCheckin").onclick = saveCheckin;

  $$("#srcSeg .seg-btn").forEach(b => b.onclick = () => {
    $$("#srcSeg .seg-btn").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    $("#srcFile").classList.toggle("hidden", b.dataset.src !== "file");
    $("#srcLink").classList.toggle("hidden", b.dataset.src !== "link");
  });
  $("#submitDive").onclick = submitDive;

  ["fUser","fContext"].forEach(id => $("#"+id).onchange = renderDives);
  $("#fNo").oninput = renderDives;

  $("#adminEnter").onclick = adminLogin;
  $("#ntSave").onclick = saveNotice;
  $("#expDives").onclick = () => exportCSV("dives");
  $("#expFb").onclick = () => exportCSV("feedbacks");
  $("#expCk").onclick = () => exportCSV("checkins");

  $("#cmpA").onchange = () => loadCmp("A");
  $("#cmpB").onchange = () => loadCmp("B");
  $("#cmpPlay").onclick = () => {
    const a = $("#vidA"), b = $("#vidB");
    if (a.paused) { a.play(); b.play(); } else { a.pause(); b.pause(); }
  };
  $("#cmpSlow").onclick = () => {
    const r = $("#vidA").playbackRate === 1 ? 0.25 : 1;
    $("#vidA").playbackRate = r; $("#vidB").playbackRate = r;
    $("#cmpSlow").textContent = r === 1 ? "0.25배속" : "정상속도";
  };
  $("#cmpReset").onclick = () => { $("#vidA").currentTime = 0; $("#vidB").currentTime = 0; };

  $("#dvDate").value = new Date().toISOString().slice(0, 10);
}

async function enterApp(user) {
  ME = user;
  const { data: p } = await sb.from("profiles").select("*").eq("id", user.id).single();
  PROFILE = p || { name: "이름미입력", role: "student" };
  $("#authView").classList.add("hidden");
  $("#appView").classList.remove("hidden");
  $("#whoami").textContent = PROFILE.name + (PROFILE.role === "admin" ? " · 지도교사" : " · 선수");
  await loadAll();
  subscribeRealtime();
}

/* ---------- 데이터 로드 ---------- */
async function loadAll() {
  const [m, d, f, n] = await Promise.all([
    sb.from("profiles").select("*").order("grade"),
    sb.from("dives").select("*").order("dive_date", { ascending: false }).order("id", { ascending: false }),
    sb.from("feedbacks").select("*").order("created_at"),
    sb.from("notices").select("*").order("created_at", { ascending: false }).limit(10)
  ]);
  MEMBERS = m.data || [];
  DIVES = d.data || [];
  FB = {};
  (f.data || []).forEach(x => { (FB[x.dive_id] = FB[x.dive_id] || []).push(x); });

  const sel = $("#fUser");
  sel.innerHTML = '<option value="">전체 선수</option>' +
    MEMBERS.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join("");

  $("#noticeList").innerHTML = (n.data || []).length
    ? (n.data).map(x => `<div><div class="t">${esc(x.title)}</div>
        <div class="m">${x.created_at.slice(0,10)}</div>
        <div>${esc(x.body || "")}</div></div>`).join("")
    : '<div class="m">등록된 공지가 없습니다.</div>';

  renderKPI();
  renderDives();
  fillCmpSelect();
  await loadTodayCheckin();
}

function renderKPI() {
  const mine = DIVES.filter(d => d.user_id === ME.id);
  const maxDD = mine.reduce((a, b) => Math.max(a, Number(b.dd) || 0), 0);
  const fbCount = Object.values(FB).flat().filter(x => x.user_id === ME.id).length;
  const comp = mine.filter(d => d.context === "competition").length;
  $("#kpiRow").innerHTML = `
    <div class="kpi"><div class="k">내 다이브 기록</div><div class="v">${mine.length}</div><div class="s">누적 등록 수</div></div>
    <div class="kpi"><div class="k">최고 난이도</div><div class="v">${maxDD ? maxDD.toFixed(1) : "-"}</div><div class="s">DD</div></div>
    <div class="kpi"><div class="k">작성한 피드백</div><div class="v">${fbCount}</div><div class="s">자기·동료 포함</div></div>
    <div class="kpi"><div class="k">대회 수행</div><div class="v">${comp}</div><div class="s">경기 영상 수</div></div>`;
}

/* ---------- 컨디션 체크인 ---------- */
async function loadTodayCheckin() {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await sb.from("checkins").select("*")
    .eq("user_id", ME.id).eq("ck_date", today).maybeSingle();
  if (!data) return;
  ["r1","r2","r3","r4"].forEach(k => $("#"+k).checked = !!data[k]);
  $("#tension").value = data.tension || 5;   $("#vTension").textContent = data.tension || 5;
  $("#confidence").value = data.confidence || 5; $("#vConf").textContent = data.confidence || 5;
  $("#sleep").value = data.sleep_h || 7;     $("#vSleep").textContent = data.sleep_h || 7;
  $("#ckNote").value = data.note || "";
}

async function saveCheckin() {
  const row = {
    user_id: ME.id, ck_date: new Date().toISOString().slice(0, 10),
    r1: $("#r1").checked, r2: $("#r2").checked, r3: $("#r3").checked, r4: $("#r4").checked,
    tension: Number($("#tension").value), confidence: Number($("#confidence").value),
    sleep_h: Number($("#sleep").value), note: $("#ckNote").value.trim()
  };
  const { error } = await sb.from("checkins").upsert(row, { onConflict: "user_id,ck_date" });
  const m = $("#ckMsg");
  m.className = error ? "msg inline err" : "msg inline ok";
  m.textContent = error ? "저장 실패: " + error.message : "저장되었습니다.";
  setTimeout(() => m.textContent = "", 2500);
}

/* ---------- 다이브 등록 ---------- */
async function submitDive() {
  const msg = $("#upMsg");
  const useFile = $("#srcSeg .seg-btn.active").dataset.src === "file";
  const file = $("#dvFile").files[0];
  const link = $("#dvUrl").value.trim();

  if (useFile && !file) { msg.className = "msg err"; msg.textContent = "영상 파일을 선택하세요."; return; }
  if (!useFile && !link) { msg.className = "msg err"; msg.textContent = "영상 링크를 입력하세요."; return; }
  if (useFile && file.size > CONFIG.MAX_UPLOAD_MB * 1024 * 1024) {
    msg.className = "msg err";
    msg.textContent = `파일이 ${CONFIG.MAX_UPLOAD_MB}MB를 넘습니다. 편집해서 올리거나 링크 방식을 쓰세요.`;
    return;
  }

  $("#submitDive").disabled = true;
  msg.className = "msg"; msg.textContent = "업로드 중...";
  let path = null;

  if (useFile) {
    $("#upWrap").classList.remove("hidden");
    $("#upBar").style.width = "35%";
    const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
    path = `${ME.id}/${Date.now()}.${ext}`;
    const { error } = await sb.storage.from(CONFIG.BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) {
      msg.className = "msg err"; msg.textContent = "업로드 실패: " + error.message;
      $("#submitDive").disabled = false; $("#upWrap").classList.add("hidden"); return;
    }
    $("#upBar").style.width = "80%";
  }

  const row = {
    user_id: ME.id,
    dive_date: $("#dvDate").value || new Date().toISOString().slice(0, 10),
    context: $("#dvContext").value,
    comp_name: $("#dvComp").value.trim() || null,
    apparatus: $("#dvApparatus").value,
    dive_no: $("#dvNo").value.trim() || null,
    dd: $("#dvDD").value ? Number($("#dvDD").value) : null,
    stage: Number($("#dvStage").value),
    s_takeoff: Number($("#sTakeoff").value),
    s_flight: Number($("#sFlight").value),
    s_entry: Number($("#sEntry").value),
    r_good: $("#rGood").value.trim() || null,
    r_improve: $("#rImprove").value.trim() || null,
    r_goal: $("#rGoal").value.trim() || null,
    video_path: path, video_url: useFile ? null : link
  };
  const { error } = await sb.from("dives").insert(row);
  $("#upBar").style.width = "100%";
  $("#submitDive").disabled = false;

  if (error) { msg.className = "msg err"; msg.textContent = "저장 실패: " + error.message; return; }
  msg.className = "msg ok"; msg.textContent = "등록되었습니다. 피드백 탭에서 확인하세요.";
  ["dvNo","dvDD","rGood","rImprove","rGoal","dvUrl"].forEach(id => $("#"+id).value = "");
  $("#dvFile").value = "";
  setTimeout(() => { $("#upWrap").classList.add("hidden"); $("#upBar").style.width = "0"; }, 800);
  await loadAll();
}

/* ---------- 영상 주소 ---------- */
async function videoSrc(d) {
  if (d.video_url) return { type: "link", src: d.video_url };
  if (!d.video_path) return { type: "none", src: "" };
  if (urlCache[d.id]) return { type: "file", src: urlCache[d.id] };
  const { data } = await sb.storage.from(CONFIG.BUCKET).createSignedUrl(d.video_path, 3600);
  if (!data) return { type: "none", src: "" };
  urlCache[d.id] = data.signedUrl;
  return { type: "file", src: data.signedUrl };
}
function ytEmbed(u) {
  const m = u.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/);
  return m ? "https://www.youtube.com/embed/" + m[1] : null;
}

/* ---------- 피드백 목록 ---------- */
function renderDives() {
  const fu = $("#fUser").value, fc = $("#fContext").value, fn = $("#fNo").value.trim().toLowerCase();
  const list = DIVES.filter(d =>
    (!fu || d.user_id === fu) && (!fc || d.context === fc) &&
    (!fn || (d.dive_no || "").toLowerCase().includes(fn)));

  const box = $("#diveList");
  if (!list.length) { box.innerHTML = '<div class="card m">조건에 맞는 기록이 없습니다.</div>'; return; }
  box.innerHTML = list.map(d => diveCard(d)).join("");
  list.forEach(d => mountDive(d));
}

function diveCard(d) {
  const who = (MEMBERS.find(m => m.id === d.user_id) || {}).name || "선수";
  const isComp = d.context === "competition";
  return `<article class="dive" id="dive-${d.id}">
    <div class="dive-head">
      <div>
        <div class="dive-title">${esc(d.dive_no || "기술번호 미입력")} ${d.dd ? "· DD " + Number(d.dd).toFixed(1) : ""}</div>
        <div class="dive-meta">${esc(who)} · ${d.dive_date} · ${esc(d.apparatus || "")}</div>
      </div>
      <div class="tagline">
        <span class="tag ${isComp ? "comp" : ""}">${isComp ? esc(d.comp_name || "대회") : "훈련"}</span>
        <span class="tag">${d.stage}단계</span>
      </div>
    </div>
    <div id="player-${d.id}"></div>
    <div class="ctrl" id="ctrl-${d.id}"></div>
    <div class="scores">
      <span>도약 ${d.s_takeoff ?? "-"}</span><span>회전 ${d.s_flight ?? "-"}</span><span>입수 ${d.s_entry ?? "-"}</span>
    </div>
    ${(d.r_good || d.r_improve || d.r_goal) ? `<div class="reflect">
      ${d.r_good ? `<div><span>잘된 점 · </span>${esc(d.r_good)}</div>` : ""}
      ${d.r_improve ? `<div><span>개선할 점 · </span>${esc(d.r_improve)}</div>` : ""}
      ${d.r_goal ? `<div><span>다음 목표 · </span>${esc(d.r_goal)}</div>` : ""}
    </div>` : ""}
    <div class="fb">
      <div id="fblist-${d.id}"></div>
      <div class="fb-form">
        <select id="fbtag-${d.id}">${TAGS.map(t => `<option>${t}</option>`).join("")}</select>
        <input type="text" id="fbtext-${d.id}" placeholder="피드백을 입력하세요 (재생 위치가 함께 저장됩니다)">
        <button class="btn primary" onclick="addFB(${d.id})">등록</button>
      </div>
    </div>
    ${(d.user_id === ME.id || PROFILE.role === "admin")
      ? `<button class="btn sm danger" style="margin-top:8px" onclick="delDive(${d.id})">이 기록 삭제</button>` : ""}
  </article>`;
}

async function mountDive(d) {
  const v = await videoSrc(d);
  const box = document.getElementById("player-" + d.id);
  if (!box) return;
  if (v.type === "file") {
    box.innerHTML = `<video id="v-${d.id}" src="${v.src}" controls playsinline preload="metadata"></video>`;
    document.getElementById("ctrl-" + d.id).innerHTML = `
      <button class="btn" onclick="rate(${d.id},0.25)">0.25x</button>
      <button class="btn" onclick="rate(${d.id},0.5)">0.5x</button>
      <button class="btn" onclick="rate(${d.id},1)">1x</button>
      <button class="btn ghost" onclick="step(${d.id},-0.05)">◀ 프레임</button>
      <button class="btn ghost" onclick="step(${d.id},0.05)">프레임 ▶</button>`;
  } else if (v.type === "link") {
    const em = ytEmbed(v.src);
    box.innerHTML = em
      ? `<iframe width="100%" height="240" style="border:0;border-radius:6px" src="${em}" allowfullscreen></iframe>`
      : `<a href="${esc(v.src)}" target="_blank" rel="noopener" class="btn">영상 링크 열기</a>`;
  } else {
    box.innerHTML = '<div class="m">영상이 없습니다.</div>';
  }
  renderFB(d.id);
}

window.rate = (id, r) => { const v = document.getElementById("v-" + id); if (v) v.playbackRate = r; };
window.step = (id, s) => { const v = document.getElementById("v-" + id); if (v) { v.pause(); v.currentTime = Math.max(0, v.currentTime + s); } };
window.seek = (id, t) => { const v = document.getElementById("v-" + id); if (v) { v.currentTime = t; v.play(); } };

function renderFB(diveId) {
  const box = document.getElementById("fblist-" + diveId);
  if (!box) return;
  const list = FB[diveId] || [];
  if (!list.length) { box.innerHTML = '<div class="m">첫 피드백을 남겨보세요.</div>'; return; }
  box.innerHTML = list.map(f => {
    const who = (MEMBERS.find(m => m.id === f.user_id) || {}).name || "익명";
    const ts = f.ts_sec != null
      ? `<button class="fb-ts" onclick="seek(${diveId},${f.ts_sec})">${Number(f.ts_sec).toFixed(1)}초</button>` : "";
    return `<div class="fb-item">${ts}<div>
      <span class="fb-who">${esc(who)}</span>
      <span class="tag">${esc(ROLE_KO[f.role_label] || f.role_label)}</span>
      <span class="tag">${esc(f.tag || "")}</span><br>${esc(f.body)}</div></div>`;
  }).join("");
}

window.addFB = async (diveId) => {
  const input = document.getElementById("fbtext-" + diveId);
  const body = input.value.trim();
  if (!body) return;
  const v = document.getElementById("v-" + diveId);
  const dive = DIVES.find(x => x.id === diveId);
  const roleLabel = PROFILE.role === "admin" ? "coach" : (dive && dive.user_id === ME.id ? "self" : "peer");
  const { error } = await sb.from("feedbacks").insert({
    dive_id: diveId, user_id: ME.id,
    ts_sec: v ? Number(v.currentTime.toFixed(1)) : null,
    tag: document.getElementById("fbtag-" + diveId).value,
    role_label: roleLabel, body
  });
  if (error) { alert("등록 실패: " + error.message); return; }
  input.value = "";
};

window.delDive = async (id) => {
  if (!confirm("이 기록을 삭제할까요? 되돌릴 수 없습니다.")) return;
  const d = DIVES.find(x => x.id === id);
  if (d && d.video_path) await sb.storage.from(CONFIG.BUCKET).remove([d.video_path]);
  const { error } = await sb.from("dives").delete().eq("id", id);
  if (error) { alert("삭제 실패: " + error.message); return; }
  await loadAll();
};

/* ---------- 실시간 ---------- */
function subscribeRealtime() {
  sb.channel("board-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "feedbacks" }, async (p) => {
      const row = p.new || p.old;
      if (!row) return;
      if (p.eventType === "INSERT") { (FB[row.dive_id] = FB[row.dive_id] || []).push(row); }
      if (p.eventType === "DELETE") { FB[row.dive_id] = (FB[row.dive_id] || []).filter(x => x.id !== row.id); }
      renderFB(row.dive_id);
      renderKPI();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "dives" }, async () => { await loadAll(); })
    .on("postgres_changes", { event: "*", schema: "public", table: "notices" }, async () => { await loadAll(); })
    .subscribe(status => {
      $("#liveDot").classList.toggle("on", status === "SUBSCRIBED");
    });
}

/* ---------- 성장 분석 ---------- */
function mkChart(id, cfg) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(document.getElementById(id), cfg);
}

async function drawCharts() {
  const mine = DIVES.filter(d => d.user_id === ME.id).slice().reverse();

  // DD 추이 (월별 최고 난이도)
  const byMonth = {};
  mine.forEach(d => {
    if (!d.dd) return;
    const k = d.dive_date.slice(0, 7);
    byMonth[k] = Math.max(byMonth[k] || 0, Number(d.dd));
  });
  const mk = Object.keys(byMonth).sort();
  mkChart("ddChart", {
    type: "line",
    data: {
      labels: mk,
      datasets: [{
        label: "월별 최고 DD", data: mk.map(k => byMonth[k]),
        borderColor: "#1d4ed8", backgroundColor: "rgba(29,78,216,.08)",
        fill: true, tension: .25, pointRadius: 4
      }]
    },
    options: { responsive: true, maintainAspectRatio: false,
      scales: { y: { beginAtZero: false, title: { display: true, text: "DD" } } } }
  });

  // 분절 평균
  const seg = ["s_takeoff", "s_flight", "s_entry"];
  const labels = ["도약", "회전·공중", "입수"];
  const half = Math.ceil(mine.length / 2);
  const avg = (arr, k) => arr.length ? arr.reduce((a, b) => a + (b[k] || 0), 0) / arr.length : 0;
  mkChart("segChart", {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "초기 절반", data: seg.map(k => avg(mine.slice(0, half), k).toFixed(2)), backgroundColor: "#93b4f5" },
        { label: "최근 절반", data: seg.map(k => avg(mine.slice(half), k).toFixed(2)), backgroundColor: "#1d4ed8" }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 10 } } }
  });

  // 심리 변화
  const { data: cks } = await sb.from("checkins").select("*")
    .eq("user_id", ME.id).order("ck_date").limit(90);
  const c = cks || [];
  mkChart("psyChart", {
    type: "line",
    data: {
      labels: c.map(x => x.ck_date.slice(5)),
      datasets: [
        { label: "긴장도", data: c.map(x => x.tension), borderColor: "#b45309", pointRadius: 2, tension: .25 },
        { label: "자신감", data: c.map(x => x.confidence), borderColor: "#15803d", pointRadius: 2, tension: .25 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 10 } } }
  });
}

function fillCmpSelect() {
  const mine = DIVES.filter(d => d.user_id === ME.id && d.video_path);
  const opt = mine.map(d => `<option value="${d.id}">${d.dive_date} · ${esc(d.dive_no || "-")}</option>`).join("");
  $("#cmpA").innerHTML = '<option value="">초기 영상 선택</option>' + opt;
  $("#cmpB").innerHTML = '<option value="">최근 영상 선택</option>' + opt;
}
async function loadCmp(side) {
  const id = Number($("#cmp" + side).value);
  const d = DIVES.find(x => x.id === id);
  if (!d) return;
  const v = await videoSrc(d);
  $("#vid" + side).src = v.src;
}

/* ---------- 관리자 ---------- */
async function sha256(t) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function adminLogin() {
  const msg = $("#adminMsg");
  const { data, error } = await sb.from("app_config").select("admin_pw_hash").eq("id", 1).single();
  if (error) { msg.className = "msg err"; msg.textContent = "설정을 불러오지 못했습니다."; return; }
  const h = await sha256($("#adminPw").value);
  if (h !== data.admin_pw_hash) { msg.className = "msg err"; msg.textContent = "비밀번호가 일치하지 않습니다."; return; }
  if (PROFILE.role !== "admin") {
    msg.className = "msg err";
    msg.textContent = "비밀번호는 맞지만 이 계정에 관리자 권한이 없습니다. Supabase에서 role을 admin으로 지정하세요.";
    return;
  }
  adminUnlocked = true;
  $("#adminPw").value = "";
  $("#adminLock").classList.add("hidden");
  $("#adminBody").classList.remove("hidden");
  renderAdmin();
}

function renderAdmin() {
  $("#memberList").innerHTML = MEMBERS.map(m => `
    <div><div class="t">${esc(m.name)} <span class="tag">${m.grade}학년</span>
      <span class="tag">${m.role === "admin" ? "지도교사" : "선수"}</span></div>
      <div class="m">기록 ${DIVES.filter(d => d.user_id === m.id).length}건</div>
      <button class="btn sm" onclick="toggleRole('${m.id}','${m.role}')">
        ${m.role === "admin" ? "선수로 변경" : "관리자로 변경"}</button></div>`).join("");

  $("#adminDives").innerHTML = DIVES.slice(0, 60).map(d => {
    const who = (MEMBERS.find(m => m.id === d.user_id) || {}).name || "-";
    return `<div><div class="t">${esc(who)} · ${esc(d.dive_no || "-")} ${d.dd ? "DD " + d.dd : ""}</div>
      <div class="m">${d.dive_date} · ${d.context === "competition" ? "대회" : "훈련"} · 피드백 ${(FB[d.id] || []).length}건</div>
      <button class="btn sm danger" onclick="delDive(${d.id})">삭제</button></div>`;
  }).join("");
}

window.toggleRole = async (id, cur) => {
  const next = cur === "admin" ? "student" : "admin";
  if (!confirm(`권한을 ${next === "admin" ? "관리자" : "선수"}로 변경할까요?`)) return;
  const { error } = await sb.from("profiles").update({ role: next }).eq("id", id);
  if (error) { alert("변경 실패: " + error.message); return; }
  await loadAll(); renderAdmin();
};

async function saveNotice() {
  const title = $("#ntTitle").value.trim();
  if (!title) return;
  const { error } = await sb.from("notices").insert({ title, body: $("#ntBody").value.trim() });
  if (error) { alert("등록 실패: " + error.message); return; }
  $("#ntTitle").value = ""; $("#ntBody").value = "";
  await loadAll();
}

async function exportCSV(table) {
  const { data, error } = await sb.from(table).select("*");
  if (error || !data || !data.length) { alert("내보낼 데이터가 없습니다."); return; }
  const nameOf = {};
  MEMBERS.forEach(m => nameOf[m.id] = m.name);
  const keys = Object.keys(data[0]);
  const head = keys.join(",") + ",이름";
  const rows = data.map(r => keys.map(k => {
    const v = r[k] == null ? "" : String(r[k]).replace(/"/g, '""');
    return `"${v}"`;
  }).join(",") + `,"${nameOf[r.user_id] || ""}"`);
  const csv = "\uFEFF" + head + "\n" + rows.join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `board_${table}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

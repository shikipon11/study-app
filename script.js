import {
initializeApp } from

"https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
getDatabase, ref, set, get, onValue } from


"https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAWz3ZCFdEUdVVEtLhun-Sf_8ZvNRkzB9s",
  authDomain: "study-game-app-cdf53.firebaseapp.com",
  databaseURL: "https://study-game-app-cdf53-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "study-game-app-cdf53",
  storageBucket: "study-game-app-cdf53.firebasestorage.app",
  messagingSenderId: "830965015838",
  appId: "1:830965015838:web:acc3f28ca9453289ff150f" };



// ===== 基本データ =====
let level = 1;
let xp = 0;
let maxXp = 100;
let totalXp = 0;
let subjects = ["数学", "英語"];
let subjectColors = {
  数学: "#42a5f5",
  英語: "#ff69b4" };

let timerStart = null;
let timerInterval = null;
let userId = localStorage.getItem("userId");
if (!userId) {
  userId = crypto.randomUUID();
  localStorage.setItem("userId", userId);
}
// 教科ごとのやることリスト（日付ごと）
let todosByDate = {};
let records = [];

// ===== カレンダー表示用 =====
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0〜11

// ===== レベルごとの必要XP計算（ゆるカーブ） =====
function calcMaxXp(level) {
  return Math.min(Math.floor(100 + Math.pow(level, 1.2) * 10), 1200);
}

// ===== DOM =====
const mainPage = document.getElementById("main-page");
const recordsPage = document.getElementById("records-page");
const rivalPage = document.getElementById("rival-page");
const subjectSelect = document.getElementById("subject");
const todoSubjectSelect = document.getElementById("todo-subject");
const recordMsg = document.getElementById("record-msg");
const deleteSubjectSelect = document.getElementById("delete-subject"); // ←削除用セレクト
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const roomInput = document.getElementById("roomInput");
const nameInput = document.getElementById("nameInput");
const joinBtn = document.getElementById("joinRoomBtn");
const timerBtn = document.getElementById("timer-button");
const timerModal = document.getElementById("timer-modal");
const timerDisplay = document.getElementById("timer-display");
const timerSubject = document.getElementById("timer-subject");
const stopTimerBtn = document.getElementById("stop-timer");
const cancelTimerBtn = document.getElementById("cancel-timer");

// ===== ローカルストレージ =====
function saveData() {
  const data = {
    level, xp, totalXp, subjects, subjectColors, records, todosByDate };

  localStorage.setItem("studyGameData", JSON.stringify(data));
}

function loadData() {
  const data = JSON.parse(localStorage.getItem("studyGameData"));
  if (!data) return;

  level = data.level || 1;
  xp = data.xp || 0;
  totalXp = data.totalXp || 0;
  subjects = data.subjects || ["数学", "英語"];
  subjectColors = data.subjectColors || {};

  // 初期教科の色を保証
  if (!subjectColors["数学"]) subjectColors["数学"] = "#42a5f5";
  if (!subjectColors["英語"]) subjectColors["英語"] = "#ff69b4";

  todosByDate = data.todosByDate || {};

  records = (data.records || []).map(r => ({
    id: r.id,
    subject: r.subject,
    time: r.time,
    date: new Date(r.date) }));



  maxXp = calcMaxXp(level);
}
// 初期教科の色を保証する関数
function ensureInitialSubjects() {
  const initialSubjects = {
    数学: "#42a5f5",
    英語: "#ef5350" };


  for (const [sub, color] of Object.entries(initialSubjects)) {
    if (!subjects.includes(sub)) subjects.push(sub);
    if (!subjectColors[sub]) subjectColors[sub] = color;
  }
}

function fixTotalXpIfNeeded() {
  if (totalXp > 0) return; // すでにあるなら何もしない
  if (!records || records.length === 0) return;

  totalXp = records.reduce((sum, r) => sum + r.time, 0);
  saveData();
}

//=========部屋=========
function showRoomMessage(text, type = "success") {
  const msg = document.getElementById("roomMsg");
  msg.textContent = text;
  msg.style.color = type === "error" ? "red" : "green";

  setTimeout(() => {
    msg.textContent = "";
  }, 2000);
}
const savedName = localStorage.getItem("userName");
if (savedName) {
  nameInput.value = savedName;
}
const savedRoom = localStorage.getItem("currentRoom");
if (savedRoom) {
  roomInput.value = savedRoom;
}
if (savedRoom && savedName) {
  watchRoom(savedRoom);
}
joinBtn.onclick = async () => {
  const roomId = roomInput.value.trim();
  const userName = nameInput.value.trim();

  // 4桁数字チェック
  if (!/^\d{4}$/.test(roomId)) {
    showRoomMessage("部屋番号は4桁の数字にしてね", "error");
    return;
  }

  if (!roomId || !userName) {
    alert("部屋番号と名前を入力してね");
    return;
  }

  const roomRef = ref(db, "rooms/" + roomId);

  try {
    // Firebaseから部屋情報取得
    const snapshot = await get(roomRef);
    const data = snapshot.val();

    // 同じ名前が存在するかチェック
    // 同じ名前の他人がいるかチェック
    if (data) {
      const sameNameUser = Object.entries(data).find(
      ([uid, user]) => user.name === userName && uid !== userId);


      if (sameNameUser) {
        showRoomMessage("同じ名前の人がいるから入れないよ", "error");
        return;
      }
    }


    // 名前と部屋をローカル保存
    localStorage.setItem("userName", userName);
    localStorage.setItem("currentRoom", roomId);

    // XP同期＆部屋監視開始
    syncXPToRoom();
    watchRoom(roomId);

    showRoomMessage("入室できたよ！", "success");
  } catch (err) {
    // エラー発生時
    console.error(err);
    showRoomMessage("部屋に接続できませんでした", "error");
  }
};
let rankingMode = "total"; // total / today / week

function refreshRanking() {
  const roomId = localStorage.getItem("currentRoom");
  if (!roomId) return;

  const roomRef = ref(db, "rooms/" + roomId);
  onValue(roomRef, snapshot => {
    const data = snapshot.val();
    updateRanking(data);
  });
}

// ボタン
document.getElementById("rank-today").onclick = () => {
  rankingMode = "today";
  refreshRanking();
};
document.getElementById("rank-week").onclick = () => {
  rankingMode = "week";
  refreshRanking();
};
document.getElementById("rank-total").onclick = () => {
  rankingMode = "total";
  refreshRanking();
};

// XP・recordsをFirebaseに同期
function syncXPToRoom() {
  const roomId = localStorage.getItem("currentRoom");
  const userName = localStorage.getItem("userName");
  if (!roomId || !userName) return;

  // 今回はrecordsも同期
  const userRecords = {};
  records.forEach(r => {
    userRecords[r.id] = {
      subject: r.subject,
      time: r.time,
      date: r.date.toISOString() };


  });

  set(ref(db, "rooms/" + roomId + "/" + userId), {
    name: userName,
    xp,
    totalXp,
    records: userRecords });



}
const buttons = document.querySelectorAll("#ranking-buttons button");
buttons.forEach(btn => {
  btn.addEventListener("click", () => {
    buttons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

// 部屋を監視
function watchRoom(roomId) {
  const roomRef = ref(db, "rooms/" + roomId);
  onValue(roomRef, snapshot => {
    const data = snapshot.val();
    updateRanking(data);
  });
}

// ランキング更新
function updateRanking(data) {
  const rankingBox = document.getElementById("rankingBox");
  if (!data) {
    rankingBox.innerHTML = "まだ誰もいません";
    return;
  }

  const users = Object.entries(data).map(([uid, userData]) => {
    let value = 0;

    if (rankingMode === "total") {
      value = userData.totalXp || 0;
    } else if (rankingMode === "today") {
      const today = new Date();
      value = Object.values(userData.records || {}).
      filter(r => sameDate(new Date(r.date), today)).
      reduce((sum, r) => sum + r.time, 0);
    } else if (rankingMode === "week") {
      const today = new Date();
      const sunday = new Date(today);
      sunday.setDate(today.getDate() - today.getDay());
      value = Object.values(userData.records || {}).
      filter(r => new Date(r.date) >= sunday).
      reduce((sum, r) => sum + r.time, 0);
    }

    return {
      name: userData.name || "no-name",
      value };


  });

  users.sort((a, b) => b.value - a.value);

  rankingBox.innerHTML = "";
  users.forEach((user, index) => {
    rankingBox.innerHTML +=
    `
      <div class="rank-item">
        <span class="rank-name">${index + 1}. ${user.name}</span>
        <span class="rank-xp">${user.value}${rankingMode === "total" ? " XP" : "分"}</span>
      </div>
    `;
  });
}

function initialSyncRecords() {
  const roomId = localStorage.getItem("currentRoom");
  const userName = localStorage.getItem("userName");
  if (!roomId || !userName) return;

  // recordsをFirebase用に整形
  const userRecords = {};
  records.forEach(r => {
    userRecords[r.id] = {
      subject: r.subject,
      time: r.time,
      date: r.date.toISOString() };


  });

  // XPと一緒にセット
  set(ref(db, "rooms/" + roomId + "/" + userId), {
    name: userName,
    xp,
    totalXp,
    records: userRecords });



}
//===========タイマー==============
function updateTimer() {
  const elapsed = Date.now() - timerStart;
  const sec = Math.floor(elapsed / 1000);
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  timerDisplay.textContent = `${m}:${s}`;
}
timerBtn.onclick = () => {
  const subject = subjectSelect.value;
  timerSubject.textContent = `${subject} 勉強中`;

  timerStart = Date.now();
  localStorage.setItem("timerStart", timerStart);

  timerDisplay.textContent = "00:00";
  timerModal.style.display = "flex";

  timerInterval = setInterval(updateTimer, 1000);
};
stopTimerBtn.onclick = () => {
  clearInterval(timerInterval);

  const elapsedMs = Date.now() - timerStart;
  let minutes = Math.ceil(elapsedMs / 60000);

  if (minutes < 1) minutes = 1;

  if (!confirm(`${minutes}分として記録しますか？`)) {
    timerModal.style.display = "none";
    return;
  }

  records.push({
    id: Date.now(),
    subject: subjectSelect.value,
    time: minutes,
    date: new Date() });


  xp += minutes;
  totalXp += minutes;
  while (xp >= maxXp) {
    xp -= maxXp;
    level++;
    maxXp = calcMaxXp(level);
  }

  updateStatus();
  updateProgressSummary();
  saveData();
  syncXPToRoom();
  refreshRanking();

  timerModal.style.display = "none";
  localStorage.removeItem("timerStart");
};
cancelTimerBtn.onclick = () => {
  clearInterval(timerInterval);
  timerModal.style.display = "none";
  localStorage.removeItem("timerStart");
};

// ===== ページ切替 =====
document.getElementById("to-records").onclick = () => {
  mainPage.style.display = "none";
  recordsPage.style.display = "block";

  currentYear = new Date().getFullYear();
  currentMonth = new Date().getMonth();

  updateCalendarTitle();
  renderWeekGraph();
  renderCalendar();
  window.scrollTo(0, 0);
};

document.getElementById("to-main").onclick = () => {
  recordsPage.style.display = "none";
  mainPage.style.display = "block";
  window.scrollTo(0, 0);
};

// ===== 教科管理 =====
function updateSubjectSelect() {
  subjectSelect.innerHTML = "";
  todoSubjectSelect.innerHTML = "";
  subjects.forEach(s => {
    subjectSelect.appendChild(new Option(s, s));
    todoSubjectSelect.appendChild(new Option(s, s));
  });
  updateDeleteSubjectSelect();
}

function updateDeleteSubjectSelect() {
  deleteSubjectSelect.innerHTML = "";
  const placeholder = new Option("消したい教材", "");
  placeholder.disabled = true; // 選択不可にする場合
  placeholder.selected = true; // 最初に表示
  deleteSubjectSelect.appendChild(placeholder);
  subjects.forEach(s => {
    if (!["数学", "英語"].includes(s)) {// 初期教科は削除不可
      deleteSubjectSelect.appendChild(new Option(s, s));
    }
  });
}

document.getElementById("add-subject").onclick = () => {
  const name = document.getElementById("new-subject").value.trim();
  const color = document.getElementById("new-subject-color").value;
  if (!name || subjects.includes(name)) return;

  subjects.push(name);
  subjectColors[name] = color;

  updateSubjectSelect();
  document.getElementById("new-subject").value = "";
  saveData();
};

// ===== 教科削除 =====
document.getElementById("delete-subject-btn").onclick = () => {
  const sub = deleteSubjectSelect.value;
  if (!sub) return;

  if (!confirm(`${sub} を本当に削除しますか？`)) return;

  subjects = subjects.filter(s => s !== sub);
  delete subjectColors[sub];

  // TODOやrecordsからも削除
  for (let date in todosByDate) {
    delete todosByDate[date][sub];
  }
  records = records.filter(r => r.subject !== sub);

  updateSubjectSelect();
  updateStatus();
  updateProgressSummary();
  renderWeekGraph();
  renderCalendar();
  renderTodoList(todoSubjectSelect.value);

  saveData();
};

// ===== 勉強処理 =====
document.getElementById("study-button").onclick = () => {
  const subject = subjectSelect.value;
  const input = document.getElementById("study-time");
  const time = Number(input.value);
  if (time <= 0) return;

  records.push({
    id: Date.now(),
    subject,
    time,
    date: new Date() });



  xp += time;
  totalXp += time;
  while (xp >= maxXp) {
    xp -= maxXp;
    level++;
    maxXp = calcMaxXp(level);
  }

  updateStatus();
  updateProgressSummary();
  input.value = "";

  recordMsg.textContent = `${subject}を${time}分記録しました！`;
  setTimeout(() => recordMsg.textContent = "", 2000);

  saveData();
  syncXPToRoom();
  refreshRanking(); // ←ランキング更新
};

// ===== XP再計算（取り消し用） =====
function recalcStatusFromRecords() {
  level = 1;
  xp = 0;
  totalXp = 0;
  maxXp = calcMaxXp(level);

  records.
  sort((a, b) => a.date - b.date).
  forEach(r => {
    xp += r.time;
    totalXp += r.time;
    while (xp >= maxXp) {
      xp -= maxXp;
      level++;
      maxXp = calcMaxXp(level);
    }
  });
}

// ===== Todo（日付リセット） =====
function getTodayTodos(subject) {
  var _todosByDate$today;
  const today = new Date().toISOString().split("T")[0];
  if (!todosByDate[today]) {
    todosByDate[today] = {};
    subjects.forEach(s => todosByDate[today][s] = []);
  }
  return (_todosByDate$today = todosByDate[today])[subject] || (
  _todosByDate$today[subject] = []);
}

function renderTodoList(subject) {
  const ul = document.getElementById("todo-list");
  ul.innerHTML = "";

  getTodayTodos(subject).forEach((t, index) => {
    const li = document.createElement("li");
    li.style.display = "flex";
    li.style.justifyContent = "space-between";
    li.style.alignItems = "center";

    const textNode = document.createTextNode(t.text);
    li.appendChild(textNode);

    if (t.done) li.classList.add("completed");

    li.onclick = () => {
      t.done = !t.done;
      renderTodoList(subject);
      saveData();
    };

    const delBtn = document.createElement("button");
    delBtn.textContent = "✕";
    delBtn.style.width = "24px";
    delBtn.style.height = "auto";
    delBtn.style.padding = "0";
    delBtn.style.marginLeft = "8px"; // テキストと少しスペースを空ける
    delBtn.style.background = "transparent";
    delBtn.style.border = "none";
    delBtn.style.color = "red";
    delBtn.style.cursor = "pointer";
    delBtn.style.display = "flex";
    delBtn.style.alignItems = "center";
    delBtn.style.justifyContent = "center";
    delBtn.style.fontSize = "16px";

    delBtn.onclick = e => {
      e.stopPropagation();
      getTodayTodos(subject).splice(index, 1);
      renderTodoList(subject);
      saveData();
    };

    li.appendChild(delBtn);
    ul.appendChild(li);
  });
}

document.getElementById("add-todo").onclick = () => {
  const text = document.getElementById("new-todo").value.trim();
  if (!text) return;

  getTodayTodos(todoSubjectSelect.value).push({
    text, done: false });

  document.getElementById("new-todo").value = "";
  renderTodoList(todoSubjectSelect.value);
  saveData();
};

todoSubjectSelect.onchange = () =>
renderTodoList(todoSubjectSelect.value);

// ===== ステータス表示 =====
function updateStatus() {
  document.getElementById("level").textContent = level;
  document.getElementById("xp").textContent = xp;
  document.getElementById("max-xp").textContent = maxXp;
  document.getElementById("xp-bar").style.width =
  xp / maxXp * 100 + "%";
}

// ===== 進捗サマリー =====
function updateProgressSummary() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const days = [...new Set(records.map(r => r.date.toDateString()))].sort(
  (a, b) => new Date(a) - new Date(b));


  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const diff = (today - new Date(days[i])) / (1000 * 60 * 60 * 24);
    if (Math.floor(diff) === streak) streak++;else

    break;
  }

  let maxStreak = 0,
  cur = 1;
  for (let i = 1; i < days.length; i++) {
    const diff = (new Date(days[i]) - new Date(days[i - 1])) / (1000 * 60 * 60 *
    24);
    cur = Math.floor(diff) === 1 ? cur + 1 : 1;
    maxStreak = Math.max(maxStreak, cur);
  }

  const yTime = records.
  filter(r => sameDate(r.date, yesterday)).
  reduce((s, r) => s + r.time, 0);

  document.getElementById("streak").textContent = streak;
  document.getElementById("max-streak").textContent = maxStreak;
  document.getElementById("yesterday-time").textContent = yTime;
}

// ===== 週グラフ =====
function renderWeekGraph() {
  const graph = document.getElementById("week-graph");
  const yAxis = document.getElementById("y-axis");
  const legend = document.getElementById("graph-legend");
  graph.innerHTML = "";
  yAxis.innerHTML = "";
  legend.innerHTML = "";

  const today = new Date();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());

  const totals = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    totals.push(
    records.filter(r => sameDate(r.date, d)).reduce((a, b) => a + b.time, 0));

  }

  const axisMax = Math.max(60, Math.ceil(Math.max(...totals) / 30) * 30);
  [axisMax, axisMax / 2, 0].forEach(v => {
    const div = document.createElement("div");
    div.textContent = v;
    yAxis.appendChild(div);
  });

  ["日", "月", "火", "水", "木", "金", "土"].forEach((day, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);

    const col = document.createElement("div");
    col.className = "day-column";

    const bar = document.createElement("div");
    bar.className = "bar";

    records.filter(r => sameDate(r.date, d)).forEach(r => {
      const seg = document.createElement("div");
      seg.className = "segment";
      seg.style.height = r.time / axisMax * 140 + "px";
      seg.style.background = subjectColors[r.subject];
      bar.appendChild(seg);
    });

    const label = document.createElement("div");
    label.className = "day-label";
    label.textContent = day;

    col.append(bar, label);
    graph.appendChild(col);
  });

  // ===== 教科別凡例 =====
  for (const sub of subjects) {
    const item = document.createElement("div");
    item.style.display = "flex";
    item.style.alignItems = "center";
    item.style.gap = "4px";

    const colorBox = document.createElement("span");
    colorBox.style.display = "inline-block";
    colorBox.style.width = "16px";
    colorBox.style.height = "16px";
    colorBox.style.background = subjectColors[sub];
    colorBox.style.borderRadius = "4px";

    const label = document.createElement("span");
    label.textContent = sub;

    item.appendChild(colorBox);
    item.appendChild(label);
    legend.appendChild(item);
  }
}

// ===== カレンダー =====
function updateCalendarTitle() {
  document.getElementById("calendar-title").textContent =
  `${currentYear}年 ${currentMonth + 1}月`;
}

function renderCalendar() {
  const cal = document.getElementById("calendar");
  cal.innerHTML = "";

  const first = new Date(currentYear, currentMonth, 1);
  for (let i = 0; i < first.getDay(); i++) {
    cal.appendChild(document.createElement("div"));
  }

  const last = new Date(currentYear, currentMonth + 1, 0).getDate();
  for (let d = 1; d <= last; d++) {
    const date = new Date(currentYear, currentMonth, d);
    const cell = document.createElement("div");
    cell.className = "calendar-day";
    cell.textContent = d;

    if (records.some(r => sameDate(r.date, date))) {
      cell.classList.add("has-record");
    }

    cell.onclick = () => showDayDetail(date);
    cal.appendChild(cell);
  }
}

document.getElementById("prev-month").onclick = () => {
  currentMonth--;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  }
  updateCalendarTitle();
  renderCalendar();
};

document.getElementById("next-month").onclick = () => {
  currentMonth++;
  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }
  updateCalendarTitle();
  renderCalendar();
};

// ===== 日付詳細 =====
function showDayDetail(date) {
  const list = document.getElementById("day-detail");
  list.innerHTML = "";

  document.getElementById("detail-title").textContent =
  date.toLocaleDateString() + " の勉強";

  records.filter(r => sameDate(r.date, date)).forEach(r => {
    const li = document.createElement("li");
    li.textContent = `${r.subject}：${r.time}分 `;

    const btn = document.createElement("button");
    btn.textContent = "取り消し";
    btn.onclick = () => {
      if (!confirm("この記録を取り消しますか？")) return;

      records = records.filter(x => x.id !== r.id);
      recalcStatusFromRecords();
      updateStatus();
      updateProgressSummary();
      renderWeekGraph();
      renderCalendar();
      showDayDetail(date);
      saveData();
      syncXPToRoom();
    };

    li.appendChild(btn);
    list.appendChild(li);
  });
}

// ===== 日付比較 =====
function sameDate(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate());

}
document.getElementById("to-rival").onclick = () => {
  mainPage.style.display = "none";
  rivalPage.style.display = "block";
};

document.getElementById("to-main-from-rival").onclick = () => {
  rivalPage.style.display = "none";
  mainPage.style.display = "block";
};
//=====使い方======
const helpBtn = document.getElementById("help-btn");
const helpModal = document.getElementById("help-modal");
const closeHelp = document.getElementById("close-help");

const slides = document.querySelectorAll("#slide-container .slide");
const prevBtn = document.getElementById("prev-slide");
const nextBtn = document.getElementById("next-slide");

let currentSlide = 0;

// モーダル表示
helpBtn.onclick = () => {
  helpModal.style.display = "flex";
  showSlide(currentSlide);
};

// モーダル非表示
closeHelp.onclick = () => {
  helpModal.style.display = "none";
};

// スライド表示関数
function showSlide(index) {
  slides.forEach((s, i) => s.classList.remove("active"));
  slides[index].classList.add("active");
}

// 前スライド
prevBtn.onclick = () => {
  currentSlide = (currentSlide - 1 + slides.length) % slides.length;
  showSlide(currentSlide);
};

// 次スライド
nextBtn.onclick = () => {
  currentSlide = (currentSlide + 1) % slides.length;
  showSlide(currentSlide);
};

// ===== 初期化 =====
loadData();
ensureInitialSubjects();
recalcStatusFromRecords();
fixTotalXpIfNeeded();
updateSubjectSelect();
updateStatus();
updateProgressSummary();
renderTodoList(todoSubjectSelect.value);
initialSyncRecords();
const savedTimer = localStorage.getItem("timerStart");
if (savedTimer) {
  timerStart = Number(savedTimer);
  timerModal.style.display = "flex";
  timerInterval = setInterval(updateTimer, 1000);
}
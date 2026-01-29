// ===== 基本データ =====
let level = 1;
let xp = 0;
let maxXp = 100;

let subjects = ["数学", "英語"];
let subjectColors = { 数学: "#42a5f5", 英語: "#ef5350" };

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
const subjectSelect = document.getElementById("subject");
const todoSubjectSelect = document.getElementById("todo-subject");
const recordMsg = document.getElementById("record-msg");
const deleteSubjectSelect = document.getElementById("delete-subject"); // ←削除用セレクト

// ===== ローカルストレージ =====
function saveData() {
  const data = { level, xp, subjects, subjectColors, records, todosByDate };
  localStorage.setItem("studyGameData", JSON.stringify(data));
}

function loadData() {
  const data = JSON.parse(localStorage.getItem("studyGameData"));
  if (!data) return;

  level = data.level || 1;
  xp = data.xp || 0;
  subjects = data.subjects?.length ? data.subjects : ["数学", "英語"];
  subjectColors = Object.keys(data.subjectColors).length ? data.subjectColors : { 数学: "#42a5f5", 英語: "#ef5350" };
  todosByDate = data.todosByDate || {};

  records = (data.records || []).map(r => ({
    id: r.id,
    subject: r.subject,
    time: r.time,
    date: new Date(r.date)
  }));

  maxXp = calcMaxXp(level);
}

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
  placeholder.selected = true;  // 最初に表示
  deleteSubjectSelect.appendChild(placeholder);
  subjects.forEach(s => {
    if (!["数学", "英語"].includes(s)) { // 初期教科は削除不可
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
    date: new Date()
  });

  xp += time;
  while (xp >= maxXp) {
    xp -= maxXp;
    level++;
    maxXp = calcMaxXp(level);
  }

  updateStatus();
  updateProgressSummary();
  input.value = "";

  recordMsg.textContent = `${subject}を${time}分記録しました！`;
  setTimeout(() => (recordMsg.textContent = ""), 2000);

  saveData();
};

// ===== XP再計算（取り消し用） =====
function recalcStatusFromRecords() {
  level = 1;
  xp = 0;
  maxXp = calcMaxXp(level);

  records
    .sort((a, b) => a.date - b.date)
    .forEach(r => {
      xp += r.time;
      while (xp >= maxXp) {
        xp -= maxXp;
        level++;
        maxXp = calcMaxXp(level);
      }
    });
}

// ===== Todo（日付リセット） =====
function getTodayTodos(subject) {
  const today = new Date().toISOString().split("T")[0];
  if (!todosByDate[today]) {
    todosByDate[today] = {};
    subjects.forEach(s => (todosByDate[today][s] = []));
  }
  return (todosByDate[today][subject] ||= []);
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
    delBtn.textContent = "×";
    delBtn.style.background = "transparent";
    delBtn.style.border = "none";
    delBtn.style.color = "red";
    delBtn.style.cursor = "pointer";
    delBtn.style.width = "24px";
    delBtn.style.height = "24px";
    delBtn.style.padding = "0";
    delBtn.style.fontSize = "16px";
    delBtn.style.lineHeight = "24px";
    delBtn.onclick = (e) => {
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

  getTodayTodos(todoSubjectSelect.value).push({ text, done: false });
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
    (xp / maxXp) * 100 + "%";
}

// ===== 進捗サマリー =====
function updateProgressSummary() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const days = [...new Set(records.map(r => r.date.toDateString()))].sort(
    (a, b) => new Date(a) - new Date(b)
  );

  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const diff = (today - new Date(days[i])) / (1000 * 60 * 60 * 24);
    if (Math.floor(diff) === streak) streak++;
    else break;
  }

  let maxStreak = 0, cur = 1;
  for (let i = 1; i < days.length; i++) {
    const diff = (new Date(days[i]) - new Date(days[i - 1])) / (1000 * 60 * 60 * 24);
    cur = Math.floor(diff) === 1 ? cur + 1 : 1;
    maxStreak = Math.max(maxStreak, cur);
  }

  const yTime = records
    .filter(r => sameDate(r.date, yesterday))
    .reduce((s, r) => s + r.time, 0);

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
      records
        .filter(r => sameDate(r.date, d))
        .reduce((a, b) => a + b.time, 0)
    );
  }

  const axisMax = Math.max(60, Math.ceil(Math.max(...totals) / 30) * 30);
  [axisMax, axisMax / 2, 0].forEach(v => {
    const div = document.createElement("div");
    div.textContent = v;
    yAxis.appendChild(div);
  });

  ["日","月","火","水","木","金","土"].forEach((day, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);

    const col = document.createElement("div");
    col.className = "day-column";

    const bar = document.createElement("div");
    bar.className = "bar";

    records.filter(r => sameDate(r.date, d)).forEach(r => {
      const seg = document.createElement("div");
      seg.className = "segment";
      seg.style.height = (r.time / axisMax) * 140 + "px";
      seg.style.background = subjectColors[r.subject];
      bar.appendChild(seg);
    });

    const label = document.createElement("div");
    label.className = "day-label";
    label.textContent = day;

    col.append(bar,label);
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
    a.getDate() === b.getDate()
  );
}

// ===== 初期化 =====
loadData();
updateSubjectSelect();
updateStatus();
updateProgressSummary();
renderTodoList(todoSubjectSelect.value);
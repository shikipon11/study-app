// ===== 基本データ =====
let level = 1;
let xp = 0;
let maxXp = 100;

let subjects = ["数学", "英語"];
let subjectColors = { 数学: "#42a5f5", 英語: "#ef5350" };

// 教科ごとのやることリスト（日付ごとに管理）
let todosByDate = {}; 
// 例: { "2026-01-28": { 数学: [{text:"問題集1",done:false}], 英語: [...] } }

let records = [];

// ===== DOM =====
const mainPage = document.getElementById("main-page");
const recordsPage = document.getElementById("records-page");
const subjectSelect = document.getElementById("subject");
const todoSubjectSelect = document.getElementById("todo-subject");
const recordMsg = document.getElementById("record-msg");

// ===== ローカルストレージ =====
function saveData() {
  const data = { level, xp, maxXp, subjects, subjectColors, records, todosByDate };
  localStorage.setItem("studyGameData", JSON.stringify(data));
}

function loadData() {
  const data = JSON.parse(localStorage.getItem("studyGameData"));
  if (data) {
    level = data.level || 1;
    xp = data.xp || 0;
    maxXp = data.maxXp || 100;

    subjects = data.subjects || ["数学","英語"];
    subjectColors = data.subjectColors || {};
    subjects.forEach(s => {
      if (!subjectColors[s]) subjectColors[s] = "#" + Math.floor(Math.random()*16777215).toString(16);
    });

    // ★records 内の date を Date オブジェクトに戻す
    records = (data.records || []).map(r => ({
      subject: r.subject,
      time: r.time,
      date: new Date(r.date)
    }));

    todosByDate = data.todosByDate || {};
  }
}

// ===== ページ切替 =====
document.getElementById("to-records").onclick = () => {
  mainPage.style.display = "none";
  recordsPage.style.display = "block";
  renderWeekGraph();
  renderCalendar();
};

document.getElementById("to-main").onclick = () => {
  recordsPage.style.display = "none";
  mainPage.style.display = "block";
};

// ===== 教科管理 =====
function updateSubjectSelect() {
  subjectSelect.innerHTML = "";
  todoSubjectSelect.innerHTML = "";
  subjects.forEach(s => {
    const o = document.createElement("option");
    o.textContent = s;
    subjectSelect.appendChild(o);

    const o2 = document.createElement("option");
    o2.textContent = s;
    todoSubjectSelect.appendChild(o2);
  });
}

document.getElementById("add-subject").onclick = () => {
  const name = document.getElementById("new-subject").value.trim();
  if (!name || subjects.includes(name)) return;

  subjects.push(name);
  subjectColors[name] = "#" + Math.floor(Math.random() * 16777215).toString(16);

  updateSubjectSelect();
  document.getElementById("new-subject").value = "";
  saveData();
};

// ===== 勉強処理 =====
document.getElementById("study-button").onclick = () => {
  const subject = subjectSelect.value;
  const timeInput = document.getElementById("study-time");
  const time = Number(timeInput.value);
  if (time <= 0) return;

  records.push({ subject, time, date: new Date() });

  // XP加算とレベルアップ
  xp += time;
  while (xp >= maxXp) {
    xp -= maxXp;
    level++;
    maxXp = Math.floor(maxXp * 1.2);
  }

  updateStatus();
  updateProgressSummary();

  timeInput.value = "";

  // 演出
  const button = document.getElementById("study-button");
  button.style.background = "linear-gradient(135deg, #00e676, #69f0ae)";
  setTimeout(() => { button.style.background = "linear-gradient(135deg, #4caf50, #8bc34a)"; }, 300);

  recordMsg.textContent = `${subject}を${time}分記録しました！`;
  setTimeout(() => { recordMsg.textContent = ""; }, 2000);

  saveData();
};

// ===== 今日のやることリスト取得（自動リセット） =====
function getTodayTodos(subject) {
  const today = new Date().toISOString().split("T")[0]; // yyyy-mm-dd
  if(!todosByDate[today]) {
    todosByDate[today] = {};
    subjects.forEach(s => todosByDate[today][s] = []);
  }
  if(!todosByDate[today][subject]) todosByDate[today][subject] = [];
  return todosByDate[today][subject];
}

// ===== やることリスト表示と追加 =====
function renderTodoList(subject) {
  const ul = document.getElementById("todo-list");
  ul.innerHTML = "";
  const list = getTodayTodos(subject);

  list.forEach((t, index) => {
    const li = document.createElement("li");
    li.textContent = t.text;
    if(t.done) li.classList.add("completed");

    li.onclick = () => {
      t.done = !t.done;
      renderTodoList(subject);
      saveData();
    };

    ul.appendChild(li);
  });
}

document.getElementById("add-todo").onclick = () => {
  const subject = todoSubjectSelect.value;
  const todoText = document.getElementById("new-todo").value.trim();
  if(!todoText) return;

  getTodayTodos(subject).push({text: todoText, done:false});
  document.getElementById("new-todo").value = "";
  renderTodoList(subject);
  saveData();
};

todoSubjectSelect.onchange = () => {
  renderTodoList(todoSubjectSelect.value);
};

// ===== ステータス更新 =====
function updateStatus() {
  document.getElementById("level").textContent = level;
  document.getElementById("xp").textContent = xp;
  document.getElementById("max-xp").textContent = maxXp;
  document.getElementById("xp-bar").style.width = (xp/maxXp*100) + "%";
}

// ===== 進捗サマリー =====
function updateProgressSummary() {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const daysWithRecords = Array.from(new Set(records.map(r => r.date.toDateString())))
                               .sort((a,b) => new Date(a)-new Date(b));

  let streak = 0;
  for (let i = daysWithRecords.length-1; i >= 0; i--) {
    const d = new Date(daysWithRecords[i]);
    const diff = Math.floor((today - d)/(1000*60*60*24));
    if(diff === streak) streak++;
    else break;
  }

  let maxStreak = 0;
  let current = 1;
  for(let i=1; i<daysWithRecords.length; i++){
    const prev = new Date(daysWithRecords[i-1]);
    const curr = new Date(daysWithRecords[i]);
    const diff = Math.floor((curr-prev)/(1000*60*60*24));
    if(diff ===1) current++;
    else current=1;
    if(current>maxStreak) maxStreak=current;
  }
  if(daysWithRecords.length>0) maxStreak=Math.max(maxStreak,current);

  const yesterdayTime = records.filter(r=>sameDate(r.date,yesterday))
                               .reduce((sum,r)=>sum+r.time,0);

  document.getElementById("streak").textContent = streak;
  document.getElementById("max-streak").textContent = maxStreak;
  document.getElementById("yesterday-time").textContent = yesterdayTime;
}

// ===== 週グラフ =====
function renderWeekGraph() {
  const graph = document.getElementById("week-graph");
  const yAxis = document.getElementById("y-axis");
  graph.innerHTML = "";
  yAxis.innerHTML = "";

  const GRAPH_HEIGHT = 140;
  const days = ["日","月","火","水","木","金","土"];
  const today = new Date();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());

  let totals=[];
  for(let i=0;i<7;i++){
    const d = new Date(sunday);
    d.setDate(sunday.getDate()+i);
    const sum = records.filter(r=>sameDate(r.date,d)).reduce((a,b)=>a+b.time,0);
    totals.push(sum);
  }

  const weekMax=Math.max(...totals,0);
  const axisMax = weekMax===0?60:Math.ceil(weekMax/30)*30;

  [axisMax,axisMax/2,0].forEach(v=>{
    const div = document.createElement("div");
    div.textContent=v;
    yAxis.appendChild(div);
  });

  for(let i=0;i<7;i++){
    const d=new Date(sunday);
    d.setDate(sunday.getDate()+i);

    const col=document.createElement("div");
    col.className="day-column";

    const bar=document.createElement("div");
    bar.className="bar";

    records.filter(r=>sameDate(r.date,d)).forEach(r=>{
      const seg=document.createElement("div");
      seg.className="segment";
      seg.style.height = (r.time/axisMax*GRAPH_HEIGHT)+"px";
      seg.style.background=subjectColors[r.subject];
      bar.appendChild(seg);
    });

    const label=document.createElement("div");
    label.className="day-label";
    label.textContent=days[i];

    col.appendChild(bar);
    col.appendChild(label);
    graph.appendChild(col);
  }
}

// ===== カレンダー =====
function renderCalendar() {
  const cal = document.getElementById("calendar");
  cal.innerHTML = "";

  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();

  const first = new Date(y,m,1);
  const start = first.getDay();
  const last = new Date(y,m+1,0).getDate();

  for(let i=0;i<start;i++) cal.appendChild(document.createElement("div"));

  for(let d=1;d<=last;d++){
    const date = new Date(y,m,d);
    const cell = document.createElement("div");
    cell.className="calendar-day";
    cell.textContent=d;

    if(records.some(r=>sameDate(r.date,date))) cell.classList.add("has-record");

    cell.onclick=()=>showDayDetail(date);
    cal.appendChild(cell);
  }
}

// ===== 日付詳細 =====
function showDayDetail(date){
  const list=document.getElementById("day-detail");
  list.innerHTML="";

  document.getElementById("detail-title").textContent = date.toLocaleDateString()+" の勉強";

  records.filter(r=>sameDate(r.date,date)).forEach(r=>{
    const li=document.createElement("li");
    li.textContent=`${r.subject}：${r.time}分`;
    list.appendChild(li);
  });
}

// ===== 日付比較 =====
function sameDate(a,b){
  return a.getFullYear()===b.getFullYear() &&
         a.getMonth()===b.getMonth() &&
         a.getDate()===b.getDate();
}

// ===== 初期化 =====
loadData();
updateSubjectSelect();
updateStatus();
updateProgressSummary();
renderTodoList(todoSubjectSelect.value);
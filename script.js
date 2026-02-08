//====================== Firebaseライブラリ読み込み ======================
// Firebaseアプリ本体を使うための読み込み
import {
initializeApp } from

"https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
// Firebase Realtime Databaseを使うための読み込み
import {
getDatabase, ref, set, get, onValue } from


"https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

//====================== Firebase接続設定 ======================
// Firebaseプロジェクト固有の設定情報
// この情報を使って自分のFirebaseに接続する
const firebaseConfig = {
  apiKey: "AIzaSyAWz3ZCFdEUdVVEtLhun-Sf_8ZvNRkzB9s",
  authDomain: "study-game-app-cdf53.firebaseapp.com",
  databaseURL: "https://study-game-app-cdf53-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "study-game-app-cdf53",
  storageBucket: "study-game-app-cdf53.firebasestorage.app",
  messagingSenderId: "830965015838",
  appId: "1:830965015838:web:acc3f28ca9453289ff150f" };


//====================== 基本データ ======================
let level = 1; // レベル
let xp = 0; //　XP
let maxXp = 100; //// 次のレベルに必要なXPの初期値
let totalXp = 0; // 累計XP（ランキング用）
let subjects = ["数学", "英語"]; // 初期教科(テスト)
let subjectColors = {
  数学: "#42a5f5",
  英語: "#ff69b4" };
// 上の教科ごとの表示色
//ユーザーidの識別に使う
let userId = localStorage.getItem("userId"); // ローカルストレージからユーザー固有IDを取得
if (!userId) {
  userId = crypto.randomUUID();
  localStorage.setItem("userId", userId);
} // まだIDがなければ新しく生成して保存
// 教科ごとのやることリスト（日付ごと）
let todosByDate = {}; // 日付ごと・教科ごとのTodoリスト
let records = []; // 勉強記録（時間・教科・日付）
let roomUnsubscribe = null; // FirebaseのonValue解除用関数を保存する変数
let currentYear = new Date().getFullYear(); // 表示中の年
let currentMonth = new Date().getMonth(); // 0〜11
//タイマー
let timerStart; // タイマー開始時刻
let timerInterval; // タイマー更新用setIntervals
let timerMode = "normal"; // タイマーモード（normal / pomodoro）
let pomodoroPhase = "work"; // ポモドーロの状態（work: 集中 / break: 休憩）
let pomodoroCount = 0; // 完了した集中回数
const pomodoroWork = 1 * 6 * 1000; // 集中25分
const pomodoroBreak = 1 * 6 * 1000; // 休憩5分
// ===== 効果音 =====
const phaseChangeSound = new Audio("目覚まし時計のアラーム.mp3"); // 集中→休憩 / 休憩→集中 用
phaseChangeSound.volume = 0.6; // 音量（0.0〜1.0）
//firebase関連
const app = initializeApp(firebaseConfig); //// Firebaseアプリを初期化
const db = getDatabase(app); //// Realtime Databaseを使う準備
//使い方
let currentSlide = 0;
//====================== レベルごとの必要XP計算 ======================
function calcMaxXp(level) {
  return Math.min(Math.floor(100 + Math.pow(level, 1.2) * 10), 1200);
} // レベルに応じて次のレベルに必要なXPを計算する　上限1200

//====================== DOM要素取得 ======================
const mainPage = document.getElementById("main-page"); // メイン画面
const recordsPage = document.getElementById("records-page"); // 記録一覧ページ
const rivalPage = document.getElementById("rival-page"); // ライバル（部屋）ページ
const subjectSelect = document.getElementById("subject"); // 教科選択（勉強記録用）
const todoSubjectSelect = document.getElementById("todo-subject"); // Todo用 教科選択
const recordMsg = document.getElementById("record-msg"); // 勉強記録メッセージ表示
const deleteSubjectSelect = document.getElementById("delete-subject"); // 教科削除用セレクト
const roomInput = document.getElementById("roomInput"); // 部屋番号入力
const nameInput = document.getElementById("nameInput"); // 名前入力
const joinBtn = document.getElementById("joinRoomBtn"); // 入室ボタン
const leaveRoomBtn = document.getElementById("leave-room"); // 退出ボタン
const timerBtn = document.getElementById("timer-button"); // タイマーボタン
const timerModal = document.getElementById("timer-modal"); // タイマーモーダル
const timerDisplay = document.getElementById("timer-display"); // タイマー表示
const timerSubject = document.getElementById("timer-subject"); // タイマー中の教科表示
const stopTimerBtn = document.getElementById("stop-timer"); // タイマー停止ボタン
const cancelTimerBtn = document.getElementById("cancel-timer"); // タイマーキャンセルボタン
const helpBtn = document.getElementById("help-btn");
const helpModal = document.getElementById("help-modal");
const closeHelp = document.getElementById("close-help");
const slides = document.querySelectorAll("#slide-container .slide");
const prevBtn = document.getElementById("prev-slide");
const nextBtn = document.getElementById("next-slide");
const timerModeSelect = document.getElementById("timer-mode"); // モード選択
const timerPhaseText = document.getElementById("timer-phase"); // 集中 / 休憩表示
//====================== データ保存 ======================
// 現在の状態をまとめてローカルストレージに保存する
function saveData() {
  const data = {
    level, // レベル
    xp, // 現在XP
    totalXp, // 累計XP
    subjects, // 教科一覧
    subjectColors, // 教科ごとの色
    records, // 勉強記録
    todosByDate // 日付ごとのTodo
  };
  localStorage.setItem("studyGameData", JSON.stringify(data));
} // JSON文字列にして保存
//====================== データ読み込み ======================
// ローカルストレージから保存データを復元する
function loadData() {
  const data = JSON.parse(localStorage.getItem("studyGameData"));
  if (!data) return; // 保存データがなければ何もしない
  // 基本ステータス復元
  level = data.level || 1;
  xp = data.xp || 0;
  totalXp = data.totalXp || 0;
  subjects = data.subjects || ["数学", "英語"];
  subjectColors = data.subjectColors || {};

  // 初期教科の色を保証
  if (!subjectColors["数学"]) subjectColors["数学"] = "#42a5f5";
  if (!subjectColors["英語"]) subjectColors["英語"] = "#ff69b4";
  // Todo復元
  todosByDate = data.todosByDate || {};
  // 勉強記録復元（日付はDate型に戻す）
  records = (data.records || []).map(r => ({
    id: r.id,
    subject: r.subject,
    time: r.time,
    date: new Date(r.date) }));

  // レベルに応じた最大XP再計算
  maxXp = calcMaxXp(level);
}
// 初期教科の色を保証する関数
function ensureInitialSubjects() {
  const initialSubjects = {
    数学: "#42a5f5",
    英語: "#ef5350" };

  // 教科と色がなければ追加
  for (const [sub, color] of Object.entries(initialSubjects)) {
    if (!subjects.includes(sub)) subjects.push(sub);
    if (!subjectColors[sub]) subjectColors[sub] = color;
  }
}
// totalXpが存在しない古いデータ用の補正処理
function fixTotalXpIfNeeded() {
  if (totalXp > 0) return; // すでにあるなら何もしない
  if (!records || records.length === 0) return; // 記録がなければ何もしない
  // 勉強記録の合計からtotalXpを再計算
  totalXp = records.reduce((sum, r) => sum + r.time, 0);
  saveData();
}

//====================== 部屋メッセージ表示 ======================
// 部屋関連の成功・失敗メッセージを表示する
function showRoomMessage(text, type = "success") {
  const msg = document.getElementById("roomMsg");
  msg.textContent = text; // メッセージ内容
  msg.style.color = type === "error" ? "red" : "green"; // エラー時は赤、それ以外は緑
  setTimeout(() => {
    msg.textContent = "";
  }, 2000); // 一定時間後にメッセージを消す
}
//====================== 名前の復元 ======================
// 以前入力した名前をローカルストレージから復元
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
} // 名前と部屋が両方あれば自動で部屋を監視
//====================== 入室処理 ======================
joinBtn.onclick = async () => {
  // 入力された部屋番号と名前を取得
  const roomId = roomInput.value.trim();
  const userName = nameInput.value.trim();

  // 4桁数字チェック
  if (!/^\d{4}$/.test(roomId)) {
    showRoomMessage("部屋番号は4桁の数字にしてね", "error");
    return;
  }
  // 未入力チェック
  if (!roomId || !userName) {
    alert("部屋番号と名前を入力してね");
    return;
  }

  const roomRef = ref(db, "rooms/" + roomId);
  // Firebaseから部屋のデータを取得
  try {
    // Firebaseから部屋情報取得
    const snapshot = await get(roomRef);
    const data = snapshot.val();

    // 同じ名前が存在するかチェック
    // 同じ名前の「他人」がいるかチェック
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

  // 既に監視してたら解除
  if (roomUnsubscribe) {
    roomUnsubscribe();
  }

  roomUnsubscribe = onValue(roomRef, snapshot => {
    const data = snapshot.val();
    updateRanking(data);
  });
}
leaveRoomBtn.onclick = async () => {
  if (!confirm("本当に部屋を退出しますか？")) return;

  const roomId = localStorage.getItem("currentRoom");
  const uid = userId;

  // 監視解除
  if (roomUnsubscribe) {
    roomUnsubscribe();
    roomUnsubscribe = null;
  }

  // Firebase上の自分のデータ削除
  if (roomId) {
    await set(ref(db, "rooms/" + roomId + "/" + uid), null);
  }

  // ローカル情報削除
  localStorage.removeItem("currentRoom");
  localStorage.removeItem("userName");

  // UIリセット
  document.getElementById("rankingBox").innerHTML = "";
  document.getElementById("roomInput").value = "";
  document.getElementById("nameInput").value = "";

  showRoomMessage("部屋を退出しました");

  // メイン画面へ戻る
  rivalPage.style.display = "none";
  mainPage.style.display = "block";
};


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
      sunday.setHours(0, 0, 0, 0);
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
//=====タイマー=====/
// タイマー表示を更新する関数
function updateTimer() {
  const elapsed = Date.now() - timerStart;

  // ===== ポモドーロモード =====
  if (timerMode === "pomodoro") {

    // 今のフェーズに応じた制限時間
    const limit =
    pomodoroPhase === "work" ?
    pomodoroWork :
    pomodoroBreak;

    // 残り時間
    const remain = limit - elapsed;

    // 時間切れになったらフェーズ切り替え
    if (remain <= 0) {
      // 集中が終わった瞬間ならカウントする
      if (pomodoroPhase === "work") {
        pomodoroCount++;
      }
      timerStart = Date.now();
      pomodoroPhase = pomodoroPhase === "work" ? "break" : "work";


      // 表示切り替え
      timerPhaseText.textContent =
      pomodoroPhase === "work" ? "集中" : "休憩";
      // 効果音を鳴らす
      phaseChangeSound.currentTime = 0;
      phaseChangeSound.play();

      return;
    }

    // 残り時間を mm:ss で表示
    const sec = Math.floor(remain / 1000);
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    timerDisplay.textContent = `${m}:${s}`;
  }

  // ===== 通常タイマー =====
  else {
      const sec = Math.floor(elapsed / 1000);
      const m = String(Math.floor(sec / 60)).padStart(2, "0");
      const s = String(sec % 60).padStart(2, "0");
      timerDisplay.textContent = `${m}:${s}`;
    }
}

// タイマーボタンが押されたとき
timerBtn.onclick = () => {
  // 今選ばれている教科
  const subject = subjectSelect.value;

  // タイマーモード取得
  timerMode = timerModeSelect.value;

  // ポモドーロは必ず「集中」から開始
  pomodoroPhase = "work";
  pomodoroCount = 0;
  // モードによって表示テキストを変更
  timerSubject.textContent =
  timerMode === "pomodoro" ?
  `${subject}（ポモドーロ）` :
  `${subject} 勉強中`;

  // 開始時刻を記録
  timerStart = Date.now();
  localStorage.setItem("timerStart", timerStart);
  localStorage.setItem("timerMode", timerMode);

  // 表示初期化
  timerDisplay.textContent = "00:00";
  timerModal.style.display = "flex";

  // ポモドーロのときだけ「集中」を表示
  if (timerMode === "pomodoro") {
    timerPhaseText.style.display = "block";
    timerPhaseText.textContent = "集中";
  } else {
    timerPhaseText.style.display = "none";
  }

  // 1秒ごとにタイマー更新
  timerInterval = setInterval(updateTimer, 1000);
};
// タイマー停止ボタン
stopTimerBtn.onclick = () => {
  clearInterval(timerInterval);

  let minutes = 0;

  // ポモドーロの場合
  if (timerMode === "pomodoro") {
    // まだ1回も集中が完了していない場合
    if (pomodoroCount === 0) {
      alert("まだ集中タイムが完了していないので記録できません。\nタイマーを再開します。");

      // タイマーを再開する
      timerStart = Date.now() - (Date.now() - timerStart);
      timerInterval = setInterval(updateTimer, 1000);

      return;
    }
    minutes = pomodoroCount * 25;
  }

  // 通常タイマー
  else {
      const elapsedMs = Date.now() - timerStart;
      minutes = Math.ceil(elapsedMs / 60000);
    }

  if (!confirm(`${minutes}分として記録しますか？`)) {
    timerModal.style.display = "none";
    return;
  }

  // 勉強記録追加
  records.push({
    id: Date.now(),
    subject: subjectSelect.value,
    time: minutes,
    date: new Date() });


  // XP加算
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
//=====使い方=====
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
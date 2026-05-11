// ============================================================
// ダンジョン自動周回 + Lv100転生ループ 完全修正版
// ============================================================

// ===== 職業ごとの継承候補 =====
const REINCARNATION_MAP = {
};

// ============================================================
// 設定
// ============================================================

const INTERVAL = 3000;
const TARGET_DUNGEON = "廃墟の聖堂";

// ============================================================
// 通常探索ボタン（←プロトタイプ流用）
// ============================================================

const COMMON_ACTIONS = [
  "次の地へ",
  "とじる",
  "探索する",
  "探索を続ける"
];

// ============================================================
// 状態
// ============================================================

let selectedProfession = null;
let state = "EXPLORE";
let lastActionTime = 0;

// ============================================================
// 共通関数
// ============================================================

function normalize(text) {
  return String(text || "")
    .replace(/\s+/g, "")
    .trim();
}

function cooldown(ms = 1500) {
  const now = Date.now();

  if (now - lastActionTime < ms) {
    return false;
  }

  lastActionTime = now;
  return true;
}

function doClick(el, label) {

  if (!el) return false;
  if (!cooldown()) return false;

  const rect = el.getBoundingClientRect();

  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;

  const events = [
    'pointerdown',
    'mousedown',
    'pointerup',
    'mouseup',
    'click'
  ];

  events.forEach(type => {

    const ev = new MouseEvent(type, {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      buttons: 1
    });

    el.dispatchEvent(ev);
  });

  console.log(
    `%c[${new Date().toLocaleTimeString()}] ${label}`,
    "color:#00ff7f;font-weight:bold;"
  );

  return true;
}

function getAll() {
  return Array.from(
    document.querySelectorAll(
      'button, div, span, a, p, [role="button"]'
    )
  );
}

function clickText(text) {

  const all = getAll();

  const target = all.find(el =>
    normalize(el.textContent).includes(
      normalize(text)
    )
  );

  if (!target) {
    console.log(`[MISS] ${text}`);
    return false;
  }

  const clickable =
    target.closest('button') ||
    target.closest('[role="button"]') ||
    target;

  return doClick(clickable, text);
}

// ============================================================
// Lv100判定
// ============================================================

function isLv100() {

  const text = normalize(
    document.body.innerText
  );

  return (
    text.includes("転生可能")
  );
}

// ============================================================
// 戻るボタン
// ============================================================

function clickReturnButton() {

  if (!cooldown()) return false;

  // 左上のダンジョン名付近
  const x = window.innerWidth * 0.18;
  const y = window.innerHeight * 0.08;

  const target = document.elementFromPoint(x, y);

  console.log(
    "[RETURN TARGET]",
    target
  );

  if (!target) {
    console.log("[MISS] 戻り先座標なし");
    return false;
  }

  const events = [
    'pointerdown',
    'mousedown',
    'pointerup',
    'mouseup',
    'click'
  ];

  events.forEach(type => {

    target.dispatchEvent(
      new MouseEvent(type, {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        buttons: 1
      })
    );
  });

  console.log(
    "%c拠点へ戻るクリック",
    "color:orange;font-weight:bold;"
  );

  return true;
}

// ============================================================
// スキル選択
// ============================================================

function chooseSkill() {

  if (!selectedProfession) {
    return false;
  }

  const skillList =
    REINCARNATION_MAP[selectedProfession];

  const all = getAll();

  for (const skillName of skillList) {

    const skillBtn = all.find(el =>
      normalize(el.textContent) ===
      normalize(skillName)
    );

    if (skillBtn) {

      console.log(
        `職業「${selectedProfession}」→ スキル「${skillName}」`
      );

      return doClick(
        skillBtn,
        `スキル選択: ${skillName}`
      );
    }
  }

  return false;
}

// ============================================================
// メインループ
// ============================================================

function mainLoop() {

  console.log(
    `%c[STATE] ${state}`,
    "color:#87cefa;font-weight:bold;"
  );

  // ========================================================
  // 通常探索
  // ========================================================

  if (state === "EXPLORE") {

    // Lv100検知
    if (isLv100()) {

      console.log(
        "%cLv100検知 → 拠点へ戻る",
        "color:orange;font-weight:bold;"
      );

      state = "RETURN_TO_BASE";
      return;
    }

    // ===== プロトタイプ探索処理 =====

    const allElements = Array.from(
      document.querySelectorAll(
        'button, div, span, a, p'
      )
    );

    for (const text of COMMON_ACTIONS) {

      const target = allElements.find(el =>
        el.textContent.includes(text) &&
        el.children.length === 0
      );

      if (target) {

        const clickable =
          target.closest('button') ||
          target.closest('[role="button"]') ||
          target;

        doClick(clickable, text);
        return;
      }
    }

    console.log(
      "[EXPLORE] 通常探索ボタンなし"
    );

    return;
  }

  // ========================================================
  // 拠点へ戻る
  // ========================================================

  if (state === "RETURN_TO_BASE") {

    if (clickReturnButton()) {

      state = "OPEN_PREPARE";
    }

    return;
  }

  // ========================================================
  // 準備
  // ========================================================

  if (state === "OPEN_PREPARE") {

    if (clickText("準備")) {

      state = "OPEN_REINCARNATION";
    }

    return;
  }

  // ========================================================
  // 転生画面
  // ========================================================

  if (state === "OPEN_REINCARNATION") {

    if (clickText("転生")) {

      state = "SELECT_JOB";
    }

    return;
  }

  // ========================================================
  // 職業選択
  // ========================================================

  if (state === "SELECT_JOB") {

    const all = getAll();

    for (const prof in REINCARNATION_MAP) {

      const target = all.find(el =>
        normalize(el.textContent) ===
        normalize(prof)
      );

      if (target) {

        selectedProfession = prof;

        doClick(
          target,
          `職業選択: ${prof}`
        );

        state = "SELECT_SKILL";

        return;
      }
    }

    return;
  }

  // ========================================================
  // スキル選択
  // ========================================================

  if (state === "SELECT_SKILL") {

    // スキル継承
    if (chooseSkill()) {

      state = "CONFIRM_CLASS";

      return;
    }

    // スキル選択なし
    if (clickText("この生き方を選ぶ")) {

      state = "CONFIRM_REINCARNATION";

      return;
    }

    return;
  }

  // ========================================================
  // 生き方決定
  // ========================================================

  if (state === "CONFIRM_CLASS") {

    if (clickText("この生き方を選ぶ")) {

      state = "CONFIRM_REINCARNATION";
    }

    return;
  }

  // ========================================================
  // 転生確認
  // ========================================================

  if (state === "CONFIRM_REINCARNATION") {

    if (clickText("転生する")) {

      state = "GO_TO_BASE";
    }

    return;
  }

  // ========================================================
  // 拠点
  // ========================================================

  if (state === "GO_TO_BASE") {

    if (clickText("拠点")) {

      state = "START_EXPLORE";
    }

    return;
  }

  // ========================================================
  // 探索開始
  // ========================================================

  if (state === "START_EXPLORE") {

    if (clickText("探索")) {

      state = "SELECT_DUNGEON";
    }

    return;
  }

  // ========================================================
  // ダンジョン選択
  // ========================================================

  if (state === "SELECT_DUNGEON") {

    if (clickText(TARGET_DUNGEON)) {

      console.log(
        "%c探索再開",
        "color:#00ff7f;font-weight:bold;"
      );

      state = "EXPLORE";
    }

    return;
  }
}

// ============================================================
// 起動
// ============================================================

if (window.dungeonMaster) {
  clearInterval(window.dungeonMaster);
}

window.dungeonMaster =
  setInterval(mainLoop, INTERVAL);

console.log(
  "%c完全修正版マクロ起動",
  "color:#00ff7f;font-size:16px;font-weight:bold;"
);

console.log(
  "停止: clearInterval(window.dungeonMaster)"
);
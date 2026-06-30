// ==UserScript==
// @name         Dark Veil Dungeon Rebirth Loop
// @namespace    local.dark-veil
// @version      0.2.0
// @description  Dark Veil dungeon auto loop and Lv100 rebirth helper
// @match        https://dark-veil.net/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

  const STORAGE_KEY = "darkVeilDungeonLoop:v2";

  const DEFAULT_CONFIG = {
    enabled: false,
    intervalMs: 3000,
    cooldownMs: 1500,
    startDungeon: "廃墟の聖堂",
    targetDungeon: "廃墟の聖堂",
    targetJob: "虚ろ",
    autoSkill: true,
    targetSkill: "",
  };

  const COMMON_ACTIONS = [
    "次の地へ",
    "とじる",
    "閉じる",
    "探索する",
    "探索を続ける",
  ];

  const STATE_LABELS = {
    EXPLORE: "探索中",
    RETURN_TO_BASE: "拠点へ戻る",
    OPEN_REBIRTH_ENTRY: "転生導線を開く",
    OPEN_PREPARE: "準備を開く",
    OPEN_REINCARNATION: "転生を開く",
    SELECT_JOB: "職業選択",
    SELECT_SKILL: "スキル選択",
    CONFIRM_SKILL_REBIRTH: "スキル選択後の転生",
    CONFIRM_CLASS: "生き方決定",
    CONFIRM_REINCARNATION: "転生確認",
    GO_TO_BASE: "拠点へ",
    START_EXPLORE: "探索開始",
    SELECT_DUNGEON: "ダンジョン選択",
  };

  const runtime = {
    state: "EXPLORE",
    lastActionTime: 0,
    status: "停止中",
    timerId: null,
    forceStartDungeon: false,
  };

  let config = loadConfig();

  function loadConfig() {
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  function saveConfig() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }

  function normalize(text) {
    return String(text || "").replace(/\s+/g, "").trim();
  }

  function gameRoot() {
    return document.querySelector("#game-root") || document.body;
  }

  function bodyText() {
    return normalize(gameRoot().innerText || document.body.innerText || "");
  }

  function hasText(text) {
    return bodyText().includes(normalize(text));
  }

  function visible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  }

  function cooldown(ms = config.cooldownMs) {
    const now = Date.now();
    if (now - runtime.lastActionTime < ms) return false;
    runtime.lastActionTime = now;
    return true;
  }

  function log(label, color = "#00ff7f") {
    runtime.status = label;
    renderPanel();
    console.log(`%c[${new Date().toLocaleTimeString()}] ${label}`, `color:${color};font-weight:bold;`);
  }

  function getAll() {
    return Array.from(gameRoot().querySelectorAll("button, div, span, a, p, [role='button']"))
      .filter(visible);
  }

  function clickableOf(el) {
    if (!el) return null;
    return el.closest("button") || el.closest("[role='button']") || el.closest("a") || el;
  }

  function isDisabled(el) {
    return !el
      || el.disabled
      || el.getAttribute("aria-disabled") === "true"
      || Boolean(el.closest("button:disabled,[aria-disabled='true']"));
  }

  function debugSnapshot(reason = "snapshot") {
    const rows = getAll()
      .map((el) => {
        const clickable = clickableOf(el);
        const rect = el.getBoundingClientRect();
        return {
          text: normalize(el.textContent).slice(0, 80),
          tag: el.tagName.toLowerCase(),
          clickableTag: clickable ? clickable.tagName.toLowerCase() : "",
          disabled: isDisabled(clickable),
          children: el.children.length,
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        };
      })
      .filter((row) => row.text)
      .sort((a, b) => a.text.length - b.text.length)
      .slice(0, 80);

    console.group(`[DarkVeilLoop DEBUG] ${reason} / state=${runtime.state}`);
    console.log("bodyText", bodyText().slice(0, 1200));
    console.table(rows);
    console.groupEnd();
    return rows;
  }

  function dispatchClick(el, label, options = {}) {
    if (!el) return false;
    if (isDisabled(el)) {
      console.log(`[DISABLED] ${label || normalize(el.textContent)}`);
      return false;
    }
    if (!options.skipCooldown && !cooldown()) return false;

    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const eventTypes = ["pointerdown", "mousedown", "pointerup", "mouseup", "click"];

    eventTypes.forEach((type) => {
      const EventClass = type.startsWith("pointer") && window.PointerEvent ? window.PointerEvent : window.MouseEvent;
      el.dispatchEvent(new EventClass(type, {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        buttons: 1,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
      }));
    });

    log(label || `クリック: ${normalize(el.textContent)}`);
    return true;
  }

  function clickAtRatio(rx, ry, label) {
    if (!cooldown()) return false;
    const base = gameRoot().getBoundingClientRect();
    const x = Math.round(base.left + base.width * rx);
    const y = Math.round(base.top + base.height * ry);
    const target = document.elementFromPoint(x, y);

    if (!target) {
      log(`[MISS] ${label}: 座標先なし`, "orange");
      return false;
    }

    ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach((type) => {
      const EventClass = type.startsWith("pointer") && window.PointerEvent ? window.PointerEvent : window.MouseEvent;
      target.dispatchEvent(new EventClass(type, {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        buttons: 1,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
      }));
    });

    log(label, "orange");
    return true;
  }

  function clickDialogConfirm(label = "確認ボタン") {
    if (!cooldown()) return false;

    const rootEl = gameRoot();
    const buttons = Array.from(rootEl.querySelectorAll("button, [role='button']"))
      .filter((el) => visible(el) && !isDisabled(el));
    const exact = buttons.find((el) => normalize(el.textContent) === normalize("転生する"));
    if (exact) {
      runtime.lastActionTime = 0;
      return dispatchClick(exact, label);
    }

    const dialogLike = getAll()
      .filter((el) => {
        const text = normalize(el.textContent);
        const rect = el.getBoundingClientRect();
        return text.includes(normalize("生まれ変わる"))
          && text.includes(normalize("転生する"))
          && rect.width > 220
          && rect.height > 120;
      })
      .sort((a, b) => {
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        return (ar.width * ar.height) - (br.width * br.height);
      })[0];

    const base = (dialogLike || rootEl).getBoundingClientRect();
    const x = Math.round(base.left + base.width * 0.72);
    const y = Math.round(base.top + base.height * 0.82);
    const target = document.elementFromPoint(x, y);
    if (!target) return false;

    ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach((type) => {
      const EventClass = type.startsWith("pointer") && window.PointerEvent ? window.PointerEvent : window.MouseEvent;
      target.dispatchEvent(new EventClass(type, {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        buttons: 1,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
      }));
    });

    log(label, "orange");
    return true;
  }

  function shortestTextMatch(text, options = {}) {
    const key = normalize(text);
    const exact = Boolean(options.exact);
    const leafOnly = options.leafOnly !== false;
    const scope = options.scope || gameRoot();
    const matches = getAll().filter((el) => {
      if (!scope.contains(el)) return false;
      const t = normalize(el.textContent);
      if (!t) return false;
      if (leafOnly && el.children.length > 0 && !el.closest("button,[role='button']")) return false;
      return exact ? t === key : t.includes(key);
    });

    matches.sort((a, b) => normalize(a.textContent).length - normalize(b.textContent).length);
    return matches[0] || null;
  }

  function clickText(text, options) {
    const target = shortestTextMatch(text, options);
    if (!target) {
      console.log(`[MISS] ${text}`);
      return false;
    }

    const clickable = clickableOf(target);
    return dispatchClick(clickable, text);
  }

  function findJobTarget(jobName) {
    const wanted = normalize(jobName);
    if (!wanted) return null;

    const unique = [];
    const seen = new Set();

    for (const el of getAll()) {
      const clickable = clickableOf(el);
      if (!clickable || seen.has(clickable) || isDisabled(clickable)) continue;
      seen.add(clickable);

      const elText = normalize(el.textContent);
      const clickableText = normalize(clickable.textContent);
      if (!elText.includes(wanted) && !clickableText.includes(wanted)) continue;

      let score = clickableText.length;
      if (elText === wanted) score -= 1000;
      if (clickableText === wanted) score -= 800;
      if (clickable.matches("button,[role='button']")) score -= 80;
      if (/Lv\.?\d+|EXP|HP|装備|戦闘力|ランキング|更新|探索|拠点|準備/.test(clickableText)) score += 600;
      if (clickableText.includes("転生する") || clickableText.includes("この生き方を選ぶ")) score += 1000;

      unique.push({ el, clickable, text: clickableText, score });
    }

    unique.sort((a, b) => a.score - b.score);
    console.table(unique.slice(0, 10).map((item) => ({
      score: item.score,
      text: item.text.slice(0, 100),
      tag: item.clickable.tagName,
      children: item.clickable.children.length,
    })));

    return unique[0] ? unique[0].clickable : null;
  }

  function clickReturnButton() {
    return clickAtRatio(0.18, 0.08, "拠点へ戻るクリック");
  }

  function isLv100() {
    return bodyText().includes("転生可能");
  }

  function chooseAnySkill() {
    if (!config.autoSkill) return false;

    const blacklist = [
      "この生き方を選ぶ",
      "転生する",
      "とじる",
      "閉じる",
      "戻る",
      "キャンセル",
      "習得可能スキル",
      "マスター済",
    ].map(normalize);

    const masterLabel = normalize("マスター済");
    const learnableLabel = normalize("習得可能スキル");
    const masterSkillLabel = normalize("マスターするスキル");
    const chooseOneLabel = normalize("転生後もどの生き方でも使えるスキルを1つ選ぶ");

    const nearText = (el, depth = 3) => {
      let node = el;
      let text = "";
      for (let i = 0; node && i < depth; i += 1) {
        text = normalize(node.textContent);
        if (text.includes(masterLabel)) return text;
        node = node.parentElement;
      }
      return text;
    };

    const currentText = bodyText();
    const skillScreen = currentText.includes(learnableLabel)
      || currentText.includes(masterSkillLabel)
      || currentText.includes(chooseOneLabel);

    const targetSkill = normalize(config.targetSkill || "");
    const all = getAll();
    const rootRect = gameRoot().getBoundingClientRect();
    const navWords = ["世代", "開く", "ルーン", "拠点", "準備", "血盟", "市場", "メニュー"]
      .map(normalize);
    const skillCardText = (el) => {
      const name = normalize(el.textContent);
      let node = el.parentElement;
      for (let i = 0; node && i < 5; i += 1) {
        const rect = node.getBoundingClientRect();
        const text = normalize(node.textContent);
        if (
          text.startsWith(name)
          && text.length > name.length + 10
          && rect.width > rootRect.width * 0.55
          && rect.height >= 42
          && rect.height <= 150
        ) {
          return text;
        }
        node = node.parentElement;
      }
      return "";
    };

    const candidates = all.filter((el) => {
      const text = normalize(el.textContent);
      const rowText = nearText(el, 4);
      const rect = el.getBoundingClientRect();
      const cardText = skillCardText(el);
      return text.length > 0
        && (skillScreen ? text.length >= 2 && text.length <= 8 : text.length < 28)
        && el.children.length === 0
        && skillScreen
        && rect.top > rootRect.top + 80
        && rect.bottom < rootRect.bottom - 90
        && cardText
        && !rowText.includes(masterLabel)
        && !cardText.includes(masterLabel)
        && !text.includes(masterLabel)
        && !text.includes(learnableLabel)
        && !text.includes(masterSkillLabel)
        && !text.includes(chooseOneLabel)
        && !text.includes(normalize("転生する"))
        && !/^(Lv\.?\d+|EXP|HP|\d+\/\d+|\d+)$/.test(text)
        && !navWords.includes(text)
        && !blacklist.some((item) => text.includes(item));
    });

    candidates.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      const at = normalize(a.textContent);
      const bt = normalize(b.textContent);
      const aTarget = targetSkill && at === targetSkill ? -10000 : 0;
      const bTarget = targetSkill && bt === targetSkill ? -10000 : 0;
      return (aTarget + ar.top + at.length / 10)
        - (bTarget + br.top + bt.length / 10);
    });

    console.log("[SKILL CANDIDATES]", candidates.map((el) => normalize(el.textContent)));
    if (candidates.length === 0) return false;
    const selected = targetSkill
      ? candidates.find((el) => normalize(el.textContent) === targetSkill)
      : candidates[0];

    if (!selected) {
      console.log(`[MISS] 指定スキルが見つかりません: ${config.targetSkill}`);
      return false;
    }

    return dispatchClick(clickableOf(selected), `スキル選択: ${normalize(selected.textContent).slice(0, 30)}`);
  }

  function isSkillMasterScreen() {
    const text = bodyText();
    return text.includes(normalize("マスターするスキル"))
      || text.includes(normalize("転生後もどの生き方でも使えるスキルを1つ選ぶ"));
  }

  function clickCommonExploreAction() {
    const all = getAll();
    for (const text of COMMON_ACTIONS) {
      const key = normalize(text);
      const target = all.find((el) => normalize(el.textContent).includes(key) && el.children.length === 0);
      if (target) {
        const clickable = target.closest("button") || target.closest("[role='button']") || target;
        return dispatchClick(clickable, text);
      }
    }
    return false;
  }

  function setState(nextState, message) {
    runtime.state = nextState;
    log(message || `STATE: ${STATE_LABELS[nextState] || nextState}`, "#87cefa");
  }

  function mainLoop() {
    if (!config.enabled) return;

    console.log(`%c[STATE] ${runtime.state}`, "color:#87cefa;font-weight:bold;");
    renderPanel();

    if (hasText("転生が完了")) {
      if (clickText("とじる") || clickText("閉じる")) {
        runtime.forceStartDungeon = true;
        setState("GO_TO_BASE", "転生完了ダイアログを閉じる");
      } else {
        runtime.forceStartDungeon = true;
        setState("GO_TO_BASE", "転生完了を検知");
      }
      return;
    }

    if (runtime.state === "EXPLORE") {
      if (isLv100()) {
        setState("RETURN_TO_BASE", "Lv100/転生可能検知 → 拠点へ戻る");
        return;
      }

      if (clickCommonExploreAction()) return;

      console.log("[EXPLORE] 通常探索ボタンなし");
      runtime.status = "探索ボタン待機中";
      renderPanel();
      return;
    }

    if (runtime.state === "RETURN_TO_BASE") {
      if (clickReturnButton()) setState("OPEN_PREPARE");
      return;
    }

    if (runtime.state === "OPEN_REBIRTH_ENTRY") {
      if (clickText("準備") || clickAtRatio(0.30, 0.93, "準備タブ")) {
        setState("OPEN_REINCARNATION");
      }
      return;
    }

    if (runtime.state === "OPEN_PREPARE") {
      if (clickText("準備") || clickAtRatio(0.30, 0.93, "準備タブ")) {
        setState("OPEN_REINCARNATION");
      }
      return;
    }

    if (runtime.state === "OPEN_REINCARNATION") {
      if (clickText("転生", { leafOnly: false }) || clickText("転生可能", { leafOnly: false })) {
        setState("SELECT_JOB");
      }
      return;
    }

    if (runtime.state === "SELECT_JOB") {
      const exactTarget = getAll().find((el) => normalize(el.textContent) === normalize(config.targetJob));
      const target = exactTarget || shortestTextMatch(config.targetJob, { leafOnly: false });
      if (target && !hasText("転生が完了")) {
        dispatchClick(target.closest("button") || target.closest("[role='button']") || target, `職業選択: ${config.targetJob}`);
        setState("SELECT_SKILL");
        return;
      }

      if (clickText("転生", { leafOnly: false }) || clickText("転生可能", { leafOnly: false })) {
        runtime.status = `職業待機中: ${config.targetJob}`;
        renderPanel();
        return;
      }

      console.log(`[MISS] 職業が見つかりません: ${config.targetJob}`);
      runtime.status = `職業待機中: ${config.targetJob}`;
      renderPanel();
      return;
    }

    if (runtime.state === "SELECT_SKILL") {
      if (isSkillMasterScreen()) {
        if (chooseAnySkill()) {
          setState("CONFIRM_SKILL_REBIRTH");
          return;
        }

        runtime.status = "未マスターのスキル待機中";
        renderPanel();
        return;
      }

      if (clickText("この生き方を選ぶ")) {
        setState("CONFIRM_REINCARNATION");
        return;
      }

      if (chooseAnySkill()) {
        setState("CONFIRM_CLASS");
        return;
      }

      runtime.status = "スキル/生き方ボタン待機中";
      renderPanel();
      return;
    }

    if (runtime.state === "CONFIRM_SKILL_REBIRTH") {
      if (clickText("転生する") || clickDialogConfirm("スキル選択後の転生する")) {
        setState("CONFIRM_REINCARNATION");
      }
      return;
    }

    if (runtime.state === "CONFIRM_CLASS") {
      if (clickText("この生き方を選ぶ")) setState("CONFIRM_REINCARNATION");
      return;
    }

    if (runtime.state === "CONFIRM_REINCARNATION") {
      if (isSkillMasterScreen()) {
        if (chooseAnySkill()) {
          setState("CONFIRM_SKILL_REBIRTH", "マスターするスキルを選択");
          return;
        }

        runtime.status = "マスターするスキル待機中";
        renderPanel();
        return;
      }

      const text = bodyText();
      const dialogOpened = text.includes("生まれ変わる")
        || text.includes("元には戻れない")
        || text.includes("戻れない");

      if (!dialogOpened) {
        clickText("転生する");
        return;
      }

      const confirmButton = getAll().find((el) => normalize(el.textContent) === "転生する" && el.children.length === 0);
      if (confirmButton) {
        dispatchClick(confirmButton.closest("button") || confirmButton, "最終転生確認");
        runtime.forceStartDungeon = true;
        setState("GO_TO_BASE");
        return;
      }

      if (clickDialogConfirm("最終転生確認")) {
        runtime.forceStartDungeon = true;
        setState("GO_TO_BASE");
      }
      return;
    }

    if (runtime.state === "GO_TO_BASE") {
      if (clickText("とじる") || clickText("閉じる")) return;
      if (clickText("拠点") || clickAtRatio(0.18, 0.93, "拠点タブ")) {
        setState("START_EXPLORE");
      }
      return;
    }

    if (runtime.state === "START_EXPLORE") {
      if (clickText("探索") || clickAtRatio(0.34, 0.93, "探索タブ")) {
        setState("SELECT_DUNGEON");
      }
      return;
    }

    if (runtime.state === "SELECT_DUNGEON") {
      const dungeon = runtime.forceStartDungeon ? config.startDungeon : config.targetDungeon;
      if (clickText(dungeon)) {
        runtime.forceStartDungeon = false;
        setState("EXPLORE", "探索再開");
      } else {
        runtime.status = `ダンジョン待機中: ${dungeon}`;
        renderPanel();
      }
    }
  }

  function startLoop() {
    stopLoop(false);
    runtime.state = "EXPLORE";
    runtime.lastActionTime = 0;
    runtime.status = "起動しました";
    runtime.timerId = window.setInterval(mainLoop, config.intervalMs);
    window.dungeonMaster = runtime.timerId;
    log("完全修正版マクロ起動");
  }

  function stopLoop(updateStatus = true) {
    if (runtime.timerId) {
      window.clearInterval(runtime.timerId);
      runtime.timerId = null;
    }
    if (window.dungeonMaster) {
      window.clearInterval(window.dungeonMaster);
      window.dungeonMaster = null;
    }
    if (updateStatus) {
      runtime.status = "停止中";
      renderPanel();
    }
  }

  function createPanel() {
    const style = document.createElement("style");
    style.textContent = `
      #dv-auto-panel {
        position: fixed; right: 12px; bottom: 12px; z-index: 2147483647;
        width: 286px; color: #c8c8c0; background: rgba(20,22,20,.95);
        border: 1px solid #948161; font: 12px/1.5 system-ui, sans-serif;
        box-shadow: 0 8px 24px rgba(0,0,0,.45);
      }
      #dv-auto-panel * { box-sizing: border-box; }
      #dv-auto-panel header { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-bottom: 1px solid #242F35; color: #948161; }
      #dv-auto-panel main { display: grid; gap: 8px; padding: 10px; }
      #dv-auto-panel label { display: grid; gap: 3px; color: #a0a09a; }
      #dv-auto-panel input { width: 100%; border: 1px solid #242F35; background: #040605; color: #c8c8c0; padding: 6px; font: inherit; outline: none; }
      #dv-auto-panel button { border: 1px solid #948161; background: transparent; color: #948161; padding: 6px 8px; cursor: pointer; }
      #dv-auto-panel button.primary { background: #948161; color: #222; }
      #dv-auto-panel .row { display: flex; gap: 6px; }
      #dv-auto-panel .row > button { flex: 1; }
      #dv-auto-panel .check { display: flex; align-items: center; gap: 6px; color: #a0a09a; }
      #dv-auto-panel .check input { width: auto; }
      #dv-auto-status { color: #c8c8c0; min-height: 18px; word-break: break-all; }
    `;
    document.documentElement.appendChild(style);

    const panel = document.createElement("section");
    panel.id = "dv-auto-panel";
    panel.innerHTML = `
      <header>
        <strong>Dark Veil Loop</strong>
        <span id="dv-auto-mode"></span>
      </header>
      <main>
        <label>転生後の開始ダンジョン<input id="dv-auto-start-dungeon"></label>
        <label>通常の目標ダンジョン<input id="dv-auto-dungeon"></label>
        <label>転生職業<input id="dv-auto-job"></label>
        <label>マスターするスキル<input id="dv-auto-target-skill" placeholder="空欄なら先頭候補"></label>
        <label>間隔(ms)<input id="dv-auto-interval" inputmode="numeric"></label>
        <label class="check"><input id="dv-auto-skill" type="checkbox">スキルを自動選択</label>
        <div id="dv-auto-status"></div>
        <div class="row">
          <button id="dv-auto-toggle" class="primary"></button>
          <button id="dv-auto-reset">状態リセット</button>
        </div>
      </main>
    `;
    document.body.appendChild(panel);

    const els = {
      mode: panel.querySelector("#dv-auto-mode"),
      startDungeon: panel.querySelector("#dv-auto-start-dungeon"),
      dungeon: panel.querySelector("#dv-auto-dungeon"),
      job: panel.querySelector("#dv-auto-job"),
      targetSkill: panel.querySelector("#dv-auto-target-skill"),
      interval: panel.querySelector("#dv-auto-interval"),
      skill: panel.querySelector("#dv-auto-skill"),
      status: panel.querySelector("#dv-auto-status"),
      toggle: panel.querySelector("#dv-auto-toggle"),
      reset: panel.querySelector("#dv-auto-reset"),
    };

    function syncInputs() {
      els.startDungeon.value = config.startDungeon || DEFAULT_CONFIG.startDungeon;
      els.dungeon.value = config.targetDungeon;
      els.job.value = config.targetJob;
      els.targetSkill.value = config.targetSkill || "";
      els.interval.value = String(config.intervalMs);
      els.skill.checked = config.autoSkill;
    }

    function applyInputs() {
      config = {
        ...config,
        startDungeon: els.startDungeon.value.trim() || DEFAULT_CONFIG.startDungeon,
        targetDungeon: els.dungeon.value.trim() || DEFAULT_CONFIG.targetDungeon,
        targetJob: els.job.value.trim() || DEFAULT_CONFIG.targetJob,
        targetSkill: els.targetSkill.value.trim(),
        intervalMs: Math.max(1000, Number(els.interval.value) || DEFAULT_CONFIG.intervalMs),
        autoSkill: els.skill.checked,
      };
      saveConfig();
    }

    els.toggle.addEventListener("click", () => {
      applyInputs();
      config.enabled = !config.enabled;
      saveConfig();
      if (config.enabled) startLoop();
      else stopLoop();
      renderPanel();
    });

    els.reset.addEventListener("click", () => {
      applyInputs();
      runtime.state = "EXPLORE";
      runtime.lastActionTime = 0;
      runtime.status = "状態をEXPLOREに戻しました";
      renderPanel();
    });

    [els.startDungeon, els.dungeon, els.job, els.targetSkill, els.interval, els.skill].forEach((el) => {
      el.addEventListener("change", () => {
        applyInputs();
        if (runtime.timerId) {
          window.clearInterval(runtime.timerId);
          runtime.timerId = window.setInterval(mainLoop, config.intervalMs);
          window.dungeonMaster = runtime.timerId;
        }
        renderPanel();
      });
    });

    window.__dvAutoEls = els;
    syncInputs();
  }

  function renderPanel() {
    const els = window.__dvAutoEls;
    if (!els) return;
    els.mode.textContent = config.enabled ? "ON" : "OFF";
    els.toggle.textContent = config.enabled ? "停止" : "開始";
    els.status.textContent = `${STATE_LABELS[runtime.state] || runtime.state}: ${runtime.status}`;
  }

  createPanel();
  renderPanel();

  if (config.enabled) startLoop();

  window.darkVeilLoop = {
    start() {
      config.enabled = true;
      saveConfig();
      startLoop();
      renderPanel();
    },
    stop() {
      config.enabled = false;
      saveConfig();
      stopLoop();
      renderPanel();
    },
    reset() {
      runtime.state = "EXPLORE";
      runtime.lastActionTime = 0;
      runtime.status = "状態をEXPLOREに戻しました";
      renderPanel();
    },
    debug(reason) {
      return debugSnapshot(reason);
    },
    state: runtime,
    config,
  };

  console.log("%cDark Veil dungeon loop loaded", "color:#00ff7f;font-size:16px;font-weight:bold;");
  console.log("停止: window.darkVeilLoop.stop() または clearInterval(window.dungeonMaster)");
})();

// === 【登録エリア】職業に対してスキルのリストを定義 ===
const REINCARNATION_MAP = {
  "放浪者":["斬撃", "生存本能", "回避の構え","捨て身"],
  "狩人":["速射"],
  "聖職者":["聖光", "癒しの祈り", "浄化の光"],
  "傭兵":["強打"],
  "呪術師":["雷撃", "焔"],
  "盗賊":["毒刃", "暗闇の刃"],
  "異端審問官":["聖なる裁き", "断罪", "贖罪の光","聖火","天罰"],
  "処刑人":["断頭", "威圧", "死刑宣告","鉄砕き","処刑"],
  "月蝕の魔術師":["月蝕"],
  "影歩き":["影刺し"],
  "蝕みの騎士":["暗黒斬","闇の鎧"],
  "冥術師":["魂喰い","腐敗の霧"],
  "獣憑き":["獣の咆哮","血爪"],
  "虚ろ":["虚無の波動","空蝕","虚ろの祈り","存在侵食","無の境地"],
  "万蝕":["禍つ刃"],
};

const INTERVAL = 5000;
let selectedProfession = null;

const COMMON_ACTIONS = ["この生き方を選ぶ", "転生する", "転生", "廃墟の聖堂", "探索", "拠点", "準備", "次の地へ", "とじる", "探索を続ける"];

const doClick = (el, label) => {
  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
  events.forEach(type => {
    el.dispatchEvent(new MouseEvent(type, {view: window, bubbles: true, cancelable: true, clientX: x, clientY: y, buttons: 1}));
  });
  console.log(`%c[${new Date().toLocaleTimeString()}] ${label}`, "color: #ff00ff; font-weight: bold;");
};

const mainLoop = setInterval(() => {
  const all = Array.from(document.querySelectorAll('button, div, span, a, p, [role="button"]'));

  // 1. レベル100監視
  if (all.some(el => el.textContent.includes("Lv. 100"))) {
    const backBtn = all.find(el => el.textContent.trim() === "<");
    if (backBtn) return doClick(backBtn, "戻る");
  }

  // 2. 職業選択
  for (const prof in REINCARNATION_MAP) {
    const target = all.find(el => el.textContent.trim() === prof);
    if (target) {
      selectedProfession = prof;
      return doClick(target, `職業選択: ${prof}`);
    }
  }

  // 3. スキル選択（リスト内を順次スキャン）
  if (selectedProfession) {
    const skillList = REINCARNATION_MAP[selectedProfession];
    // リスト内のスキルのうち、画面上に存在するものを探す
    for (const skillName of skillList) {
      const skillBtn = all.find(el => el.textContent.trim() === skillName);
      if (skillBtn) {
        console.log(`職業「${selectedProfession}」の候補から「${skillName}」を検知しました`);
        return doClick(skillBtn, `スキル確定: ${skillName}`);
      }
    }
  }

  // 4. 定型ボタン
  for (const text of COMMON_ACTIONS) {
    const target = all.find(el => el.textContent.includes(text));
    if (target) {
      const clickable = target.closest('button') || target.closest('[role="button"]') || target;
      return doClick(clickable, text);
    }
  }
}, INTERVAL);

console.log("複数スキル対応型マクロが起動しました。");

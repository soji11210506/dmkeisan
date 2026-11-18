const form = document.querySelector("#calculator");
const modeSelect = document.querySelector("#mode");
const modeFields = document.querySelectorAll(".mode-field");
const errorBox = document.querySelector("#errors");
const errorList = document.querySelector("#error-list");
const resultBox = document.querySelector("#result");

function combination(n, k) {
  if (k < 0 || k > n) return 0;
  const count = Math.min(k, n - k);
  let value = 1;
  for (let i = 1; i <= count; i += 1) {
    value = (value * (n - count + i)) / i;
  }
  return value;
}

function probabilityOfAtLeastOne(deckSize, targetCount, selectionCount) {
  return 1 - combination(deckSize - targetCount, selectionCount) /
    combination(deckSize, selectionCount);
}

function probabilityOfExactly(count, deckSize, targetCount, selectionCount) {
  const total = combination(deckSize, selectionCount);
  if (count < 0 || count > targetCount || selectionCount - count > deckSize - targetCount) {
    return 0;
  }
  return combination(targetCount, count) *
    combination(deckSize - targetCount, selectionCount - count) / total;
}

function updateModeFields() {
  for (const field of modeFields) {
    const active = field.dataset.mode === modeSelect.value;
    field.hidden = !active;
    for (const input of field.querySelectorAll("input, select")) {
      input.required = active;
    }
  }
  errorBox.hidden = true;
  resultBox.hidden = true;
}

function showErrors(errors) {
  errorList.replaceChildren();
  for (const message of errors) {
    const item = document.createElement("li");
    item.textContent = message;
    errorList.append(item);
  }
  errorBox.hidden = errors.length === 0;
}

function addResultText(container, className, text) {
  const element = document.createElement("p");
  element.className = className;
  element.textContent = text;
  container.append(element);
  return element;
}

function showResult(title, probability, detail, distribution = null) {
  resultBox.replaceChildren();
  addResultText(resultBox, "label", title);

  const percentage = document.createElement("div");
  percentage.className = "percentage";
  percentage.append(document.createTextNode(`${(probability * 100).toFixed(2)}`));
  const percentSign = document.createElement("span");
  percentSign.textContent = "%";
  percentage.append(percentSign);
  resultBox.append(percentage);
  addResultText(resultBox, "detail", detail);

  if (distribution) {
    const list = document.createElement("ul");
    list.className = "distribution";
    for (const { label, probability: itemProbability } of distribution) {
      const item = document.createElement("li");
      const itemLabel = document.createElement("span");
      itemLabel.textContent = label;
      const value = document.createElement("strong");
      value.textContent = `${(itemProbability * 100).toFixed(2)}%`;
      item.append(itemLabel, value);
      list.append(item);
    }
    resultBox.append(list);
  }
  resultBox.hidden = false;
}

function showBoldugiResult(rows, availableDeckCount, forbiddenSeals) {
  resultBox.replaceChildren();
  addResultText(resultBox, "label", "ボルドギ成功確率");
  addResultText(resultBox, "detail", `実際にめくれる残り山札: ${availableDeckCount}枚`);

  const list = document.createElement("ul");
  list.className = "boldugi-results";
  for (const row of rows) {
    const item = document.createElement("li");
    const heading = document.createElement("h3");
    heading.textContent = `${row.reveals}枚まで`;
    item.append(heading);

    const metrics = [
      ["成功", row.success],
      [forbiddenSeals === 0 ? "禁断解放済み" : "コマンドで禁断解放", row.unlock],
      ["コッコ/ゴールデン", row.special],
      ["普通のクリーチャー", row.ordinary],
    ];
    const grid = document.createElement("dl");
    grid.className = "boldugi-metrics";
    for (const [label, probability] of metrics) {
      const metric = document.createElement("div");
      const term = document.createElement("dt");
      term.textContent = label;
      const value = document.createElement("dd");
      value.textContent = `${(probability * 100).toFixed(2)}%`;
      metric.append(term, value);
      grid.append(metric);
    }
    item.append(grid);
    list.append(item);
  }
  resultBox.append(list);
  addResultText(
    resultBox,
    "detail",
    "最初の呪文でめくりを停止。非公開領域のカード種類は不明としてデッキ構成から推定します。ボルドギ成功で封印1つ、コマンドで1つ、モルネクは追加で2つ外します。非クリーチャーをすべて呪文とするため、成功率は1枚目で決まります。",
  );
  resultBox.hidden = false;
}

function calculateBoldugi(formData, errors) {
  const fields = [
    ["creature_count", "クリーチャー枚数"],
    ["private_count", "非公開領域枚数"],
    ["cocco_public_count", "コッコ公開済み枚数"],
    ["golden_public_count", "ゴールデン公開済み枚数"],
    ["command_count", "コマンドクリーチャー枚数"],
    ["command_public_count", "コマンド公開済み枚数"],
    ["forbidden_seals", "禁断の残り封印数"],
    ["morneku_public_count", "モルネク公開済み枚数"],
  ];
  const values = {};
  for (const [name, label] of fields) {
    const raw = formData.get(name);
    const value = Number(raw);
    if (raw === "" || !Number.isInteger(value)) {
      errors.push(`${label}は整数で入力してください。`);
    } else {
      values[name] = value;
    }
  }
  if (errors.length) return;

  const deckSize = Number(formData.get("deck_size"));
  const creatureCount = values.creature_count;
  const privateCount = values.private_count;
  const coccoPublic = values.cocco_public_count;
  const goldenPublic = values.golden_public_count;
  const commandCount = values.command_count;
  const commandPublic = values.command_public_count;
  const forbiddenSeals = values.forbidden_seals;
  const mornekuPublic = values.morneku_public_count;

  if (creatureCount < 12 || creatureCount > deckSize) {
    errors.push("クリーチャー枚数は12枚以上、デッキ枚数以下にしてください（コッコ・ゴールデン・モルネク各4枚を含む）。");
  }
  if (privateCount < 0 || privateCount > deckSize) {
    errors.push("非公開領域枚数は0枚以上、デッキ枚数以下にしてください。");
  }
  if (coccoPublic < 0 || coccoPublic > 4) {
    errors.push("コッコ公開済み枚数は0〜4枚にしてください。");
  }
  if (goldenPublic < 0 || goldenPublic > 4) {
    errors.push("ゴールデン公開済み枚数は0〜4枚にしてください。");
  }
  if (mornekuPublic < 0 || mornekuPublic > 4) {
    errors.push("モルネク公開済み枚数は0〜4枚にしてください。");
  }
  if (commandCount < 8 || commandCount > deckSize || commandCount > creatureCount - 4) {
    errors.push("コマンドクリーチャー枚数は8枚以上、デッキ枚数以下で、クリーチャー枚数からコッコ4枚を除いた数以下にしてください。");
  }
  if (commandPublic < 0 || commandPublic > commandCount) {
    errors.push("コマンド公開済み枚数は0枚以上、コマンドクリーチャー枚数以下にしてください。");
  }
  if (commandPublic < goldenPublic + mornekuPublic) {
    errors.push("コマンド公開済み枚数には、公開済みゴールデンとモルネクを含めてください。");
  }
  if (forbiddenSeals < 0 || forbiddenSeals > 6) {
    errors.push("禁断の残り封印数は0〜6個にしてください。");
  }
  if (privateCount < forbiddenSeals) {
    errors.push("非公開領域枚数には、禁断の残り封印数も含めてください。");
  }

  const publicCount = coccoPublic + commandPublic;
  const availableDeckCount = deckSize - publicCount - privateCount;
  if (publicCount + privateCount > deckSize) {
    errors.push("公開済みカードと非公開領域の合計がデッキ枚数を超えています。");
  } else if (availableDeckCount < 4) {
    errors.push("公開済みカードと非公開領域を除いた山札が4枚未満です。");
  }

  const otherCommandPublic = commandPublic - goldenPublic - mornekuPublic;
  const cardCounts = {
    cocco: 4 - coccoPublic,
    golden: 4 - goldenPublic,
    morneku: 4 - mornekuPublic,
    otherCommand: commandCount - 8 - otherCommandPublic,
    ordinary: creatureCount - commandCount - 4,
    spell: deckSize - creatureCount,
  };
  if (cardCounts.otherCommand < 0 || cardCounts.ordinary < 0 || cardCounts.spell < 0) {
    errors.push("入力枚数の内訳がデッキ枚数と矛盾しています。コマンド公開枚数にはゴールデンとモルネクを含めてください。");
  }
  if (errors.length) return;

  const populationSize = Object.values(cardCounts).reduce((sum, count) => sum + count, 0);
  const rows = [];
  for (let revealLimit = 1; revealLimit <= 4; revealLimit += 1) {
    const totals = { success: 0, unlock: 0, special: 0, ordinary: 0 };

    function record(probability, state) {
      if (state.success) totals.success += probability;
      if (forbiddenSeals === 0 || state.commandUnlock) totals.unlock += probability;
      if (state.special) totals.special += probability;
      if (state.ordinary) totals.ordinary += probability;
    }

    function visit(counts, remaining, depth, probability, state) {
      if (depth === revealLimit || remaining === 0) {
        record(probability, state);
        return;
      }

      for (const [kind, count] of Object.entries(counts)) {
        if (count === 0) continue;
        const nextProbability = probability * count / remaining;
        counts[kind] -= 1;

        if (kind === "spell") {
          record(nextProbability, state);
        } else {
          const isCreature = true;
          const firstCreature = isCreature && !state.success;
          const nextState = {
            success: state.success || isCreature,
            special: state.special || kind === "cocco" || kind === "golden",
            ordinary: state.ordinary || kind === "ordinary" || kind === "otherCommand",
            sealsRemoved: state.sealsRemoved + (firstCreature ? 1 : 0),
            commandUnlock: state.commandUnlock,
          };
          if (kind === "golden" || kind === "morneku" || kind === "otherCommand") {
            const previousSealsRemoved = nextState.sealsRemoved;
            const commandReduction = 1 + (kind === "morneku" ? 2 : 0);
            nextState.sealsRemoved += commandReduction;
            if (
              forbiddenSeals > 0 &&
              previousSealsRemoved < forbiddenSeals &&
              nextState.sealsRemoved >= forbiddenSeals
            ) {
              nextState.commandUnlock = true;
            }
          }
          if (depth + 1 === revealLimit) {
            record(nextProbability, nextState);
          } else {
            visit(counts, remaining - 1, depth + 1, nextProbability, nextState);
          }
        }

        counts[kind] += 1;
      }
    }

    visit(
      { ...cardCounts },
      populationSize,
      0,
      1,
      { success: false, special: false, ordinary: false, sealsRemoved: 0, commandUnlock: false },
    );
    rows.push({ reveals: revealLimit, ...totals });
  }

  showBoldugiResult(rows, availableDeckCount, forbiddenSeals);
}

function calculateDraw(formData, errors) {
  const deckSize = Number(formData.get("deck_size"));
  const targetRaw = formData.get("target_count");
  const turnRaw = formData.get("current_turn");
  const targetCount = Number(targetRaw);
  const turn = Number(turnRaw);
  const position = formData.get("position");

  if (deckSize < 5) errors.push("初手5枚を引くため、デッキ枚数は5枚以上にしてください。");
  if (targetRaw === "" || !Number.isInteger(targetCount) || targetCount < 0 || targetCount > deckSize) {
    errors.push("狙いのカード枚数は0枚以上、デッキ枚数以下にしてください。");
  }
  if (turnRaw === "" || !Number.isInteger(turn) || turn < 1) {
    errors.push("現在ターンは1以上にしてください。");
  }

  const seenCount = 5 + (position === "first" ? turn - 1 : turn);
  if (Number.isInteger(turn) && turn >= 1 && seenCount > deckSize) {
    errors.push("現在ターンまでに見る枚数がデッキ枚数を超えています。");
  }
  if (errors.length) return;

  showResult(
    "1枚以上引ける確率",
    probabilityOfAtLeastOne(deckSize, targetCount, seenCount),
    `初手5枚＋通常ドローで${seenCount}枚を見る計算`,
  );
}

function calculateShield(formData, errors) {
  const deckSize = Number(formData.get("deck_size"));
  const triggerRaw = formData.get("trigger_count");
  const shieldRaw = formData.get("shield_count");
  const triggerCount = Number(triggerRaw);
  const shieldCount = Number(shieldRaw);

  if (triggerRaw === "" || !Number.isInteger(triggerCount) || triggerCount < 0 || triggerCount > 40) {
    errors.push("対象のシールドトリガー枚数は0枚以上、40枚以下にしてください。");
  } else if (triggerCount > deckSize) {
    errors.push("対象のシールドトリガー枚数はデッキ枚数以下にしてください。");
  }
  if (shieldRaw === "" || !Number.isInteger(shieldCount) || shieldCount < 0 || shieldCount > 10) {
    errors.push("シールド枚数は0枚以上、10枚以下にしてください。");
  } else if (shieldCount > deckSize) {
    errors.push("シールド枚数はデッキ枚数以下にしてください。");
  }
  if (errors.length) return;

  const distribution = Array.from({ length: 6 }, (_, count) => ({
    label: `${count}枚`,
    probability: probabilityOfExactly(count, deckSize, triggerCount, shieldCount),
  }));
  const maxTriggers = Math.min(triggerCount, shieldCount);
  if (maxTriggers > 5) {
    distribution.push({
      label: "6枚以上",
      probability: Array.from(
        { length: maxTriggers - 5 },
        (_, index) => probabilityOfExactly(index + 6, deckSize, triggerCount, shieldCount),
      ).reduce((total, probability) => total + probability, 0),
    });
  }

  showResult(
    "シールドから1枚以上出る確率",
    probabilityOfAtLeastOne(deckSize, triggerCount, shieldCount),
    `シールド内のシールドトリガー期待枚数: ${(shieldCount * triggerCount / deckSize).toFixed(2)}枚`,
    distribution,
  );
}

modeSelect.addEventListener("change", updateModeFields);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  resultBox.hidden = true;

  const formData = new FormData(form);
  const errors = [];
  const deckSize = Number(formData.get("deck_size"));
  if (!Number.isInteger(deckSize) || deckSize < 1 || deckSize > 60) {
    errors.push("デッキ枚数は1枚以上、60枚以下にしてください。");
  } else if (modeSelect.value === "draw" && deckSize < 5) {
    errors.push("初手5枚を引くため、デッキ枚数は5枚以上にしてください。");
  }

  if (!errors.length) {
    if (modeSelect.value === "draw") calculateDraw(formData, errors);
    else if (modeSelect.value === "shield") calculateShield(formData, errors);
    else calculateBoldugi(formData, errors);
  }
  showErrors(errors);
});

document.querySelectorAll('input[type="number"]').forEach((input) => {
  input.addEventListener("wheel", (event) => event.preventDefault(), { passive: false });
});

updateModeFields();

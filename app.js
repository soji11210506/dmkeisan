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
  }
  showErrors(errors);
});

document.querySelectorAll('input[type="number"]').forEach((input) => {
  input.addEventListener("wheel", (event) => event.preventDefault(), { passive: false });
});

updateModeFields();

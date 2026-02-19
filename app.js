const STORAGE_KEY = "bouquetBuilder.savedBouquets";
const DRAFT_KEY = "bouquetBuilder.currentDraft";

const FLOWERS = [
  { id: "rose", label: "Rose", emoji: "🌹" },
  { id: "tulip", label: "Tulip", emoji: "🌷" },
  { id: "lily", label: "Lily", emoji: "🪷" },
  { id: "sunflower", label: "Sunflower", emoji: "🌻" },
  { id: "hibiscus", label: "Hibiscus", emoji: "🌺" },
  { id: "daisy", label: "Daisy", emoji: "🌼" },
  { id: "blossom", label: "Blossom", emoji: "🌸" },
  { id: "bouquet", label: "Accent", emoji: "💐" },
];

const state = {
  bouquetName: "",
  items: [],
  selectedId: null,
  draggingId: null,
  dragOffsetX: 0,
  dragOffsetY: 0,
};

const paletteEl = document.querySelector("#palette");
const canvasEl = document.querySelector("#canvas");
const clearBtn = document.querySelector("#clear-bouquet");
const nameInput = document.querySelector("#bouquet-name");
const saveBtn = document.querySelector("#save-bouquet");
const savedListEl = document.querySelector("#saved-list");
const savedItemTemplate = document.querySelector("#saved-item-template");

const selectionControls = document.querySelector("#selection-controls");
const scaleControl = document.querySelector("#scale-control");
const rotationControl = document.querySelector("#rotation-control");
const bringFrontBtn = document.querySelector("#bring-front");
const sendBackBtn = document.querySelector("#send-back");
const duplicateBtn = document.querySelector("#duplicate");
const deleteSelectedBtn = document.querySelector("#delete-selected");

init();

function init() {
  renderPalette();
  bindEvents();
  loadDraft();
  renderCanvas();
  renderSavedBouquets();
}

function renderPalette() {
  paletteEl.innerHTML = "";

  FLOWERS.forEach((flower) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = `Add ${flower.label}`;
    btn.dataset.flowerId = flower.id;
    btn.textContent = flower.emoji;
    paletteEl.appendChild(btn);
  });
}

function bindEvents() {
  paletteEl.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const flowerType = target.dataset.flowerId;
    if (!flowerType) {
      return;
    }

    addFlower(flowerType);
  });

  clearBtn.addEventListener("click", () => {
    state.items = [];
    state.selectedId = null;
    renderCanvas();
    persistDraft();
  });

  nameInput.addEventListener("input", () => {
    state.bouquetName = nameInput.value.trim();
    persistDraft();
  });

  saveBtn.addEventListener("click", saveCurrentBouquet);

  scaleControl.addEventListener("input", () => {
    const selected = getSelectedItem();
    if (!selected) {
      return;
    }

    selected.scale = Number(scaleControl.value);
    renderCanvas();
    persistDraft();
  });

  rotationControl.addEventListener("input", () => {
    const selected = getSelectedItem();
    if (!selected) {
      return;
    }

    selected.rotation = Number(rotationControl.value);
    renderCanvas();
    persistDraft();
  });

  bringFrontBtn.addEventListener("click", () => {
    const selected = getSelectedItem();
    if (!selected) {
      return;
    }

    selected.z = getNextZ();
    renderCanvas();
    persistDraft();
  });

  sendBackBtn.addEventListener("click", () => {
    const selected = getSelectedItem();
    if (!selected) {
      return;
    }

    selected.z = getMinZ() - 1;
    normalizeZIndexes();
    renderCanvas();
    persistDraft();
  });

  duplicateBtn.addEventListener("click", () => {
    const selected = getSelectedItem();
    if (!selected) {
      return;
    }

    const duplicate = {
      ...selected,
      id: crypto.randomUUID(),
      x: Math.min(selected.x + 18, canvasEl.clientWidth - 24),
      y: Math.min(selected.y + 18, canvasEl.clientHeight - 24),
      z: getNextZ(),
    };
    state.items.push(duplicate);
    state.selectedId = duplicate.id;
    renderCanvas();
    persistDraft();
  });

  deleteSelectedBtn.addEventListener("click", () => {
    if (!state.selectedId) {
      return;
    }

    state.items = state.items.filter((item) => item.id !== state.selectedId);
    state.selectedId = null;
    renderCanvas();
    persistDraft();
  });

  canvasEl.addEventListener("pointerdown", onCanvasPointerDown);
  window.addEventListener("pointermove", onWindowPointerMove);
  window.addEventListener("pointerup", onWindowPointerUp);

  savedListEl.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const itemEl = target.closest(".saved-item");
    if (!(itemEl instanceof HTMLElement)) {
      return;
    }

    const savedId = itemEl.dataset.savedId;
    if (!savedId) {
      return;
    }

    if (target.classList.contains("load-btn")) {
      loadSavedBouquet(savedId);
    }

    if (target.classList.contains("delete-btn")) {
      deleteSavedBouquet(savedId);
    }
  });
}

function addFlower(type) {
  const canvasRect = canvasEl.getBoundingClientRect();
  const centerX = canvasRect.width / 2;
  const centerY = canvasRect.height / 2;

  const item = {
    id: crypto.randomUUID(),
    type,
    x: centerX + randBetween(-40, 40),
    y: centerY + randBetween(-40, 40),
    scale: 1,
    rotation: randBetween(-20, 20),
    z: getNextZ(),
  };

  state.items.push(item);
  state.selectedId = item.id;
  renderCanvas();
  persistDraft();
}

function onCanvasPointerDown(event) {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const flowerEl = target.closest(".flower-item");
  if (!(flowerEl instanceof HTMLElement)) {
    state.selectedId = null;
    renderCanvas();
    persistDraft();
    return;
  }

  const id = flowerEl.dataset.id;
  const item = state.items.find((entry) => entry.id === id);
  if (!item) {
    return;
  }

  state.selectedId = item.id;
  state.draggingId = item.id;
  item.z = getNextZ();

  const canvasRect = canvasEl.getBoundingClientRect();
  state.dragOffsetX = event.clientX - (canvasRect.left + item.x);
  state.dragOffsetY = event.clientY - (canvasRect.top + item.y);

  flowerEl.classList.add("dragging");
  canvasEl.setPointerCapture(event.pointerId);
  renderCanvas();
}

function onWindowPointerMove(event) {
  if (!state.draggingId) {
    return;
  }

  const item = state.items.find((entry) => entry.id === state.draggingId);
  if (!item) {
    return;
  }

  const canvasRect = canvasEl.getBoundingClientRect();
  const x = event.clientX - canvasRect.left - state.dragOffsetX;
  const y = event.clientY - canvasRect.top - state.dragOffsetY;

  item.x = clamp(x, 15, canvasRect.width - 15);
  item.y = clamp(y, 15, canvasRect.height - 15);
  renderCanvas(false);
}

function onWindowPointerUp() {
  if (!state.draggingId) {
    return;
  }

  state.draggingId = null;
  renderCanvas();
  persistDraft();
}

function renderCanvas(syncControls = true) {
  canvasEl.innerHTML = "";

  const sortedItems = [...state.items].sort((a, b) => a.z - b.z);
  sortedItems.forEach((item) => {
    const flower = FLOWERS.find((entry) => entry.id === item.type);
    if (!flower) {
      return;
    }

    const el = document.createElement("div");
    el.className = "flower-item";
    el.dataset.id = item.id;
    el.textContent = flower.emoji;
    el.style.left = `${item.x}px`;
    el.style.top = `${item.y}px`;
    el.style.zIndex = String(item.z);
    el.style.transform = `translate(-50%, -50%) scale(${item.scale}) rotate(${item.rotation}deg)`;

    if (item.id === state.selectedId) {
      el.classList.add("selected");
    }

    if (item.id === state.draggingId) {
      el.classList.add("dragging");
    }

    canvasEl.appendChild(el);
  });

  if (syncControls) {
    syncSelectionControls();
  }
}

function syncSelectionControls() {
  const selected = getSelectedItem();
  if (!selected) {
    selectionControls.hidden = true;
    return;
  }

  selectionControls.hidden = false;
  scaleControl.value = String(selected.scale);
  rotationControl.value = String(selected.rotation);
}

function saveCurrentBouquet() {
  if (state.items.length === 0) {
    alert("Add at least one flower before saving.");
    return;
  }

  const name = state.bouquetName || `Bouquet ${new Date().toLocaleDateString()}`;
  const savedBouquets = readSavedBouquets();

  const payload = {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    items: structuredClone(state.items),
  };

  savedBouquets.unshift(payload);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(savedBouquets));
  renderSavedBouquets();
}

function renderSavedBouquets() {
  const savedBouquets = readSavedBouquets();
  savedListEl.innerHTML = "";

  if (savedBouquets.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No saved bouquets yet.";
    savedListEl.appendChild(empty);
    return;
  }

  savedBouquets.forEach((entry) => {
    const fragment = savedItemTemplate.content.cloneNode(true);
    const container = fragment.querySelector(".saved-item");
    const name = fragment.querySelector(".saved-name");
    const date = fragment.querySelector(".saved-date");

    if (!(container instanceof HTMLElement) || !name || !date) {
      return;
    }

    container.dataset.savedId = entry.id;
    name.textContent = entry.name;
    date.textContent = new Date(entry.createdAt).toLocaleString();
    savedListEl.appendChild(fragment);
  });
}

function loadSavedBouquet(savedId) {
  const bouquet = readSavedBouquets().find((entry) => entry.id === savedId);
  if (!bouquet) {
    return;
  }

  state.items = structuredClone(bouquet.items);
  state.selectedId = null;
  state.bouquetName = bouquet.name;
  nameInput.value = bouquet.name;
  renderCanvas();
  persistDraft();
}

function deleteSavedBouquet(savedId) {
  const next = readSavedBouquets().filter((entry) => entry.id !== savedId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  renderSavedBouquets();
}

function readSavedBouquets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed;
  } catch {
    return [];
  }
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) {
      return;
    }

    const draft = JSON.parse(raw);
    if (!draft || !Array.isArray(draft.items)) {
      return;
    }

    state.items = draft.items;
    state.bouquetName = draft.name || "";
    nameInput.value = state.bouquetName;
  } catch {
    // Ignore malformed localStorage payloads.
  }
}

function persistDraft() {
  localStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({
      name: state.bouquetName,
      items: state.items,
    }),
  );
}

function getSelectedItem() {
  return state.items.find((item) => item.id === state.selectedId) || null;
}

function getNextZ() {
  if (state.items.length === 0) {
    return 1;
  }

  return Math.max(...state.items.map((item) => item.z)) + 1;
}

function getMinZ() {
  if (state.items.length === 0) {
    return 1;
  }

  return Math.min(...state.items.map((item) => item.z));
}

function normalizeZIndexes() {
  const sorted = [...state.items].sort((a, b) => a.z - b.z);
  sorted.forEach((item, index) => {
    item.z = index + 1;
  });
}

function randBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

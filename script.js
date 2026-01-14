/* WEB WAVE STUDIO – Fast Food Nutrition Calculator (JSON-driven) */

const DATASETS = {
  starbucks: {
    us: "data/starbucks_us.json",
    uk: "data/starbucks_uk.json",
    international: "data/starbucks_international.json"
  },
  mcdonalds: {
    us: "data/mcdonalds_us.json",
    uk: "data/mcdonalds_uk.json",
    canada: "data/mcdonalds_canada.json",
    pakistan: "data/mcdonalds_pakistan.json"
  },
  kfc: {
    us: "data/kfc_us.json",
    uk: "data/kfc_uk.json",
    international: "data/kfc_international.json"
  }
};

const BRAND_LABELS = {
  starbucks: "Starbucks",
  mcdonalds: "McDonald's",
  kfc: "KFC"
};

const SEO_MAP = {
  starbucks: {
    title: "Starbucks Nutrition Calculator (US, UK, International) | WEB WAVE STUDIO",
    desc: "Free Starbucks nutrition calculator. Instantly calculate calories, protein, carbs, fat, sugar, and sodium by country dataset (US, UK, International).",
    keywords: "starbucks nutrition calculator, starbucks calories, starbucks macros calculator, starbucks protein carbs fat sugar sodium"
  },
  mcdonalds: {
    title: "McDonald’s Nutrition Calculator (US, UK, Canada, Pakistan) | WEB WAVE STUDIO",
    desc: "Free McDonald’s nutrition calculator. Instantly calculate calories and macros by country dataset (US, UK, Canada, Pakistan).",
    keywords: "mcdonalds nutrition calculator, mcdonalds calories, mcdonalds macros calculator, mcdonalds protein carbs fat sugar sodium"
  },
  kfc: {
    title: "KFC Nutrition Calculator (US, UK, International) | WEB WAVE STUDIO",
    desc: "Free KFC nutrition calculator. Instantly calculate calories, protein, carbs, fat, sugar, and sodium by country dataset (US, UK, International).",
    keywords: "kfc nutrition calculator, kfc calories, kfc macros calculator, kfc protein carbs fat sugar sodium"
  }
};

const dom = {
  tabs: document.querySelectorAll(".brand-btn"),
  region: document.getElementById("regionFilter"),
  category: document.getElementById("categoryFilter"),
  search: document.getElementById("menuSearch"),
  menu: document.getElementById("menuContainer"),
  meal: document.getElementById("mealContainer"),
  status: document.getElementById("linkStatus"),
  resetMeal: document.getElementById("resetMeal"),
  theme: document.getElementById("themeToggle"),
  lightLabel: document.getElementById("lightLabel"),
  darkLabel: document.getElementById("darkLabel"),

  // SEO nodes
  metaDescription: document.getElementById("metaDescription"),
  metaKeywords: document.getElementById("metaKeywords"),
  ogTitle: document.getElementById("ogTitle"),
  ogDescription: document.getElementById("ogDescription"),
  twitterTitle: document.getElementById("twitterTitle"),
  twitterDescription: document.getElementById("twitterDescription")
};

let currentBrandKey = "starbucks";  // default
let currentRegionKey = "us";        // default
let masterMenu = [];                // normalized flat items
let userMeal = [];                  // {id, name, ... , qty}

function toBrandKey(display) {
  const s = (display || "").toLowerCase();
  if (s.includes("starbucks")) return "starbucks";
  if (s.includes("mcdonald")) return "mcdonalds";
  if (s.includes("kfc")) return "kfc";
  return "starbucks";
}

function regionLabel(key) {
  if (!key) return "";
  if (key === "us") return "US";
  if (key === "uk") return "UK";
  if (key === "pakistan") return "Pakistan";
  if (key === "canada") return "Canada";
  if (key === "international") return "International";
  return key.toUpperCase();
}

function setStatusLinked(ok, brandKey, regionKey) {
  if (!dom.status) return;
  if (ok) {
    dom.status.innerHTML = `Linked <span class="pill">${regionLabel(regionKey)}</span>`;
    dom.status.classList.add("linked");
  } else {
    dom.status.textContent = "Not linked";
    dom.status.classList.remove("linked");
  }
}

/* ---------- SEO ---------- */
function updateSEOForBrand(brandKey, regionKey) {
  const s = SEO_MAP[brandKey];
  if (!s) return;

  const regionText = regionLabel(regionKey);
  const title = `${BRAND_LABELS[brandKey]} Nutrition Calculator (${regionText}) | WEB WAVE STUDIO`;
  const desc = `${s.desc} Current dataset: ${BRAND_LABELS[brandKey]} ${regionText}.`;
  const keywords = `${s.keywords}, ${brandKey} ${regionKey} nutrition`;

  document.title = title;

  if (dom.metaDescription) dom.metaDescription.setAttribute("content", desc);
  if (dom.metaKeywords) dom.metaKeywords.setAttribute("content", keywords);
  if (dom.ogTitle) dom.ogTitle.setAttribute("content", title);
  if (dom.ogDescription) dom.ogDescription.setAttribute("content", desc);
  if (dom.twitterTitle) dom.twitterTitle.setAttribute("content", title);
  if (dom.twitterDescription) dom.twitterDescription.setAttribute("content", desc);
}

/* ---------- Normalization ---------- */
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function sodiumFromSaltG(saltG) {
  // sodium is approx 40% of salt (NaCl) by mass
  return Math.round(num(saltG) * 400);
}

function normalizeItem(raw, brandKey, regionKey, category) {
  const name = raw.name || raw.item || raw.title || "Item";
  const calories = num(raw.calories ?? raw.kcal ?? raw.energy_kcal ?? raw.energy ?? raw.kj_to_kcal);

  const protein = num(raw.protein_g ?? raw.protein ?? 0);

  const carbs = num(
    raw.carbs_g ?? raw.carbohydrates_g ?? raw.total_carbs_g ?? raw.total_carbs ?? raw.total_carbohydrates_g ?? 0
  );

  const fat = num(
    raw.fat_g ?? raw.total_fat_g ?? raw.total_fat ?? 0
  );

  const sugar = num(
    raw.sugar_g ?? raw.sugars_g ?? raw.total_sugars_g ?? 0
  );

  const sodium = raw.sodium_mg != null
    ? num(raw.sodium_mg)
    : (raw.salt_g != null ? sodiumFromSaltG(raw.salt_g) : 0);

  const idBase = `${brandKey}_${regionKey}_${category}_${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  return {
    id: idBase,
    brand: brandKey,
    country: regionKey,
    category: category || "Uncategorized",
    name,
    calories,
    protein,
    carbs,
    fat,
    sugar,
    sodium
  };
}

function normalizeDataset(json, brandKey, regionKey) {
  const out = [];

  // Structure A: { menu: [{ category, items: [...] }]}
  if (json && json.menu && Array.isArray(json.menu)) {
    json.menu.forEach(group => {
      const category = group.category || "Uncategorized";
      const items = Array.isArray(group.items) ? group.items : [];
      items.forEach(item => {
        // Variant support (Starbucks international style)
        if (item && Array.isArray(item.variants)) {
          item.variants.forEach(v => {
            const raw = { ...v, name: `${item.name} (${v.size})` };
            out.push(normalizeItem(raw, brandKey, regionKey, category));
          });
        } else {
          out.push(normalizeItem(item, brandKey, regionKey, category));
        }
      });
    });
    return out;
  }

  // Structure B: Array of items [{...}]
  if (Array.isArray(json)) {
    json.forEach(item => {
      const category = item.category || "Uncategorized";
      out.push(normalizeItem(item, brandKey, regionKey, category));
    });
    return out;
  }

  return out;
}

/* ---------- UI Rendering ---------- */
function renderRegions(brandKey) {
  const regions = Object.keys(DATASETS[brandKey] || {});
  dom.region.innerHTML = "";
  regions.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r;
    opt.textContent = regionLabel(r);
    dom.region.appendChild(opt);
  });

  // keep current if exists, otherwise first
  if (regions.includes(currentRegionKey)) {
    dom.region.value = currentRegionKey;
  } else {
    currentRegionKey = regions[0] || "us";
    dom.region.value = currentRegionKey;
  }
}

function renderCategories(items) {
  const cats = ["All", ...Array.from(new Set(items.map(i => i.category))).sort()];
  dom.category.innerHTML = "";
  cats.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c === "All" ? "All Categories" : c;
    dom.category.appendChild(opt);
  });
  dom.category.value = "All";
}

function getFilteredMenu() {
  const q = (dom.search.value || "").trim().toLowerCase();
  const cat = dom.category.value || "All";

  return masterMenu.filter(i => {
    const matchCat = (cat === "All") ? true : i.category === cat;
    const matchQ = q ? i.name.toLowerCase().includes(q) : true;
    return matchCat && matchQ;
  });
}

function renderMenuList() {
  const items = getFilteredMenu();
  dom.menu.innerHTML = "";

  if (!items.length) {
    dom.menu.innerHTML = `<div class="empty-state">No items found for this dataset.</div>`;
    return;
  }

  const frag = document.createDocumentFragment();
  items.forEach(item => {
    const card = document.createElement("div");
    card.className = "item-card";
    card.innerHTML = `
      <div class="item-left">
        <div class="item-name">${item.name}</div>
        <div class="item-sub">${Math.round(item.calories)} kcal</div>
      </div>
      <button class="icon-btn add-btn" type="button" aria-label="Add item" title="Add">+</button>
    `;
    card.querySelector("button").addEventListener("click", () => addToMeal(item.id));
    frag.appendChild(card);
  });

  dom.menu.appendChild(frag);
}

function renderMeal() {
  dom.meal.innerHTML = "";

  if (!userMeal.length) {
    dom.meal.innerHTML = `<div class="empty-state">Add items to build your meal.</div>`;
    renderTotals();
    return;
  }

  const frag = document.createDocumentFragment();
  userMeal.forEach(item => {
    const row = document.createElement("div");
    row.className = "item-card meal-item";
    row.innerHTML = `
      <div class="item-left">
        <div class="item-name">${item.name}</div>
        <div class="item-sub">${Math.round(item.calories)} kcal</div>
      </div>

      <div class="qty-controls">
        <button type="button" class="qty-btn" aria-label="Decrease quantity">-</button>
        <div class="qty">${item.qty}</div>
        <button type="button" class="qty-btn" aria-label="Increase quantity">+</button>
        <button class="meal-remove" type="button" title="Remove" aria-label="Remove item"
          style="border:1px solid var(--border); background:transparent; border-radius:8px; width:34px; height:34px; cursor:pointer;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18"></path>
            <path d="M8 6V4h8v2"></path>
            <path d="M19 6l-1 14H6L5 6"></path>
          </svg>
        </button>
      </div>
    `;

    const [minusBtn, plusBtn] = row.querySelectorAll(".qty-btn");
    minusBtn.addEventListener("click", () => changeQty(item.id, -1));
    plusBtn.addEventListener("click", () => changeQty(item.id, +1));
    row.querySelector(".meal-remove").addEventListener("click", () => removeItem(item.id));

    frag.appendChild(row);
  });

  dom.meal.appendChild(frag);
  renderTotals();
}

function renderTotals() {
  const totals = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    sugar: 0,
    sodium: 0
  };

  userMeal.forEach(i => {
    totals.calories += num(i.calories) * i.qty;
    totals.protein  += num(i.protein)  * i.qty;
    totals.carbs    += num(i.carbs)    * i.qty;
    totals.fat      += num(i.fat)      * i.qty;
    totals.sugar    += num(i.sugar)    * i.qty;
    totals.sodium   += num(i.sodium)   * i.qty;
  });

  // Boxes exist in HTML with ids?
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  set("totalCal", Math.round(totals.calories));
  set("totalPro", totals.protein.toFixed(1));
  set("totalCarb", totals.carbs.toFixed(1));
  set("totalFat", totals.fat.toFixed(1));
  set("totalSug", totals.sugar.toFixed(1));
  set("totalSod", Math.round(totals.sodium));
}

/* ---------- Meal Ops ---------- */
function addToMeal(itemId) {
  const item = masterMenu.find(i => i.id === itemId);
  if (!item) return;

  const existing = userMeal.find(i => i.id === itemId);
  if (existing) {
    existing.qty += 1;
  } else {
    userMeal.push({ ...item, qty: 1 });
  }
  renderMeal();
}

function changeQty(itemId, delta) {
  const item = userMeal.find(i => i.id === itemId);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  renderMeal();
}

function removeItem(itemId) {
  userMeal = userMeal.filter(i => i.id !== itemId);
  renderMeal();
}

function clearMeal() {
  userMeal = [];
  renderMeal();
}

/* ---------- Data Loading ---------- */
async function loadDataset() {
  const path = DATASETS[currentBrandKey]?.[currentRegionKey];
  if (!path) {
    setStatusLinked(false);
    masterMenu = [];
    renderCategories(masterMenu);
    renderMenuList();
    return;
  }

  try {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    masterMenu = normalizeDataset(json, currentBrandKey, currentRegionKey);
    renderRegions(currentBrandKey); // keep in sync
    renderCategories(masterMenu);
    renderMenuList();
    updateItemCounter();
    setStatusLinked(true, currentBrandKey, currentRegionKey);
    updateSEOForBrand(currentBrandKey, currentRegionKey);
  } catch (e) {
    console.error("Dataset load failed:", e);
    masterMenu = [];
    dom.menu.innerHTML = `<div class="empty-state">Dataset could not be loaded. Please check file path in /data.</div>`;
    setStatusLinked(false);
  }
}

/* ---------- Theme ---------- */
function applyTheme(isDark) {
  document.body.classList.toggle("dark", isDark);
  if (dom.lightLabel && dom.darkLabel) {
    dom.lightLabel.classList.toggle("active", !isDark);
    dom.darkLabel.classList.toggle("active", isDark);
  }
  if (dom.theme) dom.theme.checked = isDark;
}

/* ---------- Events ---------- */
function bindEvents() {
  dom.tabs.forEach(btn => {
    btn.addEventListener("click", () => {
      dom.tabs.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      currentBrandKey = toBrandKey(btn.dataset.brand);
      // reset region to default for new brand (prefer US if exists)
      const regions = Object.keys(DATASETS[currentBrandKey] || {});
      currentRegionKey = regions.includes("us") ? "us" : (regions[0] || "us");

      renderRegions(currentBrandKey);
      clearMeal(); // optional: keep meal brand-consistent
      loadDataset();
    });
  });

  dom.region.addEventListener("change", () => {
    currentRegionKey = dom.region.value;
    clearMeal(); // keep dataset-consistent
    loadDataset();
  });

  dom.category.addEventListener("change", renderMenuList);
  dom.search.addEventListener("input", renderMenuList);

  if (dom.resetMeal) dom.resetMeal.addEventListener("click", clearMeal);

  if (dom.theme) {
    dom.theme.addEventListener("change", () => {
      applyTheme(dom.theme.checked);
      try { localStorage.setItem("wws_theme", dom.theme.checked ? "dark" : "light"); } catch {}
    });
  }
}

/* ---------- Init ---------- */
function init() {
  // Theme
  let isDark = false;
  try { isDark = (localStorage.getItem("wws_theme") === "dark"); } catch {}
  applyTheme(isDark);

  // Default brand + region
  currentBrandKey = "starbucks";
  currentRegionKey = "us";

  // Activate correct tab
  dom.tabs.forEach(b => {
    const k = toBrandKey(b.dataset.brand);
    b.classList.toggle("active", k === currentBrandKey);
  });

  renderRegions(currentBrandKey);
  bindEvents();
  loadDataset();
  renderMeal();
}

document.addEventListener("DOMContentLoaded", init);




/* ---------- Item Counter ---------- */
function updateItemCounter() {
  const el = document.getElementById("itemCounter");
  if (!el) return;
  el.textContent = `${masterMenu.length} items`;
}

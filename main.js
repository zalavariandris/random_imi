// -----------------------------------------------------
// CONFIG
// -----------------------------------------------------
const SHEET_ID = "1MqRSj_s91_i1is965PLkFtHD6QEym8SS3Z6I5PPNzfU"; 
const SHEET_NAME = "Sheet1";

// cache keys
const CACHE_KEY = "sheet_cache_data_v1";
const CACHE_HEADERS = "sheet_cache_headers_v1";

let ROW_DATA = [];
let HEADERS = [];

// Progress bar
function setProgress(p) {
  document.getElementById("loadingBar").style.width = p + "%";
}

// Load from cache if possible
function loadFromCache() {
  try {
    const rows = localStorage.getItem(CACHE_KEY);
    const headers = localStorage.getItem(CACHE_HEADERS);
    if (!rows || !headers) return false;

    ROW_DATA = JSON.parse(rows);
    HEADERS = JSON.parse(headers);
    return true;
  } catch (e) {
    console.warn("Failed to load cache:", e);
    return false;
  }
}

function saveToCache() {
  localStorage.setItem(CACHE_KEY, JSON.stringify(ROW_DATA));
  localStorage.setItem(CACHE_HEADERS, JSON.stringify(HEADERS));
}

// Parse Google Sheets GViz JSON
function parseGViz(text) {
  const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
  return JSON.parse(match[1]);
}

// Render table from cached data
function renderCachedTable() {
  const table = document.getElementById("sheetTable");
  table.innerHTML = "";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  HEADERS.forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  ROW_DATA.forEach(row => {
    const tr = document.createElement("tr");
    row.forEach(val => {
      const td = document.createElement("td");
      td.textContent = val;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
}

// Full loading process
async function loadSheet() {
  // Try cache first
  if (loadFromCache()) {
    console.log("Loaded from cache");
    renderCachedTable();
    document.getElementById("randomBox").style.display = "block";
    document.getElementById("loading").style.display = "none";
    return;
  }

  setProgress(15);

  // Build URL
  const base = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?`;
  const params = new URLSearchParams({ tqx: "out:json" });
  if (SHEET_NAME) params.set("sheet", SHEET_NAME);
  const url = base + params.toString();

  const response = await fetch(url);
  setProgress(50);

  const text = await response.text();
  setProgress(75);

  const json = parseGViz(text);

  // Extract headers
  HEADERS = json.table.cols.map(c => c.label || "");

  // Extract rows into usable form
  ROW_DATA = json.table.rows.map(r =>
    json.table.cols.map((_, i) => {
      const cell = r.c[i];
      return cell ? (cell.f ?? cell.v ?? "") : "";
    })
  );

  setProgress(90);

  // Render
  renderCachedTable();

  // Cache the parsed data
  saveToCache();

  setProgress(100);
  setTimeout(() => {
    document.getElementById("loading").style.display = "none";
  }, 300);

  document.getElementById("randomBox").style.display = "block";
}

// Random row selection: use only columns 1-3
function chooseRandom() {
  if (ROW_DATA.length === 0) return;

  const random = ROW_DATA[Math.floor(Math.random() * ROW_DATA.length)];
  const container = document.getElementById("randomContent");
  container.innerHTML = "";

  const title = random[0] || "No title";
  const description = random[1] || "";
  const link = random[2] || "";

  const titleBox = document.createElement("div");
  titleBox.className = "cell-box";
  titleBox.innerHTML = `<div class="cell-label">Title</div><div class="cell-value">${title}</div>`;

  const descBox = document.createElement("div");
  descBox.className = "cell-box";
  descBox.innerHTML = `<div class="cell-label">Description</div><div class="cell-value">${description}</div>`;

  const linkBox = document.createElement("div");
  linkBox.className = "cell-box";
  linkBox.innerHTML = `<div class="cell-label">Source</div><div class="cell-value"><a href="${link}" target="_blank">${link}</a></div>`;

  container.appendChild(titleBox);
  container.appendChild(descBox);
  container.appendChild(linkBox);
}

// Setup once DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("randomBtn").addEventListener("click", chooseRandom);
  loadSheet();
});

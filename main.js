// -----------------------------------------------------
// CONFIG
// -----------------------------------------------------
const SHEET_ID = "1MqRSj_s91_i1is965PLkFtHD6QEym8SS3Z6I5PPNzfU"; 
const SHEET_NAME = "Sheet1";

// IndexedDB config
const DB_NAME = "movieDB";
const STORE_NAME = "sheetData";

let ROW_DATA = [];
let HEADERS = [];

// Open IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

// Save data to IndexedDB
async function saveToDB(data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(data, "sheet"); // key = "sheet"
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Load data from IndexedDB
async function loadFromDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get("sheet");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Progress bar
function setProgress(p) {
  document.getElementById("loadingBar").style.width = p + "%";
}

// Parse GViz response
function parseGViz(text) {
  const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
  return JSON.parse(match[1]);
}

// Render table
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

// Load sheet
async function loadSheet() {
  // Try IndexedDB first
  try {
    const cached = await loadFromDB();
    if (cached) {
      ROW_DATA = cached.rows;
      HEADERS = cached.headers;
      renderCachedTable();
      document.getElementById("randomBox").style.display = "block";
      document.getElementById("loading").style.display = "none";
      console.log("Loaded from IndexedDB");
      return;
    }
  } catch(e) {
    console.warn("IndexedDB read failed:", e);
  }

  // Fetch from Google Sheets
  setProgress(10);
  const base = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?`;
  const params = new URLSearchParams({ tqx: "out:json" });
  if (SHEET_NAME) params.set("sheet", SHEET_NAME);
  const url = base + params.toString();

  const response = await fetch(url);
  setProgress(50);
  const text = await response.text();
  setProgress(75);

  const json = parseGViz(text);

  HEADERS = json.table.cols.map(c => c.label || "");
  ROW_DATA = json.table.rows.map(r =>
    json.table.cols.map((_, i) => {
      const cell = r.c[i];
      return cell ? (cell.f ?? cell.v ?? "") : "";
    })
  );

  setProgress(90);
  renderCachedTable();

  // Save to IndexedDB
  try {
    await saveToDB({ headers: HEADERS, rows: ROW_DATA });
    console.log("Saved to IndexedDB");
  } catch(e) {
    console.warn("IndexedDB write failed:", e);
  }

  setProgress(100);
  setTimeout(() => { document.getElementById("loading").style.display = "none"; }, 300);
  document.getElementById("randomBox").style.display = "block";
}

// Random selection: only columns 1-3
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

// Setup
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("randomBtn").addEventListener("click", chooseRandom);
  loadSheet();
});

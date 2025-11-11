const NEPSE_API = "https://nepsetty.kokomo.workers.dev/api/stock";

// --- Nepal Time helpers ---
function getNepalTime() {
  const utc = new Date();
  return new Date(utc.getTime() + 5.75 * 3600 * 1000); // +5:45
}

function getNepalDate() {
  return getNepalTime().toISOString().split("T")[0];
}

// --- Storage helpers ---
async function getStockSymbol() {
  const data = await chrome.storage.sync.get(["symbol"]);
  return data.symbol || "NMIC";
}

async function setClosePrice(symbol, price) {
  const key = `close_${symbol}`;
  const closeData = { price, date: getNepalDate() };
  await chrome.storage.local.set({ [key]: closeData });
}

async function saveLastLTP(symbol, ltp, changePercent) {
  await chrome.storage.local.set({ lastStock: { symbol, ltp, changePercent } });
}

// --- Update badge ---
async function updateBadge(ltp, change, changePercent, symbol, closePrice) {
  chrome.action.setBadgeText({ text: ltp.toString() });

  const now = getNepalTime();
  let color = "#808080"; // Default: grey

  if (now.getHours() < 15) {
    if (change > 0) color = "#4CAF50"; // green
    else if (change < 0) color = "#FF0000"; // red
  } else {
    color = "#808080"; // After 3 PM → grey (market closed)
  }

  chrome.action.setBadgeBackgroundColor({ color });

  chrome.action.setTitle({
    title: `${symbol}\nLTP: ${ltp}\nOfficial Close: ${closePrice}\nChange: ${change.toFixed(
      2
    )} (${changePercent}%)`,
  });
}

// --- Fetch stock price ---
async function fetchAndSetPrice() {
  const symbol = await getStockSymbol();

  try {
    const response = await fetch(`${NEPSE_API}?symbol=${symbol}`);
    const data = await response.json();
    const ltp = data.ltp;

    const key = `close_${symbol}`;
    const savedData = (await chrome.storage.local.get([key]))[key];
    let closePrice = savedData?.price || ltp;
    const nowNPT = getNepalTime();

    // Save official close after 3 PM
    if (nowNPT.getHours() >= 15 && savedData?.date !== getNepalDate()) {
      await setClosePrice(symbol, ltp);
      closePrice = ltp;
    }

    const change = ltp - closePrice;
    const changePercent = ((change / closePrice) * 100).toFixed(2);

    await updateBadge(ltp, change, changePercent, symbol, closePrice);
    await saveLastLTP(symbol, ltp, changePercent);

  } catch (err) {
    console.error("Error fetching stock price:", err);
    chrome.action.setBadgeText({ text: "ERR" });
    chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
    chrome.action.setTitle({ title: "Error fetching stock price" });
  }
}

// --- Restore badge from last LTP ---
async function restoreBadge() {
  const data = await chrome.storage.local.get(["lastStock"]);
  if (data.lastStock) {
    const { symbol, ltp, changePercent } = data.lastStock;
    const now = getNepalTime();

    let color = "#808080";
    if (now.getHours() < 15) {
      if (changePercent > 0) color = "#4CAF50";
      else if (changePercent < 0) color = "#FF0000";
    }

    chrome.action.setBadgeText({ text: ltp.toString() });
    chrome.action.setBadgeBackgroundColor({ color });
    chrome.action.setTitle({
      title: `${symbol}\nLTP: ${ltp}\nChange: ${changePercent}%`,
    });
  }
}

// --- Symbol change listener ---
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "sync" && changes.symbol) fetchAndSetPrice();
});

// --- Message listener from popup ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "FETCH_PRICE") {
    fetchAndSetPrice();
    sendResponse({ success: true });
  }
});

// --- On Chrome startup (after restart) ---
chrome.runtime.onStartup.addListener(() => {
  restoreBadge();
  fetchAndSetPrice();
});

// --- Initial run when extension loads ---
restoreBadge();
fetchAndSetPrice();

// --- Reliable auto refresh every 1 minute ---
chrome.alarms.create("priceUpdate", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "priceUpdate") {
    fetchAndSetPrice();
  }
});

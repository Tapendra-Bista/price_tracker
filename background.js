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
  chrome.action.setBadgeBackgroundColor({ color: "#000000" }); // Static black background

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
    // Add timestamp for cache-busting and no-cache headers
    const cacheBuster = Date.now();
    const response = await fetch(`${NEPSE_API}?symbol=${symbol}&t=${cacheBuster}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
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

    chrome.action.setBadgeText({ text: ltp.toString() });
    chrome.action.setBadgeBackgroundColor({ color: "#000000" }); // Static black background
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

// --- Keep service worker alive during market hours ---
let keepAliveInterval = null;
let updateInterval = null;

function keepServiceWorkerAlive() {
  // Prevent service worker from sleeping by periodic activity
  if (keepAliveInterval) clearInterval(keepAliveInterval);
  
  keepAliveInterval = setInterval(() => {
    // Dummy operation to keep worker alive
    chrome.storage.local.get(['keepAlive'], () => {
      // This keeps the service worker active
    });
  }, 20000); // Every 20 seconds
}

function startRealTimeUpdates() {
  const now = getNepalTime();
  const hour = now.getHours();
  
  // Only run during market hours (11 AM - 3 PM Nepal Time)
  if (hour < 11 || hour >= 15) {
    if (updateInterval) clearInterval(updateInterval);
    if (keepAliveInterval) clearInterval(keepAliveInterval);
    updateInterval = null;
    keepAliveInterval = null;
    return;
  }
  
  // Clear any existing intervals
  if (updateInterval) clearInterval(updateInterval);
  if (keepAliveInterval) clearInterval(keepAliveInterval);
  
  // Keep service worker alive
  keepServiceWorkerAlive();
  
  // Update every 5 seconds during market hours
  updateInterval = setInterval(() => {
    const now = getNepalTime();
    if (now.getHours() >= 11 && now.getHours() < 15) {
      fetchAndSetPrice();
    } else {
      // Stop intervals after market closes
      clearInterval(updateInterval);
      clearInterval(keepAliveInterval);
      updateInterval = null;
      keepAliveInterval = null;
    }
  }, 5000); // 5 seconds for real-time updates
}

// Start real-time updates immediately
startRealTimeUpdates();

// Chrome alarm every 1 minute to restart if service worker was sleeping
chrome.alarms.create("priceUpdate", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "priceUpdate") {
    const now = getNepalTime();
    if (now.getHours() >= 11 && now.getHours() < 15) {
      fetchAndSetPrice();
      // Restart intervals if they stopped
      if (!updateInterval) {
        startRealTimeUpdates();
      }
    }
  }
});

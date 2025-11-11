// popup.js

document.addEventListener("DOMContentLoaded", async () => {
  const input = document.getElementById("stockSymbolInput");
  const btn = document.getElementById("setSymbolBtn");

  // Clear input on open
  input.value = "";

  // Optional: show last used symbol as placeholder
  const data = await chrome.storage.sync.get(["symbol"]);
  if (data.symbol) {
    input.placeholder = data.symbol.toUpperCase();
  }

  // Handle "Set Symbol" button click
  btn.addEventListener("click", async () => {
    const symbol = input.value.trim().toUpperCase();
    if (!symbol) return;

    // Save symbol in storage (triggers background fetch via onChanged)
    await chrome.storage.sync.set({ symbol });

    // Optional: safe message trigger (not necessary but included)
    try {
      chrome.runtime.sendMessage({ type: "FETCH_PRICE" }, (response) => {
        if (chrome.runtime.lastError) {
          // SW might be idle, but storage change already triggers fetch
          console.warn("Background SW not active yet:", chrome.runtime.lastError.message);
        } else if (response?.success) {
          console.log("Price fetch triggered via message");
        }
      });
    } catch (err) {
      console.error("Error sending message to background:", err);
    }

    // Clear input after saving
    input.value = "";
  });
});

# 📈 NEPSE Price Tracker Chrome Extension

A lightweight Chrome/Brave extension that tracks **live NEPSE stock prices** and displays the **Last Traded Price (LTP)** right on your browser toolbar.  
It auto-updates every minute, shows real-time change percentages, and automatically greys out after market hours.

---

## 🚀 Features

✅ **Live NEPSE Stock Tracking** — Fetches real-time LTP from a proxy API  
✅ **Badge Display** — Shows current LTP on the extension icon  
✅ **Color Indicator**
- 🟢 Green — Price up  
- 🔴 Red — Price down  
- ⚫ Grey — Market closed (after 3 PM NPT)

✅ **Automatic Updates**
- Refreshes every minute using Chrome alarms  
- Restores the last saved value even after restarting the browser  

✅ **Popup Interface (Optional)**
- Users can open the popup to refresh or change the stock symbol  

---

## 🧩 Files Overview

| File | Purpose |
|------|----------|
| `manifest.json` | Defines permissions, background service worker, and extension action |
| `background.js` | Core logic: fetching prices, updating badge, managing local storage |
| `popup.html` | Optional UI for manual refresh or symbol selection |
| `icon16.png`, `icon48.png`, `icon128.png` | Extension icons (toolbar, store, etc.) |
| `README.md` | Documentation and setup guide |

---

## ⚙️ Permissions Explained

| Permission | Why it's needed |
|-------------|----------------|
| `storage` | To remember your selected stock symbol and last LTP |
| `alarms` | To schedule automatic updates every minute |
| `host_permissions` | To fetch live stock data from the NEPSE API endpoint |

---

## 🧰 Installation Guide

1. **Clone or Download** this repository  
   ```bash
   git clone https://github.com/yourusername/nepse-price-tracker.git

document.addEventListener("DOMContentLoaded", async () => {
  const tabLimitSlider = document.getElementById("tab-limit-slider");
  const tabLimitNumber = document.getElementById("tab-limit-number");
  const recentlyClosedList = document.getElementById("recently-closed-list");
  const liTemplate = document.getElementById("li_template");

  // Load initial settings
  const settings = await chrome.storage.sync.get("tabLimit");
  const initialTabLimit = settings.tabLimit || 10;
  tabLimitSlider.value = initialTabLimit;
  tabLimitNumber.value = initialTabLimit;

  // Load recently closed tabs
  const localData = await chrome.storage.local.get("recentlyClosed");
  const recentlyClosed = localData.recentlyClosed || [];
  populateRecentlyClosedList(recentlyClosed);

  // Synchronize slider and number input
  tabLimitSlider.addEventListener("input", () => {
    tabLimitNumber.value = tabLimitSlider.value;
    saveTabLimit();
  });

  tabLimitNumber.addEventListener("input", () => {
    // Basic validation
    let value = parseInt(tabLimitNumber.value, 10);
    if (isNaN(value) || value < 1) value = 1;
    if (value > 50) value = 50;
    tabLimitNumber.value = value;

    tabLimitSlider.value = tabLimitNumber.value;
    saveTabLimit();
  });

  // Save tab limit to storage
  function saveTabLimit() {
    const newLimit = parseInt(tabLimitNumber.value, 10);
    if (!isNaN(newLimit)) {
      chrome.storage.sync.set({ tabLimit: newLimit });
    }
  }

  // Populate the list of recently closed tabs
  function populateRecentlyClosedList(tabs) {
    recentlyClosedList.innerHTML = ""; // Clear existing list
    if (tabs.length === 0) {
      const emptyMessage = document.createElement("li");
      emptyMessage.textContent = "No recently closed tabs.";
      emptyMessage.style.padding = "0.75rem";
      recentlyClosedList.appendChild(emptyMessage);
      return;
    }

    tabs.forEach(tab => {
      const li = liTemplate.content.cloneNode(true);
      const a = li.querySelector("a");
      const p = li.querySelector(".tab-title");

      a.href = tab.url;
      p.textContent = tab.title || tab.url;
      p.title = tab.title || tab.url; // Show full title on hover

      a.addEventListener("click", (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: tab.url });
      });

      recentlyClosedList.appendChild(li);
    });
  }
});
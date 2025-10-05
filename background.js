let tabLimit = 10;
let recentlyClosed = [];
const tabUsageTimestamps = new Map();
const windowMap = new Map();

console.log("BACKGROUND SCRIPT LOADED");

async function initialize() {
    console.log("Initializing...");
    const settings = await chrome.storage.sync.get({ tabLimit: 10 });
    tabLimit = settings.tabLimit;
    console.log(`Tab limit set to: ${tabLimit}`);

    const localData = await chrome.storage.local.get({ recentlyClosed: [] });
    recentlyClosed = localData.recentlyClosed;

    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
        if (!tabUsageTimestamps.has(tab.id)) {
            tabUsageTimestamps.set(tab.id, Date.now());
        }
        if (!windowMap.has(tab.windowId)) {
            windowMap.set(tab.windowId, new Set());
        }
        windowMap.get(tab.windowId).add(tab.id);
    }
    console.log("Initialization complete. Current state:", JSON.stringify([...windowMap]));
}

async function storeRecentlyClosed(tab) {
    if (tab && tab.url && tab.url.startsWith("http")) {
        console.log(`Storing recently closed tab: ${tab.title}`);
        recentlyClosed.unshift({ url: tab.url, title: tab.title || tab.url });
        if (recentlyClosed.length > 10) {
            recentlyClosed.pop();
        }
        await chrome.storage.local.set({ recentlyClosed });
    }
}

function findLruTab(windowId) {
    const windowTabs = windowMap.get(windowId);
    if (!windowTabs || windowTabs.size === 0) return null;

    let lruTabId = null;
    let oldestTimestamp = Infinity;

    console.log("--- Finding LRU Tab ---");
    for (const tabId of windowTabs) {
        const timestamp = tabUsageTimestamps.get(tabId) || 0;
        console.log(`Tab: ${tabId}, Timestamp: ${timestamp}`);
        if (timestamp < oldestTimestamp) {
            oldestTimestamp = timestamp;
            lruTabId = tabId;
        }
    }
    console.log(`LRU Tab identified: ${lruTabId}`);
    console.log("-----------------------");
    return lruTabId;
}

async function handleTabCreated(tab) {
    console.log(`Tab CREATED: ${tab.id} (${tab.title})`);
    if (!windowMap.has(tab.windowId)) {
        windowMap.set(tab.windowId, new Set());
    }
    windowMap.get(tab.windowId).add(tab.id);
    tabUsageTimestamps.set(tab.id, Date.now());
    console.log(`Timestamp for ${tab.id} set to: ${tabUsageTimestamps.get(tab.id)}`);


    const windowTabs = windowMap.get(tab.windowId);
    console.log(`Window ${tab.windowId} now has ${windowTabs.size} tabs.`);
    if (windowTabs.size > tabLimit) {
        console.log("Tab limit exceeded. Finding LRU tab to close.");
        const tabToCloseId = findLruTab(tab.windowId);
        if (tabToCloseId) {
            try {
                const tabToClose = await chrome.tabs.get(tabToCloseId);
                console.log(`Closing tab: ${tabToCloseId} (${tabToClose.title})`);
                await storeRecentlyClosed(tabToClose);
                await chrome.tabs.remove(tabToCloseId);
            } catch (error) {
                console.warn(`Could not close tab ${tabToCloseId}: ${error.message}`);
                handleTabRemoved(tabToCloseId, { windowId: tab.windowId });
            }
        }
    }
}

function handleTabActivated({ tabId, windowId }) {
    console.log(`Tab ACTIVATED: ${tabId}`);
    tabUsageTimestamps.set(tabId, Date.now());
    console.log(`Timestamp for ${tabId} updated to: ${tabUsageTimestamps.get(tabId)}`);
}

function handleTabRemoved(tabId, { windowId }) {
    console.log(`Tab REMOVED: ${tabId}`);
    tabUsageTimestamps.delete(tabId);
    const windowTabs = windowMap.get(windowId);
    if (windowTabs) {
        windowTabs.delete(tabId);
    }
}

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.tabLimit) {
        tabLimit = changes.tabLimit.newValue;
        console.log(`Tab limit changed to: ${tabLimit}`);
    }
});

chrome.tabs.onCreated.addListener(handleTabCreated);
chrome.tabs.onActivated.addListener(handleTabActivated);
chrome.tabs.onRemoved.addListener(handleTabRemoved);

initialize();
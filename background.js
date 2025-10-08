let tabLimit = 10;
let prioritizeEmptyTabs = false;
let recentlyClosed = [];
const windowMap = new Map();

console.log("BACKGROUND SCRIPT LOADED");

async function initialize() {
    console.log("Initializing...");
    const settings = await chrome.storage.sync.get({
        tabLimit: 10,
        prioritizeEmptyTabs: false
    });
    tabLimit = settings.tabLimit;
    prioritizeEmptyTabs = settings.prioritizeEmptyTabs;
    console.log(`Tab limit set to: ${tabLimit}`);
    console.log(`Prioritize empty tabs: ${prioritizeEmptyTabs}`);

    const localData = await chrome.storage.local.get({ recentlyClosed: [] });
    recentlyClosed = localData.recentlyClosed;

    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
        if (!windowMap.has(tab.windowId)) {
            windowMap.set(tab.windowId, []);
        }
        windowMap.get(tab.windowId).push(tab.id);
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

function isPriorityTab(tab) {
    if (!tab || !tab.url) return false;

    // Check for new tab page (empty tabs)
    if (tab.url === 'chrome://newtab/' ||
        tab.url === 'chrome://new-tab-page/' ||
        tab.url === 'about:newtab' ||
        tab.url === 'edge://newtab/' ||
        tab.title === 'New Tab') {
        return true;
    }

    // Check for Google search pages
    if (tab.url.includes('google.com/search') ||
        tab.url.includes('google.com/?')) {
        return true;
    }

    return false;
}

async function findTabToClose(windowId) {
    const windowTabs = windowMap.get(windowId);
    if (!windowTabs || windowTabs.length === 0) return null;

    if (prioritizeEmptyTabs) {
        // First, try to find a priority tab (empty or Google search)
        for (const tabId of windowTabs) {
            try {
                const tab = await chrome.tabs.get(tabId);
                if (isPriorityTab(tab)) {
                    console.log(`Found priority tab to close: ${tabId} (${tab.url})`);
                    return tabId;
                }
            } catch (error) {
                // Tab might not exist anymore, continue
                continue;
            }
        }
    }

    // Fall back to FIFO (oldest tab)
    return windowTabs[0];
}

async function handleTabCreated(tab) {
    console.log(`Tab CREATED: ${tab.id} (${tab.title})`);
    if (!windowMap.has(tab.windowId)) {
        windowMap.set(tab.windowId, []);
    }
    const windowTabs = windowMap.get(tab.windowId);
    windowTabs.push(tab.id);

    console.log(`Window ${tab.windowId} now has ${windowTabs.length} tabs.`);
    if (windowTabs.length > tabLimit) {
        console.log("Tab limit exceeded. Finding tab to close.");
        const tabToCloseId = await findTabToClose(tab.windowId);
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
    const windowTabs = windowMap.get(windowId);
    if (windowTabs) {
        const index = windowTabs.indexOf(tabId);
        if (index !== -1) {
            windowTabs.splice(index, 1);
            windowTabs.push(tabId);
        }
    }
}

function handleTabRemoved(tabId, { windowId }) {
    console.log(`Tab REMOVED: ${tabId}`);
    const windowTabs = windowMap.get(windowId);
    if (windowTabs) {
        const index = windowTabs.indexOf(tabId);
        if (index !== -1) {
            windowTabs.splice(index, 1);
        }
    }
}

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
        if (changes.tabLimit) {
            tabLimit = changes.tabLimit.newValue;
            console.log(`Tab limit changed to: ${tabLimit}`);
        }
        if (changes.prioritizeEmptyTabs) {
            prioritizeEmptyTabs = changes.prioritizeEmptyTabs.newValue;
            console.log(`Prioritize empty tabs changed to: ${prioritizeEmptyTabs}`);
        }
    }
});

chrome.tabs.onCreated.addListener(handleTabCreated);
chrome.tabs.onActivated.addListener(handleTabActivated);
chrome.tabs.onRemoved.addListener(handleTabRemoved);

initialize();
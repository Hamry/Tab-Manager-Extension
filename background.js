const windowMap = new Map();
const tabNumber = 10;

chrome.tabs.query({}, function handleTabs(tabs) {
  // Named function
  tabs.forEach((tab) => {
    if (windowMap.has(tab.windowId)) {
      windowMap.get(tab.windowId).push(tab.id);
    } else {
      windowMap.set(tab.windowId, [tab.id]);
    }
  });
});

function addTab(tab) {
  let window = tab.windowId;
  let id = tab.id;
  if (!windowMap.has(window)) {
    windowMap.set(window, [id]);
    return;
  }
  let tabList = windowMap.get(window);
  tabList.push(id);
  console.log(tabList, tab);
  if (tabList.length >= tabNumber) {
    let tabToClose = tabList.shift();

    chrome.tabs.remove(tabToClose);
    console.log("CLOSING TAB", tabToClose);
  }

  return;
}
function closeTab(id, window) {
  let tabList = windowMap.get(window).filter((item) => item !== id);
  const index = tabList.indexOf(id);
  if (index !== -1) {
    tabList.splice(index, 1);
    console.log(tabList);
  }
  //windowMap.set(window, tabList);
}

function activateTab(activeInfo) {
  console.log("activateTab-----------------------------");
  let window = activeInfo.windowId;
  let id = activeInfo.tabId;
  let tabList = windowMap.get(window);
  console.log(window, id, tabList);
  const index = tabList.indexOf(id);
  if (index !== -1) {
    tabList.splice(index, 1);
  }
  // Add it to the end
  tabList.push(id);
  console.log("end activateTab -----------------------------");
}

chrome.tabs.onCreated.addListener(function (tab) {
  console.log("A new tab was created:", tab);
  addTab(tab);
});

chrome.tabs.onActivated.addListener(function (activeInfo) {
  activateTab(activeInfo);
  console.log("A tab was activated:", activeInfo);
});

chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
  const windowId = removeInfo.windowId;

  closeTab(tabId, windowId);
  console.log(tabId, removeInfo);
});

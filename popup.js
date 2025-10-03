chrome.storage.sync.set({ mySetting: value }, function() {
  console.log("Setting saved!");
});

const tabs = await chrome.tabs.query({}, function (tabs) {
  console.log(tabs);
});

chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  // 'tabs[0]' is the active tab in the current window
  console.log(tabs[0]);
});

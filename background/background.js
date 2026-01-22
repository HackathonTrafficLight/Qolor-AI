chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message from content:", message);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "NEW_VIDEO") {
    // 현재는 콘솔에만 출력합니다.
    // TODO: 향후 이 부분에 Firebase와 통신하여 데이터를 저장하는 로직을 추가합니다.
    console.log("--- New Video from Content Script ---");
    console.log(`URL: ${message.url}`);
    console.log(`Video ID: ${message.videoId}`);
    console.log("-------------------------------------");

    // Content script에 응답 전송
    sendResponse({ status: "Received" });
  }

  // 비동기 메시지 처리를 위해 true를 반환해야 할 수 있습니다.
  return true;
});

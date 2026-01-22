let lastVideoId = null;

// UI 생성
function createUI() {
  if (document.getElementById('my-island-container')) return;

  const el = document.createElement('div');
  el.id = 'my-island-container';
  el.textContent = 'Ready to collect videos...';
  el.style.position = 'fixed';
  el.style.top = '12px';
  el.style.left = '50%';
  el.style.transform = 'translateX(-50%)';
  el.style.zIndex = '9999';
  el.style.background = 'black';
  el.style.color = 'white';
  el.style.padding = '6px 12px';
  el.style.borderRadius = '999px';
  el.style.fontSize = '14px';
  document.body.appendChild(el);
}

// URL에서 videoID 추출
function getVideoId(url) {
  try {
    const u = new URL(url);
    const v = u.searchParams.get("v");
    if (v) return v;
    if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/shorts/")[1]?.split("/")[0];
    return null;
  } catch {
    return null;
  }
}

// UI 업데이트
function updateUI(videoId, status) {
  const el = document.getElementById('my-island-container');
  if (el) el.textContent = `Video ID: ${videoId} → ${status}`;
}

// videoID 처리
function processVideo() {
  const videoId = getVideoId(location.href);
  if (!videoId || videoId === lastVideoId) return;

  lastVideoId = videoId;
  console.log('[Content Script] New video:', videoId); // 페이지 콘솔에서 확인 가능

  chrome.runtime.sendMessage({
    type: 'NEW_VIDEO',
    videoId,
    url: location.href
  }, (response) => {
    updateUI(videoId, response?.status || "Error");
  });
}

// 실행
createUI();
processVideo();
window.addEventListener('yt-navigate-finish', processVideo);

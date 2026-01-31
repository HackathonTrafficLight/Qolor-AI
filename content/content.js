// 상태별 SVG 아이콘 정의
const ICONS = {
  // ✅ [Verified] 체크 아이콘
  verified: `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2.5" y="2.5" width="19" height="19" rx="9.5" fill="#04B014" fill-opacity="0.1"/>
    <rect x="2.5" y="2.5" width="19" height="19" rx="9.5" stroke="#04B014"/>
    <path d="M8 12.5L11 15L16 9" stroke="#04B014" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `,

  // ❌ [Misleading] X 아이콘
  misleading: `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2.5" y="2.5" width="19" height="19" rx="9.5" fill="#DC0000" fill-opacity="0.1"/>
    <rect x="2.5" y="2.5" width="19" height="19" rx="9.5" stroke="#DC0000"/>
    <path d="M16 8L8 16" stroke="#DC0000" stroke-width="1.25" stroke-linecap="round"/>
    <path d="M16 16L8 8" stroke="#DC0000" stroke-width="1.25" stroke-linecap="round"/>
    </svg>
  `,

  // 🔍 [Not Analyzed] 돋보기 아이콘
  "not-analyzed": `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clip-path="url(#clip0_438_1887)">
    <rect x="2" y="2" width="20" height="20" rx="10" fill="#FFAA00" fill-opacity="0.1"/>
    <rect x="19.6777" y="4" width="1" height="25" transform="rotate(45 19.6777 4)" fill="#FFAA00"/>
    <path d="M11.25 14.5C13.0449 14.5 14.5 13.0449 14.5 11.25C14.5 9.45507 13.0449 8 11.25 8C9.45507 8 8 9.45507 8 11.25C8 13.0449 9.45507 14.5 11.25 14.5Z" stroke="#FFAA00" stroke-miterlimit="10"/>
    <path d="M15.6464 16.3536C15.8417 16.5488 16.1583 16.5488 16.3536 16.3536C16.5488 16.1583 16.5488 15.8417 16.3536 15.6464L16 16L15.6464 16.3536ZM13.5 13.5L13.1464 13.8536L15.6464 16.3536L16 16L16.3536 15.6464L13.8536 13.1464L13.5 13.5Z" fill="#FFAA00"/>
    </g>
    <rect x="2.5" y="2.5" width="19" height="19" rx="9.5" stroke="#FFAA00"/>
    <defs>
    <clipPath id="clip0_438_1887">
    <rect x="2" y="2" width="20" height="20" rx="10" fill="white"/>
    </clipPath>
    </defs>
    </svg>
  `,
  
  // 🔄 [Default] Qolor-AI 기본 로고 아이콘
  default: `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="16.8198" y="18.0361" width="2.13333" height="1.96786" transform="rotate(-55.7178 16.8198 18.0361)" fill="#989898"/>
    <path d="M18.5306 16.6208C17.7281 17.7549 16.6441 18.6605 15.3853 19.2485C14.1264 19.8364 12.7362 20.0863 11.3514 19.9737C9.9666 19.861 8.63503 19.3897 7.48776 18.606C6.34049 17.8224 5.41709 16.7535 4.80846 15.5045C4.19983 14.2556 3.92696 12.8696 4.01671 11.4832C4.10647 10.0967 4.55575 8.75756 5.32033 7.5975C6.08491 6.43744 7.13843 5.49651 8.37716 4.86733C9.61589 4.23815 10.9971 3.94242 12.3849 4.00926L12.2821 6.14279C11.2649 6.0938 10.2524 6.31056 9.34446 6.77175C8.43647 7.23294 7.66424 7.92265 7.1038 8.77297C6.54337 9.62329 6.21404 10.6049 6.14825 11.6212C6.08246 12.6375 6.28247 13.6533 6.7286 14.5688C7.17473 15.4843 7.85158 16.2678 8.69253 16.8422C9.53348 17.4166 10.5095 17.7621 11.5246 17.8447C12.5396 17.9273 13.5587 17.7441 14.4814 17.3131C15.4041 16.8822 16.1987 16.2184 16.7869 15.387L18.5306 16.6208Z" fill="#989898"/>
    <path d="M12.9738 4.05948C14.1426 4.20282 15.2654 4.60244 16.262 5.22982L15.124 7.03746C14.3936 6.57759 13.5705 6.28467 12.7138 6.1796L12.9738 4.05948Z" fill="#04B014"/>
    <path d="M16.7471 5.56067C17.695 6.25945 18.4769 7.15888 19.0371 8.19475L17.1582 9.21075C16.7476 8.45146 16.1744 7.79218 15.4796 7.27997L16.7471 5.56067Z" fill="#FFAA00"/>
    <path d="M19.2582 8.63573C19.7534 9.70415 20.0067 10.8687 19.9999 12.0463L17.8639 12.034C17.8689 11.1708 17.6833 10.3171 17.3203 9.53399L19.2582 8.63573Z" fill="#FF1B1B"/>
    <path d="M10.3999 14.8442L14.5572 11.9997L10.3999 9.15527V14.8442Z" fill="#989898"/>
    </svg>
  `
};

let lastVideoId = null;

// UI를 생성하고 삽입하는 함수
function createAndInsertUI() {
  if (document.getElementById('my-island-container')) return;

  const el = document.createElement('div');
  el.id = 'my-island-container';
  el.innerHTML = `<span class="icon"></span><span>...</span>`; 

  const mastheadCenter = document.querySelector('#masthead #center');
  if (mastheadCenter) {
    mastheadCenter.before(el);
  } else {
    document.body.appendChild(el);
  }
}

// 특정 요소가 나타날 때까지 기다리는 함수
function waitForElement(selector, callback) {
  const interval = setInterval(() => {
    const element = document.querySelector(selector);
    if (element) {
      clearInterval(interval);
      callback();
    }
  }, 100);
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

// UI 상태를 업데이트하는 통합 함수 (SVG 아이콘 적용됨)
function updateUI(text, status) {
  const el = document.getElementById('my-island-container');
  if (el) {
    el.innerHTML = `<span class="icon"></span><span>${text}</span>`;
    const iconEl = el.querySelector('.icon');

    // 모든 상태 클래스 제거
    el.classList.remove('default', 'analyzing', 'verified', 'not-analyzed', 'misleading');

    // 새 상태 클래스 추가
    if (status) {
      el.classList.add(status);
    }

    // 아이콘 렌더링 로직
    if (status === 'analyzing') {
        // 분석 중 애니메이션은 CSS span으로 처리
        iconEl.innerHTML = '<span></span><span></span><span></span><span></span><span></span><span></span>'; 
    } else if (ICONS[status]) {
        // SVG 코드 주입
        iconEl.innerHTML = ICONS[status];
    } else {
        // 매칭 안될 시 기본값 아이콘 사용
        iconEl.innerHTML = ICONS['default'];
    }
  }
}

// videoID 처리
function processVideo() {
  const videoId = getVideoId(location.href);

  // 비디오 페이지가 아니면 기본 상태로 UI 업데이트 후 종료
  if (!videoId) {
    updateUI('YouTube<br>Reliability Analysis', 'default');
    return;
  }

  console.log('[Content Script] Processing video:', videoId);

  // 분석 중 상태로 UI 업데이트
  updateUI('Analysis', 'analyzing');

  chrome.runtime.sendMessage({
    type: 'NEW_VIDEO',
    videoId,
    url: location.href
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Message sending error:", chrome.runtime.lastError.message);
      updateUI("Extension Error", 'misleading');
      return;
    }

    if (response && response.analysisResult) {
      const { score } = response.analysisResult;
      if (score >= 70) {
        updateUI("Verified", "verified");
      } else {
        updateUI("Misleading", "misleading");
      }
    } else if (response && response.status) {
        // 'Not Analyzed' 상태 처리
        if (response.status === 'Not Analyzed') {
            updateUI('Not Analyzed', 'not-analyzed');
        } else {
            updateUI(response.status, 'default');
        }
    } else {
      updateUI("Analysis Error", 'misleading');
    }
  });
}

// 초기화 함수
function initialize() {
    waitForElement('#masthead #center', () => {
        const existingUI = document.getElementById('my-island-container');
        if (existingUI) {
            existingUI.remove();
        }
        createAndInsertUI();
        processVideo();
    });
}

// 최초 실행
initialize();

// 유튜브 내 페이지 이동 시 다시 실행
window.addEventListener('yt-navigate-finish', initialize);
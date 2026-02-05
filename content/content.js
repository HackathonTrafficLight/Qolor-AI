/**
 * ==========================================
 * 1. ASSETS & CONFIGURATION
 * ==========================================
 */
const CONFIG = {
  SELECTORS: {
    CONTAINER: 'my-island-container', // ID
    YOUTUBE_HEADER: '#masthead #center',
    ICON_WRAPPER: '.icon'
  },
  CLASSES: {
    DEFAULT: 'default',
    ANALYZING: 'analyzing',
    VERIFIED: 'verified',
    NOT_ANALYZED: 'not-analyzed',
    MISLEADING: 'misleading'
  },
  TEXT: {
    DEFAULT: 'Qolor AI',
    ANALYZING: 'Analysis',
    VERIFIED: 'Verified',
    MISLEADING: 'Misleading',
    NOT_ANALYZED: 'Not Analyzed',
    ERROR: 'Extension Error'
  },
  THRESHOLDS: {
    SAFE_SCORE: 80
  }
};

const ICONS = {
  verified: `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2.5" y="2.5" width="19" height="19" rx="9.5" fill="#04B014" fill-opacity="0.1"/>
    <rect x="2.5" y="2.5" width="19" height="19" rx="9.5" stroke="#04B014"/>
    <path d="M8 12.5L11 15L16 9" stroke="#04B014" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,

  misleading: `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2.5" y="2.5" width="19" height="19" rx="9.5" fill="#DC0000" fill-opacity="0.1"/>
    <rect x="2.5" y="2.5" width="19" height="19" rx="9.5" stroke="#DC0000"/>
    <path d="M16 8L8 16" stroke="#DC0000" stroke-width="1.25" stroke-linecap="round"/>
    <path d="M16 16L8 8" stroke="#DC0000" stroke-width="1.25" stroke-linecap="round"/>
    </svg>`,

  "not-analyzed": `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clip-path="url(#clip0_438_1887)">
    <rect x="2" y="2" width="20" height="20" rx="10" fill="#FFAA00" fill-opacity="0.1"/>
    <rect x="19.6777" y="4" width="1" height="25" transform="rotate(45 19.6777 4)" fill="#FFAA00"/>
    <path d="M11.25 14.5C13.0449 14.5 14.5 13.0449 14.5 11.25C14.5 9.45507 13.0449 8 11.25 8C9.45507 8 8 9.45507 8 11.25C8 13.0449 9.45507 14.5 11.25 14.5Z" stroke="#FFAA00" stroke-miterlimit="10"/>
    <path d="M15.6464 16.3536C15.8417 16.5488 16.1583 16.5488 16.3536 16.3536C16.5488 16.1583 16.5488 15.8417 16.3536 15.6464L16 16L15.6464 16.3536ZM13.5 13.5L13.1464 13.8536L15.6464 16.3536L16 16L16.3536 15.6464L13.8536 13.1464L13.5 13.5Z" fill="#FFAA00"/>
    </g>
    <rect x="2.5" y="2.5" width="19" height="19" rx="9.5" stroke="#FFAA00"/>
    <defs><clipPath id="clip0_438_1887"><rect x="2" y="2" width="20" height="20" rx="10" fill="white"/></clipPath></defs>
    </svg>`,
  
  default: `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="16.8198" y="18.0361" width="2.13333" height="1.96786" transform="rotate(-55.7178 16.8198 18.0361)" fill="#989898"/>
    <path d="M18.5306 16.6208C17.7281 17.7549 16.6441 18.6605 15.3853 19.2485C14.1264 19.8364 12.7362 20.0863 11.3514 19.9737C9.9666 19.861 8.63503 19.3897 7.48776 18.606C6.34049 17.8224 5.41709 16.7535 4.80846 15.5045C4.19983 14.2556 3.92696 12.8696 4.01671 11.4832C4.10647 10.0967 4.55575 8.75756 5.32033 7.5975C6.08491 6.43744 7.13843 5.49651 8.37716 4.86733C9.61589 4.23815 10.9971 3.94242 12.3849 4.00926L12.2821 6.14279C11.2649 6.0938 10.2524 6.31056 9.34446 6.77175C8.43647 7.23294 7.66424 7.92265 7.1038 8.77297C6.54337 9.62329 6.21404 10.6049 6.14825 11.6212C6.08246 12.6375 6.28247 13.6533 6.7286 14.5688C7.17473 15.4843 7.85158 16.2678 8.69253 16.8422C9.53348 17.4166 10.5095 17.7621 11.5246 17.8447C12.5396 17.9273 13.5587 17.7441 14.4814 17.3131C15.4041 16.8822 16.1987 16.2184 16.7869 15.387L18.5306 16.6208Z" fill="#989898"/>
    <path d="M12.9738 4.05948C14.1426 4.20282 15.2654 4.60244 16.262 5.22982L15.124 7.03746C14.3936 6.57759 13.5705 6.28467 12.7138 6.1796L12.9738 4.05948Z" fill="#04B014"/>
    <path d="M16.7471 5.56067C17.695 6.25945 18.4769 7.15888 19.0371 8.19475L17.1582 9.21075C16.7476 8.45146 16.1744 7.79218 15.4796 7.27997L16.7471 5.56067Z" fill="#FFAA00"/>
    <path d="M19.2582 8.63573C19.7534 9.70415 20.0067 10.8687 19.9999 12.0463L17.8639 12.034C17.8689 11.1708 17.6833 10.3171 17.3203 9.53399L19.2582 8.63573Z" fill="#FF1B1B"/>
    <path d="M10.3999 14.8442L14.5572 11.9997L10.3999 9.15527V14.8442Z" fill="#989898"/>
    </svg>`
};

/**
 * ==========================================
 * 2. UTILITY CLASSES
 * ==========================================
 */
const VideoUtils = {
  /** URL에서 Video ID 추출 */
  extractId(url) {
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
};

const DomUtils = {
  /** 요소가 DOM에 나타날 때까지 대기 */
  waitForElement(selector, callback) {
    const interval = setInterval(() => {
      const element = document.querySelector(selector);
      if (element) {
        clearInterval(interval);
        callback(element);
      }
    }, 100);
  },

  /** 분석 중일 때 보여줄 로딩 애니메이션 스팬 생성 */
  getLoadingSpans() {
    return '<span></span>'.repeat(6);
  }
};

/**
 * ==========================================
 * 3. UI MANAGER (VIEW)
 * ==========================================
 * 화면에 위젯을 그리고 상태를 업데이트하는 역할
 */
const UIManager = {
  element: null,

  /** UI 초기 생성 및 DOM 삽입 */
  mount() {
    // 기존 요소 제거 (중복 방지)
    const existing = document.getElementById(CONFIG.SELECTORS.CONTAINER);
    if (existing) existing.remove();

    // 새 요소 생성
    this.element = document.createElement('div');
    this.element.id = CONFIG.SELECTORS.CONTAINER;
    this.element.innerHTML = `<span class="icon"></span><span>...</span>`;

    // 유튜브 헤더에 삽입, 실패 시 body에 삽입
    const masthead = document.querySelector(CONFIG.SELECTORS.YOUTUBE_HEADER);
    if (masthead) {
      masthead.before(this.element);
    } else {
      document.body.appendChild(this.element);
    }
  },

  /** UI 상태 업데이트 (텍스트, 클래스, 아이콘) */
  updateState(text, statusClass) {
    const el = document.getElementById(CONFIG.SELECTORS.CONTAINER);
    if (!el) return;

    // 1. 텍스트 업데이트
    el.innerHTML = `<span class="icon"></span><span>${text}</span>`;
    const iconEl = el.querySelector(CONFIG.SELECTORS.ICON_WRAPPER);

    // 2. 클래스 초기화 및 재설정
    el.classList.remove(...Object.values(CONFIG.CLASSES));
    if (statusClass) el.classList.add(statusClass);

    // 3. 아이콘 렌더링
    if (statusClass === CONFIG.CLASSES.ANALYZING) {
      iconEl.innerHTML = DomUtils.getLoadingSpans();
    } else {
      iconEl.innerHTML = ICONS[statusClass] || ICONS.default;
    }
  }
};

/**
 * ==========================================
 * 4. APP CONTROLLER (LOGIC)
 * ==========================================
 * 메시지 통신 및 전체 로직 조율
 */
const App = {
  init() {
    // 유튜브 헤더 로딩 대기 후 시작
    DomUtils.waitForElement(CONFIG.SELECTORS.YOUTUBE_HEADER, () => {
      this.handleNavigation();
    });

    // 유튜브 페이지 이동 감지
    window.addEventListener('yt-navigate-finish', () => this.handleNavigation());
  },

  handleNavigation() {
    UIManager.mount();
    this.processCurrentVideo();
  },

  processCurrentVideo() {
    const videoId = VideoUtils.extractId(location.href);

    // 1. 비디오가 아니면 기본 상태 표시
    if (!videoId) {
      UIManager.updateState(CONFIG.TEXT.DEFAULT, CONFIG.CLASSES.DEFAULT);
      return;
    }

    console.log('[Content Script] Processing video:', videoId);

    // 2. 분석 중 상태로 전환
    UIManager.updateState(CONFIG.TEXT.ANALYZING, CONFIG.CLASSES.ANALYZING);

    // 3. 백그라운드 스크립트에 분석 요청
    chrome.runtime.sendMessage({
      type: 'NEW_VIDEO',
      videoId,
      url: location.href
    }, (response) => this.handleResponse(response));
  },

  handleResponse(response) {
    // 에러 처리
    if (chrome.runtime.lastError) {
      console.error("Extension Error:", chrome.runtime.lastError.message);
      UIManager.updateState(CONFIG.TEXT.ERROR, CONFIG.CLASSES.MISLEADING);
      return;
    }

    if (!response) {
      UIManager.updateState("Analysis Error", CONFIG.CLASSES.MISLEADING);
      return;
    }

    // A. 이미 분석된 결과가 있거나 분석 완료된 경우
    if (response.analysisResult) {
      const { score } = response.analysisResult;
      const isVerified = score >= CONFIG.THRESHOLDS.SAFE_SCORE;
      
      if (isVerified) {
        UIManager.updateState(CONFIG.TEXT.VERIFIED, CONFIG.CLASSES.VERIFIED);
      } else {
        UIManager.updateState(CONFIG.TEXT.MISLEADING, CONFIG.CLASSES.MISLEADING);
      }
      return;
    }

    // B. 분석하지 않음(Not Analyzed) 또는 기타 상태
    if (response.status === 'Not Analyzed') {
      UIManager.updateState(CONFIG.TEXT.NOT_ANALYZED, CONFIG.CLASSES.NOT_ANALYZED);
    } else {
      UIManager.updateState(response.status, CONFIG.CLASSES.DEFAULT);
    }
  }
};

// 앱 실행
App.init();
import { firebaseConfig } from '../firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * ==========================================
 * 1. 설정 및 상수 (CONFIGURATION & CONSTANTS)
 * ==========================================
 * API 키, 엔드포인트, 타겟 카테고리, 점수 기준값 등
 * 변경 가능성이 있는 설정값들을 한곳에서 관리함.
 */
const CONFIG = {
  KEYS: {
    VISION: "VISION",
    GEMINI: "GEMINI",
    SERPER: "SERPER",
  },
  URLS: {
    VISION: "https://vision.googleapis.com/v1/images:annotate",
    GEMINI: "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent",
    SERPER_NEWS: "https://google.serper.dev/news",
    SERPER_WEB: "https://google.serper.dev/search",
  },
  // 분석 대상 유튜브 카테고리 목록
  TARGET_CATEGORIES: [
    "News & Politics", "Nonprofits & Activism", "Science & Technology",
    "Education", "People & Blogs", "Howto & Style", "Auto & Vehicles"
  ],
  // ACCA 평가 점수 임계값
  THRESHOLDS: {
    SAFE_SCORE: 80,       // 안전하다고 판단하는 최소 점수
  }
};

/**
 * AI(Gemini)에게 보낼 프롬프트 템플릿 모음입니다.
 * 비즈니스 로직과 텍스트 생성을 분리하여 프롬프트 수정이 용이합니다.
 */
const PROMPTS = {
  /**
   * 팩트체크를 위한 최적의 검색어를 생성하는 프롬프트
   */
  QUERY_GEN: (title, ocr, channel) => `
    제목: "${title}"
    OCR: "${ocr}"
    채널명: "${channel}"
    위 영상의 핵심 주장이나 사건을 팩트체크하기 위해 구글 뉴스 검색에 입력할 '간결한 요약 검색어'을 하나만 만들어줘.
    단, 유튜버 채널명은 검색어에서 반드시 빼야 해.
    예시: "트럼프 한국 상품 관세 인상 보도", "정부 비트코인 거래 금지 발표 여부"
    다른 설명 없이 요약 검색어만 출력해.`,
    
  /**
   * 수집된 정보를 바탕으로 신뢰도를 평가(ACCA)하는 프롬프트
   */
  ACCA_EVAL: (channel, category, title, ocr, searchType, context) => `
    System Instruction: Multimodal Information Integrity Assessment
    Written by Aaron
    Role: You are the Automated Content Credibility Assessor (ACCA).
    Objective: Quantify discrepancy between "Perceived Urgency" and "Probable Factual Accuracy".
    
    [INPUT DATA]
    - Channel: "${channel}"
    - Category: "${category}"
    - Title: "${title}"
    - OCR: "${ocr}"
    - Fact Check Context (${searchType}): 
    ${context || "No relevant search results found."}

    ---
    PART 1: Taxonomy
    A: Institutional (Broadcasters/Gov) -> [Mitigation 0.5]
    B: Independent (YouTubers) -> [No Mitigation]
    C: Entertainment -> [Bypass] (Score 100)

    PART 2: 5 Dimensions (Score Deductions)
    1. Certainty (0-30): Speculation as Fact
    2. Hyperbole (0-20): Emotional words
    3. Obfuscation (0-15): Fake tags
    4. Dissonance (0-15): Title-Thumbnail mismatch
    5. Fabrication (0-20): Fake scenarios

    PART 3: Scoring
    - Sum Penalties. 
    - Apply Mitigation (x0.5 for Type A).
    - Final Score = 100 - Final Penalty.
    - Threshold: Safe(80-100), Misleading(<80).

    PART 4: Output JSON
    {
      "source_type": "A"/"B"/"C",
      "average_score": 0-100,
      "color": "green"/"red",
      "primary_violation": "string",
      "summary_explanation": "Korean summary"
    }`
};

/**
 * ==========================================
 * 2. 외부 API 서비스 (EXTERNAL API SERVICE)
 * ==========================================
 * 외부 API(Google Vision, Gemini, Serper)와의 통신을 전담하는 객체입니다.
 * 복잡한 fetch 옵션 설정을 숨기고 결과만 반환합니다.
 */
const ApiService = {
  /**
   * 썸네일 이미지 URL을 받아 OCR(텍스트 추출)을 수행합니다.
   * @param {string} thumbnailUrl - 분석할 이미지 URL
   * @returns {Promise<string>} 추출된 텍스트 (실패 시 빈 문자열)
   */
  async fetchOcr(thumbnailUrl) {
    if (!thumbnailUrl) return "";
    try {
      const response = await fetch(`${CONFIG.URLS.VISION}?key=${CONFIG.KEYS.VISION}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{ image: { source: { imageUri: thumbnailUrl } }, features: [{ type: 'TEXT_DETECTION' }] }]
        })
      });
      const data = await response.json();
      return data.responses?.[0]?.fullTextAnnotation?.text.replace(/\n/g, ' ') || "";
    } catch (e) {
      console.error("OCR API Error:", e);
      return "";
    }
  },

  /**
   * Gemini 모델을 호출하여 텍스트를 생성합니다.
   * @param {string} prompt - AI에게 보낼 명령
   * @param {number} temperature - 창의성 조절 (기본값 1.0)
   * @returns {Promise<string>} AI 응답 텍스트
   */
  async callGemini(prompt, temperature = 1.0) {
    const response = await fetch(`${CONFIG.URLS.GEMINI}?key=${CONFIG.KEYS.GEMINI}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature }
      })
    });
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  },

  /**
   * 검색어에 대해 뉴스 검색을 우선 시도하고, 결과가 없으면 웹 검색을 수행합니다.
   * @param {string} query - 최적화된 검색어
   * @returns {Promise<Object>} { type: "NEWS"|"WEB", results: Array }
   */
  async searchSerper(query) {
    const headers = { 'X-API-KEY': CONFIG.KEYS.SERPER, 'Content-Type': 'application/json' };
    const body = JSON.stringify({ q: query, gl: "kr", hl: "ko" });

    // 1. 뉴스 검색 시도
    let res = await fetch(CONFIG.URLS.SERPER_NEWS, { method: 'POST', headers, body });
    let data = await res.json();
    
    if (data.news && data.news.length > 0) {
      return { type: "NEWS", results: data.news };
    }

    // 2. 뉴스 결과 없으면 일반 웹 검색(Fallback)
    console.log("⚠️ 뉴스 결과 0건 -> 일반 웹 검색 전환");
    res = await fetch(CONFIG.URLS.SERPER_WEB, { method: 'POST', headers, body });
    data = await res.json();
    return { type: "WEB", results: data.organic || [] };
  }
};

/**
 * ==========================================
 * 3. 유틸리티 헬퍼 (UTILITY HELPERS)
 * ==========================================
 * 문자열 처리, 데이터 파싱, 로깅 등 반복적으로 사용되는 보조 함수들입니다.
 */
const Helpers = {
  /**
   * JSON 문자열에서 불필요한 따옴표 등을 제거합니다.
   */
  cleanJsonString(str) {
    return str.replace(/["']/g, "").trim();
  },

  /**
   * AI 응답(Markdown 코드 블록 포함)에서 JSON 객체만 추출하여 파싱합니다.
   */
  parseJsonFromMarkdown(text) {
    try {
      const match = text.match(/\{[\s\S]*\}/); // 중괄호 {} 안의 내용 찾기
      return match ? JSON.parse(match[0]) : null;
    } catch (e) {
      console.error("JSON Parse Error:", e);
      return null;
    }
  },

  /**
   * HTML 텍스트에서 메타데이터(제목, 썸네일, 채널명, 카테고리)를 추출합니다.
   */
  extractMetadata(html) {
    const getMeta = (prop) => html.match(new RegExp(`<meta property="${prop}" content="(.*?)">`))?.[1];
    
    // 카테고리 추출 (유니코드 디코딩 포함)
    let category = html.match(/"category":"(.*?)"/)?.[1] || "Unknown";
    try { category = JSON.parse(`"${category}"`); } catch { category = category.replace(/\\u0026/g, "&"); }

    return {
      title: getMeta("og:title") || "Title not found",
      thumbnailUrl: getMeta("og:image") || "",
      channelName: html.match(/"author":"(.*?)"/)?.[1] || "Unknown Channel",
      category
    };
  },

  /**
   * 분석 결과를 콘솔에 보기 좋게 출력합니다. (디버깅용)
   */
  logAnalysis(videoData, searchData, result) {
    const { title, channelName } = videoData;
    const { query } = searchData;
    
    console.group(`🚨 ACCA 분석 결과: ${title}`);
    console.log(`📺 채널: ${channelName}`);
    console.log(`🔎 검색어: ${query}`);
    console.log(`📊 점수: ${result.score}점 (${result.source_type})`);
    console.log(`${result.is_verified ? "✅" : "❌"} 점수: ${result.score}점`);

    if (result.source_type !== 'C') {
      console.log(`⚠️ 주요 위반: ${result.primary_violation}`);
      console.log(`📝 상세 분석: ${result.reason}`);
    }

    if (result.reference_urls?.length) {
      console.log("🔗 참고 기사:");
      result.reference_urls.forEach((url, i) => console.log(`   [${i + 1}] ${url}`));
    } else {
      console.log("⚠️ 참고 기사 없음");
    }
    console.groupEnd();
  }
};

/**
 * ==========================================
 * 4. 메인 로직 (MAIN LOGIC)
 * ==========================================
 * Chrome Extension의 메시지를 수신하고 전체 프로세스를 조율합니다.
 */

// 백그라운드 스크립트 메시지 리스너
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "NEW_VIDEO") {
    // 비동기 작업 처리를 위해 즉시 실행 함수 사용
    handleNewVideoRequest(message)
      .then(sendResponse)
      .catch(err => sendResponse({ status: "Error", message: err.message }));
    return true; // 비동기 응답을 위해 true 반환 필수
  }
});

/**
 * 새로운 비디오 분석 요청을 처리하는 메인 함수입니다.
 * DB 확인 -> 메타데이터 수집 -> 카테고리 필터 -> 분석 실행 -> 저장 순으로 동작합니다.
 */
async function handleNewVideoRequest(message) {
  const { videoId, url } = message;
  const videoRef = doc(db, "videos", videoId);
  
  // 1. 중복 확인 (이미 분석된 영상인지)
  const docSnap = await getDoc(videoRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    if (data.status === "Not Analyzed") return { status: "Not Analyzed" };
    return { status: "Already Exists", analysisResult: data.analysisResult };
  }

  // 2. 유튜브 페이지 HTML 가져오기 및 파싱
  const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
  const html = await response.text();
  const metadata = Helpers.extractMetadata(html);
  
  console.log(`📺 채널: [${metadata.channelName}], 카테고리: [${metadata.category}]`);

  // 3. 카테고리 필터링 (분석 대상이 아니면 저장만 하고 종료)
  if (!CONFIG.TARGET_CATEGORIES.includes(metadata.category) && metadata.category !== "Unknown") {
    await setDoc(videoRef, { videoId, status: "Not Analyzed", category: metadata.category, collectedAt: serverTimestamp() });
    return { status: "Not Analyzed" };
  }

  // 4. OCR 수행 및 AI 정밀 분석 실행
  const ocrText = await ApiService.fetchOcr(metadata.thumbnailUrl);
  const analysisResult = await analyzeContent(metadata, ocrText);

  // 5. 결과 DB 저장 및 반환
  await setDoc(videoRef, {
    videoId, url, ocrText,
    ...metadata, // title, channelName, category 등 포함
    analysisResult,
    collectedAt: serverTimestamp()
  });

  // 엔터테인먼트(C타입)인 경우 'Not Analyzed'로 처리 (UI 표시 안 함)
  if (analysisResult.source_type === 'C') return { status: "Not Analyzed" };
  
  return { status: "Saved", analysisResult };
}

/**
 * 실제 AI 분석 로직을 수행하는 핵심 함수입니다.
 * 검색어 생성 -> 팩트체크 검색 -> ACCA 평가 순으로 진행됩니다.
 */
async function analyzeContent(metadata, ocrText) {
  try {
    const { title, category, channelName } = metadata;

    // Step 1: 검색어 생성 (Query Generation)
    const queryPrompt = PROMPTS.QUERY_GEN(title, ocrText, channelName);
    const rawQuery = await ApiService.callGemini(queryPrompt);
    const optimizedQuery = Helpers.cleanJsonString(rawQuery);

    console.log(`🔎 생성된 검색어: [${optimizedQuery}]`);

    // Step 2: 검색 실행 (News -> Web Fallback)
    const searchResult = await ApiService.searchSerper(optimizedQuery);
    const newsItems = searchResult.results.slice(0, 5);
    
    // 검색 결과를 AI가 읽을 수 있는 텍스트로 변환
    const context = newsItems
      .map(n => `[출처: ${n.source || n.title}] 제목: ${n.title} / 내용: ${n.snippet}`)
      .join("\n\n");
    const referenceUrls = newsItems.map(n => n.link);

    // Step 3: ACCA 평가 실행
    const accaPrompt = PROMPTS.ACCA_EVAL(channelName, category, title, ocrText, searchResult.type, context);
    // 온도를 0.1로 낮게 설정하여 일관된 평가 유도
    const accaRawRes = await ApiService.callGemini(accaPrompt, 0.1); 
    const accaJson = Helpers.parseJsonFromMarkdown(accaRawRes);

    if (!accaJson) throw new Error("Failed to parse ACCA result");

    // Step 4: 결과 보정 및 포맷팅
    let finalScore = accaJson.average_score;
    let explanation = accaJson.summary_explanation;

    // 최종 결과 객체 구성
    const finalResult = {
      source_type: accaJson.source_type,
      score: finalScore,
      is_verified: finalScore >= CONFIG.THRESHOLDS.SAFE_SCORE,
      primary_violation: accaJson.primary_violation,
      reason: explanation,
      reference_urls: referenceUrls,
      original_result: accaJson
    };

    // Step 5: 분석 결과 로깅
    Helpers.logAnalysis(metadata, { query: optimizedQuery }, finalResult);

    return finalResult;

  } catch (error) {
    console.error("분석 중 에러:", error);
    // 에러 발생 시 기본값 반환 (분석 실패 처리)
    return { score: 50, reason: "Analysis Error", source_type: "B", is_verified: false };
  }
}
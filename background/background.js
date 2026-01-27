import { firebaseConfig } from '../firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
console.log("✅ Firebase initialized in Service Worker");

// =================================================================
// 🚨 중요: 여기에 자신의 API 키를 입력하세요.
// =================================================================
const VISION_API_KEY = "YOUR_GOOGLE_VISION_API_KEY";
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";

const VISION_API_URL = `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;
// 메시지 리스너
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "NEW_VIDEO") {
    console.log(`[Background] Received ID: ${message.videoId}`);

    (async () => {
      try {
        const result = await handleNewVideo(db, message.videoId, message.url);
        sendResponse(result);
      } catch (error) {
        console.error("[Background] Error:", error);
        sendResponse({ status: "Error", message: error.message });
      }
    })();

    return true; // 비동기 응답 유지
  }
});

// Firestore에 videoID 저장
async function handleNewVideo(db, videoId, url) {
  const videoRef = doc(db, "videos", videoId);
  const docSnap = await getDoc(videoRef);

  if (docSnap.exists()) {
    console.log(`[Background] ♻️ Video ID ${videoId} already exists.`);
    return { status: "Already Exists" };
  } else {
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(youtubeUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' } });
    if (!response.ok) throw new Error(`Failed to fetch YouTube page: ${response.status} ${response.statusText}`);
    const html = await response.text();
    const title = html.match(/<meta property=\"og:title\" content=\"(.*?)\">/)?.[1] || "Title not found";
    const thumbnailUrl = html.match(/<meta property=\"og:image\" content=\"(.*?)\">/)?.[1] || "Thumbnail not found";

    // --- OCR 기능 추가 ---
    let ocrText = "OCR not available"; // 기본값 설정
    if (thumbnailUrl !== "Thumbnail not found" && VISION_API_KEY !== "YOUR_GOOGLE_CLOUD_VISION_API_KEY") {
        try {
            console.log("[Background] 🔍 Calling Vision API for OCR...");
            const visionResponse = await fetch(VISION_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requests: [{ image: { source: { imageUri: thumbnailUrl } }, features: [{ type: 'TEXT_DETECTION' }] }] })
            });

            if (!visionResponse.ok) {
                const errorBody = await visionResponse.text();
                throw new Error(`Vision API request failed: ${visionResponse.status} ${visionResponse.statusText} - ${errorBody}`);
            }

            const visionData = await visionResponse.json();
            const fullTextAnnotation = visionData.responses?.[0]?.fullTextAnnotation;
            
            ocrText = fullTextAnnotation ? fullTextAnnotation.text.replace(/\n/g, ' ') : "No text found";
            console.log(`[Background] 👁️ OCR Result: ${ocrText}`);

        } catch (ocrError) {
            console.error("[Background] OCR Error:", ocrError);
            ocrText = `OCR failed: ${ocrError.message}`;
        }
    } else if (VISION_API_KEY === "YOUR_GOOGLE_CLOUD_VISION_API_KEY") {
        console.warn("[Background] ⚠️ Vision API key is not set. Skipping OCR.");
        ocrText = "OCR skipped: API key not set";
    }
    // --- OCR 기능 끝 ---

    // --- 💎 Gemini API를 이용한 신뢰도 분석 ---
    let geminiAnalysis = { reliability: "Not analyzed", reason: "Gemini analysis skipped." };
    if (GEMINI_API_KEY !== "YOUR_GEMINI_API_KEY" && ocrText && ocrText.includes("failed") === false && ocrText.includes("skipped") === false) {
        try {
            console.log("[Background] 🧠 Calling Gemini API for analysis...");
            geminiAnalysis = await analyzeTextWithGemini(ocrText, title);
            // console.log(`[Background] ✨ Gemini Analysis: ${geminiAnalysis.reliability} - ${geminiAnalysis.reason}`);
        } catch (geminiError) {
            console.error("[Background] Gemini Error:", geminiError);
            geminiAnalysis = { reliability: "Analysis failed", reason: geminiError.message };
        }
    } else if (GEMINI_API_KEY === "YOUR_GEMINI_API_KEY") {
        console.warn("[Background] ⚠️ Gemini API key is not set. Skipping analysis.");
    }
    // --- Gemini 분석 끝 ---

    await setDoc(videoRef, {
      videoId,
      url,
      title,
      thumbnailUrl,
      ocrText,
      geminiAnalysis, 
      collectedAt: serverTimestamp()
    });
    console.log(`[Background] ✅ Saved to Firestore: ${videoId}`);
    console.log('-------------------------------');
    return { status: "Saved" };
  }
}

// 💎 Gemini 3 분석 함수 (콘솔 출력 강화 버전)
async function analyzeTextWithGemini(ocrText, videoTitle) {
  const prompt = `
    당신은 유튜브 콘텐츠 신뢰도 분류 전문가입니다. 제공된 데이터를 바탕으로 아래 가이드라인에 따라 분석하세요.
    응답은 반드시 JSON 형식으로만 하세요.

    [카테고리 분류 가이드]
    A. 신뢰도 판정 대상: 정치/사회, 경제/금융, 의학/건강, 과학/기술, 생활 법률
    B. 신뢰도 판정 비대상: 엔터테인먼트, 일상/Vlog, 취미/스포츠, 예술/디자인, 단순 유머

    [출력 JSON 구조]
    {
      "category_group": "A" 또는 "B",
      "specific_category": "카테고리명",
      "reliability": "High/Medium/Low",
      "score": 0~100점 사이의 숫자,
      "reason": "한 문장 요약"
    }

    제목: "${videoTitle}"
    썸네일 OCR: "${ocrText}"
  `;

  const res = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });

  const data = await res.json();
  const text = data.candidates[0].content.parts[0].text;
  const jsonStr = text.trim().replace(/^```json/, '').replace(/```$/, '').trim();
  const result = JSON.parse(jsonStr);

  // 1. 기존에 찍히던 상세 분석 로그 (유지)
  console.log(`[Background] ✨ Gemini Analysis: ${result.reliability} (${result.score}점) - ${result.reason}`);

  // 2. 추가된 카테고리 판정 결과 로그 (신규 추가)
  if (result.category_group === "A") {
    console.log(`%c[판정 결과] 🔴 신뢰도 판정 대상군입니다. (${result.specific_category})`, "color: #ff4d4d; font-weight: bold; border: 1px solid #ff4d4d; padding: 2px 5px; border-radius: 4px;");
  } else {
    console.log(`%c[판정 결과] 🟡 신뢰도 판정 비대상군입니다. (${result.specific_category})`, "color: #ffcc00; font-weight: bold; border: 1px solid #ffcc00; padding: 2px 5px; border-radius: 4px;");
  }

  return result;
}
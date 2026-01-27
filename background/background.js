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
// 개발 중에는 1.5-flash 사용
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// 최종 점검 때는 gemini-3-flash-preview 사용
// const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;

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
    당신은 유튜브 가짜뉴스 판별 전문가입니다. 아래 [정밀 분석 규칙]의 '분석 대상'을 대조하여 점수를 산출하세요.
    응답은 반드시 JSON 형식으로만 하세요.

    [STEP 1: 카테고리 분류]
    A. 신뢰도 판정 대상: 정치/사회, 경제/금융, 의학/건강, 과학/기술, 생활 법률
    B. 신뢰도 판정 비대상: 그 외 모든 카테고리 (엔터테인먼트, 일상, 스포츠 등)

    [STEP 2: 정밀 분석 및 감점 규칙 (A군 대상)]
    * 기본 점수 100점에서 시작하며, 아래 규칙에 따라 감점합니다.

    1. 텍스트 선정성 및 자극도 (-10점)
       - 분석 대상: 제목 및 썸네일 내 단어
       - 규칙: '충격', '경악', '결국', 'ㄷㄷ', '실제상황' 등 어휘 및 특수문자(!!!, ???) 과도 사용 측정.
    2. 단정적 언어 및 예언적 결론 (-10점)
       - 분석 대상: 텍스트의 어미 및 서술어
       - 규칙: 아직 확정되지 않은 사건을 '~사망', '~확정', '~종료' 등 단정적 평서문으로 기술하여 사실처럼 위장하는지 측정.
    3. 정보원(Source)의 불투명성 (-25점)
       - 분석 대상: 텍스트 내 주어 및 인용구
       - 규칙: "관계자 폭로", "익명 제보", "외신에 따르면" 등 구체적 명칭 없는 모호한 주어 식별.
    4. 썸네일-제목 간 논리적 괴리 (-25점)
       - 분석 대상: 썸네일 OCR 텍스트와 제목의 의미 대조
       - 규칙: 썸네일은 극단적 사건 확정(예: 전쟁)이나 제목은 의문문(예: 가능성?)인 경우, 혹은 서로 다른 주제 배치 측정.
    5. 시각적 권위 도용 (-25점)
       - 분석 대상: [속보], [단독], [긴급] 태그 및 특정 언론사 명칭 사용
       - 규칙: 공신력 있는 언론사나 국가 기관의 발표 형식을 텍스트로 흉내 내어 시청자를 기만하는지 측정.
    6. 편향적 선동 및 혐오 어휘 (-10점)
       - 분석 대상: 텍스트 내 가치판단이 담긴 형용사/명사
       - 규칙: '참교육', '폭망', '퇴출', '참사' 등 분노를 유발하거나 보복적 쾌감을 자극하는 선동적 단어 측정.
    7. 그래픽 위기감 조성 (-10점)
       - 분석 대상: OCR로 추출된 텍스트의 스타일 및 배색 정보
       - 규칙: 고대비 원색 배경, '방금 터진', '삭제 예정' 등 시간적 압박을 주는 표현의 시각적 강조 측정.
    8. 정보 수렴성 검색 (-50점)
       - 분석 대상: 제목과 썸네일에서 추출된 '핵심 키워드'
       - 규칙: 검색 시 공신력 있는 보도가 전무하거나 이미 팩트체크 기관에서 허위로 판명된 주제인지 측정.

    [출력 JSON 구조]
    {
      "category_group": "A" 또는 "B",
      "specific_category": "카테고리명",
      "score": 최종_산출_점수,
      "applied_rules": ["감점된 규칙 번호와 구체적 사유"],
      "reason": "전체 판정 요약"
    }

    입력 데이터:
    - 제목: "${videoTitle}"
    - 썸네일 OCR: "${ocrText}"
  `;

  try {
    const res = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ],
        generationConfig: { temperature: 0.1 }
      })
    });

    const data = await res.json();

    if (!data.candidates || data.candidates.length === 0) {
      console.warn("[Background] Gemini 응답 차단됨 -> 비대상(B) 처리");
      return { category_group: "B", score: 100 };
    }

    const text = data.candidates[0].content.parts[0].text;
    const jsonStr = text.trim().replace(/^```json/, '').replace(/```$/, '').trim();
    const result = JSON.parse(jsonStr);

    // --- 기존 콘솔 출력 유지 ---
    if (result.category_group === "A") {
      console.log(`%c[판정 결과] 🔴 신뢰도 판정 대상군입니다. (${result.specific_category})`, "color: #ff4d4d; font-weight: bold; border: 1px solid #ff4d4d; padding: 2px 5px; border-radius: 4px;");
      
      // --- 정은님 요청: 점수 및 케이스 색상 출력 추가 ---
      const score = result.score;
      if (score >= 70) {
        // Case B: 신뢰 (Green)
        console.log(`%c[최종 분석 점수] 🟢 Case B (분석 필요군 - 신뢰): ${score}점`, "color: green; font-weight: bold; border: 1px solid green; padding: 2px 5px; margin-top: 5px;");
      } else {
        // Case C: 위험 (Red)
        console.log(`%c[최종 분석 점수] 🔴 Case C (분석 필요군 - 위험): ${score}점`, "color: red; font-weight: bold; border: 1px solid red; padding: 2px 5px; margin-top: 5px;");
      }

      if (result.applied_rules && result.applied_rules.length > 0) {
        console.log("⚠️ 발견된 감점 항목:", result.applied_rules);
      }
    } else {
      console.log(`%c[판정 결과] 🟡 신뢰도 판정 비대상군입니다. (${result.specific_category})`, "color: #ffcc00; font-weight: bold; border: 1px solid #ffcc00; padding: 2px 5px; border-radius: 4px;");
    }

    return result;

  } catch (error) {
    console.error("[Background] analyzeTextWithGemini 에러:", error);
    return { category_group: "B", score: 100 };
  }
}
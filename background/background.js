import { firebaseConfig } from '../firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 🔑 API 키 설정
const VISION_API_KEY = "VISION_API_KEY";
const GEMINI_API_KEY = "GEMINI_API_KEY";
const SERPER_API_KEY = "SERPER_API_KEY";

const VISION_API_URL = `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// 리스너
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "NEW_VIDEO") {
    (async () => {
      try {
        const result = await handleNewVideo(db, message.videoId, message.url);
        sendResponse(result);
      } catch (error) {
        sendResponse({ status: "Error", message: error.message });
      }
    })();
    return true; 
  }
});

// 분석 대상 카테고리
const TARGET_CATEGORIES = [
    "News & Politics", "Nonprofits & Activism", "Science & Technology", 
    "Education", "People & Blogs", "Howto & Style", "Auto & Vehicles"
];

async function handleNewVideo(db, videoId, url) {
  const videoRef = doc(db, "videos", videoId);
  const docSnap = await getDoc(videoRef);
  
  if (docSnap.exists()) {
    const existingData = docSnap.data();
    if (existingData.status === "Not Analyzed") return { status: "Not Analyzed" };
    return { status: "Already Exists", analysisResult: existingData.analysisResult };
  }

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const response = await fetch(youtubeUrl);
  const html = await response.text();

  // 메타데이터 추출
  const title = html.match(/<meta property="og:title" content="(.*?)">/)?.[1] || "Title not found";
  const thumbnailUrl = html.match(/<meta property="og:image" content="(.*?)">/)?.[1] || "Thumbnail not found";
  const channelMatch = html.match(/"author":"(.*?)"/);
  const channelName = channelMatch ? channelMatch[1] : "Unknown Channel";

  // 카테고리 추출 및 디코딩
  const categoryMatch = html.match(/"category":"(.*?)"/);
  let videoCategory = categoryMatch ? categoryMatch[1] : "Unknown";
  try { videoCategory = JSON.parse(`"${videoCategory}"`); } catch (e) { videoCategory = videoCategory.replace(/\\u0026/g, "&"); }

  console.log(`📺 채널: [${channelName}], 카테고리: [${videoCategory}]`);

  // 카테고리 필터링
  if (!TARGET_CATEGORIES.includes(videoCategory) && videoCategory !== "Unknown") {
      await setDoc(videoRef, { videoId, status: "Not Analyzed", category: videoCategory, collectedAt: serverTimestamp() });
      return { status: "Not Analyzed" };
  }

  // OCR 추출
  let ocrText = "";
  try {
      const visionRes = await fetch(VISION_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests: [{ image: { source: { imageUri: thumbnailUrl } }, features: [{ type: 'TEXT_DETECTION' }] }] })
      });
      const data = await visionRes.json();
      ocrText = data.responses?.[0]?.fullTextAnnotation?.text.replace(/\n/g, ' ') || "";
  } catch (e) { console.error("OCR Error"); }

  // 정밀 분석 실행
  const analysisResult = await analyzeWithSerper(ocrText, title, videoCategory, channelName);
  
  await setDoc(videoRef, { videoId, url, title, channelName, ocrText, category: videoCategory, analysisResult, collectedAt: serverTimestamp() });

  if (analysisResult.source_type === 'C') return { status: "Not Analyzed" };

  return { status: "Saved", analysisResult };
}

async function analyzeWithSerper(ocrText, videoTitle, videoCategory, channelName) {
    try {
        // ------------------------------------------------------------------
        // [Step 1] 검색어 생성
        // ------------------------------------------------------------------
        const queryGenPrompt = `
        제목: "${videoTitle}"
        OCR: "${ocrText}"
        채널명: "${channelName}"
        
        위 영상의 핵심 주장이나 사건을 팩트체크하기 위해 구글 뉴스 검색에 입력할 '간결한 요약 검색어'을 하나만 만들어줘.
        단, 유튜버 채널명은 검색어에서 반드시 빼야 해.
        예시: "트럼프 한국 상품 관세 인상 보도", "정부 비트코인 거래 금지 발표 여부"
        다른 설명 없이 요약 검색어만 출력해.`;
        
        const queryRes = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: queryGenPrompt }] }] })
        });
        const queryData = await queryRes.json();
        const optimizedQuery = queryData.candidates[0].content.parts[0].text.trim().replace(/["']/g, "");

        console.log(`🔎 생성된 검색어: [${optimizedQuery}]`);

        // ------------------------------------------------------------------
        // [Step 2] 검색 실행 (뉴스 검색 1차 -> 실패시 웹 검색 2차)
        // ------------------------------------------------------------------
        let searchResults = [];
        let usedSearchType = "NEWS";

        // 1. 뉴스 검색
        const serperNewsRes = await fetch("https://google.serper.dev/news", {
            method: 'POST',
            headers: { 'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: optimizedQuery, gl: "kr", hl: "ko" })
        });
        const newsData = await serperNewsRes.json();

        if (newsData.news && newsData.news.length > 0) {
            searchResults = newsData.news;
        } else {
            // 2. 뉴스 없으면 웹 검색 (이건 무조건 켜두는 게 좋습니다)
            console.log("⚠️ 뉴스 결과 0건 -> 일반 웹 검색 전환");
            usedSearchType = "WEB";
            const serperWebRes = await fetch("https://google.serper.dev/search", {
                method: 'POST',
                headers: { 'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ q: optimizedQuery, gl: "kr", hl: "ko" })
            });
            const webData = await serperWebRes.json();
            searchResults = webData.organic || [];
        }

        const newsItems = searchResults.slice(0, 5);
        const context = newsItems.map(n => `[출처: ${n.source || n.title}] 제목: ${n.title} / 내용: ${n.snippet}`).join("\n\n");
        const referenceUrls = newsItems.map(n => n.link);

        // ------------------------------------------------------------------
        // [Step 3] ACCA 평가 (새로운 규칙 적용)
        // ------------------------------------------------------------------
        const finalPrompt = `
        System Instruction: Multimodal Information Integrity Assessment
        Written by Aaron
        
        Role: You are the Automated Content Credibility Assessor (ACCA).
        Objective: Quantify discrepancy between "Perceived Urgency" and "Probable Factual Accuracy".
        
        [INPUT DATA]
        - Channel: "${channelName}"
        - Category: "${videoCategory}"
        - Title: "${videoTitle}"
        - OCR: "${ocrText}"
        - Fact Check Context (${usedSearchType}): 
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
        }`;

        const finalRes = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: finalPrompt }] }],
                generationConfig: { temperature: 0.1 }
            })
        });

        const finalData = await finalRes.json();
        const resultText = finalData.candidates[0].content.parts[0].text;
        const result = JSON.parse(resultText.match(/\{[\s\S]*\}/)[0]);

        // Type A 보정
        if (result.source_type === 'A' && result.average_score < 85) {
            result.average_score = 95;
            result.color = "green";
            result.summary_explanation = `[제도권 언론(${channelName}) 보정] ${result.summary_explanation}`;
        }

        const finalResult = {
            source_type: result.source_type,
            score: result.average_score,
            is_verified: result.average_score >= 80,
            primary_violation: result.primary_violation,
            reason: result.summary_explanation,
            original_result: result
        };

        // 콘솔 리포트
        console.group(`🚨 ACCA 분석 결과: ${videoTitle}`);
        console.log(`📺 채널: ${channelName}`);
        console.log(`🔎 검색어: ${optimizedQuery}`);
        console.log(`📊 점수: ${finalResult.score}점 (${finalResult.source_type})`);
        
        // 점수와 함께 색상 표시
        const scoreIcon = finalResult.score >= 80 ? "✅" : "❌";
        console.log(`${scoreIcon} 점수: ${finalResult.score}점`);

        // 왜 깎였는지 알려줌
        if (finalResult.source_type !== 'C') {
            console.log(`⚠️ 주요 위반: ${finalResult.primary_violation}`); // 가장 큰 감점 요인 (예: Dimension 2: Hyperbole)
            console.log(`📝 상세 분석: ${finalResult.reason}`); // AI의 한글 설명
        }

        if (referenceUrls.length > 0) {
            console.log("🔗 참고 기사:");
            referenceUrls.forEach((url, idx) => console.log(`   [${idx + 1}] ${url}`));
        } else {
            console.log("⚠️ 참고 기사 없음");
        }
        console.groupEnd();

        return { ...finalResult, reference_urls: referenceUrls };
    } catch (error) {
        console.error("분석 중 에러:", error);
        return { score: 50, reason: "Error", source_type: "B" };
    }
}
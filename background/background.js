import { firebaseConfig } from '../firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// API 설정
const VISION_API_KEY = "YOUR_GOOGLE_VISION_API_KEY";
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";
const SERPER_API_KEY = "YOUR_SERPER_API_KEY"; 

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

async function handleNewVideo(db, videoId, url) {
  const videoRef = doc(db, "videos", videoId);
  const docSnap = await getDoc(videoRef);
  if (docSnap.exists()) return { status: "Already Exists" };

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const response = await fetch(youtubeUrl);
  const html = await response.text();
  const title = html.match(/<meta property="og:title" content="(.*?)">/)?.[1] || "Title not found";
  const thumbnailUrl = html.match(/<meta property="og:image" content="(.*?)">/)?.[1] || "Thumbnail not found";

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

  // [STEP 1] 카테고리 필터
  const isTarget = await checkCategory(ocrText, title);
  if (!isTarget) {
      console.log("%c🟡 판단 종료: 분석 비대상 카테고리 (노란색 불빛)", "color: #FFC107; font-weight: bold;");
      return { status: "Skipped" };
  }

  // [STEP 2] 정밀 분석 진행
  const analysisResult = await analyzeWithSerper(ocrText, title);
  await setDoc(videoRef, { videoId, url, title, ocrText, analysisResult, collectedAt: serverTimestamp() });
  return { status: "Saved", analysisResult };
}

async function checkCategory(ocrText, videoTitle) {
    try {
        const res = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: `제목: ${videoTitle}, OCR: ${ocrText}. 정치, 경제, 사회, 의학, 과학, 법률 중 하나라면 TARGET, 그 외는 SKIP이라고 답해.` }] }] })
        });
        const data = await res.json();
        return data.candidates[0].content.parts[0].text.includes("TARGET");
    } catch (e) { return true; }
}

/**
 * [수정됨] 8가지 정밀 규칙 및 뉴스 공신력 기반 채점 로직
 */
async function analyzeWithSerper(ocrText, videoTitle) {
    try {
        // 1. 최적화된 검색어 추출
        const queryGenPrompt = `
        제목: "${videoTitle}"
        OCR: "${ocrText}"
        
        위 영상의 핵심 주장이나 사건을 팩트체크하기 위해 구글 뉴스 검색에 입력할 '간결한 요약 검색어'을 하나만 만들어줘.
        예시: "트럼프 한국 상품 관세 인상 보도", "정부 비트코인 거래 금지 발표 여부"
        다른 설명 없이 요약 검색어만 출력해.`;
        const queryRes = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: queryGenPrompt }] }] })
        });
        const queryData = await queryRes.json();
        const optimizedQuery = queryData.candidates[0].content.parts[0].text.trim();

        // 2. Serper 뉴스 검색
        const serperRes = await fetch("https://google.serper.dev/news", {
            method: 'POST',
            headers: { 'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: optimizedQuery, gl: "kr", hl: "ko" })
        });
        const searchData = await serperRes.json();
        const newsItems = searchData.news && searchData.news.length > 0 ? searchData.news.slice(0, 5) : [];
        const context = newsItems.map(n => `[출처: ${n.source}] 제목: ${n.title} / 내용: ${n.snippet}`).join("\n\n");
        const referenceUrls = newsItems.map(n => n.link);

        // 3. 8가지 정밀 규칙 프롬프트 적용
        const finalPrompt = `
        당신은 쇼츠 가짜뉴스 정밀 판별기입니다. 아래 8가지 규칙과 뉴스 대조를 통해 100점 만점에서 감점하세요.

        [영상 정보] 제목: ${videoTitle}, OCR: ${ocrText}
        [뉴스 검색 결과]
        ${context || "제도권 언론 보도 전무함"}

        [분석 및 감점 규칙]
        1. 텍스트 선정성: '충격', '경악', 'ㄷㄷ', '실제상황' 등 어휘 사용 (-10점)
        2. 단정적 언어: 미확정 사건을 '~사망', '~확정' 등 위장 (-10점)
        3. 정보원 불투명성: '관계자 폭로', '외신에 따르면' 등 모호한 주어 (-25점)
        4. 논리적 괴리: 썸네일은 확정, 제목은 의문문 등 낚시 패턴 (-25점)
        5. 권위 도용: [속보], [단독] 태그나 언론사 형식 사칭 (-25점)
        6. 선동/혐오 어휘: '참교육', '폭망', '퇴출', '참사' 등 분노 유발 (-10점)
        7. 그래픽 위기감: '방금 터진', '삭제 예정' 등 시간 압박 시각화 (-10점)
        8. **뉴스 공신력 대조(중요)**:
           - 주요 언론사 보도가 있다면 점수 유지.
           - 유튜브/커뮤니티엔 있으나 제도권 언론 보도가 전무하면 (-25점)
           - '사실무근', '루머' 등 반박/팩트체크 기사가 존재하면 (-50점)

        반드시 아래 JSON 형식으로만 답변하세요:
        {
          "score": 최종 점수,
          "is_verified": 뉴스 일치 여부(true/false),
          "deductions": [{"rule_no": "번호", "reason": "감점 사유", "points": "점수"}],
          "reason": "종합 평"
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

        // 🖥️ 최종 콘솔 리포트 출력
        console.group(`🚨 쇼츠 정밀 팩트체크: ${videoTitle}`);
        console.log(`📡 실제 검색어: "${optimizedQuery}"`);
        console.log(`📊 최종 점수: ${result.score}점 (뉴스 확인: ${result.is_verified ? "✅" : "❌"})`);
        
        if (result.deductions.length > 0) {
            console.log("❌ 감점 내역:");
            result.deductions.forEach(d => console.log(`   - [규칙 ${d.rule_no}] ${d.reason} (-${d.points}점)`));
        } else {
            console.log("✅ 감점 항목 없음 (신뢰 가능)");
        }

        if (referenceUrls.length > 0) {
            console.log("🔗 참고한 공신력 있는 기사:");
            referenceUrls.forEach((url, idx) => console.log(`   [${idx + 1}] ${url}`));
        } else {
            console.warn("⚠️ 제도권 언론사의 관련 보도가 발견되지 않았습니다.");
        }
        
        console.log(`📝 종합 분석: ${result.reason}`);
        console.groupEnd();

        return { ...result, reference_urls: referenceUrls };
    } catch (error) {
        console.error("분석 중 에러:", error);
        return { score: 50, reason: "분석 실패" };
    }
}
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
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY"; // 👈 Gemini API 키

const VISION_API_URL = `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;


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
            console.log(`[Background] ✨ Gemini Analysis: ${geminiAnalysis.reliability} - ${geminiAnalysis.reason}`);
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
      geminiAnalysis, // 👈 분석 결과 저장
      collectedAt: serverTimestamp()
    });
    console.log(`[Background] ✅ Saved to Firestore: ${videoId}`);
    return { status: "Saved" };
  }
}

// 💎 Gemini API 호출 함수 (새로 추가된 함수)
async function analyzeTextWithGemini(ocrText, videoTitle) {
    const prompt = `Analyze the reliability of the following text, which was extracted from a YouTube video's thumbnail and title. The key is to determine if the thumbnail text is clickbait or sensational compared to the video title.

- Video Title: "${videoTitle}"
- Thumbnail OCR Text: "${ocrText}"

Based on this, classify the reliability into one of three categories: "High", "Medium", or "Low". Provide a brief, one-sentence explanation for your classification. 

Your entire response MUST be a valid JSON object with two keys: "reliability" and "reason".

Example:
- Input: Title="Simple Pasta Recipe", OCR="💥MIND-BLOWING PASTA HACK! YOU WON'T BELIEVE IT!💥"
- Output: {"reliability": "Low", "reason": "The thumbnail text uses sensational and exaggerated language that is not reflected in the simple title."}`;

    const geminiResponse = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });

    if (!geminiResponse.ok) {
        const errorBody = await geminiResponse.text();
        throw new Error(`Gemini API request failed: ${geminiResponse.status} ${geminiResponse.statusText} - ${errorBody}`);
    }

    const geminiData = await geminiResponse.json();
    const responseText = geminiData.candidates[0].content.parts[0].text;
    
    // 응답이 JSON 형식이 되도록 정리
    const jsonString = responseText.trim().replace(/^```json/, '').replace(/```$/, '').trim();

    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.error("[Background] Failed to parse Gemini response as JSON:", responseText);
        throw new Error("Failed to parse Gemini's JSON response.");
    }
}
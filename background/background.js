import { firebaseConfig } from '../firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
console.log("✅ Firebase initialized in Service Worker");

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
    
    const response = await fetch(youtubeUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch YouTube page: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    const titleMatch = html.match(/<meta property=\"og:title\" content=\"(.*?)\">/);
    const title = titleMatch ? titleMatch[1] : "Title not found";

    const thumbnailUrlMatch = html.match(/<meta property=\"og:image\" content=\"(.*?)\">/);
    const thumbnailUrl = thumbnailUrlMatch ? thumbnailUrlMatch[1] : "Thumbnail not found";

    // OCR 텍스트 (플레이스홀더)
    const ocrText = "OCR-text-goes-here";

    console.log("--- OG and OCR Data ---");
    console.log("Title:", title);
    console.log("Thumbnail URL:", thumbnailUrl);
    console.log("OCR Text:", ocrText);
    console.log("-----------------------");

    await setDoc(videoRef, {
      videoId,
      url,
      title,
      thumbnailUrl,
      ocrText,
      collectedAt: serverTimestamp()
    });
    console.log(`[Background] ✅ Saved to Firestore: ${videoId}`);
    return { status: "Saved" };
  }
}

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
    await setDoc(videoRef, {
      videoId,
      url,
      collectedAt: serverTimestamp()
    });
    console.log(`[Background] ✅ Saved to Firestore: ${videoId}`);
    return { status: "Saved" };
  }
}

function createDynamicIsland() {
  // 이미 있으면 중복 생성 방지
  if (document.getElementById("my-island-container")) return;

  const island = document.createElement("div");
  island.id = "my-island-container";

  island.innerHTML = `
    <div class="island-content">
    <img src="아이콘_이미지_주소" class="island-icon">
      <span style="color:#FFC107;">Dynamic Island</span>
    </div>
  `;

  document.body.appendChild(island);
}

createDynamicIsland();

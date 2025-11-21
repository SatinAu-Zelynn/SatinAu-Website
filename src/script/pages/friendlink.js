document.addEventListener("DOMContentLoaded", () => {
  initFriendLinks();
});

function initFriendLinks() {
  const container = document.getElementById("friendlink-container");
  if (!container) return;

  fetch("https://blog.satinau.cn/data/friendlink.json")
    .then(res => res.json())
    .then(data => {
      const list = data.friends || [];
      container.innerHTML = ""; // 清空

      list.forEach((item, index) => {
        const a = document.createElement("a");
        a.className = "contact-card";
        a.href = "javascript:void(0);";
        a.setAttribute(
          "onclick",
          `showIosAlert('${item.link}', '是否跳转到 ${item.name}？')`
        );

        a.innerHTML = `
          <div class="icon">
            <img src="${item.avatar}" alt="${item.name}"">
          </div>
          <div class="text">
            <div class="label">${item.name}</div>
            <div class="value">${item.desc}</div>
          </div>
        `;

        container.appendChild(a);

        // 加载可见动画
        setTimeout(() => {
          a.classList.add("visible");
        }, 200 + index * 120);
      });
    })
    .catch(err => {
      console.error("友情链接加载失败：", err);
      container.innerHTML = `<p style="opacity:1;">加载失败，请稍后重试。</p>`;
    });
}
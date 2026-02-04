/*
  Copyright 2025 缎金SatinAu

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

document.addEventListener("DOMContentLoaded", () => {
  initFriendLinks();
});

function initFriendLinks() {
  const container = document.getElementById("friendlink-container");
  if (!container) return;

  fetch(`${getCdnBaseUrl()}/data/friendlink.json`)
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
          `document.getElementById('globalModal').with(this).alert('是否跳转到 ${item.name}？','${item.link}')`
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
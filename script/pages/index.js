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

/* ============= index.html 独有逻辑 ============= */
/* 邮箱复制（支持多地址，带回退方案） */
window.copyEmail = function(email) {
if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(email).then(() => {
    showToast("📋 已复制: " + email);
    }).catch(err => {
    emailfallbackCopyText(email);
    });
} else {
    emailfallbackCopyText(email);
}
};

function emailfallbackCopyText(text) {
const input = document.createElement("textarea");
input.value = text;
input.style.position = "fixed";
input.style.opacity = "0";
document.body.appendChild(input);
input.select();
try {
    document.execCommand("copy");
    showToast("📋 已复制: " + text);
} catch (err) {
    alert("复制失败，请手动复制: " + text);
}
document.body.removeChild(input);
}

/* 邮箱选择弹窗 */
window.showEmailPopup  = () => { toggleModal("emailOverlay", true); toggleModal("emailPopup", true); };
window.closeEmailPopup = () => { toggleModal("emailOverlay", false); toggleModal("emailPopup", false); };

/* 微信二维码弹窗 */
window.showWeChatQR  = () => { toggleModal("wechatOverlay", true); toggleModal("wechatQR", true); };
window.closeWeChatQR = () => { toggleModal("wechatOverlay", false); toggleModal("wechatQR", false); };
/* 
  src/script/components/comment.js
  评论系统已下线 - Supabase 后端已禁用
*/

// 导出全局初始化函数 - 禁用状态
window.initPageComments = function(containerId, pageId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // 显示禁用通知
  container.innerHTML = `
    <div class="comments-section">
      <h3 class="comments-title">评论</h3>
      <div style="padding: 20px; text-align: center; color: #999; background: #f5f5f5; border-radius: 8px;">
        <p>评论系统暂时下线维护中</p>
        <p style="font-size: 12px; margin-top: 10px; opacity: 0.7;">敬请期待</p>
      </div>
    </div>
  `;
};
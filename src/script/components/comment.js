/* 
  src/script/components/comment.js
  通用评论组件 - 适配 Supabase
*/

class CommentSystem {
  constructor(containerId, pageId) {
    this.container = document.getElementById(containerId);
    this.pageId = pageId;
    this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.user = null;
    
    if (!this.container) return;
    
    this.init();
  }

  async init() {
    this.renderSkeleton();
    await this.checkUser();
    this.renderInputArea();
    this.fetchComments();
    
    // 监听 auth 变化 (如果在其他标签页登录了)
    this.supabase.auth.onAuthStateChange((event, session) => {
      this.user = session?.user || null;
      this.renderInputArea(); // 重新渲染输入框状态
    });
  }

  async checkUser() {
    const { data: { session } } = await this.supabase.auth.getSession();
    this.user = session?.user || null;
  }

  // 渲染基础结构
  renderSkeleton() {
    this.container.innerHTML = `
      <div class="comments-section">
        <h3 class="comments-title">评论</h3>
        <div id="comment-input-container"></div>
        <div id="comment-list" class="comment-list">
          <p style="text-align:center; opacity:0.6;">加载评论中...</p>
        </div>
      </div>
    `;
  }

  // 渲染输入区域 (根据登录状态变化)
  renderInputArea() {
    const inputContainer = this.container.querySelector('#comment-input-container');
    if (!inputContainer) return;

    if (this.user) {
      inputContainer.innerHTML = `
        <div class="comment-input-wrapper">
          <textarea id="comment-text" class="comment-textarea" placeholder="写下你的评论..."></textarea>
          <div class="comment-actions">
            <span class="comment-tip">已登录为: ${this.getUserName()}</span>
            <button id="submit-comment" class="comment-submit-btn">发送</button>
          </div>
        </div>
      `;
      
      const btn = inputContainer.querySelector('#submit-comment');
      btn.onclick = () => this.submitComment();
    } else {
      inputContainer.innerHTML = `
        <div class="comment-input-wrapper" style="text-align:center; padding:30px;">
          <p style="margin-bottom:15px;">登录后即可发表评论</p>
          <button class="comment-submit-btn" onclick="document.getElementById('loginBtn')?.click() || alert('请前往博客页面登录')">
            去登录
          </button>
        </div>
      `;
    }
  }

  getUserName() {
    const meta = this.user.user_metadata || {};
    return meta.name || meta.user_name || meta.preferred_username || this.user.email;
  }

  // 获取评论
  async fetchComments() {
    const listContainer = this.container.querySelector('#comment-list');
    
    // 关联查询 profiles 表获取头像和昵称
    const { data, error } = await this.supabase
      .from('comments')
      .select(`
        id, content, created_at, user_id,
        profiles (username, avatar_url)
      `)
      .eq('page_id', this.pageId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch comments error:', error);
      listContainer.innerHTML = '<p style="text-align:center; color:#ff453a;">加载评论失败</p>';
      return;
    }

    if (!data || data.length === 0) {
      listContainer.innerHTML = '<p style="text-align:center; opacity:0.5;">暂无评论，来抢沙发吧~</p>';
      return;
    }

    this.renderList(data);
  }

  // 渲染列表
  renderList(comments) {
    const listContainer = this.container.querySelector('#comment-list');
    listContainer.innerHTML = comments.map(item => {
      const profile = item.profiles || {};
      const name = profile.username || '匿名用户';
      const avatar = profile.avatar_url || 'https://satinau.cn/public/favicon.ico'; // 默认头像
      const date = new Date(item.created_at).toLocaleString();
      const isMyComment = this.user && this.user.id === item.user_id;

      return `
        <div class="comment-item" id="comment-${item.id}">
          <img src="${avatar}" class="comment-avatar" alt="${name}" onerror="this.src='https://satinau.cn/public/favicon.ico'">
          <div class="comment-body">
            <div class="comment-header">
              <span class="comment-user">${name}</span>
              <div>
                <span class="comment-date">${date}</span>
                ${isMyComment ? `<span class="comment-delete" onclick="window.deleteComment('${item.id}')">删除</span>` : ''}
              </div>
            </div>
            <div class="comment-content">${this.escapeHtml(item.content)}</div>
          </div>
        </div>
      `;
    }).join('');

    // 绑定删除方法到全局，以便 onclick 调用
    window.deleteComment = (id) => this.deleteComment(id);
  }

  async submitComment() {
    const textarea = this.container.querySelector('#comment-text');
    const content = textarea.value.trim();
    if (!content) return;

    const btn = this.container.querySelector('#submit-comment');
    btn.disabled = true;
    btn.textContent = '发送中...';

    const { error } = await this.supabase
      .from('comments')
      .insert({
        page_id: this.pageId,
        user_id: this.user.id,
        content: content
      });

    if (error) {
      alert('发送失败: ' + error.message);
      btn.disabled = false;
      btn.textContent = '发送';
    } else {
      textarea.value = '';
      btn.disabled = false;
      btn.textContent = '发送';
      this.fetchComments(); // 刷新列表
    }
  }

  async deleteComment(commentId) {
    if (!confirm('确定删除这条评论吗？')) return;

    const { error } = await this.supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      alert('删除失败');
    } else {
      this.fetchComments();
    }
  }

  escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
  }
}

// 导出全局初始化函数
window.initPageComments = function(containerId, pageId) {
  new CommentSystem(containerId, pageId);
};
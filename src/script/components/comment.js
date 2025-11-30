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
    
    // 绑定全局方法供HTML内联调用
    window.commentSystemInstance = this;
    
    if (!this.container) return;
    
    this.init();
  }

  async init() {
    this.renderSkeleton();
    await this.checkUser();
    this.renderInputArea();
    this.fetchComments();
    
    this.supabase.auth.onAuthStateChange((event, session) => {
      this.user = session?.user || null;
      this.renderInputArea();
    });
  }

  async checkUser() {
    const { data: { session } } = await this.supabase.auth.getSession();
    this.user = session?.user || null;
  }

  getUserName() {
    if (!this.user) return '匿名用户';
    const meta = this.user.user_metadata || {};
    return meta.name || meta.user_name || meta.preferred_username || this.user.email;
  }

  // 1. 渲染基础框架
  renderSkeleton() {
    this.container.innerHTML = `
      <div class="comments-section">
        <h3 class="comments-title">评论</h3>
        <div id="main-input-container"></div>
        <div id="comment-list" class="comment-list">
          <p style="text-align:center; opacity:0.6;">加载评论中...</p>
        </div>
      </div>
    `;
  }

  // 2. 渲染顶部主输入框
  renderInputArea() {
    const inputContainer = this.container.querySelector('#main-input-container');
    if (!inputContainer) return;

    if (this.user) {
      inputContainer.innerHTML = `
        <div class="comment-input-wrapper">
          <textarea id="main-comment-text" class="comment-textarea" placeholder="写下你的评论..."></textarea>
          <div class="comment-actions">
            <span class="comment-tip">已登录为: ${this.getUserName()}</span>
            <button onclick="window.commentSystemInstance.submitComment()" class="comment-submit-btn">发送</button>
          </div>
        </div>
      `;
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

  // 3. 获取并处理评论数据
  async fetchComments() {
    const listContainer = this.container.querySelector('#comment-list');
    
    // 获取所有评论 (包括 parent_id)
    const { data, error } = await this.supabase
      .from('comments')
      .select(`
        id, content, created_at, user_id, parent_id,
        profiles (username, avatar_url)
      `)
      .eq('page_id', this.pageId)
      .order('created_at', { ascending: true }); // 按时间正序，方便盖楼

    if (error) {
      console.error('Fetch comments error:', error);
      listContainer.innerHTML = '<p style="text-align:center; color:#ff453a;">加载评论失败</p>';
      return;
    }

    if (!data || data.length === 0) {
      listContainer.innerHTML = '<p style="text-align:center; opacity:0.5;">暂无评论，来抢沙发吧~</p>';
      return;
    }

    // 将扁平数组转为树形结构
    const commentTree = this.buildCommentTree(data);
    // 渲染树
    this.renderTree(commentTree);
  }

  // 辅助：构建树形结构
  buildCommentTree(comments) {
    const map = {};
    const roots = [];

    // 初始化映射
    comments.forEach(c => {
      c.children = [];
      map[c.id] = c;
    });

    // 组装树
    comments.forEach(c => {
      if (c.parent_id && map[c.parent_id]) {
        map[c.parent_id].children.push(c);
      } else {
        roots.push(c);
      }
    });

    // 根节点按时间倒序（最新的在最上面），子回复按时间正序（楼层效果）
    return roots.reverse();
  }

  // 4. 渲染评论树
  renderTree(treeData) {
    const listContainer = this.container.querySelector('#comment-list');
    listContainer.innerHTML = '';
    
    treeData.forEach(node => {
      listContainer.appendChild(this.createCommentNode(node));
    });
  }

  // 递归创建评论节点 DOM
  createCommentNode(item) {
    const profile = item.profiles || {};
    const name = profile.username || '匿名用户';
    const avatar = profile.avatar_url || 'https://satinau.cn/public/favicon.ico';
    const date = new Date(item.created_at).toLocaleString();
    const isMyComment = this.user && this.user.id === item.user_id;

    // 创建 DOM 元素
    const div = document.createElement('div');
    div.className = 'comment-item';
    div.id = `comment-${item.id}`;

    // 基础 HTML
    div.innerHTML = `
      <img src="${avatar}" class="comment-avatar" alt="${name}" onerror="this.src='https://satinau.cn/public/favicon.ico'">
      <div class="comment-body">
        <div class="comment-header">
          <span class="comment-user">${name}</span>
          <div>
            <span class="comment-date">${date}</span>
          </div>
        </div>
        <div class="comment-content">${this.escapeHtml(item.content)}</div>
        
        <div class="comment-actions-bar">
          <span class="comment-reply-btn" onclick="window.commentSystemInstance.openReplyBox('${item.id}', '${name}')">回复</span>
          ${isMyComment ? `<span class="comment-delete" onclick="window.commentSystemInstance.deleteComment('${item.id}')">删除</span>` : ''}
        </div>

        <!-- 动态插入回复框的容器 -->
        <div id="reply-box-${item.id}"></div>

        <!-- 子评论容器 -->
        <div class="comment-children" id="children-${item.id}"></div>
      </div>
    `;

    // 递归渲染子评论
    if (item.children && item.children.length > 0) {
      const childrenContainer = div.querySelector(`#children-${item.id}`);
      item.children.forEach(child => {
        childrenContainer.appendChild(this.createCommentNode(child));
      });
    }

    return div;
  }

  // 5. 打开回复框
  openReplyBox(parentId, replyToName) {
    if (!this.user) {
      document.getElementById('loginBtn')?.click();
      alert('请先登录后再回复');
      return;
    }

    // 移除页面上其他已打开的回复框（一次只显示一个）
    const existingForms = this.container.querySelectorAll('.reply-form-wrapper');
    existingForms.forEach(el => el.remove());

    const container = document.getElementById(`reply-box-${parentId}`);
    if (!container) return;

    const formHtml = `
      <div class="reply-form-wrapper">
        <textarea id="reply-text-${parentId}" placeholder="回复 @${replyToName}..."></textarea>
        <div class="reply-form-actions">
          <button class="reply-cancel-btn" onclick="this.closest('.reply-form-wrapper').remove()">取消</button>
          <button class="reply-submit-btn" onclick="window.commentSystemInstance.submitComment('${parentId}')">发送</button>
        </div>
      </div>
    `;
    
    container.innerHTML = formHtml;
    // 自动聚焦
    setTimeout(() => {
        const textarea = document.getElementById(`reply-text-${parentId}`);
        if(textarea) textarea.focus();
    }, 100);
  }

  // 6. 提交评论 (支持主评论和回复)
  async submitComment(parentId = null) {
    let content = '';
    let textarea = null;
    let btn = null;

    if (parentId) {
      // 回复模式
      textarea = document.getElementById(`reply-text-${parentId}`);
      if (textarea) {
        content = textarea.value.trim();
        // 查找按钮：textarea 的父级(wrapper) -> 找 .reply-form-actions -> 找按钮
        btn = textarea.closest('.reply-form-wrapper').querySelector('.reply-submit-btn');
      }
    } else {
      // 主评论模式
      textarea = document.getElementById('main-comment-text');
      if (textarea) {
        content = textarea.value.trim();
        // 查找按钮：textarea 的父级 -> 找 .comment-actions -> 找 button
        btn = textarea.parentNode.querySelector('button'); 
      }
    }

    if (!content) return;

    if (btn) {
        btn.disabled = true;
        btn.textContent = '发送中...'; // 稍微改一下文字提示，更直观
    }

    const payload = {
      page_id: this.pageId,
      user_id: this.user.id,
      content: content,
      parent_id: parentId // 关键：带上父ID
    };

    const { error } = await this.supabase
      .from('comments')
      .insert(payload);

    if (error) {
      alert('发送失败: ' + error.message);
      // 失败时恢复按钮
      if (btn) {
          btn.disabled = false;
          btn.textContent = '发送';
      }
    } else {
      // 成功
      if (textarea) textarea.value = '';
      
      if (btn) {
          btn.disabled = false;
          btn.textContent = '发送';
      }

      this.fetchComments(); // 重新加载列表（这会关闭回复框，但主输入框还在，所以必须恢复按钮）
    }
  }

  // 7. 删除评论
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
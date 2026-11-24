/**
 * page-preview annotate-server — 页面预览划词批注服务
 *
 * 用法:
 *   node annotate-preview-server.js <change目录>/preview.html [--port <端口号>]
 *
 * 功能:
 *   - 以 preview.html 所在 skill 根目录为静态服务根（支持 vendor/css/js 相对资源）
 *   - 对目标 preview.html 注入 SPA 划词批注脚本（划词 → 批注按钮 → 弹窗 → 保存）
 *   - 批注存储: preview.html 同目录 .preview.html.comments.json
 *   - API: GET/POST /api/comments, DELETE /api/comments/:id, POST /api/comments/clear
 *
 * 批注字段沿用 doc-annotate 习惯: { id, text, comment, timestamp, resolved }
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

function printUsage() {
  console.log('page-preview annotate-server');
  console.log('用法: node annotate-preview-server.js <preview.html 路径> [--port <端口号>]');
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') printUsage();
  const htmlPath = path.resolve(args[0]);
  let port = 8921;
  const portIdx = args.indexOf('--port');
  if (portIdx !== -1 && portIdx + 1 < args.length) {
    port = parseInt(args[portIdx + 1], 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      console.error('错误: 端口号无效');
      process.exit(1);
    }
  }
  return { htmlPath, port };
}

const CONFIG = parseArgs();
if (!fs.existsSync(CONFIG.htmlPath)) {
  console.error('错误: 文件不存在 — ' + CONFIG.htmlPath);
  process.exit(1);
}

// 静态服务根 = changes/<id>/preview.html → skill 根目录（上两级）
const HTML_DIR = path.dirname(CONFIG.htmlPath);
const SERVE_ROOT = path.resolve(HTML_DIR, '..', '..');
const COMMENTS_FILE = path.join(HTML_DIR, '.preview.html.comments.json');

// ===================== 批注数据读写 =====================

function getComments() {
  if (fs.existsSync(COMMENTS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(COMMENTS_FILE, 'utf8'));
    } catch (e) {
      console.error('批注文件解析失败，返回空列表: ' + e.message);
      return [];
    }
  }
  return [];
}

function saveComments(comments) {
  fs.writeFileSync(COMMENTS_FILE, JSON.stringify(comments, null, 2), 'utf8');
}

// ===================== 静态文件服务 =====================

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8'
};

function serveStatic(req, res, urlPath) {
  const resolved = path.resolve(SERVE_ROOT, '.' + urlPath);
  if (resolved !== SERVE_ROOT && !resolved.startsWith(SERVE_ROOT + path.sep)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    res.writeHead(404);
    res.end('Not found: ' + urlPath);
    return;
  }
  const ext = path.extname(resolved).toLowerCase();
  const isHtml = ext === '.html';
  let body = fs.readFileSync(resolved);
  if (isHtml) {
    // 只对目标 preview.html 注入批注脚本，其他 html 原样返回
    if (resolved === CONFIG.htmlPath) {
      body = Buffer.from(buildAnnotatedHtml(body.toString('utf8')), 'utf8');
    }
    res.writeHead(200, {
      'Content-Type': MIME[ext],
      'Cache-Control': 'no-store'
    });
    res.end(body);
    return;
  }
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': 'no-cache'
  });
  res.end(body);
}

// ===================== 注入：SPA 划词批注脚本 =====================

const CLIENT_CSS = `
.ea-anno-highlight { background-color: #FFF3B8; border-radius: 2px; }
#ea-anno-popup {
  position: absolute; z-index: 99999; display: none;
  background: #fff; border: 1px solid #D9D9D9; border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15); padding: 6px 10px;
  font-size: 12px; color: #333; cursor: pointer; user-select: none;
}
#ea-anno-popup:hover { border-color: #1E75FF; color: #1E75FF; }
#ea-anno-modal {
  position: fixed; inset: 0; z-index: 100000; display: none;
  background: rgba(0,0,0,0.35);
}
.ea-anno-modal-box {
  position: absolute; top: 30%; left: 50%; transform: translateX(-50%);
  width: 420px; background: #fff; border-radius: 8px; padding: 16px;
  font-family: -apple-system, "PingFang SC", sans-serif;
}
.ea-anno-modal-box h3 { margin: 0 0 10px; font-size: 14px; color: #1f2329; }
.ea-anno-quote {
  background: #F5F4F5; border-radius: 4px; padding: 8px 10px; margin-bottom: 10px;
  font-size: 12px; color: #606266; max-height: 72px; overflow: auto; white-space: pre-wrap;
}
.ea-anno-modal-box textarea {
  width: 100%; box-sizing: border-box; height: 90px; resize: vertical;
  border: 1px solid #D9D9D9; border-radius: 6px; padding: 8px; font-size: 13px;
  font-family: inherit; outline: none;
}
.ea-anno-modal-box textarea:focus { border-color: #1E75FF; }
.ea-anno-modal-actions { margin-top: 10px; text-align: right; }
.ea-anno-modal-actions button {
  margin-left: 8px; padding: 5px 16px; border-radius: 6px; cursor: pointer;
  font-size: 13px; border: 1px solid #D9D9D9; background: #fff; color: #333;
}
.ea-anno-modal-actions button.ea-anno-primary {
  background: #1E75FF; border-color: #1E75FF; color: #fff;
}
#ea-anno-badge {
  position: fixed; right: 20px; bottom: 24px; z-index: 99999;
  width: 44px; height: 44px; border-radius: 50%;
  background: #1E75FF; color: #fff; border: none; cursor: pointer;
  font-size: 12px; line-height: 1.1; box-shadow: 0 4px 12px rgba(30,117,255,0.4);
  font-family: -apple-system, "PingFang SC", sans-serif;
}
.ea-anno-badge-count {
  position: absolute; top: -6px; right: -6px; min-width: 18px; height: 18px;
  background: #FF4D4F; border-radius: 9px; color: #fff; font-size: 11px;
  line-height: 18px; text-align: center; padding: 0 4px; box-sizing: border-box;
  display: none;
}
#ea-anno-panel {
  position: fixed; right: 16px; bottom: 80px; z-index: 100000; display: none;
  width: 380px; max-height: 55vh; overflow: auto;
  background: #fff; border-radius: 8px; padding: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  font-family: -apple-system, "PingFang SC", sans-serif;
}
#ea-anno-panel h3 { margin: 0 0 10px; font-size: 14px; color: #1f2329; }
.ea-anno-item {
  border: 1px solid #E4E4E7; border-radius: 6px; padding: 8px 10px;
  margin-bottom: 8px; font-size: 12px; cursor: pointer;
}
.ea-anno-item:hover { border-color: #1E75FF; }
.ea-anno-item.resolved { opacity: 0.55; }
.ea-anno-item .ea-anno-quote-line {
  color: #606266; background: #F5F4F5; border-radius: 3px;
  padding: 2px 6px; margin-bottom: 4px; display: inline-block; max-width: 100%;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ea-anno-item .ea-anno-comment-line { color: #1f2329; margin-bottom: 4px; }
.ea-anno-item .ea-anno-meta { color: #999; }
.ea-anno-item .ea-anno-status { color: #52C41A; }
.ea-anno-empty { color: #999; font-size: 12px; text-align: center; padding: 20px 0; }
/* Tab、按钮、表头等区域常被组件库禁用文本选择，批注模式下强制放开 */
button, [role="tab"], .ant-tabs-tab, .ant-tabs-tab-btn, .ant-menu-title-content,
.ant-table-thead th, .ant-pagination-item, .ant-select-selector, label {
  -webkit-user-select: text !important;
  user-select: text !important;
}
.ea-anno-alt-hint { color: #999; font-size: 11px; margin-top: 6px; }
`;

const CLIENT_JS = `
(function () {
  var comments = [];
  var currentSelection = '';
  var currentRange = null;

  function http(method, url, body) {
    return fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) { return r.json(); });
  }

  function loadComments() {
    return http('GET', '/api/comments').then(function (list) {
      comments = Array.isArray(list) ? list : [];
      renderBadge();
      renderPanel();
    }).catch(function () { renderBadge(); renderPanel(); });
  }

  function unresolvedCount() {
    return comments.filter(function (c) { return !c.resolved; }).length;
  }

  function renderBadge() {
    var n = unresolvedCount();
    var el = document.getElementById('ea-anno-badge-count');
    el.textContent = String(n);
    el.style.display = n > 0 ? 'block' : 'none';
  }

  function renderPanel() {
    var panel = document.getElementById('ea-anno-panel');
    var html = '<h3>页面批注（' + unresolvedCount() + ' 条待处理 / 共 ' + comments.length + ' 条）</h3>';
    if (!comments.length) {
      html += '<div class="ea-anno-empty">划选页面上的文字，点「添加批注」开始提修改意见</div>';
    }
    html += '<div class="ea-anno-alt-hint">提示：Tab / 按钮等文字划不上时，按住 Alt(Option) 点击该文字即可提批注</div>';
    comments.slice().reverse().forEach(function (c) {
      html += '<div class="ea-anno-item' + (c.resolved ? ' resolved' : '') + '" data-id="' + c.id + '">'
        + '<div class="ea-anno-quote-line">「' + esc(String(c.text || '')) + '」</div>'
        + '<div class="ea-anno-comment-line">' + esc(String(c.comment || '')) + '</div>'
        + '<div class="ea-anno-meta">' + esc(String(c.timestamp || '')) + ' '
        + (c.resolved ? '<span class="ea-anno-status">已处理</span>' : '<span>待处理</span>')
        + ' · <span class="ea-anno-del" data-del="' + c.id + '" style="color:#FF4D4F;cursor:pointer;">删除</span></div>'
        + '</div>';
    });
    panel.innerHTML = html;
    Array.prototype.forEach.call(panel.querySelectorAll('.ea-anno-del'), function (el) {
      el.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var id = el.getAttribute('data-del');
        http('DELETE', '/api/comments/' + id).then(function () {
          comments = comments.filter(function (c) { return String(c.id) !== String(id); });
          renderBadge(); renderPanel();
        });
      });
    });
    Array.prototype.forEach.call(panel.querySelectorAll('.ea-anno-item'), function (el) {
      el.addEventListener('click', function () {
        var c = comments.filter(function (x) { return String(x.id) === el.getAttribute('data-id'); })[0];
        if (!c) return;
        locateText(String(c.text || ''));
      });
    });
  }

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function locateText(text) {
    if (!text) return;
    if (window.find) {
      window.find(text, false, false, true);
      return;
    }
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      if (node.textContent.indexOf(text) !== -1) {
        var range = document.createRange();
        range.setStart(node, node.textContent.indexOf(text));
        range.setEnd(node, node.textContent.indexOf(text) + text.length);
        var rect = range.getBoundingClientRect();
        window.scrollTo(0, window.scrollY + rect.top - 160);
        break;
      }
    }
  }

  // 划词检测（含 selectionchange 缓存：某些组件 mouseup 后会立即清空选区）
  var lastSelectionText = '';
  var lastSelectionRange = null;
  document.addEventListener('selectionchange', function () {
    var sel = window.getSelection();
    var text = sel ? sel.toString().trim() : '';
    if (text && text.length <= 500) {
      lastSelectionText = text;
      lastSelectionRange = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    }
  });

  document.addEventListener('mouseup', function (ev) {
    if (ev.target.closest && ev.target.closest('#ea-anno-popup, #ea-anno-modal, #ea-anno-panel, #ea-anno-badge')) return;
    setTimeout(function () {
      var sel = window.getSelection();
      var text = sel ? sel.toString().trim() : '';
      // 选区被组件清空时，用 selectionchange 缓存兜底
      if (!text && lastSelectionText) text = lastSelectionText;
      if (!text || text.length > 500) { hidePopup(); return; }
      currentSelection = text;
      currentRange = (sel && sel.rangeCount) ? sel.getRangeAt(0).cloneRange() : lastSelectionRange;
      var rect = currentRange ? currentRange.getBoundingClientRect() : { left: ev.clientX, top: ev.clientY };
      var popup = document.getElementById('ea-anno-popup');
      popup.style.display = 'block';
      popup.style.left = Math.min(rect.left + window.scrollX, window.scrollX + window.innerWidth - 120) + 'px';
      popup.style.top = (rect.top + window.scrollY - 36) + 'px';
      lastSelectionText = '';
      lastSelectionRange = null;
    }, 10);
  });

  // 兜底入口：划不上时按住 Alt/Option 点击该文字，直接取其文本作为批注对象
  document.addEventListener('click', function (ev) {
    if (!ev.altKey) return;
    if (ev.target.closest && ev.target.closest('#ea-anno-popup, #ea-anno-modal, #ea-anno-panel, #ea-anno-badge')) return;
    var node = ev.target.closest('[role="tab"], button, .ant-tabs-tab, .ant-menu-title-content, th, td, label, .ant-select-selection-item, span, div');
    if (!node) return;
    var text = (node.innerText || node.textContent || '').trim().split('\\n')[0].slice(0, 100);
    if (!text) return;
    ev.preventDefault();
    ev.stopPropagation();
    currentSelection = text;
    currentRange = null;
    openModal();
  }, true);

  function hidePopup() {
    document.getElementById('ea-anno-popup').style.display = 'none';
  }

  function openModal() {
    hidePopup();
    var modal = document.getElementById('ea-anno-modal');
    document.getElementById('ea-anno-quote').textContent = currentSelection;
    document.getElementById('ea-anno-input').value = '';
    modal.style.display = 'block';
    document.getElementById('ea-anno-input').focus();
  }

  function closeModal() { document.getElementById('ea-anno-modal').style.display = 'none'; }

  function submitComment() {
    var input = document.getElementById('ea-anno-input');
    var commentText = input.value.trim();
    if (!commentText) { closeModal(); return; }
    var comment = {
      id: Date.now(),
      text: currentSelection,
      comment: commentText,
      timestamp: new Date().toISOString(),
      resolved: false,
      page: location.pathname
    };
    // 视觉高亮（React 重渲染后可能丢失，仅作辅助）
    if (currentRange) {
      try {
        var span = document.createElement('span');
        span.className = 'ea-anno-highlight';
        currentRange.surroundContents(span);
      } catch (e) { /* 跨元素选区包裹失败时忽略 */ }
    }
    window.getSelection().removeAllRanges();
    http('POST', '/api/comments', comment).then(function () {
      comments.push(comment);
      renderBadge(); renderPanel();
    });
    closeModal();
  }

  function mountUI() {
    var style = document.createElement('style');
    style.textContent = '';
    document.head.appendChild(style);

    var popup = document.createElement('div');
    popup.id = 'ea-anno-popup';
    popup.textContent = '添加批注';
    popup.addEventListener('click', openModal);
    document.body.appendChild(popup);

    var modal = document.createElement('div');
    modal.id = 'ea-anno-modal';
    modal.innerHTML = '<div class="ea-anno-modal-box">'
      + '<h3>添加批注</h3>'
      + '<div class="ea-anno-quote" id="ea-anno-quote"></div>'
      + '<textarea id="ea-anno-input" placeholder="写下修改意见，例如：这一列改成商户名称 / 增加一个状态筛选"></textarea>'
      + '<div class="ea-anno-modal-actions">'
      + '<button id="ea-anno-cancel">取消</button>'
      + '<button id="ea-anno-save" class="ea-anno-primary">保存批注</button>'
      + '</div></div>';
    modal.addEventListener('click', function (ev) { if (ev.target === modal) closeModal(); });
    document.body.appendChild(modal);

    var badge = document.createElement('button');
    badge.id = 'ea-anno-badge';
    badge.innerHTML = '批注<span class="ea-anno-badge-count" id="ea-anno-badge-count"></span>';
    badge.title = '点击查看批注列表';
    document.body.appendChild(badge);

    var panel = document.createElement('div');
    panel.id = 'ea-anno-panel';
    document.body.appendChild(panel);

    document.getElementById('ea-anno-cancel').addEventListener('click', closeModal);
    document.getElementById('ea-anno-save').addEventListener('click', submitComment);
    document.getElementById('ea-anno-input').addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) submitComment();
      if (ev.key === 'Escape') closeModal();
    });
    badge.addEventListener('click', function () {
      var p = document.getElementById('ea-anno-panel');
      p.style.display = p.style.display === 'block' ? 'none' : 'block';
      renderPanel();
    });

    loadComments();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountUI);
  } else {
    mountUI();
  }
})();
`;

function buildAnnotatedHtml(html) {
  const finalInject = '<style>' + CLIENT_CSS + '</style><script>' + CLIENT_JS + '</script>';
  if (html.includes('</body>')) {
    return html.replace('</body>', finalInject + '\n</body>');
  }
  return html + finalInject;
}

// ===================== HTTP 服务器 =====================

function readBody(req, cb) {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => cb(body));
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
  console.log('[' + new Date().toISOString() + '] ' + req.method + ' ' + req.url);

  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);

  // 批注 API
  if (req.method === 'GET' && urlPath === '/api/comments') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(getComments()));
    return;
  }
  if (req.method === 'POST' && urlPath === '/api/comments') {
    readBody(req, (body) => {
      try {
        const comment = JSON.parse(body);
        comment.id = comment.id || Date.now();
        comment.timestamp = comment.timestamp || new Date().toISOString();
        if (typeof comment.resolved !== 'boolean') comment.resolved = false;
        const comments = getComments();
        comments.push(comment);
        saveComments(comments);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(comment));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }
  if (req.method === 'POST' && urlPath === '/api/comments/clear') {
    saveComments([]);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{}');
    return;
  }
  if (req.method === 'DELETE' && urlPath.startsWith('/api/comments/')) {
    const id = urlPath.split('/').pop();
    saveComments(getComments().filter((c) => String(c.id) !== id));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{}');
    return;
  }
  // 批注 resolved 状态更新
  if (req.method === 'POST' && urlPath.startsWith('/api/comments/') && urlPath.endsWith('/resolve')) {
    const id = urlPath.replace('/api/comments/', '').replace('/resolve', '');
    const comments = getComments();
    const target = comments.find((c) => String(c.id) === String(id));
    if (target) target.resolved = true;
    saveComments(comments);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(target || {}));
    return;
  }

  // 根路径 → 302 到目标 preview.html 完整路径（保证相对资源 ./xxx 解析正确）
  if (req.method === 'GET' && (urlPath === '/' || urlPath === '/index.html')) {
    const target = '/' + path.relative(SERVE_ROOT, CONFIG.htmlPath).split(path.sep).map(encodeURIComponent).join('/');
    res.writeHead(302, { Location: target });
    res.end();
    return;
  }

  // 其他路径 → 静态文件
  if (req.method === 'GET') {
    serveStatic(req, res, urlPath);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(CONFIG.port, '127.0.0.1', () => {
  console.log('==========================================');
  console.log('  page-preview annotate-server');
  console.log('  预览: ' + CONFIG.htmlPath);
  console.log('  地址: http://127.0.0.1:' + CONFIG.port);
  console.log('  批注: ' + COMMENTS_FILE);
  console.log('==========================================');
});

// Keep-alive 心跳，防止进程被回收
setInterval(() => {
  const req = http.request({
    hostname: '127.0.0.1',
    port: CONFIG.port,
    path: '/api/comments',
    method: 'GET',
    timeout: 5000
  }, (res) => { res.resume(); });
  req.on('error', () => {});
  req.end();
}, 30000);

process.on('uncaughtException', (err) => {
  console.error('[' + new Date().toISOString() + '] 未捕获异常:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[' + new Date().toISOString() + '] 未处理拒绝:', reason);
});

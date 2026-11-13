/* ==========================================================================
   老黄的后花园 — 交互逻辑
   数据层：localStorage（lyd.posts.v1 / lyd.author.v1）
   渲染层：全部通过 createElement + textContent 写入，不拼接 innerHTML
   ========================================================================== */

(function () {
  'use strict';

  /* ---------------------------------------------------------------- 常量 */

  var POSTS_KEY = 'lyd.posts.v1';
  var AUTHOR_KEY = 'lyd.author.v1';

  var MAX_CONTENT = 500;
  var MAX_AUTHOR = 20;
  var DEFAULT_AUTHOR = '花园访客';

  var AVATAR_VARIANTS = 6;
  var STAGGER_LIMIT = 8;

  var els = {
    header: document.getElementById('site-header'),
    form: document.getElementById('post-form'),
    author: document.getElementById('author'),
    content: document.getElementById('content'),
    counter: document.getElementById('counter'),
    counterCurrent: document.getElementById('counter-current'),
    submit: document.getElementById('submit-btn'),
    error: document.getElementById('composer-error'),
    search: document.getElementById('search'),
    searchClear: document.getElementById('search-clear'),
    stat: document.getElementById('feed-stat'),
    feed: document.getElementById('feed'),
    empty: document.getElementById('empty'),
    emptyAction: document.getElementById('empty-action'),
    noResult: document.getElementById('no-result'),
    noResultAction: document.getElementById('no-result-action'),
    toast: document.getElementById('toast')
  };

  var posts = [];
  var keyword = '';
  var toastTimer = null;
  var filterFrame = 0;
  var filterTimer = 0;

  /* ---------------------------------------------------------------- 工具 */

  function pad(value) {
    return value < 10 ? '0' + value : String(value);
  }

  function createId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function formatTime(stamp) {
    var now = Date.now();
    var diff = now - stamp;

    if (diff < 60 * 1000) return '刚刚';
    if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + ' 分钟前';

    var date = new Date(stamp);
    var today = new Date(now);
    var clock = pad(date.getHours()) + ':' + pad(date.getMinutes());

    var sameDay = date.getFullYear() === today.getFullYear()
      && date.getMonth() === today.getMonth()
      && date.getDate() === today.getDate();

    if (sameDay) return clock;

    var day = (date.getMonth() + 1) + ' 月 ' + date.getDate() + ' 日 ' + clock;

    if (date.getFullYear() !== today.getFullYear()) {
      return date.getFullYear() + ' 年 ' + day;
    }

    return day;
  }

  function formatFull(stamp) {
    var date = new Date(stamp);
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
      + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
  }

  function avatarVariant(id) {
    var hash = 0;
    for (var i = 0; i < id.length; i += 1) {
      hash = (hash * 31 + id.charCodeAt(i)) % 100003;
    }
    return hash % AVATAR_VARIANTS;
  }

  function firstChar(name) {
    var trimmed = String(name).trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
  }

  function normalize(text) {
    return String(text).toLowerCase();
  }

  function matches(post, query) {
    if (!query) return true;
    var q = normalize(query);
    return normalize(post.content).indexOf(q) !== -1
      || normalize(post.author).indexOf(q) !== -1;
  }

  /* ---------------------------------------------------------- 提示与状态 */

  function showToast(message, isError) {
    els.toast.textContent = message;
    els.toast.classList.toggle('is-error', Boolean(isError));
    els.toast.classList.add('is-visible');

    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      els.toast.classList.remove('is-visible');
    }, 3000);
  }

  function showError(message) {
    if (!message) {
      els.error.hidden = true;
      els.error.textContent = '';
      return;
    }
    els.error.textContent = message;
    els.error.hidden = false;
  }

  /* -------------------------------------------------------------- 存储层 */

  function sanitize(raw) {
    if (!Array.isArray(raw)) throw new Error('数据格式异常');

    return raw
      .filter(function (item) {
        return item && typeof item === 'object'
          && typeof item.content === 'string'
          && item.content.trim() !== '';
      })
      .map(function (item) {
        return {
          id: typeof item.id === 'string' && item.id ? item.id : createId(),
          author: typeof item.author === 'string' && item.author.trim()
            ? item.author.trim().slice(0, MAX_AUTHOR)
            : DEFAULT_AUTHOR,
          content: String(item.content).trim().slice(0, MAX_CONTENT),
          createdAt: Number(item.createdAt) > 0 ? Number(item.createdAt) : Date.now(),
          liked: item.liked === true
        };
      });
  }

  function readPosts() {
    var raw;
    try {
      raw = window.localStorage.getItem(POSTS_KEY);
    } catch (err) {
      return { list: [], message: '浏览器禁用了本地存储，这次的内容可能无法保存。' };
    }

    if (!raw) return { list: [] };

    try {
      return { list: sanitize(JSON.parse(raw)) };
    } catch (err) {
      return { list: [], message: '本地数据读不出来了，已先给你一片干净的院子。' };
    }
  }

  function writePosts(list) {
    try {
      window.localStorage.setItem(POSTS_KEY, JSON.stringify(list));
      return { ok: true };
    } catch (err) {
      var quota = err && (err.name === 'QuotaExceededError'
        || err.name === 'NS_ERROR_DOM_QUOTA_REACHED'
        || err.code === 22);
      return {
        ok: false,
        message: quota
          ? '本地空间已满，删掉几条再试试。'
          : '本地存储写入失败，请检查浏览器设置。'
      };
    }
  }

  function readAuthor() {
    try {
      return window.localStorage.getItem(AUTHOR_KEY) || '';
    } catch (err) {
      return '';
    }
  }

  function saveAuthor(name) {
    try {
      window.localStorage.setItem(AUTHOR_KEY, name);
    } catch (err) {
      /* 署名记忆失败不影响主流程 */
    }
  }

  /* -------------------------------------------------------------- 渲染层 */

  var ICON_HEART = 'M12 20.2c-.3 0-.6-.1-.9-.3C6.1 16.2 3 13.3 3 9.9 3 7.2 5.1 5 7.7 5c1.5 0 3 .7 4.3 2 1.3-1.3 2.8-2 4.3-2C18.9 5 21 7.2 21 9.9c0 3.4-3.1 6.3-8.1 10-.3.2-.6.3-.9.3Z';

  function buildIcon(path, filled) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    var heart = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    heart.setAttribute('d', path);
    heart.setAttribute('stroke', 'currentColor');
    heart.setAttribute('stroke-width', '1.6');
    heart.setAttribute('stroke-linejoin', 'round');
    if (filled) {
      heart.setAttribute('fill', 'currentColor');
      heart.setAttribute('fill-opacity', '0.85');
    } else {
      heart.setAttribute('fill', 'none');
    }

    svg.appendChild(heart);
    return svg;
  }

  function appendHighlighted(container, text, query) {
    if (!query) {
      container.textContent = text;
      return;
    }

    var haystack = normalize(text);
    var needle = normalize(query);
    var from = 0;
    var at = haystack.indexOf(needle);

    while (at !== -1) {
      if (at > from) {
        container.appendChild(document.createTextNode(text.slice(from, at)));
      }
      var mark = document.createElement('mark');
      mark.className = 'card__highlight';
      mark.textContent = text.slice(at, at + needle.length);
      container.appendChild(mark);
      from = at + needle.length;
      at = haystack.indexOf(needle, from);
    }

    if (from < text.length) {
      container.appendChild(document.createTextNode(text.slice(from)));
    }
  }

  function buildCard(post, index) {
    var card = document.createElement('article');
    card.className = 'card';
    card.setAttribute('data-id', post.id);
    card.style.setProperty('--i', Math.min(index, STAGGER_LIMIT));

    var avatar = document.createElement('span');
    avatar.className = 'card__avatar card__avatar--' + avatarVariant(post.id);
    avatar.textContent = firstChar(post.author);
    avatar.setAttribute('aria-hidden', 'true');

    var main = document.createElement('div');
    main.className = 'card__main';

    var head = document.createElement('div');
    head.className = 'card__head';

    var author = document.createElement('span');
    author.className = 'card__author';
    author.textContent = post.author;

    var time = document.createElement('time');
    time.className = 'card__time';
    time.dateTime = new Date(post.createdAt).toISOString();
    time.title = formatFull(post.createdAt);
    time.textContent = formatTime(post.createdAt);

    head.appendChild(author);
    head.appendChild(time);

    var body = document.createElement('p');
    body.className = 'card__body';
    appendHighlighted(body, post.content, keyword);

    var actions = document.createElement('div');
    actions.className = 'card__actions';

    var likeBtn = document.createElement('button');
    likeBtn.type = 'button';
    likeBtn.className = 'card__action card__action--like';
    likeBtn.setAttribute('data-action', 'like');
    likeBtn.setAttribute('data-id', post.id);
    likeBtn.setAttribute('aria-pressed', post.liked ? 'true' : 'false');
    likeBtn.setAttribute('aria-label', post.liked ? '取消点赞' : '点赞');
    likeBtn.appendChild(buildIcon(ICON_HEART, post.liked));

    var likeText = document.createElement('span');
    likeText.className = 'card__action-icon';
    likeText.textContent = post.liked ? '已赞' : '赞';
    likeBtn.appendChild(likeText);

    var delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'card__action card__action--delete';
    delBtn.setAttribute('data-action', 'delete');
    delBtn.setAttribute('data-id', post.id);
    delBtn.setAttribute('aria-label', '删除这条动态');

    var delText = document.createElement('span');
    delText.textContent = '删除';
    delBtn.appendChild(delText);

    actions.appendChild(likeBtn);
    actions.appendChild(delBtn);

    main.appendChild(head);
    main.appendChild(body);
    main.appendChild(actions);

    card.appendChild(avatar);
    card.appendChild(main);

    return card;
  }

  function visiblePosts() {
    return posts
      .filter(function (post) { return matches(post, keyword); })
      .sort(function (a, b) { return b.createdAt - a.createdAt; });
  }

  function updateStat(shown) {
    if (keyword) {
      els.stat.textContent = '共 ' + posts.length + ' 条 · 命中 ' + shown + ' 条';
    } else {
      els.stat.textContent = '共 ' + posts.length + ' 条';
    }
  }

  function syncEmptyStates(shown) {
    var hasKeyword = keyword !== '';
    var showEmpty = posts.length === 0;
    var showNoResult = !showEmpty && shown === 0 && hasKeyword;

    els.empty.classList.toggle('is-visible', showEmpty);
    els.noResult.classList.toggle('is-visible', showNoResult);
  }

  function render() {
    var list = visiblePosts();
    var fragment = document.createDocumentFragment();

    list.forEach(function (post, index) {
      fragment.appendChild(buildCard(post, index));
    });

    els.feed.textContent = '';
    els.feed.appendChild(fragment);

    syncEmptyStates(list.length);
    updateStat(list.length);
    els.searchClear.hidden = keyword === '';
  }

  function flushFilter() {
    if (filterFrame) {
      window.cancelAnimationFrame(filterFrame);
      filterFrame = 0;
    }
    if (filterTimer) {
      window.clearTimeout(filterTimer);
      filterTimer = 0;
    }
    render();
  }

  function scheduleRender() {
    if (filterFrame || filterTimer) return;
    filterFrame = window.requestAnimationFrame(flushFilter);
    /* 兜底：后台标签页或首帧未生成时 rAF 可能被推迟，定时器保证筛选一定生效 */
    filterTimer = window.setTimeout(flushFilter, 120);
  }

  /* -------------------------------------------------------------- 行为层 */

  function updateCounter() {
    var length = els.content.value.length;
    els.counterCurrent.textContent = String(length);
    els.counter.classList.toggle('is-warning', length > 400 && length <= MAX_CONTENT);
    els.counter.classList.toggle('is-full', length > MAX_CONTENT);
    els.submit.disabled = length > MAX_CONTENT;
  }

  function handleSubmit(event) {
    if (event) event.preventDefault();

    var content = els.content.value.trim();
    var author = els.author.value.trim().slice(0, MAX_AUTHOR);

    if (!content) {
      showError('院子里不能空着，先写点什么吧。');
      els.content.focus();
      return;
    }

    if (content.length > MAX_CONTENT) {
      showError('超过 ' + MAX_CONTENT + ' 字了，删减一点再种。');
      return;
    }

    showError('');

    var post = {
      id: createId(),
      author: author || DEFAULT_AUTHOR,
      content: content,
      createdAt: Date.now(),
      liked: false
    };

    var next = posts.concat([post]);
    var result = writePosts(next);

    if (!result.ok) {
      showError(result.message);
      showToast(result.message, true);
      return;
    }

    posts = next;
    saveAuthor(author);

    var hiddenByFilter = keyword !== '' && !matches(post, keyword);
    if (hiddenByFilter) {
      keyword = '';
      els.search.value = '';
      showToast('种下啦，顺手帮你清空了筛选');
    } else {
      showToast('已经种进院子里啦');
    }

    render();

    els.content.value = '';
    updateCounter();
    els.content.focus();
  }

  function toggleLike(id) {
    var target = null;
    var next = posts.map(function (post) {
      if (post.id !== id) return post;
      target = {
        id: post.id,
        author: post.author,
        content: post.content,
        createdAt: post.createdAt,
        liked: !post.liked
      };
      return target;
    });

    if (!target) return;

    var result = writePosts(next);
    if (!result.ok) {
      showToast(result.message, true);
      return;
    }

    posts = next;

    var card = els.feed.querySelector('.card[data-id="' + id + '"]');
    var button = card ? card.querySelector('[data-action="like"]') : null;
    if (!button) {
      render();
      return;
    }

    button.setAttribute('aria-pressed', target.liked ? 'true' : 'false');
    button.setAttribute('aria-label', target.liked ? '取消点赞' : '点赞');

    var label = button.querySelector('.card__action-icon');
    if (label) label.textContent = target.liked ? '已赞' : '赞';

    var oldIcon = button.querySelector('svg');
    if (oldIcon) button.replaceChild(buildIcon(ICON_HEART, target.liked), oldIcon);
  }

  function removePost(id) {
    var next = posts.filter(function (post) { return post.id !== id; });
    var result = writePosts(next);

    if (!result.ok) {
      showToast(result.message, true);
      return;
    }

    posts = next;

    var card = els.feed.querySelector('.card[data-id="' + id + '"]');
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function finish() {
      render();
      showToast('这条已经从院子里收走了');
    }

    if (card && !reduced) {
      card.classList.add('is-removing');
      window.setTimeout(finish, 280);
    } else {
      finish();
    }
  }

  function handleFeedClick(event) {
    var target = event.target;
    if (!(target instanceof Element)) return;

    var button = target.closest('[data-action]');
    if (!button) return;

    var action = button.getAttribute('data-action');
    var id = button.getAttribute('data-id');
    if (!id) return;

    if (action === 'like') {
      toggleLike(id);
      return;
    }

    if (action === 'delete') {
      var card = button.closest('.card');
      var authorEl = card ? card.querySelector('.card__author') : null;
      var who = authorEl ? authorEl.textContent : '这条';
      if (window.confirm('确定要收走「' + who + '」的这条吗？')) {
        removePost(id);
      }
    }
  }

  function handleSearchInput() {
    var next = els.search.value.trim();
    if (next === keyword) return;
    keyword = next;
    els.searchClear.hidden = keyword === '';
    scheduleRender();
  }

  function clearSearch() {
    if (keyword === '' && els.search.value === '') return;
    keyword = '';
    els.search.value = '';
    els.searchClear.hidden = true;
    render();
    els.search.focus();
  }

  function handleKeydown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      handleSubmit();
    }
  }

  function handleStorage(event) {
    if (event.key !== POSTS_KEY && event.key !== null) return;

    var loaded = readPosts();
    posts = loaded.list;
    render();

    if (loaded.message) {
      showToast(loaded.message, true);
    } else {
      showToast('院子在其他标签页里更新了');
    }
  }

  function handleScroll() {
    els.header.classList.toggle('is-scrolled', window.scrollY > 4);
  }

  /* -------------------------------------------------------------- 初始化 */

  function init() {
    var loaded = readPosts();
    posts = loaded.list;

    els.author.value = readAuthor();

    render();
    updateCounter();
    handleScroll();

    els.form.addEventListener('submit', handleSubmit);
    els.content.addEventListener('input', function () {
      updateCounter();
      if (!els.error.hidden) showError('');
    });
    els.content.addEventListener('keydown', handleKeydown);
    els.feed.addEventListener('click', handleFeedClick);
    els.search.addEventListener('input', handleSearchInput);
    els.search.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') clearSearch();
    });
    els.searchClear.addEventListener('click', clearSearch);
    els.emptyAction.addEventListener('click', function () {
      els.content.focus();
    });
    els.noResultAction.addEventListener('click', clearSearch);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('scroll', handleScroll, { passive: true });

    if (loaded.message) {
      window.setTimeout(function () {
        showToast(loaded.message, true);
      }, 500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

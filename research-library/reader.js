/* Embedded by rebuild_catalog.py so index.html also works offline. */
(() => {
  'use strict';
  const {sources, meta} = JSON.parse(document.getElementById('catalog-data').textContent);
  const $ = id => document.getElementById(id);
  const states = {new:'Не начато', queued:'В очереди', reading:'Читаю', read:'Прочитано', later:'Отложено'};
  const auditLabels = {matched:'Название и ссылка сверены', corrected:'Запись исправлена', review:'Нужна ручная сверка', unavailable:'Не удалось получить источник', pending:'Ещё не сверено'};
  const storageKey = 'pysatl-research-reader-v1', pageSize = 18;
  const byId = new Map(sources.map(s => [s.id, s]));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeUrl = url => /^https?:\/\//i.test(url) ? esc(url) : '#';
  let saved = {notes:{},ui:{}};
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (value && value.notes && typeof value.notes === 'object' && !Array.isArray(value.notes)) saved = value;
  } catch {}
  const notes = saved.notes || {};
  let routeId = saved.ui?.route || 'start', selected = saved.ui?.selected || meta.routes[0].ids[0];
  let page = 0, filtered = [];
  if (!meta.routes.some(r => r.id === routeId) && routeId !== 'all') routeId = 'start';
  if (!byId.has(selected)) selected = meta.routes[0].ids[0];
  const note = id => notes[id] || {};
  const readState = id => states[note(id).status] ? note(id).status : 'new';
  const auditState = s => auditLabels[s.audit?.status] ? s.audit.status : 'pending';
  const filterIds = ['search','topic','kind','priority','read-filter','audit-filter','content-filter','requirement-filter','scope'];

  function toast(message) {
    $('toast').textContent = message;
    $('toast').classList.remove('hidden');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => $('toast').classList.add('hidden'), 5000);
  }
  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({version:1, notes, ui:{route:routeId,selected}}));
      return true;
    } catch { toast('Хранилище недоступно. Экспортируйте заметки, чтобы сохранить их.'); return false; }
  }
  function updateProgress() {
    const active = sources.filter(s => !note(s.id).excluded);
    $('reading-progress').textContent = `Прочитано: ${active.filter(s => readState(s.id) === 'read').length} / ${active.length} в рабочем списке`;
  }
  function renderNav() {
    $('routes').innerHTML = `<button data-route="all" aria-pressed="${routeId === 'all'}">Все источники · ${sources.length}</button>` + meta.routes.map(r => `<button data-route="${esc(r.id)}" aria-pressed="${r.id === routeId}">${esc(r.title)}</button>`).join('');
  }
  function resetFilters(all = true) {
    for (const id of filterIds) $(id).value = id === 'scope' ? 'active' : '';
    $('favorite-only').checked = false;
    $('sort').value = 'route';
    page = 0;
    if (all) { routeId = 'all'; applyFilters(); persist(); }
  }
  function applyFilters() {
    const route = meta.routes.find(r => r.id === routeId), ids = route ? new Set(route.ids) : null;
    const query = $('search').value.toLocaleLowerCase().trim(), scope = $('scope').value;
    filtered = sources.filter(s => {
      const n = note(s.id), content = s.content_check?.status || 'pending';
      const text = [s.id,s.title,s.authors,s.summary,s.why,s.question,s.url,s.key,s.verification,s.audit?.note,
        ...s.requirements,...s.aliases,...s.links.map(l => l.url),n.conclusion,n.application,n.questions].join(' ').toLocaleLowerCase();
      return (!ids || ids.has(s.id)) &&
        (scope === 'all' || (scope === 'excluded' ? n.excluded : !n.excluded)) &&
        (!$('topic').value || s.group === $('topic').value) &&
        (!$('kind').value || s.kind === $('kind').value) &&
        (!$('priority').value || s.priority === Number($('priority').value)) &&
        (!$('read-filter').value || readState(s.id) === $('read-filter').value) &&
        (!$('audit-filter').value || auditState(s) === $('audit-filter').value) &&
        (!$('content-filter').value || content === $('content-filter').value) &&
        (!$('requirement-filter').value || s.requirements.includes($('requirement-filter').value)) &&
        (!$('favorite-only').checked || n.favorite) && (!query || text.includes(query));
    });
    const order = new Map((route?.ids || []).map((id,i) => [id,i])), sort = $('sort').value;
    filtered.sort((a,b) => sort === 'newest' ? ((b.year || 0) - (a.year || 0) || a.id.localeCompare(b.id)) :
      sort === 'oldest' ? ((a.year || 9999) - (b.year || 9999) || a.id.localeCompare(b.id)) :
      sort === 'title' ? a.title.localeCompare(b.title) :
      sort === 'route' && route ? order.get(a.id) - order.get(b.id) : a.priority - b.priority || a.id.localeCompare(b.id));
    page = Math.min(page, Math.max(0, Math.ceil(filtered.length / pageSize) - 1));
    if (filtered.length && !filtered.some(s => s.id === selected)) selected = filtered[page * pageSize].id;
    $('result-title').textContent = (route?.title || 'Все источники') + ` · ${filtered.length}`;
    $('route-desc').textContent = route?.description || 'Ищите по названию, DOI, идее или собственным заметкам. Проверка реквизитов и проверка содержания показаны отдельно.';
    renderList(); renderNav(); updateProgress(); renderDetail();
  }
  function renderList() {
    const start = page * pageSize, visible = filtered.slice(start, start + pageSize);
    $('list').innerHTML = visible.length ? visible.map(s => `<button class="source" data-source="${s.id}" aria-pressed="${s.id === selected}">
      <div class="source-meta"><span class="id">${s.id}</span><span>${s.year || 'год не указан'}</span><span>${esc(s.kind)}</span>${note(s.id).favorite ? '<span aria-label="Избранное">★</span>' : ''}</div>
      <h3>${esc(s.title)}</h3><div class="source-meta">${esc(s.authors || 'Авторы — в первоисточнике')}</div>
      <p class="source-summary">${esc(s.why)}</p><div class="source-foot"><span class="tag">${esc(auditLabels[auditState(s)])}</span><span class="tag">${esc(states[readState(s.id)])}</span>${note(s.id).excluded ? '<span class="tag">Исключено мной</span>' : ''}</div></button>`).join('') :
      '<div class="empty">Нет источников по этим условиям. Сбросьте фильтры или откройте все источники.</div>';
    const pages = Math.ceil(filtered.length / pageSize);
    $('pager').innerHTML = pages > 1 ? `<button id="prev-page" ${page === 0 ? 'disabled' : ''}>Назад</button><span>${start + 1}–${Math.min(start + pageSize,filtered.length)} из ${filtered.length}</span><button id="next-page" ${page + 1 >= pages ? 'disabled' : ''}>Далее</button>` : '';
  }
  function renderDetail() {
    const s = byId.get(selected);
    if (!s || !filtered.length) { $('detail-inner').innerHTML = '<p class="empty">Выберите источник из списка.</p>'; return; }
    const n = note(s.id), audit = s.audit || {}, content = s.content_check;
    $('detail-inner').innerHTML = `<div class="eyebrow">${s.id} / ${esc(meta.groups[s.group])}</div>
      <h2>${esc(s.title)}</h2><div class="detail-meta">${esc(s.authors || 'Авторы — в первоисточнике')} · ${s.year || 'Год не зафиксирован'} · ${esc(s.kind)}</div>
      <div class="detail-actions"><a class="primary" href="${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer">Первоисточник ↗</a><button id="favorite" aria-pressed="${Boolean(n.favorite)}">${n.favorite ? '★ В избранном' : '☆ В избранное'}</button>
      <select id="source-state" class="statusselect" aria-label="Мой статус чтения">${Object.entries(states).map(([v,t]) => `<option value="${v}" ${readState(s.id) === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <button id="exclude-source">${n.excluded ? 'Вернуть в рабочий список' : 'Исключить из рабочего списка'}</button><button id="copy-link">Ссылка на карточку</button></div>
      <section class="evidence-box"><h3>Проверка реквизитов</h3><p><strong>${esc(auditLabels[auditState(s)])}</strong>${audit.checked ? ' · ' + esc(audit.checked) : ''}</p>
      <p>${esc(audit.note || 'Нет отдельной зафиксированной сверки. Прежнее описание глубины чтения приведено ниже.')}</p>
      ${audit.evidence_url ? `<a href="${safeUrl(audit.evidence_url)}" target="_blank" rel="noopener noreferrer">Основание сверки ↗</a>` : ''}
      <h3>Проверка содержания</h3><p>${esc(content?.note || 'Нет отдельного подтверждения аннотации. Совпадение названия и ссылки не подтверждает все утверждения.')}</p></section>
      <section><h3>О чём работа · по источнику</h3><p>${esc(s.summary)}</p></section>
      <section><h3>Возможное применение · наш вывод</h3><p>${esc(s.why)}</p></section>
      <section class="key-question"><h3>На что ответить при чтении</h3><p>${esc(s.question)}</p></section>
      <section><h3>Связь с требованиями</h3><p>${s.requirements.map(v => `<button class="requirement-link" data-requirement="${v}">${v}</button>`).join(' ')}</p></section>
      <section class="verification"><strong>Глубина чтения: ${esc(s.verification)}.</strong><p>${esc(s.caution)}</p>
      ${s.links.map(l => `<p><a href="${safeUrl(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} ↗</a></p>`).join('')}
      <p><small>Аннотация ассистента не означает, что источник прочитан вами. Проверка ссылки не является воспроизведением результатов.</small></p></section>
      <div class="note-grid"><div class="note-title"><h3>Мои заметки</h3><span id="save-status" class="save-status"></span></div>
      ${[['conclusion','Мой вывод','Главная идея своими словами; что подтверждено'],['application','Что применить / проверить','Требование или эксперимент для диплома'],['questions','Вопросы и найденные ошибки','Что нужно уточнить; почему источник исключён']].map(([field,label,placeholder]) => `<div><label for="my-${field}">${label}</label><textarea id="my-${field}" data-note="${field}" placeholder="${placeholder}">${esc(n[field] || '')}</textarea></div>`).join('')}</div>`;
  }
  function selectSource(id, updateHash = true) {
    if (!byId.has(id)) return;
    selected = id;
    const index = filtered.findIndex(s => s.id === id);
    if (index >= 0) page = Math.floor(index / pageSize);
    renderList(); renderDetail(); persist();
    if (updateHash) history.replaceState(null,'', '#source=' + encodeURIComponent(id));
  }
  function openHash() {
    const id = new URLSearchParams(location.hash.slice(1)).get('source');
    if (!byId.has(id)) return;
    routeId = 'all'; resetFilters(false); $('scope').value = 'all'; selected = id;
    applyFilters(); selectSource(id, false);
  }
  $('library-count').textContent = `${sources.length} источников · статей: ${meta.type_counts['Статья']} · ${Object.keys(meta.groups).length} направлений`;
  for (const [id,label] of Object.entries(meta.groups)) $('topic').insertAdjacentHTML('beforeend', `<option value="${esc(id)}">${esc(label)}</option>`);
  for (const kind of Object.keys(meta.type_counts)) $('kind').insertAdjacentHTML('beforeend', `<option value="${esc(kind)}">${esc(kind)}</option>`);
  for (const [id,label] of Object.entries(auditLabels)) $('audit-filter').insertAdjacentHTML('beforeend', `<option value="${id}">${label}</option>`);
  for (const id of [...new Set(sources.flatMap(s => s.requirements))].sort()) $('requirement-filter').insertAdjacentHTML('beforeend', `<option value="${id}">${id}</option>`);
  $('routes').addEventListener('click', e => {
    const button = e.target.closest('[data-route]'); if (!button) return;
    routeId = button.dataset.route; resetFilters(false);
    const route = meta.routes.find(r => r.id === routeId); if (route) selected = route.ids[0];
    history.replaceState(null,'',location.pathname + location.search);
    applyFilters(); persist();
  });
  $('list').addEventListener('click', e => {
    const button = e.target.closest('[data-source]'); if (!button) return;
    selectSource(button.dataset.source);
    if (innerWidth < 850) $('detail').scrollIntoView({behavior:'smooth',block:'start'});
  });
  for (const id of [...filterIds,'favorite-only','sort']) $(id).addEventListener(id === 'search' ? 'input' : 'change', () => {
    page = 0;
    if (id === 'search' && $('search').value.trim()) routeId = 'all';
    applyFilters();
  });
  $('pager').addEventListener('click', e => {
    if (e.target.id === 'prev-page') page--; else if (e.target.id === 'next-page') page++; else return;
    selected = filtered[page * pageSize].id; renderList(); renderDetail();
    $('result-title').scrollIntoView({behavior:'smooth',block:'start'});
  });
  $('reset').addEventListener('click', () => resetFilters());
  $('detail-inner').addEventListener('click', async e => {
    const req = e.target.closest('[data-requirement]');
    if (req) { routeId = 'all'; resetFilters(false); $('requirement-filter').value = req.dataset.requirement; page = 0; applyFilters(); return; }
    if (e.target.id === 'favorite') { notes[selected] = {...note(selected),favorite:!note(selected).favorite}; persist(); applyFilters(); }
    if (e.target.id === 'exclude-source') {
      const id = selected, excluded = !note(id).excluded;
      notes[id] = {...note(id),excluded}; persist(); applyFilters();
      toast(excluded ? 'Источник исключён из рабочего списка. Вернуть его можно через фильтр «Исключённые».' : 'Источник возвращён в рабочий список.');
    }
    if (e.target.id === 'copy-link') {
      const url = new URL(location.href); url.hash = 'source=' + selected;
      try { await navigator.clipboard.writeText(url.href); toast('Ссылка на карточку скопирована.'); }
      catch { history.replaceState(null,'',url.href); toast('Ссылка на карточку находится в адресной строке браузера.'); }
    }
  });
  $('detail-inner').addEventListener('change', e => {
    if (e.target.id !== 'source-state') return;
    notes[selected] = {...note(selected),status:e.target.value}; persist(); renderList(); updateProgress();
  });
  $('detail-inner').addEventListener('input', e => {
    if (!e.target.dataset.note) return;
    notes[selected] = {...note(selected),[e.target.dataset.note]:e.target.value,updated:new Date().toISOString()};
    $('save-status').textContent = persist() ? 'Сохранено в браузере' : 'Нужен экспорт';
  });
  $('export-notes').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({version:1,exported:new Date().toISOString(),catalog_date:meta.date,notes},null,2)],{type:'application/json;charset=utf-8'}));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'pysatl-reading-notes.json'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url),1000);
  });
  $('import-notes').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      if (file.size > 5e6) throw Error('Файл слишком большой');
      const value = JSON.parse(await file.text());
      if (value.version !== 1 || !value.notes || typeof value.notes !== 'object' || Array.isArray(value.notes)) throw Error('Неизвестный формат');
      let count = 0;
      for (const [id,n] of Object.entries(value.notes)) {
        if (!byId.has(id) || !n || typeof n !== 'object' || Array.isArray(n)) continue;
        const clean = {};
        for (const field of ['conclusion','application','questions','updated']) if (typeof n[field] === 'string') clean[field] = n[field];
        if (states[n.status]) clean.status = n.status;
        for (const field of ['favorite','excluded']) if (typeof n[field] === 'boolean') clean[field] = n[field];
        notes[id] = {...note(id),...clean}; count++;
      }
      persist(); applyFilters(); toast(`Импортировано карточек с заметками: ${count}`);
    } catch (error) { toast('Не удалось прочитать заметки: ' + error.message); }
    e.target.value = '';
  });
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) { e.preventDefault(); $('search').focus(); }
  });
  window.addEventListener('hashchange',openHash);
  applyFilters(); openHash();
})();

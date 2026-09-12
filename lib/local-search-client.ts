export const LOCAL_SEARCH_CLIENT_CORE_JS = `
  var LOCAL_SEARCH_RESULT_LIMIT = 50;

  function normalizeSearchText(value) {
    return String(value || '').toLocaleLowerCase().normalize('NFKD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\\s+/g, ' ').trim();
  }

  function queryTokens(value) {
    return normalizeSearchText(value).split(' ').filter(Boolean);
  }

  function citationTitleBoost(title, value) {
    var query = String(value || '').trim().toLocaleLowerCase().replace(/[–—−]/g, '-').replace(/^§+\\s*/, '');
    if (!/^\\d+(?:[.-]\\d+){1,2}$/.test(query)) return 0;
    var candidate = String(title || '').trim().toLocaleLowerCase().replace(/[–—−]/g, '-').replace(/^§+\\s*/, '');
    var next = candidate.charAt(query.length);
    return candidate.indexOf(query) === 0 && (!next || /[^0-9]/.test(next)) ? 300 : 0;
  }

  function buildLocalSearchEngine(documents, storeFields) {
    if (typeof MiniSearch !== 'function') return null;
    var engine = new MiniSearch({
      fields: ['title', 'context', 'text'],
      storeFields: storeFields,
      tokenize: queryTokens,
      searchOptions: {
        combineWith: 'AND',
        prefix: true,
        fuzzy: 0.2,
        boost: { title: 3, context: 1.5 }
      }
    });
    engine.addAll(documents);
    return engine;
  }

  function rankLocalSearchResults(engine, query) {
    var rawSearch = normalizeSearchText(query);
    var matches = engine.search(query).map(function (result) {
      var titleSearch = normalizeSearchText([result.title, result.context].filter(Boolean).join(' '));
      var score = result.score
        + (titleSearch.indexOf(rawSearch) !== -1 ? 100 : 0)
        + citationTitleBoost(result.title, query);
      return { result: result, score: score };
    });
    matches.sort(function (left, right) {
      return right.score - left.score || left.result.title.localeCompare(right.result.title);
    });
    return matches;
  }

  function searchResultSnippet(text, tokens) {
    var value = String(text || '').replace(/\\s+/g, ' ').trim();
    if (!value) return '';
    var lower = value.toLocaleLowerCase();
    var hit = -1;
    tokens.some(function (token) {
      var candidate = lower.indexOf(token);
      if (candidate !== -1 && (hit === -1 || candidate < hit)) hit = candidate;
      return candidate === 0;
    });
    if (hit < 0) hit = 0;
    var start = Math.max(0, hit - 62);
    var end = Math.min(value.length, start + 190);
    var result = value.slice(start, end);
    if (start > 0) result = '…' + result;
    if (end < value.length) result += '…';
    return result;
  }
`;

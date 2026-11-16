/**
 * DSPE Observable Patterns Browser
 *
 * Interactive browser for the 50-pattern observable_patterns.csv dataset.
 * Features: filter, search, sort, detail view, export, accessibility.
 *
 * Mounted via: <div id="observatory-patterns-root"></div>
 * import { mountObservatoryPatterns } from './observatory-patterns-browser.js';
 * mountObservatoryPatterns('#observatory-patterns-root');
 */

const CONFIDENCE_LEVELS = { high: 1, medium: 2, low: 3 };
const CONFIDENCE_LABELS = { high: '🟢 HIGH', medium: '🟡 MEDIUM', low: '🔴 LOW' };
const PATTERNS_JSON_URL = '/data/observable_patterns.json';
const PATTERNS_CSV_URL = '/data/observable_patterns.csv';

// Cache for loaded patterns
let cachedPatterns = [];
let cachedFiltered = [];

/**
 * Parse CSV string to array of objects (RFC 4180).
 * Single-pass field parser — keeps quote state across commas and newlines.
 */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || (char === '\r' && nextChar === '\n') || char === '\r') {
      row.push(field);
      field = '';
      if (row.some((cell) => String(cell).trim() !== '')) {
        rows.push(row);
      }
      row = [];
      if (char === '\r' && nextChar === '\n') i++;
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((cell) => String(cell).trim() !== '')) {
    rows.push(row);
  }

  if (!rows.length) return [];
  const header = rows[0].map((h) => String(h).trim());
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const fields = rows[r];
    if (fields.length !== header.length) continue;
    const obj = {};
    header.forEach((key, idx) => {
      obj[key] = String(fields[idx] || '').trim();
    });
    out.push(obj);
  }
  return out;
}

/**
 * Apply filters and search to patterns
 */
function applyFilters(patterns, filters) {
  return patterns.filter(p => {
    // Confidence filter
    if (filters.confidence !== 'all' && p.confidence !== filters.confidence) {
      return false;
    }
    
    // Interaction type filter
    if (filters.interactionType !== 'all' && p.interaction_type !== filters.interactionType) {
      return false;
    }
    
    // Participants filter
    if (filters.participants !== 'all') {
      const pList = (p.participants || '').split(';').map(x => x.trim().toUpperCase());
      if (!pList.includes(filters.participants)) {
        return false;
      }
    }
    
    // Search text filter
    if (filters.searchText) {
      const query = filters.searchText.toLowerCase();
      const searchable = [
        p.pattern_id,
        p.participants,
        p.interaction_type,
        p.observed_pattern,
        p.notes
      ].join(' ').toLowerCase();
      
      if (!searchable.includes(query)) {
        return false;
      }
    }
    
    return true;
  });
}

/**
 * Sort patterns by specified column
 */
function sortPatterns(patterns, sortBy, sortDir) {
  const sorted = [...patterns];
  
  sorted.sort((a, b) => {
    let aVal = a[sortBy] || '';
    let bVal = b[sortBy] || '';
    
    // Numeric sort for confidence
    if (sortBy === 'confidence') {
      aVal = CONFIDENCE_LEVELS[aVal] || 999;
      bVal = CONFIDENCE_LEVELS[bVal] || 999;
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    // String sort
    aVal = String(aVal).toLowerCase();
    bVal = String(bVal).toLowerCase();
    
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });
  
  return sorted;
}

/**
 * Create DOM element helper
 */
function el(tag, attrs = {}, content = '') {
  const elem = document.createElement(tag);
  
  Object.entries(attrs).forEach(([key, val]) => {
    if (key === 'class') {
      elem.className = val;
    } else if (key === 'style') {
      Object.assign(elem.style, val);
    } else if (key.startsWith('on')) {
      const event = key.slice(2).toLowerCase();
      elem.addEventListener(event, val);
    } else {
      elem.setAttribute(key, val);
    }
  });
  
  if (typeof content === 'string') {
    elem.textContent = content;
  } else if (content instanceof Node) {
    elem.appendChild(content);
  } else if (Array.isArray(content)) {
    content.forEach(c => {
      if (typeof c === 'string') {
        elem.appendChild(document.createTextNode(c));
      } else if (c instanceof Node) {
        elem.appendChild(c);
      }
    });
  }
  
  return elem;
}

/**
 * Build the complete UI
 */
function buildUI(root, patterns) {
  const state = {
    patterns,
    filtered: patterns,
    sortBy: 'pattern_id',
    sortDir: 'asc',
    currentPage: 1,
    pageSize: 20,
    selectedPattern: null,
    filters: {
      confidence: 'all',
      interactionType: 'all',
      participants: 'all',
      searchText: ''
    }
  };
  
  // Extract unique values for dropdowns
  const interactionTypes = ['all', ...new Set(patterns.map(p => p.interaction_type))].sort();
  const participantsList = ['all'];
  patterns.forEach(p => {
    (p.participants || '').split(';').forEach(part => {
      const normalized = part.trim().toUpperCase();
      if (normalized && !participantsList.includes(normalized)) {
        participantsList.push(normalized);
      }
    });
  });
  
  // Build main container
  const container = el('div', { class: 'obs-patterns-container' }, [
    buildHeader(),
    buildFilters(state, interactionTypes, participantsList),
    buildTable(state),
    buildPagination(state),
    buildDetailModal(state)
  ]);
  
  root.innerHTML = '';
  root.appendChild(container);
  
  // Attach event handlers
  attachEventHandlers(container, state, interactionTypes, participantsList);
  
  // Initial render
  updateTable(container, state);
}

/**
 * Build header section
 */
function buildHeader() {
  return el('header', { class: 'obs-header' }, [
    el('h1', { class: 'obs-title' }, 'DSPE Observable Patterns Browser'),
    el('p', { class: 'obs-subtitle' }, 
      'Explore 50 observable patterns from multi-AI interactions. ' +
      'Filter, search, and export for research and analysis.')
  ]);
}

/**
 * Build filter controls
 */
function buildFilters(state, interactionTypes, participants) {
  const container = el('div', { class: 'obs-filters' });
  
  // Search input
  const searchInput = el('input', {
    class: 'obs-search-input',
    type: 'text',
    placeholder: 'Search patterns...',
    'aria-label': 'Search patterns'
  });
  
  // Confidence filter
  const confidenceSelect = el('select', {
    class: 'obs-filter-select',
    'aria-label': 'Filter by confidence'
  });
  ['all', 'high', 'medium', 'low'].forEach(val => {
    const option = el('option', { value: val }, 
      val === 'all' ? 'All Confidence Levels' : val.toUpperCase());
    confidenceSelect.appendChild(option);
  });
  
  // Interaction type filter
  const typeSelect = el('select', {
    class: 'obs-filter-select',
    'aria-label': 'Filter by interaction type'
  });
  interactionTypes.forEach(val => {
    const option = el('option', { value: val }, 
      val === 'all' ? 'All Types' : val.replace(/_/g, ' '));
    typeSelect.appendChild(option);
  });
  
  // Participants filter
  const participantsSelect = el('select', {
    class: 'obs-filter-select',
    'aria-label': 'Filter by participants'
  });
  participants.forEach(val => {
    const option = el('option', { value: val }, 
      val === 'all' ? 'All Participants' : val);
    participantsSelect.appendChild(option);
  });
  
  container.appendChild(el('div', { class: 'obs-filter-row' }, [
    el('label', { class: 'obs-search-label' }, 'Search: '),
    searchInput,
    el('label', { class: 'obs-filter-label' }, 'Confidence: '),
    confidenceSelect,
    el('label', { class: 'obs-filter-label' }, 'Type: '),
    typeSelect,
    el('label', { class: 'obs-filter-label' }, 'Participants: '),
    participantsSelect
  ]));
  
  // Store references for event handling
  container.dataset.searchInput = 'search-input';
  container.dataset.confidenceSelect = 'confidence-select';
  container.dataset.typeSelect = 'type-select';
  container.dataset.participantsSelect = 'participants-select';
  
  searchInput.id = 'search-input';
  confidenceSelect.id = 'confidence-select';
  typeSelect.id = 'type-select';
  participantsSelect.id = 'participants-select';
  
  return container;
}

/**
 * Build patterns table
 */
function buildTable(state) {
  const tableContainer = el('div', { class: 'obs-table-container' });
  const table = el('table', { class: 'obs-patterns-table', role: 'grid' });
  
  // Header row
  const thead = el('thead');
  const headerRow = el('tr', { class: 'obs-header-row' });
  
  const columns = ['pattern_id', 'participants', 'interaction_type', 'confidence'];
  columns.forEach(col => {
    const label = col.replace(/_/g, ' ').toUpperCase();
    const th = el('th', {
      class: 'obs-header-cell',
      role: 'columnheader',
      'aria-sort': state.sortBy === col ? (state.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
    }, label);
    th.style.cursor = 'pointer';
    th.dataset.column = col;
    headerRow.appendChild(th);
  });
  
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // Body (will be populated by updateTable)
  const tbody = el('tbody', { class: 'obs-table-body' });
  table.appendChild(tbody);
  
  tableContainer.appendChild(table);
  tableContainer.id = 'obs-table-container';
  
  return tableContainer;
}

/**
 * Build pagination controls
 */
function buildPagination(state) {
  const container = el('div', { class: 'obs-pagination' });
  const info = el('div', { class: 'obs-pagination-info' });
  info.id = 'obs-pagination-info';
  
  const buttons = el('div', { class: 'obs-pagination-buttons' });
  
  const prevBtn = el('button', {
    class: 'obs-pagination-btn',
    'aria-label': 'Previous page'
  }, '← Previous');
  prevBtn.id = 'obs-prev-btn';
  
  const nextBtn = el('button', {
    class: 'obs-pagination-btn',
    'aria-label': 'Next page'
  }, 'Next →');
  nextBtn.id = 'obs-next-btn';
  
  buttons.appendChild(prevBtn);
  buttons.appendChild(nextBtn);
  
  container.appendChild(info);
  container.appendChild(buttons);
  
  return container;
}

/**
 * Build detail modal
 */
function buildDetailModal(state) {
  const modal = el('div', {
    class: 'obs-modal',
    role: 'dialog',
    'aria-hidden': 'true',
    'aria-labelledby': 'obs-modal-title'
  });
  modal.id = 'obs-detail-modal';
  
  const backdrop = el('div', { class: 'obs-modal-backdrop' });
  
  const content = el('div', { class: 'obs-modal-content' });
  content.id = 'obs-modal-content';
  
  modal.appendChild(backdrop);
  modal.appendChild(content);
  
  return modal;
}

/**
 * Update table with current filtered/sorted data
 */
function updateTable(container, state) {
  // Apply filters and search
  state.filtered = applyFilters(state.patterns, state.filters);
  
  // Apply sort
  state.filtered = sortPatterns(state.filtered, state.sortBy, state.sortDir);
  
  // Update pagination
  const totalPages = Math.ceil(state.filtered.length / state.pageSize);
  state.currentPage = Math.min(state.currentPage, Math.max(1, totalPages));
  
  // Get current page data
  const start = (state.currentPage - 1) * state.pageSize;
  const end = start + state.pageSize;
  const pageData = state.filtered.slice(start, end);
  
  // Update table body
  const tbody = container.querySelector('.obs-table-body');
  tbody.innerHTML = '';
  
  pageData.forEach(pattern => {
    const row = el('tr', {
      class: 'obs-table-row',
      role: 'row'
    });
    row.style.cursor = 'pointer';
    row.dataset.patternId = pattern.pattern_id;
    
    const cells = [
      { text: pattern.pattern_id, title: pattern.pattern_id },
      { text: pattern.participants, title: pattern.participants },
      { text: pattern.interaction_type.replace(/_/g, ' '), title: pattern.interaction_type },
      { text: CONFIDENCE_LABELS[pattern.confidence] || '?', title: pattern.confidence }
    ];
    
    cells.forEach(cell => {
      const td = el('td', { class: 'obs-table-cell', title: cell.title }, cell.text);
      td.style.maxWidth = '200px';
      td.style.overflow = 'hidden';
      td.style.textOverflow = 'ellipsis';
      row.appendChild(td);
    });
    
    // Click to open detail view
    row.addEventListener('click', () => {
      showDetailView(container, state, pattern);
    });
    
    tbody.appendChild(row);
  });
  
  // Update pagination info
  const info = container.querySelector('#obs-pagination-info');
  const total = state.filtered.length;
  info.textContent = `Showing ${Math.min(end, total)} of ${total} patterns (Page ${state.currentPage}/${totalPages})`;
  
  // Update pagination buttons
  container.querySelector('#obs-prev-btn').disabled = state.currentPage <= 1;
  container.querySelector('#obs-next-btn').disabled = state.currentPage >= totalPages;
}

/**
 * Show pattern detail view
 */
function showDetailView(container, state, pattern) {
  state.selectedPattern = pattern;
  const modal = container.querySelector('#obs-detail-modal');
  const content = container.querySelector('#obs-modal-content');
  
  content.innerHTML = '';
  content.appendChild(buildDetailContent(pattern));
  
  modal.setAttribute('aria-hidden', 'false');
  modal.style.display = 'flex';
  
  // Close on backdrop click
  const backdrop = modal.querySelector('.obs-modal-backdrop');
  backdrop.onclick = () => closeDetailView(modal);
  
  // Close on Escape
  const closeOnEscape = (e) => {
    if (e.key === 'Escape') {
      closeDetailView(modal);
      document.removeEventListener('keydown', closeOnEscape);
    }
  };
  document.addEventListener('keydown', closeOnEscape);
}

/**
 * Build detail content for a pattern
 */
function buildDetailContent(pattern) {
  const container = el('div', { class: 'obs-detail-container' });
  
  container.appendChild(el('div', { class: 'obs-detail-header' }, [
    el('h2', { id: 'obs-modal-title', class: 'obs-detail-title' }, pattern.pattern_id),
    el('button', {
      class: 'obs-close-btn',
      'aria-label': 'Close detail view'
    }, '✕')
  ]));
  
  container.appendChild(el('section', { class: 'obs-detail-section' }, [
    el('h3', {}, 'Participants'),
    el('p', { class: 'obs-detail-participants' },
      pattern.participants.split(';').map(p => `🤖 ${p.trim()}`).join(' · '))
  ]));
  
  container.appendChild(el('section', { class: 'obs-detail-section' }, [
    el('h3', {}, 'Interaction Type'),
    el('p', {}, pattern.interaction_type.replace(/_/g, ' '))
  ]));
  
  container.appendChild(el('section', { class: 'obs-detail-section' }, [
    el('h3', {}, 'Confidence'),
    el('p', { class: `obs-confidence-${pattern.confidence}` },
      `${CONFIDENCE_LABELS[pattern.confidence]}`)
  ]));
  
  container.appendChild(el('section', { class: 'obs-detail-section' }, [
    el('h3', {}, 'Observed Pattern'),
    el('p', { class: 'obs-observed-pattern' }, pattern.observed_pattern)
  ]));
  
  container.appendChild(el('section', { class: 'obs-detail-section' }, [
    el('h3', {}, 'Evidence Source'),
    el('p', {}, pattern.evidence_source)
  ]));
  
  if (pattern.source_path) {
    const sourceDiv = el('section', { class: 'obs-detail-section' }, [
      el('h3', {}, 'Source Files'),
      el('ul', { class: 'obs-source-list' })
    ]);
    
    const ul = sourceDiv.querySelector('.obs-source-list');
    pattern.source_path.split(';').forEach(path => {
      const trimmed = path.trim();
      if (trimmed) {
        ul.appendChild(el('li', {}, trimmed));
      }
    });
    
    container.appendChild(sourceDiv);
  }
  
  if (pattern.notes) {
    container.appendChild(el('section', { class: 'obs-detail-section' }, [
      el('h3', {}, 'Notes'),
      el('p', {}, pattern.notes)
    ]));
  }
  
  // Export button
  const exportBtn = el('button', {
    class: 'obs-export-btn'
  }, 'Export as JSON');
  exportBtn.onclick = () => exportPattern(pattern);
  
  container.appendChild(el('div', { class: 'obs-detail-actions' }, exportBtn));
  
  return container;
}

/**
 * Close detail view
 */
function closeDetailView(modal) {
  modal.setAttribute('aria-hidden', 'true');
  modal.style.display = 'none';
}

/**
 * Export pattern as JSON
 */
function exportPattern(pattern) {
  const json = JSON.stringify(pattern, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${pattern.pattern_id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Attach all event handlers
 */
function attachEventHandlers(container, state, interactionTypes, participants) {
  // Filter change handlers
  const searchInput = container.querySelector('#search-input');
  const confidenceSelect = container.querySelector('#confidence-select');
  const typeSelect = container.querySelector('#type-select');
  const participantsSelect = container.querySelector('#participants-select');
  
  const updateFiltersAndTable = () => {
    state.filters = {
      searchText: searchInput.value,
      confidence: confidenceSelect.value,
      interactionType: typeSelect.value,
      participants: participantsSelect.value
    };
    state.currentPage = 1; // Reset to first page
    updateTable(container, state);
  };
  
  searchInput.addEventListener('input', updateFiltersAndTable);
  confidenceSelect.addEventListener('change', updateFiltersAndTable);
  typeSelect.addEventListener('change', updateFiltersAndTable);
  participantsSelect.addEventListener('change', updateFiltersAndTable);
  
  // Sort handlers
  container.querySelectorAll('.obs-header-cell').forEach(th => {
    th.addEventListener('click', () => {
      const column = th.dataset.column;
      if (state.sortBy === column) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortBy = column;
        state.sortDir = 'asc';
      }
      updateTable(container, state);
    });
  });
  
  // Pagination handlers
  container.querySelector('#obs-prev-btn').addEventListener('click', () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      updateTable(container, state);
      container.scrollIntoView({ behavior: 'smooth' });
    }
  });
  
  container.querySelector('#obs-next-btn').addEventListener('click', () => {
    const totalPages = Math.ceil(state.filtered.length / state.pageSize);
    if (state.currentPage < totalPages) {
      state.currentPage++;
      updateTable(container, state);
      container.scrollIntoView({ behavior: 'smooth' });
    }
  });
  
  // Close modal on close button
  container.querySelector('#obs-detail-modal').addEventListener('click', (e) => {
    if (e.target.classList.contains('obs-close-btn')) {
      closeDetailView(container.querySelector('#obs-detail-modal'));
    }
  });
}

/**
 * Public mount function
 */
export async function mountObservatoryPatterns(selector) {
  const root = document.querySelector(selector);
  if (!root) {
    console.error('Observatory patterns root element not found:', selector);
    return;
  }
  
  try {
    let patterns = [];

    // Prefer JSON (bulletproof). Then embedded CSV. Then fetched CSV.
    if (Array.isArray(window.OBSERVABLE_PATTERNS_JSON) && window.OBSERVABLE_PATTERNS_JSON.length) {
      patterns = window.OBSERVABLE_PATTERNS_JSON;
    } else {
      try {
        const jsonResp = await fetch(PATTERNS_JSON_URL);
        if (jsonResp.ok) {
          const data = await jsonResp.json();
          if (Array.isArray(data) && data.length) patterns = data;
        }
      } catch (_) {
        /* fall through */
      }
    }

    if (!patterns.length) {
      let csvData = window.OBSERVABLE_PATTERNS_DATA || '';
      if (!csvData) {
        const response = await fetch(PATTERNS_CSV_URL);
        if (!response.ok) {
          throw new Error(`Failed to load patterns: ${response.statusText}`);
        }
        csvData = await response.text();
      }
      patterns = parseCSV(csvData);
    }

    cachedPatterns = patterns;
    
    if (!patterns || patterns.length === 0) {
      root.innerHTML = '<p class="obs-error">No patterns loaded</p>';
      return;
    }
    
    // Build UI
    buildUI(root, patterns);
    
    console.log(`✓ Observatory Patterns Browser loaded: ${patterns.length} patterns`);
  } catch (error) {
    console.error('Failed to mount observatory patterns:', error);
    root.innerHTML = `<p class="obs-error">Failed to load patterns: ${error.message}</p>`;
  }
}

// Auto-mount if data attribute present
if (document.currentScript) {
  const mount = document.currentScript.dataset.mount;
  if (mount) {
    document.addEventListener('DOMContentLoaded', () => {
      mountObservatoryPatterns(mount);
    });
  }
}

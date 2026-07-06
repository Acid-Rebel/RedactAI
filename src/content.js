/**
 * RedactAI Content Script
 * Intercepts file uploads on AI chat sites, extracts text,
 * runs PII detection, shows a floating redaction panel,
 * and inserts the sanitized text into the chat.
 */

import { extractPdfText, extractTextFile } from './extractor.js';
import { detectPII } from './piiDetector.js';
import { jsPDF } from 'jspdf';
import './content.css';

// Chat input selectors per site
const SITE_INPUT_SELECTORS = {
  'chatgpt.com': '#prompt-textarea, [contenteditable="true"][data-id]',
  'chat.openai.com': '#prompt-textarea, [contenteditable="true"][data-id]',
  'claude.ai': '[contenteditable="true"].ProseMirror',
  'gemini.google.com': '.ql-editor[contenteditable="true"]',
  'copilot.microsoft.com': '#userInput, [contenteditable="true"]',
  'chat.mistral.ai': 'textarea, [contenteditable="true"]',
  'chat.deepseek.com': 'textarea, [contenteditable="true"]',
  'aistudio.google.com': 'textarea, [contenteditable="true"]',
  'grok.com': 'textarea, [contenteditable="true"]',
  'poe.com': 'textarea[placeholder], [contenteditable="true"]',
  'huggingface.co': 'textarea, [contenteditable="true"]',
  'www.perplexity.ai': 'div[contenteditable="true"], textarea',
};

const SUPPORTED_EXTENSIONS = ['pdf', 'txt'];
let panelVisible = false;

function isSupported(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  return SUPPORTED_EXTENSIONS.includes(ext);
}

// ── Initialization ──────────────────────────────────────────────────

function init() {
  console.log('[RedactAI] Initializing on', window.location.hostname);
  setupFileInterception();
  setupDragDetection();
  setupPasteDetection();
  console.log('[RedactAI] Ready.');
}

// ── File Interception ───────────────────────────────────────────────

function setupFileInterception() {
  document.addEventListener('change', (e) => {
    const target = e.target;
    if (target.tagName !== 'INPUT' || target.type !== 'file') return;
    const file = target.files?.[0];
    if (!file || !isSupported(file.name)) return;

    console.log('[RedactAI] File detected via input:', file.name);
    e.preventDefault();
    e.stopImmediatePropagation();
    handleFile(file);
  }, { capture: true });
}

function setupDragDetection() {
  document.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (!file || !isSupported(file.name)) return;
    console.log('[RedactAI] File dropped:', file.name);
    setTimeout(() => handleFile(file), 200);
  }, { capture: true, passive: true });
}

function setupPasteDetection() {
  window.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file && isSupported(file.name)) {
          console.log('[RedactAI] File pasted:', file.name);
          e.preventDefault();
          e.stopImmediatePropagation();
          handleFile(file);
          break;
        }
      }
    }
  }, { capture: true });
}

// ── Core Pipeline ───────────────────────────────────────────────────

async function handleFile(file) {
  if (panelVisible) removePanel();
  
  showPanel('loading', file.name);

  try {
    const ext = file.name.toLowerCase().split('.').pop();
    let text;
    if (ext === 'pdf') {
      text = await extractPdfText(file);
    } else {
      text = await extractTextFile(file);
    }

    if (!text || !text.trim()) {
      showPanel('error', 'Could not extract any text from the file.');
      return;
    }

    const redactions = detectPII(text);
    console.log(`[RedactAI] Found ${redactions.length} PII items.`);
    showRedactionPanel(text, redactions, file.name);
  } catch (err) {
    console.error('[RedactAI] Pipeline error:', err);
    showPanel('error', err.message || 'Failed to process file.');
  }
}

// ── Panel UI ────────────────────────────────────────────────────────

function removePanel() {
  const el = document.getElementById('redactai-root');
  if (el) el.remove();
  panelVisible = false;
}

function showPanel(state, message) {
  removePanel();
  panelVisible = true;

  const root = document.createElement('div');
  root.id = 'redactai-root';
  root.innerHTML = `
    <div class="redactai-panel">
      <div class="redactai-header">
        <div class="redactai-logo">🛡️ <strong>RedactAI</strong></div>
        <button class="redactai-close" title="Close">✕</button>
      </div>
      <div class="redactai-body">
        ${state === 'loading' ? `
          <div class="redactai-loading">
            <div class="redactai-spinner"></div>
            <span>Scanning <strong>${esc(message)}</strong> for PII…</span>
          </div>
        ` : `
          <div class="redactai-error">
            <span>❌ ${esc(message)}</span>
          </div>
        `}
      </div>
    </div>
  `;

  root.querySelector('.redactai-close').onclick = removePanel;
  root.addEventListener('mousedown', e => e.stopPropagation());
  document.body.appendChild(root);
}

function showRedactionPanel(originalText, redactions, fileName) {
  removePanel();
  panelVisible = true;

  const root = document.createElement('div');
  root.id = 'redactai-root';

  const piiCount = redactions.length;
  const typeBreakdown = {};
  redactions.forEach(r => {
    typeBreakdown[r.pii_type] = (typeBreakdown[r.pii_type] || 0) + 1;
  });

  root.innerHTML = `
    <div class="redactai-panel redactai-panel-large">
      <div class="redactai-header">
        <div class="redactai-logo">🛡️ <strong>RedactAI</strong></div>
        <span class="redactai-file-badge">${esc(fileName)}</span>
        <button class="redactai-close" title="Close">✕</button>
      </div>

      <div class="redactai-stats-bar">
        <span class="redactai-stat redactai-stat-found">
          🔍 <strong><span id="redactai-total-count">${piiCount}</span></strong> PII items
        </span>
        <div id="redactai-chips" style="display:flex;gap:4px;flex-wrap:wrap;"></div>
      </div>

      <div class="redactai-body">
        <div class="redactai-preview" id="redactai-preview"></div>
      </div>

      <div class="redactai-pii-list" id="redactai-pii-list">
        <div class="redactai-list-header">All Detected Items:</div>
      </div>

      <div class="redactai-footer">
        <button class="redactai-btn redactai-btn-ghost" id="redactai-select-all">Select All</button>
        <button class="redactai-btn redactai-btn-ghost" id="redactai-deselect-all">Deselect All</button>
        <div class="redactai-footer-spacer"></div>
        <button class="redactai-btn redactai-btn-ghost" id="redactai-export-original" title="Export Original Document">⬇️ Original (.txt)</button>
        <button class="redactai-btn redactai-btn-ghost" id="redactai-export-safe" title="Export Safe Document">⬇️ Safe (.txt)</button>
        <button class="redactai-btn redactai-btn-ghost" id="redactai-export-safe-pdf" title="Export Safe Document as PDF">⬇️ Safe (.pdf)</button>
        <button class="redactai-btn redactai-btn-secondary" id="redactai-copy">📋 Copy</button>
        <button class="redactai-btn redactai-btn-secondary" id="redactai-upload-txt">⬆️ Upload .txt</button>
        <button class="redactai-btn redactai-btn-primary" id="redactai-insert">✏️ Paste to Chat</button>
      </div>
    </div>
  `;

  root.querySelector('.redactai-close').onclick = removePanel;
  root.addEventListener('mousedown', e => e.stopPropagation());

  const previewEl = root.querySelector('#redactai-preview');
  const listEl = root.querySelector('#redactai-pii-list');
  const chipsEl = root.querySelector('#redactai-chips');
  const totalCountEl = root.querySelector('#redactai-total-count');

  let activeDropdownType = null;

  function renderChips() {
    chipsEl.innerHTML = '';
    const breakdown = {};
    redactions.forEach(r => {
      breakdown[r.pii_type] = (breakdown[r.pii_type] || 0) + 1;
    });

    Object.entries(breakdown).forEach(([type, count]) => {
      const chip = document.createElement('span');
      chip.className = 'redactai-stat-chip' + (activeDropdownType === type ? ' active' : '');
      chip.innerHTML = `${count}× ${type} <span style="font-size:8px">▼</span>`;
      chip.onclick = (e) => {
        e.stopPropagation();
        if (activeDropdownType === type) {
          closeDropdown();
        } else {
          openDropdown(type, chip);
        }
      };
      chipsEl.appendChild(chip);
    });
    totalCountEl.textContent = redactions.length;
  }

  function closeDropdown() {
    activeDropdownType = null;
    const existing = root.querySelector('.redactai-dropdown');
    if (existing) existing.remove();
    renderChips();
  }

  function openDropdown(type, anchorChip) {
    closeDropdown();
    activeDropdownType = type;
    renderChips();

    const dropdown = document.createElement('div');
    dropdown.className = 'redactai-dropdown';
    
    // Prevent closing when clicking inside
    dropdown.onclick = e => e.stopPropagation();

    const itemsOfType = redactions.filter(r => r.pii_type === type);
    
    dropdown.innerHTML = `
      <div class="redactai-dropdown-header">
        <span style="font-size:12px;font-weight:600;color:#a5b4fc">${type} Items</span>
        <div>
          <button class="redactai-btn redactai-btn-ghost" id="dd-redact-all" style="padding:2px 6px">Redact All</button>
          <button class="redactai-btn redactai-btn-ghost" id="dd-unredact-all" style="padding:2px 6px">Unredact All</button>
        </div>
      </div>
      <div class="redactai-dropdown-list" id="dd-list"></div>
    `;

    dropdown.querySelector('#dd-redact-all').onclick = () => {
      redactions.forEach(r => { if (r.pii_type === type) r.is_redacted = true; });
      renderAll();
    };
    dropdown.querySelector('#dd-unredact-all').onclick = () => {
      redactions.forEach(r => { if (r.pii_type === type) r.is_redacted = false; });
      renderAll();
    };

    const ddList = dropdown.querySelector('#dd-list');
    itemsOfType.forEach(r => {
      const item = document.createElement('div');
      item.className = `redactai-list-item ${r.is_redacted ? 'redacted' : 'kept'}`;
      const confStr = r.confidence ? `(${Math.round(r.confidence * 100)}%)` : '';
      item.innerHTML = `
        <span class="redactai-list-text" title="${esc(r.original_text)}">${esc(r.original_text)} <span style="color:#64748b;font-size:10px">${confStr}</span></span>
        <button class="redactai-toggle-btn">${r.is_redacted ? '🔒' : '🔓'}</button>
      `;
      item.querySelector('.redactai-toggle-btn').onclick = () => {
        r.is_redacted = !r.is_redacted;
        renderAll();
      };
      ddList.appendChild(item);
    });

    root.querySelector('.redactai-stats-bar').appendChild(dropdown);
  }

  // Close dropdown when clicking outside
  root.addEventListener('click', () => closeDropdown());

  function renderPreview() {
    let html = '';
    let cursor = 0;
    const sorted = [...redactions].sort((a, b) => a.start - b.start);

    for (const r of sorted) {
      if (r.start > cursor) {
        html += `<span data-start="${cursor}">${esc(originalText.substring(cursor, r.start))}</span>`;
      }

      const confStr = r.confidence ? ` [${Math.round(r.confidence * 100)}% Confidence]` : '';
      const title = `[${r.pii_type}]${confStr} ${esc(r.original_text)}`;

      if (r.is_redacted) {
        html += `<span class="redactai-redacted" data-id="${r.id}" title="${title}" style="background:${r.color};border-color:${r.color.replace('0.35', '0.8').replace('0.5', '0.9')}">${r.icon} [${r.pii_type}]</span>`;
      } else {
        html += `<span class="redactai-kept" data-id="${r.id}" title="Click to redact${confStr}">${esc(r.original_text)}</span>`;
      }

      cursor = r.end;
    }

    if (cursor < originalText.length) {
      html += `<span data-start="${cursor}">${esc(originalText.substring(cursor))}</span>`;
    }

    previewEl.innerHTML = html;

    previewEl.querySelectorAll('.redactai-redacted, .redactai-kept').forEach(span => {
      span.onclick = (e) => {
        e.stopPropagation(); // Prevent dropdown closing if clicking inside preview
        const id = span.dataset.id;
        const r = redactions.find(x => x.id === id);
        if (r) {
          r.is_redacted = !r.is_redacted;
          renderAll();
        }
      };
    });
  }

  function renderList() {
    const header = listEl.querySelector('.redactai-list-header');
    listEl.innerHTML = '';
    listEl.appendChild(header);

    for (const r of redactions) {
      const item = document.createElement('div');
      item.className = `redactai-list-item ${r.is_redacted ? 'redacted' : 'kept'}`;
      const confStr = r.confidence ? `(${Math.round(r.confidence * 100)}%)` : '';
      item.innerHTML = `
        <span class="redactai-list-icon">${r.icon}</span>
        <span class="redactai-list-type">${r.pii_type}</span>
        <span class="redactai-list-text" title="${esc(r.original_text)}">${esc(r.original_text.length > 30 ? r.original_text.substring(0, 30) + '…' : r.original_text)} <span style="color:#64748b;font-size:10px">${confStr}</span></span>
        <button class="redactai-toggle-btn">${r.is_redacted ? '🔒' : '🔓'}</button>
      `;
      item.querySelector('.redactai-toggle-btn').onclick = () => {
        r.is_redacted = !r.is_redacted;
        renderAll();
      };
      listEl.appendChild(item);
    }
  }

  function renderAll() {
    renderPreview();
    renderList();
    renderChips();
    if (activeDropdownType) {
      // Re-render dropdown to reflect toggle changes
      const anchor = chipsEl.querySelector('.active');
      if (anchor) openDropdown(activeDropdownType, anchor);
    }
  }

  // --- Manual Redaction Logic ---
  let manualPopup = null;
  
  previewEl.addEventListener('mouseup', (e) => {
    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection.toString().trim();
      
      if (manualPopup) {
        manualPopup.remove();
        manualPopup = null;
      }

      if (text.length > 1 && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        
        const rect = range.getBoundingClientRect();
        const rootRect = root.getBoundingClientRect();
        
        manualPopup = document.createElement('div');
        manualPopup.className = 'redactai-manual-popup';
        manualPopup.textContent = '🔒 Redact';
        manualPopup.style.top = `${rect.top - rootRect.top - 25}px`;
        manualPopup.style.left = `${rect.left - rootRect.left + (rect.width/2)}px`;
        
        manualPopup.onmousedown = (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const rawText = selection.toString();
          const trimOffset = rawText.indexOf(text);
          let absoluteStart = -1;

          let startContainer = range.startContainer;
          let span = startContainer.nodeType === 3 ? startContainer.parentElement : startContainer;
          
          if (span && span.hasAttribute('data-start')) {
             absoluteStart = parseInt(span.getAttribute('data-start'), 10) + range.startOffset + trimOffset;
          } else if (span && span.classList.contains('redactai-kept')) {
             const r = redactions.find(x => x.id === span.dataset.id);
             if (r) absoluteStart = r.start + range.startOffset + trimOffset;
          }

          if (absoluteStart === -1) {
             absoluteStart = originalText.indexOf(text); 
          }
          
          if (absoluteStart !== -1) {
            const isCovered = redactions.some(r => absoluteStart >= r.start && (absoluteStart + text.length) <= r.end);
            
            if (!isCovered) {
              redactions.push({
                id: `manual-${absoluteStart}-${absoluteStart+text.length}-${Math.random().toString(36).substring(2)}`,
                original_text: originalText.substring(absoluteStart, absoluteStart+text.length),
                pii_type: 'MANUAL',
                confidence: 1.0,
                start: absoluteStart,
                end: absoluteStart + text.length,
                is_redacted: true,
                icon: '✏️',
                color: 'rgba(0, 240, 255, 0.4)'
              });
              
              selection.removeAllRanges();
              manualPopup.remove();
              manualPopup = null;
              renderAll();
            }
          }
        };
        
        root.appendChild(manualPopup);
      }
    }, 10);
  });
  
  // Clear manual popup on mousedown anywhere else
  root.addEventListener('mousedown', () => {
    if (manualPopup) {
      manualPopup.remove();
      manualPopup = null;
    }
  });

  renderAll();

  // Footer actions
  root.querySelector('#redactai-select-all').onclick = () => {
    redactions.forEach(r => r.is_redacted = true);
    renderAll();
  };

  root.querySelector('#redactai-deselect-all').onclick = () => {
    redactions.forEach(r => r.is_redacted = false);
    renderAll();
  };

  root.querySelector('#redactai-copy').onclick = () => {
    const safe = buildSafeText(originalText, redactions);
    navigator.clipboard.writeText(safe).then(() => {
      flashBtn(root.querySelector('#redactai-copy'), '✅ Copied!', '📋 Copy');
    });
  };

  root.querySelector('#redactai-upload-txt').onclick = () => {
    const safe = buildSafeText(originalText, redactions);
    const fn = fileName.replace(/\.[^.]+$/, '') + '_redacted.txt';
    uploadTxtToChat(safe, fn);
    flashBtn(root.querySelector('#redactai-upload-txt'), '✅ Uploaded!', '⬆️ Upload .txt');
    setTimeout(removePanel, 1500);
  };

  root.querySelector('#redactai-insert').onclick = () => {
    const safe = buildSafeText(originalText, redactions);
    insertIntoChat(safe);
    flashBtn(root.querySelector('#redactai-insert'), '✅ Inserted!', '✏️ Paste to Chat');
    setTimeout(removePanel, 1500);
  };
  
  root.querySelector('#redactai-export-safe').onclick = () => {
    const safe = buildSafeText(originalText, redactions);
    downloadTextFile(safe, fileName.replace(/\.[^.]+$/, '') + '_redacted.txt');
  };
  
  root.querySelector('#redactai-export-safe-pdf').onclick = () => {
    const safe = buildSafeText(originalText, redactions);
    downloadPdfFile(safe, fileName.replace(/\.[^.]+$/, '') + '_redacted.pdf');
  };
  
  root.querySelector('#redactai-export-original').onclick = () => {
    downloadTextFile(originalText, fileName.replace(/\.[^.]+$/, '') + '_original.txt');
  };

  document.body.appendChild(root);
}

// ── Helpers ─────────────────────────────────────────────────────────

function downloadTextFile(text, filename) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadPdfFile(text, filename) {
  try {
    const doc = new jsPDF();
    const splitText = doc.splitTextToSize(text, 180);
    
    let y = 15;
    for (let i = 0; i < splitText.length; i++) {
      if (y > 280) {
        doc.addPage();
        y = 15;
      }
      doc.text(splitText[i], 15, y);
      y += 7;
    }
    
    doc.save(filename);
  } catch (e) {
    console.error('[RedactAI] Error generating PDF:', e);
    alert('Failed to generate PDF. See console for details.');
  }
}

function buildSafeText(originalText, redactions) {
  let result = '';
  let cursor = 0;
  const sorted = [...redactions].sort((a, b) => a.start - b.start);

  for (const r of sorted) {
    if (r.start > cursor) {
      result += originalText.substring(cursor, r.start);
    }
    result += r.is_redacted ? `[${r.pii_type}_REDACTED]` : r.original_text;
    cursor = r.end;
  }

  if (cursor < originalText.length) {
    result += originalText.substring(cursor);
  }

  return result;
}

function insertIntoChat(text) {
  const hostname = location.hostname;
  const selector = SITE_INPUT_SELECTORS[hostname] || '[contenteditable="true"], textarea';
  let input = document.activeElement;

  if (
    !input ||
    input === document.body ||
    input.id === 'redactai-root' ||
    input.closest('#redactai-root')
  ) {
    input = document.querySelector(selector);
  }

  if (!input) {
    navigator.clipboard.writeText(text);
    return;
  }

  if (input.closest('[contenteditable]') && !input.hasAttribute('contenteditable')) {
    input = input.closest('[contenteditable]');
  }

  input.focus();

  if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
    const s = input.selectionStart || input.value.length;
    input.value = input.value.slice(0, s) + text + input.value.slice(input.selectionEnd || s);
    input.selectionStart = input.selectionEnd = s + text.length;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    document.execCommand('insertText', false, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function uploadTxtToChat(text, filename) {
  const file = new File([text], filename, { type: 'text/plain' });
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);

  // Simulate a drag-and-drop file upload on the page
  const events = ['dragenter', 'dragover', 'drop'];
  const target = document.body;

  for (const type of events) {
    const ev = new DragEvent(type, {
      bubbles: true,
      cancelable: true,
      dataTransfer: dataTransfer
    });
    target.dispatchEvent(ev);
  }
}

function flashBtn(btn, tempText, origText) {
  if (!btn) return;
  btn.textContent = tempText;
  setTimeout(() => { btn.textContent = origText; }, 2000);
}

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

init();

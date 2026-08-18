/**
 * Smart Quick Notebook - Core Application Logic
 * Fixed Labels (editable only in settings) + Flexible Numeric/Text Inputs
 * Responsive, no blocking prompts/confirms, instant undo support.
 */

(function () {
  'use strict';

  // Default Template Presets
  const DEFAULT_TEMPLATES = [
    {
      id: 'tpl_structure',
      name: 'Mẫu Kết Cấu (Beam / Rafter / Joist)',
      items: [
        { id: 'item_1', label: 'Beam', unit: '', value: '125' },
        { id: 'item_2', label: 'Rafter', unit: '', value: '190' },
        { id: 'item_3', label: 'Joist', unit: '', value: '150' }
      ],
      extraNotes: ''
    },
    {
      id: 'tpl_dimensions',
      name: 'Kích Thước Phòng & Cửa',
      items: [
        { id: 'item_d1', label: 'Chiều Dài', unit: 'mm', value: '' },
        { id: 'item_d2', label: 'Chiều Rộng', unit: 'mm', value: '' },
        { id: 'item_d3', label: 'Chiều Cao', unit: 'mm', value: '' },
        { id: 'item_d4', label: 'Độ Dày', unit: 'mm', value: '' }
      ],
      extraNotes: ''
    },
    {
      id: 'tpl_costing',
      name: 'Số Lượng & Dự Toán Nhanh',
      items: [
        { id: 'item_c1', label: 'Số Lượng', unit: 'cái', value: '' },
        { id: 'item_c2', label: 'Đơn Giá', unit: 'đ', value: '' },
        { id: 'item_c3', label: 'Hao Hụt (%)', unit: '%', value: '5' },
        { id: 'item_c4', label: 'Tổng Tiền', unit: 'đ', value: '' }
      ],
      extraNotes: ''
    }
  ];

  // Storage Keys
  const STORAGE_KEY_TEMPLATES = 'smart_notebook_templates_v2';
  const STORAGE_KEY_ACTIVE_ID = 'smart_notebook_active_tpl_v2';
  const STORAGE_KEY_THEME = 'smart_notebook_theme_v2';

  // Available Themes
  const THEMES = ['dark', 'midnight', 'amber', 'light'];

  // App State
  let state = {
    templates: [],
    activeTemplateId: '',
    theme: 'dark'
  };

  // Undo memory for quick clear action
  let undoSnapshot = null;

  // Temp state while editing in modal
  let modalTempTemplate = null;
  let deleteConfirmTimeout = null;

  // DOM Elements
  const elements = {
    themeBody: document.body,
    templateSelect: document.getElementById('templateSelect'),
    itemsContainer: document.getElementById('itemsContainer'),
    extraNotes: document.getElementById('extraNotes'),
    autoSaveIndicator: document.getElementById('autoSaveIndicator'),
    activeTemplateBadge: document.getElementById('activeTemplateBadge'),
    
    // Header Buttons
    btnNewNote: document.getElementById('btnNewNote'),
    btnClearValues: document.getElementById('btnClearValues'),
    btnCopyData: document.getElementById('btnCopyData'),
    btnToggleTheme: document.getElementById('btnToggleTheme'),
    btnOpenSettings: document.getElementById('btnOpenSettings'),
    
    // Settings Modal
    settingsModal: document.getElementById('settingsModal'),
    btnCloseSettings: document.getElementById('btnCloseSettings'),
    btnCancelSettings: document.getElementById('btnCancelSettings'),
    btnSaveSettings: document.getElementById('btnSaveSettings'),
    modalTemplateSelector: document.getElementById('modalTemplateSelector'),
    currentTemplateNameInput: document.getElementById('currentTemplateNameInput'),
    settingsLabelsList: document.getElementById('settingsLabelsList'),
    btnAddLabelRow: document.getElementById('btnAddLabelRow'),
    btnCreateTemplate: document.getElementById('btnCreateTemplate'),
    btnDeleteTemplate: document.getElementById('btnDeleteTemplate'),
    btnLoadSamplePresets: document.getElementById('btnLoadSamplePresets'),
    btnExportData: document.getElementById('btnExportData'),
    importFileInput: document.getElementById('importFileInput'),
    
    // Toast & Undo
    toast: document.getElementById('toastNotification'),
    toastMessage: document.getElementById('toastMessage'),
    btnToastUndo: document.getElementById('btnToastUndo')
  };

  // --- INITIALIZATION ---
  function init() {
    loadStateFromStorage();
    applyTheme(state.theme);
    renderTemplateDropdown();
    renderMainNotebook();
    bindEvents();
  }

  // --- STORAGE MANAGEMENT ---
  function loadStateFromStorage() {
    try {
      const savedTemplates = localStorage.getItem(STORAGE_KEY_TEMPLATES) || localStorage.getItem('smart_notebook_templates_v1');
      const savedActiveId = localStorage.getItem(STORAGE_KEY_ACTIVE_ID) || localStorage.getItem('smart_notebook_active_tpl_v1');
      const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) || localStorage.getItem('smart_notebook_theme_v1');

      if (savedTemplates) {
        state.templates = JSON.parse(savedTemplates);
      } else {
        state.templates = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
      }

      if (savedActiveId && state.templates.some(t => t.id === savedActiveId)) {
        state.activeTemplateId = savedActiveId;
      } else if (state.templates.length > 0) {
        state.activeTemplateId = state.templates[0].id;
      }

      if (savedTheme && THEMES.includes(savedTheme)) {
        state.theme = savedTheme;
      }
    } catch (e) {
      console.error('Lỗi khi tải dữ liệu từ localStorage:', e);
      state.templates = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
      state.activeTemplateId = state.templates[0].id;
    }
  }

  function saveStateToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(state.templates));
      localStorage.setItem(STORAGE_KEY_ACTIVE_ID, state.activeTemplateId);
      localStorage.setItem(STORAGE_KEY_THEME, state.theme);
      showAutoSaveFeedback();
    } catch (e) {
      console.error('Lỗi khi lưu dữ liệu:', e);
    }
  }

  function getActiveTemplate() {
    return state.templates.find(t => t.id === state.activeTemplateId) || state.templates[0];
  }

  function showAutoSaveFeedback() {
    elements.autoSaveIndicator.textContent = 'Đã lưu ✓';
    elements.autoSaveIndicator.style.opacity = '1';
    setTimeout(() => {
      elements.autoSaveIndicator.style.opacity = '0.6';
    }, 1200);
  }

  function showToast(msg, onUndoCallback) {
    elements.toastMessage.textContent = msg;
    if (onUndoCallback) {
      elements.btnToastUndo.classList.remove('hidden');
      elements.btnToastUndo.onclick = () => {
        onUndoCallback();
        elements.toast.classList.add('hidden');
        elements.btnToastUndo.classList.add('hidden');
      };
    } else {
      elements.btnToastUndo.classList.add('hidden');
    }

    elements.toast.classList.remove('hidden');
    clearTimeout(elements.toastTimeout);
    elements.toastTimeout = setTimeout(() => {
      elements.toast.classList.add('hidden');
      elements.btnToastUndo.classList.add('hidden');
    }, onUndoCallback ? 3500 : 2200);
  }

  // --- THEME ---
  function applyTheme(themeName) {
    state.theme = themeName;
    elements.themeBody.setAttribute('data-theme', themeName);
    localStorage.setItem(STORAGE_KEY_THEME, themeName);
  }

  function cycleTheme() {
    const currentIndex = THEMES.indexOf(state.theme);
    const nextTheme = THEMES[(currentIndex + 1) % THEMES.length];
    applyTheme(nextTheme);
    const themeNames = {
      dark: 'Tối (Sticky Dark)',
      midnight: 'Xanh Đêm (Midnight)',
      amber: 'Ấm Áp (Amber Note)',
      light: 'Sáng (Clean Light)'
    };
    showToast(`Đổi giao diện: ${themeNames[nextTheme] || nextTheme}`);
  }

  // --- RENDER MAIN VIEW ---
  function renderTemplateDropdown() {
    elements.templateSelect.innerHTML = '';
    state.templates.forEach(tpl => {
      const opt = document.createElement('option');
      opt.value = tpl.id;
      opt.textContent = tpl.name;
      if (tpl.id === state.activeTemplateId) {
        opt.selected = true;
      }
      elements.templateSelect.appendChild(opt);
    });

    const activeTpl = getActiveTemplate();
    if (activeTpl) {
      elements.activeTemplateBadge.textContent = activeTpl.name;
      elements.activeTemplateBadge.title = activeTpl.name;
    }
  }

  function renderMainNotebook() {
    const currentTpl = getActiveTemplate();
    if (!currentTpl) return;

    elements.itemsContainer.innerHTML = '';

    if (!currentTpl.items || currentTpl.items.length === 0) {
      elements.itemsContainer.innerHTML = `
        <div style="text-align:center; padding: 24px 10px; color: var(--text-muted); font-size: 13px;">
          Chưa có nhãn cố định nào.<br>
          Bấm biểu tượng ⚙️ góc phải trên để thêm nhãn mới!
        </div>
      `;
    } else {
      currentTpl.items.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'item-row';
        row.dataset.itemId = item.id;
        row.dataset.index = index;

        // 1. Fixed Label (Non-editable on main screen, safe from accidental deletion)
        const labelSpan = document.createElement('span');
        labelSpan.className = 'item-label';
        labelSpan.textContent = item.label;
        labelSpan.title = `Nhãn: ${item.label} (chỉ chỉnh sửa trong Cài đặt ⚙️)`;

        // 2. Value Input (Freely editable and deletable numbers/text)
        const valInput = document.createElement('input');
        valInput.type = 'text';
        valInput.className = 'item-value-input';
        valInput.placeholder = '0.00';
        valInput.value = item.value || '';
        valInput.dataset.itemId = item.id;
        valInput.dataset.index = index;

        // Real-time value update & persistence
        valInput.addEventListener('input', (e) => {
          item.value = e.target.value;
          saveStateToStorage();
        });

        // Smart Keyboard Navigation
        valInput.addEventListener('keydown', handleInputKeyNavigation);

        // 3. Unit indicator if defined
        let unitSpan = null;
        if (item.unit && item.unit.trim() !== '') {
          unitSpan = document.createElement('span');
          unitSpan.className = 'item-unit';
          unitSpan.textContent = item.unit;
        }

        // 4. Quick Clear Row Button
        const clearRowBtn = document.createElement('button');
        clearRowBtn.className = 'item-clear-row-btn';
        clearRowBtn.type = 'button';
        clearRowBtn.title = 'Xóa số dòng này';
        clearRowBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        `;
        clearRowBtn.addEventListener('click', () => {
          valInput.value = '';
          item.value = '';
          saveStateToStorage();
          valInput.focus();
        });

        row.appendChild(labelSpan);
        row.appendChild(valInput);
        if (unitSpan) row.appendChild(unitSpan);
        row.appendChild(clearRowBtn);

        elements.itemsContainer.appendChild(row);
      });
    }

    // Scratchpad notes
    elements.extraNotes.value = currentTpl.extraNotes || '';
  }

  // --- KEYBOARD NAVIGATION ---
  function handleInputKeyNavigation(e) {
    const currentIndex = parseInt(e.target.dataset.index, 10);
    const allInputs = elements.itemsContainer.querySelectorAll('.item-value-input');

    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        // Move backward
        if (currentIndex > 0) {
          allInputs[currentIndex - 1].focus();
          allInputs[currentIndex - 1].select();
        }
      } else {
        // Move forward
        if (currentIndex < allInputs.length - 1) {
          allInputs[currentIndex + 1].focus();
          allInputs[currentIndex + 1].select();
        } else {
          elements.extraNotes.focus();
        }
      }
    } else if (e.key === 'ArrowDown') {
      if (currentIndex < allInputs.length - 1) {
        e.preventDefault();
        allInputs[currentIndex + 1].focus();
      }
    } else if (e.key === 'ArrowUp') {
      if (currentIndex > 0) {
        e.preventDefault();
        allInputs[currentIndex - 1].focus();
      }
    }
  }

  // --- ACTIONS (Non-blocking, Instant & Safe) ---
  function clearAllValues() {
    const currentTpl = getActiveTemplate();
    if (!currentTpl) return;

    // Save snapshot for Undo
    undoSnapshot = {
      templateId: currentTpl.id,
      items: currentTpl.items.map(i => ({ id: i.id, value: i.value })),
      extraNotes: currentTpl.extraNotes || ''
    };

    // Clear values
    currentTpl.items.forEach(item => {
      item.value = '';
    });
    currentTpl.extraNotes = '';

    renderMainNotebook();
    saveStateToStorage();

    // Show Toast with Undo button
    showToast('✓ Đã xóa toàn bộ số', () => {
      if (undoSnapshot && undoSnapshot.templateId === currentTpl.id) {
        currentTpl.items.forEach(item => {
          const prev = undoSnapshot.items.find(p => p.id === item.id);
          if (prev) item.value = prev.value;
        });
        currentTpl.extraNotes = undoSnapshot.extraNotes;
        renderMainNotebook();
        saveStateToStorage();
        showToast('✓ Đã hoàn tác số liệu');
      }
    });

    // Focus first input for typing immediately
    const firstInput = elements.itemsContainer.querySelector('.item-value-input');
    if (firstInput) firstInput.focus();
  }

  function resetNewNote() {
    clearAllValues();
  }

  function copyFormattedData() {
    const currentTpl = getActiveTemplate();
    if (!currentTpl) return;

    const lines = [];
    lines.push(`📋 [${currentTpl.name}]`);
    lines.push('---------------------------');

    currentTpl.items.forEach(item => {
      const valStr = item.value ? item.value : '(trống)';
      const unitStr = item.unit ? ` ${item.unit}` : '';
      lines.push(`${item.label}: ${valStr}${unitStr}`);
    });

    if (currentTpl.extraNotes && currentTpl.extraNotes.trim() !== '') {
      lines.push('---------------------------');
      lines.push(`Ghi chú: ${currentTpl.extraNotes.trim()}`);
    }

    const fullText = lines.join('\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(fullText).then(() => {
        showToast('✓ Đã sao chép vào bộ nhớ tạm!');
      }).catch(() => {
        fallbackCopyText(fullText);
      });
    } else {
      fallbackCopyText(fullText);
    }
  }

  function fallbackCopyText(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showToast('✓ Đã sao chép thành công!');
    } catch (err) {
      alert('Vui lòng copy thủ công:\n\n' + text);
    }
    document.body.removeChild(textarea);
  }

  // --- SETTINGS MODAL LOGIC ---
  function openSettings(targetTemplateId) {
    resetDeleteButton();
    const tplToEdit = targetTemplateId 
      ? state.templates.find(t => t.id === targetTemplateId) || getActiveTemplate()
      : getActiveTemplate();

    // Deep clone template to edit
    modalTempTemplate = JSON.parse(JSON.stringify(tplToEdit));

    renderModalTemplateSelector();
    elements.currentTemplateNameInput.value = modalTempTemplate.name;
    renderSettingsLabels();
    elements.settingsModal.classList.remove('hidden');
  }

  function renderModalTemplateSelector() {
    elements.modalTemplateSelector.innerHTML = '';
    state.templates.forEach(tpl => {
      const opt = document.createElement('option');
      opt.value = tpl.id;
      opt.textContent = tpl.name;
      if (modalTempTemplate && tpl.id === modalTempTemplate.id) {
        opt.selected = true;
      }
      elements.modalTemplateSelector.appendChild(opt);
    });
  }

  function closeSettings() {
    resetDeleteButton();
    elements.settingsModal.classList.add('hidden');
    modalTempTemplate = null;
  }

  function renderSettingsLabels() {
    elements.settingsLabelsList.innerHTML = '';

    if (!modalTempTemplate || !modalTempTemplate.items || modalTempTemplate.items.length === 0) {
      elements.settingsLabelsList.innerHTML = `
        <div style="text-align:center; padding: 15px; color: var(--text-muted); font-size: 13px;">
          Chưa có nhãn nào. Bấm nút bên dưới để thêm nhãn cố định!
        </div>
      `;
      return;
    }

    modalTempTemplate.items.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'settings-label-row';

      // Label Text Input
      const labelInput = document.createElement('input');
      labelInput.type = 'text';
      labelInput.className = 'setting-label-input';
      labelInput.value = item.label;
      labelInput.placeholder = 'Tên nhãn (VD: Beam, Rafter...)';
      labelInput.addEventListener('input', (e) => {
        item.label = e.target.value;
      });

      // Unit Input
      const unitInput = document.createElement('input');
      unitInput.type = 'text';
      unitInput.className = 'setting-unit-input';
      unitInput.value = item.unit || '';
      unitInput.placeholder = 'Đơn vị';
      unitInput.title = 'Đơn vị đo (mm, m, cái, đ...)';
      unitInput.addEventListener('input', (e) => {
        item.unit = e.target.value;
      });

      // Move Up Button
      const moveUpBtn = document.createElement('button');
      moveUpBtn.className = 'row-action-btn';
      moveUpBtn.type = 'button';
      moveUpBtn.title = 'Di chuyển lên';
      moveUpBtn.disabled = index === 0;
      moveUpBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="18 15 12 9 6 15"></polyline>
        </svg>
      `;
      moveUpBtn.addEventListener('click', () => {
        if (index > 0) {
          const temp = modalTempTemplate.items[index];
          modalTempTemplate.items[index] = modalTempTemplate.items[index - 1];
          modalTempTemplate.items[index - 1] = temp;
          renderSettingsLabels();
        }
      });

      // Move Down Button
      const moveDownBtn = document.createElement('button');
      moveDownBtn.className = 'row-action-btn';
      moveDownBtn.type = 'button';
      moveDownBtn.title = 'Di chuyển xuống';
      moveDownBtn.disabled = index === modalTempTemplate.items.length - 1;
      moveDownBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      `;
      moveDownBtn.addEventListener('click', () => {
        if (index < modalTempTemplate.items.length - 1) {
          const temp = modalTempTemplate.items[index];
          modalTempTemplate.items[index] = modalTempTemplate.items[index + 1];
          modalTempTemplate.items[index + 1] = temp;
          renderSettingsLabels();
        }
      });

      // Delete Row Button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'row-action-btn row-delete-btn';
      deleteBtn.type = 'button';
      deleteBtn.title = 'Xóa nhãn này';
      deleteBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      `;
      deleteBtn.addEventListener('click', () => {
        modalTempTemplate.items.splice(index, 1);
        renderSettingsLabels();
      });

      row.appendChild(labelInput);
      row.appendChild(unitInput);
      row.appendChild(moveUpBtn);
      row.appendChild(moveDownBtn);
      row.appendChild(deleteBtn);

      elements.settingsLabelsList.appendChild(row);
    });
  }

  function addLabelRowInSettings() {
    if (!modalTempTemplate) return;
    const newId = 'item_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    modalTempTemplate.items.push({
      id: newId,
      label: `Nhãn ${modalTempTemplate.items.length + 1}`,
      unit: '',
      value: ''
    });
    renderSettingsLabels();

    setTimeout(() => {
      const rows = elements.settingsLabelsList.querySelectorAll('.setting-label-input');
      if (rows.length > 0) {
        const lastInput = rows[rows.length - 1];
        lastInput.focus();
        lastInput.select();
      }
    }, 40);
  }

  function createNewTemplate() {
    const newCount = state.templates.length + 1;
    const newTplId = 'tpl_' + Date.now();
    const newTemplate = {
      id: newTplId,
      name: `Bộ Mẫu Mới (${newCount})`,
      items: [
        { id: 'item_' + Date.now() + '_1', label: 'Thông số 1', unit: '', value: '' },
        { id: 'item_' + Date.now() + '_2', label: 'Thông số 2', unit: '', value: '' }
      ],
      extraNotes: ''
    };

    state.templates.push(newTemplate);
    state.activeTemplateId = newTplId;
    saveStateToStorage();
    renderTemplateDropdown();

    // Switch to editing new template in modal
    modalTempTemplate = JSON.parse(JSON.stringify(newTemplate));
    renderModalTemplateSelector();
    elements.currentTemplateNameInput.value = modalTempTemplate.name;
    renderSettingsLabels();

    showToast(`Đã tạo: "${newTemplate.name}"`);

    // Focus template name for quick rename
    setTimeout(() => {
      elements.currentTemplateNameInput.focus();
      elements.currentTemplateNameInput.select();
    }, 50);
  }

  function resetDeleteButton() {
    clearTimeout(deleteConfirmTimeout);
    elements.btnDeleteTemplate.textContent = 'Xóa bộ này';
    elements.btnDeleteTemplate.classList.remove('btn-danger-solid');
    elements.btnDeleteTemplate.dataset.confirming = 'false';
  }

  function deleteCurrentTemplate() {
    if (state.templates.length <= 1) {
      showToast('⚠️ Phải giữ lại ít nhất 1 bộ danh mục!');
      return;
    }

    if (!modalTempTemplate) return;

    // Two-step inline confirmation
    if (elements.btnDeleteTemplate.dataset.confirming !== 'true') {
      elements.btnDeleteTemplate.dataset.confirming = 'true';
      elements.btnDeleteTemplate.textContent = 'Bấm lần nữa để Xóa!';
      elements.btnDeleteTemplate.classList.add('btn-danger-solid');

      deleteConfirmTimeout = setTimeout(() => {
        resetDeleteButton();
      }, 3500);
      return;
    }

    // Perform deletion
    const deletedName = modalTempTemplate.name;
    state.templates = state.templates.filter(t => t.id !== modalTempTemplate.id);
    state.activeTemplateId = state.templates[0].id;
    saveStateToStorage();
    renderTemplateDropdown();
    
    // Switch modal to remaining template
    openSettings(state.activeTemplateId);
    renderMainNotebook();
    showToast(`✓ Đã xóa bộ: "${deletedName}"`);
  }

  function saveSettingsChanges() {
    if (!modalTempTemplate) return;

    const nameInput = elements.currentTemplateNameInput.value.trim();
    if (nameInput) {
      modalTempTemplate.name = nameInput;
    }

    // Clean empty labels
    modalTempTemplate.items = modalTempTemplate.items.filter(item => item.label && item.label.trim() !== '');

    // Update template in state
    const tplIndex = state.templates.findIndex(t => t.id === modalTempTemplate.id);
    if (tplIndex !== -1) {
      const oldItems = state.templates[tplIndex].items || [];
      modalTempTemplate.items.forEach(newItem => {
        const matchingOld = oldItems.find(o => o.id === newItem.id);
        if (matchingOld && newItem.value === undefined) {
          newItem.value = matchingOld.value || '';
        }
      });
      state.templates[tplIndex] = modalTempTemplate;
    }

    saveStateToStorage();
    renderTemplateDropdown();
    renderMainNotebook();
    closeSettings();
    showToast('✓ Đã cập nhật cài đặt nhãn thành công!');
  }

  function loadSamplePreset() {
    if (!modalTempTemplate) return;
    modalTempTemplate.name = 'Mẫu Kết Cấu (Beam/Rafter/Joist)';
    modalTempTemplate.items = [
      { id: 'item_beam', label: 'Beam', unit: '', value: '125' },
      { id: 'item_rafter', label: 'Rafter', unit: '', value: '190' },
      { id: 'item_joist', label: 'Joist', unit: '', value: '150' },
      { id: 'item_column', label: 'Column', unit: '', value: '' },
      { id: 'item_purlin', label: 'Purlin', unit: '', value: '' }
    ];
    elements.currentTemplateNameInput.value = modalTempTemplate.name;
    renderSettingsLabels();
    showToast('Đã nạp mẫu kết cấu! Bấm "Lưu Thay Đổi" để áp dụng.');
  }

  // --- BACKUP & RESTORE JSON ---
  function exportData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `quick_notebook_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Đã tải xuống file sao lưu JSON!');
  }

  function importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
      try {
        const imported = JSON.parse(event.target.result);
        if (imported && Array.isArray(imported.templates)) {
          state.templates = imported.templates;
          if (imported.activeTemplateId && state.templates.some(t => t.id === imported.activeTemplateId)) {
            state.activeTemplateId = imported.activeTemplateId;
          } else {
            state.activeTemplateId = state.templates[0].id;
          }
          if (imported.theme && THEMES.includes(imported.theme)) {
            applyTheme(imported.theme);
          }
          saveStateToStorage();
          renderTemplateDropdown();
          renderMainNotebook();
          closeSettings();
          showToast('✓ Khôi phục dữ liệu thành công!');
        } else {
          showToast('⚠️ File JSON không hợp lệ!');
        }
      } catch (err) {
        showToast('⚠️ Lỗi đọc file JSON!');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // --- EVENT LISTENERS ---
  function bindEvents() {
    // Template Switcher (Main Screen)
    elements.templateSelect.addEventListener('change', (e) => {
      state.activeTemplateId = e.target.value;
      saveStateToStorage();
      renderTemplateDropdown();
      renderMainNotebook();
      showToast(`Đã chọn: ${getActiveTemplate().name}`);
    });

    // Template Switcher inside Settings Modal
    elements.modalTemplateSelector.addEventListener('change', (e) => {
      const selectedId = e.target.value;
      // Auto save or sync current changes before switching
      if (modalTempTemplate) {
        const tplIndex = state.templates.findIndex(t => t.id === modalTempTemplate.id);
        if (tplIndex !== -1) {
          modalTempTemplate.name = elements.currentTemplateNameInput.value.trim() || modalTempTemplate.name;
          state.templates[tplIndex] = modalTempTemplate;
        }
      }
      openSettings(selectedId);
    });

    // Scratchpad Auto-save
    elements.extraNotes.addEventListener('input', (e) => {
      const activeTpl = getActiveTemplate();
      if (activeTpl) {
        activeTpl.extraNotes = e.target.value;
        saveStateToStorage();
      }
    });

    // Toolbar Buttons
    elements.btnNewNote.addEventListener('click', resetNewNote);
    elements.btnClearValues.addEventListener('click', clearAllValues);
    elements.btnCopyData.addEventListener('click', copyFormattedData);
    elements.btnToggleTheme.addEventListener('click', cycleTheme);
    elements.btnOpenSettings.addEventListener('click', () => openSettings());

    // Modal Actions
    elements.btnCloseSettings.addEventListener('click', closeSettings);
    elements.btnCancelSettings.addEventListener('click', closeSettings);
    elements.btnSaveSettings.addEventListener('click', saveSettingsChanges);
    elements.btnAddLabelRow.addEventListener('click', addLabelRowInSettings);
    elements.btnCreateTemplate.addEventListener('click', createNewTemplate);
    elements.btnDeleteTemplate.addEventListener('click', deleteCurrentTemplate);
    elements.btnLoadSamplePresets.addEventListener('click', loadSamplePreset);
    elements.btnExportData.addEventListener('click', exportData);
    elements.importFileInput.addEventListener('change', importData);

    // Close modal on backdrop click
    elements.settingsModal.addEventListener('click', (e) => {
      if (e.target === elements.settingsModal) {
        closeSettings();
      }
    });

    // Global Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !elements.settingsModal.classList.contains('hidden')) {
        closeSettings();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveStateToStorage();
        showToast('✓ Đã lưu an toàn');
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        clearAllValues();
      }
    });
  }

  // Run app on DOM load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

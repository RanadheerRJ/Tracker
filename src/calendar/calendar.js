import { dowNames, isoLocal, keyFor, monthNames, refreshIcons } from '../lib/utils.js';

export function createCalendarController({ getData, save }) {
  const monthSelect = document.getElementById('monthSelect');
  const yearSelect = document.getElementById('yearSelect');
  const dowRow = document.getElementById('dowRow');
  const calGrid = document.getElementById('calGrid');
  const summaryEl = document.getElementById('summary');
  const overlay = document.getElementById('overlay');
  const modalDate = document.getElementById('modalDate');
  const optRow = document.getElementById('optRow');
  const hrsInput = document.getElementById('hrsInput');

  monthNames.forEach((month, index) => {
    const opt = document.createElement('option');
    opt.value = index;
    opt.textContent = month;
    monthSelect.appendChild(opt);
  });

  const now = new Date();
  const thisYear = now.getFullYear();
  for (let year = thisYear - 3; year <= thisYear + 3; year++) {
    const opt = document.createElement('option');
    opt.value = year;
    opt.textContent = year;
    yearSelect.appendChild(opt);
  }

  monthSelect.value = now.getMonth();
  yearSelect.value = thisYear;

  dowNames.forEach((day) => {
    const el = document.createElement('div');
    el.className = 'dow';
    el.textContent = day;
    dowRow.appendChild(el);
  });

  let activeKey = null;
  let selectMode = false;
  const selectedKeys = new Set();
  let pendingStatus = null;

  const selectModeBtn = document.getElementById('selectModeBtn');
  const bulkbar = document.getElementById('bulkbar');
  const bulkCount = document.getElementById('bulkCount');

  function data() {
    return getData();
  }

  function clearSelection() {
    selectedKeys.clear();
    bulkbar.classList.remove('show');
  }

  function updateBulkbar() {
    bulkCount.textContent = selectedKeys.size + ' selected';
    bulkbar.classList.toggle('show', selectedKeys.size > 0);
  }

  function render() {
    const y = parseInt(yearSelect.value);
    const m = parseInt(monthSelect.value);
    const ledger = data();
    calGrid.innerHTML = '';

    const firstDow = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    for (let i = 0; i < firstDow; i++) {
      const empty = document.createElement('div');
      empty.className = 'daycell empty';
      calGrid.appendChild(empty);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const key = keyFor(y, m, d);
      const dow = new Date(y, m, d).getDay();
      const cell = document.createElement('div');
      cell.className = 'daycell' + (dow === 0 || dow === 6 ? ' weekend' : '');
      cell.tabIndex = 0;

      const entry = ledger[key];
      if (entry) cell.classList.add(entry.status);
      if (selectedKeys.has(key)) cell.classList.add('selected');

      const num = document.createElement('div');
      num.className = 'daynum';
      num.textContent = d;
      cell.appendChild(num);

      if (entry) {
        const stamp = document.createElement('div');
        stamp.className = 'stamp';
        stamp.textContent = entry.status;
        cell.appendChild(stamp);

        if (entry.note) {
          const noteIcon = document.createElement('div');
          noteIcon.innerHTML =
            '<i data-lucide="file-text" style="width:10px;height:10px;color:var(--text-secondary); margin-top:2px;"></i>';
          noteIcon.style.alignSelf = 'flex-start';
          noteIcon.style.marginLeft = '4px';
          cell.appendChild(noteIcon);
        }
        if (entry.status !== 'holiday' && entry.hours != null) {
          const hrs = document.createElement('div');
          hrs.className = 'hours';
          hrs.textContent = entry.hours + 'h';
          cell.appendChild(hrs);
        }
      }

      cell.addEventListener('click', () => {
        if (selectMode) {
          if (selectedKeys.has(key)) {
            selectedKeys.delete(key);
            cell.classList.remove('selected');
          } else {
            selectedKeys.add(key);
            cell.classList.add('selected');
          }
          updateBulkbar();
        } else {
          openModal(key, y, m, d);
        }
      });
      cell.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') cell.click();
      });

      calGrid.appendChild(cell);
    }

    renderSummary(y, m);
    renderTodayBrief();
    refreshIcons();
  }

  function renderTodayBrief() {
    const current = new Date();
    const key = keyFor(current.getFullYear(), current.getMonth(), current.getDate());
    const entry = data()[key];
    const title = document.getElementById('todayTitle');
    const detail = document.getElementById('todayDetail');
    const action = document.getElementById('todayActionBtn');
    if (!entry) {
      title.textContent = 'Ready to plan your day';
      detail.textContent = 'No entry yet — log your hours in one tap.';
      action.textContent = 'Log today';
      action.hidden = false;
      return;
    }
    const label = entry.status.charAt(0).toUpperCase() + entry.status.slice(1);
    title.textContent = 'Today is marked ' + label;
    detail.textContent =
      entry.status === 'holiday'
        ? 'Enjoy the day away — your ledger is up to date.'
        : (entry.hours || 0) + ' hours logged' + (entry.note ? ' · Note saved' : '') + '.';
    action.textContent = 'Edit';
    action.hidden = false;
  }

  function openModal(key, y, m, d) {
    activeKey = key;
    modalDate.textContent = monthNames[m] + ' ' + d + ', ' + y;
    const entry = data()[key];
    document.querySelectorAll('#optRow button').forEach((button) => button.classList.remove('active'));
    if (entry) {
      const btn = optRow.querySelector('[data-status="' + entry.status + '"]');
      if (btn) btn.classList.add('active');
      hrsInput.value = entry.hours != null ? entry.hours : 8;
      document.getElementById('noteInput').value = entry.note || '';
      pendingStatus = entry.status;
    } else {
      const defaultBtn = optRow.querySelector('[data-status="present"]');
      if (defaultBtn) defaultBtn.classList.add('active');
      pendingStatus = 'present';
      hrsInput.value = 8;
      document.getElementById('noteInput').value = '';
    }
    overlay.classList.add('show');
  }

  function closeModal() {
    overlay.classList.remove('show');
    activeKey = null;
  }

  function renderSummary(y, m) {
    const prefix = y + '-' + String(m + 1).padStart(2, '0');
    let workingDays = 0;
    let totalHours = 0;
    let leaves = 0;
    let holidays = 0;
    let allTimeHours = 0;

    Object.keys(data()).forEach((key) => {
      const entry = data()[key];
      if (entry.status === 'present') allTimeHours += entry.hours || 0;
      if (!key.startsWith(prefix)) return;
      if (entry.status === 'present') {
        workingDays++;
        totalHours += entry.hours || 0;
      } else if (entry.status === 'leave') {
        leaves++;
      } else if (entry.status === 'holiday') {
        holidays++;
      }
    });

    summaryEl.innerHTML = '';
    const stats = [
      ['Total working days', workingDays, 'briefcase'],
      ['Total hours worked', totalHours, 'clock'],
      ['Leaves taken', leaves, 'coffee'],
      ['Holidays', holidays, 'sun'],
      ['All-time hours worked', allTimeHours, 'award'],
    ];
    stats.forEach(([label, value, icon]) => {
      const stat = document.createElement('div');
      stat.className = 'stat';
      stat.innerHTML =
        '<i data-lucide="' +
        icon +
        '" style="color: var(--accent-green); margin-bottom: 8px;"></i><div class="label">' +
        label +
        '</div><div class="value">' +
        value +
        '</div>';
      summaryEl.appendChild(stat);
    });
    refreshIcons();
  }

  function bind() {
    selectModeBtn.addEventListener('click', () => {
      selectMode = !selectMode;
      selectModeBtn.classList.toggle('active', selectMode);
      if (!selectMode) clearSelection();
      render();
    });

    document.getElementById('bulkCancelBtn').addEventListener('click', () => {
      clearSelection();
      render();
    });

    document.querySelectorAll('.bulkbar [data-bulk]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const status = btn.dataset.bulk;
        selectedKeys.forEach((selectedKey) => {
          if (status === 'clear') {
            delete data()[selectedKey];
          } else {
            data()[selectedKey] = { status, hours: status === 'holiday' ? 0 : 8 };
          }
        });
        save();
        clearSelection();
        selectMode = false;
        selectModeBtn.classList.remove('active');
        render();
      });
    });

    optRow.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        optRow.querySelectorAll('button').forEach((button) => button.classList.remove('active'));
        pendingStatus = btn.dataset.status;
        if (pendingStatus !== 'clear') btn.classList.add('active');
      });
    });

    document.getElementById('saveBtn').addEventListener('click', () => {
      if (!activeKey) return closeModal();

      const noteVal = document.getElementById('noteInput').value.trim();

      if (pendingStatus === 'clear') {
        delete data()[activeKey];
      } else if (pendingStatus) {
        data()[activeKey] = {
          status: pendingStatus,
          hours: pendingStatus === 'holiday' ? 0 : parseFloat(hrsInput.value || 0),
        };
        if (noteVal) data()[activeKey].note = noteVal;
      } else if (data()[activeKey]) {
        data()[activeKey].hours = parseFloat(hrsInput.value || 0);
        if (noteVal) data()[activeKey].note = noteVal;
        else delete data()[activeKey].note;
      }
      pendingStatus = null;
      save();
      closeModal();
      render();
    });

    document.getElementById('cancelBtn').addEventListener('click', () => {
      pendingStatus = null;
      closeModal();
    });
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        pendingStatus = null;
        closeModal();
      }
    });

    monthSelect.addEventListener('change', () => {
      clearSelection();
      render();
    });
    yearSelect.addEventListener('change', () => {
      clearSelection();
      render();
    });

    document.getElementById('todayActionBtn').addEventListener('click', () => {
      const today = new Date();
      const key = isoLocal(today);
      if (data()[key]) openModal(key, today.getFullYear(), today.getMonth(), today.getDate());
      else document.getElementById('markTodayBtn').click();
    });
    document.getElementById('markTodayBtn').addEventListener('click', () => {
      const today = new Date();
      const key = isoLocal(today);
      data()[key] = { status: 'present', hours: 8 };
      monthSelect.value = today.getMonth();
      yearSelect.value = today.getFullYear();
      save();
      render();
    });
    document.getElementById('copyPreviousBtn').addEventListener('click', () => {
      const today = new Date();
      const cursor = new Date(today);
      cursor.setDate(cursor.getDate() - 1);
      while (cursor.getDay() === 0 || cursor.getDay() === 6) cursor.setDate(cursor.getDate() - 1);
      const source = data()[isoLocal(cursor)];
      if (!source) {
        alert('There is no entry for the previous workday to copy.');
        return;
      }
      const key = isoLocal(today);
      data()[key] = { ...source };
      monthSelect.value = today.getMonth();
      yearSelect.value = today.getFullYear();
      save();
      render();
    });

    const fillOverlay = document.getElementById('fillOverlay');
    document.getElementById('fillWeekdaysBtn').addEventListener('click', () => {
      const today = isoLocal(new Date());
      document.getElementById('fillFromDate').value = today;
      document.getElementById('fillToDate').value = today;
      document.getElementById('fillHours').value = 8;
      fillOverlay.classList.add('show');
    });
    document.getElementById('fillCancelBtn').addEventListener('click', () => fillOverlay.classList.remove('show'));
    document.getElementById('fillSaveBtn').addEventListener('click', () => {
      const from = document.getElementById('fillFromDate').value;
      const to = document.getElementById('fillToDate').value;
      const hours = Number(document.getElementById('fillHours').value);
      if (!from || !to || from > to || !Number.isFinite(hours) || hours < 0 || hours > 24) {
        alert('Enter a valid date range and hours from 0 to 24.');
        return;
      }
      const cursor = new Date(from + 'T00:00:00');
      const end = new Date(to + 'T00:00:00');
      while (cursor <= end) {
        if (cursor.getDay() !== 0 && cursor.getDay() !== 6) data()[isoLocal(cursor)] = { status: 'present', hours };
        cursor.setDate(cursor.getDate() + 1);
      }
      monthSelect.value = new Date(from + 'T00:00:00').getMonth();
      yearSelect.value = new Date(from + 'T00:00:00').getFullYear();
      fillOverlay.classList.remove('show');
      save();
      render();
    });
    fillOverlay.addEventListener('click', (event) => {
      if (event.target === fillOverlay) fillOverlay.classList.remove('show');
    });
  }

  return { bind, clearSelection, openModal, render };
}

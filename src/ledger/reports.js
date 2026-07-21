import { escapeHtml, monthNames, refreshIcons, toISO } from '../lib/utils.js';

const REPORT_LOGO_SRC = './logo.png';
const EXPECTED_HOURS_PER_WORKDAY = 8;

function employeeIdRole(profile) {
  const employeeId = profile?.employeeId || profile?.employeeID || profile?.employeeNumber || '';
  const role = profile?.role || profile?.title || '';
  if (employeeId && role) return employeeId + ' / ' + role;
  return employeeId || role || '—';
}

function formatGeneratedAt(date = new Date()) {
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function countWeekdaysInRange(from, to) {
  if (!from || !to || from > to) return 0;
  const cursor = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  let days = 0;
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) days++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function reportStatusClass(status) {
  return ['present', 'leave', 'holiday'].includes(status) ? status : 'other';
}

export function bucketKey(dateStr, groupBy) {
  if (groupBy === 'month') return dateStr.slice(0, 7);
  if (groupBy === 'week') {
    const date = new Date(dateStr + 'T00:00:00');
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(date);
    monday.setDate(date.getDate() + diff);
    return toISO(monday);
  }
  return dateStr;
}

export function bucketLabel(key, groupBy) {
  if (groupBy === 'month') {
    const [year, month] = key.split('-');
    return monthNames[parseInt(month) - 1].slice(0, 3) + ' ' + year;
  }
  const date = new Date(key + 'T00:00:00');
  if (groupBy === 'week') return 'Wk of ' + monthNames[date.getMonth()].slice(0, 3) + ' ' + date.getDate();
  return monthNames[date.getMonth()].slice(0, 3) + ' ' + date.getDate();
}

export function createReportsController({ getData, getProfile }) {
  const fromDateInput = document.getElementById('fromDate');
  const toDateInput = document.getElementById('toDate');
  const groupBySelect = document.getElementById('groupBySelect');
  const minHoursInput = document.getElementById('minHoursInput');
  const rangeLabel = document.getElementById('rangeLabel');
  const dashSummary = document.getElementById('dashSummary');
  const dashChart = document.getElementById('dashChart');

  const now = new Date();
  const thisYear = now.getFullYear();

  function setDefaultRange() {
    const first = new Date(thisYear, now.getMonth(), 1);
    const last = new Date(thisYear, now.getMonth() + 1, 0);
    fromDateInput.value = toISO(first);
    toDateInput.value = toISO(last);
  }

  function generateReport() {
    const from = fromDateInput.value;
    const to = toDateInput.value;
    const groupBy = groupBySelect.value;
    const minHours = parseFloat(minHoursInput.value || 0);

    if (!from || !to) return;
    rangeLabel.textContent = 'Report range: ' + from + ' to ' + to;

    let workingDays = 0;
    let totalHours = 0;
    let leaves = 0;
    let holidays = 0;
    const buckets = {};

    Object.keys(getData())
      .sort()
      .forEach((key) => {
        if (key < from || key > to) return;
        const entry = getData()[key];
        if (entry.status === 'present') {
          if ((entry.hours || 0) < minHours) return;
          workingDays++;
          totalHours += entry.hours || 0;
          const entryBucketKey = bucketKey(key, groupBy);
          buckets[entryBucketKey] = (buckets[entryBucketKey] || 0) + (entry.hours || 0);
        } else if (entry.status === 'leave') {
          leaves++;
        } else if (entry.status === 'holiday') {
          holidays++;
        }
      });

    const avg = workingDays > 0 ? (totalHours / workingDays).toFixed(1) : 0;

    dashSummary.innerHTML = '';
    const stats = [
      ['Working days', workingDays, 'briefcase'],
      ['Total hours worked', totalHours, 'clock'],
      ['Avg hours / day', avg, 'activity'],
      ['Leaves taken', leaves, 'coffee'],
      ['Holidays', holidays, 'sun'],
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
      dashSummary.appendChild(stat);
    });

    dashChart.innerHTML = '';
    const bucketKeys = Object.keys(buckets).sort();
    if (bucketKeys.length === 0) {
      dashChart.innerHTML = '<h3>Hours breakdown</h3><div class="chart-empty">No hours logged in this range yet.</div>';
    } else {
      const maxVal = Math.max(...bucketKeys.map((key) => buckets[key]));
      const heading = document.createElement('h3');
      heading.textContent = 'Hours breakdown by ' + groupBy;
      dashChart.appendChild(heading);
      bucketKeys.forEach((key) => {
        const row = document.createElement('div');
        row.className = 'chart-row';
        const pct = maxVal > 0 ? (buckets[key] / maxVal) * 100 : 0;
        row.innerHTML =
          '<div class="chart-label">' +
          bucketLabel(key, groupBy) +
          '</div>' +
          '<div class="chart-bar-track"><div class="chart-bar-fill" style="width:' +
          pct +
          '%"></div></div>' +
          '<div class="chart-value">' +
          buckets[key] +
          'h</div>';
        dashChart.appendChild(row);
      });
      refreshIcons();
    }
  }

  function bind() {
    setDefaultRange();
    document.querySelectorAll('.quick-range button').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.quick-range button').forEach((button) => button.classList.remove('active'));
        btn.classList.add('active');
        const today = new Date();
        let from;
        let to;
        if (btn.dataset.range === 'thisMonth') {
          from = new Date(today.getFullYear(), today.getMonth(), 1);
          to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        } else if (btn.dataset.range === 'lastMonth') {
          from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          to = new Date(today.getFullYear(), today.getMonth(), 0);
        } else if (btn.dataset.range === 'thisYear') {
          from = new Date(today.getFullYear(), 0, 1);
          to = new Date(today.getFullYear(), 11, 31);
        } else if (btn.dataset.range === 'allTime') {
          const keys = Object.keys(getData()).sort();
          from = keys.length ? new Date(keys[0] + 'T00:00:00') : today;
          to = keys.length ? new Date(keys[keys.length - 1] + 'T00:00:00') : today;
        }
        fromDateInput.value = toISO(from);
        toDateInput.value = toISO(to);
        generateReport();
      });
    });

    [fromDateInput, toDateInput, groupBySelect, minHoursInput].forEach((el) => {
      el.addEventListener('change', () => {
        document.querySelectorAll('.quick-range button').forEach((button) => button.classList.remove('active'));
        generateReport();
      });
    });
    document.getElementById('generateReportBtn').addEventListener('click', generateReport);

    document.getElementById('exportCsvBtn').addEventListener('click', async () => {
      const from = fromDateInput.value;
      const to = toDateInput.value;
      const minHours = parseFloat(minHoursInput.value || 0);
      const rows = [['Date', 'Status', 'Hours', 'Note']];
      Object.keys(getData())
        .sort()
        .forEach((key) => {
          if (key < from || key > to) return;
          const entry = getData()[key];
          if (entry.status === 'present' && (entry.hours || 0) < minHours) return;
          rows.push([key, entry.status, entry.hours != null ? entry.hours : '', entry.note || '']);
        });
      const csvEscape = (value) => '"' + String(value).replace(/"/g, '""') + '"';
      const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
      const filename = 'timesheet-report_' + from + '_to_' + to + '.csv';
      const blob = new Blob([csv], { type: 'text/csv' });

      try {
        if (navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: 'text/csv' })] })) {
          await navigator.share({
            files: [new File([blob], filename, { type: 'text/csv' })],
            title: 'Chrona CSV Report',
            text: 'Here is your timesheet CSV report.',
          });
          return;
        }
      } catch (err) {
        console.log('Share canceled or failed', err);
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    });

    document.getElementById('printPdfBtn').addEventListener('click', () => {
      const from = fromDateInput.value;
      const to = toDateInput.value;
      const profile = getProfile() || {};
      const entries = Object.keys(getData())
        .sort()
        .filter((key) => key >= from && key <= to)
        .map((key) => [key, getData()[key]]);
      const totalHours = entries.reduce(
        (sum, [, entry]) => sum + (entry.status === 'present' ? Number(entry.hours || 0) : 0),
        0,
      );
      const leaveEntries = entries.filter(([, entry]) => entry.status === 'leave');
      const leaveDays = leaveEntries.length;
      const leaveHours = leaveEntries.reduce((sum, [, entry]) => sum + Number(entry.hours || 0), 0);
      const workingDaysInPeriod = countWeekdaysInRange(from, to);
      const expectedHours = workingDaysInPeriod * EXPECTED_HOURS_PER_WORKDAY;
      const attendancePercentage = expectedHours > 0 ? ((totalHours / expectedHours) * 100).toFixed(1) + '%' : '—';
      document.getElementById('printSheet').innerHTML =
        '<header class="report-header"><div class="report-logo-slot"><img src="' +
        escapeHtml(REPORT_LOGO_SRC) +
        '" alt="Chrona logo" class="report-logo"></div><div><h1>Chrona Timesheet</h1><p class="report-period">Period: ' +
        escapeHtml(from) +
        ' to ' +
        escapeHtml(to) +
        '</p></div></header><section class="report-employee"><p class="report-employee-name"><strong>' +
        escapeHtml(profile.name) +
        '</strong></p><div class="report-info-grid"><div><span>Employee ID / role</span><strong>' +
        escapeHtml(employeeIdRole(profile)) +
        '</strong></div><div><span>Department</span><strong>' +
        escapeHtml(profile.department || '—') +
        '</strong></div><div><span>Manager name</span><strong>' +
        escapeHtml(profile.managerName || profile.manager || '—') +
        '</strong></div><div><span>Report generated</span><strong>' +
        escapeHtml(formatGeneratedAt()) +
        '</strong></div></div></section><section class="report-summary-grid"><div><span>Total present hours</span><strong>' +
        totalHours +
        '</strong></div><div><span>Total leave days / hours</span><strong>' +
        leaveDays +
        ' days / ' +
        leaveHours +
        'h</strong></div><div><span>Total working days in period</span><strong>' +
        workingDaysInPeriod +
        ' days</strong></div><div><span>Attendance percentage</span><strong>' +
        attendancePercentage +
        '</strong></div></section><table><thead><tr><th>Date</th><th>Status</th><th>Hours</th><th>Note</th></tr></thead><tbody>' +
        entries
          .map(
            ([key, entry]) =>
              '<tr><td>' +
              escapeHtml(key) +
              '</td><td><span class="report-status report-status-' +
              reportStatusClass(entry.status) +
              '">' +
              escapeHtml(entry.status) +
              '</span></td><td>' +
              escapeHtml(entry.hours) +
              '</td><td class="report-note">' +
              escapeHtml(entry.note) +
              '</td></tr>',
          )
          .join('') +
        '</tbody></table><p style="margin-top:40px">Signature: ______________________________</p>';
      window.print();
    });
  }

  return { bind, generateReport, setDefaultRange };
}

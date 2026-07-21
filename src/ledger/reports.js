import { escapeHtml, monthNames, refreshIcons, toISO } from '../lib/utils.js';

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
      const entries = Object.keys(getData())
        .sort()
        .filter((key) => key >= from && key <= to)
        .map((key) => [key, getData()[key]]);
      const totalHours = entries.reduce(
        (sum, [, entry]) => sum + (entry.status === 'present' ? Number(entry.hours || 0) : 0),
        0,
      );
      document.getElementById('printSheet').innerHTML =
        '<h1>Chrona Timesheet</h1><p><strong>' +
        escapeHtml(getProfile()?.name) +
        '</strong><br>Period: ' +
        escapeHtml(from) +
        ' to ' +
        escapeHtml(to) +
        '<br>Total present hours: <strong>' +
        totalHours +
        '</strong></p><table><thead><tr><th>Date</th><th>Status</th><th>Hours</th><th>Note</th></tr></thead><tbody>' +
        entries
          .map(
            ([key, entry]) =>
              '<tr><td>' +
              escapeHtml(key) +
              '</td><td>' +
              escapeHtml(entry.status) +
              '</td><td>' +
              escapeHtml(entry.hours) +
              '</td><td>' +
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

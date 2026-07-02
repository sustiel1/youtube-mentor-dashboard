/**
 * CSV export for selected universal tab items.
 * No external dependency — uses plain string serialization.
 * Note: True XLSX requires adding the 'xlsx' or 'exceljs' package (not currently in project).
 */

function escapeCsvCell(value) {
  const str = String(value ?? '').replace(/"/g, '""');
  return /[",\n\r]/.test(str) ? `"${str}"` : str;
}

function rowToCsv(cols) {
  return cols.map(escapeCsvCell).join(',');
}

const HEADERS = [
  'מקור (Source)',
  'טאב (Tab)',
  'סעיף (Section)',
  'טקסט (Text)',
  'Ticker',
  'Timestamp',
];

/**
 * Convert selected items to CSV string.
 * @param {Array<{text, sectionLabel, type, tabScope, timestamp?}>} items
 * @param {string} [videoTitle]
 */
export function buildSelectedItemsCsv(items, videoTitle = '') {
  const lines = [rowToCsv(HEADERS)];
  items.forEach((item) => {
    const ticker = extractTickerFromText(item.text);
    lines.push(rowToCsv([
      videoTitle,
      item.tabScope || item.type || '',
      item.sectionLabel || '',
      item.text || '',
      ticker,
      item.timestamp || '',
    ]));
  });
  return lines.join('\r\n');
}

function extractTickerFromText(text) {
  if (!text) return '';
  const m = String(text).match(/^([A-Z]{1,6})\s*[·\-–]/);
  return m ? m[1] : '';
}

/**
 * Trigger a browser download of the CSV.
 * @param {string} csvContent
 * @param {string} [filename]
 */
export function downloadCsv(csvContent, filename = 'selected-items.csv') {
  const bom = '﻿';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

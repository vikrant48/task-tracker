// Quote a CSV cell and neutralise spreadsheet formulas (=, +, -, @, tab, CR) to block CSV injection
export function csvCell(value: string): string {
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return `"${safe.replace(/"/g, '""')}"`;
}

export function buildCsv(header: string[], rows: string[][]): string {
    return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function downloadCsv(filename: string, content: string) {
    downloadFile(filename, content, 'text/csv;charset=utf-8;');
}

// Save text as a file via a temporary link
export function downloadFile(filename: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

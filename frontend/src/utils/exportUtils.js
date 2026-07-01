import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const exportToExcel = (data, headers, filename) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

export const exportToPDF = (data, headers, title, filename) => {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  doc.setFontSize(16);
  doc.text(title, 14, 15);

  autoTable(doc, {
    head: [headers],
    body: data.map(row => Object.values(row)),
    startY: 25,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [41, 128, 185] },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 20 },
      2: { cellWidth: 25 },
    }
  });

  doc.save(`${filename}.pdf`);
};
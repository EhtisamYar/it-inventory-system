import React, { useState } from 'react';
import { FaFileExcel, FaFilePdf, FaDownload } from 'react-icons/fa';

const ExportDropdown = ({ onExportExcel, onExportPDF }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleDropdown = () => setIsOpen(!isOpen);

  const handleExport = (type) => {
    setIsOpen(false);
    if (type === 'excel') {
      onExportExcel();
    } else if (type === 'pdf') {
      onExportPDF();
    }
  };

  return (
    <div className="export-dropdown">
      <button className="btn-secondary" onClick={toggleDropdown}>
        <FaDownload /> Export
      </button>
      {isOpen && (
        <div className="export-dropdown-menu">
          <button onClick={() => handleExport('excel')}>
            <FaFileExcel /> Excel
          </button>
          <button onClick={() => handleExport('pdf')}>
            <FaFilePdf /> PDF
          </button>
        </div>
      )}
    </div>
  );
};

export default ExportDropdown;
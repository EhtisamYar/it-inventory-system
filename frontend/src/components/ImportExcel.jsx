import React, { useState } from 'react';
import axios from 'axios';
import { FaFileExcel, FaUpload, FaTimes } from 'react-icons/fa';

const API_URL = 'http://localhost:5000';

const ImportExcel = ({ categoryId, categories = [], onClose, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(categoryId || '');

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      const ext = selected.name.split('.').pop().toLowerCase();
      if (ext !== 'xlsx' && ext !== 'xls') {
        setMessage({ type: 'error', text: 'Please select an Excel file (.xlsx or .xls)' });
        setFile(null);
        return;
      }
      setFile(selected);
      setMessage(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedCategory) {
      setMessage({ type: 'error', text: 'Please select a category' });
      return;
    }
    if (!file) {
      setMessage({ type: 'error', text: 'Please select a file first' });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    setMessage(null);

    try {
      const response = await axios.post(`${API_URL}/api/inventory/import/${selectedCategory}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessage({
        type: 'success',
        text: `✅ Import complete: ${response.data.inserted} items inserted, ${response.data.skipped} skipped.`
      });
      if (onSuccess) onSuccess();
      setTimeout(() => onClose(), 3000);
    } catch (error) {
      console.error('Import error:', error);
      const errMsg = error.response?.data?.error || 'Failed to import file. Please check the file format.';
      setMessage({ type: 'error', text: errMsg });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-medium" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2><FaFileExcel /> Import Excel</h2>
          <button className="close-btn" onClick={onClose}><FaTimes /></button>
        </div>
        <div className="modal-body">
          <p style={{ marginBottom: '15px', color: '#555' }}>
            Upload an Excel file (.xlsx or .xls) to add items to a category.
          </p>

          {/* Category dropdown (if not provided) */}
          {!categoryId && categories.length > 0 && (
            <div className="form-group">
              <label>Target Category *</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
              >
                <option value="">-- Select Category --</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Select Excel File</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="file-input"
            />
            {file && (
              <p style={{ fontSize: '0.9rem', color: '#2e7d32', marginTop: '5px' }}>
                ✅ {file.name} ({(file.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>
          {message && (
            <div style={{
              padding: '10px',
              borderRadius: '4px',
              marginTop: '10px',
              background: message.type === 'success' ? '#e8f5e9' : '#ffebee',
              color: message.type === 'success' ? '#2e7d32' : '#c62828'
            }}>
              {message.text}
            </div>
          )}
        </div>
        <div className="form-actions">
          <button className="btn-cancel" onClick={onClose} disabled={uploading}>Cancel</button>
          <button className="btn-submit" onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? 'Uploading...' : <><FaUpload /> Import</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportExcel;
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaUndo, FaSearch, FaFileExcel, FaFilePdf } from 'react-icons/fa';
import ExportDropdown from './ExportDropdown';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';

const API_URL = 'http://localhost:5000';

const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-GB');
};

const ReturnsList = () => {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchReturns();
  }, []);

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/returns`);
      setReturns(response.data);
    } catch (error) {
      console.error('Error fetching returns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => setSearchTerm(e.target.value);

  const filteredReturns = returns.filter(r =>
    r.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.returned_by && r.returned_by.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (r.email && r.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (r.serial_number && r.serial_number.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Export functions (Excel/PDF)
  const getExportData = () => {
    const headers = ['#', 'Item', 'Serial No', 'Asset', 'Category', 'Returned By', 'Email', 'Backup Done', 'Remarks', 'Returned Date'];
    const data = filteredReturns.map((r, idx) => ({
      '#': idx + 1,
      'Item': r.item_name,
      'Serial No': r.serial_number || '-',
      'Asset': r.asset || '-',
      'Category': r.category_name || '-',
      'Returned By': r.returned_by || '-',
      'Email': r.email || '-',
      'Backup Done': r.backup_done ? 'Yes' : 'No',
      'Remarks': r.remarks || '-',
      'Returned Date': formatDate(r.returned_date),
    }));
    return { headers, data };
  };

  const handleExportExcel = () => {
    const { headers, data } = getExportData();
    exportToExcel(data, headers, 'Item_Returns');
  };

  const handleExportPDF = () => {
    const { headers, data } = getExportData();
    exportToPDF(data, headers, 'Item Returns Report', 'Item_Returns');
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading returns...</p>
      </div>
    );
  }

  return (
    <div className="inventory-list">
      <div className="list-header">
        <h2><FaUndo /> Item Returns</h2>
        <div className="actions">
          <div className="search-box">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search by item, returned by, email, serial..."
              value={searchTerm}
              onChange={handleSearch}
            />
          </div>
          <ExportDropdown
            onExportExcel={handleExportExcel}
            onExportPDF={handleExportPDF}
          />
        </div>
      </div>

      <div className="items-table">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th>Serial No</th>
              <th>Asset</th>
              <th>Category</th>
              <th>Returned By</th>
              <th>Email</th>
              <th>Backup Done</th>
              <th>Remarks</th>
              <th>Returned Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredReturns.length === 0 ? (
              <tr>
                <td colSpan="10" className="empty-state">
                  <div className="empty-icon">📭</div>
                  <h3>No Returns Found</h3>
                  <p>Items returned from inventory will appear here.</p>
                </td>
              </tr>
            ) : (
              filteredReturns.map((r, idx) => (
                <tr key={r.id}>
                  <td>{idx + 1}</td>
                  <td><strong>{r.item_name}</strong></td>
                  <td>{r.serial_number || '-'}</td>
                  <td>{r.asset || '-'}</td>
                  <td>{r.category_name || '-'}</td>
                  <td>{r.returned_by || '-'}</td>
                  <td>{r.email || '-'}</td>
                  <td>{r.backup_done ? '✅ Yes' : '❌ No'}</td>
                  <td>{r.remarks || '-'}</td>
                  <td>{formatDate(r.returned_date)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReturnsList;
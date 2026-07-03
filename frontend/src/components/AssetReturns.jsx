import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaSearch, FaUndo, FaPrint } from 'react-icons/fa';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExportDropdown from './ExportDropdown';

const API_URL = 'http://localhost:5000';

const AssetReturns = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnItem, setReturnItem] = useState(null);
  const [returnData, setReturnData] = useState({
    email: '',
    backup_done: false,
    remarks: '',
    mobile_number: '',
    received_by: '',
    returned_by: '',        // renamed from issued_by
    department: '',
    employee_id: '',
    return_date: '',        // renamed from date_of_issuance
    station: '',
    designation: ''
  });

  useEffect(() => {
    fetchAssignedItems();
  }, []);

  const fetchAssignedItems = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/inventory/items`);
      const assigned = response.data.filter(item => item.assigned_to && item.assigned_to.trim() !== '');
      setItems(assigned);
    } catch (error) {
      console.error('Error fetching assigned items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => setSearchTerm(e.target.value);

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.brand && item.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.model && item.model.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.assigned_to && item.assigned_to.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const openReturnModal = (item) => {
    const today = new Date().toISOString().split('T')[0];
    setReturnItem(item);
    setReturnData({
      email: item.email || '',
      backup_done: false,
      remarks: '',
      mobile_number: '',
      received_by: '',
      returned_by: item.assigned_to || '',  // Pre-fill with the current holder
      department: item.department || '',
      employee_id: item.employee_id || '',
      return_date: today,                   // default to today
      station: item.station || '',
      designation: item.designation || ''
    });
    setShowReturnModal(true);
  };

  const handleReturnChange = (e) => {
    const { name, value, type, checked } = e.target;
    setReturnData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const submitReturn = async () => {
    if (!returnItem) return;
    try {
      await axios.post(`${API_URL}/api/inventory/return`, {
        item_id: returnItem.id,
        email: returnData.email,
        backup_done: returnData.backup_done,
        remarks: returnData.remarks,
        mobile_number: returnData.mobile_number,
        returned_by: returnData.returned_by,   // the person returning
        return_date: returnData.return_date     // the return date
      });
      alert('✅ Item returned successfully!');
      setShowReturnModal(false);
      fetchAssignedItems();
    } catch (error) {
      console.error('Error returning item:', error);
      alert('❌ Failed to return item');
    }
  };

  const handlePrint = () => {
    const content = document.getElementById('return-voucher');
    if (!content) return;
    const win = window.open('', '_blank');
    win.document.write('<html><head><title>Return Voucher</title>');
    win.document.write('<style>body { font-family: Arial; padding: 20px; } table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #333; padding: 8px; text-align: left; } .header { text-align: center; margin-bottom: 20px; } .details { margin-bottom: 20px; } .detail-row { display: flex; justify-content: space-between; }</style>');
    win.document.write('</head><body>');
    win.document.write(content.innerHTML);
    win.document.write('</body></html>');
    win.document.close();
    win.print();
  };

  // Export functions
  const getExportData = () => {
    const headers = ['#', 'Name', 'Brand', 'Model', 'S/N', 'Assigned To', 'Designation', 'Department', 'Location', 'Email'];
    const data = filteredItems.map((item, idx) => ({
      '#': idx + 1,
      'Name': item.name,
      'Brand': item.brand || '',
      'Model': item.model || '',
      'S/N': item.serial_number || '',
      'Assigned To': item.assigned_to || '',
      'Designation': item.designation || '',
      'Department': item.department || '',
      'Location': item.location || '',
      'Email': item.email || ''
    }));
    return { headers, data };
  };

  const handleExportExcel = () => {
    const { headers, data } = getExportData();
    const ws = XLSX.utils.json_to_sheet(data, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Assigned Assets');
    XLSX.writeFile(wb, 'Assigned_Assets.xlsx');
  };

  const handleExportPDF = () => {
    const { headers, data } = getExportData();
    const doc = new jsPDF('landscape', 'mm', 'a4');
    doc.setFont('helvetica');
    doc.setFontSize(16);
    doc.text('Assigned Assets', 14, 15);
    autoTable(doc, {
      head: [headers],
      body: data.map(row => Object.values(row)),
      startY: 25,
      styles: { fontSize: 8, font: 'helvetica' },
      headStyles: { fillColor: [41, 128, 185], font: 'helvetica' },
      margin: { left: 10, right: 10 },
    });
    doc.save('Assigned_Assets.pdf');
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div><p>Loading assigned assets...</p></div>;
  }

  return (
    <div className="inventory-list">
      <div className="list-header">
        <h2><FaUndo /> Asset Returns</h2>
        <div className="actions">
          <div className="search-box">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search assigned assets..."
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
              <th>Name</th>
              <th>Brand</th>
              <th>Model</th>
              <th>S/N</th>
              <th>Assigned To</th>
              <th>Designation</th>
              <th>Department</th>
              <th>Location</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr><td colSpan="10" className="empty-state">No assigned assets found.</td></tr>
            ) : (
              filteredItems.map((item, idx) => (
                <tr key={item.id}>
                  <td>{idx + 1}</td>
                  <td><strong>{item.name}</strong></td>
                  <td>{item.brand || '-'}</td>
                  <td>{item.model || '-'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{item.serial_number || '-'}</td>
                  <td><strong>{item.assigned_to || '-'}</strong></td>
                  <td>{item.designation || '-'}</td>
                  <td>{item.department || '-'}</td>
                  <td>{item.location || '-'}</td>
                  <td>
                    <button className="action-btn return" onClick={() => openReturnModal(item)} title="Return Asset">
                      <FaUndo /> Return
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Return Voucher Modal */}
      {showReturnModal && returnItem && (
        <div className="modal-overlay" onClick={() => setShowReturnModal(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h2><FaUndo /> Asset Receipt Voucher</h2>
              <button className="close-btn" onClick={() => setShowReturnModal(false)}>×</button>
            </div>
            <div className="modal-body" id="return-voucher">
              <div className="voucher-container">
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <h2 style={{ margin: 0 }}>ISSUE / RECEIPT VOUCHER</h2>
                  <hr style={{ border: '1px solid #333' }} />
                </div>

                {/* Asset Details */}
                <div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '5px', marginBottom: '15px' }}>
                  <h3>Selected Asset</h3>
                  <p><strong>{returnItem.name}</strong></p>
                  <p>Brand: {returnItem.brand || '-'} | Model: {returnItem.model || '-'} | S/N: {returnItem.serial_number || '-'}</p>
                  <p>Specifications: {returnItem.specifications || '-'}</p>
                </div>

                {/* Two-column personal details */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                  <div>
                    <div className="form-group">
                      <label>Returned By</label>   {/* renamed */}
                      <input
                        type="text"
                        name="returned_by"
                        value={returnData.returned_by}
                        onChange={handleReturnChange}
                        className="voucher-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Department</label>
                      <input
                        type="text"
                        name="department"
                        value={returnData.department}
                        onChange={handleReturnChange}
                        className="voucher-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Employee ID</label>
                      <input
                        type="text"
                        name="employee_id"
                        value={returnData.employee_id}
                        onChange={handleReturnChange}
                        className="voucher-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Email</label>
                      <input
                        type="email"
                        name="email"
                        value={returnData.email}
                        onChange={handleReturnChange}
                        className="voucher-input"
                        placeholder="email@domain.com"
                      />
                    </div>
                    <div className="form-group">
                      <label>Return Date</label>   {/* renamed */}
                      <input
                        type="date"
                        name="return_date"
                        value={returnData.return_date}
                        onChange={handleReturnChange}
                        className="voucher-input"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="form-group">
                      <label>Received By</label>
                      <input
                        type="text"
                        name="received_by"
                        value={returnData.received_by}
                        onChange={handleReturnChange}
                        className="voucher-input"
                        placeholder="e.g., Admin"
                      />
                    </div>
                    <div className="form-group">
                      <label>Station</label>
                      <input
                        type="text"
                        name="station"
                        value={returnData.station}
                        onChange={handleReturnChange}
                        className="voucher-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Designation</label>
                      <input
                        type="text"
                        name="designation"
                        value={returnData.designation}
                        onChange={handleReturnChange}
                        className="voucher-input"
                        placeholder="e.g., Manager IT"
                      />
                    </div>
                    <div className="form-group">
                      <label>Mobile Number</label>
                      <input
                        type="text"
                        name="mobile_number"
                        value={returnData.mobile_number}
                        onChange={handleReturnChange}
                        className="voucher-input"
                        placeholder="03XX-XXXXXXX"
                      />
                    </div>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '22px' }}>
                      <input
                        type="checkbox"
                        name="backup_done"
                        checked={returnData.backup_done}
                        onChange={handleReturnChange}
                        id="backupCheck"
                      />
                      <label htmlFor="backupCheck">Backup Done?</label>
                    </div>
                  </div>
                </div>

                {/* Equipment Table */}
                <div style={{ marginBottom: '20px' }}>
                  <h4>Equipment</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#eee' }}>
                        <th style={{ border: '1px solid #333', padding: '8px' }}>Item</th>
                        <th style={{ border: '1px solid #333', padding: '8px' }}>QTY</th>
                        <th style={{ border: '1px solid #333', padding: '8px' }}>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ border: '1px solid #333', padding: '8px' }}>
                          <strong>{returnItem.name}</strong><br />
                          <small>Asset: {returnItem.asset_code || '-'}</small>
                        </td>
                        <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>1</td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}>
                          <textarea
                            name="remarks"
                            value={returnData.remarks}
                            onChange={handleReturnChange}
                            rows="2"
                            style={{ width: '100%', border: 'none', resize: 'vertical' }}
                            placeholder="Any notes..."
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Issued/Received signatures */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                  <div><strong>Returned By</strong><br />{returnData.returned_by || '________'}</div>
                  <div><strong>Received By</strong><br />{returnData.received_by || '________'}</div>
                </div>
              </div>
            </div>

            <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button className="btn-cancel" onClick={() => setShowReturnModal(false)}>Close</button>
              <button className="btn-print" onClick={handlePrint}><FaPrint /> Print</button>
              <button className="btn-submit" onClick={submitReturn}>Confirm Return</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetReturns;
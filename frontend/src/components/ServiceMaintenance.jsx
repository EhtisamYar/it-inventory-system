import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaClipboardList, FaSearch, FaPlus, FaEye, FaTrash, FaEdit, FaDownload } from 'react-icons/fa';
import ExportDropdown from './ExportDropdown';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';

const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-GB');
};

const ServiceMaintenance = () => {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState(null);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [serviceData, setServiceData] = useState({
    service_date: new Date().toISOString().split('T')[0],
    schedule_type: 'monthly',
    notes: '',
    performed_by: ''
  });
  const [history, setHistory] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showEditHistoryModal, setShowEditHistoryModal] = useState(false);
  const [editHistoryData, setEditHistoryData] = useState({
    id: null,
    service_date: '',
    schedule_type: '',
    notes: '',
    performed_by: ''
  });
  const API_URL = 'http://localhost:5000';

  useEffect(() => {
    fetchItems();
    fetchCategories();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/service/items`);
      setItems(response.data);
    } catch (error) {
      console.error('Error fetching service items:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/inventory/types`);
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleSearch = (e) => setSearchTerm(e.target.value);

  const getFilteredItems = () => {
    let filtered = items;
    if (activeTab) {
      filtered = filtered.filter(item => item.type_id === activeTab);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(term) ||
        (item.type_name && item.type_name.toLowerCase().includes(term)) ||
        (item.serial_number && item.serial_number.toLowerCase().includes(term)) ||
        (item.specifications && item.specifications.toLowerCase().includes(term)) ||
        (item.asset && item.asset.toLowerCase().includes(term)) ||
        (item.location && item.location.toLowerCase().includes(term)) ||
        (item.department && item.department.toLowerCase().includes(term))
      );
    }
    return filtered;
  };

  const filteredItems = getFilteredItems();

  const getStatusBadge = (item) => {
    if (!item.next_service_date) return <span className="badge badge-secondary">Not set</span>;
    const days = item.days_until_due;
    if (days === null) return <span className="badge badge-secondary">-</span>;
    if (days < 0) return <span className="badge badge-danger">Overdue</span>;
    if (days <= 7) return <span className="badge badge-warning">Due soon</span>;
    return <span className="badge badge-success">On track</span>;
  };

  // Record service
  const openRecordService = (item) => {
    setSelectedItem(item);
    setServiceData({
      service_date: new Date().toISOString().split('T')[0],
      schedule_type: item.service_schedule || 'monthly',
      notes: '',
      performed_by: ''
    });
    setShowServiceModal(true);
  };

  const handleServiceChange = (e) => {
    setServiceData({ ...serviceData, [e.target.name]: e.target.value });
  };

  const submitService = async () => {
    if (!selectedItem) return;
    try {
      await axios.post(`${API_URL}/api/service/record`, {
        item_id: selectedItem.id,
        service_date: serviceData.service_date,
        schedule_type: serviceData.schedule_type,
        notes: serviceData.notes,
        performed_by: serviceData.performed_by
      });
      alert('Service recorded successfully');
      setShowServiceModal(false);
      fetchItems();
    } catch (error) {
      console.error('Error recording service:', error);
      alert('Error recording service');
    }
  };

  // View history
  const openHistory = async (item) => {
    try {
      const response = await axios.get(`${API_URL}/api/service/history/${item.id}`);
      setHistory(response.data);
      setSelectedItem(item);
      setShowHistoryModal(true);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  // Delete history entry
  const deleteHistory = async (historyId) => {
    if (!window.confirm('Are you sure you want to delete this service record?')) return;
    try {
      await axios.delete(`${API_URL}/api/service/history/${historyId}`);
      alert('Service record deleted');
      // Refresh history and items
      if (selectedItem) {
        const response = await axios.get(`${API_URL}/api/service/history/${selectedItem.id}`);
        setHistory(response.data);
        fetchItems();
      }
    } catch (error) {
      console.error('Error deleting history:', error);
      alert('Error deleting history');
    }
  };

  // Edit history
  const openEditHistory = (record) => {
    setEditHistoryData({
      id: record.id,
      service_date: record.service_date ? record.service_date.split('T')[0] : '',
      schedule_type: record.schedule_type || 'monthly',
      notes: record.notes || '',
      performed_by: record.performed_by || ''
    });
    setShowEditHistoryModal(true);
  };

  const handleEditHistoryChange = (e) => {
    setEditHistoryData({ ...editHistoryData, [e.target.name]: e.target.value });
  };

  const submitEditHistory = async () => {
    try {
      await axios.put(`${API_URL}/api/service/history/${editHistoryData.id}`, {
        service_date: editHistoryData.service_date,
        schedule_type: editHistoryData.schedule_type,
        notes: editHistoryData.notes,
        performed_by: editHistoryData.performed_by
      });
      alert('Service record updated');
      setShowEditHistoryModal(false);
      // Refresh history and items
      if (selectedItem) {
        const response = await axios.get(`${API_URL}/api/service/history/${selectedItem.id}`);
        setHistory(response.data);
        fetchItems();
      }
    } catch (error) {
      console.error('Error updating history:', error);
      alert('Error updating history');
    }
  };

  // Export history
  const exportHistory = (type) => {
    if (!selectedItem || history.length === 0) return;
    const headers = ['Date', 'Schedule', 'Next Due', 'Performed By', 'Notes'];
    const data = history.map(rec => ({
      'Date': formatDate(rec.service_date),
      'Schedule': rec.schedule_type,
      'Next Due': formatDate(rec.next_service_date),
      'Performed By': rec.performed_by || '-',
      'Notes': rec.notes || '-'
    }));
    const filename = `Service_History_${selectedItem.name.replace(/\s+/g, '_')}`;
    if (type === 'excel') {
      exportToExcel(data, headers, filename);
    } else if (type === 'pdf') {
      exportToPDF(data, headers, `Service History - ${selectedItem.name}`, filename);
    }
  };

  // Export main list
  const getExportData = () => {
    const headers = [
      '#', 'Item', 'Category', 'S/N', 'Specifications', 'Asset', 'Location', 'Department',
      'Schedule', 'Last Service', 'Next Service', 'Status', 'Notes'
    ];
    const data = filteredItems.map((item, idx) => ({
      '#': idx + 1,
      'Item': item.name,
      'Category': item.type_name || '',
      'S/N': item.serial_number || '',
      'Specifications': item.specifications || '',
      'Asset': item.asset || '',
      'Location': item.location || '',
      'Department': item.department || '',
      'Schedule': item.service_schedule || '-',
      'Last Service': formatDate(item.last_service_date),
      'Next Service': formatDate(item.next_service_date),
      'Status': item.next_service_date ? (item.days_until_due < 0 ? 'Overdue' : item.days_until_due <= 7 ? 'Due soon' : 'On track') : 'Not set',
      'Notes': item.service_notes || ''
    }));
    return { headers, data };
  };

  const handleExportExcel = () => {
    const { headers, data } = getExportData();
    exportToExcel(data, headers, 'Service_Maintenance');
  };

  const handleExportPDF = () => {
    const { headers, data } = getExportData();
    exportToPDF(data, headers, 'Service Maintenance Report', 'Service_Maintenance');
  };

  if (loading) return <div className="loading"><div className="spinner"></div><p>Loading...</p></div>;

  const categoriesWithItems = categories.filter(cat =>
    items.some(item => item.type_id === cat.id)
  );

  return (
    <div className="inventory-list">
      <div className="list-header">
        <h2><FaClipboardList /> Service & Maintenance</h2>
        <div className="actions">
          <div className="search-box">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search by name, S/N, asset, location, department..."
              value={searchTerm}
              onChange={handleSearch}
            />
          </div>
          <ExportDropdown onExportExcel={handleExportExcel} onExportPDF={handleExportPDF} />
        </div>
      </div>

      {/* Category Tabs */}
      {categoriesWithItems.length > 0 && (
        <div className="master-tabs-container">
          <div className="master-tabs">
            <button
              className={`master-tab ${!activeTab ? 'active' : ''}`}
              onClick={() => setActiveTab(null)}
            >
              <span className="tab-icon">📋</span>
              <span className="tab-label">All Items</span>
              <span className="tab-badge">{items.length}</span>
            </button>
            {categoriesWithItems.map(cat => (
              <button
                key={cat.id}
                className={`master-tab ${activeTab === cat.id ? 'active' : ''}`}
                onClick={() => setActiveTab(cat.id)}
              >
                <span className="tab-icon">{cat.icon || '📦'}</span>
                <span className="tab-label">{cat.name}</span>
                <span className="tab-badge">
                  {items.filter(item => item.type_id === cat.id).length}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeTab && (
        <div className="active-category-label">
          Showing: <strong>{categories.find(c => c.id === activeTab)?.name || ''}</strong>
          <span className="count">({filteredItems.length} items)</span>
          <button className="clear-filter" onClick={() => setActiveTab(null)}>
            ✕ Clear Filter
          </button>
        </div>
      )}

      <div className="items-table">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th>Category</th>
              <th>S/N</th>
              <th>Specifications</th>
              <th>Asset</th>
              <th>Location</th>
              <th>Department</th>
              <th>Schedule</th>
              <th>Last Service</th>
              <th>Next Service</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr><td colSpan="13" className="empty-state">No items found.</td></tr>
            ) : (
              filteredItems.map((item, idx) => (
                <tr key={item.id}>
                  <td>{idx + 1}</td>
                  <td><strong>{item.name}</strong></td>
                  <td>{item.type_icon || '📦'} {item.type_name}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{item.serial_number || '-'}</td>
                  <td style={{ fontSize: '13px' }}>{item.specifications || '-'}</td>
                  <td>{item.asset || '-'}</td>
                  <td>{item.location || '-'}</td>
                  <td>{item.department || '-'}</td>
                  <td>{item.service_schedule || '-'}</td>
                  <td>{formatDate(item.last_service_date)}</td>
                  <td>{formatDate(item.next_service_date)}</td>
                  <td>{getStatusBadge(item)}</td>
                  <td>
                    <button className="action-btn edit" onClick={() => openRecordService(item)} title="Record Service">
                      <FaPlus /> Service
                    </button>
                    <button className="action-btn view" onClick={() => openHistory(item)} title="View History">
                      <FaEye />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Record Service Modal */}
      {showServiceModal && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowServiceModal(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Record Service – {selectedItem.name}</h2>
              <button className="close-btn" onClick={() => setShowServiceModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Service Date *</label>
                <input type="date" name="service_date" value={serviceData.service_date} onChange={handleServiceChange} />
              </div>
              <div className="form-group">
                <label>Schedule Type *</label>
                <select name="schedule_type" value={serviceData.schedule_type} onChange={handleServiceChange}>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div className="form-group">
                <label>Performed By</label>
                <input type="text" name="performed_by" value={serviceData.performed_by} onChange={handleServiceChange} placeholder="Who performed the service?" />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea name="notes" value={serviceData.notes} onChange={handleServiceChange} rows="3" placeholder="Any notes about this service..." />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn-cancel" onClick={() => setShowServiceModal(false)}>Cancel</button>
              <button className="btn-submit" onClick={submitService}>Submit Service</button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal – with Edit & Delete */}
      {showHistoryModal && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Service History – {selectedItem.name}</h2>
              <button className="close-btn" onClick={() => setShowHistoryModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {history.length === 0 ? (
                <p>No service records found.</p>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '12px' }}>
                    <button className="btn-secondary" onClick={() => exportHistory('excel')}>
                      <FaDownload /> Excel
                    </button>
                    <button className="btn-secondary" onClick={() => exportHistory('pdf')}>
                      <FaDownload /> PDF
                    </button>
                  </div>
                  <table className="items-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Schedule</th>
                        <th>Next Due</th>
                        <th>Performed By</th>
                        <th>Notes</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(rec => (
                        <tr key={rec.id}>
                          <td>{formatDate(rec.service_date)}</td>
                          <td>{rec.schedule_type}</td>
                          <td>{formatDate(rec.next_service_date)}</td>
                          <td>{rec.performed_by || '-'}</td>
                          <td>{rec.notes || '-'}</td>
                          <td>
                            <button className="action-btn edit" onClick={() => openEditHistory(rec)} title="Edit">
                              <FaEdit />
                            </button>
                            <button className="action-btn delete" onClick={() => deleteHistory(rec.id)} title="Delete">
                              <FaTrash />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
            <div className="form-actions">
              <button className="btn-cancel" onClick={() => setShowHistoryModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit History Modal */}
      {showEditHistoryModal && (
        <div className="modal-overlay" onClick={() => setShowEditHistoryModal(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>Edit Service Record</h2>
              <button className="close-btn" onClick={() => setShowEditHistoryModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Service Date *</label>
                <input type="date" name="service_date" value={editHistoryData.service_date} onChange={handleEditHistoryChange} />
              </div>
              <div className="form-group">
                <label>Schedule Type *</label>
                <select name="schedule_type" value={editHistoryData.schedule_type} onChange={handleEditHistoryChange}>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div className="form-group">
                <label>Performed By</label>
                <input type="text" name="performed_by" value={editHistoryData.performed_by} onChange={handleEditHistoryChange} placeholder="Who performed the service?" />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea name="notes" value={editHistoryData.notes} onChange={handleEditHistoryChange} rows="3" placeholder="Any notes about this service..." />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn-cancel" onClick={() => setShowEditHistoryModal(false)}>Cancel</button>
              <button className="btn-submit" onClick={submitEditHistory}>Update</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceMaintenance;
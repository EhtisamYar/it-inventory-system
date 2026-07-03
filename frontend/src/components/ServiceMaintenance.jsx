import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  FaClipboardList, FaSearch, FaPlus, FaEye, FaTrash, FaEdit, 
  FaColumns, FaFileExport, FaLayerGroup, FaInbox 
} from 'react-icons/fa';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-GB');
};

// ---------- Column Definitions ----------
const COLUMN_DEFS = {
  item: { label: 'Item', always: false },
  category: { label: 'Category', always: false },
  serial: { label: 'S/N', always: false },
  specs: { label: 'Specifications', always: false },
  asset: { label: 'Asset', always: false },
  location: { label: 'Location', always: false },
  department: { label: 'Department', always: false },
  schedule: { label: 'Schedule', always: false },
  lastService: { label: 'Last Service', always: false },
  nextService: { label: 'Next Service', always: false },
  status: { label: 'Status', always: false },
};

const DEFAULT_VISIBLE = Object.keys(COLUMN_DEFS).reduce((acc, key) => {
  acc[key] = true;
  return acc;
}, {});

// ---------- Style constants (matching InventoryList) ----------
const ACCENT = '#4F46E5';
const INK = '#14161F';
const CATEGORY_TINTS = ['#4F46E5', '#0D9488', '#B45309', '#BE185D', '#0369A1', '#4D7C0F', '#7C3AED', '#C2410C'];
const getTint = (index) => CATEGORY_TINTS[index % CATEGORY_TINTS.length];

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
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const columnRef = useRef(null);
  const exportRef = useRef(null);

  const API_URL = 'http://localhost:5000';

  // ---------- Column Visibility ----------
  const getDefaultVisible = () => {
    const stored = localStorage.getItem('service_columns');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const merged = {};
        Object.keys(COLUMN_DEFS).forEach(key => {
          merged[key] = parsed[key] !== undefined ? parsed[key] : true;
        });
        return merged;
      } catch {}
    }
    return { ...DEFAULT_VISIBLE };
  };

  const [visibleColumns, setVisibleColumns] = useState(getDefaultVisible);

  useEffect(() => {
    localStorage.setItem('service_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const toggleColumn = (key) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const availableColumns = Object.keys(COLUMN_DEFS);

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
    if (!item.next_service_date) return <span style={styles.dash}>-</span>;
    const days = item.days_until_due;
    if (days === null) return <span style={styles.dash}>-</span>;
    if (days < 0) return <span style={{ ...styles.statusBadge, background: '#FEF2F2', color: '#B91C1C' }}>Overdue</span>;
    if (days <= 7) return <span style={{ ...styles.statusBadge, background: '#FFFBEB', color: '#D97706' }}>Due soon</span>;
    return <span style={{ ...styles.statusBadge, background: '#ECFDF5', color: '#047857' }}>On track</span>;
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
    const ws = XLSX.utils.json_to_sheet(data, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'History');
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const exportHistoryPDF = () => {
    if (!selectedItem || history.length === 0) return;
    const headers = ['Date', 'Schedule', 'Next Due', 'Performed By', 'Notes'];
    const doc = new jsPDF('landscape', 'mm', 'a4');
    doc.setFont('helvetica');
    doc.setFontSize(16);
    doc.text(`Service History - ${selectedItem.name}`, 14, 15);
    const tableData = history.map(rec => [
      formatDate(rec.service_date),
      rec.schedule_type,
      formatDate(rec.next_service_date),
      rec.performed_by || '-',
      rec.notes || '-'
    ]);
    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: 25,
      styles: { fontSize: 8, font: 'helvetica' },
      headStyles: { fillColor: [79, 70, 229], font: 'helvetica' },
      margin: { left: 10, right: 10 },
    });
    doc.save(`Service_History_${selectedItem.name.replace(/\s+/g, '_')}.pdf`);
  };

  // Export main list (with visible columns)
  const getExportData = () => {
    const headers = ['#'];
    const order = ['item', 'category', 'serial', 'specs', 'asset', 'location', 'department', 'schedule', 'lastService', 'nextService', 'status'];
    order.forEach(key => {
      if (visibleColumns[key]) headers.push(COLUMN_DEFS[key].label);
    });
    const rows = filteredItems.map((item, idx) => {
      const row = { '#': idx + 1 };
      const valueMap = {
        item: item.name,
        category: item.type_name || '',
        serial: item.serial_number || '',
        specs: item.specifications || '',
        asset: item.asset || '',
        location: item.location || '',
        department: item.department || '',
        schedule: item.service_schedule || '-',
        lastService: formatDate(item.last_service_date),
        nextService: formatDate(item.next_service_date),
        status: item.next_service_date ? (item.days_until_due < 0 ? 'Overdue' : item.days_until_due <= 7 ? 'Due soon' : 'On track') : 'Not set',
      };
      order.forEach(key => {
        if (visibleColumns[key]) row[COLUMN_DEFS[key].label] = valueMap[key];
      });
      return row;
    });
    return { headers, rows };
  };

  const handleExportExcel = () => {
    setShowExportDropdown(false);
    const { headers, rows } = getExportData();
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
    XLSX.utils.book_append_sheet(wb, ws, 'Service');
    XLSX.writeFile(wb, 'Service_Maintenance.xlsx');
  };

  const handleExportPDF = () => {
    setShowExportDropdown(false);
    const { headers, rows } = getExportData();
    const doc = new jsPDF('landscape', 'mm', 'a4');
    doc.setFont('helvetica');
    doc.setFontSize(16);
    doc.text('Service Maintenance Report', 14, 15);
    const tableData = rows.map(row => Object.values(row));
    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: 25,
      styles: { fontSize: 8, font: 'helvetica' },
      headStyles: { fillColor: [79, 70, 229], font: 'helvetica' },
      margin: { left: 10, right: 10 },
    });
    doc.save('Service_Maintenance.pdf');
  };

  // ---------- Render Helpers ----------
  const renderHeaders = () => {
    const headers = [<th key="#" style={styles.th}>#</th>];
    const order = ['item', 'category', 'serial', 'specs', 'asset', 'location', 'department', 'schedule', 'lastService', 'nextService', 'status'];
    order.forEach(key => {
      if (visibleColumns[key]) {
        headers.push(<th key={key} style={styles.th}>{COLUMN_DEFS[key].label}</th>);
      }
    });
    headers.push(<th key="actions" style={{ ...styles.th, textAlign: 'right' }}>Actions</th>);
    return headers;
  };

  const renderRowCells = (item, index) => {
    const cells = [<td key={`${item.id}-num`} style={{ ...styles.td, color: '#C1C4CC' }}>{index + 1}</td>];
    const order = ['item', 'category', 'serial', 'specs', 'asset', 'location', 'department', 'schedule', 'lastService', 'nextService', 'status'];
    const dash = <span style={styles.dash}>-</span>;
    const tint = item.type_id ? getTint(item.type_id) : '#6B7280';
    const valueMap = {
      item: <strong>{item.name}</strong>,
      category: <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: '#4B5563' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: tint }} />
                  {item.type_name}
                </span>,
      serial: item.serial_number || dash,
      specs: item.specifications || dash,
      asset: item.asset || dash,
      location: item.location || dash,
      department: item.department || dash,
      schedule: item.service_schedule || dash,
      lastService: formatDate(item.last_service_date),
      nextService: formatDate(item.next_service_date),
      status: getStatusBadge(item),
    };
    order.forEach(key => {
      if (visibleColumns[key]) {
        cells.push(<td key={`${item.id}-${key}`} style={styles.td}>{valueMap[key]}</td>);
      }
    });
    cells.push(
      <td key={`${item.id}-actions`} style={{ ...styles.td, textAlign: 'right' }}>
        <div style={styles.actionRow}>
          <button className="gl-icon-btn" style={{ ...styles.iconBtn, color: '#0D9488' }} onClick={() => openRecordService(item)} title="Record Service">
            <FaPlus size={12} />
          </button>
          <button className="gl-icon-btn gl-icon-view" style={styles.iconBtn} onClick={() => openHistory(item)} title="View History">
            <FaEye size={12} />
          </button>
        </div>
      </td>
    );
    return cells;
  };

  // ---------- Close dropdowns on outside click ----------
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (columnRef.current && !columnRef.current.contains(event.target)) {
        setShowColumnDropdown(false);
      }
      if (exportRef.current && !exportRef.current.contains(event.target)) {
        setShowExportDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ---------- Category groups for sidebar ----------
  const categoriesWithItems = categories.filter(cat =>
    items.some(item => item.type_id === cat.id)
  );
  const categoryTintMap = {};
  categoriesWithItems.forEach((cat, idx) => {
    categoryTintMap[cat.id] = getTint(idx);
  });

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingWrap}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Loading equipment…</p>
        </div>
        <style>{sheet}</style>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <style>{sheet}</style>
      <div style={styles.shell}>
        {/* Sidebar */}
        <aside style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <FaLayerGroup size={12} color="#9CA3AF" />
            <span>Categories</span>
          </div>
          <nav style={styles.navList}>
            <button
              onClick={() => setActiveTab(null)}
              style={{ ...styles.navItem, ...(!activeTab ? styles.navItemActive : {}) }}
            >
              <span style={styles.navLabel}>All items</span>
              <span style={{ ...styles.navCount, ...(!activeTab ? styles.navCountActive : {}) }}>{items.length}</span>
            </button>
            {categoriesWithItems.map(cat => {
              const tint = categoryTintMap[cat.id];
              const isActive = activeTab === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveTab(isActive ? null : cat.id)}
                  style={{ ...styles.navItem, ...(isActive ? styles.navItemActive : {}) }}
                >
                  <span style={styles.navLabel}>
                    <span style={{ ...styles.navDot, background: isActive ? '#fff' : tint }} />
                    {cat.name}
                  </span>
                  <span style={{ ...styles.navCount, ...(isActive ? styles.navCountActive : {}) }}>
                    {items.filter(item => item.type_id === cat.id).length}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main style={styles.main}>
          <div style={styles.mainHeader}>
            <div>
              <h1 style={styles.listTitle}>
                {activeTab ? categories.find(c => c.id === activeTab)?.name || 'Category' : 'Service & Maintenance'}
              </h1>
              <p style={styles.titleSub}>{filteredItems.length} of {items.length} items</p>
            </div>
            <div style={styles.headerActions}>
              <div style={styles.searchBox}>
                <FaSearch style={styles.searchIcon} size={12} />
                <input
                  type="text"
                  placeholder="Search…"
                  value={searchTerm}
                  onChange={handleSearch}
                  style={styles.searchInput}
                />
              </div>

              <div style={{ position: 'relative' }} ref={columnRef}>
                <button style={styles.iconOnlyBtn} onClick={() => setShowColumnDropdown(!showColumnDropdown)} title="Columns">
                  <FaColumns size={13} />
                </button>
                {showColumnDropdown && (
                  <div style={styles.dropdown}>
                    <div style={styles.dropdownHeader}>Show columns</div>
                    {availableColumns.map(key => (
                      <label key={key} className="gl-checkbox-row" style={styles.checkboxRow}>
                        <input
                          type="checkbox"
                          checked={visibleColumns[key]}
                          onChange={() => toggleColumn(key)}
                          style={{ accentColor: ACCENT }}
                        />
                        {COLUMN_DEFS[key].label}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ position: 'relative' }} ref={exportRef}>
                <button style={styles.iconOnlyBtn} onClick={() => setShowExportDropdown(!showExportDropdown)} title="Export">
                  <FaFileExport size={13} />
                </button>
                {showExportDropdown && (
                  <div style={{ ...styles.dropdown, minWidth: '150px' }}>
                    <button style={styles.exportOption} onClick={handleExportExcel}>Export as Excel</button>
                    <button style={styles.exportOption} onClick={handleExportPDF}>Export as PDF</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={styles.tableCard}>
            <div style={styles.tableScroll}>
              <table style={styles.table}>
                <thead>
                  <tr>{renderHeaders()}</tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={100} style={styles.emptyCell}>
                        <div style={styles.emptyWrap}>
                          <div style={styles.emptyIcon}><FaInbox size={18} /></div>
                          <h3 style={styles.emptyTitle}>No items found</h3>
                          <p style={styles.emptyText}>Try adjusting your search.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item, idx) => (
                      <tr key={item.id} className="gl-row">{renderRowCells(item, idx)}</tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Record Service Modal */}
      {showServiceModal && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowServiceModal(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>Record Service – {selectedItem.name}</h2>
              <button className="close-btn" onClick={() => setShowServiceModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '20px' }}>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label>Service Date *</label>
                <input type="date" name="service_date" value={serviceData.service_date} onChange={handleServiceChange} style={styles.input} />
              </div>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label>Schedule Type *</label>
                <select name="schedule_type" value={serviceData.schedule_type} onChange={handleServiceChange} style={styles.input}>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label>Performed By</label>
                <input type="text" name="performed_by" value={serviceData.performed_by} onChange={handleServiceChange} placeholder="Who performed the service?" style={styles.input} />
              </div>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label>Notes</label>
                <textarea name="notes" value={serviceData.notes} onChange={handleServiceChange} rows="3" placeholder="Any notes..." style={{ ...styles.input, resize: 'vertical' }} />
              </div>
            </div>
            <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 20px', borderTop: '1px solid #E5E7EB' }}>
              <button className="btn-cancel" onClick={() => setShowServiceModal(false)}>Cancel</button>
              <button className="btn-submit" style={styles.btnPrimary} onClick={submitService}>Submit Service</button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '850px' }}>
            <div className="modal-header">
              <h2>Service History – {selectedItem.name}</h2>
              <button className="close-btn" onClick={() => setShowHistoryModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '20px' }}>
              {history.length === 0 ? (
                <p>No service records found.</p>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '12px' }}>
                    <button className="btn-secondary" style={{ ...styles.iconOnlyBtn, width: 'auto', padding: '0 12px' }} onClick={() => exportHistory('excel')}>
                      <FaFileExport size={12} /> Excel
                    </button>
                    <button className="btn-secondary" style={{ ...styles.iconOnlyBtn, width: 'auto', padding: '0 12px' }} onClick={exportHistoryPDF}>
                      <FaFileExport size={12} /> PDF
                    </button>
                  </div>
                  <div style={styles.tableScroll}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Date</th>
                          <th style={styles.th}>Schedule</th>
                          <th style={styles.th}>Next Due</th>
                          <th style={styles.th}>Performed By</th>
                          <th style={styles.th}>Notes</th>
                          <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map(rec => (
                          <tr key={rec.id} className="gl-row">
                            <td style={styles.td}>{formatDate(rec.service_date)}</td>
                            <td style={styles.td}>{rec.schedule_type}</td>
                            <td style={styles.td}>{formatDate(rec.next_service_date)}</td>
                            <td style={styles.td}>{rec.performed_by || '-'}</td>
                            <td style={styles.td}>{rec.notes || '-'}</td>
                            <td style={{ ...styles.td, textAlign: 'right' }}>
                              <div style={styles.actionRow}>
                                <button className="gl-icon-btn gl-icon-edit" style={styles.iconBtn} onClick={() => openEditHistory(rec)} title="Edit">
                                  <FaEdit size={12} />
                                </button>
                                <button className="gl-icon-btn gl-icon-delete" style={styles.iconBtn} onClick={() => deleteHistory(rec.id)} title="Delete">
                                  <FaTrash size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 20px', borderTop: '1px solid #E5E7EB' }}>
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
            <div className="modal-body" style={{ padding: '20px' }}>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label>Service Date *</label>
                <input type="date" name="service_date" value={editHistoryData.service_date} onChange={handleEditHistoryChange} style={styles.input} />
              </div>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label>Schedule Type *</label>
                <select name="schedule_type" value={editHistoryData.schedule_type} onChange={handleEditHistoryChange} style={styles.input}>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label>Performed By</label>
                <input type="text" name="performed_by" value={editHistoryData.performed_by} onChange={handleEditHistoryChange} placeholder="Who performed the service?" style={styles.input} />
              </div>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label>Notes</label>
                <textarea name="notes" value={editHistoryData.notes} onChange={handleEditHistoryChange} rows="3" placeholder="Any notes..." style={{ ...styles.input, resize: 'vertical' }} />
              </div>
            </div>
            <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 20px', borderTop: '1px solid #E5E7EB' }}>
              <button className="btn-cancel" onClick={() => setShowEditHistoryModal(false)}>Cancel</button>
              <button className="btn-submit" style={styles.btnPrimary} onClick={submitEditHistory}>Update</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------- Styles (matching InventoryList) ----------
const styles = {
  page: {
    minHeight: '100%',
    background: '#F6F6F8',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  shell: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0',
    minHeight: '100vh',
  },
  sidebar: {
    width: '220px',
    flexShrink: 0,
    padding: '24px 14px',
    borderRight: '1px solid #EAEAEE',
    position: 'sticky',
    top: 0,
    height: '100vh',
    overflowY: 'auto',
    background: '#FBFBFC',
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    fontSize: '11px',
    fontWeight: 700,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '0 10px',
    marginBottom: '8px',
  },
  navList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    height: '34px',
    padding: '0 10px',
    borderRadius: '8px',
    border: 'none',
    background: 'transparent',
    fontSize: '13px',
    fontWeight: 500,
    color: '#4B5563',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
  },
  navItemActive: {
    background: INK,
    color: '#fff',
    fontWeight: 600,
  },
  navLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  navDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  navCount: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#9CA3AF',
    flexShrink: 0,
  },
  navCountActive: {
    color: 'rgba(255,255,255,0.7)',
  },
  sidebarDivider: {
    height: '1px',
    background: '#EAEAEE',
    margin: '18px 10px',
  },
  main: {
    flex: 1,
    minWidth: 0,
    padding: '24px 32px 40px',
  },
  mainHeader: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '14px',
    marginBottom: '18px',
  },
  listTitle: {
    fontSize: '19px',
    fontWeight: 700,
    color: '#111827',
    margin: 0,
    lineHeight: 1.3,
  },
  titleSub: {
    fontSize: '12.5px',
    color: '#9CA3AF',
    margin: '2px 0 0',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  searchBox: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    width: '220px',
  },
  searchIcon: {
    position: 'absolute',
    left: '11px',
    color: '#9CA3AF',
    pointerEvents: 'none',
  },
  searchInput: {
    width: '100%',
    height: '36px',
    padding: '0 12px 0 32px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    background: '#fff',
    fontSize: '13px',
    outline: 'none',
    color: '#1F2937',
  },
  iconOnlyBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    background: '#fff',
    color: '#4B5563',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  btnPrimary: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    height: '36px',
    padding: '0 15px',
    background: ACCENT,
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  dropdown: {
    position: 'absolute',
    top: '42px',
    right: 0,
    borderRadius: '10px',
    padding: '6px',
    minWidth: '190px',
    maxHeight: '280px',
    overflowY: 'auto',
    zIndex: 20,
    background: '#fff',
    border: '1px solid #E5E7EB',
    boxShadow: '0 10px 24px rgba(17,24,39,0.10)',
  },
  dropdownHeader: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    padding: '6px 8px',
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    padding: '7px 8px',
    fontSize: '13px',
    color: '#374151',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  exportOption: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '9px 10px',
    fontSize: '13px',
    color: '#374151',
    background: 'transparent',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  tableCard: {
    borderRadius: '12px',
    overflow: 'hidden',
    background: '#fff',
    border: '1px solid #ECEDF1',
  },
  tableScroll: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    textAlign: 'left',
    padding: '11px 16px',
    background: '#FAFAFB',
    color: '#9CA3AF',
    fontWeight: 600,
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    borderBottom: '1px solid #ECEDF1',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '12px 16px',
    borderBottom: '1px solid #F3F4F6',
    color: '#374151',
    whiteSpace: 'nowrap',
  },
  dash: { color: '#D1D5DB' },
  actionRow: {
    display: 'flex',
    gap: '4px',
    justifyContent: 'flex-end',
  },
  iconBtn: {
    width: '28px',
    height: '28px',
    borderRadius: '7px',
    border: 'none',
    background: 'transparent',
    color: '#9CA3AF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  statusBadge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '6px',
    fontSize: '11.5px',
    fontWeight: 600,
  },
  emptyCell: { padding: '56px 20px' },
  emptyWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '5px',
  },
  emptyIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    background: '#F3F4F6',
    color: '#9CA3AF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '6px',
  },
  emptyTitle: { fontSize: '14.5px', fontWeight: 700, color: '#1F2937', margin: 0 },
  emptyText: { fontSize: '13px', color: '#9CA3AF', margin: '0 0 10px' },
  loadingWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '60vh',
    gap: '14px',
  },
  spinner: {
    width: '30px',
    height: '30px',
    border: '3px solid #E5E7EB',
    borderTopColor: ACCENT,
    borderRadius: '50%',
    animation: 'gl-spin 0.8s linear infinite',
  },
  loadingText: { color: '#6B7280', fontSize: '14px', margin: 0 },
  input: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #D1D5DB',
    fontSize: '14px',
    outline: 'none',
    background: '#fff',
    color: '#1F2937',
  },
};

const sheet = `
@keyframes gl-spin { to { transform: rotate(360deg); } }
.gl-row { transition: background 0.12s ease; }
.gl-row:hover { background: #FAFAFB; }
.gl-btn-primary { transition: opacity 0.15s ease; }
.gl-btn-primary:hover { opacity: 0.9; }
.gl-icon-btn { transition: all 0.12s ease; }
.gl-icon-view:hover { background: #EFF6FF !important; color: #0284C7 !important; }
.gl-icon-edit:hover { background: #FFFBEB !important; color: #D97706 !important; }
.gl-icon-delete:hover { background: #FEF2F2 !important; color: #E11D48 !important; }
input[type=text]::placeholder { color: #9CA3AF; }
input:focus { border-color: #4F46E5 !important; box-shadow: 0 0 0 3px rgba(79,70,229,0.12); }
@media (max-width: 900px) { .gl-sidebar { display: none; } }
`;

export default ServiceMaintenance;
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

// ---------- Design tokens – matches AssetAssignment ----------
const PAPER = '#F2F0EA';
const INK = '#14161F';
const TEAL = '#1F6F78';
const AMBER = '#C08A1E';
const CATEGORY_TINTS = ['#1F6F78', '#B45309', '#5B4B8A', '#0F766E', '#9A3412', '#4D5B8A', '#7C5A2A', '#3F6B3A'];
const getTint = (index) => CATEGORY_TINTS[index % CATEGORY_TINTS.length];

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

// ---------- Tag glyph (same as AssetAssignment) ----------
const TagGlyph = ({ color }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
    <path
      d="M1.2 6.4 L6.4 1.2 a1.3 1.3 0 0 1 1.8 0 l4.6 4.6 a1.3 1.3 0 0 1 0 1.8 l-5.2 5.2 a1.3 1.3 0 0 1-1.8 0 L1.2 8.2 a1.3 1.3 0 0 1 0-1.8 Z"
      fill={color}
      opacity="0.16"
    />
    <path
      d="M1.2 6.4 L6.4 1.2 a1.3 1.3 0 0 1 1.8 0 l4.6 4.6 a1.3 1.3 0 0 1 0 1.8 l-5.2 5.2 a1.3 1.3 0 0 1-1.8 0 L1.2 8.2 a1.3 1.3 0 0 1 0-1.8 Z"
      fill="none"
      stroke={color}
      strokeWidth="1"
    />
    <circle cx="4.6" cy="4.6" r="1" fill={color} />
  </svg>
);

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

  const API_URL = 'http://10.9.109.10:5000';

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
      headStyles: { fillColor: [31, 111, 120], font: 'helvetica' }, // TEAL
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
      headStyles: { fillColor: [31, 111, 120], font: 'helvetica' },
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
    const cells = [<td key={`${item.id}-num`} style={{ ...styles.td, color: '#B9B3A4' }}>{String(index + 1).padStart(3, '0')}</td>];
    const order = ['item', 'category', 'serial', 'specs', 'asset', 'location', 'department', 'schedule', 'lastService', 'nextService', 'status'];
    const dash = <span style={styles.dash}>-</span>;
    const tint = item.type_id ? getTint(item.type_id) : '#6B6353';
    const valueMap = {
      item: <strong>{item.name}</strong>,
      category: <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', fontWeight: 600, color: '#3A3626' }}>
                  <TagGlyph color={tint} />
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
          <button className="gl-icon-btn gl-icon-add" style={{ ...styles.iconBtn, color: TEAL }} onClick={() => openRecordService(item)} title="Record Service">
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
      <div style={styles.frame}>
        {/* Top bar */}
        <header style={styles.topbar}>
          <div style={styles.brandBlock}>
            <div style={styles.mark}><FaClipboardList size={14} /></div>
            <div>
              <h1 style={styles.brandTitle}>
                {activeTab ? categories.find(c => c.id === activeTab)?.name || 'Category' : 'Service & Maintenance'}
              </h1>
              <p style={styles.brandSub}>Fauji Foods · Service schedules</p>
            </div>
          </div>

          <div style={styles.headerActions}>
            <div style={styles.searchBox}>
              <FaSearch style={styles.searchIcon} size={12} />
              <input
                type="text"
                placeholder="Search items…"
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
                        style={{ accentColor: TEAL }}
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
        </header>

        {/* Stat strip */}
        <div style={styles.statStrip}>
          <div style={styles.statBlock}>
            <span style={styles.statValue}>{String(items.length).padStart(3, '0')}</span>
            <span style={styles.statLabel}>Total items</span>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.statBlock}>
            <span style={styles.statValue}>
              {String(items.filter(i => i.next_service_date && i.days_until_due < 0).length).padStart(2, '0')}
            </span>
            <span style={styles.statLabel}>Overdue</span>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.statBlock}>
            <span style={styles.statValue}>
              {String(items.filter(i => i.next_service_date && i.days_until_due <= 7 && i.days_until_due >= 0).length).padStart(2, '0')}
            </span>
            <span style={styles.statLabel}>Due soon</span>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.statBlock}>
            <span style={styles.statValue}>{String(categoriesWithItems.length).padStart(2, '0')}</span>
            <span style={styles.statLabel}>Categories</span>
          </div>
        </div>

        {/* Category tabs */}
        {categoriesWithItems.length > 0 && (
          <div style={styles.tabRow}>
            <button
              onClick={() => setActiveTab(null)}
              style={{ ...styles.tabPill, ...(!activeTab ? styles.tabPillActive : {}) }}
            >
              All items
              <span style={{ ...styles.tabCount, ...(!activeTab ? styles.tabCountActive : {}) }}>{items.length}</span>
            </button>
            {categoriesWithItems.map(cat => {
              const tint = categoryTintMap[cat.id];
              const isActive = activeTab === cat.id;
              const count = items.filter(item => item.type_id === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveTab(isActive ? null : cat.id)}
                  style={{ ...styles.tabPill, ...(isActive ? { ...styles.tabPillActive, background: tint, borderColor: tint } : {}) }}
                >
                  <TagGlyph color={isActive ? '#fff' : tint} />
                  {cat.name}
                  <span style={{ ...styles.tabCount, ...(isActive ? styles.tabCountActive : {}) }}>{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Table */}
        <div style={styles.tableCard}>
          <div style={styles.tableScroll}>
            <table style={styles.table}>
              <thead>
                <tr>{renderHeaders()}</tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan="100" style={styles.emptyCell}>
                      <div style={styles.emptyWrap}>
                        <div style={styles.emptyIcon}><FaClipboardList size={16} /></div>
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
      </div>

      {/* Record Service Modal */}
      {showServiceModal && selectedItem && (
        <div style={styles.overlay} onClick={() => setShowServiceModal(false)}>
          <div style={{ ...styles.modal, maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Record service – {selectedItem.name}</h2>
              <button style={styles.closeBtn} onClick={() => setShowServiceModal(false)}>×</button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Service Date *</label>
                <input style={styles.input} type="date" name="service_date" value={serviceData.service_date} onChange={handleServiceChange} />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Schedule Type *</label>
                <select style={styles.select} name="schedule_type" value={serviceData.schedule_type} onChange={handleServiceChange}>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Performed By</label>
                <input style={styles.input} type="text" name="performed_by" value={serviceData.performed_by} onChange={handleServiceChange} placeholder="Who performed the service?" />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Notes</label>
                <textarea style={{ ...styles.input, resize: 'vertical', minHeight: '70px' }} name="notes" value={serviceData.notes} onChange={handleServiceChange} rows="3" placeholder="Any notes…" />
              </div>
              <div style={styles.formActions}>
                <button style={styles.btnCancel} onClick={() => setShowServiceModal(false)}>Cancel</button>
                <button className="gl-btn-primary" style={styles.btnPrimary} onClick={submitService}>Submit Service</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && selectedItem && (
        <div style={styles.overlay} onClick={() => setShowHistoryModal(false)}>
          <div style={{ ...styles.modal, maxWidth: '850px' }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Service History – {selectedItem.name}</h2>
              <button style={styles.closeBtn} onClick={() => setShowHistoryModal(false)}>×</button>
            </div>
            <div style={styles.modalBody}>
              {history.length === 0 ? (
                <p style={{ color: '#6B6353' }}>No service records found.</p>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '12px' }}>
                    <button className="gl-icon-btn" style={{ ...styles.iconOnlyBtn, width: 'auto', padding: '0 12px' }} onClick={() => exportHistory('excel')}>
                      Excel
                    </button>
                    <button className="gl-icon-btn" style={{ ...styles.iconOnlyBtn, width: 'auto', padding: '0 12px' }} onClick={exportHistoryPDF}>
                      PDF
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
              <div style={styles.formActions} className="no-print">
                <button style={styles.btnCancel} onClick={() => setShowHistoryModal(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit History Modal */}
      {showEditHistoryModal && (
        <div style={styles.overlay} onClick={() => setShowEditHistoryModal(false)}>
          <div style={{ ...styles.modal, maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Edit Service Record</h2>
              <button style={styles.closeBtn} onClick={() => setShowEditHistoryModal(false)}>×</button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Service Date *</label>
                <input style={styles.input} type="date" name="service_date" value={editHistoryData.service_date} onChange={handleEditHistoryChange} />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Schedule Type *</label>
                <select style={styles.select} name="schedule_type" value={editHistoryData.schedule_type} onChange={handleEditHistoryChange}>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Performed By</label>
                <input style={styles.input} type="text" name="performed_by" value={editHistoryData.performed_by} onChange={handleEditHistoryChange} placeholder="Who performed the service?" />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Notes</label>
                <textarea style={{ ...styles.input, resize: 'vertical', minHeight: '70px' }} name="notes" value={editHistoryData.notes} onChange={handleEditHistoryChange} rows="3" placeholder="Any notes…" />
              </div>
              <div style={styles.formActions}>
                <button style={styles.btnCancel} onClick={() => setShowEditHistoryModal(false)}>Cancel</button>
                <button className="gl-btn-primary" style={styles.btnPrimary} onClick={submitEditHistory}>Update</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------- Styles (matching AssetAssignment) ----------
const styles = {
  page: {
    minHeight: '100%',
    background: PAPER,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  frame: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '20px 28px 48px',
  },
  topbar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    paddingBottom: '18px',
    borderBottom: `2px solid ${INK}`,
    marginBottom: '18px',
  },
  brandBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  mark: {
    width: '38px',
    height: '38px',
    borderRadius: '8px',
    background: INK,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  brandTitle: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: '20px',
    fontWeight: 700,
    color: INK,
    margin: 0,
    lineHeight: 1.25,
  },
  brandSub: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '11px',
    color: '#8A8371',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
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
    width: '230px',
  },
  searchIcon: {
    position: 'absolute',
    left: '11px',
    color: '#9C9585',
    pointerEvents: 'none',
  },
  searchInput: {
    width: '100%',
    height: '36px',
    padding: '0 12px 0 32px',
    borderRadius: '8px',
    border: '1px solid #DEDACD',
    background: '#fff',
    fontSize: '13px',
    outline: 'none',
    color: INK,
  },
  iconOnlyBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    border: '1px solid #DEDACD',
    background: '#fff',
    color: '#57503F',
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
    background: TEAL,
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnCancel: {
    height: '36px',
    padding: '0 15px',
    background: '#fff',
    color: '#3A3626',
    border: '1px solid #DEDACD',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
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
    border: '1px solid #E5E1D3',
    boxShadow: '0 10px 24px rgba(20,22,31,0.12)',
  },
  dropdownHeader: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#9C9585',
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
    color: '#3A3626',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  exportOption: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '9px 10px',
    fontSize: '13px',
    color: '#3A3626',
    background: 'transparent',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  statStrip: {
    display: 'flex',
    alignItems: 'center',
    gap: '28px',
    padding: '14px 20px',
    marginBottom: '16px',
    background: INK,
    borderRadius: '10px',
    flexWrap: 'wrap',
  },
  statBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  statValue: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '17px',
    fontWeight: 700,
    color: '#fff',
  },
  statLabel: {
    fontSize: '10.5px',
    color: '#A9A392',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  statDivider: {
    width: '1px',
    height: '28px',
    background: 'rgba(255,255,255,0.14)',
  },
  tabRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    overflowX: 'auto',
    paddingBottom: '4px',
    marginBottom: '18px',
  },
  tabPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    height: '34px',
    padding: '0 13px',
    borderRadius: '8px',
    border: '1px solid #DEDACD',
    background: '#fff',
    fontSize: '13px',
    fontWeight: 500,
    color: '#3A3626',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  tabPillActive: {
    background: INK,
    borderColor: INK,
    color: '#fff',
    fontWeight: 600,
  },
  tabCount: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '11px',
    fontWeight: 600,
    color: '#9C9585',
  },
  tabCountActive: {
    color: 'rgba(255,255,255,0.75)',
  },
  tableCard: {
    borderRadius: '12px',
    overflow: 'hidden',
    background: '#fff',
    border: '1px solid #E5E1D3',
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
    background: '#FAF8F3',
    color: '#9C9585',
    fontWeight: 700,
    fontSize: '10.5px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid #E5E1D3',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '12px 16px',
    borderBottom: '1px solid #F1EEE6',
    color: '#3A3626',
    whiteSpace: 'nowrap',
  },
  dash: { color: '#D2CDBD' },
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
    color: '#9C9585',
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
  emptyCell: { padding: '56px 20px', textAlign: 'center' },
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
    background: '#F1EEE6',
    color: '#9C9585',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '6px',
  },
  emptyTitle: { fontSize: '14.5px', fontWeight: 700, color: INK, margin: 0 },
  emptyText: { fontSize: '13px', color: '#9C9585', margin: '0 0 10px' },
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
    border: '3px solid #E5E1D3',
    borderTopColor: TEAL,
    borderRadius: '50%',
    animation: 'gl-spin 0.8s linear infinite',
  },
  loadingText: { color: '#6B6353', fontSize: '14px', margin: 0 },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(20,22,31,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: '20px',
  },
  modal: {
    background: '#fff',
    borderRadius: '14px',
    width: '100%',
    maxHeight: '88vh',
    overflowY: 'auto',
    boxShadow: '0 24px 60px rgba(20,22,31,0.25)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 20px',
    borderBottom: '1px solid #E5E1D3',
    position: 'sticky',
    top: 0,
    background: '#fff',
    zIndex: 1,
  },
  modalTitle: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: '16px',
    fontWeight: 700,
    color: INK,
    margin: 0,
  },
  closeBtn: {
    width: '30px',
    height: '30px',
    borderRadius: '7px',
    border: 'none',
    background: 'transparent',
    color: '#9C9585',
    fontSize: '20px',
    lineHeight: 1,
    cursor: 'pointer',
  },
  modalBody: {
    padding: '20px',
  },
  formGroup: {
    marginBottom: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '11.5px',
    fontWeight: 700,
    color: '#9C9585',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  input: {
    height: '38px',
    padding: '0 12px',
    borderRadius: '8px',
    border: '1px solid #DEDACD',
    fontSize: '13px',
    color: INK,
    outline: 'none',
    fontFamily: "'Inter', sans-serif",
  },
  select: {
    height: '38px',
    padding: '0 12px',
    borderRadius: '8px',
    border: '1px solid #DEDACD',
    fontSize: '13px',
    color: INK,
    background: '#fff',
    outline: 'none',
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '10px',
  },
};

const sheet = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');

@keyframes gl-spin { to { transform: rotate(360deg); } }

.gl-row { transition: background 0.12s ease; }
.gl-row:hover { background: #FAF8F3; }
.gl-btn-primary { transition: opacity 0.15s ease; }
.gl-btn-primary:hover { opacity: 0.9; }
.gl-icon-btn { transition: all 0.12s ease; }
.gl-icon-view:hover { background: #EAF1F4 !important; color: #1F6F78 !important; }
.gl-icon-edit:hover { background: #FBF3E3 !important; color: #C08A1E !important; }
.gl-icon-delete:hover { background: #FBEDEA !important; color: #B4442B !important; }
.gl-icon-add:hover { background: #EAF1F4 !important; color: #1F6F78 !important; }
.gl-checkbox-row:hover { background: #FAF8F3; }
input[type=text]::placeholder, textarea::placeholder { color: #B9B3A4; }
input:focus, select:focus, textarea:focus { border-color: #1F6F78 !important; box-shadow: 0 0 0 3px rgba(31,111,120,0.12); outline: none; }

@media print {
  .no-print { display: none; }
}
`;

export default ServiceMaintenance;
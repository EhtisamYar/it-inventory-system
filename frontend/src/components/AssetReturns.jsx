import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  FaUndo, FaSearch, FaFileExcel, FaFilePdf, FaPlus, FaPrint, FaTimes,
  FaClipboardList, FaInbox, FaColumns, FaLayerGroup, FaUser, FaArrowLeft, FaEye
} from 'react-icons/fa';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const API_URL = 'http://localhost:5000';

const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-GB');
};

// ---------- Design tokens ----------
const PAPER = '#F2F0EA';
const INK = '#14161F';
const TEAL = '#1F6F78';
const CATEGORY_TINTS = ['#1F6F78', '#B45309', '#5B4B8A', '#0F766E', '#9A3412', '#4D5B8A', '#7C5A2A', '#3F6B3A'];
const getTint = (index) => CATEGORY_TINTS[index % CATEGORY_TINTS.length];

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

const COLUMN_DEFS = {
  item: { label: 'Item', always: false },
  serial: { label: 'Serial No', always: false },
  asset: { label: 'Asset', always: false },
  category: { label: 'Category', always: false },
  returnedBy: { label: 'Returned By', always: false },
  email: { label: 'Email', always: false },
  backup: { label: 'Backup', always: false },  // combined email backup + email closed
  remarks: { label: 'Remarks', always: false },
  returnedDate: { label: 'Returned Date', always: false },
};

const DEFAULT_VISIBLE = Object.keys(COLUMN_DEFS).reduce((acc, key) => {
  acc[key] = true;
  return acc;
}, {});

const AssetReturns = () => {
  const [activeTab, setActiveTab] = useState('return');
  const [returns, setReturns] = useState([]);
  const [assignedItems, setAssignedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);
  
  // ---------- Return Modal State ----------
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [step, setStep] = useState('employee');
  const [employeeSearch, setEmployeeSearch] = useState({
    employee_id: '',
    name: '',
    department: '',
  });
  const [foundAssets, setFoundAssets] = useState([]);
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [returnData, setReturnData] = useState({
    returned_by: '',
    return_date: new Date().toISOString().split('T')[0],
    email: '',
    mobile_number: '',
    backup_done: false,
    remarks: '',
    email_backup_done: false,
    email_closed: false,
  });
  const [quickReturnItem, setQuickReturnItem] = useState(null);

  // ---------- Print Modal ----------
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [returnedItems, setReturnedItems] = useState([]);
  const printRef = useRef();

  // ---------- View Return Details Modal ----------
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewReturnItem, setViewReturnItem] = useState(null);
  const viewPrintRef = useRef();

  // ---------- Column Visibility ----------
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const columnRef = useRef(null);
  const getDefaultVisible = () => {
    const stored = localStorage.getItem('returns_columns');
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
    localStorage.setItem('returns_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const toggleColumn = (key) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const availableColumns = Object.keys(COLUMN_DEFS);

  // ---------- Fetch Data ----------
  useEffect(() => {
    fetchAssignedItems();
    fetchReturns();
  }, []);

  const fetchAssignedItems = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/inventory/items`);
      const assigned = response.data.filter(item => item.assigned_to && item.assigned_to.trim() !== '');
      setAssignedItems(assigned);
    } catch (error) {
      console.error('Error fetching assigned items:', error);
    }
  };

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/returns`);
      console.log('✅ Returns data:', response.data);
      setReturns(response.data);
    } catch (error) {
      console.error('Error fetching returns:', error);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Return Modal Logic ----------
  const openReturnModal = () => {
    setStep('employee');
    setEmployeeSearch({ employee_id: '', name: '', department: '' });
    setFoundAssets([]);
    setSelectedAssets([]);
    setQuickReturnItem(null);
    setReturnData({
      returned_by: '',
      return_date: new Date().toISOString().split('T')[0],
      email: '',
      mobile_number: '',
      backup_done: false,
      remarks: '',
      email_backup_done: false,
      email_closed: false,
    });
    setShowReturnModal(true);
  };

  const openQuickReturnModal = (item) => {
    setQuickReturnItem(item);
    setStep('return');
    setFoundAssets([]);
    setSelectedAssets([]);
    setReturnData({
      returned_by: '',
      return_date: new Date().toISOString().split('T')[0],
      email: '',
      mobile_number: '',
      backup_done: false,
      remarks: '',
      email_backup_done: false,
      email_closed: false,
    });
    setShowReturnModal(true);
  };

  const handleEmployeeSearchChange = (e) => {
    setEmployeeSearch({ ...employeeSearch, [e.target.name]: e.target.value });
  };

  const findEmployeeAssets = () => {
    const { employee_id, name, department } = employeeSearch;
    const term = `${employee_id} ${name} ${department}`.trim().toLowerCase();
    if (!term) {
      alert('Please enter at least one field');
      return;
    }
    const filtered = assignedItems.filter(item =>
      (item.assigned_to && item.assigned_to.toLowerCase().includes(term)) ||
      (item.employee_id && item.employee_id.toLowerCase().includes(term)) ||
      (item.department && item.department.toLowerCase().includes(term))
    );
    if (filtered.length === 0) {
      alert('No assets found for this employee.');
      return;
    }
    setFoundAssets(filtered);
    setSelectedAssets([]);
    setStep('assets');
  };

  const toggleAssetSelection = (item) => {
    setSelectedAssets(prev => {
      const exists = prev.find(a => a.id === item.id);
      if (exists) {
        return prev.filter(a => a.id !== item.id);
      } else {
        return [...prev, item];
      }
    });
  };

  const selectAllAssets = () => {
    if (selectedAssets.length === foundAssets.length) {
      setSelectedAssets([]);
    } else {
      setSelectedAssets([...foundAssets]);
    }
  };

  const proceedToReturn = () => {
    if (selectedAssets.length === 0) {
      alert('Please select at least one asset to return.');
      return;
    }
    setStep('return');
  };

  const handleReturnChange = (e) => {
    const { name, value, type, checked } = e.target;
    setReturnData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // ---------- SUBMIT RETURN (UPDATED) ----------
  const submitReturn = async () => {
    let itemsToReturn = [];
    if (quickReturnItem) {
      itemsToReturn = [quickReturnItem];
    } else if (selectedAssets.length > 0) {
      itemsToReturn = selectedAssets;
    } else {
      alert('No assets selected.');
      return;
    }

    if (!returnData.returned_by.trim()) {
      alert('Please enter the name of the person returning the item');
      return;
    }

    try {
      const payload = {
        ...returnData,
        backup_done: returnData.backup_done ? 1 : 0,
        email_backup_done: returnData.email_backup_done ? 1 : 0,
        email_closed: returnData.email_closed ? 1 : 0,
      };

      const results = [];
      for (const item of itemsToReturn) {
        // Include assignment details from the asset
        const response = await axios.post(`${API_URL}/api/inventory/return`, {
          item_id: item.id,
          ...payload,
          employee_id: item.employee_id,
          designation: item.designation,
          station: item.station || item.location,
          department: item.department || item.type_name,
          issued_by: item.issued_by,
          date_of_issuance: item.date_of_issuance,
        });
        // Store returned item with all fields for the voucher
        results.push({
          ...item,
          ...returnData,
          return_date: returnData.return_date,
          returned_by: returnData.returned_by,
          // include assignment fields for voucher
          employee_id: item.employee_id,
          designation: item.designation,
          station: item.station || item.location,
          department: item.department || item.type_name,
          issued_by: item.issued_by,
          date_of_issuance: item.date_of_issuance,
        });
      }

      alert(`${results.length} item(s) returned successfully!`);
      setReturnedItems(results);
      setShowReturnModal(false);
      setShowPrintModal(true);
      setQuickReturnItem(null);
      setSelectedAssets([]);
      
      fetchAssignedItems();
      fetchReturns();
      setTimeout(() => setActiveTab('returned'), 500);
    } catch (error) {
      console.error('Error returning items:', error);
      alert('Failed to return items');
    }
  };

  // ---------- Print Voucher ----------
  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
        <head><title>Asset Return Voucher</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .voucher { max-width: 800px; margin: 0 auto; border: 1px solid #ccc; padding: 20px; }
          .header { text-align: center; font-size: 24px; font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 10px; }
          .details { margin: 15px 0; }
          .details table { width: 100%; border-collapse: collapse; }
          .details td { padding: 5px; }
          .items-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          .items-table th, .items-table td { border: 1px solid #000; padding: 8px; text-align: left; }
          .footer { margin-top: 20px; display: flex; justify-content: space-between; }
          .signature { width: 200px; text-align: center; border-top: 1px solid #000; padding-top: 5px; }
          @media print { .no-print { display: none; } }
        </style>
        </head>
        <body>${content.innerHTML}<script>window.onload = function() { window.print(); }</script></body>
      </html>
    `);
    win.document.close();
  };

  // ---------- View Return Details ----------
  const openViewReturn = (item) => {
    setViewReturnItem(item);
    setShowViewModal(true);
  };

  const handleViewPrint = () => {
    const content = viewPrintRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
        <head><title>Asset Return Voucher</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .voucher { max-width: 800px; margin: 0 auto; border: 1px solid #ccc; padding: 20px; }
          .header { text-align: center; font-size: 24px; font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 10px; }
          .details { margin: 15px 0; }
          .details table { width: 100%; border-collapse: collapse; }
          .details td { padding: 5px; }
          .items-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          .items-table th, .items-table td { border: 1px solid #000; padding: 8px; text-align: left; }
          .footer { margin-top: 20px; display: flex; justify-content: space-between; }
          .signature { width: 200px; text-align: center; border-top: 1px solid #000; padding-top: 5px; }
          @media print { .no-print { display: none; } }
        </style>
        </head>
        <body>${content.innerHTML}<script>window.onload = function() { window.print(); }</script></body>
      </html>
    `);
    win.document.close();
  };

  // ---------- Export Functions ----------
  const getExportData = (data) => {
    const order = ['item', 'serial', 'asset', 'category', 'returnedBy', 'email', 'backup', 'remarks', 'returnedDate'];
    const headers = ['#'];
    order.forEach(key => {
      if (visibleColumns[key]) headers.push(COLUMN_DEFS[key].label);
    });
    const rows = data.map((r, idx) => {
      const row = { '#': idx + 1 };
      const valueMap = {
        item: r.item_name,
        serial: r.serial_number || '-',
        asset: r.asset || '-',
        category: r.category_name || '-',
        returnedBy: r.returned_by || '-',
        email: r.email || '-',
        backup: r.email_backup_done && r.email_closed ? '📧✅ 🔒✅' :
                r.email_backup_done ? '📧✅ 🔒❌' :
                r.email_closed ? '📧❌ 🔒✅' : '📧❌ 🔒❌',
        remarks: r.remarks || '-',
        returnedDate: formatDate(r.returned_date),
      };
      order.forEach(key => {
        if (visibleColumns[key]) row[COLUMN_DEFS[key].label] = valueMap[key];
      });
      return row;
    });
    return { headers, rows };
  };

  const handleExportExcel = (data, filename) => {
    const { headers, rows } = getExportData(data);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
    XLSX.utils.book_append_sheet(wb, ws, 'Returns');
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const handleExportPDF = (data, filename) => {
    const { headers, rows } = getExportData(data);
    const doc = new jsPDF('landscape', 'mm', 'a4');
    doc.setFont('helvetica');
    doc.setFontSize(16);
    doc.text('Item Returns Report', 14, 15);
    const tableData = rows.map(row => Object.values(row));
    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: 25,
      styles: { fontSize: 8, font: 'helvetica' },
      headStyles: { fillColor: [31, 111, 120], font: 'helvetica' },
      margin: { left: 10, right: 10 },
    });
    doc.save(`${filename}.pdf`);
  };

  // ---------- Filtering ----------
  const filteredReturns = returns.filter(r => {
    if (activeCategory && r.type_id !== activeCategory) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      return (
        (r.item_name && r.item_name.toLowerCase().includes(term)) ||
        (r.returned_by && r.returned_by.toLowerCase().includes(term)) ||
        (r.email && r.email.toLowerCase().includes(term)) ||
        (r.serial_number && r.serial_number.toLowerCase().includes(term))
      );
    }
    return true;
  });

  const getReturnCategories = () => {
    const map = {};
    returns.forEach(item => {
      const key = item.type_id || 'uncategorized';
      if (!map[key]) {
        map[key] = {
          id: key,
          name: item.category_name || 'Uncategorized',
          icon: item.type_icon || '📦',
          count: 0,
        };
      }
      map[key].count += 1;
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  };

  const returnCategories = getReturnCategories();

  const categoryTintMap = {};
  returnCategories.forEach((cat, idx) => {
    categoryTintMap[cat.id] = getTint(idx);
  });

  const getCategoryGroups = () => {
    const map = {};
    assignedItems.forEach(item => {
      const key = item.type_id || 'uncategorized';
      if (!map[key]) {
        map[key] = {
          id: key,
          name: item.type_name || 'Uncategorized',
          icon: item.type_icon || '📦',
          count: 0,
        };
      }
      map[key].count += 1;
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  };

  const categories = getCategoryGroups();

  const filteredAssigned = assignedItems.filter(item => {
    if (activeCategory && item.type_id !== activeCategory) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      return (
        item.name.toLowerCase().includes(term) ||
        (item.serial_number && item.serial_number.toLowerCase().includes(term)) ||
        (item.asset && item.asset.toLowerCase().includes(term)) ||
        (item.assigned_to && item.assigned_to.toLowerCase().includes(term)) ||
        (item.employee_id && item.employee_id.toLowerCase().includes(term)) ||
        (item.department && item.department && item.department.toLowerCase().includes(term))
      );
    }
    return true;
  });

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (columnRef.current && !columnRef.current.contains(event.target)) {
        setShowColumnDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ---------- Render functions ----------
  const renderReturnForm = () => (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: INK }}>
          {searchTerm.trim() ? `Assets matching "${searchTerm}"` : 'All Assigned Assets'}
        </h3>
        <span style={{ fontSize: '14px', color: '#8A8371' }}>
          {filteredAssigned.length} assigned {filteredAssigned.length === 1 ? 'asset' : 'assets'}
        </span>
      </div>

      <div style={styles.tableScroll}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Item</th>
              <th style={styles.th}>Serial No</th>
              <th style={styles.th}>Asset</th>
              <th style={styles.th}>Assigned To</th>
              <th style={styles.th}>Employee ID</th>
              <th style={styles.th}>Department</th>
              <th style={styles.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredAssigned.length === 0 ? (
              <tr><td colSpan="7" style={styles.td}>No assigned items found.</td></tr>
            ) : (
              filteredAssigned.map(item => (
                <tr key={item.id} className="gl-row">
                  <td style={{ ...styles.td, fontWeight: 600 }}>{item.name}</td>
                  <td style={{ ...styles.td, fontFamily: "'JetBrains Mono', monospace", fontSize: '12.5px' }}>{item.serial_number || '-'}</td>
                  <td style={styles.td}>{item.asset || '-'}</td>
                  <td style={styles.td}>{item.assigned_to || '-'}</td>
                  <td style={{ ...styles.td, fontFamily: "'JetBrains Mono', monospace", fontSize: '12.5px' }}>{item.employee_id || '-'}</td>
                  <td style={styles.td}>{item.department || '-'}</td>
                  <td style={styles.td}>
                    <button className="gl-btn-primary" style={{ ...styles.btnPrimary, padding: '4px 12px', fontSize: '12px' }} onClick={() => openQuickReturnModal(item)}>
                      <FaUndo size={12} style={{ marginRight: '4px' }} /> Return
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderReturnedAssets = () => {
    const order = ['item', 'serial', 'asset', 'category', 'returnedBy', 'email', 'backup', 'remarks', 'returnedDate'];
    const headers = [<th key="#" style={styles.th}>#</th>];
    order.forEach(key => {
      if (visibleColumns[key]) {
        headers.push(<th key={key} style={styles.th}>{COLUMN_DEFS[key].label}</th>);
      }
    });
    headers.push(<th key="actions" style={{ ...styles.th, textAlign: 'right' }}>Actions</th>);

    const dash = <span style={styles.dash}>-</span>;

    return (
      <div style={styles.tableScroll}>
        <table style={styles.table}>
          <thead>
            <tr>{headers}</tr>
          </thead>
          <tbody>
            {filteredReturns.length === 0 ? (
              <tr><td colSpan={headers.length} style={styles.td}><div style={styles.emptyWrap}><div style={styles.emptyIcon}><FaInbox size={18} /></div>No returned assets found.</div></td></tr>
            ) : (
              filteredReturns.map((r, idx) => {
                const cells = [<td key="num" style={{ ...styles.td, color: '#B9B3A4' }}>{String(idx + 1).padStart(3, '0')}</td>];
                const valueMap = {
                  item: <strong>{r.item_name}</strong>,
                  serial: r.serial_number || dash,
                  asset: r.asset || dash,
                  category: r.category_name || dash,
                  returnedBy: r.returned_by || dash,
                  email: r.email || dash,
                  backup: (
                    <span style={{ fontSize: '13px' }}>
                      {r.email_backup_done ? '📧✅' : '📧❌'} 
                      {' '}
                      {r.email_closed ? '🔒✅' : '🔒❌'}
                    </span>
                  ),
                  remarks: r.remarks || dash,
                  returnedDate: formatDate(r.returned_date),
                };
                order.forEach(key => {
                  if (visibleColumns[key]) {
                    cells.push(<td key={key} style={styles.td}>{valueMap[key]}</td>);
                  }
                });
                cells.push(
                  <td key="actions" style={{ ...styles.td, textAlign: 'right' }}>
                    <div style={styles.actionRow}>
                      <button className="gl-icon-btn gl-icon-view" style={styles.iconBtn} onClick={() => openViewReturn(r)} title="View Details">
                        <FaEye size={12} />
                      </button>
                      <button className="gl-icon-btn gl-icon-print" style={{ ...styles.iconBtn, color: TEAL }} onClick={() => {
                        setViewReturnItem(r);
                        setTimeout(() => handleViewPrint(), 100);
                      }} title="Print Voucher">
                        <FaPrint size={12} />
                      </button>
                    </div>
                  </td>
                );
                return <tr key={r.id} className="gl-row">{cells}</tr>;
              })
            )}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingWrap}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Loading returns…</p>
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
            <div style={styles.mark}><FaUndo size={14} /></div>
            <div>
              <h1 style={styles.brandTitle}>
                {activeTab === 'return' ? 'Return an Item' : 'Returned Assets'}
              </h1>
              <p style={styles.brandSub}>Fauji Foods · Asset returns</p>
            </div>
          </div>

          <div style={styles.headerActions}>
            <div style={styles.searchBox}>
              <FaSearch style={styles.searchIcon} size={12} />
              <input
                type="text"
                placeholder={activeTab === 'return' ? 'Search by employee name, ID, or department…' : 'Search returns…'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={styles.searchInput}
              />
            </div>

            {activeTab === 'return' && (
              <button className="gl-btn-primary" style={{ ...styles.btnPrimary, background: TEAL }} onClick={openReturnModal}>
                <FaUser size={13} style={{ marginRight: '6px' }} /> Bulk Return
              </button>
            )}

            {activeTab === 'returned' && (
              <>
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

                <button style={{ ...styles.iconOnlyBtn, width: 'auto', padding: '0 12px' }} onClick={() => handleExportExcel(filteredReturns, `Item_Returns_${activeTab}`)} title="Export Excel">
                  <FaFileExcel size={13} /> Excel
                </button>
                <button style={{ ...styles.iconOnlyBtn, width: 'auto', padding: '0 12px' }} onClick={() => handleExportPDF(filteredReturns, `Item_Returns_${activeTab}`)} title="Export PDF">
                  <FaFilePdf size={13} /> PDF
                </button>
              </>
            )}
          </div>
        </header>

        {/* Stat strip */}
        <div style={styles.statStrip}>
          <div style={styles.statBlock}>
            <span style={styles.statValue}>{String(assignedItems.length).padStart(3, '0')}</span>
            <span style={styles.statLabel}>Assigned</span>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.statBlock}>
            <span style={styles.statValue}>{String(returns.length).padStart(3, '0')}</span>
            <span style={styles.statLabel}>Returns</span>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.statBlock}>
            <span style={styles.statValue}>{String(returnCategories.length).padStart(2, '0')}</span>
            <span style={styles.statLabel}>Categories</span>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.statBlock}>
            <span style={styles.statValue}>{filteredReturns.length}</span>
            <span style={styles.statLabel}>Matching</span>
          </div>
        </div>

        {/* Category tabs for Returned Assets */}
        {activeTab === 'returned' && returnCategories.length > 0 && (
          <div style={styles.tabRow}>
            <button
              onClick={() => setActiveCategory(null)}
              style={{ ...styles.tabPill, ...(!activeCategory ? styles.tabPillActive : {}) }}
            >
              All Categories
              <span style={{ ...styles.tabCount, ...(!activeCategory ? styles.tabCountActive : {}) }}>{returns.length}</span>
            </button>
            {returnCategories.map(cat => {
              const tint = categoryTintMap[cat.id];
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(isActive ? null : cat.id)}
                  style={{ ...styles.tabPill, ...(isActive ? { ...styles.tabPillActive, background: tint, borderColor: tint } : {}) }}
                >
                  <TagGlyph color={isActive ? '#fff' : tint} />
                  {cat.name}
                  <span style={{ ...styles.tabCount, ...(isActive ? styles.tabCountActive : {}) }}>{cat.count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Tabs */}
        <div style={{ ...styles.tabRow, borderBottom: `2px solid ${INK}`, marginBottom: '20px' }}>
          <button
            onClick={() => { setActiveTab('return'); setActiveCategory(null); setSearchTerm(''); }}
            style={{ ...styles.tabPill, ...(activeTab === 'return' ? styles.tabPillActive : {}), borderBottom: activeTab === 'return' ? `2px solid ${TEAL}` : '2px solid transparent', borderRadius: '0' }}
          >
            <FaPlus size={12} style={{ marginRight: '6px' }} />
            Return an Item
          </button>
          <button
            onClick={() => { setActiveTab('returned'); setActiveCategory(null); setSearchTerm(''); }}
            style={{ ...styles.tabPill, ...(activeTab === 'returned' ? styles.tabPillActive : {}), borderBottom: activeTab === 'returned' ? `2px solid ${TEAL}` : '2px solid transparent', borderRadius: '0' }}
          >
            <FaClipboardList size={12} style={{ marginRight: '6px' }} />
            Returned Assets ({returns.length})
          </button>
        </div>

        {/* Content */}
        <div style={styles.tableCard}>
          {activeTab === 'return' ? renderReturnForm() : renderReturnedAssets()}
        </div>
      </div>

      {/* Return Modal (same as before, unchanged) */}
      {showReturnModal && (
        <div style={styles.overlay} onClick={() => setShowReturnModal(false)}>
          <div style={{ ...styles.modal, maxWidth: '700px' }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {step === 'employee' && 'Find Employee Assets'}
                {step === 'assets' && 'Select Assets to Return'}
                {step === 'return' && 'Confirm Return'}
              </h2>
              <button style={styles.closeBtn} onClick={() => setShowReturnModal(false)}>×</button>
            </div>

            <div style={styles.modalBody}>
              {step === 'employee' && (
                <>
                  <p style={{ fontSize: '13px', color: '#6B6353', marginBottom: '16px' }}>
                    Enter employee details to see all assets assigned to them.
                  </p>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Employee ID</label>
                    <input style={styles.input} type="text" name="employee_id" value={employeeSearch.employee_id} onChange={handleEmployeeSearchChange} placeholder="e.g., FFL-12345" />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Employee Name</label>
                    <input style={styles.input} type="text" name="name" value={employeeSearch.name} onChange={handleEmployeeSearchChange} placeholder="e.g., Zaheer Abbas" />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Department</label>
                    <input style={styles.input} type="text" name="department" value={employeeSearch.department} onChange={handleEmployeeSearchChange} placeholder="e.g., IT, Finance" />
                  </div>
                  <div style={styles.formActions}>
                    <button style={styles.btnCancel} onClick={() => setShowReturnModal(false)}>Cancel</button>
                    <button className="gl-btn-primary" style={styles.btnPrimary} onClick={findEmployeeAssets}>
                      <FaSearch size={12} style={{ marginRight: '6px' }} /> Find Assets
                    </button>
                  </div>
                </>
              )}

              {step === 'assets' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <button className="gl-icon-btn" style={{ ...styles.iconBtn }} onClick={() => setStep('employee')}>
                      <FaArrowLeft size={14} /> Back
                    </button>
                    <div>
                      <button style={styles.tabPill} onClick={selectAllAssets} style={{ padding: '4px 12px', fontSize: '12px', border: '1px solid #DEDACD', borderRadius: '6px', background: 'transparent', cursor: 'pointer' }}>
                        {selectedAssets.length === foundAssets.length ? 'Deselect All' : 'Select All'}
                      </button>
                      <span style={{ marginLeft: '12px', fontSize: '14px', color: '#8A8371' }}>{selectedAssets.length} selected</span>
                    </div>
                  </div>
                  <p style={{ fontSize: '13px', color: '#6B6353', marginBottom: '12px' }}>
                    {foundAssets.length} asset(s) found. Select the ones you want to return.
                  </p>
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {foundAssets.map(item => (
                      <div
                        key={item.id}
                        style={{
                          padding: '10px 14px',
                          border: '1px solid #DEDACD',
                          borderRadius: '8px',
                          marginBottom: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          cursor: 'pointer',
                          background: selectedAssets.find(a => a.id === item.id) ? '#EAF1F4' : '#FAF8F3',
                          borderColor: selectedAssets.find(a => a.id === item.id) ? TEAL : '#DEDACD',
                        }}
                        onClick={() => toggleAssetSelection(item)}
                      >
                        <input
                          type="checkbox"
                          checked={!!selectedAssets.find(a => a.id === item.id)}
                          onChange={() => toggleAssetSelection(item)}
                          style={{ accentColor: TEAL }}
                        />
                        <div>
                          <strong style={{ color: INK }}>{item.name}</strong>
                          <span style={{ marginLeft: '16px', color: '#6B6353', fontSize: '13px' }}>
                            Serial: {item.serial_number || '-'} | Assigned to: {item.assigned_to}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                    <button className="gl-btn-primary" style={styles.btnPrimary} onClick={proceedToReturn}>
                      Return Selected ({selectedAssets.length})
                    </button>
                  </div>
                </>
              )}

              {step === 'return' && (
                <>
                  {!quickReturnItem && (
                    <button className="gl-icon-btn" style={{ ...styles.iconBtn, marginBottom: '12px' }} onClick={() => setStep('assets')}>
                      <FaArrowLeft size={14} /> Back
                    </button>
                  )}
                  <div style={{ background: '#FAF8F3', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                    <p style={{ margin: 0, fontSize: '14px', color: INK }}>
                      <strong>Returning {quickReturnItem ? 1 : selectedAssets.length} item(s):</strong>
                    </p>
                    <ul style={{ margin: '4px 0 0', paddingLeft: '20px', fontSize: '13px', color: '#3A3626' }}>
                      {quickReturnItem ? (
                        <li>{quickReturnItem.name} (Serial: {quickReturnItem.serial_number || '-'})</li>
                      ) : (
                        selectedAssets.map(item => (
                          <li key={item.id}>{item.name} (Serial: {item.serial_number || '-'})</li>
                        ))
                      )}
                    </ul>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Returned By *</label>
                    <input style={styles.input} type="text" name="returned_by" value={returnData.returned_by} onChange={handleReturnChange} placeholder="e.g., Zaheer Abbas" />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Return Date</label>
                    <input style={styles.input} type="date" name="return_date" value={returnData.return_date} onChange={handleReturnChange} />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Email</label>
                    <input style={styles.input} type="email" name="email" value={returnData.email} onChange={handleReturnChange} placeholder="email@domain.com" />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Mobile Number</label>
                    <input style={styles.input} type="text" name="mobile_number" value={returnData.mobile_number} onChange={handleReturnChange} placeholder="03XX-XXXXXXX" />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '12px 0' }}>
                    <input type="checkbox" name="backup_done" checked={returnData.backup_done} onChange={handleReturnChange} id="backupCheck" style={{ accentColor: TEAL }} />
                    <label htmlFor="backupCheck" style={{ fontSize: '13px', fontWeight: 500, color: '#3A3626' }}>Backup Done?</label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '12px 0' }}>
                    <input type="checkbox" name="email_backup_done" checked={returnData.email_backup_done} onChange={handleReturnChange} id="emailBackupCheck" style={{ accentColor: TEAL }} />
                    <label htmlFor="emailBackupCheck" style={{ fontSize: '13px', fontWeight: 500, color: '#3A3626' }}>Email Backup Done?</label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '12px 0' }}>
                    <input type="checkbox" name="email_closed" checked={returnData.email_closed} onChange={handleReturnChange} id="emailClosedCheck" style={{ accentColor: TEAL }} />
                    <label htmlFor="emailClosedCheck" style={{ fontSize: '13px', fontWeight: 500, color: '#3A3626' }}>Email Closed?</label>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Remarks</label>
                    <textarea style={{ ...styles.input, resize: 'vertical', minHeight: '70px' }} name="remarks" value={returnData.remarks} onChange={handleReturnChange} rows="3" placeholder="Any notes…" />
                  </div>
                  <div style={styles.formActions}>
                    <button style={styles.btnCancel} onClick={() => setShowReturnModal(false)}>Cancel</button>
                    <button className="gl-btn-primary" style={styles.btnPrimary} onClick={submitReturn}>Confirm Return</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Print Modal (bulk return) – UPDATED to include new fields */}
      {showPrintModal && returnedItems.length > 0 && (
        <div style={styles.overlay} onClick={() => setShowPrintModal(false)}>
          <div style={{ ...styles.modal, maxWidth: '920px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Asset Return Voucher</h2>
              <button style={styles.closeBtn} onClick={() => setShowPrintModal(false)}>×</button>
            </div>
            <div className="modal-body" ref={printRef} style={styles.modalBody}>
              <div>
                <div style={styles.voucherHeader}>ASSET RETURN VOUCHER</div>
                <div style={styles.voucherDetails}>
                  <div><strong>Department:</strong> {returnedItems[0].department || returnedItems[0].type_name || '-'}</div>
                  <div><strong>Employee ID:</strong> {returnedItems[0].employee_id || '-'}</div>
                  <div><strong>Station:</strong> {returnedItems[0].station || returnedItems[0].location || '-'}</div>
                  <div><strong>Designation:</strong> {returnedItems[0].designation || '-'}</div>
                  <div><strong>Date of Return:</strong> {formatDate(returnedItems[0].return_date)}</div>
                  <div><strong>Email:</strong> {returnedItems[0].email || '-'}</div>
                </div>
                <div style={{ margin: '4px 0 12px', fontSize: '13px' }}>
                  <strong>Backup Done:</strong> {returnedItems[0].backup_done ? '✅ Yes' : '❌ No'}
                  &nbsp;|&nbsp;
                  <strong>Email Backup Done:</strong> {returnedItems[0].email_backup_done ? '✅ Yes' : '❌ No'}
                  &nbsp;|&nbsp;
                  <strong>Email Closed:</strong> {returnedItems[0].email_closed ? '✅ Yes' : '❌ No'}
                </div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: INK, margin: '16px 0 8px' }}>Equipment</h4>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ ...styles.th, width: '60px' }}>Sr.</th>
                      <th style={styles.th}>Items</th>
                      <th style={{ ...styles.th, width: '70px', textAlign: 'center' }}>Qty</th>
                      <th style={styles.th}>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnedItems.map((item, idx) => (
                      <tr key={item.id} className="gl-row">
                        <td style={styles.td}>{idx + 1}</td>
                        <td style={styles.td}>
                          <strong>{item.name}</strong>
                          <br />
                          <span style={{ fontSize: '12px', color: '#6B6353' }}>
                            Serial: {item.serial_number || '-'}
                            {item.specifications && <><br />{item.specifications}</>}
                          </span>
                        </td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>{item.quantity || 1}</td>
                        <td style={styles.td}>
                          {item.remarks || item.notes || ''}
                          {item.asset && <><br /><strong>Asset:</strong> {item.asset}</>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop: '32px' }}></div>
                <div style={styles.voucherFooter}>
                  <div>
                    <strong>Received By</strong>
                    <br />
                    <span style={styles.signatureLine}>
                      Syed Afaq Haider
                    </span>
                  </div>
                  <div>
                    <strong>Returned By</strong>
                    <br />
                    <span style={styles.signatureLine}>
                      {returnedItems[0].returned_by || '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="form-actions no-print" style={{ ...styles.formActions, padding: '14px 20px' }}>
              <button style={styles.btnCancel} onClick={() => setShowPrintModal(false)}>Close</button>
              <button className="gl-btn-primary" style={styles.btnPrimary} onClick={handlePrint}><FaPrint size={12} /> Print</button>
            </div>
          </div>
        </div>
      )}

      {/* View Return Details Modal – UPDATED to use correct fields */}
      {showViewModal && viewReturnItem && (
        <div style={styles.overlay} onClick={() => setShowViewModal(false)}>
          <div style={{ ...styles.modal, maxWidth: '920px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Asset Return Voucher – {viewReturnItem.item_name}</h2>
              <button style={styles.closeBtn} onClick={() => setShowViewModal(false)}>×</button>
            </div>
            <div className="modal-body" ref={viewPrintRef} style={styles.modalBody}>
              <div>
                <div style={styles.voucherHeader}>ASSET RETURN VOUCHER</div>
                <div style={styles.voucherDetails}>
                  <div><strong>Department:</strong> {viewReturnItem.department || viewReturnItem.category_name || '-'}</div>
                  <div><strong>Employee ID:</strong> {viewReturnItem.employee_id || '-'}</div>
                  <div><strong>Station:</strong> {viewReturnItem.station || '-'}</div>
                  <div><strong>Designation:</strong> {viewReturnItem.designation || '-'}</div>
                  <div><strong>Date of Return:</strong> {formatDate(viewReturnItem.return_date)}</div> {/* ✅ use return_date */}
                  <div><strong>Email:</strong> {viewReturnItem.email || '-'}</div>
                </div>
                <div style={{ margin: '4px 0 12px', fontSize: '13px' }}>
                  <strong>Backup Done:</strong> {viewReturnItem.backup_done ? '✅ Yes' : '❌ No'}
                  &nbsp;|&nbsp;
                  <strong>Email Backup Done:</strong> {viewReturnItem.email_backup_done ? '✅ Yes' : '❌ No'}
                  &nbsp;|&nbsp;
                  <strong>Email Closed:</strong> {viewReturnItem.email_closed ? '✅ Yes' : '❌ No'}
                </div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: INK, margin: '16px 0 8px' }}>Equipment</h4>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ ...styles.th, width: '60px' }}>Sr.</th>
                      <th style={styles.th}>Items</th>
                      <th style={{ ...styles.th, width: '70px', textAlign: 'center' }}>Qty</th>
                      <th style={styles.th}>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="gl-row">
                      <td style={styles.td}>1</td>
                      <td style={styles.td}>
                        <strong>{viewReturnItem.item_name}</strong>
                        <br />
                        <span style={{ fontSize: '12px', color: '#6B6353' }}>
                          Serial: {viewReturnItem.serial_number || '-'}
                          {viewReturnItem.specifications && <><br />{viewReturnItem.specifications}</>}
                        </span>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>{viewReturnItem.quantity || 1}</td>
                      <td style={styles.td}>
                        {viewReturnItem.remarks || ''}
                        {viewReturnItem.asset && <><br /><strong>Asset:</strong> {viewReturnItem.asset}</>}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ marginTop: '32px' }}></div>
                <div style={styles.voucherFooter}>
                  <div>
                    <strong>Received By</strong>
                    <br />
                    <span style={styles.signatureLine}>
                      Syed Afaq Haider
                    </span>
                  </div>
                  <div>
                    <strong>Returned By</strong>
                    <br />
                    <span style={styles.signatureLine}>
                      {viewReturnItem.returned_by || '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="form-actions no-print" style={{ ...styles.formActions, padding: '14px 20px' }}>
              <button style={styles.btnCancel} onClick={() => setShowViewModal(false)}>Close</button>
              <button className="gl-btn-primary" style={styles.btnPrimary} onClick={handleViewPrint}><FaPrint size={12} /> Print</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------- Styles ----------
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
  sidebar: {
    width: '220px',
    flexShrink: 0,
    paddingRight: '14px',
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    fontSize: '11px',
    fontWeight: 700,
    color: '#9C9585',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '0 10px',
    marginBottom: '8px',
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
    color: '#3A3626',
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
    color: '#9C9585',
    flexShrink: 0,
  },
  navCountActive: {
    color: 'rgba(255,255,255,0.7)',
  },
  emptyWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '5px',
    padding: '40px 0',
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
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '10px',
  },
  divider: {
    height: '1px',
    background: '#E5E1D3',
    margin: '12px 0',
  },
  voucherHeader: {
    textAlign: 'center',
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: '20px',
    fontWeight: 700,
    color: INK,
    borderBottom: `2px solid ${INK}`,
    paddingBottom: '10px',
    marginBottom: '14px',
  },
  voucherDetails: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '4px 20px',
    fontSize: '13px',
    marginBottom: '14px',
    padding: '0 4px',
  },
  voucherFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '20px',
    paddingTop: '10px',
    borderTop: `1px solid ${INK}`,
  },
  signatureLine: {
    display: 'inline-block',
    borderTop: `1px solid ${INK}`,
    paddingTop: '5px',
    minWidth: '150px',
    marginTop: '6px',
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
  actionRow: {
    display: 'flex',
    gap: '4px',
    justifyContent: 'flex-end',
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
.gl-icon-print:hover { background: #FBF3E3 !important; color: #C08A1E !important; }
.gl-checkbox-row:hover { background: #FAF8F3; }
input[type=text]::placeholder, input[type=email]::placeholder, textarea::placeholder { color: #B9B3A4; }
input:focus, select:focus, textarea:focus { border-color: #1F6F78 !important; box-shadow: 0 0 0 3px rgba(31,111,120,0.12); outline: none; }

@media print {
  .no-print { display: none; }
}
`;

export default AssetReturns;
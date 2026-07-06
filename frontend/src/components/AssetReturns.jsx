import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  FaUndo, FaSearch, FaFileExcel, FaFilePdf, FaPlus, FaPrint, FaTimes,
  FaClipboardList, FaInbox, FaColumns, FaLayerGroup, FaUser, FaArrowLeft
} from 'react-icons/fa';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const API_URL = 'http://localhost:5000';

const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-GB');
};

const COLUMN_DEFS = {
  item: { label: 'Item', always: false },
  serial: { label: 'Serial No', always: false },
  asset: { label: 'Asset', always: false },
  category: { label: 'Category', always: false },
  returnedBy: { label: 'Returned By', always: false },
  email: { label: 'Email', always: false },
  backupDone: { label: 'Backup Done', always: false },
  remarks: { label: 'Remarks', always: false },
  returnedDate: { label: 'Returned Date', always: false },
};

const DEFAULT_VISIBLE = Object.keys(COLUMN_DEFS).reduce((acc, key) => {
  acc[key] = true;
  return acc;
}, {});

const ACCENT = '#4F46E5';
const INK = '#14161F';
const CATEGORY_TINTS = ['#4F46E5', '#0D9488', '#B45309', '#BE185D', '#0369A1', '#4D7C0F', '#7C3AED', '#C2410C'];
const getTint = (index) => CATEGORY_TINTS[index % CATEGORY_TINTS.length];

const AssetReturns = () => {
  const [activeTab, setActiveTab] = useState('return');
  const [returns, setReturns] = useState([]);
  const [assignedItems, setAssignedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);
  
  // ---------- Single Return Modal State ----------
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [step, setStep] = useState('employee'); // 'employee' | 'assets' | 'return'
  const [employeeSearch, setEmployeeSearch] = useState({
    employee_id: '',
    name: '',
    department: '',
  });
  const [foundAssets, setFoundAssets] = useState([]);
  const [selectedAssets, setSelectedAssets] = useState([]); // multiple items
  const [returnData, setReturnData] = useState({
    returned_by: '',
    return_date: new Date().toISOString().split('T')[0],
    email: '',
    mobile_number: '',
    backup_done: false,
    remarks: '',
  });

  // ---------- Print Modal ----------
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [returnedItems, setReturnedItems] = useState([]);
  const printRef = useRef();

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
    setReturnData({
      returned_by: '',
      return_date: new Date().toISOString().split('T')[0],
      email: '',
      mobile_number: '',
      backup_done: false,
      remarks: '',
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
    // Pre-select all by default? We'll let user choose.
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

  const submitReturn = async () => {
    if (selectedAssets.length === 0) {
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
      };

      // Return each selected asset
      const results = [];
      for (const item of selectedAssets) {
        const response = await axios.post(`${API_URL}/api/inventory/return`, {
          item_id: item.id,
          ...payload,
        });
        results.push({
          ...item,
          ...returnData,
          return_date: returnData.return_date,
          returned_by: returnData.returned_by,
        });
      }

      alert(`${results.length} item(s) returned successfully!`);
      setReturnedItems(results);
      setShowReturnModal(false);
      setShowPrintModal(true);
      
      // Refresh data
      fetchAssignedItems();
      fetchReturns();
      setTimeout(() => setActiveTab('history'), 500);
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
        <head><title>Return Voucher</title>
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

  // ---------- Export Functions (History) ----------
  const getExportData = () => {
    const order = ['item', 'serial', 'asset', 'category', 'returnedBy', 'email', 'backupDone', 'remarks', 'returnedDate'];
    const headers = ['#'];
    order.forEach(key => {
      if (visibleColumns[key]) headers.push(COLUMN_DEFS[key].label);
    });
    const rows = filteredReturns.map((r, idx) => {
      const row = { '#': idx + 1 };
      const valueMap = {
        item: r.item_name,
        serial: r.serial_number || '-',
        asset: r.asset || '-',
        category: r.category_name || '-',
        returnedBy: r.returned_by || '-',
        email: r.email || '-',
        backupDone: r.backup_done ? 'Yes' : 'No',
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

  const handleExportExcel = () => {
    const { headers, rows } = getExportData();
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
    XLSX.utils.book_append_sheet(wb, ws, 'Returns');
    XLSX.writeFile(wb, 'Item_Returns.xlsx');
  };

  const handleExportPDF = () => {
    const { headers, rows } = getExportData();
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
      headStyles: { fillColor: [79, 70, 229], font: 'helvetica' },
      margin: { left: 10, right: 10 },
    });
    doc.save('Item_Returns.pdf');
  };

  // ---------- Filtering ----------
  const filteredReturns = returns.filter(r =>
    r.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.returned_by && r.returned_by.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (r.email && r.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (r.serial_number && r.serial_number.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // ---- Category groups for sidebar ----
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

  const categoryTintMap = {};
  categories.forEach((cat, idx) => {
    categoryTintMap[cat.id] = getTint(idx);
  });

  // ---- Filter assigned items by category and search ----
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

  // ---------- Close dropdown on outside click ----------
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (columnRef.current && !columnRef.current.contains(event.target)) {
        setShowColumnDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ---------- Render Return Form (with sidebar) ----------
  const renderReturnForm = () => (
    <div style={{ display: 'flex', gap: '20px' }}>
      <aside style={{ ...styles.sidebar, width: '200px', flexShrink: 0, borderRight: '1px solid #EAEAEE', paddingRight: '14px' }}>
        <div style={{ ...styles.sidebarHeader, marginBottom: '8px' }}>
          <FaLayerGroup size={12} color="#9CA3AF" />
          <span>Categories</span>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <button
            onClick={() => setActiveCategory(null)}
            style={{ ...styles.navItem, ...(!activeCategory ? styles.navItemActive : {}) }}
          >
            <span style={styles.navLabel}>All items</span>
            <span style={{ ...styles.navCount, ...(!activeCategory ? styles.navCountActive : {}) }}>{assignedItems.length}</span>
          </button>
          {categories.map(cat => {
            const tint = categoryTintMap[cat.id];
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(isActive ? null : cat.id)}
                style={{ ...styles.navItem, ...(isActive ? styles.navItemActive : {}) }}
              >
                <span style={styles.navLabel}>
                  <span style={{ ...styles.navDot, background: isActive ? '#fff' : tint }} />
                  {cat.name}
                </span>
                <span style={{ ...styles.navCount, ...(isActive ? styles.navCountActive : {}) }}>{cat.count}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#111827' }}>
            {searchTerm.trim() ? `Assets matching "${searchTerm}"` : 'All Assigned Assets'}
          </h3>
          <span style={{ fontSize: '14px', color: '#6B7280' }}>
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
              </tr>
            </thead>
            <tbody>
              {filteredAssigned.length === 0 ? (
                <tr><td colSpan="6" style={styles.td}>No assigned items found.</td></tr>
              ) : (
                filteredAssigned.map(item => (
                  <tr key={item.id} className="gl-row">
                    <td style={styles.td}><strong>{item.name}</strong></td>
                    <td style={styles.td}>{item.serial_number || '-'}</td>
                    <td style={styles.td}>{item.asset || '-'}</td>
                    <td style={styles.td}>{item.assigned_to || '-'}</td>
                    <td style={styles.td}>{item.employee_id || '-'}</td>
                    <td style={styles.td}>{item.department || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderHistory = () => {
    const order = ['item', 'serial', 'asset', 'category', 'returnedBy', 'email', 'backupDone', 'remarks', 'returnedDate'];
    const headers = [<th key="#" style={styles.th}>#</th>];
    order.forEach(key => {
      if (visibleColumns[key]) {
        headers.push(<th key={key} style={styles.th}>{COLUMN_DEFS[key].label}</th>);
      }
    });

    const dash = <span style={{ color: '#D1D5DB' }}>-</span>;

    return (
      <div style={styles.tableScroll}>
        <table style={styles.table}>
          <thead>
            <tr>{headers}</tr>
          </thead>
          <tbody>
            {filteredReturns.length === 0 ? (
              <tr><td colSpan={headers.length} style={styles.td}><div style={styles.emptyWrap}><div style={styles.emptyIcon}><FaInbox size={18} /></div>No returns found.</div></td></tr>
            ) : (
              filteredReturns.map((r, idx) => {
                const cells = [<td key="num" style={styles.td}>{idx + 1}</td>];
                const valueMap = {
                  item: <strong>{r.item_name}</strong>,
                  serial: r.serial_number || dash,
                  asset: r.asset || dash,
                  category: r.category_name || dash,
                  returnedBy: r.returned_by || dash,
                  email: r.email || dash,
                  backupDone: r.backup_done ? '✅ Yes' : '❌ No',
                  remarks: r.remarks || dash,
                  returnedDate: formatDate(r.returned_date),
                };
                order.forEach(key => {
                  if (visibleColumns[key]) {
                    cells.push(<td key={key} style={styles.td}>{valueMap[key]}</td>);
                  }
                });
                return <tr key={r.id} className="gl-row">{cells}</tr>;
              })
            )}
          </tbody>
        </table>
      </div>
    );
  };

  // ---------- Loading State ----------
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
      <div style={styles.shell}>
        <main style={{ ...styles.main, paddingBottom: '40px' }}>
          <div style={styles.mainHeader}>
            <div>
              <h1 style={styles.listTitle}>
                <FaUndo style={{ marginRight: '10px' }} />
                Asset Returns
              </h1>
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
                <button className="gl-btn-primary" style={{ ...styles.btnPrimary, background: '#0D9488' }} onClick={openReturnModal}>
                  <FaUser size={13} style={{ marginRight: '6px' }} /> Return Equipment
                </button>
              )}

              {activeTab === 'history' && (
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
              )}

              {activeTab === 'history' && (
                <>
                  <button style={{ ...styles.iconOnlyBtn, width: 'auto', padding: '0 12px' }} onClick={handleExportExcel} title="Export Excel">
                    <FaFileExcel size={13} /> Excel
                  </button>
                  <button style={{ ...styles.iconOnlyBtn, width: 'auto', padding: '0 12px' }} onClick={handleExportPDF} title="Export PDF">
                    <FaFilePdf size={13} /> PDF
                  </button>
                </>
              )}
            </div>
          </div>

          <div style={styles.tabsContainer}>
            <button
              onClick={() => { setActiveTab('return'); setSearchTerm(''); setActiveCategory(null); }}
              style={{
                ...styles.tab,
                color: activeTab === 'return' ? ACCENT : '#6B7280',
                borderBottom: activeTab === 'return' ? `2px solid ${ACCENT}` : '2px solid transparent',
              }}
            >
              <FaPlus size={12} style={{ marginRight: '6px' }} />
              Return an Item
            </button>
            <button
              onClick={() => { setActiveTab('history'); setSearchTerm(''); }}
              style={{
                ...styles.tab,
                color: activeTab === 'history' ? ACCENT : '#6B7280',
                borderBottom: activeTab === 'history' ? `2px solid ${ACCENT}` : '2px solid transparent',
              }}
            >
              <FaClipboardList size={12} style={{ marginRight: '6px' }} />
              Returns History ({returns.length})
            </button>
          </div>

          <div style={styles.tableCard}>
            {activeTab === 'return' ? renderReturnForm() : renderHistory()}
          </div>
        </main>
      </div>

      {/* ===== SINGLE RETURN MODAL ===== */}
      {showReturnModal && (
        <div className="modal-overlay" onClick={() => setShowReturnModal(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', background: '#fff', borderRadius: '12px', padding: '20px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 600 }}>
                {step === 'employee' && 'Find Employee Assets'}
                {step === 'assets' && 'Select Assets to Return'}
                {step === 'return' && 'Confirm Return'}
              </h2>
              <button className="close-btn" onClick={() => setShowReturnModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>
                <FaTimes />
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              {step === 'employee' && (
                <>
                  <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '16px' }}>
                    Enter employee details to see all assets assigned to them.
                  </p>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Employee ID</label>
                    <input
                      type="text"
                      name="employee_id"
                      value={employeeSearch.employee_id}
                      onChange={handleEmployeeSearchChange}
                      style={styles.input}
                      placeholder="e.g., FFL-12345"
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Employee Name</label>
                    <input
                      type="text"
                      name="name"
                      value={employeeSearch.name}
                      onChange={handleEmployeeSearchChange}
                      style={styles.input}
                      placeholder="e.g., Zaheer Abbas"
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Department</label>
                    <input
                      type="text"
                      name="department"
                      value={employeeSearch.department}
                      onChange={handleEmployeeSearchChange}
                      style={styles.input}
                      placeholder="e.g., IT, Finance"
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button className="btn-cancel" style={{ padding: '8px 20px', background: 'transparent', border: '1px solid #D1D5DB', borderRadius: '6px', cursor: 'pointer' }} onClick={() => setShowReturnModal(false)}>Cancel</button>
                    <button className="btn-submit" style={{ padding: '8px 20px', background: ACCENT, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }} onClick={findEmployeeAssets}>
                      <FaSearch style={{ marginRight: '6px' }} /> Find Assets
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
                      <button style={{ padding: '4px 12px', fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px', background: 'transparent', cursor: 'pointer' }} onClick={selectAllAssets}>
                        {selectedAssets.length === foundAssets.length ? 'Deselect All' : 'Select All'}
                      </button>
                      <span style={{ marginLeft: '12px', fontSize: '14px', color: '#6B7280' }}>{selectedAssets.length} selected</span>
                    </div>
                  </div>
                  <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '12px' }}>
                    {foundAssets.length} asset(s) found. Select the ones you want to return.
                  </p>
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {foundAssets.map(item => (
                      <div
                        key={item.id}
                        style={{
                          padding: '10px 14px',
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px',
                          marginBottom: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          cursor: 'pointer',
                          background: selectedAssets.find(a => a.id === item.id) ? '#EEF2FF' : '#FAFAFB',
                          borderColor: selectedAssets.find(a => a.id === item.id) ? ACCENT : '#E5E7EB',
                        }}
                        onClick={() => toggleAssetSelection(item)}
                      >
                        <input
                          type="checkbox"
                          checked={!!selectedAssets.find(a => a.id === item.id)}
                          onChange={() => toggleAssetSelection(item)}
                          style={{ accentColor: ACCENT }}
                        />
                        <div>
                          <strong>{item.name}</strong>
                          <span style={{ marginLeft: '16px', color: '#6B7280', fontSize: '14px' }}>
                            Serial: {item.serial_number || '-'} | Assigned to: {item.assigned_to}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                    <button className="btn-submit" style={{ padding: '8px 20px', background: ACCENT, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }} onClick={proceedToReturn}>
                      Return Selected ({selectedAssets.length})
                    </button>
                  </div>
                </>
              )}

              {step === 'return' && (
                <>
                  <button className="gl-icon-btn" style={{ ...styles.iconBtn, marginBottom: '12px' }} onClick={() => setStep('assets')}>
                    <FaArrowLeft size={14} /> Back
                  </button>
                  <div style={{ background: '#F9FAFB', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                    <p style={{ margin: 0, fontSize: '14px', color: '#4B5563' }}>
                      <strong>Returning {selectedAssets.length} item(s):</strong>
                    </p>
                    <ul style={{ margin: '4px 0 0', paddingLeft: '20px', fontSize: '13px', color: '#4B5563' }}>
                      {selectedAssets.map(item => (
                        <li key={item.id}>{item.name} (Serial: {item.serial_number || '-'})</li>
                      ))}
                    </ul>
                  </div>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Returned By *</label>
                    <input type="text" name="returned_by" value={returnData.returned_by} onChange={handleReturnChange} style={styles.input} placeholder="e.g., Zaheer Abbas" />
                  </div>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Return Date</label>
                    <input type="date" name="return_date" value={returnData.return_date} onChange={handleReturnChange} style={styles.input} />
                  </div>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Email</label>
                    <input type="email" name="email" value={returnData.email} onChange={handleReturnChange} style={styles.input} placeholder="email@domain.com" />
                  </div>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Mobile Number</label>
                    <input type="text" name="mobile_number" value={returnData.mobile_number} onChange={handleReturnChange} style={styles.input} placeholder="03XX-XXXXXXX" />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '12px 0' }}>
                    <input type="checkbox" name="backup_done" checked={returnData.backup_done} onChange={handleReturnChange} id="backupCheck" style={{ accentColor: ACCENT }} />
                    <label htmlFor="backupCheck">Backup Done?</label>
                  </div>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Remarks</label>
                    <textarea name="remarks" value={returnData.remarks} onChange={handleReturnChange} rows="3" style={{ ...styles.input, resize: 'vertical' }} placeholder="Any notes..." />
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                    <button className="btn-cancel" style={{ padding: '8px 20px', background: 'transparent', border: '1px solid #D1D5DB', borderRadius: '6px', cursor: 'pointer' }} onClick={() => setStep('assets')}>Cancel</button>
                    <button className="btn-submit" style={{ padding: '8px 20px', background: ACCENT, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }} onClick={submitReturn}>
                      Confirm Return All
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {showPrintModal && returnedItems.length > 0 && (
        <div className="modal-overlay" onClick={() => setShowPrintModal(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', background: '#fff', borderRadius: '12px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #E5E7EB' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 600 }}>📄 Return Voucher</h2>
              <button className="close-btn" onClick={() => setShowPrintModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-body" ref={printRef} style={{ padding: '20px' }}>
              <div className="voucher-content">
                <div className="header" style={{ textAlign: 'center', fontSize: '24px', fontWeight: 'bold', borderBottom: '2px solid #000', paddingBottom: '10px' }}>RETURN VOUCHER</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', margin: '10px 0' }}>
                  <div><strong>Returned By:</strong> {returnedItems[0].returned_by}</div>
                  <div><strong>Return Date:</strong> {formatDate(returnedItems[0].return_date)}</div>
                  <div><strong>Email:</strong> {returnedItems[0].email || '-'}</div>
                  <div><strong>Mobile:</strong> {returnedItems[0].mobile_number || '-'}</div>
                </div>
                <div style={{ margin: '5px 0' }}>
                  <strong>Backup Done:</strong> {returnedItems[0].backup_done ? '✅ Yes' : '❌ No'}
                </div>
                {returnedItems[0].remarks && (
                  <div style={{ margin: '5px 0' }}><strong>Remarks:</strong> {returnedItems[0].remarks}</div>
                )}
                <hr />
                <h4>Returned Items</h4>
                <table className="items-table" style={{ width: '100%', borderCollapse: 'collapse', margin: '10px 0' }}>
                  <thead>
                    <tr>
                      <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>#</th>
                      <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>Item</th>
                      <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>Serial No</th>
                      <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>Asset</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnedItems.map((item, idx) => (
                      <tr key={item.id}>
                        <td style={{ border: '1px solid #000', padding: '8px' }}>{idx + 1}</td>
                        <td style={{ border: '1px solid #000', padding: '8px' }}>{item.name}</td>
                        <td style={{ border: '1px solid #000', padding: '8px' }}>{item.serial_number || '-'}</td>
                        <td style={{ border: '1px solid #000', padding: '8px' }}>{item.asset || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between' }}>
                  <div><strong>Returned By</strong><br /><span style={{ borderTop: '1px solid #000', display: 'inline-block', paddingTop: '5px', minWidth: '150px' }}>{returnedItems[0].returned_by}</span></div>
                  <div><strong>Received By (System)</strong><br /><span style={{ borderTop: '1px solid #000', display: 'inline-block', paddingTop: '5px', minWidth: '150px' }}>Inventory</span></div>
                </div>
              </div>
            </div>
            <div className="form-actions no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 20px', borderTop: '1px solid #E5E7EB' }}>
              <button className="btn-cancel" onClick={() => setShowPrintModal(false)}>Close</button>
              <button className="btn-primary" style={{ ...styles.btnPrimary }} onClick={handlePrint}><FaPrint /> Print</button>
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
    background: '#F6F6F8',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  shell: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0',
    minHeight: '100vh',
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
  tabsContainer: {
    display: 'flex',
    gap: '0',
    borderBottom: '2px solid #E5E7EB',
    marginBottom: '20px',
  },
  tab: {
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: 600,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    transition: 'all 0.2s',
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
    color: '#9CA3AF',
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
    background: '#F3F4F6',
    color: '#9CA3AF',
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
    border: '3px solid #E5E7EB',
    borderTopColor: ACCENT,
    borderRadius: '50%',
    animation: 'gl-spin 0.8s linear infinite',
  },
  loadingText: { color: '#6B7280', fontSize: '14px', margin: 0 },
};

const sheet = `
@keyframes gl-spin { to { transform: rotate(360deg); } }
.gl-row { transition: background 0.12s ease; }
.gl-row:hover { background: #FAFAFB; }
.gl-btn-primary { transition: opacity 0.15s ease; }
.gl-btn-primary:hover { opacity: 0.9; }
.gl-icon-btn { transition: all 0.12s ease; }
input[type=text]::placeholder { color: #9CA3AF; }
input:focus { border-color: #4F46E5 !important; box-shadow: 0 0 0 3px rgba(79,70,229,0.12); }
`;

export default AssetReturns;
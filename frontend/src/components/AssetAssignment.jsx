import React, { useState, useEffect, useRef } from 'react';
import { 
  FaClipboardCheck, FaSearch, FaPlus, FaPrint, FaEye, FaEdit, FaTrash, FaUndo, 
  FaColumns, FaFileExport, FaLayerGroup, FaInbox
} from 'react-icons/fa';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExportDropdown from './ExportDropdown';

// ---------- Helpers ----------
const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-GB');
};

// All column definitions (for assignment view)
const COLUMN_DEFS = {
  category: { label: 'Category', always: false },
  equipment: { label: 'Equipment', always: false },
  brand: { label: 'Brand', always: false },
  model: { label: 'Model', always: false },
  serial: { label: 'S/N', always: false },
  asset: { label: 'Asset', always: false },
  assignedTo: { label: 'Assigned To', always: false },
  department: { label: 'Department', always: false },
  location: { label: 'Location', always: false },
  employeeId: { label: 'Employee ID', always: false },
  designation: { label: 'Designation', always: false },
  dateOfIssuance: { label: 'Date of Issuance', always: false },
  email: { label: 'Email', always: false },
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

const CONDITION_STYLES = {
  New: { bg: '#ECFDF5', text: '#047857', dot: '#10B981' },
  Refurbed: { bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6' },
  Damaged: { bg: '#FEF2F2', text: '#B91C1C', dot: '#EF4444' },
  Used: { bg: '#F9FAFB', text: '#4B5563', dot: '#9CA3AF' },
  Condemned: { bg: '#FEF2F2', text: '#7F1D1D', dot: '#7F1D1D' },
};

const CONDITIONS = ['New', 'Refurbed', 'Damaged', 'Used', 'Condemned'];

const AssetAssignment = ({ 
  items, 
  loading, 
  onAssign, 
  onUnassign, 
  onEdit, 
  onView, 
  onReturn,
  types = [] 
}) => {
  // ---------- Local state ----------
  const [searchTerm, setSearchTerm] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [voucherItem, setVoucherItem] = useState(null);
  const [modalConditionFilter, setModalConditionFilter] = useState('');
  const [modalCategoryFilter, setModalCategoryFilter] = useState('all');
  const printRef = useRef();
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const exportRef = useRef(null);
  const [activeTab, setActiveTab] = useState(null);
  const [conditionFilter, setConditionFilter] = useState('');

  const [voucherData, setVoucherData] = useState({
    issued_by: '',
    received_by: '',
    department: '',
    station: '',
    employee_id: '',
    designation: '',
    date_of_issuance: new Date().toISOString().split('T')[0],
    email: ''
  });

  const [editData, setEditData] = useState({
    assigned_to: '',
    location: '',
    department: '',
    station: '',
    issued_by: '',
    employee_id: '',
    designation: '',
    date_of_issuance: '',
    email: ''
  });

  // ---------- Column Visibility ----------
  const getDefaultVisible = () => {
    const stored = localStorage.getItem('assignment_columns');
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
    localStorage.setItem('assignment_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const toggleColumn = (key) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const availableColumns = Object.keys(COLUMN_DEFS);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowColumnDropdown(false);
      }
      if (exportRef.current && !exportRef.current.contains(event.target)) {
        setShowExportDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ---------- Split items ----------
  const assignedItems = items.filter(item => item.assigned_to && item.assigned_to.trim() !== '');
  const unassignedItems = items.filter(item => !item.assigned_to || item.assigned_to.trim() === '');

  // ---------- Categories for sidebar ----------
  const getCategoryGroups = (itemsList) => {
    const groups = {};
    itemsList.forEach(item => {
      const key = item.type_id || 'uncategorized';
      if (!groups[key]) {
        groups[key] = {
          id: key,
          name: item.type_name || 'Uncategorized',
          icon: item.type_icon || '📦',
          count: 0,
        };
      }
      groups[key].count += 1;
    });
    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  };

  const categoryGroups = getCategoryGroups(assignedItems);

  // Map tints to categories
  const categoryTintMap = {};
  categoryGroups.forEach((cat, idx) => {
    categoryTintMap[cat.id] = getTint(idx);
  });

  // ---------- Filter assigned items ----------
  const getFilteredAssigned = () => {
    let filtered = assignedItems;
    if (activeTab) {
      filtered = filtered.filter(item => item.type_id === activeTab);
    }
    if (conditionFilter) {
      filtered = conditionFilter === 'empty'
        ? filtered.filter(item => !item.condition || item.condition === '')
        : filtered.filter(item => item.condition === conditionFilter);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(term) ||
        (item.brand && item.brand.toLowerCase().includes(term)) ||
        (item.model && item.model.toLowerCase().includes(term)) ||
        (item.assigned_to && item.assigned_to.toLowerCase().includes(term)) ||
        (item.department && item.department.toLowerCase().includes(term)) ||
        (item.employee_id && item.employee_id.toLowerCase().includes(term)) ||
        (item.designation && item.designation.toLowerCase().includes(term)) ||
        (item.email && item.email.toLowerCase().includes(term))
      );
    }
    return filtered;
  };

  const filteredAssigned = getFilteredAssigned();

  // ---------- Modal unassigned filter ----------
  const filteredUnassigned = unassignedItems.filter(item => {
    const searchMatch = 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.brand && item.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.model && item.model.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.serial_number && item.serial_number.toLowerCase().includes(searchTerm.toLowerCase()));
    let conditionMatch = true;
    if (modalConditionFilter) {
      conditionMatch = (item.condition || '') === modalConditionFilter;
    }
    let categoryMatch = true;
    if (modalCategoryFilter !== 'all') {
      categoryMatch = item.type_id === parseInt(modalCategoryFilter);
    }
    return searchMatch && conditionMatch && categoryMatch;
  });

  // ---------- Export (Excel/PDF) ----------
  const getExportData = () => {
    const headers = [];
    const dataKeys = [];
    headers.push('#');
    dataKeys.push('num');
    const order = ['category', 'equipment', 'brand', 'model', 'serial', 'asset', 'assignedTo', 'department', 'location', 'employeeId', 'designation', 'dateOfIssuance', 'email'];
    order.forEach(key => {
      if (visibleColumns[key]) {
        headers.push(COLUMN_DEFS[key].label);
        dataKeys.push(key);
      }
    });

    const rows = filteredAssigned.map((item, idx) => {
      const row = { num: idx + 1 };
      const valueMap = {
        category: item.type_name || '',
        equipment: item.name || '',
        brand: item.brand || '',
        model: item.model || '',
        serial: item.serial_number || '',
        asset: item.asset || '',
        assignedTo: item.assigned_to || '',
        department: item.department || '',
        location: item.location || '',
        employeeId: item.employee_id || '',
        designation: item.designation || '',
        dateOfIssuance: formatDate(item.date_of_issuance),
        email: item.email || '',
      };
      order.forEach(key => {
        if (visibleColumns[key]) {
          row[key] = valueMap[key];
        }
      });
      return row;
    });
    return { headers, data: rows };
  };

  const handleExportExcel = () => {
    setShowExportDropdown(false);
    const { headers, data } = getExportData();
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data, { header: headers });
    XLSX.utils.book_append_sheet(wb, ws, 'Assigned Assets');
    const groups = getCategoryGroups(filteredAssigned);
    groups.forEach(group => {
      const groupData = group.items.map((item, idx) => {
        const row = { num: idx + 1 };
        const valueMap = {
          category: item.type_name || '',
          equipment: item.name || '',
          brand: item.brand || '',
          model: item.model || '',
          serial: item.serial_number || '',
          asset: item.asset || '',
          assignedTo: item.assigned_to || '',
          department: item.department || '',
          location: item.location || '',
          employeeId: item.employee_id || '',
          designation: item.designation || '',
          dateOfIssuance: formatDate(item.date_of_issuance),
          email: item.email || '',
        };
        const order = ['category', 'equipment', 'brand', 'model', 'serial', 'asset', 'assignedTo', 'department', 'location', 'employeeId', 'designation', 'dateOfIssuance', 'email'];
        order.forEach(key => {
          if (visibleColumns[key]) {
            row[key] = valueMap[key];
          }
        });
        return row;
      });
      const wsGroup = XLSX.utils.json_to_sheet(groupData, { header: headers });
      let sheetName = group.name.slice(0, 31);
      sheetName = sheetName.replace(/[\\/*?:[\]]/g, '');
      XLSX.utils.book_append_sheet(wb, wsGroup, sheetName);
    });
    XLSX.writeFile(wb, 'Asset_Assignment.xlsx');
  };

  const handleExportPDF = () => {
    setShowExportDropdown(false);
    const doc = new jsPDF('landscape', 'mm', 'a4');
    doc.setFont('helvetica');
    const { headers, data } = getExportData();
    const groups = getCategoryGroups(filteredAssigned);

    const drawCategory = (group, startY) => {
      doc.setFontSize(16);
      doc.text(`${group.name} (${group.items.length} items)`, 14, startY);
      const yAfterTitle = startY + 8;

      const tableData = group.items.map((item, idx) => {
        const row = [];
        row.push(idx + 1);
        const order = ['category', 'equipment', 'brand', 'model', 'serial', 'asset', 'assignedTo', 'department', 'location', 'employeeId', 'designation', 'dateOfIssuance', 'email'];
        const valueMap = {
          category: item.type_name || '',
          equipment: item.name || '',
          brand: item.brand || '',
          model: item.model || '',
          serial: item.serial_number || '',
          asset: item.asset || '',
          assignedTo: item.assigned_to || '',
          department: item.department || '',
          location: item.location || '',
          employeeId: item.employee_id || '',
          designation: item.designation || '',
          dateOfIssuance: formatDate(item.date_of_issuance),
          email: item.email || '',
        };
        order.forEach(key => {
          if (visibleColumns[key]) {
            row.push(valueMap[key]);
          }
        });
        return row;
      });

      const tableHeaders = ['#'];
      const order = ['category', 'equipment', 'brand', 'model', 'serial', 'asset', 'assignedTo', 'department', 'location', 'employeeId', 'designation', 'dateOfIssuance', 'email'];
      order.forEach(key => {
        if (visibleColumns[key]) {
          tableHeaders.push(COLUMN_DEFS[key].label);
        }
      });

      autoTable(doc, {
        head: [tableHeaders],
        body: tableData,
        startY: yAfterTitle,
        styles: { fontSize: 8, font: 'helvetica' },
        headStyles: { fillColor: [79, 70, 229], font: 'helvetica' },
        margin: { left: 10, right: 10 },
      });
      return doc.lastAutoTable.finalY + 10;
    };

    groups.forEach((group, index) => {
      if (index > 0) doc.addPage();
      drawCategory(group, 15);
    });

    if (groups.length === 0) {
      doc.text('No assigned assets', 14, 15);
    }
    doc.save('Asset_Assignment.pdf');
  };

  // ---------- Assignment Modal ----------
  const openAssignModal = () => {
    setShowAssignModal(true);
    setSelectedItem(null);
    setModalConditionFilter('');
    setModalCategoryFilter('all');
    setVoucherData({
      issued_by: '',
      received_by: '',
      department: '',
      station: '',
      employee_id: '',
      designation: '',
      date_of_issuance: new Date().toISOString().split('T')[0],
      email: ''
    });
  };
  const closeAssignModal = () => {
    setShowAssignModal(false);
    setSelectedItem(null);
  };

  const handleSelectUnassignedItem = (item) => {
    setSelectedItem(item);
    setVoucherData(prev => ({
      ...prev,
      station: item.location || '',
      department: item.department || item.type_name || '',
      email: item.email || ''
    }));
  };

  const handleVoucherChange = (e) => {
    setVoucherData({ ...voucherData, [e.target.name]: e.target.value });
  };

  const handleAssignSubmit = () => {
    if (!selectedItem) {
      alert('Please select an asset first');
      return;
    }
    if (!voucherData.received_by.trim()) {
      alert('Please enter the Received By (person/department)');
      return;
    }
    if (!voucherData.issued_by.trim()) {
      alert('Please enter the Issued By');
      return;
    }

    const assignPayload = {
      ...selectedItem,
      assigned_to: voucherData.received_by,
      location: voucherData.station || selectedItem.location,
      issued_by: voucherData.issued_by,
      department: voucherData.department,
      station: voucherData.station,
      employee_id: voucherData.employee_id,
      designation: voucherData.designation,
      date_of_issuance: voucherData.date_of_issuance,
      email: voucherData.email
    };

    onAssign(selectedItem.id, assignPayload);

    setVoucherItem({
      ...selectedItem,
      assigned_to: voucherData.received_by,
      location: voucherData.station || selectedItem.location,
      issued_by: voucherData.issued_by,
      department: voucherData.department,
      station: voucherData.station,
      employee_id: voucherData.employee_id,
      designation: voucherData.designation,
      date_of_issuance: voucherData.date_of_issuance,
      email: voucherData.email
    });

    closeAssignModal();
    setShowVoucherModal(true);
  };

  // ---- Edit Modal ----
  const openEditModal = (item) => {
    setSelectedItem(item);
    setEditData({
      assigned_to: item.assigned_to || '',
      location: item.location || '',
      department: item.department || '',
      station: item.station || '',
      issued_by: item.issued_by || '',
      employee_id: item.employee_id || '',
      designation: item.designation || '',
      date_of_issuance: item.date_of_issuance || '',
      email: item.email || ''
    });
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setSelectedItem(null);
  };

  const handleEditChange = (e) => {
    setEditData({ ...editData, [e.target.name]: e.target.value });
  };

  const handleEditSubmit = () => {
    if (!selectedItem) return;
    if (!editData.assigned_to.trim()) {
      alert('Assigned To is required');
      return;
    }
    const updatePayload = {
      ...selectedItem,
      assigned_to: editData.assigned_to,
      location: editData.location,
      department: editData.department,
      station: editData.station,
      issued_by: editData.issued_by,
      employee_id: editData.employee_id,
      designation: editData.designation,
      date_of_issuance: editData.date_of_issuance,
      email: editData.email
    };
    onEdit(selectedItem.id, updatePayload);
    closeEditModal();
  };

  // ---- Voucher ----
  const openVoucher = (item) => {
    setVoucherItem(item);
    setShowVoucherModal(true);
  };

  const handlePrint = () => {
    const printContent = printRef.current.innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
        <head><title>Asset Voucher</title>
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
        <body>${printContent}<script>window.onload = function() { window.print(); }<\/script></body>
      </html>
    `);
    win.document.close();
  };

  // ---------- Render Helpers (matching InventoryList) ----------
  const getConditionBadge = (condition) => {
    if (!condition) return <span style={{ color: '#D1D5DB' }}>-</span>;
    const c = CONDITION_STYLES[condition];
    if (!c) return condition;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 9px', borderRadius: '6px', background: c.bg, color: c.text, fontSize: '11.5px', fontWeight: 600 }}>
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: c.dot }} />
        {condition}
      </span>
    );
  };

  const renderHeaders = () => {
    const headers = [<th key="#" style={styles.th}>#</th>];
    const order = ['category', 'equipment', 'brand', 'model', 'serial', 'asset', 'assignedTo', 'department', 'location', 'employeeId', 'designation', 'dateOfIssuance', 'email'];
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
    const order = ['category', 'equipment', 'brand', 'model', 'serial', 'asset', 'assignedTo', 'department', 'location', 'employeeId', 'designation', 'dateOfIssuance', 'email'];
    const tint = categoryTintMap[item.type_id] || '#6B7280';
    const dash = <span style={{ color: '#D1D5DB' }}>-</span>;
    const valueMap = {
      category: <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: '#4B5563' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: tint }} />
                  {item.type_name}
                </span>,
      equipment: <strong>{item.name}</strong>,
      brand: item.brand || dash,
      model: item.model || dash,
      serial: item.serial_number || dash,
      asset: item.asset || dash,
      assignedTo: <strong>{item.assigned_to || dash}</strong>,
      department: item.department || dash,
      location: item.location || dash,
      employeeId: item.employee_id || dash,
      designation: item.designation || dash,
      dateOfIssuance: formatDate(item.date_of_issuance),
      email: item.email || dash,
    };
    order.forEach(key => {
      if (visibleColumns[key]) {
        cells.push(<td key={`${item.id}-${key}`} style={styles.td}>{valueMap[key]}</td>);
      }
    });
    cells.push(
      <td key={`${item.id}-actions`} style={{ ...styles.td, textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
          <button className="gl-icon-btn gl-icon-view" style={styles.iconBtn} onClick={() => onView && onView(item)} title="View">
            <FaEye size={12} />
          </button>
          <button className="gl-icon-btn gl-icon-edit" style={styles.iconBtn} onClick={() => openEditModal(item)} title="Edit">
            <FaEdit size={12} />
          </button>
          <button className="gl-icon-btn gl-icon-delete" style={styles.iconBtn} onClick={() => onUnassign && onUnassign(item.id)} title="Unassign">
            <FaTrash size={12} />
          </button>
          <button className="gl-icon-btn" style={{ ...styles.iconBtn, color: '#B45309' }} onClick={() => onReturn && onReturn(item.id)} title="Return">
            <FaUndo size={12} />
          </button>
          <button className="gl-icon-btn" style={{ ...styles.iconBtn, color: '#0D9488' }} onClick={() => openVoucher(item)} title="Voucher">
            <FaPrint size={12} />
          </button>
        </div>
      </td>
    );
    return cells;
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingWrap}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Loading assignments…</p>
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
              <span style={{ ...styles.navCount, ...(!activeTab ? styles.navCountActive : {}) }}>{assignedItems.length}</span>
            </button>
            {categoryGroups.map(cat => {
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
                  <span style={{ ...styles.navCount, ...(isActive ? styles.navCountActive : {}) }}>{cat.count}</span>
                </button>
              );
            })}
          </nav>
          <div style={styles.sidebarDivider} />
          <div style={styles.sidebarHeader}>Condition</div>
          <div style={styles.filterList}>
            <button
              onClick={() => setConditionFilter('')}
              style={{ ...styles.filterItem, ...(!conditionFilter ? styles.filterItemActive : {}) }}
            >
              Any
            </button>
            {CONDITIONS.map(c => (
              <button
                key={c}
                onClick={() => setConditionFilter(conditionFilter === c ? '' : c)}
                style={{ ...styles.filterItem, ...(conditionFilter === c ? styles.filterItemActive : {}) }}
              >
                <span style={{ ...styles.filterDot, background: CONDITION_STYLES[c]?.dot || '#9CA3AF' }} />
                {c}
              </button>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <main style={styles.main}>
          <div style={styles.mainHeader}>
            <div>
              <h1 style={styles.listTitle}>
                {activeTab ? categoryGroups.find(c => c.id === activeTab)?.name || 'Category' : 'Asset Assignment'}
              </h1>
              <p style={styles.titleSub}>{filteredAssigned.length} of {assignedItems.length} assigned</p>
            </div>
            <div style={styles.headerActions}>
              <div style={styles.searchBox}>
                <FaSearch style={styles.searchIcon} size={12} />
                <input
                  type="text"
                  placeholder="Search assigned…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={styles.searchInput}
                />
              </div>

              {/* Columns dropdown */}
              <div style={{ position: 'relative' }} ref={dropdownRef}>
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

              {/* Export dropdown */}
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

              <button className="gl-btn-primary" style={styles.btnPrimary} onClick={openAssignModal}>
                <FaPlus size={12} /> Assign New
              </button>
            </div>
          </div>

          <div style={styles.tableCard}>
            <div style={styles.tableScroll}>
              <table style={styles.table}>
                <thead>
                  <tr>{renderHeaders()}</tr>
                </thead>
                <tbody>
                  {filteredAssigned.length === 0 ? (
                    <tr>
                      <td colSpan={100} style={styles.emptyCell}>
                        <div style={styles.emptyWrap}>
                          <div style={styles.emptyIcon}><FaInbox size={18} /></div>
                          <h3 style={styles.emptyTitle}>No Assigned Assets</h3>
                          <p style={styles.emptyText}>Click "Assign New" to assign an asset.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredAssigned.map((item, idx) => (
                      <tr key={item.id} className="gl-row">{renderRowCells(item, idx)}</tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Assignment Modal */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={closeAssignModal}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
            <div className="modal-header">
              <h2>📄 Issue / Receipt Voucher</h2>
              <button className="close-btn" onClick={closeAssignModal}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '20px' }}>
              {!selectedItem ? (
                <>
                  <p style={{ marginBottom: '16px' }}>Select an unassigned asset:</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                    <select
                      value={modalCategoryFilter}
                      onChange={(e) => setModalCategoryFilter(e.target.value)}
                      style={{ padding: '6px 12px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px', background: 'white', minWidth: '140px' }}
                    >
                      <option value="all">All Categories</option>
                      {types.filter(t => unassignedItems.some(item => item.type_id === t.id)).map(cat => (
                        <option key={cat.id} value={String(cat.id)}>{cat.icon || '📦'} {cat.name}</option>
                      ))}
                    </select>
                    <select
                      value={modalConditionFilter}
                      onChange={(e) => setModalConditionFilter(e.target.value)}
                      style={{ padding: '6px 12px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px', background: 'white', minWidth: '120px' }}
                    >
                      <option value="">All Conditions</option>
                      <option value="New">🆕 New</option>
                      <option value="Refurbed">🔄 Refurbed</option>
                      <option value="Damaged">❌ Damaged</option>
                      <option value="Used">📦 Used</option>
                      <option value="Condemned">⛔ Condemned</option>
                    </select>
                    <span style={{ marginLeft: 'auto', fontSize: '14px', color: '#6B7280' }}>
                      {filteredUnassigned.length} available
                    </span>
                  </div>
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#FAFAFB', borderBottom: '1px solid #ECEDF1' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left' }}>Equipment</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left' }}>Brand</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left' }}>Model</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left' }}>S/N</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left' }}>Condition</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUnassigned.length === 0 ? (
                          <tr><td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#6B7280' }}>No unassigned assets available.</td></tr>
                        ) : (
                          filteredUnassigned.map((item) => (
                            <tr key={item.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                              <td style={{ padding: '8px 12px' }}><strong>{item.name}</strong></td>
                              <td style={{ padding: '8px 12px' }}>{item.brand || '-'}</td>
                              <td style={{ padding: '8px 12px' }}>{item.model || '-'}</td>
                              <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '12px' }}>{item.serial_number || '-'}</td>
                              <td style={{ padding: '8px 12px' }}>{getConditionBadge(item.condition)}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                <button className="gl-btn-primary" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={() => handleSelectUnassignedItem(item)}>
                                  Select
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <h4>Selected Asset</h4>
                    <p><strong>{selectedItem.name}</strong></p>
                    <p style={{ fontSize: '14px' }}>Brand: {selectedItem.brand || '-'} | Model: {selectedItem.model || '-'} | S/N: {selectedItem.serial_number || '-'}</p>
                  </div>
                  <hr />
                  <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '8px' }}>
                    <div className="form-group">
                      <label>Issued By *</label>
                      <input type="text" name="issued_by" value={voucherData.issued_by} onChange={handleVoucherChange} placeholder="e.g., Syed Afaq Haider" style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #D1D5DB' }} />
                    </div>
                    <div className="form-group">
                      <label>Received By *</label>
                      <input type="text" name="received_by" value={voucherData.received_by} onChange={handleVoucherChange} placeholder="e.g., Zaheer Abbas" style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #D1D5DB' }} />
                    </div>
                  </div>
                  <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '8px' }}>
                    <div className="form-group">
                      <label>Department</label>
                      <input type="text" name="department" value={voucherData.department} onChange={handleVoucherChange} placeholder="e.g., IT FC" style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #D1D5DB' }} />
                    </div>
                    <div className="form-group">
                      <label>Station</label>
                      <input type="text" name="station" value={voucherData.station} onChange={handleVoucherChange} placeholder="e.g., Rawalpindi" style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #D1D5DB' }} />
                    </div>
                  </div>
                  <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '8px' }}>
                    <div className="form-group">
                      <label>Employee ID</label>
                      <input type="text" name="employee_id" value={voucherData.employee_id} onChange={handleVoucherChange} placeholder="e.g., FFL-12345" style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #D1D5DB' }} />
                    </div>
                    <div className="form-group">
                      <label>Designation</label>
                      <input type="text" name="designation" value={voucherData.designation} onChange={handleVoucherChange} placeholder="e.g., Manager IT" style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #D1D5DB' }} />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: '8px' }}>
                    <label>Email</label>
                    <input type="email" name="email" value={voucherData.email} onChange={handleVoucherChange} placeholder="email@domain.com" style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #D1D5DB' }} />
                  </div>
                  <div className="form-group" style={{ marginBottom: '8px' }}>
                    <label>Date of Issuance</label>
                    <input type="date" name="date_of_issuance" value={voucherData.date_of_issuance} onChange={handleVoucherChange} style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #D1D5DB' }} />
                  </div>
                  <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                    <button className="btn-cancel" onClick={() => setSelectedItem(null)}>Back</button>
                    <button className="btn-submit" onClick={handleAssignSubmit}>Assign & Print Voucher</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedItem && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h2>✏️ Edit Assignment</h2>
              <button className="close-btn" onClick={closeEditModal}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '20px' }}>
              <p><strong>Asset:</strong> {selectedItem.name}</p>
              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label>Assigned To *</label>
                <input type="text" name="assigned_to" value={editData.assigned_to} onChange={handleEditChange} style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #D1D5DB' }} />
              </div>
              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label>Location</label>
                <input type="text" name="location" value={editData.location} onChange={handleEditChange} style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #D1D5DB' }} />
              </div>
              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label>Department</label>
                <input type="text" name="department" value={editData.department} onChange={handleEditChange} style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #D1D5DB' }} />
              </div>
              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label>Station</label>
                <input type="text" name="station" value={editData.station} onChange={handleEditChange} style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #D1D5DB' }} />
              </div>
              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label>Issued By</label>
                <input type="text" name="issued_by" value={editData.issued_by} onChange={handleEditChange} style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #D1D5DB' }} />
              </div>
              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label>Employee ID</label>
                <input type="text" name="employee_id" value={editData.employee_id} onChange={handleEditChange} style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #D1D5DB' }} />
              </div>
              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label>Designation</label>
                <input type="text" name="designation" value={editData.designation} onChange={handleEditChange} style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #D1D5DB' }} />
              </div>
              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label>Email</label>
                <input type="email" name="email" value={editData.email} onChange={handleEditChange} style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #D1D5DB' }} />
              </div>
              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label>Date of Issuance</label>
                <input type="date" name="date_of_issuance" value={editData.date_of_issuance} onChange={handleEditChange} style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #D1D5DB' }} />
              </div>
              <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button className="btn-cancel" onClick={closeEditModal}>Cancel</button>
                <button className="btn-submit" onClick={handleEditSubmit}>Update</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Voucher Modal */}
      {showVoucherModal && voucherItem && (
        <div className="modal-overlay" onClick={() => setShowVoucherModal(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
            <div className="modal-header">
              <h2>📄 Asset Receipt Voucher</h2>
              <button className="close-btn" onClick={() => setShowVoucherModal(false)}>×</button>
            </div>
            <div className="modal-body" ref={printRef} style={{ padding: '20px' }}>
              <div className="voucher-content">
                <div className="header" style={{ textAlign: 'center', fontSize: '24px', fontWeight: 'bold', borderBottom: '2px solid #000', paddingBottom: '10px' }}>ISSUE / RECEIPT VOUCHER</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', margin: '10px 0' }}>
                  <div><strong>Department:</strong> {voucherItem.department || voucherItem.type_name || 'IT'}</div>
                  <div><strong>FC</strong></div>
                  <div><strong>Station:</strong> {voucherItem.station || voucherItem.location || 'Rawalpindi'}</div>
                  <div><strong>Date of Issuance:</strong> {formatDate(voucherItem.date_of_issuance)}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <div><strong>Employee ID:</strong> {voucherItem.employee_id || '-'}</div>
                  <div><strong>Designation:</strong> {voucherItem.designation || '-'}</div>
                  <div><strong>Email:</strong> {voucherItem.email || '-'}</div>
                </div>
                <hr />
                <h4>Equipment</h4>
                <table className="items-table" style={{ width: '100%', borderCollapse: 'collapse', margin: '15px 0' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5' }}>
                      <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>Sr.</th>
                      <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>Items</th>
                      <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>QTY</th>
                      <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '8px' }}>1</td>
                      <td style={{ border: '1px solid #000', padding: '8px' }}>
                        {voucherItem.name}<br />
                        <span style={{ fontSize: '12px' }}>
                          Serial: {voucherItem.serial_number || '-'}<br />
                          {voucherItem.specifications || ''}
                        </span>
                      </td>
                      <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{voucherItem.quantity || 1}</td>
                      <td style={{ border: '1px solid #000', padding: '8px' }}>
                        {voucherItem.remarks || voucherItem.notes || ''}
                        {voucherItem.asset && <div><strong>Asset:</strong> {voucherItem.asset}</div>}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <strong>Issued By</strong><br />
                    <span style={{ borderTop: '1px solid #000', display: 'inline-block', paddingTop: '5px', minWidth: '150px' }}>{voucherItem.issued_by || 'Syed Afaq Haider'}</span>
                  </div>
                  <div>
                    <strong>Received By</strong><br />
                    <span style={{ borderTop: '1px solid #000', display: 'inline-block', paddingTop: '5px', minWidth: '150px' }}>{voucherItem.assigned_to || ''}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="form-actions no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <button className="btn-cancel" onClick={() => setShowVoucherModal(false)}>Close</button>
              <button className="btn-primary" onClick={handlePrint}><FaPrint /> Print</button>
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
  filterList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  filterItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    height: '30px',
    padding: '0 10px',
    borderRadius: '7px',
    border: 'none',
    background: 'transparent',
    fontSize: '12.5px',
    color: '#6B7280',
    cursor: 'pointer',
    textAlign: 'left',
  },
  filterItemActive: {
    background: '#EEF2FF',
    color: ACCENT,
    fontWeight: 600,
  },
  filterDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    flexShrink: 0,
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

export default AssetAssignment;
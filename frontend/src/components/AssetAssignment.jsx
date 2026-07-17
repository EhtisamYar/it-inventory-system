import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  FaClipboardCheck, FaSearch, FaPlus, FaPrint, FaEye, FaEdit, FaTrash, FaUndo, FaColumns, FaFileExport, FaUser
} from 'react-icons/fa';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ---------- Helpers ----------
const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-GB');
};

// Column definitions
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

const DEFAULT_VISIBLE = {
  category: true,
  equipment: true,
  brand: true,
  model: true,
  serial: true,
  asset: true,
  assignedTo: true,
  department: true,
  location: true,
  employeeId: true,
  designation: true,
  dateOfIssuance: true,
  email: true,
};

// ---- Design tokens — matches the InventoryList "manifest" design ----
const INK = '#14161F';
const PAPER = '#F2F0EA';
const TEAL = '#1F6F78';
const AMBER = '#C08A1E';
const CATEGORY_TINTS = ['#1F6F78', '#B45309', '#5B4B8A', '#0F766E', '#9A3412', '#4D5B8A', '#7C5A2A', '#3F6B3A'];
const getTint = (index) => CATEGORY_TINTS[index % CATEGORY_TINTS.length];

const MONO_KEYS = new Set(['serial', 'asset', 'employeeId']);

// Signature hang-tag glyph — same motif used across the app for categories
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

const AssetAssignment = ({
  items,
  loading,
  onAssign,
  onUnassign,
  onEdit,
  onView,
  onReturn,
  types = [],
  apiUrl   // 👈 NEW: base URL for API calls
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
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

  // --- Employee data ---
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [viewEmployee, setViewEmployee] = useState(null);

  // --- Voucher state ---
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

  // --- Edit state ---
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

  // --- Fetch employees ---
  useEffect(() => {
    if (apiUrl) {
      setLoadingEmployees(true);
      axios.get(`${apiUrl}/api/employees`)
        .then(res => setEmployees(res.data))
        .catch(err => console.error('Failed to fetch employees', err))
        .finally(() => setLoadingEmployees(false));
    }
  }, [apiUrl]);

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

  // ---------- Categories for tabs ----------
  const getCategoryGroups = (itemsList) => {
    const groups = {};
    itemsList.forEach(item => {
      const key = item.type_id || 'uncategorized';
      if (!groups[key]) {
        groups[key] = {
          id: key,
          name: item.type_name || 'Uncategorized',
          icon: item.type_icon || '📦',
          items: [],
        };
      }
      groups[key].items.push(item);
    });
    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  };

  const categoryGroups = getCategoryGroups(assignedItems);
  const categoryTintMap = {};
  categoryGroups.forEach((cat, idx) => {
    categoryTintMap[cat.id] = getTint(idx);
  });

  // ---------- Filter assigned items by tab ----------
  const getFilteredAssigned = () => {
    let filtered = assignedItems;
    if (activeTab) {
      filtered = filtered.filter(item => item.type_id === activeTab);
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
  const EXPORT_ORDER = ['category', 'equipment', 'brand', 'model', 'serial', 'asset', 'assignedTo', 'department', 'location', 'employeeId', 'designation', 'dateOfIssuance', 'email'];

  const buildValueMap = (item) => ({
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
  });

  const getExportData = () => {
    const headers = ['#'];
    EXPORT_ORDER.forEach(key => {
      if (visibleColumns[key]) headers.push(COLUMN_DEFS[key].label);
    });
    const rows = filteredAssigned.map((item, idx) => {
      const row = { num: idx + 1 };
      const valueMap = buildValueMap(item);
      EXPORT_ORDER.forEach(key => {
        if (visibleColumns[key]) row[key] = valueMap[key];
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
        const valueMap = buildValueMap(item);
        EXPORT_ORDER.forEach(key => {
          if (visibleColumns[key]) row[key] = valueMap[key];
        });
        return row;
      });
      const wsGroup = XLSX.utils.json_to_sheet(groupData, { header: headers });
      let sheetName = group.name.slice(0, 31).replace(/[\\/*?:[\]]/g, '');
      XLSX.utils.book_append_sheet(wb, wsGroup, sheetName);
    });
    XLSX.writeFile(wb, 'Asset_Assignment.xlsx');
  };

  const handleExportPDF = () => {
    setShowExportDropdown(false);
    const doc = new jsPDF('landscape', 'mm', 'a4');
    doc.setFont('helvetica');
    const groups = getCategoryGroups(filteredAssigned);

    const drawCategory = (group, startY) => {
      doc.setFontSize(16);
      doc.text(`${group.name} (${group.items.length} items)`, 14, startY);
      const yAfterTitle = startY + 8;

      const tableData = group.items.map((item, idx) => {
        const row = [idx + 1];
        const valueMap = buildValueMap(item);
        EXPORT_ORDER.forEach(key => {
          if (visibleColumns[key]) row.push(valueMap[key]);
        });
        return row;
      });

      const tableHeaders = ['#'];
      EXPORT_ORDER.forEach(key => {
        if (visibleColumns[key]) tableHeaders.push(COLUMN_DEFS[key].label);
      });

      autoTable(doc, {
        head: [tableHeaders],
        body: tableData,
        startY: yAfterTitle,
        styles: { fontSize: 8, font: 'helvetica' },
        headStyles: { fillColor: [31, 111, 120], font: 'helvetica' },
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

  // --- Employee selection handler ---
  const handleEmployeeSelect = (empId, target = 'voucher') => {
    const emp = employees.find(e => e.id === parseInt(empId));
    if (!emp) return;
    if (target === 'voucher') {
      setVoucherData(prev => ({
        ...prev,
        received_by: emp.name,
        employee_id: emp.employee_id,
        designation: emp.designation || '',
        department: emp.department_name || prev.department,
        email: emp.email || prev.email
      }));
    } else if (target === 'edit') {
      setEditData(prev => ({
        ...prev,
        assigned_to: emp.name,
        employee_id: emp.employee_id,
        designation: emp.designation || '',
        department: emp.department_name || prev.department,
        email: emp.email || prev.email
      }));
    }
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

  // ---- Employee View ----
  const openEmployeeModal = (employeeId) => {
    const emp = employees.find(e => e.employee_id === employeeId || e.id === employeeId);
    if (emp) {
      setViewEmployee(emp);
      setShowEmployeeModal(true);
    } else {
      alert('Employee not found');
    }
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

  const getActiveCategoryName = () => {
    if (!activeTab) return 'Asset Assignment';
    const cat = categoryGroups.find(c => c.id === activeTab);
    return cat ? cat.name : 'Asset Assignment';
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingWrap}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Loading assets…</p>
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
            <div style={styles.mark}><FaClipboardCheck size={14} /></div>
            <div>
              <h1 style={styles.brandTitle}>{getActiveCategoryName()}</h1>
              <p style={styles.brandSub}>Fauji Foods · Assignment ledger</p>
            </div>
          </div>

          <div style={styles.headerActions}>
            <div style={styles.searchBox}>
              <FaSearch style={styles.searchIcon} size={12} />
              <input
                type="text"
                placeholder="Search assigned assets…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={styles.searchInput}
              />
            </div>

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

            <button className="gl-btn-primary" style={styles.btnPrimary} onClick={openAssignModal}>
              <FaPlus size={12} /> Assign new asset
            </button>
          </div>
        </header>

        {/* Stat strip */}
        <div style={styles.statStrip}>
          <div style={styles.statBlock}>
            <span style={styles.statValue}>{String(assignedItems.length).padStart(3, '0')}</span>
            <span style={styles.statLabel}>Assets assigned</span>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.statBlock}>
            <span style={styles.statValue}>{String(unassignedItems.length).padStart(3, '0')}</span>
            <span style={styles.statLabel}>Available to assign</span>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.statBlock}>
            <span style={styles.statValue}>{String(categoryGroups.length).padStart(2, '0')}</span>
            <span style={styles.statLabel}>Categories</span>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.statBlock}>
            <span style={{ ...styles.statValue, color: filteredAssigned.length !== assignedItems.length ? TEAL : '#fff' }}>
              {filteredAssigned.length}
            </span>
            <span style={styles.statLabel}>Matching filters</span>
          </div>
        </div>

        {/* Category tabs */}
        {categoryGroups.length > 0 && (
          <div style={styles.tabRow}>
            <button
              onClick={() => setActiveTab(null)}
              style={{ ...styles.tabPill, ...(!activeTab ? styles.tabPillActive : {}) }}
            >
              All items
              <span style={{ ...styles.tabCount, ...(!activeTab ? styles.tabCountActive : {}) }}>{assignedItems.length}</span>
            </button>
            {categoryGroups.map(cat => {
              const tint = categoryTintMap[cat.id];
              const isActive = activeTab === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveTab(activeTab === cat.id ? null : cat.id)}
                  style={{ ...styles.tabPill, ...(isActive ? { ...styles.tabPillActive, background: tint, borderColor: tint } : {}) }}
                >
                  <TagGlyph color={isActive ? '#fff' : tint} />
                  {cat.name}
                  <span style={{ ...styles.tabCount, ...(isActive ? styles.tabCountActive : {}) }}>{cat.items.length}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Manifest table */}
        <div style={styles.tableCard}>
          <div style={styles.tableScroll}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>#</th>
                  {visibleColumns.category && <th style={styles.th}>Category</th>}
                  {visibleColumns.equipment && <th style={styles.th}>Equipment</th>}
                  {visibleColumns.brand && <th style={styles.th}>Brand</th>}
                  {visibleColumns.model && <th style={styles.th}>Model</th>}
                  {visibleColumns.serial && <th style={styles.th}>S/N</th>}
                  {visibleColumns.asset && <th style={styles.th}>Asset</th>}
                  {visibleColumns.assignedTo && <th style={styles.th}>Assigned To</th>}
                  {visibleColumns.department && <th style={styles.th}>Department</th>}
                  {visibleColumns.location && <th style={styles.th}>Location</th>}
                  {visibleColumns.employeeId && <th style={styles.th}>Employee ID</th>}
                  {visibleColumns.designation && <th style={styles.th}>Designation</th>}
                  {visibleColumns.dateOfIssuance && <th style={styles.th}>Date of Issuance</th>}
                  {visibleColumns.email && <th style={styles.th}>Email</th>}
                  <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssigned.length === 0 ? (
                  <tr>
                    <td colSpan="100" style={styles.emptyCell}>
                      <div style={styles.emptyWrap}>
                        <div style={styles.emptyIcon}><FaClipboardCheck size={16} /></div>
                        <h3 style={styles.emptyTitle}>No assigned assets</h3>
                        <p style={styles.emptyText}>Assign equipment to someone to see it here.</p>
                        <button className="gl-btn-primary" style={styles.btnPrimary} onClick={openAssignModal}>
                          <FaPlus size={12} /> Assign new asset
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAssigned.map((item, idx) => {
                    const tint = categoryTintMap[item.type_id] || '#6B6353';
                    return (
                      <tr key={item.id} className="gl-row">
                        <td style={{ ...styles.td, ...styles.tdMono, color: '#B9B3A4' }}>{String(idx + 1).padStart(3, '0')}</td>
                        {visibleColumns.category && (
                          <td style={styles.td}>
                            <span style={styles.categoryTag}>
                              <TagGlyph color={tint} />
                              {item.type_name}
                            </span>
                          </td>
                        )}
                        {visibleColumns.equipment && <td style={{ ...styles.td, fontWeight: 600 }}>{item.name}</td>}
                        {visibleColumns.brand && <td style={styles.td}>{item.brand || <span style={styles.dash}>-</span>}</td>}
                        {visibleColumns.model && <td style={styles.td}>{item.model || <span style={styles.dash}>-</span>}</td>}
                        {visibleColumns.serial && <td style={{ ...styles.td, ...styles.tdMono }}>{item.serial_number || <span style={styles.dash}>-</span>}</td>}
                        {visibleColumns.asset && <td style={{ ...styles.td, ...styles.tdMono }}>{item.asset || <span style={styles.dash}>-</span>}</td>}
                        {visibleColumns.assignedTo && <td style={{ ...styles.td, fontWeight: 600 }}>{item.assigned_to}</td>}
                        {visibleColumns.department && <td style={styles.td}>{item.department || <span style={styles.dash}>-</span>}</td>}
                        {visibleColumns.location && <td style={styles.td}>{item.location || <span style={styles.dash}>-</span>}</td>}
                        {visibleColumns.employeeId && (
                          <td style={{ ...styles.td, ...styles.tdMono, cursor: 'pointer' }} onClick={() => {
                            if (item.employee_id) openEmployeeModal(item.employee_id);
                          }}>
                            {item.employee_id || <span style={styles.dash}>-</span>}
                          </td>
                        )}
                        {visibleColumns.designation && <td style={styles.td}>{item.designation || <span style={styles.dash}>-</span>}</td>}
                        {visibleColumns.dateOfIssuance && <td style={styles.td}>{formatDate(item.date_of_issuance)}</td>}
                        {visibleColumns.email && <td style={styles.td}>{item.email || <span style={styles.dash}>-</span>}</td>}
                        <td style={{ ...styles.td, textAlign: 'right' }}>
                          <div style={styles.actionRow}>
                            <button className="gl-icon-btn gl-icon-view" style={styles.iconBtn} onClick={() => onView(item)} title="View">
                              <FaEye size={12} />
                            </button>
                            <button className="gl-icon-btn gl-icon-edit" style={styles.iconBtn} onClick={() => openEditModal(item)} title="Edit">
                              <FaEdit size={12} />
                            </button>
                            <button className="gl-icon-btn gl-icon-delete" style={styles.iconBtn} onClick={() => onUnassign(item.id)} title="Unassign">
                              <FaTrash size={12} />
                            </button>
                            <button className="gl-icon-btn gl-icon-return" style={styles.iconBtn} onClick={() => onReturn(item.id)} title="Return">
                              <FaUndo size={12} />
                            </button>
                            <button className="gl-icon-btn gl-icon-voucher" style={styles.iconBtn} onClick={() => openVoucher(item)} title="Voucher">
                              <FaPrint size={12} />
                            </button>
                            {item.employee_id && (
                              <button className="gl-icon-btn gl-icon-employee" style={{ ...styles.iconBtn, color: '#9C9585' }} onClick={() => openEmployeeModal(item.employee_id)} title="View Employee">
                                <FaUser size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Assignment Modal */}
      {showAssignModal && (
        <div style={styles.overlay} onClick={closeAssignModal}>
          <div style={{ ...styles.modal, maxWidth: '920px' }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Issue / receipt voucher</h2>
              <button style={styles.closeBtn} onClick={closeAssignModal}>×</button>
            </div>
            <div style={styles.modalBody}>
              {!selectedItem ? (
                <>
                  <p style={{ marginBottom: '14px', fontSize: '13px', color: '#6B6353' }}>Select an unassigned asset from the list below.</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={styles.inlineLabel}>Category</span>
                      <select
                        value={modalCategoryFilter}
                        onChange={(e) => setModalCategoryFilter(e.target.value)}
                        style={styles.select}
                      >
                        <option value="all">All categories</option>
                        {types.filter(t => unassignedItems.some(item => item.type_id === t.id)).map(cat => (
                          <option key={cat.id} value={String(cat.id)}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={styles.inlineLabel}>Condition</span>
                      <select
                        value={modalConditionFilter}
                        onChange={(e) => setModalConditionFilter(e.target.value)}
                        style={styles.select}
                      >
                        <option value="">All</option>
                        <option value="New">New</option>
                        <option value="Refurbed">Refurbed</option>
                        <option value="Damaged">Damaged</option>
                        <option value="Used">Used</option>
                        <option value="Condemned">Condemned</option>
                      </select>
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: '12.5px', color: '#9C9585' }}>
                      {filteredUnassigned.length} available
                    </span>
                  </div>

                  <div style={{ ...styles.tableCard, maxHeight: '300px', overflowY: 'auto' }}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Equipment</th>
                          <th style={styles.th}>Brand</th>
                          <th style={styles.th}>Model</th>
                          <th style={styles.th}>S/N</th>
                          <th style={styles.th}>Condition</th>
                          <th style={styles.th}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUnassigned.length === 0 ? (
                          <tr><td colSpan="6" style={styles.emptyCell}>No unassigned assets available.</td></tr>
                        ) : (
                          filteredUnassigned.map((item) => (
                            <tr key={item.id} className="gl-row">
                              <td style={{ ...styles.td, fontWeight: 600 }}>{item.name}</td>
                              <td style={styles.td}>{item.brand || <span style={styles.dash}>-</span>}</td>
                              <td style={styles.td}>{item.model || <span style={styles.dash}>-</span>}</td>
                              <td style={{ ...styles.td, ...styles.tdMono }}>{item.serial_number || <span style={styles.dash}>-</span>}</td>
                              <td style={styles.td}>{item.condition || <span style={styles.dash}>-</span>}</td>
                              <td style={styles.td}>
                                <button style={styles.selectBtn} onClick={() => handleSelectUnassignedItem(item)}>
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
                  <div style={{ marginBottom: '14px' }}>
                    <div style={styles.inlineLabel}>Selected asset</div>
                    <p style={{ margin: '4px 0', fontWeight: 600, fontSize: '14px', color: INK }}>{selectedItem.name}</p>
                    <p style={{ fontSize: '12.5px', color: '#6B6353', margin: 0 }}>
                      Brand: {selectedItem.brand || '-'} · Model: {selectedItem.model || '-'} · S/N: {selectedItem.serial_number || '-'}
                    </p>
                    <p style={{ fontSize: '12.5px', color: '#6B6353', margin: '2px 0 0' }}>Specifications: {selectedItem.specifications || '-'}</p>
                  </div>
                  <div style={styles.divider} />

                  {/* Employee dropdown */}
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Select Employee (auto‑fill)</label>
                    <select
                      style={styles.input}
                      onChange={(e) => handleEmployeeSelect(e.target.value, 'voucher')}
                      value=""
                    >
                      <option value="">-- Select employee --</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.employee_id}){emp.designation ? ` · ${emp.designation}` : ''}
                        </option>
                      ))}
                    </select>
                    {loadingEmployees && <span style={{ fontSize: '12px', color: '#9C9585' }}>Loading employees…</span>}
                  </div>

                  <div style={styles.formRow}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Issued by *</label>
                      <input style={styles.input} type="text" name="issued_by" value={voucherData.issued_by} onChange={handleVoucherChange} placeholder="e.g., Syed Afaq Haider" />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Received by *</label>
                      <input style={styles.input} type="text" name="received_by" value={voucherData.received_by} onChange={handleVoucherChange} placeholder="e.g., Zaheer Abbas" />
                    </div>
                  </div>
                  <div style={styles.formRow}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Department</label>
                      <input style={styles.input} type="text" name="department" value={voucherData.department} onChange={handleVoucherChange} placeholder="e.g., IT FC" />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Station</label>
                      <input style={styles.input} type="text" name="station" value={voucherData.station} onChange={handleVoucherChange} placeholder="e.g., Rawalpindi" />
                    </div>
                  </div>
                  <div style={styles.formRow}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Employee ID</label>
                      <input style={styles.input} type="text" name="employee_id" value={voucherData.employee_id} onChange={handleVoucherChange} placeholder="e.g., FFL-12345" />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Designation</label>
                      <input style={styles.input} type="text" name="designation" value={voucherData.designation} onChange={handleVoucherChange} placeholder="e.g., Manager IT" />
                    </div>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Email</label>
                    <input style={styles.input} type="email" name="email" value={voucherData.email} onChange={handleVoucherChange} placeholder="email@domain.com" />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Date of issuance</label>
                    <input style={styles.input} type="date" name="date_of_issuance" value={voucherData.date_of_issuance} onChange={handleVoucherChange} />
                  </div>
                  <div style={styles.formActions}>
                    <button style={styles.btnCancel} onClick={() => setSelectedItem(null)}>Back</button>
                    <button className="gl-btn-primary" style={styles.btnPrimary} onClick={handleAssignSubmit}>Assign &amp; print voucher</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedItem && (
        <div style={styles.overlay} onClick={closeEditModal}>
          <div style={{ ...styles.modal, maxWidth: '700px' }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Edit assignment</h2>
              <button style={styles.closeBtn} onClick={closeEditModal}>×</button>
            </div>
            <div style={styles.modalBody}>
              <p style={{ fontSize: '13px', color: '#6B6353', marginTop: 0 }}><strong style={{ color: INK }}>Asset:</strong> {selectedItem.name}</p>
              <div style={styles.divider} />

              {/* Employee dropdown */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Select Employee (auto‑fill)</label>
                <select
                  style={styles.input}
                  onChange={(e) => handleEmployeeSelect(e.target.value, 'edit')}
                  value=""
                >
                  <option value="">-- Select employee --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.employee_id}){emp.designation ? ` · ${emp.designation}` : ''}
                    </option>
                  ))}
                </select>
                {loadingEmployees && <span style={{ fontSize: '12px', color: '#9C9585' }}>Loading employees…</span>}
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Assigned to *</label>
                <input style={styles.input} type="text" name="assigned_to" value={editData.assigned_to} onChange={handleEditChange} />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Location</label>
                <input style={styles.input} type="text" name="location" value={editData.location} onChange={handleEditChange} />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Department</label>
                <input style={styles.input} type="text" name="department" value={editData.department} onChange={handleEditChange} />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Station</label>
                <input style={styles.input} type="text" name="station" value={editData.station} onChange={handleEditChange} />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Issued by</label>
                <input style={styles.input} type="text" name="issued_by" value={editData.issued_by} onChange={handleEditChange} />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Employee ID</label>
                <input style={styles.input} type="text" name="employee_id" value={editData.employee_id} onChange={handleEditChange} />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Designation</label>
                <input style={styles.input} type="text" name="designation" value={editData.designation} onChange={handleEditChange} />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Email</label>
                <input style={styles.input} type="email" name="email" value={editData.email} onChange={handleEditChange} placeholder="email@domain.com" />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Date of issuance</label>
                <input style={styles.input} type="date" name="date_of_issuance" value={editData.date_of_issuance} onChange={handleEditChange} />
              </div>
              <div style={styles.formActions}>
                <button style={styles.btnCancel} onClick={closeEditModal}>Cancel</button>
                <button className="gl-btn-primary" style={styles.btnPrimary} onClick={handleEditSubmit}>Update</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Voucher Modal */}
      {showVoucherModal && voucherItem && (
        <div style={styles.overlay} onClick={() => setShowVoucherModal(false)}>
          <div style={{ ...styles.modal, maxWidth: '920px' }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Asset receipt voucher</h2>
              <button style={styles.closeBtn} onClick={() => setShowVoucherModal(false)}>×</button>
            </div>
            <div style={styles.modalBody} ref={printRef}>
              <div>
                <div style={styles.voucherHeader}>ISSUE / RECEIPT VOUCHER</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', margin: '14px 0 8px', fontSize: '13px' }}>
                  <div><strong>Department:</strong> {voucherItem.department || voucherItem.type_name || 'IT'}</div>
                  <div><strong>Station:</strong> {voucherItem.station || voucherItem.location || 'Rawalpindi'}</div>
                  <div><strong>Date of Issuance:</strong> {formatDate(voucherItem.date_of_issuance)}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '10px', fontSize: '13px' }}>
                  <div><strong>Employee ID:</strong> {voucherItem.employee_id || '-'}</div>
                  <div><strong>Designation:</strong> {voucherItem.designation || '-'}</div>
                  <div><strong>Email:</strong> {voucherItem.email || '-'}</div>
                </div>
                <div style={styles.divider} />
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: INK, margin: '12px 0 8px' }}>Equipment</h4>
                <table style={styles.table}>
                  <thead><tr><th style={styles.th}>Sr.</th><th style={styles.th}>Items</th><th style={styles.th}>Qty</th><th style={styles.th}>Remarks</th></tr></thead>
                  <tbody>
                    <tr>
                      <td style={styles.td}>1</td>
                      <td style={styles.td}>
                        {voucherItem.name}
                        <br /><span style={{ fontSize: '11.5px', color: '#9C9585' }}>Serial: {voucherItem.serial_number || '-'}<br />{voucherItem.specifications || ''}</span>
                      </td>
                      <td style={styles.td}>{voucherItem.quantity || 1}</td>
                      <td style={styles.td}>
                        {voucherItem.remarks || voucherItem.notes || ''}
                        {voucherItem.asset && <div><strong>Asset:</strong> {voucherItem.asset}</div>}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '13px' }}>
                    <strong>Issued By</strong><br />
                    <span style={{ borderTop: `1px solid ${INK}`, display: 'inline-block', paddingTop: '5px', minWidth: '150px', marginTop: '18px' }}>{voucherItem.issued_by || '-'}</span>
                  </div>
                  <div style={{ fontSize: '13px' }}>
                    <strong>Received By</strong><br />
                    <span style={{ borderTop: `1px solid ${INK}`, display: 'inline-block', paddingTop: '5px', minWidth: '150px', marginTop: '18px' }}>{voucherItem.assigned_to || ''}</span>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ ...styles.formActions, padding: '14px 20px' }} className="no-print">
              <button style={styles.btnCancel} onClick={() => setShowVoucherModal(false)}>Close</button>
              <button className="gl-btn-primary" style={styles.btnPrimary} onClick={handlePrint}><FaPrint size={12} /> Print</button>
            </div>
          </div>
        </div>
      )}

      {/* Employee Details Modal */}
      {showEmployeeModal && viewEmployee && (
        <div style={styles.overlay} onClick={() => setShowEmployeeModal(false)}>
          <div style={{ ...styles.modal, maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Employee Details</h2>
              <button style={styles.closeBtn} onClick={() => setShowEmployeeModal(false)}>×</button>
            </div>
            <div style={styles.modalBody}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
                <div><strong>Name:</strong> {viewEmployee.name}</div>
                <div><strong>Employee ID:</strong> {viewEmployee.employee_id}</div>
                <div><strong>Department:</strong> {viewEmployee.department_name || '-'}</div>
                <div><strong>Designation:</strong> {viewEmployee.designation || '-'}</div>
                <div><strong>Email:</strong> {viewEmployee.email || '-'}</div>
                <div><strong>Contact:</strong> {viewEmployee.contact_no || '-'}</div>
                <div><strong>Job Type:</strong> {viewEmployee.job_type || '-'}</div>
                <div><strong>CNIC:</strong> {viewEmployee.cnic_number || '-'}</div>
                <div><strong>Grade:</strong> {viewEmployee.grade || '-'}</div>
                <div style={{ gridColumn: '1 / -1' }}><strong>Address:</strong> {viewEmployee.address || '-'}</div>
              </div>
              <div style={{ marginTop: '16px', textAlign: 'right' }}>
                <button style={styles.btnCancel} onClick={() => setShowEmployeeModal(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


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

  /* Top bar */
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
  selectBtn: {
    height: '28px',
    padding: '0 12px',
    background: TEAL,
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
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

  /* Stat strip */
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

  /* Category tab row */
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

  /* Table */
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
  tdMono: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '12.5px',
  },
  dash: { color: '#D2CDBD' },
  categoryTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    fontSize: '12.5px',
    fontWeight: 600,
    color: '#3A3626',
  },
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

  /* Modals */
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
  divider: {
    height: '1px',
    background: '#E5E1D3',
    margin: '12px 0',
  },
  formRow: {
    display: 'flex',
    gap: '14px',
    marginBottom: '2px',
  },
  formGroup: {
    flex: 1,
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
    height: '34px',
    padding: '0 10px',
    borderRadius: '7px',
    border: '1px solid #DEDACD',
    fontSize: '13px',
    color: INK,
    background: '#fff',
  },
  inlineLabel: {
    fontSize: '11.5px',
    fontWeight: 700,
    color: '#9C9585',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '10px',
  },
  voucherHeader: {
    textAlign: 'center',
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: '18px',
    fontWeight: 700,
    color: INK,
    borderBottom: `2px solid ${INK}`,
    paddingBottom: '10px',
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
.gl-icon-return:hover { background: #EEF1FB !important; color: #5B4B8A !important; }
.gl-icon-voucher:hover { background: #F1EEE6 !important; color: #3A3626 !important; }
.gl-checkbox-row:hover { background: #FAF8F3; }
input[type=text]::placeholder, input[type=email]::placeholder { color: #B9B3A4; }
input:focus, select:focus { border-color: #1F6F78 !important; box-shadow: 0 0 0 3px rgba(31,111,120,0.12); outline: none; }

@media print {
  .no-print { display: none; }
}
`;

export default AssetAssignment;

import React, { useState, useEffect, useRef } from 'react';
import { 
  FaClipboardCheck, FaSearch, FaPlus, FaPrint, FaEye, FaEdit, FaTrash, FaUndo, FaFilter, FaColumns
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

// Column definitions – added email
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
  email: { label: 'Email', always: false },   // ✅ added
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
  email: true,   // ✅ added
};

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
  const dropdownRef = useRef(null);
  const [activeTab, setActiveTab] = useState(null);

  const [voucherData, setVoucherData] = useState({
    issued_by: '',
    received_by: '',
    department: '',
    station: '',
    employee_id: '',
    designation: '',
    date_of_issuance: new Date().toISOString().split('T')[0],
    email: ''   // ✅ added
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
    email: ''   // ✅ added
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

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowColumnDropdown(false);
      }
    };
    if (showColumnDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showColumnDropdown]);

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

  // ---------- Filter assigned items by tab ----------
  const getFilteredAssigned = () => {
    let filtered = assignedItems;
    if (activeTab) {
      filtered = filtered.filter(item => item.type_id === activeTab);
    }
    // Search filter
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
        (item.email && item.email.toLowerCase().includes(term))   // ✅ added
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

  // ---------- Export (Excel/PDF) – include email ----------
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
        headStyles: { fillColor: [41, 128, 185], font: 'helvetica' },
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

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading assets...</p>
      </div>
    );
  }

  return (
    <div className="inventory-list">
      <div className="list-header">
        <h2>
          <FaClipboardCheck /> Asset Assignment
          <span className="count">({filteredAssigned.length} assigned)</span>
        </h2>
        <div className="actions">
          <div className="search-box">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search assigned assets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="btn-primary" onClick={openAssignModal}>
            <FaPlus /> Assign New Asset
          </button>
          <div className="column-toggle-wrapper" ref={dropdownRef}>
            <button
              className="btn-secondary"
              onClick={() => setShowColumnDropdown(!showColumnDropdown)}
            >
              <FaColumns /> Columns
            </button>
            {showColumnDropdown && (
              <div className="column-dropdown">
                {availableColumns.map(key => (
                  <label key={key} className="column-checkbox">
                    <input
                      type="checkbox"
                      checked={visibleColumns[key]}
                      onChange={() => toggleColumn(key)}
                    />
                    {COLUMN_DEFS[key].label}
                  </label>
                ))}
              </div>
            )}
          </div>
          <ExportDropdown
            onExportExcel={handleExportExcel}
            onExportPDF={handleExportPDF}
          />
        </div>
      </div>

      {/* Category Tabs */}
      {categoryGroups.length > 0 && (
        <div className="master-tabs-container">
          <div className="master-tabs">
            <button
              className={`master-tab ${!activeTab ? 'active' : ''}`}
              onClick={() => setActiveTab(null)}
            >
              <span className="tab-icon">📋</span>
              <span className="tab-label">All Items</span>
              <span className="tab-badge">{filteredAssigned.length}</span>
            </button>
            {categoryGroups.map(cat => (
              <button
                key={cat.id}
                className={`master-tab ${activeTab === cat.id ? 'active' : ''}`}
                onClick={() => setActiveTab(cat.id)}
              >
                <span className="tab-icon">{cat.icon || '📦'}</span>
                <span className="tab-label">{cat.name}</span>
                <span className="tab-badge">{cat.items.length}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeTab && (
        <div className="active-category-label">
          Showing category: <strong>{categoryGroups.find(c => c.id === activeTab)?.name || ''}</strong>
          <span className="count">({filteredAssigned.length} items)</span>
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
              {visibleColumns.category && <th>Category</th>}
              {visibleColumns.equipment && <th>Equipment</th>}
              {visibleColumns.brand && <th>Brand</th>}
              {visibleColumns.model && <th>Model</th>}
              {visibleColumns.serial && <th>S/N</th>}
              {visibleColumns.asset && <th>Asset</th>}
              {visibleColumns.assignedTo && <th>Assigned To</th>}
              {visibleColumns.department && <th>Department</th>}
              {visibleColumns.location && <th>Location</th>}
              {visibleColumns.employeeId && <th>Employee ID</th>}
              {visibleColumns.designation && <th>Designation</th>}
              {visibleColumns.dateOfIssuance && <th>Date of Issuance</th>}
              {visibleColumns.email && <th>Email</th>}   {/* ✅ added */}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAssigned.length === 0 ? (
              <tr>
                <td colSpan="100" className="empty-state">
                  <div className="empty-icon">📭</div>
                  <h3>No Assigned Assets</h3>
                  <p>Click "Assign New Asset" to assign equipment to someone.</p>
                </td>
              </tr>
            ) : (
              filteredAssigned.map((item, idx) => (
                <tr key={item.id}>
                  <td>{idx + 1}</td>
                  {visibleColumns.category && <td><span className="category-tag">{item.type_icon || '📦'} {item.type_name}</span></td>}
                  {visibleColumns.equipment && <td><strong>{item.name}</strong></td>}
                  {visibleColumns.brand && <td>{item.brand || '-'}</td>}
                  {visibleColumns.model && <td>{item.model || '-'}</td>}
                  {visibleColumns.serial && <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{item.serial_number || '-'}</td>}
                  {visibleColumns.asset && <td>{item.asset || '-'}</td>}
                  {visibleColumns.assignedTo && <td><strong>{item.assigned_to}</strong></td>}
                  {visibleColumns.department && <td>{item.department || '-'}</td>}
                  {visibleColumns.location && <td>{item.location || '-'}</td>}
                  {visibleColumns.employeeId && <td>{item.employee_id || '-'}</td>}
                  {visibleColumns.designation && <td>{item.designation || '-'}</td>}
                  {visibleColumns.dateOfIssuance && <td>{formatDate(item.date_of_issuance)}</td>}
                  {visibleColumns.email && <td>{item.email || '-'}</td>}   {/* ✅ added */}
                  <td>
                    <div className="action-buttons">
                      <button className="action-btn view" onClick={() => onView(item)} title="View">
                        <FaEye />
                      </button>
                      <button className="action-btn edit" onClick={() => openEditModal(item)} title="Edit">
                        <FaEdit />
                      </button>
                      <button className="action-btn delete" onClick={() => onUnassign(item.id)} title="Unassign">
                        <FaTrash />
                      </button>
                      <button className="action-btn return" onClick={() => onReturn(item.id)} title="Return">
                        <FaUndo />
                      </button>
                      <button className="action-btn voucher" onClick={() => openVoucher(item)} title="Voucher">
                        <FaPrint />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Assignment Modal */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={closeAssignModal}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
            <div className="modal-header">
              <h2>📄 Issue / Receipt Voucher</h2>
              <button className="close-btn" onClick={closeAssignModal}>×</button>
            </div>
            <div className="modal-body">
              {!selectedItem ? (
                <>
                  <p style={{ marginBottom: '16px' }}>Select an unassigned asset from the list below:</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '500' }}>Category:</span>
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
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '500' }}>Condition:</span>
                      <select
                        value={modalConditionFilter}
                        onChange={(e) => setModalConditionFilter(e.target.value)}
                        style={{ padding: '6px 12px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px', background: 'white', minWidth: '120px' }}
                      >
                        <option value="">All</option>
                        <option value="New">🆕 New</option>
                        <option value="Refurbed">🔄 Refurbed</option>
                        <option value="Damaged">❌ Damaged</option>
                        <option value="Used">📦 Used</option>
                        <option value="Condemned">⛔ Condemned</option>
                      </select>
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: '14px', color: 'var(--gray)' }}>
                      {filteredUnassigned.length} available
                    </span>
                  </div>

                  <div className="items-table" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Equipment</th>
                          <th>Brand</th>
                          <th>Model</th>
                          <th>S/N</th>
                          <th>Condition</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUnassigned.length === 0 ? (
                          <tr><td colSpan="6" className="empty-state">No unassigned assets available.</td></tr>
                        ) : (
                          filteredUnassigned.map((item) => (
                            <tr key={item.id}>
                              <td><strong>{item.name}</strong></td>
                              <td>{item.brand || '-'}</td>
                              <td>{item.model || '-'}</td>
                              <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{item.serial_number || '-'}</td>
                              <td>{item.condition || '-'}</td>
                              <td>
                                <button className="action-btn assign" onClick={() => handleSelectUnassignedItem(item)}>
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
                    <p style={{ fontSize: '14px' }}>
                      Brand: {selectedItem.brand || '-'} | Model: {selectedItem.model || '-'} | S/N: {selectedItem.serial_number || '-'}
                    </p>
                    <p style={{ fontSize: '14px' }}>Specifications: {selectedItem.specifications || '-'}</p>
                  </div>
                  <hr />
                  <div className="form-row">
                    <div className="form-group">
                      <label>Issued By *</label>
                      <input type="text" name="issued_by" value={voucherData.issued_by} onChange={handleVoucherChange} placeholder="e.g., Syed Afaq Haider" />
                    </div>
                    <div className="form-group">
                      <label>Received By *</label>
                      <input type="text" name="received_by" value={voucherData.received_by} onChange={handleVoucherChange} placeholder="e.g., Zaheer Abbas" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Department</label>
                      <input type="text" name="department" value={voucherData.department} onChange={handleVoucherChange} placeholder="e.g., IT FC" />
                    </div>
                    <div className="form-group">
                      <label>Station</label>
                      <input type="text" name="station" value={voucherData.station} onChange={handleVoucherChange} placeholder="e.g., Rawalpindi" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Employee ID</label>
                      <input type="text" name="employee_id" value={voucherData.employee_id} onChange={handleVoucherChange} placeholder="e.g., FFL-12345" />
                    </div>
                    <div className="form-group">
                      <label>Designation</label>
                      <input type="text" name="designation" value={voucherData.designation} onChange={handleVoucherChange} placeholder="e.g., Manager IT" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Email</label>   {/* ✅ added */}
                    <input type="email" name="email" value={voucherData.email} onChange={handleVoucherChange} placeholder="email@domain.com" />
                  </div>
                  <div className="form-group">
                    <label>Date of Issuance</label>
                    <input type="date" name="date_of_issuance" value={voucherData.date_of_issuance} onChange={handleVoucherChange} />
                  </div>
                  <div className="form-actions">
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
            <div className="modal-body">
              <p><strong>Asset:</strong> {selectedItem.name}</p>
              <div className="form-group">
                <label>Assigned To *</label>
                <input type="text" name="assigned_to" value={editData.assigned_to} onChange={handleEditChange} />
              </div>
              <div className="form-group">
                <label>Location</label>
                <input type="text" name="location" value={editData.location} onChange={handleEditChange} />
              </div>
              <div className="form-group">
                <label>Department</label>
                <input type="text" name="department" value={editData.department} onChange={handleEditChange} />
              </div>
              <div className="form-group">
                <label>Station</label>
                <input type="text" name="station" value={editData.station} onChange={handleEditChange} />
              </div>
              <div className="form-group">
                <label>Issued By</label>
                <input type="text" name="issued_by" value={editData.issued_by} onChange={handleEditChange} />
              </div>
              <div className="form-group">
                <label>Employee ID</label>
                <input type="text" name="employee_id" value={editData.employee_id} onChange={handleEditChange} />
              </div>
              <div className="form-group">
                <label>Designation</label>
                <input type="text" name="designation" value={editData.designation} onChange={handleEditChange} />
              </div>
              <div className="form-group">
                <label>Email</label>   {/* ✅ added */}
                <input type="email" name="email" value={editData.email} onChange={handleEditChange} placeholder="email@domain.com" />
              </div>
              <div className="form-group">
                <label>Date of Issuance</label>
                <input type="date" name="date_of_issuance" value={editData.date_of_issuance} onChange={handleEditChange} />
              </div>
              <div className="form-actions">
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
            <div className="modal-body" ref={printRef}>
              <div className="voucher-content">
                <div className="header">ISSUE / RECEIPT VOUCHER</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', margin: '10px 0' }}>
                  <div><strong>Department:</strong> {voucherItem.department || voucherItem.type_name || 'IT'}</div>
                  <div><strong>FC</strong></div>
                  <div><strong>Station:</strong> {voucherItem.station || voucherItem.location || 'Rawalpindi'}</div>
                  <div><strong>Date of Issuance:</strong> {formatDate(voucherItem.date_of_issuance)}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <div><strong>Employee ID:</strong> {voucherItem.employee_id || '-'}</div>
                  <div><strong>Designation:</strong> {voucherItem.designation || '-'}</div>
                  <div><strong>Email:</strong> {voucherItem.email || '-'}</div>   {/* ✅ added */}
                </div>
                <hr />
                <h4>Equipment</h4>
                <table className="items-table">
                  <thead><tr><th>Sr.</th><th>Items</th><th>QTY</th><th>Remarks</th></tr></thead>
                  <tbody>
                    <tr>
                      <td>1</td>
                      <td>{voucherItem.name}<br /><span style={{ fontSize: '12px' }}>Serial: {voucherItem.serial_number || '-'}<br />{voucherItem.specifications || ''}</span></td>
                      <td>{voucherItem.quantity || 1}</td>
                      <td>{voucherItem.remarks || voucherItem.notes || ''}{voucherItem.asset && <div><strong>Asset:</strong> {voucherItem.asset}</div>}</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between' }}>
                  <div><strong>Issued By</strong><br /><span style={{ borderTop: '1px solid #000', display: 'inline-block', paddingTop: '5px', minWidth: '150px' }}>{voucherItem.issued_by || 'Syed Afaq Haider'}</span></div>
                  <div><strong>Received By</strong><br /><span style={{ borderTop: '1px solid #000', display: 'inline-block', paddingTop: '5px', minWidth: '150px' }}>{voucherItem.assigned_to || ''}</span></div>
                </div>
              </div>
            </div>
            <div className="form-actions no-print">
              <button className="btn-cancel" onClick={() => setShowVoucherModal(false)}>Close</button>
              <button className="btn-primary" onClick={handlePrint}><FaPrint /> Print</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetAssignment;
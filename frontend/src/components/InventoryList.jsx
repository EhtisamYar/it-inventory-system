import React, { useState, useEffect, useRef } from 'react';
import { 
  FaPlus, FaTrash, FaSearch, FaDatabase, FaEye, FaEdit, FaColumns, FaUndo,
  FaSave, FaTimes   // <-- added for modal buttons
} from 'react-icons/fa';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import axios from 'axios';
import ExportDropdown from './ExportDropdown';

const API_URL = 'http://localhost:5000';

const formatPKR = (amount) => {
  if (!amount) return 'Rs. 0';
  return new Intl.NumberFormat('ur-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-GB');
};

// ---------- Column definitions (all possible columns) ----------
const COLUMN_DEFS = {
  category: { label: 'Category', always: false },
  brand: { label: 'Brand', always: false },
  model: { label: 'Model', always: false },
  serial: { label: 'S/N', always: false },
  specs: { label: 'Specifications', always: false },
  qty: { label: 'Qty', always: false },
  price: { label: 'Price (PKR)', always: false },
  asset: { label: 'Asset', always: false },
  assetCode: { label: 'Asset Code', always: false },
  condition: { label: 'Condition', always: false },
  remarks: { label: 'Remarks', always: false },
  location: { label: 'Location', always: false },
  department: { label: 'Department', always: false },
  email: { label: 'Email', always: false },
  assignedTo: { label: 'Assigned To', always: false },
  employeeId: { label: 'Employee ID', always: false },
  designation: { label: 'Designation', always: false },
  dateOfIssuance: { label: 'Date of Issuance', always: false },
};

// All possible column keys (for the Manage Columns modal)
const ALL_COLUMNS = Object.keys(COLUMN_DEFS).map(key => ({
  key,
  label: COLUMN_DEFS[key].label
}));

// Default preset (all columns visible)
const DEFAULT_VISIBLE = Object.keys(COLUMN_DEFS).reduce((acc, key) => {
  acc[key] = true;
  return acc;
}, {});

// Optional presets for specific categories (used only when no saved preference exists)
const CATEGORY_COLUMN_PRESETS = {
  'Printers': ['brand', 'model', 'serial', 'assignedTo', 'assetCode'],
  'Copiers': ['brand', 'model', 'serial', 'assignedTo', 'assetCode'],
  'Scanners': ['brand', 'model', 'serial', 'assignedTo', 'assetCode'],
  // Add your custom presets here if needed
};

const InventoryList = ({
  items,
  loading,
  onAddItem,
  onDeleteItem,
  onViewItem,
  onEditItem,
  searchTerm,
  onSearch,
  title,
  isMaster,
  isItInventory,
  types,
  onRefresh,
  categoryId,      // <-- new prop: numeric category ID (for DB storage)
  categoryName,    // still used for localStorage fallback
}) => {
  const [activeTab, setActiveTab] = useState(null);
  const [conditionFilter, setConditionFilter] = useState('');
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // ---------- Manage Columns State ----------
  const [showManageColumns, setShowManageColumns] = useState(false);
  const [editingColumns, setEditingColumns] = useState([]);
  const [loadingColumns, setLoadingColumns] = useState(false);

  // ---------- Return Modal State ----------
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnItem, setReturnItem] = useState(null);
  const [returnData, setReturnData] = useState({
    email: '',
    backup_done: false,
    remarks: ''
  });

  const isMasterInventory = isMaster || title === 'Master Inventory' || title === 'IT Inventory (Unassigned)';
  const isTrueMaster = isMaster && !isItInventory;

  // ---------- Column Visibility (DB + localStorage fallback) ----------
  const getStorageKey = () => {
    if (isMasterInventory) return 'inventory_columns_master';
    if (isItInventory) return 'inventory_columns_it';
    const key = categoryName || title || 'default';
    return `inventory_columns_${key}`;
  };

  // Load visibility from localStorage (fallback)
  const loadFromLocalStorage = () => {
    const stored = localStorage.getItem(getStorageKey());
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
    // No saved preference → check preset
    const preset = CATEGORY_COLUMN_PRESETS[categoryName];
    if (preset) {
      const presetVis = {};
      Object.keys(COLUMN_DEFS).forEach(key => {
        presetVis[key] = preset.includes(key);
      });
      return presetVis;
    }
    return { ...DEFAULT_VISIBLE };
  };

  const [visibleColumns, setVisibleColumns] = useState(loadFromLocalStorage);

  // ---------- Load from DB if categoryId is provided ----------
  const loadCategoryColumnsFromDB = async () => {
    if (!categoryId) return; // no DB for master/IT
    setLoadingColumns(true);
    try {
      const response = await axios.get(`${API_URL}/api/category-columns/${categoryId}`);
      if (response.data && response.data.length > 0) {
        // Build visibility object from DB
        const dbVis = {};
        Object.keys(COLUMN_DEFS).forEach(key => {
          const found = response.data.find(col => col.column_key === key);
          dbVis[key] = found ? found.is_visible === 1 : true;
        });
        setVisibleColumns(dbVis);
        // Also save to localStorage as a backup (optional)
        localStorage.setItem(getStorageKey(), JSON.stringify(dbVis));
      } else {
        // No DB entries – use localStorage fallback
        const localVis = loadFromLocalStorage();
        setVisibleColumns(localVis);
      }
    } catch (error) {
      console.error('Error loading category columns from DB:', error);
      // Fallback to localStorage
      const localVis = loadFromLocalStorage();
      setVisibleColumns(localVis);
    } finally {
      setLoadingColumns(false);
    }
  };

  // Reload when category changes
  useEffect(() => {
    if (categoryId) {
      loadCategoryColumnsFromDB();
    } else {
      // For master/IT, use localStorage
      setVisibleColumns(loadFromLocalStorage());
    }
    setActiveTab(null);
  }, [categoryId, categoryName, isMasterInventory, isItInventory]);

  // Save to localStorage whenever visibility changes (backup)
  useEffect(() => {
    localStorage.setItem(getStorageKey(), JSON.stringify(visibleColumns));
  }, [visibleColumns, categoryName, isMasterInventory, isItInventory]);

  // Apply category preset when a sub‑tab is clicked (only for Master view)
  useEffect(() => {
    if (activeTab) {
      const category = categories.find(c => c.id === activeTab);
      if (category) {
        const preset = CATEGORY_COLUMN_PRESETS[category.name];
        if (preset) {
          const newVisibility = {};
          Object.keys(COLUMN_DEFS).forEach(key => {
            newVisibility[key] = preset.includes(key);
          });
          setVisibleColumns(newVisibility);
          localStorage.setItem(getStorageKey(), JSON.stringify(newVisibility));
        }
      }
    }
  }, [activeTab]);

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

  const toggleColumn = (key) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ---------- Manage Columns: Open modal ----------
  const openManageColumns = () => {
    // Build editing list from current visibleColumns
    const current = ALL_COLUMNS.map(col => ({
      key: col.key,
      label: col.label,
      is_visible: visibleColumns[col.key] !== false
    }));
    setEditingColumns(current);
    setShowManageColumns(true);
    setShowColumnDropdown(false);
  };

  const toggleEditColumn = (key) => {
    setEditingColumns(prev => 
      prev.map(col => 
        col.key === key ? { ...col, is_visible: !col.is_visible } : col
      )
    );
  };

  const saveCategoryColumns = async () => {
    if (!categoryId) return;
    try {
      const columnsToSave = editingColumns.map(col => ({
        column_key: col.key,
        column_label: col.label,
        is_visible: col.is_visible !== false
      }));
      await axios.put(`${API_URL}/api/category-columns/${categoryId}`, {
        columns: columnsToSave
      });
      // Update visibleColumns from editingColumns
      const newVis = {};
      editingColumns.forEach(col => {
        newVis[col.key] = col.is_visible !== false;
      });
      setVisibleColumns(newVis);
      localStorage.setItem(getStorageKey(), JSON.stringify(newVis));
      setShowManageColumns(false);
      alert('✅ Columns updated successfully!');
    } catch (error) {
      console.error('Error saving columns:', error);
      alert('❌ Failed to save columns');
    }
  };

  // ---------- Available columns – include assignedTo & designation everywhere ----------
  const getColumnKeys = () => {
    const base = [
      'brand', 'model', 'serial', 'specs', 'qty', 'price',
      'asset', 'assetCode', 'condition', 'remarks', 'location',
      'department', 'email',
      'assignedTo', 'designation'
    ];
    if (isMasterInventory) base.unshift('category');
    if (isTrueMaster) base.push('employeeId', 'dateOfIssuance');
    return base.filter(key => COLUMN_DEFS[key]);
  };
  const availableColumns = getColumnKeys();

  // ---------- Get categories for tabs ----------
  const getCategoriesFromItems = () => {
    const map = {};
    items.forEach(item => {
      if (item.type_id && !map[item.type_id]) {
        map[item.type_id] = {
          id: item.type_id,
          name: item.type_name || `Category ${item.type_id}`,
          icon: item.type_icon || '📦',
          count: 0,
        };
      }
      if (map[item.type_id]) map[item.type_id].count += 1;
    });
    return Object.values(map);
  };

  let categories = [];
  if (isMasterInventory) {
    if (types && types.length > 0) {
      categories = types.map(type => ({
        id: type.id,
        name: type.name,
        icon: type.icon || '📦',
        count: items.filter(item => item.type_id === type.id).length,
      }));
    } else {
      categories = getCategoriesFromItems();
    }
  }

  // ---------- GROUPING (for export) ----------
  const getCategoryGroups = (allItems) => {
    const groups = {};
    allItems.forEach(item => {
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

  // ---------- EXPORT: EXCEL ----------
  const handleExportExcel = () => {
    const allItems = items;
    const groups = getCategoryGroups(allItems);
    const filename = title || 'Inventory';

    const buildHeaders = () => {
      const headers = [];
      headers.push('#');
      if (isMasterInventory && visibleColumns.category) headers.push('Category');
      const order = [
        'brand', 'model', 'serial', 'specs', 'qty', 'price',
        'asset', 'assetCode', 'condition', 'remarks', 'location',
        'department', 'email', 'assignedTo', 'designation'
      ];
      if (isTrueMaster) {
        order.push('employeeId', 'dateOfIssuance');
      }
      order.forEach(key => {
        if (availableColumns.includes(key) && visibleColumns[key]) {
          headers.push(COLUMN_DEFS[key].label);
        }
      });
      return headers;
    };

    const buildRows = (itemsList) => {
      return itemsList.map((item, idx) => {
        const row = {};
        row['#'] = idx + 1;
        if (isMasterInventory && visibleColumns.category) {
          row['Category'] = item.type_name || '';
        }
        const valueMap = {
          brand: item.brand || '',
          model: item.model || '',
          serial: item.serial_number || '',
          specs: item.specifications || '',
          qty: item.quantity || 0,
          price: formatPKR(item.price),
          asset: item.asset || '',
          assetCode: item.asset_code || '',
          condition: item.condition || '',
          remarks: item.remarks || '',
          location: item.location || '',
          department: item.department || '',
          email: item.email || '',
          assignedTo: item.assigned_to || '',
          employeeId: item.employee_id || '',
          designation: item.designation || '',
          dateOfIssuance: formatDate(item.date_of_issuance),
        };
        const order = [
          'brand', 'model', 'serial', 'specs', 'qty', 'price',
          'asset', 'assetCode', 'condition', 'remarks', 'location',
          'department', 'email', 'assignedTo', 'designation'
        ];
        if (isTrueMaster) {
          order.push('employeeId', 'dateOfIssuance');
        }
        order.forEach(key => {
          if (availableColumns.includes(key) && visibleColumns[key]) {
            row[COLUMN_DEFS[key].label] = valueMap[key];
          }
        });
        return row;
      });
    };

    const headers = buildHeaders();
    const wb = XLSX.utils.book_new();

    const allRows = buildRows(allItems);
    const wsAll = XLSX.utils.json_to_sheet(allRows, { header: headers });
    XLSX.utils.book_append_sheet(wb, wsAll, 'All Items');

    groups.forEach(group => {
      const rows = buildRows(group.items);
      const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
      let sheetName = group.name.slice(0, 31);
      sheetName = sheetName.replace(/[\\/*?:[\]]/g, '');
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  // ---------- EXPORT: PDF ----------
  const handleExportPDF = () => {
    const allItems = items;
    const groups = getCategoryGroups(allItems);
    const filename = title || 'Inventory';

    const doc = new jsPDF('landscape', 'mm', 'a4');
    doc.setFont('helvetica');

    const headers = [];
    headers.push('#');
    if (isMasterInventory && visibleColumns.category) headers.push('Category');
    const order = [
      'brand', 'model', 'serial', 'specs', 'qty', 'price',
      'asset', 'assetCode', 'condition', 'remarks', 'location',
      'department', 'email', 'assignedTo', 'designation'
    ];
    if (isTrueMaster) {
      order.push('employeeId', 'dateOfIssuance');
    }
    order.forEach(key => {
      if (availableColumns.includes(key) && visibleColumns[key]) {
        headers.push(COLUMN_DEFS[key].label);
      }
    });

    const drawCategory = (group, startY) => {
      doc.setFontSize(16);
      doc.text(`${group.name} (${group.items.length} items)`, 14, startY);
      const yAfterTitle = startY + 8;

      const tableData = group.items.map((item, idx) => {
        const row = [];
        row.push(idx + 1);
        if (isMasterInventory && visibleColumns.category) row.push(item.type_name || '');
        const orderKeys = [
          'brand', 'model', 'serial', 'specs', 'qty', 'price',
          'asset', 'assetCode', 'condition', 'remarks', 'location',
          'department', 'email', 'assignedTo', 'designation'
        ];
        if (isTrueMaster) {
          orderKeys.push('employeeId', 'dateOfIssuance');
        }
        const valueMap = {
          brand: item.brand || '',
          model: item.model || '',
          serial: item.serial_number || '',
          specs: item.specifications || '',
          qty: item.quantity || 0,
          price: formatPKR(item.price),
          asset: item.asset || '',
          assetCode: item.asset_code || '',
          condition: item.condition || '',
          remarks: item.remarks || '',
          location: item.location || '',
          department: item.department || '',
          email: item.email || '',
          assignedTo: item.assigned_to || '',
          employeeId: item.employee_id || '',
          designation: item.designation || '',
          dateOfIssuance: formatDate(item.date_of_issuance),
        };
        orderKeys.forEach(key => {
          if (availableColumns.includes(key) && visibleColumns[key]) {
            row.push(valueMap[key]);
          }
        });
        return row;
      });

      autoTable(doc, {
        head: [headers],
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

    doc.save(`${filename}.pdf`);
  };

  // ---------- RENDER HELPERS ----------
  const renderHeaders = () => {
    const headers = [];
    headers.push(<th key="#">#</th>);
    if (isMasterInventory && visibleColumns.category) {
      headers.push(<th key="category">Category</th>);
    }
    const order = [
      'brand', 'model', 'serial', 'specs', 'qty', 'price',
      'asset', 'assetCode', 'condition', 'remarks', 'location',
      'department', 'email', 'assignedTo', 'designation'
    ];
    if (isTrueMaster) {
      order.push('employeeId', 'dateOfIssuance');
    }
    order.forEach(key => {
      if (availableColumns.includes(key) && visibleColumns[key]) {
        headers.push(<th key={key}>{COLUMN_DEFS[key].label}</th>);
      }
    });
    headers.push(<th key="actions">Actions</th>);
    return headers;
  };

  const getConditionBadge = (condition) => {
    if (!condition) return '-';
    const badges = {
      'New': <span className="condition new">🆕 New</span>,
      'Refurbed': <span className="condition refurbed">🔄 Refurbed</span>,
      'Damaged': <span className="condition damaged">❌ Damaged</span>,
      'Used': <span className="condition used">📦 Used</span>,
      'Condemned': <span className="condition condemned">⛔ Condemned</span>,
    };
    return badges[condition] || condition;
  };

  // ---------- RETURN MODAL HANDLERS ----------
  const openReturnModal = (item) => {
    setReturnItem(item);
    setReturnData({ email: '', backup_done: false, remarks: '' });
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
        returned_by: 'User'
      });
      alert('Item returned successfully!');
      setShowReturnModal(false);
      if (onRefresh) onRefresh();
      else {
        window.location.reload();
      }
    } catch (error) {
      console.error('Error returning item:', error);
      alert('Failed to return item');
    }
  };

  const renderRowCells = (item, index) => {
    const cells = [];
    cells.push(<td key={`${item.id}-num`}>{index + 1}</td>);
    if (isMasterInventory && visibleColumns.category) {
      cells.push(
        <td key={`${item.id}-category`}>
          <span className="category-tag">
            {item.type_icon || '📦'} {item.type_name}
          </span>
        </td>
      );
    }
    const order = [
      'brand', 'model', 'serial', 'specs', 'qty', 'price',
      'asset', 'assetCode', 'condition', 'remarks', 'location',
      'department', 'email', 'assignedTo', 'designation'
    ];
    if (isTrueMaster) {
      order.push('employeeId', 'dateOfIssuance');
    }
    const valueMap = {
      brand: item.brand || '-',
      model: item.model || '-',
      serial: item.serial_number || '-',
      specs: item.specifications || '-',
      qty: item.quantity,
      price: <span className="price-pkr">{formatPKR(item.price)}</span>,
      asset: <strong style={{ color: '#4361ee' }}>{item.asset || '-'}</strong>,
      assetCode: item.asset_code || '-',
      condition: getConditionBadge(item.condition),
      remarks: item.remarks || '-',
      location: item.location || '-',
      department: item.department || '-',
      email: item.email || '-',
      assignedTo: item.assigned_to || '-',
      employeeId: item.employee_id || '-',
      designation: item.designation || '-',
      dateOfIssuance: formatDate(item.date_of_issuance),
    };
    order.forEach(key => {
      if (availableColumns.includes(key) && visibleColumns[key]) {
        cells.push(<td key={`${item.id}-${key}`}>{valueMap[key]}</td>);
      }
    });
    cells.push(
      <td key={`${item.id}-actions`}>
        <div className="action-buttons">
          <button className="action-btn view" onClick={() => onViewItem && onViewItem(item)} title="View">
            <FaEye />
          </button>
          <button className="action-btn edit" onClick={() => onEditItem && onEditItem(item)} title="Edit">
            <FaEdit />
          </button>
          <button className="action-btn delete" onClick={() => onDeleteItem(item.id)} title="Delete">
            <FaTrash />
          </button>
          {item.assigned_to && (
            <button className="action-btn return" onClick={() => openReturnModal(item)} title="Return">
              <FaUndo /> Return
            </button>
          )}
        </div>
      </td>
    );
    return cells;
  };

  // ---------- FILTERING ----------
  const getFilteredItems = () => {
    let filtered = items;
    if (activeTab) {
      filtered = filtered.filter(item => item.type_id === activeTab);
    }
    if (conditionFilter) {
      if (conditionFilter === 'empty') {
        filtered = filtered.filter(item => !item.condition || item.condition === '');
      } else {
        filtered = filtered.filter(item => item.condition === conditionFilter);
      }
    }
    if (searchTerm && searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(item => {
        const fields = [
          item.name, item.brand, item.model, item.serial_number,
          item.asset, item.asset_code, item.assigned_to, item.employee_id,
          item.designation, item.location, item.department, item.specifications,
          item.type_name, item.email
        ];
        return fields.some(f => f && f.toLowerCase().includes(term));
      });
    }
    return filtered;
  };

  const filteredItems = getFilteredItems();
  const getActiveCategoryName = () => {
    if (!activeTab) return 'All Items';
    const cat = categories.find(c => c.id === activeTab);
    return cat ? cat.name : 'All Items';
  };
  const handleTabClick = (id) => setActiveTab(activeTab === id ? null : id);

  const visibleDataCols = availableColumns.filter(key => visibleColumns[key]).length;
  const colSpan = 2 + visibleDataCols;

  if (loading || loadingColumns) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading equipment...</p>
      </div>
    );
  }

  return (
    <div className="inventory-list">
      <div className="list-header">
        <h2>
          {isMasterInventory ? <FaDatabase /> : '📋'}
          {title || 'Inventory'}
          <span className="count">({items.length} items)</span>
        </h2>
        <div className="actions">
          <div className="filter-group">
            <select
              value={conditionFilter}
              onChange={(e) => setConditionFilter(e.target.value)}
              className="filter-select"
            >
              <option value="">All Conditions</option>
              <option value="New">🆕 New</option>
              <option value="Refurbed">🔄 Refurbed</option>
              <option value="Damaged">❌ Damaged</option>
              <option value="Used">📦 Used</option>
              <option value="Condemned">⛔ Condemned</option>
              <option value="empty">Empty</option>
            </select>
          </div>
          <div className="search-box">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search by name, brand, model, S/N, asset, email..."
              value={searchTerm}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
          {isItInventory && (
            <button className="btn-primary" onClick={onAddItem}>
              <FaPlus /> Add Equipment
            </button>
          )}
          {/* Manage Columns – only when a specific category is selected */}
          {categoryId && (
            <button className="btn-secondary" onClick={openManageColumns}>
              <FaColumns /> Manage Columns
            </button>
          )}
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
                      checked={visibleColumns[key] || false}
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

      {/* Manage Columns Modal */}
      {showManageColumns && (
        <div className="modal-overlay" onClick={() => setShowManageColumns(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2><FaColumns /> Manage Columns – {title}</h2>
              <button className="close-btn" onClick={() => setShowManageColumns(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '15px', color: '#666' }}>
                Check the columns you want to show in this category. Uncheck to hide them.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {editingColumns.map(col => (
                  <label key={col.key} style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', background: '#f5f5f5', borderRadius: '4px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={col.is_visible !== false}
                      onChange={() => toggleEditColumn(col.key)}
                      style={{ marginRight: '8px' }}
                    />
                    <span>{col.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button className="btn-cancel" onClick={() => setShowManageColumns(false)}>
                <FaTimes /> Cancel
              </button>
              <button className="btn-submit" onClick={saveCategoryColumns}>
                <FaSave /> Save Columns
              </button>
            </div>
          </div>
        </div>
      )}

      {isMasterInventory && categories.length > 0 && (
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
            {categories.map(cat => (
              <button
                key={cat.id}
                className={`master-tab ${activeTab === cat.id ? 'active' : ''}`}
                onClick={() => handleTabClick(cat.id)}
              >
                <span className="tab-icon">{cat.icon || '📦'}</span>
                <span className="tab-label">{cat.name}</span>
                <span className="tab-badge">{cat.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {isMasterInventory && activeTab && (
        <div className="active-category-label">
          Showing: <strong>{getActiveCategoryName()}</strong>
          <span className="count">({filteredItems.length} items)</span>
          <button className="clear-filter" onClick={() => setActiveTab(null)}>
            ✕ Clear Filter
          </button>
        </div>
      )}

      <div className="items-table">
        <table>
          <thead>
            <tr>{renderHeaders()}</tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="empty-state">
                  <div className="empty-icon">📭</div>
                  <h3>No Equipment Found</h3>
                  <p>Try adjusting your search or add new equipment.</p>
                  {isItInventory && (
                    <button className="btn-primary" onClick={onAddItem}>
                      <FaPlus /> Add Equipment
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              filteredItems.map((item, index) => (
                <tr key={item.id}>{renderRowCells(item, index)}</tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Return Modal */}
      {showReturnModal && returnItem && (
        <div className="modal-overlay" onClick={() => setShowReturnModal(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Return Asset – {returnItem.name}</h2>
              <button className="close-btn" onClick={() => setShowReturnModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={returnData.email}
                  onChange={handleReturnChange}
                  placeholder="email@domain.com"
                />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  name="backup_done"
                  checked={returnData.backup_done}
                  onChange={handleReturnChange}
                  id="backupCheck"
                />
                <label htmlFor="backupCheck">Backup Done?</label>
              </div>
              <div className="form-group">
                <label>Remarks</label>
                <textarea
                  name="remarks"
                  value={returnData.remarks}
                  onChange={handleReturnChange}
                  rows="3"
                  placeholder="Any notes about the return..."
                />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn-cancel" onClick={() => setShowReturnModal(false)}>Cancel</button>
              <button className="btn-submit" onClick={submitReturn}>Confirm Return</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryList;
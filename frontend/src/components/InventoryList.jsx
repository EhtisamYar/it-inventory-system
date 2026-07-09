import React, { useState, useEffect, useRef } from 'react';
import {
  FaPlus, FaTrash, FaSearch, FaEye, FaEdit, FaColumns, FaTimes, FaInbox,
  FaLayerGroup, FaFileExport
} from 'react-icons/fa';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const formatPKR = (amount) => {
  if (!amount) return 'Rs 0';
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace('PKR', 'Rs');
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-GB');
};

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

const CATEGORY_COLUMN_PRESETS = {
  'Printers': ['brand', 'model', 'serial', 'assignedTo', 'assetCode'],
  'Copiers': ['brand', 'model', 'serial', 'assignedTo', 'assetCode'],
  'Scanners': ['brand', 'model', 'serial', 'assignedTo', 'assetCode'],
};

const DEFAULT_VISIBLE = Object.keys(COLUMN_DEFS).reduce((acc, key) => {
  acc[key] = true;
  return acc;
}, {});

// ---- Design tokens -------------------------------------------------------
const INK = '#14161F';
const PAPER = '#F2F0EA';
const TEAL = '#1F6F78';
const AMBER = '#C08A1E';
const CATEGORY_TINTS = ['#1F6F78', '#B45309', '#5B4B8A', '#0F766E', '#9A3412', '#4D5B8A', '#7C5A2A', '#3F6B3A'];
const getTint = (index) => CATEGORY_TINTS[index % CATEGORY_TINTS.length];

const CONDITION_STYLES = {
  New: { bg: '#EAF4EF', text: '#1F6F4A', dot: '#2E9E64' },
  Refurbed: { bg: '#EAF1F4', text: '#1F6F78', dot: '#3B98A6' },
  Damaged: { bg: '#FBEDEA', text: '#B4442B', dot: '#D25B3F' },
  Used: { bg: '#F1EFE9', text: '#6B6353', dot: '#A69A81' },
  Condemned: { bg: '#F7E9E5', text: '#8A2E1B', dot: '#8A2E1B' },
};

const CONDITIONS = ['New', 'Refurbed', 'Damaged', 'Used', 'Condemned'];

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
  showCategoryTabs = false,
}) => {
  const [activeTab, setActiveTab] = useState(null);
  const [conditionFilter, setConditionFilter] = useState('');
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const columnRef = useRef(null);
  const exportRef = useRef(null);
  
  const isTrueMaster = isMaster && !isItInventory;
  const isMasterInventory = isMaster || title === 'Master Inventory' || title === 'IT Inventory (Unassigned)';

  // ---------- Compute categories – ALWAYS for Master ----------
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
  if (isMasterInventory || showCategoryTabs) {
    if (types && types.length > 0 && isMasterInventory) {
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

  const categoryTintMap = {};
  categories.forEach((cat, idx) => {
    categoryTintMap[cat.id] = getTint(idx);
  });

  // ---------- Column visibility ----------
  const getDefaultVisible = () => {
    const stored = localStorage.getItem('inventory_columns');
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
    localStorage.setItem('inventory_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

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
          localStorage.setItem('inventory_columns', JSON.stringify(newVisibility));
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

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

  const toggleColumn = (key) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getColumnKeys = () => {
    const base = [
      'brand', 'model', 'serial', 'specs', 'qty', 'price',
      'asset', 'assetCode', 'condition', 'remarks', 'location',
      'department', 'email'
    ];
    if (isMasterInventory) base.unshift('category');
    if (isTrueMaster) base.push('assignedTo', 'employeeId', 'designation', 'dateOfIssuance');
    return base.filter(key => COLUMN_DEFS[key]);
  };
  const availableColumns = getColumnKeys();

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

  const columnOrder = [
    'brand', 'model', 'serial', 'specs', 'qty', 'price',
    'asset', 'assetCode', 'condition', 'remarks', 'location',
    'department', 'email'
  ];
  if (isTrueMaster) {
    columnOrder.push('assignedTo', 'employeeId', 'designation', 'dateOfIssuance');
  }

  const buildValueMap = (item) => ({
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
  });

  // ---------- Render helpers ----------
  const MONO_KEYS = new Set(['serial', 'assetCode', 'qty', 'price', 'employeeId']);

  const getConditionBadge = (condition) => {
    if (!condition) return <span style={styles.dash}>-</span>;
    const c = CONDITION_STYLES[condition];
    if (!c) return condition;
    return (
      <span style={{ ...styles.conditionBadge, background: c.bg, color: c.text }}>
        <span style={{ ...styles.conditionDot, background: c.dot }} />
        {condition}
      </span>
    );
  };

  const renderHeaders = () => {
    const headers = [<th key="#" style={styles.th}>#</th>];
    if (isMasterInventory && visibleColumns.category) {
      headers.push(<th key="category" style={styles.th}>Category</th>);
    }
    columnOrder.forEach(key => {
      if (availableColumns.includes(key) && visibleColumns[key]) {
        headers.push(<th key={key} style={styles.th}>{COLUMN_DEFS[key].label}</th>);
      }
    });
    headers.push(<th key="actions" style={{ ...styles.th, textAlign: 'right' }}>Actions</th>);
    return headers;
  };

  // Row render for normal (non‑master) view
  const renderRowCells = (item, index) => {
    const cells = [<td key={`${item.id}-num`} style={{ ...styles.td, ...styles.tdMono, color: '#B9B3A4' }}>{String(index + 1).padStart(3, '0')}</td>];
    if (isMasterInventory && visibleColumns.category) {
      const tint = categoryTintMap[item.type_id] || '#6B6353';
      cells.push(
        <td key={`${item.id}-category`} style={styles.td}>
          <span style={styles.categoryTag}>
            <TagGlyph color={tint} />
            {item.type_name}
          </span>
        </td>
      );
    }
    const dash = <span style={styles.dash}>-</span>;
    const valueMap = {
      brand: item.brand || dash,
      model: item.model || dash,
      serial: item.serial_number || dash,
      specs: item.specifications || dash,
      qty: item.quantity,
      price: <span style={styles.price}>{formatPKR(item.price)}</span>,
      asset: <span style={styles.assetLink}>{item.asset || '-'}</span>,
      assetCode: item.asset_code || dash,
      condition: getConditionBadge(item.condition),
      remarks: item.remarks || dash,
      location: item.location || dash,
      department: item.department || dash,
      email: item.email || dash,
      assignedTo: item.assigned_to || dash,
      employeeId: item.employee_id || dash,
      designation: item.designation || dash,
      dateOfIssuance: formatDate(item.date_of_issuance),
    };
    columnOrder.forEach(key => {
      if (availableColumns.includes(key) && visibleColumns[key]) {
        cells.push(
          <td key={`${item.id}-${key}`} style={{ ...styles.td, ...(MONO_KEYS.has(key) ? styles.tdMono : {}) }}>
            {valueMap[key]}
          </td>
        );
      }
    });
    cells.push(
      <td key={`${item.id}-actions`} style={{ ...styles.td, textAlign: 'right' }}>
        <div style={styles.actionRow}>
          <button className="gl-icon-btn gl-icon-view" style={styles.iconBtn} onClick={() => onViewItem && onViewItem(item)} title="View">
            <FaEye size={12} />
          </button>
          <button className="gl-icon-btn gl-icon-edit" style={styles.iconBtn} onClick={() => onEditItem && onEditItem(item)} title="Edit">
            <FaEdit size={12} />
          </button>
          <button className="gl-icon-btn gl-icon-delete" style={styles.iconBtn} onClick={() => onDeleteItem(item.id)} title="Delete">
            <FaTrash size={12} />
          </button>
        </div>
      </td>
    );
    return cells;
  };

  // Table body for Master grouped view (with category filter applied)
  const renderTableBody = (itemsList, startIndex = 0) => {
    if (itemsList.length === 0) {
      return (
        <tr>
          <td colSpan={2 + availableColumns.filter(key => visibleColumns[key]).length} style={styles.emptyCell}>
            <div style={styles.emptyWrap}>
              <div style={styles.emptyIcon}><FaInbox size={18} /></div>
              <h3 style={styles.emptyTitle}>No items</h3>
              <p style={styles.emptyText}>No items match the current filters.</p>
            </div>
          </td>
        </tr>
      );
    }
    return itemsList.map((item, index) => {
      const cells = [
        <td key={`${item.id}-num`} style={{ ...styles.td, ...styles.tdMono, color: '#B9B3A4' }}>
          {String(startIndex + index + 1).padStart(3, '0')}
        </td>
      ];
      if (isMasterInventory && visibleColumns.category) {
        const tint = categoryTintMap[item.type_id] || '#6B6353';
        cells.push(
          <td key={`${item.id}-category`} style={styles.td}>
            <span style={styles.categoryTag}>
              <TagGlyph color={tint} />
              {item.type_name}
            </span>
          </td>
        );
      }
      const dash = <span style={styles.dash}>-</span>;
      const valueMap = {
        brand: item.brand || dash,
        model: item.model || dash,
        serial: item.serial_number || dash,
        specs: item.specifications || dash,
        qty: item.quantity,
        price: <span style={styles.price}>{formatPKR(item.price)}</span>,
        asset: <span style={styles.assetLink}>{item.asset || '-'}</span>,
        assetCode: item.asset_code || dash,
        condition: getConditionBadge(item.condition),
        remarks: item.remarks || dash,
        location: item.location || dash,
        department: item.department || dash,
        email: item.email || dash,
        assignedTo: item.assigned_to || dash,
        employeeId: item.employee_id || dash,
        designation: item.designation || dash,
        dateOfIssuance: formatDate(item.date_of_issuance),
      };
      columnOrder.forEach(key => {
        if (availableColumns.includes(key) && visibleColumns[key]) {
          cells.push(
            <td key={`${item.id}-${key}`} style={{ ...styles.td, ...(MONO_KEYS.has(key) ? styles.tdMono : {}) }}>
              {valueMap[key]}
            </td>
          );
        }
      });
      cells.push(
        <td key={`${item.id}-actions`} style={{ ...styles.td, textAlign: 'right' }}>
          <div style={styles.actionRow}>
            <button className="gl-icon-btn gl-icon-view" style={styles.iconBtn} onClick={() => onViewItem && onViewItem(item)} title="View">
              <FaEye size={12} />
            </button>
            <button className="gl-icon-btn gl-icon-edit" style={styles.iconBtn} onClick={() => onEditItem && onEditItem(item)} title="Edit">
              <FaEdit size={12} />
            </button>
            <button className="gl-icon-btn gl-icon-delete" style={styles.iconBtn} onClick={() => onDeleteItem(item.id)} title="Delete">
              <FaTrash size={12} />
            </button>
          </div>
        </td>
      );
      return <tr key={item.id} className="gl-row">{cells}</tr>;
    });
  };

  // ---------- Filtering logic ----------
  // For normal view
  const getFilteredItems = () => {
    let filtered = items;
    if (activeTab) filtered = filtered.filter(item => item.type_id === activeTab);
    if (conditionFilter) {
      filtered = conditionFilter === 'empty'
        ? filtered.filter(item => !item.condition || item.condition === '')
        : filtered.filter(item => item.condition === conditionFilter);
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

  // For Master grouped view – each group is filtered by activeTab (category) and search term
  const getMasterGroups = () => {
    const unassigned = items.filter(item => !item.assigned_to || item.assigned_to.trim() === '');
    const assigned = items.filter(item => item.assigned_to && item.assigned_to.trim() !== '');
    const condemned = items.filter(item => item.condition === 'Condemned');
    // Remove condemned from the other groups to avoid duplication
    const unassignedFiltered = unassigned.filter(item => item.condition !== 'Condemned');
    const assignedFiltered = assigned.filter(item => item.condition !== 'Condemned');
    return { unassigned: unassignedFiltered, assigned: assignedFiltered, condemned };
  };

  const getFilteredGroup = (groupItems) => {
    let filtered = groupItems;
    // Apply category filter (activeTab)
    if (activeTab) {
      filtered = filtered.filter(item => item.type_id === activeTab);
    }
    // Apply search term
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

  // ---------- Export handlers ----------
  const handleExportExcel = () => {
    setShowExportDropdown(false);
    let exportItems = isTrueMaster ? items : filteredItems;
    if (exportItems.length === 0) {
      alert('No items to export.');
      return;
    }
    if (isTrueMaster && activeTab) {
      exportItems = exportItems.filter(item => item.type_id === activeTab);
    }
    const groups = getCategoryGroups(exportItems);
    const filename = title || 'Inventory';
    const categoryLabel = activeTab 
      ? `_${categories.find(c => c.id === activeTab)?.name || ''}` 
      : '';

    const buildHeaders = () => {
      const headers = ['#'];
      if (isMasterInventory && visibleColumns.category) headers.push('Category');
      columnOrder.forEach(key => {
        if (availableColumns.includes(key) && visibleColumns[key]) headers.push(COLUMN_DEFS[key].label);
      });
      return headers;
    };

    const buildRows = (itemsList) => itemsList.map((item, idx) => {
      const row = { '#': idx + 1 };
      if (isMasterInventory && visibleColumns.category) row['Category'] = item.type_name || '';
      const valueMap = buildValueMap(item);
      columnOrder.forEach(key => {
        if (availableColumns.includes(key) && visibleColumns[key]) row[COLUMN_DEFS[key].label] = valueMap[key];
      });
      return row;
    });

    const headers = buildHeaders();
    const wb = XLSX.utils.book_new();
    const wsAll = XLSX.utils.json_to_sheet(buildRows(exportItems), { header: headers });
    XLSX.utils.book_append_sheet(wb, wsAll, 'All Items');

    groups.forEach(group => {
      const ws = XLSX.utils.json_to_sheet(buildRows(group.items), { header: headers });
      let sheetName = group.name.slice(0, 31).replace(/[\\/*?:[\]]/g, '');
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    XLSX.writeFile(wb, `${filename}${categoryLabel}.xlsx`);
  };

  const handleExportPDF = () => {
    setShowExportDropdown(false);
    let exportItems = isTrueMaster ? items : filteredItems;
    if (exportItems.length === 0) {
      alert('No items to export.');
      return;
    }
    if (isTrueMaster && activeTab) {
      exportItems = exportItems.filter(item => item.type_id === activeTab);
    }
    const groups = getCategoryGroups(exportItems);
    const filename = title || 'Inventory';
    const categoryLabel = activeTab 
      ? `_${categories.find(c => c.id === activeTab)?.name || ''}` 
      : '';

    const doc = new jsPDF('landscape', 'mm', 'a4');
    doc.setFont('helvetica');

    const headers = ['#'];
    if (isMasterInventory && visibleColumns.category) headers.push('Category');
    columnOrder.forEach(key => {
      if (availableColumns.includes(key) && visibleColumns[key]) headers.push(COLUMN_DEFS[key].label);
    });

    const drawCategory = (group, startY) => {
      doc.setFontSize(16);
      doc.text(`${group.name} (${group.items.length} items)`, 14, startY);
      const yAfterTitle = startY + 8;

      const tableData = group.items.map((item, idx) => {
        const row = [idx + 1];
        if (isMasterInventory && visibleColumns.category) row.push(item.type_name || '');
        const valueMap = buildValueMap(item);
        columnOrder.forEach(key => {
          if (availableColumns.includes(key) && visibleColumns[key]) row.push(valueMap[key]);
        });
        return row;
      });

      autoTable(doc, {
        head: [headers],
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

    doc.save(`${filename}${categoryLabel}.pdf`);
  };

  // ---------- UI helpers ----------
  const getActiveCategoryName = () => {
    if (!activeTab) return 'All items';
    const cat = categories.find(c => c.id === activeTab);
    return cat ? cat.name : 'All items';
  };
  const handleTabClick = (id) => setActiveTab(activeTab === id ? null : id);

  const visibleDataCols = availableColumns.filter(key => visibleColumns[key]).length;
  const colSpan = 2 + visibleDataCols;

  // -------- Normal view (IT Inventory, Condemned, or category) --------
  const filteredItems = getFilteredItems();

  // -------- Master grouped view --------
  const groups = getMasterGroups();
  const filteredUnassigned = getFilteredGroup(groups.unassigned);
  const filteredAssigned = getFilteredGroup(groups.assigned);
  const filteredCondemned = getFilteredGroup(groups.condemned);
  const totalFiltered = filteredUnassigned.length + filteredAssigned.length + filteredCondemned.length;
  const totalItems = items.length;

  // -------- Loading state --------
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

  // ===================== RENDER =====================
  return (
    <div style={styles.page}>
      <style>{sheet}</style>
      <div style={styles.frame}>
        {/* Top bar */}
        <header style={styles.topbar}>
          <div style={styles.brandBlock}>
            <div style={styles.mark}>IT</div>
            <div>
              <h1 style={styles.brandTitle}>
                {isTrueMaster ? 'Master Inventory' : (activeTab ? getActiveCategoryName() : (title || 'Inventory'))}
              </h1>
              <p style={styles.brandSub}>Fauji Foods · Asset manifest</p>
            </div>
          </div>

          <div style={styles.headerActions}>
            <div style={styles.searchBox}>
              <FaSearch style={styles.searchIcon} size={12} />
              <input
                type="text"
                placeholder="Search assets…"
                value={searchTerm}
                onChange={(e) => onSearch(e.target.value)}
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
                  <button style={styles.exportOption} onClick={handleExportExcel}>
                    Export {activeTab ? getActiveCategoryName() : 'All'} as Excel
                  </button>
                  <button style={styles.exportOption} onClick={handleExportPDF}>
                    Export {activeTab ? getActiveCategoryName() : 'All'} as PDF
                  </button>
                </div>
              )}
            </div>

            {isItInventory && (
              <button className="gl-btn-primary" style={styles.btnPrimary} onClick={onAddItem}>
                <FaPlus size={12} /> Add equipment
              </button>
            )}
          </div>
        </header>

        {/* Stat strip */}
        {isMasterInventory && (
          <div style={styles.statStrip}>
            <div style={styles.statBlock}>
              <span style={styles.statValue}>{String(totalItems).padStart(3, '0')}</span>
              <span style={styles.statLabel}>Total assets</span>
            </div>
            <div style={styles.statDivider} />
            <div style={styles.statBlock}>
              <span style={styles.statValue}>{formatPKR(items.reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 1), 0))}</span>
              <span style={styles.statLabel}>Total value</span>
            </div>
            <div style={styles.statDivider} />
            <div style={styles.statBlock}>
              <span style={styles.statValue}>{String(categories.length).padStart(2, '0')}</span>
              <span style={styles.statLabel}>Categories</span>
            </div>
            <div style={styles.statDivider} />
            <div style={styles.statBlock}>
              <span style={{ ...styles.statValue, color: totalFiltered !== totalItems ? TEAL : INK }}>
                {totalFiltered}
              </span>
              <span style={styles.statLabel}>Matching filters</span>
            </div>
          </div>
        )}

        {/* ===== CATEGORY TABS – SHOW FOR MASTER TOO ===== */}
        {(isMasterInventory || showCategoryTabs) && categories.length > 0 && (
          <div style={styles.tabRow}>
            <button
              onClick={() => setActiveTab(null)}
              style={{ ...styles.tabPill, ...(!activeTab ? styles.tabPillActive : {}) }}
            >
              All Categories
              <span style={{ ...styles.tabCount, ...(!activeTab ? styles.tabCountActive : {}) }}>{totalItems}</span>
            </button>
            {categories.map(cat => {
              const tint = categoryTintMap[cat.id];
              const isActive = activeTab === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleTabClick(cat.id)}
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

        {/* Condition filter – only for non‑master views */}
        {!isTrueMaster && isMasterInventory && (
          <div style={styles.conditionRow}>
            <span style={styles.conditionLabel}>Condition</span>
            <button
              onClick={() => setConditionFilter('')}
              style={{ ...styles.conditionPill, ...(!conditionFilter ? styles.conditionPillActive : {}) }}
            >
              Any
            </button>
            {CONDITIONS.map(c => (
              <button
                key={c}
                onClick={() => setConditionFilter(conditionFilter === c ? '' : c)}
                style={{ ...styles.conditionPill, ...(conditionFilter === c ? styles.conditionPillActive : {}) }}
              >
                <span style={{ ...styles.conditionPillDot, background: CONDITION_STYLES[c]?.dot || '#9CA3AF' }} />
                {c}
              </button>
            ))}
          </div>
        )}

        {/* ===== MAIN CONTENT ===== */}
        {isTrueMaster ? (
          // -------- MASTER VIEW: grouped sections – but skip empty ones --------
          <div>
            {/* Only render section if filteredUnassigned has items */}
            {filteredUnassigned.length > 0 && (
              <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '18px' }}>📦</span>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: INK }}>IT Inventory (Unassigned)</h3>
                  <span style={{ background: '#EAF1F4', color: TEAL, padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
                    {filteredUnassigned.length}
                  </span>
                </div>
                <div style={styles.tableCard}>
                  <div style={styles.tableScroll}>
                    <table style={styles.table}>
                      <thead><tr>{renderHeaders()}</tr></thead>
                      <tbody>{renderTableBody(filteredUnassigned, 0)}</tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Only render section if filteredAssigned has items */}
            {filteredAssigned.length > 0 && (
              <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '18px' }}>👤</span>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: INK }}>Assigned Items</h3>
                  <span style={{ background: '#FBF3E3', color: AMBER, padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
                    {filteredAssigned.length}
                  </span>
                </div>
                <div style={styles.tableCard}>
                  <div style={styles.tableScroll}>
                    <table style={styles.table}>
                      <thead><tr>{renderHeaders()}</tr></thead>
                      <tbody>{renderTableBody(filteredAssigned, filteredUnassigned.length)}</tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Only render section if filteredCondemned has items */}
            {filteredCondemned.length > 0 && (
              <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '18px' }}>⛔</span>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: INK }}>Condemned Items</h3>
                  <span style={{ background: '#FBEDEA', color: '#B4442B', padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
                    {filteredCondemned.length}
                  </span>
                </div>
                <div style={styles.tableCard}>
                  <div style={styles.tableScroll}>
                    <table style={styles.table}>
                      <thead><tr>{renderHeaders()}</tr></thead>
                      <tbody>{renderTableBody(filteredCondemned, filteredUnassigned.length + filteredAssigned.length)}</tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* If all sections are empty, show a single "No items" message */}
            {filteredUnassigned.length === 0 && filteredAssigned.length === 0 && filteredCondemned.length === 0 && (
              <div style={styles.tableCard}>
                <div style={styles.tableScroll}>
                  <table style={styles.table}>
                    <thead><tr>{renderHeaders()}</tr></thead>
                    <tbody>
                      <tr>
                        <td colSpan={colSpan} style={styles.emptyCell}>
                          <div style={styles.emptyWrap}>
                            <div style={styles.emptyIcon}><FaInbox size={18} /></div>
                            <h3 style={styles.emptyTitle}>No items match</h3>
                            <p style={styles.emptyText}>Try adjusting your search or category filter.</p>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          // -------- NORMAL VIEW (single table) --------
          <div style={styles.tableCard}>
            <div style={styles.tableScroll}>
              <table style={styles.table}>
                <thead><tr>{renderHeaders()}</tr></thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={colSpan} style={styles.emptyCell}>
                        <div style={styles.emptyWrap}>
                          <div style={styles.emptyIcon}><FaInbox size={18} /></div>
                          <h3 style={styles.emptyTitle}>No equipment found</h3>
                          <p style={styles.emptyText}>Try adjusting your search or filters.</p>
                          {isItInventory && (
                            <button className="gl-btn-primary" style={styles.btnPrimary} onClick={onAddItem}>
                              <FaPlus size={12} /> Add equipment
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item, index) => (
                      <tr key={item.id} className="gl-row">{renderRowCells(item, index)}</tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------- Styles ----------
 
// ========== STYLES (unchanged) ==========
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
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 700,
    fontSize: '13px',
    letterSpacing: '0.02em',
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
    flexWrap: 'wrap',
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
    marginBottom: '10px',
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

  /* Condition row */
  conditionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '18px',
    flexWrap: 'wrap',
  },
  conditionLabel: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#9C9585',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginRight: '4px',
  },
  conditionPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    height: '26px',
    padding: '0 10px',
    borderRadius: '13px',
    border: '1px solid transparent',
    background: 'transparent',
    fontSize: '12px',
    color: '#6B6353',
    cursor: 'pointer',
  },
  conditionPillActive: {
    background: '#fff',
    border: '1px solid #DEDACD',
    color: INK,
    fontWeight: 600,
  },
  conditionPillDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    flexShrink: 0,
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
  conditionBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '3px 9px',
    borderRadius: '6px',
    fontSize: '11.5px',
    fontWeight: 600,
  },
  conditionDot: {
    width: '5px',
    height: '5px',
    borderRadius: '50%',
  },
  price: { fontWeight: 700, color: INK },
  assetLink: { fontWeight: 600, color: TEAL },
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
.gl-checkbox-row:hover { background: #FAF8F3; }
input[type=text]::placeholder { color: #9C9585; }
input:focus { border-color: #1F6F78 !important; box-shadow: 0 0 0 3px rgba(31,111,120,0.12); }
`;

export default InventoryList;
import React, { useState, useEffect, useRef } from 'react';
import { 
  FaPlus, FaTrash, FaSearch, FaDatabase, FaEye, FaEdit, FaColumns
} from 'react-icons/fa';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExportDropdown from './ExportDropdown';

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

// Column definitions – added "Email"
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
  email: { label: 'Email', always: false },   // ✅ new
  assignedTo: { label: 'Assigned To', always: false },
  employeeId: { label: 'Employee ID', always: false },
  designation: { label: 'Designation', always: false },
  dateOfIssuance: { label: 'Date of Issuance', always: false },
};

// Category presets (optional)
const CATEGORY_COLUMN_PRESETS = {
  'Printers': ['brand', 'model', 'serial', 'assignedTo', 'assetCode'],
  'Copiers': ['brand', 'model', 'serial', 'assignedTo', 'assetCode'],
  'Scanners': ['brand', 'model', 'serial', 'assignedTo', 'assetCode'],
};

const DEFAULT_VISIBLE = Object.keys(COLUMN_DEFS).reduce((acc, key) => {
  acc[key] = true;
  return acc;
}, {});

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
}) => {
  const [activeTab, setActiveTab] = useState(null);
  const [conditionFilter, setConditionFilter] = useState('');
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const isMasterInventory = isMaster || title === 'Master Inventory' || title === 'IT Inventory (Unassigned)';
  const isTrueMaster = isMaster && !isItInventory;

  // ---------- COLUMN VISIBILITY ----------
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

  // Apply category preset when tab changes
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

  // Apply presets (optional)
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
  }, [activeTab, categories]);

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

  // Available columns for this view
  const getColumnKeys = () => {
    const base = [
      'brand', 'model', 'serial', 'specs', 'qty', 'price',
      'asset', 'assetCode', 'condition', 'remarks', 'location',
      'department', 'email'   // ✅ added email
    ];
    if (isMasterInventory) base.unshift('category');
    if (isTrueMaster) base.push('assignedTo', 'employeeId', 'designation', 'dateOfIssuance');
    return base.filter(key => COLUMN_DEFS[key]);
  };
  const availableColumns = getColumnKeys();

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
        'department', 'email'   // ✅ added
      ];
      if (isTrueMaster) {
        order.push('assignedTo', 'employeeId', 'designation', 'dateOfIssuance');
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
          email: item.email || '',   // ✅ added
          assignedTo: item.assigned_to || '',
          employeeId: item.employee_id || '',
          designation: item.designation || '',
          dateOfIssuance: formatDate(item.date_of_issuance),
        };
        const order = [
          'brand', 'model', 'serial', 'specs', 'qty', 'price',
          'asset', 'assetCode', 'condition', 'remarks', 'location',
          'department', 'email'   // ✅ added
        ];
        if (isTrueMaster) {
          order.push('assignedTo', 'employeeId', 'designation', 'dateOfIssuance');
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
      'department', 'email'   // ✅ added
    ];
    if (isTrueMaster) {
      order.push('assignedTo', 'employeeId', 'designation', 'dateOfIssuance');
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
          'department', 'email'   // ✅ added
        ];
        if (isTrueMaster) {
          orderKeys.push('assignedTo', 'employeeId', 'designation', 'dateOfIssuance');
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
          email: item.email || '',   // ✅ added
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
      'department', 'email'   // ✅ added
    ];
    if (isTrueMaster) {
      order.push('assignedTo', 'employeeId', 'designation', 'dateOfIssuance');
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
      'department', 'email'   // ✅ added
    ];
    if (isTrueMaster) {
      order.push('assignedTo', 'employeeId', 'designation', 'dateOfIssuance');
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
      email: item.email || '-',   // ✅ added
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
          item.type_name, item.email   // ✅ added email
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

  if (loading) {
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
    </div>
  );
};

export default InventoryList;
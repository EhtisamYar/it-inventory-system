import React, { useState, useEffect, useRef } from 'react';
import {
  FaPlus, FaTrash, FaSearch, FaEye, FaEdit, FaColumns, FaTimes, FaInbox,
  FaChevronDown, FaLayerGroup, FaFileExport, FaFileExcel  // ← added FaFileExcel
} from 'react-icons/fa';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ImportExcel from './ImportExcel';  // ← new import

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
  categoryId,      // ← new: to pass to import modal
  onRefresh,       // ← new: to refresh after import
}) => {
  const [activeTab, setActiveTab] = useState(null);
  const [conditionFilter, setConditionFilter] = useState('');
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showImportDropdown, setShowImportDropdown] = useState(false);  // ← new
  const [showImportExcel, setShowImportExcel] = useState(false);        // ← new
  const columnRef = useRef(null);
  const exportRef = useRef(null);
  const importRef = useRef(null);  // ← new

  const isMasterInventory = isMaster || title === 'Master Inventory' || title === 'IT Inventory (Unassigned)';
  const isTrueMaster = isMaster && !isItInventory;

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

  const categoryTintMap = {};
  categories.forEach((cat, idx) => {
    categoryTintMap[cat.id] = getTint(idx);
  });

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
      if (importRef.current && !importRef.current.contains(event.target)) {  // ← new
        setShowImportDropdown(false);
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

  const handleExportExcel = () => {
    setShowExportDropdown(false);
    const allItems = items;
    const groups = getCategoryGroups(allItems);
    const filename = title || 'Inventory';

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
    const wsAll = XLSX.utils.json_to_sheet(buildRows(allItems), { header: headers });
    XLSX.utils.book_append_sheet(wb, wsAll, 'All Items');

    groups.forEach(group => {
      const ws = XLSX.utils.json_to_sheet(buildRows(group.items), { header: headers });
      let sheetName = group.name.slice(0, 31).replace(/[\\/*?:[\]]/g, '');
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const handleExportPDF = () => {
    setShowExportDropdown(false);
    const allItems = items;
    const groups = getCategoryGroups(allItems);
    const filename = title || 'Inventory';

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
        headStyles: { fillColor: [79, 70, 229], font: 'helvetica' },
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

  const renderRowCells = (item, index) => {
    const cells = [<td key={`${item.id}-num`} style={{ ...styles.td, color: '#C1C4CC' }}>{index + 1}</td>];
    if (isMasterInventory && visibleColumns.category) {
      const tint = categoryTintMap[item.type_id] || '#6B7280';
      cells.push(
        <td key={`${item.id}-category`} style={styles.td}>
          <span style={styles.categoryTag}>
            <span style={{ ...styles.categoryDot, background: tint }} />
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
        cells.push(<td key={`${item.id}-${key}`} style={styles.td}>{valueMap[key]}</td>);
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
        {/* Sidebar — category navigation lives here now, out of the way of the data */}
        {isMasterInventory && categories.length > 0 && (
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

              {categories.map(cat => {
                const tint = categoryTintMap[cat.id];
                const isActive = activeTab === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleTabClick(cat.id)}
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
        )}

        {/* Main workspace */}
        <main style={styles.main}>
          <div style={styles.mainHeader}>
            <div>
              <h1 style={styles.listTitle}>
                {activeTab ? getActiveCategoryName() : (title || 'Inventory')}
              </h1>
              <p style={styles.titleSub}>{filteredItems.length} of {items.length} items{conditionFilter ? ` · ${conditionFilter}` : ''}</p>
            </div>

            <div style={styles.headerActions}>
              <div style={styles.searchBox}>
                <FaSearch style={styles.searchIcon} size={12} />
                <input
                  type="text"
                  placeholder="Search…"
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

              {/* ===== NEW: Import dropdown ===== */}
              <div style={{ position: 'relative' }} ref={importRef}>
                <button style={styles.iconOnlyBtn} onClick={() => setShowImportDropdown(!showImportDropdown)} title="Import">
                  <FaFileExcel size={13} />
                </button>
                {showImportDropdown && (
                  <div style={{ ...styles.dropdown, minWidth: '150px' }}>
                    <button style={styles.exportOption} onClick={() => {
                      setShowImportDropdown(false);
                      setShowImportExcel(true);
                    }}>
                      Import Excel
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
        </main>
      </div>

      {/* ===== Import Excel Modal ===== */}
      {showImportExcel && (
        <ImportExcel
          categoryId={categoryId}
          categories={categories}   // pass categories for dropdown (if no categoryId)
          onClose={() => setShowImportExcel(false)}
          onSuccess={() => {
            if (onRefresh) onRefresh();
            else window.location.reload();
          }}
        />
      )}
    </div>
  );
};



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

  /* Sidebar */
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

  /* Main */
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

  /* Table */
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
  categoryTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12.5px',
    fontWeight: 600,
    color: '#4B5563',
  },
  categoryDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    flexShrink: 0,
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
  price: { fontWeight: 600, color: '#111827' },
  assetLink: { fontWeight: 600, color: ACCENT },
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
.gl-checkbox-row:hover { background: #F9FAFB; }
input[type=text]::placeholder { color: #9CA3AF; }
input:focus { border-color: #4F46E5 !important; box-shadow: 0 0 0 3px rgba(79,70,229,0.12); }

@media (max-width: 900px) {
  .gl-sidebar { display: none; }
}
`;

export default InventoryList;

import React, { useState } from 'react';
import { FaTimes } from 'react-icons/fa';

// All possible column keys (must match those in InventoryList)
const ALL_COLUMNS = [
  'brand', 'model', 'serial', 'specs', 'qty', 'price',
  'asset', 'assetCode', 'condition', 'remarks', 'location',
  'department', 'email', 'assignedTo', 'employeeId',
  'designation', 'dateOfIssuance'
];

const AddType = ({ onClose, onAdd, existingTypes = [] }) => {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('💻');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedColumns, setSelectedColumns] = useState(ALL_COLUMNS); // all checked by default

  // Pre-defined IT Categories with icons
  const itCategories = [
    { name: 'Laptops', icon: '💻' },
    { name: 'Desktop PCs', icon: '🖥️' },
    { name: 'Monitors', icon: '🖥️' },
    { name: 'Printers', icon: '🖨️' },
    { name: 'Cameras', icon: '📷' },
    { name: 'CCTV Cameras', icon: '📹' },
    { name: 'Webcams', icon: '🎥' },
    { name: 'Switches', icon: '🔀' },
    { name: 'Routers', icon: '📡' },
    { name: 'Network Devices', icon: '📡' },
    { name: 'Firewalls', icon: '🛡️' },
    { name: 'Servers', icon: '🖥️' },
    { name: 'Storage Devices', icon: '💾' },
    { name: 'Hard Drives', icon: '💾' },
    { name: 'UPS/Batteries', icon: '🔋' },
    { name: 'Cables & Adapters', icon: '🔌' },
    { name: 'Peripherals', icon: '⌨️' },
    { name: 'Keyboards', icon: '⌨️' },
    { name: 'Mouse', icon: '🖱️' },
    { name: 'Headphones', icon: '🎧' },
    { name: 'Speakers', icon: '🔊' },
    { name: 'Phones', icon: '📱' },
    { name: 'Tablets', icon: '📱' },
    { name: 'Projectors', icon: '📽️' },
    { name: 'Software', icon: '💿' },
    { name: 'Components', icon: '🔧' },
    { name: 'Accessories', icon: '🎒' },
    { name: 'Networking', icon: '🌐' },
  ];

  // Check if the name already exists
  const isNameDuplicate = (newName) => {
    if (!newName.trim()) return false;
    const lowerName = newName.trim().toLowerCase();
    return existingTypes.some(t => t.name.toLowerCase() === lowerName);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter a category name');
      return;
    }
    if (isNameDuplicate(trimmedName)) {
      setError(`Category "${trimmedName}" already exists!`);
      return;
    }
    setError('');
    setLoading(true);

    // Save the column preset in localStorage
    const presetKey = `category_preset_${trimmedName}`;
    localStorage.setItem(presetKey, JSON.stringify(selectedColumns));

    await onAdd({ name: trimmedName, icon });
    setLoading(false);
    setName('');
    setIcon('💻');
    setSelectedColumns(ALL_COLUMNS);
  };

  const toggleColumn = (colKey) => {
    setSelectedColumns(prev =>
      prev.includes(colKey)
        ? prev.filter(c => c !== colKey)
        : [...prev, colKey]
    );
  };

  const quickAddCategory = (cat) => {
    setName(cat.name);
    setIcon(cat.icon);
    setError('');
    // Optionally load preset if exists
    const presetKey = `category_preset_${cat.name}`;
    const stored = localStorage.getItem(presetKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSelectedColumns(parsed);
      } catch {}
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-large">
        <div className="modal-header">
          <h2>Add IT Category</h2>
          <button className="close-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          {/* Left side: Existing categories list */}
          <div style={{ flex: '1', minWidth: '200px', maxHeight: '300px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '6px', padding: '10px' }}>
            <h4 style={{ marginBottom: '8px' }}>Existing Categories</h4>
            {existingTypes.length === 0 ? (
              <p style={{ color: '#999', fontSize: '14px' }}>No categories yet.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {existingTypes.map((type, idx) => (
                  <li key={idx} style={{ padding: '4px 8px', borderBottom: '1px solid #f0f0f0', fontSize: '14px' }}>
                    {type.icon || '📦'} {type.name} <span style={{ color: '#aaa', fontSize: '12px' }}>({type.total_items || 0})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Right side: Form */}
          <div style={{ flex: '2', minWidth: '300px' }}>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Select IT Category (Quick Add)</label>
                <div className="quick-category-grid">
                  {itCategories.map((cat) => (
                    <button
                      key={cat.name}
                      type="button"
                      className={`quick-cat-btn ${name === cat.name ? 'active' : ''}`}
                      onClick={() => quickAddCategory(cat)}
                      style={isNameDuplicate(cat.name) ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                      disabled={isNameDuplicate(cat.name)}
                      title={isNameDuplicate(cat.name) ? 'Already exists' : ''}
                    >
                      <span>{cat.icon}</span>
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-divider">OR</div>

              <div className="form-group">
                <label>Custom Category Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Network Switches"
                  className={error ? 'input-error' : ''}
                />
                {error && <p style={{ color: 'red', fontSize: '13px', marginTop: '4px' }}>{error}</p>}
              </div>

              {/* Column Selection Checklist */}
              <div className="form-group">
                <label>Select Columns to Display for this Category</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '6px', padding: '8px', background: '#f8f9fa', borderRadius: '6px', maxHeight: '150px', overflowY: 'auto' }}>
                  {ALL_COLUMNS.map(col => (
                    <label key={col} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                      <input
                        type="checkbox"
                        checked={selectedColumns.includes(col)}
                        onChange={() => toggleColumn(col)}
                      />
                      {col === 'assignedTo' ? 'Assigned To' :
                       col === 'employeeId' ? 'Employee ID' :
                       col === 'dateOfIssuance' ? 'Date of Issuance' :
                       col === 'assetCode' ? 'Asset Code' :
                       col === 'specs' ? 'Specifications' :
                       col === 'qty' ? 'Qty' :
                       col === 'brand' ? 'Brand' :
                       col === 'model' ? 'Model' :
                       col === 'serial' ? 'S/N' :
                       col === 'price' ? 'Price' :
                       col === 'asset' ? 'Asset' :
                       col === 'condition' ? 'Condition' :
                       col === 'remarks' ? 'Remarks' :
                       col === 'location' ? 'Location' :
                       col === 'department' ? 'Department' :
                       col === 'email' ? 'Email' :
                       col === 'designation' ? 'Designation' : col}
                    </label>
                  ))}
                </div>
                <small style={{ color: 'var(--gray)' }}>Uncheck columns you do NOT want to see for this category.</small>
              </div>

              <div className="form-group">
                <label>Icon (Emoji)</label>
                <div className="icon-grid">
                  {['💻', '🖥️', '🖨️', '📷', '📹', '🎥', '🔀', '📡', '💾', '🔋', '🔌', '⌨️', '🖱️', '🎧', '🔊', '📱', '📽️', '💿', '🔧', '🎒', '🌐'].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className={`icon-btn ${icon === emoji ? 'active' : ''}`}
                      onClick={() => setIcon(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={loading || !!error}>
                  {loading ? 'Adding...' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddType;
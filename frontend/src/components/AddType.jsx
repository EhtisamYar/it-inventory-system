import React, { useState } from 'react';
import { FaTimes } from 'react-icons/fa';

// ⚠️ Must match the backend's allColumns array in server.js
const ALL_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'brand', label: 'Brand' },
  { key: 'model', label: 'Model' },
  { key: 'serial_number', label: 'S/N' },
  { key: 'specifications', label: 'Specifications' },
  { key: 'quantity', label: 'Qty' },
  { key: 'price', label: 'Price' },
  { key: 'asset', label: 'Asset' },
  { key: 'asset_code', label: 'Asset Code' },
  { key: 'condition', label: 'Condition' },
  { key: 'remarks', label: 'Remarks' },
  { key: 'location', label: 'Location' },
  { key: 'department', label: 'Department' },
  { key: 'email', label: 'Email' },
  { key: 'assigned_to', label: 'Assigned To' },
  { key: 'employee_id', label: 'Employee ID' },
  { key: 'designation', label: 'Designation' },
  { key: 'date_of_issuance', label: 'Date of Issuance' }
];

// Helper to get the column key from the full object
const COLUMN_KEYS = ALL_COLUMNS.map(col => col.key);

const AddType = ({ onClose, onAdd, existingTypes = [] }) => {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('💻');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedColumns, setSelectedColumns] = useState(COLUMN_KEYS); // all checked by default

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

    // Save the column preset in localStorage (for quick‑load later)
    const presetKey = `category_preset_${trimmedName}`;
    localStorage.setItem(presetKey, JSON.stringify(selectedColumns));

    // Send the selected columns to the backend
    await onAdd({ 
      name: trimmedName, 
      icon, 
      columns: selectedColumns  // ✅ send the array of column keys
    });
    setLoading(false);
    setName('');
    setIcon('💻');
    setSelectedColumns(COLUMN_KEYS);
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
    // Load preset if exists
    const presetKey = `category_preset_${cat.name}`;
    const stored = localStorage.getItem(presetKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSelectedColumns(parsed);
      } catch {}
    } else {
      // Fallback: all columns visible
      setSelectedColumns(COLUMN_KEYS);
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
                    <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                      <input
                        type="checkbox"
                        checked={selectedColumns.includes(col.key)}
                        onChange={() => toggleColumn(col.key)}
                      />
                      {col.label}
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
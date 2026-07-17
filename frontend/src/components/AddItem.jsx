import React, { useState } from 'react';
import { FaTimes } from 'react-icons/fa';

const AddItem = ({ onClose, onAdd, types, defaultCategoryId = null }) => {
  const [formData, setFormData] = useState({
    type_id: defaultCategoryId || '',
    name: '',
    brand: '',
    model: '',
    serial_number: '',
    specifications: '',
    quantity: '',
    price: '',
    asset: '',
    asset_code: '',
    condition: '',
    remarks: '',
    purchase_date: '',
    warranty_until: '',
    assigned_to: '',
    location: '',
    department: '',
    email: '',
    notes: ''
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setImageFile(null);
      setImagePreview(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.type_id || !formData.name.trim()) {
      alert('Please select category and enter item name');
      return;
    }
    setLoading(true);

    // Build FormData for multipart upload
    const data = new FormData();
    Object.keys(formData).forEach(key => {
      if (formData[key] !== null && formData[key] !== undefined) {
        data.append(key, formData[key]);
      }
    });
    if (imageFile) {
      data.append('image', imageFile);
    }

    await onAdd(data);
    setLoading(false);
  };

  const isCategoryDisabled = !!defaultCategoryId;
  const assetOptions = ['', 'Cereals', 'Pasta', 'Other'];

  return (
    <div className="modal-overlay">
      <div className="modal modal-large">
        <div className="modal-header">
          <h2>Add IT Equipment</h2>
          <button className="close-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Category *</label>
              <select
                name="type_id"
                value={formData.type_id}
                onChange={handleChange}
                required
                disabled={isCategoryDisabled}
                style={isCategoryDisabled ? { background: '#f5f5f5', cursor: 'not-allowed' } : {}}
              >
                <option value="">Select Category</option>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.icon} {type.name}
                  </option>
                ))}
              </select>
              {isCategoryDisabled && (
                <small style={{ color: '#6B7280', display: 'block', marginTop: '4px' }}>
                  Category is auto‑selected (you are in this category view).
                </small>
              )}
            </div>
            <div className="form-group">
              <label>Item Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Dell Latitude 5430"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Brand</label>
              <input
                type="text"
                name="brand"
                value={formData.brand}
                onChange={handleChange}
                placeholder="e.g., Dell, HP, Lenovo"
              />
            </div>
            <div className="form-group">
              <label>Model</label>
              <input
                type="text"
                name="model"
                value={formData.model}
                onChange={handleChange}
                placeholder="e.g., Latitude 5430"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Serial Number</label>
              <input
                type="text"
                name="serial_number"
                value={formData.serial_number}
                onChange={handleChange}
                placeholder="e.g., DL-2024-001"
              />
            </div>
            <div className="form-group">
              <label>Specifications</label>
              <input
                type="text"
                name="specifications"
                value={formData.specifications}
                onChange={handleChange}
                placeholder="e.g., Core i7, 16GB RAM, 512GB SSD"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Quantity *</label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                placeholder="0"
                min="0"
                required
              />
            </div>
            <div className="form-group">
              <label>Price (PKR)</label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                placeholder="e.g., 120000"
                min="0"
                step="1"
              />
              <small style={{ color: 'var(--gray)', fontSize: '12px' }}>Amount in PKR</small>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Asset *</label>
              <select
                name="asset"
                value={formData.asset}
                onChange={handleChange}
                required
              >
                {assetOptions.map(opt => (
                  <option key={opt} value={opt}>{opt || 'None'}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Asset Code</label>
              <input
                type="text"
                name="asset_code"
                value={formData.asset_code}
                onChange={handleChange}
                placeholder="e.g., FFL-001"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Condition</label>
              <select
                name="condition"
                value={formData.condition}
                onChange={handleChange}
              >
                <option value="">Select Condition</option>
                <option value="New">🆕 New</option>
                <option value="Refurbed">🔄 Refurbed</option>
                <option value="Damaged">❌ Damaged</option>
                <option value="Used">📦 Used</option>
                <option value="Condemned">⛔ Condemned</option>
              </select>
            </div>
            <div className="form-group">
              <label>Remarks</label>
              <input
                type="text"
                name="remarks"
                value={formData.remarks}
                onChange={handleChange}
                placeholder="Additional remarks"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Purchase Date</label>
              <input
                type="date"
                name="purchase_date"
                value={formData.purchase_date}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Warranty Until</label>
              <input
                type="date"
                name="warranty_until"
                value={formData.warranty_until}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Location</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="e.g., FC, FIFL"
              />
            </div>
            <div className="form-group">
              <label>Department</label>
              <input
                type="text"
                name="department"
                value={formData.department}
                onChange={handleChange}
                placeholder="e.g., IT, Finance"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Assigned To</label>
              <input
                type="text"
                name="assigned_to"
                value={formData.assigned_to}
                onChange={handleChange}
                placeholder="Employee name (if assigned)"
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="email@domain.com"
              />
            </div>
          </div>

          {/* Image upload field */}
          <div className="form-group">
            <label>Item Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
            />
            {imagePreview && (
              <div style={{ marginTop: '8px' }}>
                <img src={imagePreview} alt="Preview" style={{ maxWidth: '200px', maxHeight: '200px', objectFit: 'contain', borderRadius: '4px' }} />
                <button
                  type="button"
                  style={{ marginLeft: '8px', background: 'none', border: 'none', color: '#B4442B', cursor: 'pointer' }}
                  onClick={() => { setImageFile(null); setImagePreview(null); }}
                >
                  ✕ Remove
                </button>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Additional notes"
              rows="3"
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Equipment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddItem;
import React, { useState } from 'react';
import { FaTimes } from 'react-icons/fa';

const EditItem = ({ item, onClose, onUpdate, types }) => {
  const [formData, setFormData] = useState({
    type_id: item.type_id || '',
    name: item.name || '',
    brand: item.brand || '',
    model: item.model || '',
    serial_number: item.serial_number || '',
    specifications: item.specifications || '',
    quantity: item.quantity || '',
    price: item.price || '',
    asset: item.asset || '',
    asset_code: item.asset_code || '',
    condition: item.condition || '',
    remarks: item.remarks || '',
    purchase_date: item.purchase_date || '',
    warranty_until: item.warranty_until || '',
    assigned_to: item.assigned_to || '',
    location: item.location || '',
    email: item.email || '',    // ✅ Added email
    notes: item.notes || ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.type_id || !formData.name.trim()) {
      alert('Please select category and enter item name');
      return;
    }
    setLoading(true);
    await onUpdate(formData);
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>✏️ Edit Equipment</h2>
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
              >
                <option value="">Select Category</option>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.icon} {type.name}
                  </option>
                ))}
              </select>
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
              <label>Asset</label>
              <input
                type="text"
                name="asset"
                value={formData.asset}
                onChange={handleChange}
                placeholder="e.g., FFL-IT-001"
              />
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
              <label>Assigned To</label>
              <input
                type="text"
                name="assigned_to"
                value={formData.assigned_to}
                onChange={handleChange}
                placeholder="Employee name"
              />
            </div>
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
              {loading ? 'Updating...' : 'Update Equipment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditItem;
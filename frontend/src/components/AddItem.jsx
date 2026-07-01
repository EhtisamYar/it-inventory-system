import React, { useState } from 'react';
import { FaTimes } from 'react-icons/fa';

const AddItem = ({ onClose, onAdd, types }) => {
  const [formData, setFormData] = useState({
    type_id: '',
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
    email: '',          // ✅ Added email
    notes: ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.type_id || !formData.name.trim()) {
      alert('Please select category and enter item name');
      return;
    }
    setLoading(true);
    await onAdd(formData);
    setLoading(false);
  };

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
                placeholder="Employee name (if assigned)"
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
              {loading ? 'Adding...' : 'Add Equipment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddItem;
import React, { useState, useEffect } from 'react';
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
    department: item.department || '',
    email: item.email || '',
    notes: item.notes || ''
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load existing image if available
  useEffect(() => {
    if (item && item.id) {
      // Optionally fetch image preview via API – but we can just show the image using the image endpoint
      // We'll create a URL for the existing image using the API endpoint
      const imageUrl = `${process.env.REACT_APP_API_URL || 'http://10.9.109.10:5000'}/api/inventory/items/${item.id}/image`;
      // Test if image exists (we'll try to load it, if fails, ignore)
      fetch(imageUrl)
        .then(res => {
          if (res.ok) {
            setImagePreview(imageUrl);
          }
        })
        .catch(() => {});
    }
  }, [item]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    // Also set image to null in formData so backend removes it
    setFormData(prev => ({ ...prev, image: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.type_id || !formData.name.trim()) {
      alert('Please select category and enter item name');
      return;
    }
    setLoading(true);

    // Build FormData
    const data = new FormData();
    Object.keys(formData).forEach(key => {
      if (formData[key] !== null && formData[key] !== undefined) {
        data.append(key, formData[key]);
      }
    });
    // If imageFile is set, append it (will replace existing image)
    if (imageFile) {
      data.append('image', imageFile);
    } else if (imagePreview === null && formData.image === null) {
      // If user removed image, set image=null to delete
      data.append('image', 'null');
    }

    await onUpdate(data);
    setLoading(false);
  };

  const assetOptions = ['', 'Cereals', 'Pasta', 'Other'];

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
                placeholder="Employee name"
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
                  onClick={handleRemoveImage}
                >
                  ✕ Remove Image
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
              {loading ? 'Updating...' : 'Update Equipment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditItem;
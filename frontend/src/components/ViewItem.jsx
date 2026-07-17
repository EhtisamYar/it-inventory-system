import React, { useState } from 'react';
import { FaTimes, FaExpand } from 'react-icons/fa';

const ViewItem = ({ item, onClose }) => {
  const [showImageModal, setShowImageModal] = useState(false);
  const API_URL = process.env.REACT_APP_API_URL || 'http://10.9.109.10:5000';

  // Helper to format date
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  // If no item, return null
  if (!item) return null;

  // Build image URL (assuming the image endpoint exists)
  const imageUrl = `${API_URL}/api/inventory/items/${item.id}/image`;

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>{item.name || 'Item Details'}</h2>
            <button className="close-btn" onClick={onClose}>
              <FaTimes />
            </button>
          </div>

          <div className="modal-body" style={{ padding: '20px' }}>
            {/* Image section with click to expand */}
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              {item.image || item.id ? (
                <div
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    cursor: 'pointer',
                    border: '1px solid #E5E1D3',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    maxWidth: '300px',
                    maxHeight: '300px',
                  }}
                  onClick={() => setShowImageModal(true)}
                >
                  <img
                    src={imageUrl}
                    alt={item.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      maxHeight: '300px',
                      display: 'block',
                    }}
                    onError={(e) => {
                      // If image fails to load, hide the container
                      e.target.parentElement.style.display = 'none';
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '8px',
                      right: '8px',
                      background: 'rgba(0,0,0,0.6)',
                      color: '#fff',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <FaExpand size={12} /> Click to enlarge
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    width: '200px',
                    height: '200px',
                    background: '#F1EEE6',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#9C9585',
                    fontSize: '14px',
                    margin: '0 auto',
                  }}
                >
                  No image
                </div>
              )}
            </div>

            {/* Details grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', fontSize: '14px' }}>
              <div><strong>Category:</strong> {item.type_name || '-'}</div>
              <div><strong>Brand:</strong> {item.brand || '-'}</div>
              <div><strong>Model:</strong> {item.model || '-'}</div>
              <div><strong>Serial Number:</strong> {item.serial_number || '-'}</div>
              <div><strong>Specifications:</strong> {item.specifications || '-'}</div>
              <div><strong>Quantity:</strong> {item.quantity || 0}</div>
              <div><strong>Price:</strong> {item.price ? `Rs ${Number(item.price).toLocaleString()}` : '-'}</div>
              <div><strong>Asset:</strong> {item.asset || '-'}</div>
              <div><strong>Asset Code:</strong> {item.asset_code || '-'}</div>
              <div><strong>Condition:</strong> {item.condition || '-'}</div>
              <div><strong>Location:</strong> {item.location || '-'}</div>
              <div><strong>Department:</strong> {item.department || '-'}</div>
              <div><strong>Assigned To:</strong> {item.assigned_to || '-'}</div>
              <div><strong>Employee ID:</strong> {item.employee_id || '-'}</div>
              <div><strong>Designation:</strong> {item.designation || '-'}</div>
              <div><strong>Date of Issuance:</strong> {formatDate(item.date_of_issuance)}</div>
              <div><strong>Email:</strong> {item.email || '-'}</div>
              <div><strong>Remarks:</strong> {item.remarks || '-'}</div>
              <div><strong>Purchase Date:</strong> {formatDate(item.purchase_date)}</div>
              <div><strong>Warranty Until:</strong> {formatDate(item.warranty_until)}</div>
              <div><strong>Issued By:</strong> {item.issued_by || '-'}</div>
              <div><strong>Station:</strong> {item.station || '-'}</div>
              <div><strong>Assigned Date:</strong> {formatDate(item.assigned_date)}</div>
              <div><strong>Notes:</strong> {item.notes || '-'}</div>
            </div>
          </div>

          <div className="form-actions" style={{ padding: '14px 20px' }}>
            <button className="btn-cancel" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>

      {/* Full‑screen image modal */}
      {showImageModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          onClick={() => setShowImageModal(false)}
        >
          <img
            src={imageUrl}
            alt={item.name}
            style={{
              maxWidth: '90%',
              maxHeight: '90%',
              objectFit: 'contain',
              borderRadius: '4px',
            }}
          />
          <button
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: '#fff',
              fontSize: '30px',
              cursor: 'pointer',
              padding: '8px 14px',
              borderRadius: '8px',
              backdropFilter: 'blur(4px)',
            }}
            onClick={(e) => { e.stopPropagation(); setShowImageModal(false); }}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
};

export default ViewItem;
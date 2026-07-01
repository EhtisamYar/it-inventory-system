import React from 'react';
import { FaTimes } from 'react-icons/fa';

const ViewItem = ({ item, onClose }) => {
  const formatPKR = (amount) => {
    if (!amount) return 'Rs. 0';
    return new Intl.NumberFormat('ur-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getConditionBadge = (condition) => {
    const badges = {
      'New': <span className="condition new">🆕 New</span>,
      'Refurbed': <span className="condition refurbed">🔄 Refurbed</span>,
      'Damaged': <span className="condition damaged">❌ Damaged</span>,
      'Used': <span className="condition used">📦 Used</span>,
      'Condemned': <span className="condition condemned">⛔ Condemned</span>,
    };
    return badges[condition] || '-';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📋 Equipment Details</h2>
          <button className="close-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        
        <div className="view-item-content">
          <div className="view-row">
            <div className="view-label">Item Name</div>
            <div className="view-value"><strong>{item.name}</strong></div>
          </div>
          
          <div className="view-row">
            <div className="view-label">Category</div>
            <div className="view-value">{item.type_icon || '📦'} {item.type_name}</div>
          </div>
          
          <div className="view-row">
            <div className="view-label">Brand</div>
            <div className="view-value">{item.brand || '-'}</div>
          </div>
          
          <div className="view-row">
            <div className="view-label">Model</div>
            <div className="view-value">{item.model || '-'}</div>
          </div>
          
          <div className="view-row">
            <div className="view-label">Serial Number</div>
            <div className="view-value" style={{ fontFamily: 'monospace' }}>{item.serial_number || '-'}</div>
          </div>
          
          <div className="view-row">
            <div className="view-label">Specifications</div>
            <div className="view-value">{item.specifications || '-'}</div>
          </div>
          
          <div className="view-row">
            <div className="view-label">Quantity</div>
            <div className="view-value">{item.quantity}</div>
          </div>
          
          <div className="view-row">
            <div className="view-label">Price</div>
            <div className="view-value price-pkr">{formatPKR(item.price)}</div>
          </div>
          
          <div className="view-row">
            <div className="view-label">Asset</div>
            <div className="view-value"><strong style={{ color: '#4361ee' }}>{item.asset || '-'}</strong></div>
          </div>
          
          <div className="view-row">
            <div className="view-label">Asset Code</div>
            <div className="view-value">{item.asset_code || '-'}</div>
          </div>
          
          <div className="view-row">
            <div className="view-label">Condition</div>
            <div className="view-value">{getConditionBadge(item.condition)}</div>
          </div>
          
          <div className="view-row">
            <div className="view-label">Remarks</div>
            <div className="view-value" style={{ whiteSpace: 'pre-wrap' }}>{item.remarks || '-'}</div>
          </div>
          
          <div className="view-row">
            <div className="view-label">Location</div>
            <div className="view-value">{item.location || '-'}</div>
          </div>
          
          <div className="view-row">
            <div className="view-label">Department</div>
            <div className="view-value">{item.department || '-'}</div>
          </div>
          
          <div className="view-row">
            <div className="view-label">Assigned To</div>
            <div className="view-value">{item.assigned_to || '-'}</div>
          </div>
          
          <div className="view-row">
            <div className="view-label">Email</div>   {/* ✅ New */}
            <div className="view-value">{item.email || '-'}</div>
          </div>
          
          <div className="view-row">
            <div className="view-label">Employee ID</div>
            <div className="view-value">{item.employee_id || '-'}</div>
          </div>
          
          <div className="view-row">
            <div className="view-label">Designation</div>
            <div className="view-value">{item.designation || '-'}</div>
          </div>
          
          <div className="view-row">
            <div className="view-label">Date of Issuance</div>
            <div className="view-value">{item.date_of_issuance || '-'}</div>
          </div>
          
          <div className="view-row">
            <div className="view-label">Purchase Date</div>
            <div className="view-value">{item.purchase_date || '-'}</div>
          </div>
          
          <div className="view-row">
            <div className="view-label">Warranty Until</div>
            <div className="view-value">{item.warranty_until || '-'}</div>
          </div>
          
          <div className="view-row">
            <div className="view-label">Notes</div>
            <div className="view-value" style={{ whiteSpace: 'pre-wrap' }}>{item.notes || '-'}</div>
          </div>
        </div>

        <div className="form-actions">
          <button className="btn-cancel" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewItem;
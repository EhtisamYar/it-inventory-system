import React from 'react';
import { FaHome, FaDatabase, FaClipboardCheck, FaClipboardList } from 'react-icons/fa';

const Sidebar = ({ types, onSelectType, selectedType }) => {
  const allowedCategories = ['Laptops', 'Desktops'];
  const filteredTypes = types.filter(t => allowedCategories.includes(t.name));

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2><span>📦</span> IT Inventory</h2>
        <p>Fauji Foods</p>
      </div>

      <div className="sidebar-nav">
        <div 
          className={`sidebar-item ${selectedType === null ? 'active' : ''}`}
          onClick={() => onSelectType(null)}
        >
          <span className="icon"><FaHome /></span>
          <span className="label">Dashboard</span>
        </div>

        <div 
          className={`sidebar-item ${selectedType === 'master' ? 'active' : ''}`}
          onClick={() => onSelectType('master')}
        >
          <span className="icon"><FaDatabase /></span>
          <span className="label">Master Inventory</span>
          <span className="badge">{filteredTypes.length}</span>
        </div>

        <div 
          className={`sidebar-item ${selectedType === 'it-inventory' ? 'active' : ''}`}
          onClick={() => onSelectType('it-inventory')}
        >
          <span className="icon"><FaDatabase /></span>
          <span className="label">IT Inventory</span>
          <span className="badge">📦</span>
        </div>

        <div 
          className={`sidebar-item ${selectedType === 'assignment' ? 'active' : ''}`}
          onClick={() => onSelectType('assignment')}
        >
          <span className="icon"><FaClipboardCheck /></span>
          <span className="label">Asset Assignment</span>
        </div>

        {/* NEW: Service & Maintenance */}
        <div 
          className={`sidebar-item ${selectedType === 'service' ? 'active' : ''}`}
          onClick={() => onSelectType('service')}
        >
          <span className="icon"><FaClipboardList /></span>
          <span className="label">Service & Maintenance</span>
        </div>
      </div>

      <div className="sidebar-footer">
        <span>© 2026 Fauji Foods</span>
      </div>
    </div>
  );
};

export default Sidebar;
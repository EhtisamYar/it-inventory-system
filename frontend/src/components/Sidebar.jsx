import React from 'react';
import { FaHome, FaDatabase, FaClipboardCheck, FaClipboardList, FaUndo } from 'react-icons/fa';

const Sidebar = ({ types, onSelectType, selectedType }) => {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2><span>📦</span> IT Inventory</h2>
        <p>Fauji Foods</p>
      </div>

      <div className="sidebar-nav">
        {/* Dashboard */}
        <div 
          className={`sidebar-item ${selectedType === null ? 'active' : ''}`}
          onClick={() => onSelectType(null)}
        >
          <span className="icon"><FaHome /></span>
          <span className="label">Dashboard</span>
        </div>

        {/* Master Inventory */}
        <div 
          className={`sidebar-item ${selectedType === 'master' ? 'active' : ''}`}
          onClick={() => onSelectType('master')}
        >
          <span className="icon"><FaDatabase /></span>
          <span className="label">Master Inventory</span>
        </div>

        {/* IT Inventory */}
        <div 
          className={`sidebar-item ${selectedType === 'it-inventory' ? 'active' : ''}`}
          onClick={() => onSelectType('it-inventory')}
        >
          <span className="icon"><FaDatabase /></span>
          <span className="label">IT Inventory</span>
        </div>

        {/* Asset Assignment */}
        <div 
          className={`sidebar-item ${selectedType === 'assignment' ? 'active' : ''}`}
          onClick={() => onSelectType('assignment')}
        >
          <span className="icon"><FaClipboardCheck /></span>
          <span className="label">Asset Assignment</span>
        </div>

        {/* Service & Maintenance */}
        <div 
          className={`sidebar-item ${selectedType === 'service' ? 'active' : ''}`}
          onClick={() => onSelectType('service')}
        >
          <span className="icon"><FaClipboardList /></span>
          <span className="label">Service & Maintenance</span>
        </div>

        {/* Asset Returns */}
        <div 
          className={`sidebar-item ${selectedType === 'returns' ? 'active' : ''}`}
          onClick={() => onSelectType('returns')}
        >
          <span className="icon"><FaUndo /></span>
          <span className="label">Asset Returns</span>
        </div>

        {/* Condemned */}
        <div 
          className={`sidebar-item ${selectedType === 'condemned' ? 'active' : ''}`}
          onClick={() => onSelectType('condemned')}
        >
          <span className="icon">⛔</span>
          <span className="label">Condemned</span>
        </div>

        {/* ===== MANAGEMENT SECTION ===== */}
        <div className="sidebar-divider" />
        <div className="sidebar-section-title">MANAGEMENT</div>

        <div 
          className={`sidebar-item ${selectedType === 'departments' ? 'active' : ''}`}
          onClick={() => onSelectType('departments')}
        >
          <span className="icon">🏢</span>
          <span className="label">Departments</span>
        </div>

        <div 
          className={`sidebar-item ${selectedType === 'employees' ? 'active' : ''}`}
          onClick={() => onSelectType('employees')}
        >
          <span className="icon">👤</span>
          <span className="label">Employees</span>
        </div>
      </div>

      <div className="sidebar-footer">
        <span>© 2026 Fauji Foods</span>
      </div>
    </div>
  );
};

export default Sidebar;
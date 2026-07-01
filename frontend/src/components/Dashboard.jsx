import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  FaBox, FaChartLine, FaPlus, FaLaptop, FaDesktop,
  FaPrint, FaNetworkWired, FaHdd, FaHeadphones, FaKeyboard,
  FaMouse, FaPlug, FaServer, FaMicrochip, FaDatabase,
  FaCamera, FaVideo, FaMobile, FaTablet, FaTrash
} from 'react-icons/fa';

const Dashboard = ({ types, onSelectType, onAddType, onDeleteCategory }) => {
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const API_URL = 'http://localhost:5000';

  useEffect(() => {
    fetchAllItems();
  }, [types]);

  const fetchAllItems = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/inventory/items`);
      console.log('✅ All Items fetched:', response.data);
      setAllItems(response.data);
    } catch (error) {
      console.error('❌ Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get icon based on category name
  const getCategoryIcon = (name) => {
    const icons = {
      'Laptops': <FaLaptop />,
      'Desktop PCs': <FaDesktop />,
      'Monitors': <FaDesktop />,
      'Printers': <FaPrint />,
      'Network Devices': <FaNetworkWired />,
      'Switches': <FaNetworkWired />,
      'Routers': <FaNetworkWired />,
      'Storage Devices': <FaHdd />,
      'Hard Drives': <FaHdd />,
      'Accessories': <FaHeadphones />,
      'Peripherals': <FaKeyboard />,
      'UPS/Batteries': <FaServer />,
      'Cables & Adapters': <FaPlug />,
      'Servers': <FaServer />,
      'Software': <FaDatabase />,
      'Components': <FaMicrochip />,
      'Cameras': <FaCamera />,
      'CCTV Cameras': <FaVideo />,
      'Webcams': <FaVideo />,
      'Phones': <FaMobile />,
      'Tablets': <FaTablet />,
      'Projectors': <FaVideo />
    };
    return icons[name] || <FaBox />;
  };

  // Get category color
  const getCategoryColor = (index) => {
    const colors = [
      '#4361ee', '#7209b7', '#4caf50', '#ff9800', '#f44336',
      '#2196f3', '#9c27b0', '#00bcd4', '#ff5722', '#8bc34a',
      '#3f51b5', '#e91e63', '#009688', '#795548', '#607d8b',
      '#ff6f00', '#d50000', '#0d47a1', '#004d40', '#4a148c'
    ];
    return colors[index % colors.length];
  };

  // Calculate category-wise totals
  const getCategoryStats = () => {
    return types.map(type => {
      const items = allItems.filter(item => item.type_id === type.id);
      const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const totalItems = items.length;
      
      return {
        ...type,
        totalQuantity,
        totalItems,
        items
      };
    });
  };

  const categoryStats = getCategoryStats();
  const totalItemsCount = allItems.length;
  const totalQuantity = allItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

  const handleCategoryClick = (categoryId) => {
    console.log('👆 Category clicked:', categoryId);
    onSelectType(categoryId);
  };

  const handleDeleteClick = (e, categoryId) => {
    e.stopPropagation(); // Prevent category click
    if (onDeleteCategory) {
      onDeleteCategory(categoryId);
    }
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1>📊 Dashboard</h1>
          <span className="subtitle">IT Equipment Overview</span>
        </div>
        <button className="btn-primary" onClick={onAddType}>
          <FaPlus /> Add Category
        </button>
      </div>
      
      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-icon"><FaBox /></div>
          <h3>Total Equipment</h3>
          <p>{totalItemsCount}</p>
          <span className="stat-subtitle">{totalQuantity} total quantity</span>
        </div>
        <div className="stat-card info">
          <div className="stat-icon"><FaChartLine /></div>
          <h3>Categories</h3>
          <p>{types.length}</p>
          <span className="stat-subtitle">Total types</span>
        </div>
      </div>

      {/* Categories as Buttons */}
      <div className="categories-section">
        <div className="section-title">
          📋 Categories
          <span className="count">(Click any category to view items)</span>
        </div>

        <div className="categories-grid">
          {categoryStats.map((category, index) => (
            <div
              key={category.id}
              className="category-item-wrapper"
            >
              <button
                className="category-btn"
                onClick={() => handleCategoryClick(category.id)}
                style={{ 
                  borderColor: getCategoryColor(index),
                  '--btn-color': getCategoryColor(index)
                }}
              >
                <span className="category-btn-icon" style={{ color: getCategoryColor(index) }}>
                  {getCategoryIcon(category.name)}
                </span>
                <span className="category-btn-name">{category.name}</span>
                <span className="category-btn-count" style={{ background: getCategoryColor(index) }}>
                  {category.totalItems}
                </span>
                <span className="category-btn-arrow">→</span>
              </button>
              {/* Delete Button on Category */}
              <button 
                className="category-delete-btn"
                onClick={(e) => handleDeleteClick(e, category.id)}
                title="Delete Category"
              >
                <FaTrash />
              </button>
            </div>
          ))}

          {/* Add Category Button */}
          <button className="category-btn add-category-btn" onClick={onAddType}>
            <span className="category-btn-icon">➕</span>
            <span className="category-btn-name">Add New</span>
            <span className="category-btn-count" style={{ background: '#4caf50' }}>+</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
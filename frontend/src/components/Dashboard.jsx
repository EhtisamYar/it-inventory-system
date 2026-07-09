import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  FaBox, FaChartLine, FaPlus, FaLaptop, FaDesktop,
  FaPrint, FaNetworkWired, FaHdd, FaHeadphones, FaKeyboard,
  FaPlug, FaServer, FaMicrochip, FaDatabase,
  FaCamera, FaVideo, FaMobile, FaTablet, FaTrash, FaShieldAlt,
  FaWifi, FaChevronRight, FaLayerGroup
} from 'react-icons/fa';

const Dashboard = ({ types, onSelectType, onAddType, onDeleteCategory }) => {
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const API_URL = 'http://10.9.109.10:5000';

  useEffect(() => {
    fetchAllItems();
  }, [types]);

  const fetchAllItems = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/inventory/items`);
      setAllItems(response.data);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (name) => {
    const icons = {
      'Laptops': <FaLaptop />, 'Desktops': <FaDesktop />, 'Desktop PCs': <FaDesktop />,
      'Monitors': <FaDesktop />, 'Printers': <FaPrint />, 'Printers / Scanner / Photocopier': <FaPrint />,
      'Network Devices': <FaNetworkWired />, 'Switches': <FaNetworkWired />, 'Firewall - Switches': <FaShieldAlt />,
      'Routers': <FaWifi />, 'Access Point': <FaWifi />, 'Storage Devices': <FaHdd />,
      'Hard Drives': <FaHdd />, 'Accessories': <FaHeadphones />, 'Peripherals': <FaKeyboard />,
      'UPS/Batteries': <FaServer />, 'Cables & Adapters': <FaPlug />, 'Servers': <FaServer />,
      'Software': <FaDatabase />, 'Components': <FaMicrochip />, 'IT Equipments': <FaMicrochip />,
      'Cameras': <FaCamera />, 'CCTV Cameras': <FaVideo />, 'CCTV Cameras - DVS - EVS': <FaVideo />,
      'Webcams': <FaVideo />, 'Phones': <FaMobile />, 'Tablets': <FaTablet />, 'Projectors': <FaVideo />
    };
    return icons[name] || <FaBox />;
  };

  // Two-tone gradients — soft UI reads richer with a gradient than a flat hex
  const GRADIENTS = [
    ['#6366F1', '#8B5CF6'], ['#0EA5E9', '#22D3EE'], ['#10B981', '#34D399'],
    ['#F59E0B', '#FBBF24'], ['#F43F5E', '#FB7185'], ['#8B5CF6', '#D946EF'],
    ['#EC4899', '#F472B6'], ['#14B8A6', '#2DD4BF'], ['#F97316', '#FB923C'],
    ['#6366F1', '#A78BFA'],
  ];
  const getGradient = (index) => GRADIENTS[index % GRADIENTS.length];

  const getCategoryStats = () => {
    return types.map(type => {
      const items = allItems.filter(item => item.type_id === type.id);
      const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      return { ...type, totalQuantity, totalItems: items.length, items };
    });
  };

  const categoryStats = getCategoryStats();
  const totalItemsCount = allItems.length;
  const totalQuantity = allItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

  const handleDeleteClick = (e, categoryId) => {
    e.stopPropagation();
    if (onDeleteCategory) onDeleteCategory(categoryId);
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <Blobs />
        <div style={styles.loadingWrap}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Loading dashboard…</p>
        </div>
        <style>{sheet}</style>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <Blobs />
      <style>{sheet}</style>

      <div style={styles.content}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Dashboard</h1>
            <p style={styles.subtitle}>IT equipment overview</p>
          </div>
          <button className="gd-btn-primary" style={styles.btnPrimary} onClick={onAddType}>
            <FaPlus size={13} /> Add category
          </button>
        </div>

        {/* Stats */}
        <div style={styles.statsGrid}>
          <div className="gd-glass" style={styles.statCard}>
            <div style={{ ...styles.statIcon, background: `linear-gradient(135deg, #6366F1, #8B5CF6)`, boxShadow: '0 8px 20px rgba(99,102,241,0.35)' }}>
              <FaLayerGroup size={18} color="#fff" />
            </div>
            <div>
              <p style={styles.statLabel}>Total equipment</p>
              <p style={styles.statValue}>{totalItemsCount}</p>
              <p style={styles.statSub}>{totalQuantity} units in stock</p>
            </div>
          </div>
          <div className="gd-glass" style={styles.statCard}>
            <div style={{ ...styles.statIcon, background: `linear-gradient(135deg, #0EA5E9, #22D3EE)`, boxShadow: '0 8px 20px rgba(14,165,233,0.35)' }}>
              <FaChartLine size={18} color="#fff" />
            </div>
            <div>
              <p style={styles.statLabel}>Categories</p>
              <p style={styles.statValue}>{types.length}</p>
              <p style={styles.statSub}>Equipment types tracked</p>
            </div>
          </div>
        </div>

        {/* Categories */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Categories</h2>
            <span style={styles.sectionHint}>Click a category to view its items</span>
          </div>

          <div style={styles.categoryGrid}>
            {categoryStats.map((category, index) => {
              const [c1, c2] = getGradient(index);
              return (
                <div key={category.id} className="gd-glass gd-cat-card" style={styles.catCard}>
                  <button
                    className="gd-delete"
                    style={styles.deleteBtn}
                    onClick={(e) => handleDeleteClick(e, category.id)}
                    title="Delete category"
                    aria-label={`Delete ${category.name}`}
                  >
                    <FaTrash size={11} />
                  </button>

                  <button style={styles.catCardBody} onClick={() => onSelectType(category.id)}>
                    <div style={{
                      ...styles.catIcon,
                      background: `linear-gradient(135deg, ${c1}, ${c2})`,
                      boxShadow: `0 8px 18px ${c1}55`,
                    }}>
                      {getCategoryIcon(category.name)}
                    </div>
                    <span style={styles.catName}>{category.name}</span>
                    <div style={styles.catFooter}>
                      <span style={{ ...styles.catCount, background: `${c1}1A`, color: c1 }}>
                        {category.totalItems} {category.totalItems === 1 ? 'item' : 'items'}
                      </span>
                      <span style={{ ...styles.catArrow, color: c1 }}>
                        <FaChevronRight size={11} />
                      </span>
                    </div>
                  </button>
                </div>
              );
            })}

            <button style={styles.addCard} onClick={onAddType} className="gd-add-card">
              <div style={styles.addIcon}><FaPlus size={16} /></div>
              <span style={styles.addLabel}>Add category</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Soft blurred color blobs that sit behind the glass cards for depth
const Blobs = () => (
  <>
    <div style={{ ...styles.blob, width: 420, height: 420, top: -120, left: -100, background: 'radial-gradient(circle, #C7D2FE 0%, transparent 70%)' }} />
    <div style={{ ...styles.blob, width: 380, height: 380, top: 120, right: -140, background: 'radial-gradient(circle, #FBCFE8 0%, transparent 70%)' }} />
    <div style={{ ...styles.blob, width: 340, height: 340, bottom: -160, left: '30%', background: 'radial-gradient(circle, #A7F3D0 0%, transparent 70%)' }} />
  </>
);

const styles = {
  page: {
    position: 'relative',
    minHeight: '100%',
    background: 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 45%, #FDF2F8 100%)',
    overflow: 'hidden',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  blob: {
    position: 'absolute',
    borderRadius: '50%',
    filter: 'blur(60px)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  content: {
    position: 'relative',
    zIndex: 1,
    padding: '28px 32px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '28px',
  },
  title: {
    fontSize: '26px',
    fontWeight: 800,
    margin: 0,
    letterSpacing: '-0.02em',
    background: 'linear-gradient(135deg, #4338CA, #7C3AED 60%, #DB2777)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  subtitle: {
    fontSize: '14px',
    color: '#6B7280',
    margin: '4px 0 0',
  },
  btnPrimary: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
    color: '#fff',
    border: 'none',
    borderRadius: '14px',
    padding: '11px 20px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 10px 24px rgba(99,102,241,0.35)',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '18px',
    marginBottom: '32px',
  },
  statCard: {
    borderRadius: '22px',
    padding: '20px 22px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  statIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statLabel: {
    fontSize: '12.5px',
    color: '#6B7280',
    margin: 0,
    fontWeight: 600,
  },
  statValue: {
    fontSize: '26px',
    fontWeight: 800,
    color: '#1F2937',
    margin: '2px 0',
  },
  statSub: {
    fontSize: '12px',
    color: '#9CA3AF',
    margin: 0,
  },
  section: {},
  sectionHeader: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '10px',
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '17px',
    fontWeight: 800,
    color: '#1F2937',
    margin: 0,
  },
  sectionHint: {
    fontSize: '12.5px',
    color: '#9CA3AF',
  },
  categoryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(206px, 1fr))',
    gap: '16px',
  },
  catCard: {
    position: 'relative',
    borderRadius: '20px',
  },
  catCardBody: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderRadius: '20px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '14px',
    cursor: 'pointer',
    textAlign: 'left',
  },
  catIcon: {
    width: '42px',
    height: '42px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    color: '#fff',
  },
  catName: {
    fontSize: '14.5px',
    fontWeight: 700,
    color: '#1F2937',
    lineHeight: 1.3,
  },
  catFooter: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '2px',
  },
  catCount: {
    fontSize: '12px',
    fontWeight: 700,
    padding: '4px 10px',
    borderRadius: '20px',
  },
  catArrow: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.7)',
  },
  deleteBtn: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    width: '28px',
    height: '28px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.6)',
    background: 'rgba(255,255,255,0.6)',
    backdropFilter: 'blur(6px)',
    color: '#9CA3AF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    opacity: 0,
    zIndex: 2,
  },
  addCard: {
    border: '1.5px dashed rgba(139,92,246,0.35)',
    borderRadius: '20px',
    background: 'rgba(255,255,255,0.35)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '20px',
    minHeight: '128px',
    cursor: 'pointer',
    color: '#7C3AED',
  },
  addIcon: {
    width: '38px',
    height: '38px',
    borderRadius: '13px',
    background: 'linear-gradient(135deg, #EEF2FF, #F5F3FF)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#7C3AED',
  },
  addLabel: {
    fontSize: '13.5px',
    fontWeight: 700,
  },
  loadingWrap: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '60vh',
    gap: '14px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid rgba(99,102,241,0.15)',
    borderTopColor: '#6366F1',
    borderRadius: '50%',
    animation: 'gd-spin 0.8s linear infinite',
  },
  loadingText: {
    color: '#6B7280',
    fontSize: '14px',
    margin: 0,
  },
};

const sheet = `
@keyframes gd-spin { to { transform: rotate(360deg); } }

.gd-glass {
  background: rgba(255,255,255,0.55);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.8);
  box-shadow: 0 8px 32px rgba(31,38,135,0.10), inset 0 1px 0 rgba(255,255,255,0.7);
}

.gd-cat-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
.gd-cat-card:hover {
  transform: translateY(-4px) scale(1.015);
  box-shadow: 0 16px 36px rgba(31,38,135,0.16), inset 0 1px 0 rgba(255,255,255,0.8);
}
.gd-cat-card:hover .gd-delete { opacity: 1; }
.gd-delete:hover { background: rgba(254,242,242,0.9) !important; color: #EF4444 !important; }

.gd-add-card { transition: all 0.2s ease; }
.gd-add-card:hover { border-color: #8B5CF6 !important; background: rgba(245,243,255,0.6) !important; transform: translateY(-2px); }

.gd-btn-primary { transition: transform 0.15s ease, box-shadow 0.15s ease; }
.gd-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 14px 30px rgba(99,102,241,0.45); }
`;

export default Dashboard;

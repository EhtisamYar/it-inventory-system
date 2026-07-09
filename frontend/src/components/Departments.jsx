import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaPlus, FaEdit, FaTrash, FaInbox } from 'react-icons/fa';

const PAPER = '#F2F0EA';
const INK = '#14161F';
const TEAL = '#1F6F78';

const Departments = ({ apiUrl }) => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });

  const fetchData = async () => {
    try {
      const res = await axios.get(`${apiUrl}/api/departments`);
      setDepartments(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [apiUrl]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await axios.put(`${apiUrl}/api/departments/${editing.id}`, formData);
      } else {
        await axios.post(`${apiUrl}/api/departments`, formData);
      }
      fetchData();
      setShowModal(false);
      setEditing(null);
      setFormData({ name: '', description: '' });
    } catch (err) {
      alert(err.response?.data?.error || 'Error saving');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this department?')) return;
    try {
      await axios.delete(`${apiUrl}/api/departments/${id}`);
      fetchData();
    } catch (err) { alert('Error deleting'); }
  };

  const openModal = (dept = null) => {
    if (dept) {
      setEditing(dept);
      setFormData({ name: dept.name, description: dept.description || '' });
    } else {
      setEditing(null);
      setFormData({ name: '', description: '' });
    }
    setShowModal(true);
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingWrap}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Loading departments…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.frame}>
        {/* Top bar */}
        <header style={styles.topbar}>
          <div style={styles.brandBlock}>
            <div style={styles.mark}>🏢</div>
            <div>
              <h1 style={styles.brandTitle}>Departments</h1>
              <p style={styles.brandSub}>Manage organizational departments</p>
            </div>
          </div>
          <button className="gl-btn-primary" style={styles.btnPrimary} onClick={() => openModal()}>
            <FaPlus size={12} /> Add Department
          </button>
        </header>

        {/* Stats */}
        <div style={styles.statStrip}>
          <div style={styles.statBlock}>
            <span style={styles.statValue}>{String(departments.length).padStart(3, '0')}</span>
            <span style={styles.statLabel}>Total Departments</span>
          </div>
        </div>

        {/* Table */}
        <div style={styles.tableCard}>
          <div style={styles.tableScroll}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>#</th>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Description</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={styles.emptyCell}>
                      <div style={styles.emptyWrap}>
                        <div style={styles.emptyIcon}><FaInbox size={18} /></div>
                        <h3 style={styles.emptyTitle}>No departments</h3>
                        <p style={styles.emptyText}>Click "Add Department" to create one.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  departments.map((d, i) => (
                    <tr key={d.id} className="gl-row">
                      <td style={{ ...styles.td, ...styles.tdMono, color: '#B9B3A4' }}>{String(i + 1).padStart(3, '0')}</td>
                      <td style={{ ...styles.td, fontWeight: 600 }}>{d.name}</td>
                      <td style={styles.td}>{d.description || '-'}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        <div style={styles.actionRow}>
                          <button className="gl-icon-btn gl-icon-edit" style={styles.iconBtn} onClick={() => openModal(d)} title="Edit">
                            <FaEdit size={12} />
                          </button>
                          <button className="gl-icon-btn gl-icon-delete" style={styles.iconBtn} onClick={() => handleDelete(d.id)} title="Delete">
                            <FaTrash size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={styles.overlay} onClick={() => setShowModal(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{editing ? 'Edit Department' : 'New Department'}</h2>
              <button style={styles.closeBtn} onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit} style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Name *</label>
                <input style={styles.input} type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Description</label>
                <textarea style={{ ...styles.input, resize: 'vertical', minHeight: '70px' }} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows="3" />
              </div>
              <div style={styles.formActions}>
                <button type="button" style={styles.btnCancel} onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="gl-btn-primary" style={styles.btnPrimary}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{sheet}</style>
    </div>
  );
};

// ---------- Styles ----------
const styles = {
  page: { minHeight: '100%', background: PAPER, fontFamily: "'Inter', sans-serif" },
  frame: { maxWidth: '1400px', margin: '0 auto', padding: '20px 28px 48px' },
  topbar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    paddingBottom: '18px',
    borderBottom: `2px solid ${INK}`,
    marginBottom: '18px',
  },
  brandBlock: { display: 'flex', alignItems: 'center', gap: '12px' },
  mark: {
    width: '38px',
    height: '38px',
    borderRadius: '8px',
    background: INK,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    flexShrink: 0,
  },
  brandTitle: { fontFamily: "'Space Grotesk', sans-serif", fontSize: '20px', fontWeight: 700, color: INK, margin: 0, lineHeight: 1.25 },
  brandSub: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#8A8371', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '2px 0 0' },
  btnPrimary: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    height: '36px',
    padding: '0 15px',
    background: TEAL,
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnCancel: {
    height: '36px',
    padding: '0 15px',
    background: '#fff',
    color: '#3A3626',
    border: '1px solid #DEDACD',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  statStrip: {
    display: 'flex',
    alignItems: 'center',
    gap: '28px',
    padding: '14px 20px',
    marginBottom: '16px',
    background: INK,
    borderRadius: '10px',
    flexWrap: 'wrap',
  },
  statBlock: { display: 'flex', flexDirection: 'column', gap: '3px' },
  statValue: { fontFamily: "'JetBrains Mono', monospace", fontSize: '17px', fontWeight: 700, color: '#fff' },
  statLabel: { fontSize: '10.5px', color: '#A9A392', textTransform: 'uppercase', letterSpacing: '0.05em' },
  tableCard: { borderRadius: '12px', overflow: 'hidden', background: '#fff', border: '1px solid #E5E1D3' },
  tableScroll: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: {
    textAlign: 'left',
    padding: '11px 16px',
    background: '#FAF8F3',
    color: '#9C9585',
    fontWeight: 700,
    fontSize: '10.5px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid #E5E1D3',
    whiteSpace: 'nowrap',
  },
  td: { padding: '12px 16px', borderBottom: '1px solid #F1EEE6', color: '#3A3626', whiteSpace: 'nowrap' },
  tdMono: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12.5px' },
  actionRow: { display: 'flex', gap: '4px', justifyContent: 'flex-end' },
  iconBtn: {
    width: '28px',
    height: '28px',
    borderRadius: '7px',
    border: 'none',
    background: 'transparent',
    color: '#9C9585',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  emptyCell: { padding: '56px 20px' },
  emptyWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' },
  emptyIcon: { width: '48px', height: '48px', borderRadius: '12px', background: '#F1EEE6', color: '#9C9585', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '6px' },
  emptyTitle: { fontSize: '14.5px', fontWeight: 700, color: INK, margin: 0 },
  emptyText: { fontSize: '13px', color: '#9C9585', margin: 0 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(20,22,31,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' },
  modal: { background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '500px', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(20,22,31,0.25)' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid #E5E1D3', position: 'sticky', top: 0, background: '#fff', zIndex: 1 },
  modalTitle: { fontFamily: "'Space Grotesk', sans-serif", fontSize: '16px', fontWeight: 700, color: INK, margin: 0 },
  closeBtn: { width: '30px', height: '30px', borderRadius: '7px', border: 'none', background: 'transparent', color: '#9C9585', fontSize: '20px', lineHeight: 1, cursor: 'pointer' },
  modalBody: { padding: '20px' },
  formGroup: { marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '11.5px', fontWeight: 700, color: '#9C9585', textTransform: 'uppercase', letterSpacing: '0.04em' },
  input: { height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid #DEDACD', fontSize: '13px', color: INK, outline: 'none', fontFamily: "'Inter', sans-serif" },
  formActions: { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' },
  loadingWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '14px' },
  spinner: { width: '30px', height: '30px', border: '3px solid #E5E1D3', borderTopColor: TEAL, borderRadius: '50%', animation: 'gl-spin 0.8s linear infinite' },
  loadingText: { color: '#6B6353', fontSize: '14px', margin: 0 },
};

const sheet = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');

@keyframes gl-spin { to { transform: rotate(360deg); } }

.gl-row { transition: background 0.12s ease; }
.gl-row:hover { background: #FAF8F3; }
.gl-btn-primary { transition: opacity 0.15s ease; }
.gl-btn-primary:hover { opacity: 0.9; }
.gl-icon-btn { transition: all 0.12s ease; }
.gl-icon-edit:hover { background: #FBF3E3 !important; color: #C08A1E !important; }
.gl-icon-delete:hover { background: #FBEDEA !important; color: #B4442B !important; }
`;

export default Departments;
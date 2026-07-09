import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import InventoryList from './components/InventoryList';
import AddType from './components/AddType';
import AddItem from './components/AddItem';
import ViewItem from './components/ViewItem';
import EditItem from './components/EditItem';
import AssetAssignment from './components/AssetAssignment';
import ServiceMaintenance from './components/ServiceMaintenance';
import AssetReturns from './components/AssetReturns';
import Departments from './components/Departments';
import Employees from './components/Employees';
import './styles/App.css';

function App() {
  const [selectedType, setSelectedType] = useState(null);
  const [inventoryTypes, setInventoryTypes] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddType, setShowAddType] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showViewItem, setShowViewItem] = useState(false);
  const [showEditItem, setShowEditItem] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [refresh, setRefresh] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredItems, setFilteredItems] = useState([]);
  const [isMasterInventory, setIsMasterInventory] = useState(false);
  const [isAssignment, setIsAssignment] = useState(false);
  const [isItInventory, setIsItInventory] = useState(false);

  const API_URL = 'http://10.9.109.10:5000';

  const handleRefresh = () => {
    if (selectedType === 'master') fetchMasterInventory();
    else if (selectedType === 'it-inventory') fetchItInventory();
    else if (selectedType === 'assignment') fetchAssignmentItems();
    else if (selectedType === 'condemned') fetchCondemnedItems();
    else if (selectedType && selectedType !== 'service' && selectedType !== 'returns' && selectedType !== 'departments' && selectedType !== 'employees') {
      fetchItemsByType(selectedType);
    }
  };

  useEffect(() => {
    fetchInventoryTypes();
  }, [refresh]);

  const fetchInventoryTypes = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/inventory/types`);
      console.log('✅ Types fetched:', response.data);
      setInventoryTypes(response.data);
    } catch (error) {
      console.error('❌ Error fetching types:', error);
    }
  };

  const fetchItemsByType = async (typeId) => {
    setLoading(true);
    setIsMasterInventory(false);
    setIsAssignment(false);
    setIsItInventory(false);
    setSelectedType(typeId);
    try {
      const response = await axios.get(`${API_URL}/api/inventory/items/${typeId}`);
      console.log(`✅ Items for type ${typeId}:`, response.data);
      setInventoryItems(response.data);
      setFilteredItems(response.data);
    } catch (error) {
      console.error('❌ Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMasterInventory = async () => {
    setLoading(true);
    setIsMasterInventory(true);
    setIsAssignment(false);
    setIsItInventory(false);
    setSelectedType('master');
    try {
      const response = await axios.get(`${API_URL}/api/inventory/items`);
      console.log('✅ Master Inventory:', response.data);
      setInventoryItems(response.data);
      setFilteredItems(response.data);
    } catch (error) {
      console.error('❌ Error fetching master inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchItInventory = async () => {
    setLoading(true);
    setIsItInventory(true);
    setIsMasterInventory(false);
    setIsAssignment(false);
    setSelectedType('it-inventory');
    try {
      const response = await axios.get(`${API_URL}/api/inventory/items`);
      const unassigned = response.data.filter(
        item => !item.assigned_to || item.assigned_to.trim() === ''
      );
      console.log('✅ IT Inventory (Unassigned):', unassigned);
      setInventoryItems(unassigned);
      setFilteredItems(unassigned);
    } catch (error) {
      console.error('❌ Error fetching IT inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignmentItems = async () => {
    setLoading(true);
    setIsAssignment(true);
    setIsMasterInventory(false);
    setIsItInventory(false);
    setSelectedType('assignment');
    try {
      const response = await axios.get(`${API_URL}/api/inventory/items`);
      console.log('✅ Assignment Items (All):', response.data);
      setInventoryItems(response.data);
      setFilteredItems(response.data);
    } catch (error) {
      console.error('❌ Error fetching assignment items:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCondemnedItems = async () => {
    setLoading(true);
    setIsMasterInventory(false);
    setIsAssignment(false);
    setIsItInventory(false);
    setSelectedType('condemned');
    try {
      const response = await axios.get(`${API_URL}/api/inventory/condemned`);
      console.log('✅ Condemned Items:', response.data);
      setInventoryItems(response.data);
      setFilteredItems(response.data);
    } catch (error) {
      console.error('❌ Error fetching condemned items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectType = (typeId) => {
    console.log('🔍 Selected Type:', typeId);
    if (typeId === 'master') {
      fetchMasterInventory();
    } else if (typeId === 'it-inventory') {
      fetchItInventory();
    } else if (typeId === 'assignment') {
      fetchAssignmentItems();
    } else if (typeId === 'service') {
      setSelectedType('service');
      setIsMasterInventory(false);
      setIsAssignment(false);
      setIsItInventory(false);
      setInventoryItems([]);
      setFilteredItems([]);
    } else if (typeId === 'returns') {
      setSelectedType('returns');
      setIsMasterInventory(false);
      setIsAssignment(false);
      setIsItInventory(false);
      setInventoryItems([]);
      setFilteredItems([]);
    } else if (typeId === 'condemned') {
      fetchCondemnedItems();
    } else if (typeId === 'departments') {
      setSelectedType('departments');
      setIsMasterInventory(false);
      setIsAssignment(false);
      setIsItInventory(false);
      setInventoryItems([]);
      setFilteredItems([]);
    } else if (typeId === 'employees') {
      setSelectedType('employees');
      setIsMasterInventory(false);
      setIsAssignment(false);
      setIsItInventory(false);
      setInventoryItems([]);
      setFilteredItems([]);
    } else if (typeId === null) {
      setSelectedType(null);
      setIsMasterInventory(false);
      setIsAssignment(false);
      setIsItInventory(false);
      setInventoryItems([]);
      setFilteredItems([]);
    } else {
      fetchItemsByType(typeId);
    }
  };

  const handleSearch = (term) => {
    setSearchTerm(term);
    if (!term.trim()) {
      setFilteredItems(inventoryItems);
    } else {
      const filtered = inventoryItems.filter(item =>
        item.name.toLowerCase().includes(term.toLowerCase()) ||
        item.brand?.toLowerCase().includes(term.toLowerCase()) ||
        item.model?.toLowerCase().includes(term.toLowerCase()) ||
        item.serial_number?.toLowerCase().includes(term.toLowerCase())
      );
      setFilteredItems(filtered);
    }
  };

  const handleAddType = async (typeData) => {
    try {
      await axios.post(`${API_URL}/api/inventory/types`, typeData);
      setRefresh(!refresh);
      setShowAddType(false);
      alert('✅ Category added successfully!');
    } catch (error) {
      console.error('❌ Error adding type:', error);
      alert('❌ Error adding category');
    }
  };

  const handleDeleteCategory = async (typeId) => {
    const category = inventoryTypes.find(t => t.id === typeId);
    if (!category) return;
    
    const itemsCount = inventoryItems.filter(item => item.type_id === typeId).length;
    let confirmMessage = `Are you sure you want to delete category "${category.name}"?`;
    if (itemsCount > 0) {
      confirmMessage += `\n\n⚠️ This category has ${itemsCount} item(s). They will also be deleted!`;
    }
    if (window.confirm(confirmMessage)) {
      try {
        await axios.delete(`${API_URL}/api/inventory/types/${typeId}`);
        setRefresh(!refresh);
        if (selectedType === typeId) {
          setSelectedType(null);
          setIsMasterInventory(false);
          setIsAssignment(false);
          setIsItInventory(false);
          setInventoryItems([]);
          setFilteredItems([]);
        }
        alert(`✅ Category "${category.name}" deleted successfully!`);
      } catch (error) {
        console.error('❌ Error deleting category:', error);
        alert('❌ Error deleting category: ' + (error.response?.data?.message || error.message));
      }
    }
  };

  const handleAddItem = async (itemData) => {
    try {
      await axios.post(`${API_URL}/api/inventory/items`, itemData);
      setRefresh(!refresh);
      setShowAddItem(false);
      if (selectedType === 'master') fetchMasterInventory();
      else if (selectedType === 'assignment') fetchAssignmentItems();
      else if (selectedType === 'it-inventory') fetchItInventory();
      else if (selectedType === 'condemned') fetchCondemnedItems();
      else if (selectedType && selectedType !== 'master' && selectedType !== 'assignment' && selectedType !== 'it-inventory' && selectedType !== 'service' && selectedType !== 'returns' && selectedType !== 'departments' && selectedType !== 'employees') {
        fetchItemsByType(selectedType);
      }
      alert('✅ Equipment added successfully!');
    } catch (error) {
      console.error('❌ Error adding item:', error);
      alert('❌ Error adding equipment');
    }
  };

  const handleViewItem = (item) => {
    setSelectedItem(item);
    setShowViewItem(true);
  };

  const handleEditItem = (item) => {
    setSelectedItem(item);
    setShowEditItem(true);
  };

  const handleUpdateItem = async (id, updatedData) => {
    try {
      await axios.put(`${API_URL}/api/inventory/items/${id}`, updatedData);
      setRefresh(!refresh);
      setShowEditItem(false);
      if (selectedType === 'master') fetchMasterInventory();
      else if (selectedType === 'assignment') fetchAssignmentItems();
      else if (selectedType === 'it-inventory') fetchItInventory();
      else if (selectedType === 'condemned') fetchCondemnedItems();
      else if (selectedType && selectedType !== 'master' && selectedType !== 'assignment' && selectedType !== 'it-inventory' && selectedType !== 'service' && selectedType !== 'returns' && selectedType !== 'departments' && selectedType !== 'employees') {
        fetchItemsByType(selectedType);
      }
      alert('✅ Equipment updated successfully!');
    } catch (error) {
      console.error('❌ Error updating item:', error);
      alert('❌ Error updating equipment');
    }
  };

  const handleAssignItem = async (id, assignData) => {
    try {
      await axios.put(`${API_URL}/api/inventory/items/${id}`, assignData);
      setRefresh(!refresh);
      fetchAssignmentItems();
      fetchItInventory();
      alert('✅ Asset assigned successfully!');
    } catch (error) {
      console.error('❌ Error assigning asset:', error);
      alert('❌ Error assigning asset');
    }
  };

  const handleUnassignItem = async (id) => {
    if (window.confirm('Are you sure you want to unassign this asset?')) {
      try {
        await axios.put(`${API_URL}/api/inventory/items/${id}`, {
          assigned_to: null,
          location: null,
          department: null,
          station: null,
          issued_by: null,
          assigned_date: null,
          employee_id: null,
          date_of_issuance: null,
          designation: null
        });
        setRefresh(!refresh);
        fetchAssignmentItems();
        fetchItInventory();
        alert('✅ Asset unassigned successfully!');
      } catch (error) {
        console.error('❌ Error unassigning asset:', error);
        alert('❌ Error unassigning asset');
      }
    }
  };

  const handleReturnItem = async (id) => {
    if (window.confirm('Return this asset to inventory? It will be unassigned.')) {
      try {
        await axios.put(`${API_URL}/api/inventory/items/${id}`, {
          assigned_to: null,
          location: null,
          department: null,
          station: null,
          issued_by: null,
          assigned_date: null,
          employee_id: null,
          date_of_issuance: null,
          designation: null
        });
        setRefresh(!refresh);
        fetchAssignmentItems();
        fetchItInventory();
        alert('✅ Asset returned successfully!');
      } catch (error) {
        console.error('❌ Error returning asset:', error);
        alert('❌ Error returning asset');
      }
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (window.confirm('Are you sure you want to delete this equipment?')) {
      try {
        await axios.delete(`${API_URL}/api/inventory/items/${itemId}`);
        setRefresh(!refresh);
        if (selectedType === 'master') fetchMasterInventory();
        else if (selectedType === 'assignment') fetchAssignmentItems();
        else if (selectedType === 'it-inventory') fetchItInventory();
        else if (selectedType === 'condemned') fetchCondemnedItems();
        else if (selectedType && selectedType !== 'master' && selectedType !== 'assignment' && selectedType !== 'it-inventory' && selectedType !== 'service' && selectedType !== 'returns' && selectedType !== 'departments' && selectedType !== 'employees') {
          fetchItemsByType(selectedType);
        }
        alert('✅ Equipment deleted successfully!');
      } catch (error) {
        console.error('❌ Error deleting item:', error);
        alert('❌ Error deleting equipment');
      }
    }
  };

  const getTitle = () => {
    if (selectedType === 'master') return 'Master Inventory';
    if (selectedType === 'it-inventory') return 'IT Inventory (Unassigned)';
    if (selectedType === 'assignment') return 'Asset Assignment';
    if (selectedType === 'condemned') return 'Condemned Items';
    const type = inventoryTypes.find(t => t.id === selectedType);
    return type ? type.name : 'Inventory';
  };

  const isSpecificCategory = () => {
    return selectedType && 
           selectedType !== 'master' && 
           selectedType !== 'it-inventory' && 
           selectedType !== 'assignment' && 
           selectedType !== 'service' && 
           selectedType !== 'returns' &&
           selectedType !== 'condemned' &&
           selectedType !== 'departments' &&
           selectedType !== 'employees';
  };

  return (
    <div className="app">
      <Sidebar 
        types={inventoryTypes}
        onSelectType={handleSelectType}
        selectedType={selectedType}
      />
      <div className="main-content">
        {showAddType && (
          <AddType 
            onClose={() => setShowAddType(false)}
            onAdd={handleAddType}
            existingTypes={inventoryTypes}
          />
        )}
        
        {showAddItem && (
          <AddItem 
            onClose={() => setShowAddItem(false)}
            onAdd={handleAddItem}
            types={inventoryTypes}
            defaultCategoryId={isSpecificCategory() ? selectedType : null}
          />
        )}

        {showViewItem && selectedItem && (
          <ViewItem 
            item={selectedItem}
            onClose={() => setShowViewItem(false)}
          />
        )}

        {showEditItem && selectedItem && (
          <EditItem 
            item={selectedItem}
            onClose={() => setShowEditItem(false)}
            onUpdate={(data) => handleUpdateItem(selectedItem.id, data)}
            types={inventoryTypes}
          />
        )}

        {/* ===== SINGLE CONDITIONAL CHAIN ===== */}
        {selectedType === 'departments' ? (
          <Departments apiUrl={API_URL} />
        ) : selectedType === 'employees' ? (
          <Employees apiUrl={API_URL} />
        ) : selectedType === 'service' ? (
          <ServiceMaintenance />
        ) : selectedType === 'returns' ? (
          <AssetReturns types={inventoryTypes} />
        ) : selectedType === 'assignment' ? (
          <AssetAssignment 
            items={filteredItems}
            loading={loading}
            onAssign={handleAssignItem}
            onUnassign={handleUnassignItem}
            onEdit={handleUpdateItem}
            onView={handleViewItem}
            onReturn={handleReturnItem}
            types={inventoryTypes}
          />
        ) : selectedType === 'condemned' ? (
          <InventoryList 
            items={filteredItems}
            loading={loading}
            onAddItem={() => setShowAddItem(true)}
            onDeleteItem={handleDeleteItem}
            onViewItem={handleViewItem}
            onEditItem={handleEditItem}
            searchTerm={searchTerm}
            onSearch={handleSearch}
            title="Condemned Items"
            isMaster={false}
            isItInventory={false}
            types={inventoryTypes}
            categoryId={null}
            categoryName="condemned"
            onRefresh={handleRefresh}
          />
        ) : (selectedType === 'master' || selectedType === 'it-inventory' || isSpecificCategory()) ? (
          <InventoryList 
            items={filteredItems}
            loading={loading}
            onAddItem={() => setShowAddItem(true)}
            onDeleteItem={handleDeleteItem}
            onViewItem={handleViewItem}
            onEditItem={handleEditItem}
            searchTerm={searchTerm}
            onSearch={handleSearch}
            title={getTitle()}
            isMaster={selectedType === 'master' || selectedType === 'it-inventory'}
            isItInventory={selectedType === 'it-inventory'}
            types={inventoryTypes}
            categoryId={isSpecificCategory() ? selectedType : null}
            categoryName={getTitle()}
            onRefresh={handleRefresh}
          />
        ) : (
          <Dashboard 
            types={inventoryTypes}
            onSelectType={handleSelectType}
            onAddType={() => setShowAddType(true)}
            onDeleteCategory={handleDeleteCategory}
          />
        )}
      </div>
    </div>
  );
}

export default App;
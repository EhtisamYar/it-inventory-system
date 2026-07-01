const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',          // XAMPP default: empty
    database: 'inventory_db'
});

db.connect((err) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
        console.log('💡 Solutions:');
        console.log('1. XAMPP/WAMP is running?');
        console.log('2. Password is correct?');
        console.log('3. Database "inventory_db" exists?');
        return;
    }
    console.log('✅ MySQL Connected...');
});

// --------------------------------------------
// Health Check
// --------------------------------------------
app.get('/api/health', (req, res) => {
    res.json({
        status: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// --------------------------------------------
// INVENTORY TYPES
// --------------------------------------------
app.get('/api/inventory/types', (req, res) => {
    db.query('SELECT * FROM inventory_types ORDER BY name', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/inventory/types', (req, res) => {
    const { name, icon } = req.body;
    db.query(
        'INSERT INTO inventory_types (name, icon) VALUES (?, ?)',
        [name, icon || '💻'],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ message: 'Type added successfully', id: result.insertId });
        }
    );
});

app.delete('/api/inventory/types/:id', (req, res) => {
    const { id } = req.params;
    db.query('SELECT * FROM inventory_types WHERE id = ?', [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: 'Category not found' });

        db.query('DELETE FROM inventory_types WHERE id = ?', [id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Category deleted successfully', deletedCategory: results[0] });
        });
    });
});

// --------------------------------------------
// INVENTORY ITEMS
// --------------------------------------------
app.get('/api/inventory/items', (req, res) => {
    const query = `
        SELECT i.*, t.name as type_name, t.icon as type_icon
        FROM inventory_items i
        JOIN inventory_types t ON i.type_id = t.id
        ORDER BY i.name
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.get('/api/inventory/items/:typeId', (req, res) => {
    const { typeId } = req.params;
    const query = `
        SELECT i.*, t.name as type_name, t.icon as type_icon
        FROM inventory_items i
        JOIN inventory_types t ON i.type_id = t.id
        WHERE i.type_id = ?
        ORDER BY i.name
    `;
    db.query(query, [typeId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/inventory/items', (req, res) => {
    const {
        type_id, name, brand, model, serial_number, specifications,
        quantity, price, asset, asset_code, condition, remarks,
        purchase_date, warranty_until, assigned_to, location, notes,
        issued_by, department, station, assigned_date,
        employee_id, date_of_issuance, designation
    } = req.body;

    const query = `
        INSERT INTO inventory_items
        (type_id, name, brand, model, serial_number, specifications,
         quantity, price, asset, asset_code, \`condition\`, remarks,
         purchase_date, warranty_until, assigned_to, location, notes,
         issued_by, department, station, assigned_date,
         employee_id, date_of_issuance, designation)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
        type_id,
        name,
        brand || '',
        model || '',
        serial_number || '',
        specifications || '',
        quantity || 0,
        price || 0,
        asset || '',
        asset_code || '',
        condition || '',
        remarks || '',
        purchase_date || null,
        warranty_until || null,
        assigned_to || null,
        location || null,
        notes || '',
        issued_by || null,
        department || null,
        station || null,
        assigned_date || null,
        employee_id || null,
        date_of_issuance || null,
        designation || null
    ];

    db.query(query, values, (err, result) => {
        if (err) {
            console.error('❌ DB Insert Error:', err);
            return res.status(500).json({ error: err.message });
        }

        db.query(
            'UPDATE inventory_types SET total_items = total_items + 1 WHERE id = ?',
            [type_id]
        );

        res.status(201).json({
            message: 'Item added successfully',
            id: result.insertId
        });
    });
});

app.put('/api/inventory/items/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    const fields = [];
    const values = [];

    const allowedColumns = [
        'type_id', 'name', 'brand', 'model', 'serial_number', 'specifications',
        'quantity', 'price', 'asset', 'asset_code', 'condition', 'remarks',
        'purchase_date', 'warranty_until', 'assigned_to', 'location', 'notes',
        'issued_by', 'department', 'station', 'assigned_date',
        'employee_id', 'date_of_issuance', 'designation'
    ];

    for (const key of allowedColumns) {
        if (updates.hasOwnProperty(key)) {
            let val = updates[key];
            if (val === null || val === undefined || val === '') {
                val = null;
            }
            fields.push(`\`${key}\` = ?`);
            values.push(val);
        }
    }

    if (fields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);

    const query = `UPDATE inventory_items SET ${fields.join(', ')} WHERE id = ?`;

    db.query(query, values, (err, result) => {
        if (err) {
            console.error('❌ DB Update Error:', err);
            return res.status(500).json({ error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        res.json({ message: 'Item updated successfully' });
    });
});

app.delete('/api/inventory/items/:id', (req, res) => {
    const { id } = req.params;

    db.query('SELECT type_id FROM inventory_items WHERE id = ?', [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: 'Item not found' });

        const typeId = results[0].type_id;

        db.query('DELETE FROM inventory_items WHERE id = ?', [id], (err) => {
            if (err) return res.status(500).json({ error: err.message });

            db.query(
                'UPDATE inventory_types SET total_items = total_items - 1 WHERE id = ?',
                [typeId]
            );

            res.json({ message: 'Item deleted successfully' });
        });
    });
});

// --------------------------------------------
// SEARCH
// --------------------------------------------
app.get('/api/inventory/search', (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Search query missing' });
    const searchTerm = `%${q}%`;
    const query = `
        SELECT i.*, t.name as type_name, t.icon as type_icon
        FROM inventory_items i
        JOIN inventory_types t ON i.type_id = t.id
        WHERE i.name LIKE ? OR i.brand LIKE ? OR i.model LIKE ? OR i.serial_number LIKE ?
    `;
    db.query(query, [searchTerm, searchTerm, searchTerm, searchTerm], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// --------------------------------------------
// DASHBOARD STATS
// --------------------------------------------
app.get('/api/inventory/stats', (req, res) => {
    const queries = {
        totalItems: 'SELECT COUNT(*) as total FROM inventory_items',
        totalTypes: 'SELECT COUNT(*) as total FROM inventory_types'
    };

    let stats = {};
    let completed = 0;
    const totalQueries = Object.keys(queries).length;

    Object.keys(queries).forEach(key => {
        db.query(queries[key], (err, results) => {
            if (err) {
                console.error(`Error fetching stat ${key}:`, err);
                stats[key] = { total: 0 };
            } else {
                stats[key] = results[0];
            }
            completed++;
            if (completed === totalQueries) {
                res.json(stats);
            }
        });
    });
});

// ============================================
// SERVICE & MAINTENANCE
// ============================================

// Helper: calculate next service date based on schedule
function calcNextServiceDate(serviceDate, schedule) {
  const d = new Date(serviceDate);
  switch (schedule) {
    case 'weekly':   d.setDate(d.getDate() + 7); break;
    case 'monthly':  d.setMonth(d.getMonth() + 1); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'yearly':   d.setFullYear(d.getFullYear() + 1); break;
    default: return null;
  }
  return d.toISOString().split('T')[0];
}

// Get all inventory items with service status
app.get('/api/service/items', (req, res) => {
  const query = `
    SELECT 
      i.*,
      t.name as type_name,
      t.icon as type_icon,
      DATEDIFF(i.next_service_date, CURDATE()) as days_until_due
    FROM inventory_items i
    LEFT JOIN inventory_types t ON i.type_id = t.id
    ORDER BY i.next_service_date ASC
  `;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Get service history for a specific item
app.get('/api/service/history/:itemId', (req, res) => {
  const { itemId } = req.params;
  const query = `
    SELECT * FROM service_history
    WHERE item_id = ?
    ORDER BY service_date DESC
  `;
  db.query(query, [itemId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Record a new service
app.post('/api/service/record', (req, res) => {
  const { item_id, service_date, schedule_type, notes, performed_by } = req.body;

  if (!item_id || !service_date || !schedule_type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const nextServiceDate = calcNextServiceDate(service_date, schedule_type);
  if (!nextServiceDate) {
    return res.status(400).json({ error: 'Invalid schedule type' });
  }

  const insertHistory = `
    INSERT INTO service_history
    (item_id, service_date, next_service_date, schedule_type, notes, performed_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  const historyValues = [item_id, service_date, nextServiceDate, schedule_type, notes || '', performed_by || ''];

  db.query(insertHistory, historyValues, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    const updateItem = `
      UPDATE inventory_items SET
        service_schedule = ?,
        last_service_date = ?,
        next_service_date = ?
      WHERE id = ?
    `;
    db.query(updateItem, [schedule_type, service_date, nextServiceDate, item_id], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.status(201).json({ 
        message: 'Service recorded successfully', 
        nextServiceDate,
        historyId: result.insertId
      });
    });
  });
});

// Delete a service history entry
app.delete('/api/service/history/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM service_history WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'History not found' });
    res.json({ message: 'History deleted' });
  });
});

// Update service history entry
app.put('/api/service/history/:id', (req, res) => {
  const { id } = req.params;
  const { service_date, schedule_type, notes, performed_by } = req.body;

  if (!service_date || !schedule_type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const updateHistory = `
    UPDATE service_history SET
      service_date = ?,
      schedule_type = ?,
      notes = ?,
      performed_by = ?
    WHERE id = ?
  `;
  db.query(updateHistory, [service_date, schedule_type, notes || '', performed_by || '', id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'History not found' });

    db.query('SELECT item_id FROM service_history WHERE id = ?', [id], (err2, rows) => {
      if (err2) return res.status(500).json({ error: err2.message });
      const itemId = rows[0].item_id;

      const getLatest = `
        SELECT service_date, schedule_type FROM service_history
        WHERE item_id = ?
        ORDER BY service_date DESC, id DESC LIMIT 1
      `;
      db.query(getLatest, [itemId], (err3, latestRows) => {
        if (err3) return res.status(500).json({ error: err3.message });
        if (latestRows.length === 0) {
          db.query('UPDATE inventory_items SET service_schedule = NULL, last_service_date = NULL, next_service_date = NULL WHERE id = ?', [itemId]);
          return res.json({ message: 'Service updated, no history left' });
        }
        const latest = latestRows[0];
        const nextServiceDate = calcNextServiceDate(latest.service_date, latest.schedule_type);
        const updateItem = `
          UPDATE inventory_items SET
            service_schedule = ?,
            last_service_date = ?,
            next_service_date = ?
          WHERE id = ?
        `;
        db.query(updateItem, [latest.schedule_type, latest.service_date, nextServiceDate, itemId], (err4) => {
          if (err4) return res.status(500).json({ error: err4.message });
          res.json({ message: 'Service updated successfully', nextServiceDate });
        });
      });
    });
  });
});

// --------------------------------------------
// START SERVER
// --------------------------------------------
app.listen(PORT, () => {
    console.log(`🚀 IT Inventory Server running on http://localhost:${PORT}`);
    console.log(`📊 API Endpoints:`);
    console.log(`   - GET  /api/inventory/types`);
    console.log(`   - GET  /api/inventory/items`);
    console.log(`   - GET  /api/inventory/items/:typeId`);
    console.log(`   - GET  /api/inventory/stats`);
    console.log(`   - GET  /api/inventory/search?q=keyword`);
    console.log(`   - POST /api/inventory/types`);
    console.log(`   - POST /api/inventory/items`);
    console.log(`   - PUT  /api/inventory/items/:id`);
    console.log(`   - DELETE /api/inventory/items/:id`);
    console.log(`   - DELETE /api/inventory/types/:id`);
    console.log(`   - GET  /api/service/items`);
    console.log(`   - GET  /api/service/history/:itemId`);
    console.log(`   - POST /api/service/record`);
    console.log(`   - PUT  /api/service/history/:id`);
    console.log(`   - DELETE /api/service/history/:id`);
});
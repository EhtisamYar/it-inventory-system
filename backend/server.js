const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// -------------------- Multer (memory storage for images) --------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max (compression will handle)
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only images (JPEG, PNG, GIF, WEBP) are allowed'), false);
  }
});

// -------------------- Image Compression Helper (target 50 KB) --------------------
async function compressImage(buffer, maxSizeBytes = 50 * 1024) {
  const image = sharp(buffer);
  const metadata = await image.metadata();
  let quality = 80;
  let width = metadata.width;
  let height = metadata.height;

  if (buffer.length <= maxSizeBytes) return buffer;

  let compressedBuffer = await image
    .resize({ width: Math.min(width, 1200), height: Math.min(height, 1200), fit: 'inside' })
    .jpeg({ quality, progressive: true })
    .toBuffer();

  while (compressedBuffer.length > maxSizeBytes && quality > 10) {
    quality -= 5;
    if (quality < 30) {
      const meta = await sharp(compressedBuffer).metadata();
      const newWidth = Math.floor(meta.width * 0.8);
      const newHeight = Math.floor(meta.height * 0.8);
      compressedBuffer = await sharp(compressedBuffer)
        .resize({ width: newWidth, height: newHeight, fit: 'inside' })
        .jpeg({ quality, progressive: true })
        .toBuffer();
    } else {
      compressedBuffer = await sharp(compressedBuffer)
        .jpeg({ quality, progressive: true })
        .toBuffer();
    }
  }

  if (compressedBuffer.length > maxSizeBytes) {
    compressedBuffer = await sharp(compressedBuffer)
      .resize({ width: 800, height: 800, fit: 'inside' })
      .jpeg({ quality: 10, progressive: true })
      .toBuffer();
  }

  return compressedBuffer;
}

// -------------------- Database Connection --------------------
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
  const { name, icon, columns } = req.body;

  db.query(
    'INSERT INTO inventory_types (name, icon) VALUES (?, ?)',
    [name, icon || '📦'],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });

      const categoryId = result.insertId;

      if (columns && columns.length > 0) {
        const allColumns = [
          'category', 'name', 'brand', 'model', 'serial_number',
          'specifications', 'quantity', 'price', 'asset', 'asset_code',
          'condition', 'remarks', 'location', 'department', 'email',
          'assigned_to', 'employee_id', 'designation', 'date_of_issuance'
        ];

        const insertValues = allColumns.map((key, index) => [
          categoryId,
          key,
          key,
          columns.includes(key) ? 1 : 0,
          index
        ]);

        const insertQuery = `
                    INSERT INTO category_columns (category_id, column_key, column_label, is_visible, display_order)
                    VALUES ?
                `;
        db.query(insertQuery, [insertValues], (err2) => {
          if (err2) {
            console.error('❌ Error inserting category columns:', err2);
            return res.status(201).json({
              message: 'Type added successfully, but column settings failed',
              id: categoryId
            });
          }
          res.status(201).json({
            message: 'Type added successfully',
            id: categoryId
          });
        });
      } else {
        res.status(201).json({
          message: 'Type added successfully',
          id: categoryId
        });
      }
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
// INVENTORY ITEMS (GET – excluding image)
// --------------------------------------------
app.get('/api/inventory/items', (req, res) => {
  const query = `
        SELECT 
            i.id, i.type_id, i.name, i.brand, i.model, i.serial_number, 
            i.specifications, i.quantity, i.price, i.asset, i.asset_code, 
            i.\`condition\`, i.remarks, i.purchase_date, i.warranty_until, 
            i.assigned_to, i.location, i.notes, i.issued_by, i.department, 
            i.station, i.assigned_date, i.employee_id, i.date_of_issuance, 
            i.designation, i.issuance_number, i.backup_done, i.email,
            t.name as type_name, t.icon as type_icon
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
        SELECT 
            i.id, i.type_id, i.name, i.brand, i.model, i.serial_number, 
            i.specifications, i.quantity, i.price, i.asset, i.asset_code, 
            i.\`condition\`, i.remarks, i.purchase_date, i.warranty_until, 
            i.assigned_to, i.location, i.notes, i.issued_by, i.department, 
            i.station, i.assigned_date, i.employee_id, i.date_of_issuance, 
            i.designation, i.issuance_number, i.backup_done, i.email,
            t.name as type_name, t.icon as type_icon
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

// -------------------- Image Endpoint --------------------
app.get('/api/inventory/items/:id/image', (req, res) => {
  const { id } = req.params;
  db.query('SELECT image FROM inventory_items WHERE id = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0 || !results[0].image) {
      return res.status(404).json({ error: 'Image not found' });
    }
    const img = results[0].image;
    res.set('Content-Type', 'image/jpeg');
    res.send(img);
  });
});

// ===== POST /api/inventory/items with image support =====
app.post('/api/inventory/items', upload.single('image'), async (req, res) => {
  try {
    const {
      type_id, name, brand, model, serial_number, specifications,
      quantity, price, asset, asset_code, condition, remarks,
      purchase_date, warranty_until, assigned_to, location, notes,
      issued_by, department, station, assigned_date,
      employee_id, date_of_issuance, designation,
      issuance_number, backup_done,
      email
    } = req.body;

    const optionalFields = [
      'brand', 'model', 'serial_number', 'specifications', 'asset', 'asset_code',
      'remarks', 'purchase_date', 'warranty_until', 'assigned_to', 'location', 'notes',
      'issued_by', 'department', 'station', 'assigned_date', 'employee_id',
      'date_of_issuance', 'designation', 'issuance_number', 'email'
    ];
    const cleaned = { ...req.body };
    optionalFields.forEach(field => {
      if (cleaned[field] === '') cleaned[field] = null;
    });

    let imageBuffer = null;
    if (req.file) {
      imageBuffer = await compressImage(req.file.buffer);
    }

    const values = [
      cleaned.type_id,
      cleaned.name,
      cleaned.brand,
      cleaned.model,
      cleaned.serial_number,
      cleaned.specifications,
      cleaned.quantity || 0,
      cleaned.price || 0,
      cleaned.asset,
      cleaned.asset_code,
      cleaned.condition,
      cleaned.remarks,
      cleaned.purchase_date,
      cleaned.warranty_until,
      cleaned.assigned_to,
      cleaned.location,
      cleaned.notes,
      cleaned.issued_by,
      cleaned.department,
      cleaned.station,
      cleaned.assigned_date,
      cleaned.employee_id,
      cleaned.date_of_issuance,
      cleaned.designation,
      cleaned.issuance_number,
      cleaned.backup_done ? 1 : 0,
      cleaned.email,
      imageBuffer
    ];

    const query = `
            INSERT INTO inventory_items
            (type_id, name, brand, model, serial_number, specifications,
             quantity, price, asset, asset_code, \`condition\`, remarks,
             purchase_date, warranty_until, assigned_to, location, notes,
             issued_by, department, station, assigned_date,
             employee_id, date_of_issuance, designation,
             issuance_number, backup_done, email, image)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

    db.query(query, values, (err, result) => {
      if (err) {
        console.error('❌ DB Insert Error:', err);
        return res.status(500).json({ error: err.message });
      }

      db.query(
        'UPDATE inventory_types SET total_items = total_items + 1 WHERE id = ?',
        [cleaned.type_id]
      );

      res.status(201).json({
        message: 'Item added successfully',
        id: result.insertId
      });
    });
  } catch (error) {
    console.error('Error processing image:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== PUT /api/inventory/items/:id with image support (FIXED) =====
app.put('/api/inventory/items/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const optionalFields = [
      'brand', 'model', 'serial_number', 'specifications', 'asset', 'asset_code',
      'remarks', 'purchase_date', 'warranty_until', 'assigned_to', 'location', 'notes',
      'issued_by', 'department', 'station', 'assigned_date', 'employee_id',
      'date_of_issuance', 'designation', 'issuance_number', 'email'
    ];
    optionalFields.forEach(field => {
      if (updates[field] === '') updates[field] = null;
    });

    let imageBuffer = null;
    if (req.file) {
      imageBuffer = await compressImage(req.file.buffer);
      updates.image = imageBuffer;
    } else if (updates.image === null || updates.image === '') {
      updates.image = null;
    }

    const fields = [];
    const values = [];

    const allowedColumns = [
      'type_id', 'name', 'brand', 'model', 'serial_number', 'specifications',
      'quantity', 'price', 'asset', 'asset_code', 'condition', 'remarks',
      'purchase_date', 'warranty_until', 'assigned_to', 'location', 'notes',
      'issued_by', 'department', 'station', 'assigned_date',
      'employee_id', 'date_of_issuance', 'designation',
      'issuance_number', 'backup_done',
      'email', 'image'
    ];

    for (const key of allowedColumns) {
      // ✅ FIXED: Use Object.prototype.hasOwnProperty.call()
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
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
  } catch (error) {
    console.error('Error processing image:', error);
    res.status(500).json({ error: error.message });
  }
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
        SELECT 
            i.id, i.type_id, i.name, i.brand, i.model, i.serial_number, 
            i.specifications, i.quantity, i.price, i.asset, i.asset_code, 
            i.\`condition\`, i.remarks, i.purchase_date, i.warranty_until, 
            i.assigned_to, i.location, i.notes, i.issued_by, i.department, 
            i.station, i.assigned_date, i.employee_id, i.date_of_issuance, 
            i.designation, i.issuance_number, i.backup_done, i.email,
            t.name as type_name, t.icon as type_icon
        FROM inventory_items i
        JOIN inventory_types t ON i.type_id = t.id
        WHERE i.name LIKE ? OR i.brand LIKE ? OR i.model LIKE ? OR i.serial_number LIKE ?
    `;
  db.query(query, [searchTerm, searchTerm, searchTerm, searchTerm], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// ============================================
// CONDEMNED ITEMS
// ============================================
app.get('/api/inventory/condemned', (req, res) => {
  const query = `
        SELECT 
            i.id, i.type_id, i.name, i.brand, i.model, i.serial_number, 
            i.specifications, i.quantity, i.price, i.asset, i.asset_code, 
            i.\`condition\`, i.remarks, i.purchase_date, i.warranty_until, 
            i.assigned_to, i.location, i.notes, i.issued_by, i.department, 
            i.station, i.assigned_date, i.employee_id, i.date_of_issuance, 
            i.designation, i.issuance_number, i.backup_done, i.email,
            t.name as type_name, t.icon as type_icon
        FROM inventory_items i
        JOIN inventory_types t ON i.type_id = t.id
        WHERE i.condition = 'Condemned'
        ORDER BY i.name
    `;
  db.query(query, (err, results) => {
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
function calcNextServiceDate(serviceDate, schedule) {
  const d = new Date(serviceDate);
  switch (schedule) {
    case 'weekly': d.setDate(d.getDate() + 7); break;
    case 'monthly': d.setMonth(d.getMonth() + 1); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
    default: return null;
  }
  return d.toISOString().split('T')[0];
}

app.get('/api/service/items', (req, res) => {
  const query = `
        SELECT 
            i.id, i.type_id, i.name, i.brand, i.model, i.serial_number, 
            i.specifications, i.quantity, i.price, i.asset, i.asset_code, 
            i.\`condition\`, i.remarks, i.purchase_date, i.warranty_until, 
            i.assigned_to, i.location, i.notes, i.issued_by, i.department, 
            i.station, i.assigned_date, i.employee_id, i.date_of_issuance, 
            i.designation, i.issuance_number, i.backup_done, i.email,
            t.name as type_name, t.icon as type_icon,
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

app.delete('/api/service/history/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM service_history WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'History not found' });
    res.json({ message: 'History deleted' });
  });
});

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

// ============================================
// ITEM RETURN FEATURE
// ============================================
app.post('/api/inventory/return', (req, res) => {
  const {
    item_id, email, backup_done, remarks, returned_by, mobile_number, return_date,
    email_backup_done, email_closed,
    employee_id, designation, station, department, issued_by, date_of_issuance
  } = req.body;

  if (!item_id) {
    return res.status(400).json({ error: 'Item ID is required' });
  }

  const clearItem = `
        UPDATE inventory_items SET
            assigned_to = NULL,
            designation = NULL,
            department = NULL,
            location = NULL,
            employee_id = NULL,
            date_of_issuance = NULL,
            issued_by = NULL,
            station = NULL,
            assigned_date = NULL,
            email = NULL
        WHERE id = ?
    `;

  db.query(clearItem, [item_id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Item not found' });

    const insertReturn = `
            INSERT INTO item_returns 
            (item_id, returned_by, return_date, email, backup_done, remarks, mobile_number, 
             email_backup_done, email_closed,
             employee_id, designation, station, department, issued_by, date_of_issuance)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
    const values = [
      item_id,
      returned_by || 'System',
      return_date || new Date().toISOString().split('T')[0],
      email || null,
      backup_done ? 1 : 0,
      remarks || null,
      mobile_number || null,
      email_backup_done ? 1 : 0,
      email_closed ? 1 : 0,
      employee_id || null,
      designation || null,
      station || null,
      department || null,
      issued_by || null,
      date_of_issuance || null
    ];

    db.query(insertReturn, values, (err2, result2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.status(201).json({
        message: 'Item returned successfully',
        returnId: result2.insertId
      });
    });
  });
});

// ============================================
// GET ALL RETURNS
// ============================================
app.get('/api/returns', (req, res) => {
  const query = `
        SELECT 
            r.*,
            i.name AS item_name,
            i.serial_number,
            i.asset,
            i.specifications,
            i.location,
            i.type_id,
            t.name AS category_name
        FROM item_returns r
        JOIN inventory_items i ON r.item_id = i.id
        JOIN inventory_types t ON i.type_id = t.id
        ORDER BY r.return_date DESC
    `;
  db.query(query, (err, results) => {
    if (err) {
      console.error('❌ Error fetching returns:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log(`✅ Found ${results.length} returns`);
    res.json(results);
  });
});

// ============================================
// DEPARTMENTS CRUD
// ============================================
app.get('/api/departments', (req, res) => {
  db.query('SELECT * FROM departments ORDER BY name', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/api/departments', (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  db.query(
    'INSERT INTO departments (name, description) VALUES (?, ?)',
    [name, description || null],
    (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Department already exists' });
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id: result.insertId, name, description });
    }
  );
});

app.put('/api/departments/:id', (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  db.query(
    'UPDATE departments SET name = ?, description = ? WHERE id = ?',
    [name, description || null, id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Department not found' });
      res.json({ message: 'Department updated' });
    }
  );
});

app.delete('/api/departments/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM departments WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Department not found' });
    res.json({ message: 'Department deleted' });
  });
});

// ============================================
// EMPLOYEES CRUD
// ============================================
app.get('/api/employees', (req, res) => {
  const query = `
        SELECT e.*, d.name as department_name 
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        ORDER BY e.name
    `;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.get('/api/employees/:id', (req, res) => {
  const { id } = req.params;
  const query = `
        SELECT e.*, d.name as department_name 
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE e.id = ?
    `;
  db.query(query, [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ error: 'Employee not found' });
    res.json(results[0]);
  });
});

app.post('/api/employees', (req, res) => {
  const { name, employee_id, email, contact_no, designation, department_id, address, job_type, cnic_number, grade } = req.body;
  if (!name || !employee_id) return res.status(400).json({ error: 'Name and Employee ID are required' });

  const optionalFields = ['email', 'contact_no', 'designation', 'department_id', 'address', 'job_type', 'cnic_number', 'grade'];
  const cleaned = { ...req.body };
  optionalFields.forEach(field => {
    if (cleaned[field] === '') cleaned[field] = null;
  });

  db.query(
    `INSERT INTO employees 
        (name, employee_id, email, contact_no, designation, department_id, address, job_type, cnic_number, grade)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [cleaned.name, cleaned.employee_id, cleaned.email, cleaned.contact_no, cleaned.designation, cleaned.department_id, cleaned.address, cleaned.job_type, cleaned.cnic_number, cleaned.grade],
    (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Employee ID already exists' });
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id: result.insertId, message: 'Employee added' });
    }
  );
});

app.put('/api/employees/:id', (req, res) => {
  const { id } = req.params;
  const { name, employee_id, email, contact_no, designation, department_id, address, job_type, cnic_number, grade } = req.body;
  if (!name || !employee_id) return res.status(400).json({ error: 'Name and Employee ID are required' });

  const optionalFields = ['email', 'contact_no', 'designation', 'department_id', 'address', 'job_type', 'cnic_number', 'grade'];
  const cleaned = { ...req.body };
  optionalFields.forEach(field => {
    if (cleaned[field] === '') cleaned[field] = null;
  });

  db.query(
    `UPDATE employees SET 
            name = ?, employee_id = ?, email = ?, contact_no = ?, 
            designation = ?, department_id = ?, address = ?,
            job_type = ?, cnic_number = ?, grade = ?
        WHERE id = ?`,
    [cleaned.name, cleaned.employee_id, cleaned.email, cleaned.contact_no, cleaned.designation, cleaned.department_id, cleaned.address, cleaned.job_type, cleaned.cnic_number, cleaned.grade, id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Employee not found' });
      res.json({ message: 'Employee updated' });
    }
  );
});

app.delete('/api/employees/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM employees WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Employee not found' });
    res.json({ message: 'Employee deleted' });
  });
});

// ============================================
// CATEGORY COLUMNS MANAGEMENT
// ============================================
app.get('/api/category-columns/:categoryId', (req, res) => {
  const { categoryId } = req.params;
  const query = `
        SELECT * FROM category_columns 
        WHERE category_id = ? 
        ORDER BY display_order
    `;
  db.query(query, [categoryId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.put('/api/category-columns/:categoryId', (req, res) => {
  const { categoryId } = req.params;
  const { columns } = req.body;

  db.query('DELETE FROM category_columns WHERE category_id = ?', [categoryId], (err) => {
    if (err) return res.status(500).json({ error: err.message });

    if (!columns || columns.length === 0) {
      return res.json({ message: 'All columns removed' });
    }

    const insertQuery = `
            INSERT INTO category_columns (category_id, column_key, column_label, is_visible, display_order)
            VALUES ?
        `;
    const values = columns.map((col, index) => [
      categoryId,
      col.column_key,
      col.column_label,
      col.is_visible ? 1 : 0,
      index
    ]);

    db.query(insertQuery, [values], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ message: 'Columns updated successfully' });
    });
  });
});

// --------------------------------------------
// IMPORT EXCEL
// --------------------------------------------
const multerExcel = require('multer');
const xlsx = require('xlsx');
// path is already declared at the top

const storage = multerExcel.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const uploadExcel = multerExcel({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    if (ext === '.xlsx' || ext === '.xls') {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'), false);
    }
  }
});

app.post('/api/inventory/import/:categoryId', uploadExcel.single('file'), async (req, res) => {
  try {
    const categoryId = req.params.categoryId;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const workbook = xlsx.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    if (!data || data.length === 0) {
      return res.status(400).json({ error: 'The file is empty or has no valid data' });
    }

    const columnMapping = {
      'Name': 'name',
      'Item': 'name',
      'Device': 'name',
      'Model': 'model',
      'Brand': 'brand',
      'Brand Name': 'brand',
      'QTY': 'quantity',
      'Qty': 'quantity',
      'Quantity': 'quantity',
      'Price': 'price',
      'Value': 'price',
      'Book Value': 'price',
      'Asset Code': 'asset_code',
      'Asset Code ': 'asset_code',
      'TAG': 'asset_code',
      'Tags': 'asset_code',
      'TAGS': 'asset_code',
      'Location': 'location',
      'Department': 'department',
      'User': 'assigned_to',
      'Assigned To': 'assigned_to',
      'Serial Number': 'serial_number',
      'S.No': 'serial_number',
      'S.NO': 'serial_number',
      'Remarks': 'remarks',
      'Status': 'condition',
      'Condition': 'condition',
      'Specifications': 'specifications',
      'Specs': 'specifications',
      'OS': 'os',
      'RAM': 'ram',
    };

    const headers = Object.keys(data[0]);
    const dbColumns = headers.map(h => columnMapping[h] || null).filter(c => c !== null);

    if (dbColumns.length === 0) {
      return res.status(400).json({ error: 'No recognized columns in the file. Please ensure headers match: Name, Brand, Model, QTY, Price, TAG, Location, etc.' });
    }

    const insertColumns = ['type_id', ...dbColumns];
    const placeholders = insertColumns.map(() => '?').join(', ');
    const columnsString = insertColumns.map(c => `\`${c}\``).join(', ');

    const insertQuery = `INSERT IGNORE INTO inventory_items (${columnsString}) VALUES (${placeholders})`;

    let insertedCount = 0;
    let skippedCount = 0;

    for (const row of data) {
      const values = [];
      values.push(categoryId);
      for (const col of dbColumns) {
        const header = Object.keys(columnMapping).find(h => columnMapping[h] === col);
        let cellValue = row[header] !== undefined ? row[header] : null;

        if (typeof cellValue === 'string') {
          cellValue = cellValue.trim();
          if (cellValue === '') cellValue = null;
        }

        if (col === 'price' && typeof cellValue === 'string') {
          cellValue = parseFloat(cellValue.replace(/,/g, ''));
          if (isNaN(cellValue)) cellValue = null;
        }

        values.push(cellValue);
      }

      await new Promise((resolve, reject) => {
        db.query(insertQuery, values, (err, result) => {
          if (err) {
            console.error('Insert error:', err);
            skippedCount++;
            resolve();
          } else {
            if (result.affectedRows > 0) {
              insertedCount++;
            } else {
              skippedCount++;
            }
            resolve();
          }
        });
      });
    }

    const fs = require('fs');
    fs.unlinkSync(file.path);

    res.json({
      message: 'Import completed',
      totalRows: data.length,
      inserted: insertedCount,
      skipped: skippedCount
    });

  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RACK ITEMS CRUD
// ============================================
app.get('/api/rack-items', (req, res) => {
  db.query('SELECT * FROM rack_items ORDER BY brand', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/api/rack-items', (req, res) => {
  const { brand, specifications, quantity } = req.body;
  if (!brand) return res.status(400).json({ error: 'Brand is required' });
  db.query(
    'INSERT INTO rack_items (brand, specifications, quantity) VALUES (?, ?, ?)',
    [brand, specifications || null, quantity || 1],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: result.insertId, message: 'Item added' });
    }
  );
});

app.put('/api/rack-items/:id', (req, res) => {
  const { id } = req.params;
  const { brand, specifications, quantity } = req.body;
  if (!brand) return res.status(400).json({ error: 'Brand is required' });
  db.query(
    'UPDATE rack_items SET brand = ?, specifications = ?, quantity = ? WHERE id = ?',
    [brand, specifications || null, quantity || 1, id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Item not found' });
      res.json({ message: 'Item updated' });
    }
  );
});

app.delete('/api/rack-items/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM rack_items WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Item not found' });
    res.json({ message: 'Item deleted' });
  });
});

// --------------------------------------------
// START SERVER – LISTEN ON ALL NETWORK INTERFACES ✅
// --------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 IT Inventory Server running on http://0.0.0.0:${PORT} (accessible via network IP)`);
  console.log(`📊 API Endpoints:`);
  console.log(`   - GET  /api/inventory/types`);
  console.log(`   - GET  /api/inventory/items`);
  console.log(`   - GET  /api/inventory/items/:typeId`);
  console.log(`   - GET  /api/inventory/items/:id/image`);
  console.log(`   - GET  /api/inventory/stats`);
  console.log(`   - GET  /api/inventory/search?q=keyword`);
  console.log(`   - GET  /api/inventory/condemned`);
  console.log(`   - GET  /api/returns`);
  console.log(`   - GET  /api/departments`);
  console.log(`   - POST /api/departments`);
  console.log(`   - PUT  /api/departments/:id`);
  console.log(`   - DELETE /api/departments/:id`);
  console.log(`   - GET  /api/employees`);
  console.log(`   - GET  /api/employees/:id`);
  console.log(`   - POST /api/employees`);
  console.log(`   - PUT  /api/employees/:id`);
  console.log(`   - DELETE /api/employees/:id`);
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
  console.log(`   - POST /api/inventory/return`);
  console.log(`   - GET  /api/rack-items`);
  console.log(`   - POST /api/rack-items`);
  console.log(`   - PUT  /api/rack-items/:id`);
  console.log(`   - DELETE /api/rack-items/:id`);
});
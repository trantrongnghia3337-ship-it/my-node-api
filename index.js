const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const dotenv = require('dotenv');
dotenv.config();


const app = express();
const port = process.env.PORT || 3000;

// ================== CẤU HÌNH SQL SERVER ==================
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  server: process.env.DB_SERVER,    // IP/hostname SQL Server
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

// Middleware
app.use(cors());
app.use(express.json());

// ================== MAIN ==================
sql.connect(config).then(pool => {
  console.log('Kết nối SQL Server thành công!');
  
// ================== API: Đăng nhập =========
  app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Thiếu username hoặc password' });
    }

    try {
      const result = await pool.request()
        .input('username', sql.VarChar(50), username)
        .input('password', sql.VarChar(50), password)
        .query(`
          SELECT * FROM dbo.Accounts
          WHERE username = @username AND password = @password
        `);

      if (result.recordset.length > 0) {
        console.log(`Đăng nhập thành công: ${username}`);
        res.json({ success: true, message: 'Đăng nhập thành công!' });
      } else {
        res.status(401).json({ success: false, message: 'Sai tài khoản hoặc mật khẩu!' });
      }

    } catch (err) {
      console.error('Lỗi truy vấn đăng nhập:', err);
      res.status(500).json({ success: false, message: 'Lỗi hệ thống khi đăng nhập' });
    }
  });

  // ================== API: Ghi user + lịch sử ==================
  app.post('/user', async (req, res) => {
    const { id, name } = req.body;
    const createdAt = new Date();

    try {
      // Cập nhật hoặc thêm vào dbo.Users
      await pool.request()
        .input('id', sql.VarChar(50), id)
        .input('name', sql.NVarChar(100), name)
        .input('createdAt', sql.DateTime, createdAt)
        .query(`
          MERGE INTO dbo.Users AS target
          USING (SELECT @id AS id, @name AS name) AS source
          ON target.id = source.id
          WHEN MATCHED THEN
            UPDATE SET name = source.name, createdAt = @createdAt
          WHEN NOT MATCHED THEN
            INSERT (id, name, createdAt)
            VALUES (@id, @name, @createdAt);
        `);

      // Ghi thêm vào dbo.History
      await pool.request()
        .input('id', sql.VarChar(50), id)
        .input('name', sql.NVarChar(100), name)
        .input('createdAt', sql.DateTime, createdAt)
        .query(`
          INSERT INTO dbo.History (userId, name, createdAt)
          VALUES (@id, @name, @createdAt);
        `);

      res.json({ message: 'Đã lưu user và lịch sử thành công!' });

    } catch (err) {
      console.error('Lỗi ghi dữ liệu:', err);
      res.status(500).json({ error: 'Lỗi ghi dữ liệu vào SQL Server' });
    }
  });

  // ================== API: Lấy lịch sử ==================
  app.get('/history', async (req, res) => {
    try {
      const result = await pool.request().query(`
        SELECT * FROM dbo.History ORDER BY createdAt DESC
      `);
      res.json(result.recordset);
    } catch (err) {
      console.error('Lỗi truy vấn:', err);
      res.status(500).json({ error: 'Lỗi truy vấn dữ liệu' });
    }
  });

 

  // ================== KHỞI ĐỘNG SERVER ==================
  app.listen(port, "0.0.0.0", () => {
    console.log(`API đang chạy tại http://0.0.0.0:${port}`);
  });

}).catch(err => {
  console.error('Kết nối SQL Server thất bại:', err);
});

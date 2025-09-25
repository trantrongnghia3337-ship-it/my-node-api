import express from 'express';
import cors from 'cors';
import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Cấu hình kết nối SQL Server từ .env
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    instanceName: process.env.DB_INSTANCE  
  }
};

// Middleware
app.use(cors());
app.use(express.json());  

// Kết nối SQL Server
sql.connect(config).then(pool => {
  console.log('Đã kết nối SQL Server');

  // API: Ghi user và lịch sử
  app.post('/user', async (req, res) => {
    const { id, name } = req.body;
    const createdAt = new Date();

    try {
      // Cập nhật hoặc thêm user vào bảng `users`
      await pool.request()
        .input('id', sql.VarChar, id)
        .input('name', sql.NVarChar, name)
        .input('createdAt', sql.DateTime, createdAt)
        .query(`
          MERGE INTO users AS target
          USING (SELECT @id AS id, @name AS name) AS source
          ON target.id = source.id
          WHEN MATCHED THEN
            UPDATE SET name = source.name, createdAt = @createdAt
          WHEN NOT MATCHED THEN
            INSERT (id, name, createdAt)
            VALUES (@id, @name, @createdAt);
        `);

      // Ghi vào bảng `history`
      await pool.request()
        .input('id', sql.VarChar, id)
        .input('name', sql.NVarChar, name)
        .input('createdAt', sql.DateTime, createdAt)
        .query(`
          INSERT INTO history (userId, name, createdAt)
          VALUES (@id, @name, @createdAt);
        `);

      res.json({ message: 'Đã lưu user và lịch sử thành công!' });

    } catch (err) {
      console.error('Lỗi ghi dữ liệu:', err);
      res.status(500).json({ error: 'Lỗi ghi dữ liệu vào SQL Server' });
    }
  });

  // API: Lấy toàn bộ lịch sử
  app.get('/history', async (req, res) => {
    try {
      const result = await pool.request().query(`
        SELECT * FROM history ORDER BY createdAt DESC
      `);
      res.json(result.recordset);
    } catch (err) {
      console.error('Lỗi truy vấn:', err);
      res.status(500).json({ error: 'Lỗi truy vấn dữ liệu' });
    }
  });

  // Khởi động server
  app.listen(port, () => {
    console.log(`API đang chạy tại http://localhost:${port}`);
  });

}).catch(err => {
  console.error('Kết nối SQL Server thất bại:', err);
});

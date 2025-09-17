const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sql = require('mssql');
require('dotenv').config(); // Nạp biến môi trường từ .env

const app = express();
const port = process.env.PORT || 3000;

// Cấu hình kết nối SQL Server từ biến môi trường
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  server: process.env.DB_SERVER,  // IP Public 
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_NAME,
  options: {
    encrypt: false,               
    trustServerCertificate: true  
  }
};

app.use(cors());
app.use(bodyParser.json());

// Kết nối SQL
sql.connect(config).then(pool => {
  console.log('Đã kết nối SQL Server thành công');

  // API: Ghi user và lịch sử
  app.post('/user', async (req, res) => {
    const { id, name } = req.body;
    const createdAt = new Date().toISOString();

    try {
      await pool.request().query(`
        MERGE INTO users AS target
        USING (SELECT '${id}' AS id, '${name}' AS name) AS source
        ON target.id = source.id
        WHEN MATCHED THEN
          UPDATE SET name = source.name, createdAt = '${createdAt}'
        WHEN NOT MATCHED THEN
          INSERT (id, name, createdAt)
          VALUES ('${id}', '${name}', '${createdAt}');

        INSERT INTO history (userId, name, createdAt)
        VALUES ('${id}', '${name}', '${createdAt}');
      `);

      res.send('Đã lưu user và lịch sử');
    } catch (err) {
      console.error('Lỗi khi ghi dữ liệu:', err);
      res.status(500).send('Lỗi khi ghi dữ liệu vào SQL Server');
    }
  });

  // API: Lấy lịch sử
  app.get('/history', async (req, res) => {
    try {
      const result = await pool.request().query(`
        SELECT * FROM history ORDER BY createdAt DESC
      `);
      res.json(result.recordset);
    } catch (err) {
      console.error('Lỗi khi truy vấn:', err);
      res.status(500).send('Lỗi khi truy vấn dữ liệu');
    }
  });

  // Khởi động server
  app.listen(port, () => {
    console.log(`Server đang chạy tại http://localhost:${port}`);
  });

}).catch(err => {
  console.error('Kết nối SQL Server thất bại:', err);
});

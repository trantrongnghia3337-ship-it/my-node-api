const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sql = require('mssql');

const app = express();
const port = 3000;

// ⚙️ Cấu hình SQL Server
const config = {
  user: 'sa',              // user của SQL Server
  password: 'Server123@',      // mật khẩu (bạn sửa lại đúng)
  server: 'localhost',     // hoặc IP nếu khác máy
  database: 'ReactDataESP',        // tên database bạn đã tạo
  options: {
    encrypt: false,        
    trustServerCertificate: true
  }
};

app.use(cors());
app.use(bodyParser.json());

// Kết nối đến SQL Server
sql.connect(config)
  .then(pool => {
    console.log('Đã kết nối SQL Server');

    // API: Thêm user và ghi lịch sử
    app.post('/user', async (req, res) => {
      const { id, name } = req.body;
      const createdAt = new Date().toISOString();

      try {
        await pool.request()
          .query(`
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
        console.error('SQL Error:', err);
        res.status(500).send('Lỗi khi lưu dữ liệu');
      }
    });

    // API: Lấy lịch sử
    app.get('/history', async (req, res) => {
      try {
        const result = await pool.request()
          .query('SELECT * FROM history ORDER BY createdAt DESC');
        res.json(result.recordset);
      } catch (err) {
        console.error('SQL Error:', err);
        res.status(500).send('Lỗi khi truy vấn');
      }
    });

    app.listen(port, () => {
      console.log(`Server đang chạy tại http://localhost:${port}`);
    });

  })
  .catch(err => {
    console.error('Kết nối thất bại:', err);
  });

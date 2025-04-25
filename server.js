const express = require('express');
const cors = require('cors');
const mysql = require('mysql');
const path = require('path');
const jwt = require('jsonwebtoken');
// require('dotenv').config(); // for using .env file
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'my-app-secret-key';
const app = express();


app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(cors());

// // Add headers before the routes are defined
app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});



const db = mysql.createConnection({
    host: '162.241.218.106',
    user: 'yzrmttmy_olaogunyemi',
    password: 'WebteamIntranet01',
    database: 'yzrmttmy_staffpolicy'
})


app.get('/', (req, res) => {
    res.send('Hello from our server!')
})

app.post('/add_user', async(req, res) => {

    const { name, email, username, password, role } = req.body;

    // Basic validation
    if (!name || !email || !username || !password) {
        return res.status(400).json({ message: "All fields are required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
    }

    if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    try {
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert user
        const sql = "INSERT INTO staff_users (name, email, username, password,role) VALUES (?, ?, ?, ?, ?)";
        const values = [name, email, username, hashedPassword, role];

        db.query(sql, values, (err, result) => {
            if (err) {
                console.error("DB error:", err);
                return res.status(500).json({ message: "Something unexpected occurred", error: err });
            }

            return res.status(200).json({ success: "User added successfully" });
        });

    } catch (error) {
        console.error("Hashing error:", error);
        return res.status(500).json({ message: "Server error" });
    }
});
app.get('/users', (req, res) => {
    const sql = "SELECT * FROM staff_users";
   
    db.query(sql, (err, result) => {
        if (err) {
            console.error("DB error:", err);
            return res.status(500).json({ message: "Something unexpected occurred", error: err });
        }

        console.log('result:', result);
        return res.json(result);
    });
});

app.post('/login', (req, res) => {
    
    const { logPassword, logUsername } = req.body;

    if (!logUsername || !logPassword) {
        return res.status(400).json({ message: `All fields are required ${req.body.logUsername} ${logPassword}` });
    }

    const sql = "SELECT * FROM staff_users WHERE username = ?";
    db.query(sql, [logUsername], async (err, results) => {
        if (err) {
            console.error("DB error:", err);
            return res.status(500).json({ message: "Server error" });
        }

        if (results.length === 0) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const user = results[0];

        const isMatch = await bcrypt.compare(logPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, logUsername: user.username },
            JWT_SECRET,
            { expiresIn: '1h' } // Token lasts 1 hour
        );

        return res.json({ token,  id: user.id, logUsername: user.username , name: user.name, email: user.email, role: user.role });
    });
});


app.get('/proxy-pdf', async (req, res) => {
    const { url } = req.query;
  
    if (!url) return res.status(400).json({ error: 'Missing url query param' });
  
    try {
      const response = await fetch(url);
      const contentType = response.headers.get('content-type');
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
  
      res.set('Content-Type', contentType || 'application/pdf');
      res.send(buffer);
    } catch (err) {
      console.error('PDF fetch error:', err);
      res.status(500).json({ error: 'Failed to fetch PDF' });
    }
  });


// confirmation by staff that they have read the document
app.post('/confirm-read', (req, res) => {
  const { profile, documentUrl, timestamp } = req.body;

  const doc_name = documentUrl.substring(60, documentUrl.indexOf('.pdf'));

  console.log(profile.user.name);

  const sql = `
    INSERT INTO document_confirmations (user, document_name, document_url, timestamp)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE timestamp = ?
  `;

  const values = [profile.user.name, doc_name, documentUrl, timestamp, timestamp];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error("DB error:", err);
      return res.status(500).json({ error: "Database error" });
    }

    res.json({ success: true });
  });
});

// get all read documents by staff
app.get('/get-read-documents', (req, res) => {
    const sql = "SELECT * FROM document_confirmations ORDER BY timestamp DESC";
    db.query(sql, (err, results) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json(results);
    });
  });
  

  

app.listen(8080, () => {
    console.log('server listening on port 8080')
})
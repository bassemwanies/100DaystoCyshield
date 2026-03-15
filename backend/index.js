const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const path = require('path');
const fs = require('fs');
const securePath = path.join(__dirname, '..', 'secure');
const pool = require("./db");

app.use(express.json());

app.use(express.static(securePath));

app.get('/', (req, res) => {
    res.sendFile(path.join(securePath, 'home.html'));
});

app.get('/api/paints', async (req, res) => {
    try {

        const result = await pool.query(
            "SELECT * FROM paints ORDER BY id"
        );

        res.json(result.rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

app.get('/api/search', async (req, res) => {

    const query = req.query.query || "";

    try {

        const result = await pool.query(
            `SELECT * FROM paints
       WHERE LOWER(name) LIKE LOWER($1)
       OR LOWER(painter) LIKE LOWER($1)
       OR LOWER(description) LIKE LOWER($1)`,
            [`%${query}%`]
        );

        res.json(result.rows);

    } catch (err) {

        console.error(err);
        res.status(500).json({ error: "Database error" });

    }
});

function escapeHTML(str) {
    return str.replace(/[&<>"']/g, m => ({
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#39;'
    }[m]));
}

app.post("/api/comments", async (req, res) => {

    const {username, comment } = req.body;

    const safeUsername = escapeHTML(username);
    const safeComment = escapeHTML(comment);

    try {

        await pool.query(
            "INSERT INTO comments (paint_id, username, comment) VALUES (2,$1,$2)",
            [safeUsername, safeComment]
        );

        res.json({ success: true });

    } catch (err) {

        console.error(err);
        res.status(500).json({ error: "Database error" });

    }

});

app.get("/api/comments", async (req, res) => {
    
    try {

        const result = await pool.query(
            "SELECT * FROM comments WHERE paint_id=2 ORDER BY id DESC"
        );

        res.json(result.rows);

    } catch (err) {

        console.error(err);
        res.status(500).json({ error: "Database error" });

    }

});


app.listen(PORT, () => {
    console.log(`Express server running at http://localhost:${PORT}/`);
});
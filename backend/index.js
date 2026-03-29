const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const path = require('path');
require("dotenv").config({
    path: path.join(__dirname, ".env")
});
const fs = require('fs');
const securePath = path.join(__dirname, '..', 'secure');
const pool = require("./db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 5,
    message: { error: "Too many login attempts" }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(securePath));

function authMiddleware(req, res, next) {
    const token = req.cookies?.token;

    if (!token) {
        return res.redirect("/login.html");

    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).send("Invalid token");
    }
}


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
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[m]));
}

app.post("/api/comments", async (req, res) => {

    const { username, comment } = req.body;

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

app.post("/login", loginLimiter, async (req, res) => {
    const { username, password } = req.body;

    try {
        const result = await pool.query(
            "SELECT * FROM users WHERE username = $1",
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).send("Invalid credentials");
        }

        const user = result.rows[0];

        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(401).send("Invalid credentials");
        }

        const token = jwt.sign(
            { id: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        res.cookie("token", token, {
            httpOnly: true,
            secure: false, // true in production HTTPS
            sameSite: "lax",
            maxAge: 60 * 60 * 1000
        });

        res.json({ success: true });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

app.get("/welcome", authMiddleware, (req, res) => {
    res.sendFile(path.join(securePath, "welcome.html"));
});

app.get("/logout", (req, res) => {
    res.clearCookie("token");
    res.redirect("/login.html");
});

app.get("/api/me", authMiddleware, (req, res) => {
    res.json({ username: req.user.username });
});

app.listen(PORT, () => {
    console.log(`Express server running at http://localhost:${PORT}/`);
});
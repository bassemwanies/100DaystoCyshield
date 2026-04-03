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
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function sendVerificationEmail(email, link) {
    await transporter.sendMail({
        from: `"100 Days To Cyshield" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Verify your email",
        html: `
            <h2>Email Verification</h2>
            <p>Click below to verify your account:</p>
            <a href="${link}">${link}</a>
        `
    });
}

const loginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 5,
    message: { error: "Too many login attempts" }
});

const resendLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 3,
    message: { error: "Too many requests, try later" }
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

app.post("/register", async (req, res) => {
    const { username, email, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const rawToken = crypto.randomBytes(32).toString("hex");

        const hashedToken = crypto
            .createHash("sha256")
            .update(rawToken)
            .digest("hex");

        const expires = new Date(Date.now() + 60 * 60 * 1000);

        await pool.query(
            `INSERT INTO users 
            (username, email, password, verification_token, token_expires)
            VALUES ($1, $2, $3, $4, $5)`,
            [username, email, hashedPassword, hashedToken, expires]
        );

        const baseUrl = process.env.BASE_URL;

        const link = `${baseUrl}/verify-email?token=${rawToken}&email=${email}`;

        await sendVerificationEmail(email, link);

        res.status(201).json({
            message: "Registered! Check Email for verification link"
        });

    } catch (err) {
        console.error(err);

        if (err.code === "23505") {
            return res.status(400).json({ error: "Email already exists" });
        }

        res.status(500).json({ error: "Server error" });
    }
});

app.get("/verify-email", async (req, res) => {
    const { token, email } = req.query;

    try {
        const hashedToken = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const result = await pool.query(
            `SELECT * FROM users 
             WHERE email = $1 AND verification_token = $2`,
            [email, hashedToken]
        );

        if (result.rows.length === 0) {
            return res.sendFile(path.join(securePath, "verify-error.html"));
        }

        const user = result.rows[0];

        if (new Date() > user.token_expires) {
            await pool.query(
                `UPDATE users SET verification_token = NULL, token_expires = NULL WHERE email = $1`,
                [email]
            );

            return res.sendFile(path.join(securePath, "verify-error.html"));
        }
        await pool.query(
            `UPDATE users 
             SET is_verified = true, verification_token = NULL 
             WHERE email = $1`,
            [email]
        );

        res.sendFile(path.join(securePath, "verified.html"));

    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
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

        if (!user.is_verified) {
            return res.status(403).json({
                error: "Email not verified",
                email: user.email
            });
        }

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
            secure: true,
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

app.post("/resend-verification", resendLimiter, async (req, res) => {
    const { email } = req.body;

    try {
        const result = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [email]
        );

        if (result.rows.length === 0) {
            return res.json({
                message: "If the email exists, a verification link has been sent"
            });
        }

        const user = result.rows[0];

        if (user.is_verified) {
            return res.json({
                message: "Account already verified"
            });
        }

        const rawToken = crypto.randomBytes(32).toString("hex");

        const hashedToken = crypto
            .createHash("sha256")
            .update(rawToken)
            .digest("hex");

        const expires = new Date(Date.now() + 60 * 60 * 1000);

        await pool.query(
            `UPDATE users 
             SET verification_token = $1, token_expires = $2 
             WHERE email = $3`,
            [hashedToken, expires, email]
        );

        const baseUrl = process.env.BASE_URL;

        const link = `${baseUrl}/verify-email?token=${rawToken}&email=${email}`;

        await sendVerificationEmail(email, link);

        res.json({
            message: "Verification email sent!"
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

app.get("/api/me", authMiddleware, (req, res) => {
    res.json({ username: req.user.username });
});

app.listen(PORT, () => {
    console.log(`Express server running at http://localhost:${PORT}/`);
});
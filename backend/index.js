const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const path = require('path');
const fs = require('fs');
const securePath = path.join(__dirname, '..', 'secure');

app.use(express.json());

app.use(express.static(securePath));

app.get('/', (req, res) => {
    res.sendFile(path.join(securePath, 'home.html'));
});

app.get('/api/paints', (req, res) => {
    const data = fs.readFileSync(path.join(__dirname, '..', 'paints.json'), 'utf8');
    const paints = JSON.parse(data);
    res.json(paints);
});

app.get('/api/search', (req, res) => {
    const query = req.query.query || "";
    const data = fs.readFileSync(path.join(__dirname, '..', 'paints.json'), 'utf8');
    const paints = JSON.parse(data);
    const results = paints.filter(paint =>
        paint.name.toLowerCase().includes(query.toLowerCase()) ||
        paint.painter.toLowerCase().includes(query.toLowerCase()) ||
        paint.description.toLowerCase().includes(query.toLowerCase())

    );
    res.json(results);
});

app.listen(PORT, () => {
    console.log(`Express server running at http://localhost:${PORT}/`);
});


const express = require('express');
const { Client } = require("pg");
const bodyParser = require('body-parser');
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');
const cors = require("cors")

const app = express();
app.use(cors());
app.use(bodyParser.json());

const client = new Client({
    user: "postgres",
    host: "localhost",
    database: "level data",
    password: "postgres",
    port: 5432,

});

client.connect()
    .then(() => console.log('Connected to PostgreSQL'))
    .catch(err => console.error('Connection error', err.stack));


app.post('/leveling_data', async (req, res) => {
    const { pointId, backSight, intermediateSight, foreSight, distance, comments } = req.body;
    console.log("Received data:", req.body)
    if (!Number.isInteger(pointId)) {
        console.error('Invalid pointId:', pointId);
        return res.status(400).json({ error: 'Invalid pointId' });
    }
    try {
        const result = await client.query(
            'INSERT INTO leveling_data (point_id, back_sight, intermediate_sight, fore_sight, distance, comments) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [pointId, backSight, intermediateSight, foreSight, distance, comments]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error saving data', err);
        res.status(500).json({ error: 'Error saving data' });
    }
});

app.get('/download_csv', async (req, res) => {
    try {
        const result = await client.query('SELECT * FROM leveling_data');
        const fields = ['point_id', 'back_sight', 'intermediate_sight', 'fore_sight', 'distance', 'comments', 'timestamp'];
        const opts = { fields };
        const parser = new Parser(opts);
        const csv = parser.parse(result.rows);
        const filePath = path.join(__dirname, 'leveling_data.csv');
        fs.writeFileSync(filePath, csv);
        res.download(filePath, 'leveling_data.csv', (err) => {
            if (err) {
                console.error('Error downloading the file:', err);
            }
            fs.unlinkSync(filePath);
        });
    } catch (err) {
        console.error('Error generating CSV', err);
        res.status(500).json({ error: 'Error generating CSV' });
    }
});




app.listen(3000, () => {
    console.log('Server running on port 3000');
});

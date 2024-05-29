

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
    database: "Level_data_store",
    password: "postgres",
    port: 5432,

});

client.connect()
    .then(() => console.log('Connected to PostgreSQL'))
    .catch(err => console.error('Connection error', err.stack));


app.post('/leveling_data', async (req, res) => {
    const { projectTitle, dataEntry } = req.body;

    console.log("Received data:", req.body)

    try {
        // Insert the project title if it doesn't exist
        let result = await client.query('INSERT INTO projects (title) VALUES ($1) ON CONFLICT (title) DO NOTHING RETURNING id', [projectTitle]);
        let projectId;

        if (result.rowCount > 0) {
            projectId = result.rows[0].id;
        } else {
            result = await client.query('SELECT id FROM projects WHERE title = $1', [projectTitle]);
            projectId = result.rows[0].id;
        }

        // Insert the data entries
        for (const entry of dataEntry) {
            await client.query('INSERT INTO data_entries (project_id, point_id, back_sight, intermediate_sight, fore_sight, distance, comments,reduced_level) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [projectId, entry.pointId, entry.backSight, entry.intermediateSight, entry.foreSight, entry.distance, entry.comments, entry.reducedLevel]);
        }
        res.status(201).send('Data saved successfully');
    } catch (err) {
        console.error('Error saving data', err);
        res.status(500).json({ error: 'Error saving data' });
    }
});

app.post('/download_csv', async (req, res) => {
    const { projectTitle } = req.body;

    try {
        // Retrieve the project ID
        const projectResult = await client.query('SELECT id FROM projects WHERE title = $1', [projectTitle]);
        if (projectResult.rowCount === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }
        const projectId = projectResult.rows[0].id;

        // Retrieve the data entries for the CSV generation
        const entriesResult = await client.query('SELECT point_id, back_sight, intermediate_sight, fore_sight, distance, comments, reduced_level FROM data_entries WHERE project_id = $1', [projectId]);

        // Generate the CSV
        const fields = ['point_id', 'back_sight', 'intermediate_sight', 'fore_sight', 'reduced_level', 'distance', 'comments'];
        const opts = { fields };
        const parser = new Parser(opts);
        let csv = parser.parse(entriesResult.rows);
        csv = `${projectTitle}\n\n${csv}`;

        // Send the CSV file as a response
        res.header('Content-Type', 'text/csv');
        res.attachment(`${projectTitle}.csv`);
        res.send(csv);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error generating CSV');
    }



});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});

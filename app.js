

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
        //variables for calcilations
        let previousRL = null;
        let currentHI = null;
        //Insert the data entries
        for (const entry of dataEntry) {

            let reducedLevel = null;
            let height_of_instrument = null;
            if (entry.pointId === 1) {
                // Calculate HI at the first point using back sight
                currentHI = entry.reducedLevel + entry.backSight;
                reducedLevel = entry.reducedLevel;
            } else {
                // Calculate RL and HI for subsequent points
                if (entry.backSight !== null) {
                    // Change point, recalculate HI
                    reducedLevel = currentHI - entry.foreSight;
                    currentHI = reducedLevel + entry.backSight;
                } else if (entry.intermediateSight !== null) {
                    reducedLevel = currentHI - entry.intermediateSight;
                } else if (entry.foreSight !== null) {
                    reducedLevel = currentHI - entry.foreSight;
                }
            }

            height_of_instrument = currentHI;
            previousRL = reducedLevel;


            const existingEntry = await client.query('SELECT * FROM data_entries WHERE project_id = $1 AND point_id = $2', [projectId, entry.pointId]);
            if (existingEntry.rowCount > 0) {
                // Update the existing entry
                await client.query('UPDATE data_entries SET back_sight = $3, intermediate_sight = $4, fore_sight = $5, distance = $6, comments = $7, reduced_level = $8 ,height_of_instrument=$9WHERE project_id = $1 AND point_id = $2',
                    [projectId, entry.pointId, entry.backSight, entry.intermediateSight, entry.foreSight, entry.distance, entry.comments, reducedLevel, height_of_instrument]);
            } else {
                // Insert a new entry
                await client.query('INSERT INTO data_entries (project_id, point_id, back_sight, intermediate_sight, fore_sight, distance, comments, reduced_level,height_of_instrument) VALUES ($1, $2, $3, $4, $5, $6, $7, $8,$9)',
                    [projectId, entry.pointId, entry.backSight, entry.intermediateSight, entry.foreSight, entry.distance, entry.comments, reducedLevel, height_of_instrument]);
            }

        }

        res.status(201).send('Data saved successfully');
    }

    catch (err) {
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
        const entriesResult = await client.query('SELECT point_id, back_sight, intermediate_sight, fore_sight, distance, comments, reduced_level, height_of_instrument FROM data_entries WHERE project_id = $1', [projectId]);
        //checks 
        let backSightTotal = 0;
        let foreSightTotal = 0;
        let firstRL = 0;
        let lastRL = 0;

        entriesResult.rows.forEach((entry, index) => {
            if (index === 0) {
                firstRL = entry.reduced_level;
            }
            if (index === entriesResult.rowCount - 1) {
                lastRL = entry.reduced_level;
            }
            if (entry.back_sight !== null) backSightTotal += entry.back_sight;
            if (entry.fore_sight !== null) foreSightTotal += entry.fore_sight;
        });

        const bsFsDiff = backSightTotal - foreSightTotal;
        const reducedLevelDifference = lastRL - firstRL;
        const checkPassed = bsFsDiff === reducedLevelDifference;

        // Generate the CSV
        const fields = ['point_id', 'back_sight', 'intermediate_sight', 'fore_sight', 'height_of_instrument', 'reduced_level', 'distance', 'comments'];
        const opts = { fields };
        const parser = new Parser(opts);
        let csv = parser.parse(entriesResult.rows);
        // Append the check result to the CSV
        csv += `\n\nCheck Result\n`;
        csv += `Sum of back sights: ${backSightTotal}\n`;
        csv += `Sum of fore sights: ${foreSightTotal}\n`;
        csv += `Sum of back sights minus sum of fore sights: ${bsFsDiff}\n`;
        csv += `Difference in reduced levels (last - first): ${reducedLevelDifference}\n`;
        csv += `Check passed: ${checkPassed}\n`;

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

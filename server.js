const express = require('express');
const { MongoClient } = require('mongodb');
const xml2js = require('xml2js');
const path = require('path');

const app = express();
const PORT = 3000;

const client = new MongoClient('mongodb://127.0.0.1:27017');

let students; // collection handle, set once the DB is connected

// 1. Serve the front end (index.html, sample.xml, student.xsd) from /public
app.use(express.static(path.join(__dirname, 'public')));

// 2. Read request bodies with Content-Type: application/xml as plain text
app.use(express.text({ type: 'application/xml' }));

// 3. POST /api/students : XML in -> MongoDB
app.post('/api/students', (req, res) => {

    // If the Content-Type was not application/xml, req.body will not be a string
    if (typeof req.body !== 'string' || req.body.trim() === '') {
        return res.status(400).json({
            error: 'Empty body or Content-Type is not application/xml'
        });
    }

    xml2js.parseString(
        req.body,
        { explicitArray: false },
        async (err, result) => {

            // Malformed XML, or the wrong root element
            if (err || !result || !result.student) {
                return res.status(400).json({
                    error: 'Malformed XML or missing <student> root element'
                });
            }

            const s = result.student;

            // Map the XML tree to a clean JS object (document schema)
            const doc = {
                roll: parseInt(s.roll, 10),
                name: typeof s.name === 'string' ? s.name.trim() : '',
                dept: typeof s.dept === 'string' ? s.dept.trim() : '',
                sem: parseInt(s.sem, 10),
                createdAt: new Date()
            };

            // Validate against the design (Part 3.2)
            if (
                isNaN(doc.roll) ||
                isNaN(doc.sem) ||
                !doc.name ||
                !doc.dept
            ) {
                return res.status(400).json({
                    error: 'Missing or invalid fields (roll and sem must be numbers)'
                });
            }

            try {
                const r = await students.insertOne(doc);

                res.status(201).json({
                    message: 'Created',
                    insertedId: r.insertedId
                });

            } catch (e) {
                console.error(e);

                res.status(500).json({
                    error: 'Database error'
                });
            }
        }
    );
});

// 4. GET /api/students : MongoDB -> JSON out
app.get('/api/students', async (req, res) => {

    try {
        const docs = await students.find({}).toArray();

        res.json(docs); // sent as JSON automatically

    } catch (e) {
        console.error(e);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

// 5. Connect to MongoDB first, then start listening
async function start() {

    await client.connect();

    students = client
        .db('collegeDB')
        .collection('students');

    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
}

start().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Internal utility to read data
const readData = () => {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            const initialData = { faculty: [], rooms: [], schedules: [] };
            fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
            return initialData;
        }
        const rawData = fs.readFileSync(DATA_FILE);
        return JSON.parse(rawData);
    } catch (err) {
        console.error("Error reading data:", err);
        return { faculty: [], rooms: [], schedules: [] };
    }
};

// Internal utility to write data
const writeData = (data) => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Error writing data:", err);
    }
};

// GET all faculty
app.get('/faculty', (req, res) => {
    const data = readData();
    res.json(data.faculty || []);
});

// POST add faculty
app.post('/faculty', (req, res) => {
    const data = readData();
    const newFaculty = { id: Date.now().toString(), name: req.body.name, department: req.body.department };
    if(!data.faculty) data.faculty = [];
    data.faculty.push(newFaculty);
    writeData(data);
    res.json({ message: "Faculty added", faculty: newFaculty });
});

// GET all rooms
app.get('/rooms', (req, res) => {
    const data = readData();
    res.json(data.rooms || []);
});

// POST add room
app.post('/rooms', (req, res) => {
    const data = readData();
    const newRoom = { id: Date.now().toString(), number: req.body.number, capacity: req.body.capacity || 0 };
    if(!data.rooms) data.rooms = [];
    data.rooms.push(newRoom);
    writeData(data);
    res.json({ message: "Room added", room: newRoom });
});

// GET timetable (schedules)
app.get('/timetable', (req, res) => {
    const data = readData();
    res.json(data.schedules || []);
});

// POST schedule (handled directly or potentially passing to scheduler logic)
app.post('/schedule', (req, res) => {
    try {
        const data = readData();
        const { subject, faculty, department, semester, section, room, day, timeSlot } = req.body;
        
        // Let scheduler.js logic validate and add (basic implementation here, detailed in utils)
        const id = Date.now().toString();
        const newSchedule = {
            id, subject, faculty, department, semester, section, room, day, timeSlot
        };
        
        if (!data.schedules) data.schedules = [];
        data.schedules.push(newSchedule);
        writeData(data);
        
        res.status(201).json({ message: "Schedule added successfully", schedule: newSchedule });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE schedule
app.delete('/schedule/:id', (req, res) => {
    const data = readData();
    if(data.schedules) {
        data.schedules = data.schedules.filter(s => s.id !== req.params.id);
        writeData(data);
    }
    res.json({ message: "Schedule deleted" });
});

const { detectConflict, bubbleSortSchedules } = require('./utils/scheduler');
const { findAlternativeSlot } = require('./utils/aiLayer');

// Endpoint to just check conflicts before officially saving, or to run the conflict resolver
app.post('/check-conflict', (req, res) => {
    try {
        const data = readData();
        const newSchedule = req.body;
        
        let conflictCheck = detectConflict(newSchedule, data.schedules || []);
        
        if (conflictCheck.hasConflict) {
            // Run the smart conflict resolver
            const resolverResult = findAlternativeSlot(newSchedule, data.schedules || [], data.rooms || []);
            res.json({
                conflict: true,
                reasons: conflictCheck.reasons,
                suggestion: resolverResult.found ? resolverResult.suggestion : null,
                suggestionReason: resolverResult.reason
            });
        } else {
            res.json({ conflict: false, message: "No conflict detected. Safe to schedule." });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update GET /timetable to return sorted schedules
app.get('/timetable', (req, res) => {
    const data = readData();
    const sortedSchedules = bubbleSortSchedules(data.schedules || []);
    res.json(sortedSchedules);
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

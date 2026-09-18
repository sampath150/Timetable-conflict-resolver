const API_URL = 'http://localhost:3000';

let currentSchedules = [];
let currentFaculty = [];
let currentRooms = [];

let aiSuggestion = null;

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupNavigation();
    loadDashboardData();
    setupForms();
    setupExportHandlers();
});

// Theme Management
const initTheme = () => {
    const themeSwitch = document.getElementById('checkbox');
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.body.className = savedTheme;
        themeSwitch.checked = savedTheme === 'dark-mode';
    }
    
    themeSwitch.addEventListener('change', function() {
        if (this.checked) {
            document.body.className = 'dark-mode';
            localStorage.setItem('theme', 'dark-mode');
        } else {
            document.body.className = 'light-mode';
            localStorage.setItem('theme', 'light-mode');
        }
    });
};

// Navigation
const setupNavigation = () => {
    const navLinks = document.querySelectorAll('.nav-links li');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            const page = link.getAttribute('data-page');
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            switchPage(page);
        });
    });
};

window.switchPage = (pageId) => {
    document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active-page'));
    document.getElementById(pageId).classList.add('active-page');
    
    // Update nav link active state programmatically if called from buttons
    document.querySelectorAll('.nav-links li').forEach(l => {
        if (l.getAttribute('data-page') === pageId) l.classList.add('active');
        else l.classList.remove('active');
    });

    if (pageId === 'matrix') {
        renderTimetableMatrix();
    } else if (pageId === 'scheduler') {
        populateSelectDropdowns();
    }
};

// Toast Notifications
const showToast = (message, type = 'success') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '<i class="fa-solid fa-check-circle"></i>' : '<i class="fa-solid fa-circle-exclamation"></i>';
    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3000);
};

// Data Fetching
const fetchAPI = async (endpoint, options = {}) => {
    try {
        const res = await fetch(`${API_URL}${endpoint}`, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });
        return await res.json();
    } catch (err) {
        console.error('API Error:', err);
        showToast('System Error. Please check backend server.', 'error');
        throw err;
    }
};

const loadDashboardData = async () => {
    currentFaculty = await fetchAPI('/faculty');
    currentRooms = await fetchAPI('/rooms');
    currentSchedules = await fetchAPI('/timetable');

    // Update stats
    document.getElementById('stat-subjects').innerText = [...new Set(currentSchedules.map(s => s.subject))].length;
    document.getElementById('stat-faculty').innerText = currentFaculty.length;
    document.getElementById('stat-classes').innerText = currentSchedules.length;
    // (In a real app, resolved conflicts count might be tracked in backend. We'll use random or 0 placeholder)
    
    renderFacultyList();
    renderRoomList();
};

const populateSelectDropdowns = () => {
    const facSelect = document.getElementById('faculty-select');
    const roomSelect = document.getElementById('room-select');
    
    facSelect.innerHTML = '<option value="">Select Faculty...</option>';
    currentFaculty.forEach(f => {
        facSelect.innerHTML += `<option value="${f.name}">${f.name}</option>`;
    });

    roomSelect.innerHTML = '<option value="">Select Room...</option>';
    currentRooms.forEach(r => {
        roomSelect.innerHTML += `<option value="${r.number}">Room ${r.number}</option>`;
    });
};

// Forms
const setupForms = () => {
    // Schedule Form
    document.getElementById('schedule-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            subject: document.getElementById('subject-name').value,
            department: document.getElementById('department').value,
            semester: document.getElementById('semester').value,
            section: document.getElementById('section').value,
            faculty: document.getElementById('faculty-select').value,
            room: document.getElementById('room-select').value,
            day: document.getElementById('day').value,
            timeSlot: document.getElementById('time-slot').value
        };

        // Check for conflicts
        const check = await fetchAPI('/check-conflict', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (check.conflict) {
            showConflictModal(check, payload);
        } else {
            await finalizeScheduling(payload);
        }
    });

    // Faculty Form
    document.getElementById('add-faculty-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            name: document.getElementById('faculty-name-input').value,
            department: document.getElementById('faculty-dept-input').value
        };
        await fetchAPI('/faculty', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Faculty added successfully');
        e.target.reset();
        await loadDashboardData();
    });

    // Room Form
    document.getElementById('add-room-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            number: document.getElementById('room-number-input').value,
            capacity: document.getElementById('room-cap-input').value
        };
        await fetchAPI('/rooms', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Room added successfully');
        e.target.reset();
        await loadDashboardData();
    });

    // Modal Events
    document.querySelector('.close-btn').addEventListener('click', closeConflictModal);
    document.getElementById('btn-cancel').addEventListener('click', closeConflictModal);
    
    document.getElementById('btn-apply-suggestion').addEventListener('click', async () => {
        if(aiSuggestion && window.pendingSchedule) {
            window.pendingSchedule.day = aiSuggestion.day;
            window.pendingSchedule.timeSlot = aiSuggestion.timeSlot;
            window.pendingSchedule.room = aiSuggestion.room;
            await finalizeScheduling(window.pendingSchedule);
            closeConflictModal();
            let confStat = parseInt(document.getElementById('stat-conflicts').innerText);
            document.getElementById('stat-conflicts').innerText = confStat + 1;
        }
    });

    // Matrix Filters
    document.getElementById('filter-dept').addEventListener('change', renderTimetableMatrix);
    document.getElementById('filter-sem').addEventListener('change', renderTimetableMatrix);
};

const showConflictModal = (conflictData, payload) => {
    window.pendingSchedule = payload;
    const modal = document.getElementById('conflict-modal');
    const reasonsList = document.getElementById('conflict-reasons');
    const suggestionBox = document.getElementById('smart-suggestion');
    const applyBtn = document.getElementById('btn-apply-suggestion');

    reasonsList.innerHTML = '';
    conflictData.reasons.forEach(r => {
        reasonsList.innerHTML += `<li>${r}</li>`;
    });

    if (conflictData.suggestion) {
        aiSuggestion = conflictData.suggestion;
        suggestionBox.style.display = 'block';
        suggestionBox.innerHTML = `
            <h4><i class="fa-solid fa-lightbulb"></i> Smart Alternative Found</h4>
            <p>${conflictData.suggestionReason}</p>
        `;
        applyBtn.style.display = 'inline-block';
    } else {
        aiSuggestion = null;
        suggestionBox.style.display = 'block';
        suggestionBox.innerHTML = `
            <h4 class="text-red"><i class="fa-solid fa-xmark"></i> No Alternative Found</h4>
            <p>${conflictData.suggestionReason}</p>
        `;
        applyBtn.style.display = 'none';
    }

    modal.style.display = 'flex';
};

const closeConflictModal = () => {
    document.getElementById('conflict-modal').style.display = 'none';
    window.pendingSchedule = null;
    aiSuggestion = null;
};

const finalizeScheduling = async (payload) => {
    await fetchAPI('/schedule', { method: 'POST', body: JSON.stringify(payload) });
    showToast('Class scheduled successfully!');
    document.getElementById('schedule-form').reset();
    await loadDashboardData(); // Refresh local data 
};

// Render Functions
const renderFacultyList = () => {
    const list = document.getElementById('faculty-list');
    list.innerHTML = '';
    currentFaculty.forEach(f => {
        list.innerHTML += `<li><span><i class="fa-solid fa-user text-secondary"></i> <strong>${f.name}</strong> (${f.department})</span></li>`;
    });
};

const renderRoomList = () => {
    const list = document.getElementById('room-list');
    list.innerHTML = '';
    currentRooms.forEach(r => {
        list.innerHTML += `<li><span><i class="fa-solid fa-door-open text-secondary"></i> <strong>Room ${r.number}</strong> (Cap: ${r.capacity})</span></li>`;
    });
};

const renderTimetableMatrix = () => {
    const tbody = document.querySelector('#timetable-matrix tbody');
    tbody.innerHTML = '';
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const timeSlots = [
        '09:00 AM - 10:00 AM',
        '10:00 AM - 11:00 AM',
        '11:00 AM - 12:00 PM',
        '01:00 PM - 02:00 PM',
        '02:00 PM - 03:00 PM',
        '03:00 PM - 04:00 PM'
    ];

    const filterDept = document.getElementById('filter-dept').value;
    const filterSem = document.getElementById('filter-sem').value;

    let filteredSchedules = currentSchedules;
    if(filterDept !== 'all') filteredSchedules = filteredSchedules.filter(s => s.department === filterDept);
    if(filterSem !== 'all') filteredSchedules = filteredSchedules.filter(s => s.semester === filterSem);

    days.forEach(day => {
        const tr = document.createElement('tr');
        const dayTd = document.createElement('td');
        dayTd.className = 'day-col';
        dayTd.innerText = day;
        tr.appendChild(dayTd);

        timeSlots.forEach(slot => {
            const td = document.createElement('td');
            td.className = 'slot-cell';
            const classesInSlot = filteredSchedules.filter(s => s.day === day && s.timeSlot === slot);
            
            classesInSlot.forEach((cls, idx) => {
                const colorClass = `subject-color-${idx % 5}`;
                const card = document.createElement('div');
                card.className = `class-card ${colorClass}`;
                card.innerHTML = `
                    <i class="fa-solid fa-trash delete-class" onclick="deleteSchedule('${cls.id}')" title="Delete"></i>
                    <strong>${cls.subject}</strong>
                    <div style="font-size: 11px; opacity: 0.8;">
                        <i class="fa-solid fa-user"></i> ${cls.faculty} <br>
                        <i class="fa-solid fa-door-open"></i> Room ${cls.room} <br>
                        ${cls.department}-${cls.semester} (Sec ${cls.section})
                    </div>
                `;
                td.appendChild(card);
            });
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
};

window.deleteSchedule = async (id) => {
    if(confirm("Are you sure you want to delete this class?")) {
        await fetchAPI(`/schedule/${id}`, { method: 'DELETE' });
        showToast('Schedule removed', 'success');
        await loadDashboardData();
        renderTimetableMatrix();
    }
};

// Exports
const setupExportHandlers = () => {
    document.getElementById('btn-print').addEventListener('click', () => {
        window.print();
    });

    document.getElementById('btn-export-pdf').addEventListener('click', () => {
        const element = document.getElementById('timetable-matrix');
        const opt = {
            margin:       0.5,
            filename:     'Timetable-Master.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'in', format: 'a4', orientation: 'landscape' }
        };
        html2pdf().set(opt).from(element).save();
    });
};

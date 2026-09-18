// Queue Implementation for handling timetable requests (FIFO)
class ScheduleQueue {
    constructor() {
        this.items = [];
    }
    enqueue(element) {
        this.items.push(element);
    }
    dequeue() {
        if(this.isEmpty()) return "Underflow";
        return this.items.shift();
    }
    isEmpty() {
        return this.items.length === 0;
    }
}

// Bubble Sort implementation to sort schedules by time slot
// This ensures that when we generate a matrix or view, it's chronologically ordered
const bubbleSortSchedules = (schedules) => {
    let n = schedules.length;
    let swapped;
    
    // Time slot mapping for sorting (example slots: "09:00 AM", "10:00 AM", etc.)
    const parseTime = (timeStr) => {
        // basic parser: "09:00 AM - 10:00 AM" -> gives a numeric value for comparison
        if (!timeStr) return 0;
        const base = parseInt(timeStr.split(':')[0]);
        const isPM = timeStr.includes('PM') && base !== 12;
        return base + (isPM ? 12 : 0);
    };

    do {
        swapped = false;
        for (let i = 0; i < n - 1; i++) {
            let timeA = parseTime(schedules[i].timeSlot);
            let timeB = parseTime(schedules[i + 1].timeSlot);
            
            if (timeA > timeB) {
                let temp = schedules[i];
                schedules[i] = schedules[i + 1];
                schedules[i + 1] = temp;
                swapped = true;
            }
        }
        n--;
    } while (swapped);
    return schedules;
};

// Constraints Checking Logic
const detectConflict = (newSchedule, allSchedules) => {
    let conflicts = [];

    // Matrix (2D approach conceptually applied via filtering)
    // We check specific cells (day x timeSlot) for overlapping values

    for (let i = 0; i < allSchedules.length; i++) {
        const existing = allSchedules[i];

        if (existing.day === newSchedule.day && existing.timeSlot === newSchedule.timeSlot) {
            
            // Rule 1: Room Conflict - Same room cannot have two classes simultaneously
            if (existing.room === newSchedule.room) {
                conflicts.push(`Room ${existing.room} is already booked for ${existing.subject} at this time.`);
            }

            // Rule 2: Faculty Conflict - Same faculty cannot teach two classes simultaneously
            if (existing.faculty === newSchedule.faculty) {
                conflicts.push(`Faculty ${existing.faculty} is already scheduled for ${existing.subject} at this time.`);
            }

            // Rule 3: Section/Class Conflict - The same section shouldn't have two completely different subjects at the same time
            if (existing.department === newSchedule.department && 
                existing.semester === newSchedule.semester && 
                existing.section === newSchedule.section) {
                conflicts.push(`Section ${existing.section} of ${existing.department} already has a class (${existing.subject}) at this time.`);
            }
        }
    }

    return {
        hasConflict: conflicts.length > 0,
        reasons: conflicts
    };
};

module.exports = {
    ScheduleQueue,
    bubbleSortSchedules,
    detectConflict
};

const { detectConflict } = require('./scheduler');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_SLOTS = [
    '09:00 AM - 10:00 AM',
    '10:00 AM - 11:00 AM',
    '11:00 AM - 12:00 PM',
    '01:00 PM - 02:00 PM',
    '02:00 PM - 03:00 PM',
    '03:00 PM - 04:00 PM'
];

/**
 * Smart Conflict Resolver
 * Uses a Matrix (2D Array tracking days x timeslots) representation to find the nearest empty valid slot 
 */
const findAlternativeSlot = (newSchedule, allSchedules, availableRooms) => {
    
    // We create a conceptual matrix representation
    for (const currentDay of DAYS) {
        for (const currentSlot of TIME_SLOTS) {
            
            // Create a test schedule 
            const testSchedule = { ...newSchedule, day: currentDay, timeSlot: currentSlot };
            
            // Does this combo have a conflict as is?
            let conflictCheck = detectConflict(testSchedule, allSchedules);
            
            if (!conflictCheck.hasConflict) {
                return {
                    found: true,
                    suggestion: {
                        day: currentDay,
                        timeSlot: currentSlot,
                        room: newSchedule.room
                    },
                    reason: `Suggested alternative: ${currentDay} at ${currentSlot}. No faculty or room conflicts detected.`
                };
            }

            // If the conflict was ONLY a room conflict, let's try available rooms
            if (conflictCheck.reasons.some(r => r.includes('Room')) && !conflictCheck.reasons.some(r => r.includes('Faculty') || r.includes('Section'))) {
                for (const potentialRoom of availableRooms) {
                    if (potentialRoom.number !== newSchedule.room) {
                        const roomTestSchedule = { ...testSchedule, room: potentialRoom.number };
                        let roomConflictCheck = detectConflict(roomTestSchedule, allSchedules);
                        if (!roomConflictCheck.hasConflict) {
                            return {
                                found: true,
                                suggestion: {
                                    day: currentDay,
                                    timeSlot: currentSlot,
                                    room: potentialRoom.number
                                },
                                reason: `Suggested changing room to ${potentialRoom.number} on ${currentDay} at ${currentSlot} to resolve conflict.`
                            };
                        }
                    }
                }
            }
        }
    }

    return {
        found: false,
        suggestion: null,
        reason: "No available alternative slots could be found for this faculty and class."
    };
};

module.exports = {
    findAlternativeSlot,
    DAYS,
    TIME_SLOTS
};

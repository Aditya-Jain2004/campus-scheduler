// CampusScheduler — Core Application Module
import { MOCK_COURSES, MOCK_FACULTY, ACADEMIC_CALENDAR } from './sis_mock.js';

// Default pre-populated rooms to show initial state immediately
const DEFAULT_ROOMS = [
  // Computer Science Block
  { id: "RM001", name: "CS-LH101", building: "Computer Science Block", capacity: 120, type: "Lecture Hall", avEquipment: ["Projector", "Microphone", "AC", "Whiteboard"] },
  { id: "RM002", name: "CS-LH102", building: "Computer Science Block", capacity: 100, type: "Lecture Hall", avEquipment: ["Projector", "AC", "Whiteboard"] },
  { id: "RM003", name: "CS-LAB101", building: "Computer Science Block", capacity: 80, type: "Lab", avEquipment: ["Projector", "AC", "Computers", "Whiteboard"] },

  // Mechanical Block
  { id: "RM005", name: "ME-LH101", building: "Mechanical Block", capacity: 150, type: "Lecture Hall", avEquipment: ["Projector", "Microphone", "AC", "Whiteboard"] },
  { id: "RM006", name: "ME-LH102", building: "Mechanical Block", capacity: 100, type: "Lecture Hall", avEquipment: ["Projector", "Whiteboard"] },
  { id: "RM007", name: "ME-LAB101", building: "Mechanical Block", capacity: 100, type: "Lab", avEquipment: ["Heavy Machines", "Tools", "Whiteboard"] },

  // Basic Sciences Block
  { id: "RM009", name: "BS-LH101", building: "Basic Sciences Block", capacity: 150, type: "Lecture Hall", avEquipment: ["Projector", "Microphone", "AC", "Whiteboard"] },
  { id: "RM010", name: "BS-LH102", building: "Basic Sciences Block", capacity: 100, type: "Lecture Hall", avEquipment: ["Projector", "Whiteboard"] },
  { id: "RM011", name: "BS-LAB101", building: "Basic Sciences Block", capacity: 60, type: "Lab", avEquipment: ["Projector", "AC", "Whiteboard"] },

  // Electronics Block
  { id: "RM013", name: "EC-LH101", building: "Electronics Block", capacity: 120, type: "Lecture Hall", avEquipment: ["Projector", "Microphone", "AC", "Whiteboard"] },
  { id: "RM014", name: "EC-LH102", building: "Electronics Block", capacity: 100, type: "Lecture Hall", avEquipment: ["Projector", "Whiteboard"] },
  { id: "RM015", name: "EC-LAB101", building: "Electronics Block", capacity: 80, type: "Lab", avEquipment: ["AC", "Oscilloscopes", "Power Supplies", "Whiteboard"] },

  // Humanities Block
  { id: "RM017", name: "HU-LH101", building: "Humanities Block", capacity: 150, type: "Lecture Hall", avEquipment: ["Projector", "Microphone", "AC", "Whiteboard"] },
  { id: "RM018", name: "HU-LH102", building: "Humanities Block", capacity: 120, type: "Lecture Hall", avEquipment: ["Projector", "Whiteboard"] },
  { id: "RM019", name: "HU-LAB101", building: "Humanities Block", capacity: 40, type: "Lab", avEquipment: ["Projector", "Whiteboard"] },

  // Main Building (Shared)
  { id: "RM021", name: "MAIN-AUD", building: "Main Building", capacity: 200, type: "Lecture Hall", avEquipment: ["Projector", "Microphone", "Sound System", "AC"] }
];

// Application State
const state = {
  rooms: [],
  bookings: {},       // Format: { roomName: { day: { slot: courseCode } } }
  restrictions: [],   // Format: [ { roomId, roomName, day, slot, reason } ]
  unscheduledCourses: [],
  activeRoom: "",
  activePanel: "timetable-panel",
  published: false,
  language: "en",
  currentUser: "Registrar Staff",
  
  // Faculty reschedule requests workflow parameters
  currentRole: "registrar", // "registrar" or a facultyId (e.g. FAC001)
  rescheduleRequests: [],
  oneOffOverrides: [],
  activeDate: ""            // Date string selected in grid (e.g. "2026-08-17")
};

// State Recovery & Persistence System (Anti-outage)
const CURRENT_DB_VERSION = "v5_lab_optimization_and_prepopulation";

function saveStateToLocalStorage() {
  localStorage.setItem("campus_scheduler_state", JSON.stringify({
    dbVersion: CURRENT_DB_VERSION,
    rooms: state.rooms,
    bookings: state.bookings,
    restrictions: state.restrictions,
    unscheduledCourses: state.unscheduledCourses,
    activeRoom: state.activeRoom,
    published: state.published,
    language: state.language,
    
    currentRole: state.currentRole,
    rescheduleRequests: state.rescheduleRequests,
    oneOffOverrides: state.oneOffOverrides,
    activeDate: state.activeDate
  }));
}

function loadStateFromLocalStorage() {
  const saved = localStorage.getItem("campus_scheduler_state");
  if (saved) {
    try {
      const data = JSON.parse(saved);
      // Force database reset if version mismatches to clear old cached rooms/schedules
      if (data.dbVersion !== CURRENT_DB_VERSION) {
        console.log("DB version mismatch, forcing re-initialization of demo timetable...");
        initializeDefaultState();
        saveStateToLocalStorage();
        return;
      }

      state.rooms = data.rooms || [];
      // Clean up old default rooms and migrate to the new ones
      const oldRoomNames = [
        "LHC-101", "LHC-102", "SEM-301", "LAB-101", "ECE-LAB", "CR-104", "CS-LH103", "CS-SEM303", "MAIN-SEM",
        "CS-LH101", "CS-LH102", "CS-LAB101", "CS-LAB102", "ME-LH101", "ME-LH102", "ME-LAB101", "ME-LAB102", 
        "BS-LH101", "BS-LH102", "BS-LAB101", "BS-LAB102", "EC-LH101", "EC-LH102", "EC-LAB101", "EC-LAB102", 
        "HU-LH101", "HU-LH102", "HU-LAB101", "HU-LAB102", "MAIN-AUD"
      ];
      state.rooms = state.rooms.filter(r => !oldRoomNames.includes(r.name));
      DEFAULT_ROOMS.forEach(defRoom => {
        if (!state.rooms.some(r => r.name === defRoom.name)) {
          state.rooms.push(defRoom);
        }
      });
      state.bookings = data.bookings || {};
      
      // Clean up stale bookings referencing deleted rooms
      const activeRoomNames = new Set(state.rooms.map(r => r.name));
      for (const rName in state.bookings) {
        if (!activeRoomNames.has(rName)) {
          delete state.bookings[rName];
        }
      }

      state.restrictions = data.restrictions || [];
      state.unscheduledCourses = data.unscheduledCourses || [];

      // Sync active state courses with MOCK_COURSES
      const allocatedCourseCodes = new Set();
      for (const rName in state.bookings) {
        for (const day in state.bookings[rName]) {
          for (const slot in state.bookings[rName][day]) {
            allocatedCourseCodes.add(state.bookings[rName][day][slot]);
          }
        }
      }
      const currentUnscheduledCodes = new Set(state.unscheduledCourses.map(c => c.code));
      MOCK_COURSES.forEach(course => {
        if (!allocatedCourseCodes.has(course.code) && !currentUnscheduledCodes.has(course.code)) {
          state.unscheduledCourses.push(course);
        }
      });
      const mockCourseCodes = new Set(MOCK_COURSES.map(c => c.code));
      state.unscheduledCourses = state.unscheduledCourses.filter(c => mockCourseCodes.has(c.code));

      state.activeRoom = data.activeRoom || "";
      if (state.activeRoom && !activeRoomNames.has(state.activeRoom)) {
        state.activeRoom = state.rooms[0]?.name || "";
      }
      state.published = data.published || false;
      state.language = data.language || "en";
      
      state.currentRole = data.currentRole || "registrar";
      state.rescheduleRequests = data.rescheduleRequests || [];
      state.oneOffOverrides = data.oneOffOverrides || [];
      state.activeDate = data.activeDate || "";
    } catch (e) {
      console.error("Failed to parse local storage state. Re-initializing...", e);
      initializeDefaultState();
    }
  } else {
    initializeDefaultState();
  }
}

function initializeDefaultState() {
  state.rooms = [...DEFAULT_ROOMS];
  
  state.restrictions = [
    { roomId: "RM003", roomName: "CS-LAB101", day: "Wednesday", slot: "08:00 - 09:00", reason: "AC Maintenance / एसी रखरखाव" }
  ];

  state.published = false;
  state.language = "en";
  state.currentRole = "registrar";
  state.rescheduleRequests = [
    { 
      id: "REQ001", 
      courseCode: "CS-201", 
      facultyId: "FAC001", 
      oldRoom: "CS-LH101", 
      oldDay: "Monday", 
      oldSlot: "09:00 - 10:00", 
      newRoom: "MAIN-AUD", 
      newDay: "Tuesday", 
      newSlot: "10:00 - 11:00", 
      type: "semester", 
      date: "", 
      reason: "PhD review meeting clashing with DSA slot.", 
      status: "pending" 
    }
  ];
  state.oneOffOverrides = [];
  state.activeDate = "";

  // Headless generation of realistic timetable bookings
  generateDefaultBookings();

  state.activeRoom = state.rooms[0]?.name || "";
}

function generateDefaultBookings() {
  state.bookings = {};
  state.unscheduledCourses = [...MOCK_COURSES];
  
  let coursesToSchedule = [...MOCK_COURSES];
  // Sort courses by section size descending (largest classes scheduled first)
  coursesToSchedule.sort((a, b) => b.sectionSize - a.sectionSize);

  coursesToSchedule.forEach((course, courseIndex) => {
    const isLabCourse = course.code.toUpperCase().includes("LAB") || course.name.toLowerCase().includes("lab");
    
    // Find candidate rooms matching capacity, building, and type constraints
    let candidateRooms = state.rooms.filter(room => {
      if (room.capacity < course.sectionSize) return false;

      if (isLabCourse) {
        if (room.type !== "Lab") return false;
      } else {
        if (room.type === "Lab") return false;
      }

      if (room.building === "Main Building") {
        return true;
      }

      const targetBlock = getRespectiveBlock(course.department);
      if (targetBlock) {
        return room.building === targetBlock;
      }

      return true;
    });

    // Minimize wasted capacity
    candidateRooms.sort((a, b) => {
      return (a.capacity - course.sectionSize) - (b.capacity - course.sectionSize);
    });

    let scheduled = false;

    for (let rIndex = 0; rIndex < candidateRooms.length && !scheduled; rIndex++) {
      const roomName = candidateRooms[rIndex].name;

      // Distribute classes evenly across days and slots using indexing offsets
      const dayOffset = courseIndex % ACADEMIC_CALENDAR.workingDays.length;
      const slotOffset = Math.floor(courseIndex / ACADEMIC_CALENDAR.workingDays.length) % ACADEMIC_CALENDAR.timeSlots.length;

      for (let d = 0; d < ACADEMIC_CALENDAR.workingDays.length && !scheduled; d++) {
        const dIndex = (dayOffset + d) % ACADEMIC_CALENDAR.workingDays.length;
        const day = ACADEMIC_CALENDAR.workingDays[dIndex];

        for (let s = 0; s < ACADEMIC_CALENDAR.timeSlots.length && !scheduled; s++) {
          const sIndex = (slotOffset + s) % ACADEMIC_CALENDAR.timeSlots.length;
          const slot = ACADEMIC_CALENDAR.timeSlots[sIndex];

          // Check maintenance restrictions
          const isUnavailable = state.restrictions.some(res => 
            res.roomName === roomName && res.day === day && res.slot === slot
          );
          if (isUnavailable) continue;

          // Check double booking
          if (state.bookings[roomName]?.[day]?.[slot]) continue;

          // Check faculty double teaching
          let facultyBusy = false;
          for (const rName in state.bookings) {
            const bookedCode = state.bookings[rName]?.[day]?.[slot];
            if (bookedCode) {
              const bookedCourse = MOCK_COURSES.find(c => c.code === bookedCode);
              if (bookedCourse && bookedCourse.facultyId === course.facultyId) {
                facultyBusy = true;
                break;
              }
            }
          }
          if (facultyBusy) continue;

          // Book slot
          if (!state.bookings[roomName]) {
            state.bookings[roomName] = {};
          }
          if (!state.bookings[roomName][day]) {
            state.bookings[roomName][day] = {};
          }
          state.bookings[roomName][day][slot] = course.code;
          
          scheduled = true;
        }
      }
    }
  });

  // Keep failed ones in unscheduled list
  const allocatedCourseCodes = new Set();
  for (const rName in state.bookings) {
    for (const day in state.bookings[rName]) {
      for (const slot in state.bookings[rName][day]) {
        allocatedCourseCodes.add(state.bookings[rName][day][slot]);
      }
    }
  }
  state.unscheduledCourses = MOCK_COURSES.filter(c => !allocatedCourseCodes.has(c.code));
}

// Global UI Translation Engine
function translateUI() {
  const elements = document.querySelectorAll(".translate");
  elements.forEach(el => {
    const text = state.language === "hi" ? el.getAttribute("data-hi") : el.getAttribute("data-en");
    if (text) {
      if (el.tagName === "INPUT" && el.hasAttribute("placeholder")) {
        el.setAttribute("placeholder", text);
      } else {
        el.textContent = text;
      }
    }
  });

  // Toggle button active states
  document.getElementById("lang-en").classList.toggle("active", state.language === "en");
  document.getElementById("lang-hi").classList.toggle("active", state.language === "hi");
}

// Logging Utility (Disabled)
function logAction(action, details, type = "booking") {
  // Audit logging is disabled.
}

// Toast Alert System
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  toast.innerHTML = `
    <div class="toast-message">${message}</div>
    <button class="toast-close">&times;</button>
  `;
  
  container.appendChild(toast);
  
  toast.querySelector(".toast-close").addEventListener("click", () => {
    toast.remove();
  });
  
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ----------------------------------------------------
// UI RENDERERS
// ----------------------------------------------------

// 1. Sidebar Unscheduled Courses List
function renderSidebarCourses() {
  const container = document.getElementById("unscheduled-courses");
  container.innerHTML = "";

  if (state.unscheduledCourses.length === 0) {
    container.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #64748b; font-size: 0.85rem;" class="translate"
           data-en="All courses scheduled! 🎉" data-hi="सभी पाठ्यक्रम निर्धारित! 🎉">
        ${state.language === "hi" ? "सभी पाठ्यक्रम निर्धारित! 🎉" : "All courses scheduled! 🎉"}
      </div>
    `;
    return;
  }

  state.unscheduledCourses.forEach(course => {
    const faculty = MOCK_FACULTY.find(f => f.id === course.facultyId);
    const card = document.createElement("div");
    card.className = "course-card";
    
    // Disable dragging if timetable is published or current user is faculty
    if (!state.published && state.currentRole === "registrar") {
      card.setAttribute("draggable", "true");
    } else {
      card.removeAttribute("draggable");
      card.style.cursor = "not-allowed";
    }

    card.innerHTML = `
      <div class="course-card-header">
        <span class="course-code">${course.code}</span>
        <span class="course-dept">${course.department}</span>
      </div>
      <div class="course-name">${course.name}</div>
      <div class="course-details">
        <span class="course-faculty">👤 ${faculty ? faculty.name : "Unknown"}</span>
        <span class="course-size">👥 ${course.sectionSize}</span>
      </div>
    `;

    // Drag-and-drop event registration
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", course.code);
      card.classList.add("dragging");
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
    });

    container.appendChild(card);
  });
}

// 2. Select Option Dropdowns for Room Builder
function populateRoomSelectors() {
  const roomSelect = document.getElementById("select-active-room");
  const currentVal = roomSelect.value || state.activeRoom;
  
  roomSelect.innerHTML = "";
  
  // Collect all active buildings for filtering
  const buildings = new Set();
  
  state.rooms.forEach(room => {
    buildings.add(room.building);
    const opt = document.createElement("option");
    opt.value = room.name;
    opt.textContent = `${room.name} (${room.building})`;
    roomSelect.appendChild(opt);
  });

  if (currentVal && state.rooms.some(r => r.name === currentVal)) {
    roomSelect.value = currentVal;
    state.activeRoom = currentVal;
  } else if (state.rooms.length > 0) {
    roomSelect.value = state.rooms[0].name;
    state.activeRoom = state.rooms[0].name;
  }

  // Populate Building Filters
  const filterBuilding = document.getElementById("select-filter-building");
  const matrixBuilding = document.getElementById("matrix-building-select");
  
  const currentFilterVal = filterBuilding.value;
  const currentMatrixVal = matrixBuilding.value;

  filterBuilding.innerHTML = `<option value="all">${state.language === "hi" ? "सभी भवन" : "All Buildings"}</option>`;
  matrixBuilding.innerHTML = `<option value="all">${state.language === "hi" ? "सभी भवन" : "All Buildings"}</option>`;

  buildings.forEach(b => {
    const opt1 = document.createElement("option");
    opt1.value = b;
    opt1.textContent = b;
    filterBuilding.appendChild(opt1);

    const opt2 = document.createElement("option");
    opt2.value = b;
    opt2.textContent = b;
    matrixBuilding.appendChild(opt2);
  });

  filterBuilding.value = currentFilterVal || "all";
  matrixBuilding.value = currentMatrixVal || "all";

  renderActiveRoomStats();
}

function renderActiveRoomStats() {
  const statsContainer = document.getElementById("active-room-stats");
  if (!statsContainer) return;

  const isFacultyView = state.currentRole !== "registrar";
  if (isFacultyView) {
    const facultyId = state.currentRole;
    const facultyObj = MOCK_FACULTY.find(f => f.id === facultyId);
    if (facultyObj) {
      let deptName = facultyObj.department;
      if (state.language === "hi") {
        const deptDict = {
          "Computer Science": "कंप्यूटर विज्ञान",
          "Electronics & Comm.": "इलेक्ट्रॉनिक्स और संचार",
          "Mechanical Eng.": "यांत्रिक अभियांत्रिकी",
          "Basic Sciences": "बुनियादी विज्ञान",
          "Humanities & Social Sciences": "मानविकी और सामाजिक विज्ञान"
        };
        deptName = deptDict[deptName] || deptName;
      }
      statsContainer.innerHTML = `
        <span style="font-weight: 600; color: #6366f1;">👨‍🏫 ${facultyObj.name}</span>
        <span>|</span>
        <span>${deptName}</span>
      `;
    } else {
      statsContainer.innerHTML = "";
    }
    return;
  }

  const room = state.rooms.find(r => r.name === state.activeRoom);
  
  if (!room) {
    statsContainer.innerHTML = "";
    return;
  }

  statsContainer.innerHTML = `
    <span><strong>Cap:</strong> ${room.capacity}</span>
    <span>|</span>
    <span><strong>Type:</strong> ${room.type}</span>
  `;
}

// Helper to map department to its dedicated building block
function getRespectiveBlock(department) {
  switch (department) {
    case "Computer Science":
      return "Computer Science Block";
    case "Electronics & Comm.":
      return "Electronics Block";
    case "Mechanical Eng.":
      return "Mechanical Block";
    case "Basic Sciences":
      return "Basic Sciences Block";
    case "Humanities & Social Sciences":
      return "Humanities Block";
    default:
      return null;
  }
}

// ----------------------------------------------------
// CONFLICT DETECTION ENGINE (F2 CORE REQUIREMENT)
// ----------------------------------------------------
function checkSchedulingConflict(courseCode, roomName, day, slot) {
  const course = MOCK_COURSES.find(c => c.code === courseCode);
  const room = state.rooms.find(r => r.name === roomName);
  
  if (!course || !room) {
    return { type: "error", message: "Invalid course or room identifier." };
  }

  // Check Department Block and Lab Restrictions (F4 Course/Room Alignment Requirement)
  const isLabCourse = course.code.toUpperCase().includes("LAB") || course.name.toLowerCase().includes("lab");

  if (isLabCourse) {
    if (room.type !== "Lab") {
      return {
        type: "block",
        message: state.language === "hi"
          ? "प्रयोगशाला पाठ्यक्रमों को प्रयोगशाला कक्ष में निर्धारित किया जाना चाहिए।"
          : "Lab courses must be scheduled in a laboratory room."
      };
    }
  } else {
    if (room.type === "Lab") {
      return {
        type: "block",
        message: state.language === "hi"
          ? "व्याख्यान पाठ्यक्रमों को प्रयोगशाला कक्षों में निर्धारित नहीं किया जा सकता।"
          : "Lecture courses cannot be scheduled in laboratory rooms."
      };
    }
  }

  // Enforce Building Block constraints
  const targetBlock = getRespectiveBlock(course.department);
  if (room.building !== "Main Building" && targetBlock && room.building !== targetBlock) {
    return {
      type: "block",
      message: state.language === "hi"
        ? `इस विभाग के पाठ्यक्रमों को केवल ${targetBlock} या Main Building में ही निर्धारित किया जा सकता है।`
        : `Courses for this department must be scheduled in the ${targetBlock} or Main Building.`
    };
  }

  // 1. Check Holiday Conflict
  // Convert current year mock dates to day of week check, or match exact holidays if date selected.
  // For the MVP, we grey out the holidays inside the academic calendar when matching date, 
  // and we block drag-and-drop scheduling on specific calendar days or general slots.
  // Let's check if the Day contains a holiday in this semester dates.
  
  // 2. Check Room Unavailability Restrictions
  const isUnavailable = state.restrictions.some(res => 
    res.roomName === roomName && res.day === day && res.slot === slot
  );
  if (isUnavailable) {
    const res = state.restrictions.find(r => r.roomName === roomName && r.day === day && r.slot === slot);
    return { 
      type: "block", 
      message: state.language === "hi" 
        ? `कक्ष अनुपलब्ध है: ${res.reason || "रखरखाव"}` 
        : `Room is marked unavailable: ${res.reason || "Maintenance"}` 
    };
  }

  // 3. Check Room Double-Booking
  if (state.bookings[roomName] && state.bookings[roomName][day] && state.bookings[roomName][day][slot]) {
    const bookedCourseCode = state.bookings[roomName][day][slot];
    return { 
      type: "block", 
      message: state.language === "hi" 
        ? `डबल-बुकिंग! कक्ष ${roomName} में पहले से ही ${bookedCourseCode} स्लॉट में है।` 
        : `Double-booking! Room ${roomName} is already allocated to ${bookedCourseCode} in this slot.` 
    };
  }

  // 4. Check Faculty Double-Booking (University wide)
  for (const rName in state.bookings) {
    if (state.bookings[rName][day] && state.bookings[rName][day][slot]) {
      const bookedCode = state.bookings[rName][day][slot];
      const bookedCourse = MOCK_COURSES.find(c => c.code === bookedCode);
      if (bookedCourse && bookedCourse.facultyId === course.facultyId) {
        const faculty = MOCK_FACULTY.find(f => f.id === course.facultyId);
        return {
          type: "block",
          message: state.language === "hi"
            ? `संकाय संघर्ष! ${faculty.name} इस समय कक्ष ${rName} में ${bookedCode} पढ़ा रहे हैं।`
            : `Faculty clash! ${faculty.name} is already teaching ${bookedCode} in Room ${rName} at this time.`
        };
      }
    }
  }
  // 5. Check Capacity warning (Soft block)
  if (room.capacity < course.sectionSize) {
    return {
      type: "warning",
      message: state.language === "hi"
        ? `कम क्षमता! कक्ष की क्षमता ${room.capacity} है, लेकिन पाठ्यक्रम का आकार ${course.sectionSize} है।`
        : `Low capacity! Room capacity is ${room.capacity}, but course enrollment is ${course.sectionSize}.`
    };
  }

  return { type: "ok" };
}

// 3. Timetable Grid Builder (F2 GRID UI)
function renderTimetableGrid() {
  const gridContainer = document.getElementById("timetable-grid");
  gridContainer.innerHTML = "";

  const isFacultyView = state.currentRole !== "registrar";

  if (!isFacultyView && !state.activeRoom) {
    gridContainer.innerHTML = `
      <div style="grid-column: span 11; padding: 40px; text-align: center; color: var(--text-secondary);" class="translate"
           data-en="No rooms available. Please create or import rooms in Room Master."
           data-hi="कोई कक्ष उपलब्ध नहीं है। कृपया कक्ष प्रबंधन में कक्ष बनाएं या आयात करें।">
        No rooms available. Please create or import rooms in Room Master.
      </div>
    `;
    return;
  }

  // Row header Cell (0,0)
  const originCell = document.createElement("div");
  originCell.className = "grid-header-cell";
  originCell.innerHTML = state.language === "hi" ? "दिन \\ समय" : "Day \\ Time";
  gridContainer.appendChild(originCell);

  // Time Slot Headers
  ACADEMIC_CALENDAR.timeSlots.forEach(slot => {
    const headerCell = document.createElement("div");
    headerCell.className = "grid-header-cell";
    headerCell.textContent = slot;
    gridContainer.appendChild(headerCell);
  });

  // If faculty view, pre-calculate faculty bookings across all rooms
  let facultyBookings = {};
  if (isFacultyView) {
    const facultyId = state.currentRole;
    const facultyCourses = MOCK_COURSES.filter(c => c.facultyId === facultyId);
    const facultyCourseCodes = new Set(facultyCourses.map(c => c.code));

    ACADEMIC_CALENDAR.workingDays.forEach(day => {
      facultyBookings[day] = {};
    });

    // Populate regular bookings
    for (const rName in state.bookings) {
      for (const day in state.bookings[rName]) {
        for (const slot in state.bookings[rName][day]) {
          const bookedCode = state.bookings[rName][day][slot];
          if (facultyCourseCodes.has(bookedCode)) {
            facultyBookings[day][slot] = {
              courseCode: bookedCode,
              roomName: rName,
              isOneOffOverride: false
            };
          }
        }
      }
    }

    // Apply one-off overrides if activeDate is selected
    if (state.activeDate) {
      state.oneOffOverrides.forEach(o => {
        if (o.date === state.activeDate) {
          // If this override schedules a faculty course to this slot
          if (facultyCourseCodes.has(o.courseCode)) {
            facultyBookings[o.day][o.slot] = {
              courseCode: o.courseCode,
              roomName: o.roomName,
              isOneOffOverride: true,
              reason: o.reason
            };
          }
          // If the override moved a course away from this slot
          if (facultyCourseCodes.has(o.courseCode)) {
            if (facultyBookings[o.oldDay]?.[o.slotFrom]?.courseCode === o.courseCode) {
              delete facultyBookings[o.oldDay][o.slotFrom];
            }
          }
        }
      });
    }
  }

  // Week Days rows
  ACADEMIC_CALENDAR.workingDays.forEach(day => {
    // 1. Day label header cell
    const dayHeader = document.createElement("div");
    dayHeader.className = "grid-row-header";
    dayHeader.innerHTML = `
      <div>${day}</div>
      <div style="font-size: 0.75rem; font-weight: normal; color: var(--text-secondary);">
        ${state.language === "hi" ? translateDayName(day) : ""}
      </div>
    `;
    gridContainer.appendChild(dayHeader);

    // 2. 10 time slot cells for this day
    ACADEMIC_CALENDAR.timeSlots.forEach(slot => {
      const cell = document.createElement("div");
      cell.className = "grid-cell";
      cell.setAttribute("data-day", day);
      cell.setAttribute("data-slot", slot);

      if (isFacultyView) {
        // Faculty View Rendering
        const booking = facultyBookings[day]?.[slot];
        if (booking) {
          const course = MOCK_COURSES.find(c => c.code === booking.courseCode);
          if (course) {
            const card = document.createElement("div");
            
            let cardClasses = `scheduled-card`;
            if (booking.isOneOffOverride) cardClasses += ' one-off-override';
            card.className = cardClasses;
            
            card.innerHTML = `
              <div class="scheduled-card-title">
                <span>${course.code} ${booking.isOneOffOverride ? '<span style="font-size: 0.65rem; color:#8b5cf6; font-weight:bold;">(1-Off)</span>' : ''}</span>
              </div>
              <div class="scheduled-card-faculty" style="color: #6366f1; font-weight: 600;">📍 ${booking.roomName}</div>
              <div class="scheduled-card-footer">
                <span>👥 ${course.sectionSize}</span>
              </div>
            `;
            cell.appendChild(card);
          }
        }
      } else {
        // Registrar / Room View Rendering
        const isUnavailable = state.restrictions.some(res => 
          res.roomName === state.activeRoom && res.day === day && res.slot === slot
        );

        if (isUnavailable) {
          cell.classList.add("unavailable-room");
          const restriction = state.restrictions.find(res => 
            res.roomName === state.activeRoom && res.day === day && res.slot === slot
          );
          cell.setAttribute("title", restriction.reason || "Unavailable");
        }

        // Fill in scheduled course card if it exists (check activeDate overrides)
        let bookedCourseCode = state.bookings[state.activeRoom]?.[day]?.[slot];
        let isOneOffOverride = false;
        let overrideReason = "";

        if (state.activeDate) {
          // 1. Check if there is an override course scheduled TO this cell on this date
          const matchTo = state.oneOffOverrides.find(o => 
            o.date === state.activeDate && o.roomName === state.activeRoom && o.day === day && o.slot === slot
          );
          if (matchTo) {
            bookedCourseCode = matchTo.courseCode;
            isOneOffOverride = true;
            overrideReason = matchTo.reason;
          } else {
            // 2. Check if the regular booking in this cell has been moved AWAY on this date
            const matchFrom = state.oneOffOverrides.find(o => 
              o.date === state.activeDate && o.oldRoom === state.activeRoom && o.oldDay === day && o.slotFrom === slot
            );
            if (matchFrom) {
              bookedCourseCode = null; // Clear booking since it was moved away
            }
          }
        }

        if (bookedCourseCode) {
          const course = MOCK_COURSES.find(c => c.code === bookedCourseCode);
          if (course) {
            const faculty = MOCK_FACULTY.find(f => f.id === course.facultyId);
            const card = document.createElement("div");
            
            // Soft capacity Warning indicator
            const activeRoomObj = state.rooms.find(r => r.name === state.activeRoom);
            const isCapacityClash = activeRoomObj ? (activeRoomObj.capacity < course.sectionSize) : false;
            
            let cardClasses = `scheduled-card`;
            if (isCapacityClash) cardClasses += ' capacity-warning';
            if (isOneOffOverride) cardClasses += ' one-off-override';
            card.className = cardClasses;
            
            const showRemoveBtn = !state.published && state.currentRole === "registrar";
            card.innerHTML = `
              <div class="scheduled-card-title">
                <span>${course.code} ${isOneOffOverride ? '<span style="font-size: 0.65rem; color:#8b5cf6; font-weight:bold;">(1-Off)</span>' : ''}</span>
                ${showRemoveBtn ? `<button class="btn-remove-slot" title="Remove course">&times;</button>` : ''}
              </div>
              <div class="scheduled-card-faculty">${faculty ? faculty.name : "Staff"}</div>
              <div class="scheduled-card-footer">
                <span>👥 ${course.sectionSize}</span>
                ${(state.currentRole === "registrar" && isCapacityClash) ? `<span class="warning-badge" title="Room capacity is too small!">⚠️ Cap</span>` : ''}
              </div>
            `;

            // Handle unscheduling (including one-off overrides)
            if (showRemoveBtn) {
              const removeBtn = card.querySelector(".btn-remove-slot");
              if (removeBtn) {
                removeBtn.addEventListener("click", (e) => {
                  e.stopPropagation();
                  if (isOneOffOverride) {
                    state.oneOffOverrides = state.oneOffOverrides.filter(o => 
                      !(o.date === state.activeDate && o.roomName === state.activeRoom && o.day === day && o.slot === slot)
                    );
                    showToast("Date-specific override removed.", "info");
                    logAction("UNSCHEDULE OVERRIDE", `Removed single class override for ${bookedCourseCode} on ${state.activeDate}.`);
                    saveStateToLocalStorage();
                    renderTimetableGrid();
                    renderSidebarCourses();
                  } else {
                    unscheduleCourse(state.activeRoom, day, slot, bookedCourseCode);
                  }
                });
              }
            }

            cell.appendChild(card);
          }
        }

        // Drag and drop event listeners for target grid cells (only if not published, role is registrar, and cell is free/available)
        if (!state.published && state.currentRole === "registrar" && !isUnavailable) {
          cell.addEventListener("dragover", (e) => {
            e.preventDefault();
            cell.classList.add("drag-over");
          });

          cell.addEventListener("dragleave", () => {
            cell.classList.remove("drag-over");
          });

          cell.addEventListener("drop", (e) => {
            e.preventDefault();
            cell.classList.remove("drag-over");
            
            const courseCode = e.dataTransfer.getData("text/plain");
            if (courseCode) {
              handleCourseDrop(courseCode, state.activeRoom, day, slot);
            }
          });
        }
      }

      gridContainer.appendChild(cell);
    });
  });
}

function translateDayName(day) {
  const dict = {
    "Monday": "सोमवार",
    "Tuesday": "मंगलवार",
    "Wednesday": "बुधवार",
    "Thursday": "गुरुवार",
    "Friday": "शुक्रवार",
    "Saturday": "शनिवार"
  };
  return dict[day] || day;
}

// Handle drop logic
function handleCourseDrop(courseCode, roomName, day, slot) {
  const check = checkSchedulingConflict(courseCode, roomName, day, slot);

  if (check.type === "block") {
    showToast(check.message, "danger");
    logAction("BLOCKED DROP", `Clash for ${courseCode} in Room ${roomName} on ${day} at ${slot}: ${check.message}`, "error");
    return;
  }

  if (check.type === "warning") {
    // Show soft warning capacity warning but allow drop
    showToast(check.message, "warning");
    logAction("OVERRIDE", `Scheduled ${courseCode} in Room ${roomName} (${day} ${slot}) despite capacity warning: ${check.message}`, "warning");
  } else {
    showToast(state.language === "hi" ? "पाठ्यक्रम सफलतापूर्वक निर्धारित किया गया!" : "Course scheduled successfully!", "success");
    logAction("SCHEDULE", `Assigned ${courseCode} to Room ${roomName} on ${day} ${slot}.`);
  }

  // Update State
  if (!state.bookings[roomName]) {
    state.bookings[roomName] = {};
  }
  if (!state.bookings[roomName][day]) {
    state.bookings[roomName][day] = {};
  }
  state.bookings[roomName][day][slot] = courseCode;

  // Remove from unscheduled
  state.unscheduledCourses = state.unscheduledCourses.filter(c => c.code !== courseCode);

  saveStateToLocalStorage();
  renderTimetableGrid();
  renderSidebarCourses();
}

function unscheduleCourse(roomName, day, slot, courseCode) {
  if (state.bookings[roomName]?.[day]?.[slot]) {
    delete state.bookings[roomName][day][slot];
    
    // Add back to unscheduled list if it's a valid mock course
    const course = MOCK_COURSES.find(c => c.code === courseCode);
    if (course && !state.unscheduledCourses.some(c => c.code === courseCode)) {
      state.unscheduledCourses.push(course);
    }
    
    showToast(state.language === "hi" ? "पाठ्यक्रम समय-सारणी से हटा दिया गया।" : "Course removed from timetable.", "info");
    logAction("UNSCHEDULE", `Removed ${courseCode} from Room ${roomName} on ${day} ${slot}.`);
    
    saveStateToLocalStorage();
    renderTimetableGrid();
    renderSidebarCourses();
  }
}

// 4. Room Availability Matrix (F3 READ-ONLY WEEK VIEW)
function renderAvailabilityMatrix() {
  const selectedDay = document.getElementById("matrix-day-select").value;
  const capFilter = parseInt(document.getElementById("matrix-capacity-filter").value) || 0;
  const buildingFilter = document.getElementById("matrix-building-select").value;

  const headerRow = document.getElementById("matrix-table-header");
  headerRow.innerHTML = `<th class="translate" data-en="Room \\ Time Slot" data-hi="कक्ष \\ समय स्लॉट">Room \\ Time Slot</th>`;
  ACADEMIC_CALENDAR.timeSlots.forEach(slot => {
    const th = document.createElement("th");
    th.textContent = slot;
    headerRow.appendChild(th);
  });

  const body = document.getElementById("matrix-table-body");
  body.innerHTML = "";

  // Filter Rooms
  const filteredRooms = state.rooms.filter(room => {
    if (room.capacity < capFilter) return false;
    if (buildingFilter !== "all" && room.building !== buildingFilter) return false;
    return true;
  });

  if (filteredRooms.length === 0) {
    body.innerHTML = `
      <tr>
        <td colspan="${ACADEMIC_CALENDAR.timeSlots.length + 1}" style="padding: 30px; text-align: center; color: var(--text-secondary);" class="translate"
            data-en="No rooms match the filter criteria." data-hi="कोई भी कक्ष फ़िल्टर मानदंडों से मेल नहीं खाता है।">
          No rooms match the filter criteria.
        </td>
      </tr>
    `;
    return;
  }

  filteredRooms.forEach(room => {
    const tr = document.createElement("tr");
    
    // Room details column
    const roomTd = document.createElement("td");
    roomTd.innerHTML = `
      <div style="font-weight: 700; color: var(--text-primary);">${room.name}</div>
      <div style="font-size: 0.7rem; color: var(--text-secondary);">${room.building} (Cap: ${room.capacity})</div>
    `;
    tr.appendChild(roomTd);

    // Each time slot column
    ACADEMIC_CALENDAR.timeSlots.forEach(slot => {
      const td = document.createElement("td");
      
      // Check unavailable
      const isUnavailable = state.restrictions.some(res => 
        res.roomName === room.name && res.day === selectedDay && res.slot === slot
      );
      
      const bookedCourseCode = state.bookings[room.name]?.[selectedDay]?.[slot];

      if (isUnavailable) {
        const res = state.restrictions.find(r => r.roomName === room.name && r.day === selectedDay && r.slot === slot);
        td.innerHTML = `<span class="matrix-status-unavailable" title="${res.reason || 'Unavailable'}">${state.language === "hi" ? "अनुपलब्ध" : "Unavailable"}</span>`;
      } else if (bookedCourseCode) {
        const course = MOCK_COURSES.find(c => c.code === bookedCourseCode);
        const faculty = MOCK_FACULTY.find(f => f.id === course?.facultyId);
        td.innerHTML = `
          <div class="matrix-status-booked" title="${course ? course.name : ''}">
            <strong>${bookedCourseCode}</strong>
            <div style="font-size: 0.65rem; opacity: 0.85;">${faculty ? faculty.name.split(' ').pop() : ''}</div>
          </div>
        `;
        // Detail tooltip or click action
        td.addEventListener("click", () => {
          showToast(`${bookedCourseCode}: ${course ? course.name : ''} taught by ${faculty ? faculty.name : 'Unknown'}. Room: ${room.name}`, "info");
        });
      } else {
        td.innerHTML = `<span class="matrix-status-free">${state.language === "hi" ? "खाली" : "Free"}</span>`;
      }

      tr.appendChild(td);
    });

    body.appendChild(tr);
  });

  translateUI();
}

// 5. Room Master Table View
function renderRoomsTable() {
  const tbody = document.getElementById("rooms-table-body");
  tbody.innerHTML = "";

  if (state.rooms.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 30px;" class="translate"
            data-en="No rooms registered yet." data-hi="अभी तक कोई कक्ष पंजीकृत नहीं है।">
          No rooms registered yet.
        </td>
      </tr>
    `;
    return;
  }

  state.rooms.forEach(room => {
    const tr = document.createElement("tr");

    // Equipment badges
    const avBadges = (room.avEquipment || [])
      .map(equip => `<span class="av-capsule">${equip}</span>`)
      .join("");

    const typeTagClass = room.type === "Lecture Hall" ? "tag-lecture-hall" : (room.type === "Seminar Room" ? "tag-seminar-room" : "tag-lab");
    
    // Room row representation
    tr.innerHTML = `
      <td><strong>${room.name}</strong></td>
      <td>${room.building}</td>
      <td>${room.capacity}</td>
      <td><span class="room-type-tag ${typeTagClass}">${room.type}</span></td>
      <td><div class="av-capsule-list">${avBadges}</div></td>
      <td>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-edit" style="padding: 4px 8px; font-size: 0.75rem;" ${state.published ? 'disabled' : ''}>✏️</button>
          <button class="btn btn-secondary btn-restrict" style="padding: 4px 8px; font-size: 0.75rem;" ${state.published ? 'disabled' : ''}>⚠️</button>
          <button class="btn btn-danger btn-delete" style="padding: 4px 8px; font-size: 0.75rem;" ${state.published ? 'disabled' : ''}>🗑️</button>
        </div>
      </td>
    `;

    // Event hooks
    if (!state.published) {
      tr.querySelector(".btn-edit").addEventListener("click", () => populateRoomForm(room));
      tr.querySelector(".btn-restrict").addEventListener("click", () => openUnavailabilityModal(room));
      tr.querySelector(".btn-delete").addEventListener("click", () => deleteRoom(room.id, room.name));
    }

    tbody.appendChild(tr);
  });

  translateUI();
}

function populateRoomForm(room) {
  document.getElementById("room-form-title").setAttribute("data-en", "Edit Room");
  document.getElementById("room-form-title").setAttribute("data-hi", "कक्ष संपादित करें");
  document.getElementById("room-form-edit-id").value = room.id;
  document.getElementById("room-name").value = room.name;
  document.getElementById("room-building").value = room.building;
  document.getElementById("room-capacity").value = room.capacity;
  document.getElementById("room-type").value = room.type;

  // Reset & Populate Checkboxes
  const checkboxes = document.querySelectorAll("input[name='av-equip']");
  checkboxes.forEach(cb => {
    cb.checked = room.avEquipment.includes(cb.value);
  });

  document.getElementById("btn-cancel-room-form").style.display = "inline-flex";
  translateUI();
}

function resetRoomForm() {
  document.getElementById("room-form-title").setAttribute("data-en", "Create New Room");
  document.getElementById("room-form-title").setAttribute("data-hi", "नया कक्ष बनाएँ");
  document.getElementById("room-form-edit-id").value = "";
  document.getElementById("room-form").reset();
  document.getElementById("btn-cancel-room-form").style.display = "none";
  translateUI();
}

function deleteRoom(roomId, roomName) {
  if (confirm(state.language === "hi" 
      ? `क्या आप कक्ष ${roomName} को हटाना चाहते हैं? इसके सभी स्लॉट भी हट जाएंगे।` 
      : `Are you sure you want to delete Room ${roomName}? All scheduled bookings in this room will be unscheduled.`)) {
    
    // 1. Remove all bookings in this room and return courses to unscheduled
    if (state.bookings[roomName]) {
      for (const day in state.bookings[roomName]) {
        for (const slot in state.bookings[roomName][day]) {
          const courseCode = state.bookings[roomName][day][slot];
          const course = MOCK_COURSES.find(c => c.code === courseCode);
          if (course && !state.unscheduledCourses.some(c => c.code === courseCode)) {
            state.unscheduledCourses.push(course);
          }
        }
      }
      delete state.bookings[roomName];
    }

    // 2. Remove restrictions
    state.restrictions = state.restrictions.filter(r => r.roomName !== roomName);

    // 3. Remove room from list
    state.rooms = state.rooms.filter(r => r.id !== roomId);

    showToast(`Room ${roomName} deleted.`, "info");
    logAction("DELETE ROOM", `Deleted Room ${roomName} and wiped all bookings.`, "danger");

    saveStateToLocalStorage();
    renderRoomsTable();
    populateRoomSelectors();
    renderTimetableGrid();
    renderSidebarCourses();
  }
}

function openUnavailabilityModal(room) {
  document.getElementById("unavailability-room-id").value = room.id;
  document.getElementById("unavailability-room-name-display").value = room.name;
  
  // Populate time slots dropdown in modal
  const slotSelect = document.getElementById("unavailability-slot");
  slotSelect.innerHTML = "";
  ACADEMIC_CALENDAR.timeSlots.forEach(slot => {
    const opt = document.createElement("option");
    opt.value = slot;
    opt.textContent = slot;
    slotSelect.appendChild(opt);
  });

  const dialog = document.getElementById("dialog-room-unavailability");
  dialog.showModal();
}

// Save unavailability restriction
document.getElementById("form-room-unavailability").addEventListener("submit", (e) => {
  e.preventDefault();
  const roomName = document.getElementById("unavailability-room-name-display").value;
  const roomId = document.getElementById("unavailability-room-id").value;
  const day = document.getElementById("unavailability-day").value;
  const slot = document.getElementById("unavailability-slot").value;
  const reason = document.getElementById("unavailability-reason").value || "Maintenance";

  // Check if a course is already scheduled there
  if (state.bookings[roomName]?.[day]?.[slot]) {
    const courseCode = state.bookings[roomName][day][slot];
    // Evict course back to unscheduled
    delete state.bookings[roomName][day][slot];
    const course = MOCK_COURSES.find(c => c.code === courseCode);
    if (course && !state.unscheduledCourses.some(c => c.code === courseCode)) {
      state.unscheduledCourses.push(course);
    }
    showToast(`Evicted ${courseCode} due to room unavailability marker.`, "warning");
    logAction("EVICTION", `Evicted ${courseCode} from ${roomName} (${day} ${slot}) for maintenance scheduling.`, "warning");
  }

  // Check if restriction already exists
  const exists = state.restrictions.some(res => 
    res.roomName === roomName && res.day === day && res.slot === slot
  );

  if (!exists) {
    state.restrictions.push({ roomId, roomName, day, slot, reason });
    showToast(`Room ${roomName} marked unavailable on ${day} ${slot}.`, "info");
    logAction("RESTRICT", `Set Room ${roomName} unavailable on ${day} at ${slot}. Reason: ${reason}`);
    
    saveStateToLocalStorage();
    document.getElementById("dialog-room-unavailability").close();
    renderTimetableGrid();
    renderRoomsTable();
  } else {
    showToast(`Room is already marked unavailable for this slot.`, "warning");
  }
});

// Save / Update Room via Form
document.getElementById("room-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (state.published) return;

  const editId = document.getElementById("room-form-edit-id").value;
  const name = document.getElementById("room-name").value.trim().toUpperCase();
  const building = document.getElementById("room-building").value.trim();
  const capacity = parseInt(document.getElementById("room-capacity").value);
  const type = document.getElementById("room-type").value;
  
  // AV checkboxes
  const checkboxes = document.querySelectorAll("input[name='av-equip']:checked");
  const avEquipment = Array.from(checkboxes).map(cb => cb.value);

  // Check unique name clash for new room
  if (!editId && state.rooms.some(r => r.name.toLowerCase() === name.toLowerCase())) {
    showToast(`Room name ${name} already exists.`, "danger");
    return;
  }

  if (editId) {
    // Edit existing room
    const index = state.rooms.findIndex(r => r.id === editId);
    if (index !== -1) {
      const oldName = state.rooms[index].name;
      // Rename bookings if name changed
      if (oldName !== name) {
        state.bookings[name] = state.bookings[oldName] || {};
        delete state.bookings[oldName];
        
        // Update restrictions
        state.restrictions.forEach(res => {
          if (res.roomName === oldName) res.roomName = name;
        });
      }
      
      state.rooms[index] = { id: editId, name, building, capacity, type, avEquipment };
      showToast(`Room ${name} updated successfully.`, "success");
      logAction("EDIT ROOM", `Modified room details for ${name}.`);
    }
  } else {
    // Add new room
    const newRoom = {
      id: "RM" + Math.floor(Math.random() * 10000).toString().padStart(4, "0"),
      name, building, capacity, type, avEquipment
    };
    state.rooms.push(newRoom);
    showToast(`Room ${name} added successfully.`, "success");
    logAction("ADD ROOM", `Created room space ${name} in ${building}.`);
  }

  saveStateToLocalStorage();
  resetRoomForm();
  renderRoomsTable();
  populateRoomSelectors();
  renderTimetableGrid();
});

// Handle room form cancel
document.getElementById("btn-cancel-room-form").addEventListener("click", () => {
  resetRoomForm();
});

// ----------------------------------------------------
// BULK CSV MIGRATION (F1 BULK EXPORT & IMPORT)
// ----------------------------------------------------

// Download template rooms.csv file
document.getElementById("btn-download-sample-csv").addEventListener("click", () => {
  const csvContent = "data:text/csv;charset=utf-8," 
    + "name,building,capacity,type,av_equipment\r\n"
    + "LHC-301,Lecture Hall Complex,120,Lecture Hall,Projector;Microphone;AC;Whiteboard\r\n"
    + "SEM-102,Science Block,50,Seminar Room,Projector;Whiteboard\r\n"
    + "CS-LAB-3,Computer Science Block,60,Lab,AC;Computers;Whiteboard";
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "sample_rooms_template.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

// CSV parser helper
function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  const result = [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const obj = {};
    const currentline = lines[i].split(",");
    
    // Basic CSV handling (split by comma, replace quotes if any)
    headers.forEach((header, index) => {
      let val = currentline[index] ? currentline[index].trim() : "";
      // Strip outer quotes if present
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      }
      obj[header] = val;
    });
    result.push(obj);
  }
  return result;
}

// Import handler
document.getElementById("btn-trigger-csv-import").addEventListener("click", () => {
  if (state.published) return;
  document.getElementById("csv-file-input").click();
});

document.getElementById("csv-file-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    const text = evt.target.result;
    try {
      const parsedRooms = parseCSV(text);
      let roomsImported = 0;
      let skippedRooms = 0;

      parsedRooms.forEach(p => {
        const name = p.name ? p.name.toUpperCase().trim() : "";
        const building = p.building || "General Block";
        const capacity = parseInt(p.capacity) || 60;
        const type = p.type || "Lecture Hall";
        const avString = p.av_equipment || "";
        const avEquipment = avString ? avString.split(";").map(a => a.trim()) : [];

        if (!name) return;

        // Skip duplicates
        if (state.rooms.some(r => r.name === name)) {
          skippedRooms++;
          return;
        }

        const newRoom = {
          id: "RM" + Math.floor(Math.random() * 10000).toString().padStart(4, "0"),
          name, building, capacity, type, avEquipment
        };
        state.rooms.push(newRoom);
        roomsImported++;
      });

      showToast(`Import completed. Imported ${roomsImported} rooms. Skipped ${skippedRooms} duplicates.`, "success");
      logAction("BULK IMPORT", `Successfully imported ${roomsImported} rooms via CSV migration file. Status: ${roomsImported} added, ${skippedRooms} skipped.`);
      
      saveStateToLocalStorage();
      renderRoomsTable();
      populateRoomSelectors();
      renderTimetableGrid();
    } catch (err) {
      showToast("Failed to parse CSV file. Ensure columns match sample format.", "danger");
      console.error(err);
    }
  };
  reader.readAsText(file);
  e.target.value = ""; // Reset input
});

// ----------------------------------------------------
// PUBLISH & EXPORT (F4 CORE REQUIREMENT)
// ----------------------------------------------------

// Publish Timetable Toggle
function togglePublishedState() {
  state.published = !state.published;
  
  // Show banner alert
  const banner = document.getElementById("published-banner");
  if (banner) banner.style.display = state.published ? "flex" : "none";
  
  // Update action buttons text
  const publishBtn = document.getElementById("btn-publish");
  if (publishBtn) {
    if (state.published) {
      publishBtn.innerHTML = `<span class="translate" data-en="Unpublish Schedule" data-hi="समय-सारणी अप्रकाशित करें">Unpublish Schedule</span>`;
      publishBtn.classList.remove("btn-primary");
      publishBtn.classList.add("btn-secondary");
      showToast("Schedule published! Changes are now locked.", "success");
      logAction("PUBLISH", "Timetable published. Scheduling features locked for all users.");
    } else {
      publishBtn.innerHTML = `<span class="translate" data-en="Publish Timetable" data-hi="समय-सारणी प्रकाशित करें">Publish Timetable</span>`;
      publishBtn.classList.remove("btn-secondary");
      publishBtn.classList.add("btn-primary");
      showToast("Schedule unlocked. Timetable edits enabled.", "info");
      logAction("UNPUBLISH", "Timetable unpublished. Scheduling features unlocked.");
    }
  } else {
    if (state.published) {
      showToast("Schedule published! Changes are now locked.", "success");
      logAction("PUBLISH", "Timetable published. Scheduling features locked for all users.");
    } else {
      showToast("Schedule unlocked. Timetable edits enabled.", "info");
      logAction("UNPUBLISH", "Timetable unpublished. Scheduling features unlocked.");
    }
  }

  // Update publish panel status elements if they exist
  const statusBadge = document.getElementById("publish-status-badge");
  const panelToggleBtn = document.getElementById("btn-panel-toggle-publish");
  if (statusBadge && panelToggleBtn) {
    updatePublishPanelStatus();
  }

  // Update auto-schedule and reset button status
  const autoScheduleBtn = document.getElementById("btn-trigger-auto-schedule");
  if (autoScheduleBtn) {
    autoScheduleBtn.disabled = state.published;
  }
  const resetBtn = document.getElementById("btn-reset-timetable");
  if (resetBtn) {
    resetBtn.disabled = state.published;
  }

  saveStateToLocalStorage();
  
  // Re-render UI to update draggable classes and button blockings
  renderTimetableGrid();
  renderSidebarCourses();
  renderRoomsTable();
  translateUI();
}

const publishBtn = document.getElementById("btn-publish");
if (publishBtn) {
  publishBtn.addEventListener("click", togglePublishedState);
}
document.getElementById("btn-unpublish-banner").addEventListener("click", togglePublishedState);

// Custom printing logic
function triggerCustomPrint() {
  let printSection = document.getElementById("print-section");
  if (!printSection) {
    printSection = document.createElement("div");
    printSection.id = "print-section";
    document.body.appendChild(printSection);
  }

  let html = "";
  const isFacultyView = state.currentRole !== "registrar";

  if (isFacultyView) {
    const facultyId = state.currentRole;
    const faculty = MOCK_FACULTY.find(f => f.id === facultyId);
    const facultyName = faculty ? faculty.name : facultyId;
    const dept = faculty ? faculty.department : "";
    
    let deptName = dept;
    if (state.language === "hi") {
      const deptDict = {
        "Computer Science": "कंप्यूटर विज्ञान",
        "Electronics & Comm.": "इलेक्ट्रॉनिक्स और संचार",
        "Mechanical Eng.": "यांत्रिक अभियांत्रिकी",
        "Basic Sciences": "बुनियादी विज्ञान",
        "Humanities & Social Sciences": "मानविकी और समाज विज्ञान"
      };
      deptName = deptDict[dept] || dept;
    }

    const facultyCourses = MOCK_COURSES.filter(c => c.facultyId === facultyId);
    const facultyCourseCodes = new Set(facultyCourses.map(c => c.code));

    let facultyBookings = {};
    ACADEMIC_CALENDAR.workingDays.forEach(day => {
      facultyBookings[day] = {};
    });

    for (const rName in state.bookings) {
      for (const day in state.bookings[rName]) {
        for (const slot in state.bookings[rName][day]) {
          const bookedCode = state.bookings[rName][day][slot];
          if (facultyCourseCodes.has(bookedCode)) {
            facultyBookings[day][slot] = {
              courseCode: bookedCode,
              roomName: rName,
              isOneOffOverride: false
            };
          }
        }
      }
    }

    if (state.activeDate) {
      state.oneOffOverrides.forEach(o => {
        if (o.date === state.activeDate && facultyCourseCodes.has(o.courseCode)) {
          facultyBookings[o.day][o.slot] = {
            courseCode: o.courseCode,
            roomName: o.roomName,
            isOneOffOverride: true,
            reason: o.reason
          };
          if (facultyBookings[o.oldDay]?.[o.slotFrom]?.courseCode === o.courseCode) {
            delete facultyBookings[o.oldDay][o.slotFrom];
          }
        }
      });
    }

    const titleText = state.language === "hi" ? "संकाय साप्ताहिक समय-सारणी" : "Faculty Weekly Timetable";
    const facultyLabel = state.language === "hi" ? "संकाय:" : "Faculty:";
    const deptLabel = state.language === "hi" ? "विभाग:" : "Department:";
    const dateLabel = state.language === "hi" ? "लक्षित तिथि/अवधि:" : "Target Date/Period:";
    const dateVal = state.activeDate ? state.activeDate : (state.language === "hi" ? "पूर्ण सेमेस्टर" : "Full Semester");

    html += `
      <div class="print-room-page">
        <div class="print-header">
          <h2>${titleText}</h2>
          <div class="print-meta-grid">
            <div><strong>${facultyLabel}</strong> ${facultyName}</div>
            <div><strong>${deptLabel}</strong> ${deptName}</div>
            <div><strong>${dateLabel}</strong> ${dateVal}</div>
            <div><strong>${state.language === "hi" ? "मुद्रण तिथि:" : "Printed On:"}</strong> ${new Date().toLocaleDateString()}</div>
          </div>
        </div>
        <table class="print-table">
          <thead>
            <tr>
              <th>${state.language === "hi" ? "दिन \\ समय" : "Day \\ Time"}</th>
              ${ACADEMIC_CALENDAR.timeSlots.map(slot => `<th>${slot}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${ACADEMIC_CALENDAR.workingDays.map(day => {
              const dayLabel = state.language === "hi" ? translateDayName(day) : day;
              return `
                <tr>
                  <td class="day-header">${dayLabel}</td>
                  ${ACADEMIC_CALENDAR.timeSlots.map(slot => {
                    const booking = facultyBookings[day]?.[slot];
                    if (booking) {
                      const course = MOCK_COURSES.find(c => c.code === booking.courseCode);
                      return `
                        <td>
                          <div class="print-card">
                            <span class="print-card-code">${booking.courseCode}</span>
                            <span class="print-card-name">${course ? course.name : ""}</span>
                            <span class="print-card-details">📍 ${booking.roomName} | 👥 ${course ? course.sectionSize : ""}</span>
                            ${booking.isOneOffOverride ? `<span class="print-card-override">${state.language === "hi" ? "एक-बंद बदलाव" : "1-Off Override"}</span>` : ""}
                          </div>
                        </td>
                      `;
                    }
                    return "<td></td>";
                  }).join("")}
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  } else {
    // Registrar View Print - All Rooms Separated
    const sortedRooms = [...state.rooms].sort((a, b) => {
      if (a.building !== b.building) return a.building.localeCompare(b.building);
      return a.name.localeCompare(b.name);
    });

    sortedRooms.forEach(room => {
      const roomTypeLabel = state.language === "hi" 
        ? (room.type === "Lab" ? "प्रयोगशाला" : (room.type === "Lecture Hall" ? "व्याख्यान कक्ष" : "संगोष्ठी कक्ष"))
        : room.type;

      html += `
        <div class="print-room-page">
          <div class="print-header">
            <h2>${state.language === "hi" ? "विश्वविद्यालय कक्ष समय-सारणी" : "University Room Timetable"}</h2>
            <div class="print-meta-grid">
              <div><strong>${state.language === "hi" ? "कक्ष:" : "Room:"}</strong> ${room.name} (${roomTypeLabel})</div>
              <div><strong>${state.language === "hi" ? "भवन:" : "Building:"}</strong> ${room.building}</div>
              <div><strong>${state.language === "hi" ? "क्षमता:" : "Capacity:"}</strong> ${room.capacity}</div>
              <div><strong>${state.language === "hi" ? "दिनांक/अवधि:" : "Date/Period:"}</strong> ${state.activeDate ? state.activeDate : (state.language === "hi" ? "पूर्ण सेमेस्टर" : "Full Semester")}</div>
            </div>
          </div>
          <table class="print-table">
            <thead>
              <tr>
                <th>${state.language === "hi" ? "दिन \\ समय" : "Day \\ Time"}</th>
                ${ACADEMIC_CALENDAR.timeSlots.map(slot => `<th>${slot}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${ACADEMIC_CALENDAR.workingDays.map(day => {
                const dayLabel = state.language === "hi" ? translateDayName(day) : day;
                return `
                  <tr>
                    <td class="day-header">${dayLabel}</td>
                    ${ACADEMIC_CALENDAR.timeSlots.map(slot => {
                      const isUnavailable = state.restrictions.some(res => 
                        res.roomName === room.name && res.day === day && res.slot === slot
                      );

                      if (isUnavailable) {
                        const res = state.restrictions.find(r => r.roomName === room.name && r.day === day && r.slot === slot);
                        const reason = res.reason || (state.language === "hi" ? "रखरखाव" : "Maintenance");
                        return `<td class="print-cell-unavailable">🛠️ ${reason}</td>`;
                      }

                      let bookedCourseCode = state.bookings[room.name]?.[day]?.[slot];
                      let isOneOffOverride = false;

                      if (state.activeDate) {
                        const matchTo = state.oneOffOverrides.find(o => 
                          o.date === state.activeDate && o.roomName === room.name && o.day === day && o.slot === slot
                        );
                        if (matchTo) {
                          bookedCourseCode = matchTo.courseCode;
                          isOneOffOverride = true;
                        }
                        const matchFrom = state.oneOffOverrides.find(o => 
                          o.date === state.activeDate && o.oldRoom === room.name && o.oldDay === day && o.slotFrom === slot
                        );
                        if (matchFrom && bookedCourseCode === matchFrom.courseCode) {
                          bookedCourseCode = null;
                        }
                      }

                      if (bookedCourseCode) {
                        const course = MOCK_COURSES.find(c => c.code === bookedCourseCode);
                        const faculty = course ? MOCK_FACULTY.find(f => f.id === course.facultyId) : null;
                        return `
                          <td>
                            <div class="print-card">
                              <span class="print-card-code">${bookedCourseCode}</span>
                              <span class="print-card-name">${course ? course.name : ""}</span>
                              <span class="print-card-details">👨‍🏫 ${faculty ? faculty.name : ""} | 👥 ${course ? course.sectionSize : ""}</span>
                              ${isOneOffOverride ? `<span class="print-card-override">${state.language === "hi" ? "एक-बंद बदलाव" : "1-Off Override"}</span>` : ""}
                            </div>
                          </td>
                        `;
                      }

                      return "<td></td>";
                    }).join("")}
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `;
    });
  }

  printSection.innerHTML = html;
  document.body.classList.add("print-mode-active");
  window.print();
  
  // Safe synchronous fallback cleanup
  setTimeout(() => {
    document.body.classList.remove("print-mode-active");
    const ps = document.getElementById("print-section");
    if (ps) ps.innerHTML = "";
  }, 1000);
}

document.getElementById("btn-export-pdf").addEventListener("click", triggerCustomPrint);

// ----------------------------------------------------
// NAVIGATION SYSTEM
// ----------------------------------------------------
const navItems = document.querySelectorAll(".nav-item");
const panels = document.querySelectorAll(".panel");

navItems.forEach(item => {
  item.addEventListener("click", () => {
    const target = item.getAttribute("data-target");
    
    // Update nav status
    navItems.forEach(i => i.classList.remove("active"));
    item.classList.add("active");
    
    // Update active panel
    panels.forEach(p => p.classList.remove("active"));
    document.getElementById(target).classList.add("active");
    
    // Sub-menus or sidebar toggles
    const sidebarTimetable = document.getElementById("timetable-sidebar-content");
    const sidebarOther = document.getElementById("other-sidebar-content");
    
    if (target === "timetable-panel") {
      sidebarTimetable.style.display = "block";
      sidebarOther.style.display = "none";
    } else {
      sidebarTimetable.style.display = "none";
      sidebarOther.style.display = "block";
    }

    // Header label update
    const title = document.getElementById("page-title");
    const subtitle = document.getElementById("page-subtitle");
    
    if (target === "timetable-panel") {
      title.setAttribute("data-en", "Semester Timetable Builder");
      title.setAttribute("data-hi", "सत्र समय-सारणी निर्माता");
      subtitle.setAttribute("data-en", "Build conflict-free timetables for the semester");
      subtitle.setAttribute("data-hi", "सत्र के लिए संघर्ष-मुक्त समय-सारणी का निर्माण करें");
    } else if (target === "rooms-panel") {
      title.setAttribute("data-en", "Room Master Database");
      title.setAttribute("data-hi", "कक्ष मास्टर डेटाबेस");
      subtitle.setAttribute("data-en", "Create and manage teaching spaces and schedules");
      subtitle.setAttribute("data-hi", "शिक्षण कक्षों और कार्यक्रम प्रतिबंधों का प्रबंधन करें");
      renderRoomsTable();
    } else if (target === "availability-panel") {
      title.setAttribute("data-en", "Real-Time Room Availability");
      title.setAttribute("data-hi", "वास्तविक समय कक्ष उपलब्धता");
      subtitle.setAttribute("data-en", "Inspect weekly teaching space schedules at-a-glance");
      subtitle.setAttribute("data-hi", "शिक्षण स्थान के साप्ताहिक कार्यक्रमों का एक नज़र में निरीक्षण करें");
      renderAvailabilityMatrix();
    } else if (target === "publish-panel") {
      title.setAttribute("data-en", "Publish & Reports");
      title.setAttribute("data-hi", "प्रकाशन और रिपोर्ट");
      subtitle.setAttribute("data-en", "Publish timetable and export room, department, or faculty reports");
      subtitle.setAttribute("data-hi", "समय-सारणी प्रकाशित करें और कक्ष, विभाग या संकाय रिपोर्ट निर्यात करें");
      updatePublishPanelStatus();
      populateReportTargets();

    } else if (target === "requests-panel") {
      title.setAttribute("data-en", "Class Reschedule Requests");
      title.setAttribute("data-hi", "कक्षा पुनर्निर्धारण अनुरोध");
      subtitle.setAttribute("data-en", "Submit and review permanent or temporary class rescheduling requests");
      subtitle.setAttribute("data-hi", "स्थायी या अस्थायी कक्षा पुनर्निर्धारण अनुरोध सबमिट करें और समीक्षा करें");
      renderRequestsTable();
    }

    translateUI();
  });
});

// Active room selector change listener
document.getElementById("select-active-room").addEventListener("change", (e) => {
  state.activeRoom = e.target.value;
  saveStateToLocalStorage();
  renderTimetableGrid();
  renderActiveRoomStats();
});

// Building and Type filter changes in Grid Builder
document.getElementById("select-filter-building").addEventListener("change", filterRoomsList);
document.getElementById("select-filter-type").addEventListener("change", filterRoomsList);

function filterRoomsList() {
  const building = document.getElementById("select-filter-building").value;
  const type = document.getElementById("select-filter-type").value;
  
  // Filter rooms matching criteria and populate active room dropdown
  const roomSelect = document.getElementById("select-active-room");
  roomSelect.innerHTML = "";
  
  const filtered = state.rooms.filter(r => {
    if (building !== "all" && r.building !== building) return false;
    if (type !== "all" && r.type !== type) return false;
    return true;
  });

  filtered.forEach(room => {
    const opt = document.createElement("option");
    opt.value = room.name;
    opt.textContent = `${room.name} (${room.building})`;
    roomSelect.appendChild(opt);
  });

  if (filtered.length > 0) {
    if (!filtered.some(r => r.name === state.activeRoom)) {
      state.activeRoom = filtered[0].name;
    }
    roomSelect.value = state.activeRoom;
  } else {
    state.activeRoom = "";
  }
  
  renderTimetableGrid();
  renderActiveRoomStats();
}

// Matrix filters listener
document.getElementById("matrix-day-select").addEventListener("change", renderAvailabilityMatrix);
document.getElementById("matrix-capacity-filter").addEventListener("input", renderAvailabilityMatrix);
document.getElementById("matrix-building-select").addEventListener("change", renderAvailabilityMatrix);



// Language Selectors Action
document.getElementById("lang-en").addEventListener("click", () => {
  state.language = "en";
  saveStateToLocalStorage();
  translateUI();
  
  // Refresh specific panels to pick up translations
  if (document.getElementById("timetable-panel").classList.contains("active")) {
    renderTimetableGrid();
  } else if (document.getElementById("rooms-panel").classList.contains("active")) {
    renderRoomsTable();
  } else if (document.getElementById("availability-panel").classList.contains("active")) {
    renderAvailabilityMatrix();
  } else if (document.getElementById("publish-panel").classList.contains("active")) {
    renderPublishGrid();
  }
});

document.getElementById("lang-hi").addEventListener("click", () => {
  state.language = "hi";
  saveStateToLocalStorage();
  translateUI();
  
  // Refresh specific panels to pick up translations
  if (document.getElementById("timetable-panel").classList.contains("active")) {
    renderTimetableGrid();
  } else if (document.getElementById("rooms-panel").classList.contains("active")) {
    renderRoomsTable();
  } else if (document.getElementById("availability-panel").classList.contains("active")) {
    renderAvailabilityMatrix();
  } else if (document.getElementById("publish-panel").classList.contains("active")) {
    renderPublishGrid();
  }
});

// ----------------------------------------------------
// DYNAMIC REPORTS VIEWER LOGIC (F4 REPORT VIEWS)
// ----------------------------------------------------
function initPublishPanel() {
  const typeSelect = document.getElementById("report-type-select");
  const targetSelect = document.getElementById("report-target-select");
  const toggleBtn = document.getElementById("btn-panel-toggle-publish");

  typeSelect.addEventListener("change", populateReportTargets);
  targetSelect.addEventListener("change", renderPublishGrid);
  
  toggleBtn.addEventListener("click", () => {
    togglePublishedState();
    updatePublishPanelStatus();
  });
}

function updatePublishPanelStatus() {
  const statusBadge = document.getElementById("publish-status-badge");
  const toggleBtn = document.getElementById("btn-panel-toggle-publish");

  if (state.published) {
    statusBadge.textContent = state.language === "hi" ? "प्रकाशित" : "Published";
    statusBadge.className = "room-status-badge badge-available";
    toggleBtn.textContent = state.language === "hi" ? "अप्रकाशित करें" : "Unpublish Semester";
    toggleBtn.className = "btn btn-secondary";
  } else {
    statusBadge.textContent = state.language === "hi" ? "संपादन चालू" : "Draft / Editing";
    statusBadge.className = "room-status-badge badge-maintenance";
    toggleBtn.textContent = state.language === "hi" ? "सेमेस्टर प्रकाशित करें" : "Publish Semester";
    toggleBtn.className = "btn btn-primary";
  }
}

function populateReportTargets() {
  const type = document.getElementById("report-type-select").value;
  const targetSelect = document.getElementById("report-target-select");
  targetSelect.innerHTML = "";

  if (type === "room") {
    state.rooms.forEach(room => {
      const opt = document.createElement("option");
      opt.value = room.name;
      opt.textContent = room.name;
      targetSelect.appendChild(opt);
    });
  } else if (type === "faculty") {
    MOCK_FACULTY.forEach(fac => {
      const opt = document.createElement("option");
      opt.value = fac.id;
      opt.textContent = fac.name;
      targetSelect.appendChild(opt);
    });
  } else if (type === "department") {
    const depts = Array.from(new Set(MOCK_COURSES.map(c => c.department)));
    depts.forEach(dept => {
      const opt = document.createElement("option");
      opt.value = dept;
      opt.textContent = dept;
      targetSelect.appendChild(opt);
    });
  }

  renderPublishGrid();
}

function renderPublishGrid() {
  const type = document.getElementById("report-type-select").value;
  const target = document.getElementById("report-target-select").value;
  const gridContainer = document.getElementById("publish-view-grid");
  
  gridContainer.innerHTML = "";

  if (!target) {
    gridContainer.innerHTML = `
      <div style="grid-column: span 11; padding: 40px; text-align: center; color: var(--text-secondary);" class="translate"
           data-en="No target selected." data-hi="कोई लक्ष्य चयनित नहीं है।">
        No target selected.
      </div>
    `;
    return;
  }

  // Row header Cell (0,0)
  const originCell = document.createElement("div");
  originCell.className = "grid-header-cell";
  originCell.innerHTML = state.language === "hi" ? "दिन \\ समय" : "Day \\ Time";
  gridContainer.appendChild(originCell);

  // Time Slot Headers
  ACADEMIC_CALENDAR.timeSlots.forEach(slot => {
    const headerCell = document.createElement("div");
    headerCell.className = "grid-header-cell";
    headerCell.textContent = slot;
    gridContainer.appendChild(headerCell);
  });

  // Week Days rows
  ACADEMIC_CALENDAR.workingDays.forEach(day => {
    // 1. Day label header cell
    const dayHeader = document.createElement("div");
    dayHeader.className = "grid-row-header";
    dayHeader.innerHTML = `
      <div>${day}</div>
      <div style="font-size: 0.75rem; font-weight: normal; color: var(--text-secondary);">
        ${state.language === "hi" ? translateDayName(day) : ""}
      </div>
    `;
    gridContainer.appendChild(dayHeader);

    // 2. 10 time slot cells for this day
    ACADEMIC_CALENDAR.timeSlots.forEach(slot => {
      const cell = document.createElement("div");
      cell.className = "grid-cell";
      cell.setAttribute("data-day", day);
      cell.setAttribute("data-slot", slot);

      let cardContent = null;
      let isWarning = false;

      if (type === "room") {
        const isUnavailable = state.restrictions.some(res => 
          res.roomName === target && res.day === day && res.slot === slot
        );
        if (isUnavailable) {
          cell.classList.add("unavailable-room");
          const restriction = state.restrictions.find(res => 
            res.roomName === target && res.day === day && res.slot === slot
          );
          cell.setAttribute("title", restriction.reason || "Unavailable");
        }

        const bookedCourseCode = state.bookings[target]?.[day]?.[slot];
        if (bookedCourseCode) {
          const course = MOCK_COURSES.find(c => c.code === bookedCourseCode);
          if (course) {
            const faculty = MOCK_FACULTY.find(f => f.id === course.facultyId);
            const isCapacityClash = state.rooms.find(r => r.name === target)?.capacity < course.sectionSize;
            isWarning = isCapacityClash;
            
            cardContent = `
              <div class="scheduled-card-title">
                <span>${course.code}</span>
              </div>
              <div class="scheduled-card-faculty">${faculty ? faculty.name : "Staff"}</div>
              <div class="scheduled-card-footer">
                <span>👥 ${course.sectionSize}</span>
                ${isCapacityClash ? `<span class="warning-badge">⚠️ Cap</span>` : ''}
              </div>
            `;
          }
        }
      } else if (type === "faculty") {
        let foundBooking = null;
        for (const roomName in state.bookings) {
          const bookedCode = state.bookings[roomName]?.[day]?.[slot];
          if (bookedCode) {
            const course = MOCK_COURSES.find(c => c.code === bookedCode);
            if (course && course.facultyId === target) {
              foundBooking = { roomName, course };
              break;
            }
          }
        }

        if (foundBooking) {
          const { roomName, course } = foundBooking;
          cardContent = `
            <div class="scheduled-card-title">
              <span>${course.code}</span>
              <span style="font-size: 0.7rem; color: var(--primary); font-weight: bold;">${roomName}</span>
            </div>
            <div class="scheduled-card-faculty">${course.name}</div>
            <div class="scheduled-card-footer">
              <span>👥 ${course.sectionSize}</span>
            </div>
          `;
        }
      } else if (type === "department") {
        let foundBooking = null;
        for (const roomName in state.bookings) {
          const bookedCode = state.bookings[roomName]?.[day]?.[slot];
          if (bookedCode) {
            const course = MOCK_COURSES.find(c => c.code === bookedCode);
            if (course && course.department === target) {
              foundBooking = { roomName, course };
              break;
            }
          }
        }

        if (foundBooking) {
          const { roomName, course } = foundBooking;
          const faculty = MOCK_FACULTY.find(f => f.id === course.facultyId);
          cardContent = `
            <div class="scheduled-card-title">
              <span>${course.code}</span>
              <span style="font-size: 0.7rem; color: var(--primary); font-weight: bold;">${roomName}</span>
            </div>
            <div class="scheduled-card-faculty">${faculty ? faculty.name : "Staff"}</div>
            <div class="scheduled-card-footer">
              <span>👥 ${course.sectionSize}</span>
            </div>
          `;
        }
      }

      if (cardContent) {
        const card = document.createElement("div");
        card.className = `scheduled-card ${isWarning ? 'capacity-warning' : ''}`;
        card.innerHTML = cardContent;
        cell.appendChild(card);
      }

      gridContainer.appendChild(cell);
    });
  });

  translateUI();
}

// ----------------------------------------------------
// AUTO-SCHEDULING CONSTRAINT SOLVER ENGINE
// ----------------------------------------------------
function initAutoScheduler() {
  const triggerBtn = document.getElementById("btn-trigger-auto-schedule");
  const dialog = document.getElementById("dialog-auto-generate");
  const btnScratch = document.getElementById("btn-auto-schedule-scratch");
  const btnRemaining = document.getElementById("btn-auto-schedule-remaining");

  if (!triggerBtn || !dialog) return;

  triggerBtn.addEventListener("click", () => {
    if (state.published) {
      showToast("Cannot auto-schedule. Timetable is published and locked.", "warning");
      return;
    }
    dialog.showModal();
  });

  btnScratch.addEventListener("click", () => {
    runAutoScheduler(true);
    dialog.close();
  });

  btnRemaining.addEventListener("click", () => {
    runAutoScheduler(false);
    dialog.close();
  });
  
  triggerBtn.disabled = state.published;
}

function runAutoScheduler(clearExisting) {
  if (state.published) return;

  let coursesToSchedule = [];

  if (clearExisting) {
    state.bookings = {};
    state.unscheduledCourses = [...MOCK_COURSES];
    coursesToSchedule = [...MOCK_COURSES];
    logAction("AUTO-GENERATE", "Cleared all allocations and started scheduling from scratch.");
  } else {
    const allocatedCourseCodes = new Set();
    for (const rName in state.bookings) {
      for (const day in state.bookings[rName]) {
        for (const slot in state.bookings[rName][day]) {
          allocatedCourseCodes.add(state.bookings[rName][day][slot]);
        }
      }
    }
    state.unscheduledCourses = MOCK_COURSES.filter(c => !allocatedCourseCodes.has(c.code));
    coursesToSchedule = [...state.unscheduledCourses];
    logAction("AUTO-GENERATE", `Started incremental scheduling for ${coursesToSchedule.length} remaining courses.`);
  }

  // Heuristic: Sort courses by section size descending (largest classes scheduled first)
  coursesToSchedule.sort((a, b) => b.sectionSize - a.sectionSize);

  let successCount = 0;
  let failedCourses = [];

  coursesToSchedule.forEach((course, courseIndex) => {
    const isLabCourse = course.code.toUpperCase().includes("LAB") || course.name.toLowerCase().includes("lab");
    
    // Find candidate rooms matching capacity, building, and type constraints
    let candidateRooms = state.rooms.filter(room => {
      if (room.capacity < course.sectionSize) return false;

      if (isLabCourse) {
        // Labs must be scheduled in a Lab room
        if (room.type !== "Lab") return false;
      } else {
        // Lectures cannot be scheduled in a Lab room
        if (room.type === "Lab") return false;
      }

      // Enforce Building Block constraints
      if (room.building === "Main Building") {
        return true; // Main Building is shared for seminars/presentations
      }

      const targetBlock = getRespectiveBlock(course.department);
      if (targetBlock) {
        return room.building === targetBlock;
      }

      return true;
    });

    // Minimize wasted capacity
    candidateRooms.sort((a, b) => {
      return (a.capacity - course.sectionSize) - (b.capacity - course.sectionSize);
    });

    let scheduled = false;

    for (let rIndex = 0; rIndex < candidateRooms.length && !scheduled; rIndex++) {
      const roomName = candidateRooms[rIndex].name;

      // Distribute classes evenly across days and slots using indexing offsets
      const dayOffset = courseIndex % ACADEMIC_CALENDAR.workingDays.length;
      const slotOffset = Math.floor(courseIndex / ACADEMIC_CALENDAR.workingDays.length) % ACADEMIC_CALENDAR.timeSlots.length;

      for (let d = 0; d < ACADEMIC_CALENDAR.workingDays.length && !scheduled; d++) {
        const dIndex = (dayOffset + d) % ACADEMIC_CALENDAR.workingDays.length;
        const day = ACADEMIC_CALENDAR.workingDays[dIndex];

        for (let s = 0; s < ACADEMIC_CALENDAR.timeSlots.length && !scheduled; s++) {
          const sIndex = (slotOffset + s) % ACADEMIC_CALENDAR.timeSlots.length;
          const slot = ACADEMIC_CALENDAR.timeSlots[sIndex];

          // Check maintenance restrictions
          const isUnavailable = state.restrictions.some(res => 
            res.roomName === roomName && res.day === day && res.slot === slot
          );
          if (isUnavailable) continue;

          // Check double booking
          if (state.bookings[roomName]?.[day]?.[slot]) continue;

          // Check faculty double teaching
          let facultyBusy = false;
          for (const rName in state.bookings) {
            const bookedCode = state.bookings[rName]?.[day]?.[slot];
            if (bookedCode) {
              const bookedCourse = MOCK_COURSES.find(c => c.code === bookedCode);
              if (bookedCourse && bookedCourse.facultyId === course.facultyId) {
                facultyBusy = true;
                break;
              }
            }
          }
          if (facultyBusy) continue;

          // Book slot
          if (!state.bookings[roomName]) {
            state.bookings[roomName] = {};
          }
          if (!state.bookings[roomName][day]) {
            state.bookings[roomName][day] = {};
          }
          state.bookings[roomName][day][slot] = course.code;
          
          successCount++;
          scheduled = true;
        }
      }
    }

    if (!scheduled) {
      failedCourses.push(course.code);
    }
  });

  // Keep failed ones in unscheduled list
  state.unscheduledCourses = MOCK_COURSES.filter(c => failedCourses.includes(c.code));

  saveStateToLocalStorage();
  
  // Re-render UI views
  renderTimetableGrid();
  renderSidebarCourses();
  
  if (failedCourses.length === 0) {
    showToast(
      state.language === "hi"
        ? `सफलतापूर्वक सभी ${successCount} पाठ्यक्रमों को निर्धारित किया गया!`
        : `Successfully scheduled all ${successCount} courses!`,
      "success"
    );
    logAction("AUTO-GENERATE SUCCESS", `Auto-scheduled ${successCount} courses with 0 conflicts.`);
  } else {
    showToast(
      state.language === "hi"
        ? `सफलतापूर्वक ${successCount} पाठ्यक्रमों को निर्धारित किया गया। ${failedCourses.length} असफल रहे (कक्ष क्षमता या स्लॉट कमी)।`
        : `Successfully scheduled ${successCount} courses. ${failedCourses.length} failed due to tight capacity or slot clashing.`,
      "warning"
    );
    logAction("AUTO-GENERATE PARTIAL", `Auto-scheduled ${successCount} courses. ${failedCourses.length} failed: ${failedCourses.join(", ")}`);
  }
}

// ----------------------------------------------------
// ----------------------------------------------------
// FACULTY RESCHEDULE REQUESTS SYSTEM (PHASE 2 WORKFLOW)
// ----------------------------------------------------

function updateRoleVisibility() {
  const currentRole = state.currentRole;
  
  // 1. Sync select-user-role value
  const roleSelect = document.getElementById("select-user-role");
  if (roleSelect && roleSelect.value !== currentRole) {
    roleSelect.value = currentRole;
  }

  // 1b. Show/Hide selectors based on role
  const selectActiveRoom = document.getElementById("select-active-room");
  const selectFilterBuilding = document.getElementById("select-filter-building");
  const selectFilterType = document.getElementById("select-filter-type");

  if (currentRole === "registrar") {
    if (selectActiveRoom) {
      const parent = selectActiveRoom.closest(".form-group");
      if (parent) parent.style.display = "flex";
    }
    if (selectFilterBuilding) {
      const parent = selectFilterBuilding.closest(".form-group");
      if (parent) parent.style.display = "flex";
    }
    if (selectFilterType) {
      const parent = selectFilterType.closest(".form-group");
      if (parent) parent.style.display = "flex";
    }
  } else {
    if (selectActiveRoom) {
      const parent = selectActiveRoom.closest(".form-group");
      if (parent) parent.style.display = "none";
    }
    if (selectFilterBuilding) {
      const parent = selectFilterBuilding.closest(".form-group");
      if (parent) parent.style.display = "none";
    }
    if (selectFilterType) {
      const parent = selectFilterType.closest(".form-group");
      if (parent) parent.style.display = "none";
    }
  }

  // 2. Navigation items visibility
  const navRooms = document.querySelector(".nav-item[data-target='rooms-panel']");
  const navPublish = document.querySelector(".nav-item[data-target='publish-panel']");

  if (currentRole === "registrar") {
    if (navRooms) navRooms.style.display = "flex";
    if (navPublish) navPublish.style.display = "flex";
    
    // Show Submit Request button
    const btnOpenReq = document.getElementById("btn-open-request-modal");
    if (btnOpenReq) btnOpenReq.style.display = "none";
    
    // Show Publish / Auto-Schedule / Reset buttons
    const btnPub = document.getElementById("btn-publish");
    if (btnPub) btnPub.style.display = "inline-flex";
    const btnAuto = document.getElementById("btn-trigger-auto-schedule");
    if (btnAuto) {
      btnAuto.style.display = "inline-flex";
      btnAuto.disabled = state.published;
    }
    const btnReset = document.getElementById("btn-reset-timetable");
    if (btnReset) {
      btnReset.style.display = "inline-flex";
      btnReset.disabled = state.published;
    }
    
    // Allow unpublish from banner if published
    const btnUnpubBanner = document.getElementById("btn-unpublish-banner");
    if (btnUnpubBanner) btnUnpubBanner.style.display = "inline-block";
  } else {
    // Faculty member
    if (navRooms) navRooms.style.display = "none";
    if (navPublish) navPublish.style.display = "none";
    
    // Show Submit Request button
    const btnOpenReq = document.getElementById("btn-open-request-modal");
    if (btnOpenReq) btnOpenReq.style.display = "inline-flex";
    
    // Hide Publish / Auto-Schedule / Reset buttons
    const btnPub = document.getElementById("btn-publish");
    if (btnPub) btnPub.style.display = "none";
    const btnAuto = document.getElementById("btn-trigger-auto-schedule");
    if (btnAuto) btnAuto.style.display = "none";
    const btnReset = document.getElementById("btn-reset-timetable");
    if (btnReset) btnReset.style.display = "none";
    
    // Hide unpublish from banner if published
    const btnUnpubBanner = document.getElementById("btn-unpublish-banner");
    if (btnUnpubBanner) btnUnpubBanner.style.display = "none";

    // If currently active panel is a hidden one, switch to timetable-panel
    const activeNav = document.querySelector(".nav-item.active");
    if (activeNav) {
      const activeTarget = activeNav.getAttribute("data-target");
      if (activeTarget === "rooms-panel" || activeTarget === "publish-panel") {
        // Trigger click on timetable nav item
        const timetableNav = document.querySelector(".nav-item[data-target='timetable-panel']");
        if (timetableNav) timetableNav.click();
      }
    }
  }

  // Update currentUser for log entry purposes
  if (currentRole === "registrar") {
    state.currentUser = "Registrar Staff";
  } else {
    const facultyObj = MOCK_FACULTY.find(f => f.id === currentRole);
    state.currentUser = facultyObj ? facultyObj.name : `Faculty (${currentRole})`;
  }

  renderActiveRoomStats();
}

function initRequestsPanel() {
  // Active Persona Switcher Change Listener
  const roleSelect = document.getElementById("select-user-role");
  if (roleSelect) {
    roleSelect.addEventListener("change", (e) => {
      state.currentRole = e.target.value;
      saveStateToLocalStorage();
      updateRoleVisibility();
      
      // Refresh views
      renderSidebarCourses();
      renderTimetableGrid();
      
      const activeNav = document.querySelector(".nav-item.active");
      if (activeNav && activeNav.getAttribute("data-target") === "requests-panel") {
        renderRequestsTable();
      }
    });
  }

  // Target Date selector Change Listener
  const dateInput = document.getElementById("select-grid-date");
  if (dateInput) {
    // Load existing date from state
    if (state.activeDate) {
      dateInput.value = state.activeDate;
    }
    dateInput.addEventListener("change", (e) => {
      state.activeDate = e.target.value;
      saveStateToLocalStorage();
      renderTimetableGrid();
    });
  }

  // Open Submit Request Modal
  // Open Submit Request Modal
  const openModalBtn = document.getElementById("btn-open-request-modal");
  if (openModalBtn) {
    openModalBtn.addEventListener("click", () => {
      const dialog = document.getElementById("dialog-reschedule-request");
      if (dialog) {
        populateRequestModalCourses();
        populateRequestModalSlotsAndRooms();
        
        // Reset inputs
        document.getElementById("request-reason-input").value = "";
        document.getElementById("request-type-select").value = "semester";
        document.getElementById("request-date-input").value = "";
        document.getElementById("request-date-group").style.display = "none";
        document.getElementById("request-date-input").removeAttribute("required");

        dialog.showModal();
      }
    });
  }

  // Request Type Select Change Handler (toggles date input)
  const typeSelect = document.getElementById("request-type-select");
  if (typeSelect) {
    typeSelect.addEventListener("change", (e) => {
      const dateGroup = document.getElementById("request-date-group");
      const dateInput = document.getElementById("request-date-input");
      if (e.target.value === "lecture") {
        dateGroup.style.display = "block";
        dateInput.setAttribute("required", "true");
        // Set default minimum date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        dateInput.min = tomorrow.toISOString().split('T')[0];
      } else {
        dateGroup.style.display = "none";
        dateInput.value = "";
        dateInput.removeAttribute("required");
      }
    });
  }

  // Form Reschedule Request Submission Handler
  const formRequest = document.getElementById("form-reschedule-request");
  if (formRequest) {
    formRequest.addEventListener("submit", handleRequestSubmit);
  }
}

function populateRequestModalCourses() {
  const courseSelect = document.getElementById("request-course-select");
  courseSelect.innerHTML = `<option value="" class="translate" data-en="-- Select Course --" data-hi="-- पाठ्यक्रम चुनें --">${state.language === "hi" ? "-- पाठ्यक्रम चुनें --" : "-- Select Course --"}</option>`;
  
  // Find courses for current faculty member
  const facultyCourses = MOCK_COURSES.filter(c => c.facultyId === state.currentRole);
  facultyCourses.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.code;
    opt.textContent = `${c.code} - ${c.name}`;
    courseSelect.appendChild(opt);
  });

  const slotDisplay = document.getElementById("request-current-slot-display");
  slotDisplay.value = "";

  courseSelect.addEventListener("change", () => {
    const selectedCourse = courseSelect.value;
    if (!selectedCourse) {
      slotDisplay.value = "";
      return;
    }
    
    // Find where the course is currently scheduled in state.bookings
    let currentSlotStr = "";
    for (const rName in state.bookings) {
      for (const day in state.bookings[rName]) {
        for (const slot in state.bookings[rName][day]) {
          if (state.bookings[rName][day][slot] === selectedCourse) {
            currentSlotStr = `${rName} (${day} ${slot})`;
            break;
          }
        }
        if (currentSlotStr) break;
      }
      if (currentSlotStr) break;
    }
    
    slotDisplay.value = currentSlotStr || (state.language === "hi" ? "अनिर्धारित" : "Unscheduled");
  });
}

function populateRequestModalSlotsAndRooms() {
  // Slots
  const slotSelect = document.getElementById("request-slot-select");
  slotSelect.innerHTML = "";
  ACADEMIC_CALENDAR.timeSlots.forEach(slot => {
    const opt = document.createElement("option");
    opt.value = slot;
    opt.textContent = slot;
    slotSelect.appendChild(opt);
  });

  // Rooms
  const roomSelect = document.getElementById("request-room-select");
  roomSelect.innerHTML = "";
  state.rooms.forEach(room => {
    const opt = document.createElement("option");
    opt.value = room.name;
    opt.textContent = `${room.name} (${room.building}, Cap: ${room.capacity})`;
    roomSelect.appendChild(opt);
  });
}

function handleRequestSubmit(e) {
  e.preventDefault();
  
  const courseCode = document.getElementById("request-course-select").value;
  const newDay = document.getElementById("request-day-select").value;
  const newSlot = document.getElementById("request-slot-select").value;
  const newRoom = document.getElementById("request-room-select").value;
  const type = document.getElementById("request-type-select").value;
  const date = document.getElementById("request-date-input").value;
  const reason = document.getElementById("request-reason-input").value.trim();

  if (!courseCode) {
    showToast(state.language === "hi" ? "कृपया एक पाठ्यक्रम चुनें।" : "Please select a course.", "danger");
    return;
  }

  const course = MOCK_COURSES.find(c => c.code === courseCode);
  const room = state.rooms.find(r => r.name === newRoom);
  if (course && room) {
    const isLabCourse = course.code.toUpperCase().includes("LAB") || course.name.toLowerCase().includes("lab");

    if (isLabCourse) {
      if (room.type !== "Lab") {
        showToast(
          state.language === "hi"
            ? "प्रयोगशाला पाठ्यक्रमों को प्रयोगशाला कक्ष में निर्धारित किया जाना चाहिए।"
            : "Lab courses must be scheduled in a laboratory room.",
          "danger"
        );
        return;
      }
    } else {
      if (room.type === "Lab") {
        showToast(
          state.language === "hi"
            ? "व्याख्यान पाठ्यक्रमों को प्रयोगशाला कक्षों में निर्धारित नहीं किया जा सकता।"
            : "Lecture courses cannot be scheduled in laboratory rooms.",
          "danger"
        );
        return;
      }
      const targetBlock = getRespectiveBlock(course.department);
      if (room.building !== "Main Building" && targetBlock && room.building !== targetBlock) {
        showToast(
          state.language === "hi"
            ? `इस विभाग के पाठ्यक्रमों को केवल ${targetBlock} या Main Building में ही निर्धारित किया जा सकता है।`
            : `Courses for this department must be scheduled in the ${targetBlock} or Main Building.`,
          "danger"
        );
        return;
      }
    }
  }

  if (type === "lecture" && !date) {
    showToast(state.language === "hi" ? "कृपया एक विशिष्ट तिथि चुनें।" : "Please select a specific date.", "danger");
    return;
  }
  if (!reason) {
    showToast(state.language === "hi" ? "कृपया परिवर्तन का कारण प्रदान करें।" : "Please provide a reason for the change.", "danger");
    return;
  }

  // Find old slot
  let oldRoom = "";
  let oldDay = "";
  let oldSlot = "";
  for (const rName in state.bookings) {
    for (const day in state.bookings[rName]) {
      for (const slot in state.bookings[rName][day]) {
        if (state.bookings[rName][day][slot] === courseCode) {
          oldRoom = rName;
          oldDay = day;
          oldSlot = slot;
          break;
        }
      }
      if (oldRoom) break;
    }
    if (oldRoom) break;
  }

  // Create new ticket object
  const ticketId = "REQ" + Math.floor(Math.random() * 9000 + 1000).toString();
  const newRequest = {
    id: ticketId,
    courseCode,
    facultyId: state.currentRole,
    oldRoom,
    oldDay,
    oldSlot,
    newRoom,
    newDay,
    newSlot,
    type,
    date,
    reason,
    status: "pending"
  };

  state.rescheduleRequests.push(newRequest);
  saveStateToLocalStorage();
  
  // Close dialog
  const dialog = document.getElementById("dialog-reschedule-request");
  if (dialog) dialog.close();
  
  showToast(
    state.language === "hi" 
      ? `पुनर्निर्धारण अनुरोध ${ticketId} सबमिट कर दिया गया है!` 
      : `Reschedule request ${ticketId} submitted successfully!`,
    "success"
  );
  
  logAction(
    "SUBMIT REQUEST",
    `Faculty submitted reschedule request ${ticketId} for ${courseCode} to ${newRoom} on ${newDay} ${newSlot}${date ? ` for date ${date}` : ''}.`
  );
  
  renderRequestsTable();
}

function checkOneOffConflict(courseCode, targetRoom, targetDay, targetSlot, targetDate) {
  const course = MOCK_COURSES.find(c => c.code === courseCode);
  const room = state.rooms.find(r => r.name === targetRoom);
  if (!course || !room) {
    return { type: "error", message: "Invalid course or room identifier." };
  }

  // Check Department Block and Lab Restrictions (F4 Course/Room Alignment Requirement)
  const isLabCourse = course.code.toUpperCase().includes("LAB") || course.name.toLowerCase().includes("lab");

  if (isLabCourse) {
    if (room.type !== "Lab") {
      return { type: "block", message: "Lab courses must be scheduled in a laboratory room." };
    }
  } else {
    if (room.type === "Lab") {
      return { type: "block", message: "Lecture courses cannot be scheduled in laboratory rooms." };
    }
  }

  // Enforce Building Block constraints
  const targetBlock = getRespectiveBlock(course.department);
  if (room.building !== "Main Building" && targetBlock && room.building !== targetBlock) {
    return { type: "block", message: `Courses for this department must be scheduled in the ${targetBlock} or Main Building.` };
  }

  // 1. Check Room Unavailability Restrictions
  const isUnavailable = state.restrictions.some(res => 
    res.roomName === targetRoom && res.day === targetDay && res.slot === targetSlot
  );
  if (isUnavailable) {
    return { type: "block", message: `Room is marked unavailable in this slot due to maintenance.` };
  }

  // 2. Check Room Double-Booking on this date
  const overrideToRoom = state.oneOffOverrides.find(o => 
    o.date === targetDate && o.roomName === targetRoom && o.day === targetDay && o.slot === targetSlot
  );
  if (overrideToRoom) {
    return { type: "block", message: `Room ${targetRoom} is already allocated to ${overrideToRoom.courseCode} on this date.` };
  }

  const regularBooking = state.bookings[targetRoom]?.[targetDay]?.[targetSlot];
  if (regularBooking) {
    const movedAway = state.oneOffOverrides.some(o => 
      o.date === targetDate && o.oldRoom === targetRoom && o.oldDay === targetDay && o.slotFrom === targetSlot
    );
    if (!movedAway) {
      return { type: "block", message: `Room ${targetRoom} is already allocated to ${regularBooking} in this slot.` };
    }
  }

  // 3. Check Faculty Double-Booking on this date
  const facultyId = course.facultyId;
  const faculty = MOCK_FACULTY.find(f => f.id === facultyId);

  const overrideFaculty = state.oneOffOverrides.find(o => 
    o.date === targetDate && o.day === targetDay && o.slot === targetSlot && 
    MOCK_COURSES.find(c => c.code === o.courseCode)?.facultyId === facultyId
  );
  if (overrideFaculty) {
    return { type: "block", message: `Faculty ${faculty ? faculty.name : facultyId} is already teaching ${overrideFaculty.courseCode} on this date.` };
  }

  for (const rName in state.bookings) {
    const regBook = state.bookings[rName]?.[targetDay]?.[targetSlot];
    if (regBook) {
      const regCourse = MOCK_COURSES.find(c => c.code === regBook);
      if (regCourse && regCourse.facultyId === facultyId) {
        const movedAway = state.oneOffOverrides.some(o => 
          o.date === targetDate && o.oldRoom === rName && o.oldDay === targetDay && o.slotFrom === targetSlot
        );
        if (!movedAway) {
          return { type: "block", message: `Faculty ${faculty ? faculty.name : facultyId} is already teaching ${regBook} in Room ${rName} at this time.` };
        }
      }
    }
  }

  // 4. Check Capacity warning
  if (room.capacity < course.sectionSize) {
    return {
      type: "warning",
      message: `Low capacity! Room capacity is ${room.capacity}, but course enrollment is ${course.sectionSize}.`
    };
  }

  return { type: "ok" };
}

function renderRequestsTable() {
  const tbody = document.getElementById("requests-table-body");
  if (!tbody) return;
  
  tbody.innerHTML = "";

  // Filter based on role
  const filteredRequests = state.rescheduleRequests.filter(req => {
    if (state.currentRole === "registrar") return true;
    return req.facultyId === state.currentRole;
  });

  if (filteredRequests.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; color: var(--text-secondary); padding: 30px;" class="translate"
            data-en="No reschedule requests found." data-hi="कोई पुनर्निर्धारण अनुरोध नहीं मिला।">
          No reschedule requests found.
        </td>
      </tr>
    `;
    return;
  }

  // Sort: pending first, then newest first
  filteredRequests.sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return b.id.localeCompare(a.id);
  });

  filteredRequests.forEach(req => {
    const tr = document.createElement("tr");
    
    const faculty = MOCK_FACULTY.find(f => f.id === req.facultyId);
    const facultyName = faculty ? faculty.name : req.facultyId;
    
    const origSlotStr = req.oldRoom 
      ? `${req.oldRoom} (${req.oldDay} ${req.oldSlot})` 
      : (state.language === "hi" ? "अनिर्धारित" : "Unscheduled");
      
    const reqSlotStr = `${req.newRoom} (${req.newDay} ${req.newSlot})${req.type === "lecture" ? ` on ${req.date}` : ''}`;
    
    // Status Badge classes
    let badgeClass = "badge-pending";
    if (req.status === "approved") badgeClass = "badge-available";
    if (req.status === "rejected") badgeClass = "badge-rejected";
    
    const statusTextEn = req.status.charAt(0).toUpperCase() + req.status.slice(1);
    const statusTextHi = req.status === "pending" ? "लंबित" : (req.status === "approved" ? "स्वीकृत" : "अस्वीकृत");

    const typeTextEn = req.type === "semester" ? "Semester" : "Lecture";
    const typeTextHi = req.type === "semester" ? "पूरे सेमेस्टर" : "एकल व्याख्यान";

    // Actions
    let actionButtons = "";
    if (state.currentRole === "registrar") {
      if (req.status === "pending") {
        actionButtons = `
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-primary btn-approve" style="padding: 4px 8px; font-size: 0.75rem;" title="Approve">🟢 Approve</button>
            <button class="btn btn-danger btn-reject" style="padding: 4px 8px; font-size: 0.75rem;" title="Reject">🔴 Reject</button>
          </div>
        `;
      }
    } else {
      // Faculty member
      if (req.status === "pending") {
        actionButtons = `
          <button class="btn btn-secondary btn-cancel-request" style="padding: 4px 8px; font-size: 0.75rem;">Cancel</button>
        `;
      }
    }

    tr.innerHTML = `
      <td><strong>${req.id}</strong></td>
      <td>${req.courseCode}</td>
      <td>${facultyName}</td>
      <td>${origSlotStr}</td>
      <td>${reqSlotStr}</td>
      <td><span class="translate" data-en="${typeTextEn}" data-hi="${typeTextHi}">${state.language === "hi" ? typeTextHi : typeTextEn}</span></td>
      <td>${req.reason}</td>
      <td>
        <span class="room-status-badge ${badgeClass} translate" data-en="${statusTextEn}" data-hi="${statusTextHi}">
          ${state.language === "hi" ? statusTextHi : statusTextEn}
        </span>
      </td>
      <td>${actionButtons}</td>
    `;

    // Event listeners
    if (req.status === "pending") {
      if (state.currentRole === "registrar") {
        tr.querySelector(".btn-approve").addEventListener("click", () => handleApproveRequest(req));
        tr.querySelector(".btn-reject").addEventListener("click", () => handleRejectRequest(req));
      } else {
        const cancelBtn = tr.querySelector(".btn-cancel-request");
        if (cancelBtn) {
          cancelBtn.addEventListener("click", () => handleCancelRequest(req));
        }
      }
    }

    tbody.appendChild(tr);
  });
  
  translateUI();
}

function handleApproveRequest(req) {
  const courseCode = req.courseCode;
  const newRoom = req.newRoom;
  const newDay = req.newDay;
  const newSlot = req.newSlot;
  const oldRoom = req.oldRoom;
  const oldDay = req.oldDay;
  const oldSlot = req.oldSlot;
  
  if (req.type === "semester") {
    // Check conflicts (Semester wide)
    let hadBooking = false;
    if (oldRoom && oldDay && oldSlot && state.bookings[oldRoom]?.[oldDay]?.[oldSlot] === courseCode) {
      delete state.bookings[oldRoom][oldDay][oldSlot];
      hadBooking = true;
    }
    
    const conflict = checkSchedulingConflict(courseCode, newRoom, newDay, newSlot);
    
    if (conflict.type === "block") {
      // Revert booking if it was cleared
      if (hadBooking) {
        if (!state.bookings[oldRoom]) state.bookings[oldRoom] = {};
        if (!state.bookings[oldRoom][oldDay]) state.bookings[oldRoom][oldDay] = {};
        state.bookings[oldRoom][oldDay][oldSlot] = courseCode;
      }
      showToast(
        state.language === "hi"
          ? `अनुमोदन अवरुद्ध! संघर्ष: ${conflict.message}`
          : `Approval Blocked! Conflict: ${conflict.message}`,
        "danger"
      );
      logAction("APPROVE BLOCKED", `Reschedule request ${req.id} approval blocked: ${conflict.message}`, "error");
      return;
    }
    
    if (conflict.type === "warning") {
      showToast(conflict.message, "warning");
    }
    
    // Confirmed approval: schedule course to new slot
    if (!state.bookings[newRoom]) {
      state.bookings[newRoom] = {};
    }
    if (!state.bookings[newRoom][newDay]) {
      state.bookings[newRoom][newDay] = {};
    }
    state.bookings[newRoom][newDay][newSlot] = courseCode;

    // Remove from unscheduled courses list if it was unscheduled
    state.unscheduledCourses = state.unscheduledCourses.filter(c => c.code !== courseCode);

    req.status = "approved";
    saveStateToLocalStorage();
    
    showToast(
      state.language === "hi"
        ? `अनुरोध ${req.id} स्वीकृत! सेमेस्टर अनुसूची अद्यतित।`
        : `Request ${req.id} approved! Semester timetable updated.`,
      "success"
    );
    
    logAction(
      "APPROVE REQUEST",
      `Approved permanent reschedule request ${req.id} for ${courseCode} to Room ${newRoom} on ${newDay} ${newSlot}.`
    );
    
  } else if (req.type === "lecture") {
    // Check conflicts (One-off override)
    const targetDate = req.date;
    const conflict = checkOneOffConflict(courseCode, newRoom, newDay, newSlot, targetDate);
    
    if (conflict.type === "block") {
      showToast(
        state.language === "hi"
          ? `अनुमोदन अवरुद्ध! संघर्ष: ${conflict.message}`
          : `Approval Blocked! Conflict: ${conflict.message}`,
        "danger"
      );
      logAction("APPROVE BLOCKED", `Reschedule request ${req.id} approval blocked for ${targetDate}: ${conflict.message}`, "error");
      return;
    }
    
    if (conflict.type === "warning") {
      showToast(conflict.message, "warning");
    }
    
    // Add override record
    state.oneOffOverrides.push({
      date: targetDate,
      courseCode: courseCode,
      roomName: newRoom,
      day: newDay,
      slot: newSlot,
      oldRoom: oldRoom,
      oldDay: oldDay,
      slotFrom: oldSlot,
      reason: req.reason
    });
    
    req.status = "approved";
    saveStateToLocalStorage();
    
    showToast(
      state.language === "hi"
        ? `अनुरोध ${req.id} स्वीकृत! ${targetDate} के लिए व्याख्यान स्थानांतरित।`
        : `Request ${req.id} approved! Single class override applied for ${targetDate}.`,
      "success"
    );
    
    logAction(
      "APPROVE REQUEST",
      `Approved single-lecture reschedule request ${req.id} for ${courseCode} to Room ${newRoom} on ${newDay} ${newSlot} for date ${targetDate}.`
    );
  }
  
  renderRequestsTable();
  renderTimetableGrid();
  renderSidebarCourses();
}

function handleRejectRequest(req) {
  req.status = "rejected";
  saveStateToLocalStorage();
  
  showToast(
    state.language === "hi"
      ? `अनुरोध ${req.id} अस्वीकृत।`
      : `Request ${req.id} rejected.`,
    "info"
  );
  
  logAction("REJECT REQUEST", `Rejected reschedule request ${req.id} for ${req.courseCode}.`);
  renderRequestsTable();
}

function handleCancelRequest(req) {
  if (confirm(state.language === "hi" 
      ? `क्या आप वास्तव में अनुरोध ${req.id} को रद्द करना चाहते हैं?` 
      : `Are you sure you want to cancel request ${req.id}?`)) {
    
    state.rescheduleRequests = state.rescheduleRequests.filter(r => r.id !== req.id);
    saveStateToLocalStorage();
    
    showToast(
      state.language === "hi"
        ? `अनुरोध ${req.id} सफलतापूर्वक रद्द कर दिया गया।`
        : `Request ${req.id} cancelled successfully.`,
      "success"
    );
    
    logAction("CANCEL REQUEST", `Faculty cancelled reschedule request ${req.id} for ${req.courseCode}.`);
    renderRequestsTable();
  }
}

// INITIAL LOAD
// ----------------------------------------------------
function init() {
  // Dynamic migration fallback: split BS-102 in memory if it hasn't been split yet
  const oldIndex = MOCK_COURSES.findIndex(c => c.code === "BS-102");
  if (oldIndex !== -1) {
    MOCK_COURSES.splice(oldIndex, 1, 
      { code: "BS-102-S1", name: "Calculus & Linear Algebra (Sec A)", facultyId: "FAC008", sectionSize: 80, department: "Basic Sciences" },
      { code: "BS-102-S2", name: "Calculus & Linear Algebra (Sec B)", facultyId: "FAC008", sectionSize: 80, department: "Basic Sciences" }
    );
  }

  loadStateFromLocalStorage();

  // Clean old BS-102 from unscheduled and bookings
  state.unscheduledCourses = state.unscheduledCourses.filter(c => c.code !== "BS-102");
  for (const rName in state.bookings) {
    for (const day in state.bookings[rName]) {
      for (const slot in state.bookings[rName][day]) {
        if (state.bookings[rName][day][slot] === "BS-102") {
          delete state.bookings[rName][day][slot];
        }
      }
    }
  }
  
  // Sync unscheduled courses list based on current bookings
  const allocatedCourseCodes = new Set();
  for (const rName in state.bookings) {
    for (const day in state.bookings[rName]) {
      for (const slot in state.bookings[rName][day]) {
        allocatedCourseCodes.add(state.bookings[rName][day][slot]);
      }
    }
  }

  state.unscheduledCourses = MOCK_COURSES.filter(c => !allocatedCourseCodes.has(c.code));
  
  // Run renderers
  translateUI();
  populateRoomSelectors();
  renderSidebarCourses();
  renderTimetableGrid();
  initPublishPanel();
  initAutoScheduler();

  // Initialize Reset Timetable Button
  const btnReset = document.getElementById("btn-reset-timetable");
  if (btnReset) {
    btnReset.addEventListener("click", () => {
      if (state.published) {
        showToast(
          state.language === "hi"
            ? "समय-सारणी रीसेट नहीं की जा सकती। यह वर्तमान में प्रकाशित और लॉक है।"
            : "Cannot reset timetable. It is currently published and locked.",
          "warning"
        );
        return;
      }
      
      const confirmMsg = state.language === "hi"
        ? "क्या आप वास्तव में समय-सारणी को रीसेट करना चाहते हैं? इससे सभी आवंटन और एक बार के बदलाव साफ हो जाएंगे।"
        : "Are you sure you want to reset the timetable? This will clear all allocations and overrides.";
        
      if (confirm(confirmMsg)) {
        state.bookings = {};
        state.oneOffOverrides = [];
        state.unscheduledCourses = [...MOCK_COURSES];
        saveStateToLocalStorage();
        
        showToast(
          state.language === "hi"
            ? "समय-सारणी सफलतापूर्वक रीसेट कर दी गई।"
            : "Timetable reset successfully.",
          "success"
        );
        
        logAction("RESET TIMETABLE", "Timetable allocations and overrides cleared by Registrar.");
        
        renderTimetableGrid();
        renderSidebarCourses();
      }
    });
    btnReset.disabled = state.published;
  }
  updateRoleVisibility();
  initRequestsPanel();
  
  // Setup banner state if published
  const banner = document.getElementById("published-banner");
  banner.style.display = state.published ? "flex" : "none";
  const publishBtn = document.getElementById("btn-publish");
  if (publishBtn && state.published) {
    publishBtn.innerHTML = `<span class="translate" data-en="Unpublish Schedule" data-hi="समय-सारणी अप्रकाशित करें">Unpublish Schedule</span>`;
    publishBtn.classList.remove("btn-primary");
    publishBtn.classList.add("btn-secondary");
  }

  // Set default active panel displays
  document.getElementById("timetable-sidebar-content").style.display = "block";
  document.getElementById("other-sidebar-content").style.display = "none";
}

// Fire application initialization
init();

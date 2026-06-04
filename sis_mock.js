// Mock Student Information System (SIS) Data Feed
// CampusScheduler retrieves this read-only data nightly or via simulated API sync.

export const MOCK_FACULTY = [
  { id: "FAC001", name: "Dr. Rajesh Sharma", department: "Computer Science" },
  { id: "FAC002", name: "Prof. Sunita Rao", department: "Computer Science" },
  { id: "FAC003", name: "Dr. Amit Verma", department: "Electronics & Comm." },
  { id: "FAC004", name: "Dr. Priya Nair", department: "Electronics & Comm." },
  { id: "FAC005", name: "Prof. Vikram Singh", department: "Mechanical Eng." },
  { id: "FAC006", name: "Dr. Neha Gupta", department: "Mechanical Eng." },
  { id: "FAC007", name: "Prof. Anil Mehta", department: "Basic Sciences" },
  { id: "FAC008", name: "Dr. Kavita Joshi", department: "Basic Sciences" },
  { id: "FAC009", name: "Dr. Rohan Das", department: "Humanities & Social Sciences" },
  { id: "FAC010", name: "Prof. Meera Sen", department: "Humanities & Social Sciences" }
];

export const MOCK_COURSES = [
  // Computer Science Department
  { code: "CS-101", name: "Introduction to Programming", facultyId: "FAC001", sectionSize: 120, department: "Computer Science" },
  { code: "CS-101-LAB", name: "Introduction to Programming Lab", facultyId: "FAC001", sectionSize: 60, department: "Computer Science" },
  { code: "CS-201", name: "Data Structures & Algorithms", facultyId: "FAC001", sectionSize: 85, department: "Computer Science" },
  { code: "CS-201-LAB", name: "Data Structures & Algorithms Lab", facultyId: "FAC002", sectionSize: 60, department: "Computer Science" },
  { code: "CS-301", name: "Database Management Systems", facultyId: "FAC002", sectionSize: 90, department: "Computer Science" },
  { code: "CS-302", name: "Operating Systems", facultyId: "FAC002", sectionSize: 75, department: "Computer Science" },
  { code: "CS-401", name: "Artificial Intelligence", facultyId: "FAC001", sectionSize: 50, department: "Computer Science" },
  
  // Electronics & Communication Department
  { code: "EC-101", name: "Basic Electronics", facultyId: "FAC003", sectionSize: 110, department: "Electronics & Comm." },
  { code: "EC-101-LAB", name: "Basic Electronics Lab", facultyId: "FAC003", sectionSize: 55, department: "Electronics & Comm." },
  { code: "EC-201", name: "Digital System Design", facultyId: "FAC003", sectionSize: 80, department: "Electronics & Comm." },
  { code: "EC-201-LAB", name: "Digital System Design Lab", facultyId: "FAC004", sectionSize: 40, department: "Electronics & Comm." },
  { code: "EC-301", name: "Microprocessors & Microcontrollers", facultyId: "FAC004", sectionSize: 70, department: "Electronics & Comm." },
  { code: "EC-401", name: "Wireless Communication", facultyId: "FAC004", sectionSize: 45, department: "Electronics & Comm." },

  // Mechanical Engineering Department
  { code: "ME-101", name: "Engineering Mechanics", facultyId: "FAC005", sectionSize: 130, department: "Mechanical Eng." },
  { code: "ME-101-LAB", name: "Engineering Mechanics Lab", facultyId: "FAC005", sectionSize: 65, department: "Mechanical Eng." },
  { code: "ME-201", name: "Thermodynamics", facultyId: "FAC005", sectionSize: 95, department: "Mechanical Eng." },
  { code: "ME-301", name: "Fluid Mechanics", facultyId: "FAC006", sectionSize: 80, department: "Mechanical Eng." },
  { code: "ME-401", name: "Computer Aided Design (CAD)", facultyId: "FAC006", sectionSize: 40, department: "Mechanical Eng." },
  { code: "ME-401-LAB", name: "Computer Aided Design (CAD) Lab", facultyId: "FAC006", sectionSize: 40, department: "Mechanical Eng." },

  // Basic Sciences Department (Physics / Maths / Chemistry)
  { code: "BS-101", name: "Engineering Physics", facultyId: "FAC007", sectionSize: 150, department: "Basic Sciences" },
  { code: "BS-101-LAB", name: "Engineering Physics Lab", facultyId: "FAC007", sectionSize: 75, department: "Basic Sciences" },
  { code: "BS-102-S1", name: "Calculus & Linear Algebra (Sec A)", facultyId: "FAC008", sectionSize: 80, department: "Basic Sciences" },
  { code: "BS-102-S2", name: "Calculus & Linear Algebra (Sec B)", facultyId: "FAC008", sectionSize: 80, department: "Basic Sciences" },
  { code: "BS-201", name: "Discrete Mathematics", facultyId: "FAC008", sectionSize: 90, department: "Basic Sciences" },

  // Humanities Department (English, Ethics)
  { code: "HU-101", name: "Technical Communication", facultyId: "FAC009", sectionSize: 140, department: "Humanities & Social Sciences" },
  { code: "HU-101-LAB", name: "Technical Communication Lab", facultyId: "FAC009", sectionSize: 40, department: "Humanities & Social Sciences" },
  { code: "HU-201", name: "Professional Ethics", facultyId: "FAC010", sectionSize: 110, department: "Humanities & Social Sciences" },
  
  // Cross-disciplinary courses (shows faculty teaching across departments)
  { code: "CS-EC-305", name: "Embedded Systems", facultyId: "FAC003", sectionSize: 60, department: "Computer Science" },
  { code: "ME-CS-410", name: "Robotics & Automation", facultyId: "FAC006", sectionSize: 35, department: "Mechanical Eng." }
];

export const ACADEMIC_CALENDAR = {
  semesterName: "Autumn Semester 2026",
  startDate: "2026-07-20",
  endDate: "2026-11-30",
  holidays: [
    { date: "2026-08-15", name: "Independence Day" },
    { date: "2026-09-05", name: "Janmashtami" },
    { date: "2026-10-02", name: "Gandhi Jayanti" },
    { date: "2026-10-19", name: "Dussehra" },
    { date: "2026-11-08", name: "Diwali" },
    { date: "2026-11-14", name: "Guru Nanak Jayanti" }
  ],
  workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  timeSlots: [
    "08:00 - 09:00",
    "09:00 - 10:00",
    "10:00 - 11:00",
    "11:00 - 12:00",
    "12:00 - 13:00",
    "13:00 - 14:00", // Lunch hour usually, but slot exists
    "14:00 - 15:00",
    "15:00 - 16:00",
    "16:00 - 17:00",
    "17:00 - 18:00"
  ]
};

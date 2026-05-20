// ─── Training Quiz Data ───────────────────────────────────────────────────────

export interface QuizQuestion {
  id: string
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

export interface CourseQuiz {
  courseId: string
  passingScore: number  // 80 = 80%
  maxAttempts: number   // 3
  questions: QuizQuestion[]
}

export const QUIZZES: CourseQuiz[] = [
  {
    courseId: 'low-voltage-fundamentals',
    passingScore: 80,
    maxAttempts: 3,
    questions: [
      {
        id: 'lvf-q1',
        question: 'What is the standard voltage range for Class 2 low voltage wiring?',
        options: ['12-24V AC/DC', '50-150V', '0-30V DC only', '24-48V AC only'],
        correctIndex: 0,
        explanation: 'NEC Class 2 circuits are limited to 100VA and typically operate at 12-24V AC/DC.',
      },
      {
        id: 'lvf-q2',
        question: 'When measuring AC voltage with a multimeter, which selector setting should you use?',
        options: ['DCV', 'ACV', 'Ω', 'mA'],
        correctIndex: 1,
        explanation: 'ACV (AC Voltage) is the correct mode. Using DCV on an AC circuit gives a wrong reading and can damage the meter.',
      },
      {
        id: 'lvf-q3',
        question: 'A Brivo ACS300 access controller shows a solid red LED. What does this indicate?',
        options: ['Normal operation', 'No network connection', 'Door held open too long', 'Tamper detected'],
        correctIndex: 1,
        explanation: 'A solid red LED on the ACS300 indicates no network connection. Check the Ethernet cable and router/switch connectivity.',
      },
      {
        id: 'lvf-q4',
        question: 'What is the maximum recommended cable run for a 12V DC access control device on 22AWG wire?',
        options: ['50 feet', '150 feet', '500 feet', '1000 feet'],
        correctIndex: 1,
        explanation: '150 feet is the maximum practical run on 22AWG at 12VDC before voltage drop causes device malfunctions. For longer runs, use 18AWG or increase supply voltage to 24VDC.',
      },
      {
        id: 'lvf-q5',
        question: 'Which terminal on a relay output is the common (COM) connection?',
        options: ['NO', 'NC', 'COM', 'GND'],
        correctIndex: 2,
        explanation: 'COM (Common) is the shared terminal of a relay output. NO (Normally Open) and NC (Normally Closed) connect to COM to complete the circuit when the relay is triggered.',
      },
      {
        id: 'lvf-q6',
        question: 'A voltage reading of 0V DC on a powered access controller input suggests:',
        options: ['Normal standby', 'Input is active/triggered', 'Open circuit or wiring fault', 'Overvoltage condition'],
        correctIndex: 2,
        explanation: '0V on a circuit that should have voltage indicates an open circuit — broken wire, loose terminal, blown fuse, or failed power supply. Trace back to the source systematically.',
      },
      {
        id: 'lvf-q7',
        question: 'The T568B wiring standard uses which color for Pin 1?',
        options: ['Blue', 'Orange/White', 'Green/White', 'Brown'],
        correctIndex: 1,
        explanation: 'T568B Pin 1 is Orange/White. This is the most commonly used standard in commercial installations. T568A uses Green/White for Pin 1.',
      },
      {
        id: 'lvf-q8',
        question: 'What tool is used to verify continuity in a 2-wire series circuit?',
        options: ['Voltage meter only', 'Multimeter in continuity/Ω mode', 'Clamp meter', 'Oscilloscope'],
        correctIndex: 1,
        explanation: 'A multimeter set to continuity (or Ω) mode is used for continuity testing. The meter beeps when the circuit is complete. Always de-energize the circuit before testing resistance.',
      },
    ],
  },
  {
    courseId: 'ladder-jobsite-safety',
    passingScore: 80,
    maxAttempts: 3,
    questions: [
      {
        id: 'ls-q1',
        question: 'What is the correct angle ratio for setting up an extension ladder?',
        options: [
          '1:2 (1 foot out per 2 feet high)',
          '1:4 (1 foot out per 4 feet high)',
          '1:6 ratio',
          'Any angle is acceptable with stabilizers',
        ],
        correctIndex: 1,
        explanation: 'The 4:1 rule: for every 4 feet of vertical height, move the base 1 foot away from the wall. A 16-foot working height requires the base 4 feet from the wall.',
      },
      {
        id: 'ls-q2',
        question: "The '3-point contact' rule means:",
        options: [
          'Three tools in hand at all times',
          'Two hands and one foot, or two feet and one hand on the ladder',
          'Three people hold the base',
          'Use three ladder clips',
        ],
        correctIndex: 1,
        explanation: 'Three points of contact means two hands + one foot, OR two feet + one hand on the ladder at all times. Never carry tools in your hands while climbing.',
      },
      {
        id: 'ls-q3',
        question: 'Maximum load rating for a Type IA ladder is:',
        options: ['200 lbs', '225 lbs', '250 lbs', '300 lbs'],
        correctIndex: 3,
        explanation: 'Type IA (Extra Heavy Duty) is rated for 300 lbs. This is the correct rating when carrying heavy tools or equipment on a commercial job site.',
      },
      {
        id: 'ls-q4',
        question: 'When should you NEVER use an aluminum ladder?',
        options: ['In wet conditions', 'Near electrical hazards', 'On soft ground', 'In cold weather'],
        correctIndex: 1,
        explanation: 'Aluminum conducts electricity. Never use an aluminum ladder near electrical hazards, overhead power lines, or energized panels. Use a fiberglass ladder in all electrical work environments.',
      },
      {
        id: 'ls-q5',
        question: 'A ladder should extend at least ___ above the landing point at roof/edge access.',
        options: ['1 foot', '2 feet', '3 feet', '5 feet'],
        correctIndex: 2,
        explanation: 'Extension ladders must extend 3 feet above the landing point when used to access a roof or elevated platform. This provides a safe handhold when stepping on and off.',
      },
      {
        id: 'ls-q6',
        question: 'What does OSHA require when working from a ladder above 4 feet?',
        options: [
          'Hard hat only',
          'Fall protection or ladder safety system',
          'A spotter at the base',
          'Written permit',
        ],
        correctIndex: 1,
        explanation: 'OSHA 1926.1053 requires fall protection or a ladder safety system when working above 4 feet. Spotters are good practice but do not replace fall protection requirements.',
      },
      {
        id: 'ls-q7',
        question: 'Ladder rungs should be inspected for:',
        options: [
          'Color fading only',
          'Cracks, bends, loose fasteners, and slippery surfaces',
          'Age markings',
          'Brand labels',
        ],
        correctIndex: 1,
        explanation: 'Before every use, inspect rungs for cracks, bends, loose fasteners, and slippery surfaces. A damaged ladder must be tagged out immediately and removed from service.',
      },
      {
        id: 'ls-q8',
        question: 'Which ladder type is designed for use as both a straight and stepladder?',
        options: ['Type I', 'Extension ladder', 'Combination ladder', 'Platform ladder'],
        correctIndex: 2,
        explanation: 'A combination (articulating) ladder can be configured as a stepladder, extension ladder, staircase ladder, or scaffold base. Versatile but ensure each configuration is locked securely before use.',
      },
    ],
  },
  {
    courseId: 'ul325-gate-safety',
    passingScore: 80,
    maxAttempts: 3,
    questions: [
      {
        id: 'ul-q1',
        question: 'UL 325 requires how many independent entrapment protection devices on a commercial (Class II) swing gate?',
        options: ['One', 'Two', 'Three', 'None required for swing gates'],
        correctIndex: 1,
        explanation: 'Class II requires a minimum of TWO independent entrapment protection devices per protected zone. A single device alone does not meet Class II requirements.',
      },
      {
        id: 'ul-q2',
        question: 'A Type D entrapment protection zone covers:',
        options: [
          'The leading edge of the gate',
          'The trailing edge only',
          'The area between the gate and a fixed object more than 2 inches away',
          'The motor housing',
        ],
        correctIndex: 2,
        explanation: 'Zone D (Zone 7 in UL 325 terms) covers any pinch point between a moving gate and a fixed structure — specifically gaps larger than 2 inches where a person could be trapped.',
      },
      {
        id: 'ul-q3',
        question: 'What is the maximum force allowed at the leading edge of a vehicular gate under UL 325?',
        options: ['25 lbs', '40 lbs', '50 lbs', '100 lbs'],
        correctIndex: 2,
        explanation: 'UL 325 limits contact force at the leading edge to 50 lbs (223N). This is the auto-reverse threshold — the operator must reverse before exceeding this force.',
      },
      {
        id: 'ul-q4',
        question: 'A photoelectric sensor used as the primary entrapment protection on a swing gate must:',
        options: [
          'Be mounted at bumper height only',
          'Cover the full arc of travel',
          'Only monitor the last 12 inches of travel',
          'Be tested annually',
        ],
        correctIndex: 1,
        explanation: 'A photo eye used as primary protection must cover the full arc of gate travel to detect entrapment at any point. Mounting it to cover only part of the travel path does not provide full protection.',
      },
      {
        id: 'ul-q5',
        question: 'Residential vs. commercial gate operators: UL 325 defines commercial as a location used by:',
        options: [
          'More than 50 vehicles per day',
          'The general public or a business',
          'Properties with more than 10 units',
          'Any property with a paid operator',
        ],
        correctIndex: 1,
        explanation: 'UL 325 Class II (commercial) applies to locations used by the general public or a business — including multifamily properties, parking facilities, schools, and office buildings.',
      },
      {
        id: 'ul-q6',
        question: 'A contact-based edge sensor (Type A) must be positioned:',
        options: [
          'On the fixed post',
          'On the leading edge of the gate',
          'On the gate motor',
          'On the access controller',
        ],
        correctIndex: 1,
        explanation: 'A contact-based safety edge (sensing edge) must be mounted on the leading edge of the gate — the first point of potential contact with a person or vehicle in the gate path.',
      },
      {
        id: 'ul-q7',
        question: 'Under UL 325, loop detectors used for entrapment protection must:',
        options: [
          'Be the only safety device',
          'Activate within 2 seconds of vehicle detection',
          'Be monitored for proper function and trigger gate reversal on fault',
          'Only be used on slide gates',
        ],
        correctIndex: 2,
        explanation: 'UL 325 requires monitored entrapment devices to self-report their operational status. A loop detector must prevent gate closure when a vehicle is detected AND trigger reversal if the detector fails or loses power.',
      },
      {
        id: 'ul-q8',
        question: 'The UL 325 label on a gate operator signifies:',
        options: [
          'The product passed aesthetic review',
          'The product was tested and certified to meet entrapment protection and performance standards',
          'The product is registered with the state',
          'The installer is UL certified',
        ],
        correctIndex: 1,
        explanation: 'The UL 325 listing mark on an operator means it was independently tested and certified to meet all entrapment protection, construction, and performance requirements of the standard.',
      },
    ],
  },
]

export function getQuizForCourse(courseId: string): CourseQuiz | undefined {
  return QUIZZES.find(q => q.courseId === courseId)
}

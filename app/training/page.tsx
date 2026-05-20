'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  GraduationCap, ChevronDown, ChevronRight, CheckCircle2, Clock,
  Award, Lock, PlayCircle, Loader2, Download, FileText, Star,
} from 'lucide-react'
const { BookOpen, Shield, AlertTriangle } = require('lucide-react') as any
import { SlideOver } from '@/components/ui/SlideOver'
import { getQuizForCourse, type QuizQuestion } from '@/lib/training-quizzes'

// ─── Types ────────────────────────────────────────────────────────────────────

type ProgressMap = Record<string, Record<string, boolean>>

interface CertRecord {
  courseId: string
  courseTitle: string
  score: number
  earnedAt: string   // ISO string
  certId: string
}

// localStorage key for quiz state
const ATTEMPTS_KEY = 'gg_quiz_attempts'   // { [courseId]: number }
const CERTS_KEY    = 'gg_quiz_certs'      // CertRecord[]

// ─── Course Data ──────────────────────────────────────────────────────────────

const COURSES = [
  {
    id: 'low-voltage-fundamentals',
    title: 'Low Voltage Electrical Fundamentals',
    category: 'Technical',
    level: 'Foundation',
    duration: '2.5 hrs',
    modules: 7,
    status: 'available',
    badgeColor: 'bg-blue-100 text-blue-700',
    prerequisiteId: null as string | null,
    description: 'Core electrical concepts every field technician must know before touching access control, gate, or camera equipment. Covers Ohm\'s Law, AC/DC power, wiring diagrams, multimeter use, and circuit protection.',
    chapters: [
      {
        id: 'c1',
        title: 'Voltage, Current, and Resistance',
        duration: '18 min',
        content: [
          { type: 'concept', text: 'Voltage (V) is electrical pressure — the force that pushes electrons through a conductor. Measured in Volts.' },
          { type: 'concept', text: 'Current (I) is the flow rate of electrons through a circuit. Measured in Amperes (A or mA for milliamps).' },
          { type: 'concept', text: 'Resistance (R) opposes current flow. Measured in Ohms (Ω).' },
          { type: 'formula', text: 'Ohm\'s Law: V = I × R  |  I = V ÷ R  |  R = V ÷ I' },
          { type: 'example', text: 'A 12VDC relay coil with 240Ω resistance draws: I = 12 ÷ 240 = 0.05A (50mA). This tells you the power supply must be rated above 50mA for that circuit.' },
          { type: 'tip', text: 'Field shortcut: If you measure 0V at a terminal that should have power, trace back to the source — the problem is either a blown fuse, open circuit, or failed power supply.' },
        ],
      },
      {
        id: 'c2',
        title: 'AC vs DC Power in Access Control Systems',
        duration: '20 min',
        content: [
          { type: 'concept', text: 'DC (Direct Current) flows in one direction. Used by access control boards, readers, locks, and sensors. Common voltages: 5V, 12V, 24V.' },
          { type: 'concept', text: 'AC (Alternating Current) reverses direction at 60Hz (in the US). Used for gate operator motors and transformer primaries. Standard: 120VAC at the wall.' },
          { type: 'warning', text: '120VAC is lethal. Never measure or work on AC power circuits without a licensed electrician if you are not qualified. Gate operators have AC terminals — these are labeled clearly and should be treated with extreme caution.' },
          { type: 'concept', text: 'Most access control equipment is powered by a low-voltage transformer or switching power supply that converts 120VAC to 12VDC or 24VDC. This is the safe working voltage range for field techs.' },
          { type: 'example', text: 'DoorKing 6050: J1 terminals (L, N, G) are 120VAC — electrician territory. J3 terminals (+12V, GND) are 12VDC output — safe for powering readers, photobeams, and accessories.' },
          { type: 'tip', text: 'Always set your multimeter to the correct mode before measuring. AC and DC are different settings. Measuring DC voltage on an AC circuit gives a wrong reading and can damage the meter.' },
        ],
      },
      {
        id: 'c3',
        title: 'Reading Wiring Diagrams and Schematics',
        duration: '22 min',
        content: [
          { type: 'concept', text: 'A wiring diagram shows physical connections between components. A schematic shows circuit logic using symbols.' },
          { type: 'concept', text: 'Terminal blocks are identified by a connector label (J1, J2, TB1, P3) and pin labels (L, N, COM, NO, NC, +12V, GND). Always read the board silk-screen for exact labels.' },
          { type: 'concept', text: 'N.O. (Normally Open): circuit is open (broken) at rest. Closes when triggered. Used for gate open/close inputs and reader relay outputs.' },
          { type: 'concept', text: 'N.C. (Normally Closed): circuit is closed (connected) at rest. Opens when triggered. Used for safety loops — photobeams and door contacts.' },
          { type: 'example', text: 'Photobeam wired to a gate operator: TX sends beam to RX. When beam is clear, RX output is closed (N.C.) — completing the safety loop at the operator. When beam breaks, contact opens — operator stops or reverses.' },
          { type: 'tip', text: 'When a gate won\'t move and safety inputs are suspect, use the GateGuard /tech tool — it will guide you through the isolation test: jumper the obstruction terminals to bypass the safety device and confirm whether the operator runs.' },
        ],
      },
      {
        id: 'c4',
        title: 'Wire Gauges, Types, and Selection',
        duration: '18 min',
        content: [
          { type: 'concept', text: 'Wire gauge (AWG — American Wire Gauge) indicates thickness. Lower AWG = thicker wire = lower resistance = handles more current.' },
          { type: 'formula', text: 'Common gauges in access control:\n• 18 AWG — dry contact runs (gate triggers, door contacts, relay outputs). Safe to 16A max.\n• 22 AWG — low-current signals (reader data lines, LED, buzzer). Keep runs under 500 ft.\n• CAT5e/CAT6 — Wiegand readers, RS-485 buses, network/IP cameras.' },
          { type: 'warning', text: 'Never use undersized wire for current-carrying applications. Undersized wire heats up, degrades insulation, and can cause intermittent faults or fires.' },
          { type: 'concept', text: 'Shielded cable reduces interference. Use shielded twisted pair for Wiegand reader runs and RS-485 in electrically noisy environments (near motors, transformers, fluorescent lighting).' },
          { type: 'tip', text: 'Always label both ends of every wire run at installation. A 15-minute investment at install saves hours of tracing faults later.' },
        ],
      },
      {
        id: 'c5',
        title: 'Using a Multimeter in the Field',
        duration: '25 min',
        content: [
          { type: 'concept', text: 'A digital multimeter (DMM) measures voltage (VAC/VDC), resistance (Ω), and continuity. Some models measure current (A/mA) and frequency (Hz).' },
          { type: 'concept', text: 'Probe placement: Red probe → positive terminal or V/Ω jack. Black probe → negative terminal or COM jack. Never connect the red probe to the A (current) jack for voltage measurements.' },
          { type: 'formula', text: 'Key measurements:\n• DC Voltage: set to VDC, measure + and − terminals. Expected: 12V ± 1V or 24V ± 2V for most access control.\n• AC Voltage: set to VAC, measure L to N. Expected: 115–125VAC at the operator.\n• Continuity: set to continuity/diode mode. Meter beeps = circuit is closed (connected).\n• Resistance: power OFF circuit first. Measures Ω across a component or wire run.' },
          { type: 'warning', text: 'NEVER measure resistance on a live circuit. Always de-energize before taking resistance readings. Measuring Ω with power on will destroy the meter and can injure you.' },
          { type: 'example', text: 'Testing a door contact: set meter to continuity. Door closed → meter beeps (N.C. contact is closed). Door open → no beep (contact opened). If door is closed but no beep, contact is faulty.' },
          { type: 'tip', text: 'The GateGuard /tech tool shows you exactly which function to select on the meter and what value to expect — including a visual of the meter dial position — for every measure step in a diagnostic session.' },
        ],
      },
      {
        id: 'c6',
        title: 'Common Terminal Types and Connector Blocks',
        duration: '15 min',
        content: [
          { type: 'concept', text: 'Screw terminal blocks: most common in gate operators and access controllers. Loosen screw, insert stripped wire (1/4"), tighten. Use proper screwdriver — overtightening strips the terminal.' },
          { type: 'concept', text: 'Spring/cage clamp terminals: push a flathead into the release port, insert wire, release. Faster than screw terminals and more vibration-resistant.' },
          { type: 'concept', text: 'Connector labels: J = header connector (J1, J2...), TB = terminal block (TB1...), P = plug (P3...). These letters match the board silk-screen and the manual wiring diagram.' },
          { type: 'tip', text: 'Always photograph the terminal block before disconnecting any wires. Before re-wiring, compare your work to the photo. Transposed wires are the #1 source of "it was working before" callbacks.' },
          { type: 'tip', text: 'Torque specs matter on larger conductors. For 18 AWG on access control boards, finger-tight plus 1/4 turn is appropriate. Loose connections cause intermittent faults that are very difficult to trace.' },
        ],
      },
      {
        id: 'c7',
        title: 'Fuses, Breakers, and Circuit Protection',
        duration: '12 min',
        content: [
          { type: 'concept', text: 'A fuse is a one-time overcurrent protection device. When current exceeds the fuse rating, the fuse element melts and breaks the circuit. Must be replaced after blowing.' },
          { type: 'concept', text: 'A circuit breaker is a resettable overcurrent protection device. Trips on overload. Can be reset once the fault is cleared.' },
          { type: 'warning', text: 'Never replace a fuse with a higher-rated fuse or bypass it with wire. The fuse protects the equipment and wiring — bypassing it trades a blown fuse for a fire or destroyed board.' },
          { type: 'example', text: 'A DoorKing operator with a blown 15A fuse: first find out WHY it blew. Check for a shorted accessory, damaged wiring, or a locked/stalled motor. Replace the fuse after fixing the root cause — not before.' },
          { type: 'tip', text: 'Carry an assortment of automotive blade fuses (5A, 10A, 15A, 20A) and glass tube fuses. Most gate operator boards use one of these types. Check the board label for the correct rating.' },
        ],
      },
    ],
  },
  {
    id: 'ladder-jobsite-safety',
    title: 'Ladder Safety & Jobsite Safety',
    category: 'Safety',
    level: 'Foundation',
    duration: '1.5 hrs',
    modules: 6,
    status: 'available',
    badgeColor: 'bg-amber-100 text-amber-700',
    prerequisiteId: null as string | null,
    description: 'OSHA-aligned safety fundamentals for field technicians working at height, near live electrical systems, and on commercial job sites. Required foundation for all GateGuard certified field techs.',
    chapters: [
      {
        id: 's1',
        title: 'Ladder Types and Selection',
        duration: '15 min',
        content: [
          { type: 'concept', text: 'Step ladders: self-supporting A-frame. Use for work under 10 ft where you cannot lean the ladder against a surface. Never stand on the top cap or top step.' },
          { type: 'concept', text: 'Extension ladders: non-self-supporting, must lean against a stable surface. Used for gate operator access, camera mounting, and elevated panel work.' },
          { type: 'concept', text: 'Work platform (scaffold): best for extended work at height. Stable, hands-free, rated for tools and materials.' },
          { type: 'formula', text: 'Ladder duty ratings:\n• Type III (Light Duty): 200 lb max — household use only, never on a job site.\n• Type II (Medium Duty): 225 lb max — light commercial.\n• Type I (Heavy Duty): 250 lb max — industrial/commercial, recommended for field work.\n• Type IA (Extra Heavy Duty): 300 lb max — required when carrying heavy tools or equipment.' },
          { type: 'tip', text: 'Always select a ladder rated for your body weight PLUS the weight of your tools and equipment. A 180 lb tech with a 30 lb tool bag needs a ladder rated for 210+ lbs.' },
        ],
      },
      {
        id: 's2',
        title: 'Ladder Inspection and Setup',
        duration: '18 min',
        content: [
          { type: 'concept', text: 'Inspect before every use: check for bent rails, cracked rungs, missing feet, and damaged locks/spreaders. A damaged ladder must be tagged out and removed from service immediately.' },
          { type: 'formula', text: '4:1 Rule (extension ladders): for every 4 feet of vertical height, the base should be 1 foot away from the wall. A 16-foot working height requires the base 4 feet from the wall.' },
          { type: 'concept', text: 'Extension ladders must extend 3 feet above the landing point when used to access a roof or elevated platform.' },
          { type: 'concept', text: 'Both feet must be on a stable, level surface. On uneven ground, use leg levelers — never prop the ladder on objects. On soft ground, use a base plate to distribute the load.' },
          { type: 'warning', text: 'Never set up a ladder in front of a door that can open toward the ladder without locking or blocking the door first. A door swinging into an unsecured ladder is a serious fall hazard.' },
          { type: 'tip', text: 'On commercial sites with vehicle traffic, use spotters, cones, and barrier tape. Gate operator work near driveways requires traffic control — assume vehicles will not see you.' },
        ],
      },
      {
        id: 's3',
        title: 'Climbing and Working Safely',
        duration: '15 min',
        content: [
          { type: 'concept', text: 'Three points of contact at all times: two hands and one foot, or two feet and one hand. Never carry tools in your hands while climbing — use a tool belt or bucket hoist.' },
          { type: 'concept', text: 'Face the ladder when ascending and descending. Keep your body centered between the rails. Do not lean sideways — your belt buckle should never pass outside the rail.' },
          { type: 'warning', text: 'Maximum one person on a ladder at a time. Never have someone standing below you on the same ladder.' },
          { type: 'concept', text: 'Reach limit: do not overreach. If you cannot comfortably reach your work with your arm at full extension, move the ladder. Overreaching shifts your center of gravity past the rail — leading cause of ladder falls.' },
          { type: 'tip', text: 'For camera and intercom work above 8 feet, strongly consider a step platform or scaffold. Extended overhead work with tools is fatiguing and increases fall risk significantly.' },
        ],
      },
      {
        id: 's4',
        title: 'Personal Protective Equipment (PPE)',
        duration: '12 min',
        content: [
          { type: 'concept', text: 'Safety glasses or goggles: required any time you are drilling, cutting, or working with wire ends. Metal shards and plastic chips at eye level are a common field injury.' },
          { type: 'concept', text: 'Work gloves: protect against wire cuts, sharp sheet metal edges, and hot surfaces. Do not wear loose-fitting gloves near rotating equipment.' },
          { type: 'concept', text: 'Hard hat: required on active construction sites and when working below other trades. Gate operator installations often co-locate with active construction.' },
          { type: 'concept', text: 'High-visibility vest: required any time you are working in or near vehicle traffic. Gate entry work is almost always in a drive lane — wear your vest.' },
          { type: 'warning', text: 'Steel-toed boots are required on commercial job sites. Standard athletic or work shoes do not provide protection against dropped tools or equipment.' },
          { type: 'tip', text: 'GateGuard branded high-vis vest and safety kit will be available through the dealer supply program. Wearing GateGuard-branded PPE on site is also a marketing moment — residents and property managers see your team as professional.' },
        ],
      },
      {
        id: 's5',
        title: 'Working Near Electrical Hazards',
        duration: '15 min',
        content: [
          { type: 'concept', text: 'Lockout/Tagout (LOTO): before working on any equipment that could be energized, de-energize the circuit, lock out the breaker with a personal lock, and tag it. Confirm zero energy with your meter before touching terminals.' },
          { type: 'warning', text: 'NEVER assume a circuit is de-energized because someone told you it was off. Verify with your meter every time. Verify at the actual point of work, not at the panel.' },
          { type: 'concept', text: 'Electrical safe work distance: stay at least 3 feet from exposed energized conductors above 50V. Gate operator AC terminals are in this category.' },
          { type: 'concept', text: 'Arc flash: a rapid energy discharge from electrical equipment. Causes severe burns, blindness, and death. On commercial sites with 480V or higher service, arc flash PPE and a risk assessment are mandatory before opening any panel.' },
          { type: 'formula', text: 'For gate operator low-voltage field techs: the J1 AC terminals (120VAC) are the primary hazard. All other access control work (Brivo, readers, locks, photobeams) is 12–24VDC — low risk with basic precautions.' },
          { type: 'tip', text: 'When in doubt about the AC service to a gate operator enclosure, call a licensed electrician. The GateGuard tech support line is also available for guidance.' },
        ],
      },
      {
        id: 's6',
        title: 'Incident Reporting and Documentation',
        duration: '15 min',
        content: [
          { type: 'concept', text: 'Any injury, near-miss, or property damage on a job site must be reported immediately to your supervisor and documented. Near-misses are leading indicators of serious incidents — report them.' },
          { type: 'concept', text: 'OSHA recordable incidents: injuries that require medical treatment beyond first aid, result in lost work days, or involve loss of consciousness must be recorded on the OSHA 300 log.' },
          { type: 'concept', text: 'Incident documentation: date, time, location, what happened, who was involved, immediate corrective actions taken. Photograph the scene before any cleanup or repair.' },
          { type: 'tip', text: 'The GateGuard dealer portal (portal.gateguard.co) includes a work order system where field incidents can be documented and attached to the site record. This creates a paper trail that protects both the dealer and GateGuard in the event of a claim.' },
          { type: 'concept', text: 'If a property resident or bystander is injured during your work, do not make statements about fault or liability. Document the facts, provide first aid if trained, call emergency services if needed, and immediately notify your dealer principal and GateGuard.' },
        ],
      },
    ],
  },
  {
    id: 'ul325-gate-safety',
    title: 'UL 325 — Gate Operator Safety Standard',
    category: 'Safety',
    level: 'Foundation',
    duration: '2 hrs',
    modules: 6,
    status: 'available',
    badgeColor: 'bg-amber-100 text-amber-700',
    prerequisiteId: 'low-voltage-fundamentals' as string | null,
    description: 'The mandatory safety compliance standard governing all vehicular and pedestrian gate operator installations in the United States. Covers operator classification, entrapment protection zones, required devices, warning label placement, and the field testing procedure required at every install and service call.',
    chapters: [
      {
        id: 'ul1',
        title: 'What is UL 325 and Why It Applies to Every Install',
        duration: '15 min',
        content: [
          { type: 'concept', text: 'UL 325 is the Underwriters Laboratories safety standard for door, drapery, gate, louver, and window operators and systems. In the access control industry, it is the primary safety compliance standard governing all vehicular and pedestrian gate operators installed in the United States.' },
          { type: 'concept', text: 'The standard requires that every gate operator include entrapment protection — devices and systems that prevent people or objects from being trapped, crushed, or struck by a moving gate. Compliance is not optional. It is the legal baseline for every installation.' },
          { type: 'warning', text: '⚠ Liability: An operator installed without compliant entrapment protection is a liability for the dealer, the property owner, and can constitute criminal exposure if injury or death occurs. A non-compliant install is not a grey area — it is an uncorrected hazard.' },
          { type: 'concept', text: 'UL 325 applies to: vehicular slide gates, vehicular swing gates, vertical pivot/lift gates, barrier arm operators, and pedestrian swing gates with automated operators. If a motor moves a gate, UL 325 applies.' },
          { type: 'tip', text: 'Every GateGuard-installed operator must leave the site UL 325 compliant. If you arrive on a service call and the existing installation is non-compliant, document it, photograph it, and flag it to your dealer principal. Do not leave a known hazard uncorrected without a written record.' },
        ],
      },
      {
        id: 'ul2',
        title: 'Gate Operator Classes I – IV',
        duration: '18 min',
        content: [
          { type: 'concept', text: 'UL 325 classifies gate operators into four categories based on the type of access they control and who is expected to use them. The class determines the entrapment protection requirements.' },
          { type: 'formula', text: 'Operator Classes:\n• Class I — Residential vehicular gate operator. Single-family residence or estate. One to four families.\n• Class II — Commercial or general access vehicular gate operator. Multi-family (5+ units), business, parking facility, public facility, or school.\n• Class III — Industrial/limited access vehicular gate operator. Authorized employees, trucks, or vehicles only. Uninvited pedestrian access is not expected.\n• Class IV — Restricted access vehicular gate operator. Manned facility or supervised area where unauthorized access is actively prevented (prison, secured government, military).' },
          { type: 'example', text: 'The Hendrix (360-unit multifamily) vehicle entry gate → Class II. A single-family home with a driveway gate → Class I. A distribution warehouse with employee-only truck access → Class III.' },
          { type: 'warning', text: '⚠ Class II is more stringent than Class I. Multifamily properties, office parks, apartment communities, and condo developments are always Class II minimum. When the classification is unclear, classify UP — the more stringent standard protects you and the property.' },
          { type: 'tip', text: 'Class II requires a minimum of TWO entrapment protection devices per protected zone. This is the most commonly violated requirement on commercial installs. A single photo eye is not sufficient.' },
        ],
      },
      {
        id: 'ul3',
        title: 'Entrapment Protection Zones 1 – 8',
        duration: '22 min',
        content: [
          { type: 'concept', text: 'UL 325 defines 8 entrapment protection zones — specific areas around the gate travel path where a person could become trapped, pinched, or crushed. Each zone that presents an entrapment risk must be protected by at least one listed device.' },
          { type: 'formula', text: 'Zone Definitions:\n• Zone 1 — Leading edge in the direction of gate travel. Primary risk zone for all operators.\n• Zone 2 — Trailing edge of gate travel (the side moving away from the opening).\n• Zone 3 — Post, pillar, or wall adjacent to the leading edge.\n• Zone 4 — Post, pillar, or wall adjacent to the trailing edge.\n• Zone 5 — Bottom edge of the gate (vertical lift operators — pinch against ground).\n• Zone 6 — Between the panels of a bi-parting or folding gate.\n• Zone 7 — Any pinch point between a moving component and a stationary structure.\n• Zone 8 — Exposed moving mechanical components (drive chains, pinions, arms).' },
          { type: 'example', text: 'Standard residential slide gate (Class I): primary zones are 1 and 2 (leading and trailing edges). A pedestrian callbox post within 16 inches of the gate travel path creates a Zone 3 hazard — a safety edge or sensor must be mounted to protect that gap.' },
          { type: 'tip', text: 'Field technique: before selecting your entrapment protection devices, sketch the gate and mark every zone. Walk the full travel path — open to close — and physically identify each zone. A five-minute zone assessment at install prevents callbacks and liability.' },
          { type: 'concept', text: 'For a standard commercial slide gate, you primarily address Zones 1, 2, 3, and 4. Zone 5 applies to vertical operators. Zones 6, 7, and 8 apply to folding/bi-parting gates and operators with exposed mechanical drive components.' },
        ],
      },
      {
        id: 'ul4',
        title: 'Required Entrapment Protection Devices',
        duration: '25 min',
        content: [
          { type: 'concept', text: 'UL 325 requires entrapment protection devices to be listed (tested and certified) for use in vehicular gate applications. Using non-listed devices, or devices in configurations not specified by the operator manufacturer, voids compliance.' },
          { type: 'formula', text: 'Device Types:\n• Photoelectric beam (photo eye) — non-contact sensing. Beam broken → gate stops and reverses. PRIMARY device. Required on Zone 1 (leading edge) for all operators.\n• Safety edge / sensing edge — contact sensor strip. Pressure applied → gate stops and reverses. Can serve as PRIMARY or SECONDARY device.\n• Loop detector — inductive loop in pavement detects vehicles. Prevents gate from closing on a vehicle in the path. Counts as SECONDARY device. Does NOT protect pedestrians.\n• Monitored entrapment device — active sensor that reports its own operational status to the operator. Required on some operator models for Class II.\n• Obstruction auto-reverse — operator detects increased resistance (stall force) and reverses. SECONDARY only. Cannot be the sole protection device.' },
          { type: 'warning', text: '⚠ TWO-DEVICE MINIMUM for Class II: Every Class II installation must have a minimum of two independent entrapment protection devices per protected zone. A single photo eye alone does NOT meet Class II requirements. Minimum configuration: photo eye (primary) + safety edge or secondary contact device (secondary).' },
          { type: 'example', text: 'Compliant Class II slide gate: photo eyes mounted at vehicle height on Zone 1 (leading edge) + safety edge on Zone 2 (trailing edge) + loop detector in gate path. Three devices covering all primary zones.' },
          { type: 'tip', text: 'After activation of any entrapment protection device, the operator must require manual reset before resuming automatic close operation. If the gate auto-closes after a photo eye trip without manual reset, the operator is misconfigured. Correct it before sign-off.' },
        ],
      },
      {
        id: 'ul5',
        title: 'Warning Labels, Placards, and Installer Requirements',
        duration: '15 min',
        content: [
          { type: 'concept', text: 'UL 325 mandates specific warning labels be permanently attached to the operator housing and posted at the gate entry. Failure to install required placards makes the installation non-compliant regardless of device coverage.' },
          { type: 'formula', text: 'Required Labels:\n• Operator warning placard — affixed to the operator housing. Includes: entrapment hazard warning, emergency release instructions, "keep clear of gate" instruction, and diagram of entrapment zones.\n• Keep clear sign — posted at the gate entry/exit. Standard wording: "WARNING — MOVING GATE CAN CAUSE SEVERE INJURY OR DEATH — KEEP CLEAR OF MOVING GATE"\n• Emergency release label — on or immediately adjacent to the manual release mechanism (breakaway chain, key switch, or pull handle). Must be readable in darkness.\n• Installer identification — your company name and phone number must be permanently affixed to the operator. This is required by UL 325 and by most AHJs (Authorities Having Jurisdiction).' },
          { type: 'warning', text: '⚠ Your name goes on the operator. If an injury occurs after your installation and the site has no installer label, investigators will look at whoever last permitted or serviced the gate. Install the label. Every time.' },
          { type: 'example', text: 'DoorKing 6050 installation: DK ships the operator with the required UL 325 placard pre-installed. You still need to add the GateGuard installer label (supplied in your install kit) and post the "KEEP CLEAR" sign at the gate opening.' },
          { type: 'tip', text: 'Photograph all installed placards as part of your job closeout documentation. Upload to the work order in the GateGuard portal. If a placard is ever disputed, your photo timestamp proves compliance at time of installation.' },
        ],
      },
      {
        id: 'ul6',
        title: '7-Step Field Test Procedure — Every Install, Every Service Call',
        duration: '25 min',
        content: [
          { type: 'concept', text: 'After every installation and during every service visit where you touch a gate operator, you must verify that all entrapment protection devices are operational and that the operator responds correctly. Document the test in your work order.' },
          { type: 'formula', text: 'The 7-Step Field Test:\n\n1. VISUAL — Confirm all entrapment protection devices are mounted, connected, and showing correct status indicators (photo eye alignment LED, sensing edge indicator).\n\n2. PHOTO EYE — With gate in motion, break the beam. Gate must stop and reverse within 0.5 seconds. Test both directions of travel.\n\n3. SAFETY EDGE — Apply moderate hand pressure to the sensing edge surface. Gate must stop and reverse immediately on contact.\n\n4. LOOP DETECTOR — Activate loop input (manually or with a vehicle). Gate must not initiate close cycle while loop is active.\n\n5. AUTO-CLOSE TIMER — Confirm auto-close delay is set appropriately (typically 5–30 seconds). Gate must not remain open indefinitely.\n\n6. MANUAL RELEASE — Test emergency release mechanism. After release engagement, gate must be manually movable without power.\n\n7. RESET VERIFICATION — After any entrapment protection device activation, confirm operator requires manual reset before resuming auto-close. Gate should NOT auto-close after a photo eye or safety edge trip.' },
          { type: 'example', text: 'Step 2 failure scenario: photo eyes pass the beam test while gate is stationary, but you break the beam while the gate is in motion and the gate does not stop. This means the obstruction input is only checked in the closed/open state, not during travel — a common misconfiguration in older DoorKing units. DIP switch correction required.' },
          { type: 'warning', text: '⚠ Never sign off on an install without physically running all 7 steps. A visual inspection of wiring does not confirm a device is actually working. The test must be performed with the gate in motion.' },
          { type: 'tip', text: 'Leave a signed copy of the 7-step test result with the property manager or building engineer. "Passed UL 325 field test — [date] — [tech name] — GateGuard" on your work order is your proof of compliance. In litigation, documentation wins.' },
        ],
      },
    ],
  },
  {
    id: 'gateguard-platform',
    title: 'GateGuard Platform Certification',
    category: 'Platform',
    level: 'Dealer',
    duration: '4 hrs',
    modules: 8,
    status: 'coming-soon',
    badgeColor: 'bg-purple-100 text-purple-700',
    prerequisiteId: null as string | null,
    description: 'Full walkthrough of the dealer portal, /tech field tool, site survey, quoting workflow, and client portal. Required for GateGuard Certified Dealer status.',
    chapters: [],
  },
  {
    id: 'brivo-fundamentals',
    title: 'Brivo Access Control Fundamentals',
    category: 'Technical',
    level: 'Intermediate',
    duration: '3 hrs',
    modules: 6,
    status: 'coming-soon',
    badgeColor: 'bg-blue-100 text-blue-700',
    prerequisiteId: null as string | null,
    description: 'Brivo ACS300, ACS6100, and Brivo 100 installation, provisioning, and troubleshooting. Covers Wiegand wiring, door hardware, credential management, and PMS sync configuration.',
    chapters: [],
  },
]

// ─── Helper ───────────────────────────────────────────────────────────────────

function getAttemptsFromStorage(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(ATTEMPTS_KEY) ?? '{}') } catch { return {} }
}

function setAttemptsToStorage(data: Record<string, number>) {
  try { localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(data)) } catch {}
}

function getCertsFromStorage(): CertRecord[] {
  try { return JSON.parse(localStorage.getItem(CERTS_KEY) ?? '[]') } catch { return [] }
}

function saveCertToStorage(cert: CertRecord) {
  try {
    const existing = getCertsFromStorage()
    const filtered = existing.filter(c => c.courseId !== cert.courseId)
    localStorage.setItem(CERTS_KEY, JSON.stringify([...filtered, cert]))
  } catch {}
}

// ─── Content Block ────────────────────────────────────────────────────────────

function ContentBlock({ block }: { block: { type: string; text: string } }) {
  const styles: Record<string, string> = {
    concept: 'bg-slate-50 border-l-4 border-slate-300 text-slate-700',
    formula: 'bg-blue-50 border-l-4 border-blue-400 text-blue-900 font-mono text-sm',
    example: 'bg-emerald-50 border-l-4 border-emerald-400 text-emerald-800',
    warning: 'bg-red-50 border-l-4 border-red-400 text-red-800 font-medium',
    tip:     'bg-amber-50 border-l-4 border-amber-400 text-amber-800',
  }
  const labels: Record<string, string> = {
    concept: '',
    formula: '⌗ ',
    example: '▸ Example: ',
    warning: '⚠ Warning: ',
    tip:     '💡 Field Tip: ',
  }
  return (
    <div className={`px-4 py-3 rounded-r-lg text-sm leading-relaxed whitespace-pre-line ${styles[block.type] ?? styles.concept}`}>
      {labels[block.type]}{block.text}
    </div>
  )
}

// ─── Chapter Accordion ────────────────────────────────────────────────────────

function ChapterRow({
  chapter, courseId, isCompleted, onToggle, saving,
}: {
  chapter: typeof COURSES[0]['chapters'][0]
  courseId: string
  isCompleted: boolean
  onToggle: (courseId: string, chapterId: string, completed: boolean) => void
  saving: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={e => { e.stopPropagation(); onToggle(courseId, chapter.id, !isCompleted) }}
            className="shrink-0"
            disabled={saving}
          >
            {isCompleted
              ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              : <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
            }
          </button>
          <span className={`text-sm font-medium ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
            {chapter.title}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" /> {chapter.duration}
          </span>
          {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </div>
      </button>
      {open && (
        <div className="px-4 py-4 bg-gray-50 border-t border-gray-200 space-y-3">
          {chapter.content.map((block, i) => (
            <ContentBlock key={i} block={block} />
          ))}
          <div className="pt-2 flex justify-end">
            <button
              onClick={() => { onToggle(courseId, chapter.id, true); setOpen(false) }}
              disabled={isCompleted || saving}
              className="text-xs font-semibold text-white bg-[#6B7EFF] hover:bg-[#5a6fe0] px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {isCompleted ? '✓ Completed' : 'Mark Complete'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Quiz Engine ──────────────────────────────────────────────────────────────

function QuizEngine({
  courseId,
  courseTitle,
  open,
  onClose,
  onPass,
}: {
  courseId: string
  courseTitle: string
  open: boolean
  onClose: () => void
  onPass: (score: number, certId: string) => void
}) {
  const quiz = getQuizForCourse(courseId)
  const [currentQ, setCurrentQ]     = useState(0)
  const [selected,  setSelected]    = useState<number | null>(null)
  const [confirmed, setConfirmed]   = useState(false)
  const [answers,   setAnswers]     = useState<(number | null)[]>([])
  const [finished,  setFinished]    = useState(false)
  const [score,     setScore]       = useState(0)
  const [attempts,  setAttempts]    = useState(0)
  const [certId,    setCertId]      = useState('')

  // Reset when opened
  useEffect(() => {
    if (open && quiz) {
      setCurrentQ(0)
      setSelected(null)
      setConfirmed(false)
      setAnswers([])
      setFinished(false)
      setScore(0)
      setCertId('')
      const stored = getAttemptsFromStorage()
      setAttempts(stored[courseId] ?? 0)
    }
  }, [open, quiz, courseId])

  if (!quiz) return null

  const questions = quiz.questions
  const q: QuizQuestion = questions[currentQ]
  const totalQ = questions.length
  const passPct = quiz.passingScore
  const maxAttempts = quiz.maxAttempts

  function confirmAnswer() {
    if (selected === null) return
    setConfirmed(true)
  }

  function nextQuestion() {
    const newAnswers = [...answers, selected]
    if (currentQ < totalQ - 1) {
      setAnswers(newAnswers)
      setCurrentQ(c => c + 1)
      setSelected(null)
      setConfirmed(false)
    } else {
      // Finished
      const correct = newAnswers.filter((a, i) => a === questions[i].correctIndex).length
      const pct = Math.round((correct / totalQ) * 100)
      setScore(pct)
      setFinished(true)
      const stored = getAttemptsFromStorage()
      const newAttempts = (stored[courseId] ?? 0) + 1
      stored[courseId] = newAttempts
      setAttempts(newAttempts)
      setAttemptsToStorage(stored)

      if (pct >= passPct) {
        const id = `GG-CERT-${courseId.toUpperCase().replace(/-/g, '')}-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
        setCertId(id)
        onPass(pct, id)
      }
    }
  }

  function retake() {
    setCurrentQ(0)
    setSelected(null)
    setConfirmed(false)
    setAnswers([])
    setFinished(false)
    setScore(0)
    setCertId('')
  }

  const passed = finished && score >= passPct
  const failed  = finished && score < passPct
  const attemptsLeft = maxAttempts - attempts
  const maxedOut = failed && attemptsLeft <= 0

  const pctProgress = Math.round(((currentQ + (finished ? 1 : 0)) / totalQ) * 100)

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={courseTitle}
      subtitle="Final Exam"
      size="lg"
    >
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span>{finished ? 'Complete' : `Question ${currentQ + 1} of ${totalQ}`}</span>
          <span>{pctProgress}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#6B7EFF] rounded-full transition-all duration-300"
            style={{ width: `${pctProgress}%` }}
          />
        </div>
      </div>

      {/* Finished state */}
      {finished ? (
        <div className="flex flex-col items-center text-center py-8 gap-4">
          {passed ? (
            <>
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{score}%</div>
                <div className="text-sm text-gray-500">{Math.round(score / 100 * totalQ)}/{totalQ} correct</div>
              </div>
              <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 font-semibold px-4 py-2 rounded-full text-sm">
                <CheckCircle2 className="w-4 h-4" /> PASSED
              </span>
              <p className="text-gray-600 text-sm">Certificate Earned! Download it below.</p>
              <button
                onClick={() => {
                  const el = document.getElementById('certificate-print')
                  if (el) el.classList.remove('hidden')
                  window.print()
                  setTimeout(() => {
                    const el2 = document.getElementById('certificate-print')
                    if (el2) el2.classList.add('hidden')
                  }, 100)
                }}
                className="flex items-center gap-2 bg-[#6B7EFF] hover:bg-[#5a6fe0] text-white font-semibold px-6 py-2.5 rounded-xl transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Certificate
              </button>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-10 h-10 text-red-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{score}%</div>
                <div className="text-sm text-gray-500">{Math.round(score / 100 * totalQ)}/{totalQ} correct</div>
              </div>
              <span className="inline-flex items-center gap-1.5 bg-red-100 text-red-700 font-semibold px-4 py-2 rounded-full text-sm">
                FAILED — {passPct}% required to pass
              </span>
              {maxedOut ? (
                <p className="text-gray-600 text-sm max-w-sm">
                  Maximum attempts reached. Contact your administrator to reset.
                </p>
              ) : (
                <>
                  <p className="text-gray-600 text-sm">
                    You have <strong>{attemptsLeft}</strong> attempt{attemptsLeft !== 1 ? 's' : ''} remaining.
                  </p>
                  <button
                    onClick={retake}
                    className="bg-[#6B7EFF] hover:bg-[#5a6fe0] text-white font-semibold px-6 py-2.5 rounded-xl transition-colors"
                  >
                    Retake Exam
                  </button>
                </>
              )}
            </>
          )}
        </div>
      ) : (
        /* Active question */
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold text-[#6B7EFF] uppercase tracking-wide mb-2">
              Question {currentQ + 1} of {totalQ}
            </p>
            <h3 className="text-base font-semibold text-gray-900 leading-snug">{q.question}</h3>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {q.options.map((opt, i) => {
              let style = 'border-gray-200 bg-white hover:border-[#6B7EFF] hover:bg-[#6B7EFF]/5 cursor-pointer'
              if (selected === i && !confirmed) {
                style = 'border-[#6B7EFF] bg-[#6B7EFF]/10 cursor-pointer'
              }
              if (confirmed) {
                if (i === q.correctIndex) {
                  style = 'border-emerald-400 bg-emerald-50 cursor-default'
                } else if (i === selected && selected !== q.correctIndex) {
                  style = 'border-red-400 bg-red-50 cursor-default'
                } else {
                  style = 'border-gray-200 bg-white opacity-60 cursor-default'
                }
              }
              return (
                <div
                  key={i}
                  onClick={() => { if (!confirmed) setSelected(i) }}
                  className={`flex items-center gap-3 p-4 border-2 rounded-xl transition-all text-sm font-medium ${style}`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                    ${selected === i && !confirmed ? 'border-[#6B7EFF] bg-[#6B7EFF]' :
                      confirmed && i === q.correctIndex ? 'border-emerald-500 bg-emerald-500' :
                      confirmed && i === selected && selected !== q.correctIndex ? 'border-red-500 bg-red-500' :
                      'border-gray-300'}
                  `}>
                    {((selected === i && !confirmed) || (confirmed && (i === q.correctIndex || i === selected))) && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                  <span className={
                    confirmed && i === q.correctIndex ? 'text-emerald-800' :
                    confirmed && i === selected && selected !== q.correctIndex ? 'text-red-700' :
                    'text-gray-800'
                  }>
                    {opt}
                  </span>
                  {confirmed && i === q.correctIndex && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto shrink-0" />
                  )}
                </div>
              )
            })}
          </div>

          {/* Explanation */}
          {confirmed && (
            <div className={`p-4 rounded-xl text-sm leading-relaxed border-l-4 ${
              selected === q.correctIndex
                ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                : 'bg-red-50 border-red-400 text-red-800'
            }`}>
              <p className="font-semibold mb-1">{selected === q.correctIndex ? 'Correct!' : 'Incorrect'}</p>
              <p>{q.explanation}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            {!confirmed ? (
              <button
                onClick={confirmAnswer}
                disabled={selected === null}
                className="bg-[#6B7EFF] hover:bg-[#5a6fe0] text-white font-semibold px-6 py-2.5 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Confirm Answer
              </button>
            ) : (
              <button
                onClick={nextQuestion}
                className="flex items-center gap-2 bg-[#6B7EFF] hover:bg-[#5a6fe0] text-white font-semibold px-6 py-2.5 rounded-xl transition-colors"
              >
                {currentQ < totalQ - 1 ? 'Next Question' : 'See Results'}
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </SlideOver>
  )
}

// ─── Course Card ──────────────────────────────────────────────────────────────

function CourseCard({
  course,
  progress,
  onToggle,
  saving,
  onStartQuiz,
  quizPassed,
  attemptsUsed,
  isLocked,
  prerequisiteTitle,
}: {
  course: typeof COURSES[0]
  progress: ProgressMap
  onToggle: (courseId: string, chapterId: string, completed: boolean) => void
  saving: boolean
  onStartQuiz: (courseId: string) => void
  quizPassed: boolean
  attemptsUsed: number
  isLocked: boolean
  prerequisiteTitle: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const available = course.status === 'available'

  const courseProgress  = progress[course.id] ?? {}
  const completedCount  = course.chapters.filter(ch => courseProgress[ch.id]).length
  const totalChapters   = course.chapters.length
  const pct             = totalChapters > 0 ? Math.round((completedCount / totalChapters) * 100) : 0
  const courseComplete  = completedCount === totalChapters && totalChapters > 0
  const maxAttempts     = 3

  return (
    <div className={`bg-white rounded-2xl border ${available && !isLocked ? 'border-gray-200 shadow-sm' : 'border-gray-100'} overflow-hidden relative`}>
      {/* Locked overlay */}
      {isLocked && available && (
        <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] rounded-2xl z-10 flex flex-col items-center justify-center gap-2">
          <Lock className="w-8 h-8 text-gray-400" />
          <p className="text-sm font-medium text-gray-600 text-center px-6">
            Complete <strong>{prerequisiteTitle}</strong> first to unlock this course
          </p>
        </div>
      )}

      <div className={isLocked ? 'opacity-60' : ''}>
        {/* Header */}
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${course.badgeColor}`}>
                  {course.category}
                </span>
                <span className="text-xs text-gray-400 font-medium">{course.level}</span>
                {courseComplete && !quizPassed && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Chapters Complete
                  </span>
                )}
                {quizPassed && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#6B7EFF]/10 text-[#6B7EFF] flex items-center gap-1">
                    <Star className="w-3 h-3" /> Certified
                  </span>
                )}
              </div>
              <h3 className={`font-semibold text-lg leading-tight ${available && !isLocked ? 'text-gray-900' : 'text-gray-400'}`}>
                {course.title}
              </h3>
            </div>
            {(!available || isLocked) && <Lock className="w-5 h-5 text-gray-300 shrink-0 mt-1" />}
          </div>
          <p className={`text-sm leading-relaxed mb-4 ${available && !isLocked ? 'text-gray-600' : 'text-gray-400'}`}>
            {course.description}
          </p>
          <div className="flex items-center gap-5 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{course.duration}</span>
            <span className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" />{course.modules} modules</span>
            {available && !isLocked && !courseComplete && completedCount === 0 && (
              <span className="flex items-center gap-1.5 text-emerald-600 font-medium"><PlayCircle className="w-3.5 h-3.5" />Available now</span>
            )}
            {!available && <span className="text-amber-500 font-medium">Coming soon</span>}
            {available && !isLocked && completedCount > 0 && (
              <span className="text-[#6B7EFF] font-semibold">{completedCount}/{totalChapters} chapters · {pct}%</span>
            )}
            {available && !isLocked && attemptsUsed > 0 && !quizPassed && (
              <span className="text-amber-600 font-medium">{attemptsUsed}/{maxAttempts} exam attempts used</span>
            )}
          </div>
          {/* Progress bar */}
          {available && !isLocked && completedCount > 0 && (
            <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#6B7EFF] rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>

        {/* Take Final Exam button — shows when all chapters done */}
        {available && !isLocked && courseComplete && !quizPassed && attemptsUsed < maxAttempts && (
          <div className="px-6 pb-4">
            <button
              onClick={() => onStartQuiz(course.id)}
              className="w-full flex items-center justify-center gap-2 bg-[#6B7EFF] hover:bg-[#5a6fe0] text-white font-semibold py-3 rounded-xl transition-colors"
            >
              <Award className="w-4 h-4" />
              Take Final Exam
            </button>
          </div>
        )}

        {/* Max attempts reached */}
        {available && !isLocked && courseComplete && !quizPassed && attemptsUsed >= maxAttempts && (
          <div className="px-6 pb-4">
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-3 rounded-xl">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Maximum attempts reached. Contact your administrator to reset.
            </div>
          </div>
        )}

        {/* Certified state — show download button */}
        {available && !isLocked && quizPassed && (
          <div className="px-6 pb-4">
            <button
              onClick={() => {
                const el = document.getElementById('certificate-print')
                if (el) {
                  el.setAttribute('data-course', course.id)
                  el.classList.remove('hidden')
                }
                window.print()
                setTimeout(() => {
                  const el2 = document.getElementById('certificate-print')
                  if (el2) el2.classList.add('hidden')
                }, 100)
              }}
              className="flex items-center gap-2 text-sm text-[#6B7EFF] font-semibold hover:underline"
            >
              <Download className="w-4 h-4" />
              Download Certificate
            </button>
          </div>
        )}

        {/* Expand toggle */}
        {available && !isLocked && (
          <>
            <div className="px-6 pb-4">
              <button
                onClick={() => setExpanded(e => !e)}
                className="w-full flex items-center justify-between py-2.5 px-4 bg-gray-50 hover:bg-gray-100 rounded-xl text-sm font-medium text-gray-700 transition-colors"
              >
                <span>{expanded ? 'Hide' : 'View'} course content</span>
                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
            {expanded && (
              <div className="px-6 pb-6 space-y-2 border-t border-gray-100 pt-4">
                {course.chapters.map(ch => (
                  <ChapterRow
                    key={ch.id}
                    chapter={ch}
                    courseId={course.id}
                    isCompleted={!!courseProgress[ch.id]}
                    onToggle={onToggle}
                    saving={saving}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {!available && (
          <div className="px-6 pb-5">
            <div className="py-2.5 px-4 bg-gray-50 rounded-xl text-sm text-gray-400 text-center">
              Content in development — available Q3 2026
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Certificate View (print-only) ───────────────────────────────────────────

function CertificateView({ certs }: { certs: CertRecord[] }) {
  // We'll render the most recently earned cert (or the one whose courseId matches data-course attr)
  const cert = certs[certs.length - 1]
  if (!cert) return null

  return (
    <div
      id="certificate-print"
      className="hidden"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '11in',
        height: '8.5in',
        background: '#fff',
        fontFamily: 'Georgia, serif',
        padding: '0.75in',
        boxSizing: 'border-box',
        border: '12px double #6B7EFF',
        zIndex: 9999,
      }}
    >
      <style>{`
        @media print {
          body > * { display: none !important; }
          #certificate-print { display: block !important; position: static !important; }
        }
      `}</style>

      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4in' }}>
        <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#6B7EFF', fontFamily: 'Arial, sans-serif', letterSpacing: '0.05em' }}>
          GATEGUARD
        </div>
        {/* Circular seal */}
        <div style={{
          width: '100px', height: '100px', borderRadius: '50%',
          border: '4px double #6B7EFF', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', textAlign: 'center',
          color: '#6B7EFF', fontSize: '9px', fontWeight: 'bold', fontFamily: 'Arial, sans-serif',
          letterSpacing: '0.04em', gap: '2px',
        }}>
          <div style={{ fontSize: '18px' }}>★</div>
          <div>GATEGUARD</div>
          <div>CERTIFIED</div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ textAlign: 'center', marginTop: '0.1in' }}>
        <div style={{ fontSize: '13px', color: '#888', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.15in' }}>
          Certificate of Completion
        </div>
        <div style={{ fontSize: '13px', color: '#555', marginBottom: '0.12in' }}>
          This certifies that
        </div>
        <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#1a1a2e', marginBottom: '0.12in', fontStyle: 'italic' }}>
          GateGuard Technician
        </div>
        <div style={{ fontSize: '13px', color: '#555', marginBottom: '0.12in' }}>
          has successfully completed
        </div>
        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1a1a2e', marginBottom: '0.08in' }}>
          {cert.courseTitle}
        </div>
        <div style={{ fontSize: '13px', color: '#555', marginBottom: '0.3in' }}>
          with a passing score of <strong>{cert.score}%</strong>
        </div>

        {/* Dates row */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '2in', fontSize: '12px', color: '#555', marginBottom: '0.35in' }}>
          <div>
            <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>Issue Date</div>
            <div>{new Date(cert.earnedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
          <div>
            <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>Valid Through</div>
            <div>{new Date(new Date(cert.earnedAt).setFullYear(new Date(cert.earnedAt).getFullYear() + 1)).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
        </div>

        {/* Signature line */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '2in' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ borderTop: '1px solid #aaa', paddingTop: '6px', fontSize: '11px', color: '#555', width: '180px' }}>
              <div style={{ fontStyle: 'italic', fontSize: '16px', fontWeight: 'bold', color: '#1a1a2e', marginBottom: '2px' }}>
                GateGuard Training
              </div>
              Director of Training
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ position: 'absolute', bottom: '0.5in', left: 0, right: 0, textAlign: 'center', fontSize: '9px', color: '#aaa' }}>
        Certificate ID: {cert.certId} · portal.gateguard.co/training · rfeldman@gateguard.co
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TrainingPage() {
  const [progress,    setProgress]    = useState<ProgressMap>({})
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [quizCourse,  setQuizCourse]  = useState<string | null>(null)
  const [passedQuizzes, setPassedQuizzes] = useState<Record<string, boolean>>({})
  const [attemptsMap, setAttemptsMap] = useState<Record<string, number>>({})
  const [certs,       setCerts]       = useState<CertRecord[]>([])

  const loadProgress = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/training/progress')
      if (!res.ok) return
      const data = await res.json()
      const boolMap: ProgressMap = {}
      for (const [cid, chapters] of Object.entries(data.progress ?? {})) {
        boolMap[cid] = {}
        for (const chid of Object.keys(chapters as Record<string, string>)) {
          boolMap[cid][chid] = true
        }
      }
      // Also check for quiz completions (chapter_id = courseId + '_quiz')
      const passed: Record<string, boolean> = {}
      for (const [cid, chapters] of Object.entries(boolMap)) {
        if ((chapters as Record<string, boolean>)[`${cid}_quiz`]) {
          passed[cid] = true
        }
      }
      setPassedQuizzes(passed)
      setProgress(boolMap)
    } catch (_) { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    void loadProgress()
    // Load local state
    setAttemptsMap(getAttemptsFromStorage())
    const storedCerts = getCertsFromStorage()
    setCerts(storedCerts)
    // Check localStorage for passed quizzes too
    const stored = getCertsFromStorage()
    if (stored.length > 0) {
      const localPassed: Record<string, boolean> = {}
      stored.forEach(c => { localPassed[c.courseId] = true })
      setPassedQuizzes(prev => ({ ...localPassed, ...prev }))
    }
  }, [loadProgress])

  async function toggleChapter(courseId: string, chapterId: string, completed: boolean) {
    setProgress(p => ({
      ...p,
      [courseId]: { ...(p[courseId] ?? {}), [chapterId]: completed },
    }))
    setSaving(true)
    try {
      await fetch('/api/training/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: courseId, chapter_id: chapterId, completed }),
      })
    } catch (_) { /* silent */ }
    finally { setSaving(false) }
  }

  function handleQuizPass(courseId: string, score: number, certId: string) {
    const course = COURSES.find(c => c.id === courseId)
    if (!course) return

    const cert: CertRecord = {
      courseId,
      courseTitle: course.title,
      score,
      earnedAt: new Date().toISOString(),
      certId,
    }
    saveCertToStorage(cert)
    setCerts(prev => {
      const filtered = prev.filter(c => c.courseId !== courseId)
      return [...filtered, cert]
    })
    setPassedQuizzes(prev => ({ ...prev, [courseId]: true }))

    // Persist quiz pass to Supabase
    void fetch('/api/training/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ course_id: courseId, chapter_id: `${courseId}_quiz`, completed: true }),
    })
  }

  // Count stats
  const completedCourses = COURSES.filter(course => {
    if (course.status !== 'available' || !course.chapters.length) return false
    const cp = progress[course.id] ?? {}
    return course.chapters.every(ch => !!cp[ch.id])
  }).length

  const certifiedCourses = COURSES.filter(c => passedQuizzes[c.id]).length
  const totalAvailable   = COURSES.filter(c => c.status === 'available').length
  const totalChaptersDone = COURSES.reduce((sum, course) => {
    const cp = progress[course.id] ?? {}
    return sum + course.chapters.filter(ch => !!cp[ch.id]).length
  }, 0)

  // Build prerequisite map: courseId → is prerequisite satisfied
  const prereqSatisfied: Record<string, boolean> = {}
  COURSES.forEach(course => {
    if (!course.prerequisiteId) {
      prereqSatisfied[course.id] = true
    } else {
      const prereqProgress = progress[course.prerequisiteId] ?? {}
      const prereqCourse = COURSES.find(c => c.id === course.prerequisiteId)
      if (prereqCourse) {
        const allDone = prereqCourse.chapters.every(ch => !!prereqProgress[ch.id])
        prereqSatisfied[course.id] = allDone
      } else {
        prereqSatisfied[course.id] = true
      }
    }
  })

  return (
    <div className="p-8 max-w-5xl mx-auto">

      {/* Print CSS */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #certificate-print { display: block !important; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <GraduationCap className="w-7 h-7 text-[#6B7EFF]" />
            <h1 className="text-2xl font-bold text-gray-900">Training & Certification</h1>
          </div>
          <p className="text-gray-500 text-sm max-w-xl">
            Foundation courses for GateGuard authorized field technicians and dealers.
            Complete foundation tracks to unlock certification and advanced course access.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold text-[#6B7EFF] uppercase tracking-wide mb-1">Your Progress</div>
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin text-gray-300 ml-auto" />
          ) : (
            <>
              <div className="text-2xl font-bold text-gray-900">{completedCourses} / {totalAvailable}</div>
              <div className="text-xs text-gray-400">courses complete · {certifiedCourses} certified · {totalChaptersDone} chapters done</div>
            </>
          )}
        </div>
      </div>

      {/* Certification track banner */}
      <div className="bg-gradient-to-r from-[#6B7EFF]/10 to-purple-50 border border-[#6B7EFF]/20 rounded-2xl p-5 mb-8 flex items-center gap-5">
        <Award className="w-10 h-10 text-[#6B7EFF] shrink-0" />
        <div className="flex-1">
          <div className="font-semibold text-gray-900 mb-0.5">GateGuard Certified Field Technician</div>
          <div className="text-sm text-gray-500">
            Complete <strong>Low Voltage Fundamentals</strong> + <strong>Ladder & Jobsite Safety</strong> + <strong>UL 325 Gate Safety</strong> + <strong>GateGuard Platform</strong> to earn your certification badge.
            Certified techs are listed in the GateGuard dealer directory and unlock priority support access.
          </div>
        </div>
        {certifiedCourses > 0 && (
          <div className="shrink-0 text-center">
            <div className="text-3xl font-bold text-[#6B7EFF]">{certifiedCourses}</div>
            <div className="text-xs text-gray-500">cert{certifiedCourses !== 1 ? 's' : ''} earned</div>
          </div>
        )}
      </div>

      {/* My Certificates section */}
      {certs.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-[#6B7EFF]" />
            <h2 className="font-semibold text-gray-900">My Certificates</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {certs.map(cert => (
              <div key={cert.courseId} className="bg-[#6B7EFF]/5 border border-[#6B7EFF]/20 rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <FileText className="w-4 h-4 text-[#6B7EFF] shrink-0 mt-0.5" />
                  <span className="text-xs font-semibold bg-[#6B7EFF] text-white px-2 py-0.5 rounded-full">{cert.score}%</span>
                </div>
                <p className="text-sm font-semibold text-gray-800 leading-tight">{cert.courseTitle}</p>
                <p className="text-xs text-gray-500">
                  Earned {new Date(cert.earnedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                <button
                  onClick={() => {
                    // Set the cert to print
                    const updatedCerts = [...certs.filter(c => c.courseId !== cert.courseId), cert]
                    setCerts(updatedCerts)
                    const el = document.getElementById('certificate-print')
                    if (el) el.classList.remove('hidden')
                    window.print()
                    setTimeout(() => {
                      const el2 = document.getElementById('certificate-print')
                      if (el2) el2.classList.add('hidden')
                    }, 100)
                  }}
                  className="flex items-center gap-1.5 text-xs text-[#6B7EFF] font-semibold hover:underline mt-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Courses */}
      <div className="space-y-6">
        {COURSES.map(course => {
          const isLocked = course.prerequisiteId !== null && !prereqSatisfied[course.id]
          const prereqCourse = course.prerequisiteId ? COURSES.find(c => c.id === course.prerequisiteId) : null
          return (
            <CourseCard
              key={course.id}
              course={course}
              progress={progress}
              onToggle={toggleChapter}
              saving={saving}
              onStartQuiz={setQuizCourse}
              quizPassed={!!passedQuizzes[course.id]}
              attemptsUsed={attemptsMap[course.id] ?? 0}
              isLocked={isLocked}
              prerequisiteTitle={prereqCourse?.title ?? null}
            />
          )
        })}
      </div>

      {/* Footer note */}
      <div className="mt-10 p-4 bg-gray-50 rounded-xl text-sm text-gray-500 text-center">
        Additional certification tracks — Gate Operator Installation, Eagle Eye Camera Systems, Brivo Advanced Configuration — are in development.
        Dealers with questions about the certification program can contact{' '}
        <a href="mailto:support@gateguard.co" className="text-[#6B7EFF] hover:underline">support@gateguard.co</a>.
      </div>

      {/* Quiz SlideOver */}
      {quizCourse && (
        <QuizEngine
          courseId={quizCourse}
          courseTitle={COURSES.find(c => c.id === quizCourse)?.title ?? ''}
          open={!!quizCourse}
          onClose={() => {
            setQuizCourse(null)
            setAttemptsMap(getAttemptsFromStorage())
          }}
          onPass={(score, certId) => {
            handleQuizPass(quizCourse, score, certId)
          }}
        />
      )}

      {/* Certificate (print-only) */}
      <CertificateView certs={certs} />
    </div>
  )
}

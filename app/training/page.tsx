'use client'

import { useState } from 'react'
import { GraduationCap, ChevronDown, ChevronRight, CheckCircle2, Clock, BookOpen, Award, Lock, PlayCircle } from 'lucide-react'

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
        ]
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
        ]
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
        ]
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
        ]
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
        ]
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
        ]
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
        ]
      },
    ]
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
        ]
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
        ]
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
        ]
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
        ]
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
        ]
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
        ]
      },
    ]
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
    description: 'Full walkthrough of the dealer portal, /tech field tool, site survey, quoting workflow, and client portal. Required for GateGuard Certified Dealer status.',
    chapters: []
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
    description: 'Brivo ACS300, ACS6100, and Brivo 100 installation, provisioning, and troubleshooting. Covers Wiegand wiring, door hardware, credential management, and PMS sync configuration.',
    chapters: []
  },
]

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

function ChapterRow({ chapter, courseId }: { chapter: typeof COURSES[0]['chapters'][0]; courseId: string }) {
  const [open, setOpen] = useState(false)
  const [completed, setCompleted] = useState(false)

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={e => { e.stopPropagation(); setCompleted(c => !c) }}
            className="shrink-0"
          >
            {completed
              ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              : <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
            }
          </button>
          <span className={`text-sm font-medium ${completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
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
              onClick={() => { setCompleted(true); setOpen(false) }}
              className="text-xs font-semibold text-white bg-[#6B7EFF] hover:bg-[#5a6fe0] px-4 py-2 rounded-lg transition-colors"
            >
              Mark Complete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Course Card ──────────────────────────────────────────────────────────────

function CourseCard({ course }: { course: typeof COURSES[0] }) {
  const [expanded, setExpanded] = useState(false)
  const available = course.status === 'available'

  return (
    <div className={`bg-white rounded-2xl border ${available ? 'border-gray-200 shadow-sm' : 'border-gray-100'} overflow-hidden`}>
      {/* Header */}
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${course.badgeColor}`}>
                {course.category}
              </span>
              <span className="text-xs text-gray-400 font-medium">{course.level}</span>
            </div>
            <h3 className={`font-semibold text-lg leading-tight ${available ? 'text-gray-900' : 'text-gray-400'}`}>
              {course.title}
            </h3>
          </div>
          {!available && <Lock className="w-5 h-5 text-gray-300 shrink-0 mt-1" />}
        </div>
        <p className={`text-sm leading-relaxed mb-4 ${available ? 'text-gray-600' : 'text-gray-400'}`}>
          {course.description}
        </p>
        <div className="flex items-center gap-5 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{course.duration}</span>
          <span className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" />{course.modules} modules</span>
          {available && <span className="flex items-center gap-1.5 text-emerald-600 font-medium"><PlayCircle className="w-3.5 h-3.5" />Available now</span>}
          {!available && <span className="text-amber-500 font-medium">Coming soon</span>}
        </div>
      </div>

      {/* Expand toggle */}
      {available && (
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
                <ChapterRow key={ch.id} chapter={ch} courseId={course.id} />
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
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TrainingPage() {
  return (
    <div className="p-8 max-w-5xl mx-auto">

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
          <div className="text-2xl font-bold text-gray-900">0 / 4</div>
          <div className="text-xs text-gray-400">courses completed</div>
        </div>
      </div>

      {/* Certification track banner */}
      <div className="bg-gradient-to-r from-[#6B7EFF]/10 to-purple-50 border border-[#6B7EFF]/20 rounded-2xl p-5 mb-8 flex items-center gap-5">
        <Award className="w-10 h-10 text-[#6B7EFF] shrink-0" />
        <div>
          <div className="font-semibold text-gray-900 mb-0.5">GateGuard Certified Field Technician</div>
          <div className="text-sm text-gray-500">
            Complete <strong>Low Voltage Fundamentals</strong> + <strong>Ladder & Jobsite Safety</strong> + <strong>GateGuard Platform</strong> to earn your certification badge.
            Certified techs are listed in the GateGuard dealer directory and unlock priority support access.
          </div>
        </div>
      </div>

      {/* Courses */}
      <div className="space-y-6">
        {COURSES.map(course => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>

      {/* Footer note */}
      <div className="mt-10 p-4 bg-gray-50 rounded-xl text-sm text-gray-500 text-center">
        Additional certification tracks — Gate Operator Installation, Eagle Eye Camera Systems, Brivo Advanced Configuration — are in development.
        Dealers with questions about the certification program can contact <a href="mailto:support@gateguard.co" className="text-[#6B7EFF] hover:underline">support@gateguard.co</a>.
      </div>

    </div>
  )
}

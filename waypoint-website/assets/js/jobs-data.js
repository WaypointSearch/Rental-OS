/* ==========================================================================
   REPRESENTATIVE ROLE PROFILES — not live job postings.

   These describe the kinds of roles Waypoint recruits for, so the site
   looks active without publishing real clients or real openings.
   Candidates who click "Get matched" land on the resume form with the
   profile preselected.

   Before launch, sanity-check the "typical base" ranges against your own
   placement data. If you later want to publish live jobs, add them here
   (or swap this file for an ATS feed) using the same fields.

   Field reference
   - discipline: one of the keys in WAYPOINT_DISCIPLINES below
   - type:       typical engagement: "Direct Hire" | "Executive Search"
   - workplace:  typical arrangement: "On-site" | "Hybrid" | "Remote"
   - location:   where demand is strongest (region, not a specific office)
   - employer:   type of employer that typically hires this role
   - salaryMin:  annual USD used for sorting
   ========================================================================== */

window.WAYPOINT_DISCIPLINES = {
  mechanical: { label: "Mechanical", color: "#4fa3e0" },
  electrical: { label: "Electrical", color: "#f5b82e" },
  plumbing: { label: "Plumbing & Fire Protection", color: "#2bb8a3" },
  architecture: { label: "Architecture", color: "#8b7cf6" },
  structural: { label: "Structural & Civil", color: "#7f97ad" },
  construction: { label: "Construction Management", color: "#f26a21" },
  commissioning: { label: "Commissioning & Controls", color: "#e2513c" },
  bim: { label: "BIM / VDC", color: "#38bdf8" }
};

window.WAYPOINT_JOBS = [
  {
    id: "RP-M01",
    title: "Senior Mechanical Engineer, PE",
    discipline: "mechanical",
    market: "Healthcare · Commercial · Higher Ed",
    employer: "MEP consulting engineering firms",
    location: "Nationwide",
    workplace: "Hybrid",
    type: "Direct Hire",
    salary: "$130k – $165k typical base",
    salaryMin: 130000,
    summary: "Leads HVAC design from schematic design through construction administration, mentors junior engineers and owns client relationships on complex projects.",
    tags: ["PE", "Revit", "Load calcs", "Central plants"]
  },
  {
    id: "RP-E01",
    title: "Electrical Engineer — Critical Power",
    discipline: "electrical",
    market: "Data Centers · Mission Critical",
    employer: "Design-build and MEP engineering firms",
    location: "Mid-Atlantic · Texas · Southwest",
    workplace: "On-site",
    type: "Direct Hire",
    salary: "$115k – $150k typical base",
    salaryMin: 115000,
    summary: "Designs medium-voltage distribution, UPS, generator and switchgear systems for data centers and other facilities that cannot go dark.",
    tags: ["EIT / PE", "MV distribution", "UPS", "Arc flash"]
  },
  {
    id: "RP-C01",
    title: "MEP Project Manager",
    discipline: "construction",
    market: "Data Centers · Healthcare · Industrial",
    employer: "General contractors and MEP subcontractors",
    location: "Sun Belt · Nationwide",
    workplace: "On-site",
    type: "Direct Hire",
    salary: "$150k – $190k typical base + bonus",
    salaryMin: 150000,
    summary: "Manages MEP trade partners, coordination, schedule and commissioning on large, multi-phase building programs.",
    tags: ["MEP coordination", "Trade management", "PMP a plus"]
  },
  {
    id: "RP-P01",
    title: "Fire Protection Designer",
    discipline: "plumbing",
    market: "Life Sciences · Commercial · Healthcare",
    employer: "Fire protection engineers and contractors",
    location: "Northeast · Southeast · Texas",
    workplace: "Hybrid",
    type: "Direct Hire",
    salary: "$85k – $115k typical base",
    salaryMin: 85000,
    summary: "Designs wet, dry and pre-action sprinkler systems, performs hydraulic calculations and coordinates with architects and AHJs.",
    tags: ["NICET III / IV", "AutoSPRINK", "Hydraulic calcs"]
  },
  {
    id: "RP-X01",
    title: "Commissioning Agent (CxA)",
    discipline: "commissioning",
    market: "Data Centers · Healthcare · Labs",
    employer: "Independent commissioning authorities",
    location: "Nationwide (travel)",
    workplace: "On-site",
    type: "Direct Hire",
    salary: "$95k – $135k typical base",
    salaryMin: 95000,
    summary: "Leads functional performance testing and integrated systems testing for critical power, cooling and building automation.",
    tags: ["CxA / CCP", "IST", "Level 3–5 testing"]
  },
  {
    id: "RP-B01",
    title: "BIM Coordinator — MEP",
    discipline: "bim",
    market: "Commercial · Healthcare · Mission Critical",
    employer: "Mechanical and electrical contractors",
    location: "Nationwide",
    workplace: "Hybrid",
    type: "Direct Hire",
    salary: "$70k – $95k typical base",
    salaryMin: 70000,
    summary: "Runs clash detection and trade coordination, produces fabrication-ready models and supports field installation.",
    tags: ["Navisworks", "Revit MEP", "Fabrication"]
  },
  {
    id: "RP-A01",
    title: "Project Architect",
    discipline: "architecture",
    market: "Higher Ed · Healthcare · Civic",
    employer: "Architecture and A/E firms",
    location: "Nationwide",
    workplace: "Hybrid",
    type: "Direct Hire",
    salary: "$95k – $130k typical base",
    salaryMin: 95000,
    summary: "Leads technical delivery of construction documents, coordinates consultants and guides projects through construction.",
    tags: ["Licensed architect", "Revit", "CA experience"]
  },
  {
    id: "RP-S01",
    title: "Structural Engineer, PE / SE",
    discipline: "structural",
    market: "Commercial · Mixed-Use · Industrial",
    employer: "Structural engineering consultancies",
    location: "West Coast · Southeast · Texas",
    workplace: "Hybrid",
    type: "Direct Hire",
    salary: "$110k – $155k typical base",
    salaryMin: 110000,
    summary: "Designs steel, concrete and mass-timber structures and manages project delivery from concept through construction.",
    tags: ["PE / SE", "RAM / ETABS", "Seismic"]
  },
  {
    id: "RP-M02",
    title: "Director of MEP Engineering",
    discipline: "mechanical",
    market: "Multi-market",
    employer: "Multidisciplinary A/E firms",
    location: "Major metros nationwide",
    workplace: "Hybrid",
    type: "Executive Search",
    salary: "$200k – $275k typical base + bonus",
    salaryMin: 200000,
    summary: "Leads an MEP department or office: owns P&L, grows key markets, recruits and develops the team.",
    tags: ["Leadership", "P&L", "Business development"]
  },
  {
    id: "RP-C02",
    title: "Mechanical Superintendent",
    discipline: "construction",
    market: "Industrial · Healthcare · Commercial",
    employer: "Mechanical contractors",
    location: "Texas · Southeast · Midwest",
    workplace: "On-site",
    type: "Direct Hire",
    salary: "$110k – $150k typical base",
    salaryMin: 110000,
    summary: "Runs field operations for HVAC and piping installation, manages crews and subcontractors, and owns safety and schedule.",
    tags: ["OSHA 30", "Process piping", "Field leadership"]
  },
  {
    id: "RP-X02",
    title: "Controls Engineer — BAS",
    discipline: "commissioning",
    market: "Healthcare · Higher Ed · Commercial",
    employer: "Building automation integrators",
    location: "Nationwide",
    workplace: "On-site",
    type: "Direct Hire",
    salary: "$90k – $125k typical base",
    salaryMin: 90000,
    summary: "Designs and programs building automation systems, writes sequences of operation and supports startup and commissioning.",
    tags: ["Niagara", "Sequences", "BACnet"]
  },
  {
    id: "RP-E02",
    title: "Electrical Designer",
    discipline: "electrical",
    market: "Commercial · Hospitality · Multifamily",
    employer: "MEP consulting engineering firms",
    location: "Nationwide",
    workplace: "Hybrid",
    type: "Direct Hire",
    salary: "$75k – $105k typical base",
    salaryMin: 75000,
    summary: "Produces power, lighting and systems drawings in Revit, performs load calculations and supports engineers through CA.",
    tags: ["Revit", "Lighting", "Panel schedules"]
  },
  {
    id: "RP-P02",
    title: "Plumbing Engineer",
    discipline: "plumbing",
    market: "Multifamily · Hospitality · Healthcare",
    employer: "MEP consulting engineering firms",
    location: "Remote-friendly · US",
    workplace: "Remote",
    type: "Direct Hire",
    salary: "$95k – $130k typical base",
    salaryMin: 95000,
    summary: "Designs domestic water, sanitary, storm, gas and medical gas systems and coordinates with mechanical and fire protection.",
    tags: ["CPD a plus", "Revit", "Med gas"]
  },
  {
    id: "RP-C03",
    title: "Electrical Estimator",
    discipline: "construction",
    market: "Commercial · Education · Industrial",
    employer: "Electrical contractors",
    location: "Southeast · Texas · Mid-Atlantic",
    workplace: "On-site",
    type: "Direct Hire",
    salary: "$90k – $125k typical base",
    salaryMin: 90000,
    summary: "Builds hard-bid and negotiated estimates, analyzes drawings and specifications and supports preconstruction pursuits.",
    tags: ["Accubid / McCormick", "Takeoff", "Preconstruction"]
  },
  {
    id: "RP-A02",
    title: "Interior Designer",
    discipline: "architecture",
    market: "Workplace · Healthcare · Hospitality",
    employer: "Architecture and interiors firms",
    location: "Major metros nationwide",
    workplace: "Hybrid",
    type: "Direct Hire",
    salary: "$70k – $105k typical base",
    salaryMin: 70000,
    summary: "Develops interior concepts through documentation, selects finishes and FF&E, and presents to clients.",
    tags: ["NCIDQ a plus", "Revit", "FF&E"]
  },
  {
    id: "RP-B02",
    title: "VDC Manager",
    discipline: "bim",
    market: "Mission Critical · Healthcare · Commercial",
    employer: "General contractors",
    location: "Nationwide",
    workplace: "Hybrid",
    type: "Direct Hire",
    salary: "$120k – $160k typical base",
    salaryMin: 120000,
    summary: "Leads virtual design and construction strategy across projects: coordination, model standards, laser scanning and field tools.",
    tags: ["Navisworks", "BIM 360 / ACC", "Team leadership"]
  }
];

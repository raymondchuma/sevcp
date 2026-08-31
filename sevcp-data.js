// SEVCP 2026 portfolio — real cohort data (source: SEVCP 2026 Winners CSVs)
const TINTS = ['#237922','#E86642','#1C3F39','#F3BC45','#6ACDDD','#35352B'];

export const CO = [
  {slug:'ondigo', name:'Ondigo Technologies', mark:'ON', logo:'img/logos/ondigo.jpeg', state:'Enugu', sector:'Mobility & Transport', program:'Accelerator',
   tagline:'Digital fare collection hardware for public transport operators.',
   about:'Ondigo Technologies helps drivers in the public transportation sector collect digital payments from passengers with a hardware payment collection device, eliminating the problem of change and enabling passengers to operate a dedicated transportation wallet and make seamless fare payments.'},
  {slug:'skilladder', name:'Skilladder', mark:'SK', logo:'img/logos/skilladder.png', state:'Anambra', sector:'EdTech', program:'Accelerator',
   tagline:'Assessment infrastructure for African hiring.',
   about:'Skilladder gives employers objective proof of what every candidate can actually do, through real job tasks and scenario-based activities that cannot be faked with AI. Built on a proprietary skills framework of 15 job families and 800+ skills mapped for African markets, it has assessed over 100,000 people in 18 months. Skilladder is 3MTT\u2019s dedicated assessment partner and is running a pilot to place 13,000 candidates into jobs.'},
  {slug:'kira-ai', name:'Kira AI', mark:'KI', logo:'img/logos/kira.png', state:'Enugu', sector:'FinTech', program:'Accelerator',
   tagline:'Send money and manage banking tasks inside WhatsApp.',
   about:'Kira AI is a conversational payments product that lets Nigerians send money and manage basic banking tasks directly inside WhatsApp \u2014 no new app to download and no special commands to learn. Each user gets a Kira wallet and can message naturally: \u201cSend \u20a65,000 to David,\u201d \u201cBuy \u20a61,000 airtime,\u201d \u201cWhat\u2019s my balance?\u201d Transfers run bank-to-bank over Nigerian payment rails, with receipts returned in the chat. Kira also supports voice notes and can read bank details from screenshots to eliminate copy-paste errors.'},
  {slug:'rapidmedicare', name:'RapidMedicare', mark:'RM', logo:'img/logos/rapidmedicare.jpg', state:'Anambra', sector:'HealthTech', program:'Accelerator',
   tagline:'AI-powered health insurance and care delivery for the uninsured.',
   about:'RapidMedicare is a flexible, affordable, AI-powered health insurance and care delivery platform that removes access barriers for millions of uninsured and underinsured Nigerians \u2014 from under \u20a61,300 per month. Through the app, WhatsApp or USSD, an AI advisor matches users to plans across every HMO on the platform, runs a coverage adequacy check, and automatically applies for any public subsidies the user qualifies for. When care is needed, AI triage routes patients straight to the right specialist, and biometric claims approval credits providers in seconds.'},
  {slug:'smartairs', name:'SmartAIRS', mark:'SA', logo:'img/logos/smartairs.png', state:'Abia', sector:'GovTech', program:'Accelerator',
   tagline:'Digital revenue infrastructure for Nigerian state governments.',
   about:'SmartAIRS is a full-stack digital revenue infrastructure platform that enables Nigerian state governments to capture, manage and account for internally generated revenue \u2014 replacing fragmented, leakage-prone systems with a single real-time, auditable platform. It covers taxpayer identification, payment processing, remittance, reconciliation, compliance enforcement and reporting; equips banks and institutions collecting on behalf of government; and gives citizens full ownership of their tax identity via app, USSD or agent network. Live in Abia State since April 2024 and in Edo State.'},
  {slug:'bra-x', name:'Bra-X', mark:'BX', logo:'img/logos/brax.jpeg', state:'Imo', sector:'HealthTech', program:'Accelerator',
   tagline:'A smart bra for continuous, non-invasive breast health monitoring.',
   about:'Bra-X is a smart bra designed to advance early breast cancer detection through continuous, non-invasive monitoring of breast health. Using embedded biosensors and machine learning, the device detects subtle physiological changes often missed between routine screenings and alerts users in real time to seek intervention \u2014 shifting detection from hospitals into everyday life. Bra-X completed a seven-month programme at the Health Founders Accelerator in Tallinn, Estonia and was among the winning teams at the NextGen Innovation Challenge 2025 in London, representing Imo State.'},
  {slug:'stur-africa', name:'Stur Africa', mark:'ST', logo:'img/logos/stur.jpg', state:'Imo', sector:'Commerce & Retail', program:'Accelerator',
   tagline:'An agentic storefront that runs commerce on autopilot.',
   about:'Stur Africa sits inside WhatsApp, Instagram, Facebook and its own storefront, replying to customers, checking stock and closing sales around the clock \u2014 while quietly handling the back-end work shop owners never have time for: inventory, shipments, fraud checks and employees. One tool, and the store never closes.'},
  {slug:'nigenius', name:'Nigenius', mark:'NG', logo:'img/logos/nigenius.png', state:'Imo', sector:'EdTech', program:'Accelerator',
   tagline:'Africa\u2019s first offline robotics learning platform.',
   about:'Nigenius is an edtech company building Robolearn Digital, Africa\u2019s first offline robotics learning platform. Students learn robotics without an internet connection, build robots in virtual spaces, progress through a structured learning pathway and earn certifications as they advance.'},
  {slug:'spaceops', name:'SpaceOps', mark:'SO', logo:'img/logos/spaceops.png', state:'Enugu', sector:'Enterprise Software', program:'Accelerator',
   tagline:'The operating system for physical space.',
   about:'SpaceOps helps coworking operators, venue owners and space-driven businesses run everything in one place \u2014 bookings, memberships, payments, access and analytics. Instead of juggling spreadsheets, messaging apps and disconnected tools, operators get a single structured way to manage supply, understand demand and grow revenue, turning underutilised spaces into a scalable, data-driven business.'},
  {slug:'flof', name:'FLOF Mart', mark:'FL', logo:'img/logos/flof.png', logoBg:'#1C3F39', state:'Enugu', sector:'Commerce & Retail', program:'Accelerator',
   tagline:'Omnichannel hard-discount grocery for everyday essentials.',
   about:'FLOF Mart is an omnichannel hard discount grocery business making everyday essentials more affordable and easier to access for Nigerians. It sources select fast-moving goods directly from manufacturers, which customers order through its website. By focusing on a limited range of items, FLOF keeps inventory tightly managed, prices low and availability consistent \u2014 addressing inefficiencies in Nigeria\u2019s food supply chain.'},
  {slug:'case-radar', name:'Case Radar', mark:'CR', logo:'img/logos/caseradar.png', state:'Ebonyi', sector:'LegalTech', program:'Accelerator',
   tagline:'AI legal guidance in plain language.',
   about:'Case Radar is an AI-powered legal tech platform that helps people understand their rights, navigate legal issues and access reliable legal guidance in plain language. Users can get legal advice, run legal research, draft legal documents and connect with lawyers anytime. It supports multiple local languages and is designed to make legal information accessible, especially in underserved communities.'},
  {slug:'strag', name:'Smart Transport Grid (STRAG)', mark:'SG', logo:'img/logos/strag.svg', state:'Enugu', sector:'Mobility & Transport', program:'Accelerator',
   tagline:'An integrated digital transport ecosystem for states and commuters.',
   about:'STRAG operates as an integrated transport ecosystem bringing safety and value to passengers while offering transparency and efficiency to government and private investors. Components include commercial vehicle registration and profiling with QR verification, rider and driver certification, electronic ticketing for transport levies and permits, inspection and enforcement tools, tap-and-pay fare collection, and GPS-based incident reporting and emergency alerts \u2014 boosting internally generated revenue, regulatory compliance and road safety.'},
  {slug:'8bit', name:'8Bit Digital Systems', mark:'8B', logo:'img/logos/8bit.png', state:'Enugu', sector:'Energy & IoT', program:'Accelerator',
   tagline:'IoT smart energy monitoring and automation for homes and businesses.',
   about:'8Bit Connect is an IoT smart energy monitoring and automation platform for homes and businesses running on solar, batteries, grid and generator power. It provides real-time visibility, remote control and offline-first automation that keeps monitoring, protection and smart response active even when internet access is down, with devices communicating peer-to-peer when paired. The hardware stack includes Hydra for multi-channel monitoring, Battery Guard and Solar Guard for protection, and Spider devices for switching, environmental sensing and automation. Deployed across 20 sites with over \u20a610,000,000 in revenue to date.'},
  {slug:'agrofuxion', name:'AgroFuxion (Climax Green)', mark:'AG', logo:'img/logos/agrofuxion.jpeg', state:'Anambra', sector:'AgriTech', program:'Accelerator',
   tagline:'Credit, savings and crop insurance for smallholder farmers over USSD.',
   about:'AgroFuxion is a phygital agri-fintech platform building financial inclusion for smallholder farmers in South East Nigeria. It combines USSD technology \u2014 which works on any basic phone without internet \u2014 with a ground network of cooperative super agents to deliver credit, savings and parametric crop insurance to farmers locked out of traditional banking. Insurance is powered by satellite oracles, so payouts trigger automatically when rainfall or temperature data confirms a drought or flood: no claims process, no paperwork. Over 750 farmers are waitlisted across pilot cooperatives in Anambra and Enugu.'},
  {slug:'afiari', name:'Afiari', mark:'AF', logo:'img/logos/afiari.png', state:'Imo', sector:'Commerce & Retail', program:'Accelerator',
   tagline:'First-party market intelligence for FMCG and manufacturing.',
   about:'Afiari provides real-time first-party market intelligence for FMCG and manufacturing companies from their aggregate networks of sales reps, wholesalers and distributors. It digitises purchasing, inventory and sales for small physical businesses, supports them with offline agents through the transition, then connects that operating data back to the manufacturers who supply them via a market intelligence tool.'},

  {slug:'health-vault', name:'Health Vault NG', mark:'HV', logo:'img/logos/healthvault.svg', state:'Enugu', sector:'HealthTech', program:'Incubator',
   tagline:'Patient-owned digital health records.',
   about:'Health Vault NG is a patient-owned digital health records platform giving every Nigerian a single, secure place where their entire medical history lives \u2014 accessible from any smartphone, shareable with any provider and controlled entirely by the patient. Built on a consent-layer architecture with blockchain-backed audit trails, a patient\u2019s most sensitive data cannot be accessed, altered or shared without explicit permission. It is infrastructure, not an app: the layer connecting every Nigerian to every provider they will encounter.'},
  {slug:'vibet-bio', name:'VIBET BIO', mark:'VB', logo:'img/logos/vibetbio.jpg', state:'Enugu', sector:'HealthTech', program:'Incubator',
   tagline:'An AI operating system for primary care clinics.',
   about:'VIBET BIO has built VIBET OS, an AI-powered platform for primary care clinics in Africa. It replaces fragmented, paper-based workflows with a single system supporting scheduling, triage, patient records, clinical documentation and follow-ups \u2014 reducing administrative workload so clinics can see more patients, cut missed appointments and revenue loss, and deliver more continuous care.'},
  {slug:'wattmuse', name:'Wattmuse Energy', mark:'WM', logo:'img/logos/wattmuse.png', state:'Enugu', sector:'Energy & IoT', program:'Incubator',
   tagline:'Financing and distribution infrastructure for clean energy.',
   about:'\u201cGo solar\u201d is the typical response to Africa\u2019s electricity crisis, but nobody talks about the high upfront cost of solar solutions. Wattmuse is building the financing and distribution infrastructure to accelerate clean energy adoption across Africa at scale.'},
  {slug:'kobotrac', name:'KoboTrac', mark:'KT', logo:'img/logos/kobotrac.png', state:'Enugu', sector:'FinTech', program:'Incubator',
   tagline:'An AI financial assistant that works over chat.',
   about:'KoboTrac is an AI-powered financial assistant helping individuals and small businesses track income, expenses and daily transactions through simple chat. By turning messaging platforms like WhatsApp into an easy-to-use money management tool, it simplifies financial tracking and gives users better visibility and control over their finances.'},
  {slug:'simsak', name:'Simsak', mark:'SI', logo:'img/logos/simsak.png', state:'Enugu', sector:'Commerce & Retail', program:'Incubator',
   tagline:'One platform for creators to sell, get paid and run their business.',
   about:'Simsak helps creators sell physical and digital products and services, manage customers, accept global payments and run their entire business from one platform. Today many creators in emerging markets piece together WhatsApp, Mailchimp, spreadsheets and payment links; Simsak replaces that with a unified system accessible via web and an AI assistant that works across chat and email. In beta, 25 creators in Nigeria processed over $3,000 in transactions and handled over 800 customer interactions in two months.'},
  {slug:'growdex', name:'Growdex', mark:'GD', logo:'img/logos/growdex.png', state:'Enugu', sector:'Enterprise Software', program:'Incubator',
   tagline:'AI advertising management across every channel.',
   about:'Growdex is an AI-powered advertising management platform that helps businesses run and optimise digital ads across multiple platforms from one place. It unifies campaign data into a single dashboard, giving a clear view of cross-channel performance plus insights to identify what is working and optimise budgets. Growdex is also building a centralised wallet to simplify how businesses fund and manage ad spend.'},
  {slug:'farmi-ai', name:'Farmi AI', mark:'FA', logo:'img/logos/farmiai.png', state:'Anambra', sector:'AgriTech', program:'Incubator',
   tagline:'What to grow, when to sell, how to price.',
   about:'Farmi AI helps farmers decide what to grow, when to sell and how to price their produce using market demand and pricing signals, while providing crop management insights to support better farming decisions. It addresses both the business and production side of farming, helping farmers make choices that improve how much they earn.'},
  {slug:'cng-protect', name:'CNG Protect', mark:'CP', logo:'img/logos/cngprotect.png', state:'Enugu', sector:'Energy & IoT', program:'Incubator',
   tagline:'An Edge-AI blackbox preventing gas explosions in CNG vehicles.',
   about:'CNG Protect is an Edge-AI and IoT \u201cblackbox\u201d for retrofitted commercial transit vehicles. It prevents catastrophic gas explosions by using predictive machine learning to detect thermal and pressure anomalies, autonomously severing engine ignition before failure. By logging immutable safety telemetry to the blockchain, it gives fleet managers and insurers real-time monitoring \u2014 safely accelerating the mass transition to clean compressed natural gas.'},
  {slug:'linia-finance', name:'Linia Finance', mark:'LF', logo:'img/logos/linia.png', state:'Enugu', sector:'FinTech', program:'Incubator',
   tagline:'Budgeting and banking in one place.',
   about:'Linia bridges the gap between budgeting and banking with a unified budgeting and spending platform for the middle class \u2014 helping people create wallets that fit their budget and spend directly from those wallets rather than from their main account.'},
  {slug:'keke-ride', name:'Keke Ride', mark:'KR', logo:'img/logos/kekeride.jpeg', state:'Ebonyi', sector:'Mobility & Transport', program:'Incubator',
   tagline:'Ride-hailing for keke and okada in underserved cities.',
   about:'Keke Ride is a mobile platform connecting riders with nearby keke and okada drivers for fast, affordable and reliable short-distance transportation. It focuses on mobility challenges in underserved urban and suburban regions where traditional ride-hailing is limited and informal transport dominates \u2014 bringing structure, transparency and real-time access that improves both rider experience and driver earnings, and enabling last-mile delivery.'}
];

const PHOTOS = ['DON00022','DON00417','DON00459','DON00490','DON00519','DON00790','DON00837','DON00931','DON01013','DON01157','DON09988','DON00948'];

CO.forEach((c,i) => {
  c.cohort = '2026';
  c.slot = 'co-' + c.slug;
  c.photo = 'img/' + PHOTOS[i % PHOTOS.length] + '.jpg';
  c.tint = TINTS[i % TINTS.length];
  c.featured = ['kira-ai','flof','spaceops','health-vault','growdex','simsak'].indexOf(c.slug) > -1;
});

export const REASONS = ['Investment','Partnership','Become a Customer','Corporate Opportunity','Distribution','Media','Mentorship / Advisory','Other'];

export const STATIC = {
  about:{eyebrow:'About SEVCP', title:'A venture platform built by an institution, run like a fund.',
    body:'The South East Venture Capital Program is an initiative of the South East Development Commission, created to identify, fund and support high-potential companies connected to South East Nigeria \u2014 and to connect them to the capital, customers and partners that let them scale.',
    points:[{k:'Our model',v:'SEDC \u2192 SEVCP \u2192 Capital + Programmes + Partners \u2192 Companies \u2192 Economic growth.'},{k:'Why the South East',v:'Five states with deep manufacturing, trade and entrepreneurial density, and historically thin access to formal venture capital.'},{k:'Governance',v:'Investment decisions are made by a committee combining institutional oversight with independent venture expertise.'},{k:'Institutional parent',v:'The South East Development Commission provides mandate, oversight and long-term funding continuity.'}]},
  programs:{eyebrow:'Programs', title:'Built around founders. Designed around companies.',
    body:'SEVCP support is mapped to company stage: Idea / MVP \u2192 Validation \u2192 Traction \u2192 Scale \u2192 Institutional capital. Founders join one programme at a time and keep running their companies throughout.',
    points:[{k:'Incubator',v:'For founders turning validated ideas into investable companies. Ten companies in the 2026 cohort.'},{k:'Accelerator',v:'For companies with traction ready to scale. Fifteen companies in the 2026 cohort.'},{k:'Pitch Competition',v:'SEVCP\u2019s flagship discovery and investment programme. 1,086 applications to the inaugural edition.'},{k:'Application status',v:'Cohort applications are closed between cycles, but founders can join the pipeline year-round.'}]},
  partners:{eyebrow:'Partner with SEVCP', title:'It takes an ecosystem.',
    body:'SEVCP works with organisations that can provide capital, expertise, infrastructure and market access to founders \u2014 institutional, implementing, financing, ecosystem and corporate partners.',
    points:[{k:'Investors',v:'Co-investment and direct introductions to investment-ready portfolio companies.'},{k:'Corporates',v:'Procurement, distribution and technology partnerships with portfolio companies.'},{k:'Implementing partners',v:'Programme delivery, mentorship networks and operating support.'},{k:'Get in touch',v:'partnerships@sevcp.sedc.gov.ng \u00b7 Enugu, Nigeria'}]}
};

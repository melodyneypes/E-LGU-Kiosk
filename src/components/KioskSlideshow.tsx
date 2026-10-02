"use client";

import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import Image from "next/image";
import LGULogo from "./shared/LGULogo";
import { 
  Building2, 
  FileText, 
  ShieldAlert, 
  Newspaper, 
  PhoneCall, 
  Users, 
  HardHat, 
  Clock, 
  Radio, 
  CreditCard, 
  ChevronRight, 
  ArrowRight,
  Sparkles,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Bell,
  Megaphone,
  Calendar,
  Siren,
  Flame,
  Shield,
  HeartPulse
} from "lucide-react";

// ────────── Data Interfaces ──────────
interface HeroSlideData {
  id: string;
  title: string;
  subtitle: string | null;
  tagline: string | null;
  imageUrl: string;
}

interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  priority: string;
  category: string;
  isPinned: boolean;
  createdAt: string;
}

interface NewsItem {
  id: string;
  title: string;
  content: string;
  author: string | null;
  category: string;
  imageUrl: string | null;
  publishDate: string;
}

interface ServiceItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  baseFee: number;
  processingTime: string | null;
  slaDays: number;
  requiredDocs: unknown;
  pickupAddress: string | null;
}

interface OfficialItem {
  id: string;
  name: string;
  position: string;
  imageUrl: string | null;
  motto: string | null;
  category: string;
}

interface ProjectItem {
  id: string;
  title: string;
  category: string;
  status: string;
  location: string;
  budget: string | null;
  progress: number;
  imageUrl: string | null;
}

interface HotlineItem {
  id: string;
  name: string;
  category: string;
  mobileNumber: string | null;
  telephone: string | null;
}

interface KioskFeedData {
  heroSlides: HeroSlideData[];
  announcements: AnnouncementItem[];
  newsList: NewsItem[];
  services: ServiceItem[];
  officials: OfficialItem[];
  projects: ProjectItem[];
  hotlines: HotlineItem[];
}

const SLIDE_DURATION = 15000; // 15 seconds per slide - well-paced ambient cycle

// ────────── Fallback / Default Data ──────────
const DEFAULT_HERO = {
  title: "Welcome to the Local Government Unit",
  subtitle: "E-LGU Public Service Portal • Republic of the Philippines",
  tagline: "Empowering our citizens through digital transparency, progressive governance, and rapid public service.",
  bg: "/slide-welcome.png",
};

const DEFAULT_SERVICES = [
  {
    name: "Barangay ID & Clearance",
    category: "Community Affairs",
    processingTime: "Same Day",
    desc: "Official residency identification card and community clearance valid for local verification and legal transactions.",
  },
  {
    name: "Civil Registry Documents",
    category: "Civil Registry",
    processingTime: "1-2 Business Days",
    desc: "Certified true copies of Birth Certificate, Marriage License, and Death Registration certificates.",
  },
  {
    name: "Business Permit & Licensing",
    category: "BPLO / Treasury",
    processingTime: "2-3 Days",
    desc: "Commercial operations registration, annual business renewals, tax assessments, and sanitary inspection permits.",
  },
  {
    name: "Real Property Tax (Amilyar)",
    category: "Assessor / Treasury",
    processingTime: "Immediate",
    desc: "Check land & property assessment declarations, pay annual Amilyar dues, and request zoning clearance records.",
  },
  {
    name: "Senior Citizen & PWD Benefits",
    category: "MSWDO Office",
    processingTime: "Same Day",
    desc: "Application for National Senior Citizen ID, PWD Booklet, social pension assessment, and special financial assistance.",
  },
  {
    name: "Zoning & Building Clearances",
    category: "Engineering Office",
    processingTime: "3-5 Business Days",
    desc: "Locational clearances, residential construction permits, electrical inspection certificates, and fencing permits.",
  },
  {
    name: "Health Certificate & Sanitary Permit",
    category: "Rural Health Unit",
    processingTime: "Same Day",
    desc: "Medical laboratory assessments, food handler certifications, and sanitary clearances for local establishments.",
  },
  {
    name: "Farmer & Agricultural Assistance",
    category: "Agriculture Office",
    processingTime: "1-2 Days",
    desc: "RSBSA farmer registration, seed distribution programs, crop insurance verification, and livestock vaccination.",
  },
];

const DEFAULT_HOTLINES = [
  { 
    name: "MDRRMO Emergency Rescue & Dispatch", 
    category: "Disaster & Ambulance", 
    phone: "0998-123-4567",
    scope: "Flood evacuation, vehicular accidents, 24/7 patient transfer & emergency rescue"
  },
  { 
    name: "Municipal Police Station (PNP)", 
    category: "Law Enforcement", 
    phone: "0998-555-0100",
    scope: "Public peace, immediate crime reporting, anti-criminality response & municipal patrol"
  },
  { 
    name: "Bureau of Fire Protection (BFP)", 
    category: "Fire & Hazmat", 
    phone: "(075) 555-1199",
    scope: "Fire alarms, residential blaze suppression & emergency hazardous material control"
  },
  { 
    name: "Rural Health Unit (RHU Clinic & Birthing)", 
    category: "Medical Services", 
    phone: "0920-777-2233",
    scope: "Primary healthcare triage, maternal delivery, immunization & animal bite center"
  },
  { 
    name: "Mayor's Quick Action & Public Assistance", 
    category: "Executive Action", 
    phone: "(075) 555-0000",
    scope: "Direct community emergency intervention, social services welfare & action desk"
  },
  { 
    name: "POSO Traffic & Peacekeeping Operations", 
    category: "Community Safety", 
    phone: "0917-888-4455",
    scope: "Barangay peacekeeping coordination, road obstruction & public order maintenance"
  },
  { 
    name: "MSWDO Crisis Intervention Unit", 
    category: "Social Welfare", 
    phone: "0945-222-3344",
    scope: "Child & women protection desk (VAWC), senior citizen distress & emergency shelter aid"
  },
  { 
    name: "Municipal Engineering & Power Utilities", 
    category: "Public Utilities", 
    phone: "(075) 555-4321",
    scope: "Fallen electrical lines, street light power restoration & structural hazard inspection"
  },
  { 
    name: "Municipal Agriculture & Livestock Quick Response", 
    category: "Agriculture / Animal", 
    phone: "0939-111-8899",
    scope: "Livestock rabies outbreak, agricultural crop damage & veterinary emergency triage"
  },
];

const DEFAULT_OFFICIALS: OfficialItem[] = [
  {
    id: "off-1",
    name: "HON. ROBERTO V. SANTOS",
    position: "MUNICIPAL MAYOR",
    imageUrl: null,
    motto: "Tapat, Mabilis, at Serbisyong Diretso sa Mamamayan",
    category: "EXECUTIVE",
  },
  {
    id: "off-2",
    name: "HON. MARIA CLARA E. REYES",
    position: "VICE MAYOR",
    imageUrl: null,
    motto: null,
    category: "EXECUTIVE",
  },
  {
    id: "off-3",
    name: "HON. JUAN D. DELA CRUZ",
    position: "COUNCILOR",
    imageUrl: null,
    motto: null,
    category: "COUNCIL",
  },
  {
    id: "off-4",
    name: "HON. TERESA M. GARCIA",
    position: "COUNCILOR",
    imageUrl: null,
    motto: null,
    category: "COUNCIL",
  },
  {
    id: "off-5",
    name: "HON. EDUARDO S. BAUTISTA",
    position: "COUNCILOR",
    imageUrl: null,
    motto: null,
    category: "COUNCIL",
  },
  {
    id: "off-6",
    name: "HON. CARMEN L. MENDOZA",
    position: "COUNCILOR",
    imageUrl: null,
    motto: null,
    category: "COUNCIL",
  },
  {
    id: "off-7",
    name: "HON. ROLANDO G. VILLANUEVA",
    position: "COUNCILOR",
    imageUrl: null,
    motto: null,
    category: "COUNCIL",
  },
  {
    id: "off-8",
    name: "HON. PATRICIA A. NAVARRO",
    position: "COUNCILOR",
    imageUrl: null,
    motto: null,
    category: "COUNCIL",
  },
  {
    id: "off-9",
    name: "HON. JOSE MARI P. TAN",
    position: "COUNCILOR",
    imageUrl: null,
    motto: null,
    category: "COUNCIL",
  },
  {
    id: "off-10",
    name: "HON. BEATRIZ C. RAMOS",
    position: "COUNCILOR",
    imageUrl: null,
    motto: null,
    category: "COUNCIL",
  },
  {
    id: "off-11",
    name: "HON. ANTONIO S. LOPEZ",
    position: "LNB PRESIDENT",
    imageUrl: null,
    motto: null,
    category: "COUNCIL",
  },
  {
    id: "off-12",
    name: "HON. MIGUEL B. TORRES",
    position: "SK FEDERATION PRESIDENT",
    imageUrl: null,
    motto: null,
    category: "COUNCIL",
  },
  {
    id: "off-13",
    name: "HON. DANIEL K. CORPUZ",
    position: "PCL PRESIDENT",
    imageUrl: null,
    motto: null,
    category: "COUNCIL",
  },
];

const DEFAULT_PROJECTS: ProjectItem[] = [
  {
    id: "proj-1",
    title: "Construction of Municipal Super Health Center & Emergency Complex",
    category: "Healthcare Infrastructure",
    status: "ONGOING",
    location: "Brgy. Poblacion",
    budget: "₱ 25,000,000.00",
    progress: 78,
    imageUrl: null,
  },
  {
    id: "proj-2",
    title: "Farm-to-Market Road Concreting & Solar Street Lighting Project",
    category: "Transportation & Energy",
    status: "ONGOING",
    location: "Brgy. Lupa – Torres Agricultural Corridor",
    budget: "₱ 14,500,000.00",
    progress: 92,
    imageUrl: null,
  },
  {
    id: "proj-3",
    title: "Rehabilitation of Municipal Public Market & Drainage Flood Control",
    category: "Economic Infrastructure",
    status: "ONGOING",
    location: "Commercial Commercial District, Poblacion",
    budget: "₱ 18,200,000.00",
    progress: 65,
    imageUrl: null,
  },
  {
    id: "proj-4",
    title: "Modern Multi-Purpose Evacuation & Disaster Response Command Center",
    category: "Disaster Preparedness",
    status: "PLANNING",
    location: "Brgy. Nilombot High Ground Zone",
    budget: "₱ 12,000,000.00",
    progress: 40,
    imageUrl: null,
  },
];

const DEFAULT_NEWS: NewsItem[] = [
  {
    id: "news-1",
    title: "LGU Launches Modern Digital Citizens Kiosk & Unified RFID System",
    content: "The Municipal Government officially unveils its high-speed interactive kiosk system, bringing automated service request processing, document tracking, and digital transparency directly to all citizens.",
    author: "PIO Office",
    category: "Governance & Tech",
    imageUrl: "/slide-welcome.png",
    publishDate: new Date().toISOString(),
  },
  {
    id: "news-2",
    title: "Free Medical, Dental Mission & RHU Medicine Distribution Reaches Over 1,200 Residents",
    content: "Municipal health workers and partnered medical volunteers delivered comprehensive primary healthcare checkups, diagnostic screenings, and essential prescription supplies during the outreach in Poblacion.",
    author: "RHU Office",
    category: "Healthcare",
    imageUrl: null,
    publishDate: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: "news-3",
    title: "Farmers' Fertilizer & High-Yield Seed Subsidy Rollout Commences for Wet Season Planting",
    content: "The Municipal Agriculture Office distributes certified seed bags and high-grade organic fertilizers to registered RSBSA local farming cooperatives across the municipality.",
    author: "Agriculture Office",
    category: "Agriculture",
    imageUrl: null,
    publishDate: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
];

const DEFAULT_ANNOUNCEMENTS: AnnouncementItem[] = [
  {
    id: "ann-1",
    title: "SCHEDULE: Regular Barangay General Assembly & Community Consultations",
    content: "All residents and household heads are cordially invited to attend the bi-annual Barangay Assembly meeting to discuss local community development funds and upcoming barangay projects.",
    priority: "URGENT",
    category: "Executive Notice",
    isPinned: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "ann-2",
    title: "BPLO NOTICE: 1st Quarter Business Permit & Local License Renewal Deadline",
    content: "Registered commercial establishments, market vendors, and service enterprises must complete their annual licensing assessment and tax dues to avoid statutory late surcharges.",
    priority: "URGENT",
    category: "BPLO / Treasury",
    isPinned: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "ann-3",
    title: "MSWDO ANNOUNCEMENT: Quarterly Social Pension Distribution for Senior Citizens",
    content: "Qualified senior citizens are advised to bring their valid Senior Citizen ID card or valid government identification to the Municipal Gymnasium during scheduled barangay cluster dates.",
    priority: "NORMAL",
    category: "Social Welfare",
    isPinned: false,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: "ann-4",
    title: "MDRRMO ADVISORY: Seasonal Monsoonal Preparedness & Clean-up Drive",
    content: "Barangay councils and residents along low-lying riverbanks are encouraged to participate in the unified canal clearing drive and inspect household storm drainage outlets.",
    priority: "NORMAL",
    category: "Public Safety",
    isPinned: false,
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
];

// ────────── Sub-Slide 1: Executive Welcome (Hero) ──────────
function HeroSlideView({ slide }: { slide?: HeroSlideData }) {
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {/* Background Image with Cinematic Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center filter brightness-[0.38] scale-105 transition-transform duration-1000 ease-out"
        style={{ backgroundImage: `url(${slide?.imageUrl || DEFAULT_HERO.bg})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#050816] via-transparent to-[#050816]/70 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_color-mix(in_srgb,var(--primary-theme)_15%,transparent)_0%,transparent_70%)] pointer-events-none" />

      <div className="relative z-10 max-w-5xl px-8 text-center flex flex-col items-center">
        <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-emerald-300 text-xs font-black uppercase tracking-[0.25em] shadow-2xl mb-8 animate-pulse">
          <Sparkles className="w-4 h-4 text-amber-400" />
          Official Municipal Terminal
        </div>

        <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.15] drop-shadow-2xl mb-6">
          {slide?.title || DEFAULT_HERO.title}
        </h1>

        <div className="w-24 h-1.5 bg-gradient-to-r from-amber-400 via-emerald-400 to-amber-400 rounded-full mb-6 shadow-lg shadow-emerald-500/20" />

        <p className="text-lg md:text-2xl font-light text-slate-200 max-w-3xl leading-relaxed mb-4">
          {slide?.subtitle || DEFAULT_HERO.subtitle}
        </p>

        <p className="text-sm md:text-base text-slate-400 max-w-2xl font-normal leading-relaxed">
          {slide?.tagline || DEFAULT_HERO.tagline}
        </p>
      </div>
    </div>
  );
}

// ────────── Sub-Slide 2: Live Citizen Services Directory ──────────
function ServicesSlideView({ services }: { services: ServiceItem[] }) {
  const allServices = services && services.length > 0 ? services : DEFAULT_SERVICES;
  const ITEMS_PER_PAGE = 4;
  const totalPages = Math.max(1, Math.ceil(allServices.length / ITEMS_PER_PAGE));
  const [page, setPage] = useState(0);

  // Auto-rotate service pages every 7 seconds with smooth fade
  useEffect(() => {
    if (totalPages <= 1) return;
    const interval = setInterval(() => {
      setPage((prev) => (prev + 1) % totalPages);
    }, 7000);
    return () => clearInterval(interval);
  }, [totalPages]);

  const currentPageServices = allServices.slice(
    page * ITEMS_PER_PAGE,
    (page + 1) * ITEMS_PER_PAGE
  );

  return (
    <div className="relative w-full h-full flex flex-col justify-between p-5 sm:p-7 md:p-9 lg:p-10 overflow-hidden bg-gradient-to-br from-[#07121e] via-[#050816] to-[#041a12]">
      {/* Ambient background blur */}
      <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

      {/* Slide Header with Page Counter & Interactive Dots */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between border-b border-white/10 pb-3 md:pb-4 gap-2 flex-shrink-0">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] sm:text-[11px] font-black uppercase tracking-widest mb-1">
            <Building2 className="w-3.5 h-3.5" />
            Citizen Charter & Services
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-snug">
            Municipal Service Directory
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Tap your Resident RFID Card anytime to directly request, track, or calculate processing assessments.
          </p>
        </div>

        {/* Right Status & Page Pills */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {totalPages > 1 && (
            <div className="flex items-center gap-2 bg-slate-900/80 border border-emerald-500/30 px-3 py-1.5 rounded-xl backdrop-blur-md">
              <span className="text-[11px] font-bold text-emerald-300">
                Page {page + 1} of {totalPages}
              </span>
              <div className="flex items-center gap-1.5 ml-1">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className={`h-1.5 transition-all duration-300 rounded-full ${
                      page === i ? "w-5 bg-emerald-400" : "w-1.5 bg-white/20 hover:bg-white/40"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl backdrop-blur-md">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>LGU Active</span>
          </div>
        </div>
      </div>

      {/* Service Cards Grid - Full Vertical & Horizontal Stretch with Smooth Page Transition */}
      <div 
        key={page}
        className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 flex-1 my-3 md:my-4 min-h-0 animate-in fade-in duration-500"
      >
        {currentPageServices.map((srv, idx) => {
          const isReal = "slaDays" in srv;
          const name = srv.name;
          const category = srv.category || "Municipal Service";
          const time = isReal 
            ? (srv as ServiceItem).processingTime || `${(srv as ServiceItem).slaDays || 1} Day SLA`
            : (srv as { processingTime: string }).processingTime;
          const desc = isReal 
            ? (srv as ServiceItem).description || "Fast-tracked municipal document request service." 
            : (srv as { desc: string }).desc;

          return (
            <div 
              key={idx}
              className="group relative rounded-2xl bg-slate-900/70 border border-white/10 hover:border-emerald-500/50 p-5 sm:p-6 md:p-7 flex flex-col justify-between backdrop-blur-xl transition-all duration-200 shadow-xl hover:shadow-2xl hover:shadow-emerald-950/50"
            >
              {/* Top Row: Category + Available Pill */}
              <div className="flex items-center justify-between gap-3 mb-2 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-md bg-white/10 text-emerald-300 border border-white/10">
                    {category}
                  </span>
                </div>
                <span className="text-[11px] sm:text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Available
                </span>
              </div>

              {/* Middle: Prominent Service Title & Full Clear Description */}
              <div className="my-auto py-2">
                <h3 className="text-lg sm:text-xl md:text-2xl font-black text-white mb-2 leading-snug group-hover:text-emerald-300 transition-colors">
                  {name}
                </h3>
                <p className="text-xs sm:text-sm md:text-base text-slate-300 leading-relaxed line-clamp-3 font-normal">
                  {desc}
                </p>
              </div>

              {/* Bottom Row: SLA Tag & RFID Tap Ready CTA */}
              <div className="pt-3 md:pt-4 border-t border-white/10 flex items-center justify-between text-xs sm:text-sm flex-shrink-0">
                <span className="text-slate-300 flex items-center gap-2 font-medium bg-slate-800/60 px-3 py-1.5 rounded-lg border border-white/5">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span className="font-semibold text-white">{time}</span>
                </span>
                <span className="text-emerald-400 font-bold flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity bg-emerald-500/10 hover:bg-emerald-500/20 px-3.5 py-1.5 rounded-lg border border-emerald-500/30">
                  <span>RFID Tap Ready</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Service Footer Note */}
      <div className="relative z-10 flex items-center justify-between text-[11px] sm:text-xs text-slate-400 pt-2 border-t border-white/10 flex-shrink-0">
        <span>* Requirements and guidelines are based on the Citizen&apos;s Charter.</span>
        <span className="font-semibold text-emerald-400">Municipal Frontline Services</span>
      </div>
    </div>
  );
}

// ────────── Sub-Slide 3: Pure Municipal Leadership & Council Showcase ──────────
function LeadershipSlideView({ officials }: { officials: OfficialItem[] }) {
  const allOfficials = officials && officials.length > 0 ? officials : DEFAULT_OFFICIALS;
  
  // Mayor is the top apex
  const mayor = allOfficials.find((o) => o.position.toUpperCase().includes("MAYOR") && !o.position.toUpperCase().includes("VICE")) || allOfficials[0];
  
  // Exclude mayor from the council roster
  const councilRoster = allOfficials.filter((o) => o.id !== mayor?.id);
  
  // Tier 1: 5 Members (Anthony Penuliar, Alicia Mariano, Percival Biagtan, Blando Quinto, Frederick Lalas)
  const tier1 = councilRoster.slice(0, 5);
  // Tier 2: 4 Members (Micheal Calimlim, Freddie Penuliar, John Ericson Parayno, Gem Castro)
  const tier2 = councilRoster.slice(5, 9);
  // Tier 3: 3 Members (Alexander Aquino, Diego Castro, John Manuel)
  const tier3 = councilRoster.slice(9, 12);

  return (
    <div className="relative w-full h-full flex flex-col justify-between p-3 sm:p-5 md:p-6 lg:p-7 overflow-hidden bg-gradient-to-br from-[#060a14] via-[#050816] to-[#0d070f] text-white">
      {/* Subtle atmospheric glow behind Mayor */}
      <div className="absolute top-28 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-rose-600/10 blur-[90px] pointer-events-none" />

      {/* Centered Grand Header: MUNICIPAL GOVERNMENT */}
      <div className="relative z-10 text-center flex-shrink-0 pt-1">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-black italic tracking-wider uppercase text-white drop-shadow-md">
          MUNICIPAL GOVERNMENT
        </h2>
        <div className="w-16 h-1 bg-rose-600 rounded-full mx-auto mt-1" />
      </div>

      {/* Main Pyramid Tree Canvas */}
      <div className="relative z-10 flex-1 flex flex-col justify-evenly my-auto min-h-0 py-1">
        {/* ────────── APEX: MAYOR ────────── */}
        <div className="flex flex-col items-center text-center flex-shrink-0">
          {/* Circular Portrait with Red/Crimson Accent Ring */}
          <div className="relative p-1 rounded-full bg-gradient-to-b from-rose-500/80 via-rose-700/50 to-slate-900 shadow-xl shadow-rose-950/50">
            <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-26 md:h-26 rounded-full overflow-hidden bg-slate-900/90 border-2 border-slate-950 flex items-center justify-center">
              {mayor.imageUrl ? (
                <Image src={mayor.imageUrl} alt={mayor.name} width={100} height={100} className="w-full h-full object-cover" unoptimized />
              ) : (
                <Users className="w-10 h-10 text-rose-300" />
              )}
            </div>
          </div>

          <h3 className="text-xs sm:text-sm md:text-base font-extrabold uppercase tracking-wide text-white mt-1.5 leading-tight">
            {mayor.name}
          </h3>
          <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-rose-500 mt-0.5 border-b border-rose-500/60 pb-0.5">
            {mayor.position}
          </span>
        </div>

        {/* ────────── TIER 1: 5 COUNCIL MEMBERS ────────── */}
        <div className="flex items-center justify-center gap-4 sm:gap-8 md:gap-12 flex-shrink-0">
          {tier1.map((off, idx) => (
            <div key={idx} className="flex flex-col items-center text-center max-w-[85px] sm:max-w-[115px]">
              <div className="p-0.5 rounded-full bg-slate-800 border border-white/20 shadow-md">
                <div className="w-11 h-11 sm:w-13 sm:h-13 md:w-15 md:h-15 rounded-full overflow-hidden bg-slate-900 flex items-center justify-center">
                  {off.imageUrl ? (
                    <Image src={off.imageUrl} alt={off.name} width={60} height={60} className="w-full h-full object-cover" unoptimized />
                  ) : (
                    <Users className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </div>
              <h4 className="text-[9px] sm:text-[10px] md:text-[11px] font-bold text-white uppercase tracking-tight leading-tight mt-1 truncate w-full">
                {off.name}
              </h4>
              <span className="text-[7px] sm:text-[8px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                {off.position}
              </span>
            </div>
          ))}
        </div>

        {/* ────────── TIER 2: 4 COUNCIL MEMBERS ────────── */}
        <div className="flex items-center justify-center gap-5 sm:gap-10 md:gap-14 flex-shrink-0">
          {tier2.map((off, idx) => (
            <div key={idx} className="flex flex-col items-center text-center max-w-[90px] sm:max-w-[120px]">
              <div className="p-0.5 rounded-full bg-slate-800 border border-white/20 shadow-md">
                <div className="w-11 h-11 sm:w-13 sm:h-13 md:w-15 md:h-15 rounded-full overflow-hidden bg-slate-900 flex items-center justify-center">
                  {off.imageUrl ? (
                    <Image src={off.imageUrl} alt={off.name} width={60} height={60} className="w-full h-full object-cover" unoptimized />
                  ) : (
                    <Users className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </div>
              <h4 className="text-[9px] sm:text-[10px] md:text-[11px] font-bold text-white uppercase tracking-tight leading-tight mt-1 truncate w-full">
                {off.name}
              </h4>
              <span className="text-[7px] sm:text-[8px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                {off.position}
              </span>
            </div>
          ))}
        </div>

        {/* ────────── TIER 3: 3 COUNCIL MEMBERS / SECTORAL ────────── */}
        <div className="flex items-center justify-center gap-6 sm:gap-12 md:gap-16 flex-shrink-0">
          {tier3.map((off, idx) => (
            <div key={idx} className="flex flex-col items-center text-center max-w-[95px] sm:max-w-[125px]">
              <div className="p-0.5 rounded-full bg-slate-800 border border-white/20 shadow-md">
                <div className="w-11 h-11 sm:w-13 sm:h-13 md:w-15 md:h-15 rounded-full overflow-hidden bg-slate-900 flex items-center justify-center">
                  {off.imageUrl ? (
                    <Image src={off.imageUrl} alt={off.name} width={60} height={60} className="w-full h-full object-cover" unoptimized />
                  ) : (
                    <Users className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </div>
              <h4 className="text-[9px] sm:text-[10px] md:text-[11px] font-bold text-white uppercase tracking-tight leading-tight mt-1 truncate w-full">
                {off.name}
              </h4>
              <span className="text-[7px] sm:text-[8px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                {off.position}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Note */}
      <div className="relative z-10 flex items-center justify-between text-[10px] sm:text-xs text-slate-400 pt-1.5 border-t border-white/10 flex-shrink-0">
        <span>Sangguniang Bayan Office • 2025–2028 Term</span>
        <span className="font-semibold text-rose-500">Official Municipal Council</span>
      </div>
    </div>
  );
}

// ────────── Sub-Slide 4: Dedicated Public Works & Transparency Projects ──────────
function ProjectsSlideView({ projects }: { projects: ProjectItem[] }) {
  const allProjects = projects && projects.length > 0 ? projects : DEFAULT_PROJECTS;

  return (
    <div className="relative w-full h-full flex flex-col justify-between p-5 sm:p-7 md:p-9 lg:p-10 overflow-hidden bg-gradient-to-br from-[#041a12] via-[#050816] to-[#0c1e19]">
      {/* Ambient background blur */}
      <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

      {/* Slide Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between border-b border-white/10 pb-3 md:pb-4 gap-2 flex-shrink-0">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] sm:text-[11px] font-black uppercase tracking-widest mb-1">
            <HardHat className="w-3.5 h-3.5" />
            Infrastructure, Transparency & Progress
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-snug">
            Major Public Works & Community Projects
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Full accountability and real-time status monitoring of ongoing municipal infrastructure.
          </p>
        </div>
        <div className="sm:text-right flex-shrink-0">
          <span className="inline-block text-[11px] sm:text-xs font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
            ● Full Transparency Compliant
          </span>
        </div>
      </div>

      {/* Projects Grid: 4 Grand Full-Height Cards (2x2 Layout) */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 flex-1 my-3 md:my-4 min-h-0">
        {allProjects.slice(0, 4).map((proj, idx) => (
          <div 
            key={idx}
            className="relative p-5 sm:p-6 rounded-2xl border border-white/15 hover:border-emerald-500/60 overflow-hidden flex flex-col justify-between transition-all duration-300 shadow-2xl hover:shadow-emerald-950/50 group"
          >
            {/* ────────── Background Image with Cinematic Darkness Gradient ────────── */}
            {proj.imageUrl ? (
              <Image 
                src={proj.imageUrl} 
                alt={proj.title}
                fill 
                className="object-cover object-center filter brightness-[0.32] group-hover:scale-105 group-hover:brightness-[0.38] transition-all duration-700 ease-out"
                unoptimized
              />
            ) : (
              <div 
                className="absolute inset-0 bg-cover bg-center filter brightness-[0.28] group-hover:scale-105 transition-all duration-700 ease-out"
                style={{ backgroundImage: `url(/slide-welcome.png)` }}
              />
            )}

            {/* Dark Cinematic Vignette Overlays for Maximum Text Contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-950/60 pointer-events-none" />
            <div className="absolute inset-0 bg-emerald-950/20 mix-blend-overlay pointer-events-none" />

            {/* Top Row: Category + Status Badge */}
            <div className="relative z-10 flex items-start justify-between gap-3 mb-2 flex-shrink-0">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full bg-slate-950/80 text-emerald-300 border border-emerald-500/30 backdrop-blur-md shadow-lg">
                {proj.category}
              </span>
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 backdrop-blur-md shadow-lg flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                {proj.status}
              </span>
            </div>

            {/* Middle: Project Title & Location */}
            <div className="relative z-10 my-auto py-2">
              <h3 className="text-base sm:text-lg md:text-xl font-black text-white leading-snug mb-2 group-hover:text-emerald-200 transition-colors drop-shadow-md">
                {proj.title}
              </h3>
              <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-300 font-medium">
                <MapPin className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{proj.location}</span>
              </div>
            </div>

            {/* Bottom Row: Progress Bar & Allocated Budget */}
            <div className="relative z-10 pt-3 border-t border-white/15 flex flex-col gap-2 flex-shrink-0 backdrop-blur-sm">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-slate-300 font-semibold">Physical Completion</span>
                <span className="font-mono font-black text-emerald-300 drop-shadow">{proj.progress}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-950/80 border border-white/10 rounded-full overflow-hidden p-0.5">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 rounded-full shadow-sm shadow-emerald-400/50 transition-all duration-500"
                  style={{ width: `${proj.progress}%` }}
                />
              </div>

              {proj.budget && (
                <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-300 mt-0.5 font-medium">
                  <span>Authorized Budget:</span>
                  <span className="font-mono font-black text-white bg-slate-950/80 px-2.5 py-0.5 rounded border border-emerald-500/30">
                    {proj.budget}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Note */}
      <div className="relative z-10 flex items-center justify-between text-[11px] sm:text-xs text-slate-400 pt-2 border-t border-white/10 flex-shrink-0">
        <span>Public Funds Transparency Act • Municipal Engineering & Planning Development Office</span>
        <span className="font-semibold text-emerald-400">E-LGU Citizen Portal</span>
      </div>
    </div>
  );
}

// ────────── Sub-Slide 4: Latest Municipal News & Press Releases ──────────
function NewsSlideView({ news }: { news: NewsItem[] }) {
  const displayNews = news.length > 0 ? news : DEFAULT_NEWS;
  const leadArticle = displayNews[0];
  const sideArticles = displayNews.slice(1, 3);

  return (
    <div className="relative w-full h-full flex flex-col justify-between p-5 sm:p-7 md:p-10 lg:p-12 overflow-y-auto lg:overflow-hidden bg-gradient-to-br from-[#06142e] via-[#050816] to-[#0f1f38]">
      {/* Dynamic Background Glow Accent */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between border-b border-white/10 pb-4 md:pb-5 gap-2 flex-shrink-0">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[10px] sm:text-[11px] font-black uppercase tracking-widest mb-1.5 shadow-lg shadow-blue-500/10">
            <Newspaper className="w-3.5 h-3.5" />
            Public Information & Press Releases
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-snug">
            Latest Municipal News
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Verified updates, developmental milestones, and community dispatches from the Municipal Government.
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 flex-shrink-0">
          <Clock className="w-3.5 h-3.5 text-blue-400" />
          <span>Updated Daily • Municipal Press Office</span>
        </div>
      </div>

      {/* Main News Showcase (Full-height Flex Grid) */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 my-auto py-3 flex-1 min-h-0 items-stretch">
        {/* Left: Featured Lead Story (7 cols) */}
        {leadArticle ? (
          <div className="lg:col-span-7 flex flex-col rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-blue-500/30 shadow-2xl shadow-blue-950/40 backdrop-blur-xl overflow-hidden group">
            {/* Lead Image Banner */}
            <div className="relative h-48 sm:h-56 md:h-64 w-full bg-slate-950 overflow-hidden flex-shrink-0">
              {leadArticle.imageUrl ? (
                <Image
                  src={leadArticle.imageUrl}
                  alt={leadArticle.title}
                  fill
                  className="object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-950 via-slate-900 to-slate-950 text-blue-400">
                  <Newspaper className="w-16 h-16 opacity-30" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
              
              {/* Floating Meta Badges */}
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-600 text-white shadow-lg shadow-blue-950/50">
                  ★ Lead Story
                </span>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-slate-950/80 backdrop-blur-md border border-white/20 text-blue-300">
                  {leadArticle.category}
                </span>
              </div>
              <div className="absolute bottom-3 left-4 flex items-center gap-2 text-xs text-slate-300">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <span>
                  {new Date(leadArticle.publishDate).toLocaleDateString("en-PH", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                {leadArticle.author && (
                  <>
                    <span>•</span>
                    <span className="text-slate-400">{leadArticle.author}</span>
                  </>
                )}
              </div>
            </div>

            {/* Lead Body Content */}
            <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between overflow-y-auto">
              <div>
                <h3 className="text-lg sm:text-xl md:text-2xl font-black text-white leading-snug tracking-tight mb-2.5 group-hover:text-blue-200 transition-colors">
                  {leadArticle.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed">
                  {leadArticle.content}
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-blue-400">
                  Official Public Release
                </span>
                <span>Verified by Public Information Office</span>
              </div>
            </div>
          </div>
        ) : null}

        {/* Right: Secondary Stories Stack (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4 justify-between">
          {sideArticles.map((item, idx) => (
            <div
              key={item.id || idx}
              className="flex-1 flex flex-col rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950/80 border border-white/10 hover:border-blue-500/30 backdrop-blur-md overflow-hidden shadow-lg transition-all duration-300"
            >
              {/* Top Banner Cover Image (Matching Left Card Style) */}
              <div className="relative h-28 sm:h-32 w-full bg-slate-950 overflow-hidden flex-shrink-0">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.title}
                    fill
                    className="object-cover object-center"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-950/60 via-slate-900 to-slate-950 text-blue-400">
                    <Newspaper className="w-10 h-10 opacity-30" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                {/* Floating Category & Date Badges on Banner */}
                <div className="absolute top-2.5 left-3 flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/30 backdrop-blur-md border border-blue-400/40 text-blue-200">
                    {item.category}
                  </span>
                </div>

                <div className="absolute bottom-2 left-3 flex items-center gap-1.5 text-[11px] text-slate-300">
                  <Calendar className="w-3 h-3 text-blue-400" />
                  <span>
                    {new Date(item.publishDate).toLocaleDateString("en-PH", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 flex flex-col justify-between overflow-y-auto">
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-white leading-snug mb-1.5">
                    {item.title}
                  </h4>
                  <p className="text-xs text-slate-300/90 leading-relaxed">
                    {item.content}
                  </p>
                </div>

                {/* Clean Non-Clickable Metadata Footer */}
                <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                  <span>{item.author || "Municipal Press Office"}</span>
                  <span className="text-blue-400/90 font-medium">
                    Verified Press Release
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Meta */}
      <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-white/10 flex-shrink-0">
        <span>Information & Communications Technology Office (ICTO)</span>
        <span className="font-semibold text-blue-400">Official Municipal Gazette & Press Feed</span>
      </div>
    </div>
  );
}

// ────────── Sub-Slide 5: Official Public Advisories & Circulars ──────────
function NoticesSlideView({ announcements }: { announcements: AnnouncementItem[] }) {
  const displayAnnouncements = announcements.length > 0 ? announcements : DEFAULT_ANNOUNCEMENTS;
  // Display top 4 notices in a 2x2 spacious civic grid
  const notices = displayAnnouncements.slice(0, 4);

  return (
    <div className="relative w-full h-full flex flex-col justify-between p-5 sm:p-7 md:p-10 lg:p-12 overflow-y-auto lg:overflow-hidden bg-gradient-to-br from-[#1c1204] via-[#080705] to-[#12101e]">
      {/* Background Glow */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between border-b border-white/10 pb-4 md:pb-5 gap-2 flex-shrink-0">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-[10px] sm:text-[11px] font-black uppercase tracking-widest mb-1.5 shadow-lg shadow-amber-500/10">
            <Megaphone className="w-3.5 h-3.5" />
            Official Notices, Executive Orders & Bulletins
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-snug">
            Public Advisories & Circulars
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Immediate executive memorandums, citizen reminders, and official public notices from the Office of the Mayor.
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 flex-shrink-0">
          <Bell className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
          <span>Active Bulletins • Office of the Municipal Mayor</span>
        </div>
      </div>

      {/* 2x2 Grand Bulletin Board Grid */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 my-auto py-3 flex-1 min-h-0 items-stretch">
        {notices.map((notice, idx) => {
          const isUrgent = notice.priority === "URGENT";
          return (
            <div
              key={notice.id || idx}
              className={`flex flex-col justify-between p-5 sm:p-6 rounded-2xl backdrop-blur-xl border transition-all duration-300 shadow-xl ${
                isUrgent
                  ? "bg-gradient-to-br from-rose-950/30 via-slate-900/80 to-slate-950/90 border-rose-500/40 shadow-rose-950/30 ring-1 ring-rose-500/20"
                  : "bg-slate-900/70 hover:bg-slate-900/90 border-white/10 hover:border-amber-500/30 shadow-slate-950/40"
              }`}
            >
              <div>
                {/* Header tags: Priority, Category, Date */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    {isUrgent ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] sm:text-[11px] font-black uppercase tracking-wider animate-pulse">
                        <AlertTriangle className="w-3 h-3 text-rose-400" />
                        Urgent Advisory
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">
                        <Megaphone className="w-3 h-3 text-amber-400" />
                        Announcement
                      </span>
                    )}

                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/5 text-slate-300 border border-white/10">
                      {notice.category}
                    </span>
                  </div>

                  <span className="text-[11px] text-slate-400 font-medium">
                    {new Date(notice.createdAt).toLocaleDateString("en-PH", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-base sm:text-lg font-black text-white leading-snug mb-2.5 tracking-tight">
                  {notice.title}
                </h3>

                {/* Content */}
                <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed">
                  {notice.content}
                </p>
              </div>

              {/* Card Footer */}
              <div className="mt-4 pt-3.5 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className={`w-3.5 h-3.5 ${isUrgent ? "text-rose-400" : "text-emerald-400"}`} />
                  Official Compliance Notice
                </span>
                <span className={`font-bold ${isUrgent ? "text-rose-400" : "text-amber-400"}`}>
                  Local Government Unit
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Meta */}
      <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-white/10 flex-shrink-0">
        <span>Office of the Mayor & Sangguniang Bayan Secretariat</span>
        <span className="font-semibold text-amber-400">Public Records & Administrative Orders</span>
      </div>
    </div>
  );
}

// ────────── Sub-Slide 6: Public Safety & Emergency Hotlines ──────────
function EmergencySlideView({ hotlines }: { hotlines: HotlineItem[] }) {
  const displayHotlines = hotlines.length > 0 ? hotlines : DEFAULT_HOTLINES;

  // Department icon and color mapping helper
  const getDeptStyling = (category: string, index: number) => {
    const cat = category.toLowerCase();
    if (cat.includes("disaster") || cat.includes("ambulance") || cat.includes("rescue")) {
      return {
        icon: <Siren className="w-5 h-5 sm:w-6 sm:h-6 text-rose-400" />,
        badgeBg: "bg-rose-500/20 text-rose-300 border-rose-500/40",
        border: "border-rose-500/40 hover:border-rose-400/80 shadow-rose-950/40",
        glow: "from-rose-950/40 via-slate-900/90 to-slate-950/95",
        phoneColor: "text-rose-300",
        ring: "ring-rose-500/20",
        pulse: true,
      };
    }
    if (cat.includes("police") || cat.includes("law") || cat.includes("security")) {
      return {
        icon: <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />,
        badgeBg: "bg-blue-500/20 text-blue-300 border-blue-500/40",
        border: "border-blue-500/40 hover:border-blue-400/80 shadow-blue-950/40",
        glow: "from-blue-950/40 via-slate-900/90 to-slate-950/95",
        phoneColor: "text-blue-300",
        ring: "ring-blue-500/20",
        pulse: false,
      };
    }
    if (cat.includes("fire") || cat.includes("hazmat")) {
      return {
        icon: <Flame className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />,
        badgeBg: "bg-amber-500/20 text-amber-300 border-amber-500/40",
        border: "border-amber-500/40 hover:border-amber-400/80 shadow-amber-950/40",
        glow: "from-amber-950/40 via-slate-900/90 to-slate-950/95",
        phoneColor: "text-amber-300",
        ring: "ring-amber-500/20",
        pulse: false,
      };
    }
    if (cat.includes("medical") || cat.includes("health")) {
      return {
        icon: <HeartPulse className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />,
        badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
        border: "border-emerald-500/40 hover:border-emerald-400/80 shadow-emerald-950/40",
        glow: "from-emerald-950/40 via-slate-900/90 to-slate-950/95",
        phoneColor: "text-emerald-300",
        ring: "ring-emerald-500/20",
        pulse: false,
      };
    }
    if (cat.includes("executive") || cat.includes("mayor")) {
      return {
        icon: <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />,
        badgeBg: "bg-purple-500/20 text-purple-300 border-purple-500/40",
        border: "border-purple-500/40 hover:border-purple-400/80 shadow-purple-950/40",
        glow: "from-purple-950/40 via-slate-900/90 to-slate-950/95",
        phoneColor: "text-purple-300",
        ring: "ring-purple-500/20",
        pulse: false,
      };
    }
    // Default / POSO
    return {
      icon: <PhoneCall className="w-5 h-5 sm:w-6 sm:h-6 text-teal-400" />,
      badgeBg: "bg-teal-500/20 text-teal-300 border-teal-500/40",
      border: "border-teal-500/40 hover:border-teal-400/80 shadow-teal-950/40",
      glow: "from-teal-950/40 via-slate-900/90 to-slate-950/95",
      phoneColor: "text-teal-300",
      ring: "ring-teal-500/20",
      pulse: false,
    };
  };

  return (
    <div className="relative w-full h-full flex flex-col justify-between p-5 sm:p-7 md:p-10 lg:p-12 overflow-y-auto lg:overflow-hidden bg-gradient-to-br from-[#1a070c] via-[#070914] to-[#120711]">
      {/* Dynamic Background Warning Glow Elements */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between border-b border-white/10 pb-4 md:pb-5 gap-2 flex-shrink-0">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-400/30 text-rose-300 text-[10px] sm:text-[11px] font-black uppercase tracking-widest mb-1.5 shadow-lg shadow-rose-950/50 animate-pulse">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            24/7 Command Center & First Responders
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-snug">
            Emergency Hotlines & Medical Dispatch
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Round-the-clock emergency assistance, ambulance dispatch, disaster rescue, and public safety units.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-black uppercase tracking-wider">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            </span>
            <span>All Units On 24/7 Standby</span>
          </div>
        </div>
      </div>

      {/* Full-Height 3x3 Command Grid (3 columns x 3 rows = 9 items) */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 my-auto py-1.5 flex-1 min-h-0 items-stretch">
        {displayHotlines.slice(0, 9).map((h, idx) => {
          const number = "telephone" in h 
            ? (h as HotlineItem).mobileNumber || (h as HotlineItem).telephone || "(075) 555-0000"
            : (h as { phone: string }).phone;

          const scopeText = "scope" in h 
            ? (h as { scope: string }).scope 
            : "Emergency dispatch, public assistance, and incident coordination within the municipality.";

          const style = getDeptStyling(h.category, idx);

          return (
            <div 
              key={idx}
              className={`flex flex-col justify-between p-3 sm:p-3.5 rounded-xl bg-gradient-to-br ${style.glow} border ${style.border} ring-1 ${style.ring} backdrop-blur-xl shadow-md hover:shadow-lg transition-all duration-300 group`}
            >
              {/* Card Top: Category Pill & 24/7 Status Badge */}
              <div>
                <div className="flex items-center justify-between gap-1.5 mb-1.5">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border ${style.badgeBg}`}>
                    {h.category}
                  </span>

                  <span className="px-1.5 py-0.5 rounded text-[8.5px] font-bold text-slate-400 bg-white/5 border border-white/10">
                    24/7 Active
                  </span>
                </div>

                {/* Agency Name */}
                <h3 className="text-xs sm:text-sm font-bold text-white leading-snug tracking-tight mb-1 group-hover:text-rose-100 transition-colors line-clamp-1">
                  {h.name}
                </h3>

                {/* Scope & Mission */}
                <p className="text-[10.5px] sm:text-[11px] text-slate-300/80 leading-snug line-clamp-2">
                  {scopeText}
                </p>
              </div>

              {/* Card Bottom: Monospace Dial Number */}
              <div className="mt-2 pt-2 border-t border-white/10 flex items-baseline justify-between">
                <div>
                  <div className="text-[8.5px] font-bold uppercase tracking-widest text-slate-400">
                    Direct Hotline
                  </div>
                  <div className={`text-sm sm:text-base md:text-lg font-black font-mono tracking-wider ${style.phoneColor}`}>
                    {number}
                  </div>
                </div>
                <span className="text-[9px] text-slate-400 font-medium">
                  Toll-Free LGU
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Readiness Bar */}
      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 pt-3 border-t border-white/10 gap-2 flex-shrink-0">
        <div className="flex items-center gap-2 text-slate-300">
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <span>Municipal Disaster Risk Reduction & Management Office (MDRRMO) • Command Post</span>
        </div>
        <div className="flex items-center gap-3 font-semibold text-rose-400">
          <span>Official Dispatch Terminal</span>
          <span className="text-white/20">•</span>
          <span className="text-slate-400 font-normal">Local Government Unit</span>
        </div>
      </div>
    </div>
  );
}

// ────────── Live PST Digital Clock ──────────
function PSTClock() {
  const [timeStr, setTimeStr] = useState("");
  const [dateStr, setDateStr] = useState("");

  useEffect(() => {
    function update() {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("en-PH", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
      setDateStr(
        now.toLocaleDateString("en-PH", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      );
    }
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-right flex flex-col justify-center">
      <div className="text-xl md:text-2xl font-black font-mono text-white tracking-wide leading-none">
        {timeStr || "--:--:--"}
      </div>
      <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-400 mt-1">
        PST • {dateStr || "Philippine Time"}
      </div>
    </div>
  );
}

// ────────── Main Kiosk Slideshow Component ──────────
export default function KioskSlideshow() {
  const [feed, setFeed] = useState<KioskFeedData | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [progress, setProgress] = useState(0);

  // Total slides count:
  // 0: Hero Slide
  // 1: Services Directory
  // 2: Municipal Leadership & Council Directory
  // 3: Major Infrastructure & Public Works Projects
  // 4: Latest Municipal News & Press Releases
  // 5: Official Public Advisories & Circulars
  // 6: Emergency Hotlines & Medical Dispatch
  const TOTAL_SLIDES = 7;

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % TOTAL_SLIDES);
    setProgress(0);
  }, [TOTAL_SLIDES]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + TOTAL_SLIDES) % TOTAL_SLIDES);
    setProgress(0);
  }, [TOTAL_SLIDES]);

  // Fetch Kiosk Feed Data
  useEffect(() => {
    async function loadFeed() {
      try {
        const res = await fetch("/api/kiosk/feed");
        if (res.ok) {
          const data = await res.json();
          setFeed(data);
        }
      } catch (err) {
        console.error("Failed to load kiosk feed data:", err);
      }
    }
    loadFeed();
    // Poll updates every 3 minutes
    const interval = setInterval(loadFeed, 180000);
    return () => clearInterval(interval);
  }, []);

  // Automatic Slide Rotation
  useEffect(() => {
    const timer = setInterval(nextSlide, SLIDE_DURATION);
    return () => clearInterval(timer);
  }, [nextSlide, currentSlide]);

  // Smooth Progress Bar
  useEffect(() => {
    setProgress(0);
    const step = 100 / (SLIDE_DURATION / 100);
    const pTimer = setInterval(() => {
      setProgress((old) => Math.min(old + step, 100));
    }, 100);
    return () => clearInterval(pTimer);
  }, [currentSlide]);

  return (
    <div className="relative w-screen h-screen flex flex-col bg-[#050816] text-white overflow-hidden select-none">
      {/* ────────── Persistent Top Executive Header ────────── */}
      <header className="relative z-50 h-16 sm:h-20 px-4 sm:px-8 bg-slate-950/90 border-b border-white/10 backdrop-blur-xl flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-14 sm:h-14 bg-white rounded-full flex items-center justify-center p-1 shadow-lg shadow-black/50 border border-emerald-500/30 flex-shrink-0">
            <LGULogo size={40} className="object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg md:text-xl font-black uppercase tracking-wider text-white">
                Local Government Unit
              </h1>
              <span className="hidden md:inline-block px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-widest border border-emerald-500/30">
                E-LGU
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-400 font-medium line-clamp-1">
              Official Interactive Public Service & Information Terminal
            </p>
          </div>
        </div>

        {/* Right Status Badges & PST Clock */}
        <div className="flex items-center gap-3 sm:gap-6">
          {/* RFID Hardware Active Pulse */}
          <div className="hidden sm:flex items-center gap-2.5 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] sm:text-xs font-bold">
            <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-emerald-500"></span>
            </span>
            <span>RFID Ready</span>
          </div>

          <div className="h-6 sm:h-8 w-px bg-white/10 hidden sm:block" />

          <PSTClock />
        </div>
      </header>

      {/* ────────── Urgent Announcement Marquee Ticker ────────── */}
      <div className="relative z-40 bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 border-b border-emerald-500/20 py-1.5 px-3 sm:px-6 flex items-center overflow-hidden flex-shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2 text-emerald-300 font-black text-[10px] sm:text-xs uppercase tracking-widest pr-2 sm:pr-4 border-r border-emerald-400/20 flex-shrink-0">
          <Radio className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 animate-pulse" />
          <span>Notice:</span>
        </div>

        <div className="overflow-hidden whitespace-nowrap w-full pl-3 sm:pl-4">
          <div className="inline-block animate-[ticker_110s_linear_infinite] hover:[animation-play-state:paused] text-xs font-semibold text-slate-200">
            {feed?.announcements && feed.announcements.length > 0 ? (
              feed.announcements.map((a, i) => (
                <Fragment key={i}>
                  <span className="text-amber-300 font-bold">[{a.category}]</span> {a.title}: {a.content}
                  <span className="mx-4 sm:mx-6 text-emerald-400">●</span>
                </Fragment>
              ))
            ) : null}
            <span>Welcome to the Municipal Hall • Office hours: Mon to Fri, 8:00 AM – 5:00 PM</span>
            <span className="mx-4 sm:mx-6 text-emerald-400">●</span>
            <span>For inquiries, contact the Mayor&apos;s Information Desk at (075) 555-0000</span>
            <span className="mx-4 sm:mx-6 text-emerald-400">●</span>
            <span>Always secure and present your official Resident ID for fast lane verification</span>
            <span className="mx-4 sm:mx-6 text-emerald-400">●</span>
          </div>
        </div>
      </div>

      {/* ────────── Center Carousel Showcase ────────── */}
      <main className="relative flex-1 w-full overflow-hidden">
        {/* Slide 0: Hero */}
        <div className={`absolute inset-0 transition-opacity duration-1000 ${currentSlide === 0 ? "opacity-100 z-10 pointer-events-auto" : "opacity-0 z-0 pointer-events-none"}`}>
          <HeroSlideView slide={feed?.heroSlides?.[0]} />
        </div>

        {/* Slide 1: Services Directory */}
        <div className={`absolute inset-0 transition-opacity duration-1000 ${currentSlide === 1 ? "opacity-100 z-10 pointer-events-auto" : "opacity-0 z-0 pointer-events-none"}`}>
          <ServicesSlideView services={feed?.services || []} />
        </div>

        {/* Slide 2: Municipal Leadership & Council */}
        <div className={`absolute inset-0 transition-opacity duration-1000 ${currentSlide === 2 ? "opacity-100 z-10 pointer-events-auto" : "opacity-0 z-0 pointer-events-none"}`}>
          <LeadershipSlideView officials={feed?.officials || []} />
        </div>

        {/* Slide 3: Major Public Works & Infrastructure Projects */}
        <div className={`absolute inset-0 transition-opacity duration-1000 ${currentSlide === 3 ? "opacity-100 z-10 pointer-events-auto" : "opacity-0 z-0 pointer-events-none"}`}>
          <ProjectsSlideView projects={feed?.projects || []} />
        </div>

        {/* Slide 4: Latest Municipal News & Press Releases */}
        <div className={`absolute inset-0 transition-opacity duration-1000 ${currentSlide === 4 ? "opacity-100 z-10 pointer-events-auto" : "opacity-0 z-0 pointer-events-none"}`}>
          <NewsSlideView news={feed?.newsList || []} />
        </div>

        {/* Slide 5: Official Public Advisories & Circulars */}
        <div className={`absolute inset-0 transition-opacity duration-1000 ${currentSlide === 5 ? "opacity-100 z-10 pointer-events-auto" : "opacity-0 z-0 pointer-events-none"}`}>
          <NoticesSlideView announcements={feed?.announcements || []} />
        </div>

        {/* Slide 6: Emergency Hotlines & Dispatch */}
        <div className={`absolute inset-0 transition-opacity duration-1000 ${currentSlide === 6 ? "opacity-100 z-10 pointer-events-auto" : "opacity-0 z-0 pointer-events-none"}`}>
          <EmergencySlideView hotlines={feed?.hotlines || []} />
        </div>
      </main>

      {/* ────────── Persistent Bottom Beacon ("Tap RFID to Start") ────────── */}
      <footer className="relative z-50 h-20 sm:h-24 px-4 sm:px-8 bg-slate-950/95 border-t border-white/10 backdrop-blur-2xl flex items-center justify-between flex-shrink-0">
        {/* Previous Slide Button */}
        <button 
          onClick={prevSlide}
          className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-[11px] sm:text-xs font-bold text-slate-300 transition-colors flex items-center gap-1.5"
        >
          ← <span className="hidden sm:inline">Prev</span>
        </button>

        {/* Prominent Tap Card CTA */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 sm:gap-3 px-3.5 sm:px-6 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-600/30 via-teal-500/30 to-emerald-600/30 border border-emerald-400/40 shadow-2xl shadow-emerald-500/20 animate-pulse">
            <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-300 animate-bounce" />
            <div className="text-center">
              <div className="text-xs sm:text-sm font-black uppercase tracking-wider sm:tracking-widest text-white">
                Tap Resident RFID Card To Begin
              </div>
              <div className="text-[10px] sm:text-[11px] font-medium text-emerald-300 hidden sm:block">
                I-tap ang inyong RFID card upang mag-transact
              </div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-300 hidden sm:block" />
          </div>

          {/* Dots Indicator */}
          <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
            {Array.from({ length: TOTAL_SLIDES }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCurrentSlide(idx);
                  setProgress(0);
                }}
                className={`h-1.5 transition-all duration-300 rounded-full ${
                  currentSlide === idx ? "w-6 sm:w-8 bg-emerald-400 shadow-md shadow-emerald-400/50" : "w-1.5 sm:w-2 bg-white/20"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Next Slide Button */}
        <button 
          onClick={nextSlide}
          className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-[11px] sm:text-xs font-bold text-slate-300 transition-colors flex items-center gap-1.5"
        >
          <span className="hidden sm:inline">Next</span> →
        </button>

        {/* Bottom edge progress line */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900">
          <div 
            className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </footer>
    </div>
  );
}

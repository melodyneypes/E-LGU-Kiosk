"use client";

import React, { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";


import {
  FileText,
  CreditCard,
  Users,
  HeartPulse,
  HandHelping,
  Megaphone,
  LogOut,
  Clock,
  ShieldCheck,
  Building2,
  Home,
  Search,
  ChevronRight,
  ChevronDown,
  UserCircle,
  User,
  Ticket,
  Volume2,
  X,
  Sun,
  Moon,
  Newspaper
} from "lucide-react";
import lguConfig from "@/lgu.config.json";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const AUTO_LOGOUT_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_SERVICE_AUTO_LOGOUT?.toLowerCase() === "true";

type Service = {
  id: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  category: string;
};

const MUNICIPAL_SERVICES = (lang: "en" | "fil" | "pang" | "ilo"): Service[] => [
  {
    id: "p1",
    category: "Permits",
    title: lang === "en" ? "Business Permit" : (lang === "fil" ? "Pahintulot sa Negosyo" : (lang === "pang" ? "Permiso na Negosyo" : "Permiso ti Negosio")),
    desc: lang === "en" ? "New application or renewal of business license" : (lang === "fil" ? "Bagong aplikasyon o pagpapabago ng lisensya sa negosyo" : (lang === "pang" ? "Pan-apply na bago odino pan-renew na lisensya na negosyo" : "Baro nga aplikasion wenno pannakapabaro ti lisensya ti negosio")),
    icon: <Building2 className="w-10 h-10" />
  },
  {
    id: "p3",
    category: "Permits",
    title: lang === "en" ? "Building Permit" : (lang === "fil" ? "Pahintulot sa Gusali" : (lang === "pang" ? "Permiso na Algeban" : "Permiso ti Pannakabangon ti Pasdek")),
    desc: lang === "en" ? "Apply for new construction and building clearances" : (lang === "fil" ? "Mag-apply para sa bagong konstruksyon at mga clearance sa gusali" : (lang === "pang" ? "Man-apply na algeban tan saray clearance na abong" : "Ag-apply para iti baro a pannakabangon ken clearances ti pasdek")),
    icon: <Building2 className="w-10 h-10" />
  },
  {
    id: "p4",
    category: "Permits",
    title: lang === "en" ? "Occupancy Permit" : (lang === "fil" ? "Pahintulot sa Okupasyon" : (lang === "pang" ? "Permiso ed Panag-okupa" : "Permiso ti Panag-okupa")),
    desc: lang === "en" ? "Apply for certificate of occupancy" : (lang === "fil" ? "Mag-apply para sa sertipiko ng okupasyon" : (lang === "pang" ? "Man-apply para ed sertipiko na okupasyon" : "Ag-apply para iti sertipiko ti panag-okupa")),
    icon: <Building2 className="w-10 h-10" />
  },
  {
    id: "t2",
    category: "Taxes",
    title: lang === "en" ? "Community Tax" : (lang === "fil" ? "Buwis sa Komunidad" : (lang === "pang" ? "Buwis na Komunidad" : "Buis ti Komunidad")),
    desc: lang === "en" ? "Get your Cedula (CTC) quickly" : (lang === "fil" ? "Kumuha ng iyong Cedula (CTC) nang mabilis" : (lang === "pang" ? "Pangala na Cedula (CTC) ya maples" : "Mangala ti Sedula (CTC) a sipartak")),
    icon: <FileText className="w-10 h-10" />
  },
  {
    id: "t3",
    category: "Taxes",
    title: lang === "en" ? "Real Property Tax" : (lang === "fil" ? "Amilyar (RPT)" : (lang === "pang" ? "Amilyar (RPT)" : "Amilyar (RPT)")),
    desc: lang === "en" ? "Pay your real property tax online" : (lang === "fil" ? "Magbayad ng amilyar online" : (lang === "pang" ? "Manbayad na amilyar online" : "Agbayad ti amilyar online")),
    icon: <CreditCard className="w-10 h-10" />
  },
  {
    id: "c1",
    category: "Records",
    title: lang === "en" ? "Civil Registry" : (lang === "fil" ? "Rehistrong Sibil" : (lang === "pang" ? "Sibil ya Rehistro" : "Sibil a Rehistro")),
    desc: lang === "en" ? "Birth, marriage, death registration and certificate requests" : (lang === "fil" ? "Aplikasyon para sa kapanganakan, kasal, kamatayan, at iba pa" : (lang === "pang" ? "Aplikasyon para ed niyanak, kasal, inatey, tan arum ni" : "Aplikasion para iti pannakayanak, kasar, ipupusay, ken dadduma pay")),
    icon: <Users className="w-10 h-10" />
  },
];

const BARANGAY_SERVICES = (lang: "en" | "fil" | "pang" | "ilo"): Service[] => [
  {
    id: "b1",
    category: "Certification",
    title: lang === "en" ? "Barangay Clearance" : (lang === "fil" ? "Barangay Clearance" : (lang === "pang" ? "Barangay Clearance" : "Barangay Clearance")),
    desc: lang === "en" ? "Standard clearance for various purposes" : (lang === "fil" ? "Karaniwang clearance para sa iba't ibang layunin" : (lang === "pang" ? "Karaniwang clearance para ed nanduruman usar" : "Kadawyan a clearance para iti nadumaduma a gakat")),
    icon: <ShieldCheck className="w-10 h-10" />
  },
  {
    id: "b2",
    category: "Certification",
    title: lang === "en" ? "Indigency Certificate" : (lang === "fil" ? "Sertipiko ng Indigency" : (lang === "pang" ? "Sertipiko na Indigency" : "Sertipiko ti Indigency")),
    desc: lang === "en" ? "For social services and financial aid" : (lang === "fil" ? "Para sa mga serbisyong panlipunan at tulong pinansyal" : (lang === "pang" ? "Para ed tulong panlipunan tan tulong pinansyal" : "Para iti serbisio sosial ken tulong finansyal")),
    icon: <HandHelping className="w-10 h-10" />
  },
  {
    id: "b3",
    category: "Certification",
    title: lang === "en" ? "Residency Certificate" : (lang === "fil" ? "Sertipiko ng Residency" : (lang === "pang" ? "Sertipiko na Panrehente" : "Sertipiko ti Residensia")),
    desc: lang === "en" ? "Proof of address within the barangay" : (lang === "fil" ? "Katibayan ng address sa loob ng barangay" : (lang === "pang" ? "Katibayan na address ed loob na barangay" : "Pammaneknek ti pagnaedan iti uneg ti barangay")),
    icon: <Home className="w-10 h-10" />
  },
  {
    id: "b4",
    category: "News",
    title: lang === "en" ? "Announcements" : (lang === "fil" ? "Mga Anunsyo" : (lang === "pang" ? "Saray Anunsyo" : "Dagiti Pakdaar")),
    desc: lang === "en" ? "Latest barangay updates and events" : (lang === "fil" ? "Mga pinakabagong balita at kaganapan sa barangay" : (lang === "pang" ? "Saray bago ya balita tan kaganapan ed barangay" : "Kababaroan a damdamag ken pasken iti barangay")),
    icon: <Megaphone className="w-10 h-10" />
  },
  {
    id: "b5",
    category: "News",
    title: lang === "en" ? "Barangay News & Bulletins" : (lang === "fil" ? "Balita at Ulat sa Barangay" : (lang === "pang" ? "Balita tan Ulat ed Barangay" : "Damdamag ken Pakaammo ti Barangay")),
    desc: lang === "en" ? "Community advisories, projects, and public information" : (lang === "fil" ? "Mga anunsyo sa komunidad, proyekto, at pampublikong impormasyon" : (lang === "pang" ? "Saray pampublikong anunsyo, proyekto, tan impormasyon" : "Dagiti pakaammo iti komunidad, proyekto, ken publiko nga impormasion")),
    icon: <Newspaper className="w-10 h-10" />
  },
];

const CATEGORIES = {
  municipal: ["All", "Permits", "Taxes", "Records"],
  barangay: ["All", "Certification", "News"]
};

const TRANSLATIONS = {
  en: {
    verifiedSession: "VERIFIED SESSION",
    municipalCenter: "Municipal Center",
    barangayCenter: "Barangay Center",
    authenticatedResident: "Authenticated Resident",
    localCitizen: "Local Citizen",
    portal: "Portal",
    exit: "Exit",
    services: "Services",
    availableIn: "Available in E-LGU Portal",
    session: "Session",
    total: "TOTAL",
    servicesCount: "SERVICES",
    systemOnline: "System Online",
    startApp: "Start Application",
    voiceGuide: "Voice Guide",
    playAudio: "Play Audio",
    categories: {
      All: "All",
      Permits: "Permits",
      Taxes: "Taxes",
      Records: "Records",
      Health: "Health",
      Certification: "Certification",
      News: "News"
    }
  },
  fil: {
    verifiedSession: "BERIPIKADONG SESYON",
    municipalCenter: "Sentro ng Munisipyo",
    barangayCenter: "Sentro ng Barangay",
    authenticatedResident: "Nakatalagang Mamamayan",
    localCitizen: "Lokal na Mamamayan",
    portal: "Portal",
    exit: "Labas",
    services: "mga Serbisyo",
    availableIn: "Magagamit sa E-LGU Portal",
    session: "Sesyon",
    total: "KABUUAN",
    servicesCount: "SERBISYO",
    systemOnline: "Aktibo ang Sistema",
    startApp: "Simulan ang Aplikasyon",
    voiceGuide: "Gabay sa Boses",
    playAudio: "Patugtugin",
    categories: {
      All: "Lahat",
      Permits: "Permiso",
      Taxes: "Buwis",
      Records: "Dokumento",
      Health: "Kalusugan",
      Certification: "Sertipiko",
      News: "Balita"
    }
  },
  pang: {
    verifiedSession: "APROBADO YA SESYON",
    municipalCenter: "Sentro na Munisipyo",
    barangayCenter: "Sentro na Barangay",
    authenticatedResident: "Beripikado ya Residente",
    localCitizen: "Lokal ya Umili",
    portal: "Portal",
    exit: "Paway",
    services: "saray Serbisyo",
    availableIn: "Nalmo ed E-LGU Portal",
    session: "Sesyon",
    total: "AMIN",
    servicesCount: "SERBISYO",
    systemOnline: "Aktibo so Sistema",
    startApp: "Gapoan so Aplikasyon",
    voiceGuide: "Tulong ed Boses",
    playAudio: "Dengelen",
    categories: {
      All: "Amin",
      Permits: "Permiso",
      Taxes: "Buwis",
      Records: "Dokumento",
      Health: "Salun-at",
      Certification: "Sertipikasyon",
      News: "Balita"
    }
  },
  ilo: {
    verifiedSession: "NASIGURADO A SESYON",
    municipalCenter: "Sentro ti Munisipyo",
    barangayCenter: "Sentro ti Barangay",
    authenticatedResident: "Beripikado a Residente",
    localCitizen: "Lokal nga Umili",
    portal: "Portal",
    exit: "Rummuar",
    services: "dagiti Serbisio",
    availableIn: "Adda iti E-LGU Portal",
    session: "Sesyon",
    total: "DAGUP",
    servicesCount: "SERBISIO",
    systemOnline: "Aktibo ti Sistema",
    startApp: "Irugi ti Aplikasion",
    voiceGuide: "Gubay ti Boses",
    playAudio: "Denggen",
    categories: {
      All: "Amin",
      Permits: "Permiso",
      Taxes: "Buis",
      Records: "Dokumento",
      Health: "Salun-at",
      Certification: "Sertipikasion",
      News: "Damdamag"
    }
  }
};

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const type = (searchParams.get("type") || "municipal") as "municipal" | "barangay";
  const [activeCategory, setActiveCategory] = useState("All");
  const [lang, setLang] = useState<"en" | "fil" | "pang" | "ilo">("en");
  const [resident, setResident] = useState<{
    id: string;
    fullName: string;
    firstName: string;
    photoUrl?: string;
    livenessUrl?: string;
    imageUrl?: string;
    idFrontUrl?: string;
    barangay?: string;
    email?: string;
    contactNumber?: string;
    municipality?: string;
  } | null>(null);

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [activeFontSize, setActiveFontSize] = useState<string>("md");

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    if (profileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [profileMenuOpen]);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("kiosk_font_size");
      if (saved) {
        setActiveFontSize(saved);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  React.useEffect(() => {
    const sizeMap: Record<string, string> = {
      sm: "16px",
      md: "19px",
      lg: "22px",
      xl: "25px"
    };
    try {
      document.documentElement.style.fontSize = sizeMap[activeFontSize] || "19px";
    } catch (e) {
      console.error(e);
    }
  }, [activeFontSize]);

  const applyFontSize = (size: string) => {
    try {
      localStorage.setItem("kiosk_font_size", size);
      setActiveFontSize(size);
    } catch (e) {
      console.error(e);
    }
  };

  const isDarkMode = (resolvedTheme || theme) === "dark";

  const logout = () => {
    sessionStorage.removeItem("active_resident");
    window.speechSynthesis?.cancel();
    router.replace("/");
  };

  React.useEffect(() => {
    const saved = sessionStorage.getItem("active_resident");
    if (!saved) {
      router.replace("/");
      return;
    }
    try {
      const parsed = JSON.parse(saved);
      if (!parsed) {
        sessionStorage.removeItem("active_resident");
        router.replace("/");
        return;
      }
      setResident(parsed);
    } catch (e) {
      console.error("Failed to parse resident session:", e);
      sessionStorage.removeItem("active_resident");
      router.replace("/");
    }
  }, [router]);

  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const residentPhotoUrl =
    resident?.photoUrl ||
    resident?.livenessUrl ||
    resident?.imageUrl ||
    resident?.idFrontUrl;

  const speakText = (text: string, voiceLang: string = "en-US") => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = voiceLang;

      // Select a natural/premium voice if available
      const voices = window.speechSynthesis.getVoices();

      // Look for natural or Google voices in the list matching the language
      const targetLang = voiceLang.toLowerCase().replace("_", "-");
      const bestVoice = voices.find(v => {
        const name = v.name.toLowerCase();
        const vLang = v.lang.toLowerCase().replace("_", "-");

        // Filter by matching language code prefix (e.g. 'en' or 'fil' / 'tl')
        const isLangMatch = vLang.startsWith(targetLang.split("-")[0]);

        // Prefer Google neural, Microsoft natural, or Apple premium voices
        const isNatural = name.includes("natural") || name.includes("google") || name.includes("premium") || name.includes("neural");

        return isLangMatch && isNatural;
      }) || voices.find(v => v.lang.toLowerCase().replace("_", "-").startsWith(targetLang.split("-")[0]));

      if (bestVoice) {
        utterance.voice = bestVoice;
      }

      // Voice adjustments to make it sound human-like
      utterance.rate = 0.95; // Slightly slower for clear, professional pacing
      utterance.pitch = 1.05; // Slightly warmer pitch
      utterance.volume = 1.0;  // Full clarity volume


      window.speechSynthesis.speak(utterance);
    }
  };

  const toggleVoice = () => {
    const nextState = !isVoiceEnabled;
    setIsVoiceEnabled(nextState);
    if (nextState) {
      // Speak indicator that voice is now ON
      let onMsg = "";
      if (lang === "en") onMsg = "Voice guide is now activated. Tap any service to hear its details.";
      else if (lang === "fil") onMsg = "Aktibo na ang gabay sa boses. Pindutin ang kahit anong serbisyo para marinig ang mga detalye.";
      else if (lang === "pang") onMsg = "Aktibo na so tulong ed boses. Pinduten so anggan dinan ya serbisyo para ed saray detalye.";
      else onMsg = "Aktibo ti gubay ti boses. Pinduten ti aniaman a serbisio tapno mangngeg ti detalye.";
      speakText(onMsg, lang === "en" ? "en-US" : "fil-PH");
    } else {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    }
  };

  const handleServiceClick = (service: Service) => {
    if (isVoiceEnabled) {
      const textToSpeak = `${service.title}. ${service.desc}`;
      speakText(textToSpeak, lang === "en" ? "en-US" : "fil-PH");
    }
    if (service.id === "p3") {
      router.push("/modules/building-permit");
    } else if (service.id === "p1") {
      router.push("/modules/business-permit-appointment");
    } else if (service.id === "p4") {
      router.push("/modules/occupancy");
    } else if (service.id === "c1") {
      router.push("/modules/civil-registry");
    } else if (service.id === "t2") {
      router.push("/modules/cedula-appointment");
    } else if (service.id === "t3") {
      router.push("/modules/rpt");
    }
  };

  const rawServices = type === "municipal" ? MUNICIPAL_SERVICES(lang) : BARANGAY_SERVICES(lang);
  const services = Array.isArray(rawServices) ? rawServices : [];
  const filteredServices = activeCategory === "All"
    ? services
    : services.filter(s => s.category === activeCategory);

  const categories = CATEGORIES[type];
  const [timeLeft, setTimeLeft] = React.useState(60);

  React.useEffect(() => {
    if (!AUTO_LOGOUT_ENABLED) return;

    let timeout: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      if (timeout) clearTimeout(timeout);
      setTimeLeft(60);
      timeout = setTimeout(() => {
        sessionStorage.removeItem("active_resident");
        window.speechSynthesis?.cancel();
        router.replace("/");
      }, 60000);
    };

    // Initial timer
    resetTimer();

    // Activities that reset the timer
    const activities = ["pointerdown", "keydown", "touchstart", "wheel", "scroll"];

    activities.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    // Countdown for visual feedback (optional but helpful)
    const countdown = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      if (timeout) clearTimeout(timeout);
      clearInterval(countdown);
      activities.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [router]);

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-[#f8fafc] dark:bg-[#070b14] overflow-hidden font-sans select-none transition-colors duration-300 ease-out">
      {/* SESSION TIMEOUT WARNING MODAL - MODERN GLASSMORPHIC */}
      {AUTO_LOGOUT_ENABLED && timeLeft <= 15 && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/75 p-6 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-[2.5rem] border border-amber-500/20 bg-white/95 dark:bg-[#0d1527]/95 p-8 text-center shadow-2xl backdrop-blur-2xl ring-1 ring-amber-500/10 scale-100 animate-in zoom-in-95 duration-200">
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-500/10 text-amber-500 shadow-inner">
              <span className="absolute inset-0 rounded-3xl bg-amber-400/20 animate-ping" />
              <Clock className="relative h-10 w-10 stroke-[2.5]" />
            </div>
            <span className="mt-6 inline-block rounded-full bg-amber-500/10 px-3.5 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-amber-600 dark:text-amber-400">
              Session Timeout Alert
            </span>
            <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
              Are you still there?
            </h2>
            <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
              For your privacy & security, this kiosk session will reset in{" "}
              <span className="font-black text-red-500 underline decoration-2 underline-offset-2">
                {timeLeft} second{timeLeft === 1 ? "" : "s"}
              </span>.
            </p>
            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  sessionStorage.removeItem("active_resident");
                  window.speechSynthesis?.cancel();
                  router.replace("/");
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-red-200/80 bg-red-50 dark:bg-red-950/40 dark:border-red-900/40 px-5 py-4 text-xs font-black uppercase tracking-wider text-red-600 dark:text-red-400 active:scale-95 transition-all shadow-sm"
              >
                <LogOut className="h-4 w-4" />
                Log Out
              </button>
              <button
                type="button"
                onClick={() => setTimeLeft(60)}
                className="flex-1 rounded-2xl bg-theme-primary hover:opacity-95 px-5 py-4 text-xs font-black uppercase tracking-wider text-white shadow-xl shadow-theme-primary/30 active:scale-95 transition-all font-sans"
              >
                Continue Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR NAVIGATION RAIL - ULTRA SLEEK GLASSMORPHIC DOCK */}
      <aside className="w-full md:w-28 lg:w-32 bg-white/90 dark:bg-[#0b1020]/90 backdrop-blur-2xl flex md:flex-col items-center justify-between md:justify-start py-3 px-4 md:py-8 md:px-3 shadow-xl md:shadow-2xl relative z-30 transition-colors duration-300 ease-out border-b md:border-b-0 md:border-r border-slate-200/80 dark:border-white/10 shrink-0">
        {/* LOGO BADGE */}
        <div className="md:mb-8 flex items-center gap-3 md:flex-col">
          <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-3xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-2 shadow-lg shadow-theme-primary/10 border border-slate-200/60 dark:border-white/10 transition-transform active:scale-95">
            <Image
              src={lguConfig.assets.logo}
              alt="LGU Logo"
              width={48}
              height={48}
              className="object-contain"
            />
          </div>
          <div className="block md:hidden">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">E-LGU</span>
            <h2 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight">Kiosk Portal</h2>
          </div>
        </div>

        {/* CATEGORY NAV BUTTONS */}
        <nav className="flex md:flex-col items-center gap-1.5 md:gap-3 flex-1 overflow-x-auto md:overflow-y-auto no-scrollbar max-w-full md:w-full py-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`group flex flex-col items-center justify-center py-2.5 px-3 md:py-4 md:px-2 rounded-2xl transition-all duration-300 shrink-0 active:scale-90 md:w-full relative ${
                activeCategory === cat
                  ? "bg-theme-primary text-white shadow-lg shadow-theme-primary/30 font-black scale-100"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <div className="mb-1 transition-transform duration-300 group-hover:scale-110">
                {cat === "All" && <Search className="w-5 h-5 md:w-6 md:h-6" />}
                {cat === "Permits" && <Building2 className="w-5 h-5 md:w-6 md:h-6" />}
                {cat === "Taxes" && <CreditCard className="w-5 h-5 md:w-6 md:h-6" />}
                {cat === "Records" && <FileText className="w-5 h-5 md:w-6 md:h-6" />}
                {cat === "Health" && <HeartPulse className="w-5 h-5 md:w-6 md:h-6" />}
                {cat === "Certification" && <ShieldCheck className="w-5 h-5 md:w-6 md:h-6" />}
                {cat === "News" && <Megaphone className="w-5 h-5 md:w-6 md:h-6" />}
              </div>
              <span className="text-[8px] md:text-[9px] font-black uppercase tracking-wider text-center leading-tight">
                {TRANSLATIONS[lang].categories[cat as keyof typeof TRANSLATIONS.en.categories]}
              </span>
              {activeCategory === cat && (
                <span className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-theme-primary rounded-l-full" />
              )}
            </button>
          ))}
        </nav>

        {/* EXIT BUTTON & SIDEBAR FOOTER */}
        <div className="md:mt-auto md:px-2 md:w-full md:pt-4 md:border-t md:border-slate-200/80 md:dark:border-white/10 shrink-0 flex flex-col items-center">
          <button
            onClick={() => {
              sessionStorage.removeItem("active_resident");
              router.push("/");
            }}
            className="flex flex-col items-center justify-center p-2.5 md:py-3 md:px-2 text-red-500 dark:text-red-400 hover:bg-red-500/10 rounded-2xl transition-all active:scale-95 group md:w-full cursor-pointer"
            title="Exit Session"
          >
            <LogOut className="w-5 h-5 md:w-6 md:h-6 mb-0.5 md:mb-1 transition-transform group-hover:translate-x-[-2px]" />
            <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest">{TRANSLATIONS[lang].exit}</span>
          </button>

          {/* SIDEBAR CIVIC FOOTER */}
          <div className="hidden md:flex flex-col items-center text-center mt-3 pt-3 border-t border-slate-200/60 dark:border-white/5 w-full">
            <span className="text-[7px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-tight">
              Local Government Unit
            </span>
            <span className="text-[7px] font-bold text-slate-400/80 dark:text-slate-500/80 tracking-wider mt-0.5">
              © 2026
            </span>
          </div>
        </div>
      </aside>

      {/* MAIN VIEWPORT WRAPPER */}
      <div className="flex-1 flex flex-col relative min-w-0 h-full overflow-hidden transition-colors duration-300 ease-out">

        {/* TOPBAR HEADER - ULTRA MODERN FROSTED CIVIC BANNER (CLEAN & MINIMAL) */}
        <header className="min-h-[4rem] md:min-h-[4.75rem] py-2 px-4 sm:px-6 lg:px-8 bg-white/90 dark:bg-[#0b1020]/90 backdrop-blur-2xl border-b border-slate-200/80 dark:border-white/10 flex items-center justify-end shadow-sm z-20 shrink-0 transition-colors duration-300 ease-out gap-4">

          {/* RIGHT: COMPACT CONTROLS CLUSTER */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* THEME QUICK TOGGLE (COMPACT & INTUITIVE) */}
            <Button
              onClick={() => setTheme(isDarkMode ? "light" : "dark")}
              className="h-10 w-10 sm:h-11 sm:w-11 p-0 rounded-2xl flex items-center justify-center shadow-sm active:scale-95 transition-all shrink-0 border bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/10 cursor-pointer"
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDarkMode ? (
                <Sun className="w-5 h-5 text-amber-400 animate-in spin-in-90 duration-300" />
              ) : (
                <Moon className="w-5 h-5 text-slate-600 animate-in spin-in-90 duration-300" />
              )}
            </Button>

            {/* VOICE GUIDE QUICK TOGGLE WITH DYNAMIC SOUNDWAVE */}
            <Button
              onClick={toggleVoice}
              className={`h-10 sm:h-11 px-3 rounded-2xl flex items-center gap-2 shadow-sm active:scale-95 transition-all shrink-0 border cursor-pointer ${
                isVoiceEnabled
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-400/30 shadow-emerald-600/20"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/5"
              }`}
              title={isVoiceEnabled ? "Voice Guide Active - Click to Turn Off" : "Click to Turn On Voice Guide"}
            >
              <Volume2 className={`w-4 h-4 sm:w-5 sm:h-5 ${isVoiceEnabled ? "text-emerald-200 animate-pulse" : "text-slate-500 dark:text-slate-400"}`} />
              <span className="text-[10px] font-black uppercase hidden md:inline">
                {isVoiceEnabled ? "Voice ON" : "Voice OFF"}
              </span>
              {/* Animated waveform bars */}
              {isVoiceEnabled && (
                <div className="flex items-end gap-0.5 h-3">
                  <span className="w-0.5 bg-white rounded-full animate-[pulse_0.6s_ease-in-out_infinite] h-2.5" />
                  <span className="w-0.5 bg-white rounded-full animate-[pulse_0.4s_ease-in-out_infinite] h-3.5" />
                  <span className="w-0.5 bg-white rounded-full animate-[pulse_0.8s_ease-in-out_infinite] h-2" />
                </div>
              )}
            </Button>

            {/* RESIDENT PROFILE DROPDOWN TRIGGER */}
            {resident ? (
              <div className="relative shrink-0" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2.5 text-left p-1 sm:p-1.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all active:scale-[0.98] border border-transparent hover:border-slate-200/60 dark:hover:border-white/10 cursor-pointer"
                  aria-expanded={profileMenuOpen}
                >
                  <div className="text-right hidden sm:block max-w-[160px] lg:max-w-[240px] xl:max-w-xs">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">
                      {TRANSLATIONS[lang].authenticatedResident}
                    </p>
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-white truncate">
                        {resident.fullName}
                      </span>
                      <Badge variant="outline" className="text-theme-primary border-theme-secondary/40 uppercase font-black text-[7px] py-0 px-1 shrink-0">
                        {TRANSLATIONS[lang].portal}
                      </Badge>
                    </div>
                  </div>
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-slate-50 dark:bg-slate-900 border-2 border-theme-primary/40 flex items-center justify-center overflow-hidden shadow-md relative ring-2 ring-theme-primary/10 shrink-0">
                    {residentPhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={residentPhotoUrl}
                        alt={resident.fullName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserCircle className="w-8 h-8 sm:w-9 sm:h-9 text-slate-400 dark:text-slate-600" />
                    )}
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
                      profileMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Profile Dropdown Menu */}
                {profileMenuOpen && (
                  <div className="absolute right-0 mt-3 w-80 origin-top-right rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-[#0c1120]/95 backdrop-blur-2xl p-3 shadow-2xl ring-1 ring-black/5 dark:shadow-black/70 z-50 animate-in fade-in zoom-in-95 duration-150 text-left">
                    {/* Header info */}
                    <div className="p-3.5 border-b border-slate-100 dark:border-slate-800/80 mb-1.5">
                      <p className="text-[9px] font-black uppercase tracking-[0.25em] text-emerald-600 dark:text-emerald-400">
                        Verified Resident
                      </p>
                      <p className="text-base font-black text-slate-900 dark:text-white mt-0.5 leading-snug">
                        {resident.fullName}
                      </p>
                      <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 truncate mt-0.5">
                        {resident.barangay ? `Brgy. ${resident.barangay}` : "LGU Resident"}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      {/* Option 1: My Tickets */}
                      <button
                        type="button"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          router.push("/dashboard/appointment");
                        }}
                        className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-left transition-colors group cursor-pointer active:scale-98"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-theme-primary dark:text-emerald-300 flex items-center justify-center shrink-0 shadow-sm">
                            <Ticket className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 dark:text-white group-hover:text-theme-primary transition-colors">
                              My Tickets
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                              Appointments & Status
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-theme-primary group-hover:translate-x-0.5 transition-all" />
                      </button>

                      {/* Option 2: My Profile */}
                      <button
                        type="button"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          setProfileOpen(true);
                        }}
                        className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800/60 text-left transition-colors group cursor-pointer active:scale-98"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 shadow-sm">
                            <User className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 dark:text-white group-hover:text-theme-primary transition-colors">
                              My Profile
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                              Details & Settings
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-theme-primary group-hover:translate-x-0.5 transition-all" />
                      </button>

                      {/* Option: Theme Toggle */}
                      <button
                        type="button"
                        onClick={() => setTheme(isDarkMode ? "light" : "dark")}
                        className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800/60 text-left transition-colors group cursor-pointer active:scale-98"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-sm">
                            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 dark:text-white transition-colors">
                              Theme Mode
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                              {isDarkMode ? "Currently Dark" : "Currently Light"}
                            </p>
                          </div>
                        </div>
                        <span className={`relative flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${isDarkMode ? "bg-theme-primary" : "bg-slate-200"}`}>
                          <span className={`h-5 w-5 rounded-full bg-white shadow-md transition-transform ${isDarkMode ? "translate-x-5" : "translate-x-0"}`} />
                        </span>
                      </button>

                      {/* Font Size Selector */}
                      <div className="pt-2 pb-1 border-t border-slate-100 dark:border-slate-800/80 px-1">
                        <span className="block text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500 mb-2">
                          Font Size
                        </span>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[
                            { value: "sm", label: "Small", preview: "14px" },
                            { value: "md", label: "Normal", preview: "18px" },
                            { value: "lg", label: "Large", preview: "22px" },
                            { value: "xl", label: "X-Large", preview: "26px" }
                          ].map((sz) => (
                            <button
                              key={sz.value}
                              type="button"
                              onClick={() => applyFontSize(sz.value)}
                              className={`flex flex-col items-center justify-center rounded-xl border py-2 transition-all cursor-pointer ${
                                activeFontSize === sz.value
                                  ? "border-theme-primary bg-emerald-50 text-theme-primary dark:border-theme-primary dark:bg-emerald-950/40 dark:text-emerald-300 font-bold shadow-sm"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-emerald-700"
                              }`}
                            >
                              <span style={{ fontSize: sz.preview }} className="leading-none font-sans">A</span>
                              <span className="mt-1 text-[8px] font-black uppercase tracking-wider">{sz.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Option 3: Logout */}
                      <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/80 mt-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setProfileMenuOpen(false);
                            logout();
                          }}
                          className="w-full flex items-center gap-3.5 p-3 rounded-2xl hover:bg-red-50 dark:hover:bg-red-950/30 text-left transition-colors text-red-600 dark:text-red-400 group cursor-pointer active:scale-98"
                        >
                          <div className="w-11 h-11 rounded-2xl bg-red-50 dark:bg-red-950/50 flex items-center justify-center shrink-0">
                            <LogOut className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-black uppercase tracking-wider">
                            Logout
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-4 text-left">
                <div className="text-right hidden sm:block">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{TRANSLATIONS[lang].authenticatedResident}</p>
                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-base font-black text-slate-800 dark:text-white">
                      {TRANSLATIONS[lang].localCitizen}
                    </span>
                    <Badge variant="outline" className="text-theme-primary border-theme-secondary uppercase font-black text-[8px]">{TRANSLATIONS[lang].portal}</Badge>
                  </div>
                </div>
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 flex items-center justify-center overflow-hidden shadow-inner relative ring-2 ring-slate-200/50 dark:ring-white/5 shrink-0">
                  <UserCircle className="w-9 h-9 text-slate-400 dark:text-slate-600" />
                </div>
              </div>
            )}
          </div>
        </header>

        {/* SERVICE GRID VIEWPORT - ULTRA MODERN RESPONSIVE CONTAINER */}
        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 via-slate-100/50 to-slate-200/40 dark:from-[#050816] dark:via-[#070b19] dark:to-[#0a0f24] relative flex flex-col transition-colors duration-300 ease-out">

          {/* STICKY SUB-HEADER WITH REAL-TIME COUNTERS & PILL CHIPS */}
          <div className="sticky top-0 bg-white/80 dark:bg-[#070b19]/80 backdrop-blur-2xl px-4 sm:px-8 md:px-12 py-4 md:py-5 z-10 border-b border-slate-200/80 dark:border-white/10 flex flex-wrap items-center justify-between gap-4 shadow-sm transition-colors duration-300 ease-out">
            <div className="flex items-center gap-3.5">
              <div className="bg-theme-primary text-white p-2.5 rounded-2xl shadow-md shadow-theme-primary/20">
                {activeCategory === "All" ? <Search className="w-5 h-5 md:w-6 md:h-6" /> : <FileText className="w-5 h-5 md:w-6 md:h-6" />}
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase transition-colors duration-300 ease-out">
                  {TRANSLATIONS[lang].categories[activeCategory as keyof typeof TRANSLATIONS.en.categories]} {activeCategory === "All" ? TRANSLATIONS[lang].services : ""}
                </h2>
                <p className="text-[10px] md:text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] transition-colors duration-300 ease-out">
                  {TRANSLATIONS[lang].availableIn}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border ${timeLeft < 20 ? "bg-red-50 border-red-200 text-red-600 shadow-sm shadow-red-100 dark:bg-red-950/40 dark:border-red-900/40 dark:text-red-300" : "bg-white/80 dark:bg-white/5 border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-slate-300"} transition-all duration-300`}>
                <Clock size={13} className={timeLeft < 10 ? "animate-pulse text-red-500" : "text-theme-secondary"} />
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest leading-none">
                  {TRANSLATIONS[lang].session}: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <div className="text-[9px] md:text-[10px] font-black text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-white/5 px-3.5 py-1.5 rounded-full border border-slate-200/80 dark:border-white/10 uppercase tracking-widest shadow-sm transition-colors duration-300 ease-out">
                {TRANSLATIONS[lang].total}: <span className="text-theme-primary font-black">{filteredServices.length}</span> {TRANSLATIONS[lang].servicesCount}
              </div>
            </div>
          </div>

          {/* SERVICE CARDS RESPONSIVE GRID - DESIGNED SPECIFICALLY FOR TOUCH KIOSKS */}
          <div className="p-4 sm:p-8 md:p-12 pb-24 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8 w-full max-w-[1920px] mx-auto">
            {filteredServices.map((service) => (
              <div
                key={service.id}
                onClick={() => handleServiceClick(service)}
                className="group flex flex-col justify-between min-h-[260px] md:min-h-[300px] bg-white/90 dark:bg-[#0c1322]/90 backdrop-blur-xl rounded-[2rem] border border-slate-200/80 dark:border-white/10 shadow-lg shadow-slate-200/50 dark:shadow-black/40 hover:shadow-2xl hover:shadow-theme-primary/15 hover:border-theme-primary/50 active:scale-[0.98] transition-all duration-300 cursor-pointer overflow-hidden p-6 md:p-8 relative"
              >
                {/* AMBIENT GRADIENT SHINE BEHIND CARD */}
                <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-theme-primary/10 rounded-full blur-2xl group-hover:bg-theme-primary/20 transition-colors pointer-events-none" />

                {/* Top Section */}
                <div>
                  <div className="flex items-start justify-between mb-5">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl bg-slate-100/90 dark:bg-white/5 group-hover:bg-theme-primary flex items-center justify-center text-slate-600 dark:text-slate-300 group-hover:text-white transition-all duration-300 shadow-inner group-hover:shadow-lg group-hover:shadow-theme-primary/30">
                      {service.icon}
                    </div>
                    <div className="text-right">
                      <span className="bg-theme-primary/10 text-theme-primary text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest border border-theme-primary/20">
                        {service.category}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2">
                    <h3 className="text-xl md:text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight group-hover:text-theme-primary transition-colors leading-tight mb-2">
                      {service.title}
                    </h3>
                    <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-semibold leading-relaxed line-clamp-3">
                      {service.desc}
                    </p>
                  </div>
                </div>

                {/* Bottom Action Bar */}
                <div className="mt-6 flex items-center justify-between pt-5 border-t border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-1.5 text-theme-primary font-black text-xs uppercase tracking-wider group-hover:translate-x-1 transition-transform">
                    <span>{TRANSLATIONS[lang].startApp}</span>
                    <ChevronRight size={16} className="stroke-[3]" />
                  </div>
                  <div className="h-10 w-10 md:h-12 md:w-12 bg-slate-100 dark:bg-white/5 group-hover:bg-theme-primary rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm group-hover:shadow-md group-hover:shadow-theme-primary/30">
                    <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-300 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>

                {/* Decorative background watermark */}
                <div className="absolute -bottom-6 -right-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity pointer-events-none">
                  <ShieldCheck size={160} className="rotate-12 text-theme-primary" />
                </div>
              </div>
            ))}
          </div>
        </main>

        {/* FOOTER BAR - RESPONSIVE SEGMENTED LANGUAGE TOGGLES (CLEAN & CENTERED) */}
        <footer className="min-h-[3.5rem] md:min-h-[4.25rem] py-2 bg-white/95 dark:bg-[#0b1020]/95 backdrop-blur-2xl border-t border-slate-200/80 dark:border-white/10 px-3 sm:px-6 md:px-10 flex items-center justify-start z-20 shrink-0 transition-colors duration-300 ease-out">
          {/* ACCESSIBLE ADAPTIVE LANGUAGE SWITCHER */}
          <div className="flex items-center bg-slate-100/90 dark:bg-slate-900/80 p-1 sm:p-1.5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-inner gap-1 max-w-full overflow-x-auto no-scrollbar">
            {[
              { id: "en", label: "English" },
              { id: "fil", label: "Filipino" },
              { id: "pang", label: lguConfig.localization.localLanguageName },
              { id: "ilo", label: "Ilocano" }
            ].map(({ id, label }) => {
              const isSelected = lang === id;
              return (
                <button
                  key={id}
                  onClick={() => setLang(id as "en" | "fil" | "pang" | "ilo")}
                  className={`font-black uppercase tracking-wider px-2.5 sm:px-4 md:px-5 py-1.5 md:py-2 text-[10px] sm:text-xs md:text-sm rounded-xl transition-all active:scale-95 flex items-center justify-center shrink-0 cursor-pointer select-none whitespace-nowrap ${
                    isSelected
                      ? "bg-theme-primary text-white shadow-md shadow-theme-primary/30 font-black ring-1 sm:ring-2 ring-theme-primary/40 scale-[1.02]"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/5"
                  }`}
                >
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </footer>

        {/* RESIDENT PROFILE MODAL - MODERN GLASSMORPHIC DIALOG */}
        {profileOpen && resident && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md animate-in fade-in duration-150">
            <div className="w-full max-w-md rounded-[2.5rem] bg-white/95 dark:bg-[#0c1120]/95 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 p-7 shadow-2xl transition-colors duration-300 ease-out dark:shadow-black/70 text-left scale-100 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <span className="inline-block rounded-full bg-theme-primary/10 px-3 py-0.5 text-[8px] font-black uppercase tracking-[0.25em] text-theme-primary border border-theme-primary/20">
                    Resident Profile
                  </span>
                  <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{resident.fullName}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setProfileOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 active:scale-95 transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-6 space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-5 text-sm dark:border-slate-800 dark:bg-slate-900/60">
                <ProfileRow label="Email" value={resident.email} />
                <ProfileRow label="Contact Number" value={resident.contactNumber} />
                <ProfileRow label="Barangay" value={resident.barangay} />
                <ProfileRow label="Municipality" value={resident.municipality || "Local Municipality"} />
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    router.push("/dashboard/appointment");
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-theme-primary/10 border border-theme-primary/20 text-theme-primary px-4 py-3.5 text-xs font-black uppercase tracking-wider transition hover:bg-theme-primary/20 active:scale-98"
                >
                  <Clock className="h-4 w-4" />
                  My Appointments & Tickets
                </button>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setTheme(isDarkMode ? "light" : "dark")}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-700 dark:hover:bg-slate-800 active:scale-98"
                >
                  <span>
                    <span className="block text-[8px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">Theme</span>
                    <span className="mt-0.5 block text-sm font-black text-slate-900 dark:text-white">
                      {isDarkMode ? "Dark Mode" : "Light Mode"}
                    </span>
                  </span>
                  <span className={`relative flex h-7 w-12 items-center rounded-full p-1 transition-colors ${isDarkMode ? "bg-theme-primary" : "bg-slate-200"}`}>
                    <span className={`h-5 w-5 rounded-full bg-white shadow-md transition-transform ${isDarkMode ? "translate-x-5" : "translate-x-0"}`} />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-xs font-black uppercase tracking-widest text-red-600 transition hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50 active:scale-98 border border-red-200/60 dark:border-red-900/40"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-200/70 pb-3 last:border-0 last:pb-0 dark:border-slate-800">
      <span className="font-bold text-slate-400 dark:text-slate-500">{label}</span>
      <span className="text-right font-black text-slate-700 dark:text-slate-100">{value || "Not provided"}</span>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-white dark:bg-[#070b14] gap-6">
        <div className="w-20 h-20 border-4 border-slate-100 dark:border-slate-800 border-t-theme-primary rounded-full animate-spin"></div>
        <div className="text-center">
          <p className="text-theme-primary font-black text-xs uppercase tracking-[0.4em] animate-pulse">Initializing Interface</p>
          <p className="text-slate-400 text-[10px] font-bold uppercase mt-2">Please wait while we secure your connection</p>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}

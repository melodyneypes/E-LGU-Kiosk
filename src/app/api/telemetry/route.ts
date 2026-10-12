import { NextResponse } from "next/server";
import lguConfig from "@/lgu.config.json";

export interface QueueWindowInfo {
  windowId: string;
  windowName: string;
  activeTicketsCount: number;
  avgWaitTimeMinutes: number;
  completedTodayCount: number;
  status: "OPEN" | "BUSY" | "PAUSED";
}

export interface ServiceDemandItem {
  serviceId: string;
  serviceName: string;
  category: "Permits" | "Taxes" | "Records" | "Certification";
  requestCountToday: number;
  percentOfTotal: number;
}

export interface BarangayDemandItem {
  barangay: string;
  kioskCount: number;
  totalRequestsToday: number;
  topRequestedService: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  kioskId: string;
  kioskName: string;
  eventType: "TICKET_PRINT" | "CARD_TAP" | "FEE_CHECK" | "ADMIN_ACTION" | "HARDWARE_WARN";
  sessionToken: string;
  details: string;
  performedBy?: string;
}

export interface KioskHardwareState {
  thermalPrinter: {
    paperLevelPercent: number;
    status: "OK" | "LOW_PAPER" | "OUT_OF_PAPER" | "JAMMED" | "DISCONNECTED";
    temperatureC: number;
    totalReceiptsPrinted: number;
  };
  rfidReader: {
    status: "CONNECTED" | "READ_ERROR" | "DISCONNECTED";
    lastCardReadAt?: string;
    readsCountToday: number;
    diagnostics: {
      frequencyMhz: number;
      antennaPowerDbm: number;
      successRatePercent: number;
      lastUidTapped?: string;
    };
  };
  cameraScanner: {
    status: "ACTIVE" | "OFFLINE" | "CALIBRATING";
    fps: number;
    faceDetectionActive: boolean;
  };
  cashAcceptor: {
    status: "ONLINE" | "STACKER_FULL" | "JAMMED" | "DISABLED";
    stackerCapacityPercent: number;
    billsAcceptedCount: number;
    totalCashCollected: number; // in PHP
  };
  touchScreen: {
    status: "OK" | "DEGRADED" | "CALIBRATION_NEEDED";
    touchLatencyMs: number;
    kioskModeLocked: boolean;
    screenResolution: string;
  };
  powerSupply: {
    acPowered: boolean;
    upsBatteryPercent: number;
    estimatedRuntimeMin: number;
  };
}

export interface KioskSystemMetrics {
  cpuUsagePercent: number;
  ramUsagePercent: number;
  diskUsagePercent: number;
  coreTemperatureC: number;
  networkLatencyMs: number;
  networkSignalDbm: number;
  networkType: "Ethernet" | "5G Cellular" | "Wi-Fi";
  uptimeSeconds: number;
}

export interface KioskTelemetry {
  id: string;
  name: string;
  zone: "MUNICIPAL_HALL" | "BARANGAY";
  barangay: string;
  location: string;
  coordinates: { lat: number; lng: number };
  status: "ONLINE" | "WARNING" | "OFFLINE" | "MAINTENANCE";
  ipAddress: string;
  macAddress: string;
  firmwareVersion: string;
  lastHeartbeat: string;
  activeSessions: number;
  transactionsToday: number;
  revenueToday: number;
  hardware: KioskHardwareState;
  system: KioskSystemMetrics;
}

// 15 Barangays of Sample E-LGU
const BARANGAY_NAMES = (
  lguConfig.barangays && lguConfig.barangays.length >= 15
    ? lguConfig.barangays.slice(0, 15)
    : [
        "Northview", "Riverside", "Greenfield", "Eastwood", "Westfield",
        "Hillcrest", "Lakeside", "Meadow Park", "Central Heights", "Brookside",
        "Sunnyvale", "Pine Grove", "Maplewood", "Gardenia", "Fairview"
      ]
);

// Sample E-LGU Demo Coordinates
const BASE_LAT = 14.5995;
const BASE_LNG = 120.9842;

const queueWindowsStore: QueueWindowInfo[] = [
  { windowId: "WIN-01", windowName: "Window 1 - Treasury & Cedula (CTC)", activeTicketsCount: 8, avgWaitTimeMinutes: 4.5, completedTodayCount: 142, status: "BUSY" },
  { windowId: "WIN-02", windowName: "Window 2 - Business Permits & Licensing", activeTicketsCount: 5, avgWaitTimeMinutes: 6.2, completedTodayCount: 88, status: "BUSY" },
  { windowId: "WIN-03", windowName: "Window 3 - Civil Registry (Birth/Marriage/Death)", activeTicketsCount: 3, avgWaitTimeMinutes: 3.8, completedTodayCount: 95, status: "OPEN" },
  { windowId: "WIN-04", windowName: "Window 4 - Real Property Tax (Amilyar)", activeTicketsCount: 6, avgWaitTimeMinutes: 5.1, completedTodayCount: 110, status: "BUSY" },
  { windowId: "WIN-05", windowName: "Window 5 - Barangay Clearances Handoff", activeTicketsCount: 1, avgWaitTimeMinutes: 2.0, completedTodayCount: 64, status: "OPEN" }
];

const auditLogsStore: AuditLogEntry[] = [
  { id: "aud-001", timestamp: new Date(Date.now() - 35000).toISOString(), kioskId: "KSK-MUN-01", kioskName: "Sample E-LGU Municipal Hall - Main Lobby Kiosk #1", eventType: "TICKET_PRINT", sessionToken: "sess_89f2a01", details: "Printed Queue Ticket #A-104 for Community Tax (Cedula)", performedBy: "Resident" },
  { id: "aud-002", timestamp: new Date(Date.now() - 75000).toISOString(), kioskId: "KSK-BRG-02", kioskName: `Barangay ${BARANGAY_NAMES[1]} Kiosk`, eventType: "CARD_TAP", sessionToken: "sess_77c1d42", details: "Resident RFID Card Tapped (UID: 89A2BF31). Session authenticated.", performedBy: "Juan Dela Cruz" },
  { id: "aud-003", timestamp: new Date(Date.now() - 120000).toISOString(), kioskId: "KSK-BRG-03", kioskName: `Barangay ${BARANGAY_NAMES[2]} Kiosk`, eventType: "FEE_CHECK", sessionToken: "sess_66b98e1", details: "Checked Real Property Tax Assessment (PIN: 045-12-004). Fee: ₱1,450.00", performedBy: "Resident" },
  { id: "aud-004", timestamp: new Date(Date.now() - 210000).toISOString(), kioskId: "KSK-MUN-03", kioskName: "Sample E-LGU Municipal Hall - Citizen Express Lane #3", eventType: "ADMIN_ACTION", sessionToken: "sess_adm_991", details: "Super Admin RFID Tap (UID: DEMO-RFID-0001). Hardware diagnostics test executed.", performedBy: "Super Administrator" },
  { id: "aud-005", timestamp: new Date(Date.now() - 340000).toISOString(), kioskId: "KSK-BRG-07", kioskName: `Barangay ${BARANGAY_NAMES[6]} Kiosk`, eventType: "HARDWARE_WARN", sessionToken: "sys_mon_007", details: "Paper low alert: 12% paper remaining in roll.", performedBy: "System Monitoring" }
];

// GENERATE EXACTLY 18 KIOSKS: 3 Municipal Hall + 15 Barangay Kiosks
function generateInitialKiosks(): KioskTelemetry[] {
  const kiosks: KioskTelemetry[] = [];

  // 1. Three (3) Municipal Hall Kiosks
  const municipalUnits = [
    {
      id: "KSK-MUN-01",
      name: "Municipal Hall - Main Lobby Kiosk #1",
      location: "Ground Floor Main Treasury & Business Window",
      ip: "192.168.10.101",
      mac: "B8:27:EB:14:8A:01",
      status: "ONLINE" as const,
      latOffset: 0.001,
      lngOffset: -0.0005,
      txns: 184,
      rev: 24500,
      paper: 86
    },
    {
      id: "KSK-MUN-02",
      name: "Municipal Hall - Assessor & Civil Registry #2",
      location: "East Wing Front Office & Documents Window",
      ip: "192.168.10.102",
      mac: "B8:27:EB:14:8A:02",
      status: "ONLINE" as const,
      latOffset: 0.0015,
      lngOffset: 0.0008,
      txns: 142,
      rev: 16800,
      paper: 91
    },
    {
      id: "KSK-MUN-03",
      name: "Municipal Hall - Citizen Express Lane #3",
      location: "Main Entrance Waiting Lounge & Self-Service Area",
      ip: "192.168.10.103",
      mac: "B8:27:EB:14:8A:03",
      status: "ONLINE" as const,
      latOffset: -0.0008,
      lngOffset: 0.0012,
      txns: 168,
      rev: 19200,
      paper: 74
    }
  ];

  municipalUnits.forEach((m) => {
    kiosks.push({
      id: m.id,
      name: m.name,
      zone: "MUNICIPAL_HALL",
      barangay: "Poblacion / Municipal Center",
      location: m.location,
      coordinates: { lat: BASE_LAT + m.latOffset, lng: BASE_LNG + m.lngOffset },
      status: m.status,
      ipAddress: m.ip,
      macAddress: m.mac,
      firmwareVersion: "v2.4.1-lgu-prod",
      lastHeartbeat: new Date().toISOString(),
      activeSessions: 2,
      transactionsToday: m.txns,
      revenueToday: m.rev,
      hardware: {
        thermalPrinter: { paperLevelPercent: m.paper, status: "OK", temperatureC: 38, totalReceiptsPrinted: m.txns * 10 },
        rfidReader: {
          status: "CONNECTED",
          lastCardReadAt: new Date(Date.now() - 90000).toISOString(),
          readsCountToday: Math.round(m.txns * 0.7),
          diagnostics: { frequencyMhz: 13.56, antennaPowerDbm: 20, successRatePercent: 99.7, lastUidTapped: "89A2BF31" }
        },
        cameraScanner: { status: "ACTIVE", fps: 30, faceDetectionActive: true },
        cashAcceptor: { status: "ONLINE", stackerCapacityPercent: 44, billsAcceptedCount: 190, totalCashCollected: m.rev },
        touchScreen: { status: "OK", touchLatencyMs: 14, kioskModeLocked: true, screenResolution: "1920x1080 (100Hz)" },
        powerSupply: { acPowered: true, upsBatteryPercent: 100, estimatedRuntimeMin: 180 }
      },
      system: {
        cpuUsagePercent: 32,
        ramUsagePercent: 46,
        diskUsagePercent: 34,
        coreTemperatureC: 45,
        networkLatencyMs: 12,
        networkSignalDbm: -52,
        networkType: "Ethernet",
        uptimeSeconds: 520000
      }
    });
  });

  // 2. Fifteen (15) Barangay Kiosks (1 per barangay)
  BARANGAY_NAMES.forEach((brg, index) => {
    const num = index + 1;
    const padNum = num < 10 ? `0${num}` : `${num}`;
    const id = `KSK-BRG-${padNum}`;

    // Status distribution: 12 Online, 2 Warning, 1 Offline
    let status: "ONLINE" | "WARNING" | "OFFLINE" | "MAINTENANCE" = "ONLINE";
    let paper = 80 - (index * 4);
    let printerStatus: "OK" | "LOW_PAPER" | "OUT_OF_PAPER" | "DISCONNECTED" = "OK";
    let ping = 25 + (index * 3);
    const txns = Math.max(25, 110 - (index * 5));
    const rev = txns * 120;

    if (num === 2) {
      status = "WARNING";
      paper = 14;
      printerStatus = "LOW_PAPER";
    } else if (num === 7) {
      status = "WARNING";
      paper = 12;
      printerStatus = "LOW_PAPER";
    } else if (num === 14) {
      status = "MAINTENANCE";
      printerStatus = "OK";
    } else if (num === 15) {
      status = "OFFLINE";
      printerStatus = "DISCONNECTED";
      ping = 999;
    }

    // Circular geographic spread around municipality center
    const angle = (index / 15) * 2 * Math.PI;
    const distance = 0.015 + (index % 3) * 0.008;
    const lat = BASE_LAT + Math.cos(angle) * distance;
    const lng = BASE_LNG + Math.sin(angle) * distance;

    kiosks.push({
      id,
      name: `Barangay ${brg} Kiosk`,
      zone: "BARANGAY",
      barangay: brg,
      location: `Barangay ${brg} Multi-Purpose Hall & Admin Desk`,
      coordinates: { lat, lng },
      status,
      ipAddress: `192.168.20.${100 + num}`,
      macAddress: `B8:27:EB:20:8A:${padNum}`,
      firmwareVersion: "v2.4.1-lgu-prod",
      lastHeartbeat: status === "OFFLINE" ? new Date(Date.now() - 3600000).toISOString() : new Date().toISOString(),
      activeSessions: status === "ONLINE" ? (index % 3 === 0 ? 1 : 0) : 0,
      transactionsToday: txns,
      revenueToday: rev,
      hardware: {
        thermalPrinter: {
          paperLevelPercent: Math.max(5, paper),
          status: printerStatus,
          temperatureC: 36 + (index % 4),
          totalReceiptsPrinted: txns * 6
        },
        rfidReader: {
          status: status === "OFFLINE" ? "DISCONNECTED" : "CONNECTED",
          lastCardReadAt: new Date(Date.now() - (index * 60000)).toISOString(),
          readsCountToday: Math.round(txns * 0.65),
          diagnostics: {
            frequencyMhz: 13.56,
            antennaPowerDbm: status === "OFFLINE" ? 0 : 19,
            successRatePercent: status === "OFFLINE" ? 0 : 98.8,
            lastUidTapped: `RFID-${padNum}B8`
          }
        },
        cameraScanner: {
          status: status === "OFFLINE" ? "OFFLINE" : status === "MAINTENANCE" ? "CALIBRATING" : "ACTIVE",
          fps: status === "ONLINE" ? 28 : 0,
          faceDetectionActive: status === "ONLINE"
        },
        cashAcceptor: {
          status: status === "OFFLINE" ? "DISABLED" : "ONLINE",
          stackerCapacityPercent: Math.min(95, 25 + (index * 4)),
          billsAcceptedCount: Math.round(txns * 0.8),
          totalCashCollected: rev
        },
        touchScreen: {
          status: status === "OFFLINE" ? "DEGRADED" : "OK",
          touchLatencyMs: status === "OFFLINE" ? 0 : 16 + (index % 6),
          kioskModeLocked: true,
          screenResolution: "1920x1080 (60Hz)"
        },
        powerSupply: {
          acPowered: status !== "OFFLINE",
          upsBatteryPercent: status === "OFFLINE" ? 0 : 98,
          estimatedRuntimeMin: status === "OFFLINE" ? 0 : 170
        }
      },
      system: {
        cpuUsagePercent: status === "OFFLINE" ? 0 : 25 + (index % 25),
        ramUsagePercent: status === "OFFLINE" ? 0 : 40 + (index % 20),
        diskUsagePercent: 32 + (index % 15),
        coreTemperatureC: status === "OFFLINE" ? 24 : 42 + (index % 6),
        networkLatencyMs: ping,
        networkSignalDbm: status === "OFFLINE" ? -99 : -65 - (index % 12),
        networkType: index % 2 === 0 ? "5G Cellular" : "Ethernet",
        uptimeSeconds: status === "OFFLINE" ? 0 : 250000 + (index * 15000)
      }
    });
  });

  return kiosks;
}

let kioskStore: KioskTelemetry[] = generateInitialKiosks();

function updateSimulatedTelemetry() {
  kioskStore = kioskStore.map((kiosk) => {
    if (kiosk.status === "OFFLINE") return kiosk;
    const cpuJitter = Math.floor((Math.random() - 0.45) * 6);
    const ramJitter = Math.floor((Math.random() - 0.45) * 4);
    const pingJitter = Math.floor((Math.random() - 0.45) * 4);
    const tempJitter = (Math.random() - 0.5) * 1.2;

    const newCpu = Math.max(10, Math.min(95, kiosk.system.cpuUsagePercent + cpuJitter));
    const newRam = Math.max(20, Math.min(92, kiosk.system.ramUsagePercent + ramJitter));
    const newPing = Math.max(5, Math.min(250, kiosk.system.networkLatencyMs + pingJitter));
    const newTemp = Math.max(30, Math.min(75, Math.round((kiosk.system.coreTemperatureC + tempJitter) * 10) / 10));

    return {
      ...kiosk,
      lastHeartbeat: new Date().toISOString(),
      system: {
        ...kiosk.system,
        cpuUsagePercent: newCpu,
        ramUsagePercent: newRam,
        networkLatencyMs: newPing,
        coreTemperatureC: newTemp,
        uptimeSeconds: kiosk.system.uptimeSeconds + 3
      }
    };
  });
}

export async function GET() {
  updateSimulatedTelemetry();

  const totalKiosks = kioskStore.length;
  const municipalCount = kioskStore.filter((k) => k.zone === "MUNICIPAL_HALL").length;
  const barangayCount = kioskStore.filter((k) => k.zone === "BARANGAY").length;

  const onlineCount = kioskStore.filter((k) => k.status === "ONLINE").length;
  const warningCount = kioskStore.filter((k) => k.status === "WARNING").length;
  const offlineCount = kioskStore.filter((k) => k.status === "OFFLINE").length;
  const maintenanceCount = kioskStore.filter((k) => k.status === "MAINTENANCE").length;

  const totalTransactionsToday = kioskStore.reduce((acc, k) => acc + k.transactionsToday, 0);
  const totalRevenueToday = kioskStore.reduce((acc, k) => acc + k.revenueToday, 0);
  const totalActiveSessions = kioskStore.reduce((acc, k) => acc + k.activeSessions, 0);

  const fleetUptimePercent = Math.round(((onlineCount + warningCount) / totalKiosks) * 100);

  // Service demand metrics
  const serviceDemand: ServiceDemandItem[] = [
    { serviceId: "t2", serviceName: "Community Tax (Cedula CTC)", category: "Taxes", requestCountToday: 384, percentOfTotal: 38 },
    { serviceId: "p1", serviceName: "Business Permit Application & Renewal", category: "Permits", requestCountToday: 245, percentOfTotal: 24 },
    { serviceId: "b1", serviceName: "Barangay Clearance Request", category: "Certification", requestCountToday: 198, percentOfTotal: 20 },
    { serviceId: "t3", serviceName: "Real Property Tax (Amilyar)", category: "Taxes", requestCountToday: 115, percentOfTotal: 11 },
    { serviceId: "c1", serviceName: "Civil Registry Documents (Birth/Marriage)", category: "Records", requestCountToday: 68, percentOfTotal: 7 }
  ];

  // Ranked demand across all 15 barangays
  const barangayDemand: BarangayDemandItem[] = kioskStore
    .filter((k) => k.zone === "BARANGAY")
    .map((k) => ({
      barangay: k.barangay,
      kioskCount: 1,
      totalRequestsToday: k.transactionsToday,
      topRequestedService: k.barangay.includes("view") ? "Cedula (CTC)" : k.barangay.includes("side") ? "Barangay Clearance" : "Business Permit"
    }))
    .sort((a, b) => b.totalRequestsToday - a.totalRequestsToday);

  // Peak Hours traffic simulation (8 AM to 5 PM)
  const peakHoursTraffic = [
    { hour: "8:00 AM", ticketVolume: 38, avgWaitMin: 2.1 },
    { hour: "9:00 AM", ticketVolume: 92, avgWaitMin: 4.8 },
    { hour: "10:00 AM", ticketVolume: 145, avgWaitMin: 6.4 }, // Morning Peak
    { hour: "11:00 AM", ticketVolume: 118, avgWaitMin: 5.9 },
    { hour: "12:00 PM", ticketVolume: 52, avgWaitMin: 3.2 },
    { hour: "1:00 PM", ticketVolume: 84, avgWaitMin: 4.5 },
    { hour: "2:00 PM", ticketVolume: 126, avgWaitMin: 5.8 }, // Afternoon Peak
    { hour: "3:00 PM", ticketVolume: 79, avgWaitMin: 3.9 },
    { hour: "4:00 PM", ticketVolume: 44, avgWaitMin: 2.8 }
  ];

  const activeKiosks = kioskStore.filter((k) => k.status !== "OFFLINE");
  const avgCpu = Math.round(activeKiosks.reduce((a, b) => a + b.system.cpuUsagePercent, 0) / (activeKiosks.length || 1));
  const avgPing = Math.round(activeKiosks.reduce((a, b) => a + b.system.networkLatencyMs, 0) / (activeKiosks.length || 1));

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    summary: {
      totalKiosks,
      municipalCount,
      barangayCount,
      onlineCount,
      warningCount,
      offlineCount,
      maintenanceCount,
      fleetUptimePercent,
      totalTransactionsToday,
      totalRevenueToday,
      totalActiveSessions,
      avgCpuPercent: avgCpu,
      avgPingMs: avgPing
    },
    queueWindows: queueWindowsStore,
    serviceDemand,
    barangayDemand,
    peakHoursTraffic,
    kiosks: kioskStore,
    auditLogs: auditLogsStore
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { kioskId, action } = body;

    if (!kioskId || !action) {
      return NextResponse.json({ error: "kioskId and action are required" }, { status: 400 });
    }

    const index = kioskStore.findIndex((k) => k.id === kioskId);
    if (index === -1) {
      return NextResponse.json({ error: "Kiosk not found" }, { status: 404 });
    }

    const kiosk = kioskStore[index];
    const logId = "aud-" + Date.now();
    const sessionToken = "sess_adm_" + Math.random().toString(36).substring(2, 7);

    switch (action) {
      case "RESTART":
        kiosk.status = "ONLINE";
        kiosk.system.uptimeSeconds = 0;
        kiosk.system.cpuUsagePercent = 15;
        kiosk.system.ramUsagePercent = 30;

        auditLogsStore.unshift({
          id: logId,
          timestamp: new Date().toISOString(),
          kioskId: kiosk.id,
          kioskName: kiosk.name,
          eventType: "ADMIN_ACTION",
          sessionToken,
          details: "Remote soft reboot command executed by Super Administrator.",
          performedBy: "Super Admin"
        });
        break;

      case "RFID_DIAGNOSTICS":
        kiosk.hardware.rfidReader.diagnostics.successRatePercent = 99.9;
        auditLogsStore.unshift({
          id: logId,
          timestamp: new Date().toISOString(),
          kioskId: kiosk.id,
          kioskName: kiosk.name,
          eventType: "ADMIN_ACTION",
          sessionToken,
          details: "RFID Reader RF Diagnostic sweep performed. Antenna Power: 20dBm, Frequency: 13.56MHz, Status: OPTIMAL.",
          performedBy: "Super Admin"
        });
        break;

      case "FLUSH_PRINTER":
        kiosk.hardware.thermalPrinter.paperLevelPercent = 100;
        kiosk.hardware.thermalPrinter.status = "OK";
        if (kiosk.status === "WARNING" && kiosk.hardware.cashAcceptor.status !== "STACKER_FULL") {
          kiosk.status = "ONLINE";
        }
        auditLogsStore.unshift({
          id: logId,
          timestamp: new Date().toISOString(),
          kioskId: kiosk.id,
          kioskName: kiosk.name,
          eventType: "ADMIN_ACTION",
          sessionToken,
          details: "Thermal paper roll replaced and printer paper gauge reset to 100%.",
          performedBy: "Kiosk Maintenance Tech"
        });
        break;

      case "EMPTY_CASH_STACKER":
        kiosk.hardware.cashAcceptor.stackerCapacityPercent = 0;
        kiosk.hardware.cashAcceptor.status = "ONLINE";
        if (kiosk.status === "WARNING" && kiosk.hardware.thermalPrinter.status !== "LOW_PAPER") {
          kiosk.status = "ONLINE";
        }
        auditLogsStore.unshift({
          id: logId,
          timestamp: new Date().toISOString(),
          kioskId: kiosk.id,
          kioskName: kiosk.name,
          eventType: "ADMIN_ACTION",
          sessionToken,
          details: "Cash acceptor stacker emptied by Treasury Collector.",
          performedBy: "Municipal Treasury Officer"
        });
        break;

      case "TOGGLE_MAINTENANCE":
        if (kiosk.status === "MAINTENANCE") {
          kiosk.status = "ONLINE";
          kiosk.hardware.cameraScanner.status = "ACTIVE";
          kiosk.hardware.cashAcceptor.status = "ONLINE";
          auditLogsStore.unshift({
            id: logId,
            timestamp: new Date().toISOString(),
            kioskId: kiosk.id,
            kioskName: kiosk.name,
            eventType: "ADMIN_ACTION",
            sessionToken,
            details: "Kiosk maintenance concluded. Returned kiosk to live operational status.",
            performedBy: "Super Admin"
          });
        } else {
          kiosk.status = "MAINTENANCE";
          auditLogsStore.unshift({
            id: logId,
            timestamp: new Date().toISOString(),
            kioskId: kiosk.id,
            kioskName: kiosk.name,
            eventType: "ADMIN_ACTION",
            sessionToken,
            details: "Kiosk switched to MAINTENANCE mode.",
            performedBy: "Super Admin"
          });
        }
        break;

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    kioskStore[index] = kiosk;

    return NextResponse.json({
      success: true,
      message: `Action ${action} executed for ${kiosk.name}`,
      kiosk
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error executing command";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

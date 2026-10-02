import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import GlobalKeyboard from "@/components/shared/GlobalKeyboard";
import KioskMaintenanceGuard from "@/components/shared/KioskMaintenanceGuard";
import ThemeProvider from "@/components/shared/ThemeProvider";
import DynamicTheme from "@/components/shared/DynamicTheme";
import { Toaster } from "@/components/ui/sonner";

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: "E-LGU - Public Information Kiosk",
  description:
    "Official public information kiosk for Local Government Unit citizen frontline services.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hideKioskCursor =
    process.env.NEXT_PUBLIC_HIDE_KIOSK_CURSOR?.toLowerCase() === "true";

  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var root = document.documentElement;

                  // ── Apply font size ────────────────────────────────────────
                  var saved = localStorage.getItem('kiosk_font_size');
                  if (saved) {
                    var sizeMap = { sm: '16px', md: '19px', lg: '22px', xl: '25px' };
                    root.style.fontSize = sizeMap[saved] || '19px';
                  } else {
                    root.style.fontSize = '19px';
                  }

                  // ── Apply cached theme vars instantly (before first paint) ─
                  var raw = localStorage.getItem('kiosk_theme_cache');
                  if (raw) {
                    var parsed = JSON.parse(raw);
                    // New format: { vars: { '--primary-theme': '#...' }, ts: 123 }
                    var vars = parsed.vars || parsed;
                    if (vars && typeof vars === 'object') {
                      for (var key in vars) {
                        if (Object.prototype.hasOwnProperty.call(vars, key)) {
                          root.style.setProperty(key, vars[key]);
                        }
                      }
                    }
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={cn(hideKioskCursor && "hide-kiosk-cursor")}>
        <ThemeProvider>
          <DynamicTheme />
          <KioskMaintenanceGuard />
          {children}
          <GlobalKeyboard />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

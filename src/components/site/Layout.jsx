import React, { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { getSiteSettings } from "@/services/contentService";
import "@/styles/site.css";

export default function Layout() {
  const [settings, setSettings] = useState(null);
  const [settingsError, setSettingsError] = useState(null);

  useEffect(() => {
    getSiteSettings().then(setSettings).catch(setSettingsError);
  }, []);

  return (
    <div className="public-site min-h-screen flex flex-col bg-background">
      <Navbar siteName={settings?.site_name} settings={settings} />
      <main className="flex-1">
        <Outlet context={{ settings, settingsError }} />
      </main>
      <Footer settings={settings} />
    </div>
  );
}

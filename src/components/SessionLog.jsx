import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMmetStore } from "../store/mmetStore";

const STORAGE_KEY = "mmet_profile_v1";

function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SessionLog() {
  const products = useMmetStore((s) => s.products);
  const clearProducts = useMmetStore((s) => s.clearProducts);

  // Optional (we’ll add this to the store next)
  const setProducts = useMmetStore((s) => s.setProducts);

  const fileRef = useRef(null);
  const [msg, setMsg] = useState("");

  const profile = useMemo(() => {
    return {
      version: "mmet-profile-1",
      savedAt: new Date().toISOString(),
      products: products || [],
      sessions: [], // placeholder for later “actual effects” logging
    };
  }, [products]);

  // Auto-save to localStorage (even before import works)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // ignore
    }
  }, [profile]);

  const onExport = () => {
    const safeName = `mmet-profile-${new Date().toISOString().slice(0, 10)}.json`;
    downloadJson(profile, safeName);
    setMsg("Exported profile JSON.");
    setTimeout(() => setMsg(""), 2000);
  };

  const onImportClick = () => fileRef.current?.click();

  const onImportFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      const data = JSON.parse(text);

      if (!data || !Array.isArray(data.products)) {
        throw new Error("Invalid profile file (missing products array).");
      }

      if (typeof setProducts !== "function") {
        alert(
          "Import is almost ready — store is missing setProducts(). Next step we’ll add it to src/store/mmetStore.js."
        );
        return;
      }

      setProducts(data.products);
      setMsg(`Imported ${data.products.length} products.`);
      setTimeout(() => setMsg(""), 2500);
    } catch (err) {
      alert(err?.message || "Import failed.");
    } finally {
      e.target.value = "";
    }
  };

  const onRestoreLocal = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return alert("No saved profile found in localStorage.");
      const data = JSON.parse(raw);

      if (!data || !Array.isArray(data.products)) {
        return alert("Saved profile is invalid.");
      }

      if (typeof setProducts !== "function") {
        return alert(
          "Restore is almost ready — store is missing setProducts(). Next step we’ll add it to src/store/mmetStore.js."
        );
      }

      setProducts(data.products);
      setMsg(`Restored ${data.products.length} products from localStorage.`);
      setTimeout(() => setMsg(""), 2500);
    } catch {
      alert("Restore failed.");
    }
  };

  const onClear = () => {
    clearProducts?.();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setMsg("Cleared products + local profile.");
    setTimeout(() => setMsg(""), 2000);
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <strong>Session / Profile</strong>
        <button onClick={onExport}>Export Profile</button>
        <button onClick={onImportClick}>Import Profile</button>
        <button onClick={onRestoreLocal}>Restore Local</button>
        <button onClick={onClear}>Clear Profile</button>
        {msg ? <span style={{ opacity: 0.8 }}>{msg}</span> : null}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        onChange={onImportFile}
        style={{ display: "none" }}
      />

      <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
        Saves automatically in your browser. Export/import is how we’ll make “portable calibration files.”
      </div>
    </div>
  );
}

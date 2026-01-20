import React from "react";

export default function ProductCard({ product, rankKeys }) {
  const p = product;
  const totalTerp = p?.metrics?.totalTerpenes;

  const topUsed = p?._mmet?.topUsed || [];
  const scores = p?._mmet?.scores || {};

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 4 }}>{p.name}</div>
      <div style={{ opacity: 0.85, marginBottom: 10 }}>
        {p.form ? `Form: ${p.form}` : "Form: —"}
      </div>

      <div style={{ marginBottom: 8 }}>
        <strong>Total Terpenes:</strong>{" "}
        {Number.isFinite(Number(totalTerp))
          ? `${Number(totalTerp).toFixed(2)}% (COA)`
          : "—"}
      </div>

      <div style={{ marginBottom: 10 }}>
        <strong>Top 6 Used:</strong>
        <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {topUsed.length ? (
            topUsed.map((t) => (
              <span
                key={`${p.id}_${t.name}`}
                style={{
                  border: "1px solid #ccc",
                  borderRadius: 999,
                  padding: "3px 8px",
                  fontSize: 12,
                }}
              >
                {t.name} {Number(t.pct).toFixed(3)}% • {t.band}
              </span>
            ))
          ) : (
            <span style={{ opacity: 0.8 }}>—</span>
          )}
        </div>
      </div>

      <div style={{ marginTop: 6 }}>
        <strong>MMET Score:</strong>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 6,
            marginTop: 8,
          }}
        >
          {rankKeys.map((rk) => (
            <div key={rk.key} style={{ border: "1px solid #eee", borderRadius: 10, padding: 8 }}>
              <div style={{ fontSize: 12, opacity: 0.85 }}>{rk.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>
                {Number(scores[rk.key] ?? 0).toFixed(1)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <details style={{ marginTop: 10 }}>
        <summary style={{ cursor: "pointer" }}>Show parsed terpenes (normalized)</summary>
        <div style={{ marginTop: 8, fontSize: 13 }}>
          {(p.terpenes || []).slice(0, 24).map((t) => (
            <div key={`${p.id}_${t.name}_full`}>
              {t.name}: {Number(t.pct).toFixed(3)}%
            </div>
          ))}
          {(p.terpenes || []).length > 24 ? <div>…</div> : null}
        </div>
      </details>
    </div>
  );
}

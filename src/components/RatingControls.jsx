import React from "react";

export default function RatingControls({ rankKeys, sortBy, onChangeSort }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Rank by:</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {rankKeys.map((rk) => (
          <button
            key={rk.key}
            onClick={() => onChangeSort(rk.key)}
            style={{
              border: sortBy === rk.key ? "2px solid #111" : "1px solid #ccc",
              borderRadius: 999,
              padding: "6px 10px",
              background: sortBy === rk.key ? "#f0f0f0" : "white",
            }}
          >
            {rk.label}
          </button>
        ))}
      </div>
    </div>
  );
}

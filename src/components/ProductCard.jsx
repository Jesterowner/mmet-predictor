// src/components/ProductCard.jsx
import { useState } from 'react';
import { useMmetStore } from '../store/mmetStore';
import RatingControls from './RatingControls';

/**
 * ProductCard - Display product with COA data and rating controls
 * 
 * Shows:
 * - Product name, form, metrics (THC, Total Terpenes)
 * - Top 6 terpenes with bands
 * - Rating controls for user feedback
 * - Session saving
 */

export default function ProductCard({ product, showRatings = true }) {
  const { saveSession, logActuals } = useMmetStore();
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSaveRating = async ({ productId, ratings, notes }) => {
    try {
      // Create session if not exists
      let sessionId = activeSessionId;
      if (!sessionId) {
        sessionId = saveSession({
          label: `${product.name} - ${new Date().toLocaleDateString()}`,
          productId: productId,
        });
        setActiveSessionId(sessionId);
      }

      // Log the actual ratings
      const success = logActuals({
        sessionId,
        productId,
        actuals: ratings,
        notes,
      });

      if (success) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Failed to save rating:', error);
      throw error;
    }
  };

  if (!product) return null;

  return (
    <div className="product-card bg-white rounded-lg shadow-lg p-6 mb-6">
      {/* Product Header */}
      <div className="border-b pb-4 mb-4">
        <h2 className="text-2xl font-bold text-gray-900">{product.name}</h2>
        {product.form && (
          <span className="inline-block bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full mt-2">
            {product.form}
          </span>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <MetricBox
          label="Total THC"
          value={product.metrics?.totalTHC}
          suffix="%"
          color="purple"
        />
        <MetricBox
          label="Total Terpenes"
          value={product.metrics?.totalTerpenes}
          suffix="%"
          color="green"
        />
        {product.metrics?.totalCannabinoids != null && (
          <MetricBox
            label="Total Cannabinoids"
            value={product.metrics.totalCannabinoids}
            suffix="%"
            color="blue"
          />
        )}
        {product.metrics?.thcPerUnitMg != null && (
          <MetricBox
            label="THC per Unit"
            value={product.metrics.thcPerUnitMg}
            suffix="mg"
            color="orange"
          />
        )}
      </div>

      {/* Top 6 Terpenes */}
      {product.top6 && product.top6.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            Top 6 Terpenes Used
            <span className="text-sm font-normal text-gray-500">
              (for scoring)
            </span>
          </h3>
          <div className="space-y-2">
            {product.top6.map((terp, idx) => (
              <TerpeneBar key={idx} terpene={terp} rank={idx + 1} />
            ))}
          </div>
        </div>
      )}

      {/* All Terpenes (collapsible) */}
      {product.terpenes && product.terpenes.length > 6 && (
        <details className="mb-6">
          <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-700 font-medium">
            Show all {product.terpenes.length} terpenes
          </summary>
          <div className="mt-3 pl-4 space-y-1 text-sm">
            {product.terpenes.slice(6).map((terp, idx) => (
              <div key={idx} className="flex justify-between">
                <span>{terp.name}</span>
                <span className="text-gray-600">{terp.pct?.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* COA Source Info */}
      {product.coa?.sourceFileName && (
        <div className="text-xs text-gray-500 mb-4 bg-gray-50 p-2 rounded">
          <strong>Source:</strong> {product.coa.sourceFileName}
          {product.coa.parsedAt && (
            <span className="ml-2">
              • Parsed: {new Date(product.coa.parsedAt).toLocaleString()}
            </span>
          )}
        </div>
      )}

      {/* Rating Controls */}
      {showRatings && (
        <div className="border-t pt-6">
          <RatingControls product={product} onSave={handleSaveRating} />
          {showSuccess && (
            <div className="mt-4 bg-green-50 border border-green-300 text-green-800 px-4 py-3 rounded-md">
              ✓ Rating saved to session log!
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricBox({ label, value, suffix = '', color = 'blue' }) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
    orange: 'bg-orange-50 border-orange-200 text-orange-900',
  };

  return (
    <div className={`border-2 rounded-lg p-4 ${colorClasses[color] || colorClasses.blue}`}>
      <div className="text-sm font-medium mb-1">{label}</div>
      <div className="text-2xl font-bold">
        {value != null ? `${value.toFixed(2)}${suffix}` : '—'}
      </div>
    </div>
  );
}

function TerpeneBar({ terpene, rank }) {
  const maxPct = 3; // Scale bars relative to 3% max
  const widthPercent = Math.min((terpene.pct / maxPct) * 100, 100);

  // Color coding by band (if available)
  const bandColors = {
    'Very High': 'bg-red-500',
    'High': 'bg-orange-500',
    'Medium': 'bg-yellow-500',
    'Low': 'bg-green-500',
    'Very Low': 'bg-blue-500',
  };

  const barColor = terpene.band ? bandColors[terpene.band] || 'bg-gray-500' : 'bg-blue-500';

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-gray-500 w-6">#{rank}</span>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium text-sm">{terpene.name}</span>
          <span className="text-sm text-gray-600">
            {terpene.pct?.toFixed(2)}%
            {terpene.band && (
              <span className="ml-2 text-xs text-gray-500">
                ({terpene.band})
              </span>
            )}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`${barColor} h-2 rounded-full transition-all duration-300`}
            style={{ width: `${widthPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

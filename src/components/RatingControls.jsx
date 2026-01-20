// src/components/RatingControls.jsx
import { useState } from 'react';

/**
 * RatingControls - User ratings for a product
 * 
 * Dimensions: Pain, Head, Couch, Clarity, Duration, Functionality, Anxiety
 * Each rated 0-5 (0 = worst/none, 5 = best/most)
 */

const RATING_DIMENSIONS = [
  { key: 'pain', label: 'Pain Relief', hint: '0 = no relief, 5 = complete relief' },
  { key: 'head', label: 'Head High', hint: '0 = clear headed, 5 = very cerebral' },
  { key: 'couch', label: 'Couch Lock', hint: '0 = energetic, 5 = glued to couch' },
  { key: 'clarity', label: 'Mental Clarity', hint: '0 = foggy, 5 = sharp focus' },
  { key: 'duration', label: 'Duration', hint: '0 = very short, 5 = very long' },
  { key: 'functionality', label: 'Functionality', hint: '0 = impaired, 5 = fully functional' },
  { key: 'anxiety', label: 'Anxiety Relief', hint: '0 = no relief/worse, 5 = complete calm' },
];

export default function RatingControls({ product, onSave, className = '' }) {
  const [ratings, setRatings] = useState({
    pain: 0,
    head: 0,
    couch: 0,
    clarity: 0,
    duration: 0,
    functionality: 0,
    anxiety: 0,
  });
  
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleRatingChange = (dimension, value) => {
    setRatings(prev => ({ ...prev, [dimension]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!product?.id) return;
    
    setSaving(true);
    
    try {
      await onSave({
        productId: product.id,
        ratings,
        notes,
        timestamp: new Date().toISOString(),
      });
      
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save rating:', error);
      alert('Failed to save rating. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const hasAnyRating = Object.values(ratings).some(v => v > 0);

  return (
    <div className={`rating-controls ${className}`}>
      <h3 className="text-lg font-semibold mb-4">Rate Your Experience</h3>
      
      <div className="space-y-4">
        {RATING_DIMENSIONS.map(({ key, label, hint }) => (
          <div key={key} className="rating-dimension">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium">{label}</label>
              <span className="text-sm text-gray-500">{ratings[key]}/5</span>
            </div>
            
            <div className="flex gap-2 items-center">
              {[0, 1, 2, 3, 4, 5].map(value => (
                <button
                  key={value}
                  onClick={() => handleRatingChange(key, value)}
                  className={`
                    w-10 h-10 rounded-md border-2 transition-all
                    ${ratings[key] === value
                      ? 'bg-blue-500 border-blue-600 text-white font-bold'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400'
                    }
                  `}
                  title={hint}
                >
                  {value}
                </button>
              ))}
            </div>
            
            <p className="text-xs text-gray-500 mt-1">{hint}</p>
          </div>
        ))}
        
        <div className="rating-notes mt-6">
          <label className="block text-sm font-medium mb-2">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How did this product make you feel? Any specific observations?"
            className="w-full p-3 border border-gray-300 rounded-md min-h-[100px] resize-y"
            rows={4}
          />
        </div>
        
        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={handleSave}
            disabled={!hasAnyRating || saving}
            className={`
              px-6 py-3 rounded-md font-semibold transition-all
              ${hasAnyRating && !saving
                ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            {saving ? 'Saving...' : 'Save Rating'}
          </button>
          
          {saved && (
            <span className="text-green-600 font-medium animate-fade-in">
              ✓ Saved successfully!
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

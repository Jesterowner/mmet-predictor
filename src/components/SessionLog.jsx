// src/components/SessionLog.jsx
import { useState } from 'react';
import { useMmetStore } from '../store/mmetStore';

/**
 * SessionLog - Import/Export user ratings and view session history
 * 
 * Features:
 * - Export all session data as JSON
 * - Import previously saved sessions
 * - View session history with ratings
 */

export default function SessionLog() {
  const { sessionLog, exportLog, importLog } = useMmetStore();
  const [importError, setImportError] = useState(null);
  const [importSuccess, setImportSuccess] = useState(false);

  const handleExport = () => {
    try {
      const jsonData = exportLog();
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `mmet-sessions-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Please try again.');
    }
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const result = importLog(event.target?.result);
        
        if (result.ok) {
          setImportSuccess(true);
          setImportError(null);
          setTimeout(() => setImportSuccess(false), 3000);
        } else {
          setImportError(result.error || 'Import failed');
          setImportSuccess(false);
        }
      } catch (error) {
        setImportError(error.message || 'Failed to parse file');
        setImportSuccess(false);
      }
    };
    
    reader.onerror = () => {
      setImportError('Failed to read file');
      setImportSuccess(false);
    };
    
    reader.readAsText(file);
    
    // Reset input so same file can be imported again
    e.target.value = '';
  };

  return (
    <div className="session-log bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-4">Session Log</h2>
      
      {/* Import/Export Controls */}
      <div className="flex gap-4 mb-6 pb-6 border-b">
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors"
        >
          📥 Export Sessions
        </button>
        
        <label className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium cursor-pointer transition-colors">
          📤 Import Sessions
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </label>
      </div>
      
      {/* Import Feedback */}
      {importError && (
        <div className="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded-md mb-4">
          <strong>Import Error:</strong> {importError}
        </div>
      )}
      
      {importSuccess && (
        <div className="bg-green-50 border border-green-300 text-green-800 px-4 py-3 rounded-md mb-4">
          ✓ Sessions imported successfully!
        </div>
      )}
      
      {/* Session History */}
      <div className="session-history">
        <h3 className="text-lg font-semibold mb-3">
          History ({sessionLog.length} sessions)
        </h3>
        
        {sessionLog.length === 0 ? (
          <p className="text-gray-500 italic">
            No sessions yet. Rate a product to create your first session.
          </p>
        ) : (
          <div className="space-y-4 max-h-[600px] overflow-y-auto">
            {sessionLog.map((session) => (
              <SessionCard key={session.sessionId} session={session} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SessionCard({ session }) {
  const [expanded, setExpanded] = useState(false);
  
  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const hasActuals = session.actuals?.length > 0;
  const product = session.product || session.productsSnapshot?.[0];

  return (
    <div className="border border-gray-200 rounded-md p-4 hover:shadow-md transition-shadow">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1">
          <h4 className="font-semibold">{session.label}</h4>
          <p className="text-sm text-gray-600">
            {formatDate(session.createdAt)}
          </p>
          {product && (
            <p className="text-sm text-gray-700 mt-1">
              {product.name} {product.form ? `(${product.form})` : ''}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {hasActuals && (
            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
              {session.actuals.length} rating{session.actuals.length !== 1 ? 's' : ''}
            </span>
          )}
          <span className="text-gray-400">
            {expanded ? '▼' : '▶'}
          </span>
        </div>
      </div>
      
      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          {/* Product Details */}
          {product && (
            <div className="mb-4 bg-gray-50 p-3 rounded-md">
              <h5 className="font-medium mb-2">Product Info</h5>
              <div className="text-sm space-y-1">
                <p><strong>THC:</strong> {product.metrics?.totalTHC?.toFixed(2)}%</p>
                <p><strong>Total Terpenes:</strong> {product.metrics?.totalTerpenes?.toFixed(2)}%</p>
                {product.top6 && product.top6.length > 0 && (
                  <div>
                    <strong>Top 6 Terpenes:</strong>
                    <ul className="ml-4 mt-1">
                      {product.top6.map((t, i) => (
                        <li key={i}>
                          {t.name}: {t.pct?.toFixed(2)}%
                          {t.band && <span className="text-gray-500"> ({t.band})</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Ratings */}
          {hasActuals && (
            <div>
              <h5 className="font-medium mb-2">Ratings</h5>
              {session.actuals.map((actual) => (
                <div key={actual.id} className="mb-3 bg-blue-50 p-3 rounded-md">
                  <p className="text-xs text-gray-600 mb-2">
                    {formatDate(actual.at)}
                  </p>
                  {actual.actuals && (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {Object.entries(actual.actuals).map(([key, value]) => (
                        <div key={key}>
                          <strong className="capitalize">{key}:</strong> {value}/5
                        </div>
                      ))}
                    </div>
                  )}
                  {actual.notes && (
                    <p className="text-sm mt-2 italic border-t pt-2">
                      "{actual.notes}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

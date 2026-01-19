import React, { useState } from 'react';
import { Upload, ArrowUpDown, X, FileText, Database } from 'lucide-react';

function App() {
  const [products, setProducts] = useState([]);
  const [sortBy, setSortBy] = useState(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const effectIcons = {
    pain: '🔥',
    head: '🧠',
    couch: '🛌',
    clarity: '👁️',
    duration: '⏱️',
    functionality: '⚙️',
    anxiety: '⚠️'
  };

  const effectNames = {
    pain: 'Pain Relief',
    head: 'Head Effect',
    couch: 'Couch Effect',
    clarity: 'Clarity',
    duration: 'Duration',
    functionality: 'Functionality',
    anxiety: 'Anxiety Risk'
  };

  const calculateMMET = (product) => {
    const { thc, terps, form } = product;
    
    const classify = (pct) => {
      if (pct < 0.10) return 'none';
      if (pct < 0.30) return 'supporting';
      if (pct < 0.80) return 'dominant';
      return 'primary';
    };

    const bands = {};
    Object.keys(terps).forEach(t => {
      bands[t] = classify(terps[t]);
    });

    const formMultipliers = {
      'Live Rosin': 1.0,
      'Diamonds + Sauce': 1.15,
      'Live Badder': 0.95,
      'Live Rosin Jam': 1.05,
      'Live Sugar': 0.95,
      'Wax': 0.90,
      'Flower': 0.85
    };
    
    const baseIntensity = Math.min(5, (thc / 100) * 5 * (formMultipliers[form] || 1.0));
    
    let scores = {
      pain: 2.0,
      head: baseIntensity * 0.85,
      couch: 2.0,
      clarity: 3.0,
      duration: form.includes('Badder') || form.includes('Sugar') ? 3.5 : 4.0,
      functionality: 3.0,
      anxiety: 1.5
    };

    const applyTerpEffect = (terp, band) => {
      if (band === 'none') return;

      const strength = {
        'supporting': 0.3,
        'dominant': 0.7,
        'primary': 1.0
      }[band];

      switch(terp) {
        case 'myrcene':
          scores.couch += 1.2 * strength;
          scores.pain += 0.8 * strength;
          scores.clarity -= 0.6 * strength;
          scores.duration += 0.5 * strength;
          break;
        case 'caryophyllene':
          scores.pain += 1.0 * strength;
          scores.anxiety -= 0.8 * strength;
          scores.couch += 0.3 * strength;
          break;
        case 'limonene':
          scores.head += 0.9 * strength;
          scores.anxiety += 0.7 * strength;
          break;
        case 'pinene':
          scores.clarity += 0.8 * strength;
          scores.functionality += 0.7 * strength;
          scores.couch -= 0.5 * strength;
          break;
        case 'linalool':
          scores.anxiety -= 1.0 * strength;
          scores.couch += 0.4 * strength;
          scores.head -= 0.3 * strength;
          break;
        case 'humulene':
          scores.pain += 0.6 * strength;
          scores.duration += 0.3 * strength;
          break;
        case 'bisabolol':
          scores.anxiety -= 0.7 * strength;
          scores.clarity += 0.4 * strength;
          break;
        case 'ocimene':
          scores.head += 0.5 * strength;
          scores.couch -= 0.6 * strength;
          break;
        case 'terpinolene':
          scores.head += 0.8 * strength;
          scores.anxiety += 0.6 * strength;
          scores.clarity -= 0.5 * strength;
          break;
      }
    };

    Object.keys(terps).forEach(t => {
      applyTerpEffect(t, bands[t]);
    });

    if ((bands.limonene === 'primary' || bands.limonene === 'dominant') && 
        (bands.myrcene === 'dominant' || bands.myrcene === 'primary')) {
      scores.clarity -= 1.5;
    }

    if (bands.myrcene === 'primary' && terps.myrcene >= 0.80) {
      scores.couch = Math.max(scores.couch, 3.5);
    }

    if ((bands.limonene === 'primary' || bands.limonene === 'dominant') &&
        (bands.linalool === 'dominant' || bands.linalool === 'primary')) {
      scores.anxiety -= 1.2;
    }

    const anxietyFactor = Math.max(0, (5 - scores.anxiety) / 5);
    const clarityFactor = scores.clarity / 5;
    scores.functionality = 2.0 + (anxietyFactor * 1.5) + (clarityFactor * 1.5);
    
    if (bands.pinene === 'dominant' || bands.pinene === 'primary') {
      scores.functionality += 0.5;
    }

    Object.keys(scores).forEach(k => {
      scores[k] = Math.max(0, Math.min(5, scores[k]));
    });

    return {
      pain: Number(scores.pain.toFixed(1)),
      head: Number(scores.head.toFixed(1)),
      couch: Number(scores.couch.toFixed(1)),
      clarity: Number(scores.clarity.toFixed(1)),
      duration: Number(scores.duration.toFixed(1)),
      functionality: Number(scores.functionality.toFixed(1)),
      anxiety: Number(scores.anxiety.toFixed(1))
    };
  };

  const loadSampleData = () => {
    const samples = [
      { name: 'HAZE MAN DSL (H) Wax', thc: 71.4, totalTerps: 4.42, form: 'Wax', terps: { caryophyllene: 2.14, humulene: 0.603, linalool: 0.321, limonene: 0.212 } },
      { name: 'HAZE DP N STX (H) Live Badder', thc: 74.0, totalTerps: 8.29, form: 'Live Badder', terps: { caryophyllene: 3.00, limonene: 1.18, myrcene: 0.982, humulene: 0.965, linalool: 0.873, ocimene: 0.411 } },
      { name: 'HAZE KL WHP #11 (I) Live Sugar', thc: 73.7, totalTerps: 4.04, form: 'Live Sugar', terps: { caryophyllene: 1.37, linalool: 0.745, humulene: 0.465, limonene: 0.388, bisabolol: 0.278, myrcene: 0.252 } },
      { name: 'HAZE BTR FIN (H) Live Badder', thc: 70.0, totalTerps: 7.09, form: 'Live Badder', terps: { caryophyllene: 2.61, limonene: 1.03, humulene: 0.839, linalool: 0.708, myrcene: 0.612, ocimene: 0.343 } },
      { name: 'HAZE SHRB SNDA (H) Live Sugar', thc: 76.6, totalTerps: 5.39, form: 'Live Sugar', terps: { caryophyllene: 1.66, limonene: 1.01, linalool: 0.727, humulene: 0.442, ocimene: 0.363, guaiol: 0.343 } },
      { name: 'HAZE LPC (H) Live Sugar', thc: 75.2, totalTerps: 4.69, form: 'Live Sugar', terps: { caryophyllene: 1.39, limonene: 0.765, linalool: 0.429, ocimene: 0.346, myrcene: 0.274 } },
      { name: 'HAZE STR MNT (H) Wax', thc: 71.0, totalTerps: 6.45, form: 'Wax', terps: { caryophyllene: 2.84, humulene: 1.10, linalool: 0.695, limonene: 0.507, bisabolol: 0.246 } },
      { name: 'HAZE JLS CKE (I) Live Badder', thc: 74.8, totalTerps: 5.86, form: 'Live Badder', terps: { caryophyllene: 2.26, linalool: 1.12, limonene: 0.775, humulene: 0.774, ocimene: 0.268 } }
    ];
    setProducts(samples);
  };

  const parseCOAText = (text) => {
    const products = [];
    const lines = text.split('\n');
    
    let currentName = '';
    let currentForm = 'Live Rosin';
    let currentTHC = 0;
    let currentTerps = {};
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineLower = line.toLowerCase();
      
      if (line.match(/^[A-Z\s]+.*\(.*\).*\d+g$/i) || line.startsWith('HAZE')) {
        if (currentName && (currentTHC > 0 || Object.keys(currentTerps).length > 0)) {
          const totalTerps = Object.values(currentTerps).reduce((sum, val) => sum + val, 0);
          products.push({
            name: currentName,
            form: currentForm,
            thc: currentTHC,
            terps: {...currentTerps},
            totalTerps
          });
        }
        
        currentName = line.replace(/\s+\d+g$/i, '').trim();
        currentTHC = 0;
        currentTerps = {};
        currentForm = 'Live Rosin';
        continue;
      }
      
      if (lineLower.startsWith('form:')) {
        const formMatch = line.match(/Form:\s*(.+)/i);
        if (formMatch) {
          const formText = formMatch[1].trim();
          if (formText.toLowerCase().includes('badder')) currentForm = 'Live Badder';
          else if (formText.toLowerCase().includes('sugar')) currentForm = 'Live Sugar';
          else if (formText.toLowerCase().includes('wax')) currentForm = 'Wax';
          else if (formText.toLowerCase().includes('rosin')) currentForm = 'Live Rosin';
          else if (formText.toLowerCase().includes('jam')) currentForm = 'Live Rosin Jam';
          else if (formText.toLowerCase().includes('diamonds')) currentForm = 'Diamonds + Sauce';
        }
        continue;
      }
      
      if (lineLower.includes('total thc')) {
        const thcMatch = line.match(/(\d+\.?\d*)\s*%/);
        if (thcMatch) {
          currentTHC = parseFloat(thcMatch[1]);
        }
        continue;
      }
      
      const terpMatch = line.match(/^[\-\s]*([a-z\-]+)\s+(\d+\.?\d*)\s*%/i);
      if (terpMatch) {
        let terpName = terpMatch[1].toLowerCase().replace(/\-/g, '');
        const terpValue = parseFloat(terpMatch[2]);
        
        if (terpName.includes('myrcene')) terpName = 'myrcene';
        else if (terpName.includes('caryophyllene')) terpName = 'caryophyllene';
        else if (terpName.includes('limonene')) terpName = 'limonene';
        else if (terpName.includes('pinene')) terpName = 'pinene';
        else if (terpName.includes('linalool')) terpName = 'linalool';
        else if (terpName.includes('humulene')) terpName = 'humulene';
        else if (terpName.includes('bisabolol')) terpName = 'bisabolol';
        else if (terpName.includes('ocimene')) terpName = 'ocimene';
        else if (terpName.includes('terpinolene') || terpName.includes('terpineol')) terpName = 'terpinolene';
        else if (terpName.includes('guaiol')) terpName = 'guaiol';
        
        if (['myrcene', 'caryophyllene', 'limonene', 'pinene', 'linalool', 'humulene', 
             'bisabolol', 'ocimene', 'terpinolene', 'guaiol'].includes(terpName)) {
          currentTerps[terpName] = (currentTerps[terpName] || 0) + terpValue;
        }
      }
    }
    
    if (currentName && (currentTHC > 0 || Object.keys(currentTerps).length > 0)) {
      const totalTerps = Object.values(currentTerps).reduce((sum, val) => sum + val, 0);
      products.push({
        name: currentName,
        form: currentForm,
        thc: currentTHC,
        terps: {...currentTerps},
        totalTerps
      });
    }

    return products;
  };

  const handleParseCOA = () => {
    if (!pasteText || pasteText.length < 10) {
      alert('Please paste COA text first');
      return;
    }

    const parsed = parseCOAText(pasteText);
    
    if (parsed.length > 0) {
      setProducts(prev => [...prev, ...parsed]);
      setPasteText('');
      alert(`✅ Added ${parsed.length} products!`);
    } else {
      alert('❌ Could not find any products in the pasted text. Check the format.');
    }
  };

  const handleFileUpload = async (files) => {
    for (const file of files) {
      if (file.type === 'text/plain' || file.type === 'text/csv' || file.name.endsWith('.txt')) {
        const text = await file.text();
        const parsed = parseCOAText(text);
        
        if (parsed.length > 0) {
          setProducts(prev => [...prev, ...parsed]);
          alert(`✅ Added ${parsed.length} products from ${file.name}!`);
        }
      } else if (file.type === 'application/pdf' || file.type === 'image/jpeg' || file.type === 'image/png') {
        alert(`⚠️ ${file.name}: PDF and image files require OCR processing which isn't available. Please:\n\n1. Open the PDF/image\n2. Select and copy all text\n3. Paste it in the text area above`);
      }
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragActive(false);
    await handleFileUpload(Array.from(e.dataTransfer.files));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleFileInput = async (e) => {
    await handleFileUpload(Array.from(e.target.files));
    e.target.value = '';
  };

  const sortedProducts = [...products].sort((a, b) => {
    if (!sortBy) return 0;
    const aScore = calculateMMET(a)[sortBy];
    const bScore = calculateMMET(b)[sortBy];
    return bScore - aScore;
  });

  const removeProduct = (index) => {
    setProducts(products.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">🔬 MMET Effect Predictor</h1>
          <p className="text-sm text-gray-600 mb-4">Rank cannabis products by predicted effects • Not medical advice</p>
          
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={loadSampleData}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
            >
              <Database size={18} />
              Load Sample Products
            </button>
            <button
              onClick={() => setShowManualEntry(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <FileText size={18} />
              Add Product Manually
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-2">Or Paste COA Text</h2>
          <p className="text-sm text-gray-600 mb-4">Copy/paste text from your COA files here (supports multiple products)</p>
          
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows="10"
            className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 font-mono text-sm mb-4"
            placeholder="Paste COA text here..."
          />
          
          <button
            onClick={handleParseCOA}
            className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-semibold text-lg"
          >
            Parse & Add Products
          </button>
        </div>

        <div 
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`bg-white rounded-lg shadow-lg p-8 mb-6 border-4 border-dashed transition-all ${
            dragActive ? 'border-purple-500 bg-purple-50' : 'border-gray-300'
          }`}
        >
          <div className="text-center">
            <Upload className="mx-auto mb-4 text-gray-400" size={48} />
            <h2 className="text-lg font-bold text-gray-800 mb-2">Or Upload COA Files</h2>
            <p className="text-sm text-gray-600 mb-4">Drag & drop files here, or click to browse</p>
            
            <label className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg cursor-pointer hover:bg-blue-700 font-semibold">
              Choose Files
              <input
                type="file"
                multiple
                accept=".txt,.csv,.pdf,image/*"
                onChange={handleFileInput}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {products.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
            <div className="flex items-center gap-2 flex-wrap">
              <ArrowUpDown size={18} className="text-gray-600" />
              <span className="text-sm font-semibold text-gray-700">Rank by:</span>
              <button
                onClick={() => setSortBy(null)}
                className={`px-3 py-1 rounded text-sm ${!sortBy ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                Original
              </button>
              {Object.entries(effectNames).map(([key, name]) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  className={`px-3 py-1 rounded text-sm ${sortBy === key ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  {effectIcons[key]} {name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedProducts.map((p, i) => {
            const scores = calculateMMET(p);
            const topTerps = Object.entries(p.terps)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([name, val]) => `${name} ${val.toFixed(2)}%`)
              .join(', ');

            return (
              <div key={i} className="bg-white rounded-lg shadow-lg p-4 relative">
                <button onClick={() => removeProduct(i)} className="absolute top-2 right-2 text-gray-400 hover:text-red-600">
                  <X size={18} />
                </button>

                <div className="mb-3">
                  <div className="text-lg font-bold text-gray-800 mb-1 pr-6">{p.name}</div>
                  <div className="text-xs text-gray-500 mb-2">{p.form} • {p.thc}% THC • {p.totalTerps}% terps</div>
                  <div className="text-xs text-purple-600 mb-2">Dominant: {topTerps}</div>
                </div>

                <div className="border-t pt-3 space-y-1.5">
                  {Object.entries(scores).map(([effect, score]) => (
                    <div key={effect} className="flex justify-between items-center text-sm">
                      <span className="text-gray-700">{effectIcons[effect]} {effectNames[effect]}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              effect === 'anxiety' 
                                ? score <= 1 ? 'bg-green-500' : score <= 2.5 ? 'bg-yellow-500' : 'bg-red-500'
                                : score >= 4 ? 'bg-green-500' : score >= 2.5 ? 'bg-yellow-500' : 'bg-gray-400'
                            }`}
                            style={{ width: `${(score / 5) * 100}%` }}
                          />
                        </div>
                        <span className="font-semibold text-gray-800 w-8 text-right">{score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {products.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <FileText size={64} className="mx-auto mb-4 opacity-20" />
            <p className="mb-2">No products loaded yet</p>
            <p className="text-sm">Click "Load Sample Products" to get started</p>
          </div>
        )}

        {showManualEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowManualEntry(false)}></div>
            <div className="relative bg-white rounded-lg shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-800">Add Product Manually</h3>
                <button onClick={() => setShowManualEntry(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                  <input type="text" id="manual-name" className="w-full border border-gray-300 rounded px-3 py-2" placeholder="Product name" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total THC %</label>
                    <input type="number" id="manual-thc" step="0.1" className="w-full border border-gray-300 rounded px-3 py-2" placeholder="74.5" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Form</label>
                    <select id="manual-form" className="w-full border border-gray-300 rounded px-3 py-2">
                      <option>Live Rosin</option>
                      <option>Live Badder</option>
                      <option>Live Sugar</option>
                      <option>Wax</option>
                      <option>Diamonds + Sauce</option>
                      <option>Live Rosin Jam</option>
                      <option>Flower</option>
                    </select>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">Terpenes (% values)</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {['myrcene', 'caryophyllene', 'limonene', 'pinene', 'linalool', 'humulene', 'bisabolol', 'ocimene', 'terpinolene', 'guaiol'].map(terp => (
                      <div key={terp}>
                        <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">{terp}</label>
                        <input type="number" id={`manual-terp-${terp}`} step="0.01" className="w-full border border-gray-300 rounded px-2 py-1 text-sm" placeholder="0.00" />
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => {
                    const name = document.getElementById('manual-name').value;
                    const thc = parseFloat(document.getElementById('manual-thc').value) || 0;
                    const form = document.getElementById('manual-form').value;
                    
                    const terps = {};
                    ['myrcene', 'caryophyllene', 'limonene', 'pinene', 'linalool', 'humulene', 'bisabolol', 'ocimene', 'terpinolene', 'guaiol'].forEach(terp => {
                      const val = parseFloat(document.getElementById(`manual-terp-${terp}`).value) || 0;
                      if (val > 0) terps[terp] = val;
                    });

                    if (name && (thc > 0 || Object.keys(terps).length > 0)) {
                      const totalTerps = Object.values(terps).reduce((sum, val) => sum + val, 0);
                      setProducts(prev => [...prev, { name, thc, totalTerps: Number(totalTerps.toFixed(2)), form, terps }]);
                      setShowManualEntry(false);
                    } else {
                      alert('Please enter at least a product name and THC % or terpenes.');
                    }
                  }}
                  className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 font-semibold"
                >
                  Add Product
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

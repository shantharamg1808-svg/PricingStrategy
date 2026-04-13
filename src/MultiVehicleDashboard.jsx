import React, { useState, useMemo, useEffect } from 'react';
import {
  Car,
  Settings2,
  Download,
  TrendingUp,
  TrendingDown,
  LayoutDashboard,
  Calculator,
  Percent,
  Sigma,
  RotateCcw,
  Database,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2
} from 'lucide-react';
import { usePricingStore, parseCSV } from './GlobalPricingStore.jsx';

// --- HELPER COMPONENT FOR EDITABLE CELLS ---
function EditableCellInput({ prefix, color, value, onChange, placeholder }) {
  const [localVal, setLocalVal] = useState(value);
  
  useEffect(() => { setLocalVal(value); }, [value]);

  const handleBlur = () => {
    if (localVal !== value) {
      onChange(localVal);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') e.target.blur();
  };

  return (
    <div className="flex items-center gap-1 w-full max-w-[90px]">
      <span className={`text-[9px] w-[18px] font-extrabold ${color}`}>{prefix}</span>
      <input
        type="number"
        value={localVal === '' ? '' : Number(localVal).toString()}
        onChange={e => setLocalVal(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-xs font-semibold focus:border-[#f04343] focus:ring-1 focus:ring-[#f04343] outline-none shadow-sm transition-all text-slate-700"
      />
    </div>
  );
}

// --- MAIN DASHBOARD APP ---
export default function MultiVehicleDashboard({ setExportHandler }) {
  // --- STATE ---
  const { state: pricingState, dispatch: pricingDispatch, immediateDispatch, getComputedBaseFn } = usePricingStore();
  const modelType = pricingState.modelType;
  const globalAdjustmentPct = pricingState.globalModifier;
  const holidayModifier = pricingState.holidayModifier;
  const packages = pricingState.packages;
  const activePackages = packages.slice(0, modelType);
  const modifierSelection = pricingState.modifierSelection;
  const overrides = pricingState.overrides || {};

  const [showHolidayPricing, setShowHolidayPricing] = useState(false);
  const [targetExtraRev, setTargetExtraRev] = useState('');
  const [assumedBookings, setAssumedBookings] = useState('450');
  
  const selectedHours = pricingState.selectedHours;
  const durationMultiplier = Math.max(18, Number(selectedHours) || 24) / 24;

  const resetDuration = () => pricingDispatch({ type: 'SET_SELECTED_HOURS', value: 24 });
  const setSelectedHours = (val) => pricingDispatch({ type: 'SET_SELECTED_HOURS', value: val });

  // --- HANDLERS ---
  const handlePackageKmChange = (id, newKm) => {
    pricingDispatch({ type: 'UPDATE_PACKAGE_KM', id, value: newKm === '' ? '' : Number(newKm) });
  };

  const handleGlobalAdjustment = (e) => {
    pricingDispatch({ type: 'SET_GLOBAL_MODIFIER', value: e.target.value });
  };

  const handleHolidayAdjustment = (e) => {
    pricingDispatch({ type: 'SET_HOLIDAY_MODIFIER', value: e.target.value });
  };

  // Select/Deselect All Logic
  const isAllSelected = activePackages.every(pkg => modifierSelection.includes(pkg.id));
  const handleSelectAll = () => {
    immediateDispatch({ type: 'SET_MODIFIER_SELECTION', value: isAllSelected ? [] : activePackages.map(p => p.id) });
  };

  const toggleModifierSelection = (pkgId) => {
    immediateDispatch({ type: 'TOGGLE_MODIFIER_SELECTION', pkgId });
  };

  const handleOverride = (vId, pId, field, value) => {
    const key = `${vId}-${pId}`;
    pricingDispatch({ type: 'SET_OVERRIDE', key, field, value });
  };

  const clearAllOverrides = () => immediateDispatch({ type: 'CLEAR_OVERRIDES' });

  const handleScenarioBFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
       const text = evt.target.result;
       const rawData = parseCSV(text);
       immediateDispatch({ type: 'SET_SCENARIO_B_DATA', value: rawData });
    };
    reader.readAsText(file);
  };

  // --- CORE ENGINE LOGIC ---
  const tableData = useMemo(() => {
    let allRows = [];

    const avgCustomKm = activePackages.reduce((sum, p) => sum + (Number(p.km) || 0), 0) / (activePackages.length || 1);
    const targetValue = Number(targetExtraRev) || 0;
    const bookingsValue = Number(assumedBookings) || 450;
    const extraRateAddition = (targetValue > 0 && bookingsValue > 0 && avgCustomKm > 0) ? (targetValue / bookingsValue) / (avgCustomKm * 2.5) : 0;

    pricingState.vehicles.forEach(car => {
      activePackages.forEach(pkg => {
        const customKm = Number(pkg.km) || 0;
        if (customKm === 0) return; 

        // 1. Find Closest Slab
        let closestSlab = car.slabs[0];
        let minDiff = Math.abs(customKm - car.slabs[0].km);

        for (let i = 1; i < car.slabs.length; i++) {
          const diff = Math.abs(customKm - car.slabs[i].km);
          if (diff < minDiff) {
            minDiff = diff;
            closestSlab = car.slabs[i];
          }
        }

        // 2. Linear Scaling Difference
        const difference = customKm - closestSlab.km;
        const diffPercentage = difference / closestSlab.km;
        
        // Apply Global Modifier ONLY IF package is selected in the checkboxes
        let pctModifier = 1;
        if (modifierSelection.includes(pkg.id)) {
          pctModifier = 1 + ((Number(globalAdjustmentPct) || 0) / 100);
        }

        // 3. Mathematical Defaults & Custom Scenario B Substitution
        const calculatedBasePrice = getComputedBaseFn ? getComputedBaseFn(car.name) : null;
        
        let extraRateBump = 0;
        if (modifierSelection.includes(pkg.id)) {
           extraRateBump = extraRateAddition;
        }

        const calcWdRate = (closestSlab.rate * (1 + diffPercentage) * pctModifier) + extraRateBump;
        const calcWeRate = (closestSlab.weekendRate * (1 + diffPercentage) * pctModifier) + extraRateBump;
        const calcWdBase = calculatedBasePrice ?? closestSlab.basePrice;
        const calcWeBase = calculatedBasePrice ?? closestSlab.weekendBase;

        // 4. Fetch User Overrides (if any)
        const overrideKey = `${car.id}-${pkg.id}`;
        const rowOverrides = overrides[overrideKey] || {};

        const finalWdBase = rowOverrides.wdBase !== undefined && rowOverrides.wdBase !== '' ? rowOverrides.wdBase : calcWdBase;
        const finalWeBase = rowOverrides.weBase !== undefined && rowOverrides.weBase !== '' ? rowOverrides.weBase : calcWeBase;
        const finalWdRate = rowOverrides.wdRate !== undefined && rowOverrides.wdRate !== '' ? rowOverrides.wdRate : calcWdRate;
        const finalWeRate = rowOverrides.weRate !== undefined && rowOverrides.weRate !== '' ? rowOverrides.weRate : calcWeRate;

        // 5. Compute Final Totals
        const trueWdTotal = finalWdBase + (finalWdRate * customKm);
        const trueWeTotal = finalWeBase + (finalWeRate * customKm);

        let wdTotal = trueWdTotal * durationMultiplier;
        let weTotal = trueWeTotal * durationMultiplier;
        const adjustedKm = customKm * durationMultiplier;

        if (showHolidayPricing) {
           const holMod = 1 + ((Number(holidayModifier) || 0) / 100);
           wdTotal *= holMod;
           weTotal *= holMod;
        }

        allRows.push({
          vId: car.id,
          pId: pkg.id,
          vehicle: car.name,
          category: car.category,
          transmission: car.transmission,
          refSlabKm: closestSlab.km,
          newPackageKm: customKm,
          adjustedKm: adjustedKm,
          
          wdBase: finalWdBase,
          weBase: finalWeBase,
          wdRate: finalWdRate,
          weRate: finalWeRate,
          
          wdHourlyRate: trueWdTotal / 24,
          weHourlyRate: trueWeTotal / 24,

          wdTotal: wdTotal,
          weTotal: weTotal,
          
          ogWdTotal: closestSlab.ogWd * durationMultiplier,
          ogWeTotal: closestSlab.ogWe * durationMultiplier,

          isWdBaseCustom: rowOverrides.wdBase !== undefined && rowOverrides.wdBase !== '',
          isWeBaseCustom: rowOverrides.weBase !== undefined && rowOverrides.weBase !== '',
          isWdRateCustom: rowOverrides.wdRate !== undefined && rowOverrides.wdRate !== '',
          isWeRateCustom: rowOverrides.weRate !== undefined && rowOverrides.weRate !== '',
        });
      });
    });

    return allRows;
  }, [activePackages, globalAdjustmentPct, overrides, modifierSelection, pricingState.vehicles, durationMultiplier, showHolidayPricing, holidayModifier]);

  // --- AVERAGES CALCULATION ---
  const averages = useMemo(() => {
    if (tableData.length === 0) return { wdRate: 0, weRate: 0, newWdRate: 0, newWeRate: 0 };
    
    let sumOrigWdRate = 0; let sumOrigWeRate = 0;
    let sumNewWdRate = 0;  let sumNewWeRate = 0;

    pricingState.vehicles.forEach(car => {
        sumOrigWdRate += car.slabs[0].rate;
        sumOrigWeRate += car.slabs[0].weekendRate;
    });

    tableData.forEach(row => {
      sumNewWdRate += row.wdRate;
      sumNewWeRate += row.weRate;
    });

    return {
      wdRate: sumOrigWdRate / Math.max(1, pricingState.vehicles.length),
      weRate: sumOrigWeRate / Math.max(1, pricingState.vehicles.length),
      newWdRate: sumNewWdRate / Math.max(1, tableData.length),
      newWeRate: sumNewWeRate / Math.max(1, tableData.length),
    };
  }, [tableData, pricingState.vehicles, activePackages, modifierSelection, globalAdjustmentPct, holidayModifier, showHolidayPricing, selectedHours, overrides, pricingState.pricingMode, pricingState.scenarioBWeights, pricingState.scenarioBData, targetExtraRev, assumedBookings]);

  // --- CSV EXPORT LOGIC ---
  const exportCSV = () => {
    const headers = [
      "Vehicle", "Type", "Transmission", "Ref Slab KM", "New Package KM", "Selected Duration", "Adjusted Package KM",
      "WD Base Price", "WD KM Rate", "Weekday Est. Price", "WD Hourly Rate", "OG Fixed Weekday Slab Price",
      "WE Base Price", "WE KM Rate", "Weekend Est. Price", "WE Hourly Rate", "OG Fixed Weekend Slab Price"
    ];

    const csvRows = [headers.join(',')];

    tableData.forEach(row => {
      const rowData = [
        `"${row.vehicle}"`, `"${row.category}"`, `"${row.transmission}"`, row.refSlabKm, row.newPackageKm, selectedHours, row.adjustedKm,
        row.wdBase.toFixed(2), row.wdRate.toFixed(4), row.wdTotal.toFixed(2), row.wdHourlyRate.toFixed(2), row.ogWdTotal.toFixed(2),
        row.weBase.toFixed(2), row.weRate.toFixed(4), row.weTotal.toFixed(2), row.weHourlyRate.toFixed(2), row.ogWeTotal.toFixed(2)
      ];
      csvRows.push(rowData.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'dynamic_pricing_analysis.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  React.useEffect(() => {
    if (!setExportHandler) return;
    setExportHandler(() => exportCSV);
    return () => setExportHandler(null);
  }, [setExportHandler, exportCSV]);

  const formatINR = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
  const formatRate = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(val);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
      <div className="flex-1 p-4 md:p-6 w-full flex flex-col gap-6 max-w-[1600px] mx-auto">
        
        {/* TOP CONTROLS & AVERAGES GRID */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* CONFIGURATION PANEL */}
          <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col gap-6">
            
            {/* PRICING MODE TOGGLE */}
            <div className={`p-4 rounded-xl border ${pricingState.pricingMode === 'B' ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                 <div>
                    <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-1">
                      <Database className={`${pricingState.pricingMode === 'B' ? 'text-indigo-500' : 'text-slate-400'}`} size={16} />
                      Pricing Strategy Mode
                    </h2>
                    <p className="text-[10px] text-slate-500">
                      {pricingState.pricingMode === 'A' ? 'Scenario A: Utilizing standard hardcoded base prices and regression formulas.' : 'Scenario B: Dynamic base prices governed by Market/Fleet weight distributions.'}
                    </p>
                 </div>
                 
                 <div className="flex bg-white p-1 rounded-lg border border-slate-200 shrink-0 shadow-sm">
                    <button 
                      onClick={() => immediateDispatch({ type: 'SET_PRICING_MODE', value: 'A' })}
                      className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${pricingState.pricingMode === 'A' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                      <CheckCircle2 size={14} className={pricingState.pricingMode === 'A' ? 'opacity-100' : 'opacity-0 hidden'} /> Scenario A
                    </button>
                    <button 
                      onClick={() => immediateDispatch({ type: 'SET_PRICING_MODE', value: 'B' })}
                      className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${pricingState.pricingMode === 'B' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                      <CheckCircle2 size={14} className={pricingState.pricingMode === 'B' ? 'opacity-100' : 'opacity-0 hidden'} /> Scenario B
                    </button>
                 </div>
              </div>

              {/* CSV Upload / Weight Sliders (Only visible in Mode B) */}
              {pricingState.pricingMode === 'B' && (
                <div className="mt-4 pt-4 border-t border-indigo-100 animate-in slide-in-from-top-2">
                   {!pricingState.scenarioBData ? (
                       <div className="border border-dashed border-indigo-300 rounded-lg p-5 text-center bg-white hover:bg-indigo-50/50 transition-colors relative cursor-pointer group">
                          <input type="file" accept=".csv" onChange={handleScenarioBFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                          <UploadCloud className="text-indigo-400 mx-auto mb-2 group-hover:text-indigo-600 transition-colors" size={24} />
                          <p className="text-xs font-bold text-indigo-900 mb-0.5">Upload CSV Weights Sheet</p>
                          <p className="text-[10px] text-indigo-500">Enable algorithmic dynamic base pricing</p>
                       </div>
                   ) : (
                       <div className="bg-white rounded-lg p-4 border border-indigo-100 shadow-sm flex flex-col md:flex-row gap-6 items-center">
                          <div className="flex-1 flex gap-4 w-full">
                             <div className="flex-1">
                                <label className="block text-[10px] font-bold text-indigo-500 uppercase tracking-wide mb-1.5">Market Weight</label>
                                <div className="relative">
                                   <input type="number" 
                                     value={pricingState.scenarioBWeights.market} 
                                     onChange={(e) => immediateDispatch({ type: 'SET_SCENARIO_B_WEIGHTS', value: { market: e.target.value, fleet: 100 - Number(e.target.value) } })}
                                     className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all" />
                                   <span className="absolute right-3 top-2.5 text-[10px] font-bold text-slate-400">%</span>
                                </div>
                             </div>
                             <div className="flex-1">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Fleet Weight</label>
                                <div className="relative">
                                   <input type="number" 
                                     value={pricingState.scenarioBWeights.fleet} 
                                     onChange={(e) => immediateDispatch({ type: 'SET_SCENARIO_B_WEIGHTS', value: { fleet: e.target.value, market: 100 - Number(e.target.value) } })}
                                     className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all" />
                                   <span className="absolute right-3 top-2.5 text-[10px] font-bold text-slate-400">%</span>
                                </div>
                             </div>
                          </div>
                          
                          <div className="shrink-0 flex flex-col items-end border-l border-indigo-50 pl-6 space-y-2 w-full md:w-auto">
                             <div className="flex items-center gap-2 bg-indigo-50 px-2 py-1 rounded text-[10px] font-bold text-indigo-700">
                               <FileSpreadsheet size={12} /> Data Linked ({pricingState.scenarioBData.length} records)
                             </div>
                             <button onClick={() => immediateDispatch({ type: 'SET_SCENARIO_B_DATA', value: null })} className="text-[10px] font-bold text-red-500 hover:text-red-700 underline">Remove Data</button>
                          </div>
                       </div>
                   )}
                </div>
              )}
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-slate-100 pt-6 mt-2 relative">
               {pricingState.pricingMode === 'B' && (
                 <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] z-20 flex items-center justify-center">
                    <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm animate-pulse border border-indigo-200">
                      Settings controlled by Scenario B Weights
                    </span>
                 </div>
               )}
               
              <h2 className={`text-lg font-bold flex items-center gap-2 ${pricingState.pricingMode === 'B' ? 'text-slate-300' : 'text-slate-800'}`}>
                <Settings2 className="text-[#f04343]" size={20} />
                Package Settings
              </h2>
              <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-lg w-max">
                <button 
                  onClick={() => immediateDispatch({ type: 'SET_MODEL_TYPE', value: 3 })}
                  className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${modelType === 3 ? 'bg-white text-[#f04343] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  3 Trip Model
                </button>
                <button 
                  onClick={() => immediateDispatch({ type: 'SET_MODEL_TYPE', value: 4 })}
                  className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${modelType === 4 ? 'bg-white text-[#f04343] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  4 Trip Model
                </button>

              </div>
            </div>

            <div className="flex flex-wrap gap-4 items-start">
              
              {/* Duration Selector */}
              <div className="min-w-[120px] max-w-[150px] border-r border-slate-100 pr-4">
                <label className="block text-xs font-bold text-indigo-500 uppercase tracking-wide mb-1 flex items-center justify-between">
                  <span>Duration</span>
                  {selectedHours !== 24 && <button onClick={resetDuration} className="text-[#f04343] hover:text-red-700 underline text-[9px]">Reset</button>}
                </label>
                <div className="flex flex-col gap-2">
                  <div className="relative">
                    <input
                      type="number"
                      min="18"
                      value={selectedHours === '' ? '' : selectedHours}
                      onChange={(e) => setSelectedHours(e.target.value)}
                      className="w-full bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-2 text-sm font-bold text-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono"
                    />
                    <span className="absolute right-2 top-2.5 text-indigo-400 font-bold text-xs uppercase">Hrs</span>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {[18, 24, 36, 48].map(h => (
                       <button key={h} onClick={() => setSelectedHours(h)} className={`px-2 py-0.5 text-[10px] font-bold rounded ${selectedHours === h ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'} transition-all`}>{h}h</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Distance Inputs */}
              {activePackages.map((pkg, index) => (
                <div key={pkg.id} className="flex-1 min-w-[90px]">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Pkg {index + 1}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={pkg.km}
                      onChange={(e) => handlePackageKmChange(pkg.id, e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#f04343]/50 focus:border-[#f04343] transition-all"
                    />
                    <span className="absolute right-2 top-2.5 text-slate-400 font-medium text-xs">km</span>
                  </div>
                </div>
              ))}
              
              {/* MODIFIERS & TARGETS */}
              <div className="w-full xl:w-auto xl:flex-[3] min-w-[300px] border-t pt-4 mt-2 xl:border-t-0 xl:pt-0 xl:mt-0 xl:border-l border-slate-200 xl:pl-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                  
                  {/* Global Modifier */}
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-[#f04343] uppercase tracking-wide flex items-center gap-1 mb-2">
                      <Percent size={12} /> Global Modifier
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={globalAdjustmentPct}
                        onChange={handleGlobalAdjustment}
                        className="w-full bg-[#f04343]/5 border border-[#f04343]/30 rounded-lg px-3 py-2 text-base font-bold text-[#f04343] focus:outline-none focus:ring-2 focus:ring-[#f04343]/50 focus:border-[#f04343] transition-all"
                        placeholder="e.g. 5 or -5"
                      />
                      <span className="absolute right-3 top-2.5 text-[#f04343]/60 font-medium text-sm">%</span>
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-amber-500 uppercase tracking-wide flex items-center justify-between gap-1 mb-2">
                       <span className="flex items-center gap-1"><TrendingUp size={12} /> Holiday Premium</span>
                       {Number(holidayModifier) !== 0 && (
                          <label className="relative inline-flex items-center cursor-pointer" title="Simulate Holiday Pricing">
                            <input type="checkbox" className="sr-only peer" checked={showHolidayPricing} onChange={() => setShowHolidayPricing(!showHolidayPricing)} />
                            <div className="w-6 h-3.5 bg-amber-200/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1.5px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-[12px] after:w-[12px] after:transition-all peer-checked:bg-amber-500"></div>
                          </label>
                       )}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={holidayModifier}
                        onChange={handleHolidayAdjustment}
                        className="w-full bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-base font-bold text-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-400 transition-all"
                        placeholder="e.g. 15"
                      />
                      <span className="absolute right-3 top-2.5 text-amber-500/60 font-medium text-sm">%</span>
                    </div>
                  </div>

                  {/* Target Revenue Generator */}
                  <div>
                    <label className="block text-xs font-bold text-emerald-600 uppercase tracking-wide flex items-center justify-between gap-1 mb-2">
                       <span className="flex items-center gap-1"><Sigma size={12} /> Target Bump</span>
                       <div className="flex items-center text-[9px] gap-1">
                          Bkgs: <input type="number" value={assumedBookings} onChange={e => setAssumedBookings(e.target.value)} className="w-[40px] appearance-none bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 focus:border-emerald-500 rounded p-0.5 text-center outline-none" />
                       </div>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={targetExtraRev}
                        onChange={e => setTargetExtraRev(e.target.value)}
                        className="w-full bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-base font-bold text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-400 transition-all font-mono"
                        placeholder="e.g. 1000000"
                      />
                      <span className="absolute right-3 top-2.5 text-emerald-500/60 font-medium text-sm">₹</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col gap-3 mt-1">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Apply Modifier To:</span>
                    <div className="flex items-center gap-4 flex-wrap">
                      
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 cursor-pointer hover:text-[#f04343] transition-colors">
                        <input 
                          type="checkbox" 
                          checked={isAllSelected} 
                          onChange={handleSelectAll} 
                          className="w-3.5 h-3.5 accent-[#f04343] cursor-pointer" 
                        />
                        Select All
                      </label>

                      {activePackages.map((pkg) => (
                        <label key={`cb-${pkg.id}`} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer hover:text-slate-900 transition-colors">
                          <input
                            type="checkbox"
                            checked={modifierSelection.includes(pkg.id)}
                            onChange={() => toggleModifierSelection(pkg.id)}
                            className="w-3.5 h-3.5 accent-[#f04343] cursor-pointer"
                          />
                          {pkg.km ? `${pkg.km} km` : 'Empty'}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* AVERAGES DASHBOARD */}
          <div className="bg-slate-900 rounded-2xl shadow-sm border border-slate-800 p-5 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -right-6 -top-6 opacity-10 text-white">
              <Sigma size={120} />
            </div>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 relative z-10">Rate Averages</h2>
            
            <div className="grid grid-cols-2 gap-4 relative z-10">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1 font-bold">Weekday Avg</p>
                <div className="flex items-end gap-2">
                  <p className="text-xl font-bold text-[#f04343]">{formatRate(averages.newWdRate)}</p>
                  <p className="text-xs line-through text-slate-500 mb-1">{formatRate(averages.wdRate)}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1 font-bold">Weekend Avg</p>
                <div className="flex items-end gap-2">
                  <p className="text-xl font-bold text-indigo-400">{formatRate(averages.newWeRate)}</p>
                  <p className="text-xs line-through text-slate-500 mb-1">{formatRate(averages.weRate)}</p>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* MAIN DATA TABLE */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col flex-1 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center flex-wrap gap-2">
             <div className="flex flex-col">
               <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                  <Car className="text-[#f04343]" size={18} />
                  Vehicle Pricing Output ({tableData.length} options)
                  {showHolidayPricing && <span className="ml-2 text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold">Holiday Simulation</span>}
               </h2>
               <span className="text-xs font-medium text-slate-500 mt-0.5">Edit inputs directly in the table to override mathematical regression defaults.</span>
             </div>
            <div className="flex items-center gap-2">
                {Object.keys(overrides).length > 0 && (
                    <button onClick={clearAllOverrides} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 bg-white border border-slate-300 px-3 py-1.5 rounded-lg transition-all shadow-sm">
                        <RotateCcw size={14} /> Clear {Object.keys(overrides).length} Manual Edits
                    </button>
                )}
                <button onClick={() => immediateDispatch({ type: 'RESET_PACKAGES_TO_DEFAULT' })} className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#f04343] hover:bg-red-700 px-3 py-1.5 rounded-lg transition-all shadow-sm">
                    <RotateCcw size={14} /> Revert to Default Packages
                </button>
            </div>
          </div>

          <div className="overflow-x-auto overflow-y-auto">
            <table className="w-full text-left border-collapse min-w-[1200px]">
              
              <thead>
                <tr className="text-slate-500 text-[10px] uppercase tracking-wider">
                  <th className="p-3 font-bold bg-slate-50 border-r border-b-2 border-slate-200 w-[180px] sticky left-0 z-10">Vehicle</th>
                  <th className="p-3 font-bold text-center bg-white border-b-2 border-slate-200">Ref Slab</th>
                  <th className="p-3 font-bold text-[#f04343] bg-[#fdf2f2] text-center border-r border-b-2 border-slate-200">
                     Target Pkg
                     {selectedHours !== 24 && <span className="block text-[9px] text-[#f04343]/70 font-normal">({selectedHours}h limits)</span>}
                  </th>
                  <th className="p-3 font-bold text-center bg-white border-b-2 border-slate-200 min-w-[90px]">Base Price (24h)</th>
                  <th className="p-3 font-bold text-center border-r border-slate-200 bg-white border-b-2">KM Rate (₹)</th>
                  <th className="p-3 font-bold text-center border-r border-slate-200 bg-[#f8fafc] border-b-2 min-w-[90px]">Hourly Rate</th>
                  <th className="p-3 font-bold bg-slate-800 text-white w-[160px] border-b-2 border-slate-800">Weekday Est. ({selectedHours}h)</th>
                  <th className="p-3 font-bold bg-indigo-900 text-indigo-100 w-[160px] border-b-2 border-indigo-900">Weekend Est. ({selectedHours}h)</th>
                </tr>
              </thead>
              
              <tbody className="divide-y divide-slate-100 text-sm">
                {tableData.map((row, idx) => (
                  <tr key={`${row.vId}-${row.pId}-${idx}`} className="hover:bg-slate-50 transition-colors">
                    
                    {/* Vehicle */}
                    <td className="p-3 font-bold text-slate-800 bg-slate-50 border-r border-slate-200 truncate max-w-[180px] sticky left-0 z-10" title={row.vehicle}>
                      <div className="flex flex-col">
                        <span>{row.vehicle}</span>
                        <span className="text-[9px] font-semibold text-slate-400 mt-0.5 uppercase tracking-wide">
                          {row.category} • {row.transmission}
                        </span>
                      </div>
                    </td>
                    
                    {/* References */}
                    <td className="p-3 text-slate-500 font-semibold text-center text-xs">{row.refSlabKm} km</td>
                    <td className="p-3 font-bold text-[#f04343] bg-[#fdf2f2] text-center border-r border-slate-100">
                      {selectedHours === 24 ? (
                         <span>{row.newPackageKm} km</span>
                      ) : (
                         <div className="flex flex-col">
                           <span>{Math.round(row.adjustedKm)} km</span>
                           <span className="text-[9px] text-[#f04343]/60 font-semibold line-through">({row.newPackageKm} km)</span>
                         </div>
                      )}
                    </td>
                    
                    {/* Editable Base Prices */}
                    <td className="p-3">
                      <div className="flex flex-col gap-1.5 items-center">
                         <EditableCellInput 
                            prefix="WD" color={row.isWdBaseCustom ? "text-amber-500" : "text-slate-400"} 
                            value={row.wdBase.toFixed(2)} onChange={(v) => handleOverride(row.vId, row.pId, 'wdBase', v)} 
                         />
                         <EditableCellInput 
                            prefix="WE" color={row.isWeBaseCustom ? "text-amber-500" : "text-indigo-400"} 
                            value={row.weBase.toFixed(2)} onChange={(v) => handleOverride(row.vId, row.pId, 'weBase', v)} 
                         />
                      </div>
                    </td>

                    {/* Editable Rates */}
                    <td className="p-3 border-r border-slate-100">
                      <div className="flex flex-col gap-1.5 items-center">
                         <EditableCellInput 
                            prefix="WD" color={row.isWdRateCustom ? "text-amber-500" : "text-slate-400"} 
                            value={row.wdRate.toFixed(4)} onChange={(v) => handleOverride(row.vId, row.pId, 'wdRate', v)} 
                         />
                         <EditableCellInput 
                            prefix="WE" color={row.isWeRateCustom ? "text-amber-500" : "text-indigo-400"} 
                            value={row.weRate.toFixed(4)} onChange={(v) => handleOverride(row.vId, row.pId, 'weRate', v)} 
                         />
                      </div>
                    </td>

                    {/* Hourly Rate */}
                    <td className="p-3 border-r border-slate-100 bg-[#f8fafc]">
                      <div className="flex flex-col gap-1.5 items-center">
                         <div className="flex items-center gap-1">
                            <span className="text-[9px] w-[18px] font-extrabold text-slate-400">WD</span>
                            <span className="text-xs font-bold text-slate-700 w-[55px] text-right">₹{row.wdHourlyRate.toFixed(2)}</span>
                         </div>
                         <div className="flex items-center gap-1">
                            <span className="text-[9px] w-[18px] font-extrabold text-indigo-400">WE</span>
                            <span className="text-xs font-bold text-slate-700 w-[55px] text-right">₹{row.weHourlyRate.toFixed(2)}</span>
                         </div>
                      </div>
                    </td>
                    
                    {/* Weekday Output */}
                    <td className="p-3">
                      <div className="flex flex-col">
                        <span className="font-extrabold text-slate-900 text-base">{formatINR(row.wdTotal)}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase mt-0.5" title="Fixed Price of the Reference Slab">
                          OG Slab: {formatINR(row.ogWdTotal)}
                        </span>
                      </div>
                    </td>

                    {/* Weekend Output */}
                    <td className="p-3 bg-indigo-50/30">
                      <div className="flex flex-col">
                        <span className="font-extrabold text-indigo-900 text-base">{formatINR(row.weTotal)}</span>
                        <span className="text-[10px] text-indigo-400/80 font-bold uppercase mt-0.5" title="Fixed Price of the Reference Slab">
                          OG Slab: {formatINR(row.ogWeTotal)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {tableData.length === 0 && (
                  <tr>
                    <td colSpan="7" className="p-10 text-center text-slate-500 font-medium">
                      No data to display. Please configure kilometer packages.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

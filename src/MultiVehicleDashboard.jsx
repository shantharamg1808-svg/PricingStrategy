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
  RotateCcw
} from 'lucide-react';
import { usePricingStore } from './GlobalPricingStore.jsx';

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
  const { state: pricingState, dispatch: pricingDispatch, immediateDispatch } = usePricingStore();
  const modelType = pricingState.modelType;
  const globalAdjustmentPct = pricingState.globalModifier;
  const packages = pricingState.packages;
  const activePackages = packages.slice(0, modelType);
  const modifierSelection = pricingState.modifierSelection;
  const overrides = pricingState.overrides || {};

  // --- HANDLERS ---
  const handlePackageKmChange = (id, newKm) => {
    pricingDispatch({ type: 'UPDATE_PACKAGE_KM', id, value: newKm === '' ? '' : Number(newKm) });
  };

  const handleGlobalAdjustment = (e) => {
    pricingDispatch({ type: 'SET_GLOBAL_MODIFIER', value: e.target.value });
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

  // --- CORE ENGINE LOGIC ---
  const tableData = useMemo(() => {
    let allRows = [];

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

        // 3. Mathematical Defaults
        const calcWdRate = closestSlab.rate * (1 + diffPercentage) * pctModifier;
        const calcWeRate = closestSlab.weekendRate * (1 + diffPercentage) * pctModifier;
        const calcWdBase = closestSlab.basePrice;
        const calcWeBase = closestSlab.weekendBase;

        // 4. Fetch User Overrides (if any)
        const overrideKey = `${car.id}-${pkg.id}`;
        const rowOverrides = overrides[overrideKey] || {};

        const finalWdBase = rowOverrides.wdBase !== undefined && rowOverrides.wdBase !== '' ? rowOverrides.wdBase : calcWdBase;
        const finalWeBase = rowOverrides.weBase !== undefined && rowOverrides.weBase !== '' ? rowOverrides.weBase : calcWeBase;
        const finalWdRate = rowOverrides.wdRate !== undefined && rowOverrides.wdRate !== '' ? rowOverrides.wdRate : calcWdRate;
        const finalWeRate = rowOverrides.weRate !== undefined && rowOverrides.weRate !== '' ? rowOverrides.weRate : calcWeRate;

        // 5. Compute Final Totals
        const wdTotal = finalWdBase + (finalWdRate * customKm);
        const weTotal = finalWeBase + (finalWeRate * customKm);

        allRows.push({
          vId: car.id,
          pId: pkg.id,
          vehicle: car.name,
          refSlabKm: closestSlab.km,
          newPackageKm: customKm,
          
          wdBase: finalWdBase,
          weBase: finalWeBase,
          wdRate: finalWdRate,
          weRate: finalWeRate,
          
          wdTotal: wdTotal,
          weTotal: weTotal,
          
          ogWdTotal: closestSlab.ogWd,
          ogWeTotal: closestSlab.ogWe,

          isWdBaseCustom: rowOverrides.wdBase !== undefined && rowOverrides.wdBase !== '',
          isWeBaseCustom: rowOverrides.weBase !== undefined && rowOverrides.weBase !== '',
          isWdRateCustom: rowOverrides.wdRate !== undefined && rowOverrides.wdRate !== '',
          isWeRateCustom: rowOverrides.weRate !== undefined && rowOverrides.weRate !== '',
        });
      });
    });

    return allRows;
  }, [activePackages, globalAdjustmentPct, overrides, modifierSelection, pricingState.vehicles]);

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
      wdRate: sumOrigWdRate / pricingState.vehicles.length,
      weRate: sumOrigWeRate / pricingState.vehicles.length,
      newWdRate: sumNewWdRate / tableData.length,
      newWeRate: sumNewWeRate / tableData.length,
    };
  }, [tableData, pricingState.vehicles]);

  // --- CSV EXPORT LOGIC ---
  const exportCSV = () => {
    const headers = [
      "Vehicle", "Ref Slab KM", "New Package KM", 
      "WD Base Price", "WD KM Rate", "Weekday Est. Price", "OG Fixed Weekday Slab Price",
      "WE Base Price", "WE KM Rate", "Weekend Est. Price", "OG Fixed Weekend Slab Price"
    ];

    const csvRows = [headers.join(',')];

    tableData.forEach(row => {
      const rowData = [
        `"${row.vehicle}"`, row.refSlabKm, row.newPackageKm,
        row.wdBase.toFixed(2), row.wdRate.toFixed(4), row.wdTotal.toFixed(2), row.ogWdTotal.toFixed(2),
        row.weBase.toFixed(2), row.weRate.toFixed(4), row.weTotal.toFixed(2), row.ogWeTotal.toFixed(2)
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
          <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
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
              
              {/* SELECTIVE GLOBAL MODIFIER */}
              <div className="w-full xl:w-auto xl:flex-[2] min-w-[300px] border-t pt-4 mt-2 xl:border-t-0 xl:pt-0 xl:mt-0 xl:border-l border-slate-200 xl:pl-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-[#f04343] uppercase tracking-wide flex items-center gap-1">
                    <Percent size={12} /> Global Modifier
                  </label>
                </div>
                
                <div className="flex flex-col gap-3">
                  <div className="relative w-32">
                    <input
                      type="number"
                      value={globalAdjustmentPct}
                      onChange={handleGlobalAdjustment}
                      className="w-full bg-[#f04343]/5 border border-[#f04343]/30 rounded-lg px-3 py-2 text-base font-bold text-[#f04343] focus:outline-none focus:ring-2 focus:ring-[#f04343]/50 focus:border-[#f04343] transition-all"
                      placeholder="e.g. 5 or -5"
                    />
                    <span className="absolute right-3 top-2.5 text-[#f04343]/60 font-medium text-sm">%</span>
                  </div>
                  
                  {/* Range Specific Checkboxes */}
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
                  <th className="p-3 font-bold text-[#f04343] bg-[#fdf2f2] text-center border-r border-b-2 border-slate-200">Target Pkg</th>
                  <th className="p-3 font-bold text-center bg-white border-b-2 border-slate-200">Base Price (₹)</th>
                  <th className="p-3 font-bold text-center border-r border-slate-200 bg-white border-b-2">KM Rate (₹)</th>
                  <th className="p-3 font-bold bg-slate-800 text-white w-[160px] border-b-2 border-slate-800">Weekday Estimate</th>
                  <th className="p-3 font-bold bg-indigo-900 text-indigo-100 w-[160px] border-b-2 border-indigo-900">Weekend Estimate</th>
                </tr>
              </thead>
              
              <tbody className="divide-y divide-slate-100 text-sm">
                {tableData.map((row, idx) => (
                  <tr key={`${row.vId}-${row.pId}-${idx}`} className="hover:bg-slate-50 transition-colors">
                    
                    {/* Vehicle */}
                    <td className="p-3 font-bold text-slate-800 bg-slate-50 border-r border-slate-200 truncate max-w-[180px] sticky left-0 z-10" title={row.vehicle}>
                      {row.vehicle}
                    </td>
                    
                    {/* References */}
                    <td className="p-3 text-slate-500 font-semibold text-center text-xs">{row.refSlabKm} km</td>
                    <td className="p-3 font-bold text-[#f04343] bg-[#fdf2f2] text-center border-r border-slate-100">{row.newPackageKm} km</td>
                    
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

import React, { useState, useMemo } from 'react';
import {
  Car,
  Settings2,
  RotateCcw,
  Info,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Calculator,
  LayoutDashboard,
  Scale,
  Download,
  BarChart3,
  Menu,
  X
} from 'lucide-react';
import TripPackageAnalyzer from './TripPackageAnalyzer.jsx';
import MultiVehicleDashboard from './MultiVehicleDashboard.jsx';
import FinancialStrategySimulator from './FinancialStrategySimulator.jsx';
import RevenueDashboard from './RevenueDashboard.jsx';
import { GlobalPricingProvider, usePricingStore } from './GlobalPricingStore.jsx';

const MIN_KM = 1;
const MAX_KM = 3000;


function AppInner() {
  const { state: pricingState, dispatch: pricingDispatch } = usePricingStore();
  const [exportCsvFn, setExportCsvFn] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Clear export handler when switching views (prevents stale handlers)
  React.useEffect(() => {
    setExportCsvFn(null);
  }, [pricingState.activePage]);

  const selectedCarId = pricingState.selectedCarId;
  const selectedCar = pricingState.vehicles[selectedCarId] || pricingState.vehicles[0];
  const modelType = pricingState.modelType;

  // Sync state to GlobalPricingStore
  const handleInputChange = (pkgId, field, value) => {
    if (field === 'km') {
      pricingDispatch({ type: 'UPDATE_PACKAGE_KM', id: pkgId, value: value === '' ? '' : Number(value) });
    } else {
      const key = `${selectedCarId}-${pkgId}`;
      const storeField = field === 'baseOverride' ? 'wdBase' : 'wdRate';
      pricingDispatch({ type: 'SET_OVERRIDE', key, field: storeField, value });
    }
  };

  const resetOverrides = (pkgId) => {
    const key = `${selectedCarId}-${pkgId}`;
    // We don't have a specific way to reset one car-package override in the store easily 
    // without clearing it or setting to undefined. Let's just set to empty string.
    pricingDispatch({ type: 'SET_OVERRIDE', key, field: 'wdBase', value: '' });
    pricingDispatch({ type: 'SET_OVERRIDE', key, field: 'wdRate', value: '' });
  };

  const calculateTripDataGlobal = (pkg, car) => {
    const kmValue = parseFloat(pkg.km);
    if (isNaN(kmValue) || kmValue < 0) return { id: pkg.id, km: pkg.km, error: 'Enter valid km.' };

    const slabs = car.slabs;
    let closestSlab = slabs[0];
    let minDiff = Math.abs(kmValue - slabs[0].km);

    for (let i = 1; i < slabs.length; i++) {
      const diff = Math.abs(kmValue - slabs[i].km);
      if (diff < minDiff) { minDiff = diff; closestSlab = slabs[i]; }
    }

    const difference = kmValue - closestSlab.km;
    const diffPercentage = difference / closestSlab.km;
    
    // Applying global modifier if package is selected
    let pctModifier = 1;
    if (pricingState.modifierSelection.includes(pkg.id)) {
      pctModifier = 1 + ((Number(pricingState.globalModifier) || 0) / 100);
    }

    const calculatedAdjustedRate = closestSlab.rate * (1 + diffPercentage) * pctModifier;
    const calculatedBasePrice = closestSlab.basePrice;

    const overrideKey = `${car.id}-${pkg.id}`;
    const rowOverrides = pricingState.overrides[overrideKey] || {};

    const finalBasePrice = rowOverrides.wdBase !== undefined && rowOverrides.wdBase !== '' 
      ? Number(rowOverrides.wdBase) 
      : calculatedBasePrice;

    const finalRate = rowOverrides.wdRate !== undefined && rowOverrides.wdRate !== '' 
      ? Number(rowOverrides.wdRate) 
      : calculatedAdjustedRate;

    const totalPrice = finalBasePrice + (finalRate * kmValue);
    const diffFromOg = totalPrice - closestSlab.ogWd;
    const costPerKm = kmValue > 0 ? totalPrice / kmValue : 0;

    return {
      id: pkg.id,
      km: pkg.km,
      baseOverride: rowOverrides.wdBase !== undefined ? rowOverrides.wdBase : '',
      rateOverride: rowOverrides.wdRate !== undefined ? rowOverrides.wdRate : '',
      results: {
        closestSlab,
        difference,
        diffPercentage,
        calculatedAdjustedRate,
        calculatedBasePrice,
        finalBasePrice,
        finalRate,
        totalPrice,
        diffFromOg,
        costPerKm,
        hasOverrides: (rowOverrides.wdBase !== undefined && rowOverrides.wdBase !== '') || (rowOverrides.wdRate !== undefined && rowOverrides.wdRate !== ''),
        ogPrice: closestSlab.ogWd
      }
    };
  };

  const tripsData = useMemo(() => {
    return pricingState.packages.slice(0, modelType).map(pkg => calculateTripDataGlobal(pkg, selectedCar));
  }, [pricingState.packages, selectedCar, modelType, pricingState.overrides, pricingState.globalModifier, pricingState.modifierSelection]);

  const formatINR = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };


  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
      
      {/* TOP NAVIGATION PLATFORM */}
      <nav className="bg-[#f04343] text-white px-6 py-4 flex items-center justify-between shadow-md z-10">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-lg text-white backdrop-blur-sm">
            <Calculator size={22} />
          </div>
          <span className="font-bold text-white tracking-wide text-lg">Pricing Platform Engine</span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm font-medium">
          <button
            onClick={() => pricingDispatch({ type: 'SET_ACTIVE_PAGE', value: 'calculator' })}
            className={`text-white border-b-2 pb-1 flex items-center gap-2 transition-all ${pricingState.activePage === 'calculator' ? 'border-white' : 'border-transparent hover:border-white/50'}`}
          >
            <LayoutDashboard size={16} /> Calculator
          </button>
          <button
            onClick={() => pricingDispatch({ type: 'SET_ACTIVE_PAGE', value: 'analyzer' })}
            className={`text-white border-b-2 pb-1 flex items-center gap-2 transition-all ${pricingState.activePage === 'analyzer' ? 'border-white' : 'border-transparent hover:border-white/50'}`}
          >
            <Settings2 size={16} /> Trip Package Analyzer
          </button>
          <button
            onClick={() => pricingDispatch({ type: 'SET_ACTIVE_PAGE', value: 'multivehicle' })}
            className={`text-white border-b-2 pb-1 flex items-center gap-2 transition-all ${pricingState.activePage === 'multivehicle' ? 'border-white' : 'border-transparent hover:border-white/50'}`}
          >
            <Car size={16} /> Multi-Vehicle Pricing
          </button>
          <button
            onClick={() => pricingDispatch({ type: 'SET_ACTIVE_PAGE', value: 'projection' })}
            className={`text-white border-b-2 pb-1 flex items-center gap-2 transition-all ${pricingState.activePage === 'projection' ? 'border-white' : 'border-transparent hover:border-white/50'}`}
          >
            <BarChart3 size={16} /> Revenue Dashboard
          </button>

          {exportCsvFn && (
            <button
              onClick={() => exportCsvFn()}
              className="ml-4 flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-[#f04343] shadow-sm transition-colors hover:bg-slate-100"
            >
              <Download size={16} /> Export CSV
            </button>
          )}
        </div>
        <div className="md:hidden">
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-white">
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
        </div>
      </nav>

      {isMobileMenuOpen && (
        <div className="md:hidden bg-white shadow-lg border-t border-slate-200">
          <div className="flex flex-col p-4 space-y-1">
          <button
            onClick={() => { pricingDispatch({ type: 'SET_ACTIVE_PAGE', value: 'calculator' }); setIsMobileMenuOpen(false); }}
            className={`text-slate-700 py-3 px-4 rounded-lg flex items-center gap-3 transition-all ${pricingState.activePage === 'calculator' ? 'bg-slate-100 font-bold' : ''}`}
          >
            <LayoutDashboard size={18} /> Calculator
          </button>
          <button
            onClick={() => { pricingDispatch({ type: 'SET_ACTIVE_PAGE', value: 'analyzer' }); setIsMobileMenuOpen(false); }}
            className={`text-slate-700 py-3 px-4 rounded-lg flex items-center gap-3 transition-all ${pricingState.activePage === 'analyzer' ? 'bg-slate-100 font-bold' : ''}`}
          >
            <Settings2 size={18} /> Trip Package Analyzer
          </button>
          <button
            onClick={() => { pricingDispatch({ type: 'SET_ACTIVE_PAGE', value: 'multivehicle' }); setIsMobileMenuOpen(false); }}
            className={`text-slate-700 py-3 px-4 rounded-lg flex items-center gap-3 transition-all ${pricingState.activePage === 'multivehicle' ? 'bg-slate-100 font-bold' : ''}`}
          >
            <Car size={18} /> Multi-Vehicle Pricing
          </button>
          <button
            onClick={() => { pricingDispatch({ type: 'SET_ACTIVE_PAGE', value: 'projection' }); setIsMobileMenuOpen(false); }}
            className={`text-slate-700 py-3 px-4 rounded-lg flex items-center gap-3 transition-all ${pricingState.activePage === 'projection' ? 'bg-slate-100 font-bold' : ''}`}
          >
            <BarChart3 size={18} /> Revenue Dashboard
          </button>
            {exportCsvFn && (
              <button
                onClick={() => { exportCsvFn(); setIsMobileMenuOpen(false); }}
                className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-[#f04343] px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-red-600"
              >
                <Download size={16} /> Export CSV
              </button>
            )}
          </div>
        </div>
      )}

      {/* MAIN CONTENT APP */}
      {pricingState.activePage === 'calculator' ? (
        <div className="flex-1 p-4 md:p-8 max-w-screen-2xl mx-auto w-full grid grid-cols-1 xl:grid-cols-4 gap-8">
          
          {/* SIDEBAR: CAR SELECTOR & SLAB INFO */}
          <div className="xl:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              
              {/* Car Selector */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                  <Car size={16} className="text-[#f04343]"/> Selected Vehicle
                </label>
                <select
                  value={selectedCarId}
                  onChange={(e) => pricingDispatch({ type: 'SET_SELECTED_CAR', value: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#f04343] focus:border-transparent transition-all"
                >
                  {pricingState.vehicles.map((car) => (
                    <option key={car.id} value={car.id}>
                      {car.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 mb-4 text-slate-700 font-semibold border-t border-slate-100 pt-6">
                <Settings2 size={20} className="text-[#f04343]"/>
                <h2>Reference Slabs for {selectedCar.name.split(' ')[0]}</h2>
              </div>
              
              <div className="space-y-4">
                {selectedCar.slabs.map((slab, index) => (
                  <div key={index} className="rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:border-[#f04343]/30 transition-colors">
                    <div className="flex justify-between items-center p-3 bg-white">
                      <div>
                        <span className="block font-bold text-slate-800">{slab.km} km</span>
                        <span className="text-xs text-slate-500 font-medium">Slab {index + 1}</span>
                      </div>
                      <div className="text-right">
                        <span className="block font-semibold text-slate-700">{formatINR(slab.basePrice)}</span>
                        <span className="text-[11px] text-[#f04343] font-bold">₹{slab.rate.toFixed(4)}/km</span>
                      </div>
                    </div>
                    <div className="bg-slate-50 px-3 py-2 text-[11px] text-slate-600 border-t border-slate-100 flex justify-between items-center">
                      <span className="font-medium text-slate-500">Original Fixed Price:</span>
                      <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {formatINR(slab.ogWd)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 p-4 bg-[#f04343]/5 rounded-xl flex gap-3 text-xs text-slate-700 border border-[#f04343]/20">
                <Info className="shrink-0 mt-0.5 text-[#f04343]" size={16} />
                <p>
                  Dynamic rates scale from mathematical base. The original fixed price is shown for context and comparison against the old pricing model.
                </p>
              </div>
            </div>
          </div>

          {/* MAIN CALCULATOR CARDS & SUMMARY */}
          <div className="xl:col-span-3 flex flex-col gap-6">
            
{/* Top Control Bar for Toggling Trip Models */}
          <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 ml-2">Trip Price Estimations</h2>
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-lg">
              <button 
                onClick={() => pricingDispatch({ type: 'SET_MODEL_TYPE', value: 3 })}
                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${modelType === 3 ? 'bg-white text-[#f04343] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                3 Trip Model
              </button>
              <button 
                onClick={() => pricingDispatch({ type: 'SET_MODEL_TYPE', value: 4 })}
                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${modelType === 4 ? 'bg-white text-[#f04343] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                4 Trip Model
              </button>
            </div>
          </div>

          {/* Dynamic Grid Layout for Cards based on modelType */}
          <div className={`grid grid-cols-1 gap-6 ${modelType === 4 ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
              {tripsData.map((tripData, index) => (
                <PricingCard 
                  key={tripData.id} 
                  data={tripData} 
                  index={index} 
                  car={selectedCar}
                  onChange={handleInputChange}
                  onReset={resetOverrides}
                  formatINR={formatINR}
                />
              ))}
            </div>

            {/* Simple Trip Summary Panel */}
            <TripSummary trips={tripsData} car={selectedCar} formatINR={formatINR} />

          </div>
        </div>
      ) : pricingState.activePage === 'analyzer' ? (
        <TripPackageAnalyzer setExportHandler={setExportCsvFn} />
      ) : pricingState.activePage === 'multivehicle' ? (
        <MultiVehicleDashboard setExportHandler={setExportCsvFn} />
      ) : pricingState.activePage === 'projection' ? (
        <RevenueDashboard />
      ) : (
        <FinancialStrategySimulator />
      )}
    </div>
  );
}

export default function App() {
  return (
    <GlobalPricingProvider>
      <AppInner />
    </GlobalPricingProvider>
  );
}

// --- PRICING CARD COMPONENT ---
function PricingCard({ data, index, car, onChange, onReset, formatINR }) {
  const { results, error } = data;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col relative transition-all hover:shadow-md">
      {/* Card Header */}
      <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
        <div>
          <h3 className="font-semibold flex items-center gap-2 text-sm">
            <Car size={16} className="text-[#f04343]" />
            Trip Option {index + 1}
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[150px]">{car.name}</p>
        </div>
        {results?.hasOverrides && (
          <button 
            onClick={() => onReset(data.id)}
            className="flex items-center gap-1 text-[11px] font-medium bg-slate-700 hover:bg-slate-600 px-2 py-1.5 rounded-md transition-colors border border-slate-600"
            title="Reset manual overrides"
          >
            <RotateCcw size={12} /> Reset Edits
          </button>
        )}
      </div>

      <div className="p-5 flex-1 flex flex-col gap-5">
        
        {/* Input Section */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Trip Distance (km)
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              max={MAX_KM}
              value={data.km}
              onChange={(e) => onChange(data.id, 'km', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#f04343] focus:border-transparent transition-all"
              placeholder="e.g. 240"
            />
            <span className="absolute right-4 top-3.5 text-slate-400 font-medium text-sm">km</span>
          </div>
          {error && (
            <div className="flex items-center gap-1 mt-2 text-[#f04343] text-xs font-medium">
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </div>

        {results && !error && (
          <>
            {/* Logic Breakdown */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Target Reference Slab</span>
                <span className="font-bold text-slate-700 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">
                  {results.closestSlab.km} km
                </span>
              </div>
              
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Base Slab Rate</span>
                <span className="font-semibold text-slate-600">₹{results.closestSlab.rate.toFixed(4)}/km</span>
              </div>

              <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between items-center text-xs">
                <span className="text-slate-500">Scaling Diff.</span>
                <span className={`font-bold flex items-center gap-1 ${results.diffPercentage > 0 ? 'text-orange-500' : results.diffPercentage < 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                  {results.diffPercentage > 0 ? <TrendingUp size={14} /> : results.diffPercentage < 0 ? <TrendingDown size={14} /> : null}
                  {results.diffPercentage > 0 ? '+' : ''}{(results.diffPercentage * 100).toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Editable Fields */}
            <div className="space-y-3 mt-1">
              <div>
                <label className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                  <span>Regression Base Price</span>
                  {data.baseOverride !== '' && <span className="text-[#f04343] font-medium">Overridden</span>}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 text-sm">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    value={data.baseOverride !== '' ? data.baseOverride : results.calculatedBasePrice.toFixed(2)}
                    onChange={(e) => onChange(data.id, 'baseOverride', e.target.value)}
                    className={`w-full bg-white border ${data.baseOverride !== '' ? 'border-[#f04343] ring-2 ring-[#f04343]/20' : 'border-slate-200'} rounded-lg pl-8 pr-3 py-2 text-sm font-semibold ${results.calculatedBasePrice < 0 && data.baseOverride === '' ? 'text-red-500' : 'text-slate-800'} focus:outline-none focus:border-[#f04343] transition-all`}
                  />
                </div>
              </div>

              <div>
                <label className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                  <span>Adj. Per-KM Rate</span>
                  {data.rateOverride !== '' && <span className="text-[#f04343] font-medium">Overridden</span>}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 text-sm">₹</span>
                  <input
                    type="number"
                    step="0.0001"
                    value={data.rateOverride !== '' ? data.rateOverride : results.calculatedAdjustedRate.toFixed(4)}
                    onChange={(e) => onChange(data.id, 'rateOverride', e.target.value)}
                    className={`w-full bg-white border ${data.rateOverride !== '' ? 'border-[#f04343] ring-2 ring-[#f04343]/20' : 'border-slate-200'} rounded-lg pl-8 pr-8 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#f04343] transition-all`}
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 text-xs mt-0.5">/km</span>
                </div>
              </div>
            </div>

            {/* Total Price & Comparison Box */}
            <div className="mt-auto pt-2">
              <div className="rounded-xl overflow-hidden shadow-lg border border-[#f04343]/20">
                
                {/* Main Dynamic Price */}
                <div className="bg-gradient-to-br from-[#f04343] to-[#d63b3b] p-5 text-white flex flex-col items-center justify-center text-center relative">
                  <div className="absolute -right-4 -top-4 opacity-10">
                    <Calculator size={80} />
                  </div>
                  <span className="text-white/80 text-xs font-semibold tracking-wider uppercase mb-1">Dynamic Estimate</span>
                  <span className="text-3xl font-extrabold tracking-tight">
                    {formatINR(results.totalPrice)}
                  </span>
                </div>

                {/* Original Comparison Banner */}
                <div className="bg-[#f04343]/5 p-3 flex justify-between items-center border-t border-[#f04343]/20">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                      <Scale size={10} /> vs Old {results.closestSlab.km}km Slab
                    </span>
                    <span className="text-sm font-bold text-slate-700 mt-0.5">
                      {formatINR(results.ogPrice)}
                    </span>
                  </div>
                  
                  <div className="text-right flex flex-col items-end">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      Difference
                    </span>
                    <span className={`text-sm font-bold flex items-center gap-1 mt-0.5 ${results.diffFromOg > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                      {results.diffFromOg > 0 ? '+' : ''}{formatINR(results.diffFromOg)}
                    </span>
                  </div>
                </div>

              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- SUMMARY COMPONENT ---
function TripSummary({ trips, car, formatINR }) {
  const validTrips = trips.filter(t => !t.error && t.results);
  
  if (validTrips.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-4">
      <div className="bg-slate-900 p-5 flex items-center gap-3">
        <div className="p-2 bg-[#f04343]/20 text-[#f04343] rounded-lg">
          <Calculator size={24} />
        </div>
        <div>
          <h2 className="text-white font-bold text-lg">Trip Summary</h2>
          <p className="text-slate-400 text-sm">Comparison for {car.name}</p>
        </div>
      </div>

      <div className="p-6 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-100">
              <th className="pb-3 pt-2 px-2 font-semibold text-slate-500 text-sm">Trip Option</th>
              <th className="pb-3 pt-2 px-2 font-semibold text-slate-500 text-sm">Distance</th>
              <th className="pb-3 pt-2 px-2 font-semibold text-slate-500 text-sm">Estimated Price</th>
              <th className="pb-3 pt-2 px-2 font-semibold text-slate-500 text-sm">Cost per km</th>
              <th className="pb-3 pt-2 px-2 font-semibold text-slate-500 text-sm">Vs Old Pricing</th>
            </tr>
          </thead>
          <tbody>
            {validTrips.map((trip, idx) => (
              <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="py-3 px-2">
                  <span className="font-medium text-slate-800">Option {trips.findIndex(t => t.id === trip.id) + 1}</span>
                </td>
                <td className="py-3 px-2 font-semibold text-slate-700">{trip.km} km</td>
                <td className="py-3 px-2 font-bold text-slate-900">{formatINR(trip.results.totalPrice)}</td>
                <td className="py-3 px-2 text-slate-600 text-sm">₹{trip.results.costPerKm.toFixed(2)}</td>
                <td className="py-3 px-2">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${trip.results.diffFromOg > 0 ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {trip.results.diffFromOg > 0 ? '+' : ''}{formatINR(trip.results.diffFromOg)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import React, { useState, useMemo, useEffect } from 'react';
import {
  MapPin,
  Settings,
  TrendingDown,
  TrendingUp,
  Briefcase,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  LayoutDashboard,
  Calculator,
  ArrowRightLeft
} from 'lucide-react';
import { usePricingStore } from './GlobalPricingStore.jsx';

// --- DATA INITIALIZATION ---
const INITIAL_LOCATIONS = [
  { id: 1, name: 'Nandi Hills', distance: 65, days: 1, manualPackageId: null },
  { id: 2, name: 'Kolar', distance: 70, days: 1, manualPackageId: null },
  { id: 3, name: 'Sravanabelagola', distance: 81, days: 1, manualPackageId: null },
  { id: 4, name: 'Lepakshi', distance: 125, days: 1, manualPackageId: null },
  { id: 5, name: 'Shivanasamudra', distance: 130, days: 1, manualPackageId: null },
  { id: 6, name: 'BR Hills', distance: 195, days: 2, manualPackageId: null },
  { id: 7, name: 'Gopalaswamy', distance: 195, days: 2, manualPackageId: null },
  { id: 8, name: 'Hassan', distance: 200, days: 2, manualPackageId: null },
  { id: 9, name: 'Belur', distance: 200, days: 2, manualPackageId: null },
  { id: 10, name: 'Halebidu', distance: 200, days: 2, manualPackageId: null },
  { id: 11, name: 'Kabini', distance: 210, days: 2, manualPackageId: null },
  { id: 12, name: 'Bandipur', distance: 210, days: 2, manualPackageId: null },
  { id: 13, name: 'Chikmagalur', distance: 245, days: 3, manualPackageId: null },
  { id: 14, name: 'Coorg (Madikeri)', distance: 250, days: 3, manualPackageId: null },
  { id: 15, name: 'Wayanad', distance: 270, days: 3, manualPackageId: null },
  { id: 16, name: 'Gandikota', distance: 290, days: 2, manualPackageId: null },
  { id: 17, name: 'Belum Caves', distance: 290, days: 2, manualPackageId: null },
  { id: 18, name: 'Sringeri', distance: 335, days: 3, manualPackageId: null },
  { id: 19, name: 'Kudremukh', distance: 335, days: 3, manualPackageId: null },
  { id: 20, name: 'Hampi', distance: 395, days: 3, manualPackageId: null },
  { id: 21, name: 'Badami', distance: 395, days: 3, manualPackageId: null },
  { id: 22, name: 'Udupi', distance: 400, days: 3, manualPackageId: null },
  { id: 23, name: 'Manipal', distance: 400, days: 4, manualPackageId: null },
  { id: 24, name: 'Jog Falls', distance: 414, days: 4, manualPackageId: null },
  { id: 25, name: 'Gokarna', distance: 490, days: 4, manualPackageId: null },
  { id: 26, name: 'Murudeshwar', distance: 490, days: 4, manualPackageId: null },
  { id: 27, name: 'Munnar', distance: 535, days: 5, manualPackageId: null },
  { id: 28, name: 'Alleppey', distance: 535, days: 5, manualPackageId: null },
  { id: 29, name: 'Goa', distance: 575, days: 5, manualPackageId: null },
  { id: 30, name: 'Kanyakumari', distance: 660, days: 5, manualPackageId: null },
];

export default function TripPackageAnalyzer() {
  // --- STATE ---
  const { state: pricingState, dispatch: pricingDispatch, immediateDispatch } = usePricingStore();
  const { modelType, packages } = pricingState;

  const [locations, setLocations] = useState(() => {
    const stored = localStorage.getItem('analyzer_locations');
    if (stored) try { return JSON.parse(stored); } catch {}
    return INITIAL_LOCATIONS;
  });
  // --- HANDLERS ---
  const handlePackageKmChange = (id, newKm) => {
    pricingDispatch({ type: 'UPDATE_PACKAGE_KM', id, value: newKm === '' ? '' : Number(newKm) });
  };

  const handleLocationChange = (id, field, value) => {
    setLocations(prev => prev.map(loc => {
      if (loc.id === id) {
        return { ...loc, [field]: value };
      }
      return loc;
    }));
  };

  const resetLocationOverrides = () => {
    setLocations(prev => prev.map(loc => ({ ...loc, manualPackageId: null })));
  };

  // Persist location state to localStorage
  useEffect(() => {
    localStorage.setItem('analyzer_locations', JSON.stringify(locations));
  }, [locations]);

  // --- LOGIC ENGINE ---
  // Sort active packages
  const activePackages = useMemo(() => {
    return packages.slice(0, modelType).sort((a, b) => (Number(a.km) || 0) - (Number(b.km) || 0));
  }, [packages, modelType]);

  // Process data for the table
  const processedLocations = useMemo(() => {
    if (activePackages.length === 0) return [];
    return locations.map(loc => {
      const distance = Number(loc.distance) || 0;
      const days = Number(loc.days) || 0;
      const roundTrip = distance * 2;

      // Auto-assign package: Find the smallest package that fits the ONE-WAY distance.
      let assignedPackage = activePackages[activePackages.length - 1];
      for (const pkg of activePackages) {
        if ((Number(pkg.km) || 0) >= distance) {
          assignedPackage = pkg;
          break;
        }
      }

      // Override if user manually selected a package
      if (loc.manualPackageId) {
        const manualPkg = activePackages.find(p => p.id === loc.manualPackageId);
        if (manualPkg) assignedPackage = manualPkg;
      }
      
      if (!assignedPackage) assignedPackage = { id: 'none', km: 0 };

      const allowedKm = (Number(assignedPackage.km) || 0) * days;
      const difference = allowedKm - roundTrip;

      // Status Evaluation
      let status = 'neutral';
      let statusText = 'Perfect Match';
      if (difference > 0) {
        status = 'customer_benefit';
        statusText = `Customer saves ${difference} km`;
      } else if (difference < 0) {
        status = 'company_benefit';
        statusText = `Charge extra for ${Math.abs(difference)} km`;
      }

      return {
        ...loc,
        roundTrip,
        assignedPackage,
        allowedKm,
        difference,
        status,
        statusText
      };
    });
  }, [locations, activePackages]);

  // Summary metrics
  const totalCompanyBenefit = processedLocations.filter(l => l.status === 'company_benefit').length;
  const totalCustomerBenefit = processedLocations.filter(l => l.status === 'customer_benefit').length;

  return (
    <div className="flex-1 p-4 md:p-8 max-w-screen-2xl mx-auto w-full flex flex-col gap-6">

      {/* TOP CONFIGURATION PANEL */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Settings className="text-[#f04343]" size={24} />
              Package Configuration
            </h2>
            <p className="text-sm text-slate-500 mt-1">Define your standard km/day models to analyze profitability.</p>
          </div>

          <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-lg">
            <button
              onClick={() => immediateDispatch({ type: 'SET_MODEL_TYPE', value: 3 })}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${modelType === 3 ? 'bg-white text-[#f04343] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              3 Range Model
            </button>
            <button
              onClick={() => immediateDispatch({ type: 'SET_MODEL_TYPE', value: 4 })}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${modelType === 4 ? 'bg-white text-[#f04343] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              4 Range Model
            </button>
             <button
              onClick={() => immediateDispatch({ type: 'SET_MODEL_TYPE', value: 5 })}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${modelType === 5 ? 'bg-white text-[#f04343] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              5 Range Model
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {packages.slice(0, modelType).map((pkg, index) => (
            <div key={pkg.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                Package {index + 1} Limit
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={pkg.km}
                  onChange={(e) => handlePackageKmChange(pkg.id, e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#f04343]/50 focus:border-[#f04343] transition-all"
                />
                <span className="absolute right-3 top-2.5 text-slate-400 font-medium text-sm">km/day</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex items-center gap-4">
           <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
             <MapPin size={24} />
           </div>
           <div>
             <p className="text-sm text-slate-500 font-medium">Total Locations</p>
             <h3 className="text-2xl font-bold text-slate-800">{locations.length} Routes</h3>
           </div>
         </div>
         <div className="bg-white rounded-2xl p-5 shadow-sm border border-emerald-200 flex items-center gap-4">
           <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
             <TrendingUp size={24} />
           </div>
           <div>
             <p className="text-sm text-emerald-600/80 font-medium">Company Advantage</p>
             <h3 className="text-2xl font-bold text-emerald-700">{totalCompanyBenefit} Locations</h3>
             <p className="text-xs text-emerald-600 mt-0.5">Extra charges applicable</p>
           </div>
         </div>
         <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#f04343]/30 flex items-center gap-4">
           <div className="p-3 bg-[#f04343]/10 text-[#f04343] rounded-xl">
             <TrendingDown size={24} />
           </div>
           <div>
             <p className="text-sm text-[#f04343]/80 font-medium">Customer Advantage</p>
             <h3 className="text-2xl font-bold text-[#f04343]">{totalCustomerBenefit} Locations</h3>
             <p className="text-xs text-[#f04343]/80 mt-0.5">Unused km allowance</p>
           </div>
         </div>
      </div>

      {/* DATA TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1">
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Calculator className="text-slate-500" size={20} />
            Distance & Profitability Analysis
          </h2>
          <button
            onClick={resetLocationOverrides}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-white border border-slate-300 px-3 py-1.5 rounded-lg transition-all shadow-sm"
          >
            <RotateCcw size={14} /> Reset Auto-Assignments
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider">
                <th className="p-4 font-bold rounded-tl-lg">Location Name</th>
                <th className="p-4 font-bold">One-way (km)</th>
                <th className="p-4 font-bold text-indigo-700 bg-indigo-50/50"><ArrowRightLeft size={14} className="inline mr-1"/>Round Trip</th>
                <th className="p-4 font-bold">Base Days</th>
                <th className="p-4 font-bold border-l border-slate-200">Assigned Package</th>
                <th className="p-4 font-bold">Allowed KM</th>
                <th className="p-4 font-bold text-center">Diff. (KM)</th>
                <th className="p-4 font-bold rounded-tr-lg">Result Indicator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {processedLocations.map((loc) => (
                <tr key={loc.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="p-4 font-bold text-slate-800">{loc.name}</td>

                  {/* Editable Distance */}
                  <td className="p-3">
                    <div className="relative w-24">
                      <input
                        type="number"
                        value={loc.distance}
                        onChange={(e) => handleLocationChange(loc.id, 'distance', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 font-semibold focus:border-[#f04343] focus:ring-1 focus:ring-[#f04343] outline-none"
                      />
                    </div>
                  </td>

                  <td className="p-4 font-bold text-indigo-700 bg-indigo-50/30">
                    {loc.roundTrip} km
                  </td>

                  {/* Editable Days */}
                  <td className="p-3">
                    <input
                      type="number"
                      min="1"
                      value={loc.days}
                      onChange={(e) => handleLocationChange(loc.id, 'days', e.target.value)}
                      className="w-16 bg-white border border-slate-200 rounded px-2 py-1.5 font-semibold focus:border-[#f04343] focus:ring-1 focus:ring-[#f04343] outline-none"
                    />
                  </td>

                  {/* Editable Package Assignment */}
                  <td className="p-3 border-l border-slate-100">
                    <select
                      value={loc.assignedPackage.id}
                      onChange={(e) => handleLocationChange(loc.id, 'manualPackageId', e.target.value)}
                      className={`w-full bg-white border ${loc.manualPackageId ? 'border-amber-400 bg-amber-50' : 'border-slate-200'} rounded px-2 py-1.5 font-semibold focus:border-[#f04343] outline-none cursor-pointer`}
                    >
                       {activePackages.length > 0 ? activePackages.map(pkg => (
                        <option key={pkg.id} value={pkg.id}>{pkg.km !== '' ? pkg.km : 0} km/day</option>
                      )) : (
                        <option value="none">N/A</option>
                      )}
                    </select>
                    {loc.manualPackageId && (
                      <p className="text-[9px] text-amber-600 mt-1 font-semibold uppercase tracking-wider">Manual Override</p>
                    )}
                  </td>

                  <td className="p-4 font-bold text-slate-700">
                    {loc.allowedKm} km
                  </td>

                  <td className="p-4 font-extrabold text-center">
                    <span className={`
                      ${loc.difference > 0 ? 'text-[#f04343]' : ''}
                      ${loc.difference < 0 ? 'text-emerald-600' : ''}
                      ${loc.difference === 0 ? 'text-slate-400' : ''}
                    `}>
                      {loc.difference > 0 ? '+' : ''}{loc.difference}
                    </span>
                  </td>

                  <td className="p-4">
                    {loc.status === 'company_benefit' && (
                      <div className="flex flex-col">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 text-xs font-bold w-max">
                          <CheckCircle2 size={14} /> Company Advantage
                        </span>
                        <span className="text-[11px] text-emerald-600 font-semibold mt-1">{loc.statusText}</span>
                      </div>
                    )}

                    {loc.status === 'customer_benefit' && (
                      <div className="flex flex-col">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#f04343]/10 text-[#f04343] text-xs font-bold w-max">
                          <AlertTriangle size={14} /> Customer Advantage
                        </span>
                        <span className="text-[11px] text-[#f04343]/80 font-semibold mt-1">{loc.statusText}</span>
                        </div>
                      )}

                    {loc.status === 'neutral' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-bold w-max">
                        Perfect Match
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

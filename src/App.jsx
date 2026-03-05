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
  Scale
} from 'lucide-react';

// --- DATA PROCESSING ---
const RAW_REGRESSION_DATA = [
  ["Alto 800 VXI", 0.7813, 827.573, 0.8973, 790.453, 1.55, 464.12],
  ["S-Presso VXI", 0.8680, 919.600, 0.9973, 878.213, 1.72, 515.88],
  ["Wagon R VXI", 1.1093, 1176.693, 1.2760, 1123.360, 2.20, 660.36],
  ["Swift VXI", 1.3880, 1470.560, 1.5947, 1404.427, 2.75, 824.76],
  ["Glanza E", 1.4427, 1527.947, 1.6573, 1459.253, 2.86, 857.92],
  ["Glanza S", 1.4413, 1528.133, 1.6587, 1458.587, 2.86, 858.92],
  ["Tata Altroz", 1.4493, 1536.853, 1.6667, 1467.307, 2.88, 862.64],
  ["Nexon XM", 1.4587, 1546.347, 1.6773, 1476.373, 2.89, 868.04],
  ["Swift VXI", 1.4613, 1550.533, 1.6827, 1479.707, 2.90, 871.04],
  ["Exter S", 1.6827, 1784.267, 1.9360, 1703.200, 3.34, 1001.20],
  ["Fronx Sigma", 1.6827, 1784.267, 1.9360, 1703.200, 3.34, 1001.20],
  ["Swift VXI 2025", 1.6973, 1797.093, 1.9493, 1716.453, 3.36, 1009.12],
  ["Glanza S", 1.7120, 1813.520, 1.9680, 1731.600, 3.39, 1018.60],
  ["Brezza VXI", 1.7413, 1847.333, 2.0040, 1763.280, 3.46, 1036.28],
  ["Exter S", 1.7427, 1847.147, 2.0040, 1763.520, 3.46, 1037.52],
  ["Taisor E", 1.7587, 1864.587, 2.0227, 1780.107, 3.49, 1046.44],
  ["Taisor S", 1.7920, 1899.040, 2.0600, 1813.280, 3.56, 1065.28],
  ["Venue CRDI", 1.8867, 2000.507, 2.1707, 1909.627, 3.74, 1123.96],
  ["Marazzo M2", 3.6053, 1814.133, 10.4320, -370.400, 12.99, -1648.40],
  ["2026 Venue HX5 1.2", 2.0747, 2200.747, 2.3880, 2100.480, 4.12, 1236.48],
  ["Creta CRDI E", 2.0813, 2206.053, 2.3933, 2106.213, 4.13, 1238.88],
  ["Mahindra XUV 300", 2.2667, 2402.587, 2.6067, 2293.787, 4.50, 1348.12],
  ["Ertiga VXI", 2.6400, 2798.640, 3.0360, 2671.920, 5.24, 1570.92],
  ["Safari XZ+", 3.2093, 3402.453, 3.6920, 3248.000, 6.37, 1910.00],
  ["Safari XZA+", 3.3787, 3580.587, 3.8853, 3418.453, 6.70, 2011.12],
  ["Jeep Meridian", 4.4067, 4670.747, 5.0667, 4459.547, 8.74, 2621.88],
  ["Alto K10 VXI", 1.0000, 1012.000, 1.1507, 963.787, 1.98, 548.12],
  ["i10", 2.3347, 921.627, 2.4813, 874.693, 4.40, -84.64],
  ["Ignis Sigma", 1.0587, 1120.907, 1.2160, 1070.560, 2.10, 629.56],
  ["Freestyle Trend", 1.0587, 1120.907, 1.2160, 1070.560, 2.10, 629.56],
  ["i10 Nios", 0.7627, 1266.507, 0.8400, 1241.760, 5.27, -971.24],
  ["Baleno Sigma", 1.2440, 1318.640, 1.4307, 1258.907, 2.47, 740.24],
  ["Verna EX", 1.3573, 1440.053, 1.5627, 1374.347, 2.69, 808.68],
  ["Brezza LDI", 1.5133, 1604.693, 1.7413, 1531.733, 3.00, 900.40],
  ["Punch IRA", 1.6133, 1709.013, 1.8533, 1632.213, 3.20, 957.88],
  ["i20 Sportz", 2.2453, 1735.013, 3.2973, 1398.373, 1.39, 2352.04],
  ["Baleno Delta", 1.7120, 1813.520, 1.9680, 1731.600, 3.39, 1018.60],
  ["Taisor S", 1.7920, 1899.040, 2.0600, 1813.280, 3.56, 1065.28],
  ["Punch IRA", 1.7920, 1900.480, 2.0627, 1813.867, 3.56, 1067.20],
  ["Venue Kappa", 1.8613, 1971.893, 2.1387, 1883.147, 3.69, 1106.48],
  ["Vitara Brezza LXI", 1.9040, 2018.480, 2.1893, 1927.173, 3.78, 1132.84],
  ["2026 Exter Smart Sunroof", 1.9173, 2031.733, 2.2027, 1940.427, 3.80, 1139.76],
  ["Vitara Brezza Hybrid VXI", 2.0000, 2119.280, 2.2987, 2023.707, 3.97, 1190.04],
  ["Nexon XZ+", 2.1507, 2278.907, 2.4720, 2176.080, 4.26, 1280.08],
  ["Tata Nexon XZ+ D", 2.2160, 2349.920, 2.5493, 2243.253, 4.40, 1318.92],
  ["Ertiga VXI", 2.5307, 2682.427, 2.9093, 2561.253, 5.02, 1505.92],
  ["Innova Crysta GX", 3.5000, 3710.000, 4.0253, 3541.893, 6.94, 2083.56]
];

const RAW_OG_PRICES = [
  [936.96, 1077.60, 1239.12, 1425.12],
  [1041.12, 1197.36, 1376.88, 1583.52],
  [1332.00, 1531.68, 1761.36, 2025.60],
  [1664.88, 1914.72, 2201.76, 2532.24],
  [1729.92, 1989.60, 2287.92, 2631.12],
  [1729.92, 1989.36, 2287.92, 2630.88],
  [1739.76, 2000.64, 2300.64, 2645.76],
  [1750.56, 2013.12, 2315.04, 2662.32],
  [1755.12, 2018.16, 2321.04, 2669.04],
  [2019.84, 2322.72, 2671.20, 3072.00],
  [2019.84, 2322.72, 2671.20, 3072.00],
  [2034.72, 2340.24, 2691.12, 3094.80],
  [2053.20, 2361.36, 2715.60, 3122.88],
  [2091.12, 2404.56, 2765.28, 3180.24],
  [2091.12, 2404.80, 2765.52, 3180.24],
  [2110.80, 2427.36, 2791.44, 3210.24],
  [2149.92, 2472.48, 2843.28, 3270.00],
  [2264.64, 2604.24, 2994.96, 3444.00],
  [2318.88, 2967.84, 4845.60, 6404.16],
  [2491.20, 2864.64, 3294.48, 3788.40],
  [2497.44, 2872.08, 3302.88, 3798.24],
  [2719.92, 3127.92, 3597.12, 4136.88],
  [3168.24, 3643.44, 4189.92, 4818.48],
  [3851.76, 4429.44, 5094.00, 5858.16],
  [4053.60, 4661.76, 5361.12, 6165.12],
  [5287.68, 6080.88, 6992.88, 8041.92],
  [1152.00, 1332.00, 1539.12, 1776.96],
  [1248.48, 1668.72, 2115.36, 2643.36],
  [1269.12, 1459.68, 1678.56, 1930.32],
  [1269.12, 1459.68, 1678.56, 1930.32],
  [1373.28, 1510.56, 1661.76, 2293.68],
  [1492.80, 1716.72, 1974.24, 2270.40],
  [1630.08, 1874.40, 2155.68, 2478.96],
  [1816.56, 2088.96, 2402.40, 2762.88],
  [1934.88, 2225.28, 2558.88, 2943.12],
  [2049.36, 2453.52, 3047.04, 3213.84],
  [2053.20, 2361.36, 2715.60, 3122.88],
  [2149.92, 2472.48, 2843.28, 3270.00],
  [2151.36, 2473.92, 2845.20, 3271.92],
  [2232.48, 2567.52, 2952.48, 3395.52],
  [2285.04, 2627.76, 3021.84, 3475.20],
  [2300.16, 2645.28, 3041.76, 3498.24],
  [2399.28, 2759.28, 3173.04, 3648.96],
  [2580.00, 2967.12, 3412.08, 3923.76],
  [2660.16, 3059.04, 3517.92, 4045.68],
  [3036.72, 3492.24, 4015.92, 4618.32],
  [4200.00, 4830.00, 5554.56, 6387.60]
];

const CARS_DB = RAW_REGRESSION_DATA.map((row, index) => {
  const baseName = row[0];
  const previousOccurrences = RAW_REGRESSION_DATA.slice(0, index).filter(r => r[0] === baseName).length;
  const displayName = previousOccurrences > 0 ? `${baseName} (Var ${previousOccurrences + 1})` : baseName;
  const ogPrices = RAW_OG_PRICES[index];

  return {
    id: index,
    name: displayName,
    slabs: [
      { km: 140, rate: row[1], basePrice: row[2], ogPrice: ogPrices[0] },
      { km: 320, rate: row[1], basePrice: row[2], ogPrice: ogPrices[1] },
      { km: 500, rate: row[3], basePrice: row[4], ogPrice: ogPrices[2] },
      { km: 620, rate: row[5], basePrice: row[6], ogPrice: ogPrices[3] },
    ]
  };
});

const MIN_KM = 1;
const MAX_KM = 3000;

// --- CALCULATION LOGIC ---
function calculateTripData(data, car) {
  const kmValue = parseFloat(data.km);
  
  if (isNaN(kmValue) || kmValue < 0) {
    return { ...data, error: 'Please enter a valid kilometer value.' };
  }
  if (kmValue > MAX_KM) {
    return { ...data, error: `Value exceeds maximum limit (${MAX_KM} km).` };
  }

  const slabs = car.slabs;
  let closestSlab = slabs[0];
  let minDiff = Math.abs(kmValue - slabs[0].km);

  for (let i = 1; i < slabs.length; i++) {
    const diff = Math.abs(kmValue - slabs[i].km);
    if (diff < minDiff) {
      minDiff = diff;
      closestSlab = slabs[i];
    }
  }

  const difference = kmValue - closestSlab.km;
  const diffPercentage = difference / closestSlab.km;
  
  const calculatedAdjustedRate = closestSlab.rate * (1 + diffPercentage);
  const calculatedBasePrice = closestSlab.basePrice;

  const finalBasePrice = data.baseOverride !== '' && !isNaN(parseFloat(data.baseOverride)) 
    ? parseFloat(data.baseOverride) 
    : calculatedBasePrice;

  const finalRate = data.rateOverride !== '' && !isNaN(parseFloat(data.rateOverride)) 
    ? parseFloat(data.rateOverride) 
    : calculatedAdjustedRate;

  const totalPrice = finalBasePrice + (finalRate * kmValue);
  const diffFromOg = totalPrice - closestSlab.ogPrice;
  const costPerKm = totalPrice / kmValue;

  return {
    ...data,
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
      hasOverrides: data.baseOverride !== '' || data.rateOverride !== ''
    }
  };
}

export default function App() {
  const [selectedCarId, setSelectedCarId] = useState(0);
  const selectedCar = CARS_DB[selectedCarId];

  const [inputs, setInputs] = useState([
    { id: 'trip-1', km: 160, baseOverride: '', rateOverride: '' },
    { id: 'trip-2', km: 350, baseOverride: '', rateOverride: '' },
    { id: 'trip-3', km: 700, baseOverride: '', rateOverride: '' },
  ]);

  const tripsData = useMemo(() => {
    return inputs.map(input => calculateTripData(input, selectedCar));
  }, [inputs, selectedCar]);

  const handleInputChange = (id, field, value) => {
    setInputs(prev => 
      prev.map(item => {
        if (item.id === id) {
          if (field === 'km') {
            return { ...item, [field]: value, baseOverride: '', rateOverride: '' };
          }
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };

  const resetOverrides = (id) => {
    setInputs(prev => 
      prev.map(item => item.id === id ? { ...item, baseOverride: '', rateOverride: '' } : item)
    );
  };

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
        <div className="hidden md:flex gap-6 text-sm font-medium">
          <button className="text-white border-b-2 border-white pb-1 flex items-center gap-2 transition-all">
            <LayoutDashboard size={16} /> Calculator
          </button>
        </div>
      </nav>

      {/* MAIN CONTENT APP */}
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
                onChange={(e) => setSelectedCarId(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#f04343] focus:border-transparent transition-all"
              >
                {CARS_DB.map((car) => (
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
                      {formatINR(slab.ogPrice)}
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
          
          {/* 3 Input Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
    </div>
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
                      {formatINR(results.closestSlab.ogPrice)}
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

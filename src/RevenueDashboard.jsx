import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { usePricingStore, normalizePercentages, parseCSV } from './GlobalPricingStore.jsx';
import { 
  Calculator, 
  TrendingUp, 
  TrendingDown, 
  CalendarDays, 
  Map, 
  Car,
  BarChart3,
  DollarSign,
  Gauge,
  CheckCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ArrowRight,
  MapPin,
  Info,
  Sparkles,
  Loader2,
  Link,
  Unlink,
  ListFilter,
  ShieldCheck,
  Settings2,
  Clock,
  Tags,
  Landmark,
  Receipt,
  Dices,
  FileText,
  X,
  Sun,
  Hourglass,
  UploadCloud,
  FileSpreadsheet,
  Database,
  Lightbulb
} from 'lucide-react';

// --- UTILITY FUNCTIONS ---
const formatINR = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);
const formatKM = (val) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(val || 0);

function getWeightedRandom(options, weights) {
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    if (totalWeight === 0) return options[Math.floor(Math.random() * options.length)];
    
    const randomVal = Math.random() * totalWeight;
    let weightSum = 0;

    for (let i = 0; i < options.length; i++) {
        weightSum += weights[i];
        if (randomVal <= weightSum) {
            return options[i];
        }
    }
    return options[options.length - 1]; 
}

// Location data for rational customer analysis
const LOCATIONS = [
      { name: 'Local', distance: 5, days: 1},
      { name: 'Short', distance: 15, days: 1},
      { name: 'Medium', distance: 30, days: 1},
      { name: 'Long', distance: 50, days: 1 },
      { name: 'Extended', distance: 75, days: 1},
      { name: 'Far', distance: 100, days: 2},
      { name: 'Very Far', distance: 150, days: 2},
      { name: 'Extreme', distance: 200, days: 3},
      { name: 'Ultra', distance: 300, days: 3},
      { name: 'Maximum', distance: 400, days: 4},
      { name: 'Record', distance: 500, days: 4}
];

const COMMON_DURATIONS = [
    { days: 1, count: 25 }, { days: 2, count: 35 }, { days: 3, count: 20 }, 
    { days: 4, count: 10 }, { days: 5, count: 5 }, { days: 7, count: 5 }
];

// --- OPTIMIZER ENGINE ---
function simulateScenarioEngine(testKms, testShares, context, pricingState) {
  const { normCat, normCar, totalBookings, deliveryPct, pickupPct, avgDeliveryFee, totalDepositFloat, avgDiscountPct, taxRatePct, modelType, globalWdDays, globalWeDays, scaledExtraKmRev, scaledExtraHrRev, modifier } = context;
  
  let customBaseRev = 0;

  for (const category in normCat) {
    const categoryShare = normCat[category] || 0;
    const carsInCategory = pricingState.vehicles.filter(c => c.category === category);

    for (const car of carsInCategory) {
      const carShare = normCar[car.id] || 0;
      
      for (let i = 0; i < modelType; i++) {
        const customKm = testKms[i];
        const pkgShare = testShares[i] || 0;
        const totalNodeShare = categoryShare * carShare * pkgShare;

        let refSlab = car.slabs[0];
        let minDiff = Math.abs(customKm - car.slabs[0].km);
        for (let j = 1; j < car.slabs.length; j++) {
          const diff = Math.abs(customKm - car.slabs[j].km);
          if (diff < minDiff) { minDiff = diff; refSlab = car.slabs[j]; }
        }

        let calculatedBasePrice = context.getComputedBaseFn ? context.getComputedBaseFn(car.name) : null;
        const custWdPrice = (calculatedBasePrice ?? refSlab.basePrice) + (refSlab.rate * customKm);
        const custWePrice = (calculatedBasePrice ?? refSlab.weekendBase) + (refSlab.weekendRate * customKm);

        customBaseRev += (((globalWdDays * totalNodeShare) * custWdPrice) + ((globalWeDays * totalNodeShare) * custWePrice)) * modifier;
      }
    }
  }

  const logisticRevenue = (totalBookings * (deliveryPct / 100) * avgDeliveryFee) + (totalBookings * (pickupPct / 100) * avgDeliveryFee);
  
  const customDiscount = customBaseRev * avgDiscountPct;
  const customNetRev = customBaseRev - customDiscount + scaledExtraKmRev + scaledExtraHrRev + logisticRevenue;
  const customTax = customNetRev * (taxRatePct / 100);

  let customAvgKm = 0;
  for (let i = 0; i < modelType; i++) {
     const durMult = (globalWdDays + globalWeDays) / totalBookings;
     customAvgKm += testKms[i] * (testShares[i] || 0) * durMult;
  }
  
  return { revenue: customNetRev + customTax + totalDepositFloat, offeredKm: customAvgKm * totalBookings, pkgs: testKms, shares: testShares };
}

// --- MAIN DASHBOARD APP ---
export default function ProjectionDashboard() {
  const { state: pricingState, dispatch: pricingDispatch, immediateDispatch } = usePricingStore();
  const { modelType, packages } = pricingState;

  const [dataSourceMode, setDataSourceMode] = useState('historical'); // 'historical' | 'csv'
  const [parsedCsvData, setParsedCsvData] = useState([]);
  const [csvStats, setCsvStats] = useState(null);

  const [totalBookings, setTotalBookings] = useState('1360');
  const [catSplit, setCatSplit] = useState({ 'Hatchbacks & Minis': '54', 'Compact SUVs': '34', 'SUVs & 7-Seaters': '12' });
  const [extraKmPct, setExtraKmPct] = useState('18'); 
  
  const [deliveryPct, setDeliveryPct] = useState('30'); 
  const [pickupPct, setPickupPct] = useState('30'); 
  const [showDeliverySettings, setShowDeliverySettings] = useState(false);
  const [deliveryDist, setDeliveryDist] = useState({ '250': '17.11', '300': '9.16', '500': '47.47', '750': '14.94', '1000': '11.32' });

  const [showDiscountSettings, setShowDiscountSettings] = useState(false);
  const [discountTiers, setDiscountTiers] = useState({ t1: { discount: '10', share: '30' }, t2: { discount: '15', share: '36' }, t3: { discount: '20', share: '4' } });
  const [taxRate, setTaxRate] = useState('18');

  const [baseExtraKmRev, setBaseExtraKmRev] = useState(pricingState.historicalData.extraKmRev);
  const [baseExtraHrRev, setBaseExtraHrRev] = useState(pricingState.historicalData.extraHrRev);

  const [separateExistDemand, setSeparateExistDemand] = useState(true);
  const [existPkgsShare, setExistPkgsShare] = useState(['32', '46', '16', '6']);

  const activeCustomPkgs = useMemo(() => packages.slice(0, modelType), [packages, modelType]);

  const [showCarWeights, setShowCarWeights] = useState(false);
  const [carWeights, setCarWeights] = useState(() => {
    const initial = {};
    pricingState.vehicles.forEach(car => { initial[car.id] = pricingState.defaultCarWeights[car.name] || '0'; });
    return initial;
  });

  const handleCarWeightChange = (id, val) => { setCarWeights(prev => ({ ...prev, [id]: val })); };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
       const text = evt.target.result;
       const rawData = parseCSV(text);
       
       let anomalies = 0;
       const validBookings = [];
       let totalWdHr = 0, totalWeHr = 0, totalExtraKmRev = 0, totalExtraHrRev = 0;
       let catCounts = { 'Hatchbacks & Minis': 0, 'Compact SUVs': 0, 'SUVs & 7-Seaters': 0 };

       rawData.forEach(row => {
          const vName = row['Vehicle Name'];
          if (!vName) return; 

          const carMatch = pricingState.vehicles.find(c => c.name.toLowerCase() === vName.toLowerCase() || vName.toLowerCase().includes(c.name.toLowerCase()));
          if (!carMatch) return; 

          let wdH = parseFloat(row['Weekday Hours']) || 0;
          let weH = parseFloat(row['Weekend Hours']) || 0;
          let dist = parseFloat(row['Total Distance']) || 0;
          const extraKms = parseFloat(row['Extra KMs']) || 0;
          const pkgName = row['Package Name'] || row['Overall Free KM'];

          if (dist > 10000 || dist <= 0) {
             anomalies++;
             const parsedPkgKm = parseFloat(pkgName) || 0;
             dist = parsedPkgKm + extraKms;
          }
          if (wdH + weH <= 0 || wdH + weH > 10000) return; 

          const cleanRow = {
             carObj: carMatch,
             wdHours: wdH,
             weHours: weH,
             distance: dist,
             baseRentNoDisc: parseFloat(row['Base Rent Without Discount']) || 0,
             discount: parseFloat(row['Discount Amount']) || 0,
             discountPct: (parseFloat(row['Discount Percentage']) || 0) / 100,
             extraKmRev: parseFloat(row['Extra KM Charges']) || 0,
             extraHrRev: parseFloat(row['Extra Hour Charges']) || 0,
             logistics: (parseFloat(row['Delivery Charges']) || 0) + (parseFloat(row['Pickup Charges']) || 0),
             tax: parseFloat(row['Tax Amount']) || 0,
             deposit: parseFloat(row['Security Deposit']) || 1500,
             pkgKmString: pkgName
          };

          totalWdHr += wdH;
          totalWeHr += weH;
          totalExtraKmRev += cleanRow.extraKmRev;
          totalExtraHrRev += cleanRow.extraHrRev;
          catCounts[carMatch.category] = (catCounts[carMatch.category] || 0) + 1;

          validBookings.push(cleanRow);
       });

       setParsedCsvData(validBookings);
       setCsvStats({
         count: validBookings.length,
         anomalies,
         wdHours: totalWdHr,
         weHours: totalWeHr,
         extraKmRev: totalExtraKmRev,
         extraHrRev: totalExtraHrRev,
         catCounts
       });
       setDataSourceMode('csv');
    };
    reader.readAsText(file);
  };

  const avgDeliveryFee = useMemo(() => {
    const norm = normalizePercentages(deliveryDist);
    return (250 * (norm['250'] || 0)) + (300 * (norm['300'] || 0)) + (500 * (norm['500'] || 0)) + (750 * (norm['750'] || 0)) + (1000 * (norm['1000'] || 0));
  }, [deliveryDist]);

  const totalDiscountShare = useMemo(() => {
    return (Number(discountTiers.t1.share) || 0) + (Number(discountTiers.t2.share) || 0) + (Number(discountTiers.t3.share) || 0);
  }, [discountTiers]);

  const avgDiscountPct = useMemo(() => {
    if(totalDiscountShare === 0) return 0;
    const t1 = (Number(discountTiers.t1.discount) || 0) * (Number(discountTiers.t1.share) || 0);
    const t2 = (Number(discountTiers.t2.discount) || 0) * (Number(discountTiers.t2.share) || 0);
    const t3 = (Number(discountTiers.t3.discount) || 0) * (Number(discountTiers.t3.share) || 0);
    return (t1 + t2 + t3) / (totalDiscountShare * 100);
  }, [discountTiers, totalDiscountShare]);

  const [bdCarId, setBdCarId] = useState(pricingState.vehicles[0].id);
  const [bdKm, setBdKm] = useState('320');
  const [bdWdHours, setBdWdHours] = useState('18.95');
  const [bdWeHours, setBdWeHours] = useState('32.02');
  const [bdDiscount, setBdDiscount] = useState('10');
  const [bdHasExtraKm, setBdHasExtraKm] = useState(false);
  const [bdHasExtraHr, setBdHasExtraHr] = useState(false);
  const [bdHasDelivery, setBdHasDelivery] = useState(false);
  const [bdHasPickup, setBdHasPickup] = useState(false);
  
  const [randomReceipt, setRandomReceipt] = useState(null);

  useEffect(() => {
    if (activeCustomPkgs.length > 0 && !activeCustomPkgs.find(p => p.km.toString() === bdKm.toString())) {
      setBdKm(activeCustomPkgs[1] ? activeCustomPkgs[1].km : activeCustomPkgs[0].km);
    }
  }, [activeCustomPkgs, bdKm]);

  // --- OPTIMIZER STATE & LOGIC ---
  const [showOptModal, setShowOptModal] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optProgress, setOptProgress] = useState(0);
  const [optBest, setOptBest] = useState(null);
  const optRef = useRef(false);

  const startOptimization = () => {
    if (isOptimizing) return;
    setShowOptModal(true);
    setIsOptimizing(true);
    setOptBest(null);
    setOptProgress(0);
    optRef.current = true;

    let activeTotalBookings = Number(totalBookings) || 0;
    let activeWdDays = (pricingState.historicalData.wdHours / 24) * (activeTotalBookings / pricingState.historicalData.bookings);
    let activeWeDays = (pricingState.historicalData.weHours / 24) * (activeTotalBookings / pricingState.historicalData.bookings);
    let activeNormCat = normalizePercentages(catSplit);
    let activeExtraKmRev = baseExtraKmRev * (activeTotalBookings / pricingState.historicalData.bookings);
    let activeExtraHrRev = baseExtraHrRev * (activeTotalBookings / pricingState.historicalData.bookings);

    if (dataSourceMode === 'csv' && csvStats) {
       activeTotalBookings = csvStats.count;
       activeWdDays = csvStats.wdHours / 24;
       activeWeDays = csvStats.weHours / 24;
       activeNormCat = normalizePercentages(csvStats.catCounts);
       activeExtraKmRev = csvStats.extraKmRev;
       activeExtraHrRev = csvStats.extraHrRev;
    }
    
    const catTotals = { 'Hatchbacks & Minis': 0, 'Compact SUVs': 0, 'SUVs & 7-Seaters': 0 };
    pricingState.vehicles.forEach(car => { catTotals[car.category] += (Number(carWeights[car.id]) || 0); });
    const normCar = {};
    pricingState.vehicles.forEach(car => { normCar[car.id] = catTotals[car.category] > 0 ? ((Number(carWeights[car.id]) || 0) / catTotals[car.category]) : 0; });

    let totalDepositFloatContext = 0;
    for (const category in activeNormCat) {
      const categoryShare = activeNormCat[category] || 0;
      pricingState.vehicles.filter(c => c.category === category).forEach(car => {
        const carShare = normCar[car.id] || 0;
        const roundedBookings = Math.round(activeTotalBookings * categoryShare * carShare);
        totalDepositFloatContext += roundedBookings * car.deposit;
      });
    }

    const context = {
      normCat: activeNormCat, 
      normCar, 
      totalBookings: activeTotalBookings, 
      globalWdDays: activeWdDays, 
      globalWeDays: activeWeDays,
      scaledExtraKmRev: activeExtraKmRev, 
      scaledExtraHrRev: activeExtraHrRev,
      deliveryPct: Number(deliveryPct) || 0,
      pickupPct: Number(pickupPct) || 0,
      avgDeliveryFee,
      totalDepositFloat: totalDepositFloatContext,
      avgDiscountPct: avgDiscountPct, 
      taxRatePct: Number(taxRate) || 0,
      modelType,
      modifier: 1 + (pricingState.globalModifier / 100),
      getComputedBaseFn: getComputedBase
    };

    const TOTAL_ITERATIONS = 25000;
    const BATCH_SIZE = 250; 
    let currentIteration = 0;

    
    let initialKms = activeCustomPkgs.map(p => Number(p.km)||0);
    let initialShares = activeCustomPkgs.map(p => (Number(p.share)||0)/100);
    let currentBest = simulateScenarioEngine(initialKms, initialShares, context, pricingState);

    const processBatch = () => {
      if (!optRef.current) return; 
      let batchEnd = Math.min(currentIteration + BATCH_SIZE, TOTAL_ITERATIONS);

      for (let i = currentIteration; i < batchEnd; i++) {
        const k1 = 80 + Math.floor(Math.random() * 80); 
        const k2 = k1 + 30 + Math.floor(Math.random() * 120); 
        let testKms = [];
        if (modelType === 4) {
          let k3 = k2 + 50 + Math.floor(Math.random() * 150); if (k3 > 600) k3 = 600;
          let k4 = k3 + 50 + Math.floor(Math.random() * 200); if (k4 > 700) k4 = 700;
          testKms = [k1, k2, k3, k4];
        } else {
          let k3 = k2 + 100 + Math.floor(Math.random() * 350); if (k3 > 700) k3 = 700;
          testKms = [k1, k2, k3];
        }

        let rawShares = testKms.map(km => {
            if (km <= 200) return 30 + Math.random() * 5;     
            if (km <= 400) return 35 + Math.random() * 15;    
            if (km <= 500) return 15 + Math.random() * 10;    
            return 5 + Math.random() * 15;                    
        });
        
        let sumRaw = rawShares.reduce((a,b) => a+b, 0);
        let testShares = rawShares.map(r => r / sumRaw);

        const res = simulateScenarioEngine(testKms, testShares, context, pricingState);
        
        if (res.revenue > currentBest.revenue + 100) {
           currentBest = res; setOptBest({...res}); 
        } else if (Math.abs(res.revenue - currentBest.revenue) <= 100) {
           if (res.offeredKm < currentBest.offeredKm) { currentBest = res; setOptBest({...res}); }
        }
      }
      
      currentIteration = batchEnd;
      setOptProgress(Math.round((currentIteration / TOTAL_ITERATIONS) * 100));

      if (currentIteration < TOTAL_ITERATIONS) {
         setTimeout(processBatch, 0); 
      } else {
         setIsOptimizing(false);
      }
    };
    
    setTimeout(processBatch, 0);
  };

  const applyOptimizedPackages = () => {
    if (optBest && optBest.pkgs && optBest.shares) {
      let remaining = 100.0;
      const formattedShares = optBest.shares.map((s, i) => {
         if (i === modelType - 1) return Math.max(0, remaining).toFixed(1);
         let val = Number((s * 100).toFixed(1));
         remaining -= val;
         return val.toFixed(1);
      });

      immediateDispatch({ type: 'SET_PACKAGES', packages: packages.map((p, i) => {
        if (i < modelType) return { ...p, km: String(Math.round(optBest.pkgs[i])), share: formattedShares[i] };
        return p;
      })});
      setOptBest(null);
      setShowOptModal(false);
    }
  };

  const closeOptModal = () => {
      optRef.current = false;
      setIsOptimizing(false);
      setShowOptModal(false);
  }

  // --- ENGINE: LIVE REACTIVE UI SIMULATION (HYBRID ROW-BY-ROW OR AGGREGATE) ---
  const getComputedBase = useCallback((carName) => {
     if (!pricingState.scenarioBData) return null;
     const weightMarket = Number(pricingState.scenarioBWeights.market) / 100;
     const weightFleet = Number(pricingState.scenarioBWeights.fleet) / 100;
     let maxBase = -1;

     pricingState.scenarioBData.forEach(row => {
        if (row['Vehicle Model'] && row['Vehicle Model'].trim().toLowerCase() === carName.toLowerCase()) {
           const marketIdxStr = String(row['Base Price through MP'] || '').replace(/[^0-9.]/g, '');
           const fleetIdxStr = String(row['Base Price through Cost'] || '').replace(/[^0-9.]/g, '');
           const marketIdx = parseFloat(marketIdxStr) || 0;
           const fleetIdx = parseFloat(fleetIdxStr) || 0;
           const calc = (marketIdx * weightMarket) + (fleetIdx * weightFleet);
           if (calc > maxBase) {
               maxBase = calc;
           }
        }
     });
     return maxBase >= 0 ? maxBase : null;
  }, [pricingState.scenarioBData, pricingState.scenarioBWeights]);

  const engineResults = useMemo(() => {
    const isCsvMode = dataSourceMode === 'csv' && parsedCsvData.length > 0;
    
    let existingBaseRev = 0, existingExtraRev = 0, existingExtraHrRev = 0;
    let customBaseRev = 0, customExtraRev = 0, customExtraHrRev = 0;
    let totalDepositFloat = 0; 
    let logisticRev = 0;
    let existingDiscount = 0, customDiscount = 0;
    let existingTax = 0, customTax = 0;
    let existAvgKm = 0, customAvgKm = 0;
    
    let existingHolidayPremium = 0, customHolidayPremium = 0;
    
    // Holiday details breakdown for UI
    let holidayMetrics = { affectedTotal: 0, affectedWd: 0, affectedWe: 0, premiumWd: 0, premiumWe: 0, totalPremium: 0 };

    const breakdown = {
      byPkgExist: [0, 0, 0, 0], byPkgCust: Array(Math.max(3, modelType)).fill(0),
      byCatExist: { 'Hatchbacks & Minis': 0, 'Compact SUVs': 0, 'SUVs & 7-Seaters': 0 },
      byCatCust: { 'Hatchbacks & Minis': 0, 'Compact SUVs': 0, 'SUVs & 7-Seaters': 0 }
    };

    const pkgShareObj = {}; activeCustomPkgs.forEach(p => { pkgShareObj[p.id] = p.share });
    const normPkg = normalizePercentages(pkgShareObj);
    const normPkgKeys = activeCustomPkgs.map(p => normPkg[p.id] || 0);

    const safeTaxRate = Number(taxRate) || 0;
    
    const safeTotalBookingsFinal = isCsvMode ? parsedCsvData.length : Number(totalBookings);
    const totalDeliveryBookings = safeTotalBookingsFinal * (Number(deliveryPct) / 100);
    const totalPickupBookings = safeTotalBookingsFinal * (Number(pickupPct) / 100);

    let globalAvgExtraRate = 0;
    pricingState.vehicles.forEach(car => { 
        const catShare = normalizePercentages(catSplit)[car.category] || 0;
        // Simple unweighted average for the UI table display purposes
        globalAvgExtraRate += (car.extraRate || 8) / pricingState.vehicles.length; 
    });

    const sortedCustomPkgs = [...activeCustomPkgs].map((p, originalIndex) => ({...p, km: Number(p.km)||0, originalIndex})).sort((a,b) => a.km - b.km);
    
    const modifier = 1 + (pricingState.globalModifier / 100);

    if (isCsvMode) {
       // --- PURE ROW-BY-ROW CSV SIMULATION ---
       parsedCsvData.forEach(row => {
          const car = row.carObj;
          const daysWd = row.wdHours / 24;
          const daysWe = row.weHours / 24;
          const totalDays = daysWd + daysWe;
          
          existingBaseRev += row.baseRentNoDisc;
          existingExtraRev += row.extraKmRev;
          existingExtraHrRev += row.extraHrRev;
          logisticRev += row.logistics;
          existingDiscount += row.discount;
          existingTax += row.tax;
          totalDepositFloat += row.deposit;

          breakdown.byCatExist[car.category] += row.baseRentNoDisc;
          
          let eIndex = pricingState.constants.slabKms.indexOf(Number(row.pkgKmString));
          if (eIndex === -1) eIndex = 0; 
          breakdown.byPkgExist[eIndex] += row.baseRentNoDisc;
          existAvgKm += (pricingState.constants.slabKms[eIndex] || 140) * totalDays;

          let bestPkgCost = Infinity;
          let bestBasePrice = 0;
          let bestExtraCharge = 0;
          let bestPkgIndex = 0;

          activeCustomPkgs.forEach((pkg, i) => {
             const customKm = Number(pkg.km);
             let refSlab = car.slabs[0];
             let minDiff = Math.abs(customKm - car.slabs[0].km);
             for (let j = 1; j < car.slabs.length; j++) {
               const diff = Math.abs(customKm - car.slabs[j].km);
               if (diff < minDiff) { minDiff = diff; refSlab = car.slabs[j]; }
             }

             let calculatedBasePrice = getComputedBase(car.name);
             const wdPrice = (calculatedBasePrice ?? refSlab.basePrice) + (refSlab.rate * customKm);
             const wePrice = (calculatedBasePrice ?? refSlab.weekendBase) + (refSlab.weekendRate * customKm);
             
             const isSelected = pricingState.modifierSelection.includes(activeCustomPkgs[i]?.id);
             const pkgModifier = isSelected ? modifier : 1;

             const basePrice = ((wdPrice * daysWd) + (wePrice * daysWe)) * pkgModifier;

             const allowedKm = customKm * totalDays;
             const extraKms = Math.max(0, row.distance - allowedKm);
             const extraCharge = extraKms * (car.extraRate || 8);

             const totalSimCost = basePrice + extraCharge;
             if (totalSimCost < bestPkgCost) {
                bestPkgCost = totalSimCost;
                bestBasePrice = basePrice;
                bestExtraCharge = extraCharge;
                bestPkgIndex = i;
             }
          });

          customBaseRev += bestBasePrice;
          customExtraRev += bestExtraCharge;
          customExtraHrRev += row.extraHrRev; 
          customDiscount += bestBasePrice * row.discountPct; 
          
          breakdown.byCatCust[car.category] += bestBasePrice;
          breakdown.byPkgCust[bestPkgIndex] += bestBasePrice;
          customAvgKm += Number(activeCustomPkgs[bestPkgIndex].km) * totalDays;

          const rowCustomTaxable = (bestBasePrice - (bestBasePrice * row.discountPct));
          customTax += rowCustomTaxable * (safeTaxRate / 100);
       });

       // NOTE: Pure row-by-row holiday logic would require picking specific rows to be holidays.
       // For now, we apply it uniformly post-aggregation even in CSV mode.
       if (pricingState.isHolidayActive && Number(pricingState.holidayModifier) > 0) {
         const holidayMod = Number(pricingState.holidayModifier) / 100;
         const numHolidayInstances = Number(pricingState.holidayInstances) || 0;
         const affectedBookings = Math.min(parsedCsvData.length, numHolidayInstances * 15);
         
         if (affectedBookings > 0) {
           const avgCustBaseBookingPrice = customBaseRev / Math.max(1, parsedCsvData.length);
           const affectedWd = affectedBookings * (1/3);
           const affectedWe = affectedBookings * (2/3);
           customHolidayPremium = (affectedWd + affectedWe) * avgCustBaseBookingPrice * holidayMod;
           customBaseRev += customHolidayPremium;
           
           const avgExistBaseBookingPrice = existingBaseRev / Math.max(1, parsedCsvData.length);
           existingHolidayPremium = (affectedWd + affectedWe) * avgExistBaseBookingPrice * holidayMod;
           existingBaseRev += existingHolidayPremium;
           
           holidayMetrics = { 
               affectedTotal: affectedBookings, affectedWd, affectedWe, 
               premiumWd: affectedWd * avgCustBaseBookingPrice * holidayMod, 
               premiumWe: affectedWe * avgCustBaseBookingPrice * holidayMod, 
               totalPremium: customHolidayPremium 
           };
         }
       }
       
       existAvgKm = existAvgKm / parsedCsvData.length;
       customAvgKm = customAvgKm / parsedCsvData.length;

    } else {
       // --- EXACT AGGREGATE ENGINE (Default/Manual Mode) ---
       const normCat = normalizePercentages(catSplit);
       const catTotals = { 'Hatchbacks & Minis': 0, 'Compact SUVs': 0, 'SUVs & 7-Seaters': 0 };
       pricingState.vehicles.forEach(car => { catTotals[car.category] += (Number(carWeights[car.id]) || 0); });
       const normCar = {};
       pricingState.vehicles.forEach(car => { normCar[car.id] = catTotals[car.category] > 0 ? ((Number(carWeights[car.id]) || 0) / catTotals[car.category]) : 0; });
       
       const scaleFactor = safeTotalBookingsFinal / pricingState.historicalData.bookings;
       const globalWdDays = (pricingState.historicalData.wdHours / 24) * scaleFactor;
       const globalWeDays = (pricingState.historicalData.weHours / 24) * scaleFactor;

       existingExtraRev = pricingState.historicalData.extraKmRev * scaleFactor;
       customExtraRev = existingExtraRev; 
       existingExtraHrRev = pricingState.historicalData.extraHrRev * scaleFactor;
       customExtraHrRev = existingExtraHrRev; 

       const effectiveGlobalDiscountMultiplier = avgDiscountPct;

       logisticRev = (safeTotalBookingsFinal * (Number(deliveryPct) / 100) * avgDeliveryFee) + (safeTotalBookingsFinal * (Number(pickupPct) / 100) * avgDeliveryFee);

       for (const category in normCat) {
         const categoryShare = normCat[category] || 0;
         const carsInCategory = pricingState.vehicles.filter(c => c.category === category);

         for (const car of carsInCategory) {
           const carShare = normCar[car.id] || 0;
           
           const roundedBookings = Math.round(safeTotalBookingsFinal * categoryShare * carShare);
           totalDepositFloat += roundedBookings * car.deposit;
           
           for (let i = 0; i < 4; i++) {
             const pkgShare = separateExistDemand ? (Number(existPkgsShare[i]) || 0) / 100 : (normPkgKeys[i] || 0);
             const totalNodeShare = categoryShare * carShare * pkgShare;
             
             const ogSlab = car.slabs[i] || car.slabs[0]; 

             const nodeWdDays = globalWdDays * totalNodeShare;
             const nodeWeDays = globalWeDays * totalNodeShare;

             const existTotalNodeRev = (nodeWdDays * (ogSlab.ogWd || 0)) + (nodeWeDays * (ogSlab.ogWe || 0));

             existingBaseRev += existTotalNodeRev;
             breakdown.byPkgExist[i] += existTotalNodeRev;
             breakdown.byCatExist[category] += existTotalNodeRev;
           }

           for (let i = 0; i < modelType; i++) {
             const customKm = Number(activeCustomPkgs[i].km) || 0;
             const pkgShare = normPkgKeys[i] || 0;
             const totalNodeShare = categoryShare * carShare * pkgShare;
             
             let refSlab = car.slabs[0];
             let minDiff = Math.abs(customKm - car.slabs[0].km);
             for (let j = 1; j < car.slabs.length; j++) {
               const diff = Math.abs(customKm - car.slabs[j].km);
               if (diff < minDiff) { minDiff = diff; refSlab = car.slabs[j]; }
             }

             let calculatedBasePrice = getComputedBase(car.name);
             const custWdPrice = (calculatedBasePrice ?? refSlab.basePrice) + (refSlab.rate * customKm);
             const custWePrice = (calculatedBasePrice ?? refSlab.weekendBase) + (refSlab.weekendRate * customKm);

             const nodeWdDays = globalWdDays * totalNodeShare;
             const nodeWeDays = globalWeDays * totalNodeShare;

             const isSelected = pricingState.modifierSelection.includes(activeCustomPkgs[i]?.id);
             const pkgModifier = isSelected ? modifier : 1;

             const custTotalNodeRev = ((nodeWdDays * custWdPrice) + (nodeWeDays * custWePrice)) * pkgModifier;

             customBaseRev += custTotalNodeRev;
             breakdown.byPkgCust[i] += custTotalNodeRev;
             breakdown.byCatCust[category] += custTotalNodeRev;
           }
         }
       }

        if (pricingState.isHolidayActive && Number(pricingState.holidayModifier) > 0) {
           const holidayMod = Number(pricingState.holidayModifier) / 100;
           const numHolidayInstances = Number(pricingState.holidayInstances) || 0;
           const affectedBookings = Math.min(safeTotalBookingsFinal, numHolidayInstances * 15);
           
           if (affectedBookings > 0) {
             const avgCustBaseBookingPrice = customBaseRev / Math.max(1, safeTotalBookingsFinal);
             const affectedWd = affectedBookings * (1/3);
             const affectedWe = affectedBookings * (2/3);
             
             customHolidayPremium = (affectedWd + affectedWe) * avgCustBaseBookingPrice * holidayMod;
             customBaseRev += customHolidayPremium;
             
             const avgExistBaseBookingPrice = existingBaseRev / Math.max(1, safeTotalBookingsFinal);
             existingHolidayPremium = (affectedWd + affectedWe) * avgExistBaseBookingPrice * holidayMod;
             existingBaseRev += existingHolidayPremium;
             
             holidayMetrics = { 
               affectedTotal: affectedBookings, affectedWd, affectedWe, 
               premiumWd: affectedWd * avgCustBaseBookingPrice * holidayMod, 
               premiumWe: affectedWe * avgCustBaseBookingPrice * holidayMod, 
               totalPremium: customHolidayPremium 
             };
           }
        }

       existingDiscount = existingBaseRev * effectiveGlobalDiscountMultiplier * (totalDiscountShare / 100);
       customDiscount = customBaseRev * effectiveGlobalDiscountMultiplier * (totalDiscountShare / 100);
       
       const existingTaxable = (existingBaseRev - existingDiscount);
       const customTaxable = (customBaseRev - customDiscount);

       existingTax = existingTaxable * (safeTaxRate / 100);
       customTax = customTaxable * (safeTaxRate / 100);

       const totalDaysPerBooking = (pricingState.historicalData.wdHours + pricingState.historicalData.weHours) / 24 / pricingState.historicalData.bookings;

       for (let i = 0; i < Math.max(4, modelType); i++) {
         const eKm = i < 4 ? pricingState.constants.slabKms[i] : 0;
         const eShare = i < 4 ? (separateExistDemand ? (Number(existPkgsShare[i]) || 0) / 100 : (normPkgKeys[i] || 0)) : 0;
         
         const cKm = i < modelType ? (Number(activeCustomPkgs[i].km) || 0) : 0;
         const cShare = i < modelType ? (normPkgKeys[i] || 0) : 0;

         existAvgKm += eKm * eShare * totalDaysPerBooking;
         customAvgKm += cKm * cShare * totalDaysPerBooking;
       }
    }

    const locationBreakdown = LOCATIONS.map(loc => {
      const actualKm = loc.distance * 2;

      let existIndex = pricingState.constants.slabKms.findIndex(k => k >= actualKm);
      if (existIndex === -1) existIndex = pricingState.constants.slabKms.length - 1;
      
      while (existIndex < pricingState.constants.slabKms.length - 1) {
        let allowed = pricingState.constants.slabKms[existIndex] * loc.days;
        if (actualKm - allowed > pricingState.constants.rationalExtraKmLimit) existIndex++; else break;
      }

      let existAssignedKm = pricingState.constants.slabKms[existIndex];
      let existAllowed = existAssignedKm * loc.days;
      let existDiff = existAllowed - actualKm;
      let existExtraKm = existDiff < 0 ? Math.abs(existDiff) : 0;

      let custSortIdx = sortedCustomPkgs.findIndex(p => p.km >= actualKm);
      if (custSortIdx === -1) custSortIdx = sortedCustomPkgs.length - 1;
      
      while (custSortIdx < sortedCustomPkgs.length - 1) {
        let allowed = sortedCustomPkgs[custSortIdx].km * loc.days;
        if (actualKm - allowed > pricingState.constants.rationalExtraKmLimit) custSortIdx++; else break;
      }

      let custAssigned = sortedCustomPkgs[custSortIdx] || {km:0, id: 'p1', originalIndex: 0};
      let custAllowed = (custAssigned.km || 0) * loc.days;
      let custDiff = custAllowed - actualKm;
      let custExtraKm = custDiff < 0 ? Math.abs(custDiff) : 0;

      return {
        name: loc.name, distance: loc.distance, actualKm,
        existAssignedKm, existAllowed, existExtraKm, existExtraCharge: existExtraKm * globalAvgExtraRate,
        custAssignedKm: custAssigned.km, custAllowed, custExtraKm, custExtraCharge: custExtraKm * globalAvgExtraRate * modifier
      };
    });

    const existingDiscountedBase = existingBaseRev - existingDiscount;
    const customDiscountedBase = customBaseRev - customDiscount;

    const existingTotalCashFlow = existingDiscountedBase + existingExtraRev + existingExtraHrRev + logisticRev + existingTax + totalDepositFloat;
    const customTotalCashFlow = customDiscountedBase + customExtraRev + customExtraHrRev + logisticRev + customTax + totalDepositFloat;

    const kmPackageDiffs = [];

    for (let i = 0; i < Math.max(4, modelType); i++) {
      const eKm = i < 4 ? pricingState.constants.slabKms[i] : 0;
      const cKm = i < modelType ? (Number(activeCustomPkgs[i].km) || 0) : 0;
      
      const eShare = i < 4 ? (separateExistDemand ? (Number(existPkgsShare[i]) || 0) / 100 : (normPkgKeys[i] || 0)) : 0;
      const cShare = i < modelType ? (normPkgKeys[i] || 0) : 0;

      kmPackageDiffs.push({ 
        eKm, 
        cKm, 
        eSharePct: eShare * 100, 
        cSharePct: cShare * 100, 
        diffKm: cKm - eKm, 
        diffPct: eKm && i < 4 ? ((cKm - eKm) / eKm) * 100 : 0 
      });
    }

    const safeCustomPkgsOutput = [];
    for (let i = 0; i < modelType; i++) { safeCustomPkgsOutput.push(activeCustomPkgs[i] || { km: 0 }); }

    return { 
      existing: { baseRev: existingBaseRev, discount: existingDiscount, discountedBase: existingDiscountedBase, extraRev: existingExtraRev, extraHrRev: existingExtraHrRev, logisticRev: logisticRev, tax: existingTax, totalCashFlow: existingTotalCashFlow },
      custom: { baseRev: customBaseRev, discount: customDiscount, discountedBase: customDiscountedBase, extraRev: customExtraRev, extraHrRev: customExtraHrRev, logisticRev: logisticRev, tax: customTax, totalCashFlow: customTotalCashFlow },
      stats: { totalDeliveryBookings, totalPickupBookings, totalDepositFloat, totalDiscountedBookings: safeTotalBookingsFinal * (totalDiscountShare/100), totalNoDiscountBookings: safeTotalBookingsFinal - (safeTotalBookingsFinal * (totalDiscountShare/100)), scaleFactor: isCsvMode ? 1 : safeTotalBookingsFinal / pricingState.historicalData.bookings },
      kmImpact: { existAvgKm, customAvgKm, avgKmDiff: customAvgKm - existAvgKm, avgKmDiffPct: existAvgKm ? ((customAvgKm - existAvgKm) / existAvgKm) * 100 : 0, existTotalMonthlyKm: existAvgKm * safeTotalBookingsFinal, customTotalMonthlyKm: customAvgKm * safeTotalBookingsFinal, monthlyKmDiff: (customAvgKm * safeTotalBookingsFinal) - (existAvgKm * safeTotalBookingsFinal), kmPackageDiffs },
      breakdown, safeCustomPkgsOutput, isCsvMode, safeTotalBookingsFinal, locationBreakdown,
      holidayMetrics
    };
  }, [totalBookings, catSplit, pricingState, carWeights, deliveryPct, pickupPct, avgDeliveryFee, discountTiers, totalDiscountShare, taxRate, modelType, separateExistDemand, existPkgsShare, baseExtraKmRev, baseExtraHrRev, dataSourceMode, parsedCsvData]);

  const handleGenerateRandom = useCallback(() => {
     if (!activeCustomPkgs || activeCustomPkgs.length === 0) return;

     const carIds = Object.keys(carWeights).map(Number);
     const carWeightVals = carIds.map(id => {
        const car = pricingState.vehicles.find(c => c.id === id);
        if (!car) return 0;
        const catShare = normalizePercentages(catSplit)[car.category] || 0;
        const catTotals = { 'Hatchbacks & Minis': 0, 'Compact SUVs': 0, 'SUVs & 7-Seaters': 0 };
        pricingState.vehicles.forEach(c => { catTotals[c.category] += (Number(carWeights[c.id]) || 0); });
        const carShareInCat = catTotals[car.category] > 0 ? (Number(carWeights[id]) || 0) / catTotals[car.category] : 0;
        return catShare * carShareInCat;
     });
     
     const selectedCarId = getWeightedRandom(carIds, carWeightVals);
     const car = pricingState.vehicles.find(c => c.id === selectedCarId);
     if (!car) return;

     const pkgKms = activeCustomPkgs.map(p => Number(p.km));
     const pkgShares = activeCustomPkgs.map(p => Number(p.share));
     const selectedKm = getWeightedRandom(pkgKms, pkgShares);

     const durDaysKeys = COMMON_DURATIONS.map(d => d.days);
     const durCounts = COMMON_DURATIONS.map(d => d.count);
     const durDays = getWeightedRandom(durDaysKeys, durCounts);
     const durHours = durDays * 24;

     const hasDisc = Math.random() * 100 < totalDiscountShare;
     let selectedDisc = 0;
     if (hasDisc) {
        const dTypes = [Number(discountTiers.t1.discount), Number(discountTiers.t2.discount), Number(discountTiers.t3.discount)];
        const dShares = [Number(discountTiers.t1.share), Number(discountTiers.t2.share), Number(discountTiers.t3.share)];
        selectedDisc = getWeightedRandom(dTypes, dShares);
     }

     const hasExtraKm = Math.random() < (Number(extraKmPct)/100); 
     const extraKmVal = hasExtraKm ? Math.floor(Math.random() * 60) + 10 : 0;
     const extraCharge = extraKmVal * car.extraRate;

     const hasExtraHr = Math.random() < 0.15; 
     const extraHrVal = hasExtraHr ? Math.floor(Math.random() * 3) + 1 : 0;
     const extraHrCharge = extraHrVal * 250; 

     const hasDel = Math.random() * 100 < Number(deliveryPct);
     const hasPic = Math.random() * 100 < Number(pickupPct);
     
     const feeKeys = Object.keys(deliveryDist);
     const feeShares = Object.values(deliveryDist).map(Number);
     const delFee = hasDel ? Number(getWeightedRandom(feeKeys, feeShares)) : 0;
     const picFee = hasPic ? Number(getWeightedRandom(feeKeys, feeShares)) : 0;
     const logisticFee = delFee + picFee;

     let refSlab = car.slabs[0];
     let minDiff = Math.abs(selectedKm - car.slabs[0].km);
     for (let j = 1; j < car.slabs.length; j++) {
       const diff = Math.abs(selectedKm - car.slabs[j].km);
       if (diff < minDiff) { minDiff = diff; refSlab = car.slabs[j]; }
     }
     
     const wdPrice = refSlab.basePrice + (refSlab.rate * selectedKm);
     const wePrice = refSlab.weekendBase + (refSlab.weekendRate * selectedKm);
     
     const isHeavyWe = Math.random() > 0.5;
     let weHours = 0, wdHours = 0;
     if (durHours <= 48 && isHeavyWe) { weHours = durHours; wdHours = 0; }
     else if (durHours <= 48 && !isHeavyWe) { wdHours = durHours; weHours = 0; }
     else {
        weHours = 48; 
        wdHours = durHours - 48;
     }

     const wdMult = wdHours / 24;
     const weMult = weHours / 24;

     const activePkgId = activeCustomPkgs.find(p => Number(p.km) === selectedKm)?.id || 'p1';
     const isSelected = pricingState.modifierSelection.includes(activePkgId);
     const pkgModifier = isSelected ? (1 + (pricingState.globalModifier / 100)) : 1;
     const grossBase = ((wdPrice * wdMult) + (wePrice * weMult)) * pkgModifier;
     const discAmt = grossBase * (selectedDisc / 100);
     const discBase = grossBase - discAmt;
     const taxable = discBase;
     const taxAmt = taxable * (Number(taxRate) / 100);
     const totalCollected = discBase + extraCharge + extraHrCharge + logisticFee + taxAmt + car.deposit;

     setRandomReceipt({
       car: car.name, category: car.category, targetKm: selectedKm,
       durHours: durHours, durDays: durDays,
       wdHours, weHours, wdMult, weMult, 
       grossBase, discPct: selectedDisc, discAmt, discBase,
       hasExtraKm, extraKmVal, extraCharge,
       hasExtraHr, extraHrVal, extraHrCharge,
       hasDel, hasPic, logisticFee,
       taxable, taxAmt, deposit: car.deposit, totalCollected
     });

  }, [carWeights, catSplit, activeCustomPkgs, totalDiscountShare, discountTiers, extraKmPct, deliveryPct, pickupPct, deliveryDist, taxRate, pricingState.globalModifier, pricingState.vehicles]);

  
  const revDiff = engineResults.custom.totalCashFlow - engineResults.existing.totalCashFlow;
  const revDiffPct = engineResults.existing.totalCashFlow === 0 ? 0 : (revDiff / engineResults.existing.totalCashFlow) * 100;

  const bdCar = pricingState.vehicles.find(c => c.id === Number(bdCarId)) || pricingState.vehicles[0];
  const bdWdMult = Number(bdWdHours) / 24;
  const bdWeMult = Number(bdWeHours) / 24;
  const bdTargetKm = Number(bdKm) || 0;
  
  let refSlab = bdCar.slabs[0];
  let minDiff = Math.abs(bdTargetKm - bdCar.slabs[0].km);
  for (let j = 1; j < bdCar.slabs.length; j++) {
    const diff = Math.abs(bdTargetKm - bdCar.slabs[j].km);
    if (diff < minDiff) { minDiff = diff; refSlab = bdCar.slabs[j]; }
  }
  
  const bdWdPrice = refSlab.basePrice + (refSlab.rate * bdTargetKm);
  const bdWePrice = refSlab.weekendBase + (refSlab.weekendRate * bdTargetKm);
  
  const bdActivePkgId = activeCustomPkgs.find(p => Number(p.km) === bdTargetKm)?.id || 'p1';
  const bdIsSelected = pricingState.modifierSelection.includes(bdActivePkgId);
  const bdPkgModifier = bdIsSelected ? (1 + (pricingState.globalModifier / 100)) : 1;
  const bdGrossBase = ((bdWdPrice * bdWdMult) + (bdWePrice * bdWeMult)) * bdPkgModifier;
  const bdDiscountAmt = bdGrossBase * (Number(bdDiscount) / 100);
  const bdDiscountedBase = bdGrossBase - bdDiscountAmt;
  
  const bdExtraKmAmt = bdHasExtraKm ? (45 * bdCar.extraRate) : 0;
  const bdExtraHrAmt = bdHasExtraHr ? 500 : 0;
  const bdLogisticAmt = (bdHasDelivery ? avgDeliveryFee : 0) + (bdHasPickup ? avgDeliveryFee : 0);
  
  const bdTaxable = bdDiscountedBase;
  const bdTaxAmt = bdTaxable * (Number(taxRate) / 100);
  const bdFinalCashFlow = bdDiscountedBase + bdExtraKmAmt + bdExtraHrAmt + bdLogisticAmt + bdTaxAmt + bdCar.deposit;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col relative">
      
      {showOptModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full border border-slate-200 relative">
              <button onClick={closeOptModal} className="absolute right-4 top-4 text-slate-400 hover:text-slate-700">
                <X size={20} />
              </button>
              
              <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                 <div className="bg-[#f04343]/10 p-2 rounded-lg text-[#f04343] flex items-center justify-center">
                   {isOptimizing ? <Loader2 size={24} className="animate-spin" /> : <Sparkles size={24} />}
                 </div>
                 <div>
                   <h2 className="text-lg font-bold text-slate-800">
                     {isOptimizing ? "Optimization Engine Running" : "Optimization Complete"}
                   </h2>
                   <p className="text-xs text-slate-500">
                     {isOptimizing ? "Testing 25,000 combinations dynamically..." : "Best performing model found."}
                   </p>
                 </div>
              </div>
              
              <div className="mb-6">
                <div className="flex justify-between text-xs font-bold text-slate-600 mb-2">
                  <span>Simulation Progress</span>
                  <span>{optProgress}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden shadow-inner">
                  <div className="bg-[#f04343] h-full transition-all duration-200 ease-out" style={{ width: `${optProgress}%` }}></div>
                </div>
              </div>
              
              {optBest && !isOptimizing && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 animate-in fade-in zoom-in duration-300">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide mb-1">Found Optimal Combination</p>
                  <p className="text-3xl font-extrabold text-emerald-800 mb-3">{formatINR(optBest.revenue)}</p>
                  <div className="flex gap-2 flex-wrap mb-4">
                    {optBest.pkgs.map((k,i) => (
                      <span key={i} className="bg-white border border-emerald-200 text-emerald-700 text-xs font-bold px-2 py-1 rounded">
                        {Math.round(k)} km ({(optBest.shares[i] * 100).toFixed(1)}%)
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] font-semibold text-emerald-600/80 mt-2 mb-4">Total KMs: {formatKM(optBest.offeredKm)}</p>
                  
                  <button onClick={applyOptimizedPackages} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-2">
                    <CheckCircle size={18} /> Apply These Numbers
                  </button>
                </div>
              )}
           </div>
        </div>
      )}

      <div className="flex-1 p-4 md:p-6 w-full flex flex-col xl:flex-row gap-6 max-w-[1600px] mx-auto">
        
        {/* LEFT COLUMN: SIMULATION CONTROLS */}
        <div className="w-full xl:w-[350px] flex flex-col gap-5 shrink-0">

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 overflow-hidden relative">
             <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Database size={18} className="text-[#f04343]"/> Data Source
                </h3>
             </div>
             
             <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 mb-4">
                <button onClick={() => setDataSourceMode('historical')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${dataSourceMode === 'historical' ? 'bg-white text-[#f04343] shadow-sm' : 'text-slate-500'}`}>Global Aggregates</button>
                <button onClick={() => setDataSourceMode('csv')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${dataSourceMode === 'csv' ? 'bg-white text-[#f04343] shadow-sm' : 'text-slate-500'}`}>Live CSV Import</button>
             </div>

             {dataSourceMode === 'csv' ? (
                <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                   {!csvStats ? (
                     <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors relative cursor-pointer">
                        <input type="file" accept=".csv" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        <UploadCloud className="text-slate-400 mx-auto mb-2" size={32} />
                        <p className="text-sm font-bold text-slate-600">Upload Booking CSV</p>
                        <p className="text-[10px] text-slate-400 mt-1">Click or drag & drop to process bookings row-by-row</p>
                     </div>
                   ) : (
                     <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                           <FileSpreadsheet className="text-emerald-500" size={20} />
                           <h4 className="font-extrabold text-emerald-800 text-sm">Active CSV Processed</h4>
                        </div>
                        <ul className="text-xs text-emerald-700 font-medium space-y-1 mt-3">
                           <li className="flex justify-between"><span>Valid Bookings:</span> <span className="font-bold">{csvStats.count.toLocaleString()}</span></li>
                           <li className="flex justify-between"><span>Anomalies Fixed:</span> <span className="font-bold">{csvStats.anomalies}</span></li>
                           <li className="flex justify-between"><span>Total WD Hours:</span> <span className="font-bold">{csvStats.wdHours.toLocaleString()}</span></li>
                           <li className="flex justify-between"><span>Total WE Hours:</span> <span className="font-bold">{csvStats.weHours.toLocaleString()}</span></li>
                        </ul>
                        <button onClick={() => {setCsvStats(null); setParsedCsvData([]);}} className="w-full mt-4 bg-white border border-emerald-200 text-emerald-700 text-xs font-bold py-2 rounded-lg hover:bg-emerald-100 transition-colors">Upload Different CSV</button>
                     </div>
                   )}
                </div>
             ) : (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                   <p className="text-xs text-slate-500 leading-relaxed mb-4">
                      The engine is currently scaling mathematically using the exact historical aggregates. Switch to <b>Live CSV Import</b> to run a true row-by-row replay simulation.
                   </p>
                </div>
             )}
          </div>
          
          <div className={`bg-white rounded-xl shadow-sm border border-slate-200 p-5 transition-opacity duration-300 ${dataSourceMode === 'csv' ? 'opacity-50 pointer-events-none grayscale-[30%]' : ''}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <CalendarDays size={18} className="text-[#f04343]"/> Operations Baseline
              </h3>
              {dataSourceMode === 'csv' && <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase">Locked to CSV</span>}
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Total Monthly Bookings</label>
                <input type="number" value={totalBookings} onChange={(e) => setTotalBookings(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-xl font-bold text-[#f04343] focus:outline-none focus:ring-2 focus:ring-[#f04343] transition-all" />
              </div>

              {/* Exact Distribution Note */}
              <div className="pt-3 border-t border-slate-100">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase">Duration Distribution</label>
                </div>
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 mt-2">
                   <p className="text-[10px] text-indigo-800 font-bold leading-tight flex items-start gap-2">
                      <Info size={14} className="shrink-0 mt-0.5"/>
                      Locked to Real Historical Data.
                   </p>
                   <p className="text-[9px] text-indigo-600 mt-1.5 leading-tight">
                     The engine is strictly iterating over the exact sum of {formatKM(pricingState.historicalData.wdHours)} Weekday Hours and {formatKM(pricingState.historicalData.weHours)} Weekend Hours from your {pricingState.historicalData.bookings} records, scaling the math flawlessly to match {totalBookings} total bookings.
                   </p>
                   {engineResults.stats.scaleFactor !== 1 && (
                     <p className="text-[9px] text-indigo-500 font-bold mt-1.5 pt-1.5 border-t border-indigo-200">
                       Data scaled to {(engineResults.stats.scaleFactor * 100).toFixed(1)}% to match {totalBookings} bookings.
                     </p>
                   )}
                </div>
              </div>

              {/* Exact Discounts Component */}
              <div className="pt-3 border-t border-slate-100">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Tags size={12}/> Discount Strategy</label>
                  <button onClick={() => setShowDiscountSettings(!showDiscountSettings)} className="text-slate-400 hover:text-[#f04343] transition-colors"><Settings2 size={16} /></button>
                </div>
                <p className="text-[9px] text-slate-500 font-bold mb-3">Tiers are defined as percentage of TOTAL bookings.</p>
                
                {showDiscountSettings ? (
                  <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200 shadow-inner mb-2">
                     <div className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex justify-between"><span>Discount %</span><span>Given to % Bookings</span></div>
                     {Object.keys(discountTiers).map((key, i) => (
                       <div key={key} className="flex justify-between items-center gap-2">
                         <div className="relative w-16">
                           <input type="number" value={discountTiers[key].discount} onChange={e => {
                               const newTiers = {...discountTiers, [key]: {...discountTiers[key], discount: e.target.value}};
                               setDiscountTiers(newTiers);
                           }} className="w-full border border-slate-300 rounded px-1.5 py-1 text-right text-xs focus:border-[#f04343] font-semibold outline-none" />
                           <span className="absolute right-1.5 top-1.5 text-[9px] text-slate-400">%</span>
                         </div>
                         <span className="text-xs font-bold text-slate-300">→</span>
                         <div className="flex flex-col w-20">
                           <div className="relative w-full">
                             <input type="number" value={discountTiers[key].share} onChange={e => {
                                 const newTiers = {...discountTiers, [key]: {...discountTiers[key], share: e.target.value}};
                                 setDiscountTiers(newTiers);
                               }} className="w-full border border-slate-300 rounded px-1.5 py-1 text-right text-xs focus:border-[#f04343] font-semibold outline-none" />
                             <span className="absolute right-1.5 top-1.5 text-[9px] text-slate-400">%</span>
                           </div>
                           <span className="text-[8px] font-bold text-emerald-600 text-right mt-0.5">~{Math.round(totalBookings * (Number(discountTiers[key].share)/100))} bookings</span>
                         </div>
                       </div>
                     ))}
                     <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Total Pool:</span>
                        <span className="text-xs font-bold text-red-500">{totalDiscountShare}%</span>
                     </div>
                     <p className="text-[9px] text-slate-400 italic leading-tight pt-1">The remaining {Math.max(0, 100 - totalDiscountShare)}% of bookings receive 0% discount.</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl font-bold text-red-500">{(avgDiscountPct * 100).toFixed(1)}%</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase mt-1">Blended Avg Impact on {totalDiscountShare}% of bookings</span>
                  </div>
                )}
              </div>

              {/* NEW: Holiday Modifier Settings */}
              <div className="pt-4 border-t border-slate-100">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-amber-500 uppercase flex items-center gap-1"><TrendingUp size={12}/> Holiday Premium</label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={pricingState.isHolidayActive} onChange={() => immediateDispatch({ type: 'TOGGLE_HOLIDAY_ACTIVE', value: !pricingState.isHolidayActive })} />
                    <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>
                {pricingState.isHolidayActive ? (
                  <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 mt-2 space-y-3">
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-bold text-amber-700 uppercase">Premium %</span>
                       <div className="relative w-16">
                         <input type="number" value={pricingState.holidayModifier} onChange={e => immediateDispatch({ type: 'SET_HOLIDAY_MODIFIER', value: e.target.value })} className="w-full bg-white border border-amber-300 rounded px-1.5 py-1 text-right text-xs focus:border-amber-500 font-bold text-amber-600 outline-none" />
                         <span className="absolute right-1.5 top-1.5 text-[9px] text-amber-400">%</span>
                       </div>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-bold text-amber-700 uppercase">Instances / Month</span>
                       <div className="relative w-16">
                         <input type="number" value={pricingState.holidayInstances} onChange={e => immediateDispatch({ type: 'SET_HOLIDAY_INSTANCES', value: e.target.value })} className="w-full bg-white border border-amber-300 rounded px-1.5 py-1 text-right text-xs focus:border-amber-500 font-bold text-amber-600 outline-none" />
                       </div>
                    </div>
                    <p className="text-[9px] text-amber-600/80 leading-tight">
                       Affects {Math.round(engineResults.holidayMetrics?.affectedTotal || 0)} bookings/mo. (2/3 WE, 1/3 WD). Adds <span className="font-bold">+{formatINR(engineResults.holidayMetrics?.totalPremium || 0)}</span> premium revenue.
                    </p>
                  </div>
                ) : (
                  <p className="text-[9px] text-slate-400 font-bold mb-3 mt-1">Holiday premium is currently disabled.</p>
                )}
              </div>
              
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Landmark size={12}/> Tax Rate (GST)</label>
                <div className="relative w-20">
                  <input type="number" value={taxRate} onChange={e => setTaxRate(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-right pr-6 font-bold text-[#f04343] focus:outline-none" />
                  <span className="absolute right-2 top-1 text-xs text-slate-400">%</span>
                </div>
              </div>
              <p className="text-[9px] text-slate-400 -mt-2">Tax calculated strictly on Discounted Base</p>

              {/* Exact Historical Extra Settings */}
              <div className="pt-3 border-t border-slate-100">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-3">Historical Overages (Base Input)</h4>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs text-slate-600 font-semibold">Extra KM Revenue</span>
                    <div className="relative w-24">
                      <span className="absolute left-2 top-1.5 text-xs text-slate-400">₹</span>
                      <input type="number" value={baseExtraKmRev} onChange={e => setBaseExtraKmRev(Number(e.target.value))} className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-right font-bold text-emerald-600 focus:outline-none focus:border-emerald-400" />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-600 font-semibold">Extra Hour Revenue</span>
                    <div className="relative w-24">
                      <span className="absolute left-2 top-1.5 text-xs text-slate-400">₹</span>
                      <input type="number" value={baseExtraHrRev} onChange={e => setBaseExtraHrRev(Number(e.target.value))} className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-right font-bold text-emerald-600 focus:outline-none focus:border-emerald-400" />
                    </div>
                  </div>
                  <p className="text-[8px] text-slate-400 mt-3 italic text-right">*Currently set for {pricingState.historicalData.bookings} exact records. Scales dynamically.</p>
                </div>
              </div>
              
              <div className="pt-3 border-t border-slate-100">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase">Extra KM Frequency</label>
                  <div className="relative w-20">
                    <input type="number" value={extraKmPct} onChange={e => setExtraKmPct(e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1 text-right font-semibold focus:border-[#f04343] outline-none text-xs" />
                    <span className="absolute right-1 top-1.5 text-[10px] text-slate-400">%</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase">Home Delivery Req.</label>
                  <button onClick={() => setShowDeliverySettings(!showDeliverySettings)} className="text-slate-400 hover:text-[#f04343] transition-colors"><Settings2 size={16} /></button>
                </div>
                <div className="relative mb-3">
                  <input type="number" value={deliveryPct} onChange={e => setDeliveryPct(e.target.value)} className="w-full border border-slate-200 rounded px-3 py-2 font-semibold focus:border-[#f04343] outline-none" />
                  <span className="absolute right-3 top-2 text-slate-400">%</span>
                </div>

                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase">Home Pickup Req.</label>
                </div>
                <div className="relative">
                  <input type="number" value={pickupPct} onChange={e => setPickupPct(e.target.value)} className="w-full border border-slate-200 rounded px-3 py-2 font-semibold focus:border-[#f04343] outline-none" />
                  <span className="absolute right-3 top-2 text-slate-400">%</span>
                </div>
                
                {showDeliverySettings && (
                  <div className="mt-3 space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200 shadow-inner">
                     <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Fee Distribution (%)</div>
                     {['250', '300', '500', '750', '1000'].map(fee => (
                       <div key={fee} className="flex justify-between items-center gap-2">
                         <span className="text-xs font-semibold text-slate-600">₹{fee}</span>
                         <div className="relative w-16">
                           <input type="number" value={deliveryDist[fee]} onChange={e => setDeliveryDist({...deliveryDist, [fee]: e.target.value})} className="w-full border border-slate-300 rounded px-1.5 py-1 text-right text-xs focus:border-[#f04343] font-semibold outline-none" />
                           <span className="absolute right-1.5 top-1.5 text-[9px] text-slate-400">%</span>
                         </div>
                       </div>
                     ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><Car size={18} className="text-[#f04343]"/> Category Weights</h3>
              <button onClick={() => setShowCarWeights(!showCarWeights)} className="text-[10px] font-bold text-white bg-[#f04343] px-2 py-1 rounded hover:bg-red-600 transition-colors">
                {showCarWeights ? 'HIDE CARS' : 'EDIT CARS'}
              </button>
            </div>
            
            <div className="space-y-3">
              {Object.keys(catSplit).map(cat => (
                <div key={cat} className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-600">{cat}</span>
                  <div className="relative w-20">
                    <input type="number" value={catSplit[cat]} onChange={e => setCatSplit(p => ({...p, [cat]: e.target.value}))} className="w-full border border-slate-200 rounded px-2 py-1 font-bold text-right pr-6 focus:border-[#f04343] outline-none" />
                    <span className="absolute right-2 top-1.5 text-xs text-slate-400">%</span>
                  </div>
                </div>
              ))}
            </div>

            {showCarWeights && (
              <div className="mt-4 pt-4 border-t border-slate-100 max-h-60 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {Object.keys(catSplit).map(cat => (
                   <div key={`sub-${cat}`}>
                     <h4 className="text-[10px] uppercase font-bold text-slate-400 mb-2">{cat} Models</h4>
                     {pricingState.vehicles.filter(c => c.category === cat).map(car => (
                       <div key={car.id} className="flex items-center justify-between gap-2 mb-1.5 pl-2">
                         <span className="text-xs text-slate-600 truncate">{car.name}</span>
                         <input type="number" value={carWeights[car.id]} onChange={e => handleCarWeightChange(car.id, e.target.value)} className="w-12 border border-slate-200 rounded px-1 py-0.5 text-xs text-center focus:border-[#f04343] outline-none" />
                       </div>
                     ))}
                   </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 relative overflow-hidden">
            <div className="mb-5 pb-5 border-b border-slate-100">
               <button onClick={startOptimization} className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-lg py-3 px-4 font-bold flex items-center justify-center gap-2 transition-all shadow-md group">
                 <Sparkles size={18} className="text-yellow-400 group-hover:scale-110 transition-transform" /> Auto Optimize Packages
               </button>
               {dataSourceMode === 'csv' && (
                 <p className="text-center text-[10px] text-slate-400 mt-2 italic">Uses Rational Customer logic on each of the {engineResults.stats.scaleFactor} parsed rows.</p>
               )}
            </div>
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5">
               <div className="flex justify-between items-center mb-2">
                 <div className="flex items-center gap-2">
                   {separateExistDemand ? <Unlink size={14} className="text-[#f04343]"/> : <Link size={14} className="text-slate-500" />}
                   <span className="text-xs font-bold text-slate-700">Separate Scenario A Demand</span>
                 </div>
                 <label className="relative inline-flex items-center cursor-pointer">
                   <input type="checkbox" className="sr-only peer" checked={separateExistDemand} onChange={() => setSeparateExistDemand(!separateExistDemand)} />
                   <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#f04343]"></div>
                 </label>
               </div>
               {separateExistDemand && (
                 <div className="flex gap-2 mt-3">
                   {[0,1,2,3].map(i => (
                     <div key={`exist-share-${i}`} className="flex-1">
                       <label className="block text-[9px] font-bold text-slate-500 mb-1 text-center">{pricingState.constants.slabKms[i]}km</label>
                       <input type="number" value={existPkgsShare[i]} onChange={e => { const newShare = [...existPkgsShare]; newShare[i] = e.target.value; setExistPkgsShare(newShare); }} className="w-full border border-slate-300 bg-white rounded px-1 py-1 font-bold text-xs text-center focus:border-[#f04343] outline-none" />
                     </div>
                   ))}
                 </div>
               )}
            </div>
            
            <div className="flex items-center justify-between mb-2">
               <span className="text-[10px] font-bold text-slate-400 uppercase">Scenario B Format</span>
               <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                 <button onClick={() => immediateDispatch({type: 'SET_MODEL_TYPE', value: 3})} className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${modelType === 3 ? 'bg-white text-[#f04343] shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-200'}`}>3 Pkg</button>
                 <button onClick={() => immediateDispatch({type: 'SET_MODEL_TYPE', value: 4})} className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${modelType === 4 ? 'bg-white text-[#f04343] shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-200'}`}>4 Pkg</button>
                 <button onClick={() => immediateDispatch({type: 'SET_MODEL_TYPE', value: 5})} className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${modelType === 5 ? 'bg-white text-[#f04343] shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-200'}`}>5 Pkg</button>
               </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1 text-[10px] font-bold text-slate-400 uppercase mt-4">
                <div className="flex-[2]">Target KM</div>
                <div className="flex-1 text-right pr-2">Demand %</div>
              </div>
              {activeCustomPkgs.map((pkg, i) => (
                <div key={pkg.id} className="flex items-center gap-3">
                  <div className="relative flex-[2]">
                    <input type="number" value={pkg.km} onChange={e => pricingDispatch({type: 'UPDATE_PACKAGE_KM', id: pkg.id, value: e.target.value})} className="w-full border border-slate-200 rounded px-3 py-1.5 font-bold text-slate-800 focus:border-[#f04343] outline-none" />
                    <span className="absolute right-3 top-2 text-xs text-slate-400">km</span>
                  </div>
                  <div className="relative flex-1">
                    <input type="number" value={pkg.share} onChange={e => pricingDispatch({type: 'UPDATE_PACKAGE_SHARE', id: pkg.id, value: e.target.value})} className="w-full border border-slate-200 rounded px-2 py-1.5 font-bold text-slate-600 text-right pr-5 focus:border-[#f04343] outline-none" />
                    <span className="absolute right-2 top-2 text-xs text-slate-400">%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: RESULTS DASHBOARD */}
        <div className="flex-1 flex flex-col gap-6 overflow-hidden">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Existing Strategy */}
            <div className="bg-slate-800 rounded-2xl p-5 text-white shadow-md relative overflow-hidden flex flex-col min-h-[320px]">
              <div className="absolute -right-4 -bottom-4 opacity-10"><Calculator size={120} /></div>
              <h2 className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-1 relative z-10">Scenario A: Existing Slabs</h2>
              <p className="text-[10px] text-slate-500 mb-4 relative z-10">Fixed 140/320/500/620 KM Pricing</p>
              
              <div className="space-y-2 mt-auto relative z-10">
                <div className="flex justify-between items-end border-b border-slate-700 pb-2">
                  <span className="text-xs text-slate-300 font-semibold flex items-center gap-1">Base Trip Revenue <span className="bg-slate-700 px-1 rounded text-[8px]">Gross</span></span>
                  <span className="text-base font-bold">{formatINR(engineResults.existing.baseRev)}</span>
                </div>
                <div className="flex justify-between items-end border-b border-slate-700 pb-2">
                  <span className="text-xs text-red-400 font-bold">Discounts Applied</span>
                  <span className="text-base font-bold text-red-400">-{formatINR(engineResults.existing.discount)}</span>
                </div>
                <div className="flex justify-between items-end border-b border-slate-700 pb-2 bg-slate-700/50 p-2 rounded">
                  <span className="text-xs text-white font-bold flex items-center gap-1">Net Base Revenue</span>
                  <span className="text-base font-bold">{formatINR(engineResults.existing.discountedBase)}</span>
                </div>
                <div className="flex justify-between items-end border-b border-slate-700 pb-2 mt-2">
                  <span className="text-xs text-emerald-400 font-semibold">Extra KM Revenue</span>
                  <span className="text-base font-bold text-emerald-400">+{formatINR(engineResults.existing.extraRev)}</span>
                </div>
                <div className="flex justify-between items-end border-b border-slate-700 pb-2">
                  <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1"><Hourglass size={12}/> Extra Hour Revenue</span>
                  <span className="text-base font-bold text-emerald-400">+{formatINR(engineResults.existing.extraHrRev)}</span>
                </div>
                <div className="flex justify-between items-end border-b border-slate-700 pb-2">
                  <span className="text-xs text-blue-400 font-semibold">Delivery & Pickup Rev</span>
                  <span className="text-base font-bold text-blue-400">+{formatINR(engineResults.existing.logisticRev)}</span>
                </div>
                <div className="flex justify-between items-end border-b border-slate-700 pb-2">
                  <span className="text-xs text-slate-300 font-semibold flex items-center gap-1"><Landmark size={12}/> Tax ({taxRate}%)</span>
                  <span className="text-base font-bold text-slate-300">+{formatINR(engineResults.existing.tax)}</span>
                </div>
                <div className="flex justify-between items-end border-b border-slate-700 pb-2">
                  <span className="text-xs text-indigo-300 font-semibold flex items-center gap-1"><ShieldCheck size={12}/> Deposits (Float)</span>
                  <span className="text-base font-bold text-indigo-300">+{formatINR(engineResults.stats.totalDepositFloat)}</span>
                </div>
                <div className="flex justify-between items-end pt-1">
                  <span className="text-sm text-white font-bold">Total Cash Flow</span>
                  <span className="text-3xl font-extrabold tracking-tight">{formatINR(engineResults.existing.totalCashFlow)}</span>
                </div>
              </div>
            </div>

            {/* Custom Strategy */}
            <div className="bg-gradient-to-br from-[#f04343] to-[#d42d2d] rounded-2xl p-5 text-white shadow-md relative overflow-hidden flex flex-col min-h-[320px]">
              <div className="absolute -right-4 -bottom-4 opacity-10"><DollarSign size={120} /></div>
              <div className="flex justify-between items-start relative z-10 mb-4">
                <div>
                  <h2 className="text-white/80 font-bold text-xs uppercase tracking-widest mb-1">Scenario B: Custom Slabs</h2>
                  <p className="text-[10px] text-white/60">Dynamic Interpolation Engine</p>
                </div>
                <div className={`px-2.5 py-1 rounded-lg flex items-center gap-1 text-xs font-bold shadow-sm backdrop-blur-sm bg-white/20 whitespace-nowrap shrink-0`}>
                    {revDiff > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {revDiff > 0 ? '+' : ''}{revDiffPct.toFixed(1)}%
                </div>
              </div>

              <div className="space-y-2 mt-auto relative z-10">
                <div className="flex justify-between items-end border-b border-red-400/30 pb-2">
                  <span className="text-xs text-red-100 font-semibold flex items-center gap-1">Base Trip Revenue <span className="bg-red-800/30 px-1 rounded text-[8px]">Gross</span></span>
                  <span className="text-base font-bold">{formatINR(engineResults.custom.baseRev)}</span>
                </div>
                <div className="flex justify-between items-end border-b border-red-400/30 pb-2">
                  <span className="text-xs text-white font-bold">Discounts Applied</span>
                  <span className="text-base font-bold text-white">-{formatINR(engineResults.custom.discount)}</span>
                </div>
                <div className="flex justify-between items-end border-b border-red-400/30 pb-2 bg-red-900/20 p-2 rounded">
                  <span className="text-xs text-white font-bold flex items-center gap-1">Net Base Revenue</span>
                  <span className="text-base font-bold">{formatINR(engineResults.custom.discountedBase)}</span>
                </div>
                <div className="flex justify-between items-end border-b border-red-400/30 pb-2 mt-2">
                  <span className="text-xs text-emerald-300 font-semibold">Extra KM Revenue</span>
                  <span className="text-base font-bold text-emerald-300">+{formatINR(engineResults.custom.extraRev)}</span>
                </div>
                <div className="flex justify-between items-end border-b border-red-400/30 pb-2">
                  <span className="text-xs text-emerald-300 font-semibold flex items-center gap-1"><Hourglass size={12}/> Extra Hour Revenue</span>
                  <span className="text-base font-bold text-emerald-300">+{formatINR(engineResults.custom.extraHrRev)}</span>
                </div>
                <div className="flex justify-between items-end border-b border-red-400/30 pb-2">
                  <span className="text-xs text-blue-200 font-semibold">Delivery & Pickup Rev</span>
                  <span className="text-base font-bold text-blue-200">+{formatINR(engineResults.custom.logisticRev)}</span>
                </div>
                <div className="flex justify-between items-end border-b border-red-400/30 pb-2">
                  <span className="text-xs text-red-100 font-semibold flex items-center gap-1"><Landmark size={12}/> Tax ({taxRate}%)</span>
                  <span className="text-base font-bold text-red-100">+{formatINR(engineResults.custom.tax)}</span>
                </div>
                <div className="flex justify-between items-end border-b border-red-400/30 pb-2">
                  <span className="text-xs text-indigo-100 font-semibold flex items-center gap-1"><ShieldCheck size={12}/> Deposits (Float)</span>
                  <span className="text-base font-bold text-indigo-100">+{formatINR(engineResults.stats.totalDepositFloat)}</span>
                </div>
                <div className="flex justify-between items-end pt-1">
                  <span className="text-sm text-white font-bold">Total Cash Flow</span>
                  <div className="text-right">
                     <span className="text-3xl font-extrabold tracking-tight block">{formatINR(engineResults.custom.totalCashFlow)}</span>
                     <span className="text-[10px] font-bold opacity-80 uppercase tracking-wide">
                        {revDiff > 0 ? '+' : ''}{formatINR(revDiff)} Impact
                     </span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Strategic Insights Card */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 mb-8 shadow-sm">
             <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2 mb-3"><Sparkles size={20}/> Strategic Insights</h3>
             <ul className="space-y-3 text-sm text-indigo-800">
               <li className="flex items-start gap-2">
                 <ArrowRight size={16} className="mt-0.5 shrink-0 text-indigo-500"/> 
                 <span><strong>Fleet Utilization:</strong> {engineResults.kmImpact.customAvgKm < engineResults.kmImpact.existAvgKm ? "Scenario B dynamically reduces unnecessary free kilometers, protecting asset depreciation while maintaining revenue." : "Scenario B offers more upfront kilometers, which acts as a strong conversion driver for long-distance customers."}</span>
               </li>
               <li className="flex items-start gap-2">
                 <ArrowRight size={16} className="mt-0.5 shrink-0 text-indigo-500"/> 
                 <span><strong>Revenue Efficiency:</strong> {revDiff > 0 ? `Transitioning to Scenario B captures ${formatINR(revDiff)} more value while aligning closely with actual driving patterns.` : `Scenario A is currently yielding ${formatINR(Math.abs(revDiff))} more. Tweak your Custom Slabs to optimize further.`}</span>
               </li>
               <li className="flex items-start gap-2">
                 <ArrowRight size={16} className="mt-0.5 shrink-0 text-indigo-500"/> 
                 <span><strong>Rational Upgrades:</strong> By setting strategic breakpoints (like {activeCustomPkgs[1]?.km || 0}km), the engine forces rational customers doing {LOCATIONS[10]?.actualKm || 0}km round-trips to either pay healthy overages or auto-upgrade to higher tiers.</span>
               </li>
             </ul>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-10">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
               <div className="flex items-center gap-2">
                 <ListFilter className="text-[#f04343]" size={18}/>
                 <h2 className="text-base font-bold text-slate-800">Rational Customer Extra KM Analysis</h2>
               </div>
               <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                 <Info size={12} /> Auto-Upgrade threshold: {'>'} {pricingState.constants.rationalExtraKmLimit} KM
               </div>
            </div>
            
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-100 text-slate-600 text-[10px] uppercase sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="p-3 border-b-2 border-slate-200 font-extrabold bg-slate-100 sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Location</th>
                    <th className="p-3 border-b-2 border-slate-200 font-extrabold text-center border-r">Round Trip</th>
                    <th className="p-3 border-b-2 border-slate-200 font-extrabold text-center bg-slate-50 border-r" colSpan={3}>Scenario A: Existing Model</th>
                    <th className="p-3 border-b-2 border-slate-200 font-extrabold text-center bg-[#f04343]/5 text-[#f04343]" colSpan={3}>Scenario B: Custom Model</th>
                  </tr>
                  <tr className="bg-white shadow-[0_2px_2px_-1px_rgba(0,0,0,0.1)]">
                    <th className="p-2 border-b border-slate-200 bg-white sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"></th>
                    <th className="p-2 border-b border-slate-200 border-r"></th>
                    <th className="p-2 border-b border-slate-200 font-bold text-center text-slate-500">Ref Pkg</th>
                    <th className="p-2 border-b border-slate-200 font-bold text-center text-emerald-600">Extra KM</th>
                    <th className="p-2 border-b border-slate-200 font-bold text-center border-r text-emerald-600">Avg Extra Charge</th>
                    <th className="p-2 border-b border-[#f04343]/20 font-bold text-center text-[#f04343] bg-[#f04343]/5">Assigned Pkg</th>
                    <th className="p-2 border-b border-[#f04343]/20 font-bold text-center text-emerald-600 bg-[#f04343]/5">Extra KM</th>
                    <th className="p-2 border-b border-[#f04343]/20 font-bold text-center text-emerald-600 bg-[#f04343]/5">Avg Extra Charge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {engineResults.locationBreakdown && engineResults.locationBreakdown.map((loc, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-bold text-slate-700 bg-white sticky left-0 z-10 border-r border-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{loc.name}</td>
                      <td className="p-3 text-center text-slate-500 border-r">{loc.actualKm} km</td>
                      
                      <td className="p-3 text-center text-slate-600">{loc.existAssignedKm} km</td>
                      <td className="p-3 text-center font-bold text-slate-800">{loc.existExtraKm > 0 ? <span className="text-emerald-600">+{loc.existExtraKm} km</span> : <span className="text-slate-300">-</span>}</td>
                      <td className="p-3 text-center font-bold border-r">{loc.existExtraCharge > 0 ? <span className="text-emerald-600">+{formatINR(loc.existExtraCharge)}</span> : <span className="text-slate-300">-</span>}</td>

                      <td className="p-3 text-center font-bold text-[#f04343] bg-[#f04343]/5">{loc.custAssignedKm} km</td>
                      <td className="p-3 text-center font-bold bg-[#f04343]/5">{loc.custExtraKm > 0 ? <span className="text-emerald-600">+{loc.custExtraKm} km</span> : <span className="text-slate-300">-</span>}</td>
                      <td className="p-3 text-center font-bold bg-[#f04343]/5">{loc.custExtraCharge > 0 ? <span className="text-emerald-600">+{formatINR(loc.custExtraCharge)}</span> : <span className="text-slate-300">-</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-10">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                   <Receipt className="text-[#f04343]" size={24}/> Per-Booking Economics (Step-by-Step Breakdown)
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Validate exactly how a single booking's cash flow is derived. Tax is correctly applied to the Discounted Base.
                </p>
              </div>
            </div>

            <div className="p-6 flex flex-col xl:flex-row gap-8">
               
               <div className="flex-1">
                 <h3 className="font-bold text-slate-700 text-sm mb-4 border-b border-slate-100 pb-2">Manual Simulator (Based on Custom Slabs)</h3>
                 <div className="flex flex-wrap gap-4 mb-6">
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Vehicle</label>
                      <select value={bdCarId} onChange={e => setBdCarId(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-800 outline-none focus:border-[#f04343]">
                         {pricingState.vehicles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Target Package</label>
                      <select value={bdKm} onChange={e => setBdKm(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-800 outline-none focus:border-[#f04343]">
                         {activeCustomPkgs.map(p => <option key={p.id} value={p.km}>{p.km} km</option>)}
                      </select>
                    </div>
                 </div>

                 <div className="flex gap-4 mb-6">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">WD Hours Billed</label>
                      <div className="relative">
                        <input type="number" value={bdWdHours} onChange={e => setBdWdHours(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-800 outline-none focus:border-[#f04343]" />
                        <span className="absolute right-3 top-2.5 text-xs text-slate-400">hrs</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">WE Hours Billed</label>
                      <div className="relative">
                        <input type="number" value={bdWeHours} onChange={e => setBdWeHours(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-800 outline-none focus:border-[#f04343]" />
                        <span className="absolute right-3 top-2.5 text-xs text-slate-400">hrs</span>
                      </div>
                    </div>
                 </div>

                 <div className="flex gap-4 mb-6">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Manual Discount %</label>
                      <input type="number" value={bdDiscount} onChange={e => setBdDiscount(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-800 outline-none focus:border-[#f04343]" />
                    </div>
                    <div className="flex-1 flex flex-col justify-end">
                       <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer bg-slate-50 p-2 rounded-lg border border-slate-200">
                         <input type="checkbox" checked={bdHasExtraKm} onChange={() => setBdHasExtraKm(!bdHasExtraKm)} className="w-4 h-4 text-[#f04343] focus:ring-[#f04343]" />
                         +45 Extra KM
                       </label>
                    </div>
                    <div className="flex-1 flex flex-col justify-end">
                       <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer bg-slate-50 p-2 rounded-lg border border-slate-200">
                         <input type="checkbox" checked={bdHasExtraHr} onChange={() => setBdHasExtraHr(!bdHasExtraHr)} className="w-4 h-4 text-[#f04343] focus:ring-[#f04343]" />
                         +2 Extra Hr
                       </label>
                    </div>
                 </div>
                 <div className="flex gap-4 mb-6">
                    <div className="flex-1 flex flex-col justify-end">
                       <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer bg-slate-50 p-2 rounded-lg border border-slate-200">
                         <input type="checkbox" checked={bdHasDelivery} onChange={() => setBdHasDelivery(!bdHasDelivery)} className="w-4 h-4 text-[#f04343] focus:ring-[#f04343]" />
                         Delivery
                       </label>
                    </div>
                    <div className="flex-1 flex flex-col justify-end">
                       <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer bg-slate-50 p-2 rounded-lg border border-slate-200">
                         <input type="checkbox" checked={bdHasPickup} onChange={() => setBdHasPickup(!bdHasPickup)} className="w-4 h-4 text-[#f04343] focus:ring-[#f04343]" />
                         Pickup
                       </label>
                    </div>
                 </div>

                 <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 font-mono text-sm shadow-inner relative overflow-hidden">
                    <div className="space-y-4">
                       <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                          <div>
                            <span className="text-slate-500">1. Interpolated Exact Hourly Rates</span>
                            <span className="block text-[10px] text-slate-400 mt-0.5">y = mx + b</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-slate-800 block">WD: {formatINR(bdWdPrice / 24)}/hr</span>
                            <span className="font-bold text-slate-800 block">WE: {formatINR(bdWePrice / 24)}/hr</span>
                          </div>
                       </div>
                       <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                          <div>
                            <span className="text-slate-500 flex items-center gap-2"><Clock size={14}/> 2. Multiply by Hours Booked</span>
                            <span className="block text-[10px] text-slate-400 mt-0.5">WD: {(Number(bdWdHours)/24).toFixed(3)}x | WE: {(Number(bdWeHours)/24).toFixed(3)}x</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-slate-800 block">WD: {formatINR(bdWdPrice * bdWdMult)}</span>
                            <span className="font-bold text-slate-800 block">WE: {formatINR(bdWePrice * bdWeMult)}</span>
                          </div>
                       </div>
                       <div className="flex justify-between items-center border-b border-slate-200 pb-2 bg-white p-2 rounded shadow-sm">
                          <span className="font-bold text-slate-700">Gross Trip Amount (+{pricingState.globalModifier}%)</span>
                          <span className="font-bold text-slate-800">{formatINR(bdGrossBase)}</span>
                       </div>
                       <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                          <div>
                            <span className="text-slate-500 flex items-center gap-2"><Tags size={14}/> 3. Apply Custom Discount</span>
                            <span className="block text-[10px] text-slate-400 mt-0.5">{bdDiscount}% applied</span>
                          </div>
                          <span className="font-bold text-red-500">-{formatINR(bdDiscountAmt)}</span>
                       </div>
                       <div className="flex justify-between items-center border-b border-slate-200 pb-2 bg-white p-2 rounded shadow-sm">
                          <span className="font-bold text-slate-700">Discounted Base</span>
                          <span className="font-bold text-slate-800">{formatINR(bdDiscountedBase)}</span>
                       </div>
                       <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                          <span className="text-slate-500 flex items-center gap-2">4. Add Extra KM Charge</span>
                          <span className="font-bold text-slate-800">+{formatINR(bdExtraKmAmt)}</span>
                       </div>
                       <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                          <span className="text-slate-500 flex items-center gap-2">5. Add Extra Hour Charge</span>
                          <span className="font-bold text-slate-800">+{formatINR(bdExtraHrAmt)}</span>
                       </div>
                       <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                          <span className="text-slate-500 flex items-center gap-2">6. Add Logistic Fee (Del/Pic)</span>
                          <span className="font-bold text-slate-800">+{formatINR(bdLogisticAmt)}</span>
                       </div>
                       <div className="flex justify-between items-center border-b border-slate-200 pb-2 bg-white p-2 rounded shadow-sm">
                          <span className="font-bold text-slate-700">Total Taxable Amount (Discount Base)</span>
                          <span className="font-bold text-slate-800">{formatINR(bdTaxable)}</span>
                       </div>
                       <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                          <div>
                            <span className="text-slate-500 flex items-center gap-2"><Landmark size={14}/> 7. Add Tax (GST)</span>
                            <span className="block text-[10px] text-slate-400 mt-0.5">{taxRate}% applied on Taxable Amount</span>
                          </div>
                          <span className="font-bold text-emerald-600">+{formatINR(bdTaxAmt)}</span>
                       </div>
                       <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                          <div>
                            <span className="text-slate-500 flex items-center gap-2"><ShieldCheck size={14}/> 8. Add Security Deposit</span>
                            <span className="block text-[10px] text-slate-400 mt-0.5">Refundable Float for {bdCar.name}</span>
                          </div>
                          <span className="font-bold text-indigo-400">+{formatINR(bdCar.deposit)}</span>
                       </div>
                       <div className="flex justify-between items-center pt-2 bg-[#f04343]/10 p-3 rounded-lg border border-[#f04343]/20">
                          <span className="font-extrabold text-[#f04343] uppercase tracking-wide">Final Customer Bill</span>
                          <span className="text-2xl font-extrabold text-[#f04343]">{formatINR(bdFinalCashFlow)}</span>
                       </div>
                    </div>
                 </div>
               </div>

               <div className="w-full xl:w-[450px] shrink-0 border-t xl:border-t-0 xl:border-l border-slate-200 pt-8 xl:pt-0 xl:pl-8">
                  <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
                     <div className="absolute -right-10 -bottom-10 opacity-10"><Dices size={160} /></div>
                     <h3 className="font-bold text-white text-lg flex items-center gap-2 mb-2 relative z-10"><Dices className="text-amber-400"/> Random Real-World Booking</h3>
                     <p className="text-xs text-slate-400 mb-6 relative z-10">Simulates exactly one random booking out of your {totalBookings} pool based on the exact percentage weights you set in the dashboard.</p>
                     
                     <button onClick={handleGenerateRandom} className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-extrabold py-4 rounded-xl transition-all shadow-lg shadow-amber-500/20 mb-6 flex justify-center items-center gap-2 relative z-10">
                        <FileText size={18}/> Generate Random Receipt
                     </button>

                     {randomReceipt && (
                        <div className="bg-white text-slate-800 rounded-xl p-5 relative z-10 animate-in slide-in-from-bottom-4 duration-300 shadow-2xl">
                           <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-3">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Wowcarz Receipt</p>
                              <h4 className="font-extrabold text-lg mt-1">{randomReceipt.car}</h4>
                              <p className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full inline-block mt-1">{randomReceipt.category}</p>
                           </div>
                           
                           <div className="space-y-2 text-xs font-mono mb-4 border-b border-dashed border-slate-300 pb-4">
                              <div className="flex justify-between"><span className="text-slate-500">Package:</span><span className="font-bold">{randomReceipt.targetKm} km</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">WD Hours:</span><span className="font-bold">{Number(randomReceipt.wdHours).toFixed(1)} hrs ({Number(randomReceipt.wdMult).toFixed(2)}x)</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">WE Hours:</span><span className="font-bold">{Number(randomReceipt.weHours).toFixed(1)} hrs ({Number(randomReceipt.weMult).toFixed(2)}x)</span></div>
                              <div className="flex justify-between mt-2"><span className="text-slate-500">Gross Base (+{pricingState.globalModifier}%):</span><span className="font-bold">{formatINR(randomReceipt.grossBase)}</span></div>
                              <div className="flex justify-between text-red-500"><span className="">Discount ({randomReceipt.discPct}%):</span><span className="font-bold">-{formatINR(randomReceipt.discAmt)}</span></div>
                              
                              {(randomReceipt.hasExtraKm || randomReceipt.hasExtraHr || randomReceipt.logisticFee > 0) && <div className="pt-2 mt-2 border-t border-slate-100"></div>}
                              
                              {randomReceipt.hasExtraKm && <div className="flex justify-between"><span className="text-slate-500">Extra KMs ({randomReceipt.extraKmVal}k):</span><span className="font-bold">+{formatINR(randomReceipt.extraCharge)}</span></div>}
                              {randomReceipt.hasExtraHr && <div className="flex justify-between"><span className="text-slate-500">Extra Hrs ({randomReceipt.extraHrVal}h):</span><span className="font-bold">+{formatINR(randomReceipt.extraHrCharge)}</span></div>}
                              {randomReceipt.logisticFee > 0 && <div className="flex justify-between"><span className="text-slate-500">Logistics (Del/Pic):</span><span className="font-bold">+{formatINR(randomReceipt.logisticFee)}</span></div>}
                              
                              <div className="flex justify-between mt-2 pt-2 border-t border-slate-100"><span className="text-slate-700 font-bold">Taxable Amt:</span><span className="font-bold">{formatINR(randomReceipt.taxable)}</span></div>
                              <div className="flex justify-between text-emerald-600"><span className="">GST ({taxRate}%):</span><span className="font-bold">+{formatINR(randomReceipt.taxAmt)}</span></div>
                              <div className="flex justify-between text-indigo-500"><span className="">Sec. Deposit:</span><span className="font-bold">+{formatINR(randomReceipt.deposit)}</span></div>
                           </div>

                           <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                              <span className="font-extrabold text-slate-700">TOTAL</span>
                              <span className="text-xl font-extrabold text-[#f04343]">{formatINR(randomReceipt.totalCollected)}</span>
                           </div>
                        </div>
                     )}
                  </div>
               </div>

            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}

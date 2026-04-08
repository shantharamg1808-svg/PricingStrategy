import React, { createContext, useContext, useMemo, useReducer, useCallback, useEffect } from 'react';

const GlobalPricingContext = createContext(null);

// Debounce utility
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Utility function for normalizing percentages
function normalizePercentages(obj) {
  const total = Object.values(obj).reduce((sum, val) => sum + (Number(val) || 0), 0);
  if (total === 0) return obj; 
  const normalized = {};
  for (const key in obj) { normalized[key] = ((Number(obj[key]) || 0) / total); }
  return normalized;
}

// --- VEHICLES DATABASE ---
const CAR_NAMES = [
  "Alto 800 VXI", "S-Presso VXI", "Wagon R VXI", "Swift VXI", "Glanza E", "Glanza S", "Tata Altroz", 
  "Nexon XM", "Swift VXI (Auto)", "Exter S", "Fronx Sigma", "Swift VXI 2025", "Glanza S (Auto)", 
  "Brezza VXI", "Exter S (Auto)", "Taisor E", "Taisor S", "Venue CRDI", "Marazzo M2", "2026 Venue HX5 1.2", 
  "Creta CRDI E", "Mahindra XUV 300", "Ertiga VXI", "Safari XZ+", "Safari XZA+", "Jeep Meridian", 
  "Alto K10 VXI", "i10", "Ignis Sigma", "Freestyle Trend", "i10 Nios", "Baleno Sigma", "Verna EX", 
  "Brezza LDI", "Punch IRA", "i20 Sportz", "Baleno Delta", "Taisor S (Auto)", "Punch IRA (Auto)", 
  "Venue Kappa", "Vitara Brezza LXI", "2026 Exter Smart Sunroof", "Vitara Brezza Hybrid VXI", 
  "Nexon XZ+", "Tata Nexon XZ+ D", "Ertiga VXI (Auto)", "Innova Crysta GX",
  "Exter EX 1.2 Kappa", "I 20 Magna"
];

// PRICES EXCLUSIVE OF GST
const RAW_WD = [
  [936.96, 1077.60, 1239.12, 1425.12], [1041.12, 1197.36, 1376.88, 1583.52], [1332.00, 1531.68, 1761.36, 2025.60],
  [1664.88, 1914.72, 2201.76, 2532.24], [1729.92, 1989.60, 2287.92, 2631.12], [1729.92, 1989.36, 2287.92, 2630.88],
  [1739.76, 2000.64, 2300.64, 2645.76], [1750.56, 2013.12, 2315.04, 2662.32], [1755.12, 2018.16, 2321.04, 2669.04],
  [2019.84, 2322.72, 2671.20, 3072.00], [2019.84, 2322.72, 2671.20, 3072.00], [2034.72, 2340.24, 2691.12, 3094.80],
  [2053.20, 2361.36, 2715.60, 3122.88], [2091.12, 2404.56, 2765.28, 3180.24], [2091.12, 2404.80, 2765.52, 3180.24],
  [2110.80, 2427.36, 2791.44, 3210.24], [2149.92, 2472.48, 2843.28, 3270.00], [2264.64, 2604.24, 2994.96, 3444.00],
  [2318.88, 2967.84, 4845.60, 6404.16], [2491.20, 2864.64, 3294.48, 3788.40], [2497.44, 2872.08, 3302.88, 3798.24],
  [2719.92, 3127.92, 3597.12, 4136.88], [3168.24, 3643.44, 4189.92, 4818.48], [3851.76, 4429.44, 5094.00, 5858.16],
  [4053.60, 4661.76, 5361.12, 6165.12], [5287.68, 6080.88, 6992.88, 8041.92], [1152.00, 1332.00, 1539.12, 1776.96],
  [1248.48, 1668.72, 2115.36, 2643.36], [1269.12, 1459.68, 1678.56, 1930.32], [1269.12, 1459.68, 1678.56, 1930.32],
  [1373.28, 1510.56, 1661.76, 2293.68], [1492.80, 1716.72, 1974.24, 2270.40], [1630.08, 1874.40, 2155.68, 2478.96],
  [1816.56, 2088.96, 2402.40, 2762.88], [1934.88, 2225.28, 2558.88, 2943.12], [2049.36, 2453.52, 3047.04, 3213.84],
  [2053.20, 2361.36, 2715.60, 3122.88], [2149.92, 2472.48, 2843.28, 3270.00], [2151.36, 2473.92, 2845.20, 3271.92],
  [2232.48, 2567.52, 2952.48, 3395.52], [2285.04, 2627.76, 3021.84, 3475.20], [2300.16, 2645.28, 3041.76, 3498.24],
  [2399.28, 2759.28, 3173.04, 3648.96], [2580.00, 2967.12, 3412.08, 3923.76], [2660.16, 3059.04, 3517.92, 4045.68],
  [3036.72, 3492.24, 4015.92, 4618.32], [4200.00, 4830.00, 5554.56, 6387.60],
  [1817.76, 2090.40, 2404.08, 2764.80], [2050.08, 2357.52, 2711.04, 3117.84]
];

const RAW_WE = [
  [1124.40, 1349.28, 1551.60, 1784.40], [1249.44, 1499.28, 1724.16, 1982.64], [1598.40, 1917.84, 2205.60, 2536.56],
  [1998.00, 2397.60, 2757.12, 3170.64], [2076.00, 2491.20, 2864.64, 3294.48], [2076.00, 2491.20, 2864.64, 3294.48],
  [2087.52, 2505.12, 2880.96, 3312.96], [2100.48, 2520.72, 2898.72, 3333.60], [2106.00, 2527.20, 2906.40, 3342.24],
  [2499.60, 2874.48, 3305.76, 3801.60], [2423.76, 2908.56, 3344.88, 3846.48], [2441.76, 2929.92, 3369.60, 3875.04],
  [2463.84, 2956.56, 3400.08, 3910.08], [2509.44, 3011.28, 3462.96, 3982.32], [2509.44, 3011.28, 3462.96, 3982.32],
  [2532.96, 3039.36, 3495.36, 4019.76], [2580.00, 3096.00, 3560.16, 4094.40], [2717.52, 3260.88, 3750.00, 4312.56],
  [3367.20, 4947.84, 8388.72, 9228.00], [2989.20, 3587.04, 4125.12, 4743.84], [2996.88, 3596.40, 4135.68, 4756.08],
  [3264.00, 3916.80, 4504.08, 5179.92], [3801.84, 4562.40, 5246.64, 6033.60], [4622.16, 5546.64, 6378.48, 7335.36],
  [4864.56, 5837.28, 6713.04, 7719.84], [6345.12, 7614.24, 8756.40, 10069.92], [1512.00, 1746.00, 2015.04, 2324.64],
  [1566.48, 2208.72, 3348.48, 3552.00], [1523.04, 1827.60, 2101.92, 2417.04], [1523.04, 1827.60, 2101.92, 2417.04],
  [1723.20, 1895.52, 2085.12, 2293.68], [1847.28, 2360.64, 2714.64, 3121.92], [1956.00, 2347.20, 2699.28, 3104.16],
  [2179.92, 2616.00, 3008.16, 3459.60], [2322.00, 2786.40, 3204.24, 3684.96], [2442.00, 3036.24, 3770.64, 3977.28],
  [2463.84, 2956.56, 3400.08, 3910.08], [2580.00, 3096.00, 3560.16, 4094.40], [2581.68, 3097.92, 3562.56, 4097.04],
  [2679.12, 3214.80, 3697.20, 4251.60], [2742.00, 3290.40, 3784.08, 4351.44], [2760.48, 3312.48, 3809.28, 4380.48],
  [2879.04, 3455.04, 3973.20, 4569.12], [3096.00, 3715.20, 4272.48, 4913.28], [3192.00, 3830.40, 4405.20, 5065.92],
  [3643.92, 4372.80, 5028.72, 5783.04], [5040.00, 6048.00, 6955.20, 7998.48],
  [2474.47, 2845.66, 3272.54, 3763.58], [2818.99, 3241.66, 3727.68, 4287.10]
];

const EXTRA_KM_RATES = [
  8, 8, 8, 8, 8, 8, 8, 11, 8, 11, 10, 8, 8, 11, 11, 10, 10, 11, 15, 11, 11, 11, 13, 15, 15, 20, 8, 8, 8, 8, 8, 8, 11, 11, 11, 8, 8, 10, 11, 11, 11, 11, 11, 11, 11, 13, 15,
  11, 8
];

const DEFAULT_CAR_WEIGHTS = {
  "Swift VXI": 117, "Fronx Sigma": 114, "Glanza S": 131, "Taisor S": 99, "Ignis Sigma": 87,
  "Ertiga VXI": 86, "S-Presso VXI": 81, "Baleno Sigma": 76, "Glanza E": 49, "Exter S": 48,
  "Swift VXI 2025": 32, "i10 Nios": 31, "Nexon XM": 28, "Wagon R VXI": 27, "Freestyle Trend": 22,
  "Brezza VXI": 33, "Tata Altroz": 19, "Taisor E": 18, "Venue CRDI": 17, "Marazzo M2": 17,
  "Vitara Brezza Hybrid VXI": 17, "Baleno Delta": 14, "Creta CRDI E": 13, "Innova Crysta GX": 15,
  "2026 Venue HX5 1.2": 13, "Mahindra XUV 300": 13, "Safari XZA+": 12, "Punch IRA": 12,
  "i20 Sportz": 14, "Alto 800 VXI": 11, "Safari XZ+": 11, "Vitara Brezza LXI": 11,
  "2026 Exter Smart Sunroof": 10, "Venue Kappa": 9, "Nexon XZ+": 8, "I 20 Magna": 8,
  "i10": 8, "Jeep Meridian": 5, "Brezza LDI": 1, "Exter EX 1.2 Kappa": 1, "Verna EX": 1
};

// EXACT HISTORICAL AGGREGATES FOR PERFECT MATH ALIGNMENT
const HISTORICAL_BOOKINGS = 1414;
const HISTORICAL_WD_HOURS = 26798.5;
const HISTORICAL_WE_HOURS = 45274.0;
const HISTORICAL_EXTRA_KM_REV = 393777.47;
const HISTORICAL_EXTRA_HR_REV = 465250;

const SLAB_KMS = [140, 320, 500, 620];
const RATIONAL_EXTRA_KM_LIMIT = 60;

function categorizeCar(name) {
  const n = name.toLowerCase();
  if (n.includes('creta') || n.includes('safari') || n.includes('meridian') || n.includes('marazzo') || n.includes('ertiga') || n.includes('innova')) return 'SUVs & 7-Seaters';
  if (n.includes('nexon') || n.includes('exter') || n.includes('fronx') || n.includes('brezza') || n.includes('taisor') || n.includes('venue') || n.includes('xuv')) return 'Compact SUVs';
  return 'Hatchbacks & Minis'; 
}

const CARS_DB = CAR_NAMES.map((name, index) => {
  const ogWd = RAW_WD[index];
  const ogWe = RAW_WE[index];

  // Linear Regression Logic (For Scenario B interpolation)
  const wdRate0 = (ogWd[1] - ogWd[0]) / (SLAB_KMS[1] - SLAB_KMS[0]);
  const wdBase0 = ogWd[0] - (wdRate0 * SLAB_KMS[0]);
  const weRate0 = (ogWe[1] - ogWe[0]) / (SLAB_KMS[1] - SLAB_KMS[0]);
  const weBase0 = ogWe[0] - (weRate0 * SLAB_KMS[0]);

  const wdRate1 = (ogWd[2] - ogWd[1]) / (SLAB_KMS[2] - SLAB_KMS[1]);
  const wdBase1 = ogWd[1] - (wdRate1 * SLAB_KMS[1]);
  const weRate1 = (ogWe[2] - ogWe[1]) / (SLAB_KMS[2] - SLAB_KMS[1]);
  const weBase1 = ogWe[1] - (weRate1 * SLAB_KMS[1]);

  const wdRate2 = (ogWd[3] - ogWd[2]) / (SLAB_KMS[3] - SLAB_KMS[2]);
  const wdBase2 = ogWd[2] - (wdRate2 * SLAB_KMS[2]);
  const weRate2 = (ogWe[3] - ogWe[2]) / (SLAB_KMS[3] - SLAB_KMS[2]);
  const weBase2 = ogWe[2] - (weRate2 * SLAB_KMS[2]);

  let deposit = 1500;
  if (["Safari XZA+", "Innova Crysta GX", "Safari XZ+", "Marazzo M2"].includes(name)) deposit = 3000;
  if (name === "Jeep Meridian") deposit = 8000;

  return {
    id: index, name, category: categorizeCar(name), extraRate: EXTRA_KM_RATES[index] || 8, deposit,
    slabs: [
      { km: SLAB_KMS[0], rate: wdRate0, basePrice: wdBase0, ogWd: ogWd[0], weekendRate: weRate0, weekendBase: weBase0, ogWe: ogWe[0] },
      { km: SLAB_KMS[1], rate: wdRate1, basePrice: wdBase1, ogWd: ogWd[1], weekendRate: weRate1, weekendBase: weBase1, ogWe: ogWe[1] },
      { km: SLAB_KMS[2], rate: wdRate2, basePrice: wdBase2, ogWd: ogWd[2], weekendRate: weRate2, weekendBase: weBase2, ogWe: ogWe[2] },
      { km: SLAB_KMS[3], rate: wdRate2, basePrice: wdBase2, ogWd: ogWd[3], weekendRate: weRate2, weekendBase: weBase2, ogWe: ogWe[3] },
    ]
  };
});

const defaultPackages = [
  { id: 'p1', km: '110', share: '25' },
  { id: 'p2', km: '220', share: '30' },
  { id: 'p3', km: '410', share: '20' },
  { id: 'p4', km: '520', share: '15' },
  { id: 'p5', km: '720', share: '10' }
];

const initialState = {
  activePage: 'calculator',
  modelType: 4,
  packages: defaultPackages,
  globalModifier: '0',
  modifierSelection: ['p1', 'p2', 'p3', 'p4'],
  overrides: {},
  vehicles: CARS_DB,
  historicalData: {
    bookings: HISTORICAL_BOOKINGS,
    wdHours: HISTORICAL_WD_HOURS,
    weHours: HISTORICAL_WE_HOURS,
    extraKmRev: HISTORICAL_EXTRA_KM_REV,
    extraHrRev: HISTORICAL_EXTRA_HR_REV
  },
  defaultCarWeights: DEFAULT_CAR_WEIGHTS,
  constants: {
    slabKms: SLAB_KMS,
    rationalExtraKmLimit: RATIONAL_EXTRA_KM_LIMIT
  }
};

function reducer(state, action) {
  let newState;
  switch (action.type) {
    case 'SET_ACTIVE_PAGE':
      newState = { ...state, activePage: action.value };
      break;
    case 'SET_MODEL_TYPE':
      newState = { ...state, modelType: Number(action.value) || 0 };
      break;
    case 'UPDATE_PACKAGE_KM':
      newState = {
        ...state,
        packages: state.packages.map(pkg => pkg.id === action.id ? { ...pkg, km: action.value === '' ? '' : String(action.value) } : pkg)
      };
      break;
    case 'UPDATE_PACKAGE_SHARE':
      newState = {
        ...state,
        packages: state.packages.map(pkg => pkg.id === action.id ? { ...pkg, share: action.value === '' ? '' : String(action.value) } : pkg)
      };
      break;
    case 'SET_PACKAGES':
      newState = {
        ...state,
        packages: Array.isArray(action.packages) ? action.packages.map(pkg => ({ ...pkg, km: pkg.km === '' ? '' : String(pkg.km), share: pkg.share === '' ? '' : String(pkg.share) })) : state.packages
      };
      break;
    case 'RESET_PACKAGES_TO_DEFAULT':
      newState = { ...state, packages: defaultPackages };
      break;
    case 'SET_GLOBAL_MODIFIER':
      newState = { ...state, globalModifier: action.value === '' ? '' : String(action.value) };
      break;
    case 'SET_MODIFIER_SELECTION':
      newState = { ...state, modifierSelection: Array.isArray(action.value) ? action.value : state.modifierSelection };
      break;
    case 'TOGGLE_MODIFIER_SELECTION':
      newState = {
        ...state,
        modifierSelection: state.modifierSelection.includes(action.pkgId)
          ? state.modifierSelection.filter(id => id !== action.pkgId)
          : [...state.modifierSelection, action.pkgId]
      };
      break;
    case 'SET_OVERRIDE': {
      const existing = state.overrides[action.key] || {};
      newState = {
        ...state,
        overrides: {
          ...state.overrides,
          [action.key]: {
            ...existing,
            [action.field]: action.value === '' ? '' : Number(action.value)
          }
        }
      };
      break;
    }
    case 'CLEAR_OVERRIDES':
      newState = { ...state, overrides: {} };
      break;
    case 'UPDATE_VEHICLE_WEIGHT':
      newState = {
        ...state,
        defaultCarWeights: {
          ...state.defaultCarWeights,
          [action.vehicleName]: action.weight
        }
      };
      break;
    default:
      return state;
  }

  // Persist to localStorage
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('globalPricingState', JSON.stringify({
        packages: newState.packages,
        globalModifier: newState.globalModifier,
        modifierSelection: newState.modifierSelection,
        overrides: newState.overrides,
        defaultCarWeights: newState.defaultCarWeights,
        activePage: newState.activePage,
        modelType: newState.modelType
      }));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }

  return newState;
}

export function GlobalPricingProvider({ children }) {
  const getInitialState = () => {
    if (typeof localStorage === 'undefined') return initialState;
    
    try {
      const saved = localStorage.getItem('globalPricingState');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...initialState, ...parsed };
      }
    } catch (error) {
      console.warn('Failed to load from localStorage:', error);
    }
    return initialState;
  };

  const [state, dispatch] = useReducer(reducer, null, getInitialState);

  const debouncedDispatch = useCallback(
    debounce((action) => {
      dispatch(action);
    }, 150),
    []
  );

  const immediateDispatch = useCallback((action) => {
    dispatch(action);
  }, []);

  const value = useMemo(() => ({ 
    state, 
    dispatch: debouncedDispatch,
    immediateDispatch 
  }), [state, debouncedDispatch, immediateDispatch]);

  return <GlobalPricingContext.Provider value={value}>{children}</GlobalPricingContext.Provider>;
}

export function usePricingStore() {
  const context = useContext(GlobalPricingContext);
  if (!context) {
    throw new Error('usePricingStore must be used inside GlobalPricingProvider');
  }
  return context;
}

export { normalizePercentages };

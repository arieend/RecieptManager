
export interface StorageSettings {
  storagePath: string;
  directories: {
    year: boolean;
    month: boolean;
    day: boolean;
  };
  autoSave: boolean;
  syncToSheets: boolean;
  spreadsheetId: string;
  spreadsheetName: string;
  currency: 'USD' | 'EUR' | 'ILS';
  theme: 'light' | 'dark';
}

const DEFAULT_SETTINGS: StorageSettings = {
  storagePath: 'Google Drive:\\Receipts',
  directories: {
    year: true,
    month: true,
    day: false
  },
  autoSave: true,
  syncToSheets: true,
  spreadsheetId: '',
  spreadsheetName: 'Receipts Database',
  currency: 'ILS',
  theme: 'light'
};

const SETTINGS_KEY = 'receipt_storage_settings';

export const getSettings = (): StorageSettings => {
  const saved = localStorage.getItem(SETTINGS_KEY);
  if (saved) {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch (e) {
      console.error("Failed to parse settings", e);
    }
  }
  return DEFAULT_SETTINGS;
};

export const saveSettings = (settings: StorageSettings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const transliterate = (text: string): string => {
  // Normalize to decompose combined characters (like é to e + ´)
  // then remove the combining marks
  let normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const charMap: { [key: string]: string } = {
    // Hebrew
    'א': 'a', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h', 'ו': 'v', 'ז': 'z', 'ח': 'ch', 'ט': 't', 'י': 'y',
    'כ': 'k', 'ך': 'k', 'ל': 'l', 'מ': 'm', 'ם': 'm', 'נ': 'n', 'ן': 'n', 'ס': 's', 'ע': 'a', 'פ': 'p',
    'ף': 'p', 'צ': 'ts', 'ץ': 'ts', 'ק': 'q', 'ר': 'r', 'ש': 'sh', 'ת': 't',
    // Cyrillic
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh', 'з': 'z', 'и': 'i', 
    'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 
    'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 
    'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo', 'Ж': 'Zh', 'З': 'Z', 'И': 'I', 
    'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 
    'У': 'U', 'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch', 'Ъ': '', 'Ы': 'Y', 
    'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
  };

  return normalized.split('').map(char => charMap[char] || char).join('');
};

export const sanitizeFilename = (name: string): string => {
  // Transliterate non-English characters (specifically Hebrew)
  const transliterated = transliterate(name);
  // Remove illegal characters for most filesystems and replace spaces with underscores
  return transliterated.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');
};

export const formatDateTimeForFilename = (date: Date): string => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const d = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const t = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `${d}_${t}`;
};

export const formatDateForSheets = (date: Date, pattern: string = 'DD/MM/YYYY'): string => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = date.getFullYear().toString();
  const shortYear = year.slice(-2);
  const shortDay = date.getDate().toString();
  const shortMonth = (date.getMonth() + 1).toString();

  const normalized = (pattern || 'DD/MM/YYYY').toUpperCase().trim();

  // Match ISO / YYYY-MM-DD
  if (normalized.includes('YYYY-MM-DD') || normalized === 'YYYY-MM-DD') {
    return `${year}-${month}-${day}`;
  }
  if (normalized.includes('YYYY/MM/DD') || normalized === 'YYYY/MM/DD') {
    return `${year}/${month}/${day}`;
  }

  // Match MM/DD/YYYY or M/D/YYYY
  if (normalized === 'M/D/YYYY' || normalized === 'M/D/YY') {
    return `${shortMonth}/${shortDay}/${normalized.includes('YYYY') ? year : shortYear}`;
  }
  if (normalized.startsWith('MM/DD') || normalized.startsWith('M/D') || normalized === 'MM/DD/YYYY' || normalized === 'MM/DD/YY') {
    return `${month}/${day}/${normalized.includes('YYYY') ? year : shortYear}`;
  }

  // Match DD.MM.YYYY
  if (normalized.includes('.')) {
    if (normalized.startsWith('D.')) {
      return `${shortDay}.${shortMonth}.${year}`;
    }
    return `${day}.${month}.${year}`;
  }

  // Match DD-MM-YYYY
  if (normalized.includes('-') && normalized.startsWith('DD')) {
    return `${day}-${month}-${year}`;
  }

  // Match D/M/YYYY
  if (normalized === 'D/M/YYYY' || normalized === 'D/M/YY') {
    return `${shortDay}/${shortMonth}/${normalized.includes('YYYY') ? year : shortYear}`;
  }

  // Default: DD/MM/YYYY without leading quote so Sheets parses as a native date
  return `${day}/${month}/${year}`;
};

export const buildDirectoryPath = (settings: StorageSettings, date: Date): string[] => {
  // Split the storage path by backslash or forward slash
  const pathParts = settings.storagePath.split(/[\\/]/).filter(p => p.trim() !== '' && p !== 'Google Drive:');
  
  if (settings.directories.year) {
    pathParts.push(date.getFullYear().toString());
  }
  if (settings.directories.month) {
    pathParts.push((date.getMonth() + 1).toString().padStart(2, '0'));
  }
  if (settings.directories.day) {
    pathParts.push(date.getDate().toString().padStart(2, '0'));
  }
  
  return pathParts;
};

export const getCurrencySymbol = (currency: string): string => {
  switch (currency) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'ILS': return '₪';
    default: return '₪';
  }
};

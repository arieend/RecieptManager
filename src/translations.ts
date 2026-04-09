export type Language = 'en' | 'he';

export interface Translations {
  appTitle: string;
  currency: string;
  language: string;
  history: string;
  profile: string;
  logout: string;
  reset: string;
  uploadTitle: string;
  uploadDesc: string;
  chooseReceipt: string;
  parsingReceipt: string;
  receiptItems: string;
  addPerson: string;
  addItem: string;
  itemsCount: string;
  tax: string;
  tip: string;
  total: string;
  saveSession: string;
  saving: string;
  sessionSaved: string;
  personTotals: string;
  subtotal: string;
  taxTip: string;
  chatPlaceholder: string;
  welcomeMessage: string;
  parseErrorMessage: string;
  commandErrorMessage: string;
  historyTitle: string;
  noHistory: string;
  cleanHistory: string;
  cleanHistoryConfirm: string;
  deleteSession: string;
  deleteSessionConfirm: string;
  profileTitle: string;
  displayName: string;
  updateProfile: string;
  updating: string;
  resetConfirm: string;
  deleteItemConfirm: string;
  enterPersonName: string;
  enterItemName: string;
  enterItemPrice: string;
  editItem: string;
  unassigned: string;
  loginWithGoogle: string;
  editItemName: string;
  editItemPrice: string;
  itemName: string;
  itemPrice: string;
  newReceipt: string;
  viewOriginal: string;
  takePhoto: string;
  clearAll: string;
  driveStatus: string;
  driveConnected: string;
  driveDisconnected: string;
  reconnectDrive: string;
  welcome: string;
  user: string;
  readyToSplit: string;
  scanReceipt: string;
  uploadFile: string;
  recentHistory: string;
  viewAll: string;
  unknownStore: string;
  items: string;
  startScanning: string;
  summary: string;
  totalAmount: string;
  people: string;
  aiAssistant: string;
  aiHint: string;
  typeCommand: string;
  accountSettings: string;
  emailNotifications: string;
  enabled: string;
  privacySecurity: string;
  managedByGoogle: string;
  dangerZone: string;
  completed: string;
  invalidPrice: string;
  confirm: string;
  cancel: string;
  cameraPermissionDenied: string;
  cameraPermissionDismissed: string;
  cameraGenericError: string;
  howToEnableCamera: string;
  noImage: string;
  settings: string;
  storagePath: string;
  directoryStructure: string;
  year: string;
  month: string;
  day: string;
  autoSave: string;
  assignHint: string;
  saveSettings: string;
  settingsSaved: string;
  usd: string;
  eur: string;
  ils: string;
  syncToSheets: string;
  spreadsheetName: string;
  spreadsheetNameHelp: string;
  spreadsheetId: string;
  spreadsheetIdHelp: string;
  spreadsheetIdPlaceholder: string;
  exchangeRate: string;
  convertedTo: string;
  nisEquivalent: string;
  creatingSpreadsheet: string;
  categoryBreakdown: string;
  assignedProgress: string;
  unassignedAmount: string;
  taxTipDetails: string;
  category: string;
  labels: string;
  tags: string;
  regenerateAI: string;
  regenerating: string;
  personName: string;
  openInDrive: string;
  viewOnDrive: string;
  viewInSheets: string;
  cropTitle: string;
  smartCrop: string;
  manualCrop: string;
  addPart: string;
  finishScan: string;
  stitching: string;
  longReceiptMode: string;
  singleReceiptMode: string;
  sheetsApiDisabled: string;
  quantity: string;
  quotaExceeded: string;
  quotaExceededDesc: string;
  offlineMode: string;
  offlineDesc: string;
  installApp: string;
  installAppDesc: string;
  batchProcessing: string;
  processingFile: string;
  of: string;
  processFolder: string;
  selectFiles: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    appTitle: "Receipt Manager",
    currency: "Currency",
    language: "Language",
    history: "History",
    profile: "Profile",
    logout: "Logout",
    reset: "Reset",
    uploadTitle: "Upload a Receipt",
    uploadDesc: "Snap a photo or upload a PDF of your bill and our AI will parse the items and prices for you.",
    chooseReceipt: "Choose Receipt",
    parsingReceipt: "Parsing Receipt...",
    receiptItems: "Receipt Items",
    addPerson: "Add Label",
    addItem: "Add Item",
    itemsCount: "items",
    tax: "Tax",
    tip: "Tip",
    total: "Total",
    saveSession: "Save Session",
    saving: "Saving...",
    sessionSaved: "Session saved to history!",
    personTotals: "Label Totals",
    subtotal: "Sub",
    taxTip: "Tax/Tip",
    chatPlaceholder: "Type a command (e.g., 'Label the burger as Food')...",
    welcomeMessage: "I've parsed your receipt! You can now assign items to labels by typing commands like 'Label the nachos as Snacks' or 'The pizza is for Dinner'.",
    parseErrorMessage: "Sorry, I had trouble parsing that receipt. Please try again with a clearer image.",
    commandErrorMessage: "I didn't quite catch that. Could you try rephrasing? For example: 'John had the burger'.",
    historyTitle: "Session History",
    noHistory: "No saved sessions yet.",
    cleanHistory: "Clean History",
    cleanHistoryConfirm: "Are you sure you want to delete all your history?",
    deleteSession: "Delete Session",
    deleteSessionConfirm: "Are you sure you want to delete this session?",
    profileTitle: "User Profile",
    displayName: "Display Name",
    updateProfile: "Update Profile",
    updating: "Updating...",
    resetConfirm: "Reset everything?",
    deleteItemConfirm: "Delete this item?",
    enterPersonName: "Enter label name:",
    enterItemName: "Enter item name:",
    enterItemPrice: "Enter item price:",
    editItem: "Edit Item",
    unassigned: "Unassigned",
    loginWithGoogle: "Login with Google",
    editItemName: "Edit item name:",
    editItemPrice: "Edit price:",
    itemName: "Item name:",
    itemPrice: "Price:",
    newReceipt: "New Receipt",
    viewOriginal: "View Original",
    takePhoto: "Take Photo",
    clearAll: "Clear All",
    driveStatus: "Google Drive Status",
    driveConnected: "Connected",
    driveDisconnected: "Disconnected",
    reconnectDrive: "Connect Google Drive",
    welcome: "Welcome",
    user: "User",
    readyToSplit: "Ready to split some bills?",
    scanReceipt: "Scan Receipt",
    uploadFile: "Upload File",
    recentHistory: "Recent History",
    viewAll: "View All",
    unknownStore: "Unknown Store",
    items: "items",
    startScanning: "Start Scanning",
    summary: "Summary",
    totalAmount: "Total Amount",
    people: "Labels",
    aiAssistant: "AI Assistant",
    aiHint: "You can ask me to assign items or add new ones. For example: 'Assign the burger to Food'.",
    typeCommand: "Type a command...",
    accountSettings: "Account Settings",
    emailNotifications: "Email Notifications",
    enabled: "Enabled",
    privacySecurity: "Privacy & Security",
    managedByGoogle: "Managed by Google",
    dangerZone: "Danger Zone",
    completed: "Completed",
    invalidPrice: "Please enter a valid positive number for the price.",
    confirm: "Confirm",
    cancel: "Cancel",
    cameraPermissionDenied: "Camera access was denied. Please enable it in your browser settings to scan receipts.",
    cameraPermissionDismissed: "Camera permission request was dismissed. Please try again and grant access.",
    cameraGenericError: "Could not access camera. Please ensure your device has a camera and permissions are granted.",
    howToEnableCamera: "To enable: Click the lock icon in your browser's address bar and set Camera to 'Allow'.",
    noImage: "No image available for this session.",
    settings: "Settings",
    storagePath: "Storage Path",
    directoryStructure: "Directory Structure",
    year: "Year",
    month: "Month",
    day: "Day",
    autoSave: "Auto-Save immediately after extraction",
    assignHint: "Click on a label under an item to assign its cost. If multiple labels are selected, the cost is split equally.",
    saveSettings: "Save Settings",
    settingsSaved: "Settings saved successfully!",
    usd: "USD ($)",
    eur: "EUR (€)",
    ils: "NIS (₪)",
    syncToSheets: "Sync to Google Sheets",
    spreadsheetName: "Spreadsheet Name",
    spreadsheetNameHelp: "The app will look for an existing spreadsheet with this name. If not found, it will create a new one.",
    spreadsheetId: "Spreadsheet ID",
    spreadsheetIdHelp: "Optional. If you want to use a specific sheet, enter its ID from the URL: https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit",
    spreadsheetIdPlaceholder: "Leave empty to find by name",
    exchangeRate: "Exchange Rate (to NIS)",
    convertedTo: "Converted to NIS",
    nisEquivalent: "NIS Equivalent",
    creatingSpreadsheet: "Creating Receipts Database...",
    categoryBreakdown: "Category Breakdown",
    assignedProgress: "Assignment Progress",
    unassignedAmount: "Unassigned Amount",
    taxTipDetails: "Tax & Tip Details",
    category: "Category",
    labels: "Labels",
    tags: "Tags",
    regenerateAI: "Regenerate AI Data",
    regenerating: "Regenerating...",
    personName: "Label name:",
    openInDrive: "Open in Google Drive",
    viewOnDrive: "View on Google Drive",
    viewInSheets: "View in Google Sheets",
    cropTitle: "Crop Receipt",
    smartCrop: "Smart Crop",
    manualCrop: "Manual Crop",
    addPart: "Add Next Part",
    finishScan: "Finish & Stitch",
    stitching: "Stitching parts...",
    longReceiptMode: "Long Receipt Mode",
    singleReceiptMode: "Single Page Mode",
    sheetsApiDisabled: "Google Sheets API is disabled. Please enable it in your Google Cloud Console to use this feature.",
    quantity: "Qty",
    quotaExceeded: "Daily Limit Reached",
    quotaExceededDesc: "You've reached the daily free limit for database reads. History updates are paused until tomorrow.",
    offlineMode: "Offline Mode",
    offlineDesc: "You are currently offline. You can view your history, but scanning and syncing are disabled.",
    installApp: "Install App",
    installAppDesc: "Install Receipt Manager on your device for a better experience.",
    batchProcessing: "Batch Processing",
    processingFile: "Processing file",
    of: "of",
    processFolder: "Process Folder",
    selectFiles: "Select Files",
  },
  he: {
    appTitle: "מנהל חשבוניות",
    currency: "מטבע",
    language: "שפה",
    history: "היסטוריה",
    profile: "פרופיל",
    logout: "התנתקות",
    reset: "איפוס",
    uploadTitle: "העלאת קבלה",
    uploadDesc: "צלמו תמונה או העלו PDF של החשבון והבינה המלאכותית שלנו תנתח את הפריטים והמחירים עבורכם.",
    chooseReceipt: "בחר קבלה",
    parsingReceipt: "מנתח קבלה...",
    receiptItems: "פריטי קבלה",
    addPerson: "הוסף תווית",
    addItem: "הוסף פריט",
    itemsCount: "פריטים",
    tax: "מס",
    tip: "טיפ",
    total: "סה\"כ",
    saveSession: "שמור סשן",
    saving: "שומר...",
    sessionSaved: "הסשן נשמר בהיסטוריה!",
    personTotals: "סיכומי תוויות",
    subtotal: "סיכום ביניים",
    taxTip: "מס/טיפ",
    chatPlaceholder: "הקלידו פקודה (למשל, 'תייג את ההמבורגר כאוכל')...",
    welcomeMessage: "ניתחתי את הקבלה שלך! עכשיו אפשר לשייך פריטים לתוויות על ידי הקלדת פקודות כמו 'תייג את הנאצ'וס כנשנושים' או 'הפיצה היא לארוחת ערב'.",
    parseErrorMessage: "מצטערים, הייתה בעיה בניתוח הקבלה. אנא נסו שוב עם תמונה ברורה יותר.",
    commandErrorMessage: "לא ממש הבנתי. אפשר לנסות לנסח מחדש? למשל: 'יוסי אכל את ההמבורגר'.",
    historyTitle: "היסטוריית סשנים",
    noHistory: "אין סשנים שמורים עדיין.",
    cleanHistory: "נקה היסטוריה",
    cleanHistoryConfirm: "האם אתה בטוח שברצונך למחוק את כל ההיסטוריה?",
    deleteSession: "מחק סשן",
    deleteSessionConfirm: "האם אתה בטוח שברצונך למחוק סשן זה?",
    profileTitle: "פרופיל משתמש",
    displayName: "שם תצוגה",
    updateProfile: "עדכן פרופיל",
    updating: "מעדכן...",
    resetConfirm: "לאפס הכל?",
    deleteItemConfirm: "למחוק פריט זה?",
    enterPersonName: "הזינו שם תווית:",
    enterItemName: "הזינו שם פריט:",
    enterItemPrice: "הזינו מחיר פריט:",
    editItem: "ערוך פריט",
    unassigned: "לא משויך",
    loginWithGoogle: "התחברות עם גוגל",
    editItemName: "ערוך שם פריט:",
    editItemPrice: "ערוך מחיר:",
    itemName: "שם פריט:",
    itemPrice: "מחיר:",
    newReceipt: "קבלה חדשה",
    viewOriginal: "צפה במקור",
    takePhoto: "צלם קבלה",
    clearAll: "נקה הכל",
    driveStatus: "סטטוס Google Drive",
    driveConnected: "מחובר",
    driveDisconnected: "מנותק",
    reconnectDrive: "חבר את Google Drive",
    welcome: "ברוכים הבאים",
    user: "משתמש",
    readyToSplit: "מוכנים לחלק כמה חשבונות?",
    scanReceipt: "סרוק קבלה",
    uploadFile: "העלה קובץ",
    recentHistory: "היסטוריה אחרונה",
    viewAll: "צפה בהכל",
    unknownStore: "חנות לא ידועה",
    items: "פריטים",
    startScanning: "התחל לסרוק",
    summary: "סיכום",
    totalAmount: "סכום כולל",
    people: "תוויות",
    aiAssistant: "עוזר בינה מלאכותית",
    aiHint: "אפשר לבקש ממני לשייך פריטים או להוסיף חדשים. למשל: 'שייך את ההמבורגר לאוכל'.",
    typeCommand: "הקלד פקודה...",
    accountSettings: "הגדרות חשבון",
    emailNotifications: "התראות אימייל",
    enabled: "פעיל",
    privacySecurity: "פרטיות ואבטחה",
    managedByGoogle: "מנוהל על ידי גוגל",
    dangerZone: "אזור סכנה",
    completed: "הושלם",
    invalidPrice: "אנא הזינו מספר חיובי תקין עבור המחיר.",
    confirm: "אישור",
    cancel: "ביטול",
    cameraPermissionDenied: "הגישה למצלמה נדחתה. אנא אפשרו גישה בהגדרות הדפדפן כדי לסרוק קבלות.",
    cameraPermissionDismissed: "בקשת ההרשאה למצלמה נסגרה. אנא נסו שוב ואשרו את הגישה.",
    cameraGenericError: "לא ניתן לגשת למצלמה. וודאו שיש לכם מצלמה תקינה ושהרשאות ניתנו.",
    howToEnableCamera: "כדי לאפשר: לחצו על סמל המנעול בשורת הכתובת של הדפדפן והגדירו את המצלמה ל-'אפשר'.",
    noImage: "אין תמונה זמינה לסשן זה.",
    settings: "הגדרות",
    storagePath: "נתיב אחסון",
    directoryStructure: "מבנה תיקיות",
    year: "שנה",
    month: "חודש",
    day: "יום",
    autoSave: "שמירה אוטומטית מיד לאחר הניתוח",
    assignHint: "לחץ על תווית מתחת לפריט כדי לשייך את עלותו. אם נבחרו מספר תוויות, העלות תחולק שווה בשווה.",
    saveSettings: "שמור הגדרות",
    settingsSaved: "ההגדרות נשמרו בהצלחה!",
    usd: "דולר ($)",
    eur: "אירו (€)",
    ils: "שקל (₪)",
    syncToSheets: "סנכרון ל-Google Sheets",
    spreadsheetName: "שם הגיליון",
    spreadsheetNameHelp: "האפליקציה תחפש גיליון קיים בשם זה. אם לא יימצא, ייווצר גיליון חדש.",
    spreadsheetId: "מזהה גיליון (Spreadsheet ID)",
    spreadsheetIdHelp: "אופציונלי. אם ברצונך להשתמש בגיליון ספציפי, הזן את המזהה שלו מהכתובת: https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit",
    spreadsheetIdPlaceholder: "השאר ריק לחיפוש לפי שם",
    exchangeRate: "שער חליפין (לשקל)",
    convertedTo: "הומר לשקלים",
    nisEquivalent: "שווה ערך בשקלים",
    creatingSpreadsheet: "יוצר מאגר נתוני קבלות...",
    categoryBreakdown: "פירוט לפי קטגוריות",
    assignedProgress: "התקדמות שיוך",
    unassignedAmount: "סכום שלא שויך",
    taxTipDetails: "פירוט מס וטיפ",
    category: "קטגוריה",
    labels: "תוויות",
    tags: "תגיות",
    regenerateAI: "רענן נתוני בינה מלאכותית",
    regenerating: "מרענן...",
    personName: "שם תווית:",
    openInDrive: "פתח ב-Google Drive",
    viewOnDrive: "צפה ב-Google Drive",
    viewInSheets: "צפה ב-Google Sheets",
    cropTitle: "חיתוך קבלה",
    smartCrop: "חיתוך חכם",
    manualCrop: "חיתוך ידני",
    addPart: "הוסף חלק הבא",
    finishScan: "סיום וחיבור",
    stitching: "מחבר חלקים...",
    longReceiptMode: "מצב קבלה ארוכה",
    singleReceiptMode: "מצב דף בודד",
    sheetsApiDisabled: "Google Sheets API כבוי. אנא הפעל אותו בקונסולת Google Cloud כדי להשתמש בתכונה זו.",
    quantity: "כמות",
    quotaExceeded: "הגעת למכסה היומית",
    quotaExceededDesc: "הגעת למגבלת הקריאות היומית בחינם. עדכוני ההיסטוריה מושהים עד מחר.",
    offlineMode: "מצב לא מקוון",
    offlineDesc: "אתה כרגע לא מחובר לאינטרנט. ניתן לצפות בהיסטוריה, אך סריקה וסנכרון מושבתים.",
    installApp: "התקן אפליקציה",
    installAppDesc: "התקן את מנהל החשבוניות על המכשיר שלך לחוויה טובה יותר.",
    batchProcessing: "עיבוד קבוצתי",
    processingFile: "מעבד קובץ",
    of: "מתוך",
    processFolder: "עבד תיקייה",
    selectFiles: "בחר קבצים",
  }
};

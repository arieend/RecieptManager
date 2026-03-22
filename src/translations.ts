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
  }
};

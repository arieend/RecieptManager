import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calculator } from 'lucide-react';
import { Card } from './ui/Base';
import { Totals } from '../utils/calculations';
import { Language, Translations } from '../translations';

interface SummaryCardProps {
  totals: Totals;
  language: Language;
  translations: Record<Language, Translations>;
  currencySymbol: string;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ totals, language, translations, currencySymbol }) => {
  const [summaryTab, setSummaryTab] = useState<'people' | 'categories' | 'tags'>('people');
  const t = translations[language];

  return (
    <Card className="p-6 bg-emerald-600 text-white border-none shadow-xl shadow-emerald-200 overflow-hidden relative">
      {/* Progress Bar Background */}
      <div className="absolute top-0 left-0 w-full h-1 bg-white/20">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${totals.progress}%` }}
          className="h-full bg-white"
        />
      </div>

      <div className="flex justify-between items-start mb-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full w-fit">
            <Calculator size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">{t.summary}</span>
          </div>
          <p className="text-[10px] font-bold opacity-70 px-1">
            {t.assignedProgress}: {Math.round(isNaN(totals.progress) ? 0 : totals.progress)}%
          </p>
        </div>
        <div className="text-right">
          <p className="text-4xl font-black">{currencySymbol}{totals.total.toFixed(2)}</p>
          <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{t.totalAmount}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2 no-scrollbar">
        {[
          { id: 'people', label: t.people },
          { id: 'categories', label: t.categoryBreakdown },
          { id: 'tags', label: t.tags }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setSummaryTab(tab.id as any)}
            className={`whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${summaryTab === tab.id ? 'bg-white text-emerald-700' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      <div className="space-y-2">
        <AnimatePresence mode="wait">
          <motion.div 
            key={summaryTab}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-2"
          >
            {summaryTab === 'people' && (
              <>
                {totals.personTotals.map((p) => (
                  <div key={p.id} className="flex justify-between items-center bg-white/10 p-3 rounded-2xl">
                    <span className="font-bold">{p.name}</span>
                    <span className="font-black text-lg">{currencySymbol}{p.amount.toFixed(2)}</span>
                  </div>
                ))}
                {totals.unassignedAmount > 0.01 && (
                  <div className="flex justify-between items-center bg-red-400/20 p-3 rounded-2xl border border-red-400/30">
                    <span className="font-bold opacity-80 italic">{t.unassignedAmount}</span>
                    <span className="font-black text-lg">{currencySymbol}{totals.unassignedAmount.toFixed(2)}</span>
                  </div>
                )}
              </>
            )}
            {summaryTab === 'categories' && totals.categoryTotals.map((c) => (
              <div key={c.name} className="flex justify-between items-center bg-white/10 p-3 rounded-2xl">
                <span className="font-bold">{c.name}</span>
                <span className="font-black text-lg">{currencySymbol}{c.amount.toFixed(2)}</span>
              </div>
            ))}
            {summaryTab === 'tags' && totals.tagTotals.map((tag) => (
              <div key={tag.name} className="flex justify-between items-center bg-white/10 p-3 rounded-2xl">
                <span className="font-bold">#{tag.name}</span>
                <span className="font-black text-lg">{currencySymbol}{tag.amount.toFixed(2)}</span>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Tax/Tip Details */}
      {(totals.tax > 0 || totals.tip > 0) && (
        <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-center text-[10px] font-bold uppercase tracking-widest opacity-70">
          <span>{t.taxTipDetails}</span>
          <div className="flex gap-4">
            {totals.tax > 0 && <span>{t.tax}: {currencySymbol}{totals.tax.toFixed(2)}</span>}
            {totals.tip > 0 && <span>{t.tip}: {currencySymbol}{totals.tip.toFixed(2)}</span>}
          </div>
        </div>
      )}
    </Card>
  );
};

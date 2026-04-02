import React from 'react';
import { Card } from './ui/Base';
import { ReceiptItem, Person } from '../types';

interface ItemCardProps {
  item: ReceiptItem;
  people: Person[];
  currencySymbol: string;
  onToggleAssignment: (itemId: string, personId: string) => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  translations: any;
}

export const ItemCard: React.FC<ItemCardProps> = ({ 
  item, people, currencySymbol, onToggleAssignment, onUpdateQuantity, translations 
}) => {
  return (
    <Card className="p-4 space-y-4">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h4 className="font-bold text-slate-900">{item.name}</h4>
          <div className="flex flex-wrap gap-1 mt-1">
            {item.category && (
              <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                {item.category}
              </span>
            )}
            {(item.labels || []).map((label, lIdx) => (
              <span key={lIdx} className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                #{label}
              </span>
            ))}
          </div>
          
          <div className="flex items-center gap-4 mt-2">
            <p className="text-sm font-black text-emerald-600">{currencySymbol}{item.price.toFixed(2)}</p>
            
            <div className="flex items-center bg-slate-100 rounded-lg px-2 py-1 gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{translations.quantity}</span>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                  className="w-5 h-5 flex items-center justify-center bg-white rounded-md text-slate-600 hover:bg-slate-200 transition-colors text-xs font-bold shadow-sm"
                >
                  -
                </button>
                <span className="text-xs font-black text-slate-700 min-w-[1rem] text-center">{isNaN(item.quantity) ? 1 : item.quantity}</span>
                <button 
                  onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                  className="w-5 h-5 flex items-center justify-center bg-white rounded-md text-slate-600 hover:bg-slate-200 transition-colors text-xs font-bold shadow-sm"
                >
                  +
                </button>
              </div>
            </div>

            {item.quantity > 1 && (
              <div className="flex items-center gap-1 text-slate-400">
                <span className="text-[10px] font-bold">=</span>
                <span className="text-xs font-black">{currencySymbol}{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex -space-x-2 rtl:space-x-reverse">
          {item.assignedTo.map((pid) => {
            const person = people.find((p) => p.id === pid);
            return (
              <div 
                key={pid}
                className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                style={{ backgroundColor: person?.color || '#ccc' }}
                title={person?.name}
              >
                {person?.name[0]}
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
        {people.map((person) => (
          <button
            key={person.id}
            onClick={() => onToggleAssignment(item.id, person.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              item.assignedTo.includes(person.id)
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-100'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {person.name}
          </button>
        ))}
      </div>
    </Card>
  );
};

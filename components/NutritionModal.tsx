
import React, { useState } from 'react';
import { FoodItem } from '../types';
import { X, Plus, Trash2, Edit3, AlertCircle } from 'lucide-react';

interface NutritionModalProps {
  initialTitle?: string;
  items: FoodItem[];
  onSave: (items: FoodItem[], title: string) => void;
  onCancel: () => void;
}

const NutritionModal: React.FC<NutritionModalProps> = ({ initialTitle = '', items: initialItems, onSave, onCancel }) => {
  const [items, setItems] = useState<FoodItem[]>(initialItems);
  const [mealTitle, setMealTitle] = useState(initialTitle);
  const [error, setError] = useState<string | null>(null);

  const handleUpdateItem = (index: number, field: keyof FoodItem, value: string | number) => {
    const newItems = [...items];
    let finalValue = value;

    // Validation: Ensure numerical nutritional values are non-negative
    if (['calories', 'protein', 'carbs', 'fat'].includes(field as string)) {
      const num = typeof value === 'string' ? parseFloat(value) : value;
      // Clamp to 0 to prevent negative values and handle NaN
      finalValue = isNaN(num as number) ? 0 : Math.max(0, num as number);
      setError(null);
    }

    newItems[index] = { ...newItems[index], [field]: finalValue };
    setItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
    setError(null);
  };

  const handleAddItem = () => {
    setItems([...items, { 
      name: 'New Item', 
      calories: 0, 
      protein: 0, 
      carbs: 0, 
      fat: 0, 
      servingSize: '1 serving' 
    }]);
    setError(null);
  };

  const handleSave = () => {
    if (!mealTitle.trim()) {
      setError("Please enter a title for your meal.");
      return;
    }
    
    // Final check for non-negative calories and macros
    const hasNegative = items.some(item => 
      Number(item.calories) < 0 || Number(item.protein) < 0 || Number(item.carbs) < 0 || Number(item.fat) < 0
    );

    if (hasNegative) {
      setError("Nutritional values cannot be negative.");
      return;
    }

    onSave(items, mealTitle);
  };

  const totalCals = items.reduce((acc, curr) => acc + Number(curr.calories || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 bg-opacity-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-fade-in border border-white/20">
        <div className="p-6 border-b flex justify-between items-center bg-gray-50/50 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="bg-brand-green/10 p-2 rounded-xl text-brand-green">
              <Edit3 size={20} />
            </div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight uppercase">Review Nutrition</h2>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-900 transition-colors p-2 hover:bg-gray-100 rounded-full">
            <X size={24} />
          </button>
        </div>

        <div className="p-8 overflow-y-auto flex-1 no-scrollbar space-y-8">
           {/* Meal Title Field */}
           <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Meal Title</label>
              <input 
                type="text"
                value={mealTitle}
                placeholder="Give your meal a name..."
                onChange={(e) => { setMealTitle(e.target.value); setError(null); }}
                className={`w-full p-5 bg-gray-50 border rounded-2xl outline-none focus:ring-2 focus:ring-brand-green/20 transition-all font-bold text-lg text-gray-900 ${error && !mealTitle.trim() ? 'border-red-500 bg-red-50' : 'border-gray-100 focus:border-brand-green'}`}
              />
           </div>

           {error && (
             <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-xs font-black uppercase tracking-widest animate-pulse">
               <AlertCircle size={18} />
               {error}
             </div>
           )}

           {/* Total Summary */}
           <div className="p-6 bg-brand-green/5 border border-brand-green/10 rounded-3xl flex justify-between items-center shadow-inner">
              <div>
                <p className="text-[10px] font-black text-brand-green uppercase tracking-widest mb-1">Total Energy</p>
                <p className="text-3xl font-black text-brand-green tracking-tighter">{Math.round(totalCals)} <span className="text-sm">kcal</span></p>
              </div>
              <button 
                onClick={handleAddItem}
                className="flex items-center gap-2 px-5 py-3 bg-white border border-brand-green/20 text-brand-green rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-green hover:text-white transition-all shadow-sm"
              >
                <Plus size={16} /> Add Item
              </button>
           </div>

           <div className="space-y-6">
             <div className="flex justify-between items-center px-1">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Ingredients Breakdown</h3>
                <span className="text-[10px] font-bold text-gray-300">{items.length} total items</span>
             </div>
             {items.map((item, idx) => (
               <div key={idx} className="bg-white border border-gray-100 rounded-3xl p-6 relative group hover:shadow-lg transition-all duration-300">
                  <button 
                    onClick={() => handleRemoveItem(idx)}
                    className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 rounded-xl"
                  >
                    <Trash2 size={18} />
                  </button>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Food Item</label>
                      <input 
                        type="text" 
                        value={item.name} 
                        onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                        className="w-full p-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-brand-green/30 outline-none transition-all font-bold text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Serving Size</label>
                      <input 
                        type="text" 
                        value={item.servingSize || ''} 
                        placeholder="e.g., 1 bowl"
                        onChange={(e) => handleUpdateItem(idx, 'servingSize', e.target.value)}
                        className="w-full p-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-brand-green/30 outline-none transition-all font-bold text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    <div className="text-center p-2 bg-emerald-50/50 rounded-xl border border-emerald-100/50">
                       <label className="text-[8px] font-black text-emerald-600 uppercase tracking-widest block mb-1">Cals</label>
                       <input 
                        type="number" 
                        min="0"
                        onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                        value={item.calories} 
                        onChange={(e) => handleUpdateItem(idx, 'calories', e.target.value)}
                        className="w-full bg-transparent text-center font-black text-emerald-700 outline-none text-sm"
                       />
                    </div>
                    <div className="text-center p-2 bg-blue-50/50 rounded-xl border border-blue-100/50">
                       <label className="text-[8px] font-black text-blue-600 uppercase tracking-widest block mb-1">Protein</label>
                       <input 
                        type="number" 
                        min="0"
                        onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                        value={item.protein} 
                        onChange={(e) => handleUpdateItem(idx, 'protein', e.target.value)}
                        className="w-full bg-transparent text-center font-black text-blue-700 outline-none text-sm"
                       />
                    </div>
                    <div className="text-center p-2 bg-amber-50/50 rounded-xl border border-amber-100/50">
                       <label className="text-[8px] font-black text-amber-600 uppercase tracking-widest block mb-1">Carbs</label>
                       <input 
                        type="number" 
                        min="0"
                        onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                        value={item.carbs} 
                        onChange={(e) => handleUpdateItem(idx, 'carbs', e.target.value)}
                        className="w-full bg-transparent text-center font-black text-amber-700 outline-none text-sm"
                       />
                    </div>
                    <div className="text-center p-2 bg-rose-50/50 rounded-xl border border-rose-100/50">
                       <label className="text-[8px] font-black text-rose-600 uppercase tracking-widest block mb-1">Fat</label>
                       <input 
                        type="number" 
                        min="0"
                        onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                        value={item.fat} 
                        onChange={(e) => handleUpdateItem(idx, 'fat', e.target.value)}
                        className="w-full bg-transparent text-center font-black text-rose-700 outline-none text-sm"
                       />
                    </div>
                  </div>
               </div>
             ))}
           </div>
        </div>

        <div className="p-8 border-t bg-gray-50 flex justify-end gap-4">
          <button onClick={onCancel} className="px-8 py-4 rounded-2xl text-gray-500 font-black text-[11px] uppercase tracking-widest hover:bg-gray-200 transition-colors">
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            className="px-10 py-4 rounded-2xl bg-brand-dark hover:bg-black text-white font-black text-[11px] uppercase tracking-widest transition-all shadow-xl shadow-brand-dark/20 active:scale-95"
          >
            Save Meal Log
          </button>
        </div>
      </div>
    </div>
  );
};

export default NutritionModal;

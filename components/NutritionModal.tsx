import React, { useState } from 'react';
import { FoodItem } from '../types';
import { X, Plus, Trash2 } from 'lucide-react';

interface NutritionModalProps {
  items: FoodItem[];
  onSave: (items: FoodItem[]) => void;
  onCancel: () => void;
}

const NutritionModal: React.FC<NutritionModalProps> = ({ items: initialItems, onSave, onCancel }) => {
  const [items, setItems] = useState<FoodItem[]>(initialItems);

  const handleUpdateItem = (index: number, field: keyof FoodItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleAddItem = () => {
    setItems([...items, { name: 'New Item', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '1 serving' }]);
  };

  const totalCals = items.reduce((acc, curr) => acc + Number(curr.calories || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 bg-opacity-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">Review Nutrition</h2>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-800">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
           {/* Total Summary */}
           <div className="mb-6 p-4 bg-brand-light rounded-xl flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500">Total Calories</p>
                <p className="text-2xl font-bold text-brand-green">{totalCals} kcal</p>
              </div>
              <button 
                onClick={handleAddItem}
                className="flex items-center gap-2 text-sm font-medium text-brand-green hover:underline"
              >
                <Plus size={16} /> Add Item
              </button>
           </div>

           <div className="space-y-4">
             {items.map((item, idx) => (
               <div key={idx} className="border border-gray-200 rounded-xl p-4 relative group">
                  <button 
                    onClick={() => handleRemoveItem(idx)}
                    className="absolute top-2 right-2 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={18} />
                  </button>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                    <div>
                      <label className="text-xs text-gray-500">Food Name</label>
                      <input 
                        type="text" 
                        value={item.name} 
                        onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-brand-green outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Serving Size</label>
                      <input 
                        type="text" 
                        value={item.servingSize || ''} 
                        onChange={(e) => handleUpdateItem(idx, 'servingSize', e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-brand-green outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <div>
                       <label className="text-xs text-gray-500 block text-center">Cals</label>
                       <input 
                        type="number" 
                        value={item.calories} 
                        onChange={(e) => handleUpdateItem(idx, 'calories', parseFloat(e.target.value))}
                        className="w-full p-1 text-center border rounded focus:ring-1 focus:ring-brand-green outline-none"
                       />
                    </div>
                    <div>
                       <label className="text-xs text-gray-500 block text-center">Protein (g)</label>
                       <input 
                        type="number" 
                        value={item.protein} 
                        onChange={(e) => handleUpdateItem(idx, 'protein', parseFloat(e.target.value))}
                        className="w-full p-1 text-center border rounded focus:ring-1 focus:ring-brand-green outline-none"
                       />
                    </div>
                    <div>
                       <label className="text-xs text-gray-500 block text-center">Carbs (g)</label>
                       <input 
                        type="number" 
                        value={item.carbs} 
                        onChange={(e) => handleUpdateItem(idx, 'carbs', parseFloat(e.target.value))}
                        className="w-full p-1 text-center border rounded focus:ring-1 focus:ring-brand-green outline-none"
                       />
                    </div>
                    <div>
                       <label className="text-xs text-gray-500 block text-center">Fat (g)</label>
                       <input 
                        type="number" 
                        value={item.fat} 
                        onChange={(e) => handleUpdateItem(idx, 'fat', parseFloat(e.target.value))}
                        className="w-full p-1 text-center border rounded focus:ring-1 focus:ring-brand-green outline-none"
                       />
                    </div>
                  </div>
               </div>
             ))}
           </div>
        </div>

        <div className="p-4 border-t bg-white flex justify-end gap-3">
          <button onClick={onCancel} className="px-6 py-2 rounded-lg text-gray-600 font-medium hover:bg-gray-100">Cancel</button>
          <button onClick={() => onSave(items)} className="px-6 py-2 rounded-lg bg-brand-green text-white font-medium hover:bg-green-600 shadow-md">Save Meal</button>
        </div>
      </div>
    </div>
  );
};

export default NutritionModal;
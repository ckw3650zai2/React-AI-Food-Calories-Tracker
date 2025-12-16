import React, { useState, useEffect } from 'react';
import { 
  Gender, 
  ActivityLevel, 
  UserProfile, 
  Meal, 
  FoodItem 
} from './types';
import { analyzeMealImage } from './services/geminiService';
import CircularProgress from './components/CircularProgress';
import CameraModal from './components/CameraModal';
import NutritionModal from './components/NutritionModal';
import ReactConfetti from 'react-confetti';
import { 
  Camera, 
  Upload, 
  Plus, 
  Menu, 
  Calendar as CalendarIcon, 
  Flame, 
  ChevronLeft, 
  ChevronRight,
  User,
  X,
  History,
  CheckCircle
} from 'lucide-react';
import { format, isSameDay, subMonths, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth } from 'date-fns';

// Constants
const STORAGE_KEY_USER = 'ai_tracker_user';
const STORAGE_KEY_MEALS = 'ai_tracker_meals';

const App: React.FC = () => {
  // State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [view, setView] = useState<'onboarding' | 'dashboard' | 'history' | 'profile'>('onboarding');
  const [showMenu, setShowMenu] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Modals state
  const [showCamera, setShowCamera] = useState(false);
  const [showNutritionModal, setShowNutritionModal] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<FoodItem[]>([]);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  
  // Celebration
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Load Data
  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);

    const savedUser = localStorage.getItem(STORAGE_KEY_USER);
    const savedMeals = localStorage.getItem(STORAGE_KEY_MEALS);

    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        checkStreak(parsedUser);
      } catch (e) {
        console.error("Error parsing user data", e);
        setView('onboarding');
      }
    } else {
      setView('onboarding');
    }

    if (savedMeals) {
      try {
        setMeals(JSON.parse(savedMeals));
      } catch (e) {
        console.error("Error parsing meals data", e);
        setMeals([]);
      }
    }

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Save Data Effect
  useEffect(() => {
    if (user) localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MEALS, JSON.stringify(meals));
  }, [meals]);

  // Streak Logic
  const checkStreak = (userData: UserProfile) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    if (userData.lastLoginDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = format(yesterday, 'yyyy-MM-dd');

      let newStreak = userData.streak;
      if (userData.lastLoginDate === yesterdayStr) {
        newStreak += 1;
      } else if (userData.lastLoginDate !== today) {
         // Only reset if it wasn't today (avoids resetting on refresh)
         // And if missed a day. 
         // Logic: if last login was NOT yesterday and NOT today, streak breaks.
         // However, simple Logic: if lastLogin < yesterday, reset.
         const lastLogin = new Date(userData.lastLoginDate);
         const diffTime = Math.abs(new Date().getTime() - lastLogin.getTime());
         const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
         if (diffDays > 1) newStreak = 1;
         else newStreak += 1; // Assuming consecutive login logic
      }

      const updatedUser = { ...userData, streak: newStreak, lastLoginDate: today };
      setUser(updatedUser);
      if (updatedUser.goals) setView('dashboard');
      else setView('onboarding');
    } else {
      setUser(userData);
      if (userData.goals) setView('dashboard');
      else setView('onboarding');
    }
  };

  // Calculations
  const calculateGoals = (age: number, gender: Gender, weight: number, height: number, activity: ActivityLevel) => {
    // Mifflin-St Jeor Equation
    let bmr = 10 * weight + 6.25 * height - 5 * age;
    bmr += gender === Gender.MALE ? 5 : -161;

    let multiplier = 1.2;
    switch (activity) {
      case ActivityLevel.LIGHT: multiplier = 1.375; break;
      case ActivityLevel.MODERATE: multiplier = 1.55; break;
      case ActivityLevel.ACTIVE: multiplier = 1.725; break;
      case ActivityLevel.EXTRA: multiplier = 1.9; break;
    }

    const tdee = Math.round(bmr * multiplier);

    // Standard Macro Split (40% Carbs, 30% Protein, 30% Fat)
    return {
      calories: tdee,
      protein: Math.round((tdee * 0.3) / 4),
      carbs: Math.round((tdee * 0.4) / 4),
      fat: Math.round((tdee * 0.3) / 9)
    };
  };

  const handleOnboardingSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const age = Number(formData.get('age'));
    const weight = Number(formData.get('weight'));
    const height = Number(formData.get('height'));
    const gender = formData.get('gender') as Gender;
    const activity = formData.get('activity') as ActivityLevel;

    const goals = calculateGoals(age, gender, weight, height, activity);

    const newUser: UserProfile = {
      name: 'User',
      age, weight, height, gender, activityLevel: activity,
      goals,
      streak: 1,
      lastLoginDate: format(new Date(), 'yyyy-MM-dd')
    };

    setUser(newUser);
    setView('dashboard');
  };

  // Dashboard Logic
  const getTodayMeals = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return meals.filter(m => m.date === today);
  };

  const getDailyTotals = (dailyMeals: Meal[]) => {
    return dailyMeals.reduce((acc, meal) => ({
      calories: acc.calories + meal.totalCalories,
      protein: acc.protein + meal.totalProtein,
      carbs: acc.carbs + meal.totalCarbs,
      fat: acc.fat + meal.totalFat,
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  };

  const todayMeals = getTodayMeals();
  const totals = getDailyTotals(todayMeals);

  // Check for confetti condition
  useEffect(() => {
    if (user && totals.calories >= user.goals.calories && totals.calories > 0) {
      // Trigger confetti only if we just crossed it. 
      // For simplicity in this demo, show it briefly if today's goal is met.
      // A more complex app would track "goalMetEventFired" state.
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [totals.calories, user]);

  // Image Handling
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setPendingImages(Array.from(e.target.files));
      analyzeImages(Array.from(e.target.files));
    }
  };

  const handleCameraCapture = (file: File) => {
    setPendingImages([file]);
    analyzeImages([file]);
  };

  const analyzeImages = async (files: File[]) => {
    setIsAnalyzing(true);
    try {
      const data = await analyzeMealImage(files);
      setCurrentAnalysis(data.items);
      setShowNutritionModal(true);
    } catch (err) {
      alert("Failed to analyze image. Please try again or check API Key.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveMeal = (finalItems: FoodItem[]) => {
    const mealTotals = finalItems.reduce((acc, item) => ({
      calories: acc.calories + (item.calories || 0),
      protein: acc.protein + (item.protein || 0),
      carbs: acc.carbs + (item.carbs || 0),
      fat: acc.fat + (item.fat || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    const newMeal: Meal = {
      id: Date.now().toString(),
      date: format(new Date(), 'yyyy-MM-dd'),
      timestamp: Date.now(),
      name: `Meal ${todayMeals.length + 1}`,
      items: finalItems,
      totalCalories: mealTotals.calories,
      totalProtein: mealTotals.protein,
      totalCarbs: mealTotals.carbs,
      totalFat: mealTotals.fat,
      imageUrl: pendingImages.length > 0 ? URL.createObjectURL(pendingImages[0]) : undefined
    };

    setMeals(prev => [newMeal, ...prev]); // Add to top
    setShowNutritionModal(false);
    setPendingImages([]);
  };

  // --- Views ---

  const OnboardingView = () => (
    <div className="min-h-screen flex items-center justify-center p-4 bg-white">
      <div className="w-full max-w-lg">
        <h1 className="text-4xl font-extrabold text-center text-gray-900 mb-2">Personalize Your <span className="text-brand-green">Goals</span></h1>
        <p className="text-center text-gray-500 mb-8">Tell us a bit about yourself to calculate your daily nutritional needs.</p>
        
        <form onSubmit={handleOnboardingSubmit} className="space-y-6 bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
              <input name="age" type="number" required defaultValue="25" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-brand-green outline-none transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select name="gender" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white">
                <option value={Gender.MALE}>Male</option>
                <option value={Gender.FEMALE}>Female</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
              <input name="weight" type="number" required defaultValue="70" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-brand-green outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Height (cm)</label>
              <input name="height" type="number" required defaultValue="175" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-brand-green outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Activity Level</label>
            <select name="activity" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white">
              {Object.values(ActivityLevel).map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>

          <button type="submit" className="w-full bg-slate-500 hover:bg-slate-600 text-white font-bold py-4 rounded-xl transition-all shadow-lg transform active:scale-95">
            Calculate & Save
          </button>
        </form>
      </div>
    </div>
  );

  const Navbar = () => (
    <div className="flex justify-between items-center py-4 px-2 mb-6 sticky top-0 bg-[#F8FAFC] z-20">
      <div className="flex items-center gap-2">
         {user && (
           <div className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 shadow-sm">
             <Flame size={16} fill="currentColor" /> {user.streak}
           </div>
         )}
      </div>
      
      <div className="text-center">
        <h1 className="text-2xl font-black text-gray-800 leading-none">AI Calories</h1>
        <h1 className="text-2xl font-black text-gray-800 leading-none">Tracker</h1>
      </div>

      <div className="relative">
        <button onClick={() => setShowMenu(!showMenu)} className="p-2 hover:bg-gray-200 rounded-full transition">
          <Menu size={28} className="text-gray-700" />
        </button>
        
        {/* Dropdown Menu */}
        {showMenu && (
          <div className="absolute right-0 top-12 bg-white rounded-xl shadow-xl border border-gray-100 w-48 py-2 overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-50">
            <button onClick={() => { setView('profile'); setShowMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-gray-700">
              <User size={18} /> Edit Profile
            </button>
            <button onClick={() => { setView('history'); setShowMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-gray-700">
              <History size={18} /> Meal History
            </button>
            <button onClick={() => { setView('dashboard'); setShowMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-gray-700 border-t">
               Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const DashboardView = () => (
    <div className="max-w-4xl mx-auto px-4 pb-20">
      <Navbar />

      <p className="text-center text-gray-500 mb-8 max-w-lg mx-auto">
        Snap a picture of your meal to get an instant, AI-powered nutritional breakdown.
      </p>

      {/* Summary Cards */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-6">Today's Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 justify-items-center">
          <CircularProgress 
            value={totals.calories} 
            max={user?.goals.calories || 2000} 
            color="#10B981" 
            label="Calories" 
            subLabel="kcal" 
          />
          <CircularProgress 
            value={totals.protein} 
            max={user?.goals.protein || 150} 
            color="#3B82F6" 
            label="Protein" 
            subLabel="g" 
          />
          <CircularProgress 
            value={totals.carbs} 
            max={user?.goals.carbs || 250} 
            color="#F59E0B" 
            label="Carbs" 
            subLabel="g" 
          />
          <CircularProgress 
            value={totals.fat} 
            max={user?.goals.fat || 70} 
            color="#EF4444" 
            label="Fat" 
            subLabel="g" 
          />
        </div>
      </div>

      {/* Action Area */}
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-dashed border-gray-300 text-center mb-8 relative">
        {isAnalyzing && (
            <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center rounded-3xl backdrop-blur-sm">
                <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-green mb-4"></div>
                    <p className="font-semibold text-brand-green animate-pulse">Analyzing Meal...</p>
                </div>
            </div>
        )}
        
        <div className="mb-6 flex justify-center">
            <div className="p-4 bg-gray-50 rounded-2xl">
                <Upload size={48} className="text-gray-400" />
            </div>
        </div>
        <h3 className="text-gray-500 mb-2">Drag & drop your food photos here</h3>
        <p className="text-xs text-gray-400 mb-6">or</p>
        
        <div className="flex justify-center gap-4 flex-wrap">
            <label className="cursor-pointer bg-brand-green hover:bg-green-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition shadow-lg shadow-green-100">
                <Upload size={20} /> Upload Photos
                <input type="file" multiple accept="image/*" onChange={handleFileChange} className="hidden" />
            </label>
            
            <button 
                onClick={() => setShowCamera(true)}
                className="bg-white border border-gray-200 hover:border-brand-green text-gray-700 px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition hover:text-brand-green shadow-sm"
            >
                <Camera size={20} /> Use Camera
            </button>
        </div>
      </div>

      {/* Meals List */}
      <h2 className="text-xl font-bold text-gray-800 mb-4">Today's Meals</h2>
      {todayMeals.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
            <div className="flex justify-center mb-4">
                <div className="w-16 h-1 w-16 bg-gray-100 rounded"></div>
            </div>
            <p className="text-gray-800 font-semibold mb-1">No meals logged today</p>
            <p className="text-gray-400 text-sm mb-6">Upload a photo or add a meal manually to get started!</p>
            <button 
                onClick={() => {
                    setCurrentAnalysis([]);
                    setShowNutritionModal(true);
                }}
                className="inline-flex items-center gap-2 text-brand-green font-bold border border-gray-200 px-6 py-2 rounded-lg hover:bg-gray-50"
            >
                <Plus size={18} /> Add Meal Manually
            </button>
        </div>
      ) : (
        <div className="space-y-4">
            {todayMeals.map((meal) => (
                <div key={meal.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                             {meal.imageUrl && (
                                 <img src={meal.imageUrl} alt={meal.name} className="w-16 h-16 rounded-xl object-cover" />
                             )}
                             <div>
                                 <h4 className="font-bold text-gray-800 text-lg">{meal.name}</h4>
                                 <p className="text-xs text-gray-400">Logged at {format(meal.timestamp, 'h:mm a')}</p>
                             </div>
                        </div>
                        <button className="text-gray-400 hover:text-red-500" onClick={() => {
                            setMeals(meals.filter(m => m.id !== meal.id));
                        }}>
                            <X size={18} />
                        </button>
                    </div>
                    
                    {/* Meal Nutrition Grid */}
                    <div className="grid grid-cols-4 gap-2 bg-gray-50 p-3 rounded-xl">
                        <div className="text-center">
                            <span className="block text-xs text-gray-500 uppercase tracking-wide">Cals</span>
                            <span className="font-bold text-brand-green">{Math.round(meal.totalCalories)}</span>
                        </div>
                        <div className="text-center border-l border-gray-200">
                            <span className="block text-xs text-gray-500 uppercase tracking-wide">Pro</span>
                            <span className="font-bold text-gray-700">{Math.round(meal.totalProtein)}g</span>
                        </div>
                        <div className="text-center border-l border-gray-200">
                            <span className="block text-xs text-gray-500 uppercase tracking-wide">Carb</span>
                            <span className="font-bold text-gray-700">{Math.round(meal.totalCarbs)}g</span>
                        </div>
                        <div className="text-center border-l border-gray-200">
                            <span className="block text-xs text-gray-500 uppercase tracking-wide">Fat</span>
                            <span className="font-bold text-gray-700">{Math.round(meal.totalFat)}g</span>
                        </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-dashed border-gray-200">
                         <p className="text-sm font-semibold text-gray-600 mb-2">Items:</p>
                         <div className="flex flex-wrap gap-2">
                            {meal.items.map((item, idx) => (
                                <span key={idx} className="bg-white border border-gray-200 text-gray-600 text-xs px-2 py-1 rounded-md">
                                    {item.name} ({Math.round(item.calories)}kcal)
                                </span>
                            ))}
                         </div>
                    </div>
                </div>
            ))}
        </div>
      )}
    </div>
  );

  const MealHistoryView = () => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const daysInMonth = eachDayOfInterval({
        start: startOfWeek(startOfMonth(currentDate)),
        end: endOfWeek(endOfMonth(currentDate))
    });

    const getDayStatus = (day: Date) => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayMeals = meals.filter(m => m.date === dayStr);
        if (dayMeals.length === 0) return 'empty';
        const dayCals = dayMeals.reduce((acc, m) => acc + m.totalCalories, 0);
        return dayCals >= (user?.goals.calories || 2000) ? 'met' : 'partial';
    };

    return (
        <div className="max-w-4xl mx-auto px-4 pb-20 min-h-screen">
             <Navbar />
             
             <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6">
                 <div className="flex justify-between items-center mb-6">
                     <h2 className="text-xl font-bold flex items-center gap-2">
                        <CalendarIcon className="text-brand-green" /> Meal History
                     </h2>
                     <div className="flex items-center gap-4 bg-gray-50 rounded-lg p-1">
                        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1 hover:bg-white rounded-md shadow-sm"><ChevronLeft size={20}/></button>
                        <span className="font-bold w-32 text-center">{format(currentDate, 'MMMM yyyy')}</span>
                        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1 hover:bg-white rounded-md shadow-sm"><ChevronRight size={20}/></button>
                     </div>
                 </div>

                 <div className="grid grid-cols-7 gap-1 text-center mb-2">
                     {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <span key={d} className="text-xs text-gray-400 font-bold uppercase">{d}</span>)}
                 </div>
                 
                 <div className="grid grid-cols-7 gap-1">
                     {daysInMonth.map((day, i) => {
                         const status = getDayStatus(day);
                         const isSelectedMonth = isSameMonth(day, currentDate);
                         const isToday = isSameDay(day, new Date());
                         
                         let bgClass = "bg-transparent";
                         let textClass = isSelectedMonth ? "text-gray-700" : "text-gray-300";
                         
                         if (status === 'met') {
                            bgClass = "bg-brand-green text-white";
                            textClass = "text-white";
                         } else if (status === 'partial') {
                            bgClass = "bg-yellow-100";
                            textClass = "text-yellow-700";
                         }

                         if (isToday) {
                             textClass += " font-extrabold ring-2 ring-brand-dark ring-offset-1 rounded-full";
                         }

                         return (
                             <div key={i} className={`h-10 w-10 mx-auto rounded-full flex items-center justify-center text-sm cursor-default ${bgClass} ${textClass}`}>
                                 {format(day, 'd')}
                             </div>
                         )
                     })}
                 </div>

                 <div className="flex justify-center gap-6 mt-6 text-xs text-gray-500">
                     <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-brand-green"></div> Goal Met</div>
                     <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-100"></div> Tracked</div>
                 </div>
             </div>
             
             {/* Simple stats for the current month */}
             <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                      <p className="text-gray-500 text-sm">Meals Logged (Month)</p>
                      <p className="text-3xl font-bold text-brand-dark">
                          {meals.filter(m => isSameMonth(new Date(m.date), currentDate)).length}
                      </p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                      <p className="text-gray-500 text-sm">Avg Calories</p>
                      <p className="text-3xl font-bold text-brand-dark">
                          {/* Simplified average calc */}
                          {Math.round(meals.filter(m => isSameMonth(new Date(m.date), currentDate)).reduce((a,b) => a+b.totalCalories, 0) / (meals.filter(m => isSameMonth(new Date(m.date), currentDate)).length || 1))}
                      </p>
                  </div>
             </div>
        </div>
    );
  };

  const ProfileView = () => (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-8 shadow-xl">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Edit Profile</h2>
                <button onClick={() => setView('dashboard')} className="p-2 hover:bg-gray-100 rounded-full"><X/></button>
             </div>
             <form onSubmit={handleOnboardingSubmit} className="space-y-4">
                  {/* Reusing onboarding logic but pre-filled */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                    <input name="age" type="number" required defaultValue={user?.age} className="w-full p-3 border rounded-lg" />
                    </div>
                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                    <select name="gender" defaultValue={user?.gender} className="w-full p-3 border rounded-lg bg-white">
                        <option value={Gender.MALE}>Male</option>
                        <option value={Gender.FEMALE}>Female</option>
                    </select>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                    <input name="weight" type="number" required defaultValue={user?.weight} className="w-full p-3 border rounded-lg" />
                    </div>
                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Height (cm)</label>
                    <input name="height" type="number" required defaultValue={user?.height} className="w-full p-3 border rounded-lg" />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Activity Level</label>
                    <select name="activity" defaultValue={user?.activityLevel} className="w-full p-3 border rounded-lg bg-white">
                    {Object.values(ActivityLevel).map(level => (
                        <option key={level} value={level}>{level}</option>
                    ))}
                    </select>
                </div>
                <div className="pt-4 flex gap-4">
                     <button type="button" onClick={() => setView('dashboard')} className="flex-1 py-3 border border-gray-300 rounded-xl font-bold text-gray-600">Cancel</button>
                     <button type="submit" className="flex-1 py-3 bg-brand-green text-white rounded-xl font-bold shadow-lg hover:bg-green-600">Update & Save</button>
                </div>
             </form>
          </div>
      </div>
  );

  return (
    <>
      {showConfetti && <ReactConfetti width={windowSize.width} height={windowSize.height} recycle={false} numberOfPieces={500} />}
      
      {view === 'onboarding' && <OnboardingView />}
      {view === 'dashboard' && <DashboardView />}
      {view === 'history' && <MealHistoryView />}
      {view === 'profile' && <ProfileView />}

      {showCamera && (
        <CameraModal 
            onClose={() => setShowCamera(false)} 
            onCapture={handleCameraCapture} 
        />
      )}

      {showNutritionModal && (
        <NutritionModal 
            items={currentAnalysis}
            onCancel={() => {
                setShowNutritionModal(false);
                setPendingImages([]);
            }}
            onSave={saveMeal}
        />
      )}
    </>
  );
};

export default App;
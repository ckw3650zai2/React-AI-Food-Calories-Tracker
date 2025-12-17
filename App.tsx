
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
  TrendingUp,
  Award,
  Settings
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
  
  // Window size for responsive adjustments
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
      } else {
        const lastLogin = new Date(userData.lastLoginDate);
        const diffTime = Math.abs(new Date().getTime() - lastLogin.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        if (diffDays > 1) newStreak = 1;
        else newStreak += 1;
      }

      const updatedUser = { ...userData, streak: newStreak, lastLoginDate: today };
      setUser(updatedUser);
      setView('dashboard');
    } else {
      setUser(userData);
      setView('dashboard');
    }
  };

  // Calculations
  const calculateGoals = (age: number, gender: Gender, weight: number, height: number, activity: ActivityLevel) => {
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
      alert("Failed to analyze image. Please check your API configuration.");
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

    setMeals(prev => [newMeal, ...prev]);
    setShowNutritionModal(false);
    setPendingImages([]);
  };

  // Views
  const OnboardingView = () => (
    <div className="min-h-screen flex items-center justify-center p-4 animate-fade-in relative z-10">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-brand-green text-white rounded-3xl shadow-2xl shadow-brand-green/30 mb-6 transform rotate-3">
            <TrendingUp size={40} />
          </div>
          <h1 className="text-5xl font-black text-gray-900 mb-3 tracking-tight">Your Body, <span className="text-brand-green">Optimized.</span></h1>
          <p className="text-gray-500 text-lg font-medium">Tell us about yourself to tailor your AI nutrition plan.</p>
        </div>
        
        <form onSubmit={handleOnboardingSubmit} className="space-y-6 glass-card p-10 rounded-[2.5rem] shadow-2xl shadow-gray-200/50">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Age</label>
              <input name="age" type="number" required defaultValue="25" className="w-full p-4 bg-white/50 border border-white rounded-2xl focus:ring-4 focus:ring-brand-green/20 focus:bg-white outline-none transition font-bold" />
            </div>
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Gender</label>
              <select name="gender" className="w-full p-4 bg-white/50 border border-white rounded-2xl focus:ring-4 focus:ring-brand-green/20 focus:bg-white outline-none font-bold">
                <option value={Gender.MALE}>Male</option>
                <option value={Gender.FEMALE}>Female</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Weight (kg)</label>
              <input name="weight" type="number" required defaultValue="70" className="w-full p-4 bg-white/50 border border-white rounded-2xl focus:ring-4 focus:ring-brand-green/20 focus:bg-white outline-none font-bold" />
            </div>
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Height (cm)</label>
              <input name="height" type="number" required defaultValue="175" className="w-full p-4 bg-white/50 border border-white rounded-2xl focus:ring-4 focus:ring-brand-green/20 focus:bg-white outline-none font-bold" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Activity Level</label>
            <select name="activity" className="w-full p-4 bg-white/50 border border-white rounded-2xl focus:ring-4 focus:ring-brand-green/20 focus:bg-white outline-none font-bold">
              {Object.values(ActivityLevel).map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>

          <button type="submit" className="w-full bg-brand-dark hover:bg-black text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-brand-dark/20 transform active:scale-[0.98] uppercase tracking-widest mt-4">
            Create My Plan
          </button>
        </form>
      </div>
    </div>
  );

  const Navbar = () => (
    <div className="flex justify-between items-center py-6 px-4 mb-4 sticky top-0 z-40">
      <div className="flex items-center gap-2">
         {user && (
           <div className="bg-white/80 backdrop-blur-md text-orange-600 px-5 py-2 rounded-2xl text-sm font-black flex items-center gap-2 shadow-sm border border-white/50">
             <Flame size={18} fill="currentColor" /> {user.streak} DAY STREAK
           </div>
         )}
      </div>
      
      <div className="text-center">
        <h1 className="text-2xl font-black text-gray-900 tracking-tighter uppercase">NuTrack <span className="text-brand-green">AI</span></h1>
      </div>

      <div className="relative">
        <button onClick={() => setShowMenu(!showMenu)} className="p-3 bg-white/80 backdrop-blur-md hover:bg-white rounded-2xl transition shadow-sm border border-white/50">
          <Menu size={24} className="text-gray-900" />
        </button>
        
        {showMenu && (
          <div className="absolute right-0 top-14 bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 w-64 py-4 overflow-hidden animate-fade-in z-50">
            <button onClick={() => { setView('dashboard'); setShowMenu(false); }} className="w-full text-left px-6 py-4 hover:bg-brand-green/10 flex items-center gap-4 text-gray-800 font-bold transition-colors">
               <TrendingUp size={20} className="text-brand-green" /> Dashboard
            </button>
            <button onClick={() => { setView('history'); setShowMenu(false); }} className="w-full text-left px-6 py-4 hover:bg-brand-green/10 flex items-center gap-4 text-gray-800 font-bold transition-colors">
              <History size={20} className="text-brand-green" /> Meal History
            </button>
            <div className="h-px bg-gray-100 my-2 mx-6"></div>
            <button onClick={() => { setView('profile'); setShowMenu(false); }} className="w-full text-left px-6 py-4 hover:bg-brand-green/10 flex items-center gap-4 text-gray-800 font-bold transition-colors">
              <Settings size={20} className="text-gray-400" /> Settings
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const DashboardView = () => (
    <div className="max-w-5xl mx-auto px-4 pb-24 animate-fade-in relative z-10">
      <Navbar />

      {/* Progress Section Container with Localized Glows */}
      <div className="relative mb-10 group">
        {/* Cute background light blobs behind the main card */}
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-brand-green/30 blur-[100px] rounded-full z-0 group-hover:scale-150 transition-transform duration-1000"></div>
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-400/20 blur-[100px] rounded-full z-0 group-hover:scale-150 transition-transform duration-1000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-32 bg-pink-400/10 blur-[120px] rounded-full z-0"></div>

        <div className="glass-card rounded-[3rem] p-10 shadow-2xl shadow-gray-200/50 border-white/60 relative z-10 overflow-hidden">
          {/* subtle interior glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 blur-2xl rounded-full -mr-10 -mt-10"></div>
          
          <div className="flex justify-between items-center mb-10">
            <div>
              <h2 className="text-3xl font-black text-gray-900 mb-1">Daily Overview</h2>
              <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Targeting your 24h nutrition goals</p>
            </div>
            <div className="hidden sm:flex items-center gap-2 bg-brand-green/10 text-brand-green px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest">
              <Award size={16} /> Elite Status
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <CircularProgress 
              value={totals.calories} 
              max={user?.goals.calories || 2000} 
              color="#10B981" 
              label="Calories" 
              subLabel="kcal" 
              size={140}
            />
            <CircularProgress 
              value={totals.protein} 
              max={user?.goals.protein || 150} 
              color="#3B82F6" 
              label="Protein" 
              subLabel="g" 
              size={140}
            />
            <CircularProgress 
              value={totals.carbs} 
              max={user?.goals.carbs || 250} 
              color="#F59E0B" 
              label="Carbs" 
              subLabel="g" 
              size={140}
            />
            <CircularProgress 
              value={totals.fat} 
              max={user?.goals.fat || 70} 
              color="#EF4444" 
              label="Fat" 
              subLabel="g" 
              size={140}
            />
          </div>
        </div>
      </div>

      {/* Action Area */}
      <div className="glass-card rounded-[3rem] p-12 text-center mb-10 relative overflow-hidden transition-all border-2 border-dashed border-brand-green/30 group hover:bg-white/90">
        {isAnalyzing && (
            <div className="absolute inset-0 bg-white/95 z-10 flex items-center justify-center backdrop-blur-md">
                <div className="flex flex-col items-center">
                    <div className="relative w-24 h-24 mb-6">
                      <div className="absolute inset-0 border-[6px] border-brand-green/10 rounded-full"></div>
                      <div className="absolute inset-0 border-[6px] border-brand-green border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="font-black text-brand-green text-2xl tracking-tight uppercase">AI Analyzing...</p>
                    <p className="text-sm text-gray-400 mt-2 uppercase font-black tracking-widest">Identifying ingredients & macros</p>
                </div>
            </div>
        )}
        
        <div className="mb-8 flex justify-center">
            <div className="w-24 h-24 bg-brand-green/5 rounded-[2rem] flex items-center justify-center text-brand-green group-hover:scale-110 transition-transform duration-500">
                <Camera size={48} strokeWidth={1.5} />
            </div>
        </div>
        <h3 className="text-gray-900 font-black text-3xl mb-3 tracking-tight">Log a New Meal</h3>
        <p className="text-gray-500 text-lg mb-10 font-medium max-w-sm mx-auto">Instant nutritional analysis using the power of Gemini Vision AI.</p>
        
        <div className="flex justify-center gap-6 flex-wrap">
            <label className="cursor-pointer bg-brand-green hover:bg-emerald-600 text-white px-10 py-5 rounded-[2rem] font-black flex items-center gap-3 transition-all shadow-xl shadow-brand-green/20 transform active:scale-95 text-lg">
                <Upload size={24} /> UPLOAD
                <input type="file" multiple accept="image/*" onChange={handleFileChange} className="hidden" />
            </label>
            
            <button 
                onClick={() => setShowCamera(true)}
                className="bg-brand-dark hover:bg-black text-white px-10 py-5 rounded-[2rem] font-black flex items-center gap-3 transition-all shadow-xl shadow-brand-dark/20 transform active:scale-95 text-lg"
            >
                <Camera size={24} /> CAMERA
            </button>
        </div>
      </div>

      {/* Meals List */}
      <div className="flex justify-between items-end mb-8 px-2">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Today's Meals</h2>
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest mt-1">Timeline of your consumption</p>
        </div>
        <button 
            onClick={() => {
                setCurrentAnalysis([]);
                setShowNutritionModal(true);
            }}
            className="bg-white/80 backdrop-blur-md border border-brand-green/20 text-brand-green px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-green hover:text-white transition-all shadow-sm"
        >
            + Manual Add
        </button>
      </div>
      
      {todayMeals.length === 0 ? (
        <div className="glass-card rounded-[3rem] p-24 text-center border-white/60">
            <div className="w-20 h-20 bg-gray-100/50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
                <Plus size={40} />
            </div>
            <p className="text-gray-900 font-black text-2xl mb-2">Feeling Hungry?</p>
            <p className="text-gray-400 text-lg font-medium">Capture your first meal to start tracking today.</p>
        </div>
      ) : (
        <div className="grid gap-6">
            {todayMeals.map((meal) => (
                <div key={meal.id} className="glass-card p-8 rounded-[2.5rem] shadow-xl shadow-gray-200/40 border-white/60 hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 group">
                    <div className="flex justify-between items-start mb-8">
                        <div className="flex items-center gap-6">
                             {meal.imageUrl && (
                                 <div className="relative">
                                     <img src={meal.imageUrl} alt={meal.name} className="w-28 h-28 rounded-3xl object-cover shadow-2xl ring-4 ring-white" />
                                     <div className="absolute -top-2 -right-2 bg-brand-green text-white p-1.5 rounded-xl shadow-lg border-2 border-white">
                                        <TrendingUp size={14} />
                                     </div>
                                 </div>
                             )}
                             <div>
                                 <h4 className="font-black text-gray-900 text-2xl tracking-tight mb-1">{meal.name}</h4>
                                 <p className="text-xs text-gray-400 font-black uppercase tracking-widest flex items-center gap-2">
                                     <CalendarIcon size={14} className="text-brand-green" /> {format(meal.timestamp, 'h:mm a')}
                                 </p>
                             </div>
                        </div>
                        <button className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all" onClick={() => {
                            setMeals(meals.filter(m => m.id !== meal.id));
                        }}>
                            <X size={24} />
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4 bg-white/40 p-6 rounded-3xl border border-white/50 group-hover:bg-white/60 transition-colors">
                        <div className="text-center">
                            <span className="block text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Calories</span>
                            <span className="font-black text-brand-green text-2xl tracking-tighter">{Math.round(meal.totalCalories)}</span>
                        </div>
                        <div className="text-center border-l border-gray-100">
                            <span className="block text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Protein</span>
                            <span className="font-black text-gray-900 text-2xl tracking-tighter">{Math.round(meal.totalProtein)}g</span>
                        </div>
                        <div className="text-center border-l border-gray-100">
                            <span className="block text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Carbs</span>
                            <span className="font-black text-gray-900 text-2xl tracking-tighter">{Math.round(meal.totalCarbs)}g</span>
                        </div>
                        <div className="text-center border-l border-gray-100">
                            <span className="block text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Fat</span>
                            <span className="font-black text-gray-900 text-2xl tracking-tighter">{Math.round(meal.totalFat)}g</span>
                        </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-dashed border-gray-200">
                         <div className="flex flex-wrap gap-3">
                            {meal.items.map((item, idx) => (
                                <span key={idx} className="bg-white/80 text-gray-600 text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border border-white/50 shadow-sm">
                                    {item.name} <span className="text-brand-green ml-1">{Math.round(item.calories)} CAL</span>
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
        <div className="max-w-5xl mx-auto px-4 pb-24 min-h-screen animate-fade-in relative z-10">
             <Navbar />
             
             <div className="glass-card rounded-[3rem] p-10 shadow-2xl border-white/60 mb-8">
                 <div className="flex justify-between items-center mb-10 flex-wrap gap-6">
                     <div>
                        <h2 className="text-3xl font-black flex items-center gap-4">
                            <CalendarIcon size={32} className="text-brand-green" /> Journey Map
                        </h2>
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mt-1 ml-12">Visualizing your progress over time</p>
                     </div>
                     <div className="flex items-center gap-3 bg-white/50 rounded-2xl p-2 border border-white shadow-sm">
                        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-3 hover:bg-white rounded-xl shadow-sm transition"><ChevronLeft size={20}/></button>
                        <span className="font-black w-44 text-center text-sm uppercase tracking-widest">{format(currentDate, 'MMMM yyyy')}</span>
                        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-3 hover:bg-white rounded-xl shadow-sm transition"><ChevronRight size={20}/></button>
                     </div>
                 </div>

                 <div className="grid grid-cols-7 gap-4 text-center mb-6">
                     {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <span key={d} className="text-[11px] text-gray-400 font-black uppercase tracking-widest">{d}</span>)}
                 </div>
                 
                 <div className="grid grid-cols-7 gap-4">
                     {daysInMonth.map((day, i) => {
                         const status = getDayStatus(day);
                         const isSelectedMonth = isSameMonth(day, currentDate);
                         const isToday = isSameDay(day, new Date());
                         
                         let bgClass = "bg-white/30 hover:bg-white/60 transition-all border border-white/40";
                         let textClass = isSelectedMonth ? "text-gray-900 font-black" : "text-gray-200";
                         
                         if (status === 'met') {
                            bgClass = "bg-brand-green shadow-xl shadow-brand-green/30 text-white transform scale-105 border-transparent";
                            textClass = "text-white font-black";
                         } else if (status === 'partial') {
                            bgClass = "bg-orange-100 border-orange-200/50";
                            textClass = "text-orange-700 font-black";
                         }

                         if (isToday && status === 'empty') {
                             bgClass = "ring-2 ring-brand-dark ring-offset-2";
                         }

                         return (
                             <div key={i} className={`aspect-square w-full max-w-[60px] mx-auto rounded-2xl flex items-center justify-center text-base cursor-default relative ${bgClass} ${textClass}`}>
                                 {format(day, 'd')}
                                 {isToday && <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-current rounded-full"></div>}
                             </div>
                         )
                     })}
                 </div>

                 <div className="flex justify-center gap-10 mt-12 flex-wrap">
                     <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-widest text-gray-500">
                        <div className="w-4 h-4 rounded-lg bg-brand-green"></div> Goal Achieved
                     </div>
                     <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-widest text-gray-500">
                        <div className="w-4 h-4 rounded-lg bg-orange-100"></div> Tracked
                     </div>
                     <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-widest text-gray-500">
                        <div className="w-4 h-4 rounded-lg bg-white/30 border border-white/40"></div> No Entry
                     </div>
                 </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="glass-card p-10 rounded-[3rem] shadow-xl border-white/60 group hover:bg-white/80 transition-all">
                      <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-2">Total Meals Consumed</p>
                      <div className="flex items-end gap-3">
                        <p className="text-5xl font-black text-gray-900 leading-none">
                            {meals.filter(m => isSameMonth(new Date(m.date), currentDate)).length}
                        </p>
                        <span className="text-brand-green font-black uppercase text-[10px] mb-1 tracking-widest">This Month</span>
                      </div>
                  </div>
                  <div className="glass-card p-10 rounded-[3rem] shadow-xl border-white/60 group hover:bg-white/80 transition-all">
                      <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-2">Monthly Daily Average</p>
                      <div className="flex items-end gap-3">
                        <p className="text-5xl font-black text-gray-900 leading-none">
                            {Math.round(meals.filter(m => isSameMonth(new Date(m.date), currentDate)).reduce((a,b) => a+b.totalCalories, 0) / (meals.filter(m => isSameMonth(new Date(m.date), currentDate)).length || 1))}
                        </p>
                        <span className="text-brand-green font-black uppercase text-[10px] mb-1 tracking-widest">Kcal / Day</span>
                      </div>
                  </div>
             </div>
        </div>
    );
  };

  const ProfileView = () => (
      <div className="min-h-screen flex items-center justify-center p-4 animate-fade-in relative z-10">
          <div className="glass-card w-full max-w-lg rounded-[3rem] p-12 shadow-2xl border-white/60">
             <div className="flex justify-between items-center mb-10">
                <h2 className="text-4xl font-black text-gray-900 tracking-tight">Profile Settings</h2>
                <button onClick={() => setView('dashboard')} className="p-3 bg-gray-100/50 hover:bg-gray-100 rounded-2xl transition"><X/></button>
             </div>
             <form onSubmit={handleOnboardingSubmit} className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Age</label>
                    <input name="age" type="number" required defaultValue={user?.age} className="w-full p-4 bg-white/50 border border-white rounded-2xl focus:ring-4 focus:ring-brand-green/20 outline-none font-bold" />
                    </div>
                    <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Gender</label>
                    <select name="gender" defaultValue={user?.gender} className="w-full p-4 bg-white/50 border border-white rounded-2xl outline-none font-bold">
                        <option value={Gender.MALE}>Male</option>
                        <option value={Gender.FEMALE}>Female</option>
                    </select>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                    <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Weight (kg)</label>
                    <input name="weight" type="number" required defaultValue={user?.weight} className="w-full p-4 bg-white/50 border border-white rounded-2xl outline-none font-bold" />
                    </div>
                    <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Height (cm)</label>
                    <input name="height" type="number" required defaultValue={user?.height} className="w-full p-4 bg-white/50 border border-white rounded-2xl outline-none font-bold" />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Activity Level</label>
                    <select name="activity" defaultValue={user?.activityLevel} className="w-full p-4 bg-white/50 border border-white rounded-2xl outline-none font-bold">
                    {Object.values(ActivityLevel).map(level => (
                        <option key={level} value={level}>{level}</option>
                    ))}
                    </select>
                </div>
                <div className="pt-8 flex gap-4">
                     <button type="button" onClick={() => setView('dashboard')} className="flex-1 py-5 border border-gray-200 rounded-2xl font-black text-gray-400 text-[11px] uppercase tracking-widest hover:bg-gray-50 transition shadow-sm">Discard</button>
                     <button type="submit" className="flex-1 py-5 bg-brand-green text-white rounded-2xl font-black shadow-xl shadow-brand-green/20 hover:bg-emerald-600 transition text-[11px] uppercase tracking-widest">Update Plan</button>
                </div>
             </form>
          </div>
      </div>
  );

  return (
    <div className="no-scrollbar min-h-screen">
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
    </div>
  );
};

export default App;

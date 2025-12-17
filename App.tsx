
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Gender, 
  ActivityLevel, 
  UserProfile, 
  Meal, 
  FoodItem,
  Badge
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
  Settings,
  Zap,
  Pencil,
  Trophy,
  Star,
  CheckCircle,
  Camera as CameraIcon,
  Target
} from 'lucide-react';
import { format, isSameDay, subMonths, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth } from 'date-fns';

// Constants
const STORAGE_KEY_USER = 'ai_tracker_user';
const STORAGE_KEY_MEALS = 'ai_tracker_meals';

const BADGES_DATA: Record<string, { name: string; description: string; icon: React.ReactNode; color: string }> = {
  'starter': { name: 'First Bite', description: 'Log your very first meal.', icon: <CheckCircle />, color: 'bg-blue-500' },
  'streak_7': { name: 'Week Warrior', description: 'Maintain a 7-day streak.', icon: <Flame />, color: 'bg-orange-500' },
  'streak_30': { name: 'Consistency King', description: 'Maintain a 30-day streak.', icon: <Trophy />, color: 'bg-purple-500' },
  'meal_50': { name: 'Master Tracker', description: 'Log 50 total meals.', icon: <Target />, color: 'bg-brand-green' },
  'photo_10': { name: 'Foodie Pro', description: 'Log 10 meals with photos.', icon: <CameraIcon />, color: 'bg-pink-500' },
  'sniper': { name: 'Calorie Sniper', description: 'Finish a day within 50kcal of your goal.', icon: <Zap />, color: 'bg-yellow-500' }
};

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
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  
  // Tooltip state for history
  const [hoveredDay, setHoveredDay] = useState<{ date: Date; x: number; y: number } | null>(null);

  // Load Data
  useEffect(() => {
    const savedUser = localStorage.getItem(STORAGE_KEY_USER);
    const savedMeals = localStorage.getItem(STORAGE_KEY_MEALS);

    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        checkStreak(parsedUser);
      } catch (e) {
        setView('onboarding');
      }
    } else {
      setView('onboarding');
    }

    if (savedMeals) {
      try {
        setMeals(JSON.parse(savedMeals));
      } catch (e) {
        setMeals([]);
      }
    }
  }, []);

  // Save Data Effect
  useEffect(() => {
    if (user) localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MEALS, JSON.stringify(meals));
    if (user) checkAchievements(user, meals);
  }, [meals]);

  // Achievement Logic
  const checkAchievements = (currentUser: UserProfile, currentMeals: Meal[]) => {
    const earned = new Set(currentUser.earnedBadges || []);
    const today = format(new Date(), 'yyyy-MM-dd');
    const todayMeals = currentMeals.filter(m => m.date === today);
    const todayCals = todayMeals.reduce((acc, m) => acc + m.totalCalories, 0);
    const mealWithPhotosCount = currentMeals.filter(m => m.imageUrl).length;

    // Check Starter
    if (currentMeals.length >= 1) earned.add('starter');
    // Check Streak
    if (currentUser.streak >= 7) earned.add('streak_7');
    if (currentUser.streak >= 30) earned.add('streak_30');
    // Check Totals
    if (currentMeals.length >= 50) earned.add('meal_50');
    // Check Photos
    if (mealWithPhotosCount >= 10) earned.add('photo_10');
    // Check Sniper (only if today is ended or near goal)
    const diff = Math.abs(todayCals - currentUser.goals.calories);
    if (diff <= 50 && todayMeals.length > 0) earned.add('sniper');

    if (earned.size !== (currentUser.earnedBadges?.length || 0)) {
      setUser({ ...currentUser, earnedBadges: Array.from(earned), totalMealsLogged: currentMeals.length });
    }
  };

  // Streak Logic
  const checkStreak = (userData: UserProfile) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    if (userData.lastLoginDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = format(yesterday, 'yyyy-MM-dd');

      let newStreak = userData.streak || 0;
      if (userData.lastLoginDate === yesterdayStr) {
        newStreak += 1;
      } else {
        const lastLogin = new Date(userData.lastLoginDate);
        const diffTime = Math.abs(new Date().getTime() - lastLogin.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        if (diffDays > 1) newStreak = 1;
        else newStreak += 1;
      }

      const updatedUser = { 
        ...userData, 
        streak: newStreak, 
        lastLoginDate: today,
        earnedBadges: userData.earnedBadges || [],
        totalMealsLogged: userData.totalMealsLogged || 0
      };
      setUser(updatedUser);
      setView('dashboard');
    } else {
      setUser({
        ...userData,
        earnedBadges: userData.earnedBadges || [],
        totalMealsLogged: userData.totalMealsLogged || 0
      });
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
      lastLoginDate: format(new Date(), 'yyyy-MM-dd'),
      earnedBadges: [],
      totalMealsLogged: 0
    };
    setUser(newUser);
    setView('dashboard');
  };

  // Dashboard Logic
  const todayMeals = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return meals.filter(m => m.date === today);
  }, [meals]);

  const totals = useMemo(() => {
    return todayMeals.reduce((acc, meal) => ({
      calories: acc.calories + meal.totalCalories,
      protein: acc.protein + meal.totalProtein,
      carbs: acc.carbs + meal.totalCarbs,
      fat: acc.fat + meal.totalFat,
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  }, [todayMeals]);

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

  const handleEditMeal = (meal: Meal) => {
    setEditingMealId(meal.id);
    setCurrentAnalysis([...meal.items]);
    setShowNutritionModal(true);
  };

  const saveMeal = (finalItems: FoodItem[]) => {
    const mealTotals = finalItems.reduce((acc, item) => ({
      calories: acc.calories + (Number(item.calories) || 0),
      protein: acc.protein + (Number(item.protein) || 0),
      carbs: acc.carbs + (Number(item.carbs) || 0),
      fat: acc.fat + (Number(item.fat) || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    if (editingMealId) {
      setMeals(prev => prev.map(m => m.id === editingMealId ? {
        ...m,
        items: finalItems,
        totalCalories: mealTotals.calories,
        totalProtein: mealTotals.protein,
        totalCarbs: mealTotals.carbs,
        totalFat: mealTotals.fat
      } : m));
    } else {
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
    }

    setShowNutritionModal(false);
    setPendingImages([]);
    setEditingMealId(null);
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
              <input name="age" type="number" required defaultValue="25" className="w-full p-4 bg-white/50 border border-white rounded-2xl outline-none transition font-bold" />
            </div>
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Gender</label>
              <select name="gender" className="w-full p-4 bg-white/50 border border-white rounded-2xl outline-none font-bold">
                <option value={Gender.MALE}>Male</option>
                <option value={Gender.FEMALE}>Female</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Weight (kg)</label>
              <input name="weight" type="number" required defaultValue="70" className="w-full p-4 bg-white/50 border border-white rounded-2xl outline-none font-bold" />
            </div>
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Height (cm)</label>
              <input name="height" type="number" required defaultValue="175" className="w-full p-4 bg-white/50 border border-white rounded-2xl outline-none font-bold" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Activity Level</label>
            <select name="activity" className="w-full p-4 bg-white/50 border border-white rounded-2xl outline-none font-bold">
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
        <h1 className="text-2xl font-black text-gray-900 tracking-tighter uppercase cursor-pointer" onClick={() => setView('dashboard')}>NuTrack <span className="text-brand-green">AI</span></h1>
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
              <Trophy size={20} className="text-brand-green" /> Profile & Badges
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const DashboardView = () => (
    <div className="max-w-5xl mx-auto px-4 pb-24 animate-fade-in relative z-10">
      <Navbar />
      <div className="relative mb-10 group">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-brand-green/30 blur-[100px] rounded-full z-0 group-hover:scale-150 transition-transform duration-1000"></div>
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-400/20 blur-[100px] rounded-full z-0 group-hover:scale-150 transition-transform duration-1000"></div>
        <div className="glass-card rounded-[3rem] p-10 shadow-2xl relative z-10 overflow-hidden">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h2 className="text-3xl font-black text-gray-900 mb-1">Daily Overview</h2>
              <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Targeting your 24h nutrition goals</p>
            </div>
            {user?.earnedBadges && user.earnedBadges.length > 0 && (
                <div onClick={() => setView('profile')} className="cursor-pointer flex items-center gap-2 bg-brand-green/10 text-brand-green px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest">
                  <Award size={16} /> {user.earnedBadges.length} Achievement{user.earnedBadges.length > 1 ? 's' : ''}
                </div>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <CircularProgress value={totals.calories} max={user?.goals.calories || 2000} color="#10B981" label="Calories" subLabel="kcal" size={140} />
            <CircularProgress value={totals.protein} max={user?.goals.protein || 150} color="#3B82F6" label="Protein" subLabel="g" size={140} />
            <CircularProgress value={totals.carbs} max={user?.goals.carbs || 250} color="#F59E0B" label="Carbs" subLabel="g" size={140} />
            <CircularProgress value={totals.fat} max={user?.goals.fat || 70} color="#EF4444" label="Fat" subLabel="g" size={140} />
          </div>
        </div>
      </div>
      <div className="glass-card rounded-[3rem] p-12 text-center mb-10 relative overflow-hidden transition-all border-2 border-dashed border-brand-green/30 group hover:bg-white/90">
        {isAnalyzing && (
            <div className="absolute inset-0 bg-white/95 z-10 flex items-center justify-center backdrop-blur-md">
                <div className="flex flex-col items-center">
                    <div className="relative w-24 h-24 mb-6">
                      <div className="absolute inset-0 border-[6px] border-brand-green/10 rounded-full"></div>
                      <div className="absolute inset-0 border-[6px] border-brand-green border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="font-black text-brand-green text-2xl tracking-tight uppercase">AI Analyzing...</p>
                </div>
            </div>
        )}
        <div className="mb-8 flex justify-center">
            <div className="w-24 h-24 bg-brand-green/5 rounded-[2rem] flex items-center justify-center text-brand-green group-hover:scale-110 transition-transform duration-500">
                <Camera size={48} strokeWidth={1.5} />
            </div>
        </div>
        <h3 className="text-gray-900 font-black text-3xl mb-3 tracking-tight">Log a New Meal</h3>
        <div className="flex justify-center gap-6 flex-wrap">
            <label className="cursor-pointer bg-brand-green hover:bg-emerald-600 text-white px-10 py-5 rounded-[2rem] font-black flex items-center gap-3 transition-all shadow-xl shadow-brand-green/20 transform active:scale-95 text-lg">
                <Upload size={24} /> UPLOAD
                <input type="file" multiple accept="image/*" onChange={handleFileChange} className="hidden" />
            </label>
            <button onClick={() => setShowCamera(true)} className="bg-brand-dark hover:bg-black text-white px-10 py-5 rounded-[2rem] font-black flex items-center gap-3 transition-all shadow-xl shadow-brand-dark/20 transform active:scale-95 text-lg">
                <Camera size={24} /> CAMERA
            </button>
        </div>
      </div>
      <div className="flex justify-between items-end mb-8 px-2">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Today's Meals</h2>
        </div>
        <button onClick={() => { setEditingMealId(null); setCurrentAnalysis([]); setShowNutritionModal(true); }} className="bg-white/80 backdrop-blur-md border border-brand-green/20 text-brand-green px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-green hover:text-white transition-all shadow-sm">
            + Manual Add
        </button>
      </div>
      {todayMeals.length === 0 ? (
        <div className="glass-card rounded-[3rem] p-24 text-center">
            <p className="text-gray-900 font-black text-2xl mb-2">Feeling Hungry?</p>
            <p className="text-gray-400 text-lg font-medium">Capture your first meal to start tracking today.</p>
        </div>
      ) : (
        <div className="grid gap-6">
            {todayMeals.map((meal) => (
                <div key={meal.id} className="glass-card p-8 rounded-[2.5rem] shadow-xl hover:scale-[1.01] transition-all duration-300 group">
                    <div className="flex justify-between items-start mb-8">
                        <div className="flex items-center gap-6">
                             {meal.imageUrl && (
                                 <div className="relative">
                                     <img src={meal.imageUrl} alt={meal.name} className="w-28 h-28 rounded-3xl object-cover shadow-2xl ring-4 ring-white" />
                                 </div>
                             )}
                             <div>
                                 <h4 className="font-black text-gray-900 text-2xl tracking-tight mb-1">{meal.name}</h4>
                                 <p className="text-xs text-gray-400 font-black uppercase tracking-widest flex items-center gap-2">
                                     <CalendarIcon size={14} className="text-brand-green" /> {format(meal.timestamp, 'h:mm a')}
                                 </p>
                             </div>
                        </div>
                        <div className="flex gap-2">
                            <button className="p-3 text-gray-300 hover:text-brand-green hover:bg-emerald-50 rounded-2xl transition-all" onClick={() => handleEditMeal(meal)}>
                                <Pencil size={20} />
                            </button>
                            <button className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all" onClick={() => setMeals(meals.filter(m => m.id !== meal.id))}>
                                <X size={24} />
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 bg-white/40 p-6 rounded-3xl border border-white/50">
                        <div className="text-center">
                            <span className="block text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Calories</span>
                            <span className="font-black text-brand-green text-2xl">{Math.round(meal.totalCalories)}</span>
                        </div>
                        <div className="text-center border-l border-gray-100">
                            <span className="block text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Protein</span>
                            <span className="font-black text-gray-900 text-2xl">{Math.round(meal.totalProtein)}g</span>
                        </div>
                        <div className="text-center border-l border-gray-100">
                            <span className="block text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Carbs</span>
                            <span className="font-black text-gray-900 text-2xl">{Math.round(meal.totalCarbs)}g</span>
                        </div>
                        <div className="text-center border-l border-gray-100">
                            <span className="block text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Fat</span>
                            <span className="font-black text-gray-900 text-2xl">{Math.round(meal.totalFat)}g</span>
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
    const daysInMonth = eachDayOfInterval({ start: startOfWeek(startOfMonth(currentDate)), end: endOfWeek(endOfMonth(currentDate)) });
    const getDayStatus = (day: Date) => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayMeals = meals.filter(m => m.date === dayStr);
        if (dayMeals.length === 0) return 'empty';
        const dayCals = dayMeals.reduce((acc, m) => acc + m.totalCalories, 0);
        return dayCals >= (user?.goals.calories || 2000) ? 'met' : 'partial';
    };
    const getDailySummary = (day: Date) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayMeals = meals.filter(m => m.date === dayStr);
      return dayMeals.reduce((acc, meal) => ({
        calories: acc.calories + meal.totalCalories,
        protein: acc.protein + meal.totalProtein,
        carbs: acc.carbs + meal.totalCarbs,
        fat: acc.fat + meal.totalFat,
        count: acc.count + 1
      }), { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 });
    };
    return (
        <div className="max-w-5xl mx-auto px-4 pb-24 min-h-screen animate-fade-in relative z-10">
             <Navbar />
             {hoveredDay && (
               <div className="fixed z-[100] pointer-events-none transform -translate-x-1/2 -translate-y-full mb-4 animate-fade-in" style={{ left: hoveredDay.x, top: hoveredDay.y - 10 }}>
                 <div className="glass-card p-4 rounded-2xl shadow-2xl min-w-[180px]">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                      <Zap size={10} className="text-brand-green" /> {format(hoveredDay.date, 'MMM d, yyyy')}
                    </p>
                    {(() => {
                      const summary = getDailySummary(hoveredDay.date);
                      if (summary.count === 0) return <p className="text-xs font-bold text-gray-300 italic">No meals logged</p>;
                      return (
                        <div className="space-y-1.5">
                           <div className="flex justify-between items-center text-sm">
                              <span className="font-bold text-gray-500 text-xs uppercase">Calories</span>
                              <span className="font-black text-brand-green">{Math.round(summary.calories)}</span>
                           </div>
                        </div>
                      )
                    })()}
                 </div>
                 <div className="w-3 h-3 bg-white/70 backdrop-blur-md rotate-45 mx-auto -mt-1.5 border-r border-b border-white/30"></div>
               </div>
             )}
             <div className="glass-card rounded-[3rem] p-10 shadow-2xl mb-8">
                 <div className="flex justify-between items-center mb-10 flex-wrap gap-6">
                     <h2 className="text-3xl font-black flex items-center gap-4">
                        <CalendarIcon size={32} className="text-brand-green" /> Journey Map
                     </h2>
                     <div className="flex items-center gap-3 bg-white/50 rounded-2xl p-2 border border-white shadow-sm">
                        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-3 hover:bg-white rounded-xl shadow-sm transition"><ChevronLeft size={20}/></button>
                        <span className="font-black w-44 text-center text-sm uppercase tracking-widest">{format(currentDate, 'MMMM yyyy')}</span>
                        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-3 hover:bg-white rounded-xl shadow-sm transition"><ChevronRight size={20}/></button>
                     </div>
                 </div>
                 <div className="grid grid-cols-7 gap-4">
                     {daysInMonth.map((day, i) => {
                         const status = getDayStatus(day);
                         const isSelectedMonth = isSameMonth(day, currentDate);
                         const isToday = isSameDay(day, new Date());
                         let bgClass = "bg-white/30 hover:bg-white/60 border border-white/40";
                         let textClass = isSelectedMonth ? "text-gray-900 font-black" : "text-gray-200";
                         if (status === 'met') { bgClass = "bg-brand-green text-white scale-105 border-transparent"; textClass = "text-white font-black"; }
                         else if (status === 'partial') { bgClass = "bg-orange-100 border-orange-200/50"; textClass = "text-orange-700 font-black"; }
                         return (
                             <div key={i} onMouseEnter={(e) => setHoveredDay({ date: day, x: e.clientX, y: e.clientY })} onMouseLeave={() => setHoveredDay(null)} className={`aspect-square w-full max-w-[60px] mx-auto rounded-2xl flex items-center justify-center text-base cursor-default relative ${bgClass} ${textClass}`}>
                                 {format(day, 'd')}
                             </div>
                         )
                     })}
                 </div>
             </div>
        </div>
    );
  };

  const ProfileView = () => (
      <div className="max-w-5xl mx-auto px-4 pb-24 min-h-screen animate-fade-in relative z-10">
          <Navbar />
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* User Stats Card */}
            <div className="lg:col-span-1 space-y-8">
                <div className="glass-card rounded-[3rem] p-10 shadow-2xl text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-brand-green/10 blur-3xl -mr-10 -mt-10"></div>
                    <div className="inline-flex items-center justify-center w-24 h-24 bg-brand-green/10 text-brand-green rounded-[2.5rem] mb-6 border border-brand-green/20">
                        <User size={48} />
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 mb-1">Health Profile</h2>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-8">Logged in as {user?.name}</p>
                    
                    <div className="space-y-4">
                        <div className="flex justify-between p-4 bg-white/50 rounded-2xl border border-white">
                            <span className="text-xs font-black text-gray-400 uppercase">Weight</span>
                            <span className="font-black text-gray-900">{user?.weight} kg</span>
                        </div>
                        <div className="flex justify-between p-4 bg-white/50 rounded-2xl border border-white">
                            <span className="text-xs font-black text-gray-400 uppercase">Height</span>
                            <span className="font-black text-gray-900">{user?.height} cm</span>
                        </div>
                        <div className="flex justify-between p-4 bg-white/50 rounded-2xl border border-white">
                            <span className="text-xs font-black text-gray-400 uppercase">Age</span>
                            <span className="font-black text-gray-900">{user?.age} yrs</span>
                        </div>
                        <div className="flex justify-between p-4 bg-brand-green text-white rounded-2xl shadow-lg shadow-brand-green/20">
                            <span className="text-xs font-black uppercase">Daily Goal</span>
                            <span className="font-black">{user?.goals.calories} kcal</span>
                        </div>
                    </div>

                    <button onClick={() => setView('onboarding')} className="w-full mt-10 py-4 bg-gray-100/50 hover:bg-gray-100 text-gray-400 hover:text-gray-900 rounded-2xl font-black text-[11px] uppercase tracking-widest transition flex items-center justify-center gap-2">
                        <Settings size={16} /> Edit Profile
                    </button>
                </div>

                <div className="glass-card rounded-[3rem] p-10 shadow-2xl bg-brand-dark text-white">
                    <h3 className="text-2xl font-black mb-6 flex items-center gap-3">
                        <Star className="text-yellow-400" fill="currentColor" /> Stats
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-4 bg-white/5 rounded-2xl border border-white/10">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Streak</span>
                            <span className="text-3xl font-black">{user?.streak}</span>
                        </div>
                        <div className="text-center p-4 bg-white/5 rounded-2xl border border-white/10">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Total Meals</span>
                            <span className="text-3xl font-black">{meals.length}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Badges Section */}
            <div className="lg:col-span-2">
                <div className="glass-card rounded-[3rem] p-10 shadow-2xl min-h-full border-white/60">
                    <div className="flex justify-between items-center mb-10">
                        <div>
                            <h2 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-4">
                                <Trophy className="text-yellow-500" size={36} /> Trophy Room
                            </h2>
                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mt-1">Unlock badges through healthy habits</p>
                        </div>
                        <div className="bg-brand-green/10 text-brand-green px-5 py-2.5 rounded-2xl font-black text-xs">
                            {user?.earnedBadges?.length || 0} / {Object.keys(BADGES_DATA).length} EARNED
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {Object.entries(BADGES_DATA).map(([id, data]) => {
                            const isEarned = user?.earnedBadges?.includes(id);
                            return (
                                <div key={id} className={`p-6 rounded-[2.5rem] border-2 transition-all duration-500 flex items-center gap-6 ${isEarned ? 'border-brand-green bg-white shadow-xl scale-105' : 'border-dashed border-gray-200 opacity-60 grayscale'}`}>
                                    <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-white shadow-lg ${isEarned ? data.color : 'bg-gray-100 text-gray-400'}`}>
                                        {/* Fix for line 665: Cast to ReactElement with expected props to resolve TypeScript error */}
                                        {React.cloneElement(data.icon as React.ReactElement<{ size?: number }>, { size: 36 })}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className={`font-black text-xl tracking-tight mb-1 ${isEarned ? 'text-gray-900' : 'text-gray-400'}`}>{data.name}</h4>
                                        <p className="text-xs text-gray-500 font-medium leading-relaxed">{data.description}</p>
                                        {isEarned && (
                                            <div className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-black text-brand-green uppercase tracking-widest">
                                                <CheckCircle size={12} /> Unlocked
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-12 p-8 bg-gray-50/50 rounded-[2rem] border border-dashed border-gray-200 text-center">
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">More milestones coming soon...</p>
                    </div>
                </div>
            </div>
          </div>
      </div>
  );

  return (
    <div className="no-scrollbar min-h-screen">
      {view === 'onboarding' && <OnboardingView />}
      {view === 'dashboard' && <DashboardView />}
      {view === 'history' && <MealHistoryView />}
      {view === 'profile' && <ProfileView />}
      {showCamera && <CameraModal onClose={() => setShowCamera(false)} onCapture={handleCameraCapture} />}
      {showNutritionModal && (
        <NutritionModal 
            items={currentAnalysis}
            onCancel={() => { setShowNutritionModal(false); setPendingImages([]); setEditingMealId(null); }}
            onSave={saveMeal}
        />
      )}
    </div>
  );
};

export default App;

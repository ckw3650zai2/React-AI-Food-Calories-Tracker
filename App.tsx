import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Target,
  Eye,
  Clock,
  Sparkles,
  CalendarDays
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
  'camera_5': { name: 'Visionary', description: 'Log 5 meals using the camera.', icon: <Eye />, color: 'bg-indigo-500' },
  'sniper': { name: 'Calorie Sniper', description: 'Finish a day within 50kcal of your goal.', icon: <Zap />, color: 'bg-yellow-500' }
};

const App: React.FC = () => {
  // State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [view, setView] = useState<'onboarding' | 'dashboard' | 'history' | 'profile'>('onboarding');
  const [showMenu, setShowMenu] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Tabs state for Dashboard
  const [activeMealTab, setActiveMealTab] = useState(0);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  // Modals state
  const [showCamera, setShowCamera] = useState(false);
  const [showNutritionModal, setShowNutritionModal] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<FoodItem[]>([]);
  const [suggestedMealName, setSuggestedMealName] = useState<string>('');
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  
  // Achievement Animation State
  const [newlyEarnedBadgeId, setNewlyEarnedBadgeId] = useState<string | null>(null);

  // Auto-scroll active tab into view
  useEffect(() => {
    if (tabsContainerRef.current && activeMealTab >= 0) {
      const activeTabElement = tabsContainerRef.current.children[activeMealTab] as HTMLElement;
      if (activeTabElement) {
        activeTabElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    }
  }, [activeMealTab]);

  // Achievement Logic
  const checkAchievements = useCallback((currentUser: UserProfile, currentMeals: Meal[]) => {
    const existingBadges = new Set(currentUser.earnedBadges || []);
    const earned = new Set(currentUser.earnedBadges || []);
    
    if (currentMeals.length >= 1) earned.add('starter');
    if (currentMeals.length >= 50) earned.add('meal_50');
    
    const mealsWithPhotos = currentMeals.filter(m => m.imageUrl);
    if (mealsWithPhotos.length >= 10) earned.add('photo_10');
    const mealsWithCamera = currentMeals.filter(m => m.imageUrl && m.imageUrl.startsWith('blob:')); 
    if (mealsWithCamera.length >= 5) earned.add('camera_5');
    
    if (currentUser.streak >= 7) earned.add('streak_7');
    if (currentUser.streak >= 30) earned.add('streak_30');
    
    const mealsByDate: Record<string, number> = {};
    currentMeals.forEach(m => {
      mealsByDate[m.date] = (mealsByDate[m.date] || 0) + m.totalCalories;
    });

    const goal = currentUser.goals.calories;
    const hasPerfectDay = Object.keys(mealsByDate).some(date => {
      const dayTotal = mealsByDate[date];
      const diff = Math.abs(dayTotal - goal);
      return diff <= 50;
    });

    if (hasPerfectDay) earned.add('sniper');

    if (earned.size !== existingBadges.size) {
      earned.forEach(id => {
        if (!existingBadges.has(id)) {
          setNewlyEarnedBadgeId(id);
        }
      });

      setUser(prev => prev ? {
        ...prev,
        earnedBadges: Array.from(earned),
        totalMealsLogged: currentMeals.length
      } : null);
    }
  }, []);

  // Load Data
  useEffect(() => {
    const savedUser = localStorage.getItem(STORAGE_KEY_USER);
    const savedMeals = localStorage.getItem(STORAGE_KEY_MEALS);

    let initialMeals: Meal[] = [];
    if (savedMeals) {
      try {
        initialMeals = JSON.parse(savedMeals);
        setMeals(initialMeals);
      } catch (e) {
        setMeals([]);
      }
    }

    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        checkStreak(parsedUser, initialMeals, false);
      } catch (e) {
        setView('onboarding');
      }
    } else {
      setView('onboarding');
    }
  }, []);

  // Save Data Effect
  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
      checkAchievements(user, meals);
    }
    localStorage.setItem(STORAGE_KEY_MEALS, JSON.stringify(meals));
  }, [user, meals, checkAchievements]);

  /**
   * Streak Logic
   */
  const checkStreak = (userData: UserProfile, currentMeals: Meal[], isMealLogged: boolean) => {
    const now = Date.now();
    const lastMeal = userData.lastMealTimestamp || now;
    const lastUpdate = userData.lastLoginTimestamp || now;
    
    const diffMealHours = (now - lastMeal) / 36e5;
    const diffUpdateHours = (now - lastUpdate) / 36e5;

    let newStreak = userData.streak || 1;
    let newLastUpdate = userData.lastLoginTimestamp || now;
    let newLastMeal = userData.lastMealTimestamp || now;

    if (isMealLogged) {
      if (diffMealHours >= 48) {
        newStreak = 1;
        newLastUpdate = now;
      } 
      else if (diffUpdateHours >= 24) {
        newStreak += 1;
        newLastUpdate = now;
      }
      newLastMeal = now;
    } else {
      if (diffMealHours >= 48) {
        newStreak = 1;
        newLastUpdate = now;
        newLastMeal = now;
      }
    }

    const updatedUser: UserProfile = { 
      ...userData, 
      streak: newStreak, 
      lastLoginDate: format(new Date(), 'yyyy-MM-dd'),
      lastLoginTimestamp: newLastUpdate,
      lastMealTimestamp: newLastMeal,
      earnedBadges: userData.earnedBadges || [],
      totalMealsLogged: currentMeals.length || userData.totalMealsLogged || 0
    };
    
    setUser(updatedUser);
    setView('dashboard');
  };

  const calculateGoals = (age: number, gender: Gender, weight: number, height: number, activity: ActivityLevel) => {
    let bmr = 10 * weight + 6.25 * height - 5 * age;
    bmr += gender === Gender.MALE ? 5 : -161;
    let multiplier = 1.2;
    switch (activity) {
      case ActivityLevel.SEDENTARY: multiplier = 1.2; break;
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

    if (isNaN(age) || age <= 0 || age > 120) return alert("Valid age required.");
    if (isNaN(weight) || weight <= 10 || weight > 600) return alert("Valid weight required.");
    if (isNaN(height) || height <= 50 || height > 280) return alert("Valid height required.");

    const goals = calculateGoals(age, gender, weight, height, activity);
    const now = Date.now();
    const newUser: UserProfile = {
      name: user?.name || 'User',
      age, weight, height, gender, activityLevel: activity,
      goals,
      streak: user?.streak || 1,
      lastLoginDate: user?.lastLoginDate || format(new Date(), 'yyyy-MM-dd'),
      lastLoginTimestamp: user?.lastLoginTimestamp || now,
      lastMealTimestamp: user?.lastMealTimestamp || now,
      earnedBadges: user?.earnedBadges || [],
      totalMealsLogged: user?.totalMealsLogged || 0
    };
    setUser(newUser);
    setView('dashboard');
  };

  const todayMeals = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return meals.filter(m => m.date === today).sort((a, b) => b.timestamp - a.timestamp);
  }, [meals]);

  const totals = useMemo(() => {
    return todayMeals.reduce((acc, meal) => ({
      calories: acc.calories + meal.totalCalories,
      protein: acc.protein + meal.totalProtein,
      carbs: acc.carbs + meal.totalCarbs,
      fat: acc.fat + meal.totalFat,
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  }, [todayMeals]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setPendingImages(files);
      analyzeImages(files);
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
      setSuggestedMealName(data.mealName || '');
      setShowNutritionModal(true);
    } catch (err) {
      alert("Failed to analyze image. Please check your connection.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleEditMeal = (meal: Meal) => {
    setEditingMealId(meal.id);
    setSuggestedMealName(meal.name);
    setCurrentAnalysis([...meal.items]);
    setShowNutritionModal(true);
  };

  const saveMeal = (finalItems: FoodItem[], finalTitle: string) => {
    const mealTotals = finalItems.reduce((acc, item) => ({
      calories: acc.calories + (Number(item.calories) || 0),
      protein: acc.protein + (Number(item.protein) || 0),
      carbs: acc.carbs + (Number(item.carbs) || 0),
      fat: acc.fat + (Number(item.fat) || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    const mealName = finalTitle || (finalItems.length > 0 ? finalItems[0].name : 'Meal');

    if (editingMealId) {
      setMeals(prev => prev.map(m => m.id === editingMealId ? {
        ...m,
        name: mealName,
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
        name: mealName,
        items: finalItems,
        totalCalories: mealTotals.calories,
        totalProtein: mealTotals.protein,
        totalCarbs: mealTotals.carbs,
        totalFat: mealTotals.fat,
        imageUrl: pendingImages.length > 0 ? URL.createObjectURL(pendingImages[0]) : undefined
      };
      setMeals(prev => [newMeal, ...prev]);
      setActiveMealTab(0); 
    }

    if (user) {
        checkStreak(user, meals, true);
    }

    setShowNutritionModal(false);
    setPendingImages([]);
    setEditingMealId(null);
    setSuggestedMealName('');
  };

  // --- VIEW RENDERERS (Defined to prevent remounting scroll reset) ---

  const renderAchievementCelebration = () => {
    if (!newlyEarnedBadgeId) return null;
    const badge = BADGES_DATA[newlyEarnedBadgeId];
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-dark/95 backdrop-blur-xl animate-fade-in px-4">
        <div className="relative w-full max-w-sm text-center">
          <div className="relative z-10 space-y-8">
            <div className={`w-40 h-40 mx-auto rounded-[3rem] ${badge.color} text-white flex items-center justify-center shadow-2xl shadow-brand-green/20 border-4 border-white/20 animate-bounce-slow relative overflow-hidden`}>
              <div className="absolute inset-0 bg-white/10 animate-pulse"></div>
              {React.cloneElement(badge.icon as React.ReactElement<{ size?: number }>, { size: 80 })}
              <Sparkles className="absolute top-4 right-4 text-white/40 animate-spin-slow" size={24} />
            </div>
            <div>
              <h2 className="text-4xl font-black text-white mb-2 uppercase tracking-tighter">Achievement Unlocked!</h2>
              <p className="text-brand-green font-black text-xl uppercase tracking-widest mb-6">{badge.name}</p>
              <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-md">
                <p className="text-gray-300 font-medium text-lg leading-relaxed">{badge.description}</p>
              </div>
            </div>
            <div className="space-y-3">
              <button 
                onClick={() => { setNewlyEarnedBadgeId(null); setView('profile'); }}
                className="w-full py-5 bg-brand-green hover:bg-emerald-600 text-white font-black rounded-3xl transition-all shadow-xl shadow-brand-green/20 active:scale-95 uppercase tracking-widest text-lg"
              >
                Show Me in Trophy Room
              </button>
              <button 
                onClick={() => setNewlyEarnedBadgeId(null)}
                className="w-full py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl transition-all active:scale-95 uppercase tracking-widest text-sm"
              >
                Got it, Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderOnboarding = () => (
    <div className="min-h-screen flex items-center justify-center p-4 animate-fade-in relative z-10 safe-top safe-bottom">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-brand-green text-white rounded-3xl shadow-2xl shadow-brand-green/30 mb-6 transform rotate-3">
            <TrendingUp size={40} />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-3 tracking-tight">Your Body, <span className="text-brand-green">Optimized.</span></h1>
          <p className="text-gray-500 text-lg font-medium px-4">Tell us about yourself to tailor your AI nutrition plan.</p>
        </div>
        <form onSubmit={handleOnboardingSubmit} className="space-y-6 glass-card p-6 md:p-10 rounded-[2.5rem] shadow-2xl shadow-gray-200/50">
          <div className="grid grid-cols-2 gap-4 md:gap-6">
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Age</label>
              <input name="age" type="number" required defaultValue={user?.age || "25"} min="1" max="120" className="w-full p-4 bg-white/50 border border-white rounded-2xl outline-none transition font-bold" />
            </div>
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Gender</label>
              <select name="gender" defaultValue={user?.gender || Gender.MALE} className="w-full p-4 bg-white/50 border border-white rounded-2xl outline-none font-bold">
                <option value={Gender.MALE}>Male</option>
                <option value={Gender.FEMALE}>Female</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 md:gap-6">
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Weight (kg)</label>
              <input name="weight" type="number" required defaultValue={user?.weight || "70"} className="w-full p-4 bg-white/50 border border-white rounded-2xl outline-none font-bold" />
            </div>
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Height (cm)</label>
              <input name="height" type="number" required defaultValue={user?.height || "175"} className="w-full p-4 bg-white/50 border border-white rounded-2xl outline-none font-bold" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Activity Level</label>
            <select name="activity" defaultValue={user?.activityLevel || ActivityLevel.MODERATE} className="w-full p-4 bg-white/50 border border-white rounded-2xl outline-none font-bold">
              {Object.values(ActivityLevel).map(level => (
                <option key={level} value={level}>{level.split(' (')[0]}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="w-full bg-brand-dark hover:bg-black text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-brand-dark/20 active:scale-[0.98] uppercase tracking-widest mt-4">
            {user ? 'Update My Plan' : 'Create My Plan'}
          </button>
          {user && (
            <button type="button" onClick={() => setView('profile')} className="w-full text-center text-gray-400 font-black uppercase tracking-widest text-[10px] py-2 hover:text-gray-900 transition-colors">
              Go Back to Profile
            </button>
          )}
        </form>
      </div>
    </div>
  );

  const renderNavbar = () => (
    <header className="sticky top-0 z-40 w-full bg-white/70 backdrop-blur-xl border-b border-white/40 shadow-sm safe-top">
      <div className="max-w-5xl mx-auto flex justify-between items-center py-4 px-6">
        <div className="flex items-center gap-2">
           {user && (
             <div className="bg-white/80 text-orange-600 px-3 py-1.5 rounded-xl text-[10px] font-black flex items-center gap-2 shadow-sm border border-white/50">
               <Flame size={14} fill="currentColor" /> {user.streak}
             </div>
           )}
        </div>
        <div className="text-center">
          <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tighter uppercase cursor-pointer" onClick={() => { setView('dashboard'); setShowMenu(false); }}>
            NuTrack <span className="text-brand-green">AI</span>
          </h1>
        </div>
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-2.5 bg-white/80 hover:bg-white active:scale-95 rounded-xl transition shadow-sm border border-white/50">
            <Menu size={20} className="text-gray-900" />
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
    </header>
  );

  const renderDashboard = () => (
    <div className="pb-24 safe-bottom animate-fade-in relative z-10 pt-4 px-2">
      <div className="relative mb-8">
        <div className="glass-card rounded-[3rem] p-6 md:p-10 shadow-2xl shadow-gray-200/50 border-white/60 relative z-10 overflow-hidden">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-1">Overview</h2>
              <p className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Targeting 24h nutrition</p>
            </div>
            {user?.earnedBadges && user.earnedBadges.length > 0 && (
                <div onClick={() => setView('profile')} className="cursor-pointer flex items-center gap-2 bg-brand-green/10 text-brand-green px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest active:scale-95">
                  <Award size={14} /> {user.earnedBadges.length} Badges
                </div>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
            <CircularProgress value={totals.calories} max={user?.goals.calories || 2000} color="#10B981" label="Calories" subLabel="kcal" size={100} />
            <CircularProgress value={totals.protein} max={user?.goals.protein || 150} color="#3B82F6" label="Protein" subLabel="g" size={100} />
            <CircularProgress value={totals.carbs} max={user?.goals.carbs || 250} color="#F59E0B" label="Carbs" subLabel="g" size={100} />
            <CircularProgress value={totals.fat} max={user?.goals.fat || 70} color="#EF4444" label="Fat" subLabel="g" size={100} />
          </div>
        </div>
      </div>
      
      <div className="glass-card rounded-[3rem] p-8 text-center mb-8 relative overflow-hidden border-2 border-dashed border-brand-green/30 group bg-white/50 active:bg-white/90 transition-all">
        {isAnalyzing && (
            <div className="absolute inset-0 bg-white/95 z-10 flex items-center justify-center backdrop-blur-md">
                <div className="flex flex-col items-center">
                    <div className="relative w-16 h-16 mb-4">
                      <div className="absolute inset-0 border-[4px] border-brand-green/10 rounded-full"></div>
                      <div className="absolute inset-0 border-[4px] border-brand-green border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="font-black text-brand-green text-lg tracking-tight uppercase">AI Analyzing...</p>
                </div>
            </div>
        )}
        <h3 className="text-gray-900 font-black text-2xl mb-6 tracking-tight">Log a New Meal</h3>
        <div className="flex justify-center gap-4 flex-wrap">
            <label className="cursor-pointer bg-brand-green hover:bg-emerald-600 active:scale-95 text-white px-6 py-4 rounded-[2rem] font-black flex items-center gap-2 transition-all shadow-xl shadow-brand-green/20 text-sm uppercase tracking-widest">
                <Upload size={20} /> UPLOAD
                <input type="file" multiple accept="image/*" onChange={handleFileChange} className="hidden" />
            </label>
            <button onClick={() => setShowCamera(true)} className="bg-brand-dark hover:bg-black active:scale-95 text-white px-6 py-4 rounded-[2rem] font-black flex items-center gap-2 transition-all shadow-xl shadow-brand-dark/20 text-sm uppercase tracking-widest">
                <Camera size={20} /> CAMERA
            </button>
        </div>
      </div>

      <div className="flex justify-between items-end mb-4 px-2">
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Today</h2>
        <button onClick={() => { setEditingMealId(null); setSuggestedMealName('Manual Entry'); setCurrentAnalysis([]); setShowNutritionModal(true); }} className="bg-white/80 active:scale-95 border border-brand-green/20 text-brand-green px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-sm">
            + Manual
        </button>
      </div>

      {todayMeals.length === 0 ? (
        <div className="glass-card rounded-[3rem] p-16 text-center">
            <p className="text-gray-400 font-bold italic">No meals logged yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div 
            ref={tabsContainerRef} 
            className="flex gap-2 overflow-x-auto no-scrollbar py-2 scroll-smooth"
          >
             {todayMeals.map((meal, idx) => (
                <button 
                  key={meal.id}
                  onClick={() => setActiveMealTab(idx)}
                  className={`px-6 py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all whitespace-nowrap border shrink-0 ${
                    activeMealTab === idx 
                      ? 'bg-brand-green text-white border-brand-green shadow-lg scale-105 z-10' 
                      : 'bg-white/60 text-gray-400 border-white/50 active:bg-gray-100'
                  }`}
                >
                  {meal.name}
                </button>
             ))}
          </div>
          
          <div className="animate-fade-in" key={todayMeals[activeMealTab]?.id}>
            {todayMeals[activeMealTab] && (
              <MealCard 
                meal={todayMeals[activeMealTab]} 
                onEdit={handleEditMeal} 
                onDelete={(id) => {
                  setMeals(meals.filter(m => m.id !== id));
                  setActiveMealTab(0);
                }} 
              />
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderHistory = () => {
    // History needs local state so we use a small helper hook or define state at top.
    // Since history has its own date logic, we keep it integrated but follow the functional pattern.
    return <HistoryView meals={meals} user={user} handleEditMeal={handleEditMeal} setMeals={setMeals} />
  };

  const renderProfile = () => (
      <div className="pb-24 safe-bottom animate-fade-in relative z-10 pt-4 px-2">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
                <div className="glass-card rounded-[3rem] p-10 shadow-2xl text-center relative overflow-hidden">
                    <div className="inline-flex items-center justify-center w-24 h-24 bg-brand-green/10 text-brand-green rounded-[2.5rem] mb-6">
                        <User size={48} />
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 mb-8 tracking-tight">Your Profile</h2>
                    <div className="space-y-3">
                        <div className="flex justify-between p-4 bg-white/50 rounded-2xl border border-white">
                            <span className="text-[10px] font-black text-gray-400 uppercase">Goal</span>
                            <span className="font-black text-gray-900">{user?.goals.calories} kcal</span>
                        </div>
                        <div className="flex justify-between p-4 bg-brand-green text-white rounded-2xl shadow-lg shadow-brand-green/20">
                            <span className="text-[10px] font-black uppercase">Streak</span>
                            <span className="font-black">{user?.streak} Days</span>
                        </div>
                    </div>
                    <button onClick={() => setView('onboarding')} className="w-full mt-8 py-4 bg-gray-100/50 hover:bg-gray-100 active:scale-95 text-gray-900 rounded-2xl font-black text-[11px] uppercase tracking-widest transition flex items-center justify-center gap-2">
                        <Settings size={16} /> Edit Profile
                    </button>
                </div>
            </div>
            <div className="lg:col-span-2">
                <div className="glass-card rounded-[3rem] p-6 md:p-10 shadow-2xl min-h-full">
                    <div className="flex justify-between items-center mb-10">
                        <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-4">
                            <Trophy className="text-yellow-500" size={32} /> Badges
                        </h2>
                        <div className="bg-brand-green/10 text-brand-green px-4 py-2 rounded-2xl font-black text-[10px]">
                            {user?.earnedBadges?.length || 0} EARNED
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(BADGES_DATA).map(([id, data]) => {
                            const isEarned = user?.earnedBadges?.includes(id);
                            return (
                                <div key={id} className={`p-5 rounded-[2.5rem] border-2 transition-all flex items-center gap-4 ${isEarned ? `border-brand-green bg-white shadow-xl` : 'border-dashed border-gray-200 opacity-50 grayscale'}`}>
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-md ${isEarned ? data.color : 'bg-gray-100 text-gray-400'}`}>
                                        {React.cloneElement(data.icon as React.ReactElement<{ size?: number }>, { size: 28 })}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className={`font-black text-lg tracking-tight ${isEarned ? 'text-gray-900' : 'text-gray-400'}`}>{data.name}</h4>
                                        <p className="text-[10px] text-gray-500 font-medium">{data.description}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
          </div>
      </div>
  );

  return (
    <div className="no-scrollbar min-h-screen">
      {view !== 'onboarding' && renderNavbar()}
      <main className="max-w-5xl mx-auto px-2">
        {view === 'onboarding' && renderOnboarding()}
        {view === 'dashboard' && renderDashboard()}
        {view === 'history' && renderHistory()}
        {view === 'profile' && renderProfile()}
      </main>
      {renderAchievementCelebration()}
      {showCamera && <CameraModal onClose={() => setShowCamera(false)} onCapture={handleCameraCapture} />}
      {showNutritionModal && (
        <NutritionModal 
            initialTitle={suggestedMealName}
            items={currentAnalysis}
            onCancel={() => { setShowNutritionModal(false); setPendingImages([]); setEditingMealId(null); setSuggestedMealName(''); }}
            onSave={saveMeal}
        />
      )}
    </div>
  );
};

// --- HELPER COMPONENTS ---

const HistoryView: React.FC<{ meals: Meal[], user: UserProfile | null, handleEditMeal: (meal: Meal) => void, setMeals: React.Dispatch<React.SetStateAction<Meal[]>> }> = ({ meals, user, handleEditMeal, setMeals }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    
    const daysInMonth = eachDayOfInterval({ 
      start: startOfWeek(startOfMonth(currentMonth)), 
      end: endOfWeek(endOfMonth(currentMonth)) 
    });

    const jumpToToday = () => {
        const today = new Date();
        setCurrentMonth(today);
        setSelectedDate(today);
    };

    const getDayStatus = (day: Date) => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayMeals = meals.filter(m => m.date === dayStr);
        if (dayMeals.length === 0) return 'empty';
        const dayCals = dayMeals.reduce((acc, m) => acc + m.totalCalories, 0);
        return dayCals >= (user?.goals.calories || 2000) ? 'met' : 'partial';
    };

    const mealsForSelectedDate = useMemo(() => {
        const selectedStr = format(selectedDate, 'yyyy-MM-dd');
        return meals.filter(m => m.date === selectedStr).sort((a, b) => b.timestamp - a.timestamp);
    }, [meals, selectedDate]);

    const dailyHistoryTotals = useMemo(() => {
        return mealsForSelectedDate.reduce((acc, meal) => ({
            calories: acc.calories + meal.totalCalories,
            protein: acc.protein + meal.totalProtein,
            carbs: acc.carbs + meal.totalCarbs,
            fat: acc.fat + meal.totalFat,
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    }, [mealsForSelectedDate]);

    return (
        <div className="pb-24 safe-bottom animate-fade-in relative z-10 pt-4 px-2">
             <div className="glass-card rounded-[3rem] p-6 md:p-10 shadow-2xl mb-8">
                 <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
                     <h2 className="text-2xl md:text-3xl font-black flex items-center gap-3">
                        <CalendarIcon size={28} className="text-brand-green" /> History
                     </h2>
                     <div className="flex items-center gap-2">
                         <button 
                            onClick={jumpToToday}
                            className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-green/10 text-brand-green rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-brand-green/20 transition-all active:scale-95"
                         >
                            <CalendarDays size={14} /> Today
                         </button>
                         <div className="flex items-center gap-2 bg-white/50 rounded-2xl p-1 border border-white">
                            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 active:bg-white rounded-xl transition"><ChevronLeft size={18}/></button>
                            <span className="font-black w-32 text-center text-[10px] uppercase tracking-widest">{format(currentMonth, 'MMM yyyy')}</span>
                            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 active:bg-white rounded-xl transition"><ChevronRight size={18}/></button>
                         </div>
                     </div>
                 </div>
                 <div className="grid grid-cols-7 gap-2 md:gap-4">
                     {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                       <div key={d} className="text-center text-[9px] font-black text-gray-400 uppercase tracking-widest">{d}</div>
                     ))}
                     {daysInMonth.map((day, i) => {
                         const status = getDayStatus(day);
                         const isSelectedMonth = isSameMonth(day, currentMonth);
                         const isSelected = isSameDay(day, selectedDate);
                         const isToday = isSameDay(day, new Date());
                         
                         let bgClass = "bg-white/30 active:bg-white/60 border border-white/40";
                         let textClass = isSelectedMonth ? "text-gray-900 font-bold" : "text-gray-200";
                         
                         if (status === 'met') { bgClass = "bg-brand-green text-white"; textClass = "text-white"; }
                         else if (status === 'partial') { bgClass = "bg-orange-100 border-orange-200"; textClass = "text-orange-700"; }
                         
                         return (
                             <button 
                                key={i} 
                                onClick={() => setSelectedDate(day)}
                                className={`aspect-square w-full rounded-xl flex items-center justify-center text-sm transition-all relative
                                    ${bgClass} ${textClass}
                                    ${isSelected ? 'ring-2 ring-brand-green ring-offset-2 scale-110 z-10' : ''}
                                `}
                             >
                                 {format(day, 'd')}
                                 {isToday && !isSelected && <div className="absolute bottom-1 w-1 h-1 bg-brand-green rounded-full"></div>}
                             </button>
                         )
                     })}
                 </div>
             </div>

             <div className="space-y-6">
                <div className="flex justify-between items-center px-4">
                  <h3 className="text-xl font-black text-gray-900">
                      {format(selectedDate, 'MMM do')} Log
                  </h3>
                </div>

                {mealsForSelectedDate.length > 0 && (
                  <div className="glass-card rounded-[2rem] p-6 mx-2 border-brand-green/20 border flex flex-col gap-4 animate-fade-in shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                       <Zap size={16} className="text-brand-green" />
                       <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Daily Nutrition Summary</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="p-2 rounded-2xl bg-brand-green/5 border border-brand-green/10">
                         <span className="block text-[8px] font-black text-brand-green uppercase mb-1">Calories</span>
                         <span className="font-black text-lg text-brand-green">{Math.round(dailyHistoryTotals.calories)}</span>
                      </div>
                      <div className="p-2 rounded-2xl bg-blue-50/50 border border-blue-100/50">
                         <span className="block text-[8px] font-black text-blue-600 uppercase mb-1">Protein</span>
                         <span className="font-black text-lg text-blue-700">{Math.round(dailyHistoryTotals.protein)}g</span>
                      </div>
                      <div className="p-2 rounded-2xl bg-amber-50/50 border border-amber-100/50">
                         <span className="block text-[8px] font-black text-amber-600 uppercase mb-1">Carbs</span>
                         <span className="font-black text-lg text-amber-700">{Math.round(dailyHistoryTotals.carbs)}g</span>
                      </div>
                      <div className="p-2 rounded-2xl bg-rose-50/50 border border-rose-100/50">
                         <span className="block text-[8px] font-black text-rose-600 uppercase mb-1">Fat</span>
                         <span className="font-black text-lg text-rose-700">{Math.round(dailyHistoryTotals.fat)}g</span>
                      </div>
                    </div>
                  </div>
                )}

                {mealsForSelectedDate.length === 0 ? (
                    <div className="glass-card rounded-[3rem] p-12 text-center border-white/60">
                        <p className="text-gray-400 font-bold italic">No logs.</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {mealsForSelectedDate.map((meal) => (
                            <MealCard key={meal.id} meal={meal} onEdit={handleEditMeal} onDelete={(id) => setMeals(meals.filter(m => m.id !== id))} />
                        ))}
                    </div>
                )}
             </div>
        </div>
    );
};

const MealCard: React.FC<{ meal: Meal; onEdit: (meal: Meal) => void; onDelete: (id: string) => void }> = ({ meal, onEdit, onDelete }) => (
    <div className="glass-card p-6 md:p-8 rounded-[2.5rem] shadow-xl active:scale-[0.99] transition-all duration-300">
        <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-4 md:gap-6">
                 {meal.imageUrl && <img src={meal.imageUrl} alt="" className="w-20 h-20 md:w-24 md:h-24 rounded-3xl object-cover shadow-lg ring-2 ring-white" />}
                 <div>
                     <h4 className="font-black text-gray-900 text-xl md:text-2xl tracking-tight mb-1 truncate max-w-[120px] md:max-w-md">{meal.name}</h4>
                     <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest flex items-center gap-2"><Clock size={12}/> {format(meal.timestamp, 'h:mm a')}</p>
                 </div>
            </div>
            <div className="flex gap-1">
                <button className="p-2 text-gray-300 active:text-brand-green" onClick={() => onEdit(meal)}><Pencil size={18} /></button>
                <button className="p-2 text-gray-300 active:text-red-500" onClick={() => onDelete(meal.id)}><X size={20} /></button>
            </div>
        </div>
        <div className="grid grid-cols-4 gap-2 bg-white/40 p-4 rounded-3xl border border-white/50 text-center">
            <div><span className="block text-[8px] text-gray-400 font-black uppercase tracking-widest">Kcal</span><span className="font-black text-brand-green text-lg">{Math.round(meal.totalCalories)}</span></div>
            <div><span className="block text-[8px] text-gray-400 font-black uppercase tracking-widest">P</span><span className="font-black text-gray-900 text-lg">{Math.round(meal.totalProtein)}g</span></div>
            <div><span className="block text-[8px] text-gray-400 font-black uppercase tracking-widest">C</span><span className="font-black text-gray-900 text-lg">{Math.round(meal.totalCarbs)}g</span></div>
            <div><span className="block text-[8px] text-gray-400 font-black uppercase tracking-widest">F</span><span className="font-black text-gray-900 text-lg">{Math.round(meal.totalFat)}g</span></div>
        </div>
    </div>
);

export default App;
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Gender, 
  ActivityLevel, 
  UserProfile, 
  Meal, 
  FoodItem,
  GoalType
} from './types';
import { supabase, isSupabaseConfigured } from './services/supabaseClient';
import { analyzeMealImage } from './services/geminiService';
import { optimizeImage } from './services/imageOptimizer';
import CircularProgress from './components/CircularProgress';
import CameraModal from './components/CameraModal';
import NutritionModal from './components/NutritionModal';
import { 
  Camera, 
  Upload, 
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
  CheckCircle,
  Camera as CameraIcon,
  Target,
  Eye,
  Clock,
  Sparkles,
  CalendarDays,
  Smartphone,
  Mail,
  Loader2,
  LogOut,
  AlertTriangle,
  ShieldCheck,
  Trash2,
  UserCircle,
  Check
} from 'lucide-react';
import { format, isSameDay, subMonths, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth } from 'date-fns';

// Constants
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
  // Global Auth State
  const [session, setSession] = useState<any>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // App Data State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [view, setView] = useState<'auth' | 'onboarding' | 'dashboard' | 'history' | 'profile'>('auth');
  const [showMenu, setShowMenu] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // History View State
  const [historyMonth, setHistoryMonth] = useState(new Date());
  const [historySelectedDate, setHistorySelectedDate] = useState(new Date());
  
  // Tabs state for Dashboard
  const [activeMealTab, setActiveMealTab] = useState(0);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  // Modals state
  const [showCamera, setShowCamera] = useState(false);
  const [showNutritionModal, setShowNutritionModal] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<FoodItem[]>([]);
  const [suggestedMealName, setSuggestedMealName] = useState<string>('');
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  
  // Achievement Animation State
  const [newlyEarnedBadgeId, setNewlyEarnedBadgeId] = useState<string | null>(null);

  // Auth Form State
  const [authMode, setAuthMode] = useState<'signin' | 'otp'>('signin');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // --- INITIALIZATION ---

  useEffect(() => {
    // Attempt to get session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserData(session.user.id);
      } else {
        setView('auth');
        setIsLoadingAuth(false);
      }
    }).catch(err => {
      console.warn("Auth initialization error:", err);
      // Even if it fails (e.g. invalid URL), stop loading so user sees UI
      setIsLoadingAuth(false);
      setView('auth');
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserData(session.user.id);
      } else {
        setMeals([]);
        setUser(null);
        setView('auth');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- SUPABASE DATA FETCHING ---

  const fetchUserData = async (userId: string) => {
    setIsLoadingData(true);
    try {
      // Fetch Profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      // Fetch Meals
      const { data: mealsData, error: mealsError } = await supabase
        .from('meals')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });

      if (profileError && profileError.code === 'PGRST116') {
        // User exists in auth but no profile -> Onboarding
        setView('onboarding');
      } else if (profile) {
        // Map snake_case SQL to camelCase Types
        const mappedUser: UserProfile = {
            name: profile.name,
            age: profile.age,
            gender: profile.gender,
            weight: profile.weight,
            height: profile.height,
            activityLevel: profile.activity_level,
            goals: profile.goals,
            streak: profile.streak,
            lastLoginDate: profile.last_login_date,
            lastLoginTimestamp: Number(profile.last_login_timestamp),
            lastMealTimestamp: Number(profile.last_meal_timestamp),
            earnedBadges: profile.earned_badges || [],
            totalMealsLogged: profile.total_meals_logged || 0
        };

        const mappedMeals: Meal[] = (mealsData || []).map(m => ({
            id: m.id,
            date: m.date,
            timestamp: Number(m.timestamp),
            name: m.name,
            imageUrl: m.image_url,
            items: m.items,
            totalCalories: Number(m.total_calories),
            totalProtein: Number(m.total_protein),
            totalCarbs: Number(m.total_carbs),
            totalFat: Number(m.total_fat)
        }));

        setUser(mappedUser);
        setMeals(mappedMeals);
        
        // Check streak and achievements on load
        const updatedUser = await checkStreak(mappedUser, mappedMeals, false); 
        await checkAchievements(updatedUser, mappedMeals);
        
        setView('dashboard');
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoadingData(false);
      setIsLoadingAuth(false);
    }
  };

  // --- AUTH HANDLERS ---

  const handleGoogleLogin = async () => {
    if (!isSupabaseConfigured) {
      alert("Application is not configured. Please check your .env file or project settings.");
      return;
    }
    setAuthLoading(true);
    
    // Log the redirect URL for debugging purposes
    const redirectUrl = window.location.origin;
    console.log("Attempting Google Auth redirect to:", redirectUrl);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl }
    });
    if (error) alert(error.message);
    setAuthLoading(false);
  };

  const handleGuestLogin = async () => {
    if (!isSupabaseConfigured) {
      alert("Application is not configured.");
      return;
    }
    setAuthLoading(true);
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      alert("Error signing in as guest: " + error.message);
    }
    setAuthLoading(false);
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      alert("Application is not configured. Please check your .env file.");
      return;
    }
    setAuthLoading(true);
    
    // For WhatsApp, we need to specify the channel
    // If you want pure WhatsApp, use options: { channel: 'whatsapp' }
    // If you want standard SMS, remove the options object or use 'sms'
    const { error } = await supabase.auth.signInWithOtp({
      phone: phone,
      // options: { channel: 'whatsapp' } // Uncomment this to force WhatsApp
    });
    
    if (error) {
      alert("Error sending OTP: " + error.message);
    } else {
      setAuthMode('otp');
    }
    setAuthLoading(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      phone: phone,
      token: otp,
      type: 'sms',
    });
    if (error) alert("Invalid OTP");
    setAuthLoading(false);
  };

  const handleLogout = async () => {
      await supabase.auth.signOut();
  };

  // --- UI EFFECTS ---

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
  const checkAchievements = useCallback(async (currentUser: UserProfile, currentMeals: Meal[]) => {
    const existingBadges = new Set(currentUser.earnedBadges || []);
    const earned = new Set<string>(currentUser.earnedBadges || []);
    
    if (currentMeals.length >= 1) earned.add('starter');
    if (currentMeals.length >= 50) earned.add('meal_50');
    
    const mealsWithPhotos = currentMeals.filter(m => m.imageUrl);
    if (mealsWithPhotos.length >= 10) earned.add('photo_10');
    // Note: checking 'blob:' is for local only. Remote check would check storage path.
    const mealsWithCamera = currentMeals.filter(m => m.imageUrl); 
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
      const newBadges = Array.from(earned);
      // Find what's new for animation
      newBadges.forEach(id => {
        if (!existingBadges.has(id)) {
          setNewlyEarnedBadgeId(id);
        }
      });

      // Optimistic Update
      setUser(prev => prev ? { ...prev, earnedBadges: newBadges } : null);

      if (session?.user?.id) {
          // DB Update
          await supabase.from('profiles').update({
              earned_badges: newBadges
          }).eq('id', session.user.id);
      }
    }
  }, [session]);

  /**
   * Streak Logic
   * Returns the updated UserProfile to ensure subsequent checks have fresh data.
   */
  const checkStreak = async (userData: UserProfile, currentMeals: Meal[], isMealLogged: boolean): Promise<UserProfile> => {
    const now = Date.now();
    const lastMeal = userData.lastMealTimestamp || now;
    const lastUpdate = userData.lastLoginTimestamp || now;
    
    const diffMealHours = (now - lastMeal) / 36e5;
    const diffUpdateHours = (now - lastUpdate) / 36e5;

    let newStreak = userData.streak || 1;
    let newLastUpdate = userData.lastLoginTimestamp || now;
    let newLastMeal = userData.lastMealTimestamp || now;

    let hasChanged = false;

    if (isMealLogged) {
      if (diffMealHours >= 48) {
        newStreak = 1;
        newLastUpdate = now;
        hasChanged = true;
      } 
      else if (diffUpdateHours >= 24) {
        newStreak += 1;
        newLastUpdate = now;
        hasChanged = true;
      }
      newLastMeal = now;
      hasChanged = true; // Meal logged always updates meal timestamp
    } else {
      // Just logging in
      if (diffMealHours >= 48) {
        newStreak = 1;
        newLastUpdate = now;
        newLastMeal = now; // Reset meal timer on broken streak
        hasChanged = true;
      }
    }

    if (hasChanged && session?.user?.id) {
        const updates = {
            streak: newStreak,
            last_login_date: format(new Date(), 'yyyy-MM-dd'),
            last_login_timestamp: newLastUpdate,
            last_meal_timestamp: newLastMeal,
            total_meals_logged: currentMeals.length
        };
        
        // Optimistic
        const updatedUser = { ...userData, ...updates } as UserProfile;
        setUser(updatedUser);

        // DB
        await supabase.from('profiles').update(updates).eq('id', session.user.id);
        
        return updatedUser;
    }
    
    return userData;
  };

  const calculateGoals = (age: number, gender: Gender, weight: number, height: number, activity: ActivityLevel, goalType: GoalType) => {
    // Mifflin-St Jeor Equation
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
    let targetCalories = tdee;
    
    // Macro Ratios (Protein/Carb/Fat)
    let pRatio = 0.3; 
    let cRatio = 0.4;
    let fRatio = 0.3;

    if (goalType === GoalType.WEIGHT_LOSS) {
      targetCalories = Math.round(tdee * 0.80); // 20% Deficit
      // Higher protein for satiety and muscle retention
      pRatio = 0.40;
      cRatio = 0.30;
      fRatio = 0.30;
    } else if (goalType === GoalType.MUSCLE_GAIN) {
      targetCalories = Math.round(tdee * 1.10); // 10% Surplus
      // Higher carbs for energy
      pRatio = 0.30;
      cRatio = 0.50;
      fRatio = 0.20;
    } else {
      // Maintenance
      pRatio = 0.30;
      cRatio = 0.35;
      fRatio = 0.35;
    }

    return {
      calories: targetCalories,
      protein: Math.round((targetCalories * pRatio) / 4),
      carbs: Math.round((targetCalories * cRatio) / 4),
      fat: Math.round((targetCalories * fRatio) / 9),
      type: goalType
    };
  };

  const handleOnboardingSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!session?.user?.id) return;

    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    const nameInput = formData.get('name') as string;
    const age = Number(formData.get('age'));
    const weight = Number(formData.get('weight'));
    const height = Number(formData.get('height'));
    const gender = formData.get('gender') as Gender;
    const activity = formData.get('activity') as ActivityLevel;
    const goalType = formData.get('goalType') as GoalType;

    if (!nameInput || nameInput.trim().length === 0) { setIsSaving(false); return alert("Please enter your display name."); }
    if (isNaN(age) || age <= 0 || age > 120) { setIsSaving(false); return alert("Please enter a valid age between 1 and 120 years."); }
    if (isNaN(weight) || weight <= 10 || weight > 600) { setIsSaving(false); return alert("Please enter a valid weight between 10kg and 600kg."); }
    if (isNaN(height) || height <= 50 || height > 280) { setIsSaving(false); return alert("Please enter a valid height between 50cm and 280cm."); }

    const goals = calculateGoals(age, gender, weight, height, activity, goalType);
    const now = Date.now();
    
    const profileData = {
      id: session.user.id,
      email: session.user.email,
      name: nameInput.trim(),
      age,
      gender,
      weight,
      height,
      activity_level: activity,
      goals, // Saves goalType inside the JSON
      streak: user?.streak || 1,
      last_login_date: user?.lastLoginDate || format(new Date(), 'yyyy-MM-dd'),
      last_login_timestamp: user?.lastLoginTimestamp || now,
      last_meal_timestamp: user?.lastMealTimestamp || now,
      earned_badges: user?.earnedBadges || [],
      total_meals_logged: user?.totalMealsLogged || 0
    };

    try {
        const { error } = await supabase.from('profiles').upsert(profileData);
        if (error) throw error;

        const newUser: UserProfile = {
            name: profileData.name,
            age, weight, height, gender, activityLevel: activity,
            goals,
            streak: profileData.streak,
            lastLoginDate: profileData.last_login_date,
            lastLoginTimestamp: profileData.last_login_timestamp,
            lastMealTimestamp: profileData.last_meal_timestamp,
            earnedBadges: profileData.earned_badges,
            totalMealsLogged: profileData.total_meals_logged
        };

        setUser(newUser);
        setView('dashboard');
    } catch (error: any) {
        alert("Error saving profile: " + error.message);
    } finally {
        setIsSaving(false);
    }
  };

  const todayMeals = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return meals.filter(m => m.date === today).sort((a, b) => b.timestamp - a.timestamp);
  }, [meals]);

  // Group meals by date (Moved to top level to avoid conditional hook execution)
  const groupedMeals = useMemo(() => {
      const groups: Record<string, Meal[]> = {};
      meals.forEach(meal => {
          if (!groups[meal.date]) groups[meal.date] = [];
          groups[meal.date].push(meal);
      });
      return groups;
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
      const files = Array.from(e.target.files) as File[];
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
      alert("Failed to analyze image. Please check your connection and API Key.");
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

  const uploadMealImage = async (file: File, userId: string): Promise<string | null> => {
      try {
          // Optimize image before upload to save space
          let fileToUpload = file;
          let fileExt = file.name.split('.').pop();
          
          try {
            fileToUpload = await optimizeImage(file);
            // Optimizer converts to JPEG
            fileExt = 'jpg';
          } catch (optError) {
            console.warn("Optimization failed, using original file", optError);
          }

          const fileName = `${userId}/${Date.now()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
              .from('meal_images')
              .upload(fileName, fileToUpload);
          
          if (uploadError) throw uploadError;

          const { data } = supabase.storage.from('meal_images').getPublicUrl(fileName);
          return data.publicUrl;
      } catch (error) {
          console.error("Upload failed", error);
          return null;
      }
  };

  const saveMeal = async (finalItems: FoodItem[], finalTitle: string) => {
    if (!session?.user?.id) return;
    
    setIsSaving(true);
    try {
        const mealTotals = finalItems.reduce((acc, item) => ({
        calories: acc.calories + (Number(item.calories) || 0),
        protein: acc.protein + (Number(item.protein) || 0),
        carbs: acc.carbs + (Number(item.carbs) || 0),
        fat: acc.fat + (Number(item.fat) || 0),
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

        const mealName = finalTitle || (finalItems.length > 0 ? finalItems[0].name : 'Meal');
        let imageUrl = editingMealId ? meals.find(m => m.id === editingMealId)?.imageUrl : undefined;

        // Handle Image Upload if new image
        if (pendingImages.length > 0) {
            const uploadedUrl = await uploadMealImage(pendingImages[0], session.user.id);
            if (uploadedUrl) imageUrl = uploadedUrl;
        }

        let updatedMealsList = [...meals];

        if (editingMealId) {
        // Update DB
        const { error } = await supabase.from('meals').update({
            name: mealName,
            items: finalItems,
            total_calories: mealTotals.calories,
            total_protein: mealTotals.protein,
            total_carbs: mealTotals.carbs,
            total_fat: mealTotals.fat,
            image_url: imageUrl
        }).eq('id', editingMealId);

        if (error) { throw new Error("Failed to update meal"); }

        // Update State
        updatedMealsList = meals.map(m => m.id === editingMealId ? {
            ...m,
            name: mealName,
            items: finalItems,
            totalCalories: mealTotals.calories,
            totalProtein: mealTotals.protein,
            totalCarbs: mealTotals.carbs,
            totalFat: mealTotals.fat,
            imageUrl: imageUrl
        } : m);
        
        setMeals(updatedMealsList);

        } else {
        // Insert DB
        const newMealData = {
            user_id: session.user.id,
            date: format(new Date(), 'yyyy-MM-dd'),
            timestamp: Date.now(),
            name: mealName,
            items: finalItems,
            total_calories: mealTotals.calories,
            total_protein: mealTotals.protein,
            total_carbs: mealTotals.carbs,
            total_fat: mealTotals.fat,
            image_url: imageUrl
        };

        const { data, error } = await supabase.from('meals').insert(newMealData).select().single();
        
        if (error) { throw new Error("Failed to save meal"); }

        const newMeal: Meal = {
            id: data.id,
            date: data.date,
            timestamp: Number(data.timestamp),
            name: data.name,
            imageUrl: data.image_url,
            items: data.items,
            totalCalories: Number(data.total_calories),
            totalProtein: Number(data.total_protein),
            totalCarbs: Number(data.total_carbs),
            totalFat: Number(data.total_fat)
        };

        updatedMealsList = [newMeal, ...meals];
        setMeals(updatedMealsList);
        setActiveMealTab(0); 
        }

        if (user) {
            // Ensure we check streaks AND achievements with the fresh data
            const updatedUser = await checkStreak(user, updatedMealsList, true);
            await checkAchievements(updatedUser, updatedMealsList);
        }

        setShowNutritionModal(false);
        setPendingImages([]);
        setEditingMealId(null);
        setSuggestedMealName('');
    } catch (error) {
        console.error("Error saving meal:", error);
        alert("Failed to save meal. Please try again.");
    } finally {
        setIsSaving(false);
    }
  };

  // --- VIEW RENDERERS ---

  const renderAuth = () => (
      <div className="min-h-screen flex items-center justify-center p-4 relative z-10 safe-top safe-bottom">
          <div className="w-full max-w-md">
              <div className="text-center mb-10">
                  <div className="inline-flex items-center justify-center w-24 h-24 bg-brand-green text-white rounded-[2.5rem] shadow-2xl shadow-brand-green/30 mb-6 transform rotate-3">
                      <TrendingUp size={48} />
                  </div>
                  <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">NuTrack <span className="text-brand-green">AI</span></h1>
                  <p className="text-gray-500 font-medium">Smart nutrition tracking for your goals.</p>
              </div>

              {!isSupabaseConfigured && (
                <div className="mb-6 bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3">
                   <AlertTriangle className="text-amber-500 shrink-0" size={20} />
                   <div className="text-left">
                     <h3 className="font-bold text-amber-800 text-sm mb-1">Missing Configuration</h3>
                     <p className="text-xs text-amber-700 leading-relaxed">
                       Please set up your <code>.env</code> file with <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to enable login.
                     </p>
                   </div>
                </div>
              )}

              <div className="glass-card p-8 rounded-[2.5rem] shadow-2xl space-y-6">
                 {authMode === 'signin' ? (
                     <>
                        <button 
                            onClick={handleGoogleLogin} 
                            disabled={authLoading}
                            className="w-full py-4 bg-white border-2 border-gray-100 hover:border-brand-green/30 hover:bg-gray-50 text-gray-900 font-black rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-sm"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                            Continue with Google
                        </button>
                        
                        <button 
                            onClick={handleGuestLogin}
                            disabled={authLoading}
                            className="w-full py-4 bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] border border-gray-200"
                        >
                            <UserCircle size={20} className="text-gray-400" />
                            Continue as Guest
                        </button>
                     </>
                 ) : (
                     <form onSubmit={handleVerifyOtp} className="space-y-6">
                         <div className="text-center">
                             <h3 className="text-xl font-black text-gray-900">Verify OTP</h3>
                             <p className="text-sm text-gray-500">Enter code sent to {phone}</p>
                         </div>
                         <div>
                             <input 
                                 type="text" 
                                 placeholder="000000"
                                 value={otp}
                                 onChange={e => setOtp(e.target.value)}
                                 className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-center text-2xl tracking-[0.5em] text-gray-900 focus:outline-none focus:border-brand-green focus:bg-white transition-all"
                                 autoFocus
                                 required
                             />
                         </div>
                         <button 
                            type="submit" 
                            disabled={authLoading}
                            className="w-full py-4 bg-brand-green text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-brand-green/20 uppercase tracking-widest text-xs"
                         >
                            {authLoading ? <Loader2 className="animate-spin" size={18}/> : 'Verify & Login'}
                         </button>
                         <button type="button" onClick={() => setAuthMode('signin')} className="w-full text-center text-xs font-bold text-gray-400 hover:text-gray-900">
                             Back to Login
                         </button>
                     </form>
                 )}
                 <div className="pt-4 border-t border-gray-100 flex justify-center">
                    <button onClick={() => setShowPrivacy(true)} className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest hover:text-brand-green transition-colors">
                        <ShieldCheck size={12} /> Privacy Policy & Terms
                    </button>
                 </div>
              </div>
          </div>
      </div>
  );

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
          <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Display Name</label>
              <input name="name" type="text" required defaultValue={user?.name || ""} placeholder="Your Name" className="w-full p-4 bg-white/50 border border-white rounded-2xl outline-none transition font-bold" />
          </div>
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
              {(Object.values(ActivityLevel) as string[]).map(level => (
                <option key={level} value={level}>{level.split(' (')[0]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Primary Goal</label>
            <select name="goalType" defaultValue={user?.goals?.type || GoalType.MAINTENANCE} className="w-full p-4 bg-white/50 border border-white rounded-2xl outline-none font-bold">
              {(Object.values(GoalType) as string[]).map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <button 
            type="submit" 
            disabled={isSaving}
            className="w-full bg-brand-dark hover:bg-black text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-brand-dark/20 active:scale-[0.98] uppercase tracking-widest mt-4 flex items-center justify-center gap-2"
          >
            {isSaving && <Loader2 className="animate-spin" size={18}/>}
            {user ? 'Update My Plan' : 'Create My Plan'}
          </button>
        </form>
      </div>
    </div>
  );

  const renderNavbar = () => (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-100 p-2 z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-md mx-auto grid grid-cols-4 items-center gap-1">
        <button 
          onClick={() => setView('dashboard')}
          className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${view === 'dashboard' ? 'text-brand-green bg-brand-green/10' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <Menu size={20} strokeWidth={view === 'dashboard' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-widest">Dash</span>
        </button>

        <button 
          onClick={() => setShowCamera(true)}
          className="flex flex-col items-center justify-center -mt-8"
        >
          <div className="w-14 h-14 bg-brand-green text-white rounded-full shadow-xl shadow-brand-green/40 flex items-center justify-center transform transition-transform active:scale-90 border-4 border-white">
            <Camera size={24} />
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest mt-1 text-gray-400">Scan</span>
        </button>

        <button 
          onClick={() => setView('history')}
          className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${view === 'history' ? 'text-brand-green bg-brand-green/10' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <History size={20} strokeWidth={view === 'history' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-widest">History</span>
        </button>

        <button 
          onClick={() => setView('profile')}
          className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${view === 'profile' ? 'text-brand-green bg-brand-green/10' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <User size={20} strokeWidth={view === 'profile' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-widest">Profile</span>
        </button>
      </div>
    </nav>
  );

  const renderDashboard = () => {
    if (!user) return null;
    
    // Calculate progress
    const caloriesProgress = totals.calories;
    const caloriesGoal = user.goals.calories;

    return (
      <div className="pb-32 pt-6 space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex justify-between items-center px-2">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Hello, {user.name.split(' ')[0]}</h1>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{format(new Date(), 'EEEE, MMM do')}</p>
          </div>
          <div className="flex items-center gap-2 bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100">
            <Flame size={16} className="text-orange-500 fill-orange-500" />
            <span className="text-xs font-black text-orange-600">{user.streak} Day Streak</span>
          </div>
        </div>

        {/* Main Progress */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <CircularProgress 
              value={caloriesProgress}
              max={caloriesGoal}
              color="#00A86B" // brand-green
              label="Calories"
              subLabel="Consumed"
           />
           
           <div className="grid grid-cols-2 gap-4">
             {/* Macros */}
             <div className="bg-blue-50/50 p-5 rounded-[2rem] border border-blue-100/50 flex flex-col justify-between">
                <div className="text-blue-500 mb-2"><TrendingUp size={24} /></div>
                <div>
                   <p className="text-2xl font-black text-blue-900">{Math.round(totals.protein)}g</p>
                   <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Protein / {user.goals.protein}g</p>
                   <div className="w-full h-1.5 bg-blue-100 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min((totals.protein / user.goals.protein) * 100, 100)}%` }}></div>
                   </div>
                </div>
             </div>
             
             <div className="bg-amber-50/50 p-5 rounded-[2rem] border border-amber-100/50 flex flex-col justify-between">
                <div className="text-amber-500 mb-2"><Zap size={24} /></div>
                <div>
                   <p className="text-2xl font-black text-amber-900">{Math.round(totals.carbs)}g</p>
                   <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Carbs / {user.goals.carbs}g</p>
                   <div className="w-full h-1.5 bg-amber-100 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min((totals.carbs / user.goals.carbs) * 100, 100)}%` }}></div>
                   </div>
                </div>
             </div>

             <div className="bg-rose-50/50 p-5 rounded-[2rem] border border-rose-100/50 flex flex-col justify-between col-span-2">
                 <div className="flex justify-between items-start">
                    <div className="text-rose-500 mb-2"><Award size={24} /></div>
                    <div className="text-right">
                       <p className="text-2xl font-black text-rose-900">{Math.round(totals.fat)}g</p>
                       <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Fat / {user.goals.fat}g</p>
                    </div>
                 </div>
                 <div className="w-full h-1.5 bg-rose-100 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.min((totals.fat / user.goals.fat) * 100, 100)}%` }}></div>
                 </div>
             </div>
           </div>
        </div>

        {/* Meals Feed */}
        <div>
           <div className="flex justify-between items-center mb-6 px-2">
             <h2 className="text-lg font-black text-gray-900 uppercase tracking-wide">Today's Meals</h2>
             <button 
               onClick={() => { setEditingMealId(null); setSuggestedMealName(''); setCurrentAnalysis([]); setShowNutritionModal(true); }}
               className="text-[10px] font-black bg-gray-900 text-white px-4 py-2 rounded-full uppercase tracking-widest hover:bg-gray-700 transition-colors"
             >
               + Manual Log
             </button>
           </div>
           
           {todayMeals.length === 0 ? (
             <div className="text-center py-10 bg-gray-50 rounded-[2.5rem] border border-dashed border-gray-200">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                  <Camera size={24} />
                </div>
                <p className="text-gray-500 font-bold mb-1">No meals tracked yet</p>
                <p className="text-xs text-gray-400">Tap the camera button to start</p>
             </div>
           ) : (
             <div className="space-y-4">
               {todayMeals.map(meal => (
                 <MealCard 
                   key={meal.id} 
                   meal={meal} 
                   onEdit={handleEditMeal}
                   onDelete={async (id) => {
                       const { error } = await supabase.from('meals').delete().eq('id', id);
                       if (!error) {
                         setMeals(prev => prev.filter(m => m.id !== id));
                       }
                   }}
                 />
               ))}
             </div>
           )}
        </div>
      </div>
    );
  };

  const renderHistory = () => {
    // 1. Calendar Generation
    const monthStart = startOfMonth(historyMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    
    const calendarDays = eachDayOfInterval({
        start: startDate,
        end: endDate
    });

    const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    // 2. Helper to check goals
    const getDayStatus = (date: Date) => {
        if (!user) return { hasData: false, goalMet: false };
        const dateKey = format(date, 'yyyy-MM-dd');
        const mealsForDay = groupedMeals[dateKey] || [];
        if (mealsForDay.length === 0) return { hasData: false, goalMet: false };

        const totalCals = mealsForDay.reduce((acc, m) => acc + m.totalCalories, 0);
        // Goal met if within 10% or +/- 200kcal of target
        const diff = Math.abs(totalCals - user.goals.calories);
        // Allow a buffer (e.g., 150 calories)
        return { hasData: true, goalMet: diff <= 150 };
    };

    // 3. Selected Day Stats
    const selectedDateKey = format(historySelectedDate, 'yyyy-MM-dd');
    const selectedMeals = groupedMeals[selectedDateKey] || [];
    const dayStats = selectedMeals.reduce((acc, meal) => ({
        calories: acc.calories + meal.totalCalories,
        protein: acc.protein + meal.totalProtein,
        carbs: acc.carbs + meal.totalCarbs,
        fat: acc.fat + meal.totalFat,
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    const status = getDayStatus(historySelectedDate);

    return (
        <div className="pb-32 pt-6 space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between px-2">
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">History</h1>
                <div className="flex items-center gap-2 bg-white rounded-full p-1 border border-gray-100 shadow-sm">
                    <button onClick={() => setHistoryMonth(subMonths(historyMonth, 1))} className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
                        <ChevronLeft size={20} />
                    </button>
                    <span className="text-sm font-black text-gray-900 w-24 text-center">
                        {format(historyMonth, 'MMMM yyyy')}
                    </span>
                    <button onClick={() => setHistoryMonth(addMonths(historyMonth, 1))} className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {/* Calendar */}
            <div className="bg-white rounded-[2.5rem] p-6 shadow-xl shadow-gray-200/50 border border-white/60 backdrop-blur-md">
                <div className="grid grid-cols-7 mb-4">
                    {weekDays.map(d => (
                        <div key={d} className="text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">{d}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-y-4">
                    {calendarDays.map((day, i) => {
                        const isSelected = isSameDay(day, historySelectedDate);
                        const isCurrentMonth = isSameMonth(day, historyMonth);
                        const isToday = isSameDay(day, new Date());
                        const { hasData, goalMet } = getDayStatus(day);

                        return (
                            <button 
                                key={i}
                                onClick={() => {
                                    setHistorySelectedDate(day);
                                    // Also switch view month if clicking gray date from prev/next month
                                    if (!isCurrentMonth) {
                                        setHistoryMonth(day);
                                    }
                                }}
                                className={`
                                    relative flex flex-col items-center justify-center h-10 w-10 mx-auto rounded-2xl transition-all duration-300
                                    ${isSelected ? 'bg-brand-dark text-white shadow-lg scale-110 z-10' : ''}
                                    ${!isSelected && isCurrentMonth ? 'text-gray-700 hover:bg-gray-50' : ''}
                                    ${!isSelected && !isCurrentMonth ? 'text-gray-300' : ''}
                                    ${!isSelected && isToday ? 'border-2 border-brand-green/30' : ''}
                                `}
                            >
                                <span className={`text-sm font-bold ${isSelected ? 'text-white' : ''}`}>{format(day, 'd')}</span>
                                
                                {/* Indicators */}
                                {goalMet && (
                                    <div className="absolute -top-1 -right-1 bg-brand-green rounded-full p-0.5 border-2 border-white shadow-sm z-10">
                                        <Check size={8} className="text-white" strokeWidth={4} />
                                    </div>
                                )}
                                
                                {hasData && !goalMet && (
                                     <div className={`absolute bottom-1 w-1 h-1 rounded-full ${isSelected ? 'bg-gray-500' : 'bg-gray-300'}`}></div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Selected Date Summary */}
            <div className="px-2 animate-fade-in" key={selectedDateKey}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                        {format(historySelectedDate, 'EEEE, MMM do')}
                        {status.goalMet && <CheckCircle size={18} className="text-brand-green fill-brand-green/10" />}
                    </h3>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                        {selectedMeals.length} Meals
                    </span>
                </div>

                <div className="grid grid-cols-4 gap-3 mb-6">
                    <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col items-center justify-center">
                        <span className="text-xl font-black text-emerald-700">{Math.round(dayStats.calories)}</span>
                        <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Cals</span>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 flex flex-col items-center justify-center">
                        <span className="text-lg font-black text-blue-700">{Math.round(dayStats.protein)}</span>
                        <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Prot</span>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100 flex flex-col items-center justify-center">
                        <span className="text-lg font-black text-amber-700">{Math.round(dayStats.carbs)}</span>
                        <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Carbs</span>
                    </div>
                    <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100 flex flex-col items-center justify-center">
                        <span className="text-lg font-black text-rose-700">{Math.round(dayStats.fat)}</span>
                        <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest">Fat</span>
                    </div>
                </div>

                <div className="space-y-4">
                    {selectedMeals.length > 0 ? (
                        selectedMeals.map(meal => (
                            <MealCard 
                                key={meal.id} 
                                meal={meal} 
                                onEdit={handleEditMeal}
                                onDelete={async (id) => {
                                    if (window.confirm('Delete this meal?')) {
                                        const { error } = await supabase.from('meals').delete().eq('id', id);
                                        if (!error) setMeals(prev => prev.filter(m => m.id !== id));
                                    }
                                }}
                            />
                        ))
                    ) : (
                         <div className="text-center py-10 bg-white/50 border border-dashed border-gray-200 rounded-[2.5rem]">
                            <p className="text-gray-400 font-bold mb-1">No meals logged</p>
                            <p className="text-xs text-gray-300">Select another date or add a meal</p>
                         </div>
                    )}
                </div>
            </div>
        </div>
    );
  };

  const renderProfile = () => {
      if (!user) return null;
      
      return (
          <div className="pb-32 pt-6 space-y-8 animate-fade-in">
             <div className="flex items-center justify-between px-2">
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">Profile</h1>
                <button onClick={handleLogout} className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200">
                    <LogOut size={20} />
                </button>
             </div>

             <div className="bg-white border border-gray-100 p-6 rounded-[2.5rem] shadow-sm flex items-center gap-6">
                <div className="w-20 h-20 bg-brand-green/10 text-brand-green rounded-full flex items-center justify-center text-2xl font-black">
                    {user.name.charAt(0)}
                </div>
                <div>
                    <h2 className="text-xl font-black text-gray-900">{user.name}</h2>
                    <p className="text-sm font-bold text-gray-400">{user.goals.type}</p>
                    <div className="flex gap-4 mt-3">
                        <div className="text-center">
                            <span className="block text-xs font-black text-gray-900">{user.weight}kg</span>
                            <span className="text-[9px] text-gray-400 uppercase font-bold">Weight</span>
                        </div>
                        <div className="text-center">
                            <span className="block text-xs font-black text-gray-900">{user.height}cm</span>
                            <span className="text-[9px] text-gray-400 uppercase font-bold">Height</span>
                        </div>
                        <div className="text-center">
                            <span className="block text-xs font-black text-gray-900">{user.age}</span>
                            <span className="text-[9px] text-gray-400 uppercase font-bold">Age</span>
                        </div>
                    </div>
                </div>
             </div>

             <div className="px-2">
                 <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">Badges & Achievements</h3>
                 <div className="grid grid-cols-4 gap-4">
                     {Object.entries(BADGES_DATA).map(([id, badge]) => {
                         const isEarned = user.earnedBadges.includes(id);
                         return (
                             <div key={id} className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-2 p-2 text-center transition-all ${isEarned ? 'bg-white shadow-sm border border-gray-100' : 'bg-gray-50 opacity-50 grayscale'}`}>
                                 <div className={`w-8 h-8 rounded-full ${isEarned ? badge.color : 'bg-gray-300'} flex items-center justify-center text-white text-xs`}>
                                     {badge.icon}
                                 </div>
                                 <span className="text-[8px] font-bold leading-tight">{badge.name}</span>
                             </div>
                         );
                     })}
                 </div>
             </div>

             <div className="px-2">
                 <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">Settings</h3>
                 <button onClick={() => setView('onboarding')} className="w-full bg-white border border-gray-100 p-4 rounded-2xl flex items-center justify-between group hover:shadow-md transition-all">
                     <span className="font-bold text-gray-900">Edit Profile & Goals</span>
                     <ChevronRight className="text-gray-300 group-hover:text-brand-green" />
                 </button>
                 <div className="mt-4 text-center">
                     <button onClick={() => setShowPrivacy(true)} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-gray-600">
                         Privacy Policy
                     </button>
                 </div>
             </div>
          </div>
      );
  };

  const renderAchievementCelebration = () => {
    if (!newlyEarnedBadgeId) return null;
    const badge = BADGES_DATA[newlyEarnedBadgeId];
    if (!badge) return null;

    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
        <div className="bg-white rounded-[3rem] p-10 max-w-sm w-full text-center relative overflow-hidden">
           <div className="absolute inset-0 bg-gradient-to-b from-brand-green/20 to-transparent opacity-50"></div>
           <div className={`w-32 h-32 mx-auto ${badge.color} rounded-full flex items-center justify-center text-white shadow-2xl mb-6 animate-bounce`}>
             <div className="scale-150">{badge.icon}</div>
           </div>
           <h2 className="text-3xl font-black text-gray-900 mb-2">Badge Unlocked!</h2>
           <p className="text-xl font-bold text-brand-green mb-4">{badge.name}</p>
           <p className="text-gray-500 font-medium mb-8">{badge.description}</p>
           <button 
             onClick={() => setNewlyEarnedBadgeId(null)}
             className="w-full py-4 bg-gray-900 text-white font-black rounded-2xl hover:bg-black transition-colors"
           >
             Awesome!
           </button>
        </div>
      </div>
    );
  };

  const renderPrivacyModal = () => {
    if (!showPrivacy) return null;
    return (
      <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-[2rem] max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
          <div className="p-6 border-b flex justify-between items-center">
            <h3 className="font-black text-xl">Privacy Policy</h3>
            <button onClick={() => setShowPrivacy(false)} className="p-2 hover:bg-gray-100 rounded-full">
              <X size={24} />
            </button>
          </div>
          <div className="p-6 overflow-y-auto text-sm text-gray-600 space-y-4">
            <p><strong>1. Data Collection:</strong> We store your nutrition logs and profile data securely.</p>
            <p><strong>2. AI Analysis:</strong> Images are processed by Google Gemini API. We do not use them for training.</p>
            <p><strong>3. Deletion:</strong> You can request account deletion at any time.</p>
            <p className="text-xs text-gray-400 mt-8">Last updated: Oct 2023</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="no-scrollbar min-h-screen">
      {view !== 'auth' && view !== 'onboarding' && renderNavbar()}
      <main className="max-w-5xl mx-auto px-2">
        {view === 'auth' && renderAuth()}
        {view === 'onboarding' && renderOnboarding()}
        {view === 'dashboard' && renderDashboard()}
        {view === 'history' && renderHistory()}
        {view === 'profile' && renderProfile()}
      </main>
      {renderAchievementCelebration()}
      {renderPrivacyModal()}
      {showCamera && <CameraModal onClose={() => setShowCamera(false)} onCapture={handleCameraCapture} />}
      {showNutritionModal && (
        <NutritionModal 
            initialTitle={suggestedMealName}
            items={currentAnalysis}
            onCancel={() => { setShowNutritionModal(false); setPendingImages([]); setEditingMealId(null); setSuggestedMealName(''); }}
            onSave={saveMeal}
            isSaving={isSaving}
        />
      )}
    </div>
  );
};

interface MealCardProps {
  meal: Meal;
  onEdit: (meal: Meal) => void;
  onDelete: (id: string) => Promise<void>;
}

const MealCard: React.FC<MealCardProps> = ({ meal, onEdit, onDelete }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-white/60 p-6 rounded-[2.5rem] shadow-sm relative group overflow-hidden hover:shadow-lg transition-all duration-300">
      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 translate-x-4 group-hover:translate-x-0 duration-300">
        <button 
            onClick={(e) => { e.stopPropagation(); onEdit(meal); }} 
            className="p-3 bg-white text-gray-600 rounded-full hover:bg-brand-green hover:text-white transition-colors shadow-md border border-gray-100"
        >
            <Pencil size={16} />
        </button>
        <button 
            onClick={async (e) => { 
                e.stopPropagation(); 
                if (window.confirm('Delete this meal?')) {
                    setIsDeleting(true);
                    await onDelete(meal.id);
                    setIsDeleting(false);
                }
            }} 
            disabled={isDeleting}
            className="p-3 bg-white text-rose-500 rounded-full hover:bg-rose-500 hover:text-white transition-colors shadow-md border border-gray-100 disabled:opacity-50"
        >
            {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
        </button>
      </div>
      
      <div className="flex flex-col md:flex-row gap-6 items-center">
        <div className="relative shrink-0">
            {meal.imageUrl ? (
            <img src={meal.imageUrl} alt={meal.name} className="w-24 h-24 rounded-2xl object-cover shadow-lg shadow-gray-200" />
            ) : (
            <div className="w-24 h-24 rounded-2xl bg-brand-green/5 border border-brand-green/10 flex items-center justify-center text-brand-green">
                <Camera size={28} className="opacity-50" />
            </div>
            )}
        </div>
        
        <div className="flex-1 text-center md:text-left min-w-0 w-full">
           <div className="flex items-center justify-center md:justify-between mb-1">
             <h3 className="text-xl font-black text-gray-900 truncate pr-2">{meal.name}</h3>
             <span className="hidden md:block text-[9px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">{format(new Date(meal.timestamp), 'h:mm a')}</span>
           </div>
           
           <div className="md:hidden text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-4">{format(new Date(meal.timestamp), 'h:mm a')}</div>
           
           <div className="grid grid-cols-4 gap-2 md:gap-4 mt-2">
             <div className="text-center p-2 rounded-2xl bg-emerald-50/50 border border-emerald-100/50">
                <span className="block text-lg font-black text-emerald-700 leading-none mb-1">{Math.round(meal.totalCalories)}</span>
                <span className="text-[7px] font-black text-emerald-400 uppercase tracking-widest">Kcal</span>
             </div>
             <div className="text-center p-2 rounded-2xl bg-blue-50/50 border border-blue-100/50">
                <span className="block text-lg font-black text-blue-700 leading-none mb-1">{Math.round(meal.totalProtein)}</span>
                <span className="text-[7px] font-black text-blue-400 uppercase tracking-widest">Prot</span>
             </div>
             <div className="text-center p-2 rounded-2xl bg-amber-50/50 border border-amber-100/50">
                <span className="block text-lg font-black text-amber-700 leading-none mb-1">{Math.round(meal.totalCarbs)}</span>
                <span className="text-[7px] font-black text-amber-400 uppercase tracking-widest">Carbs</span>
             </div>
             <div className="text-center p-2 rounded-2xl bg-rose-50/50 border border-rose-100/50">
                <span className="block text-lg font-black text-rose-700 leading-none mb-1">{Math.round(meal.totalFat)}</span>
                <span className="text-[7px] font-black text-rose-400 uppercase tracking-widest">Fat</span>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default App;
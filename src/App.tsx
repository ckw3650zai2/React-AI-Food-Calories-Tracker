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
  UserCircle
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
        const {
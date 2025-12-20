
export enum Gender {
  MALE = 'Male',
  FEMALE = 'Female'
}

export enum ActivityLevel {
  SEDENTARY = 'Sedentary (little to no exercise)',
  LIGHT = 'Lightly Active (1-3 days/week)',
  MODERATE = 'Moderately Active (3-5 days/week)',
  ACTIVE = 'Very Active (6-7 days/week)',
  EXTRA = 'Extra Active (physical job or training)'
}

export enum GoalType {
  WEIGHT_LOSS = 'Weight Loss',
  MAINTENANCE = 'Maintenance',
  MUSCLE_GAIN = 'Muscle Gain'
}

export interface NutritionGoals {
  calories: number;
  protein: number; // grams
  carbs: number; // grams
  fat: number; // grams
  type?: GoalType;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string; // Lucide icon name or emoji
  earnedDate?: string;
}

export interface UserProfile {
  name: string;
  age: number;
  gender: Gender;
  weight: number; // kg
  height: number; // cm
  activityLevel: ActivityLevel;
  goals: NutritionGoals;
  streak: number;
  lastLoginDate: string; // YYYY-MM-DD (kept for display)
  lastLoginTimestamp: number; // Used as the "last streak increment" reference
  lastMealTimestamp: number; // Used for the 48h reset "gap" logic
  earnedBadges: string[]; // IDs of earned badges
  totalMealsLogged: number;
}

export interface FoodItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize?: string;
}

export interface Meal {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: number;
  name: string;
  imageUrl?: string;
  items: FoodItem[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}
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

export interface NutritionGoals {
  calories: number;
  protein: number; // grams
  carbs: number; // grams
  fat: number; // grams
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
  lastLoginDate: string; // YYYY-MM-DD
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

import { useState, useCallback } from "react";
import type { Recipe } from "./RecipesPage";

const API = "http://localhost:3001";

interface SaveRecipePayload {
  name: string;
  description: string;
  visibility: "public" | "private";
  tags: string[];
  // Calculator fields — passed from SoapCalcAI
  soapType: "solid" | "liquid";
  batchGrams: number;
  oils: { name: string; pct: number; grams: number }[];
  superfat: number;
  naohWeight: number;
  waterAmount: number;
  lyePurity: number;
  scores: Record<string, number>;
  additives: { name: string; amount: number; unit: string; addAt: string; naohFactor?: number }[];
  fragrances: { name: string; amount: number; mode: string }[];
  notes: string;
  aiGenerated: boolean;
}

interface UseRecipesResult {
  saving:      boolean;
  saveError:   string;
  recipeCount: number;
  saveRecipe:  (token: string, payload: SaveRecipePayload) => Promise<Recipe | null>;
  fetchCount:  (token: string) => Promise<void>;
}

export function useRecipes(): UseRecipesResult {
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState("");
  const [recipeCount, setRecipeCount] = useState(0);

  const fetchCount = useCallback(async (token: string): Promise<void> => {
    try {
      const res  = await fetch(`${API}/auth/usage`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setRecipeCount(data.recipeCount ?? 0);
    } catch { /* silent */ }
  }, []);

  const saveRecipe = useCallback(async (token: string, payload: SaveRecipePayload): Promise<Recipe | null> => {
    setSaving(true);
    setSaveError("");
    try {
      const res  = await fetch(`${API}/recipes`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? "Save failed.");
        return null;
      }
      setRecipeCount(c => c + 1);
      return data as Recipe;
    } catch {
      setSaveError("Network error. Please try again.");
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  return { saving, saveError, recipeCount, saveRecipe, fetchCount };
}

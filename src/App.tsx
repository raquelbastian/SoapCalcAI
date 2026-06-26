import { useState, FC } from "react";
import { useAuth } from "./useAuth";
import AuthPage from "./AuthPage";
import SoapCalcAI from "./SoapCalcAI";
import PricingPage from "./PricingPage";
import RecipesPage from "./RecipesPage";
import type { Recipe } from "./RecipesPage";
import BatchPage from "./BatchPage";

type Page = "calculator" | "pricing" | "recipes" | "batches";

const LoadingScreen: FC = () => (
  <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#0A0908", fontFamily:"Inter,sans-serif" }}>
    <div style={{ textAlign:"center" }}>
      <svg style={{ width:32,height:32,color:"#C49A3C",margin:"0 auto 12px",display:"block" }} viewBox="0 0 24 24" fill="none" className="spin">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/>
        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
      </svg>
      <p style={{ color:"#4A4540", fontSize:13 }}>Loading SoapCalcAI…</p>
    </div>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin .8s linear infinite}`}</style>
  </div>
);

export default function App(): JSX.Element {
  const auth = useAuth();
  const [page, setPage]               = useState<Page>("calculator");
  const [loadedRecipe, setLoadedRecipe] = useState<Recipe | null>(null);

  if (auth.loading)          return <LoadingScreen />;
  if (!auth.isAuthenticated) return <AuthPage auth={auth} />;

  if (page === "pricing")  return (
    <PricingPage onBack={() => setPage("calculator")} onSelectFree={() => setPage("calculator")}
      onSelectPremium={() => alert("Stripe checkout coming soon!")} />
  );

  if (page === "recipes")  return (
    <RecipesPage authToken={auth.token!} currentUser={auth.user!}
      onBack={() => setPage("calculator")}
      onLoadRecipe={(r) => { setLoadedRecipe(r); setPage("calculator"); }} />
  );

  if (page === "batches")  return (
    <BatchPage authToken={auth.token!} currentUser={auth.user!}
      onBack={() => setPage("calculator")} />
  );

  return (
    <SoapCalcAI
      authToken={auth.token ?? undefined}
      currentUser={auth.user ?? undefined}
      onLogout={auth.logout}
      onViewPricing={() => setPage("pricing")}
      onViewRecipes={() => setPage("recipes")}
      onViewBatches={() => setPage("batches")}
      loadedRecipe={loadedRecipe}
      onRecipeLoaded={() => setLoadedRecipe(null)}
    />
  );
}
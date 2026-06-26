import { useState, useEffect, useCallback, FC, ChangeEvent } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface OilEntry { name: string; pct: number; grams: number; }
interface Additive  { name: string; amount: number; unit: string; addAt: string; }

export interface Recipe {
  _id: string;
  userId: string;
  authorName: string;
  name: string;
  description: string;
  soapType: "solid" | "liquid";
  batchGrams: number;
  oils: OilEntry[];
  superfat: number;
  naohWeight: number;
  waterAmount: number;
  lyePurity: number;
  scores: Record<string, number>;
  additives: Additive[];
  fragrances: { name: string; amount: number; mode: string }[];
  notes: string;
  visibility: "public" | "private";
  aiGenerated: boolean;
  likes: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

type TabType = "my" | "community";

interface RecipesPageProps {
  authToken: string;
  currentUser: { name: string; email: string; plan: "free" | "premium" };
  onBack: () => void;
  onLoadRecipe?: (recipe: Recipe) => void;
}

const API = "http://localhost:3001";

// ── Icons ─────────────────────────────────────────────────────────────────────
const FlameIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" style={{ color: "#C49A3C" }}>
    <path d="M12 2C12 2 9 7 9 11C9 13.2 10.3 15 12 15C13.7 15 15 13.2 15 11C15 9 14 7 13 6C13 6 16 8 16 13C16 17.4 14.2 20 12 20C9.8 20 8 17.4 8 13C8 8.5 10 5 12 2Z" fill="currentColor" opacity="0.3"/>
    <path d="M12 22C9.2 22 7 19.5 7 16.5C7 13 9 11 10 9C10 11 11 12.5 12 12.5C13 12.5 14 11 14 9C15 11 17 13 17 16.5C17 19.5 14.8 22 12 22Z" fill="currentColor"/>
  </svg>
);

// ── Score pill ────────────────────────────────────────────────────────────────
const ScorePill: FC<{ label: string; value: number; ideal: [number, number] }> = ({ label, value, ideal }) => {
  const ok = value >= ideal[0] && value <= ideal[1];
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
      style={{ background: ok ? "#0F2A10" : "#1C1A17", border: `1px solid ${ok ? "#2A6A2A" : "#2C2820"}` }}>
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: ok ? "#4CAF50" : "#6B6560" }} />
      <span className="text-xs" style={{ color: ok ? "#60B060" : "#6B6560" }}>{label}</span>
      <span className="text-xs font-mono font-bold" style={{ color: ok ? "#4CAF50" : "#9A9490" }}>{Math.round(value)}</span>
    </div>
  );
};

// ── Recipe card ───────────────────────────────────────────────────────────────
interface RecipeCardProps {
  recipe: Recipe;
  isOwner: boolean;
  onLoad: (r: Recipe) => void;
  onToggleVisibility: (id: string, current: "public" | "private") => void;
  onDelete: (id: string) => void;
  onLike: (id: string) => void;
}

const RecipeCard: FC<RecipeCardProps> = ({ recipe, isOwner, onLoad, onToggleVisibility, onDelete, onLike }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="rounded-2xl overflow-hidden transition-all"
      style={{ background: "#141210", border: "1px solid #2C2820" }}>

      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  background: recipe.soapType === "liquid" ? "#0A1520" : "#1C1A17",
                  color: recipe.soapType === "liquid" ? "#5BA3C9" : "#C49A3C",
                  border: `1px solid ${recipe.soapType === "liquid" ? "#1A3A5A" : "#3C3428"}`,
                }}>
                {recipe.soapType === "liquid" ? "💧 Liquid" : "🔥 Solid Bar"}
              </span>
              {recipe.aiGenerated && (
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: "#1A1A2A", border: "1px solid #2A2A4A", color: "#8080C0" }}>
                  ✦ AI
                </span>
              )}
              {isOwner && (
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    background: recipe.visibility === "public" ? "#0F2A10" : "#1C1A17",
                    color: recipe.visibility === "public" ? "#60B060" : "#6B6560",
                    border: `1px solid ${recipe.visibility === "public" ? "#2A5A2A" : "#2C2820"}`,
                  }}>
                  {recipe.visibility === "public" ? "🌐 Public" : "🔒 Private"}
                </span>
              )}
            </div>
            <h3 className="font-bold text-sm leading-tight" style={{ fontFamily: "Playfair Display, serif", color: "#F5F0E8" }}>
              {recipe.name}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "#6B6560" }}>by {recipe.authorName}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-mono" style={{ color: "#4A4540" }}>{recipe.batchGrams}g</p>
            <p className="text-xs" style={{ color: "#4A4540" }}>{recipe.superfat}% SF</p>
          </div>
        </div>

        {recipe.description && (
          <p className="text-xs leading-relaxed mb-3 line-clamp-2" style={{ color: "#6B6560" }}>
            {recipe.description}
          </p>
        )}

        {/* Oil blend pills */}
        <div className="flex flex-wrap gap-1 mb-3">
          {recipe.oils.slice(0, 4).map(o => (
            <span key={o.name} className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "#1C1A17", border: "1px solid #2C2820", color: "#9A9490" }}>
              {o.name} {o.pct}%
            </span>
          ))}
          {recipe.oils.length > 4 && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: "#4A4540" }}>
              +{recipe.oils.length - 4} more
            </span>
          )}
        </div>

        {/* Scores */}
        {recipe.scores && Object.keys(recipe.scores).length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            <ScorePill label="Cond."   value={recipe.scores.condition   ?? 0} ideal={[44,69]} />
            <ScorePill label="Clean."  value={recipe.scores.cleansing   ?? 0} ideal={[12,22]} />
            <ScorePill label="Lather"  value={recipe.scores.bubblyLather ?? 0} ideal={[14,46]} />
          </div>
        )}

        {/* Tags */}
        {recipe.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {recipe.tags.map(t => (
              <span key={t} className="text-xs px-1.5 py-0.5 rounded"
                style={{ background: "#1C1A17", color: "#4A4540" }}>#{t}</span>
            ))}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderTop: "1px solid #1C1A17" }}>
        <button onClick={() => onLike(recipe._id)}
          className="flex items-center gap-1.5 text-xs transition-all"
          style={{ color: "#6B6560", background: "none", border: "none", cursor: "pointer" }}>
          ♥ {recipe.likes}
        </button>

        <span className="text-xs" style={{ color: "#2C2820" }}>·</span>
        <span className="text-xs" style={{ color: "#3C3830" }}>
          {new Date(recipe.updatedAt).toLocaleDateString()}
        </span>

        <div className="flex items-center gap-2 ml-auto">
          {isOwner && (
            <>
              <button
                onClick={() => onToggleVisibility(recipe._id, recipe.visibility)}
                className="text-xs px-2.5 py-1.5 rounded-lg transition-all"
                style={{ background: "#1C1A17", border: "1px solid #2C2820", color: "#6B6560", cursor: "pointer" }}>
                {recipe.visibility === "public" ? "Make private" : "Publish"}
              </button>

              {confirmDelete ? (
                <div className="flex items-center gap-1">
                  <button onClick={() => onDelete(recipe._id)}
                    className="text-xs px-2.5 py-1.5 rounded-lg"
                    style={{ background: "#3A1010", border: "1px solid #7A3A2A", color: "#E06040", cursor: "pointer" }}>
                    Confirm
                  </button>
                  <button onClick={() => setConfirmDelete(false)}
                    className="text-xs px-2.5 py-1.5 rounded-lg"
                    style={{ background: "#1C1A17", border: "1px solid #2C2820", color: "#6B6560", cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)}
                  className="text-xs px-2.5 py-1.5 rounded-lg transition-all"
                  style={{ background: "#1C1A17", border: "1px solid #2C2820", color: "#4A4540", cursor: "pointer" }}>
                  🗑
                </button>
              )}
            </>
          )}
          <button onClick={() => onLoad(recipe)}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
            style={{ background: "linear-gradient(135deg,#C49A3C,#8B6A2A)", color: "#0A0908", cursor: "pointer", border: "none" }}>
            Load →
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Save Recipe Modal ─────────────────────────────────────────────────────────
interface SaveModalProps {
  onSave: (data: { name: string; description: string; visibility: "public"|"private"; tags: string[] }) => void;
  onClose: () => void;
  loading: boolean;
  error: string;
  plan: "free" | "premium";
  recipeCount: number;
}

const SaveModal: FC<SaveModalProps> = ({ onSave, onClose, loading, error, plan, recipeCount }) => {
  const [name, setName]       = useState("");
  const [desc, setDesc]       = useState("");
  const [vis, setVis]         = useState<"public"|"private">("private");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags]       = useState<string[]>([]);

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g,"");
    if (t && tags.length < 8 && !tags.includes(t)) { setTags([...tags, t]); setTagInput(""); }
  };

  const atLimit = plan === "free" && recipeCount >= 2;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-md rounded-2xl p-6" style={{ background: "#141210", border: "1px solid #3C3428" }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold" style={{ fontFamily:"Playfair Display,serif", color:"#F5F0E8" }}>Save Recipe</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#6B6560", fontSize:20 }}>✕</button>
        </div>

        {atLimit ? (
          <div className="text-center py-4">
            <p className="text-sm mb-3" style={{ color:"#E06040" }}>
              You've reached the free plan limit of 2 saved recipes.
            </p>
            <p className="text-xs mb-4" style={{ color:"#6B6560" }}>Upgrade to Premium for unlimited recipe saving.</p>
            <button onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-sm font-bold"
              style={{ background:"linear-gradient(135deg,#C49A3C,#8B6A2A)", color:"#0A0908", border:"none", cursor:"pointer" }}>
              Upgrade to Premium ✦
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-xs uppercase tracking-widest font-semibold mb-1.5" style={{ color:"#6B6560" }}>Recipe Name *</label>
              <input type="text" value={name} onChange={(e:ChangeEvent<HTMLInputElement>)=>setName(e.target.value)}
                placeholder="e.g. Papaya Glow Bar"
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background:"#0F0D0B", border:"1px solid #2C2820", color:"#F5F0E8" }} />
            </div>

            <div className="mb-4">
              <label className="block text-xs uppercase tracking-widest font-semibold mb-1.5" style={{ color:"#6B6560" }}>Description</label>
              <textarea value={desc} onChange={(e:ChangeEvent<HTMLTextAreaElement>)=>setDesc(e.target.value)}
                placeholder="What makes this recipe special?"
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
                style={{ background:"#0F0D0B", border:"1px solid #2C2820", color:"#F5F0E8", fontFamily:"Inter,sans-serif" }} />
            </div>

            {/* Tags */}
            <div className="mb-4">
              <label className="block text-xs uppercase tracking-widest font-semibold mb-1.5" style={{ color:"#6B6560" }}>Tags</label>
              <div className="flex gap-2 mb-2">
                <input type="text" value={tagInput} onChange={(e:ChangeEvent<HTMLInputElement>)=>setTagInput(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&(e.preventDefault(),addTag())}
                  placeholder="e.g. conditioning"
                  className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background:"#0F0D0B", border:"1px solid #2C2820", color:"#F5F0E8" }} />
                <button onClick={addTag}
                  className="px-3 py-2 rounded-lg text-sm"
                  style={{ background:"#1C1A17", border:"1px solid #3C3428", color:"#C49A3C", cursor:"pointer" }}>Add</button>
              </div>
              <div className="flex flex-wrap gap-1">
                {tags.map(t=>(
                  <span key={t} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                    style={{ background:"#1C1A17", border:"1px solid #2C2820", color:"#9A9490" }}>
                    #{t}
                    <button onClick={()=>setTags(tags.filter(x=>x!==t))}
                      style={{ background:"none",border:"none",cursor:"pointer",color:"#6B6560",padding:0,lineHeight:1 }}>✕</button>
                  </span>
                ))}
              </div>
            </div>

            {/* Visibility */}
            <div className="mb-5">
              <label className="block text-xs uppercase tracking-widest font-semibold mb-2" style={{ color:"#6B6560" }}>Visibility</label>
              <div className="grid grid-cols-2 gap-2">
                {(["private","public"] as const).map(v=>(
                  <button key={v} onClick={()=>setVis(v)}
                    className="p-3 rounded-xl text-left transition-all"
                    style={{
                      background: vis===v ? (v==="public"?"#0F2A10":"#1C1A17") : "#0F0D0B",
                      border: `1px solid ${vis===v ? (v==="public"?"#2A6A2A":"#C49A3C") : "#2C2820"}`,
                      cursor:"pointer",
                    }}>
                    <div className="text-sm font-semibold mb-0.5"
                      style={{ color: vis===v ? (v==="public"?"#60B060":"#C49A3C") : "#6B6560" }}>
                      {v==="public" ? "🌐 Public" : "🔒 Private"}
                    </div>
                    <div className="text-xs" style={{ color:"#4A4540" }}>
                      {v==="public" ? "Visible in community feed" : "Only you can see this"}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-xs mb-3 px-1" style={{ color:"#E06040" }}>⚠ {error}</p>}

            <div className="flex gap-2">
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{ background:"#1C1A17", border:"1px solid #2C2820", color:"#6B6560", cursor:"pointer" }}>
                Cancel
              </button>
              <button onClick={()=>onSave({ name:name.trim()||"Untitled Recipe", description:desc.trim(), visibility:vis, tags })}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
                style={{ background:"linear-gradient(135deg,#C49A3C,#8B6A2A)", color:"#0A0908", border:"none", cursor:"pointer" }}>
                {loading ? "Saving…" : "Save Recipe ✦"}
              </button>
            </div>

            {plan==="free" && (
              <p className="text-center text-xs mt-3" style={{ color:"#3C3830" }}>
                {2 - recipeCount} save slot{2 - recipeCount !== 1 ? "s" : ""} remaining on Free plan
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ── Main RecipesPage ──────────────────────────────────────────────────────────
export default function RecipesPage({ authToken, currentUser, onBack, onLoadRecipe }: RecipesPageProps): JSX.Element {
  const [tab,            setTab]            = useState<TabType>("my");
  const [myRecipes,      setMyRecipes]      = useState<Recipe[]>([]);
  const [community,      setCommunity]      = useState<Recipe[]>([]);
  const [communityTotal, setCommunityTotal] = useState(0);
  const [commPage,       setCommPage]       = useState(1);
  const [loading,        setLoading]        = useState(false);
  const [filterType,     setFilterType]     = useState<string>("");
  const [recipeCount,    setRecipeCount]    = useState(0);

  const headers = { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" };

  // Fetch my recipes
  const fetchMy = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/recipes/my`, { headers });
      const data = await res.json();
      setMyRecipes(Array.isArray(data) ? data : []);
      setRecipeCount(Array.isArray(data) ? data.length : 0);
    } finally { setLoading(false); }
  }, [authToken]);

  // Fetch community
  const fetchCommunity = useCallback(async (page = 1, type = filterType) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "12" });
      if (type) params.set("type", type);
      const res  = await fetch(`${API}/recipes/community?${params}`);
      const data = await res.json();
      setCommunity(data.recipes ?? []);
      setCommunityTotal(data.total ?? 0);
      setCommPage(page);
    } finally { setLoading(false); }
  }, [authToken, filterType]);

  useEffect(() => { fetchMy(); }, [fetchMy]);
  useEffect(() => { if (tab === "community") fetchCommunity(1); }, [tab]);

  const toggleVisibility = async (id: string, current: "public"|"private") => {
    const next = current === "public" ? "private" : "public";
    await fetch(`${API}/recipes/${id}`, { method:"PUT", headers, body: JSON.stringify({ visibility: next }) });
    fetchMy();
  };

  const deleteRecipe = async (id: string) => {
    await fetch(`${API}/recipes/${id}`, { method:"DELETE", headers });
    fetchMy();
  };

  const likeRecipe = async (id: string) => {
    await fetch(`${API}/recipes/${id}/like`, { method:"POST", headers });
    fetchCommunity(commPage);
  };

  const handleLoad = (r: Recipe) => { onLoadRecipe?.(r); onBack(); };

  return (
    <div className="min-h-screen p-4 md:p-8"
      style={{ background:"linear-gradient(135deg,#0A0908 0%,#0F0D0B 50%,#0A0908 100%)", fontFamily:"Inter,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;500;600&display=swap');
        * { box-sizing:border-box; }
        .line-clamp-2 { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        textarea::placeholder, input::placeholder { color:#3C3830; }
      `}</style>

      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack}
            className="flex items-center gap-2 text-sm transition-all"
            style={{ color:"#6B6560", background:"none", border:"none", cursor:"pointer" }}>
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
              <path d="M19 12H5M5 12l7 7M5 12l7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to calculator
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <FlameIcon/>
            <span className="font-bold" style={{ fontFamily:"Playfair Display,serif", color:"#F5F0E8" }}>
              SoapCalc<span style={{ color:"#C49A3C" }}>AI</span> · Recipes
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex rounded-2xl p-1 mb-6" style={{ background:"#141210", border:"1px solid #2C2820", width:"fit-content" }}>
          {([["my","📖 My Recipes"],["community","🌐 Community"]] as [TabType,string][]).map(([t,label])=>(
            <button key={t} onClick={()=>setTab(t)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background:tab===t?"linear-gradient(135deg,#C49A3C,#8B6A2A)":"transparent",
                       color:tab===t?"#0A0908":"#6B6560", border:"none", cursor:"pointer" }}>
              {label}
              {t==="my" && (
                <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background:tab==="my"?"rgba(0,0,0,0.2)":"#1C1A17", color:tab==="my"?"#0A0908":"#6B6560" }}>
                  {myRecipes.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── My Recipes ── */}
        {tab === "my" && (
          <>
            {/* Free tier bar */}
            {currentUser.plan === "free" && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-4"
                style={{ background:"#1C1A17", border:"1px solid #3C3428" }}>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1.5" style={{ color:"#6B6560" }}>
                    <span>Saved recipes</span>
                    <span style={{ color:"#C49A3C" }}>{recipeCount} / 2</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background:"#2C2820" }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width:`${(recipeCount/2)*100}%`, background:"linear-gradient(to right,#C49A3C,#8B6A2A)" }}/>
                  </div>
                </div>
                <span className="text-xs" style={{ color:"#4A4540" }}>Free plan</span>
              </div>
            )}

            {loading ? (
              <div className="text-center py-16" style={{ color:"#4A4540" }}>Loading recipes…</div>
            ) : myRecipes.length === 0 ? (
              <div className="text-center py-16 rounded-2xl" style={{ background:"#141210", border:"1px solid #2C2820" }}>
                <p className="text-2xl mb-3">📖</p>
                <p className="font-semibold mb-2" style={{ color:"#F5F0E8", fontFamily:"Playfair Display,serif" }}>No saved recipes yet</p>
                <p className="text-sm mb-4" style={{ color:"#6B6560" }}>Build a soap in the calculator and save it here.</p>
                <button onClick={onBack}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background:"linear-gradient(135deg,#C49A3C,#8B6A2A)", color:"#0A0908", border:"none", cursor:"pointer" }}>
                  Open Calculator →
                </button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {myRecipes.map(r => (
                  <RecipeCard key={r._id} recipe={r} isOwner
                    onLoad={handleLoad}
                    onToggleVisibility={toggleVisibility}
                    onDelete={deleteRecipe}
                    onLike={likeRecipe}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Community ── */}
        {tab === "community" && (
          <>
            {/* Filters */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="text-xs" style={{ color:"#6B6560" }}>Filter:</span>
              {[["","All"],["solid","Solid Bar"],["liquid","Liquid Soap"]].map(([v,l])=>(
                <button key={v} onClick={()=>{ setFilterType(v); fetchCommunity(1,v); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: filterType===v?"#C49A3C":"#1C1A17",
                    color: filterType===v?"#0A0908":"#6B6560",
                    border: filterType===v?"none":"1px solid #2C2820",
                    cursor:"pointer",
                  }}>{l}</button>
              ))}
              <span className="text-xs ml-auto" style={{ color:"#4A4540" }}>{communityTotal} recipes</span>
            </div>

            {loading ? (
              <div className="text-center py-16" style={{ color:"#4A4540" }}>Loading community recipes…</div>
            ) : community.length === 0 ? (
              <div className="text-center py-16 rounded-2xl" style={{ background:"#141210", border:"1px solid #2C2820" }}>
                <p className="text-2xl mb-3">🌐</p>
                <p className="font-semibold mb-2" style={{ color:"#F5F0E8" }}>No public recipes yet</p>
                <p className="text-sm" style={{ color:"#6B6560" }}>Be the first to publish a recipe!</p>
              </div>
            ) : (
              <>
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  {community.map(r => (
                    <RecipeCard key={r._id} recipe={r}
                      isOwner={r.userId === ""}
                      onLoad={handleLoad}
                      onToggleVisibility={toggleVisibility}
                      onDelete={deleteRecipe}
                      onLike={likeRecipe}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {communityTotal > 12 && (
                  <div className="flex items-center justify-center gap-2">
                    <button disabled={commPage<=1} onClick={()=>fetchCommunity(commPage-1)}
                      className="px-4 py-2 rounded-lg text-sm disabled:opacity-30"
                      style={{ background:"#1C1A17", border:"1px solid #2C2820", color:"#9A9490", cursor:"pointer" }}>
                      ← Prev
                    </button>
                    <span className="text-sm" style={{ color:"#6B6560" }}>
                      Page {commPage} of {Math.ceil(communityTotal/12)}
                    </span>
                    <button disabled={commPage>=Math.ceil(communityTotal/12)} onClick={()=>fetchCommunity(commPage+1)}
                      className="px-4 py-2 rounded-lg text-sm disabled:opacity-30"
                      style={{ background:"#1C1A17", border:"1px solid #2C2820", color:"#9A9490", cursor:"pointer" }}>
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Export SaveModal for use in SoapCalcAI.tsx ───────────────────────────────
export { SaveModal };
export type { SaveModalProps };

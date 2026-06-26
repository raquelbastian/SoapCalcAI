import { useState, useEffect, useCallback, FC, ChangeEvent } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type BatchStatus = "making" | "curing" | "ready" | "sold_out" | "failed";

interface OilCost {
  name: string;
  grams: number;
  pricePerKg: number; // PHP per kg
}

interface BatchDoc {
  _id: string;
  userId: string;
  recipeId?: string;
  recipeName: string;
  batchNumber: string;
  date: string;
  batchSizeGrams: number;
  barsCount: number;
  gramsPerBar: number;
  status: BatchStatus;
  notes: string;
  rating: number; // 1-5
  oilCosts: OilCost[];
  laborCostPerHour: number;
  laborHours: number;
  overheadPct: number; // % markup for overhead
  marginPct: number;   // % profit margin
  // AI analysis
  aiAnalysis?: string;
  aiSuggestions?: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

interface BatchPageProps {
  authToken: string;
  currentUser: { name: string; email: string; plan: "free" | "premium" };
  onBack: () => void;
}

const API = "http://localhost:3001";

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<BatchStatus, { label: string; color: string; bg: string; border: string }> = {
  making:   { label: "🧪 Making",   color: "#5BA3C9", bg: "#0A1520", border: "#1A3A5A" },
  curing:   { label: "⏳ Curing",   color: "#C49A3C", bg: "#1A1408", border: "#3C3428" },
  ready:    { label: "✅ Ready",    color: "#4CAF50", bg: "#0F2010", border: "#2A5020" },
  sold_out: { label: "📦 Sold Out", color: "#9A9490", bg: "#1C1A17", border: "#2C2820" },
  failed:   { label: "❌ Failed",   color: "#E06040", bg: "#1A0808", border: "#4A2020" },
};


// ── Currency config ───────────────────────────────────────────────────────────
const CURRENCIES = [
  { code: "PHP", symbol: "₱", name: "Philippine Peso" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit" },
  { code: "THB", symbol: "฿", name: "Thai Baht" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
];

const getCurrencySymbol = (code: string): string =>
  CURRENCIES.find(c => c.code === code)?.symbol ?? code;

// ── Icons ─────────────────────────────────────────────────────────────────────
const FlameIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" style={{ color: "#C49A3C" }}>
    <path d="M12 2C12 2 9 7 9 11C9 13.2 10.3 15 12 15C13.7 15 15 13.2 15 11C15 9 14 7 13 6C13 6 16 8 16 13C16 17.4 14.2 20 12 20C9.8 20 8 17.4 8 13C8 8.5 10 5 12 2Z" fill="currentColor" opacity="0.3"/>
    <path d="M12 22C9.2 22 7 19.5 7 16.5C7 13 9 11 10 9C10 11 11 12.5 12 12.5C13 12.5 14 11 14 9C15 11 17 13 17 16.5C17 19.5 14.8 22 12 22Z" fill="currentColor"/>
  </svg>
);
const SparkleIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
    <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" fill="currentColor"/>
  </svg>
);
const PlusIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const TrashIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5">
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const ChevronDownIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const ChevronUpIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
    <path d="M18 15l-6-6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ── Star rating ───────────────────────────────────────────────────────────────
const StarRating: FC<{ value: number; onChange: (v: number) => void }> = ({ value, onChange }) => (
  <div className="flex gap-1">
    {[1,2,3,4,5].map(s => (
      <button key={s} onClick={() => onChange(s)}
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20,
          color: s <= value ? "#C49A3C" : "#2C2820" }}>
        ★
      </button>
    ))}
  </div>
);

// ── Cost calculator ───────────────────────────────────────────────────────────
function computeCosts(batch: Partial<BatchDoc>) {
  const oilCost = (batch.oilCosts ?? []).reduce((sum, o) =>
    sum + (o.grams / 1000) * o.pricePerKg, 0);
  const laborCost = (batch.laborCostPerHour ?? 0) * (batch.laborHours ?? 0);
  const subtotal  = oilCost + laborCost;
  const overhead  = subtotal * ((batch.overheadPct ?? 0) / 100);
  const totalCost = subtotal + overhead;
  const bars      = batch.barsCount ?? 1;
  const costPerBar = bars > 0 ? totalCost / bars : 0;
  const sellingPrice = costPerBar * (1 + (batch.marginPct ?? 0) / 100);
  return { oilCost, laborCost, overhead, totalCost, costPerBar, sellingPrice };
}

// ── Batch form modal ──────────────────────────────────────────────────────────
interface BatchFormProps {
  initial?: Partial<BatchDoc>;
  onSave: (data: Partial<BatchDoc>) => Promise<void>;
  onClose: () => void;
  saving: boolean;
  recipes: { _id: string; name: string; oils: { name: string; grams: number }[] }[];
}

const BatchForm: FC<BatchFormProps> = ({ initial, onSave, onClose, saving, recipes }) => {
  const [form, setForm] = useState<Partial<BatchDoc>>({
    recipeName:       initial?.recipeName       ?? "",
    recipeId:         initial?.recipeId         ?? "",
    batchNumber:      initial?.batchNumber       ?? `B-${Date.now().toString().slice(-6)}`,
    date:             initial?.date             ?? new Date().toISOString().split("T")[0],
    batchSizeGrams:   initial?.batchSizeGrams   ?? 1000,
    barsCount:        initial?.barsCount        ?? 10,
    gramsPerBar:      initial?.gramsPerBar      ?? 100,
    status:           initial?.status           ?? "making",
    notes:            initial?.notes            ?? "",
    rating:           initial?.rating           ?? 0,
    oilCosts:         initial?.oilCosts         ?? [],
    laborCostPerHour: initial?.laborCostPerHour ?? 150,
    laborHours:       initial?.laborHours       ?? 2,
    overheadPct:      initial?.overheadPct      ?? 20,
    marginPct:        initial?.marginPct        ?? 40,
    currency:         initial?.currency         ?? "PHP",
    ...initial,
  });
  const [section, setSection] = useState<"basic"|"cost"|"notes">("basic");

  const costs = computeCosts(form);

  const set = (field: keyof BatchDoc, value: any) =>
    setForm(p => ({ ...p, [field]: value }));

  const onRecipeChange = (recipeId: string) => {
    const recipe = recipes.find(r => r._id === recipeId);
    if (recipe) {
      set("recipeId", recipeId);
      set("recipeName", recipe.name);
      // Pre-populate oil costs from recipe
      const oilCosts: OilCost[] = recipe.oils.map(o => ({
        name: o.name, grams: o.grams, pricePerKg: 200,
      }));
      set("oilCosts", oilCosts);
    }
  };

  const inputStyle = {
    background: "#0F0D0B", border: "1px solid #2C2820",
    color: "#F5F0E8", fontFamily: "Inter,sans-serif",
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: "rgba(0,0,0,0.8)" }}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
        style={{ background: "#141210", border: "1px solid #3C3428", maxHeight: "90vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #2C2820" }}>
          <div>
            <h2 className="font-bold" style={{ fontFamily: "Playfair Display,serif", color: "#F5F0E8", fontSize: 18 }}>
              {initial?._id ? "Edit Batch" : "Log New Batch"}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "#6B6560" }}>Track your soap batch details and costs</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B6560", fontSize: 20 }}>✕</button>
        </div>

        {/* Tab nav */}
        <div className="flex px-6 pt-4 gap-1">
          {(["basic","cost","notes"] as const).map(tab => (
            <button key={tab} onClick={() => setSection(tab)}
              className="px-4 py-2 rounded-lg text-xs font-semibold transition-all capitalize"
              style={{ background: section===tab ? "#C49A3C" : "#1C1A17", color: section===tab ? "#0A0908" : "#6B6560",
                border: "none", cursor: "pointer" }}>
              {tab === "basic" ? "📋 Batch Info" : tab === "cost" ? "💰 Cost Analysis" : "📝 Notes & Rating"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* ── BASIC ── */}
          {section === "basic" && <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase tracking-widest font-semibold block mb-1.5" style={{ color: "#6B6560" }}>Batch Number</label>
                <input type="text" value={form.batchNumber} onChange={(e: ChangeEvent<HTMLInputElement>) => set("batchNumber", e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={inputStyle}/>
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest font-semibold block mb-1.5" style={{ color: "#6B6560" }}>Date Made</label>
                <input type="date" value={form.date} onChange={(e: ChangeEvent<HTMLInputElement>) => set("date", e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={inputStyle}/>
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-widest font-semibold block mb-1.5" style={{ color: "#6B6560" }}>Recipe Used</label>
              <select value={form.recipeId} onChange={(e: ChangeEvent<HTMLSelectElement>) => onRecipeChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={inputStyle}>
                <option value="">— Select a saved recipe —</option>
                {recipes.map(r => <option key={r._id} value={r._id}>{r.name}</option>)}
              </select>
              {!form.recipeId && (
                <input type="text" value={form.recipeName} onChange={(e: ChangeEvent<HTMLInputElement>) => set("recipeName", e.target.value)}
                  placeholder="Or type recipe name manually"
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none mt-2" style={inputStyle}/>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs uppercase tracking-widest font-semibold block mb-1.5" style={{ color: "#6B6560" }}>Batch Size (g)</label>
                <input type="number" value={form.batchSizeGrams} onChange={(e: ChangeEvent<HTMLInputElement>) => set("batchSizeGrams", parseFloat(e.target.value)||0)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={inputStyle}/>
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest font-semibold block mb-1.5" style={{ color: "#6B6560" }}>No. of Bars</label>
                <input type="number" value={form.barsCount} onChange={(e: ChangeEvent<HTMLInputElement>) => set("barsCount", parseInt(e.target.value)||0)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={inputStyle}/>
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest font-semibold block mb-1.5" style={{ color: "#6B6560" }}>Grams / Bar</label>
                <input type="number" value={form.gramsPerBar} onChange={(e: ChangeEvent<HTMLInputElement>) => set("gramsPerBar", parseFloat(e.target.value)||0)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={inputStyle}/>
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-widest font-semibold block mb-1.5" style={{ color: "#6B6560" }}>Batch Status</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(STATUS_CONFIG) as [BatchStatus, typeof STATUS_CONFIG[BatchStatus]][]).map(([key, cfg]) => (
                  <button key={key} onClick={() => set("status", key)}
                    className="py-2 px-3 rounded-xl text-xs font-semibold transition-all text-left"
                    style={{ background: form.status===key ? cfg.bg : "#1C1A17",
                      border: `1px solid ${form.status===key ? cfg.border : "#2C2820"}`,
                      color: form.status===key ? cfg.color : "#6B6560", cursor: "pointer" }}>
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>
          </>}

          {/* ── COST ── */}
          {section === "cost" && <>
            <div className="p-4 rounded-xl" style={{ background: "#1C1A17", border: "1px solid #2C2820" }}>
              <p className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: "#C49A3C" }}>Oil Costs</p>
              {(form.oilCosts ?? []).length === 0 ? (
                <p className="text-xs text-center py-3" style={{ color: "#3C3830" }}>
                  Select a recipe above to auto-populate oils, or add manually.
                </p>
              ) : (form.oilCosts ?? []).map((oil, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <span className="text-xs flex-1" style={{ color: "#9A9490" }}>{oil.name} ({oil.grams}g)</span>
                  <div className="flex items-center gap-1.5 rounded-lg px-2 py-1.5" style={{ background: "#141210", border: "1px solid #3C3830" }}>
                    <span className="text-xs" style={{ color: "#6B6560" }}>{getCurrencySymbol(form.currency ?? "PHP")}</span>
                    <input type="number" value={oil.pricePerKg}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        const updated = [...(form.oilCosts ?? [])];
                        updated[i] = { ...updated[i], pricePerKg: parseFloat(e.target.value) || 0 };
                        set("oilCosts", updated);
                      }}
                      className="w-20 bg-transparent text-sm text-right outline-none" style={{ color: "#F5F0E8" }}/>
                    <span className="text-xs" style={{ color: "#6B6560" }}>/kg</span>
                  </div>
                  <span className="text-xs w-16 text-right" style={{ color: "#C49A3C" }}>
                    {getCurrencySymbol(form.currency ?? "PHP")}{((oil.grams / 1000) * oil.pricePerKg).toFixed(2)}
                  </span>
                </div>
              ))}
              <button onClick={() => set("oilCosts", [...(form.oilCosts??[]), { name: "Custom Oil", grams: 100, pricePerKg: 200 }])}
                className="w-full flex items-center justify-center gap-1 py-2 rounded-lg text-xs mt-2"
                style={{ background: "#141210", border: "1px dashed #3C3830", color: "#C49A3C", cursor: "pointer" }}>
                <PlusIcon/> Add oil cost
              </button>
            </div>

            {/* Currency selector */}
            <div className="mb-1">
              <label className="text-xs uppercase tracking-widest font-semibold block mb-1.5" style={{ color: "#6B6560" }}>Currency</label>
              <select value={form.currency} onChange={(e: ChangeEvent<HTMLSelectElement>) => set("currency", e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={inputStyle}>
                {CURRENCIES.map(cur => (
                  <option key={cur.code} value={cur.code}>{cur.symbol} {cur.code} — {cur.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase tracking-widest font-semibold block mb-1.5" style={{ color: "#6B6560" }}>Labor Rate ({getCurrencySymbol(form.currency ?? "PHP")}/hr)</label>
                <input type="number" value={form.laborCostPerHour}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => set("laborCostPerHour", parseFloat(e.target.value)||0)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={inputStyle}/>
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest font-semibold block mb-1.5" style={{ color: "#6B6560" }}>Hours Worked</label>
                <input type="number" step="0.5" value={form.laborHours}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => set("laborHours", parseFloat(e.target.value)||0)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={inputStyle}/>
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest font-semibold block mb-1.5" style={{ color: "#6B6560" }}>Overhead %</label>
                <input type="number" value={form.overheadPct}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => set("overheadPct", parseFloat(e.target.value)||0)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={inputStyle}/>
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest font-semibold block mb-1.5" style={{ color: "#6B6560" }}>Profit Margin %</label>
                <input type="number" value={form.marginPct}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => set("marginPct", parseFloat(e.target.value)||0)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={inputStyle}/>
              </div>
            </div>

            {/* Cost summary */}
            <div className="p-4 rounded-xl" style={{ background: "#0F0D0B", border: "1px solid #3C3428" }}>
              <p className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: "#C49A3C" }}>Cost Summary</p>
              {[
                ["Oil Cost",     `${getCurrencySymbol(form.currency ?? "PHP")}${costs.oilCost.toFixed(2)}`],
                ["Labor Cost",   `${getCurrencySymbol(form.currency ?? "PHP")}${costs.laborCost.toFixed(2)}`],
                ["Overhead",     `${getCurrencySymbol(form.currency ?? "PHP")}${costs.overhead.toFixed(2)}`],
                ["Total Cost",   `${getCurrencySymbol(form.currency ?? "PHP")}${costs.totalCost.toFixed(2)}`],
              ].map(([l,v]) => (
                <div key={l} className="flex justify-between py-1" style={{ borderBottom: "1px solid #1C1A17" }}>
                  <span className="text-xs" style={{ color: "#6B6560" }}>{l}</span>
                  <span className="text-sm" style={{ color: "#9A9490" }}>{v}</span>
                </div>
              ))}
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="text-center p-3 rounded-xl" style={{ background: "#1C1A17" }}>
                  <p className="text-xs mb-1" style={{ color: "#6B6560" }}>Cost per Bar</p>
                  <p className="text-xl font-bold" style={{ fontFamily: "Playfair Display,serif", color: "#F5F0E8" }}>
                    {getCurrencySymbol(form.currency ?? "PHP")}{costs.costPerBar.toFixed(2)}
                  </p>
                </div>
                <div className="text-center p-3 rounded-xl" style={{ background: "#1C2A18", border: "1px solid #2A5020" }}>
                  <p className="text-xs mb-1" style={{ color: "#6B6560" }}>Suggested Retail</p>
                  <p className="text-xl font-bold" style={{ fontFamily: "Playfair Display,serif", color: "#4CAF50" }}>
                    {getCurrencySymbol(form.currency ?? "PHP")}{costs.sellingPrice.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </>}

          {/* ── NOTES ── */}
          {section === "notes" && <>
            <div>
              <label className="text-xs uppercase tracking-widest font-semibold block mb-1.5" style={{ color: "#6B6560" }}>Batch Notes</label>
              <textarea value={form.notes}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => set("notes", e.target.value)}
                placeholder="Describe how the batch went — trace speed, temperature issues, color, scent throw, any problems..."
                rows={5} className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ ...inputStyle, resize: "vertical", fontFamily: "Inter,sans-serif" }}/>
              <p className="text-xs mt-1" style={{ color: "#4A4540" }}>
                💡 Tip: Be detailed! The AI Analyzer will use these notes to give you suggestions.
              </p>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest font-semibold block mb-2" style={{ color: "#6B6560" }}>Batch Rating</label>
              <StarRating value={form.rating ?? 0} onChange={v => set("rating", v)}/>
              <p className="text-xs mt-1" style={{ color: "#4A4540" }}>
                {form.rating === 0 ? "Not rated yet" : form.rating === 1 ? "Poor — major issues" : form.rating === 2 ? "Below average" : form.rating === 3 ? "Average" : form.rating === 4 ? "Good batch!" : "Perfect batch! ⭐"}
              </p>
            </div>
          </>}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4" style={{ borderTop: "1px solid #2C2820" }}>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: "#1C1A17", border: "1px solid #2C2820", color: "#6B6560", cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={() => onSave(form)} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#C49A3C,#8B6A2A)", color: "#0A0908", border: "none", cursor: "pointer" }}>
            {saving ? "Saving…" : initial?._id ? "Update Batch" : "Log Batch ✦"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Batch card ────────────────────────────────────────────────────────────────
interface BatchCardProps {
  batch: BatchDoc;
  onEdit: (b: BatchDoc) => void;
  onDelete: (id: string) => void;
  onAnalyze: (b: BatchDoc) => void;
  analyzing: boolean;
}

const BatchCard: FC<BatchCardProps> = ({ batch, onEdit, onDelete, onAnalyze, analyzing }) => {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cfg    = STATUS_CONFIG[batch.status];
  const costs  = computeCosts(batch);

  return (
    <div className="rounded-2xl overflow-hidden transition-all"
      style={{ background: "#141210", border: "1px solid #2C2820" }}>

      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "#1C1A17", color: "#6B6560" }}>
                {batch.batchNumber}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                {cfg.label}
              </span>
              {batch.rating > 0 && (
                <span className="text-xs" style={{ color: "#C49A3C" }}>
                  {"★".repeat(batch.rating)}{"☆".repeat(5-batch.rating)}
                </span>
              )}
            </div>
            <h3 className="font-bold text-sm" style={{ fontFamily: "Playfair Display,serif", color: "#F5F0E8" }}>
              {batch.recipeName || "Unnamed Recipe"}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "#6B6560" }}>
              {new Date(batch.date).toLocaleDateString("en-PH", { year:"numeric", month:"long", day:"numeric" })}
              {" · "}{batch.batchSizeGrams}g · {batch.barsCount} bars
            </p>
          </div>
        </div>

        {/* Cost pills */}
        {costs.totalCost > 0 && (
          <div className="flex gap-2 flex-wrap mb-3">
            <div className="px-2.5 py-1 rounded-lg text-xs" style={{ background: "#1C1A17", color: "#6B6560" }}>
              Cost/bar: <span style={{ color: "#F5F0E8", fontWeight: 600 }}>{getCurrencySymbol(batch.currency ?? "PHP")}{costs.costPerBar.toFixed(2)}</span>
            </div>
            <div className="px-2.5 py-1 rounded-lg text-xs" style={{ background: "#0F2010", border: "1px solid #2A4020", color: "#4CAF50" }}>
              Sell @ <span style={{ fontWeight: 600 }}>{getCurrencySymbol(batch.currency ?? "PHP")}{costs.sellingPrice.toFixed(2)}</span>
            </div>
            <div className="px-2.5 py-1 rounded-lg text-xs" style={{ background: "#1C1A17", color: "#6B6560" }}>
              Total: <span style={{ color: "#F5F0E8" }}>{getCurrencySymbol(batch.currency ?? "PHP")}{costs.totalCost.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Notes preview */}
        {batch.notes && (
          <p className="text-xs italic line-clamp-2 mb-3" style={{ color: "#6B6560" }}>{batch.notes}</p>
        )}

        {/* AI analysis */}
        {batch.aiAnalysis && (
          <div className="p-3 rounded-xl mb-3" style={{ background: "#131108", border: "1px solid #3A3420" }}>
            <p className="text-xs font-semibold mb-1 flex items-center gap-1" style={{ color: "#C49A3C" }}>
              <SparkleIcon/> AI Analysis
            </p>
            <p className="text-xs leading-relaxed" style={{ color: "#9A8A50", fontFamily: "Playfair Display,serif", fontStyle: "italic" }}>
              {expanded ? batch.aiAnalysis : batch.aiAnalysis.slice(0, 150) + (batch.aiAnalysis.length > 150 ? "…" : "")}
            </p>
            {batch.aiSuggestions && expanded && (
              <div className="mt-2 pt-2" style={{ borderTop: "1px solid #2C2820" }}>
                <p className="text-xs font-semibold mb-1" style={{ color: "#C49A3C" }}>💡 Suggestions</p>
                <p className="text-xs leading-relaxed" style={{ color: "#9A8A50" }}>{batch.aiSuggestions}</p>
              </div>
            )}
            {(batch.aiAnalysis.length > 150 || batch.aiSuggestions) && (
              <button onClick={() => setExpanded(v => !v)}
                className="text-xs mt-1 flex items-center gap-1"
                style={{ background: "none", border: "none", color: "#C49A3C", cursor: "pointer" }}>
                {expanded ? <><ChevronUpIcon/> Show less</> : <><ChevronDownIcon/> Read more</>}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderTop: "1px solid #1C1A17" }}>
        <button onClick={() => onAnalyze(batch)} disabled={analyzing || !batch.notes}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          style={{ background: "linear-gradient(135deg,#131108,#1C1A10)", border: "1px solid #3A3420", color: "#C49A3C", cursor: "pointer" }}
          title={!batch.notes ? "Add notes first to use AI analysis" : ""}>
          {analyzing ? (
            <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          ) : <SparkleIcon/>}
          {analyzing ? "Analyzing…" : "AI Analyze"}
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => onEdit(batch)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: "#1C1A17", border: "1px solid #2C2820", color: "#9A9490", cursor: "pointer" }}>
            Edit
          </button>
          {confirmDelete ? (
            <div className="flex gap-1">
              <button onClick={() => onDelete(batch._id)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "#3A1010", border: "1px solid #7A3A2A", color: "#E06040", cursor: "pointer" }}>
                Confirm
              </button>
              <button onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 rounded-lg text-xs"
                style={{ background: "#1C1A17", border: "1px solid #2C2820", color: "#6B6560", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-lg"
              style={{ background: "#1C1A17", border: "1px solid #2C2820", color: "#4A4540", cursor: "pointer" }}>
              <TrashIcon/>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main BatchPage ────────────────────────────────────────────────────────────
export default function BatchPage({ authToken, currentUser, onBack }: BatchPageProps): JSX.Element {
  const [batches,     setBatches]     = useState<BatchDoc[]>([]);
  const [recipes,     setRecipes]     = useState<{ _id: string; name: string; oils: any[] }[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [editBatch,   setEditBatch]   = useState<BatchDoc | undefined>();
  const [saving,      setSaving]      = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<BatchStatus | "all">("all");
  const [toast,       setToast]       = useState("");

  const headers = { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" };

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/batches`, { headers });
      const data = await res.json();
      setBatches(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  }, [authToken]);

  const fetchRecipes = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/recipes/my`, { headers });
      const data = await res.json();
      setRecipes(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
  }, [authToken]);

  useEffect(() => { fetchBatches(); fetchRecipes(); }, [fetchBatches, fetchRecipes]);

  const saveBatch = async (data: Partial<BatchDoc>) => {
    setSaving(true);
    try {
      const isEdit = !!editBatch?._id;
      const url    = isEdit ? `${API}/batches/${editBatch!._id}` : `${API}/batches`;
      const method = isEdit ? "PUT" : "POST";
      const res    = await fetch(url, { method, headers, body: JSON.stringify(data) });
      if (res.ok) {
        showToast(isEdit ? "✓ Batch updated!" : "✓ Batch logged!");
        setShowForm(false); setEditBatch(undefined);
        fetchBatches();
      }
    } finally { setSaving(false); }
  };

  const deleteBatch = async (id: string) => {
    await fetch(`${API}/batches/${id}`, { method: "DELETE", headers });
    showToast("Batch deleted.");
    fetchBatches();
  };

  const analyzeBatch = async (batch: BatchDoc) => {
    if (!batch.notes) return;
    setAnalyzingId(batch._id);
    try {
      const res  = await fetch(`${API}/api/messages`, {
        method: "POST", headers,
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 1000,
          system: `You are SoapCalcAI's batch analysis assistant. A soap maker has logged a batch with notes about how it went. 
Analyze the notes and provide:
1. A brief analysis of what happened (2-3 sentences)
2. Specific actionable suggestions for improvement (2-3 bullet points)

Focus on common soap making issues: trace speed, lye calculations, temperature, water discount, cure time, fragrance acceleration, ricing, separation, etc.

Respond in JSON: {"analysis": "...", "suggestions": "• suggestion 1\n• suggestion 2\n• suggestion 3"}`,
          messages: [{
            role: "user",
            content: `Recipe: ${batch.recipeName}
Batch size: ${batch.batchSizeGrams}g, ${batch.barsCount} bars
Status: ${batch.status}
Rating: ${batch.rating}/5 stars
Notes: ${batch.notes}`,
          }],
        }),
      });
      const d    = await res.json();
      const raw  = (d.content as any[]).map((b: any) => b.text ?? "").join("").trim();
      const parsed = JSON.parse(raw.replace(/```json|```/g,"").trim());
      // Save analysis back to batch
      await fetch(`${API}/batches/${batch._id}`, {
        method: "PUT", headers,
        body: JSON.stringify({ aiAnalysis: parsed.analysis, aiSuggestions: parsed.suggestions }),
      });
      showToast("✦ AI analysis complete!");
      fetchBatches();
    } catch { showToast("AI analysis failed. Try again."); }
    finally { setAnalyzingId(null); }
  };

  const filtered = filterStatus === "all" ? batches : batches.filter(b => b.status === filterStatus);

  // Stats
  const totalBatches  = batches.length;
  const totalBars     = batches.reduce((s,b) => s + (b.barsCount||0), 0);
  const avgRating     = batches.filter(b=>b.rating>0).length > 0
    ? (batches.filter(b=>b.rating>0).reduce((s,b)=>s+b.rating,0) / batches.filter(b=>b.rating>0).length).toFixed(1)
    : "—";
  const totalRevenue  = batches.reduce((s,b) => {
    const c = computeCosts(b);
    return s + c.sellingPrice * (b.barsCount||0);
  }, 0);

  return (
    <div className="min-h-screen p-4 md:p-8"
      style={{ background: "linear-gradient(135deg,#0A0908 0%,#0F0D0B 50%,#0A0908 100%)", fontFamily: "Inter,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }
        .line-clamp-2 { display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden; }
        textarea::placeholder,input::placeholder { color:#3C3830; }
        @keyframes spin{to{transform:rotate(360deg);}} .animate-spin{animation:spin .8s linear infinite;}
        @keyframes fadeIn{from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:translateY(0);}} .fade-in{animation:fadeIn .35s ease forwards;}
        select option { background: #1C1A17; }
        ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-track{background:#141210;} ::-webkit-scrollbar-thumb{background:#3C3428;border-radius:2px;}
      `}</style>

      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack}
            className="flex items-center gap-2 text-sm"
            style={{ color: "#6B6560", background: "none", border: "none", cursor: "pointer" }}>
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4"><path d="M19 12H5M5 12l7 7M5 12l7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Back
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <FlameIcon/>
            <span className="font-bold" style={{ fontFamily: "Playfair Display,serif", color: "#F5F0E8", fontSize: 18 }}>
              SoapCalc<span style={{ color: "#C49A3C" }}>AI</span> · Batches
            </span>
          </div>
          <button onClick={() => { setEditBatch(undefined); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "linear-gradient(135deg,#C49A3C,#8B6A2A)", color: "#0A0908", border: "none", cursor: "pointer" }}>
            <PlusIcon/> Log Batch
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total Batches",  value: totalBatches,                    color: "#F5F0E8" },
            { label: "Bars Made",      value: totalBars,                       color: "#F5F0E8" },
            { label: "Avg Rating",     value: `${avgRating}★`,                 color: "#C49A3C" },
            { label: "Est. Revenue",   value: totalRevenue > 0 ? `${batches[0]?.currency ? getCurrencySymbol(batches[0].currency) : "₱"}${totalRevenue.toFixed(0)}` : "₱0",   color: "#4CAF50" },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: "#141210", border: "1px solid #2C2820" }}>
              <p className="text-2xl font-bold" style={{ fontFamily: "Playfair Display,serif", color: s.color }}>{s.value}</p>
              <p className="text-xs mt-1" style={{ color: "#6B6560" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs" style={{ color: "#6B6560" }}>Filter:</span>
          {(["all", ...Object.keys(STATUS_CONFIG)] as (BatchStatus|"all")[]).map(s => {
            const cfg = s !== "all" ? STATUS_CONFIG[s] : null;
            return (
              <button key={s} onClick={() => setFilterStatus(s)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: filterStatus===s ? (cfg?.bg ?? "#C49A3C") : "#1C1A17",
                  color:      filterStatus===s ? (cfg?.color ?? "#0A0908") : "#6B6560",
                  border:     filterStatus===s ? `1px solid ${cfg?.border ?? "#C49A3C"}` : "1px solid #2C2820",
                  cursor: "pointer",
                }}>
                {s === "all" ? "All" : STATUS_CONFIG[s].label}
              </button>
            );
          })}
          <span className="text-xs ml-auto" style={{ color: "#4A4540" }}>{filtered.length} batch{filtered.length !== 1 ? "es" : ""}</span>
        </div>

        {/* Batch list */}
        {loading ? (
          <div className="text-center py-16" style={{ color: "#4A4540" }}>Loading batches…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 rounded-2xl" style={{ background: "#141210", border: "1px solid #2C2820" }}>
            <p className="text-3xl mb-3">🧪</p>
            <p className="font-semibold mb-2" style={{ color: "#F5F0E8", fontFamily: "Playfair Display,serif" }}>
              {filterStatus === "all" ? "No batches logged yet" : `No ${STATUS_CONFIG[filterStatus].label} batches`}
            </p>
            <p className="text-sm mb-4" style={{ color: "#6B6560" }}>
              {filterStatus === "all" ? "Log your first batch to start tracking your soap making journey." : "Try a different filter."}
            </p>
            {filterStatus === "all" && (
              <button onClick={() => { setEditBatch(undefined); setShowForm(true); }}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "linear-gradient(135deg,#C49A3C,#8B6A2A)", color: "#0A0908", border: "none", cursor: "pointer" }}>
                Log First Batch →
              </button>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {filtered.map(batch => (
              <BatchCard key={batch._id} batch={batch}
                onEdit={b => { setEditBatch(b); setShowForm(true); }}
                onDelete={deleteBatch}
                onAnalyze={analyzeBatch}
                analyzing={analyzingId === batch._id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <BatchForm
          initial={editBatch}
          recipes={recipes}
          onSave={saveBatch}
          onClose={() => { setShowForm(false); setEditBatch(undefined); }}
          saving={saving}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 px-4 py-3 rounded-xl text-sm font-semibold fade-in z-50"
          style={{ background: "#0F2A10", border: "1px solid #2A6A2A", color: "#60B060" }}>
          {toast}
        </div>
      )}
    </div>
  );
}

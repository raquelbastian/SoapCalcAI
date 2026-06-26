import { useState, useEffect, useCallback, useRef, FC, ReactNode, ChangeEvent, KeyboardEvent } from "react";
import { SaveModal } from "./RecipesPage";
import { useRecipes } from "./useRecipes";
import type { Recipe } from "./RecipesPage";
import { generateRecipePDF } from "./RecipePDF";

// ── Types ─────────────────────────────────────────────────────────────────────
interface OilProfile {
  naohSap:number; kohSap:number; emoji:string;
  lauric:number; myristic:number; palmitic:number; stearic:number;
  ricinoleic:number; oleic:number; linoleic:number; linolenic:number;
  iodine:number; ins:number;
}
type OilName   = "Olive"|"Coconut"|"Castor"|"Palm"|"Canola"|"RiceBran"|"CocoaButter";
type InputMode = "grams"|"pct";
type BatchUnit = "g"|"kg"|"lb"|"oz";
type AIStatus  = "idle"|"loading"|"success"|"error";
type SoapType  = "solid"|"liquid";
type WaterMode = "ratio"|"lye_pct"|"oil_pct";
type FragMode  = "oil_pct"|"g_per_kg";
export type ThemeMode = "dark"|"light";

interface OilEntry { id:string; oil:OilName; weight:number; pct:number; }
interface AdditivePreset { name:string; emoji:string; unit:"g"|"tsp"|"tbsp"|"ml"|"pct_oil"; addAt:"liquid"|"fats"|"trace"; naohFactor:number; note:string; }
interface Additive { id:string; name:string; amount:number; unit:"g"|"tsp"|"tbsp"|"ml"|"pct_oil"; addAt:"liquid"|"fats"|"trace"; naohFactor:number; liquidDiscount:boolean; }
interface LiquidPreset { name:string; emoji:string; note:string; }
interface CustomLiquid { id:string; name:string; pct:number; }
interface Fragrance { id:string; name:string; amount:number; mode:FragMode; }
interface AIOilBlend { name:OilName; pct:number; }
interface AIRecipe {
  recipeName:string; oils:AIOilBlend[]; superfat:number; batchGrams:number; rationale:string;
  additives?:{name:string;amount:number;unit:string;addAt:string}[];
  fragrances?:{name:string;amount:number}[];
  fragPct?:number;
  customLiquids?:{name:string;pct:number}[];
  waterRatio?:number;
  dilutionRatio?:number;
}
interface BlendScores { bubblyLather:number; creamyLather:number; cleansing:number; condition:number; hardness:number; longevity:number; iodine:number; ins:number; }
interface FattyAcids  { lauric:number; myristic:number; palmitic:number; stearic:number; ricinoleic:number; oleic:number; linoleic:number; linolenic:number; }

interface SoapCalcAIProps {
  onViewPricing?:()=>void; onViewRecipes?:()=>void; onViewBatches?:()=>void;
  authToken?:string; currentUser?:{name:string;email:string;plan:"free"|"premium"};
  onLogout?:()=>void; loadedRecipe?:Recipe|null; onRecipeLoaded?:()=>void;
  theme?:ThemeMode; onThemeChange?:(t:ThemeMode)=>void;
}

// ── Oil DB ────────────────────────────────────────────────────────────────────
const KF=1.403;
const SAP:Record<OilName,OilProfile>={
  Olive:      {naohSap:0.134,kohSap:0.134*KF,emoji:"🫒",lauric:0, myristic:0, palmitic:13,stearic:3, ricinoleic:0, oleic:72,linoleic:10,linolenic:1, iodine:83, ins:109},
  Coconut:    {naohSap:0.190,kohSap:0.190*KF,emoji:"🥥",lauric:47,myristic:18,palmitic:9, stearic:3, ricinoleic:0, oleic:8, linoleic:2, linolenic:0, iodine:10, ins:258},
  Castor:     {naohSap:0.128,kohSap:0.128*KF,emoji:"🌿",lauric:0, myristic:0, palmitic:1, stearic:1, ricinoleic:90,oleic:4, linoleic:4, linolenic:0, iodine:86, ins:95 },
  Palm:       {naohSap:0.141,kohSap:0.141*KF,emoji:"🌴",lauric:0, myristic:1, palmitic:44,stearic:5, ricinoleic:0, oleic:39,linoleic:10,linolenic:0, iodine:53, ins:145},
  Canola:     {naohSap:0.124,kohSap:0.124*KF,emoji:"🌻",lauric:0, myristic:0, palmitic:4, stearic:2, ricinoleic:0, oleic:61,linoleic:21,linolenic:11,iodine:110,ins:56 },
  RiceBran:   {naohSap:0.128,kohSap:0.128*KF,emoji:"🌾",lauric:0, myristic:0, palmitic:17,stearic:2, ricinoleic:0, oleic:43,linoleic:36,linolenic:2, iodine:105,ins:70 },
  CocoaButter:{naohSap:0.137,kohSap:0.137*KF,emoji:"🍫",lauric:0, myristic:0, palmitic:26,stearic:34,ricinoleic:0, oleic:35,linoleic:3, linolenic:0, iodine:36, ins:157},
};
const OIL_DISPLAY:Record<OilName,string>={Olive:"Olive Oil",Coconut:"Coconut Oil",Castor:"Castor Oil",Palm:"Palm Oil",Canola:"Canola Oil",RiceBran:"Rice Bran Oil",CocoaButter:"Cocoa Butter"};
const OIL_NAMES=Object.keys(SAP) as OilName[];
const gid=():string=>Math.random().toString(36).slice(2,8);

const ADDITIVE_PRESETS:AdditivePreset[]=[
  {name:"Citric Acid",        emoji:"🍋",unit:"g",      addAt:"liquid",naohFactor:0.624,note:"0.624g NaOH per gram to neutralize"},
  {name:"Sodium Lactate",     emoji:"🧴",unit:"tsp",    addAt:"liquid",naohFactor:0,   note:"Speeds unmolding — 1 tsp per 500g oils"},
  {name:"Kaolin Clay",        emoji:"🪨",unit:"pct_oil",addAt:"fats",  naohFactor:0,   note:"1% of oils for slip"},
  {name:"Activated Charcoal", emoji:"⚫",unit:"pct_oil",addAt:"trace", naohFactor:0,   note:"0.5–1% of oils"},
  {name:"Cocoa Powder",       emoji:"🍫",unit:"pct_oil",addAt:"trace", naohFactor:0,   note:"1–3% for color"},
  {name:"Turmeric Powder",    emoji:"🟡",unit:"pct_oil",addAt:"trace", naohFactor:0,   note:"0.5–1% warm golden color"},
  {name:"Honey",              emoji:"🍯",unit:"pct_oil",addAt:"trace", naohFactor:0,   note:"Dilute 1:1 water, add at trace"},
  {name:"Yogurt",             emoji:"🥛",unit:"pct_oil",addAt:"trace", naohFactor:0,   note:"Add at light trace — cooled"},
  {name:"Papaya Extract",     emoji:"🍈",unit:"g",      addAt:"trace", naohFactor:0,   note:"Add at trace"},
  {name:"Aloe Vera Gel",      emoji:"🌵",unit:"pct_oil",addAt:"liquid",naohFactor:0,   note:"Can replace part of water"},
  {name:"Oatmeal",            emoji:"🌾",unit:"pct_oil",addAt:"trace", naohFactor:0,   note:"Finely ground, soothing"},
  {name:"Beeswax",            emoji:"🐝",unit:"pct_oil",addAt:"fats",  naohFactor:0,   note:"1–3% hardens bar"},
  {name:"Shea Butter",        emoji:"🌰",unit:"pct_oil",addAt:"fats",  naohFactor:0,   note:"Add at trace for conditioning"},
  {name:"Vinegar",            emoji:"🍾",unit:"pct_oil",addAt:"fats",  naohFactor:0,   note:"3% of oils, add with fats"},
  {name:"Fine Sea Salt",      emoji:"🧂",unit:"pct_oil",addAt:"trace", naohFactor:0,   note:"50–100% of oil weight for salt bars"},
  {name:"Pink Himalayan Salt",emoji:"🩷",unit:"pct_oil",addAt:"trace", naohFactor:0,   note:"50–100% of oil weight, mineral-rich"},
  {name:"Colloidal Oatmeal",  emoji:"🥣",unit:"pct_oil",addAt:"trace", naohFactor:0,   note:"1–3%, soothing for eczema"},
  {name:"Zinc Oxide",         emoji:"⬜",unit:"pct_oil",addAt:"trace", naohFactor:0,   note:"1–2%, calming, whitens soap"},
  {name:"Silk Fibers",        emoji:"🪡",unit:"g",      addAt:"liquid",naohFactor:0,   note:"1–2g dissolved in lye, silky feel"},
];

const LIQUID_PRESETS:LiquidPreset[]=[
  {name:"Distilled Water", emoji:"💧",note:"Standard — pure"},
  {name:"Goat's Milk",     emoji:"🐐",note:"Creamy lather — freeze first"},
  {name:"Coconut Milk",    emoji:"🥥",note:"Rich, creamy lather"},
  {name:"Aloe Vera Juice", emoji:"🌵",note:"Soothing, green tint"},
  {name:"Beer",            emoji:"🍺",note:"Boil off alcohol first"},
  {name:"Coffee",          emoji:"☕",note:"Exfoliating, deodorizing"},
  {name:"Green Tea",       emoji:"🍵",note:"Antioxidants"},
  {name:"Rose Water",      emoji:"🌹",note:"Floral, skin-loving"},
  {name:"Buttermilk",      emoji:"🥛",note:"Lactic acid, silky"},
];

// ── Theme tokens ──────────────────────────────────────────────────────────────
export const DARK = {
  bg:         "#0A0908",
  surface:    "#141210",
  surface2:   "#1C1A17",
  border:     "#2C2820",
  border2:    "#3C3428",
  text:       "#F5F0E8",
  textMuted:  "#6B6560",
  textDim:    "#4A4540",
  accent:     "#C49A3C",
  accentDark: "#8B6A2A",
  green:      "#4CAF50",
  blue:       "#5BA3C9",
  red:        "#E06040",
  panelBg:    "#0F0D0B",
  inputBg:    "#0F0D0B",
  scoreBg:    "#1C1A17",
};
export const LIGHT = {
  bg:         "#F5F3EF",
  surface:    "#FFFFFF",
  surface2:   "#F0EDE8",
  border:     "#E0DDD8",
  border2:    "#C8C4BC",
  text:       "#1A1714",
  textMuted:  "#6B6560",
  textDim:    "#9A9490",
  accent:     "#9A7020",
  accentDark: "#6B4E14",
  green:      "#2E7D32",
  blue:       "#1565C0",
  red:        "#C62828",
  panelBg:    "#F8F6F2",
  inputBg:    "#FFFFFF",
  scoreBg:    "#EDE9E4",
};

// ── Icons ─────────────────────────────────────────────────────────────────────
const FlameIcon:FC<{c:string}>=({c})=><svg viewBox="0 0 24 24" fill="none" style={{width:20,height:20,color:c}}><path d="M12 2C12 2 9 7 9 11C9 13.2 10.3 15 12 15C13.7 15 15 13.2 15 11C15 9 14 7 13 6C13 6 16 8 16 13C16 17.4 14.2 20 12 20C9.8 20 8 17.4 8 13C8 8.5 10 5 12 2Z" fill="currentColor" opacity="0.3"/><path d="M12 22C9.2 22 7 19.5 7 16.5C7 13 9 11 10 9C10 11 11 12.5 12 12.5C13 12.5 14 11 14 9C15 11 17 13 17 16.5C17 19.5 14.8 22 12 22Z" fill="currentColor"/></svg>;
const DropletIcon:FC<{c:string}>=({c})=><svg viewBox="0 0 24 24" fill="none" style={{width:20,height:20,color:c}}><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" fill="currentColor" opacity="0.3"/><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>;
const SparkleIcon:FC=()=><svg viewBox="0 0 24 24" fill="none" style={{width:16,height:16}}><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" fill="currentColor"/></svg>;
const PlusIcon:FC=()=><svg viewBox="0 0 24 24" fill="none" style={{width:14,height:14}}><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
const TrashIcon:FC=()=><svg viewBox="0 0 24 24" fill="none" style={{width:13,height:13}}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const XIcon:FC=()=><svg viewBox="0 0 24 24" fill="none" style={{width:14,height:14}}><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
const SearchIcon:FC=()=><svg viewBox="0 0 24 24" fill="none" style={{width:14,height:14}}><path d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
const SunIcon:FC=()=><svg viewBox="0 0 24 24" fill="none" style={{width:15,height:15}}><circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
const MoonIcon:FC=()=><svg viewBox="0 0 24 24" fill="none" style={{width:15,height:15}}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const ChevronDownIcon:FC=()=><svg viewBox="0 0 24 24" fill="none" style={{width:14,height:14}}><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const ChevronUpIcon:FC=()=><svg viewBox="0 0 24 24" fill="none" style={{width:14,height:14}}><path d="M18 15l-6-6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;

// ── Animated number ───────────────────────────────────────────────────────────
const AnimatedNum:FC<{value:number;decimals?:number;color:string}>=({value,decimals=2,color})=>{
  const [d,setD]=useState(value);
  useEffect(()=>{
    const s=d,t=value,t0=performance.now();
    const tick=(n:number)=>{const p=Math.min((n-t0)/400,1),e=1-Math.pow(1-p,3);setD(s+(t-s)*e);if(p<1)requestAnimationFrame(tick);else setD(t);};
    requestAnimationFrame(tick);
  },[value]);
  return <span style={{color}}>{d.toFixed(decimals)}</span>;
};

// ── Score bar ─────────────────────────────────────────────────────────────────
const ScoreBar:FC<{label:string;value:number;ideal:[number,number];T:typeof DARK}>=({label,value,ideal,T})=>{
  const ok=value>=ideal[0]&&value<=ideal[1];
  const pct=Math.min(value,100);
  return (
    <div style={{marginBottom:9}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:3}}>
        <span style={{fontSize:11,color:T.textMuted}}>{label}</span>
        <div style={{display:"flex",alignItems:"baseline",gap:6}}>
          <span style={{fontSize:13,fontWeight:700,color:ok?T.green:T.accent}}>{Math.round(value)}</span>
          <span style={{fontSize:9,color:T.textDim}}>{ideal[0]}–{ideal[1]}</span>
          <span style={{fontSize:9,padding:"1px 5px",borderRadius:3,background:ok?T.green+"22":T.accent+"22",color:ok?T.green:T.accent,fontWeight:600}}>{ok?"✓":"!"}</span>
        </div>
      </div>
      <div style={{height:5,borderRadius:3,background:T.scoreBg,overflow:"hidden",position:"relative"}}>
        <div style={{position:"absolute",left:`${ideal[0]}%`,width:`${ideal[1]-ideal[0]}%`,height:"100%",background:ok?T.green+"44":T.accent+"22"}}/>
        <div style={{height:"100%",borderRadius:3,background:ok?T.green:T.accent,width:`${pct}%`,transition:"width .6s ease"}}/>
      </div>
    </div>
  );
};

// ── Section card ──────────────────────────────────────────────────────────────
const Step:FC<{n:number;title:string;children:ReactNode;T:typeof DARK;accent?:string;defaultOpen?:boolean}>=
  ({n,title,children,T,accent,defaultOpen=true})=>{
  const [open,setOpen]=useState(defaultOpen);
  const ac=accent??T.accent;
  return (
    <div style={{borderRadius:12,overflow:"hidden",marginBottom:12,border:`1px solid ${T.border}`,background:T.surface}}>
      <button onClick={()=>setOpen(v=>!v)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"12px 16px",background:"transparent",border:"none",cursor:"pointer"}}>
        <div style={{width:22,height:22,borderRadius:"50%",border:`1.5px dashed ${ac}`,color:ac,fontSize:10,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{n}</div>
        <span style={{fontSize:12,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",color:ac,flex:1,textAlign:"left"}}>{title}</span>
        <span style={{color:T.textDim}}>{open?<ChevronUpIcon/>:<ChevronDownIcon/>}</span>
      </button>
      {open&&<div style={{padding:"4px 16px 16px"}}>{children}</div>}
    </div>
  );
};

// ── OilPanel — left/right picker (Option B) ───────────────────────────────────
const OilPanel:FC<{oils:OilEntry[];mode:InputMode;batchGrams:number;batchUnit:BatchUnit;effOilG:number;pctTotal:number;aiHighlight:boolean;T:typeof DARK;ac:string;oilInputMode:"pct"|"g"|"unit";onOilInputModeChange:(m:"pct"|"g"|"unit")=>void;
  onAdd:(name:OilName)=>void;onRemove:(id:string)=>void;onChange:(id:string,f:keyof OilEntry,v:string)=>void;onReorder:(from:number,to:number)=>void;}>=
  ({oils,mode,batchGrams,batchUnit,effOilG,pctTotal,aiHighlight,T,ac,oilInputMode,onOilInputModeChange,onAdd,onRemove,onChange,onReorder})=>{

  const [search,setSearch]=useState("");
  const selectedNames=oils.map(o=>o.oil);
  const available=OIL_NAMES.filter(n=>OIL_DISPLAY[n].toLowerCase().includes(search.toLowerCase()));
  const warn=mode==="pct"&&pctTotal>100;
  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      {/* Left — available */}
      <div>
        <p style={{fontSize:10,textTransform:"uppercase",letterSpacing:"0.07em",color:T.textDim,marginBottom:6}}>Available oils</p>
        <div style={{display:"flex",alignItems:"center",gap:6,background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:6,padding:"5px 8px",marginBottom:6}}>
          <SearchIcon/>
          <input type="text" value={search} onChange={(e:ChangeEvent<HTMLInputElement>)=>setSearch(e.target.value)}
            placeholder="Search oils…"
            style={{flex:1,background:"transparent",color:T.text,fontSize:12,border:"none",outline:"none"}}/>
        </div>
        <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden",maxHeight:220,overflowY:"auto"}}>
          {available.map(n=>{
            const sel=selectedNames.includes(n);
            return (
              <div key={n} onClick={()=>sel?onRemove(oils.find(o=>o.oil===n)!.id):onAdd(n)}
                style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderBottom:`1px solid ${T.border}`,
                  background:sel?T.green+"11":T.surface,cursor:"pointer",transition:"background .15s"}}>
                <span style={{fontSize:15}}>{SAP[n].emoji}</span>
                <span style={{fontSize:12,flex:1,color:sel?T.green:T.textMuted}}>{OIL_DISPLAY[n]}</span>
                <span style={{fontSize:16,fontWeight:600,color:sel?T.red:T.green,lineHeight:1}}>{sel?"−":"+"}</span>
              </div>
            );
          })}
        </div>
      </div>
      {/* Right — selected with inputs */}
      <div>
        {/* Header row — label + toggle + column headers */}
        <div style={{marginBottom:6}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>
            <p style={{fontSize:10,textTransform:"uppercase",letterSpacing:"0.07em",color:T.textDim,margin:0}}>
              Selected ({oils.length}){warn&&<span style={{color:T.red,marginLeft:4}}>— over 100%!</span>}
            </p>
            {/* Toggle — click to set which column is editable */}
            <div style={{display:"flex",gap:4,alignItems:"center"}}>
              <span style={{fontSize:9,color:T.textDim}}>Edit by:</span>
              <div style={{display:"flex",borderRadius:5,overflow:"hidden",border:`1px solid ${T.border}`}}>
                {(["pct","g",...(batchUnit!=="g"?["unit"]:[])] as ("pct"|"g"|"unit")[]).map(m=>(
                  <button key={m} onClick={()=>onOilInputModeChange(m)}
                    style={{padding:"3px 8px",fontSize:10,fontWeight:600,border:"none",cursor:"pointer",
                      background:oilInputMode===m?T.accent:"transparent",
                      color:oilInputMode===m?"#0A0908":T.textMuted}}>
                    {m==="pct"?"%":m==="g"?"g":batchUnit}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* Column labels — match exact widths of input/value columns */}
          <div style={{display:"flex",alignItems:"center",padding:"0 10px 0 28px",gap:6}}>
            <span style={{flex:1}}></span>
            {/* % col — width matches input box (52px input + unit) */}
            <span style={{fontSize:9,color:oilInputMode==="pct"?ac:T.textDim,minWidth:68,textAlign:"right",
              textTransform:"uppercase",letterSpacing:"0.05em",fontWeight:oilInputMode==="pct"?700:400}}>%</span>
            {/* unit col — only if batchUnit != g */}
            {batchUnit!=="g"&&<span style={{fontSize:9,color:oilInputMode==="unit"?ac:T.textDim,minWidth:68,textAlign:"right",
              textTransform:"uppercase",letterSpacing:"0.05em",fontWeight:oilInputMode==="unit"?700:400}}>{batchUnit}</span>}
            {/* grams col */}
            <span style={{fontSize:9,color:oilInputMode==="g"?ac:T.textDim,minWidth:58,textAlign:"right",
              textTransform:"uppercase",letterSpacing:"0.05em",fontWeight:oilInputMode==="g"?700:400}}>grams</span>
            {/* trash button space */}
            <span style={{width:30}}></span>
          </div>
        </div>
        {/* Drag handle icon */}
        <div style={{border:`1px solid ${warn?T.red:T.border}`,borderRadius:8,overflow:"hidden",maxHeight:220,overflowY:"auto"}}>
          {oils.length===0?(
            <div style={{padding:"20px 10px",textAlign:"center",fontSize:11,color:T.textDim}}>Click + to add oils</div>
          ):oils.map((entry,idx)=>{
            const rawW=parseFloat(String(entry.weight))||0;
            // dg = always in grams for computation
            const dg = oilInputMode==="pct"
              ? ((parseFloat(String(entry.pct))||0)/100)*batchGrams
              : oilInputMode==="g"
              ? rawW
              : batchUnit==="kg"?rawW*1000
              : batchUnit==="lb"?rawW*453.592
              : batchUnit==="oz"?rawW*28.3495
              : rawW;
            // display value in chosen unit
            const displayVal = oilInputMode==="pct" ? entry.pct
              : oilInputMode==="g" ? rawW
              : batchUnit==="kg"?(dg/1000)
              : batchUnit==="lb"?(dg/453.592)
              : batchUnit==="oz"?(dg/28.3495)
              : rawW;
            const displayUnit = oilInputMode==="pct" ? "%" : oilInputMode==="g" ? "g" : batchUnit;
            return (
              <div key={entry.id}
                draggable
                onDragStart={(e)=>{e.dataTransfer.setData("text/plain",String(idx));e.dataTransfer.effectAllowed="move";(e.currentTarget as HTMLElement).style.opacity="0.4";}}
                onDragEnd={(e)=>{(e.currentTarget as HTMLElement).style.opacity="1";}}
                onDragOver={(e)=>{e.preventDefault();e.dataTransfer.dropEffect="move";(e.currentTarget as HTMLElement).style.borderTop=`2px solid ${T.accent}`;}}
                onDragLeave={(e)=>{(e.currentTarget as HTMLElement).style.borderTop="";}}
                onDrop={(e)=>{
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).style.borderTop="";
                  const from=parseInt(e.dataTransfer.getData("text/plain"));
                  const to=idx;
                  if(from===to)return;
                  onReorder(from,to);
                }}
                style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",
                  borderBottom:`1px solid ${T.border}`,background:aiHighlight?T.green+"08":T.surface,
                  cursor:"grab",userSelect:"none"}}>
                {/* Drag handle */}
                <span style={{fontSize:10,color:T.textDim,cursor:"grab",flexShrink:0,letterSpacing:"-1px"}}>⣿</span>
                {aiHighlight&&<div style={{width:2,height:16,borderRadius:1,background:T.green,flexShrink:0}}/>}
                <span style={{fontSize:14}}>{SAP[entry.oil]?.emoji}</span>
                <span style={{fontSize:11,flex:1,color:T.textMuted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{OIL_DISPLAY[entry.oil]}</span>
                {/* Per-row % / unit toggle */}
                {(() => {
                  const usesPct = entry.pct > 0 && mode === "pct";
                  const computedPct = effOilG > 0 ? (dg / effOilG * 100) : 0;
                  const unitLabel = batchUnit;
                  const unitVal = batchUnit==="kg" ? (dg/1000).toFixed(3)
                    : batchUnit==="lb" ? (dg/453.592).toFixed(2)
                    : batchUnit==="oz" ? (dg/28.3495).toFixed(2)
                    : dg.toFixed(0);
                  return (
                    <>
                      {/* 3 columns: % | chosen unit | grams — active column is editable */}
                      {/* Column 1: % */}
                      {oilInputMode==="pct" ? (
                        <div style={{display:"flex",alignItems:"center",gap:2,background:T.inputBg,border:`1px solid ${warn?T.red:T.accent}`,borderRadius:5,padding:"2px 5px",minWidth:68}}>
                          <input type="number" min="0" max="100" step="0.5" value={entry.pct}
                            onChange={(e:ChangeEvent<HTMLInputElement>)=>onChange(entry.id,"pct",e.target.value)}
                            onMouseDown={(e)=>e.stopPropagation()}
                            style={{width:36,background:"transparent",color:T.text,fontSize:12,fontWeight:600,border:"none",outline:"none",textAlign:"right",cursor:"text"}}/>
                          <span style={{fontSize:9,color:T.accent}}>%</span>
                        </div>
                      ) : (
                        <span style={{fontSize:11,color:T.textMuted,minWidth:68,textAlign:"right",fontWeight:500}}>
                          {effOilG>0?(dg/effOilG*100).toFixed(1):0}<span style={{fontSize:9,color:T.textDim,marginLeft:1}}>%</span>
                        </span>
                      )}
                      {/* Column 2: chosen unit (only if unit != g) */}
                      {batchUnit!=="g" && (
                        oilInputMode==="unit" ? (
                          <div style={{display:"flex",alignItems:"center",gap:2,background:T.inputBg,border:`1px solid ${T.accent}`,borderRadius:5,padding:"2px 5px",minWidth:68}}>
                            <input type="number" min="0" step="0.01"
                              value={batchUnit==="kg"?(dg/1000).toFixed(3):batchUnit==="lb"?(dg/453.592).toFixed(2):(dg/28.3495).toFixed(2)}
                              onChange={(e:ChangeEvent<HTMLInputElement>)=>{
                                const v=parseFloat(e.target.value)||0;
                                const inG=batchUnit==="kg"?v*1000:batchUnit==="lb"?v*453.592:v*28.3495;
                                onChange(entry.id,"weight",String(inG));
                              }}
                              onMouseDown={(e)=>e.stopPropagation()}
                              style={{width:40,background:"transparent",color:T.text,fontSize:12,fontWeight:600,border:"none",outline:"none",textAlign:"right",cursor:"text"}}/>
                            <span style={{fontSize:9,color:T.accent}}>{batchUnit}</span>
                          </div>
                        ) : (
                          <span style={{fontSize:11,color:T.textMuted,minWidth:68,textAlign:"right",fontWeight:500}}>
                            {batchUnit==="kg"?(dg/1000).toFixed(3):batchUnit==="lb"?(dg/453.592).toFixed(2):(dg/28.3495).toFixed(2)}
                            <span style={{fontSize:9,color:T.textDim,marginLeft:1}}>{batchUnit}</span>
                          </span>
                        )
                      )}
                      {/* Column 3: grams — ALWAYS shown, editable if oilInputMode==="g" */}
                      {oilInputMode==="g" ? (
                        <div style={{display:"flex",alignItems:"center",gap:2,background:T.inputBg,border:`1px solid ${T.accent}`,borderRadius:5,padding:"2px 5px",minWidth:58}}>
                          <input type="number" min="0" step="10" value={rawW}
                            onChange={(e:ChangeEvent<HTMLInputElement>)=>onChange(entry.id,"weight",e.target.value)}
                            onMouseDown={(e)=>e.stopPropagation()}
                            style={{width:40,background:"transparent",color:T.text,fontSize:12,fontWeight:600,border:"none",outline:"none",textAlign:"right",cursor:"text"}}/>
                          <span style={{fontSize:9,color:T.accent}}>g</span>
                        </div>
                      ) : (
                        <span style={{fontSize:13,fontWeight:700,color:T.accent,fontFamily:"Playfair Display,serif",minWidth:58,textAlign:"right"}}>
                          {dg.toFixed(0)}<span style={{fontSize:9,color:T.textMuted,marginLeft:1}}>g</span>
                        </span>
                      )}
                    </>
                  );
                })()}
                <button onClick={()=>onRemove(entry.id)}
                  onMouseDown={(e)=>e.stopPropagation()}
                  style={{padding:"3px 5px",borderRadius:5,background:T.red+"22",border:`1px solid ${T.red}44`,color:T.red,cursor:"pointer",flexShrink:0}}>
                  <TrashIcon/>
                </button>
              </div>
            );
          })}
        </div>
        {/* Total row — all 3 values */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 2px",marginTop:4}}>
          <span style={{fontSize:11,color:T.textDim,fontWeight:600}}>Total</span>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <span style={{fontSize:11,color:warn?T.red:T.green,fontWeight:600}}>{pctTotal.toFixed(1)}%</span>
            {batchUnit!=="g"&&<span style={{fontSize:11,color:T.textMuted}}>
              {batchUnit==="kg"?(effOilG/1000).toFixed(3):batchUnit==="lb"?(effOilG/453.592).toFixed(2):(effOilG/28.3495).toFixed(2)}{batchUnit}
            </span>}
            <span style={{fontSize:12,fontWeight:700,color:warn?T.red:T.green,fontFamily:"Playfair Display,serif"}}>{effOilG.toFixed(0)}<span style={{fontSize:9,color:T.textMuted,marginLeft:1}}>g</span></span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── LR Panel ─────────────────────────────────────────────────────────────────
interface PanelItem{name:string;emoji:string;note?:string;}
interface LRPanelProps{available:PanelItem[];selected:string[];onAdd:(n:string)=>void;onRemove:(n:string)=>void;renderSelected:()=>ReactNode;placeholder?:string;T:typeof DARK;}
const LRPanel:FC<LRPanelProps>=({available,selected,onAdd,onRemove,renderSelected,placeholder,T})=>{
  const [q,setQ]=useState("");
  const filtered=available.filter(i=>i.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      <div>
        <p style={{fontSize:10,textTransform:"uppercase",letterSpacing:"0.07em",color:T.textDim,marginBottom:6}}>Available</p>
        <div style={{display:"flex",alignItems:"center",gap:6,background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:6,padding:"5px 8px",marginBottom:6}}>
          <SearchIcon/><input type="text" value={q} onChange={(e:ChangeEvent<HTMLInputElement>)=>setQ(e.target.value)}
            placeholder={placeholder||"Search…"}
            style={{flex:1,background:"transparent",color:T.text,fontSize:12,border:"none",outline:"none"}}/>
        </div>
        <div style={{maxHeight:180,overflowY:"auto"}}>
          {filtered.map(item=>{
            const sel=selected.includes(item.name);
            return (
              <div key={item.name} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 8px",borderRadius:6,background:sel?T.green+"11":T.surface2,border:`1px solid ${sel?T.green+"44":T.border}`,marginBottom:4,cursor:"pointer"}}
                onClick={()=>sel?onRemove(item.name):onAdd(item.name)}>
                <span style={{fontSize:14}}>{item.emoji}</span>
                <span style={{fontSize:11,flex:1,color:sel?T.green:T.textMuted}}>{item.name}</span>
                <span style={{fontSize:16,color:sel?T.red:T.accent,fontWeight:600}}>{sel?"−":"+"}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <p style={{fontSize:10,textTransform:"uppercase",letterSpacing:"0.07em",color:T.textDim,marginBottom:6}}>Selected</p>
        <div style={{maxHeight:220,overflowY:"auto"}}>
          {selected.length===0?<p style={{fontSize:11,color:T.textDim,textAlign:"center",padding:"20px 0"}}>None selected</p>:renderSelected()}
        </div>
      </div>
    </div>
  );
};

// ── Radio option ──────────────────────────────────────────────────────────────
const RadioOpt:FC<{label:string;sublabel?:string;selected:boolean;onClick:()=>void;T:typeof DARK}>=({label,sublabel,selected,onClick,T})=>(
  <button onClick={onClick} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",width:"100%",background:"none",border:"none",cursor:"pointer"}}>
    <div style={{width:16,height:16,borderRadius:"50%",border:`2px solid ${selected?T.accent:T.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
      {selected&&<div style={{width:8,height:8,borderRadius:"50%",background:T.accent}}/>}
    </div>
    <span style={{fontSize:13,color:selected?T.accent:T.textMuted,flex:1,textAlign:"left"}}>{label}</span>
    {sublabel&&<span style={{fontSize:11,color:T.textDim}}>{sublabel}</span>}
  </button>
);

// ── Toggle switch ─────────────────────────────────────────────────────────────
const ToggleSwitch:FC<{value:boolean;onChange:(v:boolean)=>void;label:string;T:typeof DARK}>=({value,onChange,label,T})=>(
  <div style={{display:"flex",alignItems:"center",gap:8}}>
    <button onClick={()=>onChange(!value)} style={{position:"relative",width:36,height:18,borderRadius:9,background:value?T.accent:T.border,border:"none",cursor:"pointer",flexShrink:0}}>
      <div style={{position:"absolute",top:2,width:14,height:14,borderRadius:"50%",background:"#fff",transition:"left .2s",left:value?"calc(100% - 16px)":"2px"}}/>
      <span style={{position:"absolute",left:value?"-22px":"-18px",fontSize:9,fontWeight:700,color:value?T.accent:T.textDim,top:"50%",transform:"translateY(-50%)"}}>{value?"YES":"NO"}</span>
    </button>
    <span style={{fontSize:12,color:value?T.accent:T.textMuted}}>{label}</span>
  </div>
);

// ── AI Box ────────────────────────────────────────────────────────────────────
const SP=["Salt bar with activated charcoal for detox","Conditioning bar with goat's milk and honey swirl","Gentle unscented baby soap extra mild","Coffee kitchen soap that cuts grease","Luxurious rose clay facial bar"];
const LP=["Moisturizing liquid soap with aloe vera","Foaming kitchen soap with lemon","Luxurious body wash with silky lather"];
const AI_OILS=`Available oils (use EXACT name): Olive, Coconut, Castor(max 10%), Palm, Canola, RiceBran, CocoaButter(max 15%), Shea(max 15%), Avocado, Lard`;
const AI_ADDITIVES=`Available additives (use EXACT name): Citric Acid(unit:g,addAt:liquid), Sodium Lactate(unit:tsp,addAt:liquid), Kaolin Clay(unit:pct_oil,addAt:fats), Activated Charcoal(unit:pct_oil,addAt:trace,0.5-2%), Cocoa Powder(unit:pct_oil,addAt:trace,1-3%), Turmeric Powder(unit:pct_oil,addAt:trace,0.5-1%), Honey(unit:pct_oil,addAt:trace), Yogurt(unit:pct_oil,addAt:trace), Papaya Extract(unit:g,addAt:trace), Oatmeal(unit:pct_oil,addAt:trace), Beeswax(unit:pct_oil,addAt:fats,1-3%), Fine Sea Salt(unit:pct_oil,addAt:trace,50-100% for salt bars), Pink Himalayan Salt(unit:pct_oil,addAt:trace,50-100%), Colloidal Oatmeal(unit:pct_oil,addAt:trace,1-3%), Zinc Oxide(unit:pct_oil,addAt:trace,1-2%), Silk Fibers(unit:g,addAt:liquid,1-2g)`;
const AI_LIQUIDS=`Available custom liquids: Distilled Water, Goat's Milk, Coconut Milk, Aloe Vera Juice, Beer, Coffee, Green Tea, Rose Water, Buttermilk`;
const AI_JSON=`Output ONLY valid JSON (no markdown):
{
  "recipeName":"...",
  "oils":[{"name":"Olive","pct":50}],
  "superfat":5,
  "batchGrams":1000,
  "waterRatio":2.5,
  "additives":[{"name":"Activated Charcoal","amount":1,"unit":"pct_oil","addAt":"trace"}],
  "fragrances":[{"name":"Tea Tree EO","amount":15}],
  "fragPct":3,
  "customLiquids":[{"name":"Distilled Water","pct":100}],
  "rationale":"2-3 sentences explaining why this blend works."
}`;
const SS=`You are SoapCalcAI, expert cold-process SOLID SOAP (NaOH) formulator.
${AI_OILS}. ${AI_ADDITIVES}. ${AI_LIQUIDS}.
RULES:
- Oil percentages MUST sum to exactly 100. Use ONLY oil names from the available list.
- Superfat: 5-8% normal, 15-20% for salt bars only.
- waterRatio: water:lye ratio. Default 2.5. Salt bars: 1.5-1.8. Swirl: 2.8-3.0. Milk soaps: 2.0-2.3.
- Include additives/fragrances/customLiquids when the user's request implies them.
- fragPct: fragrance as % of oil weight (3-5% typical).
SALT BAR rules: MUST include "Fine Sea Salt" or "Pink Himalayan Salt" at 50-100 pct_oil as additive. Use 75-80% Coconut, 15-20% superfat, waterRatio 1.5-1.8. Salt bars without salt aren't salt bars.
MILK SOAP rules: Put the milk in customLiquids (e.g. Goat's Milk 50%, Distilled Water 50%), not in additives.
SWIRL rules: Higher waterRatio (2.8-3.0) for thinner batter. Suggest colorant additives.
${AI_JSON}`;
const LS=`You are SoapCalcAI, expert cold-process LIQUID SOAP (KOH) formulator. ${AI_OILS}. ${AI_ADDITIVES}. ${AI_LIQUIDS}. Oil percentages must sum to 100. Superfat 0-3%. Also include "dilutionRatio" (default 2.5). ${AI_JSON}`;

const AIBox:FC<{soapType:SoapType;onApply:(r:AIRecipe)=>void;isApplied:boolean;onClear:()=>void;authToken?:string;aiUsage:number;aiLimit:number|null;T:typeof DARK}>=
  ({soapType,onApply,isApplied,onClear,authToken,aiUsage,aiLimit,T})=>{
  const [prompt,setPrompt]=useState("");
  const [status,setStatus]=useState<AIStatus>("idle");
  const [result,setResult]=useState<AIRecipe|null>(null);
  const [err,setErr]=useState("");
  const [ph,setPh]=useState(0);
  const prompts=soapType==="solid"?SP:LP;
  const ac=soapType==="liquid"?T.blue:T.accent;
  const atLimit=aiLimit!==null&&aiUsage>=aiLimit;

  useEffect(()=>{setPrompt("");setStatus("idle");setResult(null);setErr("");},[soapType]);
  useEffect(()=>{const t=setInterval(()=>setPh(i=>(i+1)%prompts.length),3500);return()=>clearInterval(t);},[prompts]);

  const generate=async()=>{
    if(!prompt.trim()||status==="loading")return;
    setStatus("loading");setResult(null);setErr("");
    try{
      const r=await fetch("http://localhost:3001/api/messages",{method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${authToken??""}`},
        body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1000,system:soapType==="solid"?SS:LS,messages:[{role:"user",content:prompt.trim()}]})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error??d.error?.message??"Failed");
      const raw=(d.content as any[]).map((b:any)=>b.text??"").join("").trim();
      const p:AIRecipe=JSON.parse(raw.replace(/```json|```/g,"").trim());
      setResult(p);setStatus("success");
    }catch(e){setStatus("error");setErr(e instanceof Error?e.message:"Something went wrong.");}
  };

  return (
    <div style={{borderRadius:12,border:`1px solid ${ac}44`,background:T.surface,marginBottom:12,overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",borderBottom:`1px solid ${T.border}`}}>
        <div style={{width:30,height:30,borderRadius:8,background:ac,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <SparkleIcon/>
        </div>
        <div style={{flex:1}}>
          <p style={{fontSize:13,fontWeight:600,color:T.text,margin:0}}>AI Recipe Generator</p>
          <p style={{fontSize:11,color:T.textMuted,margin:0}}>Describe your soap — Claude formulates the blend</p>
        </div>
        {aiLimit!==null&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:atLimit?T.red+"22":T.surface2,color:atLimit?T.red:T.textMuted,border:`1px solid ${atLimit?T.red+"44":T.border}`}}>{aiUsage}/{aiLimit}</span>}
        {isApplied&&<button onClick={()=>{setPrompt("");setStatus("idle");setResult(null);setErr("");onClear();}} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:6,background:"transparent",border:`1px solid ${T.border}`,color:T.textMuted,cursor:"pointer",fontSize:11}}><XIcon/> Clear</button>}
      </div>
      {atLimit?(
        <div style={{padding:16,textAlign:"center",fontSize:12,color:T.red}}>Free plan limit reached. <span style={{color:T.accent,textDecoration:"underline",cursor:"pointer"}}>Upgrade to Premium</span> for unlimited.</div>
      ):(
        <div style={{padding:12}}>
          <div style={{display:"flex",gap:8}}>
            <input type="text" value={prompt} onChange={(e:ChangeEvent<HTMLInputElement>)=>setPrompt(e.target.value)}
              onKeyDown={(e:KeyboardEvent<HTMLInputElement>)=>e.key==="Enter"&&generate()}
              placeholder={prompts[ph]} disabled={status==="loading"}
              style={{flex:1,background:T.inputBg,border:`1px solid ${status==="error"?T.red:T.border}`,borderRadius:8,padding:"8px 12px",color:T.text,fontSize:13,outline:"none"}}/>
            <button onClick={generate} disabled={!prompt.trim()||status==="loading"}
              style={{padding:"8px 16px",borderRadius:8,background:ac,color:"#fff",border:"none",cursor:"pointer",fontSize:12,fontWeight:600,opacity:(!prompt.trim()||status==="loading")?0.5:1,display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap"}}>
              {status==="loading"?<svg className="spin" style={{width:14,height:14}} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>:<SparkleIcon/>}
              {status==="loading"?"Formulating…":"Generate"}
            </button>
          </div>
          {status==="error"&&<p style={{fontSize:11,color:T.red,marginTop:6}}>⚠ {err}</p>}
        </div>
      )}
      {status==="success"&&result&&(
        <div style={{borderTop:`1px solid ${T.border}`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px",background:T.surface2}}>
            <div>
              <p style={{fontSize:10,textTransform:"uppercase",letterSpacing:"0.07em",color:T.green,margin:"0 0 2px"}}>Recipe Generated</p>
              <p style={{fontSize:14,fontWeight:600,color:T.text,margin:0}}>{result.recipeName}</p>
            </div>
            <button onClick={()=>onApply(result)} style={{padding:"6px 14px",borderRadius:8,background:T.green,color:"#fff",border:"none",cursor:"pointer",fontSize:12,fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
              <SparkleIcon/> Apply
            </button>
          </div>
          <div style={{padding:"8px 16px",display:"flex",flexWrap:"wrap",gap:6}}>
            {result.oils.map(o=>(
              <span key={o.name} style={{fontSize:11,padding:"3px 10px",borderRadius:20,background:T.surface2,border:`1px solid ${T.border}`,color:T.textMuted}}>
                {SAP[o.name]?.emoji} {o.name} <strong style={{color:T.accent}}>{o.pct}%</strong>
              </span>
            ))}
            <span style={{fontSize:11,padding:"3px 10px",borderRadius:20,background:T.surface2,border:`1px solid ${T.border}`,color:T.textMuted}}>SF <strong style={{color:T.accent}}>{result.superfat}%</strong></span>
          </div>
          {result.rationale&&<p style={{fontSize:11,color:T.textMuted,padding:"0 16px 12px",fontStyle:"italic",lineHeight:1.6}}>{result.rationale}</p>}
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════
export default function SoapCalcAI({onViewPricing,onViewRecipes,onViewBatches,authToken,currentUser,onLogout,loadedRecipe,onRecipeLoaded,theme="light",onThemeChange}:SoapCalcAIProps={}){
  const setTheme=(t:ThemeMode)=>onThemeChange?.(t);
  const T                        = theme==="dark"?DARK:LIGHT;

  const [soapType,setSoapType]   = useState<SoapType>("solid");
  const [batchValue,setBatch]    = useState<number>(1000);
  const [batchUnit,setBatchUnit] = useState<BatchUnit>("g");
  const [inputMode,setInputMode] = useState<InputMode>("pct");
  const [lyePurity,setLyePurity] = useState<number>(99);
  const [oils,setOils]           = useState<OilEntry[]>([]);
  const [superfat,setSuperfat]   = useState<number>(5);
  const [waterMode,setWaterMode] = useState<WaterMode>("ratio");
  const [waterRatio,setWaterRatio] = useState<number>(2.5);
  const [lyeConcPct,setLyeConcPct] = useState<number>(33);
  const [oilPct,setOilPct]       = useState<number>(38);
  const [additives,setAdditives] = useState<Additive[]>([]);
  const [customLiquids,setCustomLiquids] = useState<CustomLiquid[]>([{id:gid(),name:"Distilled Water",pct:100}]);
  const [fragrances,setFragrances] = useState<Fragrance[]>([]);
  const [fragMode,setFragMode]   = useState<FragMode>("oil_pct");
  const [fragPct,setFragPct]     = useState<number>(3);
  const [notes,setNotes]         = useState<string>("");
  const [dilutionRatio,setDilution] = useState<number>(2.5);
  const [oilInputMode,setOilInputMode] = useState<"pct"|"g"|"unit">("pct");
  const [aiApplied,setAiApplied] = useState(false);
  const [aiRecipeName,setAiRecipeName] = useState("");
  const [showSaveModal,setShowSave] = useState(false);
  const [saveSuccess,setSaveSuccess] = useState("");
  const [aiUsage,setAiUsage]     = useState(0);
  const [aiLimit,setAiLimit]     = useState<number|null>(2);
  const [currentRecipeId,setRecipeId] = useState<string|null>(null);
  const [currentRecipeName,setRName]  = useState("");
  const [updating,setUpdating]   = useState(false);
  const [analyzing,setAnalyzing] = useState(false);
  const [blendAnalysis,setBlendAnalysis] = useState<string>("");
  const isLoadingRecipe          = useRef(false);
  const {saving,saveError,recipeCount,saveRecipe,fetchCount} = useRecipes();

  // Fetch usage
  useEffect(()=>{
    if(authToken){
      fetchCount(authToken);
      fetch("http://localhost:3001/auth/usage",{headers:{Authorization:`Bearer ${authToken}`}})
        .then(r=>r.json()).then(d=>{setAiUsage(d.aiUsageThisMonth??0);setAiLimit(d.aiLimit);}).catch(()=>{});
    }
  },[authToken]);

  // Load recipe
  useEffect(()=>{
    if(!loadedRecipe)return;
    isLoadingRecipe.current=true;
    setInputMode("pct");setSoapType(loadedRecipe.soapType);
    setBatch(loadedRecipe.batchGrams);setBatchUnit("g");
    setSuperfat(loadedRecipe.superfat);setLyePurity(loadedRecipe.lyePurity);
    setOils(loadedRecipe.oils.map(o=>({id:gid(),oil:o.name as OilName,weight:o.grams,pct:o.pct})));
    const lr=loadedRecipe as any;
    if(Array.isArray(lr.additives)&&lr.additives.length>0)
      setAdditives(lr.additives.map((a:any)=>({id:gid(),name:a.name||"",amount:a.amount||0,unit:a.unit||"g",addAt:a.addAt||"trace",naohFactor:a.naohFactor||0,liquidDiscount:a.liquidDiscount||false})));
    else setAdditives([]);
    if(Array.isArray(lr.fragrances)&&lr.fragrances.length>0)
      setFragrances(lr.fragrances.map((f:any)=>({id:gid(),name:f.name||"",amount:f.amount||0,mode:f.mode||"oil_pct"})));
    else setFragrances([]);
    setNotes(lr.notes||"");
    if(lr.fragPct) setFragPct(lr.fragPct);
    if(lr.fragMode) setFragMode(lr.fragMode);
    if(Array.isArray(lr.customLiquids)&&lr.customLiquids.length>0)
      setCustomLiquids(lr.customLiquids.map((l:any)=>({id:gid(),name:l.name||"Distilled Water",pct:l.pct??100})));
    else setCustomLiquids([{id:gid(),name:"Distilled Water",pct:100}]);
    setAiApplied(false);setAiRecipeName(loadedRecipe.name);
    setRecipeId(loadedRecipe._id);setRName(loadedRecipe.name);
    onRecipeLoaded?.();
    setTimeout(()=>{isLoadingRecipe.current=false;},150);
  },[loadedRecipe]);

  // Soap type reset
  useEffect(()=>{
    if(isLoadingRecipe.current)return;
    setLyePurity(soapType==="liquid"?90:99);setSuperfat(soapType==="liquid"?2:5);
    setOils([]);setAdditives([]);setFragrances([]);setNotes("");
    setAiApplied(false);setAiRecipeName("");setRecipeId(null);setRName("");
  },[soapType]);

  // Derived
  const isLiquid   = soapType==="liquid";
  const ac         = isLiquid?T.blue:T.accent;
  const batchGrams = batchUnit==="kg"?(parseFloat(String(batchValue))||0)*1000
    :batchUnit==="lb"?(parseFloat(String(batchValue))||0)*453.592
    :batchUnit==="oz"?(parseFloat(String(batchValue))||0)*28.3495
    :parseFloat(String(batchValue))||0;
  // effOilG MUST be defined before pctTotal
  const effOilG = oils.reduce((s,e)=>{
    const rawW = parseFloat(String(e.weight))||0;
    const rawP = parseFloat(String(e.pct))||0;
    const g = oilInputMode==="pct" ? (rawP/100)*batchGrams : rawW;
    return s+g;
  },0);
  const pctTotal = oilInputMode==="pct"
    ? oils.reduce((s,e)=>s+(parseFloat(String(e.pct))||0),0)
    : effOilG>0 ? 100 : 0;
  const rawLye = oils.reduce((s,e)=>{
    const rawW = parseFloat(String(e.weight))||0;
    const rawP = parseFloat(String(e.pct))||0;
    const w = oilInputMode==="pct" ? (rawP/100)*batchGrams : rawW;
    return s+w*(isLiquid?SAP[e.oil]?.kohSap:SAP[e.oil]?.naohSap??0);
  },0);
  const citricExtra = additives.reduce((s,a)=>a.naohFactor>0&&a.unit!=="pct_oil"?s+(a.amount||0)*a.naohFactor:s,0);
  const lyeBase    = rawLye*(1-superfat/100)/(lyePurity/100);
  const lyeWeight  = lyeBase+citricExtra;
  const waterAmount = waterMode==="ratio"?lyeWeight*waterRatio:waterMode==="lye_pct"?lyeWeight*(1-lyeConcPct/100)/(lyeConcPct/100):effOilG*(oilPct/100);
  const lyeConc    = lyeWeight/(lyeWeight+waterAmount)*100;
  const liquidLyeR = waterAmount/lyeWeight;
  const batchTotal = effOilG+lyeWeight+waterAmount;
  const fragWeight = fragMode==="oil_pct"?effOilG*(fragPct/100):effOilG*fragPct/1000;

  // ── Unit display helper ────────────────────────────────────────────────────
  const fmtUnit=(grams:number,decimals=1):string=>{
    if(batchUnit==="kg") return (grams/1000).toFixed(3)+" kg";
    if(batchUnit==="lb") return (grams/453.592).toFixed(2)+" lb";
    if(batchUnit==="oz") return (grams/28.3495).toFixed(2)+" oz";
    return grams.toFixed(decimals)+" g";
  };
  const fmtUnitShort=(grams:number):string=>{
    if(batchUnit==="kg") return (grams/1000).toFixed(3);
    if(batchUnit==="lb") return (grams/453.592).toFixed(2);
    if(batchUnit==="oz") return (grams/28.3495).toFixed(2);
    return grams.toFixed(1);
  };
  const unitSuffix = batchUnit==="g"?"g":batchUnit==="kg"?"kg":batchUnit==="lb"?"lb":"oz";

  const wt=(key:keyof OilProfile)=>oils.reduce((s,e)=>{
    const rawW = parseFloat(String(e.weight))||0;
    const rawP = parseFloat(String(e.pct))||0;
    const w = oilInputMode==="pct" ? (rawP/100)*batchGrams : rawW;
    const sh=effOilG>0?w/effOilG:0;
    return s+((SAP[e.oil]?.[key] as number)??0)*sh;
  },0);
  const fa:FattyAcids={lauric:wt("lauric"),myristic:wt("myristic"),palmitic:wt("palmitic"),stearic:wt("stearic"),ricinoleic:wt("ricinoleic"),oleic:wt("oleic"),linoleic:wt("linoleic"),linolenic:wt("linolenic")};
  const scores:BlendScores={bubblyLather:fa.lauric+fa.myristic,creamyLather:fa.palmitic+fa.stearic+fa.ricinoleic,cleansing:fa.lauric+fa.myristic,condition:fa.ricinoleic+fa.oleic+fa.linoleic+fa.linolenic,hardness:fa.lauric+fa.myristic+fa.palmitic+fa.stearic,longevity:fa.palmitic+fa.stearic,iodine:wt("iodine"),ins:wt("ins")};
  const oilBreakdown=oils.map(e=>{
    const rawW = parseFloat(String(e.weight))||0;
    const rawP = parseFloat(String(e.pct))||0;
    const w = oilInputMode==="pct" ? (rawP/100)*batchGrams : rawW;
    return{...e,grams:w,dp:effOilG>0?((w/effOilG)*100).toFixed(1):"0"};
  });
  const pctOver=inputMode==="pct"&&pctTotal>100;
  const pctUnder=inputMode==="pct"&&pctTotal<100;

  // Handlers
  const addOil=useCallback(()=>{const used=oils.map(o=>o.oil);const next=OIL_NAMES.find(n=>!used.includes(n))??OIL_NAMES[0];setOils(p=>[...p,{id:gid(),oil:next,weight:50,pct:5}]);},[oils]);
  const updOil=useCallback((id:string,f:keyof OilEntry,v:string)=>{setOils(p=>p.map(e=>e.id!==id?e:{...e,[f]:(f==="weight"||f==="pct")?Math.max(0,parseFloat(v)||0):v}));},[]);
  const remOil=useCallback((id:string)=>setOils(p=>p.filter(e=>e.id!==id)),[]);
  const addAdditive=(name:string)=>{if(additives.find(a=>a.name===name))return;const p=ADDITIVE_PRESETS.find(x=>x.name===name);setAdditives(prev=>[...prev,{id:gid(),name,amount:p?.unit==="pct_oil"?1:10,unit:p?.unit??"g",addAt:p?.addAt??"trace",naohFactor:p?.naohFactor??0,liquidDiscount:false}]);};
  const remAdditive=(name:string)=>setAdditives(p=>p.filter(a=>a.name!==name));
  const updAdditive=(id:string,field:keyof Additive,value:any)=>setAdditives(p=>p.map(a=>a.id!==id?a:{...a,[field]:value}));
  const addLiquid=(name:string)=>{if(customLiquids.find(l=>l.name===name))return;const share=10;setCustomLiquids(p=>{const first=p[0];if(!first)return[{id:gid(),name,pct:100}];const reduced=p.map((l,i)=>i===0?{...l,pct:Math.max(0,l.pct-share)}:l);return[...reduced,{id:gid(),name,pct:share}];});};
  const remLiquid=(name:string)=>setCustomLiquids(p=>p.filter(l=>l.name!==name));

  const handleNew=useCallback(()=>{
    setBlendAnalysis("");setOils([]);setAdditives([]);setFragrances([]);setNotes("");setCustomLiquids([{id:gid(),name:"Distilled Water",pct:100}]);setSoapType("solid");setBatch(1000);setBatchUnit("g");setInputMode("pct");setLyePurity(99);setSuperfat(5);setWaterMode("ratio");setWaterRatio(2.5);setAiApplied(false);setAiRecipeName("");setRecipeId(null);setRName("");setSaveSuccess("✚ New recipe — add oils below!");setTimeout(()=>setSaveSuccess(""),3000);},[]);

  const handleUpdate=async()=>{
    if(!currentRecipeId||!authToken)return;
    setUpdating(true);
    try{
      const r=await fetch(`http://localhost:3001/recipes/${currentRecipeId}`,{method:"PUT",headers:{Authorization:`Bearer ${authToken}`,"Content-Type":"application/json"},
        body:JSON.stringify({soapType,batchGrams:effOilG,oils:oilBreakdown.map(o=>({name:o.oil,pct:parseFloat(o.dp),grams:o.grams})),superfat,naohWeight:lyeWeight,waterAmount,lyePurity,scores,additives:additives.map(a=>({name:a.name,amount:a.amount,unit:a.unit,addAt:a.addAt,naohFactor:a.naohFactor})),fragrances:fragrances.map(f=>({name:f.name,amount:f.amount,mode:f.mode})),fragPct,fragMode,fragWeight,customLiquids:customLiquids.map(l=>({name:l.name,pct:l.pct})),notes,updatedAt:new Date()})});
      if(r.ok){setSaveSuccess(`✓ "${currentRecipeName}" updated!`);setTimeout(()=>setSaveSuccess(""),3000);}
    }catch{setSaveSuccess("Update failed.");setTimeout(()=>setSaveSuccess(""),2000);}
    finally{setUpdating(false);}
  };

  const applyAI=useCallback((recipe:AIRecipe)=>{
    setBlendAnalysis("");setInputMode("pct");
    const bg=recipe.batchGrams||batchGrams;
    setOils(recipe.oils.map(o=>({id:gid(),oil:o.name,weight:Math.round((o.pct/100)*bg),pct:o.pct})));
    setSuperfat(recipe.superfat);
    if(recipe.batchGrams){setBatch(recipe.batchGrams);setBatchUnit("g");}
    if(recipe.dilutionRatio)setDilution(recipe.dilutionRatio);
    if(recipe.waterRatio){setWaterMode("ratio");setWaterRatio(recipe.waterRatio);}
    if(Array.isArray(recipe.additives)&&recipe.additives.length>0){
      setAdditives(recipe.additives.map(a=>{
        const p=ADDITIVE_PRESETS.find(x=>x.name===a.name);
        return{id:gid(),name:a.name,amount:a.amount||0,unit:(a.unit||p?.unit||"g") as any,addAt:(a.addAt||p?.addAt||"trace") as any,naohFactor:p?.naohFactor??0,liquidDiscount:false};
      }));
    }
    if(Array.isArray(recipe.fragrances)&&recipe.fragrances.length>0){
      setFragrances(recipe.fragrances.map(f=>({id:gid(),name:f.name||"",amount:f.amount||0,mode:"oil_pct" as FragMode})));
    }
    if(recipe.fragPct)setFragPct(recipe.fragPct);
    if(Array.isArray(recipe.customLiquids)&&recipe.customLiquids.length>0){
      setCustomLiquids(recipe.customLiquids.map(l=>({id:gid(),name:l.name,pct:l.pct})));
    }
    setAiApplied(true);setAiRecipeName(recipe.recipeName??"");setRecipeId(null);setRName("");setAiUsage(u=>u+1);
  },[batchGrams]);

  const buildPDF=()=>({name:currentRecipeName||aiRecipeName||"My Soap Recipe",description:notes,authorName:currentUser?.name??"Artisan",soapType,batchGrams:effOilG,batchUnit,oils:oilBreakdown.map(o=>({name:o.oil,pct:parseFloat(o.dp),grams:o.grams})),superfat,naohWeight:lyeWeight,waterAmount,lyePurity,dilutionRatio:isLiquid?dilutionRatio:undefined,scores,fa,additives:additives.map(a=>({name:a.name,amount:a.amount,unit:a.unit,addAt:a.addAt})),fragrances:fragrances.map(f=>({name:f.name,amount:f.amount})),fragWeight,customLiquids:customLiquids.map(l=>({name:l.name,pct:l.pct})),notes,aiGenerated:aiApplied,tags:[]});

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"Inter,sans-serif",display:"flex",flexDirection:"column"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes spin{to{transform:rotate(360deg);}} .spin{animation:spin .8s linear infinite;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}} .fadeup{animation:fadeUp .3s ease forwards;}
        input::placeholder{color:${T.textDim};}textarea::placeholder{color:${T.textDim};}
        select option{background:${T.surface2};}
        ::-webkit-scrollbar{width:4px;height:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:${T.border};border-radius:2px;}
        input[type=range]{-webkit-appearance:none;height:4px;border-radius:2px;outline:none;cursor:pointer;background:${T.border};}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:${T.accent};border:2px solid ${T.bg};cursor:pointer;}
        input[type=number]::-webkit-inner-spin-button{opacity:.4;}
      `}</style>

      {/* ── Top nav ── */}
      <div style={{height:52,background:T.surface,borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",padding:"0 20px",gap:12,flexShrink:0,position:"sticky",top:0,zIndex:40}}>
        {/* Brand */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginRight:8}}>
          {isLiquid?<DropletIcon c={T.blue}/>:<FlameIcon c={T.accent}/>}
          <span style={{fontFamily:"Playfair Display,serif",fontSize:18,fontWeight:700,color:T.text}}>SoapCalc<span style={{color:ac}}>AI</span></span>
        </div>

        {/* Soap type */}
        <div style={{display:"flex",borderRadius:8,overflow:"hidden",border:`1px solid ${T.border}`,flexShrink:0}}>
          {([["solid","🔥 Solid"],["liquid","💧 Liquid"]] as [SoapType,string][]).map(([t,l])=>(
            <button key={t} onClick={()=>setSoapType(t)}
              style={{padding:"5px 14px",fontSize:12,fontWeight:600,border:"none",cursor:"pointer",
                background:soapType===t?(t==="liquid"?T.blue:T.accent):"transparent",
                color:soapType===t?"#fff":T.textMuted,transition:"all .15s"}}>
              {l}
            </button>
          ))}
        </div>

        {/* Nav buttons */}
        <div style={{display:"flex",gap:6,alignItems:"center",flex:1,flexWrap:"wrap"}}>
          {onViewPricing&&<button onClick={onViewPricing} style={{padding:"5px 12px",borderRadius:6,fontSize:11,fontWeight:600,border:`1px solid ${T.border2}`,background:"transparent",color:T.accent,cursor:"pointer"}}>✦ Plans</button>}
          {authToken&&<>
            <button onClick={handleNew} style={{padding:"5px 12px",borderRadius:6,fontSize:11,fontWeight:600,border:`1px solid ${T.border}`,background:"transparent",color:T.green,cursor:"pointer"}}>✚ New</button>
            <button onClick={onViewRecipes} style={{padding:"5px 12px",borderRadius:6,fontSize:11,fontWeight:600,border:`1px solid ${T.border}`,background:"transparent",color:T.text,cursor:"pointer"}}>📖 Recipes{currentUser?.plan==="free"&&<span style={{color:T.accent,fontSize:10,marginLeft:3}}>({recipeCount}/2)</span>}</button>
            <button onClick={onViewBatches} style={{padding:"5px 12px",borderRadius:6,fontSize:11,fontWeight:600,border:`1px solid ${T.border}`,background:"transparent",color:T.textMuted,cursor:"pointer"}}>🧪 Batches</button>
          </>}
        </div>

        {/* Right: theme + user */}
        <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
          {/* Theme toggle */}
          <button onClick={()=>setTheme(theme==="dark"?"light":"dark")}
            style={{width:32,height:32,borderRadius:8,border:`1px solid ${T.border}`,background:T.surface2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:T.textMuted}}>
            {theme==="dark"?<SunIcon/>:<MoonIcon/>}
          </button>
          {authToken&&<button onClick={onLogout} style={{padding:"5px 12px",borderRadius:6,fontSize:11,border:`1px solid ${T.border}`,background:"transparent",color:T.textDim,cursor:"pointer"}}>{currentUser?.name} · Sign out</button>}
        </div>
      </div>

      {/* ── Main layout ── */}
      <div style={{display:"flex",flex:1,overflow:"hidden",height:"calc(100vh - 52px)"}}>

        {/* LEFT — scrollable */}
        <div style={{flex:1,overflowY:"auto",padding:20,minWidth:0}}>
          {/* AI Box */}
          <AIBox soapType={soapType} onApply={applyAI} isApplied={aiApplied}
            onClear={()=>{setAiApplied(false);setAiRecipeName("");}} authToken={authToken}
            aiUsage={aiUsage} aiLimit={aiLimit} T={T}/>

          {aiApplied&&<div className="fadeup" style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",borderRadius:8,border:`1px solid ${T.green}44`,background:T.green+"11",marginBottom:12}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:T.green}}/>
            <span style={{fontSize:11,color:T.green}}>AI recipe applied: <em>"{aiRecipeName}"</em></span>
            <span style={{fontSize:10,marginLeft:"auto",color:T.green+"88"}}>Edit freely below</span>
          </div>}

          {isLiquid&&<div style={{display:"flex",gap:10,padding:"10px 14px",borderRadius:8,border:`1px solid ${T.blue}44`,background:T.blue+"11",marginBottom:12,fontSize:11,color:T.blue}}>
            <DropletIcon c={T.blue}/> <span><strong>Liquid Soap (KOH)</strong> — KOH SAP ≈1.403× NaOH. Make paste first, then dilute. Keep superfat 0–3%.</span>
          </div>}

          {/* Step 1 — Units */}
          <Step n={1} title="Units & Batch Size" T={T} accent={ac}>
            <div style={{display:"flex",flexWrap:"wrap",gap:14,alignItems:"flex-end"}}>
              {/* Oils total input */}
              <div>
                <p style={{fontSize:10,textTransform:"uppercase",letterSpacing:"0.07em",color:T.textDim,marginBottom:5}}>Oils Total</p>
                <div style={{display:"flex",alignItems:"center",gap:8,background:T.surface2,border:`1px solid ${T.border}`,borderRadius:8,padding:"6px 12px"}}>
                  <input type="number" value={batchValue} onChange={(e:ChangeEvent<HTMLInputElement>)=>setBatch(parseFloat(e.target.value)||0)}
                    style={{width:80,background:"transparent",color:T.text,fontSize:20,fontWeight:700,border:"none",outline:"none",fontFamily:"Playfair Display,serif"}}/>
                  <span style={{fontSize:12,color:T.textMuted,fontWeight:500}}>{batchUnit}</span>
                </div>
              </div>
              {/* Unit radio buttons */}
              <div>
                <p style={{fontSize:10,textTransform:"uppercase",letterSpacing:"0.07em",color:T.textDim,marginBottom:5}}>Unit of Measure</p>
                <div style={{display:"flex",flexWrap:"wrap",gap:12,alignItems:"center"}}>
                  {([["g","Grams"],["kg","Kilograms"],["lb","Pounds"],["oz","Ounces"]] as [BatchUnit,string][]).map(([u,label])=>(
                    <button key={u} onClick={()=>{
                      const toG = batchUnit==="kg"?batchValue*1000:batchUnit==="lb"?batchValue*453.592:batchUnit==="oz"?batchValue*28.3495:batchValue;
                      const conv = u==="kg"?toG/1000:u==="lb"?toG/453.592:u==="oz"?toG/28.3495:toG;
                      setBatch(parseFloat(conv.toFixed(u==="g"?0:u==="kg"?3:2)));
                      setBatchUnit(u);
                    }} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",padding:0}}>
                      <div style={{width:14,height:14,borderRadius:"50%",border:`2px solid ${batchUnit===u?T.accent:T.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        {batchUnit===u&&<div style={{width:7,height:7,borderRadius:"50%",background:T.accent}}/>}
                      </div>
                      <span style={{fontSize:12,color:batchUnit===u?T.accent:T.textMuted,fontWeight:batchUnit===u?600:400}}>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
              {/* NaOH Purity — label on top, same height as Oils Total */}
              <div>
                <p style={{fontSize:10,textTransform:"uppercase",letterSpacing:"0.07em",color:T.textDim,marginBottom:5}}>
                  {isLiquid?"KOH":"NaOH"} Purity
                </p>
                <div style={{display:"flex",alignItems:"center",gap:4,background:T.surface2,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 12px"}}>
                  <input type="number" min="85" max="100" step="0.5" value={lyePurity}
                    onChange={(e:ChangeEvent<HTMLInputElement>)=>setLyePurity(parseFloat(e.target.value)||90)}
                    style={{width:36,background:"transparent",color:ac,fontSize:20,fontWeight:700,border:"none",outline:"none",textAlign:"right",fontFamily:"Playfair Display,serif"}}/>
                  <span style={{fontSize:14,color:T.textMuted,fontWeight:500}}>%</span>
                </div>
              </div>
              {/* Dilution — same height, liquid only */}
              {isLiquid&&<div>
                <p style={{fontSize:10,textTransform:"uppercase",letterSpacing:"0.07em",color:T.textDim,marginBottom:5}}>Dilution</p>
                <div style={{display:"flex",alignItems:"center",gap:4,background:T.surface2,border:`1px solid ${T.blue}44`,borderRadius:8,padding:"8px 12px"}}>
                  <span style={{fontSize:14,color:T.blue,fontWeight:500}}>1:</span>
                  <input type="number" min="1" max="5" step="0.5" value={dilutionRatio}
                    onChange={(e:ChangeEvent<HTMLInputElement>)=>setDilution(parseFloat(e.target.value)||2.5)}
                    style={{width:36,background:"transparent",color:T.blue,fontSize:20,fontWeight:700,border:"none",outline:"none",fontFamily:"Playfair Display,serif"}}/>
                </div>
              </div>}
            </div>
          </Step>

          {/* Step 2 — Oils */}
          <Step n={2} title="Recipe Oils & Fats" T={T} accent={ac}>

            <OilPanel oils={oils} mode={inputMode} batchGrams={batchGrams} batchUnit={batchUnit} effOilG={effOilG} pctTotal={pctTotal} ac={ac} oilInputMode={oilInputMode} onOilInputModeChange={setOilInputMode}
              aiHighlight={aiApplied} T={T}
              onAdd={(name)=>{if(!oils.find(o=>o.oil===name))setOils(p=>[...p,{id:gid(),oil:name,weight:50,pct:5}]);}}
              onRemove={remOil}
              onChange={updOil}
              onReorder={(from,to)=>setOils(prev=>{const arr=[...prev];const [moved]=arr.splice(from,1);arr.splice(to,0,moved);return arr;})}
            />

            {/* Blend bars */}
            {effOilG>0&&oilBreakdown.length>0&&<div style={{marginTop:10}}>
              <p style={{fontSize:10,textTransform:"uppercase",letterSpacing:"0.07em",color:T.textDim,marginBottom:6}}>Blend composition</p>
              {oilBreakdown.map(o=>(
                <div key={o.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                  <span style={{fontSize:11,color:T.textMuted,width:90,flexShrink:0}}>{OIL_DISPLAY[o.oil]}</span>
                  <div style={{flex:1,height:5,borderRadius:3,background:T.scoreBg,overflow:"hidden"}}>
                    <div style={{height:"100%",borderRadius:3,background:`linear-gradient(to right,${ac},${isLiquid?"#1A5A7A":"#8B6A2A"})`,width:`${o.dp}%`,transition:"width .5s ease"}}/>
                  </div>
                  <span style={{fontSize:10,color:T.textMuted,width:80,textAlign:"right"}}>{o.dp}% · {o.grams.toFixed(0)}g</span>
                </div>
              ))}
            </div>}
          </Step>

          {/* Step 3 — Superfat */}
          <Step n={3} title="Superfat / Lye Discount" T={T} accent={ac}>
            <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
              {/* Big number + stepper */}
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,background:T.surface2,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 14px"}}>
                  <input type="number" min="0" max={isLiquid?10:20} step="0.5" value={superfat}
                    onChange={(e:ChangeEvent<HTMLInputElement>)=>setSuperfat(Math.max(0,Math.min(isLiquid?10:20,parseFloat(e.target.value)||0)))}
                    style={{width:52,background:"transparent",color:T.text,fontSize:28,fontWeight:700,border:"none",outline:"none",textAlign:"right",fontFamily:"Playfair Display,serif"}}/>
                  <span style={{fontSize:16,color:T.textMuted,fontWeight:500}}>%</span>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  <button onClick={()=>setSuperfat(v=>Math.min(isLiquid?10:20,parseFloat((v+0.5).toFixed(1))))}
                    style={{width:30,height:28,border:`1px solid ${T.border}`,borderRadius:6,background:T.surface2,cursor:"pointer",fontSize:16,color:T.text,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:600}}>+</button>
                  <button onClick={()=>setSuperfat(v=>Math.max(0,parseFloat((v-0.5).toFixed(1))))}
                    style={{width:30,height:28,border:`1px solid ${T.border}`,borderRadius:6,background:T.surface2,cursor:"pointer",fontSize:16,color:T.text,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:600}}>−</button>
                </div>
              </div>
              {/* Info + presets */}
              <div style={{flex:1}}>
                {/* Dynamic label + insight */}
                {(()=>{
                  const info:{label:string;color:string;insight:string} = isLiquid
                    ? superfat===0  ? {label:"Zero superfat",    color:T.blue,   insight:"No extra oils — fully saponified. Best for cleaning products."}
                    : superfat<=1   ? {label:"Crystal clear",    color:T.blue,   insight:"Minimal free oils — liquid soap stays clear when cooled."}
                    : superfat<=3   ? {label:"Slightly conditioning", color:T.blue, insight:"Small amount of free oils adds mild conditioning."}
                    :                 {label:"May cause cloudiness", color:T.red,  insight:"High superfat in liquid soap causes cloudiness or separation."}
                    : superfat===0  ? {label:"Zero superfat",    color:T.red,    insight:"All oils fully saponified. Maximum cleansing, no conditioning. Not recommended for skin."}
                    : superfat<=2   ? {label:"High cleanse",     color:T.accent, insight:"Very cleansing bar, minimal conditioning. Good for oily skin or laundry bars."}
                    : superfat<=5   ? {label:"Balanced",         color:T.accent, insight:"Standard recommendation. Good lather, mild conditioning, suitable for most skin types."}
                    : superfat<=8   ? {label:"Conditioning",     color:T.green,  insight:"More free oils = softer, more moisturizing bar. Great for dry skin."}
                    : superfat<=12  ? {label:"Very conditioning", color:T.green, insight:"High free oil content. Very moisturizing — excellent for sensitive or mature skin."}
                    : superfat<=15  ? {label:"Specialty bar",    color:T.green,  insight:"Salt bars, shampoo bars, or luxury conditioning bars commonly use this range."}
                    :                 {label:"Salt bar / luxury", color:T.green, insight:"Common for salt bars (20%) — salt dramatically reduces lather, high superfat compensates."}
                  return (
                    <div style={{marginBottom:8}}>
                      <p style={{fontSize:13,fontWeight:700,color:info.color,marginBottom:3}}>{info.label}</p>
                      <p style={{fontSize:11,color:T.textMuted,lineHeight:1.5}}>{info.insight}</p>
                    </div>
                  );
                })()}
                {/* Presets */}
                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                  {(isLiquid?[0,1,2,3]:
                    [
                      {v:2,  label:"2%"},
                      {v:3,  label:"3%"},
                      {v:5,  label:"5%"},
                      {v:7,  label:"7%"},
                      {v:10, label:"10%"},
                      {v:15, label:"15%"},
                      {v:20, label:"20% 🧂"},
                    ]
                  ).map((item:any)=>{
                    const v = isLiquid?item:item.v;
                    const label = isLiquid?`${item}%`:item.label;
                    return (
                      <button key={v} onClick={()=>setSuperfat(v)}
                        style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,
                          border:`1px solid ${superfat===v?ac:T.border}`,
                          background:superfat===v?ac+"22":"transparent",
                          color:superfat===v?ac:T.textMuted,cursor:"pointer"}}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Step>

          {/* Step 4 — Liquid Amount */}
          <Step n={4} title="Amount of Liquid in Recipe" T={T} accent={ac}>
            {/* Mode segmented control */}
            <div style={{display:"flex",borderRadius:8,overflow:"hidden",border:`1px solid ${T.border}`,marginBottom:14,width:"fit-content"}}>
              {([["ratio","Ratio"],["lye_pct","Lye %"],["oil_pct","Oil %"]] as [WaterMode,string][]).map(([m,label])=>(
                <button key={m} onClick={()=>setWaterMode(m)}
                  style={{padding:"6px 16px",fontSize:12,fontWeight:600,border:"none",cursor:"pointer",
                    background:waterMode===m?ac:"transparent",
                    color:waterMode===m?"#fff":T.textMuted}}>
                  {label}
                </button>
              ))}
            </div>
            {/* Big number + stepper */}
            <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,background:T.surface2,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 14px"}}>
                  <input type="number"
                    min={waterMode==="ratio"?"1":waterMode==="lye_pct"?"20":"25"}
                    max={waterMode==="ratio"?"4":waterMode==="lye_pct"?"40":"50"}
                    step={waterMode==="ratio"?"0.05":"0.5"}
                    value={waterMode==="ratio"?waterRatio:waterMode==="lye_pct"?lyeConcPct:oilPct}
                    onChange={(e:ChangeEvent<HTMLInputElement>)=>{
                      const v=parseFloat(e.target.value)||0;
                      if(waterMode==="ratio")setWaterRatio(v);
                      else if(waterMode==="lye_pct")setLyeConcPct(v);
                      else setOilPct(v);
                    }}
                    style={{width:58,background:"transparent",color:T.text,fontSize:28,fontWeight:700,border:"none",outline:"none",textAlign:"right",fontFamily:"Playfair Display,serif"}}/>
                  <span style={{fontSize:14,color:T.textMuted,fontWeight:500}}>
                    {waterMode==="ratio"?":1":"%"}
                  </span>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  <button onClick={()=>{
                    if(waterMode==="ratio")setWaterRatio(v=>parseFloat(Math.min(4,v+0.05).toFixed(2)));
                    else if(waterMode==="lye_pct")setLyeConcPct(v=>Math.min(40,parseFloat((v+0.5).toFixed(1))));
                    else setOilPct(v=>Math.min(50,v+1));
                  }} style={{width:30,height:28,border:`1px solid ${T.border}`,borderRadius:6,background:T.surface2,cursor:"pointer",fontSize:16,color:T.text,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:600}}>+</button>
                  <button onClick={()=>{
                    if(waterMode==="ratio")setWaterRatio(v=>parseFloat(Math.max(1,v-0.05).toFixed(2)));
                    else if(waterMode==="lye_pct")setLyeConcPct(v=>Math.max(20,parseFloat((v-0.5).toFixed(1))));
                    else setOilPct(v=>Math.max(25,v-1));
                  }} style={{width:30,height:28,border:`1px solid ${T.border}`,borderRadius:6,background:T.surface2,cursor:"pointer",fontSize:16,color:T.text,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:600}}>−</button>
                </div>
              </div>
              {/* Computed value + hint */}
              <div style={{flex:1,paddingTop:4}}>
                <p style={{fontSize:20,fontWeight:700,color:ac,fontFamily:"Playfair Display,serif",marginBottom:4}}>
                  {fmtUnit(waterAmount,1)}
                </p>
                {/* Computed cross-values */}
                <p style={{fontSize:11,color:T.textMuted,marginBottom:4}}>
                  {waterMode==="ratio"?`${lyeConc.toFixed(1)}% lye conc. · ${(effOilG>0?(waterAmount/effOilG*100):0).toFixed(1)}% of oils`
                    :waterMode==="lye_pct"?`${liquidLyeR.toFixed(2)}:1 ratio · ${(effOilG>0?(waterAmount/effOilG*100):0).toFixed(1)}% of oils`
                    :`${liquidLyeR.toFixed(2)}:1 ratio · ${lyeConc.toFixed(1)}% lye conc.`}
                </p>
                {/* Insight per mode + value */}
                {(()=>{
                  const insights:{label:string;text:string;color:string}[] =
                    waterMode==="ratio"
                      ? waterRatio<1.8  ? [{label:"Very low water",   color:T.red,    text:"Harder trace, faster unmolding. Risk of lye-heavy soap. Advanced use only."}]
                      : waterRatio<2.3  ? [{label:"Low water",        color:T.accent, text:"Faster trace, firmer bar sooner. Good for swirls and layered designs."}]
                      : waterRatio<2.8  ? [{label:"Standard water",   color:T.green,  text:"Most versatile ratio. Soft trace, plenty of working time for beginners."}]
                      : waterRatio<3.3  ? [{label:"High water",       color:T.accent, text:"Softer trace, longer cure time. Good for intricate designs needing fluid batter."}]
                      :                   [{label:"Very high water",  color:T.red,    text:"Very slow trace and long cure. Soap may take weeks to harden properly."}]
                    : waterMode==="lye_pct"
                      ? lyeConcPct<25   ? [{label:"Very dilute lye",   color:T.red,    text:"Very soft trace, extremely long cure. Not recommended for beginners."}]
                      : lyeConcPct<30   ? [{label:"Dilute lye",        color:T.accent, text:"Soft trace, long working time. Popular for detailed artistic designs."}]
                      : lyeConcPct<35   ? [{label:"Standard concentration", color:T.green, text:"Common soapmaking range. Good balance of trace speed and working time."}]
                      : lyeConcPct<38   ? [{label:"Concentrated lye",  color:T.accent, text:"Faster trace, firmer bars. May cause lye-heavy streaks if not careful."}]
                      :                   [{label:"High concentration", color:T.red,   text:"Very fast trace. Risk of soap seizing. For experienced soapers only."}]
                    : oilPct<30         ? [{label:"Very low water",    color:T.red,    text:"Difficult to work with — batter may seize quickly."}]
                    : oilPct<35         ? [{label:"Low water",         color:T.accent, text:"Faster trace. Good for simpler designs."}]
                    : oilPct<40         ? [{label:"Standard water",    color:T.green,  text:"38% is the classic soapmaking standard. Reliable and versatile."}]
                    :                     [{label:"High water",        color:T.accent, text:"Very fluid batter. Long cure time but great for intricate work."}];
                  return insights.map(ins=>(
                    <div key={ins.label} style={{marginBottom:6}}>
                      <span style={{fontSize:11,fontWeight:700,color:ins.color}}>{ins.label} — </span>
                      <span style={{fontSize:11,color:T.textMuted}}>{ins.text}</span>
                    </div>
                  ));
                })()}
                {/* Quick presets */}
                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                  {waterMode==="ratio"&&[1.5,2.0,2.5,3.0].map(v=>(
                    <button key={v} onClick={()=>setWaterRatio(v)}
                      style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,border:`1px solid ${waterRatio===v?ac:T.border}`,background:waterRatio===v?ac+"22":"transparent",color:waterRatio===v?ac:T.textMuted,cursor:"pointer"}}>
                      {v}:1
                    </button>
                  ))}
                  {waterMode==="lye_pct"&&[28,30,33,36,38].map(v=>(
                    <button key={v} onClick={()=>setLyeConcPct(v)}
                      style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,border:`1px solid ${lyeConcPct===v?ac:T.border}`,background:lyeConcPct===v?ac+"22":"transparent",color:lyeConcPct===v?ac:T.textMuted,cursor:"pointer"}}>
                      {v}%
                    </button>
                  ))}
                  {waterMode==="oil_pct"&&[30,33,35,38,40].map(v=>(
                    <button key={v} onClick={()=>setOilPct(v)}
                      style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,border:`1px solid ${oilPct===v?ac:T.border}`,background:oilPct===v?ac+"22":"transparent",color:oilPct===v?ac:T.textMuted,cursor:"pointer"}}>
                      {v}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Step>

          {/* Step 4 — Custom Liquids */}
          <Step n={5} title="Custom Liquids" T={T} accent={ac} defaultOpen={false}>
            <LRPanel T={T} available={LIQUID_PRESETS} selected={customLiquids.map(l=>l.name)}
              onAdd={addLiquid} onRemove={remLiquid} placeholder="Search liquids…"
              renderSelected={()=>(
                <>
                  {customLiquids.map(liq=>{
                    const p=LIQUID_PRESETS.find(x=>x.name===liq.name);
                    return (
                      <div key={liq.id} style={{padding:"10px",borderRadius:8,background:T.surface2,border:`1px solid ${T.border}`,marginBottom:6}}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                          <span style={{fontSize:12,fontWeight:600,color:T.text}}>{p?.emoji} {liq.name}</span>
                          <button onClick={()=>remLiquid(liq.name)} style={{background:"none",border:"none",cursor:"pointer",color:T.textDim}}><XIcon/></button>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <input type="number" min="0" max="100" value={liq.pct}
                            onChange={(e:ChangeEvent<HTMLInputElement>)=>setCustomLiquids(prev=>prev.map(l=>l.id!==liq.id?l:{...l,pct:parseFloat(e.target.value)||0}))}
                            style={{width:64,background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:6,padding:"6px 8px",color:ac,fontSize:15,fontWeight:700,outline:"none",textAlign:"right"}}/>
                          <span style={{fontSize:13,color:T.textMuted,fontWeight:500}}>%</span>
                          <span style={{fontSize:14,color:T.text,fontWeight:600,marginLeft:"auto"}}>{(waterAmount*(liq.pct/100)).toFixed(1)}g</span>
                        </div>
                        {p?.note&&<p style={{fontSize:10,color:T.textDim,marginTop:4}}>💡 {p.note}</p>}
                      </div>
                    );
                  })}
                  {customLiquids.reduce((s,l)=>s+l.pct,0)!==100&&<p style={{fontSize:10,color:T.red}}>⚠ Should total 100% (currently {customLiquids.reduce((s,l)=>s+l.pct,0).toFixed(0)}%)</p>}
                </>
              )}/>
          </Step>

          {/* Step 5 — Additives */}
          <Step n={6} title="Custom Additives" T={T} accent={ac} defaultOpen={false}>
            {citricExtra>0&&<div style={{padding:"8px 10px",borderRadius:6,background:ac+"11",border:`1px solid ${ac+"44"}`,color:ac,fontSize:11,marginBottom:8}}>
              🍋 Citric acid adds <strong>{citricExtra.toFixed(2)}g</strong> extra NaOH → Total: <strong>{lyeWeight.toFixed(2)}g</strong>
            </div>}
            <LRPanel T={T} available={ADDITIVE_PRESETS} selected={additives.map(a=>a.name)}
              onAdd={addAdditive} onRemove={remAdditive} placeholder="Search additives…"
              renderSelected={()=>(
                <>
                  {additives.map(a=>{
                    const p=ADDITIVE_PRESETS.find(x=>x.name===a.name);
                    return (
                      <div key={a.id} style={{padding:"10px",borderRadius:8,background:T.surface2,border:`1px solid ${T.border}`,marginBottom:6}}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                          <span style={{fontSize:12,fontWeight:600,color:T.text}}>{p?.emoji} {a.name}</span>
                          <button onClick={()=>remAdditive(a.name)} style={{background:"none",border:"none",cursor:"pointer",color:T.textDim}}><XIcon/></button>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                          <input type="number" min="0" step="0.1" value={a.amount} onChange={(e:ChangeEvent<HTMLInputElement>)=>updAdditive(a.id,"amount",parseFloat(e.target.value)||0)}
                            style={{width:50,background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:5,padding:"3px 6px",color:ac,fontSize:12,fontWeight:600,outline:"none",textAlign:"right"}}/>
                          <select value={a.unit} onChange={(e:ChangeEvent<HTMLSelectElement>)=>updAdditive(a.id,"unit",e.target.value)}
                            style={{fontSize:11,background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:5,padding:"3px 6px",color:T.textMuted,outline:"none"}}>
                            <option value="pct_oil">% oils</option><option value="g">g</option><option value="tsp">tsp</option><option value="tbsp">tbsp</option><option value="ml">ml</option>
                          </select>
                          <select value={a.addAt} onChange={(e:ChangeEvent<HTMLSelectElement>)=>updAdditive(a.id,"addAt",e.target.value)}
                            style={{fontSize:11,background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:5,padding:"3px 6px",color:T.textMuted,outline:"none"}}>
                            <option value="liquid">w/ Liquid</option><option value="fats">w/ Fats</option><option value="trace">At Trace</option>
                          </select>
                          <span style={{fontSize:14,color:T.text,fontWeight:600,marginLeft:"auto"}}>{a.unit==="pct_oil"?(effOilG*a.amount/100).toFixed(1):a.amount}{a.unit==="pct_oil"?"g":a.unit}</span>
                        </div>
                        {a.naohFactor>0&&a.amount>0&&<p style={{fontSize:10,color:ac}}>⚗ +{((a.unit==="pct_oil"?effOilG*a.amount/100:a.amount)*a.naohFactor).toFixed(2)}g extra NaOH</p>}
                        <div style={{marginTop:6}}><ToggleSwitch value={a.liquidDiscount} onChange={v=>updAdditive(a.id,"liquidDiscount",v)} label="Liquid Discount?" T={T}/></div>
                        {p?.note&&<p style={{fontSize:10,color:T.textDim,marginTop:4}}>💡 {p.note}</p>}
                      </div>
                    );
                  })}
                </>
              )}/>
          </Step>

          {/* Step 6 — Fragrances */}
          <Step n={7} title="Fragrances" T={T} accent={ac} defaultOpen={false}>
            <div style={{marginBottom:12}}>
              <RadioOpt label="% oil weight — recommended 3%" selected={fragMode==="oil_pct"} onClick={()=>setFragMode("oil_pct")} T={T}/>
              {fragMode==="oil_pct"&&<div style={{display:"flex",alignItems:"center",gap:8,marginLeft:26,marginBottom:6}}>
                <input type="number" min="0.5" max="10" step="0.5" value={fragPct} onChange={(e:ChangeEvent<HTMLInputElement>)=>setFragPct(parseFloat(e.target.value)||3)}
                  style={{width:64,background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:6,padding:"6px 8px",color:ac,fontSize:15,fontWeight:700,outline:"none",textAlign:"right"}}/>
                <span style={{fontSize:13,color:T.textMuted,fontWeight:500}}>%</span>
                <span style={{fontSize:14,color:T.text,fontWeight:600,marginLeft:"auto"}}>{fragWeight.toFixed(1)}g</span>
              </div>}
              <RadioOpt label="g/kg of oils" selected={fragMode==="g_per_kg"} onClick={()=>setFragMode("g_per_kg")} T={T}/>
              {fragMode==="g_per_kg"&&<div style={{display:"flex",alignItems:"center",gap:8,marginLeft:26,marginBottom:6}}>
                <input type="number" min="0" max="100" step="1" value={fragPct} onChange={(e:ChangeEvent<HTMLInputElement>)=>setFragPct(parseFloat(e.target.value)||30)}
                  style={{width:60,background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:6,padding:"5px 8px",color:ac,fontSize:13,fontWeight:600,outline:"none"}}/>
                <span style={{fontSize:11,color:T.textMuted}}>g per kg</span>
              </div>}
            </div>
            <div style={{marginBottom:8}}>
              {fragrances.map(f=>(
                <div key={f.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:8,background:T.surface2,border:`1px solid ${T.border}`,marginBottom:6}}>
                  <input type="text" value={f.name} placeholder="Fragrance name"
                    onChange={(e:ChangeEvent<HTMLInputElement>)=>setFragrances(p=>p.map(x=>x.id!==f.id?x:{...x,name:e.target.value}))}
                    style={{flex:1,background:"transparent",color:T.text,fontSize:12,border:"none",outline:"none"}}/>
                  <input type="number" min="0" value={f.amount}
                    onChange={(e:ChangeEvent<HTMLInputElement>)=>setFragrances(p=>p.map(x=>x.id!==f.id?x:{...x,amount:parseFloat(e.target.value)||0}))}
                    style={{width:50,background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:5,padding:"3px 6px",color:ac,fontSize:12,fontWeight:600,outline:"none",textAlign:"right"}}/>
                  <span style={{fontSize:10,color:T.textMuted}}>g</span>
                  <button onClick={()=>setFragrances(p=>p.filter(x=>x.id!==f.id))} style={{background:"none",border:"none",cursor:"pointer",color:T.textDim}}><TrashIcon/></button>
                </div>
              ))}
            </div>
            {fragrances.length===0&&<p style={{fontSize:11,color:T.textDim,textAlign:"center",padding:"10px 0"}}>No fragrances added</p>}
            <button onClick={()=>setFragrances(p=>[...p,{id:gid(),name:"",amount:fragMode==="oil_pct"?fragWeight:30,mode:fragMode}])}
              style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"7px",borderRadius:8,border:`1px dashed ${T.border}`,background:"transparent",color:ac,cursor:"pointer",fontSize:12}}>
              <PlusIcon/> Add row
            </button>
          </Step>

          {/* Step 7 — Notes */}
          <Step n={8} title="Notes" T={T} accent={ac} defaultOpen={false}>
            <p style={{fontSize:11,color:T.textDim,marginBottom:8}}>ℹ Add notes to include in your printed report or save to recall later.</p>
            <textarea value={notes} onChange={(e:ChangeEvent<HTMLTextAreaElement>)=>setNotes(e.target.value)}
              placeholder="e.g. Add 2 tbsp sodium lactate for faster unmolding. Insulate for 24h..."
              rows={4} style={{width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 12px",color:T.text,fontSize:12,outline:"none",resize:"vertical",fontFamily:"Inter,sans-serif"}}/>
          </Step>

          <p style={{textAlign:"center",fontSize:10,color:T.textDim,padding:"8px 0 20px"}}>
            {isLiquid?"KOH = Σ(Oil × KOH SAP) × (1−SF%) ÷ KOH Purity · Cook to neutral pH.":"NaOH = Σ(Oil × NaOH SAP) × (1−SF%) ÷ NaOH Purity · Handle lye with care."}
          </p>
        </div>

        {/* RIGHT — fixed results + sticky action bar */}
        <div style={{width:"clamp(260px, 28vw, 340px)",flexShrink:0,borderLeft:`1px solid ${T.border}`,background:T.panelBg,display:"flex",flexDirection:"column",height:"100%",minHeight:0}}>
        <div style={{flex:1,overflowY:"auto",minHeight:0}}>

          {/* Recipe name banner */}
          {currentRecipeId&&<div style={{padding:"10px 16px",borderBottom:`1px solid ${T.border}`,background:T.accent+"11"}}>
            <p style={{fontSize:10,color:T.accent,textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 2px"}}>Editing</p>
            <p style={{fontSize:12,fontWeight:600,color:T.text,margin:0}}>{currentRecipeName}</p>
          </div>}

          {/* NaOH hero */}
          <div style={{padding:"16px",textAlign:"center",borderBottom:`1px solid ${T.border}`}}>
            <p style={{fontSize:9,textTransform:"uppercase",letterSpacing:"0.1em",color:T.textMuted,marginBottom:6}}>{isLiquid?"KOH":"NaOH"} REQUIRED @ {lyePurity}%</p>
            <p style={{fontSize:48,fontWeight:700,fontFamily:"Playfair Display,serif",lineHeight:1,marginBottom:2,color:T.text}}>
              <AnimatedNum value={batchUnit==="kg"?lyeWeight/1000:batchUnit==="lb"?lyeWeight/453.592:batchUnit==="oz"?lyeWeight/28.3495:lyeWeight} decimals={batchUnit==="g"?2:3} color={T.text}/>
            </p>
            <p style={{fontSize:13,color:ac,marginBottom:8}}>{unitSuffix}</p>
            {citricExtra>0&&<p style={{fontSize:9,color:"#C0C040",marginBottom:6}}>incl. +{citricExtra.toFixed(2)}g citric adj.</p>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div style={{background:T.surface,borderRadius:8,border:`1px solid ${T.border}`,padding:"10px 8px"}}>
                <p style={{fontSize:9,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.07em",margin:"0 0 4px"}}>Liquid</p>
                <p style={{fontSize:16,fontWeight:700,color:T.text,margin:0,fontFamily:"Playfair Display,serif"}}>
                  <AnimatedNum value={batchUnit==="kg"?waterAmount/1000:batchUnit==="lb"?waterAmount/453.592:batchUnit==="oz"?waterAmount/28.3495:waterAmount} decimals={batchUnit==="g"?1:3} color={T.text}/>
                  <span style={{fontSize:10,color:T.textMuted}}> {unitSuffix}</span>
                </p>
              </div>
              <div style={{background:T.surface,borderRadius:8,border:`1px solid ${T.border}`,padding:"10px 8px"}}>
                <p style={{fontSize:9,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.07em",margin:"0 0 4px"}}>Lye Conc.</p>
                <p style={{fontSize:16,fontWeight:700,color:T.text,margin:0,fontFamily:"Playfair Display,serif"}}><AnimatedNum value={lyeConc} decimals={1} color={T.text}/><span style={{fontSize:10,color:T.textMuted}}>%</span></p>
              </div>
            </div>
          </div>

          {/* Liquid soap dilution */}
          {isLiquid&&<div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,background:T.blue+"08"}}>
            <p style={{fontSize:10,textTransform:"uppercase",letterSpacing:"0.06em",color:T.blue,marginBottom:6}}>Dilution → Liquid Soap</p>
            {[["Paste Weight",fmtUnit(batchTotal,0)],["Dilution Water",fmtUnit(batchTotal*dilutionRatio,0)],["Finished Soap",fmtUnit(batchTotal*(1+dilutionRatio),0)]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${T.border}`}}>
                <span style={{fontSize:11,color:T.textMuted}}>{l}</span><span style={{fontSize:11,fontWeight:600,color:T.blue}}>{v}</span>
              </div>
            ))}
          </div>}

          {/* Recipe Totals */}
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`}}>
            <p style={{fontSize:9,textTransform:"uppercase",letterSpacing:"0.07em",color:T.textDim,marginBottom:8}}>Recipe Totals</p>
            {([
              ["Oil Weight",    fmtUnit(effOilG,0),             T.text,     false],
              [isLiquid?"KOH":"NaOH Weight", fmtUnit(lyeWeight,2), ac,      false],
              ["Liquid Required", fmtUnit(waterAmount,1),        T.text,    false],
              ...(fragWeight>0?[["Fragrance", fmtUnit(fragWeight,1), T.textMuted, false] as [string,string,string,boolean]]:[]),
              ["Super Fat",     superfat+"%",                    T.textMuted, false],
              ["Total Batch",   fmtUnit(batchTotal,0),           T.text,    true],
              ["Lye Conc.",     lyeConc.toFixed(1)+"%",          T.textMuted, false],
              ["Liq : Lye",     liquidLyeR.toFixed(2)+":1",      T.textMuted, false],
              ["Sat : Unsat",   `${Math.round(fa.lauric+fa.myristic+fa.palmitic+fa.stearic)}:${Math.round(fa.oleic+fa.linoleic+fa.linolenic+fa.ricinoleic)}`, T.textMuted, false],
            ] as [string,string,string,boolean][]).map(([l,v,col,bold])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",padding:"5px 0",borderBottom:`1px solid ${T.border}`}}>
                <span style={{fontSize:11,color:T.textMuted}}>{l}</span>
                <span style={{fontSize:bold?13:11,fontWeight:bold?700:600,color:col,fontFamily:bold?"Playfair Display,serif":"inherit"}}>{v}</span>
              </div>
            ))}
          </div>

          {/* Recipe Properties */}
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`}}>
            <p style={{fontSize:10,textTransform:"uppercase",letterSpacing:"0.07em",color:T.textDim,marginBottom:8}}>Recipe Properties</p>
            <ScoreBar label="Bubbly Lather"  value={scores.bubblyLather}  ideal={[14,46]} T={T}/>
            <ScoreBar label="Cleansing"      value={scores.cleansing}     ideal={[12,22]} T={T}/>
            <ScoreBar label="Condition"      value={scores.condition}     ideal={[44,69]} T={T}/>
            {!isLiquid&&<><ScoreBar label="Hardness"    value={scores.hardness}   ideal={[29,54]} T={T}/>
            <ScoreBar label="Longevity"   value={scores.longevity}  ideal={[25,50]} T={T}/></>}
            <ScoreBar label="Creamy Lather"  value={scores.creamyLather}  ideal={[16,48]} T={T}/>
            <ScoreBar label="Iodine"         value={scores.iodine}        ideal={[41,70]} T={T}/>
            {!isLiquid&&<ScoreBar label="INS"          value={scores.ins}        ideal={[136,165]} T={T}/>}
            <p style={{fontSize:9,color:T.textDim,marginTop:6}}>Green = within recommended range · {isLiquid?"":"Recommended ranges from SMF"}</p>
          </div>

          {/* Insight panel — rule-based + AI deep dive */}
          {effOilG>0&&(()=>{
            const issues:string[]=[];
            const goods:string[]=[];
            if(scores.bubblyLather<14)issues.push("Low bubbly lather — add more Coconut or Palm Kernel");
            else if(scores.bubblyLather>46)issues.push("High bubbly lather — may be drying, reduce Coconut");
            else goods.push("Good bubbly lather");
            if(scores.cleansing<12)issues.push("Low cleansing — increase high-lauric oils");
            else if(scores.cleansing>22)issues.push("Very cleansing — may strip skin, increase conditioning oils");
            else goods.push("Good cleansing power");
            if(scores.condition<44)issues.push("Low conditioning — add more Olive, Canola, or Castor");
            else if(scores.condition>69)issues.push("Very high conditioning — bar may be soft or slow to lather");
            else goods.push("Well-conditioned bar");
            if(!isLiquid){
              if(scores.hardness<29)issues.push("Soft bar — add Palm, Lard, or CocoaButter for hardness");
              if(scores.ins<136)issues.push("Low INS — bar may be too soft or slow to harden");
              else if(scores.ins>165)issues.push("High INS — bar may be brittle or harsh");
            }
            const isGood=issues.length===0;
            return(
              <div style={{borderBottom:`1px solid ${T.border}`}}>
                {/* Rule-based summary */}
                <div style={{padding:"10px 16px",background:isGood?T.green+"08":T.accent+"08"}}>
                  {isGood?(
                    <>
                      <p style={{fontSize:10,fontWeight:600,color:T.green,marginBottom:3}}>✓ Well-balanced blend</p>
                      <p style={{fontSize:10,color:T.textMuted}}>{goods.join(" · ")}</p>
                    </>
                  ):(
                    <>
                      <p style={{fontSize:10,fontWeight:600,color:T.accent,marginBottom:4}}>Suggestions</p>
                      {issues.map(i=><p key={i} style={{fontSize:10,color:T.textMuted,marginBottom:2}}>· {i}</p>)}
                    </>
                  )}
                </div>
                {/* AI deep dive */}
                {authToken&&(
                  <div style={{padding:"8px 16px",background:T.surface}}>
                    {!blendAnalysis&&!analyzing&&(
                      <button onClick={async()=>{
                        setAnalyzing(true);
                        setBlendAnalysis("");
                        try{
                          const oilList=oilBreakdown.map(o=>`${OIL_DISPLAY[o.oil]} ${o.dp}%`).join(", ");
                          const liqList=customLiquids.map(l=>`${l.name} ${l.pct}%`).join(", ");
                          const addList=additives.map(a=>`${a.name} ${a.amount}${a.unit==="pct_oil"?`% oils (≈${(effOilG*a.amount/100).toFixed(1)}g)`:a.unit} at ${a.addAt}`).join(", ");
                          const fragEntries=fragrances.filter(f=>f.name).map(f=>`${f.name} ${f.amount}g`).join(", ");
                          const fragInfo=fragWeight>0?`${fragPct}% oil weight = ${fragWeight.toFixed(1)}g total${fragEntries?` (${fragEntries})`:""}`:(fragEntries||"none");
                          const isSaltBar=additives.some(a=>a.name.toLowerCase().includes("salt")&&a.amount>=20);
                          const hasMilk=customLiquids.some(l=>l.name.toLowerCase().includes("milk"));
                          const recipeType=isSaltBar?"SALT BAR":hasMilk?"MILK SOAP":"standard soap";
                          const prompt=`You are an expert soapmaker. Analyze this ${recipeType} recipe. Be concise (3-4 sentences max).

${isSaltBar?`IMPORTANT: This is a SALT BAR. Salt bars intentionally use 75-80% coconut oil with 15-20% superfat — this is CORRECT for salt bars (not excessive). Salt at 50-100% of oil weight is normal for salt bars. Do NOT suggest reducing superfat to 5-7% or salt to 1-2% — that would ruin the salt bar. Judge by salt bar standards, not regular soap standards.`:""}
${hasMilk?`IMPORTANT: This is a MILK SOAP. Milk replaces some/all water. Lower temps and lighter trace are expected.`:""}

Soap type: ${soapType}
Oils: ${oilList}
Superfat: ${superfat}%
Water:Lye ratio: ${(waterAmount/lyeWeight).toFixed(2)}:1
Custom liquids: ${liqList||"Distilled Water 100%"}
Additives: ${addList||"none"}
Fragrances: ${fragInfo}
Scores: Hardness ${Math.round(scores.hardness)}, Cleansing ${Math.round(scores.cleansing)}, Condition ${Math.round(scores.condition)}, Bubbly ${Math.round(scores.bubblyLather)}, Creamy ${Math.round(scores.creamyLather)}, INS ${Math.round(scores.ins)}, Iodine ${Math.round(scores.iodine)}
Fatty acids: Lauric ${Math.round(fa.lauric)}%, Palmitic ${Math.round(fa.palmitic)}%, Oleic ${Math.round(fa.oleic)}%, Linoleic ${Math.round(fa.linoleic)}%

Assess strengths, concerns, and one improvement — all in the context of what this recipe is trying to be (${recipeType}).`;
                          const r=await fetch("http://localhost:3001/api/analyze",{
                            method:"POST",
                            headers:{"Content-Type":"application/json","Authorization":`Bearer ${authToken}`},
                            body:JSON.stringify({
                              model:"claude-haiku-4-5-20251001",
                              max_tokens:300,
                              messages:[{role:"user",content:prompt}]
                            })
                          });
                          const d=await r.json();
                          if(!r.ok)throw new Error(d.error??"Analysis failed");
                          const text=(d.content as any[]).map((b:any)=>b.text??"").join("").trim();
                          setBlendAnalysis(text);
                        }catch{setBlendAnalysis("Analysis failed. Try again.");}
                        finally{setAnalyzing(false);}
                      }}
                      style={{display:"flex",alignItems:"center",gap:6,background:"transparent",border:`1px solid ${T.border}`,borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:11,color:T.textMuted,width:"100%",justifyContent:"center"}}>
                        {analyzing?(
                          <svg className="spin" style={{width:12,height:12}} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
                        ):<SparkleIcon/>}
                        <span>{analyzing?"Analyzing blend…":"✦ AI Deep Dive"}</span>
                      </button>
                    )}
                    {analyzing&&!blendAnalysis&&(
                      <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0",fontSize:11,color:T.textDim,justifyContent:"center"}}>
                        <svg className="spin" style={{width:12,height:12}} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
                        Analyzing with Haiku…
                      </div>
                    )}
                    {blendAnalysis&&(
                      <div style={{paddingTop:6}}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                          <p style={{fontSize:10,fontWeight:600,color:T.accent}}>✦ AI Analysis · Haiku</p>
                          <button onClick={()=>setBlendAnalysis("")}
                            style={{background:"none",border:"none",cursor:"pointer",color:T.textDim,fontSize:10,padding:0}}>
                            ✕ clear
                          </button>
                        </div>
                        <p style={{fontSize:10,color:T.textMuted,lineHeight:1.6}}>
                          {blendAnalysis}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Fatty Acids — inline after properties */}
          <div style={{padding:"10px 16px",borderBottom:`1px solid ${T.border}`}}>
            <p style={{fontSize:10,textTransform:"uppercase",letterSpacing:"0.07em",color:T.textDim,marginBottom:8}}>Fatty Acids %</p>
            {(Object.entries(fa) as [keyof FattyAcids,number][]).map(([k,v])=>(
              <div key={k} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                <span style={{fontSize:10,color:T.textMuted,width:64,textTransform:"capitalize"}}>{k}</span>
                <div style={{flex:1,height:4,borderRadius:2,background:T.scoreBg,overflow:"hidden"}}>
                  <div style={{height:"100%",borderRadius:2,background:ac,width:`${Math.min(v,100)}%`}}/>
                </div>
                <span style={{fontSize:10,fontWeight:600,color:T.textDim,width:26,textAlign:"right"}}>{Math.round(v)}%</span>
              </div>
            ))}
          </div>

          </div>{/* end scrollable content */}
          {/* ── Pinned action bar ── */}
          <div style={{padding:"12px 16px",background:T.surface,borderTop:`2px solid ${T.border2}`,flexShrink:0}}>
            {currentRecipeId?(
              <>
                <button onClick={handleUpdate} disabled={updating}
                  style={{width:"100%",padding:"10px",borderRadius:8,background:T.accent,color:"#0A0908",border:"none",cursor:"pointer",fontSize:13,fontWeight:700,marginBottom:6,opacity:updating?.6:1}}>
                  {updating?"Updating…":`💾 Update "${currentRecipeName.length>14?currentRecipeName.slice(0,14)+"…":currentRecipeName}"`}
                </button>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                  <button onClick={()=>setShowSave(true)} style={{padding:"8px",borderRadius:8,border:`1px solid ${T.border2}`,background:"transparent",color:T.text,cursor:"pointer",fontSize:12,fontWeight:600}}>💾 Save as New</button>
                  <button onClick={()=>generateRecipePDF(buildPDF())} style={{padding:"8px",borderRadius:8,border:`1px solid ${T.border2}`,background:"transparent",color:T.textMuted,cursor:"pointer",fontSize:12,fontWeight:600}}>📄 PDF</button>
                </div>
              </>
            ):(
              <>
                <button onClick={()=>setShowSave(true)}
                  style={{width:"100%",padding:"10px",borderRadius:8,background:T.accent,color:"#0A0908",border:"none",cursor:"pointer",fontSize:13,fontWeight:700,marginBottom:6}}>
                  💾 Save Recipe{currentUser?.plan==="free"&&<span style={{fontSize:10,opacity:.7,marginLeft:4}}>({recipeCount}/2)</span>}
                </button>
                <button onClick={()=>generateRecipePDF(buildPDF())} style={{width:"100%",padding:"8px",borderRadius:8,border:`1px solid ${T.border2}`,background:"transparent",color:T.textMuted,cursor:"pointer",fontSize:12,fontWeight:600}}>
                  📄 Export PDF
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Save modal */}
      {showSaveModal&&authToken&&(
        <SaveModal plan={currentUser?.plan??"free"} recipeCount={recipeCount} loading={saving} error={saveError}
          T={T} defaultName={aiApplied?aiRecipeName:""}
          onClose={()=>setShowSave(false)}
          onSave={async(data)=>{
            const r=await saveRecipe(authToken,{...data,soapType,batchGrams:effOilG,
              oils:oilBreakdown.map(o=>({name:o.oil,pct:parseFloat(o.dp),grams:o.grams})),
              superfat,naohWeight:lyeWeight,waterAmount,lyePurity,scores:{...scores},
              additives:additives.map(a=>({name:a.name,amount:a.amount,unit:a.unit,addAt:a.addAt,naohFactor:a.naohFactor})),
              fragrances:fragrances.map(f=>({name:f.name,amount:f.amount,mode:f.mode})),
              fragPct,fragMode,fragWeight,
              customLiquids:customLiquids.map(l=>({name:l.name,pct:l.pct})),
              notes,aiGenerated:aiApplied});
            if(r){setShowSave(false);setRecipeId(r._id);setRName(r.name);setSaveSuccess(`"${r.name}" saved!`);setTimeout(()=>setSaveSuccess(""),3000);}
          }}/>
      )}

      {/* Toast */}
      {saveSuccess&&<div className="fadeup" style={{position:"fixed",bottom:24,right:24,padding:"10px 16px",borderRadius:10,fontSize:12,fontWeight:600,background:"#0F2A10",border:"1px solid #2A6A2A",color:"#60B060",zIndex:100}}>{saveSuccess}</div>}
    </div>
  );
}
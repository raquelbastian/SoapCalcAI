import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { MongoClient, Db, Collection, ObjectId } from "mongodb";
import Anthropic from "@anthropic-ai/sdk";

// ── Env ───────────────────────────────────────────────────────────────────────
const { MONGODB_URI, JWT_SECRET, VITE_ANTHROPIC_API_KEY, PORT = "3001" } = process.env;
if (!MONGODB_URI)            throw new Error("Missing MONGODB_URI");
if (!JWT_SECRET)             throw new Error("Missing JWT_SECRET");
if (!VITE_ANTHROPIC_API_KEY) throw new Error("Missing VITE_ANTHROPIC_API_KEY");

// ── Types ─────────────────────────────────────────────────────────────────────
interface UserDoc {
  _id?: ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  plan: "free" | "premium";
  role: "user" | "admin";
  aiUsageThisMonth: number;
  usageResetAt: Date;
  createdAt: Date;
}

interface OilEntry { name: string; pct: number; grams: number; }

interface RecipeDoc {
  _id?: ObjectId;
  userId: ObjectId;
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
  scores: {
    bubblyLather: number; creamyLather: number; cleansing: number;
    condition: number; hardness: number; longevity: number; iodine: number; ins: number;
  };
  additives: { name: string; amount: number; unit: string; addAt: string }[];
  fragrances: { name: string; amount: number; mode: string }[];
  fragPct: number;
  fragMode: string;
  fragWeight: number;
  customLiquids: { name: string; pct: number }[];
  notes: string;
  visibility: "public" | "private";
  aiGenerated: boolean;
  likes: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface JwtPayload { userId: string; email: string; plan: "free" | "premium"; role: "user" | "admin"; }

declare global {
  namespace Express { interface Request { user?: JwtPayload; } }
}

// ── DB ────────────────────────────────────────────────────────────────────────
let db: Db;
let users: Collection<UserDoc>;
let oils: Collection<any>;
let recipes: Collection<RecipeDoc>;

const client = new MongoClient(MONGODB_URI!);

async function connectDB(): Promise<void> {
  await client.connect();
  db      = client.db("SOAPCALCAI");
  users   = db.collection<UserDoc>("users");
  oils    = db.collection("oils");
  recipes = db.collection<RecipeDoc>("recipes");

  await users.createIndex({ email: 1 }, { unique: true });
  await oils.createIndex({ name: 1 }, { unique: true });
  await recipes.createIndex({ userId: 1, createdAt: -1 });
  await recipes.createIndex({ visibility: 1, createdAt: -1 });

  const oilCount = await oils.countDocuments();
  if (oilCount === 0) await seedOils();

  console.log("✅ MongoDB connected → soapcalcai");
}

async function seedOils(): Promise<void> {
  const K = 1.403;
  const f = (n: number) => parseFloat((n * K).toFixed(4));
  const seed = [
    { name:"Olive",       displayName:"Olive Oil",      emoji:"🫒", naohSap:0.134, kohSap:f(0.134), lauric:0,  myristic:0,  palmitic:13, stearic:3,  ricinoleic:0,  oleic:72, linoleic:10, linolenic:1,  iodine:83,  ins:109, active:true },
    { name:"Coconut",     displayName:"Coconut Oil",    emoji:"🥥", naohSap:0.190, kohSap:f(0.190), lauric:47, myristic:18, palmitic:9,  stearic:3,  ricinoleic:0,  oleic:8,  linoleic:2,  linolenic:0,  iodine:10,  ins:258, active:true },
    { name:"Castor",      displayName:"Castor Oil",     emoji:"🌿", naohSap:0.128, kohSap:f(0.128), lauric:0,  myristic:0,  palmitic:1,  stearic:1,  ricinoleic:90, oleic:4,  linoleic:4,  linolenic:0,  iodine:86,  ins:95,  active:true },
    { name:"Palm",        displayName:"Palm Oil",        emoji:"🌴", naohSap:0.141, kohSap:f(0.141), lauric:0,  myristic:1,  palmitic:44, stearic:5,  ricinoleic:0,  oleic:39, linoleic:10, linolenic:0,  iodine:53,  ins:145, active:true },
    { name:"Canola",      displayName:"Canola Oil",     emoji:"🌻", naohSap:0.124, kohSap:f(0.124), lauric:0,  myristic:0,  palmitic:4,  stearic:2,  ricinoleic:0,  oleic:61, linoleic:21, linolenic:11, iodine:110, ins:56,  active:true },
    { name:"RiceBran",    displayName:"Rice Bran Oil",  emoji:"🌾", naohSap:0.128, kohSap:f(0.128), lauric:0,  myristic:0,  palmitic:17, stearic:2,  ricinoleic:0,  oleic:43, linoleic:36, linolenic:2,  iodine:105, ins:70,  active:true },
    { name:"CocoaButter", displayName:"Cocoa Butter",   emoji:"🍫", naohSap:0.137, kohSap:f(0.137), lauric:0,  myristic:0,  palmitic:26, stearic:34, ricinoleic:0,  oleic:35, linoleic:3,  linolenic:0,  iodine:36,  ins:157, active:true },
    { name:"Shea",        displayName:"Shea Butter",    emoji:"🌰", naohSap:0.128, kohSap:f(0.128), lauric:0,  myristic:0,  palmitic:8,  stearic:45, ricinoleic:0,  oleic:43, linoleic:4,  linolenic:0,  iodine:60,  ins:116, active:true },
    { name:"Avocado",     displayName:"Avocado Oil",    emoji:"🥑", naohSap:0.133, kohSap:f(0.133), lauric:0,  myristic:0,  palmitic:12, stearic:1,  ricinoleic:0,  oleic:72, linoleic:13, linolenic:1,  iodine:90,  ins:99,  active:true },
    { name:"Lard",        displayName:"Lard",           emoji:"🐷", naohSap:0.138, kohSap:f(0.138), lauric:0,  myristic:1,  palmitic:27, stearic:13, ricinoleic:0,  oleic:47, linoleic:11, linolenic:1,  iodine:67,  ins:139, active:true },
  ];
  await oils.insertMany(seed);
  console.log(`🌱 Seeded ${seed.length} oils`);
}

// ── JWT ───────────────────────────────────────────────────────────────────────
const signToken = (p: JwtPayload) => jwt.sign(p, JWT_SECRET!, { expiresIn: "7d" });

const auth = (req: Request, res: Response, next: NextFunction): void => {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) { res.status(401).json({ error: "No token" }); return; }
  try { req.user = jwt.verify(h.slice(7), JWT_SECRET!) as JwtPayload; next(); }
  catch { res.status(401).json({ error: "Invalid or expired token" }); }
};

const adminOnly = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user?.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  next();
};

// ── Plan helpers ──────────────────────────────────────────────────────────────
const FREE_AI_LIMIT      = 2;
const FREE_RECIPE_LIMIT  = 2;

async function checkAndIncrementAI(userId: string, plan: "free" | "premium"): Promise<{ allowed: boolean; error?: string }> {
  if (plan === "premium") return { allowed: true };
  const user = await users.findOne({ _id: new ObjectId(userId) });
  if (!user) return { allowed: false, error: "User not found" };
  if (new Date() >= user.usageResetAt) {
    await users.updateOne({ _id: user._id }, {
      $set: { aiUsageThisMonth: 0, usageResetAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1) }
    });
    user.aiUsageThisMonth = 0;
  }
  if (user.aiUsageThisMonth >= FREE_AI_LIMIT) {
    return { allowed: false, error: `Free plan: ${FREE_AI_LIMIT} AI recipes/month. Upgrade to Premium for unlimited.` };
  }
  await users.updateOne({ _id: user._id }, { $inc: { aiUsageThisMonth: 1 } });
  return { allowed: true };
}

// ── App ───────────────────────────────────────────────────────────────────────
const app = express();
app.use(cors({ origin: "http://localhost:5174" }));
app.use(express.json({ limit: "2mb" }));

// ── Auth routes ───────────────────────────────────────────────────────────────
app.post("/auth/signup", async (req, res): Promise<void> => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) { res.status(400).json({ error: "All fields required." }); return; }
  if (password.length < 8) { res.status(400).json({ error: "Password min 8 characters." }); return; }
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date();
    const result = await users.insertOne({
      name, email: email.toLowerCase(), passwordHash,
      plan: "free", role: "user",
      aiUsageThisMonth: 0,
      usageResetAt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      createdAt: now,
    });
    const token = signToken({ userId: result.insertedId.toString(), email: email.toLowerCase(), plan: "free", role: "user" });
    res.status(201).json({ token, user: { name, email: email.toLowerCase(), plan: "free", role: "user" } });
  } catch (err: any) {
    if (err.code === 11000) res.status(409).json({ error: "Email already registered." });
    else res.status(500).json({ error: "Signup failed." });
  }
});

app.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) { res.status(400).json({ error: "Email and password required." }); return; }
  try {
    const user = await users.findOne({ email: email.toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: "Invalid email or password." }); return;
    }
    const token = signToken({ userId: user._id!.toString(), email: user.email, plan: user.plan, role: user.role });
    res.json({ token, user: { name: user.name, email: user.email, plan: user.plan, role: user.role } });
  } catch { res.status(500).json({ error: "Login failed." }); }
});

app.get("/auth/me", auth, async (req, res): Promise<void> => {
  const user = await users.findOne({ _id: new ObjectId(req.user!.userId) });
  if (!user) { res.status(404).json({ error: "User not found." }); return; }
  const recipeCount = await recipes.countDocuments({ userId: new ObjectId(req.user!.userId) });
  res.json({
    user: { name: user.name, email: user.email, plan: user.plan, role: user.role },
    stats: { aiUsageThisMonth: user.aiUsageThisMonth, aiLimit: FREE_AI_LIMIT, recipeCount, recipeLimit: FREE_RECIPE_LIMIT },
  });
});

// ── Oils ──────────────────────────────────────────────────────────────────────
app.get("/oils", async (_req, res): Promise<void> => {
  const all = await oils.find({ active: true }).toArray();
  res.json(all.map(({ _id, active, ...rest }) => rest));
});

// ── Recipes ───────────────────────────────────────────────────────────────────

// GET /recipes/community — public recipes feed (paginated)
app.get("/recipes/community", async (req, res): Promise<void> => {
  const page  = Math.max(1, parseInt(String(req.query.page  ?? 1)));
  const limit = Math.min(20, parseInt(String(req.query.limit ?? 12)));
  const tag   = req.query.tag as string | undefined;
  const type  = req.query.type as string | undefined;

  const filter: any = { visibility: "public" };
  if (tag)  filter.tags = tag;
  if (type) filter.soapType = type;

  const [docs, total] = await Promise.all([
    recipes.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
    recipes.countDocuments(filter),
  ]);
  res.json({ recipes: docs, total, page, pages: Math.ceil(total / limit) });
});

// GET /recipes/my — user's own recipes
app.get("/recipes/my", auth, async (req, res): Promise<void> => {
  const docs = await recipes.find({ userId: new ObjectId(req.user!.userId) }).sort({ updatedAt: -1 }).toArray();
  res.json(docs);
});

// GET /recipes/:id — single recipe
app.get("/recipes/:id", async (req, res): Promise<void> => {
  try {
    const doc = await recipes.findOne({ _id: new ObjectId(req.params.id) });
    if (!doc) { res.status(404).json({ error: "Recipe not found." }); return; }
    // Private recipes: only owner can view
    const token = req.headers.authorization?.slice(7);
    if (doc.visibility === "private") {
      if (!token) { res.status(403).json({ error: "Private recipe." }); return; }
      try {
        const payload = jwt.verify(token, JWT_SECRET!) as JwtPayload;
        if (payload.userId !== doc.userId.toString()) { res.status(403).json({ error: "Private recipe." }); return; }
      } catch { res.status(403).json({ error: "Private recipe." }); return; }
    }
    res.json(doc);
  } catch { res.status(400).json({ error: "Invalid recipe ID." }); }
});

// POST /recipes — save new recipe
app.post("/recipes", auth, async (req, res): Promise<void> => {
  try {
    // Free tier: max 2 saved recipes
    if (req.user!.plan === "free") {
      const count = await recipes.countDocuments({ userId: new ObjectId(req.user!.userId) });
      if (count >= FREE_RECIPE_LIMIT) {
        res.status(403).json({
          error: `Free plan allows ${FREE_RECIPE_LIMIT} saved recipes. Upgrade to Premium for unlimited.`,
          upgradeRequired: true,
        });
        return;
      }
    }

    const user = await users.findOne({ _id: new ObjectId(req.user!.userId) });
    const now  = new Date();
    const body = req.body;

    const doc: RecipeDoc = {
      userId:      new ObjectId(req.user!.userId),
      authorName:  user?.name ?? "Anonymous",
      name:        body.name?.trim() || "Untitled Recipe",
      description: body.description?.trim() || "",
      soapType:    body.soapType ?? "solid",
      batchGrams:  body.batchGrams ?? 0,
      oils:        body.oils ?? [],
      superfat:    body.superfat ?? 5,
      naohWeight:  body.naohWeight ?? 0,
      waterAmount: body.waterAmount ?? 0,
      lyePurity:   body.lyePurity ?? 99,
      scores:      body.scores ?? {},
      additives:   body.additives ?? [],
      fragrances:  Array.isArray(body.fragrances) ? body.fragrances : [],
      fragPct:     body.fragPct ?? 3,
      fragMode:    body.fragMode ?? "oil_pct",
      fragWeight:  body.fragWeight ?? 0,
      customLiquids: Array.isArray(body.customLiquids) ? body.customLiquids : [],
      notes:       body.notes?.trim() ?? "",
      visibility:  body.visibility === "public" ? "public" : "private",
      aiGenerated: body.aiGenerated ?? false,
      likes:       0,
      tags:        Array.isArray(body.tags) ? body.tags.slice(0, 8) : [],
      createdAt:   now,
      updatedAt:   now,
    };

    const result = await recipes.insertOne(doc);
    res.status(201).json({ ...doc, _id: result.insertedId });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Save failed." });
  }
});

// PUT /recipes/:id — update recipe
app.put("/recipes/:id", auth, async (req, res): Promise<void> => {
  try {
    const doc = await recipes.findOne({ _id: new ObjectId(req.params.id) });
    if (!doc) { res.status(404).json({ error: "Not found." }); return; }
    if (doc.userId.toString() !== req.user!.userId) { res.status(403).json({ error: "Not your recipe." }); return; }

    const allowed = ["name","description","soapType","batchGrams","oils","superfat","naohWeight",
                     "waterAmount","lyePurity","scores","additives","fragrances","fragPct","fragMode","fragWeight","customLiquids","notes","visibility","tags","updatedAt"];
    const updates: any = { updatedAt: new Date() };
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];

    await recipes.updateOne({ _id: doc._id }, { $set: updates });
    res.json({ success: true });
  } catch { res.status(400).json({ error: "Update failed." }); }
});

// DELETE /recipes/:id
app.delete("/recipes/:id", auth, async (req, res): Promise<void> => {
  try {
    const doc = await recipes.findOne({ _id: new ObjectId(req.params.id) });
    if (!doc) { res.status(404).json({ error: "Not found." }); return; }
    if (doc.userId.toString() !== req.user!.userId && req.user!.role !== "admin") {
      res.status(403).json({ error: "Not your recipe." }); return;
    }
    await recipes.deleteOne({ _id: doc._id });
    res.json({ success: true });
  } catch { res.status(400).json({ error: "Delete failed." }); }
});

// POST /recipes/:id/like — toggle like
app.post("/recipes/:id/like", auth, async (req, res): Promise<void> => {
  try {
    const doc = await recipes.findOne({ _id: new ObjectId(req.params.id) });
    if (!doc) { res.status(404).json({ error: "Not found." }); return; }
    await recipes.updateOne({ _id: doc._id }, { $inc: { likes: 1 } });
    res.json({ likes: doc.likes + 1 });
  } catch { res.status(400).json({ error: "Like failed." }); }
});

// ── AI proxy ──────────────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: VITE_ANTHROPIC_API_KEY! });

app.post("/api/messages", auth, async (req, res): Promise<void> => {
  const check = await checkAndIncrementAI(req.user!.userId, req.user!.plan);
  if (!check.allowed) {
    res.status(429).json({ error: check.error, upgradeRequired: true }); return;
  }
  try {
    const { model, max_tokens, system, messages } = req.body;
    const response = await anthropic.messages.create({ model, max_tokens, system, messages });
    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// ── AI analyze (blend deep dive — free, not counted) ─────────────────────────
app.post("/api/analyze", auth, async (req, res): Promise<void> => {
  try {
    const { model, max_tokens, messages } = req.body;
    const response = await anthropic.messages.create({
      model: model ?? "claude-haiku-4-5-20251001",
      max_tokens: max_tokens ?? 300,
      messages,
    });
    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// ── AI usage stats ────────────────────────────────────────────────────────────
app.get("/auth/usage", auth, async (req, res): Promise<void> => {
  const user = await users.findOne({ _id: new ObjectId(req.user!.userId) });
  if (!user) { res.status(404).json({ error: "User not found." }); return; }
  const recipeCount = await recipes.countDocuments({ userId: new ObjectId(req.user!.userId) });
  res.json({
    aiUsageThisMonth: user.aiUsageThisMonth,
    aiLimit:          req.user!.plan === "free" ? FREE_AI_LIMIT : null,
    recipeCount,
    recipeLimit:      req.user!.plan === "free" ? FREE_RECIPE_LIMIT : null,
    resetsAt:         user.usageResetAt,
  });
});

// ── Batch routes ──────────────────────────────────────────────────────────────
interface BatchDoc {
  _id?: ObjectId;
  userId: ObjectId;
  recipeId?: ObjectId;
  recipeName: string;
  batchNumber: string;
  date: string;
  batchSizeGrams: number;
  barsCount: number;
  gramsPerBar: number;
  status: "making"|"curing"|"ready"|"sold_out"|"failed";
  notes: string;
  rating: number;
  oilCosts: { name:string; grams:number; pricePerKg:number }[];
  laborCostPerHour: number;
  laborHours: number;
  overheadPct: number;
  marginPct: number;
  aiAnalysis?: string;
  aiSuggestions?: string;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

let batches: Collection<BatchDoc>;

// Add to connectDB — will be called after existing collections
const initBatches = async () => {
  batches = db.collection<BatchDoc>("batches");
  await batches.createIndex({ userId: 1, createdAt: -1 });
};

// GET /batches — user's own batches
app.get("/batches", auth, async (req, res): Promise<void> => {
  if (!batches) { res.json([]); return; }
  const docs = await batches.find({ userId: new ObjectId(req.user!.userId) }).sort({ date: -1 }).toArray();
  res.json(docs);
});

// POST /batches — create batch
app.post("/batches", auth, async (req, res): Promise<void> => {
  if (!batches) { res.status(500).json({ error: "DB not ready" }); return; }
  try {
    const now  = new Date();
    const body = req.body;
    const doc: BatchDoc = {
      userId:           new ObjectId(req.user!.userId),
      recipeId:         body.recipeId ? new ObjectId(body.recipeId) : undefined,
      recipeName:       body.recipeName    ?? "Unnamed Recipe",
      batchNumber:      body.batchNumber   ?? `B-${Date.now().toString().slice(-6)}`,
      date:             body.date          ?? now.toISOString().split("T")[0],
      batchSizeGrams:   body.batchSizeGrams ?? 0,
      barsCount:        body.barsCount      ?? 0,
      gramsPerBar:      body.gramsPerBar    ?? 0,
      status:           body.status         ?? "making",
      notes:            body.notes          ?? "",
      rating:           body.rating         ?? 0,
      oilCosts:         body.oilCosts       ?? [],
      laborCostPerHour: body.laborCostPerHour ?? 150,
      laborHours:       body.laborHours      ?? 0,
      overheadPct:      body.overheadPct     ?? 20,
      marginPct:        body.marginPct       ?? 40,
      currency:         body.currency        ?? "PHP",
      createdAt:        now,
      updatedAt:        now,
    };
    const result = await batches.insertOne(doc);
    res.status(201).json({ ...doc, _id: result.insertedId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /batches/:id — update batch
app.put("/batches/:id", auth, async (req, res): Promise<void> => {
  if (!batches) { res.status(500).json({ error: "DB not ready" }); return; }
  try {
    const doc = await batches.findOne({ _id: new ObjectId(req.params.id) });
    if (!doc) { res.status(404).json({ error: "Not found." }); return; }
    if (doc.userId.toString() !== req.user!.userId) { res.status(403).json({ error: "Not your batch." }); return; }
    const allowed = ["recipeName","batchNumber","date","batchSizeGrams","barsCount","gramsPerBar",
                     "status","notes","rating","oilCosts","laborCostPerHour","laborHours",
                     "overheadPct","marginPct","currency","aiAnalysis","aiSuggestions"];
    const updates: any = { updatedAt: new Date() };
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
    await batches.updateOne({ _id: doc._id }, { $set: updates });
    res.json({ success: true });
  } catch { res.status(400).json({ error: "Update failed." }); }
});

// DELETE /batches/:id
app.delete("/batches/:id", auth, async (req, res): Promise<void> => {
  if (!batches) { res.status(500).json({ error: "DB not ready" }); return; }
  try {
    const doc = await batches.findOne({ _id: new ObjectId(req.params.id) });
    if (!doc) { res.status(404).json({ error: "Not found." }); return; }
    if (doc.userId.toString() !== req.user!.userId) { res.status(403).json({ error: "Not your batch." }); return; }
    await batches.deleteOne({ _id: doc._id });
    res.json({ success: true });
  } catch { res.status(400).json({ error: "Delete failed." }); }
});

// ── Start ─────────────────────────────────────────────────────────────────────
connectDB().then(async () => {
  await initBatches();
  app.listen(parseInt(PORT), () => {
    console.log(`🚀 SoapCalcAI server → http://localhost:${PORT}`);
    console.log(`   Free tier: ${FREE_AI_LIMIT} AI/month · ${FREE_RECIPE_LIMIT} recipes max`);
  });
}).catch(err => { console.error("❌ DB connect failed:", err.message); process.exit(1); });

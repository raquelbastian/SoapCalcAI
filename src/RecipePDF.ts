import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface RecipePDFData {
  name: string;
  description?: string;
  authorName: string;
  soapType: "solid" | "liquid";
  batchGrams: number;
  batchUnit?: "g" | "kg" | "lb" | "oz";
  oils: { name: string; pct: number; grams: number }[];
  superfat: number;
  naohWeight: number;
  waterAmount: number;
  lyePurity: number;
  dilutionRatio?: number;
  scores: {
    bubblyLather: number; creamyLather: number; cleansing: number;
    condition: number; hardness: number; longevity: number; iodine: number; ins: number;
  };
  fa: {
    lauric: number; myristic: number; palmitic: number; stearic: number;
    ricinoleic: number; oleic: number; linoleic: number; linolenic: number;
  };
  additives: { name: string; amount: number; unit: string; addAt: string }[];
  fragrances?: { name: string; amount: number }[];
  fragWeight?: number;
  customLiquids?: { name: string; pct: number }[];
  notes?: string;
  aiGenerated: boolean;
  tags?: string[];
}

// ── Brand palette — warm gold + clean neutrals ──────────────────────────────
const GOLD: [number, number, number]     = [156, 116, 42];
const GOLD_LIGHT: [number, number, number] = [245, 238, 220];
const DARK: [number, number, number]     = [35, 32, 28];
const BODY: [number, number, number]     = [55, 52, 48];
const MUTED: [number, number, number]    = [130, 125, 118];
const LINE: [number, number, number]     = [215, 210, 205];
const BG: [number, number, number]       = [250, 248, 245];
const WHITE: [number, number, number]    = [255, 255, 255];
const GREEN: [number, number, number]    = [60, 140, 65];
const RED: [number, number, number]      = [190, 70, 40];

const rv = (n: number, d = 2) => parseFloat(n.toFixed(d));

const UNIT_CONVERT: Record<string, { factor: number; label: string; dec: number }> = {
  g:  { factor: 1,            label: "g",  dec: 1 },
  kg: { factor: 1 / 1000,     label: "kg", dec: 3 },
  lb: { factor: 1 / 453.592,  label: "lb", dec: 3 },
  oz: { factor: 1 / 28.3495,  label: "oz", dec: 2 },
};
function fmtU(grams: number, unit: string): string {
  const u = UNIT_CONVERT[unit] ?? UNIT_CONVERT.g;
  return `${(grams * u.factor).toFixed(u.dec)} ${u.label}`;
}


export async function generateRecipePDF(data: RecipePDFData): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const W   = doc.internal.pageSize.getWidth();
  const H   = doc.internal.pageSize.getHeight();
  const M   = 16;
  const CW  = W - M * 2;
  let y     = 0;

  const unit     = data.batchUnit ?? "g";
  const showAlt  = unit !== "g";
  const lye      = data.soapType === "liquid" ? "KOH" : "NaOH";
  const lyeConc  = data.naohWeight / (data.naohWeight + data.waterAmount) * 100;
  const lyeRatio = data.waterAmount / data.naohWeight;
  const fragWt   = data.fragWeight ?? 0;
  const total    = data.batchGrams + data.naohWeight + data.waterAmount + fragWt;
  const sat      = data.fa.lauric + data.fa.myristic + data.fa.palmitic + data.fa.stearic;
  const unsat    = data.fa.oleic + data.fa.linoleic + data.fa.linolenic + data.fa.ricinoleic;

  const getY = () => (doc as any).lastAutoTable?.finalY ?? y;
  const checkSpace = (n: number) => { if (y + n > H - 14) { doc.addPage(); y = 16; } };

  // ── Helpers ────────────────────────────────────────────────────────────
  const goldBar = (yy: number, h: number) => {
    doc.setFillColor(...GOLD);
    doc.rect(M, yy, 2.5, h, "F");
  };

  const label = (text: string, x: number, yy: number) => {
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.text(text.toUpperCase(), x, yy);
  };

  const value = (text: string, x: number, yy: number, align: "left" | "right" = "left") => {
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "bold");
    doc.text(text, x, yy, { align });
  };

  const thinLine = (x1: number, yy: number, x2: number) => {
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(x1, yy, x2, yy);
  };

  // ════════════════════════════════════════════════════════════════════════
  // HEADER — bold brand stripe
  // ════════════════════════════════════════════════════════════════════════
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, W, 3, "F");

  y = 14;
  doc.setFontSize(22);
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.text(data.name, M, y);

  doc.setFontSize(9);
  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.text("SoapCalcAI", W - M, 10, { align: "right" });

  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "normal");
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const meta = [
    `by ${data.authorName}`,
    dateStr,
    data.soapType === "liquid" ? "Liquid Soap (KOH)" : "Solid Bar (NaOH)",
    ...(data.aiGenerated ? ["AI Generated"] : []),
  ].join("  ·  ");
  doc.text(meta, M, y);

  // Notes
  const notesText = data.notes?.trim() || data.description?.trim();
  if (notesText) {
    y += 5;
    doc.setFillColor(...BG);
    const lines = doc.splitTextToSize(notesText, CW - 10);
    const nh = lines.length * 4 + 6;
    doc.roundedRect(M, y, CW, nh, 2, 2, "F");
    doc.setFontSize(8);
    doc.setTextColor(...BODY);
    doc.text(lines, M + 5, y + 5);
    y += nh + 2;
  }

  y += 6;
  thinLine(M, y, W - M);
  y += 6;

  // ════════════════════════════════════════════════════════════════════════
  // KEY NUMBERS — 4 metric cards in a row
  // ════════════════════════════════════════════════════════════════════════
  const cardW = (CW - 9) / 4;
  const cards = [
    { lbl: "Oil Weight",   val: fmtU(data.batchGrams, unit) },
    { lbl: `${lye} Weight`, val: `${rv(data.naohWeight, 2)} g` },
    { lbl: "Liquid",       val: `${rv(data.waterAmount, 1)} g` },
    { lbl: "Total Batch",  val: fmtU(total, unit) },
  ];

  cards.forEach((c, i) => {
    const cx = M + i * (cardW + 3);
    doc.setFillColor(...BG);
    doc.roundedRect(cx, y, cardW, 16, 2, 2, "F");
    label(c.lbl, cx + 4, y + 6);
    value(c.val, cx + 4, y + 13);
  });
  y += 20;

  // Second row — smaller details
  const detailY = y;
  const details = [
    [`Super Fat: ${data.superfat}%`, `Lye Purity: ${data.lyePurity}%`, `Lye Conc: ${rv(lyeConc, 0)}%`, `Ratio: ${rv(lyeRatio, 2)}:1`],
    [`Sat:Unsat ${Math.round(sat)}:${Math.round(unsat)}`, `INS ${Math.round(data.scores.ins)}`, `Iodine ${Math.round(data.scores.iodine)}`, ...(fragWt > 0 ? [`Fragrance ${rv(fragWt, 1)}g`] : [])],
  ];
  doc.setFontSize(8);
  doc.setTextColor(...BODY);
  doc.setFont("helvetica", "normal");
  details.forEach((row, ri) => {
    doc.text(row.join("    ·    "), M, detailY + ri * 5 + 3);
  });
  y = detailY + details.length * 5 + 5;

  thinLine(M, y, W - M);
  y += 6;

  // ════════════════════════════════════════════════════════════════════════
  // OIL BLEND — with gold accent bar
  // ════════════════════════════════════════════════════════════════════════
  checkSpace(30);
  goldBar(y, 6);
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.text("Oil Blend", M + 6, y + 4.5);
  y += 9;

  const oilHead = showAlt ? ["Oil", "%", unit.toUpperCase(), "Grams"] : ["Oil", "%", "Grams"];
  const oilBody = data.oils.map(o => showAlt
    ? [o.name, `${rv(o.pct, 1)}`, fmtU(o.grams, unit).split(" ")[0], `${rv(o.grams, 0)}`]
    : [o.name, `${rv(o.pct, 1)}`, `${rv(o.grams, 0)}`]
  );
  const oilFoot = showAlt
    ? ["Total", "100", fmtU(data.batchGrams, unit).split(" ")[0], `${rv(data.batchGrams, 0)}`]
    : ["Total", "100", `${rv(data.batchGrams, 0)}`];

  autoTable(doc, {
    startY: y, margin: { left: M, right: M },
    head: [oilHead], body: oilBody, foot: [oilFoot],
    styles: { fontSize: 8.5, cellPadding: 2.8, textColor: BODY as any, lineColor: LINE as any, lineWidth: 0.2 },
    headStyles: { fillColor: GOLD_LIGHT as any, textColor: GOLD as any, fontStyle: "bold", fontSize: 8 },
    footStyles: { fillColor: GOLD_LIGHT as any, textColor: DARK as any, fontStyle: "bold" },
    bodyStyles: { fillColor: WHITE as any },
    alternateRowStyles: { fillColor: BG as any },
    columnStyles: showAlt ? {
      0: { cellWidth: 55 }, 1: { halign: "right", cellWidth: 18 },
      2: { halign: "right" }, 3: { halign: "right", fontStyle: "bold" },
    } : {
      0: { cellWidth: 80 }, 1: { halign: "right", cellWidth: 22 },
      2: { halign: "right", fontStyle: "bold" },
    },
  });
  y = getY() + 5;

  // ════════════════════════════════════════════════════════════════════════
  // ADDITIVES + FRAGRANCES + LIQUIDS — stacked compact sections
  // ════════════════════════════════════════════════════════════════════════
  const miniSection = (title: string, rows: string[][]) => {
    checkSpace(15);
    goldBar(y, 5);
    doc.setFontSize(8.5);
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "bold");
    doc.text(title, M + 6, y + 3.8);
    y += 7;
    autoTable(doc, {
      startY: y, margin: { left: M, right: M }, head: [], body: rows,
      styles: { fontSize: 8, cellPadding: 2.2, textColor: BODY as any, lineColor: LINE as any, lineWidth: 0.15 },
      bodyStyles: { fillColor: WHITE as any },
      alternateRowStyles: { fillColor: BG as any },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    });
    y = getY() + 4;
  };

  if (data.additives.length > 0) {
    miniSection("Additives", data.additives.map(a => [
      a.name,
      `${a.amount} ${a.unit === "pct_oil" ? "% oils" : a.unit}`,
      a.addAt === "liquid" ? "w/ Liquid" : a.addAt === "fats" ? "w/ Fats" : "At Trace",
    ]));
  }

  if ((data.fragrances && data.fragrances.length > 0) || fragWt > 0) {
    const fRows: string[][] = [];
    if (data.fragrances && data.fragrances.length > 0) {
      data.fragrances.forEach(f => fRows.push([f.name || "Fragrance", `${rv(f.amount, 1)} g`]));
    } else {
      fRows.push(["Fragrance blend", `${rv(fragWt, 1)} g`]);
    }
    miniSection("Fragrances", fRows);
  }

  const hasLiquids = data.customLiquids && data.customLiquids.length > 0 &&
    !(data.customLiquids.length === 1 && data.customLiquids[0].name === "Distilled Water" && data.customLiquids[0].pct === 100);
  if (hasLiquids) {
    miniSection("Custom Liquids", data.customLiquids!.map(l => [
      l.name, `${rv(l.pct, 0)}%`, `${rv(data.waterAmount * l.pct / 100, 1)} g`,
    ]));
  }

  // ════════════════════════════════════════════════════════════════════════
  // SOAP QUALITY — visual score dots
  // ════════════════════════════════════════════════════════════════════════
  checkSpace(55);
  thinLine(M, y, W - M);
  y += 6;
  goldBar(y, 6);
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.text("Soap Quality Profile", M + 6, y + 4.5);
  y += 10;

  const scores: [string, number, [number, number]][] = [
    ["Hardness",      data.scores.hardness,      [29, 54]],
    ["Cleansing",     data.scores.cleansing,      [12, 22]],
    ["Conditioning",  data.scores.condition,      [44, 69]],
    ["Bubbly Lather", data.scores.bubblyLather,   [14, 46]],
    ["Creamy Lather", data.scores.creamyLather,   [16, 48]],
    ["Longevity",     data.scores.longevity,      [25, 50]],
    ["Iodine",        data.scores.iodine,         [41, 70]],
    ["INS",           data.scores.ins,            [136, 165]],
  ];

  const halfW = (CW - 8) / 2;
  scores.forEach(([name, val, [lo, hi]], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const sx  = M + col * (halfW + 8);
    const sy  = y + row * 8;

    const inRange = val >= lo && val <= hi;
    const dotColor = inRange ? GREEN : RED;

    // Dot
    doc.setFillColor(...dotColor);
    doc.circle(sx + 2, sy + 1.5, 1.2, "F");

    // Label
    doc.setFontSize(8);
    doc.setTextColor(...BODY);
    doc.setFont("helvetica", "normal");
    doc.text(name, sx + 6, sy + 2.5);

    // Value
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...dotColor);
    doc.text(`${Math.round(val)}`, sx + halfW * 0.6, sy + 2.5);

    // Range
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.setFontSize(7.5);
    doc.text(`${lo}–${hi}`, sx + halfW * 0.75, sy + 2.5);
  });
  y += Math.ceil(scores.length / 2) * 8 + 4;

  // Fatty acids — compact inline
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "normal");
  const faLine = [
    `Lauric ${Math.round(data.fa.lauric)}`,
    `Myristic ${Math.round(data.fa.myristic)}`,
    `Palmitic ${Math.round(data.fa.palmitic)}`,
    `Stearic ${Math.round(data.fa.stearic)}`,
    `Ricinoleic ${Math.round(data.fa.ricinoleic)}`,
    `Oleic ${Math.round(data.fa.oleic)}`,
    `Linoleic ${Math.round(data.fa.linoleic)}`,
    `Linolenic ${Math.round(data.fa.linolenic)}`,
  ].join("  ·  ");
  doc.text(`Fatty Acids %:  ${faLine}`, M, y + 2);
  y += 6;

  thinLine(M, y, W - M);
  y += 6;

  // ════════════════════════════════════════════════════════════════════════
  // QUICK GUIDE — numbered steps
  // ════════════════════════════════════════════════════════════════════════
  checkSpace(50);
  goldBar(y, 6);
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.text("How to Make This Soap", M + 6, y + 4.5);
  y += 10;

  const isLiquid = data.soapType === "liquid";
  const steps = isLiquid ? [
    "Gear up — gloves, goggles, long sleeves. Work in a ventilated area.",
    `Weigh oils: ${data.oils.map(o => `${o.name} ${rv(o.grams, 0)}g`).join(", ")}. Melt solids gently.`,
    `Prepare lye — slowly add ${rv(data.naohWeight, 2)}g KOH to ${rv(data.waterAmount, 1)}g water. Never reverse.`,
    "Combine at 50–60°C. Pour lye into oils. Stick blend to trace.",
    "Cook (hot process) at 65–80°C for 1–2 hours until pH reaches 7–8.",
    `Dilute paste in hot water at 1:${data.dilutionRatio ?? 2.5} ratio. Stir until clear.`,
    ...(data.additives.length > 0 ? [`Add: ${data.additives.map(a => `${a.name} (${a.amount}${a.unit === "pct_oil" ? "%" : a.unit})`).join(", ")}.`] : []),
    "Bottle and let clarify 24–48 hours before use.",
  ] : [
    "Gear up — gloves, goggles, long sleeves. Ventilated area, no distractions.",
    `Weigh oils: ${data.oils.map(o => `${o.name} ${rv(o.grams, 0)}g`).join(", ")}. Melt solids first.`,
    `Prepare lye — slowly add ${rv(data.naohWeight, 2)}g NaOH to ${rv(data.waterAmount, 1)}g cool water. Never reverse.`,
    "When both are 40–50°C (within 10°C of each other), pour lye into oils.",
    "Stick blend in short bursts until light trace — batter thickens like thin pudding.",
    ...(data.additives.filter(a => a.addAt === "trace").length > 0
      ? [`At trace, add: ${data.additives.filter(a => a.addAt === "trace").map(a => `${a.name}`).join(", ")}.`] : []),
    "Pour into mold. Tap to release air bubbles. Cover and insulate 24–48h.",
    "Unmold after 24–48h. Cure 4–6 weeks in a ventilated area. Longer cure = harder, milder bar.",
  ];

  steps.forEach((step, i) => {
    checkSpace(12);
    // Number circle
    doc.setFillColor(...GOLD);
    doc.circle(M + 3, y + 1.5, 2.5, "F");
    doc.setFontSize(7);
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.text(`${i + 1}`, M + 3, y + 2.5, { align: "center" });

    // Step text
    doc.setFontSize(8);
    doc.setTextColor(...BODY);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(step, CW - 14);
    doc.text(lines, M + 9, y + 2);
    y += Math.max(lines.length * 4, 5) + 2.5;
  });

  y += 3;

  // ════════════════════════════════════════════════════════════════════════
  // SAFETY STRIP
  // ════════════════════════════════════════════════════════════════════════
  checkSpace(14);
  doc.setFillColor(255, 245, 225);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.roundedRect(M, y, CW, 10, 2, 2, "FD");
  doc.setFontSize(7.5);
  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.text("SAFETY", M + 4, y + 6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(140, 105, 35);
  doc.text("Always add lye TO water. Wear gloves & goggles. Keep children and pets away. Cure CP soap 4–6 weeks.", M + 22, y + 6.5);

  // ════════════════════════════════════════════════════════════════════════
  // FOOTER — all pages
  // ════════════════════════════════════════════════════════════════════════
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    // Bottom gold line
    doc.setFillColor(...GOLD);
    doc.rect(0, H - 3, W, 3, "F");
    // Footer text
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.text("Generated by SoapCalcAI  ·  Handle lye with care", M, H - 6);
    doc.text(`${p}/${pages}`, W - M, H - 6, { align: "right" });
  }

  const filename = `${data.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_recipe.pdf`;
  doc.save(filename);
}

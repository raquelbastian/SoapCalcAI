import { useState, FC } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Feature {
  icon: string;
  label: string;
  free: "check" | "cross" | string;
  premium: "check" | "cross" | string;
}

interface FAQItem {
  question: string;
  answer: string;
}

// ── Data ──────────────────────────────────────────────────────────────────────
const FEATURES: Feature[] = [
  { icon: "🔧", label: "Recipe builder",        free: "check",      premium: "check"     },
  { icon: "🗄️", label: "Recipe database",        free: "check",      premium: "check"     },
  { icon: "📦", label: "Batch management",       free: "check",      premium: "check"     },
  { icon: "🏪", label: "Inventory management",   free: "check",      premium: "check"     },
  { icon: "📄", label: "Recipes limit",          free: "2 recipes",  premium: "Unlimited" },
  { icon: "🗂️", label: "Batches limit",          free: "1 batch",    premium: "Unlimited" },
  { icon: "✨", label: "AI recipe generator",    free: "5 / month",  premium: "Unlimited" },
  { icon: "📊", label: "Cost analysis",          free: "cross",      premium: "check"     },
  { icon: "🚫", label: "Advertisement free",     free: "cross",      premium: "check"     },
  { icon: "🎧", label: "Priority support",       free: "cross",      premium: "check"     },
];

const FAQS: FAQItem[] = [
  {
    question: "Can I cancel anytime?",
    answer: "Yes — cancel at any time from your account settings. You keep Premium access until the end of your billing period. No questions asked.",
  },
  {
    question: "What happens to my recipes if I downgrade?",
    answer: "Your recipes are never deleted. On the Free plan you can view all existing recipes but can only actively edit 2. Upgrade any time to regain full access.",
  },
  {
    question: "Is there a free trial for Premium?",
    answer: "Yes — new users get a 14-day Premium trial, no credit card required. Switch to Free at any time before the trial ends.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit cards (Visa, Mastercard, Amex) and PayPal via Stripe. All payments are encrypted and secure.",
  },
  {
    question: "Is my data safe?",
    answer: "Absolutely. All recipes and batch data are stored encrypted and are never shared with third parties. You own your data.",
  },
];

// ── Icons ─────────────────────────────────────────────────────────────────────
const FlameIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" style={{ color: "#C49A3C" }}>
    <path d="M12 2C12 2 9 7 9 11C9 13.2 10.3 15 12 15C13.7 15 15 13.2 15 11C15 9 14 7 13 6C13 6 16 8 16 13C16 17.4 14.2 20 12 20C9.8 20 8 17.4 8 13C8 8.5 10 5 12 2Z" fill="currentColor" opacity="0.3"/>
    <path d="M12 22C9.2 22 7 19.5 7 16.5C7 13 9 11 10 9C10 11 11 12.5 12 12.5C13 12.5 14 11 14 9C15 11 17 13 17 16.5C17 19.5 14.8 22 12 22Z" fill="currentColor"/>
  </svg>
);

const CheckIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
    <circle cx="12" cy="12" r="10" fill="#4CAF50" opacity="0.15"/>
    <path d="M8 12.5l3 3 5-5.5" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CrossIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
    <circle cx="12" cy="12" r="10" fill="#6B6560" opacity="0.1"/>
    <path d="M15 9l-6 6M9 9l6 6" stroke="#4A4540" strokeWidth="1.5" strokeLinecap="round"/>
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

const SparkleIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
    <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" fill="currentColor"/>
  </svg>
);

// ── Feature cell ──────────────────────────────────────────────────────────────
const FeatureCell: FC<{ value: string; isPremium?: boolean }> = ({ value, isPremium = false }) => {
  if (value === "check") return (
    <div className="flex justify-center"><CheckIcon /></div>
  );
  if (value === "cross") return (
    <div className="flex justify-center"><CrossIcon /></div>
  );
  if (value === "Unlimited") return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ background: isPremium ? "#1C2A18" : "#1C1A17", color: isPremium ? "#60B060" : "#9A9490", border: `1px solid ${isPremium ? "#2A4A22" : "#2C2820"}` }}>
      <SparkleIcon /> Unlimited
    </span>
  );
  return (
    <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full"
      style={{ background: "#1C1A17", color: "#6B6560", border: "1px solid #2C2820" }}>
      {value}
    </span>
  );
};

// ── FAQ item ──────────────────────────────────────────────────────────────────
const FAQItem: FC<FAQItem> = ({ question, answer }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="transition-all" style={{ borderBottom: "1px solid #2C2820" }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between py-4 text-left"
        style={{ background: "transparent", border: "none", cursor: "pointer" }}
      >
        <span className="text-sm font-medium pr-4" style={{ color: "#F5F0E8" }}>{question}</span>
        <span className="shrink-0" style={{ color: "#6B6560" }}>
          {open ? <ChevronUpIcon /> : <ChevronDownIcon />}
        </span>
      </button>
      {open && (
        <p className="pb-4 text-sm leading-relaxed" style={{ color: "#6B6560" }}>
          {answer}
        </p>
      )}
    </div>
  );
};

// ── Main PricingPage ──────────────────────────────────────────────────────────
interface PricingPageProps {
  onSelectFree?: () => void;
  onSelectPremium?: () => void;
  onBack?: () => void;
}

export default function PricingPage({ onSelectFree, onSelectPremium, onBack }: PricingPageProps): JSX.Element {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  const monthlyPrice = 5.99;
  const yearlyPrice  = parseFloat((monthlyPrice * 12 * 0.8).toFixed(2)); // 20% off
  const displayPrice = billing === "yearly" ? (yearlyPrice / 12).toFixed(2) : monthlyPrice.toFixed(2);

  return (
    <div
      className="min-h-screen p-4 md:p-8"
      style={{
        background: "linear-gradient(135deg, #0A0908 0%, #0F0D0B 50%, #0A0908 100%)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.4s ease forwards; }
      `}</style>

      <div className="max-w-3xl mx-auto">

        {/* Back button */}
        {onBack && (
          <button onClick={onBack}
            className="flex items-center gap-2 text-sm mb-6 transition-all"
            style={{ color: "#6B6560", background: "transparent", border: "none", cursor: "pointer" }}>
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4"><path d="M19 12H5M5 12l7 7M5 12l7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Back to calculator
          </button>
        )}

        {/* Header */}
        <div className="text-center mb-10 fade-in">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="h-px flex-1 max-w-12" style={{ background: "linear-gradient(to right, transparent, #C49A3C)" }} />
            <FlameIcon />
            <div className="h-px flex-1 max-w-12" style={{ background: "linear-gradient(to left, transparent, #C49A3C)" }} />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2"
            style={{ fontFamily: "Playfair Display, serif", color: "#F5F0E8", letterSpacing: "0.04em" }}>
            Simple, honest pricing
          </h1>
          <p className="text-sm" style={{ color: "#6B6560", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Start free · Upgrade when your craft grows
          </p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <div className="flex rounded-xl p-1" style={{ background: "#141210", border: "1px solid #2C2820" }}>
              <button
                onClick={() => setBilling("monthly")}
                className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{ background: billing === "monthly" ? "#C49A3C" : "transparent", color: billing === "monthly" ? "#0A0908" : "#6B6560" }}>
                Monthly
              </button>
              <button
                onClick={() => setBilling("yearly")}
                className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                style={{ background: billing === "yearly" ? "#C49A3C" : "transparent", color: billing === "yearly" ? "#0A0908" : "#6B6560" }}>
                Yearly
                <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: billing === "yearly" ? "#0A0908" : "#1C2A18", color: billing === "yearly" ? "#C49A3C" : "#60B060", fontSize: "10px" }}>
                  −20%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-2 gap-4 mb-8 fade-in">

          {/* Free */}
          <div className="rounded-2xl p-6" style={{ background: "#141210", border: "1px solid #2C2820" }}>
            <div className="mb-5">
              <p className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: "#6B6560" }}>Free</p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold" style={{ fontFamily: "Playfair Display, serif", color: "#F5F0E8" }}>$0</span>
                <span className="text-sm" style={{ color: "#6B6560" }}>/ month</span>
              </div>
              <p className="text-xs mt-2" style={{ color: "#4A4540" }}>Perfect for hobbyists getting started.</p>
            </div>
            <button
              onClick={onSelectFree}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "#1C1A17", border: "1px solid #3C3830", color: "#9A9490" }}>
              Get started free
            </button>
          </div>

          {/* Premium */}
          <div className="rounded-2xl p-6 relative overflow-hidden"
            style={{ background: "linear-gradient(145deg, #1C1A17, #171410)", border: "2px solid #C49A3C" }}>
            {/* Glow overlay */}
            <div className="absolute inset-0 opacity-5 pointer-events-none"
              style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 20px, #C49A3C 21px)" }} />

            <div className="relative">
              {/* Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-4"
                style={{ background: "#2A1F08", border: "1px solid #C49A3C", color: "#C49A3C" }}>
                <SparkleIcon /> Most Popular
              </div>
              <p className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: "#C49A3C" }}>Premium</p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold" style={{ fontFamily: "Playfair Display, serif", color: "#F5F0E8" }}>
                  ${displayPrice}
                </span>
                <span className="text-sm" style={{ color: "#6B6560" }}>/ month</span>
              </div>
              {billing === "yearly" && (
                <p className="text-xs mt-1" style={{ color: "#60B060" }}>
                  Billed ${yearlyPrice}/year · Save ${(monthlyPrice * 12 - yearlyPrice).toFixed(2)}
                </p>
              )}
              <p className="text-xs mt-2" style={{ color: "#4A4540" }}>For serious soapmakers and small businesses.</p>

              <button
                onClick={onSelectPremium}
                className="w-full py-2.5 rounded-xl text-sm font-bold mt-5 transition-all"
                style={{ background: "linear-gradient(135deg, #C49A3C, #8B6A2A)", color: "#0A0908" }}>
                Upgrade to Premium ✦
              </button>
              <p className="text-center text-xs mt-2" style={{ color: "#4A4540" }}>14-day free trial · No credit card required</p>
            </div>
          </div>
        </div>

        {/* Feature comparison table */}
        <div className="rounded-2xl overflow-hidden mb-8 fade-in" style={{ border: "1px solid #2C2820" }}>
          {/* Table header */}
          <div className="grid grid-cols-3 px-5 py-3" style={{ background: "#1C1A17", borderBottom: "1px solid #2C2820" }}>
            <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#4A4540" }}>Feature</span>
            <span className="text-xs uppercase tracking-widest font-semibold text-center" style={{ color: "#6B6560" }}>Free</span>
            <span className="text-xs uppercase tracking-widest font-semibold text-center" style={{ color: "#C49A3C" }}>Premium</span>
          </div>

          {FEATURES.map((f, i) => (
            <div
              key={f.label}
              className="grid grid-cols-3 items-center px-5 py-3.5 transition-all"
              style={{
                background: i % 2 === 0 ? "#141210" : "#111008",
                borderBottom: i < FEATURES.length - 1 ? "1px solid #1C1A17" : "none",
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{f.icon}</span>
                <span className="text-sm" style={{ color: "#9A9490" }}>{f.label}</span>
              </div>
              <div className="flex justify-center">
                <FeatureCell value={f.free} />
              </div>
              <div className="flex justify-center">
                <FeatureCell value={f.premium} isPremium />
              </div>
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div className="grid grid-cols-3 gap-3 mb-10 fade-in">
          {[
            { icon: "🔒", title: "Secure payments", desc: "Encrypted via Stripe" },
            { icon: "🔄", title: "Cancel anytime",  desc: "No lock-in contracts" },
            { icon: "💾", title: "Your data",        desc: "Always exportable" },
          ].map(b => (
            <div key={b.title} className="text-center p-4 rounded-xl" style={{ background: "#141210", border: "1px solid #2C2820" }}>
              <div className="text-2xl mb-2">{b.icon}</div>
              <p className="text-xs font-semibold mb-1" style={{ color: "#F5F0E8" }}>{b.title}</p>
              <p className="text-xs" style={{ color: "#4A4540" }}>{b.desc}</p>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="rounded-2xl p-6 mb-8 fade-in" style={{ background: "#141210", border: "1px solid #2C2820" }}>
          <h2 className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: "#C49A3C" }}>
            Frequently asked questions
          </h2>
          <div>
            {FAQS.map(faq => (
              <FAQItem key={faq.question} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center rounded-2xl p-8 fade-in relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #1C1A17, #141210)", border: "1px solid #3C3428" }}>
          <div className="absolute inset-0 opacity-5 pointer-events-none"
            style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 24px, #C49A3C 25px)" }} />
          <div className="relative">
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "#C49A3C" }}>Ready to craft?</p>
            <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "Playfair Display, serif", color: "#F5F0E8" }}>
              Start your 14-day free trial
            </h2>
            <p className="text-sm mb-6" style={{ color: "#6B6560" }}>
              No credit card required. Upgrade, downgrade, or cancel at any time.
            </p>
            <button
              onClick={onSelectPremium}
              className="px-8 py-3 rounded-xl text-sm font-bold transition-all"
              style={{ background: "linear-gradient(135deg, #C49A3C, #8B6A2A)", color: "#0A0908" }}>
              Try Premium free for 14 days ✦
            </button>
          </div>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "#2C2820" }}>
          SoapCalcAI · Prices in USD · All plans include core calculator features
        </p>
      </div>
    </div>
  );
}

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Crown, X } from 'lucide-react';
import { isSupabaseConfigured, supabase } from './lib/supabase';

const navLinks = ['Course', 'About', 'Results', 'FAQ'];

const modules = [
  'Market structure and liquidity mapping',
  'High-probability forex entry models',
  'Risk management, journaling, and psychology',
  'Live London and New York session breakdowns',
];

const testimonials = [
  {
    quote:
      'The course finally made price action feel structured. My biggest win was learning when not to trade.',
    name: 'Arjun M.',
    role: 'Funded account trader',
  },
  {
    quote:
      'The live breakdowns helped me stop chasing signals and start building a repeatable execution plan.',
    name: 'Priya S.',
    role: 'Forex swing trader',
  },
  {
    quote:
      'Clear lessons, practical homework, and honest feedback. It feels built for serious beginners.',
    name: 'Daniel R.',
    role: 'Part-time trader',
  },
];

const faqs = [
  ['Is this course beginner friendly?', 'Yes. It starts with foundations, then moves into execution, risk, and live market application.'],
  ['Do I need a large trading account?', 'No. The training focuses on process and risk control before account size or returns.'],
  ['How do I access the course?', 'After your purchase request is submitted, the team can verify payment and send access details.'],
];

type FormState = {
  name: string;
  email: string;
  phone: string;
  plan: string;
};

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    phone: '',
    plan: 'Complete Forex Mastery',
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  useEffect(() => {
    const handleScroll = () => setHasScrolled(window.scrollY > 24);

    handleScroll();
    window.addEventListener('scroll', handleScroll);

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const statusMessage = useMemo(() => {
    if (status === 'success') return 'Request received. We will contact you with payment and course access details.';
    if (status === 'error') return 'Could not submit right now. Check Supabase env values or try again.';
    if (!isSupabaseConfigured) return 'Supabase is not configured yet. Add Vercel env variables before launch.';
    return '';
  }, [status]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('sending');

    if (!supabase) {
      setStatus('error');
      return;
    }

    const { error } = await supabase.from('course_orders').insert({
      full_name: form.name,
      email: form.email,
      phone: form.phone,
      plan: form.plan,
      source: 'website',
    });

    if (error) {
      setStatus('error');
      return;
    }

    setStatus('success');
    setForm({ name: '', email: '', phone: '', plan: 'Complete Forex Mastery' });
  };

  return (
    <div className="min-h-screen bg-ink text-white">
      <header
        className={`fixed inset-x-0 top-0 z-40 px-6 py-5 transition-all duration-500 sm:px-10 lg:px-16 lg:py-7 ${
          hasScrolled
            ? 'border-b border-white/10 bg-ink/90 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl'
            : 'border-b border-transparent bg-transparent'
        }`}
      >
        <nav className="flex items-center justify-between">
          <a href="#home" className="flex items-center gap-3" aria-label="Trading Boy home">
            <span className="relative block h-9 w-9 border-b-[7px] border-l-[7px] border-electric">
              <span className="absolute -right-1 top-0 h-7 w-[7px] rotate-[-28deg] bg-electric" />
            </span>
            <span className="font-podium text-2xl font-bold uppercase tracking-wider text-white sm:text-3xl">
              Trading Boy
            </span>
          </a>

          <div className="hidden items-center gap-8 md:flex lg:gap-12">
            {navLinks.map((link) => (
              <a
                key={link}
                href={`#${link.toLowerCase()}`}
                className="font-inter text-sm uppercase tracking-widest text-white/80 transition hover:text-white"
              >
                {link}
              </a>
            ))}
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className="group hidden items-center gap-2 border border-white/30 px-6 py-3 font-inter text-xs uppercase tracking-widest text-white transition hover:border-electric hover:bg-white/10 md:flex"
          >
            Enroll Now
            <ArrowUpRight className="h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </button>

          <button
            type="button"
            className="space-y-1.5 md:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <div className="h-0.5 w-6 bg-white" />
            <div className="h-0.5 w-6 bg-white" />
            <div className="ml-auto h-0.5 w-4 bg-white" />
          </button>
        </nav>
      </header>

      <div
        className={`fixed inset-0 z-50 bg-black/95 backdrop-blur-sm transition-all duration-500 md:hidden ${
          menuOpen ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
      >
        <div className="flex items-center justify-between px-6 py-5 sm:px-10">
          <span className="font-podium text-2xl font-bold uppercase tracking-wider text-white sm:text-3xl">
            Trading Boy
          </span>
          <button onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <X className="h-7 w-7 text-white" />
          </button>
        </div>

        <div className="flex h-[calc(100vh-88px)] flex-col items-center justify-center gap-7">
          {navLinks.map((link, i) => (
            <a
              key={link}
              href={`#${link.toLowerCase()}`}
              onClick={() => setMenuOpen(false)}
              className="font-podium text-4xl uppercase text-white transition-all duration-500 sm:text-5xl"
              style={{
                transitionDelay: `${i * 80 + 100}ms`,
                opacity: menuOpen ? 1 : 0,
                transform: menuOpen ? 'translateY(0)' : 'translateY(20px)',
              }}
            >
              {link}
            </a>
          ))}
          <button
            onClick={() => {
              setMenuOpen(false);
              setModalOpen(true);
            }}
            className="border border-white/30 px-7 py-4 font-inter text-xs uppercase tracking-widest text-white transition-all duration-500"
            style={{
              transitionDelay: `${navLinks.length * 80 + 100}ms`,
              opacity: menuOpen ? 1 : 0,
              transform: menuOpen ? 'translateY(0)' : 'translateY(20px)',
            }}
          >
            Enroll Now
          </button>
        </div>
      </div>

      <main>
        <section id="home" className="relative min-h-screen overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=2200&q=85"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/78" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(37,174,244,0.24),transparent_28%),radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.08),transparent_16%),linear-gradient(180deg,rgba(15,17,19,0.78),rgba(0,0,0,0.92))]" />

          <div className="relative z-10 flex min-h-screen items-center justify-center px-6 pb-14 pt-28 text-center sm:px-10 lg:px-16">
            <div className="mx-auto max-w-5xl">
              <div className="mb-6 flex items-center justify-center gap-3 font-inter text-xs uppercase tracking-[0.3em] text-white/70 animate-fade-up sm:text-sm lg:mb-8">
                <Crown className="h-4 w-4 text-electric" />
                Forex Trading Education
              </div>

              <h1 className="font-podium text-[clamp(3rem,8vw,7.8rem)] font-bold uppercase leading-[0.92] tracking-tight text-white animate-fade-up-delay-1">
                A Smarter Way
                <br />
                To Master Forex
              </h1>

              <p className="mx-auto mt-6 max-w-3xl font-inter text-base leading-relaxed text-white/75 animate-fade-up-delay-2 sm:text-xl lg:mt-8">
                Learn forex with a disciplined course built around price action, risk control,
                and live market execution. Built for traders who want structure, not signals.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-4 animate-fade-up-delay-3 sm:gap-6 lg:mt-10">
                <button
                  onClick={() => setModalOpen(true)}
                  className="group bg-electric px-5 py-3 font-inter text-[11px] font-bold uppercase tracking-widest text-black shadow-glow transition hover:bg-skyline sm:px-7 sm:py-4 sm:text-xs"
                >
                  Buy Course
                  <ArrowUpRight className="ml-2 inline h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section id="course" className="bg-ink px-6 py-20 sm:px-10 lg:px-16 lg:py-28">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <div className="mb-4 font-inter text-xs uppercase tracking-[0.3em] text-electric">Complete Program</div>
              <h2 className="font-podium text-5xl uppercase leading-none text-white sm:text-6xl lg:text-7xl">
                Learn the system behind confident execution.
              </h2>
              <p className="mt-6 max-w-xl font-inter text-white/65">
                A focused forex course covering structure, liquidity, confirmations, trade management,
                and psychology so students can build a repeatable process.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {modules.map((module, index) => (
                <div key={module} className="border border-white/10 bg-white/[0.03] p-6">
                  <div className="mb-8 font-inter text-xs uppercase tracking-widest text-electric">
                    Module 0{index + 1}
                  </div>
                  <h3 className="font-inter text-lg font-semibold text-white">{module}</h3>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="bg-black px-6 py-20 sm:px-10 lg:px-16 lg:py-28">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2 lg:items-center">
            <img
              src="https://images.unsplash.com/photo-1642790106117-e829e14a795f?auto=format&fit=crop&w=1600&q=85"
              alt="Trading charts on a workstation"
              className="h-[420px] w-full object-cover"
            />
            <div>
              <div className="mb-4 font-inter text-xs uppercase tracking-[0.3em] text-electric">About Us</div>
              <h2 className="font-podium text-5xl uppercase leading-none text-white sm:text-6xl">
                Practical trading education for serious learners.
              </h2>
              <p className="mt-6 font-inter leading-relaxed text-white/65">
                Trading Boy Academy is built around clean market logic, disciplined risk, and live
                mentorship. We teach students how to read forex markets with patience and execute
                with a written plan.
              </p>
              <button
                onClick={() => setModalOpen(true)}
                className="group mt-8 border border-electric px-6 py-4 font-inter text-xs font-bold uppercase tracking-widest text-white transition hover:bg-electric hover:text-black"
              >
                Join The Course
                <ArrowUpRight className="ml-2 inline h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </section>

        <section id="results" className="bg-ink px-6 py-20 sm:px-10 lg:px-16 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <div className="mb-4 font-inter text-xs uppercase tracking-[0.3em] text-electric">Testimonials</div>
                <h2 className="font-podium text-5xl uppercase leading-none text-white sm:text-6xl">
                  Student feedback.
                </h2>
              </div>
              <p className="max-w-md font-inter text-sm text-white/60">
                Results vary by student. The course focuses on process, discipline, and risk-first decision making.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {testimonials.map((item) => (
                <article key={item.name} className="border border-white/10 bg-white/[0.03] p-6">
                  <p className="font-inter leading-relaxed text-white/75">"{item.quote}"</p>
                  <div className="mt-8 font-inter text-sm font-semibold text-white">{item.name}</div>
                  <div className="mt-1 font-inter text-xs uppercase tracking-widest text-electric">{item.role}</div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="bg-black px-6 py-20 sm:px-10 lg:px-16 lg:py-28">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <div className="mb-4 font-inter text-xs uppercase tracking-[0.3em] text-electric">FAQ</div>
              <h2 className="font-podium text-5xl uppercase leading-none text-white sm:text-6xl">
                Before you enroll.
              </h2>
            </div>
            <div className="space-y-4">
              {faqs.map(([question, answer]) => (
                <div key={question} className="border border-white/10 p-6">
                  <h3 className="font-inter text-lg font-semibold text-white">{question}</h3>
                  <p className="mt-3 font-inter text-sm leading-relaxed text-white/60">{answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-ink px-6 py-8 sm:px-10 lg:px-16">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 font-inter text-xs uppercase tracking-widest text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <span>Trading Boy Academy</span>
          <span>Forex education. Risk-first training.</span>
        </div>
      </footer>

      <div
        className={`fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm transition ${
          modalOpen ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
      >
        <div className="w-full max-w-lg bg-ink p-6 shadow-glow sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <div className="font-inter text-xs uppercase tracking-[0.3em] text-electric">Enroll Now</div>
              <h2 className="mt-2 font-podium text-4xl uppercase text-white">Buy the course</h2>
            </div>
            <button onClick={() => setModalOpen(false)} aria-label="Close checkout form">
              <X className="h-7 w-7 text-white" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Full name"
              className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric"
            />
            <input
              required
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="Email address"
              className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric"
            />
            <input
              required
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              placeholder="Phone or WhatsApp"
              className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric"
            />
            <select
              value={form.plan}
              onChange={(event) => setForm({ ...form, plan: event.target.value })}
              className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition focus:border-electric"
            >
              <option>Complete Forex Mastery</option>
              <option>Mentorship + Live Sessions</option>
              <option>One-to-One Strategy Call</option>
            </select>

            {statusMessage && (
              <p className={`font-inter text-sm ${status === 'success' ? 'text-electric' : 'text-white/55'}`}>
                {statusMessage}
              </p>
            )}

            <button
              disabled={status === 'sending'}
              className="group w-full bg-electric px-6 py-4 font-inter text-xs font-bold uppercase tracking-widest text-black transition hover:bg-skyline disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === 'sending' ? 'Submitting...' : 'Submit Purchase Request'}
              <ArrowUpRight className="ml-2 inline h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

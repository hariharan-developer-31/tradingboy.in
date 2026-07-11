import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpen, CheckCircle, Copy, CreditCard, Crown, Edit3, Plus, RefreshCcw, Ticket, Trash2, X } from 'lucide-react';
import { supabase } from './lib/supabase';

const UPI_ID = 'harishsankar023@okaxis';
const DEFAULT_COURSE = 'Complete Forex Mastery';

const fallbackCourses = [
  {
    id: 'complete-forex-mastery',
    title: DEFAULT_COURSE,
    description: 'A structured forex trading course covering market structure, liquidity, risk management, and live execution.',
    thumbnail_url: 'https://images.unsplash.com/photo-1642790106117-e829e14a795f?auto=format&fit=crop&w=1200&q=85',
    normal_price: 7199,
    offer_price: 7199,
    price: 7199,
    drive_url: null,
    active: true,
    created_at: '',
  },
  {
    id: 'funded-trader-blueprint',
    title: 'Blueprint to Become a Funded Trader',
    description:
      'Gold trading and gold futures training with funded account rules, evaluation strategy, drawdown control, and risk-first execution.',
    thumbnail_url: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=1200&q=85',
    normal_price: 26999,
    offer_price: 5399,
    price: 5399,
    drive_url: null,
    active: true,
    created_at: '',
  },
];

const navLinks = ['Course', 'About', 'Results', 'FAQ'];

const testimonials = [
  {
    quote: 'The course finally made price action feel structured. My biggest win was learning when not to trade.',
    name: 'Arjun M.',
    role: 'Funded account trader',
  },
  {
    quote: 'The live breakdowns helped me stop chasing signals and start building a repeatable execution plan.',
    name: 'Priya S.',
    role: 'Forex swing trader',
  },
  {
    quote: 'Clear lessons, practical homework, and honest feedback. It feels built for serious beginners.',
    name: 'Daniel R.',
    role: 'Part-time trader',
  },
];

const faqs = [
  ['Is this course beginner friendly?', 'Yes. It starts with foundations, then moves into execution, risk, and live market application.'],
  ['Is there a refund policy?', 'No. Course access is digital and educational, so all confirmed payments are non-refundable.'],
  ['How do I get access?', 'After admin approval, access details are sent to your registered email within 12 hours.'],
];

const terms = [
  'All payments are non-refundable once submitted for course enrollment.',
  'The training is for educational purposes only and is not financial advice.',
  'Trading forex, gold, futures, and funded accounts involves risk. You are responsible for your own decisions.',
  'Past results, examples, or student outcomes do not guarantee future performance.',
  'Course access is shared after admin payment approval, usually within 12 hours.',
];

type PublicCourse = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  normal_price: number | null;
  offer_price: number | null;
  price: number;
  drive_url: string | null;
  active: boolean;
  created_at: string;
};

type JoinForm = {
  name: string;
  email: string;
  phone: string;
  tradingExperience: string;
  courseName: string;
  termsAccepted: boolean;
};

type CourseOrder = {
  id: string;
  course_name: string | null;
  full_name: string;
  email: string;
  phone: string;
  trading_experience: string | null;
  terms_accepted: boolean;
  original_amount: number;
  discount_amount: number;
  final_amount: number;
  payment_status: string;
  created_at: string;
};

type Coupon = {
  id: string;
  code: string;
  discount_type: 'fixed' | 'percent';
  discount_value: number;
  active: boolean;
  expires_at: string | null;
  max_uses: number | null;
  current_uses: number;
  created_at: string;
};

type AdminCouponForm = {
  id: string | null;
  code: string;
  discountType: 'fixed' | 'percent';
  discountValue: string;
  expiresAt: string;
  maxUses: string;
};

type AdminCourseForm = {
  id: string | null;
  title: string;
  description: string;
  thumbnailUrl: string;
  thumbnailDataUrl?: string;
  normalPrice: string;
  offerPrice: string;
  driveUrl: string;
};

const money = (amount: number) => `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`;

const offerPercent = (normalPrice?: number | null, offerPrice?: number | null) => {
  if (!normalPrice || !offerPrice || normalPrice <= offerPrice) return 0;
  return Math.round(((normalPrice - offerPrice) / normalPrice) * 100);
};

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [publicCourses, setPublicCourses] = useState<PublicCourse[]>(fallbackCourses);
  const [joinStep, setJoinStep] = useState<'details' | 'payment' | 'thanks' | 'failed'>('details');
  const [joinForm, setJoinForm] = useState<JoinForm>({
    name: '',
    email: '',
    phone: '',
    tradingExperience: '',
    courseName: DEFAULT_COURSE,
    termsAccepted: false,
  });
  const [termsOpen, setTermsOpen] = useState(false);
  const [paymentSeconds, setPaymentSeconds] = useState(180);
  const [paymentPromptOpen, setPaymentPromptOpen] = useState(false);
  const [promptedAt, setPromptedAt] = useState<number[]>([]);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'sending' | 'error'>('idle');
  const [createdOrderId, setCreatedOrderId] = useState('');
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState('');
  const [adminSection, setAdminSection] = useState<'home' | 'courses' | 'payments' | 'coupons'>('home');
  const [adminStatus, setAdminStatus] = useState('');
  const [adminCourses, setAdminCourses] = useState<PublicCourse[]>([]);
  const [adminOrders, setAdminOrders] = useState<CourseOrder[]>([]);
  const [adminCoupons, setAdminCoupons] = useState<Coupon[]>([]);
  const [couponForm, setCouponForm] = useState<AdminCouponForm>({
    id: null,
    code: '',
    discountType: 'percent',
    discountValue: '',
    expiresAt: '',
    maxUses: '',
  });
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [showCouponForm, setShowCouponForm] = useState(false);
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [paymentCourseFilter, setPaymentCourseFilter] = useState('all');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState('');
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [courseForm, setCourseForm] = useState<AdminCourseForm>({
    id: null,
    title: '',
    description: '',
    thumbnailUrl: '',
    normalPrice: '',
    offerPrice: '',
    driveUrl: '',
  });

  const selectedCourse = useMemo(
    () => publicCourses.find((course) => course.title === joinForm.courseName) || publicCourses[0] || fallbackCourses[0],
    [joinForm.courseName, publicCourses],
  );
  const selectedNormalPrice = selectedCourse.normal_price || selectedCourse.price;
  let selectedOfferPrice = selectedCourse.offer_price || selectedCourse.price;

  if (appliedCoupon) {
    if (appliedCoupon.discount_type === 'percent') {
      selectedOfferPrice = Math.max(0, selectedOfferPrice - Math.round((selectedOfferPrice * appliedCoupon.discount_value) / 100));
    } else {
      selectedOfferPrice = Math.max(0, selectedOfferPrice - appliedCoupon.discount_value);
    }
  }

  const upiUrl = useMemo(() => {
    const params = new URLSearchParams({
      pa: UPI_ID,
      pn: 'Trading Boy Academy',
      am: selectedOfferPrice.toString(),
      cu: 'INR',
      tn: selectedCourse.title,
    });
    return `upi://pay?${params.toString()}`;
  }, [selectedCourse.title, selectedOfferPrice]);
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiUrl)}`;

  const filteredOrders = useMemo(() => {
    const query = paymentSearch.trim().toLowerCase();
    return adminOrders.filter((order) => {
      const matchesStatus = paymentStatusFilter === 'all' || order.payment_status === paymentStatusFilter;
      const matchesCourse = paymentCourseFilter === 'all' || order.course_name === paymentCourseFilter;
      const matchesSearch =
        !query ||
        [order.full_name, order.email, order.phone, order.course_name || '', order.trading_experience || '']
          .join(' ')
          .toLowerCase()
          .includes(query);
      return matchesStatus && matchesCourse && matchesSearch;
    });
  }, [adminOrders, paymentCourseFilter, paymentSearch, paymentStatusFilter]);

  const adminCourseNames = useMemo(
    () => Array.from(new Set(adminOrders.map((order) => order.course_name).filter(Boolean))) as string[],
    [adminOrders],
  );

  useEffect(() => {
    const handleScroll = () => setHasScrolled(window.scrollY > 24);
    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const syncHashPage = () => {
      setAdminOpen(window.location.hash === '#admin');
      setCheckoutOpen(window.location.hash === '#checkout');
    };
    syncHashPage();
    window.addEventListener('hashchange', syncHashPage);
    return () => window.removeEventListener('hashchange', syncHashPage);
  }, []);

  useEffect(() => {
    const loadPublicCourses = async () => {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('courses')
        .select('id, title, description, thumbnail_url, normal_price, offer_price, price, drive_url, active, created_at')
        .eq('active', true)
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        setPublicCourses(data as PublicCourse[]);
        setJoinForm((current) => ({
          ...current,
          courseName: data.some((course) => course.title === current.courseName) ? current.courseName : data[0].title,
        }));
      }
    };
    loadPublicCourses();
  }, []);

  useEffect(() => {
    if (!checkoutOpen || joinStep !== 'payment') return undefined;
    const interval = window.setInterval(() => {
      setPaymentSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [checkoutOpen, joinStep]);

  useEffect(() => {
    if (joinStep !== 'payment') return;
    const elapsed = 180 - paymentSeconds;
    const promptTimes = [60, 120, 150, 180];
    if (promptTimes.includes(elapsed) && !promptedAt.includes(elapsed)) {
      setPromptedAt((current) => [...current, elapsed]);
      setPaymentPromptOpen(true);
    }
  }, [joinStep, paymentSeconds, promptedAt]);

  const openCheckout = (courseName = selectedCourse.title) => {
    setJoinStep('details');
    setPaymentSeconds(180);
    setPromptedAt([]);
    setPaymentPromptOpen(false);
    setSubmitStatus('idle');
    setCreatedOrderId('');
    setJoinForm((current) => ({ ...current, courseName }));
    window.location.hash = 'checkout';
  };

  const closeHashPage = () => {
    window.location.hash = '';
    setAdminOpen(false);
    setCheckoutOpen(false);
  };

  const beginPayment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!joinForm.termsAccepted) {
      setTermsOpen(true);
      return;
    }
    setPaymentSeconds(180);
    setPromptedAt([]);
    setPaymentPromptOpen(false);
    setJoinStep('payment');
  };

  const validateCouponCode = async () => {
    if (!couponInput.trim()) return;
    setValidatingCoupon(true);
    setCouponError('');
    try {
      const response = await fetch('/api/checkCoupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ couponCode: couponInput }),
      });
      const data = await response.json();
      if (!response.ok) {
        setCouponError(data.error || 'Invalid coupon.');
        setAppliedCoupon(null);
      } else {
        setAppliedCoupon(data.coupon);
      }
    } catch {
      setCouponError('Error checking coupon.');
      setAppliedCoupon(null);
    } finally {
      setValidatingCoupon(false);
    }
  };

  const submitPaymentConfirmation = async () => {
    setSubmitStatus('sending');
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: joinForm.name,
          email: joinForm.email,
          phone: joinForm.phone,
          tradingExperience: joinForm.tradingExperience,
          courseName: selectedCourse.title,
          termsAccepted: joinForm.termsAccepted,
          couponCode: appliedCoupon?.code,
        }),
      });
      const text = await response.text();
      const result = text ? JSON.parse(text) : {};
      if (!response.ok) {
        setSubmitStatus('error');
        return;
      }
      setCreatedOrderId(result.orderId || '');
      setSubmitStatus('idle');
      setPaymentPromptOpen(false);
      setJoinStep('thanks');
    } catch {
      setSubmitStatus('error');
    }
  };

  const adminRequest = async <T,>(action: string, payload: Record<string, unknown> = {}): Promise<T> => {
    const response = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, passcode: adminPasscode, ...payload }),
    });
    const text = await response.text();
    const result = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(result.error || 'Admin request failed.');
    return result as T;
  };

  const loadAdminCourses = async () => {
    const result = await adminRequest<{ data: PublicCourse[] }>('courses');
    setAdminCourses(result.data || []);
  };

  const loadAdminOrders = async () => {
    const result = await adminRequest<{ data: CourseOrder[] }>('orders');
    setAdminOrders(result.data || []);
  };

  const loadAdminCoupons = async () => {
    const result = await adminRequest<{ data: Coupon[] }>('coupons');
    setAdminCoupons(result.data || []);
  };

  const unlockAdmin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setAdminStatus('');
      await loadAdminCourses();
      await loadAdminOrders();
      await loadAdminCoupons();
      setAdminUnlocked(true);
    } catch (error) {
      setAdminStatus(error instanceof Error ? error.message : 'Could not unlock admin.');
    }
  };

  const resetCourseForm = () => {
    setCourseForm({ id: null, title: '', description: '', thumbnailUrl: '', thumbnailDataUrl: undefined, normalPrice: '', offerPrice: '', driveUrl: '' });
    setShowCourseForm(false);
  };

  const saveCourse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalPrice = Number(courseForm.normalPrice);
    const offerPrice = Number(courseForm.offerPrice);
    if (!courseForm.title.trim() || Number.isNaN(normalPrice) || Number.isNaN(offerPrice) || normalPrice <= 0 || offerPrice <= 0) {
      setAdminStatus('Enter a course name, normal price, and offer price.');
      return;
    }
    try {
      await adminRequest('saveCourse', {
        id: courseForm.id,
        title: courseForm.title,
        description: courseForm.description,
        thumbnailUrl: courseForm.thumbnailUrl,
        thumbnailDataUrl: courseForm.thumbnailDataUrl,
        normalPrice,
        offerPrice,
        driveUrl: courseForm.driveUrl,
      });
      resetCourseForm();
      setAdminStatus('Course saved.');
      await loadAdminCourses();
    } catch (error) {
      setAdminStatus(error instanceof Error ? error.message : 'Could not save course.');
    }
  };

  const editCourse = (course: PublicCourse) => {
    setCourseForm({
      id: course.id,
      title: course.title,
      description: course.description || '',
      thumbnailUrl: course.thumbnail_url || '',
      normalPrice: String(course.normal_price || course.price),
      offerPrice: String(course.offer_price || course.price),
      driveUrl: course.drive_url || '',
    });
    setShowCourseForm(true);
    setAdminSection('courses');
    setAdminStatus('');
  };

  const deleteCourse = async (course: PublicCourse) => {
    if (!window.confirm(`Delete "${course.title}"? This cannot be undone.`)) return;
    try {
      await adminRequest('deleteCourse', { courseId: course.id });
      if (courseForm.id === course.id) resetCourseForm();
      setAdminStatus('Course deleted.');
      await loadAdminCourses();
    } catch (error) {
      setAdminStatus(error instanceof Error ? error.message : 'Could not delete course.');
    }
  };

  const saveCoupon = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSubmitStatus('sending');
      await adminRequest('saveCoupon', { ...couponForm });
      setCouponForm({ id: null, code: '', discountType: 'percent', discountValue: '', expiresAt: '', maxUses: '' });
      setShowCouponForm(false);
      setAdminStatus('Coupon saved.');
      await loadAdminCoupons();
    } catch (error) {
      setAdminStatus(error instanceof Error ? error.message : 'Could not save coupon.');
    } finally {
      setSubmitStatus('idle');
    }
  };

  const toggleCouponStatus = async (couponId: string, currentStatus: boolean) => {
    try {
      await adminRequest('toggleCoupon', { couponId, active: !currentStatus });
      await loadAdminCoupons();
    } catch (error) {
      setAdminStatus(error instanceof Error ? error.message : 'Could not toggle coupon status.');
    }
  };

  const deleteCoupon = async (coupon: Coupon) => {
    if (!window.confirm(`Delete coupon "${coupon.code}"?`)) return;
    try {
      await adminRequest('deleteCoupon', { couponId: coupon.id });
      setAdminStatus('Coupon deleted.');
      await loadAdminCoupons();
    } catch (error) {
      setAdminStatus(error instanceof Error ? error.message : 'Could not delete coupon.');
    }
  };

  const updateOrderStatus = async (orderId: string, paymentStatus: string) => {
    try {
      await adminRequest('updateOrder', { orderId, paymentStatus });
      setAdminStatus('Payment status updated.');
      await loadAdminOrders();
    } catch (error) {
      setAdminStatus(error instanceof Error ? error.message : 'Could not update payment status.');
    }
  };

  const downloadOrdersCsv = () => {
    const headers = ['Order ID', 'Date', 'Name', 'Email', 'Phone', 'Experience', 'Course', 'Amount', 'Status'];
    const rows = filteredOrders.map((order) => [
      order.id,
      new Date(order.created_at).toLocaleString('en-IN'),
      order.full_name,
      order.email,
      order.phone,
      order.trading_experience || '',
      order.course_name || '',
      order.final_amount,
      order.payment_status,
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trading-boy-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-ink text-white">
      {!adminOpen && (
        <header className={`fixed inset-x-0 top-0 z-40 px-5 py-3 transition-all duration-500 sm:px-8 lg:px-12 lg:py-4 ${hasScrolled ? 'border-b border-white/10 bg-ink/90 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl' : 'border-b border-transparent bg-transparent'}`}>
        <nav className="flex items-center justify-between">
          <a href="#home" className="flex items-center gap-2.5" aria-label="Trading Boy home">
            <span className="relative block h-7 w-7 border-b-[5px] border-l-[5px] border-electric">
              <span className="absolute -right-0.5 top-0 h-5 w-[5px] rotate-[-28deg] bg-electric" />
            </span>
            <span className="font-podium text-xl font-bold uppercase tracking-wider text-white sm:text-2xl">Trading Boy</span>
          </a>
          <div className="hidden items-center gap-7 md:flex lg:gap-10">
            {navLinks.map((link) => (
              <a key={link} href={`#${link.toLowerCase()}`} className="font-inter text-xs uppercase tracking-widest text-white/80 transition hover:text-white">
                {link}
              </a>
            ))}
          </div>
          <button onClick={() => openCheckout()} className="group hidden items-center gap-2 border border-white/30 px-4 py-2.5 font-inter text-[11px] uppercase tracking-widest text-white transition hover:border-electric hover:bg-white/10 md:flex">
            Enroll Now
            <ArrowUpRight className="h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </button>
          <button type="button" className="space-y-1.5 md:hidden" onClick={() => setMenuOpen(true)}>
            <span className="block h-0.5 w-7 bg-white" />
            <span className="block h-0.5 w-7 bg-white" />
            <span className="block h-0.5 w-7 bg-white" />
          </button>
        </nav>
      </header>
      )}

      {!adminOpen && (
        <div className={`fixed inset-0 z-50 bg-ink transition duration-500 md:hidden ${menuOpen ? 'visible opacity-100' : 'invisible opacity-0'}`}>
        <div className="flex justify-end px-5 py-5">
          <button onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <X className="h-8 w-8" />
          </button>
        </div>
        <div className="flex h-[calc(100vh-88px)] flex-col items-center justify-center gap-7">
          {navLinks.map((link) => (
            <a key={link} href={`#${link.toLowerCase()}`} onClick={() => setMenuOpen(false)} className="font-podium text-4xl uppercase text-white">
              {link}
            </a>
          ))}
          <button onClick={() => { setMenuOpen(false); openCheckout(); }} className="border border-white/30 px-7 py-4 font-inter text-xs uppercase tracking-widest text-white">
            Enroll Now
          </button>
        </div>
      </div>
      )}

      {!checkoutOpen && !adminOpen && (
        <main>
          <section id="home" className="relative flex min-h-screen items-center overflow-hidden bg-[#070b10] pt-28 lg:pt-32">
            <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-25 animate-grid-pan" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(37,174,244,0.16),rgba(7,11,16,0.58)_38%,#070b10_74%)] animate-soft-drift" />
            <div className="pointer-events-none absolute inset-y-0 left-0 w-[42%] origin-left bg-[linear-gradient(90deg,rgba(37,174,244,0.22),rgba(37,174,244,0.055)_45%,transparent)] blur-[3px] animate-edge-breathe" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-[42%] origin-right bg-[linear-gradient(270deg,rgba(37,174,244,0.2),rgba(37,174,244,0.055)_45%,transparent)] blur-[3px] animate-edge-breathe" />
            <div className="pointer-events-none absolute left-1/2 top-[38%] h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-electric/10 blur-[120px]" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-ink via-ink/70 to-transparent" />

            <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center px-6 py-16 text-center sm:px-10 lg:px-16">
              <div className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-950/20 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.28em] text-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.12)] animate-hero-kicker">
                Live Trading Education
              </div>
              <h1 className="mt-8 w-full font-podium font-bold uppercase tracking-normal text-white animate-hero-title">
                <span className="block text-[clamp(2.05rem,10.8vw,3.55rem)] leading-[0.9] md:hidden">
                  <span className="block">Trade Price</span>
                  <span className="block">
                    Action. <span className="bg-gradient-to-r from-electric via-skyline to-white bg-clip-text text-transparent">Master</span>
                  </span>
                  <span className="block bg-gradient-to-r from-electric via-skyline to-white bg-clip-text text-transparent">Structure.</span>
                </span>
                <span className="hidden leading-[0.88] md:block md:text-[clamp(2.85rem,6.8vw,6.7rem)]">
                  <span className="block whitespace-nowrap">Trade Price Action.</span>
                  <span className="block whitespace-nowrap bg-gradient-to-r from-electric via-skyline to-white bg-clip-text text-transparent">Master Structure.</span>
                </span>
              </h1>
              <p className="mx-auto mt-8 max-w-2xl font-inter text-sm leading-relaxed text-white/58 sm:text-base animate-hero-copy">
                Practical trading courses for serious learners who want process, risk control, and disciplined execution.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4 animate-hero-actions">
                <button onClick={() => openCheckout()} className="group inline-flex items-center justify-center rounded-full bg-electric px-7 py-4 font-inter text-[11px] font-bold uppercase tracking-widest text-black shadow-glow transition hover:bg-skyline">
                  Join Course
                  <ArrowUpRight className="ml-2 h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </button>
                <a href="#course" className="rounded-full border border-white/12 bg-white/[0.03] px-7 py-4 font-inter text-[11px] font-bold uppercase tracking-widest text-white/75 transition hover:border-electric/60 hover:text-white">
                  View Courses
                </a>
              </div>
            </div>
          </section>

          <section id="course" className="section-rise bg-ink px-6 py-20 sm:px-10 lg:px-16 lg:py-28">
            <div className="mx-auto max-w-7xl">
              <div className="mb-10 max-w-3xl">
                <div className="mb-4 font-inter text-xs uppercase tracking-[0.3em] text-electric">Courses</div>
                <h2 className="font-podium text-5xl uppercase leading-none text-white sm:text-6xl lg:text-7xl">Choose your trading path.</h2>
                <p className="mt-6 font-inter text-white/65">Select a course, enter your details, complete UPI payment, and wait for admin approval.</p>
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                {publicCourses.map((course) => {
                  const normalPrice = course.normal_price || course.price;
                  const offerPrice = course.offer_price || course.price;
                  const percent = offerPercent(normalPrice, offerPrice);
                  return (
                    <article key={course.id || course.title} className="smooth-card border border-white/10 bg-black shadow-glow hover:border-electric/35 hover:shadow-neon-blue">
                      <img src={course.thumbnail_url || fallbackCourses[0].thumbnail_url} alt={course.title} className="h-56 w-full object-cover" />
                      <div className="p-6">
                        <div className="font-inter text-xs uppercase tracking-[0.3em] text-electric">Course</div>
                        <h3 className="mt-4 font-podium text-4xl uppercase leading-none text-white sm:text-5xl">{course.title}</h3>
                        <p className="mt-5 font-inter text-sm leading-relaxed text-white/65">{course.description}</p>
                        <div className="mt-7 flex flex-wrap items-end gap-3 font-inter">
                          <div className="text-4xl font-bold text-white">{money(offerPrice)}</div>
                          {percent > 0 && (
                            <>
                              <div className="pb-1 text-sm text-white/40 line-through">{money(normalPrice)}</div>
                              <div className="mb-1 bg-electric px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-black">{percent}% Off</div>
                            </>
                          )}
                        </div>
                        <button onClick={() => openCheckout(course.title)} className="group mt-7 bg-electric px-6 py-4 font-inter text-xs font-bold uppercase tracking-widest text-black transition hover:bg-skyline">
                          Join Course
                          <ArrowUpRight className="ml-2 inline h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <section id="about" className="section-rise bg-black px-6 py-20 sm:px-10 lg:px-16 lg:py-28">
            <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2 lg:items-center">
              <img src="https://images.unsplash.com/photo-1642790106117-e829e14a795f?auto=format&fit=crop&w=1600&q=85" alt="Trading charts on a workstation" className="h-[420px] w-full object-cover" />
              <div>
                <div className="mb-4 font-inter text-xs uppercase tracking-[0.3em] text-electric">About Us</div>
                <h2 className="font-podium text-5xl uppercase leading-none text-white sm:text-6xl">Practical trading education for serious learners.</h2>
                <p className="mt-6 font-inter leading-relaxed text-white/65">
                  Trading Boy Academy is built around clean market logic, disciplined risk, and practical execution. We teach students how to read markets with patience and trade with a written plan.
                </p>
                <button onClick={() => openCheckout()} className="group mt-8 border border-electric px-6 py-4 font-inter text-xs font-bold uppercase tracking-widest text-white transition hover:bg-electric hover:text-black">
                  Join The Course
                  <ArrowUpRight className="ml-2 inline h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>
          </section>

          <section id="results" className="section-rise bg-ink px-6 py-20 sm:px-10 lg:px-16 lg:py-28">
            <div className="mx-auto max-w-7xl">
              <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div>
                  <div className="mb-4 font-inter text-xs uppercase tracking-[0.3em] text-electric">Testimonials</div>
                  <h2 className="font-podium text-5xl uppercase leading-none text-white sm:text-6xl">Student feedback.</h2>
                </div>
                <p className="max-w-md font-inter text-sm text-white/60">Results vary by student. The courses focus on process, discipline, and risk-first decision making.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {testimonials.map((item) => (
                  <article key={item.name} className="smooth-card border border-white/10 bg-white/[0.03] p-6 hover:border-electric/35">
                    <p className="font-inter leading-relaxed text-white/75">"{item.quote}"</p>
                    <div className="mt-8 font-inter text-sm font-semibold text-white">{item.name}</div>
                    <div className="mt-1 font-inter text-xs uppercase tracking-widest text-electric">{item.role}</div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section id="faq" className="section-rise bg-black px-6 py-20 sm:px-10 lg:px-16 lg:py-28">
            <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <div className="mb-4 font-inter text-xs uppercase tracking-[0.3em] text-electric">FAQ</div>
                <h2 className="font-podium text-5xl uppercase leading-none text-white sm:text-6xl">Before you enroll.</h2>
              </div>
              <div className="space-y-4">
                {faqs.map(([question, answer]) => (
                  <div key={question} className="smooth-card border border-white/10 p-6 hover:border-electric/35">
                    <h3 className="font-inter text-lg font-semibold text-white">{question}</h3>
                    <p className="mt-3 font-inter text-sm leading-relaxed text-white/60">{answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      )}

      {!checkoutOpen && !adminOpen && (
        <footer className="border-t border-white/10 bg-ink px-6 py-8 sm:px-10 lg:px-16">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 font-inter text-xs uppercase tracking-widest text-white/50 sm:flex-row sm:items-center sm:justify-between">
            <span>Trading Boy Academy</span>
            <span>Forex, gold, and funded account education.</span>
          </div>
        </footer>
      )}

      {checkoutOpen && (
        <main className="page-enter min-h-screen bg-ink px-4 pb-16 pt-28 sm:px-8 lg:px-12">
          <div className="mx-auto w-full max-w-3xl border border-white/10 bg-black p-6 shadow-glow sm:p-8 smooth-card">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="font-inter text-xs uppercase tracking-[0.3em] text-electric">Join Course</div>
                <h2 className="mt-2 font-podium text-3xl uppercase leading-none text-white sm:text-4xl">
                  {joinStep === 'payment' ? 'Complete UPI Payment' : joinStep === 'thanks' ? 'Payment Submitted' : joinStep === 'failed' ? 'Payment Failed' : 'Enter Your Details'}
                </h2>
              </div>
              <button onClick={closeHashPage} aria-label="Close checkout page">
                <X className="h-7 w-7 text-white" />
              </button>
            </div>

            {joinStep === 'details' && (
              <form onSubmit={beginPayment} className="space-y-4">
                <select value={joinForm.courseName} onChange={(event) => setJoinForm({ ...joinForm, courseName: event.target.value })} className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition focus:border-electric">
                  {publicCourses.map((course) => (
                    <option key={course.id || course.title}>{course.title}</option>
                  ))}
                </select>
                <input required value={joinForm.name} onChange={(event) => setJoinForm({ ...joinForm, name: event.target.value })} placeholder="Full name" className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric" />
                <input required type="email" value={joinForm.email} onChange={(event) => setJoinForm({ ...joinForm, email: event.target.value })} placeholder="Email address" className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric" />
                <input required value={joinForm.phone} onChange={(event) => setJoinForm({ ...joinForm, phone: event.target.value })} placeholder="Phone or WhatsApp" className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric" />
                <select required value={joinForm.tradingExperience} onChange={(event) => setJoinForm({ ...joinForm, tradingExperience: event.target.value })} className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition focus:border-electric">
                  <option value="">Trading experience</option>
                  <option>Beginner</option>
                  <option>Less than 1 year</option>
                  <option>1 to 3 years</option>
                  <option>More than 3 years</option>
                  <option>Funded account trader</option>
                </select>
                <label className="flex cursor-pointer items-start gap-3 border border-white/10 bg-white/[0.03] p-4 font-inter text-sm text-white/70">
                  <input
                    type="checkbox"
                    checked={joinForm.termsAccepted}
                    onChange={(event) => {
                      if (event.target.checked) setTermsOpen(true);
                      else setJoinForm({ ...joinForm, termsAccepted: false });
                    }}
                    className="mt-1"
                  />
                  <span>I accept the terms and conditions for this trading education course.</span>
                </label>
                <div className="border border-white/10 bg-ink p-4 font-inter text-sm">
                  <div className="flex justify-between text-white/60">
                    <span>Normal price</span>
                    <span className={offerPercent(selectedNormalPrice, selectedCourse.offer_price || selectedCourse.price) > 0 ? 'line-through' : ''}>{money(selectedNormalPrice)}</span>
                  </div>
                  {appliedCoupon ? (
                    <>
                      <div className="mt-2 flex justify-between text-white/60">
                        <span>Offer price</span>
                        <span className="line-through">{money(selectedCourse.offer_price || selectedCourse.price)}</span>
                      </div>
                      <div className="mt-2 flex justify-between text-electric font-bold">
                        <span>Coupon applied ({appliedCoupon.code})</span>
                        <span>-{appliedCoupon.discount_type === 'percent' ? `${appliedCoupon.discount_value}%` : money(appliedCoupon.discount_value)}</span>
                      </div>
                      <div className="mt-4 flex justify-between text-white border-t border-white/10 pt-4">
                        <span>Final price</span>
                        <span className="font-bold text-lg">{money(selectedOfferPrice)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="mt-2 flex justify-between text-white">
                      <span>Offer price</span>
                      <span className="font-bold">{money(selectedOfferPrice)}</span>
                    </div>
                  )}
                </div>

                {!appliedCoupon && (
                  <div className="flex gap-2">
                    <input value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="Promo code (optional)" className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric uppercase" />
                    <button type="button" onClick={validateCouponCode} disabled={validatingCoupon || !couponInput} className="bg-white/5 border border-white/10 px-6 font-inter text-xs font-bold uppercase tracking-widest text-white transition hover:bg-white/10 disabled:opacity-50">
                      Apply
                    </button>
                  </div>
                )}
                {couponError && <p className="font-inter text-xs text-red-400">{couponError}</p>}
                <button className="group w-full bg-electric px-6 py-4 font-inter text-xs font-bold uppercase tracking-widest text-black transition hover:bg-skyline">
                  Join Course
                  <ArrowUpRight className="ml-2 inline h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </button>
              </form>
            )}

            {joinStep === 'payment' && (
              <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
                <div className="border border-white/10 bg-white p-4">
                  <img src={qrCodeUrl} alt="UPI payment QR code" className="mx-auto h-60 w-60" />
                </div>
                <div className="font-inter">
                  <div className="text-xs uppercase tracking-[0.3em] text-electric">Pay exactly</div>
                  <div className="mt-3 text-4xl font-bold text-white">{money(selectedOfferPrice)}</div>
                  <div className="mt-4 border border-white/10 bg-ink p-4 text-sm text-white/70">
                    <div className="text-white/45">UPI ID</div>
                    <div className="mt-1 text-lg font-bold text-white">{UPI_ID}</div>
                  </div>
                  <div className="mt-4 text-sm leading-relaxed text-white/60">
                    Timer: {Math.floor(paymentSeconds / 60)}:{String(paymentSeconds % 60).padStart(2, '0')}. Keep this page open after paying.
                  </div>
                  <a href={upiUrl} className="mt-6 inline-flex bg-electric px-6 py-4 font-inter text-xs font-bold uppercase tracking-widest text-black transition hover:bg-skyline">
                    Open UPI App
                  </a>
                  {submitStatus === 'error' && <p className="mt-4 text-sm text-red-300">Could not store your payment confirmation. Try again.</p>}
                </div>
              </div>
            )}

            {joinStep === 'thanks' && (
              <div className="border border-electric/30 bg-electric/10 p-6 font-inter">
                <CheckCircle className="h-9 w-9 text-electric" />
                <h3 className="mt-4 text-2xl font-bold text-white">Thank you for joining {selectedCourse.title}.</h3>
                <p className="mt-3 leading-relaxed text-white/70">
                  Your payment is waiting for admin approval. You will get course access via email within 12 hours. If not, message trading_boy_tamil on Instagram.
                </p>
                {createdOrderId && <p className="mt-4 text-xs text-white/45">Order ID: {createdOrderId}</p>}
              </div>
            )}

            {joinStep === 'failed' && (
              <div className="border border-red-400/30 bg-red-950/20 p-6 font-inter">
                <h3 className="text-2xl font-bold text-white">Payment failed.</h3>
                <p className="mt-3 leading-relaxed text-white/70">No confirmation was stored. You can return to the website and join again when ready.</p>
                <button onClick={closeHashPage} className="mt-6 bg-electric px-6 py-4 text-xs font-bold uppercase tracking-widest text-black">
                  Go To Website
                </button>
              </div>
            )}
          </div>
        </main>
      )}

      {adminOpen && (
        <main className="page-enter min-h-screen bg-ink p-4 sm:p-8 lg:p-12">
          <div className="mx-auto w-full max-w-[1400px]">
            <div className="mb-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="font-inter text-xs uppercase tracking-[0.3em] text-electric">Admin Panel</div>
                <h2 className="mt-2 font-podium text-3xl uppercase leading-none text-white sm:text-4xl">Trading Boy Admin</h2>
              </div>
            </div>
            {!adminUnlocked ? (
              <form onSubmit={unlockAdmin} className="max-w-md space-y-4">
                <input type="password" value={adminPasscode} onChange={(event) => setAdminPasscode(event.target.value)} placeholder="Admin passcode" className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric" />
                <button className="bg-electric px-6 py-4 font-inter text-xs font-bold uppercase tracking-widest text-black transition hover:bg-skyline">Unlock Admin</button>
                {adminStatus && <p className="font-inter text-sm text-red-300">{adminStatus}</p>}
              </form>
            ) : (
              <div>
                {adminSection === 'home' ? (
                  <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
                    <button onClick={() => setAdminSection('courses')} className="group flex flex-col text-left border border-white/10 bg-black p-6 rounded-2xl transition-all hover:border-electric">
                      <div className="flex justify-between w-full mb-8">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink border border-white/10 text-white group-hover:text-electric group-hover:border-electric/30 transition-colors">
                          <BookOpen className="h-5 w-5" />
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-xs font-bold text-white transition-colors">
                          {adminCourses.length}
                        </div>
                      </div>
                      <div className="font-inter text-xs font-bold uppercase tracking-[0.2em] text-white/50 mb-2">Catalog</div>
                      <h3 className="font-podium text-3xl text-white mb-4 tracking-wide">Manage <span className="italic font-light">Courses</span></h3>
                      <p className="font-inter text-sm text-white/60 leading-relaxed">
                        Add new courses, edit course details, update pricing, and manage your academy offerings.
                      </p>
                    </button>

                    <button onClick={() => setAdminSection('payments')} className="group flex flex-col text-left border border-white/10 bg-black p-6 rounded-2xl transition-all hover:border-electric">
                      <div className="flex justify-between w-full mb-8">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink border border-white/10 text-white group-hover:text-electric group-hover:border-electric/30 transition-colors">
                          <CreditCard className="h-5 w-5" />
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-xs font-bold text-white transition-colors">
                          {filteredOrders.length}
                        </div>
                      </div>
                      <div className="font-inter text-xs font-bold uppercase tracking-[0.2em] text-white/50 mb-2">Sales</div>
                      <h3 className="font-podium text-3xl text-white mb-4 tracking-wide">Manage <span className="italic font-light">Payments</span></h3>
                      <p className="font-inter text-sm text-white/60 leading-relaxed">
                        Review customer orders, update payment statuses, verify screenshots, and track revenue.
                      </p>
                    </button>

                    <button onClick={() => setAdminSection('coupons')} className="group flex flex-col text-left border border-white/10 bg-black p-6 rounded-2xl transition-all hover:border-electric">
                      <div className="flex justify-between w-full mb-8">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink border border-white/10 text-white group-hover:text-electric group-hover:border-electric/30 transition-colors">
                          <Ticket className="h-5 w-5" />
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-xs font-bold text-white transition-colors">
                          {adminCoupons.length}
                        </div>
                      </div>
                      <div className="font-inter text-xs font-bold uppercase tracking-[0.2em] text-white/50 mb-2">Promotions</div>
                      <h3 className="font-podium text-3xl text-white mb-4 tracking-wide">Manage <span className="italic font-light">Coupons</span></h3>
                      <p className="font-inter text-sm text-white/60 leading-relaxed">
                        Create promotional codes, set percentage or flat discounts, and toggle coupon activity.
                      </p>
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 border-b border-white/10 pb-6">
                      <button onClick={() => setAdminSection('home')} className="flex items-center gap-2 font-inter text-sm text-white/70 transition hover:text-electric shrink-0" aria-label="Back to dashboard">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Dashboard
                      </button>
                      <div className="hidden sm:block h-6 w-px bg-white/20 shrink-0"></div>
                      <div className="font-podium text-xl tracking-wider uppercase text-white break-words">
                        {adminSection === 'courses' ? 'Course Management' : adminSection === 'payments' ? 'Payment Management' : 'Coupon Management'}
                      </div>
                    </div>
                    {adminStatus && <div className="mb-5 border border-white/10 bg-black p-4 font-inter text-sm text-white/70">{adminStatus}</div>}
                    {adminSection === 'coupons' ? (
                      <div className="space-y-6">
                        {!showCouponForm && (
                          <div className="flex justify-end">
                            <button onClick={() => setShowCouponForm(true)} className="flex items-center gap-2 bg-electric px-6 py-3 font-inter text-xs font-bold uppercase tracking-widest text-black transition hover:bg-skyline">
                              <Plus className="h-4 w-4" />
                              Add Coupon
                            </button>
                          </div>
                        )}
                        <div className="block">
                          {showCouponForm && (
                            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-4">
                              <form onSubmit={saveCoupon} className="animate-scale-in max-w-xl w-full space-y-4 border border-white/10 bg-ink p-6 shadow-glow max-h-[90vh] overflow-y-auto scrollbar-hide">
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <div className="font-inter text-xs uppercase tracking-[0.3em] text-electric">Add Coupon</div>
                                  </div>
                                  <button type="button" onClick={() => { setCouponForm({ id: null, code: '', discountType: 'percent', discountValue: '', expiresAt: '', maxUses: '' }); setShowCouponForm(false); }} aria-label="Close coupon form"><X className="h-6 w-6 text-white/50 hover:text-white transition" /></button>
                                </div>
                                <input required value={couponForm.code} onChange={(event) => setCouponForm({ ...couponForm, code: event.target.value.toUpperCase() })} placeholder="Coupon Code (e.g. SUMMER20)" className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric uppercase" />
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <select value={couponForm.discountType} onChange={(event) => setCouponForm({ ...couponForm, discountType: event.target.value as 'fixed' | 'percent' })} className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition focus:border-electric">
                                    <option value="percent">Percentage (%)</option>
                                    <option value="fixed">Fixed Amount (Rs.)</option>
                                  </select>
                                  <input required type="number" min="1" value={couponForm.discountValue} onChange={(event) => setCouponForm({ ...couponForm, discountValue: event.target.value })} placeholder={couponForm.discountType === 'percent' ? 'Discount %' : 'Amount off'} className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric" />
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div className="flex flex-col">
                                    <label className="mb-1 text-[10px] uppercase text-white/50 tracking-wider">Expiration Date (Optional)</label>
                                    <input type="date" value={couponForm.expiresAt} onChange={(event) => setCouponForm({ ...couponForm, expiresAt: event.target.value })} className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric" />
                                  </div>
                                  <div className="flex flex-col">
                                    <label className="mb-1 text-[10px] uppercase text-white/50 tracking-wider">Max Uses (Optional)</label>
                                    <input type="number" min="1" value={couponForm.maxUses} onChange={(event) => setCouponForm({ ...couponForm, maxUses: event.target.value })} placeholder="e.g. 50" className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric" />
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-3 pt-2">
                                  <button type="submit" disabled={submitStatus === 'sending'} className="bg-electric px-6 py-4 font-inter text-xs font-bold uppercase tracking-widest text-black transition hover:bg-skyline disabled:opacity-50">
                                    Save Coupon
                                  </button>
                                  <button type="button" onClick={() => { setCouponForm({ id: null, code: '', discountType: 'percent', discountValue: '', expiresAt: '', maxUses: '' }); setShowCouponForm(false); }} className="border border-white/15 px-6 py-4 font-inter text-xs font-bold uppercase tracking-widest text-white transition hover:border-electric">Cancel</button>
                                </div>
                              </form>
                            </div>
                          )}
                          <div className="border border-white/10 bg-black min-w-0">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left font-inter text-sm text-white">
                              <thead className="bg-white/5 uppercase tracking-wider text-white/50 text-xs">
                                <tr>
                                  <th className="px-4 py-3">Code</th>
                                  <th className="px-4 py-3">Discount</th>
                                  <th className="px-4 py-3">Usage & Limits</th>
                                  <th className="px-4 py-3">Status</th>
                                  <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/10">
                                {adminCoupons.length === 0 ? (
                                  <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-white/50">
                                      No coupons found.
                                    </td>
                                  </tr>
                                ) : (
                                  adminCoupons.map((coupon) => (
                                    <tr key={coupon.id} className="transition-colors hover:bg-white/5">
                                      <td className="px-4 py-4 font-bold">
                                        <div className="flex items-center gap-2">
                                          {coupon.code}
                                          <button onClick={() => { navigator.clipboard.writeText(coupon.code); setAdminStatus('Coupon copied!'); setTimeout(() => setAdminStatus(''), 3000); }} className="text-white/30 hover:text-white transition-colors" title="Copy to clipboard">
                                            <Copy className="h-3 w-3" />
                                          </button>
                                        </div>
                                      </td>
                                      <td className="px-4 py-4">{coupon.discount_type === 'percent' ? `${coupon.discount_value}% Off` : money(coupon.discount_value)}</td>
                                      <td className="px-4 py-4 text-xs text-white/70">
                                        <div>Uses: {coupon.current_uses || 0} {coupon.max_uses ? `/ ${coupon.max_uses}` : ''}</div>
                                        {coupon.expires_at && <div className="mt-1">Exp: {new Date(coupon.expires_at).toLocaleDateString('en-IN')}</div>}
                                      </td>
                                      <td className="px-4 py-4">
                                        <button onClick={() => toggleCouponStatus(coupon.id, coupon.active)} className={`rounded-full px-3 py-1 text-xs font-bold transition hover:opacity-80 ${coupon.active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                          {coupon.active ? 'Active' : 'Inactive'}
                                        </button>
                                      </td>
                                      <td className="px-4 py-4 text-right">
                                        <button onClick={() => deleteCoupon(coupon)} className="p-2 text-white/50 transition-colors hover:text-red-400" aria-label="Delete">
                                          <Trash2 className="h-4 w-4 inline-block" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        </div>
                      </div>
                    ) : adminSection === 'courses' ? (
                  <div className="space-y-6">
                    {!showCourseForm && !courseForm.id && (
                      <div className="flex justify-end">
                        <button onClick={() => setShowCourseForm(true)} className="flex items-center gap-2 bg-electric px-6 py-3 font-inter text-xs font-bold uppercase tracking-widest text-black transition hover:bg-skyline">
                          <Plus className="h-4 w-4" />
                          Add Course
                        </button>
                      </div>
                    )}
                    <div className="block">
                      {(showCourseForm || courseForm.id) && (
                        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-4">
                          <form onSubmit={saveCourse} className="animate-scale-in max-w-xl w-full space-y-4 border border-white/10 bg-ink p-6 shadow-glow max-h-[90vh] overflow-y-auto scrollbar-hide">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="font-inter text-xs uppercase tracking-[0.3em] text-electric">{courseForm.id ? 'Edit Course' : 'Add Course'}</div>
                              </div>
                              <button type="button" onClick={resetCourseForm} aria-label="Close course form"><X className="h-6 w-6 text-white/50 hover:text-white transition" /></button>
                            </div>
                            <div className="flex flex-col gap-2">
                              <label className="font-inter text-xs text-white/50 uppercase tracking-widest">Course Thumbnail</label>
                              <div className="flex items-center gap-4">
                                {(courseForm.thumbnailDataUrl || courseForm.thumbnailUrl) && (
                                  <img src={courseForm.thumbnailDataUrl || courseForm.thumbnailUrl} alt="Thumbnail preview" className="h-16 w-24 object-cover border border-white/10" />
                                )}
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const reader = new FileReader();
                                      reader.onload = (event) => {
                                        setCourseForm({ ...courseForm, thumbnailDataUrl: event.target?.result as string });
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  }}
                                  className="w-full text-sm text-white/60 file:mr-4 file:py-2 file:px-4 file:rounded-none file:border-0 file:text-sm file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20 transition cursor-pointer"
                                />
                              </div>
                            </div>
                            <input value={courseForm.title} onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })} placeholder="Name of the course" className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric" />
                            <textarea value={courseForm.description} onChange={(event) => setCourseForm({ ...courseForm, description: event.target.value })} placeholder="Description" rows={5} className="w-full resize-none border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric" />
                            <div className="grid gap-3 sm:grid-cols-2">
                              <input type="number" min="1" value={courseForm.normalPrice} onChange={(event) => setCourseForm({ ...courseForm, normalPrice: event.target.value })} placeholder="Normal price" className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric" />
                              <input type="number" min="1" value={courseForm.offerPrice} onChange={(event) => setCourseForm({ ...courseForm, offerPrice: event.target.value })} placeholder="Offer price" className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric" />
                            </div>
                            <div className="border border-white/10 bg-ink p-4 font-inter text-sm text-white/60">Auto offer: {offerPercent(Number(courseForm.normalPrice), Number(courseForm.offerPrice))}% Off</div>
                            <input value={courseForm.driveUrl} onChange={(event) => setCourseForm({ ...courseForm, driveUrl: event.target.value })} placeholder="Private Google Drive folder URL" className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric" />
                            <div className="flex flex-wrap gap-3 pt-2">
                              <button type="submit" className="bg-electric px-6 py-4 font-inter text-xs font-bold uppercase tracking-widest text-black transition hover:bg-skyline">{courseForm.id ? 'Update Course' : 'Save Course'}</button>
                              <button type="button" onClick={resetCourseForm} className="border border-white/15 px-6 py-4 font-inter text-xs font-bold uppercase tracking-widest text-white transition hover:border-electric">Cancel</button>
                            </div>
                          </form>
                        </div>
                      )}
                      <div className="grid gap-4 min-w-0">
                      {adminCourses.length === 0 ? (
                        <div className="border border-white/10 p-5 font-inter text-sm text-white/55">No courses yet.</div>
                      ) : (
                        adminCourses.map((course) => {
                          const normalPrice = course.normal_price || course.price;
                          const offerPrice = course.offer_price || course.price;
                          return (
                            <article key={course.id} className="smooth-card grid gap-4 border border-white/10 bg-black p-4 sm:grid-cols-[160px_1fr] hover:border-electric/35">
                              <img src={course.thumbnail_url || fallbackCourses[0].thumbnail_url} alt={course.title} className="h-32 w-full object-cover sm:h-full" />
                              <div className="min-w-0">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div>
                                    <h3 className="font-inter text-lg font-bold text-white">{course.title}</h3>
                                    <div className="mt-1 font-inter text-sm text-white/55">{money(offerPrice)} <span className="text-white/35 line-through">{money(normalPrice)}</span> · {offerPercent(normalPrice, offerPrice)}% Off</div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={() => editCourse(course)} className="border border-white/15 p-3 text-white transition hover:border-electric" aria-label="Edit course"><Edit3 className="h-4 w-4" /></button>
                                    <button onClick={() => deleteCourse(course)} className="border border-red-400/40 p-3 text-red-300 transition hover:bg-red-950/30" aria-label="Delete course"><Trash2 className="h-4 w-4" /></button>
                                  </div>
                                </div>
                                <p className="mt-3 font-inter text-sm leading-relaxed text-white/60">{course.description}</p>
                              </div>
                            </article>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
                ) : (
                  <div className="space-y-5">
                    <div className="grid gap-3 lg:grid-cols-[1fr_180px_220px_auto_auto]">
                      <input value={paymentSearch} onChange={(event) => setPaymentSearch(event.target.value)} placeholder="Search name, email, phone, course" className="border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric" />
                      <select value={paymentStatusFilter} onChange={(event) => setPaymentStatusFilter(event.target.value)} className="border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none focus:border-electric">
                        <option value="all">All status</option>
                        <option value="pending">Pending</option>
                        <option value="under_review">Under Review</option>
                        <option value="paid">Paid</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      <select value={paymentCourseFilter} onChange={(event) => setPaymentCourseFilter(event.target.value)} className="border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none focus:border-electric">
                        <option value="all">All courses</option>
                        {adminCourseNames.map((course) => <option key={course}>{course}</option>)}
                      </select>
                      <button onClick={loadAdminOrders} className="inline-flex items-center justify-center gap-2 border border-white/15 px-4 py-3 font-inter text-xs font-bold uppercase tracking-widest text-white transition hover:border-electric">
                        <RefreshCcw className="h-4 w-4" />
                        Refresh
                      </button>
                      <button onClick={downloadOrdersCsv} disabled={filteredOrders.length === 0} className="bg-electric px-4 py-3 font-inter text-xs font-bold uppercase tracking-widest text-black transition hover:bg-skyline disabled:opacity-50">CSV</button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="border border-white/10 bg-black p-4">
                        <div className="font-inter text-xs uppercase tracking-widest text-white/45">Payments</div>
                        <div className="mt-2 font-inter text-3xl font-bold text-white">{filteredOrders.length}</div>
                      </div>
                      <div className="border border-white/10 bg-black p-4">
                        <div className="font-inter text-xs uppercase tracking-widest text-white/45">Paid Amount</div>
                        <div className="mt-2 font-inter text-3xl font-bold text-white">{money(filteredOrders.filter((order) => order.payment_status === 'paid').reduce((total, order) => total + order.final_amount, 0))}</div>
                      </div>
                      <div className="border border-white/10 bg-black p-4">
                        <div className="font-inter text-xs uppercase tracking-widest text-white/45">Pending</div>
                        <div className="mt-2 font-inter text-3xl font-bold text-white">{filteredOrders.filter((order) => order.payment_status === 'pending').length}</div>
                      </div>
                    </div>
                    <div className="overflow-x-auto border border-white/10">
                      <table className="min-w-[1120px] w-full border-collapse bg-black font-inter text-sm">
                        <thead className="bg-white/[0.04] text-left text-xs uppercase tracking-widest text-white/45">
                          <tr>
                            <th className="px-4 py-4">Date</th>
                            <th className="px-4 py-4">Student</th>
                            <th className="px-4 py-4">Contact</th>
                            <th className="px-4 py-4">Experience</th>
                            <th className="px-4 py-4">Course</th>
                            <th className="px-4 py-4">Amount</th>
                            <th className="px-4 py-4">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredOrders.length === 0 ? (
                            <tr><td className="px-4 py-5 text-white/55" colSpan={7}>No payments found.</td></tr>
                          ) : (
                            filteredOrders.map((order) => (
                              <tr key={order.id} className="border-t border-white/10 align-top">
                                <td className="px-4 py-4 text-white/70">
                                  <div>{new Date(order.created_at).toLocaleDateString('en-IN')}</div>
                                  <div className="mt-1 text-xs text-white/40">{new Date(order.created_at).toLocaleTimeString('en-IN')}</div>
                                </td>
                                <td className="px-4 py-4">
                                  <div className="font-semibold text-white">{order.full_name}</div>
                                  <div className="mt-1 max-w-[160px] truncate text-xs text-white/40">{order.id}</div>
                                </td>
                                <td className="px-4 py-4 text-white/70">
                                  <div>{order.email}</div>
                                  <div className="mt-1">{order.phone}</div>
                                </td>
                                <td className="px-4 py-4 text-white/70">{order.trading_experience || '-'}</td>
                                <td className="px-4 py-4 text-white/70">{order.course_name || '-'}</td>
                                <td className="px-4 py-4 font-bold text-white">{money(order.final_amount)}</td>
                                <td className="px-4 py-4">
                                  <select value={order.payment_status} onChange={(event) => updateOrderStatus(order.id, event.target.value)} className="border border-white/10 bg-ink px-3 py-2 font-inter text-xs uppercase tracking-widest text-white outline-none focus:border-electric">
                                    <option value="pending">Pending</option>
                                    <option value="under_review">Under Review</option>
                                    <option value="paid">Paid</option>
                                    <option value="cancelled">Cancelled</option>
                                  </select>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      )}

      {termsOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-4">
          <div className="animate-scale-in max-w-xl border border-white/10 bg-ink p-6 shadow-glow">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-inter text-xs uppercase tracking-[0.3em] text-electric">Terms</div>
                <h3 className="mt-2 font-podium text-3xl uppercase leading-none text-white">Terms and Conditions</h3>
              </div>
              <button onClick={() => setTermsOpen(false)} aria-label="Close terms"><X className="h-6 w-6" /></button>
            </div>
            <div className="mt-5 space-y-3 font-inter text-sm leading-relaxed text-white/70">
              {terms.map((term) => <p key={term}>{term}</p>)}
            </div>
            <button onClick={() => { setJoinForm((current) => ({ ...current, termsAccepted: true })); setTermsOpen(false); }} className="mt-6 w-full bg-electric px-6 py-4 font-inter text-xs font-bold uppercase tracking-widest text-black transition hover:bg-skyline">
              Accept To Join Course
            </button>
          </div>
        </div>
      )}

      {paymentPromptOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-4">
          <div className="animate-scale-in max-w-md border border-white/10 bg-ink p-6 shadow-glow">
            <h3 className="font-podium text-3xl uppercase leading-none text-white">Did you complete the payment?</h3>
            <p className="mt-4 font-inter text-sm leading-relaxed text-white/65">Select yes only after paying {money(selectedOfferPrice)} to {UPI_ID}.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={submitPaymentConfirmation} disabled={submitStatus === 'sending'} className="bg-electric px-6 py-4 font-inter text-xs font-bold uppercase tracking-widest text-black transition hover:bg-skyline disabled:opacity-60">
                {submitStatus === 'sending' ? 'Saving...' : 'Yes'}
              </button>
              {paymentSeconds > 0 ? (
                <button onClick={() => setPaymentPromptOpen(false)} className="border border-white/15 px-6 py-4 font-inter text-xs font-bold uppercase tracking-widest text-white transition hover:border-electric">Wait</button>
              ) : (
                <button onClick={() => { setPaymentPromptOpen(false); setJoinStep('failed'); }} className="border border-red-400/40 px-6 py-4 font-inter text-xs font-bold uppercase tracking-widest text-red-300 transition hover:bg-red-950/30">No</button>
              )}
            </div>
          </div>
        </div>
      )}

      {!adminOpen && (
        <a href="#admin" className="fixed bottom-4 right-4 z-30 flex h-10 w-10 items-center justify-center border border-white/10 bg-black/70 text-electric backdrop-blur transition hover:border-electric" aria-label="Open admin">
          <Crown className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}

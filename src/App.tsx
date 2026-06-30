import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Crown, X } from 'lucide-react';
import { isSupabaseConfigured, supabase } from './lib/supabase';

const navLinks = ['Course', 'About', 'Results', 'FAQ'];

const COURSE_NAME = 'Complete Forex Mastery';
const COURSE_PRICE = 7199;
const UPI_ID = 'harishsankar023@okaxis';

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
  coupon: string;
};

type CompressedImage = {
  name: string;
  type: string;
  dataUrl: string;
  size: number;
};

type Coupon = {
  id: string;
  code: string;
  discount_type: 'fixed' | 'percent';
  discount_value: number;
  active: boolean;
};

type CourseOrder = {
  id: string;
  course_name: string | null;
  full_name: string;
  email: string;
  phone: string;
  coupon_code: string | null;
  original_amount: number;
  discount_amount: number;
  final_amount: number;
  payment_status: string;
  created_at: string;
};

type ManagedCourse = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  drive_url: string | null;
  active: boolean;
  created_at: string;
};

type AdminCouponForm = {
  code: string;
  discountType: 'fixed' | 'percent';
  discountValue: string;
};

type AdminCourseForm = {
  id: string | null;
  title: string;
  description: string;
  price: string;
  driveUrl: string;
};

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    phone: '',
    plan: COURSE_NAME,
    coupon: '',
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [paymentScreenshot, setPaymentScreenshot] = useState<CompressedImage | null>(null);
  const [screenshotStatus, setScreenshotStatus] = useState('');
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [couponStatus, setCouponStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState('');
  const [adminCoupons, setAdminCoupons] = useState<Coupon[]>([]);
  const [adminOrders, setAdminOrders] = useState<CourseOrder[]>([]);
  const [adminCourses, setAdminCourses] = useState<ManagedCourse[]>([]);
  const [adminView, setAdminView] = useState<'orders' | 'coupons' | 'courses'>('orders');
  const [adminForm, setAdminForm] = useState<AdminCouponForm>({
    code: '',
    discountType: 'fixed',
    discountValue: '',
  });
  const [courseForm, setCourseForm] = useState<AdminCourseForm>({
    id: null,
    title: '',
    description: '',
    price: COURSE_PRICE.toString(),
    driveUrl: '',
  });
  const [adminStatus, setAdminStatus] = useState('');

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

  const openCheckout = () => {
    setStatus('idle');
    window.location.hash = 'checkout';
  };

  const closeHashPage = () => {
    window.location.hash = '';
    setAdminOpen(false);
    setCheckoutOpen(false);
  };

  const discountAmount = useMemo(() => {
    if (!coupon) return 0;

    if (coupon.discount_type === 'percent') {
      return Math.min(Math.round((COURSE_PRICE * coupon.discount_value) / 100), COURSE_PRICE);
    }

    return Math.min(coupon.discount_value, COURSE_PRICE);
  }, [coupon]);

  const payableAmount = COURSE_PRICE - discountAmount;

  const statusMessage = useMemo(() => {
    if (status === 'success') return 'Receipt sent. Redirecting to your UPI app.';
    if (status === 'error') return 'Could not submit right now. Check checkout API, Supabase, or mail settings.';
    if (!isSupabaseConfigured) return 'Supabase is not configured yet. Add Vercel env variables before launch.';
    return '';
  }, [status]);

  const applyCoupon = async () => {
    const code = form.coupon.trim().toUpperCase();

    setCoupon(null);
    if (!code) {
      setCouponStatus('idle');
      return;
    }

    if (!supabase) {
      setCouponStatus('invalid');
      return;
    }

    setCouponStatus('checking');
    const { data, error } = await supabase
      .from('coupons')
      .select('id, code, discount_type, discount_value, active')
      .eq('code', code)
      .eq('active', true)
      .maybeSingle();

    if (error || !data) {
      setCouponStatus('invalid');
      return;
    }

    setCoupon(data as Coupon);
    setCouponStatus('valid');
  };

  const buildUpiUrl = (amount: number, orderId: string) => {
    const params = new URLSearchParams({
      pa: UPI_ID,
      pn: 'Trading Boy Academy',
      am: amount.toString(),
      cu: 'INR',
      tn: `${COURSE_NAME} - ${orderId}`,
    });

    return `upi://pay?${params.toString()}`;
  };

  const compressImage = async (file: File): Promise<CompressedImage> => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = reject;
      image.src = objectUrl;
    });

    URL.revokeObjectURL(objectUrl);

    let maxWidth = 1200;
    let quality = 0.82;
    let dataUrl = '';

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const scale = Math.min(1, maxWidth / image.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Could not compress image.');
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      dataUrl = canvas.toDataURL('image/jpeg', quality);

      const estimatedBytes = Math.round((dataUrl.length * 3) / 4);
      if (estimatedBytes <= 100 * 1024) {
        return {
          name: file.name.replace(/\.[^.]+$/, '.jpg'),
          type: 'image/jpeg',
          dataUrl,
          size: estimatedBytes,
        };
      }

      if (quality > 0.42) {
        quality -= 0.1;
      } else {
        maxWidth = Math.round(maxWidth * 0.82);
        quality = 0.62;
      }
    }

    const finalBytes = Math.round((dataUrl.length * 3) / 4);
    if (finalBytes > 100 * 1024) {
      throw new Error('Could not compress below 100KB. Try a clearer cropped screenshot.');
    }

    return {
      name: file.name.replace(/\.[^.]+$/, '.jpg'),
      type: 'image/jpeg',
      dataUrl,
      size: finalBytes,
    };
  };

  const handleScreenshotChange = async (file?: File) => {
    setPaymentScreenshot(null);

    if (!file) {
      setScreenshotStatus('');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setScreenshotStatus('Please upload an image file.');
      return;
    }

    try {
      setScreenshotStatus('Compressing screenshot...');
      const compressed = await compressImage(file);
      setPaymentScreenshot(compressed);
      setScreenshotStatus(`Screenshot ready (${Math.ceil(compressed.size / 1024)}KB).`);
    } catch (error) {
      setScreenshotStatus(error instanceof Error ? error.message : 'Could not compress screenshot.');
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('sending');

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          couponCode: coupon?.code || form.coupon,
          paymentScreenshot,
        }),
      });
      const text = await response.text();
      const result = text ? JSON.parse(text) : {};

      if (!response.ok) {
        setStatus('error');
        return;
      }

      setStatus('success');
      window.location.href = buildUpiUrl(result.payableAmount, result.orderId);
    } catch {
      setStatus('error');
    }
  };

  const loadAdminCoupons = async () => {
    const result = await adminRequest<{ data: Coupon[] }>('coupons');

    setAdminCoupons(result.data || []);
  };

  const loadAdminOrders = async () => {
    const result = await adminRequest<{ data: CourseOrder[] }>('orders');

    setAdminOrders(result.data || []);
  };

  const loadAdminCourses = async () => {
    const result = await adminRequest<{ data: ManagedCourse[] }>('courses');

    setAdminCourses(result.data || []);
  };

  const adminRequest = async <T,>(action: string, payload: Record<string, unknown> = {}): Promise<T> => {
    const response = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, passcode: adminPasscode, ...payload }),
    });
    const text = await response.text();
    const result = text ? JSON.parse(text) : {};

    if (!response.ok) {
      throw new Error(result.error || 'Admin request failed.');
    }

    return result as T;
  };

  const unlockAdmin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setAdminStatus('');
      await loadAdminOrders();
      await loadAdminCoupons();
      await loadAdminCourses();
      setAdminUnlocked(true);
    } catch (error) {
      setAdminStatus(error instanceof Error ? error.message : 'Could not unlock admin.');
    }
  };

  const updateOrderStatus = async (orderId: string, paymentStatus: string) => {
    try {
      await adminRequest('updateOrder', { orderId, paymentStatus });
      await loadAdminOrders();
    } catch (error) {
      setAdminStatus(error instanceof Error ? error.message : 'Could not update payment status.');
    }
  };

  const downloadOrdersCsv = () => {
    const headers = [
      'Order ID',
      'Date',
      'Time',
      'Name',
      'Email',
      'Phone',
      'Course',
      'Coupon',
      'Original Amount',
      'Discount',
      'Final Amount',
      'Payment Status',
    ];

    const rows = adminOrders.map((order) => {
      const date = new Date(order.created_at);

      return [
        order.id,
        date.toLocaleDateString('en-IN'),
        date.toLocaleTimeString('en-IN'),
        order.full_name,
        order.email,
        order.phone,
        order.course_name || COURSE_NAME,
        order.coupon_code || '',
        order.original_amount,
        order.discount_amount,
        order.final_amount,
        order.payment_status,
      ];
    });

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `trading-boy-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const saveCoupon = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const value = Number(adminForm.discountValue);
    if (!adminForm.code.trim() || Number.isNaN(value) || value <= 0) {
      setAdminStatus('Enter a valid coupon code and discount.');
      return;
    }

    try {
      await adminRequest('saveCoupon', {
        code: adminForm.code,
        discountType: adminForm.discountType,
        discountValue: value,
      });
      setAdminForm({ code: '', discountType: 'fixed', discountValue: '' });
      setAdminStatus('Coupon saved.');
      await loadAdminCoupons();
    } catch (error) {
      setAdminStatus(error instanceof Error ? error.message : 'Could not save coupon.');
    }
  };

  const toggleCoupon = async (couponItem: Coupon) => {
    try {
      await adminRequest('toggleCoupon', { couponId: couponItem.id, active: !couponItem.active });
      await loadAdminCoupons();
    } catch (error) {
      setAdminStatus(error instanceof Error ? error.message : 'Could not update coupon.');
    }
  };

  const saveCourse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const price = Number(courseForm.price);
    if (!courseForm.title.trim() || Number.isNaN(price) || price <= 0) {
      setAdminStatus('Enter a valid course title and price.');
      return;
    }

    try {
      await adminRequest('saveCourse', {
        id: courseForm.id,
        title: courseForm.title,
        description: courseForm.description,
        price,
        driveUrl: courseForm.driveUrl,
      });
      setCourseForm({ id: null, title: '', description: '', price: COURSE_PRICE.toString(), driveUrl: '' });
      setAdminStatus('Course saved.');
      await loadAdminCourses();
    } catch (error) {
      setAdminStatus(error instanceof Error ? error.message : 'Could not save course.');
    }
  };

  const editCourse = (courseItem: ManagedCourse) => {
    setCourseForm({
      id: courseItem.id,
      title: courseItem.title,
      description: courseItem.description || '',
      price: courseItem.price.toString(),
      driveUrl: courseItem.drive_url || '',
    });
    setAdminStatus('');
  };

  const toggleCourse = async (courseItem: ManagedCourse) => {
    try {
      await adminRequest('toggleCourse', { courseId: courseItem.id, active: !courseItem.active });
      await loadAdminCourses();
    } catch (error) {
      setAdminStatus(error instanceof Error ? error.message : 'Could not update course.');
    }
  };

  const deleteCourse = async (courseItem: ManagedCourse) => {
    if (!window.confirm(`Delete "${courseItem.title}"? This cannot be undone.`)) {
      return;
    }

    try {
      await adminRequest('deleteCourse', { courseId: courseItem.id });
      if (courseForm.id === courseItem.id) {
        setCourseForm({ id: null, title: '', description: '', price: COURSE_PRICE.toString(), driveUrl: '' });
      }
      setAdminStatus('Course deleted.');
      await loadAdminCourses();
    } catch (error) {
      setAdminStatus(error instanceof Error ? error.message : 'Could not delete course.');
    }
  };

  return (
    <div className="min-h-screen bg-ink text-white">
      <header
        className={`fixed inset-x-0 top-0 z-40 px-5 py-3 transition-all duration-500 sm:px-8 lg:px-12 lg:py-4 ${
          hasScrolled
            ? 'border-b border-white/10 bg-ink/90 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl'
            : 'border-b border-transparent bg-transparent'
        }`}
      >
        <nav className="flex items-center justify-between">
          <a href="#home" className="flex items-center gap-2.5" aria-label="Trading Boy home">
            <span className="relative block h-7 w-7 border-b-[5px] border-l-[5px] border-electric">
              <span className="absolute -right-0.5 top-0 h-5 w-[5px] rotate-[-28deg] bg-electric" />
            </span>
            <span className="font-podium text-xl font-bold uppercase tracking-wider text-white sm:text-2xl">
              Trading Boy
            </span>
          </a>

          <div className="hidden items-center gap-7 md:flex lg:gap-10">
            {navLinks.map((link) => (
              <a
                key={link}
                href={`#${link.toLowerCase()}`}
                className="font-inter text-xs uppercase tracking-widest text-white/80 transition hover:text-white"
              >
                {link}
              </a>
            ))}
          </div>

          <button
            onClick={openCheckout}
            className="group hidden items-center gap-2 border border-white/30 px-4 py-2.5 font-inter text-[11px] uppercase tracking-widest text-white transition hover:border-electric hover:bg-white/10 md:flex"
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
        <div className="flex items-center justify-between px-5 py-4 sm:px-8">
          <span className="font-podium text-xl font-bold uppercase tracking-wider text-white sm:text-2xl">
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
              openCheckout();
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

      {!checkoutOpen && !adminOpen && (
      <main>
        <section id="home" className="relative min-h-screen overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1642790106117-e829e14a795f?auto=format&fit=crop&w=2200&q=90"
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
                  onClick={openCheckout}
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
              <div className="mt-8 border border-electric/40 bg-black p-6 shadow-glow">
                <div className="font-inter text-xs uppercase tracking-[0.3em] text-electric">Course Price</div>
                <div className="mt-3 font-inter text-4xl font-bold text-white">Rs. {COURSE_PRICE.toLocaleString('en-IN')}</div>
                <p className="mt-3 font-inter text-sm leading-relaxed text-white/60">
                  Includes structured lessons, strategy breakdowns, risk training, and live-market learning.
                </p>
                <button
                  onClick={openCheckout}
                  className="group mt-6 bg-electric px-6 py-4 font-inter text-xs font-bold uppercase tracking-widest text-black transition hover:bg-skyline"
                >
                  Pay Now
                  <ArrowUpRight className="ml-2 inline h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </button>
              </div>
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
                onClick={openCheckout}
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
      )}

      {!checkoutOpen && !adminOpen && (
      <footer className="border-t border-white/10 bg-ink px-6 py-8 sm:px-10 lg:px-16">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 font-inter text-xs uppercase tracking-widest text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <span>Trading Boy Academy</span>
          <span>Forex education. Risk-first training.</span>
        </div>
      </footer>
      )}

      {checkoutOpen && (
      <main className="min-h-screen bg-ink px-4 pb-16 pt-28 sm:px-8 lg:px-12">
        <div className="mx-auto w-full max-w-2xl border border-white/10 bg-black p-6 shadow-glow sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <div className="font-inter text-xs uppercase tracking-[0.3em] text-electric">Enroll Now</div>
              <h2 className="mt-2 font-podium text-3xl uppercase leading-none text-white sm:text-4xl">
                Buy the course
              </h2>
              <p className="mt-2 font-inter text-sm text-white/60">Payable amount: Rs. {payableAmount.toLocaleString('en-IN')}</p>
            </div>
            <button onClick={closeHashPage} aria-label="Close checkout page">
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
              <option>{COURSE_NAME}</option>
            </select>

            <div>
              <label className="mb-2 block font-inter text-xs uppercase tracking-widest text-white/45">
                Payment screenshot
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => handleScreenshotChange(event.target.files?.[0])}
                className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white file:mr-4 file:border-0 file:bg-electric file:px-4 file:py-2 file:font-inter file:text-xs file:font-bold file:uppercase file:tracking-widest file:text-black"
              />
              {screenshotStatus && <p className="mt-2 font-inter text-sm text-white/55">{screenshotStatus}</p>}
            </div>

            <div className="flex gap-3">
              <input
                value={form.coupon}
                onChange={(event) => {
                  setForm({ ...form, coupon: event.target.value });
                  setCoupon(null);
                  setCouponStatus('idle');
                }}
                placeholder="Coupon code"
                className="min-w-0 flex-1 border border-white/10 bg-black px-4 py-3 font-inter text-sm uppercase text-white outline-none transition placeholder:normal-case placeholder:text-white/35 focus:border-electric"
              />
              <button
                type="button"
                onClick={applyCoupon}
                disabled={couponStatus === 'checking'}
                className="border border-electric px-4 py-3 font-inter text-xs font-bold uppercase tracking-widest text-white transition hover:bg-electric hover:text-black disabled:opacity-60"
              >
                {couponStatus === 'checking' ? 'Checking' : 'Apply'}
              </button>
            </div>

            {couponStatus === 'valid' && coupon && (
              <p className="font-inter text-sm text-electric">
                Coupon {coupon.code} applied. You saved Rs. {discountAmount.toLocaleString('en-IN')}.
              </p>
            )}

            {couponStatus === 'invalid' && (
              <p className="font-inter text-sm text-red-300">Invalid or inactive coupon code.</p>
            )}

            <div className="space-y-2 border border-white/10 bg-black p-4 font-inter text-sm">
              <div className="flex justify-between text-white/60">
                <span>Course price</span>
                <span>Rs. {COURSE_PRICE.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-white/60">
                <span>Discount</span>
                <span>- Rs. {discountAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-3 text-base font-bold text-white">
                <span>Total</span>
                <span>Rs. {payableAmount.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {statusMessage && (
              <p className={`font-inter text-sm ${status === 'success' ? 'text-electric' : 'text-white/55'}`}>
                {statusMessage}
              </p>
            )}

            <button
              disabled={status === 'sending'}
              className="group w-full bg-electric px-6 py-4 font-inter text-xs font-bold uppercase tracking-widest text-black transition hover:bg-skyline disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === 'sending' ? 'Redirecting...' : 'Pay Now With UPI'}
              <ArrowUpRight className="ml-2 inline h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </button>
          </form>
        </div>
      </main>
      )}

      {adminOpen && (
      <main className="min-h-screen bg-black px-4 pb-16 pt-28 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl bg-ink p-6 shadow-glow sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <div className="font-inter text-xs uppercase tracking-[0.3em] text-electric">Admin Panel</div>
              <h2 className="mt-2 font-podium text-3xl uppercase leading-none text-white sm:text-4xl">
                Course Admin
              </h2>
            </div>
            <button
              onClick={closeHashPage}
              aria-label="Close admin panel"
            >
              <X className="h-7 w-7 text-white" />
            </button>
          </div>

          {!adminUnlocked ? (
            <form onSubmit={unlockAdmin} className="max-w-md space-y-4">
              <input
                type="password"
                value={adminPasscode}
                onChange={(event) => setAdminPasscode(event.target.value)}
                placeholder="Admin passcode"
                className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric"
              />
              <button className="bg-electric px-6 py-4 font-inter text-xs font-bold uppercase tracking-widest text-black transition hover:bg-skyline">
                Unlock Admin
              </button>
            </form>
          ) : (
            <div>
              <div className="mb-6 flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => setAdminView('orders')}
                    className={`px-4 py-3 font-inter text-xs font-bold uppercase tracking-widest transition ${
                      adminView === 'orders' ? 'bg-electric text-black' : 'border border-white/15 text-white'
                    }`}
                  >
                    Purchases
                  </button>
                  <button
                    onClick={() => setAdminView('coupons')}
                    className={`px-4 py-3 font-inter text-xs font-bold uppercase tracking-widest transition ${
                      adminView === 'coupons' ? 'bg-electric text-black' : 'border border-white/15 text-white'
                    }`}
                  >
                    Coupons
                  </button>
                  <button
                    onClick={() => setAdminView('courses')}
                    className={`px-4 py-3 font-inter text-xs font-bold uppercase tracking-widest transition ${
                      adminView === 'courses' ? 'bg-electric text-black' : 'border border-white/15 text-white'
                    }`}
                  >
                    Courses
                  </button>
                </div>

                {adminView === 'orders' && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={loadAdminOrders}
                      className="border border-white/15 px-4 py-3 font-inter text-xs font-bold uppercase tracking-widest text-white transition hover:border-electric"
                    >
                      Refresh
                    </button>
                    <button
                      onClick={downloadOrdersCsv}
                      disabled={adminOrders.length === 0}
                      className="bg-electric px-4 py-3 font-inter text-xs font-bold uppercase tracking-widest text-black transition hover:bg-skyline disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Download CSV
                    </button>
                  </div>
                )}
              </div>

              {adminView === 'orders' ? (
                <div className="space-y-4">
                  <div className="border border-electric/30 bg-electric/10 p-4 font-inter text-sm leading-relaxed text-white/75">
                    Before changing an order to <strong className="text-white">paid</strong>, manually share the private
                    Google Drive course folder with the student's email shown below. When you save the paid status, the
                    student receives the course access email with the Drive link.
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="border border-white/10 bg-black p-4">
                      <div className="font-inter text-xs uppercase tracking-widest text-white/45">Orders</div>
                      <div className="mt-2 font-inter text-3xl font-bold text-white">{adminOrders.length}</div>
                    </div>
                    <div className="border border-white/10 bg-black p-4">
                      <div className="font-inter text-xs uppercase tracking-widest text-white/45">Gross Amount</div>
                      <div className="mt-2 font-inter text-3xl font-bold text-white">
                        Rs.{' '}
                        {adminOrders
                          .reduce((total, order) => total + order.final_amount, 0)
                          .toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="border border-white/10 bg-black p-4">
                      <div className="font-inter text-xs uppercase tracking-widest text-white/45">Pending</div>
                      <div className="mt-2 font-inter text-3xl font-bold text-white">
                        {adminOrders.filter((order) => order.payment_status === 'pending').length}
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-white/10">
                    <table className="min-w-[1050px] w-full border-collapse bg-black font-inter text-sm">
                      <thead className="bg-white/[0.04] text-left text-xs uppercase tracking-widest text-white/45">
                        <tr>
                          <th className="px-4 py-4">Date / Time</th>
                          <th className="px-4 py-4">Student</th>
                          <th className="px-4 py-4">Contact</th>
                          <th className="px-4 py-4">Coupon</th>
                          <th className="px-4 py-4">Amount</th>
                          <th className="px-4 py-4">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminOrders.length === 0 ? (
                          <tr>
                            <td className="px-4 py-5 text-white/55" colSpan={6}>
                              No purchases yet.
                            </td>
                          </tr>
                        ) : (
                          adminOrders.map((order) => {
                            const createdAt = new Date(order.created_at);

                            return (
                              <tr key={order.id} className="border-t border-white/10 align-top">
                                <td className="px-4 py-4 text-white/70">
                                  <div>{createdAt.toLocaleDateString('en-IN')}</div>
                                  <div className="mt-1 text-xs text-white/40">
                                    {createdAt.toLocaleTimeString('en-IN')}
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <div className="font-semibold text-white">{order.full_name}</div>
                                  <div className="mt-1 max-w-[160px] truncate text-xs text-white/40">{order.id}</div>
                                </td>
                                <td className="px-4 py-4 text-white/70">
                                  <div>{order.email}</div>
                                  <div className="mt-1">{order.phone}</div>
                                </td>
                                <td className="px-4 py-4 text-white/70">
                                  <div>{order.coupon_code || '-'}</div>
                                  <div className="mt-1 text-xs text-white/40">
                                    Saved Rs. {order.discount_amount.toLocaleString('en-IN')}
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-white">
                                  <div className="font-bold">Rs. {order.final_amount.toLocaleString('en-IN')}</div>
                                  <div className="mt-1 text-xs text-white/40">
                                    Base Rs. {order.original_amount.toLocaleString('en-IN')}
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <select
                                    value={order.payment_status}
                                    onChange={(event) => updateOrderStatus(order.id, event.target.value)}
                                    className="border border-white/10 bg-ink px-3 py-2 font-inter text-xs uppercase tracking-widest text-white outline-none focus:border-electric"
                                  >
                                    <option value="pending">Pending</option>
                                    <option value="under_review">Under Review</option>
                                    <option value="paid">Paid</option>
                                    <option value="cancelled">Cancelled</option>
                                  </select>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : adminView === 'coupons' ? (
                <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
                  <form onSubmit={saveCoupon} className="space-y-4">
                    <input
                      value={adminForm.code}
                      onChange={(event) => setAdminForm({ ...adminForm, code: event.target.value })}
                      placeholder="Coupon code"
                      className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm uppercase text-white outline-none transition placeholder:normal-case placeholder:text-white/35 focus:border-electric"
                    />
                    <select
                      value={adminForm.discountType}
                      onChange={(event) =>
                        setAdminForm({ ...adminForm, discountType: event.target.value as 'fixed' | 'percent' })
                      }
                      className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition focus:border-electric"
                    >
                      <option value="fixed">Fixed amount discount</option>
                      <option value="percent">Percentage discount</option>
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={adminForm.discountValue}
                      onChange={(event) => setAdminForm({ ...adminForm, discountValue: event.target.value })}
                      placeholder={adminForm.discountType === 'fixed' ? 'Discount amount in Rs.' : 'Discount percentage'}
                      className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric"
                    />
                    <button className="w-full bg-electric px-6 py-4 font-inter text-xs font-bold uppercase tracking-widest text-black transition hover:bg-skyline">
                      Save Coupon
                    </button>
                  </form>

                  <div className="space-y-3">
                    {adminCoupons.length === 0 ? (
                      <div className="border border-white/10 p-5 font-inter text-sm text-white/55">No coupons yet.</div>
                    ) : (
                      adminCoupons.map((couponItem) => (
                        <div
                          key={couponItem.id}
                          className="flex flex-col gap-4 border border-white/10 bg-black p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <div className="font-inter text-lg font-bold text-white">{couponItem.code}</div>
                            <div className="font-inter text-sm text-white/55">
                              {couponItem.discount_type === 'percent'
                                ? `${couponItem.discount_value}% off`
                                : `Rs. ${couponItem.discount_value.toLocaleString('en-IN')} off`}
                            </div>
                          </div>
                          <button
                            onClick={() => toggleCoupon(couponItem)}
                            className={`px-4 py-3 font-inter text-xs font-bold uppercase tracking-widest transition ${
                              couponItem.active
                                ? 'border border-white/20 text-white hover:border-red-300 hover:text-red-300'
                                : 'bg-electric text-black hover:bg-skyline'
                            }`}
                          >
                            {couponItem.active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
                  <form onSubmit={saveCourse} className="space-y-4">
                    <div className="font-inter text-xs uppercase tracking-[0.3em] text-electric">
                      {courseForm.id ? 'Edit Course' : 'Create Course'}
                    </div>
                    <input
                      value={courseForm.title}
                      onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })}
                      placeholder="Course title"
                      className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric"
                    />
                    <textarea
                      value={courseForm.description}
                      onChange={(event) => setCourseForm({ ...courseForm, description: event.target.value })}
                      placeholder="Course description"
                      rows={4}
                      className="w-full resize-none border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric"
                    />
                    <input
                      type="number"
                      min="1"
                      value={courseForm.price}
                      onChange={(event) => setCourseForm({ ...courseForm, price: event.target.value })}
                      placeholder="Price in Rs."
                      className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric"
                    />
                    <input
                      value={courseForm.driveUrl}
                      onChange={(event) => setCourseForm({ ...courseForm, driveUrl: event.target.value })}
                      placeholder="Private Google Drive folder URL"
                      className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric"
                    />
                    <div className="flex flex-wrap gap-3">
                      <button className="bg-electric px-6 py-4 font-inter text-xs font-bold uppercase tracking-widest text-black transition hover:bg-skyline">
                        {courseForm.id ? 'Update Course' : 'Save Course'}
                      </button>
                      {courseForm.id && (
                        <button
                          type="button"
                          onClick={() =>
                            setCourseForm({
                              id: null,
                              title: '',
                              description: '',
                              price: COURSE_PRICE.toString(),
                              driveUrl: '',
                            })
                          }
                          className="border border-white/15 px-6 py-4 font-inter text-xs font-bold uppercase tracking-widest text-white transition hover:border-electric"
                        >
                          Cancel Edit
                        </button>
                      )}
                    </div>
                  </form>

                  <div className="space-y-3">
                    {adminCourses.length === 0 ? (
                      <div className="border border-white/10 p-5 font-inter text-sm text-white/55">
                        No courses yet.
                      </div>
                    ) : (
                      adminCourses.map((courseItem) => (
                        <div key={courseItem.id} className="border border-white/10 bg-black p-5">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="font-inter text-lg font-bold text-white">{courseItem.title}</div>
                              <div className="mt-1 font-inter text-sm text-white/55">
                                Rs. {courseItem.price.toLocaleString('en-IN')} ·{' '}
                                {courseItem.active ? 'Active' : 'Inactive'}
                              </div>
                              {courseItem.description && (
                                <p className="mt-3 font-inter text-sm leading-relaxed text-white/60">
                                  {courseItem.description}
                                </p>
                              )}
                              {courseItem.drive_url && (
                                <a
                                  href={courseItem.drive_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-3 block truncate font-inter text-sm text-electric"
                                >
                                  {courseItem.drive_url}
                                </a>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => editCourse(courseItem)}
                                className="border border-white/15 px-4 py-3 font-inter text-xs font-bold uppercase tracking-widest text-white transition hover:border-electric"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => toggleCourse(courseItem)}
                                className={`px-4 py-3 font-inter text-xs font-bold uppercase tracking-widest transition ${
                                  courseItem.active
                                    ? 'border border-white/20 text-white hover:border-red-300 hover:text-red-300'
                                    : 'bg-electric text-black hover:bg-skyline'
                                }`}
                              >
                                {courseItem.active ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => deleteCourse(courseItem)}
                                className="border border-red-300/50 px-4 py-3 font-inter text-xs font-bold uppercase tracking-widest text-red-200 transition hover:bg-red-300 hover:text-black"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {adminStatus && <p className="mt-5 font-inter text-sm text-white/60">{adminStatus}</p>}
        </div>
      </main>
      )}
    </div>
  );
}

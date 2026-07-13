import { FormEvent, useEffect, useMemo, useState, useCallback } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpen, CheckCircle, Copy, CreditCard, Edit3, Loader2, LogOut, Mail, MessageSquareQuote, Plus, RefreshCcw, Send, Smartphone, Ticket, Trash2, Upload, X } from 'lucide-react';
import { supabase } from './lib/supabase';
import logoUrl from './assets/logo.png';
import aboutImageUrl from './assets/About us.png';
import forexMasteryThumbnail from './assets/course-forex-mastery.png';
import fundedTraderThumbnail from './assets/course-funded-trader.png';
import useEmblaCarousel from 'embla-carousel-react';
import AutoScroll from 'embla-carousel-auto-scroll';

const UPI_ID = 'harishsankar023@okaxis';
const DEFAULT_COURSE = 'Complete Forex Mastery';
const PROMO_COUPON_CODE = 'SAVE1000';

const fallbackCourses = [
  {
    id: 'complete-forex-mastery',
    title: DEFAULT_COURSE,
    description: 'A structured forex trading course covering market structure, risk management, and live execution.',
    thumbnail_url: 'https://images.unsplash.com/photo-1642790106117-e829e14a795f?auto=format&fit=crop&w=1200&q=85',
    normal_price: 7199,
    offer_price: 7199,
    price: 7199,
    drive_url: null,
    discord_url: null,
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
    discord_url: null,
    active: true,
    created_at: '',
  },
];

const navLinks = ['Home', 'About', 'Course', 'Results', 'FAQ'];

const fallbackTestimonials = [
  {
    id: 't1',
    quote: 'The course finally made price action feel structured. My biggest win was learning when not to trade.',
    name: 'Arjun M.',
    role: 'Funded account trader',
    active: true,
    created_at: '',
  },
  {
    id: 't2',
    quote: 'The live breakdowns helped me stop chasing signals and start building a repeatable execution plan.',
    name: 'Priya S.',
    role: 'Forex swing trader',
    active: true,
    created_at: '',
  },
  {
    id: 't3',
    quote: 'Clear lessons, practical homework, and honest feedback. It feels built for serious beginners.',
    name: 'Daniel R.',
    role: 'Part-time trader',
    active: true,
    created_at: '',
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
  discord_url: string | null;
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
  remarks: string;
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
  payment_screenshot_path?: string | null;
  remarks?: string | null;
  created_at: string;
};

type Testimonial = {
  id: string;
  quote: string;
  name: string;
  role: string;
  photo_url?: string | null;
  active: boolean;
  created_at: string;
};

type AdminTestimonialForm = {
  id: string | null;
  quote: string;
  name: string;
  role: string;
  photoUrl: string;
  photoDataUrl?: string;
  active: boolean;
};

type Coupon = {
  id: string;
  code: string;
  course_name: string | null;
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
  courseName: string;
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
  discordUrl: string;
};

const money = (amount: number) => `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`;

const offerPercent = (normalPrice?: number | null, offerPrice?: number | null) => {
  if (!normalPrice || !offerPrice || normalPrice <= offerPrice) return 0;
  return Math.round(((normalPrice - offerPrice) / normalPrice) * 100);
};

const courseThumbnail = (course: Pick<PublicCourse, 'title' | 'thumbnail_url'>) => {
  const title = course.title.toLowerCase();
  if (title.includes('funded')) return fundedTraderThumbnail;
  if (title.includes('forex')) return forexMasteryThumbnail;
  return course.thumbnail_url || fallbackCourses[0].thumbnail_url;
};

function TestimonialCarousel({ testimonials, direction = 'forward', onSelect }: { testimonials: Testimonial[], direction?: 'forward' | 'backward', onSelect: (t: Testimonial) => void }) {
  const [emblaRef] = useEmblaCarousel({ loop: true, dragFree: true }, [
    AutoScroll({ playOnInit: true, direction, speed: 1, stopOnInteraction: false, stopOnMouseEnter: true })
  ]);

  return (
    <div className="overflow-hidden w-full cursor-grab active:cursor-grabbing" ref={emblaRef}>
      <div className="flex gap-6 px-6 py-2">
        {testimonials.map((item, i) => (
          <article key={`${direction}-${item.name}-${i}`} onClick={() => onSelect(item)} className="max-md:snap-center smooth-card w-[260px] sm:w-[320px] shrink-0 border border-white/10 bg-white/[0.03] p-5 hover:border-electric/35 cursor-pointer ml-6 first:ml-0">
            <div className="mb-4 flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-black">
                <div className="flex h-full w-full items-center justify-center bg-electric/10 font-podium text-lg text-electric uppercase">{item.name.charAt(0)}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-inter text-sm font-semibold text-white truncate">{item.name}</div>
                <div className="font-inter text-[10px] uppercase tracking-widest text-electric truncate">{item.role}</div>
              </div>
            </div>
            <p className="font-inter text-sm leading-relaxed text-white/75 line-clamp-3">"{item.quote}"</p>
            {item.photo_url && (
              <div className="mt-4 overflow-hidden rounded-lg border border-white/10 aspect-video pointer-events-none">
                <img src={item.photo_url} alt="Trading result" className="w-full h-full object-cover hover:scale-105 transition duration-500 pointer-events-none" />
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCopied, setPromoCopied] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [courseDetailsOpen, setCourseDetailsOpen] = useState<PublicCourse | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [publicCourses, setPublicCourses] = useState<PublicCourse[]>(fallbackCourses);
  const [testimonials, setTestimonials] = useState<Testimonial[]>(fallbackTestimonials);
  const [joinStep, setJoinStep] = useState<'details' | 'payment' | 'proof' | 'thanks' | 'failed'>('details');
  const [formErrors, setFormErrors] = useState<{name?: string; email?: string; phone?: string; tradingExperience?: string}>({});
  const [joinForm, setJoinForm] = useState<JoinForm>({
    name: '',
    email: '',
    phone: '',
    tradingExperience: '',
    courseName: DEFAULT_COURSE,
    termsAccepted: false,
    remarks: '',
  });
  const [termsOpen, setTermsOpen] = useState(false);
  const [paymentSeconds, setPaymentSeconds] = useState(180);
  const [paymentPromptOpen, setPaymentPromptOpen] = useState(false);
  const [promptedAt, setPromptedAt] = useState<number[]>([]);
  const [paymentScreenshot, setPaymentScreenshot] = useState<{ dataUrl: string; name: string } | null>(null);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'sending' | 'error'>('idle');
  const [createdOrderId, setCreatedOrderId] = useState('');
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState('');
  const [adminSection, setAdminSection] = useState<'home' | 'courses' | 'payments' | 'coupons' | 'testimonials' | 'emails'>('home');
  const [adminStatus, setAdminStatus] = useState('');
  const [adminCourses, setAdminCourses] = useState<PublicCourse[]>([]);
  const [adminOrders, setAdminOrders] = useState<CourseOrder[]>([]);
  const [adminCoupons, setAdminCoupons] = useState<Coupon[]>([]);
  const [adminTestimonials, setAdminTestimonials] = useState<Testimonial[]>([]);
  const [couponForm, setCouponForm] = useState<AdminCouponForm>({
    id: null,
    code: '',
    courseName: '',
    discountType: 'percent',
    discountValue: '',
    expiresAt: '',
    maxUses: '',
  });
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [showCouponForm, setShowCouponForm] = useState(false);
  const [showTestimonialForm, setShowTestimonialForm] = useState(false);
  const [testimonialForm, setTestimonialForm] = useState<AdminTestimonialForm>({
    id: null,
    quote: '',
    name: '',
    role: '',
    photoUrl: '',
    active: true,
  });
  const [savingTestimonial, setSavingTestimonial] = useState(false);
  const [selectedTestimonial, setSelectedTestimonial] = useState<Testimonial | null>(null);
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [paymentCourseFilter, setPaymentCourseFilter] = useState('all');
  const [paymentDateFilter, setPaymentDateFilter] = useState<'all' | 'today' | 'custom'>('all');
  const [paymentCustomDate, setPaymentCustomDate] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [updatingOrderId, setUpdatingOrderId] = useState('');
  const [deletingOrders, setDeletingOrders] = useState(false);
  const [campaignAudience, setCampaignAudience] = useState<'paid' | 'all' | 'manual'>('paid');
  const [campaignCourse, setCampaignCourse] = useState('all');
  const [campaignManualEmails, setCampaignManualEmails] = useState('');
  const [campaignSubject, setCampaignSubject] = useState('');
  const [campaignMessage, setCampaignMessage] = useState('');
  const [sendingCampaign, setSendingCampaign] = useState(false);
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
    discordUrl: '',
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

  const getUpiUrl = useCallback((app: 'gpay' | 'phonepe' | 'paytm' | 'generic') => {
    const params = new URLSearchParams({
      pa: UPI_ID,
      pn: 'Trading Boy Academy',
      am: selectedOfferPrice.toString(),
      cu: 'INR',
      tn: selectedCourse.title,
    });
    const query = params.toString();
    switch (app) {
      case 'gpay': return `tez://upi/pay?${query}`;
      case 'phonepe': return `phonepe://pay?${query}`;
      case 'paytm': return `paytmmp://pay?${query}`;
      case 'generic':
      default: return `upi://pay?${query}`;
    }
  }, [selectedCourse.title, selectedOfferPrice]);
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(getUpiUrl('generic'))}`;

  const filteredOrders = useMemo(() => {
    const query = paymentSearch.trim().toLowerCase();
    const today = new Date();
    const localDateKey = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    const todayKey = localDateKey(today);
    return adminOrders.filter((order) => {
      const matchesStatus = paymentStatusFilter === 'all' || order.payment_status === paymentStatusFilter;
      const matchesCourse = paymentCourseFilter === 'all' || order.course_name === paymentCourseFilter;
      const orderDateKey = localDateKey(new Date(order.created_at));
      const matchesDate = paymentDateFilter === 'all' || (paymentDateFilter === 'today' ? orderDateKey === todayKey : !paymentCustomDate || orderDateKey === paymentCustomDate);
      const matchesSearch =
        !query ||
        [order.full_name, order.email, order.phone, order.course_name || '', order.trading_experience || '']
          .join(' ')
          .toLowerCase()
          .includes(query);
      return matchesStatus && matchesCourse && matchesDate && matchesSearch;
    });
  }, [adminOrders, paymentCourseFilter, paymentCustomDate, paymentDateFilter, paymentSearch, paymentStatusFilter]);

  const adminCourseNames = useMemo(
    () => Array.from(new Set(adminCourses.map((course) => course.title).filter(Boolean))),
    [adminCourses],
  );

  const campaignRecipientCount = useMemo(() => {
    const emails = new Set<string>();
    if (campaignAudience !== 'manual') {
      adminOrders
        .filter((order) => campaignAudience === 'all' || order.payment_status === 'paid')
        .filter((order) => campaignCourse === 'all' || order.course_name === campaignCourse)
        .map((order) => order.email.trim().toLowerCase())
        .filter(Boolean)
        .forEach((email) => emails.add(email));
    }
    campaignManualEmails
      .split(/[\s,;]+/)
      .map((email) => email.trim().toLowerCase())
      .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      .forEach((email) => emails.add(email));
    return emails.size;
  }, [adminOrders, campaignAudience, campaignCourse, campaignManualEmails]);

  useEffect(() => {
    const handleScroll = () => setHasScrolled(window.scrollY > 24);
    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setPromoOpen(true), 5000);
    return () => window.clearTimeout(timer);
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
        .select('id, title, description, thumbnail_url, normal_price, offer_price, price, active, created_at')
        .eq('active', true)
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        setPublicCourses(data as PublicCourse[]);
        setJoinForm((current) => ({
          ...current,
          courseName: data.some((course) => course.title === current.courseName) ? current.courseName : data[0].title,
        }));
      }

      const { data: testimonialsData, error: tError } = await supabase
        .from('testimonials')
        .select('id, quote, name, role, photo_url, active, created_at')
        .eq('active', true)
        .order('created_at', { ascending: true });
        
      if (!tError && testimonialsData && testimonialsData.length > 0) {
        setTestimonials(testimonialsData as Testimonial[]);
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
    if (!courseDetailsOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [courseDetailsOpen]);

  useEffect(() => {
    if (paymentCourseFilter !== 'all' && !adminCourseNames.includes(paymentCourseFilter)) {
      setPaymentCourseFilter('all');
    }
  }, [adminCourseNames, paymentCourseFilter]);

  useEffect(() => {
    if (joinStep !== 'payment') return;
    const elapsed = 180 - paymentSeconds;
    const promptTimes = [30, 60, 90, 120, 150, 180];
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
    history.pushState(null, '', window.location.pathname + window.location.search);
    setAdminOpen(false);
    setCheckoutOpen(false);
  };

  const beginPayment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    const errors: {name?: string; email?: string; phone?: string; tradingExperience?: string} = {};
    if (!joinForm.name.trim() || joinForm.name.trim().length < 2) {
      errors.name = 'Please enter a valid full name.';
    }
    if (!/^\S+@\S+\.\S+$/.test(joinForm.email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }
    const phoneDigits = joinForm.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      errors.phone = 'Please enter a valid phone number (at least 10 digits).';
    }
    if (!joinForm.tradingExperience) {
      errors.tradingExperience = 'Please select your trading experience.';
    }
    
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    if (!joinForm.termsAccepted) {
      setTermsOpen(true);
      return;
    }
    
    if (selectedOfferPrice === 0) {
      submitPaymentConfirmation();
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
        body: JSON.stringify({ couponCode: couponInput, courseName: selectedCourse.title }),
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

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let quality = 0.8;
        let scale = 1;
        let dataUrl = '';
        const MAX = 800;
        
        let width = img.width;
        let height = img.height;
        if (width > height && width > MAX) {
          height *= MAX / width;
          width = MAX;
        } else if (height > MAX) {
          width *= MAX / height;
          height = MAX;
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        do {
          canvas.width = width * scale;
          canvas.height = height * scale;
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          dataUrl = canvas.toDataURL('image/jpeg', quality);
          
          if (quality > 0.3) {
            quality -= 0.15;
          } else {
            scale -= 0.2;
          }
        } while (dataUrl.length * 0.75 > 90000 && scale > 0.1);

        setPaymentScreenshot({ dataUrl, name: file.name });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
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
          remarks: joinForm.remarks,
          paymentScreenshot,
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

  const loadAdminTestimonials = async () => {
    const result = await adminRequest<{ data: Testimonial[] }>('testimonials');
    setAdminTestimonials(result.data || []);
  };

  const unlockAdmin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (adminLoading) return;
    try {
      setAdminLoading(true);
      setAdminStatus('');
      await loadAdminCourses();
      await loadAdminOrders();
      await loadAdminCoupons();
      await loadAdminTestimonials();
      setAdminUnlocked(true);
    } catch (error) {
      setAdminStatus(error instanceof Error ? error.message : 'Could not unlock admin.');
    } finally {
      setAdminLoading(false);
    }
  };

  const logoutAdmin = () => {
    setAdminUnlocked(false);
    setAdminPasscode('');
    setAdminSection('home');
    setAdminStatus('');
    setAdminCourses([]);
    setAdminOrders([]);
    setAdminCoupons([]);
    setAdminTestimonials([]);
    setPaymentSearch('');
    setPaymentStatusFilter('all');
    setPaymentCourseFilter('all');
    setPaymentDateFilter('all');
    setPaymentCustomDate('');
    setSelectedOrderIds([]);
  };

  const resetCourseForm = () => {
    setCourseForm({ id: null, title: '', description: '', thumbnailUrl: '', thumbnailDataUrl: undefined, normalPrice: '', offerPrice: '', driveUrl: '', discordUrl: '' });
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
        discordUrl: courseForm.discordUrl,
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
      discordUrl: course.discord_url || '',
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

  const resetTestimonialForm = () => {
    setTestimonialForm({ id: null, quote: '', name: '', role: '', photoUrl: '', photoDataUrl: undefined, active: true });
    setShowTestimonialForm(false);
  };

  const saveTestimonial = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!testimonialForm.quote.trim() || !testimonialForm.name.trim() || !testimonialForm.role.trim()) {
      setAdminStatus('Enter a quote, name, and role.');
      return;
    }
    try {
      setSavingTestimonial(true);
      await adminRequest('saveTestimonial', testimonialForm);
      resetTestimonialForm();
      setAdminStatus('Testimonial saved.');
      await loadAdminTestimonials();
    } catch (error) {
      setAdminStatus(error instanceof Error ? error.message : 'Could not save testimonial.');
    } finally {
      setSavingTestimonial(false);
    }
  };

  const editTestimonial = (testimonial: Testimonial) => {
    setTestimonialForm({
      id: testimonial.id,
      quote: testimonial.quote,
      name: testimonial.name,
      role: testimonial.role,
      photoUrl: testimonial.photo_url || '',
      active: testimonial.active,
    });
    setShowTestimonialForm(true);
    setAdminSection('testimonials');
    setAdminStatus('');
  };

  const deleteTestimonial = async (testimonial: Testimonial) => {
    if (!window.confirm(`Delete testimonial from "${testimonial.name}"?`)) return;
    try {
      await adminRequest('deleteTestimonial', { id: testimonial.id });
      if (testimonialForm.id === testimonial.id) resetTestimonialForm();
      setAdminStatus('Testimonial deleted.');
      await loadAdminTestimonials();
    } catch (error) {
      setAdminStatus(error instanceof Error ? error.message : 'Could not delete testimonial.');
    }
  };

  const toggleTestimonialActive = async (testimonial: Testimonial) => {
    try {
      await adminRequest('saveTestimonial', { ...testimonial, active: !testimonial.active });
      await loadAdminTestimonials();
    } catch (error) {
      setAdminStatus(error instanceof Error ? error.message : 'Could not toggle testimonial.');
    }
  };

  const resetCouponForm = () => {
    setCouponForm({ id: null, code: '', courseName: '', discountType: 'percent', discountValue: '', expiresAt: '', maxUses: '' });
    setShowCouponForm(false);
  };

  const saveCoupon = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSubmitStatus('sending');
      await adminRequest('saveCoupon', { ...couponForm });
      resetCouponForm();
      setAdminStatus('Coupon saved.');
      await loadAdminCoupons();
    } catch (error) {
      setAdminStatus(error instanceof Error ? error.message : 'Could not save coupon.');
    } finally {
      setSubmitStatus('idle');
    }
  };

  const editCoupon = (coupon: Coupon) => {
    setCouponForm({
      id: coupon.id,
      code: coupon.code,
      courseName: coupon.course_name || '',
      discountType: coupon.discount_type,
      discountValue: String(coupon.discount_value),
      expiresAt: coupon.expires_at ? coupon.expires_at.slice(0, 10) : '',
      maxUses: coupon.max_uses ? String(coupon.max_uses) : '',
    });
    setShowCouponForm(true);
    setAdminStatus('');
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
    const order = adminOrders.find((item) => item.id === orderId);
    if (!order || order.payment_status === paymentStatus) return;
    if (!window.confirm(`Change ${order.full_name}'s payment status from ${order.payment_status.replace('_', ' ')} to ${paymentStatus.replace('_', ' ')}?`)) return;
    try {
      setUpdatingOrderId(orderId);
      setAdminStatus('Updating payment status and sending email...');
      const result = await adminRequest('updateOrder', { orderId, paymentStatus }) as any;
      
      if (result.emailSent === false) {
        setAdminStatus(`Status updated, but email failed: ${result.emailError || 'Unknown error'}`);
      } else {
        setAdminStatus('Payment status updated and email sent.');
      }
      
      await loadAdminOrders();
    } catch (error) {
      setAdminStatus(error instanceof Error ? error.message : 'Could not update payment status.');
    } finally {
      setUpdatingOrderId('');
    }
  };

  const deletePaymentOrders = async (deleteAll = false) => {
    const orderIds = deleteAll ? [] : selectedOrderIds;
    if (!deleteAll && orderIds.length === 0) return;
    const message = deleteAll
      ? `Delete all ${adminOrders.length} payment records and their uploaded proofs? This cannot be undone.`
      : `Delete ${orderIds.length} selected payment record${orderIds.length === 1 ? '' : 's'} and uploaded proof${orderIds.length === 1 ? '' : 's'}?`;
    if (!window.confirm(message)) return;
    try {
      setDeletingOrders(true);
      setAdminStatus('Deleting payment records...');
      await adminRequest('deleteOrders', { orderIds, deleteAll });
      setSelectedOrderIds([]);
      setAdminStatus(deleteAll ? 'All payment records deleted.' : 'Selected payment records deleted.');
      await loadAdminOrders();
    } catch (error) {
      setAdminStatus(error instanceof Error ? error.message : 'Could not delete payment records.');
    } finally {
      setDeletingOrders(false);
    }
  };

  const sendEmailCampaign = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const subject = campaignSubject.trim();
    const message = campaignMessage.trim();
    if (!subject || !message || campaignRecipientCount === 0) {
      setAdminStatus(campaignRecipientCount === 0 ? 'No recipients match this audience.' : 'Enter an email subject and message.');
      return;
    }
    if (!window.confirm(`Send this email to ${campaignRecipientCount} unique course joiner${campaignRecipientCount === 1 ? '' : 's'}?`)) return;
    try {
      setSendingCampaign(true);
      setAdminStatus(`Sending campaign to ${campaignRecipientCount} recipients...`);
      const result = await adminRequest<{ sent: number; failed: number }>('sendCampaign', {
        audience: campaignAudience,
        courseName: campaignCourse,
        manualEmails: campaignManualEmails,
        subject,
        message,
      });
      setAdminStatus(`Campaign complete: ${result.sent} sent${result.failed ? `, ${result.failed} failed` : ''}.`);
      if (result.failed === 0) {
        setCampaignSubject('');
        setCampaignMessage('');
        setCampaignManualEmails('');
      }
    } catch (error) {
      setAdminStatus(error instanceof Error ? error.message : 'Could not send the email campaign.');
    } finally {
      setSendingCampaign(false);
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
    <div className="site-shell min-h-screen bg-ink text-white">
      {!adminOpen && (
        <header className={`fixed inset-x-0 top-0 z-40 px-5 py-3 transition-all duration-500 sm:px-8 lg:px-12 lg:py-4 ${hasScrolled ? 'border-b border-white/10 bg-ink/90 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl' : 'border-b border-transparent bg-transparent'}`}>
        <nav className="flex items-center justify-between">
          <a href="#home" className="flex items-center gap-2.5" aria-label="Trading Boy home">
            <img src={logoUrl} alt="Trading Boy Academy Logo" className="h-12 w-auto object-contain sm:h-14" />
          </a>
          <div className="hidden items-center gap-7 md:flex lg:gap-10">
            {navLinks.map((link) => (
              <a key={link} href={`#${link.toLowerCase()}`} className="font-inter text-xs uppercase tracking-widest text-white/80 transition hover:text-white">
                {link}
              </a>
            ))}
          </div>
          <button onClick={() => openCheckout()} className="group hidden items-center gap-2 bg-electric px-4 py-2.5 font-inter text-[11px] font-bold uppercase tracking-widest text-black shadow-glow transition hover:bg-skyline md:flex">
            Join Now
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
          <button onClick={() => { setMenuOpen(false); openCheckout(); }} className="bg-electric px-7 py-4 font-inter text-xs font-bold uppercase tracking-widest text-black shadow-glow transition hover:bg-skyline">
            Join Now
          </button>
        </div>
      </div>
      )}

      {!adminOpen && (
        <main>
          <section id="home" className="relative flex min-h-screen items-center overflow-hidden bg-[#070b10] lg:pt-32">
            <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-25 animate-grid-pan" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(37,174,244,0.16),rgba(7,11,16,0.58)_38%,#070b10_74%)] animate-soft-drift" />
            <div className="pointer-events-none absolute inset-y-0 left-0 w-[42%] origin-left bg-[linear-gradient(90deg,rgba(37,174,244,0.22),rgba(37,174,244,0.055)_45%,transparent)] blur-[3px] animate-edge-breathe" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-[42%] origin-right bg-[linear-gradient(270deg,rgba(37,174,244,0.2),rgba(37,174,244,0.055)_45%,transparent)] blur-[3px] animate-edge-breathe" />
            <div className="hero-glow-orb pointer-events-none absolute left-1/2 top-[38%] h-[460px] w-[820px] -translate-x-1/2 rounded-full bg-electric/20 blur-[120px]" />
            <div className="hero-glow-core pointer-events-none absolute left-1/2 top-[46%] h-40 w-[58%] -translate-x-1/2 rounded-full bg-skyline/15 blur-[70px]" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-ink via-ink/70 to-transparent" />

            <div className="relative z-10 mx-auto flex w-full max-w-[1300px] flex-col items-center px-6 py-16 text-center sm:px-10 lg:px-16">
              <div className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-950/20 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.28em] text-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.12)] animate-hero-kicker">
                Live Trading Education
              </div>
              <h1 className="hero-heading-glow mt-8 w-full font-podium font-bold uppercase tracking-normal text-white animate-hero-title">
                <span className="block text-[clamp(2.05rem,10.8vw,3.55rem)] leading-[0.9] md:hidden">
                  <span className="block">Trade Price</span>
                  <span className="block">
                    Action. <span className="bg-gradient-to-r from-electric via-skyline to-white bg-clip-text text-transparent">Master</span>
                  </span>
                  <span className="block bg-gradient-to-r from-electric via-skyline to-white bg-clip-text text-transparent">Structure.</span>
                </span>
                <span className="hidden leading-[0.88] md:block md:text-[clamp(2.5rem,5vw,5.5rem)] lg:text-[clamp(3rem,5.5vw,6.5rem)]">
                  <span className="block whitespace-nowrap">Trade Price Action.</span>
                  <span className="block whitespace-nowrap bg-gradient-to-r from-electric via-skyline to-white bg-clip-text text-transparent">Master Structure.</span>
                </span>
              </h1>
              <p className="mx-auto mt-8 max-w-2xl font-inter text-sm leading-relaxed text-white/58 sm:text-base animate-hero-copy">
                Practical trading courses for serious learners who want process, risk control, and disciplined execution.
              </p>
              <div className="mt-8 flex flex-nowrap items-center justify-center gap-2.5 sm:gap-3 animate-hero-actions">
                <a href="#course" className="hero-cta-glow group inline-flex min-h-12 items-center justify-center bg-electric px-5 py-3 font-inter text-[10px] font-bold uppercase tracking-[0.16em] text-black shadow-glow transition hover:bg-skyline sm:min-w-[165px] sm:px-6 sm:text-[11px] whitespace-nowrap">
                  Join Course
                  <ArrowUpRight className="ml-2 h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </a>
                <a href="#course" className="inline-flex min-h-12 items-center justify-center border border-white/20 bg-white/[0.03] px-5 py-3 font-inter text-[10px] font-bold uppercase tracking-[0.16em] text-white/75 transition hover:border-electric/60 hover:text-white sm:min-w-[165px] sm:px-6 sm:text-[11px] whitespace-nowrap">
                  View Courses
                </a>
              </div>
            </div>
          </section>

          <section id="about" className="section-rise bg-ink px-6 py-20 sm:px-10 lg:px-16 lg:py-28">
            <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2 lg:items-center">
              <img src={aboutImageUrl} alt="Trading Boy Academy" className="h-[420px] w-full object-cover" />
              <div>
                <div className="mb-4 font-inter text-xs uppercase tracking-[0.3em] text-electric">About Us</div>
                <h2 className="font-podium text-[2.5rem] uppercase leading-none text-white sm:text-6xl">Empowering traders for over 5+ years</h2>
                <p className="mt-6 font-inter leading-relaxed text-white/65">
                  TradingBoy was founded over 5 years ago with a mission to help aspiring traders master the markets through practical education, disciplined risk management, and proven trading strategies. Our goal is to build confident, consistent traders who are ready to succeed in funded trading.
                </p>
              </div>
            </div>
          </section>

          <section id="course" className="section-rise bg-black px-6 py-20 sm:px-10 lg:px-16 lg:py-28">
            <div className="mx-auto max-w-7xl">
              <div className="mb-10 max-w-3xl">
                <div className="mb-4 font-inter text-xs uppercase tracking-[0.3em] text-electric">Courses</div>
                <h2 className="font-podium text-[2.5rem] uppercase leading-none text-white sm:text-6xl lg:text-7xl">Start your trading journey today</h2>
                <p className="mt-6 font-inter text-white/65">Select the course that matches your goals and begin learning professional trading with a structured, step-by-step approach.</p>
              </div>
              <div className="grid items-stretch gap-5 md:grid-cols-2 lg:gap-6">
                {publicCourses.map((course) => {
                  const normalPrice = course.normal_price || course.price;
                  const offerPrice = course.offer_price || course.price;
                  const percent = offerPercent(normalPrice, offerPrice);
                  return (
                    <article key={course.id || course.title} className="smooth-card flex h-full flex-col overflow-hidden border border-white/10 bg-ink shadow-glow hover:border-electric/35 hover:shadow-neon-blue">
                      <img src={courseThumbnail(course)} alt={course.title} className="aspect-[16/7] w-full object-cover md:aspect-[16/8] lg:aspect-[16/7]" />
                      <div className="flex flex-1 flex-col p-5 sm:p-6 md:p-5 lg:p-6">
                        <div className="font-inter text-[10px] uppercase tracking-[0.3em] text-electric lg:text-xs">Course</div>
                        <h3 className="mt-3 font-podium text-[2rem] uppercase leading-[0.98] text-white sm:text-[2.5rem] md:text-[1.75rem] lg:mt-4 lg:text-[2.5rem] xl:text-5xl">{course.title}</h3>
                        <p className="mt-4 font-inter text-xs leading-relaxed text-white/65 sm:text-sm md:text-[11px] lg:mt-5 lg:text-sm">{course.description}</p>
                        <div className="mt-5 flex flex-wrap items-end gap-2.5 font-inter lg:mt-7 lg:gap-3">
                          <div className="text-3xl font-bold text-white md:text-[1.65rem] lg:text-4xl">{money(offerPrice)}</div>
                          {percent > 0 && (
                            <>
                              <div className="pb-1 text-xs text-white/40 line-through lg:text-sm">{money(normalPrice)}</div>
                              <div className="mb-1 bg-electric px-2 py-1 text-[8px] font-bold uppercase tracking-widest text-black lg:px-2.5 lg:text-[10px]">{percent}% Off</div>
                            </>
                          )}
                        </div>
                        <div className="mt-auto flex flex-nowrap gap-2.5 pt-6 font-inter lg:gap-4 lg:pt-7">
                          <button onClick={() => setCourseDetailsOpen(course)} className="group inline-flex min-w-0 flex-1 items-center justify-center border border-electric bg-transparent px-3 py-3 font-inter text-[9px] font-bold uppercase tracking-[0.1em] text-white transition hover:bg-electric hover:text-black sm:px-4 sm:text-[10px] md:px-2 md:text-[8px] lg:px-6 lg:py-4 lg:text-xs lg:tracking-widest">
                            View Course
                          </button>
                          <button onClick={() => openCheckout(course.title)} className="group inline-flex min-w-0 flex-1 items-center justify-center bg-electric px-3 py-3 font-inter text-[9px] font-bold uppercase tracking-[0.1em] text-black transition hover:bg-skyline sm:px-4 sm:text-[10px] md:px-2 md:text-[8px] lg:px-6 lg:py-4 lg:text-xs lg:tracking-widest">
                            Join Course
                            <ArrowUpRight className="ml-1 h-3.5 w-3.5 shrink-0 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 lg:ml-2 lg:h-4 lg:w-4" />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <section id="results" className="section-rise bg-ink py-20 lg:py-28 overflow-hidden">
            <div className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-16">
              <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div>
                  <div className="mb-4 font-inter text-xs uppercase tracking-[0.3em] text-electric">Testimonials</div>
                  <h2 className="font-podium text-[2.5rem] uppercase leading-none text-white sm:text-6xl">Student feedback.</h2>
                </div>
                <p className="max-w-md font-inter text-sm text-white/60">Results vary by student. The courses focus on process, discipline, and risk-first decision making.</p>
              </div>
            </div>
            
            <div className="flex flex-col gap-6 relative w-full overflow-hidden py-4">
              {/* Top Row: Right to Left */}
              <TestimonialCarousel 
                direction="forward" 
                onSelect={setSelectedTestimonial} 
                testimonials={[...testimonials.slice(0, Math.ceil(testimonials.length / 2)), ...testimonials.slice(0, Math.ceil(testimonials.length / 2)), ...testimonials.slice(0, Math.ceil(testimonials.length / 2))]} 
              />

              {/* Bottom Row: Left to Right */}
              <TestimonialCarousel 
                direction="backward" 
                onSelect={setSelectedTestimonial} 
                testimonials={[...testimonials.slice(Math.ceil(testimonials.length / 2)), ...testimonials.slice(Math.ceil(testimonials.length / 2)), ...testimonials.slice(Math.ceil(testimonials.length / 2))]} 
              />
            </div>


          </section>

          <section id="faq" className="section-rise bg-black px-6 py-20 sm:px-10 lg:px-16 lg:py-28">
            <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <div className="mb-4 font-inter text-xs uppercase tracking-[0.3em] text-electric">FAQ</div>
                <h2 className="font-podium text-[2.5rem] uppercase leading-none text-white sm:text-6xl">Before you enroll.</h2>
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

      {!adminOpen && (
        <footer className="border-t border-white/10 bg-ink px-6 py-8 sm:px-10 lg:px-16">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 font-inter text-xs uppercase tracking-widest text-white/50 sm:flex-row sm:items-center sm:justify-between">
            <a href="#home" aria-label="Trading Boy Academy home" className="inline-flex w-fit items-center">
              <img src={logoUrl} alt="Trading Boy Academy" className="h-11 w-auto object-contain opacity-90 sm:h-12" />
            </a>
            <span>Forex, gold, and funded account education.</span>
          </div>
        </footer>
      )}

      {courseDetailsOpen && (
        <div className="fixed inset-0 z-50 bg-ink overflow-y-auto page-enter flex flex-col">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/90 backdrop-blur-xl px-6 py-4 flex items-center justify-between">
            <button onClick={() => setCourseDetailsOpen(null)} className="flex h-10 w-10 items-center justify-center text-electric transition hover:text-skyline" aria-label="Back to home">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="font-podium text-lg uppercase text-white">Course Details</div>
            <div className="w-20" /> {/* Spacer for centering */}
          </header>
          
          <div className="flex-1 w-full max-w-6xl mx-auto px-6 py-10 lg:px-8">
             <img src={courseThumbnail(courseDetailsOpen)} alt={courseDetailsOpen.title} className="w-full h-[300px] md:h-[450px] object-cover mb-10 md:mb-16 border border-white/10" />

            <div className="grid lg:grid-cols-[1fr_400px] gap-12 font-inter text-white/80 items-start">
               {/* Left Column */}
               <div className="contents lg:block lg:space-y-12">
                 <div className="order-1">
                   <div className="font-inter text-xs uppercase tracking-[0.3em] text-electric mb-3">Course Details</div>
                   <h2 className="font-podium text-4xl uppercase leading-none text-white sm:text-5xl md:text-6xl mb-6">
                     {courseDetailsOpen.title}
                   </h2>
                   <p className="text-lg md:text-xl leading-relaxed text-white/90">{courseDetailsOpen.description}</p>
                 </div>
                 
                 <div className="order-3 border-t border-white/10 pt-10">
                   <h3 className="text-white font-podium uppercase text-3xl mb-8">What you'll learn</h3>
                   <ul className="space-y-6">
                     <li className="flex items-start gap-4">
                       <CheckCircle className="w-6 h-6 text-electric shrink-0 mt-0.5" /> 
                       <span className="leading-relaxed text-lg">Comprehensive understanding of market structure to read price action like a professional.</span>
                     </li>
                     <li className="flex items-start gap-4">
                       <CheckCircle className="w-6 h-6 text-electric shrink-0 mt-0.5" /> 
                       <span className="leading-relaxed text-lg">Advanced risk management and position sizing strategies to protect your capital.</span>
                     </li>
                     <li className="flex items-start gap-4">
                       <CheckCircle className="w-6 h-6 text-electric shrink-0 mt-0.5" /> 
                       <span className="leading-relaxed text-lg">Live execution strategies, entry models, and precise trade management.</span>
                     </li>
                     <li className="flex items-start gap-4">
                       <CheckCircle className="w-6 h-6 text-electric shrink-0 mt-0.5" /> 
                       <span className="leading-relaxed text-lg">Developing a disciplined, risk-first trading psychology to overcome emotional trading.</span>
                     </li>
                   </ul>
                 </div>

                 <div className="order-4 border-t border-white/10 pt-10">
                   <div className="mb-3 font-inter text-xs uppercase tracking-[0.3em] text-electric">Built for focused traders</div>
                   <h3 className="mb-8 font-podium text-3xl uppercase text-white">Who this course is for</h3>
                   <ul className="space-y-5 text-base leading-relaxed text-white/75 md:text-lg">
                     <li className="flex items-start gap-4"><CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-electric" /><span>Beginners who want a clear foundation in forex, gold, market structure, and disciplined execution.</span></li>
                     <li className="flex items-start gap-4"><CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-electric" /><span>Developing traders who struggle with inconsistent entries, overtrading, or unclear risk management.</span></li>
                     <li className="flex items-start gap-4"><CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-electric" /><span>Serious learners ready to follow a written trading plan, journal their decisions, and build repeatable habits.</span></li>
                     <li className="flex items-start gap-4"><CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-electric" /><span>Funded-account traders who want a risk-first process built around patience and capital protection.</span></li>
                   </ul>
                 </div>

                 <div className="order-5 border-t border-white/10 pt-10">
                   <div className="mb-3 font-inter text-xs uppercase tracking-[0.3em] text-electric">Before you begin</div>
                   <h3 className="mb-8 font-podium text-3xl uppercase text-white">Requirements</h3>
                   <ul className="space-y-5 text-base leading-relaxed text-white/75 md:text-lg">
                     <li className="flex items-start gap-4"><CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-electric" /><span>{courseDetailsOpen.title.toLowerCase().includes('funded') ? 'Basic knowledge of the forex market is required before starting this funded-trader course.' : 'No previous trading experience is required; the course begins with the core concepts.'}</span></li>
                     <li className="flex items-start gap-4"><CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-electric" /><span>A phone, tablet, or computer with a stable internet connection for accessing the lessons.</span></li>
                     <li className="flex items-start gap-4"><CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-electric" /><span>Access to a charting platform and a demo account for safe, practical chart practice.</span></li>
                     <li className="flex items-start gap-4"><CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-electric" /><span>A notebook or digital journal, plus the commitment to practise consistently before risking real capital.</span></li>
                   </ul>
                 </div>
               </div>

               {/* Right Column / Sticky Sidebar */}
               <div className="order-2 border border-white/10 bg-black p-6 smooth-card sm:p-8 lg:order-none lg:sticky lg:top-24">
                  <div className="mb-3 text-xs font-bold uppercase tracking-widest text-white/50 sm:mb-4 sm:text-sm">Enrollment</div>
                  <div className="mb-6 flex flex-wrap items-end gap-3 sm:mb-8">
                     <div className="text-4xl font-bold text-white sm:text-5xl">{money(courseDetailsOpen.offer_price || courseDetailsOpen.price)}</div>
                     {(courseDetailsOpen.normal_price || courseDetailsOpen.price) > (courseDetailsOpen.offer_price || courseDetailsOpen.price) && (
                       <div className="pb-1.5 text-lg text-white/40 line-through">{money(courseDetailsOpen.normal_price || courseDetailsOpen.price)}</div>
                     )}
                  </div>
                  <button 
                    onClick={() => {
                      const title = courseDetailsOpen.title;
                      setCourseDetailsOpen(null);
                      openCheckout(title);
                    }} 
                    className="group block w-full bg-electric px-5 py-3.5 text-center font-inter text-[10px] font-bold uppercase tracking-widest text-black transition hover:bg-skyline sm:px-6 sm:py-4 sm:text-xs lg:px-8 lg:py-5 lg:text-sm"
                  >
                    Join Course Now
                    <ArrowUpRight className="ml-1.5 inline h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 sm:ml-2 lg:h-5 lg:w-5" />
                  </button>
                  <ul className="mt-6 space-y-3 text-sm text-white/60">
                    <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-white/40" /> Full lifetime access</li>
                    <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-white/40" /> Access on mobile and PC</li>
                    <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-white/40" /> Direct admin support</li>
                  </ul>
               </div>
            </div>
          </div>
        </div>
      )}

      {checkoutOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 px-4 py-12 sm:p-8 overflow-y-auto page-enter">
          <div className="w-full max-w-3xl border border-white/10 bg-black p-6 shadow-glow sm:p-8 smooth-card my-auto">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="font-inter text-xs uppercase tracking-[0.3em] text-electric">Join Course</div>
                <h2 className="mt-2 font-podium text-3xl uppercase leading-none text-white sm:text-4xl">
                  {joinStep === 'payment' ? 'Complete UPI Payment' : joinStep === 'thanks' ? 'Payment Submitted' : joinStep === 'failed' ? 'Payment Failed' : 'Enter Your Details'}
                </h2>
              </div>
              <button onClick={() => joinStep === 'payment' ? setJoinStep('details') : closeHashPage()} aria-label="Close checkout page">
                <X className="h-7 w-7 text-white" />
              </button>
            </div>

            {joinStep === 'details' && (
              <form onSubmit={beginPayment} className="space-y-4" noValidate>
                <div className="w-full border border-white/10 bg-white/5 px-4 py-3 font-inter text-sm text-white/70">
                  {joinForm.courseName}
                </div>
                <div>
                  <input required value={joinForm.name} onChange={(event) => { setJoinForm({ ...joinForm, name: event.target.value }); setFormErrors({...formErrors, name: ''}); }} placeholder="Full name" className={`w-full border ${formErrors.name ? 'border-red-500' : 'border-white/10'} bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric`} />
                  {formErrors.name && <p className="mt-1 font-inter text-[11px] font-medium text-red-500">{formErrors.name}</p>}
                </div>
                <div>
                  <input required type="email" value={joinForm.email} onChange={(event) => { setJoinForm({ ...joinForm, email: event.target.value }); setFormErrors({...formErrors, email: ''}); }} placeholder="Email address" className={`w-full border ${formErrors.email ? 'border-red-500' : 'border-white/10'} bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric`} />
                  {formErrors.email && <p className="mt-1 font-inter text-[11px] font-medium text-red-500">{formErrors.email}</p>}
                </div>
                <div>
                  <input required type="tel" maxLength={15} value={joinForm.phone} onChange={(event) => { const val = event.target.value.replace(/[^\d+]/g, ''); setJoinForm({ ...joinForm, phone: val }); setFormErrors({...formErrors, phone: ''}); }} placeholder="Phone or WhatsApp" className={`w-full border ${formErrors.phone ? 'border-red-500' : 'border-white/10'} bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric`} />
                  {formErrors.phone && <p className="mt-1 font-inter text-[11px] font-medium text-red-500">{formErrors.phone}</p>}
                </div>
                <div>
                  <select required value={joinForm.tradingExperience} onChange={(event) => { setJoinForm({ ...joinForm, tradingExperience: event.target.value }); setFormErrors({...formErrors, tradingExperience: ''}); }} className={`w-full border ${formErrors.tradingExperience ? 'border-red-500' : 'border-white/10'} bg-black px-4 py-3 font-inter text-sm text-white outline-none transition focus:border-electric`}>
                    <option value="">Trading experience</option>
                    <option>Beginner</option>
                    <option>Less than 1 year</option>
                    <option>1 to 3 years</option>
                    <option>More than 3 years</option>
                    <option>Funded account trader</option>
                  </select>
                  {formErrors.tradingExperience && <p className="mt-1 font-inter text-[11px] font-medium text-red-500">{formErrors.tradingExperience}</p>}
                </div>
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
                <button disabled={submitStatus === 'sending'} className="group flex justify-center items-center w-full bg-electric px-6 py-4 font-inter text-xs font-bold uppercase tracking-widest text-black transition hover:bg-skyline disabled:opacity-75 disabled:cursor-not-allowed">
                  {submitStatus === 'sending' ? (
                    <>
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Join Course
                      <ArrowUpRight className="ml-2 inline h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </>
                  )}
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
                  <div className="mt-6 flex flex-col gap-3">
                    <a href={getUpiUrl('gpay')} className="flex h-[60px] w-full items-center justify-center rounded-xl bg-white shadow-sm transition-all hover:shadow-md hover:scale-[1.02]">
                      <img src="https://upload.wikimedia.org/wikipedia/commons/f/f2/Google_Pay_Logo.svg" alt="GPay" className="h-6 object-contain" />
                    </a>

                    <a href={getUpiUrl('phonepe')} className="flex h-[60px] w-full items-center justify-center rounded-xl bg-[#5f259f] shadow-sm transition-all hover:shadow-md hover:scale-[1.02]">
                      <span className="flex items-center gap-2 font-bold tracking-tight text-white text-lg">
                        <Smartphone className="h-6 w-6" /> PhonePe
                      </span>
                    </a>

                    <a href={getUpiUrl('paytm')} className="flex h-[60px] w-full items-center justify-center rounded-xl bg-white shadow-sm transition-all hover:shadow-md hover:scale-[1.02]">
                      <img src="https://upload.wikimedia.org/wikipedia/commons/2/24/Paytm_Logo_%28standalone%29.svg" alt="Paytm" className="h-5 object-contain" />
                    </a>

                    <a href={getUpiUrl('generic')} className="flex h-[60px] w-full items-center justify-center rounded-xl border border-white/20 bg-transparent transition-all hover:bg-white/5 hover:scale-[1.02]">
                      <span className="font-inter font-bold text-white">Other UPI Apps</span>
                    </a>
                  </div>
                </div>
              </div>
            )}

            {joinStep === 'proof' && (
              <div className="animate-scale-in border border-electric/25 bg-[linear-gradient(145deg,#101820,#0b0d0f_55%)] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] sm:p-6 lg:p-8">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-electric/30 bg-electric/10 text-electric">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-inter text-[9px] font-bold uppercase tracking-[0.25em] text-electric">Final verification</div>
                    <h3 className="mt-1 font-podium text-2xl uppercase leading-none text-white sm:text-3xl">Upload Payment Proof</h3>
                  </div>
                </div>
                <p className="mt-4 font-inter text-sm leading-relaxed text-white/65">
                  Please upload a screenshot of your successful payment of {money(selectedOfferPrice)}. This is required to verify your enrollment.
                </p>
                
                <div className="mt-7 space-y-6 font-inter">
                  <div>
                    <label className="mb-3 block text-xs font-bold uppercase tracking-widest text-electric">
                      Payment Screenshot *
                    </label>
                    <label className={`group relative block cursor-pointer border border-dashed p-5 transition sm:p-6 ${paymentScreenshot ? 'border-emerald-400/45 bg-emerald-400/[0.05]' : 'border-electric/35 bg-black/40 hover:border-electric hover:bg-electric/[0.06]'}`}>
                      {paymentScreenshot ? (
                        <div className="flex items-center gap-4">
                          <img src={paymentScreenshot.dataUrl} alt="Payment screenshot preview" className="h-20 w-20 shrink-0 border border-white/10 object-cover sm:h-24 sm:w-28" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-400">
                              <CheckCircle className="h-4 w-4" /> Ready to submit
                            </div>
                            <div className="mt-2 truncate text-sm font-semibold text-white">{paymentScreenshot.name}</div>
                            <div className="mt-1 text-xs text-white/40">Tap to choose a different image</div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center py-3 text-center">
                          <div className="flex h-12 w-12 items-center justify-center bg-electric/10 text-electric transition group-hover:scale-105 group-hover:bg-electric group-hover:text-black">
                            <Upload className="h-5 w-5" />
                          </div>
                          <div className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-white">Choose payment screenshot</div>
                          <div className="mt-2 text-xs leading-relaxed text-white/40">JPG, PNG or WEBP · Clear screenshots work best</div>
                        </div>
                      )}
                      <input type="file" accept="image/*" onChange={handleScreenshotUpload} className="hidden" />
                    </label>
                    {paymentScreenshot && (
                      <button type="button" onClick={() => setPaymentScreenshot(null)} className="mt-3 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/45 transition hover:text-red-300">
                        <Trash2 className="h-3.5 w-3.5" /> Remove image
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="mb-3 block text-xs font-bold uppercase tracking-widest text-electric">
                      UPI Transaction ID / Remarks (Optional)
                    </label>
                    <input
                      type="text"
                      value={joinForm.remarks}
                      onChange={(e) => setJoinForm({ ...joinForm, remarks: e.target.value })}
                      placeholder="e.g. 312345678901"
                      className="h-12 w-full border border-white/10 bg-black/70 px-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-electric"
                    />
                  </div>

                  <button
                    onClick={submitPaymentConfirmation}
                    disabled={!paymentScreenshot || submitStatus === 'sending'}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 bg-electric px-6 py-4 font-inter text-xs font-bold uppercase tracking-[0.16em] text-black shadow-glow transition hover:bg-skyline disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30 disabled:shadow-none"
                  >
                    {submitStatus === 'sending' && <Loader2 className="h-4 w-4 animate-spin" />}
                    {submitStatus === 'sending' ? 'Submitting...' : 'Submit for Verification'}
                  </button>
                  {submitStatus === 'error' && <p className="mt-4 text-sm text-red-300">Could not submit your payment proof. Try again.</p>}
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
        </div>
      )}

      {selectedTestimonial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-6 backdrop-blur-sm page-enter" onClick={() => setSelectedTestimonial(null)}>
          <div className="relative w-full max-w-2xl bg-ink p-8 border border-white/10 shadow-glow" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedTestimonial(null)} className="absolute right-4 top-4 text-white/50 hover:text-white transition">
              <X className="h-6 w-6" />
            </button>
            <div className="mb-6 flex items-center gap-4">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/10 bg-black">
                <div className="flex h-full w-full items-center justify-center bg-electric/10 font-podium text-xl text-electric uppercase">{selectedTestimonial.name.charAt(0)}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-inter text-base font-semibold text-white">{selectedTestimonial.name}</div>
                <div className="font-inter text-xs uppercase tracking-widest text-electric">{selectedTestimonial.role}</div>
              </div>
            </div>
            <p className="font-inter leading-relaxed text-white/90 text-lg mb-6">"{selectedTestimonial.quote}"</p>
            {selectedTestimonial.photo_url && (
              <img src={selectedTestimonial.photo_url} alt="Trading result" className="w-full h-auto max-h-[50vh] object-contain border border-white/10 bg-black" />
            )}
          </div>
        </div>
      )}

      {adminOpen && (
        <main className={`page-enter min-h-screen bg-ink ${adminUnlocked ? 'p-4 sm:p-6 lg:p-8' : 'flex items-center justify-center p-5'}`}>
          <div className={adminUnlocked ? 'mx-auto w-full max-w-[1440px]' : 'w-full max-w-md'}>
            {!adminUnlocked ? (
              <form onSubmit={unlockAdmin} className="border border-white/10 bg-black p-6 shadow-glow sm:p-8">
                <div className="font-inter text-xs uppercase tracking-[0.3em] text-electric">Admin Panel</div>
                <h2 className="mt-3 font-podium text-3xl uppercase leading-none text-white sm:text-4xl">Trading Boy Admin</h2>
                <p className="mt-4 font-inter text-sm leading-relaxed text-white/55">Enter the admin passcode to manage courses, payments, and coupons.</p>
                <div className="mt-8 space-y-4">
                  <input
                    type="password"
                    value={adminPasscode}
                    onChange={(event) => setAdminPasscode(event.target.value)}
                    placeholder="Admin passcode"
                    disabled={adminLoading}
                    className="h-14 w-full border border-white/10 bg-ink px-4 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  <button disabled={adminLoading || !adminPasscode.trim()} className="inline-flex h-14 w-full items-center justify-center gap-2 bg-electric px-6 font-inter text-xs font-bold uppercase tracking-widest text-black transition hover:bg-skyline disabled:cursor-not-allowed disabled:opacity-60">
                    {adminLoading && <RefreshCcw className="h-4 w-4 animate-spin" />}
                    {adminLoading ? 'Unlocking...' : 'Unlock Admin'}
                  </button>
                </div>
                {adminStatus && <p className="mt-4 border border-red-400/30 bg-red-950/20 p-3 font-inter text-sm text-red-200">{adminStatus}</p>}
              </form>
            ) : (
              <>
              <div className="mb-8 border-b border-white/10 pb-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="font-inter text-xs uppercase tracking-[0.3em] text-electric">Admin Panel</div>
                    <h2 className="mt-2 font-podium text-3xl uppercase leading-none text-white sm:text-4xl">Trading Boy Admin</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => setAdminSection('home')} className={`border px-4 py-3 font-inter text-[11px] font-bold uppercase tracking-widest transition ${adminSection === 'home' ? 'border-electric bg-electric text-black' : 'border-white/10 bg-black text-white/65 hover:border-electric hover:text-white'}`}>
                      Dashboard
                    </button>
                    <button onClick={logoutAdmin} className="inline-flex items-center gap-2 border border-red-400/30 bg-red-950/20 px-4 py-3 font-inter text-[11px] font-bold uppercase tracking-widest text-red-200 transition hover:bg-red-950/40">
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </div>
                </div>
                {adminStatus && (
                  <div className={`mt-4 inline-block border px-4 py-2 font-inter text-sm ${adminStatus.includes('failed') || adminStatus.includes('Could not') ? 'border-red-500/30 bg-red-950/50 text-red-300' : 'border-green-500/30 bg-green-950/50 text-green-300'}`}>
                    {adminStatus}
                  </div>
                )}
              </div>
              <div>
                {adminSection === 'home' ? (
                  <div className="mx-auto mt-12 grid max-w-7xl gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
                    <button onClick={() => setAdminSection('courses')} className="group relative flex min-h-[330px] flex-col overflow-hidden border border-white/10 border-t-electric/50 bg-[#090b0d] p-7 text-left transition-all duration-300 hover:-translate-y-1 hover:border-electric/40 hover:shadow-[0_16px_45px_rgba(37,174,244,0.12)]">
                      <div className="absolute inset-0 bg-electric/0 transition-colors duration-300 group-hover:bg-electric/5" />
                      <div className="relative flex justify-between w-full mb-8">
                        <div className="flex h-12 w-12 items-center justify-center border border-white/10 bg-black text-white transition-all duration-300 group-hover:border-electric/50 group-hover:text-electric">
                          <BookOpen className="h-6 w-6" />
                        </div>
                        <div className="flex min-w-9 items-center justify-center border border-electric/25 bg-electric/10 px-2 py-1 text-xs font-bold text-electric transition-all duration-300 group-hover:bg-electric group-hover:text-black">
                          {adminCourses.length}
                        </div>
                      </div>
                      <div className="relative">
                        <div className="font-inter text-xs font-bold uppercase tracking-[0.2em] text-electric/70 mb-2">Catalog</div>
                        <h3 className="mb-4 font-podium text-2xl font-semibold tracking-wide text-white transition-colors duration-300 group-hover:text-electric">Manage Courses</h3>
                        <p className="font-inter text-sm text-white/60 leading-relaxed group-hover:text-white/80 transition-colors duration-300">
                          Add new courses, edit course details, update pricing, and manage your academy offerings.
                        </p>
                      </div>
                    </button>

                    <button onClick={() => setAdminSection('payments')} className="group relative flex min-h-[330px] flex-col overflow-hidden border border-white/10 border-t-electric/50 bg-[#090b0d] p-7 text-left transition-all duration-300 hover:-translate-y-1 hover:border-electric/40 hover:shadow-[0_16px_45px_rgba(37,174,244,0.12)]">
                      <div className="absolute inset-0 bg-electric/0 transition-colors duration-300 group-hover:bg-electric/5" />
                      <div className="relative flex justify-between w-full mb-8">
                        <div className="flex h-12 w-12 items-center justify-center border border-white/10 bg-black text-white transition-all duration-300 group-hover:border-electric/50 group-hover:text-electric">
                          <CreditCard className="h-6 w-6" />
                        </div>
                        <div className="flex min-w-9 items-center justify-center border border-electric/25 bg-electric/10 px-2 py-1 text-xs font-bold text-electric transition-all duration-300 group-hover:bg-electric group-hover:text-black">
                          {filteredOrders.length}
                        </div>
                      </div>
                      <div className="relative">
                        <div className="font-inter text-xs font-bold uppercase tracking-[0.2em] text-electric/70 mb-2">Sales</div>
                        <h3 className="mb-4 font-podium text-2xl font-semibold tracking-wide text-white transition-colors duration-300 group-hover:text-electric">Manage Payments</h3>
                        <p className="font-inter text-sm text-white/60 leading-relaxed group-hover:text-white/80 transition-colors duration-300">
                          Review customer orders, update payment statuses, verify screenshots, and track revenue.
                        </p>
                      </div>
                    </button>

                    <button onClick={() => setAdminSection('coupons')} className="group relative flex min-h-[330px] flex-col overflow-hidden border border-white/10 border-t-electric/50 bg-[#090b0d] p-7 text-left transition-all duration-300 hover:-translate-y-1 hover:border-electric/40 hover:shadow-[0_16px_45px_rgba(37,174,244,0.12)]">
                      <div className="absolute inset-0 bg-electric/0 transition-colors duration-300 group-hover:bg-electric/5" />
                      <div className="relative flex justify-between w-full mb-8">
                        <div className="flex h-12 w-12 items-center justify-center border border-white/10 bg-black text-white transition-all duration-300 group-hover:border-electric/50 group-hover:text-electric">
                          <Ticket className="h-6 w-6" />
                        </div>
                        <div className="flex min-w-9 items-center justify-center border border-electric/25 bg-electric/10 px-2 py-1 text-xs font-bold text-electric transition-all duration-300 group-hover:bg-electric group-hover:text-black">
                          {adminCoupons.length}
                        </div>
                      </div>
                      <div className="relative">
                        <div className="font-inter text-xs font-bold uppercase tracking-[0.2em] text-electric/70 mb-2">Promotions</div>
                        <h3 className="mb-4 font-podium text-2xl font-semibold tracking-wide text-white transition-colors duration-300 group-hover:text-electric">Manage Coupons</h3>
                        <p className="font-inter text-sm text-white/60 leading-relaxed group-hover:text-white/80 transition-colors duration-300">
                          Create promotional codes, set percentage or flat discounts, and toggle coupon activity.
                        </p>
                      </div>
                    </button>

                    <button onClick={() => setAdminSection('testimonials')} className="group relative flex min-h-[330px] flex-col overflow-hidden border border-white/10 border-t-electric/50 bg-[#090b0d] p-7 text-left transition-all duration-300 hover:-translate-y-1 hover:border-electric/40 hover:shadow-[0_16px_45px_rgba(37,174,244,0.12)]">
                      <div className="absolute inset-0 bg-electric/0 transition-colors duration-300 group-hover:bg-electric/5" />
                      <div className="relative flex justify-between w-full mb-8">
                        <div className="flex h-12 w-12 items-center justify-center border border-white/10 bg-black text-white transition-all duration-300 group-hover:border-electric/50 group-hover:text-electric">
                          <MessageSquareQuote className="h-6 w-6" />
                        </div>
                        <div className="flex min-w-9 items-center justify-center border border-electric/25 bg-electric/10 px-2 py-1 text-xs font-bold text-electric transition-all duration-300 group-hover:bg-electric group-hover:text-black">
                          {adminTestimonials.length}
                        </div>
                      </div>
                      <div className="relative">
                        <div className="font-inter text-xs font-bold uppercase tracking-[0.2em] text-electric/70 mb-2">Social Proof</div>
                        <h3 className="mb-4 font-podium text-2xl font-semibold tracking-wide text-white transition-colors duration-300 group-hover:text-electric">Manage Testimonials</h3>
                        <p className="font-inter text-sm text-white/60 leading-relaxed group-hover:text-white/80 transition-colors duration-300">
                          Add student feedback, upload trading results, and control which testimonials appear publicly.
                        </p>
                      </div>
                    </button>

                    <button onClick={() => setAdminSection('emails')} className="group relative flex min-h-[330px] flex-col overflow-hidden border border-white/10 border-t-electric/50 bg-[#090b0d] p-7 text-left transition-all duration-300 hover:-translate-y-1 hover:border-electric/40 hover:shadow-[0_16px_45px_rgba(37,174,244,0.12)]">
                      <div className="absolute inset-0 bg-electric/0 transition-colors duration-300 group-hover:bg-electric/5" />
                      <div className="relative mb-8 flex w-full justify-between">
                        <div className="flex h-12 w-12 items-center justify-center border border-white/10 bg-black text-white transition-all duration-300 group-hover:border-electric/50 group-hover:text-electric">
                          <Mail className="h-6 w-6" />
                        </div>
                        <div className="flex min-w-9 items-center justify-center border border-electric/25 bg-electric/10 px-2 py-1 text-xs font-bold text-electric transition-all duration-300 group-hover:bg-electric group-hover:text-black">
                          {new Set(adminOrders.map((order) => order.email.trim().toLowerCase()).filter(Boolean)).size}
                        </div>
                      </div>
                      <div className="relative">
                        <div className="mb-2 font-inter text-xs font-bold uppercase tracking-[0.2em] text-electric/70">Communication</div>
                        <h3 className="mb-4 font-podium text-2xl font-semibold tracking-wide text-white transition-colors duration-300 group-hover:text-electric">Email Course Joiners</h3>
                        <p className="font-inter text-sm leading-relaxed text-white/60 transition-colors duration-300 group-hover:text-white/80">
                          Send course updates, announcements, and marketing messages to selected student audiences.
                        </p>
                      </div>
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
                        {adminSection === 'courses' ? 'Course Management' : adminSection === 'payments' ? 'Payment Management' : adminSection === 'testimonials' ? 'Testimonial Management' : adminSection === 'emails' ? 'Email Campaigns' : 'Coupon Management'}
                      </div>
                    </div>
                    {adminStatus && <div className="mb-5 border border-white/10 bg-black p-4 font-inter text-sm text-white/70">{adminStatus}</div>}
                    {adminSection === 'coupons' ? (
                      <div className="space-y-6">
                        {!showCouponForm && (
                          <div className="flex justify-end">
                            <button onClick={() => { resetCouponForm(); setShowCouponForm(true); }} className="flex items-center gap-2 bg-electric px-6 py-3 font-inter text-xs font-bold uppercase tracking-widest text-black transition hover:bg-skyline">
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
                                    <div className="font-inter text-xs uppercase tracking-[0.3em] text-electric">{couponForm.id ? 'Edit Coupon' : 'Add Coupon'}</div>
                                  </div>
                                  <button type="button" onClick={resetCouponForm} aria-label="Close coupon form"><X className="h-6 w-6 text-white/50 hover:text-white transition" /></button>
                                </div>
                                <input required value={couponForm.code} onChange={(event) => setCouponForm({ ...couponForm, code: event.target.value.toUpperCase() })} placeholder="Coupon Code (e.g. SUMMER20)" className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric uppercase" />
                                <div className="flex flex-col">
                                  <label className="mb-1 text-[10px] uppercase text-white/50 tracking-wider">Course Scope</label>
                                  <select value={couponForm.courseName} onChange={(event) => setCouponForm({ ...couponForm, courseName: event.target.value })} className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition focus:border-electric">
                                    <option value="">All courses</option>
                                    {adminCourses.map((course) => <option key={course.id} value={course.title}>{course.title}</option>)}
                                  </select>
                                </div>
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
                                    <label className="mb-1 text-[10px] uppercase text-white/50 tracking-wider">Maximum Uses (Optional)</label>
                                    <input type="number" min="1" value={couponForm.maxUses} onChange={(event) => setCouponForm({ ...couponForm, maxUses: event.target.value })} placeholder="e.g. 50" className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric" />
                                  </div>
                                </div>
                                <div className="border border-white/10 bg-black p-3 font-inter text-xs leading-relaxed text-white/50">
                                  Course scope controls where the coupon works. Leave it as All courses for a global coupon.
                                </div>
                                <div className="flex flex-wrap gap-3 pt-2">
                                  <button type="submit" disabled={submitStatus === 'sending'} className="bg-electric px-6 py-4 font-inter text-xs font-bold uppercase tracking-widest text-black transition hover:bg-skyline disabled:opacity-50">
                                    {couponForm.id ? 'Update Coupon' : 'Save Coupon'}
                                  </button>
                                  <button type="button" onClick={resetCouponForm} className="border border-white/15 px-6 py-4 font-inter text-xs font-bold uppercase tracking-widest text-white transition hover:border-electric">Cancel</button>
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
                                  <th className="px-4 py-3">Course</th>
                                  <th className="px-4 py-3">Discount</th>
                                  <th className="px-4 py-3">Usage & Limits</th>
                                  <th className="px-4 py-3">Status</th>
                                  <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/10">
                                {adminCoupons.length === 0 ? (
                                  <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-white/50">
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
                                      <td className="px-4 py-4 text-white/70">
                                        <span className="block max-w-[260px] truncate" title={coupon.course_name || 'All courses'}>{coupon.course_name || 'All courses'}</span>
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
                                        <button onClick={() => editCoupon(coupon)} className="p-2 text-white/50 transition-colors hover:text-electric" aria-label="Edit">
                                          <Edit3 className="h-4 w-4 inline-block" />
                                        </button>
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
                    ) : adminSection === 'testimonials' ? (
                  <div className="space-y-6">
                    {!showTestimonialForm && !testimonialForm.id && (
                      <div className="flex justify-end">
                        <button onClick={() => setShowTestimonialForm(true)} className="flex items-center gap-2 bg-electric px-6 py-3 font-inter text-xs font-bold uppercase tracking-widest text-black transition hover:bg-skyline">
                          <Plus className="h-4 w-4" />
                          Add Testimonial
                        </button>
                      </div>
                    )}
                    <div className="block">
                      {(showTestimonialForm || testimonialForm.id) && (
                        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-4">
                          <form onSubmit={saveTestimonial} className="animate-scale-in max-w-xl w-full space-y-4 border border-white/10 bg-ink p-6 shadow-glow max-h-[90vh] overflow-y-auto scrollbar-hide">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="font-inter text-xs uppercase tracking-[0.3em] text-electric">{testimonialForm.id ? 'Edit Testimonial' : 'Add Testimonial'}</div>
                              </div>
                              <button type="button" onClick={resetTestimonialForm} aria-label="Close form"><X className="h-6 w-6 text-white/50 hover:text-white transition" /></button>
                            </div>
                            <div className="flex flex-col gap-2">
                              <label className="font-inter text-xs text-white/50 uppercase tracking-widest">Result / Chart Photo (Optional)</label>
                              <div className="flex items-center gap-4">
                                {(testimonialForm.photoDataUrl || testimonialForm.photoUrl) && (
                                  <div className="w-24 aspect-video overflow-hidden rounded border border-white/10 shrink-0">
                                    <img src={testimonialForm.photoDataUrl || testimonialForm.photoUrl} alt="Photo preview" className="w-full h-full object-cover" />
                                  </div>
                                )}
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const reader = new FileReader();
                                      reader.onload = (event) => {
                                        setTestimonialForm({ ...testimonialForm, photoDataUrl: event.target?.result as string });
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  }}
                                  className="w-full text-sm text-white/60 file:mr-4 file:py-2 file:px-4 file:rounded-none file:border-0 file:text-sm file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20 transition cursor-pointer"
                                />
                              </div>
                            </div>
                            <input value={testimonialForm.name} onChange={(event) => setTestimonialForm({ ...testimonialForm, name: event.target.value })} placeholder="Student Name" className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric" />
                            <input value={testimonialForm.role} onChange={(event) => setTestimonialForm({ ...testimonialForm, role: event.target.value })} placeholder="Role (e.g. Funded account trader)" className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric" />
                            <textarea value={testimonialForm.quote} onChange={(event) => setTestimonialForm({ ...testimonialForm, quote: event.target.value })} placeholder="Testimonial Quote" rows={4} className="w-full resize-none border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric" />
                            <label className="flex items-center gap-2">
                              <input type="checkbox" checked={testimonialForm.active} onChange={(event) => setTestimonialForm({ ...testimonialForm, active: event.target.checked })} className="accent-electric h-4 w-4" />
                              <span className="font-inter text-sm text-white">Active</span>
                            </label>
                            <div className="flex flex-wrap gap-3 pt-2">
                              <button type="submit" disabled={savingTestimonial} className="bg-electric px-6 py-4 font-inter text-xs font-bold uppercase tracking-widest text-black transition hover:bg-skyline disabled:opacity-50 disabled:cursor-not-allowed">
                                {savingTestimonial ? 'Saving...' : (testimonialForm.id ? 'Update Testimonial' : 'Save Testimonial')}
                              </button>
                              <button type="button" onClick={resetTestimonialForm} className="border border-white/15 px-6 py-4 font-inter text-xs font-bold uppercase tracking-widest text-white transition hover:border-electric">Cancel</button>
                            </div>
                          </form>
                        </div>
                      )}
                      <div className="grid gap-4 min-w-0">
                        {adminTestimonials.length === 0 ? (
                          <div className="border border-white/10 p-5 font-inter text-sm text-white/55">No testimonials yet.</div>
                        ) : (
                          adminTestimonials.map((testimonial) => (
                            <article key={testimonial.id} className={`smooth-card flex flex-col gap-4 border border-white/10 bg-black p-5 sm:flex-row sm:items-center justify-between ${!testimonial.active ? 'opacity-50 grayscale' : 'hover:border-electric/35'}`}>
                              <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-start gap-4">
                                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-ink">
                                  <div className="flex h-full w-full items-center justify-center font-podium text-white">{testimonial.name.charAt(0)}</div>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-inter text-sm text-white/80 italic mb-2">"{testimonial.quote}"</p>
                                  <div className="font-inter font-bold text-white text-sm">{testimonial.name}</div>
                                  <div className="font-inter text-xs text-electric uppercase tracking-widest mt-1 mb-3">{testimonial.role}</div>
                                  {testimonial.photo_url && (
                                    <div className="w-32 aspect-video overflow-hidden rounded border border-white/10">
                                      <img src={testimonial.photo_url} alt="Result" className="w-full h-full object-cover" />
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2 flex-shrink-0">
                                <button onClick={() => toggleTestimonialActive(testimonial)} className={`border px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition ${testimonial.active ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-green-500/30 text-green-400 hover:bg-green-500/10'}`}>
                                  {testimonial.active ? 'Deactivate' : 'Activate'}
                                </button>
                                <button onClick={() => editTestimonial(testimonial)} className="border border-white/15 p-2 text-white transition hover:border-electric" aria-label="Edit testimonial"><Edit3 className="h-4 w-4" /></button>
                                <button onClick={() => deleteTestimonial(testimonial)} className="border border-red-400/40 p-2 text-red-300 transition hover:bg-red-950/30" aria-label="Delete testimonial"><Trash2 className="h-4 w-4" /></button>
                              </div>
                            </article>
                          ))
                        )}
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
                            <input value={courseForm.discordUrl} onChange={(event) => setCourseForm({ ...courseForm, discordUrl: event.target.value })} placeholder="Private Discord invite URL" className="w-full border border-white/10 bg-black px-4 py-3 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric" />
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
                              <img src={courseThumbnail(course)} alt={course.title} className="h-32 w-full object-cover sm:h-full" />
                              <div className="min-w-0">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div>
                                    <h3 className="font-inter text-lg font-bold text-white">{course.title}</h3>
                                    <div className="mt-1 font-inter text-sm text-white/55">{money(offerPrice)} <span className="text-white/35 line-through">{money(normalPrice)}</span> - {offerPercent(normalPrice, offerPrice)}% Off</div>
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
                ) : adminSection === 'emails' ? (
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <form onSubmit={sendEmailCampaign} className="space-y-5 border border-white/10 bg-black p-5 sm:p-7">
                      <div>
                        <div className="font-inter text-xs font-bold uppercase tracking-[0.25em] text-electric">Compose campaign</div>
                        <h3 className="mt-3 font-podium text-3xl uppercase text-white">Send an update</h3>
                        <p className="mt-2 font-inter text-sm leading-relaxed text-white/50">Use this for course announcements, new lessons, community updates, or relevant offers.</p>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-2 block font-inter text-[10px] font-bold uppercase tracking-widest text-white/50">Audience</label>
                          <select value={campaignAudience} onChange={(event) => setCampaignAudience(event.target.value as 'paid' | 'all' | 'manual')} className="h-12 w-full border border-white/10 bg-ink px-4 font-inter text-sm text-white outline-none focus:border-electric">
                            <option value="paid">Paid students only</option>
                            <option value="all">All course joiners</option>
                            <option value="manual">Manual emails only</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-2 block font-inter text-[10px] font-bold uppercase tracking-widest text-white/50">Course</label>
                          <select value={campaignCourse} disabled={campaignAudience === 'manual'} onChange={(event) => setCampaignCourse(event.target.value)} className="h-12 w-full border border-white/10 bg-ink px-4 font-inter text-sm text-white outline-none focus:border-electric disabled:cursor-not-allowed disabled:opacity-35">
                            <option value="all">All courses</option>
                            {adminCourseNames.map((course) => <option key={course} value={course}>{course}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="mb-2 block font-inter text-[10px] font-bold uppercase tracking-widest text-white/50">Additional email addresses</label>
                        <textarea rows={3} value={campaignManualEmails} onChange={(event) => setCampaignManualEmails(event.target.value)} placeholder="name@example.com, another@example.com" className="w-full resize-y border border-white/10 bg-ink px-4 py-3 font-inter text-sm leading-relaxed text-white outline-none placeholder:text-white/30 focus:border-electric" />
                        <p className="mt-2 font-inter text-[10px] leading-relaxed text-white/35">Separate addresses with commas, spaces, semicolons, or new lines. Valid addresses are merged and duplicates are removed.</p>
                      </div>
                      <div>
                        <label className="mb-2 block font-inter text-[10px] font-bold uppercase tracking-widest text-white/50">Email subject</label>
                        <input required maxLength={150} value={campaignSubject} onChange={(event) => setCampaignSubject(event.target.value)} placeholder="e.g. New live trading session this Sunday" className="h-12 w-full border border-white/10 bg-ink px-4 font-inter text-sm text-white outline-none placeholder:text-white/30 focus:border-electric" />
                      </div>
                      <div>
                        <label className="mb-2 block font-inter text-[10px] font-bold uppercase tracking-widest text-white/50">Message</label>
                        <textarea required maxLength={5000} rows={10} value={campaignMessage} onChange={(event) => setCampaignMessage(event.target.value)} placeholder="Write your announcement or course update..." className="w-full resize-y border border-white/10 bg-ink px-4 py-4 font-inter text-sm leading-relaxed text-white outline-none placeholder:text-white/30 focus:border-electric" />
                        <div className="mt-2 text-right font-inter text-[10px] text-white/30">{campaignMessage.length}/5000</div>
                      </div>
                      <button type="submit" disabled={sendingCampaign || campaignRecipientCount === 0 || !campaignSubject.trim() || !campaignMessage.trim()} className="inline-flex w-full items-center justify-center gap-2 bg-electric px-6 py-4 font-inter text-xs font-bold uppercase tracking-[0.16em] text-black shadow-glow transition hover:bg-skyline disabled:cursor-not-allowed disabled:opacity-35">
                        {sendingCampaign ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {sendingCampaign ? 'Sending campaign...' : `Send to ${campaignRecipientCount} recipient${campaignRecipientCount === 1 ? '' : 's'}`}
                      </button>
                    </form>
                    <aside className="h-fit border border-electric/25 bg-electric/[0.05] p-5 sm:p-6">
                      <Mail className="h-7 w-7 text-electric" />
                      <div className="mt-5 font-inter text-xs font-bold uppercase tracking-widest text-white/45">Unique recipients</div>
                      <div className="mt-2 font-podium text-5xl font-bold text-white">{campaignRecipientCount}</div>
                      <div className="mt-5 space-y-3 border-t border-white/10 pt-5 font-inter text-sm leading-relaxed text-white/55">
                        <p>Duplicate email addresses are automatically removed.</p>
                        <p>Paid students are selected by default to keep messages relevant.</p>
                        <p>You will be asked to confirm the final recipient count before sending.</p>
                      </div>
                    </aside>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="border border-white/10 bg-black p-5">
                        <div className="font-inter text-xs uppercase tracking-widest text-white/45">Payments</div>
                        <div className="mt-2 font-inter text-3xl font-bold text-white">{filteredOrders.length}</div>
                      </div>
                      <div className="border border-white/10 bg-black p-5">
                        <div className="font-inter text-xs uppercase tracking-widest text-white/45">Paid Amount</div>
                        <div className="mt-2 font-inter text-3xl font-bold text-white">{money(filteredOrders.filter((order) => order.payment_status === 'paid').reduce((total, order) => total + order.final_amount, 0))}</div>
                      </div>
                      <div className="border border-white/10 bg-black p-5">
                        <div className="font-inter text-xs uppercase tracking-widest text-white/45">Pending</div>
                        <div className="mt-2 font-inter text-3xl font-bold text-white">{filteredOrders.filter((order) => order.payment_status === 'pending').length}</div>
                      </div>
                    </div>
                    <div className="space-y-3 border border-white/10 bg-black p-3">
                      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_170px_230px_170px_170px]">
                        <input value={paymentSearch} onChange={(event) => setPaymentSearch(event.target.value)} placeholder="Search name, email, phone, course" className="h-12 border border-white/10 bg-ink px-4 font-inter text-sm text-white outline-none transition placeholder:text-white/35 focus:border-electric" />
                        <select value={paymentStatusFilter} onChange={(event) => setPaymentStatusFilter(event.target.value)} className="h-12 border border-white/10 bg-ink px-4 font-inter text-sm text-white outline-none focus:border-electric">
                          <option value="all">All status</option>
                          <option value="pending">Pending</option>
                          <option value="under_review">Under Review</option>
                          <option value="paid">Paid</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        <select value={paymentCourseFilter} onChange={(event) => setPaymentCourseFilter(event.target.value)} className="h-12 border border-white/10 bg-ink px-4 font-inter text-sm text-white outline-none focus:border-electric">
                          <option value="all">All courses</option>
                          {adminCourseNames.map((course) => <option key={course}>{course}</option>)}
                        </select>
                        <select value={paymentDateFilter} onChange={(event) => setPaymentDateFilter(event.target.value as 'all' | 'today' | 'custom')} className="h-12 border border-white/10 bg-ink px-4 font-inter text-sm text-white outline-none focus:border-electric">
                          <option value="all">All dates</option>
                          <option value="today">Today only</option>
                          <option value="custom">Choose date</option>
                        </select>
                        {paymentDateFilter === 'custom' ? (
                          <input type="date" value={paymentCustomDate} onChange={(event) => setPaymentCustomDate(event.target.value)} className="h-12 border border-white/10 bg-ink px-4 font-inter text-sm text-white outline-none focus:border-electric" />
                        ) : <div className="hidden xl:block" />}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                        <button onClick={loadAdminOrders} className="inline-flex h-11 items-center justify-center gap-2 border border-white/15 px-4 font-inter text-[10px] font-bold uppercase tracking-widest text-white transition hover:border-electric">
                          <RefreshCcw className="h-4 w-4" /> Refresh
                        </button>
                        <button onClick={downloadOrdersCsv} disabled={filteredOrders.length === 0} className="h-11 bg-electric px-5 font-inter text-[10px] font-bold uppercase tracking-widest text-black transition hover:bg-skyline disabled:opacity-50">Export CSV</button>
                        <button onClick={() => deletePaymentOrders(false)} disabled={selectedOrderIds.length === 0 || deletingOrders} className="inline-flex h-11 items-center gap-2 border border-red-400/35 px-4 font-inter text-[10px] font-bold uppercase tracking-widest text-red-300 transition hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-35">
                          {deletingOrders ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete selected ({selectedOrderIds.length})
                        </button>
                        <button onClick={() => deletePaymentOrders(true)} disabled={adminOrders.length === 0 || deletingOrders} className="ml-auto inline-flex h-11 items-center gap-2 border border-red-500/50 bg-red-950/20 px-4 font-inter text-[10px] font-bold uppercase tracking-widest text-red-200 transition hover:bg-red-950/40 disabled:opacity-35">
                          <Trash2 className="h-4 w-4" /> Delete all
                        </button>
                      </div>
                    </div>
                    <div className="overflow-x-auto border border-white/10 bg-black">
                      <table className="min-w-[1370px] w-full table-fixed border-collapse font-inter text-sm">
                        <thead className="bg-white/[0.04] text-left text-xs uppercase tracking-widest text-white/45">
                          <tr>
                            <th className="w-[50px] px-4 py-4">
                              <input type="checkbox" aria-label="Select all filtered payments" checked={filteredOrders.length > 0 && filteredOrders.every((order) => selectedOrderIds.includes(order.id))} onChange={(event) => setSelectedOrderIds(event.target.checked ? Array.from(new Set([...selectedOrderIds, ...filteredOrders.map((order) => order.id)])) : selectedOrderIds.filter((id) => !filteredOrders.some((order) => order.id === id)))} className="h-4 w-4 accent-[#25aef4]" />
                            </th>
                            <th className="w-[120px] px-4 py-4">Date</th>
                            <th className="w-[210px] px-4 py-4">Student</th>
                            <th className="w-[300px] px-4 py-4">Contact</th>
                            <th className="w-[170px] px-4 py-4">Experience</th>
                            <th className="w-[260px] px-4 py-4">Course</th>
                            <th className="w-[130px] px-4 py-4">Amount</th>
                            <th className="w-[150px] px-4 py-4">Proof</th>
                            <th className="w-[190px] px-4 py-4">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                          {filteredOrders.length === 0 ? (
                            <tr><td className="px-4 py-8 text-center text-white/55" colSpan={9}>No payments found.</td></tr>
                          ) : (
                            filteredOrders.map((order) => (
                              <tr key={order.id} className="align-top transition hover:bg-white/[0.03]">
                                <td className="px-4 py-5">
                                  <input type="checkbox" aria-label={`Select payment from ${order.full_name}`} checked={selectedOrderIds.includes(order.id)} onChange={(event) => setSelectedOrderIds((current) => event.target.checked ? [...current, order.id] : current.filter((id) => id !== order.id))} className="h-4 w-4 accent-[#25aef4]" />
                                </td>
                                <td className="px-4 py-5 text-white/70">
                                  <div>{new Date(order.created_at).toLocaleDateString('en-IN')}</div>
                                  <div className="mt-1 text-xs text-white/40">{new Date(order.created_at).toLocaleTimeString('en-IN')}</div>
                                </td>
                                <td className="px-4 py-5">
                                  <div className="truncate font-semibold text-white" title={order.full_name}>{order.full_name}</div>
                                  <div className="mt-1 truncate text-xs text-white/40" title={order.id}>{order.id}</div>
                                </td>
                                <td className="px-4 py-5 text-white/70">
                                  <div className="truncate" title={order.email}>{order.email}</div>
                                  <div className="mt-1 truncate" title={order.phone}>{order.phone}</div>
                                </td>
                                <td className="px-4 py-5 text-white/70"><span className="block truncate" title={order.trading_experience || '-'}>{order.trading_experience || '-'}</span></td>
                                <td className="px-4 py-5 text-white/70"><span className="block truncate" title={order.course_name || '-'}>{order.course_name || '-'}</span></td>
                                <td className="px-4 py-5 font-bold text-white">{money(order.final_amount)}</td>
                                <td className="px-4 py-5">
                                  {order.payment_screenshot_path && supabase ? (
                                    <a 
                                      href={supabase?.storage.from('payment-proofs').getPublicUrl(order.payment_screenshot_path).data.publicUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-electric hover:underline text-xs font-bold uppercase tracking-widest inline-block mb-1"
                                    >
                                      View Image
                                    </a>
                                  ) : <div className="text-xs text-white/30 uppercase tracking-widest mb-1">{order.payment_screenshot_path ? 'Proof Unavailable' : 'No Image'}</div>}
                                  {order.remarks && <div className="max-w-[130px] truncate text-xs text-white/70" title={order.remarks}>Note: {order.remarks}</div>}
                                </td>
                                <td className="px-4 py-5">
                                  <div className="relative">
                                  <select value={order.payment_status} disabled={updatingOrderId === order.id} onChange={(event) => updateOrderStatus(order.id, event.target.value)} className="h-11 w-full border border-white/10 bg-ink px-3 font-inter text-xs uppercase tracking-widest text-white outline-none focus:border-electric disabled:cursor-wait disabled:opacity-50">
                                    <option value="pending">Pending</option>
                                    <option value="under_review">Under Review</option>
                                    <option value="paid">Paid</option>
                                    <option value="cancelled">Cancelled</option>
                                  </select>
                                  {updatingOrderId === order.id && <Loader2 className="absolute right-3 top-3.5 h-4 w-4 animate-spin text-electric" />}
                                  </div>
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
              </>
            )}
          </div>
        </main>
      )}

      {promoOpen && !adminOpen && !checkoutOpen && !courseDetailsOpen && (!window.location.hash || window.location.hash === '#home') && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-md" onClick={() => setPromoOpen(false)}>
          <div className="relative w-full max-w-lg overflow-hidden border border-electric/35 bg-[#07131c] p-6 shadow-[0_0_80px_rgba(37,174,244,0.3)] sm:p-9" onClick={(event) => event.stopPropagation()}>
            <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-electric/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-20 h-52 w-52 rounded-full bg-emerald-400/10 blur-3xl" />
            <button onClick={() => setPromoOpen(false)} className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center border border-white/10 bg-black/30 text-white/60 transition hover:border-electric hover:text-white" aria-label="Close offer">
              <X className="h-5 w-5" />
            </button>

            <div className="relative">
              <div className="inline-flex items-center gap-2 border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 font-inter text-[9px] font-bold uppercase tracking-[0.24em] text-emerald-300 sm:text-[10px]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" /> Limited Course Offer
              </div>
              <div className="mt-7 font-inter text-xs font-bold uppercase tracking-[0.3em] text-electric">Unlock your trading journey</div>
              <h2 className="mt-3 max-w-md font-podium text-4xl font-bold uppercase leading-[0.95] text-white sm:text-5xl">
                Save <span className="text-electric">₹1,000</span> on your course
              </h2>
              <p className="mt-5 max-w-md font-inter text-sm leading-relaxed text-white/65 sm:text-base">
                Start learning market structure, risk control, and disciplined execution for less. Apply the code below during enrollment.
              </p>

              <div className="mt-7 flex items-stretch border border-dashed border-electric/50 bg-black/40">
                <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5">
                  <Ticket className="h-5 w-5 shrink-0 text-electric" />
                  <div>
                    <div className="font-inter text-[9px] uppercase tracking-widest text-white/40">Coupon code</div>
                    <div className="mt-0.5 font-mono text-lg font-bold tracking-[0.16em] text-white">{PROMO_COUPON_CODE}</div>
                  </div>
                </div>
                <button onClick={async () => { await navigator.clipboard?.writeText(PROMO_COUPON_CODE); setPromoCopied(true); window.setTimeout(() => setPromoCopied(false), 1800); }} className="flex min-w-24 items-center justify-center gap-2 border-l border-electric/25 px-4 font-inter text-[10px] font-bold uppercase tracking-widest text-electric transition hover:bg-electric hover:text-black">
                  <Copy className="h-4 w-4" /> {promoCopied ? 'Copied' : 'Copy'}
                </button>
              </div>

              <button onClick={() => { setPromoOpen(false); setCouponInput(PROMO_COUPON_CODE); setAppliedCoupon(null); setCouponError(''); openCheckout(); }} className="group mt-5 flex w-full items-center justify-center bg-electric px-6 py-4 font-inter text-xs font-bold uppercase tracking-[0.18em] text-black shadow-glow transition hover:bg-skyline sm:py-5">
                Claim ₹1,000 Off
                <ArrowUpRight className="ml-2 h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </button>
              <p className="mt-3 text-center font-inter text-[10px] uppercase tracking-wider text-white/35">Enter the code at checkout · Course terms apply</p>
            </div>
          </div>
        </div>
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

      {submitStatus === 'sending' && joinStep === 'proof' && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-electric border-t-transparent"></div>
          <p className="mt-4 font-inter text-sm font-bold uppercase tracking-widest text-white">Uploading Proof...</p>
        </div>
      )}

      {paymentPromptOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-4">
          <div className="animate-scale-in max-w-md border border-white/10 bg-ink p-6 shadow-glow">
            <h3 className="font-podium text-3xl uppercase leading-none text-white">Did you complete the payment?</h3>
            <p className="mt-4 font-inter text-sm leading-relaxed text-white/65">Select yes only after paying {money(selectedOfferPrice)} to {UPI_ID}.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={() => { setPaymentPromptOpen(false); setJoinStep('proof'); }} className="bg-electric px-6 py-4 font-inter text-xs font-bold uppercase tracking-widest text-black transition hover:bg-skyline">
                Yes
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

    </div>
  );
}

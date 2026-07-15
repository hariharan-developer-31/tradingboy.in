import { FormEvent, useMemo, useState } from 'react';
import { ArrowLeft, Calculator, RefreshCcw, ShieldCheck } from 'lucide-react';

type Instrument = { symbol: string; base: string; quote: string; pipSize: number; contractSize: number; label: string };
type Result = { riskMoney: number; riskPercent: number; units: number; lots: number; brokerSizing: number; pipValue: number; stopLoss: number };
type FuturesInstrument = { code: string; name: string; size: 'mini' | 'micro'; tickSize: number; tickValue: number; unit: string };

const forexSymbols = [
  'AUDCAD', 'AUDCHF', 'AUDJPY', 'AUDNZD', 'AUDUSD', 'CADCHF', 'CADJPY', 'CHFJPY',
  'EURAUD', 'EURCAD', 'EURCHF', 'EURGBP', 'EURJPY', 'EURNZD', 'EURUSD',
  'GBPAUD', 'GBPCAD', 'GBPCHF', 'GBPJPY', 'GBPNZD', 'GBPUSD',
  'NZDCAD', 'NZDCHF', 'NZDJPY', 'NZDUSD', 'USDCAD', 'USDCHF', 'USDJPY',
  'EURCZK', 'EURDKK', 'EURHKD', 'EURHUF', 'EURNOK', 'EURPLN', 'EURSEK', 'EURSGD', 'EURTRY', 'EURZAR',
  'GBPDKK', 'GBPHKD', 'GBPHUF', 'GBPMXN', 'GBPNOK', 'GBPPLN', 'GBPSEK', 'GBPSGD', 'GBPTRY', 'GBPZAR',
  'USDCNH', 'USDCZK', 'USDDKK', 'USDHKD', 'USDHUF', 'USDINR', 'USDMXN', 'USDNOK', 'USDPLN', 'USDSEK', 'USDSGD', 'USDTHB', 'USDTRY', 'USDZAR',
];
const instruments: Instrument[] = [
  ...forexSymbols.map((symbol) => ({ symbol, base: symbol.slice(0, 3), quote: symbol.slice(3), pipSize: symbol.endsWith('JPY') ? 0.01 : 0.0001, contractSize: 100000, label: `${symbol.slice(0, 3)}/${symbol.slice(3)}` })),
  { symbol: 'XAUUSD', base: 'XAU', quote: 'USD', pipSize: 0.01, contractSize: 100, label: 'Gold / US Dollar' },
  { symbol: 'XAGUSD', base: 'XAG', quote: 'USD', pipSize: 0.001, contractSize: 5000, label: 'Silver / US Dollar' },
];

const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'INR', 'SGD', 'HKD', 'ZAR', 'TRY', 'MXN', 'NOK', 'SEK', 'DKK', 'PLN', 'HUF', 'CZK', 'CNH', 'THB'];
const initialForm = { symbol: 'EURUSD', accountCurrency: 'USD', accountSize: '', riskMode: 'percent' as 'percent' | 'money', riskPercent: '1', riskMoney: '', stopMode: 'pips' as 'pips' | 'levels', stopLoss: '', entryPrice: '', stopPrice: '', brokerLotUnit: '1', conversionRate: '', pairPrice: '' };
const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

const futuresInstruments: FuturesInstrument[] = [
  { code: 'ES', name: 'E-mini S&P 500', size: 'mini', tickSize: 0.25, tickValue: 12.50, unit: 'index points' },
  { code: 'MES', name: 'Micro E-mini S&P 500', size: 'micro', tickSize: 0.25, tickValue: 1.25, unit: 'index points' },
  { code: 'NQ', name: 'E-mini Nasdaq-100', size: 'mini', tickSize: 0.25, tickValue: 5, unit: 'index points' },
  { code: 'MNQ', name: 'Micro E-mini Nasdaq-100', size: 'micro', tickSize: 0.25, tickValue: 0.50, unit: 'index points' },
  { code: 'GC', name: 'Gold Futures', size: 'mini', tickSize: 0.10, tickValue: 10, unit: 'USD per troy ounce' },
  { code: 'MGC', name: 'Micro Gold', size: 'micro', tickSize: 0.10, tickValue: 1, unit: 'USD per troy ounce' },
  { code: 'CL', name: 'WTI Crude Oil', size: 'mini', tickSize: 0.01, tickValue: 10, unit: 'USD per barrel' },
  { code: 'MCL', name: 'Micro WTI Crude Oil', size: 'micro', tickSize: 0.01, tickValue: 1, unit: 'USD per barrel' },
];

export default function PositionCalculator() {
  const [calculatorType, setCalculatorType] = useState<'forex' | 'futures' | null>(null);
  const shellClass = calculatorType === 'forex' ? 'calculator-shell calculator-forex' : calculatorType === 'futures' ? 'calculator-shell calculator-futures' : 'calculator-shell calculator-choice';
  const heading = calculatorType === 'forex' ? 'Forex Calculator' : calculatorType === 'futures' ? 'Future Calculator' : 'Position Calculator';
  return <div className={`${shellClass} [&>div>header]:hidden [&>div]:!min-h-[calc(100vh-73px)]`}>
    <header className="border-b border-white/10 bg-[#080d12]/95 px-5 py-4 text-white sm:px-10 lg:px-16">
      <nav className="mx-auto flex max-w-7xl items-center gap-4" aria-label="Calculator navigation">
        {calculatorType ? <button type="button" onClick={() => setCalculatorType(null)} aria-label="Back to calculator selection" className="flex h-10 w-10 shrink-0 items-center justify-center text-white/65 transition hover:text-electric"><ArrowLeft className="h-5 w-5" /></button> : <a href="/" aria-label="Back to home" className="flex h-10 w-10 shrink-0 items-center justify-center text-white/65 transition hover:text-electric"><ArrowLeft className="h-5 w-5" /></a>}
        <button type="button" onClick={() => setCalculatorType(null)} className="text-left font-podium text-lg uppercase transition hover:text-electric">{heading}</button>
      </nav>
    </header>
    {calculatorType === 'forex' ? <ForexCalculator onChangeType={() => setCalculatorType(null)} /> : calculatorType === 'futures' ? <FuturesCalculator onChangeType={() => setCalculatorType(null)} /> : <CalculatorChoice onSelect={setCalculatorType} />}
  </div>;
}

function ForexCalculator({ onChangeType }: { onChangeType: () => void }) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [pairSearchOpen, setPairSearchOpen] = useState(false);
  const [activePairIndex, setActivePairIndex] = useState(0);
  const pairQuery = form.symbol.trim().toUpperCase();
  const pairSuggestions = useMemo(() => {
    if (!pairQuery) return instruments.slice(0, 8);
    return instruments
      .filter((item) => item.symbol.includes(pairQuery) || item.label.toUpperCase().includes(pairQuery))
      .slice(0, 8);
  }, [pairQuery]);
  const pairSearchInvalid = pairQuery.length > 0 && pairSuggestions.length === 0;
  const selectedInstrument = useMemo(() => {
    const symbol = form.symbol.trim().toUpperCase();
    return instruments.find((item) => item.symbol === symbol);
  }, [form.symbol]);
  const instrument = selectedInstrument || instruments[0];
  const needsPairPrice = form.accountCurrency === instrument.base;
  const needsConversion = form.accountCurrency !== instrument.quote && !needsPairPrice;

  const setField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setResult(null);
    setError('');
  };

  const selectPair = (symbol: string) => {
    setField('symbol', symbol);
    setPairSearchOpen(false);
    setActivePairIndex(0);
  };

  const handlePairKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') return setPairSearchOpen(false);
    if (!pairSearchOpen || pairSuggestions.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActivePairIndex((current) => (current + 1) % pairSuggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActivePairIndex((current) => (current - 1 + pairSuggestions.length) % pairSuggestions.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      selectPair(pairSuggestions[activePairIndex]?.symbol ?? pairSuggestions[0].symbol);
    }
  };

  const calculate = (event: FormEvent) => {
    event.preventDefault();
    const accountSize = Number(form.accountSize);
    if (!selectedInstrument) return setError('Enter a valid six-letter currency pair, such as EURUSD.');
    const entryPrice = Number(form.entryPrice);
    const stopPrice = Number(form.stopPrice);
    const stopLoss = form.stopMode === 'pips' ? Number(form.stopLoss) : Math.abs(entryPrice - stopPrice) / instrument.pipSize;
    const brokerLotUnit = Number(form.brokerLotUnit);
    const riskInput = Number(form.riskMode === 'percent' ? form.riskPercent : form.riskMoney);
    if (!Number.isFinite(accountSize) || accountSize <= 0) return setError('Enter an account size greater than zero.');
    if (!Number.isFinite(riskInput) || riskInput <= 0) return setError(`Enter a valid risk ${form.riskMode === 'percent' ? 'percentage' : 'amount'}.`);
    if (form.riskMode === 'percent' && riskInput > 100) return setError('Risk percentage cannot exceed 100%.');
    if (form.stopMode === 'levels' && (!Number.isFinite(entryPrice) || entryPrice <= 0 || !Number.isFinite(stopPrice) || stopPrice <= 0)) return setError('Enter valid entry and stop-loss prices.');
    if (!Number.isFinite(stopLoss) || stopLoss <= 0) return setError(form.stopMode === 'levels' ? 'Entry and stop-loss prices must be different.' : 'Enter a stop-loss distance greater than zero pips.');
    if (!Number.isFinite(brokerLotUnit) || brokerLotUnit <= 0) return setError('Broker lot unit must be greater than zero.');

    let quoteToAccount = 1;
    if (needsPairPrice) {
      const pairPrice = Number(form.stopMode === 'levels' ? form.entryPrice : form.pairPrice);
      if (!Number.isFinite(pairPrice) || pairPrice <= 0) return setError(`Enter the current ${instrument.label} market price.`);
      quoteToAccount = 1 / pairPrice;
    } else if (needsConversion) {
      quoteToAccount = Number(form.conversionRate);
      if (!Number.isFinite(quoteToAccount) || quoteToAccount <= 0) return setError(`Enter how many ${form.accountCurrency} equal 1 ${instrument.quote}.`);
    }

    const riskMoney = form.riskMode === 'percent' ? accountSize * riskInput / 100 : riskInput;
    if (riskMoney > accountSize) return setError('Risk money cannot be greater than the account size.');
    const pipValuePerLot = instrument.pipSize * instrument.contractSize * quoteToAccount;
    const lots = riskMoney / (stopLoss * pipValuePerLot);
    const units = lots * instrument.contractSize;
    if (![pipValuePerLot, lots, units].every(Number.isFinite) || lots <= 0) return setError('These values could not produce a valid position size.');
    const nextResult = { riskMoney, riskPercent: riskMoney / accountSize * 100, units, lots, brokerSizing: lots / brokerLotUnit, pipValue: pipValuePerLot * lots, stopLoss };
    setCalculating(true);
    window.setTimeout(() => {
      setResult(nextResult);
      setCalculating(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 850);
  };

  const reset = () => { setForm(initialForm); setResult(null); setError(''); };

  return (
    <div className="min-h-screen bg-ink text-white">
      <header className="border-b border-white/10 bg-[#080d12]/95 px-5 py-4 sm:px-10 lg:px-16">
        <nav className="mx-auto flex max-w-7xl items-center gap-5" aria-label="Calculator navigation">
          <a href="/" aria-label="Back to home" className="flex h-10 w-10 items-center justify-center text-white/65 hover:text-electric"><ArrowLeft className="h-5 w-5" /></a>
          <button type="button" onClick={onChangeType} className="font-podium text-lg uppercase hover:text-electric">Position Calculator</button>
        </nav>
      </header>
      <main className="relative overflow-hidden px-5 pb-12 pt-4 sm:px-8 sm:pb-16 sm:pt-5 lg:px-12 lg:pb-20 lg:pt-6">
        <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-[75%] -translate-x-1/2 bg-electric/10 blur-[130px]" />
        <div className="relative mx-auto max-w-6xl">
          {result ? (
            <section className="mx-auto mt-10 max-w-2xl border border-electric/25 bg-electric/[0.06] p-5 sm:p-8" aria-live="polite">
              <div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-electric" /><h2 className="font-podium text-3xl uppercase">Position Size Results</h2></div>
              <div className="mt-6 space-y-3">
                <ResultRow label="Calculated size" value={`${result.lots.toFixed(4)} lots`} highlight />
                <ResultRow label="Lot equivalents" value={`${result.lots.toFixed(2)} std · ${(result.lots * 10).toFixed(2)} mini · ${(result.lots * 100).toFixed(2)} micro`} />
                <ResultRow label="Units" value={Math.floor(result.units).toLocaleString('en-US')} />
                <ResultRow label="Broker sizing" value={numberFormat.format(result.brokerSizing)} />
                <ResultRow label={`Money at risk (${form.accountCurrency})`} value={`${form.accountCurrency} ${numberFormat.format(result.riskMoney)}`} />
                <ResultRow label="Risk ratio" value={`${numberFormat.format(result.riskPercent)}%`} />
                <ResultRow label="Risking pips" value={`${numberFormat.format(result.stopLoss)} pips`} />
                <ResultRow label={`Value per pip (${form.accountCurrency})`} value={`${form.accountCurrency} ${numberFormat.format(result.pipValue)}`} />
                <p className="pt-3 text-[10px] leading-5 text-white/35">Confirm your broker's contract specification and round down to its permitted lot step before trading.</p>
              </div>
              <button type="button" onClick={reset} className="mt-7 inline-flex w-full items-center justify-center gap-2 border border-electric/40 px-6 py-4 text-xs font-bold uppercase tracking-widest text-electric hover:bg-electric hover:text-black"><RefreshCcw className="h-4 w-4" /> New Calculation</button>
            </section>
          ) : <div className="mt-0 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <form onSubmit={calculate} className="border-2 border-electric/35 bg-[#080d12]/95 p-5 shadow-[0_0_30px_rgba(56,182,255,0.1)] sm:p-8">
              <div className="grid gap-5">
                <div className="relative">
                  <label htmlFor="forex-pair-search" className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">Search currency pair</label>
                  <input
                    id="forex-pair-search"
                    value={form.symbol}
                    onChange={(event) => { setField('symbol', event.target.value.toUpperCase().replace(/[^A-Z]/g, '')); setPairSearchOpen(true); setActivePairIndex(0); }}
                    onFocus={() => setPairSearchOpen(true)}
                    onBlur={() => setPairSearchOpen(false)}
                    onKeyDown={handlePairKeyDown}
                    autoComplete="off"
                    placeholder="Type EURUSD, GBPJPY, XAUUSD..."
                    className={`input-style ${pairSearchInvalid ? '!border-red-400/60' : ''}`}
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={pairSearchOpen && pairSuggestions.length > 0}
                    aria-controls="forex-pair-suggestions"
                    aria-invalid={pairSearchInvalid}
                    aria-describedby={pairSearchInvalid ? 'forex-pair-error' : 'forex-pair-hint'}
                  />
                  {pairSearchOpen && pairSuggestions.length > 0 && (
                    <div id="forex-pair-suggestions" role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto border border-electric/35 bg-[#080d12] shadow-2xl">
                      {pairSuggestions.map((item, index) => (
                        <button key={item.symbol} type="button" role="option" aria-selected={index === activePairIndex} onMouseDown={(event) => event.preventDefault()} onClick={() => selectPair(item.symbol)} onMouseEnter={() => setActivePairIndex(index)} className={`flex w-full items-center justify-between gap-4 border-b border-white/[0.06] px-4 py-3 text-left transition last:border-b-0 ${index === activePairIndex ? 'bg-electric/15 text-electric' : 'text-white hover:bg-white/5'}`}>
                          <strong className="text-sm tracking-wide">{item.symbol}</strong>
                          <span className="text-xs text-white/45">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {pairSearchInvalid ? <span id="forex-pair-error" className="mt-2 block text-xs text-red-300" role="alert">Enter a valid currency pair.</span> : <span id="forex-pair-hint" className="mt-2 block text-[10px] leading-4 text-white/35">{instruments.length} supported forex and metal pairs</span>}
                </div>
                <Field label="Account currency"><select value={form.accountCurrency} onChange={(e) => setField('accountCurrency', e.target.value)} className="input-style">{currencies.map((currency) => <option key={currency}>{currency}</option>)}</select></Field>
                <Field label="Account size"><input type="number" min="0" step="any" inputMode="decimal" value={form.accountSize} onChange={(e) => setField('accountSize', e.target.value)} placeholder="e.g. 10,000" className="input-style" /></Field>
                <Field label="Broker lot unit" hint="1 standard · 0.1 mini · 0.01 micro"><select value={form.brokerLotUnit} onChange={(e) => setField('brokerLotUnit', e.target.value)} className="input-style"><option value="1">1 — Standard account</option><option value="0.1">0.1 — Mini account</option><option value="0.01">0.01 — Micro account</option></select></Field>
                <div className="sm:col-span-2">
                  <span className="mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">Risk input</span>
                  <div className="mb-3 grid grid-cols-2 border border-white/10 p-1">
                    <ModeButton active={form.riskMode === 'percent'} onClick={() => setField('riskMode', 'percent')}>Percentage</ModeButton>
                    <ModeButton active={form.riskMode === 'money'} onClick={() => setField('riskMode', 'money')}>Money ({form.accountCurrency})</ModeButton>
                  </div>
                  {form.riskMode === 'percent' ? <input type="number" min="0" max="100" step="any" inputMode="decimal" value={form.riskPercent} onChange={(e) => setField('riskPercent', e.target.value)} placeholder="Risk ratio, %" className="input-style" /> : <input type="number" min="0" step="any" inputMode="decimal" value={form.riskMoney} onChange={(e) => setField('riskMoney', e.target.value)} placeholder={`Risk money, ${form.accountCurrency}`} className="input-style" />}
                </div>
                <div className="sm:col-span-2">
                  <span className="mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">Stop-loss input</span>
                  <div className="mb-3 grid grid-cols-2 border border-white/10 p-1">
                    <ModeButton active={form.stopMode === 'pips'} onClick={() => setField('stopMode', 'pips')}>Use Pips</ModeButton>
                    <ModeButton active={form.stopMode === 'levels'} onClick={() => setField('stopMode', 'levels')}>Use Price Levels</ModeButton>
                  </div>
                  {form.stopMode === 'pips' ? <Field label="Stop-loss distance" hint="Enter pips, not broker points"><input type="number" min="0" step="any" inputMode="decimal" value={form.stopLoss} onChange={(e) => setField('stopLoss', e.target.value)} placeholder="e.g. 30 pips" className="input-style" /></Field> : <div className="grid gap-4 sm:grid-cols-2"><Field label="Entry price"><input type="number" min="0" step="any" inputMode="decimal" value={form.entryPrice} onChange={(e) => setField('entryPrice', e.target.value)} placeholder="e.g. 2350.50" className="input-style" /></Field><Field label="Stop-loss price" hint="Pips are calculated automatically"><input type="number" min="0" step="any" inputMode="decimal" value={form.stopPrice} onChange={(e) => setField('stopPrice', e.target.value)} placeholder="e.g. 2345.50" className="input-style" /></Field></div>}
                </div>
                {needsPairPrice && form.stopMode === 'pips' && <Field label={`Current ${instrument.symbol} price`} hint={`Needed to convert ${instrument.quote} into ${form.accountCurrency}`}><input type="number" min="0" step="any" inputMode="decimal" value={form.pairPrice} onChange={(e) => setField('pairPrice', e.target.value)} placeholder="Current market price" className="input-style" /></Field>}
                {needsConversion && <Field label={`${instrument.quote} → ${form.accountCurrency} rate`} hint={`Enter the ${form.accountCurrency} value of 1 ${instrument.quote}`}><input type="number" min="0" step="any" inputMode="decimal" value={form.conversionRate} onChange={(e) => setField('conversionRate', e.target.value)} placeholder={`1 ${instrument.quote} = ? ${form.accountCurrency}`} className="input-style" /></Field>}
              </div>
              {error && <div className="mt-5 border border-red-400/30 bg-red-950/20 p-4 text-sm text-red-200" role="alert">{error}</div>}
              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={reset} className="inline-flex items-center justify-center gap-2 border border-white/15 px-5 py-4 text-xs font-bold uppercase tracking-widest text-white/65 hover:border-electric hover:text-white"><RefreshCcw className="h-4 w-4" /> Reset</button><button className="inline-flex items-center justify-center gap-2 bg-electric px-7 py-4 text-xs font-bold uppercase tracking-widest text-black shadow-glow hover:bg-skyline"><Calculator className="h-4 w-4" /> Calculate</button></div>
            </form>

          </div>}
        </div>
      </main>
      {calculating && <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-ink px-6 text-center" role="status" aria-live="assertive"><div className="relative h-24 w-24"><div className="absolute inset-0 animate-spin rounded-full border-2 border-white/10 border-t-electric" /><div className="absolute inset-4 animate-[spin_1.3s_linear_infinite_reverse] rounded-full border border-electric/20 border-b-emerald-300" /></div><div className="mt-8 text-[10px] font-bold uppercase tracking-[0.3em] text-electric">Risk Calculation</div><h2 className="mt-3 font-podium text-4xl uppercase sm:text-5xl">Calculating Position Size</h2><p className="mt-4 max-w-md text-sm leading-7 text-white/50">Checking pip value, risk money, contract size, and currency conversion.</p></div>}
    </div>
  );
}

function CalculatorChoice({ onSelect }: { onSelect: (type: 'forex' | 'futures') => void }) {
  return <div className="min-h-screen bg-ink text-white"><header className="border-b border-white/10 bg-[#080d12]/95 px-5 py-4 sm:px-10 lg:px-16"><nav className="mx-auto flex max-w-7xl items-center justify-between"><a href="/" className="text-xs font-bold uppercase tracking-widest text-white/65 hover:text-electric">Home</a><div className="font-podium text-lg uppercase">Position Calculator</div></nav></header><main className="relative flex min-h-[calc(100vh-73px)] items-center overflow-hidden px-5 py-12 sm:px-8"><div className="pointer-events-none absolute left-1/2 top-1/3 h-96 w-[75%] -translate-x-1/2 bg-electric/10 blur-[130px]" /><div className="relative mx-auto w-full max-w-4xl text-center"><div className="text-[10px] font-bold uppercase tracking-[0.3em] text-electric">Choose Your Market</div><h1 className="mt-4 font-podium text-[2.5rem] uppercase leading-none sm:text-7xl">Position Size Calculator</h1><p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/55 sm:text-base">Forex uses pip value and lots. Futures uses exchange tick value and whole contracts. Select the market you are sizing.</p><div className="mt-10 grid gap-5 sm:grid-cols-2"><button type="button" onClick={() => onSelect('forex')} className="group border border-electric/35 bg-electric/[0.07] p-7 text-left transition hover:border-electric hover:bg-electric/[0.12] sm:p-9"><div className="text-[10px] font-bold uppercase tracking-[0.25em] text-electric">Lots &amp; Pips</div><h2 className="mt-3 font-podium text-4xl uppercase">Forex</h2><p className="mt-4 text-sm leading-7 text-white/50">Size currency pairs and gold using account currency, risk, pip distance, and broker lot type.</p><span className="mt-7 inline-block text-xs font-bold uppercase tracking-widest text-white group-hover:text-electric">Open Forex Calculator →</span></button><button type="button" onClick={() => onSelect('futures')} className="group border border-emerald-400/30 bg-emerald-400/[0.06] p-7 text-left transition hover:border-emerald-300 hover:bg-emerald-400/[0.1] sm:p-9"><div className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-300">Contracts &amp; Ticks</div><h2 className="mt-3 font-podium text-4xl uppercase">Futures</h2><p className="mt-4 text-sm leading-7 text-white/50">Size E-mini, Micro E-mini, metals, and energy contracts without exceeding your risk budget.</p><span className="mt-7 inline-block text-xs font-bold uppercase tracking-widest text-white group-hover:text-emerald-300">Open Futures Calculator →</span></button></div></div></main></div>;
}

type FuturesResult = { budget: number; riskPercent: number; stopTicks: number; stopPoints: number; exactContracts: number; contracts: number; actualRisk: number };

function FuturesCalculator({ onChangeType }: { onChangeType: () => void }) {
  const [contractSize, setContractSize] = useState<'mini' | 'micro'>('micro');
  const [code, setCode] = useState('MES');
  const [accountSize, setAccountSize] = useState('');
  const [riskMode, setRiskMode] = useState<'percent' | 'money'>('percent');
  const [riskPercent, setRiskPercent] = useState('1');
  const [riskMoney, setRiskMoney] = useState('');
  const [stopMode, setStopMode] = useState<'ticks' | 'levels'>('ticks');
  const [stopTicks, setStopTicks] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [error, setError] = useState('');
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<FuturesResult | null>(null);
  const available = futuresInstruments.filter((item) => item.size === contractSize);
  const instrument = futuresInstruments.find((item) => item.code === code) || available[0];

  const changeSize = (size: 'mini' | 'micro') => { setContractSize(size); setCode(futuresInstruments.find((item) => item.size === size)?.code || 'MES'); setResult(null); setError(''); };
  const reset = () => { setAccountSize(''); setRiskMode('percent'); setRiskPercent('1'); setRiskMoney(''); setStopMode('ticks'); setStopTicks(''); setEntryPrice(''); setStopPrice(''); setResult(null); setError(''); };
  const calculate = (event: FormEvent) => {
    event.preventDefault();
    const balance = Number(accountSize);
    const riskInput = Number(riskMode === 'percent' ? riskPercent : riskMoney);
    const entry = Number(entryPrice);
    const stop = Number(stopPrice);
    const ticks = stopMode === 'ticks' ? Number(stopTicks) : Math.abs(entry - stop) / instrument.tickSize;
    if (!Number.isFinite(balance) || balance <= 0) return setError('Enter an account size greater than zero.');
    if (!Number.isFinite(riskInput) || riskInput <= 0) return setError(`Enter a valid risk ${riskMode === 'percent' ? 'percentage' : 'amount'}.`);
    if (riskMode === 'percent' && riskInput > 100) return setError('Risk percentage cannot exceed 100%.');
    if (stopMode === 'levels' && (!Number.isFinite(entry) || entry <= 0 || !Number.isFinite(stop) || stop <= 0)) return setError('Enter valid entry and stop-loss prices.');
    if (!Number.isFinite(ticks) || ticks <= 0) return setError(stopMode === 'levels' ? 'Entry and stop-loss prices must be different.' : 'Enter a stop distance greater than zero ticks.');
    const budget = riskMode === 'percent' ? balance * riskInput / 100 : riskInput;
    if (budget > balance) return setError('Risk money cannot be greater than the account size.');
    const riskPerContract = ticks * instrument.tickValue;
    const exactContracts = budget / riskPerContract;
    const contracts = Math.floor(exactContracts);
    const next = { budget, riskPercent: budget / balance * 100, stopTicks: ticks, stopPoints: ticks * instrument.tickSize, exactContracts, contracts, actualRisk: contracts * riskPerContract };
    setError(''); setCalculating(true); window.setTimeout(() => { setResult(next); setCalculating(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }, 850);
  };

  return <div className="min-h-screen bg-ink text-white"><header className="border-b border-white/10 bg-[#080d12]/95 px-5 py-4 sm:px-10 lg:px-16"><nav className="mx-auto flex max-w-7xl items-center justify-between"><a href="/" className="text-xs font-bold uppercase tracking-widest text-white/65 hover:text-electric">Home</a><button type="button" onClick={onChangeType} className="font-podium text-lg uppercase hover:text-electric">Position Calculator</button></nav></header><main className="relative overflow-hidden px-5 pb-12 pt-4 sm:px-8 sm:pb-16 sm:pt-5 lg:px-12 lg:pb-20 lg:pt-6"><div className="pointer-events-none absolute left-1/2 top-0 h-96 w-[75%] -translate-x-1/2 bg-emerald-400/10 blur-[130px]" /><div className="relative mx-auto max-w-6xl">{!result && <div className="max-w-3xl"><div className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-300">Futures Risk Tool</div><h1 className="mt-4 font-podium text-[2.5rem] uppercase leading-none sm:text-7xl">Futures Position Calculator</h1><p className="mt-5 max-w-2xl text-sm leading-7 text-white/55 sm:text-base">Calculate whole contracts from your maximum risk and the exchange-defined tick value. Results always round down to avoid exceeding the selected risk.</p></div>}
  {result ? <section className="mx-auto mt-10 max-w-2xl border border-emerald-400/25 bg-emerald-400/[0.06] p-5 sm:p-8"><div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-emerald-300" /><h2 className="font-podium text-3xl uppercase">Futures Results</h2></div><div className="mt-6 space-y-3"><ResultRow label="Instrument" value={`${instrument.code} · ${instrument.name}`} /><ResultRow label="Contracts to trade" value={result.contracts > 0 ? String(result.contracts) : '0 — risk budget too small'} highlight /><ResultRow label="Exact mathematical size" value={numberFormat.format(result.exactContracts)} /><ResultRow label="Risk budget" value={`USD ${numberFormat.format(result.budget)}`} /><ResultRow label="Actual risk after rounding" value={`USD ${numberFormat.format(result.actualRisk)}`} /><ResultRow label="Risk ratio" value={`${numberFormat.format(result.riskPercent)}%`} /><ResultRow label="Stop distance" value={`${numberFormat.format(result.stopTicks)} ticks · ${numberFormat.format(result.stopPoints)} points`} /><ResultRow label="Tick value" value={`USD ${instrument.tickValue.toFixed(2)}`} /><ResultRow label="Point value" value={`USD ${(instrument.tickValue / instrument.tickSize).toFixed(2)}`} />{result.contracts === 0 && <p className="border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">One contract would exceed your risk budget. Do not round up; use a smaller contract or a wider risk budget only if it fits your plan.</p>}<p className="pt-3 text-[10px] leading-5 text-white/35">Contract specifications can change. Confirm the active contract and tick value with your broker or exchange before placing an order.</p></div><button type="button" onClick={reset} className="mt-7 inline-flex w-full items-center justify-center gap-2 border border-emerald-300/40 px-6 py-4 text-xs font-bold uppercase tracking-widest text-emerald-300 hover:bg-emerald-300 hover:text-black"><RefreshCcw className="h-4 w-4" /> New Calculation</button></section> : <div className="mt-0 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]"><form onSubmit={calculate} className="border-2 border-emerald-400/35 bg-[#080d12]/95 p-5 shadow-[0_0_30px_rgba(52,211,153,0.1)] sm:p-8"><div className="grid gap-5 sm:grid-cols-2"><div className="sm:col-span-2"><span className="mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">Contract size</span><div className="grid grid-cols-2 border border-white/10 p-1"><ModeButton active={contractSize === 'mini'} onClick={() => changeSize('mini')}>E-mini / Standard</ModeButton><ModeButton active={contractSize === 'micro'} onClick={() => changeSize('micro')}>Micro</ModeButton></div></div><Field label="Futures contract"><select value={instrument.code} onChange={(e) => { setCode(e.target.value); setResult(null); setError(''); }} className="input-style">{available.map((item) => <option key={item.code} value={item.code}>{item.code} — {item.name}</option>)}</select></Field><Field label="Account size (USD)"><input type="number" min="0" step="any" inputMode="decimal" value={accountSize} onChange={(e) => setAccountSize(e.target.value)} placeholder="e.g. 25,000" className="input-style" /></Field><div className="sm:col-span-2"><span className="mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">Risk input</span><div className="mb-3 grid grid-cols-2 border border-white/10 p-1"><ModeButton active={riskMode === 'percent'} onClick={() => setRiskMode('percent')}>Percentage</ModeButton><ModeButton active={riskMode === 'money'} onClick={() => setRiskMode('money')}>Money (USD)</ModeButton></div>{riskMode === 'percent' ? <input type="number" min="0" max="100" step="any" inputMode="decimal" value={riskPercent} onChange={(e) => setRiskPercent(e.target.value)} placeholder="Risk ratio, %" className="input-style" /> : <input type="number" min="0" step="any" inputMode="decimal" value={riskMoney} onChange={(e) => setRiskMoney(e.target.value)} placeholder="Risk money, USD" className="input-style" />}</div><div className="sm:col-span-2"><span className="mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">Stop-loss input</span><div className="mb-3 grid grid-cols-2 border border-white/10 p-1"><ModeButton active={stopMode === 'ticks'} onClick={() => setStopMode('ticks')}>Use Ticks</ModeButton><ModeButton active={stopMode === 'levels'} onClick={() => setStopMode('levels')}>Use Price Levels</ModeButton></div>{stopMode === 'ticks' ? <Field label="Stop distance" hint={`1 tick = ${instrument.tickSize} ${instrument.unit} · $${instrument.tickValue.toFixed(2)}`}><input type="number" min="0" step="any" inputMode="decimal" value={stopTicks} onChange={(e) => setStopTicks(e.target.value)} placeholder="e.g. 20 ticks" className="input-style" /></Field> : <div className="grid gap-4 sm:grid-cols-2"><Field label="Entry price"><input type="number" min="0" step="any" inputMode="decimal" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} placeholder="Entry level" className="input-style" /></Field><Field label="Stop-loss price" hint="Ticks are calculated automatically"><input type="number" min="0" step="any" inputMode="decimal" value={stopPrice} onChange={(e) => setStopPrice(e.target.value)} placeholder="Stop level" className="input-style" /></Field></div>}</div></div>{error && <div className="mt-5 border border-red-400/30 bg-red-950/20 p-4 text-sm text-red-200" role="alert">{error}</div>}<div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={reset} className="inline-flex items-center justify-center gap-2 border border-white/15 px-5 py-4 text-xs font-bold uppercase tracking-widest text-white/65 hover:border-electric"><RefreshCcw className="h-4 w-4" /> Reset</button><button className="inline-flex items-center justify-center gap-2 bg-emerald-300 px-7 py-4 text-xs font-bold uppercase tracking-widest text-black hover:bg-emerald-200"><Calculator className="h-4 w-4" /> Calculate</button></div></form><aside className="h-fit border border-emerald-400/25 bg-emerald-400/[0.06] p-5 sm:p-7"><div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-emerald-300" /><h2 className="font-podium text-2xl uppercase">Contract Details</h2></div><div className="mt-6 space-y-3"><ResultRow label="Code" value={instrument.code} /><ResultRow label="Tick size" value={String(instrument.tickSize)} /><ResultRow label="Tick value" value={`$${instrument.tickValue.toFixed(2)}`} /><ResultRow label="Point value" value={`$${(instrument.tickValue / instrument.tickSize).toFixed(2)}`} /></div><p className="mt-5 text-[10px] leading-5 text-white/35">Sizing is based on whole contracts; fractional futures contracts cannot be traded.</p></aside></div>}</div></main>{calculating && <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-ink px-6 text-center" role="status" aria-live="assertive"><div className="relative h-24 w-24"><div className="absolute inset-0 animate-spin rounded-full border-2 border-white/10 border-t-emerald-300" /><div className="absolute inset-4 animate-[spin_1.3s_linear_infinite_reverse] rounded-full border border-emerald-300/20 border-b-electric" /></div><div className="mt-8 text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-300">Contract Risk</div><h2 className="mt-3 font-podium text-4xl uppercase sm:text-5xl">Calculating Futures Size</h2><p className="mt-4 max-w-md text-sm leading-7 text-white/50">Checking stop ticks, exchange tick value, and whole-contract risk.</p></div>}</div>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">{label}</span>{children}{hint && <span className="mt-2 block text-[10px] leading-4 text-white/35">{hint}</span>}</label>;
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`px-3 py-3 text-[10px] font-bold uppercase tracking-widest transition ${active ? 'bg-electric text-black shadow-glow' : 'text-white/45 hover:text-white'}`}>{children}</button>;
}

function ResultRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return <div className={`flex items-center justify-between gap-4 border px-4 py-4 ${highlight ? 'border-electric/40 bg-electric/10' : 'border-white/10 bg-black/25'}`}><span className="text-[10px] font-bold uppercase tracking-widest text-white/45">{label}</span><strong className={highlight ? 'text-xl text-electric' : 'text-sm text-white'}>{value}</strong></div>;
}

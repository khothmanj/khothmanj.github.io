/*
 * Kinhold message checker. Transparent rules, not an AI model: each warning sign is a short list
 * of phrases and patterns, all shown on the Method page. It finds where each sign appears so the
 * app can highlight it in the message, and it never says a message is safe.
 *
 * analyse({ from, subject, body, channel, knownSenders }) -> { signals, matches, level }
 */
(function (root) {
  'use strict';

  // Each rule: a signal id, a pattern, and a short reason shown on hover or tap.
  const RULES = [
    // A change of bank or payment details
    { signal: 'bank_change', re: /\b(new|updated|changed|different)\s+(bank|account|payment|salary)\s+(details|account|information)\b/gi, reason: 'Asks you to pay or update new bank details.' },
    { signal: 'bank_change', re: /\b(bank|account)\s+(details\s+)?(have|has)\s+(changed|been updated|moved)\b/gi, reason: 'Says the bank account has changed.' },
    { signal: 'bank_change', re: /\b(switched|changed)\s+banks?\b|\bmoved\s+to\s+a\s+new\s+bank\b/gi, reason: 'Says they have moved to a new bank.' },
    { signal: 'bank_change', re: /\bupdate\s+(my|our|the)\s+(salary|bank|payment|account)\s+details\b/gi, reason: 'Asks you to update bank details.' },

    // Urgency or pressure
    { signal: 'urgency', re: /\b(urgent(ly)?|immediately|straight away|right away|asap|as soon as possible)\b/gi, reason: 'Pressure to act quickly.' },
    { signal: 'urgency', re: /\bwithin\s+\d+\s+hours?\b|\bexpires?\s+in\s+\d+\s+hours?\b|\bin\s+\d+\s+hours?\b/gi, reason: 'A short deadline.' },
    { signal: 'urgency', re: /\b(before|by)\s+(\d{1,2}(\.\d{2})?\s*(am|pm)?|the bank closes|end of (the )?day|friday'?s? payment run|payroll runs?)\b/gi, reason: 'A deadline to stop you checking.' },
    { signal: 'urgency', re: /\b(today|now)\b(?=[^.]*\b(pay|send|verify|buy|update|confirm|act)\b)|\b(pay|send|verify|act|do it)\s+(today|now)\b/gi, reason: 'Wants it done today.' },
    { signal: 'urgency', re: /\b(today|tonight|this (morning|afternoon))\b(?=\s*[.!])/gi, reason: 'Wants it done today.' },
    { signal: 'urgency', re: /\b(will be|may be)\s+(suspended|closed|lost|returned|cancelled)\b|\bto avoid (a |any )?(delay|late fee|suspension)\b|\bis now overdue\b|\bget it done\b/gi, reason: 'A threat if you don\'t act.' },

    // Unusual payment
    { signal: 'unusual_payment', re: /\bgift\s?cards?\b|\b(amazon|itunes|google play|steam)\s+(cards?|vouchers?)\b/gi, reason: 'Gift cards are a common way scammers take money.' },
    { signal: 'unusual_payment', re: /\b(bitcoin|crypto(currency)?|usdt|ethereum)\b/gi, reason: 'Cryptocurrency payments are hard to trace or recover.' },
    { signal: 'unusual_payment', re: /\bnew supplier\b|\bnew payee\b/gi, reason: 'Paying someone new, outside the normal process.' },
    { signal: 'unusual_payment', re: /\bkeep (this|it) (between us|quiet|confidential|to yourself)\b|\bdon'?t tell\b|\bsort the expenses later\b/gi, reason: 'Secrecy, or skipping the normal approval.' },

    // Codes, passwords or remote access
    { signal: 'credentials', re: /\b(\d|six)-digit code\b|\b(verification|security|one[- ]time|login) code\b|\btext it back\b|\bread (me |out )?the code\b|\bsend me the codes?\b/gi, reason: 'Asks for a code. Never share codes.' },
    { signal: 'credentials', re: /\b(your )?(email )?password\b(?=[^.]*\b(enter|confirm|send|share|verify|give)\b)|\b(enter|confirm|send|share|give)\b[^.]*\bpassword\b/gi, reason: 'Asks for a password. No genuine company needs it.' },
    { signal: 'credentials', re: /\b(anydesk|teamviewer|quick ?assist)\b|\bremote(ly)?\s+(access|fix|connect|control)\b|\bfix it remotely\b/gi, reason: 'Asks for remote access to your computer.' },
    { signal: 'credentials', re: /\bverify (your|the) (account|identity|mailbox)\b|\bverify now\b/gi, reason: 'Asks you to log in through their link.' },

    // Impersonation of the boss, a colleague or a supplier
    { signal: 'impersonation', re: /\bit'?s me\b|\bthis is (your|the) (boss|director|ceo|manager|owner)\b/gi, reason: 'Claims to be someone you know, without proof.' },
    { signal: 'impersonation', re: /\b(from|it'?s \w+ from) your (it support|it company|it provider|bank)\b|\bfrom your IT support company\b/gi, reason: 'Claims to be your IT provider or bank.' },
    { signal: 'impersonation', re: /\b(i'?m|i am) in (a meeting|back-to-back meetings|meetings)\b|\bsent from my phone\b|\bare you at your desk\b/gi, reason: 'A typical opener in boss impersonation scams.' },

    // A fake voice or video
    { signal: 'voice_deepfake', re: /\bvoice ?note\b|\bnew number\b|\bon this number\b|\bborrowed (phone|number)\b/gi, reason: 'A new number or a voice note instead of a normal call.' },
    { signal: 'voice_deepfake', re: /\bcan'?t talk\b|\bmy phone'?s? (broken|died|dead)\b|\bvideo call\b/gi, reason: 'An excuse not to talk properly or be called back.' },
  ];

  const FREE_MAIL = /^(gmail|googlemail|outlook|hotmail|live|yahoo|icloud|me|aol|proton(mail)?)\.[a-z.]+$/i;

  const domainOf = (s) => { const m = String(s || '').match(/@([a-z0-9.-]+\.[a-z]{2,})/i); return m ? m[1].toLowerCase() : null; };
  // Squash a domain so lookalikes match: 1 to l, 0 to o, rn to m, and ignore dots and hyphens.
  const squash = (d) => d.toLowerCase().replace(/rn/g, 'm').replace(/1/g, 'l').replace(/0/g, 'o').replace(/[^a-z]/g, '');
  function editDistance(a, b) {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i].concat(Array(b.length).fill(0)));
    for (let j = 1; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return dp[a.length][b.length];
  }

  // Sender checks: a lookalike of a known address, or a personal address when you expect a business one.
  function senderSignals(from, knownSenders) {
    const out = [];
    const d = domainOf(from);
    if (!d || !knownSenders || !knownSenders.length) return out;
    const known = knownSenders.map((k) => k.toLowerCase());
    if (known.includes(d)) return out;
    const close = known.find((k) => squash(k) === squash(d) || editDistance(k.split('.')[0], d.split('.')[0]) <= 2);
    if (close) out.push({ signal: 'lookalike_domain', field: 'from', text: d, reason: 'Looks like ' + close + ', but it is ' + d + '.' });
    else if (FREE_MAIL.test(d)) out.push({ signal: 'impersonation', field: 'from', text: d, reason: 'A personal address (' + d + '), not the usual work one.' });
    return out;
  }

  // If someone pastes a whole email, pull a "From:" line out of it.
  function splitPasted(text) {
    const m = String(text || '').match(/^\s*from:\s*(.+)$/im);
    return m ? { from: m[1].trim() } : {};
  }

  function analyse(input) {
    const from = input.from || splitPasted(input.body).from || '';
    const fields = { subject: input.subject || '', body: input.body || '' };
    const matches = [];
    for (const [field, text] of Object.entries(fields)) {
      RULES.forEach((rule) => {
        rule.re.lastIndex = 0;
        let m;
        while ((m = rule.re.exec(text))) {
          if (!m[0]) { rule.re.lastIndex++; continue; }
          matches.push({ signal: rule.signal, field, start: m.index, end: m.index + m[0].length, text: m[0], reason: rule.reason });
        }
      });
    }
    senderSignals(from, input.knownSenders).forEach((s) => matches.push(s));
    if (/voice note/i.test(input.channel || '') && !matches.some((x) => x.signal === 'voice_deepfake')) matches.push({ signal: 'voice_deepfake', field: 'channel', text: input.channel, reason: 'A voice note instead of a normal call.' });

    // Remove overlapping highlights in the same field, keeping the earliest and longest.
    matches.sort((a, b) => (a.field > b.field ? 1 : a.field < b.field ? -1 : 0) || (a.start || 0) - (b.start || 0) || (b.end - b.start) - (a.end - a.start));
    const kept = [];
    matches.forEach((m) => {
      if (m.start === undefined) { kept.push(m); return; }
      const clash = kept.find((k) => k.field === m.field && k.start !== undefined && m.start < k.end && k.start < m.end);
      if (!clash) kept.push(m);
      else if (clash.signal !== m.signal) kept.push(Object.assign({}, m, { overlap: true })); // still counts as a sign, not highlighted twice
    });

    const signals = [...new Set(kept.map((m) => m.signal))];
    return { signals, matches: kept, level: levelFor(signals), from };
  }

  /*
   * Level rules:
   *   none   no warning signs
   *   high   codes or passwords, a fake voice, or a lookalike address; or a bank change or unusual
   *          payment together with any other sign; or three or more signs
   *   medium a bank change, unusual payment or impersonation on its own; or any two signs
   *   low    urgency on its own
   */
  function levelFor(signals) {
    const has = (s) => signals.includes(s);
    if (!signals.length) return 'none';
    if (has('credentials') || has('voice_deepfake') || has('lookalike_domain')) return 'high';
    if ((has('bank_change') || has('unusual_payment')) && signals.length >= 2) return 'high';
    if (signals.length >= 3) return 'high';
    if (signals.length === 2 || has('bank_change') || has('unusual_payment') || has('impersonation')) return 'medium';
    return 'low';
  }

  const api = { RULES, analyse, levelFor, domainOf, squash, senderSignals };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KinholdChecker = api;
})(typeof self !== 'undefined' ? self : this);

# Kinhold content review

Generated from the JSON in this folder by `tests/build-review.js`. Every source was checked on 2026-11-26. Edit the JSON, not this file.

## Start-of-check profile

- **What kind of business is it?** Shop or café / Salon, beauty or wellness / Agency, consultancy or office / Clinic or health practice / Trades or construction / Online shop / Something else
- **How many people work in the business, including you?** Just me / 2 to 9 / 10 to 49 / 50 or more
- **Do you sell or take bookings online?** Yes / No
- **Does your email address end in your own business name, like hello@yourbusiness.co.uk?** Yes / No, we use Gmail, Outlook or similar / Not sure
- **Do you send invoices to customers for them to pay by bank transfer?** Yes / No
- **Does anyone in the business use AI tools such as ChatGPT, Copilot or Gemini for work?** Yes / No / Not sure
- **Do you have an AI chatbot on your website or social media that answers customers?** Yes / No

Answers: Yes (1), Partly (0.5), No (0), Not sure (0, shown gently as something to check). Critical questions: pw1, pay1.

## 1. Passwords and sign-in

_How people log in to email, banking and key accounts._

### pw1. When you log in to your business email, do you have to confirm it's you with your phone, a code or a passkey?

- **Explained:** This second step is called 2-step verification. A passkey lets you sign in with your face, fingerprint or phone PIN instead of a password.
- **Why it matters:** Your email is the key to everything else. With it, a criminal can reset your other passwords and send invoices that look like they came from you.
- **Example:** A florist's email password is guessed. The criminal quietly reads invoices for a week, then emails a regular customer asking them to pay into a 'new' account.
- **Weight:** 3 (critical: caps the overall level)
- **Sources:** [NCSC: Small organisations guide: Secure your email](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/secure-your-email); [NCSC: Turn on 2-step verification (2SV)](https://www.ncsc.gov.uk/collection/top-tips-for-staying-secure-online/activate-2-step-verification-on-your-email)

**If it's a gap: Turn on 2-step verification for your business email** (15 minutes, free, owner: Owner, quick win)

Add a second check, such as a phone prompt, a code or a passkey, to every business email account. A stolen password alone then won't get anyone in. Start with your own account and anyone who handles money.

1. Open your email account's security settings (in Microsoft 365, Google Workspace or your provider's account page).
2. If you see 'Passkeys', set one up. Otherwise turn on '2-step verification'.
3. Choose an authenticator app or phone prompt if offered. A text message code is fine if that's the only choice.
4. Save the backup codes somewhere safe, such as your password manager, in case you lose your phone.
5. Repeat for every staff email account, starting with anyone who handles payments.

Sources: [NCSC: Small organisations guide: Secure your email](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/secure-your-email); [NCSC: Turn on 2-step verification (2SV)](https://www.ncsc.gov.uk/collection/top-tips-for-staying-secure-online/activate-2-step-verification-on-your-email)

### pw2. Is that second check also on for your business bank, social media, website, online storage and till or booking system?

- **Explained:** Most of these services have it in their security or account settings, often called '2-step verification', 'two-factor' or 'login approvals'.
- **Why it matters:** These accounts hold your money, your customers and your reputation. A stolen password alone shouldn't be enough to get in.
- **Example:** A salon's Instagram is taken over and used to message clients a fake 'deposit' link.
- **Weight:** 3
- **Sources:** [NCSC: Small organisations guide: Secure your important online accounts](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/secure-your-important-online-accounts); [Stop! Think Fraud (UK Government): Protect your business](https://stopthinkfraud.campaign.gov.uk/protecting-your-business)

**If it's a gap: Add 2-step verification to your bank, social media and key accounts** (30 minutes, free, owner: Owner, quick win)

Your bank, social media, website, online storage and till or booking system all need the same second check as your email. These accounts hold your money and your customers.

1. List your key accounts: business bank, social media, website and domain, online storage, till or booking system.
2. In each one, open the security or account settings and turn on 2-step verification or passkeys.
3. For online banking, check your bank's app or website for login approvals on every user.
4. Tick each account off your list as you go.

Sources: [NCSC: Small organisations guide: Secure your important online accounts](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/secure-your-important-online-accounts); [Stop! Think Fraud (UK Government): Protect your business](https://stopthinkfraud.campaign.gov.uk/protecting-your-business)

### pw3. Does everyone use a different password for each work account, saved in a password manager or their phone's or browser's built-in one?

- **Explained:** A password manager remembers your passwords for you, so each one can be long and different.
- **Why it matters:** When one website is breached, criminals try the same email and password everywhere else. Different passwords stop one leak becoming many.
- **Example:** A staff member reuses their gym password for the business email. The gym's site is breached, and the email is next.
- **Weight:** 2
- **Sources:** [NCSC: Small organisations guide: Secure your email](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/secure-your-email)

**If it's a gap: Use a password manager so every password can be different** (60 minutes, free or low cost, owner: All staff)

A password manager remembers passwords for you, so each account can have its own strong one. If everyone uses the same kind of phone, the one built into the phone or browser works well.

1. Choose one: the manager built into your phones or browser, or a password manager app if you use mixed devices.
2. Protect it with a strong main password made of three random words, plus 2-step verification.
3. Change any password that's used on more than one work account, starting with email and banking.
4. Let the manager create and save new passwords from now on.

Sources: [NCSC: Small organisations guide: Secure your email](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/secure-your-email); [NCSC: Small organisations guide: Protecting your devices](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/protecting-your-devices)

### pw4. Where your email or other accounts offer passkeys, have you turned them on?

- **Explained:** A passkey signs you in with your face, fingerprint or phone PIN. There's nothing to type, so there's nothing for a scammer to trick you into sharing.
- **Why it matters:** The NCSC now recommends passkeys first, because they can't be phished or reused like passwords.
- **Example:** A fake login page asks for a password. With a passkey there is no password to hand over.
- **Weight:** 1
- **Sources:** [NCSC: Small organisations guide: Secure your email](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/secure-your-email); [NCSC: Small organisations guide: Secure your important online accounts](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/secure-your-important-online-accounts)

**If it's a gap: Switch to passkeys where your accounts offer them** (20 minutes, free, owner: All staff, quick win)

Passkeys let you sign in with your face, fingerprint or phone PIN. There's no password to steal or be tricked into sharing, which is why the NCSC now recommends them first.

1. In your email account's security settings, look for 'Passkeys' and follow the steps.
2. Do the same for other key accounts that offer passkeys.
3. Keep 2-step verification on for any account that still has a password set.

Sources: [NCSC: Small organisations guide: Secure your email](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/secure-your-email); [NCSC: Small organisations guide: Secure your important online accounts](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/secure-your-important-online-accounts)

## 2. Who has access to what

_Who can get into which accounts, and what happens when people leave._

### ac1. When someone leaves, do you remove their access to email, banking and other accounts on their last day?

- **Explained:** This includes shared passwords they knew, and any accounts set up for contractors or temps.
- **Why it matters:** Old accounts are easy to forget and often have old passwords. They're a common way in.
- **Example:** A former employee's email is never closed. Months later it's used to send a fake invoice to a long-standing client.
- **Weight:** 3. Not asked if size is solo.
- **Sources:** [NCSC: Small organisations guide: Secure your important online accounts](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/secure-your-important-online-accounts)

**If it's a gap: Remove leavers' access on their last day** (30 minutes, free, owner: Office manager, quick win)

Make removing access part of every leaver's last day: email, bank, cloud storage, social media and any shared passwords they knew. Old accounts are an easy way in.

1. Use the staff security checklist in the toolkit for every leaver.
2. Disable their email and other accounts at the end of their last day.
3. Change any shared passwords they knew, such as the Wi-Fi or a shared login.
4. Check today for anyone who has already left but still has an account, and remove them.

Sources: [NCSC: Small organisations guide: Secure your important online accounts](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/secure-your-important-online-accounts)

### ac2. Does each person have their own login, rather than several people sharing one?

- **Explained:** Shared logins are things like one 'office@' account or one till login everybody uses.
- **Why it matters:** With shared logins you can't remove one person's access without changing it for everyone, and you can't see who did what.
- **Example:** The whole team knows the bookings password. When someone leaves on bad terms, nobody changes it.
- **Weight:** 2. Not asked if size is solo.
- **Sources:** [NCSC: Cyber Essentials](https://www.ncsc.gov.uk/cyberessentials/overview); [NCSC: Small organisations guide: Secure your important online accounts](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/secure-your-important-online-accounts)

**If it's a gap: Give everyone their own login** (120 minutes, free or low cost, owner: Office manager)

Replace shared logins with one account per person where the service allows it. You can then remove one person's access without changing it for everyone, and see who did what.

1. List the logins that more than one person uses.
2. For each service, check whether you can add separate users. Most email, booking and till systems allow it.
3. Create individual accounts with 2-step verification and retire the shared one.
4. Where a shared login can't be avoided, keep it in a password manager and change it when anyone leaves.

Sources: [NCSC: Cyber Essentials](https://www.ncsc.gov.uk/cyberessentials/overview); [NCSC: Small organisations guide: Secure your important online accounts](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/secure-your-important-online-accounts)

### ac3. Do only the people who need it have access to the bank account, payroll and customer records?

- **Explained:** This is sometimes called tiered access: people get what their job needs, and no more.
- **Why it matters:** The fewer people who can move money or see customer details, the fewer accounts a criminal can use to do damage.
- **Example:** A part-time assistant's account can approve payments it never needs to. When it's hacked, so is the bank.
- **Weight:** 2. Not asked if size is solo.
- **Sources:** [NCSC: Cyber Essentials](https://www.ncsc.gov.uk/cyberessentials/overview); [Stop! Think Fraud (UK Government): Protect your business](https://stopthinkfraud.campaign.gov.uk/protecting-your-business)

**If it's a gap: Limit who can see money and customer records** (60 minutes, free, owner: Owner)

Give each person access to what their job needs, and no more. Fewer people who can move money or see customer details means fewer accounts a criminal can misuse.

1. List who can access the bank, payroll and customer records today.
2. Remove access for anyone who doesn't need it for their job.
3. In online banking, set users to 'view only' or 'create but not approve' where that fits their role.
4. Write the list down so it's easy to review.

Sources: [NCSC: Cyber Essentials](https://www.ncsc.gov.uk/cyberessentials/overview); [Stop! Think Fraud (UK Government): Protect your business](https://stopthinkfraud.campaign.gov.uk/protecting-your-business)

### ac4. Do you check who has access to your important accounts every few months?

- **Explained:** Look at the list of users on your email, bank, website and cloud storage, and remove anyone who shouldn't be there.
- **Why it matters:** People change roles and suppliers come and go. A quick review catches the accounts nobody remembers.
- **Example:** A web designer from three years ago still has admin access to the shop's website.
- **Weight:** 1
- **Sources:** [NCSC: Small organisations guide: Secure your important online accounts](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/secure-your-important-online-accounts)

**If it's a gap: Review who has access every three months** (15 minutes, free, owner: Office manager, quick win)

Put a 15-minute review in the diary every three months. Check the users on email, bank, website and cloud storage, and remove anyone who shouldn't be there.

1. Add a repeating calendar reminder every three months.
2. Open the user list in each key account and compare it with who works with you now.
3. Remove old staff, past contractors and suppliers who no longer need access.

Sources: [NCSC: Small organisations guide: Secure your important online accounts](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/secure-your-important-online-accounts)

## 3. Devices and updates

_Phones, laptops and tablets used for work._

### dv1. Are updates set to install automatically on your work computers, phones and tablets?

- **Explained:** Updates fix weaknesses that criminals know about. 'Automatic updates' is usually in the device's settings.
- **Why it matters:** Most attacks use weaknesses that already have a fix. Keeping up to date closes the door. Cyber Essentials expects security updates within 14 days.
- **Example:** A shop laptop hasn't been updated in a year. A known weakness lets ransomware lock every file.
- **Weight:** 3
- **Sources:** [NCSC: Small organisations guide: Protecting your devices](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/protecting-your-devices); [NCSC: Cyber Essentials: Requirements for IT infrastructure v3.3](https://www.ncsc.gov.uk/sites/default/files/2026-11/Cyber-Essentials-Requirements-for-IT-Infrastructure-v3-3.pdf)

**If it's a gap: Turn on automatic updates everywhere** (20 minutes, free, owner: All staff, quick win)

Set every work computer, phone and tablet, and their apps and browsers, to update automatically. Most attacks use weaknesses that already have a fix.

1. On each device, open Settings and find 'Software update' or 'Windows Update'.
2. Turn on automatic updates, including for apps.
3. Restart devices and browsers when asked, so updates actually install.
4. Check once a month that each device says it's up to date.

Sources: [NCSC: Small organisations guide: Protecting your devices](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/protecting-your-devices); [NCSC: Cyber Essentials: Requirements for IT infrastructure v3.3](https://www.ncsc.gov.uk/sites/default/files/2026-11/Cyber-Essentials-Requirements-for-IT-Infrastructure-v3-3.pdf)

### dv2. Are all your work devices new enough to still get updates from the maker?

- **Explained:** Older phones and laptops stop getting updates after a few years. Your device's settings usually say if it's up to date.
- **Why it matters:** A device that no longer gets updates can't be fixed when a new weakness is found. You don't need the latest model, just a supported one.
- **Example:** The till computer runs an old version of Windows that stopped getting security fixes years ago.
- **Weight:** 2
- **Sources:** [NCSC: Small organisations guide: Protecting your devices](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/protecting-your-devices); [NCSC: Cyber Essentials: Requirements for IT infrastructure v3.3](https://www.ncsc.gov.uk/sites/default/files/2026-11/Cyber-Essentials-Requirements-for-IT-Infrastructure-v3-3.pdf)

**If it's a gap: Replace devices that no longer get updates** (60 minutes, some cost, owner: Owner)

Find any computer, phone or tablet that's too old for updates and plan to replace it. You don't need the latest model, just one the maker still supports.

1. Check each device's settings to see if updates are still available.
2. List any that are no longer supported, and what they're used for.
3. Replace the ones that handle email, payments or customer data first.
4. Wipe old devices properly before selling or recycling them.

Sources: [NCSC: Small organisations guide: Protecting your devices](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/protecting-your-devices); [NCSC: Cyber Essentials: Requirements for IT infrastructure v3.3](https://www.ncsc.gov.uk/sites/default/files/2026-11/Cyber-Essentials-Requirements-for-IT-Infrastructure-v3-3.pdf)

### dv3. Does every phone, tablet and laptop used for work lock with a PIN, password, face or fingerprint?

- **Explained:** This includes staff's own phones if they read work email or messages on them.
- **Why it matters:** Phones and tablets leave the building and get lost. A screen lock keeps customer details and accounts private if that happens.
- **Example:** A tablet used for bookings is left in a café, unlocked, with every client's phone number on it.
- **Weight:** 2
- **Sources:** [NCSC: Small organisations guide: Protecting your devices](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/protecting-your-devices)

**If it's a gap: Lock every work device with a PIN or fingerprint** (10 minutes, free, owner: All staff, quick win)

Every phone, tablet and laptop used for work should need a 6-digit PIN, a strong password, a face or a fingerprint to open. That includes staff's own phones if they read work email.

1. Open each device's settings and set a 6-digit PIN or strong password.
2. Add face or fingerprint unlock if available.
3. Avoid easy PINs like 123456 or birthdays.
4. Ask staff to do the same on personal phones used for work.

Sources: [NCSC: Small organisations guide: Protecting your devices](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/protecting-your-devices)

### dv4. On work laptops and computers, do people use a standard account day to day, rather than the administrator account?

- **Explained:** The administrator account can install anything and change any setting. A standard account can't.
- **Why it matters:** If something nasty gets in while you're using a standard account, it can do far less damage.
- **Example:** A fake 'invoice' attachment installs itself because it was opened on the administrator account.
- **Weight:** 1
- **Sources:** [NCSC: Small organisations guide: Secure your important online accounts](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/secure-your-important-online-accounts); [NCSC: Cyber Essentials](https://www.ncsc.gov.uk/cyberessentials/overview)

**If it's a gap: Use a standard account for everyday work** (30 minutes, free, owner: Office manager)

Create a standard user account on each computer for daily work, and keep the administrator account for installing software. Anything that sneaks in can then do much less harm.

1. Sign in with the administrator account and add a new standard user.
2. Move everyday work to the standard account.
3. Only sign in as administrator when you need to install or change something.

Sources: [NCSC: Small organisations guide: Secure your important online accounts](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/secure-your-important-online-accounts); [NCSC: Cyber Essentials](https://www.ncsc.gov.uk/cyberessentials/overview)

## 4. Backups

_A spare copy of what you need to keep trading._

### bk1. Do you back up the things your business needs to keep trading, such as customer records, invoices, emails and your website?

- **Explained:** A backup is a spare copy, either online (like OneDrive, Google Drive or iCloud) or on an external drive.
- **Why it matters:** If a device is lost or ransomware locks your files, a backup means you can carry on instead of starting from nothing.
- **Example:** A builder's laptop is stolen from a van with two years of quotes and invoices on it, and no copy anywhere else.
- **Weight:** 3
- **Sources:** [NCSC: Small organisations guide: Backing up your data](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/backing-up-your-data)

**If it's a gap: Back up what you need to keep trading** (60 minutes, free or low cost, owner: Owner)

Make sure customer records, invoices, emails, documents and your website are copied somewhere else, automatically. If a device is lost or locked by ransomware, you can carry on.

1. List what you'd need to keep trading if your main computer disappeared.
2. Turn on automatic online backup (for example OneDrive, Google Drive or iCloud) for those files.
3. Check your website and booking or till system providers keep backups, and how you'd get them.
4. Protect the backup account with 2-step verification.

Sources: [NCSC: Small organisations guide: Backing up your data](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/backing-up-your-data)

### bk2. Is there a second copy kept apart, such as a drive you unplug after use, or an online backup protected with 2-step verification?

- **Explained:** Ransomware can reach a backup drive that stays plugged in. Unplugging it keeps the copy out of reach.
- **Why it matters:** Two copies kept in different ways mean one problem can't take out both.
- **Example:** Ransomware locks the office computer and the backup drive that was left plugged into it.
- **Weight:** 2
- **Sources:** [NCSC: Small organisations guide: Backing up your data](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/backing-up-your-data)

**If it's a gap: Keep a second copy apart from the first** (30 minutes, low cost, owner: Office manager)

Add a second backup kept in a different way, such as an external drive you unplug after use. Then one problem can't take out both copies.

1. Buy an external drive large enough for your important files.
2. Copy your important files to it, for example once a week.
3. Unplug it after each backup and keep it somewhere safe.
4. Put a weekly reminder in the diary.

Sources: [NCSC: Small organisations guide: Backing up your data](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/backing-up-your-data)

### bk3. Have you tried restoring something from your backup to check it works?

- **Explained:** Pick one file or folder and get it back from the backup. It takes a few minutes.
- **Why it matters:** Many people find out their backup was incomplete only when they need it.
- **Example:** A clinic's backup had been failing quietly for months. Nobody had checked.
- **Weight:** 2
- **Sources:** [NCSC: Small organisations guide: Backing up your data](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/backing-up-your-data)

**If it's a gap: Test that your backup actually works** (15 minutes, free, owner: Office manager, quick win)

Restore one file or folder from your backup and check it opens. Many businesses only discover a broken backup when they need it.

1. Pick a recent, important file.
2. Restore it from the backup to a different folder.
3. Open it and check it's complete and up to date.
4. Repeat every few months.

Sources: [NCSC: Small organisations guide: Backing up your data](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/backing-up-your-data)

## 5. Email and phishing

_Spotting, reporting and blocking scam emails._

### em1. Do staff know how to report a suspicious email, and would they feel able to say so even if they'd already clicked the link?

- **Explained:** Reporting can be as simple as 'forward it to me and don't click anything'.
- **Why it matters:** The NCSC warns that blaming staff makes them hide mistakes. The sooner you hear about a click, the less damage it does.
- **Example:** A new starter clicks a fake delivery link, feels embarrassed and says nothing for a week.
- **Weight:** 2
- **Sources:** [NCSC: Phishing attacks: defending your organisation](https://www.ncsc.gov.uk/guidance/phishing); [NCSC: Report a scam email](https://www.ncsc.gov.uk/collection/phishing-scams/report-scam-email)

**If it's a gap: Make reporting a suspicious email easy and blame-free** (15 minutes, free, owner: Owner, quick win)

Tell everyone exactly how to report a suspicious email, and that they'll be thanked even if they've already clicked. Early reports limit the damage.

1. Agree one simple rule, for example 'forward it to the owner and don't click anything'.
2. Tell everyone, and add it to the staff security checklist.
3. When someone reports a click, thank them and act quickly. Never tell them off.

Sources: [NCSC: Phishing attacks: defending your organisation](https://www.ncsc.gov.uk/guidance/phishing); [NCSC: Report a scam email](https://www.ncsc.gov.uk/collection/phishing-scams/report-scam-email)

### em2. Do you forward scam emails to the NCSC's free reporting service at report@phishing.gov.uk?

- **Explained:** It takes a minute. The NCSC checks the email and can take down the scam website.
- **Why it matters:** Reporting gets scam sites removed and protects other businesses too.
- **Example:** A fake 'HMRC refund' email is forwarded, and the site behind it is taken down.
- **Weight:** 1
- **Sources:** [NCSC: Report a scam email](https://www.ncsc.gov.uk/collection/phishing-scams/report-scam-email)

**If it's a gap: Forward scam emails to report@phishing.gov.uk** (5 minutes, free, owner: All staff, quick win)

Forward scam emails to the NCSC's free service. It takes a minute, and the NCSC can take down the scam sites behind them.

1. Save report@phishing.gov.uk as a contact.
2. Forward suspicious emails to it, then delete them.
3. Don't click links in the email while you do it.

Sources: [NCSC: Report a scam email](https://www.ncsc.gov.uk/collection/phishing-scams/report-scam-email)

### em3. Has your email or website provider set up the anti-spoofing records for your email address (called SPF, DKIM and DMARC)?

- **Explained:** These settings tell other email services which senders are really you, so scammers find it harder to fake your address.
- **Why it matters:** Without them, a criminal can send email that appears to come from your exact address to your customers and suppliers.
- **Example:** Customers receive an email 'from' a café's own address asking them to update payment details.
- **Weight:** 1. Only if domain is yes or unsure.
- **Sources:** [NCSC: Phishing attacks: defending your organisation](https://www.ncsc.gov.uk/guidance/phishing)

**If it's a gap: Ask your provider to set up email anti-spoofing** (30 minutes, free or low cost, owner: Owner)

Ask whoever runs your email or website to set up SPF, DKIM and DMARC for your domain. These make it much harder for scammers to send email that appears to come from your exact address.

1. Find out who manages your domain and email, such as your web designer or IT provider.
2. Ask them to set up SPF, DKIM and DMARC for your domain.
3. Ask them to confirm when it's done and what DMARC policy they've set.

Sources: [NCSC: Phishing attacks: defending your organisation](https://www.ncsc.gov.uk/guidance/phishing)

### em4. Have you checked what your website and social media reveal, such as staff names, roles and who your suppliers are?

- **Explained:** Criminals use these details to make scam emails sound like they come from someone you know.
- **Why it matters:** The less a scammer can learn about who pays whom, the harder it is to write a convincing fake.
- **Example:** A 'Meet the team' page names the finance assistant. A week later she gets an email 'from the director' asking for an urgent payment.
- **Weight:** 1
- **Sources:** [NCSC: Small organisations guide: Spotting cyber attacks](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/spotting-cyber-attacks)

**If it's a gap: Trim what your website and social media give away** (30 minutes, free, owner: Owner, quick win)

Check your website and social pages for details a scammer could use, such as who handles payments or which suppliers you use. Remove anything customers don't need.

1. Read your website's team, about and news pages as if you were a scammer.
2. Remove details about who handles payments, and named suppliers or banks.
3. Check social media privacy settings, and who can post for the business.

Sources: [NCSC: Small organisations guide: Spotting cyber attacks](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/spotting-cyber-attacks)

## 6. Payments and invoice fraud

_How money leaves the business, and how scammers try to redirect it._

### pay1. If a supplier asks to change their bank details, do you phone them on a number you already have, not one in the message, before paying?

- **Explained:** Use the number from an old invoice, your contacts or their official website. Never the one in the email or letter asking for the change.
- **Why it matters:** This one check stops most invoice fraud. It's rare for businesses to change bank accounts, so treat every request with care.
- **Example:** A 'supplier' emails a new account number with their usual invoice. It's a lookalike email address, and the money is gone the same day.
- **Weight:** 3 (critical: caps the overall level)
- **Sources:** [Stop! Think Fraud (UK Government): Protect your business](https://stopthinkfraud.campaign.gov.uk/protecting-your-business); [NCSC: Phishing attacks: defending your organisation](https://www.ncsc.gov.uk/guidance/phishing); [Payment Systems Regulator: APP scams](https://www.psr.org.uk/our-work/app-scams/)

**If it's a gap: Always phone to check a change of bank details** (15 minutes, free, owner: Owner, quick win)

Before paying new bank details, phone the supplier on a number you already have, never one in the message. Confirm both the old and new details. This single check stops most invoice fraud.

1. Make it a rule: no change of bank details is paid until it's been confirmed by phone.
2. Use the number from an old invoice, your contacts or the supplier's official website.
3. Ask them to confirm the old and new account details.
4. Use your bank's Confirmation of Payee check when you set up the payment, and stop if the name doesn't match.
5. Write it into the payment verification procedure in the toolkit.

Sources: [Stop! Think Fraud (UK Government): Protect your business](https://stopthinkfraud.campaign.gov.uk/protecting-your-business); [NCSC: Phishing attacks: defending your organisation](https://www.ncsc.gov.uk/guidance/phishing); [Payment Systems Regulator: APP scams](https://www.psr.org.uk/our-work/app-scams/)

### pay2. Do payments over a set amount need a second person to approve them?

- **Explained:** For example: one person sets up the payment and another checks and approves it.
- **Why it matters:** Government fraud guidance says no one person should both approve and pay. A second pair of eyes catches pressure and mistakes.
- **Example:** An office manager, rushed by an 'urgent' email from the director, pays £8,400 with nobody else checking.
- **Weight:** 3. Not asked if size is solo.
- **Sources:** [Stop! Think Fraud (UK Government): Protect your business](https://stopthinkfraud.campaign.gov.uk/protecting-your-business)

**If it's a gap: Have a second person approve larger payments** (30 minutes, free, owner: Owner, quick win)

Set an amount above which one person sets up a payment and another approves it. No one person should both approve and pay.

1. Choose the amount, for example £1,000.
2. In online banking, set up a second approver for payments over that amount, if your bank offers it.
3. If it doesn't, agree that a second person checks the invoice and details before paying.
4. Write it into the payment verification procedure.

Sources: [Stop! Think Fraud (UK Government): Protect your business](https://stopthinkfraud.campaign.gov.uk/protecting-your-business)

### pay3. Do new or changed bank details wait a few days before you pay them, so there's time to check?

- **Explained:** Some businesses wait 14 or 30 days before using new supplier bank details for the first time.
- **Why it matters:** Scammers rely on urgency. A built-in pause gives you time to confirm the change is real.
- **Example:** A fake bank change arrives the day before a big payment run. The pause gives time for the real supplier to say 'that wasn't us'.
- **Weight:** 2
- **Sources:** [Stop! Think Fraud (UK Government): Protect your business](https://stopthinkfraud.campaign.gov.uk/protecting-your-business)

**If it's a gap: Add a waiting period for new bank details** (15 minutes, free, owner: Owner, quick win)

Agree that new or changed bank details aren't used for a set time, such as 14 days, unless they've been confirmed by phone. Scammers rely on urgency.

1. Pick a waiting period that suits your cash flow, such as 14 days.
2. Note the date any bank details change, and when they can first be used.
3. Add it to the payment verification procedure.

Sources: [Stop! Think Fraud (UK Government): Protect your business](https://stopthinkfraud.campaign.gov.uk/protecting-your-business)

### pay4. Have you told staff that you, and anyone senior, will never ask for an urgent payment by email, text or phone call?

- **Explained:** A simple rule everyone knows makes a fake 'boss' request easy to spot.
- **Why it matters:** CEO fraud works by using authority and urgency. A known rule takes away both.
- **Example:** 'I'm in a meeting, just pay this now and I'll explain later.' Staff who know the rule stop and check.
- **Weight:** 2. Not asked if size is solo.
- **Sources:** [Stop! Think Fraud (UK Government): Protect your business](https://stopthinkfraud.campaign.gov.uk/protecting-your-business)

**If it's a gap: Tell staff the boss will never ask for an urgent payment** (10 minutes, free, owner: Owner, quick win)

Agree and announce one rule: nobody senior will ever ask for an urgent payment by email, text or call. Any such request is checked by calling back on a known number.

1. Say it at the next team meeting, or by email.
2. Add it to the staff security checklist and the payment procedure.
3. Praise anyone who stops to check, even when the request turns out to be real.

Sources: [Stop! Think Fraud (UK Government): Protect your business](https://stopthinkfraud.campaign.gov.uk/protecting-your-business)

### pay5. Do your own invoices tell customers that your bank details won't change by email, and how to check if they're ever unsure?

- **Explained:** One line on your invoices, like 'Our bank details will never change by email. If in doubt, call us on our usual number.'
- **Why it matters:** Criminals also pretend to be you to your customers. Telling them what to expect gives them a chance to spot it.
- **Example:** A customer receives a 'new bank details' email from a lookalike of your address, remembers the note on your invoices and calls you.
- **Weight:** 1. Only if invoices is yes.
- **Sources:** [NCSC: Phishing attacks: defending your organisation](https://www.ncsc.gov.uk/guidance/phishing); [Stop! Think Fraud (UK Government): Protect your business](https://stopthinkfraud.campaign.gov.uk/protecting-your-business)

**If it's a gap: Tell customers your bank details won't change by email** (10 minutes, free, owner: Office manager, quick win)

Add one line to your invoices and email footer saying your bank details won't change by email, and to call your usual number if in doubt. It helps customers spot fakes of you.

1. Add to your invoice template: 'Our bank details will never change by email. If in doubt, call us on our usual number.'
2. Add the same line to your email signature.

Sources: [NCSC: Phishing attacks: defending your organisation](https://www.ncsc.gov.uk/guidance/phishing); [Stop! Think Fraud (UK Government): Protect your business](https://stopthinkfraud.campaign.gov.uk/protecting-your-business)

## 7. Customer data and UK GDPR

_The personal information you hold, and what to do if it's lost._

### dt1. Do you know what customer and staff information you hold, and where it's kept, such as email, spreadsheets, booking systems or paper?

- **Explained:** Personal information is anything that identifies someone: names, phone numbers, addresses, health notes, bank details.
- **Why it matters:** You can only protect what you know you have. It's also the first thing you'll need if information is ever lost.
- **Example:** A salon keeps client allergy notes in a booking app, a spreadsheet and a paper diary, and only remembers two of them.
- **Weight:** 2
- **Sources:** [ICO: Advice for small and medium organisations](https://ico.org.uk/for-organisations/advice-for-small-organisations/); [ICO: Principle (c): Data minimisation](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/data-minimisation/)

**If it's a gap: List what personal information you hold, and where** (60 minutes, free, owner: Owner)

Make a simple list of the customer and staff information you hold and where it lives: email, spreadsheets, apps, paper. You can only protect what you know about.

1. Write down each kind of information you collect, such as names, contact details, health notes or bank details.
2. Next to each, note where it's kept and who can see it.
3. Mark anything sensitive, such as health information, for extra care.

Sources: [ICO: Advice for small and medium organisations](https://ico.org.uk/for-organisations/advice-for-small-organisations/); [ICO: Principle (c): Data minimisation](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/data-minimisation/)

### dt2. Do you only collect the information you actually need?

- **Explained:** For example, a booking form that asks for a date of birth when you don't need it.
- **Why it matters:** UK GDPR says personal data should be limited to what you need. Less information held means less to lose.
- **Example:** An online shop asks every customer for their date of birth and never uses it, until it's leaked.
- **Weight:** 1
- **Sources:** [ICO: Principle (c): Data minimisation](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/data-minimisation/)

**If it's a gap: Stop collecting information you don't need** (30 minutes, free, owner: Owner, quick win)

Check your forms and processes for details you never use, and stop asking for them. Less information held means less to lose.

1. Look at your booking, order and sign-up forms.
2. Remove fields you don't use, such as date of birth if you don't need it.
3. Delete old information you collected but never needed.

Sources: [ICO: Principle (c): Data minimisation](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/data-minimisation/)

### dt3. Do you delete customer information when you no longer need it, on a regular timetable?

- **Explained:** This is called a retention period: how long you keep each kind of record before deleting it.
- **Why it matters:** UK GDPR says not to keep personal data longer than you need it, and old records are a risk with no benefit.
- **Example:** A breach exposes ten years of old customer records that nobody needed any more.
- **Weight:** 1
- **Sources:** [ICO: Principle (e): Storage limitation](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/)

**If it's a gap: Set how long you keep customer records** (60 minutes, free, owner: Owner)

Decide how long you keep each kind of record, then delete it after that. Don't keep personal data longer than you need it.

1. For each kind of record, decide how long you need it, considering any legal or accounting rules that apply to you.
2. Write the periods down in one place.
3. Put a yearly reminder in the diary to delete what's past its date.

Sources: [ICO: Principle (e): Storage limitation](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/)

### dt4. If personal information was lost or stolen, would you know that you may need to tell the ICO within 72 hours, and how?

- **Explained:** The ICO is the UK's data protection regulator. Not every breach needs reporting, and the ICO has a tool to help you decide.
- **Why it matters:** If a breach is likely to put people at risk, the law expects you to report it, where feasible within 72 hours. Knowing in advance saves panic.
- **Example:** A laptop with client records is stolen on Friday. On Monday the owner realises the 72 hours are nearly up.
- **Weight:** 2
- **Sources:** [ICO: UK GDPR data breach reporting](https://ico.org.uk/for-organisations/report-a-breach/personal-data-breach/)

**If it's a gap: Know how to report a data breach to the ICO** (20 minutes, free, owner: Owner, quick win)

If personal information is lost or stolen and that's likely to put people at risk, you may need to tell the ICO within 72 hours where feasible. Know the steps before you need them.

1. Bookmark the ICO's data breach reporting page.
2. Add 'decide whether to report to the ICO within 72 hours' to your incident one-pager.
3. Note what the ICO will ask: what happened, who's affected and what you're doing about it.
4. If unsure whether to report, use the ICO's self-assessment tool.

Sources: [ICO: UK GDPR data breach reporting](https://ico.org.uk/for-organisations/report-a-breach/personal-data-breach/)

## 8. Suppliers and online services

_The websites, tools and providers you rely on._

### sp1. Do you have a list of the online services you rely on, such as your website, domain, payment provider, booking or till system and cloud storage?

- **Explained:** Just a simple list: the service, who has the login, and how to contact them.
- **Why it matters:** These accounts keep you trading. Knowing what they are is the first step to protecting them and recovering fast.
- **Example:** The website goes down, and nobody knows which company hosts it or who has the login.
- **Weight:** 1
- **Sources:** [NCSC: Small organisations guide: Secure your important online accounts](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/secure-your-important-online-accounts); [NCSC: Cyber Essentials: Requirements for IT infrastructure v3.3](https://www.ncsc.gov.uk/sites/default/files/2026-11/Cyber-Essentials-Requirements-for-IT-Infrastructure-v3-3.pdf)

**If it's a gap: Write a list of the online services you rely on** (30 minutes, free, owner: Office manager, quick win)

Make a one-page list of your website, domain, payment provider, booking or till system and cloud storage, who holds each login, and how to contact the provider. When something breaks or is hacked, you'll know exactly who to call.

1. List each online service the business relies on.
2. Note who has the login, whether 2-step verification is on, and the provider's support contact.
3. Keep the list with your incident one-pager.

Sources: [NCSC: Small organisations guide: Secure your important online accounts](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/secure-your-important-online-accounts); [NCSC: Cyber Essentials: Requirements for IT infrastructure v3.3](https://www.ncsc.gov.uk/sites/default/files/2026-11/Cyber-Essentials-Requirements-for-IT-Infrastructure-v3-3.pdf)

### sp2. When you choose an IT provider or an important supplier, do you ask about their security, for example whether they hold Cyber Essentials?

- **Explained:** Cyber Essentials is a government-backed scheme that shows an organisation has the basic protections in place.
- **Why it matters:** A supplier with weak security can become the way in to your business, or the source of a fake invoice.
- **Example:** A supplier's email is hacked and used to send their customers invoices with new bank details.
- **Weight:** 1
- **Sources:** [Stop! Think Fraud (UK Government): Protect your business](https://stopthinkfraud.campaign.gov.uk/protecting-your-business); [NCSC: Cyber Essentials](https://www.ncsc.gov.uk/cyberessentials/overview)

**If it's a gap: Ask key suppliers about their security** (30 minutes, free, owner: Owner)

When you choose or renew an IT provider or important supplier, ask how they protect your data and whether they hold Cyber Essentials. Government fraud guidance suggests asking for it in contracts.

1. List suppliers who hold your data or can reach your systems, such as IT support or your web host.
2. Ask whether they hold Cyber Essentials, and how they'd tell you about a problem.
3. For new contracts, consider asking for Cyber Essentials.

Sources: [Stop! Think Fraud (UK Government): Protect your business](https://stopthinkfraud.campaign.gov.uk/protecting-your-business); [NCSC: Cyber Essentials](https://www.ncsc.gov.uk/cyberessentials/overview)

## 9. If something goes wrong

_Knowing what to do in the first hour._

### ir1. Is there a short written note of what to do in the first hour if you're hacked or scammed, with the numbers to call?

- **Explained:** One page is enough: who to call, what to switch off, and where to report it.
- **Why it matters:** In a crisis people freeze. A note on the wall means the right calls happen in the right order.
- **Example:** A payment goes to a scammer at 4pm. Because the bank's fraud line is on the note, they call within minutes.
- **Weight:** 2
- **Sources:** [NCSC: Small Business Guide: Response and Recovery](https://www.ncsc.gov.uk/collection/small-business-guidance--response-and-recovery); [NCSC: Business payment fraud](https://www.ncsc.gov.uk/section/respond-recover/ml-business-payment-fraud)

**If it's a gap: Put a one-page 'first hour' plan on the wall** (30 minutes, free, owner: Owner, quick win)

Write down what to do in the first hour if you're hacked or scammed: who to call, what to switch off and where to report. In a crisis, people follow a list.

1. Download the incident response one-pager from the toolkit.
2. Fill in your bank's fraud line, your IT contact and who takes charge.
3. Print it and keep a copy somewhere everyone knows, plus one on your phone.

Sources: [NCSC: Small Business Guide: Response and Recovery](https://www.ncsc.gov.uk/collection/small-business-guidance--response-and-recovery); [NCSC: Business payment fraud](https://www.ncsc.gov.uk/section/respond-recover/ml-business-payment-fraud)

### ir2. Do you know where to report fraud or a cyber attack: your bank straight away, then Report Fraud on 0300 123 2040?

- **Explained:** Report Fraud replaced Action Fraud in December 2025. It's the police service for reporting fraud and cyber crime.
- **Why it matters:** Calling your bank fast gives the best chance of stopping a payment. Reporting helps the police and gets you support.
- **Example:** A business realises it paid a fake invoice. Calling the bank within the hour, the payment is frozen before it leaves.
- **Weight:** 2
- **Sources:** [City of London Police: Report Fraud (replaced Action Fraud)](https://www.reportfraud.police.uk/); [NCSC: Business payment fraud](https://www.ncsc.gov.uk/section/respond-recover/ml-business-payment-fraud); [NCSC: Small Business Guide: Response and Recovery](https://www.ncsc.gov.uk/collection/small-business-guidance--response-and-recovery)

**If it's a gap: Save your bank's fraud line and Report Fraud's number** (10 minutes, free, owner: All staff, quick win)

If money goes to a scammer, call your bank straight away on its official number, then report it to Report Fraud on 0300 123 2040. Speed gives the best chance of stopping the payment.

1. Find your bank's fraud phone number on its official website or the back of your card.
2. Save it, and Report Fraud's number (0300 123 2040), in your phone.
3. Add both to your incident one-pager.

Sources: [City of London Police: Report Fraud (replaced Action Fraud)](https://www.reportfraud.police.uk/); [NCSC: Business payment fraud](https://www.ncsc.gov.uk/section/respond-recover/ml-business-payment-fraud); [NCSC: Small Business Guide: Response and Recovery](https://www.ncsc.gov.uk/collection/small-business-guidance--response-and-recovery)

### ir3. Is one person named to take charge if something goes wrong, with a backup if they're away?

- **Explained:** It doesn't need to be an IT person. It just needs to be someone who will make the calls.
- **Why it matters:** When everyone assumes someone else is dealing with it, nobody is.
- **Example:** The owner is on holiday when the email is hacked. Nobody knows who should decide what to do.
- **Weight:** 1. Not asked if size is solo.
- **Sources:** [NCSC: Small Business Guide: Response and Recovery](https://www.ncsc.gov.uk/collection/small-business-guidance--response-and-recovery)

**If it's a gap: Name who takes charge if something goes wrong** (10 minutes, free, owner: Owner, quick win)

Choose one person to lead if there's an incident, and a backup for when they're away. It doesn't need to be an IT person.

1. Choose a lead and a backup.
2. Write both names on the incident one-pager.
3. Tell everyone who they are.

Sources: [NCSC: Small Business Guide: Response and Recovery](https://www.ncsc.gov.uk/collection/small-business-guidance--response-and-recovery)

## 10. Which AI tools are used (AI use)

_Knowing what AI your team uses, including free personal accounts._

### ai1. Do you know which AI tools your team uses for work, including free personal accounts?

- **Explained:** AI tools include chatbots like ChatGPT, Copilot or Gemini, and AI features inside apps you already use.
- **Why it matters:** You can't set sensible rules for tools you don't know about. Staff often use free AI tools on their own.
- **Example:** A receptionist uses a free AI app on her phone to tidy up replies to clients, pasting in their messages.
- **Weight:** 2
- **Sources:** [NCSC: AI and cyber security: what you need to know](https://www.ncsc.gov.uk/guidance/ai-and-cyber-security-what-you-need-to-know); [ICO: Guidance on AI and data protection](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/guidance-on-ai-and-data-protection/)

**If it's a gap: Find out which AI tools your team uses** (20 minutes, free, owner: Owner, quick win)

Ask everyone, without blame, which AI tools they use for work and what for. You can only set sensible rules once you know.

1. Ask the team: which AI tools do you use, on which device, and for what tasks?
2. Include AI features inside apps you already use, and free personal accounts.
3. Write the answers down. They're the starting point for your AI policy.

Sources: [NCSC: AI and cyber security: what you need to know](https://www.ncsc.gov.uk/guidance/ai-and-cyber-security-what-you-need-to-know); [ICO: Guidance on AI and data protection](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/guidance-on-ai-and-data-protection/)

### ai2. Have you chosen which AI tools are approved for work, and checked how each one uses what you type into it?

- **Explained:** Some AI services may keep or use what you type. Their settings or terms explain how.
- **Why it matters:** Picking approved tools, and setting them up properly, means work information goes to places you've checked.
- **Example:** Two staff use five different AI apps between them. Nobody has read how any of them handle what's typed in.
- **Weight:** 2. Only if ai is yes or unsure.
- **Sources:** [ICO: Guidance on AI and data protection](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/guidance-on-ai-and-data-protection/); [NCSC: AI and cyber security: what you need to know](https://www.ncsc.gov.uk/guidance/ai-and-cyber-security-what-you-need-to-know)

**If it's a gap: Choose approved AI tools and check their settings** (60 minutes, free or low cost, owner: Owner)

Pick one or two AI tools for work, read how each handles what you type in, and set them up for business use. Ask staff to use only those for work.

1. From your list, choose the tools that cover what the team needs.
2. Read each tool's data and privacy settings, and how it may keep or use what's typed in.
3. Set them up with business accounts where available, and record them in your AI policy.
4. Ask staff to stop using other AI tools for work.

Sources: [ICO: Guidance on AI and data protection](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/guidance-on-ai-and-data-protection/); [NCSC: AI and cyber security: what you need to know](https://www.ncsc.gov.uk/guidance/ai-and-cyber-security-what-you-need-to-know)

## 11. What goes into AI tools (AI use)

_Keeping customer, staff and confidential details out._

### ai3. Have you told everyone never to paste customer details, staff records, passwords or bank details into AI tools?

- **Explained:** This includes copying in whole emails or documents that contain these details.
- **Why it matters:** Once typed into an AI tool, the information has left your business. AI tools can also be tricked into revealing what they've been given.
- **Example:** A staff member pastes a customer's complaint, with their address and order history, into a free AI tool to draft a reply.
- **Weight:** 3
- **Sources:** [ICO: Guidance on AI and data protection](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/guidance-on-ai-and-data-protection/); [NCSC: AI and cyber security: what you need to know](https://www.ncsc.gov.uk/guidance/ai-and-cyber-security-what-you-need-to-know)

**If it's a gap: Agree what must never go into AI tools** (15 minutes, free, owner: Owner, quick win)

Tell everyone: no customer details, staff records, passwords, bank details or confidential documents in AI tools. Once it's typed in, it has left the business.

1. Share the 'never put this into AI' list from the AI use policy.
2. Give two or three real examples from your own work.
3. Run the 'safe and unsafe prompts' training module with the team.

Sources: [ICO: Guidance on AI and data protection](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/guidance-on-ai-and-data-protection/); [NCSC: AI and cyber security: what you need to know](https://www.ncsc.gov.uk/guidance/ai-and-cyber-security-what-you-need-to-know)

### ai4. When staff ask an AI tool for help with a real case, do they remove names and other identifying details first?

- **Explained:** For example, writing 'a customer' instead of a name, and leaving out addresses and order numbers.
- **Why it matters:** You usually get just as good an answer without the personal details. UK GDPR expects you to use only what you need.
- **Example:** 'Help me reply to Sarah Jones at 12 Mill Lane about her refund' becomes 'Help me reply to a customer about a late refund'.
- **Weight:** 2. Only if ai is yes or unsure.
- **Sources:** [ICO: Principle (c): Data minimisation](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/data-minimisation/); [ICO: Guidance on AI and data protection](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/guidance-on-ai-and-data-protection/)

**If it's a gap: Take out names and details before asking AI** (10 minutes, free, owner: All staff, quick win)

Teach staff to describe the situation without identifying anyone: 'a customer' rather than a name, with no addresses or order numbers. The answer is usually just as good.

1. Show a before and after example of a prompt with the personal details removed.
2. Add 'remove names and identifying details' to the AI policy.
3. Practise with the training module.

Sources: [ICO: Principle (c): Data minimisation](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/data-minimisation/); [ICO: Guidance on AI and data protection](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/guidance-on-ai-and-data-protection/)

## 12. Checking AI output (AI use)

_A person checks before anything reaches a customer._

### ai5. Does a person check anything written by AI, such as emails, quotes or social posts, before customers see it?

- **Explained:** A quick read for facts, prices, promises and tone is enough.
- **Why it matters:** AI can state wrong things confidently. A wrong price, promise or fact sent to a customer is still your business's word.
- **Example:** An AI-drafted reply promises a full refund the shop's policy doesn't offer, and the customer holds them to it.
- **Weight:** 3. Only if ai is yes or unsure.
- **Sources:** [NCSC: AI and cyber security: what you need to know](https://www.ncsc.gov.uk/guidance/ai-and-cyber-security-what-you-need-to-know)

**If it's a gap: Check anything AI writes before customers see it** (10 minutes, free, owner: All staff, quick win)

Make it a rule that a person reads AI-written emails, quotes and posts before they go out, checking facts, prices and promises. AI can be confidently wrong.

1. Agree the rule: nothing AI-written goes to a customer without a person reading it.
2. Check prices, dates, promises and anything that sounds too certain.
3. Add the rule to the AI policy.

Sources: [NCSC: AI and cyber security: what you need to know](https://www.ncsc.gov.uk/guidance/ai-and-cyber-security-what-you-need-to-know)

### ai6. Does your chatbot hand over to a person for refunds, complaints and anything it isn't sure about?

- **Explained:** A handover can be as simple as 'I'll pass this to the team, who'll reply by email'.
- **Why it matters:** Chatbots can give confident wrong answers, and can be tricked by cleverly worded messages. Some topics need a person.
- **Example:** A customer talks a chatbot into 'confirming' a discount that doesn't exist.
- **Weight:** 2. Only if chatbot is yes.
- **Sources:** [NCSC: AI and cyber security: what you need to know](https://www.ncsc.gov.uk/guidance/ai-and-cyber-security-what-you-need-to-know)

**If it's a gap: Make your chatbot hand over to a person** (60 minutes, free or low cost, owner: Owner)

Set your chatbot to pass refunds, complaints and anything it's unsure about to a person, and to avoid making promises. Chatbots can be confidently wrong or talked into things.

1. List the topics a person must handle, such as refunds, complaints, discounts and anything about health or money.
2. In the chatbot's settings, set those topics to hand over to your team.
3. Test it by asking for a refund and a made-up discount.
4. Review a sample of chats each month.

Sources: [NCSC: AI and cyber security: what you need to know](https://www.ncsc.gov.uk/guidance/ai-and-cyber-security-what-you-need-to-know)

## 13. AI rules and guidance (AI use)

_Simple written rules and a little training._

### ai7. Do you have a short written policy on using AI at work?

- **Explained:** One page covering which tools are approved, what never goes into them, and when a person must check the output.
- **Why it matters:** A clear policy turns good intentions into a habit, and gives new staff the rules from day one.
- **Example:** A new starter assumes it's fine to use their personal AI account for client work, because nobody said otherwise.
- **Weight:** 2. Only if ai is yes or unsure.
- **Sources:** [NCSC: AI and cyber security: what you need to know](https://www.ncsc.gov.uk/guidance/ai-and-cyber-security-what-you-need-to-know); [ICO: Guidance on AI and data protection](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/guidance-on-ai-and-data-protection/)

**If it's a gap: Write a one-page AI use policy** (30 minutes, free, owner: Owner, quick win)

Use the toolkit template to set out approved tools, what never goes into them, and when a person must check the output. One page is enough for a small business.

1. Download the AI acceptable use policy from the toolkit.
2. Fill in your approved tools and any rules specific to your work.
3. Share it with the team and include it in new starter packs.

Sources: [NCSC: AI and cyber security: what you need to know](https://www.ncsc.gov.uk/guidance/ai-and-cyber-security-what-you-need-to-know); [ICO: Guidance on AI and data protection](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/guidance-on-ai-and-data-protection/)

### ai8. Have staff been shown real examples of what's fine to put into AI tools and what isn't?

- **Explained:** A 3-minute example session works better than a long policy nobody reads.
- **Why it matters:** People follow examples more easily than rules. Seeing what 'too much detail' looks like makes it stick.
- **Example:** After a short session, staff start asking 'is this OK to paste?' before using AI.
- **Weight:** 1. Only if ai is yes or unsure.
- **Sources:** [NCSC: AI and cyber security: what you need to know](https://www.ncsc.gov.uk/guidance/ai-and-cyber-security-what-you-need-to-know)

**If it's a gap: Show staff real examples of safe and unsafe AI use** (15 minutes, free, owner: All staff, quick win)

Spend three minutes going through examples of what's fine to put into AI and what isn't. Examples stick better than rules.

1. Run the 'safe and unsafe AI prompts' module with the team.
2. Talk through any examples people weren't sure about.
3. Repeat for new starters.

Sources: [NCSC: AI and cyber security: what you need to know](https://www.ncsc.gov.uk/guidance/ai-and-cyber-security-what-you-need-to-know)

## 14. AI-powered scams (AI use)

_Fake voices, fake videos and well-written scam emails._

### ai9. If 'the boss' called, sent a voice note or appeared on video asking for an urgent payment, would staff hang up and call back on a number they already have?

- **Explained:** AI can now copy someone's voice or face from a few online clips.
- **Why it matters:** Government fraud guidance warns that criminals impersonate senior people, sometimes with deepfake audio or video, to push urgent payments.
- **Example:** A voice that sounds exactly like the owner calls the shop asking for £3,000 to be sent 'before the bank closes'.
- **Weight:** 3
- **Sources:** [Stop! Think Fraud (UK Government): Protect your business](https://stopthinkfraud.campaign.gov.uk/protecting-your-business)

**If it's a gap: Hang up and call back on a known number** (10 minutes, free, owner: All staff, quick win)

If anyone, even 'the boss', calls, sends a voice note or video asking for an urgent payment, staff hang up and call back on a number they already have. AI can now fake voices and faces.

1. Agree the rule: urgent payment requests by phone or video are always checked by calling back on a known number.
2. Make sure staff have the real numbers for senior people saved.
3. Run the 'urgent call from the boss' training module.

Sources: [Stop! Think Fraud (UK Government): Protect your business](https://stopthinkfraud.campaign.gov.uk/protecting-your-business)

### ai10. Do staff know that AI now writes scam emails with perfect spelling, so a well-written message isn't proof it's genuine?

- **Explained:** The old advice to look for spelling mistakes isn't enough any more.
- **Why it matters:** The NCSC says AI helps criminals write convincing phishing without the mistakes that used to give it away.
- **Example:** A flawless, friendly email 'from the accountant' asks for staff payroll details.
- **Weight:** 1
- **Sources:** [NCSC: The near-term impact of AI on the cyber threat (24 January 2024)](https://www.ncsc.gov.uk/report/impact-of-ai-on-cyber-threat)

**If it's a gap: Update how staff spot scam emails** (10 minutes, free, owner: All staff, quick win)

Explain that spelling mistakes are no longer a reliable clue, because AI writes clean scam emails. Focus instead on what's being asked: money, passwords, urgency or a change of details.

1. Share this rule: judge an email by what it asks you to do, not how well it's written.
2. Run the 'spot the phishing email' training module.
3. Remind staff to check unusual requests through a second channel.

Sources: [NCSC: The near-term impact of AI on the cyber threat (24 January 2024)](https://www.ncsc.gov.uk/report/impact-of-ai-on-cyber-threat); [NCSC: Phishing attacks: defending your organisation](https://www.ncsc.gov.uk/guidance/phishing)

## What a business like yours usually has

Cyber Security Breaches Survey 2025/2026, published 30 April 2026. Figures are quoted exactly from the gov.uk release. 'Micro' means 1 to 9 staff and 'small' 10 to 49, as the survey defines them. Where the survey gives no figure for a control, Kinhold says so rather than estimate.

- **43%** of UK businesses reported a cyber breach or attack in the last 12 months.
- **42%** of micro businesses reported a breach or attack in the last 12 months.
- **46%** of small businesses reported a breach or attack in the last 12 months.
- **38%** of businesses experienced phishing, by far the most common type of attack.
- **3%** of micro businesses have someone in an IT role looking after cyber security.
- **43%** of micro businesses require two-factor authentication, up from 35% the year before.
- **47%** of all businesses require two-factor authentication.
- **81%** of businesses have up-to-date malware protection.
- **74%** of businesses back up data securely using a cloud service.
- **74%** of businesses have password policies.
- **73%** of businesses restrict admin rights.
- **21%** of micro businesses have a written incident response plan.
- **25%** of all businesses have a formal incident response plan.
- **39%** of businesses have assigned roles or responsibilities for incidents.
- **15%** of businesses review the cyber risks posed by their immediate suppliers.
- **31%** of businesses are using, adopting or considering AI.
- **24%** of businesses using or considering AI have cyber security practices to manage its risks.

## Message checker

### Warning signs

- **Asks to change bank details:** It's rare for businesses or staff to change bank accounts. This is the heart of invoice and payroll fraud. _What to do:_ Don't pay or update anything until you've called the sender on a number you already have and confirmed the old and new details. ([Stop! Think Fraud (UK Government): Protect your business](https://stopthinkfraud.campaign.gov.uk/protecting-your-business); [Payment Systems Regulator: APP scams](https://www.psr.org.uk/our-work/app-scams/))
- **Urgency or pressure:** Deadlines, threats and 'do it now' are used to stop you thinking or checking with anyone. _What to do:_ Slow down. A genuine request can wait the few minutes it takes to check. ([Stop! Think Fraud (UK Government): Protect your business](https://stopthinkfraud.campaign.gov.uk/protecting-your-business); [NCSC: Small organisations guide: Spotting cyber attacks](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/spotting-cyber-attacks))
- **Sender address looks like one you know, but isn't:** Scammers register addresses that differ by a letter or two, swap letters for numbers, or add extra words. _What to do:_ Compare the address character by character with one you've used before. Reply to the address you already have, not this one. ([Stop! Think Fraud (UK Government): Protect your business](https://stopthinkfraud.campaign.gov.uk/protecting-your-business); [NCSC: Phishing attacks: defending your organisation](https://www.ncsc.gov.uk/guidance/phishing))
- **Unusual payment:** Gift cards, cryptocurrency, a new account, an odd amount or a request to keep it quiet are all signs of fraud. _What to do:_ Follow your normal payment process, including a second approver. Never pay by gift card or crypto because someone asked. ([Stop! Think Fraud (UK Government): Protect your business](https://stopthinkfraud.campaign.gov.uk/protecting-your-business); [Payment Systems Regulator: APP scams](https://www.psr.org.uk/our-work/app-scams/))
- **Asks for codes, passwords or remote access:** No genuine bank, supplier or IT provider needs you to read out a code, share a password or install remote access because they contacted you. _What to do:_ Never share codes or passwords. Only allow remote access if you started the request with a provider you trust. ([Stop! Think Fraud (UK Government): Protect your business](https://stopthinkfraud.campaign.gov.uk/protecting-your-business); [NCSC: Phishing attacks: defending your organisation](https://www.ncsc.gov.uk/guidance/phishing))
- **Pretends to be the boss, a colleague or a supplier:** Scammers borrow authority and trust. Watch for a familiar name on an unfamiliar address or number, or a request to keep it secret. _What to do:_ Contact the real person using details you already have, not the ones in the message. ([Stop! Think Fraud (UK Government): Protect your business](https://stopthinkfraud.campaign.gov.uk/protecting-your-business); [NCSC: Business payment fraud](https://www.ncsc.gov.uk/section/respond-recover/ml-business-payment-fraud))
- **Signs of a fake voice or video:** AI can copy a voice or face from a few online clips. A new number, a voice note instead of a call, or 'I can't talk' are warning signs. _What to do:_ Hang up and call back on a number you already have. Don't rely on recognising the voice or face. ([Stop! Think Fraud (UK Government): Protect your business](https://stopthinkfraud.campaign.gov.uk/protecting-your-business); [NCSC: The near-term impact of AI on the cyber threat (24 January 2024)](https://www.ncsc.gov.uk/report/impact-of-ai-on-cyber-threat))

When nothing is found: "No common warning signs found. That doesn't prove the message is genuine, so always check payment requests by phone on a number you already have."

### Example messages

#### Your password expires today (obvious, Email)

**From:** Microsoft 365 Admin <alerts@m365-account-verify.net>  
**Subject:** Action required: your password expires in 2 hours

> Dear user,
> 
> Your Microsoft 365 password expires in 2 hours. To keep access to your mailbox, verify your account now using the secure link below.
> 
> Verify now: http://m365-account-verify.net/login
> 
> If you do not verify within 2 hours your mailbox will be suspended and emails may be lost.
> 
> Microsoft 365 Support Team

**Expected:** Asks for codes, passwords or remote access, Urgency or pressure. **Level:** High concern.

_Lesson:_ A login link plus a deadline is the classic phishing pattern. Go to your email account the way you normally do, never through the link.

#### Supplier's new bank details (obvious, Email)

**From:** Accounts, Harbour Mill Foods <accounts@harbourmi11foods.co.uk>  
**Subject:** Updated bank details for this week's payment

> Hi there,
> 
> Please note our bank details have changed following a move to a new bank. Please use the details below for Friday's payment and all future invoices.
> 
> Account name: Harbour Mill Foods Ltd
> Sort code: 00-11-22
> Account number: 00012345
> 
> We need this updated before Friday's payment run to avoid any delay to your next delivery.
> 
> Kind regards,
> Accounts Team

**Expected:** Asks to change bank details, Sender address looks like one you know, but isn't, Urgency or pressure. **Level:** High concern.

_Lesson:_ Look closely at the address: 'harbourmi11foods' uses the number 1 instead of the letter l. Call the supplier on the number from an old invoice.

#### A quick favour from the director (medium, Email)

**From:** Dan Okafor <dan.okafor.director@gmail.com>  
**Subject:** Are you at your desk?

> Hi, are you at your desk? I'm in back-to-back meetings and need a quick favour. I need 6 Amazon gift cards of £200 each for a client thank-you today. Please keep this between us for now, it's a surprise. Buy them and send me the codes by email, I'll sort the expenses later.
> 
> Dan
> Sent from my phone

**Expected:** Pretends to be the boss, a colleague or a supplier, Unusual payment, Urgency or pressure, Asks for codes, passwords or remote access. **Level:** High concern.

_Lesson:_ Gift cards, secrecy and a personal email address are a well-known CEO fraud pattern. Ask the real director using the number you already have.

#### Voice note from 'the boss' (medium, Voice note (transcript))

**From:** WhatsApp voice note from +44 7700 900461 (new number)

> Hi, it's me, my phone's broken so I'm on this number for now. Listen, I need you to send £4,750 to a new supplier straight away, the account details are in my next message. I can't talk, I'm about to go into a meeting, just get it done before 3 and I'll explain later. Thanks.

**Expected:** Signs of a fake voice or video, Pretends to be the boss, a colleague or a supplier, Urgency or pressure, Unusual payment. **Level:** High concern.

_Lesson:_ A new number, a voice note instead of a call and 'I can't talk' are classic signs of a fake voice. Call the boss back on the number you already have.

#### IT support needs a code (medium, Text message)

**From:** SMS from +44 7700 900218

> Hi, it's Jordan from your IT support company. We've spotted unusual sign-ins on your business email and need to secure it urgently. You'll get a 6-digit code in a moment, please text it back to me straight away, or install AnyDesk so I can fix it remotely.

**Expected:** Asks for codes, passwords or remote access, Urgency or pressure, Pretends to be the boss, a colleague or a supplier. **Level:** High concern.

_Lesson:_ Real IT support never asks you to read out a code. Call your IT provider on its usual number to check.

#### A normal-looking invoice with a twist (subtle, Email)

**From:** Sam Reid, Northfield Packaging <accounts@northfieldpackaging.co.uk>  
**Subject:** Invoice NP-4418 for November

> Hi,
> 
> Please find attached invoice NP-4418 for November's order, payable within 30 days as usual.
> 
> Just to let you know, following our annual audit our account has moved to a new bank, so please use the updated details printed on this invoice going forward.
> 
> Many thanks,
> Sam Reid
> Northfield Packaging

**Expected:** Asks to change bank details. **Level:** Medium concern.

_Lesson:_ The address is genuine and there's no rush, which is what makes this convincing. A supplier's real email account can be hacked. A bank change is still a reason to phone.

#### A colleague's new salary account (subtle, Email)

**From:** Priya Shah <priya.s.work@outlook.com>  
**Subject:** Bank change before payroll

> Hi,
> 
> I've switched banks this month, could you update my salary details before payroll runs? New details below.
> 
> Account name: P Shah
> Sort code: 00-33-44
> Account number: 00067890
> 
> Thanks so much,
> Priya

**Expected:** Asks to change bank details, Pretends to be the boss, a colleague or a supplier, Urgency or pressure. **Level:** High concern.

_Lesson:_ Salary diversion fraud looks like a routine request. It comes from a personal address, not the work one. Check with Priya in person or on her known number.

#### A delivery confirmation (subtle, Email)

**From:** Harbour Mill Foods <orders@harbourmillfoods.co.uk>  
**Subject:** Delivery confirmed for Tuesday

> Hello,
> 
> Your order is confirmed for delivery on Tuesday morning. Invoice HMF-2207 is attached and is payable to our usual account within 30 days.
> 
> Any questions, just reply to this email or call the office.
> 
> Best wishes,
> The Harbour Mill team

**Expected:** no warning signs. **Level:** No common warning signs found.

_Lesson:_ Nothing here matches a common warning sign. That still isn't proof. If an invoice ever asks you to pay somewhere new, phone first.

## Staff training

### Spot the fake invoice (3 minutes)

Invoice fraud is when a criminal sends an invoice, or a 'bank details have changed' note, so that a real payment goes to their account instead. It works because it looks like normal paperwork.

**Activity:** Tap the four things on this invoice email that should make you stop and check.

- The address is 'kestrelprint-co.uk', not the 'kestrelprint.co.uk' you've used before. One extra hyphen.
- A change of bank details. Always phone on a number you already have before paying.
- Pressure to pay today. Real suppliers can wait for you to check.
- Trying to stop you phoning. That's exactly the check that would catch it.

**Quiz**

1. A regular supplier emails to say their bank details have changed. What should you do first? **Answer:** Phone the supplier on a number you already have. Phoning on a number you already have is the one check that reliably catches invoice fraud. Replying goes straight back to the scammer.
2. Which of these is a sign of a lookalike email address? **Answer:** The address is accounts@harbourmi11foods.co.uk instead of harbourmillfoods.co.uk. Swapping a letter for a number is a common trick. Logos are easy to copy, so they prove nothing.
3. Why do scammers often say an invoice is overdue? **Answer:** To rush you so you don't check. Urgency is designed to stop you thinking or checking with anyone.

### Spot the phishing email (3 minutes)

Phishing is a fake message designed to make you click a link, enter a password or open a harmful file. AI now writes these without spelling mistakes, so judge an email by what it asks you to do, not how well it's written.

**Activity:** Tap the four warning signs in this email.

- A generic greeting. Companies you deal with usually use your name.
- A deadline and a threat, to rush you.
- A link to a website you don't recognise. Go to the courier's site yourself instead.
- No delivery company needs your email password. This is the real goal.

**Quiz**

1. An email is perfectly written, with no spelling mistakes. Does that mean it's genuine? **Answer:** No, AI now writes scam emails without mistakes. The NCSC says AI helps criminals write convincing phishing without the mistakes that used to give it away.
2. You clicked a link in an email and then realised it was fake. What should you do? **Answer:** Tell the person who handles IT straight away. The sooner someone knows, the less damage it does. You won't be in trouble for reporting it.
3. Where can you forward a suspicious email in the UK? **Answer:** report@phishing.gov.uk. The NCSC's free reporting service checks the email and can take down the scam website.

### Safe and unsafe AI prompts (3 minutes)

AI tools can save time, but whatever you type in has left the business. The simple rule: describe the situation, not the person. Never paste customer details, staff records, passwords or bank details.

**Activity:** Sort each prompt into 'Fine' or 'Never put this into an AI tool'.

- Fine: "Write a friendly reply to a customer whose order arrived late, offering a 10% discount." No personal details, just the situation.
- Never: "Here's Sarah Jones's complaint email with her address and order history. Write a reply." It contains a named customer's personal details. Describe the situation instead.
- Fine: "Suggest five Instagram captions for our new spring menu." Public marketing content with nothing confidential.
- Never: "Here is our staff spreadsheet with salaries and home addresses. Make it into a nice table." Staff personal and pay details should never go into an AI tool.
- Fine: "Check the grammar of this paragraph from our website's About page." It's already public.
- Never: "Our bank login keeps failing. Here's the username and password, what's wrong?" Never share passwords with anyone, including AI tools.
- Fine: "Explain in plain English what 'data minimisation' means for a small salon." A general question with no personal or confidential data.
- Never: "Summarise this client's medical history so I can prepare for their appointment." Health information is especially sensitive personal data.
- Fine: "Draft a polite payment reminder for an invoice that's 14 days overdue." A template with no names or account details.
- Never: "Here's our supplier contract, which is marked confidential. Find any risks." Confidential business documents shouldn't leave the business without approval.

**Quiz**

1. What's the simplest rule for using AI tools safely at work? **Answer:** Describe the situation, not the person. Leaving out names and identifying details usually gives just as good an answer, and keeps personal data in the business.
2. An AI tool writes a reply promising a customer a full refund. What should you do? **Answer:** Check it against your refund policy before sending. AI can state wrong things confidently. A person checks anything before it reaches a customer.
3. Which of these should never go into an AI tool? **Answer:** A customer's name, address and order history. Customer details are personal data and shouldn't be pasted into AI tools.

### The urgent call from the boss (3 minutes)

Criminals now use AI to copy a person's voice or face from a few online clips. They pretend to be the boss or a supplier and ask for an urgent payment. The fix is simple: hang up and call back on a number you already have.

**Activity:** Choose what you'd do at each step.

1. At 4.40pm your phone rings from an unknown number. It sounds exactly like the owner: 'My phone's died, I'm on a borrowed one. I need you to pay a new supplier £3,200 before the bank closes.' Best choice: Say you'll call them straight back, then hang up.
2. You hang up. Which number do you call? Best choice: The owner's usual number saved in your phone.
3. The owner doesn't answer their usual number. The 'supplier' emails asking why the money hasn't arrived. Best choice: Wait, and keep trying the owner or another senior person you trust.

**Quiz**

1. Can criminals copy someone's voice with AI? **Answer:** Yes, from short clips found online. Government fraud guidance warns that criminals use deepfake audio or video to impersonate senior people.
2. The 'boss' asks for an urgent payment by voice note from a new number. What do you do? **Answer:** Call the boss back on the number you already have. Call back on a known number. Never use contact details from the message itself.
3. If money has already been sent to a scammer, who should you call first? **Answer:** Your bank, straight away. Calling your bank quickly gives the best chance of stopping the payment. Then report it to Report Fraud on 0300 123 2040.

## All sources

- **NCSC: [Small organisations guide to cyber security](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security)** (checked 2026-11-26). Replaces the NCSC Small Business Guide. Old Small Business Guide links redirect here.
- **NCSC: [Small organisations guide: Secure your email](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/secure-your-email)** (checked 2026-11-26)
- **NCSC: [Small organisations guide: Secure your important online accounts](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/secure-your-important-online-accounts)** (checked 2026-11-26)
- **NCSC: [Small organisations guide: Protecting your devices](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/protecting-your-devices)** (checked 2026-11-26)
- **NCSC: [Small organisations guide: Backing up your data](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/backing-up-your-data)** (checked 2026-11-26)
- **NCSC: [Small organisations guide: Spotting cyber attacks](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/spotting-cyber-attacks)** (checked 2026-11-26)
- **NCSC: [Turn on 2-step verification (2SV)](https://www.ncsc.gov.uk/collection/top-tips-for-staying-secure-online/activate-2-step-verification-on-your-email)** (checked 2026-11-26)
- **NCSC: [Phishing attacks: defending your organisation](https://www.ncsc.gov.uk/guidance/phishing)** (checked 2026-11-26)
- **NCSC: [Report a scam email](https://www.ncsc.gov.uk/collection/phishing-scams/report-scam-email)** (checked 2026-11-26)
- **NCSC: [Business payment fraud](https://www.ncsc.gov.uk/section/respond-recover/ml-business-payment-fraud)** (checked 2026-11-26). This replaces NCSC's earlier business email compromise guidance page, which now returns a 404.
- **NCSC: [Small Business Guide: Response and Recovery](https://www.ncsc.gov.uk/collection/small-business-guidance--response-and-recovery)** (checked 2026-11-26)
- **NCSC: [Cyber Essentials](https://www.ncsc.gov.uk/cyberessentials/overview)** (checked 2026-11-26)
- **NCSC: [Cyber Essentials: Requirements for IT infrastructure v3.3](https://www.ncsc.gov.uk/sites/default/files/2026-11/Cyber-Essentials-Requirements-for-IT-Infrastructure-v3-3.pdf)** (checked 2026-11-26)
- **NCSC: [AI and cyber security: what you need to know](https://www.ncsc.gov.uk/guidance/ai-and-cyber-security-what-you-need-to-know)** (checked 2026-11-26)
- **NCSC: [The near-term impact of AI on the cyber threat (24 January 2024)](https://www.ncsc.gov.uk/report/impact-of-ai-on-cyber-threat)** (checked 2026-11-26)
- **ICO: [UK GDPR data breach reporting](https://ico.org.uk/for-organisations/report-a-breach/personal-data-breach/)** (checked 2026-11-26). The ICO says this guidance is under review after the Data (Use and Access) Act 2025.
- **ICO: [Principle (c): Data minimisation](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/data-minimisation/)** (checked 2026-11-26). Under review after the Data (Use and Access) Act 2025.
- **ICO: [Principle (e): Storage limitation](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/)** (checked 2026-11-26). Under review after the Data (Use and Access) Act 2025.
- **ICO: [Guidance on AI and data protection](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/guidance-on-ai-and-data-protection/)** (checked 2026-11-26). Under review after the Data (Use and Access) Act 2025.
- **ICO: [Advice for small and medium organisations](https://ico.org.uk/for-organisations/advice-for-small-organisations/)** (checked 2026-11-26)
- **City of London Police: [Report Fraud (replaced Action Fraud)](https://www.reportfraud.police.uk/)** (checked 2026-11-26). Report Fraud replaced Action Fraud on 4 December 2025, with a full public launch in January 2026. The police site blocks automated checks, so the change was confirmed through techUK and the NCSC's recovery guidance.
- **Stop! Think Fraud (UK Government): [Protect your business](https://stopthinkfraud.campaign.gov.uk/protecting-your-business)** (checked 2026-11-26)
- **Payment Systems Regulator: [APP scams](https://www.psr.org.uk/our-work/app-scams/)** (checked 2026-11-26). Used only for what APP fraud is, Confirmation of Payee and contacting your bank first. The page still mentions Action Fraud, which has been replaced.
- **DSIT and Home Office: [Cyber Security Breaches Survey 2025/2026 (published 30 April 2026)](https://www.gov.uk/government/statistics/cyber-security-breaches-survey-20252026)** (checked 2026-11-26)
- **NIST: [Cybersecurity Framework 2.0](https://www.nist.gov/cyberframework)** (checked 2026-11-26), Method page only
- **NIST: [AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)** (checked 2026-11-26), Method page only

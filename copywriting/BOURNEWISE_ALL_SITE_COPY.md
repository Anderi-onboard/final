# BourneWise — site copy deck (reader-facing text)

Every word a READER sees. The companion to `copywriting/BOURNEWISE_PROMPT_DECK.md`,
which covers every word the MODEL reads.

**Generated from source.** The previous edition was assembled by hand and, once the
product moved on, 244 of its 767 blocks (32%) no longer existed anywhere in the
files they pointed at — including a whole pricing scheme that had been replaced.
This one is rebuilt from the files themselves, so a block that appears here is a
block that is really in the product. Regenerate after changing copy.

Each block carries the file and line it came from, and what kind of text it is —
visible text, or a label a reader perceives some other way (a tooltip, a hint, a
screen-reader name).

Runtime strings live in `copy.js` and appear in their own section at the end;
they are functions of live numbers, so they are shown as templates.

**1042 blocks** — 458 in the markup of 10 pages, 584 in the pages' inline scripts, the browser modules, the server's error text and the 万物类象 panel, plus the runtime copy module.

---

## 1. index.html

*The app — sidebar, casting workbench, composer* — 62 blocks

@@ s01.index.html.001
<!-- source: index.html:7 | kind: title -->
BourneWise — Hexagram-based decision analysis

@@ s01.index.html.002
<!-- source: index.html:867 | kind: aria-label -->
New casting

@@ s01.index.html.003
<!-- source: index.html:868 | kind: aria-label -->
BourneWise logomark

@@ s01.index.html.004
<!-- source: index.html:871 | kind: aria-label -->
Collapse sidebar

@@ s01.index.html.005
<!-- source: index.html:881 | kind: aria-label -->
Site navigation

@@ s01.index.html.006
<!-- source: index.html:887 | kind: aria-label -->
Reading history

@@ s01.index.html.007
<!-- source: index.html:905 | kind: aria-label -->
Sign in and your first reading is on us

@@ s01.index.html.008
<!-- source: index.html:906 | kind: aria-label -->
Dismiss

@@ s01.index.html.009
<!-- source: index.html:925 | kind: aria-label -->
Open menu

@@ s01.index.html.010
<!-- source: index.html:934 | kind: aria-label -->
BourneWise — home

@@ s01.index.html.011
<!-- source: index.html:955 | kind: aria-label -->
Open the five-minute walk-through

@@ s01.index.html.012
<!-- source: index.html:979 | kind: aria-label -->
Earlier castings to carry

@@ s01.index.html.013
<!-- source: index.html:983 | kind: aria-label -->
Casting question

@@ s01.index.html.014
<!-- source: index.html:984 | kind: aria-label -->
Cast

@@ s01.index.html.015
<!-- source: index.html:990 | kind: aria-label -->
Casting method

@@ s01.index.html.016
<!-- source: index.html:983 | kind: placeholder -->
Describe the situation, then ask one clear question…

@@ s01.index.html.017
<!-- source: index.html:871 | kind: title -->
Collapse sidebar

@@ s01.index.html.018
<!-- source: index.html:925 | kind: title -->
Menu

@@ s01.index.html.019
<!-- source: index.html:945 | kind: title -->
How answers are generated

@@ s01.index.html.020
<!-- source: index.html:982 | kind: title -->
Change casting method

@@ s01.index.html.021
<!-- source: index.html:7 | kind: text -->
BourneWise — Hexagram-based decision analysis

@@ s01.index.html.022
<!-- source: index.html:869 | kind: text -->
BourneWise

@@ s01.index.html.023
<!-- source: index.html:878 | kind: text -->
New casting

@@ s01.index.html.024
<!-- source: index.html:882 | kind: text -->
The method

@@ s01.index.html.025
<!-- source: index.html:883 | kind: text -->
About us

@@ s01.index.html.026
<!-- source: index.html:884 | kind: text -->
Plans & units

@@ s01.index.html.027
<!-- source: index.html:888 | kind: text -->
Reading history

@@ s01.index.html.028
<!-- source: index.html:893 | kind: text -->
Available units

@@ s01.index.html.029
<!-- source: index.html:894 | kind: text -->
Usage

@@ s01.index.html.030
<!-- source: index.html:897 | kind: text -->
—

@@ s01.index.html.031
<!-- source: index.html:898 | kind: text -->
units

@@ s01.index.html.032
<!-- source: index.html:901 | kind: text -->
Prepaid balance · no expiry

@@ s01.index.html.033
<!-- source: index.html:902 | kind: text -->
Get units

@@ s01.index.html.034
<!-- source: index.html:902 | kind: text -->
→

@@ s01.index.html.035
<!-- source: index.html:906 | kind: text -->
×

@@ s01.index.html.036
<!-- source: index.html:907 | kind: text -->
First reading?

@@ s01.index.html.037
<!-- source: index.html:907 | kind: text -->
Sign in and

@@ s01.index.html.038
<!-- source: index.html:907 | kind: text -->
the first one is on us

@@ s01.index.html.039
<!-- source: index.html:907 | kind: text -->
— whole, not a sample.

@@ s01.index.html.040
<!-- source: index.html:912 | kind: text -->
Guest

@@ s01.index.html.041
<!-- source: index.html:912 | kind: text -->
Not signed in

@@ s01.index.html.042
<!-- source: index.html:916 | kind: text -->
Sign in to sync your balance and readings

@@ s01.index.html.043
<!-- source: index.html:917 | kind: text -->
Plans

@@ s01.index.html.044
<!-- source: index.html:918 | kind: text -->
Settings

@@ s01.index.html.045
<!-- source: index.html:919 | kind: text -->
Sign out

@@ s01.index.html.046
<!-- source: index.html:942 | kind: text -->
Sign in

@@ s01.index.html.047
<!-- source: index.html:944 | kind: text -->
— units

@@ s01.index.html.048
<!-- source: index.html:947 | kind: text -->
We use Claude Opus 5 to generate all answers. Casting fixes the hexagram first.

@@ s01.index.html.049
<!-- source: index.html:950 | kind: text -->
About

@@ s01.index.html.050
<!-- source: index.html:957 | kind: text -->
How does this work?

@@ s01.index.html.051
<!-- source: index.html:957 | kind: text -->
See how casting, interpretation, and billing fit together.

@@ s01.index.html.052
<!-- source: index.html:970 | kind: text -->
The figure is settled before a word is written about it.

@@ s01.index.html.053
<!-- source: index.html:982 | kind: text -->
Stria 64

@@ s01.index.html.054
<!-- source: index.html:989 | kind: text -->
Enter to submit · Shift+Enter for a new line

@@ s01.index.html.055
<!-- source: index.html:989 | kind: text -->
Follow-ups reuse the current hexagram

@@ s01.index.html.056
<!-- source: index.html:991 | kind: text -->
Stria 64 · about 440 units typical · charged for what it uses

@@ s01.index.html.057
<!-- source: index.html:996 | kind: text -->
Support:

@@ s01.index.html.058
<!-- source: index.html:996 | kind: text -->
hello@bournewise.com

@@ s01.index.html.059
<!-- source: index.html:996 | kind: text -->
·

@@ s01.index.html.060
<!-- source: index.html:996 | kind: text -->
Terms

@@ s01.index.html.061
<!-- source: index.html:996 | kind: text -->
Privacy

@@ s01.index.html.062
<!-- source: index.html:996 | kind: text -->
Refunds

---

## 2. pricing.html

*Plans, rates and unit packs* — 80 blocks

@@ s02.pricing.html.001
<!-- source: pricing.html:7 | kind: title -->
Plans & units — BourneWise

@@ s02.pricing.html.002
<!-- source: pricing.html:8 | kind: meta description -->
Monthly and annual BourneWise plans with included units, plus one-time top-ups. You are charged for the words an answer used, after it is written.

@@ s02.pricing.html.003
<!-- source: pricing.html:59 | kind: aria-label -->
BourneWise home

@@ s02.pricing.html.004
<!-- source: pricing.html:71 | kind: aria-label -->
Billing cycle

@@ s02.pricing.html.005
<!-- source: pricing.html:76 | kind: aria-label -->
Subscription plans

@@ s02.pricing.html.006
<!-- source: pricing.html:102 | kind: aria-label -->
Usage rates

@@ s02.pricing.html.007
<!-- source: pricing.html:107 | kind: aria-label -->
Usage estimator

@@ s02.pricing.html.008
<!-- source: pricing.html:114 | kind: aria-label -->
Unit packs

@@ s02.pricing.html.009
<!-- source: pricing.html:121 | kind: aria-label -->
Billing rules

@@ s02.pricing.html.010
<!-- source: pricing.html:7 | kind: text -->
Plans & units — BourneWise

@@ s02.pricing.html.011
<!-- source: pricing.html:61 | kind: text -->
BourneWise

@@ s02.pricing.html.012
<!-- source: pricing.html:63 | kind: text -->
The method

@@ s02.pricing.html.013
<!-- source: pricing.html:63 | kind: text -->
About us

@@ s02.pricing.html.014
<!-- source: pricing.html:63 | kind: text -->
Start a casting

@@ s02.pricing.html.015
<!-- source: pricing.html:67 | kind: text -->
Plans & units

@@ s02.pricing.html.016
<!-- source: pricing.html:67 | kind: text -->
Nothing is held back, and nothing is cut off.

@@ s02.pricing.html.017
<!-- source: pricing.html:67 | kind: text -->
Units arrive monthly, or a handful at a time, into the one balance. An answer is charged after it is written, for the words it actually used.

@@ s02.pricing.html.018
<!-- source: pricing.html:67 | kind: text -->
Nothing is set aside while an answer is being written, and no ceiling stops it early. A reading that has begun is finished and paid for, even if that empties the balance.

@@ s02.pricing.html.019
<!-- source: pricing.html:69 | kind: text -->
Not signed in

@@ s02.pricing.html.020
<!-- source: pricing.html:69 | kind: text -->
Available units

@@ s02.pricing.html.021
<!-- source: pricing.html:69 | kind: text -->
Sign in

@@ s02.pricing.html.022
<!-- source: pricing.html:72 | kind: text -->
Monthly

@@ s02.pricing.html.023
<!-- source: pricing.html:73 | kind: text -->
Annually

@@ s02.pricing.html.024
<!-- source: pricing.html:74 | kind: text -->
Save 2 months

@@ s02.pricing.html.025
<!-- source: pricing.html:78 | kind: text -->
Free

@@ s02.pricing.html.026
<!-- source: pricing.html:78 | kind: text -->
Create an account and explore the service before paying.

@@ s02.pricing.html.027
<!-- source: pricing.html:79 | kind: text -->
once

@@ s02.pricing.html.028
<!-- source: pricing.html:79 | kind: text -->
Your

@@ s02.pricing.html.029
<!-- source: pricing.html:79 | kind: text -->
first reading

@@ s02.pricing.html.030
<!-- source: pricing.html:79 | kind: text -->
is free

@@ s02.pricing.html.031
<!-- source: pricing.html:80 | kind: text -->
No recurring charge

@@ s02.pricing.html.032
<!-- source: pricing.html:80 | kind: text -->
A whole reading, not a sample

@@ s02.pricing.html.033
<!-- source: pricing.html:80 | kind: text -->
Both reading methods

@@ s02.pricing.html.034
<!-- source: pricing.html:81 | kind: text -->
Create account

@@ s02.pricing.html.035
<!-- source: pricing.html:84 | kind: text -->
Most useful

@@ s02.pricing.html.036
<!-- source: pricing.html:84 | kind: text -->
Pro

@@ s02.pricing.html.037
<!-- source: pricing.html:84 | kind: text -->
For regular readings and focused follow-up threads.

@@ s02.pricing.html.038
<!-- source: pricing.html:85 | kind: text -->
/ month

@@ s02.pricing.html.039
<!-- source: pricing.html:85 | kind: text -->
units

@@ s02.pricing.html.040
<!-- source: pricing.html:85 | kind: text -->
monthly

@@ s02.pricing.html.041
<!-- source: pricing.html:86 | kind: text -->
Both Stria and Sortis

@@ s02.pricing.html.042
<!-- source: pricing.html:86 | kind: text -->
Usage settles automatically

@@ s02.pricing.html.043
<!-- source: pricing.html:86 | kind: text -->
Top up without changing plans

@@ s02.pricing.html.044
<!-- source: pricing.html:87 | kind: text -->
Choose Pro

@@ s02.pricing.html.045
<!-- source: pricing.html:90 | kind: text -->
Premium

@@ s02.pricing.html.046
<!-- source: pricing.html:90 | kind: text -->
For frequent Sortis readings and longer ongoing work.

@@ s02.pricing.html.047
<!-- source: pricing.html:92 | kind: text -->
More units each month

@@ s02.pricing.html.048
<!-- source: pricing.html:93 | kind: text -->
Choose Premium

@@ s02.pricing.html.049
<!-- source: pricing.html:101 | kind: text -->
Rates

@@ s02.pricing.html.050
<!-- source: pricing.html:101 | kind: text -->
The arithmetic, in the open

@@ s02.pricing.html.051
<!-- source: pricing.html:101 | kind: text -->
Input covers your question, conversation context, and computed figure. Output is the written answer. These rates already include the service margin. Nothing is held before an answer runs: the charge is computed once it finishes, from the tokens it actually reported.

@@ s02.pricing.html.052
<!-- source: pricing.html:103 | kind: text -->
Stria 64

@@ s02.pricing.html.053
<!-- source: pricing.html:103 | kind: text -->
per 1,000 input tokens

@@ s02.pricing.html.054
<!-- source: pricing.html:103 | kind: text -->
per 1,000 output tokens

@@ s02.pricing.html.055
<!-- source: pricing.html:103 | kind: text -->
Charged on the tokens the reading actually uses — a shorter reading costs less, always.

@@ s02.pricing.html.056
<!-- source: pricing.html:104 | kind: text -->
Sortis 6

@@ s02.pricing.html.057
<!-- source: pricing.html:108 | kind: text -->
Reading method

@@ s02.pricing.html.058
<!-- source: pricing.html:109 | kind: text -->
Expected output tokens

@@ s02.pricing.html.059
<!-- source: pricing.html:110 | kind: text -->
estimated units for this reading

@@ s02.pricing.html.060
<!-- source: pricing.html:113 | kind: text -->
One-time units

@@ s02.pricing.html.061
<!-- source: pricing.html:113 | kind: text -->
Add units without changing anything else.

@@ s02.pricing.html.062
<!-- source: pricing.html:113 | kind: text -->
One-time unit purchases do not renew automatically and stay in the same balance as plan units.

@@ s02.pricing.html.063
<!-- source: pricing.html:115 | kind: text -->
7,500 units

@@ s02.pricing.html.064
<!-- source: pricing.html:115 | kind: text -->
1,500 units per $1 — same as a plan

@@ s02.pricing.html.065
<!-- source: pricing.html:116 | kind: text -->
15,000 units

@@ s02.pricing.html.066
<!-- source: pricing.html:117 | kind: text -->
30,000 units

@@ s02.pricing.html.067
<!-- source: pricing.html:118 | kind: text -->
75,000 units

@@ s02.pricing.html.068
<!-- source: pricing.html:122 | kind: text -->
Two ways to add units

@@ s02.pricing.html.069
<!-- source: pricing.html:122 | kind: text -->
Use a recurring plan for predictable volume or buy a one-time pack whenever you need it.

@@ s02.pricing.html.070
<!-- source: pricing.html:123 | kind: text -->
Charged for what you use

@@ s02.pricing.html.071
<!-- source: pricing.html:123 | kind: text -->
No units are held in advance and nothing is capped. A reading is billed the tokens it used, and one already underway finishes even if the balance runs out.

@@ s02.pricing.html.072
<!-- source: pricing.html:124 | kind: text -->
One shared balance

@@ s02.pricing.html.073
<!-- source: pricing.html:124 | kind: text -->
Plan units and top-ups fund both Stria and Sortis whenever the account has enough balance.

@@ s02.pricing.html.074
<!-- source: pricing.html:127 | kind: text -->
Receipts are sent automatically.

@@ s02.pricing.html.075
<!-- source: pricing.html:127 | kind: text -->
After every successful payment, Creem emails the receipt and a secure link for invoices, payment methods, and subscription management.

@@ s02.pricing.html.076
<!-- source: pricing.html:129 | kind: text -->
Terms

@@ s02.pricing.html.077
<!-- source: pricing.html:129 | kind: text -->
Privacy

@@ s02.pricing.html.078
<!-- source: pricing.html:129 | kind: text -->
Refunds

@@ s02.pricing.html.079
<!-- source: pricing.html:129 | kind: text -->
hello@bournewise.com

@@ s02.pricing.html.080
<!-- source: pricing.html:129 | kind: text -->
BourneWise · subscriptions, top-ups, and metered usage

---

## 3. guide.html

*The method, walked through* — 61 blocks

@@ s03.guide.html.001
<!-- source: guide.html:11 | kind: title -->
The method

@@ s03.guide.html.002
<!-- source: guide.html:12 | kind: meta description -->
How a BourneWise reading is produced, one step at a time.

@@ s03.guide.html.003
<!-- source: guide.html:103 | kind: aria-label -->
Method

@@ s03.guide.html.004
<!-- source: guide.html:83 | kind: placeholder -->
I have two offers. One pays more; the other gives me control over my time. Which matters more over the next year?

@@ s03.guide.html.005
<!-- source: guide.html:11 | kind: text -->
The method

@@ s03.guide.html.006
<!-- source: guide.html:32 | kind: text -->
BourneWise

@@ s03.guide.html.007
<!-- source: guide.html:34 | kind: text -->
About us

@@ s03.guide.html.008
<!-- source: guide.html:35 | kind: text -->
Plans & units

@@ s03.guide.html.009
<!-- source: guide.html:36 | kind: text -->
Start a casting

@@ s03.guide.html.010
<!-- source: guide.html:45 | kind: text -->
Question

@@ s03.guide.html.011
<!-- source: guide.html:45 | kind: text -->
Depth

@@ s03.guide.html.012
<!-- source: guide.html:45 | kind: text -->
Casting

@@ s03.guide.html.013
<!-- source: guide.html:46 | kind: text -->
Reading

@@ s03.guide.html.014
<!-- source: guide.html:46 | kind: text -->
Charge

@@ s03.guide.html.015
<!-- source: guide.html:46 | kind: text -->
Follow-up

@@ s03.guide.html.016
<!-- source: guide.html:53 | kind: text -->
Five steps, from the sentence you write to the units you spend

@@ s03.guide.html.017
<!-- source: guide.html:57 | kind: text -->
What this page is

@@ s03.guide.html.018
<!-- source: guide.html:64 | kind: text -->
Tap any step to try it.

@@ s03.guide.html.019
<!-- source: guide.html:64 | kind: text -->
Each one opens in place and holds the real thing — the checks, the coins, the meter.

@@ s03.guide.html.020
<!-- source: guide.html:66 | kind: text -->
Every part of a reading is shown here as the thing itself rather than as a description of it.

@@ s03.guide.html.021
<!-- source: guide.html:68 | kind: text -->
Nothing on this page is cast or charged

@@ s03.guide.html.022
<!-- source: guide.html:76 | kind: text -->
Step 01 · Frame it

@@ s03.guide.html.023
<!-- source: guide.html:79 | kind: text -->
One clear subject.

@@ s03.guide.html.024
<!-- source: guide.html:85 | kind: text -->
Enough context to work from

@@ s03.guide.html.025
<!-- source: guide.html:86 | kind: text -->
One subject, not several

@@ s03.guide.html.026
<!-- source: guide.html:87 | kind: text -->
A timeframe to aim at

@@ s03.guide.html.027
<!-- source: guide.html:92 | kind: text -->
Tap to write one

@@ s03.guide.html.028
<!-- source: guide.html:96 | kind: text -->
Step 02 · Choose the depth

@@ s03.guide.html.029
<!-- source: guide.html:99 | kind: text -->
Structure, or change.

@@ s03.guide.html.030
<!-- source: guide.html:105 | kind: text -->
Stria 64

@@ s03.guide.html.031
<!-- source: guide.html:105 | kind: text -->
~440 units

@@ s03.guide.html.032
<!-- source: guide.html:106 | kind: text -->
Primary hexagram analysis.

@@ s03.guide.html.033
<!-- source: guide.html:109 | kind: text -->
Sortis 6

@@ s03.guide.html.034
<!-- source: guide.html:109 | kind: text -->
~780 units

@@ s03.guide.html.035
<!-- source: guide.html:110 | kind: text -->
Moving lines and transformed figure included.

@@ s03.guide.html.036
<!-- source: guide.html:117 | kind: text -->
Tap to switch it

@@ s03.guide.html.037
<!-- source: guide.html:122 | kind: text -->
Step 03 · Let it complete

@@ s03.guide.html.038
<!-- source: guide.html:125 | kind: text -->
The figure comes first.

@@ s03.guide.html.039
<!-- source: guide.html:131 | kind: text -->
Toss the coins

@@ s03.guide.html.040
<!-- source: guide.html:132 | kind: text -->
Three coins a line. Two of eight outcomes move.

@@ s03.guide.html.041
<!-- source: guide.html:136 | kind: text -->
Tap to toss the coins

@@ s03.guide.html.042
<!-- source: guide.html:140 | kind: text -->
Step 04 · Read and continue

@@ s03.guide.html.043
<!-- source: guide.html:143 | kind: text -->
A view, not a verdict.

@@ s03.guide.html.044
<!-- source: guide.html:148 | kind: text -->
Follow the evidence

@@ s03.guide.html.045
<!-- source: guide.html:148 | kind: text -->
Look for the lines and relationships behind the conclusion, and compare them with what you already know.

@@ s03.guide.html.046
<!-- source: guide.html:150 | kind: text -->
Keep follow-ups attached

@@ s03.guide.html.047
<!-- source: guide.html:150 | kind: text -->
A follow-up reuses the current hexagram. A new subject needs a new casting.

@@ s03.guide.html.048
<!-- source: guide.html:153 | kind: text -->
A supportive reading is not a guarantee; an adverse one is not a command

@@ s03.guide.html.049
<!-- source: guide.html:157 | kind: text -->
Tap to see what to look for

@@ s03.guide.html.050
<!-- source: guide.html:162 | kind: text -->
Step 05 · What it costs

@@ s03.guide.html.051
<!-- source: guide.html:165 | kind: text -->
You pay for what ran.

@@ s03.guide.html.052
<!-- source: guide.html:169 | kind: text -->
Units per 1,000 tokens — input 19.5 · output 97.5

@@ s03.guide.html.053
<!-- source: guide.html:170 | kind: text -->
Answer length

@@ s03.guide.html.054
<!-- source: guide.html:172 | kind: text -->
units · about 1,800 words

@@ s03.guide.html.055
<!-- source: guide.html:173 | kind: text -->
Nothing is held in advance, and a reading underway always finishes

@@ s03.guide.html.056
<!-- source: guide.html:177 | kind: text -->
Tap to move the length

@@ s03.guide.html.057
<!-- source: guide.html:181 | kind: text -->
Ready

@@ s03.guide.html.058
<!-- source: guide.html:183 | kind: text -->
Cast one

@@ s03.guide.html.059
<!-- source: guide.html:184 | kind: text -->
Start a casting →

@@ s03.guide.html.060
<!-- source: guide.html:199 | kind: text -->
Terms

@@ s03.guide.html.061
<!-- source: guide.html:200 | kind: text -->
Privacy

---

## 4. about.html

*What BourneWise is* — 39 blocks

@@ s04.about.html.001
<!-- source: about.html:18 | kind: title -->
About us — BourneWise

@@ s04.about.html.002
<!-- source: about.html:19 | kind: meta description -->
What BourneWise is, what a reading is made of, and what you get.

@@ s04.about.html.003
<!-- source: about.html:18 | kind: text -->
About us — BourneWise

@@ s04.about.html.004
<!-- source: about.html:37 | kind: text -->
BourneWise

@@ s04.about.html.005
<!-- source: about.html:39 | kind: text -->
The method

@@ s04.about.html.006
<!-- source: about.html:40 | kind: text -->
Plans & units

@@ s04.about.html.007
<!-- source: about.html:41 | kind: text -->
Start a casting

@@ s04.about.html.008
<!-- source: about.html:49 | kind: text -->
About us

@@ s04.about.html.009
<!-- source: about.html:51 | kind: text -->
We built the part that cannot be talked out of its answer.

@@ s04.about.html.010
<!-- source: about.html:52 | kind: text -->
A reading here has two halves that never touch. Six lines fall, and they are fixed. Then Claude explains the figure that fell — the one you actually got, in the situation you actually described.

@@ s04.about.html.011
<!-- source: about.html:59 | kind: text -->
One

@@ s04.about.html.012
<!-- source: about.html:60 | kind: text -->
What a reading is made of

@@ s04.about.html.013
<!-- source: about.html:64 | kind: text -->
Separation

@@ s04.about.html.014
<!-- source: about.html:66 | kind: text -->
The figure lands before a word does.

@@ s04.about.html.015
<!-- source: about.html:67 | kind: text -->
Six lines fall, and nothing you typed moves them — nor does anything written about them afterwards.

@@ s04.about.html.016
<!-- source: about.html:72 | kind: text -->
Evidence

@@ s04.about.html.017
<!-- source: about.html:74 | kind: text -->
Every answer shows its source.

@@ s04.about.html.018
<!-- source: about.html:75 | kind: text -->
The figure it was written from comes with it, so you can read where the reading came from and not only where it arrived.

@@ s04.about.html.019
<!-- source: about.html:84 | kind: text -->
Restraint

@@ s04.about.html.020
<!-- source: about.html:86 | kind: text -->
A view, not a verdict.

@@ s04.about.html.021
<!-- source: about.html:87 | kind: text -->
It tells you what to go and check. It will not decide it for you, and it does not pretend to.

@@ s04.about.html.022
<!-- source: about.html:92 | kind: text -->
Depth

@@ s04.about.html.023
<!-- source: about.html:94 | kind: text -->
One figure, or one and what it becomes.

@@ s04.about.html.024
<!-- source: about.html:95 | kind: text -->
You choose how much structure the question needs before you ask it.

@@ s04.about.html.025
<!-- source: about.html:101 | kind: text -->
Two

@@ s04.about.html.026
<!-- source: about.html:102 | kind: text -->
What you actually get

@@ s04.about.html.027
<!-- source: about.html:106 | kind: text -->
Your first

@@ s04.about.html.028
<!-- source: about.html:108 | kind: text -->
A whole reading, not a taste of one.

@@ s04.about.html.029
<!-- source: about.html:109 | kind: text -->
It is on us, it starts, and it finishes. Nothing is held back to make a point.

@@ s04.about.html.030
<!-- source: about.html:114 | kind: text -->
Language

@@ s04.about.html.031
<!-- source: about.html:116 | kind: text -->
Ask in the words you think in.

@@ s04.about.html.032
<!-- source: about.html:117 | kind: text -->
The answer comes back in the language you asked in, whichever that is.

@@ s04.about.html.033
<!-- source: about.html:126 | kind: text -->
Balance

@@ s04.about.html.034
<!-- source: about.html:128 | kind: text -->
You pay for what ran.

@@ s04.about.html.035
<!-- source: about.html:129 | kind: text -->
No plan to keep up and nothing reserved in advance. A balance, and questions you spend it on.

@@ s04.about.html.036
<!-- source: about.html:135 | kind: text -->
Ask it something that matters.

@@ s04.about.html.037
<!-- source: about.html:136 | kind: text -->
Start a casting →

@@ s04.about.html.038
<!-- source: about.html:146 | kind: text -->
Terms

@@ s04.about.html.039
<!-- source: about.html:147 | kind: text -->
Privacy

---

## 5. login.html

*Sign in and sign up* — 30 blocks

@@ s05.login.html.001
<!-- source: login.html:7 | kind: title -->
Sign in — BourneWise

@@ s05.login.html.002
<!-- source: login.html:142 | kind: aria-label -->
BourneWise home

@@ s05.login.html.003
<!-- source: login.html:180 | kind: aria-label -->
Show password

@@ s05.login.html.004
<!-- source: login.html:170 | kind: placeholder -->
How the reading addresses you

@@ s05.login.html.005
<!-- source: login.html:174 | kind: placeholder -->
you@example.com

@@ s05.login.html.006
<!-- source: login.html:179 | kind: placeholder -->
At least 8 characters

@@ s05.login.html.007
<!-- source: login.html:7 | kind: text -->
Sign in — BourneWise

@@ s05.login.html.008
<!-- source: login.html:144 | kind: text -->
BourneWise

@@ s05.login.html.009
<!-- source: login.html:146 | kind: text -->
&larr;

@@ s05.login.html.010
<!-- source: login.html:146 | kind: text -->
Back to BourneWise

@@ s05.login.html.011
<!-- source: login.html:146 | kind: text -->
Back

@@ s05.login.html.012
<!-- source: login.html:152 | kind: text -->
◆  Account

@@ s05.login.html.013
<!-- source: login.html:153 | kind: text -->
Sync your balance and reading history.

@@ s05.login.html.014
<!-- source: login.html:154 | kind: text -->
Sign in to use the same unit balance, plan, and saved readings across devices.

@@ s05.login.html.015
<!-- source: login.html:163 | kind: text -->
Sign in

@@ s05.login.html.016
<!-- source: login.html:164 | kind: text -->
Create account

@@ s05.login.html.017
<!-- source: login.html:169 | kind: text -->
Name

@@ s05.login.html.018
<!-- source: login.html:173 | kind: text -->
Email

@@ s05.login.html.019
<!-- source: login.html:177 | kind: text -->
Password

@@ s05.login.html.020
<!-- source: login.html:180 | kind: text -->
Show

@@ s05.login.html.021
<!-- source: login.html:190 | kind: text -->
or continue with

@@ s05.login.html.022
<!-- source: login.html:197 | kind: text -->
Google

@@ s05.login.html.023
<!-- source: login.html:204 | kind: text -->
Reddit

@@ s05.login.html.024
<!-- source: login.html:211 | kind: text -->
Discord

@@ s05.login.html.025
<!-- source: login.html:218 | kind: text -->
By continuing, you agree to our

@@ s05.login.html.026
<!-- source: login.html:218 | kind: text -->
Terms

@@ s05.login.html.027
<!-- source: login.html:218 | kind: text -->
and

@@ s05.login.html.028
<!-- source: login.html:218 | kind: text -->
Privacy Policy

@@ s05.login.html.029
<!-- source: login.html:218 | kind: text -->
Your questions and saved readings follow the data controls in your account.

@@ s05.login.html.030
<!-- source: login.html:223 | kind: text -->
BourneWise · the figure is cast before a word is written about it

---

## 6. settings.html

*Account, plan and data* — 24 blocks

@@ s06.settings.html.001
<!-- source: settings.html:7 | kind: title -->
Settings — BourneWise

@@ s06.settings.html.002
<!-- source: settings.html:7 | kind: text -->
Settings — BourneWise

@@ s06.settings.html.003
<!-- source: settings.html:125 | kind: text -->
Settings

@@ s06.settings.html.004
<!-- source: settings.html:126 | kind: text -->
Your account, usage balance, and reading history.

@@ s06.settings.html.005
<!-- source: settings.html:130 | kind: text -->
Identity

@@ s06.settings.html.006
<!-- source: settings.html:136 | kind: text -->
Plan & balance

@@ s06.settings.html.007
<!-- source: settings.html:139 | kind: text -->
Current plan

@@ s06.settings.html.008
<!-- source: settings.html:148 | kind: text -->
Available balance

@@ s06.settings.html.009
<!-- source: settings.html:148 | kind: text -->
Nothing is set aside when a reading starts, and nothing stops it early. You pay for the answer once it is written, for the length it turned out to be.

@@ s06.settings.html.010
<!-- source: settings.html:149 | kind: text -->
Get units

@@ s06.settings.html.011
<!-- source: settings.html:152 | kind: text -->
Plans and top-ups

@@ s06.settings.html.012
<!-- source: settings.html:152 | kind: text -->
Units every month, or a handful whenever you want them. Both land in the same balance.

@@ s06.settings.html.013
<!-- source: settings.html:153 | kind: text -->
View plans

@@ s06.settings.html.014
<!-- source: settings.html:156 | kind: text -->
Receipts & billing

@@ s06.settings.html.015
<!-- source: settings.html:156 | kind: text -->
Open your secure Creem portal for receipts, invoices, payment methods, and subscription controls.

@@ s06.settings.html.016
<!-- source: settings.html:159 | kind: text -->
Cancel subscription

@@ s06.settings.html.017
<!-- source: settings.html:167 | kind: text -->
Casting defaults

@@ s06.settings.html.018
<!-- source: settings.html:173 | kind: text -->
Privacy & data

@@ s06.settings.html.019
<!-- source: settings.html:176 | kind: text -->
Reading history

@@ s06.settings.html.020
<!-- source: settings.html:177 | kind: text -->
Delete reading history

@@ s06.settings.html.021
<!-- source: settings.html:180 | kind: text -->
Encrypted at rest

@@ s06.settings.html.022
<!-- source: settings.html:180 | kind: text -->
Readings are never sold or used to train. Delete them whenever you choose.

@@ s06.settings.html.023
<!-- source: settings.html:181 | kind: text -->
Always on

@@ s06.settings.html.024
<!-- source: settings.html:184 | kind: text -->
This session

---

## 7. privacy.html

*Privacy policy* — 50 blocks

@@ s07.privacy.html.001
<!-- source: privacy.html:7 | kind: title -->
Privacy Policy — BourneWise

@@ s07.privacy.html.002
<!-- source: privacy.html:88 | kind: aria-label -->
BourneWise home

@@ s07.privacy.html.003
<!-- source: privacy.html:102 | kind: aria-label -->
Contents

@@ s07.privacy.html.004
<!-- source: privacy.html:7 | kind: text -->
Privacy Policy — BourneWise

@@ s07.privacy.html.005
<!-- source: privacy.html:90 | kind: text -->
BourneWise

@@ s07.privacy.html.006
<!-- source: privacy.html:92 | kind: text -->
&larr; Back to BourneWise

@@ s07.privacy.html.007
<!-- source: privacy.html:97 | kind: text -->
Privacy, in writing

@@ s07.privacy.html.008
<!-- source: privacy.html:98 | kind: text -->
Privacy Policy

@@ s07.privacy.html.009
<!-- source: privacy.html:99 | kind: text -->
Effective June 14, 2026 · BourneWise, Inc.

@@ s07.privacy.html.010
<!-- source: privacy.html:100 | kind: text -->
Your questions stay yours. This policy explains the little we collect, why, and the controls you hold. The short version: castings are encrypted at rest, never sold, never used to train, and deleted when you choose.

@@ s07.privacy.html.011
<!-- source: privacy.html:103 | kind: text -->
What we collect

@@ s07.privacy.html.012
<!-- source: privacy.html:104 | kind: text -->
How we use it

@@ s07.privacy.html.013
<!-- source: privacy.html:105 | kind: text -->
Your castings & the model

@@ s07.privacy.html.014
<!-- source: privacy.html:106 | kind: text -->
Who we share with

@@ s07.privacy.html.015
<!-- source: privacy.html:107 | kind: text -->
Retention & deletion

@@ s07.privacy.html.016
<!-- source: privacy.html:108 | kind: text -->
Your rights

@@ s07.privacy.html.017
<!-- source: privacy.html:109 | kind: text -->
Security

@@ s07.privacy.html.018
<!-- source: privacy.html:110 | kind: text -->
Contact

@@ s07.privacy.html.019
<!-- source: privacy.html:117 | kind: text -->
Account basics

@@ s07.privacy.html.020
<!-- source: privacy.html:117 | kind: text -->
— your name and email from Google or Apple sign-in.

@@ s07.privacy.html.021
<!-- source: privacy.html:118 | kind: text -->
Castings

@@ s07.privacy.html.022
<!-- source: privacy.html:118 | kind: text -->
— the questions you ask and the readings you receive.

@@ s07.privacy.html.023
<!-- source: privacy.html:119 | kind: text -->
Ledger

@@ s07.privacy.html.024
<!-- source: privacy.html:119 | kind: text -->
— your Unit balance, purchase records, and usage records.

@@ s07.privacy.html.025
<!-- source: privacy.html:120 | kind: text -->
Minimal technical data

@@ s07.privacy.html.026
<!-- source: privacy.html:120 | kind: text -->
— coarse device and log information needed to keep the service running and secure.

@@ s07.privacy.html.027
<!-- source: privacy.html:122 | kind: text -->
We do not ask for, or want, special-category data. Please don&rsquo;t put information you wouldn&rsquo;t want stored into a question.

@@ s07.privacy.html.028
<!-- source: privacy.html:127 | kind: text -->
We use your data to generate castings and analyses, maintain your balance and history, process payments, prevent abuse, and meet legal obligations. We do not sell your data or run advertising.

@@ s07.privacy.html.029
<!-- source: privacy.html:132 | kind: text -->
To produce a reading, the text of your question is sent to our model provider solely to generate that one response. We do

@@ s07.privacy.html.030
<!-- source: privacy.html:132 | kind: text -->
not

@@ s07.privacy.html.031
<!-- source: privacy.html:132 | kind: text -->
use your questions or readings to train models, and we instruct our providers not to either.

@@ s07.privacy.html.032
<!-- source: privacy.html:133 | kind: text -->
Castings are encrypted at rest. They are never sold, never used to train, and removed from our servers when you delete them.

@@ s07.privacy.html.033
<!-- source: privacy.html:138 | kind: text -->
Only the processors who make the service work, under contract and only for that purpose:

@@ s07.privacy.html.034
<!-- source: privacy.html:140 | kind: text -->
our cloud host (storage and compute);

@@ s07.privacy.html.035
<!-- source: privacy.html:141 | kind: text -->
our model provider (to generate a reading);

@@ s07.privacy.html.036
<!-- source: privacy.html:142 | kind: text -->
our payment processor (to process prepaid Unit purchases).

@@ s07.privacy.html.037
<!-- source: privacy.html:144 | kind: text -->
We may disclose data if the law requires it, and we will tell you unless legally barred from doing so.

@@ s07.privacy.html.038
<!-- source: privacy.html:149 | kind: text -->
Castings remain until you delete them. You can delete individual castings, or all of them at once, from

@@ s07.privacy.html.039
<!-- source: privacy.html:149 | kind: text -->
Settings

@@ s07.privacy.html.040
<!-- source: privacy.html:149 | kind: text -->
. Deleted castings are removed from active systems promptly and purged from backups within 30 days. Some payment and ledger records are kept where law requires.

@@ s07.privacy.html.041
<!-- source: privacy.html:154 | kind: text -->
Depending on where you live, you may have rights to access, correct, export, or delete your data, and to object to certain processing. Use the controls in Settings, or write to us and we&rsquo;ll act within the time the law allows. We will never charge you for, or penalise you for, exercising a privacy right.

@@ s07.privacy.html.042
<!-- source: privacy.html:159 | kind: text -->
We use encryption in transit and at rest, least-privilege access, and routine review. No system is perfectly secure, but we hold your castings to the standard the word &ldquo;private&rdquo; implies, and we&rsquo;ll notify you and the regulator if a breach ever requires it.

@@ s07.privacy.html.043
<!-- source: privacy.html:164 | kind: text -->
Privacy questions and requests go to

@@ s07.privacy.html.044
<!-- source: privacy.html:164 | kind: text -->
privacy@bournewise.com

@@ s07.privacy.html.045
<!-- source: privacy.html:164 | kind: text -->
. We are the data controller for the information described here.

@@ s07.privacy.html.046
<!-- source: privacy.html:169 | kind: text -->
Terms

@@ s07.privacy.html.047
<!-- source: privacy.html:170 | kind: text -->
Privacy

@@ s07.privacy.html.048
<!-- source: privacy.html:171 | kind: text -->
Refund

@@ s07.privacy.html.049
<!-- source: privacy.html:172 | kind: text -->
About

@@ s07.privacy.html.050
<!-- source: privacy.html:174 | kind: text -->
BourneWise · fixed hexagram input · model-written interpretation

---

## 8. terms.html

*Terms of service* — 62 blocks

@@ s08.terms.html.001
<!-- source: terms.html:7 | kind: title -->
Terms of Service — BourneWise

@@ s08.terms.html.002
<!-- source: terms.html:88 | kind: aria-label -->
BourneWise home

@@ s08.terms.html.003
<!-- source: terms.html:102 | kind: aria-label -->
Contents

@@ s08.terms.html.004
<!-- source: terms.html:7 | kind: text -->
Terms of Service — BourneWise

@@ s08.terms.html.005
<!-- source: terms.html:90 | kind: text -->
BourneWise

@@ s08.terms.html.006
<!-- source: terms.html:92 | kind: text -->
&larr; Back to BourneWise

@@ s08.terms.html.007
<!-- source: terms.html:97 | kind: text -->
The terms, said plainly

@@ s08.terms.html.008
<!-- source: terms.html:98 | kind: text -->
Terms of Service

@@ s08.terms.html.009
<!-- source: terms.html:99 | kind: text -->
Effective June 14, 2026 · BourneWise, Inc.

@@ s08.terms.html.010
<!-- source: terms.html:100 | kind: text -->
BourneWise generates a hexagram from your casting and returns a model-written analysis. These terms explain accounts, units, billing, data, acceptable use, and service limits.

@@ s08.terms.html.011
<!-- source: terms.html:103 | kind: text -->
Accepting these terms

@@ s08.terms.html.012
<!-- source: terms.html:104 | kind: text -->
Your account

@@ s08.terms.html.013
<!-- source: terms.html:105 | kind: text -->
Units & castings

@@ s08.terms.html.014
<!-- source: terms.html:106 | kind: text -->
Usage & billing

@@ s08.terms.html.015
<!-- source: terms.html:107 | kind: text -->
The nature of a reading

@@ s08.terms.html.016
<!-- source: terms.html:108 | kind: text -->
Acceptable use

@@ s08.terms.html.017
<!-- source: terms.html:109 | kind: text -->
Ownership

@@ s08.terms.html.018
<!-- source: terms.html:110 | kind: text -->
Disclaimers & liability

@@ s08.terms.html.019
<!-- source: terms.html:111 | kind: text -->
Changes & termination

@@ s08.terms.html.020
<!-- source: terms.html:112 | kind: text -->
Contact

@@ s08.terms.html.021
<!-- source: terms.html:118 | kind: text -->
By creating an account, signing in, or casting a question, you agree to these Terms and to our

@@ s08.terms.html.022
<!-- source: terms.html:118 | kind: text -->
Privacy Policy

@@ s08.terms.html.023
<!-- source: terms.html:118 | kind: text -->
and

@@ s08.terms.html.024
<!-- source: terms.html:118 | kind: text -->
Refund Policy

@@ s08.terms.html.025
<!-- source: terms.html:118 | kind: text -->
. If you do not agree, do not use BourneWise. You must be at least 16 years old, and old enough to enter a contract where you live.

@@ s08.terms.html.026
<!-- source: terms.html:123 | kind: text -->
You may sign in with Google or Apple. You are responsible for the activity on your account and for keeping access to it secure. Tell us promptly if you suspect someone else is using it. One person, one account; don&rsquo;t share credentials or resell access.

@@ s08.terms.html.027
<!-- source: terms.html:128 | kind: text -->
A casting is paid for in

@@ s08.terms.html.028
<!-- source: terms.html:128 | kind: text -->
Units

@@ s08.terms.html.029
<!-- source: terms.html:128 | kind: text -->
. Nothing is held against your balance when generation begins. Once the answer finishes, BourneWise charges the measured input and output token usage for that answer — there is no reservation and no maximum. A shorter reading costs less and a longer one costs more, in proportion to the work done.

@@ s08.terms.html.030
<!-- source: terms.html:129 | kind: text -->
A typical Stria casting uses roughly 440 Units and a typical Sortis casting roughly 780; follow-ups are metered the same way. These figures are estimates from measured usage, not limits. A request starts whenever your balance is above zero. Because a reading in progress is never interrupted over payment, one that costs more than your remaining balance still finishes and is still charged in full, which can leave the balance below zero; the shortfall is settled against your next top-up, and further castings are unavailable until the balance is positive again. Interrupted generations are charged only for the work actually received.

@@ s08.terms.html.031
<!-- source: terms.html:130 | kind: text -->
Units have no cash value, cannot be transferred between accounts, and are not a stored-value or payment instrument. Units actually consumed by a completed generation are non-refundable. See the

@@ s08.terms.html.032
<!-- source: terms.html:130 | kind: text -->
for full detail.

@@ s08.terms.html.033
<!-- source: terms.html:134 | kind: text -->
Plans & billing

@@ s08.terms.html.034
<!-- source: terms.html:135 | kind: text -->
BourneWise offers recurring monthly and annual subscriptions with included Units, alongside one-time Unit packs. All Units enter the same balance and are spent only when you generate a reading or follow-up.

@@ s08.terms.html.035
<!-- source: terms.html:137 | kind: text -->
Subscriptions renew automatically until canceled. Monthly plans grant Units each month; annual plans grant the full year&rsquo;s Units at each annual renewal.

@@ s08.terms.html.036
<!-- source: terms.html:138 | kind: text -->
You may cancel from your account; access continues through the paid billing period and Units already granted remain available.

@@ s08.terms.html.037
<!-- source: terms.html:139 | kind: text -->
One-time top-up Units do not renew automatically and do not expire while your account remains open.

@@ s08.terms.html.038
<!-- source: terms.html:140 | kind: text -->
Rates and pack prices may change, but never retroactively alter Units already in your balance.

@@ s08.terms.html.039
<!-- source: terms.html:141 | kind: text -->
Failed payments do not add Units; your existing balance remains available.

@@ s08.terms.html.040
<!-- source: terms.html:147 | kind: text -->
BourneWise is a tool for reflection. A reading is a

@@ s08.terms.html.041
<!-- source: terms.html:147 | kind: text -->
judgment, not a guarantee

@@ s08.terms.html.042
<!-- source: terms.html:147 | kind: text -->
, and not professional advice. It is not a substitute for a doctor, lawyer, financial adviser, or therapist. Do not rely on a casting for decisions about health, safety, legal matters, money, or anything where a wrong call carries real harm. You are responsible for what you choose to do.

@@ s08.terms.html.043
<!-- source: terms.html:152 | kind: text -->
Use BourneWise lawfully and in good faith. Do not:

@@ s08.terms.html.044
<!-- source: terms.html:154 | kind: text -->
break the law, or ask the service to help you do so;

@@ s08.terms.html.045
<!-- source: terms.html:155 | kind: text -->
submit another person&rsquo;s private information without their consent;

@@ s08.terms.html.046
<!-- source: terms.html:156 | kind: text -->
probe, scrape, overload, or reverse-engineer the service, or evade Unit charges;

@@ s08.terms.html.047
<!-- source: terms.html:157 | kind: text -->
resell readings or pass the output off as professional advice to others.

@@ s08.terms.html.048
<!-- source: terms.html:159 | kind: text -->
We may suspend accounts that abuse the service or put other people at risk.

@@ s08.terms.html.049
<!-- source: terms.html:164 | kind: text -->
The questions you write and the readings you receive are yours to keep and use. The BourneWise name, marks, figures, software, and interface are ours. We grant you a personal, non-exclusive, non-transferable licence to use the service while these Terms are in force.

@@ s08.terms.html.050
<!-- source: terms.html:169 | kind: text -->
BourneWise is provided &ldquo;as is.&rdquo; To the fullest extent the law allows, we disclaim implied warranties and are not liable for indirect, incidental, or consequential losses, or for any decision made in reliance on a reading.

@@ s08.terms.html.051
<!-- source: terms.html:170 | kind: text -->
Where liability cannot be excluded, our total liability to you is limited to the greater of the amount you paid us in the prior three months, or US $50.

@@ s08.terms.html.052
<!-- source: terms.html:175 | kind: text -->
We may update these Terms; if a change is material we will give reasonable notice, and continued use after it takes effect means you accept it. You may stop using BourneWise at any time. We may suspend or close accounts that breach these Terms, and you can delete yours from

@@ s08.terms.html.053
<!-- source: terms.html:175 | kind: text -->
Settings

@@ s08.terms.html.054
<!-- source: terms.html:175 | kind: text -->
at any time.

@@ s08.terms.html.055
<!-- source: terms.html:180 | kind: text -->
Questions about these Terms go to

@@ s08.terms.html.056
<!-- source: terms.html:180 | kind: text -->
hello@bournewise.com

@@ s08.terms.html.057
<!-- source: terms.html:180 | kind: text -->
. These Terms are governed by the laws of the State of Delaware, USA, without regard to conflict-of-laws rules.

@@ s08.terms.html.058
<!-- source: terms.html:185 | kind: text -->
Terms

@@ s08.terms.html.059
<!-- source: terms.html:186 | kind: text -->
Privacy

@@ s08.terms.html.060
<!-- source: terms.html:187 | kind: text -->
Refund

@@ s08.terms.html.061
<!-- source: terms.html:188 | kind: text -->
About

@@ s08.terms.html.062
<!-- source: terms.html:190 | kind: text -->
BourneWise · fixed hexagram input · model-written interpretation

---

## 9. refund.html

*Refund policy* — 39 blocks

@@ s09.refund.html.001
<!-- source: refund.html:7 | kind: title -->
Refund Policy — BourneWise

@@ s09.refund.html.002
<!-- source: refund.html:85 | kind: aria-label -->
BourneWise home

@@ s09.refund.html.003
<!-- source: refund.html:7 | kind: text -->
Refund Policy — BourneWise

@@ s09.refund.html.004
<!-- source: refund.html:87 | kind: text -->
BourneWise

@@ s09.refund.html.005
<!-- source: refund.html:89 | kind: text -->
&larr; Back to plans

@@ s09.refund.html.006
<!-- source: refund.html:94 | kind: text -->
The fine print, said plainly

@@ s09.refund.html.007
<!-- source: refund.html:95 | kind: text -->
Refund Policy

@@ s09.refund.html.008
<!-- source: refund.html:96 | kind: text -->
Effective June 14, 2026 · BourneWise, Inc.

@@ s09.refund.html.009
<!-- source: refund.html:97 | kind: text -->
We&rsquo;d rather be clear up front than argue later. Here is exactly when money moves and when it doesn&rsquo;t.

@@ s09.refund.html.010
<!-- source: refund.html:100 | kind: text -->
◆  The one rule that matters

@@ s09.refund.html.011
<!-- source: refund.html:101 | kind: text -->
Only the Units a generation actually used are spent.

@@ s09.refund.html.012
<!-- source: refund.html:101 | kind: text -->
Nothing is held back when a reading starts, and there is no ceiling on what one can cost: the charge is the tokens the answer really used, settled once it finishes. A reading already underway always completes, even if settling it takes the balance below zero — the next request is what gets refused, never the one being written.

@@ s09.refund.html.013
<!-- source: refund.html:106 | kind: text -->
Why Units aren&rsquo;t refundable

@@ s09.refund.html.014
<!-- source: refund.html:107 | kind: text -->
A Unit pays for model usage. Because that compute is delivered immediately, Units actually consumed by a generation are non-refundable. The same metering applies to interrupted readings and follow-up questions: only measured usage is charged, up to the published maximum accepted before generation. Units have no cash value and cannot be transferred or exchanged for money.

@@ s09.refund.html.015
<!-- source: refund.html:111 | kind: text -->
Prepaid purchases

@@ s09.refund.html.016
<!-- source: refund.html:112 | kind: text -->
BourneWise sells one-time Unit packs and recurring monthly or annual subscriptions that include Units. One-time packs do not renew automatically. Subscriptions renew until canceled from your account.

@@ s09.refund.html.017
<!-- source: refund.html:114 | kind: text -->
Completed Unit-pack purchases are generally non-refundable except where required by law or where an exception below applies.

@@ s09.refund.html.018
<!-- source: refund.html:115 | kind: text -->
Canceling a subscription stops the next renewal; the current paid period and Units already granted remain available.

@@ s09.refund.html.019
<!-- source: refund.html:116 | kind: text -->
We do not expire a purchased balance or charge an inactivity fee.

@@ s09.refund.html.020
<!-- source: refund.html:121 | kind: text -->
When we will make it right

@@ s09.refund.html.021
<!-- source: refund.html:122 | kind: text -->
Rules have edges, and we honour them:

@@ s09.refund.html.022
<!-- source: refund.html:124 | kind: text -->
Duplicate or failed charges

@@ s09.refund.html.023
<!-- source: refund.html:124 | kind: text -->
— billed twice, or charged for Units that never reached your ledger? We&rsquo;ll refund or re-credit in full.

@@ s09.refund.html.024
<!-- source: refund.html:125 | kind: text -->
Service failure

@@ s09.refund.html.025
<!-- source: refund.html:125 | kind: text -->
— Units consumed but no reading returned due to a fault on our side are re-credited automatically; if not, tell us and we&rsquo;ll fix it.

@@ s09.refund.html.026
<!-- source: refund.html:126 | kind: text -->
Unauthorised purchase

@@ s09.refund.html.027
<!-- source: refund.html:126 | kind: text -->
— a charge you didn&rsquo;t make or authorise will be investigated and refunded where confirmed.

@@ s09.refund.html.028
<!-- source: refund.html:128 | kind: text -->
Disagreeing with an analysis is not a service failure. Outputs are interpretations, not guarantees.

@@ s09.refund.html.029
<!-- source: refund.html:132 | kind: text -->
Your statutory rights

@@ s09.refund.html.030
<!-- source: refund.html:133 | kind: text -->
Nothing here removes rights you have under the consumer law where you live. Some places give a cancellation window for digital purchases; where that applies, note that by asking a casting you request immediate performance and acknowledge that, once the casting is drawn, that right is used up for those Units. Your local rights still prevail over anything in this policy that conflicts with them.

@@ s09.refund.html.031
<!-- source: refund.html:137 | kind: text -->
How to ask

@@ s09.refund.html.032
<!-- source: refund.html:138 | kind: text -->
Write to

@@ s09.refund.html.033
<!-- source: refund.html:138 | kind: text -->
hello@bournewise.com

@@ s09.refund.html.034
<!-- source: refund.html:138 | kind: text -->
within 30 days of the charge, from the email on your account, with the date and amount. We aim to reply within two business days, and approved refunds return to the original payment method within 5&ndash;10 business days.

@@ s09.refund.html.035
<!-- source: refund.html:143 | kind: text -->
Terms

@@ s09.refund.html.036
<!-- source: refund.html:144 | kind: text -->
Privacy

@@ s09.refund.html.037
<!-- source: refund.html:145 | kind: text -->
Refund

@@ s09.refund.html.038
<!-- source: refund.html:146 | kind: text -->
Plans & units

@@ s09.refund.html.039
<!-- source: refund.html:148 | kind: text -->
BourneWise · fixed hexagram input · model-written interpretation

---

## 10. 404.html

*Not found* — 11 blocks

@@ s10.404.html.001
<!-- source: 404.html:7 | kind: title -->
Not found — BourneWise

@@ s10.404.html.002
<!-- source: 404.html:77 | kind: aria-label -->
BourneWise home

@@ s10.404.html.003
<!-- source: 404.html:7 | kind: text -->
Not found — BourneWise

@@ s10.404.html.004
<!-- source: 404.html:79 | kind: text -->
BourneWise

@@ s10.404.html.005
<!-- source: 404.html:81 | kind: text -->
Start a casting

@@ s10.404.html.006
<!-- source: 404.html:85 | kind: text -->
Page not found

@@ s10.404.html.007
<!-- source: 404.html:97 | kind: text -->
This page is not here.

@@ s10.404.html.008
<!-- source: 404.html:98 | kind: text -->
Check the address, or go back and ask your question. Nothing was charged.

@@ s10.404.html.009
<!-- source: 404.html:106 | kind: text -->
Start a reading

@@ s10.404.html.010
<!-- source: 404.html:107 | kind: text -->
See the method

@@ s10.404.html.011
<!-- source: 404.html:111 | kind: text -->
BourneWise · the figure is cast before a word is written about it

---

## 11. copy.js — runtime strings

*Shown to a reader while the app is running. Lines that carry a number are*
*functions of the live value, so they are rendered here with a sample.*

### `ledger`

@@ s11.copy.js.ledger.label
<!-- source: copy.js | kind: runtime text -->
Available units

@@ s11.copy.js.ledger.unit
<!-- source: copy.js | kind: runtime text -->
units

@@ s11.copy.js.ledger.capFree
<!-- source: copy.js | kind: runtime text -->
Your first reading is on us

@@ s11.copy.js.ledger.capPaid
<!-- source: copy.js | kind: runtime text -->
Your monthly units, plus any top-ups

@@ s11.copy.js.ledger.action
<!-- source: copy.js | kind: runtime text -->
Get units

### `composer`

@@ s11.copy.js.composer.placeholder
<!-- source: copy.js | kind: runtime text -->
Say it plainly…

@@ s11.copy.js.composer.methodNote
<!-- source: copy.js | kind: template -->
Sortis 6 · about 690 units typical · charged for what it uses

@@ s11.copy.js.composer.methodCost
<!-- source: copy.js | kind: template -->
~690

### `casting`

@@ s11.copy.js.casting.recastCarried
<!-- source: copy.js | kind: template -->
Recast a fresh hexagram for the same matter — “这件事” (about 690 units). For a different matter, state the new question in full.

@@ s11.copy.js.casting.recastSameThread
<!-- source: copy.js | kind: template -->
Cast a fresh hexagram for this, following the same thread (about 690 units).

@@ s11.copy.js.casting.routedToNew
<!-- source: copy.js | kind: template -->
This reads as a new question, so a fresh hexagram was cast, costing about 690 units. To keep asking about the previous casting, ask about it directly; a follow-up costs only what its own answer uses.

### `followUp`

@@ s11.copy.js.followUp.continuing
<!-- source: copy.js | kind: runtime text -->
The reading was cut short — charged only for what arrived; continuing on this same casting…

@@ s11.copy.js.followUp.cutAgain
<!-- source: copy.js | kind: runtime text -->
The reading was cut short again — you were only charged for what arrived. Send “continue” to pick it up.

@@ s11.copy.js.followUp.answerCut
<!-- source: copy.js | kind: runtime text -->
The answer was cut short — you were only charged for what arrived. Send “continue” to carry on.

@@ s11.copy.js.followUp.promptsNote
<!-- source: copy.js | kind: template -->
Nothing is sent until you submit. The same hexagram rides along with every follow-up, which is charged for what it uses — usually around 690 units.

#### `followUp.panel`

##### `followUp.panel.en`

@@ s11.copy.js.followUp.panel.en.kicker
<!-- source: copy.js | kind: template -->
Sortis 6 · Same hexagram

@@ s11.copy.js.followUp.panel.en.headContinued
<!-- source: copy.js | kind: runtime text -->
Hold the last answer against one more condition.

@@ s11.copy.js.followUp.panel.en.headSortis
<!-- source: copy.js | kind: runtime text -->
See what moved before you decide.

@@ s11.copy.js.followUp.panel.en.headStria
<!-- source: copy.js | kind: runtime text -->
See how it stands before you decide.

@@ s11.copy.js.followUp.panel.en.hint
<!-- source: copy.js | kind: runtime text -->
Pick one and it lands in the box. Change any of it before you send.

@@ s11.copy.js.followUp.panel.en.aria
<!-- source: copy.js | kind: template -->
Ask a follow-up using the same Sortis 6 hexagram

@@ s11.copy.js.followUp.panel.en.note
<!-- source: copy.js | kind: template -->
Nothing is sent until you submit. The same hexagram rides along with every follow-up, which is charged for what it uses — usually around 690 units.

##### `followUp.panel.zh`

@@ s11.copy.js.followUp.panel.zh.kicker
<!-- source: copy.js | kind: template -->
Sortis 6 · 同一卦

@@ s11.copy.js.followUp.panel.zh.headContinued
<!-- source: copy.js | kind: runtime text -->
换个角度，再核一遍刚才那个答案。

@@ s11.copy.js.followUp.panel.zh.headSortis
<!-- source: copy.js | kind: runtime text -->
决定之前，把这一动看清楚。

@@ s11.copy.js.followUp.panel.zh.headStria
<!-- source: copy.js | kind: runtime text -->
决定之前，把眼下的结构看清楚。

@@ s11.copy.js.followUp.panel.zh.hint
<!-- source: copy.js | kind: runtime text -->
点一条，它会填进输入框，发送前你可以改。

@@ s11.copy.js.followUp.panel.zh.aria
<!-- source: copy.js | kind: template -->
用同一个 Sortis 6 卦追问

@@ s11.copy.js.followUp.panel.zh.note
<!-- source: copy.js | kind: template -->
不点发送就什么都不会发出去。每次追问都带着同一个卦一起走，按实际用量计费 —— 通常在 690 点左右。

### `carry`

@@ s11.copy.js.carry.open
<!-- source: copy.js | kind: runtime text -->
Carry an earlier casting

@@ s11.copy.js.carry.openHint
<!-- source: copy.js | kind: runtime text -->
Bring a previous conversation in as background

@@ s11.copy.js.carry.head
<!-- source: copy.js | kind: runtime text -->
Which conversation should ride along?

@@ s11.copy.js.carry.note
<!-- source: copy.js | kind: runtime text -->
Its questions and readings travel with this thread as background. No new hexagram is drawn, and the earlier casting is not re-read.

@@ s11.copy.js.carry.empty
<!-- source: copy.js | kind: runtime text -->
Nothing earlier to carry yet.

@@ s11.copy.js.carry.carrying
<!-- source: copy.js | kind: template -->
Carrying · 这件事

@@ s11.copy.js.carry.drop
<!-- source: copy.js | kind: runtime text -->
Stop carrying this

@@ s11.copy.js.carry.dropped
<!-- source: copy.js | kind: runtime text -->
That conversation is no longer riding along.

@@ s11.copy.js.carry.added
<!-- source: copy.js | kind: template -->
“这件事” is now riding along with this thread.

### `readingFooter`

@@ s11.copy.js.readingFooter.en
<!-- source: copy.js | kind: runtime text -->
Please don't make major decisions on this reading alone — the technology behind it is still improving, and we will keep building toward a more capable and stable platform. Hold what you read here against what you can actually observe, take your time, and decide from your real circumstances. A casting offers possible directions, a more flexible way to think about where you are, and a mirror to look at yourself in — it does not offer certainty.

@@ s11.copy.js.readingFooter.zh
<!-- source: copy.js | kind: runtime text -->
请不要仅凭这篇解读做重大决定 —— 背后的技术仍在改进，我们也会一直把这个平台做得更准、更稳。把读到的东西拿去和你能真正看到的情况对照，慢慢审，按你的实际处境决定。卦给的是可能的方向、一种更活的想问题的角度，以及一面照自己的镜子 —— 它给不了定论。

### `account`

@@ s11.copy.js.account.signInToCast
<!-- source: copy.js | kind: runtime text -->
Sign in to cast — your first reading is on us.

@@ s11.copy.js.account.signedOut
<!-- source: copy.js | kind: runtime text -->
Signed out — your history and balance remain secure.

@@ s11.copy.js.account.readingDeleted
<!-- source: copy.js | kind: runtime text -->
Reading deleted.

### `errors`

@@ s11.copy.js.errors.outOfUnits
<!-- source: copy.js | kind: runtime text -->
You're out of units — top up to keep reading.

@@ s11.copy.js.errors.staleBuild
<!-- source: copy.js | kind: runtime text -->
The site just updated — refresh the page, then cast. Nothing was charged.

@@ s11.copy.js.errors.sessionExpired
<!-- source: copy.js | kind: runtime text -->
Your session has expired — sign in again to cast. Nothing was charged.

@@ s11.copy.js.errors.serverShort
<!-- source: copy.js | kind: runtime text -->
Not enough units on the server — add units and try again. Nothing was charged.

@@ s11.copy.js.errors.timedOut
<!-- source: copy.js | kind: runtime text -->
The reading timed out — please try again. Nothing was charged.

@@ s11.copy.js.errors.castFailed
<!-- source: copy.js | kind: runtime text -->
The reading stopped partway — you're charged for the words that arrived, so the balance above is already final. Try again.

@@ s11.copy.js.errors.castNothing
<!-- source: copy.js | kind: runtime text -->
The reading never started — nothing was charged. Try again.

@@ s11.copy.js.errors.answerNothing
<!-- source: copy.js | kind: runtime text -->
The answer never started — nothing was charged. Ask again.

@@ s11.copy.js.errors.tooFast
<!-- source: copy.js | kind: runtime text -->
Too many readings in a short time — wait a few minutes and cast again. Nothing was charged.

@@ s11.copy.js.errors.badRequest
<!-- source: copy.js | kind: runtime text -->
That question didn’t come through — try casting again. Nothing was charged.

@@ s11.copy.js.errors.upstreamDown
<!-- source: copy.js | kind: runtime text -->
The reading service is unavailable right now — nothing was generated and nothing was charged. Your free reading is still yours. Please try again shortly.

@@ s11.copy.js.errors.answerTimedOut
<!-- source: copy.js | kind: runtime text -->
The answer timed out — try again. Nothing was charged.

@@ s11.copy.js.errors.answerFailed
<!-- source: copy.js | kind: runtime text -->
The answer stopped partway — you're charged for the words that arrived, so the balance above is already final. Ask again.


---

## 12. Inline scripts in the pages

*The page extractor blanks every `<script>` body, which is right for the code*
*and wrong for the strings in it — these are the toasts, errors and empty*
*states the pages raise themselves.*

### index.html — 12 blocks

@@ s12.inline.001
<!-- source: index.html:1075 | kind: string -->
You bring the question. The coins bring the shape.

@@ s12.inline.002
<!-- source: index.html:1076 | kind: string -->
Six lines fall, and not one of them was chosen to please you.

@@ s12.inline.003
<!-- source: index.html:1077 | kind: string -->
The figure is settled before a word is written about it.

@@ s12.inline.004
<!-- source: index.html:1078 | kind: string -->
The reading explains the board. It never picks it.

@@ s12.inline.005
<!-- source: index.html:1079 | kind: string -->
Something fixed to argue with, on a day you cannot decide.

@@ s12.inline.006
<!-- source: index.html:1080 | kind: string -->
Every answer shows the board it came from.

@@ s12.inline.007
<!-- source: index.html:1086 | kind: string -->
(prefers-reduced-motion: reduce)

@@ s12.inline.008
<!-- source: index.html:1154 | kind: string -->
Should I accept the offer if it delays the work I care about?

@@ s12.inline.009
<!-- source: index.html:1155 | kind: string -->
What am I missing before I commit to this partnership?

@@ s12.inline.010
<!-- source: index.html:1156 | kind: string -->
Which constraint matters most in this decision?

@@ s12.inline.011
<!-- source: index.html:1157 | kind: string -->
Is this the right moment to leave, or should I wait?

@@ s12.inline.012
<!-- source: index.html:1158 | kind: string -->
What changed, and what should I do next?

### pricing.html — 11 blocks

@@ s12.inline.013
<!-- source: pricing.html:141 | kind: string -->
Not signed in

@@ s12.inline.014
<!-- source: pricing.html:141 | kind: string -->
Start a casting

@@ s12.inline.015
<!-- source: pricing.html:141 | kind: string -->
Sign in

@@ s12.inline.016
<!-- source: pricing.html:141 | kind: string -->
Current plan

@@ s12.inline.017
<!-- source: pricing.html:151 | kind: string -->
A typical reading works out to about

@@ s12.inline.018
<!-- source: pricing.html:151 | kind: string -->
units, and a follow-up about

@@ s12.inline.019
<!-- source: pricing.html:164 | kind: string -->
estimate with the

@@ s12.inline.020
<!-- source: pricing.html:164 | kind: string -->
-token prompt this method sends

@@ s12.inline.021
<!-- source: pricing.html:167 | kind: string -->
Sign in before opening checkout.

@@ s12.inline.022
<!-- source: pricing.html:167 | kind: string -->
Payments are not available yet. Nothing was charged.

@@ s12.inline.023
<!-- source: pricing.html:167 | kind: string -->
Checkout could not open. Nothing was charged.

### login.html — 6 blocks

@@ s12.inline.024
<!-- source: login.html:248 | kind: string -->
Sign in

@@ s12.inline.025
<!-- source: login.html:260 | kind: string -->
Show password

@@ s12.inline.026
<!-- source: login.html:260 | kind: string -->
Hide password

@@ s12.inline.027
<!-- source: login.html:290 | kind: string -->
Enter a valid email address.

@@ s12.inline.028
<!-- source: login.html:291 | kind: string -->
Password must be at least 8 characters.

@@ s12.inline.029
<!-- source: login.html:295 | kind: string -->
Something went wrong. Please try again.

### settings.html — 27 blocks

@@ s12.inline.030
<!-- source: settings.html:223 | kind: markup text -->
Display name

@@ s12.inline.031
<!-- source: settings.html:223 | kind: markup text -->
The name on your readings.

@@ s12.inline.032
<!-- source: settings.html:225 | kind: markup text -->
Receipts and account notices are sent here.

@@ s12.inline.033
<!-- source: settings.html:227 | kind: markup text -->
Save changes

@@ s12.inline.034
<!-- source: settings.html:227 | kind: markup text -->
Saved to your account and synced across devices.

@@ s12.inline.035
<!-- source: settings.html:234 | kind: string -->
Identity updated.

@@ s12.inline.036
<!-- source: settings.html:237 | kind: markup text -->
You\u2019re using BourneWise as a guest on this device.

@@ s12.inline.037
<!-- source: settings.html:237 | kind: markup text -->
Sign in

@@ s12.inline.038
<!-- source: settings.html:237 | kind: markup text -->
to sync your balance and reading history.

@@ s12.inline.039
<!-- source: settings.html:257 | kind: string -->
is now your default casting.

@@ s12.inline.040
<!-- source: settings.html:265 | kind: string -->
reading stored on this device.

@@ s12.inline.041
<!-- source: settings.html:265 | kind: string -->
readings stored on this device.

@@ s12.inline.042
<!-- source: settings.html:266 | kind: string -->
No readings stored yet.

@@ s12.inline.043
<!-- source: settings.html:270 | kind: string -->
Signed in as

@@ s12.inline.044
<!-- source: settings.html:271 | kind: markup text -->
Sign out

@@ s12.inline.045
<!-- source: settings.html:273 | kind: string -->
Signed out. Local balance and history remain on this device.

@@ s12.inline.046
<!-- source: settings.html:276 | kind: string -->
Using BourneWise as a guest.

@@ s12.inline.047
<!-- source: settings.html:283 | kind: string -->
There is no reading history to delete.

@@ s12.inline.048
<!-- source: settings.html:286 | kind: string -->
Reading history deleted from this device.

@@ s12.inline.049
<!-- source: settings.html:299 | kind: string -->
Cancellation scheduled. Receipts and invoices remain available in the Creem portal, and the plan stays active through the current period.

@@ s12.inline.050
<!-- source: settings.html:302 | kind: string -->
Creem emails every receipt. Open the portal for invoices, payment methods, renewal details, or cancellation.

@@ s12.inline.051
<!-- source: settings.html:310 | kind: string -->
Billing portal is unavailable right now.

@@ s12.inline.052
<!-- source: settings.html:311 | kind: string -->
Network request failed. Try again.

@@ s12.inline.053
<!-- source: settings.html:315 | kind: string -->
Cancel your subscription? Your plan stays active through the current billing period, and existing units remain available.

@@ s12.inline.054
<!-- source: settings.html:319 | kind: string -->
Cancellation scheduled.

@@ s12.inline.055
<!-- source: settings.html:319 | kind: string -->
Cancellation failed.

@@ s12.inline.056
<!-- source: settings.html:326 | kind: string -->
Payment received. Creem has emailed your receipt; your units are syncing now.


---

## 13. chat-app.js

*聊天 UI — 投卦流程、toast、报错、空状态、解读外壳* — 124 blocks

@@ s13.chat-app.js.001
<!-- source: chat-app.js:17 | kind: string -->
The Well

@@ s13.chat-app.js.002
<!-- source: chat-app.js:17 | kind: string -->
The Crossing

@@ s13.chat-app.js.003
<!-- source: chat-app.js:83 | kind: string -->
Sign in

@@ s13.chat-app.js.004
<!-- source: chat-app.js:86 | kind: string -->
units available — get more

@@ s13.chat-app.js.005
<!-- source: chat-app.js:114 | kind: string -->
Sign in to start a reading

@@ s13.chat-app.js.006
<!-- source: chat-app.js:117 | kind: string -->
Sign in to sync your balance and readings

@@ s13.chat-app.js.007
<!-- source: chat-app.js:161 | kind: string -->
They asked:

@@ s13.chat-app.js.008
<!-- source: chat-app.js:162 | kind: string -->
The reading said:

@@ s13.chat-app.js.009
<!-- source: chat-app.js:185 | kind: string -->
" aria-label="

@@ s13.chat-app.js.010
<!-- source: chat-app.js:238 | kind: string -->
Untitled casting

@@ s13.chat-app.js.011
<!-- source: chat-app.js:272 | kind: markup text -->
Choose an analysis depth

@@ s13.chat-app.js.012
<!-- source: chat-app.js:294 | kind: markup text -->
Reading history

@@ s13.chat-app.js.013
<!-- source: chat-app.js:338 | kind: string -->
growing, pushing outward

@@ s13.chat-app.js.014
<!-- source: chat-app.js:338 | kind: string -->
bright, quick to show itself

@@ s13.chat-app.js.015
<!-- source: chat-app.js:339 | kind: string -->
steady, slow to move

@@ s13.chat-app.js.016
<!-- source: chat-app.js:340 | kind: string -->
deep, finding the low road

@@ s13.chat-app.js.017
<!-- source: chat-app.js:344 | kind: string -->
an equal on your own footing \u2014 allies and rivals working the same ground you are

@@ s13.chat-app.js.018
<!-- source: chat-app.js:346 | kind: string -->
what answers to you \u2014 resources and gains you can take in hand

@@ s13.chat-app.js.019
<!-- source: chat-app.js:351 | kind: string -->
feeds your position

@@ s13.chat-app.js.020
<!-- source: chat-app.js:352 | kind: string -->
an equal beside you

@@ s13.chat-app.js.021
<!-- source: chat-app.js:353 | kind: string -->
what you put out

@@ s13.chat-app.js.022
<!-- source: chat-app.js:354 | kind: string -->
what answers to you

@@ s13.chat-app.js.023
<!-- source: chat-app.js:355 | kind: string -->
what bears down on you

@@ s13.chat-app.js.024
<!-- source: chat-app.js:373 | kind: string -->
line</b> turns

@@ s13.chat-app.js.025
<!-- source: chat-app.js:376 | kind: string -->
Two lines are in motion \u2014

@@ s13.chat-app.js.026
<!-- source: chat-app.js:379 | kind: markup text -->
It is turning into

@@ s13.chat-app.js.027
<!-- source: chat-app.js:381 | kind: markup text -->
crosses into

@@ s13.chat-app.js.028
<!-- source: chat-app.js:382 | kind: string -->
</b> \u2014 not where you stand now, but where this is heading.</p>

@@ s13.chat-app.js.029
<!-- source: chat-app.js:389 | kind: markup text -->
Self \u2014 where you stand

@@ s13.chat-app.js.030
<!-- source: chat-app.js:390 | kind: markup text -->
Response \u2014 the other side

@@ s13.chat-app.js.031
<!-- source: chat-app.js:393 | kind: markup text -->
Moving line \u2014 what is turning

@@ s13.chat-app.js.032
<!-- source: chat-app.js:394 | kind: markup text -->
feeds \u00b7 generating

@@ s13.chat-app.js.033
<!-- source: chat-app.js:395 | kind: markup text -->
checks \u00b7 controlling

@@ s13.chat-app.js.034
<!-- source: chat-app.js:410 | kind: string -->
class="bw-zg-svg settled"

@@ s13.chat-app.js.035
<!-- source: chat-app.js:412 | kind: string -->
Coloured by element · the arrow shows how the turning line acts on you

@@ s13.chat-app.js.036
<!-- source: chat-app.js:413 | kind: string -->
Coloured by element · the figure as it stands

@@ s13.chat-app.js.037
<!-- source: chat-app.js:418 | kind: markup text -->
Reading the figure

@@ s13.chat-app.js.038
<!-- source: chat-app.js:440 | kind: markup text -->
What’s turning

@@ s13.chat-app.js.039
<!-- source: chat-app.js:444 | kind: markup text -->
Where it’s heading

@@ s13.chat-app.js.040
<!-- source: chat-app.js:499 | kind: string -->
+ (window.BW_BUILD ||

@@ s13.chat-app.js.041
<!-- source: chat-app.js:559 | kind: string -->
+ esc(hit.key) +

@@ s13.chat-app.js.042
<!-- source: chat-app.js:636 | kind: string -->
+ cls +

@@ s13.chat-app.js.043
<!-- source: chat-app.js:637 | kind: string -->
+ esc(nm(n)) +

@@ s13.chat-app.js.044
<!-- source: chat-app.js:655 | kind: string -->
+ esc(list.join(zh ?

@@ s13.chat-app.js.045
<!-- source: chat-app.js:658 | kind: string -->
+ (zh ? "zh" : "en") +

@@ s13.chat-app.js.046
<!-- source: chat-app.js:659 | kind: string -->
>' + esc(zh ?

@@ s13.chat-app.js.047
<!-- source: chat-app.js:663 | kind: string -->
>' + sheng +

@@ s13.chat-app.js.048
<!-- source: chat-app.js:664 | kind: string -->
>' + ke +

@@ s13.chat-app.js.049
<!-- source: chat-app.js:702 | kind: string -->
+ esc(key) +

@@ s13.chat-app.js.050
<!-- source: chat-app.js:702 | kind: string -->
' + ' aria-expanded=

@@ s13.chat-app.js.051
<!-- source: chat-app.js:703 | kind: string -->
' + ' title=

@@ s13.chat-app.js.052
<!-- source: chat-app.js:704 | kind: string -->
+ esc(zh ? key + " 在这一卦里还可能是:" + lead.join("、") + " —— 点开看全部" : (entry.en || key) + " could also be: " + lead.join(", ") + " — open for all") +

@@ s13.chat-app.js.053
<!-- source: chat-app.js:707 | kind: markup text -->
' + esc(zh ? key : (entry.en || key)) + '

@@ s13.chat-app.js.054
<!-- source: chat-app.js:718 | kind: string -->
>' + rows.join(

@@ s13.chat-app.js.055
<!-- source: chat-app.js:779 | kind: string -->
+ esc(sym) +

@@ s13.chat-app.js.056
<!-- source: chat-app.js:810 | kind: string -->
+ (n % 2 === 0 ? " alt" : "") +

@@ s13.chat-app.js.057
<!-- source: chat-app.js:820 | kind: string -->
>' + mdInline(para.join(

@@ s13.chat-app.js.058
<!-- source: chat-app.js:830 | kind: string -->
: (lvl === 2 ?

@@ s13.chat-app.js.059
<!-- source: chat-app.js:831 | kind: string -->
>' + mdInline(hm[2]) +

@@ s13.chat-app.js.060
<!-- source: chat-app.js:835 | kind: string -->
+ mdInline(lm[1]) +

@@ s13.chat-app.js.061
<!-- source: chat-app.js:858 | kind: string -->
+ xrHits().join(",") +

@@ s13.chat-app.js.062
<!-- source: chat-app.js:858 | kind: markup text -->
' + (prose || '

@@ s13.chat-app.js.063
<!-- source: chat-app.js:859 | kind: markup text -->
') + xrChain(msg.text) + xrMaybe(msg.text) + readingFootnote(msg.text) + '

@@ s13.chat-app.js.064
<!-- source: chat-app.js:864 | kind: string -->
+ r.verdict +

@@ s13.chat-app.js.065
<!-- source: chat-app.js:864 | kind: string -->
>' + (V_LABEL[r.verdict] ||

@@ s13.chat-app.js.066
<!-- source: chat-app.js:867 | kind: markup text -->
Line ' + k.line + '

@@ s13.chat-app.js.067
<!-- source: chat-app.js:867 | kind: string -->
>' + esc(k.note ||

@@ s13.chat-app.js.068
<!-- source: chat-app.js:869 | kind: markup text -->
What decides it

@@ s13.chat-app.js.069
<!-- source: chat-app.js:869 | kind: string -->
>' + keys + '</ul></div>' :

@@ s13.chat-app.js.070
<!-- source: chat-app.js:870 | kind: string -->
>' + esc(r.timing) + '</p></div>' :

@@ s13.chat-app.js.071
<!-- source: chat-app.js:887 | kind: string -->
+ (zh ?

@@ s13.chat-app.js.072
<!-- source: chat-app.js:912 | kind: string -->
|| msg.method ===

@@ s13.chat-app.js.073
<!-- source: chat-app.js:984 | kind: string -->
+ (zhPanel ?

@@ s13.chat-app.js.074
<!-- source: chat-app.js:984 | kind: string -->
+ esc(L.aria(methodLabel)) +

@@ s13.chat-app.js.075
<!-- source: chat-app.js:985 | kind: markup text -->
' + esc(L.kicker(methodLabel)) + '

@@ s13.chat-app.js.076
<!-- source: chat-app.js:985 | kind: markup text -->
' + esc(continued ? L.headContinued : (sortis ? L.headSortis : L.headStria)) + '

@@ s13.chat-app.js.077
<!-- source: chat-app.js:985 | kind: markup text -->
' + esc(L.hint) + '

@@ s13.chat-app.js.078
<!-- source: chat-app.js:985 | kind: markup text -->
' + (axes.length && !continued ? '

@@ s13.chat-app.js.079
<!-- source: chat-app.js:989 | kind: string -->
+ esc(a.q) +

@@ s13.chat-app.js.080
<!-- source: chat-app.js:989 | kind: string -->
+ esc(a.key) +

@@ s13.chat-app.js.081
<!-- source: chat-app.js:989 | kind: markup text -->
' + esc(a.label) + '

@@ s13.chat-app.js.082
<!-- source: chat-app.js:993 | kind: string -->
+ esc(p[1]) +

@@ s13.chat-app.js.083
<!-- source: chat-app.js:993 | kind: markup text -->
' + esc(p[0]) + '

@@ s13.chat-app.js.084
<!-- source: chat-app.js:993 | kind: markup text -->
' + esc(p[1]) + '

@@ s13.chat-app.js.085
<!-- source: chat-app.js:998 | kind: markup text -->
' + esc(L.note(A.followCost(sortis ? 'sortis' : 'stria'))) + '

@@ s13.chat-app.js.086
<!-- source: chat-app.js:1010 | kind: markup text -->
Follow up

@@ s13.chat-app.js.087
<!-- source: chat-app.js:1013 | kind: markup text -->
New casting

@@ s13.chat-app.js.088
<!-- source: chat-app.js:1033 | kind: markup text -->
  New reading

@@ s13.chat-app.js.089
<!-- source: chat-app.js:1037 | kind: string -->
></path>' +

@@ s13.chat-app.js.090
<!-- source: chat-app.js:1047 | kind: string -->
+ (opts.animateLast && i === c.msgs.length - 1 ?

@@ s13.chat-app.js.091
<!-- source: chat-app.js:1095 | kind: string -->
". Reply with ONE honest judgment, 1-3 sentences, plain modern language, no hedging, no mysticism dump.

@@ s13.chat-app.js.092
<!-- source: chat-app.js:1096 | kind: string -->
Wrap exactly ONE key word or short phrase in pipes like |this| for emphasis.

@@ s13.chat-app.js.093
<!-- source: chat-app.js:1097 | kind: string -->
Reply in English with the judgment only.

@@ s13.chat-app.js.094
<!-- source: chat-app.js:1140 | kind: string -->
». Background only: it tells you what they have already asked and been told, so you

@@ s13.chat-app.js.095
<!-- source: chat-app.js:1141 | kind: string -->
do not make them repeat it. Do NOT re-read that earlier hexagram or treat its casting

@@ s13.chat-app.js.096
<!-- source: chat-app.js:1142 | kind: string -->
as evidence for this question — this question has its own casting.]

@@ s13.chat-app.js.097
<!-- source: chat-app.js:1145 | kind: string -->
Understood — I have their earlier conversation as background and will read only the

@@ s13.chat-app.js.098
<!-- source: chat-app.js:1146 | kind: string -->
casting in front of me.

@@ s13.chat-app.js.099
<!-- source: chat-app.js:1151 | kind: string -->
OWN question on its OWN hexagram. Use them so you do not repeat yourself and so you know

@@ s13.chat-app.js.100
<!-- source: chat-app.js:1152 | kind: string -->
what has already been asked. Do NOT carry their conclusions into this reading, do NOT

@@ s13.chat-app.js.101
<!-- source: chat-app.js:1153 | kind: string -->
count agreement with them as confirmation, and above all do NOT reuse a 生克/合冲/比和

@@ s13.chat-app.js.102
<!-- source: chat-app.js:1154 | kind: string -->
reading made there: those relations were mapped to human meaning for a DIFFERENT question,

@@ s13.chat-app.js.103
<!-- source: chat-app.js:1155 | kind: string -->
and the same relation means something else here. This question has its own casting — read

@@ s13.chat-app.js.104
<!-- source: chat-app.js:1156 | kind: string -->
that one.]

@@ s13.chat-app.js.105
<!-- source: chat-app.js:1158 | kind: string -->
Understood — earlier castings are background. I will read only the hexagram in front of me

@@ s13.chat-app.js.106
<!-- source: chat-app.js:1159 | kind: string -->
and will not treat their findings as evidence.

@@ s13.chat-app.js.107
<!-- source: chat-app.js:1209 | kind: string -->
Route this message.

@@ s13.chat-app.js.108
<!-- source: chat-app.js:1701 | kind: string -->
oracle call failed

@@ s13.chat-app.js.109
<!-- source: chat-app.js:2040 | kind: string -->
—— 它在万物类象里指的全部

@@ s13.chat-app.js.110
<!-- source: chat-app.js:2040 | kind: string -->
— everything it points at

@@ s13.chat-app.js.111
<!-- source: chat-app.js:2049 | kind: string -->
它做的事

@@ s13.chat-app.js.112
<!-- source: chat-app.js:2049 | kind: string -->
what it does

@@ s13.chat-app.js.113
<!-- source: chat-app.js:2119 | kind: string -->
」是

@@ s13.chat-app.js.114
<!-- source: chat-app.js:2119 | kind: string -->
走的

@@ s13.chat-app.js.115
<!-- source: chat-app.js:2119 | kind: string -->
这一支。同一路还有别的分支,点开看它们具体是些什么:

@@ s13.chat-app.js.116
<!-- source: chat-app.js:2120 | kind: string -->
” is

@@ s13.chat-app.js.117
<!-- source: chat-app.js:2120 | kind: string -->
taken as

@@ s13.chat-app.js.118
<!-- source: chat-app.js:2123 | kind: string -->
」这里读的是

@@ s13.chat-app.js.119
<!-- source: chat-app.js:2123 | kind: string -->
。这一路分这几支 —— 点开看它具体是些什么:

@@ s13.chat-app.js.120
<!-- source: chat-app.js:2124 | kind: string -->
read one way. It runs in these branches — open one to see what it actually is:

@@ s13.chat-app.js.121
<!-- source: chat-app.js:2127 | kind: string -->
" data-i="

@@ s13.chat-app.js.122
<!-- source: chat-app.js:2127 | kind: string -->
" aria-expanded="false">

@@ s13.chat-app.js.123
<!-- source: chat-app.js:2293 | kind: string -->
Ask what this casting means for your situation…

@@ s13.chat-app.js.124
<!-- source: chat-app.js:2305 | kind: string -->
Ask what this casting means for your situation\u2026


---

## 14. account.js

*余额、套餐名、账本条目* — 17 blocks

@@ s14.account.js.001
<!-- source: account.js:53 | kind: string -->
Stria 64

@@ s14.account.js.002
<!-- source: account.js:53 | kind: string -->
Present structure

@@ s14.account.js.003
<!-- source: account.js:54 | kind: string -->
Primary hexagram

@@ s14.account.js.004
<!-- source: account.js:55 | kind: string -->
Interprets the primary hexagram against your question.

@@ s14.account.js.005
<!-- source: account.js:59 | kind: string -->
Sortis 6

@@ s14.account.js.006
<!-- source: account.js:59 | kind: string -->
Change analysis

@@ s14.account.js.007
<!-- source: account.js:60 | kind: string -->
Primary + transformed hexagrams

@@ s14.account.js.008
<!-- source: account.js:61 | kind: string -->
Adds moving lines and the transformed hexagram to the analysis.

@@ s14.account.js.009
<!-- source: account.js:315 | kind: string -->
accounts backend not configured

@@ s14.account.js.010
<!-- source: account.js:316 | kind: string -->
request failed (

@@ s14.account.js.011
<!-- source: account.js:319 | kind: string -->
network error —

@@ s14.account.js.012
<!-- source: account.js:341 | kind: string -->
units each month

@@ s14.account.js.013
<!-- source: account.js:347 | kind: string -->
Your first reading is free

@@ s14.account.js.014
<!-- source: account.js:347 | kind: string -->
free readings

@@ s14.account.js.015
<!-- source: account.js:348 | kind: string -->
· subscriptions and one-time top-ups available

@@ s14.account.js.016
<!-- source: account.js:363 | kind: string -->
Not signed in

@@ s14.account.js.017
<!-- source: account.js:370 | kind: string -->
Sign in to sync your balance and readings


---

## 15. sidebar.js

*会话列表、余额片、账户行* — 18 blocks

@@ s15.sidebar.js.001
<!-- source: sidebar.js:81 | kind: string -->
transition:opacity .16s ease,transform .18s cubic-bezier(.4,0,.2,1),visibility 0s linear .16s}

@@ s15.sidebar.js.002
<!-- source: sidebar.js:83 | kind: string -->
transition:opacity .16s ease,transform .18s cubic-bezier(.4,0,.2,1)}

@@ s15.sidebar.js.003
<!-- source: sidebar.js:99 | kind: aria-label -->
BourneWise logomark

@@ s15.sidebar.js.004
<!-- source: sidebar.js:106 | kind: aria-label -->
BourneWise home

@@ s15.sidebar.js.005
<!-- source: sidebar.js:109 | kind: aria-label -->
Collapse sidebar

@@ s15.sidebar.js.006
<!-- source: sidebar.js:109 | kind: title -->
Collapse sidebar

@@ s15.sidebar.js.007
<!-- source: sidebar.js:113 | kind: markup text -->
New casting

@@ s15.sidebar.js.008
<!-- source: sidebar.js:115 | kind: markup text -->
Reading history

@@ s15.sidebar.js.009
<!-- source: sidebar.js:115 | kind: aria-label -->
Reading history

@@ s15.sidebar.js.010
<!-- source: sidebar.js:117 | kind: markup text -->
Available units

@@ s15.sidebar.js.011
<!-- source: sidebar.js:120 | kind: markup text -->
of monthly balance

@@ s15.sidebar.js.012
<!-- source: sidebar.js:121 | kind: markup text -->
Get units

@@ s15.sidebar.js.013
<!-- source: sidebar.js:125 | kind: markup text -->
Not signed in

@@ s15.sidebar.js.014
<!-- source: sidebar.js:129 | kind: markup text -->
Sign in to sync your balance and readings

@@ s15.sidebar.js.015
<!-- source: sidebar.js:130 | kind: markup text -->
Plan & units

@@ s15.sidebar.js.016
<!-- source: sidebar.js:132 | kind: markup text -->
Sign out

@@ s15.sidebar.js.017
<!-- source: sidebar.js:169 | kind: string -->
No readings yet. Your first casting will appear here.

@@ s15.sidebar.js.018
<!-- source: sidebar.js:194 | kind: string -->
Your first reading is on us


---

## 16. ds-base.js

*共享 chrome* — 2 blocks

@@ s16.ds-base.js.001
<!-- source: ds-base.js:102 | kind: string -->
claude proxy

@@ s16.ds-base.js.002
<!-- source: ds-base.js:118 | kind: string -->
claude proxy: bad response


---

## 17. casting-figure.js

*排卦图 — 六十四卦名与爻的注解* — 131 blocks

@@ s17.casting-figure.js.001
<!-- source: casting-figure.js:17 | kind: string -->
The Creative

@@ s17.casting-figure.js.002
<!-- source: casting-figure.js:17 | kind: string -->
The Receptive

@@ s17.casting-figure.js.003
<!-- source: casting-figure.js:18 | kind: string -->
Difficulty at the Beginning

@@ s17.casting-figure.js.004
<!-- source: casting-figure.js:18 | kind: string -->
Youthful Folly

@@ s17.casting-figure.js.005
<!-- source: casting-figure.js:20 | kind: string -->
The Army

@@ s17.casting-figure.js.006
<!-- source: casting-figure.js:20 | kind: string -->
Holding Together

@@ s17.casting-figure.js.007
<!-- source: casting-figure.js:21 | kind: string -->
Small Taming

@@ s17.casting-figure.js.008
<!-- source: casting-figure.js:23 | kind: string -->
Great Possession

@@ s17.casting-figure.js.009
<!-- source: casting-figure.js:25 | kind: string -->
Work on the Decayed

@@ s17.casting-figure.js.010
<!-- source: casting-figure.js:27 | kind: string -->
Biting Through

@@ s17.casting-figure.js.011
<!-- source: casting-figure.js:28 | kind: string -->
Splitting Apart

@@ s17.casting-figure.js.012
<!-- source: casting-figure.js:29 | kind: string -->
Great Taming

@@ s17.casting-figure.js.013
<!-- source: casting-figure.js:30 | kind: string -->
Great Exceeding

@@ s17.casting-figure.js.014
<!-- source: casting-figure.js:31 | kind: string -->
The Abysmal

@@ s17.casting-figure.js.015
<!-- source: casting-figure.js:31 | kind: string -->
The Clinging

@@ s17.casting-figure.js.016
<!-- source: casting-figure.js:33 | kind: string -->
Great Power

@@ s17.casting-figure.js.017
<!-- source: casting-figure.js:34 | kind: string -->
Darkening of the Light

@@ s17.casting-figure.js.018
<!-- source: casting-figure.js:35 | kind: string -->
The Family

@@ s17.casting-figure.js.019
<!-- source: casting-figure.js:38 | kind: string -->
Coming to Meet

@@ s17.casting-figure.js.020
<!-- source: casting-figure.js:39 | kind: string -->
Gathering Together

@@ s17.casting-figure.js.021
<!-- source: casting-figure.js:39 | kind: string -->
Pushing Upward

@@ s17.casting-figure.js.022
<!-- source: casting-figure.js:40 | kind: string -->
The Well

@@ s17.casting-figure.js.023
<!-- source: casting-figure.js:41 | kind: string -->
The Cauldron

@@ s17.casting-figure.js.024
<!-- source: casting-figure.js:42 | kind: string -->
The Arousing

@@ s17.casting-figure.js.025
<!-- source: casting-figure.js:42 | kind: string -->
Keeping Still

@@ s17.casting-figure.js.026
<!-- source: casting-figure.js:43 | kind: string -->
The Marrying Maiden

@@ s17.casting-figure.js.027
<!-- source: casting-figure.js:44 | kind: string -->
The Wanderer

@@ s17.casting-figure.js.028
<!-- source: casting-figure.js:45 | kind: string -->
The Gentle

@@ s17.casting-figure.js.029
<!-- source: casting-figure.js:45 | kind: string -->
The Joyous

@@ s17.casting-figure.js.030
<!-- source: casting-figure.js:47 | kind: string -->
Inner Truth

@@ s17.casting-figure.js.031
<!-- source: casting-figure.js:47 | kind: string -->
Small Exceeding

@@ s17.casting-figure.js.032
<!-- source: casting-figure.js:48 | kind: string -->
After Completion

@@ s17.casting-figure.js.033
<!-- source: casting-figure.js:48 | kind: string -->
Before Completion

@@ s17.casting-figure.js.034
<!-- source: casting-figure.js:56 | kind: string -->
yielding, receptive

@@ s17.casting-figure.js.035
<!-- source: casting-figure.js:57 | kind: string -->
arousing, sudden movement

@@ s17.casting-figure.js.036
<!-- source: casting-figure.js:58 | kind: string -->
depth, the unavoidable

@@ s17.casting-figure.js.037
<!-- source: casting-figure.js:59 | kind: string -->
openness, quiet joy

@@ s17.casting-figure.js.038
<!-- source: casting-figure.js:60 | kind: string -->
stillness, the immovable

@@ s17.casting-figure.js.039
<!-- source: casting-figure.js:61 | kind: string -->
clarity, what clings and shows

@@ s17.casting-figure.js.040
<!-- source: casting-figure.js:62 | kind: string -->
gentle, persistent pressure

@@ s17.casting-figure.js.041
<!-- source: casting-figure.js:63 | kind: string -->
force, pure initiative

@@ s17.casting-figure.js.042
<!-- source: casting-figure.js:212 | kind: string -->
" cy="

@@ s17.casting-figure.js.043
<!-- source: casting-figure.js:213 | kind: string -->
" r="2.7" fill="none" stroke="

@@ s17.casting-figure.js.044
<!-- source: casting-figure.js:213 | kind: string -->
" stroke-width="1.4"></circle>

@@ s17.casting-figure.js.045
<!-- source: casting-figure.js:216 | kind: string -->
" height="

@@ s17.casting-figure.js.046
<!-- source: casting-figure.js:217 | kind: string -->
" viewBox="0 0

@@ s17.casting-figure.js.047
<!-- source: casting-figure.js:217 | kind: string -->
" fill="

@@ s17.casting-figure.js.048
<!-- source: casting-figure.js:217 | kind: string -->
" aria-hidden="true">

@@ s17.casting-figure.js.049
<!-- source: casting-figure.js:256 | kind: string -->
Sortis 6

@@ s17.casting-figure.js.050
<!-- source: casting-figure.js:256 | kind: string -->
Stria 64

@@ s17.casting-figure.js.051
<!-- source: casting-figure.js:268 | kind: string -->
stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">

@@ s17.casting-figure.js.052
<!-- source: casting-figure.js:294 | kind: string -->
" repeatCount="indefinite" values="

@@ s17.casting-figure.js.053
<!-- source: casting-figure.js:299 | kind: string -->
aria-hidden="true" focusable="false">

@@ s17.casting-figure.js.054
<!-- source: casting-figure.js:373 | kind: string -->
line ·

@@ s17.casting-figure.js.055
<!-- source: casting-figure.js:373 | kind: string -->
· moving

@@ s17.casting-figure.js.056
<!-- source: casting-figure.js:428 | kind: string -->
" fill="currentColor" stroke="currentColor"

@@ s17.casting-figure.js.057
<!-- source: casting-figure.js:429 | kind: string -->
stroke-width="0.5" stroke-linejoin="round" stroke-linecap="round"></path>

@@ s17.casting-figure.js.058
<!-- source: casting-figure.js:474 | kind: string -->
(prefers-reduced-motion: reduce)

@@ s17.casting-figure.js.059
<!-- source: casting-figure.js:532 | kind: string -->
mapping the present

@@ s17.casting-figure.js.060
<!-- source: casting-figure.js:532 | kind: string -->
locating the change

@@ s17.casting-figure.js.061
<!-- source: casting-figure.js:533 | kind: string -->
forming the inner trigram

@@ s17.casting-figure.js.062
<!-- source: casting-figure.js:533 | kind: string -->
forming the outer trigram

@@ s17.casting-figure.js.063
<!-- source: casting-figure.js:537 | kind: string -->
of 6: resolving coin faces

@@ s17.casting-figure.js.064
<!-- source: casting-figure.js:550 | kind: string -->
old yang

@@ s17.casting-figure.js.065
<!-- source: casting-figure.js:550 | kind: string -->
old yin

@@ s17.casting-figure.js.066
<!-- source: casting-figure.js:550 | kind: string -->
young yang

@@ s17.casting-figure.js.067
<!-- source: casting-figure.js:550 | kind: string -->
young yin

@@ s17.casting-figure.js.068
<!-- source: casting-figure.js:551 | kind: string -->
of 6:

@@ s17.casting-figure.js.069
<!-- source: casting-figure.js:582 | kind: string -->
Setting the trigrams\u2026

@@ s17.casting-figure.js.070
<!-- source: casting-figure.js:588 | kind: string -->
Mapping the change\u2026

@@ s17.casting-figure.js.071
<!-- source: casting-figure.js:588 | kind: string -->
Reading the structure\u2026

@@ s17.casting-figure.js.072
<!-- source: casting-figure.js:595 | kind: string -->
Opening the reading\u2026

@@ s17.casting-figure.js.073
<!-- source: casting-figure.js:652 | kind: string -->
" text-anchor="middle">

@@ s17.casting-figure.js.074
<!-- source: casting-figure.js:717 | kind: string -->
transition:fill .46s var(--ease-out,cubic-bezier(.23,1,.32,1))}

@@ s17.casting-figure.js.075
<!-- source: casting-figure.js:734 | kind: string -->
@keyframes bwLineFloat{

@@ s17.casting-figure.js.076
<!-- source: casting-figure.js:985 | kind: string -->
The moving line feeds your position \u2014 the shift underway is pouring strength into where you stand. Lean into it; momentum is on your side.

@@ s17.casting-figure.js.077
<!-- source: casting-figure.js:986 | kind: string -->
Your position feeds the moving line \u2014 you are the one powering this shift. Nothing moves on its own here, and it keeps costing you to drive it.

@@ s17.casting-figure.js.078
<!-- source: casting-figure.js:987 | kind: string -->
The moving line checks your position \u2014 the shift underway bears straight down on where you stand. Shore up your footing before you commit.

@@ s17.casting-figure.js.079
<!-- source: casting-figure.js:988 | kind: string -->
Your position checks the moving line \u2014 you hold the brake on this shift. It waits on your decision, not the other way round.

@@ s17.casting-figure.js.080
<!-- source: casting-figure.js:989 | kind: string -->
The moving line shares your element \u2014 this shift is an extension of your own position, not an outside force. Read it as your own momentum.

@@ s17.casting-figure.js.081
<!-- source: casting-figure.js:992 | kind: string -->
The other side of the figure feeds your position \u2014 circumstances are quietly working in your favour. Receive what's offered before you spend.

@@ s17.casting-figure.js.082
<!-- source: casting-figure.js:994 | kind: string -->
The other side checks your position \u2014 outside pressure is set against where you stand. Hold the line; forcing it uphill only spends you.

@@ s17.casting-figure.js.083
<!-- source: casting-figure.js:995 | kind: string -->
Your position checks the other side \u2014 the leverage here is yours. Move deliberately and the rest gives way.

@@ s17.casting-figure.js.084
<!-- source: casting-figure.js:996 | kind: string -->
Both sides of the figure share your element \u2014 the matter is evenly matched and self-reinforcing. The tie breaks only by your move.

@@ s17.casting-figure.js.085
<!-- source: casting-figure.js:1005 | kind: string -->
First (bottom)

@@ s17.casting-figure.js.086
<!-- source: casting-figure.js:1005 | kind: string -->
Sixth (top)

@@ s17.casting-figure.js.087
<!-- source: casting-figure.js:1049 | kind: string -->
" width="

@@ s17.casting-figure.js.088
<!-- source: casting-figure.js:1049 | kind: string -->
" height="8" rx="2.5" fill="

@@ s17.casting-figure.js.089
<!-- source: casting-figure.js:1056 | kind: string -->
" r="4.6" fill="var(--paper-raised)" stroke="var(--terracotta)" stroke-width="1.6"></circle>

@@ s17.casting-figure.js.090
<!-- source: casting-figure.js:1057 | kind: string -->
" class="bw-zg-el" fill="

@@ s17.casting-figure.js.091
<!-- source: casting-figure.js:1060 | kind: string -->
" class="bw-zg-mk

@@ s17.casting-figure.js.092
<!-- source: casting-figure.js:1076 | kind: string -->
" viewBox="0 0 12 12" refX="7.6" refY="6" markerWidth="5" markerHeight="5" orient="auto-start-reverse">

@@ s17.casting-figure.js.093
<!-- source: casting-figure.js:1077 | kind: string -->
" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path></marker>

@@ s17.casting-figure.js.094
<!-- source: casting-figure.js:1078 | kind: string -->
" class="bw-zg-arrow" stroke="

@@ s17.casting-figure.js.095
<!-- source: casting-figure.js:1078 | kind: string -->
" marker-end="url(#

@@ s17.casting-figure.js.096
<!-- source: casting-figure.js:1079 | kind: string -->
" class="bw-zg-flow

@@ s17.casting-figure.js.097
<!-- source: casting-figure.js:1079 | kind: string -->
" stroke="

@@ s17.casting-figure.js.098
<!-- source: casting-figure.js:1079 | kind: string -->
" style="--bw-zg-i:

@@ s17.casting-figure.js.099
<!-- source: casting-figure.js:1084 | kind: string -->
The moving line falls on your own position \u2014 the change here is yours to make, not one happening to you.

@@ s17.casting-figure.js.100
<!-- source: casting-figure.js:1086 | kind: string -->
" class="bw-zg-svg" aria-hidden="true">

@@ s17.casting-figure.js.101
<!-- source: casting-figure.js:1097 | kind: markup text -->
Self \u2014 where you stand

@@ s17.casting-figure.js.102
<!-- source: casting-figure.js:1098 | kind: markup text -->
Response \u2014 the other side

@@ s17.casting-figure.js.103
<!-- source: casting-figure.js:1099 | kind: markup text -->
Moving line \u2014 what is turning

@@ s17.casting-figure.js.104
<!-- source: casting-figure.js:1100 | kind: markup text -->
feeds · generating

@@ s17.casting-figure.js.105
<!-- source: casting-figure.js:1101 | kind: markup text -->
checks · controlling

@@ s17.casting-figure.js.106
<!-- source: casting-figure.js:1129 | kind: string -->
" fill="none" stroke="

@@ s17.casting-figure.js.107
<!-- source: casting-figure.js:1129 | kind: string -->
" stroke-width="8.6" stroke-linecap="round" stroke-linejoin="round">

@@ s17.casting-figure.js.108
<!-- source: casting-figure.js:1133 | kind: string -->
s" repeatCount="indefinite"

@@ s17.casting-figure.js.109
<!-- source: casting-figure.js:1135 | kind: string -->
calcMode="spline" keyTimes="

@@ s17.casting-figure.js.110
<!-- source: casting-figure.js:1135 | kind: string -->
" keySplines="

@@ s17.casting-figure.js.111
<!-- source: casting-figure.js:1135 | kind: string -->
" values="

@@ s17.casting-figure.js.112
<!-- source: casting-figure.js:1184 | kind: string -->
" stroke-width="0.5" stroke-linejoin="round" stroke-linecap="round"></path>

@@ s17.casting-figure.js.113
<!-- source: casting-figure.js:1202 | kind: string -->
" r="4.2" fill="var(--paper-raised)" stroke="var(--terracotta)" stroke-width="1.5"></circle>

@@ s17.casting-figure.js.114
<!-- source: casting-figure.js:1203 | kind: string -->
" style="--wd:

@@ s17.casting-figure.js.115
<!-- source: casting-figure.js:1206 | kind: string -->
" text-anchor="end" dominant-baseline="middle">

@@ s17.casting-figure.js.116
<!-- source: casting-figure.js:1210 | kind: string -->
" text-anchor="start" dominant-baseline="middle">

@@ s17.casting-figure.js.117
<!-- source: casting-figure.js:1220 | kind: string -->
color-mix(in oklab,

@@ s17.casting-figure.js.118
<!-- source: casting-figure.js:1220 | kind: string -->
42%, var(--dim))

@@ s17.casting-figure.js.119
<!-- source: casting-figure.js:1225 | kind: string -->
" viewBox="0 0 12 12" refX="7.6" refY="6" markerWidth="

@@ s17.casting-figure.js.120
<!-- source: casting-figure.js:1225 | kind: string -->
" markerHeight="

@@ s17.casting-figure.js.121
<!-- source: casting-figure.js:1245 | kind: string -->
" y="220" text-anchor="middle">

@@ s17.casting-figure.js.122
<!-- source: casting-figure.js:1271 | kind: string -->
three casting coins

@@ s17.casting-figure.js.123
<!-- source: casting-figure.js:1281 | kind: string -->
" fill="var(--ink)"></path></svg>

@@ s17.casting-figure.js.124
<!-- source: casting-figure.js:1338 | kind: string -->
" r="5" fill="none" stroke="var(--terracotta)" stroke-width="1.7" stroke-linecap="round"></circle></g>

@@ s17.casting-figure.js.125
<!-- source: casting-figure.js:1341 | kind: string -->
" fill="none" stroke="var(--terracotta)" stroke-width="1.7" stroke-linecap="round"></path>

@@ s17.casting-figure.js.126
<!-- source: casting-figure.js:1342 | kind: string -->
" fill="none" stroke="var(--terracotta)" stroke-width="1.7" stroke-linecap="round"></path></g>

@@ s17.casting-figure.js.127
<!-- source: casting-figure.js:1351 | kind: string -->
class="bw-af-branch bw-aft-

@@ s17.casting-figure.js.128
<!-- source: casting-figure.js:1351 | kind: string -->
" style="--d:

@@ s17.casting-figure.js.129
<!-- source: casting-figure.js:1409 | kind: string -->
" style="--len:

@@ s17.casting-figure.js.130
<!-- source: casting-figure.js:1434 | kind: string -->
" y="222" text-anchor="middle">

@@ s17.casting-figure.js.131
<!-- source: casting-figure.js:1450 | kind: markup text -->
\u2002Reading the lines \u2014 element by element


---

## 18. liuyao-engine.js

*盘面词汇 — 六亲 / 地支 / 五行 / 卦名 / 旺衰,直接画在盘上* — 65 blocks

@@ s18.liuyao-engine.js.001
<!-- source: liuyao-engine.js:32 | kind: string -->
父母

@@ s18.liuyao-engine.js.002
<!-- source: liuyao-engine.js:32 | kind: string -->
feeds you

@@ s18.liuyao-engine.js.003
<!-- source: liuyao-engine.js:33 | kind: string -->
兄弟

@@ s18.liuyao-engine.js.004
<!-- source: liuyao-engine.js:33 | kind: string -->
your element

@@ s18.liuyao-engine.js.005
<!-- source: liuyao-engine.js:34 | kind: string -->
子孙

@@ s18.liuyao-engine.js.006
<!-- source: liuyao-engine.js:34 | kind: string -->
you feed

@@ s18.liuyao-engine.js.007
<!-- source: liuyao-engine.js:35 | kind: string -->
妻财

@@ s18.liuyao-engine.js.008
<!-- source: liuyao-engine.js:35 | kind: string -->
you control

@@ s18.liuyao-engine.js.009
<!-- source: liuyao-engine.js:36 | kind: string -->
官鬼

@@ s18.liuyao-engine.js.010
<!-- source: liuyao-engine.js:36 | kind: string -->
controls you

@@ s18.liuyao-engine.js.011
<!-- source: liuyao-engine.js:41 | kind: string -->
青龙

@@ s18.liuyao-engine.js.012
<!-- source: liuyao-engine.js:41 | kind: string -->
Azure Dragon

@@ s18.liuyao-engine.js.013
<!-- source: liuyao-engine.js:42 | kind: string -->
朱雀

@@ s18.liuyao-engine.js.014
<!-- source: liuyao-engine.js:42 | kind: string -->
Vermilion Bird

@@ s18.liuyao-engine.js.015
<!-- source: liuyao-engine.js:43 | kind: string -->
勾陈

@@ s18.liuyao-engine.js.016
<!-- source: liuyao-engine.js:43 | kind: string -->
Hook Earth

@@ s18.liuyao-engine.js.017
<!-- source: liuyao-engine.js:44 | kind: string -->
螣蛇

@@ s18.liuyao-engine.js.018
<!-- source: liuyao-engine.js:44 | kind: string -->
Coiling Snake

@@ s18.liuyao-engine.js.019
<!-- source: liuyao-engine.js:45 | kind: string -->
白虎

@@ s18.liuyao-engine.js.020
<!-- source: liuyao-engine.js:45 | kind: string -->
White Tiger

@@ s18.liuyao-engine.js.021
<!-- source: liuyao-engine.js:46 | kind: string -->
玄武

@@ s18.liuyao-engine.js.022
<!-- source: liuyao-engine.js:46 | kind: string -->
Dark Tortoise

@@ s18.liuyao-engine.js.023
<!-- source: liuyao-engine.js:53 | kind: string -->
坤宫

@@ s18.liuyao-engine.js.024
<!-- source: liuyao-engine.js:53 | kind: string -->
Earth Palace

@@ s18.liuyao-engine.js.025
<!-- source: liuyao-engine.js:54 | kind: string -->
震宫

@@ s18.liuyao-engine.js.026
<!-- source: liuyao-engine.js:54 | kind: string -->
Thunder Palace

@@ s18.liuyao-engine.js.027
<!-- source: liuyao-engine.js:55 | kind: string -->
坎宫

@@ s18.liuyao-engine.js.028
<!-- source: liuyao-engine.js:55 | kind: string -->
Water Palace

@@ s18.liuyao-engine.js.029
<!-- source: liuyao-engine.js:56 | kind: string -->
兑宫

@@ s18.liuyao-engine.js.030
<!-- source: liuyao-engine.js:56 | kind: string -->
Lake Palace

@@ s18.liuyao-engine.js.031
<!-- source: liuyao-engine.js:57 | kind: string -->
艮宫

@@ s18.liuyao-engine.js.032
<!-- source: liuyao-engine.js:57 | kind: string -->
Mountain Palace

@@ s18.liuyao-engine.js.033
<!-- source: liuyao-engine.js:58 | kind: string -->
离宫

@@ s18.liuyao-engine.js.034
<!-- source: liuyao-engine.js:58 | kind: string -->
Fire Palace

@@ s18.liuyao-engine.js.035
<!-- source: liuyao-engine.js:59 | kind: string -->
巽宫

@@ s18.liuyao-engine.js.036
<!-- source: liuyao-engine.js:59 | kind: string -->
Wind Palace

@@ s18.liuyao-engine.js.037
<!-- source: liuyao-engine.js:60 | kind: string -->
乾宫

@@ s18.liuyao-engine.js.038
<!-- source: liuyao-engine.js:60 | kind: string -->
Heaven Palace

@@ s18.liuyao-engine.js.039
<!-- source: liuyao-engine.js:92 | kind: string -->
Wandering Soul

@@ s18.liuyao-engine.js.040
<!-- source: liuyao-engine.js:92 | kind: string -->
Returning Soul

@@ s18.liuyao-engine.js.041
<!-- source: liuyao-engine.js:93 | kind: string -->
本宫

@@ s18.liuyao-engine.js.042
<!-- source: liuyao-engine.js:93 | kind: string -->
一世

@@ s18.liuyao-engine.js.043
<!-- source: liuyao-engine.js:93 | kind: string -->
二世

@@ s18.liuyao-engine.js.044
<!-- source: liuyao-engine.js:93 | kind: string -->
三世

@@ s18.liuyao-engine.js.045
<!-- source: liuyao-engine.js:93 | kind: string -->
四世

@@ s18.liuyao-engine.js.046
<!-- source: liuyao-engine.js:93 | kind: string -->
五世

@@ s18.liuyao-engine.js.047
<!-- source: liuyao-engine.js:93 | kind: string -->
游魂

@@ s18.liuyao-engine.js.048
<!-- source: liuyao-engine.js:93 | kind: string -->
归魂

@@ s18.liuyao-engine.js.049
<!-- source: liuyao-engine.js:244 | kind: string -->
computeBoard: line

@@ s18.liuyao-engine.js.050
<!-- source: liuyao-engine.js:244 | kind: string -->
must be a boolean, 0/1, or {yang} — got

@@ s18.liuyao-engine.js.051
<!-- source: liuyao-engine.js:265 | kind: string -->
进神

@@ s18.liuyao-engine.js.052
<!-- source: liuyao-engine.js:266 | kind: string -->
退神

@@ s18.liuyao-engine.js.053
<!-- source: liuyao-engine.js:285 | kind: string -->
computeBoard: need 6 lines

@@ s18.liuyao-engine.js.054
<!-- source: liuyao-engine.js:547 | kind: string -->
乾 branches

@@ s18.liuyao-engine.js.055
<!-- source: liuyao-engine.js:548 | kind: string -->
乾 palace

@@ s18.liuyao-engine.js.056
<!-- source: liuyao-engine.js:549 | kind: string -->
乾 world idx

@@ s18.liuyao-engine.js.057
<!-- source: liuyao-engine.js:550 | kind: string -->
乾 relatives

@@ s18.liuyao-engine.js.058
<!-- source: liuyao-engine.js:553 | kind: string -->
坤 branches

@@ s18.liuyao-engine.js.059
<!-- source: liuyao-engine.js:554 | kind: string -->
坤 world idx

@@ s18.liuyao-engine.js.060
<!-- source: liuyao-engine.js:556 | kind: string -->
坎 branches

@@ s18.liuyao-engine.js.061
<!-- source: liuyao-engine.js:557 | kind: string -->
坎 palace

@@ s18.liuyao-engine.js.062
<!-- source: liuyao-engine.js:558 | kind: string -->
六神 甲日

@@ s18.liuyao-engine.js.063
<!-- source: liuyao-engine.js:561 | kind: string -->
六神 庚日

@@ s18.liuyao-engine.js.064
<!-- source: liuyao-engine.js:563 | kind: string -->
旬空 甲子旬

@@ s18.liuyao-engine.js.065
<!-- source: liuyao-engine.js:565 | kind: string -->
旬空 甲戌旬


---

## 19. liuyao-ai.js

*用神名称,以及模型没答上来时顶上去的占位解读* — 75 blocks

@@ s19.liuyao-ai.js.001
<!-- source: liuyao-ai.js:24 | kind: string -->
父母

@@ s19.liuyao-ai.js.002
<!-- source: liuyao-ai.js:24 | kind: string -->
elders, home, property, documents, vehicles, study, contracts, news

@@ s19.liuyao-ai.js.003
<!-- source: liuyao-ai.js:25 | kind: string -->
兄弟

@@ s19.liuyao-ai.js.004
<!-- source: liuyao-ai.js:25 | kind: string -->
siblings, friends, peers, rivals, partners, shared cost

@@ s19.liuyao-ai.js.005
<!-- source: liuyao-ai.js:26 | kind: string -->
子孙

@@ s19.liuyao-ai.js.006
<!-- source: liuyao-ai.js:26 | kind: string -->
children, juniors, pets, the cure/remedy, ease, joy, what relieves pressure

@@ s19.liuyao-ai.js.007
<!-- source: liuyao-ai.js:27 | kind: string -->
妻财

@@ s19.liuyao-ai.js.008
<!-- source: liuyao-ai.js:27 | kind: string -->
money, income, assets, a man's wife/lover, what you acquire

@@ s19.liuyao-ai.js.009
<!-- source: liuyao-ai.js:28 | kind: string -->
官鬼

@@ s19.liuyao-ai.js.010
<!-- source: liuyao-ai.js:28 | kind: string -->
career/post, authority, a woman's husband/lover, illness, threat, lawsuit

@@ s19.liuyao-ai.js.011
<!-- source: liuyao-ai.js:29 | kind: string -->
世爻

@@ s19.liuyao-ai.js.012
<!-- source: liuyao-ai.js:29 | kind: string -->
you, your own standing — for decisions, travel, general outlook

@@ s19.liuyao-ai.js.013
<!-- source: liuyao-ai.js:74 | kind: string -->
考试:官鬼为名次录取,父母为成绩卷子;子孙为剥官之神

@@ s19.liuyao-ai.js.014
<!-- source: liuyao-ai.js:76 | kind: string -->
功名工作升迁:官鬼为职位、上头、竞争的那一头

@@ s19.liuyao-ai.js.015
<!-- source: liuyao-ai.js:78 | kind: string -->
求财生意:妻财为财本

@@ s19.liuyao-ai.js.016
<!-- source: liuyao-ai.js:80 | kind: string -->
疾病:官鬼为忧神,子孙为解忧之神(近病久病断法相反)

@@ s19.liuyao-ai.js.017
<!-- source: liuyao-ai.js:82 | kind: string -->
男占婚恋:妻财为对方

@@ s19.liuyao-ai.js.018
<!-- source: liuyao-ai.js:84 | kind: string -->
女占婚恋:官鬼为对方

@@ s19.liuyao-ai.js.019
<!-- source: liuyao-ai.js:86 | kind: string -->
子女、宠物、解厄:子孙

@@ s19.liuyao-ai.js.020
<!-- source: liuyao-ai.js:88 | kind: string -->
房屋车船文书合同长辈:父母

@@ s19.liuyao-ai.js.021
<!-- source: liuyao-ai.js:90 | kind: string -->
同行、合伙、竞争、分我之利者:兄弟

@@ s19.liuyao-ai.js.022
<!-- source: liuyao-ai.js:103 | kind: string -->
问题没有点出别的主体,按自占取世爻

@@ s19.liuyao-ai.js.023
<!-- source: liuyao-ai.js:142 | kind: string -->
用神

@@ s19.liuyao-ai.js.024
<!-- source: liuyao-ai.js:142 | kind: string -->
the matter itself

@@ s19.liuyao-ai.js.025
<!-- source: liuyao-ai.js:143 | kind: string -->
原神

@@ s19.liuyao-ai.js.026
<!-- source: liuyao-ai.js:143 | kind: string -->
feeds the subject

@@ s19.liuyao-ai.js.027
<!-- source: liuyao-ai.js:144 | kind: string -->
忌神

@@ s19.liuyao-ai.js.028
<!-- source: liuyao-ai.js:144 | kind: string -->
attacks the subject

@@ s19.liuyao-ai.js.029
<!-- source: liuyao-ai.js:145 | kind: string -->
仇神

@@ s19.liuyao-ai.js.030
<!-- source: liuyao-ai.js:145 | kind: string -->
feeds the adversary

@@ s19.liuyao-ai.js.031
<!-- source: liuyao-ai.js:146 | kind: string -->
泄神

@@ s19.liuyao-ai.js.032
<!-- source: liuyao-ai.js:146 | kind: string -->
saps the subject

@@ s19.liuyao-ai.js.033
<!-- source: liuyao-ai.js:147 | kind: string -->
比和

@@ s19.liuyao-ai.js.034
<!-- source: liuyao-ai.js:147 | kind: string -->
reinforces the subject

@@ s19.liuyao-ai.js.035
<!-- source: liuyao-ai.js:232 | kind: string -->
ALSO-用神(second-subject)

@@ s19.liuyao-ai.js.036
<!-- source: liuyao-ai.js:233 | kind: string -->
attacks-second-用神

@@ s19.liuyao-ai.js.037
<!-- source: liuyao-ai.js:308 | kind: string -->
flying line feeds it (helps it surface)

@@ s19.liuyao-ai.js.038
<!-- source: liuyao-ai.js:309 | kind: string -->
it controls the flying line (can surface)

@@ s19.liuyao-ai.js.039
<!-- source: liuyao-ai.js:310 | kind: string -->
flying line controls it (suppressed)

@@ s19.liuyao-ai.js.040
<!-- source: liuyao-ai.js:311 | kind: string -->
— HIDDEN under line

@@ s19.liuyao-ai.js.041
<!-- source: liuyao-ai.js:315 | kind: string -->
— must resolve can-surface(出伏) vs stays-trapped(伏而不出), weighing month/day too

@@ s19.liuyao-ai.js.042
<!-- source: liuyao-ai.js:323 | kind: string -->
(BOTH are 用神. Either one failing fails the matter. Lines carrying it are flagged

@@ s19.liuyao-ai.js.043
<!-- source: liuyao-ai.js:324 | kind: string -->
ALSO-用神(second-subject); lines that control it are flagged attacks-second-用神.

@@ s19.liuyao-ai.js.044
<!-- source: liuyao-ai.js:325 | kind: string -->
The role field below is measured from the FIRST 用神 only.)

@@ s19.liuyao-ai.js.045
<!-- source: liuyao-ai.js:360 | kind: string -->
· ALSO the second 用神

@@ s19.liuyao-ai.js.046
<!-- source: liuyao-ai.js:361 | kind: string -->
· controls the second 用神 (its 忌神)

@@ s19.liuyao-ai.js.047
<!-- source: liuyao-ai.js:371 | kind: string -->
flying line is VOID — a void flying line lets the hidden one surface

@@ s19.liuyao-ai.js.048
<!-- source: liuyao-ai.js:372 | kind: string -->
flying line is MOVING

@@ s19.liuyao-ai.js.049
<!-- source: liuyao-ai.js:378 | kind: string -->
the flying line transforms into

@@ s19.liuyao-ai.js.050
<!-- source: liuyao-ai.js:380 | kind: string -->
is itself bringing it out

@@ s19.liuyao-ai.js.051
<!-- source: liuyao-ai.js:383 | kind: string -->
hidden under line

@@ s19.liuyao-ai.js.052
<!-- source: liuyao-ai.js:387 | kind: string -->
— rule on can-surface(出伏) vs stays-trapped(伏而不出), weighing month/day

@@ s19.liuyao-ai.js.053
<!-- source: liuyao-ai.js:391 | kind: string -->
none — all six relatives appear among the lines

@@ s19.liuyao-ai.js.054
<!-- source: liuyao-ai.js:395 | kind: string -->
bloc on lines

@@ s19.liuyao-ai.js.055
<!-- source: liuyao-ai.js:410 | kind: string -->
— on line

@@ s19.liuyao-ai.js.056
<!-- source: liuyao-ai.js:410 | kind: string -->
(卦身上卦: it annotates that line; if that is the yongshen, say so)

@@ s19.liuyao-ai.js.057
<!-- source: liuyao-ai.js:411 | kind: string -->
— not among the six line branches (卦身不上卦). Structural, and true of half the 64 hexagrams: it licenses no conclusion about the matter or the asker. Do not mention it.

@@ s19.liuyao-ai.js.058
<!-- source: liuyao-ai.js:435 | kind: string -->
(旬空 for the CASTING day)

@@ s19.liuyao-ai.js.059
<!-- source: liuyao-ai.js:445 | kind: string -->
moving line

@@ s19.liuyao-ai.js.060
<!-- source: liuyao-ai.js:446 | kind: string -->
(独发)

@@ s19.liuyao-ai.js.061
<!-- source: liuyao-ai.js:446 | kind: string -->
no moving lines (静卦)

@@ s19.liuyao-ai.js.062
<!-- source: liuyao-ai.js:453 | kind: string -->
· Clashing

@@ s19.liuyao-ai.js.063
<!-- source: liuyao-ai.js:453 | kind: string -->
· Combining

@@ s19.liuyao-ai.js.064
<!-- source: liuyao-ai.js:454 | kind: string -->
none (still figure)

@@ s19.liuyao-ai.js.065
<!-- source: liuyao-ai.js:470 | kind: string -->
裁决梯未能运行:

@@ s19.liuyao-ai.js.066
<!-- source: liuyao-ai.js:554 | kind: string -->
<=20 words, why this 用神 fits the question

@@ s19.liuyao-ai.js.067
<!-- source: liuyao-ai.js:556 | kind: string -->
<=16 words

@@ s19.liuyao-ai.js.068
<!-- source: liuyao-ai.js:558 | kind: string -->
<=18 words 应期 WITH Gregorian anchors from TIMING REFERENCE at the scale the question asks (near → day/month dates; 以后/long-horizon → branch YEARS, e.g. next Yin year 2034); or empty

@@ s19.liuyao-ai.js.069
<!-- source: liuyao-ai.js:559 | kind: string -->
2-4 sentence answer in '+(lang===

@@ s19.liuyao-ai.js.070
<!-- source: liuyao-ai.js:580 | kind: string -->
+ (YONGSHEN_INFO[subject.key] ? YONGSHEN_INFO[subject.key].cn : subject.key) + (subject.second ? (

@@ s19.liuyao-ai.js.071
<!-- source: liuyao-ai.js:581 | kind: string -->
+ (YONGSHEN_INFO[subject.second] ? YONGSHEN_INFO[subject.second].cn : subject.second) +

@@ s19.liuyao-ai.js.072
<!-- source: liuyao-ai.js:583 | kind: string -->
+ (subject.why ||

@@ s19.liuyao-ai.js.073
<!-- source: liuyao-ai.js:627 | kind: string -->
&& window.claude && typeof window.claude.complete===

@@ s19.liuyao-ai.js.074
<!-- source: liuyao-ai.js:675 | kind: string -->
: (score<=1 ?

@@ s19.liuyao-ai.js.075
<!-- source: liuyao-ai.js:676 | kind: string -->
: strength===


---

## 20. assets/method.js

*方法页的翻卡部件* — 5 blocks

@@ s20.assets/method.js.001
<!-- source: assets/method.js:18 | kind: string -->
preserveAspectRatio="xMidYMid meet"

@@ s20.assets/method.js.002
<!-- source: assets/method.js:102 | kind: string -->
of 6</dd>

@@ s20.assets/method.js.003
<!-- source: assets/method.js:121 | kind: string -->
units · about

@@ s20.assets/method.js.004
<!-- source: assets/method.js:182 | kind: string -->
Tap to go back

@@ s20.assets/method.js.005
<!-- source: assets/method.js:194 | kind: string -->
input, textarea, button, select, a, label


---

## 21. Server responses

*服务端返回、前端原样渲染的报错 —— 只在出事时才看得到的文案* — 53 blocks

@@ s21.Server_responses.001
<!-- source: functions/api/claude.js:139 | kind: error response -->
AI API temporarily disabled

@@ s21.Server_responses.002
<!-- source: functions/api/claude.js:146 | kind: error response -->
OPENROUTER_API_KEY not configured

@@ s21.Server_responses.003
<!-- source: functions/api/claude.js:150 | kind: error response -->
no messages

@@ s21.Server_responses.004
<!-- source: functions/api/claude.js:177 | kind: error response -->
system prompts are assembled server-side and may not be supplied by the client

@@ s21.Server_responses.005
<!-- source: functions/api/claude.js:186 | kind: error response -->
prompt assembly failed

@@ s21.Server_responses.006
<!-- source: functions/api/claude.js:308 | kind: error response -->
a reading must be requested with stream:true — the non-streaming path cannot outlast generation

@@ s21.Server_responses.007
<!-- source: functions/api/claude.js:348 | kind: error response -->
reading failed

@@ s21.Server_responses.008
<!-- source: functions/api/claude.js:550 | kind: error response -->
sign in required for generation

@@ s21.Server_responses.009
<!-- source: functions/api/claude.js:573 | kind: reason response -->
free-reading:

@@ s21.Server_responses.010
<!-- source: functions/api/claude.js:590 | kind: error response -->
insufficient units

@@ s21.Server_responses.011
<!-- source: functions/api/claude.js:610 | kind: error response -->
rate limit exceeded, try again later

@@ s21.Server_responses.012
<!-- source: functions/api/claude.js:697 | kind: error response -->
the reading service is unavailable

@@ s21.Server_responses.013
<!-- source: functions/api/checkout.js:52 | kind: error response -->
payments not configured

@@ s21.Server_responses.014
<!-- source: functions/api/checkout.js:54 | kind: error response -->
accounts backend not configured

@@ s21.Server_responses.015
<!-- source: functions/api/checkout.js:58 | kind: error response -->
sign in required

@@ s21.Server_responses.016
<!-- source: functions/api/checkout.js:62 | kind: error response -->
no sku

@@ s21.Server_responses.017
<!-- source: functions/api/checkout.js:64 | kind: error response -->
unknown sku

@@ s21.Server_responses.018
<!-- source: functions/api/checkout.js:85 | kind: error response -->
checkout failed

@@ s21.Server_responses.019
<!-- source: functions/api/auth/[[path]].js:142 | kind: error response -->
sessions are not configured on this deployment

@@ s21.Server_responses.020
<!-- source: functions/api/auth/[[path]].js:158 | kind: error response -->
accounts backend not configured

@@ s21.Server_responses.021
<!-- source: functions/api/auth/[[path]].js:163 | kind: error response -->
too many sign-ups from this address — try again later

@@ s21.Server_responses.022
<!-- source: functions/api/auth/[[path]].js:168 | kind: error response -->
a valid email is required

@@ s21.Server_responses.023
<!-- source: functions/api/auth/[[path]].js:169 | kind: error response -->
password must be at least 8 characters

@@ s21.Server_responses.024
<!-- source: functions/api/auth/[[path]].js:171 | kind: error response -->
that email is already registered — sign in instead

@@ s21.Server_responses.025
<!-- source: functions/api/auth/[[path]].js:180 | kind: error response -->
too many sign-in attempts — try again later

@@ s21.Server_responses.026
<!-- source: functions/api/auth/[[path]].js:185 | kind: error response -->
email and password are required

@@ s21.Server_responses.027
<!-- source: functions/api/auth/[[path]].js:188 | kind: error response -->
wrong email or password

@@ s21.Server_responses.028
<!-- source: functions/api/auth/[[path]].js:198 | kind: error response -->
apple sign-in not configured

@@ s21.Server_responses.029
<!-- source: functions/api/auth/[[path]].js:200 | kind: error response -->
unknown provider

@@ s21.Server_responses.030
<!-- source: functions/api/auth/[[path]].js:225 | kind: error response -->
no code

@@ s21.Server_responses.031
<!-- source: functions/api/auth/[[path]].js:234 | kind: error response -->
sign-in link expired or came from somewhere else — start again

@@ s21.Server_responses.032
<!-- source: functions/api/auth/[[path]].js:246 | kind: error response -->
token exchange failed

@@ s21.Server_responses.033
<!-- source: functions/api/auth/[[path]].js:248 | kind: error response -->
no access token

@@ s21.Server_responses.034
<!-- source: functions/api/auth/[[path]].js:252 | kind: error response -->
profile fetch failed

@@ s21.Server_responses.035
<!-- source: functions/api/auth/[[path]].js:265 | kind: error response -->
no email from

@@ s21.Server_responses.036
<!-- source: functions/api/auth/[[path]].js:276 | kind: error response -->
not found

@@ s21.Server_responses.037
<!-- source: functions/api/account/[[path]].js:44 | kind: error response -->
accounts backend not configured

@@ s21.Server_responses.038
<!-- source: functions/api/account/[[path]].js:63 | kind: error response -->
not signed in

@@ s21.Server_responses.039
<!-- source: functions/api/account/[[path]].js:71 | kind: error response -->
id required

@@ s21.Server_responses.040
<!-- source: functions/api/account/[[path]].js:78 | kind: error response -->
not found

@@ s21.Server_responses.041
<!-- source: functions/api/billing/[[path]].js:57 | kind: error response -->
accounts backend not configured

@@ s21.Server_responses.042
<!-- source: functions/api/billing/[[path]].js:64 | kind: error response -->
sign in required

@@ s21.Server_responses.043
<!-- source: functions/api/billing/[[path]].js:72 | kind: error response -->
payments not configured

@@ s21.Server_responses.044
<!-- source: functions/api/billing/[[path]].js:74 | kind: error response -->
no active subscription

@@ s21.Server_responses.045
<!-- source: functions/api/billing/[[path]].js:82 | kind: error response -->
cancel failed

@@ s21.Server_responses.046
<!-- source: functions/api/billing/[[path]].js:86 | kind: message response -->
Subscription set to cancel — your plan stays active until the period ends, and your units are yours to keep.

@@ s21.Server_responses.047
<!-- source: functions/api/billing/[[path]].js:92 | kind: error response -->
no billing profile yet

@@ s21.Server_responses.048
<!-- source: functions/api/billing/[[path]].js:100 | kind: error response -->
portal unavailable

@@ s21.Server_responses.049
<!-- source: functions/api/billing/[[path]].js:104 | kind: error response -->
not found

@@ s21.Server_responses.050
<!-- source: functions/api/billing/[[path]].js:109 | kind: error response -->
webhook not configured

@@ s21.Server_responses.051
<!-- source: functions/api/billing/[[path]].js:113 | kind: error response -->
bad signature

@@ s21.Server_responses.052
<!-- source: functions/api/billing/[[path]].js:116 | kind: error response -->
bad payload

@@ s21.Server_responses.053
<!-- source: functions/api/billing/[[path]].js:146 | kind: error response -->
fulfilment failed, will retry


---

## 22. 万物类象 — the 取象 panel

*`assets/xiangshu/lei-xiang.json`, fetched by chat-app and rendered when a*
*reading names a symbol. 38 symbols. A card appears only if that reading*
*happens to mention its symbol — written copy that no page shows on its own.*

@@ s22.xiang.001
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
父母 — Resource
**文书** / paperwork
  · 合同、证书、执照、资质、批文、备案、协议、保单、录取通知、判决书、发票、账本、说明书、文档
  · a contract · a certificate · a licence · a qualification · an approval · a filing · an agreement · an insurance policy · an offer letter · a court ruling · invoices, books · manuals, documentation
**房产** / property
  · 房子、土地、办公室、店面、仓库、租约、装修、地基、围墙
  · a house · land · an office · a shopfront · a warehouse · a lease · fitting-out work · foundations, walls
**长辈** / elders
  · 父母、老师、师父、上级、主管、出资人、监护人、前辈、引路人
  · parents · a teacher · a mentor · a boss or supervisor · whoever put up the money · a guardian · someone further along than you
**车船** / what carries you
  · 车、船、飞机、通勤的路、行李、行装、搬运的工具
  · a car · a boat · a plane · the commute itself · luggage, kit · whatever moves things for you
**平台** / the thing you sit on
  · 平台规则、上级单位、主管机关、渠道方的条款、你挂靠的那套体系、服务器、基础设施
  · platform rules · the parent organisation · a regulator · a channel's terms · the system you operate under · servers, infrastructure
**学业** / study and word-of-mouth
  · 学历、课程、培训、考试、论文、消息、通知、口碑、名声传出去的那部分
  · a degree · courses, training · an examination · a thesis · news, an announcement · word getting around about you
**操劳** / the toil
  · 亲手做的活、跑腿、办手续、加班、照顾人、反复返工的那一摊
  · work done by hand · errands, paperwork queues · overtime · caring for someone · the part you keep redoing
**遮盖** / what covers you
  · 衣服、伞、屋顶、围墙、保险、挡风的那层东西
  · clothing · an umbrella · a roof · a wall · insurance · whatever keeps the weather off
**根基** / the footing
  · 地基、本钱、家底、学过的东西、撑住你的那一层
  · foundations · starting capital · what the family has · what you were taught · the layer holding you up
**动词象意** · 托着、护着、供着、教着、压着、操持、反复地办、背在身上 / holds it up · shelters it · provides for it · teaches it · presses down on it · keeps it running · files it again · carries it

@@ s22.xiang.002
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
兄弟 — Peer
**同辈** / peers
  · 兄弟姐妹、同学、同事、同龄的朋友、同门
  · siblings · classmates · colleagues · friends your own age · people from the same training
**同行** / rivals
  · 竞品、同赛道的人、抢同一批客户的、模仿你的人、比价的对手
  · a competing product · others in the same lane · whoever wants the same customers · imitators · whoever you get priced against
**分利的** / whoever splits it
  · 合伙人、股东、中介、代理、抽成的渠道、分销商、要分红的人
  · a partner · a shareholder · a broker or agent · a channel taking a cut · a distributor · anyone owed a share
**耗费** / what eats it
  · 成本、手续费、平台抽成、房租、人工、被浪费掉的时间、被分走的精力
  · costs · fees and platform cuts · rent · wages · time wasted · attention pulled away
**争夺** / contention
  · 争执、吵架、议价、抢单、口舌是非、僵持不下的那件事
  · an argument · haggling · fighting for the same deal · gossip and friction · the thing that has stalled in a standoff
**阻隔** / what stands in the way
  · 门、墙、中间那道关、挡在中间的人、难跨的那一步
  · a door, a wall · the gate in the middle · whoever stands between · the step that is hard to get over
**邻里** / those alongside
  · 邻居、同乡、同一栋楼的人、常打交道的外人
  · neighbours · people from home · whoever shares the building · the outsiders you deal with daily
**风声** / what blows through
  · 风、传言、一阵一阵的热度、来去不定的东西
  · wind · rumour · a fad that comes in waves · what arrives and leaves
**动词象意** · 分走、争、抢、挡、耗、比、拉扯、替你担一点 / takes a share · contends · grabs · blocks · drains · measures against · pulls back and forth · carries a little for you

@@ s22.xiang.003
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
子孙 — Output
**出品** / what you make
  · 产品、作品、服务、课程、内容、一门手艺做出来的东西
  · a product · a piece of work · a service · a course · content · whatever the craft turns out
**晚辈** / juniors
  · 子女、学生、徒弟、下属、带的新人
  · children · students · apprentices · subordinates · the newcomer you are training
**解厄** / what relieves it
  · 医药、治疗、休息、保险、化解的办法、那个能替你挡一下的东西
  · medicine · treatment · rest · insurance · the way out of it · whatever takes the hit for you
**财源** / where money comes from
  · 复购的客户、持续的收入、被动收入、口碑带来的单、能自己转起来的那部分
  · repeat customers · recurring income · income that arrives without you · work that arrives by reputation · the part that runs itself
**技术** / craft
  · 手艺、方法、诀窍、工具、专利、积累下来的能力
  · a skill · a method, a knack · tools · a patent · capability you have built up
**欢喜** / ease
  · 快乐、放松、玩、休闲、宠物、让你不紧绷的那件事
  · gladness · letting go · play, leisure · a pet · whatever loosens you
**信仰** / what you lean on
  · 僧道、信念、修行、让你安心的那套说法
  · clergy · conviction · practice · the account of things that settles you
**六畜** / the animals
  · 牲口、宠物、养的东西
  · livestock · a pet · whatever you keep and feed
**动词象意** · 生出、化解、泄掉、松开、护住、替你挡、让它转起来 / produces · dissolves · drains off · loosens · guards · takes the hit for you · gets it turning

@@ s22.xiang.004
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
妻财 — Wealth
**钱** / money
  · 现金、收入、利润、工资、分红、回款、存款
  · cash · income · profit · salary · a dividend · money coming back in · savings
**货** / goods
  · 商品、库存、原料、设备、要卖的东西
  · merchandise · stock · materials · equipment · whatever is for sale
**产业** / holdings
  · 店、公司股份、投资、收租的东西、账户
  · a shop · a stake in a company · investments · whatever pays you rent · an account
**女方** / the woman (for a man)
  · 妻子、女友、相亲对象、前任
  · a wife · a girlfriend · someone being introduced · an ex
**人手** / the hands
  · 员工、帮工、外包、替你做事的人
  · employees · helpers · contractors · whoever does it for you
**器物** / things
  · 器皿、家什、仓库、日用的东西、被你占着的那些物件
  · utensils and furnishings · storage · daily objects · the things you keep
**食禄** / what feeds you
  · 饭食、酒、日常开销、养活你的那份
  · food · drink · daily spending · the part that keeps you fed
**凭据** / proof of it
  · 账、流水、合约上的数、看得见的凭证
  · the accounts · the ledger · the number on the contract · evidence you can point to
**动词象意** · 进来、被收下、被占住、被花掉、被分掉、养着、换出去 / comes in · is taken · is tied up · is spent · is split · feeds · is traded away

@@ s22.xiang.005
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
官鬼 — Pressure
**职务** / the post
  · 工作、职位、职称、编制、头衔、那个位子
  · a job · a position · a rank · a permanent post · a title · the seat itself
**上头** / authority
  · 上司、甲方、监管、审批那一关、评审、评委、执法的人
  · a boss · the client who decides · a regulator · the approval step · a review panel · whoever enforces
**男方** / the man (for a woman)
  · 丈夫、男友、追求者、前任
  · a husband · a boyfriend · someone pursuing her · an ex
**病** / illness
  · 病症、旧疾、伤、查出来的问题
  · a complaint · something long-standing · an injury · what a check turned up
**讼** / disputes
  · 官司、纠纷、投诉、索赔、被追责的事
  · a lawsuit · a dispute · a complaint · a claim · being held to account
**压** / what presses
  · 竞争压力、责任、期限、风险、不敢想的那件事、躲不过去的那一关
  · competitive pressure · responsibility · a deadline · risk · the thing you avoid thinking about · the step you cannot go around
**意外** / what comes at you
  · 盗窃、失窃、丢东西、突发的事、被算计
  · theft · losing something · something sudden · being played
**功名** / standing
  · 名分、资历、评级、被承认的那一层
  · a title · seniority · a rating · the recognition itself
**心魔** / what haunts
  · 鬼神、梦魇、放不下的事、半夜想起来的那件
  · spirits · a nightmare · what will not be put down · the thing that wakes you
**天灾** / what falls on you
  · 雷电、风雨、停电、断网、轮不到你决定的坏事
  · thunder · storms · an outage · the bad thing you did not choose
**动词象意** · 克、管、审、罚、逼、缠住、盯着、顶在前头 / restrains · governs · reviews · penalises · forces · entangles · watches · stands in front

@@ s22.xiang.006
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
世爻 — World line
**你** / you
  · 你自己、你的身体、精神、你的名分、位置、你能做主的范围
  · yourself · your body and spirits · your standing · what is yours to decide
**你这一头** / your side
  · 你的立场、你的打算、你手上的资源、你出的那一份
  · your position · what you intend · what you have to work with · what you are putting in
**处境** / where you stand
  · 眼下的局面、你被什么托着、被什么压着、进退的余地
  · how things stand now · what holds you up and what bears down · how much room you have
**你的力气** / what you have to spend
  · 时间、精神、本钱、还能撑多久
  · time · attention · capital · how long you can hold
**动词象意** · 动、守、撑、让步、下决心、抽身 / moves · holds · bears it · gives ground · decides · pulls out

@@ s22.xiang.007
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
应爻 — Response line
**对方** / the other party
  · 他/她、客户、甲方、合作方、谈判桌对面的人
  · him or her · a customer · the client · a partner · whoever is across the table
**外面** / the outside
  · 市场、行情、舆论、大环境、轮不到你决定的那部分
  · the market · conditions · what people are saying · the wider environment · the part that is not yours to decide
**远处** / what is far off
  · 外地、远方的人、还没到跟前的事
  · another place · someone far away · what has not arrived yet
**对面的态度** / how they are toward you
  · 接不接、给不给回应、是不是真心、拖着还是痛快
  · whether they take it · whether they answer · whether they mean it · whether they drag or move
**动词象意** · 回应、不回应、接住、推回来、观望 / answers · stays silent · takes it · pushes it back · waits and watches

@@ s22.xiang.008
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
子 — Rat
**水** / water
  · 江河、沟渠、井、雨、下水道、饮品
  · rivers · channels · a well · rain · drains · drink
**时位** / time and place
  · 夜半 23–1 点、冬月、正北
  · 23:00–01:00 · the eleventh month · due north
**身** / the body
  · 耳、肾、泌尿、血液
  · ears · kidneys · the urinary tract · blood
**性** / the character
  · 机灵、隐秘、流动不定、繁衍
  · quick-witted · secretive · never still · multiplying
**动词象意** · 流动、渗、悄悄地来、繁衍 / flows · seeps · comes quietly · multiplies

@@ s22.xiang.009
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
丑 — Ox
**土** / earth
  · 田、坟、桥、矿、泥
  · fields · a grave · a bridge · a mine · mud
**时位** / time and place
  · 1–3 点、腊月、东北偏北
  · 01:00–03:00 · the twelfth month · north-northeast
**身** / the body
  · 脾、腹、肌肉
  · spleen · belly · muscle
**性** / the character
  · 慢、扛得住、牵拖不清、攒着不放
  · slow · able to bear it · tangled · holding on
**动词象意** · 拖、扛、藏在库里、慢慢磨 / drags · shoulders it · keeps it in store · grinds slowly

@@ s22.xiang.010
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
寅 — Tiger
**木** / wood
  · 山林、大树、木材、柱子
  · forest · a great tree · timber · a pillar
**时位** / time and place
  · 3–5 点、正月、东北偏东
  · 03:00–05:00 · the first month · east-northeast
**身** / the body
  · 胆、手足、筋
  · gallbladder · hands and feet · sinews
**性** / the character
  · 起头、冲、刚、要动
  · setting out · charging · hard · wanting to move
**动词象意** · 起头、冲出去、顶上 / sets out · charges · takes it on

@@ s22.xiang.011
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
卯 — Rabbit
**木** / wood
  · 草木、花、门窗、舟车、纸
  · grass and plants · flowers · doors and windows · boats and carts · paper
**时位** / time and place
  · 5–7 点、二月、正东
  · 05:00–07:00 · the second month · due east
**身** / the body
  · 肝、指、毛发
  · liver · fingers · hair
**性** / the character
  · 柔、繁茂、街市热闹、来回穿梭
  · pliant · luxuriant · the busy street · going back and forth
**动词象意** · 长开、穿来穿去、攀附 / spreads · goes back and forth · climbs on

@@ s22.xiang.012
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
辰 — Dragon
**土** / earth
  · 水库、池塘、土坝、湿地
  · a reservoir · a pond · an embankment · wetland
**时位** / time and place
  · 7–9 点、三月、东南偏东
  · 07:00–09:00 · the third month · east-southeast
**身** / the body
  · 皮肤、肩、背
  · skin · shoulders · the back
**性** / the character
  · 变化、争斗、藏着东西、翻脸快
  · change · struggle · holding something back · turning suddenly
**动词象意** · 翻、蓄住、变脸 / turns over · holds it back · changes face

@@ s22.xiang.013
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
巳 — Snake
**火** / fire
  · 炉灶、电、光、窑、化工
  · a stove · electricity · light · a kiln · chemicals
**时位** / time and place
  · 9–11 点、四月、东南偏南
  · 09:00–11:00 · the fourth month · south-southeast
**身** / the body
  · 小肠、面、咽喉
  · the small intestine · the face · the throat
**性** / the character
  · 文采、弯弯绕、缠、看着静其实动
  · eloquence · roundabout · coiling · still on the surface, moving underneath
**动词象意** · 绕、缠、忽明忽暗 / winds around · coils · flickers

@@ s22.xiang.014
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
午 — Horse
**火** / fire
  · 烈日、火烛、炉、热闹的市面
  · the noon sun · flame · a furnace · a crowded market
**时位** / time and place
  · 11–13 点、五月、正南
  · 11:00–13:00 · the fifth month · due south
**身** / the body
  · 心、目、血
  · the heart · eyes · blood
**性** / the character
  · 急、亮、张扬、来得快去得快
  · urgent · bright · showy · quick to come and go
**动词象意** · 旺起来、张扬、来得快去得快 / blazes up · makes a show · comes and goes fast

@@ s22.xiang.015
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
未 — Goat
**土** / earth
  · 田园、庭院、木库、酒食
  · farmland · a courtyard · the Wood store · food and drink
**时位** / time and place
  · 13–15 点、六月、西南偏南
  · 13:00–15:00 · the sixth month · south-southwest
**身** / the body
  · 脾胃、脊、口
  · stomach and spleen · the spine · the mouth
**性** / the character
  · 温吞、念旧、犹豫、和气
  · mild · attached to the past · hesitant · easy-going
**动词象意** · 和稀泥、念旧、慢半拍 / smooths it over · clings to the past · is half a beat late

@@ s22.xiang.016
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
申 — Monkey
**金** / metal
  · 金属、机械、刀具、车、道路
  · metal · machinery · cutting tools · vehicles · roads
**时位** / time and place
  · 15–17 点、七月、西南偏西
  · 15:00–17:00 · the seventh month · west-southwest
**身** / the body
  · 筋骨、肺、大肠
  · sinew and bone · lungs · the large intestine
**性** / the character
  · 机敏、奔走、变动、坐不住
  · sharp · on the move · changeable · unable to sit still
**动词象意** · 动身、奔走、换来换去 / sets off · runs about · keeps swapping

@@ s22.xiang.017
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
酉 — Rooster
**金** / metal
  · 刀刃、金银首饰、酒、门、精细的器物
  · a blade · silver and jewellery · wine · a gate · fine objects
**时位** / time and place
  · 17–19 点、八月、正西
  · 17:00–19:00 · the eighth month · due west
**身** / the body
  · 肺、口、皮毛
  · lungs · the mouth · skin and hair
**性** / the character
  · 讲究、口舌、准时、挑剔
  · particular · talkative · punctual · fussy
**动词象意** · 挑剔、切割、说出来 / picks at it · cuts it apart · says it aloud

@@ s22.xiang.018
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
戌 — Dog
**土** / earth
  · 山冈、围墙、火库、印章
  · high ground · a wall · the Fire store · a seal
**时位** / time and place
  · 19–21 点、九月、西北偏西
  · 19:00–21:00 · the ninth month · west-northwest
**身** / the body
  · 腿、踝、命门
  · legs · ankles · the lower back
**性** / the character
  · 忠、守、看门、认死理
  · loyal · guarding · keeping watch · stubborn about principle
**动词象意** · 守住、看门、认死理 / guards it · keeps watch · holds to the principle

@@ s22.xiang.019
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
亥 — Pig
**水** / water
  · 江湖、大海、楼阁、厕所、酒
  · rivers and lakes · the sea · upper rooms · the privy · liquor
**时位** / time and place
  · 21–23 点、十月、西北偏北
  · 21:00–23:00 · the tenth month · north-northwest
**身** / the body
  · 头、肾、膀胱
  · the head · kidneys · the bladder
**性** / the character
  · 厚道、能藏、孕育、不争
  · generous · able to keep things · gestating · not contending
**动词象意** · 藏、孕、不争 / stores · gestates · does not contend

@@ s22.xiang.020
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
木 — Wood
**物** / things
  · 树、纸、布、家具、书
  · trees · paper · cloth · furniture · books
**身** / the body
  · 肝胆、筋、眼
  · liver and gallbladder · sinews · the eyes
**性** / the character
  · 生长、伸展、仁、直
  · growth · reaching out · kindness · straightness
**位** / east and green
  · 东方、青绿、春
  · east · green · spring
**动词象意** · 生长、伸出去、顶开、抽条 / grows · reaches out · pushes through · shoots up

@@ s22.xiang.021
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
火 — Fire
**物** / things
  · 灯、电、炉、文书、美的东西
  · lamps · electricity · a stove · documents · beautiful things
**身** / the body
  · 心、血、目
  · the heart · blood · eyes
**性** / the character
  · 向上、明亮、礼、急
  · rising · brightness · courtesy · haste
**位** / south and red
  · 南方、赤红、夏
  · south · red · summer
**动词象意** · 烧起来、照亮、急起来、很快烧完 / flares · lights it · turns urgent · burns out fast

@@ s22.xiang.022
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
土 — Earth
**物** / things
  · 田地、房产、砖石、陶器、仓
  · land · property · brick and stone · pottery · a granary
**身** / the body
  · 脾胃、肌肉、腹
  · stomach and spleen · muscle · the belly
**性** / the character
  · 承载、稳、信、慢
  · carrying · steadiness · trustworthiness · slowness
**位** / centre and yellow
  · 中央、黄、四季末
  · the centre · yellow · the close of each season
**动词象意** · 承住、埋起来、拖住、积起来 / carries it · buries it · drags on it · accumulates

@@ s22.xiang.023
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
金 — Metal
**物** / things
  · 刀、钱、机械、首饰、规矩
  · a blade · coin · machinery · jewellery · rules
**身** / the body
  · 肺、皮毛、大肠
  · lungs · skin and hair · the large intestine
**性** / the character
  · 收敛、锋利、义、肃
  · gathering in · sharpness · duty · severity
**位** / west and white
  · 西方、白、秋
  · west · white · autumn
**动词象意** · 收住、切开、定规矩、肃清 / gathers in · cuts · sets the rule · clears out

@@ s22.xiang.024
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
水 — Water
**物** / things
  · 江河、酒、油、流动的钱、网络
  · rivers · liquor · oil · money in motion · networks
**身** / the body
  · 肾、耳、血
  · kidneys · ears · blood
**性** / the character
  · 润下、流动、智、隐
  · flowing down · movement · wits · concealment
**位** / north and black
  · 北方、黑、冬
  · north · black · winter
**动词象意** · 流走、渗进去、泡软、藏起来 / flows away · seeps in · softens it · conceals

@@ s22.xiang.025
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
青龙 — Azure Dragon
**事** / what it brings
  · 喜事、婚嫁、正财、升迁、宴饮
  · good news · a marriage · honest income · promotion · a feast
**人** / the person
  · 和善、体面、有酒色之好
  · kindly · presentable · fond of wine and pleasure
**动词象意** · 成全、热闹起来、顺水推舟 / brings it off · livens it up · goes with the current

@@ s22.xiang.026
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
朱雀 — Vermilion Bird
**事** / what it brings
  · 口舌、文书、消息、宣传、官非
  · argument · documents · news · publicity · litigation
**人** / the person
  · 能说、急、爱表达
  · articulate · quick · given to speaking out
**动词象意** · 说出去、传开、吵起来 / speaks it · spreads it · starts the row

@@ s22.xiang.027
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
勾陈 — Hook Earth
**事** / what it brings
  · 田土房产、迟滞、旧事翻出、牵连
  · land and property · delay · old business resurfacing · entanglement
**人** / the person
  · 厚重、固执、不灵活
  · solid · stubborn · inflexible
**动词象意** · 拖住、牵连进来、翻旧账 / holds it back · drags others in · reopens old accounts

@@ s22.xiang.028
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
螣蛇 — Coiling Snake
**事** / what it brings
  · 虚惊、反复、怪事、梦、缠住不放
  · a fright that comes to nothing · going round again · something odd · dreams · being held and not let go
**人** / the person
  · 多疑、心思绕、不安
  · suspicious · convoluted · unsettled
**动词象意** · 缠住、反复、虚惊一场 / entangles · goes round again · frightens and comes to nothing

@@ s22.xiang.029
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
白虎 — White Tiger
**事** / what it brings
  · 伤病、血光、丧事、刚断、道路之事
  · injury · blood · mourning · a hard decision · something on the road
**人** / the person
  · 刚猛、不留情面、军警一类
  · forceful · blunt · the uniformed sort
**动词象意** · 伤、断、硬来 / wounds · cuts it off · forces it

@@ s22.xiang.030
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
玄武 — Dark Tortoise
**事** / what it brings
  · 暗昧、私情、盗窃、暗中的损失、看不清
  · obscurity · an affair · theft · quiet losses · not seeing clearly
**人** / the person
  · 心思深、会藏、不明说
  · deep · able to conceal · never quite saying it
**动词象意** · 瞒、偷、暗中挪走 / conceals · steals · moves it quietly

@@ s22.xiang.031
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
乾 — Heaven
**象** / the image
  · 天、君、父、金玉、圆的东西
  · heaven · the ruler · the father · gold and jade · round things
**人事** / in human terms
  · 当家的、决策者、刚健的人、出资方
  · whoever heads it · the decider · someone vigorous · the one funding it
**身** / the body
  · 首、骨、肺
  · the head · bones · lungs
**动词象意** · 决断、主事、顶到底 / decides · takes charge · sees it through

@@ s22.xiang.032
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
兑 — Lake
**象** / the image
  · 泽、口、缺口、刀、少女
  · a marsh · the mouth · a gap · a blade · the youngest daughter
**人事** / in human terms
  · 能说会道、谈判、娱乐、有毁损的事
  · a persuasive talker · negotiation · entertainment · something chipped or broken
**身** / the body
  · 口舌、肺、齿
  · mouth and tongue · lungs · teeth
**动词象意** · 说服、缺一块、取悦 / persuades · chips a piece off · pleases

@@ s22.xiang.033
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
离 — Fire
**象** / the image
  · 火、日、文书、华丽的东西、中虚的东西
  · fire · the sun · documents · showy things · things hollow at the centre
**人事** / in human terms
  · 文化、名声、美、眼见为实的事
  · culture · reputation · beauty · what is seen
**身** / the body
  · 目、心、血
  · eyes · the heart · blood
**动词象意** · 照出来、附上去、显摆 / shows it · attaches to · displays

@@ s22.xiang.034
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
震 — Thunder
**象** / the image
  · 雷、大路、长男、青色、竹木
  · thunder · the main road · the eldest son · green · bamboo and wood
**人事** / in human terms
  · 起头、震动、急切、出发
  · starting · a shock · urgency · setting off
**身** / the body
  · 足、肝、声音
  · feet · the liver · the voice
**动词象意** · 动、惊、起来 / moves · startles · rises

@@ s22.xiang.035
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
巽 — Wind
**象** / the image
  · 风、绳、长女、草木、气
  · wind · cord · the eldest daughter · plants · breath
**人事** / in human terms
  · 渗透、传开、反复不定、做买卖
  · seeping in · spreading · wavering · trade
**身** / the body
  · 股、气、头发
  · thighs · breath · hair
**动词象意** · 渗进去、来回摇摆、传开 / seeps in · sways · spreads

@@ s22.xiang.036
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
坎 — Water
**象** / the image
  · 水、险、陷坑、中男、隐伏的东西
  · water · danger · a pit · the middle son · what lies hidden
**人事** / in human terms
  · 劳苦、风险、暗中的事、智取
  · hard labour · risk · what happens out of sight · winning by wits
**身** / the body
  · 耳、肾、血
  · ears · kidneys · blood
**动词象意** · 陷、流、冒险 / falls in · flows · takes the risk

@@ s22.xiang.037
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
艮 — Mountain
**象** / the image
  · 山、门阙、少男、石、路的尽头
  · a mountain · a gateway · the youngest son · stone · where the road ends
**人事** / in human terms
  · 停下、守着、阻挡、不动
  · stopping · holding · blocking · not moving
**身** / the body
  · 手、背、鼻
  · hands · the back · the nose
**动词象意** · 停、挡、守着不动 / stops · blocks · holds still

@@ s22.xiang.038
<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->
坤 — Earth
**象** / the image
  · 地、母、众多、方正的东西、布
  · earth · the mother · multitude · square things · cloth
**人事** / in human terms
  · 顺从、承载、群众、积累
  · yielding · carrying · the many · accumulation
**身** / the body
  · 腹、脾、肉
  · the belly · the spleen · flesh
**动词象意** · 承受、容纳、积攒 / bears it · holds it all · gathers


---

## Appendix · Deliberately NOT in this deck

每一条都写了理由,因为下一个人的第一反应会是「漏了」。

- **`functions/_lib/prompt-engine.js`** — 提示词栈。**商业机密,而且读者从来看不到它** —— `_middleware.js` 让它保持 404,`tests/prompt-secrecy.mjs` 钉着这条。它是「模型读的字」,归 BOURNEWISE_PROMPT_DECK。
- **`functions/_lib/relative-gloss.js`** — 喂系统提示词里的 SYMBOL_CANDIDATES 块。只到模型,不到页面 —— 读者在取象面板看到的是 `lei-xiang.json`,那一份在下面。
- **`liuyao-verdict.js`** — 《增删卜易》断卦裁决梯。它的每一条 `why` 都写进盘面 payload 给模型读,页面上一个字都不出现。
- **`prompt-checks.js`** — 解读写完之后的核对。源码注释写明「surfaced as telemetry, never acted on」—— 它的判词进日志,不进页面。
- **`functions/_lib/db.js · session.js · password.js`** — SQL 与会话内部,没有面向读者的字。
- **`assets/marks.js · blocks.js · about.js · weave.js`** — 几何与排布,画的是形状不是字。
- **`palette-guide.html · palette-overview.html`** — 色板工具,`_redirects` 挡在 `/tools/*` 的 404 后面。

**判据只有一条:读者的屏幕上会不会出现这些字。**
发给模型的字是另一本册子(`BOURNEWISE_PROMPT_DECK.md`),两者不许混 ——
提示词栈是商业机密,而且它在公网上必须是 404。

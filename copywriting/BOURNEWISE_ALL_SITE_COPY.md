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

**459 blocks** across 10 pages, plus the runtime copy module.

---

## 1. index.html

*The app — sidebar, casting workbench, composer* — 60 blocks

@@ s01.index.html.001
<!-- source: index.html:7 | kind: title -->
BourneWise — Hexagram-based decision analysis

@@ s01.index.html.002
<!-- source: index.html:799 | kind: aria-label -->
New casting

@@ s01.index.html.003
<!-- source: index.html:800 | kind: aria-label -->
BourneWise logomark

@@ s01.index.html.004
<!-- source: index.html:803 | kind: aria-label -->
Collapse sidebar

@@ s01.index.html.005
<!-- source: index.html:813 | kind: aria-label -->
Site navigation

@@ s01.index.html.006
<!-- source: index.html:819 | kind: aria-label -->
Reading history

@@ s01.index.html.007
<!-- source: index.html:837 | kind: aria-label -->
Sign in and your first reading is on us

@@ s01.index.html.008
<!-- source: index.html:838 | kind: aria-label -->
Dismiss

@@ s01.index.html.009
<!-- source: index.html:857 | kind: aria-label -->
Open menu

@@ s01.index.html.010
<!-- source: index.html:873 | kind: aria-label -->
Open the five-minute walk-through

@@ s01.index.html.011
<!-- source: index.html:897 | kind: aria-label -->
Earlier castings to carry

@@ s01.index.html.012
<!-- source: index.html:901 | kind: aria-label -->
Casting question

@@ s01.index.html.013
<!-- source: index.html:902 | kind: aria-label -->
Cast

@@ s01.index.html.014
<!-- source: index.html:908 | kind: aria-label -->
Casting method

@@ s01.index.html.015
<!-- source: index.html:901 | kind: placeholder -->
Describe the situation, then ask one clear question…

@@ s01.index.html.016
<!-- source: index.html:803 | kind: title -->
Collapse sidebar

@@ s01.index.html.017
<!-- source: index.html:857 | kind: title -->
Menu

@@ s01.index.html.018
<!-- source: index.html:863 | kind: title -->
How answers are generated

@@ s01.index.html.019
<!-- source: index.html:900 | kind: title -->
Change casting method

@@ s01.index.html.020
<!-- source: index.html:7 | kind: text -->
BourneWise — Hexagram-based decision analysis

@@ s01.index.html.021
<!-- source: index.html:801 | kind: text -->
BourneWise

@@ s01.index.html.022
<!-- source: index.html:810 | kind: text -->
New casting

@@ s01.index.html.023
<!-- source: index.html:814 | kind: text -->
The method

@@ s01.index.html.024
<!-- source: index.html:815 | kind: text -->
Why BourneWise

@@ s01.index.html.025
<!-- source: index.html:816 | kind: text -->
Plans & units

@@ s01.index.html.026
<!-- source: index.html:820 | kind: text -->
Reading history

@@ s01.index.html.027
<!-- source: index.html:825 | kind: text -->
Available units

@@ s01.index.html.028
<!-- source: index.html:826 | kind: text -->
Usage

@@ s01.index.html.029
<!-- source: index.html:829 | kind: text -->
—

@@ s01.index.html.030
<!-- source: index.html:830 | kind: text -->
units

@@ s01.index.html.031
<!-- source: index.html:833 | kind: text -->
Prepaid balance · no expiry

@@ s01.index.html.032
<!-- source: index.html:834 | kind: text -->
Get units

@@ s01.index.html.033
<!-- source: index.html:834 | kind: text -->
→

@@ s01.index.html.034
<!-- source: index.html:838 | kind: text -->
×

@@ s01.index.html.035
<!-- source: index.html:839 | kind: text -->
First reading?

@@ s01.index.html.036
<!-- source: index.html:839 | kind: text -->
Sign in and

@@ s01.index.html.037
<!-- source: index.html:839 | kind: text -->
the first one is on us

@@ s01.index.html.038
<!-- source: index.html:839 | kind: text -->
— whole, not a sample.

@@ s01.index.html.039
<!-- source: index.html:844 | kind: text -->
Guest

@@ s01.index.html.040
<!-- source: index.html:844 | kind: text -->
Not signed in

@@ s01.index.html.041
<!-- source: index.html:848 | kind: text -->
Sign in to sync your balance and readings

@@ s01.index.html.042
<!-- source: index.html:849 | kind: text -->
Plans

@@ s01.index.html.043
<!-- source: index.html:850 | kind: text -->
Settings

@@ s01.index.html.044
<!-- source: index.html:851 | kind: text -->
Sign out

@@ s01.index.html.045
<!-- source: index.html:862 | kind: text -->
— units

@@ s01.index.html.046
<!-- source: index.html:865 | kind: text -->
We use Claude Opus 5 to generate all answers. Casting fixes the hexagram first.

@@ s01.index.html.047
<!-- source: index.html:868 | kind: text -->
Why

@@ s01.index.html.048
<!-- source: index.html:875 | kind: text -->
How does this work?

@@ s01.index.html.049
<!-- source: index.html:875 | kind: text -->
See how casting, interpretation, and billing fit together.

@@ s01.index.html.050
<!-- source: index.html:888 | kind: text -->
The figure is settled before a word is written about it.

@@ s01.index.html.051
<!-- source: index.html:900 | kind: text -->
Stria 64

@@ s01.index.html.052
<!-- source: index.html:907 | kind: text -->
Enter to submit · Shift+Enter for a new line

@@ s01.index.html.053
<!-- source: index.html:907 | kind: text -->
Follow-ups reuse the current hexagram

@@ s01.index.html.054
<!-- source: index.html:909 | kind: text -->
Stria 64 · about 440 units typical · charged for what it uses

@@ s01.index.html.055
<!-- source: index.html:910 | kind: text -->
Support:

@@ s01.index.html.056
<!-- source: index.html:910 | kind: text -->
hello@bournewise.com

@@ s01.index.html.057
<!-- source: index.html:910 | kind: text -->
·

@@ s01.index.html.058
<!-- source: index.html:910 | kind: text -->
Terms

@@ s01.index.html.059
<!-- source: index.html:910 | kind: text -->
Privacy

@@ s01.index.html.060
<!-- source: index.html:910 | kind: text -->
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
<!-- source: pricing.html:53 | kind: aria-label -->
BourneWise home

@@ s02.pricing.html.004
<!-- source: pricing.html:65 | kind: aria-label -->
Billing cycle

@@ s02.pricing.html.005
<!-- source: pricing.html:70 | kind: aria-label -->
Subscription plans

@@ s02.pricing.html.006
<!-- source: pricing.html:96 | kind: aria-label -->
Usage rates

@@ s02.pricing.html.007
<!-- source: pricing.html:101 | kind: aria-label -->
Usage estimator

@@ s02.pricing.html.008
<!-- source: pricing.html:108 | kind: aria-label -->
Unit packs

@@ s02.pricing.html.009
<!-- source: pricing.html:115 | kind: aria-label -->
Billing rules

@@ s02.pricing.html.010
<!-- source: pricing.html:7 | kind: text -->
Plans & units — BourneWise

@@ s02.pricing.html.011
<!-- source: pricing.html:55 | kind: text -->
BourneWise

@@ s02.pricing.html.012
<!-- source: pricing.html:57 | kind: text -->
The method

@@ s02.pricing.html.013
<!-- source: pricing.html:57 | kind: text -->
Why BourneWise

@@ s02.pricing.html.014
<!-- source: pricing.html:57 | kind: text -->
Start a casting

@@ s02.pricing.html.015
<!-- source: pricing.html:61 | kind: text -->
Plans & units

@@ s02.pricing.html.016
<!-- source: pricing.html:61 | kind: text -->
Nothing is held back, and nothing is cut off.

@@ s02.pricing.html.017
<!-- source: pricing.html:61 | kind: text -->
Units arrive monthly, or a handful at a time, into the one balance. An answer is charged after it is written, for the words it actually used.

@@ s02.pricing.html.018
<!-- source: pricing.html:61 | kind: text -->
Nothing is set aside while an answer is being written, and no ceiling stops it early. A reading that has begun is finished and paid for, even if that empties the balance.

@@ s02.pricing.html.019
<!-- source: pricing.html:63 | kind: text -->
Not signed in

@@ s02.pricing.html.020
<!-- source: pricing.html:63 | kind: text -->
Available units

@@ s02.pricing.html.021
<!-- source: pricing.html:63 | kind: text -->
Sign in

@@ s02.pricing.html.022
<!-- source: pricing.html:66 | kind: text -->
Monthly

@@ s02.pricing.html.023
<!-- source: pricing.html:67 | kind: text -->
Annually

@@ s02.pricing.html.024
<!-- source: pricing.html:68 | kind: text -->
Save 2 months

@@ s02.pricing.html.025
<!-- source: pricing.html:72 | kind: text -->
Free

@@ s02.pricing.html.026
<!-- source: pricing.html:72 | kind: text -->
Create an account and explore the service before paying.

@@ s02.pricing.html.027
<!-- source: pricing.html:73 | kind: text -->
once

@@ s02.pricing.html.028
<!-- source: pricing.html:73 | kind: text -->
Your

@@ s02.pricing.html.029
<!-- source: pricing.html:73 | kind: text -->
first reading

@@ s02.pricing.html.030
<!-- source: pricing.html:73 | kind: text -->
is free

@@ s02.pricing.html.031
<!-- source: pricing.html:74 | kind: text -->
No recurring charge

@@ s02.pricing.html.032
<!-- source: pricing.html:74 | kind: text -->
A whole reading, not a sample

@@ s02.pricing.html.033
<!-- source: pricing.html:74 | kind: text -->
Both reading methods

@@ s02.pricing.html.034
<!-- source: pricing.html:75 | kind: text -->
Create account

@@ s02.pricing.html.035
<!-- source: pricing.html:78 | kind: text -->
Most useful

@@ s02.pricing.html.036
<!-- source: pricing.html:78 | kind: text -->
Pro

@@ s02.pricing.html.037
<!-- source: pricing.html:78 | kind: text -->
For regular readings and focused follow-up threads.

@@ s02.pricing.html.038
<!-- source: pricing.html:79 | kind: text -->
/ month

@@ s02.pricing.html.039
<!-- source: pricing.html:79 | kind: text -->
units

@@ s02.pricing.html.040
<!-- source: pricing.html:79 | kind: text -->
monthly

@@ s02.pricing.html.041
<!-- source: pricing.html:80 | kind: text -->
Both Stria and Sortis

@@ s02.pricing.html.042
<!-- source: pricing.html:80 | kind: text -->
Usage settles automatically

@@ s02.pricing.html.043
<!-- source: pricing.html:80 | kind: text -->
Top up without changing plans

@@ s02.pricing.html.044
<!-- source: pricing.html:81 | kind: text -->
Choose Pro

@@ s02.pricing.html.045
<!-- source: pricing.html:84 | kind: text -->
Premium

@@ s02.pricing.html.046
<!-- source: pricing.html:84 | kind: text -->
For frequent Sortis readings and longer ongoing work.

@@ s02.pricing.html.047
<!-- source: pricing.html:86 | kind: text -->
More units each month

@@ s02.pricing.html.048
<!-- source: pricing.html:87 | kind: text -->
Choose Premium

@@ s02.pricing.html.049
<!-- source: pricing.html:95 | kind: text -->
Rates

@@ s02.pricing.html.050
<!-- source: pricing.html:95 | kind: text -->
The arithmetic, in the open

@@ s02.pricing.html.051
<!-- source: pricing.html:95 | kind: text -->
Input covers your question, conversation context, and computed figure. Output is the written answer. These rates already include the service margin. Nothing is held before an answer runs: the charge is computed once it finishes, from the tokens it actually reported.

@@ s02.pricing.html.052
<!-- source: pricing.html:97 | kind: text -->
Stria 64

@@ s02.pricing.html.053
<!-- source: pricing.html:97 | kind: text -->
per 1,000 input tokens

@@ s02.pricing.html.054
<!-- source: pricing.html:97 | kind: text -->
per 1,000 output tokens

@@ s02.pricing.html.055
<!-- source: pricing.html:97 | kind: text -->
Charged on the tokens the reading actually uses — a shorter reading costs less, always.

@@ s02.pricing.html.056
<!-- source: pricing.html:98 | kind: text -->
Sortis 6

@@ s02.pricing.html.057
<!-- source: pricing.html:102 | kind: text -->
Reading method

@@ s02.pricing.html.058
<!-- source: pricing.html:103 | kind: text -->
Expected output tokens

@@ s02.pricing.html.059
<!-- source: pricing.html:104 | kind: text -->
estimated units for this reading

@@ s02.pricing.html.060
<!-- source: pricing.html:107 | kind: text -->
One-time units

@@ s02.pricing.html.061
<!-- source: pricing.html:107 | kind: text -->
Add units without changing anything else.

@@ s02.pricing.html.062
<!-- source: pricing.html:107 | kind: text -->
One-time unit purchases do not renew automatically and stay in the same balance as plan units.

@@ s02.pricing.html.063
<!-- source: pricing.html:109 | kind: text -->
7,500 units

@@ s02.pricing.html.064
<!-- source: pricing.html:109 | kind: text -->
1,500 units per $1 — same as a plan

@@ s02.pricing.html.065
<!-- source: pricing.html:110 | kind: text -->
15,000 units

@@ s02.pricing.html.066
<!-- source: pricing.html:111 | kind: text -->
30,000 units

@@ s02.pricing.html.067
<!-- source: pricing.html:112 | kind: text -->
75,000 units

@@ s02.pricing.html.068
<!-- source: pricing.html:116 | kind: text -->
Two ways to add units

@@ s02.pricing.html.069
<!-- source: pricing.html:116 | kind: text -->
Use a recurring plan for predictable volume or buy a one-time pack whenever you need it.

@@ s02.pricing.html.070
<!-- source: pricing.html:117 | kind: text -->
Charged for what you use

@@ s02.pricing.html.071
<!-- source: pricing.html:117 | kind: text -->
No units are held in advance and nothing is capped. A reading is billed the tokens it used, and one already underway finishes even if the balance runs out.

@@ s02.pricing.html.072
<!-- source: pricing.html:118 | kind: text -->
One shared balance

@@ s02.pricing.html.073
<!-- source: pricing.html:118 | kind: text -->
Plan units and top-ups fund both Stria and Sortis whenever the account has enough balance.

@@ s02.pricing.html.074
<!-- source: pricing.html:121 | kind: text -->
Receipts are sent automatically.

@@ s02.pricing.html.075
<!-- source: pricing.html:121 | kind: text -->
After every successful payment, Creem emails the receipt and a secure link for invoices, payment methods, and subscription management.

@@ s02.pricing.html.076
<!-- source: pricing.html:123 | kind: text -->
Terms

@@ s02.pricing.html.077
<!-- source: pricing.html:123 | kind: text -->
Privacy

@@ s02.pricing.html.078
<!-- source: pricing.html:123 | kind: text -->
Refunds

@@ s02.pricing.html.079
<!-- source: pricing.html:123 | kind: text -->
hello@bournewise.com

@@ s02.pricing.html.080
<!-- source: pricing.html:123 | kind: text -->
BourneWise · subscriptions, top-ups, and metered usage

---

## 3. guide.html

*The method, walked through* — 59 blocks

@@ s03.guide.html.001
<!-- source: guide.html:11 | kind: title -->
The method

@@ s03.guide.html.002
<!-- source: guide.html:12 | kind: meta description -->
How a BourneWise reading is produced, one step at a time.

@@ s03.guide.html.003
<!-- source: guide.html:99 | kind: aria-label -->
Method

@@ s03.guide.html.004
<!-- source: guide.html:77 | kind: placeholder -->
I have two offers. One pays more; the other gives me control over my time. Which matters more over the next year?

@@ s03.guide.html.005
<!-- source: guide.html:11 | kind: text -->
The method

@@ s03.guide.html.006
<!-- source: guide.html:32 | kind: text -->
BourneWise

@@ s03.guide.html.007
<!-- source: guide.html:34 | kind: text -->
Why BourneWise

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
<!-- source: guide.html:59 | kind: text -->
Every part of a reading is shown here as the thing itself rather than as a description of it. Write a question and watch the checks run. Toss the coins. Move the length and watch the charge follow.

@@ s03.guide.html.019
<!-- source: guide.html:62 | kind: text -->
Nothing on this page is cast or charged

@@ s03.guide.html.020
<!-- source: guide.html:70 | kind: text -->
Step 01 · Frame it

@@ s03.guide.html.021
<!-- source: guide.html:73 | kind: text -->
One clear subject.

@@ s03.guide.html.022
<!-- source: guide.html:79 | kind: text -->
Enough context to work from

@@ s03.guide.html.023
<!-- source: guide.html:80 | kind: text -->
One subject, not several

@@ s03.guide.html.024
<!-- source: guide.html:81 | kind: text -->
A timeframe to aim at

@@ s03.guide.html.025
<!-- source: guide.html:86 | kind: text -->
Write one and watch the checks

@@ s03.guide.html.026
<!-- source: guide.html:92 | kind: text -->
Step 02 · Choose the depth

@@ s03.guide.html.027
<!-- source: guide.html:95 | kind: text -->
Structure, or change.

@@ s03.guide.html.028
<!-- source: guide.html:101 | kind: text -->
Stria 64

@@ s03.guide.html.029
<!-- source: guide.html:101 | kind: text -->
~440 units

@@ s03.guide.html.030
<!-- source: guide.html:102 | kind: text -->
Primary hexagram analysis.

@@ s03.guide.html.031
<!-- source: guide.html:105 | kind: text -->
Sortis 6

@@ s03.guide.html.032
<!-- source: guide.html:105 | kind: text -->
~780 units

@@ s03.guide.html.033
<!-- source: guide.html:106 | kind: text -->
Moving lines and transformed figure included.

@@ s03.guide.html.034
<!-- source: guide.html:113 | kind: text -->
Switch it and the figures redraw

@@ s03.guide.html.035
<!-- source: guide.html:118 | kind: text -->
Step 03 · Let it complete

@@ s03.guide.html.036
<!-- source: guide.html:121 | kind: text -->
The figure comes first.

@@ s03.guide.html.037
<!-- source: guide.html:127 | kind: text -->
Toss the coins

@@ s03.guide.html.038
<!-- source: guide.html:128 | kind: text -->
Three coins a line. Two of eight outcomes move.

@@ s03.guide.html.039
<!-- source: guide.html:132 | kind: text -->
Toss a real set of coins

@@ s03.guide.html.040
<!-- source: guide.html:138 | kind: text -->
Step 04 · Read and continue

@@ s03.guide.html.041
<!-- source: guide.html:141 | kind: text -->
A view, not a verdict.

@@ s03.guide.html.042
<!-- source: guide.html:146 | kind: text -->
Follow the evidence

@@ s03.guide.html.043
<!-- source: guide.html:146 | kind: text -->
Look for the lines and relationships behind the conclusion, and compare them with what you already know.

@@ s03.guide.html.044
<!-- source: guide.html:148 | kind: text -->
Keep follow-ups attached

@@ s03.guide.html.045
<!-- source: guide.html:148 | kind: text -->
A follow-up reuses the current hexagram. A new subject needs a new casting.

@@ s03.guide.html.046
<!-- source: guide.html:151 | kind: text -->
A supportive reading is not a guarantee; an adverse one is not a command

@@ s03.guide.html.047
<!-- source: guide.html:155 | kind: text -->
What to look for

@@ s03.guide.html.048
<!-- source: guide.html:160 | kind: text -->
Step 05 · What it costs

@@ s03.guide.html.049
<!-- source: guide.html:163 | kind: text -->
You pay for what ran.

@@ s03.guide.html.050
<!-- source: guide.html:167 | kind: text -->
Units per 1,000 tokens — input 19.5 · output 97.5

@@ s03.guide.html.051
<!-- source: guide.html:168 | kind: text -->
Answer length

@@ s03.guide.html.052
<!-- source: guide.html:170 | kind: text -->
units · about 1,800 words

@@ s03.guide.html.053
<!-- source: guide.html:171 | kind: text -->
Nothing is held in advance, and a reading underway always finishes

@@ s03.guide.html.054
<!-- source: guide.html:175 | kind: text -->
Move the length, watch the charge

@@ s03.guide.html.055
<!-- source: guide.html:181 | kind: text -->
Ready

@@ s03.guide.html.056
<!-- source: guide.html:183 | kind: text -->
Cast one

@@ s03.guide.html.057
<!-- source: guide.html:184 | kind: text -->
Start a casting →

@@ s03.guide.html.058
<!-- source: guide.html:193 | kind: text -->
Terms

@@ s03.guide.html.059
<!-- source: guide.html:194 | kind: text -->
Privacy

---

## 4. about.html

*What BourneWise is* — 44 blocks

@@ s04.about.html.001
<!-- source: about.html:10 | kind: title -->
Why BourneWise

@@ s04.about.html.002
<!-- source: about.html:11 | kind: meta description -->
Why BourneWise separates the generated hexagram from the model-written interpretation.

@@ s04.about.html.003
<!-- source: about.html:10 | kind: text -->
Why BourneWise

@@ s04.about.html.004
<!-- source: about.html:30 | kind: text -->
BourneWise

@@ s04.about.html.005
<!-- source: about.html:32 | kind: text -->
The method

@@ s04.about.html.006
<!-- source: about.html:33 | kind: text -->
Plans & units

@@ s04.about.html.007
<!-- source: about.html:34 | kind: text -->
Start a casting

@@ s04.about.html.008
<!-- source: about.html:46 | kind: text -->
The cast and the answer are separate systems.

@@ s04.about.html.009
<!-- source: about.html:50 | kind: text -->
BourneWise generates the hexagram first. Claude Opus 5 explains the result it receives. The model writes the interpretation; it does not choose the figure.

@@ s04.about.html.010
<!-- source: about.html:52 | kind: text -->
This separation keeps the source of the reading visible and gives every answer a fixed input you can inspect.

@@ s04.about.html.011
<!-- source: about.html:62 | kind: text -->
Field note 01

@@ s04.about.html.012
<!-- source: about.html:63 | kind: text -->
The figure exists before the prose.

@@ s04.about.html.013
<!-- source: about.html:64 | kind: text -->
Question, cast, and interpretation remain visible as three separate stages.

@@ s04.about.html.014
<!-- source: about.html:71 | kind: text -->
01 — Sequence

@@ s04.about.html.015
<!-- source: about.html:72 | kind: text -->
The sequence is fixed before inference begins.

@@ s04.about.html.016
<!-- source: about.html:77 | kind: text -->
First

@@ s04.about.html.017
<!-- source: about.html:77 | kind: text -->
Your question sets the subject.

@@ s04.about.html.018
<!-- source: about.html:78 | kind: text -->
The decision, people involved, constraints, and timeframe define what the figure must address.

@@ s04.about.html.019
<!-- source: about.html:79 | kind: text -->
Then

@@ s04.about.html.020
<!-- source: about.html:79 | kind: text -->
The engine generates six lines.

@@ s04.about.html.021
<!-- source: about.html:80 | kind: text -->
The primary hexagram, moving lines, and transformed figure are computed independently of the language model.

@@ s04.about.html.022
<!-- source: about.html:81 | kind: text -->
Finally

@@ s04.about.html.023
<!-- source: about.html:81 | kind: text -->
Claude writes from fixed data.

@@ s04.about.html.024
<!-- source: about.html:82 | kind: text -->
The question and computed figure are passed to Claude Opus 5 as evidence for the explanation.

@@ s04.about.html.025
<!-- source: about.html:89 | kind: text -->
02 — Depth

@@ s04.about.html.026
<!-- source: about.html:90 | kind: text -->
Choose the amount of structure your question needs.

@@ s04.about.html.027
<!-- source: about.html:95 | kind: text -->
Stria 64 · about 440 units — Sortis 6 · about 780 units

@@ s04.about.html.028
<!-- source: about.html:96 | kind: text -->
Stria reads the primary hexagram against the current situation. Sortis adds moving lines, the transformed hexagram, and line-by-line change analysis.

@@ s04.about.html.029
<!-- source: about.html:98 | kind: text -->
Both methods use the same casting sequence. They differ in how much of the resulting structure is interpreted.

@@ s04.about.html.030
<!-- source: about.html:106 | kind: text -->
03 — Limits

@@ s04.about.html.031
<!-- source: about.html:107 | kind: text -->
A reading supports reflection. It does not replace judgment.

@@ s04.about.html.032
<!-- source: about.html:112 | kind: text -->
Fixed input

@@ s04.about.html.033
<!-- source: about.html:112 | kind: text -->
The figure cannot be redrawn.

@@ s04.about.html.034
<!-- source: about.html:113 | kind: text -->
The model cannot replace or override the generated hexagram.

@@ s04.about.html.035
<!-- source: about.html:114 | kind: text -->
Explicit limits

@@ s04.about.html.036
<!-- source: about.html:114 | kind: text -->
Signal and extension stay apart.

@@ s04.about.html.037
<!-- source: about.html:115 | kind: text -->
The answer should separate concrete signals from imaginative extension and uncertainty.

@@ s04.about.html.038
<!-- source: about.html:116 | kind: text -->
Reflection

@@ s04.about.html.039
<!-- source: about.html:116 | kind: text -->
Return after the decision.

@@ s04.about.html.040
<!-- source: about.html:117 | kind: text -->
Compare what changed, what held, and what you would decide differently next time.

@@ s04.about.html.041
<!-- source: about.html:125 | kind: text -->
Field note 02

@@ s04.about.html.042
<!-- source: about.html:127 | kind: text -->
See the full process one step at a time →

@@ s04.about.html.043
<!-- source: about.html:138 | kind: text -->
Terms

@@ s04.about.html.044
<!-- source: about.html:139 | kind: text -->
Privacy

---

## 5. login.html

*Sign in and sign up* — 30 blocks

@@ s05.login.html.001
<!-- source: login.html:7 | kind: title -->
Sign in — BourneWise

@@ s05.login.html.002
<!-- source: login.html:138 | kind: aria-label -->
BourneWise home

@@ s05.login.html.003
<!-- source: login.html:176 | kind: aria-label -->
Show password

@@ s05.login.html.004
<!-- source: login.html:166 | kind: placeholder -->
How the reading addresses you

@@ s05.login.html.005
<!-- source: login.html:170 | kind: placeholder -->
you@example.com

@@ s05.login.html.006
<!-- source: login.html:175 | kind: placeholder -->
At least 8 characters

@@ s05.login.html.007
<!-- source: login.html:7 | kind: text -->
Sign in — BourneWise

@@ s05.login.html.008
<!-- source: login.html:140 | kind: text -->
BourneWise

@@ s05.login.html.009
<!-- source: login.html:142 | kind: text -->
&larr;

@@ s05.login.html.010
<!-- source: login.html:142 | kind: text -->
Back to BourneWise

@@ s05.login.html.011
<!-- source: login.html:142 | kind: text -->
Back

@@ s05.login.html.012
<!-- source: login.html:148 | kind: text -->
◆  Account

@@ s05.login.html.013
<!-- source: login.html:149 | kind: text -->
Sync your balance and reading history.

@@ s05.login.html.014
<!-- source: login.html:150 | kind: text -->
Sign in to use the same unit balance, plan, and saved readings across devices.

@@ s05.login.html.015
<!-- source: login.html:159 | kind: text -->
Sign in

@@ s05.login.html.016
<!-- source: login.html:160 | kind: text -->
Create account

@@ s05.login.html.017
<!-- source: login.html:165 | kind: text -->
Name

@@ s05.login.html.018
<!-- source: login.html:169 | kind: text -->
Email

@@ s05.login.html.019
<!-- source: login.html:173 | kind: text -->
Password

@@ s05.login.html.020
<!-- source: login.html:176 | kind: text -->
Show

@@ s05.login.html.021
<!-- source: login.html:186 | kind: text -->
or continue with

@@ s05.login.html.022
<!-- source: login.html:193 | kind: text -->
Google

@@ s05.login.html.023
<!-- source: login.html:200 | kind: text -->
Reddit

@@ s05.login.html.024
<!-- source: login.html:207 | kind: text -->
Discord

@@ s05.login.html.025
<!-- source: login.html:214 | kind: text -->
By continuing, you agree to our

@@ s05.login.html.026
<!-- source: login.html:214 | kind: text -->
Terms

@@ s05.login.html.027
<!-- source: login.html:214 | kind: text -->
and

@@ s05.login.html.028
<!-- source: login.html:214 | kind: text -->
Privacy Policy

@@ s05.login.html.029
<!-- source: login.html:214 | kind: text -->
Your questions and saved readings follow the data controls in your account.

@@ s05.login.html.030
<!-- source: login.html:219 | kind: text -->
BourneWise · fixed hexagram input · Claude Opus 5 interpretation

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
<!-- source: settings.html:143 | kind: text -->
Available balance

@@ s06.settings.html.009
<!-- source: settings.html:143 | kind: text -->
Nothing is held while an answer is generated. When it finishes, the charge is the model usage it actually measured — no reservation and no ceiling.

@@ s06.settings.html.010
<!-- source: settings.html:144 | kind: text -->
Get units

@@ s06.settings.html.011
<!-- source: settings.html:147 | kind: text -->
Plans and metering

@@ s06.settings.html.012
<!-- source: settings.html:147 | kind: text -->
Choose monthly or annual included units, add one-time units, and review the usage rates.

@@ s06.settings.html.013
<!-- source: settings.html:148 | kind: text -->
View plans

@@ s06.settings.html.014
<!-- source: settings.html:151 | kind: text -->
Receipts & billing

@@ s06.settings.html.015
<!-- source: settings.html:151 | kind: text -->
Open your secure Creem portal for receipts, invoices, payment methods, and subscription controls.

@@ s06.settings.html.016
<!-- source: settings.html:154 | kind: text -->
Cancel subscription

@@ s06.settings.html.017
<!-- source: settings.html:162 | kind: text -->
Casting defaults

@@ s06.settings.html.018
<!-- source: settings.html:168 | kind: text -->
Privacy & data

@@ s06.settings.html.019
<!-- source: settings.html:171 | kind: text -->
Reading history

@@ s06.settings.html.020
<!-- source: settings.html:172 | kind: text -->
Delete reading history

@@ s06.settings.html.021
<!-- source: settings.html:175 | kind: text -->
Encrypted at rest

@@ s06.settings.html.022
<!-- source: settings.html:175 | kind: text -->
Readings are never sold or used to train. Delete them whenever you choose.

@@ s06.settings.html.023
<!-- source: settings.html:176 | kind: text -->
Always on

@@ s06.settings.html.024
<!-- source: settings.html:179 | kind: text -->
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
The requested route does not exist.

@@ s10.404.html.008
<!-- source: 404.html:98 | kind: text -->
Check the URL or return to the reading workspace. No units were charged.

@@ s10.404.html.009
<!-- source: 404.html:106 | kind: text -->
Start a reading

@@ s10.404.html.010
<!-- source: 404.html:107 | kind: text -->
See the method

@@ s10.404.html.011
<!-- source: 404.html:111 | kind: text -->
BourneWise · fixed hexagram input · model-written interpretation

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
Welcome and top-up units

@@ s11.copy.js.ledger.capPaid
<!-- source: copy.js | kind: runtime text -->
Plan units + top-ups

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


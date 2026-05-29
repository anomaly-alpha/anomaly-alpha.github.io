# Plan 78: Speakable Spec for Voice Assistants

**Problem:** The site isn't optimized for voice search or voice assistants (Google Assistant, Siri). Adding `speakable` structured data tells voice assistants which content to read aloud.

**Goal:** Add `speakable` annotations to key pages so voice assistants can read gem totals and answers aloud.

---

## Step 1: Add Speakable to main page

In the existing `WebPage` schema, add:

```json
{
  "@type": "WebPage",
  "speakable": {
    "@type": "SpeakableSpecification",
    "cssSelector": [
      ".gem-counter",
      ".gem-mode-btn__count"
    ]
  }
}
```

This tells Google Assistant to read the gem counter and mode count values aloud.

---

## Step 2: Add Speakable to FAQ guide

```json
{
  "@type": "FAQPage",
  "speakable": {
    "@type": "SpeakableSpecification",
    "cssSelector": [
      ".gem-faq__question",
      ".gem-faq__answer"
    ]
  }
}
```

---

## Step 3: Add Speakable to code guide

For the code redemption HowTo:

```json
{
  "@type": "HowTo",
  "speakable": {
    "@type": "SpeakableSpecification",
    "cssSelector": [
      ".gem-howto__step"
    ]
  }
}
```

---

## Step 4: Verify with voice simulation

```bash
# Use Google's Rich Results Test to verify speakable:
# https://search.google.com/test/rich-results
# Check "Speakable" in the results
```

---

## Files Modified: `index.html`, `guide/faq/index.html`, `guide/code/index.html`

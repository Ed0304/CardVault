<script setup lang="ts">
definePageMeta({ layout: 'landing' })

const steps = [
  {
    number: '01',
    title: 'Save',
    text: 'Paste text or a public URL. The original is kept exactly as you saved it.',
  },
  {
    number: '02',
    title: 'Catalog',
    text: 'AI drafts a summary, subjects and keywords. You can review and edit all of it.',
  },
  {
    number: '03',
    title: 'Rediscover',
    text: 'Search by keyword or by meaning, and find related cards from your own vault.',
  },
]

const layers = [
  {
    key: 'original',
    icon: 'file-text',
    title: 'Original source',
    text: 'The extracted text and source details, preserved and never rewritten.',
  },
  {
    key: 'notes',
    icon: 'pencil',
    title: 'Personal notes',
    text: 'Your own observations and annotations. Only you can change them.',
  },
  {
    key: 'ai',
    icon: 'sparkle',
    title: 'AI catalog',
    text: 'A summary, subjects and keywords. It never overwrites your original or your notes.',
  },
] as const
</script>

<template>
  <div class="home">
    <!-- Hero -->
    <section class="hero page" aria-labelledby="hero-title">
      <div class="hero__text">
        <p class="eyebrow">Personal knowledge catalog</p>
        <h1 id="hero-title" class="hero__title">CardVault</h1>
        <p class="hero__lead">
          Save information once. Let CardVault organize it and help you rediscover it.
        </p>
        <p class="hero__support">
          A private catalog for the things worth keeping: preserved as you saved them, cataloged
          by AI, and found again by meaning.
        </p>
        <div class="hero__actions">
          <CommonAppButton to="/catalog">
            Open your catalog
            <CommonAppIcon name="arrow-right" :size="18" />
          </CommonAppButton>
          <CommonAppButton to="/register" variant="secondary">Create an account</CommonAppButton>
        </div>
      </div>

      <!-- Decorative stack of index cards -->
      <div class="hero__art" aria-hidden="true">
        <div class="art-card art-card--back">
          <span class="mono">ORIGINAL</span>
          <span class="art-line" />
          <span class="art-line art-line--short" />
        </div>
        <div class="art-card art-card--mid">
          <span class="mono">NOTES</span>
          <span class="art-line" />
          <span class="art-line art-line--short" />
        </div>
        <div class="art-card art-card--front">
          <span class="mono">AI CATALOG</span>
          <span class="art-title" />
          <span class="art-line" />
          <span class="art-line" />
          <span class="art-line art-line--short" />
          <span class="art-tags"><i /><i /><i /></span>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section class="section page" aria-labelledby="how-title">
      <h2 id="how-title" class="section__title">How it works</h2>
      <ol class="steps">
        <li v-for="step in steps" :key="step.number" class="step surface">
          <span class="mono step__number">{{ step.number }}</span>
          <h3 class="step__title">{{ step.title }}</h3>
          <p class="step__text">{{ step.text }}</p>
        </li>
      </ol>
    </section>

    <!-- Three layers -->
    <section class="section page" aria-labelledby="layers-title">
      <div class="section__intro">
        <h2 id="layers-title" class="section__title">Every card keeps three layers apart</h2>
        <p class="section__lead">
          What you saved, what you think, and what AI suggests are stored separately, so nothing
          is silently overwritten.
        </p>
      </div>
      <ul class="layers">
        <li
          v-for="layer in layers"
          :key="layer.key"
          :class="['layer', 'surface', { 'surface--ai': layer.key === 'ai', 'surface--sunken': layer.key === 'notes' }]"
        >
          <span class="layer__icon"><CommonAppIcon :name="layer.icon" :size="20" /></span>
          <h3 class="layer__title">{{ layer.title }}</h3>
          <p class="layer__text">{{ layer.text }}</p>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.hero {
  display: grid;
  gap: var(--space-12);
  align-items: center;
  padding-block: var(--space-12) var(--space-16);
}
.hero__text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-4);
}
.hero__title {
  font-size: var(--text-display);
  font-weight: var(--weight-medium);
  letter-spacing: -0.025em;
}
.hero__lead {
  max-width: 26ch;
  font-family: var(--font-heading);
  font-size: var(--text-2xl);
  line-height: var(--leading-snug);
  color: var(--text-primary);
}
.hero__support {
  max-width: 52ch;
  font-size: var(--text-lg);
  line-height: var(--leading-relaxed);
  color: var(--text-secondary);
}
.hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

/* Decorative index-card stack */
.hero__art {
  position: relative;
  width: 100%;
  max-width: 26rem;
  aspect-ratio: 6 / 5;
  margin-inline: auto;
}
.art-card {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 78%;
  padding: var(--space-5);
  background: var(--bg-surface);
  border: var(--border-width) solid var(--border-default);
  border-top: 3px solid var(--color-antique-beige);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}
.art-card--back {
  top: 0;
  left: 0;
  transform: rotate(-4deg);
  background: var(--bg-sunken);
}
.art-card--mid {
  top: 12%;
  left: 11%;
  transform: rotate(2deg);
}
.art-card--front {
  top: 26%;
  left: 22%;
  border-top-color: var(--color-terracotta);
  background: var(--bg-ai);
  border-color: var(--border-ai);
  box-shadow: var(--shadow-lg);
}
.art-line,
.art-title,
.art-tags i {
  display: block;
  height: 0.5rem;
  border-radius: var(--radius-pill);
  background: var(--color-antique-beige);
  opacity: 0.7;
}
.art-line--short {
  width: 60%;
}
.art-title {
  height: 0.875rem;
  width: 70%;
  background: var(--color-archive-brown);
  opacity: 0.55;
}
.art-tags {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-1);
}
.art-tags i {
  width: 3rem;
  height: 1.125rem;
  background: var(--color-terracotta);
  opacity: 0.35;
}

/* Sections */
.section {
  padding-block: var(--space-12);
}
.section__intro {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 44rem;
  margin-bottom: var(--space-8);
}
.section__title {
  font-size: var(--text-3xl);
  margin-bottom: var(--space-6);
}
.section__intro .section__title {
  margin-bottom: 0;
}
.section__lead {
  font-size: var(--text-lg);
  color: var(--text-secondary);
}

.steps,
.layers {
  display: grid;
  gap: var(--space-4);
  list-style: none;
}
.step {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.step__number {
  font-size: var(--text-sm);
  color: var(--color-terracotta-strong);
}
.step__text,
.layer__text {
  color: var(--text-secondary);
}
.layer {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.layer__icon {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  border: var(--border-width) solid var(--border-default);
  color: var(--color-archive-brown);
}

@media (min-width: 48rem) {
  .steps,
  .layers {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-5);
  }
}

@media (min-width: 64rem) {
  .hero {
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
    padding-block: var(--space-20);
  }
}
</style>

<script setup lang="ts">
const { createCard, createCardFromUrl, isLoading, error, errorCode } = useCatalog()

/** Failures where the page exists but CardVault can't read it; pasting the text works instead. */
const UNREADABLE = new Set(['SITE_BLOCKED', 'LOGIN_REQUIRED', 'EXTRACTION_FAILED', 'FETCH_TIMEOUT'])
const canPasteInstead = computed(() => tab.value === 'url' && !!errorCode.value && UNREADABLE.has(errorCode.value))

/** Switches to "Paste text" and keeps the address as the card's source URL. */
const pasteInstead = () => {
  textSourceUrl.value = sourceUrl.value.trim()
  tab.value = 'text'
  error.value = null
  errorCode.value = null
}

const tab = ref<'text' | 'url'>('text')
const sourceText = ref('')
const sourceTitle = ref('')
const textSourceUrl = ref('')
const sourceUrl = ref('')

const onSubmit = async () => {
  const card =
    tab.value === 'text'
      ? await createCard({
          sourceText: sourceText.value,
          sourceTitle: sourceTitle.value.trim() || undefined,
          sourceUrl: textSourceUrl.value.trim() || undefined,
        })
      : await createCardFromUrl(sourceUrl.value)

  if (card) await navigateTo(`/catalog/${card.id}`)
}
</script>

<template>
  <section>
    <CommonPageHeading
      title="New card"
      description="Capture a source: paste text, or give the address of a public web page. Saving creates a private card that keeps the source as it is. Its catalog entry comes next, on the card's page."
    />

    <div class="create">
      <form class="create__form surface" @submit.prevent="onSubmit">
        <fieldset class="source-toggle">
          <legend class="source-toggle__legend">Source</legend>
          <div class="source-toggle__options">
            <label class="source-toggle__option">
              <input v-model="tab" type="radio" name="source" value="text" class="visually-hidden" />
              <span><CommonAppIcon name="file-text" :size="18" /> Paste text</span>
            </label>
            <label class="source-toggle__option">
              <input v-model="tab" type="radio" name="source" value="url" class="visually-hidden" />
              <span><CommonAppIcon name="link" :size="18" /> From URL</span>
            </label>
          </div>
        </fieldset>

        <template v-if="tab === 'text'">
          <CommonAppInput
            key="text"
            v-model="sourceText"
            label="Content"
            multiline
            required
            rows="12"
            maxlength="100000"
            hint="Saved exactly as written. The original is never modified."
          />
          <CommonAppInput
            key="title"
            v-model="sourceTitle"
            label="Title"
            optional
            maxlength="300"
            hint="Leave empty to use the first line of the content."
          />
          <CommonAppInput
            key="text-url"
            v-model="textSourceUrl"
            label="Source URL"
            type="url"
            optional
            placeholder="https://"
            hint="Where this text came from, if anywhere."
          />
        </template>
        <CommonAppInput
          v-else
          key="url"
          v-model="sourceUrl"
          label="Public URL"
          type="url"
          required
          maxlength="2048"
          placeholder="https://"
          hint="A public http or https web page. CardVault reads it once and saves its readable text and details, not the page's HTML. Pages that need a login or JavaScript to show their text, and sites that block automated access, can't be read; paste the text instead."
        />

        <CommonAppAlert v-if="error" title="Couldn't save the card">
          {{ error }}
          <div v-if="canPasteInstead" class="create__fallback">
            <CommonAppButton variant="secondary" size="sm" @click="pasteInstead">
              <CommonAppIcon name="file-text" :size="16" />
              Paste the text instead
            </CommonAppButton>
          </div>
        </CommonAppAlert>

        <div class="create__actions">
          <CommonAppButton type="submit" :loading="isLoading">
            {{ isLoading ? (tab === 'url' ? 'Reading the page…' : 'Saving…') : 'Save card' }}
          </CommonAppButton>
          <CommonAppButton to="/catalog" variant="ghost">Cancel</CommonAppButton>
        </div>
      </form>

      <aside class="create__aside surface surface--ai" aria-labelledby="next-title">
        <div class="create__aside-header">
          <span class="create__aside-icon"><CommonAppIcon name="sparkle" :size="18" /></span>
          <h2 id="next-title">What happens next</h2>
        </div>
        <ol class="create__steps">
          <li>
            <strong>Save.</strong> CardVault stores the source and opens your new card. Pasted text
            can be up to 100,000 characters; a longer web page keeps its first 100,000. Muse is
            not involved.
          </li>
          <li>
            <strong>Catalog.</strong> On the card, write its catalog entry yourself, or choose
            “Catalog with Muse” for suggested details: a title, description, facts, subject
            headings, keywords and related concepts.
          </li>
          <li>
            <strong>Review.</strong> Muse's suggestions arrive as a draft, marked as AI-generated.
            Edit them, then save them to the card or discard them. The source itself is never
            changed.
          </li>
        </ol>
        <p class="create__aside-note">
          <CommonAppIcon name="lock" :size="14" />
          New cards are private to you. Nothing is sent to Muse until you ask on the card's page.
        </p>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.create {
  display: grid;
  gap: var(--space-6);
  align-items: start;
}
.create__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
.create__fallback {
  margin-top: var(--space-3);
}
.create__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

/* Source segmented control (native radios, so keyboard support is built in) */
.source-toggle {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.source-toggle__legend {
  padding: 0;
  margin-bottom: var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}
.source-toggle__options {
  display: inline-flex;
  max-width: 100%;
  padding: var(--space-1);
  background: var(--bg-sunken);
  border: var(--border-width) solid var(--border-subtle);
  border-radius: var(--radius-md);
}
.source-toggle__option span {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--control-height-sm);
  padding: 0 var(--space-4);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast);
}
.source-toggle__option:hover span {
  color: var(--text-primary);
}
.source-toggle__option input:checked + span {
  background: var(--bg-surface);
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}
.source-toggle__option input:focus-visible + span {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}

/* Aside */
.create__aside {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.create__aside-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.create__aside-header h2 {
  font-size: var(--text-xl);
}
.create__aside-icon {
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--radius-md);
  background: var(--color-terracotta-strong);
  color: var(--color-ivory);
}
.create__steps {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-left: var(--space-5);
  color: var(--text-secondary);
}
.create__steps strong {
  color: var(--text-primary);
}
.create__aside-note {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-muted);
}
.create__aside-note :deep(.app-icon) {
  flex-shrink: 0;
  margin-top: 0.2rem;
}

@media (min-width: 64rem) {
  .create {
    grid-template-columns: minmax(0, 1fr) 20rem;
    gap: var(--space-8);
  }
}
</style>

<script setup lang="ts">
import { COMMUNITY_PAGE_SIZE } from '~/composables/useCommunity'

// Guests may browse and search published cards (REQ-DISC-001).
definePageMeta({ public: true })

const { isAuthenticated } = useAuth()
const route = useRoute()
const { cards, total, isLoading, error, fetchCards } = useCommunity()

// Search text and page live in the URL, so results can be linked and the back button works.
const firstOf = (value: unknown) => (Array.isArray(value) ? value[0] : value)
const activeQuery = computed(() => String(firstOf(route.query.q) ?? '').trim())
const page = computed(() => {
  const n = Number(firstOf(route.query.page))
  return Number.isInteger(n) && n > 0 ? n : 1
})
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / COMMUNITY_PAGE_SIZE)))

const query = ref(activeQuery.value)

const load = () => fetchCards({ q: activeQuery.value, page: page.value })
onMounted(load)
watch(() => [activeQuery.value, page.value], load)
watch(activeQuery, (value) => {
  query.value = value
})

const onSearch = (q: string) =>
  navigateTo({ path: '/community', query: q.trim() ? { q: q.trim() } : {} })

const goToPage = (n: number) =>
  navigateTo({
    path: '/community',
    query: { ...(activeQuery.value ? { q: activeQuery.value } : {}), ...(n > 1 ? { page: String(n) } : {}) },
  })
</script>

<template>
  <section>
    <CommonPageHeading
      title="Community Catalog"
      eyebrow="Published by CardVault members"
      description="Cards that their owners chose to publish. Open one to read its catalog entry, and save your own copy to your vault."
    />

    <div class="stack" style="--stack-gap: var(--space-5)">
      <CatalogSearch
        v-model="query"
        label="Search published cards"
        :show-modes="false"
        @search="onSearch"
      />

      <p v-if="activeQuery && !isLoading && !error" class="community__summary">
        {{ total === 1 ? '1 card matches' : `${total} cards match` }}
        <strong>“{{ activeQuery }}”</strong>.
        <NuxtLink to="/community">Clear search</NuxtLink>
      </p>

      <CommonLoadingState v-if="isLoading" variant="cards" label="Loading the Community Catalog…" />
      <CommonAppAlert v-else-if="error" title="The Community Catalog didn't load">
        {{ error }}
      </CommonAppAlert>

      <ul v-else-if="cards.length" class="community__grid">
        <li v-for="card in cards" :key="card.id">
          <CommunityCard :card="card" />
        </li>
      </ul>

      <CommonEmptyState
        v-else-if="activeQuery"
        title="No published cards match"
        description="Try different words. Search covers titles, summaries, subjects, keywords and any shared text."
        icon="search"
      />
      <CommonEmptyState
        v-else
        title="Nothing published yet"
        description="When members publish cards, they appear here. You can publish one of yours from its page in your vault."
        icon="globe"
      >
        <CommonAppButton v-if="isAuthenticated" to="/catalog" variant="secondary">Go to My Vault</CommonAppButton>
        <CommonAppButton v-else to="/register" variant="secondary">Create an account to catalog your own</CommonAppButton>
      </CommonEmptyState>

      <nav v-if="!isLoading && !error && pageCount > 1" class="community__pager" aria-label="Pages">
        <CommonAppButton variant="secondary" size="sm" :disabled="page <= 1" @click="goToPage(page - 1)">
          <CommonAppIcon name="arrow-left" :size="16" />
          Previous
        </CommonAppButton>
        <span class="mono">Page {{ page }} of {{ pageCount }}</span>
        <CommonAppButton variant="secondary" size="sm" :disabled="page >= pageCount" @click="goToPage(page + 1)">
          Next
          <CommonAppIcon name="arrow-right" :size="16" />
        </CommonAppButton>
      </nav>
    </div>
  </section>
</template>

<style scoped>
.community__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr));
  gap: var(--space-4);
  list-style: none;
}
.community__summary {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}
.community__pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}
@media (min-width: 48rem) {
  .community__grid {
    gap: var(--space-5);
  }
}
</style>

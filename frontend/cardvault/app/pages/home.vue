<script setup lang="ts">
/**
 * Personal home (REQ-DISC-008): a welcome, the main actions, and today's recommendations from
 * the Community Catalog. Only signed-in users who finished onboarding get here (route guard).
 */
const { user } = useAuth()
const { shelf, isLoading, error, fetchToday } = useRecommendations()

onMounted(fetchToday)

const today = computed(() => (shelf.value ? formatDate(`${shelf.value.date}T12:00:00Z`) : ''))
</script>

<template>
  <section class="home">
    <header class="home__welcome surface">
      <div>
        <p class="eyebrow">Reading room</p>
        <h1 class="home__title">Welcome, {{ user?.username }}!</h1>
        <p class="home__lead">Your library is ready to explore.</p>
        <p class="home__support">
          Save sources as cards, catalog them, and find them again, with connections to what
          other members have published.
        </p>
      </div>
      <nav class="home__actions" aria-label="Library actions">
        <CommonAppButton to="/catalog/create">
          <CommonAppIcon name="plus" :size="18" />
          Create card
        </CommonAppButton>
        <CommonAppButton to="/catalog" variant="secondary">
          <CommonAppIcon name="catalog" :size="18" />
          My Vault
        </CommonAppButton>
        <CommonAppButton to="/community" variant="secondary">
          <CommonAppIcon name="globe" :size="18" />
          Explore the Community Catalog
        </CommonAppButton>
      </nav>
    </header>

    <section class="home__shelf" aria-labelledby="today-heading">
      <header class="home__shelf-header">
        <div>
          <p class="eyebrow">
            From the Community Catalog<template v-if="today"> · {{ today }}</template>
          </p>
          <h2 id="today-heading" class="home__shelf-title">Recommended cards for today</h2>
        </div>
        <NuxtLink to="/settings" class="home__tune">
          <CommonAppIcon name="sliders" :size="16" />
          Change your interests
        </NuxtLink>
      </header>

      <CommonLoadingState v-if="isLoading" variant="cards" label="Finding cards for you…" />
      <CommonAppAlert v-else-if="error" title="No recommendations right now">
        {{ error }}
        <CommonAppButton variant="ghost" size="sm" @click="fetchToday">Try again</CommonAppButton>
      </CommonAppAlert>

      <ul v-else-if="shelf?.items.length" class="home__grid">
        <li v-for="item in shelf.items" :key="item.card.id">
          <RecommendationsRecommendationCard :item="item" />
        </li>
      </ul>

      <CommonEmptyState
        v-else-if="shelf"
        title="The shelves are still filling up"
        description="No published cards from other members are available to recommend yet. Browse the Community Catalog, or catalog something yourself and publish it for others."
        icon="globe"
      >
        <CommonAppButton to="/community" variant="secondary">Browse the Community Catalog</CommonAppButton>
        <CommonAppButton to="/catalog/create">Create your first card</CommonAppButton>
      </CommonEmptyState>

      <p v-if="shelf?.items.length" class="home__note">
        Picked from cards other members published, matched against your interests, the headings
        and related concepts on your own cards, and one or two topics you haven't chosen. Picks
        hold steady through the day and change when you edit your interests or new cards are
        published. Your vault and interests are never shown to anyone else.
      </p>
    </section>

    <CommonHowItWorks class="home__how" />
  </section>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}
.home__welcome {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-5);
  padding: var(--space-6);
  border-top: 3px solid var(--color-archive-brown);
  background:
    radial-gradient(
      40rem 16rem at 100% 0%,
      color-mix(in srgb, var(--color-antique-beige) 30%, transparent),
      transparent 70%
    ),
    var(--bg-surface);
}
.home__title {
  font-size: var(--text-3xl);
}
.home__lead {
  margin-top: var(--space-1);
  font-size: var(--text-lg);
  color: var(--text-secondary);
}
.home__support {
  max-width: 52ch;
  margin-top: var(--space-2);
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  color: var(--text-secondary);
}
.home__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.home__shelf {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
.home__shelf-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
}
.home__shelf-title {
  font-size: var(--text-2xl);
}
.home__tune {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-sm);
}
.home__grid {
  display: grid;
  gap: var(--space-4);
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 17rem), 1fr));
  list-style: none;
}
.home__note {
  font-size: var(--text-xs);
  line-height: var(--leading-normal);
  color: var(--text-muted);
}
.home__how {
  padding-top: var(--space-6);
  border-top: var(--border-width) dashed var(--border-default);
}
</style>

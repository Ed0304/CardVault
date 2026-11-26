<script setup lang="ts">
import { primaryNavLinks, type NavLink } from '~/utils/navigation'

const route = useRoute()
const { isAuthenticated } = useAuth()

/** Signed-in-only links show a lock to signed-out visitors, as in the header; following one leads to login. */
const isLocked = (link: NavLink) => link.requiresAuth && !isAuthenticated.value
</script>

<template>
  <aside class="app-sidebar">
    <nav aria-label="Main">
      <p class="eyebrow app-sidebar__label">Library</p>
      <ul class="app-sidebar__list">
        <li v-for="link in primaryNavLinks" :key="link.to">
          <NuxtLink
            :to="link.to"
            class="app-sidebar__link"
            :aria-current="link.isActive(route.path) ? 'page' : undefined"
          >
            <CommonAppIcon :name="link.icon" :size="18" />
            {{ link.label }}
            <span v-if="isLocked(link)" class="app-sidebar__lock">
              <CommonAppIcon name="lock" :size="14" />
              <span class="visually-hidden">(log in required)</span>
            </span>
          </NuxtLink>
        </li>
      </ul>
    </nav>

    <p class="app-sidebar__note">
      <CommonAppIcon name="lock" :size="16" />
      Private by default. Cards stay in your vault unless you publish them, and notes, collections
      and tags are never shared.
    </p>
  </aside>
</template>

<style scoped>
.app-sidebar {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--space-6);
  padding: var(--space-6) var(--space-4);
  background: var(--bg-surface);
  border-right: var(--border-width) solid var(--border-subtle);
}
.app-sidebar__label {
  padding: 0 var(--space-3);
  margin-bottom: var(--space-2);
}
.app-sidebar__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  list-style: none;
}
.app-sidebar__link {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: var(--control-height);
  padding: 0 var(--space-3);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  text-decoration: none;
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast);
}
.app-sidebar__lock {
  display: inline-flex;
  margin-left: auto;
  color: var(--text-muted);
}
.app-sidebar__link:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.app-sidebar__link[aria-current='page'] {
  background: var(--bg-sunken);
  color: var(--text-primary);
  box-shadow: inset 3px 0 0 var(--color-terracotta);
}
.app-sidebar__link[aria-current='page'] :deep(.app-icon) {
  color: var(--color-terracotta-strong);
}
.app-sidebar__note {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--bg-sunken);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  line-height: var(--leading-normal);
  color: var(--text-secondary);
}
.app-sidebar__note :deep(.app-icon) {
  margin-top: 0.1rem;
  color: var(--color-archive-brown);
}
</style>

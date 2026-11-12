<script setup lang="ts">
import { primaryNavLinks } from '~/utils/navigation'

/**
 * "app"  → used with the sidebar layout; inline links are hidden and the
 *          mobile menu is shown below 64rem.
 * "site" → used on the landing page; inline links are shown from 48rem up.
 */
withDefaults(defineProps<{ variant?: 'app' | 'site' }>(), { variant: 'app' })

const { user, isAuthenticated, logout } = useAuth()
const route = useRoute()

const menuOpen = ref(false)
const menuId = `mobile-menu-${useId()}`

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
  },
)
</script>

<template>
  <header :class="['site-header', `site-header--${variant}`]" @keydown.esc="menuOpen = false">
    <div class="page site-header__bar">
      <NuxtLink to="/" class="site-header__brand" aria-label="CardVault home">
        <CommonAppLogo />
      </NuxtLink>

      <nav class="site-header__nav" aria-label="Primary">
        <NuxtLink
          v-for="link in primaryNavLinks"
          :key="link.to"
          :to="link.to"
          class="site-header__link"
          :aria-current="link.isActive(route.path) ? 'page' : undefined"
        >
          {{ link.label }}
        </NuxtLink>
      </nav>

      <div class="site-header__actions">
        <template v-if="isAuthenticated">
          <span class="site-header__user">{{ user?.username ?? user?.email }}</span>
          <CommonAppButton variant="ghost" size="sm" @click="logout">Log out</CommonAppButton>
        </template>
        <template v-else>
          <CommonAppButton to="/login" variant="ghost" size="sm">Log in</CommonAppButton>
          <CommonAppButton to="/register" size="sm">Register</CommonAppButton>
        </template>

        <button
          type="button"
          class="site-header__toggle"
          :aria-expanded="menuOpen"
          :aria-controls="menuId"
          @click="menuOpen = !menuOpen"
        >
          <CommonAppIcon :name="menuOpen ? 'close' : 'menu'" />
          <span class="visually-hidden">{{ menuOpen ? 'Close menu' : 'Open menu' }}</span>
        </button>
      </div>
    </div>

    <nav v-if="menuOpen" :id="menuId" class="site-header__menu" aria-label="Mobile">
      <div class="page">
        <NuxtLink
          v-for="link in primaryNavLinks"
          :key="link.to"
          :to="link.to"
          class="site-header__menu-link"
          :aria-current="link.isActive(route.path) ? 'page' : undefined"
        >
          <CommonAppIcon :name="link.icon" :size="18" />
          {{ link.label }}
        </NuxtLink>
      </div>
    </nav>
  </header>
</template>

<style scoped>
.site-header {
  position: sticky;
  top: 0;
  z-index: 40;
  background: color-mix(in srgb, var(--color-ivory) 92%, transparent);
  border-bottom: var(--border-width) solid var(--border-subtle);
  backdrop-filter: blur(8px);
}
.site-header__bar {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-height: var(--header-height);
}
.site-header__brand {
  display: inline-flex;
  text-decoration: none;
  border-radius: var(--radius-sm);
}

/* Inline navigation (hidden by default; enabled per variant below) */
.site-header__nav {
  display: none;
  align-items: center;
  gap: var(--space-1);
  margin-left: var(--space-4);
}
.site-header__link {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  text-decoration: none;
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast);
}
.site-header__link:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.site-header__link[aria-current='page'] {
  color: var(--text-primary);
  background: var(--bg-sunken);
}

.site-header__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
}
.site-header__user {
  display: none;
  max-width: 14rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.site-header__toggle {
  display: inline-grid;
  place-items: center;
  width: var(--control-height-sm);
  height: var(--control-height-sm);
  padding: 0;
  background: transparent;
  border: var(--border-width) solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color var(--transition-fast);
}
.site-header__toggle:hover {
  background: var(--bg-hover);
}

/* Mobile menu panel */
.site-header__menu {
  border-top: var(--border-width) solid var(--border-subtle);
  background: var(--bg-surface);
  padding-block: var(--space-2);
}
.site-header__menu .page {
  display: flex;
  flex-direction: column;
}
.site-header__menu-link {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: var(--control-height);
  padding: 0 var(--space-3);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-weight: var(--weight-medium);
  text-decoration: none;
}
.site-header__menu-link:hover {
  background: var(--bg-hover);
}
.site-header__menu-link[aria-current='page'] {
  background: var(--bg-sunken);
  box-shadow: inset 3px 0 0 var(--color-terracotta);
}

@media (min-width: 40rem) {
  .site-header__user {
    display: block;
  }
}

/* "site" variant: inline nav from 48rem */
@media (min-width: 48rem) {
  .site-header--site .site-header__nav {
    display: flex;
  }
  .site-header--site .site-header__toggle,
  .site-header--site .site-header__menu {
    display: none;
  }
}

/* "app" variant: sidebar takes over from 64rem */
@media (min-width: 64rem) {
  .site-header--app .site-header__toggle,
  .site-header--app .site-header__menu {
    display: none;
  }
}
</style>

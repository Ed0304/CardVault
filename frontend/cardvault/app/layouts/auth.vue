<template>
  <div class="auth-shell">
    <main id="main-content" class="auth-shell__main" tabindex="-1">
      <NuxtLink to="/" class="auth-shell__brand" aria-label="CardVault home">
        <CommonAppLogo size="lg" />
      </NuxtLink>

      <div class="auth-shell__card surface">
        <slot />
      </div>

      <p class="auth-shell__note">
        <CommonAppIcon name="lock" :size="14" />
        Private by design. Your cards are visible only to you.
      </p>
    </main>
  </div>
</template>

<style scoped>
.auth-shell {
  min-height: 100vh;
  display: flex;
  background:
    radial-gradient(
      60rem 30rem at 50% -10%,
      color-mix(in srgb, var(--color-antique-beige) 35%, transparent),
      transparent 70%
    ),
    var(--bg-app);
}
.auth-shell__main {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-6);
  padding: var(--space-8) var(--space-4);
}
.auth-shell__brand {
  display: inline-flex;
  text-decoration: none;
  border-radius: var(--radius-sm);
}
.auth-shell__card {
  width: 100%;
  max-width: var(--container-sm);
  padding: var(--space-6);
  box-shadow: var(--shadow-md);
}
.auth-shell__note {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-align: center;
}

@media (min-width: 40rem) {
  .auth-shell__card {
    padding: var(--space-8);
  }
}
</style>

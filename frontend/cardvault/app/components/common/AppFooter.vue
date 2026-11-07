<script setup lang="ts">
const year = new Date().getFullYear()
</script>

<template>
  <footer class="site-footer">
    <div class="page site-footer__inner">
      <div class="site-footer__brand">
        <CommonAppLogo size="sm" />
        <p>Your private knowledge catalog.</p>
      </div>
      <p class="site-footer__legal">© {{ year }} CardVault. Built for the Kiro Hackathon.</p>
    </div>
  </footer>
</template>

<style scoped>
.site-footer {
  margin-top: auto;
  border-top: var(--border-width) solid var(--border-subtle);
  background: var(--bg-surface);
}
.site-footer__inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3) var(--space-6);
  padding-block: var(--space-5);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}
.site-footer__brand {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}
.site-footer__legal {
  color: var(--text-muted);
}
</style>

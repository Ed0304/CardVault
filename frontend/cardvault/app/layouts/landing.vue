<template>
  <div class="landing-shell">
    <CommonAppHeader variant="site" />
    <main id="main-content" class="landing-shell__main" tabindex="-1">
      <slot />
    </main>
    <CommonAppFooter />
  </div>
</template>

<style scoped>
.landing-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.landing-shell__main {
  flex: 1;
}
</style>

<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { login } = useAuth()

const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const isSubmitting = ref(false)

const onSubmit = async () => {
  isSubmitting.value = true
  error.value = null
  try {
    await login({ email: email.value, password: password.value })
    await navigateTo('/catalog')
  } catch {
    error.value = 'Invalid credentials.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <form class="auth-form" @submit.prevent="onSubmit">
    <header class="auth-form__header">
      <h1>Log in</h1>
      <p>Welcome back to your catalog.</p>
    </header>

    <CommonAppAlert v-if="error">{{ error }}</CommonAppAlert>

    <CommonAppInput
      v-model="email"
      label="Email"
      type="email"
      required
      autocomplete="email"
      placeholder="you@example.com"
    />
    <CommonAppInput
      v-model="password"
      label="Password"
      type="password"
      required
      autocomplete="current-password"
    />

    <CommonAppButton type="submit" block :loading="isSubmitting">
      {{ isSubmitting ? 'Logging in…' : 'Log in' }}
    </CommonAppButton>

    <p class="auth-form__footer">No account? <NuxtLink to="/register">Register</NuxtLink></p>
  </form>
</template>

<style scoped>
.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
.auth-form__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.auth-form__header p {
  color: var(--text-secondary);
}
.auth-form__footer {
  text-align: center;
  font-size: var(--text-sm);
  color: var(--text-secondary);
}
</style>

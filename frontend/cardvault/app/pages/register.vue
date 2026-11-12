<script setup lang="ts">
import { getApiErrorMessage } from '~/services/api'

definePageMeta({ layout: 'auth' })

const { register } = useAuth()

const username = ref('')
const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const isSubmitting = ref(false)

const onSubmit = async () => {
  isSubmitting.value = true
  error.value = null
  try {
    await register({
      username: username.value.trim(),
      email: email.value,
      password: password.value,
    })
    await navigateTo('/catalog')
  } catch (err) {
    error.value = getApiErrorMessage(
      err,
      'Could not create the account. Check your details and try again.',
    )
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <form class="auth-form" @submit.prevent="onSubmit">
    <header class="auth-form__header">
      <h1>Create account</h1>
      <p>Start your private knowledge catalog.</p>
    </header>

    <CommonAppAlert v-if="error">{{ error }}</CommonAppAlert>

    <CommonAppInput
      v-model="username"
      label="Username"
      required
      minlength="3"
      maxlength="100"
      pattern="[A-Za-z0-9_.\-]+"
      autocomplete="username"
      hint="3 to 100 characters: letters, numbers, dots, hyphens and underscores."
    />
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
      minlength="8"
      autocomplete="new-password"
      hint="At least 8 characters."
    />

    <CommonAppButton type="submit" block :loading="isSubmitting">
      {{ isSubmitting ? 'Creating account…' : 'Register' }}
    </CommonAppButton>

    <p class="auth-form__footer">Already registered? <NuxtLink to="/login">Log in</NuxtLink></p>
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

<script setup lang="ts">
import type { AiStatus } from '~/types/card'

withDefaults(
  defineProps<{
    status: AiStatus
    /** Short label for use inside cards. */
    compact?: boolean
  }>(),
  { compact: false },
)

const labels: Record<AiStatus, string> = {
  PENDING: 'AI cataloging in progress…',
  COMPLETE: 'AI cataloging complete',
  FAILED: 'AI cataloging failed. Your original content is safe.',
}

const compactLabels: Record<AiStatus, string> = {
  PENDING: 'Cataloging',
  COMPLETE: 'Cataloged',
  FAILED: 'AI failed',
}
</script>

<template>
  <p :class="['ai-status', `ai-status--${status.toLowerCase()}`, { 'ai-status--compact': compact }]" role="status">
    <span class="ai-status__dot" aria-hidden="true" />
    {{ compact ? compactLabels[status] : labels[status] }}
  </p>
</template>

<style scoped>
.ai-status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  font-size: var(--text-sm);
  line-height: 1.4;
}
.ai-status--compact {
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
}
.ai-status__dot {
  flex-shrink: 0;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: currentColor;
}
.ai-status--pending {
  color: var(--warning-text);
}
.ai-status--pending .ai-status__dot {
  animation: ai-pulse 1.4s ease-in-out infinite;
}
.ai-status--complete {
  color: var(--success-text);
}
.ai-status--failed {
  color: var(--error-text);
}
@keyframes ai-pulse {
  50% {
    opacity: 0.35;
    transform: scale(0.8);
  }
}
</style>

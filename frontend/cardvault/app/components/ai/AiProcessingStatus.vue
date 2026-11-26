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

// The status describes the owner's latest request to Muse, not who wrote the saved entry:
// COMPLETE stays after the owner discards the suggestions, and NOT_AVAILABLE covers entries
// written by hand.
const labels: Record<AiStatus, string> = {
  PENDING: 'Muse is drafting suggestions…',
  COMPLETE: 'Muse has made suggestions for this card.',
  FAILED: "Muse's last attempt failed. Your card is unchanged.",
  NOT_AVAILABLE: "Muse hasn't been asked to catalog this card.",
}

const compactLabels: Record<AiStatus, string> = {
  PENDING: 'Muse drafting',
  COMPLETE: 'Muse suggested',
  FAILED: 'Muse failed',
  NOT_AVAILABLE: 'Muse not asked',
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
/* Neutral: the operation was not attempted, which is not an error. */
.ai-status--not_available {
  color: var(--text-muted);
}
@keyframes ai-pulse {
  50% {
    opacity: 0.35;
    transform: scale(0.8);
  }
}
</style>

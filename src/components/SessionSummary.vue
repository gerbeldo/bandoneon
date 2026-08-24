<template>
  <Modal :model-value="open" @update:model-value="emit('dismiss')">
    <div class="px-4 py-8 text-center">
      <p class="mb-8">
        <strong>{{ counts[2] }}</strong> {{ t('correct') }} · <strong>{{ counts[1] }}</strong>
        {{ t('partial_credit') }} · <strong>{{ counts[0] }}</strong> {{ t('wrong') }}
      </p>
      <Button primary @click.prevent="emit('again')">
        {{ ran === 'sweep' ? t('try_again') : t('new_session') }}
      </Button>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { useI18n } from 'petite-vue-i18n';

import Button from './Button.vue';
import Modal from './Modal.vue';

// The primary action repeats what was just run; dismissing returns to the card.
defineProps<{
  open: boolean;
  counts: [number, number, number];
  ran: 'session' | 'sweep';
}>();

const emit = defineEmits<{ again: []; dismiss: [] }>();

const { t } = useI18n();
</script>

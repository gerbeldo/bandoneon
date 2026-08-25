<template>
  <Modal :model-value="open" @update:model-value="emit('dismiss')">
    <div class="px-4 py-8 text-center">
      <p class="mb-8">
        <strong>{{ counts[2] }}</strong> correct · <strong>{{ counts[1] }}</strong> partial credit ·
        <strong>{{ counts[0] }}</strong> wrong
      </p>
      <Button primary @click.prevent="emit('again')">
        {{ ran === 'sweep' ? 'Try again' : 'New session' }}
      </Button>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import Button from './Button.vue';
import Modal from './Modal.vue';

// The primary action repeats what was just run; dismissing returns to the card.
defineProps<{
  open: boolean;
  counts: [number, number, number];
  ran: 'session' | 'sweep';
}>();

const emit = defineEmits<{ again: []; dismiss: [] }>();
</script>

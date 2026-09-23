import { ref } from 'vue'

export function useTargetModal<T>() {
  const open = ref(false)
  const target = ref<T | null>(null)
  const loading = ref(false)
  const error = ref('')

  function openWith(row: T) {
    target.value = row
    error.value = ''
    open.value = true
  }

  return { open, target, loading, error, openWith }
}

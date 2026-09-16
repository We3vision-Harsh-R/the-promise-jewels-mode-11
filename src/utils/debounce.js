export function debounce(fn, wait = 300) {
  let timeout
  return function debounced(...args) {
    clearTimeout(timeout)
    timeout = setTimeout(() => fn.apply(this, args), wait)
  }
}

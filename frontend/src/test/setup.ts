import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

// jsdom doesn't do layout, so it has no scrolling.
// Like current Chrome, return a Promise, so an effect that returns it fails here too.
Element.prototype.scrollIntoView = () => Promise.resolve()

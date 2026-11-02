interface Props {
  /** Size of the spinner. Defaults to 'sm'. */
  size?: 'xs' | 'sm'
  /** Color variant. 'white' for dark buttons, 'brand' for light/outline contexts. */
  variant?: 'white' | 'brand' | 'muted'
}

const SIZE = { xs: 'w-3 h-3 border-[1.5px]', sm: 'w-4 h-4 border-2' }
const COLOR = {
  white: 'border-white/30 border-t-white',
  brand: 'border-brand-100 border-t-brand-500',
  muted: 'border-zinc-200 border-t-zinc-500',
}

export default function Spinner({ size = 'sm', variant = 'white' }: Props) {
  return (
    <span
      className={`inline-block rounded-full animate-spin flex-shrink-0 ${SIZE[size]} ${COLOR[variant]}`}
      aria-hidden="true"
    />
  )
}
